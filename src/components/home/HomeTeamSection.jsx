import { useTheme } from "../../layouts/ThemeContext";
import ScrollReveal from "./ScrollReveal";

const TEAM = [
  {
    name: "Dirk James Lepon",
    role: "Fullstack Developer & UI/UX Designer",
    bio: "Built the entire ExamNexus system end to end — from database and APIs to every screen, interaction, and visual design across the platform.",
    photo: "/team/dirk-lepon.png",
    accent: "from-emerald-500/20 to-teal-500/10",
  },
  {
    name: "Carolyn Maano",
    role: "Team Leader",
    bio: "Leads the project direction, coordinates deliverables, and keeps the team aligned on goals, timelines, and quality standards.",
    photo: "/team/carolyn-maano.png",
    accent: "from-cyan-500/20 to-sky-500/10",
  },
  {
    name: "April Rose Catana",
    role: "Documentation Specialist",
    bio: "Documents how ExamNexus works — its features, functions, and workflows — so users and stakeholders can understand the system clearly.",
    photo: "/team/april-catana.png",
    accent: "from-teal-500/20 to-emerald-500/10",
  },
  {
    name: "Ronel Dela Rama",
    role: "System Analyst",
    bio: "Analyzes requirements, maps system behavior, and ensures features meet institutional needs with accurate, actionable specifications.",
    photo: "/team/ronel-dela-rama.png",
    accent: "from-green-500/20 to-lime-500/10",
  },
];

export default function HomeTeamSection() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const cardClass = isDark ? "border-white/10 bg-white/[0.04]" : "en-home-card";
  const muted = isDark ? "text-gray-400" : "en-home-muted";

  return (
    <section id="team" className="en-home-band-alt relative w-full">
      <div className="en-home-wrap relative en-home-section">
        <div className="en-home-dot-field pointer-events-none absolute left-4 top-12 h-40 w-40 opacity-40" aria-hidden="true" />
        <div className="en-home-dot-field pointer-events-none absolute right-4 bottom-8 h-32 w-32 opacity-30" aria-hidden="true" />

        <ScrollReveal className="max-w-3xl">
          <p className="en-home-eyebrow">Our team</p>
          <h2 className="en-home-h2 mt-2">The team behind ExamNexus</h2>
          <p className={`mt-3 text-base sm:text-lg ${muted}`}>
            The people who brought ExamNexus to life — from design and development to analysis,
            documentation, and project leadership.
          </p>
        </ScrollReveal>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((member, index) => (
            <ScrollReveal key={member.name} delay={index * 90} direction="up">
              <article
                className={`en-home-team-card group relative h-full overflow-hidden rounded-2xl border p-4 lg:p-6 ${cardClass}`}
              >
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${member.accent} to-transparent opacity-80 lg:h-24`}
                  aria-hidden="true"
                />

                <div className="relative mx-auto mb-3 en-home-team-photo transition duration-300 group-hover:scale-105 lg:mb-4">
                  <div
                    className={`overflow-hidden rounded-2xl border-2 shadow-md ${
                      isDark ? "border-emerald-500/30" : "border-teal-700/20"
                    }`}
                  >
                    <img
                      src={member.photo}
                      alt={member.name}
                      className="aspect-[3/4] w-full object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                </div>

                <h3 className="en-home-h3 text-center text-base lg:text-xl">{member.name}</h3>
                <p
                  className={`mt-1 text-center text-[10px] font-semibold uppercase tracking-wide leading-snug lg:text-xs ${
                    isDark ? "text-emerald-400" : "text-teal-700"
                  }`}
                >
                  {member.role}
                </p>
                <p className={`en-home-team-bio mt-2 text-center text-xs leading-relaxed lg:mt-3 lg:text-sm ${muted}`}>
                  {member.bio}
                </p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
