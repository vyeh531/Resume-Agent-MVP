"use strict";

const db = require("../database");

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

function cleanAndTruncate(value, maxLength = 140, fallback = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const sentenceEnd = Math.max(
    slice.lastIndexOf("。"), slice.lastIndexOf("."), slice.lastIndexOf("！"),
    slice.lastIndexOf("!"), slice.lastIndexOf("？"), slice.lastIndexOf("?")
  );
  if (sentenceEnd >= 24) return slice.slice(0, sentenceEnd + 1).trim();
  const commaEnd = Math.max(slice.lastIndexOf("，"), slice.lastIndexOf(","), slice.lastIndexOf("；"), slice.lastIndexOf(";"));
  let cut = commaEnd >= 24 ? slice.slice(0, commaEnd).trim() : slice.trim();
  cut = cut.replace(/[\s([{（【《"'“‘,:;，；、]+$/u, "").trim();
  const lastSpace = cut.lastIndexOf(" ");
  if (/^[\x00-\x7F]+$/.test(cut) && lastSpace > Math.floor(maxLength * 0.55)) {
    cut = cut.slice(0, lastSpace).trim();
  }
  if (!cut || /如\s*[a-z]?$/i.test(cut) || /[(（【《]$/.test(cut)) {
    return fallback || `${text.slice(0, Math.max(1, maxLength - 3)).trim()}...`;
  }
  return `${cut}...`;
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
    actionSummary: cleanAndTruncate(roleSafeActionSummary(row, retrievalQuery), 220),
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
  };
}

function formatAdviceCard(row) {
  return formatAdviceCardForPublic(row, {});
}

function baseSelectSql(where) {
  return `
    SELECT
      id, chunk_id, topic, L1, L2, P_mentor, A_action, I_insight, H_hook, E_example, HR_os,
      advice_type, mentor_name, role_family, target_roles, seniority, ats_dimensions,
      problem_tags, keywords, topic_slug, retrieval_text, priority, unlock_tier,
      advice_card_title, user_problem_summary, action_summary, safe_to_show_free,
      requires_ai_rewrite, mentor_quality_score, feedback_score,
      mentor_title, mentor_career_keywords
    FROM segments
    WHERE ${where}
    LIMIT 500
  `;
}

function likeClauseForTerms(columns, terms) {
  const clauses = [];
  const params = [];
  for (const term of [...new Set(terms)].filter(Boolean).slice(0, 30)) {
    const like = `%${term.replace(/_/g, "%")}%`;
    clauses.push(`(${columns.map((column) => `LOWER(COALESCE(${column},'')) LIKE ?`).join(" OR ")})`);
    params.push(...columns.map(() => like));
  }
  return { clause: clauses.length ? clauses.join(" OR ") : "1 = 0", params };
}

function queryRows(database, where, params, retrievalQuery) {
  return database.prepare(baseSelectSql(where)).all(...params)
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

function retrieveStrictCandidates(retrievalQuery = {}, options = {}) {
  const database = options.db || db.getDB();
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
  const rows = queryRows(database, clause, params, retrievalQuery)
    .filter(hasStrictSignal)
    .filter((card) => !card.matched_reasons.includes("conflicting_role_examples"))
    .filter((card) => card.roleMismatchPenalty < 0.35);
  return rankCandidates(rows, options.limit || 80);
}

function retrieveFallbackCandidates(retrievalQuery = {}, options = {}) {
  const database = options.db || db.getDB();
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
  const rows = queryRows(database, clause, params, retrievalQuery)
    .filter(isGenericUniversalResumeAdvice)
    .filter((card) => !card.matched_reasons.includes("conflicting_role_examples"));
  return rankCandidates(rows, options.limit || 80);
}

function retrieveMentorAdvice(retrievalQuery = {}, options = {}) {
  const limit = options.limit || 80;
  const database = options.db || db.getDB();
  const rawRows = database.prepare("SELECT COUNT(*) AS count FROM segments").get().count;
  const eligibleRows = database.prepare(baseSelectSql("1 = 1")).all().filter(isEligibleForAtsResumeReport);
  const excludedInterviewAdvice = database.prepare(baseSelectSql("1 = 1")).all()
    .filter((row) => ["interview_prep", "behavioral_interview"].includes(inferAdviceScope(row))).length;
  const strictCandidates = retrieveStrictCandidates(retrievalQuery, { ...options, db: database, limit });
  const fallbackCandidates = retrieveFallbackCandidates(retrievalQuery, { ...options, db: database, limit });
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

function toAdviceItem(card = {}, targetProblemTags = [], index = 0, includePremiumFields = false) {
  const relatedProblemTags = card.relatedProblemTags || relatedTagsForCard(card, targetProblemTags);
  const item = {
    adviceId: card.adviceId || `fallback_${index}`,
    title: cleanAndTruncate(card.title || "优化简历与目标岗位的匹配度", 80, "优化简历与目标岗位的匹配度"),
    problemSummary: cleanAndTruncate(card.problemSummary || "当前简历与目标岗位的匹配信号还不够集中。", 180, "当前简历与目标岗位的匹配信号还不够集中。"),
    actionSummary: cleanAndTruncate(card.actionSummary || "优先把目标岗位关键词、相关技能和经历证据放到 Summary、Skills 和 Experience 中。", 220, "优先把目标岗位关键词、相关技能和经历证据放到 Summary、Skills 和 Experience 中。"),
    targetSection: card.targetSection || targetSectionFromCard(card),
    relatedProblemTags,
    priority: card.priority || priorityFromTags(relatedProblemTags, targetProblemTags),
    source: card.source,
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
  const isAccounting = ["accounting", "finance"].includes(roleFamily);
  const isSoftware = roleFamily === "software_engineer";
  const isDataAnalyst = roleFamily === "data_analyst";
  const roleName = isAccounting ? "Accounting" : isSoftware ? "Software Engineer" : isDataAnalyst ? "Data Analyst" : "目标岗位";
  const keywordText = isAccounting
    ? "financial reporting、reconciliation、Excel、QuickBooks、GAAP、accounts payable、accounts receivable、audit support 或 month-end close"
    : isSoftware
      ? "distributed systems、microservices、APIs、code review、testing、CI/CD、AWS、TypeScript、Java、Python 或 system design"
      : isDataAnalyst
        ? "SQL、dashboards、Excel、Tableau、Power BI、data cleaning、KPI reporting 或 business insights"
        : "target role keywords、JD responsibilities、role-specific tools 和真实掌握的岗位技能";
  const evidenceText = isAccounting
    ? "说明你处理了什么数据、报表、对账、发票或流程，并尽量补充数量、频率或结果。"
    : isSoftware
      ? "说明你设计或实现了什么服务、API、测试、CI/CD 或系统模块，并补充规模、性能或可靠性结果。"
      : isDataAnalyst
        ? "说明你清洗了什么数据、搭建了什么 dashboard、追踪了什么 KPI，并补充业务洞察或结果。"
        : "说明你承担了什么职责、使用了什么工具、产出了什么结果，并尽量补充数量、频率或影响。";
  const templates = [
    {
      adviceId: "fb_target_role_positioning",
      title: `先让简历看起来像 ${roleName} 岗位`,
      problemSummary: `你的简历目前和目标 JD 的岗位语言匹配度较低，ATS 可能无法明确判断你在申请 ${roleName} 方向。`,
      actionSummary: isAccounting
        ? "先在 Summary 中自然加入 Accounting / Accountant 等目标岗位原词，并用一句话说明你与财务、报表、对账或审计支持相关的经验。"
        : `先在 Summary 中自然加入 ${targetRole === "unknown" ? roleName : targetRole} 等目标岗位原词，并用一句话说明你与该岗位核心职责相关的经验。`,
      relatedProblemTags: ["missing_exact_job_title", "weak_summary_role_alignment", "weak_target_role_alignment"],
      targetSection: "summary",
      priority: "high",
      source: "fallback",
    },
    {
      adviceId: "fb_jd_keyword_alignment",
      title: isAccounting ? "补上 JD 中真实掌握的 Accounting 关键词" : "补上 JD 中真实掌握的岗位关键词",
      problemSummary: "当前简历缺少目标岗位会搜索的核心硬技能和工具词，导致 JD Match 分数偏低。",
      actionSummary: `把你真实掌握的 ${roleName} 相关关键词补进 Skills，例如 ${keywordText}。`,
      relatedProblemTags: ["low_jd_keyword_match", "missing_priority_keywords", "low_hard_skill_match"],
      targetSection: "skills",
      priority: "high",
      source: "fallback",
    },
    {
      adviceId: "fb_experience_keyword_evidence",
      title: "把关键词写进经历证据",
      problemSummary: "即使关键词出现在 Skills 区块，如果 Experience 中没有对应证据，ATS 和招聘方仍然难以判断你的真实匹配度。",
      actionSummary: `选择一段最相关经历，把 ${roleName} 关键词写进 bullet：${evidenceText}`,
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
        badges: [],
        cards: [],
      });
    }
    buckets.get(key).cards.push(card);
  }
  return [...buckets.values()].map((bucket) => {
    const sorted = bucket.cards.sort((a, b) => (b.retrieval_score || 0) - (a.retrieval_score || 0));
    return {
      ...bucket,
      badges: buildMentorBadges(sorted),
      cards: sorted,
    };
  });
}

function inferCompanyFromMentor(card = {}) {
  const text = `${card.mentorName || ""} ${card.title || ""} ${card.topic || ""} ${card.company || ""}`;
  const companies = [
    // Big Tech
    "Google", "Amazon", "Meta", "Microsoft", "Apple", "NVIDIA", "Intel",
    "Qualcomm", "Cisco", "IBM", "Oracle", "Salesforce", "Adobe", "Intuit",
    "Snowflake", "Spotify", "Uber", "Robinhood", "OpenAI", "ByteDance", "TikTok",
    // Finance
    "Goldman Sachs", "JPMorgan Chase", "JPMorgan", "Morgan Stanley", "BlackRock",
    "Capital One", "Bank of America", "Citigroup", "American Express",
    "McKinsey", "BCG", "Deloitte", "KPMG", "EY", "PwC", "Accenture",
    // Semiconductor
    "Applied Materials", "Lam Research", "Marvell", "TSMC", "Texas Instruments",
    // Healthcare
    "Johnson & Johnson", "Merck", "Bristol Myers Squibb", "Amgen", "Biogen", "Moderna",
    // Auto
    "Tesla", "Ford", "General Motors",
  ];
  return companies.find((company) => text.toLowerCase().includes(company.toLowerCase())) || "Amazon";
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
  const severity = targetProblemTags
    .filter((item) => uncovered.includes(item.tag))
    .reduce((sum, item) => sum + severityWeight(item.severity), 0);
  const roleFitScore = Math.max(0, 1 - (card.roleMismatchPenalty || 0));
  const diversityBonus = selectedCards.some((item) => item.topic === card.topic || item.adviceIntent === card.adviceIntent) ? 0 : 1;
  return (
    0.35 * (card.retrieval_score || 0) +
    0.25 * Math.min(1, uncovered.length / 2) +
    0.15 * Math.min(1, severity) +
    0.10 * roleFitScore +
    0.10 * 0.6 +
    0.05 * diversityBonus
  );
}

function selectTopAdviceForMentor(mentorBucket, targetProblemTags, count, coveredTags = new Set(), internalAtsResult = {}) {
  const selected = [];
  const cards = [...(mentorBucket.cards || [])];
  while (selected.length < count && cards.length) {
    cards.sort((a, b) => adviceSelectionScore(b, targetProblemTags, coveredTags, selected) - adviceSelectionScore(a, targetProblemTags, coveredTags, selected));
    const card = cards.shift();
    const item = toAdviceItem(card, targetProblemTags, selected.length, true);
    selected.push(item);
    item.relatedProblemTags.forEach((tag) => coveredTags.add(tag));
  }
  if (selected.length < count) {
    selected.push(...fallbackAdviceItems(internalAtsResult, count - selected.length, coveredTags));
  }
  return selected.slice(0, count);
}

function normalizeFreeAdviceLanes(adviceItems = [], internalAtsResult = {}) {
  const lanes = ["summary", "skills", "experience"];
  const roleFamily = normalizeTerm(internalAtsResult.profile?.roleFamily || "");
  if (roleFamily === "accounting" || roleFamily === "finance") {
    return fallbackAdviceItems(internalAtsResult, 3, new Set());
  }
  const usedIds = new Set();
  const fallbackBySection = new Map(
    fallbackAdviceItems(internalAtsResult, 3, new Set()).map((item) => [item.targetSection, item])
  );
  return lanes.map((section, index) => {
    const dbItem = adviceItems.find((item) =>
      item?.targetSection === section &&
      item.source !== "fallback" &&
      !usedIds.has(item.adviceId)
    );
    if (dbItem) {
      usedIds.add(dbItem.adviceId);
      return dbItem;
    }
    const fallback = fallbackBySection.get(section) || fallbackAdviceItems(internalAtsResult, 3, new Set())[index];
    return { ...fallback };
  });
}

function mentorMatchScore(bucket, targetProblemTags) {
  const covered = new Set();
  let score = 0;
  for (const card of bucket.cards || []) {
    score += card.retrieval_score || 0;
    relatedTagsForCard(card, targetProblemTags).forEach((tag) => covered.add(tag));
  }
  return score + covered.size * 0.35;
}

function selectDiverseMentors(mentorBuckets, targetCount, targetProblemTags = []) {
  const selected = [];
  const usedIntents = new Set();
  const sorted = [...mentorBuckets].sort((a, b) => mentorMatchScore(b, targetProblemTags) - mentorMatchScore(a, targetProblemTags));
  for (const bucket of sorted) {
    if (selected.length >= targetCount) break;
    const primaryIntent = bucket.cards[0]?.adviceIntent || "resume_ats";
    if (usedIntents.has(primaryIntent) && selected.length < targetCount - 1) continue;
    selected.push(bucket);
    usedIntents.add(primaryIntent);
  }
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
  let roleSafeRejected = 0;
  const freeCandidates = candidates.filter((card) =>
    (card.unlockTier === "free" || card.safeToShowFree) &&
    card.adviceIntent !== "application_timing" &&
    !["interview_prep", "behavioral_interview"].includes(card.adviceScope)
  ).filter((card) => {
    const safe = isAdviceRoleSafe(card, internalAtsResult.jobTitle || profile.targetRole, profile.roleFamily);
    if (!safe) roleSafeRejected += 1;
    return safe;
  });
  const buckets = groupAdviceByMentor(freeCandidates);
  const bucket = selectDiverseMentors(buckets, 1, targetProblemTags)[0];
  let plan;
  if (!bucket) {
    plan = fallbackMentor(0, internalAtsResult);
  } else {
    const coveredTags = new Set();
    const adviceItems = selectTopAdviceForMentor(bucket, targetProblemTags, 3, coveredTags, internalAtsResult);
    plan = mentorFromBucket({ ...DEFAULT_FREE_MENTOR_PROFILE, cards: bucket.cards }, normalizeFreeAdviceLanes(adviceItems, internalAtsResult), targetProblemTags, 0);
  }
  Object.defineProperty(plan, "debug", {
    enumerable: false,
    value: {
      roleSafeRejected,
      freeAdviceSources: (plan.adviceItems || []).map((item) => item.source || "db"),
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
  const buckets = groupAdviceByMentor(candidates.filter((card) =>
    !["interview_prep", "behavioral_interview"].includes(card.adviceScope) &&
    isAdviceRoleSafe(card, internalAtsResult.jobTitle || profile.targetRole, profile.roleFamily)
  ));
  const selectedBuckets = selectDiverseMentors(buckets, 4, targetProblemTags);
  const coveredTags = new Set();
  const mentors = [];

  if (freeMentorPlan) {
    mentors.push(freeMentorPlan);
    freeMentorPlan.adviceItems.forEach((item) => (item.relatedProblemTags || []).forEach((tag) => coveredTags.add(tag)));
  }

  for (const bucket of selectedBuckets) {
    if (mentors.length >= 4) break;
    if (mentors.some((mentor) => mentor.mentorId === bucket.mentorId)) continue;
    const adviceItems = selectTopAdviceForMentor(bucket, targetProblemTags, 3, coveredTags, internalAtsResult);
    mentors.push(mentorFromBucket(bucket, adviceItems, targetProblemTags, mentors.length));
  }

  while (mentors.length < 4) {
    mentors.push(fallbackMentor(mentors.length, internalAtsResult, coveredTags));
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

  const lockedMentors = (premiumMentorPlan.slice(1, 4) || []).map((mentor) => ({
    mentorId: mentor.mentorId,
    mentorName: mentor.mentorName,
    company: mentor.company,
    companyLogo: mentor.companyLogo || null,
    mentorTitle: mentor.mentorTitle,
    badges: mentor.badges || [],
    adviceHint: (mentor.adviceItems || []).slice(0, 3).map((item) => ({
      title: item.title || "",
      targetSection: item.targetSection || "overall",
    })),
  }));

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

function formatPublicFreeMentorAdvice(freeMentorPlan) {
  return {
    mentorId: freeMentorPlan.mentorId,
    mentorName: freeMentorPlan.mentorName,
    company: freeMentorPlan.company,
    companyLogo: freeMentorPlan.companyLogo || null,
    mentorTitle: freeMentorPlan.mentorTitle,
    badges: freeMentorPlan.badges || [],
    matchReason: freeMentorPlan.matchReason,
    matchedProblems: freeMentorPlan.matchedProblems || [],
    adviceItems: (freeMentorPlan.adviceItems || []).slice(0, 3).map((item) => ({
      adviceId: item.adviceId,
      title: item.title,
      problemSummary: item.problemSummary,
      actionSummary: item.actionSummary,
      evidence: item.evidence || [],
      targetSection: item.targetSection || "overall",
      relatedProblemTags: item.relatedProblemTags || [],
      priority: item.priority || "medium",
      source: item.source || "db",
    })),
  };
}

function formatPremiumMentorReport(premiumMentorPlan, internalAtsResult) {
  const mentors = premiumMentorPlan.slice(0, 4).map((mentor) => ({
    ...mentor,
    adviceItems: (mentor.adviceItems || []).slice(0, 3).map((item) => ({
      adviceId: item.adviceId,
      title: item.title,
      problemSummary: item.problemSummary,
      actionSummary: item.actionSummary,
      mentorInsight: item.mentorInsight || "",
      example: item.example || "",
      hrPerspective: item.hrPerspective || "",
      targetSection: item.targetSection || "overall",
      relatedProblemTags: item.relatedProblemTags || [],
      priority: item.priority || "medium",
      source: item.source,
    })),
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
  formatPublicFreeMentorAdvice,
  formatPremiumMentorReport,
  formatAdviceCard,
  formatAdviceCardForPublic,
  truncateAtSentence,
};
