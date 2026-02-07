// Registry of Masterplan Images
// Maps ProjectID (from dda_borders.js) to image config
const masterplans = {
    // Example Entry (linked to "AL WAHA" for testing)
    "a0DD000000E6W9eMAF": {
        imageUrl: "masterplans/placeholder_waha.jpg",
        // Manual project bounds: [[south, west], [north, east]]
        bounds: [[25.026781520435005, 55.283966042000586], [25.031373735936743, 55.289331072417411]],
        // Stretch image to fully fill project extent before polygon clipping.
        imageFit: "none"
    },
    // THE LAGOONS (Dubai Creek Harbour)
    "a0D6F00000ec7SeUAI": {
        imageUrl: "masterplans/emaar_creek_harbour.jpg",
        bounds: [[25.186210131472652, 55.339309615036349], [25.211093027431509, 55.369726499571591]],
        opacity: 0.9,
        imageFit: "none"
    }
};
