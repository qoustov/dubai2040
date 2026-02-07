// 1. Initialize map with canvas rendering to reduce hover redraw flicker.
const map = L.map('map', {
    zoomControl: false,
    maxBoundsViscosity: 1.0,
    preferCanvas: true
}).setView([25.02, 55.15], 11);

// Satellite layer
const satellite = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}').addTo(map);

// 2. Data exploder: split MultiPolygons into individual Polygon features.
function explodeGeoJSON(data) {
    const explodedFeatures = [];
    data.features.forEach((feature) => {
        if (feature.geometry.type === "MultiPolygon") {
            feature.geometry.coordinates.forEach((polygonCoords) => {
                explodedFeatures.push({
                    type: "Feature",
                    properties: { ...feature.properties },
                    geometry: { type: "Polygon", coordinates: polygonCoords }
                });
            });
        } else {
            explodedFeatures.push(feature);
        }
    });
    return { type: "FeatureCollection", features: explodedFeatures };
}

const precisionData = explodeGeoJSON(ddaData);

// 3. Layer styles
const defaultStyle = { color: "#c1a35f", weight: 1, fillColor: "#c1a35f", fillOpacity: 0.15 };
const hoverStyle = { color: "#fff", weight: 3, fillColor: "#c1a35f", fillOpacity: 0.5 };

let currentHighlightedLayer = null;
let currentTooltipLayer = null;

const masterplanOverlayLayer = L.layerGroup();
const overlaysByProjectId = new Map();

function clearHighlight() {
    if (!currentHighlightedLayer) return;
    futureLayer.resetStyle(currentHighlightedLayer);
    currentHighlightedLayer = null;
}

function clearTooltip() {
    if (!currentTooltipLayer) return;
    currentTooltipLayer.closeTooltip();
    currentTooltipLayer = null;
}

function setHighlight(layer) {
    if (currentHighlightedLayer === layer) return;
    clearHighlight();
    layer.setStyle(hoverStyle);
    currentHighlightedLayer = layer;
}

function showTooltip(layer, latlng) {
    if (currentTooltipLayer !== layer) {
        clearTooltip();
        layer.openTooltip(latlng);
        currentTooltipLayer = layer;
        return;
    }
    layer.setTooltipLatLng(latlng);
}

function clearInteractionState() {
    clearHighlight();
    clearTooltip();
}

// 4. Create interactive polygon layer
const futureLayer = L.geoJSON(precisionData, {
    style: function (feature) {
        const pid = feature.properties.ProjectID;
        if (masterplans && masterplans[pid]) {
            return { ...defaultStyle, fillOpacity: 0.1, color: '#00ffff', weight: 2 };
        }
        return defaultStyle;
    },
    onEachFeature: function (feature, layer) {
        const name = feature.properties.ProjectName || "DDA Area";
        const pid = feature.properties.ProjectID;

        if (masterplans && masterplans[pid] && !overlaysByProjectId.has(pid)) {
            const config = masterplans[pid];
            const bounds = config.bounds ? L.latLngBounds(config.bounds) : layer.getBounds();
            const imageOverlay = L.imageOverlay(config.imageUrl, bounds, {
                opacity: typeof config.opacity === "number" ? config.opacity : 0.9,
                interactive: false,
                zIndex: 100
            });
            overlaysByProjectId.set(pid, imageOverlay);
            masterplanOverlayLayer.addLayer(imageOverlay);
        }

        layer.bindTooltip(name, {
            sticky: false,
            direction: 'top',
            className: 'community-label',
            opacity: 1
        });

        layer.on({
            mouseover: function (e) {
                setHighlight(layer);
                showTooltip(layer, e.latlng);
            },
            mousemove: function (e) {
                showTooltip(layer, e.latlng);
            },
            mouseout: function () {
                if (currentHighlightedLayer === layer) clearHighlight();
                if (currentTooltipLayer === layer) clearTooltip();
            }
        });
    }
}).addTo(map);

masterplanOverlayLayer.addTo(map);

map.on('zoomstart', clearTooltip);
map.on('mouseout', clearInteractionState);

// 5. Switcher logic
const toggle = document.getElementById('visionToggle');

toggle.addEventListener('change', function (e) {
    clearInteractionState();
    if (e.target.checked) {
        map.addLayer(masterplanOverlayLayer);
        map.addLayer(futureLayer);
        document.getElementById('map').style.filter = "saturate(1.1)";
    } else {
        map.removeLayer(futureLayer);
        map.removeLayer(masterplanOverlayLayer);
        document.getElementById('map').style.filter = "none";
    }
});
