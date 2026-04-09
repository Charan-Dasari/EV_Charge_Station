import React, { useState } from 'react';
import './SearchFilter.css';

// Each filter maps to a { key, value } pair that updateFilter() in useStationFilter understands
const FILTERS = [
  { label: 'All',       key: 'preset',        value: 'all',       icon: '⚡' },
  { label: 'Available', key: 'availability',   value: 'available', icon: '●'  },
  { label: '50+ kW',    key: 'power',          value: 'fast',      icon: '🔋' },
  { label: 'CCS',       key: 'connectorType',  value: 'CCS',       icon: '🔌' },
  { label: 'CHAdeMO',   key: 'connectorType',  value: 'CHAdeMO',   icon: '🔌' },
  { label: 'Type 2',    key: 'connectorType',  value: 'Type 2',    icon: '🔌' },  
];

export default function SearchFilter({
  filters = {},
  onFilterChange,
  onReset,
  onStationSearch,
  totalResults = 0,
}) {
  const [query, setQuery] = useState('');

  const handleSearch = (e) => {
    const val = e.target.value;
    setQuery(val);
    onFilterChange?.('search', val);
    onStationSearch?.(val);
  };

  const clearSearch = () => {
    setQuery('');
    onFilterChange?.('search', '');
    onStationSearch?.('');
  };

  const handleChipClick = (filter) => {
    if (filter.value === 'all') {
      onReset?.();
      return;
    }
    // Toggle: if already active, reset that filter; otherwise apply it
    if (isActive(filter)) {
      onFilterChange?.(filter.key, null);
    } else {
      onFilterChange?.(filter.key, filter.value);
    }
  };

  const isActive = (filter) => {
    if (filter.value === 'all') {
      return !filters.availability && !filters.power && !filters.connectorType;
    }
    if (filter.key === 'availability')  return filters.availability  === filter.value;
    if (filter.key === 'power')         return filters.power         === filter.value;
    if (filter.key === 'connectorType') return filters.connectorType === filter.value;
    return false;
  };

  return (
    <div className="cs-sf">

      {/* Search */}
      <div className="cs-sf-search">
        <svg className="cs-sf-icon" width="14" height="14"
          viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Filter by name or provider…"
          value={query}
          onChange={handleSearch}
        />
        {query && (
          <button className="cs-sf-clear" onClick={clearSearch}>✕</button>
        )}
      </div>

      {/* Filter chips */}
      <div className="cs-sf-chips">
        {FILTERS.map((f, i) => (
          <button
            key={`${f.key}-${f.value}-${i}`}
            className={`cs-chip${isActive(f) ? ' active' : ''}`}
            onClick={() => handleChipClick(f)}
          >
            <span className="cs-chip-icon">{f.icon}</span>
            <span className="cs-chip-label">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="cs-sf-results">
        <span>{totalResults}</span> station{totalResults !== 1 ? 's' : ''} found
      </div>

    </div>
  );
}