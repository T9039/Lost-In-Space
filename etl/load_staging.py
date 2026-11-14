"""Load raw GCAT TSVs into the disposable ``staging`` tables.

Nothing here is parsed or typed: every column stays text, and every row records
the file and data-row number it came from. A bad release is therefore auditable
and a failed transform never requires a re-download.

Usage:

    python -m etl.load_staging
    python -m etl.load_staging --data-dir /srv/gcat --only satcat,deepcat
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator

import psycopg

from etl import config, db

OBJECT_COLUMNS = (
    "jcat, satcat, launch_tag, piece, type, name, pl_name, ldate, parent, "
    "sdate, primary_body, ddate, status, dest, owner, state, manufacturer, bus, "
    "motor, mass, mass_flag, dry_mass, dry_flag, tot_mass, tot_flag, length, "
    "length_flag, diameter, diameter_flag, span, span_flag, shape, odate, "
    "perigee, perigee_flag, apogee, apogee_flag, inc, inc_flag, op_orbit, "
    "oqual, alt_names"
).replace(" ", "").split(",")

LANDER_COLUMNS = (
    "jcat, piece, name, owner, state, world, lon, lat, ltype, status, "
    "launch_date, land_date, off_date, dur, lsite, comment"
).replace(" ", "").split(",")

LAUNCH_COLUMNS = (
    "launch_tag, launch_jd, launch_date, lv_type, variant, fairing, flight_id, "
    "flight, mission, flight_code, platform, launch_site, launch_pad, "
    "ascent_site, ascent_pad, perigee, apogee, apoflag, inc, azimuth, range, "
    "rangeflag, dest, orb_mass, orb_pay, agency, launch_code, fail_code, "
    "group_code, category, ltcite, cite, notes"
).replace(" ", "").split(",")

PAYLOAD_META_COLUMNS = (
    "jcat, piece, name, ldate, tlast, top, tdate, tf, program, plane, att, mvr, "
    "class, category, result, control, discipline, un_state, un_reg, un_period, "
    "un_perigee, un_apogee, un_inc, disp_epoch, disp_peri, disp_apo, disp_inc, "
    "comment"
).replace(" ", "").split(",")

ORG_COLUMNS = (
    "code, ucode, state_code, org_type, org_class, tstart, tstop, short_name, "
    "name, location, longitude, latitude, error, parent, short_ename, ename, "
    "uname"
).replace(" ", "").split(",")

SITE_COLUMNS = (
    "site, code, ucode, site_type, state_code, tstart, tstop, short_name, name, "
    "location, longitude, latitude, error, parent, short_ename, ename, "
    "group_name, uname"
).replace(" ", "").split(",")


@dataclass(frozen=True)
class Spec:
    relative: str
    table: str
    columns: tuple[str, ...]

    @property
    def expected(self) -> int:
        return len(self.columns)


SPECS = (
    Spec("cat/satcat.tsv", "staging.gcat_object", tuple(OBJECT_COLUMNS)),
    Spec("cat/deepcat.tsv", "staging.gcat_object", tuple(OBJECT_COLUMNS)),
    Spec("cat/hcocat.tsv", "staging.gcat_object", tuple(OBJECT_COLUMNS)),
    Spec("cat/csocat.tsv", "staging.gcat_object", tuple(OBJECT_COLUMNS)),
    Spec("cat/landercat.tsv", "staging.gcat_lander", tuple(LANDER_COLUMNS)),
    Spec("cat/psatcat.tsv", "staging.gcat_payload_meta", tuple(PAYLOAD_META_COLUMNS)),
    Spec("tables/orgs.tsv", "staging.gcat_org", tuple(ORG_COLUMNS)),
    Spec("tables/sites.tsv", "staging.gcat_site", tuple(SITE_COLUMNS)),
)


def data_rows(path: Path, expected: int) -> Iterator[tuple[list[str], int]]:
    """Yield (fields, data_row_number), skipping comment and blank lines."""
    row_number = 0
    with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
        for physical, line in enumerate(handle, start=1):
            if line.startswith("#"):
                continue
            line = line.rstrip("\r\n")
            if not line.strip():
                continue
            row_number += 1
            fields = line.split("\t")
            if len(fields) != expected:
                raise ValueError(
                    f"{path}:{physical}: expected {expected} fields, found {len(fields)}"
                )
            yield fields, row_number


def copy_spec(conn: psycopg.Connection, spec: Spec, data_dir: Path) -> tuple[int, int]:
    path = data_dir / spec.relative
    if not path.exists():
        return (0, 0)

    columns = ", ".join(spec.columns)
    statement = (
        f"COPY {spec.table} ({columns}, source_file, source_row) FROM STDIN"
    )
    read = written = 0
    with conn.cursor() as cur:
        with cur.copy(statement) as copy:
            for fields, row_number in data_rows(path, spec.expected):
                copy.write_row([*fields, spec.relative, str(row_number)])
                written += 1
                read += 1
                if written % config.COPY_BATCH == 0:
                    print(f"  {spec.table}: {written} rows", file=sys.stderr)
    return read, written


def copy_launches(conn: psycopg.Connection, data_dir: Path) -> tuple[int, int]:
    folder = data_dir / "launch"
    if not folder.exists():
        return (0, 0)

    spec = Spec("launch/*.tsv", "staging.gcat_launch", tuple(LAUNCH_COLUMNS))
    columns = ", ".join(spec.columns)
    statement = f"COPY {spec.table} ({columns}, source_file, source_row) FROM STDIN"
    read = written = 0

    files = sorted(folder.glob("*.tsv"))
    if not files:
        return (0, 0)

    with conn.cursor() as cur:
        with cur.copy(statement) as copy:
            for path in files:
                relative = f"launch/{path.name}"
                for fields, row_number in data_rows(path, spec.expected):
                    copy.write_row([*fields, relative, str(row_number)])
                    written += 1
                    read += 1
    print(f"  {spec.table}: {written} rows from {len(files)} files", file=sys.stderr)
    return read, written


def selected(specs: Iterable[Spec], only: set[str] | None) -> list[Spec]:
    if only is None:
        return list(specs)
    return [spec for spec in specs if Path(spec.relative).stem in only or spec.relative in only]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=config.DATA_DIR)
    parser.add_argument("--only", help="Comma-separated file stems, e.g. satcat,orgs")
    args = parser.parse_args(argv)

    only = {part.strip() for part in args.only.split(",")} if args.only else None
    specs = selected(SPECS, only)

    with db.connect() as conn:
        with db.try_advisory_lock(conn, "etl.load_staging") as locked:
            if not locked:
                print("another load_staging run is active", file=sys.stderr)
                return 2

            tables = sorted({spec.table for spec in specs})
            if only is None:
                tables.append("staging.gcat_launch")
            with conn.cursor() as cur:
                for table in tables:
                    cur.execute(f"TRUNCATE {table}")
            conn.commit()

            total_read = total_written = 0
            for spec in specs:
                read, written = copy_spec(conn, spec, args.data_dir)
                if written == 0 and not (args.data_dir / spec.relative).exists():
                    print(f"  skip {spec.relative} (not downloaded)", file=sys.stderr)
                total_read += read
                total_written += written
                conn.commit()

            if only is None:
                read, written = copy_launches(conn, args.data_dir)
                total_read += read
                total_written += written
                conn.commit()

    print(f"loaded {total_written} rows into staging", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
