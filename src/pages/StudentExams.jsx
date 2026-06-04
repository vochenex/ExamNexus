import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function StudentExams() {
  const [exams, setExams] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:5000/exams")
      .then((res) => res.json())
      .then(setExams);
  }, []);

  return (
    <div className="min-h-screen bg-[#031d1f] text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Available Exams</h1>

      <div className="grid gap-4">
        {exams.map((exam) => (
          <div
            key={exam.id}
            onClick={() => navigate(`/take-exam/${exam.id}`)}
            className="p-5 bg-white/10 rounded-xl hover:bg-white/20 cursor-pointer"
          >
            <h2 className="text-xl font-bold">{exam.title}</h2>
            <p className="text-gray-300">{exam.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}