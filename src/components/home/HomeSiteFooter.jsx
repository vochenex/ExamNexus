import { Link } from "react-router-dom";
import ExamNexusBrand from "../ExamNexusBrand";
import { useTheme } from "../../layouts/ThemeContext";

const FOOTER_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Team", href: "#team" },
  { label: "Contact", href: "#contact" },
  { label: "Login", to: "/auth" },
];

export default function HomeSiteFooter() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const muted = isDark ? "text-gray-400" : "en-home-muted";

  return (
    <footer
      className={`en-home-footer w-full border-t ${
        isDark ? "border-white/10 bg-black/20" : ""
      }`}
    >
      <div className="en-home-wrap grid gap-10 py-12 md:grid-cols-3 lg:grid-cols-4 xl:gap-14">
        <div className="md:col-span-1 lg:col-span-1">
          <ExamNexusBrand variant="inline" className="mb-3" panelTone="dark" />
          <p className={`max-w-sm text-sm leading-relaxed ${muted}`}>
            A secure assessment platform for students, faculty, and administrators — built for modern
            classrooms.
          </p>
        </div>

        <div>
          <h3 className="en-home-footer-h mb-3">Explore</h3>
          <ul className={`space-y-2 text-sm ${muted}`}>
            {FOOTER_LINKS.map((link) => (
              <li key={link.label}>
                {link.to ? (
                  <Link to={link.to} className="transition hover:text-emerald-400">
                    {link.label}
                  </Link>
                ) : (
                  <a href={link.href} className="transition hover:text-emerald-400">
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-1 lg:col-span-2">
          <h3 className="en-home-footer-h mb-3">Platform</h3>
          <ul className={`grid gap-2 text-sm sm:grid-cols-2 ${muted}`}>
            <li>AI-assisted exam creation</li>
            <li>Integrity monitoring</li>
            <li>Class analytics & grading</li>
            <li>Role-based dashboards</li>
          </ul>
        </div>
      </div>

      <div
        className={`en-home-footer-bar border-t py-5 text-center text-xs ${
          isDark ? "border-white/10 text-gray-500" : ""
        }`}
      >
        <p>© {new Date().getFullYear()} ExamNexus. All rights reserved.</p>
      </div>
    </footer>
  );
}
