/**
 * Vercel serverless entry for the Express backend.
 * All /api/* traffic is rewritten here; createApp strips the /api prefix.
 */
const createApp = require("../backend/createApp");

module.exports = createApp();
