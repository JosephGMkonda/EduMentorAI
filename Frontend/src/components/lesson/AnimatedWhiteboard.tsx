import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaPencilAlt, FaRedo } from "react-icons/fa";
import { subscribeActiveParts } from "./diagramSync";

interface Props {
  code: string;
}

const NS = "http://www.w3.org/2000/svg";

const sanitizeSvg = (svg: string): string => {
  let clean = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s(href|xlink:href)\s*=\s*"javascript:[^"]*"/gi, "");
  const match = clean.match(/<svg[\s\S]*<\/svg>/i);
  return match ? match[0] : clean;
};

const estimateLength = (el: Element): number => {
  const a = (name: string) => Number(el.getAttribute(name)) || 0;
  switch (el.tagName.toLowerCase()) {
    case "line":
      return Math.hypot(a("x2") - a("x1"), a("y2") - a("y1"));
    case "rect":
      return 2 * (a("width") + a("height"));
    case "circle":
      return 2 * Math.PI * a("r");
    case "ellipse":
      return Math.PI * (a("rx") + a("ry"));
    case "polyline":
    case "polygon": {
      const pts = (el.getAttribute("points") || "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      let len = 0;
      for (let i = 2; i < pts.length; i += 2) {
        len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
      }
      return len;
    }
    default:
      return 100;
  }
};

// The SVG is rendered through dangerouslySetInnerHTML and then animated by
// mutating the parsed DOM directly. It lives in a memoized child so that
// parent re-renders (done/activePart state) never re-parse the innerHTML and
// wipe those mutations. Replay remounts it by changing its React key.
const WhiteboardSvg = memo(function WhiteboardSvg({
  svg,
  wrapRef,
}: {
  svg: string;
  wrapRef: React.RefObject<HTMLDivElement | null>;
}) {
  return <div ref={wrapRef} dangerouslySetInnerHTML={{ __html: svg }} />;
});

const AnimatedWhiteboard = ({ code }: Props) => {
  const svg = useMemo(() => sanitizeSvg(code), [code]);
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<Map<number, SVGElement[]>>(new Map());
  const [runKey, setRunKey] = useState(0);
  const [done, setDone] = useState(true);
  const [activePart, setActivePart] = useState(0);

  const geomsRef = useRef<{ el: SVGGeometryElement; part: number }[]>([]);
  const textsRef = useRef<{ el: SVGTextElement; part: number }[]>([]);
  const badgesRef = useRef<{ el: SVGElement; part: number }[]>([]);
  const drawnGeomRef = useRef<Set<SVGGeometryElement>>(new Set());
  const drawnTextRef = useRef<Set<SVGTextElement>>(new Set());
  const drawnBadgeRef = useRef<Set<SVGElement>>(new Set());
  const nextDelayRef = useRef(0);
  const maxDelayRef = useRef(0);
  const startedRef = useRef(false);
  const forceAllRef = useRef(false);
  const prevSvgRef = useRef("");
  const activePartRef = useRef(0);
  const doneTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const partOf = (el: Element): number => {
    let cur: Element | null = el;
    while (cur && cur.tagName.toLowerCase() !== "svg") {
      const n = Number(cur.getAttribute("data-part"));
      if (Number.isFinite(n) && n > 0) return n;
      cur = cur.parentElement;
    }
    return 0;
  };

  // Draw every not-yet-drawn element whose part number is <= targetPart.
  // Delays come from a running counter, so elements in a batch are staggered
  // smoothly; because each part is only scheduled when its legend entry is
  // read, the drawing paces itself to the narration automatically.
  const scheduleUpTo = useCallback((targetPart: number) => {
    const geoms = geomsRef.current;
    const texts = textsRef.current;
    const badges = badgesRef.current;
    if (!geoms.length && !texts.length) return;
    const stagger =
      geoms.length <= 1 ? 0 : Math.max(20, Math.min(320, 4000 / geoms.length));

    let scheduledAny = false;
    let maxDelay = maxDelayRef.current;

    for (const { el, part } of geoms) {
      if (part > targetPart || drawnGeomRef.current.has(el)) continue;
      const stroke = el.getAttribute("stroke");
      const hasStroke = !!stroke && stroke.toLowerCase() !== "none";
      const fill = el.getAttribute("fill");
      const hasFill = !!fill && fill.toLowerCase() !== "none";
      const d1 = nextDelayRef.current * stagger;

      if (hasStroke) {
        let len = 0;
        try {
          len = el.getTotalLength ? el.getTotalLength() : 0;
        } catch {
          len = 0;
        }
        if (!len || !isFinite(len)) len = estimateLength(el);
        if (len > 0.5) {
          const drawMs = Math.round(Math.max(120, Math.min(800, len * 3)));
          const d2 = d1 + drawMs;
          el.style.visibility = "visible";
          el.style.setProperty("--edm-len", len.toFixed(2));
          el.style.setProperty("--edm-d1", `${d1}ms`);
          el.style.setProperty("--edm-d2", `${d2}ms`);
          el.style.setProperty("--edm-ms", `${drawMs}ms`);
          el.classList.add("edm-draw");
          maxDelay = Math.max(maxDelay, d2 + drawMs);
          scheduledAny = true;
        } else if (hasFill) {
          el.style.visibility = "visible";
          el.style.setProperty("--edm-d1", `${d1}ms`);
          el.classList.add("edm-fillonly");
          maxDelay = Math.max(maxDelay, d1 + 350);
          scheduledAny = true;
        }
      } else if (hasFill) {
        el.style.visibility = "visible";
        el.style.setProperty("--edm-d1", `${d1}ms`);
        el.classList.add("edm-fillonly");
        maxDelay = Math.max(maxDelay, d1 + 350);
        scheduledAny = true;
      }
      drawnGeomRef.current.add(el);
      nextDelayRef.current += 1;
    }

    for (const { el, part } of texts) {
      if (part > targetPart || drawnTextRef.current.has(el)) continue;
      const d1 = nextDelayRef.current * stagger;
      el.style.visibility = "visible";
      el.style.setProperty("--edm-d1", `${d1}ms`);
      el.classList.add("edm-fade");
      maxDelay = Math.max(maxDelay, d1 + 400);
      drawnTextRef.current.add(el);
      nextDelayRef.current += 1;
      scheduledAny = true;
    }

    for (const { el, part } of badges) {
      if (part > targetPart || drawnBadgeRef.current.has(el)) continue;
      const d1 = nextDelayRef.current * stagger;
      el.style.visibility = "visible";
      el.style.setProperty("--edm-d1", `${d1}ms`);
      el.classList.add("edm-fade");
      drawnBadgeRef.current.add(el);
      scheduledAny = true;
    }

    maxDelayRef.current = maxDelay;
    if (scheduledAny) {
      setDone(false);
      if (doneTimerRef.current) window.clearTimeout(doneTimerRef.current);
      doneTimerRef.current = window.setTimeout(
        () => setDone(true),
        maxDelay + 150,
      );
    }
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const root = wrap.querySelector("svg");
    if (!root) {
      setDone(true);
      return;
    }

    if (prevSvgRef.current !== svg) {
      prevSvgRef.current = svg;
      startedRef.current = false;
      forceAllRef.current = false;
      activePartRef.current = 0;
    }

    drawnGeomRef.current = new Set();
    drawnTextRef.current = new Set();
    drawnBadgeRef.current = new Set();
    nextDelayRef.current = 0;
    maxDelayRef.current = 0;
    if (doneTimerRef.current) window.clearTimeout(doneTimerRef.current);
    if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
    doneTimerRef.current = null;
    fallbackTimerRef.current = null;

    // collect tagged parts
    const parts = new Map<number, SVGElement[]>();
    root.querySelectorAll("[data-part]").forEach((el) => {
      if (el.closest("defs")) return;
      const n = Number(el.getAttribute("data-part"));
      if (!Number.isFinite(n) || n <= 0) return;
      const arr = parts.get(n) ?? [];
      arr.push(el as SVGElement);
      parts.set(n, arr);
    });
    partsRef.current = parts;

    const unionBox = (els: SVGGraphicsElement[]) => {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const el of els) {
        let b: SVGRect;
        try {
          b = el.getBBox();
        } catch {
          continue;
        }
        if (!b || (b.width === 0 && b.height === 0)) continue;
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      }
      if (!isFinite(minX)) return null;
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    };

    badgesRef.current = [];
    parts.forEach((els, n) => {
      const box = unionBox(els as SVGGraphicsElement[]);
      if (!box) return;
      const bx = box.x + box.w + 14;
      const by = box.y - 6;
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "edm-badge");
      g.setAttribute("pointer-events", "none");
      g.style.visibility = "hidden";
      const circle = document.createElementNS(NS, "circle");
      circle.setAttribute("cx", String(bx));
      circle.setAttribute("cy", String(by));
      circle.setAttribute("r", "11");
      circle.setAttribute("fill", "#f59e0b");
      circle.setAttribute("stroke", "white");
      circle.setAttribute("stroke-width", "2");
      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", String(bx));
      text.setAttribute("y", String(by + 4));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "13");
      text.setAttribute("font-weight", "bold");
      text.setAttribute("fill", "white");
      text.textContent = String(n);
      g.appendChild(circle);
      g.appendChild(text);
      root.appendChild(g);
      badgesRef.current.push({ el: g, part: n });
    });

    const geometries = Array.from(
      root.querySelectorAll<SVGGeometryElement>(
        "line, path, polyline, polygon, circle, ellipse, rect",
      ),
    ).filter(
      (el) =>
        !el.closest("defs") &&
        !el.closest(".edm-badge") &&
        !el.classList.contains("edm-badge"),
    );
    geomsRef.current = geometries.map((el) => ({ el, part: partOf(el) }));

    const texts = Array.from(
      root.querySelectorAll<SVGTextElement>("text"),
    ).filter(
      (el) => !el.closest("defs") && !el.closest(".edm-badge"),
    );
    textsRef.current = texts.map((el) => ({ el, part: partOf(el) }));

    // Hide everything until its part is scheduled to draw.
    for (const { el } of geomsRef.current) {
      el.style.visibility = "hidden";
      el.style.fillOpacity = "0";
    }
    for (const { el } of textsRef.current) el.style.visibility = "hidden";

    // Replay: redraw the whole diagram from scratch.
    if (forceAllRef.current) {
      forceAllRef.current = false;
      startedRef.current = true;
      scheduleUpTo(Number.MAX_SAFE_INTEGER);
    }

    // Fallback: begin drawing (background/untagged first) as soon as the
    // diagram scrolls into view, in case the reading position never fires.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !startedRef.current) {
            io.disconnect();
            startedRef.current = true;
            scheduleUpTo(activePartRef.current);
            fallbackTimerRef.current = window.setTimeout(() => {
              if (activePartRef.current === 0) {
                scheduleUpTo(Number.MAX_SAFE_INTEGER);
              }
            }, 8000);
            break;
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(wrap);

    return () => {
      io.disconnect();
      if (doneTimerRef.current) window.clearTimeout(doneTimerRef.current);
      if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
    };
  }, [svg, runKey, scheduleUpTo]);

  // Draw each part as the reader reaches its legend entry, and highlight it.
  useEffect(() => {
    const unsubscribe = subscribeActiveParts((parts) => {
      const rootEl = rootRef.current;
      if (!rootEl) return;
      const n = parts.get(rootEl) ?? 0;
      activePartRef.current = n;
      setActivePart(n);
      if (n > 0) {
        if (fallbackTimerRef.current) {
          window.clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        startedRef.current = true;
        scheduleUpTo(n);
      }
    });
    return unsubscribe;
  }, [scheduleUpTo]);

  useEffect(() => {
    partsRef.current.forEach((els, n) => {
      els.forEach((el) => el.classList.toggle("edm-part-active", n === activePart));
    });
  }, [activePart, runKey]);

  const replay = () => {
    setDone(false);
    forceAllRef.current = true;
    setRunKey((k) => k + 1);
  };

  return (
    <div
      ref={rootRef}
      className="edm-whiteboard my-6 rounded-xl border border-slate-200 overflow-hidden shadow-sm max-w-2xl mx-auto"
    >
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-white">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FaPencilAlt className="text-sky-300" />
          AI Whiteboard
          {!done && (
            <span className="text-xs text-slate-300 font-normal animate-pulse">
              drawing&hellip;
            </span>
          )}
        </div>
        <button
          onClick={replay}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-xs font-semibold"
        >
          <FaRedo />
          Replay
        </button>
      </div>
      <div className="edm-wb bg-[#fdfefe] dark:bg-slate-900 p-4 overflow-x-auto">
        <WhiteboardSvg key={runKey} svg={svg} wrapRef={wrapRef} />
        <span className="edm-signature">&#9998; drawn by EduMentor AI</span>
      </div>
    </div>
  );
};

export default AnimatedWhiteboard;
