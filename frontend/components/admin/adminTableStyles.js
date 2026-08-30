import { panelClass } from "../../utils/themeInputs";

export function adminTableWrapClass(theme) {
  return `${panelClass(theme, "min-w-0 max-w-full overflow-x-auto overflow-y-visible p-0")} en-table-scroll`;
}

export function adminTableClass(theme) {
  return `w-full min-w-0 text-sm ${
    theme === "dark" ? "text-gray-200" : "text-gray-800"
  }`;
}

export function adminThClass(theme) {
  return `px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide sm:px-4 sm:py-3 sm:text-xs ${
    theme === "dark"
      ? "bg-white/[0.04] text-gray-400"
      : "en-bg-muted text-slate-600"
  }`;
}

export function adminTdClass(theme) {
  return `px-3 py-2.5 align-top border-t text-xs sm:px-4 sm:py-3 sm:text-sm ${
    theme === "dark" ? "border-white/10" : "border-slate-100"
  }`;
}

/** Compact inline notice — width fits content, not full bleed. */
export function adminNoticeClass(theme) {
  return `mb-4 inline-flex max-w-full items-center rounded-lg border px-3 py-2 text-sm ${
    theme === "dark"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-900"
  }`;
}

export function adminToolbarClass(_theme) {
  return "mb-5 flex min-w-0 flex-col gap-2 sm:gap-2.5 lg:flex-row lg:items-center lg:gap-3";
}

export function adminSearchWrapClass() {
  return "relative min-w-0 w-full lg:w-[min(100%,16rem)] lg:max-w-xs lg:shrink-0";
}

export function adminToolbarActionsClass() {
  return "flex min-w-0 w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:flex-nowrap lg:shrink-0";
}

export function adminFilterSelectClass() {
  return "w-full min-w-0 sm:w-[9.25rem] sm:max-w-[9.25rem] shrink-0";
}

export function adminToolbarButtonClass() {
  return "w-full shrink-0 sm:w-auto whitespace-nowrap";
}

export function adminTableInnerClass() {
  return "w-full max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain";
}
