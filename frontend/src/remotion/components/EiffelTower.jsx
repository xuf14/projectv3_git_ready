// A procedural Eiffel Tower built from an iron-lattice truss so it reads
// clearly in 3D from any orbit angle. Units are arbitrary; the tower is ~10 tall.
import { useMemo } from "react";
import * as THREE from "three";

const IRON = "#8a6a44";
const UP = new THREE.Vector3(0, 1, 0);

// One thin box beam spanning points a -> b.
function Strut({ a, b, w = 0.05, color = IRON }) {
  const { position, quaternion, length } = useMemo(() => {
    const A = new THREE.Vector3(a[0], a[1], a[2]);
    const B = new THREE.Vector3(b[0], b[1], b[2]);
    const dir = new THREE.Vector3().subVectors(B, A);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    return { position: mid.toArray(), quaternion: [q.x, q.y, q.z, q.w], length: len };
  }, [a, b]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <boxGeometry args={[w, length, w]} />
      <meshStandardMaterial color={color} metalness={0.65} roughness={0.45} />
    </mesh>
  );
}

// The four corners of a square "ring" at height y with half-width hw.
function corners(y, hw) {
  return [
    [hw, y, hw],
    [hw, y, -hw],
    [-hw, y, -hw],
    [-hw, y, hw],
  ];
}

// A lattice section: vertical posts, horizontal ring beams, and diagonal
// cross-braces between successive rings — the see-through iron truss.
function Lattice({ rings, w = 0.05 }) {
  const struts = useMemo(() => {
    const out = [];
    for (let i = 0; i < rings.length; i++) {
      const c = corners(rings[i].y, rings[i].hw);
      // horizontal beams around this ring
      for (let k = 0; k < 4; k++) out.push([c[k], c[(k + 1) % 4]]);
      if (i < rings.length - 1) {
        const n = corners(rings[i + 1].y, rings[i + 1].hw);
        for (let k = 0; k < 4; k++) {
          out.push([c[k], n[k]]); // vertical post
          out.push([c[k], n[(k + 1) % 4]]); // diagonal brace
        }
      }
    }
    return out;
  }, [rings]);

  return struts.map(([a, b], i) => <Strut key={i} a={a} b={b} w={w} />);
}

// A decorative half-arch on one base face (the iconic ground arches).
function Arch({ radius = 2.2, position, rotationY = 0 }) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <torusGeometry args={[radius, 0.12, 10, 28, Math.PI]} />
      <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.5} />
    </mesh>
  );
}

function Platform({ y, half, thickness = 0.18 }) {
  return (
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[half * 2, thickness, half * 2]} />
      <meshStandardMaterial color="#6f5433" metalness={0.5} roughness={0.5} />
    </mesh>
  );
}

export function EiffelTower() {
  // Leg section: wide, curving inward toward the second platform.
  const legRings = useMemo(() => {
    const ys = [0, 0.8, 1.6, 2.5, 3.2, 4.0];
    return ys.map((y) => ({ y, hw: 0.6 + 2.4 * Math.pow((4.0 - y) / 4.0, 1.7) }));
  }, []);

  // Upper shaft: straight, tapering to the top deck.
  const shaftRings = useMemo(() => {
    const ys = [4.0, 5.1, 6.2, 7.3, 8.4];
    return ys.map((y) => ({ y, hw: 0.16 + 0.44 * Math.pow((8.4 - y) / 4.4, 1.25) }));
  }, []);

  return (
    <group>
      <Lattice rings={legRings} w={0.06} />
      <Lattice rings={shaftRings} w={0.045} />

      {/* Base arches on all four faces */}
      <Arch position={[0, 0, 2.9]} />
      <Arch position={[0, 0, -2.9]} />
      <Arch position={[2.9, 0, 0]} rotationY={Math.PI / 2} />
      <Arch position={[-2.9, 0, 0]} rotationY={Math.PI / 2} />

      {/* Observation platforms */}
      <Platform y={1.6} half={1.75} />
      <Platform y={4.0} half={0.95} thickness={0.16} />

      {/* Top deck + antenna */}
      <mesh position={[0, 8.55, 0]}>
        <boxGeometry args={[0.5, 0.45, 0.5]} />
        <meshStandardMaterial color="#6f5433" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 9.5, 0]}>
        <cylinderGeometry args={[0.04, 0.07, 1.5, 8]} />
        <meshStandardMaterial color={IRON} metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 10.35, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#ffd166" emissive="#ffb703" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}
