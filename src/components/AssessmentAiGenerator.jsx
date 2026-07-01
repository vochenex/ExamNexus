import { useEffect, useMemo, useState } from "react";
import { FileUp, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import {
  AI_FORMAT_OPTIONS,
  DEFAULT_AI_FORMATS,
} from "../utils/aiQuestionMapper";
import {
  fetchAssessmentAiStatus,
  generateAssessmentFromDocument,
  generateAssessmentFromPrompt,
} from "../utils/assessmentAi";
import { assessmentInputClass } from "./QuestionBuilderCard";

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export default function AssessmentAiGenerator({
  mode,
  onGenerated,
  onError,
  disabled = false,
}) {
  const { theme } = useTheme();
  const [aiReady, setAiReady] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [questionCount, setQuestionCount] = useState(8);
  const [difficulty, setDifficulty] = useState("medium");
  const [selectedFormats, setSelectedFormats] = useState(() => [...DEFAULT_AI_FORMATS]);
  const [file, setFile] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchAssessmentAiStatus().then((status) => {
      if (!cancelled) {
        setAiReady(status);
        if (status.provider === "ollama") {
          setQuestionCount((current) => Math.min(current, 3));
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

    if (selectedFormats.length === 0) {
      onError?.("Select at least one question format.");
      return;
    }

    try {
      setLoading(true);
      setLoadingProgress(null);
      onError?.("");
      const payload = await generator((progress) => setLoadingProgress(progress));
      onGenerated?.(payload);
    } catch (error) {
      onError?.(error.message || "AI generation failed.");
    } finally {
      setLoading(false);
      setLoadingProgress(null);
    }
  };

  const handlePromptGenerate = () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      onError?.("Describe the topic, skills, or content for the AI to generate.");
      return;
    }

    runGeneration((onProgress) =>
      generateAssessmentFromPrompt({
        prompt: trimmed,
        formats: selectedFormats,
        questionCount,
        difficulty,
        additionalInstructions: additionalInstructions.trim(),
        onProgress,
      })
    );
  };

  const handleDocumentGenerate = () => {
    if (!file) {
      onError?.("Choose a PDF or Word (.docx) file first.");
      return;
    }

    runGeneration((onProgress) =>
      generateAssessmentFromDocument({
        file,
        formats: selectedFormats,
        questionCount,
        difficulty,
        additionalInstructions: additionalInstructions.trim(),
        onProgress,
      })
    );
  };

  const checkboxClass = `rounded border ${
    theme === "dark" ? "border-white/20 bg-white/5" : "border-emerald-200 bg-white"
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
              ? "Upload a PDF or Word file. AI reads the content, builds questions by format, and loads them for your review before publishing."
              : "Describe what you want assessed. AI drafts ready-to-review questions you can edit, schedule, and publish like a manual assessment."}
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
            "AI is not ready. Start Ollama on your laptop, pull a model (ollama pull llama3), then restart the backend."}
        </div>
      )}

      {aiReady?.configured && (
        <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Using {aiReady.provider === "openai" ? "OpenAI" : "Ollama"}
          {aiReady.model ? ` · ${aiReady.model}` : ""}
        </p>
      )}

      {mode === "document" ? (
        <div>
          <label
            className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
            }`}
          >
            Document file
          </label>
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={disabled || loading}
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              onError?.("");
            }}
            className={`block w-full text-sm ${
              theme === "dark" ? "text-gray-300" : "text-gray-700"
            }`}
          />
          {file && (
            <p className={`mt-2 text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Selected: {file.name}
            </p>
          )}
        </div>
      ) : (
        <div>
          <label
            className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
            }`}
          >
            What should the AI generate?
          </label>
          <textarea
            className={assessmentInputClass(theme)}
            rows={5}
            disabled={disabled || loading}
            placeholder="Example: Create 10 questions on cell division for Grade 10. Include multiple choice and identification. Focus on mitosis and meiosis."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>
      )}

      <div>
        <label
          className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
            theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
          }`}
        >
          Question formats
        </label>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
            }`}
          >
            Number of questions
          </label>
          <input
            type="number"
            min={1}
            max={40}
            disabled={disabled || loading}
            className={assessmentInputClass(theme)}
            value={questionCount}
            onChange={(event) =>
              setQuestionCount(Math.min(40, Math.max(1, Number(event.target.value) || 8)))
            }
          />
        </div>
        <div>
          <label
            className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
              theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
            }`}
          >
            Difficulty
          </label>
          <select
            disabled={disabled || loading}
            className={assessmentInputClass(theme)}
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            {DIFFICULTY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
            theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
          }`}
        >
          Additional instructions (optional)
        </label>
        <textarea
          className={assessmentInputClass(theme)}
          rows={2}
          disabled={disabled || loading}
          placeholder="Example: Avoid trick questions. Use Philippine context where possible."
          value={additionalInstructions}
          onChange={(event) => setAdditionalInstructions(event.target.value)}
        />
      </div>

      <button
        type="button"
        disabled={disabled || loading || (aiReady && !aiReady.configured && !aiReady.provider)}
        onClick={mode === "document" ? handleDocumentGenerate : handlePromptGenerate}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
          disabled || loading || (aiReady && !aiReady.configured)
            ? "cursor-not-allowed opacity-60"
            : theme === "dark"
              ? "bg-emerald-500 text-[#031d1f] hover:bg-emerald-400"
              : "bg-teal-600 text-white hover:bg-teal-500"
        }`}
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
        {loading
          ? loadingProgress
            ? `Generating question ${loadingProgress.current} of ${loadingProgress.total}…`
            : "Generating questions…"
          : "Generate questions for review"}
      </button>
      {loading && (
        <p className={`text-center text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          {loadingProgress
            ? "Ollama generates one question at a time on your laptop. Each step may take a few minutes."
            : "Local Ollama models can take several minutes, especially on the first run."}
        </p>
      )}
    </div>
  );
}
