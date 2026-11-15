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
of 12 artifacts are in place. A Next.js 15 prototype exists but still runs on
fixture data.

## Current state

| Area | State |
|---|---|
| Schema | `db/schema.sql`, 18 tables, `derive_zone()`, `phase_key`, read views |
| ETL | Download, staging, VagueDate parser, transform, curate, validate, CelesTrak refresh |
| Curation | 12 artifacts: 3 Moon, 4 Mars, 3 Earth orbit, 2 deep space |
| Facts | 24 sourced facts, 12 credited media rows |
| Frontend | Next.js 15, 6 routes, 3D map, workspace, compare, sources — fixture-backed |
| Database | Neon project `royal-sea-92317290` (PostgreSQL 18.7), schema and data loaded |
| Docs | 79-page Typst PDF, ADRs, ROADMAP |
| CI | Draft workflow at `docs/ci-workflow.yml`; needs a token with `workflow` scope to enable |

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

### Desktop connectivity problem (15 Nov 2026)

The laptop can reach Neon São Paulo and loaded the data. The desktop
(`armomarchy`, `100.66.8.105`) cannot:

```text
connection to server at "2600:1f1e:...": Network is unreachable
hostaddr 15.228.0.140 / 56.125.127.1 / 15.229.115.3: connection timeout expired
```

This is a routing/firewall problem, not a bad password. Try in this order:

1. **Use the direct URL** in `.env.local` for the test:
   `DATABASE_URL="$DATABASE_URL_UNPOOLED"` — the pooler host may be the blocked one.
2. **Test reachability**:
   `nc -vz ep-rough-rice-b6jyqn9d.c-2.sa-east-1.aws.neon.tech 5432`
   and the `-pooler` host.
3. **Check Tailscale exit node**:
   `tailscale status`, then `tailscale set --exit-node=` to clear an exit node,
   and retry.
4. **Force IPv4** in the connection string with `hostaddr=<A record>` after
   `dig +short A <host>` (libpq otherwise tries IPv6 first and fails).
5. **If São Paulo is unreachable from that network, create a Frankfurt project**
   (same region as Render production), copy its URL into `.env.local`, apply
   `db/schema.sql`, the seed and staging, then run the ETL. The data is
   reproducible from GCAT; no dump is needed. Frankfurt is the recommended
   fallback.

Do not change the laptop's working São Paulo project until the Frankfurt
replacement is loaded and verified.

## How to run

### Frontend

```bash
npm ci
npm run dev          # http://localhost:3000
npm run typecheck
npm run build
npm start
```

`lib/api.ts` uses `lib/fixtures.ts` when `NEXT_PUBLIC_API_BASE` is unset.

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

0. **Fix the desktop database connection** (see the Neon section above). The
   code step cannot be verified against the real schema until `SELECT 1` works.
1. **`lib/contract.ts`** — map:
   - zones: `earth-orbit` ↔ `earth_orbit`, `deep-space` ↔ `deep_space`
   - status: UI `active|inactive|derelict|destroyed` from phase/mission data
   - facts: `fact_type`/`fact_text` → `kind|label|value|claim`
   - phases: decide whether UI story beats are curated or derived from
     `artifact_phase`
   - slugs: `apollo-11-eagle` → `apollo-11-lunar-module-eagle`,
     `skylab-debris` → `skylab`
2. **`lib/db.ts` and `lib/queries/`** — one `pg` pool, typed rows over
   `v_artifact_card`, `v_artifact_timeline`, `v_artifact_edge`.
3. **`app/api/`** — implement `API_CONTRACT.md`:
   `/api/zones`, `/api/items`, `/api/items/:id`, `/api/items/:id/lineage`,
   `/api/sources`, `POST /api/compare`, `GET /api/health`.
4. **Switch pages one at a time** — archive first, then home, item, sources.
   Keep fixtures as the offline fallback.

Then: expand curation (Moon and deep space), add relations, Phase 4 provenance
and search, Phase 5 live tracking, Phase 6 narration.

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

## Known gaps

- No `app/api/` routes and no `lib/db.ts` yet.
- No frontend tests or lint script; `typecheck` exists.
- CI is drafted but not enabled; the gh token lacks the `workflow` scope.
- `db/migrations/` only documents the convention; no migrations yet.
- 30 lander rows have no object row (`lcat`/`rcat` not loaded).
- One `UNK` launch tag.
- CelesTrak refresh has not been exercised live.
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
