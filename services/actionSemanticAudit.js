"use strict";

const actionGovernance = require("./actionGovernance");

const DOMAIN_PATTERNS = [
  /\b(hardware|electrical|circuit|analog|pcb|fpga|rtl|verilog|vlsi|semiconductor|embedded|firmware|tape out|bring up|adc|bom)\b/i,
  /\b(medical device|medical equipment|biomedical device|clinical trial|patient|medical chart|medical record|hospital|pharma|biotech|cro)\b/i,
  /\b(data analyst|data analytics|machine learning|deep learning|tensorflow|pytorch|llm|rag|nlp|computer vision|tableau|power bi|sql|pandas)\b/i,
  /\b(quant|trading|risk consulting|rcsa|valuation|dcf|fp&a|fpa|bloomberg|pitchbook|series 7|series 66)\b/i,
  /\b(game design|game mechanics|level design|player experience|ux|ui|figma|portfolio|storyboard|animation|demo reel)\b/i,
  /硬件|硬體|电路|電路|医疗器械|醫療器械|临床|臨床|患者|病患|数据分析|資料分析|机器学习|機器學習|量化|投研|风控|風控|作品集|游戏|遊戲/i,
];

const CASE_PATTERNS = [
  /\b(Alpha Research|VADER|MACD|COVID patient|Superseed|Broadcom|Doordash|Instacart|Google|Meta|IBM|Moot Court|Legal Clinic)\b/i,
  /\b[A-Z][A-Za-z0-9&/.-]{2,}\s+(?:project|pipeline|internship|case|model|dashboard|experience)\b/,
  /你这(?:段|条|个)|你这里|这段(?:实习|项目)|这条(?:项目|bullet)|医院实习|咖啡因项目|学校.*项目|课程项目|某学校|当时|原简历/i,
];

const COMPANY_OR_SCHOOL_PATTERNS = [
  /\b(Google|Meta|Amazon|Microsoft|Apple|NVIDIA|OpenAI|ByteDance|TikTok|Uber|Airbnb|LinkedIn|Goldman Sachs|JPMorgan|Morgan Stanley|BlackRock|McKinsey|BCG|Deloitte|Accenture|Broadcom|Doordash|Instacart|Roblox|Yelp)\b/i,
  /\b[A-Z][A-Za-z&.-]+\s+(?:University|College|School|Institute|Hospital|Clinic)\b/,
  /大学|大學|学院|學院|学校|學校|医院|醫院|公司|实习公司|實習公司/i,
];

const PRECONDITION_PATTERNS = [
  ["section_order", /重排|顺序|順序|放到前面|放在前面|移到|移至|education.*(?:后|last)|skills?.*(?:second|before|front)|section order|reorder/i],
  ["delete_section", /删除|删掉|刪除|移除|remove|delete.*(?:interests|activities|gpa|coursework|skills?)/i],
  ["gpa_condition", /\bGPA\b|绩点|績點/i],
  ["profile_link_missing", /linkedin|github|portfolio|作品集|项目链接|project link|header.*link/i],
  ["skill_pruning", /删除.*(?:skill|技能|tool|工具)|删掉.*(?:skill|技能|tool|工具)|remove.*(?:skill|tool)|keep.*(?:ubuntu|aws|gcp|azure|centos|red hat)/i],
  ["section_exists", /interests section|activities section|summary section|education section|skills section|experience section|projects section|兴趣|興趣|活动|活動/i],
];

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitCsv(value) {
  return actionGovernance.splitCsv(value);
}

function hasAny(patterns, text) {
  return patterns.some((pattern) => pattern.test(String(text || "")));
}

function actionText(row = {}) {
  return [
    row.A_action,
    row.action_summary,
    row.action,
    row.actionSummary,
  ].filter(Boolean).join(" ");
}

function generalizedText(row = {}) {
  return compact(row.generalized_action || row.generalizedAction || "");
}

function roleScopeText(row = {}) {
  return [
    row.role_family,
    row.roleFamily,
    row.target_roles,
    row.targetRoles,
    row.activation_role_family,
    row.activationRoleFamily,
    row.activation_keywords,
    row.activationKeywords,
  ].filter(Boolean).join(" ");
}

function hasConcreteRoleScope(row = {}) {
  const values = [
    ...splitCsv(row.role_family || row.roleFamily),
    ...splitCsv(row.target_roles || row.targetRoles),
    ...splitCsv(row.activation_role_family || row.activationRoleFamily),
    ...splitCsv(row.activation_keywords || row.activationKeywords),
  ].map(actionGovernance.normalizeTerm).filter(Boolean);
  return values.some((value) => value && value !== "universal" && value !== "unknown");
}

function hasGroundingOrActivation(row = {}) {
  return Boolean(compact([
    row.grounding_terms,
    row.groundingTerms,
    row.activation_role_family,
    row.activationRoleFamily,
    row.activation_keywords,
    row.activationKeywords,
  ].filter(Boolean).join(" ")));
}

function preconditionTypes(row = {}) {
  const text = [
    actionText(row),
    row.user_problem_summary,
    row.problem_tags,
    row.canonical_action_family,
    row.action_depth,
  ].filter(Boolean).join(" ");
  return PRECONDITION_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([type]) => type);
}

function deterministicAudit(row = {}) {
  const raw = actionText(row);
  const generalized = generalizedText(row);
  const mode = actionGovernance.normalizeTerm(row.display_action_mode || row.displayActionMode || actionGovernance.inferDisplayActionMode(row));
  const specificity = actionGovernance.normalizeTerm(row.action_specificity || row.actionSpecificity || actionGovernance.inferActionSpecificity(row));
  const rawHasDomain = hasAny(DOMAIN_PATTERNS, raw);
  const rawHasCase = hasAny(CASE_PATTERNS, raw) || hasAny(COMPANY_OR_SCHOOL_PATTERNS, raw);
  const genHasDomain = hasAny(DOMAIN_PATTERNS, generalized);
  const genHasCase = hasAny(CASE_PATTERNS, generalized) || hasAny(COMPANY_OR_SCHOOL_PATTERNS, generalized);
  const rawCanDisplay = mode === "raw" || mode === "grounded_raw";
  const roleScopeValid = !rawHasDomain || !rawCanDisplay || hasConcreteRoleScope(row);
  const rawRequiresGrounding = rawHasCase || specificity === "resume_specific" || specificity === "case_specific";
  const rawGateValid = !rawRequiresGrounding || !rawCanDisplay || mode === "grounded_raw";
  const rawGroundingValid = !rawRequiresGrounding || !rawCanDisplay || hasGroundingOrActivation(row);
  const preconditions = preconditionTypes(row);
  const preconditionNeeded = preconditions.length > 0;

  const issues = [];
  if (mode === "raw" && rawHasCase) issues.push("raw_case_specific_in_raw_mode");
  if (rawCanDisplay && rawHasDomain && !roleScopeValid) issues.push("raw_domain_without_role_scope");
  if (rawCanDisplay && rawRequiresGrounding && !rawGateValid) issues.push("raw_requires_grounded_mode");
  if (rawCanDisplay && rawRequiresGrounding && !rawGroundingValid) issues.push("raw_requires_grounding_or_activation");
  if (genHasDomain) issues.push("generalized_domain_leak");
  if (genHasCase) issues.push("generalized_case_leak");
  if ((mode === "grounded_raw" || mode === "generalized") && !generalized) issues.push("missing_generalized_action");
  if (preconditionNeeded) issues.push("precondition_sensitive_action");

  return {
    raw_safe: !rawHasCase && (!rawHasDomain || roleScopeValid),
    raw_requires_grounding: rawRequiresGrounding,
    generalized_safe: Boolean(generalized) && !genHasDomain && !genHasCase,
    role_scope_valid: roleScopeValid,
    precondition_needed: preconditionNeeded,
    precondition_types: preconditions,
    case_leak_risk: rawHasCase || genHasCase,
    domain_leak_in_generalized: genHasDomain,
    needs_manual_review: issues.length > 0,
    issues,
  };
}

function normalizeLlmVerdict(verdict = {}) {
  const issues = Array.isArray(verdict.issues) ? verdict.issues.map(compact).filter(Boolean) : [];
  return {
    llm_reviewed: Boolean(verdict && Object.keys(verdict).length),
    llm_safe: verdict.safe === true,
    llm_confidence: Number.isFinite(Number(verdict.confidence)) ? Number(verdict.confidence) : 0,
    llm_issues: issues,
    llm_notes: compact(verdict.notes || "", 500),
  };
}

function finalAudit(row = {}, llmVerdict = null) {
  const deterministic = deterministicAudit(row);
  const llm = normalizeLlmVerdict(llmVerdict || {});
  const allIssues = [...new Set([
    ...deterministic.issues,
    ...llm.llm_issues,
    llm.llm_reviewed && !llm.llm_safe ? "llm_marked_unsafe" : "",
    llm.llm_reviewed && llm.llm_confidence < 0.72 ? "llm_low_confidence" : "",
  ].filter(Boolean))];
  const needsManual = deterministic.needs_manual_review ||
    (llm.llm_reviewed && (!llm.llm_safe || llm.llm_confidence < 0.72)) ||
    !llm.llm_reviewed;
  const status = needsManual ? "needs_manual_review" : "approved";
  const confidence = llm.llm_reviewed
    ? Math.min(0.98, Math.max(0.35, llm.llm_confidence - (deterministic.issues.length * 0.06)))
    : (deterministic.needs_manual_review ? 0.48 : 0.68);

  return {
    ...deterministic,
    ...llm,
    needs_manual_review: needsManual,
    action_semantic_review_status: status,
    action_semantic_review_source: llm.llm_reviewed ? "rules_llm_full_audit_v1" : "rules_full_audit_v1",
    action_semantic_review_confidence: Number(confidence.toFixed(2)),
    action_semantic_review_issues: allIssues,
  };
}

module.exports = {
  DOMAIN_PATTERNS,
  CASE_PATTERNS,
  COMPANY_OR_SCHOOL_PATTERNS,
  PRECONDITION_PATTERNS,
  compact,
  actionText,
  generalizedText,
  hasAny,
  hasConcreteRoleScope,
  hasGroundingOrActivation,
  preconditionTypes,
  deterministicAudit,
  finalAudit,
};
