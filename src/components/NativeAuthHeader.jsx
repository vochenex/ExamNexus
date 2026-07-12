import ThemeToggle from "./ThemeToggle";
import ExamNexusBrand from "./ExamNexusBrand";

/** Minimal auth header for the native app — no marketing site nav. */
export default function NativeAuthHeader() {
  return (
    <header className="en-native-auth-header">
      <ExamNexusBrand variant="compact" showTagline={false} />
      <ThemeToggle compact />
    </header>
  );
}
