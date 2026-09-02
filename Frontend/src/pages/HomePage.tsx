import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBookOpen,
  FaCalculator,
  FaAtom,
  FaFlask,
  FaChevronDown,
  FaChevronRight,
  FaGraduationCap,
  FaPlayCircle,
  FaFire,
  FaBolt,
  FaBookmark,
  FaHistory,
} from "react-icons/fa";
import { curriculum } from "../data/curriculum";
import {
  loadProgress,
  totalMastery,
  type ProgressState,
} from "../service/progressStore";

const subjectIcons: Record<string, React.ReactNode> = {
  mathematics: <FaCalculator className="text-sky-500" />,
  physics: <FaAtom className="text-sky-500" />,
  chemistry: <FaFlask className="text-sky-500" />,
};

const HomePage = () => {
  const navigate = useNavigate();
  const [openForm, setOpenForm] = useState<string>("form1");
  const [progress, setProgress] = useState<ProgressState>(loadProgress);

  useEffect(() => {
    const refresh = () => setProgress(loadProgress());
    window.addEventListener("edm-progress", refresh);
    return () => window.removeEventListener("edm-progress", refresh);
  }, []);

  const startLesson = (subjectId: string, formName: string, topic: string) => {
    navigate(
      `/lesson/${encodeURIComponent(topic)}?subject=${subjectId}&form=${encodeURIComponent(formName)}`,
    );
  };

  const mastery = totalMastery(progress);

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-white/20 p-3 rounded-xl">
            <FaGraduationCap size={32} />
          </div>
          <h1 className="text-3xl font-bold">Welcome to EduMentor AI</h1>
        </div>
        <p className="text-sky-50 max-w-2xl text-lg">
          Your personal AI teacher for the Malawi secondary school curriculum.
          Pick a form, choose a subject and topic, and let our AI teach you
          step by step with lessons, diagrams and practice.
        </p>
      </div>

      {/* Progress strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-5 shadow-sm flex items-center gap-4">
          <div className="bg-orange-100 text-orange-600 p-3 rounded-lg text-xl">
            <FaFire />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-800 dark:text-white">
              {progress.streak.count}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              day streak
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-5 shadow-sm flex items-center gap-4">
          <div className="bg-amber-100 text-amber-600 p-3 rounded-lg text-xl">
            <FaBolt />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-800 dark:text-white">
              {progress.xp}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">XP earned</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-5 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-100 text-emerald-600 p-3 rounded-lg text-xl">
            <FaGraduationCap />
          </div>
          <div className="flex-1">
            <p className="text-3xl font-bold text-slate-800 dark:text-white">
              {mastery}%
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              overall mastery
            </p>
          </div>
        </div>
      </div>

      {/* Recent history */}
      {progress.history.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-sky-100 text-sky-600 p-3 rounded-lg">
              <FaHistory />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Continue studying
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {progress.history.slice(0, 8).map((h) => (
              <button
                key={`${h.form}-${h.subject}-${h.topic}`}
                onClick={() => startLesson(h.subject, h.form, h.topic)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 border-slate-200 rounded-full text-sm text-slate-600 dark:text-slate-200 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors"
              >
                <FaPlayCircle className="text-sky-400 text-xs" />
                {h.topic}
                <span className="text-xs text-slate-400">
                  {h.form} · {h.subject}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bookmarks */}
      {progress.bookmarks.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-violet-100 text-violet-600 p-3 rounded-lg">
              <FaBookmark />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Bookmarked lessons
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {progress.bookmarks.slice(0, 6).map((b) => (
              <button
                key={`${b.form}-${b.subject}-${b.topic}`}
                onClick={() => startLesson(b.subject, b.form, b.topic)}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 border-slate-200 rounded-lg text-left hover:border-sky-500 transition-colors"
              >
                <FaBookmark className="text-violet-500 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold text-slate-700 dark:text-slate-100">
                    {b.topic}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {b.form} · {b.subject}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            What do you want to study today?
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Select a form to see subjects and topics.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {curriculum.map((form) => {
          const isOpen = openForm === form.id;
          return (
            <div
              key={form.id}
              className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => setOpenForm(isOpen ? "" : form.id)}
                className="w-full flex items-center justify-between p-5 hover:bg-sky-50 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-sky-100 text-sky-600 p-3 rounded-lg">
                    <FaBookOpen />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                      {form.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {form.subjects.length} subjects available
                    </p>
                  </div>
                </div>
                {isOpen ? (
                  <FaChevronDown className="text-slate-400" />
                ) : (
                  <FaChevronRight className="text-slate-400" />
                )}
              </button>

              {isOpen && (
                <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {form.subjects.map((subject) => (
                    <div
                      key={subject.id}
                      className="border dark:border-slate-600 rounded-xl p-4 bg-slate-50 dark:bg-slate-900"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        {subjectIcons[subject.id]}
                        <h4 className="font-semibold text-slate-700 dark:text-slate-200">
                          {subject.name}
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {subject.topics.map((topic) => (
                          <button
                            key={topic}
                            onClick={() =>
                              startLesson(subject.id, form.name, topic)
                            }
                            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full text-sm text-slate-600 dark:text-slate-300 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            <FaPlayCircle className="text-sky-400 text-xs" />
                            {topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HomePage;
