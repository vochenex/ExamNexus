import { useEffect, useState } from "react";

export default function TeacherAnalytics({ examId }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:5000/analytics/exam/${examId}`)
      .then((res) => res.json())
      .then(setData);
  }, [examId]);

  return (
    <div className="p-6 text-white">
      <h1 className="text-xl mb-4">Question Difficulty</h1>

      {data.map((q, i) => (
        <div key={i} className="p-3 bg-white/10 mb-2 rounded">
          <p>Question ID: {q.question_id}</p>
          <p>Wrong Rate: {(q.wrongRate * 100).toFixed(1)}%</p>
        </div>
      ))}
    </div>
  );
}