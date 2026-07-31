import { useEffect, useState } from "react";
import { AlertTriangle, LogOut, Save } from "lucide-react";
import { supabase } from "../supabaseClient";
import {
  getSchoolIdHelpText,
  getSchoolIdRule,
  isLegacyFacultySchoolId,
  normalizeRole,
  normalizeSchoolId,
  profileNeedsSchoolIdGate,
  validateSchoolIdForRole,
} from "../utils/schoolIdRules";
import ModalPortal from "./ui/ModalPortal";
import { useScrollIntoViewWhen } from "../hooks/useScrollIntoViewWhen";

function inputClass(theme) {
  return `w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-400 ${
    theme === "dark"
      ? "border-white/10 bg-white/10 text-white placeholder:text-gray-500"
      : "border-emerald-200 bg-white text-gray-900 placeholder:text-gray-400"
  }`;
}

async function remapFacultySubjects(oldSchoolId, newSchoolId) {
  const from = normalizeSchoolId(oldSchoolId);
  const to = normalizeSchoolId(newSchoolId);
  if (!from || !to || from === to) return;

  const { error } = await supabase
    .from("subjects")
    .update({ teacher_school_id: to })
    .eq("teacher_school_id", from);

  if (error) {
    console.warn("Could not remap faculty subjects:", error.message);
  }
}

export default function RequiredSchoolIdGate({ theme, onResolved }) {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("examnexus_user") || "{}")
  );
  const [required, setRequired] = useState(false);
  const [checking, setChecking] = useState(true);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const errorRef = useScrollIntoViewWhen(Boolean(error), { deps: [error] });

  useEffect(() => {
    let cancelled = false;

    const evaluate = async () => {
      const cached = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
      if (!cached?.id) {
        if (!cancelled) {
          setUser(cached);
          setRequired(false);
          setChecking(false);
        }
        return;
      }

      let profile = cached;
      try {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", cached.id)
          .maybeSingle();
        if (data) {
          profile = { ...cached, ...data };
          localStorage.setItem("examnexus_user", JSON.stringify(profile));
        }
      } catch {
        // Fall back to cached profile if the refresh fails.
      }

      if (cancelled) return;

      setUser(profile);

      // Faculty with a valid 5-digit ID skips this gate entirely.
      // Only legacy 3-digit (or missing/invalid) faculty IDs are prompted.
      if (!profileNeedsSchoolIdGate(profile)) {
        setRequired(false);
        setChecking(false);
        onResolved?.(profile);
        return;
      }

      setValue("");
      setRequired(true);
      setChecking(false);
    };

    evaluate();
    return () => {
      cancelled = true;
    };
  }, [onResolved]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("examnexus_user");
    window.location.assign("/auth");
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const validation = validateSchoolIdForRole(value, user.role);

    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    const role = normalizeRole(user.role);
    const oldSchoolId = normalizeSchoolId(user.school_id);

    // Faculty must not "save" the same 5-digit ID through a mistaken prompt.
    if (role === "faculty" && oldSchoolId === validation.normalized && oldSchoolId.length === 5) {
      setRequired(false);
      onResolved?.(user);
      return;
    }

    try {
      setSaving(true);
      setError("");

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser?.id || authUser.id !== user.id) {
        await handleLogout();
        return;
      }

      let savedProfile = null;

      // Preferred path: RPC updates school_id and remaps subjects.teacher_school_id.
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "update_own_school_id",
        { p_school_id: validation.normalized }
      );

      if (!rpcError && rpcData) {
        savedProfile = rpcData;
      } else if (role === "faculty" && oldSchoolId && oldSchoolId !== validation.normalized) {
        // Faculty ID changes must remap subjects or ownership breaks.
        // Do not silently change school_id without remapping.
        throw new Error(
          rpcError?.message ||
            "Could not update your School ID while keeping your subjects linked. Ask an admin to run the update_own_school_id database fix, then try again."
        );
      } else {
        const { data, error: updateError } = await supabase
          .from("users")
          .update({ school_id: validation.normalized })
          .eq("id", authUser.id)
          .select("*")
          .single();

        if (updateError) {
          const { data: signupData, error: signupError } = await supabase.rpc(
            "upsert_signup_profile",
            {
              p_first_name:
                user.first_name || authUser.user_metadata?.first_name || "User",
              p_last_name: user.last_name || authUser.user_metadata?.last_name || "",
              p_email: user.email || authUser.email,
              p_school_id: validation.normalized,
              p_role: user.role || authUser.user_metadata?.role || "Student",
              p_gender: user.gender || null,
              p_department: user.department || null,
              p_course: user.course || null,
              p_year_level: user.year_level || null,
              p_age: user.age === "" || user.age == null ? null : String(user.age),
              p_avatar_url: user.avatar_url || null,
            }
          );

          if (signupError) {
            throw rpcError || updateError;
          }

          savedProfile = signupData;
        } else {
          savedProfile = data;
        }

        if (role === "faculty" && oldSchoolId && oldSchoolId !== validation.normalized) {
          await remapFacultySubjects(oldSchoolId, validation.normalized);
        }
      }

      await supabase.auth
        .updateUser({
          data: {
            school_id: validation.normalized,
            schoolId: validation.normalized,
          },
        })
        .catch(() => {});

      const { data: confirmedProfile, error: confirmError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (confirmError) {
        throw confirmError;
      }

      const confirmedSchoolId = normalizeSchoolId(confirmedProfile?.school_id);
      if (confirmedSchoolId !== validation.normalized) {
        throw new Error("School ID was not saved in Supabase. Please try again.");
      }

      const nextUser = {
        ...user,
        ...(savedProfile || {}),
        ...(confirmedProfile || {}),
        school_id: confirmedSchoolId,
      };

      localStorage.setItem("examnexus_user", JSON.stringify(nextUser));
      setUser(nextUser);
      setRequired(false);
      onResolved?.(nextUser);
    } catch (err) {
      setError(
        err?.message ||
          "Could not save your School ID. Check that it is not already registered."
      );
    } finally {
      setSaving(false);
    }
  };

  if (checking || !required) return null;

  const rule = getSchoolIdRule(user.role);
  const role = normalizeRole(user.role);
  const roleLabel = role || "student";
  const existingId = normalizeSchoolId(user.school_id);
  const isFacultyLegacyUpgrade =
    role === "faculty" && isLegacyFacultySchoolId(existingId);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
        <form
          onSubmit={handleSave}
          className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${
            theme === "dark"
              ? "border-white/10 bg-[#071412] text-white"
              : "border-emerald-200 bg-white text-emerald-950"
          }`}
        >
          <div
            className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
              theme === "dark"
                ? "bg-amber-500/10 text-amber-300"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            <AlertTriangle size={24} />
          </div>

          <h2 className="text-xl font-bold">
            {isFacultyLegacyUpgrade ? "Update your School ID" : "School ID required"}
          </h2>
          <p
            className={`mt-2 text-sm ${
              theme === "dark" ? "text-gray-300" : "text-gray-600"
            }`}
          >
            {isFacultyLegacyUpgrade
              ? "Your account still has a 3-digit School ID. Enter your full 5-digit faculty ID to continue. Your subjects will stay linked to your account. If you skip this, you will be logged out."
              : role === "faculty"
                ? "Faculty School IDs must be exactly 5 digits. Enter your 5-digit ID to continue. Your subjects will stay linked to your account. If you skip this, you will be logged out."
                : `Existing ${roleLabel} accounts must enter a valid School ID before continuing. If you do not complete this prompt, you will be logged out.`}
          </p>

          {existingId ? (
            <p
              className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                theme === "dark"
                  ? "border-white/10 bg-white/5 text-gray-300"
                  : "border-emerald-100 bg-emerald-50/70 text-gray-600"
              }`}
            >
              Current ID on file: <span className="font-semibold">{existingId}</span>
              {isFacultyLegacyUpgrade ? " (must be upgraded to 5 digits)" : ""}
            </p>
          ) : null}

          <label className="mt-5 block text-sm font-semibold" htmlFor="required-school-id">
            School ID
          </label>
          <input
            id="required-school-id"
            value={value}
            inputMode="numeric"
            maxLength={rule.max}
            onChange={(event) => {
              setValue(normalizeSchoolId(event.target.value).slice(0, rule.max));
              setError("");
            }}
            placeholder={rule.example}
            className={`mt-2 ${inputClass(theme)}`}
            autoFocus
          />
          <p
            className={`mt-2 text-xs ${
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {getSchoolIdHelpText(user.role)}
          </p>

          {error && (
            <p ref={errorRef} role="status" className="mt-3 text-sm text-red-500">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-[#031d1f] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {saving
                ? "Saving..."
                : isFacultyLegacyUpgrade
                  ? "Update School ID"
                  : "Save School ID"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                theme === "dark"
                  ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
                  : "border-red-200 text-red-600 hover:bg-red-50"
              }`}
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
