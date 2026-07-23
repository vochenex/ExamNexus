import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Search, Trash2 } from "lucide-react";
import BackButton from "../../components/BackButton";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import { useTheme } from "../../layouts/ThemeContext";
import { useAppModal } from "../../contexts/AppModalContext";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import { secondaryButton } from "../../utils/themeButtons";
import ProgressButton from "../../components/ui/ProgressButton";
import { usePolling } from "../../hooks/useRealtimeFetch";
import {
  deleteQuestionBankEntry,
  fetchQuestionBank,
  getQuestionBankTypeLabel,
} from "../../utils/questionBank";
import {
  canFacultyManageSubjects,
  FACULTY_AVATAR_REQUIRED_MESSAGE,
  isFacultyRole,
} from "../../utils/avatar";
import { formatQuestionCorrectAnswers } from "../../utils/assessmentQuestions";
import { EXAM_TYPE_LABELS } from "../../utils/assessmentQuestions";

function questionPreview(row) {
  const text = String(row.title || row.question || "").trim();
  if (!text) return "Untitled question";
  return text.length > 96 ? `${text.slice(0, 96)}…` : text;
}

export default function QuestionBank() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { warning: showWarning, confirm, success: showSuccess, error: showError } = useAppModal();
  const cachedUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const facultyCanManage = canFacultyManageSubjects(cachedUser);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const rows = await fetchQuestionBank();
      setItems(rows);
    } catch (err) {
      setError(err.message || "Failed to load question bank.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFacultyRole(cachedUser.role) && !facultyCanManage) {
      showWarning(FACULTY_AVATAR_REQUIRED_MESSAGE, "Profile photo required");
      navigate("/faculty/profile");
    }
  }, [cachedUser.role, facultyCanManage, navigate, showWarning]);

  usePolling(load, [facultyCanManage]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      if (typeFilter !== "all" && item.question_type !== typeFilter) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        item.title,
        item.question,
        item.option_a,
        item.option_b,
        item.option_c,
        item.option_d,
        item.correct_answer,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [items, search, typeFilter]);

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: "Remove from question bank",
      message: `Remove "${questionPreview(item)}" from your question bank?\n\nThis will not affect assessments that already use this question.`,
      tone: "danger",
      confirmLabel: "Remove",
    });

    if (!ok) return;

    try {
      setDeletingId(item.id);
      await deleteQuestionBankEntry(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      if (expandedId === item.id) {
        setExpandedId(null);
      }
      showSuccess("Question removed from your bank.");
    } catch (err) {
      showError(err.message || "Could not delete question.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && items.length === 0) {
    return <PageLoadingSkeleton theme={theme} variant="detail" />;
  }

  return (
    <div className={pageShellClass(theme)}>
      <BackButton />
      <PageHeader
        theme={theme}
        icon={Archive}
        title="Question Bank"
        subtitle="Save and reuse questions across assessments and school years."
      />

      {error && (
        <div
          className={`mb-4 rounded-xl border p-3 text-sm ${
            theme === "dark"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-red-300 bg-red-50 text-red-700"
          }`}
        >
          {error}
        </div>
      )}

      <div className={`${panelClass(theme)} space-y-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
                theme === "dark" ? "text-gray-500" : "text-gray-400"
              }`}
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search saved questions…"
              className={`w-full rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                theme === "dark"
                  ? "border border-white/10 bg-white/10 text-white"
                  : "border border-emerald-200 en-bg-elevated text-gray-900"
              }`}
            />
          </div>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="!py-2.5"
          >
            <option value="all">All formats</option>
            {Object.entries(EXAM_TYPE_LABELS)
              .filter(([value]) => value !== "mixed")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </Select>
          <button type="button" onClick={load} className={secondaryButton(theme)}>
            Refresh
          </button>
        </div>

        {filteredItems.length === 0 ? (
          <div
            className={`rounded-2xl border border-dashed p-8 text-center ${
              theme === "dark"
                ? "border-white/10 text-gray-400"
                : "border-emerald-200 text-gray-500"
            }`}
          >
            <Archive
              size={32}
              className={`mx-auto mb-3 ${theme === "dark" ? "text-emerald-500/50" : "text-emerald-300"}`}
            />
            <p className="text-sm font-medium">
              {items.length === 0
                ? "No saved questions yet."
                : "No questions match your filters."}
            </p>
            <p className="mt-2 text-xs">
              While building an assessment, use <strong>Save to bank</strong> on any question to
              store it here for later reuse.
            </p>
          </div>
        ) : (
          <ul className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const expanded = expandedId === item.id;
              const answers = formatQuestionCorrectAnswers(item, item.question_type);
              const preview = questionPreview(item);

              return (
                <li
                  key={item.id}
                  className={`min-w-0 max-w-full overflow-hidden rounded-2xl border backdrop-blur-md ${
                    theme === "dark"
                      ? "border-white/10 bg-white/[0.04]"
                      : "border-emerald-700/15 en-bg-elevated"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2 p-2.5">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="min-w-0 flex-1 overflow-hidden text-left"
                      title={item.question || preview}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            theme === "dark"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "en-bg-muted text-teal-800"
                          }`}
                        >
                          {getQuestionBankTypeLabel(item.question_type).replace("Multiple Choice", "MC")}
                        </span>
                        <p
                          className={`min-w-0 truncate text-sm font-medium ${
                            theme === "dark" ? "text-gray-100" : "text-[#1a332c]"
                          }`}
                        >
                          {preview}
                        </p>
                      </div>
                    </button>
                    <ProgressButton
                      type="button"
                      onClick={() => handleDelete(item)}
                      loading={deletingId === item.id}
                      loadingLabel="Removing..."
                      disabled={deletingId !== null && deletingId !== item.id}
                      className="shrink-0 rounded-lg p-1.5 text-red-400 transition hover:bg-red-500/10"
                      aria-label="Remove from bank"
                    >
                      <Trash2 size={14} />
                    </ProgressButton>
                  </div>

                  {expanded && (
                    <div
                      className={`border-t px-3 py-2.5 text-xs ${
                        theme === "dark"
                          ? "border-white/10 text-gray-300"
                          : "border-emerald-700/15 text-[#2f5248]"
                      }`}
                    >
                      {item.question && item.question !== preview && (
                        <p className="mb-2 line-clamp-3">{item.question}</p>
                      )}
                      {item.question_type === "multiple_choice" && (
                        <ul className="mb-2 space-y-0.5">
                          {[
                            ["A", item.option_a],
                            ["B", item.option_b],
                            ["C", item.option_c],
                            ["D", item.option_d],
                          ]
                            .filter(([, text]) => text)
                            .map(([letter, text]) => (
                              <li key={letter}>
                                <span className="font-semibold">{letter}.</span> {text}
                              </li>
                            ))}
                        </ul>
                      )}
                      {answers.length > 0 && (
                        <p className="line-clamp-2">
                          <span className="font-semibold">Answer:</span> {answers.join(" · ")}
                        </p>
                      )}
                      <p
                        className={`mt-1.5 ${
                          theme === "dark" ? "text-gray-500" : "text-[#5a7a72]"
                        }`}
                      >
                        {new Date(item.updated_at || item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
