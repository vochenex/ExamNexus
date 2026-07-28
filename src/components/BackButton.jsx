import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { secondaryButton } from "../utils/themeButtons";
import { useNavigationProgress } from "../contexts/NavigationProgressContext";

export default function BackButton() {
  const navigate = useNavigate();
  const { isNavigating, beginNavigation } = useNavigationProgress();
  const { theme } = useTheme();

  return (
    <button
      type="button"
      disabled={isNavigating}
      aria-busy={isNavigating || undefined}
      onClick={() => {
        if (!beginNavigation("__history_back__")) return;
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate("/");
        }
      }}
      className={`mb-6 en-fade-in ${secondaryButton(theme)}`}
    >
      <ArrowLeft size={18} />
      Back
    </button>
  );
}
