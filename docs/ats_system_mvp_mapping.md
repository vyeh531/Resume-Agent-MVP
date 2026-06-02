# ATS System to Resume-Agent-MVP Mapping

This spec defines how Resume-Agent-MVP should consume the hosted `ats_system` response without leaking paid or internal analysis content to free users.

## Product Boundary

`ats_system` is an internal teacher-facing ATS analysis and retrieval tool. It may return complete diagnostics, all problems, all suggestions, full keyword lists, retrieval hints, and report assembly metadata.

Resume-Agent-MVP is a user-facing paid product. It must not forward the hosted `ats_system` response directly to the browser. Resume-Agent-MVP should call hosted `ats_system` from its backend, store the complete response server-side, and return only the capped free report to the browser.

Payment unlocks more advice, not better advice. Free and paid advice use the same quality bar and ranking logic.

## Source Response Fields

Hosted `ats_system` `/api/v1/score` currently returns a full structured response with these relevant fields:

| Field | Description | MVP Handling |
| --- | --- | --- |
| `version` | ATS response version. | Free-visible metadata. |
| `scoringMode` | Scoring mode name. | Free-visible metadata. |
| `jobTitle` | Target job title. | Free-visible, sanitized. |
| `hasJD` | Whether a JD was provided. | Free-visible boolean. |
| `total` | Overall ATS score. | Free-visible. |
| `maxScore` | Max score, normally 100. | Server-only or omitted; UI can assume 100. |
| `risk` | Risk bucket. | Free-visible. |
| `formatPenaltyTriggered` | Whether format cap/penalty fired. | Server-only; may produce one visible problem if selected into top 3. |
| `improvement` | Score improvement estimate. | Server-only for now. |
| `dimensions` | Dimension scores and dimension problem lists. | Free-visible scores only; dimension problem lists are server-only. |
| `problems` | Raw human-readable problem list. | Server-only; select at most 3 into free report. |
| `suggestions` | Raw human-readable suggestions. | Server-only; select at most 3 into free report. |
| `topMissingKeywords` | Complete missing keyword preview. | Server-only; free response may include at most 3 preview terms. |
| `scores` | Composite UI scores. | Free-visible scores only. |
| `scoreCaps` | Applied scoring caps. | Server-only; useful for severity/ranking. |
| `profile` | Role, seniority, candidate type, market. | Server-only for retrieval; sanitized role label may be free-visible. |
| `diagnostics` | Searchability, job title, measurable-result diagnostics. | Server-only except sanitized job-title match if needed for one visible problem. |
| `keywordMatch` | Full keyword match and missing terms. | Server-only; free response may include at most 3 preview terms. |
| `problemTags` | Full structured problem tags. | Server-only; used for retrieval/ranking. |
| `topProblems` | Ranked structured problems. | Server-only; select at most 3 into free report. |
| `structuredSuggestions` | Typed suggestions with tags/keywords. | Server-only; select at most 3 text suggestions into free report. |
| `retrievalQuery` | Query hints for mentor advice retrieval. | Server-only. Never send to browser. |
| `mentorAdviceSlots` | Internal free/paid slot hints from ats_system. | Server-only. MVP owns its own free/paid gating. |
| `reportAssembly` | Internal section assembly hints. | Server-only. MVP owns its own free/paid report assembly. |

## MVP Internal Storage

After calling hosted `ats_system`, Resume-Agent-MVP should store the full response in DB/internal report state. This full object can be used for:

- deterministic advice retrieval
- problem coverage across 12 advice items
- P0/P1/P2 severity assignment
- paid unlock payload generation
- internal debug endpoints

The full hosted response must not be stored in browser localStorage or returned by the free score endpoint.

## Free Browser Response

The free response may include only:

- `reportId`
- `reportAccessToken`
- `publicReport.engine/version/scoringMode`
- `publicReport.jobTitle`
- `publicReport.hasJD`
- `publicReport.total`
- `publicReport.risk`
- `publicReport.scores`
- `publicReport.dimensions` with scores/labels only, no `problems`
- `publicReport.topProblems.slice(0, 3)` or equivalent 3 key problems
- `publicReport.problems.slice(0, 3)` if used by UI
- `publicReport.suggestions.slice(0, 3)`
- `publicReport.topMissingKw.slice(0, 3)` only as visible preview terms
- `publicReport.keywordBreakdown` capped to at most 3 visible terms total
- `publicReport.freeMentorAdvice.adviceItems.slice(0, 3)`
- `publicReport.lockedAdvicePreview` with counts/topic teasers only, no hidden advice bodies or extra problem text

Free browser response must not include:

- full `ats_system` response
- full `problemTags`
- full `topProblems`
- full `structuredSuggestions`
- full `topMissingKeywords`
- full `diagnostics.searchability`
- full `keywordMatch`
- `retrievalQuery`
- `scoreCaps`
- `mentorAdviceSlots`
- `reportAssembly`
- premium mentors
- paid advice items
- paid advice metadata
- extra hidden resume problems beyond the 3 visible ones

## Paid Unlock Response

The paid unlock endpoint may return:

- the complete 12 advice items, including the 3 free items
- mentor grouping and mentor logo pool
- full paid missing keyword checklist
- section fix plan
- broader problem coverage summary

It should still avoid returning debug-only objects unless an internal/debug endpoint is used.

## Backend Flow

Recommended flow:

1. Browser submits resume/JD to Resume-Agent-MVP `/api/v1/score`.
2. MVP backend resolves resume text and calls hosted `ats_system`.
3. MVP backend stores the full hosted response server-side.
4. MVP backend builds retrieval query from server-only fields.
5. MVP backend retrieves and ranks 12 same-quality advice items.
6. MVP backend saves full premium report server-side.
7. MVP backend returns only the free capped `publicReport`.
8. After payment validation, `/unlock` returns the full premium report.

Do not call hosted `ats_system` directly from the browser.

## Minimal Implementation Plan

When switching Resume-Agent-MVP to hosted `ats_system`, keep the runtime change narrow:

1. Add a backend-only `scoreWithHostedAtsSystem(input)` helper.
   - Reads `ATS_API_URL`.
   - Posts `resumeText`, `jobTitle`, `jdText`, and file metadata if available.
   - Returns the full hosted response.
   - Falls back to the local scorer only when the hosted call fails or is disabled.

2. Normalize hosted response into the existing MVP internal ATS shape.
   - Preserve full hosted response under a server-only field such as `hostedAtsResponse`.
   - Map hosted fields into existing internal fields used by `buildAtsReportPayload`.
   - Normalize ats_system tags using `problem_tag_contract.md`.

3. Keep the existing public/premium formatter boundary.
   - `formatPublicFreeReport` still performs the free 3+3+3 cap.
   - `formatPremiumUnlockedReport` still prepares paid unlock payload.
   - Do not return hosted `ats_system` response directly from `/api/v1/score`.

4. Keep frontend call path stable.
   - Browser continues calling Resume-Agent-MVP `/api/v1/score`.
   - Browser never calls hosted `ats_system`.

5. Add tests before enabling by default.
   - Hosted-like full response fixture goes into backend test.
   - Free score payload must not contain full hosted fields.
   - Paid unlock must still include all 12 advice items after payment validation.

Feature flag recommendation:

- `ATS_SOURCE=hosted|local`
- `ATS_API_URL=https://...`
- Default to `local` until hosted mapping tests pass.

## Test Strategy

Before enabling hosted `ats_system` for the result page, add tests for these boundaries:

### Free Score Response

Given a hosted-like ATS response containing full `problemTags`, `topProblems`, `structuredSuggestions`, `topMissingKeywords`, `diagnostics`, `keywordMatch`, `retrievalQuery`, `mentorAdviceSlots`, and `reportAssembly`:

- `/api/v1/score` returns `success`, `reportId`, `reportAccessToken`, and capped `publicReport`.
- Free payload contains at most 3 visible problems.
- Free payload contains at most 3 visible suggestions.
- Free payload contains exactly or at most 3 free mentor advice items, depending on available advice.
- Free payload contains at most 3 visible keyword preview terms.
- Free payload does not contain hosted-only fields.
- Free payload does not contain paid mentor/advice fields.

### Browser Storage

After submission:

- `localStorage.resumeFixMVP` contains only the free report, visible advice, report id, and report token.
- It does not contain full hosted response.
- It does not contain hidden problem tags or paid advice items.
- It does not contain premium mentor arrays before unlock.

### Paid Unlock

Before payment:

- `/unlock` returns `PAYMENT_REQUIRED`.

After payment validation:

- `/unlock` returns the full premium report.
- Premium report includes all 12 advice items.
- Premium report includes the first 3 free advice items plus the additional paid items.
- Advice quality/ranking source is the same as free advice; unlock only increases quantity.

### Internal Debug

Internal debug endpoints may expose full hosted response only when explicitly allowed by environment and access controls. Production public routes must not expose debug fields.

## Mapping Notes

`ats_system.problemTags` should be treated as the primary retrieval signal when available. If tags are missing or older, MVP may derive fallback tags from:

- `topProblems`
- `structuredSuggestions.relatedTags`
- `dimensions.*.problems`
- `diagnostics`
- `keywordMatch.summary`

Fallback extraction must stay server-side.

## Open Design Decisions

- Whether `all_china_experience` and `partial_china_experience` should become resume-edit tags or only severity/ranking signals.
- Whether `missing_gpa` and `missing_coursework` should stay under `education_details_missing` or become separate retrieval tags.
- Whether `passive_voice` and `repetitive_verbs` should become separate tags or map to `weak_action_verbs`.
- Whether `low_bullet_coverage` should become separate or map to `weak_experience_keyword_evidence`.
