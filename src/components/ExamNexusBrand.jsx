import ExamNexusLogo from "./ExamNexusLogo";

export default function ExamNexusBrand({
  variant = "compact",
  logoSize,
  className = "",
  showTagline = true,
  idSuffix = "default",
}) {
  const sizes = {
    hero: { logo: logoSize || 120, title: "text-4xl", tagline: "text-base" },
    panel: { logo: logoSize || 72, title: "text-2xl", tagline: "text-sm" },
    compact: { logo: logoSize || 40, title: "text-lg", tagline: "text-xs" },
    inline: { logo: logoSize || 32, title: "text-base", tagline: "text-[11px]" },
  };

  const config = sizes[variant] || sizes.compact;
  const isHero = variant === "hero";

  return (
    <div
      className={`flex items-center gap-3 ${isHero ? "flex-col text-center gap-4" : ""} ${className}`}
    >
      <div
        className={`relative shrink-0 ${isHero ? "rounded-3xl border border-white/20 bg-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]" : "rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-1.5"}`}
      >
        {isHero && (
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 via-transparent to-transparent" />
        )}
        <ExamNexusLogo size={config.logo} showGlow idSuffix={idSuffix} />
      </div>

      <div className={isHero ? "space-y-1" : "min-w-0"}>
        <p
          className={`font-bold tracking-tight bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent ${config.title}`}
        >
          ExamNexus
        </p>
        {showTagline && (
          <p
            className={`${config.tagline} ${isHero ? "text-emerald-50/90 max-w-xs" : "text-gray-500 dark:text-gray-400 truncate"}`}
          >
            Intelligent Assessment Platform
          </p>
        )}
      </div>
    </div>
  );
}
