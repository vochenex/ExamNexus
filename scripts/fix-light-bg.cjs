const fs = require("fs");
const path = require("path");

const fixes = [
  [/en-hover\/10/g, "hover:bg-white/10"],
  [/en-hover\/15/g, "hover:bg-white/15"],
  [/en-hover\/20/g, "hover:bg-white/20"],
  [/en-hover\/5/g, "hover:bg-white/5"],
  [/en-hover\/\[0\.06\]/g, "hover:bg-white/[0.06]"],
  [/en-hover0\/5/g, "hover:bg-emerald-500/5"],
  [/en-bg-surface\/10/g, "bg-[#dff8f3]/10"],
  [/en-bg-surface\/5/g, "bg-[#dff8f3]/5"],
  [/hover:en-bg-elevated-soft/g, "en-hover"],
  [/: "bg-white"}/g, ': "en-bg-surface"}'],
  [/bg-white border-cyan/g, "en-bg-elevated border-cyan"],
  [/bg-white border-yellow/g, "en-bg-elevated border-yellow"],
  [/bg-white border-purple/g, "en-bg-elevated border-purple"],
  [/border-amber-100 bg-white/g, "border-amber-100 en-bg-elevated"],
  [/: "bg-emerald-50"/g, ': "en-bg-muted"'],
  [/bg-emerald-50\/80/g, "en-bg-muted"],
  [/bg-emerald-50\/50/g, "en-bg-muted"],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== "node_modules") walk(p, files);
    else if (/\.(jsx|js)$/.test(ent.name)) files.push(p);
  }
  return files;
}

let changed = 0;
for (const file of walk(path.join(__dirname, "..", "src"))) {
  let src = fs.readFileSync(file, "utf8");
  const orig = src;
  for (const [re, rep] of fixes) src = src.replace(re, rep);
  if (src !== orig) {
    fs.writeFileSync(file, src);
    changed++;
    console.log("fixed:", path.relative(process.cwd(), file));
  }
}
console.log("files fixed:", changed);
