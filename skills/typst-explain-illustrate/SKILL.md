---
name: typst-explain-illustrate
description: Turn a concept into a readable Typst explainer with CeTZ diagrams — plan the takeaways, choose the right figure type, write the prose, render, inspect, and iterate. Use when asked to explain, illustrate, visualize, or write up an idea, technical note, or teaching document, especially when the result should be a typeset PDF with real diagrams rather than Markdown.
---

# Explain and illustrate

The deliverable is a Typst document whose figures carry as much of the
explanation as the prose. A wall of text with one decorative diagram is a
failure; three clean figures with tight captions is the target.

Companion skills: `cetz-diagrams` for drawing, `typst-documents` for layout and
syntax. Read both before writing the document.

## Workflow

1. **Fix the takeaways first.** Write 3–6 statements the reader must leave with.
   They become the section list and the closing bullets. If you cannot state a
   takeaway, the section is not worth writing.
2. **Choose the medium for each takeaway.** Structural/spatial → CeTZ diagram.
   Numerical → table or `cetz-plot`. Sequential → timeline or flow. Everything
   else → prose or a worked example.
3. **Create the document** at `<dir>/main.typ` (default `explain/<slug>/main.typ`
   unless the user names a location). Start from the skeleton below.
4. **Write prose around the figures**, not the other way round. Introduce the
   figure, state what to look for, then draw the conclusion.
5. **Render and look.** After each figure or section: `typst_compile` with
   `preview: "first"` and inspect the PNG. Fix overlaps and layout before
   moving on.
6. **Cross-check.** Every figure is referenced from prose; every acronym is
   expanded at first use; every number comes from a real run, log, or cited
   source; the TL;DR matches the conclusion.
7. **Hand over.** Export the PDF with `typst_compile`, then `typst_preview` and
   report the URL so the user can read it live.

## Skeleton

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#set page(paper: "us-letter", margin: 2.1cm, numbering: "1")
#set par(justify: true, leading: 0.72em)
#show heading: it => block(above: 1.1em, below: 0.5em,
  text(weight: "bold", fill: rgb("#2563eb"), it))

#align(center)[
  #text(17pt, weight: "bold")[<Title>]
  #v(0.2em)
  #text(10pt, fill: rgb("#71717a"))[<Author> · <Date> · reading time]
]

#block(fill: rgb("#f4f4f5"), inset: (x: 12pt, y: 10pt), radius: 4pt, width: 100%)[
  *TL;DR.* <The conclusion, in two sentences, including the mechanism.>
]

= <First idea>

<Prose with `inline math`, then a figure.>

#figure(canvas(length: 1cm, { ... }), caption: [<What the figure shows>, so the reader can skip the prose.]) <fig:first>

@fig:first shows <the one thing to notice>.

= <Second idea>
...

= Takeaways
- <Takeaway 1>
- <Takeaway 2>
```

## Figure selection

| The idea is about… | Draw | Library |
| --- | --- | --- |
| Components and their connections | Boxes + arrows, labels on the boxes | core `rect`, `line`, `content` |
| A computation order | Vertical or horizontal spine with stages | core |
| Where something flows or bypasses | Named elements plus `bezier`/`line` between anchors | core |
| Phases and groupings | `decorations.brace` under a run of stages | `decorations` |
| A matrix or grid of values | Loops over cells, fill encodes the value | core |
| A hierarchy or taxonomy | Automatic tree layout | `tree` |
| Geometry, angles, vectors | Circles/arcs/polygons with angle marks | core + `angle` |
| A 3D scene | Orthographic projection with labeled axes | `ortho` + `on-*` |
| Numerical trends | Data plot or a matplotlib PNG | `cetz-plot` / external image |
| A before/after or comparison | Two panels side by side with a divider | core + `grid` layout |

## Quality bar

- One idea per figure; if a figure needs a paragraph to decode, split it.
- Captions state the takeaway (`Darker cells carry more weight`), not the
  mechanics (`A heatmap of weights`).
- Labels in figures use the same words as the prose.
- Two colors are enough; check that the figure still reads if printed in
  grayscale (vary lightness, not only hue).
- Keep a consistent visual grammar: same box style per role, same arrow style
  per relation, same color per concept across the whole document.
- Numbers in tables state units and the baseline; never invent measurements.

## Voice

Match the user's existing writing. For ML research explainers that usually
means: mechanism-forward, first-person plural, concrete claim in the first
sentence, honest treatment of limitations with the same prominence as the
positive result, and no marketing adjectives. If the user has prior documents in
the project, skim one and mirror it.

## Anti-patterns

- A figure that only restates the heading.
- Decorative complexity (shadows, gradients, four colors) in a technical figure.
- Unlabeled axes, nodes, or edges.
- Text that runs into a box border or another label; the render step exists to
  catch this.
- An explainer without a runnable example or a concrete number.
- Claiming completion without a clean compile and a looked-at render.

## Hand-off

Report: document path, PDF path, page count, and the preview URL. If anything is
approximate or unverified, say so explicitly instead of letting the figure imply
certainty.
