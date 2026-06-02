# Problem Tag Contract v1

This contract defines the stable issue tags shared by ATS analysis, segment tagging, and advice retrieval.

## Response Shape

ATS responses may emit `problemTags` as objects:

```json
{
  "tag": "missing_portfolio",
  "dimension": "B_contact",
  "topic": "portfolio_links",
  "severity": "p1",
  "evidence": ["No portfolio URL found for a design role."]
}
```

`tag` is the retrieval key. `dimension` and `topic` are fallback grouping signals only.

## Retrieval Rules

- Result-page advice retrieval must prefer `retrieval_scope = resume_edit`.
- Precise tags should outrank broad dimensions such as `A_format`, `B_contact`, or `D_keyword_match`.
- If a precise tag is unavailable, retrieval may fall back to topic/dimension regex.
- Free responses must only include the public report and free advice.
- Paid mentor items, full advice lists, and premium reports must be returned only by the unlock endpoint after payment is validated.
- Free and paid advice should use the same quality bar and ranking logic. Payment unlocks more advice, not better advice.
- Free browser-visible data is capped to three key problems, three priority suggestions, and three mentor advice items. Do not include additional problem tags, full missing-keyword lists, searchability diagnostics, or paid advice metadata in the free response.

## Tag Definitions

| Tag | Use When | Do Not Use When |
| --- | --- | --- |
| `uploaded_non_pdf_format` | The submitted file is Word, text, or another non-PDF format, or the segment specifically warns against Word submission. | The user submitted a PDF but layout quality is weak. |
| `file_naming_issue` | The resume filename is unprofessional, unclear, or not role/name specific. | The issue is only resume content. |
| `formatting_penalty_triggered` | ATS parsing/layout checks detect unreadable formatting, tables, columns, garbled text, or parser failure risk. | The only issue is Word-vs-PDF submission. |
| `missing_section_dates` | Experience, education, projects, or other dated sections are missing dates. | Dates exist but use inconsistent style. |
| `inconsistent_date_format` | Dates exist but use inconsistent formats or ordering. | Dates are missing entirely. |
| `missing_contact_info` | Required contact fields are missing, such as email or phone. | The only missing link is portfolio, GitHub, or LinkedIn. |
| `missing_linkedin` | LinkedIn is expected for the target market/role and missing. | The resume has a valid LinkedIn URL. |
| `missing_portfolio` | Design, creative, UX/UI, product design, content, or portfolio-driven roles lack a portfolio/personal site/Behance/Dribbble link. | The advice mainly says to submit PDF, or the role does not naturally require a portfolio. |
| `missing_github_link` | Software, data, ML, AI, analytics engineering, or technical roles lack GitHub/repo/demo evidence where expected. | The issue is a creative portfolio rather than code evidence. |
| `education_details_missing` | Education lacks important details such as GPA, coursework, degree, graduation date, or school metadata. | The advice is about role positioning or job search strategy. |
| `missing_exact_job_title` | Summary/header does not include the exact target job title or close canonical title. | The title is present but supporting evidence is weak. |
| `weak_summary_role_alignment` | Professional Summary exists but does not clearly align with the target role. | The problem is only JD keyword coverage outside Summary. |
| `weak_target_role_alignment` | Resume positioning is broadly unclear for the target role. | A more precise tag applies, such as `missing_exact_job_title` or `weak_summary_role_alignment`. |
| `generic_resume_positioning` | One generic resume is being used across materially different roles. | The resume is tailored but missing specific keywords. |
| `resume_not_tailored_to_jd` | Resume content does not reflect the specific JD responsibilities/wording. | No JD was provided. |
| `low_jd_keyword_match` | Overall JD keyword match is low. | The issue is only a single missing link or formatting item. |
| `missing_priority_keywords` | Specific important JD keywords are absent. | Keywords are present but only in Skills. |
| `low_hard_skill_match` | Required tools, methods, technologies, or hard skills are missing. | The gap is about soft skills only. |
| `low_soft_skill_match` | Required collaboration, communication, leadership, or stakeholder skills are missing. | The gap is technical skill coverage. |
| `weak_experience_keyword_evidence` | Required keywords are not supported in Experience/Projects bullets. | The keyword is simply missing everywhere. |
| `keywords_only_in_skills` | Keywords appear only in Skills and not in evidence bullets. | Keywords appear in experience with concrete evidence. |
| `low_measurable_results` | Bullets lack metrics, scale, outcomes, or quantified impact. | The action verb itself is the main issue. |
| `weak_action_verbs` | Bullets rely on weak/passive verbs such as "responsible for" or "participated in". | The verbs are strong but results are missing. |
| `weak_result_orientation` | Bullets describe tasks without outcomes or business/user impact. | Metrics are present and outcome is clear. |
| `short_tenure_unclear` | Short tenure, employment gap, or timeline concern needs resume framing. | The issue is interview explanation only. |
| `outdated_resume` | Resume content appears stale or not updated for current search. | The concern is only file format. |
| `missing_relocation_signal` | Location, work authorization, onsite/hybrid readiness, or relocation signal is important and unclear. | Advice is general job search strategy, not resume wording. |
| `non_chronological_order` | Experience entries are not in reverse chronological order. | Dates are inconsistent but ordering is still correct. |
| `missing_summary` | The resume has no Summary/Profile section where one is expected. | Summary exists but is poorly aligned; use `weak_summary_role_alignment`. |
| `missing_gpa` | Education section is present but lacks GPA where GPA is useful for early-career/new-grad screening. | GPA is intentionally omitted for an experienced candidate where it is not relevant. |
| `missing_coursework` | Education section is present but lacks relevant coursework where coursework can support early-career keyword coverage. | The candidate has enough directly relevant work experience. |
| `missing_exp_location` | One or more experience entries lack location or remote/hybrid context. | The issue is missing contact location or relocation signal. |
| `passive_voice` | Bullets use passive voice enough to weaken ownership and action clarity. | The issue is weak verbs without passive construction. |
| `repetitive_verbs` | Bullets reuse the same action verb repeatedly, reducing readability and signal strength. | The verbs are weak but not repetitive. |
| `job_title_mismatch` | Resume experience titles or headline conflict with the target JD title/role naming. | The exact target title is simply absent; use `missing_exact_job_title`. |

## ATS System Mapping

Hosted `ats_system` may emit older or more granular tags. Resume-Agent-MVP should normalize them server-side before retrieval:

| ats_system Tag / Check | MVP Tag |
| --- | --- |
| `keyword_gap_critical`, `keyword_gap_major`, `keyword_gap_minor` | `low_jd_keyword_match` with severity derived from critical/major/minor |
| `insufficient_quantification` | `low_measurable_results` |
| `weak_verbs` | `weak_action_verbs` |
| `summary_missing_role` | `weak_summary_role_alignment` |
| `role_mismatch` | `weak_target_role_alignment` |
| `no_relocate_signal` | `missing_relocation_signal` |
| `short_tenure_unexplained` | `short_tenure_unclear` |
| `low_bullet_coverage` | `weak_experience_keyword_evidence` unless a dedicated DB segment exists |
| `missing_tools` | `low_hard_skill_match` or `missing_priority_keywords`, depending on keyword evidence |
| `missing_gpa`, `missing_coursework` | Keep as precise tags when DB retrieval supports them; otherwise map to `education_details_missing` |
| `all_china_experience`, `partial_china_experience` | Server-side severity/ranking signal by default; only use retrieval if the advice is resume-edit scoped |

Do not expose hosted `ats_system.problemTags`, raw checks, or normalized tags in the free browser response. They are retrieval/ranking inputs only.

## Severity Labels

Internal severity uses `p0`, `p1`, and `p2`. UI should render these as user-friendly labels:

- `p0`: `必改`
- `p1`: `建议改`
- `p2`: `补充`

Do not expose raw `P0/P1/P2` labels in the result UI.
