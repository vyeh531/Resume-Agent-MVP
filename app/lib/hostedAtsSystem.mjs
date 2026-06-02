const DEFAULT_ATS_API_URL = 'https://ats-system-wec6.onrender.com/api/v1/score';
const DEFAULT_TIMEOUT_MS = 30000;

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

export function getHostedAtsConfig(env = process.env) {
  return {
    source: env.ATS_SOURCE || 'local',
    apiUrl: normalizeUrl(env.ATS_API_URL || DEFAULT_ATS_API_URL),
    apiKey: env.ATS_API_KEY || '',
    timeoutMs: Number(env.ATS_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };
}

function unwrapHostedPayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  return payload.data || payload.publicReport || payload;
}

function splitDimensionProblems(dimensions = {}) {
  const dimensionProblems = {};
  const cleanDimensions = {};
  for (const [key, value] of Object.entries(dimensions || {})) {
    dimensionProblems[key] = Array.isArray(value?.problems) ? value.problems : [];
    cleanDimensions[key] = {
      score: value?.score || 0,
      max: value?.max || 0,
      label: value?.label || key,
    };
  }
  return { cleanDimensions, dimensionProblems };
}

export function normalizeHostedAtsScoreResult(payload) {
  const hosted = unwrapHostedPayload(payload);
  const { cleanDimensions, dimensionProblems } = splitDimensionProblems(hosted.dimensions);
  const keywordMatch = hosted.keywordMatch || hosted.metrics?.keywordMatch || {};
  const metrics = {
    ...(hosted.metrics || {}),
    jdMatchRatio: hosted.metrics?.jdMatchRatio ?? hosted.jdMatchRatio ?? hosted.keywordMatch?.summary?.overallKeywordCoverage ?? null,
    keywordMatch,
    checks: hosted.metrics?.checks || {},
  };

  return {
    engine: hosted.engine || 'ats-system-api',
    source: 'hosted-api',
    version: hosted.version,
    scoringMode: hosted.scoringMode,
    jobTitle: hosted.jobTitle || null,
    hasJD: Boolean(hosted.hasJD),
    total: hosted.total || hosted.scores?.overall?.score || 0,
    maxScore: hosted.maxScore || 100,
    risk: hosted.risk || hosted.scores?.overall?.risk || '中',
    formatPenaltyTriggered: Boolean(hosted.formatPenaltyTriggered),
    improvement: hosted.improvement || '',
    dimensions: cleanDimensions,
    dimensionProblems,
    scores: hosted.scores || null,
    scoreCaps: hosted.scoreCaps || null,
    profile: hosted.profile || null,
    diagnostics: hosted.diagnostics || null,
    keywordMatch,
    metrics,
    problemTags: hosted.problemTags || [],
    topProblems: hosted.topProblems || [],
    structuredSuggestions: hosted.structuredSuggestions || [],
    retrievalQuery: hosted.retrievalQuery || null,
    mentorAdviceSlots: hosted.mentorAdviceSlots || null,
    reportAssembly: hosted.reportAssembly || null,
    topMissingKeywords: hosted.topMissingKeywords || hosted.topMissingKw || [],
    problems: hosted.problems || [],
    suggestions: hosted.suggestions || [],
    hostedAtsResponse: hosted,
  };
}

export async function callHostedAtsSystem({ resumeText, jobTitle, jdText, fileName } = {}, config = getHostedAtsConfig()) {
  if (!config.apiUrl) throw new Error('ATS_API_URL is not configured');
  if (!config.apiKey) throw new Error('ATS_API_KEY is not configured');
  if (!resumeText) throw new Error('resumeText is required');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const body = { resumeText };
  if (jobTitle) body.jobTitle = jobTitle;
  if (jdText) body.jdText = jdText;
  if (fileName) body.fileName = fileName;

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`ATS API returned non-JSON (${response.status})`);
    }
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error || `ATS API failed with status ${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export async function scoreWithHostedAtsSystem(input, config = getHostedAtsConfig()) {
  const payload = await callHostedAtsSystem(input, config);
  return {
    hostedAtsResponse: unwrapHostedPayload(payload),
    rawScoreResult: normalizeHostedAtsScoreResult(payload),
  };
}
