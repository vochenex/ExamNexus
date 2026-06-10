import { panelClass } from "../../utils/themeInputs";

export function adminTableWrapClass(theme) {
  return `${panelClass(theme, "overflow-hidden p-0")}`;
}

export function adminTableClass(theme) {
  return `w-full text-sm ${
    theme === "dark" ? "text-gray-200" : "text-gray-800"
  }`;
}

export function adminThClass(theme) {
  return `px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${
    theme === "dark"
      ? "bg-white/[0.04] text-gray-400"
      : "en-bg-muted text-teal-800/80"
  }`;
}

export function adminTdClass(theme) {
  return `px-4 py-3 align-top border-t ${
    theme === "dark" ? "border-white/10" : "border-emerald-100"
  }`;
}

export function adminToolbarClass(theme) {
  return `mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`;
}
