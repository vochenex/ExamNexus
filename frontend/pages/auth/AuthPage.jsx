import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  UserRound,
  X,
  Copy,
  Check,
} from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { primaryButtonFull } from "../../utils/themeButtons";
import { supabase } from "../../supabaseClient";
import {
  buildSignupMetadata,
  buildUserProfileRow,
  fetchOrCreateProfile,
  navigateForRole,
  saveSignupProfile,
  saveSignupSchoolIdCache,
} from "../../utils/authProfile";
import { isAccountApproved, isAdminUser, fetchAccountAccess } from "../../utils/adminData";
import {
  checkPasswordResetRequest,
  clearPasswordResetTemporaryPassword,
  submitPasswordResetRequest,
  updatePasswordResetRequest,
} from "../../utils/passwordReset";
import {
  buildCrmcEmail,
  authEmailError,
  CRMCC_EMAIL_PLACEHOLDER,
} from "../../utils/schoolEmail";
import { useNavigationProgress } from "../../contexts/NavigationProgressContext";
import { checkSignupCredentials } from "../../utils/authSignup";
import { formatSupabaseError } from "../../utils/supabaseErrors";
import {
  normalizeSchoolId,
  validateSchoolIdAnyRole,
  validateSchoolIdForRole,
} from "../../utils/schoolIdRules";
import {
  buildPendingAuthNotice,
  clearAuthNotice,
  peekAuthNotice,
} from "../../utils/authNotice";
import SignupWizard from "../../components/auth/SignupWizard";
import ExamNexusBrand from "../../components/ExamNexusBrand";
import HomeSiteHeader from "../../components/home/HomeSiteHeader";
import HomeBottomBar from "../../components/home/HomeBottomBar";
import NativeAuthHeader from "../../components/NativeAuthHeader";
import LogoSplashScreen from "../../components/LogoSplashScreen";
import ProgressButton from "../../components/ui/ProgressButton";
import { useAppModal } from "../../contexts/AppModalContext";
import useMobileNav from "../../hooks/useMobileNav";
import { isNativeApp } from "../../utils/platform";
import {
  getRememberedPassword,
  getSavedAccounts,
  hasAccountPin,
  removeSavedAccount,
  setAccountPin,
  setRememberedPassword,
  upsertSavedAccount,
  verifyAccountPin,
} from "../../utils/savedAccounts";
import DevicePinLock from "../../components/DevicePinLock";
import "../../styles/home.css";

export default function ExamNexusAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { beginNavigation } = useNavigationProgress();
  const mobileNav = useMobileNav();
  const useCompactAuthHeader = isNativeApp() || mobileNav;
  const { alert: showAlert } = useAppModal();
  const lastNoticeKeyRef = useRef(null);
  const formPanelRef = useRef(null);
  const authBodyRef = useRef(null);
  const savedListRef = useRef(null);
  const savedAccountsWrapRef = useRef(null);
  const savedAccountsBlockRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [authView, setAuthView] = useState("login");
  const [loading, setLoading] = useState(false);
  const [emailManuallyEdited, setEmailManuallyEdited] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [pendingReviewMessage, setPendingReviewMessage] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState(() => getSavedAccounts());
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedScrollUp, setSavedScrollUp] = useState(false);
  const [savedScrollDown, setSavedScrollDown] = useState(false);
  const [pinSession, setPinSession] = useState(null);
  const [pinError, setPinError] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState("send");
  const [resetStatusResult, setResetStatusResult] = useState(null);
  const [showTempPassword, setShowTempPassword] = useState(false);
  const forgotResultRef = useRef(null);
  const feedbackRef = useRef(null);
  const draftPinRef = useRef("");

  useEffect(() => {
    if (!resetStatusResult && !successMessage && !serverError && !pendingReviewMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      const target =
        forgotResultRef.current || feedbackRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [resetStatusResult, successMessage, serverError, pendingReviewMessage]);

  useEffect(() => {
    if (authView !== "signup" || !formPanelRef.current) return;
    formPanelRef.current.scrollTop = 0;
  }, [authView]);

  const updateSavedScrollState = () => {
    const list = savedListRef.current;
    if (!list) {
      setSavedScrollUp(false);
      setSavedScrollDown(false);
      return;
    }

    const overflow = list.scrollHeight > list.clientHeight + 2;
    setSavedScrollUp(overflow && list.scrollTop > 4);
    setSavedScrollDown(
      overflow && list.scrollTop + list.clientHeight < list.scrollHeight - 4
    );
  };

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
    if (!savedOpen || authView !== "login") return undefined;

    updateSavedScrollState();
    const list = savedListRef.current;
    const wrap = savedAccountsWrapRef.current;
    if (!list || !wrap) return undefined;

    let lastTouchY = 0;

    const applyListScroll = (deltaY) => {
      if (!deltaY) return;
      const max = Math.max(0, list.scrollHeight - list.clientHeight);
      list.scrollTop = Math.min(max, Math.max(0, list.scrollTop + deltaY));
      updateSavedScrollState();
    };

    // Own the gesture entirely so email/password (and page) never move.
    const onWheel = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      applyListScroll(event.deltaY);
    };

    const onTouchStart = (event) => {
      lastTouchY = event.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (event) => {
      const touchY = event.touches[0]?.clientY ?? lastTouchY;
      const delta = lastTouchY - touchY;
      lastTouchY = touchY;
      event.preventDefault();
      event.stopImmediatePropagation();
      applyListScroll(delta);
    };

    const authBody = authBodyRef.current;
    const formPanel = formPanelRef.current;
    const lockedBodyScroll = authBody?.scrollTop ?? 0;
    const lockedPanelScroll = formPanel?.scrollTop ?? 0;
    const lockedWindowScroll = window.scrollY || window.pageYOffset || 0;

    const freezeParents = () => {
      if (authBody && authBody.scrollTop !== lockedBodyScroll) {
        authBody.scrollTop = lockedBodyScroll;
      }
      if (formPanel && formPanel.scrollTop !== lockedPanelScroll) {
        formPanel.scrollTop = lockedPanelScroll;
      }
      if ((window.scrollY || window.pageYOffset || 0) !== lockedWindowScroll) {
        window.scrollTo(0, lockedWindowScroll);
      }
    };

    const trapOptions = { capture: true, passive: false };

    list.addEventListener("scroll", updateSavedScrollState, { passive: true });
    wrap.addEventListener("wheel", onWheel, trapOptions);
    wrap.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    wrap.addEventListener("touchmove", onTouchMove, trapOptions);
    authBody?.addEventListener("scroll", freezeParents, { passive: true });
    formPanel?.addEventListener("scroll", freezeParents, { passive: true });
    window.addEventListener("scroll", freezeParents, { passive: true });
    window.addEventListener("resize", updateSavedScrollState);

    return () => {
      list.removeEventListener("scroll", updateSavedScrollState);
      wrap.removeEventListener("wheel", onWheel, trapOptions);
      wrap.removeEventListener("touchstart", onTouchStart, { capture: true });
      wrap.removeEventListener("touchmove", onTouchMove, trapOptions);
      authBody?.removeEventListener("scroll", freezeParents);
      formPanel?.removeEventListener("scroll", freezeParents);
      window.removeEventListener("scroll", freezeParents);
      window.removeEventListener("resize", updateSavedScrollState);
    };
  }, [savedOpen, savedAccounts.length, authView]);

  useEffect(() => {
    if (!savedOpen || authView !== "login") return undefined;

    const authBody = authBodyRef.current;
    const formPanel = formPanelRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    authBody?.classList.add("en-auth-body--saved-open");
    formPanel?.classList.add("en-auth-panel-form--saved-open");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      authBody?.classList.remove("en-auth-body--saved-open");
      formPanel?.classList.remove("en-auth-panel-form--saved-open");
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [savedOpen, authView]);

  useEffect(() => {
    if (!savedOpen || authView !== "login") return undefined;

    const root = formPanelRef.current;
    if (!root) return undefined;

    const onFocusIn = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (savedAccountsBlockRef.current?.contains(target)) return;
      setSavedOpen(false);
    };

    root.addEventListener("focusin", onFocusIn);
    return () => root.removeEventListener("focusin", onFocusIn);
  }, [savedOpen, authView]);

  const scrollSavedAccounts = (direction) => {
    savedListRef.current?.scrollBy({
      top: direction * 88,
      behavior: "smooth",
    });
  };

  // Keep the focused field visible above the on-screen keyboard (native app only).
  useEffect(() => {
    if (!isNativeApp()) return undefined;

    const root = formPanelRef.current;
    if (!root) return undefined;

    const onFocusIn = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      window.setTimeout(() => {
        try {
          target.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "smooth",
          });
        } catch {
          target.scrollIntoView(true);
        }
      }, 120);
    };

    root.addEventListener("focusin", onFocusIn);
    return () => root.removeEventListener("focusin", onFocusIn);
  }, [authView]);

  const copySignupEmail = async () => {
    const value = String(form.email || "").trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setEmailCopied(true);
      window.setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      await showAlert({
        title: "Copy email",
        message: value,
        tone: "info",
        confirmLabel: "OK",
      });
    }
  };

  useEffect(() => {
    const notice = location.state?.authNotice || peekAuthNotice();
    if (!notice) return;

    const noticeKey = `${location.key}:${notice.title}:${notice.message}`;
    if (lastNoticeKeyRef.current === noticeKey) return;
    lastNoticeKeyRef.current = noticeKey;

    clearAuthNotice();
    setServerError("");
    setPendingReviewMessage(notice.message || notice.title || "");
    setAuthView("login");
    setIsLogin(true);

    if (location.state?.authNotice) {
      navigate("/auth", { replace: true, state: {} });
    }
  }, [location.key, location.state, navigate]);

  const blockPendingAccess = async (accessProfile) => {
    const notice = buildPendingAuthNotice(accessProfile);
    // Stop the branded splash immediately — show an inline review warning instead.
    setLoading(false);
    setServerError("");
    setPendingReviewMessage(
      notice.message ||
        "Your account is still under review by an administrator. You can log in after it is approved."
    );
    clearAuthNotice();
    await supabase.auth.signOut();
    localStorage.removeItem("examnexus_user");
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
      setResetStatusResult(null);
      setShowTempPassword(false);

      const email = form.email.trim();
      const schoolId = form.schoolId.trim();
      const message = form.resetMessage.trim();

      if (forgotMode === "update") {
        // Update pending message when provided, then always check status for reveal.
        if (message) {
          const updateResult = await updatePasswordResetRequest({
            email,
            schoolId,
            message,
          });
          if (updateResult?.success === false && updateResult?.status === "none") {
            setServerError(
              updateResult.message ||
                "No pending request found. Switch to “Send new request” instead."
            );
            return;
          }
        }

        const result = await checkPasswordResetRequest({ email, schoolId });
        setResetStatusResult(result || null);
        setSuccessMessage(result?.message || "Request status checked.");
        if (result?.status === "completed" && result?.temporary_password) {
          setShowTempPassword(false);
        }
        return;
      }

      const result = await submitPasswordResetRequest({
        email,
        schoolId,
        message,
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
    setPendingReviewMessage("");
    setSuccessMessage("");
    setForgotMode("send");
    setResetStatusResult(null);
    setShowTempPassword(false);
  };

  const switchToSignup = () => {
    setAuthView("signup");
    setIsLogin(false);
    setEmailManuallyEdited(false);
    setErrors({});
    setServerError("");
    setPendingReviewMessage("");
    setSuccessMessage("");
    setForgotMode("send");
    setResetStatusResult(null);
    if (formPanelRef.current) {
      formPanelRef.current.scrollTop = 0;
    }
  };

  const switchToForgot = () => {
    setAuthView("forgot");
    setIsLogin(true);
    setEmailManuallyEdited(false);
    setErrors({});
    setServerError("");
    setPendingReviewMessage("");
    setSuccessMessage("");
    setForgotMode("send");
    setResetStatusResult(null);
    setShowTempPassword(false);
  };

  const finishAuthenticatedSession = (profile, { bindPush = true } = {}) => {
    if (bindPush) {
      import("../../utils/pushNotifications")
        .then(({ syncPushTokenForCurrentUser }) => syncPushTokenForCurrentUser())
        .catch(() => {});
    }

    navigateForRole((to, options) => {
      beginNavigation(to);
      navigate(to, options);
    }, profile.role, { replace: true });
  };

  const persistRememberedAccount = async ({
    email,
    password,
    profile,
    userId,
    pin,
  }) => {
    await setAccountPin(email, pin);
    upsertSavedAccount({
      email,
      role: profile.role,
      first_name: profile.first_name,
      last_name: profile.last_name,
      avatar_url: profile.avatar_url,
      user_id: profile.id || userId,
    });
    setRememberedPassword(email, password, true);
    setSavedAccounts(getSavedAccounts());
  };

  const closePinSession = () => {
    draftPinRef.current = "";
    setPinSession(null);
    setPinError("");
    setPinBusy(false);
  };

  const handlePinComplete = async (pin) => {
    if (!pinSession || pinBusy) return false;

    if (pinSession.stage === "create") {
      setPinError("");
      draftPinRef.current = pin;
      setPinSession((current) =>
        current
          ? {
              ...current,
              stage: "confirm",
              draftPin: pin,
            }
          : null
      );
      return true;
    }

    if (pinSession.stage === "confirm") {
      const expectedPin = draftPinRef.current || pinSession.draftPin;
      if (pin !== expectedPin) {
        setPinError("PINs did not match. Try again.");
        draftPinRef.current = "";
        setPinSession((current) =>
          current
            ? {
                ...current,
                stage: "create",
                draftPin: "",
              }
            : null
        );
        return false;
      }

        try {
        setPinBusy(true);
        await persistRememberedAccount({
          email: pinSession.email,
          password: pinSession.password,
          profile: pinSession.profile,
          userId: pinSession.userId,
          pin,
        });
        const profile = pinSession.profile;
        localStorage.setItem("examnexus_user", JSON.stringify(profile));
        closePinSession();
        finishAuthenticatedSession(profile);
        return true;
      } catch (err) {
        setPinError(err?.message || "Could not save device PIN.");
        setPinBusy(false);
        return false;
      }
    }

    if (pinSession.stage === "unlock") {
      try {
        setPinBusy(true);
        const ok = await verifyAccountPin(pinSession.email, pin);
        if (!ok) {
          setPinError("Incorrect PIN. Try again.");
          setPinBusy(false);
          return false;
        }

        const password = pinSession.password || getRememberedPassword(pinSession.email);
        if (!password) {
          setPinError("Saved credentials are missing. Sign in with your password.");
          setPinBusy(false);
          closePinSession();
          return false;
        }

        // Never put the remembered password into the visible form before PIN passes.
        setRememberMe(true);
        setShowPassword(false);
        setEmailManuallyEdited(true);
        setErrors({});
        setServerError("");
        const unlockEmail = pinSession.email;
        closePinSession();

        // Auto-login only after a verified device PIN.
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: unlockEmail,
          password,
        });

        if (error) {
          setServerError(formatSupabaseError(error, { context: "login" }));
          setLoading(false);
          return false;
        }

        const access = await fetchAccountAccess(supabase, data.user.id);
        if (!access.allowed) {
          await blockPendingAccess(access.profile);
          return false;
        }

        const { profile, error: profileError, pendingApproval } =
          await fetchOrCreateProfile(supabase);

        if (pendingApproval) {
          await blockPendingAccess(access.profile);
          return false;
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
          return false;
        }

        if (!isAccountApproved(profile) && !isAdminUser(profile)) {
          await blockPendingAccess(profile);
          return false;
        }

        saveSignupSchoolIdCache(data.user.id, profile.school_id);
        localStorage.setItem("examnexus_user", JSON.stringify(profile));
        clearPasswordResetTemporaryPassword().catch(() => {});

        upsertSavedAccount({
          email: unlockEmail,
          role: profile.role,
          first_name: profile.first_name,
          last_name: profile.last_name,
          avatar_url: profile.avatar_url,
          user_id: profile.id || data.user.id,
        });
        setRememberedPassword(unlockEmail, password, true);
        setSavedAccounts(getSavedAccounts());
        finishAuthenticatedSession(profile);
        return true;
      } catch (err) {
        setPinError(err?.message || "Could not verify PIN.");
        setPinBusy(false);
        return false;
      }
    }

    return false;
  };

  const handlePinCancel = () => {
    if (!pinSession || pinBusy) return;

    if (pinSession.stage === "create" || pinSession.stage === "confirm") {
      // Login already succeeded — skip saving on this device and continue.
      const profile = pinSession.profile;
      closePinSession();
      if (profile) {
        localStorage.setItem("examnexus_user", JSON.stringify(profile));
        finishAuthenticatedSession(profile);
      }
      return;
    }

    closePinSession();
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
    setPendingReviewMessage("");
    setServerError("");

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

      // Hide temporary password on forgot-password "check/update" after a successful login.
      clearPasswordResetTemporaryPassword().catch(() => {});

      if (rememberMe) {
        const label =
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          form.email;
        // Do not write examnexus_user / navigate yet — PIN must complete first.
        // Also keep splash off so the PIN sheet is visible above the auth page.
        setPinError("");
        setLoading(false);
        setPinSession({
          stage: "create",
          email: String(form.email || "").trim().toLowerCase(),
          label,
          password: form.password,
          profile,
          userId: profile.id || data.user.id,
        });
        return;
      }

      localStorage.setItem("examnexus_user", JSON.stringify(profile));

      const { removed } = removeSavedAccount(form.email);
      setRememberedPassword(form.email, form.password, false);
      if (removed?.user_id) {
        import("../../utils/pushNotifications")
          .then(({ removePushBindingForSavedAccount }) =>
            removePushBindingForSavedAccount(removed.user_id)
          )
          .catch(() => {});
      }
      setSavedAccounts(getSavedAccounts());
      finishAuthenticatedSession(profile);
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
  const useBlendCard = authView === "login" || authView === "signup";

  return (
    <div
      className={`en-auth-shell ${
        theme === "dark" ? "bg-[#031d1f]" : "en-auth-shell-bg en-home-shell"
      }`}
    >
  {loading && !pinSession && <LogoSplashScreen theme={theme} />}

      <DevicePinLock
        open={Boolean(pinSession)}
        mode={
          pinSession?.stage === "confirm"
            ? "confirm"
            : pinSession?.stage === "create"
              ? "create"
              : "unlock"
        }
        accountLabel={pinSession?.label || pinSession?.email || ""}
        errorMessage={pinError}
        busy={pinBusy}
        onComplete={handlePinComplete}
        onCancel={handlePinCancel}
      />

  {useCompactAuthHeader ? (
    <>
      <NativeAuthHeader />
      {!isNativeApp() && <HomeBottomBar />}
    </>
  ) : (
    <HomeSiteHeader />
  )}

  <div
    ref={authBodyRef}
    className="en-auth-body en-page-enter en-auth-body--centered"
  >  {/* Background Orb 1 */}
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
    mx-auto
    ${useBlendCard ? "" : "rounded-[2rem] overflow-hidden backdrop-blur-2xl border"}
    ${swapPanels ? "en-auth-card--signup" : ""}
    ${authView === "forgot" ? "en-auth-card--forgot" : ""}
    ${useBlendCard ? "en-auth-card--blend" : ""}
    ${savedOpen && authView === "login" ? "en-auth-card--saved-open" : ""}
    ${
      useBlendCard
        ? ""
        : theme === "dark"
          ? "bg-[#0b1114]/90 border-white/10"
          : "border-slate-200/80 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.12)]"
    }
    ${useBlendCard ? "" : "shadow-[0_0_80px_rgba(16,185,129,0.15)]"}
  `}
>
        
        {/* Branding Panel — tablet/desktop; slides to the right on sign up */}
        <div
          className={`en-auth-panel-brand hidden md:flex flex-col items-center justify-center p-8 md:p-10 ${
            useBlendCard
              ? "bg-transparent"
              : theme === "dark"
                ? "bg-gradient-to-br from-[#021818] via-[#043332] to-[#052a28]"
                : "bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#134e4a]"
          }`}
        >
          {!useBlendCard && (
            <>
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
            </>
          )}

          <div className="relative z-10 flex w-full flex-col items-center">
            <div className="max-w-sm w-full">
              <ExamNexusBrand
                variant="hero"
                idSuffix="auth"
                showTagline
                panelTone={useBlendCard && theme === "light" ? "light" : "dark"}
              />
            </div>
          </div>
        </div>

        {/* Form Panel */}
        <div
          ref={formPanelRef}
          className={`en-auth-panel-form px-6 py-5 md:px-8 md:py-6 ${
            useBlendCard
              ? theme === "dark"
                ? "bg-transparent text-gray-100"
                : "bg-transparent text-slate-900"
              : theme === "dark"
                ? "bg-[#101827] text-white"
                : "bg-white text-slate-900"
          }`}
        >
          <div className="en-auth-form-inner">
  <div className="mb-6 flex flex-col items-center gap-4 md:hidden">
    <ExamNexusBrand
      variant="panel"
      idSuffix={isNativeApp() ? "auth-native" : "auth-mobile"}
      panelTone={theme === "light" ? "light" : "dark"}
    />
  </div>

  <h2
    className={`text-xl font-bold md:text-2xl ${
      authView === "signup"
        ? "text-emerald-400"
        : theme === "dark"
          ? "text-emerald-400"
          : "text-slate-900"
    }`}
  >
    {authView === "forgot"
      ? forgotMode === "update"
        ? "Update or check your reset request"
        : "Forgot password?"
      : isLogin
        ? "Welcome back"
        : "Create your account"}
  </h2>
  <p
    className={`mt-1 text-sm leading-relaxed ${
      authView === "signup" ? "mb-3" : "mb-4"
    } ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
  >
    {authView === "forgot"
      ? forgotMode === "update"
        ? "Verify your email and school ID to update a pending request or view your temporary password after an admin reset."
        : "Submit a request and an administrator will reset your password."
      : isLogin
        ? "Sign in to continue to ExamNexus."
        : "Fill in all three sections, then create your account."}
  </p>

          <form onSubmit={handleSubmit}>
            {authView === "forgot" ? (
              <div className="space-y-4">
                <div
                  className={`grid grid-cols-2 gap-2 rounded-xl border p-1 ${
                    theme === "dark" ? "border-white/10 bg-white/[0.03]" : "border-emerald-200 bg-emerald-50/40"
                  }`}
                >
                  {[
                    { id: "send", label: "Send request" },
                    { id: "update", label: "Update request" },
                  ].map((option) => {
                    const active = forgotMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setForgotMode(option.id);
                          setSuccessMessage("");
                          setServerError("");
                          setResetStatusResult(null);
                          setShowTempPassword(false);
                        }}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          active
                            ? theme === "dark"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-white text-teal-800 shadow-sm"
                            : theme === "dark"
                              ? "text-gray-400 hover:text-emerald-300"
                              : "text-gray-600 hover:text-teal-800"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
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
                    {forgotMode === "update"
                      ? "Updated message (optional)"
                      : "Message (optional)"}
                  </label>
                  <textarea
                    name="resetMessage"
                    value={form.resetMessage}
                    onChange={handleChange}
                    rows={3}
                    placeholder={
                      forgotMode === "update"
                        ? "Leave a new note for the admin, or leave blank to only check status"
                        : "Any details that help the admin verify your request"
                    }
                    {...authInputProps}
                    className={`${authInputProps.className} resize-none`}
                  />
                </div>

                {resetStatusResult?.status === "completed" ? (
                  <div
                    ref={forgotResultRef}
                    className={`rounded-xl border p-3 ${
                      theme === "dark"
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : "border-teal-200 bg-teal-50"
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold ${
                        theme === "dark" ? "text-emerald-300" : "text-teal-900"
                      }`}
                    >
                      {resetStatusResult.temporary_password
                        ? "Password reset complete"
                        : "Password reset already used"}
                    </p>
                    {resetStatusResult.message ? (
                      <p
                        className={`mt-2 text-sm ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        {resetStatusResult.message}
                      </p>
                    ) : null}
                    {resetStatusResult.admin_message ? (
                      <p
                        className={`mt-2 text-sm ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        <span className="font-medium">Admin message:</span>{" "}
                        {resetStatusResult.admin_message}
                      </p>
                    ) : null}
                    {resetStatusResult.temporary_password ? (
                      <div className="mt-3">
                        <p
                          className={`mb-1 text-xs font-semibold uppercase tracking-wide ${
                            theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Temporary password
                        </p>
                        <div className="relative">
                          <input
                            type={showTempPassword ? "text" : "password"}
                            readOnly
                            value={resetStatusResult.temporary_password}
                            className={`${authInputProps.className} pr-20 font-mono`}
                          />
                          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setShowTempPassword((current) => !current)}
                              className={
                                theme === "dark"
                                  ? "rounded p-1 text-gray-400 hover:text-emerald-300"
                                  : "rounded p-1 text-gray-500 hover:text-teal-700"
                              }
                              aria-label={showTempPassword ? "Hide password" : "Show password"}
                            >
                              {showTempPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    resetStatusResult.temporary_password
                                  );
                                } catch {
                                  // ignore clipboard failures on restricted webviews
                                }
                              }}
                              className={
                                theme === "dark"
                                  ? "rounded p-1 text-gray-400 hover:text-emerald-300"
                                  : "rounded p-1 text-gray-500 hover:text-teal-700"
                              }
                              aria-label="Copy temporary password"
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {resetStatusResult.temporary_password ? (
                      <p
                        className={`mt-3 text-sm font-medium ${
                          theme === "dark" ? "text-amber-300" : "text-amber-800"
                        }`}
                      >
                        Warning: this is only a temporary password. Sign in and change it as soon as possible.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {resetStatusResult?.status === "pending" ||
                resetStatusResult?.status === "rejected" ||
                resetStatusResult?.status === "none" ? (
                  <div
                    ref={forgotResultRef}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      theme === "dark"
                        ? "border-white/10 bg-white/[0.03] text-gray-300"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {resetStatusResult.message}
                    {resetStatusResult.status === "rejected" && resetStatusResult.admin_message
                      ? ` Admin note: ${resetStatusResult.admin_message}`
                      : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                {authView === "signup" ? (
                  <SignupWizard
                    form={form}
                    errors={errors}
                    theme={theme}
                    authInputProps={authInputProps}
                    onFieldChange={handleChange}
                    onRoleChange={handleRoleChange}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    emailCopied={emailCopied}
                    onCopyEmail={copySignupEmail}
                    loading={loading}
                  />
                ) : (
                <div className="space-y-4">
                  {authView === "login" && savedAccounts.length > 0 && (
                    <div
                      ref={savedAccountsBlockRef}
                      className={`overflow-hidden rounded-xl border ${
                        theme === "dark" ? "border-white/10 bg-white/[0.03]" : "border-emerald-200 bg-emerald-50/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSavedOpen((open) => !open)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold"
                      >
                        <span>Saved accounts ({savedAccounts.length})</span>
                        {savedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {savedOpen && (
                        <div
                          ref={savedAccountsWrapRef}
                          className="en-saved-accounts-wrap border-t border-inherit"
                        >
                          {savedScrollUp && (
                            <div className="flex justify-center px-2 pt-1">
                              <button
                                type="button"
                                aria-label="Scroll saved accounts up"
                                onClick={() => scrollSavedAccounts(-1)}
                                className={`rounded-md p-1 ${
                                  theme === "dark"
                                    ? "text-emerald-300 hover:bg-white/10"
                                    : "text-teal-700 hover:bg-white/80"
                                }`}
                              >
                                <ChevronUp size={16} />
                              </button>
                            </div>
                          )}
                          <div
                            ref={savedListRef}
                            className="en-saved-accounts-list space-y-1 px-2 pb-2 pt-1"
                          >
                          {savedAccounts.map((account) => {
                            const label =
                              [account.first_name, account.last_name].filter(Boolean).join(" ") ||
                              account.email;
                            return (
                              <div
                                key={account.email}
                                className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
                                  theme === "dark" ? "hover:bg-white/5" : "hover:bg-white/80"
                                }`}
                              >
                                <button
                                  type="button"
                                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                  onClick={() => {
                                    const email = String(account.email || "")
                                      .trim()
                                      .toLowerCase();
                                    const rememberedPassword = getRememberedPassword(email);
                                    if (!rememberedPassword || !hasAccountPin(email)) {
                                      // Remove insecure / incomplete saves so they cannot
                                      // silently fill passwords and skip the PIN gate.
                                      const { accounts } = removeSavedAccount(email);
                                      setSavedAccounts(accounts);
                                      setRememberedPassword(email, "", false);
                                      setServerError(
                                        "That saved account had no device PIN, so it was removed. Sign in with your password and turn on Remember me to set a PIN."
                                      );
                                      setForm((current) => ({
                                        ...current,
                                        email,
                                        password: "",
                                      }));
                                      setRememberMe(false);
                                      setSavedOpen(false);
                                      return;
                                    }

                                    setPinError("");
                                    setServerError("");
                                    setPinSession({
                                      stage: "unlock",
                                      email,
                                      label,
                                      password: rememberedPassword,
                                    });
                                    setSavedOpen(false);
                                  }}
                                >
                                  <span
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                      theme === "dark" ? "bg-emerald-500/15 text-emerald-300" : "bg-teal-100 text-teal-800"
                                    }`}
                                  >
                                    <UserRound size={14} />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block break-words text-sm font-medium leading-snug">{label}</span>
                                    <span className={`block break-words text-[11px] leading-snug ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                                      Continue as {account.email}
                                    </span>
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Remove ${account.email}`}
                                  onClick={() => {
                                    const { accounts, removed } = removeSavedAccount(
                                      account.email
                                    );
                                    setSavedAccounts(accounts);
                                    setRememberedPassword(account.email, "", false);
                                    if (removed?.user_id) {
                                      import("../../utils/pushNotifications")
                                        .then(({ removePushBindingForSavedAccount }) =>
                                          removePushBindingForSavedAccount(removed.user_id)
                                        )
                                        .catch(() => {});
                                    }
                                  }}
                                  className="shrink-0 rounded-md p-1 text-gray-400 hover:text-red-400"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            );
                          })}
                          </div>
                          {savedScrollDown && (
                            <div className="flex justify-center px-2 pb-2">
                              <button
                                type="button"
                                aria-label="Scroll saved accounts down"
                                onClick={() => scrollSavedAccounts(1)}
                                className={`rounded-md p-1 ${
                                  theme === "dark"
                                    ? "text-emerald-300 hover:bg-white/10"
                                    : "text-teal-700 hover:bg-white/80"
                                }`}
                              >
                                <ChevronDown size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="en-auth-login-fields space-y-4">
                  <div>
                    <label
                      className={`mb-1.5 block text-sm font-medium ${
                        theme === "dark" ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Email
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        autoComplete="email"
                        placeholder={CRMCC_EMAIL_PLACEHOLDER}
                        {...authInputProps}
                      />
                    </div>
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
                      <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setRememberMe(checked);
                            if (!checked && form.email) {
                              const { accounts, removed } = removeSavedAccount(form.email);
                              setSavedAccounts(accounts);
                              setRememberedPassword(form.email, "", false);
                              if (removed?.user_id) {
                                import("../../utils/pushNotifications")
                                  .then(({ removePushBindingForSavedAccount }) =>
                                    removePushBindingForSavedAccount(removed.user_id)
                                  )
                                  .catch(() => {});
                              }
                            }
                          }}
                          className="h-3.5 w-3.5 shrink-0 rounded border-emerald-400 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className={`break-words leading-snug ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                          Remember me on this device
                        </span>
                      </label>
                    )}
                    {authView === "login" && rememberMe && (
                      <p
                        className={`mt-1.5 text-[11px] leading-snug ${
                          theme === "dark" ? "text-gray-500" : "text-gray-500"
                        }`}
                      >
                        You’ll create a 4-digit device PIN after signing in. Saved
                        accounts require that PIN to unlock.
                      </p>
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
                </div>
                )}
              </>
            )}

            {pendingReviewMessage && (
              <div
                ref={feedbackRef}
                role="status"
                className={`mb-4 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                  theme === "dark"
                    ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                    : "border-amber-300 bg-amber-50 text-amber-900"
                }`}
              >
                <p className="font-semibold">Account under review</p>
                <p className="mt-1 opacity-90">{pendingReviewMessage}</p>
              </div>
            )}

            {serverError && (
  <div
    ref={feedbackRef}
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
    ref={feedbackRef}
    className={`mb-4 rounded-xl border p-3 text-center text-sm animate-pulse ${
      theme === "dark"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
        : "border-emerald-300 bg-emerald-50 text-emerald-800"
    }`}
  >
    ✓ {successMessage}
  </div>
)}

            {authView !== "signup" ? (
            <ProgressButton
  type="submit"
  loading={loading}
  loadingLabel="Please wait..."
  className={`${primaryButtonFull(theme)} mt-6`}
>
  {authView === "forgot"
    ? forgotMode === "update"
      ? "Check / update request"
      : "Send reset request"
    : isLogin
      ? "Login"
      : "Sign Up"}
</ProgressButton>
            ) : null}
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