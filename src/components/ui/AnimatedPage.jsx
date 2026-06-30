import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "../../utils/motion";

export default function AnimatedPage({ children, className = "" }) {
  const location = useLocation();
  const containerRef = useRef(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    node.classList.remove("en-route-enter-active");
    // Force reflow so the enter animation replays on each navigation
    void node.offsetWidth;
    node.classList.add("en-route-enter-active");

    const timer = window.setTimeout(() => {
      node.classList.remove("en-route-enter-active");
    }, 500);

    return () => window.clearTimeout(timer);
  }, [location.pathname]);

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
