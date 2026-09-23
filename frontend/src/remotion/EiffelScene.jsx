// The 3D finale: Paris. An orbiting, procedurally-built Eiffel Tower lit for
// an evening sky. Rotation and the intro rise are pure functions of the frame.
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { EiffelTower } from "./components/EiffelTower.jsx";

function Scene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slow, continuous turntable orbit.
  const spin = (frame / fps) * 0.35;

  // Intro: rise up and settle with a spring; tower centered on the origin.
  const rise = spring({ frame, fps, config: { damping: 200, mass: 1.2 }, durationInFrames: 45 });
  const y = interpolate(rise, [0, 1], [-9.5, -4.6]);
  const scale = interpolate(rise, [0, 1], [0.82, 1]);

  return (
    <>
      <ambientLight intensity={0.7} color="#ffe8c9" />
      <directionalLight position={[9, 13, 7]} intensity={1.3} color="#ffd9a0" />
      <directionalLight position={[-9, 6, -8]} intensity={0.6} color="#7aa2ff" />
      {/* Soft camera-side fill so the near lattice never falls to pure black. */}
      <directionalLight position={[0, 4, 16]} intensity={0.5} color="#ffd9b0" />
      <pointLight position={[0, 2, 6]} intensity={0.5} color="#ffb703" />

      <group position={[0, y, 0]} scale={scale}>
        <group rotation={[0, spin, 0]}>
          <EiffelTower />
          {/* esplanade */}
          <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[9, 48]} />
            <meshStandardMaterial color="#243244" metalness={0.2} roughness={0.9} />
          </mesh>
        </group>
      </group>
    </>
  );
}

export function EiffelScene() {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill>
      {/* Evening sky behind the transparent 3D canvas */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, #1a2547 0%, #5a3d6b 45%, #b6647a 75%, #f0a868 100%)",
        }}
      />
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 1.6, 17], fov: 42 }}
        gl={{ alpha: true }}
        style={{ position: "absolute", inset: 0, background: "transparent" }}
      >
        <Scene />
      </ThreeCanvas>

      <Label />
    </AbsoluteFill>
  );
}

function Label() {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [10, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        bottom: 64,
        opacity: appear,
        transform: `translateY(${interpolate(appear, [0, 1], [16, 0])}px)`,
        color: "#fff",
        fontFamily: "Inter, Arial, sans-serif",
        textShadow: "0 2px 14px rgba(0,0,0,0.55)",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 2, opacity: 0.85 }}>PARIS</div>
      <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.05 }}>Tour Eiffel</div>
    </div>
  );
}
