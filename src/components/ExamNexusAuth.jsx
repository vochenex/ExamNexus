import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Moon,
  Sun,
  Eye,
  EyeOff,
} from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { primaryButtonFull } from "../utils/themeButtons";
import { supabase } from "../supabaseClient";
import {
  buildSignupMetadata,
  buildUserProfileRow,
  fetchOrCreateProfile,
  navigateForRole,
  saveSignupProfile,
  saveSignupSchoolIdCache,
} from "../utils/authProfile";
import SignupFormFields from "./auth/SignupFormFields";
import ExamNexusBrand from "./ExamNexusBrand";

export default function ExamNexusAuth() {
  const navigate = useNavigate();
const { theme, setTheme } = useTheme();
const [showPassword, setShowPassword] = useState(false);
const [successMessage, setSuccessMessage] = useState("");
const [isLogin, setIsLogin] = useState(true);
const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");

  const [form, setForm] = useState({
  firstName: "",
  lastName: "",
  role: "Student",
  schoolId: "",

  gender: "",
  department: "",
  course: "",
  yearLevel: "",
  age: "",

  email: "",
  password: "",
});
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((current) => {
      const next = { ...current, [name]: value };

      if (name === "department") {
        next.course = "";
      }

      return next;
    });

    setErrors({ ...errors, [e.target.name]: "" });
    setServerError("");
    setSuccessMessage("");
  };

  const handleRoleChange = (role) => {
    setForm((current) => ({
      ...current,
      role,
      course: role === "Faculty" ? "" : current.course,
      yearLevel: role === "Faculty" ? "" : current.yearLevel,
    }));
    setServerError("");
    setSuccessMessage("");
  };
function getAuthInputProps(theme) {
  const isDark = theme === "dark";

  return {
    className: `
      examnexus-auth-input
      w-full
      px-4
      py-3
      rounded-xl
      border
      outline-none
      transition-all
      focus:ring-2
      focus:ring-emerald-400/30
      ${
        isDark
          ? "border-gray-600 focus:border-emerald-400 placeholder:text-gray-500"
          : "border-gray-200 focus:border-emerald-500 placeholder:text-gray-400"
      }
    `,
    style: {
      color: isDark ? "#ffffff" : "#111827",
      backgroundColor: isDark ? "#1f2937" : "#ffffff",
    },
  };
}
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

  const handleSubmit = async (e) => {
  try {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    // LOGIN
    if (isLogin) {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });

      if (error) {
        setServerError(error.message);
        setLoading(false);
        return;
      }

      const { profile, error: profileError } = await fetchOrCreateProfile(
        supabase
      );

      if (profileError || !profile) {
        setServerError(
          profileError?.message ||
            "Your account exists but the profile could not be loaded. Run database/users_signup_policies.sql in Supabase, then try again."
        );
        setLoading(false);
        return;
      }

      saveSignupSchoolIdCache(data.user.id, profile.school_id);

      localStorage.setItem(
        "examnexus_user",
        JSON.stringify(profile)
      );

      setLoading(false);
      navigateForRole(navigate, profile.role);
      return;
    }

    const {
      data: duplicate,
      error: duplicateError,
    } = await supabase
      .from("users")
      .select("*")
      .or(
        `school_id.eq.${form.schoolId},email.eq.${form.email}`
      );

    if (duplicateError) {
      setServerError(duplicateError.message);
      setLoading(false);
      return;
    }

    if (duplicate.length > 0) {
      setServerError(
        "School ID or Email already exists"
      );
      setLoading(false);
      return;
    }

    const { data, error } =
      await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: buildSignupMetadata(form),
        },
      });

    if (error) {
      setServerError(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setServerError("Sign up failed. Please try again.");
      setLoading(false);
      return;
    }

    const profileRow = buildUserProfileRow(data.user.id, form);
    saveSignupSchoolIdCache(data.user.id, form.schoolId);

    if (data.session) {
      await supabase.auth.updateUser({
        data: buildSignupMetadata(form),
      });

      const { profile: savedProfile, error: saveError } =
        await saveSignupProfile(supabase, profileRow);

      if (saveError || !savedProfile) {
        setServerError(saveError?.message || "Could not save your profile.");
        setLoading(false);
        return;
      }

      localStorage.setItem(
        "examnexus_user",
        JSON.stringify(savedProfile)
      );
    } else {
      localStorage.setItem(
        "examnexus_user",
        JSON.stringify(profileRow)
      );
    }

    setLoading(false);

    setForm({
      firstName: "",
      lastName: "",
      role: "Student",
      schoolId: "",
      gender: "",
      department: "",
      course: "",
      yearLevel: "",
      age: "",
      email: "",
      password: "",
    });

    setErrors({});

    setServerError("");

    setSuccessMessage(
      data.session
        ? "Account created successfully. Please log in."
        : "Account created. Check your email to confirm, then log in."
    );

    setIsLogin(true);
    setTimeout(() => {
  setSuccessMessage("");
  }, 5000);
    return;

  } catch (err) {
    console.error(err);

    setServerError(
      err.message || "Something went wrong."
    );

    setLoading(false);
  }
};

  const authInputProps = getAuthInputProps(theme);

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
        : "en-bg-page"
    }
  `}
>
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
        : "en-bg-elevated-soft border-white"
    }

    shadow-[0_0_80px_rgba(16,185,129,0.15)]
  `}
>
        
        {/* Left Branding Panel */}
<div
  className="
    hidden
    md:flex
    flex-col
    justify-center
    items-center
    p-10
    w-1/2
    relative

    bg-gradient-to-br
    from-[#10B981]
    via-[#14b8a6]
    to-[#0891b2]
  "
>          <div className="group relative mb-6">
            <div className="absolute inset-0 bg-emerald-400/30 blur-3xl scale-150 opacity-70 group-hover:opacity-100 transition-all duration-500" />
            <ExamNexusBrand variant="hero" idSuffix="auth" showTagline />
          </div>

          <div className="mt-6">
  <button
    onClick={() =>
      setTheme(theme === "dark" ? "light" : "dark")
    }
    className="
      flex
      items-center
      gap-2
      px-5
      py-3
      rounded-xl

      bg-white/10
      border
      border-white/20

      hover:bg-white/20

      transition-all
      duration-300
    "
  >
    {theme === "dark" ? (
      <>
        <Sun size={18} />
        Light Mode
      </>
    ) : (
      <>
        <Moon size={18} />
        Dark Mode
      </>
    )}
  </button>
</div>
        </div>

        {/* Right Form Panel */}
<div
  className={`w-full md:w-1/2 md:max-h-[92vh] overflow-y-auto p-8 md:p-10 ${
    theme === "dark" ? "bg-[#101827] text-white" : "en-bg-elevated text-gray-900"
  }`}
>
  <div className="mb-6 flex flex-col items-center gap-4 md:hidden">
    <ExamNexusBrand variant="panel" idSuffix="auth-mobile" />
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm ${
        theme === "dark"
          ? "border-white/10 bg-white/5 text-gray-300"
          : "border-emerald-200 en-bg-muted text-teal-800"
      }`}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  </div>

  <h2
    className={`text-2xl font-bold ${
      theme === "dark" ? "text-emerald-400" : "text-teal-700"
    }`}
  >
    {isLogin ? "Welcome back" : "Create your account"}
  </h2>
  <p
    className={`mt-1 mb-6 text-sm ${
      theme === "dark" ? "text-gray-400" : "text-gray-600"
    }`}
  >
    {isLogin
      ? "Sign in to continue to ExamNexus."
      : "Join ExamNexus as a student or faculty member."}
  </p>

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <SignupFormFields
                form={form}
                errors={errors}
                theme={theme}
                authInputProps={authInputProps}
                onFieldChange={handleChange}
                onRoleChange={handleRoleChange}
              />
            )}

            {!isLogin && (
              <p
                className={`mb-4 mt-5 text-xs font-semibold uppercase tracking-wider ${
                  theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
                }`}
              >
                Login credentials
              </p>
            )}

            <div className={isLogin ? "space-y-4" : "space-y-4"}>
              <div>
                <label
                  className={`mb-1.5 block text-sm font-medium ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  placeholder="you@school.edu"
                  {...authInputProps}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label
                  className={`mb-1.5 block text-sm font-medium ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    placeholder={isLogin ? "Enter your password" : "Create a password"}
                    {...authInputProps}
                    className={`${authInputProps.className} pr-12`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-emerald-400"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>

                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                )}
              </div>
            </div>

            {serverError && (
  <div
    className="
      mb-4
      p-3
      rounded-xl

      bg-red-500/10
      border
      border-red-500/30

      text-red-400
      text-sm
      text-center
    "
  >
    {serverError}
  </div>
)}

{successMessage && (
  <div
    className="
      mb-4
      p-3
      rounded-xl

      bg-emerald-500/10
      border
      border-emerald-500/30

      text-emerald-400
      text-sm
      text-center

      animate-pulse
    "
  >
    ✓ {successMessage}
  </div>
)}

            <button
  type="submit"
  disabled={loading}
  className={`${primaryButtonFull(theme)} mt-6`}
>
  {loading
    ? "Please wait..."
    : isLogin
    ? "Login"
    : "Sign Up"}
</button>
          </form>

          <p
          className={`mt-6 text-center text-sm ${
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
            {isLogin ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className={`font-semibold underline-offset-2 hover:underline ${
                    theme === "dark" ? "text-emerald-400" : "text-teal-700"
                  }`}
                  onClick={() => {
                  setIsLogin(false);
                  setErrors({});
                  setServerError("");
                }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className={`font-semibold underline-offset-2 hover:underline ${
                    theme === "dark" ? "text-emerald-400" : "text-teal-700"
                  }`}
                  onClick={() => {
                  setIsLogin(true);
                  setErrors({});
                  setServerError("");
                }}
                >
                  Log in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}