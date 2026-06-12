import { getAnalysisJob } from '../../../../lib/analysisJobs';

export const maxDuration = 30;

export async function GET(_request, { params }) {
  const { jobId } = await params;
  const job = await getAnalysisJob(jobId);
  if (!job) {
    return Response.json({ success: false, error: 'JOB_NOT_FOUND' }, { status: 404 });
  }
  return Response.json({ success: true, job });
}
