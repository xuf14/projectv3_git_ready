// Shared trip data: cities, timeline, and camera keyframes.
// Coordinates are [longitude, latitude] to match d3-geo conventions.

export const CITIES = {
  LA: { name: "Los Angeles", coord: [-118.2437, 34.0522] },
  NY: { name: "New York", coord: [-74.006, 40.7128] },
  PARIS: { name: "Paris", coord: [2.3522, 48.8566] },
};

// Canonical route the camera travels along.
export const LEGS = [
  { from: "LA", to: "NY" },
  { from: "NY", to: "PARIS" },
];

export const FPS = 30;

// Timeline in frames (at 30fps). Each phase is [start, end).
export const TIMELINE = {
  // Open tight on LA, then pull the camera back while keeping LA centered.
  laZoomOut: [0, 90],
  // Draw the LA -> NY arc while the camera tracks the leading edge.
  legLaNy: [90, 240],
  // Cross the Atlantic to Paris.
  legNyParis: [240, 390],
  // Hand off to the 3D Eiffel Tower scene (rendered as its own sequence).
  eiffel: [390, 570],
};

export const MAP_DURATION = TIMELINE.eiffel[0]; // frames the 2D map is on screen
export const EIFFEL_DURATION = TIMELINE.eiffel[1] - TIMELINE.eiffel[0];
export const TOTAL_DURATION = TIMELINE.eiffel[1];

// Camera = the d3 projection center [lng, lat] + a zoom scale.
// These are the anchor values the map interpolates between.
export const CAMERA = {
  laTight: { center: CITIES.LA.coord, zoom: 2600 },
  laWide: { center: CITIES.LA.coord, zoom: 900 },
  usWide: { center: [-96, 38], zoom: 620 },
  ny: { center: CITIES.NY.coord, zoom: 1400 },
  atlantic: { center: [-38, 46], zoom: 300 },
  paris: { center: CITIES.PARIS.coord, zoom: 2600 },
};
