import { useState, useEffect } from "react";
import { FaGraduationCap, FaRedo, FaCheck, FaTimes } from "react-icons/fa";
import { getQuiz } from "../../service/api";
import type { QuizQuestion } from "../../service/api";
import { recordQuizScore } from "../../service/progressStore";

interface Props {
  topic: string;
  subject: string;
  formLevel: string;
  query: string;
  embedded?: boolean;
}

const QuizCard = ({ topic, subject, formLevel, query, embedded = false }: Props) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setQuestions([]);
    setStarted(false);
    setFinished(false);
    setIndex(0);
    setSelected(null);
    setScore(0);
    setError(null);
  }, [topic, subject, formLevel, query]);

  const loadQuiz = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQuiz(topic, subject, formLevel, query);
      setQuestions(data.questions);
      setStarted(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ||
        (err as Error)?.message ||
        "Could not load the quiz. Try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const choose = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === questions[index].correct_index) setScore((s) => s + 1);
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      recordQuizScore(topic, subject, formLevel, pct);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  };

  const question = questions[index];
  const total = questions.length;
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
        <div className="bg-emerald-100 text-emerald-600 p-3 rounded-lg">
          <FaGraduationCap />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Test Yourself</h2>
          <p className="text-sm text-slate-500">
            A short quiz on {topic || "this topic"}
          </p>
        </div>
      </div>

      {!started && !error && (
        <button
          onClick={loadQuiz}
          disabled={loading}
          className="px-5 py-2.5 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50"
        >
          {loading ? "Generating questions..." : "Start Quiz"}
        </button>
      )}

      {error && (
        <div>
          <p className="text-slate-500 mb-3">{error}</p>
          <button
            onClick={loadQuiz}
            className="px-5 py-2.5 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600"
          >
            Try again
          </button>
        </div>
      )}

      {started && !finished && question && (
        <div>
          <div className="flex items-center justify-between text-sm text-slate-500 mb-3">
            <span>
              Question {index + 1} of {total}
            </span>
            <span>
              Score: {score}
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full mb-5 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${((index + (selected !== null ? 1 : 0)) / total) * 100}%` }}
            />
          </div>

          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            {question.question}
          </p>

          <div className="space-y-2">
            {question.options.map((opt, i) => {
              const isCorrect = i === question.correct_index;
              const isSelected = i === selected;
              let cls =
                "w-full text-left px-4 py-3 rounded-lg border font-medium transition-colors ";
              if (selected === null) {
                cls +=
                  "border-slate-200 text-slate-700 dark:border-slate-600 dark:text-slate-200 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-700 cursor-pointer";
              } else if (isCorrect) {
                cls += "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300";
              } else if (isSelected) {
                cls += "border-red-400 bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300";
              } else {
                cls += "border-slate-200 text-slate-400 dark:border-slate-700";
              }
              return (
                <button key={i} onClick={() => choose(i)} className={cls} disabled={selected !== null}>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm text-slate-400">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                    {selected !== null && isCorrect && <FaCheck className="ml-auto text-emerald-500" />}
                    {selected !== null && isSelected && !isCorrect && <FaTimes className="ml-auto text-red-500" />}
                  </span>
                </button>
              );
            })}
          </div>

          {selected !== null && question.explanation && (
            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-slate-700 dark:text-slate-200 text-sm">
              <span className="font-semibold">Why: </span>
              {question.explanation}
            </div>
          )}

          <div className="mt-5 text-right">
            {selected !== null && (
              <button
                onClick={next}
                className="px-5 py-2.5 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600"
              >
                {index + 1 >= total ? "See Results" : "Next Question"}
              </button>
            )}
          </div>
        </div>
      )}

      {started && finished && (
        <div className="text-center py-4">
          <p className="text-4xl font-bold text-slate-800 mb-2">
            {pct}%
          </p>
          <p className="text-slate-500 mb-1">
            You scored {score} out of {total}
          </p>
          <p className="text-slate-400 text-sm mb-6">
            {pct === 100
              ? "Perfect score! Excellent work."
              : pct >= 50
                ? "Good job! Review the lesson and try again."
                : "Keep studying the lesson, then give it another go."}
          </p>
          <button
            onClick={restart}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600"
          >
            <FaRedo />
            Retake Quiz
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizCard;
