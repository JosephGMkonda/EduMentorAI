import { useEffect, useState } from "react";
import {
  FaPenNib,
  FaRedo,
  FaCheck,
  FaTimes,
  FaSpinner,
} from "react-icons/fa";
import { getPractice, checkPracticeAnswer } from "../../service/api";
import type { PracticeProblem } from "../../service/api";
import { recordPracticeScore } from "../../service/progressStore";

interface Props {
  topic: string;
  subject: string;
  formLevel: string;
  embedded?: boolean;
}

const PracticeCard = ({ topic, subject, formLevel, embedded = false }: Props) => {
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{ correct: boolean; feedback: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setProblems([]);
    setStarted(false);
    setFinished(false);
    setIndex(0);
    setAnswer("");
    setResult(null);
    setScore(0);
    setError(null);
  }, [topic, subject, formLevel]);

  const loadPractice = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPractice(topic, subject, formLevel);
      setProblems(data.problems);
      setStarted(true);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ||
          (err as Error)?.message ||
          "Could not load practice questions. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const check = async () => {
    if (!answer.trim() || checking) return;
    setChecking(true);
    setResult(null);
    try {
      const p = problems[index];
      const res = await checkPracticeAnswer({
        problem: p.problem,
        answer: p.answer,
        explanation: p.explanation,
        student_answer: answer.trim(),
        topic,
      });
      setResult(res);
      if (res.correct) setScore((s) => s + 1);
    } catch (err: unknown) {
      setResult({
        correct: false,
        feedback:
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Could not mark your answer. Try again.",
      });
    } finally {
      setChecking(false);
    }
  };

  const next = () => {
    if (index + 1 >= problems.length) {
      setFinished(true);
      const pct = Math.round((score / problems.length) * 100);
      recordPracticeScore(topic, subject, formLevel, pct);
      return;
    }
    setIndex((i) => i + 1);
    setAnswer("");
    setResult(null);
  };

  const restart = () => {
    setIndex(0);
    setAnswer("");
    setResult(null);
    setScore(0);
    setFinished(false);
  };

  const problem = problems[index];
  const total = problems.length;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div
      className={
        embedded
          ? ""
          : "bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm"
      }
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-violet-100 text-violet-600 p-3 rounded-lg">
          <FaPenNib />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            Practice Problems
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Solve and I will mark your answer
          </p>
        </div>
      </div>

      {!started && !error && (
        <button
          onClick={loadPractice}
          disabled={loading}
          className="px-5 py-2.5 rounded-lg bg-violet-500 text-white font-semibold hover:bg-violet-600 disabled:opacity-50"
        >
          {loading ? "Creating problems..." : "Start Practising"}
        </button>
      )}

      {error && (
        <div>
          <p className="text-slate-500 dark:text-slate-400 mb-3">{error}</p>
          <button
            onClick={loadPractice}
            className="px-5 py-2.5 rounded-lg bg-violet-500 text-white font-semibold hover:bg-violet-600"
          >
            Try again
          </button>
        </div>
      )}

      {started && !finished && problem && (
        <div>
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 mb-3">
            <span>
              Question {index + 1} of {total}
            </span>
            <span>Score: {score}</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mb-5 overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all duration-300"
              style={{ width: `${((index + (result ? 1 : 0)) / total) * 100}%` }}
            />
          </div>

          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            {problem.problem}
          </p>

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={!!result || checking}
            rows={3}
            placeholder="Type your answer here..."
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 disabled:opacity-60"
          />

          {!result && (
            <div className="mt-4 text-right">
              <button
                onClick={check}
                disabled={!answer.trim() || checking}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 disabled:opacity-50"
              >
                {checking ? (
                  <>
                    <FaSpinner className="animate-spin" /> Marking...
                  </>
                ) : (
                  "Check my answer"
                )}
              </button>
            </div>
          )}

          {result && (
            <div
              className={`mt-4 p-4 rounded-lg text-sm ${
                result.correct
                  ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300"
              }`}
            >
              <p className="flex items-center gap-2 font-semibold mb-1">
                {result.correct ? <FaCheck /> : <FaTimes />}
                {result.correct ? "Correct!" : "Not quite."}
              </p>
              <p className="mb-1">{result.feedback}</p>
              {!result.correct && (
                <p className="opacity-80">
                  <span className="font-semibold">Answer: </span>
                  {problem.answer}
                </p>
              )}
              {problem.explanation && (
                <p className="mt-1 opacity-80">
                  <span className="font-semibold">How: </span>
                  {problem.explanation}
                </p>
              )}
            </div>
          )}

          {result && (
            <div className="mt-4 text-right">
              <button
                onClick={next}
                className="px-5 py-2.5 rounded-lg bg-violet-500 text-white font-semibold hover:bg-violet-600"
              >
                {index + 1 >= total ? "See Results" : "Next Problem"}
              </button>
            </div>
          )}
        </div>
      )}

      {started && finished && (
        <div className="text-center py-4">
          <p className="text-4xl font-bold text-slate-800 dark:text-white mb-2">
            {pct}%
          </p>
          <p className="text-slate-500 dark:text-slate-400 mb-1">
            You solved {score} out of {total} correctly
          </p>
          <p className="text-slate-400 text-sm mb-6">
            {pct === 100
              ? "Outstanding! You really know this topic."
              : pct >= 50
                ? "Good effort — review the ones you missed."
                : "Practice makes perfect. Re-read the lesson and try again."}
          </p>
          <button
            onClick={restart}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-500 text-white font-semibold hover:bg-violet-600"
          >
            <FaRedo />
            Practise Again
          </button>
        </div>
      )}
    </div>
  );
};

export default PracticeCard;
