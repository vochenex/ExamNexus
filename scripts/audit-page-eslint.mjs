import { spawnSync } from "node:child_process";
import path from "node:path";

const targets = [
  "src/pages",
  "src/components/ExamNexusAuth.jsx",
  "src/layouts/DashboardLayout.jsx",
  "src/layouts/AdminLayout.jsx",
  "src/guards/ProtectedRoute.jsx",
  "src/components/AdminRouteGuard.jsx",
];

const eslintCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  eslintCmd,
  [
    "eslint",
    ...targets,
    "--rule",
    "no-undef: error",
    "--no-error-on-unmatched-pattern",
    "--format",
    "unix",
  ],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  }
);

const output = `${result.stdout || ""}${result.stderr || ""}`;
const undefLines = output
  .split(/\r?\n/)
  .filter((line) => line.includes("no-undef") || line.includes("is not defined"));

if (undefLines.length) {
  console.log("UNDEFINED SYMBOL AUDIT");
  for (const line of undefLines) console.log(line);
  process.exit(1);
}

console.log("OK: no undefined symbols in routed modules");
process.exit(0);
