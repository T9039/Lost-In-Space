// 02 — Architecture Overview
// Part of Lost in Space — Technical System Documentation

#import "@preview/cetz:0.3.4": canvas, draw

= Architecture Overview
<sec-architecture>

== System in one page

Lost in Space has two data paths that meet in one database:

- a *request path* that renders curated artifacts for a reader, and
- a *batch path* that ingests catalogs, enriches them and refreshes the read models.

Live Earth-orbit positions are a third, narrow path: a scheduled fetch stores
element sets, and the browser propagates them locally. No path depends on a
graph server, a message queue, or a per-user upstream API call.

== Runtime topology

#figure(
  kind: "figure",
  supplement: "Figure",
  canvas({
    import draw: *
    set-style(stroke: 0.7pt, fill: rgb("#eef3f6"))

    rect((0, 4.0), (3.2, 5.1), name: "browser", radius: 2pt)
    content("browser", align(center, text(size: 8pt)[Browser\ Next.js client + SGP4]))

    rect((5.0, 4.0), (8.4, 5.1), name: "web", radius: 2pt)
    content("web", align(center, text(size: 8pt)[Render web service\ Next.js server]))

    rect((5.0, 1.8), (8.4, 2.9), name: "db", radius: 2pt)
    content("db", align(center, text(size: 8pt)[Neon PostgreSQL 16\ canonical tables + views]))

    rect((11.2, 4.0), (14.6, 5.1), name: "sources", radius: 2pt)
    content("sources", align(center, text(size: 8pt)[External sources\ GCAT · NSSDCA · SA · NASA]))

    rect((11.2, 1.8), (14.6, 2.9), name: "cron", radius: 2pt)
    content("cron", align(center, text(size: 8pt)[GitHub Actions\ ETL + CelesTrak refresh]))

    line("browser.east", "web.west", mark: (end: ">"))
    content((4.1, 4.78), text(size: 7pt)[HTTPS])

    line("web.south", "db.north", mark: (end: ">"))
    content((7.15, 3.45), text(size: 7pt)[SQL / HTTPS])

    line("sources.south", "cron.north", mark: (end: ">"))
    content((13.55, 3.45), text(size: 7pt)[bulk fetch])

    line("cron.west", "db.east", mark: (end: ">"))
    content((9.8, 2.58), text(size: 7pt)[upsert])

    line("web.north-east", "sources.north-west", mark: (end: ">"), stroke: (paint: luma(120), dash: "dashed"))
    content((9.8, 5.35), text(size: 7pt)[image proxy])
  }),
  caption: [Runtime topology. The web service never calls CelesTrak on a user's behalf; only the scheduled job does.],
)

== Logical layers

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Logical layers and their responsibilities],
  table(
    columns: (3.0cm, 1fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Layer*], [*Responsibility*], [*Technology*]),
    [Presentation], [Routes, layouts, cards, timelines, maps, client-side propagation], [Next.js App Router, React, Tailwind CSS, MapLibre/CesiumJS],
    [Application], [Read models, validation, API routes, image proxy, cache headers], [Next.js server, TypeScript],
    [Domain], [Artifact identity, phases, zones, provenance rules, comparison logic], [SQL views and queries, TypeScript helpers],
    [Persistence], [Canonical facts, staging, live element sets, narration cache], [PostgreSQL 16, `pg`],
    [Ingestion], [Download, parse, normalise, resolve, validate, promote], [Python, `psycopg`, `requests`],
    [Operations], [Deploy, schedule, logs, health checks, backups], [Render, Docker Compose, GitHub Actions],
  ),
)

== Component diagram

#figure(
  kind: "figure",
  supplement: "Figure",
  canvas({
    import draw: *
    set-style(stroke: 0.7pt, fill: rgb("#eef3f6"))

    rect((0.2, 3.6), (2.6, 4.5), name: "src", radius: 2pt)
    content("src", align(center, text(size: 8pt)[Source files\ and APIs]))

    rect((3.8, 3.6), (6.2, 4.5), name: "dl", radius: 2pt)
    content("dl", align(center, text(size: 8pt)[Downloader\ `etl/`]))

    rect((7.4, 3.6), (9.8, 4.5), name: "stg", radius: 2pt)
    content("stg", align(center, text(size: 8pt)[Staging\ text tables]))

    rect((11.0, 3.6), (13.6, 4.5), name: "tr", radius: 2pt)
    content("tr", align(center, text(size: 8pt)[Transform\ and validate]))

    rect((5.0, 1.6), (8.0, 2.5), name: "can", radius: 2pt)
    content("can", align(center, text(size: 7.5pt)[Canonical tables\ artifacts · phases · facts]))

    rect((9.4, 1.6), (12.4, 2.5), name: "view", radius: 2pt)
    content("view", align(center, text(size: 7.5pt)[Read views\ cards · timeline · edges]))

    rect((5.0, -0.5), (8.0, 0.4), name: "app", radius: 2pt)
    content("app", align(center, text(size: 8pt)[Next.js app]))

    line("src.east", "dl.west", mark: (end: ">"))
    line("dl.east", "stg.west", mark: (end: ">"))
    line("stg.east", "tr.west", mark: (end: ">"))
    line("tr.south", "can.north", mark: (end: ">"))
    line("can.east", "view.west", mark: (end: ">"))
    line("view.south", "app.north", mark: (end: ">"))

    line("can.south-west", "app.north-west", mark: (end: ">"))
    content((4.2, 1.0), text(size: 7pt)[SQL])
  }),
  caption: [Batch and read path. Staging is disposable; only the transform step writes canonical rows.],
)

== Request path

A read request follows a short, deterministic route:

1. The browser requests a route such as `/artifacts/apollo-11-lunar-module-eagle`.
2. Next.js resolves the slug against `v_artifact_card` and related views.
3. The server renders facts, provenance, media and the phase timeline.
4. If the artifact has a SATCAT identifier, the server returns the latest
   `gp_element` row; the browser propagates the position with `satellite.js` @satellitejs.
5. The response carries a short cache lifetime. Curated facts change rarely;
   element sets change every few hours.

There is no ORM in this path. Queries are explicit SQL, which keeps the read
model inspectable and makes the provenance joins obvious.

== Batch path

1. The downloader retrieves GCAT TSVs, launch files and lookup tables.
2. Rows land in `staging.*` as text, with `source_file` and `source_row`.
3. The transform parses numbers, VagueDates and coded values.
4. Identity resolution proposes artifacts, catalog aliases, phases and relations.
5. Validation queries check for duplicate JCATs, orphan launch tags, bad casts
   and unresolved parents.
6. One transaction promotes the release into the canonical tables and records an
   `etl_run`.
7. Curation adds mission metadata, sourced facts, credited media and explicit
   relations, then marks an artifact `is_curated`.

Staging is never read by the application. It exists so a failed transform never
requires a re-download, and so a release can be audited after the fact.

== Live tracking path

1. A GitHub Actions workflow fetches OMM records from CelesTrak @celestrak on a schedule.
2. Records are upserted into `gp_element` on `(satcat_no, epoch)`.
3. The API returns the latest element set for a curated artifact.
4. The browser propagates and draws the position.
5. Computed positions are cached for seconds, never stored.

This is the only path that talks to a third party at high frequency, and it is
isolated from the request path by design.

== Facts and narration

The central architectural invariant is that facts and narration are separate
layers:

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Facts versus narration],
  table(
    columns: (3.0cm, 1fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Layer*], [*Owns*], [*Produced by*]),
    [Facts], [Mass, dates, power, status, coordinates, comparison diffs, quiz answers], [Deterministic SQL reads],
    [Narration], [Wording, tone, story beats, podcast scripts], [An LLM given a frozen facts snapshot],
  ),
)

Consequences:

- A comparison is computed, not described. The model cannot get the difference
  wrong because it never computes it.
- A quiz answer is a field, not a generation.
- A scoped chatbot receives one artifact's facts and cannot answer from general
  knowledge.
- `story.facts_snapshot` and `story.fact_hash` make stale narration detectable.

Any feature that cannot be split this way is cut from scope.

== Invariants

The following rules hold regardless of implementation detail:

1. *One system of record.* PostgreSQL is authoritative. Caches are disposable.
2. *Identity is not a catalog number.* A physical artifact can hold several
   JCAT, SATCAT and COSPAR identifiers over its life.
3. *A phase is a catalog row.* `artifact_phase` is the unit that GCAT actually
   publishes.
4. *Every imported row has provenance.* `source_id` and `source_row` are not
   optional.
5. *The graph is derived.* Relations and parent links live in relational
   tables; a graph projection is rebuildable.
6. *The model is not authoritative.* Narration reads facts; it never writes
   them.
7. *Live tracking is Earth-orbit only.* Moon, Mars and deep-space objects show
   the last known position or a surface coordinate, labelled as such.
8. *Licences are data.* The `source` table carries the licence and the exact
   credit line, so the UI cannot omit them by accident.

== Environments

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Environments],
  table(
    columns: (3.2cm, 1fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Environment*], [*Purpose*], [*Data*]),
    [Local], [Development and schema work], [Docker Compose PostgreSQL with schema, seed and staging applied on first start],
    [Preview], [Optional per-branch review], [Separate database; never the production one],
    [Production], [Public instance], [Render PostgreSQL; nightly GCAT refresh; two-hourly CelesTrak refresh],
  ),
)

== What is deliberately centralized

- *Identity resolution.* One resolver, one set of rules. Two implementations
  would drift.
- *Zone assignment.* One SQL function used by both ETL and API.
- *Attribution.* One `source` registry and one public Sources screen.
- *Licence metadata.* Stored next to the data, not in a separate spreadsheet.

== What is deliberately decentralized

- *Position propagation.* The browser computes its own position from one
  element set. This avoids a per-user server calculation and makes the map
  resilient to server load.
- *Narration generation.* It can run on a hosted API or a self-hosted model
  without changing the fact path, because it only consumes a JSON snapshot.
- *Read caches.* HTTP and CDN caches can be added or removed without touching
  the database.
