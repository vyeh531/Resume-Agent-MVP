"use strict";

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const db = require("../database");
const {
  inferAdviceScope,
  inferAdviceIntent,
  inferAdviceTransferabilityScope,
  isEligibleForAtsResumeReport,
  splitCsv,
} = require("../services/mentorAdviceRetrieval");

function add(map, key, row) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(row);
}

function summarizeCsv(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    const terms = splitCsv(row[field]);
    if (!terms.length) counts.set("(empty)", (counts.get("(empty)") || 0) + 1);
    for (const term of terms) counts.set(term, (counts.get(term) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function recommendedScope(row) {
  if (isEligibleForAtsResumeReport(row)) return "resume_edit";
  const text = [row.topic, row.L1, row.L2, row.P_mentor, row.A_action, row.action_summary].filter(Boolean).join(" ").toLowerCase();
  if (/面试|interview|behavioral|technical interview|mock interview|自我介绍|star/.test(text)) return "interview";
  if (/录取侧重|录取标准|admission|申请文书|推荐信|学校申请|研究生申请|申请学校/.test(text)) return "school_application";
  if (/投递|海投|内推|networking|linkedin|career fair|求职渠道|窗口期|秋招|春招|offer/.test(text)) return "job_search";
  if (/职业|方向|转行|市场竞争|竞争分析|gap|背景差距|路径规划/.test(text)) return "career_strategy";
  return "other_non_resume";
}

(async () => {
  const pool = db.getPool();
  const columns = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'vibe_offer'
      AND table_name = 'segments'
    ORDER BY ordinal_position
  `);
  const columnSet = new Set(columns.rows.map((row) => row.column_name));
  console.log(`has_retrieval_scope=${columnSet.has("retrieval_scope")}`);

  const selectRetrievalScope = columnSet.has("retrieval_scope") ? "retrieval_scope," : "NULL::text AS retrieval_scope,";
  const { rows } = await pool.query(`
    SELECT id, chunk_id, topic, "L1", "L2", "P_mentor", "A_action", "I_insight",
           "E_example", "HR_os", keywords, retrieval_text, advice_card_title,
           user_problem_summary, action_summary, role_family, target_roles,
           target_role, target_role_family, generality, advice_type, problem_tags,
           ats_dimensions, ${selectRetrievalScope} topic_slug
      FROM segments
     ORDER BY id
  `);

  console.log(`segments_total=${rows.length}`);
  const scopeBuckets = new Map();
  const eligibleBuckets = new Map();
  const transferBuckets = new Map();
  const intentBuckets = new Map();

  for (const row of rows) {
    add(scopeBuckets, recommendedScope(row), row);
    add(eligibleBuckets, isEligibleForAtsResumeReport(row) ? "eligible_result_resume_edit" : "excluded_result", row);
    add(transferBuckets, inferAdviceTransferabilityScope(row), row);
    add(intentBuckets, inferAdviceIntent(row), row);
  }

  for (const [label, buckets] of [
    ["recommended_scope", scopeBuckets],
    ["result_gate", eligibleBuckets],
    ["transferability", transferBuckets],
    ["intent", intentBuckets],
  ]) {
    console.log(`\n# ${label}`);
    for (const [key, items] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n## ${key}: ${items.length}`);
      for (const row of items.slice(0, 8)) {
        const text = String(row.P_mentor || row.advice_card_title || row.topic || "").replace(/\s+/g, " ").slice(0, 120);
        console.log(`- id=${row.id} topic=${row.topic || ""} L2=${row.L2 || ""} role=${row.role_family || ""} :: ${text}`);
      }
    }
  }

  console.log("\n# top_role_family_terms");
  for (const [term, count] of summarizeCsv(rows, "role_family").slice(0, 40)) {
    console.log(`${term}: ${count}`);
  }

  console.log("\n# top_target_role_terms");
  for (const [term, count] of summarizeCsv(rows, "target_roles").slice(0, 40)) {
    console.log(`${term}: ${count}`);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
