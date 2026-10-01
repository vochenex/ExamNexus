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
    "../contexts/**/*.{jsx,js}",
    "../config/**/*.{jsx,js}",
    "../*.{jsx,js}",
  ],
  { query: "?raw", import: "default", eager: true }
);

/** Stylesheets + Tailwind config for the Ctrl+E inspector's CSS / animation lookup. */
export const DEV_STYLE_RAW = import.meta.glob(
  ["../styles/**/*.css", "../*.css", "../../tailwind.config.js"],
  { query: "?raw", import: "default", eager: true }
);

export function globKeyToFrontendPath(key) {
  // e.g. ../components/AssessmentAiGenerator.jsx → frontend/components/AssessmentAiGenerator.jsx
  const raw = String(key || "").replace(/\\/g, "/");
  if (raw.startsWith("../../")) return raw.slice("../../".length);
  const cleaned = raw.replace(/^\.\.\//, "");
  return cleaned.startsWith("frontend/")
    ? cleaned
    : `frontend/${cleaned}`;
}
