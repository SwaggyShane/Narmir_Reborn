#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".html",
  ".css",
  ".json",
  ".yml",
  ".yaml",
  ".ps1",
  ".sh",
  ".txt",
]);

const SUSPICIOUS_PATTERNS = [
  /\u00C3[\u0080-\u00BF]/,
  /\u00C2[\u0080-\u00BF]/,
  /\u00E2[\u0080-\u00BF]/,
  /\u00EF\u00BF\u00BD/,
];
// Note: a bare /\u00B7/ (middle dot) pattern used to be listed here too, but
// it matched *any* correctly-encoded standalone "\u00B7" character (e.g. a
// deliberate " \u00B7 " list separator), not just corruption. The actual mojibake
// artifact for a middle dot is "\u00C2\u00B7" (U+00C2 U+00B7) \u2014 already caught by the
// /\u00C2[\u0080-\u00BF]/ pattern above, since \u00B7 falls in that
// continuation-byte range. Removing the bare pattern loses no real
// detection coverage, only the false positives on legitimate Unicode.
// Found 2026-07-16: blocked a commit on pre-existing, correctly-encoded
// "\uD83D\uDCDC ... \u00B7 ..." strings in game/magic.js that had nothing to do with the
// change being committed.

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

function getStagedFiles() {
  return runGit(["diff", "--cached", "--name-only", "--diff-filter=ACM"])
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getTrackedFiles() {
  return runGit(["ls-files"])
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getFilesChangedSince(baseRef) {
  return runGit(["diff", "--name-only", "--diff-filter=ACM", `${baseRef}...HEAD`])
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readStagedFile(filePath) {
  try {
    return runGit(["show", `:${filePath}`]);
  } catch (err) {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8");
    }
    throw err;
  }
}

function findProblems(content) {
  const problems = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(line)) {
        problems.push({
          line: index + 1,
          token: pattern.toString(),
          excerpt: line.trim().slice(0, 220),
        });
        break;
      }
    }
  });

  return problems;
}

function getChangedLinesContent(filePath, baseRef) {
  const useBaseRef = baseRef && !baseRef.startsWith("-");
  const diffArgs = useBaseRef
    ? ["diff", "--unified=0", `${baseRef}...HEAD`, "--", filePath]
    : ["diff", "--cached", "--unified=0", "--", filePath];
  const diff = runGit(diffArgs);
  const lines = [];
  for (const line of diff.split(/\r?\n/)) {
    if (!line.startsWith("+") || line.startsWith("+++ ")) continue;
    lines.push(line.slice(1));
  }
  return lines.join("\n");
}

const sinceIndex = process.argv.indexOf("--since");
const scanAllTracked = process.argv.includes("--all");
let stagedFiles;

if (sinceIndex !== -1) {
  const baseRef = process.argv[sinceIndex + 1];
  if (!baseRef) {
    console.error("Missing ref after --since.");
    process.exit(1);
  }
  stagedFiles = getFilesChangedSince(baseRef);
} else {
  stagedFiles = scanAllTracked ? getTrackedFiles() : getStagedFiles();
}
const failures = [];
const SELF_PATH = path.normalize("scripts/check-text-encoding.js");

for (const filePath of stagedFiles) {
  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) continue;
  if (path.normalize(filePath) === SELF_PATH) continue;

  let content;
  if (sinceIndex !== -1) {
    content = getChangedLinesContent(filePath, process.argv[sinceIndex + 1]);
  } else if (scanAllTracked) {
    content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  } else {
    content = readStagedFile(filePath);
  }

  const problems = findProblems(content);
  if (problems.length > 0) {
    failures.push({ filePath, problems });
  }
}

if (failures.length > 0) {
  console.error("Potential text encoding issues detected:\n");
  for (const failure of failures) {
    console.error(`- ${failure.filePath}`);
    for (const problem of failure.problems.slice(0, 10)) {
      console.error(`  line ${problem.line}: ${problem.excerpt}`);
    }
    if (failure.problems.length > 10) {
      console.error(`  ... and ${failure.problems.length - 10} more matches`);
    }
  }
  process.exit(1);
}
