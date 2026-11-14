# Technical documentation

This directory contains the technical system documentation for **Lost in Space**,
written in [Typst](https://typst.app/) and adapted from the `swdocs` structure in
[sipho-mokoena/typst-scaffold](https://github.com/sipho-mokoena/typst-scaffold).

The compiled output is `main.pdf` (A4, Arial 11 pt, numbered headings, revision
history, table of contents, lists of figures and tables, IEEE bibliography).

## Build

```bash
typst compile main.typ         # writes main.pdf
typst watch main.typ           # rebuild on change
```

Requires Typst 0.13 or newer. Typst 0.15.1 is what the document was validated
with. Cetz is pulled from the Typst package registry on first compile
(`@preview/cetz:0.3.4`), so the first build needs network access; later builds use
the local package cache.

## Layout

| Path | Purpose |
|---|---|
| `main.typ` | Page setup, title page, revision history, TOC, list of figures and tables, section includes, bibliography |
| `pages/01_introduction.typ` | Purpose, scope, statuses, constraints, conventions, system summary, non-goals |
| `pages/02_architecture.typ` | Runtime topology, layers, request/batch/live paths, facts-vs-narration invariant, environments |
| `pages/03_core_platform.typ` | ADR-001 to ADR-010: PostgreSQL, Next.js, TypeScript, React/Tailwind, `pg`, migrations, graph, search, cache, auth |
| `pages/04_data_pipeline.typ` | ADR-011 to ADR-020: Python ETL, staging, VagueDate, identity resolution, OMM, SGP4, imagery, maps, narration, cron |
| `pages/05_delivery_operations.typ` | ADR-021 to ADR-028: Render, Docker, CI, testing, observability, Typst toolchain, licensing, backups, security |
| `pages/06_data_sources.typ` | Source-by-source contract, licences, exclusions, attribution, refresh policy |
| `pages/07_data_models.typ` | Identity layers, phases, catalog identifiers, VagueDate, zones, provenance, graph read model, read views |
| `pages/08_configuration_deployment.typ` | Environment variables, Render blueprint, Docker, self-hosting, migrations, scaling, failure modes |
| `pages/09_development_guide.typ` | Repository layout, setup, commands, conventions, adding sources, curation, testing |
| `pages/10_risks_roadmap.typ` | Risk register, assumptions, open decisions, roadmap, success criteria |
| `references.bib` | BibTeX entries rendered with the built-in IEEE style |

## Conventions

- One top-level section per file in `pages/`, included in numeric order from
  `main.typ`.
- Headings use `=`, `==`, `===`; numbering is automatic.
- Tables are figures of kind `table` with a caption, so they appear in the List
  of Tables.
- Diagrams are Cetz canvases inside the page. There is no PlantUML, Mermaid or
  Graphviz step.
- External claims carry a citation key that exists in `references.bib`.
- Use `table.header([A], [B], [C])` for the Typst 0.15 function-call form. The
  older bare-content form used by the upstream scaffold does not compile here.
- Typst bold is `*text*`, not `**text**`.
- Escape a literal `#` in prose with backticks or `\#`.
- Keep decision IDs stable. A new decision gets the next `ADR-NNN`; a superseded
  one stays in the document with a note.

## Adding a decision

1. Pick the next `ADR-NNN`.
2. Use the record structure from section 1.5: status, decision, context, how it
   is used, alternatives, consequences.
3. Add a row to the relevant decision register table.
4. Add any new citation to `references.bib`.
5. Compile and check the List of Tables.

## Regenerating the PDF

The PDF is a build artefact. Rebuild it before a release and attach it to the
release; do not hand-edit it.

```bash
typst compile main.typ main.pdf
```
