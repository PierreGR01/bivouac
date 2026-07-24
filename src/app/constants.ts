export const MAP_CENTER = { lat: 45.188529, lng: 5.724524 };
export const MAP_DEFAULT_ZOOM = 12;

export const MOBILE_BREAKPOINT_PX = 768;

export const WATER_PROXIMITY_NEAR_M = 100;
export const WATER_PROXIMITY_FAR_M = 200;

// Rayon (~300m) utilisé pour charger les points d'eau autour d'un nouveau spot
export const WATER_LOADING_RADIUS_DEG = 0.003;

export const DEFAULT_ROUTE_DISTANCE_M = 200;

// Bbox utilisée pour le premier chargement des spots, avant que la carte n'ait
// remonté ses vraies limites de viewport (aucun `moveend` encore reçu) — couvre la
// France métropolitaine avec marge.
export const DEFAULT_POIS_BBOX = { south: 41, west: -5.5, north: 51.5, east: 10.5 };
