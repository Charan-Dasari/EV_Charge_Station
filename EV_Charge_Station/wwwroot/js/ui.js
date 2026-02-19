import { map, normalMap, darkMap } from "./map.js";

let userMarker = null;
let accuracyCircle = null;

// ================================
// USER LOCATION
// ================================

export function initUserLocation() {

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
        position => {

            const { latitude, longitude, accuracy } = position.coords;

            if (userMarker) {
                map.removeLayer(userMarker);
                map.removeLayer(accuracyCircle);
            }

            userMarker = L.marker([latitude, longitude])
                .addTo(map)
                .bindPopup("Your location");

            accuracyCircle = L.circle([latitude, longitude], {
                radius: accuracy,
                color: "blue",
                fillColor: "#3b82f6",
                fillOpacity: 0.15
            }).addTo(map);

            map.setView([latitude, longitude], 12);
        },
        error => {
            console.warn("Location access denied:", error);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000
        }
    );
}


// ================================
// THEME TOGGLE
// ================================

export function initThemeToggle() {

    const themeBtn = document.getElementById("themeToggle");
    if (!themeBtn) return;

    let isDark = false;

    themeBtn.addEventListener("click", () => {

        if (isDark) {
            map.removeLayer(darkMap);
            normalMap.addTo(map);
            themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }
        else {
            map.removeLayer(normalMap);
            darkMap.addTo(map);
            themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }

        isDark = !isDark;
    });
}


// ================================
// STATUS BOX
// ================================

export function setStatus(message) {

    const statusBox = document.getElementById("statusBox");
    if (!statusBox) return;

    statusBox.innerText = message;
}


// ================================
// LOCATE CONTROL (Leaflet Plugin)
// ================================

export function initLocateControl() {

    if (!L.control.locate) return;

    L.control.locate({
        position: "topleft",
        flyTo: true,
        showPopup: false,
        locateOptions: {
            enableHighAccuracy: true
        }
    }).addTo(map);
}

// ================================
// SEARCH LAYER (single controlled layer)
// ================================
const searchLayer = L.layerGroup().addTo(map);

// ================================
// SMART SEARCH BAR
// ================================
export function initSearchBar() {

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search city, area, hospital...";
    input.className = "custom-search";

    const container = L.control({ position: "topright" });

    container.onAdd = function () {
        const div = L.DomUtil.create("div");
        div.appendChild(input);
        return div;
    };

    container.addTo(map);

    let debounceTimer;

    input.addEventListener("input", function () {

        clearTimeout(debounceTimer);

        const query = input.value.trim();
        if (query.length < 3) return;

        debounceTimer = setTimeout(() => {

            fetch(`https://photon.komoot.io/api/?q=${query}&limit=5`)
                .then(res => res.json())
                .then(data => {

                    if (!data.features.length) return;

                    const result = data.features[0];
                    const coords = result.geometry.coordinates;

                    map.setView([coords[1], coords[0]], 12);

                    // Clear previous search results
                    searchLayer.clearLayers();

                    // Add new marker
                    L.marker([coords[1], coords[0]])
                        .addTo(searchLayer)
                        .bindPopup(result.properties.name)
                        .openPopup();
                })
                .catch(err => console.error("Search error:", err));

        }, 400);
    });
}