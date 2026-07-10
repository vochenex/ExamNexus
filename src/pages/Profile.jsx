import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../layouts/ThemeContext";
import { useAppModal } from "../contexts/AppModalContext";
import {
  Pencil,
  Lock,
  Mail,
  Shield,
  Users,
  BookOpen,
  ClipboardList,
  Megaphone,
  Calendar,
  BadgeCheck,
  GraduationCap,
  UserRound,
  Compass,
  LogOut,
} from "lucide-react";
import { cardClass, inputClass } from "../utils/themeInputs";
import Select from "../components/ui/Select";
import { supabase } from "../supabaseClient";
import {
  updateUserProfile,
  updateUserAvatar,
  getStudentDashboardStats,
  getFacultyDashboardStats,
} from "../utils/supabaseData";
import { isStudentRole, resolveStudentId } from "../utils/authUser";
import { loadProfileForUser, resolveSchoolId } from "../utils/authProfile";
import { isFacultyRole, hasCustomProfilePhoto } from "../utils/avatar";
import { isAdminUser } from "../utils/adminData";
import { primaryButton, secondaryButton, dangerButton } from "../utils/themeButtons";
import {
  DEPARTMENTS,
  getCoursesForDepartment,
  getDepartmentLabel,
  getCourseLabel,
} from "../utils/academicOptions";
import { YEAR_LEVELS, normalizeYearLevel, getYearLevelLabel } from "../utils/yearLevels";
import ProfileAvatar from "../components/ProfileAvatar";
import AvatarLightbox from "../components/AvatarLightbox";
import { PageLoadingSkeleton } from "../components/ui/PageLoadingSkeleton";
import useMobileNav from "../hooks/useMobileNav";

function inputStyle(theme) {
  return inputClass(theme);
}

function SectionTitle({ children, theme }) {
  return (
    <p
      className={`mb-3 text-xs font-semibold uppercase tracking-wider ${
        theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
      }`}
    >
      {children}
    </p>
  );
}

function FieldLabel({ children, theme, htmlFor, hint }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`mb-1.5 flex items-center justify-between text-sm font-medium ${
        theme === "dark" ? "text-gray-300" : "text-gray-700"
      }`}
    >
      <span>{children}</span>
      {hint && (
        <span className={`text-xs font-normal ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
          {hint}
        </span>
      )}
    </label>
  );
}

function ProfileSelect({ id, value, onChange, disabled, children }) {
  return (
    <Select id={id} value={value} onChange={onChange} disabled={disabled}>
      {children}
    </Select>
  );
}

function StatCard({ value, label, theme, variant = "emerald" }) {
  const variants = {
    emerald:
      theme === "dark"
        ? "from-emerald-500/10 to-teal-500/5 border-emerald-500/20 text-emerald-400"
        : "en-bg-elevated border-emerald-200 text-emerald-700",
    cyan:
      theme === "dark"
        ? "from-cyan-500/10 to-blue-500/5 border-cyan-500/20 text-cyan-400"
        : "en-bg-elevated border-cyan-200 text-cyan-700",
    amber:
      theme === "dark"
        ? "from-yellow-500/10 to-orange-500/5 border-yellow-500/20 text-yellow-400"
        : "en-bg-elevated border-yellow-200 text-yellow-700",
    purple:
      theme === "dark"
        ? "from-purple-500/10 to-pink-500/5 border-purple-500/20 text-purple-400"
        : "en-bg-elevated border-purple-200 text-purple-700",
  };

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition-colors ${
        theme === "dark" ? `bg-gradient-to-br ${variants[variant]}` : variants[variant]
      }`}
    >
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1.5 text-sm opacity-80">{label}</p>
    </div>
  );
}

function QuickLink({ icon: Icon, label, onClick, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.03] text-gray-200 hover:border-emerald-500/30 hover:bg-emerald-500/5"
          : "border-emerald-100 en-bg-elevated text-gray-700 hover:border-teal-300 en-hover"
      }`}
    >
      <Icon
        size={16}
        className={theme === "dark" ? "text-emerald-400" : "text-teal-600"}
      />
      {label}
    </button>
  );
}

export default function Profile() {
  const { theme } = useTheme();
  const { error: showError, confirm: showConfirm } = useAppModal();
  const navigate = useNavigate();
  const mobileNav = useMobileNav();
  const [editing, setEditing] = useState(false);
  const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  const [profile, setProfile] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    email: user.email || "",
    school_id: user.school_id || "",
    gender: user.gender || "",
    department: user.department || "",
    course: user.course || "",
    year_level: user.year_level || "",
    age: user.age || "",
    avatar_url: user.avatar_url || "",
    role: user.role || "",
  });

  const [editProfile, setEditProfile] = useState(profile);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [loadError, setLoadError] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [studentStats, setStudentStats] = useState({
    enrolledSubjects: 0,
    completedAssessments: 0,
    upcomingAssessments: 0,
  });
  const [statsError, setStatsError] = useState("");
  const [facultyStats, setFacultyStats] = useState({
    totalSubjects: 0,
    totalAssessments: 0,
    totalStudents: 0,
  });
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordStatus, setPasswordStatus] = useState("idle");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);

  const isStudent = isStudentRole(profile.role);
  const isFaculty = isFacultyRole(profile.role);
  const isAdmin = isAdminUser(profile);
  const courses = getCoursesForDepartment(editProfile.department);
  const displaySchoolId =
    resolveSchoolId(authUser, editProfile) || editProfile.school_id || "";

  const loadStudentStats = useCallback(async (studentId, role, silent = false) => {
    if (!studentId || !isStudentRole(role)) return;

    try {
      if (!silent) setStatsError("");
      const stats = await getStudentDashboardStats(studentId);
      setStudentStats(stats);
    } catch (err) {
      console.error("Failed to load student stats:", err);
      if (!silent) {
        setStatsError(
          "Could not load your stats. Run database/enroll_student.sql in Supabase, then refresh."
        );
      }
    }
  }, []);

  const loadFacultyStats = useCallback(async (schoolId, role, silent = false) => {
    if (!schoolId || !isFacultyRole(role)) return;

    try {
      if (!silent) setStatsError("");
      const stats = await getFacultyDashboardStats(schoolId);
      setFacultyStats(stats);
    } catch (err) {
      console.error("Failed to load faculty stats:", err);
      if (!silent) setStatsError("Could not load your faculty stats. Please refresh.");
    }
  }, []);

  const refreshStats = useCallback(
    async (silent = true) => {
      const studentId = await resolveStudentId();
      if (!studentId) return;

      if (isStudentRole(profile.role)) {
        await loadStudentStats(studentId, profile.role, silent);
      } else if (isFacultyRole(profile.role)) {
        await loadFacultyStats(profile.school_id, profile.role, silent);
      }
    },
    [loadFacultyStats, loadStudentStats, profile.role, profile.school_id]
  );

  const loadProfile = useCallback(async (silent = false) => {
    const studentId = await resolveStudentId();
    if (!studentId) {
      setLoadError("Could not find your session. Please log out and log in again.");
      if (!silent) setProfileLoading(false);
      return;
    }

    const { profile: loadedProfile, error } = await loadProfileForUser(supabase);
    const {
      data: { user: currentAuthUser },
    } = await supabase.auth.getUser();

    if (currentAuthUser) {
      setAuthUser(currentAuthUser);
    }

    if (error || !loadedProfile) {
      console.error("Failed to fetch user:", error);
      setLoadError(
        error?.message ||
          "Could not load your profile. Run database/users_signup_policies.sql in Supabase, then log in again."
      );
      if (!silent) setProfileLoading(false);
      return;
    }

    setLoadError("");
    setProfile(loadedProfile);
    setEditProfile(loadedProfile);
    if (isStudentRole(loadedProfile.role)) {
      await loadStudentStats(studentId, loadedProfile.role, silent);
    } else if (isFacultyRole(loadedProfile.role)) {
      await loadFacultyStats(loadedProfile.school_id, loadedProfile.role, silent);
    }

    if (!silent) setProfileLoading(false);
  }, [loadFacultyStats, loadStudentStats]);

  useEffect(() => {
    loadProfile(false);
  }, [loadProfile]);

  useEffect(() => {
    if (profileLoading) return undefined;

    refreshStats(true);
    const timer = setInterval(() => refreshStats(true), 5000);
    return () => clearInterval(timer);
  }, [profileLoading, refreshStats]);

  useEffect(() => {
    if (!editing) {
      setEditProfile(profile);
    }
  }, [editing, profile]);

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const studentId = (await resolveStudentId()) || user.id;
    const fileName = `${studentId || Date.now()}_${file.name}`;

    try {
      setAvatarUploading(true);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("UPLOAD ERROR:", uploadError);
        showError(`Upload failed:\n${uploadError.message}`, "Upload failed");
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const nextAvatarUrl = data.publicUrl;

      setEditProfile((prev) => ({
        ...prev,
        avatar_url: nextAvatarUrl,
      }));

      const saved = await updateUserAvatar(nextAvatarUrl);

      setProfile(saved);
      setEditProfile(saved);
      localStorage.setItem(
        "examnexus_user",
        JSON.stringify({ ...user, ...saved })
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to save avatar:", err);
      showError(err.message || "Failed to save avatar to profile.");
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  };

  const handleLogout = async () => {
    const confirmed = await showConfirm({
      title: "Log out",
      message: "Are you sure you want to log out of your account?",
      confirmLabel: "Log out",
      cancelLabel: "Cancel",
      tone: "warning",
    });
    if (!confirmed) return;

    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore sign-out network errors; still clear the local session below.
    }
    localStorage.removeItem("examnexus_user");
    navigate("/auth", { replace: true });
  };

  const handleSave = async (updatedProfile) => {
    try {
      setSaveStatus("saving");

      const studentId = (await resolveStudentId()) || user.id;
      const saved = await updateUserProfile(studentId, updatedProfile);

      const mergedProfile = {
        ...profile,
        ...saved,
        email: saved.email || profile.email,
        school_id:
          resolveSchoolId(authUser, profile) ||
          saved.school_id ||
          profile.school_id,
      };

      setProfile(mergedProfile);
      setEditProfile(mergedProfile);
      setEditing(false);
      setSaveSuccess(true);
      setSaveStatus("saved");

      localStorage.setItem(
        "examnexus_user",
        JSON.stringify({ ...user, ...mergedProfile })
      );

      setTimeout(() => {
        setSaveSuccess(false);
        setSaveStatus("idle");
      }, 3000);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setSaveStatus("error");
      showError(err.message || "Error saving profile. Please try again.");
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    const { current, new: newPassword, confirm } = passwordForm;

    if (!current || !newPassword || !confirm) {
      setPasswordStatus("error");
      setPasswordMessage("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirm) {
      setPasswordStatus("error");
      setPasswordMessage("New password and confirmation do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus("error");
      setPasswordMessage("New password must be at least 6 characters.");
      return;
    }

    if (newPassword === current) {
      setPasswordStatus("error");
      setPasswordMessage("New password must be different from your current password.");
      return;
    }

    const email = profile.email || authUser?.email;
    if (!email) {
      setPasswordStatus("error");
      setPasswordMessage("Could not find your account email. Please log in again.");
      return;
    }

    try {
      setPasswordStatus("saving");
      setPasswordMessage("");

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });

      if (verifyError) {
        setPasswordStatus("error");
        setPasswordMessage("Current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordStatus("error");
        setPasswordMessage(updateError.message || "Failed to update password.");
        return;
      }

      setPasswordForm({ current: "", new: "", confirm: "" });
      setPasswordStatus("success");
      setPasswordMessage("Password updated successfully.");
      setTimeout(() => {
        setPasswordStatus("idle");
        setPasswordMessage("");
      }, 4000);
    } catch (err) {
      console.error("Failed to change password:", err);
      setPasswordStatus("error");
      setPasswordMessage(err.message || "Failed to update password.");
    }
  };

  const memberSince = authUser?.created_at
    ? new Date(authUser.created_at).toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const roleLabel = isStudent ? "Student" : isFaculty ? "Faculty" : profile.role || "User";

  if (profileLoading) {
    return <PageLoadingSkeleton theme={theme} variant="profile" />;
  }

  return (
    <div
      className={`min-h-screen w-full max-w-full min-w-0 overflow-x-hidden p-4 sm:p-6 ${
        theme === "dark" ? "text-white" : "en-bg-page text-gray-900"
      }`}
    >
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                theme === "dark"
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                  : "en-bg-elevated text-teal-700 border border-emerald-200 shadow-sm"
              }`}
            >
              {isStudent ? <GraduationCap size={14} /> : <UserRound size={14} />}
              {roleLabel}
            </span>
            {memberSince && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs ${
                  theme === "dark" ? "text-gray-500" : "text-gray-500"
                }`}
              >
                <Calendar size={13} />
                Member since {memberSince}
              </span>
            )}
          </div>
          <h1
            className={`mt-3 text-3xl font-bold sm:text-4xl ${
              theme === "dark" ? "text-white" : "text-slate-900"
            }`}
          >
            Welcome back, {profile.first_name || "there"}
          </h1>
          <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            Manage your account details, security, and academic information.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={() => {
                setEditProfile(profile);
                setEditing(true);
              }}
              className={`flex items-center gap-2 ${primaryButton(theme)}`}
            >
              <Pencil size={16} />
              Edit Profile
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditProfile(profile);
                setEditing(false);
              }}
              className={dangerButton(theme)}
            >
              Cancel Editing
            </button>
          )}

          {mobileNav && (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                theme === "dark"
                  ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                  : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              }`}
            >
              <LogOut size={16} />
              Log out
            </button>
          )}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 overflow-x-hidden xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className={`${cardClass(theme)} min-w-0 max-w-full overflow-hidden p-5 sm:p-7`}>
          <div className="mb-8 flex min-w-0 flex-col gap-6 overflow-hidden border-b pb-8 sm:flex-row sm:items-center sm:justify-between border-inherit">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <ProfileAvatar
                src={editProfile.avatar_url}
                alt={`${editProfile.first_name} ${editProfile.last_name}`}
                size="lg"
                className="shrink-0 shadow-lg ring-4 ring-emerald-500/10"
                clickable={hasCustomProfilePhoto(editProfile.avatar_url)}
                onClick={() => setAvatarPreviewOpen(true)}
              />

              <AvatarLightbox
                src={editProfile.avatar_url}
                alt={`${editProfile.first_name} ${editProfile.last_name}`}
                open={avatarPreviewOpen}
                onClose={() => setAvatarPreviewOpen(false)}
              />

              <div className="min-w-0 overflow-hidden">
                <h2
                  className={`truncate text-xl font-bold sm:text-2xl ${
                    theme === "dark" ? "text-white" : "text-slate-900"
                  }`}
                >
                  {profile.first_name} {profile.last_name}
                </h2>
                <p className={`mt-1 truncate text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  {profile.email}
                </p>
                {displaySchoolId && (
                  <p className={`mt-1 truncate text-xs font-medium ${theme === "dark" ? "text-emerald-400/80" : "text-teal-700"}`}>
                    ID · {displaySchoolId}
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                id="avatar-upload"
                disabled={avatarUploading}
              />
              <label
                htmlFor="avatar-upload"
                className={`cursor-pointer ${secondaryButton(theme, "inline-block px-4 py-2 text-sm")} ${avatarUploading ? "pointer-events-none opacity-60" : ""}`}
              >
                {avatarUploading ? "Uploading..." : "Change photo"}
              </label>
              {hasCustomProfilePhoto(editProfile.avatar_url) && (
                <p className={`mt-2 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                  Click photo to preview
                </p>
              )}
            </div>
          </div>

          {statsError && (
            <div
              className={`mb-5 rounded-xl px-4 py-3 text-sm ${
                theme === "dark"
                  ? "border border-red-500/30 bg-red-500/10 text-red-400"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {statsError}
            </div>
          )}

          {isStudent ? (
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              <StatCard
                value={studentStats.enrolledSubjects}
                label="Enrolled subjects"
                theme={theme}
                variant="emerald"
              />
              <StatCard
                value={studentStats.completedAssessments}
                label="Completed assessments"
                theme={theme}
                variant="cyan"
              />
              <StatCard
                value={studentStats.upcomingAssessments}
                label="Upcoming assessments"
                theme={theme}
                variant="amber"
              />
            </div>
          ) : (
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              <StatCard
                value={facultyStats.totalSubjects}
                label="Total subjects"
                theme={theme}
                variant="emerald"
              />
              <StatCard
                value={facultyStats.totalAssessments}
                label="Total assessments"
                theme={theme}
                variant="cyan"
              />
              <StatCard
                value={facultyStats.totalStudents}
                label="Total students"
                theme={theme}
                variant="purple"
              />
            </div>
          )}

          <div className="mb-2 flex items-center justify-between gap-3">
            <h3
              className={`text-lg font-semibold ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              Personal information
            </h3>
            {editing && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  theme === "dark"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                Editing
              </span>
            )}
          </div>

          {loadError && (
            <div
              className={`mb-5 rounded-xl px-4 py-3 text-sm ${
                theme === "dark"
                  ? "border border-red-500/30 bg-red-500/10 text-red-400"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {loadError}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <SectionTitle theme={theme}>Basic details</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel theme={theme} htmlFor="first_name">
                    First name
                  </FieldLabel>
                  <input
                    id="first_name"
                    type="text"
                    value={editProfile.first_name}
                    onChange={(e) =>
                      setEditProfile({ ...editProfile, first_name: e.target.value })
                    }
                    disabled={!editing}
                    placeholder="First name"
                    className={inputStyle(theme)}
                  />
                </div>
                <div>
                  <FieldLabel theme={theme} htmlFor="last_name">
                    Last name
                  </FieldLabel>
                  <input
                    id="last_name"
                    type="text"
                    value={editProfile.last_name}
                    onChange={(e) =>
                      setEditProfile({ ...editProfile, last_name: e.target.value })
                    }
                    disabled={!editing}
                    placeholder="Last name"
                    className={inputStyle(theme)}
                  />
                </div>
                <div>
                  <FieldLabel theme={theme} htmlFor="gender">
                    Gender
                  </FieldLabel>
                  <ProfileSelect
                    id="gender"
                    value={editProfile.gender}
                    disabled={!editing}
                    onChange={(e) =>
                      setEditProfile({ ...editProfile, gender: e.target.value })
                    }
                    theme={theme}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </ProfileSelect>
                </div>
                <div>
                  <FieldLabel theme={theme} htmlFor="age" hint="Optional">
                    Age
                  </FieldLabel>
                  <input
                    id="age"
                    type="text"
                    inputMode="numeric"
                    value={editProfile.age || ""}
                    disabled={!editing}
                    onChange={(e) =>
                      setEditProfile({
                        ...editProfile,
                        age: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    placeholder="Age"
                    className={`${inputStyle(theme)} [appearance:textfield]`}
                  />
                </div>
              </div>
            </div>

            <div>
              <SectionTitle theme={theme}>Account</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel theme={theme} htmlFor="email" hint="Read-only">
                    Email
                  </FieldLabel>
                  <input
                    id="email"
                    type="text"
                    value={editProfile.email || ""}
                    disabled
                    readOnly
                    placeholder="Email"
                    className={inputStyle(theme)}
                  />
                </div>
                <div>
                  <FieldLabel theme={theme} htmlFor="school_id" hint="Read-only">
                    School ID
                  </FieldLabel>
                  <input
                    id="school_id"
                    type="text"
                    value={displaySchoolId}
                    disabled
                    readOnly
                    placeholder={displaySchoolId ? "School ID" : "Not set"}
                    className={inputStyle(theme)}
                  />
                </div>
              </div>
            </div>

            <div>
              <SectionTitle theme={theme}>
                {isStudent ? "School & program" : "School affiliation"}
              </SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={isStudent ? "" : "sm:col-span-2"}>
                  <FieldLabel theme={theme} htmlFor="department">
                    Department / college
                  </FieldLabel>
                  <ProfileSelect
                    id="department"
                    value={editProfile.department}
                    disabled={!editing}
                    onChange={(e) =>
                      setEditProfile({
                        ...editProfile,
                        department: e.target.value,
                        course: "",
                      })
                    }
                    theme={theme}
                  >
                    <option value="">Select department</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept.value} value={dept.value}>
                        {dept.label}
                      </option>
                    ))}
                  </ProfileSelect>
                </div>

                {isStudent && (
                  <>
                    <div>
                      <FieldLabel theme={theme} htmlFor="course">
                        Course
                      </FieldLabel>
                      <ProfileSelect
                        id="course"
                        value={editProfile.course}
                        disabled={!editing || !editProfile.department}
                        onChange={(e) =>
                          setEditProfile({ ...editProfile, course: e.target.value })
                        }
                        theme={theme}
                      >
                        <option value="">
                          {editProfile.department
                            ? "Select course"
                            : "Select department first"}
                        </option>
                        {courses.map((course) => (
                          <option key={course.value} value={course.value}>
                            {course.label}
                          </option>
                        ))}
                      </ProfileSelect>
                    </div>
                    <div>
                      <FieldLabel theme={theme} htmlFor="year_level">
                        Year level
                      </FieldLabel>
                      <ProfileSelect
                        id="year_level"
                        value={
                          editProfile.year_level
                            ? normalizeYearLevel(editProfile.year_level)
                            : ""
                        }
                        disabled={!editing}
                        onChange={(e) =>
                          setEditProfile({ ...editProfile, year_level: e.target.value })
                        }
                        theme={theme}
                      >
                        <option value="">Select year level</option>
                        {YEAR_LEVELS.map((level) => (
                          <option key={level.value} value={level.value}>
                            {level.label}
                          </option>
                        ))}
                      </ProfileSelect>
                    </div>
                  </>
                )}
              </div>

              {!editing && (profile.department || profile.course || profile.year_level) && (
                <div
                  className={`mt-4 flex flex-wrap gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                    theme === "dark"
                      ? "border-white/10 bg-white/[0.03] text-gray-400"
                      : "border-emerald-100 en-bg-elevated/70 text-gray-600"
                  }`}
                >
                  {profile.department && (
                    <span>
                      <strong className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
                        Dept:
                      </strong>{" "}
                      {getDepartmentLabel(profile.department)}
                    </span>
                  )}
                  {isStudent && profile.course && (
                    <span>
                      <strong className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
                        Course:
                      </strong>{" "}
                      {getCourseLabel(profile.department, profile.course)}
                    </span>
                  )}
                  {isStudent && profile.year_level && (
                    <span>
                      <strong className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
                        Year:
                      </strong>{" "}
                      {getYearLevelLabel(profile.year_level)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {saveSuccess && (
            <div
              className={`mt-6 rounded-xl border px-4 py-3 text-sm font-medium ${
                theme === "dark"
                  ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                  : "border-emerald-300 en-bg-skeleton text-emerald-700"
              }`}
            >
              Successfully saved to Supabase
            </div>
          )}
          {saveStatus === "saving" && (
            <p className={`mt-6 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Saving...
            </p>
          )}
          {saveStatus === "error" && (
            <div
              className={`mt-6 rounded-xl border px-4 py-3 text-sm font-medium ${
                theme === "dark"
                  ? "border-red-500/30 bg-red-500/20 text-red-400"
                  : "border-red-300 bg-red-100 text-red-700"
              }`}
            >
              Failed to save. Check your connection and try again.
            </div>
          )}

          {editing && (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => handleSave(editProfile)}
                className={primaryButton(theme)}
              >
                Save changes
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6">
          <div className={cardClass(theme)}>
            <form onSubmit={handleChangePassword}>
              <div className="mb-4 flex items-center gap-2">
                <Lock
                  size={18}
                  className={theme === "dark" ? "text-emerald-400" : "text-teal-700"}
                />
                <h3
                  className={`text-base font-semibold ${
                    theme === "dark" ? "text-emerald-400" : "text-teal-700"
                  }`}
                >
                  Change password
                </h3>
              </div>

              <div className="space-y-3">
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, current: e.target.value })
                  }
                  placeholder="Current password"
                  autoComplete="current-password"
                  className={inputStyle(theme)}
                />
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, new: e.target.value })
                  }
                  placeholder="New password"
                  autoComplete="new-password"
                  className={inputStyle(theme)}
                />
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirm: e.target.value })
                  }
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className={inputStyle(theme)}
                />
              </div>

              {passwordMessage && (
                <p
                  className={`mt-3 text-sm ${
                    passwordStatus === "success"
                      ? theme === "dark"
                        ? "text-emerald-400"
                        : "text-emerald-700"
                      : theme === "dark"
                        ? "text-red-400"
                        : "text-red-600"
                  }`}
                >
                  {passwordMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={passwordStatus === "saving"}
                className={`mt-4 w-full ${primaryButton(theme, "px-4 py-2.5 text-sm")}`}
              >
                {passwordStatus === "saving" ? "Updating..." : "Update password"}
              </button>
            </form>
          </div>

          <div className={cardClass(theme)}>
            <div className="mb-4 flex items-center gap-2">
              <BadgeCheck
                size={18}
                className={theme === "dark" ? "text-emerald-400" : "text-teal-700"}
              />
              <h3
                className={`text-base font-semibold ${
                  theme === "dark" ? "text-emerald-400" : "text-teal-700"
                }`}
              >
                Account overview
              </h3>
            </div>

            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className={theme === "dark" ? "text-gray-500" : "text-gray-500"}>Role</dt>
                <dd className={`font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                  {roleLabel}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className={theme === "dark" ? "text-gray-500" : "text-gray-500"}>Email</dt>
                <dd className={`truncate text-right font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                  {profile.email || "—"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className={theme === "dark" ? "text-gray-500" : "text-gray-500"}>School ID</dt>
                <dd className={`font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                  {displaySchoolId || "—"}
                </dd>
              </div>
              {profile.department && (
                <div className="flex items-start justify-between gap-3">
                  <dt className={theme === "dark" ? "text-gray-500" : "text-gray-500"}>Department</dt>
                  <dd className={`text-right font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                    {getDepartmentLabel(profile.department)}
                  </dd>
                </div>
              )}
              {memberSince && (
                <div className="flex items-start justify-between gap-3">
                  <dt className={theme === "dark" ? "text-gray-500" : "text-gray-500"}>Joined</dt>
                  <dd className={`font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                    {memberSince}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className={cardClass(theme)}>
            <div className="mb-4 flex items-center gap-2">
              <Compass
                size={18}
                className={theme === "dark" ? "text-emerald-400" : "text-teal-700"}
              />
              <h3
                className={`text-base font-semibold ${
                  theme === "dark" ? "text-emerald-400" : "text-teal-700"
                }`}
              >
                Quick links
              </h3>
            </div>

            <div className="space-y-2">
              {isAdmin ? (
                <>
                  <QuickLink
                    icon={Shield}
                    label="Admin dashboard"
                    onClick={() => navigate("/admin/dashboard")}
                    theme={theme}
                  />
                  <QuickLink
                    icon={Users}
                    label="Manage accounts"
                    onClick={() => navigate("/admin/accounts")}
                    theme={theme}
                  />
                </>
              ) : isStudent ? (
                <>
                  <QuickLink
                    icon={BookOpen}
                    label="My subjects"
                    onClick={() => navigate("/student/subjects")}
                    theme={theme}
                  />
                  <QuickLink
                    icon={ClipboardList}
                    label="My assessments"
                    onClick={() => navigate("/student/assessments")}
                    theme={theme}
                  />
                </>
              ) : (
                <>
                  <QuickLink
                    icon={BookOpen}
                    label="My subjects"
                    onClick={() => navigate("/faculty/dashboard")}
                    theme={theme}
                  />
                  <QuickLink
                    icon={Megaphone}
                    label="Announcements"
                    onClick={() => navigate("/faculty/announcements")}
                    theme={theme}
                  />
                </>
              )}
            </div>
          </div>

          <div className={cardClass(theme)}>
            <div className="mb-3 flex items-center gap-2">
              <Shield
                size={18}
                className={theme === "dark" ? "text-emerald-400" : "text-teal-700"}
              />
              <h3
                className={`text-base font-semibold ${
                  theme === "dark" ? "text-emerald-400" : "text-teal-700"
                }`}
              >
                Security tips
              </h3>
            </div>
            <ul
              className={`space-y-2.5 text-sm leading-relaxed ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              <li className="flex gap-2">
                <Mail size={14} className="mt-0.5 shrink-0 opacity-70" />
                Use a unique password you do not reuse on other sites.
              </li>
              <li className="flex gap-2">
                <Lock size={14} className="mt-0.5 shrink-0 opacity-70" />
                Update your password if you signed in on a shared device.
              </li>
              <li className="flex gap-2">
                <BadgeCheck size={14} className="mt-0.5 shrink-0 opacity-70" />
                Keep your profile details accurate for class enrollment.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
