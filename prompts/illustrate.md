---
description: Illustrate a concept as a single annotated CeTZ figure in Typst
argument-hint: "<concept> [output.typ]"
---
Illustrate **$1** as one annotated CeTZ 0.5.2 diagram in a small Typst document.

Before drawing:
1. Read the `cetz-diagrams` and `typst-documents` skills.
2. Pick the figure type from the selection table: components, sequence, hierarchy, matrix, geometry, or 3D.

Deliverable (default `illustrations/<slug>.typ`, or `$2` when given):
- A single `canvas(length: 1cm, { ... })` inside a `figure` with a takeaway caption.
- Every element labeled; one visual grammar (same box style per role, same arrow style per relation, at most two colors that also differ in lightness).
- Labels use the same terms as the explanation that accompanies the figure.
- A short paragraph below the figure that states what to notice.

Process:
- Compile with `typst_compile` (`format: "png"`, `preview: "first"`) after each edit and look at the rendered image.
- Iterate until no label touches a border, no line crosses a filled shape, and nothing is cropped.
- Export a PDF as well and start `typst_preview`, reporting the URL.

Keep it to one figure unless the user asks for a sequence. Prefer clarity over decoration.
