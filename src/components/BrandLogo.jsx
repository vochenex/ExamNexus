import { GraduationCap, ShieldCheck, Sparkles } from "lucide-react";

const sizeMap = {
  sm: {
    wrap: "w-10 h-10 rounded-xl",
    mainIcon: "w-5 h-5",
    shieldIcon: "w-7 h-7",
    sparkIcon: "w-3.5 h-3.5",
    textWrap: "gap-0.5",
    title: "text-2xl",
    subtitle: "text-xs",
  },
  md: {
    wrap: "w-14 h-14 rounded-2xl",
    mainIcon: "w-7 h-7",
    shieldIcon: "w-10 h-10",
    sparkIcon: "w-4 h-4",
    textWrap: "gap-1",
    title: "text-3xl",
    subtitle: "text-sm",
  },
  hero: {
    wrap: "w-24 h-24 rounded-3xl",
    mainIcon: "w-11 h-11",
    shieldIcon: "w-16 h-16",
    sparkIcon: "w-5 h-5",
    textWrap: "gap-1.5",
    title: "text-5xl",
    subtitle: "text-base",
  },
};

export default function BrandLogo({
  theme = "dark",
  size = "md",
  showTagline = true,
  centered = false,
  onColor = false,
}) {
  const ui = sizeMap[size] || sizeMap.md;

  const badgeClass = onColor
    ? "bg-white/10 border border-white/20"
    : theme === "dark"
    ? "bg-[#0b1114]/70 border border-white/10"
    : "bg-white border border-emerald-300";

  const glowClass = onColor
    ? "from-white/20 via-cyan-100/20 to-emerald-200/20"
    : theme === "dark"
    ? "from-emerald-400/20 via-cyan-400/20 to-teal-400/20"
    : "from-emerald-200/50 via-cyan-200/50 to-teal-200/50";

  const primaryIconClass = onColor
    ? "text-white"
    : theme === "dark"
    ? "text-emerald-300"
    : "text-teal-700";

  const accentIconClass = onColor
    ? "text-cyan-100"
    : theme === "dark"
    ? "text-cyan-300"
    : "text-emerald-600";

  const titleClass = onColor
    ? "from-white via-cyan-100 to-emerald-100"
    : theme === "dark"
    ? "from-emerald-300 via-teal-300 to-cyan-300"
    : "from-teal-700 via-emerald-600 to-cyan-700";

  const subtitleClass = onColor
    ? "text-white/80"
    : theme === "dark"
    ? "text-gray-400"
    : "text-gray-700";

  return (
    <div className={`flex items-center gap-3 ${centered ? "justify-center text-center" : ""}`}>
      <div
        className={`
          relative
          ${ui.wrap}
          ${badgeClass}
          flex items-center justify-center
          overflow-hidden
          shadow-[0_0_30px_rgba(16,185,129,0.25)]
        `}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${glowClass}`} />
        <ShieldCheck
          strokeWidth={1.8}
          className={`absolute ${ui.shieldIcon} ${primaryIconClass} opacity-35`}
        />
        <GraduationCap strokeWidth={2.1} className={`relative ${ui.mainIcon} ${primaryIconClass}`} />
        <Sparkles
          strokeWidth={2.2}
          className={`absolute top-2 right-2 ${ui.sparkIcon} ${accentIconClass}`}
        />
      </div>

      <div className={`flex flex-col ${ui.textWrap}`}>
        <h1 className={`${ui.title} font-black bg-gradient-to-r ${titleClass} bg-clip-text text-transparent`}>
          ExamNexus
        </h1>
        {showTagline && (
          <p className={`${ui.subtitle} tracking-wide ${subtitleClass}`}>
            Intelligent Assessment Platform
          </p>
        )}
      </div>
    </div>
  );
}
