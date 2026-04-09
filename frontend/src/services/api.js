// ============================================================
// API SERVICE LAYER
// All methods return { success, data, error } — never throw.
// A single backend 500 will NOT crash the UI anymore.
// ============================================================

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5150';

// ── Shared safe fetch ─────────────────────────────────────────────────────────
// Never throws. Returns { ok, status, data, error } always.
async function safeFetch(url, options = {}) {
  try {
    const token = localStorage.getItem('ev_auth_token');
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const finalOptions = { ...options, headers };

    const res = await fetch(url, finalOptions);
    const ct = res.headers.get('content-type') || '';
    let body = null;

    if (ct.includes('application/json')) {
      try { body = await res.json(); } catch { body = null; }
    } else {
      body = await res.text().catch(() => null);
    }

    return {
      ok: res.ok,
      status: res.status,
      data: body,
      error: res.ok ? null : (body?.error || `HTTP ${res.status}`),
    };
  } catch (networkErr) {
    console.error('[API] Network error:', url, networkErr.message);
    return { ok: false, status: 0, data: null, error: networkErr.message };
  }
}

// ─── STATIONS API ─────────────────────────────────────────────────────────────

export const stationAPI = {

  getAll: async (south = -90, west = -180, north = 90, east = 180) => {
    const { ok, data, error } = await safeFetch(
      `${API_BASE_URL}/api/ev/stations?south=${south}&west=${west}&north=${north}&east=${east}`
    );

    if (!ok || !Array.isArray(data)) {
      console.warn('[stationAPI.getAll] Failed:', error);
      return { success: false, data: [], error };
    }

    return {
      success: true,
      data: data.map(s => ({
        id: s.ID,
        name: s.AddressInfo?.Title || 'EV Charging Station',
        latitude: s.AddressInfo?.Latitude,
        longitude: s.AddressInfo?.Longitude,
        address: s.AddressInfo?.AddressLine1 || '',
        connectorType: s.Connections?.[0]?.ConnectionType?.Title || 'Type 2',
        connectors: s.Connections?.map(c => c.ConnectionType?.Title).filter(Boolean) || ['Type 2'],
        power: s.Connections?.[0]?.PowerKW || 50,
        price: s.UsageCost || '₹15/kWh',
        isAvailable: s.StatusType?.IsOperational ?? true,
        availablePlugs: s.NumberOfPoints || 0,
        totalPlugs: s.NumberOfPoints || 0,
        operatingHours: '24/7',
        provider: s.OperatorInfo?.Title || 'Generic',
        providerLogo: s.OperatorInfo?.Title?.charAt(0) || '⚡',
        rating: s.Rating || 4.0,
        totalReviews: s.TotalReviews || 0,
        distance: s.Distance || 0,
        waitTime: s.WaitTime || 'No wait',
        lastUpdated: s.DateLastStatusUpdate || 'Recently',
        amenities: s.Amenities || [],
      }))
    };
  },

  getByBounds: async (south, west, north, east) => {
    const { ok, data, error } = await safeFetch(
      `${API_BASE_URL}/api/ev/stations?south=${south}&west=${west}&north=${north}&east=${east}`
    );

    if (!ok || !Array.isArray(data)) {
      console.warn('[stationAPI.getByBounds] Failed:', error);
      return { success: false, data: [], error };
    }

    return {
      success: true,
      data: data.map(s => ({
        id: s.ID,
        name: s.AddressInfo?.Title || 'EV Charging Station',
        latitude: s.AddressInfo?.Latitude,
        longitude: s.AddressInfo?.Longitude,
        address: s.AddressInfo?.AddressLine1 || '',
        town: s.AddressInfo?.Town || '',
      }))
    };
  },

  reportAvailability: async (stationId, isAvailable) => {
    // Deprecated for the unified Report endpoint, but keeping the signature alive for StationDetails 
    const { ok, data, error } = await safeFetch(
      `${API_BASE_URL}/api/interaction/reports`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          stationId: String(stationId), 
          status: isAvailable ? "Available" : "Not Available",
          rating: 0,
          reviewText: ""
        }),
      }
    );
    return ok ? { success: true, data } : { success: false, error };
  },
};

// ─── POI API ──────────────────────────────────────────────────────────────────

export const poiAPI = {

  _fetch: async (type, bounds) => {
    const { south, west, north, east } = bounds;
    const { ok, data, error, status } = await safeFetch(
      `${API_BASE_URL}/api/poi/${type}?south=${south}&west=${west}&north=${north}&east=${east}`
    );

    if (!ok) {
      console.warn(`[poiAPI] ${type} → HTTP ${status}:`, error);
      return [];
    }

    return (data?.elements || [])
      .filter(el => el.lat && el.lon)
      .map(el => ({
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        name: el.tags?.name || (type.charAt(0).toUpperCase() + type.slice(1)),
        address: [el.tags?.['addr:street'], el.tags?.['addr:housenumber']]
          .filter(Boolean).join(' ') || '',
      }));
  },

  getHospitals: (bounds) => poiAPI._fetch('hospital', bounds),
  getRestaurants: (bounds) => poiAPI._fetch('restaurant', bounds),
  getHotels: (bounds) => poiAPI._fetch('hotel', bounds),
};

// ─── ROUTING API ──────────────────────────────────────────────────────────────

export const routingAPI = {

  getRoute: async (fromLat, fromLng, toLat, toLng) => {
    const { ok, data, error } = await safeFetch(
      `${API_BASE_URL}/api/route?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`
    );

    if (!ok) {
      console.warn('[routingAPI.getRoute] Failed:', error);
      return { success: false, error };
    }

    return {
      success: true,
      data: {
        distance: data.distanceKm,
        duration: data.durationMinutes,
        geometry: data.geometry,
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${toLat},${toLng}`,
      }
    };
  },
};

// ─── FAVORITES API ────────────────────────────────────────────────────────────
export const favoritesAPI = {
  getAll: async () => {
    const { ok, data, error } = await safeFetch(`${API_BASE_URL}/api/interaction/favorites`);
    if (!ok) return { success: false, data: [], error };
    // Map backend Favorite models (stationJson) back to JSON objects
    const parsed = (data.data || []).map(f => {
      try { return JSON.parse(f.stationJson); } catch { return null; }
    }).filter(Boolean);
    return { success: true, data: parsed };
  },

  add: async (station) => {
    const { ok, error } = await safeFetch(`${API_BASE_URL}/api/interaction/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stationId: String(station.id), stationJson: JSON.stringify(station) })
    });
    return { success: ok, error };
  },

  remove: async (stationId) => {
    const { ok, error } = await safeFetch(`${API_BASE_URL}/api/interaction/favorites/${String(stationId)}`, { method: 'DELETE' });
    return { success: ok, error };
  },
};

// ─── UNIFIED REPORTS API ──────────────────────────────────────────────────────
export const reportsAPI = {
  getStationReports: async (stationId) => {
    const sid = String(stationId);
    console.log('[reportsAPI] Fetching reports for stationId:', sid);
    const { ok, data, error } = await safeFetch(`${API_BASE_URL}/api/interaction/reports/${sid}`);
    console.log('[reportsAPI] Response:', { ok, data, error });
    return ok ? { success: true, data: data.data || [] } : { success: false, data: [], error };
  },
  
  submitReport: async ({ stationId, status, rating, reviewText }) => {
    const { ok, data, error } = await safeFetch(`${API_BASE_URL}/api/interaction/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stationId: String(stationId), status: status || "Unknown", rating: rating || 0, reviewText: reviewText || "" })
    });
    return ok ? { success: true, data: data.data } : { success: false, error };
  },

  vote: async (reportId, isUpvote) => {
    const { ok, error } = await safeFetch(`${API_BASE_URL}/api/interaction/reports/${reportId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isUpvote })
    });
    return { success: ok, error };
  }
};

// Ensure backward compatibility with existing front-end calls if needed
export const reviewsAPI = {
  add: async (stationId, review) => {
    return await reportsAPI.submitReport({
      stationId,
      status: "Unknown",
      rating: review.rating,
      reviewText: review.text
    });
  }
};