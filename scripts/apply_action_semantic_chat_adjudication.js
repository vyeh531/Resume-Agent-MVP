"use strict";

const fs = require("fs");
const path = require("path");

const inputArg = process.argv.find((arg) => arg.startsWith("--file="));
if (!inputArg) {
  console.error("Usage: node scripts/apply_action_semantic_chat_adjudication.js --file=data/audit/action_semantic_full/action_semantic_full_....json");
  process.exit(1);
}

function loadRows(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const rows = Array.isArray(parsed) ? parsed : parsed.rows;
  if (!Array.isArray(rows)) throw new Error(`No rows found in ${filePath}`);
  return rows;
}

function adjudicate(row) {
  const issues = row.proposed?.action_semantic_review_issues || row.audit?.action_semantic_review_issues || [];
  const set = new Set(issues);
  const hardBlockIssues = [
    "raw_case_specific_in_raw_mode",
    "raw_requires_grounded_mode",
    "raw_requires_grounding_or_activation",
    "raw_domain_without_role_scope",
    "generalized_domain_leak",
    "generalized_case_leak",
    "missing_generalized_action",
  ];
  const blocked = hardBlockIssues.some((issue) => set.has(issue));
  if (blocked) {
    return {
      status: "blocked",
      confidence: 0.92,
      issues: [...new Set([...issues, "chat_semantic_blocked_until_action_governance_fix"])],
    };
  }
  if (set.has("precondition_sensitive_action")) {
    return {
      status: "approved",
      confidence: 0.82,
      issues: [...new Set([...issues, "runtime_resumefacts_precondition_required"])],
    };
  }
  return {
    status: "approved",
    confidence: 0.9,
    issues,
  };
}

function main() {
  const fullPath = path.resolve(process.cwd(), inputArg.slice("--file=".length));
  const rows = loadRows(fullPath);
  const reviewedAt = new Date().toISOString();
  const adjudicated = rows.map((row) => {
    const verdict = adjudicate(row);
    return {
      ...row,
      proposed: {
        ...(row.proposed || {}),
        action_semantic_review_status: verdict.status,
        action_semantic_review_source: "chat_semantic_review_v1",
        action_semantic_review_confidence: verdict.confidence,
        action_semantic_review_issues: verdict.issues,
        action_semantic_reviewed_at: reviewedAt,
      },
    };
  });
  const summary = adjudicated.reduce((acc, row) => {
    const status = row.proposed.action_semantic_review_status;
    acc.byStatus[status] = (acc.byStatus[status] || 0) + 1;
    for (const issue of row.proposed.action_semantic_review_issues || []) {
      acc.byIssue[issue] = (acc.byIssue[issue] || 0) + 1;
    }
    return acc;
  }, { rowCount: adjudicated.length, byStatus: {}, byIssue: {} });

  const outPath = fullPath.replace(/\.json$/, "_chat_adjudicated.json");
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: reviewedAt,
    sourceFile: fullPath,
    summary,
    rows: adjudicated,
  }, null, 2), "utf8");
  console.log(JSON.stringify({ outPath, summary }, null, 2));
}

main();
