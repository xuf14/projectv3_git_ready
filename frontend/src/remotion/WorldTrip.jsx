// Full journey: the 2D map trip crossfading into the 3D Eiffel Tower finale.
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { MapTrip } from "./MapTrip.jsx";
import { EiffelScene } from "./EiffelScene.jsx";
import { MAP_DURATION, EIFFEL_DURATION } from "./lib/trip.js";

const OVERLAP = 14; // frames the two scenes crossfade over

function FadeIn({ frames, children }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, frames], [0, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

export function WorldTrip() {
  return (
    <AbsoluteFill style={{ backgroundColor: "#081521" }}>
      <Sequence durationInFrames={MAP_DURATION}>
        <MapTrip />
      </Sequence>
      <Sequence from={MAP_DURATION - OVERLAP} durationInFrames={EIFFEL_DURATION + OVERLAP}>
        <FadeIn frames={OVERLAP + 6}>
          <EiffelScene />
        </FadeIn>
      </Sequence>
    </AbsoluteFill>
  );
}
