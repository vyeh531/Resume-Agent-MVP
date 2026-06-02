"use strict";

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const fs = require("fs");
const path = require("path");
const db = require("../database");
const { isEligibleForAtsResumeReport } = require("../services/mentorAdviceRetrieval");

function classifyRetrievalScope(row) {
  if (isEligibleForAtsResumeReport(row)) return "resume_edit";
  const text = [row.topic, row.L1, row.L2, row.P_mentor, row.A_action, row.action_summary].filter(Boolean).join(" ").toLowerCase();
  if (/面试|interview|behavioral|technical interview|mock interview|自我介绍|star/.test(text)) return "interview";
  if (/录取侧重|录取标准|admission|申请文书|推荐信|学校申请|研究生申请|申请学校/.test(text)) return "school_application";
  if (/投递|海投|内推|networking|career fair|求职渠道|窗口期|秋招|春招|offer/.test(text)) return "job_search";
  if (/职业|方向|转行|市场竞争|竞争分析|gap|背景差距|路径规划/.test(text)) return "career_strategy";
  return "other_non_resume";
}

async function main() {
  const apply = process.argv.includes("--apply");
  const pool = db.getPool();
  await pool.query("SET statement_timeout = '10min'");
  const columns = await pool.query(`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'vibe_offer'
       AND table_name = 'segments'
       AND column_name = 'retrieval_scope'
  `);
  const hasRetrievalScope = columns.rows.length > 0;

  if (apply && !hasRetrievalScope) {
    await pool.query("ALTER TABLE segments ADD COLUMN IF NOT EXISTS retrieval_scope text");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_segments_retrieval_scope ON segments (retrieval_scope)");
  }

  const rows = [];
  let lastId = 0;
  while (true) {
    const selectRetrievalScope = hasRetrievalScope || apply ? "retrieval_scope," : "NULL::text AS retrieval_scope,";
    const result = await pool.query(`
      SELECT id, topic, "L1", "L2", "P_mentor", "A_action", action_summary,
             role_family, target_roles, problem_tags, ats_dimensions,
             ${selectRetrievalScope} topic_slug
        FROM segments
       WHERE id > $1
       ORDER BY id
       LIMIT 2000
    `, [lastId]);
    if (!result.rows.length) break;
    rows.push(...result.rows);
    lastId = result.rows[result.rows.length - 1].id;
    if (apply) console.log(`read ${rows.length} rows...`);
  }

  const classified = rows.map((row) => ({ ...row, next_scope: classifyRetrievalScope(row) }));
  const counts = classified.reduce((acc, row) => {
    acc[row.next_scope] = (acc[row.next_scope] || 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ apply, total: classified.length, counts }, null, 2));

  for (const scope of Object.keys(counts).sort()) {
    console.log(`\n## ${scope}`);
    for (const row of classified.filter((item) => item.next_scope === scope).slice(0, 8)) {
      const text = String(row.P_mentor || row.topic || "").replace(/\s+/g, " ").slice(0, 120);
      console.log(`- id=${row.id} old=${row.retrieval_scope || ""} topic=${row.topic || ""} :: ${text}`);
    }
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to add/update segments.retrieval_scope.");
    return;
  }

  const backupDir = path.join(process.cwd(), "data", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `segments_retrieval_scope_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(classified.map(({ id, retrieval_scope, next_scope }) => ({ id, retrieval_scope, next_scope })), null, 2));
  console.log(`backup=${backupPath}`);

  await pool.query("BEGIN");
  try {
    await pool.query("CREATE TEMP TABLE segment_scope_updates (id integer PRIMARY KEY, retrieval_scope text) ON COMMIT DROP");

    for (let start = 0; start < classified.length; start += 1000) {
      const chunk = classified.slice(start, start + 1000);
      const params = [];
      const values = chunk.map((row, index) => {
        params.push(row.id, row.next_scope);
        const offset = index * 2;
        return `($${offset + 1}, $${offset + 2})`;
      });
      await pool.query(
        `INSERT INTO segment_scope_updates (id, retrieval_scope) VALUES ${values.join(",")}`,
        params
      );
    }

    await pool.query(`
      UPDATE segments AS target
         SET retrieval_scope = updates.retrieval_scope
        FROM segment_scope_updates AS updates
       WHERE target.id = updates.id
    `);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
