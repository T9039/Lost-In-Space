#!/usr/bin/env python3
"""Apply SQL files to DATABASE_URL without needing the psql client.

Usage:
    python scripts/apply_sql.py db/schema.sql db/seed/001_lookups.sql db/staging.sql

The files are executed as-is. They contain BEGIN/COMMIT blocks, so the
connection uses autocommit. Run this against a fresh database: the baseline
schema is not idempotent.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg


def main(paths: list[str]) -> int:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 2

    files = [Path(path) for path in paths]
    missing = [str(path) for path in files if not path.exists()]
    if missing:
        print(f"missing SQL file(s): {', '.join(missing)}", file=sys.stderr)
        return 2

    with psycopg.connect(dsn, autocommit=True) as conn:
        for path in files:
            print(f"applying {path} ...", file=sys.stderr)
            sql = path.read_text(encoding="utf-8")
            with conn.cursor() as cur:
                cur.execute(sql)
    print("done", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
