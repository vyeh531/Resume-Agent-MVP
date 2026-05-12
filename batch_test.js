/**
 * batch_test.js  —  No-API Resume Batch Tester  v3
 * 改前 = 學生簡歷真實 bullet（完整句子）
 * 改後 = 規則式重寫，可直接貼上取代改前
 *
 * 執行：node batch_test.js
 */
"use strict";

const fs   = require("fs");
const path = require("path");
const pdf  = require("pdf-parse");
const { DatabaseSync } = require("node:sqlite");

const TEST_DIR = path.join(__dirname, "..", "..", "..", "Desktop", "test_mvp");
const DB_PATH  = path.join(__dirname, "mentor_kb-v5.db");
const OUT_FILE = path.join(TEST_DIR, "batch_results.txt");

async function readPDF(p) { return (await pdf(fs.readFileSync(p))).text; }
const readTXT = p => fs.readFileSync(p, "utf-8");

// ── 修復 PDF 無空格文字（部分 PDF 字型 encoding 問題）──────────
function fixCompactedText(text) {
  // 計算平均「詞長」，正常英文約 5–6；超過 10 表示空格被壓縮
  const words = text.split(/\s+/).filter(w => /^[a-zA-Z]/.test(w));
  const avgLen = words.reduce((s, w) => s + w.length, 0) / (words.length || 1);
  if (avgLen <= 9) return text; // 空格正常，不處理

  // 在小寫→大寫邊界插入空格（處理 camelCase 合併）
  return text
    .replace(/([a-z,\)])([A-Z][a-z])/g, "$1 $2")   // foo→Bar
    .replace(/([a-z])([A-Z]{2,})/g, "$1 $2")         // fooBAR
    .replace(/([A-Z]{2,})([A-Z][a-z])/g, "$1 $2");   // HTMLPage
}

// ── 從 PDF 文字抽完整 bullet points ──────────────────────────
// PDF 斷行會把一條 bullet 切成多行，需要先重組
function extractBullets(rawText) {
  // 1. 把 PDF 中常見的 bullet 前置字元統一成 "|BULLET|"
  let text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // 有明確 bullet 符號的行
    .replace(/^[\s]*[•\*●▪◦▸►\-]\s+/gm, "|BULLET|")
    // 以大寫 + 動詞開頭且不像 section title 的行（長度 > 40）
    .replace(/^([A-Z][a-z]+(?:ed|ing|d)\s.{35,})/gm, "|BULLET|$1");

  // 2. 重組跨行的 bullet（下一行不是 |BULLET| 就是接續）
  const bullets = [];
  let cur = "";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|BULLET|")) {
      if (cur.length > 0) bullets.push(cur.trim());
      cur = trimmed.replace("|BULLET|", "").trim();
    } else if (cur.length > 0 && trimmed.length > 0
               && !/^[A-Z\d][A-Z\d\s|]{0,40}$/.test(trimmed)  // 排除全大寫 section header
               && !trimmed.match(/^(education|experience|skills|projects|objective|summary|certification|award|publication|language)/i)) {
      // 接續行：若前行沒有結束符號，拼接
      if (!cur.endsWith(".") && !cur.endsWith(";")) {
        cur += " " + trimmed;
      } else {
        bullets.push(cur.trim());
        cur = "";
      }
    } else if (cur.length > 0) {
      bullets.push(cur.trim());
      cur = "";
    }
  }
  if (cur.length > 0) bullets.push(cur.trim());

  // 3. 過濾：只保留實質性的職責/成果描述句
  return bullets.filter(b => {
    if (b.length < 40 || b.length > 500) return false;
    if (b.split(" ").length < 6) return false;
    // 排除教育行
    if (/university|college|bachelor|master|gpa|coursework|minor|degree|expected|graduated/i.test(b)) return false;
    // 排除純技能清單
    if (/^(languages?|tools?|frameworks?|databases?|programming|skills?):/i.test(b)) return false;
    // 排除地址/日期行
    if (/^\d{3}[-.\s]\d{3}|@|\b20\d{2}\s*[-–]\s*(20\d{2}|present|now)\b/i.test(b)) return false;
    return true;
  });
}

// ── 弱點評分（分數越高越需要改）──────────────────────────────
const STRONG_VERBS = new Set([
  "led","built","developed","designed","implemented","launched","improved",
  "increased","reduced","created","managed","optimized","analyzed","deployed",
  "architected","owned","coordinated","delivered","scaled","automated","engineered",
  "established","drove","executed","spearheaded","streamlined","accelerated",
  "collaborated","partnered","produced","generated","secured","negotiated",
  "trained","mentored","diagnosed","integrated","migrated","refactored",
  "leveraged","authored","researched","performed","conducted","built",
  "developed","translated","identified","supported","designed","directed",
]);

function weaknessScore(bullet, jdKw) {
  const b = bullet.toLowerCase();
  let score = 0;
  if (!/\d/.test(bullet)) score += 35;
  const fw = b.split(/\s+/)[0].replace(/[^a-z]/g, "");
  if (!STRONG_VERBS.has(fw)) score += 20;
  if (bullet.length < 80) score += 15;
  if (!/result|impact|improv|reduc|increas|achiev|enabl|boost|cut|sav|generat|grow|decreas|driv/i.test(bullet)) score += 20;
  const hits = jdKw.filter(w => b.includes(w) && w.length > 4).length;
  if (hits === 0) score += 10;
  return score;
}

// ── 智能 bullet 重寫 ──────────────────────────────────────────
// 根據 bullet 內容偵測問題並給出有意義的「改後」

function detectDomain(bullet) {
  const b = bullet.toLowerCase();
  if (/latency|throughput|api|database|server|deploy|microservice|kubernetes|docker|cache|query|algorithm|system|architecture/i.test(b)) return "tech";
  if (/revenue|cost|profit|roi|saving|budget|financ|investment|portfolio|valuation|forecast|model/i.test(b)) return "finance";
  if (/user|customer|retention|conversion|dau|nps|product|roadmap|feature|ux|design/i.test(b)) return "product";
  if (/market|research|analysis|insight|strategy|recommend|report|stakeholder|client|consult/i.test(b)) return "strategy";
  if (/recruit|hire|onboard|campaign|brand|content|social|marketing|event/i.test(b)) return "marketing";
  return "general";
}

// 量化結尾建議（按 domain 給出更自然的佔位詞）
const QUANT_SUFFIX = {
  tech:      ", reducing [latency / error rate / processing time] by X%",
  finance:   ", improving [ROI / forecast accuracy / cost efficiency] by X%",
  product:   ", driving a [X% increase in conversion / retention / DAU]",
  strategy:  ", generating [X actionable insights / $Y revenue impact / Z% efficiency gain]",
  marketing: ", achieving [X% increase in engagement / Y leads generated / Z% CTR improvement]",
  general:   ", resulting in [X% improvement / Y units delivered / $Z cost saved]",
};

// 弱動詞替換表
const WEAK_VERB_MAP = {
  "helped":             "partnered with team to",
  "assisted":           "collaborated with stakeholders to",
  "worked on":          "developed",
  "worked with":        "collaborated with",
  "was responsible for":"owned and managed",
  "participated in":    "contributed directly to",
  "did":                "executed",
  "made":               "created",
  "used":               "leveraged",
  "got":                "achieved",
  "handled":            "managed",
  "dealt with":         "resolved",
  "involved in":        "played a key role in",
  "took part in":       "actively contributed to",
};

function applyVerbStrength(bullet) {
  for (const [weak, strong] of Object.entries(WEAK_VERB_MAP)) {
    const re = new RegExp("^" + weak.replace(/\s+/g, "\\s+"), "i");
    if (re.test(bullet.trim())) {
      const replaced = bullet.trim().replace(re, strong);
      return replaced.charAt(0).toUpperCase() + replaced.slice(1);
    }
  }
  return bullet;
}

function rewriteBullet(bullet, mentorFocus, jdKw) {
  let result = applyVerbStrength(bullet.trim());
  const domain = detectDomain(result);
  const hasNumber = /\d/.test(result);
  const hasResult = /result|impact|improv|reduc|increas|achiev|enabl|boost|cut|sav|generat|grow|decreas|driv/i.test(result);

  // 移除末尾句點以便添加
  const endsWithPunct = /[.;]$/.test(result);
  if (endsWithPunct) result = result.slice(0, -1);

  if (mentorFocus === "tech") {
    if (!hasNumber) {
      result += QUANT_SUFFIX.tech;
    } else if (!hasResult) {
      // 已有數字，但缺少結果說明
      result += ", improving overall system reliability and performance";
    }
    // 如果沒有技術選型說明，在技術詞旁加理由
    if (/using\s+([\w]+)/i.test(result) && !/over|instead|vs\.|compared/i.test(result)) {
      result = result.replace(
        /\busing\s+([\w]+)/i,
        (m, tech) => `choosing ${tech} (over alternatives) for [specific performance / scale reason]`
      );
    }
  } else if (mentorFocus === "pm") {
    if (!hasNumber) {
      result += QUANT_SUFFIX[domain] || QUANT_SUFFIX.product;
    } else if (!hasResult) {
      result += ", enabling [end-users / stakeholders] to [specific outcome]";
    }
  } else if (mentorFocus === "strategy") {
    if (!hasResult) {
      result += QUANT_SUFFIX[domain] || QUANT_SUFFIX.strategy;
    }
    // 添加商業影響連結
    const missingJdKw = jdKw.filter(w => w.length > 4 && !result.toLowerCase().includes(w)).slice(0, 2);
    if (!hasNumber && missingJdKw.length > 0) {
      result += `, supporting ${missingJdKw.join(" and ")} objectives`;
    }
  } else if (mentorFocus === "consulting") {
    // STAR: 確保有 Result
    if (!hasResult) {
      result += ", enabling [client / team / management] to make data-driven decisions and [specific outcome]";
    }
    // 確保有 Action 動詞清晰
    if (result.length < 100) {
      result += "; approach: [methodology used], scope: [X stakeholders / Y data points / Z deliverables]";
    }
  }

  // 結尾加句點
  if (!/[.;]$/.test(result)) result += ".";
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// ── ATS 評分 ──────────────────────────────────────────────────
const STOP = new Set([
  "the","a","an","and","or","of","in","to","for","is","are","be","on","at","with",
  "that","this","we","you","our","your","as","by","it","its","from","will","can",
  "have","has","been","not","all","also","more","other","their","than","into","was",
  "were","but","may","use","used","using","per","new","strong","ability","experience",
  "including","such","both","based","role","work","team","make","well","able","good",
  "any","who","how","what","they","each","when","about","then","some","these","those",
  "there","here","time","very","just","like","over","only","which","after","before",
  "while","need","should","would","could","them","had","here","its","are",
]);
function extractKeywords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
}

function scoreATS(resumeText, jdText) {
  const rt      = resumeText.toLowerCase();
  const rtLines = resumeText.split("\n");
  const bulletLines = rtLines.filter(l => /^\s*[•\-\*·●▪◦▸►]\s/.test(l));

  // ── A: 格式兼容性 /15  從 0 開始 ──────────────────────────
  let A = 0;
  const coreSec = ["experience","education","skills"].filter(s => rt.includes(s)).length;
  A += coreSec * 3;                                                    // 0–9
  const extSec  = ["projects","summary","objective","certifications","awards"].filter(s => rt.includes(s)).length;
  A += Math.min(2, extSec);                                            // 0–2
  if      (bulletLines.length >= 8) A += 3;
  else if (bulletLines.length >= 4) A += 2;
  else if (bulletLines.length >= 1) A += 1;                            // 0–3
  if (resumeText.length < 400)  A = Math.max(0, A - 4);
  if (resumeText.length > 9000) A = Math.max(0, A - 2);
  A = Math.max(0, Math.min(15, A));

  // ── B: 資訊完整性 /10  從 0 開始 ────────────────────────────
  let B = 0;
  if (/@[\w.-]+\.\w{2,}/.test(resumeText))                 B += 3;   // email（必備）
  if (/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(resumeText))   B += 1;   // 電話
  if (/linkedin/i.test(rt))                                 B += 2;   // LinkedIn
  if (/github/i.test(rt))                                   B += 1;   // GitHub
  if (/education|university|bachelor|master|degree/i.test(rt)) B += 2; // 學歷
  const dateCount = (resumeText.match(/\b20\d{2}\b/g) || []).length;
  B += dateCount >= 4 ? 1 : 0;                                        // 有足夠日期
  B = Math.max(0, Math.min(10, B));

  // ── C: 內容品質 /25  從 0 開始 ──────────────────────────────
  let C = 0;

  // 量化指標：排除年份(20xx)，只算真實業務數字
  const rawNums = (resumeText.match(/\d+\s*[%％]|\$[\d,]+[kKmMbB]?|\b\d+[kKmMbB]\b|\b[1-9]\d{3,}\b/g) || [])
    .filter(m => !/^20[0-2]\d$/.test(m.replace(/[^0-9]/g, "")));
  const numMatches = rawNums.length;
  if      (numMatches >= 8) C += 12;
  else if (numMatches >= 5) C += 9;
  else if (numMatches >= 3) C += 6;
  else if (numMatches >= 1) C += 3;
  // 0 量化數字 → 0 分

  // 強動詞：只算行首動詞（真正的 bullet 開頭）
  const verbHits = [...STRONG_VERBS].filter(v => {
    return rtLines.some(l => new RegExp("^\\s*[•\\-\\*·●▪◦▸►]?\\s*" + v + "\\b", "i").test(l));
  }).length;
  if      (verbHits >= 8) C += 8;
  else if (verbHits >= 5) C += 6;
  else if (verbHits >= 3) C += 3;
  else if (verbHits >= 1) C += 1;

  // 成果導向語言
  const resultHits = (resumeText.match(/\b(result|impact|improv|reduc|increas|achiev|enabl|boost|cut\b|sav|generat|drove|deliver)/gi) || []).length;
  if      (resultHits >= 6) C += 5;
  else if (resultHits >= 3) C += 3;
  else if (resultHits >= 1) C += 1;

  C = Math.max(0, Math.min(25, C));

  // ── D: JD 關鍵字 /40  核心差異化維度，嚴格門檻 ─────────────
  const jdKwRaw  = extractKeywords(jdText).filter(w => w.length > 3);
  const uniqueJdKw = [...new Set(jdKwRaw)];
  const hits     = uniqueJdKw.filter(w => rt.includes(w)).length;
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

  // ── E: 投遞完成度 /10  從 0 開始 ────────────────────────────
  let E = 0;
  if (resumeText.length > 1500) E += 3;
  else if (resumeText.length > 700) E += 2;
  else if (resumeText.length > 400) E += 1;
  if (/@/.test(resumeText))                          E += 3;
  if (/summary|objective|profile|about/i.test(rt))  E += 2;
  if (coreSec >= 3)                                  E += 2;
  E = Math.max(0, Math.min(10, E));

  const total = A + B + C + D + E;
  const risk  = total >= 75 ? "低" : total >= 55 ? "中" : "高";
  const missing = uniqueJdKw.filter(w => !rt.includes(w));

  const problems = [];
  if (matchRatio < 0.40)      problems.push(`JD 關鍵字匹配率僅 ${(matchRatio*100).toFixed(0)}%（需 ≥50% 才能通過機器篩選），D 維度損失 ${40 - D} 分`);
  if (numMatches < 3)         problems.push(`量化指標僅 ${numMatches} 個（建議 ≥5 個），C 維度損失約 ${12 - Math.min(12, numMatches * 2)} 分`);
  if (verbHits < 4)           problems.push(`行首強動詞僅 ${verbHits} 個（建議 ≥6 個），以 helped/assisted 開頭的 bullet ATS 權重極低`);
  if (resultHits < 3)         problems.push("成果導向語言不足（result/impact/improved 等），面試官無法看到「行動 → 結果」的完整鏈條");
  if (bulletLines.length < 5) problems.push(`Bullet point 只有 ${bulletLines.length} 條，結構化程度低，ATS 難以解析職責描述`);
  if (!/@[\w.-]+\.\w{2,}/.test(resumeText)) problems.push("未偵測到標準 email，聯絡資訊不完整");
  if (problems.length < 3)    problems.push("JD 的 hard skill 關鍵字覆蓋率不足，需逐行比對 JD 後補充缺失詞彙");

  const potentialD    = matchRatio < 0.50 ? Math.min(27, D + 14) - D : 0;
  const potentialC    = numMatches < 5    ? Math.min(9, C + 6) - C   : 0;
  const potentialGain = Math.min(20, potentialD + potentialC);

  return {
    total, A, B, C, D, E, risk, matchRatio,
    topMissingKw: missing.slice(0, 10),
    problems: problems.slice(0, 5),
    suggestions: [
      `【最優先】補充 JD 關鍵字（現 ${(matchRatio*100).toFixed(0)}% → 目標 ≥50%，可補回 D 維度 ${potentialD} 分）：${missing.slice(0, 6).join("、") || "（已足夠）"}`,
      numMatches < 5
        ? `在每條 bullet 加入量化數字（現 ${numMatches} 個 → 目標 ≥5 個），使用 %、$、K+、倍速等格式`
        : "量化指標足夠，確保每段工作職責都有數字支撐",
      verbHits < 5
        ? `以強動詞開頭每條 bullet（現 ${verbHits} 個），替換 helped/assisted/was responsible for 等弱動詞`
        : "行動動詞良好，進一步加強成果語言（drove/generated/reduced）",
    ],
    improvement: `${total} → ${Math.min(total + potentialGain, 88)}（補充 JD 關鍵字可得 +${potentialD}、量化成果 +${potentialC}）`,
  };
}

// ── 導師資料 ──────────────────────────────────────────────────
const MENTOR_PROFILES = [
  { name: "Alex Chen",     company: "Google",        role: "Senior SWE",        avatar: "🟢", focus: "tech",
    coreIssue: "技術決策力不足：缺乏技術選型理由與量化指標",
    insights: [
      { insight: "技術判斷力是中高級候選人最有價值的展示——為正確原因選擇正確工具，解釋選擇比羅列工具更展示工程成熟度",
        action: "在每個重大技術選擇後加一句：why this over alternatives，以及帶來什麼量化改善（latency / throughput / error rate）" },
      { insight: "ATS 系統和技術面試官都在找技術決策的深度，而不只是技術名詞的堆疊",
        action: "在最強的技術 bullet 加入量化指標（如 latency ms、throughput、error rate、cost $）以及技術選型理由" },
      { insight: "具體的系統設計決策比模糊的職責描述更能通過 ATS 和技術面試官的雙重篩選",
        action: "每條 bullet 結尾加入可量化的系統效果，如 reducing latency by X%、handling Y rps、cutting error rate to Z%" },
    ]
  },
  { name: "Sophia Wang",   company: "Amazon",        role: "Principal PM",      avatar: "🟠", focus: "pm",
    coreIssue: "業務影響模糊：缺乏用戶指標與產品成果描述",
    insights: [
      { insight: "PM 面試官看的是你有沒有用數據驅動決策的能力，業務影響模糊等於告訴面試官你不關注結果",
        action: "在職責描述後加入 end-user 指標（DAU、NPS、retention、conversion rate）或業務指標（revenue、cost saved）" },
      { insight: "Bullet 的最後一句必須回答「So what？」——你做了這件事，公司/用戶得到了什麼",
        action: "在每條缺結果的 bullet 加上 resulting in [specific outcome] 或 enabling [stakeholder] to [action]" },
      { insight: "面試前每次都花 1–2 小時複習簡歷每個項目的細節，有真實經驗的候選人在壓力下失憶是常見失敗原因",
        action: "確保每條 bullet 都能在面試中說出：背景→具體行動→可量化成果，並為每個項目建一個複習資料夾" },
    ]
  },
  { name: "Michael Li",    company: "Goldman Sachs", role: "VP Strategy",       avatar: "🔵", focus: "strategy",
    coreIssue: "商業價值缺失：成果未與業務目標掛鉤",
    insights: [
      { insight: "Strategy 面試官的問題永遠是：你的工作對 revenue/cost/risk 的影響是多少？沒有這個答案的 bullet 會被過濾",
        action: "在每條 strategy/analysis bullet 後加入商業量化影響（$ revenue impact、% cost reduction、X clients acquired）" },
      { insight: "學術成果直接放入簡歷，HR 看不到與工業界需求的連接；需要將項目包裝成解決業務問題的分析案例",
        action: "重新梳理項目描述，將學術成果改造為體現業務價值的分析案例，加入 business objective 和 decision outcome" },
      { insight: "Data-driven 不只是用了 SQL 或 Python，而是「分析→洞察→建議→決策落地」的完整鏈條",
        action: "補充分析後的 recommendation 和 decision made，展示你的工作被 stakeholder 採用的證據" },
    ]
  },
  { name: "Jessica Zhang", company: "McKinsey",      role: "Senior Consultant", avatar: "🟣", focus: "consulting",
    coreIssue: "結構鬆散：缺乏 STAR 格式，無法展示決策鏈",
    insights: [
      { insight: "STAR 格式（Situation, Task, Action, Result）是 consulting 面試的標準框架，缺少任何一環都會被追問",
        action: "每條 bullet 檢查是否有：A（具體行動）、R（量化結果）；至少確保 A 和 R 同時存在" },
      { insight: "Cover letter 核心目的是向招聘方證明你的經歷與具體崗位高度相關；直接引用 JD 語言會產生強烈的匹配感",
        action: "閱讀 JD 的 What You'll Do 部分，找出與自己經歷最匹配的 3 個點，圍繞這 3 點寫 cover letter" },
      { insight: "轉型期候選人在匹配度不高時，容易在面試官認知上被歸類為上一個行業的人；主動聚焦目標行業降低誤判",
        action: "在 resume headline 或 summary 中明確點出目標職能和行業，避免讓面試官自行猜測你的方向" },
    ]
  },
];

const PRIORITY_LABELS = ["P0 必改", "P1 重要", "P2 建議"];

function getMentorAdvice(resumeText, jdText) {
  const bullets = extractBullets(resumeText);
  const jdKw    = extractKeywords(jdText).filter(w => w.length > 3);

  if (bullets.length === 0) {
    // fallback：直接按行切
    return MENTOR_PROFILES.map(mentor => ({
      ...mentor,
      adviceList: [{ priority: "P0 必改", issue: mentor.coreIssue,
        insight: mentor.insights[0].insight, action: mentor.insights[0].action,
        before: "（PDF 解析後未找到標準 bullet point，請確認簡歷使用 • - * 格式）",
        after:  "（請在簡歷中使用標準 bullet 格式後重新跑腳本）",
      }],
    }));
  }

  const scored = bullets
    .map(b => ({ b, score: weaknessScore(b, jdKw) }))
    .sort((a, z) => z.score - a.score);

  return MENTOR_PROFILES.map((mentor, mi) => {
    const myBullets = scored.slice(mi * 3, mi * 3 + 3);
    while (myBullets.length < 3) {
      myBullets.push(scored[myBullets.length % Math.max(scored.length, 1)]);
    }

    const adviceList = myBullets.slice(0, 3).map((item, ai) => ({
      priority: PRIORITY_LABELS[ai],
      issue:    mentor.coreIssue,
      insight:  mentor.insights[ai].insight,
      action:   mentor.insights[ai].action,
      before:   item.b,
      after:    rewriteBullet(item.b, mentor.focus, jdKw),
    }));

    return { ...mentor, adviceList };
  });
}

// ── 格式化輸出 ────────────────────────────────────────────────
function formatReport(folder, ats, mentors) {
  const lines = [];
  const HR = "═".repeat(72);
  const hr = "─".repeat(72);

  lines.push(HR);
  lines.push(`  候選人：${folder}`);
  lines.push(HR);

  lines.push("\n【ATS 評分結果】");
  lines.push(`  總分：${ats.total} / 100   風險等級：${ats.risk}`);
  lines.push(`  A 格式兼容性  : ${String(ats.A).padStart(2)} / 15`);
  lines.push(`  B 資訊完整性  : ${String(ats.B).padStart(2)} / 10`);
  lines.push(`  C 內容品質    : ${String(ats.C).padStart(2)} / 25`);
  lines.push(`  D JD 關鍵字   : ${String(ats.D).padStart(2)} / 40  ← 核心維度`);
  lines.push(`  E 投遞完成度  : ${String(ats.E).padStart(2)} / 10`);
  lines.push(`  提分預期      : ${ats.improvement}`);
  lines.push(`  JD 匹配率     : ${(ats.matchRatio * 100).toFixed(0)}%`);
  lines.push(`  缺失關鍵字    : ${ats.topMissingKw.slice(0, 8).join(", ") || "（無）"}`);
  lines.push("\n  關鍵問題：");
  ats.problems.forEach((p, i) => lines.push(`    ${i + 1}. ${p}`));
  lines.push("\n  優先修改建議：");
  ats.suggestions.forEach((s, i) => lines.push(`    ${i + 1}. ${s}`));

  lines.push("\n" + hr);
  lines.push("【4 位導師建議（共 12 條）+ 簡歷改前改後】");
  lines.push("  改前 = 學生簡歷原文  |  改後 = 可直接替換貼上");

  mentors.forEach(m => {
    lines.push(`\n  ${m.avatar} ${m.name}  |  ${m.company} · ${m.role}`);
    lines.push(`  核心問題：${m.coreIssue}`);
    lines.push("  " + hr.slice(0, 68));
    m.adviceList.forEach(a => {
      lines.push(`\n  [${a.priority}]`);
      lines.push(`  核心洞察：${a.insight}`);
      lines.push(`  行動方案：${a.action}`);
      lines.push(`  ┌ 改前（原文）：`);
      // 長句折行
      const bLines = a.before.match(/.{1,80}/g) || [a.before];
      bLines.forEach((l, i) => lines.push(`  ${i === 0 ? "│" : " "} ${l}`));
      lines.push(`  └ 改後（可貼上）：`);
      const aLines = a.after.match(/.{1,80}/g) || [a.after];
      aLines.forEach(l => lines.push(`    ${l}`));
    });
  });

  lines.push("\n" + HR + "\n");
  return lines.join("\n");
}

// ── 主流程 ────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(TEST_DIR)) { console.error("找不到:", TEST_DIR); process.exit(1); }
  const db = new DatabaseSync(DB_PATH);
  const output = [];
  const header = `resume_batch_test v3  —  ${new Date().toISOString()}\n改前 = 學生簡歷原文  |  改後 = 規則式重寫可直接貼上\n\n`;
  process.stdout.write(header);
  output.push(header);

  const folders = fs.readdirSync(TEST_DIR)
    .filter(d => fs.statSync(path.join(TEST_DIR, d)).isDirectory()).sort();

  for (const folder of folders) {
    const dir   = path.join(TEST_DIR, folder);
    const files = fs.readdirSync(dir);
    const pdfFile = files.find(f => f.toLowerCase().endsWith(".pdf"));
    const txtFile = files.find(f => f.toLowerCase().endsWith(".txt"));
    if (!pdfFile || !txtFile) { console.log(`[跳過] ${folder}`); continue; }

    process.stdout.write(`處理中：${folder} ...\n`);
    let resumeText, jdText;
    try {
      resumeText = fixCompactedText(await readPDF(path.join(dir, pdfFile)));
      jdText     = readTXT(path.join(dir, txtFile));
    } catch (e) { console.error(`[錯誤] ${folder}:`, e.message); continue; }

    const ats     = scoreATS(resumeText, jdText);
    const mentors = getMentorAdvice(resumeText, jdText);
    const report  = formatReport(folder, ats, mentors);

    process.stdout.write(report);
    output.push(report);
  }

  fs.writeFileSync(OUT_FILE, output.join(""), "utf-8");
  process.stdout.write(`\n✓ 結果已儲存：${OUT_FILE}\n`);
  db.close();
}

main().catch(e => { console.error("Fatal:", e.stack || e); process.exit(1); });
