// Renders the world as SVG country shapes for a given camera.
import { useMemo } from "react";
import { COUNTRIES, makeProjection, makePath } from "../lib/geo.js";

export function GeoMap({ camera, width, height, children }) {
  const projection = useMemo(
    () => makeProjection(camera, width, height),
    [camera.center[0], camera.center[1], camera.zoom, width, height]
  );

  const paths = useMemo(() => {
    const path = makePath(projection);
    return COUNTRIES.features.map((f) => path(f));
  }, [projection]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <radialGradient id="ocean" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor="#132b45" />
          <stop offset="100%" stopColor="#081521" />
        </radialGradient>
        <filter id="arcGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x={0} y={0} width={width} height={height} fill="url(#ocean)" />

      <g>
        {paths.map((d, i) =>
          d ? (
            <path
              key={i}
              d={d}
              fill="#20456b"
              stroke="#3d6d99"
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
          ) : null
        )}
      </g>

      {/* City markers + arcs are drawn in the same projected space. */}
      {typeof children === "function" ? children(projection) : children}
    </svg>
  );
}
