import { useEffect, useMemo, useState } from "react";
import { Archive, Check, X } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import ModalPortal from "./ui/ModalPortal";
import { primaryButton, secondaryButton } from "../utils/themeButtons";
import { deserializeQuestion } from "../utils/assessmentQuestions";
import { getQuestionBankTypeLabel, saveQuestionToBank } from "../utils/questionBank";

function questionPreview(question) {
  const text = String(question.question || "").trim();
  if (!text) return "Untitled question";
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

export default function QuestionBankSaveModal({
  open,
  onClose,
  questions = [],
  examType,
  onSaved,
}) {
  const { theme } = useTheme();
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const items = useMemo(
    () =>
      (questions || []).map((row) => ({
        id: row.id,
        type: row.question_type || examType,
        preview: questionPreview(row),
        body: row.question,
      })),
    [questions, examType]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setError("");
    setSaving(false);
  }, [open]);

  const reset = () => {
    setSelectedIds(new Set());
    setError("");
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

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

  const handleSave = async () => {
    const selected = questions.filter((row) => selectedIds.has(row.id));
    if (!selected.length) return;

    try {
      setSaving(true);
      setError("");

      for (const row of selected) {
        const builderQuestion = deserializeQuestion(row, examType);
        await saveQuestionToBank(builderQuestion);
      }

      onSaved?.(selected.length);
      handleClose();
    } catch (err) {
      setError(err.message || "Could not save questions to your bank.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div
          className={`flex max-h-[min(88vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl shadow-2xl ${
            theme === "dark"
              ? "border border-white/10 bg-[#031d1f]"
              : "en-bg-surface border border-emerald-700/20 en-panel-glow"
          }`}
        >
          <div
            className={`flex items-start justify-between gap-4 border-b px-6 py-5 ${
              theme === "dark" ? "border-white/10" : "border-emerald-700/15"
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
                  Save to question bank
                </h2>
              </div>
              <p
                className={`mt-1 text-sm ${
                  theme === "dark" ? "text-gray-400" : "text-[#3d5c54]"
                }`}
              >
                Select questions from this assessment to store for later reuse.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className={`rounded-xl p-2 transition ${
                theme === "dark"
                  ? "text-gray-400 hover:bg-white/10 hover:text-white"
                  : "text-gray-500 hover:bg-emerald-100/80 hover:text-gray-800"
              }`}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

            {items.length === 0 ? (
              <p
                className={`rounded-xl border border-dashed p-6 text-center text-sm ${
                  theme === "dark"
                    ? "border-white/10 text-gray-400"
                    : "border-emerald-700/20 text-[#3d5c54]"
                }`}
              >
                This assessment has no questions to save.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => {
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
                              : "border-emerald-500/50 bg-emerald-100/80"
                            : theme === "dark"
                              ? "border-white/10 bg-white/[0.03] hover:border-emerald-500/20"
                              : "border-emerald-700/15 en-bg-elevated hover:border-emerald-500/35"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            selected
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : theme === "dark"
                                ? "border-white/20"
                                : "border-emerald-400/50"
                          }`}
                        >
                          {selected && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              theme === "dark"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "en-bg-muted text-teal-800"
                            }`}
                          >
                            {getQuestionBankTypeLabel(item.type)}
                          </span>
                          <span
                            className={`mt-1 block text-sm font-medium ${
                              theme === "dark" ? "text-gray-100" : "text-[#1a332c]"
                            }`}
                          >
                            {item.preview}
                          </span>
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
              theme === "dark" ? "border-white/10" : "border-emerald-700/15"
            }`}
          >
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-[#3d5c54]"}`}>
              {selectedIds.size} selected
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={handleClose} className={secondaryButton(theme)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={selectedIds.size === 0 || saving}
                className={primaryButton(
                  theme,
                  selectedIds.size === 0 || saving ? "opacity-50" : ""
                )}
              >
                {saving ? "Saving…" : "Save selected"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
