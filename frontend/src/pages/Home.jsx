import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import StationList from '../components/StationList/StationList';
import SearchFilter from '../components/SearchFilter/SearchFilter';
import StationDetails from '../components/StationDetails/StationDetails';
import RoutePanel from '../components/RoutePanel/RoutePanel';
import Header from '../components/Header/Header';
import AuthModal from '../components/Auth/AuthModal';
import SocialSyncPanel from '../components/SocialSync/SocialSyncPanel';
import { stationAPI } from '../services/api';
import { authService } from '../services/auth';
import { useGeolocation, useFavorites, useStationFilter } from '../hooks/useApp';
import './Home.css';

// Lazy-load MapView so Leaflet's heavy bundle is code-split from the main chunk
const MapView = lazy(() => import('../components/Map/MapView'));

function Home() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState(null);
  const [view, setView] = useState('both');

  const [routeDestination, setRouteDestination] = useState(null);
  const [routePanelOpen, setRoutePanelOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [liveLocation, setLiveLocation] = useState(null);
  const [isPickingFromMap, setIsPickingFromMap] = useState(false);
  const [routePanelPickedStart, setRoutePanelPickedStart] = useState(null);
  const [mapFlyTo, setMapFlyTo] = useState(null);

  // Social Sync state
  const [showSocialSync, setShowSocialSync] = useState(false);
  const [peerLocation, setPeerLocation] = useState(null);
  const [peerDestination, setPeerDestination] = useState(null);


  const watchIdRef = useRef(null);

  const location = useLocation();
  const { location: userLocation, error: locationError, isPrecise, relocate } = useGeolocation();
  const { favoriteIds, toggleFavorite, isFavorite } = useFavorites();
  const { filteredStations, filters, updateFilter, resetFilters } = useStationFilter(stations);

  // ── Auth-gated favorites ───────────────────────────────────────
  const [user, setUser] = useState(() => authService.getUser());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const pendingFavStation = useRef(null);   // station waiting to be favourited after login

  // Keep user state in sync when auth changes (e.g., logout from Header)
  useEffect(() => authService.onAuthChange(setUser), []);

  // Auth-gated toggle: if not logged in → open modal, queue station
  const handleToggleFavorite = useCallback((station) => {
    if (!authService.getUser()) {
      pendingFavStation.current = station;
      setShowAuthModal(true);
      return;
    }
    toggleFavorite(station);
  }, [toggleFavorite]);

  // Called when AuthModal succeeds — user just signed in
  const handleAuthSuccess = useCallback((loggedInUser) => {
    setUser(loggedInUser);
    setShowAuthModal(false);
    // Execute the queued favourite action
    if (pendingFavStation.current) {
      toggleFavorite(pendingFavStation.current);
      pendingFavStation.current = null;
    }
  }, [toggleFavorite]);

  // When navigating back from Favorites with a station, fly to it and open details
  useEffect(() => {
    const station = location.state?.flyToStation;
    if (!station) return;
    if (station.latitude && station.longitude) {
      setMapFlyTo({ lat: station.latitude, lon: station.longitude });
      setSelectedStation(station);
    }
    // Clear state so re-renders / back navigation don't re-trigger
    window.history.replaceState({}, '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadStations = async () => {
      setLoading(true);
      try {
        const delta = userLocation ? 1.0 : 8.0;
        const lat = userLocation?.lat || 20.5937;
        const lon = userLocation?.lon || 78.9629;
        const result = await stationAPI.getAll(
          lat - delta, lon - delta,
          lat + delta, lon + delta
        );
        if (result.success) setStations(result.data);
      } catch (err) {
        console.error('Error loading stations:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStations();
  }, [userLocation]);

  const handleBoundsChange = useCallback(async (bounds) => {
    try {
      const result = await stationAPI.getAll(bounds.south, bounds.west, bounds.north, bounds.east);
      if (result.success) setStations(result.data);
    } catch (err) {
      console.error('Error loading stations for bounds:', err);
    }
  }, []);

  const effectiveUserLocation = liveLocation || userLocation;

  const nearbyCount = effectiveUserLocation
    ? stations.filter(s => {
      if (!s.latitude || !s.longitude) return false;
      const d = Math.sqrt(
        Math.pow((s.latitude - effectiveUserLocation.lat) * 111, 2) +
        Math.pow((s.longitude - effectiveUserLocation.lon) * 111, 2)
      );
      return d <= 10;
    }).length
    : 0;

  const handleGetDirections = useCallback((station) => {
    setRouteDestination({ lat: station.latitude, lng: station.longitude, label: station.name });
    setRoutePanelOpen(true);
    setActiveRoute(null);
  }, []);

  const handlePickFromMap = useCallback(() => {
    setIsPickingFromMap(prev => !prev);
  }, []);

  const handleMapPickedStart = useCallback((coords) => {
    setIsPickingFromMap(false);
    setRoutePanelPickedStart(coords);
  }, []);

  const handleStartNavigation = useCallback(() => {
    if (!navigator.geolocation) { alert('Geolocation not supported.'); return; }
    if (watchIdRef.current) return;
    setIsNavigating(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => setLiveLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => console.warn('Tracking error:', err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }, []);

  const handleStopNavigation = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsNavigating(false);
    setLiveLocation(null);
  }, []);

  const handleClearRoute = useCallback(() => {
    handleStopNavigation();
    setRouteDestination(null);
    setActiveRoute(null);
    setRoutePanelOpen(false);
    setIsPickingFromMap(false);
    setRoutePanelPickedStart(null);
  }, [handleStopNavigation]);

  useEffect(() => () => handleStopNavigation(), [handleStopNavigation]);

  return (
    <div className="home-page">

      <Header
        onLocationSelect={(loc) => setMapFlyTo(loc)}
        onViewChange={setView}
        currentView={view}
        onSocialSync={() => setShowSocialSync(true)}
        isSynced={peerLocation !== null}
      />

      {(locationError || isNavigating || isPickingFromMap || nearbyCount > 0) && (
        <div className="cs-status-bar">
          {locationError && (
            <div className="cs-status-pill warning">
              📍 Showing stations across India
              <button className="cs-stop-nav" onClick={relocate} style={{ marginLeft: 8 }}>
                🎯 Re-locate
              </button>
            </div>
          )}
          {isNavigating && (
            <div className="cs-status-pill nav">
              🧭 Navigation Active
              <button className="cs-stop-nav" onClick={handleStopNavigation}>Stop</button>
            </div>
          )}
          {isPickingFromMap && (
            <div className="cs-status-pill picking">🖱️ Click on the map to pick start point</div>
          )}
          {nearbyCount > 0 && (
            <div className="cs-status-pill nearby">⚡ {nearbyCount} station{nearbyCount !== 1 ? 's' : ''} nearby</div>
          )}
        </div>
      )}

      <div className="home-body">

        {/* MAP */}
        <div className={`home-map ${view === 'list' ? 'hidden' : ''} ${view === 'map' ? 'full-map' : ''}`}>
          <Suspense fallback={
            <div style={{
              width: '100%', height: '100%',
              background: '#e8e3d8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12, color: '#9a9186',
              fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14,
            }}>
              <div style={{
                width: 40, height: 40, border: '3px solid #c8652a',
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Loading map…
            </div>
          }>
            <MapView
              stations={filteredStations}
              userLocation={effectiveUserLocation}
              selectedStation={selectedStation}
              onSelectStation={setSelectedStation}
              onGetDirections={handleGetDirections}
              activeRoute={activeRoute}
              onBoundsChange={handleBoundsChange}
              isPickingFromMap={isPickingFromMap}
              onMapPickedStart={handleMapPickedStart}
              pickedStart={routePanelPickedStart}
              flyTo={mapFlyTo}
              layoutMode={view}
              isPrecise={isPrecise}
              peerLocation={peerLocation}
              peerDestination={peerDestination}
              routeDestination={routeDestination}
            />
          </Suspense>
        </div>

        {/* SIDEBAR */}
        <div className={`home-sidebar ${view === 'map' ? 'hidden' : ''} ${view === 'list' ? 'full' : ''}`}>
          <SearchFilter
            filters={filters}
            onFilterChange={updateFilter}
            onReset={resetFilters}
            totalResults={filteredStations.length}
            onLocationSelect={(loc) => setMapFlyTo(loc)}
            stations={stations}
            onStationSearch={(q) => updateFilter('search', q)}
          />
          <StationList
            stations={filteredStations}
            activeStation={selectedStation}
            favorites={new Set(favoriteIds)}
            onSelect={setSelectedStation}
            onFavorite={handleToggleFavorite}
            onNavigate={handleGetDirections}
            loading={loading}
          />
        </div>

      </div>

      {selectedStation && (
        <StationDetails
          station={selectedStation}
          onClose={() => setSelectedStation(null)}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={isFavorite(selectedStation.id)}
          userLocation={effectiveUserLocation}
          onGetDirections={handleGetDirections}
          user={user}
          onRequestAuth={() => setShowAuthModal(true)}
        />
      )}

      {/* Auth modal triggered by unauthenticated favourite attempt */}
      {showAuthModal && (
        <AuthModal
          onClose={() => { setShowAuthModal(false); pendingFavStation.current = null; }}
          onAuth={handleAuthSuccess}
          subtitle="❤️ Sign in to save your favourite charging stations"
        />
      )}

      {routePanelOpen && routeDestination && (
        <RoutePanel
          destination={routeDestination}
          userLocation={effectiveUserLocation}
          onRouteCalculated={setActiveRoute}
          onStartNavigation={handleStartNavigation}
          onClearRoute={handleClearRoute}
          isNavigating={isNavigating}
          onPickFromMap={handlePickFromMap}
          isPickingFromMap={isPickingFromMap}
          pickedStart={routePanelPickedStart}
          onClearPickedStart={() => setRoutePanelPickedStart(null)}
        />
      )}

      {/* Social Sync Panel */}
      {user && (
        <SocialSyncPanel
          user={user}
          isVisible={showSocialSync}
          onPeerLocation={setPeerLocation}
          onPeerDestination={setPeerDestination}
          userLocation={effectiveUserLocation}
          activeDestination={routeDestination}
          onFocusLocation={(coords) => setMapFlyTo({ ...coords, _ts: Date.now() })}
          onClose={() => setShowSocialSync(false)}
        />
      )}

    </div>
  );
}

export default Home;