// Shared style for the testing, performance and visual-architecture reports.

#let report(body, title: "") = {
  set page(
    paper: "a4",
    margin: (top: 2.2cm, bottom: 2.2cm, left: 2.2cm, right: 2.2cm),
    header: context {
      if counter(page).get().first() > 1 {
        text(size: 8pt, fill: luma(120), align(right)[#title])
        line(length: 100%)
      }
    },
    footer: context {
      if counter(page).get().first() > 1 {
        align(center, text(size: 8pt, fill: luma(120))[Page #counter(page).display()])
      }
    },
    numbering: "1",
  )
  set text(font: ("Arial", "Liberation Sans"), size: 10.5pt)
  set par(leading: 0.55em, justify: true)
  set heading(numbering: "1.1")
  set raw(tab-size: 2)
  show table: set text(size: 9pt)
  show table: set par(justify: false)
  body
}

#let title-block(title, subtitle, version, date) = align(center)[
  #block(height: 1.6cm)
  #text(size: 22pt, weight: "bold")[Lost in Space]
  #block(height: 0.25cm)
  #text(size: 11pt, fill: luma(80))[An open archive of abandoned space hardware]
  #block(height: 1.0cm)
  #text(size: 16pt)[#title]
  #block(height: 0.25cm)
  #text(size: 11pt, fill: luma(90))[#subtitle]
  #block(height: 0.9cm)
  #text(size: 10pt)[Version #version · #date]
  #block(height: 0.4cm)
  #line(length: 40%)
]

#let callout(title: none, body) = block(
  width: 100%,
  inset: 10pt,
  radius: 4pt,
  stroke: 0.5pt + rgb("#cbd5e1"),
  fill: rgb("#f8fafc"),
)[
  #if title != none {
    text(weight: "bold", size: 10pt)[#title]
    linebreak()
  }
  #body
]

#let small-table(columns: auto, ..cells) = table(
  columns: columns,
  inset: 6pt,
  stroke: 0.5pt,
  align: left,
  ..cells,
)
