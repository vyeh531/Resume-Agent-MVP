"""
Idempotent migration: add new retrieval metadata columns and indexes to
the 'segments' table in the mentor knowledge base SQLite DB.

Usage:
    python scripts/migrate_segments_schema.py [--db PATH] [--no-backup]

    Or set env var: MENTOR_KB_DB_PATH=path/to/mentor_kb-v5.db

Behaviour:
  - Backs up the database before any changes (use --no-backup to skip)
  - Adds 17 new columns if they do not already exist
  - Creates 7 standard indexes with IF NOT EXISTS
  - Creates an FTS5 virtual table if FTS5 is available (skipped gracefully)
  - Safe to run multiple times (idempotent)
"""

import argparse
import logging
import os
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# Columns to add: (column_name, column_type_and_default)
NEW_COLUMNS = [
    ("role_family",          "TEXT"),
    ("target_roles",         "TEXT"),
    ("seniority",            "TEXT"),
    ("ats_dimensions",       "TEXT"),
    ("problem_tags",         "TEXT"),
    ("keywords",             "TEXT"),
    ("topic_slug",           "TEXT"),
    ("retrieval_text",       "TEXT"),
    ("priority",             "INTEGER DEFAULT 3"),
    ("unlock_tier",          "TEXT DEFAULT 'paid'"),
    ("advice_card_title",    "TEXT"),
    ("user_problem_summary", "TEXT"),
    ("action_summary",       "TEXT"),
    ("safe_to_show_free",    "INTEGER DEFAULT 0"),
    ("requires_ai_rewrite",  "INTEGER DEFAULT 0"),
    ("mentor_quality_score", "REAL DEFAULT 0.5"),
    ("feedback_score",       "REAL DEFAULT 0.0"),
]

INDEXES = [
    ("idx_segments_role_family",    "role_family"),
    ("idx_segments_target_roles",   "target_roles"),
    ("idx_segments_seniority",      "seniority"),
    ("idx_segments_problem_tags",   "problem_tags"),
    ("idx_segments_ats_dimensions", "ats_dimensions"),
    ("idx_segments_unlock_tier",    "unlock_tier"),
    ("idx_segments_priority",       "priority"),
]


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


def backup_db(db_path: Path) -> Path:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = db_path.parent / f"{db_path.stem}.before-retrieval-migration-{ts}.db"
    shutil.copy2(db_path, backup)
    log.info("Backup created → %s", backup.name)
    return backup


def get_existing_columns(conn: sqlite3.Connection) -> set[str]:
    cur = conn.execute("PRAGMA table_info(segments)")
    return {row[1].lower() for row in cur.fetchall()}


def add_columns(conn: sqlite3.Connection, existing: set[str]) -> list[str]:
    added = []
    for col_name, col_def in NEW_COLUMNS:
        if col_name.lower() in existing:
            log.debug("Already exists, skipping: %s", col_name)
            continue
        conn.execute(f"ALTER TABLE segments ADD COLUMN {col_name} {col_def}")
        added.append(col_name)
        log.info("  + Added column: %-30s %s", col_name, col_def)
    return added


def create_indexes(conn: sqlite3.Connection) -> list[str]:
    created = []
    for idx_name, col_name in INDEXES:
        conn.execute(
            f"CREATE INDEX IF NOT EXISTS {idx_name} ON segments ({col_name})"
        )
        created.append(idx_name)
        log.info("  + Index ensured: %s", idx_name)
    return created


def create_fts5_table(conn: sqlite3.Connection) -> bool:
    """Create FTS5 external-content virtual table. Skip gracefully if unavailable."""
    try:
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS segments_fts
            USING fts5(
                chunk_id UNINDEXED,
                retrieval_text,
                topic,
                keywords,
                problem_tags,
                content='segments',
                content_rowid='id'
            )
        """)
        log.info("  + FTS5 virtual table 'segments_fts' created/verified.")
        return True
    except sqlite3.OperationalError as exc:
        log.warning("FTS5 unavailable — skipping (reason: %s)", exc)
        return False


def main(args=None):
    parser = argparse.ArgumentParser(
        description="Idempotent DB migration: add retrieval metadata columns to segments"
    )
    parser.add_argument("--db", metavar="PATH", help="Path to SQLite database file")
    parser.add_argument(
        "--no-backup", action="store_true",
        help="Skip the database backup step (not recommended)"
    )
    opts = parser.parse_args(args)

    db_path = resolve_db_path(opts.db)
    if not db_path.exists():
        log.error("Database not found: %s", db_path)
        sys.exit(1)

    log.info("Database: %s  (%.1f MB)", db_path, db_path.stat().st_size / 1024**2)

    if not opts.no_backup:
        backup_db(db_path)

    conn = sqlite3.connect(str(db_path))
    try:
        existing = get_existing_columns(conn)
        log.info("Existing columns in segments: %d", len(existing))

        log.info("--- Adding columns ---")
        added = add_columns(conn, existing)

        log.info("--- Creating indexes ---")
        create_indexes(conn)

        log.info("--- FTS5 ---")
        create_fts5_table(conn)

        conn.commit()
        log.info(
            "Migration complete. Columns added: %d  (%s)",
            len(added),
            ", ".join(added) if added else "none — already up to date",
        )
    except Exception:
        conn.rollback()
        log.exception("Migration failed — rolled back. Database is unchanged.")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
