import React, { memo } from 'react';
import './StationList.css';

const StationCard = memo(function StationCard({ station, isActive, isFavorite, onSelect, onFavorite, onNavigate }) {
  const pct = station.totalPlugs > 0
    ? Math.round((station.availablePlugs / station.totalPlugs) * 100)
    : 0;
  const fillClass = pct > 50 ? 'green' : pct > 0 ? 'orange' : 'red';

  return (
    <div
      className={`cs-card${isActive ? ' active' : ''}`}
      onClick={() => onSelect(station)}
    >
      <div className={`cs-card-bar ${station.isAvailable ? 'on' : 'off'}`} />

      {/* Header */}
      <div className="cs-card-head">
        <div className="cs-card-icon">⚡</div>
        <div className="cs-card-title-wrap">
          <div className="cs-card-title">{station.name}</div>
          <div className="cs-card-addr">📍 {station.address}</div>
        </div>
        <div className={`cs-badge ${station.isAvailable ? 'on' : 'off'}`}>
          {station.isAvailable ? 'Open' : 'Busy'}
        </div>
      </div>

      {/* Plug progress */}
      <div className="cs-prog-wrap">
        <div className="cs-prog-info">
          <span>Plugs available</span>
          <span className={fillClass}>{station.availablePlugs}/{station.totalPlugs}</span>
        </div>
        <div className="cs-prog-track">
          <div className={`cs-prog-fill ${fillClass}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Info pills */}
      <div className="cs-card-meta">
        <span className="cs-tag cs-tag-power">⚡ {station.power} kW</span>
        <span className="cs-tag cs-tag-price">{station.price}</span>
      </div>

      {/* Footer */}
      <div className="cs-card-foot">
        {station.totalReviews > 0 ? (
          <div className="cs-rating">
            <span className="cs-stars">{'★'.repeat(Math.min(Math.floor(station.rating), 5))}</span>
            <span className="cs-rv"> {station.rating}</span>
            <span className="cs-rc"> ({station.totalReviews})</span>
          </div>
        ) : (
          <div className="cs-rating">
            <span className="cs-rv" style={{ color: '#9ca3af', fontSize: '11px' }}>Click to See Reviews</span>
          </div>
        )}
        <div className="cs-card-btns">
          <button
            className={`cs-btn-fav${isFavorite ? ' on' : ''}`}
            title={isFavorite ? 'Remove favourite' : 'Add favourite'}
            onClick={e => { e.stopPropagation(); onFavorite(station); }}
          >
            {isFavorite ? '❤️' : '🤍'}
          </button>
          <button
            className="cs-btn-go"
            onClick={e => { e.stopPropagation(); onNavigate(station); }}
          >
            Go →
          </button>
        </div>
      </div>
    </div>
  );
});

const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className="cs-card cs-card-skeleton">
      <div className="cs-card-bar on" style={{ opacity: 0.2 }} />
      <div className="cs-card-head">
        <div className="cs-skel cs-skel-icon" />
        <div className="cs-card-title-wrap" style={{ gap: 6, display: 'flex', flexDirection: 'column' }}>
          <div className="cs-skel cs-skel-title" />
          <div className="cs-skel cs-skel-addr" />
        </div>
      </div>
      <div style={{ padding: '0 14px 10px' }}>
        <div className="cs-skel" style={{ height: 5, borderRadius: 99 }} />
      </div>
      <div className="cs-card-meta">
        {[1, 2, 3].map(i => <div key={i} className="cs-skel cs-skel-tag" />)}
      </div>
    </div>
  );
});

export default memo(function StationList({
  stations = [], activeStation, favorites = new Set(),
  onSelect, onFavorite, onNavigate, loading = false,
  sectionTitle = 'Nearby Stations',
}) {
  const available = stations.filter(s => s.isAvailable).length;
  const busy = stations.length - available;
  const avgDist = stations.length
    ? (stations.reduce((a, s) => a + (s.distance || 0), 0) / stations.length).toFixed(1)
    : '0.0';

  return (
    <aside className="cs-sidebar">

      {/* Stats */}
      <div className="cs-stats-row">
        <div className="cs-stat">
          <div className="cs-stat-n">{stations.length}</div>
          <div className="cs-stat-l">Total</div>
        </div>
        <div className="cs-stat">
          <div className="cs-stat-n green">{available}</div>
          <div className="cs-stat-l">Available</div>
        </div>
        <div className="cs-stat">
          <div className="cs-stat-n red">{busy}</div>
          <div className="cs-stat-l">Busy</div>
        </div>
        <div className="cs-stat">
          <div className="cs-stat-n">{avgDist}<small>km</small></div>
          <div className="cs-stat-l">Avg Dist</div>
        </div>
      </div>

      {/* Section header */}
      <div className="cs-sec-head">
        <div className="cs-sec-title">{sectionTitle}</div>
        <div className="cs-sec-count">{stations.length} stations</div>
      </div>

      {/* List */}
      <div className="cs-list">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : stations.length === 0 ? (
          <div className="cs-empty">
            <div className="cs-empty-icon">🔍</div>
            <div className="cs-empty-text">No stations match your filters</div>
            <div className="cs-empty-sub">Try adjusting or clearing your filters</div>
          </div>
        ) : (
          stations.map(s => (
            <StationCard
              key={s.id}
              station={s}
              isActive={activeStation?.id === s.id}
              isFavorite={favorites.has(s.id)}
              onSelect={onSelect}
              onFavorite={onFavorite}
              onNavigate={onNavigate}
            />
          ))
        )}
      </div>

    </aside>
  );
});