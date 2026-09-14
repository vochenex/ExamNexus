/**
 * DEV-only raw source map for Ctrl+Q location toast.
 * Loaded lazily so production bundles stay lean.
 */
export const DEV_SOURCE_RAW = import.meta.glob(
  [
    "../components/**/*.{jsx,js}",
    "../pages/**/*.{jsx,js}",
    "../layouts/**/*.{jsx,js}",
    "../hooks/**/*.{jsx,js}",
    "../utils/**/*.{jsx,js}",
  ],
  { query: "?raw", import: "default", eager: true }
);

export function globKeyToFrontendPath(key) {
  // e.g. ../components/AssessmentAiGenerator.jsx → frontend/components/AssessmentAiGenerator.jsx
  const cleaned = String(key || "")
    .replace(/^\.\.\//, "")
    .replace(/\\/g, "/");
  return cleaned.startsWith("frontend/")
    ? cleaned
    : `frontend/${cleaned}`;
}
