import React, { useState } from 'react';
import { reportsAPI } from '../../services/api';
import './ReviewReportModal.css';

const REPORT_TYPES = [
  { id: 'charger_broken', label: '🔌 Charger Broken', icon: '🔌' },
  { id: 'station_closed', label: '🚫 Station Closed', icon: '🚫' },
  { id: 'wrong_location', label: '📍 Wrong Location', icon: '📍' },
  { id: 'wrong_info', label: '📋 Incorrect Info', icon: '📋' },
  { id: 'safety_issue', label: '⚠️ Safety Issue', icon: '⚠️' },
  { id: 'other', label: '💬 Other', icon: '💬' },
];

export default function ReportModal({ station, onClose }) {
  const [selectedType, setSelectedType] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedType) { setError('Please select an issue type.'); return; }

    setLoading(true);
    setError('');

    try {
      const result = await reportsAPI.submitReport({
        stationId: station.id,
        status: "Unknown",
        rating: 0,
        reviewText: `[${selectedType}] ${description.trim()}`,
      });

      setLoading(false);

      if (result.success) {
        setSuccess(true);
        setTimeout(onClose, 1800);
      } else {
        setError(result.error || 'Failed to submit report.');
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
          <div className="rrm-icon report">🚩</div>
          <div>
            <h3 className="rrm-title">Report an Issue</h3>
            <p className="rrm-subtitle">{station.name}</p>
          </div>
        </div>

        {success ? (
          <div className="rrm-success">
            <div className="rrm-success-icon">✅</div>
            <div>Report submitted! We'll look into it.</div>
          </div>
        ) : (
          <form className="rrm-form" onSubmit={handleSubmit}>

            <div className="rrm-field">
              <label>Issue Type</label>
              <div className="rrm-types-grid">
                {REPORT_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`rrm-type-btn ${selectedType === t.id ? 'active' : ''}`}
                    onClick={() => setSelectedType(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rrm-field">
              <label>Additional Details <span className="rrm-optional">(optional)</span></label>
              <textarea
                placeholder="Describe the issue in more detail…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={300}
              />
            </div>

            {error && <div className="rrm-error">⚠️ {error}</div>}

            <div className="rrm-actions">
              <button type="button" className="rrm-cancel" onClick={onClose}>Cancel</button>
              <button type="submit" className="rrm-submit report" disabled={loading}>
                {loading ? 'Submitting…' : '🚩 Submit Report'}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}
