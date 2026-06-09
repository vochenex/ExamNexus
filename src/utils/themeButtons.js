export function primaryButton(theme, extra = "") {
  return `
    inline-flex items-center justify-center gap-2
    px-6 py-3 rounded-xl font-semibold
    transition-all duration-300
    hover:-translate-y-0.5 active:scale-[0.98]
    disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0
    ${
      theme === "dark"
        ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-black hover:shadow-[0_0_30px_rgba(16,185,129,0.45)]"
        : "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-emerald-500/30"
    }
    ${extra}
  `;
}

export function primaryButtonSm(theme, extra = "") {
  return primaryButton(theme, `px-4 py-2 text-sm rounded-lg ${extra}`);
}

export function primaryButtonFull(theme, extra = "") {
  return primaryButton(theme, `w-full ${extra}`);
}

export function secondaryButton(theme, extra = "") {
  return `
    inline-flex items-center justify-center gap-2
    px-6 py-3 rounded-xl font-semibold
    transition-all duration-300
    hover:-translate-y-0.5 active:scale-[0.98]
    disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0
    ${
      theme === "dark"
        ? "border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:border-emerald-500/30"
        : "border border-emerald-200/80 en-bg-elevated text-gray-700 en-hover hover:border-emerald-400/70 shadow-sm"
    }
    ${extra}
  `;
}

export function secondaryButtonSm(theme, extra = "") {
  return secondaryButton(theme, `px-4 py-2 text-sm rounded-lg ${extra}`);
}

export function dangerButton(theme, extra = "") {
  return `
    inline-flex items-center justify-center gap-2
    px-6 py-3 rounded-xl font-semibold
    transition-all duration-300
    hover:-translate-y-0.5 active:scale-[0.98]
    disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0
    ${
      theme === "dark"
        ? "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-400 hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]"
        : "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300"
    }
    ${extra}
  `;
}
