/**
 * Thin, dependency-free wrapper around the Typst CLI.
 *
 * The CLI is used for durable artifacts (PDF/PNG/SVG on disk) and for the
 * PNG previews that tools hand back to the model. Browser preview does not go
 * through this module: the viewer compiles Typst in the browser with typst.ts.
 */

import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

export type TypstFormat = "pdf" | "png" | "svg" | "html" | "bundle";

export interface TypstBinary {
  /** Absolute path to the typst executable. */
  bin: string;
  /** Version string as reported by `typst --version`, e.g. "0.15.0". */
  version: string;
  /** Where the binary came from: "TYPST_BIN", "PATH", or the candidate path. */
  source: string;
}

export interface TypstRun {
  ok: boolean;
  code: number | null;
  /** Raw stdout; PNG/PDF/SVG bytes are returned untouched. */
  stdout: Buffer;
  /** stderr decoded as UTF-8. */
  stderr: string;
  /** Wall-clock duration in milliseconds. */
  ms: number;
  /** The command line that was executed. */
  command: string;
}

export interface TypstDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning";
  message: string;
  /** Non-empty for continuation lines that belong to the previous diagnostic. */
  notes: string[];
}

export interface CompileOptions {
  input: string;
  output: string;
  format?: TypstFormat;
  root?: string;
  fontPaths?: string[];
  inputs?: Record<string, string>;
  pages?: string;
  ppi?: number;
  deps?: string;
  cwd?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Extra typst arguments appended before input/output (escape hatch). */
  extraArgs?: string[];
}

const DEFAULT_TIMEOUT_MS = 180_000;
const INSTALL_HINT = [
  "Install Typst 0.13 or newer and re-run:",
  "  cargo install --locked typst-cli",
  "  brew install typst                 # macOS",
  "  curl -fsSL https://typst.community/typst-install | sh",
  "  uv tool install typst              # python packaging",
  "Or point TYPST_BIN at an existing binary.",
].join("\n");

let cachedBinary: TypstBinary | null = null;

/** Test/repair hook: forget the cached binary so the next call re-probes. */
export function resetTypstBinaryCache(): void {
  cachedBinary = null;
}

function binName(): string {
  return process.platform === "win32" ? "typst.exe" : "typst";
}

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    if (!info.isFile()) return false;
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(name: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  const raw = env.PATH ?? "";
  for (const dir of raw.split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (await isExecutableFile(candidate)) return candidate;
  }
  return null;
}

function candidatePaths(env: NodeJS.ProcessEnv): Array<{ path: string; source: string }> {
  const out: Array<{ path: string; source: string }> = [];
  if (env.TYPST_BIN) out.push({ path: env.TYPST_BIN, source: "TYPST_BIN" });
  out.push(
    { path: join(homedir(), ".cargo", "bin", binName()), source: "~/.cargo/bin" },
    { path: join(homedir(), ".local", "bin", binName()), source: "~/.local/bin" },
    { path: "/usr/local/bin/typst", source: "/usr/local/bin" },
    { path: "/opt/homebrew/bin/typst", source: "/opt/homebrew/bin" },
    { path: "/usr/bin/typst", source: "/usr/bin" },
  );
  return out;
}

async function probeVersion(bin: string): Promise<string> {
  const run = await runProcess(bin, ["--version"], { timeoutMs: 20_000 });
  const text = `${run.stdout.toString("utf8")}\n${run.stderr}`.trim();
  const match = text.match(/typst\s+([0-9][^\s(]*)/i);
  if (run.code !== 0 || !match) {
    throw new Error(`Found ${bin} but \`typst --version\` failed:\n${text || "(no output)"}`);
  }
  return match[1] ?? "unknown";
}

/**
 * Locate a usable typst binary. Resolution order:
 * TYPST_BIN -> PATH -> ~/.cargo/bin -> ~/.local/bin -> /usr/local/bin -> /opt/homebrew/bin -> /usr/bin.
 */
export async function resolveTypstBinary(env: NodeJS.ProcessEnv = process.env): Promise<TypstBinary> {
  if (cachedBinary && !env.TYPST_BIN) return cachedBinary;
  if (cachedBinary && env.TYPST_BIN && cachedBinary.source === "TYPST_BIN" && cachedBinary.bin === env.TYPST_BIN) {
    return cachedBinary;
  }

  const tried: string[] = [];

  if (env.TYPST_BIN) {
    const explicit = env.TYPST_BIN;
    if (!(await isExecutableFile(explicit))) {
      throw new Error(`TYPST_BIN is set to "${explicit}" but that is not an executable file.\n${INSTALL_HINT}`);
    }
    const version = await probeVersion(explicit);
    cachedBinary = { bin: explicit, version, source: "TYPST_BIN" };
    return cachedBinary;
  }

  const onPath = await findOnPath(binName(), env);
  if (onPath) {
    tried.push(onPath);
    try {
      const version = await probeVersion(onPath);
      cachedBinary = { bin: onPath, version, source: "PATH" };
      return cachedBinary;
    } catch {
      // Fall through to the well-known locations.
    }
  }

  for (const candidate of candidatePaths(env)) {
    tried.push(candidate.path);
    if (!(await isExecutableFile(candidate.path))) continue;
    try {
      const version = await probeVersion(candidate.path);
      cachedBinary = { bin: candidate.path, version, source: candidate.source };
      return cachedBinary;
    } catch {
      // Keep looking.
    }
  }

  throw new Error(
    `Could not find a usable \`typst\` binary.\nSearched: ${tried.join(", ")}\n\n${INSTALL_HINT}`,
  );
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function formatCommand(bin: string, args: string[]): string {
  return [bin, ...args].map(shellQuote).join(" ");
}

/** Spawn a process, capture stdout as a Buffer and stderr as a string. */
export async function runProcess(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio & { timeoutMs?: number } = {},
): Promise<TypstRun> {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return await new Promise<TypstRun>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: string[] = [];
    let settled = false;

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill("SIGKILL");
            rejectPromise(new Error(`\`${formatCommand(command, args)}\` timed out after ${timeoutMs}ms`));
          }, timeoutMs)
        : null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
    };

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk.toString("utf8")));

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolvePromise({
        ok: code === 0,
        code,
        stdout: Buffer.concat(stdout),
        stderr: stderr.join(""),
        ms: Date.now() - started,
        command: formatCommand(command, args),
      });
    });
  });
}

/** Run the resolved typst binary with the given arguments. */
export async function runTypst(
  args: string[],
  options: { cwd?: string; signal?: AbortSignal; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<TypstRun> {
  const { bin } = await resolveTypstBinary(options.env ?? process.env);
  if (options.signal?.aborted) throw new Error("Aborted");
  return await runProcess(bin, args, {
    cwd: options.cwd,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });
}

export function inferFormat(path: string): TypstFormat | null {
  const ext = extname(path).toLowerCase().replace(".", "");
  if (ext === "pdf" || ext === "png" || ext === "svg" || ext === "html" || ext === "bundle") return ext;
  return null;
}

export function buildCompileArgs(options: CompileOptions): string[] {
  const args: string[] = ["compile"];

  const format = options.format ?? (options.output === "-" ? undefined : inferFormat(options.output) ?? undefined);
  if (format) args.push("--format", format);
  if (options.root) args.push("--root", options.root);
  for (const fontPath of options.fontPaths ?? []) args.push("--font-path", fontPath);
  for (const [key, value] of Object.entries(options.inputs ?? {})) args.push("--input", `${key}=${value}`);
  if (options.pages) args.push("--pages", options.pages);
  if (typeof options.ppi === "number") args.push("--ppi", String(Math.round(options.ppi)));
  if (options.deps) {
    args.push("--deps", options.deps);
    args.push("--deps-format", "json");
  }
  args.push("--diagnostic-format", "short");
  for (const extra of options.extraArgs ?? []) args.push(extra);

  args.push(options.input);
  args.push(options.output);
  return args;
}

/**
 * Parse `typst compile --diagnostic-format short` output, which looks like:
 *   /path/to/file.typ:12:5: error: cannot add color and ratio
 * Continuation lines (indented notes) are attached to the previous diagnostic.
 */
export function parseDiagnostics(stderr: string): TypstDiagnostic[] {
  const diagnostics: TypstDiagnostic[] = [];
  const head = /^(.+?):(\d+):(\d+): (error|warning): (.*)$/;

  for (const rawLine of stderr.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line) continue;

    const match = line.match(head);
    if (match) {
      diagnostics.push({
        file: match[1] ?? "",
        line: Number(match[2]),
        column: Number(match[3]),
        severity: match[4] === "warning" ? "warning" : "error",
        message: compactSpaces(match[5] ?? ""),
        notes: [],
      });
      continue;
    }

    const plain = line.match(/^(error|warning): (.*)$/);
    if (plain) {
      diagnostics.push({
        file: "",
        line: 0,
        column: 0,
        severity: plain[1] === "warning" ? "warning" : "error",
        message: compactSpaces(plain[2] ?? ""),
        notes: [],
      });
      continue;
    }

    const last = diagnostics.at(-1);
    if (last) {
      const note = compactSpaces(line.replace(/^[\s│┌└├─╰╭]+/, "").replace(/^\s*=?\s*/, ""));
      if (note) last.notes.push(note);
    }
  }

  return diagnostics;
}

function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Format diagnostics for humans and for the model, errors first. */
export function formatDiagnostics(
  diagnostics: TypstDiagnostic[],
  options: { cwd?: string; limit?: number } = {},
): string {
  const limit = options.limit ?? 12;
  const ordered = [...diagnostics].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    return 0;
  });
  const lines: string[] = [];
  for (const diagnostic of ordered.slice(0, limit)) {
    const where = displayLocation(options.cwd, diagnostic);
    lines.push(`${diagnostic.severity}: ${where ? `${where}: ` : ""}${diagnostic.message}`);
    for (const note of diagnostic.notes.slice(0, 3)) lines.push(`  ${note}`);
  }
  if (ordered.length > limit) lines.push(`... ${ordered.length - limit} more diagnostic(s)`);
  return lines.join("\n");
}

function displayLocation(cwd: string | undefined, diagnostic: TypstDiagnostic): string {
  if (!diagnostic.file) return "";
  const base = cwd ?? process.cwd();
  const absolute = isAbsolute(diagnostic.file) ? diagnostic.file : resolve(base, diagnostic.file);
  const rel = relative(base, absolute);
  const shown = rel && !rel.startsWith("..") ? rel.split(sep).join("/") : absolute;
  return `${shown}:${diagnostic.line}:${diagnostic.column}`;
}

/** Return the raw stderr (trimmed) when no structured diagnostics were parsed. */
export function rawStderr(stderr: string, limit = 20): string {
  return stderr
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ""))
    .filter(Boolean)
    .slice(0, limit)
    .join("\n")
    .trim();
}

export async function ensureDir(path: string): Promise<string> {
  await mkdir(path, { recursive: true });
  return path;
}

export async function makeTempDir(prefix = "pi-typst"): Promise<string> {
  const dir = join(tmpdir(), `${prefix}-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  await ensureDir(dir);
  return dir;
}

export async function removeDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true }).catch(() => {});
}

export const WORKSPACE_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  ".pi",
  ".venv",
  "venv",
  "target",
  "dist",
  "build",
  "__pycache__",
  ".cache",
  ".typst",
  "traces",
]);

export interface FindFilesOptions {
  maxDepth?: number;
  limit?: number;
  skipDirs?: Set<string>;
}

/** Recursively find `.typ` files under `root`. Hidden directories are skipped. */
export async function findTypFiles(root: string, options: FindFilesOptions = {}): Promise<string[]> {
  const maxDepth = options.maxDepth ?? 4;
  const limit = options.limit ?? 200;
  const skipDirs = options.skipDirs ?? WORKSPACE_SKIP_DIRS;
  const found: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (found.length >= limit || depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (found.length >= limit) return;
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        await walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".typ")) {
        found.push(full);
      } else if (entry.isSymbolicLink() && entry.name.toLowerCase().endsWith(".typ")) {
        found.push(full);
      }
    }
  }

  const info = await stat(root).catch(() => null);
  if (!info?.isDirectory()) return found;
  await walk(root, 0);
  return found;
}

/** Resolve a user-supplied path against cwd; strips a leading `@` (some models add it). */
export function resolveInputPath(input: string, cwd: string): string {
  const cleaned = input.startsWith("@") ? input.slice(1) : input;
  return isAbsolute(cleaned) ? cleaned : resolve(cwd, cleaned);
}

export function isPathInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export interface PdfRender {
  ok: boolean;
  pdf?: Buffer;
  diagnostics: TypstDiagnostic[];
  stderr: string;
  ms: number;
}

/** Compile a document to PDF bytes (written to stdout by the CLI). */
export async function compilePdf(
  input: string,
  options: {
    cwd?: string;
    root?: string;
    fontPaths?: string[];
    inputs?: Record<string, string>;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<PdfRender> {
  const args = buildCompileArgs({
    input,
    output: "-",
    format: "pdf",
    root: options.root,
    fontPaths: options.fontPaths,
    inputs: options.inputs,
    cwd: options.cwd,
    signal: options.signal,
  });
  const run = await runTypst(args, { cwd: options.cwd, signal: options.signal, timeoutMs: options.timeoutMs });
  return {
    ok: run.ok && run.stdout.length > 0,
    pdf: run.ok ? run.stdout : undefined,
    diagnostics: parseDiagnostics(run.stderr),
    stderr: run.stderr,
    ms: run.ms,
  };
}

export interface PngPreview {
  page: number;
  /** base64 data, no data URL prefix. */
  data: string;
  bytes: number;
}

export interface PngPreviewsResult {
  previews: PngPreview[];
  skipped: Array<{ page: number; bytes: number; reason: string }>;
  diagnostics: TypstDiagnostic[];
  stderr: string;
  ms: number;
  ok: boolean;
}

/**
 * Render page previews as PNGs. Pages are keyed by physical page number.
 * Oversized images are skipped rather than pushed into the model context.
 */
export async function compilePngPreviews(
  input: string,
  options: {
    workDir: string;
    pages?: string;
    ppi?: number;
    maxBytes?: number;
    limit?: number;
    cwd?: string;
    root?: string;
    fontPaths?: string[];
    inputs?: Record<string, string>;
    signal?: AbortSignal;
  },
): Promise<PngPreviewsResult> {
  await ensureDir(options.workDir);
  const args = buildCompileArgs({
    input,
    output: join(options.workDir, "preview-{p}.png"),
    format: "png",
    ppi: options.ppi ?? 110,
    pages: options.pages,
    root: options.root,
    fontPaths: options.fontPaths,
    inputs: options.inputs,
    cwd: options.cwd,
    signal: options.signal,
  });

  const run = await runTypst(args, { cwd: options.cwd, signal: options.signal });
  const diagnostics = parseDiagnostics(run.stderr);
  const previews: PngPreview[] = [];
  const skipped: PngPreviewsResult["skipped"] = [];
  const maxBytes = options.maxBytes ?? 3_500_000;
  const limit = options.limit ?? 4;

  if (run.ok) {
    const files = (await readdir(options.workDir).catch(() => [] as string[]))
      .map((file) => ({ file, match: file.match(/^preview-(\d+)\.png$/) }))
      .filter((entry): entry is { file: string; match: RegExpMatchArray } => Boolean(entry.match))
      .sort((a, b) => Number(a.match[1]) - Number(b.match[1]));

    for (const { file, match } of files) {
      const page = Number(match[1]);
      if (previews.length >= limit) {
        skipped.push({ page, bytes: 0, reason: `only the first ${limit} page previews are returned` });
        continue;
      }
      const buffer = await readFile(join(options.workDir, file)).catch(() => null);
      if (!buffer) continue;
      if (buffer.length > maxBytes) {
        skipped.push({ page, bytes: buffer.length, reason: "preview too large; render fewer pages or lower ppi" });
        continue;
      }
      previews.push({ page, data: buffer.toString("base64"), bytes: buffer.length });
    }
  }

  return { previews, skipped, diagnostics, stderr: run.stderr, ms: run.ms, ok: run.ok };
}

/** Human-readable byte size. */
export function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
