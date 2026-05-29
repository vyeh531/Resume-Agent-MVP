"use strict";

const db = require("../database");
// pg pool is retrieved lazily via db.getPool()

const FALLBACK_FREE_ADVICE = {
  adviceId: "adv_free_tailor_resume",
  title: "不要一份简历投所有岗位",
  problemSummary: "你的简历需要根据目标岗位强化关键词与定位。",
  actionSummary: "根据目标岗位维护不同版本简历，把最相关的技能、项目和关键词放到对应版本里。",
  source: "fallback",
};

const ACCOUNTING_FALLBACK_FREE_ADVICE = {
  adviceId: "adv_free_accounting_positioning",
  title: "先让简历看起来像 Accounting 岗位",
  problemSummary: "你的简历目前和目标 JD 的关键词与职责语言匹配度较低，ATS 可能无法明确判断你在申请 Accounting 方向。",
  actionSummary: "优先把 Summary、Skills 和第一段 Experience 改成 Accounting 相关语言，例如 financial reporting、reconciliation、Excel、QuickBooks、GAAP、accounts payable/receivable 等真实掌握的关键词。",
  source: "fallback",
  adviceIntent: "resume_positioning",
};

const TECH_ROLE_FAMILIES = new Set(["software_engineer", "ai_engineer", "machine_learning", "data_scientist"]);
const BUSINESS_ROLE_FAMILIES = new Set(["accounting", "finance", "financial_analyst", "business", "operations"]);

// ── Company → logo file mapping (files live in public/logos/) ─────────────────
const COMPANY_LOGO_MAP = {
  // Big Tech
  "Amazon":                    "/logos/Amazon.png",
  "Amazon Web Services":       "/logos/Amazon Web Services, Inc.png",
  "AWS":                       "/logos/Amazon Web Services, Inc.png",
  "Google":                    "/logos/google.png",
  "Meta":                      "/logos/Meta.png",
  "Microsoft":                 "/logos/Microsoft.png",
  "Apple":                     "/logos/Apple.png",
  "NVIDIA":                    "/logos/NVIDIA.png",
  "Intel":                     "/logos/Intel.png",
  "Qualcomm":                  "/logos/Qualcomm.png",
  "Cisco":                     "/logos/Cisco.png",
  "IBM":                       "/logos/IBM.jpg",
  "Oracle":                    "/logos/Oracle.png",
  "Salesforce":                "/logos/Salesforce.png",
  "Adobe":                     "/logos/Adobe.png",
  "Intuit":                    "/logos/Intuit.png",
  "Snowflake":                 "/logos/Snowflake.png",
  "Spotify":                   "/logos/Spotify.png",
  "Uber":                      "/logos/Uber.jpg",
  "Robinhood":                 "/logos/Robinhood.png",
  "OpenAI":                    "/logos/OpenAI.png",
  "ByteDance":                 "/logos/ByteDance.png",
  "TikTok":                    "/logos/Tiktok.png",
  "SAP":                       "/logos/SAP.png",
  "DocuSign":                  "/logos/DocuSign.png",
  "Dynatrace":                 "/logos/Dynatrace.png",
  "Comcast":                   "/logos/Comcast Corporation.png",
  "Siemens":                   "/logos/Siemens.png",
  "Bosch":                     "/logos/Bosch Group.png",
  // Finance
  "Goldman Sachs":             "/logos/Goldman Sachs.png",
  "JPMorgan":                  "/logos/JPMorgan Chase.png",
  "JPMorgan Chase":            "/logos/JPMorganChase.png",
  "Morgan Stanley":            "/logos/Morgan Stanley.png",
  "BlackRock":                 "/logos/BlackRock.png",
  "Capital One":               "/logos/Capital One.png",
  "Bank of America":           "/logos/Bank of America.png",
  "Citigroup":                 "/logos/Citigroup.png",
  "Citi":                      "/logos/Citigroup.png",
  "American Express":          "/logos/American Express.png",
  "State Street":              "/logos/State Street.png",
  "Guggenheim":                "/logos/Guggenheim Partners.png",
  "Apollo":                    "/logos/Apollo.png",
  // Consulting
  "McKinsey":                  "/logos/McKinsey & Company.png",
  "McKinsey & Company":        "/logos/McKinsey & Company.png",
  "BCG":                       "/logos/Boston Consulting Group.png",
  "Boston Consulting Group":   "/logos/Boston Consulting Group.png",
  "Deloitte":                  "/logos/Deloitte.png",
  "KPMG":                      "/logos/KPMG.png",
  "EY":                        "/logos/EY.png",
  "PwC":                       "/logos/PRICE WATERHOUSE COOPERS.png",
  "PricewaterhouseCoopers":    "/logos/PRICE WATERHOUSE COOPERS.png",
  "Accenture":                 "/logos/Accenture.png",
  "BDO":                       "/logos/BDO.png",
  // Semiconductor & Hardware
  "Applied Materials":         "/logos/Applied Materials.png",
  "KLA":                       "/logos/KLA.png",
  "Lam Research":              "/logos/Lam Research.png",
  "Marvell":                   "/logos/Marvell.png",
  "TSMC":                      "/logos/TSMC.png",
  "Texas Instruments":         "/logos/Texas Instruments.png",
  "Cirrus Logic":              "/logos/Cirrus Logic.png",
  "NXP":                       "/logos/NXP Semiconductors.png",
  "Renesas":                   "/logos/Renesas Electronics.png",
  "Skyworks":                  "/logos/Skyworks.png",
  // Healthcare / Pharma
  "Johnson & Johnson":         "/logos/Johnson & Johnson.png",
  "Merck":                     "/logos/Merck.png",
  "Bristol Myers Squibb":      "/logos/Bristol Myers Squibb.png",
  "Amgen":                     "/logos/Amgen.png",
  "Biogen":                    "/logos/Biogen.png",
  "Moderna":                   "/logos/Moderna.png",
  "AbbVie":                    "/logos/AbbVie.png",
  "Humana":                    "/logos/Humana.png",
  "CVS":                       "/logos/CVS Health.png",
  "Kaiser":                    "/logos/Kaiser Permanente.png",
  // Auto / Industrial
  "Tesla":                     "/logos/Tesla.png",
  "Ford":                      "/logos/Ford Motor Company.png",
  "General Motors":            "/logos/General Motors.png",
  "GM":                        "/logos/General Motors.png",
  "Nissan":                    "/logos/Nissan.png",
  "Volvo":                     "/logos/Volvo Group.png",
  "John Deere":                "/logos/John Deere.png",
  "GE":                        "/logos/General Electric.png",
  "General Electric":          "/logos/General Electric.png",
  "Bosch Group":               "/logos/Bosch Group.png",
  // Retail & Consumer
  "Amazon (Retail)":           "/logos/Amazon.png",
  "Walmart":                   "/logos/Walmart.png",
  "Target":                    "/logos/Target.png",
  "Costco":                    "/logos/Costco.png",
  "Nordstrom":                 "/logos/Nordstrom.png",
  "Kroger":                    "/logos/Kroger.png",
  // Media & Entertainment
  "Disney":                    "/logos/Disney.png",
  "Warner Bros":               "/logos/Warner Bros Discovery.png",
  "Sony":                      "/logos/Sony AI America Inc.png",
  "Spotify":                   "/logos/Spotify.png",
  "Sirius XM":                 "/logos/Sirius XM.png",
  "Skydance":                  "/logos/Skydance.png",
  // Logistics
  "FedEx":                     "/logos/FedEx.png",
  "UPS":                       null,
  "Amtrak":                    "/logos/Amtrak.png",
};

/**
 * Resolves a company name to its logo URL path.
 * Returns null if no logo is found.
 */
function resolveCompanyLogo(company) {
  if (!company) return null;
  // Exact match
  if (COMPANY_LOGO_MAP[company] !== undefined) return COMPANY_LOGO_MAP[company] || null;
  // Case-insensitive / substring match
  const lower = company.toLowerCase();
  for (const [key, val] of Object.entries(COMPANY_LOGO_MAP)) {
    if (key.toLowerCase() === lower) return val || null;
    if (lower.includes(key.toLowerCase()) && key.length > 3) return val || null;
  }
  return null;
}

const DEFAULT_FREE_MENTOR_PROFILE = {
  mentorId: "mentor_amazon_default",
  mentorName: "Y 导师",
  company: "Amazon",
  companyLogo: "/logos/Amazon.png",
};

const CONFLICTING_TECH_KEYWORDS = [
  "spring boot", "rest api", "redis", "react", "node", "typescript", "pytorch",
  "transformer", "cnn", "backend", "frontend", "ai engineer", "software engineer",
  "software development engineer", "machine learning engineer"
];
const ACCOUNTING_UNSAFE_KEYWORDS = [
  ...CONFLICTING_TECH_KEYWORDS,
  "tip out", "measured cycle", "whole cycle"
];
const ACCOUNTING_FINANCE_TERMS = [
  "accounting", "finance", "audit", "bookkeeping", "financial reporting",
  "reconciliation", "excel", "quickbooks", "gaap", "accounts payable",
  "accounts receivable", "tax", "accountant", "financial analyst"
];
const RESUME_SCOPE_PATTERN = /简历|resume|ats|jd|keyword|关键词|投递|summary|skills|experience|bullet|岗位匹配|岗位定位|targeted resume|resume version/i;
const INTERVIEW_SCOPE_PATTERN = /面试|interview|behavioral|favorite course|课程|mock interview|star|tell me about yourself|自我介绍|stock answer|答案/i;
const ATS_PROBLEM_TAGS = new Set([
  "low_jd_keyword_match",
  "missing_priority_keywords",
  "weak_target_role_alignment",
  "resume_not_tailored_to_jd",
  "low_hard_skill_match",
  "keyword_gap_minor",
  "weak_experience_keyword_evidence",
  "keywords_only_in_skills",
  "missing_exact_job_title",
]);
const FREE_HIGH_RISK_INTENTS = new Set([
  "resume_jd_keyword_fix",
  "resume_positioning",
  "resume_section_rewrite",
  "resume_content_quality",
]);

function normalizeTerm(term) {
  return String(term || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]+/gu, "")
    .replace(/^_+|_+$/g, "");
}

function splitCsv(value) {
  if (Array.isArray(value)) return value.map(normalizeTerm).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(/[,;|，、\n]+/)
    .map(normalizeTerm)
    .filter(Boolean);
}

function includesAny(rowTerms, queryTerms) {
  const rowSet = new Set(splitCsv(rowTerms));
  return splitCsv(queryTerms).some((term) => rowSet.has(term));
}

function overlapScore(queryTerms, rowTerms) {
  const query = [...new Set(splitCsv(queryTerms))];
  const row = new Set(splitCsv(rowTerms));
  if (!query.length || !row.size) return 0;
  const hits = query.filter((term) => row.has(term)).length;
  return hits / query.length;
}

function inferRoleFamilyFromJobTitle(jobTitle) {
  const text = String(jobTitle || "").toLowerCase();
  if (/\b(accountant|accounting|bookkeep|audit|tax|controller|cpa|accounts payable|accounts receivable)\b/.test(text)) {
    return "accounting";
  }
  if (/\b(finance|financial|investment|fp&a|valuation|treasury)\b/.test(text)) return "finance";
  if (/\b(business|operations|strategy)\b/.test(text)) return "business";
  if (/\b(software|swe|sde|backend|frontend|full stack|developer|engineer)\b/.test(text)) {
    return "software_engineer";
  }
  if (/\b(data analyst|analytics analyst|business intelligence|bi analyst)\b/.test(text)) return "data_analyst";
  return "unknown";
}

function qualityNormalized(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return Math.max(0, Math.min(1, numeric));
}

function dimensionsFromProblemTags(problemTags) {
  const map = {
    missing_exact_job_title: "F",
    keyword_gap_minor: "D",
    low_hard_skill_match: "D",
    low_soft_skill_match: "D",
    missing_priority_keywords: "D",
    low_jd_keyword_match: "D",
    weak_summary_role_alignment: "B",
    generic_resume_positioning: "F",
    low_role_specificity: "F",
    weak_target_role_alignment: "F",
    resume_not_tailored_to_jd: "D",
    low_measurable_results: "C",
    weak_action_verbs: "C",
    weak_result_orientation: "C",
    missing_linkedin: "B",
    missing_portfolio: "B",
    outdated_resume: "A",
    formatting_penalty_triggered: "A",
    short_tenure_unclear: "C",
    education_details_missing: "B",
  };
  return [...new Set(splitCsv(problemTags).map((tag) => map[tag]).filter(Boolean))];
}

function queryRoleFamilies(retrievalQuery = {}) {
  const filters = retrievalQuery.filters || {};
  const direct = normalizeTerm(retrievalQuery.roleFamily);
  const inferred = inferRoleFamilyFromJobTitle(`${retrievalQuery.targetRole || ""} ${retrievalQuery.queryText || ""}`);
  return [...new Set([...splitCsv(filters.roleFamily), direct, inferred].filter((term) => term && term !== "unknown"))];
}

function isBusinessQuery(retrievalQuery = {}) {
  return queryRoleFamilies(retrievalQuery).some((term) => BUSINESS_ROLE_FAMILIES.has(term));
}

function rowText(row) {
  return [
    row.topic, row.L1, row.L2, row.P_mentor, row.A_action, row.I_insight, row.H_hook,
    row.E_example, row.HR_os, row.keywords, row.retrieval_text, row.advice_card_title,
    row.user_problem_summary, row.action_summary, row.role_family, row.target_roles
  ].filter(Boolean).join(" ").toLowerCase();
}

function inferAdviceScope(row) {
  const text = rowText(row);
  if (INTERVIEW_SCOPE_PATTERN.test(text)) {
    if (/behavioral|star|tell me about yourself|自我介绍/i.test(text)) return "behavioral_interview";
    return "interview_prep";
  }
  if (RESUME_SCOPE_PATTERN.test(text)) {
    if (/rewrite|改写|精修|bullet|experience/i.test(text)) return "resume_rewrite";
    if (/投递|strategy|version|版本|定位/i.test(text)) return "resume_strategy";
    return "resume_ats";
  }
  if (/job search|求职|networking|linkedin|岗位/i.test(text)) return "job_search_strategy";
  if (/career|职业|成长|规划/i.test(text)) return "career_coaching";
  return "unknown";
}

function inferAdviceIntent(row) {
  const text = rowText(row);
  if (INTERVIEW_SCOPE_PATTERN.test(text)) return "interview_prep";
  if (/3\s*小时|三\s*小时|尽快投递|投递时间|application timing|timing|apply within|early application|抢投|海投/i.test(text)) {
    return "application_timing";
  }
  if (/jd|ats|keyword|关键词|机筛|匹配|岗位匹配|targeted resume|resume version|版本/i.test(text)) {
    return "resume_jd_keyword_fix";
  }
  if (/summary|skills|experience|bullet|section|板块|经历|项目|改写|rewrite|精修/i.test(text)) {
    return "resume_section_rewrite";
  }
  if (/定位|positioning|目标岗位|像.*岗位|role fit|岗位方向/i.test(text)) return "resume_positioning";
  if (/量化|成果|content quality|action verb|impact|表达|内容质量/i.test(text)) return "resume_content_quality";
  if (/job search|求职策略|linkedin|networking|内推|投递策略/i.test(text)) return "job_search_strategy";
  if (/career|职业|成长|规划/i.test(text)) return "career_coaching";
  return "resume_positioning";
}

// ── Issue-first matching helpers ──────────────────────────────────────────────

const ISSUE_SPECIFIC_TAGS = new Set([
  "weak_quantification", "weak_action_verbs", "vague_impact", "bullet_too_generic",
  "weak_summary", "unclear_positioning", "low_readability",
  "low_measurable_results", "weak_result_orientation", "weak_action_verb",
]);
const UNIVERSAL_TAGS = new Set([
  "format_issue", "readability_issue", "missing_contact_info", "objective_outdated",
  "formatting_penalty_triggered", "outdated_resume", "missing_linkedin", "missing_portfolio",
]);
const FUNCTION_GROUP_FAMILIES = {
  finance_group: ["finance", "accounting", "financial_analyst", "investment", "risk"],
  data_group: ["data_analyst", "data_scientist", "business_analyst", "bi_analyst"],
  marketing_group: ["marketing", "growth", "social_media", "brand", "content"],
};

/**
 * Infer how transferable an advice segment is across roles/industries.
 * Returns: "role_specific" | "function_specific" | "issue_specific" | "universal"
 * Note: this is different from inferAdviceScope() which returns resume_ats/interview_prep/etc.
 */
function inferAdviceTransferabilityScope(row) {
  const rowFamilies = splitCsv(row.role_family || row.roleFamily || "").filter((f) => f !== "universal");
  const tags = splitCsv(row.problem_tags);
  const text = rowText(row);

  // Universal: explicitly tagged universal or format/contact/objective issues
  if (rowFamilies.length === 0 || rowFamilies.includes("universal")) {
    if (tags.some((t) => UNIVERSAL_TAGS.has(t)) || /format|contact|objective|length|layout|section.?order/i.test(text)) {
      return "universal";
    }
  }

  // Issue-specific: problem tags that cross industry lines
  if (tags.some((t) => ISSUE_SPECIFIC_TAGS.has(t)) && rowFamilies.length === 0) return "issue_specific";

  // Role-bound: check if within a shared function group → function_specific
  if (rowFamilies.length > 0 && !rowFamilies.includes("universal")) {
    for (const [, group] of Object.entries(FUNCTION_GROUP_FAMILIES)) {
      if (rowFamilies.some((f) => group.includes(f))) return "function_specific";
    }
    return "role_specific";
  }

  // Issue-specific fallback (prefer over role_specific for cross-industry problems)
  if (tags.some((t) => ISSUE_SPECIFIC_TAGS.has(t))) return "issue_specific";
  return "issue_specific";
}

const ROLE_SENSITIVITY_BY_PROBLEM_TAG = {
  low_jd_keyword_match: 0.75,
  missing_domain_keywords: 0.85,
  low_hard_skill_match: 0.80,
  missing_priority_keywords: 0.75,
  weak_target_role_alignment: 0.55,
  weak_summary_role_alignment: 0.50,
  weak_summary: 0.45,
  unclear_positioning: 0.45,
  generic_resume_positioning: 0.50,
  resume_not_tailored_to_jd: 0.65,
  weak_experience_keyword_evidence: 0.55,
  keywords_only_in_skills: 0.50,
  weak_quantification: 0.25,
  weak_action_verbs: 0.20,
  vague_impact: 0.25,
  bullet_too_generic: 0.20,
  low_measurable_results: 0.25,
  weak_result_orientation: 0.25,
  format_issue: 0.10,
  readability_issue: 0.10,
  formatting_penalty_triggered: 0.10,
  missing_contact_info: 0.05,
  missing_linkedin: 0.08,
  objective_outdated: 0.05,
  outdated_resume: 0.05,
};

function getActionabilityScore(card) {
  const text = `${card.action || card.actionSummary || ""} ${card.reason || ""}`.trim();
  if (!text) return 0.3;
  const len = text.length;
  const lengthScore = Math.min(1, len / 200);
  const hasVerb = /\b(删除|改成|补上|在|把|加入|建议|优先|先|add|remove|replace|rewrite|change|update|include|删掉|写进|嵌入|调整|改写|移除)\b/i.test(text);
  const hasConcrete = /\d|%|关键词|bullet|section|summary|skills|experience|jd|ats|岗位词/i.test(text);
  return Math.min(1, (lengthScore * 0.4) + (hasVerb ? 0.35 : 0) + (hasConcrete ? 0.25 : 0));
}

function getSpecificityScore(card) {
  const text = `${card.title || ""} ${card.action || card.actionSummary || ""} ${card.mentorLens || ""}`.trim();
  if (!text) return 0.3;
  const hasExample = /例如|比如|e\.g\.|such as|例子|如：|like:|比如说/i.test(text);
  const hasSection = /summary|skills|experience|education|projects|bullet|section/i.test(text);
  const hasNumber = /\d/.test(text);
  const len = Math.min(1, text.length / 150);
  return Math.min(1, (hasExample ? 0.35 : 0) + (hasSection ? 0.25 : 0) + (hasNumber ? 0.15 : 0) + len * 0.25);
}

function getTransferabilityScore(card) {
  const scope = card._transferabilityScope || inferAdviceTransferabilityScope(card);
  switch (scope) {
    case "universal": return 1.0;
    case "issue_specific": return 0.80;
    case "function_specific": return 0.55;
    case "role_specific": return 0.30;
    default: return 0.60;
  }
}

function getProblemFitScore(card, problemTags = []) {
  if (!problemTags.length) return card.retrieval_score || 0;
  const related = relatedTagsForCard(card, problemTags);
  if (!related.length) return Math.min(0.3, card.retrieval_score || 0);
  const severities = new Map(problemTags.map((p) => [typeof p === "string" ? p : p.tag, p.severity || "medium"]));
  const weightedFit = related.reduce((sum, tag) => sum + severityWeight(severities.get(tag) || "medium"), 0);
  const maxPossible = problemTags.slice(0, 3).reduce((sum, p) => sum + severityWeight(p.severity || "medium"), 0) || 1;
  return Math.min(1, weightedFit / maxPossible);
}

function inferTopicCluster(card) {
  const text = `${card.title || ""} ${card.adviceIntent || ""} ${card.topic || ""} ${card.targetSection || ""}`.toLowerCase();
  const tags = card.relatedProblemTags || [];
  if (tags.some((t) => /jd_keyword|hard_skill|keyword_gap|priority_keyword/.test(t)) || /keyword|jd match|技能词|硬技能/.test(text)) return "JD Match";
  if (/summary|定位|about|headline|positioning/.test(text)) return "Summary Positioning";
  if (tags.some((t) => /role_alignment|target_role|exact_title/.test(t)) || /role.alignment|方向|岗位定位/.test(text)) return "Role Alignment";
  if (/skill|工具|技能区/.test(text)) return "Skills Section";
  if ((/experience|bullet|经历/.test(text)) && /impact|成果|量化|result/.test(text)) return "Bullet Impact";
  if (/quantif|量化|数字|数据|measure/.test(text)) return "Quantification";
  if (/action verb|动词|用词/.test(text)) return "Action Verbs";
  if (/format|格式|layout|版式/.test(text)) return "Format";
  if (/ats|machine|系统识别/.test(text)) return "ATS Screening";
  if (/hr|招聘|recruiter|筛选/.test(text)) return "HR Screening";
  if (/readability|阅读|可读/.test(text)) return "Readability";
  return "Overall";
}

function inferMentorFitType(card, userProfile = {}) {
  const transferScope = card._transferabilityScope || inferAdviceTransferabilityScope(card);
  const rowFamilies = splitCsv(card.roleFamily || card.role_family || "");
  const userFamily = normalizeTerm(userProfile.roleFamily || "");
  const hasSameRole = userFamily && rowFamilies.includes(userFamily);

  if (transferScope === "universal") return "ats_universal";
  if (card.adviceIntent === "resume_jd_keyword_fix" && transferScope !== "role_specific") return "ats_universal";
  if (hasSameRole) return "same_role";
  if (transferScope === "function_specific") return "same_function";
  if (transferScope === "issue_specific") return "cross_domain_high_relevance";
  if (rowFamilies.includes("universal")) return "ats_universal";
  return "cross_domain_high_relevance";
}

function generateAdviceExplanationMetadata(card, userProfile = {}) {
  const transferScope = card._transferabilityScope || inferAdviceTransferabilityScope(card);
  const mentorFitType = inferMentorFitType(card, userProfile);
  const topicCluster = card._topicCluster || inferTopicCluster(card);
  const tags = card.relatedProblemTags || [];
  const problemFit = getProblemFitScore(card, userProfile.problemTags || []);
  const roleMismatch = card.roleMismatchPenalty || 0;
  const roleFit = Math.max(0, 1 - roleMismatch);
  const confidenceScore = Math.round(
    (problemFit * 0.50 + roleFit * 0.20 + getTransferabilityScore(card) * 0.30) * 100
  ) / 100;

  let matchReason = "";
  if (mentorFitType === "ats_universal") {
    matchReason = "这是 ATS 通用建议，适用于所有岗位，不依赖特定产业背景。";
  } else if (mentorFitType === "same_role") {
    matchReason = "这位导师与你的目标职位方向一致，建议与你的岗位需求高度对齐。";
  } else if (mentorFitType === "same_function") {
    matchReason = "导师与你属于同一职能领域，这条建议在该职能内可安全复用。";
  } else if (mentorFitType === "recruiter_perspective") {
    matchReason = "这条建议来自 HR / Recruiter 视角，聚焦筛选逻辑，不依赖特定产业背景。";
  } else if (mentorFitType === "cross_domain_high_relevance") {
    if (transferScope === "issue_specific") {
      const tagName = tags[0] ? tags[0].replace(/_/g, " ") : "简历问题";
      matchReason = `虽然导师来自不同产业，但这条建议处理的是跨职位通用的「${tagName}」问题，可直接应用。`;
    } else {
      matchReason = "这条建议虽来自跨领域导师，但精准对应你当前的简历问题，属于跨领域高相关建议。";
    }
  } else {
    matchReason = "这条建议与你当前 ATS 简历问题高度相关。";
  }

  return {
    adviceTransferScope: transferScope,
    matchReason,
    mentorFitType,
    coveredProblemTags: tags,
    topicCluster,
    confidenceScore,
  };
}

function isEligibleForAtsResumeReport(row) {
  const scope = inferAdviceScope(row);
  const text = rowText(row);
  if (scope === "interview_prep" || scope === "behavioral_interview") return false;
  if (/favorite course|stock answer|面试答案|interview answers?/i.test(text)) return false;
  if (["resume_ats", "resume_rewrite", "resume_strategy", "job_search_strategy"].includes(scope)) return true;
  if (String(row.ats_dimensions || "").trim()) return true;
  if (splitCsv(row.problem_tags).some((tag) => ATS_PROBLEM_TAGS.has(tag))) return true;
  return false;
}

function isTechOnlyRow(row) {
  const rowRoles = [...splitCsv(row.role_family), ...splitCsv(row.target_roles)].filter((term) => term !== "universal");
  return rowRoles.length > 0 && rowRoles.every((term) =>
    TECH_ROLE_FAMILIES.has(term) || /software|backend|frontend|ai|machine_learning/.test(term)
  );
}

function hasConflictingRoleExamples(row, retrievalQuery = {}) {
  if (!isBusinessQuery(retrievalQuery)) return false;
  const text = rowText(row);
  const unsafe = isAccountingQuery(retrievalQuery) ? ACCOUNTING_UNSAFE_KEYWORDS : CONFLICTING_TECH_KEYWORDS;
  return unsafe.some((keyword) => text.includes(keyword));
}

function isAdviceRoleSafe(row, targetRole, roleFamily) {
  const normalizedRole = normalizeTerm(targetRole || "");
  const normalizedFamily = normalizeTerm(roleFamily || inferRoleFamilyFromJobTitle(targetRole));
  const retrievalQuery = {
    roleFamily: normalizedFamily,
    targetRole: normalizedRole,
    queryText: `${targetRole || ""} ${roleFamily || ""}`,
    filters: {
      roleFamily: [normalizedFamily].filter(Boolean),
      targetRoles: [normalizedRole].filter(Boolean),
    },
  };
  const scope = row.adviceScope || inferAdviceScope(row);
  const intent = row.adviceIntent || inferAdviceIntent(row);
  const text = rowText(row);

  if (scope === "interview_prep" || scope === "behavioral_interview") return false;
  if (intent === "interview_prep") return false;
  if (!isEligibleForAtsResumeReport(row)) return false;
  if (hasConflictingRoleExamples(row, retrievalQuery)) return false;

  const nonTechnical = !["software_engineer", "ai_engineer", "machine_learning", "data_scientist"].includes(normalizedFamily);
  if (nonTechnical && CONFLICTING_TECH_KEYWORDS.some((keyword) => text.includes(keyword))) return false;
  if (normalizedFamily === "accounting" || normalizedFamily === "finance" || /account/.test(normalizedRole)) {
    if (ACCOUNTING_UNSAFE_KEYWORDS.some((keyword) => text.includes(keyword))) return false;
  }
  return /resume|ats|jd|keyword|summary|skills|experience|bullet|简历|关键词|岗位|匹配|经历/i.test(text);
}

function calculateRoleMismatchPenalty(row, retrievalQuery = {}) {
  const queryFamilies = queryRoleFamilies(retrievalQuery);
  const rowFamilies = splitCsv(row.role_family);
  const rowTargets = splitCsv(row.target_roles);
  const concreteFamilies = rowFamilies.filter((term) => term !== "universal");
  const concreteTargets = rowTargets.filter((term) => term !== "universal");
  const businessQuery = queryFamilies.some((term) => BUSINESS_ROLE_FAMILIES.has(term));
  const familyMatch = concreteFamilies.some((term) => queryFamilies.includes(term));

  if (!queryFamilies.length) return 0;
  if (businessQuery && isTechOnlyRow(row)) return 0.65;
  if (businessQuery && concreteTargets.some((term) => /software|backend|frontend|ai|machine_learning/.test(term))) return 0.5;
  if (!familyMatch && concreteFamilies.length) return 0.35;
  if (rowFamilies.includes("universal") && !familyMatch) return 0.08;
  return 0;
}

function conflictingExamplePenalty(row, retrievalQuery = {}) {
  return hasConflictingRoleExamples(row, retrievalQuery) ? 0.45 : 0;
}

function calculateRetrievalScore(row, retrievalQuery = {}) {
  const filters = retrievalQuery.filters || {};
  const problemTagScore = overlapScore(retrievalQuery.problemTags, row.problem_tags);
  const roleFamilyScore = overlapScore(filters.roleFamily, row.role_family);
  const targetRoleScore = overlapScore(filters.targetRoles, row.target_roles);
  const seniorityScore = includesAny(row.seniority, "universal")
    ? Math.max(0.65, overlapScore(filters.seniority, row.seniority))
    : overlapScore(filters.seniority, row.seniority);
  const keywordScore = overlapScore(retrievalQuery.priorityKeywords, row.keywords);
  const dimensionScore = overlapScore(dimensionsFromProblemTags(retrievalQuery.problemTags), row.ats_dimensions);
  const accountingKeywordBoost = isBusinessQuery(retrievalQuery) ? overlapScore(ACCOUNTING_FINANCE_TERMS, row.keywords) : 0;
  const roleMismatchPenalty = calculateRoleMismatchPenalty(row, retrievalQuery);
  const roleConflictPenalty = conflictingExamplePenalty(row, retrievalQuery);

  const score =
    0.35 * Math.max(problemTagScore, dimensionScore * 0.8) +
    0.25 * roleFamilyScore +
    0.15 * targetRoleScore +
    0.10 * seniorityScore +
    0.10 * Math.max(keywordScore, accountingKeywordBoost) +
    0.05 * qualityNormalized(row.mentor_quality_score) -
    roleMismatchPenalty -
    roleConflictPenalty;

  return Number(score.toFixed(6));
}

function buildMatchedReasons(row, retrievalQuery = {}) {
  const filters = retrievalQuery.filters || {};
  const reasons = [];
  if (overlapScore(retrievalQuery.problemTags, row.problem_tags) > 0) reasons.push("problem_tags");
  if (overlapScore(filters.roleFamily, row.role_family) > 0) reasons.push("role_family");
  if (overlapScore(filters.targetRoles, row.target_roles) > 0) reasons.push("target_roles");
  if (overlapScore(filters.seniority, row.seniority) > 0) reasons.push("seniority");
  if (overlapScore(retrievalQuery.priorityKeywords, row.keywords) > 0) reasons.push("keywords");
  if (overlapScore(dimensionsFromProblemTags(retrievalQuery.problemTags), row.ats_dimensions) > 0) reasons.push("ats_dimensions");
  if (calculateRoleMismatchPenalty(row, retrievalQuery) > 0) reasons.push("role_mismatch_penalty");
  if (hasConflictingRoleExamples(row, retrievalQuery)) reasons.push("conflicting_role_examples");
  const scope = inferAdviceScope(row);
  if (scope !== "unknown") reasons.push(`scope:${scope}`);
  if (includesAny(row.role_family, "universal") || includesAny(row.target_roles, "universal") || includesAny(row.seniority, "universal")) {
    reasons.push("universal_fallback");
  }
  return [...new Set(reasons)];
}

// Circled digit codepoints U+2460-U+2469 (①-⑩) and U+2776-U+277F (❶-❿)
function isEnumChar(ch) {
  if (!ch) return false;
  var cp = ch.codePointAt(0);
  return (cp >= 0x2460 && cp <= 0x2469) || (cp >= 0x2776 && cp <= 0x277F);
}

function cleanAndTruncate(value, maxLength, fallback) {
  maxLength = maxLength == null ? 140 : maxLength;
  fallback = fallback == null ? '' : fallback;
  var text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  if (text.length <= maxLength) return text;
  var slice = text.slice(0, maxLength);
  var sentenceEnd = Math.max(
    slice.lastIndexOf("。"), slice.lastIndexOf("."), slice.lastIndexOf("！"),
    slice.lastIndexOf("!"),      slice.lastIndexOf("？"), slice.lastIndexOf("?")
  );
  if (sentenceEnd >= 24) return slice.slice(0, sentenceEnd + 1).trim();
  var commaEnd = -1;
  ["，", ","].forEach(function(sep) {
    var idx = slice.lastIndexOf(sep);
    if (idx >= 24) commaEnd = Math.max(commaEnd, idx);
  });
  // Accept ；/; as break only when NOT followed by an enumeration marker
  ["；", ";"].forEach(function(sep) {
    var idx = slice.lastIndexOf(sep);
    if (idx >= 24 && !isEnumChar(text[idx + 1])) commaEnd = Math.max(commaEnd, idx);
  });
  var cut = commaEnd >= 24 ? slice.slice(0, commaEnd).trim() : slice.trim();
  cut = cut.replace(/[\s([{,:]+$/, "").trim();
  var lastSpace = cut.lastIndexOf(" ");
  if (/^[\x00-\x7F]+$/.test(cut) && lastSpace > Math.floor(maxLength * 0.55)) {
    cut = cut.slice(0, lastSpace).trim();
  }
  if (!cut || /[(（\[{]$/.test(cut)) {
    return fallback || (text.slice(0, Math.max(1, maxLength - 3)).trim() + "...");
  }
  return cut + "...";
}

function truncateAtSentence(value, maxLength = 140) {
  return cleanAndTruncate(value, maxLength);
}

function roleSafeActionSummary(row, retrievalQuery = {}) {
  if (hasConflictingRoleExamples(row, retrievalQuery)) {
    return "根据目标岗位维护不同版本简历，把最相关的技能、项目和关键词放到对应版本里。";
  }
  return row.action_summary || row.A_action;
}

function formatAdviceCardForPublic(row, retrievalQuery = {}) {
  return {
    adviceId: row.chunk_id || `seg_${row.id}`,
    title: row.advice_card_title || row.topic,
    problemSummary: cleanAndTruncate(row.user_problem_summary || row.P_mentor, 180),
    actionSummary: cleanAndTruncate(roleSafeActionSummary(row, retrievalQuery), 500),
    mentorInsight: row.I_insight || "",
    example: row.E_example || "",
    hrPerspective: row.HR_os || "",
    topic: row.topic_slug || row.L2,
    mentorName: row.mentor_name,
    unlockTier: row.unlock_tier || "paid",
    safeToShowFree: Number(row.safe_to_show_free || 0) === 1,
    roleFamily: row.role_family || "",
    targetRoles: row.target_roles || "",
    keywords: row.keywords || "",
    atsDimensions: row.ats_dimensions || "",
    retrieval_score: row.retrieval_score,
    matched_reasons: row.matched_reasons || [],
    roleMismatchPenalty: row.roleMismatchPenalty || 0,
    conflictingExamplePenalty: row.conflictingExamplePenalty || 0,
    adviceScope: row.adviceScope || inferAdviceScope(row),
    adviceIntent: row.adviceIntent || inferAdviceIntent(row),
    mentor_title: row.mentor_title || null,
    mentor_career_keywords: row.mentor_career_keywords || null,
    mentor_career_path_display: row.mentor_career_path_display || null,
    mentor_company: row.mentor_company || null,
  };
}

function formatAdviceCard(row) {
  return formatAdviceCardForPublic(row, {});
}

function baseSelectSql(where) {
  return `
    SELECT
      id, chunk_id, topic, "L1", "L2", "P_mentor", "A_action", "I_insight", "H_hook", "E_example", "HR_os",
      advice_type, mentor_name, role_family, target_roles, seniority, ats_dimensions,
      problem_tags, keywords, topic_slug, retrieval_text, priority, unlock_tier,
      advice_card_title, user_problem_summary, action_summary, safe_to_show_free,
      requires_ai_rewrite, mentor_quality_score, feedback_score,
      mentor_title, mentor_career_keywords, mentor_career_path_display, mentor_company
    FROM segments
    WHERE ${where}
    LIMIT 500
  `;
}

function likeClauseForTerms(columns, terms, startIdx = 1) {
  const clauses = [];
  const params = [];
  let idx = startIdx;
  for (const term of [...new Set(terms)].filter(Boolean).slice(0, 30)) {
    const like = `%${term.replace(/_/g, "%")}%`;
    clauses.push(`(${columns.map((col) => `LOWER(COALESCE(${col},'')) LIKE $${idx++}`).join(" OR ")})`);
    params.push(...columns.map(() => like));
  }
  return { clause: clauses.length ? clauses.join(" OR ") : "1 = 0", params };
}

async function queryRows(pool, where, params, retrievalQuery) {
  const { rows } = await pool.query(baseSelectSql(where), params);
  return rows
    .filter((row) => isEligibleForAtsResumeReport(row))
    .map((row) => {
      const retrieval_score = calculateRetrievalScore(row, retrievalQuery);
      const matched_reasons = buildMatchedReasons(row, retrievalQuery);
      const roleMismatchPenalty = calculateRoleMismatchPenalty(row, retrievalQuery);
      const rowConflictPenalty = conflictingExamplePenalty(row, retrievalQuery);
      return formatAdviceCardForPublic({
        ...row,
        retrieval_score,
        matched_reasons,
        roleMismatchPenalty,
        conflictingExamplePenalty: rowConflictPenalty,
        adviceScope: inferAdviceScope(row),
        adviceIntent: inferAdviceIntent(row),
      }, retrievalQuery);
    });
}

function isHighRiskAtsGap(retrievalQuery = {}) {
  const tags = splitCsv(retrievalQuery.problemTags);
  const text = `${retrievalQuery.queryText || ""} ${tags.join(" ")}`.toLowerCase();
  return tags.some((tag) => ["low_jd_keyword_match", "low_hard_skill_match", "weak_target_role_alignment", "missing_priority_keywords"].includes(tag)) ||
    /high|critical|low_jd|low_hard|keyword_gap/.test(text);
}

function isAccountingQuery(retrievalQuery = {}) {
  return queryRoleFamilies(retrievalQuery).some((term) => term === "accounting" || term === "finance");
}

function hasStrictSignal(card) {
  return card.matched_reasons.some((reason) => [
    "problem_tags",
    "ats_dimensions",
    "role_family",
    "target_roles",
    "keywords",
  ].includes(reason));
}

function isGenericUniversalResumeAdvice(card) {
  const reasons = card.matched_reasons || [];
  const scopeAllowed = ["resume_ats", "resume_rewrite", "resume_strategy", "job_search_strategy"].includes(card.adviceScope);
  return scopeAllowed && reasons.includes("universal_fallback") && !reasons.includes("conflicting_role_examples");
}

function rankCandidates(candidates, limit) {
  return candidates
    .filter((card) => card.retrieval_score > 0)
    .sort((a, b) =>
      b.retrieval_score - a.retrieval_score ||
      Number(b.safeToShowFree) - Number(a.safeToShowFree) ||
      String(a.adviceId).localeCompare(String(b.adviceId))
    )
    .slice(0, limit);
}

async function retrieveStrictCandidates(retrievalQuery = {}, options = {}) {
  const pool = options.pool || db.getPool();
  const filters = retrievalQuery.filters || {};
  const terms = [
    ...splitCsv(filters.roleFamily),
    ...splitCsv(filters.targetRoles),
    ...splitCsv(retrievalQuery.problemTags),
    ...splitCsv(retrievalQuery.priorityKeywords),
    ...dimensionsFromProblemTags(retrievalQuery.problemTags),
  ].filter((term) => term && term !== "unknown" && term !== "universal");
  const { clause, params } = likeClauseForTerms(
    ["role_family", "target_roles", "problem_tags", "keywords", "ats_dimensions", "retrieval_text"],
    terms
  );
  const rows = (await queryRows(pool, clause, params, retrievalQuery))
    .filter(hasStrictSignal)
    .filter((card) => !card.matched_reasons.includes("conflicting_role_examples"))
    .filter((card) => card.roleMismatchPenalty < 0.35);
  return rankCandidates(rows, options.limit || 80);
}

async function retrieveFallbackCandidates(retrievalQuery = {}, options = {}) {
  const pool = options.pool || db.getPool();
  const terms = [
    ...splitCsv(retrievalQuery.problemTags),
    ...splitCsv(retrievalQuery.priorityKeywords),
    ...dimensionsFromProblemTags(retrievalQuery.problemTags),
    "universal",
  ].filter(Boolean);
  const { clause, params } = likeClauseForTerms(
    ["role_family", "target_roles", "seniority", "problem_tags", "keywords", "ats_dimensions", "retrieval_text"],
    terms
  );
  const rows = (await queryRows(pool, clause, params, retrievalQuery))
    .filter(isGenericUniversalResumeAdvice)
    .filter((card) => !card.matched_reasons.includes("conflicting_role_examples"));
  return rankCandidates(rows, options.limit || 80);
}

async function retrieveMentorAdvice(retrievalQuery = {}, options = {}) {
  const limit = options.limit || 80;
  const pool = options.pool || db.getPool();

  const [countResult, allRowsResult] = await Promise.all([
    pool.query("SELECT COUNT(*) AS count FROM segments"),
    pool.query(baseSelectSql("1 = 1"), []),
  ]);
  const rawRows = parseInt(countResult.rows[0].count, 10);
  const allRows = allRowsResult.rows;
  const eligibleRows = allRows.filter(isEligibleForAtsResumeReport);
  const excludedInterviewAdvice = allRows
    .filter((row) => ["interview_prep", "behavioral_interview"].includes(inferAdviceScope(row))).length;

  const [strictCandidates, fallbackCandidates] = await Promise.all([
    retrieveStrictCandidates(retrievalQuery, { ...options, pool, limit }),
    retrieveFallbackCandidates(retrievalQuery, { ...options, pool, limit }),
  ]);

  const byId = new Map();
  for (const candidate of [...strictCandidates, ...fallbackCandidates]) {
    const existing = byId.get(candidate.adviceId);
    if (!existing || candidate.retrieval_score > existing.retrieval_score) byId.set(candidate.adviceId, candidate);
  }
  const candidates = rankCandidates([...byId.values()], limit);
  Object.defineProperty(candidates, "debug", {
    enumerable: false,
    value: {
      strictCandidates: strictCandidates.length,
      fallbackCandidates: fallbackCandidates.length,
      rawRows,
      eligibleRows: eligibleRows.length,
      excludedInterviewAdvice,
      maxRoleMismatchPenalty: candidates.reduce((max, card) => Math.max(max, card.roleMismatchPenalty || 0), 0),
      selectedScope: candidates[0]?.adviceScope || "fallback",
      retrievalQuery,
    },
  });
  return candidates;
}

function selectFreeAdvice(candidates, retrievalQuery = candidates?.debug?.retrievalQuery || {}) {
  const requireResumeIntent = isHighRiskAtsGap(retrievalQuery);
  const freeAdvice = candidates
    .filter((card) => card.unlockTier === "free" || card.safeToShowFree)
    .filter((card) => !["interview_prep", "behavioral_interview"].includes(card.adviceScope))
    .filter((card) => card.adviceIntent !== "application_timing")
    .filter((card) => !requireResumeIntent || FREE_HIGH_RISK_INTENTS.has(card.adviceIntent))
    .filter((card) => !card.matched_reasons?.includes("conflicting_role_examples"))
    .sort((a, b) => b.retrieval_score - a.retrieval_score || String(a.adviceId).localeCompare(String(b.adviceId)))[0];
  return freeAdvice || (isAccountingQuery(retrievalQuery) ? ACCOUNTING_FALLBACK_FREE_ADVICE : FALLBACK_FREE_ADVICE);
}

function selectPaidAdvice(candidates, freeAdvice) {
  const selected = [];
  const usedTopics = new Set();
  const freeId = freeAdvice?.adviceId;
  const paidCandidates = candidates
    .filter((card) => card.adviceId !== freeId)
    .filter((card) => !["interview_prep", "behavioral_interview"].includes(card.adviceScope))
    .filter((card) => !card.matched_reasons?.includes("conflicting_role_examples"))
    .sort((a, b) =>
      Number(b.unlockTier === "paid") - Number(a.unlockTier === "paid") ||
      b.retrieval_score - a.retrieval_score ||
      String(a.adviceId).localeCompare(String(b.adviceId))
    );

  for (const card of paidCandidates) {
    if (selected.length >= 3) break;
    if (card.topic && usedTopics.has(card.topic)) continue;
    selected.push(card);
    if (card.topic) usedTopics.add(card.topic);
  }

  for (const card of paidCandidates) {
    if (selected.length >= 3) break;
    if (!selected.some((item) => item.adviceId === card.adviceId)) selected.push(card);
  }

  return selected.slice(0, 3);
}

function problemTagsFromInternal(internalAtsResult = {}) {
  return (internalAtsResult.problemTags || []).map((item) => ({
    tag: item.tag,
    severity: item.severity || "medium",
    dimension: item.dimension || "overall",
    topic: item.topic || "resume_ats",
  })).filter((item) => item.tag);
}

function severityWeight(severity) {
  return { critical: 1, high: 0.85, medium: 0.55, low: 0.25 }[severity] ?? 0.4;
}

function targetSectionFromCard(card = {}) {
  const text = `${card.title || ""} ${card.problemSummary || ""} ${card.actionSummary || ""} ${card.topic || ""}`.toLowerCase();
  if (/summary|定位|about/.test(text)) return "summary";
  if (/skill|关键词|keyword|工具/.test(text)) return "skills";
  if (/experience|bullet|经历|项目|证据/.test(text)) return "experience";
  if (/education|gpa|coursework|学校/.test(text)) return "education";
  if (/project|项目/.test(text)) return "projects";
  return "overall";
}

function priorityFromTags(tags = [], problemTags = []) {
  const severities = new Map(problemTags.map((item) => [item.tag, item.severity]));
  if (tags.some((tag) => ["critical", "high"].includes(severities.get(tag)))) return "high";
  if (tags.some((tag) => severities.get(tag) === "medium")) return "medium";
  return "low";
}

function priorityLabel(priority) {
  if (priority === "high" || priority === "critical") return "P0 必改";
  if (priority === "medium") return "P1 建议改";
  return "P2 加分项";
}

function generateUserDiagnosis(relatedProblemTags = [], targetProblemTags = [], internalAtsResult = {}, usedDiagnosisTags = new Set()) {
  const dims = internalAtsResult.dimensions || {};
  const missingKw = (internalAtsResult.topMissingKeywords || internalAtsResult.topMissingKw || []).slice(0, 3);
  const jobTitle = internalAtsResult.jobTitle || "目标岗位";
  const jdRatio = internalAtsResult.jdMatchRatio != null
    ? Math.round(internalAtsResult.jdMatchRatio)
    : internalAtsResult.keywordMatch?.summary?.overallKeywordCoverage != null
      ? Math.round(internalAtsResult.keywordMatch.summary.overallKeywordCoverage * 100)
      : null;

  const diagnoses = {
    low_jd_keyword_match: () =>
      `简历与目标 JD 的关键词匹配偏低${jdRatio != null ? `（当前约 ${jdRatio}%）` : ""}，ATS 扫描时匹配信号不够强，容易在第一轮被过滤。`,
    low_hard_skill_match: () =>
      `目标岗位的核心技能词${missingKw.length ? `（如 ${missingKw.join("、")}）` : ""}在简历中出现不足，ATS 难以确认你的技能匹配度。`,
    missing_exact_job_title: () =>
      `简历中缺少"${jobTitle}"作为精确职位名称，ATS 按岗位原词检索时可能会排除你的简历。`,
    missing_priority_keywords: () =>
      `简历缺少目标岗位优先级较高的关键词${missingKw.length ? `（如 ${missingKw.join("、")}）` : ""}，这些词在 ATS 中权重较高。`,
    weak_summary_role_alignment: () =>
      `Summary 段落与目标岗位"${jobTitle}"的定位关联不够直接，HR 初筛时难以快速识别你的求职方向。`,
    weak_target_role_alignment: () =>
      `简历整体对"${jobTitle}"的方向匹配度偏弱，需要更系统地对照 JD 调整定位和关键词。`,
    weak_experience_keyword_evidence: () =>
      `经历 bullet 中目标岗位的核心技能证据不足，技能更多出现在 Skills 栏，缺少在实际工作中使用它们的成果佐证。`,
    keywords_only_in_skills: () =>
      `核心技能词主要集中在 Skills 栏，在 Experience 的 bullet 里缺少通过实际成果呈现它们的记录，说服力较弱。`,
    resume_not_tailored_to_jd: () =>
      `简历内容与目标 JD 的针对性不足，未能体现对"${jobTitle}"关键词和要求的专项对应。`,
  };

  const unusedTags = relatedProblemTags.filter(t => diagnoses[t] && !usedDiagnosisTags.has(t));
  const tagPool = unusedTags.length ? unusedTags : relatedProblemTags;
  for (const tag of tagPool) {
    if (diagnoses[tag]) {
      usedDiagnosisTags.add(tag);
      return diagnoses[tag]();
    }
  }

  // Generic fallback: point to weakest dimension
  const weakDimLabels = { A: "格式规范", B: "基本资料", C: "内容质量", D: "JD 关键词匹配", E: "市场适配度", F: "经验匹配度" };
  const dimEntries = Object.entries(dims)
    .map(([k, v]) => ({ k, pct: v.max > 0 ? v.score / v.max : 1 }))
    .sort((a, b) => a.pct - b.pct);
  if (dimEntries.length && dimEntries[0].pct < 0.65 && weakDimLabels[dimEntries[0].k]) {
    return `简历在「${weakDimLabels[dimEntries[0].k]}」维度得分偏低，这是影响 ATS 通过率的主要因素之一。`;
  }
  return `简历与目标岗位的匹配信号还不够集中，建议重点对照 JD 优化关键词和成果表达。`;
}

function isBucketRoleSafe(bucket, targetRoleFamily) {
  if (!targetRoleFamily || targetRoleFamily === "unknown") return true;
  const families = bucket.roleFamilies || [];
  // Allow universal content or buckets with no role tags (old data)
  if (families.length === 0) return true;
  if (families.includes("universal")) return true;
  return families.includes(normalizeTerm(targetRoleFamily));
}

function relatedTagsForCard(card = {}, targetProblemTags = []) {
  const cardReasons = splitCsv(card.matched_reasons || []);
  const text = `${card.title || ""} ${card.problemSummary || ""} ${card.actionSummary || ""} ${card.topic || ""} ${card.adviceIntent || ""}`.toLowerCase();
  const tags = [];
  for (const problem of targetProblemTags) {
    const tag = problem.tag;
    if (!tag) continue;
    if (cardReasons.includes(tag) || text.includes(tag.replace(/_/g, " "))) tags.push(tag);
    else if (/keyword|关键词|jd|ats/.test(text) && /keyword|jd|hard_skill|priority/.test(tag)) tags.push(tag);
    else if (/summary|定位|position/.test(text) && /summary|role|title|position/.test(tag)) tags.push(tag);
    else if (/experience|bullet|经历|证据/.test(text) && /experience|evidence|skills_only/.test(tag)) tags.push(tag);
    else if (/量化|result|impact|成果/.test(text) && /measurable|result|action/.test(tag)) tags.push(tag);
    else if (/linkedin|portfolio|searchability/.test(text) && /linkedin|portfolio|searchability/.test(tag)) tags.push(tag);
  }
  return [...new Set(tags)].slice(0, 3);
}

function toAdviceItem(card = {}, targetProblemTags = [], index = 0, includePremiumFields = false, internalAtsResult = {}, usedDiagnosisTags = new Set()) {
  const relatedProblemTags = card.relatedProblemTags || relatedTagsForCard(card, targetProblemTags);
  const defaultAction = "优先把目标岗位关键词、相关技能和经历证据放到 Summary、Skills 和 Experience 中。";

  // Always generate diagnosis from the CURRENT user's ATS data, not the original DB user's problem summary
  const currentDiagnosis = generateUserDiagnosis(relatedProblemTags, targetProblemTags, internalAtsResult, usedDiagnosisTags);
  const action = cleanAndTruncate(
    card.action || card.actionSummary || defaultAction,
    500, defaultAction
  );
  // mentorLens: new schema field; for DB-adapted rows derive from P_mentor if helpful
  const mentorLens = card.mentorLens || "";
  // reason: new schema field; for DB-adapted rows, I_insight is the closest analog
  const reason = card.reason || "";
  // evidence: explicit chips array; populated by fallback templates or buildAdviceEvidence later
  const evidence = Array.isArray(card.evidence) ? [...card.evidence] : [];

  // Determine source: prefer explicit, then detect whether we have native new-schema fields
  const hasNativeNewSchema = !!(card.mentorLens || card.currentDiagnosis || card.action || card.reason);
  const source = card.source || (hasNativeNewSchema ? "db" : "db_adapted");

  const item = {
    adviceId: card.adviceId || `fallback_${index}`,
    title: cleanAndTruncate(card.title || "优化简历与目标岗位的匹配度", 80, "优化简历与目标岗位的匹配度"),
    mentorLens,
    currentDiagnosis,
    action,
    reason,
    evidence,
    // backward compat aliases
    problemSummary: currentDiagnosis,
    actionSummary: action,
    targetSection: card.targetSection || targetSectionFromCard(card),
    relatedProblemTags,
    priority: card.priority || priorityFromTags(relatedProblemTags, targetProblemTags),
    priorityLabel: priorityLabel(card.priority || priorityFromTags(relatedProblemTags, targetProblemTags)),
    source,
  };
  if (includePremiumFields) {
    item.mentorInsight = card.mentorInsight || card.I_insight || "";
    item.example = card.example || card.E_example || "";
    item.hrPerspective = card.hrPerspective || card.HR_os || "";
  }
  return item;
}

function fallbackAdviceItems(internalAtsResult = {}, count = 3, usedTags = new Set()) {
  const profile = internalAtsResult.profile || {};
  const roleFamily = normalizeTerm(profile.roleFamily || "");
  const targetRole = internalAtsResult.jobTitle || profile.targetRole || "target role";

  const ROLE_PROFILES = {
    accounting:        { name: "Accounting",        keywords: "financial reporting、reconciliation、Excel、QuickBooks、GAAP、accounts payable/receivable、audit support 或 month-end close",         evidence: "说明你处理了什么报表、对账、发票或流程，并补充数量、频率或结果。" },
    finance:           { name: "Finance",            keywords: "financial modeling、Excel、valuation、DCF、budgeting、variance analysis、FP&A、Bloomberg 或 financial statements",                   evidence: "说明你构建了什么模型、分析了什么财务数据、支持了什么决策，并补充规模或结果。" },
    financial_analyst: { name: "Financial Analyst",  keywords: "financial modeling、Excel、variance analysis、budgeting、forecasting、KPI tracking 或 reporting",                                    evidence: "说明你分析了什么数据、提交了什么报告、支持了什么业务决策。" },
    software_engineer: { name: "Software Engineer",  keywords: "distributed systems、microservices、APIs、CI/CD、AWS、TypeScript、Java、Python 或 system design",                                    evidence: "说明你设计或实现了什么服务、API 或系统模块，并补充规模、性能或可靠性结果。" },
    ai_engineer:       { name: "AI / ML Engineer",   keywords: "Python、PyTorch、TensorFlow、LLM、fine-tuning、model deployment、RAG、vector DB 或 ML pipeline",                                    evidence: "说明你训练或部署了什么模型，并补充准确率、延迟或业务影响。" },
    machine_learning:  { name: "Machine Learning",   keywords: "Python、scikit-learn、PyTorch、feature engineering、model evaluation、A/B testing 或 data pipeline",                               evidence: "说明你解决了什么 ML 问题、使用了什么方法、取得了什么指标结果。" },
    data_scientist:    { name: "Data Scientist",     keywords: "Python、R、SQL、statistical modeling、A/B testing、machine learning、visualization 或 experimentation",                            evidence: "说明你做了什么分析、使用了什么方法、输出了什么洞察或业务建议。" },
    data_analyst:      { name: "Data Analyst",       keywords: "SQL、Excel、Tableau、Power BI、data cleaning、KPI reporting、dashboards 或 business insights",                                     evidence: "说明你清洗了什么数据、搭建了什么 dashboard、追踪了什么 KPI，并补充业务洞察或结果。" },
    product_manager:   { name: "Product Manager",    keywords: "product roadmap、user research、A/B testing、PRD、stakeholder management、OKR、go-to-market 或 cross-functional",                  evidence: "说明你负责了什么产品或功能、如何推动跨团队协作、取得了什么可量化结果。" },
    marketing:         { name: "Marketing",          keywords: "campaign management、SEO/SEM、Google Analytics、content strategy、brand awareness、lead generation 或 CRM",                        evidence: "说明你策划或执行了什么 campaign、使用了什么渠道、取得了什么转化或增长结果。" },
    business_analyst:  { name: "Business Analyst",   keywords: "requirements gathering、process improvement、SQL、Excel、stakeholder communication、Agile、JIRA 或 business case",                  evidence: "说明你分析了什么业务问题、提出了什么方案、推动了什么流程改进或结果。" },
    consulting:        { name: "Consulting",         keywords: "client engagement、problem structuring、data analysis、presentation、Excel modeling、project management 或 cross-industry",         evidence: "说明你参与了什么项目、解决了什么客户问题、产出了什么交付物或建议。" },
    operations:        { name: "Operations",         keywords: "process optimization、supply chain、logistics、KPI tracking、cross-functional coordination、lean 或 project management",            evidence: "说明你优化了什么流程、管理了什么运营指标、取得了什么效率或成本改善。" },
    project_manager:   { name: "Project Manager",    keywords: "PMP、Agile、Scrum、stakeholder management、budget control、risk management、timeline 或 cross-functional coordination",             evidence: "说明你管理了什么项目、规模多大、如何控制风险、最终交付了什么结果。" },
    sales:             { name: "Sales",              keywords: "quota attainment、pipeline management、CRM、Salesforce、account management、cold outreach、negotiation 或 revenue growth",          evidence: "说明你负责了什么区域或客户、达成了什么销售目标、取得了什么业绩数据。" },
    ux_design:         { name: "UX / Product Design", keywords: "Figma、user research、wireframing、prototyping、usability testing、design system 或 user journey mapping",                        evidence: "说明你设计了什么产品或功能、怎么做的用研、最终用户体验有什么改善。" },
    hr:                { name: "HR / People Ops",    keywords: "talent acquisition、onboarding、HRIS、employee relations、performance management、Workday 或 HR policy",                          evidence: "说明你负责了什么招聘或人事流程、管理了多少人或职位、取得了什么效率或满意度结果。" },
  };

  const rp = ROLE_PROFILES[roleFamily] || {
    name: targetRole !== "target role" ? targetRole : "目标岗位",
    keywords: "target role keywords、JD 核心职责、role-specific tools 和真实掌握的岗位技能",
    evidence: "说明你承担了什么职责、使用了什么工具、产出了什么结果，并尽量补充数量、频率或影响。",
  };
  const roleName = rp.name;
  const keywordText = rp.keywords;
  const evidenceText = rp.evidence;
  const isAccounting = ["accounting", "finance", "financial_analyst"].includes(roleFamily);
  const templates = [
    {
      adviceId: "fb_target_role_positioning",
      title: `先让简历看起来像 ${roleName} 岗位`,
      mentorLens: `从内部筛选角度看，ATS 和 recruiter 第一眼会先判断：这份简历到底是不是在投 ${roleName}。如果 Summary 和前几条经历没有出现岗位原词，很容易被归到不相关方向。`,
      currentDiagnosis: isAccounting
        ? "你的简历目前有基础经历和教育背景，但和这份 JD 的岗位语言连接较弱。系统检测到 JD Match 和职位相关性都偏低，说明简历还没有稳定传达 Accounting 定位。"
        : `你的简历目前和目标 JD 的岗位语言匹配度较低，ATS 可能无法明确判断你在申请 ${roleName} 方向。`,
      action: isAccounting
        ? "先在 Summary 中自然加入 Accounting / Accountant 等目标岗位原词，并用一句话说明你与财务、报表、对账或审计支持相关的经验。"
        : `先在 Summary 中自然加入 ${targetRole === "unknown" ? roleName : targetRole} 等目标岗位原词，并用一句话说明你与该岗位核心职责相关的经验。`,
      reason: "这样做可以帮助 ATS 和 recruiter 更快识别你的投递方向，也能让后面的 Skills 和 Experience 看起来更有一致性。",
      evidence: ["JD Match 偏低", "F 职位相关性偏低", "缺少目标岗位原词"],
      // backward compat
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["missing_exact_job_title", "weak_summary_role_alignment", "weak_target_role_alignment"],
      targetSection: "summary",
      priority: "high",
      source: "fallback",
    },
    {
      adviceId: "fb_jd_keyword_alignment",
      title: isAccounting ? "补上 JD 中真实掌握的 Accounting 关键词" : "补上 JD 中真实掌握的岗位关键词",
      mentorLens: "ATS 做关键词匹配时，会扫全文搜索 JD 中的核心技能词。如果 Skills 区块缺少这些词，系统会把你的匹配分打低，recruiter 在关键词筛选时也会跳过你。",
      currentDiagnosis: "当前简历缺少目标岗位会搜索的核心硬技能和工具词，导致 JD Match 分数偏低。",
      action: `把你真实掌握的 ${roleName} 相关关键词补进 Skills，例如 ${keywordText}。`,
      reason: "把真实掌握的关键词补进 Skills，不仅能直接提升 ATS 匹配分，也能让 recruiter 快速确认你的技能范围与 JD 相符。",
      evidence: ["JD Match 偏低", "D 关键词维度偏低", "Skills 缺少 JD 核心词"],
      // backward compat
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["low_jd_keyword_match", "missing_priority_keywords", "low_hard_skill_match"],
      targetSection: "skills",
      priority: "high",
      source: "fallback",
    },
    {
      adviceId: "fb_experience_keyword_evidence",
      title: "把关键词写进经历证据",
      mentorLens: "即使 Skills 里有关键词，ATS 和 recruiter 还是会看 Experience 里有没有对应的证据。光靠 Skills 列词、缺乏经历支撑，很容易被认为是简历注水。",
      currentDiagnosis: "即使关键词出现在 Skills 区块，如果 Experience 中没有对应证据，ATS 和招聘方仍然难以判断你的真实匹配度。",
      action: `选择一段最相关经历，把 ${roleName} 关键词写进 bullet：${evidenceText}`,
      reason: "经历证据让关键词变得可信。把技能词嵌入到具体工作内容里，既提升 ATS 分，也让 recruiter 看到你真的做过相关工作。",
      evidence: ["Experience 缺少关键词证据", "关键词集中在 Skills 区块", "JD Match 偏低"],
      // backward compat
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["weak_experience_keyword_evidence", "keywords_only_in_skills", "resume_not_tailored_to_jd"],
      targetSection: "experience",
      priority: "high",
      source: "fallback",
    },
  ];
  const selected = [];
  for (const template of templates) {
    if (selected.length >= count) break;
    if (template.relatedProblemTags.some((tag) => !usedTags.has(tag))) {
      selected.push(template);
      template.relatedProblemTags.forEach((tag) => usedTags.add(tag));
    }
  }
  for (const template of templates) {
    if (selected.length >= count) break;
    if (!selected.some((item) => item.adviceId === template.adviceId)) selected.push(template);
  }
  return selected.slice(0, count);
}

function groupAdviceByMentor(candidates = []) {
  const buckets = new Map();
  for (const card of candidates) {
    const mentorName = card.mentorName || "Y导师";
    const key = mentorName;
    if (!buckets.has(key)) {
      const company = inferCompanyFromMentor(card);
      buckets.set(key, {
        mentorId: `mentor_${buckets.size + 1}_${normalizeTerm(mentorName || "mentor")}`,
        mentorName,
        company,
        companyLogo: resolveCompanyLogo(company),
        mentorTitle: inferMentorTitle(card),
        careerPathDisplay: card.mentor_career_path_display || null,
        badges: [],
        cards: [],
        roleFamilies: new Set(),
      });
    }
    const b = buckets.get(key);
    b.cards.push(card);
    splitCsv(card.roleFamily || card.role_family || "").filter(Boolean).forEach((rf) => b.roleFamilies.add(rf));
  }
  return [...buckets.values()].map((bucket) => {
    const sorted = bucket.cards.sort((a, b) => (b.retrieval_score || 0) - (a.retrieval_score || 0));
    return {
      ...bucket,
      badges: buildMentorBadges(sorted),
      cards: sorted,
      roleFamilies: [...bucket.roleFamilies],
    };
  });
}

function inferCompanyFromMentor(card = {}) {
  // Direct from DB (segments.mentor_company populated via mentors join in migration)
  if (card.mentor_company) return card.mentor_company;
  // Final fallback
  return "Amazon";
}

function inferMentorTitle(card = {}) {
  // Prefer actual title from DB
  if (card.mentor_title) return card.mentor_title;
  // Intent-based fallback
  if (card.adviceIntent === "resume_jd_keyword_fix") return "ATS / JD 关键词策略师";
  if (card.adviceIntent === "resume_section_rewrite") return "简历内容优化师";
  if (card.adviceIntent === "resume_content_quality") return "经历成果表达师";
  if (card.adviceIntent === "job_search_strategy") return "求职策略顾问";
  if (card.adviceIntent === "resume_positioning") return "岗位定位顾问";
  return "简历策略师";
}

function buildMentorBadges(cards = []) {
  const cardArr = Array.isArray(cards) ? cards : [cards];
  // Prefer career keywords pre-stored in DB
  const kwJson = cardArr.find((c) => c.mentor_career_keywords)?.mentor_career_keywords;
  if (kwJson) {
    try {
      const kws = JSON.parse(kwJson);
      if (Array.isArray(kws) && kws.length) return kws.slice(0, 3);
    } catch (_) {}
  }
  // Fallback: use L1 topic categories from cards
  const topics = [...new Set(cardArr.map((c) => c.L1 || c.topic).filter(Boolean))];
  if (topics.length) return topics.slice(0, 3);
  return ["简历优化", "ATS 策略"];
}

function coverageForAdvice(item = {}) {
  return new Set(item.relatedProblemTags || []);
}

function calculateAdviceCoverage(adviceItems = [], problemTags = []) {
  const target = new Set(problemTags.map((item) => item.tag || item).filter(Boolean));
  const covered = new Set();
  for (const item of adviceItems) {
    for (const tag of item.relatedProblemTags || []) {
      if (target.has(tag)) covered.add(tag);
    }
  }
  return covered;
}

function adviceSelectionScore(card, targetProblemTags, coveredTags, selectedCards = []) {
  const related = relatedTagsForCard(card, targetProblemTags);
  const uncovered = related.filter((tag) => !coveredTags.has(tag));

  const problemFitScore = getProblemFitScore(card, targetProblemTags);
  const actionabilityScore = getActionabilityScore(card);
  const specificityScore = getSpecificityScore(card);
  const transferabilityScore = getTransferabilityScore(card);
  const roleFitScore = Math.max(0, 1 - (card.roleMismatchPenalty || 0));
  const retrievalScore = card.retrieval_score || 0;

  // Bonus for covering new uncovered problems
  const uncoveredBonus = Math.min(1, uncovered.length / 2);
  // Topic diversity bonus
  const selectedTopics = new Set(selectedCards.map((c) => c._topicCluster || inferTopicCluster(c)));
  const thisCluster = card._topicCluster || inferTopicCluster(card);
  const topicDiversityBonus = selectedTopics.has(thisCluster) ? 0 : 0.12;

  return (
    0.35 * (problemFitScore * 0.6 + uncoveredBonus * 0.4) +
    0.20 * actionabilityScore +
    0.15 * specificityScore +
    0.15 * transferabilityScore +
    0.10 * roleFitScore +
    0.05 * retrievalScore +
    topicDiversityBonus
  );
}

function selectTopAdviceForMentor(mentorBucket, targetProblemTags, count, coveredTags = new Set(), internalAtsResult = {}) {
  const selected = [];
  const cards = [...(mentorBucket.cards || [])];
  const usedDiagnosisTags = new Set();
  while (selected.length < count && cards.length) {
    cards.sort((a, b) => adviceSelectionScore(b, targetProblemTags, coveredTags, selected) - adviceSelectionScore(a, targetProblemTags, coveredTags, selected));
    const card = cards.shift();
    const item = toAdviceItem(card, targetProblemTags, selected.length, true, internalAtsResult, usedDiagnosisTags);
    selected.push(item);
    item.relatedProblemTags.forEach((tag) => coveredTags.add(tag));
  }
  if (selected.length < count) {
    selected.push(...fallbackAdviceItems(internalAtsResult, count - selected.length, coveredTags));
  }
  return selected.slice(0, count);
}

function normalizeFreeAdviceLanes(adviceItems = [], internalAtsResult = {}) {
  // Prefer high-quality DB items; only fill gaps with fallback (not replace DB with fallback)
  const dbItems = adviceItems.filter((item) => item.source !== "fallback");
  if (dbItems.length >= 3) return dbItems.slice(0, 3);

  // Fill remaining slots with fallback without overriding existing DB items
  const usedTags = new Set(dbItems.flatMap((item) => item.relatedProblemTags || []));
  const extras = fallbackAdviceItems(internalAtsResult, 3 - dbItems.length, usedTags);
  return [...dbItems, ...extras].slice(0, 3);
}

const BIG_TECH_COMPANIES = new Set([
  "Google", "Amazon", "Meta", "Microsoft", "Apple", "NVIDIA", "OpenAI",
  "ByteDance", "TikTok", "Uber", "Airbnb", "LinkedIn", "Spotify", "Robinhood",
  "Goldman Sachs", "JPMorgan", "JPMorgan Chase", "Morgan Stanley", "BlackRock",
  "McKinsey", "BCG", "Deloitte", "Accenture",
]);

function mentorMatchScore(bucket, targetProblemTags, targetRoleFamily = "") {
  const cards = bucket.cards || [];
  if (!cards.length) return 0;

  // Top-k average card score (not sum — prevents large buckets winning by volume)
  const topK = Math.min(3, cards.length);
  const cardScores = cards.map((card) => adviceSelectionScore(card, targetProblemTags, new Set(), []));
  cardScores.sort((a, b) => b - a);
  const avgTopKScore = cardScores.slice(0, topK).reduce((s, v) => s + v, 0) / topK;

  // Weighted problem coverage (severity-aware)
  const covered = new Set();
  for (const card of cards) relatedTagsForCard(card, targetProblemTags).forEach((tag) => covered.add(tag));
  const totalSeverity = targetProblemTags.reduce((s, p) => s + severityWeight(p.severity || "medium"), 0) || 1;
  const coveredSeverity = targetProblemTags
    .filter((p) => covered.has(p.tag))
    .reduce((s, p) => s + severityWeight(p.severity || "medium"), 0);
  const weightedCoverage = coveredSeverity / totalSeverity;

  // Role fit: bonus not penalty — cross-domain is OK if coverage is high
  const bucketFamilies = bucket.roleFamilies || [];
  const normalized = normalizeTerm(targetRoleFamily || "");
  const roleFitScore = (bucketFamilies.includes("universal") || (normalized && bucketFamilies.includes(normalized))) ? 1.0 : 0.4;

  // Advice diversity: reward buckets with varied topic clusters
  const clusters = new Set(cards.map((c) => c._topicCluster || inferTopicCluster(c)));
  const diversityScore = Math.min(1, clusters.size / 3);

  return (
    0.35 * weightedCoverage +
    0.25 * avgTopKScore +
    0.20 * roleFitScore +
    0.10 * diversityScore +
    0.10 * qualityNormalized(cards[0]?.retrieval_score)
  );
}

function selectDiverseMentors(mentorBuckets, targetCount, targetProblemTags = [], targetRoleFamily = "") {
  const selected = [];
  const usedCompanies = new Set();
  const usedIntents = new Set();
  const sorted = [...mentorBuckets].sort((a, b) => mentorMatchScore(b, targetProblemTags, targetRoleFamily) - mentorMatchScore(a, targetProblemTags, targetRoleFamily));

  // Pass 1: prefer unique company + unique primary intent
  for (const bucket of sorted) {
    if (selected.length >= targetCount) break;
    const company = bucket.company || "unknown";
    const primaryIntent = bucket.cards[0]?.adviceIntent || "resume_ats";
    const companyConflict = usedCompanies.has(company) && company !== "Amazon";
    const intentConflict = usedIntents.has(primaryIntent) && selected.length < targetCount - 1;
    if (companyConflict || intentConflict) continue;
    selected.push(bucket);
    usedCompanies.add(company);
    usedIntents.add(primaryIntent);
  }

  // Pass 2: fill remaining slots ignoring company uniqueness, still avoid same intent
  for (const bucket of sorted) {
    if (selected.length >= targetCount) break;
    if (selected.includes(bucket)) continue;
    const primaryIntent = bucket.cards[0]?.adviceIntent || "resume_ats";
    if (usedIntents.has(primaryIntent)) continue;
    selected.push(bucket);
    usedIntents.add(primaryIntent);
  }

  // Pass 3: fill any remaining with best-scoring buckets not yet selected
  for (const bucket of sorted) {
    if (selected.length >= targetCount) break;
    if (!selected.includes(bucket)) selected.push(bucket);
  }

  return selected.slice(0, targetCount);
}

function mentorFromBucket(bucket, adviceItems, targetProblemTags, index) {
  const coveredTags = [...calculateAdviceCoverage(adviceItems, targetProblemTags)];
  return {
    mentorId: bucket.mentorId || `mentor_${index + 1}`,
    mentorName: bucket.mentorName || `${String.fromCharCode(89 - index)}导师`,
    company: bucket.company || "MentorX",
    companyLogo: bucket.companyLogo || null,
    mentorTitle: bucket.mentorTitle || "简历策略师",
    badges: bucket.badges || ["ATS 简历", "导师知识库"],
    careerPathDisplay: bucket.careerPathDisplay || null,
    matchReason: buildMatchReason(coveredTags),
    matchedProblems: coveredTags,
    adviceItems,
  };
}

function buildMatchReason(tags = []) {
  if (tags.some((tag) => /keyword|hard_skill|priority/.test(tag))) return "这位导师最匹配你当前的 JD 关键词和岗位匹配问题。";
  if (tags.some((tag) => /summary|title|role|position/.test(tag))) return "这位导师更擅长处理岗位定位和 Summary 表达问题。";
  if (tags.some((tag) => /experience|evidence|measurable|result/.test(tag))) return "这位导师能帮助你把经历证据写得更像目标岗位。";
  return "这位导师的建议与你当前 ATS 简历问题高度相关。";
}

function fallbackMentor(index, internalAtsResult, coveredTags = new Set()) {
  const adviceItems = fallbackAdviceItems(internalAtsResult, 3, coveredTags);
  return mentorFromBucket({
    ...DEFAULT_FREE_MENTOR_PROFILE,
    mentorId: index === 0 ? DEFAULT_FREE_MENTOR_PROFILE.mentorId : `fallback_mentor_${index + 1}`,
    mentorName: index === 0 ? DEFAULT_FREE_MENTOR_PROFILE.mentorName : `${String.fromCharCode(89 - index)} 导师`,
    mentorTitle: ["ATS / JD 关键词策略师", "简历内容优化师", "岗位定位顾问", "经历成果表达师"][index] || "简历策略师",
  }, adviceItems, problemTagsFromInternal(internalAtsResult), index);
}

function selectFreeMentorPlan(candidates, internalAtsResult) {
  const targetProblemTags = problemTagsFromInternal(internalAtsResult).slice(0, 6);
  const profile = internalAtsResult.profile || {};
  const roleFamily = profile.roleFamily || "";
  const userProfile = { roleFamily, problemTags: targetProblemTags };

  let roleSafeRejected = 0;
  // Step 1: filter eligible free candidates
  const eligibleCandidates = candidates.filter((card) =>
    (card.unlockTier === "free" || card.safeToShowFree) &&
    card.adviceIntent !== "application_timing" &&
    !["interview_prep", "behavioral_interview"].includes(card.adviceScope)
  ).filter((card) => {
    const safe = isAdviceRoleSafe(card, internalAtsResult.jobTitle || profile.targetRole, roleFamily);
    if (!safe) roleSafeRejected += 1;
    return safe;
  });

  // Annotate each candidate with transferability scope + topic cluster (cached to avoid recomputation)
  for (const card of eligibleCandidates) {
    card._transferabilityScope = card._transferabilityScope || inferAdviceTransferabilityScope(card);
    card._topicCluster = card._topicCluster || inferTopicCluster(card);
  }

  // Step 2: Issue-first — rank problems by severity, find best advice per problem
  const rankedProblems = [...targetProblemTags].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
  const selectedCards = [];
  const usedCardIds = new Set();
  const coveredTags = new Set();

  for (const problem of rankedProblems.slice(0, 3)) {
    if (selectedCards.length >= 3) break;
    const bestCard = eligibleCandidates
      .filter((card) => !usedCardIds.has(card.adviceId))
      .filter((card) => relatedTagsForCard(card, targetProblemTags).includes(problem.tag))
      .sort((a, b) => {
        const sa = getProblemFitScore(a, [problem]) * 0.5 + getActionabilityScore(a) * 0.3 + (1 - (a.roleMismatchPenalty || 0)) * 0.2;
        const sb = getProblemFitScore(b, [problem]) * 0.5 + getActionabilityScore(b) * 0.3 + (1 - (b.roleMismatchPenalty || 0)) * 0.2;
        return sb - sa;
      })[0];
    if (bestCard) {
      selectedCards.push(bestCard);
      usedCardIds.add(bestCard.adviceId);
      relatedTagsForCard(bestCard, targetProblemTags).forEach((t) => coveredTags.add(t));
    }
  }

  // Step 3: Fill remaining slots with diverse high-score candidates
  if (selectedCards.length < 3) {
    const remaining = eligibleCandidates
      .filter((card) => !usedCardIds.has(card.adviceId))
      .sort((a, b) => adviceSelectionScore(b, targetProblemTags, coveredTags, selectedCards) - adviceSelectionScore(a, targetProblemTags, coveredTags, selectedCards));
    for (const card of remaining) {
      if (selectedCards.length >= 3) break;
      selectedCards.push(card);
      usedCardIds.add(card.adviceId);
      relatedTagsForCard(card, targetProblemTags).forEach((t) => coveredTags.add(t));
    }
  }

  // Step 4: Convert to advice items
  const usedDiagnosisTags = new Set();
  let adviceItems = selectedCards.map((card, i) => {
    const item = toAdviceItem(card, targetProblemTags, i, true, internalAtsResult, usedDiagnosisTags);
    const meta = generateAdviceExplanationMetadata(card, userProfile);
    item.matchReason = meta.matchReason;
    item.mentorFitType = meta.mentorFitType;
    item.topicCluster = meta.topicCluster;
    item.confidenceScore = meta.confidenceScore;
    item.adviceTransferScope = meta.adviceTransferScope;
    return item;
  });

  adviceItems = normalizeFreeAdviceLanes(adviceItems, internalAtsResult);

  // Step 5: Choose displayed mentor — pick best bucket that covers most problems
  let plan;
  if (eligibleCandidates.length === 0 && selectedCards.length === 0) {
    plan = fallbackMentor(0, internalAtsResult);
  } else {
    const buckets = groupAdviceByMentor(eligibleCandidates.length > 0 ? eligibleCandidates : candidates);
    const roleSafeBuckets = buckets.filter((b) => isBucketRoleSafe(b, roleFamily));
    const candidateBuckets = roleSafeBuckets.length > 0 ? roleSafeBuckets : buckets;
    const bestBucket = selectDiverseMentors(candidateBuckets, 1, targetProblemTags, roleFamily)[0];

    const mergedBucket = bestBucket ? {
      ...DEFAULT_FREE_MENTOR_PROFILE,
      ...bestBucket,
      company: bestBucket.company || DEFAULT_FREE_MENTOR_PROFILE.company,
      companyLogo: bestBucket.companyLogo || null,
      mentorTitle: bestBucket.mentorTitle || DEFAULT_FREE_MENTOR_PROFILE.mentorTitle,
      careerPathDisplay: bestBucket.careerPathDisplay || null,
    } : { ...DEFAULT_FREE_MENTOR_PROFILE };

    plan = mentorFromBucket(mergedBucket, adviceItems, targetProblemTags, 0);
  }

  Object.defineProperty(plan, "debug", {
    enumerable: false,
    value: {
      roleSafeRejected,
      freeAdviceSources: (plan.adviceItems || []).map((item) => item.source || "db"),
      issueFirst: true,
      problemsRanked: rankedProblems.map((p) => p.tag),
    },
  });
  return plan;
}

function buildFreeMentorAdvicePlan({ candidates = [], internalAtsResult = {}, publicReport = null } = {}) {
  return selectFreeMentorPlan(candidates, internalAtsResult, publicReport);
}

function selectPremiumMentorPlan(candidates, internalAtsResult, freeMentorPlan = null) {
  const profile = internalAtsResult.profile || {};
  const targetProblemTags = problemTagsFromInternal(internalAtsResult);
  const roleFamily = profile.roleFamily || "";
  const userProfile = { roleFamily, problemTags: targetProblemTags };

  // Annotate candidates with scope + cluster
  for (const card of candidates) {
    card._transferabilityScope = card._transferabilityScope || inferAdviceTransferabilityScope(card);
    card._topicCluster = card._topicCluster || inferTopicCluster(card);
  }

  const eligibleCandidates = candidates.filter((card) =>
    !["interview_prep", "behavioral_interview"].includes(card.adviceScope) &&
    isAdviceRoleSafe(card, internalAtsResult.jobTitle || profile.targetRole, roleFamily)
  );

  const buckets = groupAdviceByMentor(eligibleCandidates);
  const roleSafeBuckets = buckets.filter((b) => isBucketRoleSafe(b, roleFamily));
  const candidateBuckets = roleSafeBuckets.length >= 4 ? roleSafeBuckets : roleSafeBuckets.length > 0 ? roleSafeBuckets : buckets;
  const selectedBuckets = selectDiverseMentors(candidateBuckets, 4, targetProblemTags, roleFamily);
  const coveredTags = new Set();
  // Track topic cluster usage across all 12 cards for diversity enforcement
  const clusterCounts = new Map();
  const CLUSTER_MAX = 2; // max cards per cluster (except critical problems)
  const criticalTags = new Set(targetProblemTags.filter((p) => p.severity === "critical" || p.severity === "high").map((p) => p.tag));
  const mentors = [];

  if (freeMentorPlan) {
    mentors.push(freeMentorPlan);
    freeMentorPlan.adviceItems.forEach((item) => {
      (item.relatedProblemTags || []).forEach((tag) => coveredTags.add(tag));
      const cluster = item.topicCluster || inferTopicCluster(item);
      clusterCounts.set(cluster, (clusterCounts.get(cluster) || 0) + 1);
    });
  }

  for (const bucket of selectedBuckets) {
    if (mentors.length >= 4) break;
    if (mentors.some((mentor) => mentor.mentorId === bucket.mentorId)) continue;

    // Select top advice for this mentor, enforcing cluster diversity
    const usedDiagnosisTags = new Set();
    const selectedItems = [];
    const bucketCards = [...(bucket.cards || [])].sort((a, b) =>
      adviceSelectionScore(b, targetProblemTags, coveredTags, selectedItems) - adviceSelectionScore(a, targetProblemTags, coveredTags, selectedItems)
    );

    for (const card of bucketCards) {
      if (selectedItems.length >= 3) break;
      const cluster = card._topicCluster || inferTopicCluster(card);
      const clusterCount = clusterCounts.get(cluster) || 0;
      const isCritical = (card.relatedProblemTags || []).some((t) => criticalTags.has(t));
      if (clusterCount >= CLUSTER_MAX && !isCritical) continue;

      const item = toAdviceItem(card, targetProblemTags, selectedItems.length, true, internalAtsResult, usedDiagnosisTags);
      const meta = generateAdviceExplanationMetadata(card, userProfile);
      item.matchReason = meta.matchReason;
      item.mentorFitType = meta.mentorFitType;
      item.topicCluster = meta.topicCluster;
      item.confidenceScore = meta.confidenceScore;
      item.adviceTransferScope = meta.adviceTransferScope;

      selectedItems.push(item);
      (item.relatedProblemTags || []).forEach((tag) => coveredTags.add(tag));
      clusterCounts.set(cluster, clusterCount + 1);
    }

    // Fill any remaining slots without cluster constraint
    if (selectedItems.length < 3) {
      const extras = selectTopAdviceForMentor(
        { ...bucket, cards: bucketCards.filter((c) => !selectedItems.some((i) => i.adviceId === c.adviceId)) },
        targetProblemTags, 3 - selectedItems.length, coveredTags, internalAtsResult
      );
      selectedItems.push(...extras);
    }

    const adviceItems = selectedItems.slice(0, 3);
    mentors.push(mentorFromBucket(bucket, adviceItems, targetProblemTags, mentors.length));
  }

  while (mentors.length < 4) {
    mentors.push(fallbackMentor(mentors.length, internalAtsResult, coveredTags));
  }

  // ── 補漏：確保所有 problem tags 至少被一條建議覆蓋 ──────────────
  const allAdviceItems = mentors.flatMap((m) => m.adviceItems || []);
  const allCovered = calculateAdviceCoverage(allAdviceItems, targetProblemTags);
  const uncoveredTags = targetProblemTags.filter((p) => !allCovered.has(p.tag));

  if (uncoveredTags.length > 0) {
    // 找出還有空間的導師（adviceItems < 3 的不存在，所以替換最低分那條）
    // 策略：在每個導師的 candidates 池裡找能覆蓋 uncoveredTags 的建議，替換得分最低的
    for (const problem of uncoveredTags) {
      const tag = problem.tag;
      if (allCovered.has(tag)) continue;
      // 找能覆蓋這個 tag 的候選
      const coverCandidate = candidates
        .filter((card) => !allAdviceItems.some((a) => a.adviceId === card.adviceId))
        .find((card) => relatedTagsForCard(card, targetProblemTags).includes(tag));
      if (!coverCandidate) continue;
      // 找最合適的導師（優先選和這個 card 同一個 mentorName 的，或最後一個導師）
      const targetMentor = mentors.find((m) => m.mentorName === coverCandidate.mentorName) || mentors[mentors.length - 1];
      if (!targetMentor || !targetMentor.adviceItems) continue;
      // 把這個 mentor 的最低優先級建議換掉
      const toReplace = targetMentor.adviceItems.reduce((a, b) =>
        (severityWeight(a.priority) < severityWeight(b.priority) ? a : b)
      );
      const newItem = toAdviceItem(coverCandidate, targetProblemTags, targetMentor.adviceItems.indexOf(toReplace), true, internalAtsResult, new Set());
      const idx = targetMentor.adviceItems.indexOf(toReplace);
      if (idx !== -1) targetMentor.adviceItems[idx] = newItem;
      allCovered.add(tag);
    }
  }

  return mentors.slice(0, 4).map((mentor) => ({
    ...mentor,
    adviceItems: mentor.adviceItems.slice(0, 3),
  }));
}

function buildCoverageSummary(selectedAdviceItems, internalAtsResult) {
  const problems = problemTagsFromInternal(internalAtsResult);
  const target = problems.map((item) => item.tag);
  const covered = [...calculateAdviceCoverage(selectedAdviceItems, problems)];
  const uncovered = target.filter((tag) => !covered.includes(tag));
  return {
    totalProblemsDetected: target.length,
    problemsCovered: covered.length,
    coverageRatio: target.length ? Number((covered.length / target.length).toFixed(3)) : 1,
    coveredProblemTags: covered,
    uncoveredProblemTags: uncovered,
  };
}

function buildLockedAdvicePreview(premiumMentorPlan = [], internalAtsResult = {}) {
  const totalMentorCount = 4;
  const totalAdviceCount = 12;
  const roleFamily = normalizeTerm(internalAtsResult.profile?.roleFamily || internalAtsResult.jobTitle || "");
  const topics = roleFamily === "accounting" || roleFamily === "finance"
    ? ["Accounting 关键词补充位置", "Summary 岗位定位强化", "Experience bullet 优化", "岗位匹配与投递策略"]
    : roleFamily === "software_engineer"
      ? ["技术关键词补充位置", "Summary 工程定位强化", "Experience bullet 优化", "项目与系统设计表达"]
      : ["关键词补充位置", "Summary 定位强化", "Experience bullet 优化", "岗位匹配策略"];

  const lockedMentors = (premiumMentorPlan.slice(1, 4) || []).map((mentor) => {
    // Derive generic topic labels without leaking specific advice titles
    const items = mentor.adviceItems || [];
    const previewTopics = [...new Set(
      items.slice(0, 3).map((item) => {
        const sec = item.targetSection || "";
        const tags = item.relatedProblemTags || [];
        if (/keyword|jd|ats/i.test(sec) || tags.some((t) => /keyword|jd|hard_skill/.test(t))) return "关键词策略";
        if (/summary|headline/i.test(sec) || tags.some((t) => /summary|title|role/.test(t))) return "Summary 定位";
        if (/experience|bullet/i.test(sec) || tags.some((t) => /experience|evidence/.test(t))) return "经历描述优化";
        if (/skill/i.test(sec)) return "技能区块";
        if (/education/i.test(sec)) return "教育背景";
        return "岗位匹配策略";
      })
    )].slice(0, 3);
    return {
      mentorId: mentor.mentorId,
      mentorName: mentor.mentorName,
      company: mentor.company,
      companyLogo: mentor.companyLogo || null,
      mentorTitle: mentor.mentorTitle,
      careerPathDisplay: mentor.careerPathDisplay || null,
      lockedAdviceCount: items.length,
      previewTopics,
    };
  });

  return {
    lockedMentorCount: Math.max(0, totalMentorCount - 1),
    lockedAdviceCount: Math.max(0, totalAdviceCount - 3),
    totalMentorCount,
    totalAdviceCount,
    topics,
    lockedMentors,
    message: "解锁后查看 4 位导师的 12 条完整建议，覆盖你的主要 ATS 问题与分段修改路径。",
  };
}

/**
 * Build public-safe evidence chips for a single advice item.
 * Returns max 3 qualitative descriptors — no raw scores or internal metric values.
 *
 * @param {object} adviceItem  - The advice item (new schema)
 * @param {object|null} publicReport - The public ATS report (unused for now; reserved)
 * @param {object} internalAtsResult - Internal ATS result (used only for tag presence, not values)
 */
function buildAdviceEvidence(adviceItem, publicReport, internalAtsResult = {}) {
  // If the item already carries explicit evidence chips, honour them
  if (Array.isArray(adviceItem.evidence) && adviceItem.evidence.length) {
    return adviceItem.evidence.slice(0, 3);
  }
  const tags = adviceItem.relatedProblemTags || [];
  const chips = [];
  if (tags.some((t) => /job_title|exact_title/.test(t))) chips.push("缺少目标岗位原词");
  if (tags.some((t) => /jd_keyword|hard_skill|keyword_gap|priority_keyword/.test(t))) chips.push("JD Match 偏低");
  if (tags.some((t) => /experience_keyword|skills_only|evidence/.test(t))) chips.push("Experience 缺少关键词证据");
  if (tags.some((t) => /summary|role_alignment|target_role/.test(t))) chips.push("Summary 岗位定位不清晰");
  if (tags.some((t) => /measurable|result|impact/.test(t))) chips.push("Bullet 量化结果不足");
  if (tags.some((t) => /linkedin/.test(t))) chips.push("LinkedIn 链接缺失");
  if (tags.some((t) => /portfolio/.test(t))) chips.push("Portfolio 链接缺失");
  return chips.slice(0, 3);
}

/** @deprecated Use buildAdviceEvidence instead */
function buildPublicSafeEvidence(item, atsResult = {}) {
  return buildAdviceEvidence(item, null, atsResult);
}

function formatPublicFreeMentorAdvice(freeMentorPlan, internalAtsResult = {}) {
  return {
    mentorId: freeMentorPlan.mentorId,
    mentorName: freeMentorPlan.mentorName,
    company: freeMentorPlan.company,
    companyLogo: freeMentorPlan.companyLogo || null,
    mentorTitle: freeMentorPlan.mentorTitle,
    careerPathDisplay: freeMentorPlan.careerPathDisplay || null,
    badges: freeMentorPlan.badges || [],
    matchReason: freeMentorPlan.matchReason,
    matchedProblems: freeMentorPlan.matchedProblems || [],
    adviceItems: (freeMentorPlan.adviceItems || []).slice(0, 3).map((item) => {
      // Resolve canonical new-schema fields, supporting both native and adapted cards
      const currentDiagnosis = item.currentDiagnosis || item.problemSummary || "";
      const action = item.action || item.actionSummary || "";
      return {
        adviceId: item.adviceId,
        title: item.title,
        // ── New schema fields ──
        mentorLens: item.mentorLens || "",
        currentDiagnosis,
        action,
        reason: item.reason || "",
        evidence: buildAdviceEvidence(item, null, internalAtsResult),
        // ── Explanation metadata (issue-first) ──
        matchReason: item.matchReason || "",
        mentorFitType: item.mentorFitType || "",
        topicCluster: item.topicCluster || inferTopicCluster(item),
        confidenceScore: item.confidenceScore || null,
        adviceTransferScope: item.adviceTransferScope || "",
        // ── Backward-compat aliases ──
        problemSummary: currentDiagnosis,
        actionSummary: action,
        targetSection: item.targetSection || "overall",
        relatedProblemTags: item.relatedProblemTags || [],
        priority: item.priority || "medium",
        // Rich mentor voice fields
        mentorInsight: item.mentorInsight || item.I_insight || "",
        example: item.example || item.E_example || "",
        hrPerspective: item.hrPerspective || item.HR_os || "",
        source: item.source || "db",
      };
    }),
  };
}

function formatPremiumMentorReport(premiumMentorPlan, internalAtsResult) {
  const mentors = premiumMentorPlan.slice(0, 4).map((mentor) => ({
    ...mentor,
    adviceItems: (mentor.adviceItems || []).slice(0, 3).map((item) => {
      const currentDiagnosis = item.currentDiagnosis || item.problemSummary || "";
      const action = item.action || item.actionSummary || "";
      return {
        adviceId: item.adviceId,
        title: item.title,
        // New schema fields
        mentorLens: item.mentorLens || "",
        currentDiagnosis,
        action,
        reason: item.reason || "",
        evidence: buildAdviceEvidence(item, null, internalAtsResult),
        // Explanation metadata
        matchReason: item.matchReason || "",
        mentorFitType: item.mentorFitType || "",
        topicCluster: item.topicCluster || inferTopicCluster(item),
        confidenceScore: item.confidenceScore || null,
        adviceTransferScope: item.adviceTransferScope || "",
        // Backward compat
        problemSummary: currentDiagnosis,
        actionSummary: action,
        // Paid-only premium fields
        mentorInsight: item.mentorInsight || "",
        example: item.example || "",
        hrPerspective: item.hrPerspective || "",
        targetSection: item.targetSection || "overall",
        relatedProblemTags: item.relatedProblemTags || [],
        priority: item.priority || "medium",
        source: item.source,
      };
    }),
  }));
  const allAdviceItems = mentors.flatMap((mentor) => mentor.adviceItems);
  return {
    mentors,
    coverageSummary: buildCoverageSummary(allAdviceItems, internalAtsResult),
  };
}

module.exports = {
  FALLBACK_FREE_ADVICE,
  ACCOUNTING_FALLBACK_FREE_ADVICE,
  splitCsv,
  overlapScore,
  includesAny,
  normalizeTerm,
  inferRoleFamilyFromJobTitle,
  inferAdviceScope,
  inferAdviceIntent,
  inferAdviceTransferabilityScope,
  inferTopicCluster,
  inferMentorFitType,
  generateAdviceExplanationMetadata,
  getActionabilityScore,
  getSpecificityScore,
  getTransferabilityScore,
  getProblemFitScore,
  ROLE_SENSITIVITY_BY_PROBLEM_TAG,
  isEligibleForAtsResumeReport,
  isAdviceRoleSafe,
  hasConflictingRoleExamples,
  calculateRoleMismatchPenalty,
  calculateRetrievalScore,
  buildMatchedReasons,
  retrieveStrictCandidates,
  retrieveFallbackCandidates,
  retrieveMentorAdvice,
  selectFreeAdvice,
  selectPaidAdvice,
  cleanAndTruncate,
  groupAdviceByMentor,
  buildFreeMentorAdvicePlan,
  selectFreeMentorPlan,
  selectPremiumMentorPlan,
  calculateAdviceCoverage,
  selectDiverseMentors,
  selectTopAdviceForMentor,
  buildCoverageSummary,
  buildLockedAdvicePreview,
  buildAdviceEvidence,
  buildPublicSafeEvidence,
  formatPublicFreeMentorAdvice,
  formatPremiumMentorReport,
  formatAdviceCard,
  formatAdviceCardForPublic,
  truncateAtSentence,
};
