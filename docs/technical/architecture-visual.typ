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
  caption: [System context. The render web service talks to Neon over HTTPS; GitHub Actions writes through the same database.],
  canvas(length: 1cm, {
    import draw: *
    set-style(stroke: 0.6pt, fill: rgb("#eef3f6"))
    let box(name, x1, y1, x2, y2, label, fill: rgb("#eef3f6")) = {
      rect((x1, y1), (x2, y2), name: name, radius: 3pt, fill: fill)
      content(name, align(center, text(size: 8pt)[#label]))
    }

    box("browser", 0.0, 5.0, 3.2, 6.0, [Browser\ React + MapLibre])
    box("web", 4.4, 5.0, 8.0, 6.0, [Render web\ Next.js 15])
    box("db", 9.2, 5.0, 12.8, 6.0, [Neon PostgreSQL\ tables + views], fill: rgb("#dcfce7"))
    box("tiles", 0.0, 3.0, 3.2, 4.0, [MapLibre\ demo tiles], fill: rgb("#fef9c3"))
    box("nasa", 4.4, 3.0, 8.0, 4.0, [NASA / NSSDCA\ image assets], fill: rgb("#fef9c3"))
    box("actions", 9.2, 3.0, 12.8, 4.0, [GitHub Actions\ CI + GP refresh], fill: rgb("#fef3c7"))

    line("browser.east", "web.west", mark: (end: ">"))
    content((3.8, 5.22), text(size: 6pt)[HTTPS])
    line("web.east", "db.west", mark: (end: ">"))
    content((8.6, 5.22), text(size: 6pt)[SQL])
    line("tiles.north", "browser.south", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
    content((2.5, 4.45), text(size: 7pt)[style])
    line("nasa.north", "web.south", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
    content((7.0, 4.45), text(size: 7pt)[image proxy])
    line("actions.north", "db.south", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
    content((11.8, 4.45), text(size: 7pt)[ETL / GP])
  }),
)

= Runtime topology

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Request path and batch path meet in the same typed query layer and database handle.],
  canvas(length: 1cm, {
    import draw: *
    set-style(stroke: 0.6pt, fill: rgb("#f1f5f9"))
    let box(name, x1, y1, x2, y2, label, fill: rgb("#f1f5f9")) = {
      rect((x1, y1), (x2, y2), name: name, radius: 3pt, fill: fill)
      content(name, align(center, text(size: 8pt)[#label]))
    }

    box("client", 0.0, 6.2, 4.2, 7.2, [Client components\ maps · compare tray])
    box("server", 5.2, 6.2, 10.2, 7.2, [Server components\ pages + metadata])
    box("api", 11.2, 6.2, 16.0, 7.2, [API routes\ `/api/*`])
    box("queries", 4.2, 4.4, 11.2, 5.4, [Typed query layer\ `lib/queries/*`], fill: rgb("#dbeafe"))
    box("driver", 4.2, 2.6, 11.2, 3.6, [Database handle\ Neon HTTP · `pg` pool], fill: rgb("#dbeafe"))
    box("db", 2.0, 0.8, 6.4, 1.8, [Neon PostgreSQL\ tables + views], fill: rgb("#dcfce7"))
    box("batch", 7.4, 0.8, 10.8, 1.8, [GitHub Actions\ ETL + GP refresh], fill: rgb("#fef3c7"))

    line("server.west", "client.east", mark: (end: "<"))
    content((4.7, 7.0), text(size: 6.5pt)[HTML])
    line("client.south", "queries.north-west", mark: (end: ">"))
    line("server.south", "queries.north", mark: (end: ">"))
    line("api.south", "queries.north-east", mark: (end: ">"))
    line("queries.south", "driver.north", mark: (end: ">"))
    line("driver.south", "db.north", mark: (end: ">"))
    line("batch.west", "db.east", mark: (end: ">"))
    content((6.9, 1.2), text(size: 7pt)[SQL])
  }),
)

#pagebreak()

= Component map

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Repository boundaries. Arrows show import direction, not call order.],
  canvas(length: 1cm, {
    import draw: *
    set-style(stroke: 0.6pt, fill: rgb("#f8fafc"))
    let box(name, x1, y1, x2, y2, label, fill: rgb("#f8fafc")) = {
      rect((x1, y1), (x2, y2), name: name, radius: 3pt, fill: fill)
      content(name, align(center, text(size: 8pt)[#label]))
    }

    box("app", 0.0, 5.0, 4.2, 6.0, [app/\ routes + API], fill: rgb("#dbeafe"))
    box("components", 5.2, 5.0, 9.8, 6.0, [components/\ cards · workspace · map], fill: rgb("#dbeafe"))
    box("lib", 10.8, 5.0, 16.0, 6.0, [lib/\ contract · compare · narration], fill: rgb("#e0e7ff"))
    box("fixtures", 0.0, 3.0, 4.2, 4.0, [lib/fixtures.ts\ offline fallback], fill: rgb("#fef9c3"))
    box("types", 5.2, 3.0, 9.8, 4.0, [lib/types.ts\ API shapes], fill: rgb("#fef9c3"))
    box("queries", 10.8, 3.0, 16.0, 4.0, [lib/queries/\ typed reads], fill: rgb("#e0e7ff"))
    box("db", 10.8, 1.0, 16.0, 2.0, [lib/db.ts\ transport], fill: rgb("#dcfce7"))
    box("etl", 5.2, 1.0, 9.8, 2.0, [etl/\ Python pipeline], fill: rgb("#fef3c7"))

    line("app.south", "fixtures.north", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
    line("components.south", "types.north", mark: (end: ">"))
    line("lib.south", "queries.north", mark: (end: ">"))
    line("app.east", "components.west", mark: (end: ">"))
    line("components.east", "lib.west", mark: (end: ">"))
    line("app.south-east", "types.north-west", mark: (end: ">"))
    line("queries.south", "db.north", mark: (end: ">"))
    line("etl.east", "db.west", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
  }),
)

= Database relationships

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Core data model. A catalog number belongs to a phase, never directly to an artifact.],
  canvas(length: 1cm, {
    import draw: *
    set-style(stroke: 0.6pt, fill: rgb("#f8fafc"))
    let box(name, x1, y1, x2, y2, label, fill: rgb("#f8fafc")) = {
      rect((x1, y1), (x2, y2), name: name, radius: 3pt, fill: fill)
      content(name, align(center, text(size: 8pt)[#label]))
    }

    box("artifact", 4.5, 7.0, 11.5, 8.0, [artifact\ slug · zone · mass], fill: rgb("#dbeafe"))
    box("mission", 0.0, 5.0, 3.6, 6.0, [mission\ summary · abandonment], fill: rgb("#dcfce7"))
    box("phase", 4.2, 5.0, 7.8, 6.0, [artifact_phase\ phase_key · dates · status], fill: rgb("#e0e7ff"))
    box("catalog", 8.4, 5.0, 12.0, 6.0, [artifact_catalog_id\ SATCAT · COSPAR · JCAT], fill: rgb("#e0e7ff"))
    box("relation", 12.6, 5.0, 16.0, 6.0, [artifact_relation\ parent → child], fill: rgb("#fef3c7"))
    box("fact", 0.0, 3.0, 3.6, 4.0, [fact\ type · text · source_url], fill: rgb("#dcfce7"))
    box("media", 4.2, 3.0, 7.8, 4.0, [media\ image · model · credit], fill: rgb("#dcfce7"))
    box("gp", 8.4, 3.0, 12.0, 4.0, [gp_element\ OMM · epoch], fill: rgb("#fef9c3"))
    box("source", 0.0, 1.0, 3.6, 2.0, [source\ licence · citation], fill: rgb("#fef9c3"))

    line("artifact.south-west", "mission.north")
    line("artifact.south", "phase.north")
    line("artifact.south", "catalog.north")
    line("artifact.south-east", "relation.north")
    line("phase.east", "catalog.west")
    line("mission.south", "fact.north")
    line("phase.south", "media.north")
    line("catalog.south", "gp.north")
    line("fact.south", "source.north")
  }),
)

#callout(title: "Identity rule")[
  `artifact_phase.phase_key` (`<jcat>:<n>`) is the stable row key. Deep-space
  catalogs reuse one JCAT across phases, so `artifact_catalog_id` is a
  many-to-one alias table, not a column on `artifact`.
]

#pagebreak()

= Item request sequence

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Reading one artifact. Server components query typed functions; client components keep fixtures and `/api` as the offline path.],
  canvas(length: 1cm, {
    import draw: *
    set-style(stroke: 0.6pt)
    let lane(x, label) = {
      line((x, 0.2), (x, 6.4), stroke: (paint: luma(150), dash: "dashed"))
      content((x, 6.8), text(size: 8pt)[#label])
    }
    lane(0.8, [Browser])
    lane(5.2, [Next server])
    lane(10.2, [Queries])
    lane(15.2, [Neon])

    let msg(y, x1, x2, label) = {
      line((x1, y), (x2, y), mark: (end: ">"))
      content(((x1 + x2) / 2, y + 0.32), text(size: 7pt)[#label])
    }
    msg(5.6, 0.8, 5.2, [GET /item/:id])
    msg(4.5, 5.2, 10.2, [getItemPageData])
    msg(3.4, 10.2, 15.2, [cards + facts + phases])
    msg(2.3, 10.2, 15.2, [GP + story cache])
    msg(1.2, 5.2, 0.8, [HTML + metadata])
  }),
)

= Deployment topology

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Current free deployment. The web service is stateless; Neon holds all durable state.],
  canvas(length: 1cm, {
    import draw: *
    set-style(stroke: 0.6pt, fill: rgb("#f8fafc"))
    let box(name, x1, y1, x2, y2, label, fill: rgb("#f8fafc")) = {
      rect((x1, y1), (x2, y2), name: name, radius: 3pt, fill: fill)
      content(name, align(center, text(size: 8pt)[#label]))
    }

    box("user", 0.0, 4.0, 3.2, 5.0, [Reader\ browser])
    box("render", 4.4, 4.0, 8.0, 5.0, [Render free web\ Next.js + API], fill: rgb("#dbeafe"))
    box("neon", 9.2, 4.0, 12.8, 5.0, [Neon\ PostgreSQL], fill: rgb("#dcfce7"))
    box("nasa", 4.4, 2.0, 8.0, 3.0, [NASA / NSSDCA\ image assets], fill: rgb("#fef3c7"))
    box("gha", 9.2, 2.0, 12.8, 3.0, [GitHub Actions\ CI + GP refresh], fill: rgb("#fef3c7"))

    line("user.east", "render.west", mark: (end: ">"))
    content((3.8, 4.22), text(size: 6pt)[HTTPS])
    line("render.east", "neon.west", mark: (end: ">"))
    content((8.6, 4.22), text(size: 6pt)[SQL])
    line("gha.north", "neon.south", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
    content((11.2, 3.5), text(size: 6.5pt)[GP])
    line("nasa.north", "render.south", mark: (end: ">"), stroke: (paint: luma(110), dash: "dashed"))
    content((6.2, 3.5), text(size: 6.5pt)[images])
  }),
)

#small-table(
  columns: (4.0cm, 1fr),
  table.header([*Limit*], [*Consequence*]),
  [Free web spins down after 15 min], [First request of a session can take about a minute to wake.],
  [750 free instance hours/month], [Enough for a demo, not for continuous production traffic.],
  [No free cron tier], [CelesTrak refresh runs in GitHub Actions, not on Render.],
  [Neon free tier], [The database is external; the free Render database was deliberately not used.],
)

#pagebreak()

= Curated collection

#figure(
  kind: "figure",
  supplement: "Figure",
  caption: [Curated artifacts by zone after the v1.1 expansion.],
  canvas(length: 1cm, {
    import draw: *
    set-style(stroke: 0.5pt, fill: rgb("#dbeafe"))
    let data = (("Moon", 7), ("Mars", 7), ("Earth orbit", 6), ("Deep space", 6))
    for (i, (label, value)) in data.enumerate() {
      let x = i * 3.5
      rect((x, 0), (x + 2.2, value * 0.35), fill: rgb("#bfdbfe"))
      content((x + 1.1, value * 0.35 + 0.3), text(size: 8pt, weight: "bold")[#value])
      content((x + 1.1, -0.45), text(size: 8pt)[#label])
    }
    line((0, 0), (13.6, 0))
  }),
)

#small-table(
  columns: (3.6cm, 1fr),
  table.header([*Metric*], [*Value*]),
  [Curated artifacts], [26 — Moon 7, Mars 7, Earth orbit 6, deep space 6],
  [Sourced facts], [66, each with a `source_url`],
  [Media rows], [32 — 26 images, 6 models],
  [Relations], [2 `deployed_from` rover/LM pairs],
  [Live element sets], [2 GP rows (Hubble, Vanguard 1) refreshed by GitHub Actions],
  [Sources], [9 rows in `source`, each with a licence and citation],
)
