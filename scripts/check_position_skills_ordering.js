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

  const fkRefs = await pool.query(`
    SELECT
      conrelid::regclass::text AS referencing_table,
      conname AS constraint_name,
      pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'vibe_offer.position_skills'::regclass
  `);
  console.log("foreign_key_references", JSON.stringify(fkRefs.rows, null, 2));

  const firstById = await pool.query(`
    SELECT id, position_title
    FROM position_skills
    ORDER BY id
    LIMIT 20
  `);
  console.log("first_by_id", JSON.stringify(firstById.rows, null, 2));

  const firstByTitle = await pool.query(`
    SELECT id, position_title
    FROM position_skills
    ORDER BY lower(position_title), position_title, id
    LIMIT 20
  `);
  console.log("first_by_title", JSON.stringify(firstByTitle.rows, null, 2));

  const lastById = await pool.query(`
    SELECT id, position_title
    FROM position_skills
    ORDER BY id DESC
    LIMIT 20
  `);
  console.log("last_by_id_desc", JSON.stringify(lastById.rows, null, 2));

  const mismatches = await pool.query(`
    WITH ordered AS (
      SELECT
        id,
        position_title,
        row_number() OVER (ORDER BY lower(position_title), position_title, id)::int AS expected_id
      FROM position_skills
    )
    SELECT id, expected_id, position_title
    FROM ordered
    WHERE id <> expected_id
    ORDER BY expected_id
    LIMIT 20
  `);
  console.log("id_order_mismatches", JSON.stringify(mismatches.rows, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
