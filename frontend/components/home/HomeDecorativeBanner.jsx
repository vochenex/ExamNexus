import { useTheme } from "../../layouts/ThemeContext";
import { PlatformNetworkIllustration } from "./HomeIllustrations";
import ScrollReveal from "./ScrollReveal";

const MARQUEE_ITEMS = [
  "Secure exams",
  "AI question generation",
  "Integrity monitoring",
  "Class analytics",
  "Role-based dashboards",
  "Real-time grading",
  "Question banks",
  "Campus-ready",
];

const STATS = [
  { value: "3", label: "User roles" },
  { value: "5+", label: "Question types" },
  { value: "24/7", label: "Platform access" },
];

export default function HomeDecorativeBanner() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <section
      className={`en-home-banner relative w-full overflow-hidden border-y en-home-section-tight ${
        isDark
          ? "border-emerald-500/15 bg-gradient-to-br from-emerald-950/80 via-[#031d1f] to-cyan-950/40"
          : ""
      }`}
      aria-label="Platform highlights"
    >
      <div className="en-home-hex-pattern pointer-events-none absolute inset-0 opacity-[0.45]" aria-hidden="true" />
      <div className="en-home-diagonal-stripes pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden="true" />

      <div className="en-home-wrap relative">
        <ScrollReveal direction="fade" className="mb-10 max-w-full overflow-hidden">
          <div className="en-home-marquee flex w-max max-w-none gap-10">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, index) => (
              <span
                key={`${item}-${index}`}
                className={`en-home-marquee-label flex shrink-0 items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] ${
                  isDark ? "text-emerald-300/70" : ""
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {item}
              </span>
            ))}
          </div>
        </ScrollReveal>

        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <ScrollReveal direction="up">
            <div className="max-w-2xl">
              <p className="en-home-eyebrow">The Nexus effect</p>
              <h2 className="en-home-h2 mt-2">
                Every role connected through one intelligent hub
              </h2>
              <p className="en-home-muted mt-3 text-sm leading-relaxed md:text-base">
                Students, faculty, and administrators orbit the same platform — sharing data,
                integrity signals, and insights without switching tools.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4 lg:max-w-2xl">
              {STATS.map((stat, index) => (
                <ScrollReveal key={stat.label} delay={index * 80} direction="up">
                  <div
                    className={`rounded-2xl border px-3 py-4 text-center ${
                      isDark ? "border-white/10 bg-white/[0.04]" : "en-home-stat-pill"
                    }`}
                  >
                    <p
                      className={`text-2xl font-black tabular-nums ${
                        isDark ? "text-emerald-300" : ""
                      }`}
                    >
                      {stat.value}
                    </p>
                    <p
                      className={`mt-1 text-[10px] font-semibold uppercase tracking-wide ${
                        isDark ? "text-gray-500" : ""
                      }`}
                    >
                      {stat.label}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal direction="left" delay={100} className="en-home-illus-banner">
            <div className="relative">
              <div
                className={`en-home-glow-ring absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${
                  isDark ? "bg-emerald-500/20" : "bg-emerald-500/18"
                }`}
                aria-hidden="true"
              />
              <PlatformNetworkIllustration className="relative mx-auto w-full max-w-2xl text-emerald-400" />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
