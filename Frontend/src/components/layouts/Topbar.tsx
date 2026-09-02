import {
  FaBell,
  FaUserCircle,
  FaMoon,
  FaSun,
} from "react-icons/fa";
import { useTheme } from "../hooks/useTheme";

const Topbar = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-10 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-end px-6 gap-5">
      <button
        onClick={toggleTheme}
        className="text-slate-500 hover:text-sky-500 dark:text-slate-400 dark:hover:text-sky-400"
        title="Toggle dark mode"
      >
        {theme === "dark" ? <FaSun size={20} /> : <FaMoon size={20} />}
      </button>

      <button className="text-slate-500 hover:text-sky-500 dark:text-slate-400 dark:hover:text-sky-400">
        <FaBell size={20} />
      </button>

      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
        <FaUserCircle size={25} />
        <span>Student</span>
      </div>
    </header>
  );
};

export default Topbar;
