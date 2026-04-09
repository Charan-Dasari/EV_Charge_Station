import React, { useState, useEffect } from 'react';
import { routingAPI } from '../../services/api';
import './RoutePanel.css';

function RoutePanel({
  destination,
  userLocation,
  onRouteCalculated,
  onStartNavigation,
  onClearRoute,
  isNavigating,
  onPickFromMap,
  isPickingFromMap,
  pickedStart,
  onClearPickedStart,
}) {
  const [start, setStart] = useState(null);
  const [summary, setSummary] = useState(null);
  const [routeReady, setRouteReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('idle'); // idle | calculating | ready | navigating

  // Auto-fill start from user location
  useEffect(() => {
    if (userLocation && !start) {
      setStart({ lat: userLocation.lat, lng: userLocation.lon ?? userLocation.lng, label: 'My Location' });
    }
  }, [userLocation, start]);

  // When user picks a point on the map — ALWAYS override start
  useEffect(() => {
    if (pickedStart) {
      setStart({ lat: pickedStart.lat, lng: pickedStart.lng, label: 'Picked from Map' });
      setSummary(null);
      setRouteReady(false);
      setStep('idle');
      setError(null);
    }
  }, [pickedStart]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported.'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'My Location' });
      setSummary(null);
      setRouteReady(false);
      setStep('idle');
      setError(null);
      // Clear the blue route polyline from the map
      onRouteCalculated(null);
      // Clear the green "picked from map" marker on the map
      onClearPickedStart?.();
    }, () => alert('Could not get location.'));
  };

  const handleCalculate = async () => {
    if (!start || !destination) { setError('Select both start and destination.'); return; }
    setLoading(true);
    setError(null);
    setStep('calculating');
    try {
      const result = await routingAPI.getRoute(start.lat, start.lng, destination.lat, destination.lng);
      if (result.success) {
        onRouteCalculated(result.data.geometry);
        setSummary({ distance: result.data.distance, duration: result.data.duration });
        setRouteReady(true);
        setStep('ready');
      } else {
        throw new Error('Route not found');
      }
    } catch (err) {
      setError('Could not calculate route. Try again.');
      setStep('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleStartNav = () => {
    setStep('navigating');
    onStartNavigation();
  };

  const handleClear = () => {
    setSummary(null);
    setRouteReady(false);
    setStep('idle');
    setError(null);
    onClearRoute();
  };

  // Roll back to idle so the user can change their start point, then recalculate
  const handleRecalculate = () => {
    setSummary(null);
    setRouteReady(false);
    setStep('idle');
    setError(null);
    onRouteCalculated(null);
  };

  const formatDuration = (minutes) => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins} min`;
  };

  const formatDistance = (km) => {
    return km >= 1 ? `${km.toFixed(1)} km` : `${(km * 1000).toFixed(0)} m`;
  };

  return (
    <div className="rp-panel">

      {/* Header */}
      <div className="rp-header">
        <div className="rp-header-left">
          <div className="rp-header-icon">⚡</div>
          <div>
            <div className="rp-title">Route Planner</div>
            <div className="rp-subtitle">
              {step === 'idle' && 'Set your start point'}
              {step === 'calculating' && 'Finding best route...'}
              {step === 'ready' && 'Route ready!'}
              {step === 'navigating' && 'Navigation active'}
            </div>
          </div>
        </div>
        <button className="rp-close" onClick={handleClear} title="Close">✕</button>
      </div>

      {/* Progress Bar */}
      <div className="rp-progress">
        <div className={`rp-progress-step ${start ? 'done' : 'active'}`}>
          <div className="rp-step-dot">{start ? '✓' : '1'}</div>
          <span>Start</span>
        </div>
        <div className={`rp-progress-line ${start ? 'done' : ''}`}></div>
        <div className={`rp-progress-step ${destination ? 'done' : start ? 'active' : ''}`}>
          <div className="rp-step-dot">{destination ? '✓' : '2'}</div>
          <span>Destination</span>
        </div>
        <div className={`rp-progress-line ${routeReady ? 'done' : ''}`}></div>
        <div className={`rp-progress-step ${routeReady ? 'done' : ''}`}>
          <div className="rp-step-dot">{routeReady ? '✓' : '3'}</div>
          <span>Route</span>
        </div>
      </div>

      {/* Start Location */}
      <div className="rp-section">
        <div className="rp-section-label">
          <div className="rp-dot rp-dot-green"></div>
          Start Point
        </div>
        <div className="rp-location-box">
          <span className="rp-location-text">
            {start ? start.label : 'Not selected'}
          </span>
          {start && start.label !== 'My Location' && (
            <span className="rp-location-coords">
              {start.lat.toFixed(4)}, {start.lng.toFixed(4)}
            </span>
          )}
        </div>
        {!routeReady && (
          <div className="rp-btn-row">
            <button className="rp-btn-sec" onClick={handleUseMyLocation}>
              <span>📍</span> My Location
            </button>
            <button
              className={`rp-btn-sec ${isPickingFromMap ? 'rp-btn-picking' : ''}`}
              onClick={onPickFromMap}
            >
              <span>{isPickingFromMap ? '🖱️' : '🗺️'}</span>
              {isPickingFromMap ? 'Click map...' : 'Pick on Map'}
            </button>
          </div>
        )}
      </div>

      {/* Destination */}
      <div className="rp-section">
        <div className="rp-section-label">
          <div className="rp-dot rp-dot-red"></div>
          Destination
        </div>
        <div className="rp-location-box">
          <span className="rp-location-text">
            {destination?.label || 'Not set'}
          </span>
          {destination && (
            <span className="rp-location-coords">
              {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}
            </span>
          )}
        </div>
      </div>

      {/* Route Summary */}
      {summary && (
        <div className="rp-summary">
          <div className="rp-summary-card">
            <div className="rp-summary-icon">🚗</div>
            <div className="rp-summary-value">{formatDistance(summary.distance)}</div>
            <div className="rp-summary-label">Distance</div>
          </div>
          <div className="rp-summary-divider"></div>
          <div className="rp-summary-card">
            <div className="rp-summary-icon">⏱</div>
            <div className="rp-summary-value">{formatDuration(summary.duration)}</div>
            <div className="rp-summary-label">Duration</div>
          </div>
          <div className="rp-summary-divider"></div>
          <div className="rp-summary-card">
            <div className="rp-summary-icon">⚡</div>
            <div className="rp-summary-value">EV</div>
            <div className="rp-summary-label">Route</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rp-error">
          ⚠️ {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="rp-actions">
        {!routeReady ? (
          <button
            className="rp-btn-primary"
            onClick={handleCalculate}
            disabled={loading || !start || !destination}
          >
            {loading ? (
              <><span className="rp-spinner"></span> Calculating...</>
            ) : (
              <><span>🔍</span> Calculate Route</>
            )}
          </button>
        ) : step !== 'navigating' ? (
          <button
            className="rp-btn-primary rp-btn-nav"
            onClick={handleStartNav}
            disabled={loading}
            style={loading ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            {loading
              ? <><span className="rp-spinner"></span> Recalculating...</>
              : <><span>▶️</span> Start Navigation</>}
          </button>
        ) : (
          <button className="rp-btn-primary rp-btn-navigating" disabled>
            <span className="rp-nav-pulse"></span> Navigating...
          </button>
        )}

        {routeReady && step !== 'navigating' && (
          <button className="rp-btn-sec" onClick={handleRecalculate}>
            🔄 Recalculate
          </button>
        )}
      </div>

      {/* Navigation tip */}
      {step === 'navigating' && (
        <div className="rp-nav-tip">
          🧭 Live tracking active — your position is being followed on the map.
          <button className="rp-stop-nav" onClick={handleClear}>Stop Navigation</button>
        </div>
      )}
    </div>
  );
}

export default RoutePanel;