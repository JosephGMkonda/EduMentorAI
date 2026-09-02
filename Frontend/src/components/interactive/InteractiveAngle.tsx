import { useRef, useState, useCallback } from "react";

const VX = 80;
const VY = 235;
const R = 225;

const toDeg = (dx: number, dy: number) => {
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
};

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const rad = (a: number) => (a * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(a0));
  const y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1));
  const y1 = cy + r * Math.sin(rad(a1));
  const large = a1 - a0 > 180 ? 1 : 0;
  const sweep = a1 - a0 >= 0 ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

const classify = (deg: number) => {
  if (deg < 90) return "Acute angle";
  if (deg === 90) return "Right angle";
  if (deg < 180) return "Obtuse angle";
  if (deg === 180) return "Straight angle";
  if (deg < 360) return "Reflex angle";
  return "Full rotation";
};

const InteractiveAngle = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [theta, setTheta] = useState(47);

  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = 460 / rect.width;
    return {
      x: (clientX - rect.left) * scale,
      y: (clientY - rect.top) * scale,
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<SVGCircleElement>) => {
    const p = toSvgPoint(e.clientX, e.clientY);
    setTheta(toDeg(p.x - VX, p.y - VY));
  };

  const tipX = VX + R * Math.cos((theta * Math.PI) / 180);
  const tipY = VY + R * Math.sin((theta * Math.PI) / 180);
  const labelX = VX + 92 * Math.cos((theta * Math.PI) / 360);
  const labelY = VY + 92 * Math.sin((theta * Math.PI) / 360);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 460 300"
      className="w-full select-none"
      style={{ touchAction: "none" }}
    >
      <rect x="0" y="0" width="460" height="300" fill="#f8fafc" rx="12" />

      <text x="230" y="30" fontSize="20" fontWeight="bold" fill="#0f172a" textAnchor="middle">
        {Math.round(theta)}\u00b0
      </text>
      <text x="230" y="52" fontSize="14" fill="#64748b" textAnchor="middle">
        {classify(theta)} &mdash; drag the red dot
      </text>

      <line
        x1={VX}
        y1={VY}
        x2={VX + R}
        y2={VY}
        stroke="#94a3b8"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <path
        d={arcPath(VX, VY, 70, 0, theta)}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="3"
      />
      <text x={labelX} y={labelY} fontSize="15" fill="#0284c7" textAnchor="middle" fontWeight="bold">
        {Math.round(theta)}\u00b0
      </text>

      <line
        x1={VX}
        y1={VY}
        x2={tipX}
        y2={tipY}
        stroke="#dc2626"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <circle cx={VX} cy={VY} r="7" fill="#0f172a" />
      <text x={VX + 10} y={VY - 12} fontSize="15" fill="#0f172a" fontWeight="bold">
        O
      </text>

      <circle
        cx={tipX}
        cy={tipY}
        r="13"
        fill="rgba(220,38,38,0.15)"
        stroke="none"
        className="cursor-grab active:cursor-grabbing"
      />
      <circle
        cx={tipX}
        cy={tipY}
        r="9"
        fill="#dc2626"
        stroke="white"
        strokeWidth="2.5"
        className="cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => {
          (e.target as Element).releasePointerCapture(e.pointerId);
        }}
      />
    </svg>
  );
};

export default InteractiveAngle;
