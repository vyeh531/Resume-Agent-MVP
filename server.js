const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");
const { scoreResumeATS } = require("./ats-scorer");
const { parsePDF, parseDocx } = require("./file-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// 文件上传配置
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB 限制
  fileFilter: (req, file, cb) => {
    const allowed = [
      ".pdf",
      ".docx",
      ".doc",
      ".txt",
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  },
});

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 文件解析端点
app.post("/api/parse-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "未上传文件" });
    }

    const fileType = req.body.type || "unknown";
    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    console.log(`[Parser] 解析文件: ${fileName} (${fileType})`);

    let text = "";

    if (
      fileType === "pdf" ||
      fileName.toLowerCase().endsWith(".pdf")
    ) {
      text = await parsePDF(fileBuffer);
    } else if (
      fileType === "docx" ||
      fileName.toLowerCase().endsWith(".docx")
    ) {
      text = await parseDocx(fileBuffer);
    } else if (
      fileType === "txt" ||
      fileName.toLowerCase().endsWith(".txt")
    ) {
      text = fileBuffer.toString("utf-8");
    } else {
      return res.status(400).json({
        error: `不支持的文件类型: ${fileType}`,
      });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        error: "文件内容为空或解析失败",
      });
    }

    res.json({
      success: true,
      text: text,
      fileName: fileName,
      length: text.length,
    });
  } catch (error) {
    console.error("[Parser Error]", error);
    res.status(500).json({
      error: error.message,
      details: error.toString(),
    });
  }
});

// ATS scoring endpoint
app.post("/api/score-resume", async (req, res) => {
  try {
    const { resumeText, jobTitle, jdText } = req.body;

    if (!resumeText) {
      return res.status(400).json({ error: "resumeText is required" });
    }

    console.log("[ATS] Scoring resume:", {
      resumeLength: resumeText.length,
      jobTitle: jobTitle || "N/A",
      hasJD: !!jdText,
    });

    const result = await scoreResumeATS(resumeText, jobTitle, jdText);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ATS] Error:", error.message);
    res.status(500).json({
      error: error.message,
      details: error.toString(),
    });
  }
});

// Root route - serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Listen
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  Resume Fix MVP - 本地 ATS 评分系统    ║
║  Server running at http://localhost:${PORT}   ║
║                                        ║
║  Ollama must be running at:            ║
║  http://localhost:11434                ║
╚════════════════════════════════════════╝
  `);
});
