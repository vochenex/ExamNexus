import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const SECTION_IDS = ["home", "about", "how-it-works", "team", "contact"];

export function useHomeActiveSection() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    if (location.pathname !== "/") {
      setActiveSection("");
      return undefined;
    }

    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean);
    if (!sections.length) return undefined;

    const updateActive = () => {
      const marker = window.innerHeight * 0.35;
      let current = sections[0]?.id || "home";

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= marker && rect.bottom > marker) {
          current = section.id;
          break;
        }
        if (rect.top < marker) {
          current = section.id;
        }
      }

      setActiveSection(current);
    };

    updateActive();

    const observer = new IntersectionObserver(
      () => updateActive(),
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.1, 0.25, 0.5] }
    );

    sections.forEach((section) => observer.observe(section));
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [location.pathname]);

  return activeSection;
}

export function homeNavSectionFromHref(href) {
  if (!href || !href.startsWith("#")) return "";
  return href.slice(1);
}
