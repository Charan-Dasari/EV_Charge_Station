// ============================================================
// CUSTOM HOOKS
// Reusable logic for favorites, geolocation and station filters
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { favoritesAPI } from '../services/api';


// ─── useFavorites Hook ───────────────────────────────────────
export const useFavorites = () => {
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);


  const toggleFavorite = useCallback(async (station) => {
    const isFav = favoriteIds.includes(station.id);

    try {
      if (isFav) {
        await favoritesAPI.remove(station.id);
        setFavoriteIds(prev => prev.filter(id => id !== station.id));
        setFavorites(prev => prev.filter(s => s.id !== station.id));
      } else {
        await favoritesAPI.add(station);   // pass full station object
        setFavoriteIds(prev => [...prev, station.id]);
        setFavorites(prev => [...prev, station]);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }, [favoriteIds]);

  const isFavorite = useCallback((stationId) => {
    return favoriteIds.includes(stationId);
  }, [favoriteIds]);

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const result = await favoritesAPI.getAll();
      if (result.success) {
        setFavorites(result.data);
        setFavoriteIds(result.data.map(s => s.id));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load favorites from backend on mount if logged in
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  return {
    favoriteIds,
    favorites,
    loading,
    toggleFavorite,
    isFavorite,
    loadFavorites,
    favoritesCount: favoriteIds.length
  };
};



// ─── useGeolocation Hook ─────────────────────────────────────
export const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPrecise, setIsPrecise] = useState(false);

  const getLocation = useCallback((forceRefresh = false) => {

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsPrecise(false);
      setLocation({
        lat: parseFloat(process.env.REACT_APP_DEFAULT_LAT) || 20.5937,
        lon: parseFloat(process.env.REACT_APP_DEFAULT_LON) || 78.9629
      });
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(

      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setIsPrecise(true);
        setError(null);
        setLoading(false);
      },

      () => {
        setError('Unable to get your location. Showing stations across India.');
        setIsPrecise(false);
        setLocation({
          lat: parseFloat(process.env.REACT_APP_DEFAULT_LAT) || 20.5937,
          lon: parseFloat(process.env.REACT_APP_DEFAULT_LON) || 78.9629
        });

        setLoading(false);
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: forceRefresh ? 0 : 30000   // 0 = always fresh on manual refresh
      }
    );

  }, []);

  // relocate = fresh re-fetch of user position (used by the "My Location" button)
  const relocate = useCallback(() => getLocation(true), [getLocation]);

  useEffect(() => {
    getLocation(false);
  }, [getLocation]);

  return { location, error, loading, getLocation, relocate, isPrecise };
};




// ─── useStationFilter Hook ────────────────────────────────────
export const useStationFilter = (stations = []) => {

  const [filters, setFilters] = useState({
    search: '',
    availability: null,
    power: null,
    connectorType: null,
    sortBy: 'distance'
  });

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      search: '',
      availability: null,
      power: null,
      connectorType: null,
      sortBy: 'distance'
    });
  }, []);

  // ── Apply Filters ─────────────────────────────────
  const filteredStations = useMemo(() => {

    const filtered = stations.filter(s => {

      // Text Search
      if (filters.search) {
        const q = filters.search.toLowerCase();

        const nameMatch = s.name?.toLowerCase().includes(q);
        const providerMatch = s.provider?.toLowerCase().includes(q);
        const addressMatch = s.address?.toLowerCase().includes(q);

        if (!nameMatch && !providerMatch && !addressMatch) return false;
      }

      // Availability
      if (filters.availability === 'available' && !s.isAvailable) {
        return false;
      }

      // Fast Charging (50kW+)
      if (filters.power === 'fast' && (s.power == null || Number(s.power) < 50)) {
        return false;
      }

      // Connector Type
      if (filters.connectorType) {

        const target = filters.connectorType.toLowerCase();

        const typeStr = (s.connectorType || '').toLowerCase();
        const typesArr = (s.connectors || []).map(c => c.toLowerCase());

        const match =
          typeStr.includes(target) ||
          typesArr.some(c => c.includes(target));

        if (!match) return false;
      }

      return true;

    });

    return filtered;

  }, [stations, filters]);



  // ── Sorting ─────────────────────────────────
  const sortedStations = useMemo(() => {

    return [...filteredStations].sort((a, b) => {

      switch (filters.sortBy) {

        case 'distance':
          return (a.distance || 0) - (b.distance || 0);

        case 'power':
          return (b.power || 0) - (a.power || 0);

        case 'rating':
          return (b.rating || 0) - (a.rating || 0);

        case 'price':
          return parseFloat(a.price || 0) - parseFloat(b.price || 0);

        default:
          return 0;
      }

    });

  }, [filteredStations, filters.sortBy]);


  return {
    filteredStations: sortedStations,
    filters,
    updateFilter,
    resetFilters,
    totalResults: sortedStations.length
  };

};