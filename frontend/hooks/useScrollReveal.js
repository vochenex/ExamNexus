import { useEffect } from "react";

export function useScrollReveal(
  ref,
  { threshold = 0.12, fadeOut = true, rootMargin = "0px 0px 6% 0px" } = {}
) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const prefersMobile = window.matchMedia("(max-width: 1023px)").matches;
    const fadeOutEnabled = fadeOut && !prefersMobile;

    if (prefersReduced) {
      node.classList.add("en-scroll-reveal--visible");
      node.classList.remove("en-scroll-reveal--hidden", "en-scroll-reveal--no-pointer");
      return undefined;
    }

    const reveal = () => {
      node.classList.add("en-scroll-reveal--visible");
      node.classList.remove("en-scroll-reveal--hidden", "en-scroll-reveal--no-pointer");
    };

    const hide = () => {
      node.classList.remove("en-scroll-reveal--visible");
      node.classList.add("en-scroll-reveal--hidden", "en-scroll-reveal--no-pointer");
    };

    node.classList.add("en-scroll-reveal--hidden", "en-scroll-reveal--no-pointer");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          return;
        }

        if (fadeOutEnabled) {
          hide();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(node);

    requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top < viewportHeight * 0.94 && rect.bottom > 0) {
        reveal();
      }
    });

    return () => observer.disconnect();
  }, [fadeOut, rootMargin, threshold]);
}
