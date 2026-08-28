import { Check, Copy, Eye, EyeOff } from "lucide-react";
import AuthRoleToggle from "./AuthRoleToggle";
import AuthNativeSelect from "./AuthNativeSelect";
import ProgressButton from "../ui/ProgressButton";
import { primaryButtonFull } from "../../utils/themeButtons";
import { DEPARTMENTS, getCoursesForDepartment } from "../../utils/academicOptions";
import { YEAR_LEVELS } from "../../utils/yearLevels";
import { CRMCC_EMAIL_PLACEHOLDER } from "../../utils/schoolEmail";
import { getSchoolIdHelpText, getSchoolIdRule } from "../../utils/schoolIdRules";
import { FieldError, FieldLabel, SectionTitle } from "./signupFormShared";

export default function SignupWizard({
  form,
  errors,
  theme,
  authInputProps,
  onFieldChange,
  onRoleChange,
  showPassword,
  setShowPassword,
  emailCopied,
  onCopyEmail,
  loading,
}) {
  const isStudent = form.role === "Student";
  const courses = getCoursesForDepartment(form.department);
  const schoolIdRule = getSchoolIdRule(form.role);

  return (
    <div className="en-signup-form">
      <div className="en-signup-columns">
        <section className="en-signup-column">
          <SectionTitle theme={theme}>Account & profile</SectionTitle>

          <AuthRoleToggle
            value={form.role}
            onChange={onRoleChange}
            theme={theme}
            layout="stack"
            className="mb-4"
          />

          <div className="space-y-3">
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
        </section>

        <section className="en-signup-column">
          <SectionTitle theme={theme}>
            {isStudent ? "School & program" : "School affiliation"}
          </SectionTitle>

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
              <p className="en-signup-hint mt-1 text-xs">{getSchoolIdHelpText(form.role)}</p>
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
              <>
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
              </>
            ) : null}
          </div>
        </section>

        <section className="en-signup-column">
          <SectionTitle theme={theme}>Login credentials</SectionTitle>

          <div className="space-y-3">
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
                        ? "border-emerald-400/50 bg-emerald-500/25 text-emerald-300"
                        : "border-emerald-500/25 bg-black/30 text-emerald-400 hover:border-emerald-400/50 hover:bg-emerald-500/10"
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
              <p className="en-signup-hint mt-1.5 text-xs">
                Auto-filled from your name — edit if needed.
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400/60 transition-colors hover:text-emerald-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
              <FieldError message={errors.password} />
            </div>
          </div>
        </section>
      </div>

      <ProgressButton
        type="submit"
        loading={loading}
        loadingLabel="Creating account..."
        className={`${primaryButtonFull(theme)} en-signup-submit mt-6`}
      >
        Create account
      </ProgressButton>
    </div>
  );
}
