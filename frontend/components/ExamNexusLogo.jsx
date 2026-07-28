export default function ExamNexusLogo({
  size = 44,
  className = "",
  showGlow = true,
  animated = false,
  idSuffix = "default",
}) {
  const gradientId = `enLogoGradient-${idSuffix}`;
  const glowId = `enLogoGlow-${idSuffix}`;
  const ringId = `enLogoRing-${idSuffix}`;

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${animated ? "en-logo-animated" : ""} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="6" y1="4" x2="42" y2="44">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="45%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id={ringId} x1="0" y1="24" x2="48" y2="24">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.15" />
        </linearGradient>
        {showGlow && (
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {showGlow && (
        <circle cx="24" cy="24" r="21" fill={`url(#${gradientId})`} opacity="0.08" />
      )}

      {/* Orbital arc */}
      <path
        className={animated ? "en-logo-orbit-arc" : undefined}
        d="M 8 28 A 16 16 0 0 1 40 28"
        stroke={`url(#${ringId})`}
        strokeWidth="1.75"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />

      {/* Outer hex frame */}
      <path
        d="M24 5 L39 13.5 V28.5 L24 37 L9 28.5 V13.5 Z"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.25"
        strokeLinejoin="round"
        fill="#071210"
        fillOpacity="0.92"
        filter={showGlow ? `url(#${glowId})` : undefined}
      />

      {/* Inner diamond core */}
      <path
        d="M24 14 L31 24 L24 34 L17 24 Z"
        fill={`url(#${gradientId})`}
        fillOpacity="0.35"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />

      {/* Nexus hub */}
      <circle className={animated ? "en-logo-hub" : undefined} cx="24" cy="24" r="3.25" fill={`url(#${gradientId})`} />

      {/* Satellite nodes + connectors */}
      <line x1="24" y1="24" x2="24" y2="9" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
      <line x1="24" y1="24" x2="35.5" y2="30" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
      <line x1="24" y1="24" x2="12.5" y2="30" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />

      <circle className={animated ? "en-logo-node" : undefined} cx="24" cy="8" r="2.75" fill="#22d3ee" />
      <circle className={animated ? "en-logo-node" : undefined} cx="36.5" cy="30.5" r="2.75" fill="#34d399" />
      <circle className={animated ? "en-logo-node" : undefined} cx="11.5" cy="30.5" r="2.75" fill="#2dd4bf" />

      {/* Corner accents */}
      <rect x="22" y="37.5" width="4" height="4" rx="1" transform="rotate(45 24 39.5)" fill={`url(#${gradientId})`} opacity="0.9" />
    </svg>
  );
}
