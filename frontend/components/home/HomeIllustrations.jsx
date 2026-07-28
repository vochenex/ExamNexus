export function HeroIllustration({ className = "" }) {
  return (
    <svg
      viewBox="0 0 520 380"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="260" cy="340" rx="200" ry="24" fill="currentColor" className="text-emerald-500/15" />
      <rect x="140" y="120" width="240" height="150" rx="16" fill="currentColor" className="text-emerald-500/20" />
      <rect x="155" y="135" width="210" height="100" rx="8" fill="currentColor" className="text-cyan-400/25" />
      <circle cx="195" cy="175" r="6" fill="#34d399" />
      <rect x="210" y="170" width="120" height="8" rx="4" fill="currentColor" className="text-emerald-300/40" />
      <rect x="210" y="188" width="90" height="8" rx="4" fill="currentColor" className="text-emerald-300/30" />
      <rect x="210" y="206" width="105" height="8" rx="4" fill="currentColor" className="text-emerald-300/25" />
      {/* Student left */}
      <circle cx="95" cy="200" r="28" fill="#fcd9b6" />
      <path d="M67 248c8-28 48-28 56 0v52H67V248z" fill="#10b981" />
      <rect x="78" y="230" width="34" height="22" rx="4" fill="#064e3b" />
      {/* Student right */}
      <circle cx="425" cy="195" r="26" fill="#e8c4a8" />
      <path d="M399 240c8-26 44-26 52 0v48H399V240z" fill="#14b8a6" />
      <circle cx="425" cy="188" r="20" fill="#3f2e1f" opacity="0.85" />
      {/* Faculty center */}
      <circle cx="260" cy="88" r="32" fill="#f5d0b5" />
      <path d="M228 138c10-34 54-34 64 0v58H228V138z" fill="#047857" />
      <rect x="238" y="118" width="44" height="8" rx="4" fill="#fef3c7" />
      <path d="M248 78h24v6c0 8-6 14-12 14s-12-6-12-14v-6z" fill="#1f2937" />
      {/* Floating badges */}
      <g className="en-home-float">
        <rect x="360" y="60" width="72" height="36" rx="10" fill="currentColor" className="text-emerald-400/30" />
        <text x="396" y="83" textAnchor="middle" fill="#6ee7b7" fontSize="11" fontWeight="600">
          A+
        </text>
      </g>
      <g className="en-home-float-delay">
        <rect x="48" y="70" width="88" height="32" rx="10" fill="currentColor" className="text-cyan-400/25" />
        <text x="92" y="91" textAnchor="middle" fill="#5eead4" fontSize="10" fontWeight="600">
          On time
        </text>
      </g>
    </svg>
  );
}

export function StudentIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 280 220" fill="none" className={className} aria-hidden="true">
      <ellipse cx="140" cy="200" rx="90" ry="12" fill="currentColor" className="text-emerald-500/20" />
      <rect x="70" y="95" width="140" height="88" rx="12" fill="currentColor" className="text-emerald-500/25" />
      <rect x="82" y="108" width="116" height="58" rx="6" fill="currentColor" className="text-cyan-400/20" />
      <circle cx="108" cy="132" r="5" fill="#34d399" />
      <rect x="120" y="128" width="60" height="6" rx="3" fill="currentColor" className="text-emerald-300/50" />
      <rect x="120" y="142" width="48" height="6" rx="3" fill="currentColor" className="text-emerald-300/35" />
      <circle cx="140" cy="62" r="30" fill="#fcd9b6" />
      <path d="M110 108c10-32 50-32 60 0v75H110V108z" fill="#10b981" />
      <path d="M125 48c0-12 10-20 15-20s15 8 15 20" fill="#2d1810" />
      <rect x="195" y="118" width="36" height="48" rx="8" fill="currentColor" className="text-amber-400/30" />
      <path d="M207 128h12M207 138h12M207 148h8" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FacultyIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 280 220" fill="none" className={className} aria-hidden="true">
      <ellipse cx="140" cy="200" rx="90" ry="12" fill="currentColor" className="text-emerald-500/20" />
      <rect x="55" y="110" width="100" height="72" rx="10" fill="currentColor" className="text-emerald-500/20" />
      <rect x="68" y="125" width="74" height="8" rx="4" fill="#34d399" opacity="0.6" />
      <rect x="68" y="140" width="60" height="6" rx="3" fill="currentColor" className="text-emerald-300/40" />
      <rect x="68" y="152" width="68" height="6" rx="3" fill="currentColor" className="text-emerald-300/30" />
      <circle cx="140" cy="58" r="32" fill="#f0c9a8" />
      <path d="M108 108c12-36 60-36 64 0v82H108V108z" fill="#047857" />
      <rect x="122" y="88" width="36" height="6" rx="3" fill="#fde68a" />
      <rect x="165" y="100" width="70" height="90" rx="10" fill="currentColor" className="text-cyan-400/25" />
      <path d="M180 125v45M195 115v55M210 130v40M225 120v50" stroke="#2dd4bf" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function AdminIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 280 220" fill="none" className={className} aria-hidden="true">
      <ellipse cx="140" cy="200" rx="90" ry="12" fill="currentColor" className="text-emerald-500/20" />
      <rect x="50" y="85" width="180" height="100" rx="14" fill="currentColor" className="text-emerald-500/20" />
      <circle cx="90" cy="125" r="16" fill="#fcd9b6" />
      <circle cx="140" cy="125" r="16" fill="#e8c4a8" />
      <circle cx="190" cy="125" r="16" fill="#f5d0b5" />
      <rect x="72" y="148" width="36" height="5" rx="2" fill="currentColor" className="text-emerald-300/40" />
      <rect x="122" y="148" width="36" height="5" rx="2" fill="currentColor" className="text-emerald-300/40" />
      <rect x="172" y="148" width="36" height="5" rx="2" fill="currentColor" className="text-emerald-300/40" />
      <circle cx="140" cy="48" r="28" fill="#e8c4a8" />
      <path d="M112 92c10-30 56-30 56 0v28H112V92z" fill="#0f766e" />
      <path d="M200 70v16l14-8-14-8z" fill="#34d399" />
      <circle cx="218" cy="78" r="10" fill="currentColor" className="text-amber-400/40" />
      <path d="M213 78h10M218 73v10" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function AnalyticsIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 320 240" fill="none" className={className} aria-hidden="true">
      <rect x="40" y="40" width="240" height="160" rx="16" fill="currentColor" className="text-emerald-500/15" />
      <path d="M70 170V130M110 170V100M150 170V115M190 170V85M230 170V110" stroke="#34d399" strokeWidth="10" strokeLinecap="round" />
      <circle cx="70" cy="130" r="6" fill="#2dd4bf" />
      <circle cx="110" cy="100" r="6" fill="#2dd4bf" />
      <circle cx="150" cy="115" r="6" fill="#2dd4bf" />
      <circle cx="190" cy="85" r="6" fill="#34d399" />
      <circle cx="230" cy="110" r="6" fill="#2dd4bf" />
      <circle cx="260" cy="55" r="22" fill="#fcd9b6" />
      <path d="M238 95c8-22 36-22 44 0v20H238V95z" fill="#14b8a6" />
    </svg>
  );
}

/** Connected-campus network — hero accent between sections */
export function PlatformNetworkIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 640 320" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="en-nexus-line" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id="en-nexus-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="320" cy="300" rx="260" ry="18" fill="url(#en-nexus-glow)" />

      <g className="en-home-pulse-line" opacity="0.55">
        <path d="M120 160 Q220 80 320 140 T520 120" stroke="url(#en-nexus-line)" strokeWidth="2" fill="none" />
        <path d="M80 200 Q200 120 320 180 T560 160" stroke="url(#en-nexus-line)" strokeWidth="1.5" fill="none" />
        <path d="M160 220 Q280 100 400 200 T580 140" stroke="url(#en-nexus-line)" strokeWidth="1" fill="none" />
      </g>

      <g className="en-home-float-slow">
        <circle cx="120" cy="160" r="36" fill="currentColor" className="text-emerald-500/20" />
        <circle cx="120" cy="148" r="14" fill="#fcd9b6" />
        <path d="M104 178c6-18 32-18 32 0v22h-32v-22z" fill="#10b981" />
        <rect x="108" y="188" width="24" height="14" rx="3" fill="#064e3b" />
        <text x="120" y="232" textAnchor="middle" fill="#6ee7b7" fontSize="11" fontWeight="600">
          Student
        </text>
      </g>

      <g className="en-home-float">
        <circle cx="320" cy="130" r="48" fill="currentColor" className="text-cyan-400/15" />
        <rect x="278" y="108" width="84" height="56" rx="12" fill="currentColor" className="text-emerald-500/30" />
        <rect x="290" y="120" width="60" height="36" rx="6" fill="currentColor" className="text-cyan-400/25" />
        <circle cx="304" cy="136" r="4" fill="#34d399" />
        <rect x="314" y="132" width="28" height="5" rx="2" fill="#6ee7b7" opacity="0.5" />
        <rect x="314" y="142" width="22" height="5" rx="2" fill="#6ee7b7" opacity="0.35" />
        <text x="320" y="188" textAnchor="middle" fill="#5eead4" fontSize="12" fontWeight="700">
          ExamNexus
        </text>
      </g>

      <g className="en-home-float-delay">
        <circle cx="520" cy="150" r="34" fill="currentColor" className="text-emerald-500/20" />
        <circle cx="520" cy="138" r="13" fill="#f0c9a8" />
        <path d="M505 168c6-16 30-16 30 0v24h-30v-24z" fill="#047857" />
        <rect x="512" y="128" width="16" height="4" rx="2" fill="#fde68a" />
        <text x="520" y="218" textAnchor="middle" fill="#6ee7b7" fontSize="11" fontWeight="600">
          Faculty
        </text>
      </g>

      <g className="en-home-orbit" style={{ transformOrigin: "320px 160px" }}>
        <circle cx="320" cy="160" r="118" stroke="currentColor" strokeWidth="1" strokeDasharray="6 10" className="text-emerald-400/25" fill="none" />
      </g>

      {[
        [200, 100],
        [440, 90],
        [180, 240],
        [460, 230],
      ].map(([cx, cy], index) => (
        <circle
          key={index}
          cx={cx}
          cy={cy}
          r="5"
          fill="#34d399"
          className="en-home-node-pulse"
          style={{ animationDelay: `${index * 0.4}s` }}
        />
      ))}
    </svg>
  );
}

const TEAM_AVATAR_PALETTES = [
  { skin: "#fcd9b6", hair: "#2d1810", shirt: "#047857", accent: "#34d399" },
  { skin: "#e8c4a8", hair: "#1f2937", shirt: "#0e7490", accent: "#22d3ee" },
  { skin: "#f5d0b5", hair: "#3f2e1f", shirt: "#0f766e", accent: "#2dd4bf" },
  { skin: "#f0c9a8", hair: "#111827", shirt: "#065f46", accent: "#6ee7b7" },
];

export function TeamMemberIllustration({ variant = 0, className = "" }) {
  const palette = TEAM_AVATAR_PALETTES[variant % TEAM_AVATAR_PALETTES.length];

  return (
    <svg viewBox="0 0 120 140" fill="none" className={className} aria-hidden="true">
      <ellipse cx="60" cy="128" rx="38" ry="8" fill="currentColor" className="text-emerald-500/20" />
      <circle cx="60" cy="128" r="44" fill="currentColor" className="text-emerald-500/10" />
      <circle cx="60" cy="52" r="26" fill={palette.skin} />
      <path d={`M34 88c8-28 52-28 52 0v44H34V88z`} fill={palette.shirt} />
      <path
        d={
          variant % 2 === 0
            ? "M42 38c0-14 8-22 18-22s18 8 18 22"
            : "M38 42c4-18 22-22 22-22s18 4 22 22"
        }
        fill={palette.hair}
      />
      {variant === 1 && (
        <rect x="48" y="46" width="24" height="8" rx="4" fill={palette.accent} opacity="0.85" />
      )}
      {variant === 2 && (
        <circle cx="78" cy="70" r="10" fill={palette.accent} opacity="0.25" />
      )}
      {variant === 3 && (
        <path d="M46 78h28" stroke={palette.accent} strokeWidth="3" strokeLinecap="round" />
      )}
      <circle cx="60" cy="52" r="40" stroke={palette.accent} strokeWidth="2" strokeOpacity="0.35" fill="none" />
    </svg>
  );
}
