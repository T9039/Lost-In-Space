// 08 — Configuration and Deployment
// Part of Lost in Space — Technical System Documentation

= Configuration and Deployment
<sec-config-deployment>

This section is the operational contract: what must be configured, how the
deployment is assembled, how schema changes reach production, and what happens
when a component fails.

== Configuration principles

1. *Twelve-factor where it matters.* Configuration comes from the environment;
   no environment-specific values are committed.
2. *One connection string.* `DATABASE_URL` is the only way the application
   reaches PostgreSQL.
3. *No secrets in the repository.* `.env` is gitignored; `.env.example`
   documents the shape without values.
4. *Defaults are safe.* A missing optional value disables a feature rather
   than breaking the archive.
5. *The blueprint is the source of truth.* `render.yaml` describes the
   production topology; manual dashboard changes are drift.

== Environment variables

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Environment variables],
  table(
    columns: (4.8cm, 2.0cm, 1.8cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, center, left, left),
    table.header([*Variable*], [*Required*], [*Scope*], [*Purpose and default*]),
    [`DATABASE_URL`], [Yes], [Web, ETL], [PostgreSQL connection string. Injected by Render from the database resource.],
    [`NODE_VERSION`], [No], [Web], [`22` in the blueprint.],
    [`NEXT_PUBLIC_APP_URL`], [No], [Web], [Absolute base URL for generated links. Defaults to the request host.],
    [`NASA_API_KEY`], [No], [Web], [Raises NASA Images rate limits. The proxy works without it at low volume.],
    [`CELESTRAK_USER_AGENT`], [Yes], [ETL], [Descriptive client identifier with a contact URL. Rate policy requires it.],
    [`PYTHON_VERSION`], [No], [ETL], [`3.13.0` in the blueprint.],
    [`LLM_PROVIDER`], [No], [Web, ETL], [`none`, `ollama` or `openai-compatible`. Default `none`, which disables narration.],
    [`LLM_BASE_URL`], [No], [Web, ETL], [Base URL for a self-hosted or hosted compatible endpoint.],
    [`LLM_MODEL`], [No], [Web, ETL], [Model name passed to the provider.],
    [`LOG_LEVEL`], [No], [Web, ETL], [`info` by default.],
  ),
)

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Local `.env` shape],
  table(
    columns: (1fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Key*], [*Local value*]),
    [`DATABASE_URL`], [`postgres://lost_in_space:lost_in_space@localhost:5433/lost_in_space`],
    [`NEXT_PUBLIC_APP_URL`], [`http://localhost:3000`],
    [`NASA_API_KEY`], [empty],
    [`CELESTRAK_USER_AGENT`], [`lost-in-space/0.1 (+https://github.com/T9039/Lost-In-Space)`],
    [`LLM_PROVIDER`], [`none`],
  ),
)

Rules for secrets:

- Never log `DATABASE_URL`; log the host and database name only.
- Never expose `NASA_API_KEY` to the client bundle.
- Rotate a leaked key rather than editing history.
- A cron job has its own environment; do not assume the web service's variables.

== Render blueprint

The committed blueprint is the deployment definition @render. Its shape:

```yaml
databases:
  - name: lost-in-space-db
    databaseName: lost_in_space
    user: lost_in_space
    plan: free
    postgresMajorVersion: "16"
    region: frankfurt

services:
  - type: web
    name: lost-in-space
    runtime: node
    plan: free
    region: frankfurt
    branch: main
    autoDeploy: true
    buildCommand: npm ci && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: lost-in-space-db
          property: connectionString
      - key: NODE_VERSION
        value: "22"

  - type: cron
    name: lost-in-space-celestrak
    runtime: python
    plan: starter
    schedule: "0 */2 * * *"
    buildCommand: pip install -r etl/requirements.txt
    startCommand: python -m etl.celestrak_refresh
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: lost-in-space-db
          property: connectionString
      - key: CELESTRAK_USER_AGENT
        sync: false
```

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Render resource decisions],
  table(
    columns: (3.0cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Resource*], [*Reason*]),
    [Web service], [Long-lived Node process; server rendering; database pool; image proxy],
    [PostgreSQL], [Managed 16 with private networking; same region as the service],
    [Cron service], [Scheduled ETL and CelesTrak refresh; isolated credentials and runtime],
    [Region `frankfurt`], [Co-locates database and compute; low latency inside the private network],
    [Health check], [Prevents a broken build from receiving traffic],
  ),
)

Tier caveats:

- Free web services spin down after inactivity; first request after idle is slow.
- Free PostgreSQL expires after 30 days. Production needs a paid database.
- Cron services require a paid plan.
- These are billing constraints, not design constraints. The same blueprint
  works on paid tiers without change.

== Local deployment with Docker Compose

```bash
docker compose up -d db
export DATABASE_URL=postgres://lost_in_space:lost_in_space@localhost:5433/lost_in_space
psql "$DATABASE_URL" -c "select count(*) from source;"
```

The compose file:

- pins `postgres:16`;
- maps host port `5433` to avoid a local `5432`;
- mounts `schema.sql`, the seed and `staging.sql` into
  `docker-entrypoint-initdb.d`, so an empty volume is initialised in order;
- stores data in a named volume;
- declares a `pg_isready` health check.

Reset:

```bash
docker compose down -v
docker compose up -d db
```

On an existing volume, init scripts do not re-run. Apply changes explicitly:

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed/001_lookups.sql
psql "$DATABASE_URL" -f db/staging.sql
```

== Self-hosted deployment

The self-hosted path is the sovereignty proof: a single host running the same
image and a PostgreSQL instance.

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Self-hosted topology],
  table(
    columns: (3.0cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Component*], [*Implementation*]),
    [Reverse proxy], [Caddy or nginx with automatic TLS],
    [Application], [Node 22 running the Next.js standalone build, supervised by systemd or a container restart policy],
    [Database], [PostgreSQL 16 with a persistent volume and nightly `pg_dump`],
    [Scheduler], [System `cron` invoking the same `python -m etl.*` commands],
    [Backups], [Encrypted `pg_dump` copied off-host],
    [Monitoring], [Health check polled by the proxy or an external uptime monitor],
  ),
)

Requirements:

- Node 22 and Python 3.13, or one image containing both.
- PostgreSQL 16 with `pgcrypto` and `pg_trgm`.
- Outbound HTTPS for GCAT, CelesTrak and NASA.
- A writable `data/` directory for the duration of an ingest run.

== Migrations

Order of application:

```text
db/schema.sql
db/seed/001_lookups.sql
db/staging.sql
db/migrations/NNN_description.sql   (after the baseline, in order)
```

Rules:

1. Migrations are forward-only SQL. A rollback is a new migration.
2. `schema_migrations` records the applied filename and timestamp.
3. CI applies every migration to an empty PostgreSQL 16 database and runs the
   query tests.
4. A destructive change is split: add the new shape, backfill, switch reads,
   then drop in a later release.
5. Production deploys run migrations before the new application version starts.
6. A failed migration stops the deploy and leaves the previous release serving.

The baseline is not generated from an ORM. It is reviewed SQL, which keeps the
schema readable and the migration tool replaceable.

== Startup and health

The web service must start even if the database is briefly unavailable, so the
process does not crash-loop:

1. Start the HTTP server.
2. Create the pool lazily on first query.
3. `/api/health` returns `503` until a `SELECT 1` succeeds.
4. Routes that need the database return a clear error page, not a stack trace.
5. Migrations are a deploy step, not a runtime side effect.

== Scaling

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Scaling levers in order],
  table(
    columns: (3.0cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Lever*], [*When to use it*]),
    [HTTP caching], [First. Curated pages are stable and cacheable by URL.],
    [Connection pool sizing], [When requests queue on the database rather than the CPU.],
    [Materialised card view], [When the card query shows up in slow-query logs.],
    [Read replica], [When read volume, not query cost, is the limit. Not needed for a curated archive.],
    [CDN], [When the audience is geographically spread and static assets dominate.],
    [Horizontal web instances], [When CPU-bound rendering is saturated; requires shared cache correctness, which HTTP headers already provide.],
    [Search service], [Only when trigram search is demonstrably insufficient.],
  ),
)

The application is stateless except for the database, so horizontal scaling is
possible without a session store.

== Failure modes and responses

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Deployment failure modes],
  table(
    columns: (3.2cm, 1fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Failure*], [*Symptom*], [*Response*]),
    [Database unreachable], [Health check 503; error pages], [Wait for the platform; verify private networking and credentials],
    [Pool exhausted], [Requests time out at the database], [Reduce concurrency, check for leaked clients, size the pool],
    [Migration fails], [Deploy stops], [Fix forward in a new migration; restore only if data was corrupted],
    [Upstream GCAT change], [ETL fails validation], [Keep the previous release; fix the parser],
    [CelesTrak outage], [Element sets stale], [Serve cached elements with an age label],
    [Image proxy failure], [Missing images], [Placeholder; no broken layout],
    [Disk full], [ETL write errors], [Prune `data/`, vacuum staging, check logs],
    [Free-tier expiry], [Database unavailable], [Upgrade or restore into a paid instance],
    [Bad deploy], [Health check fails; platform keeps the old release], [Roll back the application; migrations are forward-only],
  ),
)

== Backups and restore

- The managed database's automated backups are the first line.
- A nightly `pg_dump --format=custom` covers canonical and curated tables.
- Backups are encrypted at rest and copied off the host.
- A restore drill runs against a scratch database and compares row counts and
  the card view output before promotion.
- Raw GCAT files are not backed up; they are reproducible from a release tag.

Restore procedure:

```bash
createdb lost_in_space_restore
pg_restore --dbname=lost_in_space_restore --clean --if-exists dump.pgcustom
psql lost_in_space_restore -c "select count(*) from artifact;"
psql lost_in_space_restore -c "select count(*) from v_artifact_card;"
```

== Deployment checklist

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Pre-release checklist],
  table(
    columns: (1.5cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (center, left),
    table.header([*Done*], [*Item*]),
    [☐], [CI green on `main`, including the database and ETL jobs],
    [☐], [Migrations applied to a staging database and verified],
    [☐], [`DATABASE_URL` and `CELESTRAK_USER_AGENT` set for every service],
    [☐], [Health check returns 200],
    [☐], [Card, timeline and lineage queries return expected rows],
    [☐], [Sources screen shows every licence and credit line],
    [☐], [Backup taken and a restore drill completed],
    [☐], [Attribution and licence files updated if sources changed],
  ),
)
