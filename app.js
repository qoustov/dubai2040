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
const projectBoundsById = new Map();
const projectPolygonsById = new Map();

function extendBoundsFromGeoJSONCoordinates(bounds, coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return;
    if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
        // GeoJSON order is [lng, lat]
        bounds.extend([coordinates[1], coordinates[0]]);
        return;
    }
    coordinates.forEach((nested) => extendBoundsFromGeoJSONCoordinates(bounds, nested));
}

function addProjectPolygon(pid, polygonCoordinates) {
    const polygons = projectPolygonsById.get(pid) || [];
    polygons.push(polygonCoordinates);
    projectPolygonsById.set(pid, polygons);
}

function buildProjectGeometryIndex(featureCollection) {
    featureCollection.features.forEach((feature) => {
        const pid = feature?.properties?.ProjectID;
        const geometry = feature?.geometry;
        const coordinates = geometry?.coordinates;
        if (!pid || !geometry || !coordinates) return;

        if (geometry.type === "Polygon") {
            const mergedBounds = projectBoundsById.get(pid) || L.latLngBounds([]);
            extendBoundsFromGeoJSONCoordinates(mergedBounds, coordinates);
            projectBoundsById.set(pid, mergedBounds);
            addProjectPolygon(pid, coordinates);
            return;
        }

        if (geometry.type === "MultiPolygon") {
            const mergedBounds = projectBoundsById.get(pid) || L.latLngBounds([]);
            coordinates.forEach((polygonCoordinates) => {
                extendBoundsFromGeoJSONCoordinates(mergedBounds, polygonCoordinates);
                addProjectPolygon(pid, polygonCoordinates);
            });
            projectBoundsById.set(pid, mergedBounds);
        }
    });
}

buildProjectGeometryIndex(precisionData);

function toSvgPoint(bounds, coord) {
    const lng = coord[0];
    const lat = coord[1];

    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();

    const width = Math.max(east - west, 1e-12);
    const height = Math.max(north - south, 1e-12);

    const x = ((lng - west) / width) * 1000;
    const y = ((north - lat) / height) * 1000;
    return `${x.toFixed(3)} ${y.toFixed(3)}`;
}

function buildClipPathData(bounds, polygons) {
    const segments = [];
    polygons.forEach((polygon) => {
        if (!Array.isArray(polygon)) return;
        polygon.forEach((ring) => {
            if (!Array.isArray(ring) || ring.length < 3) return;
            const points = ring.map((coord) => toSvgPoint(bounds, coord));
            if (points.length < 3) return;
            segments.push(`M ${points.join(" L ")} Z`);
        });
    });
    return segments.join(" ");
}

function createClippedSvgOverlay(pid, imageUrl, bounds, polygons) {
    if (!bounds || !bounds.isValid()) return null;
    if (!imageUrl || !Array.isArray(polygons) || polygons.length === 0) return null;

    const pathData = buildClipPathData(bounds, polygons);
    if (!pathData) return null;

    const svgNS = "http://www.w3.org/2000/svg";
    const xlinkNS = "http://www.w3.org/1999/xlink";
    const safePid = String(pid || "masterplan").replace(/[^a-zA-Z0-9_-]/g, "_");
    const clipId = `mp_clip_${safePid}`;

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("xmlns", svgNS);
    svg.setAttribute("viewBox", "0 0 1000 1000");
    svg.setAttribute("preserveAspectRatio", "none");

    const defs = document.createElementNS(svgNS, "defs");
    const clipPath = document.createElementNS(svgNS, "clipPath");
    clipPath.setAttribute("id", clipId);

    const clipPathShape = document.createElementNS(svgNS, "path");
    clipPathShape.setAttribute("d", pathData);
    clipPathShape.setAttribute("fill", "#fff");
    clipPathShape.setAttribute("fill-rule", "evenodd");
    clipPath.appendChild(clipPathShape);
    defs.appendChild(clipPath);
    svg.appendChild(defs);

    const image = document.createElementNS(svgNS, "image");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("width", "1000");
    image.setAttribute("height", "1000");
    image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    image.setAttribute("href", imageUrl);
    image.setAttributeNS(xlinkNS, "href", imageUrl);
    image.setAttribute("clip-path", `url(#${clipId})`);
    svg.appendChild(image);

    return svg;
}

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
            const bounds = config.bounds
                ? L.latLngBounds(config.bounds)
                : (projectBoundsById.get(pid) || layer.getBounds());
            if (!bounds || !bounds.isValid()) return;

            const polygons = projectPolygonsById.get(pid) || [feature.geometry.coordinates];
            const svgElement = createClippedSvgOverlay(pid, config.imageUrl, bounds, polygons);
            if (!svgElement) return;

            const imageOverlay = L.svgOverlay(svgElement, bounds, {
                opacity: typeof config.opacity === "number" ? config.opacity : 0.9,
                interactive: false
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
