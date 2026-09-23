// Derives the map camera (projection center + zoom) for any frame, plus the
// draw progress of each flight arc. Everything is a pure function of `frame`
// so the render is deterministic.
import { interpolate, Easing } from "remotion";
import { CITIES, TIMELINE, CAMERA } from "./trip.js";
import { greatCircle } from "./geo.js";

const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);

// Zoom feels natural when interpolated in log space (perceptual, not linear).
function lerpZoom(a, b, t) {
  return Math.exp(interpolate(t, [0, 1], [Math.log(a), Math.log(b)]));
}

function phaseProgress(frame, [start, end], easing = easeInOut) {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

const arcLaNy = greatCircle(CITIES.LA.coord, CITIES.NY.coord);
const arcNyParis = greatCircle(CITIES.NY.coord, CITIES.PARIS.coord);

// Progress (0..1) of each arc's line-drawing, for the arc renderer to share.
export function getArcProgress(frame) {
  return {
    laNy: phaseProgress(frame, TIMELINE.legLaNy),
    nyParis: phaseProgress(frame, TIMELINE.legNyParis),
  };
}

export function getCamera(frame) {
  const { laZoomOut, legLaNy, legNyParis } = TIMELINE;

  // Phase 1: pull back from a tight LA framing, LA stays dead center.
  if (frame < laZoomOut[1]) {
    const t = phaseProgress(frame, laZoomOut, Easing.out(Easing.cubic));
    return {
      center: CAMERA.laTight.center,
      zoom: lerpZoom(CAMERA.laTight.zoom, CAMERA.laWide.zoom, t),
    };
  }

  // Phase 2: chase the LA -> NY arc tip; dip out for context, tighten on arrival.
  if (frame < legLaNy[1]) {
    const p = phaseProgress(frame, legLaNy);
    const center = arcLaNy(p);
    // 0 -> 0.5 zoom out to usWide, 0.5 -> 1 zoom in on NY.
    const zoom =
      p < 0.5
        ? lerpZoom(CAMERA.laWide.zoom, CAMERA.usWide.zoom, p / 0.5)
        : lerpZoom(CAMERA.usWide.zoom, CAMERA.ny.zoom, (p - 0.5) / 0.5);
    return { center, zoom };
  }

  // Phase 3: cross the Atlantic to Paris; wide over the ocean, slam into Paris.
  if (frame < legNyParis[1]) {
    const p = phaseProgress(frame, legNyParis);
    const center = arcNyParis(p);
    const zoom =
      p < 0.5
        ? lerpZoom(CAMERA.ny.zoom, CAMERA.atlantic.zoom, p / 0.5)
        : lerpZoom(CAMERA.atlantic.zoom, CAMERA.paris.zoom, (p - 0.5) / 0.5);
    return { center, zoom };
  }

  // Held on Paris (until the scene hands off to the 3D tower).
  return { center: CAMERA.paris.center, zoom: CAMERA.paris.zoom };
}
