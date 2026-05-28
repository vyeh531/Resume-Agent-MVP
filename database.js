/**
 * database.js
 * 使用 Node.js 22+ 內建 node:sqlite 連接 mentor_kb-v2.db
 * 管理 resume_analyses 表（用戶 ATS 評分記錄）
 */

"use strict";

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = path.join(__dirname, "mentor_kb-v5.db");

// ── 建立連線（單例）──────────────────────────────────────────
let _db = null;

function getDB() {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec("PRAGMA foreign_keys = ON;");
    initSchema();
  }
  return _db;
}

// ── 建表 ────────────────────────────────────────────────────
function initSchema() {
  _db.exec(`
    CREATE TABLE IF NOT EXISTS resume_analyses (
      id                      TEXT PRIMARY KEY,
      created_at              TEXT NOT NULL,
      job_title               TEXT,
      resume_text             TEXT,
      jd_text                 TEXT,
      ats_score               INTEGER,
      risk_level              TEXT,
      scoring_basis           TEXT,
      item_scores_json        TEXT,
      key_problems_json       TEXT,
      suggestions_json        TEXT,
      improvement_expectation TEXT,
      raw_response            TEXT,
      is_paid                 INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_resume_analyses_created_at
      ON resume_analyses(created_at DESC);

    CREATE TABLE IF NOT EXISTS ats_reports (
      report_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      job_title TEXT,
      has_jd INTEGER,
      total INTEGER,
      risk TEXT,
      public_report_json TEXT NOT NULL,
      internal_ats_json TEXT NOT NULL,
      retrieval_query_json TEXT,
      mentor_candidates_json TEXT,
      free_advice_json TEXT,
      paid_advice_json TEXT,
      premium_report_json TEXT,
      payment_status TEXT DEFAULT 'unpaid',
      user_id TEXT,
      report_token_hash TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ats_reports_created_at
      ON ats_reports(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_ats_reports_user_id
      ON ats_reports(user_id);
  `);
  console.log("[DB] resume_analyses 表初始化完成");
}

// ── 寫入一筆評分結果 ─────────────────────────────────────────
/**
 * @param {object} data
 * @param {string} data.jobTitle
 * @param {string} data.resumeText
 * @param {string} [data.jdText]
 * @param {object} data.result  - scoreResumeATS 回傳的物件
 * @returns {string} 新紀錄的 id
 */
function saveAnalysis({ jobTitle, resumeText, jdText, result }) {
  const db = getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO resume_analyses (
      id, created_at, job_title, resume_text, jd_text,
      ats_score, risk_level, scoring_basis,
      item_scores_json, key_problems_json, suggestions_json,
      improvement_expectation, raw_response
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )
  `);

  stmt.run(
    id,
    now,
    jobTitle || null,
    resumeText || null,
    jdText || null,
    result.basicScore ?? null,
    result.riskLevel || null,
    result.scoringBasis || null,
    JSON.stringify(result.itemScores || {}),
    JSON.stringify(result.keyProblems || []),
    JSON.stringify(result.suggestions || []),
    result.improvementExpectation || null,
    result.rawResponse || null
  );

  console.log(`[DB] 已儲存評分記錄 id=${id}`);
  return id;
}

// ── 查詢單筆 ─────────────────────────────────────────────────
/**
 * @param {string} id
 * @returns {object|null}
 */
function getAnalysis(id) {
  const db = getDB();
  const row = db.prepare(
    "SELECT * FROM resume_analyses WHERE id = ?"
  ).get(id);

  if (!row) return null;
  return deserializeRow(row);
}

// ── 查詢最近 N 筆（不含完整簡歷文字，保護隱私）────────────────
/**
 * @param {number} [limit=20]
 * @returns {object[]}
 */
function getRecentAnalyses(limit = 20) {
  const db = getDB();
  const rows = db.prepare(`
    SELECT id, created_at, job_title, ats_score, risk_level,
           scoring_basis, improvement_expectation, is_paid
    FROM resume_analyses
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);

  return rows;
}

// ── 更新付費狀態 ──────────────────────────────────────────────
/**
 * @param {string} id
 * @param {boolean} isPaid
 */
function markAsPaid(id, isPaid = true) {
  const db = getDB();
  db.prepare(
    "UPDATE resume_analyses SET is_paid = ? WHERE id = ?"
  ).run(isPaid ? 1 : 0, id);
  console.log(`[DB] 已更新付費狀態 id=${id} isPaid=${isPaid}`);
}

// ── 內部：把 JSON 欄位反序列化 ───────────────────────────────
function hashToken(token) {
  if (!token) return null;
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function saveAtsReport(reportData) {
  const db = getDB();
  const now = reportData.createdAt || new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO ats_reports (
      report_id, created_at, expires_at, job_title, has_jd, total, risk,
      public_report_json, internal_ats_json, retrieval_query_json,
      mentor_candidates_json, free_advice_json, paid_advice_json,
      premium_report_json, payment_status, user_id, report_token_hash
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  stmt.run(
    reportData.reportId,
    now,
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
    hashToken(reportData.reportAccessToken)
  );

  console.log(`[DB] saved ats_report report_id=${reportData.reportId}`);
  return reportData.reportId;
}

function getAtsReport(reportId) {
  const db = getDB();
  const row = db.prepare("SELECT * FROM ats_reports WHERE report_id = ?").get(reportId);
  if (!row) return null;
  return deserializeAtsReport(row);
}

function validateReportAccess(reportId, tokenOrUser = {}) {
  const row = getAtsReport(reportId);
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

function validateReportUnlock(reportId, tokenOrUser = {}) {
  const access = validateReportAccess(reportId, tokenOrUser);
  if (!access.ok) return access;
  const devUnlock = process.env.DEV_UNLOCK_REPORTS === "true" && process.env.NODE_ENV !== "production";
  if (access.report.payment_status === "paid" || devUnlock) {
    return { ok: true, report: access.report };
  }
  return { ok: false, status: 402, error: "PAYMENT_REQUIRED", report: access.report };
}

function markAtsReportPaid(reportId, isPaid = true) {
  const db = getDB();
  db.prepare("UPDATE ats_reports SET payment_status = ? WHERE report_id = ?")
    .run(isPaid ? "paid" : "unpaid", reportId);
  console.log(`[DB] updated ats_report payment report_id=${reportId} paid=${isPaid}`);
}

function deserializeRow(row) {
  return {
    ...row,
    itemScores: safeParseJSON(row.item_scores_json, {}),
    keyProblems: safeParseJSON(row.key_problems_json, []),
    suggestions: safeParseJSON(row.suggestions_json, []),
  };
}

function safeParseJSON(str, fallback) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
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

// ── 關閉連線（程序退出時）────────────────────────────────────
function closeDB() {
  if (_db) {
    _db.close();
    _db = null;
    console.log("[DB] 連線已關閉");
  }
}

process.on("exit", closeDB);
process.on("SIGINT", () => { closeDB(); process.exit(0); });
process.on("SIGTERM", () => { closeDB(); process.exit(0); });

module.exports = {
  getDB,
  saveAnalysis,
  getAnalysis,
  getRecentAnalyses,
  markAsPaid,
  saveAtsReport,
  getAtsReport,
  validateReportAccess,
  validateReportUnlock,
  markAtsReportPaid,
  hashToken,
};
