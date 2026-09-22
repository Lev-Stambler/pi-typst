---
name: cetz-diagrams
description: Draw diagrams in Typst with CeTZ 0.5.2 — canvas setup, coordinates and anchors, shapes, styling, groups, layers, intersections, trees, braces, and 3D projections — plus a render-and-inspect loop. Use when a concept needs a figure, schematic, flowchart, annotated diagram, matrix visualization, or 3D sketch inside a Typst document.
---

# CeTZ diagrams

CeTZ is the TikZ-like drawing package for Typst. It is a *coordinate* library:
you place every element explicitly, which is exactly why it is good for
explainers (the figure looks the way you intended) and why it needs a visual
check after each edit.

Full API details: [references/cetz-api.md](references/cetz-api.md).
Runnable diagrams: the `examples/` directory of this package
(`transformer-block.typ`, `attention-matrix.typ`, `pipeline-flow.typ`,
`tree-diagram.typ`, `three-d-vectors.typ`).

## Setup

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#figure(
  canvas(length: 1cm, {
    import draw: *
    set-style(stroke: (paint: rgb("#18181b"), thickness: 0.7pt), fill: none)

    rect((0, 0), (2, 1), radius: 2pt, fill: rgb("#dbeafe"))
    content((1, 0.5), [block], anchor: "center")
    line((1, 1), (1, 1.6), mark: (end: ">"))
  }),
  caption: [One block and an arrow.],
) <fig:block>
```

Always pin `@preview/cetz:0.5.2`. The first compile downloads the package into
the Typst package cache (network required once). For data plots use
`#import "@preview/cetz-plot:0.1.3": plot` — plotting was split out of CeTZ in
0.4.

## The loop: draw, render, look, fix

CeTZ fails quietly in ways only pixels reveal (overlapping labels, curves
through boxes, boxes wider than their text). Work in this order:

1. Write or edit the figure, then call `typst_compile` with `format: "pdf"`
   (deliverable) or `"png"` (quick check). Keep `preview: "first"` so the tool
   returns a rendered PNG you can actually look at.
2. Inspect the returned image. Check: every label inside its box; no line
   crossing a filled shape; nothing cropped at the canvas edge; text not
   overlapping other text; arrows pointing at the intended side.
3. Fix the coordinates and recompile. Two or three passes is normal.
4. When the figure is stable, run `typst_preview` so the user can read the whole
   document live in a browser.

Never claim a diagram is done without looking at the rendered page.

## Coordinates and anchors

- `(1.5, 2)` is x, y in canvas units; `(x: 1, y: 2)` names components.
- `(rel: (0.5, 0))` is relative to the previous position; `()` repeats it.
- `(angle: 45deg, radius: 1.5)` is polar.
- `"name"` uses an element's default anchor; `"name.north-east"` a named one;
  `(name: "line", anchor: 50%)` or `(name: "circle", anchor: 30deg)` for path
  and border anchors; `("a", 50%, "b")` interpolates between two coordinates.
- `move-to(...)` and `set-origin(...)` move the current position and origin.
- `line("box-a", "box-b")` already shortens to the borders.

## Cheat sheet

```typst
line((0,0), (2,0), stroke: blue, mark: (end: ">"))
line((0,0), (1,1), (2,0), close: true)                  // polygon outline
rect((0,0), (rel: (1.5, 0.8)), radius: 3pt, fill: rgb("#dbeafe"))
circle((2,1), radius: 0.3)                              // or radius: (0.4, 0.2)
arc((0,0), start: 30deg, delta: 120deg, mode: "PIE")
grid((0,0), (2,2), step: 0.5, stroke: gray.lighten(40%))
content((1,0.5), [label], anchor: "center")
content((0,0), (2,2), box(width: 100%, [text box]))      // two coords = rectangle
bezier((0,0), (1,1), (0.4,-0.2), (1.4,0.6))              // start, end, ctrl1, ctrl2
polygon((0,0), 6, angle: 30deg, radius: 1)
n-star((0,0), 5, inner-radius: 45%, show-inner: true)
```

## Styling

Pass style keys per call, or set them for everything after with `set-style`.
Specificity is function > element type > global; dictionaries merge.

```typst
set-style(
  stroke: (paint: rgb("#18181b"), thickness: 0.7pt, dash: "dashed"),
  fill: rgb("#f4f4f5"),
  content: (padding: 0.2, frame: "rect"),
  rect: (radius: 2pt),
)
```

Marks: `mark: (start: "<", end: ">")`, mnemonics `> < <> [] [ ] | o + x * )> >>`.
Mark keys: `symbol`, `fill`, `stroke`, `scale`, `length`, `width`, `inset`,
`pos`, `offset`, `anchor`, `flip`, `reverse`.

## Composition

```typst
group({ ... }, name: "g")          // scoped styling, exposes "g.north-east"
scope({ ... })                     // scoped state without a named element
on-layer(-1, { ... })              // lower layers draw first (backgrounds)
hide(line("a", "b"))               // invisible, still resolvable
intersections("i", "a", "b")       // creates "i.0", "i.1", ...
for-each-anchor("g", name => { ... })
merge-path({ ... }, close: true)   // one continuous path; supports marks
compound-path({ ... }, fill-rule: "even-odd")   // sub-paths, e.g. holes
boolean("a", "b", op: "difference", fill: blue)
rect-around("a", "b", padding: 0.1)
```

Libraries:

```typst
angle.angle("a.start", "a.end", "b.end", label: $theta$, radius: 0.8)
tree.tree(([root], ([a], [a1]), [b]), draw-node: node => { ... }, draw-edge: (p, c) => line(p.group-name, c.group-name))
decorations.brace((0,-0.5), (3,-0.5), amplitude: 0.2)
decorations.wave(target, amplitude: 0.25, segments: 8)
palette.new(colors: (red, blue, green))
```

3D uses a projection scope; keep labels and geometry inside it:

```typst
ortho(x: 65deg, y: -35deg, {
  on-xz({ grid((0,0), (1.6,1.6), step: 0.4) })     // ground plane
  on-xy({ line((0,0), (0,1.5), mark: (end: ">")) }) // vertical axis
  line((0,0,0), (1.1, 0.7, 0.95), mark: (end: ">")) // 3D vector
})
```

## Recipes

**Annotated block diagram** — boxes on a spine, labels via `content`, shapes on
the left/right for bypasses. Reserve real space for labels: a 1 cm box at 10 pt
text fits roughly ten characters; widen the box or shrink the text otherwise.

```typst
let layer(x1, y1, x2, y2, label, fill: white) = {
  rect((x1, y1), (x2, y2), radius: 2pt, fill: fill)
  content(((x1 + x2) / 2, (y1 + y2) / 2), label, anchor: "center")
}
layer(0, 0, 3, 0.6, [LayerNorm])
layer(0, 1.0, 3, 1.6, [Attention], fill: rgb("#dbeafe"))
line((1.5, 0.6), (1.5, 1.0), mark: (end: ">"))
```

**Matrix / heatmap** — loop over rows and columns, encode the value in the fill
and print the number. Use `high.transparentize(100% - value * 100%)` for a
one-color ramp (there is no color-mix call in CeTZ).

**Grouped flow** — draw stages left to right, then use
`decorations.brace(start, end)` under a contiguous run of stages to name a
phase, and a `dash: "densely-dashed"` line for a boundary.

**Hierarchy** — `tree.tree` with a `draw-node` that styles by `node.depth` and
a `draw-edge` that calls `line(parent.group-name, child.group-name)`.

**Geometry** — combine `circle`, `arc`, `polygon`, and `angle.angle` with named
elements; check the angle label radius so it does not cover the vertex.

## Pitfalls

- Pin the CeTZ version. `plot` is not part of CeTZ 0.5; use `cetz-plot`.
- `rgb(..) + 50%` is an error; use `.transparentize()` / `.lighten()`.
- `bezier(start, end, ctrl1, ctrl2)` — endpoints first, or curves go the wrong
  way.
- A Typst helper function that draws *and* returns a coordinate triggers
  "cannot join array with float"; compute coordinates in a separate pure
  function.
- `content((), [...])` means "current position", which is wrong inside
  callbacks (use `(0, 0)`).
- Two positional args to `content` are two coordinates, not coordinate +
  content.
- `canvas(length: ...)` needs a length, not a ratio; use `layout` to size to a
  fraction of the page.
- In `ortho`, put labels inside the projection; outside they use unprojected
  coordinates.
- Elements hidden with `hide` still affect intersections, which is useful, but
  they also count as elements when resolving coordinates by name.

## Verification checklist

- Compiles with zero errors (`typst_compile`).
- Rendered image inspected at least once after the last edit.
- No label overlaps a box edge or another label.
- Every arrow touches the intended shape and points the right way.
- Colors stay distinguishable in grayscale (light vs dark fill, not only hue).
- Caption states the takeaway, not just the mechanics.
