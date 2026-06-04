import { useState } from "react";
import { useTheme } from "../layouts/ThemeContext";

export default function Profile() {
  const { theme } = useTheme();

  const user = JSON.parse(
    localStorage.getItem("examnexus_user") || "{}"
  );

  const [profile, setProfile] = useState({
    full_name: user.full_name || user.name || "",
    email: user.email || "",
    school_id: user.schoolId || "",
    role: user.role || "",

    age: "",
    gender: "",

    department: "",
    course: "",
    year_level: "",

    bio: "",
    avatar_url: "",
  });

  const handleChange = (field, value) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    console.log(profile);

    // TODO:
    // Update Supabase users table
  };

  return (
    <div
      className={`min-h-screen p-6 ${
        theme === "dark"
          ? "text-white"
          : "bg-[#c3f0e8] text-gray-900"
      }`}
    >
      {/* HEADER */}
      <div className="mb-8">
        <h1
          className={`text-3xl font-bold ${
            theme === "dark"
              ? "text-emerald-400"
              : "text-teal-700"
          }`}
        >
          My Profile
        </h1>

        <p
          className={`mt-1 ${
            theme === "dark"
              ? "text-gray-400"
              : "text-gray-700"
          }`}
        >
          Manage your account information
        </p>
      </div>

      {/* PROFILE CARD */}
      <div
        className={`
          max-w-5xl
          rounded-2xl
          p-6

          ${
            theme === "dark"
              ? "bg-[#dff8f3]/5 border border-white/10"
              : "bg-[#dff8f3] border border-emerald-300 shadow-md"
          }
        `}
      >
        {/* AVATAR */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="
              w-28
              h-28
              rounded-full
              bg-emerald-500
              flex
              items-center
              justify-center
              text-3xl
              font-bold
              text-white
            "
          >
            {profile.full_name?.charAt(0) || "U"}
          </div>

          <button
            className={`
                mt-4
                px-4
                py-2
                rounded-xl
                font-semibold

                ${
                theme === "dark"
                    ? `
                        bg-gradient-to-br
                        from-emerald-500
                        to-teal-600

                        text-black

                        hover:scale-105
                        hover:shadow-lg
                        hover:shadow-emerald-500/20
                    `
                    : `
                        bg-white

                        text-teal-700

                        border
                        border-emerald-300

                        hover:bg-emerald-50
                        hover:border-emerald-400

                        shadow-sm
                        hover:shadow-md
                    `
                }

                transition-all
                duration-300
            `}
            >
            Upload Avatar
            </button>
        </div>
        <div
  className={`
    mb-8
    p-5
    rounded-2xl
    text-center

    ${
      theme === "dark"
        ? "bg-[#dff8f3]/10 border border-white/10"
        : "bg-[#c3f0e8] border border-emerald-300"
    }
  `}
>
  <h2
    className={`text-2xl font-bold ${
      theme === "dark"
        ? "text-emerald-400"
        : "text-teal-700"
    }`}
  >
    {profile.full_name || "User"}
  </h2>

  <p
    className={`mt-2 ${
      theme === "dark"
        ? "text-gray-300"
        : "text-gray-700"
    }`}
  >
    {profile.role}
  </p>

  <p
    className={`text-sm ${
      theme === "dark"
        ? "text-gray-400"
        : "text-gray-600"
    }`}
  >
    {profile.school_id}
  </p>
</div>
        {/* PERSONAL INFO */}
        <h2
          className={`text-xl font-semibold mb-4 ${
            theme === "dark"
              ? "text-emerald-400"
              : "text-teal-700"
          }`}
        >
          Personal Information
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <input
            value={profile.full_name}
            onChange={(e) =>
              handleChange("full_name", e.target.value)
            }
            placeholder="Full Name"
            className={inputStyle(theme)}
          />

          <input
            value={profile.email}
            disabled
            placeholder="Email"
            className={inputStyle(theme)}
          />

          <input
            value={profile.school_id}
            disabled
            placeholder="School ID"
            className={inputStyle(theme)}
          />

          <input
            type="number"
            value={profile.age}
            onChange={(e) =>
              handleChange("age", e.target.value)
            }
            placeholder="Age"
            className={inputStyle(theme)}
          />

          <select
  value={profile.gender}
  onChange={(e) => handleChange("gender", e.target.value)}
  className={inputStyle(theme)}
  style={{
    backgroundColor:
      theme === "dark"
        ? "#0b1114"
        : "#f4fffc",
  }}
>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Prefer not to say">Prefer not to say</option>
            </select>
        </div>

        {/* ACADEMIC INFO */}
<h2
  className={`text-xl font-semibold mt-8 mb-4 ${
    theme === "dark" ? "text-emerald-400" : "text-teal-700"
  }`}
>
  Academic Information
</h2>

<div className="grid md:grid-cols-2 gap-4">
  {/* Department Dropdown */}
  <select
    value={profile.department}
    onChange={(e) => {
      handleChange("department", e.target.value);
      handleChange("course", ""); // reset course when department changes
    }}
    className={inputStyle(theme)}
  >
    <option value="">Select Department</option>
    <option value="CCS">College of Computer Studies</option>
    <option value="CCJE">College of Criminal and Justice Education</option>
    <option value="CBE">College of Business Education</option>
  </select>

          {profile.role === "Student" && (
            <>
              {/* Course Dropdown */}
            {profile.role === "Student" && (
                <select
                value={profile.course}
                onChange={(e) => handleChange("course", e.target.value)}
                className={inputStyle(theme)}
                >
                <option value="">Select Course</option>
                {profile.department === "CCS" && (
                    <option value="BSIT">Bachelor of Science in Information Technology</option>
                )}
                {profile.department === "CBE" && (
                    <>
                    <option value="BSA">Bachelor of Science in Accountancy</option>
                    <option value="TM">Tourism Management</option>
                    <option value="FM">Financial Management</option>
                    <option value="HM">Hospitality Management</option>
                    </>
                )}
                {profile.department === "CCJE" && (
                    <option value="BSCRIM">Bachelor of Science in Criminal Justice</option>
                )}
                </select>
            )}

               {/* Year Level Dropdown */}
  {profile.role === "Student" && (
    <select
      value={profile.year_level}
      onChange={(e) => handleChange("year_level", e.target.value)}
      className={inputStyle(theme)}
    >
      <option value="">Select Year Level</option>
      <option value="1st Year">1st Year</option>
      <option value="2nd Year">2nd Year</option>
      <option value="3rd Year">3rd Year</option>
      <option value="4th Year">4th Year</option>
    </select>
  )} 
            </>
          )}
        </div>

        {/* BIO */}
        <h2
          className={`text-xl font-semibold mt-8 mb-4 ${
            theme === "dark"
              ? "text-emerald-400"
              : "text-teal-700"
          }`}
        >
          About Me
        </h2>

        <textarea
          rows={5}
          value={profile.bio}
          onChange={(e) =>
            handleChange("bio", e.target.value)
          }
          placeholder="Tell us about yourself..."
          className={inputStyle(theme)}
        />

        {/* SAVE */}
        <div className="mt-8">
          <button
            onClick={handleSave}
            className={`
              px-6
              py-3
              rounded-xl
              font-semibold

              ${
                theme === "dark"
                  ? "bg-emerald-500 text-black hover:bg-emerald-400"
                : "bg-[#10B981] text-white hover:bg-[#059669]"
              }

              transition-all
              duration-300
                hover:-translate-y-0.5
                hover:shadow-lg
            `}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function inputStyle(theme) {
  return `
    w-full
    p-3
    rounded-xl
    outline-none
    appearance-none
    cursor-pointer

    ${
      theme === "dark"
        ? "bg-[#dff8f3]/10 border border-white/10 text-white"
        : "bg-[#f4fffc] border border-emerald-200 text-gray-900"
    }

    transition-all
    duration-300
    hover:shadow-md
  `;
}