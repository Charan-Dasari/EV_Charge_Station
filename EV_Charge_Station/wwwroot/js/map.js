import {
    initPOILayers,
    loadHospitals,
    loadRestaurants,
    loadHotels
} from "./poi.js";

// ================================
// Default Location
// ================================
const defaultLat = 20.5937;
const defaultLng = 78.9629;
const defaultZoom = 5;

// ================================
// Tile Layers
// ================================

// Light Map
const normalMap = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        minZoom: 2,
        attribution: "© OpenStreetMap contributors"
    }
);

// Dark Map
const darkMap = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
        maxZoom: 19,
        minZoom: 2,
        attribution: "© CartoDB"
    }
);

// Terrain
const terrainMap = L.tileLayer(
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 17,
        minZoom: 2,
        attribution: "© OpenTopoMap"
    }
);

// Satellite
const satelliteMap = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        maxZoom: 19,
        maxNativeZoom: 17,
        minZoom: 2,
        attribution: "Tiles © Esri"
    }
);

// Satellite Labels
const labelsLayer = L.tileLayer(
    "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19 }
);

const satelliteWithLabels = L.layerGroup([
    satelliteMap,
    labelsLayer
]);

// ================================
// Map Initialization
// ================================
export const map = L.map("map", {
    center: [defaultLat, defaultLng],
    zoom: defaultZoom,
    minZoom: 2,
    maxZoom: 17,
    worldCopyJump: true,
    layers: [normalMap]
});

// ================================
// Layer Switch Control
// ================================
L.control.layers({
    "Map (Light)": normalMap,
    "Map (Dark)": darkMap,
    "Terrain": terrainMap,
    "Satellite": satelliteWithLabels
}).addTo(map);

// Initialize POI layers AFTER map is created
initPOILayers(map);

// ================================
// Load POIs when map moves
// ================================
map.on("moveend", () => {

    if (map.getZoom() < 15) {
        console.log("Zoom in to load POIs");
        return;
    }

    loadHospitals(map);
    loadRestaurants(map);
    loadHotels(map);
});

let poiDebounce;

map.on("moveend", () => {

    clearTimeout(poiDebounce);

    poiDebounce = setTimeout(() => {

        if (map.getZoom() < 15) return;

        loadHospitals(map);
        loadRestaurants(map);
        loadHotels(map);

    }, 400);
});

import { initRouteSystem } from "./route.js";

initRouteSystem();

// Optional exports
export { normalMap, darkMap };