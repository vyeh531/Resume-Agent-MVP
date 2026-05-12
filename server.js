require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");
const { scoreResumeATS } = require("./ats-scorer");
const { parsePDF, parseDocx } = require("./file-parser");
const db = require("./database");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const PORT = process.env.PORT || 3000;

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
    console.log("[ATS] Scoring resume:", { resumeLength: resumeText.length, jobTitle: jobTitle || "N/A", hasJD: !!jdText });
    const result = await scoreResumeATS(resumeText, jobTitle, jdText);
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

app.post("/api/resume/:id/mark-paid", (req, res) => {
  try {
    db.markAsPaid(req.params.id, true);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

function fuzzyRow(d, table, cols, jobTitle) {
  const sel = "SELECT " + cols + " FROM " + table;
  let row = d.prepare(sel + " WHERE LOWER(position_title) = LOWER(?) LIMIT 1").get(jobTitle);
  if (!row) row = d.prepare(sel + " WHERE LOWER(position_title) LIKE LOWER(?) OR LOWER(?) LIKE LOWER('%' || position_title || '%') LIMIT 1").get("%" + jobTitle + "%", jobTitle);
  if (!row) {
    for (const w of jobTitle.split(/\s+/).filter(w => w.length > 2)) {
      row = d.prepare(sel + " WHERE LOWER(position_title) LIKE LOWER(?) LIMIT 1").get("%" + w + "%");
      if (row) break;
    }
  }
  return row;
}

app.get("/api/position-salary", (req, res) => {
  try {
    const jobTitle = (req.query.jobTitle || "").trim();
    if (!jobTitle) return res.status(400).json({ error: "jobTitle is required" });
    const d = db.getDB();
    const row = fuzzyRow(d, "position_skills", "position_title, salary_range", jobTitle);
    if (!row) return res.json({ success: true, found: false, salary_range: null });
    console.log("[DB] position salary found:", row.position_title, row.salary_range);
    res.json({ success: true, found: true, position_title: row.position_title, salary_range: row.salary_range });
  } catch (error) {
    console.error("[DB] position-salary error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/positions", (req, res) => {
  try {
    const d = db.getDB();
    const rows = d.prepare("SELECT position_title FROM position_skills ORDER BY position_title").all();
    res.json({ success: true, data: rows.map(r => r.position_title) });
  } catch (error) {
    console.error("[DB] positions error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/position-skills", (req, res) => {
  try {
    const jobTitle   = (req.query.jobTitle   || "").trim();
    const resumeText = (req.query.resumeText || "").toLowerCase();
    if (!jobTitle) return res.status(400).json({ error: "jobTitle is required" });
    const d = db.getDB();
    const row = fuzzyRow(d, "position_skills", "*", jobTitle);
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
    const d = db.getDB();
    const kw = "%" + (jobTitle || "").toLowerCase() + "%";

    // ── 1. Segments (4-tier priority) ──────────────────────────
    let segments = [];
    const tier1 = d.prepare(
      "SELECT * FROM segments WHERE generality='universal' AND (confidence='high' OR confidence IS NULL)" +
      " AND (LOWER(topic) LIKE ? OR LOWER(L1) LIKE ? OR LOWER(L2) LIKE ?)" +
      " ORDER BY background_fit DESC LIMIT 6"
    ).all(kw, kw, kw);
    segments.push(...tier1);

    if (segments.length < 5) {
      const tier2 = d.prepare(
        "SELECT * FROM segments WHERE generality='universal' AND (confidence='high' OR confidence IS NULL)" +
        " ORDER BY background_fit DESC LIMIT 8"
      ).all();
      const ids = new Set(segments.map(s => s.id));
      for (const s of tier2) { if (!ids.has(s.id)) segments.push(s); }
    }

    const tier3 = d.prepare(
      "SELECT * FROM segments WHERE (generality='industry-specific' OR generality='role-specific')" +
      " AND (LOWER(topic) LIKE ? OR LOWER(L1) LIKE ? OR LOWER(L2) LIKE ?)" +
      " ORDER BY industry_fit ASC LIMIT 5"
    ).all(kw, kw, kw);
    { const ids = new Set(segments.map(s => s.id)); for (const s of tier3) { if (!ids.has(s.id)) segments.push(s); } }

    if (segments.length < 8) {
      const tier4 = d.prepare("SELECT * FROM segments ORDER BY background_fit DESC LIMIT 12").all();
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
      const found = d.prepare(
        "SELECT * FROM before_after_pairs WHERE LOWER(issue_tags_json) LIKE ? OR LOWER(\"before\") LIKE ? OR LOWER(reason) LIKE ? LIMIT 3"
      ).all("%" + w + "%", "%" + w + "%", "%" + w + "%");
      pairs.push(...found);
      if (pairs.length >= 12) break;
    }
    if (pairs.length < 6) {
      const fb = d.prepare("SELECT * FROM before_after_pairs ORDER BY RANDOM() LIMIT 12").all();
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
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log("Resume Fix MVP running at http://localhost:" + PORT);
  console.log("Database: mentor_kb-v5.db");
});
