import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import usePageLoader from "../../hooks/usePageLoader";
import {
  ClipboardCheck,
  GraduationCap,
  Activity,
  Trash2,
} from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";

export default function FacultyDashboard() {
const [subjects, setSubjects] = useState([]);
const [name, setName] = useState("");
const [loading, setLoading] = useState(true);
const [showAssessmentModal, setShowAssessmentModal] = useState(false);
const [selectedSubject, setSelectedSubject] = useState(null);
const navigate = useNavigate();
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [subjectToDelete, setSubjectToDelete] = useState(null);
const user = JSON.parse( localStorage.getItem("examnexus_user") || "{}");
const teacherId = user.schoolId;
console.log(user);
console.log("teacherId:", teacherId);
const { theme } = useTheme();
  /* ---------------- PAGE LOADER HOOK ---------------- */
  const pageLoading = usePageLoader(800);

  /* ---------------- FETCH SUBJECTS ---------------- */
  const fetchSubjects = async () => {
  try {
    console.log("Fetching subjects for:", teacherId);

    setLoading(true);

    const res = await fetch(
      `http://localhost:5000/subjects/teacher/${teacherId}`
    );

    const data = await res.json();

    setSubjects(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("Error fetching subjects:", err);
    setSubjects([]);
  } finally {
    setLoading(false);
  }
};
  useEffect(() => {
  if (teacherId) {
    fetchSubjects();
  }
}, [teacherId]);
  /* ---------------- DELETE SUBJECT ---------------- */
const deleteSubject = async () => {
  if (!subjectToDelete) return;

  try {
    const res = await fetch(
      `http://localhost:5000/subjects/${subjectToDelete.id}`,
      {
        method: "DELETE",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error);
    }

    setShowDeleteModal(false);
    setSubjectToDelete(null);

    await fetchSubjects();
  } catch (err) {
    console.error(
      "Delete Subject Error:",
      err
    );
    alert(err.message);
  }
};
  /* ---------------- ADD SUBJECT ---------------- */
 const addSubject = async () => {
  if (!name.trim()) return;

  try {
    const res = await fetch(
      "http://localhost:5000/subjects/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          teacher_school_id: teacherId,
        }),
      }
    );

    const data = await res.json();

console.log("Create Subject Response:", data);

if (!res.ok) {
  throw new Error(
    data.error || "Failed to create subject"
  );
}

    setName("");

await fetchSubjects();
  } catch (err) {
    console.error("Error adding subject:", err);
    alert(err.message);
  }
};
    const handleAssessmentChoice = (type) => {
  setShowAssessmentModal(false);

  navigate("/faculty/create-assessment", {
    state: {
      type,
      subject: selectedSubject,
    },
  });
};

/* ---------------- SKELETON UI ---------------- */
if (loading || pageLoading) {
  return (
    <div className="p-6 space-y-4 animate-pulse">

      {/* Header Skeleton */}
      <div
        className={`h-8 w-48 rounded-lg ${
          theme === "dark" ? "bg-white/10" : "bg-[#c3f0e8]"
        }`}
      />

      <div
        className={`h-4 w-64 rounded-lg ${
          theme === "dark" ? "bg-white/10" : "bg-[#c3f0e8]"
        }`}
      />

      {/* Large Card Skeleton */}
      <div
        className={`h-20 rounded-2xl ${
          theme === "dark" ? "bg-white/10" : "bg-[#dff8f3]"
        }`}
      />

      {/* Grid Cards Skeleton */}
      <div className="flex flex-wrap gap-5">
        <div
          className={`h-40 rounded-2xl ${
            theme === "dark" ? "bg-white/10" : "bg-[#dff8f3]"
          }`}
        />
        <div
          className={`h-40 rounded-2xl ${
            theme === "dark" ? "bg-white/10" : "bg-[#dff8f3]"
          }`}
        />
      </div>

    </div>
  );
}

  /* ---------------- UI ---------------- */
  return (
    <div
  className={`
    min-h-screen
    p-6

    ${
      theme === "dark"
        ? "text-white"
        : "bg-[#c3f0e8] text-gray-900"
    }
  `}
>

      {/* HEADER */}
      <div className="mb-6">
      <h1 className={`text-3xl font-bold ${theme === "dark" ? "text-emerald-400" : "text-teal-700"}`}>
      Hello, {
  user?.name ||
  user?.email?.split("@")[0] ||
  "Faculty"
}
    </h1>

    <p className={theme === "dark" ? "text-gray-400" : "text-teal-700"}>
      Manage subjects and exams
    </p>
</div>

      {/* ADD SUBJECT */}
      <div
  className={`
    p-5
    rounded-2xl
    mb-6

    ${
      theme === "dark"
        ? "bg-white/5 border border-white/10"
        : "bg-[#dff8f3] border border-emerald-300 shadow-md"
    }
  `}
>
  <div className="flex gap-3">
    <input
      className={`
        flex-1 p-3 rounded-lg
        ${theme === "dark"
          ? "bg-black/30 border border-white/10 text-white"
          : "bg-[#c3f0e8] border border-emerald-400 text-black-900"
        }
      `}
      placeholder="New Subject"
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
    <button
      onClick={addSubject}
      className={`
  px-5 py-3
  rounded-lg
  font-semibold

  ${
    theme === "dark"
      ? "bg-emerald-500 text-black hover:bg-emerald-400"
      : "bg-[#10B981] text-white hover:bg-[#059669]"
  }

  transition-all
`}
    >
      Create
    </button>
  </div>
</div>

      {/* SUBJECTS */}
<div className="flex flex-wrap gap-4 items-start">

        {subjects.length === 0 ? (
          <div
  className={
    theme === "dark"
      ? "text-gray-400"
      : "text-gray-800"
  }
>
  No subjects found.
</div>
        ) : (
          subjects.map((s) => (
   <div
  key={s.id}
 className={`
  group
  relative
  w-[380px]

    p-5
    rounded-2xl

    ${
      theme === "dark"
        ? `
            bg-white/5
            border border-white/10
          `
        : `
            bg-white
            border border-emerald-200
            shadow-md
          `
    }

    hover:-translate-y-1
    hover:shadow-xl

    transition-all
    duration-300
    
  `}
            >
              <button
  onClick={() => {
  setSubjectToDelete(s);
  setShowDeleteModal(true);
}}
  className={`
    absolute
    top-3
    right-3

    p-2
    rounded-lg

    opacity-0
  group-hover:opacity-100

    transition-all
    duration-300
    hover:scale-110
    ${
      theme === "dark"
        ? `
            text-red-400
            hover:bg-red-500/10
            hover:text-red-300
          `
        : `
            text-red-600
            hover:bg-red-100
            hover:text-red-700
          `
    }
  `}
>
  <Trash2 size={16} />
</button>
              <h3
  className={`pr-10 text-xl font-bold ${
    theme === "dark"
      ? "text-emerald-400"
      : "text-teal-700"
  }`}
>
  {s.name}
</h3>

              <div
  className={`
    mt-3
    text-sm

    ${
      theme === "dark"
        ? "text-gray-400"
        : "text-gray-800"
    }
  `}
>
                <p>
                  Invite Code:{" "}
                 <span
                className={`
                  px-2
                  py-1
                  rounded-md
                  font-mono
                  text-xs

                  ${
                    theme === "dark"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-emerald-100 text-teal-700"
                  }
                `}
              >
                {s.invite_code}
              </span>
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() =>
                    navigate(`/faculty/subject/${s.id}`)}
                 className={`
  px-3
  py-2
  text-sm
  rounded-lg

  ${
    theme === "dark"
      ? "bg-white/10"
      : "bg-[#b5e8de] hover:bg-[#9fe0d4] text-gray-900"
  }
`}
                >
                  View Students
                </button>

                <button
                  onClick={() => {
                    setSelectedSubject(s);
                    setShowAssessmentModal(true);
                  }}
         className={`
          px-5 py-3
          rounded-lg
          font-semibold

          ${
            theme === "dark"
              ? "bg-emerald-500 text-black hover:bg-emerald-400"
              : "bg-[#10B981] text-white hover:bg-[#059669]"
          }

          transition-all
        `}  
                >
                  Create Assessment
                </button>
              </div>
            </div>
          ))
        )}

           </div>

      {showAssessmentModal && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div
      className={`
        w-full
        max-w-3xl       /* Reduced from 5xl to 3xl */
        rounded-3xl
        p-8

        ${
          theme === "dark"
            ? "bg-[#031d1f] border border-white/10"
            : "bg-[#b8e8d6] border border-emerald-400"
        }

        shadow-[0_0_50px_rgba(16,185,129,0.12)]
      `}
    >
      <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-emerald-400" : "text-teal-700"}`}>
        Select Assessment Type
      </h2>

      <div className="grid md:grid-cols-3 gap-4">

        {/* QUIZ */}
        <button
          onClick={() => handleAssessmentChoice("quiz")}
          className={`
            group relative
            h-48
            p-6
            rounded-2xl

            ${
              theme === "dark"
                ? "bg-white/5 border border-white/10"
                : "bg-[#b8e8d6] border border-emerald-400"
            }

            hover:bg-[#a1e5c7]
            hover:border-emerald-500
            hover:-translate-y-1
            transition-all duration-300
          `}
        >
          <div className="flex h-full flex-col items-center justify-center text-center">
            <ClipboardCheck
              size={50}
              className="text-emerald-400 mb-5 group-hover:scale-110 transition-all"
            />

            <h3 className={`text-xl font-semibold ${theme === "dark" ? "text-white" : "text-teal-700"}`}>
              Quiz
            </h3>

            <p className={`text-sm mt-3 ${theme === "dark" ? "text-gray-400" : "text-black"}`}>
              Quick assessments and knowledge checks
            </p>
          </div>
        </button>

        {/* EXAM */}
        <button
          onClick={() => handleAssessmentChoice("exam")}
          className={`
            group relative
            h-48
            p-6
            rounded-2xl

            ${
              theme === "dark"
                ? "bg-white/5 border border-white/10"
                : "bg-[#b8e8d6] border border-emerald-400"
            }

            hover:bg-[#a1e5c7]
            hover:border-emerald-500
            hover:-translate-y-1
            transition-all duration-300
          `}
        >
          <div className="flex h-full flex-col items-center justify-center text-center">
            <GraduationCap
              size={50}
              className="text-emerald-400 mb-5 group-hover:scale-110 transition-all"
            />

            <h3 className={`text-xl font-semibold ${theme === "dark" ? "text-white" : "text-teal-700"}`}>
              Exam
            </h3>

            <p className={`text-sm mt-3 ${theme === "dark" ? "text-gray-400" : "text-black"}`}>
              Long-form graded examinations
            </p>
          </div>
        </button>

        {/* ACTIVITY */}
        <button
          onClick={() => handleAssessmentChoice("activity")}
          className={`
            group relative
            h-48
            p-6
            rounded-2xl

            ${
              theme === "dark"
                ? "bg-white/5 border border-white/10"
                : "bg-[#b8e8d6] border border-emerald-400"
            }

            hover:bg-[#a1e5c7]
            hover:border-emerald-500
            hover:-translate-y-1
            transition-all duration-300
          `}
        >
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Activity
              size={50}
              className="text-emerald-400 mb-5 group-hover:scale-110 transition-all"
            />

            <h3 className={`text-xl font-semibold ${theme === "dark" ? "text-white" : "text-teal-700"}`}>
              Activity
            </h3>

            <p className={`text-sm mt-3 ${theme === "dark" ? "text-gray-400" : "text-black"}`}>
              Practice exercises and participation
            </p>
          </div>
        </button>

      </div>

      <button
        onClick={() => setShowAssessmentModal(false)}
        className={`mt-6 px-5 py-3 rounded-xl ${
          theme === "dark"
            ? "bg-red-500/10 border border-red-500/20 text-red-400"
            : "bg-red-200 border border-red-400 text-red-800 hover:bg-red-300"
        }`}
      >
        Cancel
      </button>
    </div>
  </div>
)}
 {showDeleteModal && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div
      className={`
        w-full
        max-w-md
        rounded-3xl
        p-8

        ${
          theme === "dark"
            ? "bg-[#031d1f] border border-white/10"
            : "bg-[#b8e8d6] border border-emerald-400"
        }

        shadow-[0_0_50px_rgba(239,68,68,0.15)]
      `}
    >
      <h2
        className={`
          text-2xl
          font-bold
          mb-4

          ${
            theme === "dark"
              ? "text-red-400"
              : "text-red-600"
          }
        `}
      >
        Delete Subject
      </h2>

      <p
        className={
          theme === "dark"
            ? "text-gray-300"
            : "text-gray-700"
        }
      >
        Are you sure you want to delete:
      </p>

      <div
        className={`
          mt-4
          p-4
          rounded-xl
          text-center
          font-semibold

          ${
            theme === "dark"
              ? "bg-white/5 border border-white/10"
              : "bg-white border border-emerald-200"
          }
        `}
      >
        {subjectToDelete?.name}
      </div>

      <p
        className={`
          mt-4
          text-sm

          ${
            theme === "dark"
              ? "text-gray-400"
              : "text-gray-600"
          }
        `}
      >
        This action cannot be undone.
      </p>

      <div className="mt-8 flex justify-end gap-3">

  <button
    onClick={() => {
      setShowDeleteModal(false);
      setSubjectToDelete(null);
    }}
    className={`
      px-5
      py-3
      rounded-xl
      font-medium

      transition-all
      duration-300

      hover:-translate-y-0.5

      ${
        theme === "dark"
          ? `
              bg-white/5
              border border-white/10
              text-gray-300

              hover:bg-white/10
              hover:text-white
            `
          : `
              bg-white
              border border-emerald-200
              text-gray-700

              hover:bg-emerald-50
              hover:border-emerald-300
            `
      }
    `}
  >
    Cancel
  </button>

  <button
    onClick={deleteSubject}
    className={`
      px-5
      py-3
      rounded-xl
      font-semibold

      transition-all
      duration-300

      hover:-translate-y-0.5
      hover:shadow-lg

      ${
        theme === "dark"
          ? `
              bg-red-500/15
              border border-red-500/20
              text-red-400

              hover:bg-red-500/25
              hover:border-red-500/40
            `
          : `
              bg-red-50
              border border-red-200
              text-red-600

              hover:bg-red-100
              hover:border-red-300
            `
      }
    `}
  >
    Delete Subject
  </button>

</div>
    </div>
  </div>
)}
    </div>
  );
}