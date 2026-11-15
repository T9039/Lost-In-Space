// 05 — Delivery and Operations
// Part of Lost in Space — Technical System Documentation

= Delivery and Operations
<sec-delivery>

This section covers how the system is built, tested, deployed and observed. The
guiding rule is that the runtime must be reproducible outside the chosen host.
Render is the default operator, not a platform the software depends on.

== ADR-021 — Render as the deployment target

*Decision.* Production runs on Render @render as a free Node web service backed by
the loaded Neon PostgreSQL database. Cron jobs have no free Render tier, so the
CelesTrak refresh runs in GitHub Actions. Local development uses Docker Compose.

*Context.* The application is a server-rendered Next.js app with a persistent
database connection pool, a scheduled ETL and a small live-data endpoint. It is
not a static site. The platform must provide a long-lived process, managed
PostgreSQL, scheduled jobs, private networking and a blueprint file that keeps
the topology in version control.

*How it is used.*

- `render.yaml` declares only the free web service; it creates no paid resource.
- `DATABASE_URL` is supplied as a dashboard secret and points at Neon; no
  connection string is committed.
- `healthCheckPath: /api/health` gates deploys.
- `autoDeploy: true` on `main`.
- The web service uses the Neon HTTPS driver, so it does not need private-network
  access to PostgreSQL.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Hosting alternatives],
  table(
    columns: (2.8cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Cost shape*], [*Why it was not chosen*]),
    [Render], [Free tier; paid for cron and durable DB], [Chosen. Blueprint, managed Postgres, long-lived Node process and cron in one place.],
    [Vercel], [Free tier; paid for cron and limits], [Excellent Next.js hosting, but the database would be external and the scheduler separate. The build is also tuned toward Vercel-specific features that the project deliberately avoids.],
    [Fly.io], [Usage-based VMs], [A good fit for a self-hosted Postgres and a container, but more operational decisions (volumes, regions, machine sizing) for the same result.],
    [Railway], [Usage-based], [Pleasant developer experience, but a less explicit infrastructure-as-code story and frequent pricing changes.],
    [Single VPS], [Fixed monthly], [The most sovereign option and the documented fallback. Requires manual TLS, backups, process supervision and patching.],
    [Kubernetes], [Cluster cost], [Substantially more operational surface than a single web service and one database.],
    [Static export + external API], [Low], [Cannot provide server rendering, a database pool, or the image proxy without adding a separate backend.],
    [AWS / GCP native], [Variable], [Powerful but the configuration surface is disproportionate to a hackathon-scale archive.],
  ),
)

*Consequences.*

- Free Render web services spin down when idle (about a minute to wake). The
  demo accepts that; a paid instance is the production upgrade.
- Neon is external, so the free Render database's 30-day expiry does not apply.
  A paid Render database and paid cron remain the fully self-contained option.
- Render's managed PostgreSQL does not allow arbitrary extensions, which is why
  Apache AGE is optional and the graph is SQL.
- The exit path is a Docker image plus `DATABASE_URL`; nothing in the application
  imports a Render SDK.

== ADR-022 — Docker Compose for local infrastructure, no production image dependency

*Decision.* Local PostgreSQL runs in Docker Compose @docker with the schema, seed and
staging files mounted into `docker-entrypoint-initdb.d`. Podman @podman is
supported for the same compose file. Production does not run
the application in a project-owned container unless self-hosting.

*Context.* Developers need a database that matches production in version and
extensions, initialised in one command. The application itself is a standard Node
process; a production container is only necessary for the self-hosted path.

*How it is used.*

- `docker-compose.yml` pins `postgres:16`, maps host port 5433 (to avoid a local
  5432 conflict), and applies `00-schema.sql`, `01-seed.sql`, `02-staging.sql`
  in filename order on first start.
- A named volume persists data; `docker compose down -v` resets it.
- A health check gates dependent commands.
- A `Dockerfile` is maintained for the self-hosted path, not used by Render.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Local environment alternatives],
  table(
    columns: (3.2cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [Docker Compose], [Apache-2.0], [Chosen. Reproducible, one command, matches the production database version.],
    [Podman Compose], [Apache-2.0], [A credible rootless alternative; documented as supported because the compose file is standard. Not the default because Docker is more widely installed.],
    [Native PostgreSQL install], [PostgreSQL licence], [Fastest on a workstation, but version drift and manual extension setup make “works on my machine” likely.],
    [Dev container], [MIT tooling], [Good for onboarding; optional because it duplicates the compose definition.],
    [SQLite for local tests], [Public domain], [Behaviour differs from PostgreSQL in types, CTEs, extensions and indexes. Tests must run against the real engine.],
    [Hosted dev database], [Service], [Adds a network dependency and shared credentials to day-to-day work.],
  ),
)

*Consequences.*

- Docker must be installed. The README states this as the only local prerequisite
  beyond `psql`.
- Container startup applies schema only on an empty volume; schema changes on an
  existing volume require an explicit `psql -f` or a reset.
- The compose file is intentionally boring. It is not a production orchestration
  template.

== ADR-023 — GitHub Actions for continuous integration

*Decision.* CI runs on GitHub Actions @githubactions. It type-checks, lints, builds,
runs unit and integration tests against a PostgreSQL service container, and
builds the Typst documentation.

*Context.* The repository is already on GitHub, and the workflows need a
PostgreSQL service, Node and Python. Actions provides all three with no
additional account.

*How it is used.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [CI jobs],
  table(
    columns: (3.0cm, 1fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Job*], [*Runs*], [*Fails when*]),
    [`app`], [`npm ci`, lint, typecheck, unit/component/DB tests, `next build`], [Type, lint, test or build error],
    [`database`], [PostgreSQL 16 service, schema, seed, staging, view checks], [Schema does not apply or a view is missing],
    [`etl`], [`pip install`, `pytest etl/tests`], [Parser, CelesTrak or resolver regression],
    [`docs`], [`typst compile main.typ`], [Documentation does not compile],
    [`e2e`], [Playwright + axe against a built app], [Route, API, accessibility or responsive contract breaks],
  ),
)

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [CI alternatives],
  table(
    columns: (3.0cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [GitHub Actions], [Service], [Chosen. Native to the repository, supports service containers and matrix jobs.],
    [GitLab CI], [MIT], [Strong product, but the repository is on GitHub.],
    [Jenkins], [MIT], [Self-hosted and flexible, but requires a server and plugin maintenance.],
    [Drone], [Apache-2.0], [Lightweight and container-native; another service to host.],
    [Buildkite], [Service], [Fast and pleasant, but a hosted dependency for a small project.],
    [No CI], [—], [Acceptable for a solo prototype; unacceptable once the schema and ETL are shared.],
  ),
)

*Consequences.*

- CI minutes are finite on the free plan. The full matrix runs on pull requests;
  a reduced job runs on `main`.
- Secrets for deployment live in GitHub, not in the repository.

== ADR-024 — node:test, Playwright and pytest

*Decision.* Unit, component and database-integration tests use `node:test` with
`tsx`; pytest covers the ETL; Playwright covers browser E2E, responsiveness and
axe accessibility. Database tests run against real PostgreSQL, not a mock.

*Context.* The riskiest logic is in SQL, dates, identity resolution and
propagation. Mocking the database would test the mocks. `node:test` avoids a
second test runtime; Playwright exercises the routes a reader actually uses.

*How it is used.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Test layers],
  table(
    columns: (3.0cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Layer*], [*Tool*], [*Covers*]),
    [Unit], [`node:test` + `tsx`], [Contract mapping, comparison, narration snapshot, SGP4 wrapper, image allowlist],
    [Component], [`react-dom/server`], [Cards, workspace, position, lineage, provenance and AI label],
    [Database], [`node:test`], [Archive reads, aliases, trigram search, zones, sources and lineage against Neon],
    [ETL], [pytest], [VagueDate parser, flag parsing, CelesTrak batching and prune allowlist],
    [End to end], [Playwright + axe], [All routes, search, comparison, MapLibre, accessibility, responsiveness],
    [System], [`scripts/system-test.mjs`], [Production server, status codes, alias resolution, GP endpoint],
    [Documentation], [Typst compile], [Citations resolve, diagrams render, PDF builds],
  ),
)

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Test tool alternatives],
  table(
    columns: (2.8cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [Jest], [MIT], [Mature, but slower and more configuration-heavy with modern ESM and TypeScript.],
    [node:test], [MIT], [Chosen. Built in, fast, and runs TypeScript through `tsx` without a second config surface.],
    [Cypress], [MIT], [Excellent developer experience, but a heavier runner and a different execution model from Playwright.],
    [Testing Library only], [MIT], [Covers components, not real browser routes or API boundaries.],
    [Mocked database tests], [—], [Would not catch schema drift, constraint or SQL errors — the most likely failures.],
    [unittest], [PSF-2.0], [Verbose and fixture-poor compared with pytest.],
  ),
)

*Consequences.*

- CI needs a PostgreSQL service for the schema job. The app job's DB tests skip
  when `DATABASE_URL` is unset; E2E deliberately runs with fixtures in CI.
- End-to-end tests are the slowest job and run on every push and pull request.
- Fixtures include real GCAT rows so the parser is tested against the real format.

== ADR-025 — Structured logs and health checks first, tracing later

*Decision.* The application emits structured JSON logs, exposes `/api/health`,
and records ETL runs in `etl_run`. No APM or tracing service is adopted
initially.

*Context.* A small archive has three operational questions: is it up, did the
last ingestion succeed, and why did this request fail? Logs plus a health endpoint
answer all three. A tracing stack would add an agent, a collector and a vendor.

*How it is used.*

- `GET /api/health` checks process liveness and a `SELECT 1` against PostgreSQL.
- Log lines include request id, route, status and duration.
- `etl_run` is the durable job history; the Sources screen can surface the last
  successful refresh.
- Errors include the SQLSTATE and the failing query name, never the parameters.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Observability alternatives],
  table(
    columns: (3.2cm, 2.8cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [OpenTelemetry + collector], [Apache-2.0], [The right standard if tracing is needed; too much infrastructure for the current scale.],
    [Sentry], [Source-available / hosted], [Useful error grouping, but a hosted dependency and a data-processing question. Optional later.],
    [Prometheus + Grafana], [Apache-2.0 / AGPL-3.0], [Excellent metrics stack; another service to host and secure.],
    [Render metrics], [Service feature], [Sufficient for CPU, memory and request counts at this scale.],
    [Log-only], [—], [Chosen baseline. Cheap, portable and enough for a read-mostly archive.],
  ),
)

*Consequences.*

- Debugging a distributed trace is not possible. The architecture has no
  distributed calls beyond one database, so this is acceptable.
- If live traffic grows, OpenTelemetry instrumentation is additive.

== ADR-026 — Typst with Cetz for documentation

*Decision.* Technical documentation is written in Typst @typst using the `swdocs`
structure from the `typst-scaffold` project @typstscaffold, with Cetz @cetz for
diagrams. PlantUML @plantuml and Mermaid @mermaid are not required to build the
document.

*Context.* The document must be versioned with the code, compile in CI, and
produce a PDF with numbered headings, a table of contents, lists of figures and
tables, and an IEEE bibliography. Typst compiles in milliseconds, has a single
binary, and its syntax is far less fragile than LaTeX for a small team.

*How it is used.*

- `docs/technical/main.typ` sets A4, Arial 11 pt, numbered headings, headers,
  footers and the front matter.
- Each section is a file in `pages/`, included in order.
- Diagrams are Cetz canvases, so they are text, diffable and compiled with the
  document.
- `references.bib` is a standard BibTeX file rendered with the built-in IEEE
  style.
- `typst compile main.typ` and `typst watch main.typ` are the only commands.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Documentation toolchain alternatives],
  table(
    columns: (3.4cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [Typst + Cetz], [Apache-2.0 / MIT], [Chosen. Fast, single binary, diffable diagrams, IEEE bibliography support.],
    [LaTeX], [LPPL], [Unmatched typesetting, but heavy toolchain and fragile package resolution for a hackathon.],
    [Pandoc + Markdown], [GPL-2.0], [Portable and simple, but precise layout, lists of figures and numbered tables need a template anyway.],
    [MkDocs Material], [MIT], [Great for a website; produces HTML, not the required PDF format.],
    [Docusaurus], [MIT], [Same objection, plus a Node build for static prose.],
    [PlantUML], [GPL-3.0], [Requires Java and a separate render step; Cetz keeps diagrams inside the compile.],
    [Mermaid CLI], [MIT], [Browser-based rendering and a separate dependency; useful in Markdown, redundant here.],
    [Graphviz], [EPL-1.0], [Good for automatic layouts, but the diagrams here are small and hand-placed.],
  ),
)

*Consequences.*

- Cetz is a smaller ecosystem than PlantUML, so complex diagrams take more code.
- The document is a build artefact; the PDF is regenerated in CI and attached to
  releases rather than committed on every change.

== ADR-027 — MIT for code, CC-BY-4.0 for project data

*Decision.* The repository code is MIT. Curated project data is CC-BY-4.0.
Imported data retains its source licence and is never relicensed. Identifiers
follow the SPDX list @spdx.

*Context.* The project claims sovereignty and reuse. A permissive code licence
maximises reuse and matches the intent. Data licensing is separate: GCAT is
CC-BY-4.0, Space Artefacts is citation-only, CelesTrak is free-use but not a CC
licence, and NASA material is mostly public domain with per-asset credit.

*How it is used.*

- `LICENSE` contains MIT and applies to code.
- `ATTRIBUTION.md` carries the exact credit lines.
- The `source` table stores `license_name`, `license_url` and `citation`, and the
  UI renders them.
- The README states the split explicitly.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Code licence alternatives],
  table(
    columns: (3.0cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*SPDX*], [*Why it was not chosen*]),
    [MIT], [MIT], [Chosen. Maximum reuse, minimal friction, compatible with every dependency in the stack.],
    [Apache-2.0], [Apache-2.0], [Adds an explicit patent grant and attribution requirements. Reasonable, but more ceremony than a small archive needs.],
    [AGPL-3.0], [AGPL-3.0], [Forces source disclosure on network use. It would deter the self-hosting and reuse the project is trying to encourage.],
    [GPL-3.0], [GPL-3.0], [Copyleft at distribution; stronger than intended for a reference implementation.],
    [Unlicense / CC0], [Unlicense / CC0], [No attribution. The project wants credit for the curation work.],
    [No licence], [—], [Legally unusable by others, which defeats the purpose.],
  ),
)

*Consequences.*

- MIT code can be embedded in proprietary products. That is accepted.
- Data licence obligations are enforced in the schema and the UI, not only in a
  text file.
- A future contributor licence agreement is unnecessary; contributions are
  inbound under MIT.

== ADR-028 — Backups, migrations and restore drills

*Decision.* Production uses the managed database's automated backups plus a
nightly `pg_dump` of the canonical schema and curated tables to a private store.
Migrations are forward-only SQL, applied once per deploy, with a recorded
version. Restores are rehearsed.

*Context.* The database is the system of record. Raw catalogs are reproducible
from GCAT, but curation, facts, media credits and narration are not. A backup
that has never been restored is a hypothesis.

*How it is used.*

- Render provides point-in-time recovery on paid plans; the free tier does not,
  which is one reason production requires a paid database.
- `pg_dump --format=custom` runs nightly for the curated subset.
- Before a destructive migration, a manual snapshot is taken and the release is
  tagged.
- `schema_migrations` records applied files in order.
- CI applies every migration from empty on each pull request.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Backup alternatives],
  table(
    columns: (3.0cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Option*], [*Why it was not chosen*]),
    [Platform backups only], [Not available on the free tier and not portable across hosts.],
    [Logical replication], [A live replica is not a backup; it replicates mistakes.],
    [Filesystem snapshots], [Not accessible on a managed database.],
    [Export curated data to JSON in git], [Useful as a public artefact and a diff, but not a transactional restore point for facts and media.],
    [No backups], [Unacceptable for curation that took human effort.],
  ),
)

*Consequences.*

- The backup contains personal data only if accounts are added later; currently
  it is entirely public archive content.
- Restore time depends on database size, which stays small because binaries are
  not stored.

== Security posture

The MVP is a public read-only archive, which keeps the attack surface small. The
rules still apply:

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Security controls],
  table(
    columns: (2.8cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Area*], [*Control*]),
    [Database access], [Private network only; no public IP; credentials injected by the platform.],
    [SQL], [Parameterised queries only; no string interpolation; least-privilege application role.],
    [Secrets], [Platform secret store; never committed; `.env` is gitignored.],
    [Image proxy], [Allowlist of upstream hosts; no arbitrary URL fetch; response size cap.],
    [Headers], [CSP, `X-Content-Type-Options`, `Referrer-Policy`, HSTS at the edge.],
    [Dependencies], [Lockfile, automated update PRs, licence check in CI.],
    [ETL], [Outbound-only; advisory lock; no inbound endpoint.],
    [Logging], [No secrets, no full connection strings, no user data.],
  ),
)

== Operational runbook

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Common operational tasks],
  table(
    columns: (3.2cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Situation*], [*Action*]),
    [Deploy failed], [Check build logs; run `npm run build` locally; verify `DATABASE_URL` is injected.],
    [Health check failing], [Query the database directly; check pool exhaustion and migration state.],
    [Stale live positions], [Inspect the last CelesTrak run in `etl_run`; re-run the cron command manually.],
    [Bad GCAT release], [Keep the previous canonical rows; staging holds the new release; fix the transform and re-run.],
    [Accidental data loss], [Restore the last `pg_dump` into a scratch database first, diff, then promote.],
    [Disk pressure], [Delete `data/` after staging; vacuum staging tables; check logs and `pg_element` retention.],
    [Suspected scraping abuse], [Tighten cache headers, add rate limiting at the edge; the data is public but the service should stay available.],
  ),
)

== What operations deliberately does not include

- No Kubernetes, no service mesh, no message broker.
- No third-party APM, error tracker or feature-flag service in the critical path.
- No blue/green deployment. A single service with a health check and a
  forward-only migration is enough at this scale.
- No multi-region. The archive is read-mostly and not latency-critical.
