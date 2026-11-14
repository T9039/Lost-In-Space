// 01 — Introduction
// Part of Lost in Space — Technical System Documentation

= Introduction
<sec-introduction>

== Purpose

This document records the technical design of *Lost in Space*, an open,
self-hostable archive of the hardware humans left behind on the Moon, on Mars,
in Earth orbit, and in deep space.

It exists for one reason: to make every technology choice explainable. Each
decision states what was chosen, why, how it will be used, what else was
considered, and what the choice costs. The document is written before the
application code so that implementation follows a recorded design rather than
retrofitting a rationale onto whatever gets built first.

== Scope and status

The project is at *phase 0*. The database schema, source audit, attribution
model and deployment target are pinned. The web application, ETL loader and
curated dataset are not implemented yet.

Each decision in this document carries one of four statuses:

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Decision status vocabulary],
  table(
    columns: (2.4cm, 1fr),
    inset: 8pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Status*], [*Meaning*]),
    [Accepted], [Pinned. Implementation should follow it unless a new decision supersedes it.],
    [Provisional], [The current best choice, but it depends on a measurement or a later phase. Revisit before depending on it in production.],
    [Deferred], [Deliberately not adopted now. It may be added later without changing the architecture.],
    [Rejected], [Considered and excluded. The reason is recorded so it is not re-litigated by accident.],
  ),
)

== Audience

- Software developers implementing the application and ETL.
- Reviewers evaluating whether the stack is appropriate and open source.
- Operators deploying and maintaining the instance.
- Collaborators adding data sources, artifacts or translations.
- Anyone assessing the project's sovereignty claims.

The document assumes familiarity with web applications, relational databases and
basic orbital mechanics. It does not assume prior knowledge of GCAT.

== Constraints

The design is shaped by five constraints, in priority order:

1. *Sovereignty.* Every runtime component must be open source and deployable
   without a proprietary data service. Hosting may be commercial, but the
   software must move to a self-hosted environment without a rewrite.
2. *Provenance.* Every fact must be traceable to a source. The language model
   is never the source of truth.
3. *Licence correctness.* Each source keeps its own licence. GCAT is
   CC-BY-4.0 @gcat; Space Artefacts is citation-only @spaceartefacts; CelesTrak
   is free-use but not CC-BY @celestrak.
4. *Deployability.* The system must run on a small managed platform and on a
   single VPS with Docker. No serverless-only assumptions.
5. *Scope discipline.* A hackathon timeline favours a small number of boring,
   well-understood components over a broad but fragile stack.

== How to read a decision record

Sections 3–5 use a consistent structure:

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Decision record structure],
  table(
    columns: (2.6cm, 1fr),
    inset: 8pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Field*], [*Meaning*]),
    [ID], [Stable identifier (`ADR-NNN`) for cross-referencing.],
    [Status], [Accepted, Provisional, Deferred or Rejected.],
    [Decision], [The choice in one sentence.],
    [Context], [The problem the choice solves and the constraints that apply.],
    [How it is used], [The concrete role in the system, including file paths or interfaces.],
    [Alternatives], [What else was considered, with licence and fit.],
    [Consequences], [Costs, risks and what would trigger a revisit.],
  ),
)

The numeric IDs are documentation identifiers, not database keys. They exist so
that code comments, pull requests and future revisions can refer to a decision
unambiguously.

== Document conventions

- Code, identifiers, paths and SQL types are shown in `monospace`.
- Dates are ISO 8601 where normalised; raw catalog strings are shown verbatim.
- “Real time” means near-real-time element sets plus local SGP4 propagation,
  not a live sensor feed.
- “Open source” means an OSI-approved licence. Source-available licences that
  restrict commercial use (SSPL, BSL, BUSL) are called out explicitly.
- Licence names follow the SPDX identifier where one exists.

== System summary

#figure(
  kind: "table",
  supplement: "Table",
  caption: [System summary],
  table(
    columns: (3.2cm, 1fr),
    inset: 8pt,
    stroke: 0.5pt,
    align: (left, left),
    table.header([*Dimension*], [*Summary*]),
    [Product], [A curated, sourced archive of abandoned or still-present space hardware, navigated by four zones: Moon, Mars, Earth orbit, deep space.],
    [Runtime], [Next.js server rendering @nextjs, querying PostgreSQL 16 @postgresql directly.],
    [Data], [GCAT @gcat as the backbone; NSSDCA, Space Artefacts, NASA imagery and JPL Horizons as enrichment.],
    [Live layer], [CelesTrak OMM element sets @celestrak, propagated in the browser with SGP4 @satellitejs.],
    [Narration], [An LLM writes story text from a frozen facts snapshot. It never writes facts.],
    [Deployment], [Render web service, Render PostgreSQL, and scheduled jobs. Docker Compose for local development.],
    [Graph], [No graph server. Recursive SQL over phase and relation edges. Apache AGE is optional.],
    [Code licence], [MIT. Project data is CC-BY-4.0. Imported data keeps its source licence.],
  ),
)

== Non-goals

- Real-time telemetry or command-and-control of any spacecraft.
- A complete replica of the 70,000-object Earth catalog in the curated UI.
- Orbital conjunction assessment or collision warnings.
- A general-purpose satellite tracker competing with CelesTrak or KeepTrack.
- A chatbot that answers arbitrary questions from world knowledge.
- A graph database demo for its own sake.

== Related documents

- `docs/ARCHITECTURE.md` — short-form architecture quick reference.
- `docs/DATABASE.md` — data dictionary and identity rules.
- `docs/DATA-SOURCES.md` — source endpoints, column maps and licence notes.
- `db/schema.sql`, `db/staging.sql`, `db/seed/001_lookups.sql` — executable
  definitions that this document describes.
- `ATTRIBUTION.md` — required credit lines.
