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
import { isAccountApproved } from "../utils/adminData";
import { submitPasswordResetRequest } from "../utils/passwordReset";
import SignupFormFields from "./auth/SignupFormFields";
import ExamNexusBrand from "./ExamNexusBrand";

export default function ExamNexusAuth() {
  const navigate = useNavigate();
const { theme, setTheme } = useTheme();
const [showPassword, setShowPassword] = useState(false);
const [successMessage, setSuccessMessage] = useState("");
const [isLogin, setIsLogin] = useState(true);
const [authView, setAuthView] = useState("login");
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
  resetMessage: "",
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

    if (authView === "forgot") {
      if (!form.schoolId) errs.schoolId = "School ID is required";
      setErrors(errs);
      return Object.keys(errs).length === 0;
    }

    if (!form.password) errs.password = "Password is required";
    if (authView === "signup") {
      if (!form.firstName) errs.firstName = "First name is required";
      if (!form.lastName) errs.lastName = "Last name is required";
      if (!form.schoolId) errs.schoolId = "School ID is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);
      setServerError("");
      setSuccessMessage("");

      const result = await submitPasswordResetRequest({
        email: form.email.trim(),
        schoolId: form.schoolId.trim(),
        message: form.resetMessage.trim(),
      });

      setSuccessMessage(
        result.message ||
          "Your request was sent to an administrator. You will be able to log in after they reset your password."
      );
      setForm((current) => ({
        ...current,
        password: "",
        resetMessage: "",
      }));
    } catch (err) {
      setServerError(err.message || "Could not submit password reset request.");
    } finally {
      setLoading(false);
    }
  };

  const switchToLogin = () => {
    setAuthView("login");
    setIsLogin(true);
    setErrors({});
    setServerError("");
    setSuccessMessage("");
  };

  const switchToSignup = () => {
    setAuthView("signup");
    setIsLogin(false);
    setErrors({});
    setServerError("");
    setSuccessMessage("");
  };

  const switchToForgot = () => {
    setAuthView("forgot");
    setIsLogin(true);
    setErrors({});
    setServerError("");
    setSuccessMessage("");
  };

  const handleSubmit = async (e) => {
  try {
    e.preventDefault();

    if (!validate()) return;

    if (authView === "forgot") {
      await handleForgotSubmit(e);
      return;
    }

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

      if (!isAccountApproved(profile)) {
        await supabase.auth.signOut();
        localStorage.removeItem("examnexus_user");
        setServerError(
          profile.account_status === "rejected"
            ? "Your registration was not approved. Contact your administrator if you believe this is a mistake."
            : "Your account is pending admin approval. You can log in after an administrator approves your request."
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

      await supabase.auth.signOut();
      localStorage.removeItem("examnexus_user");
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
        ? "Registration submitted. An administrator must approve your account before you can log in."
        : "Registration submitted. Confirm your email if required, then wait for admin approval before logging in."
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
          className={`hidden md:flex flex-col justify-center items-center p-10 w-1/2 relative overflow-hidden ${
            theme === "dark"
              ? "bg-gradient-to-br from-[#021818] via-[#043332] to-[#052a28]"
              : "bg-gradient-to-br from-[#edfbf6] via-[#dff5ec] to-[#cceee3]"
          }`}
        >
          <div
            className={`pointer-events-none absolute inset-0 ${
              theme === "dark"
                ? "bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.12),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(6,182,212,0.08),transparent_40%)]"
                : "bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.85),transparent_50%),radial-gradient(circle_at_75%_85%,rgba(167,243,208,0.45),transparent_45%)]"
            }`}
          />
          <div
            className={`pointer-events-none absolute inset-0 opacity-[0.035] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:32px_32px] ${
              theme === "light" ? "opacity-[0.06]" : ""
            }`}
          />

          <div className="relative z-10 mb-6 max-w-sm">
            <ExamNexusBrand
              variant="hero"
              idSuffix="auth"
              showTagline
              panelTone={theme === "dark" ? "dark" : "light"}
            />
          </div>

          <div className="relative z-10 mt-2">
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all duration-300 ${
                theme === "dark"
                  ? "border-white/15 bg-white/10 text-emerald-50 hover:bg-white/15"
                  : "border-emerald-300/70 bg-white/70 text-teal-900 shadow-sm hover:bg-white"
              }`}
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
    {authView === "forgot"
      ? "Forgot password?"
      : isLogin
        ? "Welcome back"
        : "Create your account"}
  </h2>
  <p
    className={`mt-1 mb-6 text-sm ${
      theme === "dark" ? "text-gray-400" : "text-gray-600"
    }`}
  >
    {authView === "forgot"
      ? "Submit a request and an administrator will reset your password."
      : isLogin
        ? "Sign in to continue to ExamNexus."
        : "Join ExamNexus as a student or faculty member."}
  </p>

          <form onSubmit={handleSubmit}>
            {authView === "forgot" ? (
              <div className="space-y-4">
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
                    School ID
                  </label>
                  <input
                    type="text"
                    name="schoolId"
                    value={form.schoolId}
                    onChange={handleChange}
                    placeholder="Your school ID"
                    {...authInputProps}
                  />
                  {errors.schoolId && (
                    <p className="text-red-500 text-xs mt-1">{errors.schoolId}</p>
                  )}
                </div>
                <div>
                  <label
                    className={`mb-1.5 block text-sm font-medium ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Message (optional)
                  </label>
                  <textarea
                    name="resetMessage"
                    value={form.resetMessage}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Any details that help the admin verify your request"
                    {...authInputProps}
                    className={`${authInputProps.className} resize-none`}
                  />
                </div>
              </div>
            ) : (
              <>
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
                {isLogin && authView === "login" && (
                  <button
                    type="button"
                    onClick={switchToForgot}
                    className={`mt-2 text-xs font-medium underline-offset-2 hover:underline ${
                      theme === "dark" ? "text-emerald-400" : "text-teal-700"
                    }`}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            </div>
              </>
            )}

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
    : authView === "forgot"
      ? "Send reset request"
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
            {authView === "forgot" ? (
              <>
                Remember your password?{" "}
                <button
                  type="button"
                  className={`font-semibold underline-offset-2 hover:underline ${
                    theme === "dark" ? "text-emerald-400" : "text-teal-700"
                  }`}
                  onClick={switchToLogin}
                >
                  Back to login
                </button>
              </>
            ) : isLogin ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className={`font-semibold underline-offset-2 hover:underline ${
                    theme === "dark" ? "text-emerald-400" : "text-teal-700"
                  }`}
                  onClick={switchToSignup}
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
                  onClick={switchToLogin}
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