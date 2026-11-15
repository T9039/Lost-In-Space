#import "@preview/cetz:0.3.4": canvas, draw
#import "report.typ": report, title-block, callout, small-table

#show: report.with(title: "Lost in Space — Testing")

#title-block(
  "Testing Mechanisms",
  "What we test, how we test it, what failed, and why",
  "1.1",
  "15 November 2026",
)

#pagebreak()

= Testing philosophy

The archive has one non-negotiable rule: facts come from the database, not from a
model. The test suite is built around that rule.

- Mapping from rows to UI is pure and unit-tested.
- API and page reads are tested against the real PostgreSQL database, not a mock.
- The browser flow is tested on a production build, with and without a database.
- Comparisons, quizzes and facts never read `story`.
- CI must fail before a broken artifact or a flaky build reaches `main`.

= Test pyramid

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [The layers that run locally and in CI. The database layer is real PostgreSQL, not a mock.],
  canvas({
    import draw: *
    set-style(stroke: 0.6pt, fill: rgb("#dbeafe"))
    rect((2.6, 4.4), (8.4, 5.2), radius: 3pt, fill: rgb("#dbeafe"))
    content((5.5, 4.8), text(size: 8pt)[System · production server · 19 checks])
    rect((1.8, 3.2), (9.2, 4.0), radius: 3pt, fill: rgb("#e0e7ff"))
    content((5.5, 3.6), text(size: 8pt)[End-to-end · Playwright · 25 tests])
    rect((1.0, 2.0), (10.0, 2.8), radius: 3pt, fill: rgb("#fef3c7"))
    content((5.5, 2.4), text(size: 8pt)[Component · React server render · 3 tests])
    rect((0.2, 0.8), (10.8, 1.6), radius: 3pt, fill: rgb("#dcfce7"))
    content((5.5, 1.2), text(size: 8pt)[Unit + real-DB integration · node:test + tsx · 39 tests])
    rect((0.2, -0.4), (10.8, 0.4), radius: 3pt, fill: rgb("#f8fafc"))
    content((5.5, 0.0), text(size: 8pt)[ETL · pytest · 28 tests])
  }),
)

= Inventory

#small-table(
  columns: (3.0cm, 2.0cm, 1fr),
  table.header([*Layer*], [*Count*], [*Tool / location*]),
  [Unit + DB integration], [39], [`node:test` + `tsx`; `lib/**/*.test.ts`, `lib/queries/queries.test.ts`],
  [Component], [3], [`react-dom/server`; `components/__tests__/`],
  [End-to-end], [25], [Playwright + Chromium; `e2e/`],
  [System], [19], [`scripts/system-test.mjs`, starts `next start`],
  [ETL], [28], [`pytest etl/tests`],
  [CI jobs], [5], [app, E2E, ETL, database schema/staging, Typst docs],
)

= Mechanisms

#small-table(
  columns: (3.0cm, 1fr, 1fr),
  table.header([*Mechanism*], [*What it proves*], [*Where*]),
  [Pure mapping tests], [Zone/status/phase/slug mapping, model rows, no `story` leakage], [`lib/contract.test.ts`],
  [Compare tests], [Deterministic spec rows, counts and highlights], [`lib/compare.test.ts`],
  [Real PostgreSQL tests], [Archive reads, aliases, trigram search, zones, sources, lineage], [`lib/queries/queries.test.ts`],
  [Component tests], [Cards and workspace render abandonment, position, lineage, provenance, narration], [`components/__tests__/`],
  [Browser E2E], [Home, archive search, item, compare, sources, orbit map], [`e2e/*.spec.ts`],
  [Axe scans], [No serious/critical accessibility violations on five pages], [`e2e/accessibility.spec.ts`],
  [Responsive checks], [No horizontal overflow at 390×844 and 820×1180], [`e2e/responsive.spec.ts`],
  [System checks], [Production server, pages, API status codes, alias resolution, GP endpoint], [`scripts/system-test.mjs`],
  [ETL tests], [VagueDate, parsing, CelesTrak batch, prune allowlist], [`etl/tests/`],
)

= Failures and resolutions

The table records failures that changed the system, not every red test during
development. Each row names the regression guard that now protects the fix.

#small-table(
  columns: (2.4cm, 3.8cm, 4.5cm, 1fr),
  table.header([*Failure*], [*Symptom*], [*Root cause*], [*Resolution and guard*]),
  [Neon TCP/5432], [`psql` and ETL time out on IPv4; IPv6 unreachable], [Local network blocks outbound 5432], [HTTPS driver for `*.neon.tech`; SSH tunnel for ETL; `npm run db:check`],
  [CelesTrak batch], [`CATNR=1,2,3` returns “not an integer”], [gp.php accepts one catalog number per request], [Fetch each object; 404/no-data skipped; `test_celestrak.py`],
  [OMM JSONB], [`cannot adapt type 'dict'`], [psycopg needs an explicit JSON wrapper], [`Jsonb(record)` in `upsert`],
  [Tunnel auth], [`channel binding required`; `Endpoint ID is not specified`], [Localhost loses Neon SNI and channel binding], [`db-tunnel.sh` strips `channel_binding` and adds `options=endpoint=...`],
  [Font build], [`Cannot read properties of null` in `next/font`], [Google Fonts response flaked in CI], [Self-hosted WOFF2 + `next/font/local`],
  [E2E assumptions], [Hubble item and source labels missing in CI], [Tests assumed DB-only data; CI uses fixtures], [Data-source-agnostic E2E; offline run with `DATABASE_URL=""`],
  [Accessibility], [`label-content-name-mismatch` on archive cards], [Visible text not in the link’s accessible name], [Removed redundant `aria-label`; axe spec],
  [Responsive], [31–461 px horizontal overflow], [Nav did not wrap; scaled hero overflowed], [Nav breakpoint at 900 px; hero clipping; 12 viewport tests],
  [Curation counts], [Zone test expected 12], [Dataset grew to 26], [Assert 7/7/6/6 and total ≥ 20],
  [GP expectation], [System test expected 404], [Live refresh now writes GP rows], [Accept 200 or 404 and validate shape],
  [Render billing], [Blueprint required payment], [Cron has no free tier], [CelesTrak moved to GitHub Actions; blueprint is free web only],
)

= Coverage by component

#small-table(
  columns: (3.2cm, 1fr),
  table.header([*Component*], [*Coverage*]),
  [`lib/contract.ts`], [Mapping, status, phases, aliases, type table, model rows, zone summaries],
  [`lib/compare.ts`], [Deterministic output; no `story` key],
  [`lib/narration.ts`], [Snapshot canonicalisation, hash stability, prompt content, Ollama/OpenAI adapters],
  [`lib/orbit.ts`], [Real ISS OMM propagation, determinism, malformed input],
  [`lib/queries/`], [Real database reads and search],
  [`components/`], [Item card, workspace sections, GP epoch/age, AI label],
  [`app/api/`], [Status codes and shapes through system tests],
  [`etl/`], [Parsing, dates, CelesTrak fetch and prune],
)

= Commands

```bash
npm run lint
npm run typecheck
npm test                 # unit + component + real DB integration
npm run build
npm run test:system      # production server, 19 checks
npm run test:e2e         # Playwright, 25 tests
npm run test:all         # tests, build, system
.venv/bin/python -m pytest etl/tests -q
```

#callout(title: "CI")[
  GitHub Actions runs five jobs on every push and pull request: app build/tests,
  E2E, ETL, database schema/staging, and Typst documentation. A separate
  `celestrak.yml` workflow refreshes GP element sets every two hours.
]

= Residual gaps

- No visual-regression or screenshot comparison.
- No load, soak or concurrency test.
- Database integration tests skip when `DATABASE_URL` is unset.
- Browser E2E runs Chromium only; no Firefox or WebKit.
- No component test for the MapLibre map itself; its record list and page shell are covered.
- The system test starts a production build but does not exercise a cold Render spin-up.
