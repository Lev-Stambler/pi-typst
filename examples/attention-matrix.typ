// Causal attention weights as an annotated heatmap, drawn cell-by-cell.
//
// Explainer pattern: encode a matrix with fills and numbers, mark the masked
// region, and add a color legend so the reader can decode the shading.
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 16cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *

    let n = 6
    let cell = 0.66
    let ink = rgb("#18181b")
    let muted = rgb("#71717a")
    let grid-line = rgb("#d4d4d8")
    let masked = rgb("#f4f4f5")
    let low = rgb("#dbeafe")
    let high = rgb("#1d4ed8")

    // Row i attends to column j; the upper triangle is masked out.
    let weights = (
      (1.00, 0.00, 0.00, 0.00, 0.00, 0.00),
      (0.55, 0.45, 0.00, 0.00, 0.00, 0.00),
      (0.30, 0.42, 0.28, 0.00, 0.00, 0.00),
      (0.18, 0.26, 0.34, 0.22, 0.00, 0.00),
      (0.14, 0.18, 0.22, 0.30, 0.16, 0.00),
      (0.10, 0.14, 0.18, 0.22, 0.21, 0.15),
    )

    set-style(content: (padding: 0.05))

    for i in range(n) {
      for j in range(n) {
        let value = weights.at(i).at(j)
        let active = j <= i
        let fill = if active { low } else { masked }
        if active {
          // Blend from `low` to `high` without a color-mixing API.
          fill = high.transparentize(100% - value * 100%)
        }
        let x1 = j * cell
        let y1 = (n - 1 - i) * cell
        rect((x1, y1), (x1 + cell, y1 + cell), fill: fill, stroke: (paint: grid-line, thickness: 0.4pt))
        if active {
          content((x1 + cell / 2, y1 + cell / 2), text(7pt, if value > 0.55 { white } else { rgb("#1e3a8a") }, str(value).slice(1)))
        } else {
          content((x1 + cell / 2, y1 + cell / 2), text(6pt, rgb("#a1a1aa"), [$0$]))
        }
      }
    }

    // Row and column labels.
    for i in range(n) {
      content((-0.22, (n - 1 - i) * cell + cell / 2), text(8pt, [$q_#(i+1)$]), anchor: "east")
      content((i * cell + cell / 2, -0.22), text(8pt, [$k_#(i+1)$]), anchor: "north")
    }
    content((n * cell / 2, n * cell + 0.35), text(8pt, [queries]), anchor: "south")
    content((n * cell + 0.3, -0.22), text(8pt, [keys]), anchor: "west")

    // Causal mask annotation: outline the masked triangle and label it.
    line((cell, n * cell - cell), (n * cell, n * cell - cell), (n * cell, 0), close: true,
      stroke: (paint: rgb("#dc2626"), thickness: 0.7pt, dash: "dashed"))
    content((n * cell + 0.35, n * cell * 0.6), [
      #text(8pt, fill: rgb("#dc2626"), [masked]) \
      #text(7pt, fill: muted)[$w_(i j) = 0$ for $j > i$]
    ], anchor: "west")

    // Row-sum note.
    line((n * cell / 2, n * cell + 0.55), (n * cell / 2, n * cell + 0.15), stroke: (paint: muted, thickness: 0.4pt), mark: (end: ">"))
    content((n * cell / 2, n * cell + 0.7), text(8pt, [each row sums to 1]), anchor: "south")

    // Color legend.
    let legend-x = 0.0
    let legend-y = -1.6
    content((legend-x, legend-y + 0.1), text(8pt, [weight]), anchor: "west")
    for t in range(6) {
      let ratio = t / 5
      rect((legend-x + 1.5 + t * 0.26, legend-y), (legend-x + 1.76 + t * 0.26, legend-y + 0.2),
        fill: high.transparentize(100% - ratio * 100%), stroke: none)
    }
    content((legend-x + 1.4, legend-y + 0.1), text(7pt, [$0$]), anchor: "east")
    content((legend-x + 3.1, legend-y + 0.1), text(7pt, [$1$]), anchor: "west")
  }),
  caption: [Causal attention weights: row $i$ can only attend to keys $j <= i$, so the upper triangle is masked to zero. Darker cells carry more weight; each visible row is normalized to sum to one.],
) <fig:attention-matrix>
