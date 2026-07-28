import { useNavigate } from "react-router-dom";
import { useTheme } from "../layouts/ThemeContext";
import { FACULTY_AVATAR_REQUIRED_MESSAGE } from "../utils/avatar";
import { primaryButtonSm } from "../utils/themeButtons";
import ProfileAvatar from "./ProfileAvatar";

export default function FacultyAvatarRequiredBanner({ user }) {
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <div
      className={`
        mb-6 flex flex-col sm:flex-row sm:items-center gap-4
        rounded-2xl p-5 border
        ${
          theme === "dark"
            ? "bg-amber-500/10 border-amber-500/30 text-amber-100"
            : "bg-amber-50 border-amber-300 text-amber-900"
        }
      `}
    >
      <ProfileAvatar src={user?.avatar_url} alt="Your profile" size="md" />
      <div className="flex-1">
        <p className="font-semibold">Profile photo required</p>
        <p className={`mt-1 text-sm ${theme === "dark" ? "text-amber-200/90" : "text-amber-800"}`}>
          {FACULTY_AVATAR_REQUIRED_MESSAGE}
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate("/faculty/profile")}
        className={primaryButtonSm(theme)}
      >
        Upload Photo
      </button>
    </div>
  );
}
