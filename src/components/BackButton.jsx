import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { secondaryButton } from "../utils/themeButtons";

export default function BackButton() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  return (
    <button
      onClick={() => navigate(-1)}
      className={`mb-6 ${secondaryButton(theme)}`}
    >
      <ArrowLeft size={18} />
      Back
    </button>
  );
}
