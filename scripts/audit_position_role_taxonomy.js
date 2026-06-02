"use strict";

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const db = require("../database");
const { classifyPositionTitle } = require("./position_role_taxonomy");

(async () => {
  const pool = db.getPool();
  const { rows } = await pool.query("SELECT * FROM position_skills ORDER BY position_title");
  const buckets = new Map();
  const multiMatches = [];
  const fallbackRows = [];

  for (const row of rows) {
    const classified = classifyPositionTitle(row.position_title);
    if (!buckets.has(classified.canonicalRoleFamily)) buckets.set(classified.canonicalRoleFamily, []);
    buckets.get(classified.canonicalRoleFamily).push({ row, classified });
    if (classified.matches.length > 1) multiMatches.push({ row, classified });
    if (classified.source === "fallback") fallbackRows.push({ row, classified });
  }

  console.log(`positions_total=${rows.length}`);
  for (const [family, items] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n## ${family} (${items[0].classified.roleGroup}): ${items.length}`);
    for (const { row, classified } of items.slice(0, 10)) {
      const extra = classified.matches.length > 1 ? ` matches=${classified.matches.join(",")}` : "";
      console.log(`- id=${row.id} ${row.position_title} source=${classified.source}${extra}`);
    }
  }

  console.log(`\n## multi_family_matches: ${multiMatches.length}`);
  for (const { row, classified } of multiMatches.slice(0, 60)) {
    console.log(`- id=${row.id} ${row.position_title} => primary=${classified.canonicalRoleFamily}; matches=${classified.matches.join(",")}`);
  }

  console.log(`\n## fallback_other: ${fallbackRows.length}`);
  for (const { row } of fallbackRows.slice(0, 80)) {
    console.log(`- id=${row.id} ${row.position_title}`);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
