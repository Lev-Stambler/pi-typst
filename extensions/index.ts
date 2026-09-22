/**
 * pi-typst — Typst CLI tools, a browser preview server, and diagram skills.
 *
 * Tools:
 *   - typst_compile: compile a .typ document with the typst CLI (PDF/PNG/SVG),
 *     parsed diagnostics, and an optional inline page image.
 *   - typst_cli: run other typst subcommands (eval, query, fonts, init).
 *   - typst_preview: start/stop the live browser preview (typst.ts in the browser).
 *
 * Command:
 *   /typst-preview [doc] [--port N] [--host H] [--cjk] [--no-open]
 *
 * Skills (bundled): typst-explain-illustrate, cetz-diagrams, typst-documents.
 */

import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { basename, relative } from "node:path";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

import {
  buildCompileArgs,
  compilePngPreviews,
  findTypFiles,
  formatDiagnostics,
  humanBytes,
  makeTempDir,
  parseDiagnostics,
  rawStderr,
  removeDir,
  resolveInputPath,
  resolveTypstBinary,
  runTypst,
} from "./lib/typst.ts";
import { defaultOutput, listOutputs, truncate, withTagPattern } from "./lib/outputs.ts";
import { parsePreviewArgs } from "./lib/args.ts";
import { PreviewServer } from "./lib/server.ts";

interface CompileDetails {  input: string;
  format: string;
  command: string;
  outputs: string[];
  pagesWritten: number;
  ms: number;
  warnings: string[];
  previewPages: number[];
  bytes: number;
  bin: string;
}

interface CliDetails {
  args: string[];
  command: string;
  code: number | null;
  ms: number;
  error?: string;
}

interface PreviewDetails {
  action: string;
  url?: string;
  doc?: string;
  engine?: string;
  workspace?: string;
  error?: string;
}

const ALLOWED_CLI_SUBCOMMANDS = ["compile", "eval", "query", "fonts", "init", "help", "--help", "-h", "--version", "-V"];
const MAX_TEXT = 20_000;

const COMPILE_SCHEMA = Type.Object({
    input: Type.String({ description: "Path to the .typ document, relative to cwd or absolute." }),
    format: Type.Optional(
      StringEnum(["pdf", "png", "svg", "html"] as const, { description: "Output format. Default: pdf." }),
    ),
    output: Type.Optional(
      Type.String({ description: "Output path. For png/svg a {p} page-number template is added automatically." }),
    ),
    pages: Type.Optional(Type.String({ description: "Pages to export, e.g. \"1\" or \"2-4\". Default: all." })),
    ppi: Type.Optional(Type.Number({ description: "PNG resolution in pixels per inch. Default: 144." })),
    root: Type.Optional(Type.String({ description: "Typst project root for absolute imports." })),
    font_paths: Type.Optional(Type.Array(Type.String(), { description: "Extra font directories (--font-path)." })),
    inputs: Type.Optional(
      Type.Record(Type.String(), Type.String(), { description: "sys.inputs key-value pairs (--input key=value)." }),
    ),
    preview: Type.Optional(
      StringEnum(["none", "first", "all"] as const, {
        description: "Return rendered PNG page images in the tool result. Default: first.",
      }),
    ),
    preview_pages: Type.Optional(Type.String({ description: "Pages to render for the inline preview, e.g. \"1\" or \"1-2\"." })),
    preview_ppi: Type.Optional(Type.Number({ description: "PPI for inline preview images. Default: 110." })),
  });

const CLI_SCHEMA = Type.Object({
    args: Type.Array(Type.String(), {
      description: `Arguments to pass to typst, e.g. ["fonts"] or ["eval", "--in", "doc.typ", "query(heading).len()"]. First argument must be one of: ${ALLOWED_CLI_SUBCOMMANDS.join(", ")}.`,
    }),
    cwd: Type.Optional(Type.String({ description: "Working directory. Default: the session cwd." })),
    timeout_ms: Type.Optional(Type.Number({ description: "Timeout in milliseconds. Default: 120000." })),
  });

const PREVIEW_SCHEMA = Type.Object({
    action: Type.Optional(
      StringEnum(["start", "stop", "status"] as const, { description: "Action. Default: start." }),
    ),
    doc: Type.Optional(Type.String({ description: "Document to preview (start). Default: main .typ in cwd." })),
    workspace: Type.Optional(
      Type.String({ description: "Directory to mirror into the browser compiler. Default: the document's directory." }),
    ),
    port: Type.Optional(Type.Number({ description: "Preferred port. Default: 7777 (falls back if taken)." })),
    host: Type.Optional(Type.String({ description: "Bind address. Default: 127.0.0.1." })),
    cjk: Type.Optional(Type.Boolean({ description: "Load CJK font assets (auto-detected from the document by default)." })),
    mode: Type.Optional(
      StringEnum(["pdf", "wasm"] as const, {
        description: "Preview engine: pdf (typst CLI, default when installed) or wasm (typst.ts in the browser).",
      }),
    ),
  });

// One preview server per pi session, started lazily and closed on shutdown.
let previewServer: PreviewServer | null = null;
let previewStarting: Promise<PreviewServer> | null = null;

/** Stop the preview server, including a start that is still in flight. */
async function stopPreview(): Promise<string | null> {
  const starting = previewStarting;
  previewStarting = null;
  if (starting) {
    const pending = await starting.catch(() => null);
    if (pending && pending !== previewServer) await pending.stop().catch(() => {});
  }
  const server = previewServer;
  previewServer = null;
  if (!server) return null;
  const url = server.url;
  await server.stop().catch(() => {});
  return url;
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(command, args, { detached: true, stdio: "ignore" }).unref();
  } catch {
    // Opening a browser is best-effort.
  }
}

async function ensurePreview(
  ctx: ExtensionContext,
  options: { doc?: string; port?: number; host?: string; cjk?: boolean; workspace?: string; mode?: "pdf" | "wasm" },
): Promise<PreviewServer> {
  if (previewServer) {
    if (options.doc) {
      const wanted = resolveInputPath(options.doc, ctx.cwd);
      if (wanted !== previewServer.doc) await previewServer.selectDoc(wanted);
    }
    return previewServer;
  }

  if (!previewStarting) {
    previewStarting = (async () => {
      const doc = resolveInputPath(options.doc ?? (await findMainDoc(ctx)), ctx.cwd);
      const server = await PreviewServer.create({
        doc,
        cwd: ctx.cwd,
        workspace: options.workspace ?? process.env.PI_TYPST_WORKSPACE ?? undefined,
        host: options.host,
        port: options.port,
        cjk: options.cjk,
        mode: options.mode,
      });
      await server.start();
      previewServer = server;
      previewStarting = null;
      return server;
    })().catch((error) => {
      previewStarting = null;
      throw error;
    });
  }

  return await previewStarting;
}

/** Pick a document to preview: prefer a single .typ in cwd, else the first found. */
async function findMainDoc(ctx: ExtensionContext): Promise<string> {
  const candidates = await findTypFiles(ctx.cwd, { maxDepth: 2, limit: 40 });
  if (candidates.length === 0) {
    throw new Error(`No .typ document found under ${ctx.cwd}. Pass a document path or create one first.`);
  }
  const shallow = candidates.filter((path) => {
    const rel = relative(ctx.cwd, path);
    return !rel.includes("/") || rel.split("/").length <= 2;
  });
  const preferred = ["main.typ", "paper.typ", "index.typ", "doc.typ"];
  for (const name of preferred) {
    const match = candidates.find((path) => basename(path) === name);
    if (match) return match;
  }
  return shallow[0] ?? candidates[0]!;
}

async function previewUrl(): Promise<string | null> {
  return previewServer ? previewServer.url : null;
}

export default function piTypstExtension(pi: ExtensionAPI): void {
  pi.registerTool<typeof COMPILE_SCHEMA, CompileDetails>({
    name: "typst_compile",
    label: "Typst Compile",
    description:
      "Compile a Typst (.typ) document with the typst CLI into PDF, PNG, SVG, or HTML. Returns parsed diagnostics, the written output files, and (by default) a PNG image of the first page so you can see the rendered result.",
    promptSnippet: "Compile a Typst document to PDF/PNG/SVG with the typst CLI",
    promptGuidelines: [
      "Use typst_compile (not bash) to compile .typ files: it resolves the typst binary, parses diagnostics into readable errors, and returns a rendered page image.",
      "After writing or editing a .typ file, call typst_compile to verify it compiles cleanly, then look at the returned page image before declaring the work done.",
      "Use typst_preview when the user wants to read the document live in a browser.",
    ],
    parameters: COMPILE_SCHEMA,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const bin = await resolveTypstBinary();
      const input = resolveInputPath(params.input, ctx.cwd);

      const info = await stat(input).catch(() => null);
      if (!info?.isFile()) {
        const nearby = await findTypFiles(ctx.cwd, { maxDepth: 3, limit: 12 });
        const list = nearby.map((path) => `  ${relative(ctx.cwd, path)}`).join("\n");
        throw new Error(`Typst document not found: ${params.input}${list ? `\n\n.typ files under ${ctx.cwd}:\n${list}` : ""}`);
      }

      const format = params.format ?? "pdf";
      const output = withTagPattern(
        params.output ? resolveInputPath(params.output, ctx.cwd) : defaultOutput(input, format),
        format,
      );
      const root = params.root ? resolveInputPath(params.root, ctx.cwd) : undefined;

      onUpdate?.({ content: [{ type: "text", text: `Compiling ${params.input}…` }], details: {} as CompileDetails });

      const args = buildCompileArgs({
        input,
        output,
        format,
        root,
        fontPaths: params.font_paths,
        inputs: params.inputs,
        pages: params.pages,
        ppi: params.ppi,
        cwd: ctx.cwd,
      });
      const run = await runTypst(args, { cwd: ctx.cwd, signal, timeoutMs: 180_000 });
      const diagnostics = parseDiagnostics(run.stderr);

      if (!run.ok) {
        const message =
          formatDiagnostics(diagnostics, { cwd: ctx.cwd }) || rawStderr(run.stderr) || `typst exited with code ${run.code}`;
        throw new Error(`${message}\n\ncommand: ${run.command}`);
      }

      const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
      const written = await listOutputs(output, ctx.cwd);

      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [];
      const lines = [
        `Compiled ${relative(ctx.cwd, input) || params.input} → ${format} in ${run.ms} ms`,
        `Output: ${written.files.length === 1 ? relative(ctx.cwd, written.files[0]!) : `${written.files.length} files (${relative(ctx.cwd, output)})`}`,
        `Size: ${humanBytes(written.bytes)}${written.files.length > 1 ? ` across ${written.files.length} pages` : ""}`,
      ];
      if (warnings.length > 0) lines.push(`Warnings:\n${formatDiagnostics(warnings, { cwd: ctx.cwd, limit: 5 })}`);
      if (output !== written.files[0] && written.files.length > 1) {
        lines.push(`First files: ${written.files.slice(0, 3).map((file) => relative(ctx.cwd, file)).join(", ")}`);
      }
      content.push({ type: "text", text: lines.join("\n") });

      const previewMode = params.preview ?? "first";
      const previewPages: number[] = [];
      if (previewMode !== "none") {
        const tmp = await makeTempDir("pi-typst-preview-png");
        try {
          const previews = await compilePngPreviews(input, {
            workDir: tmp,
            pages: params.preview_pages ?? (previewMode === "first" ? "1" : "1-4"),
            ppi: Math.min(params.preview_ppi ?? 110, 200),
            limit: previewMode === "first" ? 1 : 4,
            cwd: ctx.cwd,
            root,
            fontPaths: params.font_paths,
            inputs: params.inputs,
            signal,
          });
          for (const preview of previews.previews) {
            previewPages.push(preview.page);
            content.push({ type: "image", data: preview.data, mimeType: "image/png" });
            content.push({ type: "text", text: `Rendered page ${preview.page} (${humanBytes(preview.bytes)})` });
          }
          if (previews.previews.length === 0 && previews.skipped.length > 0) {
            content.push({ type: "text", text: `Preview skipped: ${previews.skipped[0]!.reason}` });
          }
        } finally {
          await removeDir(tmp);
        }
      }

      if (!(await previewUrl())) {
        content.push({ type: "text", text: "Tip: call typst_preview to read this document live in a browser." });
      }

      return {
        content,
        details: {
          input,
          format,
          command: run.command,
          outputs: written.files,
          pagesWritten: written.files.length,
          ms: run.ms,
          warnings: warnings.map((warning) => formatDiagnostics([warning], { cwd: ctx.cwd })),
          previewPages,
          bytes: written.bytes,
          bin: bin.version,
        },
      };
    },

    renderCall(args, theme) {
      const format = args.format ?? "pdf";
      return new Text(
        theme.fg("toolTitle", theme.bold("typst_compile ")) +
          theme.fg("accent", args.input ?? "") +
          theme.fg("dim", ` → ${format}`),
        0,
        0,
      );
    },

    renderResult(result, { expanded, isPartial }, theme, context) {
      if (isPartial) return new Text(theme.fg("warning", "compiling…"), 0, 0);
      const details = result.details as CompileDetails | undefined;
      if (!details || !details.format) {
        const text = result.content
          .filter((item): item is { type: "text"; text: string } => item.type === "text")
          .map((item) => item.text)
          .join("\n");
        return new Text(theme.fg("error", text.split("\n").slice(0, expanded ? 20 : 3).join("\n")), 0, 0);
      }
      const first = details.outputs[0] ? relative(context.cwd, details.outputs[0]) : "";
      let line =
        theme.fg("success", "✓ ") +
        theme.fg("toolOutput", `${details.format} ${first}`) +
        theme.fg("dim", ` · ${details.pagesWritten} file(s) · ${details.ms} ms · ${humanBytes(details.bytes)}`);
      if (details.warnings.length > 0) line += theme.fg("warning", ` · ${details.warnings.length} warning(s)`);
      if (expanded && details.outputs.length > 1) {
        line += "\n" + theme.fg("dim", details.outputs.map((file) => `  ${relative(context.cwd, file)}`).join("\n"));
      }
      return new Text(line, 0, 0);
    },
  });

  pi.registerTool<typeof CLI_SCHEMA, CliDetails>({
    name: "typst_cli",
    label: "Typst CLI",
    description:
      "Run a typst CLI subcommand that typst_compile does not cover: eval, query, fonts, init, help, --version. Compilation belongs to typst_compile.",
    promptSnippet: "Run typst CLI subcommands such as eval, query, or fonts",
    promptGuidelines: [
      "Use typst_cli for typst subcommands like eval, query, or fonts; use typst_compile for compiling documents.",
    ],
    parameters: CLI_SCHEMA,

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const [first] = params.args;
      if (!first) throw new Error(`typst_cli needs at least one argument. Allowed: ${ALLOWED_CLI_SUBCOMMANDS.join(", ")}`);
      if (!ALLOWED_CLI_SUBCOMMANDS.includes(first)) {
        throw new Error(
          `typst_cli refuses \`${first}\`. Allowed subcommands: ${ALLOWED_CLI_SUBCOMMANDS.join(", ")}. Use typst_compile to compile documents.`,
        );
      }
      const cwd = params.cwd ? resolveInputPath(params.cwd, ctx.cwd) : ctx.cwd;
      const run = await runTypst(params.args, { cwd, signal, timeoutMs: params.timeout_ms ?? 120_000 });
      const stdout = run.stdout.toString("utf8").trim();
      const stderr = run.stderr.trim();
      const body = [stdout, stderr].filter(Boolean).join("\n") || `(no output; exit code ${run.code})`;
      return {
        content: [{ type: "text", text: truncate(body, MAX_TEXT) }],
        details: { args: params.args, command: run.command, code: run.code, ms: run.ms },
      };
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("typst_cli ")) + theme.fg("dim", (args.args ?? []).join(" ")),
        0,
        0,
      );
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as CliDetails | undefined;
      if (!details) return new Text(theme.fg("dim", "(no output)"), 0, 0);
      const ok = details.code === 0;
      const text = result.content
        .filter((item): item is { type: "text"; text: string } => item.type === "text")
        .map((item) => item.text)
        .join("\n");
      const head = ok
        ? theme.fg("success", `✓ typst ${details.args[0]} · ${details.ms} ms`)
        : theme.fg("error", `✗ typst ${details.args[0]} · exit ${details.code}`);
      if (!expanded) {
        const firstLine = text.split("\n").find((line) => line.trim()) ?? "";
        return new Text(head + (firstLine ? theme.fg("dim", ` · ${firstLine.slice(0, 80)}`) : ""), 0, 0);
      }
      return new Text(head + "\n" + theme.fg("toolOutput", text), 0, 0);
    },
  });

  pi.registerTool<typeof PREVIEW_SCHEMA, PreviewDetails>({
    name: "typst_preview",
    label: "Typst Preview",
    description:
      "Start, stop, or inspect the live typst preview server. The browser compiles the .typ document with typst.ts and re-renders automatically when files change, so the user can read it at the returned URL.",
    promptSnippet: "Serve a live browser preview of a Typst document",
    promptGuidelines: [
      "Use typst_preview when the user wants to see a .typ document in a browser; report the returned URL.",
      "typst_preview refreshes automatically when files change, so no reload calls are needed after edits.",
    ],
    parameters: PREVIEW_SCHEMA,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const action = params.action ?? "start";

      if (action === "stop") {
        const url = await stopPreview();
        if (!url) {
          return { content: [{ type: "text", text: "typst preview is not running." }], details: { action } };
        }
        ctx.ui.setStatus("typst-preview", undefined);
        return { content: [{ type: "text", text: `Stopped typst preview (${url}).` }], details: { action, url } };
      }

      if (action === "status") {
        if (!previewServer) {
          return { content: [{ type: "text", text: "typst preview is not running." }], details: { action } };
        }
        const state = previewServer.state();
        return {
          content: [
            {
              type: "text",
              text: `typst preview: ${previewServer.url}\ndoc: ${state.doc.path}\nengine: ${state.server.engine}\nworkspace: ${state.workspace}\ndocs: ${state.docs.length}`,
            },
          ],
          details: { action, url: previewServer.url, doc: state.doc.path, engine: state.server.engine, workspace: state.workspace },
        };
      }

      const server = await ensurePreview(ctx, {
        doc: params.doc,
        port: params.port,
        host: params.host,
        cjk: params.cjk,
        workspace: params.workspace,
        mode: params.mode,
      });
      const state = server.state();
      ctx.ui.setStatus("typst-preview", `typst ▸ ${server.url}`);
      return {
        content: [
          {
            type: "text",
            text: `typst preview running at ${server.url}\ndoc: ${state.doc.path}\nengine: ${state.server.engine}\nworkspace: ${state.workspace}\nThe page reloads itself when files change.`,
          },
        ],
        details: { action, url: server.url, doc: state.doc.path, engine: state.server.engine, workspace: state.workspace },
      };
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("typst_preview ")) + theme.fg("dim", args.action ?? "start"),
        0,
        0,
      );
    },

    renderResult(result, _options, theme) {
      const details = result.details as PreviewDetails | undefined;
      const text = result.content
        .filter((item): item is { type: "text"; text: string } => item.type === "text")
        .map((item) => item.text)
        .join("\n");
      if (details?.error) return new Text(theme.fg("error", details.error), 0, 0);
      if (details?.url) {
        return new Text(theme.fg("success", "✓ preview ") + theme.fg("accent", details.url), 0, 0);
      }
      return new Text(theme.fg("dim", text.split("\n")[0] ?? ""), 0, 0);
    },
  });

  pi.registerCommand("typst-preview", {
    description: "Start a live Typst preview server and open it in a browser",
    getArgumentCompletions: async (prefix) => {
      const files = await findTypFiles(process.cwd(), { maxDepth: 3, limit: 40 }).catch(() => []);
      const items = files.map((path) => ({ value: relative(process.cwd(), path), label: relative(process.cwd(), path) }));
      const filtered = items.filter((item) => item.value.startsWith(prefix));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      const parsed = parsePreviewArgs(args);
      if (!parsed.ok) {
        ctx.ui.notify(parsed.error, "error");
        return;
      }
      const options = parsed.args;

      try {
        const server = await ensurePreview(ctx, options);
        const state = server.state();
        ctx.ui.setStatus("typst-preview", `typst ▸ ${server.url}`);
        ctx.ui.notify(`typst preview: ${server.url}  (${state.doc.path})`, "info");
        if (options.open) openBrowser(server.url);
      } catch (error) {
        ctx.ui.notify(`typst preview failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
    },
  });

  pi.on("session_shutdown", async () => {
    await stopPreview();
  });
}
