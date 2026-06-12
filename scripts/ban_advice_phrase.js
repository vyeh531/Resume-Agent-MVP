"use strict";

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const db = require("../database");

const DEFAULT_TERMS = [
  "将当前实习岗位职责描述输入GPT",
];

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const termsArg = argv.find((arg) => arg.startsWith("--terms="));
  const terms = termsArg
    ? termsArg.slice("--terms=".length).split("|").map((term) => term.trim()).filter(Boolean)
    : DEFAULT_TERMS;
  return { apply, terms };
}

function compact(value, length = 320) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, length);
}

async function main() {
  const { apply, terms } = parseArgs(process.argv.slice(2));
  if (!terms.length) throw new Error("No search terms provided");

  const pool = db.getPool();
  const where = terms.map((_, index) => `
    COALESCE(retrieval_text, '') ILIKE $${index + 1}
    OR COALESCE("A_action", '') ILIKE $${index + 1}
    OR COALESCE(action_summary, '') ILIKE $${index + 1}
  `).join(" OR ");
  const params = terms.map((term) => `%${term}%`);

  const { rows } = await pool.query(
    `
      SELECT id, chunk_id, retrieval_scope, action_semantic_review_status,
             action_semantic_review_issues, advice_card_title, user_problem_summary,
             "A_action", action_summary
        FROM segments
       WHERE ${where}
       ORDER BY id
       LIMIT 50
    `,
    params
  );

  console.log(JSON.stringify({
    apply,
    terms,
    matchCount: rows.length,
    matches: rows.map((row) => ({
      id: row.id,
      chunkId: row.chunk_id,
      scope: row.retrieval_scope,
      status: row.action_semantic_review_status,
      issues: row.action_semantic_review_issues,
      title: compact(row.advice_card_title || row.user_problem_summary),
      action: compact(row.A_action || row.action_summary),
    })),
  }, null, 2));

  if (!apply || rows.length === 0) return;

  const ids = rows.map((row) => row.id);
  const update = await pool.query(
    `
      UPDATE segments
         SET action_semantic_review_status = 'blocked',
             action_semantic_review_source = 'manual_ban:chatgpt_resume_polish_prompt',
             action_semantic_review_confidence = 1,
             action_semantic_review_issues =
               COALESCE(action_semantic_review_issues, '[]'::jsonb)
               || '["user_banned_advice","chatgpt_resume_polish_prompt"]'::jsonb
       WHERE id = ANY($1::int[])
       RETURNING id, action_semantic_review_status, action_semantic_review_issues
    `,
    [ids]
  );

  console.log(JSON.stringify({ updated: update.rowCount, rows: update.rows }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.closeDB());
