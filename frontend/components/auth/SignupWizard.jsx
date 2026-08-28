import { Check, Copy, Eye, EyeOff } from "lucide-react";
import AuthRoleToggle from "./AuthRoleToggle";
import AuthNativeSelect from "./AuthNativeSelect";
import ProgressButton from "../ui/ProgressButton";
import { primaryButtonFull } from "../../utils/themeButtons";
import { DEPARTMENTS, getCoursesForDepartment } from "../../utils/academicOptions";
import { YEAR_LEVELS } from "../../utils/yearLevels";
import { authEmailError, CRMCC_EMAIL_PLACEHOLDER } from "../../utils/schoolEmail";
import {
  getSchoolIdHelpText,
  getSchoolIdRule,
  validateSchoolIdForRole,
} from "../../utils/schoolIdRules";
import { FieldError, FieldLabel } from "./signupFormShared";

const STEP_TITLES = ["Account & profile", "School & program", "Login credentials"];

export function validateSignupStep(step, form) {
  const errs = {};

  if (step === 1) {
    if (!form.firstName?.trim()) errs.firstName = "First name is required";
    if (!form.lastName?.trim()) errs.lastName = "Last name is required";
  }

  if (step === 2) {
    const schoolIdCheck = validateSchoolIdForRole(form.schoolId, form.role);
    if (!schoolIdCheck.valid) errs.schoolId = schoolIdCheck.message;
  }

  if (step === 3) {
    const emailError = authEmailError(form.email, { schoolFormatRequired: true });
    if (emailError) errs.email = emailError;
    if (!form.password) errs.password = "Password is required";
  }

  return errs;
}

function MobileStepBar({ step, theme }) {
  const isDark = theme === "dark";

  return (
    <div className="mb-5 md:hidden">
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n) => {
          const done = step > n;
          const active = step === n;
          return (
            <div key={n} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? isDark
                      ? "bg-emerald-500 text-white"
                      : "bg-teal-600 text-white"
                    : done
                      ? isDark
                        ? "bg-emerald-500/25 text-emerald-300"
                        : "bg-emerald-100 text-teal-800"
                      : isDark
                        ? "bg-white/5 text-gray-500"
                        : "bg-emerald-50 text-gray-500"
                }`}
              >
                {done ? <Check size={14} strokeWidth={2.5} /> : n}
              </span>
              {n < 3 ? (
                <span
                  className={`h-0.5 flex-1 rounded-full ${
                    step > n
                      ? isDark
                        ? "bg-emerald-500/50"
                        : "bg-teal-400"
                      : isDark
                        ? "bg-white/10"
                        : "bg-emerald-100"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p
        className={`mt-2 text-xs font-medium ${
          isDark ? "text-gray-400" : "text-gray-600"
        }`}
      >
        Step {step} of 3 — {STEP_TITLES[step - 1]}
      </p>
    </div>
  );
}

export default function SignupWizard({
  form,
  errors,
  theme,
  authInputProps,
  onFieldChange,
  onRoleChange,
  step,
  onStepChange,
  setErrors,
  showPassword,
  setShowPassword,
  emailCopied,
  onCopyEmail,
  loading,
}) {
  const isStudent = form.role === "Student";
  const courses = getCoursesForDepartment(form.department);
  const schoolIdRule = getSchoolIdRule(form.role);
  const isDark = theme === "dark";

  const goNext = () => {
    const stepErrors = validateSignupStep(step, form);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    onStepChange(step + 1);
  };

  const goBack = () => {
    setErrors({});
    onStepChange(step - 1);
  };

  return (
    <div className="en-signup-wizard">
      <MobileStepBar step={step} theme={theme} />

      {step === 1 ? (
        <div className="space-y-4">
          <AuthRoleToggle
            value={form.role}
            onChange={onRoleChange}
            theme={theme}
            layout="stack"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel theme={theme} htmlFor="firstName">
                First name
              </FieldLabel>
              <input
                id="firstName"
                type="text"
                name="firstName"
                value={form.firstName}
                onChange={onFieldChange}
                autoComplete="given-name"
                placeholder="Juan"
                {...authInputProps}
              />
              <FieldError message={errors.firstName} />
            </div>
            <div>
              <FieldLabel theme={theme} htmlFor="lastName">
                Last name
              </FieldLabel>
              <input
                id="lastName"
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={onFieldChange}
                autoComplete="family-name"
                placeholder="Dela Cruz"
                {...authInputProps}
              />
              <FieldError message={errors.lastName} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel theme={theme} htmlFor="gender">
                Gender
              </FieldLabel>
              <AuthNativeSelect
                id="gender"
                name="gender"
                value={form.gender}
                onChange={onFieldChange}
                theme={theme}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </AuthNativeSelect>
            </div>
            <div>
              <FieldLabel theme={theme} htmlFor="age">
                Age <span className="font-normal opacity-60">(optional)</span>
              </FieldLabel>
              <input
                id="age"
                type="number"
                name="age"
                min={1}
                max={120}
                value={form.age}
                onChange={onFieldChange}
                placeholder="18"
                autoComplete="off"
                {...authInputProps}
              />
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <div>
            <FieldLabel theme={theme} htmlFor="schoolId">
              School ID
            </FieldLabel>
            <input
              id="schoolId"
              type="text"
              name="schoolId"
              value={form.schoolId}
              onChange={onFieldChange}
              placeholder={schoolIdRule.example}
              autoComplete="off"
              inputMode="numeric"
              maxLength={schoolIdRule.max}
              {...authInputProps}
            />
            <p className={`mt-1 text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
              {getSchoolIdHelpText(form.role)}
            </p>
            <FieldError message={errors.schoolId} />
          </div>

          <div>
            <FieldLabel theme={theme} htmlFor="department">
              Department / College
            </FieldLabel>
            <AuthNativeSelect
              id="department"
              name="department"
              value={form.department}
              onChange={onFieldChange}
              theme={theme}
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </AuthNativeSelect>
          </div>

          {isStudent ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel theme={theme} htmlFor="course">
                  Course
                </FieldLabel>
                <AuthNativeSelect
                  id="course"
                  name="course"
                  value={form.course}
                  onChange={onFieldChange}
                  disabled={!form.department}
                  theme={theme}
                >
                  <option value="">
                    {form.department ? "Select course" : "Select department first"}
                  </option>
                  {courses.map((course) => (
                    <option key={course.value} value={course.value}>
                      {course.label}
                    </option>
                  ))}
                </AuthNativeSelect>
              </div>
              <div>
                <FieldLabel theme={theme} htmlFor="yearLevel">
                  Year level
                </FieldLabel>
                <AuthNativeSelect
                  id="yearLevel"
                  name="yearLevel"
                  value={form.yearLevel}
                  onChange={onFieldChange}
                  theme={theme}
                >
                  <option value="">Select year level</option>
                  {YEAR_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </AuthNativeSelect>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div>
            <FieldLabel theme={theme} htmlFor="signup-email">
              Email
            </FieldLabel>
            <div className="relative">
              <input
                id="signup-email"
                type="email"
                name="email"
                value={form.email}
                onChange={onFieldChange}
                autoComplete="email"
                placeholder={CRMCC_EMAIL_PLACEHOLDER}
                {...authInputProps}
                className={`${authInputProps.className} ${form.email ? "pr-12" : ""}`}
              />
              {form.email ? (
                <button
                  type="button"
                  onClick={onCopyEmail}
                  title={emailCopied ? "Copied!" : "Copy email"}
                  aria-label={emailCopied ? "Email copied" : "Copy email"}
                  className={`absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border transition ${
                    emailCopied
                      ? isDark
                        ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-300"
                        : "border-emerald-400 bg-emerald-50 text-emerald-700"
                      : isDark
                        ? "border-white/15 bg-white/5 text-emerald-400 hover:bg-white/10"
                        : "border-emerald-200 bg-white text-teal-700 hover:border-teal-400"
                  }`}
                >
                  {emailCopied ? (
                    <Check size={16} strokeWidth={2.5} />
                  ) : (
                    <Copy size={16} strokeWidth={2.25} />
                  )}
                </button>
              ) : null}
            </div>
            <p className={`mt-1.5 text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
              Auto-filled from your name — tap copy to paste elsewhere, or edit if needed.
            </p>
            <FieldError message={errors.email} />
          </div>

          <div>
            <FieldLabel theme={theme} htmlFor="signup-password">
              Password
            </FieldLabel>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={onFieldChange}
                autoComplete="new-password"
                placeholder="Create a password"
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
            <FieldError message={errors.password} />
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              isDark
                ? "border-white/15 text-gray-200 hover:bg-white/5"
                : "border-emerald-200 text-teal-800 hover:bg-emerald-50"
            }`}
          >
            Back
          </button>
        ) : null}

        {step < 3 ? (
          <button
            type="button"
            onClick={goNext}
            className={`${primaryButtonFull(theme)} ${step > 1 ? "flex-1" : "w-full"}`}
          >
            Continue
          </button>
        ) : (
          <ProgressButton
            type="submit"
            loading={loading}
            loadingLabel="Creating account..."
            className={`${primaryButtonFull(theme)} flex-1`}
          >
            Create account
          </ProgressButton>
        )}
      </div>
    </div>
  );
}
