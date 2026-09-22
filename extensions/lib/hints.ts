/**
 * Remediation hints for Typst/CeTZ diagnostics.
 *
 * CeTZ reports several common authoring mistakes with messages that point at the
 * wrong thing (a missing `import draw: *` surfaces as an argument error, a
 * shadowed `text` surfaces as a type error). Each rule below was produced by
 * compiling the mistake against CeTZ 0.5.2; see
 * `skills/cetz-diagrams/references/cetz-failure-modes.md` for the full catalog.
 */

import type { TypstDiagnostic } from "./typst.ts";

interface HintRule {
  /** Matches against `severity: message` for each diagnostic. */
  test: RegExp;
  hint: string;
}

const RULES: HintRule[] = [
  {
    test: /cannot add color and ratio/i,
    hint: "Colors do not support arithmetic: use .transparentize(ratio), .lighten(ratio), or .darken(ratio) instead of rgb(..) + ratio.",
  },
  {
    test: /Failed to resolve coordinate system/i,
    hint: 'content(..) reads two positional arguments as two coordinates. Pass one content value: content((x, y), [#text(9pt)[label]], anchor: "center").',
  },
  {
    test: /expected integer, found string/i,
    hint: 'The `mark` style value must be a dictionary: mark: (end: ">"). A bare symbol string only works as the positional argument of mark().',
  },
  {
    test: /cannot join array with (float|integer|string|ratio|length)/i,
    hint: "A helper both drew something and returned a value. Drawing helpers must return nothing; compute geometry in a separate pure function.",
  },
  {
    test: /expected function, found content/i,
    hint: "A parameter or variable is shadowing a Typst function (commonly `text`). Rename it, e.g. `label`.",
  },
  {
    test: /Anchor '[^']*' not in anchors/i,
    hint: 'Unknown anchor. Use compass names (north-east, …), "name.50%", or (name: "n", anchor: 30deg).',
  },
  {
    test: /cannot divide by zero/i,
    hint: "A CeTZ helper (often angle/right-angle) received collinear or identical points. Check that the vertex really forms that angle.",
  },
  {
    test: /unknown variable: (canvas|draw|cetz|tree|angle|decorations|palette)\b/,
    hint: 'The CeTZ import is missing or unnamed. Import the symbols explicitly: #import "@preview/cetz:0.5.2": canvas, draw (and import draw: * inside the canvas body).',
  },
  {
    test: /unknown variable: [0-9a-fA-F]{6}\b/,
    hint: "A color literal is being parsed as code: the CeTZ draw call is missing `import draw: *` in this scope (and the module-level CeTZ import).",
  },
  {
    test: /unexpected argument/i,
    hint: "If this is a CeTZ draw call, add `import draw: *` inside the canvas — without it the name resolves to a Typst built-in with a different signature.",
  },
  {
    test: /unclosed delimiter/i,
    hint: "Usually a Markdown-style bullet (`* item` — Typst lists use `-`), an unbalanced `$`, or an unbalanced bracket.",
  },
  {
    test: /a page number template must be present/i,
    hint: "Multi-page PNG/SVG export needs a {p} in the output path; typst_compile adds it automatically unless an explicit output is given.",
  },
];

const MAX_HINTS = 3;

/**
 * Return up to three deduplicated remediation hints for a diagnostic set.
 * `rawText` (usually the full stderr) is matched as a fallback so that messages
 * the short-format parser could not classify still produce a hint.
 */
export function diagnosticHints(diagnostics: TypstDiagnostic[], rawText = ""): string[] {
  const haystacks = diagnostics.map(
    (diagnostic) => `${diagnostic.severity}: ${diagnostic.message} ${diagnostic.notes.join(" ")}`,
  );
  if (rawText) haystacks.push(rawText);

  const hints: string[] = [];
  for (const haystack of haystacks) {
    for (const rule of RULES) {
      if (!rule.test.test(haystack)) continue;
      if (hints.includes(rule.hint)) continue;
      hints.push(rule.hint);
      if (hints.length >= MAX_HINTS) return hints;
    }
  }
  return hints;
}

/** Render hints as an indented block for tool results and HTTP error bodies. */
export function formatHints(hints: string[]): string {
  if (hints.length === 0) return "";
  return `Likely fix:\n${hints.map((hint) => `  - ${hint}`).join("\n")}`;
}
