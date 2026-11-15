-- ============================================================================
--  Lost in Space — GCAT staging tables
--
--  Raw GCAT TSVs land here as text, exactly as published. No casting, no
--  interpretation. The transform step reads these tables, resolves identity,
--  parses VagueDate values, and writes the canonical tables in db/schema.sql.
--
--  Staging is disposable: `TRUNCATE staging.gcat_object` and reload.
--
--  Apply with:  psql "$DATABASE_URL" -f db/staging.sql
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS staging;

-- Object catalogs share one 43-column layout in GCAT:
--   satcat, deepcat, hcocat, csocat, ecat, lcat, rcat, ftocat, ...
-- Keep the source file on every row so overlaps can be audited.
CREATE TABLE staging.gcat_object (
    jcat            text,
    satcat          text,
    launch_tag      text,
    piece           text,
    type            text,
    name            text,
    pl_name         text,
    ldate           text,
    parent          text,
    sdate           text,
    primary_body    text,
    ddate           text,
    status          text,
    dest            text,
    owner           text,
    state           text,
    manufacturer    text,
    bus             text,
    motor           text,
    mass            text,
    mass_flag       text,
    dry_mass        text,
    dry_flag        text,
    tot_mass        text,
    tot_flag        text,
    length          text,
    length_flag     text,
    diameter        text,
    diameter_flag   text,
    span            text,
    span_flag       text,
    shape           text,
    odate           text,
    perigee         text,
    perigee_flag    text,
    apogee          text,
    apogee_flag     text,
    inc             text,
    inc_flag        text,
    op_orbit        text,
    oqual           text,
    alt_names       text,
    source_file     text NOT NULL,
    source_row      text,
    loaded_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gcat_object_jcat_idx ON staging.gcat_object (jcat);
CREATE INDEX gcat_object_satcat_idx ON staging.gcat_object (satcat);
CREATE INDEX gcat_object_launch_idx ON staging.gcat_object (launch_tag);

-- Surface objects: 469 rows, 431 of them already present in deepcat.
-- This is an enrichment/shortlist source, NOT a second phase source.
CREATE TABLE staging.gcat_lander (
    jcat         text,
    piece        text,
    name         text,
    owner        text,
    state        text,
    world        text,
    lon          text,
    lat          text,
    ltype        text,
    status       text,
    launch_date  text,
    land_date    text,
    off_date     text,
    dur          text,
    lsite        text,
    comment      text,
    source_file  text NOT NULL,
    source_row   text,
    loaded_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gcat_lander_jcat_idx ON staging.gcat_lander (jcat);
CREATE INDEX gcat_lander_world_idx ON staging.gcat_lander (world);

-- Launch files are published one per launch vehicle (396 files).
CREATE TABLE staging.gcat_launch (
    launch_tag    text,
    launch_jd     text,
    launch_date   text,
    lv_type       text,
    variant       text,
    fairing       text,
    flight_id     text,
    flight        text,
    mission       text,
    flight_code   text,
    platform      text,
    launch_site   text,
    launch_pad    text,
    ascent_site   text,
    ascent_pad    text,
    perigee       text,
    apogee        text,
    apoflag       text,
    inc           text,
    azimuth       text,
    range         text,
    rangeflag     text,
    dest          text,
    orb_mass      text,
    orb_pay       text,
    agency        text,
    launch_code   text,
    fail_code     text,
    group_code    text,
    category      text,
    ltcite        text,
    cite          text,
    notes         text,
    source_file   text NOT NULL,
    source_row    text,
    loaded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gcat_launch_tag_idx ON staging.gcat_launch (launch_tag);

-- Payload metadata keyed by JCAT: Program, Class, Category, Result, Control,
-- Discipline, UN registration. Joins onto staging.gcat_object by jcat.
CREATE TABLE staging.gcat_payload_meta (
    jcat         text,
    piece        text,
    name         text,
    ldate        text,
    tlast        text,
    top          text,
    tdate        text,
    tf           text,
    program      text,
    plane        text,
    att          text,
    mvr          text,
    class        text,
    category     text,
    result       text,
    control      text,
    discipline   text,
    un_state     text,
    un_reg       text,
    un_period    text,
    un_perigee   text,
    un_apogee    text,
    un_inc       text,
    disp_epoch   text,
    disp_peri    text,
    disp_apo     text,
    disp_inc     text,
    comment      text,
    source_file  text NOT NULL,
    source_row   text,
    loaded_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gcat_payload_meta_jcat_idx ON staging.gcat_payload_meta (jcat);

CREATE TABLE staging.gcat_org (
    code        text,
    ucode       text,
    state_code  text,
    org_type    text,
    org_class   text,
    tstart      text,
    tstop       text,
    short_name  text,
    name        text,
    location    text,
    longitude   text,
    latitude    text,
    error       text,
    parent      text,
    short_ename text,
    ename       text,
    uname       text,
    source_file text NOT NULL,
    source_row  text,
    loaded_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gcat_org_code_idx ON staging.gcat_org (code);

CREATE TABLE staging.gcat_site (
    site        text,
    code        text,
    ucode       text,
    site_type   text,
    state_code  text,
    tstart      text,
    tstop       text,
    short_name  text,
    name        text,
    location    text,
    longitude   text,
    latitude    text,
    error       text,
    parent      text,
    short_ename text,
    ename       text,
    group_name  text,
    uname       text,
    source_file text NOT NULL,
    source_row  text,
    loaded_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gcat_site_code_idx ON staging.gcat_site (site);

COMMIT;
