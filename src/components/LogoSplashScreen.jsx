import ExamNexusLogo from "./ExamNexusLogo";

export default function LogoSplashScreen({ theme = "dark", exiting = false }) {
  const isDark = theme !== "light";

  return (
    <div
      className={`en-splash-screen fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6 ${
        exiting ? "en-splash-screen--exit" : ""
      } ${
        isDark
          ? "bg-gradient-to-br from-[#021818] via-[#031d1f] to-[#052a28] text-white"
          : "en-bg-page bg-gradient-to-br from-[#dcefea] via-[#c8e8de] to-[#b8e4d4] text-gray-900"
      }`}
      role="status"
      aria-live="polite"
      aria-label="Loading ExamNexus"
    >
      <div
        className={`pointer-events-none absolute inset-0 ${
          isDark
            ? "bg-[radial-gradient(circle_at_50%_40%,rgba(45,212,191,0.14),transparent_55%)]"
            : "bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.75),transparent_55%)]"
        }`}
      />

      <div
        className={`pointer-events-none absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px] ${
          isDark ? "" : "opacity-[0.07]"
        }`}
      />

      <div className="relative flex flex-col items-center">
        <div className="relative mb-8 flex h-36 w-36 items-center justify-center">
          <div
            className={`en-splash-ring-glow absolute inset-0 rounded-full ${
              isDark
                ? "bg-emerald-400/10 blur-2xl"
                : "bg-emerald-500/15 blur-2xl"
            }`}
          />

          <div
            className={`en-splash-ring absolute inset-0 rounded-full border-2 border-transparent ${
              isDark
                ? "bg-[conic-gradient(from_0deg,transparent_0deg,rgba(52,211,153,0.85)_120deg,transparent_240deg,rgba(34,211,238,0.85)_300deg,transparent_360deg)] [mask:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_calc(100%-2px))]"
                : "bg-[conic-gradient(from_0deg,transparent_0deg,rgba(16,185,129,0.9)_120deg,transparent_240deg,rgba(6,182,212,0.85)_300deg,transparent_360deg)] [mask:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_calc(100%-2px))]"
            }`}
            aria-hidden="true"
          />

          <div
            className={`en-splash-logo relative flex items-center justify-center rounded-3xl border p-4 shadow-2xl ${
              isDark
                ? "border-emerald-500/25 bg-[#071918]/90 shadow-emerald-500/10"
                : "border-emerald-200/90 en-bg-elevated shadow-emerald-500/15"
            }`}
          >
            <ExamNexusLogo size={88} showGlow idSuffix="splash" animated />
          </div>
        </div>

        <h1
          className={`en-splash-title text-3xl font-black tracking-tight md:text-4xl ${
            isDark
              ? "bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent"
              : "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent"
          }`}
        >
          ExamNexus
        </h1>

        <p
          className={`en-splash-tagline mt-2 text-sm font-medium ${
            isDark ? "text-emerald-100/75" : "text-teal-800/75"
          }`}
        >
          Intelligent Assessment Platform
        </p>

        <div
          className={`en-splash-progress-track mt-10 h-1 w-44 overflow-hidden rounded-full ${
            isDark ? "bg-white/10" : "bg-emerald-200/80"
          }`}
        >
          <div
            className={`en-splash-progress-bar h-full w-2/5 rounded-full ${
              isDark
                ? "bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400"
                : "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"
            }`}
          />
        </div>

        <div className="en-splash-dots mt-5 flex items-center gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${
                isDark ? "bg-emerald-400/80" : "bg-teal-600/80"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
