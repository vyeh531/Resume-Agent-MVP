import db from '../../database';
import { buildAtsReportPayload, scoreWithHostedFirst } from './atsHelpers';

export async function getAnalysisJob(jobId) {
  return db.getAnalysisJob(jobId);
}

export async function startAnalysisJob({ jobId, resumeText, jobTitle, fileName, userId = null } = {}) {
  return db.createAnalysisJob({
    jobId,
    userId,
    fileName: fileName || '',
    jobTitle: jobTitle || '',
  });
}

export async function runAnalysisJob(jobId, { resumeText, jobTitle, jdText, fileName, userId = null } = {}) {
  let currentProgress = 5;
  try {
    currentProgress = 25;
    await db.updateAnalysisJob(jobId, { status: 'running', stage: 'scoring', progress: currentProgress });
    const scoreResult = await scoreWithHostedFirst({
      resumeText,
      jobTitle,
      jdText,
      fileName: fileName || '',
    });

    currentProgress = 65;
    await db.updateAnalysisJob(jobId, { stage: 'retrieving_advice', progress: currentProgress, source: scoreResult.source });
    const report = await buildAtsReportPayload(
      scoreResult.rawScoreResult,
      { resumeText, jobTitle, jdText },
      userId
    );

    const result = {
      success: true,
      source: scoreResult.source,
      reportId: report.reportId,
      reportAccessToken: report.reportAccessToken,
      publicReport: report.publicReport,
      warning: scoreResult.warning || undefined,
      timestamp: new Date().toISOString(),
    };
    await db.completeAnalysisJob(jobId, result, scoreResult.source);
    return result;
  } catch (error) {
    await db.failAnalysisJob(jobId, error, currentProgress);
    console.error('[Analysis Job] failed', jobId, error.message);
    return null;
  }
}
