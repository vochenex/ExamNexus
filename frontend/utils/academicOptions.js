import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "../supabaseClient";

/**
 * Departments and courses come from the admin "Departments & courses" page (public.school_catalog).
 * These defaults are only used until the catalog loads, or when it can't be read at all.
 */
const DEFAULT_DEPARTMENTS = [
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

const DEFAULT_COURSES_BY_DEPARTMENT = {
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

const CATALOG_MAX_AGE_MS = 30_000;

let catalog = {
  departments: DEFAULT_DEPARTMENTS,
  coursesByDepartment: DEFAULT_COURSES_BY_DEPARTMENT,
};
let loadedAt = 0;
let inFlight = null;
const listeners = new Set();

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function shortDepartmentLabel(label) {
  return String(label || "").replace(/^college of\s+/i, "").trim() || label;
}

function bySortThenLabel(a, b) {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.label).localeCompare(String(b.label));
}

function buildCatalog(items) {
  const active = (Array.isArray(items) ? items : []).filter(
    (item) => item && item.is_active !== false && normalizeCode(item.code)
  );

  const departments = active
    .filter((item) => item.item_type === "department")
    .sort(bySortThenLabel)
    .map((item) => ({
      value: normalizeCode(item.code),
      label: String(item.label || item.code).trim(),
      shortLabel: shortDepartmentLabel(String(item.label || item.code).trim()),
    }));

  if (!departments.length) return null;

  const coursesByDepartment = {};
  for (const item of active.filter((row) => row.item_type === "course").sort(bySortThenLabel)) {
    const parent = normalizeCode(item.parent_code);
    if (!parent) continue;
    (coursesByDepartment[parent] ||= []).push({
      value: normalizeCode(item.code),
      label: String(item.label || item.code).trim(),
    });
  }

  return { departments, coursesByDepartment };
}

async function fetchCatalogItems() {
  // Public RPC works before login (signup); the table read covers projects that haven't run it yet.
  const rpc = await supabase.rpc("get_school_catalog");
  if (!rpc.error && Array.isArray(rpc.data)) return rpc.data;

  const table = await supabase
    .from("school_catalog")
    .select("item_type, code, label, parent_code, sort_order, is_active");
  if (!table.error && Array.isArray(table.data)) return table.data;

  return null;
}

/** Fetches the live catalog (deduped, cached briefly). Resolves even when the catalog can't be read. */
export function loadAcademicCatalog({ force = false } = {}) {
  if (!force && loadedAt && Date.now() - loadedAt < CATALOG_MAX_AGE_MS) {
    return Promise.resolve(catalog);
  }
  if (inFlight) return inFlight;

  inFlight = fetchCatalogItems()
    .then((items) => {
      const next = buildCatalog(items);
      if (next) {
        catalog = next;
        loadedAt = Date.now();
        listeners.forEach((listener) => listener());
      }
      return catalog;
    })
    .catch((err) => {
      console.warn("Could not load departments and courses:", err);
      return catalog;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return catalog;
}

/** Re-renders when the admin catalog loads or changes; triggers a refresh on mount. */
export function useAcademicCatalog() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    loadAcademicCatalog();
  }, []);
  return snapshot.departments;
}

export function getDepartments() {
  return catalog.departments;
}

export function isKnownDepartment(department) {
  return catalog.departments.some((item) => item.value === department);
}

export function getCoursesForDepartment(department) {
  return catalog.coursesByDepartment[department] || [];
}

export function getDepartmentLabel(value) {
  return catalog.departments.find((item) => item.value === value)?.label || value || "";
}

export function getCourseLabel(department, courseValue) {
  return (
    getCoursesForDepartment(department).find((item) => item.value === courseValue)
      ?.label ||
    courseValue ||
    ""
  );
}
