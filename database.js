"use strict";

const { Pool } = require("pg");
const crypto = require("crypto");

// ── 連線池（單例）────────────────────────────────────────────────
let _pool = null;

function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      options: "-c search_path=vibe_offer",
    });
    _pool.on("error", (err) => console.error("[DB] pool error:", err.message));
    console.log("[DB] Supabase pool initialized");
  }
  return _pool;
}

// ── 內部工具 ──────────────────────────────────────────────────────
function hashToken(token) {
  if (!token) return null;
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function safeParseJSON(str, fallback) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

function deserializeRow(row) {
  return {
    ...row,
    itemScores: safeParseJSON(row.item_scores_json, {}),
    keyProblems: safeParseJSON(row.key_problems_json, []),
    suggestions: safeParseJSON(row.suggestions_json, []),
  };
}

function deserializeAtsReport(row) {
  return {
    ...row,
    has_jd: Boolean(row.has_jd),
    publicReport: safeParseJSON(row.public_report_json, {}),
    internalAtsResult: safeParseJSON(row.internal_ats_json, {}),
    retrievalQuery: safeParseJSON(row.retrieval_query_json, {}),
    mentorCandidates: safeParseJSON(row.mentor_candidates_json, []),
    freeAdvice: safeParseJSON(row.free_advice_json, null),
    paidAdvice: safeParseJSON(row.paid_advice_json, []),
    premiumReport: safeParseJSON(row.premium_report_json, null),
  };
}

// ── resume_analyses ────────────────────────────────────────────────

async function saveAnalysis({ jobTitle, resumeText, jdText, result }) {
  const pool = getPool();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO resume_analyses (
        id, created_at, job_title, resume_text, jd_text,
        ats_score, risk_level, scoring_basis,
        item_scores_json, key_problems_json, suggestions_json,
        improvement_expectation, raw_response
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id, now,
      jobTitle || null, resumeText || null, jdText || null,
      result.basicScore ?? null, result.riskLevel || null, result.scoringBasis || null,
      JSON.stringify(result.itemScores || {}),
      JSON.stringify(result.keyProblems || []),
      JSON.stringify(result.suggestions || []),
      result.improvementExpectation || null,
      result.rawResponse || null,
    ]
  );
  console.log(`[DB] 已儲存評分記錄 id=${id}`);
  return id;
}

async function getAnalysis(id) {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM resume_analyses WHERE id = $1", [id]);
  if (!rows[0]) return null;
  return deserializeRow(rows[0]);
}

async function getRecentAnalyses(limit = 20) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, created_at, job_title, ats_score, risk_level,
            scoring_basis, improvement_expectation, is_paid
     FROM resume_analyses ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

async function markAsPaid(id, isPaid = true) {
  const pool = getPool();
  await pool.query("UPDATE resume_analyses SET is_paid = $1 WHERE id = $2", [isPaid ? 1 : 0, id]);
  console.log(`[DB] 已更新付費狀態 id=${id} isPaid=${isPaid}`);
}

// ── ats_reports ────────────────────────────────────────────────────

async function saveAtsReport(reportData) {
  const pool = getPool();
  const now = reportData.createdAt || new Date().toISOString();
  await pool.query(
    `INSERT INTO ats_reports (
        report_id, created_at, expires_at, job_title, has_jd, total, risk,
        public_report_json, internal_ats_json, retrieval_query_json,
        mentor_candidates_json, free_advice_json, paid_advice_json,
        premium_report_json, payment_status, user_id, report_token_hash,
        resume_text, analysis_id, resume_bullets_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (report_id) DO NOTHING`,
    [
      reportData.reportId, now,
      reportData.expiresAt || null,
      reportData.jobTitle || null,
      reportData.hasJD ? 1 : 0,
      reportData.total ?? null,
      reportData.risk || null,
      JSON.stringify(reportData.publicReport || {}),
      JSON.stringify(reportData.internalAtsResult || {}),
      JSON.stringify(reportData.retrievalQuery || {}),
      JSON.stringify(reportData.mentorCandidates || []),
      JSON.stringify(reportData.freeAdvice || null),
      JSON.stringify(reportData.paidAdvice || []),
      reportData.premiumReport ? JSON.stringify(reportData.premiumReport) : null,
      reportData.paymentStatus || "unpaid",
      reportData.userId || null,
      hashToken(reportData.reportAccessToken),
      reportData.resumeText || null,
      reportData.analysisId || null,
      reportData.resumeBullets ? JSON.stringify(reportData.resumeBullets) : null,
    ]
  );
  console.log(`[DB] saved ats_report report_id=${reportData.reportId}`);
  return reportData.reportId;
}

async function saveAiRewrites(reportId, rewrites) {
  const pool = getPool();
  await pool.query(
    "UPDATE ats_reports SET ai_rewrites_json = $1 WHERE report_id = $2",
    [JSON.stringify(rewrites), reportId]
  );
  console.log(`[DB] saved ai_rewrites report_id=${reportId} count=${rewrites.length}`);
}

function extractBullets(resumeText) {
  if (!resumeText) return [];
  const lines = resumeText.split(/\r?\n/);
  const bullets = [];
  let currentSection = "General";
  const sectionPattern = /^(EXPERIENCE|EDUCATION|SKILLS|PROJECTS|SUMMARY|OBJECTIVE|WORK|EMPLOYMENT|CERTIFICATIONS|AWARDS|PUBLICATIONS|VOLUNTEER|ACTIVITIES|LEADERSHIP|RESEARCH|INTERNSHIP|PROFESSIONAL)/i;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (sectionPattern.test(trimmed) && trimmed.length < 50) {
      currentSection = trimmed.replace(/[:：]/g, "").trim();
      continue;
    }
    // bullet point indicators
    const isBullet = /^[•\-\*◦▪▸➤►»→]/.test(trimmed) || /^\d+[\.\)]/.test(trimmed);
    if (isBullet || (trimmed.length > 20 && trimmed.length < 300)) {
      bullets.push({
        section: currentSection,
        text: trimmed.replace(/^[•\-\*◦▪▸➤►»→\d\.\)]+\s*/, "").trim(),
        original: trimmed,
      });
    }
  }
  return bullets;
}

async function getAtsReport(reportId) {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM ats_reports WHERE report_id = $1", [reportId]);
  if (!rows[0]) return null;
  return deserializeAtsReport(rows[0]);
}

async function validateReportAccess(reportId, tokenOrUser = {}) {
  const row = await getAtsReport(reportId);
  if (!row) return { ok: false, status: 404, error: "REPORT_NOT_FOUND" };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 410, error: "REPORT_EXPIRED" };
  }
  if (row.user_id && tokenOrUser.userId === row.user_id) return { ok: true, report: row };
  if (row.report_token_hash && tokenOrUser.token && hashToken(tokenOrUser.token) === row.report_token_hash) {
    return { ok: true, report: row };
  }
  if (!row.user_id && !row.report_token_hash) return { ok: true, report: row };
  return { ok: false, status: 403, error: "ACCESS_DENIED" };
}

async function validateReportUnlock(reportId, tokenOrUser = {}) {
  const access = await validateReportAccess(reportId, tokenOrUser);
  if (!access.ok) return access;
  const devUnlock = process.env.DEV_UNLOCK_REPORTS === "true" && process.env.NODE_ENV !== "production";
  if (access.report.payment_status === "paid" || devUnlock) {
    return { ok: true, report: access.report };
  }
  return { ok: false, status: 402, error: "PAYMENT_REQUIRED", report: access.report };
}

async function markAtsReportPaid(reportId, isPaid = true) {
  const pool = getPool();
  await pool.query(
    "UPDATE ats_reports SET payment_status = $1 WHERE report_id = $2",
    [isPaid ? "paid" : "unpaid", reportId]
  );
  console.log(`[DB] updated ats_report payment report_id=${reportId} paid=${isPaid}`);
}

async function closeDB() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    console.log("[DB] 連線已關閉");
  }
}

process.on("exit", () => { if (_pool) _pool.end(); });
process.on("SIGINT", async () => { await closeDB(); process.exit(0); });
process.on("SIGTERM", async () => { await closeDB(); process.exit(0); });

module.exports = {
  getPool,
  saveAnalysis,
  getAnalysis,
  getRecentAnalyses,
  markAsPaid,
  saveAtsReport,
  getAtsReport,
  validateReportAccess,
  validateReportUnlock,
  markAtsReportPaid,
  saveAiRewrites,
  extractBullets,
  hashToken,
};
