// ================================
// Base Pin Generator (Bigger + Perfectly Centered)
// ================================
function createPinIcon(symbol, color) {

    return L.divIcon({
        className: "",
        html: `
        <div style="position:relative;width:40px;height:55px;">
            <svg viewBox="0 0 24 36" width="40" height="55">
                <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"
                      fill="${color}"/>
                <circle cx="12" cy="12" r="7" fill="white"/>
            </svg>
            <div style="
                position:absolute;
                top:0;
                left:0;
                width:100%;
                height:24px;
                display:flex;
                align-items:center;
                justify-content:center;
                transform:translateY(6px);
                font-size:18px;
                font-weight:bold;
                color:${color};
            ">
                ${symbol}
            </div>
        </div>
        `,
        iconSize: [40, 55],
        iconAnchor: [20, 55],
        popupAnchor: [0, -45]
    });
}

// ================================
// Exported Category Icons
// ================================
export const hospitalIcon = createPinIcon("+", "#e53935");
export const restaurantIcon = createPinIcon("🍴", "#fb8c00");
export const hotelIcon = createPinIcon("H", "#1e88e5");