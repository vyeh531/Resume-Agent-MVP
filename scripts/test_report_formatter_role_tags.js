"use strict";

const assert = require("assert");
const {
  formatInternalAtsResult,
  formatPublicFreeReport,
} = require("../src/ats/report-formatter");

function makeBaseRaw(problemTags, profile) {
  return {
    engine: "ats-system-api",
    version: "ats_v0.2.0",
    jobTitle: profile.jobTitle,
    hasJD: true,
    total: 48,
    risk: "high",
    dimensions: {
      A: { score: 2, max: 8 },
      B: { score: 3, max: 7 },
      C: { score: 5, max: 12 },
      D: { score: 8, max: 45 },
      E: { score: 3, max: 5 },
      F: { score: 6, max: 23 },
    },
    diagnostics: {
      jobTitleMatch: { exactMatch: false, targetTitle: profile.jobTitle, severity: "high" },
    },
    keywordMatch: {
      summary: { hardSkillCoverage: 0.2, overallKeywordCoverage: 0.2 },
    },
    metrics: {
      keywordMatch: { matchMethod: { hardCoverage: 20, combinedKeywordCoverage: 20 } },
      checks: { exactJobTitle: { exact: false, targetTitle: profile.jobTitle } },
      quantifiedCount: 1,
    },
    profile: {
      roleFamily: profile.roleFamily,
      targetRole: profile.targetRole,
      seniority: "unknown",
      candidateType: "unknown",
    },
    problemTags,
    topMissingKeywords: [],
    problems: [],
    suggestions: [],
  };
}

const mle = formatInternalAtsResult(makeBaseRaw([
  { tag: "keyword_gap_critical", severity: "high", dimension: "D", topic: "keyword_alignment", retrievalWeight: 0.9 },
  { tag: "role_mismatch", severity: "medium", dimension: "F", topic: "role_fit", retrievalWeight: 0.6 },
  { tag: "missing_gpa", severity: "medium", dimension: "B", topic: "education_completeness", retrievalWeight: 0.4 },
  { tag: "missing_coursework", severity: "medium", dimension: "B", topic: "education_completeness", retrievalWeight: 0.35 },
  { tag: "outdated_resume", severity: "medium", dimension: "A", topic: "resume_maintenance", retrievalWeight: 0.55 },
  { tag: "missing_github_link", severity: "medium", dimension: "B", topic: "code_links", retrievalWeight: 0.62 },
  { tag: "low_bullet_coverage", severity: "medium", dimension: "C", topic: "experience_rewrite", retrievalWeight: 0.5 },
], {
  jobTitle: "Machine Learning Engineer",
  roleFamily: "machine_learning",
  targetRole: "machine_learning_engineer",
}), { jobTitle: "Machine Learning Engineer" });

assert.equal(
  mle.problemTags.filter((item) => item.tag === "education_details_missing").length,
  1,
  "normalized duplicate education tags should be deduped"
);
assert.ok(
  mle.retrievalQuery.problemTags.includes("missing_github_link"),
  "retrieval query should retain role-specific code link tag"
);

const designer = formatInternalAtsResult(makeBaseRaw([
  { tag: "missing_portfolio", severity: "high", dimension: "B", topic: "portfolio_links", retrievalWeight: 0.88 },
  { tag: "keyword_gap_critical", severity: "high", dimension: "D", topic: "keyword_alignment", retrievalWeight: 0.9 },
], {
  jobTitle: "Graphic Designer",
  roleFamily: "design_creative",
  targetRole: "graphic_designer",
}), { jobTitle: "Graphic Designer" });

const publicReport = formatPublicFreeReport(designer, { mentorId: "m", mentorName: "M", adviceItems: [] }, {});
assert.ok(
  publicReport.topProblems.some((item) => item.title === "缺少作品集链接"),
  "Graphic Designer public problems should show portfolio-specific copy"
);

console.log("report formatter role tag tests passed");
