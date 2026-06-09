import { getDefaultWeights } from "./gradeComputation";

const DEFAULT_TOTAL_CLASSES = 16;

function storageKey(studentId) {
  return `examnexus_grade_settings_${studentId}`;
}

export function loadGradeSettings(studentId) {
  try {
    const raw = localStorage.getItem(storageKey(studentId));
    return raw ? JSON.parse(raw) : { bySubject: {} };
  } catch {
    return { bySubject: {} };
  }
}

export function saveGradeSettings(studentId, settings) {
  localStorage.setItem(storageKey(studentId), JSON.stringify(settings));
}

export function getSubjectGradeSettings(studentId, subjectId, subjectType = "major") {
  const settings = loadGradeSettings(studentId);
  const saved = settings.bySubject?.[subjectId];
  const defaults = getDefaultWeights(subjectType);

  return {
    examWeight: saved?.examWeight ?? defaults.exam,
    standingWeight: saved?.standingWeight ?? defaults.standing,
    attendanceWeight: 10,
    classesMissed: saved?.classesMissed ?? 0,
    totalClasses: saved?.totalClasses ?? DEFAULT_TOTAL_CLASSES,
  };
}

export function updateSubjectGradeSettings(studentId, subjectId, patch) {
  const settings = loadGradeSettings(studentId);
  const current = settings.bySubject?.[subjectId] || {};

  settings.bySubject = {
    ...settings.bySubject,
    [subjectId]: {
      ...current,
      ...patch,
    },
  };

  saveGradeSettings(studentId, settings);
  return settings.bySubject[subjectId];
}

export function setExamWeight(studentId, subjectId, examWeight) {
  const standingWeight = examWeight === 70 ? 20 : 30;
  return updateSubjectGradeSettings(studentId, subjectId, {
    examWeight,
    standingWeight,
  });
}

export function setStandingWeight(studentId, subjectId, standingWeight) {
  const examWeight = standingWeight === 20 ? 70 : 60;
  return updateSubjectGradeSettings(studentId, subjectId, {
    examWeight,
    standingWeight,
  });
}
