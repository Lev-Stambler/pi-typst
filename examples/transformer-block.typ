// A single pre-norm transformer block drawn with CeTZ 0.5.
//
// Explainer pattern: a vertical computation spine, residual bypasses on the
// left, tensor shapes on the right, and a compact legend.
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 15cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *

    let ink = rgb("#18181b")
    let accent = rgb("#2563eb")
    let accent-soft = rgb("#dbeafe")
    let residual = rgb("#d97706")
    let muted = rgb("#71717a")
    let spine = 3.0
    let soft = 9pt

    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none, content: (padding: 0.25))

    let layer(y1, y2, label, fill: white) = {
      rect((1.45, y1), (4.55, y2), radius: 2pt, fill: fill, stroke: (paint: ink, thickness: 0.7pt))
      content((spine, (y1 + y2) / 2), label, anchor: "center")
    }
    let adder(y) = {
      circle((spine, y), radius: 0.17, fill: white)
      line((spine - 0.17, y), (spine + 0.17, y), stroke: (paint: residual, thickness: 0.9pt))
      line((spine, y - 0.17), (spine, y + 0.17), stroke: (paint: residual, thickness: 0.9pt))
    }
    let flow(y1, y2) = line((spine, y1), (spine, y2), mark: (end: ">"))
    let bypass(y1, y2, x) = bezier((spine, y1), (spine - 0.16, y2), (x, y1), (x, y2),
      stroke: (paint: residual, thickness: 0.9pt), mark: (end: ">"))

    // Bottom-up spine: x -> LN -> MHA -> add -> LN -> FFN -> add -> y
    layer(0.00, 0.62, [Feed-Forward], fill: accent-soft)
    adder(1.05)
    layer(1.48, 2.10, [LayerNorm])
    layer(2.56, 3.18, text(10pt, [Multi-Head Attention]), fill: accent-soft)
    adder(3.61)
    layer(4.04, 4.66, [LayerNorm])

    flow(-0.50, 0.00)
    flow(0.62, 0.89)
    flow(1.21, 1.48)
    flow(2.10, 2.56)
    flow(3.18, 3.45)
    flow(3.77, 4.04)
    flow(4.66, 5.15)

    // Residual paths on the left: input -> top adder, and add -> bottom adder.
    bypass(-0.30, 3.61, 0.72)
    bypass(3.61, 1.05, 1.28)

    // Tensor shapes on the right with leader lines.
    let hint(y, label) = {
      line((4.6, y), (4.9, y), stroke: (paint: muted, thickness: 0.5pt))
      content((5.0, y), text(soft, label), anchor: "west")
    }
    hint(0.31, [$d -> 4d -> d$])
    hint(2.87, [$h times d slash h$])
    hint(1.79, [$d$])
    hint(4.35, [$d$])

    // Inputs and outputs.
    content((spine - 0.3, -0.62), [input $bold(x)$, $B times T times d$], anchor: "east")
    content((spine - 0.3, 5.3), [output $bold(y)$], anchor: "east")

    // Legend.
    on-layer(-1, rect((0.15, 5.95), (8.9, 6.75), radius: 3pt, fill: rgb("#f4f4f5"), stroke: none))
    line((0.45, 6.35), (0.9, 6.35))
    content((1.0, 6.35), text(soft, "sublayer"), anchor: "west")
    line((2.3, 6.35), (2.8, 6.35), stroke: (paint: residual, thickness: 0.9pt), mark: (end: ">"))
    content((2.9, 6.35), text(soft, "residual path"), anchor: "west")
    circle((5.6, 6.35), radius: 0.15, fill: white)
    line((5.45, 6.35), (5.75, 6.35), stroke: (paint: residual, thickness: 0.9pt))
    line((5.6, 6.2), (5.6, 6.5), stroke: (paint: residual, thickness: 0.9pt))
    content((5.8, 6.35), text(soft, "elementwise add"), anchor: "west")
  }),
  caption: [A pre-norm transformer block: sublayers on the spine, residual paths bypassing them on the left, and tensor shapes annotated on the right.],
) <fig:transformer-block>
