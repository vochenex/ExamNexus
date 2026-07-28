import { useTheme } from "../layouts/ThemeContext";
import { hasCustomProfilePhoto } from "../utils/avatar";
import DefaultAvatarIcon from "./DefaultAvatarIcon";

const SIZE_MAP = {
  xs: { box: "h-8 w-8", icon: 22, border: "border" },
  sm: { box: "h-10 w-10", icon: 28, border: "border-2" },
  md: { box: "h-12 w-12", icon: 36, border: "border-2" },
  /** Compact profile header — small enough to avoid clipping in tight cards */
  lg: { box: "h-[4.25rem] w-[4.25rem] sm:h-20 sm:w-20", icon: 52, border: "border-2" },
  xl: { box: "h-24 w-24", icon: 72, border: "border-2" },
};

export default function ProfileAvatar({
  src,
  alt = "Profile",
  size = "sm",
  className = "",
  showRing = true,
  onClick,
  clickable = false,
}) {
  const { theme } = useTheme();
  const custom = hasCustomProfilePhoto(src);
  const config = SIZE_MAP[size] || SIZE_MAP.sm;
  const isInteractive = clickable && custom && typeof onClick === "function";

  // Use inset border (not ring/box-shadow) so parents with overflow-hidden cannot clip it.
  const shellClass = `
    ${config.box}
    box-border
    shrink-0
    overflow-hidden
    rounded-full
    flex
    items-center
    justify-center
    ${showRing ? config.border : ""}
    ${
      theme === "dark"
        ? `${showRing ? "border-emerald-400/55" : ""} bg-emerald-500/10`
        : `${showRing ? "border-emerald-500/50" : ""} en-bg-muted`
    }
    ${isInteractive ? "cursor-pointer transition hover:opacity-90 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" : ""}
    ${className}
  `;

  if (custom) {
    const content = (
      <img src={src} alt={alt} className="h-full w-full object-cover" draggable={false} />
    );

    if (isInteractive) {
      return (
        <button
          type="button"
          onClick={onClick}
          className={shellClass}
          aria-label="View profile photo"
        >
          {content}
        </button>
      );
    }

    return <div className={shellClass}>{content}</div>;
  }

  return (
    <div className={shellClass}>
      <DefaultAvatarIcon size={config.icon} />
    </div>
  );
}
