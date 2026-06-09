import { useTheme } from "../layouts/ThemeContext";

/**
 * Theme-adaptive default profile icon (head + shoulders outline).
 * Matches ExamNexus emerald/teal palette in light and dark mode.
 */
export default function DefaultAvatarIcon({ size = 32, className = "" }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const stroke = isDark ? "#34d399" : "#0f766e";
  const glow = isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.25)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="32"
        cy="32"
        r="30"
        fill={glow}
        stroke={isDark ? "rgba(52,211,153,0.25)" : "rgba(16,185,129,0.35)"}
        strokeWidth="1"
      />
      <circle
        cx="32"
        cy="22"
        r="10"
        stroke={stroke}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M12 54c0-11.5 8.5-21 20-21s20 9.5 20 21"
        stroke={stroke}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
