import { useEffect, useMemo, useRef, useState } from "react";
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
  classifyAssessmentDocument,
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

function parseRawQuestionCount(value) {
  if (value === "" || value == null) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

/** Valid usable count for API calls (null if empty/invalid/out of range). */
function parseValidQuestionCount(value) {
  const parsed = parseRawQuestionCount(value);
  if (parsed == null || parsed < MIN_QUESTIONS || parsed > MAX_QUESTIONS) return null;
  return parsed;
}

function questionCountWarning(value) {
  if (value === "" || value == null) {
    return "Enter how many questions to generate (1–150).";
  }
  const parsed = parseRawQuestionCount(value);
  if (parsed == null) {
    return "Enter how many questions to generate (1–150).";
  }
  if (parsed < MIN_QUESTIONS) {
    return `Enter at least ${MIN_QUESTIONS} question.`;
  }
  if (parsed > MAX_QUESTIONS) {
    return `Maximum is ${MAX_QUESTIONS} questions. Lower the count to generate.`;
  }
  return "";
}

function normalizeErrorMessage(error, fallback = "AI generation failed.") {
  if (!error) return fallback;
  if (error?.name === "AbortError") return "";
  if (typeof error === "string") return error || fallback;
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

function formatDocumentKind(kind) {
  const value = String(kind || "study_material").replace(/_/g, " ");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function fileKey(file, index) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

/** Match classified roles back onto the current File list (by name, then index). */
function resolveFilesByRole(files, analysisFiles, wantQuestionnaire) {
  const list = Array.isArray(files) ? files : [];
  const meta = Array.isArray(analysisFiles) ? analysisFiles : [];
  const matched = [];
  const used = new Set();

  for (const item of meta) {
    if (Boolean(item?.isQuestionnaire) !== Boolean(wantQuestionnaire)) continue;

    let index = list.findIndex(
      (file, i) => !used.has(i) && file.name === item.name
    );
    if (index < 0 && Number.isFinite(item.index) && !used.has(item.index)) {
      index = item.index;
    }
    if (index < 0 || index >= list.length || used.has(index)) continue;
    used.add(index);
    matched.push(list[index]);
  }

  return matched;
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
  const [panelError, setPanelError] = useState("");
  const [panelNotice, setPanelNotice] = useState("");
  const [prompt, setPrompt] = useState("");
  const [questionCount, setQuestionCount] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [selectedFormats, setSelectedFormats] = useState(() => [...DEFAULT_AI_FORMATS]);
  const [files, setFiles] = useState([]);
  const [optionsOpen, setOptionsOpen] = useState(true);
  const [documentAnalysis, setDocumentAnalysis] = useState(null);
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const fileInputRef = useRef(null);

  const reportError = (message) => {
    const text = String(message || "").trim();
    setPanelError(text);
    setPanelNotice("");
  };

  const clearPanelMessages = () => {
    setPanelError("");
    setPanelNotice("");
    if (onClearError) onClearError();
  };

  useEffect(() => {
    let cancelled = false;

    fetchAssessmentAiStatus().then((status) => {
      if (!cancelled) {
        setAiReady(status);
      }
    });

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setDocumentAnalysis(null);
    setPanelError("");
    setPanelNotice("");
  }, [files, mode]);

  const promptHints = useMemo(() => {
    if (mode !== "prompt" || !prompt.trim()) return null;
    return parsePromptPreferences(prompt);
  }, [mode, prompt]);

  const formatHint = useMemo(() => {
    if (selectedFormats.length === 0) {
      return "Select at least one question format.";
    }
    if (promptHints?.formats?.length) {
      return `Prompt overrides formats to: ${promptHints.formats
        .map((value) => AI_FORMAT_OPTIONS.find((item) => item.value === value)?.label || value)
        .join(", ")}`;
    }
    return `AI may mix: ${selectedFormats
      .map((value) => AI_FORMAT_OPTIONS.find((item) => item.value === value)?.label || value)
      .join(", ")}`;
  }, [selectedFormats, promptHints]);

  const showDocumentOptions =
    mode === "document" &&
    documentAnalysis &&
    (documentAnalysis.isQuestionnaire === false ||
      documentAnalysis.mixed ||
      documentAnalysis.sourcePending);

  const waitingForSourceGenerate =
    Boolean(documentAnalysis?.sourcePending) &&
    Boolean(documentAnalysis?.questionnaireDone);

  const countWarningRaw = questionCountWarning(questionCount);
  const resolvedQuestionCount = parseValidQuestionCount(questionCount);
  const countWarning =
    countWarningRaw.startsWith("Enter how many") &&
    mode === "prompt" &&
    promptHints?.questionCount
      ? ""
      : countWarningRaw;

  const toggleFormat = (value) => {
    setSelectedFormats((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((item) => item !== value);
        return next.length ? next : prev;
      }
      return [...prev, value];
    });
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []).filter(Boolean);
    if (!incoming.length) return;
    setFiles((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        const duplicate = next.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified
        );
        if (!duplicate) next.push(file);
      }
      return next.slice(0, 12);
    });
    setDocumentAnalysis(null);
    clearPanelMessages();
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setDocumentAnalysis(null);
    clearPanelMessages();
  };

  const runGeneration = async (generator, startOptions = undefined) => {
    if (disabled || loading || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const latestStatus = await fetchAssessmentAiStatus();
      setAiReady(latestStatus);

      if (!latestStatus.configured) {
        const message =
          latestStatus.error ||
          "AI is not ready. Add GEMINI_API_KEY to backend/.env, then restart the backend.";
        reportError(message);
        onError?.(message);
        return;
      }

      if (onGenerationStart) {
        const startResult = await onGenerationStart(startOptions);
        if (
          startResult === false ||
          startResult?.mode === "cancel" ||
          startResult == null
        ) {
          return;
        }
      }

      clearPanelMessages();

      const payload = await generator({
        onProgress,
        onQuestionGenerated,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const notice = String(payload?.meta?.warning || payload?.panelNotice || "").trim();
      if (notice) setPanelNotice(notice);

      onGenerated?.(payload);
    } catch (error) {
      if (error?.name === "AbortError") {
        onProgress?.(null);
        return;
      }
      const message = normalizeErrorMessage(error);
      if (message) {
        reportError(message);
        onError?.(message);
      }
      onProgress?.(null);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const handlePromptGenerate = () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      reportError("Describe the topic, skills, or content for the AI to generate.");
      return;
    }

    if (selectedFormats.length === 0) {
      reportError("Select at least one question format.");
      return;
    }

    const hints = parsePromptPreferences(trimmed);
    const count = resolvedQuestionCount || hints.questionCount;
    if (!count) {
      reportError("Enter how many questions to generate (1–150), or include a count in your prompt.");
      return;
    }
    if (countWarning) {
      reportError(countWarning);
      return;
    }

    runGeneration(({ onProgress, onQuestionGenerated, signal }) =>
      generateAssessmentFromPrompt({
        prompt: trimmed,
        formats: selectedFormats,
        questionCount: count,
        difficulty,
        onProgress,
        onQuestionGenerated,
        signal,
      })
    );
  };

  const handleDocumentClassifyOrGenerate = () => {
    if (!files.length) {
      reportError("Choose a PDF, Word (.docx), or PowerPoint (.pptx) file first.");
      return;
    }

    // Phase 2: generate from source / study material (options apply only here).
    if (showDocumentOptions && (!documentAnalysis?.mixed || waitingForSourceGenerate)) {
      if (countWarning || !resolvedQuestionCount) {
        reportError(countWarning || "Enter how many questions to generate (1–150).");
        return;
      }
      if (selectedFormats.length === 0) {
        reportError("Select at least one question format.");
        return;
      }

      const sourceFiles = documentAnalysis?.mixed
        ? resolveFilesByRole(files, documentAnalysis.files, false)
        : files;

      if (!sourceFiles.length) {
        reportError(
          "No source/study files found to generate from. Re-analyze after confirming one file is a study guide (not a questionnaire)."
        );
        return;
      }

      runGeneration(
        ({ onProgress, onQuestionGenerated, signal }) =>
          generateAssessmentFromDocument({
            files: sourceFiles,
            questionCount: resolvedQuestionCount,
            difficulty,
            formats: selectedFormats,
            isQuestionnaire: false,
            onProgress,
            onQuestionGenerated,
            signal,
          }).then((payload) => {
            setDocumentAnalysis((prev) =>
              prev
                ? {
                    ...prev,
                    sourcePending: false,
                    questionnaireDone: true,
                  }
                : prev
            );
            return {
              ...payload,
              meta: {
                ...(payload.meta || {}),
                // Keep warning local to this panel; do not bubble to page banner.
                warning: undefined,
              },
              panelNotice:
                payload?.meta?.warning ||
                (documentAnalysis?.mixed
                  ? "Source questions added below the questionnaire items."
                  : ""),
            };
          }),
        // Always append after a mixed questionnaire pass so we never wipe those items.
        waitingForSourceGenerate || documentAnalysis?.mixed
          ? { preferredMode: "append" }
          : undefined
      );
      return;
    }

    // Phase 1: classify. Mixed → show source options + convert questionnaires now.
    runGeneration(async ({ onProgress, onQuestionGenerated, signal }) => {
      onProgress?.({ phase: "reading", current: 0, total: 1, percent: 8, status: "classifying" });
      const classification = await classifyAssessmentDocument({ files, signal });

      if (classification.mixed) {
        setDocumentAnalysis({
          ...classification,
          isQuestionnaire: false,
          sourcePending: true,
          questionnaireDone: false,
        });
        setPanelNotice(
          "Mixed upload detected. Converting questionnaire files now. Count/difficulty/formats below apply only to the study/source file afterward."
        );

        const questionnaireFiles = resolveFilesByRole(
          files,
          classification.files,
          true
        );

        if (!questionnaireFiles.length) {
          throw new Error("Could not locate the questionnaire file after classification.");
        }

        onProgress?.({
          phase: "structuring",
          current: 0,
          total: 1,
          percent: 18,
          status: "converting",
        });

        const payload = await generateAssessmentFromDocument({
          files: questionnaireFiles,
          isQuestionnaire: true,
          onProgress,
          onQuestionGenerated,
          signal,
        });

        setDocumentAnalysis((prev) =>
          prev
            ? {
                ...prev,
                sourcePending: true,
                questionnaireDone: true,
              }
            : {
                ...classification,
                isQuestionnaire: false,
                sourcePending: true,
                questionnaireDone: true,
              }
        );

        return {
          ...payload,
          mixedPhase: "questionnaire_done",
          sourcePending: true,
          panelNotice:
            "Questionnaire converted. Set count/difficulty/formats for the study guide, then click Generate from source.",
          meta: {
            ...(payload.meta || {}),
            warning: undefined,
          },
        };
      }

      if (classification.isQuestionnaire) {
        setDocumentAnalysis(classification);
        onProgress?.({
          phase: "structuring",
          current: 0,
          total: 1,
          percent: 20,
          status: "converting",
        });
        const questionnaireFiles = resolveFilesByRole(
          files,
          classification.files,
          true
        );
        return generateAssessmentFromDocument({
          files: questionnaireFiles.length ? questionnaireFiles : files,
          isQuestionnaire: true,
          onProgress,
          onQuestionGenerated,
          signal,
        });
      }

      setDocumentAnalysis({
        ...classification,
        sourcePending: false,
        questionnaireDone: false,
      });
      onProgress?.(null);
      return {
        success: true,
        classifiedOnly: true,
        ...classification,
        panelNotice:
          "Study/source material detected. Set count, difficulty, and formats, then generate questions.",
      };
    });
  };

  const checkboxClass = `rounded border ${
    theme === "dark" ? "border-white/20 bg-white/5" : "border-emerald-200 bg-white"
  }`;

  const labelClass = `mb-2 block text-xs font-semibold uppercase tracking-wide ${
    theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
  }`;

  const promptNeedsCount =
    mode === "prompt" &&
    !promptHints?.questionCount &&
    resolvedQuestionCount == null;
  const documentNeedsCount =
    showDocumentOptions &&
    (!documentAnalysis?.mixed || waitingForSourceGenerate) &&
    resolvedQuestionCount == null;
  const generateDisabledByCount =
    (mode === "prompt" && promptNeedsCount) ||
    (showDocumentOptions && documentNeedsCount);

  const renderCountDifficulty = () => (
    <div
      className={`rounded-xl border p-4 ${
        theme === "dark"
          ? "border-white/10 bg-white/[0.03]"
          : "border-emerald-200/80 en-bg-elevated-soft en-panel-glow"
      }`}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
        <div className="min-w-0">
          <label className={labelClass}>Number of questions</label>
          <input
            type="number"
            min={MIN_QUESTIONS}
            max={MAX_QUESTIONS}
            disabled={disabled || loading}
            className={assessmentInputClass(theme)}
            value={questionCount}
            placeholder="e.g. 20"
            onFocus={(event) => event.target.select()}
            onChange={(event) => {
              const next = event.target.value;
              if (next === "") {
                setQuestionCount("");
                return;
              }
              const parsed = Number(next);
              if (Number.isFinite(parsed)) {
                // Keep typed value even when > MAX — warn + disable Generate.
                setQuestionCount(Math.floor(parsed));
              }
            }}
            onBlur={() => {
              // Stay blank when empty so faculty must enter a count (no default 0).
              if (questionCount === "" || questionCount == null) return;
              const parsed = Number(questionCount);
              if (!Number.isFinite(parsed) || parsed < 0) {
                setQuestionCount("");
              }
            }}
            aria-invalid={Boolean(countWarning)}
          />
          {countWarning ? (
            <p className="mt-2 text-xs font-medium text-red-500">{countWarning}</p>
          ) : (
            <p className={`mt-2 text-xs ${theme === "dark" ? "text-gray-500" : "en-text-muted"}`}>
              {MIN_QUESTIONS}–{MAX_QUESTIONS} items
            </p>
          )}
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
          <p className={`mt-2 text-xs ${theme === "dark" ? "text-gray-500" : "en-text-muted"}`}>
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            {mode === "prompt"
              ? " · Large sets generate in small rounds so hosted API timeouts are avoided"
              : ""}
          </p>
        </div>
      </div>
    </div>
  );

  const renderFormats = () => (
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
  );

  const documentButtonDisabled =
    disabled ||
    loading ||
    !files.length ||
    (aiReady && !aiReady.configured) ||
    (showDocumentOptions && generateDisabledByCount);

  const promptButtonDisabled =
    disabled || loading || (aiReady && !aiReady.configured) || generateDisabledByCount;

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
              ? "Upload one or more PDF, Word, or PowerPoint files. Each file is classified separately. Mixed questionnaire + source uploads convert questionnaires first, then let you generate from source files with options."
              : "Describe what you want assessed. If you name formats in the prompt (e.g. essay, MCQ), those override the checkboxes."}
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
            "AI is not ready. Add GEMINI_API_KEY (documents) and GROQ_API_KEY (prompts) to backend/.env, then restart the backend."}
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
          Prompts: {aiReady.promptProvider || "gemini"} · {aiReady.promptModel || aiReady.model || "—"}
          {" · "}
          Documents: {aiReady.documentProvider || "gemini"} ·{" "}
          {aiReady.documentModel || aiReady.model || "gemini-2.5-flash"}
        </p>
      )}

      {(panelError || panelNotice) && (
        <div
          role="status"
          className={`rounded-xl border p-3 text-sm ${
            panelError
              ? theme === "dark"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-red-300 bg-red-50 text-red-700"
              : theme === "dark"
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
                : "border-emerald-200 bg-emerald-50 text-teal-900"
          }`}
        >
          {panelError || panelNotice}
        </div>
      )}

      {mode === "document" ? (
        <div>
          <label className={labelClass}>Document file(s)</label>
          {files.length > 0 ? (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={fileKey(file, index)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    theme === "dark"
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <CheckCircle2 className="shrink-0 text-emerald-500" size={20} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {files.length > 1 ? `${index + 1}. ` : ""}
                      {file.name}
                    </p>
                    <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                      {(() => {
                        const fileMeta = Array.isArray(documentAnalysis?.files)
                          ? documentAnalysis.files.find((item) => item.index === index)
                          : null;
                        if (fileMeta?.isQuestionnaire) {
                          return "Questionnaire — converts as-is (options do not apply)";
                        }
                        if (fileMeta && fileMeta.isQuestionnaire === false) {
                          return waitingForSourceGenerate
                            ? "Source material — ready for options below"
                            : documentAnalysis?.sourcePending && !documentAnalysis?.questionnaireDone
                              ? "Source material — options below (questionnaire converting…)"
                              : `Source — ${formatDocumentKind(fileMeta.documentKind)}`;
                        }
                        if (documentAnalysis && files.length === 1) {
                          return documentAnalysis.isQuestionnaire
                            ? "Detected questionnaire — converting questions"
                            : `Detected ${formatDocumentKind(documentAnalysis.documentKind)} — set options below`;
                        }
                        return files.length > 1 ? "Will be classified on analyze" : "Ready to analyze";
                      })()}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={disabled || loading}
                    onClick={() => removeFile(index)}
                    className={`rounded-lg p-1.5 transition ${
                      theme === "dark"
                        ? "text-gray-400 hover:bg-white/10 hover:text-white"
                        : "text-gray-500 hover:bg-white hover:text-gray-800"
                    }`}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {files.length < 12 && (
                <button
                  type="button"
                  disabled={disabled || loading}
                  onClick={() => fileInputRef.current?.click()}
                  className={`text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50 ${
                    theme === "dark" ? "text-emerald-300" : "text-teal-700"
                  }`}
                >
                  Add another file
                </button>
              )}
            </div>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            disabled={disabled || loading}
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
            className={`${files.length ? "sr-only" : "block w-full text-sm"} ${
              theme === "dark" ? "text-gray-300" : "text-gray-700"
            }`}
          />
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

      {mode === "document" && documentAnalysis && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            theme === "dark"
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
              : "border-emerald-200 bg-emerald-50 text-teal-900"
          }`}
        >
          <p className="font-semibold">
            {documentAnalysis.mixed
              ? "Mixed upload detected"
              : documentAnalysis.isQuestionnaire
                ? "Questionnaire detected"
                : `${formatDocumentKind(documentAnalysis.documentKind)} detected`}
          </p>
          {documentAnalysis.summary ? (
            <p className={`mt-1 text-xs ${theme === "dark" ? "text-emerald-100/80" : "text-teal-800/90"}`}>
              {documentAnalysis.summary}
            </p>
          ) : null}
          {(documentAnalysis.mixed ||
            (!documentAnalysis.isQuestionnaire && showDocumentOptions)) && (
            <p className={`mt-2 text-xs ${theme === "dark" ? "text-emerald-100/70" : "text-teal-800/80"}`}>
              {documentAnalysis.mixed
                ? waitingForSourceGenerate
                  ? "Questionnaire questions are ready. Count, difficulty, and formats below apply only to source/study files — not to questionnaire files. Click Generate from source when ready."
                  : "Count, difficulty, and formats below apply only to source/study files and do not affect questionnaire files. Questionnaire questions are converting now; Generate will unlock again afterward for the source files."
                : "Choose item count, difficulty, and formats, then click Analyze document again to generate questions."}
            </p>
          )}
        </div>
      )}

      {mode === "prompt" && renderCountDifficulty()}
      {mode === "prompt" && renderFormats()}

      {showDocumentOptions && renderCountDifficulty()}
      {showDocumentOptions && renderFormats()}

      {mode === "document" ? (
        <button
          type="button"
          disabled={documentButtonDisabled}
          onClick={handleDocumentClassifyOrGenerate}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
            documentButtonDisabled
              ? "cursor-not-allowed opacity-60"
              : theme === "dark"
                ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                : "border-teal-500 bg-teal-50 text-teal-800 hover:bg-teal-100"
          }`}
        >
          <FileSearch size={18} />
          {loading
            ? documentAnalysis?.mixed && !documentAnalysis?.questionnaireDone
              ? "Converting questionnaire…"
              : showDocumentOptions
                ? "Generating questions…"
                : "Analyzing document…"
            : waitingForSourceGenerate
              ? "Generate from source"
              : showDocumentOptions
                ? "Generate questions"
                : "Analyze document"}
        </button>
      ) : (
        <button
          type="button"
          disabled={promptButtonDisabled}
          onClick={handlePromptGenerate}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            promptButtonDisabled
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
