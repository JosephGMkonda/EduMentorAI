import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  FaRobot,
  FaGraduationCap,
  FaPenNib,
  FaHeadphones,
} from "react-icons/fa";
import LessonHeader from "../components/lesson/LessonHeader";
import ExplanationCard from "../components/lesson/ExplanationCard";
import QuizCard from "../components/lesson/QuizCard";
import PracticeCard from "../components/lesson/PracticeCard";
import FollowUpChat from "../components/lesson/FollowUpChat";
import AskMeCard from "../components/lesson/AskMeCard";
import InteractiveExplorer from "../components/interactive/InteractiveExplorer";
import LessonSkeleton from "../components/lesson/LessonSkeleton";
import ErrorBoundary from "../components/ErrorBoundary";
import { useLesson } from "../components/hooks/useLesson";
import { requestStopReading } from "../components/lesson/lessonSync";
import {
  recordLesson,
  toggleBookmark,
  isBookmarked,
} from "../service/progressStore";

type ToolId = "followup" | "quiz" | "practice" | "askme";

const TOOLS: {
  id: ToolId;
  label: string;
  icon: React.ReactNode;
  active: string;
}[] = [
  {
    id: "followup",
    label: "Ask Follow-up",
    icon: <FaRobot />,
    active: "bg-indigo-500 text-white border-indigo-500",
  },
  {
    id: "quiz",
    label: "Quiz",
    icon: <FaGraduationCap />,
    active: "bg-emerald-500 text-white border-emerald-500",
  },
  {
    id: "practice",
    label: "Practice",
    icon: <FaPenNib />,
    active: "bg-violet-500 text-white border-violet-500",
  },
  {
    id: "askme",
    label: "Ask Me",
    icon: <FaHeadphones />,
    active: "bg-pink-500 text-white border-pink-500",
  },
];

const LessonPage = () => {
  const { topic } = useParams();
  const [searchParams] = useSearchParams();
  const subject = searchParams.get("subject") || "mathematics";
  const formLevel = searchParams.get("form") || "Form 1";

  const { lesson, loading, error, fetchLesson } = useLesson();
  const [bookmarked, setBookmarked] = useState(false);
  const [tool, setTool] = useState<ToolId>("followup");

  useEffect(() => {
    fetchLesson(
      `Explain ${topic} step by step for a secondary school student`,
      subject,
      formLevel,
      topic || "",
    );
  }, [topic, subject, formLevel]);

  useEffect(() => {
    setBookmarked(isBookmarked(topic || "", subject, formLevel));
  }, [topic, subject, formLevel]);

  useEffect(() => {
    setTool("followup");
  }, [topic]);

  useEffect(() => {
    if (lesson) recordLesson(topic || "", subject, formLevel);
  }, [lesson, topic, subject, formLevel]);

  const onBookmark = () => {
    toggleBookmark(topic || "", subject, formLevel);
    setBookmarked(isBookmarked(topic || "", subject, formLevel));
  };

  const openTool = (next: ToolId) => {
    requestStopReading();
    setTool(next);
  };

  if (loading) {
    return <LessonSkeleton />;
  }

  if (error && !lesson) {
    return (
      <div className="space-y-6">
        <LessonHeader topic={topic || ""} subject={subject} formLevel={formLevel} />
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900 p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-red-600 mb-2">
            The AI teacher is busy right now
          </p>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{error}</p>
          <button
            onClick={() =>
              fetchLesson(
                `Explain ${topic} step by step for a secondary school student`,
                subject,
                formLevel,
                topic || "",
              )
            }
            className="px-6 py-2.5 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_370px]">
      <div className="min-w-0 space-y-6">
        <LessonHeader
          topic={topic || ""}
          subject={subject}
          formLevel={formLevel}
          bookmarked={bookmarked}
          onBookmark={onBookmark}
        />

        {lesson && (
          <ErrorBoundary resetKey={topic || ""}>
            <ExplanationCard
              content={lesson.lesson}
              onExplainAgain={() =>
                fetchLesson(
                  `Explain ${topic} in a very simple way using everyday examples`,
                  subject,
                  formLevel,
                  topic || "",
                )
              }
            />
          </ErrorBoundary>
        )}

        {lesson && (
          <InteractiveExplorer subject={subject} topic={topic || ""} />
        )}
      </div>

      {lesson && (
        <aside className="lg:sticky lg:top-20">
          <div className="max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-3 px-1 font-bold text-slate-800 dark:text-white">
              Study Tools
            </h3>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {TOOLS.map((t) => {
                const isActive = tool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => openTool(t.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? t.active
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
              {tool === "followup" && (
                <FollowUpChat
                  embedded
                  topic={topic || ""}
                  subject={subject}
                  formLevel={formLevel}
                  lessonExcerpt={lesson.lesson}
                />
              )}
              {tool === "quiz" && (
                <QuizCard
                  embedded
                  topic={topic || ""}
                  subject={subject}
                  formLevel={formLevel}
                  query={`Quiz on ${topic}`}
                />
              )}
              {tool === "practice" && (
                <PracticeCard
                  embedded
                  topic={topic || ""}
                  subject={subject}
                  formLevel={formLevel}
                />
              )}
              {tool === "askme" && (
                <AskMeCard
                  embedded
                  topic={topic || ""}
                  subject={subject}
                  formLevel={formLevel}
                />
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default LessonPage;
