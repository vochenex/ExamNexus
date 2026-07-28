/**
 * Vercel serverless entry for the Express backend.
 * All /api/* traffic is rewritten here; createApp strips the /api prefix.
 *
 * Root package.json is "type": "module", so this folder keeps its own
 * package.json with "type": "commonjs" and we force backend node_modules
 * onto the resolve path (deps live under backend/, not the repo root).
 */
const path = require("path");
const Module = require("module");

const backendRoot = path.join(__dirname, "..", "backend");
const backendNodeModules = path.join(backendRoot, "node_modules");
const originalNodeModulePaths = Module._nodeModulePaths;

Module._nodeModulePaths = function patchedNodeModulePaths(from) {
  const paths = originalNodeModulePaths.call(this, from);
  if (!paths.includes(backendNodeModules)) {
    paths.unshift(backendNodeModules);
  }
  return paths;
};

let app;
try {
  const createApp = require(path.join(backendRoot, "createApp.js"));
  app = typeof createApp === "function" ? createApp() : createApp;
} catch (err) {
  console.error("ExamNexus API boot failed:", err);
  const express = require("express");
  app = express();
  app.use((req, res) => {
    res.status(500).json({
      ok: false,
      error: "API failed to start",
      detail: String(err?.message || err),
    });
  });
}

module.exports = app;
