-- ============================================================================
--  Lost in Space — canonical database schema
--  PostgreSQL 16+
--
--  Design rules:
--    1. A physical artifact is separate from the catalog entry that names it,
--       and separate from the phase of its life that a catalog entry describes.
--    2. Every imported row records where it came from.
--    3. GCAT "VagueDate" values keep their raw string, a normalised value,
--       and a precision. Never pretend a year-only date is a timestamp.
--    4. The graph is a shape, not a required server. Lineage is queryable with
--       recursive CTEs; Apache AGE is an optional read-model projection.
--
--  Apply with:  psql "$DATABASE_URL" -f db/schema.sql
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy name search

-- ---------------------------------------------------------------------------
-- 1. Stable vocabularies
-- ---------------------------------------------------------------------------

CREATE TYPE date_precision AS ENUM (
    'year', 'month', 'day', 'hour', 'minute', 'second', 'unknown'
);

-- The four zones the product navigates by, plus an explicit escape hatch.
CREATE TYPE zone_kind AS ENUM (
    'moon', 'mars', 'earth_orbit', 'deep_space', 'other'
);

CREATE TYPE catalog_scheme AS ENUM (
    'JCAT', 'SATCAT', 'COSPAR', 'HORIZONS', 'OTHER'
);

CREATE TYPE relation_kind AS ENUM (
    'deployed_from',   -- released by a parent (rover from lander)
    'spawned_from',    -- separated, not necessarily deployed
    'component_of',    -- part of a larger artifact
    'attached_to',     -- physically attached for a period
    'landed_with',     -- arrived on the same landing event
    'left_behind_by',  -- explicitly abandoned by a crew or mission
    'crashed_into',    -- deliberate or accidental impact
    'reflight_of'      -- same vehicle flown again under a new identity
);

-- GCAT SatType byte 1 (coarse type). Full 12-byte string lives on artifact.
CREATE TABLE sat_type_coarse (
    code        char(1) PRIMARY KEY,
    name        text NOT NULL,
    description text NOT NULL
);

-- GCAT phase status codes (the `Status` column).
CREATE TABLE phase_status (
    code        text PRIMARY KEY,
    description text NOT NULL,
    externality text,
    notes       text
);

-- GCAT `OpOrbit` and derived orbit regimes.
CREATE TABLE orbit_category (
    code        text PRIMARY KEY,
    name        text NOT NULL,
    definition  text NOT NULL,
    sort_order  integer
);

-- ---------------------------------------------------------------------------
-- 2. Provenance and geography
-- ---------------------------------------------------------------------------

CREATE TABLE source (
    source_id      text PRIMARY KEY,          -- 'gcat', 'celestrak', ...
    name           text NOT NULL,
    homepage_url   text NOT NULL,
    license_name   text NOT NULL,
    license_url    text,
    citation       text NOT NULL,             -- exact credit line to display
    terms_note     text,                      -- redistribution / rate limits
    update_cadence text,
    last_release   text,
    retrieved_at   timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization (
    org_code          text PRIMARY KEY,       -- GCAT OrgCode
    ucode             text,
    state_code        text,
    org_type          text,
    org_class         text,
    short_name        text,
    name              text NOT NULL,
    location_text     text,
    longitude_deg     double precision,
    latitude_deg      double precision,
    coord_error       double precision,
    parent_org_code   text REFERENCES organization(org_code),
    short_en_name     text,
    en_name           text,
    un_name           text,
    valid_from_raw    text,
    valid_from        timestamptz,
    valid_from_precision date_precision,
    valid_to_raw      text,
    valid_to          timestamptz,
    valid_to_precision   date_precision,
    source_id         text NOT NULL REFERENCES source(source_id),
    source_row        text
);

CREATE TABLE site (
    site_code         text PRIMARY KEY,       -- GCAT Site
    code              text,
    ucode             text,
    site_type         text,
    state_code        text,
    short_name        text,
    name              text,
    location_text     text,
    longitude_deg     double precision,
    latitude_deg      double precision,
    coord_error       double precision,
    parent_site_code  text REFERENCES site(site_code),
    group_name        text,
    short_en_name     text,
    en_name           text,
    un_name           text,
    valid_from_raw    text,
    valid_from        timestamptz,
    valid_from_precision date_precision,
    valid_to_raw      text,
    valid_to          timestamptz,
    valid_to_precision   date_precision,
    source_id         text NOT NULL REFERENCES source(source_id),
    source_row        text
);

-- A place referenced by a phase or a fact: surface site, impact site, orbit
-- regime, Lagrange point, body. GCAT surface coordinates live here.
CREATE TABLE location (
    location_id          bigserial PRIMARY KEY,
    slug                 text NOT NULL UNIQUE,
    name                 text NOT NULL,
    kind                 text NOT NULL,       -- surface_site | impact_site | orbit_regime | lagrange_point | body | interplanetary | unknown
    body                 text NOT NULL DEFAULT 'Earth',
    latitude_deg         double precision,
    longitude_deg        double precision,
    altitude_km          double precision,
    coordinate_precision text,                -- exact | approx | region | none
    source_id            text REFERENCES source(source_id),
    notes                text,
    UNIQUE (name, body, kind)
);

-- ---------------------------------------------------------------------------
-- 3. Launch events
-- ---------------------------------------------------------------------------

CREATE TABLE launch (
    launch_id         text PRIMARY KEY,       -- GCAT Launch_Tag, e.g. 1969-059
    launch_jd         numeric(12,5),
    date_raw          text NOT NULL,
    date_best         timestamptz,
    date_precision    date_precision NOT NULL DEFAULT 'unknown',
    date_approx       boolean NOT NULL DEFAULT false,
    cospar_launch_id  text,                   -- e.g. 1969-059
    lv_type           text,
    lv_variant        text,
    fairing           text,
    flight_id         text,
    flight            text,
    mission           text,
    flight_code       text,
    platform          text,
    launch_site_code  text REFERENCES site(site_code),
    launch_pad        text,
    ascent_site_code  text REFERENCES site(site_code),
    ascent_pad        text,
    perigee_km        double precision,
    apogee_km         double precision,
    apogee_flag       text,
    inclination_deg   double precision,
    azimuth_deg       double precision,
    range_km          double precision,
    range_flag        text,
    dest_raw          text,
    orbit_mass_kg     numeric(12,3),
    orbit_payload_kg  numeric(12,3),
    agency_org_code   text REFERENCES organization(org_code),
    launch_code       text,
    fail_code         text,
    group_code        text,
    category          text,
    citation          text,
    notes             text,
    source_id         text NOT NULL REFERENCES source(source_id),
    source_row        text
);

CREATE INDEX launch_date_idx ON launch (date_best);
CREATE INDEX launch_site_idx ON launch (launch_site_code);

-- ---------------------------------------------------------------------------
-- 4. Artifacts: identity, catalog aliases, phases
-- ---------------------------------------------------------------------------

CREATE TABLE artifact (
    artifact_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                  text NOT NULL UNIQUE,
    canonical_name        text NOT NULL,
    short_name            text,
    alt_names             text[] NOT NULL DEFAULT '{}',
    sat_type_raw          text,               -- full 12-byte GCAT SatType string
    sat_type_coarse       char(1) REFERENCES sat_type_coarse(code),
    owner_org_code        text REFERENCES organization(org_code),
    state_org_code        text REFERENCES organization(org_code),
    manufacturer_org_code text REFERENCES organization(org_code),
    mass_kg               numeric(12,3),
    dry_mass_kg           numeric(12,3),
    total_mass_kg         numeric(12,3),
    length_m              numeric(10,3),
    diameter_m            numeric(10,3),
    span_m                numeric(10,3),
    shape                 text,
    primary_zone          zone_kind NOT NULL,
    is_curated            boolean NOT NULL DEFAULT false,
    curation_notes        text,
    source_id             text NOT NULL REFERENCES source(source_id),
    source_row            text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX artifact_zone_idx ON artifact (primary_zone);
CREATE INDEX artifact_name_trgm_idx ON artifact USING gin (canonical_name gin_trgm_ops);
CREATE INDEX artifact_alt_names_idx ON artifact USING gin (alt_names);

-- One row per external identifier. This is the ONLY place a catalog number
-- is allowed to be authoritative. The same physical object can hold several
-- JCAT IDs over its life and several SATCAT/COSPAR aliases at once.
CREATE TABLE artifact_catalog_id (
    catalog_id           bigserial PRIMARY KEY,
    artifact_id          uuid NOT NULL REFERENCES artifact(artifact_id) ON DELETE CASCADE,
    scheme               catalog_scheme NOT NULL,
    value                text NOT NULL,
    is_primary           boolean NOT NULL DEFAULT false,
    valid_from_raw       text,
    valid_from           timestamptz,
    valid_from_precision date_precision,
    valid_from_approx    boolean NOT NULL DEFAULT false,
    valid_to_raw         text,
    valid_to             timestamptz,
    valid_to_precision   date_precision,
    valid_to_approx      boolean NOT NULL DEFAULT false,
    source_id            text NOT NULL REFERENCES source(source_id),
    note                 text,
    UNIQUE (artifact_id, scheme, value)
);

CREATE INDEX artifact_catalog_id_lookup_idx ON artifact_catalog_id (scheme, value);
CREATE UNIQUE INDEX artifact_catalog_id_one_primary_idx
    ON artifact_catalog_id (artifact_id, scheme) WHERE is_primary;

-- A phase is one GCAT catalog row: the object in one state between two events.
-- `jcat_id` is the GCAT key for this phase, not for the artifact.
CREATE TABLE artifact_phase (
    phase_id            bigserial PRIMARY KEY,
    artifact_id         uuid NOT NULL REFERENCES artifact(artifact_id) ON DELETE CASCADE,
    seq                 integer NOT NULL,
    jcat_id             text UNIQUE,
    launch_id           text REFERENCES launch(launch_id),
    parent_ref_raw      text,                  -- GCAT Parent: EJCAT, body, or extended ref
    parent_artifact_id  uuid REFERENCES artifact(artifact_id),
    primary_body        text,
    zone                zone_kind,
    location_id         bigint REFERENCES location(location_id),
    start_raw           text,
    start_best          timestamptz,
    start_precision     date_precision,
    start_approx        boolean NOT NULL DEFAULT false,
    end_raw             text,
    end_best            timestamptz,
    end_precision       date_precision,
    end_approx          boolean NOT NULL DEFAULT false,
    status_code         text REFERENCES phase_status(code),
    dest_raw            text,
    orbit_category_code text REFERENCES orbit_category(code),
    perigee_km          double precision,
    apogee_km           double precision,
    inclination_deg     double precision,
    epoch_raw           text,
    epoch_best          timestamptz,
    epoch_precision     date_precision,
    epoch_approx        boolean NOT NULL DEFAULT false,
    notes               text,
    source_id           text NOT NULL REFERENCES source(source_id),
    source_row          text,
    UNIQUE (artifact_id, seq)
);

CREATE INDEX artifact_phase_artifact_idx ON artifact_phase (artifact_id, seq);
CREATE INDEX artifact_phase_launch_idx ON artifact_phase (launch_id);
CREATE INDEX artifact_phase_status_idx ON artifact_phase (status_code);
CREATE INDEX artifact_phase_parent_idx ON artifact_phase (parent_artifact_id);

-- Explicit, curated genealogy. GCAT's Parent chain is the raw evidence;
-- this table is the resolved, many-to-many answer.
CREATE TABLE artifact_relation (
    from_artifact_id uuid NOT NULL REFERENCES artifact(artifact_id) ON DELETE CASCADE,
    to_artifact_id   uuid NOT NULL REFERENCES artifact(artifact_id) ON DELETE CASCADE,
    relation         relation_kind NOT NULL,
    valid_from       timestamptz,
    valid_to         timestamptz,
    source_id        text NOT NULL REFERENCES source(source_id),
    note             text,
    PRIMARY KEY (from_artifact_id, to_artifact_id, relation),
    CHECK (from_artifact_id <> to_artifact_id)
);

CREATE INDEX artifact_relation_to_idx ON artifact_relation (to_artifact_id, relation);

-- ---------------------------------------------------------------------------
-- 5. Mission narrative and curated facts
-- ---------------------------------------------------------------------------

CREATE TABLE mission (
    artifact_id        uuid PRIMARY KEY REFERENCES artifact(artifact_id) ON DELETE CASCADE,
    mission_name       text,
    program            text,
    agency_org_code    text REFERENCES organization(org_code),
    class_code         text,                  -- GCAT Class (A/B/C/D), not "civil/military"
    category_code      text,                  -- GCAT Category (TECH, COM, IMG, ...)
    discipline_code    text,
    result_code        text,
    control_code       text,
    summary_text       text,
    abandonment_reason text,
    tlast_raw          text,
    tlast_best         timestamptz,
    tlast_precision    date_precision,
    tlast_approx       boolean NOT NULL DEFAULT false,
    top_raw            text,
    top_best           timestamptz,
    top_precision      date_precision,
    top_approx         boolean NOT NULL DEFAULT false,
    tdate_raw          text,
    tdate_best         timestamptz,
    tdate_precision    date_precision,
    tdate_approx       boolean NOT NULL DEFAULT false,
    curated_by         text,
    curated_at         timestamptz,
    source_id          text REFERENCES source(source_id)
);

CREATE TABLE fact (
    fact_id      bigserial PRIMARY KEY,
    artifact_id  uuid NOT NULL REFERENCES artifact(artifact_id) ON DELETE CASCADE,
    fact_type    text NOT NULL,               -- identity | spec | history | abandonment | location | comparison | trivia
    fact_text    text NOT NULL,
    value        jsonb,
    source_id    text NOT NULL REFERENCES source(source_id),
    source_url   text,
    confidence   text,                        -- confirmed | probable | disputed
    curated_by   text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fact_artifact_idx ON fact (artifact_id, fact_type);

CREATE TABLE media (
    media_id     bigserial PRIMARY KEY,
    artifact_id  uuid REFERENCES artifact(artifact_id) ON DELETE CASCADE,
    url          text NOT NULL,
    title        text,
    credit       text,
    license_name text NOT NULL,
    license_url  text,
    media_type   text,                        -- image | video | audio | model
    is_primary   boolean NOT NULL DEFAULT false,
    source_id    text NOT NULL REFERENCES source(source_id),
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX media_artifact_idx ON media (artifact_id);

-- Narration is generated, versioned, and tied to a hash of the facts it saw.
-- It is never an input to comparisons, quizzes, or fact rendering.
CREATE TABLE story (
    story_id            bigserial PRIMARY KEY,
    artifact_id         uuid NOT NULL REFERENCES artifact(artifact_id) ON DELETE CASCADE,
    compare_artifact_id uuid REFERENCES artifact(artifact_id) ON DELETE CASCADE,
    mode                text NOT NULL,        -- simple | deep | podcast | compare
    text                text NOT NULL,
    model               text,
    prompt_version      text NOT NULL,
    is_ai_generated     boolean NOT NULL DEFAULT true,
    fact_hash           text NOT NULL,
    facts_snapshot      jsonb NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX story_unique_idx ON story (
    artifact_id,
    COALESCE(compare_artifact_id, '00000000-0000-0000-0000-000000000000'::uuid),
    mode,
    prompt_version,
    fact_hash
);

-- ---------------------------------------------------------------------------
-- 6. Live tracking (Earth orbit only)
-- ---------------------------------------------------------------------------

-- Latest CelesTrak OMM element sets. Positions are propagated on demand with
-- SGP4 and cached briefly; positions are never stored per second.
CREATE TABLE gp_element (
    gp_id               bigserial PRIMARY KEY,
    satcat_no           bigint NOT NULL,      -- 6-digit IDs exceed the old 5-digit TLE space
    object_name         text,
    epoch               timestamptz NOT NULL,
    inclination_deg     double precision NOT NULL,
    raan_deg            double precision NOT NULL,
    eccentricity        double precision NOT NULL,
    arg_perigee_deg     double precision NOT NULL,
    mean_anomaly_deg    double precision NOT NULL,
    mean_motion_rev_day double precision NOT NULL,
    bstar               double precision,
    mean_motion_dot     double precision,
    mean_motion_ddot    double precision,
    ephemeris_type      integer,
    classification      text,
    source_id           text NOT NULL REFERENCES source(source_id),
    fetched_at          timestamptz NOT NULL DEFAULT now(),
    raw_omm             jsonb,
    UNIQUE (satcat_no, epoch)
);

CREATE INDEX gp_element_latest_idx ON gp_element (satcat_no, epoch DESC);

-- ---------------------------------------------------------------------------
-- 7. ETL bookkeeping
-- ---------------------------------------------------------------------------

CREATE TABLE etl_run (
    run_id       bigserial PRIMARY KEY,
    source_id    text NOT NULL REFERENCES source(source_id),
    job          text NOT NULL,
    started_at   timestamptz NOT NULL DEFAULT now(),
    finished_at  timestamptz,
    status       text NOT NULL DEFAULT 'running',
    rows_read    bigint NOT NULL DEFAULT 0,
    rows_written bigint NOT NULL DEFAULT 0,
    release_tag  text,
    notes        text
);

-- ---------------------------------------------------------------------------
-- 8. Triggers
-- ---------------------------------------------------------------------------

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER artifact_set_updated_at
    BEFORE UPDATE ON artifact
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Read models
-- ---------------------------------------------------------------------------

-- One row per artifact, shaped like the app card. JSON caching happens on top
-- of this view; the view stays the deterministic source.
CREATE VIEW v_artifact_card AS
SELECT
    a.artifact_id,
    a.slug,
    a.canonical_name,
    a.short_name,
    a.primary_zone,
    a.sat_type_raw,
    a.mass_kg,
    a.dry_mass_kg,
    a.is_curated,
    phases.phase_count,
    phases.first_start,
    phases.last_end,
    phases.current_status,
    loc.name        AS primary_location_name,
    loc.body        AS primary_body,
    loc.latitude_deg,
    loc.longitude_deg,
    sat.satcat_no,
    gp.epoch        AS gp_epoch
FROM artifact a
LEFT JOIN LATERAL (
    SELECT count(*) AS phase_count,
           min(ph.start_best) AS first_start,
           max(ph.end_best)   AS last_end,
           (array_agg(ph.status_code ORDER BY ph.seq DESC))[1] AS current_status
    FROM artifact_phase ph
    WHERE ph.artifact_id = a.artifact_id
) phases ON true
LEFT JOIN LATERAL (
    SELECT ph.location_id
    FROM artifact_phase ph
    WHERE ph.artifact_id = a.artifact_id
    ORDER BY ph.seq DESC
    LIMIT 1
) last_phase ON true
LEFT JOIN location loc ON loc.location_id = last_phase.location_id
LEFT JOIN LATERAL (
    SELECT CASE WHEN ac.value ~ '^[0-9]+$' THEN ac.value::bigint END AS satcat_no
    FROM artifact_catalog_id ac
    WHERE ac.artifact_id = a.artifact_id
      AND ac.scheme = 'SATCAT'
    ORDER BY ac.is_primary DESC, ac.valid_from DESC NULLS LAST
    LIMIT 1
) sat ON true
LEFT JOIN LATERAL (
    SELECT g.epoch
    FROM gp_element g
    WHERE g.satcat_no = sat.satcat_no
    ORDER BY g.epoch DESC
    LIMIT 1
) gp ON true;

CREATE VIEW v_artifact_timeline AS
SELECT
    a.slug,
    a.canonical_name,
    ph.seq,
    ph.jcat_id,
    ph.launch_id,
    ph.start_raw,
    ph.start_best,
    ph.end_raw,
    ph.end_best,
    ph.status_code,
    ps.description AS status_description,
    ph.primary_body,
    ph.zone,
    ph.dest_raw,
    ph.orbit_category_code
FROM artifact a
JOIN artifact_phase ph ON ph.artifact_id = a.artifact_id
LEFT JOIN phase_status ps ON ps.code = ph.status_code
ORDER BY a.slug, ph.seq;

-- Unified edge list for lineage traversal. Both resolved relations and
-- unresolved raw parent links appear here.
CREATE VIEW v_artifact_edge AS
SELECT
    'relation'::text          AS kind,
    from_artifact_id          AS parent_id,
    to_artifact_id            AS child_id,
    relation::text            AS label,
    NULL::text                AS via
FROM artifact_relation
UNION ALL
SELECT
    'phase_parent'::text,
    ph.parent_artifact_id,
    ph.artifact_id,
    ph.status_code,
    ph.jcat_id
FROM artifact_phase ph
WHERE ph.parent_artifact_id IS NOT NULL;

COMMIT;
