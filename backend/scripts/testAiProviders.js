require("dotenv").config();
const { getAiServiceStatus, requestPromptChatCompletion } = require("../lib/aiProvider");

async function main() {
  const status = await getAiServiceStatus();
  console.log("Status:", JSON.stringify(status, null, 2));

  if (!status.configured) {
    process.exit(1);
  }

  const result = await requestPromptChatCompletion({
    temperature: 0,
    jsonMode: true,
    messages: [
      { role: "user", content: "Reply with JSON only: {\"ok\":true}" },
    ],
  });

  console.log("Prompt test:", result.provider, result.model, result.content.slice(0, 120));
}

main().catch((err) => {
  console.error("Failed:", err.statusCode, err.message);
  process.exit(1);
});
