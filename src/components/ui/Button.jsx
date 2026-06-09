import { useTheme } from "../../layouts/ThemeContext";
import {
  primaryButton,
  primaryButtonSm,
  primaryButtonFull,
  secondaryButton,
  secondaryButtonSm,
  dangerButton,
} from "../../utils/themeButtons";

const VARIANTS = {
  primary: primaryButton,
  secondary: secondaryButton,
  danger: dangerButton,
};

function resolveClasses(theme, variant, size, className) {
  const variantFn = VARIANTS[variant] || primaryButton;

  if (size === "sm") {
    if (variant === "primary") return primaryButtonSm(theme, className);
    if (variant === "secondary") return secondaryButtonSm(theme, className);
    return variantFn(theme, `px-4 py-2 text-sm rounded-lg ${className}`);
  }

  if (size === "full") {
    if (variant === "primary") return primaryButtonFull(theme, className);
    return variantFn(theme, `w-full ${className}`);
  }

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
