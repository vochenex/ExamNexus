import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "../../utils/motion";

export default function AnimatedPage({ children, className = "" }) {
  const location = useLocation();
  const containerRef = useRef(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    // Keep each route starting at the top of the dashboard main scroller
    // (otherwise long pages like Create Assessment open mid/bottom).
    const scrollToTop = () => {
      const mainScroller = document.querySelector("main.en-scroll-region");
      if (mainScroller) mainScroller.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    scrollToTop();
    const timers = [0, 80, 200].map((ms) => window.setTimeout(scrollToTop, ms));

    node.classList.remove("en-route-enter-active");
    // Force reflow so the enter animation replays on each navigation
    void node.offsetWidth;
    node.classList.add("en-route-enter-active");

    const timer = window.setTimeout(() => {
      node.classList.remove("en-route-enter-active");
    }, 500);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(timer);
    };
  }, [location.pathname, location.key]);

  return (
    <div
      ref={containerRef}
      key={location.pathname}
      className={`${motion.pageRoute} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
