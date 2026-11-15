#import "@preview/cetz:0.3.4": canvas, draw
#import "report.typ": report, title-block, callout, small-table

#show: report.with(title: "Lost in Space — Performance")

#title-block(
  "Performance and Responsiveness",
  "How it was measured, what the numbers mean, and what still fails",
  "1.1",
  "15 November 2026",
)

#pagebreak()

= Scope and method

The measurements below are a baseline, not a production capacity study. They
were taken on a local production build (`npm run build` and `npm start`) with
Chromium headless and Lighthouse’s default mobile emulation and throttling.

#small-table(
  columns: (3.2cm, 1fr),
  table.header([*Variable*], [*Value*]),
  [Page measured], [`/archive` — the DB-backed grid with 26 artifacts],
  [Build], [Next.js 15.5 production build, not `next dev`],
  [Browser], [Chromium headless via Lighthouse],
  [Network profile], [Lighthouse default mobile throttling],
  [Database], [Neon PostgreSQL in São Paulo, via HTTPS from the desktop],
  [Caching], [Measured cold and warm after `unstable_cache` was added],
  [Not measured], [Render cold start, home 3D canvas, long-run load, real mobile devices],
)

= Current results

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Lighthouse category scores on the archive page. Accessibility, best practices and SEO are already at 100.],
  canvas({
    import draw: *
    set-style(stroke: 0.5pt)
    let data = (("Performance cold", 0.75, rgb("#fbbf24")), ("Performance warm", 1.00, rgb("#4ade80")), ("Accessibility", 1.00, rgb("#4ade80")), ("Best practices", 1.00, rgb("#4ade80")), ("SEO", 1.00, rgb("#4ade80")))
    for (i, (label, value, color)) in data.enumerate() {
      let x = i * 2.1
      rect((x, 0), (x + 1.35, value * 4.0), fill: color, stroke: 0.4pt)
      content((x + 0.675, value * 4.0 + 0.3), text(size: 8pt, weight: "bold")[#calc.round(value * 100)])
      content((x + 0.675, -0.55), text(size: 7pt)[#label])
    }
    line((0, 0), (10.4, 0))
  }),
)

#small-table(
  columns: (3.4cm, 3.2cm, 3.2cm, 1fr),
  table.header([*Metric*], [*Before caching*], [*Cold after caching*], [*Warm*]),
  [Performance score], [72], [75], [100],
  [Server response], [1.52 s], [20 ms], [20 ms],
  [LCP], [not captured], [9.2 s], [1.2 s],
  [Accessibility], [100], [100], [100],
  [Best practices], [100], [100], [100],
  [SEO], [100], [100], [100],
)

#callout(title: "Reading the numbers")[
  Caching curated reads removed the database round-trip from the server response:
  1.52 s became 20 ms. The remaining cold weakness is the archive’s images, not
  the query. The second Lighthouse run loads the same proxied images from cache
  and reaches performance 100 with LCP 1.2 s.
]

= What was compared

- *Before caching:* every archive request queried Neon over HTTPS.
- *After caching:* `unstable_cache` wraps archive, home, sources and compare reads
  for one hour.
- *Cold vs warm:* a cold run uses an empty browser/CDN cache; a warm run reuses
  the same running server and image cache.
- *Data-source fallback:* E2E runs both with PostgreSQL and with `DATABASE_URL=""`
  so the fixture path cannot hide a regression.

= Responsiveness

#small-table(
  columns: (2.6cm, 2.6cm, 2.6cm, 1fr),
  table.header([*Viewport*], [*Size*], [*Result*], [*What is checked*]),
  [Mobile], [390 × 844], [12/12 pass], [No horizontal overflow; main content and H1 visible],
  [Tablet], [820 × 1180], [12/12 pass], [No horizontal overflow; main content and H1 visible],
)

Pages covered at both sizes: home, archive, Earth-orbit MapLibre view, item,
compare and sources.

Two real defects were found and fixed:

- The navigation did not wrap until 760 px, leaving a 31 px overflow at 820 px.
  The breakpoint moved to 900 px and the links became horizontally scrollable.
- The scaled home hero extended beyond the viewport by 7 px. The hero now clips
  its decorative media.

= Where it still fails

#small-table(
  columns: (3.4cm, 1fr),
  table.header([*Failure*], [*Why it matters*]),
  [Cold archive LCP 9.2 s], [The first visitor waits for 26 remote images through the image proxy. Performance scores 75 cold.],
  [Render free spin-down], [After 15 idle minutes the first request takes about a minute to wake. This is not in the Lighthouse number.],
  [Remote image latency], [`/api/image` fetches NASA assets server-side; the first uncached request pays the upstream latency.],
  [No image optimisation], [Raw `<img>` elements serve the original JPEG/GIF sizes; no AVIF/WebP or responsive `srcset`.],
  [Home 3D not audited], [The Three.js solar map is the heaviest client route and was not part of this Lighthouse run.],
  [No performance budget in CI], [Lighthouse is a manual baseline; CI will not fail if LCP or bundle size regresses.],
)

= Improvements, ranked

1. *Optimise the archive images.* Move the curated set to local, pre-sized
   AVIF/WebP assets or use `next/image` with explicit sizes. Preload only the
   first visible row and lazy-load the rest. This targets the 9.2 s cold LCP.
2. *Cache the image proxy at the edge.* Keep the long-lived upstream fetch cache
   and add a CDN/edge cache keyed by the source URL so repeated first visits do
   not refetch NASA.
3. *Measure the home route.* Run Lighthouse and Web Vitals on `/`, including the
   3D canvas, and set a route-specific budget.
4. *Add Lighthouse CI budgets.* Fail a pull request when performance drops below
   an agreed threshold or LCP exceeds 2.5 s on the archive.
5. *Reduce cold-start impact.* A paid Render instance removes spin-down; a paid
   database in the same region removes cross-region latency.
6. *Instrument real users.* Add Web Vitals reporting so the mobile numbers come
   from real devices, not only synthetic Lighthouse.
7. *Keep the query cache warm.* The one-hour cache already makes repeat requests
   fast; a scheduled warm request can keep the first visitor of the hour fast too.

= Budget proposal

#small-table(
  columns: (4.0cm, 2.4cm, 1fr),
  table.header([*Metric*], [*Budget*], [*Current*]),
  [Archive performance], [≥ 90 warm], [100 warm / 75 cold],
  [Archive LCP], [≤ 2.5 s], [1.2 s warm / 9.2 s cold],
  [Server response], [≤ 200 ms warm], [20 ms warm],
  [Accessibility], [100], [100],
  [Horizontal overflow], [0 px], [0 px on the six tested pages],
)

#callout(title: "Status")[
  The archive is fast once its cache and images are warm. The honest gap is the
  cold first visit, dominated by remote images, and the free Render spin-down.
  Both have clear fixes; neither is a query-layer problem.
]
