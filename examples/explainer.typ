// A one-page explainer: prose, math, a callout, a CeTZ figure, a table, and
// cross-references. This is the shape that `typst-explain-illustrate` produces.
#import "@preview/cetz:0.5.2": canvas, draw

#set page(paper: "us-letter", margin: 2.1cm, numbering: "1")
#set par(justify: true, leading: 0.72em)
#show heading: it => block(above: 1.1em, below: 0.5em, text(weight: "bold", fill: rgb("#2563eb"), it))
#set heading(numbering: "1.")

#align(center)[
  #text(17pt, weight: "bold")[Why pre-norm transformers train more stably]
  #v(0.2em)
  #text(10pt, fill: rgb("#71717a"))[Lev Stambler · September 2026 · 5 min read]
]

#v(0.6em)
#block(
  fill: rgb("#f4f4f5"),
  inset: (x: 12pt, y: 10pt),
  radius: 4pt,
  width: 100%,
)[
  *TL;DR.* Moving normalization from the branch output to the branch input keeps the residual
  stream itself unnormalized. Gradients then flow through an identity path of depth $L$, so they
  neither vanish nor explode, and warmup becomes optional rather than load-bearing.
]

= The residual stream

A transformer block is a sum of a shortcut and a branch. In the original (post-norm) layout the
normalization sits *on* the shortcut,

$ bold(x)_(l+1) = "norm"(bold(x)_l + F_l(bold(x)_l)), $

while in a pre-norm block it sits *inside* the branch,

$ bold(x)_(l+1) = bold(x)_l + F_l("norm"(bold(x)_l)). $

The difference looks cosmetic and is not. Expanding the pre-norm recursion gives
$ bold(x)_L = bold(x)_0 + sum_(l=0)^(L-1) F_l("norm"(bold(x)_l)) $, so the Jacobian of the
residual stream with respect to $bold(x)_0$ is the identity plus branch terms. Stacking 24 of
these blocks neither rescales the shortcut nor requires the branch to compensate.

#figure(
  canvas(length: 1cm, {
    import draw: *
    let ink = rgb("#18181b")
    let accent = rgb("#2563eb")
    let residual = rgb("#d97706")
    let muted = rgb("#71717a")
    set-style(stroke: (paint: ink, thickness: 0.7pt), fill: none, content: (padding: 0.2))

    rect((0.6, 0.0), (3.2, 0.7), radius: 2pt, fill: rgb("#dbeafe"))
    content((1.9, 0.35), [block $l$], anchor: "center")
    rect((0.6, 1.5), (3.2, 2.2), radius: 2pt, fill: white)
    content((1.9, 1.85), [norm], anchor: "center")
    rect((0.6, 3.0), (3.2, 3.7), radius: 2pt, fill: white)
    content((1.9, 3.35), [$F_l$], anchor: "center")

    line((1.9, -0.5), (1.9, 0.0), mark: (end: ">"))
    line((1.9, 0.7), (1.9, 1.5), mark: (end: ">"))
    line((1.9, 2.2), (1.9, 3.0), mark: (end: ">"))
    line((1.9, 3.7), (1.9, 4.2), mark: (end: ">"))

    circle((1.9, 4.2), radius: 0.17, fill: white)
    line((1.73, 4.2), (2.07, 4.2), stroke: (paint: residual, thickness: 0.9pt))
    line((1.9, 4.03), (1.9, 4.37), stroke: (paint: residual, thickness: 0.9pt))
    line((1.9, 3.7), (1.9, 4.03), mark: (end: ">"))
    line((1.9, 4.37), (1.9, 4.8), mark: (end: ">"))
    bezier((1.9, -0.2), (2.05, 4.2), (3.3, -0.2), (3.3, 4.2),
      stroke: (paint: residual, thickness: 0.9pt), mark: (end: ">"))
    content((2.15, 4.85), [$bold(x)_(l+1)$], anchor: "south-west")
    content((1.9, -0.8), [$bold(x)_l$], anchor: "north")
    content((3.05, 1.85), [#text(9pt, [normalize]) #text(7pt, fill: muted, [inside branch])], anchor: "west")
  }),
  caption: [A pre-norm block. The branch normalizes its input, and the shortcut carries the residual stream to the addition unchanged.],
) <fig:block>

@fig:block shows the ordering that matters: norm first, then $F_l$, then add.

= What changes in practice

#table(
  columns: (auto, 1fr, 1fr),
  inset: 6pt,
  stroke: (x, y) => if y == 0 { (bottom: 1pt + rgb("#2563eb")) } else { 0pt },
  [*Property*], [*Post-norm*], [*Pre-norm*],
  [Warmup], [required], [optional],
  [Residual scale], [grows then shrinks], [grows monotonically],
  [Final norm], [implicit in every block], [added once before the head],
)

The last row is the usual surprise: removing normalization from the shortcut means the final
representation can have a large norm, so pre-norm models add a single `norm` before the output
head. That norm is cheap and does not affect the identity path used during training.

= Takeaways

- The residual stream is a shared bus; normalization belongs to the branch that writes to it.
- An identity path through depth is what makes deep stacks trainable without warmup.
- Pre-norm is not free: the last block's branch sees a larger input than the first, so a final
  normalization (and sometimes a smaller learning rate for late layers) is worth the tuning.
- Measure the residual norm per layer before blaming the optimizer: it is a one-line probe and it
  usually settles the argument.
