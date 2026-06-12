import { after } from 'next/server';
import { runAnalysisJob, startAnalysisJob } from '../../../lib/analysisJobs';

export const maxDuration = 300;

export async function POST(request) {
  try {
    const body = await request.json();
    const resumeText = body.resumeText || '';
    const jobTitle = body.jobTitle || '';
    const jdText = body.jdText || '';
    const fileName = body.fileName || '';
    const userId = request.headers.get('x-user-id') || body.userId || null;

    if (!resumeText) {
      return Response.json({ success: false, error: 'resumeText is required' }, { status: 400 });
    }
    if (!jobTitle && !jdText) {
      return Response.json({ success: false, error: 'jobTitle or jdText is required' }, { status: 400 });
    }

    const input = { resumeText, jobTitle, jdText, fileName, userId };
    const job = await startAnalysisJob(input);
    after(() => runAnalysisJob(job.jobId, input));
    return Response.json({ success: true, job }, { status: 202 });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 400 });
  }
}
