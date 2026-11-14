"""Promote staging rows into the canonical tables.

Two things happen here:

1. Lookups (organizations, sites, launches) are upserted from staging. They are
   deterministic and do not need curation.
2. A curated target file names the physical artifacts to build, the JCAT phases
   that belong to each one, and any explicit relations. This is the point where
   identity resolution stops being automatic: the ETL proposes, the target file
   records the human decision.

Run ``validate`` afterwards. Everything is one transaction; a failure leaves the
previous canonical rows in place.

Usage:

    python -m etl.transform
    python -m etl.transform --targets etl/targets.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg

from etl import config, db, parse, vague_date

ZONES = {"moon", "mars", "earth_orbit", "deep_space", "other"}
PARENT_RE = re.compile(r"^([A-Z]\d{5})")
WORLD_BODY = {"Luna": "Moon", "Moon": "Moon", "Mars": "Mars", "Venus": "Venus"}


def _slugify(value: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return text or "location"


def _as_date(raw: str | None) -> vague_date.VagueDate:
    return vague_date.parse(raw)


def _epoch_key(value: vague_date.VagueDate) -> tuple[int, datetime]:
    floor = datetime(1, 1, 1, tzinfo=timezone.utc)
    return (0, value.best) if value.best else (1, floor)


def _org_set(cur: psycopg.Cursor) -> set[str]:
    cur.execute("SELECT org_code FROM organization")
    return {row["org_code"] for row in cur.fetchall()}


def _site_set(cur: psycopg.Cursor) -> set[str]:
    cur.execute("SELECT site_code FROM site")
    return {row["site_code"] for row in cur.fetchall()}


def _status_set(cur: psycopg.Cursor) -> set[str]:
    cur.execute("SELECT code FROM phase_status")
    return {row["code"] for row in cur.fetchall()}


def _orbit_set(cur: psycopg.Cursor) -> set[str]:
    cur.execute("SELECT code FROM orbit_category")
    return {row["code"] for row in cur.fetchall()}


def _sat_type_set(cur: psycopg.Cursor) -> set[str]:
    cur.execute("SELECT code FROM sat_type_coarse")
    return {row["code"] for row in cur.fetchall()}


def _zone(cur: psycopg.Cursor, primary_body: str | None, op_orbit: str | None, world: str | None) -> str:
    cur.execute(
        "SELECT derive_zone(%s, %s, %s) AS zone",
        (primary_body, op_orbit, world),
    )
    return cur.fetchone()["zone"]


def promote_organizations(cur: psycopg.Cursor) -> int:
    cur.execute("SELECT * FROM staging.gcat_org ORDER BY code")
    rows = cur.fetchall()
    written = 0
    for row in rows:
        code = parse.clean(row["code"])
        if not code:
            continue
        start = _as_date(row["tstart"])
        stop = _as_date(row["tstop"])
        cur.execute(
            """
            INSERT INTO organization (
                org_code, ucode, state_code, org_type, org_class,
                short_name, name, location_text, longitude_deg, latitude_deg,
                coord_error, short_en_name, en_name, un_name,
                valid_from_raw, valid_from, valid_from_precision,
                valid_to_raw, valid_to, valid_to_precision,
                source_id, source_row
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                'gcat', %s
            )
            ON CONFLICT (org_code) DO UPDATE SET
                ucode = EXCLUDED.ucode,
                state_code = EXCLUDED.state_code,
                org_type = EXCLUDED.org_type,
                org_class = EXCLUDED.org_class,
                short_name = EXCLUDED.short_name,
                name = EXCLUDED.name,
                location_text = EXCLUDED.location_text,
                longitude_deg = EXCLUDED.longitude_deg,
                latitude_deg = EXCLUDED.latitude_deg,
                coord_error = EXCLUDED.coord_error,
                short_en_name = EXCLUDED.short_en_name,
                en_name = EXCLUDED.en_name,
                un_name = EXCLUDED.un_name,
                valid_from_raw = EXCLUDED.valid_from_raw,
                valid_from = EXCLUDED.valid_from,
                valid_from_precision = EXCLUDED.valid_from_precision,
                valid_to_raw = EXCLUDED.valid_to_raw,
                valid_to = EXCLUDED.valid_to,
                valid_to_precision = EXCLUDED.valid_to_precision,
                source_row = EXCLUDED.source_row
            """,
            (
                code,
                parse.clean(row["ucode"]),
                parse.clean(row["state_code"]),
                parse.clean(row["org_type"]),
                parse.clean(row["org_class"]),
                parse.clean(row["short_name"]),
                parse.clean(row["name"]) or code,
                parse.clean(row["location"]),
                parse.parse_float(row["longitude"]),
                parse.parse_float(row["latitude"]),
                parse.parse_float(row["error"]),
                parse.clean(row["short_ename"]),
                parse.clean(row["ename"]),
                parse.clean(row["uname"]),
                start.raw,
                start.best,
                start.precision,
                stop.raw,
                stop.best,
                stop.precision,
                f"tables/orgs.tsv#{row['source_row']}",
            ),
        )
        written += 1

    # Resolve parents only after every organization exists.
    for row in rows:
        code = parse.clean(row["code"])
        parent = parse.clean(row["parent"])
        if code and parent:
            cur.execute(
                """
                UPDATE organization SET parent_org_code = %s
                 WHERE org_code = %s
                   AND EXISTS (SELECT 1 FROM organization WHERE org_code = %s)
                """,
                (parent, code, parent),
            )
    return written


def promote_sites(cur: psycopg.Cursor) -> int:
    cur.execute("SELECT * FROM staging.gcat_site ORDER BY site")
    rows = cur.fetchall()
    written = 0
    for row in rows:
        code = parse.clean(row["site"])
        if not code:
            continue
        start = _as_date(row["tstart"])
        stop = _as_date(row["tstop"])
        cur.execute(
            """
            INSERT INTO site (
                site_code, code, ucode, site_type, state_code,
                short_name, name, location_text, longitude_deg, latitude_deg,
                coord_error, short_en_name, en_name, group_name, un_name,
                valid_from_raw, valid_from, valid_from_precision,
                valid_to_raw, valid_to, valid_to_precision,
                source_id, source_row
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                'gcat', %s
            )
            ON CONFLICT (site_code) DO UPDATE SET
                code = EXCLUDED.code,
                ucode = EXCLUDED.ucode,
                site_type = EXCLUDED.site_type,
                state_code = EXCLUDED.state_code,
                short_name = EXCLUDED.short_name,
                name = EXCLUDED.name,
                location_text = EXCLUDED.location_text,
                longitude_deg = EXCLUDED.longitude_deg,
                latitude_deg = EXCLUDED.latitude_deg,
                coord_error = EXCLUDED.coord_error,
                short_en_name = EXCLUDED.short_en_name,
                en_name = EXCLUDED.en_name,
                group_name = EXCLUDED.group_name,
                un_name = EXCLUDED.un_name,
                valid_from_raw = EXCLUDED.valid_from_raw,
                valid_from = EXCLUDED.valid_from,
                valid_from_precision = EXCLUDED.valid_from_precision,
                valid_to_raw = EXCLUDED.valid_to_raw,
                valid_to = EXCLUDED.valid_to,
                valid_to_precision = EXCLUDED.valid_to_precision,
                source_row = EXCLUDED.source_row
            """,
            (
                code,
                parse.clean(row["code"]),
                parse.clean(row["ucode"]),
                parse.clean(row["site_type"]),
                parse.clean(row["state_code"]),
                parse.clean(row["short_name"]),
                parse.clean(row["name"]) or code,
                parse.clean(row["location"]),
                parse.parse_float(row["longitude"]),
                parse.parse_float(row["latitude"]),
                parse.parse_float(row["error"]),
                parse.clean(row["short_ename"]),
                parse.clean(row["ename"]),
                parse.clean(row["group_name"]),
                parse.clean(row["uname"]),
                start.raw,
                start.best,
                start.precision,
                stop.raw,
                stop.best,
                stop.precision,
                f"tables/sites.tsv#{row['source_row']}",
            ),
        )
        written += 1

    for row in rows:
        code = parse.clean(row["site"])
        parent = parse.clean(row["parent"])
        if code and parent:
            cur.execute(
                """
                UPDATE site SET parent_site_code = %s
                 WHERE site_code = %s
                   AND EXISTS (SELECT 1 FROM site WHERE site_code = %s)
                """,
                (parent, code, parent),
            )
    return written


def promote_launches(
    cur: psycopg.Cursor, orgs: set[str], sites: set[str]
) -> tuple[int, set[str]]:
    cur.execute(
        """
        SELECT DISTINCT ON (launch_tag) *
          FROM staging.gcat_launch
         WHERE launch_tag IS NOT NULL AND launch_tag <> '-'
         ORDER BY launch_tag, source_file, source_row
        """
    )
    rows = cur.fetchall()
    written = 0
    ids: set[str] = set()
    for row in rows:
        tag = parse.clean(row["launch_tag"])
        if not tag:
            continue
        date = _as_date(row["launch_date"])
        site = parse.clean(row["launch_site"])
        ascent = parse.clean(row["ascent_site"])
        agency = parse.clean(row["agency"])
        citation = parse.clean(row["cite"]) or parse.clean(row["ltcite"])
        cur.execute(
            """
            INSERT INTO launch (
                launch_id, launch_jd, date_raw, date_best, date_precision,
                date_approx, cospar_launch_id, lv_type, lv_variant, fairing,
                flight_id, flight, mission, flight_code, platform,
                launch_site_code, launch_pad, ascent_site_code, ascent_pad,
                perigee_km, apogee_km, apogee_flag, inclination_deg,
                azimuth_deg, range_km, range_flag, dest_raw, orbit_mass_kg,
                orbit_payload_kg, agency_org_code, launch_code, fail_code,
                group_code, category, citation, notes,
                source_id, source_row
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                'gcat', %s
            )
            ON CONFLICT (launch_id) DO UPDATE SET
                launch_jd = EXCLUDED.launch_jd,
                date_raw = EXCLUDED.date_raw,
                date_best = EXCLUDED.date_best,
                date_precision = EXCLUDED.date_precision,
                date_approx = EXCLUDED.date_approx,
                lv_type = EXCLUDED.lv_type,
                lv_variant = EXCLUDED.lv_variant,
                fairing = EXCLUDED.fairing,
                mission = EXCLUDED.mission,
                launch_site_code = EXCLUDED.launch_site_code,
                launch_pad = EXCLUDED.launch_pad,
                ascent_site_code = EXCLUDED.ascent_site_code,
                ascent_pad = EXCLUDED.ascent_pad,
                perigee_km = EXCLUDED.perigee_km,
                apogee_km = EXCLUDED.apogee_km,
                inclination_deg = EXCLUDED.inclination_deg,
                dest_raw = EXCLUDED.dest_raw,
                orbit_mass_kg = EXCLUDED.orbit_mass_kg,
                orbit_payload_kg = EXCLUDED.orbit_payload_kg,
                agency_org_code = EXCLUDED.agency_org_code,
                citation = EXCLUDED.citation,
                notes = EXCLUDED.notes,
                source_row = EXCLUDED.source_row
            """,
            (
                tag,
                parse.parse_float(row["launch_jd"]),
                date.raw,
                date.best,
                date.precision,
                date.approx,
                tag,
                parse.clean(row["lv_type"]),
                parse.clean(row["variant"]),
                parse.clean(row["fairing"]),
                parse.clean(row["flight_id"]),
                parse.clean(row["flight"]),
                parse.clean(row["mission"]),
                parse.clean(row["flight_code"]),
                parse.clean(row["platform"]),
                site if site in sites else None,
                parse.clean(row["launch_pad"]),
                ascent if ascent in sites else None,
                parse.clean(row["ascent_pad"]),
                parse.parse_float(row["perigee"]),
                parse.parse_float(row["apogee"]),
                parse.clean(row["apoflag"]),
                parse.parse_float(row["inc"]),
                parse.parse_float(row["azimuth"]),
                parse.parse_float(row["range"]),
                parse.clean(row["rangeflag"]),
                parse.clean(row["dest"]),
                parse.parse_float(row["orb_mass"]),
                parse.parse_float(row["orb_pay"]),
                agency if agency in orgs else None,
                parse.clean(row["launch_code"]),
                parse.clean(row["fail_code"]),
                parse.clean(row["group_code"]),
                parse.clean(row["category"]),
                citation,
                parse.clean(row["notes"]),
                f"{row['source_file']}#{row['source_row']}",
            ),
        )
        ids.add(tag)
        written += 1
    return written, ids


def _location_for(
    cur: psycopg.Cursor, lander: dict[str, Any] | None
) -> int | None:
    if not lander:
        return None
    world = parse.clean(lander["world"]) or "Unknown"
    body = WORLD_BODY.get(world, world)
    site_name = parse.clean(lander["lsite"])
    name = site_name if site_name else f"{parse.clean(lander['name']) or 'Unknown'} site"
    lat = parse.parse_float(lander["lat"])
    lon = parse.parse_float(lander["lon"])
    precision = "approx" if lat is not None and lon is not None else "none"
    slug = _slugify(f"{body} {name}")
    cur.execute(
        """
        INSERT INTO location (
            slug, name, kind, body, latitude_deg, longitude_deg,
            coordinate_precision, source_id
        ) VALUES (%s, %s, 'surface_site', %s, %s, %s, %s, 'gcat')
        ON CONFLICT (name, body, kind) DO UPDATE SET
            latitude_deg = COALESCE(EXCLUDED.latitude_deg, location.latitude_deg),
            longitude_deg = COALESCE(EXCLUDED.longitude_deg, location.longitude_deg),
            coordinate_precision = CASE
                WHEN EXCLUDED.latitude_deg IS NOT NULL THEN EXCLUDED.coordinate_precision
                ELSE location.coordinate_precision
            END
        RETURNING location_id
        """,
        (slug, name, body, lat, lon, precision),
    )
    return int(cur.fetchone()["location_id"])


def promote_artifact(
    cur: psycopg.Cursor,
    spec: dict[str, Any],
    *,
    orgs: set[str],
    launches: set[str],
    statuses: set[str],
    orbits: set[str],
    sat_types: set[str],
    landers: dict[str, dict[str, Any]],
) -> tuple[Any, int, int]:
    slug = spec["slug"]
    jcats = list(spec.get("jcats") or [])
    if not jcats:
        raise ValueError(f"{slug}: no jcats")

    cur.execute(
        "SELECT * FROM staging.gcat_object WHERE btrim(jcat) = ANY(%s)", (jcats,)
    )
    rows = [row for row in cur.fetchall() if parse.clean(row["jcat"])]
    if not rows:
        raise ValueError(f"{slug}: no staging rows for {jcats}")

    rows.sort(key=lambda row: (_epoch_key(_as_date(row["sdate"])), row["jcat"]))
    first = rows[0]
    zone = spec.get("primary_zone", "other")
    if zone not in ZONES:
        raise ValueError(f"{slug}: invalid zone {zone!r}")

    sat_type = parse.clean(first["type"])
    coarse = sat_type[0] if sat_type and sat_type[0] in sat_types else None
    owner = parse.clean(first["owner"])
    state = parse.clean(first["state"])
    maker = parse.clean(first["manufacturer"])

    cur.execute(
        """
        INSERT INTO artifact (
            slug, canonical_name, short_name, sat_type_raw, sat_type_coarse,
            owner_org_code, state_org_code, manufacturer_org_code,
            mass_kg, dry_mass_kg, total_mass_kg,
            length_m, diameter_m, span_m, shape,
            primary_zone, is_curated, source_id, source_row
        ) VALUES (
            %s, %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, 'gcat', %s
        )
        ON CONFLICT (slug) DO UPDATE SET
            canonical_name = EXCLUDED.canonical_name,
            short_name = EXCLUDED.short_name,
            sat_type_raw = EXCLUDED.sat_type_raw,
            sat_type_coarse = EXCLUDED.sat_type_coarse,
            owner_org_code = EXCLUDED.owner_org_code,
            state_org_code = EXCLUDED.state_org_code,
            manufacturer_org_code = EXCLUDED.manufacturer_org_code,
            mass_kg = EXCLUDED.mass_kg,
            dry_mass_kg = EXCLUDED.dry_mass_kg,
            total_mass_kg = EXCLUDED.total_mass_kg,
            length_m = EXCLUDED.length_m,
            diameter_m = EXCLUDED.diameter_m,
            span_m = EXCLUDED.span_m,
            shape = EXCLUDED.shape,
            primary_zone = EXCLUDED.primary_zone,
            is_curated = EXCLUDED.is_curated,
            source_row = EXCLUDED.source_row,
            updated_at = now()
        RETURNING artifact_id
        """,
        (
            slug,
            spec.get("canonical_name") or parse.clean(first["name"]) or slug,
            spec.get("short_name") or parse.clean(first["name"]),
            sat_type,
            coarse,
            owner if owner in orgs else None,
            state if state in orgs else None,
            maker if maker in orgs else None,
            parse.parse_float(first["mass"]),
            parse.parse_float(first["dry_mass"]),
            parse.parse_float(first["tot_mass"]),
            parse.parse_float(first["length"]),
            parse.parse_float(first["diameter"]),
            parse.parse_float(first["span"]),
            parse.clean(first["shape"]),
            zone,
            bool(spec.get("is_curated", False)),
            f"{first['source_file']}#{first['source_row']}",
        ),
    )
    artifact_id = cur.fetchone()["artifact_id"]

    # ---- catalog identifiers -------------------------------------------------
    primary_seen: set[str] = set()
    for index, row in enumerate(rows):
        start = _as_date(row["sdate"])
        stop = _as_date(row["ddate"])
        aliases: list[tuple[str, str, bool]] = [("JCAT", row["jcat"], index == 0)]
        satcat = parse.clean(row["satcat"])
        if satcat:
            aliases.append(("SATCAT", satcat, "SATCAT" not in primary_seen))
        piece = parse.cospar_piece(row["piece"])
        if piece:
            aliases.append(("COSPAR", piece, "COSPAR" not in primary_seen))

        for scheme, value, wants_primary in aliases:
            is_primary = bool(wants_primary and scheme not in primary_seen)
            if is_primary:
                cur.execute(
                    """
                    UPDATE artifact_catalog_id SET is_primary = false
                     WHERE artifact_id = %s AND scheme = %s
                       AND is_primary AND value <> %s
                    """,
                    (artifact_id, scheme, value),
                )
                primary_seen.add(scheme)
            cur.execute(
                """
                INSERT INTO artifact_catalog_id (
                    artifact_id, scheme, value, is_primary,
                    valid_from_raw, valid_from, valid_from_precision, valid_from_approx,
                    valid_to_raw, valid_to, valid_to_precision, valid_to_approx,
                    source_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'gcat')
                ON CONFLICT (artifact_id, scheme, value) DO UPDATE SET
                    is_primary = artifact_catalog_id.is_primary OR EXCLUDED.is_primary,
                    valid_from_raw = EXCLUDED.valid_from_raw,
                    valid_from = EXCLUDED.valid_from,
                    valid_from_precision = EXCLUDED.valid_from_precision,
                    valid_from_approx = EXCLUDED.valid_from_approx,
                    valid_to_raw = EXCLUDED.valid_to_raw,
                    valid_to = EXCLUDED.valid_to,
                    valid_to_precision = EXCLUDED.valid_to_precision,
                    valid_to_approx = EXCLUDED.valid_to_approx
                """,
                (
                    artifact_id,
                    scheme,
                    value,
                    is_primary,
                    start.raw,
                    start.best,
                    start.precision,
                    start.approx,
                    stop.raw,
                    stop.best,
                    stop.precision,
                    stop.approx,
                ),
            )

    # ---- phases --------------------------------------------------------------
    phase_count = 0
    positions: dict[str, int] = {}
    for index, row in enumerate(rows, start=1):
        jcat = parse.clean(row["jcat"])
        position = positions.get(jcat, 0) + 1
        positions[jcat] = position
        phase_key = f"{jcat}:{position}"
        lander = landers.get(jcat)
        world = parse.clean(lander["world"]) if lander else None
        location_id = _location_for(cur, lander)
        start = _as_date(row["sdate"])
        stop = _as_date(row["ddate"])
        epoch = _as_date(row["odate"])
        status = parse.clean(row["status"])
        orbit = parse.clean(row["op_orbit"])
        launch = parse.clean(row["launch_tag"])

        cur.execute(
            """
            INSERT INTO artifact_phase (
                artifact_id, seq, jcat_id, phase_key, launch_id, parent_ref_raw,
                primary_body, zone, location_id,
                start_raw, start_best, start_precision, start_approx,
                end_raw, end_best, end_precision, end_approx,
                status_code, dest_raw, orbit_category_code,
                perigee_km, apogee_km, inclination_deg,
                epoch_raw, epoch_best, epoch_precision, epoch_approx,
                source_id, source_row
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                'gcat', %s
            )
            ON CONFLICT (phase_key) DO UPDATE SET
                artifact_id = EXCLUDED.artifact_id,
                seq = EXCLUDED.seq,
                launch_id = EXCLUDED.launch_id,
                parent_ref_raw = EXCLUDED.parent_ref_raw,
                primary_body = EXCLUDED.primary_body,
                zone = EXCLUDED.zone,
                location_id = EXCLUDED.location_id,
                start_raw = EXCLUDED.start_raw,
                start_best = EXCLUDED.start_best,
                start_precision = EXCLUDED.start_precision,
                start_approx = EXCLUDED.start_approx,
                end_raw = EXCLUDED.end_raw,
                end_best = EXCLUDED.end_best,
                end_precision = EXCLUDED.end_precision,
                end_approx = EXCLUDED.end_approx,
                status_code = EXCLUDED.status_code,
                dest_raw = EXCLUDED.dest_raw,
                orbit_category_code = EXCLUDED.orbit_category_code,
                perigee_km = EXCLUDED.perigee_km,
                apogee_km = EXCLUDED.apogee_km,
                inclination_deg = EXCLUDED.inclination_deg,
                epoch_raw = EXCLUDED.epoch_raw,
                epoch_best = EXCLUDED.epoch_best,
                epoch_precision = EXCLUDED.epoch_precision,
                epoch_approx = EXCLUDED.epoch_approx,
                source_row = EXCLUDED.source_row
            """,
            (
                artifact_id,
                index,
                jcat,
                phase_key,
                launch if launch in launches else None,
                parse.clean(row["parent"]),
                parse.clean(row["primary_body"]),
                _zone(cur, parse.clean(row["primary_body"]), orbit, world),
                location_id,
                start.raw,
                start.best,
                start.precision,
                start.approx,
                stop.raw,
                stop.best,
                stop.precision,
                stop.approx,
                status if status in statuses else None,
                parse.clean(row["dest"]),
                orbit if orbit in orbits else None,
                parse.parse_float(row["perigee"]),
                parse.parse_float(row["apogee"]),
                parse.parse_float(row["inc"]),
                epoch.raw,
                epoch.best,
                epoch.precision,
                epoch.approx,
                f"{row['source_file']}#{row['source_row']}",
            ),
        )
        phase_count += 1

    return artifact_id, len(rows), phase_count


def resolve_parents(cur: psycopg.Cursor) -> int:
    cur.execute(
        """
        SELECT phase_id, parent_ref_raw
          FROM artifact_phase
         WHERE parent_ref_raw IS NOT NULL AND parent_artifact_id IS NULL
        """
    )
    rows = cur.fetchall()
    resolved = 0
    for row in rows:
        match = PARENT_RE.match(row["parent_ref_raw"].strip())
        if not match:
            continue
        parent_jcat = match.group(1)
        cur.execute(
            """
            SELECT artifact_id FROM artifact_phase
             WHERE jcat_id = %s
             ORDER BY seq
             LIMIT 1
            """,
            (parent_jcat,),
        )
        parent = cur.fetchone()
        if parent:
            cur.execute(
                "UPDATE artifact_phase SET parent_artifact_id = %s WHERE phase_id = %s",
                (parent["artifact_id"], row["phase_id"]),
            )
            resolved += 1
    return resolved


def promote_relations(
    cur: psycopg.Cursor, targets: list[dict[str, Any]], ids: dict[str, Any]
) -> int:
    written = 0
    for spec in targets:
        source_id = ids.get(spec["slug"])
        if not source_id:
            continue
        for relation in spec.get("relations") or []:
            target_id = ids.get(relation["to"])
            if not target_id:
                raise ValueError(
                    f"{spec['slug']}: relation target {relation['to']!r} was not built"
                )
            cur.execute(
                """
                INSERT INTO artifact_relation (
                    from_artifact_id, to_artifact_id, relation, source_id, note
                ) VALUES (%s, %s, %s, 'curated', %s)
                ON CONFLICT (from_artifact_id, to_artifact_id, relation) DO UPDATE
                    SET note = EXCLUDED.note
                """,
                (source_id, target_id, relation["kind"], relation.get("note")),
            )
            written += 1
    return written


def update_source(cur: psycopg.Cursor, manifest: dict[str, Any]) -> None:
    updated = manifest.get("updated")
    retrieved = manifest.get("retrieved_at")
    if not updated and not retrieved:
        return
    cur.execute(
        """
        UPDATE source
           SET last_release = COALESCE(%s, last_release),
               retrieved_at = COALESCE(%s, retrieved_at)
         WHERE source_id = 'gcat'
        """,
        (updated, retrieved),
    )


def load_manifest(data_dir: Path) -> dict[str, Any]:
    path = data_dir / "manifest.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--targets", type=Path, default=Path("etl/targets.json"))
    parser.add_argument("--data-dir", type=Path, default=config.DATA_DIR)
    args = parser.parse_args(argv)

    manifest = load_manifest(args.data_dir)
    targets: list[dict[str, Any]] = []
    if args.targets.exists():
        payload = json.loads(args.targets.read_text(encoding="utf-8"))
        targets = list(payload.get("artifacts") or [])
    else:
        print(
            f"note: {args.targets} not found; lookups only, no artifacts",
            file=sys.stderr,
        )

    ids: dict[str, Any] = {}
    phases = parents = relations = 0

    with db.connect() as conn:
        with db.try_advisory_lock(conn, "etl.transform") as locked:
            if not locked:
                print("another transform run is active", file=sys.stderr)
                return 2

            try:
                with db.transaction(conn):
                    with conn.cursor() as cur:
                        run_id = db.start_run(
                            conn,
                            source_id="gcat",
                            job="transform",
                            release_tag=manifest.get("updated"),
                        )
                        update_source(cur, manifest)
                        orgs_written = promote_organizations(cur)
                        orgs = _org_set(cur)
                        sites_written = promote_sites(cur)
                        sites = _site_set(cur)
                        launches_written, launches = promote_launches(cur, orgs, sites)
                        statuses = _status_set(cur)
                        orbits = _orbit_set(cur)
                        sat_types = _sat_type_set(cur)

                        cur.execute("SELECT * FROM staging.gcat_lander")
                        landers = {
                            parse.clean(row["jcat"]): row
                            for row in cur.fetchall()
                            if parse.clean(row["jcat"])
                        }

                        for spec in targets:
                            artifact_id, _catalogs, phase_count = promote_artifact(
                                cur,
                                spec,
                                orgs=orgs,
                                launches=launches,
                                statuses=statuses,
                                orbits=orbits,
                                sat_types=sat_types,
                                landers=landers,
                            )
                            ids[spec["slug"]] = artifact_id
                            phases += phase_count

                        parents = resolve_parents(cur)
                        relations = promote_relations(cur, targets, ids)

                        db.finish_run(
                            conn,
                            run_id,
                            status="succeeded",
                            rows_read=orgs_written + sites_written + launches_written,
                            rows_written=len(ids) + phases + relations,
                            notes=(
                                f"orgs={orgs_written} sites={sites_written} "
                                f"launches={launches_written} artifacts={len(ids)} "
                                f"phases={phases} parents={parents} relations={relations}"
                            ),
                        )
            except Exception as exc:  # noqa: BLE001 - record and re-raise
                conn.rollback()
                with conn.cursor() as cur:
                    failed_id = db.start_run(
                        conn, source_id="gcat", job="transform"
                    )
                db.finish_run(
                    conn,
                    failed_id,
                    status="failed",
                    rows_read=0,
                    rows_written=0,
                    notes=str(exc)[:1000],
                )
                conn.commit()
                raise

    print(
        f"promoted {len(ids)} artifacts, {phases} phases, "
        f"{relations} relations, {parents} parent links",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
