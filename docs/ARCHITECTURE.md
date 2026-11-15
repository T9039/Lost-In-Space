# Architecture and stack

The purpose chose the stack. This is a read-heavy, provenance-heavy archive with
a small curated catalogue and one near-real-time feed. It does not need a graph
server, a search cluster, or a serverless data layer.

---

## 1. Stack

| Layer | Choice | Licence | Why |
|---|---|---|---|
| Web app | Next.js (App Router) + TypeScript | MIT | Server rendering, API routes, one deployable |
| UI | React + Tailwind CSS | MIT | Fast, boring, well supported |
| Maps / globes | MapLibre GL JS, CesiumJS or Three.js | BSD-3-Clause / Apache-2.0 / MIT | All OSI-approved; choose per screen |
| Database | PostgreSQL 16 | PostgreSQL Licence | Constraints, JSONB, recursive CTEs, extension freedom |
| DB driver | `pg` (node-postgres) | MIT | Plain SQL, no ORM lock-in |
| Migrations | numbered `.sql` files | — | Auditable, no framework coupling |
| ETL | Python 3.13 + `psycopg` + `requests` | PSF / LGPL-3.0 / Apache-2.0 | Batch files, text parsing, easy scheduling |
| SGP4 (server, optional) | `python-sgp4` | MIT | Same model CelesTrak uses |
| SGP4 (client) | `satellite.js` | MIT | Propagate in the browser, no per-user server cost |
| Live elements | CelesTrak OMM/JSON | Free-use policy | Public, no account, 6-digit-safe |
| Graph | **none required** | — | Recursive CTEs cover the genealogy |
| Optional graph | Apache AGE on PostgreSQL | Apache-2.0 | Only if Cypher becomes a demo feature |
| Hosting | Render | — | Web service + Postgres + cron in one blueprint |

Everything in the runtime path is open source and self-hostable. Render is a
hosting provider, not a software dependency: the same containers run on a VPS.

Deliberately excluded:

- **Space-Track** — account-gated, redistribution restrictions. Not suitable for
  an open repository.
- **KeepTrack site content** — the code is AGPL-3.0; the site is not an open
  dataset. Reusable only as code, with AGPL obligations.
- **Orbital Radar** — proprietary. UI inspiration only, no ingestion.
- **SQLite** — not a deployment target for a multi-instance web service; kept
  out of the runtime entirely.

---

## 2. Deployment: Render, not Vercel

Render is the more convenient fit for this system:

| Requirement | Render | Vercel |
|---|---|---|
| Long-lived Node process with a `pg` pool | Yes | Serverless; needs pooling/proxy care |
| Managed PostgreSQL in the same blueprint | Yes | No; bring Neon/Supabase/etc. |
| Scheduled ETL (CelesTrak every 2 h) | Cron service | Hobby cron is limited; another vendor for jobs |
| Private network between app and DB | Yes | No |
| Custom Postgres extensions (AGE later) | Self-hosted Docker service only | Not possible |

The decision does **not** depend on AGE: Render's managed Postgres also cannot
install arbitrary extensions. That is consistent with the design — AGE is
optional and would run as a separate self-hosted service if it ever ships.

Target topology:

```text
Browser
  │  Next.js UI + satellite.js SGP4
  ▼
Render web service (Next.js server)
  ├── Render PostgreSQL (private network)
  ├── NASA Image API proxy
  └── /api/health
Render cron
  ├── every 2 h : CelesTrak OMM  → gp_element
  └── nightly   : GCAT release  → staging → canonical tables
```

`render.yaml` is the target blueprint. Two practical notes:

- The free web service spins down after idle time. Use a paid instance for a
  demo that must stay warm.
- Render's free PostgreSQL expires after 30 days. A long-lived deployment needs
  a paid database plan or a self-hosted Postgres service with a disk.

Vercel remains a valid front-end host later. It would require an external
Postgres and an external scheduler, which is exactly the extra vendor this
choice avoids today.

---

## 3. Runtime data flow

```text
GCAT TSV ─┐
NSSDCA ───┤
Space ────┤──► Python ETL ──► staging ──► PostgreSQL ──► SQL views ──► Next.js
Artefacts ┘                                   ▲
NASA images ──────────────────────────────────┤
CelesTrak OMM ──► cron ──► gp_element ────────┘
```

- PostgreSQL is queried at runtime. There is no generated JSON as the system of
  record.
- A JSON response cache may sit in front of the card view. It is an output, never
  an input to facts.
- The database stores the latest element set per object. It never stores a
  position history at second resolution.

---

## 4. Live tracking

“Real time” here means **near-real-time element sets plus local propagation**.
There is no free public live radar feed.

Pipeline:

1. A Render cron job fetches CelesTrak OMM JSON/CSV on a schedule (about every
   2 hours, matching the upstream update cadence). One fetch per cycle, never one
   per user.
2. Rows are upserted into `gp_element` keyed by `(satcat_no, epoch)`.
3. The API returns the latest element set for a curated Earth-orbit artifact.
4. The browser propagates with `satellite.js` to the requested time and renders
   the position. Server-side propagation with `python-sgp4` is available for
   pass predictions or exports.
5. Computed positions are cached briefly (30–60 s). They are not persisted.

Coverage:

| Zone | What can move | Source |
|---|---|---|
| Earth orbit | Full catalog, including 6-digit IDs | CelesTrak OMM |
| Moon | Selected active spacecraft | JPL Horizons |
| Mars | Selected active spacecraft | JPL Horizons |
| Deep space | Selected active probes | JPL Horizons |
| Surface hardware | Static coordinates | GCAT lander catalogue |

Use OMM/JSON or CSV, not TLE. CelesTrak exhausted 5-digit catalog numbers on
2026-07-11 and TLE cannot represent the new 6-digit IDs.

Attribution and rate limits are recorded in `source.terms_note` and must also
appear on the Sources screen.

---

## 5. The one architectural rule: facts vs narration

Every feature splits in two:

| Layer | Owns | Produced by |
|---|---|---|
| Facts | mass, dates, power, status, coordinates, comparison diffs | deterministic SQL reads |
| Narration | wording, tone, story beats, podcast script | LLM, given only the selected facts |

Consequences:

- Comparisons are computed, not written by the model.
- Quiz answers are fields, never generations.
- A chatbot is scoped to one artifact and cannot invent a spec.

Implementation:

- `story.facts_snapshot` stores exactly what the model saw.
- `story.fact_hash` changes when facts change, so stale narration is detectable.
- `story.is_ai_generated` is surfaced in the UI.
- Facts and media always carry `source_id` and, where relevant, `source_url`.

If a feature cannot be split this way, cut it.

---

## 6. Graph: optional, never authoritative

No graph server is required. `artifact_phase.parent_artifact_id` and
`artifact_relation` provide the edges; `db/queries/lineage.sql` walks them with a
recursive CTE and a cycle guard.

If Cypher becomes a demo requirement:

1. Run Apache AGE on a **self-hosted** Postgres container (Apache-2.0).
2. Project nodes and edges from the relational tables in a rebuildable job.
3. Treat the graph as a read model. Never write authoritative data only to AGE.

This keeps one source of truth and avoids making deployment depend on an
extension that managed platforms do not offer.

---

## 7. Scaling path

| Scale | Change |
|---|---|
| 25–100 curated artifacts | Current schema, plain views |
| 1,000 artifacts | Materialised card view refreshed after ETL; trigram search already indexed |
| Full ~70k-object Earth catalog for tracking | Keep `gp_element` and staging as-is; only curated artifacts enter `artifact` |
| Read-heavy traffic | Add a Render read replica; point card/list queries at it |
| Full-text search | Add `tsvector` column or keep `pg_trgm`; no external search engine needed |

The schema does not change across these steps. Only refresh strategy and replica
count change.
