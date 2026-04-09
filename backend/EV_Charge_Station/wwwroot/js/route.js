import { map } from "./map.js";

let routeState = {
    start: null,
    end: null
};

let activeRouteLine = null;
let startMarker = null;
let endMarker = null;
let routePanel = null;
let isPickingStart = false;

let watchId = null;
let trackingMarker = null;
let isFollowingUser = true;


// ================================
// INIT ROUTE SYSTEM
// ================================
export function initRouteSystem() {

    // Stop auto-follow when user drags map
    map.on("dragstart", () => {
        isFollowingUser = false;
    });

    // EV Get Directions button
    document.addEventListener("click", function (e) {
        if (e.target.classList.contains("route-btn")) {

            const lat = parseFloat(e.target.dataset.lat);
            const lng = parseFloat(e.target.dataset.lng);
            const name = e.target.dataset.name;

            setDestination(lat, lng, name);
        }
    });

    // Pick start from map
    map.on("click", function (e) {

        if (!isPickingStart) return;

        setStart(e.latlng.lat, e.latlng.lng, "Selected Location");
        isPickingStart = false;
        map.getContainer().style.cursor = "";
    });
}


// ================================
// SET DESTINATION
// ================================
function setDestination(lat, lng, label) {

    routeState.end = { lat, lng, label };

    map.flyTo([lat, lng], 14);

    if (endMarker) map.removeLayer(endMarker);

    const destinationIcon = L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -32]
    });

    endMarker = L.marker([lat, lng], { icon: destinationIcon })
        .addTo(map)
        .bindPopup("Destination")
        .openPopup();

    resetRouteStateUI();
    openRoutePanel();
}


// ================================
// SET START
// ================================
function setStart(lat, lng, label) {

    routeState.start = { lat, lng, label };

    if (startMarker) map.removeLayer(startMarker);

    startMarker = L.marker([lat, lng])
        .addTo(map)
        .bindPopup("Start Location");

    updatePanelStart(label);

    resetRouteStateUI();
}


// ================================
// USE MY LOCATION (one-time)
// ================================
function detectCurrentLocation() {

    if (!navigator.geolocation) {
        alert("Geolocation not supported.");
        return;
    }

    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        setStart(latitude, longitude, "My Location");
    });
}


// ================================
// CALCULATE ROUTE
// ================================
async function calculateRoute() {

    if (!routeState.start || !routeState.end) {
        alert("Select both start and destination.");
        return;
    }

    const { lat: fromLat, lng: fromLng } = routeState.start;
    const { lat: toLat, lng: toLng } = routeState.end;

    const response = await fetch(
        `/api/route?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`
    );

    const data = await response.json();

    drawRoute(data.geometry);
    updatePanelSummary(data.distanceKm, data.durationMinutes);

    // Switch buttons
    document.getElementById("startRouteBtn").style.display = "none";
    document.getElementById("startNavBtn").style.display = "block";
}


// ================================
// DRAW ROUTE
// ================================
function drawRoute(geometry) {

    if (activeRouteLine) map.removeLayer(activeRouteLine);

    const latlngs = geometry.map(p => [p.latitude, p.longitude]);

    activeRouteLine = L.polyline(latlngs, {
        color: "#2563eb",
        weight: 6,
        opacity: 0.9
    }).addTo(map);

    map.fitBounds(activeRouteLine.getBounds());
}


// ================================
// START NAVIGATION (LIVE TRACKING)
// ================================
function startNavigation() {

    if (!navigator.geolocation) {
        alert("Geolocation not supported.");
        return;
    }

    if (watchId) return;

    isFollowingUser = true;

    watchId = navigator.geolocation.watchPosition(
        position => {

            const { latitude, longitude } = position.coords;

            if (!trackingMarker) {
                trackingMarker = L.marker([latitude, longitude])
                    .addTo(map)
                    .bindPopup("You are here");
            } else {
                trackingMarker.setLatLng([latitude, longitude]);
            }

            if (isFollowingUser) {
                map.setView([latitude, longitude]);
            }
        },
        error => {
            console.warn("Tracking error:", error);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000
        }
    );
}


// ================================
// RESET UI WHEN START/DEST CHANGES
// ================================
function resetRouteStateUI() {

    // Remove route line
    if (activeRouteLine) {
        map.removeLayer(activeRouteLine);
        activeRouteLine = null;
    }

    // Stop navigation
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    if (trackingMarker) {
        map.removeLayer(trackingMarker);
        trackingMarker = null;
    }

    // Reset buttons
    const calcBtn = document.getElementById("startRouteBtn");
    const navBtn = document.getElementById("startNavBtn");

    if (calcBtn) calcBtn.style.display = "block";
    if (navBtn) navBtn.style.display = "none";

    // Clear summary
    const summary = document.getElementById("route-summary");
    if (summary) summary.innerHTML = "";
}


// ================================
// CLEAR ROUTE
// ================================
export function clearRoute() {

    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    if (trackingMarker) {
        map.removeLayer(trackingMarker);
        trackingMarker = null;
    }

    if (activeRouteLine) map.removeLayer(activeRouteLine);
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);

    routeState = { start: null, end: null };
    activeRouteLine = null;
    startMarker = null;
    endMarker = null;

    if (routePanel) {
        routePanel.remove();
        routePanel = null;
    }
}


// ================================
// ROUTE PANEL
// ================================
function openRoutePanel() {

    if (routePanel) routePanel.remove();

    routePanel = document.createElement("div");
    routePanel.className = "route-panel";

    routePanel.innerHTML = `
        <h3>Route</h3>

        <div class="route-info">
            <strong>Start:</strong>
            <div id="route-start">Not Selected</div>

            <button id="useLocationBtn" class="route-btn-secondary">
                Use My Location
            </button>

            <button id="pickMapBtn" class="route-btn-secondary">
                Pick on Map
            </button>
        </div>

        <div class="route-info">
            <strong>Destination:</strong>
            <div>${routeState.end.label}</div>
        </div>

        <div id="route-summary" class="route-info route-distance"></div>

        <button id="startRouteBtn" class="route-btn-primary">
            Calculate Route
        </button>

        <button id="startNavBtn" class="route-btn-primary" style="display:none;">
            Start Navigation
        </button>

        <button id="clearRouteBtn" class="route-btn-secondary">
            Close
        </button>
    `;

    document.body.appendChild(routePanel);

    document.getElementById("useLocationBtn")
        .addEventListener("click", detectCurrentLocation);

    document.getElementById("pickMapBtn")
        .addEventListener("click", () => {
            isPickingStart = true;
            map.getContainer().style.cursor = "crosshair";
        });

    document.getElementById("startRouteBtn")
        .addEventListener("click", calculateRoute);

    document.getElementById("startNavBtn")
        .addEventListener("click", startNavigation);

    document.getElementById("clearRouteBtn")
        .addEventListener("click", clearRoute);
}


// ================================
// PANEL HELPERS
// ================================
function updatePanelStart(label) {
    const el = document.getElementById("route-start");
    if (el) el.innerText = label;
}

function formatDuration(minutes) {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hrs > 0) return `${hrs} hr ${mins} min`;
    return `${mins} min`;
}

function updatePanelSummary(distance, duration) {
    const el = document.getElementById("route-summary");
    if (el) {
        el.innerHTML = `
            <strong>Distance:</strong> ${distance.toFixed(2)} km<br>
            <strong>Duration:</strong> ${formatDuration(duration)}
        `;
    }
}