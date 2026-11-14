// 10 — Risks, Open Decisions and Roadmap
// Part of Lost in Space — Technical System Documentation

= Risks, Open Decisions and Roadmap
<sec-risks-roadmap>

A design document that lists only decisions hides the uncertainty. This section
records what could go wrong, what is still undecided, and the order in which the
remaining work will be attempted.

== Risk register

Risks are scored by likelihood and impact, each low, medium or high. The
mitigation is the action that keeps the risk from becoming a failure.

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Risk register: identity, licensing and data],
  table(
    columns: (0.9cm, 4.4cm, 1.9cm, 1.7cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (center, left, center, center, left),
    table.header([*ID*], [*Risk*], [*Likely*], [*Impact*], [*Mitigation*]),
    [R1], [Identity resolution merges unrelated hardware], [Medium], [High], [Rule proposals only; human confirmation; every merge reversible; fixture tests],
    [R2], [A licence is misread and data is relicensed], [Medium], [High], [Licence recorded per source; review step; explicit “not CC-BY” notes in the docs and UI],
    [R3], [GCAT changes its column layout], [Medium], [Medium], [Text staging with a field-count assertion; validation fails loudly; previous release retained],
    [R4], [CelesTrak changes terms or rate limits], [Medium], [Medium], [Two-hour batch fetch, aggressive caching, element sets stored locally, live layer isolated],
    [R5], [Free-tier expiry takes the demo offline], [High], [Medium], [Documented; paid plan for any long-lived instance; restore procedure tested],
    [R6], [Curation is slower than expected], [High], [Medium], [Smaller curated set, balanced by zone, sourced facts first],
    [R7], [LLM narration invents a fact], [Medium], [High], [Frozen facts snapshot, fact hash, no browsing, generated text labelled, never used for comparisons or quizzes],
    [R8], [A dependency changes to a non-open licence], [Low], [High], [Lockfile, licence check in CI, alternatives recorded for every core component],
  ),
)

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Risk register: operations, delivery and documentation],
  table(
    columns: (0.9cm, 4.4cm, 1.9cm, 1.7cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (center, left, center, center, left),
    table.header([*ID*], [*Risk*], [*Likely*], [*Impact*], [*Mitigation*]),
    [R9], [Map tiles carry restrictive terms], [Medium], [Medium], [Self-hostable style; coordinates stored independently of the tile provider; Cesium optional],
    [R10], [Schema drift between code and database], [Medium], [Medium], [Migrations in CI from empty; typed row mapping; no ORM to hide the schema],
    [R11], [SQL injection through a dynamic filter], [Low], [High], [Parameterised queries only; review rule; no string interpolation],
    [R12], [Propagation shown as live truth when stale], [Medium], [Medium], [Display element epoch and age; label simulated time; no animation for non-tracked objects],
    [R13], [Queue or cache added without need], [Low], [Low], [Explicit “no Redis, no broker” decision; revisit only with measurement],
    [R14], [Site is scraped aggressively], [Medium], [Low], [HTTP caching, edge rate limiting; the data is public, the service must stay responsive],
    [R15], [Documentation drifts from the schema], [Medium], [Medium], [Schema and docs reviewed together; doc build in CI; executable definitions cited from prose],
  ),
)

== Assumptions that could invalidate the design

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Load-bearing assumptions],
  table(
    columns: (3.2cm, 1fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left, left),
    table.header([*Assumption*], [*If false*], [*Response*]),
    [The curated set stays in the hundreds], [The card view becomes slow], [Materialised view, then a read replica],
    [Earth-orbit objects have a usable SATCAT], [Live tracking is impossible for them], [Show last known element or omit the live layer for that artifact],
    [Render remains affordable and available], [Deployment must move], [Container plus `DATABASE_URL` moves to any host],
    [A small open-weight model is good enough for narration], [Prose quality is unacceptable], [Swap the adapter for a hosted model; the fact path is unchanged],
    [PostgreSQL 16 is available with `pg_trgm` and `pgcrypto`], [Search or UUID generation must change], [Use application-side UUIDs and `ILIKE` with a smaller corpus],
  ),
)

== Open decisions

These are deliberately unresolved. Each has an owner, a trigger and a default.

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Open decisions],
  table(
    columns: (0.9cm, 3.0cm, 1fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (center, left, left, left),
    table.header([*ID*], [*Question*], [*Trigger to decide*], [*Default until then*]),
    [O1], [Add Apache AGE?], [A traversal need that recursive SQL cannot express], [No. Relational tables are canonical],
    [O2], [Add a search service?], [Trigram search is slow or ranking is poor at the curated size], [No. `pg_trgm` only],
    [O3], [Add a shared cache?], [Database read latency dominates under real traffic], [No. HTTP caching only],
    [O4], [Add accounts and saved collections?], [User research asks for it], [No. Public read-only],
    [O5], [Add a 3D globe?], [The 2D maps fail to communicate orbital context], [No. MapLibre only],
    [O6], [Self-host the narration model?], [Generation volume or privacy requires it], [Provider adapter with `none` default],
    [O7], [Store media binaries?], [Upstream assets disappear or terms require it], [No. Proxy and credit],
    [O8], [Expand beyond the curated set?], [The archive is stable and the loader is trusted], [No. Curated only],
    [O9], [Add translations?], [Audience evidence], [English only],
    [O10], [Publish a public JSON export?], [Reuse requests], [Optional derived artefact, never the runtime source],
  ),
)

== Roadmap

The roadmap is ordered by dependency, not by appeal. Each phase ends with
something demonstrable.

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Roadmap],
  table(
    columns: (1.2cm, 3.0cm, 1fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (center, left, left, left),
    table.header([*Phase*], [*Theme*], [*Deliverables*], [*Exit criterion*]),
    [0], [Design and schema], [Source audit, schema, staging, queries, this document], [Schema applies from empty and the views return expected rows],
    [1], [Ingest], [`download_gcat`, `load_staging`, `vague_date`, `transform`, `validate`], [A full GCAT release loads idempotently twice],
    [2], [Curate], [Balanced artifact set across four zones, facts with sources, media credits], [Every curated artifact has a sourced fact and a zone],
    [3], [Application], [Next.js routes, card and timeline views, comparison, sources page], [A reader can browse all four zones and open any curated artifact],
    [4], [Live layer], [CelesTrak job, `/gp` endpoint, MapLibre track, epoch labelling], [An Earth-orbit artifact shows a propagating position with data age],
    [5], [Narration], [Fact snapshot, story generation, labelling], [Generated text is reproducible from a hash and never feeds facts],
    [6], [Hardening], [CI, backups, restore drill, accessibility, performance], [Deploy is reproducible, restorable and tested],
  ),
)

=== Phase detail

*Phase 1 — Ingest.* The loader is the foundation. It must handle the real
release, not a sample: 69,999 Earth-orbit rows, 1,238 deep-space rows, 396 launch
files and the lookup tables. The exit criterion is deliberately strict: running
the pipeline twice must leave the canonical tables unchanged.

*Phase 2 — Curate.* The flagship set is chosen for narrative value and zone
balance, not for catalog convenience. Each artifact gets its phases resolved, its
launch and location attached, a sourced abandonment reason and at least one
image with a credit. A curation review checks that no zone is thin.

*Phase 3 — Application.* The read views drive server-rendered pages. The
comparison tool computes diffs in SQL, not in prose. Search uses trigram indexes.
The sources page is a first-class route, not a footer.

*Phase 4 — Live layer.* Only Earth-orbit artifacts participate. The cron job
stores elements; the browser propagates them. The UI shows the element epoch and
the age of the data, and never animates a Moon or Mars object as if it were
tracked.

*Phase 5 — Narration.* Generation is optional and cached. The facts snapshot is
frozen and hashed. The UI labels generated text and links to the facts used. A
missing model degrades to facts, not to invented prose.

*Phase 6 — Hardening.* CI covers schema, ETL, application and documentation.
Backups are restored, not just taken. Accessibility and performance are measured
on the curated pages.

== Success criteria

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Success criteria],
  table(
    columns: (2.8cm, 1fr),
    inset: 6pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Criterion*], [*Measure*]),
    [Sovereignty], [Every runtime component is open source and runs from the repository plus a `DATABASE_URL`],
    [Provenance], [Every curated fact has a source URL; the UI renders it],
    [Identity correctness], [Flagship multi-phase objects show one artifact with all phases],
    [Deployability], [A fresh deploy succeeds from `render.yaml` and from Docker Compose],
    [Live accuracy], [The map shows the element epoch and the age of the data],
    [Narration integrity], [No comparison, quiz or fact panel reads `story`],
    [Licence correctness], [The Sources screen distinguishes CC-BY, public domain, free-use and citation-only],
    [Documentation], [The PDF builds in CI and every technology has a recorded rationale],
  ),
)

== What would make the project revisit its architecture

Clear triggers, recorded so a future change is a decision rather than a drift:

- A traversal requirement that recursive SQL cannot express within a reasonable
  query budget → evaluate Apache AGE.
- A search requirement that trigram indexes cannot satisfy → evaluate
  Meilisearch or Typesense.
- A live-tracking requirement beyond Earth orbit → evaluate Skyfield or Orekit
  with stored ephemerides.
- A hosting requirement that forbids a long-lived process → revisit the framework
  choice, because the database access layer assumes one.
- A licensing change in a core dependency → the recorded alternatives table is
  the shortlist for replacement.

== Closing note

The project's claim is narrow and testable: an archive can be open, sourced and
self-hostable without pretending that a language model knows facts. The stack is
chosen to make that claim enforceable — a relational system of record, a small
number of boring components, and a documentation trail for every decision that
could otherwise be reversed by accident.
