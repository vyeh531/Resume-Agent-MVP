import { scoreWithHostedAtsSystem } from './hostedAtsSystem.mjs';
import { scoreResumeATS as scoreResumeSystem } from '../../src/ats/ats-scorer.js';
import {
  createReportAccessToken,
  createReportId,
  formatDebugReport,
  formatInternalAtsResult,
  formatPremiumUnlockedReport,
  formatPublicFreeReport,
} from '../../src/ats/report-formatter';
import {
  retrieveMentorAdvice,
  selectFreeMentorPlan,
  selectPremiumMentorPlan,
  buildLockedAdvicePreview,
  formatPublicFreeMentorAdvice,
  formatPremiumMentorReport,
  retrieveInsiderTips,
  buildGeneralInsiderTips,
} from '../../services/mentorAdviceRetrieval';
import { parsePDF, parseDocx } from '../../file-parser';
import db from '../../database';

export async function resolveResumeText(file, bodyResumeText) {
  if (bodyResumeText) return bodyResumeText;
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'pdf') return await parsePDF(buffer);
    if (ext === 'docx') return await parseDocx(buffer);
    if (ext === 'txt') return buffer.toString('utf-8');
    throw new Error('不支援的檔案格式：' + ext);
  }
  throw new Error('請提供 resumeText 或上傳 file');
}

function logRetrievalDebug({
  reportContext,
  mentorCandidateCount,
  strictCandidateCount,
  fallbackCandidateCount,
  selectedFreeAdviceId,
  paidAdviceCount,
  roleMismatchPenalty,
  selectedScope,
  rawRows,
  eligibleRows,
  excludedInterviewAdvice,
}) {
  if (process.env.LOG_ATS_RETRIEVAL_DEBUG === 'false') return;
  console.log('[Advice Retrieval]', JSON.stringify({
    reportContext,
    rawRows,
    eligibleRows,
    candidates: mentorCandidateCount,
    strictCandidates: strictCandidateCount,
    fallbackCandidates: fallbackCandidateCount,
    selectedFreeAdvice: selectedFreeAdviceId,
    selectedScope,
    excludedInterviewAdvice,
    paidAdvice: paidAdviceCount,
    roleMismatchPenalty,
  }));
}

function logAdvicePlan(freeMentorPlan, premiumMentorPlan = [], coverageSummary = {}) {
  if (process.env.LOG_ATS_RETRIEVAL_DEBUG === 'false') return;
  const allAdviceCount = premiumMentorPlan.reduce((sum, mentor) => sum + (mentor.adviceItems?.length || 0), 0);
  const freeAdviceSources = (freeMentorPlan?.adviceItems || []).map((item) => item.source || 'db');
  console.log('[Advice Plan]', JSON.stringify({
    freeMentor: freeMentorPlan?.mentorId || null,
    freeAdviceCount: freeMentorPlan?.adviceItems?.length || 0,
    freeAdviceSources,
    roleSafeRejected: freeMentorPlan?.debug?.roleSafeRejected || 0,
    premiumMentors: premiumMentorPlan.length,
    premiumAdviceCount: allAdviceCount,
    lockedAdviceCount: Math.max(0, allAdviceCount - (freeMentorPlan?.adviceItems?.length || 0)),
    coverageRatio: coverageSummary.coverageRatio ?? 0,
    coveredProblemTags: coverageSummary.coveredProblemTags || [],
    uncoveredProblemTags: coverageSummary.uncoveredProblemTags || [],
  }));
}

export function logPublicAtsResponseForTesting(label, payload) {
  if (process.env.LOG_ATS_PUBLIC_RESPONSE === 'false') return;
  const loggedPayload = {
    ...payload,
    reportAccessToken: payload.reportAccessToken ? '[REDACTED]' : payload.reportAccessToken,
  };
  console.log(`\n[ATS Public Response][${label}]`);
  console.log(JSON.stringify(loggedPayload, null, 2));
  console.log('[/ATS Public Response]\n');
}

export async function buildAtsReportPayload(rawScoreResult, input, userId = null) {
  const startedAt = Date.now();
  const timings = [];
  const mark = (label) => timings.push([label, Date.now() - startedAt]);
  const internalAtsResult = formatInternalAtsResult(rawScoreResult, input);
  mark('format_internal_ats');
  const retrievalQuery = internalAtsResult.retrievalQuery;
  let mentorCandidates = [];
  try {
    mentorCandidates = await retrieveMentorAdvice(retrievalQuery);
  } catch (error) {
    console.warn('[Advice Retrieval] unavailable, using fallback advice:', error.message);
    mentorCandidates = [];
    Object.defineProperty(mentorCandidates, 'debug', {
      enumerable: false,
      value: {
        strictCandidates: 0,
        fallbackCandidates: 0,
        rawRows: 0,
        eligibleRows: 0,
        excludedInterviewAdvice: 0,
        maxRoleMismatchPenalty: 0,
        selectedScope: 'offline_fallback',
        retrievalQuery,
      },
    });
  }
  mark('retrieve_mentor_advice');
  const freeMentorPlan = selectFreeMentorPlan(mentorCandidates, internalAtsResult);
  const premiumMentorPlan = selectPremiumMentorPlan(mentorCandidates, internalAtsResult, freeMentorPlan);
  mark('select_mentor_plan');
  const freeAdvice = formatPublicFreeMentorAdvice(freeMentorPlan, internalAtsResult);
  const paidAdvice = premiumMentorPlan.slice(1);
  const premiumMentorReport = formatPremiumMentorReport(premiumMentorPlan, internalAtsResult);
  let companyInsiderTips = [];
  try {
    companyInsiderTips = await retrieveInsiderTips({ internalAtsResult, limit: 4 });
  } catch (error) {
    console.warn('[Insider Tips] unavailable, using general fallback:', error.message);
    companyInsiderTips = buildGeneralInsiderTips(internalAtsResult.retrievalQuery || {}, 4);
  }
  if (!Array.isArray(companyInsiderTips) || companyInsiderTips.length < 1) {
    companyInsiderTips = buildGeneralInsiderTips(internalAtsResult.retrievalQuery || {}, 4);
  }
  mark('format_reports');
  logRetrievalDebug({
    reportContext: input?.jobTitle || rawScoreResult.jobTitle || 'unknown',
    mentorCandidateCount: mentorCandidates.length,
    strictCandidateCount: mentorCandidates.debug?.strictCandidates ?? 0,
    fallbackCandidateCount: mentorCandidates.debug?.fallbackCandidates ?? 0,
    selectedFreeAdviceId: freeAdvice?.mentorId || null,
    paidAdviceCount: paidAdvice.reduce((sum, mentor) => sum + (mentor.adviceItems?.length || 0), 0),
    roleMismatchPenalty: mentorCandidates.debug?.maxRoleMismatchPenalty ?? 0,
    selectedScope: mentorCandidates.debug?.selectedScope || 'mentor_plan',
    rawRows: mentorCandidates.debug?.rawRows ?? 0,
    eligibleRows: mentorCandidates.debug?.eligibleRows ?? 0,
    excludedInterviewAdvice: mentorCandidates.debug?.excludedInterviewAdvice ?? 0,
  });
  const lockedPreview = buildLockedAdvicePreview(premiumMentorPlan, internalAtsResult);
  const publicReport = formatPublicFreeReport(internalAtsResult, freeAdvice, lockedPreview);
  const premiumReport = {
    ...formatPremiumUnlockedReport(internalAtsResult, premiumMentorReport),
    companyInsiderTips,
  };
  mark('format_public_premium');
  logAdvicePlan(freeMentorPlan, premiumMentorPlan, premiumReport.coverageSummary);
  const reportId = createReportId();
  const reportAccessToken = createReportAccessToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

  const resumeText = input?.resumeText || null;
  const resumeBullets = resumeText ? db.extractBullets(resumeText) : [];

  await db.saveAtsReport({
    reportId,
    reportAccessToken,
    expiresAt,
    jobTitle: internalAtsResult.jobTitle,
    hasJD: internalAtsResult.hasJD,
    total: internalAtsResult.total,
    risk: internalAtsResult.risk,
    publicReport,
    internalAtsResult,
    retrievalQuery,
    mentorCandidates,
    freeAdvice: freeMentorPlan,
    paidAdvice,
    premiumReport,
    paymentStatus: 'unpaid',
    userId,
    resumeText,
    resumeBullets,
  });
  mark('save_report');

  console.log('[ATS Report Build Timing]', JSON.stringify({
    totalMs: Date.now() - startedAt,
    timings: Object.fromEntries(timings),
    candidateCount: mentorCandidates.length,
    reportContext: input?.jobTitle || rawScoreResult.jobTitle || 'unknown',
  }));

  return {
    reportId,
    reportAccessToken,
    publicReport,
    internalAtsResult,
    mentorCandidates,
    freeAdvice: freeMentorPlan,
    paidAdvice,
    premiumReport,
  };
}

export async function scoreWithHostedFirst(input = {}) {
  try {
    const hosted = await scoreWithHostedAtsSystem(input);
    return {
      rawScoreResult: hosted.rawScoreResult,
      source: 'hosted-api',
      warning: null,
    };
  } catch (error) {
    const warning = error?.message || 'Hosted ATS API unavailable';
    console.warn('[ATS-System] Hosted API unavailable, using local fallback:', warning);
    const local = scoreResumeSystem(input.resumeText || '', input.jobTitle || '', input.jdText || '');
    return {
      rawScoreResult: {
        ...local,
        engine: local.engine || 'ats-system-local-fallback',
        source: 'local-fallback',
        fallbackReason: warning,
      },
      source: 'local-fallback',
      warning,
    };
  }
}
