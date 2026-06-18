import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const sourceRoots = ["src"];
const strictPaths = [
  "src/app/globals.css",
  "src/components/app-nav.tsx",
  "src/components/ui",
];

const strictPatterns = [
  { label: "lucide import", re: /from\s+["']lucide-react["']/ },
  { label: "large radius", re: /rounded-(xl|2xl|3xl)/ },
  { label: "shadow", re: /\bshadow(?:-|")/ },
  { label: "decorative gradient", re: /\bbg-gradient\b|\bfrom-[^\s"]+|\bto-transparent\b/ },
];

const advisoryPatterns = [
  { label: "lucide import", re: /from\s+["']lucide-react["']/ },
  { label: "legacy radius", re: /rounded-(full|xl|2xl|3xl)/ },
  { label: "legacy neutral/accent color", re: /\b(?:bg|text|border|stroke|fill)-(?:neutral|sky|violet|emerald|rose|amber|white|black)-/ },
  { label: "shadow/gradient", re: /\bshadow(?:-|")|\bbg-gradient\b/ },
];

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    const rel = relative(root, path);
    if (rel.includes("node_modules") || rel.includes(".next")) continue;
    const st = statSync(path);
    if (st.isDirectory()) files.push(...walk(path));
    else if (/\.(tsx?|css)$/.test(entry)) files.push(path);
  }
  return files;
}

const files = sourceRoots.flatMap((p) => walk(join(root, p)));
const isStrict = (rel) => strictPaths.some((p) => rel === p || rel.startsWith(`${p}/`));

const strictHits = [];
const advisoryHits = [];

for (const file of files) {
  const rel = relative(root, file);
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (isStrict(rel)) {
      for (const p of strictPatterns) {
        if (p.re.test(line)) strictHits.push({ rel, line: idx + 1, label: p.label, text: line.trim() });
      }
    } else {
      for (const p of advisoryPatterns) {
        if (p.re.test(line)) advisoryHits.push({ rel, line: idx + 1, label: p.label, text: line.trim() });
      }
    }
  });
}

if (strictHits.length > 0) {
  console.error("Design check failed in the Apparatus boundary:");
  for (const hit of strictHits) {
    console.error(`- ${hit.rel}:${hit.line} ${hit.label}: ${hit.text}`);
  }
  process.exit(1);
}

console.log("Design check passed for the Apparatus boundary.");

if (advisoryHits.length > 0) {
  console.log(`Advisory: ${advisoryHits.length} legacy UI markers remain outside the strict boundary.`);
  for (const hit of advisoryHits.slice(0, 20)) {
    console.log(`- ${hit.rel}:${hit.line} ${hit.label}: ${hit.text}`);
  }
  if (advisoryHits.length > 20) {
    console.log(`- ...${advisoryHits.length - 20} more`);
  }
}
