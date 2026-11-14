// 07 — Data Models
// Part of Lost in Space — Technical System Documentation

#import "@preview/cetz:0.3.4": canvas, draw

= Data Models
<sec-data-models>

The schema is the most consequential design in the project. Everything else —
the API, the map, the comparison tool, the narration pipeline — reads from it.
This section explains the model, the rules that keep it honest, and the
alternatives that were rejected.

== ADR-029 — Three layers: object, name, phase

*Decision.* A physical artifact, the catalog identifiers attached to it, and the
phases of its life are three separate tables. A catalog number never identifies a
physical object on its own.

*Context.* Conventional satellite catalogs assign one number to one object. GCAT
@gcat does not: it models *phases*. The Apollo 11 lunar module ascent stage is a single
physical artifact with at least three catalog identities — one for its Earth-orbit
phase, one after it crossed the deep-space boundary, and one after it lifted off
from the Moon. A schema with `artifacts.jcat_id` as a permanent key cannot express
this, and the flagship Moon narrative would be wrong.

*How it is used.*

#figure(
  kind: "figure",
  supplement: "Figure",
  canvas({
    import draw: *
    set-style(stroke: 0.7pt, fill: rgb("#eef3f6"))

    rect((0.0, 5.0), (3.4, 6.2), name: "art", radius: 2pt)
    content((1.7, 5.82), text(size: 7.5pt)[`artifact`])
    content((1.7, 5.38), text(size: 6.5pt)[physical object])

    rect((4.4, 7.4), (9.8, 8.6), name: "cid", radius: 2pt)
    content((7.1, 8.22), text(size: 7.5pt)[`artifact_catalog_id`])
    content((7.1, 7.78), text(size: 6.5pt)[JCAT · SATCAT · COSPAR])

    rect((4.4, 5.0), (9.8, 6.2), name: "ph", radius: 2pt)
    content((7.1, 5.82), text(size: 7.5pt)[`artifact_phase`])
    content((7.1, 5.38), text(size: 6.5pt)[one GCAT row])

    rect((10.8, 5.0), (14.8, 6.2), name: "ctx", radius: 2pt)
    content((12.8, 5.82), text(size: 7.5pt)[`launch` · `location`])
    content((12.8, 5.38), text(size: 6.5pt)[status · orbit category])

    rect((4.4, 2.6), (9.8, 3.8), name: "rel", radius: 2pt)
    content((7.1, 3.42), text(size: 7.5pt)[`artifact_relation`])
    content((7.1, 2.98), text(size: 6.5pt)[curated edges between artifacts])

    line("art.east", "cid.west", mark: (end: ">"))
    line("art.east", "ph.west", mark: (end: ">"))
    line("cid.south", "ph.north", mark: (end: ">"))
    line("ph.east", "ctx.west", mark: (end: ">"))
    line("art.south", "rel.west", mark: (end: ">"), stroke: (paint: luma(130), dash: "dashed"))
    content((7.1, 6.8), text(size: 7pt)[1 : N])
    content((2.7, 4.35), text(size: 7pt)[1 : N])
  }),
  caption: [The three-layer identity model. A catalog number belongs to a phase, and a phase belongs to an artifact.],
)

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Apollo 11 lunar module as one artifact with three phases],
  table(
    columns: (4.2cm, 2.4cm, 2.0cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left, left),
    table.header([*Event*], [*Launch tag*], [*JCAT*], [*Why a new identity*]),
    [Launched from Earth], [`1969-059`], [`S04041`], [Normal Earth-orbit catalog entry],
    [Crossed the deep-space boundary], [`1969-059`], [`D00274`], [Status `DSO`; the deep-space catalog takes over],
    [Lifted off from the Moon], [`1969-U01`], [`D01052`], [Status `LO`; new launch and catalog number],
  ),
)

The database stores one `artifact`, three `artifact_phase` rows and three
`artifact_catalog_id` rows. The public page is one URL; the timeline is three
phases; the lineage is one node.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Identity model alternatives],
  table(
    columns: (2.8cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Option*], [*Why it was not chosen*]),
    [One row per JCAT], [Simple to load, but splits one physical object into several pages and makes the Moon and Mars stories incoherent.],
    [One row per SATCAT], [SATCAT is reused and can cover several physical objects. It also does not exist for surface objects.],
    [One row per name], [Names collide across missions and components; false merges are unrecoverable.],
    [A single wide table], [Mixes object, identifier and phase facts; every phase change duplicates object facts and invites contradiction.],
    [Document store with nested phases], [Expresses the shape, but loses foreign keys, uniqueness and the provenance joins the archive depends on.],
  ),
)

*Consequences.*

- Queries must join through phases to answer “where is it now”. The read views
  hide that join from the application.
- Curation is required to group phases. The ETL proposes; a human confirms.
- The model survives future catalog changes because a new identifier is a row,
  not a migration.

== Table map

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Canonical tables by concern],
  table(
    columns: (2.8cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Concern*], [*Tables*]),
    [Vocabulary], [`sat_type_coarse`, `phase_status`, `orbit_category`],
    [Provenance], [`source`, `etl_run`],
    [Geography and operators], [`organization`, `site`, `location`],
    [Launch], [`launch`],
    [Identity], [`artifact`, `artifact_catalog_id`, `artifact_phase`, `artifact_relation`],
    [Narrative and facts], [`mission`, `fact`, `media`, `story`],
    [Live tracking], [`gp_element`],
    [Read models], [`v_artifact_card`, `v_artifact_timeline`, `v_artifact_edge`],
  ),
)

== Phases

A phase is one published catalog row: the object in one state between two
events. It carries the JCAT for that state, the launch it belongs to, the body it
is at, a zone, optional surface coordinates, start and end dates, a status code
and an orbit category.

Rules:

- `jcat_id` is the GCAT key for the phase, not for the artifact. It is *not
  unique*: deep-space catalogs reuse one JCAT across successive rows, so
  `phase_key` (`<jcat>:<n>`) is the stable unique row key.
- `(artifact_id, seq)` is unique; `seq` orders the phases.
- `parent_ref_raw` preserves GCAT's `Parent` string exactly.
- `parent_artifact_id` is the resolved link, nullable until curation confirms it.
- Dates follow the four-column VagueDate pattern.
- A phase may have no `launch_id` when the object was deployed from another
  artifact rather than launched from Earth.

== Catalog identifiers

`artifact_catalog_id` is the only place a catalog number is authoritative.

- Unique on `(artifact_id, scheme, value)`.
- At most one primary per scheme via a partial unique index.
- Not unique across artifacts: one SATCAT can describe several GCAT objects.
- `value` is text, because `NNA`, `NSO` and blank values exist.
- Validity dates are optional and follow the VagueDate pattern.

Rules for casting:

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Catalog value handling],
  table(
    columns: (2.2cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Scheme*], [*Shape*], [*Rule*]),
    [`JCAT`], [`A99999`, `D99999`, `S99999`], [Opaque text. Never numeric.],
    [`SATCAT`], [Mostly digits, sometimes `NNA`/`NSO`], [Cast only when `value ~ '^[0-9]+$'`.],
    [`COSPAR`], [`YYYY-NNNP`, but not always], [Display alias, not a join key.],
    [`HORIZONS`], [Numeric or `DES=` form], [Opaque text.],
  ),
)

== VagueDate

Every date that comes from a catalog is stored four ways:

#figure(
  kind: "table",
  supplement: "Table",
  caption: [VagueDate columns],
  table(
    columns: (3.0cm, 1fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Column*], [*Example*], [*Meaning*]),
    [`*_raw`], [`1969 Jul 20 2017:33?`], [Exact published string; never rewritten],
    [`*_best`], [`1969-07-20 20:17:33+00`], [Best normalised UTC value],
    [`*_precision`], [`second`], [year, month, day, hour, minute, second or unknown],
    [`*_approx`], [`true`], [Source marked the value uncertain],
  ),
)

The same four columns appear on the date fields of `launch`,
`artifact_catalog_id`, `artifact_phase` and `mission`.

Three rules make the pattern work:

1. *Never raise precision.* A year-only date becomes 1 January with precision
   `year`, and the UI renders “1969”.
2. *Never hide uncertainty.* A trailing `?` sets `*_approx` and stays visible
   in `*_raw`.
3. *Never drop an unparseable value.* Store `raw`, set `best` to null and
   `precision` to `unknown`, and log it.

== Zones

`zone_kind` is the product's navigation: `moon`, `mars`, `earth_orbit`,
`deep_space` and an explicit `other`.

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Zone derivation, first match wins],
  table(
    columns: (2.9cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Zone*], [*Rule*]),
    [`moon`], [`primary_body = 'Moon'`, a lander row with world `Luna`/`Moon`, or a cislunar object whose destination is the Moon],
    [`mars`], [`primary_body = 'Mars'`, or a lander row with world `Mars`],
    [`earth_orbit`], [`primary_body = 'Earth'` with an `op_orbit` in the bound Earth set (`LLEO/*`, `LEO/*`, `MEO`, `HEO`, `GTO`, `GEO/*`, `VHEO`)],
    [`deep_space`], [`op_orbit` in `DSO`, `EEO`, `HCO`, `SSE`; a Sun or non-Earth/Moon/Mars body; or a planetary flyby or escape],
    [`other`], [Ambiguous or missing data; must be resolved before curation marks the artifact],
  ),
)

`artifact.primary_zone` is the zone of the final or most representative phase,
chosen during curation. `artifact_phase.zone` keeps the per-phase truth, so a
Mars lander that cruised in Earth orbit can show both.

The derivation is one SQL function so the ETL and the API cannot disagree.

== Provenance

Every imported row carries `source_id` and `source_row`. Rows written by a
curator carry `source_id = 'curated'`.

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Provenance fields],
  table(
    columns: (4.0cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Field*], [*Meaning*]),
    [`source_id`], [Stable source key; foreign key to `source`],
    [`source_row`], [File and row, or a page identifier, for audit],
    [`source_url`], [Exact page for a curated fact],
    [`citation`], [Credit line rendered in the UI],
    [`etl_run.release_tag`], [Upstream release the rows came from],
  ),
)

A `fact` without `source_url` is allowed only for internal derivations, and the
curation rule is that every user-visible claim has one.

== Facts and narration

The separation is enforced by the schema, not by convention:

- `fact` and `mission` hold claims and their provenance.
- `story` holds generated text plus `facts_snapshot`, `fact_hash`,
  `prompt_version` and `model`.
- `story` has no foreign key into `fact`; it points at `artifact` and optionally a
  comparison artifact.
- A unique index on `(artifact, compare, mode, prompt_version, fact_hash)`
  prevents duplicate generations and makes stale narration detectable.

Nothing that answers “what is true?” reads `story`.

== Live elements

`gp_element` stores one OMM record per `(satcat_no, epoch)`.

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Element-set fields],
  table(
    columns: (4.0cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Field*], [*Meaning*]),
    [`satcat_no`], [`bigint`; six-digit identifiers fit comfortably],
    [`epoch`], [Reference time of the mean elements],
    [`inclination_deg`, `raan_deg`, `eccentricity`], [Orientation and shape],
    [`arg_perigee_deg`, `mean_anomaly_deg`], [Position within the orbit],
    [`mean_motion_rev_day`], [Sizing; revolutions per day],
    [`bstar`], [Drag term],
    [`raw_omm`], [Full original record as `jsonb`],
  ),
)

Positions are never stored. They are propagated from these elements on demand.

== Graph read model

The graph is a projection, not a system of record.

- `artifact_relation` stores curated edges with a `relation_kind` enum:
  `deployed_from`, `spawned_from`, `component_of`, `attached_to`, `landed_with`,
  `left_behind_by`, `crashed_into`, `reflight_of`.
- `artifact_phase.parent_artifact_id` stores resolved GCAT parent links.
- `v_artifact_edge` unions both into one edge list.
- `db/queries/lineage.sql` performs a bounded depth-6 recursive traversal with a
  cycle guard.

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Graph projection rules],
  table(
    columns: (2.8cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Rule*], [*Consequence*]),
    [Edges are derived from relational rows], [The graph can always be rebuilt],
    [Traversal is bounded and cycle-safe], [A bad curation edge cannot hang a request],
    [No graph server in the runtime], [No second backup, auth model or failure mode],
    [AGE remains optional], [Adopting it requires self-hosted PostgreSQL],
  ),
)

== Read views

Three views keep common joins out of application code:

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Read views],
  table(
    columns: (4.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*View*], [*Shape*]),
    [`v_artifact_card`], [One row per artifact: name, zone, mass, phase count, first start, last end, current status, last location, primary SATCAT, latest element epoch],
    [`v_artifact_timeline`], [One row per phase, ordered by artifact and sequence, with status description],
    [`v_artifact_edge`], [One row per edge, from curated relations and resolved parent links],
  ),
)

The card view uses `LATERAL` joins so it returns one row per artifact without
fan-out. It also guards the SATCAT cast with a regular expression, because
`NNA` values exist.

== Constraints and indexes

The schema uses constraints for correctness and indexes for the actual query
shapes:

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Selected constraints and indexes],
  table(
    columns: (7.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Object*], [*Purpose*]),
    [`artifact.slug UNIQUE`], [Stable public URL],
    [`artifact_catalog_id (artifact, scheme, value) UNIQUE`], [One alias once],
    [`artifact_catalog_id_one_primary_idx`], [At most one primary per scheme],
    [`artifact_phase (artifact, seq) UNIQUE`], [Deterministic order],
    [`artifact_relation (from, to, relation) PK`], [No duplicate edges],
    [`artifact_relation CHECK from <> to`], [No self-loops],
    [`gp_element (satcat_no, epoch) UNIQUE`], [Idempotent live upserts],
    [`story_unique_idx`], [No duplicate narration for the same facts and prompt],
    [`artifact_name_trgm_idx`], [Fuzzy name search],
    [`artifact_alt_names_idx`], [Array containment search],
  ),
)

== ADR-030 — `jsonb` for snapshots and raw records, not for facts

*Decision.* Structured facts live in typed columns. `jsonb` @postgresjsonb is used only for
opaque upstream payloads and frozen snapshots: `gp_element.raw_omm`,
`story.facts_snapshot` and `fact.value`.

*Context.* It is tempting to store an artifact as a JSON document and avoid
migrations. That would lose foreign keys, uniqueness, partial indexes and the
provenance joins that make the archive trustworthy. It is equally tempting to
avoid `jsonb` entirely, which would force schema changes for every upstream
record shape.

*How it is used.*

- `raw_omm` preserves exactly what CelesTrak sent, for debugging and reprocessing.
- `facts_snapshot` preserves exactly what the model saw, for audit.
- `fact.value` holds a typed payload for facts that are naturally structured
  (a measurement with a unit, a coordinate pair).
- Queries never depend on the internal shape of `raw_omm` or `facts_snapshot`.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Storage shape alternatives],
  table(
    columns: (3.0cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Option*], [*Why it was not chosen*]),
    [Everything in `jsonb`], [No constraints, no joins, no indexes on facts; the provenance model collapses.],
    [Everything normalised], [Would add tables for one-off payloads and make upstream reprocessing a migration.],
    [EAV for all facts], [Flexible but unreadable, slow to query and easy to corrupt with inconsistent types.],
    [Flat CSV columns only], [Cannot represent phases, aliases and provenance without duplication.],
  ),
)

*Consequences.*

- `jsonb` fields are append-only in practice; a shape change is handled by
  ignoring unknown keys.
- Snapshot size is bounded by one artifact's facts.

== ADR-031 — Read views, not materialised views, in the MVP

*Decision.* The application reads ordinary SQL views. Materialised views are
introduced only if measurement shows the card view is a bottleneck.

*Context.* The curated set is hundreds of artifacts, not millions. A well-indexed
`LATERAL` join answers in milliseconds. A materialised view adds refresh
scheduling and staleness to the system of record.

*How it is used.*

- `v_artifact_card` is queried with `WHERE is_curated`.
- HTTP cache headers absorb repeated reads.
- If needed, a materialised view is refreshed at the end of `transform` and
  indexed on zone and slug.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Read-model alternatives],
  table(
    columns: (2.8cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Option*], [*Why it was not chosen*]),
    [Materialised view now], [Premature. Adds refresh ordering and a second freshness concept for no measured gain.],
    [Application-side joins], [Duplicates the model in TypeScript and drifts from the schema.],
    [Generated JSON export], [Fine as a public artefact, but not the runtime source of truth.],
    [Search index as read model], [A second system to keep in sync for a small corpus.],
  ),
)

*Consequences.*

- The read cost is paid per request but is small and cacheable.
- The upgrade path is a materialised view plus an index, with no API change.

== Data quality invariants

The following must hold after every load. They are asserted in tests and, where
possible, in the schema:

1. Every artifact has exactly one `primary_zone`.
2. Every phase belongs to an existing artifact.
3. Every phase with a `start_best` has a `start_raw`.
4. Every catalog identifier has a scheme from the enum.
5. Every SATCAT that is cast to a number matches `^[0-9]+$`.
6. Every curated artifact has at least one `fact` with a `source_url`.
7. Every media row has a licence name and a credit.
8. No relation points at itself.
9. No `story` row exists without a `facts_snapshot` and `fact_hash`.
10. No `gp_element` row exists without an `epoch`.

== Migration path

The schema was validated on PostgreSQL 16 @postgresql before the application existed. Future
changes are forward-only numbered SQL files. The destructive-change policy is:
snapshot, migrate, verify, then remove the old column in a later release. The
read views are versioned with the tables they depend on, so a view change is part
of the same migration.
