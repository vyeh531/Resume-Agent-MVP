"use strict";
/**
 * ats-rule-scorer.js  —  Rule-based ATS Scorer (no API key required)
 * 維度權重：A/15  B/10  C/25  D/40  E/10  = 100 分
 * D（JD 關鍵字）佔 40 分，是最大差異化指標
 */

// ── 停用詞 ───────────────────────────────────────────────────
const STOP = new Set([
  "the","a","an","and","or","of","in","to","for","is","are","be","on","at","with",
  "that","this","we","you","our","your","as","by","it","its","from","will","can",
  "have","has","been","not","all","also","more","other","their","than","into","was",
  "were","but","may","use","used","using","per","new","strong","ability","experience",
  "including","such","both","based","role","work","team","make","well","able","good",
  "any","who","how","what","they","each","when","about","then","some","these","those",
  "there","here","time","very","just","like","over","only","which","after","before",
  "while","need","should","would","could","them","had","its","are",
]);

function extractKeywords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}

// ── 強動詞表 ─────────────────────────────────────────────────
const STRONG_VERBS = new Set([
  "led","built","developed","designed","implemented","launched","improved",
  "increased","reduced","created","managed","optimized","analyzed","deployed",
  "architected","owned","coordinated","delivered","scaled","automated","engineered",
  "established","drove","executed","spearheaded","streamlined","accelerated",
  "collaborated","partnered","produced","generated","secured","negotiated",
  "trained","mentored","diagnosed","integrated","migrated","refactored",
  "leveraged","authored","researched","performed","conducted",
  "translated","identified","supported","directed",
]);

// ── 主評分函式 ────────────────────────────────────────────────
function scoreResumeRuleBased(resumeText, jobTitle, jdText) {
  if (!resumeText || resumeText.trim().length === 0)
    throw new Error("resumeText is required");

  const rt      = resumeText.toLowerCase();
  const rtLines = resumeText.split("\n");
  const bulletLines = rtLines.filter(l => /^\s*[•\-\*·●▪◦▸►]\s/.test(l));

  // ── A: 格式兼容性 /15 ─────────────────────────────────────
  let A = 0;
  const coreSec = ["experience","education","skills"].filter(s => rt.includes(s)).length;
  A += coreSec * 3;                                         // 0–9
  const extSec = ["projects","summary","objective","certifications","awards"]
    .filter(s => rt.includes(s)).length;
  A += Math.min(2, extSec);                                 // 0–2
  if      (bulletLines.length >= 8) A += 3;
  else if (bulletLines.length >= 4) A += 2;
  else if (bulletLines.length >= 1) A += 1;                 // 0–3
  if (resumeText.length < 400)  A = Math.max(0, A - 4);
  if (resumeText.length > 9000) A = Math.max(0, A - 2);
  A = Math.max(0, Math.min(15, A));

  // ── B: 資訊完整性 /10 ─────────────────────────────────────
  let B = 0;
  if (/@[\w.-]+\.\w{2,}/.test(resumeText))               B += 3;
  if (/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(resumeText)) B += 1;
  if (/linkedin/i.test(rt))                               B += 2;
  if (/github/i.test(rt))                                 B += 1;
  if (/education|university|bachelor|master|degree/i.test(rt)) B += 2;
  const dateCount = (resumeText.match(/\b20\d{2}\b/g) || []).length;
  if (dateCount >= 4) B += 1;
  B = Math.max(0, Math.min(10, B));

  // ── C: 內容品質 /25 ───────────────────────────────────────
  let C = 0;

  // 量化指標（排除年份）
  const rawNums = (resumeText.match(
    /\d+\s*[%％]|\$[\d,]+[kKmMbB]?|\b\d+[kKmMbB]\b|\b[1-9]\d{3,}\b/g
  ) || []).filter(m => !/^20[0-2]\d$/.test(m.replace(/[^0-9]/g, "")));
  const numMatches = rawNums.length;
  if      (numMatches >= 8) C += 12;
  else if (numMatches >= 5) C += 9;
  else if (numMatches >= 3) C += 6;
  else if (numMatches >= 1) C += 3;

  // 行首強動詞
  const verbHits = [...STRONG_VERBS].filter(v =>
    rtLines.some(l => new RegExp("^\\s*[•\\-\\*·●▪◦▸►]?\\s*" + v + "\\b", "i").test(l))
  ).length;
  if      (verbHits >= 8) C += 8;
  else if (verbHits >= 5) C += 6;
  else if (verbHits >= 3) C += 3;
  else if (verbHits >= 1) C += 1;

  // 成果語言
  const resultHits = (resumeText.match(
    /\b(result|impact|improv|reduc|increas|achiev|enabl|boost|cut\b|sav|generat|drove|deliver)/gi
  ) || []).length;
  if      (resultHits >= 6) C += 5;
  else if (resultHits >= 3) C += 3;
  else if (resultHits >= 1) C += 1;

  C = Math.max(0, Math.min(25, C));

  // ── D: JD 關鍵字 /40（核心） ─────────────────────────────
  const jdKwRaw    = jdText ? extractKeywords(jdText).filter(w => w.length > 3) : [];
  const uniqueJdKw = [...new Set(jdKwRaw)];
  const hits       = uniqueJdKw.filter(w => rt.includes(w)).length;
  const matchRatio = uniqueJdKw.length > 0 ? hits / uniqueJdKw.length : 0;
  let D;
  if      (matchRatio >= 0.70) D = 40;
  else if (matchRatio >= 0.60) D = 34;
  else if (matchRatio >= 0.50) D = 27;
  else if (matchRatio >= 0.40) D = 20;
  else if (matchRatio >= 0.30) D = 13;
  else if (matchRatio >= 0.20) D = 7;
  else if (matchRatio >= 0.10) D = 3;
  else                          D = 0;
  if (!jdText) D = Math.min(D, 18);   // 無 JD 時上限 18

  // ── E: 投遞完成度 /10 ─────────────────────────────────────
  let E = 0;
  if      (resumeText.length > 1500) E += 3;
  else if (resumeText.length > 700)  E += 2;
  else if (resumeText.length > 400)  E += 1;
  if (/@/.test(resumeText))                         E += 3;
  if (/summary|objective|profile|about/i.test(rt)) E += 2;
  if (coreSec >= 3)                                 E += 2;
  E = Math.max(0, Math.min(10, E));

  const total = A + B + C + D + E;
  const risk  = total >= 75 ? "低" : total >= 55 ? "中" : "高";
  const missing = uniqueJdKw.filter(w => !rt.includes(w));

  // ── 問題清單 ───────────────────────────────────────────────
  const problems = [];
  if (matchRatio < 0.40)
    problems.push(`JD 關鍵字匹配率僅 ${(matchRatio * 100).toFixed(0)}%（需 ≥50% 通過機篩），D 維度損失 ${40 - D} 分`);
  if (numMatches < 3)
    problems.push(`量化指標僅 ${numMatches} 個（建議 ≥5 個），缺數字的 bullet 說服力弱`);
  if (verbHits < 4)
    problems.push(`行首強動詞僅 ${verbHits} 個（建議 ≥6 個）`);
  if (resultHits < 3)
    problems.push("成果導向語言不足（result/impact/improved 等），面試官看不到行動→結果的完整鏈條");
  if (bulletLines.length < 5)
    problems.push(`Bullet point 只有 ${bulletLines.length} 條，ATS 難以解析職責描述`);
  if (!/@[\w.-]+\.\w{2,}/.test(resumeText))
    problems.push("未偵測到標準 email，聯絡資訊不完整");
  if (problems.length < 3)
    problems.push("JD 關鍵字覆蓋率不足，建議逐行比對 JD 後補充缺失詞彙");

  const potentialD = matchRatio < 0.50 ? Math.min(27, D + 14) - D : 0;
  const potentialC = numMatches < 5    ? Math.min(9, C + 6) - C   : 0;

  return {
    engine:      "rule-based",
    jobTitle:    jobTitle || null,
    hasJD:       !!jdText,
    total,
    risk,
    dimensions: {
      A: { score: A, max: 15, label: "格式兼容性" },
      B: { score: B, max: 10, label: "資訊完整性" },
      C: { score: C, max: 25, label: "內容品質"   },
      D: { score: D, max: 40, label: "JD關鍵字匹配（核心）" },
      E: { score: E, max: 10, label: "投遞完成度" },
    },
    jdMatchRatio:    parseFloat((matchRatio * 100).toFixed(1)),
    topMissingKw:    missing.slice(0, 10),
    problems:        problems.slice(0, 5),
    suggestions: [
      `補充 JD 關鍵字（現 ${(matchRatio * 100).toFixed(0)}% → 目標 ≥50%）：${missing.slice(0, 6).join("、") || "已足夠"}`,
      numMatches < 5
        ? `加入量化數字（現 ${numMatches} 個 → 目標 ≥5 個）：使用 %、$、K+、倍速等格式`
        : "量化指標充足，確保每段職責都有數字支撐",
      verbHits < 5
        ? `以強動詞開頭每條 bullet（現 ${verbHits} 個），替換 helped/assisted/worked on 等弱動詞`
        : "行動動詞良好，進一步加強成果語言（drove/generated/reduced）",
    ],
    improvement: `${total} → ${Math.min(total + potentialD + potentialC, 88)}（補充 JD 關鍵字 +${potentialD}、量化成果 +${potentialC}）`,
  };
}

module.exports = { scoreResumeRuleBased };
