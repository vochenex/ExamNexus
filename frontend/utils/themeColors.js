/** Light-mode surface classes (styles in index.css under html.light) */
export const LIGHT_BG = {
  page: "en-bg-page",
  surface: "en-bg-surface",
  elevated: "en-bg-elevated",
  muted: "en-bg-muted",
  input: "en-bg-input",
  skeleton: "en-bg-skeleton",
  hover: "en-hover",
  surfaceSoft: "en-bg-surface-soft",
  elevatedSoft: "en-bg-elevated-soft",
};

export function surfaceBg(theme, extra = "") {
  return theme === "dark" ? `bg-[#dff8f3]/5 ${extra}` : `${LIGHT_BG.surface} ${extra}`;
}

export function elevatedBg(theme, extra = "") {
  return theme === "dark" ? `bg-[#0b1114] ${extra}` : `${LIGHT_BG.elevated} ${extra}`;
}

export function mutedBg(theme, extra = "") {
  return theme === "dark" ? `bg-white/[0.03] ${extra}` : `${LIGHT_BG.muted} ${extra}`;
}

export function inputBg(theme, extra = "") {
  return theme === "dark"
    ? `bg-[#dff8f3]/10 ${extra}`
    : `${LIGHT_BG.input} ${extra}`;
}

export function pageBg(theme, extra = "") {
  return theme === "dark" ? `bg-[#031d1f] ${extra}` : `${LIGHT_BG.page} ${extra}`;
}
