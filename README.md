# Lost in Space

An open, self-hostable archive of the hardware humans left behind — on the Moon,
on Mars, in Earth orbit, and on the way out of the Solar System.

The rule that shapes everything: **the database owns facts, the model only owns
wording.** Mass, dates, coordinates, status and comparison diffs are deterministic
reads. Narration is generated separately from a frozen snapshot of those facts.

## Status

Phase 0 — database and stack pinned. The ETL loader is implemented and tested;
curation and the application are next. See [`ROADMAP.md`](ROADMAP.md) for the
phased plan and the task list.

- [x] Repository connected to `T9039/Lost-In-Space`
- [x] PostgreSQL schema, staging tables, reference data
- [x] Source/licence audit and attribution rules
- [x] Deployment target chosen (Render)
- [x] Technical system documentation (Typst, ADRs, data model, sources)
- [x] GCAT loader and identity resolver
- [ ] Curated artifacts across all four zones
- [ ] Next.js app and live-tracking UI

## Stack

| Piece | Choice |
|---|---|
| App | Next.js + TypeScript |
| Database | PostgreSQL 16 |
| Live tracking | CelesTrak OMM + SGP4 (`satellite.js`) |
| ETL | Python + `psycopg` |
| Hosting | Render (web service + Postgres + cron) |
| Graph | Not required; recursive CTEs. Apache AGE optional |

Everything in the runtime path is open source. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for why each piece was chosen and
[`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md) for licences and ingestion details.

## Quick start

Requires Docker and `psql`.

```bash
docker compose up -d db
export DATABASE_URL=postgres://lost_in_space:lost_in_space@localhost:5433/lost_in_space

# Already applied on first container start; run manually on an existing database:
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed/001_lookups.sql
psql "$DATABASE_URL" -f db/staging.sql
```

Verify:

```bash
psql "$DATABASE_URL" -c "select count(*) from source;"
psql "$DATABASE_URL" -c "select code, name from orbit_category order by sort_order limit 5;"
```

Reset everything (destroys the volume):

```bash
docker compose down -v && docker compose up -d db
```

## Repository layout

```text
.
├── db/
│   ├── schema.sql              canonical tables, indexes, views
│   ├── staging.sql             raw GCAT TSV landing tables
│   ├── seed/001_lookups.sql    sources, statuses, orbit categories
│   └── queries/                card, lineage and live-tracking SQL
├── docs/
│   ├── ARCHITECTURE.md         stack, Render decision, live tracking
│   ├── DATABASE.md             data dictionary and identity rules
│   ├── DATA-SOURCES.md         licences, endpoints, column maps
│   └── technical/              full technical documentation (Typst source + PDF)
├── etl/                        loader pipeline (phase 1)
├── hackathonWoes.md            original product architecture
├── resources.md                original source notes
├── AGENTS.md                   repository rules for humans and coding agents
├── render.yaml                 deployment blueprint
├── docker-compose.yml          local PostgreSQL
├── ATTRIBUTION.md
└── LICENSE                     MIT for code
```

## Data model in one paragraph

A physical object is an `artifact`. The names catalogs give it — JCAT, SATCAT,
COSPAR — are rows in `artifact_catalog_id`, because GCAT reassigns catalog
numbers across an object's life. Each state between two events is an
`artifact_phase`, keyed by the GCAT JCAT row. Launch events, organizations,
sites and locations are normalised. Curated claims live in `fact` with a source
URL; generated narration lives in `story` and never feeds facts. Read
[`docs/DATABASE.md`](docs/DATABASE.md) before writing a query.

## Licensing

- **Code:** MIT — see [`LICENSE`](LICENSE).
- **Curated data:** CC-BY-4.0.
- **Imported data:** retains its source licence. GCAT is CC-BY-4.0; Space
  Artefacts is citation-only; CelesTrak is free-use but not CC-BY. See
  [`ATTRIBUTION.md`](ATTRIBUTION.md).

Do not copy a source licence onto data that does not carry it.
