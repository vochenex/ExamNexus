import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../layouts/ThemeContext";


export default function ExamNexusAuth() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    schoolId: "",
    email: "",
    password: "",
    role: "student",
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");

  const labelClass = `block text-sm mb-1 ${
    theme === "dark" ? "text-gray-200" : "text-gray-700"
  }`;

  const fieldClass = `
    w-full
    px-4
    py-3
    rounded-xl
    border
    backdrop-blur-xl
    transition-all
    ${
      theme === "dark"
        ? `
            border-white/10
            bg-white/5
            text-white
            placeholder:text-gray-400
            hover:border-emerald-400
            focus:border-emerald-400
            focus:ring-4
            focus:ring-emerald-400/20
          `
        : `
            border-emerald-300
            bg-white
            text-gray-900
            placeholder:text-gray-500
            hover:border-emerald-400
            focus:border-emerald-500
            focus:ring-4
            focus:ring-emerald-400/20
          `
    }
  `;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
    setServerError("");
  };

  const validate = () => {
    const errs = {};
    if (!form.email) errs.email = "Email is required";
    if (!form.password) errs.password = "Password is required";
    if (!isLogin) {
      if (!form.firstName) errs.firstName = "First name is required";
      if (!form.lastName) errs.lastName = "Last name is required";
      if (!form.schoolId) errs.schoolId = "School ID is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    // LOGIN
if (isLogin) {
  const users = JSON.parse(
    localStorage.getItem("examnexus_users") || "[]"
  );

  const existingUser = users.find(
    (user) =>
      user.email === form.email &&
      user.password === form.password
  );

  if (!existingUser) {
    setServerError(
      "Invalid email or password"
    );
    return;
  }

  localStorage.setItem(
    "examnexus_user",
    JSON.stringify(existingUser)
  );

  if (existingUser.role === "faculty") {
    navigate("/faculty/dashboard");
  } else if (existingUser.role === "admin") {
    navigate("/admin");
  } else {
    navigate("/student");
  }

  return;
}

// SIGNUP
const userData = {
  ...form,

  name: `${form.firstName} ${form.lastName}`.trim(),
};

const users = JSON.parse(
  localStorage.getItem("examnexus_users") || "[]"
);

const duplicate = users.find(
  (u) =>
    u.schoolId === form.schoolId ||
    u.email === form.email
);

if (duplicate) {
  setServerError(
    "School ID or Email already exists"
  );
  return;
}

users.push(userData);

localStorage.setItem(
  "examnexus_users",
  JSON.stringify(users)
);

localStorage.setItem(
  "examnexus_user",
  JSON.stringify(userData)
);

if (userData.role === "faculty") {
  navigate("/faculty/dashboard");
} else if (userData.role === "admin") {
  navigate("/admin");
} else {
  navigate("/student");
}
  };

  return (
    <div
  className={`
    min-h-screen
    flex
    items-center
    justify-center
    relative
    overflow-hidden

    ${
      theme === "dark"
        ? "bg-[#031d1f]"
        : "bg-[#c3f0e8]"
    }
  `}
>
  <button
    type="button"
    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    className={`
      absolute top-6 right-6 z-20
      px-4 py-2 rounded-xl text-sm font-medium transition-all
      ${
        theme === "dark"
          ? "bg-white/10 text-white border border-white/20 hover:bg-white/20"
          : "bg-white text-gray-900 border border-emerald-300 hover:bg-emerald-50"
      }
    `}
  >
    {theme === "dark" ? "Light Mode" : "Dark Mode"}
  </button>
  {/* Background Orb 1 */}
<div
  className="
    absolute
    top-0
    left-0

    w-[500px]
    h-[500px]

    bg-emerald-400/20
    blur-[150px]
    rounded-full
  "
/>

{/* Background Orb 2 */}
<div
  className="
    absolute
    bottom-0
    right-0

    w-[500px]
    h-[500px]

    bg-cyan-400/20
    blur-[150px]
    rounded-full
  "
/>

{/* Grid Overlay */}
<div
  className="
    absolute
    inset-0

    opacity-[0.03]

    bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)]

    bg-[size:40px_40px]
  "
/>
      <div
  className={`
    relative

    w-full
    max-w-5xl

    rounded-[32px]

    overflow-hidden

    flex

    backdrop-blur-2xl

    border

    ${
      theme === "dark"
        ? "bg-[#0b1114]/90 border-white/10"
        : "bg-white/80 border-white"
    }

    shadow-[0_0_80px_rgba(16,185,129,0.15)]
  `}
>
        
        {/* Left Branding Panel */}
        <div className="hidden md:flex flex-col justify-center items-center p-10 bg-gradient-to-b from-emerald-400 to-teal-400 text-white w-1/2 relative">
          <div className="group relative mb-8">
  <div
    className="
      absolute
      inset-0

      bg-emerald-400/30

      blur-3xl

      scale-150

      opacity-70

      group-hover:opacity-100

      transition-all
      duration-500
    "
  />

  <div
    className="
      relative

      w-24
      h-24

      rounded-3xl

      bg-gradient-to-br
      from-emerald-400
      via-teal-400
      to-cyan-400

      flex
      items-center
      justify-center

      shadow-[0_0_40px_rgba(52,211,153,0.45)]

      group-hover:scale-110
      group-hover:rotate-6

      transition-all
      duration-500
    "
  >
    <svg
      viewBox="0 0 64 64"
      className="w-12 h-12 fill-white"
    >
      <path d="M32 2L2 18v28l30 16 30-16V18L32 2z"/>
      <path d="M14 24L32 14L50 24L32 34L14 24z"/>
      <path d="M20 34L32 40L44 34V44L32 50L20 44V34z"/>
    </svg>
  </div>
</div>

          <h1
  className="
    text-5xl
    font-black

    bg-gradient-to-r
    from-white
    via-emerald-100
    to-cyan-100

    bg-clip-text
    text-transparent

    mb-3

    hover:scale-105

    transition-all
  "
>
  ExamNexus
</h1>
          <p
  className="
    text-white/80

    text-base

    tracking-wide
  "
>
  Intelligent Assessment Platform
</p>
        </div>

        {/* Right Form Panel */}
        <div
          className={`w-full md:w-1/2 p-10 ${
            theme === "dark" ? "text-white" : "text-gray-900"
          }`}
        >
          <div className="md:hidden mb-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.35)]">
              <svg viewBox="0 0 64 64" className="w-9 h-9 fill-white">
                <path d="M32 2L2 18v28l30 16 30-16V18L32 2z" />
                <path d="M14 24L32 14L50 24L32 34L14 24z" />
                <path d="M20 34L32 40L44 34V44L32 50L20 44V34z" />
              </svg>
            </div>
            <h2
              className={`mt-3 text-xl font-black ${
                theme === "dark" ? "text-emerald-300" : "text-teal-700"
              }`}
            >
              ExamNexus
            </h2>
          </div>

          <h2
            className={`text-2xl font-bold mb-6 text-center ${
              theme === "dark" ? "text-white" : "text-teal-800"
            }`}
          >
            {isLogin ? "Login" : "Sign Up"}
          </h2>

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className={labelClass}>First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                    className={fieldClass}
                    />
                    {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      className={fieldClass}
                    />
                    {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div className="mb-4">
                  <label className={labelClass}>Role</label>
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className={`
                      w-full px-4 py-3 rounded-xl border transition-all
                      ${
                        theme === "dark"
                          ? "bg-white/5 border-white/10 text-white"
                          : "bg-white border-emerald-300 text-gray-900"
                      }
                    `}
                  >
                    <option value="faculty">Faculty</option>
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className={labelClass}>School ID</label>
                  <input
                    type="text"
                    name="schoolId"
                    value={form.schoolId}
                    onChange={handleChange}
                    placeholder="2024-12345"
                    className={fieldClass}
                  />
                  {errors.schoolId && <p className="text-red-500 text-xs mt-1">{errors.schoolId}</p>}
                </div>
              </>
            )}

            <div className="mb-4">
              <label className={labelClass}>Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className={fieldClass}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div className="mb-6">
              <label className={labelClass}>Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className={fieldClass}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {serverError && <p className="text-red-500 text-center mb-3">{serverError}</p>}

            <button
              type="submit"
              className="
  w-full
  py-3
  rounded-xl

  bg-gradient-to-r
  from-emerald-500
  via-teal-500
  to-cyan-500

  text-white
  font-semibold

  hover:scale-[1.03]
  hover:shadow-[0_0_40px_rgba(16,185,129,0.45)]

  active:scale-[0.98]

  transition-all
"
            >
              {isLogin ? "Login" : "Sign Up"}
            </button>
          </form>

          <p
            className={`mt-4 text-center text-sm ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {isLogin ? (
              <>
                Don't have an account?{" "}
                <span
                  className={`cursor-pointer font-semibold ${
                    theme === "dark" ? "text-emerald-400" : "text-teal-700"
                  }`}
                  onClick={() => setIsLogin(false)}
                >
                  Sign Up
                </span>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <span
                  className={`cursor-pointer font-semibold ${
                    theme === "dark" ? "text-emerald-400" : "text-teal-700"
                  }`}
                  onClick={() => setIsLogin(true)}
                >
                  Login
                </span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}