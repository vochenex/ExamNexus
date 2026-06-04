import { useState } from "react";

export default function StudentEnroll() {
  const [code, setCode] = useState("");

  const enroll = async () => {
    await fetch("http://localhost:5000/subjects/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invite_code: code,
        student_id: "student-1",
        student_email: "student@email.com",
      }),
    });

    alert("Enrolled successfully!");
  };

  return (
    <div className="p-10 text-white">
      <h1 className="text-2xl mb-4">Join Subject</h1>

      <input
        className="p-3 bg-white/10 rounded-xl w-full"
        placeholder="Enter Invite Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      <button
        onClick={enroll}
        className="mt-4 bg-blue-500 px-4 py-2 rounded-xl"
      >
        Enroll
      </button>
    </div>
  );
}