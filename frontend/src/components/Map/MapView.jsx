import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline, LayersControl, LayerGroup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

// Fix for default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const { BaseLayer } = LayersControl;

// ── Constants ─────────────────────────────────────────────────────────────────
const POI_MIN_ZOOM = 15;    // no POI fetches below this zoom level
const POI_VIEWPORT_ZOOM = 15;    // use live viewport bounds at this zoom+
const MOVE_DEBOUNCE_MS = 3000;  // wait 3s after panning stops before fetching
const BOUNDS_CHANGE_THRESHOLD = 0.008; // ~880m minimum viewport shift to re-fetch
const POI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache for POI results
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5150';

// ── POI Cache helpers ─────────────────────────────────────────────────────────
// sessionStorage cache keyed by "type:s,w,n,e" (rounded to 2dp).
// Avoids repeated 2-5s Overpass API round trips for recently-visited areas.
function poiCacheKey(type, bounds) {
  const r = (n) => Math.round(n * 100) / 100; // round to 2 decimal places (~1km grid)
  return `poi:${type}:${r(bounds.south)},${r(bounds.west)},${r(bounds.north)},${r(bounds.east)}`;
}

function poiCacheGet(type, bounds) {
  try {
    const raw = sessionStorage.getItem(poiCacheKey(type, bounds));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > POI_CACHE_TTL_MS) return null; // expired
    return data;
  } catch { return null; }
}

function poiCacheSet(type, bounds, data) {
  try {
    sessionStorage.setItem(poiCacheKey(type, bounds), JSON.stringify({ ts: Date.now(), data }));
  } catch { /* sessionStorage full — ignore */ }
}

// ── Shared AbortController ────────────────────────────────────────────────────
let currentFetchController = null;

// ── Helper Components ─────────────────────────────────────────────────────────

function ResizeHandler({ layoutMode }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(timer);
  }, [layoutMode, map]);
  return null;
}

function MapController({ center, onPOIUpdate, onBoundsChange, isPickingFromMap, onMapClick, isPrecise }) {
  const map = useMap();
  const debounceRef = useRef(null);
  const lastBoundsRef = useRef(null);

  // Fly to user location when it first arrives
  const hasFlownRef = useRef(false);

  useEffect(() => {
    if (center?.lat && center?.lon && !hasFlownRef.current) {
      hasFlownRef.current = true;
      const zoom = isPrecise ? 13 : 5;
      map.flyTo([center.lat, center.lon], zoom, { duration: 1.5 });
    }
  }, [center, map, isPrecise]);

  // Crosshair cursor for pick-from-map mode
  useEffect(() => {
    if (!isPickingFromMap) return;
    map.getContainer().style.cursor = 'crosshair';
    const handler = (e) => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    map.once('click', handler);
    return () => {
      map.off('click', handler);
      map.getContainer().style.cursor = '';
    };
  }, [isPickingFromMap, map, onMapClick]);

  // ── Core POI loader ───────────────────────────────────────────
  const loadPOIs = useCallback(async () => {
    const zoom = map.getZoom();

    // GUARD 1 – zoom gate: no requests below minimum zoom
    if (zoom < POI_MIN_ZOOM) {
      onPOIUpdate({ hospitals: [], restaurants: [], hotels: [] });
      return;
    }

    // Determine fetch bounds from current viewport
    let bounds;
    if (zoom >= POI_VIEWPORT_ZOOM) {
      const b = map.getBounds();
      bounds = { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
    } else {
      if (!center?.lat || !center?.lon) return;
      const delta = 0.05;
      bounds = {
        south: center.lat - delta, west: center.lon - delta,
        north: center.lat + delta, east: center.lon + delta,
      };
    }

    // GUARD 2 – bounds deduplication: skip if the viewport hasn't shifted enough
    if (lastBoundsRef.current) {
      const prev = lastBoundsRef.current;
      const delta = Math.max(
        Math.abs(bounds.south - prev.south), Math.abs(bounds.north - prev.north),
        Math.abs(bounds.west - prev.west), Math.abs(bounds.east - prev.east),
      );
      if (delta < BOUNDS_CHANGE_THRESHOLD) return;
    }
    lastBoundsRef.current = bounds;

    // GUARD 3 – cache hit: serve instantly from sessionStorage (5-min TTL per area)
    const cachedH  = poiCacheGet('hospital',   bounds);
    const cachedR  = poiCacheGet('restaurant', bounds);
    const cachedHt = poiCacheGet('hotel',      bounds);
    if (cachedH && cachedR && cachedHt) {
      onPOIUpdate({ hospitals: cachedH, restaurants: cachedR, hotels: cachedHt });
      return; // skip all network calls
    }

    // Cancel any in-flight fetch batch from a previous pan
    if (currentFetchController) {
      currentFetchController.abort();
    }
    const controller = new AbortController();
    currentFetchController = controller;

    // ── Sequential fetching (NOT parallel) ───────────────────────
    // The backend semaphore allows only 1 Overpass call at a time.
    try {
      const hospitals    = cachedH  || await fetchPOIFromBackend('hospital',   bounds, controller.signal);
      if (controller.signal.aborted) return;

      const restaurants  = cachedR  || await fetchPOIFromBackend('restaurant', bounds, controller.signal);
      if (controller.signal.aborted) return;

      const hotels       = cachedHt || await fetchPOIFromBackend('hotel',      bounds, controller.signal);
      if (controller.signal.aborted) return;

      onPOIUpdate({ hospitals, restaurants, hotels });
    } catch (e) {
      if (e.name !== 'AbortError') console.error('[POI] Batch fetch error:', e);
    }
  }, [map, onPOIUpdate, center]);

  // Debounced moveend listener
  useEffect(() => {
    const handleMoveEnd = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (onBoundsChange) {
          const b = map.getBounds();
          onBoundsChange({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
        }
        loadPOIs();
      }, MOVE_DEBOUNCE_MS);
    };
    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
      clearTimeout(debounceRef.current);
    };
  }, [map, loadPOIs, onBoundsChange]);

  return null;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const createMarkerIcon = (color, letter) => L.divIcon({
  className: '',
  html: `<div class="custom-marker ${color}"><span class="marker-letter">${letter}</span><div class="marker-pulse"></div></div>`,
  iconSize: [36, 42], iconAnchor: [18, 42], popupAnchor: [0, -44]
});

// ── Icon caches — one L.divIcon per unique letter, reused across renders ──────
const _availCache = new Map();
const _unavailCache = new Map();

const availableIcon = (letter) => {
  if (!_availCache.has(letter))
    _availCache.set(letter, createMarkerIcon('marker-available', letter));
  return _availCache.get(letter);
};

const unavailableIcon = (letter) => {
  if (!_unavailCache.has(letter))
    _unavailCache.set(letter, createMarkerIcon('marker-unavailable', letter));
  return _unavailCache.get(letter);
};

// Teardrop pin icons — colored head (rotated circle) + downward pointing tail
const createPinIcon = (emoji, bgColor, borderColor) => L.divIcon({
  className: '',
  html: `
    <div class="poi-pin-wrapper">
      <div class="poi-pin-head" style="background:${bgColor};border-color:${borderColor};">
        <span class="poi-pin-emoji">${emoji}</span>
      </div>
      <div class="poi-pin-tail" style="border-top-color:${bgColor};"></div>
    </div>
  `,
  iconSize: [38, 52],
  iconAnchor: [19, 52],
  popupAnchor: [0, -54],
});

const hospitalIcon = createPinIcon('🏥', '#ef4444', '#dc2626'); // red
const restaurantIcon = createPinIcon('🍽️', '#f97316', '#ea580c'); // orange
const hotelIcon = createPinIcon('🏨', '#6366f1', '#4f46e5'); // indigo

const userIcon = L.divIcon({
  className: '',
  html: `<div class="user-marker"><div class="user-pulse"></div></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10]
});

const pickedStartIcon = L.divIcon({
  className: '',
  html: `<div style="background:#10b981;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 12px #10b981;"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8]
});

// Peer location icon for Social Sync
const peerIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:32px;height:32px;">
    <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border:3px solid #fff;box-shadow:0 0 16px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;font-size:14px;">🤝</div>
    <div style="position:absolute;inset:0;border-radius:50%;border:3px solid rgba(59,130,246,0.4);animation:ss-peer-pulse 2s ease-in-out infinite;"></div>
  </div>
  <style>@keyframes ss-peer-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.6);opacity:0}}</style>`,
  iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -20]
});

// ── POI fetch: sequential, abort-aware, Retry-After-aware ────────────────────
async function fetchPOIFromBackend(type, bounds, signal) {
  const { south, west, north, east } = bounds;
  const url = `${API_BASE_URL}/api/poi/${type}?south=${south}&west=${west}&north=${north}&east=${east}`;

  try {
    const res = await fetch(url, { signal });

    if (!res.ok) {
      // Read Retry-After header if backend sent one (from semaphore 429)
      const retryAfter = res.headers.get('Retry-After');
      if (res.status === 429 && retryAfter) {
        console.warn(`[POI] ${type} → 429, server asked to retry after ${retryAfter}s`);
      } else {
        console.warn(`[POI] ${type} → HTTP ${res.status}`);
      }
      return [];
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn(`[POI] ${type} → unexpected content-type: ${contentType}`);
      return [];
    }

    const data = await res.json();
    const result = (data.elements || [])
      .filter(el => el.lat && el.lon)
      .map(el => ({
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        name: el.tags?.name || (type.charAt(0).toUpperCase() + type.slice(1)),
        address: [el.tags?.['addr:street'], el.tags?.['addr:housenumber']].filter(Boolean).join(' ') || '',
      }));

    // Save to 5-minute session cache so panning back skips the Overpass round-trip
    poiCacheSet(type, bounds, result);
    return result;
  } catch (e) {
    if (e.name === 'AbortError') return [];
    console.error(`[POI] ${type} fetch error:`, e);
    return [];
  }
}

// ── POI Marker Component — memo prevents re-render when other state changes ───
const POIMarkers = memo(function POIMarkers({ pois, icon, label, badgeColor }) {
  return pois.map(poi => (
    <Marker key={`${label}-${poi.id}`} position={[poi.lat, poi.lon]} icon={icon}>
      <Popup>
        <div style={{ minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{poi.name}</div>
          {poi.address && (
            <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>📍 {poi.address}</div>
          )}
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 600,
            background: badgeColor, color: '#fff',
            borderRadius: 4, padding: '2px 8px'
          }}>{label}</span>
        </div>
      </Popup>
    </Marker>
  ));
});

// ── Map UI Controls ───────────────────────────────────────────────────────────

function LocateMeButton({ onLocate }) {
  const map = useMap();

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      map.locate({ setView: true, maxZoom: 15 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        // Step 1 — zoom out smoothly from current view
        const currentZoom = map.getZoom();
        const zoomOutLevel = Math.max(4, currentZoom - 5);
        map.flyTo(map.getCenter(), zoomOutLevel, { duration: 0.9, easeLinearity: 0.4 });

        // Step 2 — once zoom-out settles, fly to user location
        map.once('moveend', () => {
          setTimeout(() => {
            map.flyTo([lat, lon], 15, { duration: 1.8, easeLinearity: 0.2 });
            if (onLocate) onLocate({ lat, lon });
          }, 120);
        });
      },
      () => {
        // Permission denied or timeout — fallback
        map.locate({ setView: true, maxZoom: 15 });
        map.once('locationfound', (e) => {
          if (onLocate) onLocate({ lat: e.latlng.lat, lon: e.latlng.lng });
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, [map, onLocate]);

  useEffect(() => {
    const btn = L.DomUtil.create('button', 'locate-me-btn');
    btn.innerHTML = '📍';
    L.DomEvent.disableClickPropagation(btn);
    btn.onclick = handleLocate;
    const zoomControl = document.querySelector('.leaflet-control-zoom');
    if (zoomControl) {
      const wrapper = L.DomUtil.create('div', 'leaflet-control leaflet-bar locate-wrapper');
      wrapper.appendChild(btn);
      zoomControl.parentNode.appendChild(wrapper);
    }
    return () => document.querySelector('.locate-wrapper')?.remove();
  }, [handleLocate]);

  return null;
}

function FlyToHandler({ flyTo }) {
  const map = useMap();
  useEffect(() => {
    if (!flyTo) return;
    if (flyTo.bbox) {
      const [minLon, minLat, maxLon, maxLat] = flyTo.bbox;
      if (isNaN(minLat) || isNaN(minLon) || isNaN(maxLat) || isNaN(maxLon)) return;
      map.fitBounds([[minLat, minLon], [maxLat, maxLon]], { padding: [40, 40], maxZoom: 14 });
    } else {
      const finalLat = flyTo.lat !== undefined ? flyTo.lat : flyTo.latitude;
      const finalLon = flyTo.lon !== undefined ? flyTo.lon : (flyTo.lng !== undefined ? flyTo.lng : flyTo.longitude);
      if (finalLat === undefined || finalLon === undefined || isNaN(finalLat) || isNaN(finalLon)) return;
      map.flyTo([finalLat, finalLon], 13, { duration: 1.2 });
    }
  }, [flyTo, map]);
  return null;
}

// ── Main MapView Component ────────────────────────────────────────────────────

function MapView({
  stations = [], userLocation, selectedStation,
  onSelectStation, onGetDirections,
  activeRoute,
  onBoundsChange,
  isPickingFromMap,
  onMapPickedStart,
  pickedStart,
  flyTo,
  layoutMode,
  isPrecise,
  peerLocation,
  peerDestination,
  routeDestination
}) {
  const defaultCenter = [20.5937, 78.9629];

  const [pois, setPOIs] = useState({ hospitals: [], restaurants: [], hotels: [] });
  const [showHospitals] = useState(true);
  const [showRestaurants] = useState(true);
  const [showHotels] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(5);

  const handlePOIUpdate = useCallback((newPOIs) => setPOIs(newPOIs), []);
  const handleMapClick = useCallback((coords) => {
    if (onMapPickedStart) onMapPickedStart({ ...coords, label: 'Picked from Map' });
  }, [onMapPickedStart]);

  const routePolyline = activeRoute ? activeRoute.map(p => [p.latitude, p.longitude]) : null;

  // Tracks current zoom level to conditionally show POIs and hint
  function ZoomTracker() {
    const map = useMap();
    useEffect(() => {
      const onZoom = () => setCurrentZoom(map.getZoom());
      map.on('zoomend', onZoom);
      return () => map.off('zoomend', onZoom);
    }, [map]);
    return null;
  }



  return (
    <div className="map-wrapper">
      <MapContainer
        center={defaultCenter}
        zoom={5}
        minZoom={2}
        maxZoom={19}
        worldCopyJump={true}
        className="leaflet-map"
      >
        <ResizeHandler layoutMode={layoutMode} />
        <ZoomTracker />

        {/* ── Tile Layers ── */}
        <LayersControl position="topright">
          {/* Normal Map */}
          <BaseLayer checked name="Map (Light)">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
              minZoom={2}
              maxZoom={19}
            />
          </BaseLayer>

          {/* Dark Map */}
          <BaseLayer name="Map (Dark)">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; CartoDB'
              minZoom={2}
              maxZoom={19}
            />
          </BaseLayer>

          {/* Terrain */}
          <BaseLayer name="Terrain">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenTopoMap'
              minZoom={2}
              maxZoom={17}
            />
          </BaseLayer>

          {/* Satellite + Labels */}
          <BaseLayer name="Satellite">
            <LayerGroup>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='Tiles &copy; Esri'
                minZoom={2}
                maxZoom={19}
                maxNativeZoom={17}
              />
              <TileLayer
                url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            </LayerGroup>
          </BaseLayer>
        </LayersControl>

        <MapController
          center={userLocation}
          onPOIUpdate={handlePOIUpdate}
          onBoundsChange={onBoundsChange}
          isPickingFromMap={isPickingFromMap}
          onMapClick={handleMapClick}
          isPrecise={isPrecise}
        />
        <FlyToHandler flyTo={flyTo} />
        <LocateMeButton onLocate={(coords) => console.log('Location Found:', coords)} />

        {/* User Location — show marker whenever we have coords, circle only when GPS is precise */}
        {userLocation && (
          <>
            <Marker position={[userLocation.lat, userLocation.lon]} icon={userIcon}>
              <Popup><strong>📍 Your Location</strong></Popup>
            </Marker>
            {isPrecise && (
              <Circle
                center={[userLocation.lat, userLocation.lon]}
                radius={500}
                pathOptions={{ color: '#00c8ff', fillColor: '#00c8ff', fillOpacity: 0.08, weight: 1 }}
              />
            )}
          </>
        )}

        {/* Picked Start Point — controlled by Home via prop; clears when route panel closes */}
        {pickedStart && (
          <Marker position={[pickedStart.lat, pickedStart.lng]} icon={pickedStartIcon}>
            <Popup><strong>🟢 Start Point</strong></Popup>
          </Marker>
        )}

        {/* Route */}
        {routePolyline && (
          <>
            <Polyline positions={routePolyline} pathOptions={{ color: '#1a56db', weight: 10, opacity: 0.25 }} />
            <Polyline positions={routePolyline} pathOptions={{ color: '#3b82f6', weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />
          </>
        )}

        {/* Social Sync Peer Location */}
        {peerLocation && (
          <Marker position={[peerLocation.lat, peerLocation.lng]} icon={peerIcon}>
            <Popup><strong>🤝 Sync Partner</strong><br/>Live location</Popup>
          </Marker>
        )}

        {/* Social Sync Peer Destination */}
        {peerDestination && peerDestination.lat && peerDestination.lng && (
          <Marker position={[peerDestination.lat, peerDestination.lng]} icon={L.divIcon({
            className: '',
            html: `<div style="background:#4f46e5;width:28px;height:28px;border-radius:50% 50% 50% 0;border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;transform:rotate(-45deg);"><div style="transform:rotate(45deg);">🏁</div></div>`,
            iconSize: [28, 28], iconAnchor: [14, 28]
          })}>
            <Popup>
              <div style={{ textAlign: 'center', margin: '0' }}>
                <strong style={{ color: '#4f46e5', fontSize: '13px' }}>🚩 Partner's Destination</strong>
                {routeDestination && routeDestination.lat === peerDestination.lat && (
                  <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>(Same as yours)</div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* EV Stations — clustered */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={85}
          disableClusteringAtZoom={13}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          iconCreateFunction={(cluster) => {
            const count = cluster.getChildCount();
            const size = count > 50 ? 'lg' : count > 10 ? 'md' : 'sm';
            return L.divIcon({
              html: `<div class="ev-cluster ev-cluster-${size}"><span class="ev-cluster-bolt">⚡</span><span class="ev-cluster-count">${count}</span></div>`,
              className: '',
              iconSize: L.point(48, 48),
              iconAnchor: L.point(24, 24),
            });
          }}
        >
          {stations.map(station =>
            station.latitude && station.longitude && (
              <Marker
                key={station.id}
                position={[station.latitude, station.longitude]}
                icon={station.isAvailable
                  ? availableIcon(station.providerLogo?.charAt(0) || '⚡')
                  : unavailableIcon(station.providerLogo?.charAt(0) || '⚡')}
              >
                <Popup className="station-popup-container">
                  <div style={{
                    fontFamily: "'DM Sans', sans-serif",
                    minWidth: 260,
                    padding: 16,
                    background: '#ffffff',
                    borderRadius: 12,
                    color: '#111',
                  }}>
                    {/* Status Badge */}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      marginBottom: 10,
                      background: station.isAvailable ? '#f0fdf4' : '#fef2f2',
                      color: station.isAvailable ? '#16a34a' : '#dc2626',
                      border: `1px solid ${station.isAvailable ? '#bbf7d0' : '#fecaca'}`,
                    }}>
                      {station.isAvailable ? '✅ Available' : '❌ Unavailable'}
                    </div>

                    {/* Name */}
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4, lineHeight: 1.3 }}>
                      {station.name}
                    </div>

                    {/* Address */}
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 1.4 }}>
                      📍 {station.address}
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, background: '#f3f4f6', marginBottom: 12 }} />

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: '#f9fafb', border: '1px solid #e5e7eb',
                        borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#374151',
                      }}>
                        <span style={{ fontSize: 13 }}>🔌</span><span>{station.connectorType}</span>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: '#f9fafb', border: '1px solid #e5e7eb',
                        borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#374151',
                      }}>
                        <span style={{ fontSize: 13 }}>⚡</span><span>{station.power} kW</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => onSelectStation?.(station)}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                          background: 'green',
                          color: '#fff', fontWeight: 600, fontSize: 13,
                          cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        View Details
                      </button>
                      {onGetDirections && (
                        <button
                          onClick={() => onGetDirections(station)}
                          style={{
                            flex: 1, padding: '8px 0', borderRadius: 8,
                            border: '1.5px solid green',
                            background: '#ffffff', color: 'green',
                            fontWeight: 600, fontSize: 13, cursor: 'pointer',
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          Directions
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          )}
        </MarkerClusterGroup>

        {/* POI Pin Markers — only when zoom >= POI_MIN_ZOOM */}
        {currentZoom >= POI_MIN_ZOOM && (
          <>
            {showHospitals && <POIMarkers pois={pois.hospitals} icon={hospitalIcon} label="Hospital" badgeColor="#ef4444" />}
            {showRestaurants && <POIMarkers pois={pois.restaurants} icon={restaurantIcon} label="Restaurant" badgeColor="#f97316" />}
            {showHotels && <POIMarkers pois={pois.hotels} icon={hotelIcon} label="Hotel" badgeColor="#6366f1" />}
          </>
        )}

      </MapContainer>

      {/* Zoom-out hint
      {currentZoom < POI_MIN_ZOOM && (
        <div className="zoom-hint-overlay">
          🔍 Zoom in to level {POI_MIN_ZOOM}+ to see nearby hospitals, restaurants & hotels
        </div>
      )} */}

      {/* Legend */}
      <div className="map-legend">
        <div className="legend-item"><div className="legend-dot green"></div><span>Available</span></div>
        <div className="legend-item"><div className="legend-dot red"></div><span>Unavailable</span></div>
        <div className="legend-item"><div className="legend-dot blue"></div><span>You</span></div>
        <div className="legend-divider"></div>
        <div className="legend-item">
          <div className="legend-pin" style={{ background: '#ef4444' }}>🏥</div><span>Hospital</span>
        </div>
        <div className="legend-item">
          <div className="legend-pin" style={{ background: '#f97316' }}>🍽️</div><span>Restaurant</span>
        </div>
        <div className="legend-item">
          <div className="legend-pin" style={{ background: '#6366f1' }}>🏨</div><span>Hotel</span>
        </div>
      </div>



      <div className="map-count-badge">⚡ {stations.length} stations nearby</div>
    </div>
  );
}

export default MapView;