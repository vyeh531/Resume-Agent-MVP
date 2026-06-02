"use strict";

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const fs = require("fs");
const path = require("path");
const db = require("../database");
const { classifyPositionTitle } = require("./position_role_taxonomy");

(async () => {
  const apply = process.argv.includes("--apply");
  const pool = db.getPool();
  const { rows } = await pool.query("SELECT * FROM position_skills ORDER BY id");
  const classified = rows.map((row) => {
    const result = classifyPositionTitle(row.position_title);
    return {
      id: row.id,
      position_title: row.position_title,
      old_canonical_role_family: row.canonical_role_family || null,
      old_role_group: row.role_group || null,
      canonical_role_family: result.canonicalRoleFamily,
      role_group: result.roleGroup,
      taxonomy_source: result.source,
      taxonomy_matches: result.matches.join(","),
    };
  });

  const counts = classified.reduce((acc, row) => {
    const key = `${row.role_group}/${row.canonical_role_family}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ apply, total: classified.length, counts }, null, 2));

  const fallback = classified.filter((row) => row.taxonomy_source === "fallback");
  console.log(`fallback_count=${fallback.length}`);
  for (const row of fallback) console.log(`- id=${row.id} ${row.position_title}`);

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to update position_skills taxonomy columns.");
    return;
  }

  const backupDir = path.join(process.cwd(), "data", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `position_skills_role_taxonomy_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(classified, null, 2));
  console.log(`backup=${backupPath}`);

  await pool.query("BEGIN");
  try {
    await pool.query("ALTER TABLE position_skills ADD COLUMN IF NOT EXISTS canonical_role_family text");
    await pool.query("ALTER TABLE position_skills ADD COLUMN IF NOT EXISTS role_group text");
    await pool.query("ALTER TABLE position_skills ADD COLUMN IF NOT EXISTS taxonomy_source text");
    await pool.query("ALTER TABLE position_skills ADD COLUMN IF NOT EXISTS taxonomy_matches text");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_position_skills_canonical_role_family ON position_skills (canonical_role_family)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_position_skills_role_group ON position_skills (role_group)");

    for (const row of classified) {
      await pool.query(
        `UPDATE position_skills
            SET canonical_role_family = $1,
                role_group = $2,
                taxonomy_source = $3,
                taxonomy_matches = $4
          WHERE id = $5`,
        [row.canonical_role_family, row.role_group, row.taxonomy_source, row.taxonomy_matches, row.id]
      );
    }
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
