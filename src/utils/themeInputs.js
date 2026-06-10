import { LIGHT_BG } from "./themeColors";
import { motion } from "./motion";

export function inputClass(theme, extra = "") {
  return `w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all duration-200 ${
    theme === "dark"
      ? "border border-white/10 bg-[#dff8f3]/10 text-white placeholder:text-gray-500"
      : `border border-emerald-200/80 ${LIGHT_BG.input} text-gray-900 placeholder:text-gray-500`
  } disabled:cursor-not-allowed disabled:opacity-70 focus:ring-2 focus:ring-emerald-500/30 ${extra}`;
}

export function selectClass(theme, extra = "") {
  return `en-select w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all duration-200 appearance-none pr-10 cursor-pointer ${
    theme === "dark"
      ? "border border-white/10 bg-[#0a1614] text-emerald-50 hover:border-emerald-500/35 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/25 disabled:bg-white/[0.04] disabled:text-gray-500"
      : `border border-emerald-200/80 ${LIGHT_BG.input} text-gray-900 hover:border-emerald-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-emerald-50/60 disabled:text-gray-500`
  } disabled:cursor-not-allowed disabled:opacity-70 ${extra}`;
}

export function selectChevronClass(theme) {
  return theme === "dark" ? "text-emerald-400/80" : "text-teal-600";
}

export function textareaClass(theme, extra = "") {
  return `${inputClass(theme)} resize-y min-h-[120px] ${extra}`;
}

export function cardClass(theme, extra = "") {
  return `rounded-2xl border p-5 ${motion.interactiveCard} ${
    theme === "dark"
      ? "bg-[#dff8f3]/5 border-white/10"
      : `${LIGHT_BG.surface} border-emerald-200/80 shadow-md`
  } ${extra}`;
}

export function panelClass(theme, extra = "") {
  return `rounded-2xl border p-5 ${motion.interactiveCard} ${
    theme === "dark"
      ? "bg-white/[0.04] border-white/10"
      : `${LIGHT_BG.surface} border-emerald-200/80 shadow-sm`
  } ${extra}`;
}

export function pageShellClass(theme, extra = "") {
  return `min-h-full p-6 md:p-8 ${
    theme === "dark" ? "text-white" : "text-gray-900"
  } ${extra}`;
}

/** Leaves room for the fixed notification bell in DashboardLayout. */
export function pageShellWithBellClass(theme, extra = "") {
  return pageShellClass(theme, `pr-16 md:pr-24 ${extra}`);
}

export function emptyStateClass(theme, extra = "") {
  return `rounded-2xl border border-dashed p-10 text-center en-scale-in ${
    theme === "dark"
      ? "border-white/10 text-gray-400"
      : `border-emerald-200/70 ${LIGHT_BG.muted} text-gray-600`
  } ${extra}`;
}

export function staggerGridClass(extra = "") {
  return `${motion.staggerGrid} ${extra}`.trim();
}

export { LIGHT_BG } from "./themeColors";
