---
name: cetz-diagrams
description: Draw diagrams in Typst with CeTZ 0.5.2 — canvas setup, coordinates and anchors, shapes, styling, groups, layers, intersections, trees, braces, and 3D projections — plus a one-shot workflow with copy-paste recipes and a verified failure-mode catalog. Use when a concept needs a figure, schematic, flowchart, annotated diagram, matrix visualization, or 3D sketch inside a Typst document.
---

# CeTZ diagrams

CeTZ places exactly what you ask for, so a good figure is arithmetic you can do
before compiling. This skill is built to **one-shot** a figure: read the rules,
copy the nearest recipe, run the pre-flight checklist, compile once, then spend
at most one or two passes on layout.

Reference files (read the one you need, not all of them):

| File | Use it for |
| --- | --- |
| [references/cetz-recipes.md](references/cetz-recipes.md) | 14 complete figures to copy — pipelines, heatmaps, trees, flowcharts, 3D, comparison panels |
| [references/cetz-failure-modes.md](references/cetz-failure-modes.md) | Exact error message → cause → fix, plus the silent visual failures |
| [references/diagram-layout.md](references/diagram-layout.md) | Measured text widths, spacing numbers, colour/legibility rules |
| [references/cetz-api.md](references/cetz-api.md) | Full signatures, per-element style keys and anchors, coordinate forms |

The ` ```typst ` blocks in those files (and in this one) are complete documents
compiled by `npm run selftest`, so they are known-good starting points.

## One-shot protocol

1. **Classify the figure** and open the matching recipe: spine/pipeline →
   recipe 1; bypass → 2; phases → 3; matrix/heatmap → 4; bars → 5; timeline → 6;
   hierarchy → 7; flowchart → 8; states → 9; geometry → 10; layers → 11;
   3D → 12; comparison → 13; annotated formula → 14.
2. **Set the canvas and the spine.** One x for the spine, one stage height, one
   gap. Sizes come from the text: `box width ≥ 0.0165 × pt × chars cm` (19 chars
   at 10pt ≈ 3.1cm of text — add 25%).
3. **Write the whole figure** using named elements for anything that two
   coordinates refer to (`name: "a"`, then `line("a.east", "b.west")`).
4. **Run the pre-flight checklist below** — it catches every error class in the
   catalog without a compiler round-trip.
5. **Compile** with `typst_compile` (`format: "pdf"`, `preview: "first"`) and
   look at the returned page image. Fix syntax first (one line, recompile),
   then geometry.
6. **Layout pass.** Check for label/box overflow, curves crossing shapes,
   reserved legend space, grayscale readability. One or two passes is the
   budget; needing more means step 2 or 4 was skipped.
7. **Hand over**: export the PDF, start `typst_preview` when the user wants to
   read it live.

## Setup

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 12cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    set-style(stroke: (paint: rgb("#18181b"), thickness: 0.7pt), fill: none,
      content: (padding: 0.2))

    rect((0, 0), (3.4, 0.62), radius: 2pt, fill: rgb("#dbeafe"))
    content((1.7, 0.31), [one block], anchor: "center")
    line((1.7, 0.62), (1.7, 1.12), mark: (end: ">"))
    content((1.7, 1.22), [next], anchor: "south")
  }),
  caption: [One block and an arrow: the smallest useful CeTZ figure.],
) <fig:block>
```

Pin `@preview/cetz:0.5.2`. The first compile downloads the package (network
once). For data plots use `#import "@preview/cetz-plot:0.1.3": plot` — plotting
moved out of CeTZ in 0.4.

**Both imports matter in every module and nested scope.** A helper module that
draws needs `#import "@preview/cetz:0.5.2": draw` at module level, and the
canvas body needs `import draw: *`; otherwise names resolve to Typst built-ins
and the error messages point at arguments (`unexpected argument`,
`unknown variable: dbeafe`) instead of the missing import.

## Pre-flight checklist

Run this before compiling. Each line maps to a failure mode.

1. Every drawing module/scope has both imports.
2. No colour arithmetic (`+`, `*`); ramps use `.transparentize()`.
3. Every `bezier` is `(start, end, ctrl1, ctrl2)`, controls placed **outside**
   the obstacle (≥ 1.2 units from the spine, ≥ 0.3 cm clear of shapes).
4. No helper both draws and returns a value; helpers that compute geometry are
   separate and pure.
5. `content()` has exactly one content argument; callbacks use explicit
   `(0, 0)` (never `()`) for the position.
6. No parameter or variable named after a Typst/CeTZ function (`text`, `rect`,
   `line`, `grid`, `content`, `circle`, `fill`, `stroke`, `mark`, `box`, …).
7. Boxes are sized from the text rule above; vertical room ≥ 0.5 cm per line.
8. Legends/labels/rotated text have reserved space; legends sit in a band drawn
   with `on-layer(-1, ...)`; nothing is within 0.3 cm of a shape it is not part
   of.
9. `mark:` is a dictionary (`mark: (end: ">")`); only `mark()` takes a bare
   symbol.
10. Colours differ in lightness as well as hue; the figure survives grayscale.

## Top compile errors (full catalog in references)

| Error text | Cause | Fix |
| --- | --- | --- |
| `cannot add color and ratio` | `rgb(..) + 50%` | `.transparentize(50%)` |
| `unexpected argument` / `unknown variable: dbeafe` | missing `import draw: *` (name resolved to a Typst built-in) | add both imports in that scope |
| `cannot join array with float` / `… with integer` | helper draws *and* returns a value | split into a pure geometry helper |
| `Failed to resolve coordinate system: [x]` | two positional args to `content` read as two coordinates | one content value (`#text(..)[..]`) |
| `expected integer, found string` | `mark: ">"` | `mark: (end: ">")` |
| `expected function, found content` | parameter shadows `text` | rename the parameter (`label`, `value`, …) |
| `cannot divide by zero` (inside `vector.typ`) | `angle`/`right-angle` with collinear or identical points | use distinct points on the two sides |
| `Anchor 'x' not in anchors (…)` | unknown anchor name | use compass names, `"name.50%"`, or `(name: "n", anchor: 30deg)` |

## Coordinates and anchors in one minute

- `(1.5, 2)`, `(x: 1, y: 2)`, `(rel: (0.5, 0))`, `(angle: 45deg, radius: 1.5)`,
  `() (current position)`, `("a", 50%, "b")` (interpolate).
- `"name"` / `"name.north-east"` / `(name: "line", anchor: 50%)` /
  `(name: "circle", anchor: 30deg)`.
- `line("a", "b")` already shortens to the borders — name elements and connect
  them instead of recomputing coordinates.
- `move-to(coord)` / `set-origin(coord)` move the cursor / origin.

## Cheat sheet

```typ
line((0,0), (2,0), stroke: blue, mark: (end: ">"))
line((0,0), (1,1), (2,0), close: true)
rect((0,0), (rel: (1.5, 0.8)), radius: 3pt, fill: rgb("#dbeafe"))
circle((2,1), radius: 0.3)                     // or radius: (0.4, 0.2)
arc((0,0), start: 30deg, delta: 120deg, mode: "PIE")
grid((0,0), (2,2), step: 0.5, stroke: gray.lighten(40%))
content((1,0.5), [label], anchor: "center")
content((0,0), (2,2), box(width: 100%, [text box]))
bezier((0,0), (1,1), (0.4,-0.2), (1.4,0.6))    // start, end, ctrl1, ctrl2
polygon((0,0), 6, angle: 30deg, radius: 1)
n-star((0,0), 5, inner-radius: 45%, show-inner: true)
```

## Styling

```typ
set-style(
  stroke: (paint: rgb("#18181b"), thickness: 0.7pt, dash: "dashed"),
  fill: rgb("#f4f4f5"),
  content: (padding: 0.2, frame: "rect"),
  rect: (radius: 2pt),
)
```

Precedence: call argument > element type > global; dictionaries merge. Marks:
`mark: (start: "<", end: ">")`, mnemonics `> < <> [] [ ] | o + x * )> >>`, with
`scale`, `fill`, `stroke`, `pos`, `length`, `width`, `inset`, `anchor`.

## Composition

```typ
group({ ... }, name: "g")            // scoped styling, exposes "g.north-east"
scope({ ... })                       // scoped state without a named element
on-layer(-1, { ... })                // background bands
hide(line("a", "b"))                 // invisible but resolvable
intersections("i", "a", "b")         // creates "i.0", "i.1", …
for-each-anchor("g", name => { ... })
merge-path({ ... }, close: true)     // one path, supports marks
compound-path({ ... }, fill-rule: "even-odd")
boolean("a", "b", op: "difference", fill: blue)
rect-around("a", "b", padding: 0.1)
```

Libraries:

```typ
angle.angle("a.start", "a.end", "b.end", label: $theta$, radius: 0.8)
angle.right-angle("corner", "side-a-end", "side-b-end", radius: 0.3)
tree.tree(([root], ([a], [a1]), [b]), draw-node: node => { ... }, draw-edge: (p, c) => line(p.group-name, c.group-name))
decorations.brace((0,-0.5), (3,-0.5), amplitude: 0.2)
decorations.wave(line((0,0), (2,1)), amplitude: 0.25, segments: 8)
palette.new(colors: (red, blue, green))
```

3D: keep geometry and labels **inside** the projection, and choose angles that
separate the axes (`ortho(x: 65deg, y: -35deg)` reads well):

```typ
ortho(x: 65deg, y: -35deg, {
  on-xz({ grid((0,0), (1.6,1.6), step: 0.4) })        // ground plane
  on-xy({ line((0,0), (0,1.5), mark: (end: ">")) })    // vertical axis
  line((0,0,0), (1.1, 0.7, 0.95), mark: (end: ">"))    // 3D vector
})
```

## Verification

- Compiles with zero errors.
- The rendered image has been looked at after the final edit.
- No label touches a box border or another label; nothing is cropped.
- Every arrow touches the intended shape, on the intended face.
- Caption states the takeaway, not the mechanics.
- Colours still distinguish the roles in grayscale.

If a compile fails, read only the first diagnostic. `typst_compile` appends a
`Likely fix:` block for known mistakes (missing `import draw: *`, colour
arithmetic, `mark` as a string, shadowed `text`, content arity, collinear angle
points, unknown anchors), so try that first and only fall back to
[references/cetz-failure-modes.md](references/cetz-failure-modes.md) for the
rest. Typst reports the earliest error, and later ones may disappear once it is
fixed.
