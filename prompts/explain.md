---
description: Explain a topic as a typeset Typst document with CeTZ diagrams
argument-hint: "<topic> [output-dir]"
---
Explain **$1** as a self-contained Typst document with real diagrams.

Before writing:
1. Read the `typst-explain-illustrate`, `cetz-diagrams`, and `typst-documents` skills (use the read tool on their SKILL.md files).
2. Decide the 3-6 takeaways the reader must leave with. If a takeaway needs data you do not have, say so instead of inventing numbers.

Deliverable (default `explain/<slug>/main.typ`, or `$2` when given):
- Title block and a two-sentence TL;DR that states the mechanism, not the topic.
- One section per takeaway, each with prose and, where the idea is structural or sequential, a CeTZ 0.5.2 figure drawn inline with `canvas(...)` and wrapped in a `figure` with a takeaway caption.
- At least one worked example or concrete number.
- A closing "Takeaways" list and an honest "Limitations" line where relevant.

Process:
- After each figure or section, call `typst_compile` with `format: "pdf"` and `preview: "first"`, then look at the returned page image and fix overlaps, cropping, and label collisions before continuing. Iterate at least twice.
- Export the final PDF next to the `.typ` file.
- Start `typst_preview` and report the URL so the document can be read in the browser.

Do not finish until the document compiles with zero errors and you have inspected the rendered pages.
