// An end-to-end data pipeline: grouped stages, a retry path, and cadence notes.
//
// Explainer pattern: braces group stages into phases, a dashed divider marks
// the offline/online boundary, and a decorated path shows the feedback loop.
#import "@preview/cetz:0.5.2": canvas, draw, decorations

#set page(width: 17cm, height: auto, margin: 1cm)

#figure(
  canvas(length: 1cm, {
    import draw: *

    let ink = rgb("#18181b")
    let muted = rgb("#71717a")
    let accent = rgb("#2563eb")
    let accent-soft = rgb("#dbeafe")
    let warn = rgb("#d97706")
    let ok = rgb("#059669")
    let w = 1.85
    let h = 0.78
    let gap = 0.62

    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none, content: (padding: 0.2))

    let labels = ([raw logs], [filter + dedupe], [tokenize], [train], [evaluate])
    let fills = (white, white, white, accent-soft, accent-soft)
    let step = w + gap
    for i in range(labels.len()) {
      let x = i * step
      rect((x, 0), (x + w, h), radius: 3pt, fill: fills.at(i), stroke: (paint: ink, thickness: 0.7pt))
      content((x + w / 2, h / 2), labels.at(i), anchor: "center")
      if i < labels.len() - 1 {
        line((x + w, h / 2), (x + w + gap, h / 2), mark: (end: ">"))
      }
    }

    // Cadence notes under each stage.
    let notes = ([streamed], [1×/day], [cached], [per step], [per epoch])
    for i in range(notes.len()) {
      let x = i * (w + gap)
      content((x + w / 2, -0.28), text(8pt, fill: muted, notes.at(i)), anchor: "north")
    }

    // Phase braces.
    decorations.brace((0, -0.75), (3 * (w + gap) - gap, -0.75), amplitude: 0.22, name: "offline")
    content((1.5 * (w + gap) - gap / 2, -1.25), text(9pt, [offline batch pipeline]), anchor: "center")
    decorations.brace((3 * (w + gap), -0.75), (5 * (w + gap) - gap, -0.75), amplitude: 0.22)
    content((4 * (w + gap) - gap / 2, -1.25), text(9pt, [online serving]), anchor: "center")

    // Offline/online divider.
    line((3 * (w + gap) - gap / 2, -0.6), (3 * (w + gap) - gap / 2, 1.9),
      stroke: (paint: muted, thickness: 0.5pt, dash: "densely-dashed"))
    content((3 * (w + gap) - gap / 2, 1.95), text(8pt, fill: muted, [deploy]), anchor: "south")

    // Retry loop: evaluate -> train, routed above the boxes.
    let train-x = 3 * (w + gap) + w / 2
    let eval-x = 4 * (w + gap) + w / 2
    bezier((eval-x, h + 0.18), (train-x, h + 0.18), (eval-x, h + 1.05), (train-x, h + 1.05),
      stroke: (paint: warn, thickness: 0.9pt), mark: (end: ">"))
    content((3.5 * (w + gap) + w / 2, h + 1.2), text(8pt, fill: warn, [retry on regression]), anchor: "south")

    // Data volume annotation on the first arrow.
    content((w + gap / 2, h + 0.08), text(7pt, fill: muted, [1.2 TB]), anchor: "south")

    // Quality gate marker between evaluate and deployment.
    circle((5 * (w + gap) - gap / 2 + 0.0, h / 2), radius: 0.16, fill: white, stroke: (paint: ok, thickness: 0.8pt))
    line((5 * (w + gap) - gap / 2 - 0.11, h / 2 - 0.11), (5 * (w + gap) - gap / 2 + 0.11, h / 2 + 0.11), stroke: (paint: ok, thickness: 0.8pt))
    line((5 * (w + gap) - gap / 2 - 0.11, h / 2 + 0.11), (5 * (w + gap) - gap / 2 + 0.11, h / 2 - 0.11), stroke: (paint: ok, thickness: 0.8pt))
    content((5 * (w + gap) - gap / 2, h / 2 + 0.3), text(8pt, fill: ok, [gate]), anchor: "south")
  }),
  caption: [A two-phase pipeline: the offline batch side produces training data and checkpoints, the online side serves them, and a regression gate routes failures back to training.],
) <fig:pipeline>
