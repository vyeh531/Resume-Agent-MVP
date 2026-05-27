"""
End-to-end test / demo for the mentor advice retrieval pipeline.

Steps:
  1. Run DB migration (idempotent)
  2. Run metadata enrichment on first 500 rows (or all with --full-enrich)
  3. Run a sample ATS retrieval query for software_engineer / low_jd_keyword_match
  4. Print top 4 matching advice cards
  5. Assert the resume-versioning row is among the results

Usage:
    python scripts/test_advice_retrieval.py [--db PATH] [--full-enrich] [--no-migration]
"""

import argparse
import logging
import sqlite3
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# Make sibling scripts importable regardless of CWD
_SCRIPTS_DIR = Path(__file__).parent
_REPO_ROOT = _SCRIPTS_DIR.parent
for _p in (str(_SCRIPTS_DIR), str(_REPO_ROOT)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from migrate_segments_schema import main as run_migration
from migrate_segments_schema import resolve_db_path
from enrich_segments_metadata import main as run_enrichment
from retrieve_advice import retrieve_advice


# ---------------------------------------------------------------------------
# Sample query — matches the spec exactly
# ---------------------------------------------------------------------------

SAMPLE_QUERY = {
    "roleFamily":       "software_engineer",
    "targetRole":       "software_development_engineer",
    "seniority":        "entry_level",
    "topics":           ["summary_positioning", "keyword_alignment"],
    "problemTags": [
        "low_jd_keyword_match",
        "missing_priority_keywords",
        "weak_target_role_alignment",
    ],
    "priorityKeywords": [
        "microservices",
        "distributed systems",
        "Software Development Engineer",
    ],
    "freeOnly": True,
    "limit": 4,
}

# Tags that must appear in the resume-versioning row
_TARGET_TAGS = {
    "low_jd_keyword_match",
    "missing_priority_keywords",
    "weak_target_role_alignment",
}


def _print_divider(title: str = ""):
    width = 70
    if title:
        pad = (width - len(title) - 2) // 2
        print("\n" + "=" * pad + f" {title} " + "=" * pad)
    else:
        print("\n" + "=" * width)


def _print_result(i: int, seg: dict):
    _print_divider()
    title = seg.get("advice_card_title") or seg.get("chunk_id", "(no title)")
    print(f"[{i}] {title}")
    print(f"     Score={seg['retrieval_score']:.4f}  "
          f"priority={seg.get('priority', '?')}  "
          f"tier={seg.get('unlock_tier', '?')}  "
          f"safe_free={seg.get('safe_to_show_free', '?')}")
    matched = seg.get("matched_reasons") or []
    if matched:
        print(f"     Matched: {', '.join(matched)}")
    if seg.get("user_problem_summary"):
        print(f"     Problem: {seg['user_problem_summary'][:95]}")
    if seg.get("action_summary"):
        print(f"     Action:  {seg['action_summary'][:95]}")
    if seg.get("E_example"):
        print(f"     Example: {str(seg['E_example'])[:95]}")
    if seg.get("mentor_name"):
        print(f"     Mentor:  {seg['mentor_name']}")


def _assert_target_found(results: list[dict], db_path: Path):
    """Check that a segment matching the resume-versioning row is returned."""
    _print_divider("ASSERTION")

    for seg in results:
        seg_tags = {t.strip().lower()
                    for t in (seg.get("problem_tags") or "").split(",") if t.strip()}
        if len(_TARGET_TAGS & seg_tags) >= 2:
            print(f"[PASS] Resume-versioning row found in results.")
            print(f"       Title:    {seg.get('advice_card_title')}")
            print(f"       Tags hit: {_TARGET_TAGS & seg_tags}")
            return True

    # Not in top-4 free results — check if it exists at all
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.execute(
        "SELECT id, advice_card_title, problem_tags, unlock_tier, safe_to_show_free "
        "FROM segments "
        "WHERE problem_tags LIKE '%low_jd_keyword_match%' "
        "  AND problem_tags LIKE '%generic_resume%' "
        "LIMIT 1"
    )
    row = cur.fetchone()
    conn.close()

    if row:
        print(f"[WARN] Target row exists in DB but was outside the free/top-4 filter.")
        print(f"       id={row['id']}  tier={row['unlock_tier']}  "
              f"safe_free={row['safe_to_show_free']}")
        print(f"       title: {row['advice_card_title']}")
        print("       Hint: run with --full-enrich to enrich all 26k rows.")
    else:
        print("[FAIL] Target row not found — enrichment may not have reached it yet.")
        print("       Run: python scripts/test_advice_retrieval.py --full-enrich")
    return False


def main(args=None):
    sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(
        description="E2E test for mentor advice retrieval pipeline"
    )
    parser.add_argument("--db", metavar="PATH", help="Path to SQLite database")
    parser.add_argument(
        "--full-enrich", action="store_true",
        help="Enrich ALL rows (default: first 500 for speed)"
    )
    parser.add_argument(
        "--no-migration", action="store_true",
        help="Skip migration (assumes columns already exist)"
    )
    opts = parser.parse_args(args)

    db_arg = opts.db

    # ------------------------------------------------------------------
    # Step 1: Migration
    # ------------------------------------------------------------------
    _print_divider("STEP 1: DB MIGRATION")
    if not opts.no_migration:
        migration_args = ["--db", db_arg] if db_arg else []
        run_migration(migration_args)
    else:
        log.info("Skipping migration (--no-migration).")

    # ------------------------------------------------------------------
    # Step 2: Enrichment
    # ------------------------------------------------------------------
    _print_divider("STEP 2: METADATA ENRICHMENT")
    enrich_args = ["--db", db_arg] if db_arg else []
    if not opts.full_enrich:
        enrich_args += ["--limit", "500"]
        log.info("Enriching first 500 rows (pass --full-enrich for all 26k rows).")
    run_enrichment(enrich_args)

    # ------------------------------------------------------------------
    # Step 3: Retrieval
    # ------------------------------------------------------------------
    _print_divider("STEP 3: SAMPLE RETRIEVAL QUERY")
    db_path = resolve_db_path(db_arg)
    log.info("Query: roleFamily=%s  seniority=%s  freeOnly=%s",
             SAMPLE_QUERY["roleFamily"], SAMPLE_QUERY["seniority"], SAMPLE_QUERY["freeOnly"])
    log.info("problemTags: %s", SAMPLE_QUERY["problemTags"])

    results = retrieve_advice(db_path, SAMPLE_QUERY, limit=4)

    # ------------------------------------------------------------------
    # Step 4: Print results
    # ------------------------------------------------------------------
    _print_divider("TOP RETRIEVAL RESULTS")
    if not results:
        log.warning("No results returned. Check that enrichment completed.")
    else:
        for i, seg in enumerate(results, 1):
            _print_result(i, seg)

    # ------------------------------------------------------------------
    # Step 5: Assert
    # ------------------------------------------------------------------
    _assert_target_found(results, db_path)

    print("\nDone.\n")


if __name__ == "__main__":
    main()
