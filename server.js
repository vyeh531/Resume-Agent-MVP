require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");
const { scoreResumeATS: scoreResumeSystem } = require("./src/ats/ats-scorer");
const {
  createReportAccessToken,
  createReportId,
  formatDebugReport,
  formatInternalAtsResult,
  formatPremiumUnlockedReport,
  formatPublicFreeReport,
} = require("./src/ats/report-formatter");
const {
  retrieveMentorAdvice,
  selectFreeMentorPlan,
  selectPremiumMentorPlan,
  buildLockedAdvicePreview,
  formatPublicFreeMentorAdvice,
  formatPremiumMentorReport,
} = require("./services/mentorAdviceRetrieval");
const { parsePDF, parseDocx } = require("./file-parser");
const db = require("./database");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const PORT = process.env.PORT || 3000;
const ATS_API_URL = process.env.ATS_API_URL || "https://ats-system-wec6.onrender.com/api/v1/score";
const ATS_API_KEY = process.env.ATS_API_KEY;

app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".docx", ".doc", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) { cb(null, true); }
    else { cb(new Error("Unsupported file type: " + ext)); }
  },
});

app.use(express.static(path.join(__dirname)));
app.use("/logos", express.static(path.join(__dirname, "public", "logos")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/parse-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const fileType = req.body.type || "unknown";
    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;
    console.log("[Parser] Parsing file:", fileName, fileType);
    let text = "";
    if (fileType === "pdf" || fileName.toLowerCase().endsWith(".pdf")) {
      text = await parsePDF(fileBuffer);
    } else if (fileType === "docx" || fileName.toLowerCase().endsWith(".docx")) {
      text = await parseDocx(fileBuffer);
    } else if (fileType === "txt" || fileName.toLowerCase().endsWith(".txt")) {
      text = fileBuffer.toString("utf-8");
    } else {
      return res.status(400).json({ error: "Unsupported file type: " + fileType });
    }
    if (!text || text.trim().length === 0)
      return res.status(400).json({ error: "File content is empty or failed to parse" });
    res.json({ success: true, text, fileName, length: text.length });
  } catch (error) {
    console.error("[Parser Error]", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/score-resume", async (req, res) => {
  try {
    const { resumeText, jobTitle, jdText } = req.body;
    if (!resumeText) return res.status(400).json({ error: "resumeText is required" });
    console.log("[ATS-System] Scoring resume:", { resumeLength: resumeText.length, jobTitle: jobTitle || "N/A", hasJD: !!jdText });
    const result = scoreResumeSystem(resumeText, jobTitle, jdText);
    let sessionId = null;
    try { sessionId = db.saveAnalysis({ jobTitle, resumeText, jdText, result }); }
    catch (dbErr) { console.error("[DB] Save failed (non-blocking):", dbErr.message); }
    res.json({ success: true, sessionId, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[ATS] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/resume/:id", (req, res) => {
  try {
    const row = db.getAnalysis(req.params.id);
    if (!row) return res.status(404).json({ error: "Record not found" });
    res.json({ success: true, data: row });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/recent-analyses", (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const rows = db.getRecentAnalyses(limit);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/resume/:id/mark-paid", async (req, res) => {
  try {
    await db.markAsPaid(req.params.id, true);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

async function fuzzyRow(pool, table, cols, jobTitle) {
  const sel = "SELECT " + cols + " FROM " + table;
  let r = await pool.query(sel + " WHERE LOWER(position_title) = LOWER($1) LIMIT 1", [jobTitle]);
  if (r.rows[0]) return r.rows[0];
  r = await pool.query(sel + " WHERE LOWER(position_title) LIKE LOWER($1) OR LOWER($2) LIKE LOWER('%' || position_title || '%') LIMIT 1", ["%" + jobTitle + "%", jobTitle]);
  if (r.rows[0]) return r.rows[0];
  for (const w of jobTitle.split(/\s+/).filter(w => w.length > 2)) {
    r = await pool.query(sel + " WHERE LOWER(position_title) LIKE LOWER($1) LIMIT 1", ["%" + w + "%"]);
    if (r.rows[0]) return r.rows[0];
  }
  return null;
}

app.get("/api/position-salary", async (req, res) => {
  try {
    const jobTitle = (req.query.jobTitle || "").trim();
    if (!jobTitle) return res.status(400).json({ error: "jobTitle is required" });
    const pool = db.getPool();
    const row = await fuzzyRow(pool, "position_skills", "position_title, salary_range", jobTitle);
    if (!row) return res.json({ success: true, found: false, salary_range: null });
    console.log("[DB] position salary found:", row.position_title, row.salary_range);
    res.json({ success: true, found: true, position_title: row.position_title, salary_range: row.salary_range });
  } catch (error) {
    console.error("[DB] position-salary error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/positions", async (req, res) => {
  try {
    const pool = db.getPool();
    const { rows } = await pool.query("SELECT position_title FROM position_skills ORDER BY position_title");
    res.json({ success: true, data: rows.map(r => r.position_title) });
  } catch (error) {
    console.error("[DB] positions error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/position-skills", async (req, res) => {
  try {
    const jobTitle   = (req.query.jobTitle   || "").trim();
    const resumeText = (req.query.resumeText || "").toLowerCase();
    if (!jobTitle) return res.status(400).json({ error: "jobTitle is required" });
    const pool = db.getPool();
    const row = await fuzzyRow(pool, "position_skills", "*", jobTitle);
    if (!row) return res.json({ success: true, found: false, skills: [] });
    const keys = ["top1_skill","top2_skill","top3_skill","top4_skill","top5_skill",
                  "top6_skill","top7_skill","top8_skill","top9_skill","top10_skill"];
    const skills = keys
      .map((k, i) => ({ priority: i + 1, name: row[k] }))
      .filter(s => s.name && s.name.trim())
      .map(s => ({ priority: s.priority, name: s.name, status: resumeText.includes(s.name.toLowerCase()) ? "have" : "weak" }));
    console.log("[DB] position-skills for", row.position_title, ":", skills.length, "skills");
    res.json({ success: true, found: true, position_title: row.position_title, skills });
  } catch (error) {
    console.error("[DB] position-skills error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// segments: id, chunk_id, session_id, topic, L1, L2, P_mentor, A_action, I_insight,
//           H_hook, E_example, HR_os, advice_type, generality, confidence,
//           background_fit, industry_fit, mentor_name
// before_after_pairs: id, ba_id, session_id, chunk_id, source_segment_id, source_line,
//                     before, after, reason, issue_tags_json, C_cta, mentor_quote, freq_stat

app.post("/api/mentor-advice", async (req, res) => {
  try {
    const { jobTitle, resumeText, keyProblems, atsScore } = req.body;
    const pool = db.getPool();
    const kw = "%" + (jobTitle || "").toLowerCase() + "%";

    // ── 1. Segments (4-tier priority) ──────────────────────────
    let segments = [];
    const { rows: tier1 } = await pool.query(
      "SELECT * FROM segments WHERE generality='universal' AND (confidence='high' OR confidence IS NULL)" +
      " AND (LOWER(topic) LIKE $1 OR LOWER(\"L1\") LIKE $2 OR LOWER(\"L2\") LIKE $3)" +
      " ORDER BY background_fit DESC LIMIT 6",
      [kw, kw, kw]
    );
    segments.push(...tier1);

    if (segments.length < 5) {
      const { rows: tier2 } = await pool.query(
        "SELECT * FROM segments WHERE generality='universal' AND (confidence='high' OR confidence IS NULL)" +
        " ORDER BY background_fit DESC LIMIT 8"
      );
      const ids = new Set(segments.map(s => s.id));
      for (const s of tier2) { if (!ids.has(s.id)) segments.push(s); }
    }

    const { rows: tier3 } = await pool.query(
      "SELECT * FROM segments WHERE (generality='industry-specific' OR generality='role-specific')" +
      " AND (LOWER(topic) LIKE $1 OR LOWER(\"L1\") LIKE $2 OR LOWER(\"L2\") LIKE $3)" +
      " ORDER BY industry_fit ASC LIMIT 5",
      [kw, kw, kw]
    );
    { const ids = new Set(segments.map(s => s.id)); for (const s of tier3) { if (!ids.has(s.id)) segments.push(s); } }

    if (segments.length < 8) {
      const { rows: tier4 } = await pool.query("SELECT * FROM segments ORDER BY background_fit DESC LIMIT 12");
      const ids = new Set(segments.map(s => s.id));
      for (const s of tier4) { if (!ids.has(s.id)) segments.push(s); }
    }
    segments = segments.slice(0, 12);

    // ── 2. Before/after pairs (need 12 for 4 mentors x 3 each) ──
    let pairs = [];
    const problemText = (Array.isArray(keyProblems) ? keyProblems.join(" ") : (keyProblems || ""))
      + " " + (jobTitle || "");
    const kwList = problemText.toLowerCase().split(/[\s,\n]+/).filter(w => w.length > 2).slice(0, 8);
    for (const w of kwList) {
      const { rows: found } = await pool.query(
        "SELECT * FROM before_after_pairs WHERE LOWER(issue_tags_json) LIKE $1 OR LOWER(\"before\") LIKE $2 OR LOWER(reason) LIKE $3 LIMIT 3",
        ["%" + w + "%", "%" + w + "%", "%" + w + "%"]
      );
      pairs.push(...found);
      if (pairs.length >= 12) break;
    }
    if (pairs.length < 6) {
      const { rows: fb } = await pool.query("SELECT * FROM before_after_pairs ORDER BY RANDOM() LIMIT 12");
      const seen = new Set(pairs.map(p => p.id));
      for (const p of fb) { if (!seen.has(p.id)) pairs.push(p); }
    }
    pairs = pairs.slice(0, 12);
    console.log("[Mentor] segments:", segments.length, "pairs:", pairs.length);

    // ── 3. Build prompt ─────────────────────────────────────────
    const segText = segments.map((s, i) =>
      `[S${i+1}] ${s.generality||""} confidence:${s.confidence||""} fit:${s.background_fit||0}\n` +
      `  topic:${s.topic||""} L1:${s.L1||""}\n` +
      `  insight:${(s.I_insight||"").slice(0,100)}\n` +
      `  action:${(s.A_action||"").slice(0,90)}\n` +
      `  example:${(s.E_example||"").slice(0,100)}`
    ).join("\n");

    const pairText = pairs.map((p, i) =>
      `[P${i+1}] before:${(p.before||"").slice(0,100)} | after:${(p.after||"").slice(0,130)} | reason:${(p.reason||"").slice(0,70)}`
    ).join("\n");

    const problemsStr = (Array.isArray(keyProblems) ? keyProblems.slice(0, 5) : [keyProblems||""])
      .map((p, i) => `${i+1}. ${p}`).join("\n");

    const systemPrompt =
      "You are a resume coaching AI. Output ONLY a valid JSON array — no markdown, no code fences, no extra text. " +
      "The array has exactly 4 objects. Each object has these exact keys: " +
      "name, company, role, avatar, tag, credentials, career_path, adviceList. " +
      "adviceList is an array of exactly 3 objects, each with keys: priority, issue, strategy, current, advice, beforeAfter. " +
      "beforeAfter has keys: before, after. " +
      "Wrap any fabricated/estimated numbers in [[double brackets]] in beforeAfter.after and advice fields. " +
      "All free-text fields in Chinese EXCEPT: name, company, role, credentials pill text, career_path company names, " +
      "and beforeAfter.before / beforeAfter.after which MUST be written in English (they are English resume bullet points).";

    const userPrompt =
      `Resume target: ${jobTitle||"unknown"} | ATS: ${atsScore||"?"}/100\n` +
      `Key problems:\n${problemsStr}\n\n` +
      `KNOWLEDGE BASE segments (priority-ordered):\n${segText}\n\n` +
      `REWRITE EXAMPLES:\n${pairText}\n\n` +
      `Rules for the 4 mentors:\n` +
      `- Each mentor is from a DIFFERENT company and focuses on a DIFFERENT problem area\n` +
      `- company: Google / Amazon / Goldman Sachs / McKinsey / Meta / Apple / Microsoft\n` +
      `- avatar: one emoji fitting the company/role\n` +
      `- credentials: 3 pills e.g. ["10年产品经验","前Google PM","专注北美求职"]\n` +
      `- career_path: realistic career progression e.g. "咨询公司 → 快消品牌 → 科技公司（Amazon）"\n` +
      `\nRules for adviceList (3 items per mentor, ALL different angles):\n` +
      `  item 0: priority="P0 必改" — the single most critical fix\n` +
      `  item 1: priority="P1 重要" — important improvement\n` +
      `  item 2: priority="P2 建议" — bonus differentiator\n` +
      `  Each item:\n` +
      `  - issue: 20-40 chars, core problem headline\n` +
      `  - strategy: 70-120 chars, start with "[Company]在筛选[role]时," + screening philosophy from KB\n` +
      `  - current: 70-110 chars, 2-3 specific gaps found in this resume\n` +
      `  - advice: MUST use format "(1) ... (2) ... (3) ..." with each step as a separate sentence; 90-150 chars total\n` +
      `  - beforeAfter.before: original weak English resume bullet 15-40 chars (from REWRITE EXAMPLES if possible)\n` +
      `  - beforeAfter.after: improved English resume bullet 20-50 chars, wrap invented numbers in [[brackets]]`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    console.log("[Mentor] Calling Claude for 4 mentors x 3 advice groups...");
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const rawText = message.content[0].text.trim();
    console.log("[Mentor] Done. Length:", rawText.length, "stop:", message.stop_reason);

    let mentors = [];
    try {
      const cleaned = rawText.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
      const m = cleaned.match(/\[[\s\S]*\]/);
      mentors = JSON.parse(m ? m[0] : cleaned);
    } catch (e) {
      console.error("[Mentor] JSON parse error:", e.message, "| raw:", rawText.substring(0, 300));
      return res.status(500).json({ error: "Failed to parse mentor JSON", raw: rawText.substring(0, 500) });
    }

    res.json({ success: true, mentors, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[Mentor] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});
// ══════════════════════════════════════════════════════════════
//  ATS Public API  —  /api/v1/ats/*
//  Uses the ATS System rule engine as the single scoring source.
//
//  請求（application/json）：
//    { resumeText, jobTitle?, jdText? }
//
//  請求（multipart/form-data）：
//    file=<resume.pdf|.docx|.txt>, jobTitle?, jdText?
//
//  回應：{ success, engine, data, timestamp }
// ══════════════════════════════════════════════════════════════

// 解析上傳文件 → 純文字的 helper
async function resolveResumeText(req) {
  if (req.file) {
    const { originalname, buffer } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    if (ext === ".pdf")  return await parsePDF(buffer);
    if (ext === ".docx") return await parseDocx(buffer);
    if (ext === ".txt")  return buffer.toString("utf-8");
    throw new Error("不支援的檔案格式：" + ext);
  }
  if (req.body.resumeText) return req.body.resumeText;
  throw new Error("請提供 resumeText（文字）或上傳 file（PDF / DOCX / TXT）");
}

// ── POST /api/v1/ats/rule  （ATS System API proxy） ────────
async function callHostedATS({ resumeText, jobTitle, jdText }) {
  if (!ATS_API_KEY) {
    throw new Error("ATS_API_KEY is not configured");
  }

  const body = { resumeText };
  if (jobTitle) body.jobTitle = jobTitle;
  if (jdText) body.jdText = jdText;

  const response = await fetch(ATS_API_URL, {
    method: "POST",
    headers: {
      "X-Api-Key": ATS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (err) {
    throw new Error(`ATS API returned non-JSON response (${response.status})`);
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `ATS API failed with status ${response.status}`);
  }

  return payload.data || payload;
}

function localAtsFallback(resumeText, jobTitle, jdText, reason) {
  console.warn("[ATS-System] Hosted API unavailable, using local fallback:", reason);
  const data = scoreResumeSystem(resumeText, jobTitle, jdText);
  return {
    ...data,
    engine: data.engine || "ats-system-local-fallback",
    source: "local-fallback",
    fallbackReason: reason,
  };
}

// POST /api/v1/ats/rule: proxy to ATS System API so the API key stays server-side.
app.post("/api/v1/ats/rule", upload.single("file"), async (req, res) => {
  try {
    const resumeText = await resolveResumeText(req);
    const { jobTitle, jdText } = req.body;
    if (!jobTitle && !jdText) {
      return res.status(400).json({ success: false, error: "jobTitle or jdText is required" });
    }

    console.log("[ATS-System] Scoring via hosted API:", {
      textLen: resumeText.length,
      jobTitle: jobTitle || "N/A",
      hasJD: !!jdText,
    });

    try {
      const data = await callHostedATS({ resumeText, jobTitle, jdText });
      const report = await buildAtsReportPayload({
        ...data,
        engine: data.engine || "ats-system-api",
        source: "hosted-api",
      }, { resumeText, jobTitle, jdText }, req);
      const payload = {
        success: true,
        engine: "ats-system-api",
        source: "hosted-api",
        reportId: report.reportId,
        reportAccessToken: report.reportAccessToken,
        publicReport: report.publicReport,
        data: report.publicReport,
        timestamp: new Date().toISOString(),
      };
      logPublicAtsResponseForTesting("ats/rule hosted", payload);
      return res.json(payload);
    } catch (apiErr) {
      const data = localAtsFallback(resumeText, jobTitle, jdText, apiErr.message);
      const report = await buildAtsReportPayload(data, { resumeText, jobTitle, jdText }, req);
      const payload = {
        success: true,
        engine: data.engine,
        source: "local-fallback",
        reportId: report.reportId,
        reportAccessToken: report.reportAccessToken,
        publicReport: report.publicReport,
        data: report.publicReport,
        warning: apiErr.message,
        timestamp: new Date().toISOString(),
      };
      logPublicAtsResponseForTesting("ats/rule fallback", payload);
      return res.json(payload);
    }
  } catch (err) {
    console.error("[ATS-System] Error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/v1/ats/rule-local", upload.single("file"), async (req, res) => {
  try {
    const resumeText = await resolveResumeText(req);
    const { jobTitle, jdText } = req.body;
    console.log("[ATS-Rule] jobTitle:", jobTitle || "N/A", "| textLen:", resumeText.length);
    const rawScoreResult = scoreResumeSystem(resumeText, jobTitle, jdText);
    const report = await buildAtsReportPayload(rawScoreResult, { resumeText, jobTitle, jdText }, req);
    const payload = {
      success: true,
      engine: "rule-based",
      reportId: report.reportId,
      reportAccessToken: report.reportAccessToken,
      publicReport: report.publicReport,
      data: report.publicReport,
      timestamp: new Date().toISOString(),
    };
    logPublicAtsResponseForTesting("ats/rule-local", payload);
    res.json(payload);
  } catch (err) {
    console.error("[ATS-Rule] Error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

async function buildAtsReportPayload(rawScoreResult, input, req) {
  const internalAtsResult = formatInternalAtsResult(rawScoreResult, input);
  const retrievalQuery = internalAtsResult.retrievalQuery;
  const mentorCandidates = await retrieveMentorAdvice(retrievalQuery);
  const freeMentorPlan = selectFreeMentorPlan(mentorCandidates, internalAtsResult);
  const premiumMentorPlan = selectPremiumMentorPlan(mentorCandidates, internalAtsResult, freeMentorPlan);
  const freeAdvice = formatPublicFreeMentorAdvice(freeMentorPlan, internalAtsResult);
  const paidAdvice = premiumMentorPlan.slice(1);
  const premiumMentorReport = formatPremiumMentorReport(premiumMentorPlan, internalAtsResult);
  logRetrievalDebug({
    reportContext: input?.jobTitle || rawScoreResult.jobTitle || "unknown",
    mentorCandidateCount: mentorCandidates.length,
    strictCandidateCount: mentorCandidates.debug?.strictCandidates ?? 0,
    fallbackCandidateCount: mentorCandidates.debug?.fallbackCandidates ?? 0,
    selectedFreeAdviceId: freeAdvice?.mentorId || null,
    paidAdviceCount: paidAdvice.reduce((sum, mentor) => sum + (mentor.adviceItems?.length || 0), 0),
    roleMismatchPenalty: mentorCandidates.debug?.maxRoleMismatchPenalty ?? 0,
    selectedScope: mentorCandidates.debug?.selectedScope || "mentor_plan",
    rawRows: mentorCandidates.debug?.rawRows ?? 0,
    eligibleRows: mentorCandidates.debug?.eligibleRows ?? 0,
    excludedInterviewAdvice: mentorCandidates.debug?.excludedInterviewAdvice ?? 0,
  });
  const lockedPreview = buildLockedAdvicePreview(premiumMentorPlan, internalAtsResult);
  const publicReport = formatPublicFreeReport(internalAtsResult, freeAdvice, lockedPreview);
  const premiumReport = formatPremiumUnlockedReport(internalAtsResult, premiumMentorReport);
  logAdvicePlan(freeMentorPlan, premiumMentorPlan, premiumReport.coverageSummary);
  const reportId = createReportId();
  const reportAccessToken = createReportAccessToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

  await db.saveAtsReport({
    reportId,
    reportAccessToken,
    expiresAt,
    jobTitle: internalAtsResult.jobTitle,
    hasJD: internalAtsResult.hasJD,
    total: internalAtsResult.total,
    risk: internalAtsResult.risk,
    publicReport,
    internalAtsResult,
    retrievalQuery,
    mentorCandidates,
    freeAdvice: freeMentorPlan,
    paidAdvice,
    premiumReport,
    paymentStatus: "unpaid",
    userId: req.headers["x-user-id"] || null,
  });

  return {
    reportId,
    reportAccessToken,
    publicReport,
    internalAtsResult,
    mentorCandidates,
    freeAdvice: freeMentorPlan,
    paidAdvice,
    premiumReport,
  };
}

function logRetrievalDebug({
  reportContext,
  mentorCandidateCount,
  strictCandidateCount,
  fallbackCandidateCount,
  selectedFreeAdviceId,
  paidAdviceCount,
  roleMismatchPenalty,
  selectedScope,
  rawRows,
  eligibleRows,
  excludedInterviewAdvice,
}) {
  if (process.env.LOG_ATS_RETRIEVAL_DEBUG === "false") return;
  console.log("[Advice Retrieval]", JSON.stringify({
    reportContext,
    rawRows,
    eligibleRows,
    candidates: mentorCandidateCount,
    strictCandidates: strictCandidateCount,
    fallbackCandidates: fallbackCandidateCount,
    selectedFreeAdvice: selectedFreeAdviceId,
    selectedScope,
    excludedInterviewAdvice,
    paidAdvice: paidAdviceCount,
    roleMismatchPenalty,
  }));
}

function logAdvicePlan(freeMentorPlan, premiumMentorPlan = [], coverageSummary = {}) {
  if (process.env.LOG_ATS_RETRIEVAL_DEBUG === "false") return;
  const allAdviceCount = premiumMentorPlan.reduce((sum, mentor) => sum + (mentor.adviceItems?.length || 0), 0);
  const freeAdviceSources = (freeMentorPlan?.adviceItems || []).map((item) => item.source || "db");
  console.log("[Advice Plan]", JSON.stringify({
    freeMentor: freeMentorPlan?.mentorId || null,
    freeAdviceCount: freeMentorPlan?.adviceItems?.length || 0,
    freeAdviceSources,
    roleSafeRejected: freeMentorPlan?.debug?.roleSafeRejected || 0,
    premiumMentors: premiumMentorPlan.length,
    premiumAdviceCount: allAdviceCount,
    lockedAdviceCount: Math.max(0, allAdviceCount - (freeMentorPlan?.adviceItems?.length || 0)),
    coverageRatio: coverageSummary.coverageRatio ?? 0,
    coveredProblemTags: coverageSummary.coveredProblemTags || [],
    uncoveredProblemTags: coverageSummary.uncoveredProblemTags || [],
  }));
}

// POST /api/v1/score: public-safe ATS report. Full internals stay server-side.
app.post("/api/v1/score", upload.single("file"), async (req, res) => {
  try {
    const resumeText = await resolveResumeText(req);
    const { jobTitle, jdText } = req.body;
    if (!jobTitle && !jdText) {
      return res.status(400).json({ success: false, error: "jobTitle or jdText is required" });
    }

    const rawScoreResult = scoreResumeSystem(resumeText, jobTitle, jdText);
    const report = await buildAtsReportPayload(rawScoreResult, { resumeText, jobTitle, jdText }, req);

    const payload = {
      success: true,
      reportId: report.reportId,
      reportAccessToken: report.reportAccessToken,
      publicReport: report.publicReport,
      timestamp: new Date().toISOString(),
    };
    logPublicAtsResponseForTesting("score", payload);
    res.json(payload);
  } catch (err) {
    console.error("[ATS-Report] Error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

function reportTokenFromRequest(req) {
  return req.headers["x-report-access-token"] || req.body?.reportAccessToken || req.query?.reportAccessToken || null;
}

function reportUserFromRequest(req) {
  return req.headers["x-user-id"] ? String(req.headers["x-user-id"]) : null;
}

app.get("/api/v1/reports/:reportId/public", async (req, res) => {
  try {
    const access = await db.validateReportAccess(req.params.reportId, {
      token: reportTokenFromRequest(req),
      userId: reportUserFromRequest(req),
    });
    if (!access.ok) {
      return res.status(access.status || 403).json({ success: false, error: access.error });
    }
    res.json({
      success: true,
      reportId: req.params.reportId,
      publicReport: access.report.publicReport,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[ATS-Report] Public load error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/v1/reports/:reportId/unlock", async (req, res) => {
  try {
    const unlock = await db.validateReportUnlock(req.params.reportId, {
      token: reportTokenFromRequest(req),
      userId: reportUserFromRequest(req),
    });
    if (!unlock.ok) {
      return res.status(unlock.status || 403).json({ success: false, error: unlock.error });
    }
    res.json({
      success: true,
      reportId: req.params.reportId,
      premiumReport: unlock.report.premiumReport || formatPremiumUnlockedReport(unlock.report.internalAtsResult, unlock.report.paidAdvice),
    });
  } catch (err) {
    console.error("[ATS-Report] Unlock error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/v1/reports/:reportId/debug", async (req, res) => {
  try {
    const debugAllowed = process.env.NODE_ENV !== "production" ||
      (process.env.DEBUG_REPORT_SECRET && req.headers["x-debug-secret"] === process.env.DEBUG_REPORT_SECRET);
    if (!debugAllowed) return res.status(404).json({ success: false, error: "NOT_FOUND" });

    const report = await db.getAtsReport(req.params.reportId);
    if (!report) return res.status(404).json({ success: false, error: "REPORT_NOT_FOUND" });
    res.json({
      success: true,
      reportId: req.params.reportId,
      debugReport: formatDebugReport(report.internalAtsResult, report.mentorCandidates),
    });
  } catch (err) {
    console.error("[ATS-Report] Debug error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/reports/:reportId/mark-paid ──────────────────────────────────
// Called after payment confirmation. Marks report as paid and triggers AI rewrite.
app.post("/api/v1/reports/:reportId/mark-paid", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production" && process.env.PAYMENT_MOCK_ENABLED !== "true") {
      return res.status(404).json({ success: false, error: "NOT_FOUND" });
    }

    const { reportId } = req.params;
    const access = await db.validateReportAccess(reportId, {
      token: reportTokenFromRequest(req),
      userId: reportUserFromRequest(req),
    });
    if (!access.ok) {
      return res.status(access.status || 403).json({ success: false, error: access.error });
    }
    const report = access.report;

    await db.markAtsReportPaid(reportId, true);
    console.log(`[Payment] marked paid report_id=${reportId}`);

    // Trigger AI rewrite asynchronously (don't block response)
    triggerAiRewrite(reportId, report).catch(err =>
      console.error(`[AI-Rewrite] background error report_id=${reportId}:`, err.message)
    );

    res.json({ success: true, reportId });
  } catch (err) {
    console.error("[Payment] mark-paid error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/reports/:reportId/ai-rewrite ─────────────────────────────────
// Returns AI rewrites for a paid report. Reads from cache if already generated.
app.post("/api/v1/reports/:reportId/ai-rewrite", async (req, res) => {
  try {
    const unlock = await db.validateReportUnlock(req.params.reportId, {
      token: reportTokenFromRequest(req),
      userId: reportUserFromRequest(req),
    });
    if (!unlock.ok) {
      return res.status(unlock.status || 403).json({ success: false, error: unlock.error });
    }

    const report = unlock.report;

    // Return cached rewrites if already done
    if (report.ai_rewrites_json) {
      const cached = typeof report.ai_rewrites_json === "string"
        ? JSON.parse(report.ai_rewrites_json) : report.ai_rewrites_json;
      return res.json({ success: true, rewrites: cached, cached: true });
    }

    // Generate fresh rewrites
    const rewrites = await generateAiRewrites(report);
    await db.saveAiRewrites(req.params.reportId, rewrites);

    res.json({ success: true, rewrites, cached: false });
  } catch (err) {
    console.error("[AI-Rewrite] error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── AI rewrite helpers ─────────────────────────────────────────────────────────
async function triggerAiRewrite(reportId, report) {
  const rewrites = await generateAiRewrites(report);
  await db.saveAiRewrites(reportId, rewrites);
  console.log(`[AI-Rewrite] complete report_id=${reportId} rewrites=${rewrites.length}`);
}

async function generateAiRewrites(report) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic();

  const resumeText = report.resume_text || report.resumeText || "";
  if (!resumeText) return [];

  // Collect all advice items from premium report
  const premiumReport = report.premiumReport || report.premium_report_json || {};
  const mentors = premiumReport.mentors || [];
  const adviceItems = [];
  for (const mentor of mentors) {
    for (const item of (mentor.adviceList || mentor.adviceItems || [])) {
      adviceItems.push({
        adviceId: item.adviceId || item.id || `${mentor.mentorId}_${adviceItems.length}`,
        title: item.title || item.issue || "",
        problem: item.currentDiagnosis || item.problemSummary || item.current || "",
        action: item.action || item.actionSummary || item.strategy || "",
        example: item.example || item.E_example || "",
        mentorName: mentor.mentorName || mentor.name || "",
      });
    }
  }

  if (!adviceItems.length) return [];

  const prompt = `你是一個簡歷改寫專家。根據以下導師建議，找出用戶簡歷中對應有問題的部分，提供改寫前（before）和改寫後（after）。

用戶簡歷：
${resumeText.slice(0, 4000)}

建議列表（JSON）：
${JSON.stringify(adviceItems.map(a => ({
  adviceId: a.adviceId,
  problem: a.problem,
  action: a.action,
  example: a.example,
})), null, 2)}

請回傳 JSON 陣列，每個建議對應一個物件：
[
  {
    "adviceId": "...",
    "before": "從簡歷中找到的原始文字（如果找到的話，否則填空字串）",
    "after": "根據建議改寫後的版本",
    "section": "來自哪個簡歷板塊（如 Experience / Education / Skills）"
  }
]

只回傳 JSON 陣列，不要其他文字。`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  let text = response.content[0].text.trim();
  if (text.includes("```")) {
    text = text.split("```")[1];
    if (text.startsWith("json")) text = text.slice(4);
  }

  try {
    const parsed = JSON.parse(text.trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error("[AI-Rewrite] JSON parse failed");
    return [];
  }
}

// ── GET /api/v1/ats/health  （確認 server + API key 狀態） ───
app.get("/api/v1/ats/health", (req, res) => {
  res.json({
    success:   true,
    server:    "ok",
    ruleEngine: "ready",
    timestamp: new Date().toISOString(),
  });
});

function logPublicAtsResponseForTesting(label, payload) {
  if (process.env.LOG_ATS_PUBLIC_RESPONSE === "false") return;
  const loggedPayload = redactSensitiveLogPayload(payload);
  console.log(`\n[ATS Public Response][${label}]`);
  console.log(JSON.stringify(loggedPayload, null, 2));
  console.log("[/ATS Public Response]\n");
}

function redactSensitiveLogPayload(payload) {
  return {
    ...payload,
    reportAccessToken: payload.reportAccessToken ? "[REDACTED]" : payload.reportAccessToken,
  };
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const server = app.listen(PORT, () => {
  console.log("Resume Fix MVP running at http://localhost:" + PORT);
  console.log("Database: Supabase (PostgreSQL)");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const nextPort = (server.address()?.port || PORT) + 1;
    console.warn(`[server] Port ${PORT} in use, trying ${nextPort}...`);
    server.listen(nextPort);
  } else {
    throw err;
  }
});
