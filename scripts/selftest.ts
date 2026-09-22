/**
 * pi-typst selftest.
 *
 * Verifies the three moving parts without any test framework:
 *   1. the typst CLI wrapper (binary discovery, compiles, diagnostics, previews)
 *   2. the preview server routes (state, tree, files, fonts, vendor assets)
 *   3. the browser viewer (typst.ts compiles a real CeTZ document in Chrome)
 *
 * Usage:
 *   node scripts/selftest.ts              # browser check runs when Chrome is found
 *   node scripts/selftest.ts --no-browser # skip the browser check
 *   node scripts/selftest.ts --browser    # require the browser check
 *
 * Debugging: set PI_TYPST_DUMP_DOM=/tmp/dom.html to save the last browser DOM
 * when a rendered-page assertion fails.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  compilePngPreviews,
  findTypFiles,
  formatDiagnostics,
  parseDiagnostics,
  resolveTypstBinary,
  runTypst,
} from "../extensions/lib/typst.ts";
import { parsePreviewArgs } from "../extensions/lib/args.ts";
import { defaultOutput, listOutputs, withTagPattern } from "../extensions/lib/outputs.ts";
import { PreviewServer, resolveVendorRoot } from "../extensions/lib/server.ts";

const ROOT = resolve(import.meta.dirname, "..");
const EXAMPLES = join(ROOT, "examples");
const args = new Set(process.argv.slice(2));
const requireBrowser = args.has("--browser");
const skipBrowser = args.has("--no-browser");

interface Result {
  name: string;
  status: "pass" | "fail" | "skip";
  note?: string;
  ms: number;
}

const results: Result[] = [];
let failures = 0;

async function check(name: string, fn: () => Promise<string | void>): Promise<void> {
  const started = Date.now();
  try {
    const note = await fn();
    results.push({ name, status: "pass", note: note ?? undefined, ms: Date.now() - started });
    process.stdout.write(`  ok   ${name}${note ? ` (${note})` : ""}\n`);
  } catch (error) {
    failures++;
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: "fail", note: message, ms: Date.now() - started });
    process.stdout.write(`  FAIL ${name}\n       ${message.split("\n").slice(0, 6).join("\n       ")}\n`);
  }
}

function skip(name: string, reason: string): void {
  results.push({ name, status: "skip", note: reason, ms: 0 });
  process.stdout.write(`  skip ${name} (${reason})\n`);
}

const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

const FIXTURE_DOC = `#import "@preview/cetz:0.5.2": canvas, draw
#import "../lib.typ": fixture-box
#set page(width: 6cm, height: 3cm, margin: 0.5cm)
#canvas(length: 1cm, {
  import draw: *
  fixture-box()
  content((0.7, 0.25), [fixture], anchor: "center")
})
#image("logo.png", width: 0.5cm)
`;

/** Assert a viewer DOM snapshot rendered cleanly; returns page count and status. */
function assertViewerOk(dom: string): { pages: number; status: string } {
  const pill = dom.match(/id="status" class="([^"]*)"/)?.[1] ?? "";
  const banner = (dom.match(/id="banner-text">([\s\S]*?)<\/pre>/)?.[1] ?? "").trim();
  const status = dom.match(/id="status-text">([^<]*)</)?.[1] ?? "";
  const pages = (dom.match(/class="typst-page" transform=/g) ?? []).length;
  assert.equal(pill, "pill ok", `viewer status pill is "${pill}" (banner: ${banner.slice(0, 160)})`);
  assert.equal(banner, "", `viewer showed an error banner: ${banner.slice(0, 200)}`);
  assert.ok(pages >= 1, "no rendered page groups in the DOM");
  return { pages, status };
}

/** Width of the first page viewBox in points. */
async function viewBoxWidth(dom: string): Promise<number> {
  const match = dom.match(/viewBox="0 0 ([0-9.]+) /);
  if (!match && process.env.PI_TYPST_DUMP_DOM) {
    await writeFile(process.env.PI_TYPST_DUMP_DOM, dom, "utf8").catch(() => {});
  }
  assert.ok(match, "no viewBox in the rendered SVG");
  return Number(match[1]);
}

function chromeBinary(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter((value): value is string => Boolean(value));
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function runChrome(binary: string, url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      binary,
      [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--virtual-time-budget=90000",
        "--dump-dom",
        url,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectPromise(new Error(`chrome timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (stdout.includes("<html")) resolvePromise(stdout);
      else rejectPromise(new Error(`chrome exited ${code}: ${stderr.slice(0, 400)}`));
    });
  });
}

async function main(): Promise<void> {
  process.stdout.write(`pi-typst selftest\nroot: ${ROOT}\n\n`);

  // ---------------------------------------------------------------- environment
  process.stdout.write("environment\n");
  let typstVersion = "";
  await check("typst CLI resolves", async () => {
    const info = await resolveTypstBinary();
    typstVersion = info.version;
    return `${info.bin} (${info.version}, via ${info.source})`;
  });
  await check("typst.ts vendor assets installed", async () => {
    const vendor = await resolveVendorRoot();
    assert.ok(vendor, "node_modules/@myriaddreamin is missing; run `npm install` in the package");
    const bundle = join(vendor, "@myriaddreamin/typst.ts/dist/esm/contrib/all-in-one-lite.bundle.js");
    const wasm = join(vendor, "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm");
    assert.ok((await stat(bundle)).size > 100_000, "typst.ts bundle looks truncated");
    assert.ok((await stat(wasm)).size > 1_000_000, "wasm compiler looks truncated");
    return vendor;
  });
  await check("example fixtures exist", async () => {
    const found = await findTypFiles(EXAMPLES, { maxDepth: 1, limit: 50 });
    assert.ok(found.length >= 5, `expected example documents, found ${found.length}`);
    return `${found.length} documents`;
  });

  // ------------------------------------------------------------- output helpers
  process.stdout.write("\noutput helpers\n");
  const outputsDir = await mkdtemp(join(tmpdir(), "pi-typst-outputs-"));
  try {
    for (const page of [1, 2, 10]) {
      await writeFile(join(outputsDir, `doc-${page}.svg`), `<svg>page ${page}</svg>`, "utf8");
    }
    await writeFile(join(outputsDir, "doc-x.svg"), "<svg>decoy</svg>", "utf8");
    await writeFile(join(outputsDir, "doc.pdf"), "%PDF-decoy", "utf8");

    await check("default output paths per format", async () => {
      assert.equal(defaultOutput("/a/b/note.typ", "pdf"), "/a/b/note.pdf");
      assert.equal(defaultOutput("/a/b/note.typ", "png"), "/a/b/note-{p}.png");
      assert.equal(defaultOutput("/a/b/note.typ", "svg"), "/a/b/note-{p}.svg");
      return "pdf/png/svg";
    });

    await check("page templates are added once", async () => {
      assert.equal(withTagPattern("/a/b/note.png", "png"), "/a/b/note-{p}.png");
      assert.equal(withTagPattern("/a/b/note-{p}.png", "png"), "/a/b/note-{p}.png");
      assert.equal(withTagPattern("/a/b/note-{0p}-of-{t}.png", "png"), "/a/b/note-{0p}-of-{t}.png");
      assert.equal(withTagPattern("/a/b/note.pdf", "pdf"), "/a/b/note.pdf");
      return "no double tags";
    });

    await check("expand a page pattern, excluding decoys", async () => {
      const result = await listOutputs(join(outputsDir, "doc-{p}.svg"), outputsDir);
      assert.deepEqual(
        result.files.map((file) => file.split("/").pop()),
        ["doc-1.svg", "doc-2.svg", "doc-10.svg"],
      );
      assert.ok(result.bytes > 30, "byte total is wrong");
      return `${result.files.length} files, ${result.bytes} bytes`;
    });

    await check("preview command arguments parse and reject bad input", async () => {
      const ok = parsePreviewArgs("docs/note.typ --port 8123 --host 0.0.0.0 --workspace docs --cjk --no-open");
      assert.equal(ok.ok, true);
      assert.deepEqual(ok.args, {
        doc: "docs/note.typ",
        port: 8123,
        host: "0.0.0.0",
        workspace: "docs",
        cjk: true,
        open: false,
      });

      const defaults = parsePreviewArgs("");
      assert.equal(defaults.ok, true);
      assert.equal(defaults.args.open, true, "the browser should open by default");
      assert.equal(defaults.args.port, undefined);

      for (const [input, fragment] of [
        ["--port 0", "--port needs a number"],
        ["--port abc", "--port needs a number"],
        ["--port 70000", "--port needs a number"],
        ["--port", "--port needs a number"],
        ["--host", "--host needs a value"],
        ["--workspace", "--workspace needs a value"],
        ["--wat", "Unknown option"],
        ["a.typ b.typ", "Unexpected extra argument"],
      ] as Array<[string, string]>) {
        const result = parsePreviewArgs(input);
        assert.equal(result.ok, false, `expected "${input}" to fail`);
        assert.match(
          result.ok ? "" : result.error,
          new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        );
      }
      return "valid + 8 rejections";
    });

    await check("plain output path resolves to one file", async () => {
      const result = await listOutputs(join(outputsDir, "doc.pdf"), outputsDir);
      assert.deepEqual(result.files.map((file) => file.split("/").pop()), ["doc.pdf"]);
      return "1 file";
    });
  } finally {
    await rm(outputsDir, { recursive: true, force: true }).catch(() => {});
  }

  // ---------------------------------------------------------------- CLI wrapper
  process.stdout.write("\nCLI wrapper\n");
  const tmp = await mkdtemp(join(tmpdir(), "pi-typst-selftest-"));
  try {
    const transformer = join(EXAMPLES, "transformer-block.typ");
    const explainer = join(EXAMPLES, "explainer.typ");
    const multiPage = join(tmp, "multi.typ");
    await writeFile(
      multiPage,
      [
        '#set page(width: 6cm, height: 3cm)',
        "Page one",
        "#pagebreak()",
        "Page two",
        "#pagebreak()",
        "Page three",
        "",
      ].join("\n"),
      "utf8",
    );

    await check("compile CeTZ document to PDF", async () => {
      const output = join(tmp, "transformer.pdf");
      const run = await runTypst(["compile", transformer, "--diagnostic-format", "short", "--root", ROOT, output]);
      assert.equal(run.ok, true, run.stderr);
      const info = await stat(output);
      const head = (await readFile(output)).subarray(0, 5).toString("latin1");
      assert.equal(head, "%PDF-", "output is not a PDF");
      return `${Math.round(info.size / 1024)} KiB, ${run.ms} ms`;
    });

    await check("compile multi-page document to SVG pages", async () => {
      const pattern = join(tmp, "multi-{p}.svg");
      const run = await runTypst(["compile", multiPage, "--format", "svg", "--diagnostic-format", "short", pattern]);
      assert.equal(run.ok, true, run.stderr);
      const pages = [];
      for (const page of [1, 2, 3]) {
        const svg = await readFile(join(tmp, `multi-${page}.svg`), "utf8").catch(() => null);
        assert.ok(svg && svg.includes("<svg"), `page ${page} missing`);
        pages.push(page);
      }
      return `${pages.length} pages`;
    });

    await check("parse structured diagnostics", async () => {
      const broken = join(tmp, "broken.typ");
      await writeFile(broken, '#set page(width: 4cm, height: 3cm)\n#panic("selftest")\n', "utf8");
      const run = await runTypst(["compile", broken, "--diagnostic-format", "short", join(tmp, "broken.pdf")]);
      assert.equal(run.ok, false, "broken document compiled unexpectedly");
      const diagnostics = parseDiagnostics(run.stderr);
      const error = diagnostics.find((diagnostic) => diagnostic.severity === "error");
      assert.ok(error, `no error diagnostic parsed from: ${run.stderr}`);
      assert.match(error.message, /selftest/);
      assert.equal(error.line, 2);
      return formatDiagnostics(diagnostics, { limit: 1 }).split("\n")[0];
    });

    await check("render inline PNG preview", async () => {
      const preview = await compilePngPreviews(explainer, { workDir: join(tmp, "png"), pages: "1", ppi: 96 });
      assert.equal(preview.ok, true, preview.stderr);
      assert.equal(preview.previews.length, 1);
      const first = preview.previews[0]!;
      const bytes = Buffer.from(first.data, "base64");
      assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], "preview is not a PNG");
      assert.ok(bytes.length > 10_000, "preview suspiciously small");
      return `page ${first.page}, ${Math.round(bytes.length / 1024)} KiB`;
    });

    await check("diagnose a missing document", async () => {
      const run = await runTypst(["compile", join(tmp, "nope.typ"), join(tmp, "nope.pdf")]);
      assert.equal(run.ok, false);
      assert.match(run.stderr, /not found|No such file|cannot|error/i);
      return "typst reports a missing input";
    });

    await check("every complete Typst example in the skills compiles", async () => {
      const skillFiles: string[] = [];
      const walk = async (dir: string): Promise<void> => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          if (entry.name === "vendor") continue; // third-party fragments are not complete documents
          const full = join(dir, entry.name);
          if (entry.isDirectory()) await walk(full);
          else if (entry.name.endsWith(".md")) skillFiles.push(full);
        }
      };
      await walk(join(ROOT, "skills"));

      let blocks = 0;
      const failures: string[] = [];
      for (const file of skillFiles) {
        const text = await readFile(file, "utf8");
        const matches = [...text.matchAll(/```typst\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");
        for (const [index, source] of matches.entries()) {
          blocks++;
          const sourcePath = join(tmp, `doc-${blocks}.typ`);
          await writeFile(sourcePath, source, "utf8");
          const run = await runTypst(["compile", sourcePath, "--diagnostic-format", "short", join(tmp, `doc-${blocks}.pdf`)]);
          if (!run.ok) {
            const detail = formatDiagnostics(parseDiagnostics(run.stderr), { limit: 2 }) || run.stderr.slice(0, 200);
            failures.push(`${file.replace(ROOT + "/", "")} block #${index + 1}: ${detail.split("\n")[0]}`);
          }
        }
      }
      assert.ok(blocks >= 10, `expected the skills to ship compiling examples, found ${blocks}`);
      assert.deepEqual(failures, [], `documentation examples failed to compile:\n${failures.join("\n")}`);
      return `${blocks} examples from ${skillFiles.length} skill files`;
    });

    // ------------------------------------------------------------- preview server
    process.stdout.write("\npreview server\n");
    const server = await PreviewServer.create({
      doc: transformer,
      cwd: EXAMPLES,
      workspace: EXAMPLES,
      port: 0,
      mode: "wasm",
    });
    const started = await server.start();
    const base = started.url;
    let fixtures: PreviewServer | null = null;
    let fixtureServer: PreviewServer | null = null;
    let pdfServer: PreviewServer | null = null;
    try {
      await check("state reports local assets and fonts", async () => {
        const state = server.state();
        assert.equal(state.assets.mode, "local");
        assert.equal(state.preview.mode, "wasm", "explicit wasm mode was not honoured");
        assert.ok(state.fonts.groups.includes("text"));
        assert.equal(state.doc.path, "/transformer-block.typ");
        assert.ok(state.docs.length >= 5, "document list is empty");
        return `${state.docs.length} documents, engine ${state.server.engine}`;
      });

      await check("serves the viewer HTML", async () => {
        const response = await fetch(`${base}/`);
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /all-in-one-lite\.bundle\.js/);
        assert.match(html, /typst-doc-picker|doc-picker/);
        return `${Math.round(html.length / 1024)} KiB`;
      });

      await check("mirrors the workspace tree", async () => {
        const response = await fetch(`${base}/api/tree`);
        const tree = (await response.json()) as { files: Array<{ path: string; mtimeMs: number }> };
        const paths = tree.files.map((file) => file.path);
        assert.ok(paths.includes("/transformer-block.typ"), "document missing from tree");
        assert.ok(paths.every((path) => path.startsWith("/")), "tree paths must be absolute in the virtual FS");
        return `${paths.length} files`;
      });

      await check("serves file bytes", async () => {
        const response = await fetch(`${base}/api/file?path=${encodeURIComponent("/transformer-block.typ")}`);
        assert.equal(response.status, 200);
        const text = await response.text();
        assert.match(text, /cetz:0\.5\.2/);
        return `${text.length} chars`;
      });

      await check("rejects path traversal", async () => {
        for (const path of ["/../../etc/passwd", "/..%2f..%2fetc%2fpasswd"]) {
          const response = await fetch(`${base}/api/file?path=${encodeURIComponent(path)}`);
          assert.ok([400, 404, 413].includes(response.status), `traversal returned ${response.status}`);
        }
        return "traversal blocked";
      });

      await check("serves typst.ts vendor assets", async () => {
        const bundle = await fetch(`${base}/vendor/typst.ts/dist/esm/contrib/all-in-one-lite.bundle.js`);
        assert.equal(bundle.status, 200);
        assert.match(bundle.headers.get("content-type") ?? "", /javascript/);
        const wasm = await fetch(`${base}/vendor/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm`);
        assert.equal(wasm.status, 200);
        assert.equal(wasm.headers.get("content-type"), "application/wasm");
        const size = Number(wasm.headers.get("content-length") ?? "0");
        assert.ok(size > 1_000_000, `wasm is ${size} bytes`);
        return `${Math.round(size / 1024 / 1024)} MiB wasm`;
      });

      await check("refuses vendor path traversal", async () => {
        const response = await fetch(`${base}/vendor/typst.ts/../../../etc/passwd`);
        assert.ok([403, 404].includes(response.status), `returned ${response.status}`);
        return "blocked";
      });

      await check("font route validates asset names", async () => {
        const unknown = await fetch(`${base}/api/fonts/../../etc/passwd`);
        assert.ok([400, 404].includes(unknown.status), `unknown font returned ${unknown.status}`);
        return "unknown font rejected";
      });

      await check("caches a real font asset", async () => {
        const response = await fetch(`${base}/api/fonts/NewCM10-Regular.otf`);
        if (response.status === 502) return "skipped: no network for the font CDN";
        assert.equal(response.status, 200);
        const bytes = new Uint8Array(await response.arrayBuffer());
        assert.ok(bytes.length > 50_000, `font is ${bytes.length} bytes`);
        const cacheHome = process.env.XDG_CACHE_HOME ? resolve(process.env.XDG_CACHE_HOME) : join(homedir(), ".cache");
        const cached = await stat(join(cacheHome, "pi-typst", "fonts", "NewCM10-Regular.otf")).catch(() => null);
        assert.ok(cached && cached.size > 50_000, "font was not written to the cache directory");
        return `${Math.round(bytes.length / 1024)} KiB (cached)`;
      });

      await check("switches documents", async () => {
        const response = await fetch(`${base}/api/select`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ doc: join(EXAMPLES, "attention-matrix.typ") }),
        });
        assert.equal(response.status, 200);
        const state = (await response.json()) as { doc: { path: string } };
        assert.equal(state.doc.path, "/attention-matrix.typ");
        await server.selectDoc(transformer);
        return state.doc.path;
      });

      await check("rejects unknown API routes", async () => {
        const response = await fetch(`${base}/api/nope`);
        assert.equal(response.status, 404);
        return "404";
      });

      // ------------------------------------------------- fixtures & edge cases
      const fixtureDir = join(tmp, "fixture");
      await mkdir(join(fixtureDir, "sub"), { recursive: true });
      await writeFile(
        join(fixtureDir, "lib.typ"),
        [
          '#import "@preview/cetz:0.5.2": draw',
          "#let fixture-box() = {",
          "  import draw: rect",
          '  rect((0, 0), (1.4, 0.5), radius: 2pt, fill: rgb("#dbeafe"))',
          "}",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(join(fixtureDir, "sub", "logo.png"), Buffer.from(ONE_PIXEL_PNG, "base64"));
      const fixtureDoc = join(fixtureDir, "sub", "main \u00fc.typ");
      await writeFile(fixtureDoc, FIXTURE_DOC, "utf8");
      await writeFile(
        join(fixtureDir, "\u4e2d\u6587.typ"),
        '#set page(width: 6cm, height: 2cm)\n\u4e2d\u6587\u6d4b\u8bd5\n',
        "utf8",
      );
      await writeFile(
        join(fixtureDir, "broken.typ"),
        '#set page(width: 6cm, height: 2cm)\n#panic("selftest browser error")\n',
        "utf8",
      );
      await symlink(fixtureDoc, join(fixtureDir, "link.typ"));

      const fxServer = await PreviewServer.create({
        doc: fixtureDoc,
        cwd: fixtureDir,
        workspace: fixtureDir,
        port: 0,
        mode: "wasm",
      });
      fixtures = fxServer;
      fixtureServer = fxServer;
      const fixtureBase = (await fxServer.start()).url;
      {
        await check("mirrors symlinked files and unicode paths", async () => {
          const tree = (await (await fetch(`${fixtureBase}/api/tree`)).json()) as { files: Array<{ path: string }> };
          const paths = tree.files.map((file) => file.path);
          assert.ok(paths.includes("/link.typ"), "symlinked file missing from the mirror");
          assert.ok(paths.includes("/sub/main \u00fc.typ"), `unicode path missing: ${paths.join(", ")}`);
          assert.ok(paths.includes("/lib.typ"), "sibling module missing");
          return `${paths.length} files incl. symlink + unicode`;
        });

        await check("tree responses carry an ETag and honour If-None-Match", async () => {
          const first = await fetch(`${fixtureBase}/api/tree`);
          const etag = first.headers.get("etag");
          assert.ok(etag && etag.startsWith('W/"'), `missing etag: ${etag}`);
          await first.json();
          const second = await fetch(`${fixtureBase}/api/tree`, { headers: { "if-none-match": etag } });
          assert.equal(second.status, 304);
          await writeFile(join(fixtureDir, "sub", "logo.png"), Buffer.from(ONE_PIXEL_PNG, "base64"));
          const third = await fetch(`${fixtureBase}/api/tree`, { headers: { "if-none-match": etag } });
          assert.equal(third.status, 200, "etag did not change after a file write");
          return "304 then 200";
        });

        await check("auto-detects CJK when switching documents", async () => {
          assert.deepEqual(fxServer.state().fonts.groups, ["text", "emoji"]);
          await fxServer.selectDoc(join(fixtureDir, "\u4e2d\u6587.typ"));
          assert.ok(fxServer.state().fonts.groups.includes("cjk"), "cjk font group was not enabled");
          await fxServer.selectDoc(fixtureDoc);
          assert.deepEqual(fxServer.state().fonts.groups, ["text", "emoji"]);
          return "cjk toggled by document content";
        });

        await check("rejects a malformed font name", async () => {
          const response = await fetch(`${fixtureBase}/api/fonts/%ZZ`);
          assert.equal(response.status, 400);
          return "400";
        });

        await check("distinguishes directories from files", async () => {
          const response = await fetch(`${fixtureBase}/api/file?path=${encodeURIComponent("/sub")}`);
          assert.equal(response.status, 404);
          const body = (await response.json()) as { error: string };
          assert.match(body.error, /not a file/);
          return "404 not a file";
        });

        await check("falls back to a free port when the requested one is taken", async () => {
          const blocker = createServer((_request, response) => response.end("busy"));
          const busyPort = await new Promise<number>((resolvePort) => {
            blocker.listen(0, "127.0.0.1", () => {
              const address = blocker.address();
              resolvePort(typeof address === "object" && address ? address.port : 0);
            });
          });
          const extra = await PreviewServer.create({ doc: fixtureDoc, cwd: fixtureDir, workspace: fixtureDir, port: busyPort });
          const startedExtra = await extra.start();
          try {
            assert.notEqual(startedExtra.port, busyPort);
            assert.equal((await fetch(`${startedExtra.url}/api/health`)).status, 200);
            return `requested ${busyPort}, served ${startedExtra.port}`;
          } finally {
            await extra.stop();
            await new Promise<void>((resolveClose) => blocker.close(() => resolveClose()));
          }
        });
      }

      // ----------------------------------------------------------- pdf-first mode
      pdfServer = await PreviewServer.create({
        doc: fixtureDoc,
        cwd: fixtureDir,
        workspace: fixtureDir,
        port: 0,
      });
      const pdfBase = (await pdfServer.start()).url;
      {
        const pdf = pdfServer;
        await check("pdf is the default preview mode when the CLI is installed", async () => {
          const state = pdf.state();
          assert.equal(state.preview.mode, "pdf");
          assert.equal(state.preview.pdf, true);
          assert.equal(state.preview.fallback, false);
          assert.match(state.server.engine, /PDF/);
          return state.server.engine;
        });

        await check("serves a CLI-compiled PDF", async () => {
          const response = await fetch(`${pdfBase}/api/pdf`);
          assert.equal(response.status, 200);
          assert.equal(response.headers.get("content-type"), "application/pdf");
          const disposition = response.headers.get("content-disposition") ?? "";
          assert.match(disposition, /inline/);
          assert.match(disposition, /filename\*=UTF-8''/, "unicode names need an RFC 5987 filename");
          const bytes = Buffer.from(await response.arrayBuffer());
          assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-");
          assert.ok(bytes.length > 1000, `PDF is only ${bytes.length} bytes`);
          return `${Math.round(bytes.length / 1024)} KiB`;
        });

        await check("returns diagnostics when the PDF cannot be built", async () => {
          await pdf.selectDoc(join(fixtureDir, "broken.typ"));
          const response = await fetch(`${pdfBase}/api/pdf`);
          assert.equal(response.status, 400);
          const text = await response.text();
          assert.match(text, /selftest browser error/);
          await pdf.selectDoc(fixtureDoc);
          return "400 + diagnostic text";
        });

        await check("falls back to wasm when the CLI is missing", async () => {
          const saved = process.env.TYPST_BIN;
          process.env.TYPST_BIN = join(tmp, "no-such-typst");
          try {
            const degraded = await PreviewServer.create({
              doc: transformer,
              cwd: EXAMPLES,
              workspace: EXAMPLES,
              port: 0,
              mode: "pdf",
            });
            try {
              const state = degraded.state();
              assert.equal(state.preview.mode, "wasm");
              assert.equal(state.preview.fallback, true);
              assert.equal(state.preview.pdf, false);
              const response = await fetch(`${(await degraded.start()).url}/api/pdf`);
              assert.equal(response.status, 501);
              return "pdf request degraded to wasm, /api/pdf reports 501";
            } finally {
              await degraded.stop();
            }
          } finally {
            if (saved === undefined) delete process.env.TYPST_BIN;
            else process.env.TYPST_BIN = saved;
          }
        });
      }

      // ------------------------------------------------------------------ browser
      process.stdout.write("\nbrowser viewer\n");
      const chrome = chromeBinary();
      if (skipBrowser) {
        skip("typst.ts renders a CeTZ document in the browser", "--no-browser");
      } else if (!chrome && !requireBrowser) {
        skip("typst.ts renders a CeTZ document in the browser", "no Chrome binary found");
      } else if (!chrome) {
        await check("typst.ts renders a CeTZ document in the browser", async () => {
          throw new Error("--browser was requested but no Chrome binary was found (set CHROME_PATH)");
        });
      } else {
        await check("wasm mode renders a CeTZ document in the browser", async () => {
          const result = assertViewerOk(await runChrome(chrome, `${base}/`, 180_000));
          return `${result.pages} page group(s), status "${result.status}"`;
        });

        await check("pdf mode shows a live PDF in the browser", async () => {
          const dom = await runChrome(chrome, `${pdfBase}/`, 180_000);
          const pill = dom.match(/id="status" class="([^"]*)"/)?.[1] ?? "";
          assert.equal(pill, "pill ok", `expected an ok pill, got "${pill}"`);
          const banner = (dom.match(/id="banner-text">([\s\S]*?)<\/pre>/)?.[1] ?? "").trim();
          assert.equal(banner, "", `unexpected banner: ${banner.slice(0, 160)}`);
          assert.match(dom, /id="pdf-frame"[^>]*src="blob:/, "the PDF iframe does not point at a blob URL");
          assert.match(dom, /id="status-text">pdf /, "status does not report the PDF size");
          return "iframe + blob PDF";
        });

        await check("renders a subdirectory document with a sibling import and an image", async () => {
          const result = assertViewerOk(await runChrome(chrome, `${fixtureBase}/`, 180_000));
          return `${result.pages} page group(s)`;
        });

        const fx = fixtureServer;
        assert.ok(fx, "fixture server was not started");
        await check("reports compile errors in the viewer", async () => {
          await fx.selectDoc(join(fixtureDir, "broken.typ"));
          const dom = await runChrome(chrome, `${fixtureBase}/`, 180_000);
          const pill = dom.match(/id="status" class="([^"]*)"/)?.[1] ?? "";
          const banner = (dom.match(/id="banner-text">([\s\S]*?)<\/pre>/)?.[1] ?? "").trim();
          assert.equal(pill, "pill error", `expected an error pill, got "${pill}"`);
          assert.match(banner, /selftest browser error/);
          return "error pill + diagnostic banner";
        });

        await check("picks up file edits across the whole pipeline", async () => {
          await fx.selectDoc(fixtureDoc);
          const before = await viewBoxWidth(await runChrome(chrome, `${fixtureBase}/`, 180_000));
          await writeFile(fixtureDoc, FIXTURE_DOC.replace("width: 6cm", "width: 10cm"), "utf8");
          const after = await viewBoxWidth(await runChrome(chrome, `${fixtureBase}/`, 180_000));
          assert.notEqual(before, after, "the rendered page width did not change after the edit");
          assert.ok(Math.abs(after - 283.46) < 2, `expected a 10cm page (283.46pt), got ${after}pt`);
          return `${before.toFixed(1)}pt -> ${after.toFixed(1)}pt`;
        });
      }

    } finally {
      await server.stop();
      if (fixtures) await fixtures.stop();
      if (pdfServer) await pdfServer.stop();
    }
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }

  // ------------------------------------------------------------------- summary
  const passed = results.filter((result) => result.status === "pass").length;
  const skipped = results.filter((result) => result.status === "skip").length;
  process.stdout.write(`\n${passed} passed, ${failures} failed, ${skipped} skipped`);
  if (typstVersion) process.stdout.write(` (typst ${typstVersion})`);
  process.stdout.write("\n");
  process.exit(failures === 0 ? 0 : 1);
}

await main();
