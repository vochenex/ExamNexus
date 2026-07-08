import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
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
import { isAccountApproved, isAdminUser, fetchAccountAccess } from "../utils/adminData";
import { submitPasswordResetRequest } from "../utils/passwordReset";
import {
  buildCrmcEmail,
  authEmailError,
  CRMCC_EMAIL_PLACEHOLDER,
} from "../utils/schoolEmail";
import { checkSignupCredentials } from "../utils/authSignup";
import { formatSupabaseError } from "../utils/supabaseErrors";
import {
  normalizeSchoolId,
  validateSchoolIdAnyRole,
  validateSchoolIdForRole,
} from "../utils/schoolIdRules";
import {
  buildPendingAuthNotice,
  clearAuthNotice,
  peekAuthNotice,
  stashAuthNotice,
} from "../utils/authNotice";
import SignupFormFields from "./auth/SignupFormFields";
import PendingApprovalModal from "./auth/PendingApprovalModal";
import ExamNexusBrand from "./ExamNexusBrand";
import HomeSiteHeader from "./home/HomeSiteHeader";
import LogoSplashScreen from "./LogoSplashScreen";
import "../styles/home.css";

export default function ExamNexusAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const lastNoticeKeyRef = useRef(null);
  const formPanelRef = useRef(null);
const [showPassword, setShowPassword] = useState(false);
const [successMessage, setSuccessMessage] = useState("");
const [isLogin, setIsLogin] = useState(true);
const [authView, setAuthView] = useState("login");
const [loading, setLoading] = useState(false);
  const [emailManuallyEdited, setEmailManuallyEdited] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [authNotice, setAuthNotice] = useState(null);

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

    if (name === "email") {
      setEmailManuallyEdited(true);
    }

    setForm((current) => {
      const next = {
        ...current,
        [name]: name === "schoolId" ? normalizeSchoolId(value) : value,
      };

      if (name === "department") {
        next.course = "";
      }

      return next;
    });

    setErrors({ ...errors, [e.target.name]: "" });
    setServerError("");
    setSuccessMessage("");
  };

  useEffect(() => {
    if (authView !== "signup" || emailManuallyEdited) return;

    const suggested = buildCrmcEmail(form.lastName, form.firstName);
    if (!suggested) return;

    setForm((current) =>
      current.email === suggested ? current : { ...current, email: suggested }
    );
  }, [authView, emailManuallyEdited, form.firstName, form.lastName]);

  useEffect(() => {
    if (authView !== "signup" || !formPanelRef.current) return;
    formPanelRef.current.scrollTop = 0;
  }, [authView]);

  useEffect(() => {
    const notice = location.state?.authNotice || peekAuthNotice();
    if (!notice) return;

    const noticeKey = `${location.key}:${notice.title}:${notice.message}`;
    if (lastNoticeKeyRef.current === noticeKey) return;
    lastNoticeKeyRef.current = noticeKey;

    clearAuthNotice();
    setAuthNotice(notice);

    if (location.state?.authNotice) {
      navigate("/auth", { replace: true, state: {} });
    }
  }, [location.key, location.state, navigate]);

  const blockPendingAccess = async (accessProfile) => {
    const notice = buildPendingAuthNotice(accessProfile);
    await supabase.auth.signOut();
    localStorage.removeItem("examnexus_user");
    setServerError("");
    setLoading(false);
    stashAuthNotice(notice);
    setAuthNotice(notice);
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
    const schoolFormatRequired = authView !== "login";
    const emailError = authEmailError(form.email, { schoolFormatRequired });

    if (emailError) {
      errs.email = emailError;
    }

    if (authView === "forgot") {
      const schoolIdCheck = validateSchoolIdAnyRole(form.schoolId);
      if (!schoolIdCheck.valid) errs.schoolId = schoolIdCheck.message;
      setErrors(errs);
      return Object.keys(errs).length === 0;
    }

    if (!form.password) errs.password = "Password is required";
    if (authView === "signup") {
      if (!form.firstName) errs.firstName = "First name is required";
      if (!form.lastName) errs.lastName = "Last name is required";
      const schoolIdCheck = validateSchoolIdForRole(form.schoolId, form.role);
      if (!schoolIdCheck.valid) errs.schoolId = schoolIdCheck.message;
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
      setServerError(
        formatSupabaseError(err, {
          context: "forgot-password",
          fallback: "Could not submit password reset request.",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const switchToLogin = () => {
    setAuthView("login");
    setIsLogin(true);
    setEmailManuallyEdited(false);
    setErrors({});
    setServerError("");
    setSuccessMessage("");
  };

  const switchToSignup = () => {
    setAuthView("signup");
    setIsLogin(false);
    setEmailManuallyEdited(false);
    setErrors({});
    setServerError("");
    setSuccessMessage("");
  };

  const switchToForgot = () => {
    setAuthView("forgot");
    setIsLogin(true);
    setEmailManuallyEdited(false);
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
        setServerError(formatSupabaseError(error, { context: "login" }));
        setLoading(false);
        return;
      }

      const access = await fetchAccountAccess(supabase, data.user.id);
      if (!access.allowed) {
        await blockPendingAccess(access.profile);
        return;
      }

      const { profile, error: profileError, pendingApproval } =
        await fetchOrCreateProfile(supabase);

      if (pendingApproval) {
        await blockPendingAccess(access.profile);
        return;
      }

      if (profileError || !profile) {
        setServerError(
          formatSupabaseError(profileError, {
            context: "profile",
            fallback:
              "Your account exists but the profile could not be loaded. Run database/users_signup_policies.sql in Supabase, then try again.",
          })
        );
        setLoading(false);
        return;
      }

      if (!isAccountApproved(profile) && !isAdminUser(profile)) {
        await blockPendingAccess(profile);
        return;
      }

      saveSignupSchoolIdCache(data.user.id, profile.school_id);

      localStorage.setItem(
        "examnexus_user",
        JSON.stringify(profile)
      );

      // Re-bind this device's push token to the signed-in student/faculty account.
      import("../utils/pushNotifications")
        .then(({ syncPushTokenForCurrentUser }) => syncPushTokenForCurrentUser())
        .catch(() => {});

      // Keep the branded loader visible through the route change + lazy
      // dashboard load. Clearing `loading` here would re-reveal the login form
      // for a beat before navigation commits — which looked like the page
      // "bouncing back to login and then auto-logging in after a delay".
      navigateForRole(navigate, profile.role, { replace: true });
      return;
    }

    const credentialCheck = await checkSignupCredentials(
      supabase,
      form.email,
      form.schoolId
    );

    if (!credentialCheck.ok) {
      setServerError(credentialCheck.message);
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
      setServerError(formatSupabaseError(error, { context: "signup" }));
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
        setServerError(
          formatSupabaseError(saveError, {
            context: "signup",
            fallback: "Could not save your profile.",
          })
        );
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
    setAuthView("login");
    setTimeout(() => {
  setSuccessMessage("");
  }, 5000);
    return;

  } catch (err) {
    console.error(err);

    setServerError(
      formatSupabaseError(err, {
        context: authView === "signup" ? "signup" : "login",
      })
    );

    setLoading(false);
  }
};

  const authInputProps = getAuthInputProps(theme);
  const swapPanels = authView === "signup";

  return (
    <div
      className={`en-auth-shell ${
        theme === "dark" ? "bg-[#031d1f]" : "en-auth-shell-bg en-home-shell"
      }`}
    >
  <PendingApprovalModal
    notice={authNotice}
    onClose={() => {
      clearAuthNotice();
      setAuthNotice(null);
    }}
  />
  {loading && <LogoSplashScreen theme={theme} />}

  <HomeSiteHeader />

  <div className="en-auth-body en-page-enter">
  {/* Background Orb 1 */}
<div
  className="
    pointer-events-none
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
    pointer-events-none
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
  className={`pointer-events-none absolute inset-0 bg-[size:40px_40px] ${
    theme === "dark"
      ? "opacity-[0.03] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)]"
      : "en-home-grid-overlay opacity-[0.07]"
  }`}
/>
      <div
  className={`
    en-auth-card
    relative
    w-full
    max-w-5xl
    rounded-[32px]
    overflow-hidden
    backdrop-blur-2xl
    border
    ${swapPanels ? "en-auth-card--signup" : ""}
    ${
      theme === "dark"
        ? "bg-[#0b1114]/90 border-white/10"
        : "border-slate-200/80 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.12)]"
    }
    shadow-[0_0_80px_rgba(16,185,129,0.15)]
  `}
>
        
        {/* Branding Panel — desktop only; slides to the right on sign up */}
        <div
          className={`en-auth-panel-brand hidden md:flex flex-col items-center p-10 ${
            theme === "dark"
              ? "bg-gradient-to-br from-[#021818] via-[#043332] to-[#052a28]"
              : "bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#134e4a]"
          }`}
        >
          <div
            className={`pointer-events-none absolute inset-0 ${
              theme === "dark"
                ? "bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.12),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(6,182,212,0.08),transparent_40%)]"
                : "bg-[radial-gradient(circle_at_25%_20%,rgba(13,148,136,0.18),transparent_50%),radial-gradient(circle_at_75%_85%,rgba(15,23,42,0.35),transparent_45%)]"
            }`}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:32px_32px]"
          />

          <div className="relative z-10 flex w-full flex-col items-center">
            <div className="max-w-sm">
              <ExamNexusBrand
                variant="hero"
                idSuffix="auth"
                showTagline
                panelTone="dark"
              />
            </div>
          </div>
        </div>

        {/* Form Panel */}
        <div
          ref={formPanelRef}
          className={`en-auth-panel-form p-8 md:p-10 ${
            theme === "dark" ? "bg-[#101827] text-white" : "bg-white text-slate-900"
          }`}
        >
          <div className="en-auth-form-inner">
  <div className="mb-6 flex flex-col items-center gap-4 md:hidden">
    <ExamNexusBrand
      variant="panel"
      idSuffix="auth-mobile"
      panelTone={theme === "light" ? "light" : "dark"}
    />
  </div>

  <h2
    className={`text-2xl font-bold ${
      theme === "dark" ? "text-emerald-400" : "text-slate-900"
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
                    placeholder={CRMCC_EMAIL_PLACEHOLDER}
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
                {authView === "signup" && (
                  <SignupFormFields
                    form={form}
                    errors={errors}
                    theme={theme}
                    authInputProps={authInputProps}
                    onFieldChange={handleChange}
                    onRoleChange={handleRoleChange}
                  />
                )}

                {authView === "signup" && (
                  <p
                    className={`mb-4 mt-5 text-xs font-semibold uppercase tracking-wider ${
                      theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
                    }`}
                  >
                    Login credentials
                  </p>
                )}

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
                      placeholder={CRMCC_EMAIL_PLACEHOLDER}
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
                    {authView === "login" && (
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
  </div>
    </div>
  );
}