/**
 * Argument parsing for the `/typst-preview` command.
 *
 * Split into its own module so the parsing rules (and their error messages) are
 * unit tested without a live pi session.
 */

export interface PreviewArgs {
  doc?: string;
  port?: number;
  host?: string;
  workspace?: string;
  cjk?: boolean;
  /** "pdf" (default, CLI-compiled) or "wasm" (typst.ts in the browser). */
  mode?: "pdf" | "wasm";
  /** Whether to open a browser window. Defaults to true. */
  open: boolean;
}

export type PreviewArgsResult = { ok: true; args: PreviewArgs } | { ok: false; error: string };

export function parsePreviewArgs(input: string): PreviewArgsResult {
  const tokens = input.split(/\s+/).filter(Boolean);
  const args: PreviewArgs = { open: true };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const next = () => tokens[++i];

    if (token === "--no-open") {
      args.open = false;
      continue;
    }
    if (token === "--cjk") {
      args.cjk = true;
      continue;
    }
    if (token === "--wasm") {
      args.mode = "wasm";
      continue;
    }
    if (token === "--pdf") {
      args.mode = "pdf";
      continue;
    }
    if (token === "--port") {
      const raw = next();
      const port = Number(raw);
      if (!raw || !Number.isInteger(port) || port < 1 || port > 65535) {
        return { ok: false, error: `--port needs a number between 1 and 65535 (got "${raw ?? ""}")` };
      }
      args.port = port;
      continue;
    }
    if (token === "--host") {
      const raw = next();
      if (!raw) return { ok: false, error: "--host needs a value" };
      args.host = raw;
      continue;
    }
    if (token === "--workspace") {
      const raw = next();
      if (!raw) return { ok: false, error: "--workspace needs a value" };
      args.workspace = raw;
      continue;
    }
    if (token.startsWith("--")) {
      return { ok: false, error: `Unknown option: ${token}` };
    }
    if (args.doc !== undefined) {
      return { ok: false, error: `Unexpected extra argument: ${token}` };
    }
    args.doc = token;
  }

  return { ok: true, args };
}
