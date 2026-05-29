/* API Client for local ATS scoring */

const API_BASE = "";

// 检查 API 可用性
async function checkAPIHealth() {
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      method: "GET",
      timeout: 5000,
    });
    return response.ok;
  } catch (e) {
    console.warn("[API] Server not available:", e.message);
    return false;
  }
}

// 从文件读取简历文本（支持 .txt, .pdf, .docx）
async function readResumeFile(file) {
  const type = file.type;
  const fileName = file.name.toLowerCase();

  // 纯文本
  if (type === "text/plain" || fileName.endsWith(".txt")) {
    return readTextFile(file);
  }

  // PDF
  if (type === "application/pdf" || fileName.endsWith(".pdf")) {
    return uploadAndParsePDF(file);
  }

  // Word (.docx / .doc)
  if (
    fileName.endsWith(".docx") ||
    fileName.endsWith(".doc") ||
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "application/msword"
  ) {
    return uploadAndParseDocx(file);
  }

  throw new Error(
    `不支持的文件格式: ${fileName}。请上传 .txt, .pdf 或 .docx 文件。`
  );
}

// 读取纯文本文件
function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    reader.onerror = () => {
      reject(new Error("无法读取文本文件"));
    };
    reader.readAsText(file);
  });
}

// 安全读取 response body，返回 { ok, json, text, status }
async function safeParseResponse(response) {
  const status = response.status;
  const raw = await response.text();
  let json = null;
  try { json = JSON.parse(raw); } catch {}
  return { ok: response.ok, status, json, text: raw };
}

// 上传并解析 PDF
async function uploadAndParsePDF(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", "pdf");

  const response = await fetch(`${API_BASE}/api/parse-file`, {
    method: "POST",
    body: formData,
  });

  const { ok, status, json } = await safeParseResponse(response);
  if (!ok) {
    const msg = (json && json.error) || `服务器错误 (${status})，请重试或换用 .txt 格式`;
    throw new Error(msg);
  }
  if (!json || !json.text) throw new Error("PDF 解析结果为空，可能是扫描版 PDF，请改用文字版");
  return json.text;
}

// 上传并解析 DOCX
async function uploadAndParseDocx(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", "docx");

  const response = await fetch(`${API_BASE}/api/parse-file`, {
    method: "POST",
    body: formData,
  });

  const { ok, status, json } = await safeParseResponse(response);
  if (!ok) {
    const msg = (json && json.error) || `服务器错误 (${status})，请重试`;
    throw new Error(msg);
  }
  if (!json || !json.text) throw new Error("Word 文件解析结果为空");
  return json.text;
}

// 调用 ATS 评分 API
async function scoreResumeAPI(resumeText, jobTitle, jdText) {
  const payload = {
    resumeText: resumeText,
    jobTitle: jobTitle || null,
    jdText: jdText || null,
  };

  console.log("[API] 开始调用 scoreResumeAPI...");
  console.log("[API] 简历长度:", resumeText.length);
  console.log("[API] 目标岗位:", jobTitle);
  console.log("[API] 请求地址:", `${API_BASE}/api/v1/score`);

  try {
    const response = await fetch(`${API_BASE}/api/v1/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("[API] 响应状态:", response.status);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error ||
          `API Error: ${response.status}`
      );
    }

    const result = await response.json();
    console.log("[API] 评分结果:", result.data);

    // 把 sessionId 存入 localStorage，方便後續重新撈取
    if (result.reportId) {
      try {
        const store = JSON.parse(localStorage.getItem("resumeFixMVP") || "{}");
        store.sessionId = result.reportId;
        store.reportId = result.reportId;
        store.reportAccessToken = result.reportAccessToken || null;
        localStorage.setItem("resumeFixMVP", JSON.stringify(store));
        console.log("[API] reportId 已存入 localStorage:", result.reportId);
      } catch (e) {
        console.warn("[API] sessionId 寫入 localStorage 失敗:", e.message);
      }
    }

    const publicReport = result.publicReport || result.data || {};
    return {
      ...publicReport,
      premiumMentors: result.premiumMentors || null,
      reportId: result.reportId || null,
      reportAccessToken: result.reportAccessToken || null,
    };
  } catch (error) {
    console.error("[API Error]", error.message);
    throw error;
  }
}

// 從伺服器重新撈取評分結果（用 sessionId）
async function loadAnalysisFromServer(sessionId) {
  const id = sessionId || (() => {
    try {
      const store = JSON.parse(localStorage.getItem("resumeFixMVP") || "{}");
      return store.reportId || store.sessionId;
    } catch { return null; }
  })();

  if (!id) {
    console.warn("[API] 沒有 sessionId，無法從伺服器載入");
    return null;
  }

  try {
    const store = JSON.parse(localStorage.getItem("resumeFixMVP") || "{}");
    const token = store.reportAccessToken;
    const query = token ? `?reportAccessToken=${encodeURIComponent(token)}` : "";
    const response = await fetch(`${API_BASE}/api/v1/reports/${id}/public${query}`);
    if (!response.ok) {
      console.warn("[API] 載入失敗:", response.status);
      return null;
    }
    const result = await response.json();
    console.log("[API] 從 DB 載入評分結果:", id);
    return result.publicReport || result.data;
  } catch (error) {
    console.error("[API] loadAnalysisFromServer error:", error.message);
    return null;
  }
}

function computeKeywordMatchRatio(keywordMatch) {
  let total = 0;
  let matched = 0;
  Object.values(keywordMatch || {}).forEach((group) => {
    if (!group || typeof group !== "object") return;
    total += Number(group.total || 0);
    matched += Number(group.matched || 0);
  });
  return total ? Number(((matched / total) * 100).toFixed(1)) : null;
}

function normalizeDimensionProblems(dimensions, explicitProblems) {
  if (explicitProblems && Object.keys(explicitProblems).length) {
    return explicitProblems;
  }
  return Object.fromEntries(
    Object.entries(dimensions || {}).map(([key, value]) => [
      key,
      Array.isArray(value?.problems) ? value.problems : [],
    ])
  );
}

// 格式化 ATS 结果用于显示
function formatATSResult(atsData) {
  const dimensions = atsData.dimensions || {};
  const keywordMatch = atsData.keywordMatch || atsData.metrics?.keywordMatch || {};
  const jdMatchRatio = atsData.jdMatchRatio ?? atsData.metrics?.jdMatchRatio ?? computeKeywordMatchRatio(keywordMatch);
  return {
    atsScore: atsData.total ?? atsData.basicScore ?? 60,
    riskLevel: atsData.risk || atsData.riskLevel || "中",
    scoringBasis: atsData.scoringBasis || (atsData.source === "local-fallback" ? "ATS System 本地备援评分（无 Claude/OpenAI）" : "ATS System API 评分（无 Claude/OpenAI）"),
    itemScores: atsData.itemScores || Object.fromEntries(
      Object.entries(dimensions).map(([key, value]) => [key, value.score])
    ),
    keyProblems: atsData.problems || atsData.keyProblems || [],
    suggestions: atsData.suggestions || [],
    improvementExpectation:
      atsData.improvement || atsData.improvementExpectation || "基础分 60-70 → 改进后 75-85",
    rawResponse: atsData.rawResponse || "",
    dimensions,
    jdMatchRatio,
    topMissingKw: atsData.topMissingKw || atsData.topMissingKeywords || [],
    engine: atsData.engine || "ats-system-api",
    source: atsData.source || "hosted-api",
    jobTitle: atsData.jobTitle || null,
    hasJD: Boolean(atsData.hasJD),
    metrics: atsData.metrics || { keywordMatch },
    keywordMatch,
    dimensionProblems: normalizeDimensionProblems(dimensions, atsData.dimensionProblems),
    formatPenaltyTriggered: Boolean(atsData.formatPenaltyTriggered),
    formatPenaltyReason: atsData.formatPenaltyReason || [],
    keywordBreakdown: atsData.keywordBreakdown || [],
    raw: atsData,
  };
}
