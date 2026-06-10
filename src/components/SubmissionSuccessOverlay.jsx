import { useEffect, useState } from "react";
import { useTheme } from "../layouts/ThemeContext";
import { motion } from "../utils/motion";

export default function SubmissionSuccessOverlay({ open, message, onComplete }) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return undefined;
    }

    const showTimer = requestAnimationFrame(() => setVisible(true));
    const completeTimer = window.setTimeout(() => {
      onComplete?.();
    }, 2400);

    return () => {
      cancelAnimationFrame(showTimer);
      window.clearTimeout(completeTimer);
    };
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <div
      className={`${motion.overlay} fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md`}
      role="status"
      aria-live="polite"
      aria-label="Assessment submitted successfully"
    >
      <div
        className={`${motion.popIn} flex w-full max-w-sm flex-col items-center rounded-3xl border px-8 py-10 text-center shadow-2xl transition-all duration-500 ease-out ${
          visible ? "scale-100 opacity-100" : "scale-90 opacity-0"
        } ${
          theme === "dark"
            ? "border-emerald-500/25 bg-[#0a1f1f]"
            : "border-emerald-200 en-bg-elevated"
        }`}
      >
        <div className="submission-check-ring mb-6">
          <svg
            className="submission-check-svg"
            viewBox="0 0 72 72"
            width="88"
            height="88"
            aria-hidden="true"
          >
            <circle
              className="submission-check-circle"
              cx="36"
              cy="36"
              r="32"
              fill="none"
              strokeWidth="3"
            />
            <path
              className="submission-check-mark"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M22 37.5 L32 47.5 L50 27.5"
            />
          </svg>
        </div>

        <h2
          className={`text-xl font-bold ${
            theme === "dark" ? "text-emerald-300" : "text-teal-800"
          }`}
        >
          Submitted
        </h2>

        {message ? (
          <p
            className={`mt-2 text-sm leading-relaxed ${
              theme === "dark" ? "text-gray-300" : "text-gray-600"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
