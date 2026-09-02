import { useRef, useState, useEffect, useCallback, useMemo, memo, createElement, Fragment, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import AnimatedWhiteboard from "./AnimatedWhiteboard";
import { publishActiveParts } from "./diagramSync";
import { subscribeStopReading } from "./lessonSync";
import {
  FaPlay,
  FaPause,
  FaVolumeUp,
  FaVolumeMute,
  FaRedo,
  FaEye,
} from "react-icons/fa";

// Split every plain-text run into per-word <span class="rw-word"> elements at
// render time. React owns these spans, so no DOM mutation is ever needed and
// React's commit/cleanup bookkeeping always matches the real DOM.
const splitText = (text: string, start = 0): ReactNode[] =>
  text.split(/(\s+)/).map((part, i) =>
    part && !/^\s+$/.test(part) ? (
      <span key={`w${start + i}`} className="rw-word">
        {part}
      </span>
    ) : (
      <Fragment key={`w${start + i}`}>{part}</Fragment>
    ),
  );

const wordify = (children: ReactNode): ReactNode => {
  if (typeof children === "string") return splitText(children);
  if (Array.isArray(children)) {
    const out: ReactNode[] = [];
    let k = 0;
    for (const child of children) {
      if (typeof child === "string") {
        const nodes = splitText(child, k);
        for (const n of nodes) out.push(n);
        k += nodes.length;
      } else {
        out.push(child);
      }
    }
    return out;
  }
  return children;
};

const PROSE_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "blockquote",
  "td",
  "th",
  "dt",
  "dd",
  "caption",
  "figcaption",
  "summary",
  "strong",
  "em",
] as const;

const textComponents: Record<string, any> = {};
for (const tag of PROSE_TAGS) {
  textComponents[tag] = ({ node, children, ...props }: any) =>
    createElement(tag, props, wordify(children));
}

const MarkdownBody = memo(({ content }: { content: string }) => (
  <div className="prose max-w-none text-slate-700 break-words overflow-wrap-anywhere">
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        ...textComponents,
        code({ node, className, children, ...props }: any) {
          if (className?.includes("language-svg")) {
            return <AnimatedWhiteboard code={String(children)} />;
          }
          return (
            <code className={className} {...props}>
              {wordify(children)}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
));

const normalizeSvgBlocks = (content: string): string => {
  let s = content;
  s = s.replace(/!\[[^\]]*\]\(\s*svg\s*\r?\n?/gi, "");
  s = s.replace(/<\/svg>\s*\)/gi, "</svg>");
  s = s.replace(/```svg\s*\r?\n?\s*<svg/gi, "<svg");
  s = s.replace(/<\/svg>\s*\r?\n?\s*```/gi, "</svg>");
  s = s.replace(
    /(<svg[\s\S]*?<\/svg>)/gi,
    (m) => `\n\n\`\`\`svg\n${m}\n\`\`\`\n\n`,
  );
  return s;
};

interface Props {
  content: string;
}

const SPEEDS = [
  { label: "Slow", wpm: 100 },
  { label: "Normal", wpm: 150 },
  { label: "Fast", wpm: 200 },
  { label: "Fastest", wpm: 250 },
];

const ReadingLesson = ({ content }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<HTMLElement[]>([]);
  const offsetsRef = useRef<number[]>([]);
  const plainTextRef = useRef<string>("");
  const speakKeyRef = useRef(0);
  const revealedRef = useRef(0);
  const lastBoundaryRef = useRef(0);

  const [totalWords, setTotalWords] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[1]);

  const groupsRef = useRef<Map<Element, Map<number, number>>>(new Map());

  const normalized = useMemo(() => normalizeSvgBlocks(content), [content]);

  const setupWords = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const words = Array.from(root.querySelectorAll<HTMLElement>(".rw-word"));
    wordsRef.current = words;

    const offsets: number[] = [];
    const pieces: string[] = [];
    let pos = 0;
    for (const w of words) {
      offsets.push(pos);
      const t = w.textContent || "";
      pieces.push(t);
      pos += t.length + 1;
    }
    offsetsRef.current = offsets;
    plainTextRef.current = pieces.join(" ");
    setTotalWords(words.length);

    const groups = new Map<Element, Map<number, number>>();
    const wbs = Array.from(root.querySelectorAll<Element>(".edm-whiteboard"));
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const m = (w.textContent || "").trim().match(/^(\d+)\.$/);
      if (!m) continue;
      const parent = w.parentElement;
      if (!parent || parent.querySelector(".rw-word") !== w) continue;
      const partNum = parseInt(m[1], 10);
      let prevWb: Element | null = null;
      for (const wb of wbs) {
        if (wb.compareDocumentPosition(w) & Node.DOCUMENT_POSITION_PRECEDING) {
          prevWb = wb;
        }
      }
      if (!prevWb) continue;
      const containerParts = groups.get(prevWb) ?? new Map<number, number>();
      if (!containerParts.has(partNum)) containerParts.set(partNum, i);
      groups.set(prevWb, containerParts);
    }
    groupsRef.current = groups;
  }, []);

  useEffect(() => {
    setRevealed(0);
    setPlaying(true);
    speakKeyRef.current++;
    window.speechSynthesis?.cancel();
    setupWords();
  }, [normalized, setupWords]);

  useEffect(() => {
    revealedRef.current = revealed;
    const active = new Map<Element, number>();
    groupsRef.current.forEach((parts, container) => {
      let cur = 0;
      parts.forEach((wordIdx, partNum) => {
        if (wordIdx < revealed && partNum > cur) cur = partNum;
      });
      if (cur > 0) active.set(container, cur);
    });
    publishActiveParts(active);
  }, [revealed]);

  useEffect(() => {
    if (speaking || !playing || revealed >= totalWords) return;
    const ms = Math.max(80, Math.round(60000 / speed.wpm));
    const id = setInterval(
      () =>
        setRevealed((r) => {
          if (r >= totalWords) return r;
          return r + 1;
        }),
      ms,
    );
    return () => clearInterval(id);
  }, [speaking, playing, speed.wpm, totalWords, revealed]);

  useEffect(() => {
    const words = wordsRef.current;
    for (let i = 0; i < words.length; i++) {
      words[i].classList.toggle("rw-hidden", i >= revealed);
      words[i].classList.toggle("rw-current", i === revealed - 1);
    }
    if (revealed > 0 && revealed <= words.length) {
      words[revealed - 1].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [revealed]);

  const startSpeaking = useCallback(
    (startIdx: number) => {
      const text = plainTextRef.current;
      const offsets = offsetsRef.current;
      const total = wordsRef.current.length;
      if (!text || total === 0) return;
      if (startIdx >= total) startIdx = 0;

      const key = ++speakKeyRef.current;
      lastBoundaryRef.current = Date.now();

      const findWord = (absIndex: number) => {
        let lo = 0;
        let hi = offsets.length - 1;
        let ans = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (offsets[mid] <= absIndex) {
            ans = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        return ans;
      };

      const utter = new SpeechSynthesisUtterance(
        text.slice(offsets[startIdx]),
      );
      utter.lang = "en-US";
      utter.rate = Math.min(1.6, Math.max(0.6, speed.wpm / 150));
      utter.pitch = 1;

      utter.onboundary = (e) => {
        if (key !== speakKeyRef.current) return;
        lastBoundaryRef.current = Date.now();
        const wordIdx = findWord(offsets[startIdx] + (e.charIndex || 0));
        setRevealed(wordIdx + 1);
      };
      utter.onend = () => {
        if (key !== speakKeyRef.current) return;
        setRevealed(total);
        setPlaying(false);
      };
      utter.onerror = () => {
        if (key !== speakKeyRef.current) return;
        window.speechSynthesis?.cancel();
        setSpeaking(false);
      };

      window.speechSynthesis?.cancel();
      window.speechSynthesis?.speak(utter);
    },
    [speed.wpm],
  );

  useEffect(() => {
    if (!speaking) return;
    const start = revealedRef.current >= totalWords ? 0 : revealedRef.current;
    startSpeaking(start);
  }, [speaking, startSpeaking]);

  useEffect(() => {
    if (!speaking || !playing) return;
    const id = setInterval(() => {
      if (window.speechSynthesis?.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
    return () => clearInterval(id);
  }, [speaking, playing]);

  useEffect(() => {
    if (!speaking || !playing) return;
    const id = setInterval(() => {
      if (
        window.speechSynthesis?.speaking &&
        Date.now() - lastBoundaryRef.current > 2000
      ) {
        setRevealed((r) => Math.min(totalWords, r + 1));
        lastBoundaryRef.current = Date.now();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [speaking, playing, totalWords]);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    return subscribeStopReading(() => {
      speakKeyRef.current++;
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      setPlaying(false);
    });
  }, []);

  const done = totalWords > 0 && revealed >= totalWords;

  const togglePlay = () => {
    if (done) {
      restart();
      return;
    }
    if (speaking) {
      if (playing) {
        window.speechSynthesis?.pause();
        setPlaying(false);
      } else {
        window.speechSynthesis?.resume();
        setPlaying(true);
      }
      return;
    }
    setPlaying((p) => !p);
  };

  const toggleSpeech = () => {
    if (speaking) {
      speakKeyRef.current++;
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      return;
    }
    setPlaying(true);
    setSpeaking(true);
  };

  const restart = () => {
    if (speaking) {
      setRevealed(0);
      setPlaying(true);
      startSpeaking(0);
      return;
    }
    window.speechSynthesis?.cancel();
    setRevealed(0);
    setPlaying(true);
  };

  const changeSpeed = (sp: (typeof SPEEDS)[number]) => {
    setSpeed(sp);
    if (speaking && revealedRef.current < totalWords) {
      startSpeaking(revealedRef.current);
    }
  };

  const showAll = () => {
    speakKeyRef.current++;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setPlaying(false);
    setRevealed(totalWords);
  };

  const progress =
    totalWords > 0 ? Math.round((revealed / totalWords) * 100) : 0;
  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5 p-3 bg-slate-50 dark:bg-slate-700/40 border dark:border-slate-600 rounded-xl">
        <button
          onClick={togglePlay}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600"
        >
          {done ? <FaPlay /> : playing ? <FaPause /> : <FaPlay />}
          {done ? "Replay" : playing ? "Pause" : "Resume"}
        </button>

        {speechSupported && (
          <button
            onClick={toggleSpeech}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${
              speaking
                ? "bg-amber-400 text-white border-amber-400"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
            }`}
          >
            {speaking ? <FaVolumeUp /> : <FaVolumeMute />}
            {speaking ? "Reading aloud" : "Read aloud"}
          </button>
        )}

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 font-medium">Speed</span>
          <select
            value={speed.wpm}
            onChange={(e) => {
              const sp = SPEEDS.find((s) => s.wpm === Number(e.target.value));
              if (sp) changeSpeed(sp);
            }}
            className="px-2 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            {SPEEDS.map((s) => (
              <option key={s.wpm} value={s.wpm}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={restart}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-white text-slate-600 border border-slate-300 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
        >
          <FaRedo />
          Restart
        </button>

        <button
          onClick={showAll}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-white text-slate-600 border border-slate-300 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
        >
          <FaEye />
          Show full lesson
        </button>

        <span className="ml-auto text-sm font-semibold text-slate-500 dark:text-slate-400">
          {done ? "Completed" : `${progress}%`}
        </span>
      </div>

      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-sky-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div ref={containerRef} className="min-h-40">
        <MarkdownBody content={normalized} />
      </div>
    </div>
  );
};

export default ReadingLesson;
