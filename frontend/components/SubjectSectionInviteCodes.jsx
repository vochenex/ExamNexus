import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { useAppModal } from "../contexts/AppModalContext";
import { buildSectionInviteRows, formatSectionLabel } from "../utils/sections";

/**
 * Collapsible list of unique invitation codes — one per section.
 */
export default function SubjectSectionInviteCodes({
  subject,
  sectionInvites = null,
  defaultOpen = false,
  layout = "list",
  className = "",
}) {
  const { theme } = useTheme();
  const { alert: showAlert } = useAppModal();
  const [open, setOpen] = useState(defaultOpen);
  const [copiedSection, setCopiedSection] = useState("");
  const rows = buildSectionInviteRows(subject, sectionInvites).filter(
    (row) => row.invite_code
  );

  const copyCode = async (event, section, inviteCode) => {
    event.stopPropagation();
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(""), 2000);
    } catch {
      await showAlert({
        title: "Copy invitation code",
        message: inviteCode,
        tone: "info",
        confirmLabel: "OK",
      });
    }
  };

  const isGrid = layout === "grid";

  if (!rows.length) {
    return (
      <div
        className={`rounded-lg border px-2.5 py-2 ${
          theme === "dark"
            ? "border-white/10 bg-black/20"
            : "border-emerald-100 bg-emerald-50/60"
        } ${className}`}
      >
        <p
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            theme === "dark" ? "text-gray-500" : "text-gray-500"
          }`}
        >
          Invite codes
        </p>
        <p className={`mt-0.5 font-mono text-xs ${theme === "dark" ? "text-emerald-300" : "text-teal-700"}`}>
          {subject?.invite_code || "—"}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border ${
        theme === "dark"
          ? "border-white/10 bg-black/20"
          : "border-emerald-100 bg-emerald-50/60"
      } ${className}`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left ${
          theme === "dark" ? "text-gray-300" : "text-gray-700"
        }`}
      >
        <span>
          <span
            className={`block text-[10px] font-semibold uppercase tracking-wider ${
              theme === "dark" ? "text-gray-500" : "text-gray-500"
            }`}
          >
            Section invite codes
          </span>
          <span className={`mt-0.5 block text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            {rows.length} unique code{rows.length === 1 ? "" : "s"} — one per section
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <ul
            className={`border-t border-inherit px-2.5 py-2 ${
              isGrid
                ? "grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3"
                : "space-y-1.5"
            }`}
          >
            {rows.map((row) => {
              const copied = copiedSection === row.section;
              return (
                <li
                  key={row.section}
                  className={`flex min-w-0 items-center justify-between gap-1.5 rounded-md ${
                    isGrid ? "px-1.5 py-1" : "px-2 py-1.5"
                  } ${theme === "dark" ? "bg-white/[0.03]" : "bg-white/70"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate font-semibold ${
                        isGrid ? "text-[10px]" : "text-xs"
                      } ${theme === "dark" ? "text-emerald-300" : "text-teal-700"}`}
                    >
                      {formatSectionLabel(row.section)}
                    </p>
                    <p
                      className={`truncate font-mono tracking-wide ${
                        isGrid ? "text-[9px]" : "text-[11px]"
                      } ${theme === "dark" ? "text-gray-300" : "text-gray-800"}`}
                      title={row.invite_code}
                    >
                      {row.invite_code}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => copyCode(event, row.section, row.invite_code)}
                    title={copied ? "Copied!" : "Copy invitation code"}
                    aria-label={copied ? "Invitation code copied" : "Copy invitation code"}
                    className={`flex shrink-0 items-center justify-center rounded-lg border transition ${
                      isGrid ? "h-6 w-6" : "h-8 w-8"
                    } ${
                      copied
                        ? theme === "dark"
                          ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-300"
                          : "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : theme === "dark"
                          ? "border-white/15 bg-black/30 text-emerald-400 hover:bg-white/10"
                          : "border-emerald-200 text-teal-700 hover:bg-emerald-50"
                    }`}
                  >
                    {copied ? <Check size={isGrid ? 11 : 14} /> : <Copy size={isGrid ? 11 : 14} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
