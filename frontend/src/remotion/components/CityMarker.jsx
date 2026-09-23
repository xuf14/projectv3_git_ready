// A pin + label anchored to a projected [lng, lat] point. `appear` (0..1)
// pops the marker in with a small spring-like scale.
export function CityMarker({ coord, label, projection, appear = 1 }) {
  const [x, y] = projection(coord);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const scale = appear;
  const r = 5;

  return (
    <g transform={`translate(${x} ${y})`} opacity={appear}>
      <g transform={`scale(${scale})`} style={{ transformOrigin: "center" }}>
        <circle r={r * 2.4} fill="#ffd166" opacity={0.18} />
        <circle r={r} fill="#ffd166" stroke="#fff" strokeWidth={1.5} />
      </g>
      {appear > 0.6 ? (
        <text
          x={12}
          y={5}
          fill="#fff"
          fontSize={22}
          fontWeight={700}
          fontFamily="Inter, Arial, sans-serif"
          style={{ paintOrder: "stroke", stroke: "#0a1a2b", strokeWidth: 4 }}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}
