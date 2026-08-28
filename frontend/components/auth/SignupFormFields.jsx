import Select from "../ui/Select";
import { DEPARTMENTS, getCoursesForDepartment } from "../../utils/academicOptions";
import { getSchoolIdHelpText, getSchoolIdRule } from "../../utils/schoolIdRules";
import { YEAR_LEVELS } from "../../utils/yearLevels";

function SectionTitle({ children, theme }) {
  return (
    <p
      className={`mb-3 mt-1 text-xs font-semibold uppercase tracking-wider ${
        theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
      }`}
    >
      {children}
    </p>
  );
}

function FieldLabel({ children, theme, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`mb-1.5 block text-sm font-medium ${
        theme === "dark" ? "text-gray-300" : "text-gray-700"
      }`}
    >
      {children}
    </label>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

function AuthSelect({
  id,
  name,
  value,
  onChange,
  children,
  disabled = false,
}) {
  return (
    <Select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="examnexus-auth-input px-4 py-3"
    >
      {children}
    </Select>
  );
}

export default function SignupFormFields({
  form,
  errors,
  theme,
  authInputProps,
  onFieldChange,
}) {
  const isStudent = form.role === "Student";
  const courses = getCoursesForDepartment(form.department);
  const schoolIdRule = getSchoolIdRule(form.role);

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle theme={theme}>Personal details</SectionTitle>
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

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <FieldLabel theme={theme} htmlFor="gender">
              Gender
            </FieldLabel>
            <AuthSelect
              id="gender"
              name="gender"
              value={form.gender}
              onChange={onFieldChange}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </AuthSelect>
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

      <div>
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
            <p
              className={`mt-1 text-xs ${
                theme === "dark" ? "text-gray-500" : "text-gray-500"
              }`}
            >
              {getSchoolIdHelpText(form.role)}
            </p>
            <FieldError message={errors.schoolId} />
          </div>

          <div>
            <FieldLabel theme={theme} htmlFor="department">
              Department / College
            </FieldLabel>
            <AuthSelect
              id="department"
              name="department"
              value={form.department}
              onChange={onFieldChange}
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </AuthSelect>
          </div>

          {isStudent && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel theme={theme} htmlFor="course">
                  Course
                </FieldLabel>
                <AuthSelect
                  id="course"
                  name="course"
                  value={form.course}
                  onChange={onFieldChange}
                  disabled={!form.department}
                >
                  <option value="">
                    {form.department ? "Select course" : "Select department first"}
                  </option>
                  {courses.map((course) => (
                    <option key={course.value} value={course.value}>
                      {course.label}
                    </option>
                  ))}
                </AuthSelect>
              </div>
              <div>
                <FieldLabel theme={theme} htmlFor="yearLevel">
                  Year level
                </FieldLabel>
                <AuthSelect
                  id="yearLevel"
                  name="yearLevel"
                  value={form.yearLevel}
                  onChange={onFieldChange}
                >
                  <option value="">Select year level</option>
                  {YEAR_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </AuthSelect>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
