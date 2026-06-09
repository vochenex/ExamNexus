const fs = require("fs");
const path = require("path");

const replacements = [
  [/bg-\[#c3f0e8\]/g, "en-bg-page"],
  [/bg-\[#dff8f3\]/g, "en-bg-surface"],
  [/bg-\[#f4fffc\]/g, "en-bg-input"],
  [/border-emerald-200 bg-white shadow/g, "border-emerald-200/80 en-bg-elevated shadow"],
  [/border-emerald-200 bg-white/g, "border-emerald-200/80 en-bg-elevated"],
  [/border-emerald-100 bg-white/g, "border-emerald-100 en-bg-elevated"],
  [/border-emerald-300 bg-white/g, "border-emerald-300/80 en-bg-elevated"],
  [/border-cyan-300 bg-white/g, "border-cyan-300/80 en-bg-elevated"],
  [/border-cyan-200 bg-white/g, "border-cyan-200/80 en-bg-elevated"],
  [/border-red-200 bg-white/g, "border-red-200/80 en-bg-elevated"],
  [/border-red-300 bg-white/g, "border-red-300/80 en-bg-elevated"],
  [/border-red-400 bg-white/g, "border-red-400/80 en-bg-elevated"],
  [/border-amber-200 bg-white/g, "border-amber-200/80 en-bg-elevated"],
  [/border-amber-300 bg-white/g, "border-amber-300/80 en-bg-elevated"],
  [/bg-white border border-emerald/g, "en-bg-elevated border border-emerald"],
  [/bg-white border-emerald/g, "en-bg-elevated border-emerald"],
  [/bg-white text-gray-900/g, "en-bg-elevated text-gray-900"],
  [/bg-white text-teal/g, "en-bg-elevated text-teal"],
  [/bg-white text-gray-700/g, "en-bg-elevated text-gray-700"],
  [/bg-white text-gray-600/g, "en-bg-elevated text-gray-600"],
  [/bg-white text-cyan/g, "en-bg-elevated text-cyan"],
  [/bg-white text-red/g, "en-bg-elevated text-red"],
  [/bg-white text-amber/g, "en-bg-elevated text-amber"],
  [/bg-white\/90 shadow/g, "en-bg-surface-soft shadow"],
  [/bg-white\/90/g, "en-bg-surface-soft"],
  [/bg-white\/80/g, "en-bg-elevated-soft"],
  [/bg-white\/70/g, "en-bg-elevated-soft"],
  [/bg-white\/50/g, "en-bg-muted"],
  [/hover:bg-emerald-50\/80/g, "en-hover"],
  [/hover:bg-emerald-50\/50/g, "en-hover"],
  [/hover:bg-emerald-50/g, "en-hover"],
  [/hover:bg-white\/70/g, "en-hover"],
  [/hover:bg-white/g, "en-hover"],
  [/bg-emerald-100/g, "en-bg-skeleton"],
  [/bg-white shadow/g, "en-bg-elevated shadow"],
  [/bg-white border border-red/g, "en-bg-elevated border border-red"],
  [/bg-white border border-cyan/g, "en-bg-elevated border border-cyan"],
  [/bg-white border border-amber/g, "en-bg-elevated border border-amber"],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== "node_modules") walk(p, files);
    else if (/\.(jsx|js)$/.test(ent.name) && !p.includes("soften-light-bg")) files.push(p);
  }
  return files;
}

let changed = 0;
for (const file of walk(path.join(__dirname, "..", "src"))) {
  let src = fs.readFileSync(file, "utf8");
  const orig = src;
  for (const [re, rep] of replacements) src = src.replace(re, rep);
  if (src !== orig) {
    fs.writeFileSync(file, src);
    changed++;
    console.log("updated:", path.relative(process.cwd(), file));
  }
}
console.log("files changed:", changed);
