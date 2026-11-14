"""Post-load invariant checks.

Every query should return zero rows. The command prints the offending rows and
exits non-zero when anything fails, so it can gate a deployment.

Usage:

    python -m etl.validate
"""

from __future__ import annotations

import argparse
import sys

from etl import db

CHECKS: list[tuple[str, str]] = [
    (
        "object row with no JCAT",
        """
        SELECT source_file, source_row
          FROM staging.gcat_object
         WHERE jcat IS NULL OR btrim(jcat) = ''
        """,
    ),
    (
        "SATCAT value with digits that would fail a numeric cast",
        """
        SELECT DISTINCT satcat
          FROM staging.gcat_object
         WHERE satcat IS NOT NULL
           AND satcat <> '-'
           AND satcat ~ '[0-9]'
           AND satcat !~ '^[0-9]+$'
        """,
    ),
    (
        "artifact with no phase",
        """
        SELECT a.slug
          FROM artifact a
          LEFT JOIN artifact_phase p ON p.artifact_id = a.artifact_id
         WHERE p.phase_id IS NULL
        """,
    ),
    (
        "phase with no artifact",
        """
        SELECT jcat_id FROM artifact_phase WHERE artifact_id IS NULL
        """,
    ),
    (
        "curated artifact without a sourced fact",
        """
        SELECT a.slug
          FROM artifact a
         WHERE a.is_curated
           AND NOT EXISTS (
               SELECT 1 FROM fact f
                WHERE f.artifact_id = a.artifact_id
                  AND f.source_url IS NOT NULL
           )
        """,
    ),
    (
        "media without licence or credit",
        """
        SELECT media_id, url
          FROM media
         WHERE license_name IS NULL OR credit IS NULL OR credit = ''
        """,
    ),
    (
        "story without a facts snapshot or hash",
        """
        SELECT story_id
          FROM story
         WHERE facts_snapshot IS NULL OR fact_hash IS NULL OR fact_hash = ''
        """,
    ),
    (
        "element set with no epoch",
        """
        SELECT gp_id FROM gp_element WHERE epoch IS NULL
        """,
    ),
    (
        "catalog identifier with an empty value",
        """
        SELECT catalog_id, scheme
          FROM artifact_catalog_id
         WHERE value IS NULL OR value = ''
        """,
    ),
    (
        "relation pointing at itself",
        """
        SELECT from_artifact_id, to_artifact_id
          FROM artifact_relation
         WHERE from_artifact_id = to_artifact_id
        """,
    ),
]


WARNINGS: list[tuple[str, str]] = [
    (
        "launch tag with no launch record",
        """
        SELECT DISTINCT btrim(o.launch_tag) AS launch_tag
          FROM staging.gcat_object o
          LEFT JOIN staging.gcat_launch l
            ON btrim(l.launch_tag) = btrim(o.launch_tag)
         WHERE o.launch_tag IS NOT NULL
           AND btrim(o.launch_tag) NOT IN ('', '-')
           AND l.launch_tag IS NULL
        """,
    ),
    (
        "lander row with no object row",
        """
        SELECT l.jcat, l.name
          FROM staging.gcat_lander l
          LEFT JOIN staging.gcat_object o
            ON btrim(o.jcat) = btrim(l.jcat)
         WHERE o.jcat IS NULL
        """,
    ),
]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-rows", type=int, default=5)
    args = parser.parse_args(argv)

    failures = warnings = 0
    with db.connect() as conn:
        with conn.cursor() as cur:
            for name, sql in CHECKS:
                cur.execute(sql)
                rows = cur.fetchall()
                if not rows:
                    print(f"ok    {name}", file=sys.stderr)
                    continue
                failures += 1
                print(f"FAIL  {name}: {len(rows)} row(s)", file=sys.stderr)
                for row in rows[: args.max_rows]:
                    print(f"      {row}", file=sys.stderr)

            for name, sql in WARNINGS:
                cur.execute(sql)
                rows = cur.fetchall()
                if not rows:
                    continue
                warnings += 1
                print(f"WARN  {name}: {len(rows)} row(s)", file=sys.stderr)
                for row in rows[: args.max_rows]:
                    print(f"      {row}", file=sys.stderr)

    if failures:
        print(f"{failures} check(s) failed", file=sys.stderr)
        return 1
    print(
        f"all checks passed ({warnings} warning group(s))",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
