import { resolveResumeText, buildAtsReportPayload, logPublicAtsResponseForTesting } from '../../../lib/atsHelpers';
import { scoreResumeATS as scoreResumeSystem } from '../../../../src/ats/ats-scorer';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let file = null, jobTitle = '', jdText = '', resumeText = '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      file = formData.get('file');
      jobTitle = formData.get('jobTitle') || '';
      jdText = formData.get('jdText') || '';
      resumeText = formData.get('resumeText') || '';
    } else {
      const body = await request.json();
      jobTitle = body.jobTitle || '';
      jdText = body.jdText || '';
      resumeText = body.resumeText || '';
    }

    const userId = request.headers.get('x-user-id') || null;

    if (!jobTitle && !jdText) {
      return Response.json({ success: false, error: 'jobTitle or jdText is required' }, { status: 400 });
    }

    const resolvedText = await resolveResumeText(file, resumeText);
    const rawScoreResult = scoreResumeSystem(resolvedText, jobTitle, jdText);
    const report = await buildAtsReportPayload(rawScoreResult, { resumeText: resolvedText, jobTitle, jdText }, userId);

    const payload = {
      success: true,
      reportId: report.reportId,
      reportAccessToken: report.reportAccessToken,
      publicReport: report.publicReport,
      premiumMentors: report.premiumReport?.mentors || null,
      premiumAdviceItems: report.premiumReport?.allAdviceItems || null,
      mentorLogoPool: report.premiumReport?.mentorLogoPool || null,
      timestamp: new Date().toISOString(),
    };
    logPublicAtsResponseForTesting('score', payload);
    return Response.json(payload);
  } catch (err) {
    console.error('[ATS-Report] Error:', err.message);
    return Response.json({ success: false, error: err.message }, { status: 400 });
  }
}
