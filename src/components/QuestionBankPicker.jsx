import { useEffect, useMemo, useState } from "react";
import { Archive, Check, Search, X } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import ModalPortal from "./ui/ModalPortal";
import { primaryButton, secondaryButton } from "../utils/themeButtons";
import {
  bankRowToBuilderQuestion,
  fetchQuestionBank,
  getQuestionBankTypeLabel,
} from "../utils/questionBank";
import { EXAM_TYPE_LABELS } from "../utils/assessmentQuestions";

function questionPreview(row) {
  const text = String(row.title || row.question || "").trim();
  if (!text) return "Untitled question";
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

export default function QuestionBankPicker({ open, onClose, onImport, filterType = null }) {
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(filterType || "all");
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const rows = await fetchQuestionBank();
        if (!cancelled) {
          setItems(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load question bank.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    setSelectedIds(new Set());
    setSearch("");
    setTypeFilter(filterType || "all");

    return () => {
      cancelled = true;
    };
  }, [open, filterType]);

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

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleImport = () => {
    const selected = filteredItems.filter((item) => selectedIds.has(item.id));
    const questions = selected.map((row) => bankRowToBuilderQuestion(row));
    onImport(questions);
    onClose();
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div
          className={`flex max-h-[min(88vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl shadow-2xl ${
            theme === "dark"
              ? "border border-white/10 bg-[#031d1f]"
              : "en-bg-surface border border-emerald-300"
          }`}
        >
          <div
            className={`flex items-start justify-between gap-4 border-b px-6 py-5 ${
              theme === "dark" ? "border-white/10" : "border-emerald-100"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <Archive
                  size={20}
                  className={theme === "dark" ? "text-emerald-400" : "text-teal-700"}
                />
                <h2
                  className={`text-xl font-bold ${
                    theme === "dark" ? "text-emerald-400" : "text-teal-800"
                  }`}
                >
                  Import from question bank
                </h2>
              </div>
              <p
                className={`mt-1 text-sm ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Select saved questions to add to this assessment.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl p-2 transition ${
                theme === "dark"
                  ? "text-gray-400 hover:bg-white/10 hover:text-white"
                  : "text-gray-500 hover:bg-emerald-50 hover:text-gray-800"
              }`}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div
            className={`flex flex-wrap items-center gap-3 border-b px-6 py-4 ${
              theme === "dark" ? "border-white/10" : "border-emerald-100"
            }`}
          >
            <div className="relative min-w-[200px] flex-1">
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
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                theme === "dark"
                  ? "border border-white/10 bg-white/10 text-white"
                  : "border border-emerald-200 en-bg-elevated text-gray-900"
              }`}
            >
              <option value="all">All formats</option>
              {Object.entries(EXAM_TYPE_LABELS)
                .filter(([value]) => value !== "mixed")
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading && (
              <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                Loading your question bank…
              </p>
            )}

            {!loading && error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            {!loading && !error && filteredItems.length === 0 && (
              <p
                className={`rounded-xl border border-dashed p-6 text-center text-sm ${
                  theme === "dark"
                    ? "border-white/10 text-gray-400"
                    : "border-emerald-200 text-gray-500"
                }`}
              >
                {items.length === 0
                  ? "Your question bank is empty. Save questions from an assessment builder to reuse them later."
                  : "No questions match your search."}
              </p>
            )}

            {!loading && !error && filteredItems.length > 0 && (
              <ul className="space-y-2">
                {filteredItems.map((item) => {
                  const selected = selectedIds.has(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => toggleSelected(item.id)}
                        className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          selected
                            ? theme === "dark"
                              ? "border-emerald-500/40 bg-emerald-500/10"
                              : "border-emerald-400 bg-emerald-50"
                            : theme === "dark"
                              ? "border-white/10 bg-white/[0.03] hover:border-emerald-500/20"
                              : "border-emerald-100 en-bg-elevated hover:border-emerald-300"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            selected
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : theme === "dark"
                                ? "border-white/20"
                                : "border-emerald-200"
                          }`}
                        >
                          {selected && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              theme === "dark"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "en-bg-skeleton text-teal-800"
                            }`}
                          >
                            {getQuestionBankTypeLabel(item.question_type)}
                          </span>
                          <span
                            className={`mt-1 block text-sm font-medium ${
                              theme === "dark" ? "text-gray-100" : "text-gray-900"
                            }`}
                          >
                            {questionPreview(item)}
                          </span>
                          {item.title && item.question && item.title !== item.question && (
                            <span
                              className={`mt-1 block truncate text-xs ${
                                theme === "dark" ? "text-gray-500" : "text-gray-500"
                              }`}
                            >
                              {item.question}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            className={`flex items-center justify-between gap-3 border-t px-6 py-4 ${
              theme === "dark" ? "border-white/10" : "border-emerald-100"
            }`}
          >
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              {selectedIds.size} selected
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className={secondaryButton(theme)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={selectedIds.size === 0}
                className={primaryButton(theme, selectedIds.size === 0 ? "opacity-50" : "")}
              >
                Import selected
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
