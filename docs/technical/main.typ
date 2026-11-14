// ============================================================================
// Lost in Space — Technical System Documentation
// Typst source, adapted from the sipho-mokoena/typst-scaffold `swdocs` template.
// ============================================================================

#set page(
  paper: "a4",
  margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm),
  header: context {
    if counter(page).get().first() > 1 {
      text(size: 8pt, fill: luma(120), align(right)[
        Lost in Space — Technical System Documentation
      ])
      line(length: 100%)
    }
  },
  footer: context {
    if counter(page).get().first() > 1 {
      align(center, text(size: 8pt, fill: luma(120))[
        Page #counter(page).display()
      ])
    }
  },
  numbering: "i",
)

#set text(font: ("Arial", "Liberation Sans"), size: 11pt)
#set par(leading: 0.6em, justify: true)
#set heading(numbering: "1.1")
#set raw(tab-size: 2)

// Tables use a slightly smaller size than body text so that identifiers and
// column headings fit their cells. Cells are not justified: narrow columns
// otherwise stretch words apart into unreadable gaps.
#show table: set text(size: 9.5pt)
#show table: set par(justify: false)

// ============================================================================
// TITLE PAGE
// ============================================================================

#align(center)[
  #block(height: 2cm)

  #text(size: 24pt, weight: "bold")[Lost in Space]

  #block(height: 0.3cm)

  #text(size: 12pt, fill: luma(80))[
    An open archive of the hardware humans left behind
  ]

  #block(height: 0.8cm)

  #text(size: 17pt)[Technical System Documentation]

  #block(height: 1.2cm)

  #text(size: 12pt)[
    Version 1.0 \
    Prepared by T9039 \
    14 November 2026
  ]

  #block(height: 2cm)

  #line(length: 40%)
  #block(height: 0.3cm)
  #text(size: 9pt, fill: luma(100))[
    Open source — MIT for code, CC-BY-4.0 for project data
  ]
]

#pagebreak()

// ============================================================================
// REVISION HISTORY
// ============================================================================

#heading(level: 1, outlined: false, numbering: none)[Revision History]

#figure(
  kind: "table",
  supplement: "Table",
  caption: [Document revision history],
  table(
    columns: (1fr, 2.5cm, 3cm),
    inset: 8pt,
    stroke: 0.5pt,
    align: (left, center, left),
    table.header([*Reason for Changes*], [*Version*], [*Date*]),
    [Initial technical documentation: stack, decisions, alternatives, data model, deployment],
    [1.0],
    [14 November 2026],
  ),
)

#pagebreak()

// ============================================================================
// TABLE OF CONTENTS
// ============================================================================

#heading(level: 1, outlined: false, numbering: none)[Table of Contents]

#outline(title: none, indent: auto, depth: 3)

#pagebreak()

#heading(level: 1, outlined: false, numbering: none)[List of Figures]

#outline(title: none, indent: auto, target: figure.where(kind: "figure"))

#pagebreak()

#heading(level: 1, outlined: false, numbering: none)[List of Tables]

#outline(title: none, indent: auto, target: figure.where(kind: "table"))

#pagebreak()

// ============================================================================
// MODULE SECTIONS
// ============================================================================

#counter(page).update(1)
#set page(numbering: "1")

#include "pages/01_introduction.typ"
#pagebreak()
#include "pages/02_architecture.typ"
#pagebreak()
#include "pages/03_core_platform.typ"
#pagebreak()
#include "pages/04_data_pipeline.typ"
#pagebreak()
#include "pages/05_delivery_operations.typ"
#pagebreak()
#include "pages/06_data_sources.typ"
#pagebreak()
#include "pages/07_data_models.typ"
#pagebreak()
#include "pages/08_configuration_deployment.typ"
#pagebreak()
#include "pages/09_development_guide.typ"
#pagebreak()
#include "pages/10_risks_roadmap.typ"

// ============================================================================
// REFERENCES
// ============================================================================

#pagebreak()
#show bibliography: set text(size: 10pt)
#show bibliography: set par(leading: 0.45em)
#bibliography("references.bib", style: "ieee", title: [References])
