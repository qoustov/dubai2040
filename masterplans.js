// Registry of Masterplan Images
// Maps ProjectID (from dda_borders.js) to image config
const masterplans = {
    // Example Entry (linked to "AL WAHA" for testing)
    "a0DD000000E6W9eMAF": {
        imageUrl: "masterplans/placeholder_waha.jpg",
        // Optional manual bounds if the image doesn't match the polygon bbox exactly
        // bounds: [[25.0, 55.0], [25.1, 55.1]] 
    },
    // THE LAGOONS (Dubai Creek Harbour)
    "a0DD000000E65yZMAR": {
        imageUrl: "masterplans/emaar_creek_harbour.jpg",
        opacity: 0.9
    }
};
