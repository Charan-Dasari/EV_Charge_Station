import { map } from "./map.js";

import { loadEVStations } from "./ev.js";

import {
    loadHospitals,
    loadRestaurants,
    loadHotels
} from "./poi.js";

import {
    initThemeToggle,
    initLocateControl,
    initSearchBar,
    initUserLocation
} from "./ui.js";

// ================================
// Initialize UI Controls
// ================================

initUserLocation();
initThemeToggle();
initLocateControl();
initSearchBar();

// ================================
// Debounce Map Movement
// ================================

let debounceTimer = null;

function loadAllData() {

    loadEVStations();
    loadHospitals(map);
    loadRestaurants(map);
    loadHotels(map);
}

map.on("moveend", () => {

    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
        loadAllData();
    }, 400);
});

// ================================
// Initial Load
// ================================

loadAllData();