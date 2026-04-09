import { map } from "./map.js";
import { setStatus } from "./ui.js";

// ================================
// EV Icon
// ================================
const evIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/1048/1048315.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28]
});

// ================================
// EV Marker Layer
// ================================
export const stationMarkers = L.markerClusterGroup();
map.addLayer(stationMarkers);

// ================================
// Load EV Stations
// ================================
export function loadEVStations() {

    const bounds = map.getBounds();

    const url = `/api/ev/stations?south=${bounds.getSouth()}&west=${bounds.getWest()}&north=${bounds.getNorth()}&east=${bounds.getEast()}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {

            stationMarkers.clearLayers();

            if (!data || data.length === 0) {
                setStatus("No EV stations found in this area");
                return;
            }

            data.forEach(station => {

                if (!station.AddressInfo) return;

                const lat = station.AddressInfo.Latitude;
                const lng = station.AddressInfo.Longitude;

                const title = station.AddressInfo.Title || "EV Charging Station";
                const address = station.AddressInfo.AddressLine1 || "";
                const town = station.AddressInfo.Town || "";

                const marker = L.marker([lat, lng], { icon: evIcon })
                    .bindPopup(`
                        <strong>${title}</strong><br>
                        ${address}<br>
                        ${town}<br><br>
                        <button 
                            class="route-btn"
                            data-lat="${lat}"
                            data-lng="${lng}"
                            data-name="${title}">
                            Get Directions
                        </button>
                    `);

                stationMarkers.addLayer(marker);
            });

            setStatus(`${data.length} EV stations found`);
        })
        .catch(err => {
            console.error("EV fetch error:", err);
            setStatus("Error loading EV stations");
        });
}