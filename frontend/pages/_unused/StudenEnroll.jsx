import { useState } from "react";
import { API_BASE } from "../utils/apiBase.js";
import { useTheme } from "../layouts/ThemeContext";
import { useAppModal } from "../contexts/AppModalContext";
import { primaryButtonFull } from "../utils/themeButtons";

export default function StudentEnroll() {
  const { theme } = useTheme();
  const { success: showSuccess } = useAppModal();
  const [code, setCode] = useState("");

  const enroll = async () => {
    await fetch(`${API_BASE}/subjects/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invite_code: code,
        student_id: "student-1",
        student_email: "student@email.com",
      }),
    });

    showSuccess("Enrolled successfully!");
  };

  return (
    <div
      className={`p-10 min-h-screen ${
        theme === "dark" ? "text-white" : "text-gray-900"
      }`}
    >
      <h1 className="text-2xl mb-4 font-bold">Join Subject</h1>

      <input
        className={`p-3 rounded-xl w-full mb-4 border ${
          theme === "dark"
            ? "bg-white/10 border-white/10 text-white"
            : "en-bg-elevated border-emerald-200 text-gray-900"
        }`}
        placeholder="Enter Invite Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      <button onClick={enroll} className={primaryButtonFull(theme)}>
        Enroll
      </button>
    </div>
  );
}
