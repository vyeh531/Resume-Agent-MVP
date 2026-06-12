"use strict";

const { Pool } = require("pg");
const crypto = require("crypto");

// ── 連線池（單例）────────────────────────────────────────────────
let _pool = null;
const memoryStore = globalThis.__resumeAgentMemoryDb || {
  analyses: new Map(),
  atsReports: new Map(),
  analysisJobs: new Map(),
};
globalThis.__resumeAgentMemoryDb = memoryStore;

const ANALYSIS_JOB_TTL_MS = Number(process.env.ANALYSIS_JOB_TTL_MS || 1000 * 60 * 60);
const ANALYSIS_JOB_STALE_MS = Number(process.env.ANALYSIS_JOB_STALE_MS || 1000 * 60 * 10);
let _analysisJobsTableReady = null;

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is not configured");
  }
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

function parseMaybeJSON(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return safeParseJSON(value, fallback);
  return value;
}

function timeValue(value) {
  if (!value) return null;
  const ts = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
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

function publicAnalysisJob(row) {
  if (!row) return null;
  return {
    jobId: row.job_id,
    status: row.status,
    stage: row.stage,
    progress: Number(row.progress || 0),
    createdAt: timeValue(row.created_at),
    updatedAt: timeValue(row.updated_at),
    completedAt: timeValue(row.completed_at),
    error: row.error || null,
    result: row.status === "completed" ? parseMaybeJSON(row.result_json, null) : null,
  };
}

function cleanupMemoryAnalysisJobs() {
  const now = Date.now();
  for (const [jobId, job] of memoryStore.analysisJobs.entries()) {
    const createdAt = timeValue(job.created_at) || now;
    if (now - createdAt > ANALYSIS_JOB_TTL_MS) memoryStore.analysisJobs.delete(jobId);
  }
}

async function ensureAnalysisJobsTable() {
  if (!hasDatabaseUrl()) return;
  if (!_analysisJobsTableReady) {
    _analysisJobsTableReady = (async () => {
      const pool = getPool();
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
    })().catch((error) => {
      _analysisJobsTableReady = null;
      throw error;
    });
  }
  return _analysisJobsTableReady;
}

// ── analysis_jobs ──────────────────────────────────────────────────

async function createAnalysisJob({ jobId, userId = null, fileName = "", jobTitle = "" } = {}) {
  const id = jobId || crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ANALYSIS_JOB_TTL_MS);
  if (!hasDatabaseUrl()) {
    cleanupMemoryAnalysisJobs();
    memoryStore.analysisJobs.set(id, {
      job_id: id,
      status: "queued",
      stage: "queued",
      progress: 5,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      completed_at: null,
      expires_at: expiresAt.toISOString(),
      error: null,
      source: null,
      result_json: null,
      user_id: userId || null,
      file_name: fileName || "",
      job_title: jobTitle || "",
    });
    console.warn("[DB] DATABASE_URL missing; saved analysis job in memory only");
    return publicAnalysisJob(memoryStore.analysisJobs.get(id));
  }
  await ensureAnalysisJobsTable();
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO analysis_jobs (
        job_id, status, stage, progress, created_at, updated_at, expires_at,
        user_id, file_name, job_title
      ) VALUES ($1,'queued','queued',5,$2,$2,$3,$4,$5,$6)
      RETURNING *`,
    [id, now.toISOString(), expiresAt.toISOString(), userId || null, fileName || "", jobTitle || ""]
  );
  return publicAnalysisJob(rows[0]);
}

async function updateAnalysisJob(jobId, patch = {}) {
  const now = new Date().toISOString();
  if (!hasDatabaseUrl()) {
    const row = memoryStore.analysisJobs.get(jobId);
    if (!row) return null;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.stage !== undefined) row.stage = patch.stage;
    if (patch.progress !== undefined) row.progress = patch.progress;
    if (patch.error !== undefined) row.error = patch.error;
    if (patch.source !== undefined) row.source = patch.source;
    if (patch.result !== undefined) row.result_json = patch.result;
    if (patch.completedAt !== undefined) row.completed_at = patch.completedAt ? new Date(patch.completedAt).toISOString() : null;
    row.updated_at = now;
    return publicAnalysisJob(row);
  }
  await ensureAnalysisJobsTable();
  const fields = ["updated_at = $2"];
  const values = [jobId, now];
  let i = values.length + 1;
  const add = (column, value, cast = "") => {
    fields.push(`${column} = $${i++}${cast}`);
    values.push(value);
  };
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.stage !== undefined) add("stage", patch.stage);
  if (patch.progress !== undefined) add("progress", patch.progress);
  if (patch.error !== undefined) add("error", patch.error);
  if (patch.source !== undefined) add("source", patch.source);
  if (patch.result !== undefined) add("result_json", JSON.stringify(patch.result), "::jsonb");
  if (patch.completedAt !== undefined) add("completed_at", patch.completedAt ? new Date(patch.completedAt).toISOString() : null);
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE analysis_jobs SET ${fields.join(", ")} WHERE job_id = $1 RETURNING *`,
    values
  );
  return publicAnalysisJob(rows[0]);
}

async function completeAnalysisJob(jobId, result = {}, source = null) {
  return updateAnalysisJob(jobId, {
    status: "completed",
    stage: "completed",
    progress: 100,
    completedAt: Date.now(),
    source,
    error: null,
    result,
  });
}

async function failAnalysisJob(jobId, error, progress = 20) {
  return updateAnalysisJob(jobId, {
    status: "failed",
    stage: "failed",
    progress: Math.max(Number(progress || 0), 20),
    error: error?.message || String(error || "analysis failed"),
    completedAt: Date.now(),
  });
}

async function getAnalysisJob(jobId) {
  cleanupMemoryAnalysisJobs();
  if (!hasDatabaseUrl()) {
    const row = memoryStore.analysisJobs.get(jobId);
    if (!row) return null;
    const updatedAt = timeValue(row.updated_at) || 0;
    if (["queued", "running"].includes(row.status) && Date.now() - updatedAt > ANALYSIS_JOB_STALE_MS) {
      return failAnalysisJob(jobId, "Analysis job timed out. Please resubmit.", row.progress);
    }
    return publicAnalysisJob(row);
  }
  await ensureAnalysisJobsTable();
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM analysis_jobs WHERE job_id = $1", [jobId]);
  const row = rows[0];
  if (!row) return null;
  const expired = row.expires_at && timeValue(row.expires_at) < Date.now();
  const stale = ["queued", "running"].includes(row.status) && Date.now() - (timeValue(row.updated_at) || 0) > ANALYSIS_JOB_STALE_MS;
  if (expired || stale) {
    return failAnalysisJob(jobId, expired ? "Analysis job expired. Please resubmit." : "Analysis job timed out. Please resubmit.", row.progress);
  }
  return publicAnalysisJob(row);
}

// ── resume_analyses ────────────────────────────────────────────────

async function saveAnalysis({ jobTitle, resumeText, jdText, result }) {
  if (!hasDatabaseUrl()) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    memoryStore.analyses.set(id, {
      id,
      created_at: now,
      job_title: jobTitle || null,
      resume_text: resumeText || null,
      jd_text: jdText || null,
      ats_score: result.basicScore ?? null,
      risk_level: result.riskLevel || null,
      scoring_basis: result.scoringBasis || null,
      item_scores_json: JSON.stringify(result.itemScores || {}),
      key_problems_json: JSON.stringify(result.keyProblems || []),
      suggestions_json: JSON.stringify(result.suggestions || []),
      improvement_expectation: result.improvementExpectation || null,
      raw_response: result.rawResponse || null,
      is_paid: 0,
    });
    console.warn("[DB] DATABASE_URL missing; saved analysis in memory only");
    return id;
  }
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
  if (!hasDatabaseUrl()) {
    const row = memoryStore.analyses.get(id);
    return row ? deserializeRow(row) : null;
  }
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM resume_analyses WHERE id = $1", [id]);
  if (!rows[0]) return null;
  return deserializeRow(rows[0]);
}

async function getRecentAnalyses(limit = 20) {
  if (!hasDatabaseUrl()) {
    return [...memoryStore.analyses.values()]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        created_at: row.created_at,
        job_title: row.job_title,
        ats_score: row.ats_score,
        risk_level: row.risk_level,
        scoring_basis: row.scoring_basis,
        improvement_expectation: row.improvement_expectation,
        is_paid: row.is_paid,
      }));
  }
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
  if (!hasDatabaseUrl()) {
    const row = memoryStore.analyses.get(id);
    if (row) row.is_paid = isPaid ? 1 : 0;
    return;
  }
  const pool = getPool();
  await pool.query("UPDATE resume_analyses SET is_paid = $1 WHERE id = $2", [isPaid ? 1 : 0, id]);
  console.log(`[DB] 已更新付費狀態 id=${id} isPaid=${isPaid}`);
}

// ── ats_reports ────────────────────────────────────────────────────

async function saveAtsReport(reportData) {
  if (!hasDatabaseUrl()) {
    memoryStore.atsReports.set(reportData.reportId, {
      report_id: reportData.reportId,
      created_at: reportData.createdAt || new Date().toISOString(),
      expires_at: reportData.expiresAt || null,
      job_title: reportData.jobTitle || null,
      has_jd: Boolean(reportData.hasJD),
      total: reportData.total ?? null,
      risk: reportData.risk || null,
      publicReport: reportData.publicReport || {},
      internalAtsResult: reportData.internalAtsResult || {},
      retrievalQuery: reportData.retrievalQuery || {},
      mentorCandidates: reportData.mentorCandidates || [],
      freeAdvice: reportData.freeAdvice || null,
      paidAdvice: reportData.paidAdvice || [],
      premiumReport: reportData.premiumReport || null,
      payment_status: reportData.paymentStatus || "unpaid",
      user_id: reportData.userId || null,
      report_token_hash: hashToken(reportData.reportAccessToken),
      resume_text: reportData.resumeText || null,
      analysis_id: reportData.analysisId || null,
      resume_bullets: reportData.resumeBullets || [],
      aiRewrites: [],
    });
    console.warn("[DB] DATABASE_URL missing; saved ATS report in memory only");
    return reportData.reportId;
  }
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
  if (!hasDatabaseUrl()) {
    const row = memoryStore.atsReports.get(reportId);
    if (row) row.aiRewrites = rewrites || [];
    return;
  }
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
  if (!hasDatabaseUrl()) {
    return memoryStore.atsReports.get(reportId) || null;
  }
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
  if (!hasDatabaseUrl()) {
    const row = memoryStore.atsReports.get(reportId);
    if (row) row.payment_status = isPaid ? "paid" : "unpaid";
    return;
  }
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
  hasDatabaseUrl,
  createAnalysisJob,
  getAnalysisJob,
  updateAnalysisJob,
  completeAnalysisJob,
  failAnalysisJob,
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
  closeDB,
};
