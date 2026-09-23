// World geometry + projection helpers built on d3-geo.
// Loaded once at module scope so rendering stays deterministic and cheap.
import { geoMercator, geoPath, geoInterpolate, geoDistance } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-50m.json";

const collection = feature(world, world.objects.countries);

// Drop Antarctica: it wastes vertical space and never appears on this route.
export const COUNTRIES = {
  type: "FeatureCollection",
  features: collection.features.filter((f) => f.properties.name !== "Antarctica"),
};

// Build a Mercator projection for a given camera (center + zoom) and canvas.
export function makeProjection({ center, zoom }, width, height) {
  return geoMercator()
    .center(center)
    .scale(zoom)
    .translate([width / 2, height / 2]);
}

export function makePath(projection) {
  return geoPath(projection);
}

// Great-circle interpolation between two [lng, lat] points.
export function greatCircle(a, b) {
  return geoInterpolate(a, b);
}

export function arcAngle(a, b) {
  return geoDistance(a, b); // radians
}
