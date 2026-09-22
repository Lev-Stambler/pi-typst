# CeTZ recipe cookbook

Fourteen complete figures, each one a document that compiles as-is. They are the
fastest path to a correct figure: copy the closest recipe, change the labels and
coordinates, compile.

Every fenced ` ```typst ` block on this page is compiled by `npm run selftest`,
so the recipes cannot rot. Fragments are shown as ` ```typ `. Conventions used
throughout: boxes are sized with the `0.0165 × pt × chars` rule
(see [diagram-layout.md](diagram-layout.md)), bypass routes stay ≥ 1.2 units
clear of the spine, and every figure ends in a `figure` with a takeaway caption.

## 1. Spine with boxes, arrows, and a legend

The workhorse for pipelines, blocks, and processing stages. One x for the spine,
one stage height, one gap.

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 12cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let ink = rgb("#18181b")
    let accent = rgb("#2563eb")
    let soft = rgb("#dbeafe")
    let muted = rgb("#71717a")
    let spine = 2.6

    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none, content: (padding: 0.2))

    let stage(y, label, fill: white) = {
      rect((1.0, y), (4.2, y + 0.62), radius: 2pt, fill: fill, stroke: (paint: ink, thickness: 0.7pt))
      content((spine, y + 0.31), label, anchor: "center")
    }
    stage(0.00, [load])
    stage(0.97, [transform], fill: soft)
    stage(1.94, [write])

    line((spine, 0.62), (spine, 0.97), mark: (end: ">"))
    line((spine, 1.59), (spine, 1.94), mark: (end: ">"))
    line((spine, -0.45), (spine, 0.00), mark: (end: ">"))
    line((spine, 2.56), (spine, 3.10), mark: (end: ">"))
    content((spine - 0.25, -0.62), [input], anchor: "east")
    content((spine - 0.25, 3.25), [output], anchor: "east")

    // Right-hand annotations with leader lines.
    let hint(y, label) = {
      line((4.35, y), (4.75, y), stroke: (paint: muted, thickness: 0.5pt))
      content((4.85, y), text(8pt, label), anchor: "west")
    }
    hint(0.31, [1 file])
    hint(1.28, [pure function])
    hint(2.25, [1 file])

    // Legend in reserved space.
    on-layer(-1, rect((0.6, 3.55), (5.6, 4.25), radius: 3pt, fill: rgb("#f4f4f5"), stroke: none))
    rect((0.85, 3.78), (1.45, 4.02), radius: 2pt, fill: white, stroke: (paint: ink, thickness: 0.7pt))
    content((1.6, 3.9), text(8pt, [sublayer]), anchor: "west")
    line((3.3, 3.90), (3.8, 3.90), stroke: (paint: accent, thickness: 1.1pt), mark: (end: ">"))
    content((3.9, 3.9), text(8pt, [data flow]), anchor: "west")
  }),
  caption: [A three-stage pipeline: the middle stage is highlighted as the transform.],
) <fig:spine>
```

## 2. Residual bypass around a block

The pattern that trips people up most: a curve that goes *around* the shapes.
Control points live outside the box column, and the endpoints are the adder.

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 11cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let ink = rgb("#18181b")
    let residual = rgb("#d97706")
    let soft = rgb("#dbeafe")
    let spine = 2.4

    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none, content: (padding: 0.2))

    rect((0.9, 0.0), (3.9, 0.62), radius: 2pt, fill: soft)
    content((spine, 0.31), [block $l$], anchor: "center")
    circle((spine, 1.15), radius: 0.17, fill: white)
    line((spine - 0.17, 1.15), (spine + 0.17, 1.15), stroke: (paint: residual, thickness: 0.9pt))
    line((spine, 0.98), (spine, 1.32), stroke: (paint: residual, thickness: 0.9pt))
    rect((0.9, 1.70), (3.9, 2.32), radius: 2pt, fill: white)
    content((spine, 2.01), [next block], anchor: "center")

    line((spine, -0.45), (spine, 0.0), mark: (end: ">"))
    line((spine, 0.62), (spine, 0.98), mark: (end: ">"))
    line((spine, 1.32), (spine, 1.70), mark: (end: ">"))
    line((spine, 2.32), (spine, 2.85), mark: (end: ">"))

    // Bypass: start below the block, end at the adder. Control points at x = 0.35,
    // well clear of the boxes that start at x = 0.9.
    bezier(
      (spine, -0.3), (spine - 0.17, 1.15), (0.35, -0.3), (0.35, 1.15),
      stroke: (paint: residual, thickness: 0.9pt), mark: (end: ">"),
    )
    content((0.35, -0.5), text(8pt, fill: residual, [residual]), anchor: "north")
    content((spine - 0.25, 2.95), [$x_(l+1)$], anchor: "east")
  }),
  caption: [The residual bypass routes around the block and lands on the addition, not on the block.],
) <fig:bypass>
```

## 3. Phases with braces and a divider

```typst
#import "@preview/cetz:0.5.2": canvas, draw, decorations

#set page(width: 15cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let ink = rgb("#18181b")
    let muted = rgb("#71717a")
    let soft = rgb("#dbeafe")
    let w = 1.7
    let h = 0.7
    let gap = 0.6
    let step = w + gap

    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none, content: (padding: 0.2))

    let stages = ([ingest], [clean], [train], [serve])
    for i in range(stages.len()) {
      let x = i * step
      rect((x, 0), (x + w, h), radius: 3pt, fill: if i >= 2 { soft } else { white })
      content((x + w / 2, h / 2), stages.at(i), anchor: "center")
      if i < stages.len() - 1 {
        line((x + w, h / 2), (x + w + gap, h / 2), mark: (end: ">"))
      }
    }

    let boundary = 2 * step - gap / 2
    line((boundary, -0.25), (boundary, 1.35), stroke: (paint: muted, thickness: 0.5pt, dash: "densely-dashed"))
    content((boundary, 1.45), text(8pt, fill: muted, [deploy]), anchor: "south")

    decorations.brace((0, -0.55), (2 * step - gap, -0.55), amplitude: 0.2)
    content((step - gap / 2, -1.05), text(9pt, [offline batch]), anchor: "center")
    decorations.brace((2 * step, -0.55), (4 * step - gap, -0.55), amplitude: 0.2)
    content((3 * step - gap / 2, -1.05), text(9pt, [online serving]), anchor: "center")
  }),
  caption: [Two phases separated by the deployment boundary, each named by a brace.],
) <fig:phases>
```

## 4. Matrix / heatmap with a value ramp

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 13cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let n = 5
    let cell = 0.62
    let gridd = rgb("#d4d4d8")
    let low = rgb("#dbeafe")
    let high = rgb("#1d4ed8")

    // Row i attends to column j; the upper triangle is masked.
    let weights = (
      (1.00, 0.00, 0.00, 0.00, 0.00),
      (0.60, 0.40, 0.00, 0.00, 0.00),
      (0.30, 0.40, 0.30, 0.00, 0.00),
      (0.20, 0.25, 0.35, 0.20, 0.00),
      (0.15, 0.20, 0.25, 0.25, 0.15),
    )

    set-style(content: (padding: 0.05))
    for i in range(n) {
      for j in range(n) {
        let value = weights.at(i).at(j)
        let active = j <= i
        let x1 = j * cell
        let y1 = (n - 1 - i) * cell
        rect(
          (x1, y1), (x1 + cell, y1 + cell),
          fill: if active { high.transparentize(100% - value * 100%) } else { rgb("#f4f4f5") },
          stroke: (paint: gridd, thickness: 0.4pt),
        )
        if active {
          content((x1 + cell / 2, y1 + cell / 2), text(7pt, if value > 0.55 { white } else { rgb("#1e3a8a") }, str(value).slice(1)))
        }
      }
    }

    for i in range(n) {
      content((-0.2, (n - 1 - i) * cell + cell / 2), text(8pt, [$q_#(i + 1)$]), anchor: "east")
      content((i * cell + cell / 2, -0.2), text(8pt, [$k_#(i + 1)$]), anchor: "north")
    }

    // Masked region.
    line((cell, n * cell - cell), (n * cell, n * cell - cell), (n * cell, 0), close: true,
      stroke: (paint: rgb("#dc2626"), thickness: 0.7pt, dash: "dashed"))
    content((n * cell + 0.25, n * cell - 0.7), text(8pt, fill: rgb("#dc2626"), [masked]), anchor: "west")

    // Color legend under the matrix.
    let ly = -1.15
    content((0, ly + 0.1), text(8pt, [weight]), anchor: "west")
    for t in range(6) {
      rect((1.5 + t * 0.26, ly), (1.76 + t * 0.26, ly + 0.2),
        fill: high.transparentize(100% - (t / 5) * 100%), stroke: none)
    }
    content((1.4, ly + 0.1), text(7pt, [$0$]), anchor: "east")
    content((3.1, ly + 0.1), text(7pt, [$1$]), anchor: "west")
  }),
  caption: [Causal attention weights: darker cells carry more weight, and the upper triangle is masked to zero.],
) <fig:heatmap>
```

## 5. Bar chart with axes

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 12cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let ink = rgb("#18181b")
    let muted = rgb("#71717a")
    let accent = rgb("#2563eb")
    let soft = rgb("#dbeafe")

    let bars = (("triton", 1.0), ("torch", 0.72), ("eager", 0.31), ("compile", 0.45))
    let width = 0.55
    let gap = 0.55

    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none, content: (padding: 0.15))

    // Axes.
    line((0, 0), (4.6, 0), stroke: (paint: ink, thickness: 0.8pt))
    line((0, 0), (0, 1.15), stroke: (paint: ink, thickness: 0.8pt))
    for t in range(5) {
      let y = t * 0.25
      line((-0.05, y), (0, y), stroke: (paint: muted, thickness: 0.5pt))
      content((-0.12, y), text(7pt, fill: muted, [#(t * 25)%]), anchor: "east")
    }

    for (i, entry) in bars.enumerate() {
      let x = 0.35 + i * (width + gap)
      let height = entry.at(1) * 1.0
      rect((x, 0), (x + width, height), fill: if i == 0 { soft } else { rgb("#f4f4f5") })
      content((x + width / 2, height + 0.08), text(8pt, str(entry.at(1))), anchor: "south")
      content((x + width / 2, -0.1), text(8pt, entry.at(0)), anchor: "north")
    }
    content((0, 1.3), text(8pt, fill: muted, [throughput vs. baseline]), anchor: "north-west")
  }),
  caption: [Measured throughput relative to the baseline; the highlighted bar is the configuration under discussion.],
) <fig:bars>
```

## 6. Timeline

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 15cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let ink = rgb("#18181b")
    let muted = rgb("#71717a")
    let accent = rgb("#2563eb")

    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none, content: (padding: 0.15))

    line((0, 0), (12, 0), stroke: (paint: ink, thickness: 0.8pt), mark: (end: ">"))
    let events = ((0.8, [proposal], 0), (3.1, [first run], 1), (5.4, [scaling law], 0), (8.0, [ablation], 1), (10.4, [write-up], 0))
    for (x, label, side) in events {
      line((x, -0.12), (x, 0.12), stroke: (paint: ink, thickness: 0.8pt))
      line((x, 0.12), (x, 0.55), stroke: (paint: muted, thickness: 0.5pt, dash: "densely-dashed"))
      content((x, 0.62), text(8pt, label), anchor: "south")
      if side == 1 {
        line((x, -0.12), (x, -0.55), stroke: (paint: muted, thickness: 0.5pt, dash: "densely-dashed"))
        content((x, -0.62), text(8pt, fill: muted, [#(x / 10)]), anchor: "north")
      }
    }
    // Highlight the interesting interval.
    line((3.1, 0.95), (5.4, 0.95), stroke: (paint: accent, thickness: 1.2pt), mark: (end: ">"))
    content((4.25, 1.05), text(8pt, fill: accent, [2 weeks]), anchor: "south")
  }),
  caption: [Project timeline; the highlighted interval is the delay between the first run and the scaling law.],
) <fig:timeline>
```

## 7. Hierarchy with the tree library

```typst
#import "@preview/cetz:0.5.2": canvas, draw, tree

#set page(width: 14cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let muted = rgb("#71717a")
    let depth-fill = (rgb("#dbeafe"), rgb("#e0f2fe"), rgb("#f4f4f5"))
    let depth-stroke = (rgb("#2563eb"), rgb("#0284c7"), rgb("#a1a1aa"))

    set-style(stroke: (paint: rgb("#18181b"), thickness: 0.7pt), fill: none)

    tree.tree(
      ([runtime], ([norm], [rms], [layer]), ([attention], [prefill], [decode]), ([gemv], [fp8], [int4])),
      direction: "down",
      grow: 1.25,
      spread: 0.95,
      draw-node: (node) => {
        let depth = calc.min(node.depth, 2)
        rect((-0.7, -0.22), (0.7, 0.22), radius: 3pt,
          fill: depth-fill.at(depth), stroke: (paint: depth-stroke.at(depth), thickness: 0.7pt))
        content((0, 0), text(9pt, node.content), anchor: "center")
      },
      draw-edge: (parent, child) => {
        line(parent.group-name, child.group-name, stroke: (paint: muted, thickness: 0.7pt), mark: (end: ">"))
      },
    )
  }),
  caption: [Kernel hierarchy; node depth sets the fill and border colour.],
) <fig:tree>
```

## 8. Flowchart with branches

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 13cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let ink = rgb("#18181b")
    let ok = rgb("#059669")
    let bad = rgb("#dc2626")
    let soft = rgb("#dbeafe")

    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none, content: (padding: 0.18))

    rect((1.4, 1.30), (4.6, 1.92), radius: 3pt, fill: soft)
    content((3.0, 1.61), [evaluate], anchor: "center")

    // Decision diamond.
    line((3.0, 0.90), (3.9, 0.45), (3.0, 0.0), (2.1, 0.45), close: true, fill: white)
    content((3.0, 0.45), [pass?], anchor: "center")

    rect((4.9, 1.30), (7.4, 1.92), radius: 3pt, fill: white)
    content((6.15, 1.61), [ship], anchor: "center")
    rect((0.0, 1.30), (1.0, 1.92), radius: 3pt, fill: white)
    content((0.5, 1.61), [retry], anchor: "center")

    line((3.0, 0.90), (3.0, 1.30), mark: (end: ">"))
    line((3.9, 0.45), (6.15, 0.45), (6.15, 1.30), stroke: (paint: ok, thickness: 0.9pt), mark: (end: ">"))
    line((2.1, 0.45), (0.5, 0.45), (0.5, 1.30), stroke: (paint: bad, thickness: 0.9pt), mark: (end: ">"))

    content((5.1, 0.55), text(8pt, fill: ok, [yes]), anchor: "west")
    content((2.35, 0.55), text(8pt, fill: bad, [no]), anchor: "west")
  }),
  caption: [Evaluation gate: passing runs ship, failing runs go back to retry.],
) <fig:flow>
```

## 9. State machine with curved transitions

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 12cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let ink = rgb("#18181b")
    let muted = rgb("#71717a")
    let accent = rgb("#2563eb")

    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none, content: (padding: 0.18))

    circle((0.9, 0.9), radius: 0.45, fill: rgb("#f4f4f5"), name: "idle")
    circle((3.4, 0.9), radius: 0.45, fill: rgb("#dbeafe"), name: "run")
    circle((5.9, 0.9), radius: 0.45, fill: rgb("#f4f4f5"), name: "done")
    content((0.9, 0.9), [idle], anchor: "center")
    content((3.4, 0.9), [run], anchor: "center")
    content((5.9, 0.9), [done], anchor: "center")

    line("idle.east", "run.west", mark: (end: ">"))
    line("run.east", "done.west", mark: (end: ">"))
    content((2.15, 1.02), text(8pt, [start]), anchor: "south")
    content((4.65, 1.02), text(8pt, [finish]), anchor: "south")

    // Failure edge back to idle, routed below both states.
    bezier("done.south", "idle.south", (5.9, -0.1), (0.9, -0.1),
      stroke: (paint: accent, thickness: 0.9pt), mark: (end: ">"))
    content((3.4, -0.35), text(8pt, fill: accent, [error $->$ retry]), anchor: "north")
  }),
  caption: [Run states; the accent edge is the failure path back to idle.],
) <fig:states>
```

## 10. Geometry with angle marks

```typst
#import "@preview/cetz:0.5.2": canvas, draw, angle

#set page(width: 11cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let accent = rgb("#2563eb")

    set-style(stroke: (paint: rgb("#18181b"), thickness: 0.8pt), fill: none, content: (padding: 0.2))

    // A genuine right triangle: the right angle is at (3.4, 0).
    line((0, 0), (3.4, 0), name: "base")
    line((3.4, 0), (3.4, 2.2), name: "up")
    line((3.4, 2.2), (0, 0), name: "hyp")

    // Angle at the origin between the base and the hypotenuse.
    angle.angle("base.start", "base.end", "hyp.end", label: $theta$, radius: 0.8,
      fill: accent.transparentize(80%))
    // Right angle at the corner where base and up meet.
    angle.right-angle("base.end", "base.start", "up.end", radius: 0.3)

    content((1.7, -0.22), [$a$], anchor: "north")
    content((3.62, 1.1), [$b$], anchor: "west")
    content((1.55, 1.35), [$c$], anchor: "east")
  }),
  caption: [Right triangle with the angle at the origin and the right-angle mark at the corner.],
) <fig:triangle>
```

## 11. Layered architecture with a background band

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 13cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let ink = rgb("#18181b")
    let muted = rgb("#71717a")
    let soft = rgb("#dbeafe")
    let band = rgb("#f4f4f5")

    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none, content: (padding: 0.2))

    // Bands first, on a lower layer, so boxes and text stay on top.
    on-layer(-1, {
      rect((0, 1.85), (8.4, 2.95), fill: band, stroke: none)
      rect((0, 0.65), (8.4, 1.75), fill: band.transparentize(40%), stroke: none)
      rect((0, -0.55), (8.4, 0.55), fill: band.transparentize(70%), stroke: none)
    })
    content((-0.2, 2.4), text(8pt, fill: muted, [api]), anchor: "east")
    content((-0.2, 1.2), text(8pt, fill: muted, [core]), anchor: "east")
    content((-0.2, 0.0), text(8pt, fill: muted, [storage]), anchor: "east")

    let box(x, y, label, fill: white) = {
      rect((x, y), (x + 1.6, y + 0.62), radius: 3pt, fill: fill)
      content((x + 0.8, y + 0.31), text(9pt, label), anchor: "center")
    }
    box(0.3, 2.08, [routes])
    box(2.3, 2.08, [auth])
    box(0.3, 0.88, [engine], fill: soft)
    box(2.3, 0.88, [cache])
    box(4.6, 0.88, [queue])
    box(0.3, -0.32, [index])
    box(2.3, -0.32, [blobs])

    line((1.1, 2.08), (1.1, 1.50), mark: (end: ">"))
    line((3.1, 2.08), (3.1, 1.50), mark: (end: ">"))
    line((1.1, 0.88), (1.1, 0.30), mark: (end: ">"))
    line((3.1, 0.88), (3.1, 0.30), mark: (end: ">"))
  }),
  caption: [Three-layer architecture; the engine box is the component under discussion.],
) <fig:layers>
```

## 12. 3D vector with its projection

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 11cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1.7cm, {
    import draw: *
    let muted = rgb("#71717a")
    let x-color = rgb("#dc2626")
    let y-color = rgb("#059669")
    let z-color = rgb("#2563eb")
    let v-color = rgb("#7c3aed")

    set-style(stroke: (paint: rgb("#18181b"), thickness: 0.8pt), fill: none, content: (padding: 0.12))

    ortho(x: 65deg, y: -35deg, {
      on-xz({
        grid((0, 0), (1.6, 1.6), step: 0.4, stroke: (paint: rgb("#cbd5e1"), thickness: 0.4pt))
        line((0, 0), (1.9, 0), stroke: (paint: x-color, thickness: 0.9pt), mark: (end: ">"))
        line((0, 0), (0, 1.9), stroke: (paint: z-color, thickness: 0.9pt), mark: (end: ">"))
        content((2.05, 0), [$x$], anchor: "west")
        content((0, 2.05), [$z$], anchor: "south")
        line((0, 0), (1.1, 0.95), stroke: (paint: muted, thickness: 0.5pt, dash: "densely-dashed"))
        content((1.2, 1.0), [$bold(v)_"proj"$], anchor: "west")
      })
      on-xy({
        line((0, 0), (0, 1.5), stroke: (paint: y-color, thickness: 0.9pt), mark: (end: ">"))
        content((0, 1.65), [$y$], anchor: "south")
      })
      line((0, 0, 0), (1.1, 0.7, 0.95), stroke: (paint: v-color, thickness: 1.4pt), mark: (end: ">"))
      line((1.1, 0.7, 0.95), (1.1, 0, 0.95), stroke: (paint: rgb("#a1a1aa"), thickness: 0.5pt, dash: "densely-dashed"))
      content((1.15, 0.8, 1.0), [$bold(v)$], anchor: "south-west")
    })
  }),
  caption: [A 3D vector and its projection onto the ground plane, drawn with an orthographic projection.],
) <fig:vector3d>
```

## 13. Comparison panels

```typst
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 15cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let ink = rgb("#18181b")
    let muted = rgb("#71717a")
    let soft = rgb("#dbeafe")

    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none, content: (padding: 0.18))

    let panel(x, title, fill) = {
      rect((x, 0), (x + 4.4, 2.0), radius: 3pt, fill: fill, stroke: (paint: ink, thickness: 0.7pt))
      content((x + 2.2, 1.75), text(9pt, weight: "bold", title), anchor: "center")
    }
    panel(0.0, [before], rgb("#f4f4f5"))
    panel(8.0, [after], rgb("#f4f4f5"))

    let node(x, y, label, fill) = {
      rect((x, y), (x + 1.5, y + 0.5), radius: 2pt, fill: fill)
      content((x + 0.75, y + 0.25), text(8pt, label), anchor: "center")
    }
    node(0.4, 0.9, [serial], white)
    node(2.4, 0.9, [copy], white)
    node(8.4, 0.9, [parallel], soft)
    node(10.4, 0.9, [in-place], soft)
    line((0.4 + 1.5, 1.15), (2.4, 1.15), mark: (end: ">"))
    line((8.4 + 1.5, 1.15), (10.4, 1.15), mark: (end: ">"))
    content((1.15, 0.55), text(7pt, fill: muted, [2 passes]), anchor: "north")
    content((9.15, 0.55), text(7pt, fill: muted, [1 pass]), anchor: "north")

    line((6.4, 1.0), (7.4, 1.0), stroke: (paint: muted, thickness: 1.0pt), mark: (end: ">"))
    content((6.9, 1.2), text(8pt, fill: muted, [change]), anchor: "south")
    line((6.9, -0.2), (6.9, 2.2), stroke: (paint: muted, thickness: 0.5pt, dash: "densely-dashed"))
  }),
  caption: [Before and after the change; the dashed line separates the two configurations and the arrow marks the transformation.],
) <fig:compare>
```

## 14. Annotated formula terms with braces

```typst
#import "@preview/cetz:0.5.2": canvas, draw, decorations

#set page(width: 13cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *
    let muted = rgb("#71717a")
    let accent = rgb("#2563eb")

    set-style(stroke: (paint: rgb("#18181b"), thickness: 0.7pt), fill: none, content: (padding: 0.15))

    // The formula itself is ordinary Typst content.
    content((2.2, 1.0), $ bold(y) = W bold(x) + bold(b) $, anchor: "center")
    line((0.0, 0.75), (4.4, 0.75), stroke: none)

    // Brace under the weight term.
    decorations.brace((0.35, 0.6), (1.15, 0.6), amplitude: 0.18, name: "w")
    content((0.75, 0.05), text(8pt, fill: accent, [learned weights]), anchor: "north")
    // Brace under the bias term.
    decorations.brace((3.0, 0.6), (3.6, 0.6), amplitude: 0.18)
    content((3.3, 0.05), text(8pt, fill: accent, [bias]), anchor: "north")

    content((2.2, 1.75), text(8pt, fill: muted, [affine map, no activation]), anchor: "south")
  }),
  caption: [An affine map with its learned parameters called out by braces.],
) <fig:formula>
```
