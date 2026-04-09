import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth';
import AuthModal from '../Auth/AuthModal';
import './Header.css';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export default function Header({ onLocationSelect, onViewChange, currentView, onSocialSync, isSynced }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const userMenuRef = useRef(null);

  // ── Sync auth state ───────────────────────────────────────────
  useEffect(() => {
    return authService.onAuthChange(setUser);
  }, []);

  // ── Close user menu on outside click ─────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Nominatim geocode search ──────────────────────────────────
  const searchLocation = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();

      setSuggestions(
        data.map(item => ({
          id: item.place_id,
          name: item.display_name,
          type: item.type || item.class || '',
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          bbox: item.boundingbox
            ? [
              parseFloat(item.boundingbox[2]), // minLon
              parseFloat(item.boundingbox[0]), // minLat
              parseFloat(item.boundingbox[3]), // maxLon
              parseFloat(item.boundingbox[1]), // maxLat
            ]
            : null,
        }))
      );
    } catch (err) {
      console.error('[Geocode] Error:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Debounced input handler ───────────────────────────────────
  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setShowDropdown(true);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchLocation(val);
    }, 300);
  };

  // ── Select a suggestion ───────────────────────────────────────
  const handleSelect = (suggestion) => {
    setQuery(suggestion.name.split(',')[0]); // Show short name
    setShowDropdown(false);
    setSuggestions([]);

    if (onLocationSelect) {
      onLocationSelect({
        lat: suggestion.lat,
        lon: suggestion.lon,
        bbox: suggestion.bbox,
      });
    }
  };

  // ── Clear search ──────────────────────────────────────────────
  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  // ── Close dropdown on outside click ───────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Cleanup debounce on unmount ───────────────────────────────
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // ── Get type icon ─────────────────────────────────────────────
  const getTypeIcon = (type) => {
    const icons = {
      city: '🏙️', town: '🏘️', village: '🏡', state: '🏛️',
      country: '🌍', suburb: '📍', county: '📍', neighbourhood: '📍',
      administrative: '🏛️', railway: '🚂', aerodrome: '✈️',
    };
    return icons[type] || '📍';
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setShowUserMenu(false);
    window.location.reload();
  };

  return (
    <header className="cs-header">

      <a className="cs-logo" href="/">
        <img src="/logo.jpg" alt="ChargeSaathi" className="cs-logo-img" style={{ height: '32px', mixBlendMode: 'multiply', marginRight: '8px' }} />
        <span className="cs-logo-text">Charge<em>Saathi</em></span>
      </a>

      <div className="cs-hero-wrap" ref={wrapperRef}>
        <div className="cs-hero-search">
          <svg className="cs-hs-icon" width="15" height="15"
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search city, state or place…"
            value={query}
            onChange={handleChange}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          />
          {query && (
            <button className="cs-hs-clear" onClick={handleClear}>✕</button>
          )}
        </div>

        {/* ── Suggestions Dropdown ── */}
        {showDropdown && (query.length >= 2) && (
          <div className="cs-suggestions">
            {loading && (
              <div className="cs-suggestion-loading">
                <span className="cs-suggestion-spinner"></span>
                Searching…
              </div>
            )}
            {!loading && suggestions.length === 0 && query.length >= 2 && (
              <div className="cs-suggestion-empty">No places found for "{query}"</div>
            )}
            {!loading && suggestions.map((s) => (
              <button
                key={s.id}
                className="cs-suggestion-item"
                onClick={() => handleSelect(s)}
              >
                <span className="cs-suggestion-icon">{getTypeIcon(s.type)}</span>
                <div className="cs-suggestion-text">
                  <span className="cs-suggestion-name">
                    {s.name.split(',')[0]}
                  </span>
                  <span className="cs-suggestion-detail">
                    {s.name.split(',').slice(1, 3).join(',')}
                  </span>
                </div>
                <span className="cs-suggestion-type">{s.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="cs-header-right">
        <div className="cs-view-seg">
          {[
            { v: 'map',  abbr: 'M' },
            { v: 'both', abbr: 'B' },
            { v: 'list', abbr: 'L' },
          ].map(({ v, abbr }) => (
            <button
              key={v}
              data-abbr={abbr}
              className={`cs-view-btn${currentView === v ? ' active' : ''}`}
              onClick={() => onViewChange?.(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <Link to="/about" className="cs-hdr-action" title="About" style={{ fontStyle: 'italic', fontWeight: 700, fontSize: '15px', fontFamily: 'Georgia, serif', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid currentColor', lineHeight: 1 }}>
          i
        </Link>

        <Link to="/favorites" className="cs-hdr-action" title="Favourites">
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </Link>

        {/* ── Social Sync Button (auth-gated) ── */}
        {user && (
          <button
            className="cs-hdr-action"
            title="Social Sync"
            onClick={() => onSocialSync?.()}
            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', position: 'relative' }}
          >
            <img
              src="/sync-nobg.png"
              alt="Social Sync"
              style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
            />
            {isSynced && (
              <span style={{
                position: 'absolute', bottom: 5, right: 5, width: 14, height: 14,
                background: '#22c55e', borderRadius: '50%', border: '2px solid white',
                boxShadow: '0 0 8px #22c55e', animation: 'ss-pulse-anim 1.5s ease-in-out infinite'
              }}></span>
            )}
          </button>
        )}

        {/* ── Auth Button / User Menu ── */}
        {user ? (
          <div className="cs-user-menu-wrap" ref={userMenuRef}>
            <button
              className="cs-user-avatar"
              onClick={() => setShowUserMenu(!showUserMenu)}
              title={user.name}
            >
              {user.name && user.name.length > 0 ? user.name.charAt(0).toUpperCase() : '?'}
            </button>
            {showUserMenu && (
              <div className="cs-user-dropdown">
                <div className="cs-user-info">
                  <div className="cs-user-name">{user.name}</div>
                  <div className="cs-user-email">{user.email}</div>
                </div>
                <hr className="cs-user-divider" />
                <button className="cs-user-logout" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="cs-hdr-login"
            onClick={() => setShowAuthModal(true)}
            title="Sign In"
          >
            Sign In
          </button>
        )}
      </div>

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuth={setUser}
        />
      )}

    </header>
  );
}