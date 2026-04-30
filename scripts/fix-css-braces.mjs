// One-shot repair: insert missing closing braces in app/globals.css.
// Walks the file, tracks brace depth, inserts `}` whenever a new top-level
// selector / at-rule / section comment appears with depth still open.

import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { argv } from "node:process";

const inPath = argv[2] ?? "app/globals.css";
const outPath = argv[3] ?? inPath;
const dryRun = argv.includes("--dry");

const src = readFileSync(inPath, "utf8");
const lines = src.split("\n");
const out = [];
let depth = 0;
let inBlockComment = false;
let inserted = 0;

const stripCode = (line) => {
  let s = line;
  if (inBlockComment) {
    const end = s.indexOf("*/");
    if (end === -1) return "";
    s = s.slice(end + 2);
    inBlockComment = false;
  }
  // Strip inline /* ... */ pairs, including any trailing unterminated /*
  while (true) {
    const start = s.indexOf("/*");
    if (start === -1) break;
    const end = s.indexOf("*/", start + 2);
    if (end === -1) {
      s = s.slice(0, start);
      inBlockComment = true;
      break;
    }
    s = s.slice(0, start) + s.slice(end + 2);
  }
  // Strip strings: 'x' "x" — naive but adequate for CSS
  s = s.replace(/'(?:\\.|[^'\\])*'/g, "''");
  s = s.replace(/"(?:\\.|[^"\\])*"/g, '""');
  return s;
};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const codeBefore = stripCode(line); // also flips inBlockComment for this line
  const trimmed = line.replace(/^\s+/, "");
  const indent = line.length - trimmed.length;
  const prevLine = i > 0 ? lines[i - 1].trimEnd() : "";

  // A "new top-level construct" is a non-blank line at column 0 that begins a
  // selector, at-rule, universal selector, or section comment, and is not a
  // continuation of the previous selector list (which would end in `,`).
  const isTopLevelStart =
    indent === 0 &&
    trimmed.length > 0 &&
    !trimmed.startsWith("}") &&
    !prevLine.endsWith(",") &&
    /^([.#:&*\[@]|\/\*|[a-zA-Z])/.test(trimmed);

  if (isTopLevelStart && depth > 0) {
    while (depth > 0) {
      out.push("}");
      depth--;
      inserted++;
    }
  }

  out.push(line);

  // Update depth from this line's actual code (strings + comments stripped)
  for (const ch of codeBefore) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
}

// Close anything still open at EOF
while (depth > 0) {
  out.push("}");
  depth--;
  inserted++;
}

const result = out.join("\n");

// Sanity check
const o = (result.match(/\{/g) ?? []).length;
const c = (result.match(/\}/g) ?? []).length;
console.log(`braces after fix: ${o} { vs ${c} }  (diff ${o - c})`);
console.log(`inserted: ${inserted} closing braces`);
console.log(`lines: ${lines.length} -> ${out.length}`);

if (!dryRun) {
  if (outPath === inPath) copyFileSync(inPath, inPath + ".bak");
  writeFileSync(outPath, result);
  console.log(`wrote: ${outPath}`);
} else {
  console.log("(dry run — not writing)");
}
