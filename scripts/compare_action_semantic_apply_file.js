"use strict";

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const fs = require("fs");
const path = require("path");
const db = require("../database");

const fileArg = process.argv.find((arg) => arg.startsWith("--file="));
const WRITE_MISMATCH = process.argv.includes("--write-mismatch-file");
if (!fileArg) {
  console.error("Usage: node scripts/compare_action_semantic_apply_file.js --file=data/audit/...json");
  process.exit(1);
}

async function main() {
  const fullPath = path.resolve(process.cwd(), fileArg.slice("--file=".length));
  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  const rows = Array.isArray(parsed) ? parsed : parsed.rows;
  const expected = new Map(rows.map((row) => [Number(row.id), row.proposed?.action_semantic_review_status || ""]));
  const pool = db.getPool();
  const { rows: dbRows } = await pool.query(`
    SELECT id, action_semantic_review_status
      FROM segments
     WHERE retrieval_scope = 'resume_edit'
     ORDER BY id
  `);
  const mismatches = dbRows
    .map((row) => ({
      id: Number(row.id),
      expected: expected.get(Number(row.id)) || "(missing)",
      actual: row.action_semantic_review_status || "",
    }))
    .filter((row) => row.expected !== row.actual);
  const byPair = mismatches.reduce((acc, row) => {
    const key = `${row.expected}->${row.actual}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  let mismatchPath = "";
  if (WRITE_MISMATCH && mismatches.length) {
    const expectedById = new Map(rows.map((row) => [Number(row.id), row]));
    const mismatchRows = mismatches.map((row) => expectedById.get(row.id)).filter(Boolean);
    mismatchPath = fullPath.replace(/\.json$/, "_mismatches.json");
    fs.writeFileSync(mismatchPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      sourceFile: fullPath,
      rows: mismatchRows,
    }, null, 2), "utf8");
  }
  console.log(JSON.stringify({
    expectedRows: rows.length,
    expectedUnique: expected.size,
    dbRows: dbRows.length,
    mismatches: mismatches.length,
    byPair,
    mismatchPath,
    sample: mismatches.slice(0, 40),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
