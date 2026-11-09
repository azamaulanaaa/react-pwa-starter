import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

// Initial JavaScript gzip budget.
//
// Measured on 2026-11-09 at 274,429 bytes with Vite 8.3.5.
// The budget adds 15 percent: ceil(274429 * 1.15) = 315,594 bytes.
const BUDGET_BYTES = 315_594;

const DIST_DIR = fileURLToPath(new URL("../dist/", import.meta.url));
const FORBIDDEN_PATTERN = /vendor-lexical|markdown-editor|editor/i;

/** Stops the check with one clear message. */
function fail(message) {
  console.error(`Bundle check failed: ${message}`);
  process.exit(1);
}

/** Returns the initial scripts and module preloads from the HTML. */
function findInitialEntries(html) {
  const entries = [];

  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const isModuleScript =
      /^<script\b/i.test(tag) && /\btype\s*=\s*["']module["']/i.test(tag);
    const isModulePreload =
      /^<link\b/i.test(tag) && /\brel\s*=\s*["']modulepreload["']/i.test(tag);

    if (!isModuleScript && !isModulePreload) continue;

    const pathMatch = tag.match(/\b(?:src|href)\s*=\s*["']([^"']+)["']/i);
    if (pathMatch) entries.push(pathMatch[1]);
  }

  return [...new Set(entries)];
}

const indexPath = join(DIST_DIR, "index.html");

if (!existsSync(indexPath)) {
  fail('dist/index.html is missing. Run "npm run build" first.');
}

const entries = findInitialEntries(readFileSync(indexPath, "utf8"));

if (entries.length === 0) {
  fail("dist/index.html has no initial module scripts.");
}

const forbidden = entries.filter((entry) => FORBIDDEN_PATTERN.test(entry));

if (forbidden.length > 0) {
  fail(
    `The initial load includes editor code:\n${forbidden
      .map((entry) => `  ${entry}`)
      .join("\n")}`,
  );
}

const rows = [];
let totalRaw = 0;
let totalGzip = 0;

for (const entry of entries) {
  const cleanPath = entry.split(/[?#]/, 1)[0];

  if (/^[a-z]+:\/\//i.test(cleanPath) || cleanPath.startsWith("//")) {
    fail(`Cannot measure an external entry: ${entry}`);
  }

  const filePath = join(DIST_DIR, cleanPath.replace(/^\//, ""));

  if (!existsSync(filePath)) {
    fail(`The initial entry is missing: ${entry}`);
  }

  const raw = readFileSync(filePath);
  const gzip = gzipSync(raw).length;

  totalRaw += raw.length;
  totalGzip += gzip;
  rows.push({ entry, raw: raw.length, gzip });
}

const fileWidth = Math.max(...rows.map((row) => row.entry.length), 4);

console.log("Initial bundle:");
console.log(
  `${"file".padEnd(fileWidth)}  ${"raw".padStart(12)}  ${"gzip".padStart(12)}`,
);

for (const row of rows) {
  console.log(
    `${row.entry.padEnd(fileWidth)}  ${String(row.raw).padStart(12)}  ${String(
      row.gzip,
    ).padStart(12)}`,
  );
}

console.log(
  `${"total".padEnd(fileWidth)}  ${String(totalRaw).padStart(12)}  ${String(
    totalGzip,
  ).padStart(12)}`,
);
console.log(`Budget: ${BUDGET_BYTES.toLocaleString("en-US")} gzip bytes.`);

if (totalGzip > BUDGET_BYTES) {
  fail(
    `The initial gzip size is ${totalGzip.toLocaleString(
      "en-US",
    )} bytes. It is over the budget by ${(
      totalGzip - BUDGET_BYTES
    ).toLocaleString("en-US")} bytes.`,
  );
}

console.log("Bundle check passed.");
