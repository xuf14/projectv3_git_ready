// A great-circle flight path that draws itself from `from` to `to` as
// `progress` goes 0 -> 1, with a glowing dot riding the leading edge.
import { useMemo } from "react";
import { greatCircle } from "../lib/geo.js";

const SAMPLES = 96;

export function Arc({ from, to, progress, projection, color = "#ffd166" }) {
  const interp = useMemo(() => greatCircle(from, to), [from, to]);

  const { d, tip } = useMemo(() => {
    if (progress <= 0) return { d: "", tip: null };
    const steps = Math.max(2, Math.round(SAMPLES * progress));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * progress;
      pts.push(projection(interp(t)));
    }
    const path = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join(" ");
    return { d: path, tip: pts[pts.length - 1] };
  }, [progress, projection, interp]);

  if (!d) return null;

  return (
    <g filter="url(#arcGlow)">
      <path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.95} />
      {tip && progress < 1 ? (
        <circle cx={tip[0]} cy={tip[1]} r={6} fill="#fff" stroke={color} strokeWidth={2} />
      ) : null}
    </g>
  );
}
