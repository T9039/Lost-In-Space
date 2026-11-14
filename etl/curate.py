"""Apply the curated narrative layer to artifacts built by ``transform``.

``transform`` builds the catalog skeleton: artifact, catalog identifiers and
phases. This command adds what GCAT cannot answer — mission metadata, sourced
facts, credited media and explicit relations — and only then marks an artifact
as curated.

The input is one JSON file with an ``artifacts`` array. Each entry must already
exist in the database by slug; run ``transform`` first.

Usage:

    python -m etl.curate
    python -m etl.curate --curation curation/artifacts.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import psycopg

from etl import db

ZONES = ("moon", "mars", "earth_orbit", "deep_space", "other")


def load_artifacts(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    return list(payload.get("artifacts") or [])


def artifact_id(cur: psycopg.Cursor, slug: str):
    cur.execute("SELECT artifact_id FROM artifact WHERE slug = %s", (slug,))
    row = cur.fetchone()
    if not row:
        raise SystemExit(f"artifact {slug!r} does not exist; run transform first")
    return row["artifact_id"]


def org_set(cur: psycopg.Cursor) -> set[str]:
    cur.execute("SELECT org_code FROM organization")
    return {row["org_code"] for row in cur.fetchall()}


def upsert_mission(
    cur: psycopg.Cursor, artifact, mission: dict[str, Any], orgs: set[str]
) -> None:
    agency = mission.get("agency_org_code")
    cur.execute(
        """
        INSERT INTO mission (
            artifact_id, mission_name, program, agency_org_code,
            class_code, category_code, summary_text, abandonment_reason,
            curated_by, curated_at, source_id
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now(), 'curated')
        ON CONFLICT (artifact_id) DO UPDATE SET
            mission_name = EXCLUDED.mission_name,
            program = EXCLUDED.program,
            agency_org_code = EXCLUDED.agency_org_code,
            class_code = EXCLUDED.class_code,
            category_code = EXCLUDED.category_code,
            summary_text = EXCLUDED.summary_text,
            abandonment_reason = EXCLUDED.abandonment_reason,
            curated_by = EXCLUDED.curated_by,
            curated_at = now(),
            source_id = EXCLUDED.source_id
        """,
        (
            artifact,
            mission.get("mission_name"),
            mission.get("program"),
            agency if agency in orgs else None,
            mission.get("class_code"),
            mission.get("category_code"),
            mission.get("summary_text"),
            mission.get("abandonment_reason"),
            mission.get("curated_by"),
        ),
    )


def replace_facts(
    cur: psycopg.Cursor, artifact, facts: list[dict[str, Any]], curator: str | None
) -> int:
    cur.execute("DELETE FROM fact WHERE artifact_id = %s", (artifact,))
    for fact in facts:
        if not fact.get("fact_text"):
            raise SystemExit("fact without fact_text")
        if not fact.get("source_url"):
            raise SystemExit(f"fact without source_url: {fact.get('fact_text')!r}")
        cur.execute(
            """
            INSERT INTO fact (
                artifact_id, fact_type, fact_text, value,
                source_id, source_url, confidence, curated_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                artifact,
                fact.get("fact_type", "history"),
                fact["fact_text"],
                fact.get("value"),
                fact["source_id"],
                fact["source_url"],
                fact.get("confidence", "confirmed"),
                curator,
            ),
        )
    return len(facts)


def replace_media(
    cur: psycopg.Cursor, artifact, media: list[dict[str, Any]]
) -> int:
    cur.execute("DELETE FROM media WHERE artifact_id = %s", (artifact,))
    primary = [item for item in media if item.get("is_primary")]
    if len(primary) > 1:
        raise SystemExit("more than one primary media row for an artifact")
    for item in media:
        if not item.get("credit") or not item.get("license_name"):
            raise SystemExit(f"media without credit or licence: {item.get('url')!r}")
        cur.execute(
            """
            INSERT INTO media (
                artifact_id, url, title, credit, license_name, license_url,
                media_type, is_primary, source_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                artifact,
                item["url"],
                item.get("title"),
                item["credit"],
                item["license_name"],
                item.get("license_url"),
                item.get("media_type", "image"),
                bool(item.get("is_primary", False)),
                item.get("source_id", "nasa_images"),
            ),
        )
    return len(media)


def replace_relations(
    cur: psycopg.Cursor,
    artifact,
    relations: list[dict[str, Any]],
    ids: dict[str, Any],
) -> int:
    cur.execute(
        """
        DELETE FROM artifact_relation
         WHERE from_artifact_id = %s AND source_id = 'curated'
        """,
        (artifact,),
    )
    written = 0
    for relation in relations:
        target = ids.get(relation.get("to"))
        if not target:
            raise SystemExit(
                f"relation target {relation.get('to')!r} is not a curated artifact"
            )
        cur.execute(
            """
            INSERT INTO artifact_relation (
                from_artifact_id, to_artifact_id, relation, source_id, note
            ) VALUES (%s, %s, %s, 'curated', %s)
            ON CONFLICT (from_artifact_id, to_artifact_id, relation)
            DO UPDATE SET note = EXCLUDED.note
            """,
            (artifact, target, relation["kind"], relation.get("note")),
        )
        written += 1
    return written


def zone_counts(cur: psycopg.Cursor) -> list[tuple[str, int]]:
    cur.execute(
        """
        SELECT primary_zone, count(*) AS n
          FROM artifact
         WHERE is_curated
         GROUP BY primary_zone
         ORDER BY primary_zone
        """
    )
    return [(row["primary_zone"], row["n"]) for row in cur.fetchall()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--curation", type=Path, default=Path("curation/artifacts.json")
    )
    args = parser.parse_args(argv)

    if not args.curation.exists():
        raise SystemExit(f"curation file not found: {args.curation}")

    artifacts = load_artifacts(args.curation)
    with db.connect() as conn:
        with db.try_advisory_lock(conn, "etl.curate") as locked:
            if not locked:
                print("another curate run is active", file=sys.stderr)
                return 2

            with db.transaction(conn):
                with conn.cursor() as cur:
                    run_id = db.start_run(
                        conn, source_id="curated", job="curate"
                    )
                    orgs = org_set(cur)
                    ids = {
                        spec["slug"]: artifact_id(cur, spec["slug"])
                        for spec in artifacts
                    }

                    facts = media = relations = 0
                    for spec in artifacts:
                        if spec.get("primary_zone") not in ZONES:
                            raise SystemExit(
                                f"{spec['slug']}: invalid zone {spec.get('primary_zone')!r}"
                            )
                        aid = ids[spec["slug"]]
                        mission = spec.get("mission") or {}
                        upsert_mission(cur, aid, mission, orgs)
                        facts += replace_facts(
                            cur, aid, spec.get("facts") or [], mission.get("curated_by")
                        )
                        media += replace_media(cur, aid, spec.get("media") or [])
                        relations += replace_relations(
                            cur, aid, spec.get("relations") or [], ids
                        )
                        cur.execute(
                            """
                            UPDATE artifact
                               SET is_curated = true,
                                   curation_notes = %s,
                                   updated_at = now()
                             WHERE artifact_id = %s
                            """,
                            (
                                f"curated by {mission.get('curated_by') or 'unknown'}; "
                                f"{len(spec.get('facts') or [])} sourced facts",
                                aid,
                            ),
                        )

                    db.finish_run(
                        conn,
                        run_id,
                        status="succeeded",
                        rows_read=len(artifacts),
                        rows_written=facts + media + relations,
                        notes=(
                            f"artifacts={len(artifacts)} facts={facts} "
                            f"media={media} relations={relations}"
                        ),
                    )

            with conn.cursor() as cur:
                counts = zone_counts(cur)

    print(
        f"curated {len(artifacts)} artifacts: "
        f"{facts} facts, {media} media, {relations} relations",
        file=sys.stderr,
    )
    for zone, count in counts:
        print(f"  {zone}: {count}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
