import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";

export default function Faculty() {
  const [subjects, setSubjects] = useState([]);
  const [name, setName] = useState("");
  const facultyId = "faculty-1"; // replace with auth user later

  useEffect(() => {
    fetch(`http://localhost:5000/subjects/${facultyId}`)
      .then((res) => res.json())
      .then(setSubjects);
  }, []);

  const addSubject = async () => {
    const res = await fetch("http://localhost:5000/subjects", {
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

      {/* ADD SUBJECT */}
      <div className="flex gap-3 mb-6">
        <input
          className="p-3 bg-white/10 rounded-xl w-full"
          placeholder="New Subject Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          onClick={addSubject}
          className="bg-green-500 px-4 py-2 rounded-xl"
        >
          Add
        </button>
      </div>

      {/* SUBJECT LIST */}
      <div className="grid gap-4">
        {subjects.map((s) => (
          <div
            key={s.id}
            className="p-5 rounded-2xl bg-white/5 border border-white/10"
          >
            <h2 className="text-xl font-bold text-teal-300">
              {s.name}
            </h2>

            <p className="text-gray-400 mt-2">
              Invite Code:{" "}
              <span className="text-white font-bold">
                {s.invite_code}
              </span>
            </p>

            <SubjectStudents subjectId={s.id} />
          </div>
        ))}
      </div>

    </DashboardLayout>
  );
}

/* ================= STUDENTS LIST ================= */
function SubjectStudents({ subjectId }) {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:5000/subjects/${subjectId}/students`)
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