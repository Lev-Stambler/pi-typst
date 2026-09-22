# Third-party reference bundle

The Markdown files in this directory are vendored from an upstream agent skill,
with small link fixes applied (see "Modifications" below).

## Source

- **Project:** `claude-skill-typst`
- **Repository:** https://github.com/lucifer1004/claude-skill-typst
- **Path:** `skills/typst/`
- **Author:** lucifer1004
- **License:** MIT — see [LICENSE](./LICENSE)
- **Vendored revision:** main branch as of 2026-09-22
- **Target:** Typst 0.15+

Vendored files: `academic.md`, `basics.md`, `cli.md`, `conversion.md`,
`debug.md`, `migration.md`, `package.md`, `perf.md`, `query.md`,
`styling.md`, `tables.md`, `template.md`, `types.md`.

Not vendored (available upstream): `data/` (large API dump), `scripts/`
(Python query tooling), `agents/`, `examples/`, and `SKILL.md` itself.

## Modifications

- Relative links to non-vendored upstream files were rewritten to absolute
  `github.com` URLs or annotated as "not vendored" so the docs stay navigable
  from inside this package.
- No prose was changed.

## License notice

```
MIT License

Copyright (c) 2026 lucifer1004

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
