#import "@preview/cetz:0.3.4": canvas, draw
#import "report.typ": report, title-block, callout, small-table

#show: report.with(title: "Lost in Space — Visual Architecture")

#title-block(
  "Visual Architecture",
  "System structure, components, data models and deployment",
  "1.1",
  "15 November 2026",
)

#pagebreak()

= Scope

This report is the visual companion to the technical documentation. It shows the
system's structure rather than restating every decision: runtime topology,
component boundaries, database relationships, request flow and deployment.

The invariant still applies: *the database owns facts; the model only owns
wording*. Diagrams are descriptive. SQL views and queries remain the source of
truth for what the application displays.

= System context

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [System context. Only the Next.js server talks to PostgreSQL directly.],
  canvas({
    import draw: *
    set-style(stroke: 0.6pt, fill: rgb("#eef3f6"))
    let box(name, x1, y1, x2, y2, label) = {
      rect((x1, y1), (x2, y2), name: name, radius: 3pt)
      content(name, align(center, text(size: 8pt, fill: luma(30))[#label]))
    }

    box("browser", 0, 3.0, 2.8, 4.0, [Browser\ React + MapLibre])
    box("web", 3.8, 3.0, 7.0, 4.0, [Render web\ Next.js 15])
    box("db", 8.0, 3.0, 10.8, 4.0, [Neon PostgreSQL 16\ canonical + staging])
    box("nasa", 3.8, 0.8, 7.0, 1.8, [NASA / NSSDCA\ images and pages])
    box("tiles", 8.0, 0.8, 10.8, 1.8, [MapLibre\ demo tiles])
    box("actions", 0, 0.8, 2.8, 1.8, [GitHub Actions\ CI + CelesTrak])

    line("browser.east", "web.west", mark: (end: ">"))
    content((3.3, 3.62), text(size: 7pt)[HTTPS])
    line("web.east", "db.west", mark: (end: ">"))
    content((7.5, 3.62), text(size: 7pt)[SQL / HTTPS])
    line("web.south", "nasa.north", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
    content((5.4, 2.45), text(size: 7pt)[image proxy])
    line("actions.east", "db.west", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
    content((4.1, 1.15), text(size: 7pt)[ETL + GP upsert])
    line("browser.south-east", "tiles.north-west", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
    content((6.6, 2.05), text(size: 7pt)[map style])
  }),
)

= Runtime topology

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Request path and batch path meet in the same read models.],
  canvas({
    import draw: *
    set-style(stroke: 0.6pt, fill: rgb("#f1f5f9"))
    let box(name, x1, y1, x2, y2, label, fill: rgb("#f1f5f9")) = {
      rect((x1, y1), (x2, y2), name: name, radius: 3pt, fill: fill)
      content(name, align(center, text(size: 8pt)[#label]))
    }

    box("client", 0, 5.3, 2.6, 6.2, [Client components\ map · compare tray])
    box("server", 3.4, 5.3, 6.4, 6.2, [Server components\ pages + metadata])
    box("api", 7.2, 5.3, 10.0, 6.2, [API routes\ `/api/*`])
    box("queries", 3.4, 3.5, 10.0, 4.4, [Typed query layer\ `lib/queries/*`], fill: rgb("#dbeafe"))
    box("driver", 3.4, 2.0, 10.0, 2.9, [Database handle\ Neon HTTP · `pg` pool], fill: rgb("#dbeafe"))
    box("db", 3.4, 0.4, 6.4, 1.3, [Neon PostgreSQL\ tables + views], fill: rgb("#dcfce7"))
    box("batch", 7.2, 0.4, 10.0, 1.3, [GitHub Actions\ ETL + GP refresh], fill: rgb("#fef3c7"))
    box("media", 0, 3.5, 2.6, 4.4, [NASA assets\ `/api/image`])
    box("models", 0, 2.0, 2.6, 2.9, [Bundled GLB\ `public/models`])

    line("server.north", "client.south", mark: (end: ">"))
    line("client.east", "api.west", mark: (end: ">"))
    line("server.south", "queries.north", mark: (end: ">"))
    line("api.south", "queries.north", mark: (end: ">"))
    line("queries.south", "driver.north", mark: (end: ">"))
    line("driver.south", "db.north", mark: (end: ">"))
    line("batch.west", "db.east", mark: (end: ">"))
    line("media.east", "server.west", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
    line("models.east", "client.west", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
  }),
)

= Component map

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Component boundaries in the repository. Arrows show import direction, not call order.],
  canvas({
    import draw: *
    set-style(stroke: 0.6pt, fill: rgb("#f8fafc"))
    let box(name, x1, y1, x2, y2, label, fill: rgb("#f8fafc")) = {
      rect((x1, y1), (x2, y2), name: name, radius: 3pt, fill: fill)
      content(name, align(center, text(size: 7.5pt)[#label]))
    }

    box("app", 0, 3.6, 2.4, 4.5, [app/\ routes + API], fill: rgb("#dbeafe"))
    box("components", 3.1, 3.6, 5.8, 4.5, [components/\ cards · workspace · map], fill: rgb("#dbeafe"))
    box("lib", 6.5, 3.6, 9.2, 4.5, [lib/\ contract · compare · narration], fill: rgb("#e0e7ff"))
    box("queries", 9.9, 3.6, 12.4, 4.5, [lib/queries/\ typed reads], fill: rgb("#e0e7ff"))
    box("db", 9.9, 1.8, 12.4, 2.7, [lib/db.ts\ transport], fill: rgb("#dcfce7"))
    box("types", 3.1, 1.8, 5.8, 2.7, [lib/types.ts\ API shapes], fill: rgb("#fef9c3"))
    box("fixtures", 0, 1.8, 2.4, 2.7, [lib/fixtures.ts\ fallback], fill: rgb("#fef9c3"))
    box("etl", 6.5, 1.8, 9.2, 2.7, [etl/\ Python pipeline], fill: rgb("#fef3c7"))

    line("app.south", "types.north", mark: (end: ">"))
    line("components.south", "types.north", mark: (end: ">"))
    line("lib.south", "types.north", mark: (end: ">"))
    line("queries.south", "db.north", mark: (end: ">"))
    line("app.east", "queries.west", mark: (end: ">"))
    line("components.east", "lib.west", mark: (end: ">"))
    line("app.west", "fixtures.east", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
    line("etl.east", "db.west", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
  }),
)

= Database relationships

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Core data model. A catalog number belongs to a phase, never directly to an artifact.],
  canvas({
    import draw: *
    set-style(stroke: 0.6pt, fill: rgb("#f8fafc"))
    let box(name, x1, y1, x2, y2, label, fill: rgb("#f8fafc")) = {
      rect((x1, y1), (x2, y2), name: name, radius: 3pt, fill: fill)
      content(name, align(center, text(size: 7.5pt)[#label]))
    }

    box("artifact", 4.8, 5.2, 8.0, 6.1, [artifact\ slug · zone · mass], fill: rgb("#dbeafe"))
    box("phase", 4.8, 3.4, 8.0, 4.3, [artifact_phase\ phase_key · dates · status], fill: rgb("#e0e7ff"))
    box("catalog", 8.8, 3.4, 12.0, 4.3, [artifact_catalog_id\ SATCAT · COSPAR · JCAT], fill: rgb("#e0e7ff"))
    box("mission", 0.8, 3.4, 4.0, 4.3, [mission\ summary · abandonment], fill: rgb("#dcfce7"))
    box("fact", 0.8, 1.6, 4.0, 2.5, [fact\ type · text · source_url], fill: rgb("#dcfce7"))
    box("media", 4.8, 1.6, 8.0, 2.5, [media\ image · model · credit], fill: rgb("#dcfce7"))
    box("relation", 8.8, 1.6, 12.0, 2.5, [artifact_relation\ parent → child], fill: rgb("#fef3c7"))
    box("source", 0.8, 0.0, 4.0, 0.8, [source\ licence · citation], fill: rgb("#fef9c3"))
    box("gp", 8.8, 0.0, 12.0, 0.8, [gp_element\ OMM · epoch], fill: rgb("#fef9c3"))

    line("artifact.south", "phase.north")
    line("phase.east", "catalog.west")
    line("artifact.west", "mission.east")
    line("artifact.south-west", "fact.north-east")
    line("artifact.south", "media.north")
    line("artifact.east", "relation.west")
    line("fact.south", "source.north")
    line("media.south-east", "source.north-east", stroke: (paint: luma(110), dash: "dashed"))
    line("catalog.south", "gp.north", stroke: (paint: luma(110), dash: "dashed"))
  }),
)

#callout(title: "Identity rule")[
  `artifact_phase.phase_key` (`<jcat>:<n>`) is the stable row key. Deep-space
  catalogs reuse one JCAT across phases, so `artifact_catalog_id` is a
  many-to-one alias table, not a column on `artifact`.
]

= Item request sequence

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Reading one artifact. Server components query typed functions; client components keep fixtures and `/api` as the offline path.],
  canvas({
    import draw: *
    set-style(stroke: 0.6pt)
    let lane(x, label) = {
      line((x, 0.2), (x, 5.2), stroke: (paint: luma(150), dash: "dashed"))
      content((x, 5.5), text(size: 8pt)[#label])
    }
    lane(0.8, [Browser])
    lane(3.6, [Next server])
    lane(6.8, [Queries])
    lane(9.8, [Neon])

    let msg(y, x1, x2, label) = {
      line((x1, y), (x2, y), mark: (end: ">"))
      content(((x1 + x2) / 2, y + 0.28), text(size: 7pt)[#label])
    }
    msg(4.6, 0.8, 3.6, [GET /item/opportunity])
    msg(3.8, 3.6, 6.8, [getItemPageData])
    msg(3.0, 6.8, 9.8, [card + facts + phases + media])
    msg(2.2, 6.8, 9.8, [gp_element + story cache])
    msg(1.4, 3.6, 0.8, [HTML + metadata])
    msg(0.6, 0.8, 3.6, [/api/artifacts/:slug/gp])
  }),
)

= Deployment topology

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Current free deployment. The web service is stateless; Neon holds all durable state.],
  canvas({
    import draw: *
    set-style(stroke: 0.6pt, fill: rgb("#f8fafc"))
    let box(name, x1, y1, x2, y2, label, fill: rgb("#f8fafc")) = {
      rect((x1, y1), (x2, y2), name: name, radius: 3pt, fill: fill)
      content(name, align(center, text(size: 8pt)[#label]))
    }
    box("user", 0, 2.4, 2.4, 3.3, [Reader browser])
    box("render", 3.2, 2.4, 6.4, 3.3, [Render free web\ Next.js + API], fill: rgb("#dbeafe"))
    box("neon", 7.2, 2.4, 10.4, 3.3, [Neon\ PostgreSQL], fill: rgb("#dcfce7"))
    box("gha", 3.2, 0.6, 6.4, 1.5, [GitHub Actions\ CI + GP refresh], fill: rgb("#fef3c7"))
    box("nasa", 7.2, 0.6, 10.4, 1.5, [NASA / NSSDCA\ image assets], fill: rgb("#fef3c7"))
    line("user.east", "render.west", mark: (end: ">"))
    line("render.east", "neon.west", mark: (end: ">"))
    line("gha.east", "neon.south-west", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
    line("render.south", "nasa.north", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
  }),
)

#small-table(
  columns: (3.2cm, 1fr),
  table.header([*Limit*], [*Consequence*]),
  [Free web spins down after 15 min], [First request of a session can take about a minute to wake.],
  [750 free instance hours/month], [Enough for a demo, not for continuous production traffic.],
  [No free cron tier], [CelesTrak refresh runs in GitHub Actions, not on Render.],
  [Neon free tier], [The database is external; the free Render database was deliberately not used.],
)

= Curated collection

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Curated artifacts by zone after the v1.0 expansion.],
  canvas({
    import draw: *
    set-style(stroke: 0.5pt, fill: rgb("#dbeafe"))
    let data = (("Moon", 7), ("Mars", 7), ("Earth orbit", 6), ("Deep space", 6))
    for (i, (label, value)) in data.enumerate() {
      let x = i * 2.5
      rect((x, 0), (x + 1.6, value * 0.28), fill: rgb("#bfdbfe"))
      content((x + 0.8, value * 0.28 + 0.28), text(size: 8pt, weight: "bold")[#value])
      content((x + 0.8, -0.38), text(size: 8pt)[#label])
    }
    line((0, 0), (9.2, 0))
  }),
)

#small-table(
  columns: (3.2cm, 1fr),
  table.header([*Metric*], [*Value*]),
  [Curated artifacts], [26 — Moon 7, Mars 7, Earth orbit 6, deep space 6],
  [Sourced facts], [66, each with a `source_url`],
  [Media rows], [32 — 26 images, 6 models],
  [Relations], [2 `deployed_from` rover/LM pairs],
  [Live element sets], [2 GP rows (Hubble, Vanguard 1) refreshed by GitHub Actions],
  [Sources], [9 rows in `source`, each with a licence and citation],
)
