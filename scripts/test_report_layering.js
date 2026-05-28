"use strict";

const assert = require("assert");
const { spawn } = require("child_process");
const path = require("path");
const db = require("../database");
const {
  formatInternalAtsResult,
  formatPublicFreeReport,
  buildLockedPreview,
} = require("../src/ats/report-formatter");
const {
  retrieveMentorAdvice,
  selectFreeAdvice,
  selectPaidAdvice,
  selectFreeMentorPlan,
  selectPremiumMentorPlan,
  buildLockedAdvicePreview,
  formatPublicFreeMentorAdvice,
  formatPremiumMentorReport,
  inferAdviceScope,
  inferAdviceIntent,
  isEligibleForAtsResumeReport,
} = require("../services/mentorAdviceRetrieval");

const ROOT = path.join(__dirname, "..");

const sampleResume = `
Jane Doe
jane@example.com | 555-123-4567 | linkedin.com/in/janedoe | github.io/janedoe

Summary
Software Engineer with experience building backend APIs, React applications, and cloud services.

Skills
JavaScript, TypeScript, Node.js, React, AWS, SQL, Docker, CI/CD

Experience
Software Engineer Intern, Example Co, New York, NY
- Built Node.js APIs serving 20,000 requests per day and reduced latency by 18%.
- Implemented React dashboards used by 12 internal users.
- Automated test workflows with GitHub Actions and improved deployment reliability by 25%.

Education
B.S. Computer Science, Example University, 2025
`;

const sampleJd = `
Software Development Engineer role requiring data structures, algorithms, object-oriented design,
AWS, microservices, code reviews, debugging, CI/CD, technical documentation, and collaboration.
`;

const accountingResume = `
Alex Chen
alex@example.com | 555-222-1111 | linkedin.com/in/alexchen

Summary
Entry-level accountant with internship experience in reconciliations, Excel reporting, and month-end close support.

Skills
Excel, QuickBooks, GAAP, Accounts Payable, Accounts Receivable, Tax, Reconciliation

Experience
Accounting Intern, Example CPA, New York, NY
- Reconciled bank statements and vendor accounts for monthly close.
- Prepared Excel reports tracking accounts payable and receivable aging.

Education
B.S. Accounting, Example University, 2025
`;

const accountingJd = `
Accounting role requiring Excel, QuickBooks, GAAP, accounts payable, accounts receivable,
bank reconciliation, financial reporting, tax preparation, bookkeeping, and audit support.
`;

function startServer(port, env = {}) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[server:${port}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[server:${port}:err] ${chunk}`));
  return child;
}

async function waitForHealth(port) {
  const url = `http://127.0.0.1:${port}/api/health`;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Server ${port} did not become healthy`);
}

async function stopServer(child) {
  if (!child || child.killed) return;
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
}

function assertNoLeak(publicReport) {
  const forbidden = [
    "metrics",
    "keywordMatch",
    "priorityMissingKeywords",
    "problemTags",
    "retrievalQuery",
    "dimensionProblems",
    "suggestions",
    "structuredSuggestions",
    "paidAdvice",
    "mentorCandidates",
    "rerankScores",
    "matched_reasons",
    "scoreCaps",
    "structuredSuggestions",
    "reportAssembly",
    "freeKeywordPreview",
    "freeStructuredSuggestion",
    "maxScore",
    "formatPenaltyTriggered",
  ];
  for (const key of forbidden) {
    assert.equal(Object.prototype.hasOwnProperty.call(publicReport, key), false, `publicReport leaked ${key}`);
  }
}

async function main() {
  const devPort = 3105;
  const prodPort = 3106;
  let devServer;
  let prodServer;

  try {
    devServer = startServer(devPort, { NODE_ENV: "development" });
    await waitForHealth(devPort);

    const scoreResponse = await fetch(`http://127.0.0.1:${devPort}/api/v1/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: sampleResume,
        jobTitle: "Software Development Engineer",
        jdText: sampleJd,
      }),
    });
    assert.equal(scoreResponse.status, 200);
    const scorePayload = await scoreResponse.json();
    assert.equal(scorePayload.success, true);
    assert.ok(scorePayload.reportId);
    assert.ok(scorePayload.reportAccessToken);
    assert.ok(scorePayload.publicReport);

    const publicReport = scorePayload.publicReport;
    for (const key of [
      "engine",
      "version",
      "scoringMode",
      "total",
      "risk",
      "scores",
      "dimensions",
      "diagnostics",
      "freeMentorAdvice",
      "lockedAdvicePreview",
    ]) {
      assert.ok(Object.prototype.hasOwnProperty.call(publicReport, key), `publicReport missing ${key}`);
    }
    assert.equal(publicReport.version, "0.2.0");
    assert.equal(publicReport.schemaVersion, "ats_response_v0.2.0");
    assert.ok(publicReport.topInsights.length || publicReport.topProblems.length);
    if (publicReport.risk === "高") {
      assert.equal(publicReport.topInsights.length, 0);
      assert.ok(publicReport.topProblems.length > 0);
    }
    const publicProblemKeys = publicReport.topProblems.map((item) => item.title);
    assert.equal(new Set(publicProblemKeys).size, publicProblemKeys.length);
    assertNoLeak(publicReport);
    assert.ok(publicReport.freeMentorAdvice.mentorId);
    assert.equal(publicReport.freeMentorAdvice.adviceItems.length, 3);
    assert.equal(publicReport.lockedAdvicePreview.lockedMentorCount, 3);
    assert.equal(publicReport.lockedAdvicePreview.lockedAdviceCount, 9);
    assert.equal(publicReport.lockedAdvicePreview.totalMentorCount, 4);
    assert.equal(publicReport.lockedAdvicePreview.totalAdviceCount, 12);
    assert.equal(Object.prototype.hasOwnProperty.call(publicReport, "premiumReport"), false);
    const freeAdviceText = [
      publicReport.freeMentorAdvice?.mentorName,
      ...(publicReport.freeMentorAdvice?.adviceItems || []).flatMap((item) => [
        item.title,
        item.problemSummary,
        item.actionSummary,
      ]),
    ].join(" ").toLowerCase();
    assert.equal(/favorite course|interview|面试|star|自我介绍/.test(freeAdviceText), false);

    const retrievalCandidates = retrieveMentorAdvice({
      roleFamily: "software_engineer",
      targetRole: "software_development_engineer",
      seniority: "entry_level",
      candidateType: "early_career",
      topics: ["keyword_alignment"],
      problemTags: ["low_jd_keyword_match", "low_hard_skill_match"],
      priorityKeywords: ["microservices", "code review"],
      filters: {
        roleFamily: ["software_engineer", "universal"],
        targetRoles: ["software_development_engineer", "software_engineer", "universal"],
        seniority: ["entry_level", "early_career", "universal"],
        topics: ["keyword_alignment"],
      },
    }, { limit: 10 });
    assert.ok(retrievalCandidates.length > 0);
    assert.ok(retrievalCandidates.some((card) => card.title === "不要一份简历投所有岗位"));
    const retrievedFreeAdvice = selectFreeAdvice(retrievalCandidates);
    assert.equal(retrievedFreeAdvice.title, "不要一份简历投所有岗位");
    assert.equal(selectFreeAdvice([]).source, "fallback");

    const interviewRow = {
      chunk_id: "interview_001",
      topic: "Candidate has one stock answer for what's your favorite course",
      L1: "面试准备",
      L2: "behavioral interview",
      P_mentor: "Candidate uses one stock answer for favorite course.",
      A_action: "Prepare multiple interview answers using STAR.",
      I_insight: "Mock interview practice matters.",
      HR_os: "Interview answer quality.",
      advice_type: "interview",
      role_family: "universal",
      target_roles: "universal",
      seniority: "universal",
      problem_tags: "low_jd_keyword_match",
      ats_dimensions: "D",
      keywords: "interview,favorite course,STAR",
    };
    assert.ok(["interview_prep", "behavioral_interview"].includes(inferAdviceScope(interviewRow)));
    assert.equal(isEligibleForAtsResumeReport(interviewRow), false);
    const unsafeSelectedAdvice = selectFreeAdvice([{
      adviceId: "interview_001",
      title: "Candidate has one stock answer for what's your favorite course",
      problemSummary: "Interview answer issue.",
      actionSummary: "Prepare STAR answers.",
      unlockTier: "free",
      safeToShowFree: true,
      adviceScope: "interview_prep",
      retrieval_score: 1,
      matched_reasons: [],
    }]);
    assert.equal(unsafeSelectedAdvice.source, "fallback");

    const highRiskAccountingQuery = {
      roleFamily: "accounting",
      targetRole: "accountant",
      problemTags: ["low_jd_keyword_match", "low_hard_skill_match"],
      priorityKeywords: ["reconciliation", "excel", "quickbooks"],
      queryText: "critical accounting low jd keyword match",
      filters: {
        roleFamily: ["accounting", "finance", "universal"],
        targetRoles: ["accountant", "accounting", "universal"],
        seniority: ["entry_level", "universal"],
      },
    };
    const timingRow = {
      topic: "3小时内投递提高回复率",
      L1: "求职策略",
      L2: "投递时间",
      P_mentor: "尽快投递可以提高被看到的概率。",
      A_action: "建议看到岗位后3小时内投递。",
      I_insight: "Application timing matters.",
      role_family: "universal",
      target_roles: "universal",
      seniority: "universal",
      problem_tags: "low_jd_keyword_match",
      ats_dimensions: "D",
      keywords: "resume,ATS,投递时间",
      unlock_tier: "free",
      safe_to_show_free: 1,
      chunk_id: "timing_001",
    };
    assert.equal(inferAdviceIntent(timingRow), "application_timing");
    const timingSelected = selectFreeAdvice([{
      adviceId: "timing_001",
      title: "3小时内投递提高回复率",
      problemSummary: "尽快投递可以提高被看到的概率。",
      actionSummary: "建议看到岗位后3小时内投递。",
      unlockTier: "free",
      safeToShowFree: true,
      adviceScope: "job_search_strategy",
      adviceIntent: "application_timing",
      retrieval_score: 1,
      matched_reasons: [],
    }], highRiskAccountingQuery);
    assert.equal(timingSelected.adviceId, "adv_free_accounting_positioning");
    assert.equal(timingSelected.title, "先让简历看起来像 Accounting 岗位");

    const accountingCandidates = retrieveMentorAdvice({
      roleFamily: "accounting",
      targetRole: "accountant",
      seniority: "entry_level",
      candidateType: "early_career",
      topics: ["keyword_alignment"],
      problemTags: ["low_jd_keyword_match", "missing_priority_keywords"],
      priorityKeywords: ["reconciliation", "excel", "quickbooks", "gaap", "accounts payable", "tax"],
      queryText: "entry_level accountant accounting keyword alignment",
      filters: {
        roleFamily: ["accounting", "finance", "universal"],
        targetRoles: ["accountant", "accounting", "universal"],
        seniority: ["entry_level", "early_career", "universal"],
        topics: ["keyword_alignment"],
      },
    }, { limit: 20 });
    const accountingFreeAdvice = selectFreeAdvice(accountingCandidates);
    const accountingPublicText = [
      accountingFreeAdvice.title,
      accountingFreeAdvice.problemSummary,
      accountingFreeAdvice.actionSummary,
    ].join(" ").toLowerCase();
    for (const techTerm of ["spring boot", "rest api", "redis", "react", "typescript", "pytorch", "backend", "frontend", "ai engineer"]) {
      assert.equal(accountingPublicText.includes(techTerm), false, `accounting advice leaked tech term ${techTerm}`);
    }
    assert.ok(accountingFreeAdvice.source === "fallback" || !accountingFreeAdvice.matched_reasons?.includes("conflicting_role_examples"));
    const accountingPaidAdvice = selectPaidAdvice(accountingCandidates, accountingFreeAdvice);
    assert.ok(accountingPaidAdvice.length <= 3);
    const accountingInternalForPlan = formatInternalAtsResult({
      engine: "rule-based",
      version: "0.2.0",
      jobTitle: "Accounting",
      hasJD: true,
      total: 45,
      risk: "高",
      dimensions: {
        D: { score: 1, max: 45 },
        F: { score: 3, max: 23 },
      },
      metrics: { checks: {}, keywordMatch: { hardSkillCoverage: 0.1 } },
    }, { jobTitle: "Accounting", jdText: accountingJd, resumeText: accountingResume });
    const freeMentorPlan = selectFreeMentorPlan(accountingCandidates, accountingInternalForPlan);
    const premiumMentorPlan = selectPremiumMentorPlan(accountingCandidates, accountingInternalForPlan, freeMentorPlan);
    assert.equal(freeMentorPlan.adviceItems.length, 3);
    assert.deepEqual(freeMentorPlan.adviceItems.map((item) => item.targetSection), ["summary", "skills", "experience"]);
    assert.equal(premiumMentorPlan.length, 4);
    assert.equal(premiumMentorPlan.reduce((sum, mentor) => sum + mentor.adviceItems.length, 0), 12);
    assert.equal(formatPublicFreeMentorAdvice(freeMentorPlan).adviceItems.length, 3);
    assert.equal(buildLockedAdvicePreview(premiumMentorPlan).lockedAdviceCount, 9);
    assert.ok(formatPremiumMentorReport(premiumMentorPlan, accountingInternalForPlan).coverageSummary);

    const accountingScoreResponse = await fetch(`http://127.0.0.1:${devPort}/api/v1/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: accountingResume,
        jobTitle: "Accounting",
        jdText: accountingJd,
      }),
    });
    assert.equal(accountingScoreResponse.status, 200);
    const accountingScorePayload = await accountingScoreResponse.json();
    assertNoLeak(accountingScorePayload.publicReport);
    const accountingResponseAdvice = accountingScorePayload.publicReport.freeMentorAdvice || {};
    const accountingResponseAdviceText = [
      accountingResponseAdvice.mentorName,
      ...(accountingResponseAdvice.adviceItems || []).flatMap((item) => [
        item.title,
        item.problemSummary,
        item.actionSummary,
      ]),
    ].join(" ").toLowerCase();
    assert.equal(/favorite course|interview|面试|star|自我介绍/.test(accountingResponseAdviceText), false);
    assert.equal(accountingResponseAdvice.adviceItems.length, 3);
    assert.deepEqual(accountingResponseAdvice.adviceItems.map((item) => item.targetSection), ["summary", "skills", "experience"]);
    assert.equal(accountingScorePayload.publicReport.lockedAdvicePreview.lockedMentorCount, 3);
    assert.equal(accountingScorePayload.publicReport.lockedAdvicePreview.lockedAdviceCount, 9);
    assert.equal(accountingScorePayload.publicReport.lockedAdvicePreview.totalMentorCount, 4);
    assert.equal(accountingScorePayload.publicReport.lockedAdvicePreview.totalAdviceCount, 12);
    for (const techTerm of ["tip out", "measured cycle", "whole cycle", "spring boot", "rest api", "redis", "react", "typescript", "pytorch", "backend", "frontend", "ai engineer"]) {
      assert.equal(accountingResponseAdviceText.includes(techTerm), false, `accounting public response leaked tech term ${techTerm}`);
    }
    assert.equal(/如[a-z]?\.\.\.$/i.test(accountingResponseAdviceText), false);
    assert.equal(/3\s*小时|三\s*小时|application timing|投递时间/.test(accountingResponseAdviceText), false);

    const placeholderInternal = formatInternalAtsResult({
      engine: "rule-based",
      version: "0.1.0",
      jobTitle: "根据 JD 分析",
      hasJD: true,
      total: 82,
      risk: "低",
      dimensions: {},
      metrics: { checks: {}, keywordMatch: {} },
      problemTags: [],
      priorityMissingKeywords: [],
    }, { jobTitle: "根据 JD 分析", jdText: "We need someone who can improve business operations." });
    assert.equal(placeholderInternal.jobTitle, "unknown");
    assert.equal(placeholderInternal.diagnostics.jobTitleMatch.targetTitle, "unknown");
    const placeholderPublic = formatPublicFreeReport(
      placeholderInternal,
      null,
      buildLockedPreview([])
    );
    assert.equal(placeholderPublic.jobTitle, "依 JD 自动识别");
    assert.equal(placeholderPublic.diagnostics.jobTitleMatch.targetTitle, "依 JD 自动识别");

    const legacyResponse = await fetch(`http://127.0.0.1:${devPort}/api/v1/ats/rule-local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: sampleResume,
        jobTitle: "Software Development Engineer",
        jdText: sampleJd,
      }),
    });
    assert.equal(legacyResponse.status, 200);
    const legacyPayload = await legacyResponse.json();
    assert.ok(legacyPayload.reportId);
    assertNoLeak(legacyPayload.data);

    const saved = db.getAtsReport(scorePayload.reportId);
    assert.ok(saved);
    assert.ok(saved.internalAtsResult.retrievalQuery);
    assert.ok(saved.internalAtsResult.scoreCaps);
    assert.ok(saved.internalAtsResult.structuredSuggestions);
    assert.ok(saved.internalAtsResult.reportAssembly);
    assert.ok(saved.paidAdvice.length > 0);
    assert.equal(saved.publicReport.freeMentorAdvice.adviceItems.length, 3);
    assert.equal(saved.premiumReport.mentors.length, 4);
    assert.equal(saved.premiumReport.mentors.reduce((sum, mentor) => sum + mentor.adviceItems.length, 0), 12);
    assert.ok(saved.premiumReport.coverageSummary);

    const reloadResponse = await fetch(
      `http://127.0.0.1:${devPort}/api/v1/reports/${scorePayload.reportId}/public?reportAccessToken=${encodeURIComponent(scorePayload.reportAccessToken)}`
    );
    assert.equal(reloadResponse.status, 200);
    const reloadPayload = await reloadResponse.json();
    assertNoLeak(reloadPayload.publicReport);

    const unpaidResponse = await fetch(`http://127.0.0.1:${devPort}/api/v1/reports/${scorePayload.reportId}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportAccessToken: scorePayload.reportAccessToken }),
    });
    assert.equal(unpaidResponse.status, 402);
    const unpaidPayload = await unpaidResponse.json();
    assert.equal(unpaidPayload.error, "PAYMENT_REQUIRED");

    db.markAtsReportPaid(scorePayload.reportId, true);
    const paidResponse = await fetch(`http://127.0.0.1:${devPort}/api/v1/reports/${scorePayload.reportId}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportAccessToken: scorePayload.reportAccessToken }),
    });
    assert.equal(paidResponse.status, 200);
    const paidPayload = await paidResponse.json();
    assert.equal(paidPayload.premiumReport.mentors.length, 4);
    assert.equal(paidPayload.premiumReport.mentors.reduce((sum, mentor) => sum + mentor.adviceItems.length, 0), 12);
    assert.ok(paidPayload.premiumReport.coverageSummary);
    assert.ok(paidPayload.premiumReport.missingKeywordChecklist);

    prodServer = startServer(prodPort, { NODE_ENV: "production" });
    await waitForHealth(prodPort);
    const debugResponse = await fetch(`http://127.0.0.1:${prodPort}/api/v1/reports/${scorePayload.reportId}/debug`);
    assert.ok([403, 404].includes(debugResponse.status));

    console.log("report layering tests passed");
  } finally {
    await stopServer(prodServer);
    await stopServer(devServer);
    db.closeDB?.();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
