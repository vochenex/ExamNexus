export const DEPARTMENTS = [
  {
    value: "CCS",
    label: "College of Computer Studies",
    shortLabel: "Computer Studies",
  },
  {
    value: "CCJE",
    label: "College of Criminal Justice Education",
    shortLabel: "Criminal Justice Education",
  },
  {
    value: "CBE",
    label: "College of Business Education",
    shortLabel: "Business Education",
  },
];

export const COURSES_BY_DEPARTMENT = {
  CCS: [
    {
      value: "BSIT",
      label: "Bachelor of Science in Information Technology (BSIT)",
    },
  ],
  CBE: [
    { value: "BSA", label: "Bachelor of Science in Accountancy (BSA)" },
    { value: "TM", label: "Tourism Management (TM)" },
    { value: "FM", label: "Financial Management (FM)" },
    { value: "HM", label: "Hospitality Management (HM)" },
  ],
  CCJE: [
    {
      value: "BSCRIM",
      label: "Bachelor of Science in Criminology (BSCRIM)",
    },
  ],
};

export function getCoursesForDepartment(department) {
  return COURSES_BY_DEPARTMENT[department] || [];
}

export function getDepartmentLabel(value) {
  return DEPARTMENTS.find((item) => item.value === value)?.label || value || "";
}

export function getCourseLabel(department, courseValue) {
  return (
    getCoursesForDepartment(department).find((item) => item.value === courseValue)
      ?.label ||
    courseValue ||
    ""
  );
}
