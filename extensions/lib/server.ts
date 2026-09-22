/**
 * Preview server.
 *
 * Typst compilation happens in the browser with typst.ts (WebAssembly), so this
 * server is deliberately small: it serves the viewer, the workspace files the
 * compiler reads, the font assets, and the typst.ts runtime (from
 * `node_modules`, with a CDN fallback).
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { compilePdf, findTypFiles, formatDiagnostics, isPathInside, rawStderr, resolveTypstBinary, WORKSPACE_SKIP_DIRS } from "./typst.ts";
import { viewerHtml } from "./viewer.ts";

/** typst.ts release served to the browser. Keep in sync with package.json. */
export const TYPST_TS_VERSION = "0.8.0-rc3";
/** Typst version embedded in that typst.ts release. */
export const TYPST_TS_TYPST_VERSION = "0.15.1";

const NPM = "https://cdn.jsdelivr.net/npm";

export const CDN_BASES = {
  typstTs: `${NPM}/@myriaddreamin/typst.ts@${TYPST_TS_VERSION}/`,
  compiler: `${NPM}/@myriaddreamin/typst-ts-web-compiler@${TYPST_TS_VERSION}/`,
  renderer: `${NPM}/@myriaddreamin/typst-ts-renderer@${TYPST_TS_VERSION}/`,
};

export const VENDOR_PACKAGES = {
  "typst.ts": "@myriaddreamin/typst.ts",
  "typst-ts-web-compiler": "@myriaddreamin/typst-ts-web-compiler",
  "typst-ts-renderer": "@myriaddreamin/typst-ts-renderer",
} as const;

type VendorPackage = keyof typeof VENDOR_PACKAGES;

/**
 * Font files the typst.ts default providers request per asset group.
 * Mirrors the asset lists compiled into the typst.ts bundle.
 */
export const FONT_GROUPS = {
  text: {
    upstream: "https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts/",
    files: [
      "LibertinusSerif-Regular.otf",
      "LibertinusSerif-Bold.otf",
      "LibertinusSerif-Italic.otf",
      "LibertinusSerif-BoldItalic.otf",
      "LibertinusSerif-Semibold.otf",
      "LibertinusSerif-SemiboldItalic.otf",
      "NewCM10-Regular.otf",
      "NewCM10-Bold.otf",
      "NewCM10-Italic.otf",
      "NewCM10-BoldItalic.otf",
      "NewCMMath-Regular.otf",
      "NewCMMath-Bold.otf",
      "NewCMMath-Book.otf",
      "DejaVuSansMono.ttf",
      "DejaVuSansMono-Bold.ttf",
      "DejaVuSansMono-Oblique.ttf",
      "DejaVuSansMono-BoldOblique.ttf",
    ],
  },
  cjk: {
    upstream: "https://cdn.jsdelivr.net/gh/typst/typst-dev-assets@v0.15.0/files/fonts/",
    files: [
      "InriaSerif-Regular.ttf",
      "InriaSerif-Bold.ttf",
      "InriaSerif-Italic.ttf",
      "InriaSerif-BoldItalic.ttf",
      "Roboto-Regular.ttf",
      "NotoSerifCJKsc-Regular.otf",
    ],
  },
  emoji: {
    upstream: "https://cdn.jsdelivr.net/gh/typst/typst-dev-assets@v0.15.0/files/fonts/",
    files: ["TwitterColorEmoji.ttf", "NotoColorEmoji-Regular-COLR.subset.ttf"],
  },
} as const;

type FontGroup = keyof typeof FONT_GROUPS;

const FONT_INDEX = new Map<string, { group: FontGroup; upstream: string }>();
for (const [group, spec] of Object.entries(FONT_GROUPS) as Array<[FontGroup, (typeof FONT_GROUPS)[FontGroup]]>) {
  for (const file of spec.files) FONT_INDEX.set(file, { group, upstream: spec.upstream });
}

const MIME: Record<string, string> = {
  ".wasm": "application/wasm",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".typ": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".bib": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const VENDOR_EXTENSIONS = new Set([".js", ".mjs", ".wasm", ".json", ".map", ".css", ".d.ts", ".d.mts"]);
const MAX_TREE_FILES = 800;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const TREE_MAX_DEPTH = 6;
const DEFAULT_PORT = 7777;
const PORT_ATTEMPTS = 6;

export interface PreviewDoc {
  /** Path relative to the workspace, forward slashes. */
  rel: string;
  abs: string;
  name: string;
}

export interface PreviewFile {
  /** Virtual path used by the browser compiler, e.g. "/docs/note.typ". */
  path: string;
  size: number;
  mtimeMs: number;
}

export interface PreviewState {
  schema: 1;
  server: {
    url: string;
    host: string;
    port: number;
    startedAt: string;
    cliVersion: string | null;
    engine: string;
  };
  doc: { path: string; absolute: string; name: string };
  /** Typst root inside the virtual file system. */
  root: string;
  workspace: string;
  assets: { mode: "local" | "cdn"; typstTs: string; compiler: string; renderer: string };
  fonts: { prefix: string; groups: FontGroup[] };
  preview: { mode: "pdf" | "wasm"; pdf: boolean; fallback: boolean };
  docs: PreviewDoc[];
}

export interface PreviewServerOptions {
  doc: string;
  cwd: string;
  workspace?: string;
  host?: string;
  port?: number;
  cjk?: boolean;
  /** "pdf" renders through the typst CLI (default when it is installed); "wasm" forces typst.ts in the browser. */
  mode?: "pdf" | "wasm";
}

export interface StartResult {
  url: string;
  host: string;
  port: number;
  state: PreviewState;
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function displayHost(host: string): string {
  return host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
}

export function looksLikeCjk(text: string): boolean {
  return /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/.test(text);
}

export class PreviewServer {
  readonly cwd: string;
  readonly host: string;
  readonly requestedPort: number;

  #doc: string;
  #workspace: string;
  #root: string;
  #fontPaths: string[];
  #inputs: Record<string, string>;
  #cjk: boolean;
  #cjkExplicit: boolean;
  #startedAt = new Date().toISOString();
  #server: Server | null = null;
  #port = 0;
  #url = "";
  #cliVersion: string | null = null;
  #previewMode: "pdf" | "wasm" = "wasm";
  #fallback = false;
  #vendorRoot: string | null;
  #fontCacheDir: string;
  #docsCache: { at: number; docs: PreviewDoc[] } | null = null;
  #docsRefreshing = false;

  private constructor(options: PreviewServerOptions, vendorRoot: string | null, fontCacheDir: string) {
    this.#doc = resolve(options.doc);
    this.cwd = resolve(options.cwd);
    this.#workspace = resolve(options.workspace ?? dirname(this.#doc));
    this.host = options.host ?? "127.0.0.1";
    this.requestedPort = options.port ?? DEFAULT_PORT;
    this.#root = resolve(options.workspace ?? dirname(this.#doc));
    this.#fontPaths = [];
    this.#inputs = {};
    this.#cjk = options.cjk ?? false;
    this.#cjkExplicit = options.cjk !== undefined;
    this.#vendorRoot = vendorRoot;
    this.#fontCacheDir = fontCacheDir;
    if (!isPathInside(this.#workspace, this.#doc)) this.#workspace = dirname(this.#doc);
    this.#root = this.#workspace;
  }

  static async create(options: PreviewServerOptions): Promise<PreviewServer> {
    const info = await stat(resolve(options.doc)).catch(() => null);
    if (!info?.isFile()) throw new Error(`Typst document not found: ${options.doc}`);
    if (extname(options.doc).toLowerCase() !== ".typ") throw new Error(`Not a .typ file: ${options.doc}`);

    // The server never compiles, so a missing CLI is not fatal: report it and move on.
    let cliVersion: string | null = null;
    try {
      cliVersion = (await resolveTypstBinary()).version;
    } catch {
      cliVersion = null;
    }

    const cacheHome = process.env.XDG_CACHE_HOME ? resolve(process.env.XDG_CACHE_HOME) : join(homedir(), ".cache");
    const fontCacheDir = join(cacheHome, "pi-typst", "fonts");
    await mkdir(fontCacheDir, { recursive: true }).catch(() => {});

    // Load CJK font assets automatically when the document contains CJK text.
    const server = new PreviewServer(options, await resolveVendorRoot(), fontCacheDir);
    server.#cliVersion = cliVersion;
    server.#previewMode = options.mode === "wasm" || !cliVersion ? "wasm" : "pdf";
    server.#fallback = options.mode === "pdf" && !cliVersion;
    server.#detectCjk(await readFile(resolve(options.doc), "utf8").catch(() => ""));
    return server;
  }

  get url(): string {
    return this.#url;
  }

  get port(): number {
    return this.#port;
  }

  get doc(): string {
    return this.#doc;
  }

  get cjk(): boolean {
    return this.#cjk;
  }

  get previewMode(): "pdf" | "wasm" {
    return this.#previewMode;
  }

  /** Re-derive the font groups from document content unless the user was explicit. */
  #detectCjk(text: string): void {
    if (!this.#cjkExplicit) this.#cjk = looksLikeCjk(text);
  }

  get workspace(): string {
    return this.#workspace;
  }

  state(): PreviewState {
    const local = this.#vendorRoot !== null;
    return {
      schema: 1,
      server: {
        url: this.#url,
        host: this.host,
        port: this.#port,
        startedAt: this.#startedAt,
        cliVersion: this.#cliVersion,
        engine:
          this.#previewMode === "pdf"
            ? `typst CLI ${this.#cliVersion ?? "?"} (PDF)`
            : `typst.ts ${TYPST_TS_VERSION} (Typst ${TYPST_TS_TYPST_VERSION})`,
      },
      doc: {
        path: this.#vfs(this.#doc),
        absolute: this.#doc,
        name: basename(this.#doc),
      },
      root: "/",
      workspace: this.#workspace,
      assets: local
        ? {
            mode: "local",
            typstTs: "/vendor/typst.ts/",
            compiler: "/vendor/typst-ts-web-compiler/",
            renderer: "/vendor/typst-ts-renderer/",
          }
        : { mode: "cdn", ...CDN_BASES },
      fonts: {
        prefix: "/api/fonts/",
        groups: this.#cjk ? ["text", "emoji", "cjk"] : ["text", "emoji"],
      },
      preview: {
        mode: this.#previewMode,
        pdf: this.#cliVersion !== null,
        fallback: this.#fallback,
      },
      docs: this.#docs(),
    };
  }

  #docs(): PreviewDoc[] {
    const now = Date.now();
    if (this.#docsCache && now - this.#docsCache.at < 3000) return this.#docsCache.docs;
    const cached = this.#docsCache?.docs ?? [];
    void this.#refreshDocs();
    return cached;
  }

  async #refreshDocs(): Promise<PreviewDoc[]> {
    if (this.#docsRefreshing) return this.#docsCache?.docs ?? [];
    this.#docsRefreshing = true;
    try {
      const files = await findTypFiles(this.#workspace, { maxDepth: 4, limit: 300 });
      const docs = files.map((abs) => ({ rel: this.#vfs(abs).slice(1), abs, name: basename(abs) }));
      this.#docsCache = { at: Date.now(), docs };
      return docs;
    } finally {
      this.#docsRefreshing = false;
    }
  }

  /** Bind the HTTP server, trying the requested port first and falling back gracefully. */
  async start(): Promise<StartResult> {
    if (this.#server) return { url: this.#url, host: this.host, port: this.#port, state: this.state() };

    const attempts: number[] = [];
    for (let i = 0; i < PORT_ATTEMPTS; i++) attempts.push(this.requestedPort + i);
    attempts.push(0);

    let lastError: unknown = null;
    for (const candidate of attempts) {
      const server = createServer((request, response) => {
        void this.#handle(request, response);
      });
      try {
        const port = await new Promise<number>((resolvePort, rejectPort) => {
          const onError = (error: Error) => {
            server.off("listening", onListening);
            rejectPort(error);
          };
          const onListening = () => {
            server.off("error", onError);
            const address = server.address();
            resolvePort(typeof address === "object" && address ? address.port : candidate);
          };
          server.once("error", onError);
          server.once("listening", onListening);
          server.listen(candidate, this.host);
        });

        this.#server = server;
        this.#port = port;
        this.#url = `http://${displayHost(this.host)}:${port}`;
        await this.#refreshDocs();
        return { url: this.#url, host: this.host, port, state: this.state() };
      } catch (error) {
        lastError = error;
        try {
          server.close();
        } catch {
          // Never started listening.
        }
        const code = (error as NodeJS.ErrnoException | null)?.code;
        if (code !== "EADDRINUSE" && code !== "EACCES") throw error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Could not bind the preview server to any port");
  }

  /** Switch the served document. */
  async selectDoc(docPath: string): Promise<PreviewState> {
    const absolute = isAbsolute(docPath) ? resolve(docPath) : resolve(this.#workspace, docPath);
    if (extname(absolute).toLowerCase() !== ".typ") throw new Error(`Not a .typ file: ${docPath}`);
    if (!isPathInside(this.#workspace, absolute) && !isPathInside(this.cwd, absolute)) {
      throw new Error("Refusing to open a document outside the workspace");
    }
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile()) throw new Error(`Typst document not found: ${docPath}`);

    this.#doc = absolute;
    if (!isPathInside(this.#workspace, absolute)) this.#workspace = dirname(absolute);
    this.#root = this.#workspace;
    this.#detectCjk(await readFile(absolute, "utf8").catch(() => ""));
    this.#docsCache = null;
    await this.#refreshDocs();
    return this.state();
  }

  async stop(): Promise<void> {
    const server = this.#server;
    this.#server = null;
    if (server) await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }

  /** Virtual path for an absolute path inside the workspace. */
  #vfs(abs: string): string {
    if (isPathInside(this.#workspace, abs)) {
      const rel = relative(this.#workspace, abs);
      if (rel) return "/" + toPosix(rel);
    }
    return "/" + toPosix(basename(abs));
  }

  /** Resolve a virtual path back to a real path, refusing escapes. */
  #real(vfsPath: string): string | null {
    const clean = vfsPath.split("?")[0] ?? "";
    const abs = resolve(this.#workspace, "." + (clean.startsWith("/") ? clean : "/" + clean));
    if (!isPathInside(this.#workspace, abs)) return null;
    return abs;
  }

  async #handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://localhost");
    const method = request.method ?? "GET";

    try {
      if (method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        this.#send(response, 200, "text/html; charset=utf-8", viewerHtml());
        return;
      }

      if (method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204).end();
        return;
      }

      if (method === "GET" && url.pathname === "/api/health") {
        this.#sendJson(response, 200, { ok: true, doc: this.#doc });
        return;
      }

      if (method === "GET" && url.pathname === "/api/state") {
        this.#sendJson(response, 200, this.state());
        return;
      }

      if (method === "GET" && url.pathname === "/api/docs") {
        const docs = await this.#refreshDocs();
        this.#sendJson(response, 200, { workspace: this.#workspace, docs });
        return;
      }

      if (method === "GET" && url.pathname === "/api/tree") {
        const tree = await this.#tree();
        const etag = this.#treeTag(tree.files);
        if (request.headers["if-none-match"] === etag) {
          response.writeHead(304, { etag, "cache-control": "no-store" }).end();
          return;
        }
        this.#sendJson(response, 200, tree, { etag });
        return;
      }

      if (method === "GET" && url.pathname === "/api/pdf") {
        if (!this.#cliVersion) {
          this.#sendJson(response, 501, { error: "the typst CLI is not installed; PDF export is unavailable" });
          return;
        }
        const render = await compilePdf(this.#doc, {
          cwd: this.cwd,
          root: this.#root,
          fontPaths: this.#fontPaths,
          inputs: this.#inputs,
        });
        if (!render.ok || !render.pdf) {
          const message =
            formatDiagnostics(render.diagnostics, { cwd: this.cwd }) || rawStderr(render.stderr, 12) || "PDF export failed";
          response.writeHead(400, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
          response.end(message);
          return;
        }
        // HTTP header values must be latin-1: provide an ASCII fallback plus an
        // RFC 5987 UTF-8 name so unicode document names survive.
        const stem = basename(this.#doc, extname(this.#doc));
        const asciiName = (stem.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "document") + ".pdf";
        const utf8Name = encodeURIComponent(stem + ".pdf");
        this.#send(response, 200, "application/pdf", render.pdf, {
          "content-disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        });
        return;
      }

      if (method === "GET" && url.pathname === "/api/file") {
        const requested = url.searchParams.get("path");
        const abs = requested ? this.#real(requested) : null;
        if (!abs) {
          this.#sendJson(response, 400, { error: "invalid path" });
          return;
        }
        const info = await stat(abs).catch(() => null);
        if (!info) {
          this.#sendJson(response, 404, { error: `not found: ${requested}` });
          return;
        }
        if (!info.isFile()) {
          this.#sendJson(response, 404, { error: `not a file: ${requested}` });
          return;
        }
        if (info.size > MAX_FILE_BYTES) {
          this.#sendJson(response, 413, { error: `file too large to mirror (${info.size} bytes)` });
          return;
        }
        const body = await readFile(abs);
        this.#send(response, 200, MIME[extname(abs).toLowerCase()] ?? "application/octet-stream", body, {
          "last-modified": info.mtime.toUTCString(),
        });
        return;
      }

      if (method === "GET" && url.pathname.startsWith("/api/fonts/")) {
        await this.#serveFont(url.pathname.slice("/api/fonts/".length), response);
        return;
      }

      if (method === "GET" && url.pathname.startsWith("/vendor/")) {
        await this.#serveVendor(url.pathname, request, response);
        return;
      }

      if (method === "POST" && url.pathname === "/api/select") {
        const body = await this.#readBody(request);
        let docPath: unknown;
        try {
          docPath = (JSON.parse(body) as { doc?: unknown }).doc;
        } catch {
          this.#sendJson(response, 400, { error: "invalid JSON body" });
          return;
        }
        if (typeof docPath !== "string" || !docPath) {
          this.#sendJson(response, 400, { error: "missing 'doc' string" });
          return;
        }
        try {
          this.#sendJson(response, 200, await this.selectDoc(docPath));
        } catch (error) {
          this.#sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
        }
        return;
      }

      this.#sendJson(response, 404, { error: `no route for ${method} ${url.pathname}` });
    } catch (error) {
      this.#sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  async #tree(): Promise<{ workspace: string; files: PreviewFile[]; truncated: boolean; skippedBig: number }> {
    const files: PreviewFile[] = [];
    let truncated = false;
    let skippedBig = 0;

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (files.length >= MAX_TREE_FILES || depth > TREE_MAX_DEPTH) {
        truncated = true;
        return;
      }
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (files.length >= MAX_TREE_FILES) {
          truncated = true;
          return;
        }
        if (entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (WORKSPACE_SKIP_DIRS.has(entry.name)) continue;
          await walk(full, depth + 1);
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          // `stat` follows symlinks, so linked files are mirrored but linked
          // directories are never walked (no cycles).
          const info = await stat(full).catch(() => null);
          if (!info?.isFile()) continue;
          if (info.size > MAX_FILE_BYTES) {
            skippedBig++;
            continue;
          }
          files.push({ path: this.#vfs(full), size: info.size, mtimeMs: Math.round(info.mtimeMs) });
        }
      }
    };

    await walk(this.#workspace, 0);
    return { workspace: this.#workspace, files, truncated, skippedBig };
  }

  async #serveFont(name: string, response: ServerResponse): Promise<void> {
    let decoded: string;
    try {
      decoded = decodeURIComponent(name);
    } catch {
      this.#sendJson(response, 400, { error: `malformed font name: ${name}` });
      return;
    }
    const spec = FONT_INDEX.get(decoded);
    if (!spec) {
      this.#sendJson(response, 404, { error: `unknown font asset: ${decoded}` });
      return;
    }

    const cachePath = join(this.#fontCacheDir, decoded);
    const cached = await readFile(cachePath).catch(() => null);
    if (cached) {
      this.#send(response, 200, MIME[extname(decoded)] ?? "font/otf", cached, {
        "cache-control": "public, max-age=31536000, immutable",
      });
      return;
    }

    const upstream = spec.upstream + decoded;
    try {
      const fetched = await fetch(upstream);
      if (!fetched.ok) throw new Error(`HTTP ${fetched.status}`);
      const body = Buffer.from(await fetched.arrayBuffer());
      await writeFile(cachePath, body).catch(() => {});
      this.#send(response, 200, MIME[extname(decoded)] ?? "font/otf", body, {
        "cache-control": "public, max-age=31536000, immutable",
      });
    } catch (error) {
      this.#sendJson(response, 502, {
        error: `could not fetch font ${decoded} from ${upstream} (${error instanceof Error ? error.message : String(error)})`,
      });
    }
  }

  async #serveVendor(pathname: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.#vendorRoot) {
      this.#sendJson(response, 404, { error: "typst.ts runtime is not installed locally; viewer will use the CDN" });
      return;
    }
    const rest = pathname.slice("/vendor/".length);
    const slash = rest.indexOf("/");
    const pkg = slash === -1 ? "" : rest.slice(0, slash);
    const sub = slash === -1 ? "" : rest.slice(slash + 1);
    if (!(pkg in VENDOR_PACKAGES) || !sub || sub.includes("..")) {
      this.#sendJson(response, 404, { error: `no vendor asset for ${pathname}` });
      return;
    }
    const extension = sub.endsWith(".d.ts") ? ".d.ts" : sub.endsWith(".d.mts") ? ".d.mts" : extname(sub).toLowerCase();
    if (!VENDOR_EXTENSIONS.has(extension)) {
      this.#sendJson(response, 403, { error: `vendor extension not served: ${extension}` });
      return;
    }
    const abs = join(this.#vendorRoot, VENDOR_PACKAGES[pkg as VendorPackage], sub);
    const info = await stat(abs).catch(() => null);
    if (!info?.isFile()) {
      this.#sendJson(response, 404, { error: `vendor asset not found: ${sub}` });
      return;
    }
    const modifiedSince = request.headers["if-modified-since"];
    if (modifiedSince && new Date(modifiedSince).getTime() >= Math.floor(info.mtimeMs / 1000) * 1000) {
      response.writeHead(304, { "cache-control": "no-cache" }).end();
      return;
    }
    const body = await readFile(abs);
    this.#send(response, 200, MIME[extension] ?? "application/octet-stream", body, {
      "last-modified": info.mtime.toUTCString(),
      "cache-control": "no-cache",
    });
  }

  #send(
    response: ServerResponse,
    status: number,
    contentType: string,
    body: string | Buffer,
    headers: Record<string, string> = {},
  ): void {
    const payload = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    response.writeHead(status, {
      "content-type": contentType,
      "content-length": String(payload.length),
      "cache-control": "no-store",
      ...headers,
    });
    response.end(payload);
  }

  #sendJson(response: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}): void {
    this.#send(response, status, "application/json; charset=utf-8", JSON.stringify(payload), headers);
  }

  /** Cheap content tag for the file mirror: changes whenever a path, size, or mtime changes. */
  #treeTag(files: PreviewFile[]): string {
    let hash = 0;
    for (const file of files) {
      const line = `${file.path}:${file.mtimeMs}:${file.size}`;
      for (let i = 0; i < line.length; i++) {
        hash = (hash * 31 + line.charCodeAt(i)) | 0;
      }
    }
    return `W/"${files.length}-${hash}"`;
  }

  async #readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of request) {
      const buffer = chunk as Buffer;
      total += buffer.length;
      if (total > 1_000_000) throw new Error("request body too large");
      chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
}

/** Find the local typst.ts installation, if any. */
export async function resolveVendorRoot(): Promise<string | null> {
  const candidates = [
    process.env.PI_TYPST_VENDOR_DIR,
    join(import.meta.dirname, "..", "..", "node_modules"),
    join(import.meta.dirname, "..", "..", "..", "node_modules"),
    join(process.cwd(), "node_modules"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const probe = join(candidate, VENDOR_PACKAGES["typst.ts"], "dist", "esm", "contrib", "all-in-one-lite.bundle.js");
    if ((await stat(probe).catch(() => null))?.isFile()) return candidate;
  }
  return null;
}

export { TYPST_TS_VERSION as TYPST_TS_RELEASE };
