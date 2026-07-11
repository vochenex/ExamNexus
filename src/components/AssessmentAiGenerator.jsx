import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSearch,
  FileUp,
  Wand2,
  X,
} from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import {
  AI_FORMAT_OPTIONS,
  DEFAULT_AI_FORMATS,
} from "../utils/aiQuestionMapper";
import { parsePromptPreferences } from "../utils/promptPreferences";
import {
  fetchAssessmentAiStatus,
  generateAssessmentFromDocument,
  generateAssessmentFromPrompt,
} from "../utils/assessmentAi";
import { assessmentInputClass } from "./QuestionBuilderCard";
import Select from "./ui/Select";

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 150;

function clampQuestionCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 8;
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, parsed));
}

function normalizeErrorMessage(error, fallback = "AI generation failed.") {
  if (!error) return fallback;
  if (typeof error === "string") return error || fallback;
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

export default function AssessmentAiGenerator({
  mode,
  onGenerationStart,
  onQuestionGenerated,
  onGenerated,
  onError,
  onClearError,
  onProgress,
  disabled = false,
}) {
  const { theme } = useTheme();
  const [aiReady, setAiReady] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [questionCount, setQuestionCount] = useState(8);
  const [difficulty, setDifficulty] = useState("medium");
  const [selectedFormats, setSelectedFormats] = useState(() => [...DEFAULT_AI_FORMATS]);
  const [file, setFile] = useState(null);
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchAssessmentAiStatus().then((status) => {
      if (!cancelled) {
        setAiReady(status);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const promptHints = useMemo(() => {
    if (mode !== "prompt" || !prompt.trim()) return null;
    return parsePromptPreferences(prompt);
  }, [mode, prompt]);

  const formatHint = useMemo(() => {
    if (selectedFormats.length === 0) {
      return "Select at least one question format.";
    }
    return `AI may mix: ${selectedFormats
      .map((value) => AI_FORMAT_OPTIONS.find((item) => item.value === value)?.label || value)
      .join(", ")}`;
  }, [selectedFormats]);

  const toggleFormat = (value) => {
    setSelectedFormats((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((item) => item !== value);
        return next.length ? next : prev;
      }
      return [...prev, value];
    });
  };

  const runGeneration = async (generator) => {
    if (disabled || loading) return;

    if (mode === "prompt" && selectedFormats.length === 0) {
      onError?.("Select at least one question format.");
      return;
    }

    try {
      const latestStatus = await fetchAssessmentAiStatus();
      setAiReady(latestStatus);

      if (!latestStatus.configured) {
        onError?.(
          latestStatus.error ||
            "AI is not ready. Add GEMINI_API_KEY to backend/.env, then restart the backend."
        );
        return;
      }

      if (onGenerationStart) {
        const canStart = await onGenerationStart();
        if (!canStart) return;
      }

      setLoading(true);
      if (onClearError) {
        onClearError();
      } else {
        onError?.("");
      }

      const payload = await generator({
        onProgress,
        onQuestionGenerated,
      });

      onGenerated?.(payload);
    } catch (error) {
      onError?.(normalizeErrorMessage(error));
      onProgress?.(null);
    } finally {
      setLoading(false);
    }
  };

  const resolvedQuestionCount = clampQuestionCount(questionCount);

  const handlePromptGenerate = () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      onError?.("Describe the topic, skills, or content for the AI to generate.");
      return;
    }

    runGeneration(({ onProgress, onQuestionGenerated }) =>
      generateAssessmentFromPrompt({
        prompt: trimmed,
        formats: selectedFormats,
        questionCount: resolvedQuestionCount,
        difficulty,
        onProgress,
        onQuestionGenerated,
      })
    );
  };

  const handleDocumentGenerate = () => {
    if (!file) {
      onError?.("Choose a PDF or Word (.docx) file first.");
      return;
    }

    runGeneration(({ onProgress, onQuestionGenerated }) =>
      generateAssessmentFromDocument({
        file,
        onProgress,
        onQuestionGenerated,
      })
    );
  };

  const checkboxClass = `rounded border ${
    theme === "dark" ? "border-white/20 bg-white/5" : "border-emerald-200 bg-white"
  }`;

  const labelClass = `mb-2 block text-xs font-semibold uppercase tracking-wide ${
    theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
  }`;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div
          className={`rounded-xl p-2 ${
            theme === "dark" ? "bg-emerald-500/10" : "bg-emerald-50"
          }`}
        >
          {mode === "document" ? (
            <FileUp className="text-emerald-400" size={20} />
          ) : (
            <Wand2 className="text-emerald-400" size={20} />
          )}
        </div>
        <div>
          <h2 className="font-semibold">
            {mode === "document" ? "Generate from document" : "Generate from prompt"}
          </h2>
          <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            {mode === "document"
              ? "Upload a PDF or Word file. Questions and settings are inferred from the document."
              : "Describe what you want assessed. Questions appear below when generation finishes."}
          </p>
        </div>
      </div>

      {aiReady && !aiReady.configured && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            theme === "dark"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
              : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          {aiReady.error ||
            "AI is not ready. Add GEMINI_API_KEY to backend/.env, then restart the backend."}
        </div>
      )}

      {aiReady?.configured && aiReady.error && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            theme === "dark"
              ? "border-sky-500/30 bg-sky-500/10 text-sky-100"
              : "border-sky-300 bg-sky-50 text-sky-900"
          }`}
        >
          {aiReady.error}
        </div>
      )}

      {aiReady?.configured && !aiReady.error && (
        <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Using Gemini · {aiReady.documentModel || aiReady.model || "gemini-2.5-flash"}
        </p>
      )}

      {mode === "document" ? (
        <div>
          <label className={labelClass}>Document file</label>
          {file ? (
            <div
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                theme === "dark"
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <CheckCircle2 className="shrink-0 text-emerald-500" size={20} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  Ready to analyze
                </p>
              </div>
              <button
                type="button"
                disabled={disabled || loading}
                onClick={() => setFile(null)}
                className={`rounded-lg p-1.5 transition ${
                  theme === "dark"
                    ? "text-gray-400 hover:bg-white/10 hover:text-white"
                    : "text-gray-500 hover:bg-white hover:text-gray-800"
                }`}
                aria-label="Remove file"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={disabled || loading}
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                if (onClearError) {
                  onClearError();
                } else {
                  onError?.("");
                }
              }}
              className={`block w-full text-sm ${
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              }`}
            />
          )}
        </div>
      ) : (
        <div>
          <label className={labelClass}>What should the AI generate?</label>
          <textarea
            className={assessmentInputClass(theme)}
            rows={5}
            disabled={disabled || loading}
            placeholder="Example: Create 10 hard questions on cell division for Grade 10. Include multiple choice and identification. Focus on mitosis and meiosis."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          {promptHints &&
            (promptHints.questionCount ||
              promptHints.difficulty ||
              promptHints.formats.length > 0) && (
              <p className={`mt-2 text-xs ${theme === "dark" ? "text-emerald-300/80" : "text-teal-700"}`}>
                Detected in your prompt
                {promptHints.questionCount ? `: ${promptHints.questionCount} questions` : ""}
                {promptHints.difficulty ? ` · ${promptHints.difficulty}` : ""}
                {promptHints.formats.length
                  ? ` · ${promptHints.formats
                      .map(
                        (value) =>
                          AI_FORMAT_OPTIONS.find((item) => item.value === value)?.label || value
                      )
                      .join(", ")}`
                  : ""}
                . These override the optional controls below when present.
              </p>
            )}
        </div>
      )}

      {mode === "prompt" && (
        <div
          className={`rounded-xl border p-4 ${
            theme === "dark"
              ? "border-white/10 bg-white/[0.03]"
              : "border-emerald-200/80 en-bg-elevated-soft en-panel-glow"
          }`}
        >
          <div className="grid grid-cols-2 items-end gap-4">
            <div className="min-w-0">
              <label className={labelClass}>Number of questions</label>
              <input
                type="number"
                min={MIN_QUESTIONS}
                max={MAX_QUESTIONS}
                disabled={disabled || loading}
                className={assessmentInputClass(theme)}
                value={questionCount}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === "") {
                    setQuestionCount("");
                    return;
                  }
                  const parsed = Number(next);
                  if (Number.isFinite(parsed)) {
                    setQuestionCount(parsed);
                  }
                }}
                onBlur={() => setQuestionCount(clampQuestionCount(questionCount))}
              />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Difficulty</label>
              <Select
                disabled={disabled || loading}
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
              >
                {DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className={`mt-2 text-xs ${theme === "dark" ? "text-gray-500" : "en-text-muted"}`}>
            {MIN_QUESTIONS}–{MAX_QUESTIONS} items ·{" "}
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
          </p>
        </div>
      )}

      {mode === "prompt" && (
        <div
          className={`rounded-xl border ${
            theme === "dark"
              ? "border-white/10 bg-white/[0.03]"
              : "border-emerald-100 bg-emerald-50/30"
          }`}
        >
          <button
            type="button"
            onClick={() => setOptionsOpen((value) => !value)}
            className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
              theme === "dark" ? "text-emerald-300" : "text-teal-800"
            }`}
          >
            <span>
              <span className="block text-sm font-semibold">Question formats</span>
              <span
                className={`mt-0.5 block text-xs ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {selectedFormats.length} format(s) selected
              </span>
            </span>
            {optionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {optionsOpen && (
            <div className="space-y-4 border-t border-inherit px-4 py-4">
              <div>
                <label className={labelClass}>Question formats</label>
                <div className="flex flex-wrap gap-2">
                  {AI_FORMAT_OPTIONS.map((option) => {
                    const checked = selectedFormats.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                          checked
                            ? theme === "dark"
                              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                              : "border-teal-300 bg-teal-50 text-teal-900"
                            : theme === "dark"
                              ? "border-white/10 bg-white/[0.03] text-gray-300"
                              : "border-emerald-100 bg-white text-gray-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className={checkboxClass}
                          checked={checked}
                          disabled={disabled || loading}
                          onChange={() => toggleFormat(option.value)}
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
                <p className={`mt-2 text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  {formatHint}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "document" ? (
        <button
          type="button"
          disabled={disabled || loading || !file || (aiReady && !aiReady.configured)}
          onClick={handleDocumentGenerate}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
            disabled || loading || !file || (aiReady && !aiReady.configured)
              ? "cursor-not-allowed opacity-60"
              : theme === "dark"
                ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                : "border-teal-500 bg-teal-50 text-teal-800 hover:bg-teal-100"
          }`}
        >
          <FileSearch size={18} />
          {loading ? "Analyzing document…" : "Analyze document"}
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled || loading || (aiReady && !aiReady.configured)}
          onClick={handlePromptGenerate}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            disabled || loading || (aiReady && !aiReady.configured)
              ? "cursor-not-allowed opacity-60"
              : theme === "dark"
                ? "bg-emerald-500 text-[#031d1f] hover:bg-emerald-400"
                : "bg-teal-600 text-white hover:bg-teal-500"
          }`}
        >
          <BrainCircuit size={18} />
          {loading ? "Generating questions…" : "Generate questions"}
        </button>
      )}
    </div>
  );
}
