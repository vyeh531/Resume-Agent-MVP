require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ATS_PROMPT = `你是一套严格口径的 ATS 简历评分系统。你的任务是仅根据简历中可见的文本信息，对该简历进行一致性评分。

请严格遵守以下规则：
1. 不得虚构任何数字、地点、成果、职责或项目细节。
2. 不得因为学校名气、公司品牌或主观印象而额外加分。
3. 若未提供具体岗位 JD，必须标注为"通用方向估算"，并按简历最明显的目标方向保守评分。
4. 评分采用 100 分制，结构如下：A 解析与格式兼容性 20 分；B 信息完整性与结构组织 20 分；C 内容质量与成果表达 35 分；D 岗位关键词与 ATS 匹配性 15 分；E 最终投递完成度 10 分。
5. 风险等级必须输出为低 / 中 / 高之一。
6. 如果信息不足，请按较低分档处理，不做正向推断。

请按以下结构输出：
（1）ATS基础分：X / 100
（2）风险等级：低 / 中 / 高
（3）评分口径：是否提供 JD；若无，则写"通用方向估算"
（4）分项得分：A、B、C、D、E
（5）关键问题：至少4条，按影响程度排序
（6）优先修改建议：至少3条
（7）提分预期：仅在存在明确补充空间时给出保守区间

请保持语气专业、保守、可复核，不要输出夸张判断。`;

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
      A: Math.round(20 * r), B: Math.round(20 * r),
      C: Math.round(35 * r), D: Math.round(15 * r), E: Math.round(10 * r),
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
