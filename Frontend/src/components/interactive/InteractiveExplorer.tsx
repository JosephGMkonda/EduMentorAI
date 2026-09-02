import { FaArrowsAlt, FaMousePointer } from "react-icons/fa";
import InteractiveAngle from "./InteractiveAngle";
import InteractiveForce from "./InteractiveForce";
import InteractiveParabola from "./InteractiveParabola";

interface Props {
  subject: string;
  topic: string;
}

const TITLES: Record<string, { title: string; icon: React.ReactNode }> = {
  angle: { title: "Angle Explorer", icon: <FaMousePointer /> },
  force: { title: "Force Resultant Lab", icon: <FaArrowsAlt /> },
  parabola: { title: "Parabola Explorer", icon: <FaMousePointer /> },
};

const pickInteractive = (subject: string, topic: string): "angle" | "force" | "parabola" | null => {
  const t = (topic || "").toLowerCase();
  if (subject === "mathematics") {
    if (/angle|triangle|geometry|measur/.test(t)) return "angle";
    if (/quadratic|parabola|equation|graph|function/.test(t)) return "parabola";
    return null;
  }
  if (subject === "physics" && /force|momentum|vector|resultant/.test(t)) return "force";
  return null;
};

const InteractiveExplorer = ({ subject, topic }: Props) => {
  const kind = pickInteractive(subject, topic);
  if (!kind) return null;
  const { title, icon } = TITLES[kind];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-violet-100 text-violet-600 p-3 rounded-lg">{icon}</div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500">
            Interactive &mdash; click and drag to explore
          </p>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden">
        {kind === "angle" && <InteractiveAngle />}
        {kind === "force" && <InteractiveForce />}
        {kind === "parabola" && <InteractiveParabola />}
      </div>
    </div>
  );
};

export default InteractiveExplorer;
