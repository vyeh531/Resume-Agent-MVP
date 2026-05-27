"""
Deterministic retrieval of mentor advice segments from the knowledge base.

Accepts an ATS retrieval query object and returns ranked segments.

Scoring formula:
    score = 0.35 * problem_tag_overlap
          + 0.20 * role_family_match
          + 0.15 * target_role_match
          + 0.10 * seniority_match
          + 0.10 * keyword_overlap
          + 0.05 * mentor_quality_score
          + 0.05 * priority_normalized

Usage (CLI):
    python scripts/retrieve_advice.py \\
        --role-family software_engineer \\
        --target-role software_development_engineer \\
        --seniority entry_level \\
        --problem-tags "low_jd_keyword_match,missing_priority_keywords" \\
        --keywords "microservices,distributed systems" \\
        --free-only --limit 4

Usage (import):
    from scripts.retrieve_advice import retrieve_advice
    results = retrieve_advice(db_path, query, limit=4)
"""

import argparse
import json
import logging
import os
import sqlite3
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# DB path resolution
# ---------------------------------------------------------------------------

def resolve_db_path(cli_arg: str | None = None) -> Path:
    if cli_arg:
        return Path(cli_arg)
    env = os.environ.get("MENTOR_KB_DB_PATH")
    if env:
        return Path(env)
    repo_root = Path(__file__).parent.parent
    for name in ("mentor_kb-v5.db", "mentor_kb-v6.db"):
        p = repo_root / name
        if p.exists():
            return p
    raise FileNotFoundError(
        "Cannot find mentor KB database. "
        "Pass --db <path> or set MENTOR_KB_DB_PATH."
    )


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def _split_csv(value: str | None) -> set[str]:
    if not value:
        return set()
    return {v.strip().lower() for v in value.split(",") if v.strip()}


def _overlap_score(query_set: set[str], segment_csv: str | None) -> float:
    """Intersection / len(query_set).  Returns 0.0 if query_set is empty."""
    if not query_set:
        return 0.0
    seg_set = _split_csv(segment_csv)
    return len(query_set & seg_set) / len(query_set)


def _binary_match(query_value: str, segment_csv: str | None) -> float:
    """1.0 if query_value found in segment CSV, 0.5 if no query constraint, else 0.0."""
    if not query_value:
        return 0.5
    return 1.0 if query_value.lower() in _split_csv(segment_csv) else 0.0


def score_segment(query: dict, seg: dict) -> tuple[float, list[str]]:
    """Return (score 0–1, list of matched reasons)."""
    reasons: list[str] = []

    # 0.35 — problem tag overlap
    query_tags = {t.strip().lower() for t in (query.get("problemTags") or []) if t.strip()}
    tag_score = _overlap_score(query_tags, seg.get("problem_tags"))
    if tag_score > 0:
        matched = query_tags & _split_csv(seg.get("problem_tags"))
        reasons.append(f"problem_tags({','.join(sorted(matched))})")

    # 0.20 — role family match
    query_rf = (query.get("roleFamily") or "").lower().strip()
    rf_score = _binary_match(query_rf, seg.get("role_family"))
    if rf_score > 0 and query_rf:
        reasons.append(f"role_family({query_rf})")

    # 0.15 — target role match
    query_tr = (query.get("targetRole") or "").lower().strip()
    tr_score = _binary_match(query_tr, seg.get("target_roles"))
    if tr_score > 0 and query_tr:
        reasons.append(f"target_role({query_tr})")

    # 0.10 — seniority match (partial credit for 'universal')
    query_sen = (query.get("seniority") or "").lower().strip()
    if not query_sen:
        sen_score = 0.5
    else:
        seg_sen = _split_csv(seg.get("seniority"))
        if query_sen in seg_sen:
            sen_score = 1.0
            reasons.append(f"seniority({query_sen})")
        elif "universal" in seg_sen:
            sen_score = 0.5
        else:
            sen_score = 0.0

    # 0.10 — priority keyword overlap
    query_kws = {k.strip().lower() for k in (query.get("priorityKeywords") or []) if k.strip()}
    kw_score = _overlap_score(query_kws, seg.get("keywords"))
    if kw_score > 0:
        matched_kws = query_kws & _split_csv(seg.get("keywords"))
        reasons.append(f"keywords({','.join(sorted(matched_kws))})")

    # 0.05 — mentor quality score (already 0–1)
    mq = float(seg.get("mentor_quality_score") or 0.5)

    # 0.05 — priority normalised (1–5 → 0–1)
    prio_norm = (int(seg.get("priority") or 3) - 1) / 4.0

    score = (
        0.35 * tag_score
        + 0.20 * rf_score
        + 0.15 * tr_score
        + 0.10 * sen_score
        + 0.10 * kw_score
        + 0.05 * mq
        + 0.05 * prio_norm
    )
    return round(score, 4), reasons


# ---------------------------------------------------------------------------
# Return fields
# ---------------------------------------------------------------------------

_RETURN_FIELDS = [
    "chunk_id", "advice_card_title", "user_problem_summary", "action_summary",
    "P_mentor", "A_action", "I_insight", "E_example", "HR_os",
    "mentor_name", "role_family", "target_roles", "seniority",
    "ats_dimensions", "problem_tags", "keywords",
    "priority", "unlock_tier", "safe_to_show_free",
    "mentor_quality_score", "topic_slug",
]


# ---------------------------------------------------------------------------
# Main retrieval function
# ---------------------------------------------------------------------------

def retrieve_advice(
    db_path: Path,
    query: dict,
    limit: int = 4,
) -> list[dict]:
    """
    Retrieve and rank mentor advice segments.

    Args:
        db_path: Path to the SQLite database.
        query: Dict with any of:
            roleFamily (str)
            targetRole (str)
            seniority (str)
            topics (list[str])
            problemTags (list[str])
            priorityKeywords (list[str])
            freeOnly (bool)
            limit (int)
        limit: Default max results (overridden by query['limit'] if present).

    Returns:
        List of segment dicts, sorted by retrieval_score descending.
    """
    effective_limit = query.get("limit", limit)
    free_only = query.get("freeOnly", False)
    rf = (query.get("roleFamily") or "").strip().lower()

    # Build parameterised WHERE clause for a pre-filter (reduces scoring work)
    where_parts: list[str] = []
    params: list = []

    if free_only:
        where_parts.append("(unlock_tier = 'free' OR safe_to_show_free = 1)")

    if rf:
        # Match role_family containing the requested family or 'universal'
        where_parts.append(
            "(INSTR(LOWER(COALESCE(role_family,'')), ?) > 0 "
            " OR INSTR(LOWER(COALESCE(role_family,'')), 'universal') > 0)"
        )
        params.append(rf)

    where_sql = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""
    fields_sql = ", ".join(_RETURN_FIELDS)
    sql = f"SELECT {fields_sql} FROM segments {where_sql}"

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(sql, params).fetchall()
    finally:
        conn.close()

    scored: list[dict] = []
    for raw in rows:
        seg = dict(raw)
        score, reasons = score_segment(query, seg)
        seg["retrieval_score"] = score
        seg["matched_reasons"] = reasons
        scored.append(seg)

    scored.sort(key=lambda x: x["retrieval_score"], reverse=True)
    return scored[:effective_limit]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(args=None):
    parser = argparse.ArgumentParser(description="Retrieve ranked mentor advice segments")
    parser.add_argument("--db", metavar="PATH", help="Path to SQLite database")
    parser.add_argument("--role-family", default="software_engineer")
    parser.add_argument("--target-role", default="")
    parser.add_argument("--seniority", default="")
    parser.add_argument("--problem-tags", default="",
                        help="Comma-separated list of problem tags")
    parser.add_argument("--keywords", default="",
                        help="Comma-separated priority keywords")
    parser.add_argument("--free-only", action="store_true")
    parser.add_argument("--limit", type=int, default=4)
    parser.add_argument("--json", action="store_true", dest="output_json",
                        help="Output results as JSON")
    opts = parser.parse_args(args)

    db_path = resolve_db_path(opts.db)
    query = {
        "roleFamily":       opts.role_family,
        "targetRole":       opts.target_role,
        "seniority":        opts.seniority,
        "problemTags":      [t.strip() for t in opts.problem_tags.split(",") if t.strip()],
        "priorityKeywords": [k.strip() for k in opts.keywords.split(",") if k.strip()],
        "freeOnly":         opts.free_only,
        "limit":            opts.limit,
    }

    results = retrieve_advice(db_path, query, limit=opts.limit)

    if opts.output_json:
        sys.stdout.reconfigure(encoding="utf-8")
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return

    sys.stdout.reconfigure(encoding="utf-8")
    if not results:
        print("No results found. Make sure enrichment has been run.")
        return

    for i, seg in enumerate(results, 1):
        print(f"\n{'='*60}")
        print(f"[{i}] {seg.get('advice_card_title') or seg.get('chunk_id', '')}")
        print(f"     Score={seg['retrieval_score']:.4f}  "
              f"priority={seg.get('priority')}  "
              f"tier={seg.get('unlock_tier')}")
        print(f"     Matched: {', '.join(seg.get('matched_reasons') or [])}")
        print(f"     Problem: {(seg.get('user_problem_summary') or '')[:90]}")
        print(f"     Action:  {(seg.get('action_summary') or '')[:90]}")
        if seg.get("E_example"):
            print(f"     Example: {str(seg['E_example'])[:90]}")
        print(f"     Mentor:  {seg.get('mentor_name', 'N/A')}")


if __name__ == "__main__":
    main()
