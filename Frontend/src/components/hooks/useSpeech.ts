import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionLike)
    | undefined;
  return Ctor ? new Ctor() : null;
}

export const speechSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

export const voiceSupported = () => getRecognition() !== null;

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const cancelSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (
      text: string,
      opts?: {
        rate?: number;
        onEnd?: () => void;
        onBoundary?: (charIndex: number) => void;
      },
    ) => {
      if (!speechSupported() || !text.trim()) {
        opts?.onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      utter.rate = opts?.rate ?? 1;
      utter.pitch = 1;
      setSpeaking(true);
      utter.onboundary = (e) => opts?.onBoundary?.(e.charIndex);
      utter.onend = () => {
        setSpeaking(false);
        opts?.onEnd?.();
      };
      utter.onerror = () => {
        setSpeaking(false);
        opts?.onEnd?.();
      };
      window.speechSynthesis.speak(utter);
    },
    [],
  );

  const startListening = useCallback(
    (onResult: (transcript: string) => void) => {
      const rec = getRecognition();
      if (!rec) return;
      recRef.current?.stop();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (event) => {
        const list = event.results;
        if (list.length > 0) {
          const transcript = (list[list.length - 1] as unknown as { transcript: string }[])[0]?.transcript ?? "";
          onResult(transcript.trim());
        }
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      setListening(true);
      try {
        rec.start();
      } catch {
        setListening(false);
      }
    },
    [],
  );

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  return { speaking, listening, speak, cancelSpeech, startListening, stopListening };
}
