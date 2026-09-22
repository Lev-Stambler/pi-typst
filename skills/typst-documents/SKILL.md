---
name: typst-documents
description: Write and debug Typst (.typ) documents with the typst_compile, typst_cli, and typst_preview tools — document structure, math, tables, figures, cross-references, page setup, and the syntax traps that break compilation. Use when creating or editing a .typ file, exporting a PDF, or converting Markdown/LaTeX content to Typst.
---

# Typst documents

Use the bundled tools instead of shelling out: `typst_compile` resolves the
binary, parses diagnostics into readable errors, and returns a page image;
`typst_preview` serves that CLI-compiled PDF live in a browser (typst.ts in the
browser is the no-CLI fallback); `typst_cli` covers `eval`, `query`, `fonts`,
and `init`.

Vendored reference set (Typst 0.15): `references/vendor/claude-skill-typst/`.
Route to it rather than guessing:

| Need | Read |
| --- | --- |
| Markup, code mode, functions, control flow | `basics.md` |
| Data types, operators, string/array methods | `types.md` |
| Page layout, headings, figures, fonts | `styling.md` |
| Tables, grids, spans, borders | `tables.md` |
| Papers, bibliography, theorems, equations | `academic.md` |
| Markdown/LaTeX conversion | `conversion.md` |
| 0.15 breaking changes | `migration.md` |
| CLI flags and build recipes | `cli.md` |
| Metadata, `eval`, multi-pass builds | `query.md` |
| Debugging techniques and symbol gotchas | `debug.md` |
| Compile timing | `perf.md` |
| Reusable template functions | `template.md` |
| Packages and `typst.toml` | `package.md` |

## Minimal document

```typst
#set page(paper: "us-letter", margin: 2.1cm, numbering: "1")
#set par(justify: true)

= Title

Body text with *bold*, _emphasis_, `code`, and math $E = m c^2$.

== Section

- Lists use a dash, not an asterisk.
- References look like @fig:block.
```

## Structure for explainers and reports

1. Title block (title, author, date) and a one-paragraph TL;DR in a shaded
   `block` when the reader needs the conclusion first.
2. Numbered sections with one idea each; figures close to the text that uses
   them.
3. `figure(canvas(...), caption: [...]) <fig:name>` plus `@fig:name` in prose.
4. A results table with explicit units and the baseline in the first row.
5. A short "Takeaways"/"Limitations" list that a busy reader can skim.
6. Optional `#outline()` after the title for documents longer than a few pages.

## Language essentials

- Markup mode is plain text; `#` switches to code, `[...]` is a content block.
- Statements: `#let x = 1`, `#if cond [...]`, `#for item in items [...]`.
- Styling: `#set text(size: 10pt)` applies forward; `#show heading: it => ...`
  transforms elements.
- Math: `$ inline $` and `$ display $`; multi-letter names need `op(...)` or
  quotes (`op("softmax")`, `"vs"`), and symbols use their Typst names
  (`plus.minus`, not `pm`).
- Figures: PNG, JPEG, GIF, SVG, WebP, and PDF images are supported in 0.15.
- Tables: `#table(columns: (auto, 1fr), [a], [b])`.
- Bibliography: `#bibliography("refs.bib")` with `@key` citations.
- Labels and refs: attach `<fig:block>` to a figure, reference it as
  `@fig:block`. There is no `#ref(...)` function.

## Verified traps and fixes

| Trap | Symptom | Fix |
| --- | --- | --- |
| `* *text*` used as a bullet | `unclosed delimiter` | Bullets start with `-`; `*` is emphasis |
| `#ref(fig:x)` | `unknown variable: ref` | Use `@fig:x` and `<fig:x>` |
| `$ pm $`, `$ ID $`, `$ argmax $`, `$ softmax $`, `$ vs $` | `unknown variable` | `plus.minus`, `op("ID")`, `op("argmax")`, `op("softmax")`, `"vs"` |
| `\@` inside text | — works | Use `\@` or `#raw("a@b")` for literal at-signs |
| PNG/SVG export of a multi-page document without a page template | `a page number template must be present` | Name outputs `name-{p}.png`; `typst_compile` adds this automatically |
| Unbalanced `$` | `unclosed delimiter` with no line number | Bisect by deleting half the file |
| HTML export | warnings and failures | Treat as experimental; export PDF or SVG instead |
| `#image("figure.pdf")` | — works in 0.15 | Still prefer PNG/SVG for browser previews |
| Cite keys containing `---` | mangled key | Rename the key in the `.bib` file |

Pi's own `edit`/`write` tools are the way to change `.typ` files; after every
edit, compile.

## Verification

1. `typst_compile` with `preview: "first"` — read the diagnostics and look at
   the returned image.
2. Check that every `@ref` resolves (Typst errors on unknown labels, so a clean
   compile already proves this).
3. For multi-page work, export PNG pages `1-2` (or the relevant pages) and
   inspect them; page breaks and widows are invisible in the source.
4. If the user will read the document, start `typst_preview` and report the URL.
