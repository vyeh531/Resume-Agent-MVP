"use strict";

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const db = require("../database");

async function main() {
  const pool = db.getPool();
  const [statusResult, issueResult] = await Promise.all([
    pool.query(`
      SELECT COALESCE(action_semantic_review_status, '(blank)') AS status,
             COUNT(*)::int AS count
        FROM segments
       WHERE retrieval_scope = 'resume_edit'
       GROUP BY 1
       ORDER BY 1
    `),
    pool.query(`
      SELECT issue, COUNT(*)::int AS count
        FROM segments,
             jsonb_array_elements_text(COALESCE(action_semantic_review_issues, '[]'::jsonb)) AS issue
       WHERE retrieval_scope = 'resume_edit'
         AND action_semantic_review_status = 'blocked'
       GROUP BY issue
       ORDER BY count DESC, issue
    `),
  ]);
  console.log(JSON.stringify({
    byStatus: statusResult.rows,
    blockedIssues: issueResult.rows,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
