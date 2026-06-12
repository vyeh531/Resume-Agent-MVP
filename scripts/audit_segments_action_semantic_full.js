"use strict";

require("dotenv").config({ path: ".env.local", override: true });
require("dotenv").config({ path: ".env", override: false });

const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const db = require("../database");
const semanticAudit = require("../services/actionSemanticAudit");

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const USE_LLM = argv.includes("--llm");
const ALL = argv.includes("--all");
const LIMIT = numberArg("--limit", APPLY || USE_LLM ? 0 : 300);
const OFFSET = numberArg("--offset", 0);
const BATCH_SIZE = Math.min(Math.max(numberArg("--batch-size", 20), 1), 50);
const APPLY_CHUNK_SIZE = Math.min(Math.max(numberArg("--apply-chunk-size", 200), 1), 1000);
const SCOPE = stringArg("--scope", "resume_edit");
const OUT_DIR = stringArg("--out-dir", path.join("data", "audit", "action_semantic_full"));
const MODEL = stringArg("--model", process.env.ACTION_SEMANTIC_AUDIT_MODEL || process.env.MENTOR_HUMANIZE_MODEL || "claude-haiku-4-5");
const APPLY_FILE = stringArg("--apply-file", "");

function numberArg(name, fallback) {
  const raw = argv.find((arg) => arg.startsWith(`${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.slice(name.length + 1));
  return Number.isFinite(value) ? value : fallback;
}

function stringArg(name, fallback) {
  const raw = argv.find((arg) => arg.startsWith(`${name}=`));
  return raw ? raw.slice(name.length + 1) : fallback;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function compact(value, max = 900) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

function splitBatches(rows, size) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function extractJsonArray(text) {
  const cleaned = String(text || "").replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`LLM response did not contain a JSON array: ${cleaned.slice(0, 300)}`);
  return JSON.parse(match[0]);
}

function promptRows(rows) {
  return rows.map((row) => ({
    id: Number(row.id),
    role_scope: {
      role_family: compact(row.role_family, 160),
      target_roles: compact(row.target_roles, 180),
      activation_role_family: compact(row.activation_role_family, 160),
      activation_keywords: compact(row.activation_keywords, 180),
      grounding_terms: compact(row.grounding_terms, 220),
    },
    governance: {
      action_specificity: row.action_specificity || "",
      display_action_mode: row.display_action_mode || "",
      canonical_action_family: row.canonical_action_family || "",
      action_depth: row.action_depth || "",
    },
    visible_action_sources: {
      A_action: compact(row.A_action, 520),
      action_summary: compact(row.action_summary, 320),
      generalized_action: compact(row.generalized_action, 520),
    },
    context_for_audit_only: {
      problem_tags: compact(row.problem_tags, 240),
      user_problem_summary: compact(row.user_problem_summary, 260),
      advice_card_title: compact(row.advice_card_title, 180),
    },
  }));
}

function systemPrompt() {
  return [
    "You audit resume-advice action copy. Return only a JSON array.",
    "Each item must be {\"id\": number, \"safe\": boolean, \"confidence\": number, \"issues\": string[], \"notes\": string}.",
    "Audit the action governance, not writing style.",
    "Generalized action must be fully cross-role generic: no specific role, industry, tool, company, school, project name, or user case detail.",
    "Raw A_action may contain role/domain/tool details, but only if role_scope or activation/grounding makes it safe.",
    "If raw contains a specific project/company/school/user case, display_action_mode must not be raw; it must be grounded_raw or exclude and have grounding/activation unless excluded.",
    "Flag resume-fact-dependent advice: section reorder, deleting GPA/interests/skills, adding LinkedIn/GitHub/portfolio, education order, or pruning named tools.",
    "Use issue codes such as generalized_domain_leak, generalized_case_leak, raw_case_specific_in_raw_mode, raw_domain_without_role_scope, raw_requires_grounding_or_activation, precondition_sensitive_action, role_scope_unclear.",
    "safe=true only when the current governance can be shown safely under these rules.",
  ].join("\n");
}

async function llmReviewBatch(client, rows) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    temperature: 0,
    system: systemPrompt(),
    messages: [{ role: "user", content: JSON.stringify(promptRows(rows), null, 2) }],
  });
  const raw = message.content?.[0]?.text || "";
  const parsed = extractJsonArray(raw);
  const byId = new Map(parsed.map((row) => [Number(row.id), row]));
  return rows.map((row) => byId.get(Number(row.id)) || {
    id: Number(row.id),
    safe: false,
    confidence: 0,
    issues: ["llm_missing_row"],
    notes: "LLM did not return a verdict for this row.",
  });
}

function auditOutputRow(row, audit) {
  return {
    id: Number(row.id),
    chunk_id: row.chunk_id || "",
    role_family: row.role_family || "",
    target_roles: row.target_roles || "",
    problem_tags: row.problem_tags || "",
    advice_card_title: row.advice_card_title || "",
    user_problem_summary: row.user_problem_summary || "",
    A_action: row.A_action || "",
    action_summary: row.action_summary || "",
    generalized_action: row.generalized_action || "",
    current: {
      action_specificity: row.action_specificity || "",
      display_action_mode: row.display_action_mode || "",
      activation_role_family: row.activation_role_family || "",
      activation_keywords: row.activation_keywords || "",
      grounding_terms: row.grounding_terms || "",
      canonical_action_family: row.canonical_action_family || "",
      action_depth: row.action_depth || "",
      action_review_status: row.action_review_status || "",
    },
    audit,
    proposed: {
      action_semantic_review_status: audit.action_semantic_review_status,
      action_semantic_review_source: audit.action_semantic_review_source,
      action_semantic_review_confidence: audit.action_semantic_review_confidence,
      action_semantic_review_issues: audit.action_semantic_review_issues,
      action_semantic_reviewed_at: new Date().toISOString(),
    },
  };
}

function summarize(rows) {
  const summary = {
    rowCount: rows.length,
    byStatus: {},
    bySource: {},
    byIssue: {},
  };
  for (const row of rows) {
    const p = row.proposed;
    summary.byStatus[p.action_semantic_review_status] = (summary.byStatus[p.action_semantic_review_status] || 0) + 1;
    summary.bySource[p.action_semantic_review_source] = (summary.bySource[p.action_semantic_review_source] || 0) + 1;
    for (const issue of p.action_semantic_review_issues || []) {
      summary.byIssue[issue] = (summary.byIssue[issue] || 0) + 1;
    }
  }
  return summary;
}

function writeCsv(filePath, rows) {
  const headers = [
    "id",
    "status",
    "confidence",
    "issues",
    "mode",
    "specificity",
    "role_family",
    "target_roles",
    "A_action",
    "generalized_action",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) => [
      row.id,
      row.proposed.action_semantic_review_status,
      row.proposed.action_semantic_review_confidence,
      (row.proposed.action_semantic_review_issues || []).join("|"),
      row.current.display_action_mode,
      row.current.action_specificity,
      row.role_family,
      row.target_roles,
      row.A_action,
      row.generalized_action,
    ].map(csvCell).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function readRows(pool) {
  const limitSql = LIMIT > 0 ? `LIMIT ${LIMIT}` : "";
  const offsetSql = OFFSET > 0 ? `OFFSET ${OFFSET}` : "";
  const params = [];
  let scopeSql = "";
  if (SCOPE === "resume_edit") {
    scopeSql = "WHERE retrieval_scope = 'resume_edit'";
  } else if (SCOPE === "resume_edit_or_null") {
    scopeSql = "WHERE retrieval_scope IS NULL OR retrieval_scope = 'resume_edit'";
  } else if (SCOPE !== "all") {
    params.push(SCOPE);
    scopeSql = "WHERE retrieval_scope = $1";
  }
  const { rows } = await pool.query(`
    SELECT id, chunk_id, retrieval_scope, role_family, target_roles, problem_tags,
           advice_card_title, user_problem_summary, action_summary,
           "A_action", generalized_action, action_specificity, display_action_mode,
           activation_role_family, activation_keywords, grounding_terms,
           canonical_action_family, action_depth, action_review_status
      FROM segments
      ${scopeSql}
     ORDER BY id
     ${limitSql}
     ${offsetSql}
  `, params);
  return rows;
}

function loadApplyRows() {
  if (!APPLY_FILE) throw new Error("--apply requires --apply-file=<audit.json>");
  const fullPath = path.resolve(process.cwd(), APPLY_FILE);
  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  const rows = Array.isArray(parsed) ? parsed : parsed.rows;
  if (!Array.isArray(rows) || !rows.length) throw new Error(`No rows found in ${fullPath}`);
  return { fullPath, rows };
}

async function applyRows(pool, rows) {
  const out = rows.map((row) => ({
    id: Number(row.id),
    status: row.proposed?.action_semantic_review_status || row.action_semantic_review_status || "",
    source: row.proposed?.action_semantic_review_source || row.action_semantic_review_source || "",
    confidence: Number(row.proposed?.action_semantic_review_confidence ?? row.action_semantic_review_confidence ?? 0),
    issues: row.proposed?.action_semantic_review_issues || row.action_semantic_review_issues || [],
    reviewed_at: row.proposed?.action_semantic_reviewed_at || row.action_semantic_reviewed_at || new Date().toISOString(),
  })).filter((row) => row.id && row.status);

  const backupDir = path.join(process.cwd(), "data", "backups");
  ensureDir(backupDir);
  const backupPath = path.join(backupDir, `segments_action_semantic_review_${Date.now()}.jsonl`);
  const ids = out.map((row) => row.id);
  const { rows: currentRows } = await pool.query(`
    SELECT id, action_semantic_review_status, action_semantic_review_source,
           action_semantic_review_confidence, action_semantic_review_issues,
           action_semantic_reviewed_at
      FROM segments
     WHERE id = ANY($1::int[])
     ORDER BY id
  `, [ids]);
  fs.writeFileSync(backupPath, currentRows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");

  for (const chunk of splitBatches(out, APPLY_CHUNK_SIZE)) {
    await pool.query("BEGIN");
    try {
      const result = await pool.query(`
        WITH updates AS (
          SELECT *
            FROM jsonb_to_recordset($1::jsonb) AS x(
              id int,
              status text,
              source text,
              confidence numeric,
              issues jsonb,
              reviewed_at timestamptz
            )
        )
        UPDATE segments
           SET action_semantic_review_status = updates.status,
               action_semantic_review_source = updates.source,
               action_semantic_review_confidence = updates.confidence,
               action_semantic_review_issues = updates.issues,
               action_semantic_reviewed_at = updates.reviewed_at
          FROM updates
         WHERE segments.id = updates.id
      `, [JSON.stringify(chunk)]);
      if (result.rowCount !== chunk.length) {
        console.warn(`apply chunk matched ${result.rowCount}/${chunk.length}`);
      }
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }
  return { appliedRows: out.length, backupPath };
}

async function runAudit(pool) {
  if (USE_LLM && !process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required for --llm");
  if ((USE_LLM || APPLY) && LIMIT === 0 && !ALL) {
    throw new Error("Use --all when running without --limit for --llm or --apply scale operations.");
  }
  const rows = await readRows(pool);
  const client = USE_LLM ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
  const outputs = [];
  for (const batch of splitBatches(rows, BATCH_SIZE)) {
    const verdicts = USE_LLM ? await llmReviewBatch(client, batch) : batch.map(() => null);
    for (let i = 0; i < batch.length; i += 1) {
      outputs.push(auditOutputRow(batch[i], semanticAudit.finalAudit(batch[i], verdicts[i])));
    }
    if (USE_LLM) console.log(`audited ${outputs.length}/${rows.length}`);
  }
  return outputs;
}

async function main() {
  const pool = db.getPool();
  await pool.query("SET statement_timeout = '10min'");

  if (APPLY) {
    const { fullPath, rows } = loadApplyRows();
    const result = await applyRows(pool, rows);
    console.log(JSON.stringify({ apply: true, applyFile: fullPath, ...result }, null, 2));
    return;
  }

  const rows = await runAudit(pool);
  const stamp = timestamp();
  const outDir = ensureDir(OUT_DIR);
  const auditPath = path.join(outDir, `action_semantic_full_${stamp}.json`);
  const reviewPath = path.join(outDir, `action_semantic_manual_review_${stamp}.json`);
  const reviewCsvPath = path.join(outDir, `action_semantic_manual_review_${stamp}.csv`);
  const manualRows = rows.filter((row) => row.proposed.action_semantic_review_status === "needs_manual_review");
  const report = {
    generatedAt: new Date().toISOString(),
    scope: SCOPE,
    useLlm: USE_LLM,
    model: USE_LLM ? MODEL : "",
    summary: summarize(rows),
    rows,
  };
  fs.writeFileSync(auditPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(reviewPath, JSON.stringify({ generatedAt: report.generatedAt, rows: manualRows }, null, 2), "utf8");
  writeCsv(reviewCsvPath, manualRows);
  console.log(JSON.stringify({
    auditPath,
    reviewPath,
    reviewCsvPath,
    summary: report.summary,
    reviewRows: manualRows.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
