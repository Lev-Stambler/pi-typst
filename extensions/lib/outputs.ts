/**
 * Output-path helpers for the `typst_compile` tool.
 *
 * Kept separate from the extension entry so they can be unit tested without a
 * pi session: page-number templates, default outputs, and expanding a `{p}`
 * pattern back into the files Typst actually wrote.
 */

import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Add a `{p}` page template to png/svg outputs, which emit one file per page. */
export function withTagPattern(output: string, format: string): string {
  if (format !== "png" && format !== "svg") return output;
  if (output.includes("{p}") || output.includes("{0p}") || output.includes("{t}")) return output;
  const match = output.match(/^(.*?)(\.[A-Za-z0-9]+)$/);
  if (!match) return output;
  return `${match[1]}-{p}${match[2]}`;
}

/** Default output path for a document and format. */
export function defaultOutput(input: string, format: string): string {
  const base = input.replace(/\.typ$/i, "");
  if (format === "png" || format === "svg") return `${base}-{p}.${format}`;
  return `${base}.${format}`;
}

/**
 * Expand a Typst output pattern (`name-{p}.png`, `name-{0p}-of-{t}.png`, or a
 * plain path) into the files that exist on disk, plus their total size.
 *
 * Only the pattern's directory is listed; the directory is never walked
 * recursively, so a stray `{p}` in a filename cannot match another directory.
 */
export async function listOutputs(pattern: string, cwd: string): Promise<{ files: string[]; bytes: number }> {
  if (!pattern.includes("{p}") && !pattern.includes("{0p}") && !pattern.includes("{t}")) {
    const info = await stat(pattern).catch(() => null);
    return { files: info?.isFile() ? [pattern] : [], bytes: info?.size ?? 0 };
  }

  const dir = resolve(cwd, pattern, "..");
  const base = pattern.split(/[\\/]/).pop() ?? pattern;
  const escaped = base
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\{0?p\\\}/g, "\\d+")
    .replace(/\\\{t\\\}/g, "\\d+");
  const re = new RegExp(`^${escaped}$`);

  const entries = await readdir(dir).catch(() => [] as string[]);
  const files: string[] = [];
  let bytes = 0;
  for (const entry of entries) {
    if (!re.test(entry)) continue;
    const info = await stat(join(dir, entry)).catch(() => null);
    if (!info?.isFile()) continue;
    files.push(join(dir, entry));
    bytes += info.size;
  }
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { files, bytes };
}

/** Truncate long CLI output before handing it back to the model. */
export function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n... (${text.length - limit} more characters truncated)`;
}
