// ============================================================
// SIGNALR SERVICE — Social Sync real-time connection
// ============================================================
import * as signalR from '@microsoft/signalr';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5150';

let connection = null;
let listeners = {};

/**
 * Build and start a SignalR connection to the Social Sync hub.
 * Returns the HubConnection instance.
 */
export async function startConnection() {
  if (connection && connection.state === signalR.HubConnectionState.Connected) {
    return connection;
  }

  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}/hubs/socialsync`)
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  // Re-register any existing listeners on reconnect
  connection.onreconnected(() => {
    console.log('[SocialSync] Reconnected');
  });

  connection.onclose(() => {
    console.log('[SocialSync] Connection closed');
    notify('connectionClosed');
  });

  // Register server → client event handlers
  connection.on('SessionCreated', (otp) => notify('sessionCreated', otp));
  connection.on('SessionJoined', (data) => notify('sessionJoined', data));
  connection.on('JoinFailed', (msg) => notify('joinFailed', msg));
  connection.on('PeerJoined', (data) => notify('peerJoined', data));
  connection.on('LocationUpdated', (data) => notify('locationUpdated', data));
  connection.on('MessageReceived', (data) => notify('messageReceived', data));
  connection.on('SessionEnded', (msg) => notify('sessionEnded', msg));
  connection.on('DestinationUpdated', (data) => notify('destinationUpdated', data));

  try {
    await connection.start();
    console.log('[SocialSync] Connected');
    return connection;
  } catch (err) {
    console.error('[SocialSync] Connection failed:', err);
    throw err;
  }
}

/**
 * Stop the connection gracefully.
 */
export async function stopConnection() {
  if (connection) {
    await connection.stop();
    connection = null;
  }
}

// ── Hub method wrappers ──────────────────────────────────────

export async function createSession(userId, userName) {
  const conn = await startConnection();
  await conn.invoke('CreateSession', userId, userName);
}

export async function joinSession(otp, userId, userName) {
  const conn = await startConnection();
  await conn.invoke('JoinSession', otp, userId, userName);
}

export async function updateLocation(lat, lng) {
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;
  await connection.invoke('UpdateLocation', lat, lng);
}

export async function sendMessage(message) {
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;
  await connection.invoke('SendMessage', message);
}

export async function updateDestination(destinationObj) {
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;
  await connection.invoke('UpdateDestination', destinationObj);
}

export async function leaveSession() {
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;
  await connection.invoke('LeaveSession');
  await stopConnection();
}

// ── Event subscription system ────────────────────────────────

/**
 * Subscribe to a Social Sync event.
 * @param {string} event — e.g. 'sessionCreated', 'peerJoined', 'locationUpdated', etc.
 * @param {function} callback 
 * @returns {function} unsubscribe
 */
export function on(event, callback) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);
  return () => {
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  };
}

function notify(event, data) {
  (listeners[event] || []).forEach(cb => {
    try { cb(data); } catch (e) { console.error(`[SocialSync] Listener error (${event}):`, e); }
  });
}
