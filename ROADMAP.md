# Roadmap and task list

This is the working plan. Each phase ends with something demonstrable. Checked
items are in the repository and verified; unchecked items are not started unless
a note says otherwise.

Related documents:

- `docs/technical/main.pdf` — full technical design and decision records
- `docs/DATABASE.md` — schema and identity rules
- `docs/DATA-SOURCES.md` — licences, endpoints and column maps
- `AGENTS.md` — rules for changes

## Status at a glance

| Phase | Theme | State |
|---|---|---|
| 0 | Foundation | Done |
| 1 | Ingest | Done; one live check outstanding |
| 2 | Curate | In progress — starter set done, expansion next |
| 3 | Application shell | Prototype merged; database integration next |
| 4 | Artifact experience | Partly prototyped on fixtures |
| 5 | Live tracking | Not started |
| 6 | Narration | Not started |
| 7 | Hardening and release | Not started |

Run `git log -1` for the current commit.

---

## Phase 0 — Foundation

- [x] Initialise repository on `main`, connect to `T9039/Lost-In-Space`
- [x] Audit sources and licences (GCAT, NSSDCA, Space Artefacts, CelesTrak,
      NASA Images, JPL Horizons); exclude Space-Track, KeepTrack and Orbital Radar
- [x] Choose PostgreSQL 16 as the runtime system of record
- [x] Write `db/schema.sql` (18 tables, enums, indexes, triggers, read views)
- [x] Write `db/staging.sql` (raw GCAT TSV landing tables)
- [x] Write `db/seed/001_lookups.sql` (sources, statuses, orbit categories)
- [x] Write `db/queries/{card,lineage,live}.sql`
- [x] Validate schema, constraints and views on PostgreSQL 16
- [x] Write `README.md`, `ATTRIBUTION.md`, `LICENSE`, `.env.example`
- [x] Write `render.yaml`, `docker-compose.yml`
- [x] Write `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/DATA-SOURCES.md`
- [x] Write and compile the 77-page Typst technical document
- [x] Add `AGENTS.md`

**Exit criterion:** schema applies from empty; the views return expected rows;
the design is documented. Met.

---

## Phase 1 — Ingest

- [x] `etl/download_gcat.py` — fetch catalogs, tables and launch files
- [x] `etl/load_staging.py` — clean TSVs and `COPY` into text staging
- [x] `etl/vague_date.py` — one parser for all GCAT date shapes
- [x] `etl/parse.py` — strict number, null and flag parsing
- [x] `etl/transform.py` — lookups plus curated artifact targets
- [x] `etl/validate.py` — hard checks and data-completeness warnings
- [x] `etl/celestrak_refresh.py` — OMM fetch and upsert
- [x] `curation/artifacts.json` — starter set, two artifacts per zone
- [x] `derive_zone()` SQL function used by the ETL
- [x] `phase_key` corrects deep-space JCAT reuse (Voyager 1: four phases)
- [x] 26 unit tests (`pytest etl/tests`)
- [x] End-to-end run against GCAT 1.8.9: 258,367 staging rows, 392 launch files,
      8 artifacts, 21 phases, validation passes
- [x] Update `etl/README.md` with the implemented CLI, `phase_key` and curate step
- [x] Formal idempotency check: identical counts after a second run
- [ ] Exercise `celestrak_refresh` against the live CelesTrak API
- [ ] Decide whether to load `lcat`/`rcat` (30 lander rows currently unmatched)
- [ ] Add a CI job that applies schema and runs the ETL against fixtures

**Exit criterion:** a full GCAT release loads twice with identical canonical
rows. Met for the starter set.

**Known gaps**

- `UNK` launch tag is the only unmatched launch tag (warning).
- 30 lander rows have no object row because `lcat`/`rcat` are not loaded
  (warning).
- CelesTrak refresh has unit-level coverage but has not been run live.

---

## Phase 2 — Curate

Goal: a balanced, sourced set of artifacts, not a dump of the catalog.

- [x] `etl/curate.py` and `curation/artifacts.json`
- [x] Starter set: 8 artifacts, two per zone
- [x] Moon: Eagle, Surveyor 3
- [x] Mars: Perseverance, Viking Lander 1
- [x] Earth orbit: Vanguard 1, Hubble
- [x] Deep space: Voyager 1, Pioneer 10
- [x] Resolve all phases and re-run `transform` (21 phases)
- [x] Add `mission` rows with summary and abandonment reason
- [x] Add `fact` rows with `source_url` for every user-visible claim (16)
- [x] Add `media` rows with licence and credit (8)
- [x] Set `is_curated = true` only after every claim is sourced
- [x] Zone-balance check: 2 Moon, 2 Mars, 2 Earth orbit, 2 deep space
- [x] `validate` passes; only the two known data-completeness warnings remain
- [ ] Expand to roughly 6–10 artifacts per zone:
      Moon — Lunokhod 1, Apollo 17 LRV, Chang'e 4;
      Mars — Curiosity, InSight, Opportunity;
      Earth orbit — Envisat, the ISS, a rocket stage;
      deep space — New Horizons, a heliocentric stage
- [ ] Add `artifact_relation` edges (`deployed_from`, `component_of`,
      `left_behind_by`, `landed_with`)
- [ ] Resolve parent links across selected artifacts
- [ ] Review every fact against its source page before calling the set complete

**Exit criterion:** every curated artifact has at least one sourced fact, a
zone, a resolved phase list and credited media. Met for the starter set; the
expansion is next.

**Open question:** Perseverance and the Mars landers have no distinct surface
phase in GCAT; the lander row provides coordinates and landing date. Decide
whether to synthesise a surface phase or attach the location to the last
catalog phase.

---

## Phase 3 — Application shell

The `Frontend` branch was merged. It provides the visual shell on fixture data.

- [x] Next.js 15 + TypeScript + Tailwind prototype (merged from `Frontend`)
- [x] Home, `/archive`, `/item/[id]`, `/compare`, `/test` and `/sources` routes
- [x] 3D solar map, model viewer, compare tray and mission workspace
- [x] Frontend API contract (`API_CONTRACT.md`)
- [ ] `lib/db.ts` — one `pg` pool per process, server-only
- [ ] Typed query layer over `v_artifact_card`, `v_artifact_timeline`, `v_artifact_edge`
- [ ] Implement `/api/zones`, `/api/items`, `/api/items/:id`, `/api/items/:id/lineage`,
      `/api/sources` and `/api/compare` to the contract
- [ ] Replace fixture loading with the API, keeping fixtures as an offline fallback
- [ ] `/api/health`
- [ ] Cache headers for curated facts
- [ ] Loading, empty and error states in the DB-backed flow
- [ ] Accessibility pass on the prototype

**Exit criterion:** a reader can browse all four zones and open any curated
artifact from PostgreSQL rather than fixtures; the Sources page lists every
licence and credit line.

---

## Phase 4 — Artifact experience

- [ ] `/artifacts/[slug]` profile page
- [ ] Phase timeline with precision-aware dates
- [ ] Facts and specs table with per-row source links
- [ ] “Why it was abandoned” call-out
- [ ] Media strip with credits
- [ ] Comparison view with SQL-computed diffs
- [ ] Trigram search
- [ ] Lineage view from `v_artifact_edge`
- [ ] `generateMetadata` for sharing and indexing

**Exit criterion:** facts, provenance, timeline and comparison are all
deterministic reads; no generated text is used.

---

## Phase 5 — Live tracking

- [ ] `/api/artifacts/[slug]/gp` — latest element set, short cache
- [ ] `satellite.js` wrapper and propagation tests
- [ ] MapLibre map with orbit track
- [ ] Element epoch and data-age labels
- [ ] Schedule the CelesTrak job and verify pruning
- [ ] Explicit label for Moon/Mars/deep-space objects: last known position,
      not live tracking

**Exit criterion:** an Earth-orbit artifact shows a propagating position and
the age of its element set.

---

## Phase 6 — Narration

- [ ] Canonical facts-snapshot builder
- [ ] `fact_hash` (SHA-256 of canonical JSON)
- [ ] Provider adapter: `none`, `ollama`, OpenAI-compatible
- [ ] Story generation command and cache keyed by hash
- [ ] “AI generated” label and link to the facts used
- [ ] Prompt versioning
- [ ] Confirm nothing in comparisons, quizzes or fact panels reads `story`

**Exit criterion:** generated text is reproducible from a hash and never feeds
facts.

---

## Phase 7 — Hardening and release

- [ ] GitHub Actions: app build, database tests, ETL tests, docs compile
- [ ] Backup and restore drill
- [ ] Accessibility pass (contrast, focus, keyboard)
- [ ] Performance pass on the curated pages
- [ ] Deploy to Render (paid database and cron for a durable instance)
- [ ] Verify attribution and licences on every page
- [ ] Tag `v1.0` and attach the documentation PDF

**Exit criterion:** a fresh deploy works from `render.yaml`, a restore has been
rehearsed, and every source is credited.

---

## How work is tracked

1. A commit states the phase and the task.
2. This file is updated in the same commit that completes a box.
3. A phase is not “done” until its exit criterion is met, not when its code is
   written.
4. Data changes include the validation output in the commit or pull request.
