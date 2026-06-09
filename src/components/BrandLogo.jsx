const sizeMap = {
  sm: {
    wrap: "w-10 h-10 rounded-xl",
    markIcon: "w-6 h-6",
    textWrap: "gap-0.5",
    title: "text-2xl",
    subtitle: "text-xs",
  },
  md: {
    wrap: "w-14 h-14 rounded-2xl",
    markIcon: "w-9 h-9",
    textWrap: "gap-1",
    title: "text-3xl",
    subtitle: "text-sm",
  },
  hero: {
    wrap: "w-24 h-24 rounded-3xl",
    markIcon: "w-16 h-16",
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
        <svg
          viewBox="0 0 64 64"
          className={`relative ${ui.markIcon} ${primaryIconClass}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="ExamNexus icon"
        >
          {/* Mortarboard top */}
          <path d="M32 6L56 16L32 27L8 16L32 6Z" fill="currentColor" />

          {/* Shield body */}
          <path
            d="M13 23V43L32 54L51 43V23"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Inner eye-like marks */}
          <path
            d="M21.5 36.5C24 34.3 27.5 34.3 30 36.5"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M34 36.5C36.5 34.3 40 34.3 42.5 36.5"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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
