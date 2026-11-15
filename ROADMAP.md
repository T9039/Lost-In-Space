# Roadmap and task list

This is the working plan after the `Frontend` merge. Checked items are in the
repository and verified; unchecked items are not started unless a note says
otherwise.

Related documents:

- `docs/technical/main.pdf` — technical design and decision records
- `docs/DATABASE.md` — schema and identity rules
- `docs/DATA-SOURCES.md` — licences, endpoints and column maps
- `API_CONTRACT.md` — the REST shapes the UI expects
- `AGENTS.md` — rules for changes

## Status at a glance

| Phase | Theme | State |
|---|---|---|
| 0 | Foundation | Done |
| 1 | Ingest | Done; one live check outstanding |
| 2 | Curate | In progress — 12 artifacts, aligned with the UI |
| 3 | Application shell | All routes read PostgreSQL, with fixtures as the fallback |
| 4 | Artifact experience | Item profile is DB-backed; lineage and search next |
| 5 | Live tracking | Not started |
| 6 | Narration | Not started |
| 7 | Hardening and release | Not started |

`Frontend` was synced to `main` after the merge. Keep it in step, or work on
short-lived branches and merge back to `main` before a release.

---

## Phase 0 — Foundation

- [x] Repository on `main`, connected to `T9039/Lost-In-Space`
- [x] Source and licence audit; Space-Track, KeepTrack and Orbital Radar excluded
- [x] PostgreSQL 16 as the runtime system of record
- [x] `db/schema.sql` — tables, enums, indexes, triggers, read views
- [x] `db/staging.sql` — raw GCAT TSV landing tables
- [x] `db/seed/001_lookups.sql` — sources, statuses, orbit categories
- [x] `db/queries/{card,lineage,live}.sql`
- [x] Schema, constraints and views validated on PostgreSQL 16
- [x] `README.md`, `ATTRIBUTION.md`, `LICENSE`, `.env.example`
- [x] `render.yaml`, `docker-compose.yml`
- [x] Markdown docs and the 79-page Typst technical document
- [x] `AGENTS.md`
- [x] React/Next.js prototype merged from `Frontend`

**Exit criterion:** schema applies from empty; views return expected rows; the
design is documented. Met.

---

## Phase 1 — Ingest

- [x] `etl/download_gcat.py` — catalogs, tables and launch files
- [x] `etl/load_staging.py` — clean TSVs and `COPY` into text staging
- [x] `etl/vague_date.py` — one parser for all GCAT date shapes
- [x] `etl/parse.py` — strict number, null and flag parsing
- [x] `etl/transform.py` — lookups plus curated artifact targets
- [x] `etl/curate.py` — mission, facts, media and relations
- [x] `etl/validate.py` — hard checks and data-completeness warnings
- [x] `etl/celestrak_refresh.py` — OMM fetch and upsert
- [x] `derive_zone()` SQL function used by the ETL
- [x] `phase_key` handles deep-space JCAT reuse (Voyager 1: four phases)
- [x] 26 unit tests
- [x] End-to-end: 258,367 staging rows, 392 launch files, 12 artifacts, 29 phases
- [x] Idempotency: identical counts after a second run
- [x] Exercise `celestrak_refresh` against the live CelesTrak API
- [x] Decide whether to load `lcat`/`rcat` — deferred; documented in `docs/DATABASE.md`
- [ ] Add a CI job that applies the schema and runs the ETL on fixtures

**Known warnings:** `UNK` launch tag; 30 lander rows without an object row.

---

## Phase 2 — Curate

The set is aligned with the UI fixtures.

- [x] `curation/artifacts.json` and `etl.curate`
- [x] 12 curated artifacts: 3 Moon, 4 Mars, 3 Earth orbit, 2 deep space
- [x] 24 facts with source URLs; 12 credited media rows
- [x] Mission summaries and abandonment reasons
- [x] `is_curated = true` only after sourcing
- [x] **Align the artifact set with the UI** — added Opportunity, Apollo 15 LRV,
      InSight and Skylab
- [ ] Expand to roughly 6–10 per zone (Moon and deep space are thinnest)
- [ ] Add `artifact_relation` edges (`deployed_from`, `component_of`,
      `left_behind_by`, `landed_with`)
- [ ] Resolve parent links across selected artifacts
- [ ] Review every fact against its source page
- [x] Add model rows to `media` (`media_type = 'model'`)

### Fixture coverage

| Frontend fixture | Database slug | Note |
|---|---|---|
| `opportunity` | `opportunity` | aligned |
| `apollo-11-eagle` | `apollo-11-lunar-module-eagle` | slug alias needed |
| `apollo-15-rover` | `apollo-15-rover` | aligned |
| `insight` | `insight` | aligned |
| `vanguard-1` | `vanguard-1` | aligned |
| `skylab-debris` | `skylab` | slug and scope alias needed |
| `voyager-1` | `voyager-1` | aligned |
| `pioneer-10` | `pioneer-10` | aligned |

Database-only additions: `surveyor-3`, `perseverance-rover`,
`viking-lander-1`, `hubble-space-telescope`.

The remaining alias work belongs in `lib/contract.ts`, not in the database.

---

## Phase 3 — Application shell

The app builds and every route reads PostgreSQL. Fixtures remain the offline fallback.

- [x] Next.js 15 + TypeScript + Tailwind prototype
- [x] Routes: `/`, `/archive`, `/item/[id]`, `/compare`, `/test`, `/sources`
- [x] 3D solar map, model viewer, compare tray, mission workspace
- [x] `API_CONTRACT.md`
- [x] `npm ci` and `npm run build` succeed; all routes return 200
- [x] Development database provisioned on Neon and loaded with the full dataset
- [x] App reaches Neon over HTTPS; native `psql`/ETL still need a 5432-capable network
- [x] `lib/db.ts` — one lazy server handle (`neon-http` over HTTPS or a `pg` pool)
- [x] Typed queries over `v_artifact_card` and `v_artifact_timeline`
- [x] Typed lineage query over `v_artifact_edge`
- [x] `app/api/zones`, `items`, `items/[id]`, `items/[id]/lineage`, `sources`
- [x] `POST /api/compare` from database records and the deterministic diff
- [x] Move the spec join and same/different arithmetic into SQL (`lib/compare.ts` still formats highlights)
- [x] `GET /api/health`
- [x] Archive, home, item, sources and compare read PostgreSQL with fixture fallback
- [x] Sources page driven by the `source` table
- [x] Loading, empty and fallback states in the DB-backed flow
- [x] Cache headers for curated facts
- [ ] Accessibility pass
- [x] Decide direct server queries vs all-through-`/api`: server components call
      typed query functions; client components continue to use `lib/api.ts`

**Decision:** server components call typed query functions directly; client
components keep using `lib/api.ts` and the REST endpoints. `/archive` is the
reference implementation, with fixtures as the offline fallback.

---

## Frontend ↔ database mapping

This is the adapter layer that does not exist yet.

| Concept | Frontend (`lib/types.ts`) | Database |
|---|---|---|
| Zone | `earth-orbit`, `deep-space` | `earth_orbit`, `deep_space` |
| Status | `active`, `inactive`, `derelict`, `destroyed` | GCAT phase status codes; no artifact-level status |
| Phase | `built`, `launched`, `worked`, `abandoned`, `still-there` | `artifact_phase` rows (catalog states) |
| Fact | `kind`, `label`, `value`, `claim`, `source_id` | `fact.fact_type`, `fact_text`, `value`, `source_id` |
| Source | `id`, `title`, `publisher`, `url`, `kind` | `source.source_id`, `name`, `homepage_url` |
| Item id | slug-like (`apollo-11-eagle`) | `artifact.slug` (`apollo-11-lunar-module-eagle`) |
| Models | static `/public/models` + `model_credit` | no model table |

- [x] Write `lib/contract.ts` with pure mapping functions
- [x] Add unit tests for `lib/contract.ts`
- [x] Add real-database integration tests for the query layer
- [x] UI story phases are derived deterministically from `artifact_phase`
- [x] UI `status` is derived from the final phase code and mission outcome
- [x] Align IDs with a slug alias map (`apollo-11-eagle`, `skylab-debris`)

---

## Phase 4 — Artifact experience

The visual pieces exist; the item profile and archive now read PostgreSQL.

- [x] Artifact profile layout (`/item/[id]`)
- [x] Story-beat timeline component
- [x] Facts and specs panels
- [x] Comparison UI (client-side diff)
- [x] Archive grid and zone filters
- [x] DB-backed profile: `v_artifact_card` + `v_artifact_timeline`
- [x] Per-fact source links from the `fact` table
- [x] Lineage UI from `v_artifact_edge` (empty until curated relations exist)
- [x] Server-side search (trigram) on `/api/items` and the archive
- [x] Provenance panel for phases and media
- [x] “Why it was abandoned” from `mission.abandonment_reason`
- [x] `generateMetadata` for sharing and indexing

**Exit criterion:** facts, provenance, timeline and comparison are deterministic
reads from PostgreSQL; no generated text is used.

---

## Phase 5 — Live tracking

- [x] Add `satellite.js` and a propagation wrapper with tests
- [x] `/api/artifacts/[slug]/gp` — latest element set, short cache
- [ ] Map integration (MapLibre; the current solar map is illustrative)
- [x] Element epoch and data-age labels
- [x] Schedule the CelesTrak job (`render.yaml`, every 2 h) and verify the prune logic
- [x] Explicit “last known position” for non-Earth objects

---

## Phase 6 — Narration

- [ ] Canonical facts-snapshot builder and `fact_hash`
- [ ] Provider adapter: `none`, `ollama`, OpenAI-compatible
- [ ] Story generation command and cache keyed by hash
- [ ] “AI generated” label and link to the facts used
- [ ] Prompt versioning
- [ ] Confirm nothing in comparisons, quizzes or facts reads `story`

---

## Phase 7 — Hardening and release

- [ ] Enable the drafted CI workflow (`.github/workflows` needs workflow scope)
- [x] Add `typecheck` and `test` scripts (node:test + tsx)
- [ ] Add a lint script (and Playwright when the DB-backed flow stabilises)
- [x] Backup and restore drill (12 MB dump restored into a temporary Neon database)
- [ ] Accessibility, responsive and performance passes
- [ ] Deploy to Render with a paid database and cron
- [ ] Verify attribution and licences on every page
- [ ] Tag `v1.0`; attach the documentation PDF

---

## Cross-cutting gaps

- [x] CI workflow drafted at `docs/ci-workflow.yml`
- [ ] Enable CI after `gh auth refresh -s workflow` (workflow files need that scope)
- [x] `db/migrations/README.md` documents the forward-only convention
- [x] `app/api/` routes and `lib/db.ts` are in place
- [x] `npm run typecheck` added
- [ ] No lint script (unit, component and system tests exist)
- [x] `.env.example` documents `NEXT_PUBLIC_API_BASE`
- [x] `ATTRIBUTION.md` includes NASA mission pages
- [x] Technical docs point at `app/`, `components/` and `lib/`
- [x] Branding is Lost in Space; the museum name is gone from the UI
- [x] The 30 unmatched lander rows are a documented deferral; `UNK` is preserved
- [x] CelesTrak refresh exercised live (manual run; scheduling remains open)
- [x] Image proxy implemented for remote NASA assets; bundled images stay local
- [x] Countermeasure for blocked TCP/5432: HTTPS SQL runner + SSH tunnel helper
- [ ] No narration provider or snapshot builder

---

## Next three actions

1. **Curated lineage** — add `artifact_relation` edges so `v_artifact_edge`
   returns meaningful parent/child links, not only raw phase parents.
2. **Expand curation** — Moon and deep space to 6–10 artifacts.
3. **Harden the DB-backed flow** — contract tests, frontend tests and the
   accessibility pass; then enable CI.
