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
  const apply = process.argv.includes("--apply");
  const env = readEnv(".env.local");
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    options: "-c search_path=vibe_offer",
  });

  const preview = await pool.query(`
    WITH ordered AS (
      SELECT
        id AS old_id,
        row_number() OVER (ORDER BY lower(position_title), position_title, id)::int AS new_id,
        position_title
      FROM position_skills
    )
    SELECT old_id, new_id, position_title
    FROM ordered
    WHERE old_id <> new_id
    ORDER BY new_id
    LIMIT 30
  `);
  const stats = await pool.query(`
    WITH ordered AS (
      SELECT
        id AS old_id,
        row_number() OVER (ORDER BY lower(position_title), position_title, id)::int AS new_id
      FROM position_skills
    )
    SELECT
      count(*)::int AS total_rows,
      count(*) FILTER (WHERE old_id <> new_id)::int AS ids_to_change
    FROM ordered
  `);

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        ...stats.rows[0],
        changePreview: preview.rows,
      },
      null,
      2
    )
  );

  if (!apply) {
    await pool.end();
    return;
  }

  const backupRows = await pool.query("SELECT * FROM position_skills ORDER BY id");
  const backupDir = "data/backups";
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${backupDir}/position_skills_before_az_id_reorder_${timestamp}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(backupRows.rows, null, 2), "utf8");
  console.log(`backup ${backupPath}`);

  await pool.query("BEGIN");
  try {
    await pool.query(`
      CREATE TEMP TABLE position_skills_id_order AS
      SELECT
        id AS old_id,
        row_number() OVER (ORDER BY lower(position_title), position_title, id)::int AS new_id
      FROM position_skills
    `);
    await pool.query(`
      UPDATE position_skills AS target
      SET id = -ordered.new_id
      FROM position_skills_id_order AS ordered
      WHERE target.id = ordered.old_id
    `);
    await pool.query("UPDATE position_skills SET id = -id");
    await pool.query(`
      DO $$
      DECLARE
        seq_name text;
      BEGIN
        SELECT pg_get_serial_sequence('vibe_offer.position_skills', 'id') INTO seq_name;
        IF seq_name IS NOT NULL THEN
          EXECUTE format(
            'SELECT setval(%L, (SELECT max(id) FROM vibe_offer.position_skills), true)',
            seq_name
          );
        END IF;
      END $$;
    `);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
