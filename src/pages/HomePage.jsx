import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import HomeSiteHeader from "../components/home/HomeSiteHeader";
import HomeSiteFooter from "../components/home/HomeSiteFooter";
import HomeDecorativeBanner from "../components/home/HomeDecorativeBanner";
import HomeTeamSection from "../components/home/HomeTeamSection";
import ScrollReveal from "../components/home/ScrollReveal";
import {
  AdminIllustration,
  FacultyIllustration,
  HeroIllustration,
  StudentIllustration,
} from "../components/home/HomeIllustrations";
import { getCachedExamNexusUser } from "../utils/authUser";
import { DEFAULT_SITE_META } from "../utils/pageMeta";
import usePageMeta from "../hooks/usePageMeta";
import { primaryButton, secondaryButton } from "../utils/themeButtons";
import "../styles/home.css";

const ROLES = [
  {
    key: "student",
    title: "Students",
    icon: GraduationCap,
    illustration: StudentIllustration,
    description:
      "Take secure online exams, track your scores, join subjects with an invite code, and review results when your teacher releases them.",
    bullets: ["Timed assessments", "Instant feedback", "Subject communities"],
  },
  {
    key: "faculty",
    title: "Faculty",
    icon: BookOpen,
    illustration: FacultyIllustration,
    description:
      "Build question banks, create AI-assisted exams, monitor integrity alerts, and analyze class performance in one place.",
    bullets: ["AI question generation", "Integrity monitoring", "Class analytics"],
  },
  {
    key: "admin",
    title: "Administrators",
    icon: Users,
    illustration: AdminIllustration,
    description:
      "Approve accounts, manage subjects and catalogs, oversee assessments, and keep the whole institution running smoothly.",
    bullets: ["Account approvals", "Platform oversight", "Exports & logs"],
  },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI-powered assessments",
    text: "Generate quizzes from prompts or documents with smart batching and faculty review before publish.",
  },
  {
    icon: ShieldCheck,
    title: "Exam integrity",
    text: "Fullscreen lockdown, tab-switch detection, and auto-submit after repeated violations keep exams fair.",
  },
  {
    icon: BarChart3,
    title: "Rich analytics",
    text: "Question difficulty, time-on-task, and class standings help teachers spot who needs support.",
  },
  {
    icon: ClipboardCheck,
    title: "Flexible formats",
    text: "Multiple choice, enumeration, identification, true/false, and essay — with per-format grading rules.",
  },
];

const STEPS = [
  { step: "01", title: "Join your class", text: "Students enroll with a subject invite code; faculty manage rosters and sections." },
  { step: "02", title: "Create & schedule", text: "Teachers build assessments manually, from the question bank, or with AI assistance." },
  { step: "03", title: "Take with confidence", text: "Students complete secure timed exams with clear instructions and integrity rules." },
  { step: "04", title: "Review & improve", text: "Scores, analytics, and integrity reports help everyone learn from each attempt." },
];

function dashboardPath(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") return "/admin/dashboard";
  if (normalized === "faculty") return "/faculty/dashboard";
  return "/student/dashboard";
}

export default function HomePage() {
  const { theme } = useTheme();
  const location = useLocation();
  const cachedUser = getCachedExamNexusUser();
  const dashboardTo = cachedUser ? dashboardPath(cachedUser.role) : null;
  const isDark = theme === "dark";

  usePageMeta({
    title: DEFAULT_SITE_META.title,
    description: DEFAULT_SITE_META.description,
    canonical: `${window.location.origin}/`,
  });

  useEffect(() => {
    if (location.hash !== "#home") return undefined;

    const frame = requestAnimationFrame(() => {
      const target = document.getElementById("home");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);

  const shellClass = isDark
    ? "en-home-shell min-h-screen w-full max-w-[100vw] overflow-x-clip bg-[#031d1f] text-white"
    : "en-home-shell min-h-screen w-full max-w-[100vw] overflow-x-clip";

  const mutedText = isDark ? "text-gray-400" : "en-home-muted";
  const cardClass = isDark ? "border-white/10 bg-white/[0.04]" : "en-home-card";

  return (
    <div className={shellClass}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="absolute -right-24 bottom-20 h-[380px] w-[380px] rounded-full bg-cyan-500/12 blur-[100px]" />
        <div
          className={`en-home-grid-overlay absolute inset-0 bg-[size:48px_48px] ${
            isDark
              ? "opacity-[0.035] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)]"
              : ""
          }`}
        />
      </div>

      <HomeSiteHeader />

      <main className="relative w-full" id="main-content">
        <section id="home" className="w-full">
          <div className="en-home-wrap en-home-section-tight pb-10 pt-8 sm:pb-14 sm:pt-12 md:pb-20 md:pt-16">
            <div className="grid items-center gap-8 sm:gap-10 xl:grid-cols-2 xl:gap-16 2xl:gap-24">
              <ScrollReveal direction="up" className="space-y-6">
                <p
                  className={`en-home-eyebrow inline-flex items-center gap-2 rounded-full border px-3 py-1 ${
                    isDark
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "en-home-chip"
                  }`}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  Intelligent Assessment Platform
                </p>
                <h1 className="en-home-h1">
                  Assess smarter.
                  <span className="en-home-gradient-text block">Learn better.</span>
                </h1>
                <p className={`max-w-2xl text-base leading-relaxed sm:text-lg xl:text-xl ${mutedText}`}>
                  ExamNexus connects students, faculty, and administrators in one secure hub for
                  creating, taking, and analyzing assessments — with AI assistance and built-in
                  exam integrity.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link to={dashboardTo || "/auth"} className={primaryButton(theme)}>
                    {dashboardTo ? "Go to dashboard" : "Start for free"}
                    <ArrowRight size={18} />
                  </Link>
                  <a href="#about" className={secondaryButton(theme)}>
                    Learn more
                  </a>
                </div>
              </ScrollReveal>

              <ScrollReveal direction="right" delay={120} className="en-home-hero-illus-wrap relative">
                <div className="en-home-dot-field pointer-events-none absolute -left-6 top-8 h-24 w-24 opacity-50" aria-hidden="true" />
                <div className="en-home-dot-field pointer-events-none absolute -right-4 bottom-4 h-20 w-20 opacity-40" aria-hidden="true" />
                <div
                  className={`en-home-orbit absolute left-1/2 top-1/2 h-[min(100%,380px)] w-[min(100%,380px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed ${
                    isDark ? "border-emerald-500/25" : "border-teal-600/30"
                  }`}
                />
                <div
                  className={`en-home-float-delay en-home-shape-accent-cyan absolute right-4 top-6 h-14 w-14 rounded-2xl border rotate-12 ${
                    isDark ? "border-cyan-400/30 bg-cyan-500/10" : ""
                  }`}
                  aria-hidden="true"
                />
                <div
                  className={`en-home-float en-home-shape-accent absolute left-2 bottom-16 h-10 w-10 rounded-full border ${
                    isDark ? "border-emerald-400/30 bg-emerald-500/10" : ""
                  }`}
                  aria-hidden="true"
                />
                <HeroIllustration className="en-home-float-slow relative mx-auto w-full max-w-xl text-emerald-400" />
              </ScrollReveal>
            </div>
          </div>
        </section>

        <HomeDecorativeBanner />

        <section id="about" className="en-home-band w-full">
          <div className="en-home-wrap en-home-section">
            <ScrollReveal className="max-w-3xl">
              <p className="en-home-eyebrow">About</p>
              <h2 className="en-home-h2 mt-2">One platform for the whole campus</h2>
              <p className={`mt-4 text-base leading-relaxed sm:text-lg xl:text-xl ${mutedText}`}>
                ExamNexus was built to simplify how schools run digital assessments. From enrollment
                and scheduling to secure exam delivery and post-exam analytics, every role gets tools
                designed for real classroom workflows — not generic quiz software.
              </p>
              <p className={`mt-3 text-base leading-relaxed sm:text-lg ${mutedText}`}>
                Faculty save hours with AI-assisted question generation and reusable banks. Students
                get a clear, fair testing experience. Administrators retain oversight with approvals,
                logs, and exports.
              </p>
            </ScrollReveal>

            <div className="mt-10 lg:mt-12">
              <ScrollReveal className="max-w-xl">
                <h3 className="en-home-h3">Built for everyone on campus</h3>
                <p className={`mt-3 text-base sm:text-lg ${mutedText}`}>
                  Whether you are taking an exam, teaching a class, or running the platform — ExamNexus
                  has a tailored experience for you.
                </p>
              </ScrollReveal>

              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:mt-8 lg:grid-cols-3">
                {ROLES.map((role, index) => {
                  const Icon = role.icon;
                  const Illustration = role.illustration;
                  return (
                    <ScrollReveal key={role.key} delay={index * 90} direction="up">
                      <article className={`h-full rounded-2xl border p-5 lg:p-6 ${cardClass}`}>
                        <Illustration className="en-home-role-illus mx-auto mb-4 h-36 w-full max-w-[240px] lg:h-40" />
                        <h4 className="en-home-h4 mb-2 flex items-center gap-2">
                          <Icon size={18} className="shrink-0 text-emerald-400" aria-hidden="true" />
                          {role.title}
                        </h4>
                        <p className={`mb-3 text-sm leading-relaxed lg:mb-4 lg:text-base ${mutedText}`}>
                          {role.description}
                        </p>
                        <ul className={`space-y-1.5 text-sm ${mutedText}`}>
                          {role.bullets.map((bullet) => (
                            <li key={bullet} className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      </article>
                    </ScrollReveal>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="w-full">
          <div className="en-home-wrap en-home-section">
            <ScrollReveal className="max-w-3xl">
              <h2 className="en-home-h2">How ExamNexus works</h2>
              <p className={`mt-3 text-base sm:text-lg ${mutedText}`}>
                From enrollment to results — a clear flow that keeps students focused and teachers
                informed.
              </p>
            </ScrollReveal>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item, index) => (
                <ScrollReveal key={item.step} delay={index * 80} direction="up">
                  <div className={`flex h-full gap-4 rounded-2xl border p-5 lg:p-6 ${cardClass}`}>
                    <span
                      className={`shrink-0 text-xl font-black lg:text-2xl ${
                        isDark ? "text-emerald-400/80" : "en-home-heading"
                      }`}
                    >
                      {item.step}
                    </span>
                    <div>
                      <h4 className="en-home-h4 mb-1">{item.title}</h4>
                      <p className={`text-sm leading-relaxed lg:text-base ${mutedText}`}>{item.text}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="en-home-band w-full">
          <div className="en-home-wrap en-home-section">
            <ScrollReveal className="max-w-3xl">
              <h2 className="en-home-h2">Tools that save time and raise standards</h2>
              <p className={`mt-3 text-lg ${mutedText}`}>
                Powerful features behind a simple interface — designed for real classrooms.
              </p>
            </ScrollReveal>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <ScrollReveal key={feature.title} delay={index * 70} direction="scale">
                    <div className={`h-full rounded-xl border p-4 lg:p-5 ${cardClass}`}>
                      <Icon size={22} className="mb-2 text-emerald-400" aria-hidden="true" />
                      <h4 className="en-home-h4 mb-1">{feature.title}</h4>
                      <p className={`text-sm leading-relaxed lg:text-base ${mutedText}`}>
                        {feature.text}
                      </p>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </section>

        <HomeTeamSection />

        <section id="contact" className="w-full">
          <div className="en-home-wrap en-home-section">
            <ScrollReveal className="max-w-3xl">
              <p className="en-home-eyebrow">Contact</p>
              <h2 className="en-home-h2 mt-2">Get in touch</h2>
              <p className={`mt-3 text-base sm:text-lg ${mutedText}`}>
                Questions about onboarding, accounts, or technical support? Reach out to your
                institution&apos;s ExamNexus administrator or sign in if you already have access.
              </p>
            </ScrollReveal>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <ScrollReveal delay={0}>
                <div className={`h-full rounded-2xl border p-5 lg:p-6 ${cardClass}`}>
                  <Mail size={22} className="mb-3 text-emerald-400" aria-hidden="true" />
                  <h4 className="en-home-h4 mb-1">Email</h4>
                  <p className={`text-sm lg:text-base ${mutedText}`}>
                    <a href="mailto:support@examnexus.app" className="text-emerald-500 hover:underline">
                      support@examnexus.app
                    </a>
                  </p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={80}>
                <div className={`h-full rounded-2xl border p-5 lg:p-6 ${cardClass}`}>
                  <MapPin size={22} className="mb-3 text-emerald-400" aria-hidden="true" />
                  <h4 className="en-home-h4 mb-1">Campus</h4>
                  <p className={`text-sm leading-relaxed lg:text-base ${mutedText}`}>
                    CRMC and partner institutions using ExamNexus for digital assessments.
                  </p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={160}>
                <div className={`h-full rounded-2xl border p-5 lg:p-6 ${cardClass}`}>
                  <Users size={22} className="mb-3 text-emerald-400" aria-hidden="true" />
                  <h4 className="en-home-h4 mb-1">Account access</h4>
                  <p className={`mb-4 text-sm lg:text-base ${mutedText}`}>
                    Students and faculty need an approved account to use the platform.
                  </p>
                  <Link to="/auth" className={primaryButton(theme, "text-sm px-4 py-2")}>
                    Login / Register
                  </Link>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section className="en-home-band w-full pb-24 pt-8">
          <div className="en-home-wrap">
            <ScrollReveal direction="scale">
              <div
                className={`en-home-cta relative overflow-hidden rounded-3xl border p-10 text-center md:p-14 lg:p-16 ${
                  isDark
                    ? "border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-cyan-500/10"
                    : ""
                }`}
              >
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
                <h2 className="en-home-h2">Ready to transform your assessments?</h2>
                <p className={`mx-auto mt-3 max-w-2xl text-lg ${mutedText}`}>
                  Join ExamNexus today — create your account in minutes and experience a modern exam
                  platform built for your campus.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link to={dashboardTo || "/auth"} className={primaryButton(theme)}>
                    {dashboardTo ? "Open dashboard" : "Create account"}
                  </Link>
                  <Link to="/auth" className={secondaryButton(theme)}>
                    Login
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <HomeSiteFooter />
    </div>
  );
}
