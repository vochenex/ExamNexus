require("dotenv").config();
const { getAiServiceStatus } = require("../lib/aiProvider");
const { requestSingleAiQuestion } = require("../lib/assessmentAiGenerator");

async function main() {
  const status = await getAiServiceStatus();
  console.log("status:", status);

  const started = Date.now();
  const result = await requestSingleAiQuestion({
    topicPrompt: "One multiple choice question about photosynthesis for grade 9",
    format: "multiple_choice",
    difficulty: "easy",
    stepIndex: 0,
    totalSteps: 1,
  });

  const elapsedSec = Math.round((Date.now() - started) / 1000);
  console.log("elapsed_seconds:", elapsedSec);
  console.log("question:", result.question?.question?.slice(0, 120));
  console.log("type:", result.question?.type);
}

main().catch((err) => {
  console.error("failed:", err.message);
  process.exit(1);
});
