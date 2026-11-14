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
| 3 | Application shell | Prototype merged; database/API integration next |
| 4 | Artifact experience | Prototyped on fixtures; DB-backed work next |
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
- [ ] Exercise `celestrak_refresh` against the live CelesTrak API
- [ ] Decide whether to load `lcat`/`rcat` (30 lander rows unmatched)
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
- [ ] Add model rows to `media` (`media_type = 'model'`) or keep them static

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

The prototype exists and builds. It is **fixture-backed**.

- [x] Next.js 15 + TypeScript + Tailwind prototype
- [x] Routes: `/`, `/archive`, `/item/[id]`, `/compare`, `/test`, `/sources`
- [x] 3D solar map, model viewer, compare tray, mission workspace
- [x] `API_CONTRACT.md`
- [x] `npm ci` and `npm run build` succeed; all routes return 200
- [ ] `lib/db.ts` — one `pg` pool, server-only
- [ ] Typed queries over `v_artifact_card`, `v_artifact_timeline`, `v_artifact_edge`
- [ ] `app/api/zones`, `items`, `items/[id]`, `items/[id]/lineage`, `sources`
- [ ] `POST /api/compare` using the SQL diff, not the client-only `lib/compare.ts`
- [ ] `GET /api/health`
- [ ] Switch `lib/api.ts` from fixtures to the server API; keep fixtures as fallback
- [ ] Sources page driven by the `source` table
- [ ] Loading, empty and error states in the DB-backed flow
- [ ] Cache headers / `revalidate` for curated facts
- [ ] Accessibility pass
- [ ] Decide direct server queries vs all-through-`/api` (see contract note)

**Decision needed:** the contract says the UI never reads Postgres, but server
components could query it directly. Pick one: server components call typed query
functions, and client components use `/api`; or every read goes through `/api`.

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

- [ ] Write `lib/contract.ts` with pure mapping functions and tests
- [ ] Decide whether UI story phases are curated separately or derived from
      `artifact_phase`
- [ ] Decide how UI `status` is derived (last phase + mission result)
- [ ] Align IDs or add a slug alias map

---

## Phase 4 — Artifact experience

The prototype covers the visual pieces on fixtures.

- [x] Artifact profile layout (`/item/[id]`)
- [x] Story-beat timeline component
- [x] Facts and specs panels
- [x] Comparison UI (client-side diff)
- [x] Archive grid and zone filters
- [ ] DB-backed profile: `v_artifact_card` + `v_artifact_timeline`
- [ ] Per-fact source links from the `fact` table
- [ ] Lineage UI from `v_artifact_edge`
- [ ] Server-side search (trigram); current filters are client-side
- [ ] Provenance panel for phases and media
- [ ] “Why it was abandoned” from `mission.abandonment_reason`
- [ ] `generateMetadata` for sharing and indexing

**Exit criterion:** facts, provenance, timeline and comparison are deterministic
reads from PostgreSQL; no generated text is used.

---

## Phase 5 — Live tracking

- [ ] Add `satellite.js` and a propagation wrapper with tests
- [ ] `/api/artifacts/[slug]/gp` — latest element set, short cache
- [ ] Map integration (MapLibre; the current solar map is illustrative)
- [ ] Element epoch and data-age labels
- [ ] Schedule the CelesTrak job and verify pruning
- [ ] Explicit “last known position” for non-Earth objects

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
- [ ] Add `lint`, `typecheck`, `test` scripts (Vitest, Playwright assumed)
- [ ] Backup and restore drill
- [ ] Accessibility, responsive and performance passes
- [ ] Deploy to Render with a paid database and cron
- [ ] Verify attribution and licences on every page
- [ ] Tag `v1.0`; attach the documentation PDF

---

## Cross-cutting gaps

- [x] CI workflow drafted at `docs/ci-workflow.yml`
- [ ] Enable CI after `gh auth refresh -s workflow` (workflow files need that scope)
- [x] `db/migrations/README.md` documents the forward-only convention
- [ ] No `app/api/` routes and no `lib/db.ts`
- [x] `npm run typecheck` added
- [ ] No frontend tests or lint script
- [x] `.env.example` documents `NEXT_PUBLIC_API_BASE`
- [x] `ATTRIBUTION.md` includes NASA mission pages
- [x] Technical docs point at `app/`, `components/` and `lib/`
- [x] Branding is Lost in Space; the museum name is gone from the UI
- [ ] The 30 unmatched lander rows and `UNK` launch tag are still open
- [ ] CelesTrak refresh is not exercised live
- [ ] Image proxy is not implemented; images are bundled in `public/`
- [ ] No narration provider or snapshot builder

---

## Next three actions

1. **Build the adapter and DB layer** — `lib/contract.ts`, `lib/db.ts`, typed
   queries, then `/api/items`, `/api/items/:id` and `/api/sources`.
2. **Switch one page at a time** — archive first, then home, item, sources;
   keep fixtures as the offline fallback.
3. **Expand curation** — Moon and deep space to 6–10 artifacts, then add
   `artifact_relation` edges.
