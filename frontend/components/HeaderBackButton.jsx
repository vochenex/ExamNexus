import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../layouts/ThemeContext";
import { headerActionButtonClass } from "../utils/themeButtons";
import {
  getHeaderBackTarget,
  shouldShowHeaderBack,
} from "../utils/headerBackNavigation";

export default function HeaderBackButton({ compact = false }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const iconSize = 18;

  if (!shouldShowHeaderBack(pathname)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => navigate(getHeaderBackTarget(pathname))}
      className={headerActionButtonClass(theme, { compact })}
      aria-label="Back to previous page"
      title="Back"
    >
      <ArrowLeft size={iconSize} strokeWidth={2.25} />
    </button>
  );
}
