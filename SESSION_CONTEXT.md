# Session context — Lost in Space

Updated: 15 November 2026
Repository: <https://github.com/T9039/Lost-In-Space>
Branches: `main` and `Frontend` (kept in step)

This file is the handoff note for continuing the project on another machine or in
a fresh OpenCode session. Read it first, then `ROADMAP.md`.

## What the project is

An open, self-hostable archive of the hardware humans left behind on the Moon, on
Mars, in Earth orbit and in deep space.

The invariant that shapes everything:

> The database owns facts. The model only owns wording.

Mass, dates, coordinates, status and comparison diffs are deterministic reads.
Narration is generated separately from a frozen facts snapshot and never feeds
facts, comparisons or quizzes.

Current phase: **3 — frontend integration**. The database, ETL and a curated set
of 12 artifacts are in place. The archive and item pages are now server-rendered
from PostgreSQL, and home, sources and compare now do too. Fixtures remain the
offline fallback.

## Current state

| Area | State |
|---|---|
| Schema | `db/schema.sql`, 18 tables, `derive_zone()`, `phase_key`, read views |
| ETL | Download, staging, VagueDate parser, transform, curate, validate, CelesTrak refresh |
| Curation | 12 artifacts: 3 Moon, 4 Mars, 3 Earth orbit, 2 deep space |
| Facts | 24 sourced facts, 12 credited media rows |
| Database | Neon project `royal-sea-92317290` (PostgreSQL 18.7), schema and data loaded |
| Database driver | `lib/db.ts` — `neon-http` (HTTPS/443) or `pg` (TCP), auto-selected from the host |
| Queries | `lib/queries/` — `archive`, `items`, `lineage`, `sources`, `zones`, `compare`, `health`, `page-data` |
| API | `app/api/` — `zones`, `items`, `items/[id]`, `items/[id]/lineage`, `sources`, `POST /api/compare`, `GET /api/health` |
| Frontend | All routes DB-backed with fixture fallback (archive, home, item, sources, compare) |
| Docs | 79-page Typst PDF, ADRs, ROADMAP |
| CI | GitHub Actions at `.github/workflows/ci.yml` — app, ETL, database and docs jobs |

Verified on the previous machine:

- `npm ci`, `npm run typecheck`, `npm run build` pass.
- All routes return 200 (`/`, `/archive`, `/sources`, `/test`, `/compare`, `/item/opportunity`).
- `pytest etl/tests` — 26 passed.
- Full ETL run: 258,367 staging rows, 392 launch files, 29 phases.
- `python -m etl.validate` passes with 2 data-completeness warnings.

## Neon database (already provisioned)

| Item | Value |
|---|---|
| Project | `royal-sea-92317290` (`royal-sea`) |
| Organization | `org-billowing-queen-70187418` |
| Branch | `production` (`br-shiny-credit-b6yatvb7`) |
| Database | `neondb` |
| Region | AWS São Paulo (`aws-sa-east-1`) |
| Server | PostgreSQL 18.7 |
| Pooled host | `ep-rough-rice-b6jyqn9d-pooler.c-2.sa-east-1.aws.neon.tech` |
| Direct host | `ep-rough-rice-b6jyqn9d.c-2.sa-east-1.aws.neon.tech` |

`.env.local` holds the connection strings and is gitignored. It defines:

- `DATABASE_URL` — pooled URL, for the web app
- `DATABASE_URL_UNPOOLED` — direct URL, for schema changes and the ETL
- `NEON_BRANCH`, `NEON_BRANCH_ID`, `NEON_FUNCTION_HOST_SUFFIX`

Never print or commit these values. The database already contains the schema
and the full dataset (12 artifacts, 29 phases, 24 facts, 12 media, 76,029
launches, 4,145 organizations, 712 sites). Do not reload it unless the data
changes.

### Desktop connectivity problem (resolved for the app, 15 Nov 2026)

The laptop can reach Neon São Paulo and loaded the data. The desktop
(`armomarchy`, `100.66.8.105`) blocks outbound TCP/5432: both the pooled and
direct hosts time out over IPv4, and IPv6 has no route. HTTPS/443 works.

`lib/db.ts` therefore sends `*.neon.tech` URLs through
`@neondatabase/serverless` over HTTPS (`neon-http`) and uses a `pg` pool only
for hosts that speak the native protocol. `DB_DRIVER` overrides the choice;
`npm run db:check` reports the transport, TCP reachability and HTTPS latency.

The app, API, build and ETL-independent routes work. `psql`, `pg_dump` and the
Python ETL still need a network or tunnel that permits 5432. No Frankfurt
project or reload is needed for the web app.

### Countermeasure when 5432 is blocked

1. **The app** already uses the Neon HTTPS driver automatically.
2. **Schema, seed files and migrations** can be applied over HTTPS:
   `npm run db:apply-sql -- db/migrations/001_nasa_3d_models.sql`.
   Statements are split outside quotes/dollar bodies and sent as one HTTPS
   transaction; `npm run db:apply-sql -- --check` verifies the connection.
3. **`psql`, `pg_dump` and the Python ETL** need a TCP path. If any SSH host can
   reach 5432 (the laptop, a VPS, a Tailscale peer), run:
   `SSH_HOST=<host> DATABASE_URL="$DATABASE_URL_UNPOOLED" npm run db:tunnel`
   then export the `DATABASE_URL` it prints. `--print` shows the rewritten local
   URL without opening the tunnel. The helper removes Neon's
   `channel_binding=require` and adds the SNI `options=endpoint=...` needed when
   the TCP connection terminates on localhost.
4. **VPN or a Tailscale exit node** is the fallback when no SSH host is
   available. The block is on outbound 5432, so any route that permits it works.

Verified on the current machine:

- `npm run typecheck`, `npm test` (unit, component and real-database query tests) and `npm run build` pass.
- `npm run test:system` passes 14 checks against the production server, including
  every page, API status codes and the compare body.
- `npm run db:check` reaches Neon over HTTPS (`neon-http`, about 1.5 s, `db=neondb`).
  Native TCP/5432 is blocked on this network; `psql`, `pg_dump` and the Python
  ETL need a network or tunnel that permits 5432.
- The live database returns 12 artifacts and 8 sources through the API.
- All pages return 200: `/`, `/archive`, `/sources`, `/compare`, `/test` and
  `/item/{opportunity,apollo-11-eagle,hubble-space-telescope}`.
- Home, sources and compare render from PostgreSQL; archive, sources and compare
  show a `DATABASE` chip, and home uses the DB portal data.
- API checks: unknown zone and malformed compare body return `400`, a missing
  item returns `404`, and `POST /api/compare` returns the deterministic diff.
- `app/api/zones`, `app/api/items`, `app/api/items/[id]`, `app/api/items/[id]/lineage`
  and `app/api/sources` send `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`;
  `compare` and `health` do not.

## How to run

### Frontend

```bash
npm ci
npm run dev          # http://localhost:3000
npm run typecheck
npm run build
npm start
npm run db:check     # connectivity diagnostic; prints host, driver and latency
npm run lint         # oxlint
npm test             # unit + component tests (node:test + tsx)
npm run test:e2e     # Playwright end-to-end against a production build
npm run build && npm run test:system   # start the server and exercise every route/API
npm run test:all     # tests, build and system checks in one command
```

`lib/api.ts` uses `lib/fixtures.ts` when `NEXT_PUBLIC_API_BASE` is unset.
`lib/db.ts` selects `neon-http` automatically for `*.neon.tech` hosts and `pg`
otherwise; set `DB_DRIVER=pg` or `DB_DRIVER=neon-http` to override.

### Python ETL

```bash
python3 -m venv .venv
.venv/bin/pip install -r etl/requirements.txt -r etl/requirements-dev.txt
.venv/bin/python -m pytest etl/tests -q
```

### Database

PostgreSQL 16+ is required. Apply (with `psql`):

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed/001_lookups.sql
psql "$DATABASE_URL" -f db/staging.sql
```

Or apply without `psql`, using the Python driver:

```bash
.venv/bin/python scripts/apply_sql.py \
  db/schema.sql db/seed/001_lookups.sql db/staging.sql
```

Then:

```bash
export ETL_DATA_DIR=data/gcat
.venv/bin/python -m etl.download_gcat
.venv/bin/python -m etl.load_staging
.venv/bin/python -m etl.transform
.venv/bin/python -m etl.curate
.venv/bin/python -m etl.validate
```

### Documentation

```bash
cd docs/technical
typst compile main.typ
```

Requires Typst 0.15.1 and Arial or Liberation Sans.

## Environment variables

See `.env.example`.

- `DATABASE_URL` — PostgreSQL connection string.
- `NEXT_PUBLIC_API_BASE` — API origin; empty means fixtures.
- `NASA_API_KEY` — optional, for the image proxy later.
- `CELESTRAK_USER_AGENT` — descriptive client identifier for the cron job.
- `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL` — narration, not wired yet.

## Decisions that are easy to break

1. A catalog number belongs to a **phase**, not to an artifact. JCAT is reused
   across deep-space phases; `phase_key` (`<jcat>:<n>`) is the unique row key.
2. Dates keep `raw`, `best`, `precision` and `approx`. Never raise precision.
3. Every imported row carries `source_id` and `source_row`. Every curated fact
   has a `source_url`.
4. SQL is parameterised; there is no ORM.
5. Nothing that answers “what is true?” may read `story`.
6. GCAT is CC-BY-4.0; Space Artefacts is citation-only; CelesTrak is free-use but
   not CC-BY; NASA assets keep per-asset credit. Space-Track is excluded.

## Immediate next work

Done in this pass:

- [x] **`lib/contract.ts`** — zones, status, facts, phases, catalogue and slug
      aliases (`apollo-11-eagle` ↔ `apollo-11-lunar-module-eagle`,
      `skylab-debris` ↔ `skylab`).
- [x] **`lib/db.ts` and `lib/queries/`** — one lazy database handle, typed reads
      over `v_artifact_card` and `v_artifact_timeline`.
- [x] **`app/api/`** — every endpoint in `API_CONTRACT.md`, including
      `POST /api/compare` and `GET /api/health`.
- [x] **Archive off fixtures** — server-rendered from PostgreSQL, fixtures kept
      as the offline fallback.
- [x] **Item pages DB-aware** — both slug forms resolve; fixtures remain the
      fallback.
- [x] **Home, sources and compare off fixtures** — all three read PostgreSQL
      with fixture fallback; sources and compare show a `DATABASE` chip.
- [x] **Lineage edges** — `/api/items/:id/lineage` includes direct edges from
      `v_artifact_edge`, joined to parent/child slugs and names.
- [x] **SQL comparison diff** — the spec FULL JOIN and same/different counts run
      in PostgreSQL; highlights remain deterministic presentation.
- [x] **Item metadata and provenance** — share/index metadata, a “Why it was
      left” panel, and per-fact source links.
- [x] **Contract tests** — six `node:test` cases over the pure mapping
      functions; run with `npm test`.
- [x] **Lineage UI** — item pages render direct `v_artifact_edge` links and show
      an explicit empty state until curated relations are added.
- [x] **Phase and media provenance** — item pages show the source behind each
      phase (`artifact_phase.source_id`) and each media row.
- [x] **Server-side search** — `/api/items?q=` and `/archive?q=` use trigram
      search; the archive debounces the query into the URL.
- [x] **Models in the database** — six `media` rows (`media_type = 'model'`)
      carry the GLB URL and NASA 3D Resources credit; the adapter falls back to
      the old static map only when a row is absent.
- [x] **Image proxy** — `/api/image` allowlists NASA image hosts, forwards a
      descriptive user agent and sets a long cache; local `/img` paths bypass it.
- [x] **SGP4 wrapper** — `lib/orbit.ts` propagates a CelesTrak OMM record to
      geodetic coordinates with `satellite.js`; deterministic tests use a real
      ISS element set.
- [x] **GP endpoint** — `/api/artifacts/:slug/gp` returns the latest stored OMM
      and a propagated position with a five-minute cache. The live CelesTrak
      refresh was exercised through the laptop tunnel and wrote element sets for
      Hubble and Vanguard 1.
- [x] **Last known position** — non-Earth item pages show the stored coordinates
      and a `LAST KNOWN POSITION` label; Earth-orbit items say live elements are
      pending.
- [x] **Element age labels** — Earth-orbit items show the GP epoch and a
      deterministic age label when an element set exists.
- [x] **Narration foundation** — canonical facts snapshot, SHA-256 `fact_hash`,
      prompt version, provider configuration and a guard that `story` never
      enters facts or comparisons.
- [x] **Attribution audit** — every page is covered by the footer credits, and
      the sources page is checked by the system test. All 12 unique fact source
      URLs resolve (three only via the laptop network).
- [x] **Playwright + accessibility** — twelve end-to-end checks cover every
      route; axe reports no serious or critical violations on the five main
      pages.
- [x] **Story generation** — `npm run story -- --slug <slug>` builds a frozen
      snapshot, checks the `story` cache by `fact_hash`, and calls Ollama or an
      OpenAI-compatible provider. Cached stories render with an AI-generated
      label and a link to the facts used.

Next:

1. Add curated `artifact_relation` edges so lineage is more than raw phase parents.
2. Expand curation (Moon and deep space), then Phase 4 provenance and search,
   Phase 5 live tracking, Phase 6 narration.
3. Harden the flow: contract tests, frontend tests and accessibility.

## Database hosting decision

The curated data is reproducible from GCAT plus `curation/artifacts.json`; no
dump needs to move.

**Decision:** managed PostgreSQL for development, Render PostgreSQL for
production. The local database is not exposed over Tailscale.

### Development: Neon (already provisioned)

The project is linked to Neon project `royal-sea-92317290` in organization
`org-billowing-queen-70187418`, branch `production`. The schema and the full
GCAT dataset are already loaded (12 artifacts, 29 phases, 24 facts, 12 media,
76,029 launch records).

`.env.local` holds the connection strings and is gitignored. It is
machine-specific: copy it to another machine, or run `neon init` there. Never
commit it.

On a second machine, either copy the file:

```bash
scp .env.local thuto@HOST:~/Projects/lost-in-space/.env.local
```

or authenticate the Neon CLI there and run:

```bash
neon init -y --agent opencode \
  --org-id org-billowing-queen-70187418 \
  --project-id royal-sea-92317290
```

To create a separate project instead:
2. Copy the connection string from the dashboard. It looks like:

   ```text
   postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
   ```

3. Put it in `.env.local` (gitignored), never in the repository:

   ```bash
   cd ~/Projects/lost-in-space
   printf 'DATABASE_URL=%s\n' 'postgresql://...' > .env.local
   ```

4. Apply the schema:

   ```bash
   set -a; source .env.local; set +a
   .venv/bin/python scripts/apply_sql.py \
     db/schema.sql db/seed/001_lookups.sql db/staging.sql
   ```

5. Run the ETL, then `etl.validate`.

### Production: Render

`render.yaml` already declares the database and injects `DATABASE_URL` into the
web and cron services. For a durable instance, change the database plan from
`free` to a paid plan; the free database expires after 30 days. Do not put the
Neon URL into `render.yaml`.

### Options considered

1. **Managed PostgreSQL** — chosen for development; reachable from any device.
2. **Rootless Podman on the desktop** — viable later for a self-hosted dev
   database, exposed over Tailscale only; not needed now.
3. **Laptop-hosted** — rejected; the laptop must stay online.

**Desktop → Neon on this network:** outbound TCP/5432 is blocked (IPv6 has no
route either), while HTTPS/443 works. `lib/db.ts` therefore sends `*.neon.tech`
URLs through `@neondatabase/serverless` over HTTPS and uses `pg` everywhere else;
`DB_DRIVER` overrides the choice. The app, API and build work, but `psql`,
`pg_dump` and the Python ETL still need a network or tunnel that permits 5432.
Run `npm run db:check` to see the current state.

## Known gaps

- No `app/api/` routes and no `lib/db.ts` yet.
- Unit, component, database and system tests exist; `typecheck` and `lint` are clean.
- CI is enabled and runs on pushes and pull requests.
- `db/migrations/` only documents the convention; no migrations yet.
- 30 lander rows have no object row; loading `lcat`/`rcat` is deferred (see `docs/DATABASE.md`).
- One `UNK` launch tag.
- CelesTrak refresh is exercised live; `render.yaml` schedules it every 2 hours.
- Image proxy, live tracking and narration are not implemented.
- 3D models are static under `public/models`; credits are in fixtures.

## Gotchas

- On the previous laptop, the `npm` first on `PATH` hung; `/usr/bin/npm` worked.
  Use the system npm if the same happens.
- `DROP SCHEMA public CASCADE` does **not** drop the `staging` schema. Reloading
  `db/staging.sql` on an existing database fails with “already exists”; that is
  expected. Truncate and reload instead.
- Re-running `etl.transform` and `etl.curate` is idempotent; row counts must stay
  the same.
- Mars longitudes from GCAT are normalised from 0..360 to -180..180 in the ETL.

## Repository layout

```text
app/                 Next.js routes
components/          archive, workspace, 3D map, labs
lib/                 API adapter, fixtures, TypeScript contracts
public/              imagery and 3D models
db/                  schema, staging, seed, queries, migrations
etl/                 Python pipeline
curation/            curated identity and narrative layer
docs/                Markdown docs and the Typst technical document
API_CONTRACT.md      frontend/backend contract
ROADMAP.md           phases, checkboxes, gaps
AGENTS.md            rules for contributors and agents
```
