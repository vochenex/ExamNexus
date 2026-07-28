import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { primaryButton, secondaryButton } from "../utils/themeButtons";
import { MAX_INTEGRITY_STRIKES } from "../utils/examIntegrity";
import { useModalDismiss } from "../hooks/useModalDismiss";
import ModalPortal from "./ui/ModalPortal";

export default function AssessmentLockdownModal({
  open,
  examTitle,
  durationLabel,
  questionCount,
  instructions,
  maxStrikes = MAX_INTEGRITY_STRIKES,
  onConfirm,
  onCancel,
}) {
  const { theme } = useTheme();
  useModalDismiss(onCancel, { enabled: open });

  if (!open) return null;

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lockdown-modal-title"
        onClick={(event) => event.stopPropagation()}
        className={`relative z-10 w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${
          theme === "dark"
            ? "border-amber-500/30 bg-[#0a1f1f] text-white"
            : "border-amber-300/80 en-bg-elevated text-gray-900"
        }`}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`rounded-xl p-2.5 ${
              theme === "dark" ? "bg-amber-500/15 text-amber-300" : "bg-amber-100 text-amber-800"
            }`}
          >
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 id="lockdown-modal-title" className="text-lg font-bold">
              Assessment lockdown
            </h2>
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              {examTitle}
            </p>
          </div>
        </div>

        <div
          className={`mb-5 space-y-3 rounded-xl border p-4 text-sm leading-relaxed ${
            theme === "dark"
              ? "border-amber-500/20 bg-amber-500/5 text-amber-100"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          <p className="font-semibold">Before you begin, read carefully:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Once you start, you <strong>cannot exit</strong> this assessment until you submit
              or the timer reaches zero.
            </li>
            <li>
              When time runs out, your answers will be <strong>submitted automatically</strong>.
            </li>
            <li>
              Navigation, sidebar, and other dashboard controls will be{" "}
              <strong>disabled</strong> during the exam.
            </li>
            <li>
              Copying, pasting, switching tabs, Alt+Tab, and other tampering are{" "}
              <strong>prohibited</strong>.
            </li>
            <li>
              Switching tabs or opening another assessment tab counts as an integrity{" "}
              <strong>violation</strong>. You may receive up to{" "}
              <strong>{maxStrikes} alerts</strong> before your exam is{" "}
              <strong>submitted automatically</strong>, even if you have not finished.
            </li>
            <li>
              The assessment runs in <strong>fullscreen</strong> and blocks access if you leave
              the window until you submit.
            </li>
            <li>
              The system monitors for anomalies. Each incident is{" "}
              <strong>recorded and sent to your teacher</strong>, and you will be alerted.
            </li>
          </ul>
          {instructions?.trim() && (
            <div
              className={`mt-4 rounded-xl border p-3 ${
                theme === "dark"
                  ? "border-white/10 bg-black/20"
                  : "border-amber-200/80 bg-white/70"
              }`}
            >
              <p className="mb-1 font-semibold">Instructions</p>
              <p className="whitespace-pre-wrap text-xs leading-relaxed opacity-90">
                {instructions}
              </p>
            </div>
          )}
        </div>

        <div
          className={`mb-5 flex flex-wrap gap-3 text-xs ${
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
          <span className="rounded-full border px-3 py-1 border-inherit">
            Time limit: {durationLabel}
          </span>
          <span className="rounded-full border px-3 py-1 border-inherit">
            {questionCount} item{questionCount === 1 ? "" : "s"}
          </span>
        </div>

        <div
          className={`mb-5 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
            theme === "dark"
              ? "bg-red-500/10 text-red-200"
              : "bg-red-50 text-red-800"
          }`}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            By clicking &quot;Begin assessment&quot;, you agree to remain on this page and follow
            all exam integrity rules.
          </span>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className={secondaryButton(theme)}>
            Go back
          </button>
          <button type="button" onClick={onConfirm} className={primaryButton(theme)}>
            Begin assessment
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
