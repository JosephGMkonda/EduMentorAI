import { useRef, useState, useCallback } from "react";

const CX = 230;
const CY = 150;
const SCALE = 3.5;

interface Force {
  angle: number;
  mag: number;
}

const InteractiveForce = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [f1, setF1] = useState<Force>({ angle: 0, mag: 6 });
  const [f2, setF2] = useState<Force>({ angle: 60, mag: 4 });
  const [dragging, setDragging] = useState<"f1" | "f2" | null>(null);

  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = 460 / rect.width;
    return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
  }, []);

  const updateForce = (key: "f1" | "f2", clientX: number, clientY: number) => {
    const p = toSvgPoint(clientX, clientY);
    const dx = p.x - CX;
    const dy = p.y - CY;
    const mag = Math.min(14, Math.max(1, Math.sqrt(dx * dx + dy * dy) / 22));
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (key === "f1") setF1({ angle, mag });
    else setF2({ angle, mag });
  };

  const onPointerMove = (e: React.PointerEvent<SVGElement>) => {
    if (!dragging) return;
    updateForce(dragging, e.clientX, e.clientY);
  };

  // Resultant
  const r1x = f1.mag * SCALE * Math.cos((f1.angle * Math.PI) / 180);
  const r1y = f1.mag * SCALE * Math.sin((f1.angle * Math.PI) / 180);
  const r2x = f2.mag * SCALE * Math.cos((f2.angle * Math.PI) / 180);
  const r2y = f2.mag * SCALE * Math.sin((f2.angle * Math.PI) / 180);
  const rx = r1x + r2x;
  const ry = r1y + r2y;
  const rMag = Math.hypot(rx, ry) / SCALE;
  const rAngle = (Math.atan2(ry, rx) * 180) / Math.PI;
  const RTip = { x: CX + rx, y: CY + ry };

  const drawForce = (f: Force, color: string, label: string, key: "f1" | "f2") => {
    const len = f.mag * SCALE;
    const rad = (f.angle * Math.PI) / 180;
    const tip = { x: CX + len * Math.cos(rad), y: CY + len * Math.sin(rad) };
    const headAngle = (f.angle * Math.PI) / 180;
    const h1 = {
      x: tip.x - 13 * Math.cos(headAngle) + 6 * Math.sin(headAngle),
      y: tip.y - 13 * Math.sin(headAngle) - 6 * Math.cos(headAngle),
    };
    const h2 = {
      x: tip.x - 13 * Math.cos(headAngle) - 6 * Math.sin(headAngle),
      y: tip.y - 13 * Math.sin(headAngle) + 6 * Math.cos(headAngle),
    };
    return (
      <g key={key}>
        <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke={color} strokeWidth="4" strokeLinecap="round" />
        <polygon points={`${tip.x},${tip.y} ${h1.x},${h1.y} ${h2.x},${h2.y}`} fill={color} />
        <circle cx={tip.x} cy={tip.y} r="12" fill="rgba(0,0,0,0)" className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            setDragging(key);
            (e.target as Element).setPointerCapture(e.pointerId);
            updateForce(key, e.clientX, e.clientY);
          }}
          onPointerMove={(e) => updateForce(key, e.clientX, e.clientY)}
          onPointerUp={(e) => {
            setDragging(null);
            (e.target as Element).releasePointerCapture(e.pointerId);
          }}
        />
        <circle cx={tip.x} cy={tip.y} r="7" fill={color} stroke="white" strokeWidth="2.5" pointerEvents="none" />
        <text x={tip.x} y={tip.y - 14} fontSize="14" fontWeight="bold" fill={color} textAnchor="middle">
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="select-none">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm text-slate-600">
          Drag the <span className="text-blue-600 font-semibold">blue</span> and{" "}
          <span className="text-green-600 font-semibold">green</span> arrow tips.
        </p>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <span className="text-blue-600">F\u2081 = {f1.mag.toFixed(1)} N</span>
          <span className="text-green-600">F\u2082 = {f2.mag.toFixed(1)} N</span>
          <span className="text-red-600">
            R = {rMag.toFixed(1)} N @ {rAngle.toFixed(0)}\u00b0
          </span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 460 300"
        className="w-full"
        style={{ touchAction: "none" }}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(null)}
      >
        <rect x="0" y="0" width="460" height="300" fill="#f8fafc" rx="12" />

        {/* dot grid */}
        {Array.from({ length: 15 }).map((_, i) =>
          Array.from({ length: 23 }).map((__, j) => (
            <circle key={`${i}-${j}`} cx={12 + j * 20} cy={12 + i * 20} r="1.5" fill="#cbd5e1" />
          )),
        )}

        {drawForce(f1, "#2563eb", `F\u2081 = ${f1.mag.toFixed(1)} N`, "f1")}
        {drawForce(f2, "#16a34a", `F\u2082 = ${f2.mag.toFixed(1)} N`, "f2")}

        {/* resultant */}
        <line
          x1={CX}
          y1={CY}
          x2={RTip.x}
          y2={RTip.y}
          stroke="#dc2626"
          strokeWidth="3"
          strokeDasharray="7 5"
          strokeLinecap="round"
        />
        <circle cx={RTip.x} cy={RTip.y} r="6" fill="#dc2626" stroke="white" strokeWidth="2" />

        <circle cx={CX} cy={CY} r="7" fill="#0f172a" />
      </svg>
    </div>
  );
};

export default InteractiveForce;
