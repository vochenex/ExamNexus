import ExamNexusLogo from "./ExamNexusLogo";

export default function ExamNexusBrand({
  variant = "compact",
  logoSize,
  className = "",
  showTagline = true,
  idSuffix = "default",
  panelTone = "default",
}) {
  const sizes = {
    hero: { logo: logoSize || 120, title: "text-4xl", tagline: "text-base" },
    panel: { logo: logoSize || 72, title: "text-2xl", tagline: "text-sm" },
    compact: { logo: logoSize || 40, title: "text-lg", tagline: "text-xs" },
    inline: { logo: logoSize || 32, title: "text-base", tagline: "text-[11px]" },
  };

  const config = sizes[variant] || sizes.compact;
  const isHero = variant === "hero";

  const logoFrameClass =
    panelTone === "dark"
      ? "rounded-3xl border border-white/20 bg-[#071918] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
      : panelTone === "light"
        ? "rounded-3xl border border-emerald-200/90 bg-white p-5 shadow-[0_20px_40px_rgba(16,94,70,0.12)] ring-1 ring-emerald-100"
        : isHero
          ? "rounded-3xl border border-white/20 bg-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          : "rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-1.5";

  const titleClass =
    panelTone === "dark"
      ? "text-white"
      : panelTone === "light"
        ? "text-emerald-950"
        : "bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent";

  const taglineClass =
    panelTone === "dark"
      ? "text-emerald-100/85"
      : panelTone === "light"
        ? "text-teal-800/80"
        : isHero
          ? "text-emerald-50/90 max-w-xs"
          : "text-gray-500 dark:text-gray-400 truncate";

  return (
    <div
      className={`flex items-center gap-3 ${isHero ? "flex-col text-center gap-4" : ""} ${className}`}
    >
      <div className={`relative shrink-0 ${logoFrameClass}`}>
        {isHero && panelTone === "default" && (
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 via-transparent to-transparent" />
        )}
        <ExamNexusLogo size={config.logo} showGlow idSuffix={idSuffix} />
      </div>

      <div className={isHero ? "space-y-1" : "min-w-0"}>
        <p className={`font-bold tracking-tight ${titleClass} ${config.title}`}>
          ExamNexus
        </p>
        {showTagline && (
          <p className={`${config.tagline} ${taglineClass}`}>
            Intelligent Assessment Platform
          </p>
        )}
      </div>
    </div>
  );
}
