/**
 * Vercel serverless entry for the Express backend.
 * All /api/* traffic is rewritten here; createApp strips the /api prefix.
 */
module.exports = require("../backend/server.js");
