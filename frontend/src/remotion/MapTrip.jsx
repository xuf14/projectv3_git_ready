// The 2D leg of the video: open on LA, pull back, then fly LA -> NY -> Paris
// with the camera tracking each arc's leading edge.
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { GeoMap } from "./components/GeoMap.jsx";
import { Arc } from "./components/Arc.jsx";
import { CityMarker } from "./components/CityMarker.jsx";
import { getCamera, getArcProgress } from "./lib/camera.js";
import { CITIES, TIMELINE } from "./lib/trip.js";

export function MapTrip() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const camera = getCamera(frame);
  const { laNy, nyParis } = getArcProgress(frame);

  // Markers pop in as each city becomes the destination.
  const laAppear = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const nyAppear = interpolate(laNy, [0.75, 1], [0, 1], { extrapolateLeft: "clamp" });
  const parisAppear = interpolate(nyParis, [0.8, 1], [0, 1], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#081521" }}>
      <GeoMap camera={camera} width={width} height={height}>
        {(projection) => (
          <>
            <Arc from={CITIES.LA.coord} to={CITIES.NY.coord} progress={laNy} projection={projection} />
            <Arc
              from={CITIES.NY.coord}
              to={CITIES.PARIS.coord}
              progress={nyParis}
              projection={projection}
              color="#ff8fab"
            />
            <CityMarker coord={CITIES.LA.coord} label="Los Angeles" projection={projection} appear={laAppear} />
            <CityMarker coord={CITIES.NY.coord} label="New York" projection={projection} appear={nyAppear} />
            <CityMarker coord={CITIES.PARIS.coord} label="Paris" projection={projection} appear={parisAppear} />
          </>
        )}
      </GeoMap>

      <Caption frame={frame} />
    </AbsoluteFill>
  );
}

// Small lower-third caption that names the current phase.
function Caption({ frame }) {
  let text = "";
  if (frame < TIMELINE.laZoomOut[1]) text = "Los Angeles";
  else if (frame < TIMELINE.legLaNy[1]) text = "Los Angeles  →  New York";
  else text = "New York  →  Paris";

  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        bottom: 56,
        padding: "12px 22px",
        borderRadius: 999,
        background: "rgba(8,21,33,0.66)",
        border: "1px solid rgba(255,255,255,0.14)",
        color: "#fff",
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: 0.5,
        backdropFilter: "blur(6px)",
      }}
    >
      {text}
    </div>
  );
}
