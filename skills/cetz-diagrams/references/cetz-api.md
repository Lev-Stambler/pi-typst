# CeTZ 0.5.2 API reference

Condensed from the CeTZ 0.5.2 source and manual (LGPL-3.0-or-later,
<https://github.com/cetz-package/cetz>). Signatures are exact; descriptions are
paraphrased. For the full manual see <https://cetz-package.github.io/docs> or
`manual.pdf` in the CeTZ repository.

## Imports

```typst
#import "@preview/cetz:0.5.2": canvas, draw            // core
#import "@preview/cetz:0.5.2": canvas, draw, tree      // + libraries
#import "@preview/cetz:0.5.2": canvas, draw, angle, decorations, palette
#import "@preview/cetz:0.5.2": canvas, draw, vector, matrix, coordinate, intersection
```

Inside a canvas body: `import draw: *` brings all draw functions into scope.
Libraries stay namespaced: `tree.tree(...)`, `angle.angle(...)`,
`decorations.brace(...)`, `palette.new(...)`.

Plotting is **not** part of CeTZ 0.5. It lives in the separate `cetz-plot`
package: `#import "@preview/cetz-plot:0.1.3": plot`.

## Canvas

```typst
canvas(length: 1cm, x: 1.0, y: 1.0, z: 1.0, baseline: none, debug: false,
       background: none, stroke: none, padding: none, body)
```

- `length` maps one coordinate unit to a physical length. Ratios are **not**
  accepted; wrap in `layout(size => canvas(length: size.width * ratio, ...))`.
- `debug: true` draws every element's bounding box, which is the fastest way to
  find what is eating space.
- Wrap in `figure(canvas(...), caption: [...])` to get numbering and refs.

## Coordinates

| Form | Meaning |
| --- | --- |
| `(1.5, 2)` | x, y (z defaults to 0) |
| `(1, 2, 3)` | x, y, z |
| `(x: 1, y: 2, z: 3)` | named components; omitted components keep the previous value |
| `(rel: (0.5, 0.5))` | relative to the current position; `to:` and `update:` override the base |
| `(angle: 45deg, radius: 1.5)` | polar, relative to the current position |
| `"name"` or `(name: "a", anchor: "north")` | an element's default anchor |
| `"name.south-east"` | a named anchor |
| `(name: "line", anchor: 50%)` | a path anchor, relative distance along the path |
| `(name: "circle", anchor: 30deg)` | a border anchor at an angle |
| `("a", 50%, "b")` | linear interpolation between two coordinates |
| `()` | the current position (updated by shapes and `move-to`) |
| `(element: "b", point: "a", solution: 0)` | intersection point of a ray with an element |
| `(horizontal: "a", vertical: "b")` | combine x of one coordinate with y of another |

`move-to((x, y))` sets the current position; `set-origin((x, y))` moves the
coordinate origin for everything after it.

## Shapes

```typst
line(..points-style, close: false, name: none)
circle(..points-style, name: none, anchor: none)          // style: radius: number | (rx, ry)
circle-through(a, b, c, name: none, anchor: none, ..style)
arc(position, start: auto, stop: auto, delta: auto, name: none, anchor: none, ..style)
arc-through(a, b, c, name: none, ..style)
rect(a, b, name: none, anchor: none, ..style)             // style: radius: number | ratio | dict
rect-around(..points-style, ignore-marks: false, ignore-hidden: false, ignore-floating: false, ignore-shapes: false)
grid(from, to, name: none, ..style)                       // style: step, shift, help-lines
content(..args-style, angle: 0deg, anchor: none, name: none)
bezier(start, end, ..ctrl-style, name: none)              // ctrl points come after start, end
bezier-through(start, pass-through, end, name: none, ..style)
catmull(..points-style, close: false, name: none)         // style: tension
hobby(..points-style, ta: auto, tb: auto, close: false, name: none)
polygon(origin, sides, angle: 0deg, name: none, anchor: none, ..style)
n-star(origin, sides, angle: 0deg, name: none, anchor: none, ..style)   // style: inner-radius, show-inner
mark(from, to, ..style)                                   // to: coordinate or angle
svg-path(name: none, anchor: none, ..commands-style)       // ("m"|"l"|"h"|"v"|"c"|"q"|"z"|"anchor", ...)
merge-path(body, join: true, ignore-marks: true, ignore-hidden: true, close: false, name: none, ..style)
compound-path(body, name: none, ..style)                   // sub-paths, supports holes with fill-rule
boolean(a, b, op: "difference", fill-rule-a: auto, fill-rule-b: auto, ..style)  // union/intersection/difference/xor
```

Key points:

- `line` accepts more than two points (a strip) and `close: true` to make a
  polygon. If the first or last coordinate is an element *name*, the line is
  shortened to the border intersection, so `line("a", "b")` connects two boxes
  cleanly.
- `bezier(start, end, ctrl1, ctrl2)` is cubic with two control points;
  `bezier(start, end, ctrl)` is quadratic. Control points come *after* the
  endpoints.
- `content` places untransformed Typst content. Two coordinates make a
  rectangle to fill (text box). `angle:` rotates it; a coordinate rotates it to
  point at that coordinate. `frame: "rect" | "circle"` and `padding` come from
  content styling.
- `arc` needs exactly two of `start`, `stop`, `delta`; `mode:` is
  `"OPEN" | "CLOSE" | "PIE"`.

## Styling

```typst
set-style(..style)          // set for everything after this point
fill(color)                 // shorthand for set-style(fill: ...)
stroke(stroke)              // shorthand for set-style(stroke: ...)
```

Style values cascade: function argument > element-type entry > global. A
dictionary value *merges* with the parent dictionary, a plain value replaces it.

```typst
set-style(
  stroke: (paint: rgb("#18181b"), thickness: 0.7pt, dash: "dashed", cap: "round", join: "round"),
  fill: rgb("#dbeafe"),
  content: (padding: 0.2, frame: "rect"),
  rect: (radius: 2pt),          // only rectangles
  mark: (end: ">", fill: white),
)
```

Style roots are the element names: `line`, `rect`, `circle`, `arc`, `grid`,
`content`, `polygon`, `n-star`, `group`, `mark`, `bezier`, ….

### Marks

Mark styling keys: `symbol`, `start`, `end`, `fill`, `stroke`, `scale`,
`length`, `width`, `inset`, `slant`, `harpoon`, `flip`, `reverse`, `pos`,
`offset`, `anchor` (`"tip"`, `"base"`, `"center"`), `shorten-to`.

Mnemonics: `>` (triangle), `<`, `<>` (diamond), `[]` (rect), `[`, `]`
(bracket), `|` (bar), `o` (circle), `+`, `x`, `*` (star), `)>`
(curved-stealth), `>>` (stealth), `)`. Named shapes: `triangle`, `stealth`,
`curved-stealth`, `bar`, `diamond`, `rect`, `bracket`, `circle`, `plus`, `x`,
`star`, `parenthesis`, `hook`. Register custom marks with `register-mark`.

```typst
line((0, 0), (2, 0), mark: (end: ">>", scale: 1.2, fill: rgb("#2563eb")))
line((0, 0), (2, 0), mark: (start: "<", end: ">", pos: 0.5))
```

## Groups, layers, intersections

```typst
group(body, name: none, anchor: none, ..style)   // scoped styling; owns its own anchors
scope(body)                                      // scoped state without a new element
anchor(name, position)                           // add a named anchor to the current group
copy-anchors(element, filter: auto)
on-layer(layer, body)                            // lower layers draw first
hide(body, bounds: false)                        // drawn nowhere, still resolvable
floating(body)                                   // drawn, but ignored for bounding boxes
intersections(name, ..elements, samples: 10, sort: none, ignore-marks: true)
for-each-anchor(name, callback, exclude: ())
```

- Everything after `intersections("i", ...)` can use `"i.0"`, `"i.1"`, ….
- `group(name: "g", ...)` exposes `"g.north-east"` and children as
  `"g.child.anchor"`.

## Transformations

```typst
set-transform(mat)                       // none resets to identity
transform(mat)
rotate(45deg)                            // or rotate(x: .., y: .., z: ..) / yaw/pitch/roll
translate(x: 1, y: 0.5, pre: false)      // or translate((1, 0.5))
scale(50%)                               // or scale(x: .., y: .., z: ..)
set-origin(coordinate)
move-to(coordinate)
set-viewport(from, to, bounds: (1, 1, 1))
```

Scale and rotate do not resize text unless `content` styling sets
`auto-scale: true`.

## 3D

```typst
ortho(x: 35.264deg, y: 45deg, z: 0deg, sorted: true, cull-face: none,
      reset-transform: false, flatten: false, body)
perspective(x: 35.264deg, y: 45deg, z: 0deg, distance: auto, sorted: true,
            cull-face: none, reset-transform: false, body)
on-xy(z: 0, body)     // draw in the plane z = <z>
on-xz(y: 0, body)     // draw in the plane y = <y>; body coordinates are (x, z)
on-zy(x: 0, body)     // draw in the plane x = <x>; body coordinates are (z, y)
```

All three plane helpers apply a rotation, so **only** 2-component coordinates
are meaningful inside them. Place 3D segments and content directly inside
`ortho`. Labels must live inside the projection, otherwise their anchors refer
to unprojected coordinates.

Conventional z-up scene that reads well:

```typst
ortho(x: 65deg, y: -35deg, {
  on-xz({ grid((0,0), (1.6,1.6), step: 0.4); line((0,0),(1.9,0), mark: (end: ">")) })
  on-xy({ line((0,0),(0,1.5), mark: (end: ">")) })          // vertical axis
  line((0,0,0), (1.1, 0.7, 0.95), mark: (end: ">"))          // 3D vector
})
```

## Libraries

### angle

```typst
angle.angle(origin, a, b, direction: "ccw", label: none, name: none, ..style)
angle.right-angle(origin, a, b, label: "•", name: none, ..style)
```

`direction:` is `"ccw"`, `"cw"`, `"near"`, or `"far"`. Style keys: `radius`
(number or ratio), `label-radius`. The `label` may be content or a function
that receives the angle value.

### tree

```typst
tree.tree(root, draw-node: auto, draw-edge: auto, direction: "down", grow: 1,
          spread: 1, name: none, node-layer: 0, edge-layer: 0, anchor: none,
          group-name-prefix: "node")
```

`root` is a nested array: `([root], ([child], [leaf]), [sibling])`. Callbacks
receive node dictionaries with `name`, `group-name`, `depth`, `n`, `content`.
`draw-node` must draw at `(0, 0)` and return elements; `draw-edge(parent,
child)` typically calls `line(parent.group-name, child.group-name)`.

### decorations

```typst
decorations.brace(start, end, name: none, ..style)
decorations.flat-brace(start, end, flip: false, debug: false, name: none, ..style)
decorations.zigzag(target, close: auto, name: none, ..style)
decorations.coil(target, close: auto, name: none, ..style)
decorations.wave(target, close: auto, name: none, ..style)
decorations.square(target, close: auto, name: none, ..style)
```

Brace style keys: `amplitude`, `thickness`, `pointiness`, `taper`,
`outer-inset`, `outer-curvyness`, `inner-outset`, `inner-curvyness`,
`outer-thickness`, `content-offset`, `flip`. Path decorations accept
`segments` or `segment-length`, `amplitude`, `start`, `stop` and a
`factor`/`tension` depending on the effect.

### palette

```typst
palette.new(base: base-style, colors: (), dash: ())
```

The returned function takes an index and returns a style dictionary:
`set-style(..p(2))`, or `red.with(stroke: true)` for stroke-only palettes.

## Pitfalls

1. `#import "@preview/cetz:0.5.2"` — always pin the version; CeTZ has breaking
   changes between minor versions and moved `plot` out in 0.4.
2. Colors do not support `rgb(...) + 50%`; use `.transparentize(50%)`,
   `.lighten(20%)`, or `.darken(20%)`.
3. `canvas(length: 1cm)` is mandatory for physical sizes; ratios are rejected.
4. `bezier(start, end, ctrl...)` takes endpoints first. Swapping them produces
   curves that cross the figure.
5. User-defined functions that both call draw functions and return a value
   (`x`) trigger "cannot join array with float". Compute coordinates in a pure
   helper and draw in the loop.
6. `content((), [...])` resolves to the *previous* coordinate. Use explicit
   `(0, 0)` inside callbacks such as `draw-node`.
7. Inside `ortho`, text and anchors must be placed inside the same projection.
8. Two positional arguments to `content` are read as two *coordinates* (a
   rectangle), not as coordinates plus content.
9. `plot` is not in CeTZ 0.5 — import `cetz-plot` separately.
10. Edges that connect named elements already shorten to the border
    intersection; adding explicit anchor names is usually unnecessary.
