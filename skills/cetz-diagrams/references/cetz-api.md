# CeTZ 0.5.2 API reference

Condensed from the CeTZ 0.5.2 source and manual (LGPL-3.0-or-later,
<https://github.com/cetz-package/cetz>); see [NOTICE.md](NOTICE.md) for
provenance. Signatures, style keys with defaults, and anchor names are exact.
For the narrative manual see <https://cetz-package.github.io/docs> or
`manual.pdf` in the CeTZ repository. Runnable versions of most patterns:
[cetz-recipes.md](cetz-recipes.md). Error catalog:
[cetz-failure-modes.md](cetz-failure-modes.md).

## Imports and module hygiene

```typ
#import "@preview/cetz:0.5.2": canvas, draw                 // core
#import "@preview/cetz:0.5.2": canvas, draw, tree           // + libraries
#import "@preview/cetz:0.5.2": canvas, draw, angle, decorations, palette
#import "@preview/cetz:0.5.2": canvas, draw, vector, matrix, coordinate, intersection
```

Inside a canvas body: `import draw: *` brings the draw functions into scope.
Libraries stay namespaced: `tree.tree(...)`, `angle.angle(...)`,
`decorations.brace(...)`, `palette.new(...)`.

**Every module and every nested scope that draws needs both imports.** Without
them, names resolve to Typst built-ins and the errors point at arguments
(`unexpected argument`, `unknown variable: dbeafe`) rather than at the missing
import. See failure-mode #3.

Plotting is not part of CeTZ 0.5: `#import "@preview/cetz-plot:0.1.3": plot`.

## Canvas

```typ
canvas(length: 1cm, x: 1.0, y: 1.0, z: 1.0, baseline: none, debug: false,
       background: none, stroke: none, padding: none, body)
```

- `length` maps one coordinate unit to a physical length. Ratios are rejected;
  wrap in `layout(size => canvas(length: size.width * ratio, ...))`.
- `debug: true` outlines every element's bounding box — fastest way to find what
  eats space.
- Wrap in `figure(canvas(...), caption: [...])` for numbering and refs.

## Coordinates

| Form | Meaning |
| --- | --- |
| `(1.5, 2)` | x, y (z defaults to 0) |
| `(1, 2, 3)` | x, y, z |
| `(x: 1, y: 2, z: 3)` | named components; omitted components keep the previous value |
| `(rel: (0.5, 0.5))` | relative to the current position (`to:`, `update:` override the base) |
| `(angle: 45deg, radius: 1.5)` | polar, relative to the current position |
| `"name"` / `(name: "a", anchor: "north")` | an element's default anchor |
| `"name.south-east"` | named anchor |
| `(name: "line", anchor: 50%)` | path anchor by relative distance |
| `(name: "circle", anchor: 30deg)` | border anchor by angle |
| `("a", 50%, "b")` | linear interpolation between two coordinates |
| `()` | current position (updated by shapes and `move-to`) |
| `(element: "b", point: "a", solution: 0)` | intersection of a ray with an element |
| `(horizontal: "a", vertical: "b")` | x from one coordinate, y from another |
| `(rel: (1, 0), to: "a")` | relative to a named element instead of the cursor |

`move-to(pt)` sets the current position; `set-origin(coord)` moves the origin
for everything after it. Distances in path anchors can be absolute
(`50pt`, `0.5`) or relative (`50%`).

## Draw functions

`style` below lists keys accepted by that element (defaults in parentheses).
Elements without a note support the shared `stroke`, `fill`, `fill-rule`
styling.

| Function | Signature | Style keys | Anchors |
| --- | --- | --- | --- |
| `line` | `line(..pts-style, close: false, name: none)` | shared + mark | `start`, `mid`, `end`, `50%`, `centroid` (closed) |
| `circle` | `circle(..points-style, name: none, anchor: none)` | `radius` (1) number or `(rx, ry)` | border, path, `center` |
| `circle-through` | `circle-through(a, b, c, name: none, anchor: none, ..style)` | shared | `a`, `b`, `c`, border |
| `arc` | `arc(position, start: auto, stop: auto, delta: auto, name: none, anchor: none, ..style)` | `radius` (1), `mode` (`"OPEN"`/`"CLOSE"`/`"PIE"`), `update-position` (true) | `arc-start`, `arc-end`, `arc-center`, `center`, `chord-center`, `origin` |
| `arc-through` | `arc-through(a, b, c, name: none, ..style)` | as `arc` | as `arc` |
| `rect` | `rect(a, b, name: none, anchor: none, ..style)` | `radius` (0) number/ratio/dict per corner | border, path, `center` |
| `rect-around` | `rect-around(..pts-style, ignore-marks: false, ignore-hidden: false, ignore-floating: false, ignore-shapes: false)` | `padding` + `rect` keys | as `rect` |
| `grid` | `grid(from, to, name: none, ..style)` | `step` (1) number/array/dict, `shift` (0), `help-lines` (false) | border |
| `content` | `content(..args-style, angle: 0deg, anchor: none, name: none)` | `padding` (0), `frame` (`none`/`"rect"`/`"circle"`), `auto-scale` (false), `wrap` (none) | `mid`, `mid-east`, `mid-west`, `base`, `base-east`, `base-west`, `text`, border |
| `bezier` | `bezier(start, end, ..ctrl-style, name: none)` | shared + mark | `ctrl-n` (0-based), path |
| `bezier-through` | `bezier-through(start, pass-through, end, name: none, ..style)` | as `bezier` | as `bezier` |
| `catmull` | `catmull(..pts-style, close: false, name: none)` | `tension` (0.5) | `pt-n`, `start`/`mid`/`end` |
| `hobby` | `hobby(..pts-style, ta: auto, tb: auto, close: false, name: none)` | `omega` ((1, 1)) | `pt-n`, `start`/`mid`/`end` |
| `polygon` | `polygon(origin, sides, angle: 0deg, name: none, anchor: none, ..style)` | `radius` (1) | border, `center` |
| `n-star` | `n-star(origin, sides, angle: 0deg, name: none, anchor: none, ..style)` | `radius`, `inner-radius`, `show-inner` (false) | border, `center` |
| `mark` | `mark(from, to, ..style)` | mark keys; a positional symbol string is allowed | — |
| `svg-path` | `svg-path(name: none, anchor: none, ..commands-style)` | shared | `"anchor"` commands |
| `merge-path` | `merge-path(body, join: true, ignore-marks: true, ignore-hidden: true, close: false, name: none, ..style)` | shared + mark | `centroid` (closed) |
| `compound-path` | `compound-path(body, name: none, ..style)` | `fill-rule` | `centroid` (closed) |
| `boolean` | `boolean(a, b, op: "difference", fill-rule-a: auto, fill-rule-b: auto, ..style)` | `union`/`intersection`/`difference`/`xor` | as path |

Details that change the code you write:

- `line` accepts a point list (`line((0,0), (1,1), (2,0))`), `close: true` to
  close a strip into a polygon, and element **names** as endpoints
  (`line("a", "b")` shortens to the border intersection).
- `bezier(start, end, ctrl1, ctrl2)` — endpoints first, then control points.
  One control point makes it quadratic. Swapping endpoints and controls produces
  curves that cross the figure.
- `rect(a, b, rel: (w, h))` sizes a box relative to `a`; `radius` accepts a
  dictionary keyed by `north`, `east`, `south`, `west`, the four diagonals, or
  `rest`.
- `content` with **two coordinates** fills the rectangle between them; two
  positional *content* values are a mistake (see failure-mode #4).
- `arc` needs exactly two of `start`, `stop`, `delta`.
- `svg-path` commands: `("m"|"l", coord)`, `("h"|"v", number)`,
  `("c", ctrl-a, ctrl-b, coord)`, `("q", ctrl, coord)`, `("z",)`,
  `("anchor", "name", coord)`.
- `intersections(name, ..elements)` creates `name.0`, `name.1`, …; pass element
  *names* to intersect without drawing them again; wrap in `hide()` to use them
  only for anchors.

## Styling

```typ
set-style(..style)   // forward-applying, like Typst's `set`
fill(color)          // shorthand for set-style(fill: ...)
stroke(stroke)       // shorthand for set-style(stroke: ...)
```

Precedence: function argument > element-type entry > global. Dictionary values
merge with the parent dictionary; plain values replace it.

```typ
set-style(
  stroke: (paint: rgb("#18181b"), thickness: 0.7pt, dash: "dashed", cap: "round", join: "round"),
  fill: rgb("#dbeafe"),
  content: (padding: 0.2, frame: "rect"),
  rect: (radius: 2pt),
  mark: (end: ">", fill: white),
)
```

Style roots are element names: `line`, `rect`, `circle`, `arc`, `grid`,
`content`, `polygon`, `n-star`, `group`, `mark`, `bezier`, `angle`, `tree`,
`brace`, …

Colors: `.transparentize(ratio)`, `.lighten(ratio)`, `.darken(ratio)`,
`color.mix((a, b), ratio: t)`. Typst's `+` / `*` on colors is an error.

### Marks

Mark keys: `symbol`, `start`, `end`, `fill`, `stroke`, `scale`, `length`,
`width`, `inset`, `slant`, `harpoon`, `flip`, `reverse`, `pos`, `offset`,
`anchor` (`"tip"`/`"base"`/`"center"`), `shorten-to`, `sep`, `xy-up`, `z-up`.

Mnemonics: `>` ` <` `<>` (diamond) `[]` (rect) `[` `]` (bracket) `|` (bar)
`o` (circle) `+` `x` `*` (star) `)>` (curved-stealth) `>>` (stealth) `)`.

```typ
line((0, 0), (2, 0), mark: (end: ">>", scale: 1.2, fill: rgb("#2563eb")))
line((0, 0), (2, 0), mark: (start: "<", end: ">", pos: 0.5))
mark((0, 0), (1, 1), ">>", scale: 2)      // the mark *shape* takes a positional symbol
```

`register-mark(symbol, body, mnemonic: .., tip: .., base: .., center: ..,
reverse-tip: .., reverse-base: .., reverse-center: ..)` adds custom marks.

## Groups, layers, intersections

```typ
group(body, name: none, anchor: none, ..style)     // scoped styling; own anchors
scope(body)                                        // scoped state, no new element
anchor(name, position)                             // add an anchor to the current group
copy-anchors(element, filter: auto)                // inside a group only
on-layer(layer, body)                              // lower layers draw first
hide(body, bounds: false)                          // invisible, still resolvable
floating(body)                                     // drawn, ignored for bounding boxes
intersections(name, ..elements, samples: 10, sort: none, ignore-marks: true)
for-each-anchor(name, callback, exclude: ())
```

- Out-of-sight/geometry helpers are cleanest as `hide(...)` + `intersections`.
- A named group exposes `"g.north-east"` and its children as `"g.child.anchor"`.
- Custom anchors (`anchor("x", (1, 1))`) are the tidiest way to attach several
  arrows or braces to one logical point.

## Transformations

```typ
set-transform(mat)                        // none resets to identity
transform(mat)                            // multiply onto the current matrix
rotate(45deg)                             // or rotate(x: .., y: .., z: ..) / yaw/pitch/roll
translate(x: 1, y: 0.5, pre: false)       // or translate((1, 0.5))
scale(50%)                                // or scale(x: .., y: .., z: ..)
set-origin(coordinate)
move-to(coordinate)
set-viewport(from, to, bounds: (1, 1, 1))
transform(matrix.transform-rotate-z(30deg))
```

`rotate` takes **one** positional angle or named axes; `scale` takes one value
or named axes. Text does not scale unless `content` styling sets
`auto-scale: true`. `matrix.*` helpers (`ident`, `transform-rotate-x/y/z`,
`transform-scale`, `transform-translate`, `mul-mat`) build matrices;
`vector.add/sub/len/dist/scale/div/neg/as-vec/as-mat` operate on vectors.

## 3D

```typ
ortho(x: 35.264deg, y: 45deg, z: 0deg, sorted: true, cull-face: none,
      reset-transform: false, flatten: false, body)
perspective(x: 35.264deg, y: 45deg, z: 0deg, distance: auto, sorted: true,
            cull-face: none, reset-transform: false, body)
on-xy(z: 0, body)     // plane z = <z>; body coordinates are (x, y)
on-xz(y: 0, body)     // plane y = <y>; body coordinates are (x, z)
on-zy(x: 0, body)     // plane x = <x>; body coordinates are (z, y)
```

`ortho` applies rotation then an orthographic projection; `perspective` adds
perspective division. The three plane helpers *rotate the body*, so only
2-component coordinates are meaningful inside them (a third component is
accepted and effectively ignored — do not rely on it). 3D segments and labels go
directly inside `ortho`; labels must be inside the projection or their anchors
refer to unprojected coordinates.

A scene that reads well (see recipe 12):

```typ
ortho(x: 65deg, y: -35deg, {
  on-xz({ grid((0, 0), (1.6, 1.6), step: 0.4) })          // ground plane
  on-xy({ line((0, 0), (0, 1.5), mark: (end: ">")) })      // vertical axis
  line((0, 0, 0), (1.1, 0.7, 0.95), mark: (end: ">"))      // 3D vector
})
```

## Libraries

### angle

```typ
angle.angle(origin, a, b, direction: "ccw", label: none, name: none, ..style)
angle.right-angle(origin, a, b, label: "•", name: none, ..style)
```

`direction`: `"ccw"`, `"cw"`, `"near"`, `"far"`. Style: `radius` (0.5 number or
ratio), `label-radius` (50%). Anchors `a`, `b`. `label` may be content or a
function receiving the angle value. Both functions normalise direction vectors,
so collinear/identical points cause a divide-by-zero inside `vector.typ`.

### tree

```typ
tree.tree(root, draw-node: auto, draw-edge: auto, direction: "down", grow: 1,
          spread: 1, name: none, node-layer: 0, edge-layer: 0, anchor: none,
          group-name-prefix: "node")
```

`root` is a nested array: `([root], ([child], [leaf]), [sibling])`. Callbacks
receive `name`, `group-name`, `depth`, `n`, `content`. `draw-node` must draw at
`(0, 0)` (use an explicit `(0, 0)`, never `()`), and `draw-edge(parent, child)`
usually calls `line(parent.group-name, child.group-name)`. Node anchors are
`"0"`, `"0-0"`, `"0-1"`, … for direct positioning.

### decorations

```typ
decorations.brace(start, end, name: none, ..style)
decorations.flat-brace(start, end, flip: false, debug: false, name: none, ..style)
decorations.zigzag(target, close: auto, name: none, ..style)
decorations.coil(target, close: auto, name: none, ..style)
decorations.wave(target, close: auto, name: none, ..style)
decorations.square(target, close: auto, name: none, ..style)
```

Brace keys: `amplitude` (0.25cm / 0.3 flat), `thickness` (0.015cm),
`pointiness` (50%), `taper` (true), `outer-inset`, `outer-curvyness`,
`inner-outset`, `inner-curvyness`, `outer-thickness` (0), `content-offset`
(0.3), `flip`; flat braces add `aspect` (50%), `curves`, `outer-curves`.
Path effects share `segments`/`segment-length`, `amplitude`, `start`, `stop`
and take `factor` (zigzag 100%, coil 150%, square 50%) or `tension`
(wave 0.5). They take a *drawable* (often `line(...)`) as `target`.

### palette

```typ
palette.new(base: base-style, colors: (), dash: ())
```

Returns `p(i)` producing a style dictionary: `set-style(..p(2))`, or
`red.with(stroke: true)` for stroke-only palettes.

## Pitfalls (quick list)

The full catalog with exact error messages is
[cetz-failure-modes.md](cetz-failure-modes.md).

1. Pin `@preview/cetz:0.5.2`; plotting lives in `cetz-plot`.
2. No color arithmetic — use `.transparentize()` / `.lighten()`.
3. `bezier(start, end, ctrl…)`: endpoints first.
4. Helpers must either draw or compute, never both.
5. `content()` takes one content value; callbacks use `(0, 0)`.
6. Don't name parameters after Typst/CeTZ functions (`text`, `rect`, `line`, …).
7. `mark:` is a dictionary; only `mark()` accepts a positional symbol.
8. `canvas(length:)` needs a length, never a ratio.
9. `rotate`/`scale` take one positional value or named axes.
10. Text width ≈ `0.0165 × pt × chars` cm — size boxes from it.
