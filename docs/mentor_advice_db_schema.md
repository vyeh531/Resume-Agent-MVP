# Mentor Advice DB — Retrieval Metadata Schema

## Overview

`mentor_kb-v5.db` holds the `segments` table — PLAIEHT-framework coaching
segments extracted from mentor sessions.  This document describes the
**retrieval metadata columns** added by the `migrate_segments_schema.py`
migration, why each column exists, and how to operate the system.

---

## Product Flow Context

```
Resume + JD
  → Parse
  → ATS Score         (outputs profile.roleFamily, problemTags, retrievalQuery)
  → Problem Tags
  → Query Builder
  → Mentor Advice Retrieval  ← this DB
  → Rerank
  → Assemble Report
  → Paid Unlock
```

---

## ATS Output → Advice DB Field Mapping

| ATS Output Field                       | Advice DB Column   |
|----------------------------------------|--------------------|
| `profile.roleFamily`                   | `role_family`      |
| `profile.targetRole`                   | `target_roles`     |
| `profile.seniority`                    | `seniority`        |
| `problemTags[]`                        | `problem_tags`     |
| `retrievalQuery.topics[]`              | `topic_slug`       |
| `retrievalQuery.priorityKeywords[]`    | `keywords`         |
| ATS dimension scores                   | `ats_dimensions`   |

---

## Columns Added by Migration

### Retrieval Matching

| Column           | Type    | Description |
|------------------|---------|-------------|
| `role_family`    | TEXT    | Comma-separated role family tags inferred from content. Values: `software_engineer`, `ai_engineer`, `machine_learning`, `data_analyst`, `product_manager`, `marketing`, `universal`. |
| `target_roles`   | TEXT    | Comma-separated specific target roles. Values: `backend_engineer`, `frontend_engineer`, `full_stack_engineer`, `software_engineer`, `software_development_engineer`, `ai_engineer`, `machine_learning_engineer`, `data_analyst`, `data_scientist`, `product_manager`, `business_analyst`, `universal`. |
| `seniority`      | TEXT    | Comma-separated seniority levels. Values: `student`, `new_grad`, `entry_level`, `early_career`, `experienced`, `career_switcher`, `universal`. |
| `ats_dimensions` | TEXT    | ATS scoring dimensions this advice addresses (see ATS Dimensions table below). |
| `problem_tags`   | TEXT    | Comma-separated controlled-vocabulary problem tags matching ATS output `problemTags[]`. |
| `keywords`       | TEXT    | Comma-separated retrieval keywords (English + Chinese role/tech terms). |
| `topic_slug`     | TEXT    | Stable snake_case slug built from L1 + L2 + topic, for topic-based filtering. |
| `retrieval_text` | TEXT    | Full concatenated text of all key fields — optimised for SQL LIKE search and future vector embedding. |

### Ranking & Monetisation

| Column               | Type    | Default | Description |
|----------------------|---------|---------|-------------|
| `priority`           | INTEGER | 3       | Advice priority 1–5. 5 = most broadly useful / ATS-relevant. |
| `unlock_tier`        | TEXT    | `paid`  | `free` / `paid` / `premium` (see Free vs Paid below). |
| `safe_to_show_free`  | INTEGER | 0       | 1 = safe to show as free preview regardless of `unlock_tier`. |
| `requires_ai_rewrite`| INTEGER | 0       | 1 = advice needs personalised AI generation (reserved for premium). |

### User-Facing Card Fields

| Column                | Type | Description |
|-----------------------|------|-------------|
| `advice_card_title`   | TEXT | Short Chinese title shown on the advice card (e.g. `不要一份简历投所有岗位`). |
| `user_problem_summary`| TEXT | Short Chinese problem description derived from `P_mentor`. |
| `action_summary`      | TEXT | Short Chinese action step derived from `A_action`. |

### Quality & Feedback

| Column                | Type | Default | Description |
|-----------------------|------|---------|-------------|
| `mentor_quality_score`| REAL | 0.5     | Computed 0–1 quality signal based on confidence, completeness of A/E/HR fields. |
| `feedback_score`      | REAL | 0.0     | User feedback score (set externally; not modified by enrichment). |

---

## ATS Dimension Values

| Value              | Covers |
|--------------------|--------|
| `A_format`         | Resume layout, section ordering, date format, template |
| `B_contact`        | LinkedIn, contact info, GPA, coursework details |
| `C_content_quality`| Bullet quality, quantified results, action verbs |
| `D_keyword_match`  | ATS keyword matching, JD alignment, keyword density |
| `E_market_fit`     | US market signals, relocation, visa/OPT status |
| `F_role_fit`       | Role positioning, multi-version resume, target-role tailoring |

---

## Problem Tag Vocabulary

Tags follow the ATS output taxonomy.  Key tags and their meaning:

| Tag | Triggered when advice addresses… |
|-----|----------------------------------|
| `low_jd_keyword_match` | JD keyword matching / ATS pass rate |
| `generic_resume_positioning` | One universal resume used for all jobs |
| `resume_not_tailored_to_jd` | Resume not customised per JD |
| `low_role_specificity` | Lack of role-targeting in resume |
| `weak_target_role_alignment` | Resume not aligned to target role |
| `universal_resume_problem` | Advice applicable to anyone with generic resume |
| `missing_priority_keywords` | Missing high-frequency JD keywords |
| `weak_experience_keyword_evidence` | Keywords only in Skills section, not in experience |
| `keywords_only_in_skills` | All keywords in Skills block, not in bullets |
| `low_measurable_results` | No quantified results / numbers |
| `weak_action_verbs` | Weak opening verbs (e.g. "负责", "responsible for") |
| `missing_linkedin` | No LinkedIn profile or link |
| `formatting_penalty_triggered` | Format causes ATS parsing failure |
| `education_details_missing` | Missing or incomplete education section |

---

## Free vs Paid Advice

| Tier      | Shown when | Content |
|-----------|-----------|---------|
| `free`    | Always (before payment) | Broad diagnostic — explains the problem, no full strategy |
| `paid`    | After ¥49 unlock | Specific advice with examples, section-level strategy |
| `premium` | Future tier | Requires AI rewriting or deep personalisation |

**Free filter logic** (used in retrieval when `freeOnly=true`):
```sql
WHERE unlock_tier = 'free' OR safe_to_show_free = 1
```

---

## Retrieval Scoring Formula

```
score = 0.35 × problem_tag_overlap
      + 0.20 × role_family_match
      + 0.15 × target_role_match
      + 0.10 × seniority_match     (0.5 if segment has 'universal')
      + 0.10 × keyword_overlap
      + 0.05 × mentor_quality_score
      + 0.05 × priority_normalized  (priority 1–5 → 0–1)
```

Where overlaps are measured as `|intersection| / |query set|`.

---

## How to Run Migration

```powershell
# From repo root (auto-detects mentor_kb-v5.db):
python scripts/migrate_segments_schema.py

# With explicit DB path:
python scripts/migrate_segments_schema.py --db "C:\path\to\mentor_kb-v5.db"

# Skip backup (not recommended):
python scripts/migrate_segments_schema.py --no-backup
```

The migration is **idempotent** — safe to run multiple times.
A timestamped `.before-retrieval-migration-<ts>.db` backup is created first.

---

## How to Run Enrichment

```powershell
# Enrich only rows with empty metadata (first run):
python scripts/enrich_segments_metadata.py

# Re-enrich ALL rows:
python scripts/enrich_segments_metadata.py --force

# Test on first 100 rows only:
python scripts/enrich_segments_metadata.py --limit 100

# Rebuild FTS5 index after enrichment:
python scripts/enrich_segments_metadata.py --rebuild-fts
```

---

## How to Run Test Retrieval

```powershell
# Quick test (migration + 500-row enrichment + sample query):
python scripts/test_advice_retrieval.py

# Full enrichment of all 26k rows:
python scripts/test_advice_retrieval.py --full-enrich

# Skip migration if already done:
python scripts/test_advice_retrieval.py --no-migration --full-enrich
```

---

## Environment Variable

Set `MENTOR_KB_DB_PATH` to avoid passing `--db` on every call:

```powershell
# PowerShell:
$env:MENTOR_KB_DB_PATH = "C:\Users\viviy\Documents\GitHub\Resume-Agent-MVP\mentor_kb-v5.db"

# Bash:
export MENTOR_KB_DB_PATH=/path/to/mentor_kb-v5.db
```

---

## Retrieval Query Object (API)

```json
{
  "roleFamily":       "software_engineer",
  "targetRole":       "software_development_engineer",
  "seniority":        "entry_level",
  "topics":           ["keyword_alignment"],
  "problemTags":      ["low_jd_keyword_match", "missing_priority_keywords"],
  "priorityKeywords": ["microservices", "distributed systems"],
  "freeOnly":         true,
  "limit":            4
}
```

Import and call from Node.js server (example):

```javascript
const { execFileSync } = require("child_process");
const result = JSON.parse(
  execFileSync("python", [
    "scripts/retrieve_advice.py", "--json",
    "--role-family", "software_engineer",
    "--problem-tags", "low_jd_keyword_match,missing_priority_keywords",
    "--free-only", "--limit", "4"
  ], { encoding: "utf-8" })
);
```

Or call the Python function directly if running a Python backend.

---

## FTS5 Full-Text Search (Optional)

If SQLite was compiled with FTS5 (default on most platforms), the migration
creates a virtual table `segments_fts` backed by `segments`.

Rebuild the FTS index after enrichment:
```powershell
python scripts/enrich_segments_metadata.py --rebuild-fts
```

Use in SQL:
```sql
SELECT s.*
FROM segments_fts f
JOIN segments s ON s.id = f.rowid
WHERE segments_fts MATCH 'keyword match ATS'
ORDER BY rank;
```
