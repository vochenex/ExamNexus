export default function AnimatedSuccessCheck({ size = 72, className = "" }) {
  return (
    <div
      className={`en-success-check mx-auto ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 52 52" className="h-full w-full">
        <circle
          className="en-success-check-circle"
          cx="26"
          cy="26"
          r="24"
          fill="none"
          strokeWidth="2"
        />
        <path
          className="en-success-check-mark"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.5 27.5l7 7 16-17"
        />
      </svg>
    </div>
  );
}
