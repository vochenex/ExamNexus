import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";

function getMainScroller() {
  // Dashboard scrolls a child `.en-scroll-region` inside `<main>`, not `<main>` itself.
  // Prefer the direct child so we never latch onto nested regions (e.g. notification list).
  return (
    document.querySelector("main > .en-scroll-region") ||
    document.querySelector("main.en-scroll-region")
  );
}

/**
 * Compact edge FABs for long create pages.
 * Portaled to document.body so `position: fixed` is not trapped by
 * `.en-page-route { will-change: transform }` (or other transform ancestors).
 *
 * Scroll down: any meaningful room below the viewport.
 * Back to top: after leaving the top (shows while scrolling, not only at bottom).
 */
export default function ScrollEdgeFab({
  edgeThreshold = 48,
  upThreshold = 120,
  minOverflow = 48,
  watchKey = "",
}) {
  const { theme } = useTheme();
  const [showDown, setShowDown] = useState(false);
  const [showUp, setShowUp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dark = theme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const scroller = getMainScroller();
    if (!scroller) return undefined;

    let frame = 0;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = scroller;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      if (maxScroll < minOverflow) {
        setShowDown(false);
        setShowUp(false);
        return;
      }
      const distanceFromBottom = maxScroll - scrollTop;
      setShowDown(distanceFromBottom > edgeThreshold);
      setShowUp(scrollTop > upThreshold);
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    const timers = [50, 150, 400, 900, 1600, 2800].map((ms) =>
      window.setTimeout(update, ms)
    );

    scroller.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleUpdate) : null;
    resizeObserver?.observe(scroller);
    Array.from(scroller.children).forEach((child) => resizeObserver?.observe(child));

    const mutationObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {
            scheduleUpdate();
            Array.from(scroller.children).forEach((child) =>
              resizeObserver?.observe(child)
            );
          })
        : null;
    mutationObserver?.observe(scroller, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((id) => window.clearTimeout(id));
      scroller.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [edgeThreshold, upThreshold, minOverflow, watchKey]);

  if (!mounted || (!showDown && !showUp)) return null;

  const btnClass = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-md backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.98] ${
    dark
      ? "border-emerald-400/30 bg-[#062a2c]/95 text-emerald-100 hover:border-emerald-300/50"
      : "border-teal-200/80 bg-white/95 text-teal-800 hover:border-teal-300"
  }`;

  const iconWrap = (bob) =>
    `inline-flex h-5 w-5 items-center justify-center rounded-full ${
      bob ? "en-scroll-fab-bob" : ""
    } ${dark ? "bg-emerald-500/20 text-emerald-300" : "bg-teal-100 text-teal-700"}`;

  const scrollTo = (top) => {
    const scroller = getMainScroller();
    if (!scroller) return;
    scroller.scrollTo({ top, behavior: "smooth" });
  };

  return createPortal(
    <div
      className="en-scroll-edge-fab fixed z-[120] flex flex-col-reverse items-end gap-2"
      style={{
        right: "max(0.85rem, env(safe-area-inset-right, 0px))",
      }}
    >
      {showDown && (
        <button
          type="button"
          onClick={() => {
            const scroller = getMainScroller();
            if (!scroller) return;
            scrollTo(scroller.scrollHeight);
          }}
          aria-label="Scroll down"
          title="Scroll down"
          className={btnClass}
        >
          <span className={iconWrap(true)}>
            <ArrowDown size={12} strokeWidth={2.5} />
          </span>
          <span className="max-w-[6.75rem] truncate">Scroll down</span>
        </button>
      )}
      {showUp && (
        <button
          type="button"
          onClick={() => scrollTo(0)}
          aria-label="Back to top"
          title="Back to top"
          className={btnClass}
        >
          <span className={iconWrap(false)}>
            <ArrowUp size={12} strokeWidth={2.5} />
          </span>
          <span className="max-w-[6.75rem] truncate">Back to top</span>
        </button>
      )}
    </div>,
    document.body
  );
}
