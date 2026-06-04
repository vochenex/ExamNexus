import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="
        mb-6
        flex items-center gap-2
        px-5 py-3
        rounded-2xl

        bg-white/5
        border border-white/10
        backdrop-blur-sm

        text-emerald-400
        font-medium

        hover:bg-emerald-500/10
        hover:border-emerald-400/40
        hover:text-emerald-300

        hover:shadow-[0_0_25px_rgba(16,185,129,0.25)]
        hover:-translate-y-0.5

        active:scale-[0.98]

        transition-all
        duration-300
      "
    >
      <ArrowLeft size={18} />
      Back
    </button>
  );
}