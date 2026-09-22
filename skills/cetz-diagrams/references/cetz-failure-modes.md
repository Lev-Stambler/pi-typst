# CeTZ failure modes

Every entry below was produced by compiling the exact snippet against CeTZ
0.5.2. The `error` lines are quoted verbatim, so a compile failure can be
matched to its cause and fix without guessing. Read this file *before* writing a
figure, not after the first failed compile.

## 1. Compile errors: exact message → cause → fix

### `error: cannot add color and ratio`

```typ
fill: rgb("#dbeafe") + 50%      // ✗
fill: rgb("#dbeafe").transparentize(50%)   // ✓
```

CeTZ colors are Typst colors; arithmetic operators are not color blending. Use
`.transparentize(ratio)`, `.lighten(ratio)`, `.darken(ratio)`, or
`color.mix((a, b), ratio: t)`.

### `error: cannot join array with float` (or `with integer`)

```typ
let step(i) = {                 // ✗ a helper that draws *and* returns a value
  rect((i, 0), (i + 1, 1))
  i                             // returning `i` joins it with the rect elements
}
for i in range(3) { step(i) }

let x(i) = i                    // ✓ pure helper for geometry
for i in range(3) {
  rect((x(i), 0), (x(i) + 1, 1))
}
```

CeTZ draw functions return element arrays; Typst joins a block's expression
values. A block whose last statement is the draw call is fine — only an extra
returned value (a number, string, coordinate) breaks it.

### `error: unknown variable: canvas`

```typ
#import "@preview/cetz:0.5.2"            // ✗ imports the module as `cetz`, not `canvas`
#canvas(length: 1cm, { ... })

#import "@preview/cetz:0.5.2": canvas, draw   // ✓ named import
#canvas(length: 1cm, {
  import draw: *                                // ✓ and the canvas needs the draw functions
  rect((0, 0), (1, 1))
})
```

`#import "..."` binds the module under its file name (`cetz.canvas`, `cetz.draw`),
so a bare `canvas` is undefined. Valid forms:

```typ
#import "@preview/cetz:0.5.2": canvas, draw          // named (recommended)
#import "@preview/cetz:0.5.2" as cetz                // then cetz.canvas(...), cetz.draw.line(...)
#import "@preview/cetz:0.5.2": canvas, draw, tree, angle, decorations, palette
```

The same mistake appears as `unknown variable: draw`, `tree`, `angle`,
`decorations`, or `palette` for the other entry points.

### `error: unexpected argument`

```typ
canvas(length: 1cm, {
  rect((0, 0), (1, 1))          // ✗ `rect` resolves to Typst's layout rect
})
```

Copy-pasting a recipe into a module (or a nested scope) without
`import draw: *` silently resolves names to Typst built-ins. Every scope that
draws needs the import:

```typ
#import "@preview/cetz:0.5.2": draw     // module level
#canvas(length: 1cm, {
  import draw: *                          // canvas level
})
```

### `panic: Failed to resolve coordinate system: [a]`

```typ
content((0, 0), [a], text(8pt)[b])       // ✗
content((0, 0), [#text(8pt)[a] // text(8pt)[b]], anchor: "center")   // ✓
```

`content(..args-style)` treats **two positional arguments as two
coordinates** (a rectangle to fill). Content must be a single value; combine
fragments with `#text(...)`, `\`, or a content block.

### `error: expected integer, found string`

```typ
line((0, 0), (1, 0), mark: ">")          // ✗
line((0, 0), (1, 0), mark: (end: ">"))   // ✓
mark((0, 0), (1, 0), ">")                // ✓ the mark *shape* takes it positionally
```

The `mark` style key is a dictionary (`start`/`end`/`symbol`, plus `scale`,
`fill`, …). A bare string works only as the positional argument of `mark()`.

### `error: Incorrect type for body: content`

```typ
canvas(length: 1cm, {
  text(10pt)[hello]             // ✗ bare content is not a draw element
})
```

Wrap text in `content(coord, text(10pt)[...], anchor: ...)` inside a canvas.

### `panic: Anchor 'x' not in anchors (...) for element 'y'`

Unknown anchor name. Valid names come in three families:

- compass: `center`, `north`, `south`, `east`, `west`, `north-east`,
  `north-west`, `south-east`, `south-west`;
- path: `start`, `mid`, `end`, plus `"name.50%"` / `(name: "l", anchor: 50%)`
  or an absolute distance;
- border angles: `(name: "c", anchor: 30deg)`;
- element-specific: e.g. `arc-start`, `arc-end`, `ctrl-0` (bezier), `pt-2`
  (catmull/hobby), `a`/`b`/`c` (circle-through, angle).

### `assertion failed: Rotate takes a single z-angle or angles (x, y, z or yaw, pitch, roll)`

```typ
rotate(45deg, 10deg)                     // ✗
rotate(45deg)                            // ✓
rotate(x: 30deg, y: 10deg)               // ✓
scale(1, 2)                              // ✗
scale(x: 1, y: 2)                        // ✓ or scale(2)
translate((1, 2))                        // ✓ or translate(x: 1, y: 2)
```

### `error: expected function, found content`

```typ
let hint(y, text) = {                    // ✗ the parameter shadows Typst's text()
  content((4.8, y), text(8pt, text))
}
```

Helper parameters that share a name with a Typst or CeTZ function shadow it for
the whole body. Names to avoid: `text`, `rect`, `line`, `grid`, `content`,
`circle`, `arc`, `polygon`, `fill`, `stroke`, `mark`, `anchor`, `group`,
`scale`, `rotate`, `translate`, `box`, `block`, `place`, `image`, `table`,
`figure`, `angle`, `tree`, `decorations`. Use `label`, `title`, `caption`,
`value`, `fill-color`, `size`.

### `cannot divide by zero` (from CeTZ internals)

```typ
angle.right-angle("hyp.end", "base.end", "side.end", radius: 0.3)   // ✗ degenerate directions
```

`angle` helpers compute a direction vector between `origin` and `a`/`b`; if the
points are collinear with the origin (or identical), the normalisation divides
by zero. The error points into `vector.typ`, not at your figure. Check that the
vertex really is a right angle and that `a` and `b` are distinct points on the
two sides.

### `error: unclosed delimiter`

Almost always Typst, not CeTZ: a Markdown-style bullet (`* item`), an
unbalanced `$`, or an unbalanced `[`/`(`. Bisect by deleting half the figure.

### `panic: Unknown element X in elements (...)`

`for-each-anchor("x", ...)` or `intersections("i", "x", ...)` referenced an
element `name` that does not exist yet — the name must be created earlier in the
same canvas (and `copy-anchors` may only be used inside a `group`).

## 2. Silent failures: compiles fine, looks wrong

These cost the most iterations, because only the rendered image reveals them.

| Symptom | Cause | Prevention |
| --- | --- | --- |
| Label spills past its box | box narrower than the text | size boxes from the text: `cm ≈ 0.016 × pt × chars` (19 chars at 10pt ≈ 3.0cm; add 25%) |
| A label floats off its shape | `content((), ...)` inside a callback (`draw-node`, `for-each-anchor`) resolves to the *previous* coordinate | pass `(0, 0)` explicitly |
| Figure cropped at the page edge | fixed `#set page(width: ...)` narrower than the canvas | omit `width` (auto) or match it to the canvas extent |
| A curve cuts through boxes | control points placed between the endpoints | route bypasses **outside** the shapes: control points at `spine ± 1.2` or more, and keep ≥ 0.3 cm clearance |
| Arrows point at the wrong face | relying on the default anchor of a rotated/odd shape | use explicit anchors: `line("a.east", "b.west", mark: (end: ">"))` |
| Rotated label intersects a shape | 90°/45° text has depth equal to its height | keep ≥ 0.35 cm from any edge, or place it outside the canvas content and let the canvas grow |
| Legend entries collide | estimating text widths | place legends in a reserved band (`on-layer(-1, rect(...))`) with ≥ 0.9 cm per entry, or stack them vertically |
| Two colors indistinguishable in print | hue-only difference | vary lightness as well (`#dbeafe` vs `#1d4ed8`), never two similar mid-tones |
| Diagram looks "off" but nothing is wrong | no baseline grid: boxes and arrows at inconsistent x/y | pick a spine (one x), a step (one y delta), and reuse them |
| 3D figure is unreadable | too many overlapping planes/edges at the default isometric angles | pick angles that separate the axes (`ortho(x: 65deg, y: -35deg)` reads well), and keep labels inside the projection |

## 3. Pre-flight checklist

Run this mentally before the first compile. Each line maps to a failure above.

1. Every module and scope that draws imports CeTZ (`#import ... : draw`, then
   `import draw: *` inside the canvas).
2. All coordinates are canvas units in one consistent system; no mixing of
   page lengths and canvas units except for `canvas(length: ...)`.
3. No color arithmetic; ramps use `.transparentize()` / `.lighten()`.
4. Every `bezier` is `(start, end, ctrl1, ctrl2)` in that order, with control
   points outside the obstacle.
5. No helper both draws and returns a value.
6. `content()` uses a single content argument; callbacks use explicit `(0, 0)`.
7. Each box is at least `0.016 × pt × chars` cm wide.
8. Legends, axis labels, and rotated text have reserved space; nothing is
   within 0.3 cm of a shape it does not belong to.
9. Colors differ in lightness, not only hue.
10. The page width either matches the canvas or is left automatic.

## 4. Recovery: compile failed

Typst reports the first error with `file:line:column`. Work in this order:

1. Read the message and match it in section 1. Do not re-read the whole file.
2. Fix only that line, then recompile. Typst stops at the first error, so
   several errors may be hidden behind it.
3. When the file compiles, *look at the rendered page image* and work through
   section 2's table. That pass is about geometry, not syntax.
4. Recompile after each fix. Budget: one syntax pass plus one or two layout
   passes for a simple figure; anything longer means a missing piece from the
   pre-flight checklist.

## 5. Recovery: no diagnostics are helpful

`#panic("here")` / `content((0, 0), [#repr(some-value)])` inside the canvas is
the fastest way to inspect a live value (a resolved coordinate, a counter, a
style dictionary). Remove the probe before the final compile.

For previewing *without* recompiling the document, `typst_compile` with
`format: "png"` and `preview: "first"` renders only page 1 — cheaper than a
full PDF when you are iterating on one figure.
