// 09 — Development Guide
// Part of Lost in Space — Technical System Documentation

= Development Guide
<sec-development-guide>

This section is for someone who has just cloned the repository. It covers the
layout, the setup, the conventions, and the two workflows that matter most:
adding a source and curating an artifact.

== Repository layout

```text
.
├── db/
│   ├── schema.sql              canonical tables, enums, indexes, triggers, views
│   ├── staging.sql             raw GCAT TSV landing tables
│   ├── seed/001_lookups.sql    sources, statuses, orbit categories, SatType codes
│   ├── queries/
│   │   ├── card.sql            card read model
│   │   ├── lineage.sql         recursive parent/child traversal
│   │   └── live.sql            latest element set per curated artifact
│   └── migrations/             forward-only numbered changes (after baseline)
├── etl/
│   ├── README.md               pipeline design and validation queries
│   ├── requirements.txt        pinned Python dependencies
│   ├── download_gcat.py        fetch TSV tree
│   ├── load_staging.py         clean and COPY into staging
│   ├── vague_date.py           single date parser
│   ├── transform.py            normalise, resolve, promote
│   ├── celestrak_refresh.py    OMM upsert
│   └── validate.py             invariant checks
├── docs/
│   ├── ARCHITECTURE.md         short-form architecture reference
│   ├── DATABASE.md             data dictionary and identity rules
│   ├── DATA-SOURCES.md         endpoints, column maps, licences
│   └── technical/              this document (Typst)
├── src/                        Next.js application (phase 1)
├── render.yaml                 production blueprint
├── docker-compose.yml          local PostgreSQL
├── .env.example                configuration shape
├── ATTRIBUTION.md              required credit lines
└── LICENSE                     MIT for code
```

The raw catalog dump lives in `data/`, which is gitignored. Never commit a
downloaded catalog or a database dump.

== Prerequisites

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Toolchain],
  table(
    columns: (2.4cm, 1.6cm, 1fr),
    inset: 8pt,
    stroke: 0.5pt,
    align: (left, center, left),
    table.header([*Tool*], [*Version*], [*Used for*]),
    [Node.js], [22], [Next.js application and tests],
    [Python], [3.13], [ETL and fixtures],
    [PostgreSQL client], [16], [`psql`, `pg_dump`, `pg_restore`],
    [Docker], [Any recent], [Local database],
    [Typst], [0.13 or newer], [Documentation and PDF],
  ),
)

== First run

```bash
git clone https://github.com/T9039/Lost-In-Space.git
cd Lost-In-Space

cp .env.example .env
docker compose up -d db

export DATABASE_URL=postgres://lost_in_space:lost_in_space@localhost:5433/lost_in_space
psql "$DATABASE_URL" -c "select count(*) from source;"
```

The database container applies schema, seed and staging on first start. If the
volume already exists, apply the files manually:

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed/001_lookups.sql
psql "$DATABASE_URL" -f db/staging.sql
```

Then install and run the application:

```bash
npm ci
npm run dev
```

=== Reset

```bash
docker compose down -v
docker compose up -d db
```

This destroys local data. It is the normal way to recover from a half-applied
schema during development.

== Common commands

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Development commands],
  table(
    columns: (6.2cm, 1fr),
    inset: 8pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Command*], [*Effect*]),
    [`npm run dev`], [Start the Next.js development server],
    [`npm run build`], [Production build],
    [`npm run typecheck`], [`tsc --noEmit`],
    [`npm run lint`], [Lint the application],
    [`npm test`], [Vitest unit and integration tests],
    [`npm run test:e2e`], [Playwright end-to-end tests],
    [`pytest etl/tests`], [Python parser and resolver tests],
    [`python -m etl.download_gcat`], [Fetch the current GCAT TSV tree],
    [`python -m etl.load_staging`], [Load raw files into `staging.*`],
    [`python -m etl.transform`], [Normalise, resolve and promote],
    [`python -m etl.validate`], [Run the invariant checks],
    [`python -m etl.celestrak_refresh`], [Refresh `gp_element`],
    [`typst compile docs/technical/main.typ`], [Build the documentation PDF],
    [`typst watch docs/technical/main.typ`], [Rebuild on change],
  ),
)

== Conventions

=== TypeScript

- `strict` is enabled; do not add `any` to silence a real union.
- Server components fetch data; client components receive plain serialisable
  props.
- SQL lives in `src/lib/queries/` and returns typed rows.
- Every user input that reaches SQL is a parameter. String interpolation into SQL
  is a review blocker.
- Dates cross the boundary as ISO strings with an explicit precision field, never
  as ambiguous `Date` objects.

=== Python

- Format with `ruff format`; lint with `ruff check`.
- Pure functions for parsing and rule evaluation; I/O at the edge.
- No global database connection; pass a connection or a pool.
- Every ETL command is idempotent and logs one `etl_run` row.
- Raise on malformed input; never silently coerce a bad value.

=== SQL

- Lowercase keywords, aligned column lists, explicit join types.
- Every table has a comment describing one row.
- Views are the public read surface; application code does not assemble complex
  joins.
- A migration file is named `NNN_short_description.sql` and is never edited after
  it has been applied anywhere.
- Indexes are added for a named query, not speculatively.

=== Naming

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Naming rules],
  table(
    columns: (2.6cm, 1fr),
    inset: 8pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Thing*], [*Convention*]),
    [Tables and columns], [`snake_case`, singular table names],
    [Views], [`v_` prefix],
    [Enums], [Singular type name, lowercase values],
    [TypeScript types], [`PascalCase`; no `I` prefix],
    [Files], [`kebab-case.ts` for modules, `PascalCase.tsx` for components],
    [Slugs], [Lowercase, hyphenated, stable forever],
  ),
)

A slug is a public contract. If a name changes, add a redirect; do not silently
break a URL.

== Adding a data source

The sequence is fixed:

1. *Audit the licence.* Add a row to the source matrix in
   `docs/DATA-SOURCES.md` and a `source` row in the seed. Record
   `license_name`, `license_url`, `citation` and `update_cadence`.
2. *Prove the identity.* Confirm the source has a stable key you can join or
   store. If it does not, it is a curation input, not an ingest.
3. *Land raw data.* Add a staging table with text columns plus provenance
   columns. Prefer bulk files over scraping.
4. *Write a parser with fixtures.* Put two or three real rows in
   `etl/tests/fixtures/` and test the parser against them.
5. *Map to canonical tables.* Use the existing identity model. A new entity
   needs a written justification, not a new table by default.
6. *Add validation.* Every new source needs at least one query that fails
   loudly when the upstream shape changes.
7. *Record provenance.* `source_id` and `source_row` on every imported row.
8. *Update attribution.* `ATTRIBUTION.md` and the Sources screen.
9. *Update the docs.* `docs/DATA-SOURCES.md` and this document.
10. *Run the full pipeline twice.* The second run must produce identical
    canonical rows; that is the idempotency test.

Sources that fail step 1 are not added, regardless of technical quality.

== Curating an artifact

Curation is a reviewed data change, not a code change.

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Curation workflow],
  table(
    columns: (0.8cm, 2.6cm, 1fr),
    inset: 8pt,
    stroke: 0.5pt,
    align: (center, left, left),
    table.header([*Step*], [*Action*], [*Output*]),
    [1], [Shortlist], [Pick objects across all four zones; do not exhaust one zone],
    [2], [Resolve identity], [One `artifact`, its `artifact_catalog_id` rows, its `artifact_phase` rows],
    [3], [Attach context], [`launch_id`, `location_id`, surface coordinates],
    [4], [Enrich], [`mission` fields and `fact` rows with `source_url`],
    [5], [Add media], [`media` with licence and credit],
    [6], [Review], [Second pass over every claim; reject unsourced statements],
    [7], [Mark curated], [`artifact.is_curated = true`],
    [8], [Generate story], [`story` keyed by `fact_hash`],
  ),
)

Curation rules:

- Never merge two artifacts on name similarity.
- Never assert an abandonment reason without a source.
- Never round a mass or a date to make it tidier.
- A claim that cannot be sourced is removed, not softened.
- A component is a separate artifact only when it has its own identity or its own
  story. Otherwise it is a `fact`.

=== Zone balance

The curated set is reviewed as a whole. The target is a comparable number of
artifacts per zone, with at least one flagship object per zone and at least one
object that crosses a zone boundary (for example, a Mars lander that spent time
in Earth orbit). A release that doubles one zone while leaving another empty
fails review.

== Testing

#figure(
  kind: "table",
  supplement: "Table",
  caption: [What each test layer must prove],
  table(
    columns: (2.6cm, 1fr),
    inset: 8pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Layer*], [*Minimum coverage*]),
    [Unit], [VagueDate formats, number flags, zone derivation, comparison diff, SGP4 wrapper],
    [Database], [Schema applies from empty, constraints reject bad rows, views return the expected columns, lineage is cycle-safe],
    [ETL], [Parser fixtures, identity rules, idempotent second run, validation catches a truncated file],
    [End to end], [Home, zone archive, artifact page, comparison, live map with fixture elements, sources page],
  ),
)

Test data rules:

- Fixtures are real rows from a published release, trimmed to the fields under
  test.
- Tests never depend on the network.
- A test that needs the clock takes it as a parameter.
- Database tests run in a transaction that is rolled back, or against a
  disposable database created per run.

== Working on the documentation

The documentation is part of the repository and is built in CI @typst.

```bash
cd docs/technical
typst compile main.typ
typst watch main.typ
```

Rules:

- One section per file in `pages/`, included in order from `main.typ`.
- Every claim that comes from an external source gets a citation key in
  `references.bib`.
- Diagrams are Cetz canvases inside the page; no external render step.
- Tables use `table.header([...], [...])`, which is the Typst 0.15 form.
- The PDF is a build artefact. Regenerate it before a release, do not edit it.

== Contribution workflow

1. Branch from `main`: `feat/…`, `fix/…`, `docs/…`, `data/…`.
2. Keep schema changes in their own commit with a migration.
3. Run `npm run typecheck`, `npm test`, `pytest` and `typst compile` locally.
4. Open a pull request describing the change and, for a data change, the sources
   used.
5. A data pull request includes the validation query output.
6. Squash on merge; the commit message states what changed and why.

== Definition of done

A change is done when:

- it builds and the tests pass;
- it has a source for every new user-visible fact;
- it does not introduce a runtime dependency that is not open source;
- it updates the relevant document, attribution or diagram;
- it works on a fresh database created from the repository alone.
