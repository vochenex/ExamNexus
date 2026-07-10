import { Link, useLocation } from "react-router-dom";
import { Home, Info, Users, Mail, LogIn, LayoutDashboard } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { getCachedExamNexusUser } from "../../utils/authUser";
import { homeNavSectionFromHref, useHomeActiveSection } from "../../hooks/useHomeActiveSection";

const SECTION_LINKS = [
  { label: "Home", href: "#home", icon: Home },
  { label: "About", href: "#about", icon: Info },
  { label: "Team", href: "#team", icon: Users },
  { label: "Contact", href: "#contact", icon: Mail },
];

function dashboardPath(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") return "/admin/dashboard";
  if (normalized === "faculty") return "/faculty/dashboard";
  return "/student/dashboard";
}

export default function HomeBottomBar() {
  const { theme } = useTheme();
  const location = useLocation();
  const activeSection = useHomeActiveSection();
  const onHomePage = location.pathname === "/";
  const onAuthPage = location.pathname === "/auth";

  const cachedUser = getCachedExamNexusUser();
  const dashboardTo = cachedUser ? dashboardPath(cachedUser.role) : null;

  const isActive = (href) => {
    if (!onHomePage) return false;
    const section = homeNavSectionFromHref(href);
    if (activeSection === section) return true;
    if (section === "about" && activeSection === "how-it-works") return true;
    return false;
  };

  const iconActiveClass =
    theme === "dark" ? "en-tabbar-icon--active-dark" : "en-tabbar-icon--active-light";

  return (
    <nav
      className={`en-tabbar ${theme === "dark" ? "en-tabbar--dark" : "en-tabbar--light"}`}
      aria-label="Site navigation"
    >
      <div className="en-tabbar-inner">
        {SECTION_LINKS.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <a
              key={link.href}
              href={onHomePage ? link.href : `/${link.href}`}
              className="en-tabbar-item"
              aria-current={active ? "true" : undefined}
            >
              <span className={`en-tabbar-icon ${active ? iconActiveClass : ""}`}>
                <Icon size={21} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={`en-tabbar-label ${active ? "en-tabbar-label--active" : ""}`}>
                {link.label}
              </span>
            </a>
          );
        })}

        <Link
          to={dashboardTo || "/auth"}
          className="en-tabbar-item"
          aria-current={onAuthPage ? "page" : undefined}
        >
          <span className={`en-tabbar-icon ${onAuthPage ? iconActiveClass : ""}`}>
            {dashboardTo ? (
              <LayoutDashboard size={21} strokeWidth={onAuthPage ? 2.4 : 2} />
            ) : (
              <LogIn size={21} strokeWidth={onAuthPage ? 2.4 : 2} />
            )}
          </span>
          <span className={`en-tabbar-label ${onAuthPage ? "en-tabbar-label--active" : ""}`}>
            {dashboardTo ? "Dashboard" : "Login"}
          </span>
        </Link>
      </div>
    </nav>
  );
}
