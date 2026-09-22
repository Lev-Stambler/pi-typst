# Diagram layout rules

CeTZ places exactly what you ask for, so layout quality is arithmetic you can
do **before** compiling. The numbers below are measured against CeTZ 0.5.2 with
the default 11pt text.

## Text and box sizing

Measured text widths (Typst default font, proportional text):

| Font size | 19 characters | 30 characters (mixed case + spaces) | rule of thumb |
| --- | --- | --- | --- |
| 11pt | 3.45 cm | 5.17 cm | ≈ 0.018 cm/char |
| 10pt | 3.14 cm | 4.70 cm | ≈ 0.0165 cm/char |
| 9pt | 2.83 cm | 4.23 cm | ≈ 0.0150 cm/char |
| 8pt | 2.51 cm | 3.75 cm | ≈ 0.0132 cm/char |

So, before writing a box:

```typ
// "Multi-Head Attention" is 19 chars. At 10pt: 19 * 0.0165 = 3.14 cm of text.
// Add 25% padding -> 3.9 cm box. Boxes at 3.1 cm would overflow.
rect((1.45, 2.56), (4.55, 3.18), radius: 2pt, fill: rgb("#dbeafe"))
content((3.0, 2.87), text(10pt, [Multi-Head Attention]), anchor: "center")
```

- All-caps or wide text: use 0.020 cm/char at 10pt.
- Give a box at least 0.5 cm of vertical height per line of text at 10–11pt
  (0.62 cm is comfortable).
- Prefer shrinking the font (9–10pt) over widening the box when the diagram
  must stay narrow.

## Spacing conventions

| Gap | Value | Why |
| --- | --- | --- |
| Box → box (vertical) | 0.35–0.6 cm | room for an arrow plus its label |
| Arrow label clearance | 0.15–0.25 cm above the line | keeps text off the stroke |
| Bypass route from shapes | ≥ 0.3 cm from any shape edge; 1.0–1.5 cm from the spine | visually reads as a separate path |
| Legend entry | ≥ 0.9 cm wide, 0.4 cm row height | no collisions at 8–9pt |
| Canvas outer margin | 0.3–0.5 cm around all content | nothing clipped, and the figure does not touch page text |
| Rotated text | ≥ 0.35 cm from any edge | rotated glyph depth |

Consistency matters more than the exact values: choose one stage height, one
arrow style, and one label offset, then reuse them. A figure where every gap is
individually "optimal" looks accidental.

## Choosing the canvas

- Let the page size the canvas (`#set page(width: 15cm, height: auto)`), or set
  the page width slightly wider than the figure's extent. A fixed page that is
  narrower than the canvas crops the figure.
- `canvas(length: 1cm)` is the default choice; use `0.5cm` for dense diagrams
  (matrix cells, timelines) and `1.5–1.8cm` for small figures so labels stay
  legible.
- Coordinates are canvas units. A 10 × 4 figure in a 1 cm canvas is 10 cm × 4 cm
  of real estate; check that against the page width.
- `canvas(debug: true)` draws bounding boxes — the fastest way to find which
  element eats space.

## Color and emphasis

- Two colors are enough: one for structure (near-black strokes) and one accent
  for the thing the figure is about.
- Ramps: `accent.transparentize(100% - value * 100%)` gives a single-hue ramp
  that survives grayscale.
- Fills should be light (`#dbeafe`, `#f4f4f5`); strokes carry the structure.
- Semantic consistency across a document: same color = same concept, same box
  shape = same kind of thing.
- Never encode a distinction in hue alone; pair it with lightness, dash, or a
  label.

## Composition patterns

| Need | Pattern |
| --- | --- |
| Emphasis on one element | light fill on everything else, accent fill + stroke on the target |
| Backgrounds behind labels | `on-layer(-1, rect(...))` with `stroke: none` |
| Grouping without a box | `decorations.brace` under/beside the group, or a dashed `rect` |
| Region highlight | dashed `line(..., close: true)` or a translucent rect behind content |
| Repeating structure | one `set-style` per element type, then draw; avoid per-element styling |
| Labels on arrows | `content(midpoint, text(8pt)[...], anchor: "south")` using the arrow's own coordinates |
| Alignment | name the elements and connect with `line("a.east", "b.west")` instead of repeating hand-computed coordinates |

## Legibility checklist (apply to the rendered image)

1. Can every label be read without zooming at the page's print size?
2. Does each arrow touch the shape it points at, on the intended face?
3. Is any two-line label tighter than 0.4 cm line spacing?
4. Are the axis/node/edge labels present — no unlabeled elements?
5. Does the figure still make sense in grayscale?
6. Is the caption stating the takeaway rather than the mechanics?
