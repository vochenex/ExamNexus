import { useTheme } from "../layouts/ThemeContext";
import { hasCustomProfilePhoto } from "../utils/avatar";
import DefaultAvatarIcon from "./DefaultAvatarIcon";

const SIZE_MAP = {
  xs: { box: "h-8 w-8", icon: 24, ring: "ring-1" },
  sm: { box: "h-10 w-10", icon: 30, ring: "ring-2" },
  md: { box: "h-14 w-14", icon: 42, ring: "ring-2" },
  lg: { box: "h-32 w-32", icon: 96, ring: "ring-4" },
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

  const shellClass = `
    ${config.box}
    shrink-0
    overflow-hidden
    rounded-full
    flex
    items-center
    justify-center
    ${showRing ? config.ring : ""}
    ${
      theme === "dark"
        ? `${showRing ? "ring-emerald-500/40" : ""} bg-emerald-500/10`
        : `${showRing ? "ring-emerald-400/60" : ""} en-bg-muted`
    }
    ${isInteractive ? "cursor-pointer transition hover:opacity-90 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" : ""}
    ${className}
  `;

  if (custom) {
    const content = (
      <img src={src} alt={alt} className="h-full w-full object-cover" />
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
