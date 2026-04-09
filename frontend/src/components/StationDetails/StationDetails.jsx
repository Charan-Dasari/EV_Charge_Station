import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../../services/api';
import ReviewModal from './ReviewModal';
import ReportModal from './ReportModal';
import './StationDetails.css';

function StationDetails({ station, onClose, onToggleFavorite, isFavorite, userLocation, onGetDirections, user, onRequestAuth }) {
  const [reportStatus, setReportStatus] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [votedReports, setVotedReports] = useState(new Set());

  // Load backend live reports for this station
  useEffect(() => {
    if (!station) return;
    const fetchReports = async () => {
      const r = await reportsAPI.getStationReports(station.id);
      if (r.success) setReviews(r.data);
    };
    fetchReports();
  }, [station]);

  if (!station) return null;

  const plugPct = Math.round((station.availablePlugs / station.totalPlugs) * 100) || 0;

  // Format ISO timestamp
  const formatDate = (raw) => {
    if (!raw || raw === 'Recently') return 'Recently';
    try {
      return new Date(raw).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
    } catch {
      return raw;
    }
  };

  // ── Determine live status override ────────────────────────────────
  const latestStatusReport = reviews.find(r => r.status === "Available" || r.status === "Not Available");
  const isCurrentlyAvailable = latestStatusReport ? (latestStatusReport.status === "Available") : station.isAvailable;

  // ── Report availability ──────────────────────────────────────────
  const handleReport = async (isAvailable) => {
    if (!user) {
      onRequestAuth();
      return;
    }
    setReporting(true);
    try {
      const result = await reportsAPI.submitReport({
        stationId: station.id,
        status: isAvailable ? "Available" : "Not Available",
        rating: 0,
        reviewText: ""
      });
      if (result.success) {
        setReportStatus(isAvailable ? 'Available' : 'Not Available');
        setReviews(prev => [result.data, ...prev]);
        setTimeout(() => setReportStatus(null), 3000);
      }
    } catch (error) {
      console.error('Error reporting:', error);
    } finally {
      setReporting(false);
    }
  };

  // ── Vote Review ──────────────────────────────────────────────────
  const handleVote = async (reportId, isUpvote) => {
    if (!user) {
      onRequestAuth();
      return;
    }
    if (votedReports.has(reportId)) return;
    const result = await reportsAPI.vote(reportId, isUpvote);
    if (result.success) {
      setVotedReports(prev => new Set([...prev, reportId]));
      setReviews(prev => prev.map(r => {
        if (r.id === reportId) {
          return {
            ...r,
            thumbsUp: isUpvote ? r.thumbsUp + 1 : r.thumbsUp,
            thumbsDown: !isUpvote ? r.thumbsDown + 1 : r.thumbsDown
          };
        }
        return r;
      }));
    }
  };

  // ── Get directions ───────────────────────────────────────────────
  const handleGetDirections = () => {
    if (onGetDirections) {
      onGetDirections(station);
      onClose();
    }
  };

  // ── Review added callback ────────────────────────────────────────
  const handleReviewAdded = (newReview) => {
    setReviews(prev => [newReview, ...prev]);
  };

  // ── Avg rating from live reviews ────────────────────────────────
  const reviewItems = reviews.filter(r => r.rating > 0 || r.reviewText);
  const localAvgRating = reviewItems.length > 0
    ? (reviewItems.reduce((sum, r) => sum + r.rating, 0) / reviewItems.length).toFixed(1)
    : null;
  const displayRating = localAvgRating || (station.totalReviews > 0 ? station.rating : null);
  const displayReviewCount = reviewItems.length || station.totalReviews || 0;

  return (
    <div className="details-overlay" onClick={onClose}>
      <div className="details-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Close ── */}
        <button className="details-close" onClick={onClose}>✕</button>

        {/* ── Header ── */}
        <div className="details-header">
          <div className="details-provider-badge">{station.providerLogo}</div>
          <div className="details-header-info">
            <span className="details-provider-name">{station.provider}</span>
            <h2 className="details-name">{station.name}</h2>
            <p className="details-address">📍 {station.address}</p>
          </div>
          <button
            className={`details-fav-btn ${isFavorite ? 'active' : ''}`}
            onClick={() => onToggleFavorite?.(station)}
            title={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          >
            {isFavorite ? '❤️' : '🤍'}
          </button>
        </div>

        {/* ── Status Banner ── */}
        <div className={`details-status ${isCurrentlyAvailable ? 'available' : 'unavailable'}`}>
          <div className="status-left">
            <span className="status-dot" />
            <span className="status-text">
              {isCurrentlyAvailable ? 'Currently Available' : 'Currently Unavailable'}
            </span>
            <span className="status-plugs">
              {station.availablePlugs}/{station.totalPlugs} plugs free
            </span>
          </div>
          <span className="status-updated">Updated: {formatDate(station.lastUpdated)} (ID: {station.id})</span>
        </div>

        {/* ── Plug Progress ── */}
        <div className="details-plug-progress">
          <div className="details-plug-info">
            <span>Plug availability</span>
            <span className={plugPct > 50 ? 'green' : plugPct > 0 ? 'orange' : 'red'}>
              {station.availablePlugs}/{station.totalPlugs}
            </span>
          </div>
          <div className="details-plug-track">
            <div
              className={`details-plug-fill ${plugPct > 50 ? 'green' : plugPct > 0 ? 'orange' : 'red'}`}
              style={{ width: `${plugPct}%` }}
            />
          </div>
        </div>

        {/* ── Details Grid ── */}
        <div className="details-grid">
          <div className="detail-item">
            <span className="detail-icon">🔌</span>
            <div>
              <span className="detail-label">Connector Types</span>
              <div className="detail-connectors">
                {(station.connectors?.length
                  ? station.connectors
                  : station.connectorType
                    ? [station.connectorType]
                    : ['N/A']
                ).map((c, i) => (
                  <span key={i} className="connector-tag">{c}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="detail-item">
            <span className="detail-icon">⚡</span>
            <div>
              <span className="detail-label">Power Output</span>
              <span className="detail-value highlight">{station.power} kW</span>
            </div>
          </div>

          <div className="detail-item">
            <span className="detail-icon">💰</span>
            <div>
              <span className="detail-label">Charging Price</span>
              <span className="detail-value">{station.price}</span>
            </div>
          </div>

          <div className="detail-item">
            <span className="detail-icon">🕐</span>
            <div>
              <span className="detail-label">Operating Hours</span>
              <span className="detail-value">{station.operatingHours}</span>
            </div>
          </div>
        </div>

        {/* ── Rating Summary ── */}
        {displayRating && (
          <div className="details-rating">
            <div className="rating-stars">
              {'⭐'.repeat(Math.floor(Number(displayRating)))}
              <span className="rating-number">{displayRating}</span>
            </div>
            <span className="rating-reviews">{displayReviewCount} review{displayReviewCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* ── Amenities ── */}
        {station.amenities?.length > 0 && (
          <div className="details-section">
            <h4 className="section-title">Amenities</h4>
            <div className="amenities-grid">
              {station.amenities.map((a, i) => (
                <div key={i} className="amenity-item">
                  <span>{getAmenityIcon(a)}</span>
                  <span>{a}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Reviews section ── */}
        <div className="details-section">
          <div className="details-section-head">
            <h4 className="section-title">Reviews</h4>
            <button
              className="details-write-review-btn"
              onClick={() => user ? setShowReviewModal(true) : onRequestAuth()}
            >
              ✏️ Write a Review
            </button>
          </div>
          {reviewItems.length === 0 ? (
            <p className="details-no-reviews">No reviews yet. Be the first to share your experience!</p>
          ) : (
            <div className="details-reviews-list">
              {reviewItems.slice(0, 5).map((review) => (
                <div key={review.id} className="details-review-item">
                  <div className="review-head">
                    <div className="review-avatar">{review.userName?.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="review-name">{review.userName}</div>
                      <div className="review-date">{formatDate(review.createdAt)}</div>
                    </div>
                    <div className="review-stars">
                      {'★'.repeat(review.rating)}<span className="review-stars-empty">{'★'.repeat(Math.max(0, 5 - review.rating))}</span>
                    </div>
                  </div>
                  {review.reviewText && <p className="review-text">{formatReviewText(review.reviewText)}</p>}
                  <div className="review-actions" style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button 
                      onClick={() => handleVote(review.id, true)} 
                      disabled={votedReports.has(review.id)}
                      style={{ background: 'none', border: '1px solid #ddd', padding: '4px 10px', borderRadius: '4px', cursor: votedReports.has(review.id) ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
                    >
                      👍 {review.thumbsUp}
                    </button>
                    <button 
                      onClick={() => handleVote(review.id, false)} 
                      disabled={votedReports.has(review.id)}
                      style={{ background: 'none', border: '1px solid #ddd', padding: '4px 10px', borderRadius: '4px', cursor: votedReports.has(review.id) ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
                    >
                      👎 {review.thumbsDown}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Report Availability ── */}
        <div className="details-section">
          <h4 className="section-title">Report Availability</h4>
          <p className="report-desc">
            Help other EV drivers by updating this station's current status
          </p>

          {reportStatus && (
            <div className={`report-success ${reportStatus}`}>
              ✅ Thank you! Reported as {reportStatus}
            </div>
          )}

          <div className="report-buttons">
            <button
              className="report-btn available"
              onClick={() => handleReport(true)}
              disabled={reporting}
            >
              ✅ Available Now
            </button>
            <button
              className="report-btn unavailable"
              onClick={() => handleReport(false)}
              disabled={reporting}
            >
              ❌ Not Available
            </button>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="details-actions">
          <button
            className="action-btn primary"
            onClick={handleGetDirections}
          >
            📍 Get Directions
          </button>
          <button
            className="action-btn secondary"
            onClick={() => user ? setShowReportModal(true) : onRequestAuth()}
          >
            🚩 Report Issue
          </button>
        </div>

      </div>

      {/* ── Modals (rendered outside the modal itself to avoid click-stop issues) ── */}
      {showReviewModal && (
        <ReviewModal
          station={station}
          onClose={() => setShowReviewModal(false)}
          onReviewAdded={handleReviewAdded}
        />
      )}

      {showReportModal && (
        <ReportModal
          station={station}
          onClose={() => setShowReportModal(false)}
        />
      )}

    </div>
  );
}

function getAmenityIcon(amenity) {
  const icons = {
    'WiFi': '📶',
    'Restroom': '🚻',
    'Cafe': '☕',
    'Parking': '🅿️',
    'Security': '🔒',
    'CCTV': '📹',
    'ATM': '💳',
    'Shopping': '🛍️',
    'Food Court': '🍔',
    'Waiting Lounge': '💺',
    'Waiting Area': '💺',
    'Convenience Store': '🏪',
    'Petrol Pump': '⛽',
    'Shopping Mall': '🏬',
  };
  return icons[amenity] || '✔';
}

function formatReviewText(text) {
  if (!text) return null;
  const match = text.match(/^(\[[a-z_]+\])\s*(.*)/);
  if (match) {
    const tag = match[1];
    const rest = match[2];
    const REPORT_TYPES = {
      '[charger_broken]': '🔌 Charger Broken',
      '[station_closed]': '🚫 Station Closed',
      '[wrong_location]': '📍 Wrong Location',
      '[wrong_info]': '📋 Incorrect Info',
      '[safety_issue]': '⚠️ Safety Issue',
      '[other]': '💬 Other',
    };
    const prettyTag = REPORT_TYPES[tag] || tag;
    return (
      <>
        <span style={{ fontWeight: 600, color: '#c8652a', marginRight: '4px' }}>{prettyTag}</span>
        {rest ? ` - ${rest}` : ''}
      </>
    );
  }
  return text;
}

export default StationDetails;