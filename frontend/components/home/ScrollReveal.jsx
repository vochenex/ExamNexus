import { useRef } from "react";
import { useScrollReveal } from "../../hooks/useScrollReveal";

export default function ScrollReveal({
  children,
  className = "",
  direction = "up",
  delay = 0,
  fadeOut = true,
  as: Tag = "div",
}) {
  const ref = useRef(null);
  useScrollReveal(ref, { fadeOut });

  return (
    <Tag
      ref={ref}
      className={`en-scroll-reveal en-scroll-reveal--${direction} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
