"use strict";

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const db = require("../database");

async function main() {
  const pool = db.getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analysis_jobs (
      job_id text PRIMARY KEY,
      status text NOT NULL,
      stage text NOT NULL,
      progress integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      completed_at timestamptz,
      expires_at timestamptz,
      error text,
      source text,
      result_json jsonb,
      user_id text,
      file_name text,
      job_title text
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs (status)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_analysis_jobs_expires_at ON analysis_jobs (expires_at)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_analysis_jobs_updated_at ON analysis_jobs (updated_at)");
  console.log("[Migration] analysis_jobs table is ready");
}

main()
  .catch((error) => {
    console.error("[Migration] analysis_jobs failed:", error.message || error.code || error);
    if (error.code || error.detail || error.hint) {
      console.error("[Migration] pg detail:", JSON.stringify({
        code: error.code,
        detail: error.detail,
        hint: error.hint,
      }));
    }
    if (error.stack) console.error(error.stack);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.closeDB?.();
  });
