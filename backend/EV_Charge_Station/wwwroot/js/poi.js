import { hospitalIcon, restaurantIcon, hotelIcon } from "./icons.js";

// ================================
// POI Layers
// ================================

export const hospitalLayer = L.markerClusterGroup();
export const restaurantLayer = L.markerClusterGroup();
export const hotelLayer = L.markerClusterGroup();

// ================================
// Initialize Layers (called from map.js)
// ================================

export function initPOILayers(map) {
    map.addLayer(hospitalLayer);
    map.addLayer(restaurantLayer);
    map.addLayer(hotelLayer);
}

// ================================
// Generic POI Loader
// ================================

function loadPOI(map, type, layer, icon) {

    // Zoom protection
    if (!map || map.getZoom() < 15) return;

    const bounds = map.getBounds();

    const url = `/api/poi/${type}?south=${bounds.getSouth()}&west=${bounds.getWest()}&north=${bounds.getNorth()}&east=${bounds.getEast()}`;

    fetch(url)
        .then(res => {
            const contentType = res.headers.get("content-type");

            if (!res.ok || !contentType || !contentType.includes("application/json")) {
                throw new Error("Invalid JSON response");
            }

            return res.json();
        })
        .then(data => {

            layer.clearLayers();

            if (!data.elements) return;

            data.elements.forEach(el => {

                if (!el.lat || !el.lon) return;

                const name = el.tags?.name || type;

                L.marker([el.lat, el.lon], { icon })
                    .bindPopup(`<strong>${name}</strong><br>${type}`)
                    .addTo(layer);
            });

            console.log(`${data.elements.length} ${type} loaded`);
        })
        .catch(err => console.error(`${type} POI error:`, err));
}

// ================================
// Export Specific Loaders
// ================================

export function loadHospitals(map) {
    loadPOI(map, "hospital", hospitalLayer, hospitalIcon);
}

export function loadRestaurants(map) {
    loadPOI(map, "restaurant", restaurantLayer, restaurantIcon);
}

export function loadHotels(map) {
    loadPOI(map, "hotel", hotelLayer, hotelIcon);
}