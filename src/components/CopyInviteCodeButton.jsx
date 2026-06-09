import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";

export default function CopyInviteCodeButton({
  inviteCode,
  className = "",
  side = "right",
}) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  if (!inviteCode) return null;

  const handleCopy = async (event) => {
    event.stopPropagation();
    event.preventDefault();

    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy invitation code:", inviteCode);
    }
  };

  const positionClass =
    side === "left"
      ? "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2"
      : "right-0 top-1/2 translate-x-1/2 -translate-y-1/2";

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy invitation code"}
      aria-label={copied ? "Invitation code copied" : "Copy invitation code"}
      className={`
        absolute z-10 ${positionClass}
        flex h-10 w-10 items-center justify-center rounded-full border shadow-lg
        opacity-0 scale-90 pointer-events-none
        group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto
        group-focus-within:opacity-100 group-focus-within:scale-100 group-focus-within:pointer-events-auto
        transition-all duration-300 ease-out
        ${
          copied
            ? theme === "dark"
              ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-300"
              : "border-emerald-400 bg-emerald-50 text-emerald-700"
            : theme === "dark"
              ? "border-white/15 bg-[#0b1114] text-emerald-400 hover:border-emerald-500/40 hover:bg-white/10"
              : "border-emerald-200/80 en-bg-elevated text-teal-700 hover:border-teal-400 en-hover"
        }
        ${className}
      `}
    >
      {copied ? <Check size={18} strokeWidth={2.5} /> : <Copy size={18} strokeWidth={2.25} />}
    </button>
  );
}
