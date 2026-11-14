// 04 — Data Pipeline
// Part of Lost in Space — Technical System Documentation

#import "@preview/cetz:0.3.4": canvas, draw

= Data Pipeline
<sec-data-pipeline>

The pipeline turns published catalogs into a queryable archive. It is deliberately
split into two halves: *deterministic ingestion* of machine-readable catalogs,
and *curated enrichment* of the facts a catalog cannot answer. The first half
must be reproducible from a release tag. The second half must be attributable to a
source URL.

== Pipeline stages

#figure(
  kind: "figure",
  supplement: "Figure",
  canvas({
    import draw: *
    set-style(stroke: 0.7pt, fill: rgb("#eef3f6"))

    rect((0.0, 3.6), (2.8, 4.6), name: "fetch", radius: 2pt)
    content("fetch", text(size: 8pt)[Fetch])

    rect((3.4, 3.6), (6.2, 4.6), name: "land", radius: 2pt)
    content("land", text(size: 8pt)[Land])

    rect((6.8, 3.6), (9.6, 4.6), name: "stage", radius: 2pt)
    content("stage", text(size: 8pt)[Stage])

    rect((10.2, 3.6), (13.0, 4.6), name: "norm", radius: 2pt)
    content("norm", text(size: 8pt)[Normalise])

    rect((10.2, 1.2), (13.0, 2.2), name: "resolve", radius: 2pt)
    content("resolve", text(size: 8pt)[Resolve])

    rect((6.8, 1.2), (9.6, 2.2), name: "validate", radius: 2pt)
    content("validate", text(size: 8pt)[Validate])

    rect((3.4, 1.2), (6.2, 2.2), name: "promote", radius: 2pt)
    content("promote", text(size: 8pt)[Promote])

    rect((0.0, 1.2), (2.8, 2.2), name: "read", radius: 2pt)
    content("read", text(size: 8pt)[Read models])

    line("fetch.east", "land.west", mark: (end: ">"))
    line("land.east", "stage.west", mark: (end: ">"))
    line("stage.east", "norm.west", mark: (end: ">"))
    line("norm.south", "resolve.north", mark: (end: ">"))
    line("resolve.west", "validate.east", mark: (end: ">"))
    line("validate.west", "promote.east", mark: (end: ">"))
    line("promote.west", "read.east", mark: (end: ">"))
  }),
  caption: [Ingestion stages. Staging is disposable and is never read by the application. The lower row runs right to left.],
)

The stages map to the following commands. Each command is independently
re-runnable, and none of them writes to a canonical table except `transform`.

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Pipeline commands and their side effects],
  table(
    columns: (7.2cm, 1fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Command*], [*Reads*], [*Writes*]),
    [`python -m etl.download_gcat`], [GCAT HTTP endpoints], [`data/gcat/`, `source.last_release`, `etl_run`],
    [`python -m etl.load_staging`], [`data/gcat/`], [`staging.*`],
    [`python -m etl.transform`], [`staging.*`, seed vocabularies], [Canonical tables, `etl_run`],
    [`python -m etl.validate`], [Canonical tables], [Report only],
    [`python -m etl.celestrak_refresh`], [CelesTrak OMM, curated SATCAT list], [`gp_element`, `etl_run`],
  ),
)

== ADR-011 — Python for the ingestion runtime

*Decision.* The ETL is written in Python 3.13 with `requests` @requests, `psycopg` @psycopg and the
standard library. It runs as a Render cron service and as CLI commands locally.
The web application remains TypeScript.

*Context.* Ingestion is dominated by text parsing, HTTP fetching, and batch SQL.
It is not on the request path and does not share types with the React application.
The team is small; a second language is only justified if it materially reduces
parsing effort. Python's ecosystem has the most mature tooling for the specific
jobs involved: HTTP session handling, date parsing, orbital propagation, and
CSV/TSV manipulation.

*How it is used.*

- `etl/download_gcat.py` fetches the TSV tree with a descriptive `User-Agent`,
  conditional requests and bounded retries.
- `etl/load_staging.py` cleans each file (strip `#` comments, append provenance
  columns) and pipes it to `COPY` through `psycopg`'s `copy()` API.
- `etl/vague_date.py` implements the single date parser described in
  @sec-data-models.
- `etl/transform.py` runs normalisation, identity resolution and promotion in
  one transaction.
- `etl/celestrak_refresh.py` fetches OMM records and upserts `gp_element`.
- `etl/requirements.txt` pins the four direct dependencies; no framework is used.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Ingestion runtime alternatives],
  table(
    columns: (3.2cm, 2.8cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [Node.js ETL], [MIT], [Would share the language with the app, but the date and orbital libraries are stronger in Python, and the ETL gains nothing from sharing React types.],
    [Go], [BSD-3-Clause], [Fast and easy to deploy as a static binary, but slower to iterate on irregular text formats and weaker for ad-hoc validation queries.],
    [Rust], [MIT / Apache-2.0], [Excellent performance, but compile-time cost and a smaller orbital library set for a batch job that runs nightly.],
    [dbt], [Apache-2.0], [Great for SQL transformations inside a warehouse, but the hard work here is parsing and identity resolution, not modelling. It would not remove the Python.],
    [Apache Airflow], [Apache-2.0], [A scheduler and UI for pipelines with many dependencies. This pipeline has five commands and one schedule; Airflow is more operational surface than the problem justifies.],
    [Dagster / Prefect], [Apache-2.0], [Both are good orchestrators. Adopted only if the pipeline grows beyond a handful of jobs; the exit path is a thin wrapper around the same functions.],
    [Fivetran / Airbyte Cloud], [Proprietary service], [Violates the self-hosting constraint and does not understand GCAT's phase model.],
  ),
)

*Consequences.*

- Two languages must be installed and documented. This is accepted: Python owns
  batch, TypeScript owns request handling, and they meet only at the database.
- Package versions are pinned in `etl/requirements.txt`; CI installs them fresh.
- The ETL is importable as a library, so tests call functions directly rather
  than shelling out.

== ADR-012 — Land raw files, then `COPY` into text staging

*Decision.* Downloads are written to a gitignored `data/` directory, cleaned into
a canonical TSV shape, and loaded into `staging.*` tables whose columns are all
`text`. Parsing and typing happen in SQL or Python after the load, never during
it.

*Context.* GCAT publishes irregular TSVs with comment headers, literal quotes in
names, and blank fields that carry meaning. A single bad cast during a bulk load
aborts the run and loses the evidence. Loading text first makes the load
mechanical and keeps every value auditable.

*How it is used.*

- `staging.gcat_object` mirrors the 42 published columns plus `source_file` and
  `source_row`.
- `QUOTE E'\b'` disables quote processing so names containing `"` survive.
- Validation queries run against staging before any canonical row is written.
- A failed transform leaves staging intact, so a retry costs no bandwidth.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Staging strategies],
  table(
    columns: (3.0cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Strategy*], [*Why it was not chosen*]),
    [Row-by-row `INSERT`], [An order of magnitude slower for 70,000 rows and far more sensitive to type errors mid-file.],
    [`COPY ... FROM PROGRAM`], [Requires shell access and a client-side executable on the database host; not available on a managed service.],
    [Parse to JSON first], [Adds an intermediate representation that must be debugged separately from the TSV.],
    [Load directly to canonical tables], [A failed parse leaves partially promoted state, and the raw evidence is gone.],
    [External tables / FDW], [Not portable to a managed PostgreSQL instance and adds configuration for a nightly job.],
  ),
)

*Consequences.*

- Staging has no constraints except `NOT NULL` on provenance columns, so it can
  accept a bad release. That is the point: the validation step is the gate.
- Storage is duplicated for the duration of a run and truncated afterwards.

== ADR-013 — One VagueDate parser, precision preserved

*Decision.* Every GCAT date is parsed by a single function into a
`VagueDate(raw, best, precision, approx)` record. The database stores all four
values on every date-bearing table.

*Context.* GCAT publishes dates such as `1969 Jul 20 2017:33`, `1969 Jul`, `1969`
and `1969 Jul 20?`. The precision is real information: a year-only date must not
be rendered as 1 January. Existing date libraries parse the string but discard
the distinction between “known to the year” and “known to the second”.

*How it is used.*

- `etl/vague_date.py` is a hand-written tokeniser, not a date library.
- It recognises year, month name, day, hour:minute[:second], a trailing `?`, and
  the `JD` variants where present.
- It emits UTC `datetime` values and a precision label.
- The transform writes `*_raw`, `*_best`, `*_precision` and `*_approx` together.
- The UI renders from precision, never from the normalised timestamp alone.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Date parsing alternatives],
  table(
    columns: (4.0cm, 2.4cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [`dateutil.parser`], [Apache-2.0 / BSD-3-Clause], [Flexible, but loses precision and silently invents month/day defaults.],
    [`datetime.strptime`], [PSF-2.0], [Requires one format per call and still cannot express “year only”.],
    [Pandas `to_datetime`], [BSD-3-Clause], [Brings a heavy dependency and the same precision loss, plus `NaT` semantics that hide parse failures.],
    [Arrow], [Apache-2.0], [Good library, but the published strings are not ISO 8601 and precision is still not represented.],
    [Store strings only], [—], [Correct but unqueryable. The timeline and ordering queries need a comparable value and a precision.],
  ),
)

*Consequences.*

- The parser is project-specific code with its own tests. It must cover every
  format present in a release; an unknown format logs and stores `raw` with
  `precision = 'unknown'` rather than dropping the row.
- Sorting by `*_best` is approximate within a precision bucket. Queries that
  order events must also order by precision or by catalog sequence.

== ADR-014 — Deterministic identity proposals, human confirmation

*Decision.* Identity resolution is a rule engine that proposes groupings from
`Satcat`, `Parent`, `Launch_Tag` and status transitions. A curator confirms the
result into `artifact`, `artifact_catalog_id`, `artifact_phase` and
`artifact_relation`. No automatic merge is committed without review.

*Context.* GCAT is phase-based. A single physical object can appear under several
JCAT numbers as it crosses the deep-space boundary, lifts off from the Moon, or
is relaunched. Conversely, one SATCAT number can cover several physical objects.
Name similarity is the worst possible join key: “Apollo 11” names a mission, a
launch, a command module, a service module and a lunar module.

*How it is used.*

- The resolver emits a proposal table with candidate artifact groups, the
  evidence per link, and a confidence label.
- Rules, in order: identical `Satcat` with a continuous date range; `Parent`
  pointing at an EJCAT; status `DSO`/`DSA` followed by a new deep-space JCAT;
  status `LO`/`REFLT` indicating a relaunch; `SatType` `PA` treated as an alias,
  never a second artifact.
- Proposals are reviewed in a curation notebook; confirmed rows are written by
  the transform.
- Unresolved parent references stay in `artifact_phase.parent_ref_raw`.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Identity resolution alternatives],
  table(
    columns: (3.2cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [Fuzzy string matching], [Various], [Names collide across missions and components. A false merge corrupts the archive permanently.],
    [Splink], [MIT], [Strong probabilistic record linkage, but it optimises for large statistical datasets and needs training pairs. The evidence here is structured, not fuzzy.],
    [LLM-assisted resolution], [Model-dependent], [Non-deterministic, unauditable and expensive per run. A model may assist a human, but its output is not the record.],
    [Automatic rules only], [—], [Fast, but a single wrong status assumption merges unrelated hardware. Human confirmation is the control.],
    [One artifact per JCAT], [—], [The simplest model, and the one that makes the flagship Moon and Mars objects impossible to express correctly.],
  ),
)

*Consequences.*

- Curation is the bottleneck, not compute. The curated set is therefore
  deliberately small and balanced across zones.
- The rule engine is testable with fixture rows from real releases.
- Every accepted merge is reversible because the raw JCATs remain in
  `artifact_catalog_id` and `artifact_phase`.

== ADR-015 — CelesTrak OMM, not TLE

*Decision.* Live element sets are fetched from CelesTrak @celestrak in CCSDS OMM
JSON or CSV @celestrakformats @ccsdsomm and stored in `gp_element`. TLE is not
used anywhere in the pipeline.

*Context.* TLE is a fixed-width format with a five-digit catalog field. CelesTrak
exhausted the five-digit space on 2026-07-11; newer objects carry six-digit
identifiers that TLE cannot express. OMM is the structured successor defined by
CCSDS and carries the same mean elements with named fields and an explicit
reference frame and time system.

*How it is used.*

- One request per batch of curated SATCAT numbers, with a descriptive
  `User-Agent`, on a two-hour schedule.
- Fields map directly to `gp_element` columns; the full record is kept in
  `raw_omm`.
- The upsert key is `(satcat_no, epoch)`, so repeated fetches are idempotent.
- Element sets older than 30 days for uncurated objects are deleted.
- No position is ever computed or stored by the ETL.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Element-set source and format alternatives],
  table(
    columns: (3.0cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence / terms*], [*Why it was not chosen*]),
    [TLE], [Public format], [Five-digit catalog field cannot represent post-2026 objects. Deprecated for new ingestion.],
    [CelesTrak OMM JSON], [Free-use policy], [Chosen. Structured, current, one request per batch.],
    [Space-Track], [Account + User Agreement], [Redistribution restricted; incompatible with an open repository and a public mirror.],
    [KeepTrack API], [AGPL-3.0 code], [A tracker, not a primary element source; content is not an open dataset.],
    [Self-propagated from a launch state vector], [—], [Would require a full force model and calibration, duplicating CelesTrak for no benefit.],
  ),
)

*Consequences.*

- CelesTrak availability and rate policy become an operational dependency for the
  live layer only. Cached element sets keep the map working during an outage.
- OMM field names are stable; a schema change at the source is detectable by a
  validation query.

== ADR-016 — Propagate in the browser with `satellite.js`

*Decision.* Positions are computed client-side with `satellite.js` @satellitejs from the
latest stored OMM record. The server returns elements, not coordinates.
`python-sgp4` @pythonsgp4 is used only for offline verification and tests. The
algorithm itself follows the standard SGP4 model @hoots1980 @vallado2013.

*Context.* A live view needs positions every frame or every few seconds. Doing
that on the server turns a static archive into a per-user compute service and
makes the map latency-bound. SGP4 is a small, deterministic algorithm that runs
comfortably in a browser tab.

*How it is used.*

- `/api/artifacts/[slug]/gp` returns the latest element set with a short cache
  lifetime.
- The client converts OMM fields to the `satellite.js` satrec structure, calls
  `propagate`, and converts ECI to geodetic.
- The animation loop runs at a low frame rate; the position is recomputed only
  when the simulated time advances.
- Moon, Mars and deep-space objects show a labelled last-known position or a
  surface coordinate. They are never animated as if tracked.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Propagation alternatives],
  table(
    columns: (3.4cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [`satellite.js`], [MIT], [Chosen. Small, browser-native, well-tested SGP4/SDP4 implementation.],
    [`python-sgp4`], [MIT], [Excellent reference implementation; used for tests, not for serving browsers.],
    [Skyfield], [MIT], [High-precision ephemerides across the solar system, but heavier and not needed for near-Earth SGP4. A candidate for selected deep-space ephemerides.],
    [Orekit], [Apache-2.0], [Genuinely precise and full-featured, but a JVM library and far more machinery than a near-Earth track needs.],
    [Server-side propagation], [—], [Moves compute to the request path, creates a per-user cost and a new failure mode.],
    [Precomputed path], [—], [Accurate for a fixed time window, but stale immediately and expensive to store per second.],
  ),
)

*Consequences.*

- Client clocks and device performance vary; the UI must tolerate a slow tab and
  clearly label simulated time.
- SGP4 accuracy degrades with element-set age. The UI shows the epoch and the
  age of the data.
- A shared TypeScript wrapper isolates the library so it can be replaced.

== ADR-017 — Server-side NASA image proxy

*Decision.* NASA imagery is fetched through a Next.js route handler that caches
responses and rewrites the asset URL. The browser never calls `api.nasa.gov`
directly.

*Context.* The NASA Images API works without a key at low volume but rate-limits
by IP. A browser-side call exposes the key, cannot be cached across users, and
fails when NASA is slow. The archive also needs stable URLs for `media` rows.

*How it is used.*

- `app/api/media/route.ts` validates the requested asset, fetches metadata with a
  server-held key, and returns a normalised payload.
- The response carries a long cache lifetime and a content hash.
- `media` stores the asset page URL, the credit line and the licence, not a
  copied binary.
- If an asset disappears upstream, the UI shows a labelled placeholder rather
  than a broken image.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Imagery delivery alternatives],
  table(
    columns: (2.8cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Option*], [*Why it was not chosen*]),
    [Hotlink from the browser], [Exposes the key, cannot cache centrally, and breaks when the upstream is slow or blocks the referrer.],
    [Download and re-host binaries], [Shifts licence and takedown responsibility onto the project and adds object storage to the deployment.],
    [Third-party image CDN], [Introduces a proprietary dependency for a non-core asset path.],
    [No imagery], [The archive is about physical objects; imagery is part of the product.],
  ),
)

*Consequences.*

- One more route to monitor. It is read-only and cacheable, so the risk is low.
- The proxy must pass through the correct credit metadata; the UI must display it.

== ADR-018 — MapLibre for 2D, CesiumJS only if a globe is justified

*Decision.* Zone and surface maps use MapLibre GL JS @maplibre with vector tiles. A 3D
globe is deferred; if it is added, it uses CesiumJS @cesium with the same stored
coordinates. Three.js @threejs is reserved for a single artifact model view, not for
geography.

*Context.* The map must show lunar and Martian surface sites, Earth-orbit tracks
and deep-space departure points. A 2D map is enough for surface sites and is
cheap to operate. A globe is visually attractive but adds imagery, terrain and a
much larger client bundle.

*How it is used.*

- MapLibre renders zone maps with GeoJSON features generated from `location` and
  `artifact_phase`.
- Orbit tracks are computed client-side from the same SGP4 propagation and drawn
  as a polyline.
- Lunar and Martian maps use published static basemaps rather than a live tile
  service where licensing requires it.
- CesiumJS remains an optional client-only route with dynamic import.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Map and 3D alternatives],
  table(
    columns: (3.0cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [MapLibre GL JS], [BSD-3-Clause], [Chosen. Open, vector-tile native, no API key.],
    [Leaflet], [BSD-2-Clause], [Simple and mature, but raster-first and weaker for the smooth orbit animation the product wants.],
    [OpenLayers], [BSD-2-Clause], [Capable, but a heavier API for a small number of maps.],
    [Google Maps], [Proprietary], [API key, billing and terms that conflict with self-hosting.],
    [CesiumJS], [Apache-2.0], [The right choice for a true globe; deferred because of bundle size and terrain/imagery licensing work.],
    [Three.js], [MIT], [Excellent for a single 3D model; not a geographic map engine.],
    [deck.gl], [MIT], [Powerful for large data visualisation, but overkill for hundreds of points.],
  ),
)

*Consequences.*

- MapLibre needs a tile source. The default is a self-hostable style with
  openly licensed tiles; a commercial tile provider is avoidable but not free of
  terms.
- Adding a globe later is additive because coordinates are already stored in
  `location`.

== ADR-019 — Narration from a frozen fact snapshot

*Decision.* Story text is generated by an LLM from a JSON snapshot of one
artifact's facts. The snapshot and its hash are stored with the generated text.
The model may be a hosted API or a locally served open-weight model — for
example Ollama @ollama, vLLM @vllm, or a Mistral open-weight model @mistral — and
the fact path does not change.

*Context.* The product's differentiator is trustworthy storytelling. A model that
is allowed to browse or recall will invent masses, dates and outcomes. A model
that receives a frozen, complete fact set can only phrase, not discover.

*How it is used.*

- A query builds `facts_snapshot` from `artifact`, `artifact_phase`, `mission`
  and `fact`.
- `fact_hash` is a SHA-256 of the canonical JSON.
- `story` is unique on `(artifact, compare, mode, prompt_version, fact_hash)`.
- Every generation records `model` and `is_ai_generated`.
- The UI always labels generated text and links to the facts it used.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Narration generation alternatives],
  table(
    columns: (3.2cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence / terms*], [*Why it was not chosen*]),
    [Hosted frontier model], [Proprietary service], [Best prose per token, but a vendor dependency and a data-processing question. Allowed as one adapter, not as the architecture.],
    [Ollama with an open-weight model], [MIT (runtime)], [Chosen default for self-hosting: simple local server, OpenAI-compatible API. Quality depends on the selected model.],
    [vLLM], [Apache-2.0], [High-throughput serving for GPU hosts. The right option if self-hosted generation becomes a volume workload.],
    [Mistral open-weight models], [Apache-2.0 for several sizes], [A credible model family with open weights; a configuration choice behind the adapter.],
    [Template-based text], [—], [Deterministic and free, but produces no story. Useful as a fallback when no model is configured.],
    [Human-written prose only], [—], [Highest quality, but does not scale to the curated set and removes the “story engine” feature.],
  ),
)

*Consequences.*

- Generation is asynchronous and cached. A missing or failed generation degrades
  to facts plus a notice, never to invented text.
- Prompt versions are immutable; changing the prompt produces new rows rather
  than overwriting history.
- Cost is bounded by the number of artifacts times the number of modes.

== ADR-020 — Cron, not a queue

*Decision.* Scheduled work runs as idempotent commands invoked by a platform cron
job. There is no message broker and no workflow engine in the MVP.

*Context.* There are five jobs, all batch, all tolerant of a missed run, and all
safe to repeat. A queue adds a service, a consumer and a failure mode for work
that can simply be retried on the next schedule.

*How it is used.*

- Render cron services invoke the `python -m etl.*` commands.
- Each run writes an `etl_run` row with status and counts.
- Overlapping runs are prevented by a PostgreSQL advisory lock keyed on the job
  name.
- Failed runs leave staging intact and are retried on the next schedule.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Scheduling alternatives],
  table(
    columns: (3.0cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [Platform cron], [Service feature], [Chosen. No extra service; visible logs; paid plan required on Render.],
    [System `cron` on a VPS], [OS], [Works, but the managed deployment is the primary target. Documented as the self-hosted alternative.],
    [Celery + Redis], [BSD-3-Clause], [A broker and worker for five batch jobs. Unnecessary operational surface.],
    [pg-boss], [MIT], [Postgres-backed queue; reasonable if jobs need retries with backoff, but the schedule already provides that.],
    [Airflow / Dagster], [Apache-2.0], [Orchestration for dependency graphs that do not exist here.],
    [GitHub Actions schedule], [Service], [Free and simple, but couples production data writes to CI credentials and is awkward to observe.],
  ),
)

*Consequences.*

- A missed schedule is recovered by the next run, not by a replay queue.
- Idempotency is a hard requirement for every command, enforced by upserts and
  advisory locks rather than by orchestration.
- If a job ever needs per-item retries, `pg-boss` is the smallest upgrade.

== Validation and promotion

Promotion is a single transaction. Before it starts, the following queries must
return no rows:

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Pre-promotion checks],
  table(
    columns: (4.4cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Check*], [*Failure means*]),
    [Duplicate `jcat` in staging], [The release contains the same phase twice, or two files overlap unexpectedly.],
    [Launch tag with no launch row], [A missing launch file or an unreleased tag.],
    [Lander row absent from every object catalog], [An enrichment row with no phase to attach to.],
    [Non-numeric `satcat` that will be cast], [A catalog value such as `NNA` reached a numeric context.],
    [Phase with no artifact], [A promotion bug; phases are written after their artifact.],
    [Curated artifact without a sourced fact], [A curation gap that would render an unsourced claim.],
    [Media without licence or credit], [A licence violation in the UI.],
  ),
)

The transaction order is fixed: sources, organizations and sites, launches,
artifacts, catalog identifiers, phases, relations, facts and media, then the
`etl_run` row. A failure rolls back everything except the audit row, which is
written in a separate short transaction so the failure is visible.

== Failure modes

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Pipeline failure modes and responses],
  table(
    columns: (3.4cm, 1fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Failure*], [*Detection*], [*Response*]),
    [Truncated download], [Field-count assertion], [Abort before staging load; keep the previous release.],
    [New date format], [`precision = 'unknown'` count rises], [Log the raw values, extend the parser, re-run the transform only.],
    [Upstream column change], [Staging `COPY` column-count mismatch], [Fail loudly; never pad or drop columns silently.],
    [Identity rule regression], [Validation diff against the previous release], [Block promotion, inspect proposals, fix rules.],
    [CelesTrak outage], [Non-200 or empty payload], [Keep existing `gp_element` rows; retry next cycle; mark data age in the UI.],
    [Disk exhaustion], [Write error on `data/`], [Delete raw files after staging load; staging is the durable copy.],
    [Partial promotion], [Transaction rollback], [Staging retained; re-run `transform`.],
  ),
)
