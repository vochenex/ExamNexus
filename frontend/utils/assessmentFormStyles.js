export function inputClass(theme, invalid = false) {
  return `w-full p-3 rounded-xl text-sm transition focus:outline-none focus:ring-2 ${
    invalid
      ? "border border-red-500 ring-2 ring-red-400 focus:ring-red-400"
      : "focus:ring-emerald-400"
  } ${
    theme === "dark"
      ? invalid
        ? "bg-white/10 text-white placeholder:text-gray-500"
        : "bg-white/10 text-white placeholder:text-gray-500 border border-white/10"
      : invalid
        ? "en-bg-elevated text-gray-900 placeholder:text-gray-400"
        : "en-bg-elevated text-gray-900 placeholder:text-gray-400 border border-emerald-200"
  }`;
}

export function assessmentPanelClass(theme) {
  return `box-border h-fit min-w-0 max-w-full rounded-2xl border p-4 sm:p-5 ${
    theme === "dark"
      ? "bg-white/5 border-white/10"
      : "en-bg-elevated border-emerald-200/80 en-panel-glow"
  }`;
}

export function assessmentInputClass(theme) {
  return `${inputClass(theme)} box-border max-w-full min-w-0`;
}
