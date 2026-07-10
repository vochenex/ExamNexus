import { LIGHT_BG } from "./themeColors";
import { motion } from "./motion";

export function inputClass(theme, extra = "") {
  return `w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all duration-200 ${
    theme === "dark"
      ? "border border-white/10 bg-[#dff8f3]/10 text-white placeholder:text-gray-500"
      : `border border-slate-200/90 ${LIGHT_BG.input} text-[var(--en-text-primary)] placeholder:text-[var(--en-text-muted)]`
  } disabled:cursor-not-allowed disabled:opacity-70 focus:ring-2 focus:ring-teal-500/25 ${extra}`;
}

export function selectClass(theme, extra = "") {
  return `en-select relative w-full min-w-0 overflow-hidden rounded-xl py-2.5 pl-3.5 pr-11 text-sm outline-none transition-all duration-200 appearance-none cursor-pointer ${
    theme === "dark"
      ? "border border-white/10 bg-[#0a1614] text-emerald-50 hover:border-emerald-500/35 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/25 disabled:bg-white/[0.04] disabled:text-gray-500"
      : `border border-slate-200/90 ${LIGHT_BG.input} text-[var(--en-text-primary)] hover:border-teal-400/50 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:text-[var(--en-text-muted)]`
  } disabled:cursor-not-allowed disabled:opacity-70 ${extra}`;
}

export function selectChevronClass(theme) {
  return theme === "dark" ? "text-emerald-400/80" : "text-teal-600";
}

export function textareaClass(theme, extra = "") {
  return `${inputClass(theme)} resize-y min-h-[120px] ${extra}`;
}

export function cardClass(theme, extra = "") {
  return `rounded-3xl border p-5 backdrop-blur-md ${motion.interactiveCard} ${
    theme === "dark"
      ? "bg-white/[0.04] border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
      : `${LIGHT_BG.surface} border-slate-200/80 en-panel-glow`
  } ${extra}`;
}

export function panelClass(theme, extra = "") {
  return `rounded-3xl border p-5 backdrop-blur-md ${motion.interactiveCard} ${
    theme === "dark"
      ? "bg-white/[0.045] border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
      : `${LIGHT_BG.surface} border-slate-200/80 en-panel-glow`
  } ${extra}`;
}

export function pageShellClass(theme, extra = "") {
  return `en-page-shell min-h-full w-full max-w-full min-w-0 bg-transparent p-4 sm:p-6 md:p-8 ${
    theme === "dark" ? "text-white" : "en-text-primary"
  } ${extra}`;
}

/** Leaves room for the fixed notification bell in DashboardLayout (web only). */
export function pageShellWithBellClass(theme, extra = "") {
  const native =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("en-native-app");
  const bellPad = native ? "" : "pr-16 md:pr-24";
  return pageShellClass(theme, `${bellPad} ${extra}`.trim());
}

export function emptyStateClass(theme, extra = "") {
  return `rounded-3xl border border-dashed p-8 text-center backdrop-blur-md en-scale-in ${
    theme === "dark"
      ? "border-white/10 bg-white/[0.03] text-gray-400"
      : `border-slate-200/80 ${LIGHT_BG.muted} en-text-muted`
  } ${extra}`;
}

export function staggerGridClass(extra = "") {
  return `${motion.staggerGrid} ${extra}`.trim();
}

export { LIGHT_BG } from "./themeColors";
