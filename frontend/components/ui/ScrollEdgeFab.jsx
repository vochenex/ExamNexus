import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";

function getMainScroller() {
  return document.querySelector("main.en-scroll-region");
}

/**
 * Compact edge FAB for long create pages:
 * near top → scroll down; after a short scroll → back to top.
 *
 * `watchKey` should change when page content grows (AI generation, questions, etc.)
 * so the button reappears even though the scroller's own box size stays the same.
 */
export default function ScrollEdgeFab({
  topThreshold = 64,
  minOverflow = 80,
  watchKey = "",
}) {
  const { theme } = useTheme();
  const [mode, setMode] = useState("hidden"); // "down" | "up" | "hidden"
  const dark = theme === "dark";

  useEffect(() => {
    const scroller = getMainScroller();
    if (!scroller) return undefined;

    let frame = 0;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = scroller;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      if (maxScroll < minOverflow) {
        setMode("hidden");
        return;
      }
      setMode(scrollTop <= topThreshold ? "down" : "up");
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    // Content often grows a beat after React commit (progress UI, question cards).
    const timers = [50, 150, 400, 900].map((ms) => window.setTimeout(update, ms));

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
  }, [topThreshold, minOverflow, watchKey]);

  if (mode === "hidden") return null;

  const goingDown = mode === "down";
  const label = goingDown ? "Scroll down" : "Back to top";
  const Icon = goingDown ? ArrowDown : ArrowUp;

  const handleClick = () => {
    const scroller = getMainScroller();
    if (!scroller) return;
    scroller.scrollTo({
      top: goingDown ? scroller.scrollHeight : 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={`en-scroll-edge-fab fixed z-[60] inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-md backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.98] ${
        dark
          ? "border-emerald-400/30 bg-[#062a2c]/95 text-emerald-100 hover:border-emerald-300/50"
          : "border-teal-200/80 bg-white/95 text-teal-800 hover:border-teal-300"
      }`}
      style={{
        right: "max(0.85rem, env(safe-area-inset-right, 0px))",
        bottom: "max(5.25rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))",
      }}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition-transform duration-300 ${
          goingDown ? "en-scroll-fab-bob" : ""
        } ${
          dark ? "bg-emerald-500/20 text-emerald-300" : "bg-teal-100 text-teal-700"
        }`}
      >
        <Icon size={12} strokeWidth={2.5} />
      </span>
      <span className="max-w-[6.75rem] truncate">{label}</span>
    </button>
  );
}
