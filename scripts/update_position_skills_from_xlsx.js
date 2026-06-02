"use strict";

const fs = require("fs");
const { execFileSync } = require("child_process");
const { Pool } = require("pg");

const DEFAULT_XLSX =
  "C:\\Users\\viviy\\Desktop\\Vibe Intern\\intern db\\db\\db\\udate\\position.xlsx";
const DEFAULT_PYTHON =
  "C:\\Users\\viviy\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
const TARGET_COLUMNS = [
  "id",
  "position_title",
  "salary_range",
  "top1_skill",
  "top2_skill",
  "top3_skill",
  "top4_skill",
  "top5_skill",
  "top6_skill",
  "top7_skill",
  "top8_skill",
  "top9_skill",
  "top10_skill",
];

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

function cleanValue(value, column) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (column === "id") return Number.parseInt(text, 10);
  return text;
}

function loadWorkbookRows(xlsxPath) {
  const code = `
import json, openpyxl, sys
path = sys.argv[1]
wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
headers = [str(v).strip() if v is not None else "" for v in rows[0]]
records = []
for row in rows[1:]:
    item = {}
    for i, header in enumerate(headers):
        item[header] = row[i] if i < len(row) else None
    if any(v is not None and str(v).strip() for v in row):
        records.append(item)
print(json.dumps(records, ensure_ascii=False))
`;
  const python = process.env.PYTHON || DEFAULT_PYTHON;
  const output = execFileSync(python, ["-c", code, xlsxPath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  return JSON.parse(output);
}

function toTargetRow(record) {
  const row = {};
  for (const column of TARGET_COLUMNS) row[column] = cleanValue(record[column], column);
  return row;
}

function uniqueRows(rows) {
  const byId = new Map();
  const duplicates = [];
  for (const row of rows) {
    if (!Number.isInteger(row.id)) continue;
    if (byId.has(row.id)) duplicates.push(row.id);
    byId.set(row.id, row);
  }
  return { rows: Array.from(byId.values()), duplicates };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const xlsxArg = process.argv.find((arg) => arg.toLowerCase().endsWith(".xlsx"));
  const xlsxPath = xlsxArg || DEFAULT_XLSX;
  const env = readEnv(".env.local");

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    options: "-c search_path=vibe_offer",
  });

  const columnResult = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'vibe_offer'
      AND table_name = 'position_skills'
    ORDER BY ordinal_position
  `);
  const dbColumns = columnResult.rows.map((row) => row.column_name);
  const missingColumns = TARGET_COLUMNS.filter((column) => !dbColumns.includes(column));
  if (missingColumns.length) {
    throw new Error(`position_skills is missing expected columns: ${missingColumns.join(", ")}`);
  }

  const workbookRecords = loadWorkbookRows(xlsxPath);
  const mappedRows = workbookRecords.map(toTargetRow).filter((row) => Number.isInteger(row.id));
  const { rows, duplicates } = uniqueRows(mappedRows);

  const existingResult = await pool.query("SELECT id FROM position_skills ORDER BY id");
  const existingIds = new Set(existingResult.rows.map((row) => row.id));
  const sourceIds = new Set(rows.map((row) => row.id));
  const updateIds = rows.filter((row) => existingIds.has(row.id)).map((row) => row.id);
  const insertIds = rows.filter((row) => !existingIds.has(row.id)).map((row) => row.id);
  const untouchedIds = [...existingIds].filter((id) => !sourceIds.has(id));

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        xlsxPath,
        workbookRows: workbookRecords.length,
        validRows: rows.length,
        duplicateIds: duplicates,
        dbExistingRows: existingIds.size,
        willUpdate: updateIds.length,
        willInsert: insertIds.length,
        untouchedDbRows: untouchedIds.length,
        insertIdPreview: insertIds.slice(0, 20),
        untouchedIdPreview: untouchedIds.slice(0, 20),
        columnsUsed: TARGET_COLUMNS,
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
  const backupPath = `${backupDir}/position_skills_before_xlsx_update_${timestamp}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(backupRows.rows, null, 2), "utf8");
  console.log(`backup ${backupPath}`);

  await pool.query("BEGIN");
  try {
    const placeholders = TARGET_COLUMNS.map((_, index) => `$${index + 1}`).join(", ");
    const updateSet = TARGET_COLUMNS.filter((column) => column !== "id")
      .map((column) => `${column} = EXCLUDED.${column}`)
      .join(", ");
    const sql = `
      INSERT INTO position_skills (${TARGET_COLUMNS.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET ${updateSet}
    `;

    for (const row of rows) {
      await pool.query(
        sql,
        TARGET_COLUMNS.map((column) => row[column])
      );
    }
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
