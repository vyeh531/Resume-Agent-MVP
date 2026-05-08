import { NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { callClaude } from '@/lib/claude'
import { logError } from '@/lib/logger'
import { createAnalyzeArtifactAndJob, failJob } from '@/lib/backend-store'
import { databaseConfigured } from '@/lib/db'
import { enqueueAiJob } from '@/lib/job-queue'
import { getMentorKnowledgeBase, type MentorRow } from '@/lib/kb-store'
import { USER_CONTENT_GUARDRAIL, toPromptBlock, toPromptLine } from '@/lib/prompting'
import {
  RATE_LIMITS,
  checkRateLimit,
  createRateLimitHeaders,
} from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/supabase/server'
import { analyzeRequestSchema, type AnalyzeRequest } from '@/lib/validation'
import type { AnalyzeResultPayload, AtsPhaseResult, MentorPhaseResult } from '@/lib/types'

export const runtime = 'nodejs'

// ── ATS LEGACY Strict Scoring System Prompt (DEPRECATED - kept for reference) ──
/*
const ATS_SYSTEM_PROMPT_LEGACY = `You are an ATS (Applicant Tracking System) strict scoring engine. When given a resume, you analyze it and return a structured ATS score using the strict scoring methodology defined below.

## SCORING METHODOLOGY: STRICT MODE

### Step 1 — Compute base score (0–100)
Calculate a weighted sum across 4 dimensions:

| Dimension | Weight | Description |
|---|---|---|
| Keyword Match | 50% | Coverage of industry-standard and role-relevant keywords |
| Skills Match | 25% | Depth, breadth, and structure of the skills section |
| Format Compliance | 10% | ATS-parseable formatting (single column, no tables/images) |
| Experience Match | 15% | Relevance of experience, seniority fit, and employment continuity |

Base Score = (keyword_raw × 0.50) + (skills_raw × 0.25) + (format_raw × 0.10) + (experience_raw × 0.15)

### Step 2 — Apply penalty deductions (capped at −15 total)

| Penalty Trigger | Deduction |
|---|---|
| Employment gap > 6 months with no explanation | −3 |
| Skills section < 3 lines or missing proficiency signals | −2 |
| Non-English currency symbols in English resume | −1 |
| Missing resume summary or objective section | −1 |
| Use of tables, text boxes, or multi-column layout | −3 |
| Use of images, icons, or graphics | −2 |
| Contact info incomplete (missing email or phone) | −2 |
| Keyword stuffing detected | −2 |

Final Score = Base Score − Total Penalties (minimum 0)

### Step 3 — Raw score guidelines per dimension

**Keyword Match (0–100)**
- 90–100: ≥80% of expected role keywords WITH contextual usage
- 70–89: 50–79% of expected keywords
- 50–69: 30–49% of keywords
- 30–49: Sparse keyword coverage
- 0–29: Few or no relevant keywords
- IMPORTANT: If no JD is provided, default to industry-standard keyword list. Assume conservative scoring (start at 55, not 72).

**Skills Match (0–100)**
- 90–100: 3+ lines, separates hard/soft skills, includes proficiency
- 70–89: Skills listed clearly but without proficiency levels
- 50–69: Too brief (1 line or tool-name-only)
- 30–49: Missing or only inline mentions
- 0–29: No discernible skills section

**Format Compliance (0–100)**
- 90–100: Single column, plain text, standard headers, consistent dates
- 70–89: Mostly clean, minor issues
- 50–69: Some formatting issues
- 30–49: Tables or two-column layout
- 0–29: Heavy graphics or non-parseable elements

**Experience Match (0–100)**
- 90–100: Continuous employment, titles match target, quantified impact
- 70–89: Mostly relevant, minor gaps
- 50–69: Relevant but unexplained gaps or tangentially related
- 30–49: Significant gaps or career pivots without bridging
- 0–29: Largely irrelevant or severely fragmented

### Step 4 — Passing threshold
- ≥75: Pass — competitive
- 70–74: Marginal pass
- 60–69: Below threshold — needs improvement
- <60: Fail — significant revision required
Default threshold: 70. For FAANG/MBB/bulge bracket: 75.

## STRICT MODE PRINCIPLES
1. No JD provided → conservative keyword scoring
2. Never inflate scores. Identify real ATS failure risk.
3. Penalties are additive and compound.
4. Format IS substance in strict mode.
5. Tool-name-only skills count as weak signal.
6. Employment gaps must be explicitly explained to avoid penalty.

Return ONLY valid JSON, no markdown, no extra text.`
*/

/*
// ── ATS LEGACY Scoring System Prompt (2025 INITIAL VERSION - DEPRECATED) ──
const ATS_SYSTEM_PROMPT_LEGACY = `你是一套嚴格口徑的 ATS 簡歷評分系統。你的核心任務是僅根據簡歷中可見的文本信息，對其進行穩定、一致、可複核的 100 分制評分。

【核心執行準則】
1. 嚴禁推斷：不得虛構任何未寫出的數字、地點、成果、職責或項目規模。
2. 去品牌化：嚴禁因學校名氣、公司品牌或個人直覺而額外加分。
3. 保守一致：若信息不足或在分檔間猶豫，必須優先選擇較低分檔。
4. 無 JD 處理：若未提供崗位 JD，標註為「通用方向估算」，維度 D 評分不得超過 13 分。

【內容證據等級 (C 維度判分依據)】
- L4 強證據：動作+結果+量化+範圍（如：分析 12 家公司，提升 15% 效率）
- L3 中強證據：有動作與結果，但量化不足
- L2 弱證據：僅有職責描述（如 researched, prepared），結果不明
- L1 極弱證據：空泛詞彙（如 hard-working, helped with tasks）

【評分維度與細則】

A. 解析與格式兼容性 (20分)
  - 頁數 (4分)：1 頁=4；經驗豐富且結構清晰的 2 頁=2-3；無必要超過 2 頁=0-1
  - 排版 (6分)：單欄、清晰分區=5-6；雙欄或有文本框/圖形=0-2
  - 字體 (4分)：統一、合理=4；明顯不一=0-1
  - 日期 (3分)：寫法一致、時間線清晰=3；混亂=0
  - 命名 (3分)：專業命名與正式感=3；不專業=0

B. 信息完整性與結構組織 (20分)
  - 核心板塊 (8分)：教育、經歷、項目、技能均齊全=8；缺關鍵板塊=0-4
  - 地點信息 (4分)：大多數有地點=4；多數缺失=0-1
  - Bullet 密度 (4分)：核心經歷有足夠支撐=4；證據過少=0-1
  - 技能分組 (4分)：按類別組織易掃讀=4；混亂堆疊=0-1

C. 內容質量與成果表達 (35分)
  - 動作動詞 (5分)：使用明確強動詞=4-5；大量弱動詞=0-1
  - 結果導向 (10分)：≥50% bullet 有結果=8-10；<15%=0-1
  - 量化成果 (10分)：≥50% bullet 含數字/規模=8-10；<15%=0-1
  - 證據具體性 (5分)：分析對象與邊界清楚=4-5；普遍籠統=0-1
  - 表達專業度 (5分)：簡潔專業無空話=4-5；不自然或冗長=0-1

D. 崗位關鍵詞與匹配性 (15分)
  - 核心術語 (8分)：覆蓋充分自然=6-8；不足=0-2
  - 工具方法 (4分)：工具、模型與方向一致=3-4；明顯不足=0
  - 方向一致性 (3分)：經歷項目共同指向目標=3；方向分散=0
  [注意：若無 JD，此維度最多 13 分]

E. 最終投遞完成度 (10分)
  - 拼寫語法 (4分)：無明顯錯誤=4；多處錯誤=0-1
  - 重複問題 (2分)：無重複、命名統一=2
  - 聯繫信息 (2分)：完整、鏈接清晰=2
  - 整體成熟度 (2分)：接近正式投遞稿=2

【判定優先級】
1. 證據強度
2. 結果導向
3. 結構完整性
4. 關鍵詞一致性
5. 語言流暢度

【風險等級判定】
- 低風險：≥70 且各維度無明顯短板
- 中風險：60-69 或缺少 1 個核心板塊或量化極低
- 高風險：<60 或缺多個板塊或方向分散

【輸出格式要求】
返回 ONLY 有效 JSON，無代碼塊、無 markdown：
{
  "ats_score": <整數>,
  "risk_level": "低|中|高",
  "scoring_context": "是否提供 JD；若無則標註「通用方向估算」",
  "dimension_scores": {
    "A_format_parsing": <0-20>,
    "B_info_completeness": <0-20>,
    "C_content_quality": <0-35>,
    "D_keyword_matching": <0-15>,
    "E_delivery_readiness": <0-10>
  },
  "top_issues": [
    { "rank": 1, "severity": "high|medium|low", "issue": "string", "impact": "string" },
    { "rank": 2, "severity": "high|medium|low", "issue": "string", "impact": "string" },
    { "rank": 3, "severity": "high|medium|low", "issue": "string", "impact": "string" },
    { "rank": 4, "severity": "high|medium|low", "issue": "string", "impact": "string" }
  ],
  "priority_improvements": [
    { "rank": 1, "action": "string", "expected_gain": "string" },
    { "rank": 2, "action": "string", "expected_gain": "string" },
    { "rank": 3, "action": "string", "expected_gain": "string" }
  ],
  "score_improvement_range": "如：補全量化信息後預計提升 4-7 分",
  "strengths": ["string"]
}`;
*/

// ── ATS NEW Scoring System Prompt (2025 OPTIMIZED VERSION) ──
const ATS_SYSTEM_PROMPT = `你是一套严格口径的 ATS 简历评分系统。你的任务是仅根据简历中可见的文本信息，对该简历进行一致性评分。

请严格遵守以下规则：
1. 不得虚构任何数字、地点、成果、职责或项目细节。
2. 不得因为学校名气、公司品牌或主观印象而额外加分。
3. 若未提供具体岗位 JD，必须标注为"通用方向估算"，并按简历最明显的目标方向保守评分。
4. 评分采用 100 分制，结构如下：A 解析与格式兼容性 20 分；B 信息完整性与结构组织 20 分；C 内容质量与成果表达 35 分；D 岗位关键词与 ATS 匹配性 15 分；E 最终投递完成度 10 分。
5. 如果信息不足，请按较低分档处理，不做正向推断。

请按以下结构输出（ONLY JSON，无代码块，精简格式）：
{
  "ats_score": <整数 0-100>,
  "scoring_context": "是否提供 JD；若无，则写'通用方向估算'",
  "dimension_scores": {
    "A_format_parsing": <0-20>,
    "B_info_completeness": <0-20>,
    "C_content_quality": <0-35>,
    "D_keyword_matching": <0-15>,
    "E_delivery_readiness": <0-10>
  },
  "top_issues": [
    { "rank": 1, "severity": "high|medium|low", "issue": "string", "impact": "string" },
    { "rank": 2, "severity": "high|medium|low", "issue": "string", "impact": "string" }
  ],
  "priority_improvements": [
    { "rank": 1, "action": "string", "expected_gain": "string" },
    { "rank": 2, "action": "string", "expected_gain": "string" }
  ],
  "strengths": ["string"]
}`

// ── Competition Estimator System Prompt (DISABLED) ──
/*
const COMPETITION_SYSTEM_PROMPT = `...`
*/

// ── Unlocked mentor system prompt (Sonnet — full quality, 1 unlocked mentor) ──
const UNLOCKED_MENTOR_SYSTEM = `你是AI简历导师平台的导师建议引擎。你拥有来自顶级公司导师的真实辅导知识库。

你的任务：以指定导师的视角，针对学生简历给出3条分层建议，并生成整体评价和薪资预测。

## 核心规则
- highlightTags: 必须从credibility_signal中提取3-4个精简标签（如"NYU金融硕士"、"500+预测模型"、"FinTech独角兽"）
- careerPath: 必须从career_path字段提取职业路径（如"广告Agency → 快消品牌(百威) → 科技大厂(Amazon)"），career_path为空则null
- companyLogo: 必须是公司英文名小写（如"amazon"、"google"、"oportun"）

## 建议格式（每条advice严格按以下结构）
每条advice必须包含：
1. priority: "P0-必改" / "P1-重要" / "P2-建议"
2. problem: 导师指出的问题（清楚标出问题是什么）
3. mentorPerspective: 导师筛选策略 — 先用1句话说明该公司/行业对此项的筛选标准或淘汰逻辑，再用「」引用知识库中导师原话作为佐证。整段要读起来像一个连贯的专业判断，不要直接把quote当主体。
4. studentStatus: 学生的现状（从简历中详细指出具体位置和内容，引用简历原文）
5. suggestion: 详细且具体的改写建议（给出改写后的文字示例，不是笼统建议）
6. example: (可选) 改写后的bullet示例文字

## resumeHighlight（必须生成）
- intro: "在{公司名}中，此类简历最容易脱颖而出..."
- points: 2-3条具体的吸睛策略（必须基于知识库中该导师的真实建议和before_after案例，不可编造）

素材必须严格来源于提供的知识库（segments、before_after案例），不要编造导师未说过的话。
返回严格JSON，不要代码块`

// ── Locked mentor teaser system prompt (Haiku) ──
const LOCKED_MENTOR_SYSTEM = `你是简历顾问平台的导师预览生成器。根据学生简历和目标岗位，为3位锁定导师生成简短但专业的建议预览。

规则：
- 每位导师给出1条核心建议（P0级别），揭示关键问题但不给出完整方案（这是预览/解锁诱惑）
- highlightTags: 从credibility_signal中提取3个精简标签（如"NYU金融硕士"、"500+预测模型"）
- careerPath: 从career_path字段提取职业路径，career_path为空则null
- companyLogo: 必须是公司英文名小写（如"amazon"、"google"）
- 建议要有实质性（指出真实问题），但solution留有悬念
- 返回严格JSON，无代码块`

function fmtMentor(m: MentorRow, idx: number) {
  return `导师${idx}: ${m.name} | ${m.title} @ ${m.company}\n  权威背书: ${m.credibility_signal}\n  行业专长: ${m.industry_expertise}\n  擅长辅导: ${m.coaching_positions || '通用'}\n  职业路径: ${m.career_path || ''}`
}

// ── Risk Level Calculator ──
function calculateRiskLevel(atsScore: number, dimensionScores?: any): '低' | '中' | '高' {
  // 低風險: ≥90 分 且各維度無明顯短板
  if (atsScore >= 90) {
    if (dimensionScores) {
      const minDimension = Math.min(
        dimensionScores.A_format_parsing || 0,
        dimensionScores.B_info_completeness || 0,
        dimensionScores.C_content_quality || 0,
        dimensionScores.D_keyword_matching || 0,
        dimensionScores.E_delivery_readiness || 0
      )
      // Check if any dimension is significantly low (less than 40% of max)
      const hasShortfall =
        (dimensionScores.A_format_parsing || 0) < 8 ||
        (dimensionScores.B_info_completeness || 0) < 8 ||
        (dimensionScores.C_content_quality || 0) < 14 ||
        (dimensionScores.D_keyword_matching || 0) < 6 ||
        (dimensionScores.E_delivery_readiness || 0) < 4
      if (!hasShortfall) return '低'
    } else {
      return '低'
    }
  }

  // 高風險: <60 分 或缺多個板塊 或方向分散
  if (atsScore < 60) {
    return '高'
  }

  // 中風險: 60-89 分 或缺少 1 個核心板塊 或量化極低
  return '中'
}

// ══════════════════════════════════════════════════════════════════════════════
// Phase 1 — ATS Scoring + Competition Estimate
// ══════════════════════════════════════════════════════════════════════════════
export async function runAtsAnalysis({
  resumeText,
  targetRole,
  jobDescription,
}: AnalyzeRequest): Promise<AtsPhaseResult> {
  const hasJd = !!jobDescription
  const jdSection = jobDescription
    ? `\n\n職位描述（用於提取關鍵詞並與簡歷匹配）:\n${toPromptBlock('job_description', jobDescription, 1500)}`
    : ''

  const atsPrompt = `${toPromptBlock('resume_text', resumeText, 2500)}

目標職位: ${toPromptLine(targetRole, 120)}${jdSection}
${hasJd ? `
重要提示：已提供實際職位描述。你必須：
1. 從 JD 中提取 15-20 個核心關鍵詞（職位名稱、必需技能、工具、資格、職責）
2. 逐一對應簡歷中的覆蓋情況
3. 基於實際 JD 關鍵詞覆蓋率評分維度 D，而非通用行業關鍵詞
4. 在 top_issues 中具體列出簡歷缺失的 JD 關鍵詞
5. 這是「職位級別匹配」，不是「簡歷級別匹配」 — 精確指出此 JD 的具體要求
` : `
重要提示：未提供職位描述。按「通用方向估算」模式評分。
- 維度 D（關鍵詞匹配）最多 13 分
- 評估簡歷與目標職位「${targetRole}」的通用方向一致性
`}
返回 ONLY 有效 JSON，無代碼塊，精简格式：
{
  "ats_score": <整數>,
  "scoring_context": "${hasJd ? '提供 JD' : '通用方向估算'}",
  "dimension_scores": {
    "A_format_parsing": <0-20>,
    "B_info_completeness": <0-20>,
    "C_content_quality": <0-35>,
    "D_keyword_matching": <0-${hasJd ? '15' : '13'}>,
    "E_delivery_readiness": <0-10>
  },
  "top_issues": [
    { "rank": 1, "severity": "high|medium|low", "issue": "string", "impact": "string" },
    { "rank": 2, "severity": "high|medium|low", "issue": "string", "impact": "string" }
  ],
  "priority_improvements": [
    { "rank": 1, "action": "string", "expected_gain": "string" },
    { "rank": 2, "action": "string", "expected_gain": "string" }
  ],
  "strengths": ["string"]
}`

  // Competition estimation is disabled — using static fallback for now
  // const competitionPrompt = `職位名稱: ${toPromptLine(targetRole, 120)}`

  // Only do ATS for now, competition disabled
  const atsResponse = await callClaude(`${ATS_SYSTEM_PROMPT}\n\n${USER_CONTENT_GUARDRAIL}`, atsPrompt, 0, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 500,
    timeoutMs: 20_000,
  })

  // Competition estimate disabled — using static fallback
  const competitionResponse = JSON.stringify({
    job_title: targetRole,
    base_role: 1200,
    base_role_reasoning: 'Entry-level position estimate',
    estimated_applicants: 1500,
    applicant_range: '800–2200',
    competition_tag: '中等競爭',
  })

  let atsResult
  try {
    atsResult = JSON.parse(atsResponse)
  } catch (e) {
    const match = atsResponse.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        atsResult = JSON.parse(match[0])
      } catch (parseErr) {
        console.error('ATS JSON parse error:', parseErr instanceof Error ? parseErr.message : parseErr)
        console.error('ATS response:', atsResponse.slice(0, 2000))
        throw new Error(`Failed to parse ATS response: ${parseErr instanceof Error ? parseErr.message : 'unknown error'}`)
      }
    } else {
      throw new Error('Failed to parse ATS response: no JSON found')
    }
  }

  // Calculate risk_level based on score and dimensions
  if (atsResult) {
    atsResult.risk_level = calculateRiskLevel(atsResult.ats_score, atsResult.dimension_scores)
  }

  let competitionResult
  try {
    competitionResult = JSON.parse(competitionResponse)
  } catch {
    const match = competitionResponse.match(/\{[\s\S]*\}/)
    if (match) competitionResult = JSON.parse(match[0])
    else throw new Error('Failed to parse competition response')
  }

  return {
    atsScore: atsResult?.ats_score ?? atsResult?.final_score ?? 50,
    atsResult,
    competition: competitionResult || {
      job_title: targetRole,
      base_role: 1000,
      base_role_reasoning: '',
      estimated_applicants: 1000,
      applicant_range: '500-1500',
      competition_tag: '中等競爭',
    },
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Phase 2 — Mentor Advice (KB lookup + Claude)
// ══════════════════════════════════════════════════════════════════════════════
// TEMPORARILY DISABLED - To be re-enabled after optimization
/*
export async function runMentorAdvice(
  { resumeText, targetRole, jobDescription }: AnalyzeRequest,
  { atsResult }: AtsPhaseResult
): Promise<MentorPhaseResult> {
  // Derive null-safe ATS values for prompt context
  const atsScores = atsResult?.scores || {}
  const safeATS = {
    final_score: atsResult?.final_score ?? 50,
    passed: atsResult?.passed ?? false,
    keyword_match: atsScores.keyword_match?.raw ?? 50,
    skills_match: atsScores.skills_match?.raw ?? 50,
    format_compliance: atsScores.format_compliance?.raw ?? 70,
    experience_match: atsScores.experience_match?.raw ?? 50,
    top_issues: atsResult?.top_issues || [],
  }

  const { allMentors, universalSegments, specificSegments, beforeAfter } =
    await getMentorKnowledgeBase({ targetRole, jobDescription })

  // Build KB context strings
  const allSegments = [...universalSegments, ...specificSegments]
  const segsByL1: Record<string, typeof allSegments> = {}
  for (const seg of allSegments) {
    const key = seg.L1 || '其他'
    if (!segsByL1[key]) segsByL1[key] = []
    segsByL1[key].push(seg)
  }
  const adviceKB = Object.entries(segsByL1).map(([cat, segs]) => {
    const items = segs.map(s => {
      let e = `  [${s.mentor_name}@${s.company}] ${s.topic}`
      if (s.P_mentor) e += `\n    诊断: ${s.P_mentor}`
      e += `\n    行动: ${s.A_action}`
      if (s.I_insight) e += `\n    洞察: ${s.I_insight}`
      if (s.H_hook) e += `\n    原话: "${s.H_hook.slice(0, 80)}"`
      if (s.HR_os) e += `\n    HR视角: ${s.HR_os}`
      return e
    }).join('\n  ---\n')
    return `【${cat}】\n${items}`
  }).join('\n\n')

  const baExamples = beforeAfter.map(b => {
    let e = `[${b.mentor_name}@${b.company}]`
    if (b.issue_tags) e += ` 标签:${b.issue_tags}`
    e += `\n  Before: ${b.before_text}\n  After: ${b.after_text}\n  原因: ${b.reason}`
    return e
  }).join('\n---\n')

  const atsIssuesSummary = safeATS.top_issues
    .map((i: { severity: string; issue: string }) => `[${i.severity}] ${i.issue}`)
    .join('\n')

  // Pre-select top 4 mentors by relevance (already ranked in DB query)
  const selectedMentors = allMentors.slice(0, 4)
  const unlockedMentor = selectedMentors[0]
  const lockedMentorList = selectedMentors.slice(1, 4)

  // ── Call A user prompt (Sonnet — 1 unlocked mentor + overallJudgment + salary) ──
  const unlockedUserPrompt = `## 简历
${toPromptBlock('resume_text', resumeText, 2500)}

## 目标岗位: ${toPromptLine(targetRole, 120)}${jobDescription ? `

## 目标职位JD（必须参考）
${toPromptBlock('job_description', jobDescription, 1500)}

重要：建议必须针对此 JD 的具体要求（职责、技能、资格）。
- problem 字段：指出简历中缺少 JD 要求的哪项具体内容
- suggestion 字段：改写方向必须包含 JD 中的关键词/技能名称
- mentorPerspective 字段：解释为什么这个 JD 特别看重这项能力` : ''}

## ATS评分结果
- 总分: ${safeATS.final_score}/100 (${safeATS.passed ? '通过' : '未通过'})
- 关键词匹配: ${safeATS.keyword_match}/100
- 技能匹配: ${safeATS.skills_match}/100
- 格式合规: ${safeATS.format_compliance}/100
- 经历匹配: ${safeATS.experience_match}/100
- 主要问题:
${atsIssuesSummary}

## 指定导师（仅生成此1位导师的完整建议）
${fmtMentor(unlockedMentor, 1)}

## 知识库
${adviceKB.slice(0, 3500)}

## Before/After案例
${baExamples.slice(0, 1500)}

---
返回JSON：
{
  "overallJudgment": {
    "strengths": "<1-2句话概括候选人简历核心亮点，引用具体经历/数据/学校，让学生感受到被认可>",
    "coreIssues": "<1句话总结当前简历最关键的2个问题，用加粗标记关键词>",
    "mentorCount": 4
  },
  "currentSalary": "<当前ATS水平可能获得的年薪范围，入门级，如¥15W-22W/年或$55K-75K/年>",
  "topSalary": "<行业顶尖大厂同岗位年薪范围，如¥50W-80W/年或$150K-250K/年>",
  "topCompanies": ["<顶尖公司1>", "<顶尖公司2>", "<顶尖公司3>"],
  "mentor": {
    "id": "m1",
    "mentorName": "<真实姓名>",
    "mentorTitle": "<真实职位>",
    "company": "<真实公司>",
    "companyLogo": "<公司英文名小写>",
    "credibility": "<credibility_signal原文>",
    "highlightTags": ["<精简标签1>", "<精简标签2>", "<精简标签3>"],
    "careerPath": "<职业路径或null>",
    "advice": [
      { "priority": "P0-必改", "problem": "...", "mentorPerspective": "...", "studentStatus": "...", "suggestion": "...", "example": "..." },
      { "priority": "P1-重要", "problem": "...", "mentorPerspective": "...", "studentStatus": "...", "suggestion": "...", "example": "..." },
      { "priority": "P2-建议", "problem": "...", "mentorPerspective": "...", "studentStatus": "...", "suggestion": "..." }
    ],
    "resumeHighlight": {
      "intro": "在<公司名>中，此类简历最容易脱颖而出...",
      "points": ["<吸睛策略1>", "<吸睛策略2>"]
    },
    "isLocked": false
  }
}`

  // ── Call B user prompt (Haiku — brief teasers for 3 locked mentors) ──
  const lockedUserPrompt = `简历摘要：
${toPromptBlock('resume_summary', resumeText, 600)}

目标岗位: ${toPromptLine(targetRole, 120)}
ATS总分: ${safeATS.final_score}/100，主要问题: ${safeATS.top_issues.slice(0, 2).map((i: { issue: string }) => i.issue).join('；')}

3位导师信息：
${lockedMentorList.map((m, i) => fmtMentor(m, i + 2)).join('\n\n')}

返回JSON：
{
  "lockedMentors": [
    {
      "id": "m2",
      "mentorName": "<导师真实姓名>",
      "mentorTitle": "<真实职位>",
      "company": "<真实公司>",
      "companyLogo": "<公司英文名小写>",
      "credibility": "<credibility_signal原文>",
      "highlightTags": ["<精简标签1>", "<精简标签2>", "<精简标签3>"],
      "careerPath": "<职业路径或null>",
      "advice": [{ "priority": "P0-必改", "problem": "<核心问题>", "mentorPerspective": "<专业判断>", "studentStatus": "<指出简历中的具体问题>", "suggestion": "<改进方向提示>" }],
      "resumeHighlight": { "intro": "在<公司名>中，此类简历...", "points": ["<关键策略>"] },
      "isLocked": true
    },
    { "id": "m3", "mentorName": "...", "mentorTitle": "...", "company": "...", "companyLogo": "...", "credibility": "...", "highlightTags": ["..."], "careerPath": "...", "advice": [{"priority":"P0-必改","problem":"...","mentorPerspective":"...","studentStatus":"...","suggestion":"..."}], "resumeHighlight": {"intro":"...","points":["..."]}, "isLocked": true },
    { "id": "m4", "mentorName": "...", "mentorTitle": "...", "company": "...", "companyLogo": "...", "credibility": "...", "highlightTags": ["..."], "careerPath": "...", "advice": [{"priority":"P0-必改","problem":"...","mentorPerspective":"...","studentStatus":"...","suggestion":"..."}], "resumeHighlight": {"intro":"...","points":["..."]}, "isLocked": true }
  ]
}`

  // Run both mentor calls in parallel
  const [unlockedRaw, lockedRaw] = await Promise.all([
    callClaude(`${UNLOCKED_MENTOR_SYSTEM}\n\n${USER_CONTENT_GUARDRAIL}`, unlockedUserPrompt, 0, {
      maxTokens: 3500,
      cacheSystem: true,
      timeoutMs: 90_000,
    }),
    callClaude(`${LOCKED_MENTOR_SYSTEM}\n\n${USER_CONTENT_GUARDRAIL}`, lockedUserPrompt, 0, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 2000,
      timeoutMs: 45_000,
    }),
  ])

  let unlockedResult: {
    overallJudgment?: Record<string, unknown>
    currentSalary?: string
    topSalary?: string
    topCompanies?: string[]
    mentor?: Record<string, unknown>
  }
  try {
    unlockedResult = JSON.parse(unlockedRaw)
  } catch {
    const match = unlockedRaw.match(/\{[\s\S]*\}/)
    if (match) unlockedResult = JSON.parse(match[0])
    else throw new Error('Failed to parse unlocked mentor response')
  }

  let lockedResult: { lockedMentors?: Record<string, unknown>[] }
  try {
    lockedResult = JSON.parse(lockedRaw)
  } catch {
    const match = lockedRaw.match(/\{[\s\S]*\}/)
    if (match) lockedResult = JSON.parse(match[0])
    else lockedResult = { lockedMentors: [] }
  }

  return {
    overallJudgment: (unlockedResult?.overallJudgment as unknown as MentorPhaseResult['overallJudgment']) || { strengths: '', coreIssues: '', mentorCount: 4 },
    currentSalary: unlockedResult?.currentSalary || '未知',
    topSalary: unlockedResult?.topSalary || '未知',
    topCompanies: unlockedResult?.topCompanies || [],
    mentorAdvice: [
      ...(unlockedResult?.mentor ? [{ ...unlockedResult.mentor, isLocked: false }] : []),
      ...(lockedResult?.lockedMentors || []).map(m => ({ ...m, isLocked: true })),
    ] as MentorPhaseResult['mentorAdvice'],
  }
}
*/

// ══════════════════════════════════════════════════════════════════════════════
// Orchestrator — composes ATS + Mentor phases (used by route handler directly)
// ══════════════════════════════════════════════════════════════════════════════
export async function runResumeAnalysis(input: AnalyzeRequest): Promise<AnalyzeResultPayload> {
  const atsPhase = await runAtsAnalysis(input)

  // ── TEMPORARILY DISABLED: Mentor advice generation (will be re-enabled after optimization)
  // const mentorPhase = await runMentorAdvice(input, atsPhase)
  // return { ...atsPhase, ...mentorPhase }

  // For now, return ATS results only with empty mentor data
  return {
    ...atsPhase,
    overallJudgment: { strengths: '', coreIssues: '', mentorCount: 4 },
    currentSalary: '待評估',
    topSalary: '待評估',
    topCompanies: [],
    mentorAdvice: [],
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, RATE_LIMITS.analyze)
  const headers = createRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    return Response.json(
      { error: '请求过于频繁，请稍后再试' },
      { status: 429, headers }
    )
  }

  const auth = await getAuthenticatedUser(request)
  if (auth.error === 'not_configured') {
    return Response.json(
      { error: '登录系统未配置，暂时无法保存分析结果' },
      { status: 503, headers }
    )
  }
  if (auth.error || !auth.user) {
    return Response.json(
      { error: '请先登录后再分析简历' },
      { status: 401, headers }
    )
  }

  if (!databaseConfigured()) {
    return Response.json(
      { error: '分析系统未配置，请稍后再试' },
      { status: 503, headers }
    )
  }

  try {
    const rawBody = await request.json()
    const input = analyzeRequestSchema.parse(rawBody)
    const { artifactId, jobId } = await createAnalyzeArtifactAndJob(auth.user.id, input)
    try {
      await enqueueAiJob('analyze', jobId)
    } catch (error) {
      await failJob(jobId, 'enqueue_failed', '分析任务入队失败')
      logError('analyze_enqueue_failed', error, { jobId, artifactId })
      return Response.json(
        { error: '分析任务创建失败，请稍后再试' },
        { status: 503, headers }
      )
    }

    return Response.json(
      { jobId, artifactId },
      { status: 202, headers }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: '请求参数不合法，请检查简历文本和目标岗位后重试' },
        { status: 400, headers }
      )
    }

    logError('resume_analysis_failed', error)
    return Response.json(
      { error: '简历分析失败，请稍后重试' },
      { status: 500, headers }
    )
  }
}
