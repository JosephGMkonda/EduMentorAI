import { useEffect, useRef, useState } from "react";
import {
  FaPaperPlane,
  FaMicrophone,
  FaStop,
  FaRobot,
  FaSpinner,
  FaVolumeUp,
  FaVolumeMute,
} from "react-icons/fa";
import { getFollowUp } from "../../service/api";
import type { FollowUpMessage } from "../../service/api";
import { useSpeech, voiceSupported, speechSupported } from "../hooks/useSpeech";

interface Props {
  topic: string;
  subject: string;
  formLevel: string;
  lessonExcerpt: string;
  embedded?: boolean;
}

const toSpeechText = (s: string): string =>
  s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const buildOffsets = (text: string): number[] => {
  const offsets: number[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) offsets.push(m.index);
  return offsets;
};

const FollowUpChat = ({
  topic,
  subject,
  formLevel,
  lessonExcerpt,
  embedded = false,
}: Props) => {
  const [messages, setMessages] = useState<FollowUpMessage[]>([
    {
      role: "assistant",
      content: `Hi! Ask me anything about ${topic} — I can re-explain, give examples, or help with a specific part.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamWordsRef = useRef<string[]>([]);
  const offsetsRef = useRef<number[]>([]);
  const lastBoundaryRef = useRef(0);
  const streamTimerRef = useRef<number | null>(null);
  const canVoice = voiceSupported();
  const {
    listening,
    speaking,
    speak,
    cancelSpeech,
    startListening,
    stopListening,
  } = useSpeech();

  const clearStreamTimer = () => {
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, streaming, revealedCount]);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `Hi! Ask me anything about ${topic} — I can re-explain, give examples, or help with a specific part.`,
      },
    ]);
  }, [topic]);

  useEffect(() => {
    return () => {
      clearStreamTimer();
      cancelSpeech();
    };
  }, [cancelSpeech]);

  const countAt = (charIndex: number) => {
    let n = 0;
    for (const o of offsetsRef.current) if (o <= charIndex) n++;
    return n;
  };

  const startStream = (rawReply: string) => {
    const plain = toSpeechText(rawReply);
    const words = plain.split(/\s+/).filter(Boolean);
    offsetsRef.current = buildOffsets(plain);
    streamWordsRef.current = words;
    clearStreamTimer();
    setRevealedCount(0);

    if (!words.length) {
      setStreaming(false);
      return;
    }

    if (voiceReplies && speechSupported()) {
      lastBoundaryRef.current = Date.now();
      speak(plain, {
        rate: 1,
        onBoundary: (ci) => {
          lastBoundaryRef.current = Date.now();
          setRevealedCount(countAt(ci));
        },
        onEnd: () => {
          clearStreamTimer();
          setStreaming(false);
        },
      });
      streamTimerRef.current = window.setInterval(() => {
        if (Date.now() - lastBoundaryRef.current > 2500) {
          lastBoundaryRef.current = Date.now();
          setRevealedCount((r) => Math.min(r + 2, streamWordsRef.current.length));
        }
      }, 1200);
    } else {
      streamTimerRef.current = window.setInterval(() => {
        setRevealedCount((r) => {
          const next = r + 1;
          if (next >= streamWordsRef.current.length) {
            clearStreamTimer();
            setStreaming(false);
          }
          return next;
        });
      }, 55);
    }

    setStreaming(true);
  };

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || sending) return;
    cancelSpeech();
    clearStreamTimer();
    setStreaming(false);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setSending(true);
    try {
      const history = messages;
      const res = await getFollowUp({
        query: question,
        subject,
        form_level: formLevel,
        topic,
        lesson_excerpt: lessonExcerpt,
        history,
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      startStream(res.reply);
    } catch (err: unknown) {
      const fallback =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Sorry, the AI is busy right now. Try again shortly.";
      setMessages((m) => [...m, { role: "assistant", content: fallback }]);
      startStream(fallback);
    } finally {
      setSending(false);
    }
  };

  const onVoiceResult = (transcript: string) => {
    if (transcript) {
      setInput(transcript);
      send(transcript);
    }
  };

  const toggleVoiceReplies = () => {
    if (voiceReplies) {
      cancelSpeech();
      clearStreamTimer();
      setStreaming(false);
    }
    setVoiceReplies((v) => !v);
  };

  const streamTotal = streamWordsRef.current.length;
  const streamDone = streaming && revealedCount >= streamTotal;

  return (
    <div
      className={
        embedded
          ? ""
          : "bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm"
      }
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-indigo-100 text-indigo-600 p-3 rounded-lg">
          <FaRobot />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            Ask a follow-up
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Stuck on a part? Ask me here.
          </p>
        </div>
        {embedded && speechSupported() && (
          <button
            onClick={toggleVoiceReplies}
            title={voiceReplies ? "Mute voice replies" : "Speak replies aloud"}
            className={`ml-auto inline-flex shrink-0 items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              voiceReplies
                ? "bg-amber-400 text-white border-amber-400"
                : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-300 dark:border-slate-600"
            }`}
          >
            {voiceReplies ? <FaVolumeUp /> : <FaVolumeMute />}
            {voiceReplies ? "Voice on" : "Voice off"}
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto space-y-3 mb-4 pr-1">
        {messages.map((m, i) => {
          const isStreamingMsg =
            streaming && i === messages.length - 1 && m.role === "assistant";
          return (
            <div
              key={i}
              className={`max-w-[85%] p-3 rounded-xl text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "ml-auto bg-sky-500 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}
            >
              {isStreamingMsg ? (
                <span className="break-words">
                  {streamWordsRef.current.slice(0, revealedCount).map((w, wi) => (
                    <span
                      key={wi}
                      className={
                        wi === revealedCount - 1
                          ? "rounded bg-amber-200 px-0.5 dark:bg-amber-500/40"
                          : ""
                      }
                    >
                      {w}
                      {wi < revealedCount - 1 ? " " : ""}
                    </span>
                  ))}
                  {!streamDone && (
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-amber-500 align-middle" />
                  )}
                </span>
              ) : (
                m.content
              )}
            </div>
          );
        })}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <FaSpinner className="animate-spin" /> Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2">
        {canVoice && (
          <button
            onClick={() =>
              listening ? stopListening() : startListening(onVoiceResult)
            }
            className={`p-3 rounded-lg border transition-colors ${
              listening
                ? "bg-red-500 text-white border-red-500 animate-pulse"
                : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:text-red-500"
            }`}
            title={listening ? "Stop listening" : "Ask by voice"}
          >
            {listening ? <FaStop /> : <FaMicrophone />}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="e.g. I don't get part 3, can you explain again?"
          className="flex-1 p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || sending}
          className="p-3 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
        >
          <FaPaperPlane />
        </button>
      </div>

      {(listening || speaking || streaming) && (
        <p className="mt-2 text-xs font-semibold text-amber-500">
          {listening
            ? "Listening... speak your question now."
            : streaming
              ? "Speaking the answer aloud..."
              : speaking
                ? "Speaking the answer aloud..."
                : ""}
        </p>
      )}
      {!canVoice && (
        <p className="mt-2 text-xs text-slate-400">
          Voice input is not supported in this browser — you can type instead.
        </p>
      )}
    </div>
  );
};

export default FollowUpChat;
