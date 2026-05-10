/* API Client for local ATS scoring */

const API_BASE = "http://localhost:3000";

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

// 上传并解析 PDF
async function uploadAndParsePDF(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", "pdf");

  try {
    const response = await fetch(`${API_BASE}/api/parse-file`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "PDF 解析失败");
    }

    const result = await response.json();
    return result.text;
  } catch (error) {
    throw new Error(`PDF 解析失败: ${error.message}`);
  }
}

// 上传并解析 DOCX
async function uploadAndParseDocx(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", "docx");

  try {
    const response = await fetch(`${API_BASE}/api/parse-file`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Word 文件解析失败");
    }

    const result = await response.json();
    return result.text;
  } catch (error) {
    throw new Error(`Word 文件解析失败: ${error.message}`);
  }
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
  console.log("[API] 请求地址:", `${API_BASE}/api/score-resume`);

  try {
    const response = await fetch(`${API_BASE}/api/score-resume`, {
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
    if (result.sessionId) {
      try {
        const store = JSON.parse(localStorage.getItem("resumeFixMVP") || "{}");
        store.sessionId = result.sessionId;
        localStorage.setItem("resumeFixMVP", JSON.stringify(store));
        console.log("[API] sessionId 已存入 localStorage:", result.sessionId);
      } catch (e) {
        console.warn("[API] sessionId 寫入 localStorage 失敗:", e.message);
      }
    }

    return result.data;
  } catch (error) {
    console.error("[API Error]", error.message);
    throw error;
  }
}

// 從伺服器重新撈取評分結果（用 sessionId）
async function loadAnalysisFromServer(sessionId) {
  const id = sessionId || (() => {
    try {
      return JSON.parse(localStorage.getItem("resumeFixMVP") || "{}").sessionId;
    } catch { return null; }
  })();

  if (!id) {
    console.warn("[API] 沒有 sessionId，無法從伺服器載入");
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/api/resume/${id}`);
    if (!response.ok) {
      console.warn("[API] 載入失敗:", response.status);
      return null;
    }
    const result = await response.json();
    console.log("[API] 從 DB 載入評分結果:", id);
    return result.data;
  } catch (error) {
    console.error("[API] loadAnalysisFromServer error:", error.message);
    return null;
  }
}

// 格式化 ATS 结果用于显示
function formatATSResult(atsData) {
  return {
    atsScore: atsData.basicScore || 60,
    riskLevel: atsData.riskLevel || "中",
    scoringBasis: atsData.scoringBasis || "通用方向估算",
    itemScores: atsData.itemScores || {},
    keyProblems: atsData.keyProblems || [],
    suggestions: atsData.suggestions || [],
    improvementExpectation:
      atsData.improvementExpectation || "基础分 60-70 → 改进后 75-85",
    rawResponse: atsData.rawResponse || "",
  };
}
