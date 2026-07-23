import { useCallback, useEffect, useRef, useState } from "react";
import ProfileAvatar from "./ProfileAvatar";
import ModalPortal from "./ui/ModalPortal";
import { useTheme } from "../layouts/ThemeContext";
import { formatSectionLabel } from "../utils/sections";
import { getCourseLabel, getDepartmentLabel } from "../utils/academicOptions";

function computePreviewPosition(rect) {
  const width = Math.min(220, window.innerWidth - 16);
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

  const spaceBelow = window.innerHeight - rect.bottom;
  const placement = spaceBelow < 200 && rect.top > 200 ? "above" : "below";
  const top = placement === "below" ? rect.bottom + 8 : rect.top - 8;

  return { top, left, width, placement };
}

function StudentPreviewPopover({ preview, theme, name, student }) {
  if (!preview) return null;

  const style = {
    position: "fixed",
    top: preview.top,
    left: preview.left,
    width: preview.width,
    transform: preview.placement === "above" ? "translateY(-100%)" : undefined,
    zIndex: 200,
  };

  return (
    <ModalPortal>
      <div
        className={`
          en-faculty-student-preview pointer-events-none rounded-2xl border px-4 py-5 backdrop-blur-xl en-fade-in
          ${
            theme === "dark"
              ? "border-emerald-400/30 bg-[#0b1518]/95 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
              : "border-emerald-300/80 bg-white/95 shadow-[0_20px_40px_rgba(15,23,42,0.12)]"
          }
        `}
        style={style}
        role="tooltip"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <ProfileAvatar
            src={student.avatar_url}
            alt={name}
            size="xl"
            className="en-faculty-student-preview-avatar ring-2 ring-emerald-400/60 shadow-[0_8px_32px_rgba(16,185,129,0.25)]"
          />
          <div className="min-w-0 w-full overflow-hidden">
            <p
              className={`break-words text-base font-bold leading-snug ${
                theme === "dark" ? "text-white" : "text-slate-900"
              }`}
            >
              {name}
            </p>
            <p
              className={`mt-1 break-all text-sm font-medium ${
                theme === "dark" ? "text-emerald-300" : "text-teal-700"
              }`}
            >
              {student.school_id ? `ID: ${student.school_id}` : "No school ID"}
            </p>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export default function FacultyStudentCard({ student }) {
  const { theme } = useTheme();
  const cardRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [pinned, setPinned] = useState(false);

  const name =
    `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student";
  const departmentLabel = getDepartmentLabel(student.department);
  const courseLabel = getCourseLabel(student.department, student.course);
  const courseShort = student.course || courseLabel;

  const openPreview = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    setPreview(computePreviewPosition(el.getBoundingClientRect()));
  }, []);

  const closePreview = useCallback(() => {
    if (!pinned) setPreview(null);
  }, [pinned]);

  const togglePinned = useCallback(() => {
    if (pinned) {
      setPinned(false);
      setPreview(null);
      return;
    }
    openPreview();
    setPinned(true);
  }, [pinned, openPreview]);

  useEffect(() => {
    if (!preview) return undefined;

    const reposition = () => {
      const el = cardRef.current;
      if (!el) return;
      setPreview(computePreviewPosition(el.getBoundingClientRect()));
    };

    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [preview]);

  useEffect(() => {
    if (!pinned) return undefined;

    const onPointerDown = (event) => {
      if (cardRef.current?.contains(event.target)) return;
      setPinned(false);
      setPreview(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pinned]);

  const isActive = Boolean(preview);

  return (
    <>
      <button
        ref={cardRef}
        type="button"
        className={`
          en-faculty-student-card
          flex w-full min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200
          ${
            isActive
              ? theme === "dark"
                ? "border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                : "border-teal-400 bg-emerald-50 shadow-[0_8px_24px_rgba(13,148,136,0.12)]"
              : theme === "dark"
                ? "bg-white/5 border-white/10 hover:border-emerald-500/25"
                : "en-bg-elevated border-emerald-200 hover:border-emerald-300"
          }
        `}
        onMouseEnter={openPreview}
        onMouseLeave={closePreview}
        onFocus={openPreview}
        onBlur={closePreview}
        onClick={togglePinned}
        aria-expanded={isActive}
        aria-label={`View details for ${name}`}
      >
        <ProfileAvatar
          src={student.avatar_url}
          alt={name}
          size="sm"
          className={isActive ? "ring-2 ring-emerald-400/70" : ""}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <p
            className={`truncate text-sm font-semibold ${
              theme === "dark" ? "text-gray-100" : "text-gray-900"
            }`}
          >
            {name}
          </p>
          <p className={`truncate text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-600"}`}>
            {student.school_id ? `ID: ${student.school_id}` : "Student"}
          </p>
          {(departmentLabel || courseShort) && (
            <p
              className={`mt-0.5 truncate text-[11px] ${
                theme === "dark" ? "text-emerald-300/70" : "text-teal-700"
              }`}
            >
              {[departmentLabel, courseShort].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <span
          className={`
            shrink-0 rounded-lg px-2 py-1 text-xs font-semibold
            ${
              theme === "dark"
                ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                : "bg-cyan-50 text-cyan-800 border border-cyan-200"
            }
          `}
        >
          {formatSectionLabel(student.section)}
        </span>
      </button>

      <StudentPreviewPopover
        preview={preview}
        theme={theme}
        name={name}
        student={student}
      />
    </>
  );
}
