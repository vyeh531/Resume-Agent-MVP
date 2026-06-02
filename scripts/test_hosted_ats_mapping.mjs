import assert from 'assert';
import { normalizeHostedAtsScoreResult } from '../app/lib/hostedAtsSystem.js';

const hostedPayload = {
  success: true,
  data: {
    version: 'ats_v0.2.0',
    scoringMode: 'external_ats_like',
    jobTitle: 'Machine Learning Engineer',
    hasJD: true,
    total: 61,
    risk: '中',
    dimensions: {
      A: { score: 7, max: 8, label: 'Format', problems: ['date issue'] },
      D: { score: 18, max: 45, label: 'JD Match', problems: ['keyword issue'] },
    },
    diagnostics: {
      jobTitleMatch: { exactMatch: false, targetTitle: 'Machine Learning Engineer' },
    },
    keywordMatch: {
      summary: { hardSkillCoverage: 0.25, overallKeywordCoverage: 0.4 },
      priorityMissingKeywords: [{ term: 'PyTorch', priority: 'must_have' }],
    },
    problemTags: [{ tag: 'keyword_gap_major', severity: 'high', dimension: 'D', topic: 'keyword_alignment' }],
    topProblems: [{ title: 'Keyword gap', message: 'Missing ML keywords' }],
    structuredSuggestions: [{ message: 'Add ML evidence', relatedTags: ['keyword_gap_major'] }],
    retrievalQuery: { problemTags: ['keyword_gap_major'] },
    mentorAdviceSlots: { free: { count: 1 }, paid: { count: 3 } },
    reportAssembly: { freeSections: ['ats_score'], paidSections: ['all_mentor_advice'] },
    topMissingKeywords: ['PyTorch', 'TensorFlow', 'model deployment', 'RAG'],
    problems: ['problem 1', 'problem 2'],
    suggestions: ['suggestion 1', 'suggestion 2'],
  },
};

const normalized = normalizeHostedAtsScoreResult(hostedPayload);

assert.equal(normalized.engine, 'ats-system-api');
assert.equal(normalized.source, 'hosted-api');
assert.equal(normalized.jobTitle, 'Machine Learning Engineer');
assert.equal(normalized.hasJD, true);
assert.equal(normalized.total, 61);
assert.equal(normalized.dimensions.A.score, 7);
assert.equal(normalized.dimensions.A.problems, undefined);
assert.deepEqual(normalized.dimensionProblems.A, ['date issue']);
assert.equal(normalized.metrics.keywordMatch.summary.hardSkillCoverage, 0.25);
assert.equal(normalized.problemTags[0].tag, 'keyword_gap_major');
assert.equal(normalized.topMissingKeywords.length, 4);
assert.equal(normalized.hostedAtsResponse.retrievalQuery.problemTags[0], 'keyword_gap_major');

console.log('hosted ATS mapping tests passed');
