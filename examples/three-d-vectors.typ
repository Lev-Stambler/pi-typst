// A 3D vector with its projection, drawn with CeTZ's orthographic projection.
//
// Explainer pattern: put the ground plane on `on-xz`, the vertical axis on
// `on-xy`, and keep every label inside the projection so it tracks the geometry.
#import "@preview/cetz:0.5.2": canvas, draw

#set page(width: 12cm, height: auto, margin: 1cm)

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
      // Ground plane: grid, x and z axes, and the projection of the vector.
      on-xz({
        grid((0, 0), (1.6, 1.6), step: 0.4, stroke: (paint: rgb("#cbd5e1"), thickness: 0.4pt))
        line((0, 0), (1.9, 0), stroke: (paint: x-color, thickness: 0.9pt), mark: (end: ">"))
        line((0, 0), (0, 1.9), stroke: (paint: z-color, thickness: 0.9pt), mark: (end: ">"))
        content((2.0, 0), [$x$], anchor: "west")
        content((0, 2.0), [$z$], anchor: "south")
        line((0, 0), (1.1, 0.95), stroke: (paint: muted, thickness: 0.5pt, dash: "densely-dashed"))
        content((1.2, 1.0), [$bold(v)_"proj"$], anchor: "west")
      })

      // Vertical axis.
      on-xy({
        line((0, 0), (0, 1.5), stroke: (paint: y-color, thickness: 0.9pt), mark: (end: ">"))
        content((0, 1.65), [$y$], anchor: "south")
      })

      // The vector and the dashed drop to its projection.
      line((0, 0, 0), (1.1, 0.7, 0.95), stroke: (paint: v-color, thickness: 1.4pt), mark: (end: ">"))
      line((1.1, 0.7, 0.95), (1.1, 0, 0.95), stroke: (paint: rgb("#a1a1aa"), thickness: 0.5pt, dash: "densely-dashed"))
      content((1.15, 0.8, 1.0), [$bold(v)$], anchor: "south-west")
    })
  }),
  caption: [A vector in three dimensions with its projection onto the ground plane. The dashed segment drops from the tip to the plane along the vertical axis.],
) <fig:vector3d>
