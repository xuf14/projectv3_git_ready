import { Composition } from "remotion";
import { WorldTrip } from "./WorldTrip.jsx";
import { MapTrip } from "./MapTrip.jsx";
import { EiffelScene } from "./EiffelScene.jsx";
import { MAP_DURATION, EIFFEL_DURATION, TOTAL_DURATION, FPS } from "./lib/trip.js";

const WIDTH = 1920;
const HEIGHT = 1080;

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="WorldTrip"
        component={WorldTrip}
        durationInFrames={TOTAL_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="MapTrip"
        component={MapTrip}
        durationInFrames={MAP_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="EiffelTower"
        component={EiffelScene}
        durationInFrames={EIFFEL_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
}
