import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Search,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import PageHeader from "../../components/ui/PageHeader";
import { ProgressLink } from "../../components/ProgressLink";
import {
  adminTableClass,
  adminTableInnerClass,
  adminTableWrapClass,
  adminTdClass,
  adminThClass,
} from "../../components/admin/adminTableStyles";
import { inputClass, pageShellClass, staticPanelClass } from "../../utils/themeInputs";
import { secondaryButtonSm } from "../../utils/themeButtons";
import { friendlyError } from "../../utils/friendlyError";
import {
  MAX_IMPORT_ROWS,
  REQUIRED_COLUMN_LABELS,
  TEMPORARY_PASSWORD,
  checkExistingAccounts,
  createStudentAccounts,
  downloadCreatedAccounts,
  downloadStudentTemplate,
  readStudentWorkbook,
} from "../../utils/studentXlsxImport";

const EXCLUDED_REASON = "Excluded by admin";

function muted(theme) {
  return theme === "dark" ? "text-gray-400" : "text-slate-600";
}

function tone(theme, kind) {
  const map = {
    ok: theme === "dark" ? "text-emerald-300" : "text-emerald-700",
    bad: theme === "dark" ? "text-red-300" : "text-red-700",
    warn: theme === "dark" ? "text-amber-200" : "text-amber-800",
  };
  return map[kind];
}

function chipClass(theme, kind) {
  const map = {
    ok:
      theme === "dark"
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
        : "bg-emerald-50 text-emerald-800 ring-emerald-200",
    warn:
      theme === "dark"
        ? "bg-amber-500/15 text-amber-200 ring-amber-500/30"
        : "bg-amber-50 text-amber-800 ring-amber-200",
    idle:
      theme === "dark"
        ? "bg-white/5 text-gray-300 ring-white/10"
        : "bg-slate-50 text-slate-600 ring-slate-200",
  };
  return `inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${map[kind]}`;
}

function tabClass(theme, active) {
  if (active) {
    return theme === "dark"
      ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40"
      : "bg-emerald-600 text-white";
  }
  return theme === "dark" ? "text-gray-300 hover:bg-white/5" : "text-slate-600 hover:bg-slate-100";
}

function displayName(row) {
  if (row.lastName && row.firstName) return `${row.lastName}, ${row.firstName}`;
  return row.lastName || row.firstName || row.rawName || "—";
}

function ProgressBar({ theme, done, total }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="w-full min-w-[12rem]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <div className="mb-1 flex items-center justify-between text-xs font-medium">
        <span>
          Creating accounts… {done} of {total}
        </span>
        <span>{percent}%</span>
      </div>
      <div className={`h-2 w-full overflow-hidden rounded-full ${theme === "dark" ? "bg-white/10" : "bg-slate-200"}`}>
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminStudentImportPage() {
  const { theme } = useTheme();
  const { success, error: showError } = useAppModal();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [fileError, setFileError] = useState("");
  const [checkWarning, setCheckWarning] = useState("");
  const [preview, setPreview] = useState(null);
  const [existing, setExisting] = useState(() => new Map());
  const [excluded, setExcluded] = useState(() => new Set());
  const [tab, setTab] = useState("eligible");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState(() => new Map());

  const isCreated = (line) => results.get(line)?.status === "created";

  /** Eligible from the file and not blocked by an existing account. */
  const eligible = useMemo(
    () => (preview?.eligible || []).filter((row) => !existing.get(row.line)?.blocking?.length),
    [preview, existing]
  );

  const notEligible = useMemo(() => {
    if (!preview) return [];
    const fromFile = [...preview.ineligible, ...preview.eligible]
      .map((row) => {
        const reasons = [...row.reasons, ...(existing.get(row.line)?.blocking || [])];
        return reasons.length ? { ...row, reasons, excludedByAdmin: false } : null;
      })
      .filter(Boolean);
    const byAdmin = eligible
      .filter((row) => excluded.has(row.line))
      .map((row) => ({ ...row, reasons: [EXCLUDED_REASON], excludedByAdmin: true }));
    return [...fromFile, ...byAdmin].sort((a, b) => a.line - b.line);
  }, [preview, existing, eligible, excluded]);

  const toCreate = useMemo(
    () => eligible.filter((row) => !excluded.has(row.line) && results.get(row.line)?.status !== "created"),
    [eligible, excluded, results]
  );
  const createdRows = useMemo(
    () => eligible.filter((row) => results.get(row.line)?.status === "created"),
    [eligible, results]
  );
  const failedCount = useMemo(
    () => [...results.values()].filter((r) => r.status !== "created").length,
    [results]
  );
  const excludedCount = eligible.filter((row) => excluded.has(row.line)).length;

  const visibleEligible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((row) =>
      [row.lastName, row.firstName, row.schoolId, row.email].some((v) => v.toLowerCase().includes(q))
    );
  }, [eligible, query]);

  const selectableVisible = visibleEligible.filter((row) => results.get(row.line)?.status !== "created");
  const allVisibleExcluded =
    selectableVisible.length > 0 && selectableVisible.every((row) => excluded.has(row.line));

  useEffect(() => {
    if (!creating) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [creating]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    setFileName(file.name);
    setFileError("");
    setCheckWarning("");
    setPreview(null);
    setExisting(new Map());
    setExcluded(new Set());
    setResults(new Map());
    setQuery("");
    setReading(true);

    let next;
    try {
      next = await readStudentWorkbook(file);
    } catch (err) {
      setFileError(friendlyError(err, "This file could not be read."));
      setReading(false);
      return;
    }
    setReading(false);
    if (next.missing.length) {
      setPreview(next);
      return;
    }

    setChecking(true);
    let matches = new Map();
    try {
      matches = await checkExistingAccounts([...next.eligible, ...next.ineligible]);
    } catch (err) {
      setCheckWarning(
        `${friendlyError(err, "Could not check existing accounts.")} Duplicate ID numbers and emails are still blocked when creating.`
      );
    }
    setExisting(matches);
    // Exact name matches start excluded; the admin can restore them after reviewing.
    setExcluded(
      new Set(
        next.eligible
          .filter((row) => {
            const match = matches.get(row.line);
            return !match?.blocking?.length && match?.warnings?.some((w) => w.type === "same_name");
          })
          .map((row) => row.line)
      )
    );
    setPreview(next);
    setChecking(false);
    setTab(next.eligible.length ? "eligible" : "ineligible");
  };

  const toggleExcluded = (line) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const row of selectableVisible) {
        if (allVisibleExcluded) next.delete(row.line);
        else next.add(row.line);
      }
      return next;
    });
  };

  const restoreAllExcluded = () => setExcluded(new Set());

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(TEMPORARY_PASSWORD);
      success("Temporary password copied.");
    } catch {
      showError("Could not copy. Please select and copy it manually.");
    }
  };

  const openAccounts = (emails) => {
    navigate("/admin/accounts", { state: { importedEmails: emails } });
  };

  const handleCreate = async () => {
    if (!toCreate.length || creating) return;
    setCreating(true);
    setProgress({ done: 0, total: toCreate.length });
    try {
      const all = await createStudentAccounts(toCreate, (batch, done, total) => {
        setProgress({ done, total });
        setResults((prev) => {
          const next = new Map(prev);
          for (const item of batch) next.set(item.row, item);
          return next;
        });
      });
      const createdEmails = all.filter((r) => r.status === "created").map((r) => r.email);
      const created = createdEmails.length;
      const notCreated = all.length - created;
      if (created && !notCreated) {
        success(`Created ${created} student account${created === 1 ? "" : "s"}.`);
        openAccounts(createdEmails);
      } else if (created) {
        success(
          `Created ${created} student account${created === 1 ? "" : "s"}. ${notCreated} could not be created — see the status column.`
        );
      } else {
        showError("No accounts were created. Check the status column for the reason.");
      }
    } catch (err) {
      showError(friendlyError(err, "Could not create accounts. Please try again."));
    } finally {
      setCreating(false);
    }
  };

  const statusCell = (row) => {
    const result = results.get(row.line);
    if (result?.status === "created") {
      return (
        <span className={chipClass(theme, "ok")}>
          <CheckCircle2 className="mr-1 h-3 w-3" /> Created
        </span>
      );
    }
    if (excluded.has(row.line)) return <span className={chipClass(theme, "idle")}>Excluded</span>;
    if (result) return <span className={`text-xs ${tone(theme, "bad")}`}>{result.message || "Not created."}</span>;
    if (creating) return <span className={chipClass(theme, "idle")}>Queued</span>;
    return <span className={chipClass(theme, "ok")}>Ready</span>;
  };

  const thClass = adminThClass(theme);
  const tdClass = adminTdClass(theme);
  const busy = reading || checking;

  return (
    <div className={pageShellClass(theme, "mx-auto max-w-[100rem]")}>
      <PageHeader
        theme={theme}
        icon={FileSpreadsheet}
        title="Import students"
        subtitle="Create student accounts in bulk from an Excel file."
        actions={
          <ProgressLink to="/admin/accounts" className={secondaryButtonSm(theme)}>
            Back to accounts
          </ProgressLink>
        }
      />

      <section className={staticPanelClass(theme, "mb-5")}>
        <p className={`text-sm ${muted(theme)}`}>
          Students only (faculty can't be added in bulk). Upload an Excel <strong>.xlsx</strong> file with these
          columns: <span className="font-medium">{REQUIRED_COLUMN_LABELS.join(", ")}</span>. Files missing any column
          are rejected. Emails are created as lastname.firstname@crmc.en.com.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFile}
            disabled={creating || busy}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={creating || busy}
            className="en-btn-primary en-btn-primary-sm gap-1.5"
          >
            <Upload className="h-4 w-4" />
            {reading
              ? "Reading file…"
              : checking
                ? "Checking existing accounts…"
                : fileName
                  ? "Choose another file"
                  : "Choose .xlsx file"}
          </button>
          <button
            type="button"
            onClick={() => downloadStudentTemplate().catch(() => showError("Could not download the template."))}
            className={secondaryButtonSm(theme, "inline-flex items-center gap-1.5")}
          >
            <Download className="h-4 w-4" />
            Download template
          </button>
          {fileName && <span className={`truncate text-sm ${muted(theme)}`}>{fileName}</span>}
        </div>
        {fileError && <p className={`mt-3 text-sm ${tone(theme, "bad")}`}>{fileError}</p>}
        {checkWarning && <p className={`mt-3 text-sm ${tone(theme, "warn")}`}>{checkWarning}</p>}
        {preview?.missing.length > 0 && (
          <p className={`mt-3 text-sm ${tone(theme, "bad")}`}>
            Missing column{preview.missing.length === 1 ? "" : "s"}: {preview.missing.join(", ")}. No accounts can be
            created from this file.
          </p>
        )}
        {preview?.tooMany && (
          <p className={`mt-3 text-sm ${tone(theme, "warn")}`}>
            Only the first {MAX_IMPORT_ROWS} students are shown. Split larger lists into several files.
          </p>
        )}
      </section>

      {preview && !preview.missing.length && (
        <>
          <section className={staticPanelClass(theme, "mb-5")}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Temporary password for all new students</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <code
                    className={`rounded-lg px-3 py-1.5 font-mono text-sm ${
                      theme === "dark" ? "bg-white/10" : "bg-slate-100"
                    }`}
                  >
                    {TEMPORARY_PASSWORD}
                  </code>
                  <button
                    type="button"
                    onClick={copyPassword}
                    className={secondaryButtonSm(theme, "inline-flex items-center gap-1.5")}
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </button>
                </div>
                <p className={`mt-1.5 text-xs ${muted(theme)}`}>
                  After signing in, students are reminded (not forced) to change it in Profile → Change password.
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-3 text-sm">
                <div className={staticPanelClass(theme, "px-4 py-2")}>
                  <p className={muted(theme)}>Will be created</p>
                  <p className={`text-lg font-bold ${tone(theme, "ok")}`}>{toCreate.length}</p>
                </div>
                <div className={staticPanelClass(theme, "px-4 py-2")}>
                  <p className={muted(theme)}>Not eligible</p>
                  <p className={`text-lg font-bold ${tone(theme, "bad")}`}>{notEligible.length}</p>
                </div>
                {results.size > 0 && (
                  <div className={staticPanelClass(theme, "px-4 py-2")}>
                    <p className={muted(theme)}>Created</p>
                    <p className="text-lg font-bold">{createdRows.length}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("eligible")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tabClass(theme, tab === "eligible")}`}
            >
              Eligible ({eligible.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("ineligible")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tabClass(theme, tab === "ineligible")}`}
            >
              Not eligible ({notEligible.length})
            </button>
            {tab === "eligible" && eligible.length > 0 && (
              <div className="relative ml-auto w-full sm:w-64">
                <Search
                  className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${muted(theme)}`}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, ID or email"
                  className={inputClass(theme, "pl-9")}
                />
              </div>
            )}
            {tab === "ineligible" && excludedCount > 0 && (
              <button
                type="button"
                onClick={restoreAllExcluded}
                disabled={creating}
                className={secondaryButtonSm(theme, "ml-auto inline-flex items-center gap-1.5 disabled:opacity-60")}
              >
                <RotateCcw className="h-4 w-4" /> Restore all excluded ({excludedCount})
              </button>
            )}
          </div>

          {tab === "eligible" && eligible.length > 0 && (
            <p className={`mb-2 text-xs ${muted(theme)}`}>
              Tick students you don't want to create. They move to Not eligible and their information is not used.
            </p>
          )}

          {tab === "eligible" ? (
            <div className={adminTableWrapClass(theme)}>
              <div className={`${adminTableInnerClass()} max-h-[60vh]`}>
                {eligible.length === 0 ? (
                  <p className={`p-6 text-sm ${muted(theme)}`}>No eligible students in this file.</p>
                ) : (
                  <table className={adminTableClass(theme)}>
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className={thClass}>
                          <label className="inline-flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={allVisibleExcluded}
                              onChange={toggleAllVisible}
                              disabled={creating || selectableVisible.length === 0}
                              className="h-4 w-4 accent-red-600"
                            />
                            Exclude
                          </label>
                        </th>
                        <th className={thClass}>Name</th>
                        <th className={thClass}>ID number</th>
                        <th className={thClass}>New email</th>
                        <th className={thClass}>Temporary password</th>
                        <th className={thClass}>Department / Course</th>
                        <th className={thClass}>Year</th>
                        <th className={`${thClass} w-44`}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEligible.map((row) => {
                        const created = isCreated(row.line);
                        const isExcluded = excluded.has(row.line);
                        const warnings = existing.get(row.line)?.warnings || [];
                        return (
                          <tr key={row.line} className={isExcluded ? "opacity-50" : ""}>
                            <td className={tdClass}>
                              <input
                                type="checkbox"
                                checked={isExcluded}
                                onChange={() => toggleExcluded(row.line)}
                                disabled={creating || created}
                                aria-label={`Exclude ${row.firstName} ${row.lastName}`}
                                className="h-4 w-4 accent-red-600"
                              />
                            </td>
                            <td className={tdClass}>
                              <span className={isExcluded ? "line-through" : ""}>{displayName(row)}</span>
                              {warnings.map((warning) => (
                                <p
                                  key={warning.message}
                                  className={`mt-1 flex items-start gap-1 text-[11px] ${tone(theme, "warn")}`}
                                >
                                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                  {warning.message}
                                </p>
                              ))}
                            </td>
                            <td className={`${tdClass} font-mono`}>{row.schoolId}</td>
                            <td className={`${tdClass} break-all`}>{row.email}</td>
                            <td className={`${tdClass} font-mono`}>{TEMPORARY_PASSWORD}</td>
                            <td className={tdClass}>
                              {row.department} · {row.course}
                            </td>
                            <td className={`${tdClass} whitespace-nowrap`}>{row.yearLabel}</td>
                            <td className={tdClass}>
                              <div className="w-40">{statusCell(row)}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className={adminTableWrapClass(theme)}>
              <div className={`${adminTableInnerClass()} max-h-[60vh]`}>
                {notEligible.length === 0 ? (
                  <p className={`p-6 text-sm ${muted(theme)}`}>Every student in this file is eligible.</p>
                ) : (
                  <table className={adminTableClass(theme)}>
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className={thClass}>Row</th>
                        <th className={thClass}>Name</th>
                        <th className={thClass}>ID number</th>
                        <th className={thClass}>Department / Course</th>
                        <th className={thClass}>Year</th>
                        <th className={thClass}>Why not eligible</th>
                        <th className={thClass} aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {notEligible.map((row) => (
                        <tr key={row.line}>
                          <td className={tdClass}>{row.line}</td>
                          <td className={tdClass}>{displayName(row)}</td>
                          <td className={`${tdClass} font-mono`}>{row.schoolId || "—"}</td>
                          <td className={tdClass}>
                            {[row.department, row.course].filter(Boolean).join(" · ") || "—"}
                          </td>
                          <td className={`${tdClass} whitespace-nowrap`}>{row.yearLabel || "—"}</td>
                          <td className={tdClass}>
                            <ul
                              className={`space-y-0.5 text-xs ${tone(theme, row.excludedByAdmin ? "warn" : "bad")}`}
                            >
                              {row.reasons.map((reason) => (
                                <li key={reason} className="flex items-start gap-1">
                                  <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className={tdClass}>
                            {row.excludedByAdmin && (
                              <button
                                type="button"
                                onClick={() => toggleExcluded(row.line)}
                                disabled={creating}
                                className={secondaryButtonSm(
                                  theme,
                                  "inline-flex items-center gap-1 whitespace-nowrap disabled:opacity-60"
                                )}
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> Restore
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          <div
            className={staticPanelClass(
              theme,
              "sticky bottom-3 z-20 mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            )}
          >
            {creating ? (
              <ProgressBar theme={theme} done={progress.done} total={progress.total} />
            ) : (
              <p className="text-sm">
                <span className="font-semibold">{toCreate.length}</span> account{toCreate.length === 1 ? "" : "s"} will
                be created
                <span className={muted(theme)}>
                  {excludedCount ? ` · ${excludedCount} excluded` : ""}
                  {results.size > 0 ? ` · ${createdRows.length} created` : ""}
                  {failedCount ? `, ${failedCount} failed` : ""}
                </span>
              </p>
            )}
            <div className="flex shrink-0 flex-wrap gap-2">
              {createdRows.length > 0 && !creating && (
                <button
                  type="button"
                  onClick={() =>
                    downloadCreatedAccounts(createdRows).catch(() => showError("Could not download the account list."))
                  }
                  className={secondaryButtonSm(theme, "inline-flex items-center gap-1.5")}
                >
                  <Download className="h-4 w-4" />
                  Download account list
                </button>
              )}
              {createdRows.length > 0 && !creating && (
                <button
                  type="button"
                  onClick={() => openAccounts(createdRows.map((row) => row.email))}
                  className={secondaryButtonSm(theme, "inline-flex items-center gap-1.5")}
                >
                  <Users className="h-4 w-4" />
                  View created accounts
                </button>
              )}
              {!creating && (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!toCreate.length}
                  className="en-btn-primary en-btn-primary-sm disabled:opacity-50"
                >
                  {failedCount && toCreate.length
                    ? `Retry ${toCreate.length} account${toCreate.length === 1 ? "" : "s"}`
                    : `Create ${toCreate.length} account${toCreate.length === 1 ? "" : "s"}`}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
