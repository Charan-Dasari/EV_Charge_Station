import React, { useState } from 'react';
import { reviewsAPI } from '../../services/api';
import { authService } from '../../services/auth';
import './ReviewReportModal.css';

export default function ReviewModal({ station, onClose, onReviewAdded }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const user = authService.getUser();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) { setError('Please select a star rating.'); return; }
    if (text.trim().length < 10) { setError('Please write at least 10 characters.'); return; }

    setLoading(true);
    setError('');

    try {
      const result = await reviewsAPI.add(station.id, {
        rating,
        text: text.trim(),
        userName: user ? user.name : 'Anonymous',
      });

      setLoading(false);

      if (result.success) {
        setSuccess(true);
        onReviewAdded && onReviewAdded(result.data);
        setTimeout(onClose, 1500);
      } else {
        setError(result.error || 'Failed to submit review.');
      }
    } catch (err) {
      setLoading(false);
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="rrm-overlay" onClick={onClose}>
      <div className="rrm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rrm-close" onClick={onClose}>✕</button>

        <div className="rrm-header">
          <div className="rrm-icon">⭐</div>
          <div>
            <h3 className="rrm-title">Write a Review</h3>
            <p className="rrm-subtitle">{station.name}</p>
          </div>
        </div>

        {success ? (
          <div className="rrm-success">
            <div className="rrm-success-icon">🎉</div>
            <div>Review submitted! Thank you.</div>
          </div>
        ) : (
          <form className="rrm-form" onSubmit={handleSubmit}>

            {/* Star rating */}
            <div className="rrm-stars-wrap">
              <label>Your Rating</label>
              <div className="rrm-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`rrm-star ${star <= (hoverRating || rating) ? 'filled' : ''}`}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                  >
                    ★
                  </button>
                ))}
              </div>
              {(hoverRating || rating) > 0 && (
                <span className="rrm-rating-label">
                  {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][hoverRating || rating]}
                </span>
              )}
            </div>

            {/* Review text */}
            <div className="rrm-field">
              <label>Your Review</label>
              <textarea
                placeholder="Share your experience at this charging station…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <span className="rrm-char-count">{text.length}/500</span>
            </div>

            {!user && (
              <div className="rrm-anon-note">
                ℹ️ You're posting as <strong>Anonymous</strong>. Sign in to post with your name.
              </div>
            )}

            {error && <div className="rrm-error">⚠️ {error}</div>}

            <div className="rrm-actions">
              <button type="button" className="rrm-cancel" onClick={onClose}>Cancel</button>
              <button type="submit" className="rrm-submit" disabled={loading}>
                {loading ? 'Submitting…' : '⭐ Submit Review'}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}
