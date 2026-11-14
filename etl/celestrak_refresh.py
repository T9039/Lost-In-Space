"""Refresh live Earth-orbit element sets from CelesTrak.

Only curated artifacts with a SATCAT identifier are fetched. The job stores
OMM records; it never propagates a position or writes one.

Usage:

    python -m etl.celestrak_refresh
    python -m etl.celestrak_refresh --dry-run
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from typing import Any, Iterable

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from etl import config, db

GP_URL = "https://celestrak.org/NORAD/elements/gp.php"
BATCH = 40


def session() -> requests.Session:
    retry = Retry(
        total=4,
        backoff_factor=0.8,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    http = requests.Session()
    http.headers.update({"User-Agent": config.USER_AGENT})
    http.mount("https://", HTTPAdapter(max_retries=retry))
    return http


def curated_satcats(cur) -> list[int]:
    cur.execute(
        """
        SELECT DISTINCT value::bigint AS satcat
          FROM artifact_catalog_id
         WHERE scheme = 'SATCAT' AND value ~ '^[0-9]+$'
         ORDER BY satcat
        """
    )
    return [int(row["satcat"]) for row in cur.fetchall()]


def chunks(values: list[int], size: int) -> Iterable[list[int]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def fetch_batch(http: requests.Session, satcats: list[int]) -> list[dict[str, Any]]:
    response = http.get(
        GP_URL,
        params={
            "CATNR": ",".join(str(value) for value in satcats),
            "FORMAT": "JSON",
        },
        timeout=60,
    )
    response.raise_for_status()
    if not response.content.strip():
        return []
    payload = response.json()
    if isinstance(payload, dict):
        return [payload]
    return list(payload)


def epoch(value: str) -> datetime:
    text = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def upsert(cur, records: list[dict[str, Any]]) -> int:
    written = 0
    for record in records:
        try:
            satcat = int(record["NORAD_CAT_ID"])
            stamp = epoch(record["EPOCH"])
            inclination = float(record["INCLINATION"])
            raan = float(record["RA_OF_ASC_NODE"])
            eccentricity = float(record["ECCENTRICITY"])
            arg_perigee = float(record["ARG_OF_PERICENTER"])
            anomaly = float(record["MEAN_ANOMALY"])
            motion = float(record["MEAN_MOTION"])
        except (KeyError, TypeError, ValueError) as exc:
            print(f"skip malformed OMM record: {exc}", file=sys.stderr)
            continue

        cur.execute(
            """
            INSERT INTO gp_element (
                satcat_no, object_name, epoch, inclination_deg, raan_deg,
                eccentricity, arg_perigee_deg, mean_anomaly_deg,
                mean_motion_rev_day, bstar, mean_motion_dot, mean_motion_ddot,
                ephemeris_type, classification, source_id, raw_omm
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, 'celestrak', %s
            )
            ON CONFLICT (satcat_no, epoch) DO UPDATE SET
                object_name = EXCLUDED.object_name,
                inclination_deg = EXCLUDED.inclination_deg,
                raan_deg = EXCLUDED.raan_deg,
                eccentricity = EXCLUDED.eccentricity,
                arg_perigee_deg = EXCLUDED.arg_perigee_deg,
                mean_anomaly_deg = EXCLUDED.mean_anomaly_deg,
                mean_motion_rev_day = EXCLUDED.mean_motion_rev_day,
                bstar = EXCLUDED.bstar,
                mean_motion_dot = EXCLUDED.mean_motion_dot,
                mean_motion_ddot = EXCLUDED.mean_motion_ddot,
                ephemeris_type = EXCLUDED.ephemeris_type,
                classification = EXCLUDED.classification,
                fetched_at = now(),
                raw_omm = EXCLUDED.raw_omm
            """,
            (
                satcat,
                record.get("OBJECT_NAME"),
                stamp,
                inclination,
                raan,
                eccentricity,
                arg_perigee,
                anomaly,
                motion,
                record.get("BSTAR"),
                record.get("MEAN_MOTION_DOT"),
                record.get("MEAN_MOTION_DDOT"),
                record.get("EPHEMERIS_TYPE"),
                record.get("CLASSIFICATION"),
                record,
            ),
        )
        written += 1
    return written


def prune(cur, curated: list[int]) -> int:
    cur.execute(
        """
        DELETE FROM gp_element
         WHERE fetched_at < now() - interval '30 days'
           AND NOT (satcat_no = ANY(%s))
        """,
        (curated,),
    )
    return cur.rowcount


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--batch", type=int, default=BATCH)
    args = parser.parse_args(argv)

    http = session()
    with db.connect() as conn:
        with db.try_advisory_lock(conn, "etl.celestrak_refresh") as locked:
            if not locked:
                print("another CelesTrak refresh is active", file=sys.stderr)
                return 2

            with conn.cursor() as cur:
                curated = curated_satcats(cur)
            if not curated:
                print("no curated SATCAT identifiers; nothing to do", file=sys.stderr)
                return 0
            if args.dry_run:
                print(f"would fetch {len(curated)} SATCAT identifiers", file=sys.stderr)
                return 0

            run_id = db.start_run(conn, source_id="celestrak", job="celestrak_refresh")
            conn.commit()

            read = written = 0
            try:
                for batch in chunks(curated, args.batch):
                    records = fetch_batch(http, batch)
                    read += len(records)
                    with conn.cursor() as cur:
                        written += upsert(cur, records)
                    conn.commit()

                with conn.cursor() as cur:
                    removed = prune(cur, curated)
                conn.commit()
                db.finish_run(
                    conn,
                    run_id,
                    status="succeeded",
                    rows_read=read,
                    rows_written=written,
                    notes=f"satcats={len(curated)} pruned={removed}",
                )
                conn.commit()
            except Exception as exc:  # noqa: BLE001 - record and re-raise
                conn.rollback()
                db.finish_run(
                    conn,
                    run_id,
                    status="failed",
                    rows_read=read,
                    rows_written=written,
                    notes=str(exc),
                )
                conn.commit()
                raise

    print(
        f"CelesTrak: {written} element sets written, {read} records read",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
