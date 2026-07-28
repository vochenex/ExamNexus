import { panelClass } from "../../utils/themeInputs";

export function adminTableWrapClass(theme) {
  return `${panelClass(theme, "min-w-0 max-w-full overflow-x-auto p-0")} en-table-scroll`;
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

export function adminToolbarClass(theme) {
  return `mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`;
}
