import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StationList from '../components/StationList/StationList';
import { useFavorites } from '../hooks/useApp';
import { authService } from '../services/auth';
import AuthModal from '../components/Auth/AuthModal';
import './Favorites.css';

function Favorites() {
  const { favorites, favoriteIds, toggleFavorite, loadFavorites, loading } = useFavorites();
  const navigate = useNavigate();
  const [user, setUser] = useState(authService.getUser());
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    return authService.onAuthChange(setUser);
  }, []);

  useEffect(() => {
    if (user) {
      loadFavorites();
    }
  }, [loadFavorites, user]);

  // Navigate to Home, fly to station on map and open its details modal
  const handleGoToStation = (station) => {
    navigate('/', { state: { flyToStation: station } });
  };

  return (
    <div className="favorites-page">
      <div className="favorites-inner">
        {/* Page Header */}
        <div className="page-header">
          <div className="page-header-left">
            <Link to="/" className="back-link">← Back to Map</Link>
            <h1 className="page-title">❤️ My Favorites</h1>
            <p className="page-subtitle">
              Your saved EV charging stations for quick access
            </p>
          </div>
          <div className="favorites-count-badge">
            {favoriteIds.length} saved
          </div>
        </div>

        {/* Not Logged In State */}
        {!user && (
          <div className="favorites-empty">
            <div className="empty-illustration">🔒</div>
            <h2>Sign in required</h2>
            <p>
              Please log in to view and manage your saved EV charging stations.
            </p>
            <button className="browse-btn" onClick={() => setShowAuthModal(true)}>
              Sign In
            </button>
          </div>
        )}

        {/* Empty State */}
        {user && !loading && favorites.length === 0 && (
          <div className="favorites-empty">
            <div className="empty-illustration">💛</div>
            <h2>No favorites yet</h2>
            <p>
              Browse charging stations and tap the heart icon
              to save your favorite spots for quick access.
            </p>
            <Link to="/" className="browse-btn">
              ⚡ Browse Stations
            </Link>
          </div>
        )}

        {/* Favorites List */}
        {user && (loading || favorites.length > 0) && (
          <StationList
            stations={favorites}
            favorites={new Set(favoriteIds)}
            onFavorite={toggleFavorite}
            onSelect={handleGoToStation}
            onNavigate={handleGoToStation}
            loading={loading}
            sectionTitle="EV Stations"
          />
        )}
      </div>

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuth={setUser}
        />
      )}
    </div>
  );
}

export default Favorites;
