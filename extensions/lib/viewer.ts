/**
 * Browser viewer for pi-typst.
 *
 * The whole Typst toolchain runs client-side via typst.ts (WebAssembly): this
 * document loads the typst.ts bundle from the preview server (or a CDN), mirrors
 * the workspace into the browser compiler, and renders the compiled document to
 * SVG. The server only serves files and fonts.
 */

export function viewerHtml(): string {
  return `<!doctype html>
<html lang="en" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>typst preview</title>
<style>
  :root {
    --bg: #f4f4f5;
    --panel: #ffffff;
    --text: #18181b;
    --muted: #71717a;
    --border: #e4e4e7;
    --accent: #2563eb;
    --ok: #16a34a;
    --warn: #d97706;
    --error-bg: #fef2f2;
    --error-border: #fecaca;
    --error-text: #991b1b;
    --shadow: 0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.06);
    --page-width: 900px;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  }
  html[data-theme="dark"] {
    --bg: #0f0f11;
    --panel: #17171a;
    --text: #e4e4e7;
    --muted: #a1a1aa;
    --border: #2a2a2f;
    --accent: #60a5fa;
    --ok: #4ade80;
    --warn: #fbbf24;
    --error-bg: #2a1111;
    --error-border: #7f1d1d;
    --error-text: #fecaca;
    --shadow: 0 1px 2px rgba(0,0,0,.5), 0 12px 32px rgba(0,0,0,.45);
  }
  @media (prefers-color-scheme: dark) {
    html[data-theme="auto"] {
      --bg: #0f0f11;
      --panel: #17171a;
      --text: #e4e4e7;
      --muted: #a1a1aa;
      --border: #2a2a2f;
      --accent: #60a5fa;
      --ok: #4ade80;
      --warn: #fbbf24;
      --error-bg: #2a1111;
      --error-border: #7f1d1d;
      --error-text: #fecaca;
      --shadow: 0 1px 2px rgba(0,0,0,.5), 0 12px 32px rgba(0,0,0,.45);
    }
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  header.bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 14px;
    background: color-mix(in srgb, var(--panel) 88%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .group { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .logo {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--accent);
    white-space: nowrap;
  }
  select, button, a.button {
    font: inherit;
    font-size: 13px;
    color: var(--text);
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
  }
  select:hover, button:hover, a.button:hover { border-color: var(--accent); }
  button[disabled] { opacity: .5; cursor: default; }
  select { max-width: 52ch; }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--border);
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
  .pill.ok .dot { background: var(--ok); }
  .pill.busy .dot { background: var(--warn); animation: pulse 1s ease-in-out infinite; }
  .pill.error .dot { background: var(--error-text); }
  @keyframes pulse { 50% { opacity: .25; } }
  main.pages {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    padding: 22px 14px 40px;
  }
  .page {
    width: 100%;
    max-width: var(--page-width);
    background: #ffffff;
    border-radius: 4px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  html[data-theme="dark"] .page { border: 1px solid var(--border); }
  .page svg { display: block; width: 100%; height: auto; }
  .placeholder {
    color: var(--muted);
    font-family: var(--mono);
    font-size: 12px;
    padding: 24px;
    text-align: center;
  }
  main.pdf {
    flex: 1;
    display: flex;
    padding: 12px;
    min-height: 0;
  }
  main.pdf iframe {
    flex: 1;
    width: 100%;
    min-height: 78vh;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--panel);
  }
  .banner {
    margin: 14px auto 0;
    width: calc(100% - 28px);
    max-width: 1200px;
    background: var(--error-bg);
    border: 1px solid var(--error-border);
    color: var(--error-text);
    border-radius: 8px;
    padding: 10px 14px;
  }
  .banner.warn {
    background: color-mix(in srgb, var(--warn) 12%, var(--panel));
    border-color: color-mix(in srgb, var(--warn) 45%, var(--border));
    color: var(--text);
  }
  .banner pre {
    margin: 0;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 40vh;
    overflow: auto;
  }
  footer.meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 8px 14px 14px;
    color: var(--muted);
    font-size: 12px;
    font-family: var(--mono);
  }
  @media print {
    header.bar, .banner, footer.meta { display: none !important; }
    body { background: #fff; }
    .page { box-shadow: none; border: none; max-width: none; }
    main.pages { gap: 0; padding: 0; }
  }
</style>
</head>
<body>
<header class="bar">
  <div class="group">
    <span class="logo">typst</span>
    <select id="doc-picker" title="Switch document"></select>
  </div>
  <div class="group">
    <span id="status" class="pill"><span class="dot"></span><span id="status-text">booting</span></span>
    <select id="zoom" title="Zoom">
      <option value="fit">fit</option>
      <option value="50">50%</option>
      <option value="75">75%</option>
      <option value="100">100%</option>
      <option value="125">125%</option>
      <option value="150">150%</option>
      <option value="200">200%</option>
    </select>
    <button id="reload" title="Recompile (r)">Reload</button>
    <button id="pdf" title="Download PDF (p)">PDF</button>
    <button id="theme" title="Cycle theme (t)">theme</button>
  </div>
</header>
<div id="banner" class="banner" hidden><pre id="banner-text"></pre></div>
<main id="pages" class="pages"><div class="placeholder">loading…</div></main>
<main id="pdf" class="pdf" hidden><iframe id="pdf-frame" title="PDF preview"></iframe></main>
<footer class="meta">
  <span id="meta-left"></span>
  <span id="meta-right"></span>
</footer>
<script type="module">
(function () {
  "use strict";

  var statusEl = document.getElementById("status");
  var statusText = document.getElementById("status-text");
  var banner = document.getElementById("banner");
  var bannerText = document.getElementById("banner-text");
  var pagesEl = document.getElementById("pages");
  var picker = document.getElementById("doc-picker");
  var zoomEl = document.getElementById("zoom");
  var pdfButton = document.getElementById("pdf");
  var reloadButton = document.getElementById("reload");
  var metaLeft = document.getElementById("meta-left");
  var metaRight = document.getElementById("meta-right");

  var state = null;
  var typst = null;
  var vfsDoc = "/main.typ";
  var pdfMain = document.getElementById("pdf");
  var pdfFrame = document.getElementById("pdf-frame");
  var pdfMode = false;
  var pdfObjectUrl = null;
  var pdfOldUrls = [];
  var pdfSize = 0;
  var seen = new Map();
  var seenBytes = new Map();
  var mirroredBytes = 0;
  var treeEtag = null;
  var lastStateAt = 0;
  var busy = false;
  var MIRROR_BUDGET = 96 * 1024 * 1024;
  var pageCount = 0;
  var lastMs = 0;
  var startedAt = Date.now();
  var lastCompile = null;

  var themeOrder = ["auto", "light", "dark"];
  var theme = localStorage.getItem("pi-typst-theme") || "auto";
  if (themeOrder.indexOf(theme) === -1) theme = "auto";
  document.documentElement.setAttribute("data-theme", theme);

  var zoom = localStorage.getItem("pi-typst-zoom") || "fit";
  applyZoom();

  function applyZoom() {
    if (pdfMode) {
      zoomEl.hidden = true;
      return;
    }
    zoomEl.value = zoom;
    if (zoom === "fit") {
      pagesEl.style.removeProperty("--page-width");
    } else {
      pagesEl.style.setProperty("--page-width", Math.round(9 * Number(zoom)) + "px");
    }
    localStorage.setItem("pi-typst-zoom", zoom);
  }

  function setStatus(kind, text) {
    statusEl.className = "pill " + kind;
    statusText.textContent = text;
  }

  function showBanner(text, warn) {
    if (!text) {
      banner.hidden = true;
      bannerText.textContent = "";
      return;
    }
    banner.hidden = false;
    banner.className = warn ? "banner warn" : "banner";
    bannerText.textContent = text;
  }

  function getJson(path) {
    return fetch(path, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(path + " -> HTTP " + r.status);
      return r.json();
    });
  }

  function prettyPath(path) {
    return String(path).replace(/^\\//, "");
  }

  function renderPicker() {
    picker.innerHTML = "";
    (state.docs || []).forEach(function (doc) {
      var option = document.createElement("option");
      option.value = doc.abs;
      option.textContent = doc.rel;
      if (doc.abs === state.doc.absolute) option.selected = true;
      picker.appendChild(option);
    });
  }

  function renderMeta() {
    if (pdfMode) {
      metaLeft.textContent =
        prettyPath(state.doc.path) + "  ·  PDF" + (pdfSize ? "  ·  " + Math.round(pdfSize / 1024) + " KiB" : "") + "  ·  live";
      metaRight.textContent = state.server.engine + "  ·  " + state.workspace;
      document.title = state.doc.name + " · typst preview";
      return;
    }
    var pages = pageCount === 1 ? "1 page" : pageCount + " pages";
    var when = new Date().toLocaleTimeString();
    metaLeft.textContent = prettyPath(state.doc.path) + "  ·  " + pages + "  ·  " + lastMs + " ms  ·  " + when;
    var cli = state.server.cliVersion ? "typst " + state.server.cliVersion : "typst CLI not found";
    metaRight.textContent = state.server.engine + "  ·  " + cli + "  ·  " + state.workspace;
    document.title = state.doc.name + " · typst preview";
  }

  async function boot() {
    setStatus("busy", "loading typst.ts");
    state = await getJson("/api/state");
    vfsDoc = state.doc.path;
    renderPicker();
    renderMeta();

    pdfMode = Boolean(state.preview && state.preview.mode === "pdf");
    if (pdfMode) {
      document.getElementById("pdf").hidden = false;
      pagesEl.hidden = true;
      zoomEl.hidden = true;
      if (state.preview.fallback) {
        showBanner("The typst CLI was not found; falling back to the typst.ts WASM preview.", true);
      }
      await loadPdf();
      setInterval(tick, 1200);
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) tick();
      });
      return;
    }

    var mod = await import(state.assets.typstTs + "dist/esm/contrib/all-in-one-lite.bundle.js");
    typst = mod.$typst;
    typst.setCompilerInitOptions({
      getWrapper: function () { return import(state.assets.compiler + "pkg/typst_ts_web_compiler.mjs"); },
      getModule: function () { return state.assets.compiler + "pkg/typst_ts_web_compiler_bg.wasm"; },
    });
    typst.setRendererInitOptions({
      getWrapper: function () { return import(state.assets.renderer + "pkg/typst_ts_renderer.mjs"); },
      getModule: function () { return state.assets.renderer + "pkg/typst_ts_renderer_bg.wasm"; },
    });
    typst.use(mod.TypstSnippet.disableDefaultFontAssets());
    typst.use(mod.TypstSnippet.preloadFontAssets({ assets: state.fonts.groups, assetUrlPrefix: state.fonts.prefix }));
    await typst.use(await mod.TypstSnippet.fetchPackageRegistry());

    setStatus("busy", "mirroring files");
    lastStateAt = Date.now();
    await sync(true);
    await render();
    setInterval(tick, 1200);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) tick();
    });
  }

  function releasePdfUrls() {
    // Keep the previous blob alive briefly: a PDF viewer may still range-request it.
    var stale = pdfOldUrls;
    pdfOldUrls = [];
    setTimeout(function () {
      stale.forEach(function (url) { URL.revokeObjectURL(url); });
    }, 15000);
  }

  async function loadPdf() {
    if (busy) return;
    busy = true;
    setStatus("busy", "compiling pdf");
    try {
      var response = await fetch("/api/pdf?rev=" + Date.now(), { cache: "no-store" });
      if (!response.ok) {
        var message = await response.text();
        showBanner(message || "PDF build failed (HTTP " + response.status + ")", false);
        setStatus("error", "compile error");
        return;
      }
      var blob = await response.blob();
      var nextUrl = URL.createObjectURL(blob);
      if (pdfObjectUrl) pdfOldUrls.push(pdfObjectUrl);
      pdfObjectUrl = nextUrl;
      pdfSize = blob.size;
      pdfFrame.src = nextUrl;
      releasePdfUrls();
      showBanner(null);
      setStatus("ok", "pdf " + Math.round(pdfSize / 1024) + " KiB");
      renderMeta();
    } catch (error) {
      showBanner(error && error.message ? error.message : String(error), false);
      setStatus("error", "pdf failed");
    } finally {
      busy = false;
    }
  }

  function openPdf() {
    var target = pdfObjectUrl || "/api/pdf";
    var anchor = document.createElement("a");
    anchor.href = target;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    if (pdfObjectUrl) anchor.download = state.doc.name.replace(/\.typ$/i, "") + ".pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function tickPdf() {
    if (document.hidden || busy) return;
    try {
      var headers = {};
      if (treeEtag) headers["if-none-match"] = treeEtag;
      var response = await fetch("/api/tree", { cache: "no-store", headers: headers });
      if (response.status === 304) {
        if (Date.now() - lastStateAt > 15000) await refreshState();
        return;
      }
      if (!response.ok) {
        setStatus("error", "server unreachable");
        return;
      }
      treeEtag = response.headers.get("etag");
      await refreshState();
      await loadPdf();
    } catch (error) {
      setStatus("error", "server unreachable");
    }
  }

  async function refreshState() {
    var fresh = await getJson("/api/state");
    lastStateAt = Date.now();
    if (fresh.doc.path !== state.doc.path) {
      state = fresh;
      vfsDoc = state.doc.path;
      renderPicker();
      return true;
    }
    state = fresh;
    return false;
  }

  async function sync(force) {
    var headers = {};
    if (!force && treeEtag) headers["if-none-match"] = treeEtag;
    var response = await fetch("/api/tree", { cache: "no-store", headers: headers });

    if (response.status === 304) {
      // Nothing changed on disk; only refresh the document list occasionally.
      if (Date.now() - lastStateAt < 10000) return false;
      return await refreshState();
    }
    if (!response.ok) throw new Error("/api/tree -> HTTP " + response.status);

    var tree = await response.json();
    treeEtag = response.headers.get("etag");
    var next = new Map();
    var changed = false;
    var skippedLarge = 0;

    for (var i = 0; i < tree.files.length; i++) {
      var file = tree.files[i];
      var size = file.size || 0;
      var alreadyMirrored = seen.has(file.path);
      next.set(file.path, file.mtimeMs);

      // Keep the browser from pulling an unbounded amount of workspace data.
      // Typst sources are always mirrored; large assets are skipped past the budget.
      if (!alreadyMirrored && mirroredBytes + size > MIRROR_BUDGET && !/\.typ$/i.test(file.path)) {
        skippedLarge++;
        continue;
      }

      if (force || seen.get(file.path) !== file.mtimeMs) {
        var fileResponse = await fetch("/api/file?path=" + encodeURIComponent(file.path), { cache: "no-store" });
        if (fileResponse.ok) {
          var bytes = new Uint8Array(await fileResponse.arrayBuffer());
          await typst.mapShadow(file.path, bytes);
          mirroredBytes += size - (seenBytes.get(file.path) || 0);
          seenBytes.set(file.path, size);
          changed = true;
        }
      }
    }

    seen.forEach(function (_mtime, path) {
      if (!next.has(path)) {
        typst.unmapShadow(path);
        mirroredBytes -= seenBytes.get(path) || 0;
        seenBytes.delete(path);
        changed = true;
      }
    });
    seen = next;

    if (await refreshState()) changed = true;

    if (tree.truncated || skippedLarge > 0) {
      showBanner(
        (tree.truncated ? "workspace too large: only the first files are mirrored. " : "") +
          (skippedLarge > 0 ? skippedLarge + " large asset(s) skipped to stay under the 96 MiB mirror budget; use typst_compile for the full document." : ""),
        true,
      );
    }
    return changed;
  }

  async function render() {
    if (busy) return;
    busy = true;
    setStatus("busy", "compiling");
    var started = performance.now();
    try {
      var compiler = await typst.getCompiler();
      var renderer = await typst.getRenderer();
      var compiled = await compiler.compile({ mainFilePath: vfsDoc, root: "/", diagnostics: "unix" });
      var diagnostics = compiled.diagnostics || [];
      var errors = diagnostics.filter(function (d) { return typeof d === "string" && d.indexOf("error") !== -1; });
      if (errors.length > 0) {
        showBanner(errors.join("\\n"), false);
        setStatus("error", "compile error");
      } else if (diagnostics.length > 0) {
        showBanner(diagnostics.join("\\n"), true);
        setStatus("warn", "warnings");
      } else {
        showBanner(null);
      }
      if (compiled.result) {
        var svg = await renderer.renderSvg({ artifactContent: compiled.result });
        pagesEl.innerHTML = svg;
        pageCount = (svg.match(/class="typst-page"/g) || []).length || (svg.indexOf("<svg") === -1 ? 0 : 1);
        lastMs = Math.round(performance.now() - started);
        lastCompile = Date.now();
        if (errors.length === 0) setStatus("ok", lastMs + " ms");
        renderMeta();
      } else if (errors.length === 0) {
        pagesEl.innerHTML = '<div class="placeholder">no output</div>';
        setStatus("ok", "empty");
      }
    } catch (error) {
      var message = error && error.message ? error.message : String(error);
      if (error && error.length) message = Array.prototype.join.call(error, "\\n");
      showBanner(message, false);
      setStatus("error", "render failed");
    } finally {
      busy = false;
    }
  }

  async function tick() {
    if (pdfMode) return await tickPdf();
    if (document.hidden || busy || !typst) return;
    try {
      var changed = await sync(false);
      if (changed) await render();
    } catch (error) {
      setStatus("error", "server unreachable");
    }
  }

  async function downloadPdf() {
    if (!typst || busy) return;
    pdfButton.disabled = true;
    setStatus("busy", "building pdf");
    try {
      var bytes = await typst.pdf({ mainFilePath: vfsDoc, root: "/" });
      if (!bytes) {
        setStatus("error", "pdf failed");
        return;
      }
      var blob = new Blob([bytes], { type: "application/pdf" });
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = state.doc.name.replace(/\\.typ$/i, "") + ".pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      setStatus("ok", "pdf ready");
    } catch (error) {
      showBanner(error && error.message ? error.message : String(error), false);
      setStatus("error", "pdf failed");
    } finally {
      pdfButton.disabled = false;
    }
  }

  async function selectDoc(abs) {
    setStatus("busy", "opening");
    var response = await fetch("/api/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ doc: abs }),
    });
    var next = await response.json();
    if (!response.ok) {
      showBanner(next.error || "could not switch document", false);
      setStatus("error", "select failed");
      return;
    }
    state = next;
    vfsDoc = state.doc.path;
    treeEtag = null;
    renderPicker();
    if (pdfMode) {
      await loadPdf();
    } else {
      seen = new Map();
      seenBytes = new Map();
      mirroredBytes = 0;
      typst.resetShadow();
      pagesEl.innerHTML = '<div class="placeholder">loading…</div>';
      await sync(true);
      await render();
    }
    location.hash = "doc=" + encodeURIComponent(state.doc.path);
  }

  picker.addEventListener("change", function () { selectDoc(picker.value); });
  zoomEl.addEventListener("change", function () { zoom = zoomEl.value; applyZoom(); });
  reloadButton.addEventListener("click", function () { if (pdfMode) loadPdf(); else render(); });
  pdfButton.addEventListener("click", function () { if (pdfMode) openPdf(); else downloadPdf(); });
  document.getElementById("theme").addEventListener("click", function () {
    theme = themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length];
    localStorage.setItem("pi-typst-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  });

  document.addEventListener("keydown", function (event) {
    var target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
    if (event.key === "r") { event.preventDefault(); if (pdfMode) loadPdf(); else render(); }
    if (event.key === "t") { document.getElementById("theme").click(); }
    if (event.key === "p") { event.preventDefault(); if (pdfMode) openPdf(); else downloadPdf(); }
  });

  boot().catch(function (error) {
    var message = error && error.message ? error.message : String(error);
    pagesEl.innerHTML = '<div class="placeholder">preview failed to start</div>';
    showBanner(message, false);
    setStatus("error", "boot failed");
  });
})();
</script>
</body>
</html>
`;
}
