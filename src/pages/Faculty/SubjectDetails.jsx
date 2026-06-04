import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BackButton from "../../components/BackButton";
import {ClipboardCheck, GraduationCap, Activity, } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";

function getAssessmentStatus(assessment) {
  const now = new Date();

  if (
    assessment.start_datetime &&
    now < new Date(assessment.start_datetime)
  ) {
    return "scheduled";
  }

  if (
    assessment.end_datetime &&
    now > new Date(assessment.end_datetime)
  ) {
    return "closed";
  }

  return "active";
}

export default function SubjectDetails() {
  const { theme } = useTheme();
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [subject, setSubject] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const handleAssessmentChoice = (type) => {
  setShowAssessmentModal(false);

  navigate("/faculty/create-assessment", {
    state: {
      type,
      subject,
    },
  });
};
  useEffect(() => {
    // Subject Info
    fetch(`http://localhost:5000/subjects/${subjectId}`)
      .then((res) => res.json())
      .then((data) => setSubject(data))
      .catch(console.error);

    // Subject Assessments
    fetch(`http://localhost:5000/subjects/${subjectId}/assessments`)
      .then((res) => res.json())
      .then((data) => setAssessments(data))
      .catch(console.error);

  }, [subjectId]);

  if (!subject) {
    return (
      <div className="p-6 text-white">
        Loading...
      </div>
    );
  }

  return (
 <div
  className={`
    min-h-screen
    p-6

    ${
      theme === "dark"
        ? "bg-[#031d1f] text-white"
        : "bg-[#c3f0e8] text-black"
    }
  `}
>

    <BackButton />

    {/* HEADER */}
    <div className="mb-8">
        <h1
        className={`text-3xl font-bold ${
            theme === "dark"
            ? "text-emerald-400"
            : "text-teal-700"
        }`}
        >
        {subject.name}
        </h1>
        <p
  className={`mt-2 ${
    theme === "dark"
      ? "text-white"
      : "text-black"
  }`}
>
          Invite Code:
                    <span
            className={`
                ml-2
                font-mono
                font-semibold

                ${
                theme === "dark"
                    ? "text-emerald-400"
                    : "text-emerald-700"
                }
            `}
            >
            {subject.invite_code}
            </span>
        </p>
      </div>

      {/* CREATE ASSESSMENT */}
      <div className="mb-6">
        <button
  onClick={() => setShowAssessmentModal(true)}
    className={`
    px-4
    py-2
    rounded-xl
    font-semibold

    ${
        theme === "dark"
        ? `
            bg-emerald-500
            text-black
            hover:bg-emerald-400
            `
        : `
            bg-[#8fdcb4]
            text-black
            hover:bg-[#7bd3a7]
            `
    }

    transition-all
    `}>
  + Create Assessment
</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* STUDENTS */}
       <div
  className={`
    p-5
    rounded-2xl

    ${
      theme === "dark"
        ? "bg-white/5 border border-white/10"
        : "bg-[#dff8f3] border border-emerald-300"
    }
  `}
>
          <h2
  className={`font-semibold text-lg ${
    theme === "dark"
      ? "text-emerald-400"
      : "text-teal-700"
  }`}
>
  Students
</h2>

          <p
            className={`mt-2 ${
                theme === "dark"
                ? "text-white"
                : "text-black"
            }`}
            >
            View enrolled students
            </p>
        </div>

        {/* ASSESSMENTS */}
        <div
  className={`
    p-5
    rounded-2xl

    ${
      theme === "dark"
        ? "bg-white/5 border border-white/10"
        : "bg-[#dff8f3] border border-emerald-300"
    }
  `}
>
         <h2
  className={`font-semibold text-lg ${
    theme === "dark"
      ? "text-emerald-400"
      : "text-teal-700"
  }`}
>
  Assessments
</h2>


          {assessments.length === 0 ? (
            <p
                className={`${
                    theme === "dark" ? "text-white" : "text-black"
                }`}
                >
                No assessments yet
                </p>
          ) : (
           assessments.map((assessment) => (
  <div
    key={assessment.id}
    onClick={() => navigate(`/faculty/assessment/${assessment.id}`)}
    className={`
      mb-3
      p-4
      rounded-xl
      cursor-pointer

      ${
        theme === "dark"
          ? "bg-black/20 border border-white/5 hover:bg-white/10"
          : `
            bg-[#b8e8d6]
            border border-emerald-400
            hover:bg-[#a1e5c7]
            hover:border-teal-500
          `
      }

      hover:-translate-y-0.5
      hover:shadow-lg
      transition-all
      duration-300
    `}
  >        
 <div className="flex items-center justify-between">
  <h3
    className={`font-semibold ${
      theme === "dark"
        ? "text-emerald-400"
        : "text-[#0f766e]"
    }`}
  >
    {assessment.title}
  </h3>
  {getAssessmentStatus(assessment) === "active" && (
    <span className="text-emerald-400 font-bold text-xs font-medium">
      🟢 Active
    </span>
  )}

  {getAssessmentStatus(assessment) === "scheduled" && (
    <span className="text-amber-500 font-bold text-xs font-medium">
      🟡 Scheduled
    </span>
  )}

  {getAssessmentStatus(assessment) === "closed" && (
    <span className="text-red-500 font-bold text-xs font-medium">
      🔴 Closed
    </span>
  )}
</div>

        <p
  className={`
    text-xs
    mt-1
    ${
      theme === "dark"
        ? "text-white"
        : "text-black"
    }
  `}
>
  {assessment.exam_type}
</p>

{assessment.end_datetime && (
  <p
    className={`
      text-xs
      mt-1
      ${
        theme === "dark"
          ? "text-white"
          : "text-black"
      }
    `}
  >
    Ends:{" "}
    {new Date(assessment.end_datetime).toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    })}
  </p>
)}
              </div>
            ))
          )}
        </div>

        {/* ANALYTICS */}
        <div
  className={`
    p-5
    rounded-2xl

    ${
      theme === "dark"
        ? "bg-white/5 border border-white/10"
        : "bg-[#dff8f3] border border-emerald-300"
    }
  `}

    >   
          <h2
  className={`font-semibold text-lg ${
    theme === "dark"
      ? "text-emerald-400"
      : "text-teal-700"
  }`}
>
  Analytics
</h2>

          <p
            className={`mt-2 ${
                theme === "dark"
                ? "text-white"
                : "text-black"
            }`}
            >
            View class performance
            </p>
        </div>

      </div>
      {showAssessmentModal && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
    <div
  className={`
  w-[900px]

  rounded-3xl
  p-8

  ${
    theme === "dark"
      ? "bg-[#031d1f] border border-white/10"
      : "bg-[#dff8f3] border border-emerald-300"
  }

  shadow-[0_0_50px_rgba(16,185,129,0.12)]
`}
>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-emerald-400">
          Create Assessment
        </h2>

        <p
            className={`mt-2 ${
                theme === "dark" ? "text-white" : "text-black"
            }`}
            >
            Choose the type of assessment you want to create
            </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">

        {/* QUIZ */}
            <button
            onClick={() => handleAssessmentChoice("quiz")}
            className={`
            group
            relative
            h-48
            p-6
            rounded-2xl

            ${
                theme === "dark"
                ? `
                    bg-white/5
                    border border-white/10
                    hover:bg-emerald-500/10
                    hover:border-emerald-400/40
                    `
                : `
                    bg-[#b8e8d6]
                    border border-emerald-300

                    hover:bg-[#a1e5c7]
                    hover:border-emerald-500
                    `
            }

            hover:-translate-y-1
            hover:shadow-lg

            transition-all
            duration-300
            `}
        >
          <div className="flex h-full flex-col items-center justify-center text-center">

            <ClipboardCheck
              size={50}
              className="
                text-emerald-400
                mb-5

                transition-all duration-300
                group-hover:scale-110
              "
            />

            <h3 className="text-xl font-semibold">
              Quiz
            </h3>

            <p
                className={`text-sm mt-3 max-w-[180px] ${
                    theme === "dark" ? "text-white" : "text-black"
                }`}
                >
                Quick assessments and knowledge checks
                </p>

          </div>
        </button>

        {/* EXAM */}
                <button
        onClick={() => handleAssessmentChoice("exam")}
        className={`
            group
            relative
            h-48
            p-6
            rounded-2xl

            ${
                theme === "dark"
                ? `
                    bg-white/5
                    border border-white/10
                    hover:bg-emerald-500/10
                    hover:border-emerald-400/40
                    `
                : `
                    bg-[#b8e8d6]
                    border border-emerald-300

                    hover:bg-[#a1e5c7]
                    hover:border-emerald-500
                    `
            }

            hover:-translate-y-1
            hover:shadow-lg

            transition-all
            duration-300
            `}
        >
        <div className="flex h-full flex-col items-center justify-center text-center">
            <GraduationCap
            size={50}
            className="text-emerald-400 mb-5 group-hover:scale-110 transition-all"
            />

            <h3 className="text-xl font-semibold">
            Exam
            </h3>

            <p
            className={`text-sm mt-3 max-w-[180px] ${
                theme === "dark"
                ? "text-white"
                : "text-black"
            }`}
            >
            Long-form graded examinations
            </p>
        </div>
        </button>

        {/* ACTIVITY */}
                <button
        onClick={() => handleAssessmentChoice("activity")}
        className={`
            group
            relative
            h-48
            p-6
            rounded-2xl

            ${
                theme === "dark"
                ? `
                    bg-white/5
                    border border-white/10
                    hover:bg-emerald-500/10
                    hover:border-emerald-400/40
                    `
                : `
                    bg-[#b8e8d6]
                    border border-emerald-300

                    hover:bg-[#a1e5c7]
                    hover:border-emerald-500
                    `
            }

            hover:-translate-y-1
            hover:shadow-lg

            transition-all
            duration-300
            `}
        >
        <div className="flex h-full flex-col items-center justify-center text-center">
            <Activity
            size={50}
            className="text-emerald-400 mb-5 group-hover:scale-110 transition-all"
            />

            <h3 className="text-xl font-semibold">
            Activity
            </h3>

            <p
            className={`text-sm mt-3 max-w-[180px] ${
                theme === "dark"
                ? "text-white"
                : "text-black"
            }`}
            >
            Practice exercises and participation
            </p>
        </div>
        </button>

      </div>

      <button
  onClick={() => setShowAssessmentModal(false)}
  className="
    mx-auto
    mt-6

    flex items-center justify-center gap-2

    w-40
    px-5 py-3

    rounded-2xl

    bg-red-500/10
    border border-red-500/20

    text-red-400
    font-medium

    hover:bg-red-500/20
    hover:border-red-400
    hover:text-red-300

    hover:-translate-y-0.5
    hover:shadow-[0_0_25px_rgba(239,68,68,0.25)]

    active:scale-[0.98]

    transition-all duration-300
  "
>
  Cancel
</button>

    </div>
  </div>
)}
    </div>
  );
}