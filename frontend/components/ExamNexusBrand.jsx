import { useTheme } from "../layouts/ThemeContext";
import ExamNexusLogo from "./ExamNexusLogo";

export default function ExamNexusBrand({
  variant = "compact",
  logoSize,
  className = "",
  showTagline = true,
  idSuffix = "default",
  panelTone = "default",
}) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const sizes = {
    hero: { logo: logoSize || 120, title: "text-4xl", tagline: "text-base" },
    panel: { logo: logoSize || 72, title: "text-2xl", tagline: "text-sm" },
    compact: { logo: logoSize || 40, title: "text-lg", tagline: "text-xs" },
    inline: { logo: logoSize || 32, title: "text-base", tagline: "text-[11px]" },
  };

  const config = sizes[variant] || sizes.compact;
  const isHero = variant === "hero";
  const tone = panelTone === "default" ? (isLight ? "light" : "dark") : panelTone;

  const logoFrameClass =
    tone === "dark"
      ? isHero
        ? "rounded-3xl border border-white/15 bg-[#0a1018] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
        : "rounded-xl border border-white/15 bg-[#0a1018] p-1.5 shadow-sm ring-1 ring-white/10"
      : tone === "light"
        ? isHero
          ? "rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.1)] ring-1 ring-slate-200/60"
          : "rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
        : isHero
          ? "rounded-3xl border border-white/20 bg-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          : "rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-1.5";

  const titleClass =
    tone === "dark"
      ? "text-white"
      : tone === "light"
        ? "text-[#030712]"
        : "bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent";

  const taglineClass =
    tone === "dark"
      ? "text-slate-300"
      : tone === "light"
        ? "text-slate-600"
        : isHero
          ? "text-emerald-50/90 max-w-xs"
          : "text-gray-500 dark:text-gray-400 truncate";

  return (
    <div
      className={`flex items-center gap-3 ${isHero ? "flex-col text-center gap-4" : ""} ${className}`}
    >
      <div className={`relative shrink-0 ${logoFrameClass}`}>
        {isHero && tone === "dark" && (
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
