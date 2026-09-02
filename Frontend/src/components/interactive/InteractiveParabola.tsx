import { useRef, useState, useCallback } from "react";

const W = 460;
const H = 300;
const LEFT = 55;
const RIGHT = 20;
const TOP = 20;
const BOTTOM = 40;
const XRANGE = 6;

const InteractiveParabola = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [a, setA] = useState(1);
  const [b, setB] = useState(-2);
  const [c, setC] = useState(-3);

  const pw = W - LEFT - RIGHT;
  const ph = H - TOP - BOTTOM;

  const xToPx = (x: number) => LEFT + ((x + XRANGE) / (2 * XRANGE)) * pw;
  const yMin = -10;
  const yMax = 14;
  const yToPx = (y: number) => TOP + ((yMax - y) / (yMax - yMin)) * ph;

  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = W / rect.width;
    return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
  }, []);

  const setFromVertex = (vx: number, vy: number) => {
    // b = -2a*h, c = a*h^2 + k  where (h,k) is the dragged vertex
    setB(-2 * a * vx);
    setC(a * vx * vx + vy);
  };

  const onVertexDrag = (e: React.PointerEvent<SVGCircleElement>) => {
    const p = toSvgPoint(e.clientX, e.clientY);
    const gx = (p.x - LEFT) / pw * (2 * XRANGE) - XRANGE;
    const gy = yMax - ((p.y - TOP) / ph) * (yMax - yMin);
    setFromVertex(Math.max(-XRANGE + 0.2, Math.min(XRANGE - 0.2, gx)), Math.max(yMin + 0.2, Math.min(yMax - 0.2, gy)));
  };

  const vx = -b / (2 * a);
  const vy = a * vx * vx + b * vx + c;

  const disc = b * b - 4 * a * c;
  const roots: number[] = [];
  if (disc >= 0) {
    const r1 = (-b - Math.sqrt(disc)) / (2 * a);
    const r2 = (-b + Math.sqrt(disc)) / (2 * a);
    roots.push(r1, r2);
  }

  const pts: string[] = [];
  for (let i = 0; i <= 240; i++) {
    const x = -XRANGE + ((2 * XRANGE) / 240) * i;
    const y = a * x * x + b * x + c;
    pts.push(`${xToPx(x).toFixed(1)},${yToPx(y).toFixed(1)}`);
  }
  const path = "M" + pts.join(" L");

  const x0 = xToPx(0);
  const y0 = yToPx(0);

  return (
    <div className="select-none">
      <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">a =</span>
          <input
            type="range"
            min={-3}
            max={3}
            step={0.1}
            value={a}
            onChange={(e) => setA(Number(e.target.value))}
            className="w-32 accent-sky-500"
          />
          <span className="font-mono text-sky-700 font-semibold w-10">{a.toFixed(1)}</span>
        </label>
        <p className="text-slate-500 text-xs">
          Drag the <span className="text-emerald-600 font-semibold">green vertex</span> too &mdash; the
          curve follows.
        </p>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ touchAction: "none" }}
      >
        <rect x="0" y="0" width={W} height={H} fill="#f8fafc" rx="12" />

        {/* grid */}
        {Array.from({ length: 13 }).map((_, i) => {
          const gx = LEFT + (i / 12) * pw;
          return <line key={`gx${i}`} x1={gx} y1={TOP} x2={gx} y2={TOP + ph} stroke="#e2e8f0" strokeWidth="1" />;
        })}
        {Array.from({ length: 13 }).map((_, i) => {
          const gy = TOP + (i / 12) * ph;
          return <line key={`gy${i}`} x1={LEFT} y1={gy} x2={LEFT + pw} y2={gy} stroke="#e2e8f0" strokeWidth="1" />;
        })}

        {/* axes */}
        <line x1={LEFT} y1={y0} x2={LEFT + pw} y2={y0} stroke="#334155" strokeWidth="2" />
        <line x1={x0} y1={TOP} x2={x0} y2={TOP + ph} stroke="#334155" strokeWidth="2" />
        <text x={LEFT + pw - 4} y={y0 + 18} fontSize="12" fill="#334155" textAnchor="end">x</text>
        <text x={x0 + 6} y={TOP + 12} fontSize="12" fill="#334155">y</text>

        {/* tick labels */}
        {[-4, -2, 2, 4].map((t) => (
          <text key={`tx${t}`} x={xToPx(t)} y={y0 + 16} fontSize="10" fill="#94a3b8" textAnchor="middle">
            {t}
          </text>
        ))}
        {[2, 4, 6, 8, 10, 12].map((t) => (
          <text key={`ty${t}`} x={x0 - 6} y={yToPx(t) + 4} fontSize="10" fill="#94a3b8" textAnchor="end">
            {t}
          </text>
        ))}

        {/* curve */}
        <path d={path} fill="none" stroke="#2563eb" strokeWidth="3" />

        {/* roots */}
        {roots.map((r) => (
          <g key={r}>
            <circle cx={xToPx(r)} cy={y0} r="5" fill="#dc2626" stroke="white" strokeWidth="1.5" />
            <text x={xToPx(r)} y={y0 - 10} fontSize="11" fill="#dc2626" textAnchor="middle">
              ({r.toFixed(1)}, 0)
            </text>
          </g>
        ))}

        {/* vertex */}
        <circle
          cx={xToPx(vx)}
          cy={yToPx(vy)}
          r="12"
          fill="rgba(22,163,74,0.2)"
          className="cursor-grab active:cursor-grabbing"
        />
        <circle
          cx={xToPx(vx)}
          cy={yToPx(vy)}
          r="7"
          fill="#16a34a"
          stroke="white"
          strokeWidth="2.5"
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            onVertexDrag(e);
          }}
          onPointerMove={onVertexDrag}
          onPointerUp={(e) => {
            (e.target as Element).releasePointerCapture(e.pointerId);
          }}
        />
        <text x={xToPx(vx)} y={yToPx(vy) - 12} fontSize="12" fontWeight="bold" fill="#16a34a" textAnchor="middle">
          ({vx.toFixed(1)}, {vy.toFixed(1)})
        </text>
      </svg>
    </div>
  );
};

export default InteractiveParabola;
