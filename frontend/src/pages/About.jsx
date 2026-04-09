import React from 'react';
import { Link } from 'react-router-dom';
import './About.css';

function About() {

  const features = [
    {
      icon: '🗺️',
      title: 'Interactive Map',
      desc: 'Live OpenStreetMap with smart marker clustering — EV stations group into branded ⚡ clusters at country/state level and split into individual markers when zoomed in.',
    },
    {
      icon: '🤝',
      title: 'Social Sync',
      desc: 'Real-time group sessions via SignalR. Create or join a session with a 6-digit OTP, share live location, chat, and sync your EV charging destination with friends.',
    },
    {
      icon: '🔍',
      title: 'Smart Search & Filters',
      desc: 'Search stations by name, address, or provider. Filter by availability, fast charging (50 kW+), connector type (Type 2, CCS, CHAdeMO), and sort by distance, rating or price.',
    },
    {
      icon: '❤️',
      title: 'Favorites',
      desc: 'Save preferred charging spots to your account. Favorites are synced with the backend, available on any device after login.',
    },
    {
      icon: '📊',
      title: 'Community Reports & Reviews',
      desc: 'Report real-time charger availability, submit star ratings and reviews, and upvote or downvote existing reports to keep the community informed.',
    },
    {
      icon: '🧭',
      title: 'Route Planner & Navigation',
      desc: 'Compute turn-by-turn routes to any station. Optionally pick your start point by tapping the map. Enable live GPS tracking to follow your route in real time.',
    },
    {
      icon: '⚡',
      title: 'Detailed Station Info',
      desc: 'See connector types, power output (kW), pricing, plug availability, operating hours, amenities, and community ratings for every station.',
    },
    {
      icon: '📍',
      title: 'POI Overlay',
      desc: 'At zoom 15+, nearby hospitals, restaurants and hotels appear as pin markers. Toggleable per category with live counts.',
    },
    {
      icon: '🌍',
      title: 'Multi-Layer Maps',
      desc: 'Switch between Light, Dark, Terrain and Satellite tile layers to suit your preference or environment.',
    },
    {
      icon: '🔐',
      title: 'Secure Auth',
      desc: 'Sign up or sign in with email/password or via Google OAuth. JWT tokens protect all user-specific endpoints. Password reset built-in.',
    },
  ];

  const techStack = [
    { name: 'React 18', desc: 'Frontend framework', icon: '⚛️' },
    { name: 'Leaflet.js', desc: 'Interactive maps', icon: '🗺️' },
    { name: 'react-leaflet-cluster', desc: 'Marker clustering', icon: '🔵' },
    { name: 'OpenStreetMap', desc: 'Free map tiles', icon: '🌍' },
    { name: 'OpenChargeMap API', desc: 'EV station data', icon: '🔌' },
    { name: 'Nominatim', desc: 'Geocoding & place search', icon: '📍' },
    { name: 'ASP.NET Core', desc: 'Backend REST API', icon: '⚙️' },
    { name: 'MongoDB Atlas', desc: 'Cloud NoSQL database', icon: '🍃' },
    { name: 'SignalR', desc: 'Real-time WebSocket hub', icon: '📡' },
    { name: 'Google OAuth', desc: 'Social authentication', icon: '🔑' },
    { name: 'Overpass API', desc: 'POI data (hospitals etc.)', icon: '🏥' },
    { name: 'OSRM / ORS', desc: 'Routing & directions', icon: '🚗' },
  ];

  const highlights = [
    {
      icon: '⚡',
      title: 'Smart Clustering',
      desc: 'Hundreds of EV stations intelligently grouped into clusters at the country and state level — click to drill down.',
    },
    {
      icon: '🤝',
      title: 'Travel Together',
      desc: 'Social Sync lets EV drivers share live locations and coordinate charging stops in real time over a secure SignalR channel.',
    },
    {
      icon: '🌐',
      title: 'Community-Driven',
      desc: 'Reports, reviews, and availability updates are crowdsourced — keeping charger status accurate beyond official APIs.',
    },
  ];

  return (
    <div className="about-page">
      <div className="about-scroll-container">
        <div className="about-inner">
          <Link to="/" className="back-link">← Back to Map</Link>

          {/* Hero */}
          <section className="about-hero">
            <img
              src="/logo.jpg"
              alt="ChargeSaathi Logo"
              style={{ width: '70px', mixBlendMode: 'multiply', marginBottom: '16px' }}
            />
            <h1 className="hero-title">ChargeSaathi</h1>
            <p className="hero-subtitle">Apka EV Charging Companion</p>
            <p className="hero-desc">
              A full-stack EV Charging Station Locator built with React 18 and ASP.NET Core,
              backed by MongoDB Atlas and powered by real-time features via SignalR.
              Helping EV drivers across India find, navigate to, review, and
              coordinate charging stops — together.
            </p>
          </section>

          {/* Why ChargeSaathi */}
          <section className="about-section">
            <h2 className="section-heading">🌟 Why ChargeSaathi</h2>
            <div className="highlight-grid">
              {highlights.map((h, i) => (
                <div key={i} className="highlight-card">
                  <span className="highlight-card-icon">{h.icon}</span>
                  <h3 className="highlight-card-title">{h.title}</h3>
                  <p className="highlight-card-desc">{h.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Features */}
          <section className="about-section">
            <h2 className="section-heading">✨ Features</h2>
            <div className="features-grid">
              {features.map((f, i) => (
                <div key={i} className="feature-card">
                  <span className="feature-icon">{f.icon}</span>
                  <h3 className="feature-title">{f.title}</h3>
                  <p className="feature-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Tech Stack */}
          <section className="about-section">
            <h2 className="section-heading">🛠️ Tech Stack</h2>
            <div className="tech-grid">
              {techStack.map((t, i) => (
                <div key={i} className="tech-card">
                  <span className="tech-icon">{t.icon}</span>
                  <div className="tech-info">
                    <span className="tech-name">{t.name}</span>
                    <span className="tech-desc">{t.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Team */}
          <section className="about-section">
            <h2 className="section-heading">👥 Team</h2>
            <div className="team-grid">
              <div className="team-card">
                <div className="team-avatar">🎨</div>
                <h3 className="team-name">Rudra Thakker</h3>
                <p className="team-role">Frontend Developer — React · Leaflet.js · UI/UX · SignalR Client</p>
              </div>
              <div className="team-card">
                <div className="team-avatar">⚙️</div>
                <h3 className="team-name">Devicharan Dasari</h3>
                <p className="team-role">Backend Developer — ASP.NET Core · MongoDB Atlas · SignalR Hub · Auth</p>
              </div>
            </div>
          </section>

          {/* Status */}
          <section className="about-section">
            <h2 className="section-heading">🚀 Status</h2>
            <div className="dev-status">
              <div className="status-indicator">
                <div className="status-dot-anim" />
                Actively Developed — v2.5
              </div>
              <p>
                ChargeSaathi is actively being improved. The backend runs on ASP.NET Core with
                MongoDB Atlas for persistent storage. Real-time features (Social Sync, live
                location sharing, in-session chat) are powered by SignalR WebSockets.
                Station data is sourced from the OpenChargeMap API, geocoding from Nominatim,
                and Points of Interest from the Overpass (OpenStreetMap) API.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

export default About;