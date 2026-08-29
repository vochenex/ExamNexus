import { Loader2 } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";

function SadNetworkIllustration({ isDark }) {
  const ground = isDark ? "rgba(16, 185, 129, 0.16)" : "rgba(13, 148, 136, 0.2)";
  const panel = isDark ? "rgba(16, 185, 129, 0.22)" : "#ffffff";
  const stroke = isDark ? "rgba(52, 211, 153, 0.4)" : "rgba(13, 148, 136, 0.45)";
  const screen = isDark ? "rgba(248, 113, 113, 0.18)" : "#fff1f2";
  const skin = isDark ? "#fcd9b6" : "#d4a574";
  const shirt = isDark ? "#047857" : "#0f766e";
  const tear = isDark ? "#67e8f9" : "#0891b2";

  return (
    <svg
      viewBox="0 0 280 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto h-36 w-full max-w-[15rem] en-home-float"
      aria-hidden="true"
    >
      <ellipse cx="140" cy="200" rx="96" ry="12" fill={ground} />
      <rect x="78" y="78" width="124" height="88" rx="14" fill={panel} stroke={stroke} strokeWidth="2" />
      <rect x="90" y="92" width="100" height="54" rx="8" fill={screen} stroke={stroke} strokeWidth="1.5" />
      <path
        d="M118 112c8 10 36 10 44 0"
        stroke={isDark ? "#fca5a5" : "#e11d48"}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="128" cy="108" r="3.5" fill={isDark ? "#fecaca" : "#e11d48"} />
      <circle cx="152" cy="108" r="3.5" fill={isDark ? "#fecaca" : "#e11d48"} />
      <path
        d="M124 128h32"
        stroke={isDark ? "rgba(252,165,165,0.7)" : "#fb7185"}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <g className="en-home-float-delay">
        <circle cx="56" cy="118" r="22" fill={skin} />
        <path d="M36 152c7-22 34-22 40 0v28H36v-28z" fill={shirt} />
        <path d="M48 112c2 6 14 6 16 0" stroke="#7c2d12" strokeWidth="2" strokeLinecap="round" />
        <circle cx="50" cy="116" r="2" fill="#7c2d12" />
        <circle cx="62" cy="116" r="2" fill="#7c2d12" />
        <path d="M64 128c0 8 4 14 4 14" stroke={tear} strokeWidth="2" strokeLinecap="round" className="en-home-node-pulse" />
      </g>
      <g className="en-home-float-slow">
        <circle cx="228" cy="68" r="18" fill={isDark ? "rgba(251,146,60,0.25)" : "#ffedd5"} stroke={isDark ? "rgba(251,146,60,0.55)" : "#fb923c"} strokeWidth="1.5" />
        <path d="M228 58v14M221 72h14" stroke={isDark ? "#fdba74" : "#ea580c"} strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g className="en-home-pulse-line" opacity="0.7">
        <path
          d="M40 176 C90 150, 190 200, 240 168"
          stroke={isDark ? "rgba(52,211,153,0.45)" : "rgba(13,148,136,0.4)"}
          strokeWidth="2"
          strokeDasharray="6 8"
          fill="none"
        />
      </g>
    </svg>
  );
}

/**
 * Full-screen recovery state during exams — auto-retry only, no manual actions.
 */
export default function ExamNetworkRecoveryOverlay({
  title = "Sorry — there was an internet interruption",
  message = "We're retrying the connection for you now. Please stay on this page; your answers are safe on this device.",
  detail = "Retrying it now for you…",
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-6 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={`w-full max-w-md rounded-3xl border px-6 py-8 text-center shadow-2xl ${
          isDark
            ? "border-emerald-500/25 bg-[#061816]"
            : "border-emerald-200 bg-white"
        }`}
      >
        <div className="mx-auto mb-4 flex max-w-[18rem] flex-col items-center">
          <SadNetworkIllustration isDark={isDark} />

          <div
            className={`mt-2 w-full rounded-2xl px-4 py-3 text-left text-sm leading-relaxed ${
              isDark
                ? "border border-white/10 bg-white/[0.04] text-gray-200"
                : "border border-emerald-100 bg-emerald-50/70 text-gray-800"
            }`}
          >
            <p className="font-semibold">{title}</p>
            <p className="mt-1.5 text-[0.92rem] opacity-90">{message}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Loader2
            size={34}
            className={`animate-spin ${isDark ? "text-emerald-300" : "text-teal-600"}`}
            strokeWidth={2.25}
          />
          <p
            className={`text-sm font-medium ${
              isDark ? "text-emerald-200/90" : "text-teal-800"
            }`}
          >
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}
