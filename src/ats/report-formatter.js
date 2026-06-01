"use strict";

const crypto = require("crypto");

const SCORING_MODE = "external_ats_like";
const REPORT_VERSION = "0.2.0";

const DIMENSION_LABELS = {
  A: "\u6587\u4ef6\u4e0e\u683c\u5f0f\u89c4\u8303",
  B: "\u57fa\u672c\u8d44\u6599\u5b8c\u6574\u6027",
  C: "\u5185\u5bb9\u8d28\u91cf\u4e0e\u6210\u679c\u8868\u8fbe",
  D: "JD \u5173\u952e\u8bcd\u5339\u914d\u5ea6",
  E: "\u5730\u57df\u4e0e\u5e02\u573a\u9002\u914d\u5ea6",
  F: "\u804c\u4f4d\u76f8\u5173\u6027 / \u7ecf\u9a8c\u5339\u914d\u5ea6",
};

const SCORE_CAP_THRESHOLDS = {
  hardSkillCritical: 0.3,
  hardSkillLow: 0.45,
  hardSkillCriticalCap: 60,
  hardSkillLowCap: 70,
  jdMatchLow: 45,
  jdMatchLowCap: 75,
};

function clampRound(value, min = 0, max = 100) {
  const number = Number.isFinite(Number(value)) ? Number(value) : 0;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function pct(score, max) {
  const value = max ? score / max : 0;
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}

function snakeCase(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function isPlaceholderTitle(value) {
  return !value || /根据\s*JD\s*分析|依\s*JD\s*自动识别|unknown/i.test(String(value));
}

function titleCaseRole(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

/**
 * Try to extract a job title directly from JD text.
 * Looks for explicit markers first, then falls back to first short capitalized line.
 */
function extractTitleFromJD(jdText) {
  if (!jdText || typeof jdText !== "string") return null;
  const text = jdText.trim();

  // 1. Explicit label markers (EN + ZH, including 【岗位】 bracket format)
  const labelPatterns = [
    /【(?:岗位|职位|职称|职务|招聘岗位|应聘岗位)】\s*[：:]\s*([^\n【]+)/,
    /^(?:岗位|职位|职称|职务|招聘职位|应聘职位)\s*[：:\-–]\s*(.+)/m,
    /^(?:job\s+title|position|role|title)\s*[:\-–]\s*(.+)/im,
    /(?:we(?:'re|\s+are)\s+(?:looking|hiring|seeking)\s+(?:for\s+)?(?:an?\s+)?)([\w\s\-\/]+?)(?:\s*(?:to|who|that|\.|,|$))/i,
    /(?:join\s+us\s+as\s+(?:an?\s+)?)([\w\s\-\/]+?)(?:\s*(?:\.|,|$))/i,
  ];
  for (const re of labelPatterns) {
    const m = text.match(re);
    if (m) {
      const title = (m[1] || "").trim().replace(/[.!?。！？]$/, "").trim();
      if (title.length >= 2 && title.length <= 60) return title;
    }
  }

  // 2. First non-empty line that looks like a job title
  //    (short, not a sentence, not all-caps noise like "JOB DESCRIPTION")
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    // Skip lines that are obviously headers / noise
    if (/^(job\s+description|about\s+(us|the\s+role|this\s+role)|overview|summary|responsibilities|requirements|qualifications)/i.test(line)) continue;
    if (/^[A-Z\s\-&]+$/.test(line) && line.length > 30) continue; // all-caps long header
    if (line.length < 3 || line.length > 70) continue;
    // Looks title-like if it has mixed case or is 1-4 words
    const wordCount = line.split(/\s+/).length;
    if (wordCount <= 6 && !/[.?!。？！]$/.test(line)) return line;
  }

  return null;
}

function inferCanonicalTargetRole(rawScoreResult, input = {}) {
  // Priority 1: user-typed jobTitle (most explicit)
  if (input.jobTitle && !isPlaceholderTitle(input.jobTitle)) {
    return { role: snakeCase(input.jobTitle), display: input.jobTitle };
  }

  // Priority 2: extract directly from JD label (Position:, 【岗位】: etc.) — exact beats generic patterns
  const labelExtracted = extractTitleFromJD(input.jdText);
  if (labelExtracted) {
    return { role: snakeCase(labelExtracted), display: labelExtracted };
  }

  const candidates = [
    rawScoreResult.jobTitle,
    rawScoreResult.metrics?.checks?.exactJobTitle?.targetTitle,
    ...(rawScoreResult.metrics?.keywordProfile?.target_role || []),
    rawScoreResult.metrics?.detectedTargetRole,
    rawScoreResult.profile?.targetRole,
  ].filter((value) => value && !isPlaceholderTitle(value));

  // Priority 3: candidates from score result
  const firstCandidate = candidates.find((value) => snakeCase(value) !== "general");
  if (firstCandidate) {
    return { role: snakeCase(firstCandidate), display: titleCaseRole(firstCandidate) };
  }

  // Priority 4: generic rolePatterns against full text (fallback only)
  const text = `${candidates.join(" ")} ${input.jdText || ""}`.toLowerCase();
  const rolePatterns = [
    { role: "software_development_engineer", display: "Software Development Engineer", pattern: /\bsoftware development engineer\b|\bsde\b/ },
    { role: "software_engineer", display: "Software Engineer", pattern: /\bsoftware engineer\b|\bswe\b|\bsoftware developer\b/ },
    { role: "full_stack_engineer", display: "Full Stack Engineer", pattern: /\bfull[-\s]?stack\b/ },
    { role: "frontend_engineer", display: "Frontend Engineer", pattern: /\bfront[-\s]?end\b/ },
    { role: "backend_engineer", display: "Backend Engineer", pattern: /\bback[-\s]?end\b/ },
    { role: "data_engineer", display: "Data Engineer", pattern: /\bdata engineer\b/ },
    { role: "data_analyst", display: "Data Analyst", pattern: /\bdata analyst\b/ },
    { role: "data_scientist", display: "Data Scientist", pattern: /\bdata scientist\b/ },
    { role: "machine_learning_engineer", display: "Machine Learning Engineer", pattern: /\bmachine learning engineer\b|\bml engineer\b/ },
    { role: "ai_engineer", display: "AI Engineer", pattern: /\bai engineer\b|\bartificial intelligence engineer\b/ },
    { role: "product_manager", display: "Product Manager", pattern: /\bproduct manager\b|\bsenior pm\b/ },
    { role: "product_designer", display: "Product Designer", pattern: /\bproduct designer\b/ },
    { role: "ux_designer", display: "UX Designer", pattern: /\bux designer\b|\bui\/ux\b|\bux\/ui\b/ },
    { role: "financial_analyst", display: "Financial Analyst", pattern: /\bfinancial analyst\b/ },
    { role: "investment_analyst", display: "Investment Analyst", pattern: /\binvestment analyst\b/ },
    { role: "accounting", display: "Accountant", pattern: /\baccountant\b|\baccounting\b/ },
    { role: "business_analyst", display: "Business Analyst", pattern: /\bbusiness analyst\b|\bba\b/ },
    { role: "marketing_manager", display: "Marketing Manager", pattern: /\bmarketing manager\b/ },
    { role: "marketing_analyst", display: "Marketing Analyst", pattern: /\bmarketing analyst\b/ },
    { role: "operations_manager", display: "Operations Manager", pattern: /\boperations manager\b/ },
    { role: "project_manager", display: "Project Manager", pattern: /\bproject manager\b|\bpmp\b/ },
    { role: "consultant", display: "Consultant", pattern: /\bconsultant\b/ },
    { role: "attorney", display: "Attorney", pattern: /\battorney\b|\blawyer\b/ },
    { role: "paralegal", display: "Paralegal", pattern: /\bparalegal\b/ },
    { role: "hr_manager", display: "HR Manager", pattern: /\bhr manager\b|\bhuman resources manager\b/ },
    { role: "recruiter", display: "Recruiter", pattern: /\brecruiter\b|\btalent acquisition\b/ },
    { role: "sales_representative", display: "Sales Representative", pattern: /\bsales representative\b|\baccount executive\b/ },
    { role: "research_analyst", display: "Research Analyst", pattern: /\bresearch analyst\b/ },
    { role: "supply_chain", display: "Supply Chain Analyst", pattern: /\bsupply chain\b/ },
  ];
  const matched = rolePatterns.find((item) => item.pattern.test(text));
  if (matched) return matched;

  return { role: "unknown", display: null };
}

function buildInternalJobTitle(rawScoreResult, input = {}) {
  const rawTitle = input.jobTitle || rawScoreResult.jobTitle || "";
  if (!isPlaceholderTitle(rawTitle)) return rawTitle || null;
  const canonicalRole = inferCanonicalTargetRole(rawScoreResult, input);
  return canonicalRole.role === "unknown" ? "unknown" : canonicalRole.display;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildDimensions(rawScoreResult) {
  const dimensions = rawScoreResult.dimensions || {};
  const dimensionProblems = rawScoreResult.dimensionProblems || {};
  return Object.fromEntries(["A", "B", "C", "D", "E", "F"].map((key) => {
    const dim = dimensions[key] || {};
    const score = Number(dim.score || 0);
    const max = Number(dim.max || 0);
    return [key, {
      score,
      max,
      percentage: pct(score, max),
      label: dim.label || DIMENSION_LABELS[key],
      problems: asArray(dimensionProblems[key]),
    }];
  }));
}

function buildScoreCaps(rawScoreResult, scores) {
  const reasons = [];
  const hardSkillCoverage = Number(rawScoreResult.metrics?.keywordMatch?.matchMethod?.hardCoverage || 0) / 100;
  const exactJobTitle = rawScoreResult.metrics?.checks?.exactJobTitle;

  if (hardSkillCoverage < SCORE_CAP_THRESHOLDS.hardSkillCritical) {
    reasons.push({
      code: "LOW_HARD_SKILL_MATCH",
      message: "Hard skill coverage is below the configured critical threshold, so the total score is capped.",
      finalCap: SCORE_CAP_THRESHOLDS.hardSkillCriticalCap,
    });
  } else if (hardSkillCoverage < SCORE_CAP_THRESHOLDS.hardSkillLow) {
    reasons.push({
      code: "LOW_HARD_SKILL_MATCH",
      message: "Hard skill coverage is below the configured threshold, so the total score is capped.",
      finalCap: SCORE_CAP_THRESHOLDS.hardSkillLowCap,
    });
  }

  if (scores.jdMatch.score < SCORE_CAP_THRESHOLDS.jdMatchLow) {
    reasons.push({
      code: "LOW_JD_MATCH",
      message: "JD match score is below the configured threshold, so the total score is capped.",
      finalCap: SCORE_CAP_THRESHOLDS.jdMatchLowCap,
    });
  }

  if (exactJobTitle && !exactJobTitle.exact) {
    reasons.push({
      code: "MISSING_EXACT_JOB_TITLE",
      message: "Exact target job title is missing from the resume.",
    });
  }

  for (const cap of asArray(rawScoreResult.metrics?.checks?.scoreCaps)) {
    if (!reasons.some((reason) => reason.message === cap.reason)) {
      reasons.push({
        code: snakeCase(cap.reason).toUpperCase(),
        message: cap.reason,
        finalCap: cap.max || null,
      });
    }
  }

  const caps = reasons.map((reason) => reason.finalCap).filter((value) => Number.isFinite(value));
  return {
    applied: caps.length > 0,
    finalCap: caps.length ? Math.min(...caps) : null,
    reasons: reasons.map(({ code, message }) => ({ code, message })),
  };
}

function buildScores(rawScoreResult, dimensions) {
  const d = dimensions || buildDimensions(rawScoreResult);
  const scorePercent = (keys) => {
    const score = keys.reduce((sum, key) => sum + (d[key]?.score || 0), 0);
    const max = keys.reduce((sum, key) => sum + (d[key]?.max || 0), 0);
    return clampRound(max ? (score / max) * 100 : rawScoreResult.total || 0);
  };

  const searchabilityChecks = rawScoreResult.metrics?.checks || {};
  const searchabilityBonus = [
    searchabilityChecks.emailValid,
    searchabilityChecks.phoneValid,
    searchabilityChecks.hasLinkedIn,
    searchabilityChecks.hasPortfolio,
    searchabilityChecks.hasSummary,
  ].filter(Boolean).length;

  return {
    overall: {
      score: clampRound(rawScoreResult.total, 0, 100),
      max: 100,
      risk: rawScoreResult.risk || "\u4e2d",
    },
    resumeQuality: {
      score: scorePercent(["A", "B", "C"]),
      max: 100,
      label: "Resume Quality",
    },
    jdMatch: {
      score: scorePercent(["D", "F"]),
      max: 100,
      label: "JD Match",
    },
    searchability: {
      score: clampRound(scorePercent(["A", "B"]) * 0.8 + searchabilityBonus * 4, 0, 100),
      max: 100,
      label: "ATS Searchability",
    },
  };
}

function buildProfile(rawScoreResult, input = {}) {
  const rawProfile = rawScoreResult.profile || {};
  const canonicalRole = inferCanonicalTargetRole(rawScoreResult, input);
  const title = isPlaceholderTitle(input.jobTitle || rawScoreResult.jobTitle)
    ? canonicalRole.display
    : (input.jobTitle || rawScoreResult.jobTitle || "");
  const targetRole = canonicalRole.role || rawProfile.targetRole || snakeCase(title);
  const roleText = `${title} ${input.jdText || ""}`.toLowerCase();
  const roleFamily = /\b(accountant|accounting|bookkeep|audit|tax|controller|cpa|accounts payable|accounts receivable)\b/.test(roleText)
    ? "accounting"
    : /\b(finance|financial|investment|fp&a|valuation|treasury)\b/.test(roleText)
      ? "finance"
      : /software|swe|sde|full.?stack|backend|frontend/.test(roleText)
    ? "software_engineer"
    : rawProfile.roleFamily || targetRole || "unknown";

  return {
    roleFamily,
    targetRole: targetRole === "general" ? "unknown" : targetRole,
    seniority: rawProfile.seniority || inferSeniority(roleText),
    candidateType: rawProfile.candidateType || inferCandidateType(roleText, rawProfile.seniority),
    yearsOfExperience: rawProfile.yearsOfExperience ?? null,
    degreeField: rawProfile.degreeField || null,
    market: rawProfile.market || "unknown",
    location: rawProfile.location || null,
    willingToRelocate: Boolean(rawProfile.willingToRelocate || rawScoreResult.metrics?.checks?.hasWillingToRelocate),
  };
}

function inferSeniority(text) {
  if (/student|intern/.test(text)) return "student";
  if (/new grad|graduate/.test(text)) return "new_grad";
  if (/senior|staff|principal|lead/.test(text)) return "senior";
  if (/mid/.test(text)) return "mid_level";
  if (/entry|junior|associate/.test(text)) return "entry_level";
  return "unknown";
}

function inferCandidateType(text, seniority) {
  if (seniority === "student" || /student|intern/.test(text)) return "student";
  if (seniority === "new_grad" || /new grad|graduate/.test(text)) return "new_grad";
  if (seniority === "entry_level" || seniority === "early_career") return "early_career";
  if (seniority === "mid_level" || seniority === "senior") return "experienced";
  return "unknown";
}

function buildDiagnostics(rawScoreResult, input = {}) {
  const diagnostics = rawScoreResult.diagnostics || {};
  const checks = rawScoreResult.metrics?.checks || {};
  const canonicalRole = inferCanonicalTargetRole(rawScoreResult, input);
  const internalTargetTitle = canonicalRole.role === "unknown" ? "unknown" : canonicalRole.display;
  return {
    searchability: {
      hasEmail: Boolean(diagnostics.searchability?.hasEmail ?? checks.emailValid),
      hasPhone: Boolean(diagnostics.searchability?.hasPhone ?? checks.phoneValid),
      hasLinkedIn: Boolean(diagnostics.searchability?.hasLinkedIn ?? checks.hasLinkedIn),
      hasPortfolio: Boolean(diagnostics.searchability?.hasPortfolio ?? checks.hasPortfolio),
      hasSummary: Boolean(diagnostics.searchability?.hasSummary ?? checks.hasSummary),
      hasEducation: Boolean(diagnostics.searchability?.hasEducation ?? true),
      hasExperience: Boolean(diagnostics.searchability?.hasExperience ?? true),
      hasSkills: true,
      dateFormattingValid: Boolean(diagnostics.searchability?.dateFormattingValid ?? !checks.inconsistentDates),
      wordCount: Number(diagnostics.searchability?.wordCount || 0),
    },
    jobTitleMatch: {
      exactMatch: Boolean(diagnostics.jobTitleMatch?.exactMatch ?? checks.exactJobTitle?.exact),
      targetTitle: internalTargetTitle,
      foundTitles: asArray(diagnostics.jobTitleMatch?.foundTitles),
      severity: diagnostics.jobTitleMatch?.severity || (checks.exactJobTitle?.exact === false ? "medium" : "none"),
    },
    measurableResults: {
      count: Number(diagnostics.measurableResults?.count || rawScoreResult.metrics?.quantifiedCount || 0),
      status: diagnostics.measurableResults?.status || "weak",
    },
    resumeTone: {
      hasNegativePhrases: false,
      flaggedPhrases: [],
    },
  };
}

function buildKeywordMatchV2(rawScoreResult) {
  const legacy = rawScoreResult.metrics?.keywordMatch || {};
  const matchMethod = legacy.matchMethod || {};
  const categories = {};
  for (const key of ["core_skills", "tools", "domain_keywords", "action_verbs", "nice_to_have"]) {
    const source = legacy[key] || {};
    categories[key] = {
      total: source.total || 0,
      matched: source.matched || 0,
      missing: asArray(source.missing),
      matchedTerms: asArray(source.matchedTerms).map((term) => ({ term, matchType: "exact" })),
    };
  }

  const toSkillGroup = (source = {}) => ({
    total: source.total || 0,
    matched: asArray(source.matchedTerms).length,
    missing: asArray(source.missing).length,
    matchedTerms: asArray(source.matchedTerms).map((term) => ({
      term,
      matchType: "exact",
      resumeCount: null,
      jdCount: null,
      locations: [],
    })),
    missingTerms: asArray(source.missing).map((term) => ({
      term,
      priority: "medium",
      safeToAdd: true,
      reason: "Relevant to the target role or job description.",
    })),
  });

  return {
    summary: {
      hardSkillCoverage: Number(((matchMethod.hardCoverage || 0) / 100).toFixed(3)),
      softSkillCoverage: Number(((matchMethod.softCoverage || 0) / 100).toFixed(3)),
      overallKeywordCoverage: Number(((matchMethod.combinedKeywordCoverage || rawScoreResult.metrics?.jdMatchRatio || 0) / 100).toFixed(3)),
    },
    categories,
    hardSkills: toSkillGroup(legacy.hard_skills),
    softSkills: toSkillGroup(legacy.soft_skills),
  };
}

function buildPriorityMissingKeywords(rawScoreResult) {
  return asArray(rawScoreResult.priorityMissingKeywords).map((item) => ({
    term: item.term,
    priority: item.priority || "medium",
    category: item.category || "hard_skill",
    safeToAdd: item.safeToAdd !== false,
    reason: item.reason || "Relevant to the target role.",
  }));
}

function buildProblemTags(internalAtsResult) {
  const tags = asArray(internalAtsResult.problemTags).map(normalizeProblemTag).filter(Boolean);
  const add = (tag) => {
    if (!tags.some((item) => item.tag === tag.tag)) tags.push(tag);
  };

  const dScore = internalAtsResult.dimensions?.D?.percentage || 0;
  const hardCoverage = internalAtsResult.keywordMatch?.summary?.hardSkillCoverage || 0;
  const titleExact = internalAtsResult.diagnostics?.jobTitleMatch?.exactMatch;
  const evidence = internalAtsResult.metrics?.checks?.coreSkillBulletCoverage;

  if (dScore < 0.55) add(tag("low_jd_keyword_match", "D", "keyword_alignment", "high", 0.85));
  if (hardCoverage < 0.45) add(tag("low_hard_skill_match", "D", "keyword_alignment", "high", 0.9));
  if (titleExact === false) add(tag("missing_exact_job_title", "F", "role_fit", "medium", 0.65));
  if (evidence != null && evidence < 0.4) add(tag("weak_experience_keyword_evidence", "C", "engineering_practices", "medium", 0.65));
  if (!tags.length || internalAtsResult.total >= 75) {
    add(tag("keyword_gap_minor", "D", "keyword_alignment", "low", 0.4));
    add(tag("career_growth_optimization", "F", "career_growth", "low", 0.35));
  }

  return tags.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

function normalizeProblemTag(item) {
  if (!item || !item.tag) return null;
  const mapping = {
    keyword_gap_critical: "low_jd_keyword_match",
    keyword_gap_major: "low_jd_keyword_match",
    insufficient_quantification: "low_measurable_results",
    weak_verbs: "weak_action_verbs",
    missing_summary: "weak_summary_role_alignment",
    no_relocate_signal: "missing_relocation_signal",
    short_tenure_unexplained: "short_tenure_unclear",
    missing_coursework: "education_details_missing",
    missing_gpa: "education_details_missing",
    role_mismatch: "weak_target_role_alignment",
    summary_missing_role: "weak_summary_role_alignment",
  };
  return {
    tag: mapping[item.tag] || item.tag,
    dimension: item.dimension || "overall",
    topic: normalizeTopic(item.topic),
    severity: normalizeSeverity(item.severity),
    retrievalWeight: Number(item.retrievalWeight || 0.4),
    evidence: item.evidence || `${item.tag} detected by ATS rules.`,
  };
}

function tag(tagName, dimension, topic, severity, retrievalWeight) {
  return {
    tag: tagName,
    dimension,
    topic,
    severity,
    retrievalWeight,
    evidence: `${tagName} detected by ATS rules.`,
  };
}

function normalizeTopic(topic) {
  const mapping = {
    resume_structure: "summary_positioning",
    career_positioning: "role_fit",
    tools_alignment: "keyword_alignment",
    resume_maintenance: "content_quality",
    education_completeness: "content_quality",
    career_narrative: "content_quality",
  };
  return mapping[topic] || topic || "content_quality";
}

function normalizeSeverity(value) {
  return ["critical", "high", "medium", "low"].includes(value) ? value : "medium";
}

function severityRank(value) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[value] ?? 9;
}

function buildTopInsights(internalAtsResult) {
  const lowTags = internalAtsResult.problemTags.filter((item) => item.severity === "low").slice(0, 3);
  const source = lowTags.length ? lowTags : internalAtsResult.problemTags.slice(-2);
  return dedupeInsights(source.map((item) => ({
    title: insightTitle(item),
    severity: item.severity,
    dimension: item.dimension,
    topic: item.topic,
    message: insightMessage(item),
    relatedTags: [item.tag],
  })));
}

function buildTopProblems(internalAtsResult) {
  return dedupeInsights(internalAtsResult.problemTags
    .filter((item) => ["critical", "high", "medium"].includes(item.severity))
    .map((item) => ({
      title: problemTitle(item),
      severity: item.severity,
      dimension: item.dimension,
      topic: item.topic,
      message: problemMessage(item),
      relatedTags: [item.tag],
    })));
}

function dedupeInsights(items) {
  const byKey = new Map();
  for (const item of items) {
    const relatedTags = asArray(item.relatedTags).sort();
    const key = [
      item.title || "",
    ].join("|");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item, relatedTags });
    } else {
      const mergedTags = [...new Set([...existing.relatedTags, ...relatedTags])].sort();
      byKey.set(key, {
        ...existing,
        severity: severityRank(item.severity) < severityRank(existing.severity) ? item.severity : existing.severity,
        relatedTags: mergedTags,
      });
    }
  }
  return [...byKey.values()]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 3);
}

function insightTitle(item) {
  if (item.tag === "career_growth_optimization") return "\u53ef\u4ee5\u8fdb\u4e00\u6b65\u5f3a\u5316\u804c\u4e1a\u6210\u957f\u6545\u4e8b";
  return "\u5173\u952e\u8bcd\u5339\u914d\u5ea6\u4ecd\u6709\u5c0f\u5e45\u4f18\u5316\u7a7a\u95f4";
}

function insightMessage(item) {
  if (item.tag === "career_growth_optimization") {
    return "\u4f60\u7684\u7b80\u5386\u57fa\u7840\u4e0d\u9519\uff0c\u89e3\u9501\u540e\u53ef\u4ee5\u770b\u66f4\u5177\u4f53\u7684\u5bfc\u5e08\u5efa\u8bae\u6765\u63d0\u5347\u5b9a\u4f4d\u548c\u7ade\u4e89\u529b\u3002";
  }
  return "\u4f60\u7684\u7b80\u5386\u6574\u4f53\u5339\u914d\u5ea6\u8f83\u9ad8\uff0c\u4f46\u4ecd\u6709\u5c11\u91cf JD \u5173\u952e\u8bcd\u53ef\u4ee5\u66f4\u81ea\u7136\u5730\u8865\u8fdb Summary \u6216 Experience\u3002";
}

function problemTitle(item) {
  if (item.tag === "low_hard_skill_match") return "\u6838\u5fc3\u786c\u6280\u80fd\u5339\u914d\u504f\u4f4e";
  if (item.tag === "missing_exact_job_title") return "\u7f3a\u5c11\u76ee\u6807\u5c97\u4f4d\u539f\u8bcd";
  if (item.tag === "low_measurable_results") return "\u53ef\u91cf\u5316\u6210\u679c\u4e0d\u8db3";
  return "JD \u5173\u952e\u8bcd\u5339\u914d\u5ea6\u504f\u4f4e";
}

function problemMessage(item) {
  if (item.tag === "missing_exact_job_title") return "\u7b80\u5386\u4e2d\u672a\u7a33\u5b9a\u51fa\u73b0\u76ee\u6807\u5c97\u4f4d\u539f\u8bcd\uff0c\u53ef\u80fd\u5f71\u54cd ATS \u5bf9\u804c\u4f4d\u5b9a\u4f4d\u7684\u5224\u65ad\u3002";
  if (item.tag === "low_measurable_results") return "\u7ecf\u5386\u4e2d\u7684\u7ed3\u679c\u8bc1\u636e\u504f\u5c11\uff0c\u5efa\u8bae\u63d0\u5347\u767e\u5206\u6bd4\u3001\u89c4\u6a21\u3001\u6548\u7387\u7b49\u91cf\u5316\u8868\u8fbe\u3002";
  if (item.tag === "low_hard_skill_match") return "\u6838\u5fc3\u786c\u6280\u80fd\u8986\u76d6\u4e0d\u8db3\uff0c\u9700\u8981\u628a\u6709\u771f\u5b9e\u7ecf\u9a8c\u652f\u6491\u7684\u5de5\u5177\u3001\u6280\u80fd\u548c\u573a\u666f\u5199\u8fdb\u7ecf\u5386\u8bc1\u636e\u91cc\u3002";
  return "\u4f60\u7684\u7b80\u5386\u7f3a\u5c11\u591a\u4e2a\u76ee\u6807\u5c97\u4f4d\u6838\u5fc3\u5173\u952e\u8bcd\uff0c\u53ef\u80fd\u5f71\u54cd ATS \u521d\u7b5b\u3002";
}

function buildStructuredSuggestions(internalAtsResult) {
  const suggestions = [];
  let priority = 1;
  const add = (type, targetSection, message, relatedTags, relatedKeywords = [], unlockTier = "paid") => {
    suggestions.push({ type, priority: priority++, targetSection, message, relatedTags, relatedKeywords, unlockTier });
  };

  if (internalAtsResult.problemTags.some((item) => item.tag === "missing_exact_job_title")) {
    add("keyword_fix", "summary", "Add the exact target title to the Summary section.", ["missing_exact_job_title"], [internalAtsResult.diagnostics.jobTitleMatch.targetTitle], "free");
  }
  if (internalAtsResult.problemTags.some((item) => item.tag === "low_jd_keyword_match" || item.tag === "low_hard_skill_match")) {
    add("keyword_fix", "experience", "Prioritize missing role keywords that are supported by real project or work evidence.", ["low_jd_keyword_match", "low_hard_skill_match"], internalAtsResult.priorityMissingKeywords.slice(0, 3).map((item) => item.term), "paid");
  }
  if (internalAtsResult.problemTags.some((item) => item.tag === "low_measurable_results")) {
    add("content_fix", "experience", "Rewrite top bullets with action, method, and measurable result.", ["low_measurable_results"], [], "paid");
  }

  for (const suggestion of asArray(internalAtsResult.suggestions).slice(0, 3)) {
    add("content_fix", "overall", suggestion, [], [], "premium");
  }

  return suggestions;
}

function buildRetrievalQuery(internalAtsResult) {
  const topics = [...new Set(internalAtsResult.problemTags.map((tagItem) => tagItem.topic))].slice(0, 6);
  const problemTags = internalAtsResult.problemTags.map((tagItem) => tagItem.tag).slice(0, 8);
  const priorityKeywords = internalAtsResult.priorityMissingKeywords
    .filter((item) => item.priority === "high" || item.priority === "medium")
    .map((item) => item.term)
    .slice(0, 6);
  const profile = internalAtsResult.profile;
  const targetRoles = [...new Set([profile.targetRole, profile.roleFamily, "universal"].filter(Boolean))];
  const seniority = [...new Set([profile.seniority, profile.candidateType, "universal"].filter(Boolean))];

  return {
    roleFamily: profile.roleFamily,
    targetRole: profile.targetRole,
    seniority: profile.seniority,
    candidateType: profile.candidateType,
    topics,
    problemTags,
    priorityKeywords,
    queryText: [profile.seniority, profile.targetRole, ...problemTags.slice(0, 4), ...topics.slice(0, 3)].filter(Boolean).join(" "),
    filters: {
      roleFamily: [profile.roleFamily, "universal"].filter(Boolean),
      targetRoles,
      seniority,
      topics,
    },
  };
}

function buildMentorAdviceSlots() {
  return {
    free: {
      count: 1,
      selectionStrategy: "highest_retrieval_score",
      requiredTags: [],
    },
    paid: {
      count: 3,
      selectionStrategy: "diverse_topics",
      preferredTopics: ["keyword_alignment", "summary_positioning", "experience_rewrite", "career_growth"],
    },
  };
}

function buildReportAssembly() {
  return {
    freeSections: ["ats_score", "top_insights", "one_mentor_advice", "locked_advice_preview"],
    paidSections: ["all_mentor_advice", "missing_keyword_checklist", "section_fix_plan", "ai_rewrite_cta"],
  };
}

function buildInternalAtsResult(rawScoreResult, input = {}) {
  const dimensions = buildDimensions(rawScoreResult);
  const scores = buildScores(rawScoreResult, dimensions);
  const jdMatchRatio = rawScoreResult.metrics?.jdMatchRatio ??
    (Number.isFinite(Number(rawScoreResult.jdMatchRatio)) ? Number((Number(rawScoreResult.jdMatchRatio) * 100).toFixed(1)) : null);
  const result = {
    engine: rawScoreResult.engine || "rule-based",
    version: REPORT_VERSION,
    scoringMode: SCORING_MODE,
    jobTitle: buildInternalJobTitle(rawScoreResult, input),
    hasJD: Boolean(rawScoreResult.hasJD ?? input.jdText),
    total: scores.overall.score,
    jdMatchRatio,
    maxScore: 100,
    risk: rawScoreResult.risk || scores.overall.risk,
    formatPenaltyTriggered: Boolean(rawScoreResult.formatPenaltyTriggered),
    formatPenaltyReason: asArray(rawScoreResult.formatPenaltyReason),
    scores,
    scoreCaps: null,
    dimensions,
    profile: buildProfile(rawScoreResult, input),
    diagnostics: buildDiagnostics(rawScoreResult, input),
    keywordMatch: buildKeywordMatchV2(rawScoreResult),
    priorityMissingKeywords: buildPriorityMissingKeywords(rawScoreResult),
    problemTags: asArray(rawScoreResult.problemTags),
    topInsights: [],
    topProblems: [],
    structuredSuggestions: [],
    retrievalQuery: null,
    mentorAdviceSlots: buildMentorAdviceSlots(),
    reportAssembly: buildReportAssembly(),
    metrics: rawScoreResult.metrics || {},
    topMissingKeywords: asArray(rawScoreResult.topMissingKeywords),
    problems: asArray(rawScoreResult.problems),
    suggestions: asArray(rawScoreResult.suggestions),
    dimensionProblems: rawScoreResult.dimensionProblems || {},
    improvement: rawScoreResult.improvement || {},
  };

  result.scoreCaps = buildScoreCaps(rawScoreResult, result.scores);
  result.problemTags = buildProblemTags(result);
  result.topProblems = buildTopProblems(result);
  result.topInsights = buildTopInsights(result);
  result.structuredSuggestions = buildStructuredSuggestions(result);
  result.retrievalQuery = buildRetrievalQuery(result);
  return result;
}

function formatInternalAtsResult(rawScoreResult, input = {}) {
  return buildInternalAtsResult(rawScoreResult, input);
}

function buildLockedPreview(paidAdvice) {
  return {
    lockedMentorCount: 3,
    lockedAdviceCount: 9,
    totalMentorCount: 4,
    totalAdviceCount: 12,
    topics: ["\u5173\u952e\u8bcd\u8865\u5145\u4f4d\u7f6e", "Summary \u5b9a\u4f4d\u5f3a\u5316", "Experience bullet \u4f18\u5316", "\u5c97\u4f4d\u5339\u914d\u7b56\u7565"],
    message: "\u89e3\u9501\u540e\u67e5\u770b 4 \u4f4d\u5bfc\u5e08\u7684 12 \u6761\u5b8c\u6574\u5efa\u8bae\uff0c\u8986\u76d6\u4f60\u7684\u4e3b\u8981 ATS \u95ee\u9898\u4e0e\u5206\u6bb5\u4fee\u6539\u8def\u5f84\u3002",
  };
}

function topicPreviewLabel(topicValue) {
  const labels = {
    keyword_alignment: "\u5173\u952e\u8bcd\u8865\u5145\u4f4d\u7f6e",
    summary_positioning: "Summary \u5b9a\u4f4d\u5f3a\u5316",
    experience_rewrite: "Experience bullet \u4f18\u5316",
    career_growth: "\u5c97\u4f4d\u5b9a\u4f4d\u5f3a\u5316",
  };
  return labels[topicValue] || "\u5bfc\u5e08\u4fee\u6539\u5efa\u8bae";
}

function formatPublicFreeReport(internalAtsResult, freeAdvice, lockedPreview) {
  const riskBucket = riskToBucket(internalAtsResult.risk, internalAtsResult.total);
  const topProblems = riskBucket === "low" ? [] : internalAtsResult.topProblems.slice(0, 3);
  const topInsights = riskBucket === "high"
    ? []
    : internalAtsResult.topInsights.slice(0, riskBucket === "medium" ? 2 : 3);

  return {
    engine: internalAtsResult.engine,
    version: internalAtsResult.version,
    schemaVersion: "ats_response_v0.2.0",
    scoringMode: internalAtsResult.scoringMode,
    jobTitle: (internalAtsResult.jobTitle === "unknown" || !internalAtsResult.jobTitle) ? null : internalAtsResult.jobTitle,
    hasJD: internalAtsResult.hasJD,
    total: internalAtsResult.total,
    jdMatchRatio: internalAtsResult.jdMatchRatio,
    risk: internalAtsResult.risk,
    scores: stripScoreLabels(internalAtsResult.scores),
    dimensions: stripDimensionProblems(internalAtsResult.dimensions),
    diagnostics: stripDiagnostics(internalAtsResult.diagnostics),
    topInsights: topInsights.map(stripInsight),
    topProblems: topProblems.map(stripInsight),
    freeMentorAdvice: freeAdvice ? stripFreeAdvice(freeAdvice) : null,
    lockedAdvicePreview: lockedPreview,
    keywordBreakdown: buildPublicKeywordBreakdown(internalAtsResult),
    topMissingKw: asArray(internalAtsResult.topMissingKeywords).slice(0, 12),
    topMissingKeywords: asArray(internalAtsResult.topMissingKeywords).slice(0, 12),
    problems: asArray(internalAtsResult.problems).slice(0, 3),
  };
}

function buildPublicKeywordBreakdown(internalAtsResult) {
  const cats = internalAtsResult.keywordMatch?.categories || {};
  const order = ["core_skills", "tools", "domain_keywords"];
  const labels = { core_skills: "核心技能", tools: "工具 / 技术", domain_keywords: "领域词" };
  return order
    .filter((k) => cats[k] && (cats[k].total > 0 || (cats[k].matchedTerms || []).length > 0 || (cats[k].missing || []).length > 0))
    .map((k) => {
      const cat = cats[k];
      return {
        key: k,
        label: labels[k] || k,
        matched: (cat.matchedTerms || []).map((t) => (typeof t === "string" ? t : t.term)).filter(Boolean),
        missing: (cat.missing || []).filter(Boolean),
        total: cat.total || 0,
      };
    });
}

function riskToBucket(risk, total) {
  if (risk === "高" || risk === "high" || total < 55) return "high";
  if (risk === "中" || risk === "medium" || total < 75) return "medium";
  return "low";
}

function stripScoreLabels(scores) {
  return {
    overall: scores.overall,
    resumeQuality: { score: scores.resumeQuality.score, max: scores.resumeQuality.max },
    jdMatch: { score: scores.jdMatch.score, max: scores.jdMatch.max },
    searchability: { score: scores.searchability.score, max: scores.searchability.max },
  };
}

function stripDimensionProblems(dimensions) {
  return Object.fromEntries(Object.entries(dimensions).map(([key, value]) => [key, {
    score: value.score,
    max: value.max,
    percentage: value.percentage,
    label: value.label,
  }]));
}

function stripDiagnostics(diagnostics) {
  return {
    searchability: diagnostics.searchability,
    jobTitleMatch: {
      exactMatch: diagnostics.jobTitleMatch.exactMatch,
      targetTitle: (diagnostics.jobTitleMatch.targetTitle === "unknown" || !diagnostics.jobTitleMatch.targetTitle)
        ? null
        : diagnostics.jobTitleMatch.targetTitle,
      severity: diagnostics.jobTitleMatch.severity,
    },
    measurableResults: diagnostics.measurableResults,
  };
}

function stripInsight(item) {
  return {
    title: item.title,
    severity: item.severity,
    message: item.message,
  };
}

function stripFreeAdvice(item) {
  if (Array.isArray(item.adviceItems)) {
    return {
      mentorId: item.mentorId,
      mentorName: item.mentorName,
      company: item.company,
      companyLogo: item.companyLogo || null,
      mentorTitle: item.mentorTitle,
      mentorSubtitle: item.mentorSubtitle,
      badges: asArray(item.badges).slice(0, 4),
      matchReason: item.matchReason,
      matchedProblems: asArray(item.matchedProblems).slice(0, 6),
      mentorLogoPool: asArray(item.mentorLogoPool).slice(0, 16).map((mentor) => ({
        company: mentor.company,
        companyLogo: mentor.companyLogo || null,
      })),
      adviceItems: item.adviceItems.slice(0, 3).map((advice) => ({
        adviceId: advice.adviceId,
        title: advice.title,
        currentDiagnosis: advice.currentDiagnosis || advice.problemSummary,
        action: advice.action || advice.actionSummary,
        mentorLens: advice.mentorLens || "",
        reason: advice.reason || "",
        mentorInsight: advice.mentorInsight || "",
        example: advice.example || "",
        hrPerspective: advice.hrPerspective || "",
        evidence: asArray(advice.evidence).slice(0, 3),
        targetSection: advice.targetSection || "overall",
        relatedProblemTags: asArray(advice.relatedProblemTags).slice(0, 4),
        priority: advice.priority || "medium",
        priorityLabel: advice.priorityLabel || (advice.priority === "high" ? "P0 必改" : advice.priority === "medium" ? "P1 建议改" : "P2 加分项"),
        source: advice.source || "db",
        mentorSource: advice.mentorSource || null,
      })),
      careerPathDisplay: item.careerPathDisplay || null,
    };
  }
  return {
    adviceId: item.adviceId,
    title: item.title,
    problemSummary: item.problemSummary,
    actionSummary: item.actionSummary,
  };
}

function formatPremiumUnlockedReport(internalAtsResult, paidAdviceOrMentorReport) {
  const checklist = internalAtsResult.priorityMissingKeywords.slice(0, 20).map((item) => ({
    term: item.term,
    priority: item.priority,
    category: item.category,
    safeToAdd: item.safeToAdd,
    whereToAdd: item.category === "hard_skill" ? "Experience - first relevant role" : "Summary or Skills",
    reason: item.reason,
  }));

  const sectionFixPlan = {
    summary: internalAtsResult.structuredSuggestions.filter((item) => item.targetSection === "summary"),
    skills: internalAtsResult.structuredSuggestions.filter((item) => item.targetSection === "skills"),
    experience: internalAtsResult.structuredSuggestions.filter((item) => item.targetSection === "experience"),
    projects: internalAtsResult.structuredSuggestions.filter((item) => item.targetSection === "projects"),
    education: internalAtsResult.structuredSuggestions.filter((item) => item.targetSection === "education"),
  };

  const mentorReport = Array.isArray(paidAdviceOrMentorReport) && paidAdviceOrMentorReport.some((item) => Array.isArray(item.adviceItems))
    ? { mentors: paidAdviceOrMentorReport }
    : paidAdviceOrMentorReport;

  if (mentorReport && Array.isArray(mentorReport.mentors)) {
    const allAdviceItems = asArray(mentorReport.allAdviceItems).length
      ? asArray(mentorReport.allAdviceItems)
      : mentorReport.mentors.flatMap((mentor) => asArray(mentor.adviceItems));
    const stripAdviceItem = (item) => ({
      adviceId: item.adviceId,
      title: item.title,
      problemSummary: item.problemSummary || item.currentDiagnosis,
      actionSummary: item.actionSummary || item.action,
      currentDiagnosis: item.currentDiagnosis || item.problemSummary,
      action: item.action || item.actionSummary,
      reason: item.reason || "",
      evidence: asArray(item.evidence).slice(0, 3),
      mentorInsight: item.mentorInsight,
      example: item.example,
      hrPerspective: item.hrPerspective,
      targetSection: item.targetSection || "overall",
      topicCluster: item.topicCluster || "",
      matchReason: item.matchReason || "",
      mentorFitType: item.mentorFitType || "",
      relatedProblemTags: asArray(item.relatedProblemTags).slice(0, 5),
      priority: item.priority || "medium",
      source: item.source,
      mentorSource: item.mentorSource || null,
    });
    return {
      mentors: mentorReport.mentors.slice(0, 4).map((mentor) => ({
        mentorId: mentor.mentorId,
        mentorName: mentor.mentorName,
        company: mentor.company,
        companyLogo: mentor.companyLogo || null,
        mentorTitle: mentor.mentorTitle,
        mentorSubtitle: mentor.mentorSubtitle,
        badges: asArray(mentor.badges).slice(0, 4),
        matchReason: mentor.matchReason,
        matchedProblems: asArray(mentor.matchedProblems).slice(0, 8),
        adviceItems: asArray(mentor.adviceItems).slice(0, 3).map(stripAdviceItem),
      })),
      allAdviceItems: allAdviceItems.slice(0, 12).map(stripAdviceItem),
      freeAdviceItems: allAdviceItems.slice(0, 3).map(stripAdviceItem),
      paidAdviceItems: allAdviceItems.slice(3, 12).map(stripAdviceItem),
      mentorLogoPool: asArray(mentorReport.mentorLogoPool).slice(0, 16).map((mentor) => ({
        company: mentor.company,
        companyLogo: mentor.companyLogo || null,
      })),
      coverageSummary: mentorReport.coverageSummary || {
        totalProblemsDetected: 0,
        problemsCovered: 0,
        coverageRatio: 1,
        coveredProblemTags: [],
        uncoveredProblemTags: [],
      },
      missingKeywordChecklist: checklist,
      sectionFixPlan,
    };
  }

  const paidAdvice = paidAdviceOrMentorReport;
  return {
    allMentorAdvice: asArray(paidAdvice).map((item) => ({
      adviceId: item.adviceId,
      title: item.title,
      problemSummary: item.problemSummary,
      actionSummary: item.actionSummary,
      mentorInsight: item.mentorInsight,
      example: item.example,
      mentorName: item.mentorName,
      topic: item.topic,
    })),
    missingKeywordChecklist: checklist,
    sectionFixPlan,
    detailedSuggestions: internalAtsResult.structuredSuggestions,
  };
}

function formatDebugReport(internalAtsResult, mentorCandidates = []) {
  return {
    internalAtsResult,
    metrics: internalAtsResult.metrics,
    problemTags: internalAtsResult.problemTags,
    retrievalQuery: internalAtsResult.retrievalQuery,
    mentorCandidates,
  };
}

function createReportId() {
  return `rpt_${crypto.randomBytes(9).toString("hex")}`;
}

function createReportAccessToken() {
  return `rat_${crypto.randomBytes(24).toString("base64url")}`;
}

module.exports = {
  SCORE_CAP_THRESHOLDS,
  buildInternalAtsResult,
  buildScores,
  buildScoreCaps,
  buildDimensions,
  buildProfile,
  buildDiagnostics,
  buildKeywordMatchV2,
  buildPriorityMissingKeywords,
  buildProblemTags,
  buildTopInsights,
  buildTopProblems,
  buildStructuredSuggestions,
  buildRetrievalQuery,
  buildMentorAdviceSlots,
  buildReportAssembly,
  buildLockedPreview,
  formatInternalAtsResult,
  formatPublicFreeReport,
  formatPremiumUnlockedReport,
  formatDebugReport,
  createReportId,
  createReportAccessToken,
};
