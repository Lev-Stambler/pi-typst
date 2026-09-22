# Third-party notices

`pi-typst` itself is MIT-licensed (see [LICENSE](./LICENSE)). It references and,
in one case, vendors third-party material.

## Vendored

| Project | License | Location | Notes |
| --- | --- | --- | --- |
| [claude-skill-typst](https://github.com/lucifer1004/claude-skill-typst) | MIT | `skills/typst-documents/references/vendor/claude-skill-typst/` | Curated subset of the Typst 0.15 reference docs, with link fixes. Full notice in that directory's `NOTICE.md`. |

## Referenced (not vendored)

These are excellent upstream projects and agent skills. They are linked from
the packaged skills rather than copied, so they stay fresh upstream.

| Project | License | Why it is referenced |
| --- | --- | --- |
| [typst](https://github.com/typst/typst) | Apache-2.0 | The compiler this package drives. |
| [CeTZ](https://github.com/cetz-package/cetz) | LGPL-3.0-or-later | The diagram package used for figures; packaged via Typst Universe as `@preview/cetz`. `skills/cetz-diagrams/references/cetz-api.md` condenses factual API information from CeTZ 0.5.2 — see its `NOTICE.md`. CeTZ itself is not redistributed. |
| [cetz-plot](https://github.com/cetz-package/cetz-plot) | LGPL-3.0-or-later | Plotting extension split out of CeTZ 0.4+; used for data figures. |
| [typst-cetz-skills](https://github.com/edoardob90/typst-cetz-skills) | no license declared | Claude skill with a CeTZ 0.4.2 reference. Linked for extra examples; do not copy from it. |
| [typst-cetz-skill](https://github.com/statzhero/typst-cetz-skill) | no license declared | Another CeTZ-focused agent skill; linked for comparison. |
| [typst-skills](https://github.com/apcamargo/typst-skills) | see upstream | Mirrors of the official Typst docs for agents. |
| [typst-skill](https://github.com/MoYeRanqianzhi/typst-skill) | see upstream | Layered reference docs + query tooling. |
| [typst-cheat-sheet](https://github.com/mewmew/typst-cheat-sheet) | 0BSD | Printable Typst cheat sheet. |
| [pi-typst-skill](https://github.com/Auda29/typst_skill) | Apache-2.0 | Skills-only pi package that nudges pi toward `.typ` artifacts; complementary to this one. |

CeTZ itself is not bundled: Typst resolves `#import "@preview/cetz:0.5.2"` from
the package registry on first compile and caches it locally.
