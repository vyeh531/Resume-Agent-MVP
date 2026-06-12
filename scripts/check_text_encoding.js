"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SCAN_TARGETS = [
  "app",
  "public",
  "src",
  "services",
  "scripts",
  "docs",
  "README.md",
  "ATS-SETUP.md",
  "database.js",
];

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
]);

const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "logos",
]);

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const SUSPICIOUS_PATTERNS = [
  { name: "replacement character", regex: /\uFFFD/g },
  { name: "latin1 mojibake marker", regex: /[\u00C3\u00C2]/g },
  { name: "emoji mojibake marker", regex: /\u00F0\u0178/g },
  { name: "utf8 punctuation mojibake", regex: /\u00E2[\u0080-\u00BF\u20AC\u2018-\u201D\u2020-\u2026]/g },
  { name: "chinese utf8 mojibake", regex: /[\u00E5\u00E6\u00E7\u00E8\u00E9][\u0080-\u00BF\u0160\u0152\u017D\u201C-\u201D\u20AC]/g },
];

function shouldSkipDirectory(dirPath) {
  const name = path.basename(dirPath);
  if (EXCLUDED_DIRS.has(name)) return true;
  return path.relative(ROOT, dirPath).split(path.sep).includes("logos");
}

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function walk(targetPath, files) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    if (shouldSkipDirectory(targetPath)) return;
    for (const entry of fs.readdirSync(targetPath)) {
      walk(path.join(targetPath, entry), files);
    }
    return;
  }
  if (!stat.isFile() || !isTextFile(targetPath) || stat.size > MAX_FILE_BYTES) return;
  files.push(targetPath);
}

function lineInfo(source, index) {
  const before = source.slice(0, index);
  const line = before.split(/\r?\n/).length;
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  const lineEnd = source.indexOf("\n", index);
  const rawLine = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
  return {
    line,
    snippet: rawLine.trim().slice(0, 180),
  };
}

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const hits = [];
  for (const pattern of SUSPICIOUS_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(source))) {
      const info = lineInfo(source, match.index);
      hits.push({
        file: path.relative(ROOT, filePath).replace(/\\/g, "/"),
        line: info.line,
        type: pattern.name,
        match: match[0],
        snippet: info.snippet,
      });
    }
  }
  return hits;
}

const files = [];
for (const target of SCAN_TARGETS) {
  walk(path.join(ROOT, target), files);
}

const findings = files.flatMap(scanFile);

if (findings.length > 0) {
  console.error("Potential text encoding corruption found:");
  for (const finding of findings) {
    console.error(
      `${finding.file}:${finding.line} [${finding.type}] ${JSON.stringify(finding.match)} in ${JSON.stringify(finding.snippet)}`
    );
  }
  process.exit(1);
}

console.log(`Text encoding check passed (${files.length} files scanned).`);
