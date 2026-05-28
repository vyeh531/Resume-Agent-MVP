"use strict";

/**
 * Migration: add mentor_title + career_keywords to mentors & segments
 *
 * 1. ALTER mentors  → add career_keywords_json TEXT
 * 2. Populate career_keywords_json by extracting 3 keywords from career_path / title / company
 * 3. ALTER segments → add mentor_title TEXT, mentor_career_keywords TEXT
 * 4. UPDATE segments via join through sessions→mentors
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "mentor_kb-v5.db");
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");

// ── Step 1: add columns if missing ──────────────────────────────────────────

function addColIfMissing(table, col, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name);
  if (!cols.includes(col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    console.log(`[migrate] Added ${table}.${col}`);
  } else {
    console.log(`[migrate] ${table}.${col} already exists, skipping`);
  }
}

addColIfMissing("mentors", "career_keywords_json", "TEXT");
addColIfMissing("mentors", "career_path_display", "TEXT");
addColIfMissing("segments", "mentor_title", "TEXT");
addColIfMissing("segments", "mentor_career_keywords", "TEXT");
addColIfMissing("segments", "mentor_career_path_display", "TEXT");

// ── Step 2: extract keywords from career_path ────────────────────────────────

const KNOWN_COMPANIES = [
  "Google", "Amazon", "Meta", "Microsoft", "Apple", "NVIDIA", "Intel",
  "TikTok", "ByteDance", "Goldman Sachs", "JPMorgan", "Morgan Stanley",
  "McKinsey", "BCG", "Deloitte", "Accenture", "Salesforce", "Adobe",
  "Netflix", "Uber", "Airbnb", "LinkedIn", "Twitter", "Spotify",
  "Bank of America", "Merrill Lynch", "Citigroup", "BlackRock", "Capital One",
  "Cisco", "Oracle", "SAP", "IBM", "Qualcomm", "Tesla", "Bosch",
  "Xerox", "UnitedHealthcare", "Navigant", "AOL", "PeerNova",
];

function extractKeywords(mentor) {
  const keywords = [];
  const path = (mentor.career_path || "").replace(/\s+/g, " ").trim();
  const title = (mentor.title || "").trim();
  const company = (mentor.company || "").trim();

  // 1. Current position badge: "现 {Company} · {Title}" (shortened)
  if (company && company.toLowerCase() !== "freelancer") {
    const shortTitle = title.split(/[,，\/]/)[0].trim().slice(0, 30);
    keywords.push(shortTitle ? `现 ${company}` : company);
    if (shortTitle) keywords.push(shortTitle);
  } else if (title) {
    keywords.push(title.slice(0, 30));
  }

  // 2. Past notable companies mentioned in career_path
  for (const co of KNOWN_COMPANIES) {
    if (
      co.toLowerCase() !== company.toLowerCase() &&
      path.toLowerCase().includes(co.toLowerCase()) &&
      !keywords.some((k) => k.includes(co))
    ) {
      keywords.push(`前${co}`);
      if (keywords.length >= 4) break;
    }
  }

  // 3. Years of experience / coaching numbers from career_path
  const yearsMatch = path.match(/(\d+)\s*[年\-]\s*(以上|\+|Years?|年|Experience)?/i);
  if (yearsMatch && !keywords.some((k) => k.includes("年"))) {
    keywords.push(`${yearsMatch[1]}年+ 经验`);
  }
  const coachMatch = path.match(/辅导\s*(\d+\+?)\s*名/);
  if (coachMatch) keywords.push(`辅导 ${coachMatch[1]}+ 学员`);
  const ratingMatch = (mentor.credibility_signal || "").match(/Rating:\s*(\d)/i);
  if (ratingMatch && Number(ratingMatch[1]) >= 4) keywords.push("⭐ 高评分");

  return [...new Set(keywords)].slice(0, 3);
}

// ── Step 3: populate mentors.career_keywords_json ───────────────────────────

const mentors = db.prepare("SELECT * FROM mentors").all();
const updateMentor = db.prepare(
  "UPDATE mentors SET career_keywords_json = ? WHERE id = ?"
);

let mentorCount = 0;
for (const m of mentors) {
  if (!m.career_path && !m.title && !m.company) continue;
  const kws = extractKeywords(m);
  updateMentor.run(JSON.stringify(kws), m.id);
  mentorCount++;
}
console.log(`[migrate] Updated ${mentorCount} mentors with career_keywords_json`);

// Sample check
const sample = db
  .prepare("SELECT name, title, company, career_keywords_json FROM mentors WHERE career_keywords_json IS NOT NULL LIMIT 8")
  .all();
console.log("[migrate] Sample mentor keywords:");
for (const r of sample) {
  console.log(`  ${r.name} @ ${r.company} | ${r.title} → ${r.career_keywords_json}`);
}

// ── Step 4: populate segments.mentor_title + mentor_career_keywords ──────────

const updateSegment = db.prepare(
  "UPDATE segments SET mentor_title = ?, mentor_career_keywords = ? WHERE session_id = ?"
);

// Build session_id → mentor info map
const sessionRows = db.prepare(`
  SELECT ss.id AS session_id, m.title, m.company, m.career_keywords_json
  FROM sessions ss
  JOIN mentors m ON ss.mentor_id = m.id
  WHERE m.title IS NOT NULL OR m.career_keywords_json IS NOT NULL
`).all();

const sessionMap = new Map();
for (const row of sessionRows) {
  sessionMap.set(row.session_id, {
    title: row.title,
    career_keywords_json: row.career_keywords_json,
  });
}

let segCount = 0;
const segSessions = db.prepare("SELECT DISTINCT session_id FROM segments WHERE session_id IS NOT NULL").all();
for (const { session_id } of segSessions) {
  const meta = sessionMap.get(session_id);
  if (!meta) continue;
  updateSegment.run(meta.title || null, meta.career_keywords_json || null, session_id);
  segCount++;
}
console.log(`[migrate] Updated segments for ${segCount} sessions`);

// Sample check
const segSample = db.prepare(`
  SELECT mentor_name, mentor_title, mentor_career_keywords
  FROM segments
  WHERE mentor_title IS NOT NULL
  LIMIT 6
`).all();
console.log("[migrate] Sample segment mentor meta:");
for (const r of segSample) {
  console.log(`  ${r.mentor_name} | ${r.mentor_title} | ${r.mentor_career_keywords}`);
}

db.close();
console.log("[migrate] Done. Restart server to pick up new columns.");
