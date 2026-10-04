import { useTheme } from "../../layouts/ThemeContext";
import { secondaryButton, secondaryButtonSm, dangerButton } from "../../utils/themeButtons";

const VARIANTS = {
  secondary: secondaryButton,
  danger: dangerButton,
};

function resolveClasses(theme, variant, size, className) {
  const variantFn = VARIANTS[variant];

  // Primary look lives in index.css (.en-btn-primary).
  if (!variantFn) {
    const sizeClass = size === "sm" ? "en-btn-primary-sm" : size === "full" ? "w-full" : "";
    return `en-btn-primary ${sizeClass} ${className}`;
  }

  if (size === "sm") {
    if (variant === "secondary") return secondaryButtonSm(theme, className);
    return variantFn(theme, `px-4 py-2 text-sm rounded-lg ${className}`);
  }

  if (size === "full") return variantFn(theme, `w-full ${className}`);

  return variantFn(theme, className);
}

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  children,
  ...props
}) {
  const { theme } = useTheme();

  return (
    <button
      type={type}
      className={resolveClasses(theme, variant, size, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function ThemedButton({
  theme,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={resolveClasses(theme, variant, size, className)}
      {...props}
    >
      {children}
    </button>
  );
}
