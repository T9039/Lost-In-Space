# AGENTS.md — Lost in Space

Guidance for humans and coding agents working in this repository.

## What this repository is

An open, self-hostable archive of abandoned or still-present space hardware —
Moon, Mars, Earth orbit and deep space. The design rule that shapes everything:

> **The database owns facts. The model only owns wording.**

Mass, dates, coordinates, status and comparison diffs are deterministic reads.
Narration is generated from a frozen facts snapshot and never feeds facts,
comparisons or quiz answers.

Current state: **phase 0**. Schema, source audit, attribution and deployment
target are pinned. The web application and ETL loader are not implemented yet.

## Repository map

| Path | Purpose |
|---|---|
| `db/schema.sql` | Canonical PostgreSQL schema, constraints, indexes, triggers, read views |
| `db/staging.sql` | Raw GCAT TSV landing tables (text only, disposable) |
| `db/seed/001_lookups.sql` | Sources, SatType codes, orbit categories, phase statuses |
| `db/queries/` | Card, lineage and live-tracking SQL |
| `db/migrations/` | Forward-only numbered migrations after the baseline |
| `etl/` | Python ingestion pipeline (`download → staging → transform → validate`) |
| `docs/` | Short-form Markdown docs and the Typst technical document |
| `docs/technical/` | Full technical system documentation, ADRs, sources, data models |
| `render.yaml` | Production blueprint (web, PostgreSQL, cron) |
| `docker-compose.yml` | Local PostgreSQL on host port **5433** |
| `ATTRIBUTION.md` | Required credit lines; do not remove or reword without a licence check |

## Commands

```bash
# Database (local)
docker compose up -d db
export DATABASE_URL=postgres://lost_in_space:lost_in_space@localhost:5433/lost_in_space
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed/001_lookups.sql
psql "$DATABASE_URL" -f db/staging.sql

# ETL (when implemented)
python -m etl.download_gcat
python -m etl.load_staging
python -m etl.transform
python -m etl.validate
python -m etl.celestrak_refresh

# Application (when scaffolded)
npm ci && npm run dev
npm run typecheck && npm test

# Documentation
cd docs/technical && typst compile main.typ
```

## Non-negotiable rules

1. **Provenance.** Every imported canonical row carries `source_id` and
   `source_row`. Every user-visible curated claim has a `fact` row with a
   `source_url`.
2. **Identity.** A catalog number belongs to an `artifact_phase`, not to an
   artifact. Never add a permanent `jcat_id` to `artifact`. Never merge artifacts
   on name similarity.
3. **Dates.** Preserve `raw`, `best`, `precision` and `approx`. Never raise
   precision. Never render a year-only date as 1 January.
4. **SQL.** Parameterised queries only. No string interpolation into SQL. No ORM.
5. **Facts vs narration.** Nothing that answers “what is true?” may read `story`.
6. **Licences.** GCAT is CC-BY-4.0. Space Artefacts is citation-only. CelesTrak
   is free-use, not CC-BY. NASA assets keep per-asset credit. Space-Track is
   excluded. Do not relicense imported data.
7. **Open source runtime.** Do not add a runtime dependency under SSPL, BSL,
   BUSL or a proprietary licence. Check `docs/technical/pages/03_core_platform.typ`
   and `04_data_pipeline.typ` for recorded alternatives first.
8. **Scope.** Curated archive, not a full satellite tracker. Earth-orbit live
   tracking only.

## Working with the database

- Apply order: `schema.sql`, `seed/001_lookups.sql`, `staging.sql`, then
  migrations.
- `docker compose down -v` resets local data.
- Init scripts only run on an empty volume. On an existing volume, apply files
  with `psql`.
- The staging tables are never read by the application.
- Add an index only for a named query.
- A migration is never edited after it has been applied anywhere.

## Working with the documentation

- Typst 0.15 syntax. Bold is `*text*`. Table headers use
  `table.header([A], [B])`.
- Diagrams are Cetz canvases; there is no PlantUML or Mermaid build step.
- Every external claim gets a citation key in `docs/technical/references.bib`.
- New decisions use the next `ADR-NNN` and the record structure in section 1.5.
- The PDF is generated; do not hand-edit it.

## Testing expectations

- Database tests run against real PostgreSQL 16, never a mock.
- ETL tests use real trimmed GCAT rows as fixtures and must prove a second run
  is idempotent.
- End-to-end tests cover home, zone archive, artifact page, comparison, live map
  with a fixture element set, and the sources page.
- CI must also compile the Typst document.

## When in doubt

Read `docs/technical/pages/01_introduction.typ` for scope and
`docs/technical/pages/07_data_models.typ` for identity rules before changing the
schema. Record a new decision rather than silently diverging from a recorded one.
