import { scoreResumeATS as scoreResumeSystem } from '../../src/ats/ats-scorer';
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
} from '../../services/mentorAdviceRetrieval';
import { parsePDF, parseDocx } from '../../file-parser';
import db from '../../database';

export async function resolveResumeText(file, bodyResumeText) {
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'pdf') return await parsePDF(buffer);
    if (ext === 'docx') return await parseDocx(buffer);
    if (ext === 'txt') return buffer.toString('utf-8');
    throw new Error('不支援的檔案格式：' + ext);
  }
  if (bodyResumeText) return bodyResumeText;
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
  const internalAtsResult = formatInternalAtsResult(rawScoreResult, input);
  const retrievalQuery = internalAtsResult.retrievalQuery;
  const mentorCandidates = await retrieveMentorAdvice(retrievalQuery);
  const freeMentorPlan = selectFreeMentorPlan(mentorCandidates, internalAtsResult);
  const premiumMentorPlan = selectPremiumMentorPlan(mentorCandidates, internalAtsResult, freeMentorPlan);
  const freeAdvice = formatPublicFreeMentorAdvice(freeMentorPlan, internalAtsResult);
  const paidAdvice = premiumMentorPlan.slice(1);
  const premiumMentorReport = formatPremiumMentorReport(premiumMentorPlan, internalAtsResult);
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
  const premiumReport = formatPremiumUnlockedReport(internalAtsResult, premiumMentorReport);
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
