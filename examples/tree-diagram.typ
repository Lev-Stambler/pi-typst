// A package hierarchy drawn with the CeTZ tree library.
//
// Explainer pattern: automatic tree layout, depth-dependent node styling, and
// callback-drawn edges, so a hierarchy stays readable without hand-placed
// coordinates.
#import "@preview/cetz:0.5.2": canvas, draw, tree

#set page(width: 16cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *

    let ink = rgb("#18181b")
    let muted = rgb("#71717a")
    let depth-fill = (rgb("#dbeafe"), rgb("#e0f2fe"), rgb("#f4f4f5"))
    let depth-stroke = (rgb("#2563eb"), rgb("#0284c7"), rgb("#a1a1aa"))

    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none)

    tree.tree(
      ([kernels], ([reductions], [softmax]), ([attention], [prefill], [decode]), ([gemv], [fp8], [int4])),
      direction: "down",
      grow: 1.25,
      spread: 0.95,
      draw-node: (node) => {
        let depth = calc.min(node.depth, 2)
        rect((-0.75, -0.24), (0.75, 0.24), radius: 3pt, fill: depth-fill.at(depth),
          stroke: (paint: depth-stroke.at(depth), thickness: 0.7pt))
        content((0, 0), text(9pt, node.content), anchor: "center")
      },
      draw-edge: (parent, child) => {
        line(parent.group-name, child.group-name, stroke: (paint: muted, thickness: 0.7pt), mark: (end: ">"))
      },
    )

    // Legend in the empty top-left corner.
    let legend-entry(y, label, fill, stroke) = {
      rect((0.1, y - 0.24), (1.7, y + 0.24), radius: 3pt, fill: fill, stroke: (paint: stroke, thickness: 0.7pt))
      content((0.9, y), text(8pt, label), anchor: "center")
    }
    legend-entry(0.35, [root], depth-fill.at(0), depth-stroke.at(0))
    legend-entry(-0.45, [category], depth-fill.at(1), depth-stroke.at(1))
    legend-entry(-1.25, [kernel], depth-fill.at(2), depth-stroke.at(2))
    content((0.1, -1.7), text(8pt, fill: muted, [depth $->$ colour]), anchor: "north-west")
  }),
  caption: [A kernel hierarchy laid out with CeTZ's tree library. Node depth drives the fill colour, and edges are drawn by a callback that connects node anchors.],
) <fig:tree>
