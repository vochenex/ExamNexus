/**
 * Vercel serverless entry for the ExamNexus Express API.
 * Public URL: https://<project>.vercel.app/api/...
 */
const { createApp } = require("../backend/createApp");

const app = createApp();

function stripApiPrefix(req) {
  const url = req.url || "/";
  if (url === "/api") {
    req.url = "/";
    return;
  }
  if (url.startsWith("/api?")) {
    req.url = `/${url.slice(4)}`;
    return;
  }
  if (url.startsWith("/api/")) {
    req.url = url.slice(4) || "/";
  }
}

module.exports = (req, res) => {
  stripApiPrefix(req);
  return app(req, res);
};
