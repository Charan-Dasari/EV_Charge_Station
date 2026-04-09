import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as syncService from '../../services/signalrService';
import './SocialSyncPanel.css';

export default function SocialSyncPanel({
  user, isVisible, onClose,
  onPeerLocation, onPeerDestination,
  userLocation, activeDestination, onFocusLocation
}) {
  // ── State ──────────────────────────────────────────────────
  const [phase, setPhase] = useState('menu');      // menu | creating | hosting | joining | synced
  const [otp, setOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [peerName, setPeerName] = useState('');
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [error, setError] = useState('');
  const [locationActive, setLocationActive] = useState(false);

  const watchRef = useRef(null);
  const chatEndRef = useRef(null);
  const peerNameRef = useRef('');

  // ── Subscribe to SignalR events ────────────────────────────
  useEffect(() => {
    const unsubs = [
      syncService.on('sessionCreated', (receivedOtp) => {
        setOtp(receivedOtp);
        setPhase('hosting');
      }),
      syncService.on('sessionJoined', (data) => {
        setPeerName(data.peerName);
        peerNameRef.current = data.peerName;
        setPhase('synced');
        startLocationTracking();
        if (data.destination) {
          onPeerDestination?.(data.destination);
          setMessages(prev => [...prev, {
            sender: 'System',
            text: `${data.peerName} selected a destination.`,
            isAction: true,
            coords: data.destination,
            timestamp: new Date().toISOString()
          }]);
        }
      }),
      syncService.on('peerJoined', (data) => {
        setPeerName(data.peerName);
        peerNameRef.current = data.peerName;
        setPhase('synced');
        startLocationTracking();
      }),
      syncService.on('joinFailed', (msg) => {
        setError(msg);
        setPhase('menu');
      }),
      syncService.on('locationUpdated', (data) => {
        onPeerLocation?.(data);
      }),
      syncService.on('messageReceived', (data) => {
        setMessages(prev => [...prev, { ...data, fromPeer: true }]);
      }),
      syncService.on('sessionEnded', () => {
        handleSessionEnd('Your sync partner has left.');
      }),
      syncService.on('connectionClosed', () => {
        handleSessionEnd('Connection lost.');
      }),
      syncService.on('destinationUpdated', (data) => {
        onPeerDestination?.(data);
        setMessages(prev => [...prev, {
          sender: 'System',
          text: `${peerNameRef.current || 'Partner'} set a new Destination`,
          isAction: true,
          coords: data,
          timestamp: new Date().toISOString()
        }]);
      }),
    ];

    return () => unsubs.forEach(u => u());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Broadcast my destination to peer whenever it changes (only when synced)
  useEffect(() => {
    if (phase === 'synced' && activeDestination) {
      syncService.updateDestination(activeDestination).catch(() => {});
    }
  }, [activeDestination, phase]);

  // ── Location tracking ──────────────────────────────────────
  const startLocationTracking = useCallback(() => {
    if (watchRef.current) return;
    if (!navigator.geolocation) return;
    setLocationActive(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        syncService.updateLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => console.warn('[SocialSync] GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }, []);

  const stopLocationTracking = useCallback(() => {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setLocationActive(false);
  }, []);

  // ── Handlers ───────────────────────────────────────────────
  const handleCreate = async () => {
    setError('');
    setPhase('creating');
    try {
      await syncService.createSession(user.id || user.email, user.name);
    } catch (err) {
      setError('Could not connect to server.');
      setPhase('menu');
    }
  };

  const handleJoin = async () => {
    if (otpInput.length !== 6) {
      setError('Enter a valid 6-digit OTP.');
      return;
    }
    setError('');
    setPhase('joining');
    try {
      await syncService.joinSession(otpInput, user.id || user.email, user.name);
    } catch (err) {
      setError('Could not connect to server.');
      setPhase('menu');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    const msg = { sender: 'You', text: msgInput.trim(), timestamp: new Date().toISOString(), fromPeer: false };
    setMessages(prev => [...prev, msg]);
    await syncService.sendMessage(msgInput.trim());
    setMsgInput('');
  };

  const handleQuickMessage = async (text) => {
    const msg = { sender: 'You', text, timestamp: new Date().toISOString(), fromPeer: false };
    setMessages(prev => [...prev, msg]);
    await syncService.sendMessage(text);
  };

  const handleLeave = async () => {
    stopLocationTracking();
    await syncService.leaveSession();
    onPeerLocation?.(null);
    onPeerDestination?.(null);
    onClose();
  };

  const handleSessionEnd = (reason) => {
    stopLocationTracking();
    onPeerLocation?.(null);
    onPeerDestination?.(null);
    setMessages([]);
    setOtp('');
    setPeerName('');
    setError(reason);
    setPhase('menu');
  };

  // Cleanup on unmount (Note: we no longer leaveSession on unmount so you can minimize)
  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, [stopLocationTracking]);

  // Distance Calculation Helper
  const getDistanceText = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return '--';
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d < 1 ? (d * 1000).toFixed(0) + ' m' : d.toFixed(1) + ' km';
  };

  // Check if peer is sharing location
  const [peerLocState, setPeerLocState] = useState(null);
  useEffect(() => {
    const unsub = syncService.on('locationUpdated', (data) => setPeerLocState(data));
    return unsub;
  }, []);

  // ── Render ─────────────────────────────────────────────────
  if (!isVisible) return null;

  return (
    <div className="ss-overlay">
      <div className="ss-panel" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="ss-header">
          <div className="ss-header-left">
            <img
              src="/sync-nobg.png"
              alt="Social Sync"
              style={{ width: '70px', height: '70px', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 2px 8px rgba(200, 101, 42, 0.25)' }}
            />
            <div>
              <div className="ss-title">Social Sync</div>
              <div className="ss-subtitle">
                {phase === 'menu' && 'Connect with fellow EV travelers'}
                {phase === 'creating' && 'Setting up session...'}
                {phase === 'hosting' && 'Waiting for partner...'}
                {phase === 'joining' && 'Connecting...'}
                {phase === 'synced' && `Synced with ${peerName}`}
              </div>
            </div>
          </div>
          <button className="ss-close" onClick={onClose}>✕</button>
        </div>

        {/* Error */}
        {error && (
          <div className="ss-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* ── MENU PHASE ── */}
        {phase === 'menu' && (
          <div className="ss-menu">
            <div className="ss-menu-card" onClick={handleCreate}>
              <div className="ss-card-icon">📡</div>
              <div className="ss-card-info">
                <div className="ss-card-title">Create Session</div>
                <div className="ss-card-desc">Generate an OTP and share it with your travel buddy</div>
              </div>
              <span className="ss-card-arrow">→</span>
            </div>

            <div className="ss-divider"><span>OR</span></div>

            <div className="ss-join-section">
              <div className="ss-card-icon" style={{ marginBottom: 12 }}>🔗</div>
              <div className="ss-card-title" style={{ marginBottom: 8 }}>Join Session</div>
              <div className="ss-otp-input-row">
                <input
                  type="text"
                  className="ss-otp-input"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
                <button className="ss-join-btn" onClick={handleJoin} disabled={otpInput.length !== 6}>
                  Join
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CREATING PHASE ── */}
        {phase === 'creating' && (
          <div className="ss-loading">
            <div className="ss-spinner" />
            <p>Creating your session...</p>
          </div>
        )}

        {/* ── HOSTING PHASE (show OTP) ── */}
        {phase === 'hosting' && (
          <div className="ss-hosting">
            <div className="ss-otp-display">
              <div className="ss-otp-label">Your Session OTP</div>
              <div className="ss-otp-code">{otp}</div>
              <button className="ss-copy-btn" onClick={() => {
                navigator.clipboard.writeText(otp);
              }}>
                📋 Copy OTP
              </button>
            </div>
            <p className="ss-hosting-hint">Share this OTP with your travel buddy. They'll enter it on their ChargeSaathi app to join.</p>
            <div className="ss-waiting-indicator">
              <div className="ss-pulse" />
              <span>Waiting for partner to join...</span>
            </div>
          </div>
        )}

        {/* ── JOINING PHASE ── */}
        {phase === 'joining' && (
          <div className="ss-loading">
            <div className="ss-spinner" />
            <p>Joining session...</p>
          </div>
        )}

        {/* ── SYNCED PHASE (live chat + status) ── */}
        {phase === 'synced' && (
          <div className="ss-synced">
            {/* Connection status */}
            <div className="ss-sync-status">
              <div className="ss-sync-dot" />
              <span>Live sync with <strong>{peerName}</strong></span>
              {locationActive && <span className="ss-gps-badge">📍 GPS Active</span>}
            </div>

            {/* Chat area */}
            <div className="ss-metrics">
              <div className="ss-metric-item">
                🚗 Peer: <span>{getDistanceText(userLocation?.lat, userLocation?.lon, peerLocState?.lat, peerLocState?.lng)}</span>
              </div>
            </div>

            <div className="ss-chat">
              {messages.length === 0 && (
                <div className="ss-chat-empty">
                  <span>💬</span>
                  <p>Send a message to your travel buddy!</p>
                </div>
              )}
              {messages.map((msg, i) => {
                if (msg.isAction) {
                  return (
                    <div key={i} className="ss-msg system">
                      <div className="ss-msg-text">{msg.text}</div>
                      <button className="ss-system-btn" onClick={() => onFocusLocation?.(msg.coords)}>
                        📍 Click to see
                      </button>
                    </div>
                  );
                }
                return (
                  <div key={i} className={`ss-msg ${msg.fromPeer ? 'peer' : 'self'}`}>
                    <div className="ss-msg-sender">{msg.fromPeer ? msg.sender : 'You'}</div>
                    <div className="ss-msg-text">{msg.text}</div>
                    <div className="ss-msg-time">
                      {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Messages */}
            <div className="ss-quick-replies">
              <button className="ss-qr-btn" onClick={() => handleQuickMessage("Stopping Here 🛑")}>Stopping Here</button>
              <button className="ss-qr-btn" onClick={() => handleQuickMessage("Be Careful ⚠️")}>Be Careful</button>
              <button className="ss-qr-btn" onClick={() => handleQuickMessage("On my Way 🚗")}>On my Way</button>
              <button className="ss-qr-btn" onClick={() => handleQuickMessage("Charger Full ⚡")}>Charger Full</button>
              <button className="ss-qr-btn" onClick={() => handleQuickMessage("Need a break ☕")}>Need a break</button>
            </div>

            {/* Message input */}
            <form className="ss-msg-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="ss-msg-input"
                placeholder="Type a message..."
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
              />
              <button type="submit" className="ss-send-btn" disabled={!msgInput.trim()}>
                ➤
              </button>
            </form>

            {/* Leave button */}
            <button className="ss-leave-btn" onClick={handleLeave} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <img
                src='exit.png'
                style={{ width: '20px', height: '20px', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 2px 8px rgba(200, 101, 42, 0.25)' }}
                alt="Leave"
              /> 
              Leave Session
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
