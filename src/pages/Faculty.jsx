import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useTheme } from "../layouts/ThemeContext";
import { primaryButtonSm } from "../utils/themeButtons";

import { API_BASE } from "../utils/apiBase.js";

export default function Faculty() {
  const { theme } = useTheme();
  const [subjects, setSubjects] = useState([]);
  const [name, setName] = useState("");
  const facultyId = "faculty-1";

  useEffect(() => {
    fetch(`${API_BASE}/subjects/${facultyId}`)
      .then((res) => res.json())
      .then(setSubjects);
  }, []);

  const addSubject = async () => {
    const res = await fetch(`${API_BASE}/subjects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        created_by: facultyId,
      }),
    });

    const data = await res.json();
    setSubjects([...subjects, data]);
    setName("");
  };

  return (
    <DashboardLayout title="My Courses">
      <div className="flex gap-3 mb-6">
        <input
          className={`p-3 rounded-xl w-full border ${
            theme === "dark"
              ? "bg-white/10 border-white/10 text-white"
              : "en-bg-elevated border-emerald-200 text-gray-900"
          }`}
          placeholder="New Subject Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button onClick={addSubject} className={primaryButtonSm(theme)}>
          Add
        </button>
      </div>

      <div className="grid gap-4">
        {subjects.map((s) => (
          <div
            key={s.id}
            className={`p-5 rounded-2xl border ${
              theme === "dark"
                ? "bg-white/5 border-white/10"
                : "en-bg-elevated border-emerald-200"
            }`}
          >
            <h2
              className={`text-xl font-bold ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              {s.name}
            </h2>

            <p
              className={`mt-2 ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Invite Code:{" "}
              <span className="font-bold font-mono">{s.invite_code}</span>
            </p>

            <SubjectStudents subjectId={s.id} />
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

function SubjectStudents({ subjectId }) {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/subjects/${subjectId}/students`)
      .then((res) => res.json())
      .then(setStudents);
  }, [subjectId]);

  return (
    <div className="mt-4">
      <h3 className="text-sm text-gray-300 mb-2">Enrolled Students:</h3>

      {students.length === 0 ? (
        <p className="text-gray-500 text-sm">No students yet</p>
      ) : (
        students.map((s) => (
          <p key={s.id} className="text-white text-sm">
            • {s.student_email}
          </p>
        ))
      )}
    </div>
  );
}
