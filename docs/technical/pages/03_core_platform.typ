// 03 — Core Platform Decisions
// Part of Lost in Space — Technical System Documentation

= Core Platform Decisions
<sec-core-platform>

This section covers the application runtime, the database, and the access layer.
Each record follows the structure defined in @sec-introduction.

== Decision register

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Core platform decision register],
  table(
    columns: (1.5cm, 1fr, 2.6cm),
    inset: 6pt,
    stroke: 0.5pt,
    align: (center, left, center),
    table.header([*ID*], [*Decision*], [*Status*]),
    [001], [PostgreSQL 16 as the runtime system of record], [Accepted],
    [002], [Next.js App Router as the application framework], [Accepted],
    [003], [TypeScript in strict mode], [Accepted],
    [004], [React with Tailwind CSS for the interface], [Accepted],
    [005], [`pg` with hand-written, parameterised SQL], [Accepted],
    [006], [Numbered SQL migrations, no migration DSL], [Accepted],
    [007], [No graph server; recursive CTEs, AGE optional], [Accepted],
    [008], [`pg_trgm` for search], [Provisional],
    [009], [HTTP caching only; no Redis in the MVP], [Provisional],
    [010], [No accounts in the MVP; Auth.js if needed], [Deferred],
  ),
)

== ADR-001 — PostgreSQL 16 as the runtime system of record

*Decision.* PostgreSQL 16 @postgresql is the authoritative database for curated facts,
provenance, phase history and live orbital elements. It is queried at runtime;
there is no generated JSON file acting as the foundation.

*Context.* The domain is relational in the precise sense: artifacts have
identifiers, identifiers have validity periods, phases point at launches and
locations, and facts point at sources. The database must enforce referential
integrity, support recursive traversal, store semi-structured payloads, and run
on a managed platform without proprietary extensions. It must also support
full-text or trigram search without a second service.

*How it is used.*

- `db/schema.sql` defines the canonical tables, constraints, indexes, triggers
  and read views.
- `db/staging.sql` defines disposable text tables that mirror GCAT files.
- The application connects with a small `pg` pool; every query is parameterised.
- `pg_element` stores the latest CelesTrak element set per object.
- Recursive CTEs implement lineage; `JSONB` stores raw OMM records and frozen
  facts snapshots.
- Render provides PostgreSQL 16 in the same private network as the web service.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Database alternatives],
  table(
    columns: (3.2cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [SQLite], [Public domain], [Embedded and single-writer. A serverless or multi-instance deployment cannot share one file safely, and ephemeral filesystems lose writes. It remains a reasonable local cache, not a system of record.],
    [MySQL / MariaDB], [GPL-2.0], [Adequate relational store, but weaker JSON, CTE and extension story for this workload. No advantage over PostgreSQL.],
    [MongoDB], [SSPL-1.0], [Not OSI open source. A document model also hides the relational identity and provenance rules that this project needs to enforce.],
    [CockroachDB], [BSL-1.1], [Distributed SQL is operationally heavier than the problem requires, and the licence is source-available rather than open source.],
    [DuckDB], [MIT], [Excellent analytical engine, but an in-process OLAP database, not a transactional web backend.],
    [Neo4j as primary], [GPL-3.0], [A graph store is the wrong primary model for provenance, joins and scheduled upserts. It would duplicate the relational source of truth.],
    [Managed-only Postgres], [Service], [Neon or Supabase would work, but adds a second vendor and does not remove the need for a database. Render keeps the database beside the app.],
  ),
)

*Consequences.*

- A database server must be backed up, monitored and migrated. This is accepted
  because the alternative is losing the properties the project depends on.
- Connection pooling matters on serverless platforms; the chosen long-lived
  Render service avoids the worst of it.
- PostgreSQL-specific SQL (LATERAL, recursive CTEs, partial indexes) is used
  deliberately. Portability to another engine is not a goal; exportability is.
- If the project later needs Apache AGE, it must self-host PostgreSQL, because
  managed platforms do not install arbitrary extensions.

== ADR-002 — Next.js App Router

*Decision.* The application uses Next.js @nextjs with the App Router, written in
TypeScript, deployed as a long-lived Node service.

*Context.* The product is content-heavy and read-mostly, but also interactive:
maps, timelines, comparisons and a live position view. It needs server-side
rendering for first paint and sharing, API routes for small JSON endpoints, image
handling, and a deployment story that works on Render without proprietary
features.

*How it is used.*

- Server components read PostgreSQL directly through query functions.
- Route handlers implement `/api/health`, `/api/artifacts/[slug]` and a NASA image
  proxy.
- `generateMetadata` produces titles and descriptions from the same facts used by
  the page.
- `revalidate` and `Cache-Control` control freshness for static facts and live
  elements separately.
- Dynamic routes are preferred over a client-side router for indexable content.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Application framework alternatives],
  table(
    columns: (3.2cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [SvelteKit], [MIT], [Smaller runtime and a clean model, but a smaller component and hiring ecosystem. The team and the data tooling are React-oriented.],
    [Remix / React Router], [MIT], [Strong data-loading model and web fundamentals. Next.js has broader hosting support and a larger set of ready integrations for the map and image work.],
    [Astro], [MIT], [Excellent for content sites and islands. The live map, comparison tools and 3D views need more client application structure than Astro optimises for.],
    [Nuxt], [MIT], [Vue is a fine choice, but introduces a second ecosystem alongside the React map and visualisation libraries.],
    [Django], [BSD-3-Clause], [Batteries-included and strong for relational data, but would duplicate the Python runtime already used by the ETL and force a separate frontend layer.],
    [Rails], [MIT], [Productive, but the same duplication problem and a weaker fit for the interactive map stack.],
    [React + Vite], [MIT], [No server rendering or route handlers out of the box. Would require assembling a framework around it.],
    [Vercel-only features], [Proprietary], [Deliberately avoided. Deployment must remain portable to Render or a VPS.],
  ),
)

*Consequences.*

- Next.js is maintained by Vercel. The framework is MIT, but the company's
  priorities influence its direction. The exit path is a standard React
  application with a Node server.
- The App Router introduces server/client boundaries that must be understood.
  Data fetching stays on the server wherever possible.
- The build is heavier than a static site. That is acceptable for a
  database-backed application.

== ADR-003 — TypeScript in strict mode

*Decision.* All application code is TypeScript @typescript with `strict` enabled. Runtime
validation is applied at trust boundaries.

*Context.* Catalog data is full of nullable identifiers, mixed numeric flags and
raw strings. A type system catches a large class of mistakes before deployment,
and shared types keep the server and client honest about the API contract.

*How it is used.*

- Domain types live in `types/` and describe artifacts, phases, sources and
  element sets.
- API responses are typed and validated; `zod` is the provisional choice for
  boundary validation.
- Database rows are mapped explicitly to domain types at the query boundary.
- `tsc --noEmit` is part of CI.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Language alternatives],
  table(
    columns: (3.0cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [JavaScript], [—], [No compile-time guarantees for nullable catalog fields. The data is too irregular to leave unchecked.],
    [JavaScript + JSDoc], [—], [A credible lightweight option, but weaker for shared API types and refactors.],
    [ReScript / Elm], [MIT / BSD-3-Clause], [Excellent type systems, but small ecosystems and a steep cost for a hackathon team.],
    [Python end to end], [PSF-2.0], [Would unify with the ETL, but the interactive map and React ecosystem are weaker, and the app would still need a JS client layer.],
  ),
)

*Consequences.*

- A build step is mandatory.
- Types can drift from SQL. The mitigation is to keep queries small, map rows in
  one place, and test the mapping.
- `zod` adds a runtime dependency; it is justified only at API and form
  boundaries, not for every internal call.

== ADR-004 — React with Tailwind CSS

*Decision.* The interface is built with React @react and Tailwind CSS @tailwind. No full component
library is adopted at the start; accessible primitives are added only when a
specific widget needs them.

*Context.* The visual language is editorial: dense fact panels, timelines,
comparison tables and a map. Utility CSS makes it fast to keep spacing and
typography consistent without inventing a design system. React is required by
Next.js and by the map and charting libraries.

*How it is used.*

- Layout and typography use Tailwind utilities and a small set of CSS variables
  for colour and spacing.
- Components are server components unless they need state, refs or browser APIs.
- Map and chart components are client components loaded dynamically.
- `shadcn/ui` patterns may be copied in as source (MIT), not installed as a
  locked package, if dialogs or menus are needed.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [UI and styling alternatives],
  table(
    columns: (3.0cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [CSS Modules], [Built into the bundler], [Good isolation, but slower to keep a consistent visual rhythm across many small components.],
    [vanilla-extract], [MIT], [Type-safe and well designed, but adds build complexity for a small team.],
    [Sass], [MIT], [Mature, but mostly superseded by utility CSS and CSS variables for this scale.],
    [Bootstrap], [MIT], [Fast to start, but imposes a recognisable look that fights an editorial archive.],
    [MUI], [MIT], [Comprehensive, but heavy and theme-coupled for a project that needs a bespoke visual language.],
    [Chakra UI], [MIT], [Pleasant API, but another runtime and theme layer on top of Tailwind-equivalent needs.],
    [Vue / Svelte / Solid], [MIT], [All capable. React was chosen for the map, 3D and charting ecosystem.],
  ),
)

*Consequences.*

- Utility class strings can become long. Shared components and a small set of
  semantic classes contain the damage.
- Tailwind encourages consistency but does not enforce accessibility. Focus
  states, contrast and keyboard navigation remain manual responsibilities.
- A future design refresh is a class-level change, not a component-library
  migration.

== ADR-005 — `pg` with hand-written SQL

*Decision.* The application uses `node-postgres` (`pg`) @nodepg with parameterised SQL.
There is no ORM and no query builder in the initial stack.

*Context.* The read models rely on `LATERAL` joins, recursive CTEs, partial
indexes and window functions. An ORM would either hide those or force raw SQL
anyway. The schema is small enough that explicit queries stay readable, and
provenance joins benefit from being visible.

*How it is used.*

- A single `Pool` is created per server process.
- Query functions live in `lib/queries/` and return typed rows.
- All user input is passed as `$1`, `$2` parameters. String interpolation into
  SQL is forbidden.
- Transactions wrap multi-statement writes.
- Read views (`v_artifact_card`, `v_artifact_timeline`, `v_artifact_edge`) keep
  common joins out of application code.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Data-access alternatives],
  table(
    columns: (3.2cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [Prisma], [Apache-2.0], [Excellent developer experience, but a generated client, its own migration engine and a query model that obscures the LATERAL and recursive SQL this project depends on.],
    [Drizzle], [Apache-2.0], [A strong alternative: SQL-like and type-safe. It still adds a schema DSL and code generation that duplicate the hand-written schema.],
    [Kysely], [MIT], [Type-safe query builder with a good reputation. A reasonable future choice if raw SQL becomes unmanageable.],
    [TypeORM], [MIT], [Heavy, decorator-driven and historically uneven in edge cases.],
    [Sequelize], [MIT], [Mature but legacy-shaped; weak fit for PostgreSQL-specific features.],
    [`postgres` (porsager)], [MIT], [A credible lighter alternative. `pg` was chosen for maturity and the largest body of PostgreSQL operational knowledge.],
    [SQL builders in Python], [—], [Would move reads into the ETL runtime and split the application.],
  ),
)

*Consequences.*

- Row-to-type mapping is manual. It is centralised and tested.
- There is no automatic protection against schema drift; migrations and tests
  must catch it.
- Parameterisation is mandatory. Code review must reject string-built SQL.

== ADR-006 — Numbered SQL migrations

*Decision.* Schema changes are plain, numbered `.sql` files applied in order.
The initial schema is a single baseline file; later changes are incremental.

*Context.* The schema is hand-written and reviewed as SQL. A migration tool that
generates SQL from a model would invert the source of truth. The team is small,
and a single database engine is used.

*How it is used.*

- `db/schema.sql` is the baseline for a fresh database.
- `db/migrations/NNN_description.sql` holds changes after the baseline.
- A `schema_migrations` table records applied versions.
- CI applies all migrations to an empty database and runs the query test suite.
- Destructive changes require an explicit backup step.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Migration tool alternatives],
  table(
    columns: (3.2cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [Prisma Migrate], [Apache-2.0], [Tied to Prisma's schema model, which is not the source of truth here.],
    [Drizzle Kit], [Apache-2.0], [Tied to the Drizzle schema DSL; same objection.],
    [node-pg-migrate], [MIT], [Reasonable, but adds a JS migration runtime for files that are already SQL.],
    [Flyway], [Apache-2.0], [Good tool, but a second runtime (JVM) for a small Node/Python stack.],
    [Liquibase], [Apache-2.0], [XML/YAML changelogs obscure the SQL and add a JVM dependency.],
    [Atlas], [Apache-2.0], [Powerful declarative tooling, but more machinery than the current schema needs.],
  ),
)

*Consequences.*

- Rollbacks are written by hand and must be planned.
- There is no automatic diff between schema and database; CI must catch drift.
- This is deliberately boring. It can be replaced without changing application
  code because the application only sees SQL.

== ADR-007 — No graph server; recursive CTEs, AGE optional

*Decision.* The graph is a data shape, not a required service. Lineage is queried
with recursive SQL over `artifact_relation` and resolved parent links. Apache AGE
@age is an optional, rebuildable read model.

*Context.* The genealogy is small, even after curation: hundreds of artifacts,
not millions of edges. The deployment target cannot install arbitrary PostgreSQL
extensions. A second graph service would add backup, security and failure modes
for a feature that SQL already handles.

*How it is used.*

- `artifact_relation` stores curated edges such as `deployed_from`,
  `component_of` and `left_behind_by`.
- `artifact_phase.parent_artifact_id` stores the resolved GCAT parent.
- `v_artifact_edge` unions both sources into one edge list.
- `db/queries/lineage.sql` performs a bounded, cycle-safe recursive traversal.
- If AGE is added, a projection job rebuilds nodes and edges from these tables.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Graph engine alternatives],
  table(
    columns: (3.0cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [Apache AGE], [Apache-2.0], [The best graph option: openCypher inside PostgreSQL, one database. Not adopted now because managed hosting cannot install it, and Cypher is not a product requirement.],
    [Neo4j Community], [GPL-3.0], [Mature Cypher tooling, but a second service and an open-core product. GPL obligations apply to distributed modifications.],
    [JanusGraph], [Apache-2.0], [Fully open, but requires Cassandra or HBase and is operationally far too heavy.],
    [NebulaGraph], [Apache-2.0], [Distributed and capable, but heavy for a small archive.],
    [Dgraph], [Apache-2.0], [Active and open, but another distributed system to run.],
    [TypeDB], [MPL-2.0], [Interesting typed knowledge model, but a different query paradigm and a learning cost with no product payoff.],
    [Oxigraph], [Apache-2.0 / MIT], [RDF/SPARQL rather than a property graph. It would force a different data model.],
    [Kuzu], [MIT], [Embedded and fast, but archived in October 2025. Not a safe new dependency.],
    [FalkorDB], [SSPL-1.0], [Not OSI open source.],
    [Memgraph], [BSL-1.1], [Source-available, not open source.],
    [ArangoDB], [BUSL-1.1], [Not OSI open source since 3.12.],
    [SurrealDB], [BUSL-1.1], [Not OSI open source.],
  ),
)

*Consequences.*

- Cypher is not available. Deep traversals are expressed as recursive CTEs.
- Very complex graph algorithms would need application code. The product does not
  need them.
- The exit path is clean: add AGE, project the tables, keep PostgreSQL canonical.

== ADR-008 — `pg_trgm` for search

*Decision.* Name search uses PostgreSQL's `pg_trgm` @pgtrgm extension with GIN indexes on
canonical names and alternate names. A dedicated search engine is deferred.

*Context.* The search corpus is small, the queries are mostly fuzzy name matches,
and the data already lives in PostgreSQL. Adding a search service would create a
second index to keep in sync for little benefit.

*How it is used.*

- `CREATE EXTENSION pg_trgm`.
- A GIN index on `artifact.canonical_name` and `artifact.alt_names`.
- Queries use `similarity()` or `ILIKE '%term%'` with a trigram index.
- If ranking becomes important, a `tsvector` column is added without changing the
  database engine.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Search alternatives],
  table(
    columns: (3.0cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [Meilisearch], [MIT], [Excellent typo-tolerant search, but another service, another index and another deployment target.],
    [Typesense], [GPL-3.0], [Fast and pleasant, but the same duplication problem plus a copyleft server.],
    [OpenSearch], [Apache-2.0], [Powerful and open, but far too heavy for hundreds of names.],
    [Elasticsearch], [SSPL / Elastic License 2.0], [Not OSI open source and operationally heavy.],
    [Algolia], [Proprietary], [Hosted dependency; violates the sovereignty constraint for a core feature.],
    [SQLite FTS], [Public domain], [Would require a second database in the runtime.],
  ),
)

*Consequences.*

- Trigram indexes consume space and do not provide semantic ranking.
- At tens of thousands of artifacts, this remains adequate. Revisit only with
  evidence of slow or poor search.

== ADR-009 — HTTP caching only; no Redis in the MVP

*Decision.* Freshness is handled with HTTP cache headers, Next.js revalidation
and short-lived in-process caching. No Redis @redis or Memcached is deployed
initially; if a shared cache is ever needed, Valkey @valkey is the open fork.

*Context.* Reads dominate, writes are scheduled, and the data is naturally
cacheable by URL. A shared cache would add a service without a demonstrated
bottleneck.

*How it is used.*

- Curated artifact pages: long `s-maxage`, stale-while-revalidate.
- Live element endpoints: short `max-age` (seconds to minutes).
- NASA image proxy: long cache with immutable content hashes.
- Optional CDN in front of the Render service.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Cache alternatives],
  table(
    columns: (3.0cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [Redis], [Licence changed in recent versions], [Powerful, but a second service and a licensing history that needs careful review.],
    [Valkey], [BSD-3-Clause], [The open fork and the preferred Redis-compatible option if a cache is ever needed.],
    [Memcached], [BSD-3-Clause], [Simple, but still another service for an unproven need.],
    [CDN only], [Service], [Useful, but not a substitute for correct origin cache headers.],
    [No caching], [—], [Wasteful for content that changes daily at most.],
  ),
)

*Consequences.*

- Each server instance has its own memory. That is acceptable because the
  database is the shared source and the read volume is modest.
- If traffic grows, add Valkey or a CDN rather than changing the data model.

== ADR-010 — No accounts in the MVP

*Decision.* The MVP has no user accounts, profiles or saved collections. If a
later feature needs identity, it uses Auth.js @authjs with a PostgreSQL adapter; no
proprietary identity provider is adopted.

*Context.* The archive is public and read-only. Accounts add registration, email,
password reset, privacy obligations and session storage for no product value in
the first release.

*How it is used.*

- No authentication middleware in the initial request path.
- If accounts are added: `user`, `account`, `session` and `verificationToken`
  tables following the Auth.js PostgreSQL schema.
- OAuth providers remain optional and replaceable.

*Alternatives considered.*

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Identity alternatives],
  table(
    columns: (3.0cm, 2.6cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Option*], [*Licence*], [*Why it was not chosen*]),
    [Auth.js], [ISC], [The provisional choice if accounts are needed: framework-native, self-hosted, database-backed.],
    [Keycloak], [Apache-2.0], [Enterprise identity server; far too heavy for a public archive.],
    [Ory Kratos], [Apache-2.0], [Powerful identity system, but a separate service and a steep configuration cost.],
    [Clerk / Auth0], [Proprietary], [Hosted identity creates a vendor dependency for a non-core feature.],
    [Supabase Auth], [Apache-2.0], [Good, but couples identity to a hosting vendor.],
  ),
)

*Consequences.*

- No personalisation, comments or saved artifacts in the MVP.
- Adding accounts later is additive and does not change the public read path.
