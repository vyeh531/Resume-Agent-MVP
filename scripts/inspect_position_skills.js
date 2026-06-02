"use strict";

const fs = require("fs");
const { Pool } = require("pg");

function readEnv(path) {
  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

async function main() {
  const env = readEnv(".env.local");
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    options: "-c search_path=vibe_offer",
  });

  const columns = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'vibe_offer'
      AND table_name = 'position_skills'
    ORDER BY ordinal_position
  `);
  console.log(JSON.stringify(columns.rows, null, 2));

  const count = await pool.query("SELECT COUNT(*) FROM position_skills");
  console.log("count", count.rows[0].count);

  const idArgs = process.argv.slice(2).map((value) => Number.parseInt(value, 10)).filter(Number.isInteger);
  const sample = idArgs.length
    ? await pool.query("SELECT * FROM position_skills WHERE id = ANY($1::int[]) ORDER BY id", [idArgs])
    : await pool.query("SELECT * FROM position_skills ORDER BY id LIMIT 3");
  console.log(JSON.stringify(sample.rows, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
