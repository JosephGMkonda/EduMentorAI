import { useEffect, useRef, useState } from "react";
import {
  FaHeadphones,
  FaStop,
  FaMicrophone,
  FaSpinner,
  FaRedo,
} from "react-icons/fa";
import { getQuiz } from "../../service/api";
import type { QuizQuestion } from "../../service/api";
import { useSpeech, voiceSupported, speechSupported } from "../hooks/useSpeech";
import { recordQuizScore } from "../../service/progressStore";

interface Props {
  topic: string;
  subject: string;
  formLevel: string;
  embedded?: boolean;
}

const parseAnswer = (transcript: string): number | null => {
  const m = transcript.toLowerCase().match(/\b([abcd])\b/);
  if (m) return m[1].charCodeAt(0) - 97;
  const first = transcript.trim().charAt(0).toLowerCase();
  if (["a", "b", "c", "d"].includes(first)) return first.charCodeAt(0) - 97;
  return null;
};

const AskMeCard = ({ topic, subject, formLevel, embedded = false }: Props) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const indexRef = useRef(0);
  const scoreRef = useRef(0);
  const questionsRef = useRef<QuizQuestion[]>([]);
  const { speaking, listening, speak, cancelSpeech, startListening, stopListening } =
    useSpeech();

  useEffect(() => {
    setQuestions([]);
    setRunning(false);
    setFinished(false);
    setIndex(0);
    setScore(0);
    setError(null);
  }, [topic, subject, formLevel]);

  const optionsText = (q: QuizQuestion) =>
    q.options
      .map((opt, i) => `${String.fromCharCode(65 + i)}: ${opt}`)
      .join(". ");

  const askCurrent = () => {
    const q = questionsRef.current[indexRef.current];
    if (!q) return;
    const text = `Question ${indexRef.current + 1}. ${q.question}. ${optionsText(q)}. Say A, B, C, or D.`;
    speak(text, {
      rate: 1,
      onEnd: () => startListening(onVoiceAnswer),
    });
  };

  const onVoiceAnswer = (transcript: string) => {
    const choice = parseAnswer(transcript);
    if (choice === null) {
      speak("Sorry, I did not catch that. Say A, B, C, or D.", {
        rate: 1,
        onEnd: () => startListening(onVoiceAnswer),
      });
      return;
    }
    evaluate(choice);
  };

  const evaluate = (choice: number) => {
    const q = questionsRef.current[indexRef.current];
    if (!q) return;
    const correct = choice === q.correct_index;
    if (correct) scoreRef.current += 1;
    setLastResult(
      `${correct ? "Correct" : "Not quite"} — the answer is ${String.fromCharCode(
        65 + q.correct_index,
      )}. ${q.explanation || ""}`,
    );
    const done = indexRef.current + 1 >= questionsRef.current.length;
    const feedback = `${
      correct ? "Correct!" : "Not quite."
    } The answer is ${String.fromCharCode(65 + q.correct_index)}. ${q.explanation || ""}`;
    speak(feedback, {
      rate: 1,
      onEnd: () => {
        if (done) {
          finishQuiz();
        } else {
          indexRef.current += 1;
          setIndex(indexRef.current);
          setLastResult(null);
          askCurrent();
        }
      },
    });
  };

  const finishQuiz = () => {
    const total = questionsRef.current.length;
    const pct = Math.round((scoreRef.current / total) * 100);
    setScore(scoreRef.current);
    setFinished(true);
    setRunning(false);
    recordQuizScore(topic, subject, formLevel, pct);
    speak(`You finished! You scored ${scoreRef.current} out of ${total}. That is ${pct} percent.`);
  };

  const start = async () => {
    setLoading(true);
    setError(null);
    cancelSpeech();
    try {
      const data = await getQuiz(topic, subject, formLevel, `Quiz on ${topic}`);
      questionsRef.current = data.questions;
      setQuestions(data.questions);
      indexRef.current = 0;
      scoreRef.current = 0;
      setIndex(0);
      setScore(0);
      setFinished(false);
      setLastResult(null);
      setRunning(true);
      setTimeout(askCurrent, 600);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Could not start Ask Me mode. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const stop = () => {
    cancelSpeech();
    stopListening();
    setRunning(false);
  };

  const restart = () => {
    stop();
    start();
  };

  const supported = voiceSupported() && speechSupported();
  const question = questions[index];

  return (
    <div
      className={
        embedded
          ? ""
          : "bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm"
      }
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-pink-100 text-pink-600 p-3 rounded-lg">
          <FaHeadphones />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            Ask Me
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {supported
              ? "I quiz you by voice — you answer aloud."
              : "Voice mode needs a supported browser (Chrome). Use the buttons to answer."}
          </p>
        </div>
      </div>

      {!running && !finished && !error && (
        <button
          onClick={start}
          disabled={loading}
          className="px-5 py-2.5 rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600 disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <FaSpinner className="animate-spin" /> Preparing...
            </span>
          ) : (
            "Start Ask Me"
          )}
        </button>
      )}

      {error && (
        <div>
          <p className="text-slate-500 dark:text-slate-400 mb-3">{error}</p>
          <button
            onClick={start}
            className="px-5 py-2.5 rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600"
          >
            Try again
          </button>
        </div>
      )}

      {running && question && (
        <div>
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 mb-3">
            <span>
              Question {index + 1} of {questions.length}
            </span>
            <span>Score: {score}</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mb-5 overflow-hidden">
            <div
              className="h-full bg-pink-500 transition-all duration-300"
              style={{ width: `${(index / questions.length) * 100}%` }}
            />
          </div>

          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
            {question.question}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {question.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => evaluate(i)}
                disabled={speaking || listening}
                className="text-left px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-pink-400 hover:bg-pink-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <span className="font-mono text-sm text-slate-400 mr-2">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {(listening || speaking) && (
              <span className="inline-flex items-center gap-2 text-sm text-pink-500 font-semibold">
                <FaMicrophone className="animate-pulse" />
                {listening ? "Listening... say your answer" : "Speaking..."}
              </span>
            )}
            <button
              onClick={stop}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600"
            >
              <FaStop /> Stop
            </button>
          </div>

          {lastResult && (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              {lastResult}
            </p>
          )}
        </div>
      )}

      {finished && (
        <div className="text-center py-4">
          <p className="text-4xl font-bold text-slate-800 dark:text-white mb-2">
            {questions.length ? Math.round((score / questions.length) * 100) : 0}%
          </p>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            You scored {score} out of {questions.length}
          </p>
          <button
            onClick={restart}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600"
          >
            <FaRedo /> Play Again
          </button>
        </div>
      )}
    </div>
  );
};

export default AskMeCard;
