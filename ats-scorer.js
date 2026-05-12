require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ATS_PROMPT = `你是一套嚴格的 ATS 簡歷篩選系統，模擬真實的 Applicant Tracking System 機器評分邏輯。

【鐵律 — 必須遵守，違反視為評分無效】
1. 所有維度從 0 分開始，靠具體文本證據賺分，絕對不給任何「基礎分」。
2. 不得因為學校名氣、公司品牌、語氣專業或「整體看起來不錯」而額外加分。
3. 未出現在簡歷文本中的任何信息，不得推斷或假設存在。
4. JD 未提供時，D 維度最高只能給 18 分（上限），並標注「通用估算」。
5. 評分標準以「能否通過首輪機器篩選」為唯一基準，不評價簡歷是否「用心」。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【評分結構 — 共 100 分，D 維度為核心差異化指標】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A  格式與解析兼容性        15 分
B  資訊完整性              10 分
C  內容品質與成果表達      25 分
D  JD 關鍵字匹配度         40 分  ← 最高權重，ATS 機篩核心
E  投遞完成度              10 分
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【A：格式與解析兼容性（0–15 分）】
從 0 開始，依據以下條件加分：
  有 Experience 章節                +3
  有 Education 章節                 +3
  有 Skills 章節                    +3
  有 Projects / Summary 等輔助章節  +2（最多 +2）
  有清晰 bullet point（≥5 條）      +3
  有表格/特殊框架導致解析困難       -3
  簡歷總字數 < 400 字               -4

【B：資訊完整性（0–10 分）】
從 0 開始：
  含有效 email                      +3（缺少則視為嚴重問題，不得補其他分）
  含電話號碼                        +1
  含 LinkedIn 連結                  +2
  含 GitHub 連結                    +1
  每段工作/學歷有明確年份           +2（需出現 ≥2 個年份）
  缺少 email                        -3

【C：內容品質與成果表達（0–25 分）】
從 0 開始：

量化指標（%、$、K+、倍速、具體件數）：
  ≥8 個有效量化數字   → +12
  5–7 個             → +9
  3–4 個             → +6
  1–2 個             → +3
  0 個               → 0 分（必須明確指出）

行動動詞（bullet 行首強動詞：led/built/reduced/increased/launched 等）：
  ≥6 種不重複強動詞  → +7
  3–5 種             → +4
  1–2 種             → +2
  以 helped/assisted/worked on 開頭  → +0

成果導向語言（result/impact/improved/reduced/generated...）：
  ≥5 處              → +6
  2–4 處             → +3
  0–1 處             → +1

【D：JD 關鍵字匹配度（0–40 分）—— 核心維度，嚴格評分】
步驟：提取 JD 中的 hard skill、role-specific 術語（去停用詞），統計簡歷覆蓋率。

  覆蓋率 ≥ 70%   → 40 分
  60–69%          → 34 分
  50–59%          → 27 分
  40–49%          → 20 分
  30–39%          → 13 分
  20–29%          → 7 分
  10–19%          → 3 分
  < 10%           → 0 分

重要：50% 以下覆蓋率在真實 ATS 系統中幾乎必被過濾，必須在關鍵問題中明確指出。
若無 JD：以行業通用詞估算，D 最高不超過 18 分。

【E：投遞完成度（0–10 分）】
從 0 開始：
  文字量充足（>800 字）    +3
  含 Summary/Objective    +2
  三個核心章節齊全         +3
  有針對性量化成果且結構清晰 +2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【校準錨點 — 對照確保評分不虛高】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
35–50 分：格式基本，幾乎無量化，JD 匹配 <20%（典型未針對性修改的應屆生簡歷）
50–60 分：格式完整，少量量化，JD 匹配 20–35%
60–70 分：有量化（3–5 個），格式良好，JD 匹配 35–50%
70–80 分：量化豐富，強動詞，JD 匹配 50–65%
80–90 分：每條 bullet 均有量化，JD 匹配 65–75%
90+ 分：高度針對性訂製，JD 匹配 ≥75%，每條 bullet 可量化

大多數學生未針對 JD 訂製的簡歷，總分應在 45–65 分區間。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【輸出格式（嚴格按照此結構，不得省略任何部分）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
（1）ATS基礎分：X / 100
（2）風險等級：低 / 中 / 高  （低 = ≥75；中 = 55–74；高 = <55）
（3）評分口徑：[是否提供 JD；若無則寫「通用方向估算」]
（4）分項得分：
  | 維度 | 名稱 | 得分 | 滿分 |
  |------|------|------|------|
  | A | 格式與解析兼容性 | X | 15 |
  | B | 資訊完整性 | X | 10 |
  | C | 內容品質與成果表達 | X | 25 |
  | D | JD 關鍵字匹配度 | X | 40 |
  | E | 投遞完成度 | X | 10 |
（5）關鍵問題：至少 4 條，按分值影響大小排序，每條說明「哪裡缺、缺多少、損失幾分」
（6）優先修改建議：至少 3 條，具體說明怎麼改、改後能加幾分
（7）提分預期：保守估算，給出具體分數區間（格式：X → Y–Z 分）

語氣要求：專業、保守、可復核。不得輸出「整體不錯」等模糊正面評價。`;

async function callClaude(resumeText, jobTitle, jdText) {
  const parts = [ATS_PROMPT, "\n\n[简历信息]\n" + resumeText];
  if (jobTitle) parts.push("\n[目标岗位]\n" + jobTitle);
  if (jdText)   parts.push("\n[岗位 JD]\n" + jdText);
  parts.push("\n\n请开始评分：");

  console.log("[Claude] Calling Claude scoring model...");
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: parts.join("") }],
  });
  console.log("[Claude] Done. stop_reason:", message.stop_reason);
  return message.content[0].text;
}

function parseATSResponse(text) {
  const result = {
    rawResponse: text,
    basicScore: null,
    riskLevel: null,
    scoringBasis: null,
    itemScores: {},
    keyProblems: [],
    suggestions: [],
    improvementExpectation: null,
  };

  console.log("[Parser] Response length:", text.length);

  // ── (1) Basic score ──────────────────────────────────────
  const scoreMatch =
    text.match(/（1）[^\n]*\n[^\n]*\*?\*?(\d+)\s*\/\s*100/) ||
    text.match(/ATS[^：\n]*[：:]\s*\*?\*?(\d+)\*?\*?\s*\/\s*100/) ||
    text.match(/\*\*(\d+)\s*\/\s*100\*\*/);
  if (scoreMatch) {
    result.basicScore = parseInt(scoreMatch[1]);
    console.log("[Parser] basicScore:", result.basicScore);
  }

  // ── (2) Risk level ───────────────────────────────────────
  const riskMatch =
    text.match(/风险等级[^低中高\n]*\*?\*?(低|中|高)\*?\*?/) ||
    text.match(/（2）[^低中高\n]*\*?\*?(低|中|高)\*?\*?/);
  if (riskMatch) {
    result.riskLevel = riskMatch[1];
    console.log("[Parser] riskLevel:", result.riskLevel);
  }

  // ── (3) Scoring basis ────────────────────────────────────
  const basisMatch = text.match(/（3）[^\n]*\n([\s\S]*?)(?=---\n|（4）|\n## （4）)/);
  if (basisMatch) {
    result.scoringBasis = basisMatch[1].replace(/\*\*/g, "").replace(/\n/g, " ").trim().substring(0, 200);
    console.log("[Parser] scoringBasis:", result.scoringBasis.substring(0, 60));
  }

  // ── (4) Item scores ──────────────────────────────────────
  // Claude outputs two table formats:
  // A) | **A** | item name | score | max |
  // B) | **A name** | max | score | desc |
  const lines = text.split('\n');
  const tableStart = lines.findIndex(l =>
    l.includes('分项得分') || l.includes('| 维度') || l.includes('| 模块')
  );
  if (tableStart !== -1) {
    for (let i = tableStart; i < Math.min(tableStart + 30, lines.length); i++) {
      const line = lines[i];
      if (!line.includes('|')) continue;
      const cols = line.split('|').map(s => s.trim()).filter(Boolean);
      if (cols.length < 3) continue;

      // Find which column has an A-E letter (possibly with bold markers)
      const letterCol = cols.findIndex(c => /^\*?\*?[A-E](\*?\*?$|\s)/.test(c));
      if (letterCol === -1) continue;
      const letter = cols[letterCol].replace(/\*/g, '').trim()[0];

      // Find numeric columns
      const nums = cols.map((c, idx) => ({ idx, val: parseInt(c.replace(/\*/g, '')) }))
        .filter(x => !isNaN(x.val) && x.val > 0 && x.val <= 40);
      if (nums.length === 0) continue;

      // Actual score = smaller number (never exceeds max)
      const score = Math.min(...nums.map(x => x.val));
      result.itemScores[letter] = score;
      console.log(`[Parser] item ${letter}: ${score}`);
    }
  }

  if (Object.keys(result.itemScores).length === 0 && result.basicScore) {
    console.warn("[Parser] itemScores not parsed, estimating");
    const r = result.basicScore / 100;
    result.itemScores = {
      A: Math.round(15 * r), B: Math.round(10 * r),
      C: Math.round(25 * r), D: Math.round(40 * r), E: Math.round(10 * r),
    };
  }
  console.log("[Parser] itemScores:", result.itemScores);

  // ── (5) Key problems ─────────────────────────────────────
  // Section starts at （5）, ends before （6）
  const probSection = extractSection(text, '（5）', '（6）');
  if (probSection) {
    // Split on "**问题 N" or "**① " or "**N." or "① " patterns
    const items = splitBullets(probSection, [
      /\n\*\*问题\s*\d+/,
      /\n\*?\*?[①②③④⑤⑥]\*?\*?/,
      /\n\*\*[\d]+\./,
    ]);
    result.keyProblems = items
      .map(s => cleanItem(s))
      .filter(s => s.length > 20 && !s.match(/^（按.*排序）/) && !s.match(/^[-—]+$/))
      .slice(0, 6)
      .map(s => s.substring(0, 300));
    console.log("[Parser] keyProblems count:", result.keyProblems.length);
  }

  // ── (6) Suggestions ──────────────────────────────────────
  const sugSection = extractSection(text, '（6）', '（7）');
  if (sugSection) {
    const items = splitBullets(sugSection, [
      /\n\*\*建议\s*\d+/,          // **建议 1：
      /\n\*?\*?建议[一二三四五六]/,  // **建议一
      /\n\d+\.\s+\*\*/,             // 1. **
    ]);
    result.suggestions = items
      .map(s => {
        // Take first non-empty line as the title
        const firstLine = s.split('\n').find(l => l.trim().length > 3) || s;
        return cleanItem(firstLine);
      })
      .filter(s => s.length > 5)
      .slice(0, 6)
      .map(s => s.substring(0, 200));
    console.log("[Parser] suggestions count:", result.suggestions.length);
  }

  // ── (7) Improvement expectation ──────────────────────────
  const impSection = extractSection(text, '（7）', null);
  if (impSection) {
    // Look for score range pattern first: "71 → 79-83" or "60 → 75-80"
    const rangeMatch = impSection.match(/(\d+)\s*[→→\->]+\s*(\d+[\s–\-~～至到]+\d+)/);
    if (rangeMatch) {
      result.improvementExpectation = `${rangeMatch[1]} → ${rangeMatch[2]}`;
    } else {
      // Fall back to first meaningful line
      const firstLine = impSection.split('\n').find(l => l.replace(/[*>\s]/g,'').length > 5) || '';
      result.improvementExpectation = cleanItem(firstLine).substring(0, 120);
    }
    console.log("[Parser] improvementExpectation:", result.improvementExpectation);
  } else {
    console.warn("[Parser] improvementExpectation not found");
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────

/** Extract text between two section markers (handles ## （N） or （N） formats) */
function extractSection(text, startMarker, endMarker) {
  const startRe = new RegExp(escapeRe(startMarker).replace('（', '[（(]').replace('）', '[）)]'));
  const startIdx = text.search(startRe);
  if (startIdx === -1) return null;
  const after = text.slice(startIdx);
  if (!endMarker) return after;
  const endRe = new RegExp(escapeRe(endMarker).replace('（', '[（(]').replace('）', '[）)]'));
  const endIdx = after.search(endRe);
  return endIdx === -1 ? after : after.slice(0, endIdx);
}

/** Split a section into bullet items using an array of possible delimiter patterns */
function splitBullets(text, patterns) {
  for (const pat of patterns) {
    const parts = text.split(pat);
    if (parts.length > 2) return parts.slice(1); // first part is the section header
  }
  // Fallback: split by blank line or long dashes
  return text.split(/\n\n+/).filter(s => s.trim().length > 10);
}

function cleanItem(s) {
  return s
    .replace(/^\*\*|\*\*$/g, '')   // strip leading/trailing bold
    .replace(/\*\*/g, '')           // strip all bold
    .replace(/^[#>*\-\s]+/, '')     // strip leading markdown symbols
    .replace(/\n/g, ' ')
    .trim();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Main export ──────────────────────────────────────────────

async function scoreResumeATS(resumeText, jobTitle, jdText) {
  if (!resumeText || resumeText.trim().length === 0) throw new Error("Resume text is empty");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set in .env");

  const response = await callClaude(resumeText, jobTitle, jdText);
  const parsed = parseATSResponse(response);
  if (parsed.basicScore === null) parsed.basicScore = 60;
  return parsed;
}

module.exports = { scoreResumeATS, parseATSResponse };
