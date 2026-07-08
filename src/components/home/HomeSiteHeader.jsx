import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import ThemeToggle from "../ThemeToggle";
import InstallIconButton from "../pwa/InstallIconButton";
import ExamNexusBrand from "../ExamNexusBrand";
import HomeBottomBar from "./HomeBottomBar";
import useMobileNav from "../../hooks/useMobileNav";
import { getCachedExamNexusUser } from "../../utils/authUser";
import { primaryButton } from "../../utils/themeButtons";
import { homeNavSectionFromHref, useHomeActiveSection } from "../../hooks/useHomeActiveSection";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Team", href: "#team" },
  { label: "Contact", href: "#contact" },
];

function dashboardPath(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") return "/admin/dashboard";
  if (normalized === "faculty") return "/faculty/dashboard";
  return "/student/dashboard";
}

export default function HomeSiteHeader() {
  const { theme } = useTheme();
  const location = useLocation();
  const mobileNav = useMobileNav();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSection = useHomeActiveSection();
  const navRef = useRef(null);
  const mobileNavRef = useRef(null);
  const linkRefs = useRef({});
  const mobileLinkRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false });
  const [mobileIndicator, setMobileIndicator] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    visible: false,
  });

  const cachedUser = getCachedExamNexusUser();
  const dashboardTo = cachedUser ? dashboardPath(cachedUser.role) : null;
  const onHomePage = location.pathname === "/";

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    closeMenu();
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNav) return undefined;
    document.body.classList.add("en-body-has-tabbar");
    return () => document.body.classList.remove("en-body-has-tabbar");
  }, [mobileNav]);

  const navHref = (href) => (onHomePage ? href : `/${href}`);

  const isNavActive = useCallback(
    (href) => {
      if (!onHomePage) return false;
      const section = homeNavSectionFromHref(href);
      if (activeSection === section) return true;
      if (section === "about" && activeSection === "how-it-works") return true;
      return false;
    },
    [activeSection, onHomePage]
  );

  const activeNavKey = (() => {
    if (location.pathname === "/auth") return "login";
    if (!onHomePage) return null;
    const match = NAV_LINKS.find((link) => isNavActive(link.href));
    return match?.href ?? "#home";
  })();

  const updateIndicator = useCallback(() => {
    const nav = navRef.current;
    const activeEl = activeNavKey ? linkRefs.current[activeNavKey] : null;

    if (!nav || !activeEl) {
      setIndicator((prev) => ({ ...prev, visible: false }));
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();

    setIndicator({
      left: elRect.left - navRect.left,
      width: elRect.width,
      visible: true,
    });
  }, [activeNavKey]);

  const updateMobileIndicator = useCallback(() => {
    const nav = mobileNavRef.current;
    const activeEl = activeNavKey ? mobileLinkRefs.current[activeNavKey] : null;

    if (!nav || !activeEl || !menuOpen) {
      setMobileIndicator((prev) => ({ ...prev, visible: false }));
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();

    setMobileIndicator({
      top: elRect.top - navRect.top,
      left: elRect.left - navRect.left,
      width: elRect.width,
      height: elRect.height,
      visible: true,
    });
  }, [activeNavKey, menuOpen]);

  useEffect(() => {
    updateIndicator();

    const nav = navRef.current;
    if (!nav) return undefined;

    const observer = new ResizeObserver(() => updateIndicator());
    observer.observe(nav);
    window.addEventListener("resize", updateIndicator);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const frame = requestAnimationFrame(() => updateMobileIndicator());
    const nav = mobileNavRef.current;
    if (!nav) return () => cancelAnimationFrame(frame);

    const observer = new ResizeObserver(() => updateMobileIndicator());
    observer.observe(nav);
    window.addEventListener("resize", updateMobileIndicator);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", updateMobileIndicator);
    };
  }, [menuOpen, updateMobileIndicator]);

  const setLinkRef = (key) => (node) => {
    if (node) linkRefs.current[key] = node;
    else delete linkRefs.current[key];
  };

  const setMobileLinkRef = (key) => (node) => {
    if (node) mobileLinkRefs.current[key] = node;
    else delete mobileLinkRefs.current[key];
  };

  const handleMobileNavClick = () => {
    closeMenu();
  };

  const scrollToMainContent = useCallback(() => {
    const target = document.getElementById("home") || document.getElementById("main-content");
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", onHomePage ? "#home" : "/#home");
  }, [onHomePage]);

  const handleLogoClick = (event) => {
    closeMenu();
    if (onHomePage) {
      event.preventDefault();
      scrollToMainContent();
    }
  };

  return (
    <>
      <header className="en-home-site-header">
        <div className="en-home-header-inner en-home-wrap">
          <Link
            to="/#home"
            className="min-w-0 shrink rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            onClick={handleLogoClick}
            aria-label="ExamNexus home — go to main content"
          >
            <ExamNexusBrand variant="compact" showTagline={false} panelTone="dark" />
          </Link>

          <nav ref={navRef} className="en-home-header-nav" aria-label="Primary navigation">
            <span
              className="en-home-nav-indicator"
              style={{
                width: indicator.width,
                transform: `translate(${indicator.left}px, -50%)`,
                opacity: indicator.visible ? 1 : 0,
              }}
              aria-hidden="true"
            />

            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                ref={setLinkRef(link.href)}
                href={navHref(link.href)}
                className={`en-home-nav-link${isNavActive(link.href) ? " en-home-nav-link--active" : ""}`}
                aria-current={isNavActive(link.href) ? "true" : undefined}
              >
                {link.label}
              </a>
            ))}
            {dashboardTo ? (
              <Link to={dashboardTo} className="en-home-nav-link ml-1">
                Dashboard
              </Link>
            ) : (
              <Link
                ref={setLinkRef("login")}
                to="/auth"
                className={`en-home-nav-link ml-1${location.pathname === "/auth" ? " en-home-nav-link--active" : ""}`}
                aria-current={location.pathname === "/auth" ? "page" : undefined}
              >
                Login
              </Link>
            )}
          </nav>

          <div className="en-home-header-actions">
            <InstallIconButton inverted compact />
            <ThemeToggle inverted compact />

            {!mobileNav && (
              <button
                type="button"
                className="en-home-menu-btn"
                aria-expanded={menuOpen}
                aria-controls="home-mobile-drawer"
                aria-label="Toggle navigation menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
      </header>

      {mobileNav && <HomeBottomBar />}

      {!mobileNav && menuOpen && (
        <div className="en-home-mobile-menu-root" role="presentation">
          <div
            className="en-home-mobile-overlay"
            onClick={closeMenu}
            aria-hidden="true"
          />
          <nav
            id="home-mobile-drawer"
            className="en-home-mobile-drawer"
            aria-label="Mobile navigation"
          >
            <div className="en-home-mobile-drawer-header">
              <span className="en-home-mobile-drawer-title">Menu</span>
              <button
                type="button"
                className="en-home-mobile-drawer-close"
                onClick={closeMenu}
                aria-label="Dismiss menu"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div ref={mobileNavRef} className="en-home-mobile-nav-list">
              <span
                className="en-home-mobile-nav-indicator"
                style={{
                  width: mobileIndicator.width,
                  height: mobileIndicator.height,
                  transform: `translate(${mobileIndicator.left}px, ${mobileIndicator.top}px)`,
                  opacity: mobileIndicator.visible ? 1 : 0,
                }}
                aria-hidden="true"
              />

              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  ref={setMobileLinkRef(link.href)}
                  href={navHref(link.href)}
                  className={`en-home-mobile-nav-link${isNavActive(link.href) ? " en-home-mobile-nav-link--active" : ""}`}
                  aria-current={isNavActive(link.href) ? "true" : undefined}
                  onClick={handleMobileNavClick}
                >
                  {link.label}
                </a>
              ))}
              {dashboardTo ? (
                <Link
                  to={dashboardTo}
                  className="en-home-mobile-nav-link"
                  onClick={handleMobileNavClick}
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  ref={setMobileLinkRef("login")}
                  to="/auth"
                  className={`en-home-mobile-nav-link${location.pathname === "/auth" ? " en-home-mobile-nav-link--active" : ""}`}
                  onClick={handleMobileNavClick}
                >
                  Login
                </Link>
              )}
              <Link
                to={dashboardTo || "/auth"}
                className={primaryButton(theme, "en-home-mobile-nav-cta w-full justify-center text-sm py-2.5")}
                onClick={handleMobileNavClick}
              >
                {dashboardTo ? "Open dashboard" : "Sign in to ExamNexus"}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
