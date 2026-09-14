import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";

function getMainScroller() {
  return document.querySelector("main.en-scroll-region");
}

/**
 * Compact edge FAB for long create pages:
 * near top → scroll down; after a short scroll → back to top.
 */
export default function ScrollEdgeFab({ topThreshold = 80 }) {
  const { theme } = useTheme();
  const [mode, setMode] = useState("hidden"); // "down" | "up" | "hidden"
  const dark = theme === "dark";

  useEffect(() => {
    const scroller = getMainScroller();
    if (!scroller) return undefined;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = scroller;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      if (maxScroll < 140) {
        setMode("hidden");
        return;
      }
      setMode(scrollTop <= topThreshold ? "down" : "up");
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(scroller);

    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [topThreshold]);

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
      className={`en-scroll-edge-fab fixed z-40 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-md backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.98] ${
        dark
          ? "border-emerald-400/30 bg-[#062a2c]/90 text-emerald-100 hover:border-emerald-300/50"
          : "border-teal-200/80 bg-white/90 text-teal-800 hover:border-teal-300"
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
