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
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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

    // ------------------------------------------------------------- preview server
    process.stdout.write("\npreview server\n");
    const server = await PreviewServer.create({
      doc: transformer,
      cwd: EXAMPLES,
      workspace: EXAMPLES,
      port: 0,
    });
    const started = await server.start();
    const base = started.url;
    try {
      await check("state reports local assets and fonts", async () => {
        const state = server.state();
        assert.equal(state.assets.mode, "local");
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
        await check("typst.ts renders a CeTZ document in the browser", async () => {
          const dom = await runChrome(chrome, `${base}/`, 180_000);
          const pageGroups = (dom.match(/class="typst-page"/g) ?? []).length;
          assert.ok(pageGroups >= 1, "no rendered page groups in the DOM");
          const pill = dom.match(/id="status" class="([^"]*)"/)?.[1] ?? "";
          assert.equal(pill, "pill ok", `viewer status pill is "${pill}"`);
          const banner = dom.match(/id="banner-text">([\s\S]*?)<\/pre>/)?.[1] ?? "";
          assert.equal(banner.trim(), "", `viewer showed an error banner: ${banner.slice(0, 200)}`);
          const status = dom.match(/id="status-text">([^<]*)</)?.[1] ?? "";
          assert.match(status, /ms$/, `unexpected viewer status: ${status}`);
          return `${pageGroups} page group(s), status "${status}"`;
        });
      }
    } finally {
      await server.stop();
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
