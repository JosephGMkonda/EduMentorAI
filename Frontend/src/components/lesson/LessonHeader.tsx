import { FaBookOpen, FaClock, FaStar, FaBookmark } from "react-icons/fa";

interface Props {
  topic: string;
  subject: string;
  formLevel: string;
  bookmarked?: boolean;
  onBookmark?: () => void;
}

const subjectLabels: Record<string, string> = {
  mathematics: "Mathematics",
  physics: "Physics",
  chemistry: "Chemistry",
};

const LessonHeader = ({
  topic,
  subject,
  formLevel,
  bookmarked,
  onBookmark,
}: Props) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-start gap-3">
        <div className="bg-sky-100 text-sky-600 p-3 rounded-xl">
          <FaBookOpen />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
            {topic}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {subjectLabels[subject] || subject} &bull; {formLevel}
          </p>
        </div>
        {onBookmark && (
          <button
            onClick={onBookmark}
            title={bookmarked ? "Remove bookmark" : "Bookmark this lesson"}
            className={`p-3 rounded-lg border transition-colors ${
              bookmarked
                ? "bg-violet-500 text-white border-violet-500"
                : "bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:text-violet-500"
            }`}
          >
            <FaBookmark />
          </button>
        )}
      </div>
      <div className="flex gap-6 mt-6 text-sm text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-2">
          <FaClock className="text-sky-500" />
          30 minutes
        </span>
        <span className="flex items-center gap-2">
          <FaStar className="text-yellow-500" />
          Beginner
        </span>
      </div>
    </div>
  );
};

export default LessonHeader;
