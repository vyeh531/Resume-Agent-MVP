"use strict";

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const db = require("../database");

const APPLY = process.argv.includes("--apply");

const COLUMNS = [
  ["action_specificity", "text"],
  ["display_action_mode", "text"],
  ["generalized_action", "text"],
  ["activation_role_family", "text"],
  ["activation_keywords", "text"],
  ["grounding_terms", "text"],
  ["canonical_action_family", "text"],
  ["action_depth", "text"],
  ["action_review_status", "text"],
  ["action_semantic_review_status", "text"],
  ["action_semantic_review_source", "text"],
  ["action_semantic_review_confidence", "numeric"],
  ["action_semantic_review_issues", "jsonb"],
  ["action_semantic_reviewed_at", "timestamptz"],
];

async function columnExists(pool, column) {
  const { rows } = await pool.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'vibe_offer'
        AND table_name = 'segments'
        AND column_name = $1
      LIMIT 1`,
    [column]
  );
  return Boolean(rows[0]);
}

async function main() {
  const pool = db.getPool();
  const missing = [];
  for (const [column, type] of COLUMNS) {
    if (!(await columnExists(pool, column))) missing.push([column, type]);
  }

  console.log(JSON.stringify({
    apply: APPLY,
    table: "vibe_offer.segments",
    missingColumns: missing.map(([column, type]) => ({ column, type })),
  }, null, 2));

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to alter db.segments.");
    return;
  }

  await pool.query("BEGIN");
  try {
    for (const [column, type] of missing) {
      await pool.query(`ALTER TABLE segments ADD COLUMN IF NOT EXISTS "${column}" ${type}`);
    }
    await pool.query("CREATE INDEX IF NOT EXISTS idx_segments_display_action_mode ON segments (display_action_mode)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_segments_canonical_action_family ON segments (canonical_action_family)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_segments_action_specificity ON segments (action_specificity)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_segments_action_semantic_review_status ON segments (action_semantic_review_status)");
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
  console.log("\nMigration complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
