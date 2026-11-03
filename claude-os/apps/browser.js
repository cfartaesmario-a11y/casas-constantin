/* ================================================================
   NEBULA — navegador de MCF OS
   ----------------------------------------------------------------
   Cómo carga las webs:
   1) "Directo": iframe normal, para webs que se dejan incrustar
      (Wikipedia, Bing, OpenStreetMap, archive.org...).
   2) "Proxy": descarga la página por un servicio intermedio y la
      pinta en un iframe aislado. Enlaces y formularios siguen dentro
      de Nebula. Orden: tu proxy (Ajustes) -> r.jina.ai (renderiza la
      página en un servidor, sirve también para webs con mucho JS) ->
      proxies públicos.
   3) Páginas propias: buscador (mcf://buscar), vídeos (mcf://videos,
      que es como se abre YouTube), historial e inicio.
   ================================================================ */

(function () {
  const STORE_PROXY = "nebula.proxy";
  const STORE_BOOKMARKS = "nebula.bookmarks";
  const STORE_HISTORY = "nebula.history";
  const HISTORY_MAX = 200;
  const HOME = "mcf://inicio";

  let iconSeq = 0;
  // cada copia de un SVG lleva ids propios: si un gradiente vive en una pestaña oculta, no rompe las demás
  const ICON = (name) => {
    const svg = (window.UIIcons && UIIcons[name]) || "";
    const n = ++iconSeq;
    return svg.replace(/id="([\w-]+)"/g, `id="$1-n${n}"`).replace(/url\(#([\w-]+)\)/g, `url(#$1-n${n})`);
  };

  /* Favicon real de una web (servicio de Google). En incógnito no se pide nada a terceros. */
  function faviconUrl(url) {
    try {
      const h = new URL(url).hostname;
      return h ? "https://www.google.com/s2/favicons?sz=64&domain=" + encodeURIComponent(h) : "";
    } catch { return ""; }
  }

  /* Hosts que aceptan ser incrustados tal cual */
  const FRAMABLE = [
    /(^|\.)wikipedia\.org$/, /(^|\.)wikimedia\.org$/, /(^|\.)wiktionary\.org$/,
    /(^|\.)bing\.com$/, /^example\.(com|org)$/, /(^|\.)archive\.org$/
  ];

  const DEFAULT_SHORTCUTS = [
    { name: "YouTube",    url: "https://www.youtube.com",  bg: "#ff0033" },
    { name: "Wikipedia",  url: "https://es.wikipedia.org", bg: "#4a5568" },
    { name: "METAR LEBL", url: "https://aviationweather.gov/api/data/metar?ids=LEBL&format=raw&hours=3", bg: "#f9a825" },
    { name: "Mapa",       url: "https://www.openstreetmap.org/#map=11/41.39/2.17", bg: "#58a55c" },
    { name: "Hacker News", url: "https://news.ycombinator.com", bg: "#ff6600" },
    { name: "Google",     url: "https://www.google.com",   bg: "#4285f4" }
  ];

  const VIDEO_CHIPS = ["Aviación", "Cabina A320", "Despegues", "Música", "Fórmula 1", "Tutoriales"];

  /* ---------- storage seguro (Safari privado lanza excepciones) ---------- */
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  window.NebulaConfig = {
    getProxy: () => load(STORE_PROXY, ""),
    setProxy: (v) => save(STORE_PROXY, (v || "").trim())
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

  /* ---------- normalizar lo que escribe el usuario ---------- */
  function toUrl(input) {
    const v = input.trim();
    if (!v) return null;
    if (/^mcf:\/\//i.test(v)) return v;
    if (/^claude:\/\//i.test(v)) return v.replace(/^claude:/i, "mcf:");
    if (/^https?:\/\//i.test(v)) return v;
    if (!/\s/.test(v) && (/^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(v) || /^localhost(:\d+)?/.test(v))) {
      return "https://" + v;
    }
    return "mcf://buscar?q=" + encodeURIComponent(v);
  }

  /* Desenvuelve redirecciones de buscadores (google /url?q=, ddg uddg=, bing ck/a) */
  function unwrap(url) {
    try {
      const u = new URL(url);
      if (/google\./.test(u.hostname) && u.pathname === "/url") return u.searchParams.get("q") || u.searchParams.get("url") || url;
      if (/duckduckgo\.com$/.test(u.hostname) && u.pathname.startsWith("/l/")) return u.searchParams.get("uddg") || url;
      if (/bing\.com$/.test(u.hostname) && u.pathname === "/ck/a") {
        const p = u.searchParams.get("u") || "";
        if (p.startsWith("a1")) {
          const b64 = p.slice(2).replace(/-/g, "+").replace(/_/g, "/");
          const dec = decodeURIComponent(escape(atob(b64 + "===".slice((b64.length + 3) % 4))));
          if (/^https?:\/\//.test(dec)) return dec;
        }
      }
    } catch {}
    return url;
  }

  /* YouTube y buscadores conocidos se abren con las páginas propias de Nebula */
  function routeInternal(url) {
    let u;
    try { u = new URL(url); } catch { return url; }
    const h = u.hostname.replace(/^(www|m|music)\./, "");
    if (h === "youtube.com" || h === "youtube-nocookie.com") {
      let id = null;
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (/^\/(shorts|live|embed)\//.test(u.pathname)) id = u.pathname.split("/")[2];
      if (id) return "mcf://videos/ver?v=" + encodeURIComponent(id);
      if (u.pathname === "/results") return "mcf://videos?q=" + encodeURIComponent(u.searchParams.get("search_query") || "");
      return "mcf://videos";
    }
    if (h === "youtu.be") return "mcf://videos/ver?v=" + encodeURIComponent(u.pathname.slice(1));
    if (/^google\.[a-z.]+$/.test(h) && (u.pathname === "/search" || u.pathname === "/")) {
      const q = u.searchParams.get("q");
      return q ? "mcf://buscar?q=" + encodeURIComponent(q) : HOME;
    }
    if (h === "bing.com" && u.pathname === "/search" && u.searchParams.get("q")) return "mcf://buscar?q=" + encodeURIComponent(u.searchParams.get("q"));
    if (/duckduckgo\.com$/.test(h) && u.searchParams.get("q")) return "mcf://buscar?q=" + encodeURIComponent(u.searchParams.get("q"));
    return url;
  }

  /* Dirección "real" de una página interna (para abrir fuera o copiar) */
  function publicUrl(url) {
    if (!url.startsWith("mcf://")) return url;
    const u = new URL(url.replace("mcf://", "https://mcf.local/"));
    const q = u.searchParams.get("q");
    if (u.pathname === "/buscar") return "https://www.google.com/search?q=" + encodeURIComponent(q || "");
    if (u.pathname === "/videos/ver") return "https://www.youtube.com/watch?v=" + encodeURIComponent(u.searchParams.get("v"));
    if (u.pathname === "/videos") return q ? "https://www.youtube.com/results?search_query=" + encodeURIComponent(q) : "https://www.youtube.com";
    return null;
  }

  /* Reescrituras para incrustar directamente */
  function rewrite(url) {
    let u;
    try { u = new URL(url); } catch { return { url, direct: false }; }
    const h = u.hostname.replace(/^m\./, "");
    if (/(^|\.)google\.[a-z.]+$/.test(h) && (u.pathname === "/" || u.pathname === "/search" || u.pathname === "/webhp")) {
      u.searchParams.set("igu", "1");
      return { url: u.toString(), direct: true };
    }
    if (/(^|\.)openstreetmap\.org$/.test(h) && !u.pathname.startsWith("/export/embed")) {
      const m = (u.hash.match(/map=(\d+)\/(-?[\d.]+)\/(-?[\d.]+)/) || []);
      const z = +m[1] || 11, lat = +m[2] || 41.39, lon = +m[3] || 2.17;
      const d = 180 / Math.pow(2, z) * 1.2;
      const bbox = [lon - d * 1.6, lat - d, lon + d * 1.6, lat + d].map(n => n.toFixed(4)).join(",");
      return { url: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`, direct: true };
    }
    if (/(^|\.)openstreetmap\.org$/.test(h)) return { url, direct: true };
    if (FRAMABLE.some(r => r.test(h))) return { url, direct: true };
    return { url, direct: false };
  }

  /* ================================================================
     DESCARGA: varias fuentes, timeout y caché en memoria
     ================================================================ */
  const cache = new Map();
  const CACHE_MS = 5 * 60 * 1000;

  function sources(url) {
    const list = [];
    const mine = NebulaConfig.getProxy();
    if (mine) list.push({ name: "tu proxy", timeout: 15000, url: mine.includes("{url}")
      ? mine.replace("{url}", encodeURIComponent(url))
      : mine + (mine.includes("?") ? "&" : "?") + "url=" + encodeURIComponent(url) });
    list.push({ name: "directo", timeout: 6000, url });
    list.push({ name: "jina", timeout: 30000, url: "https://r.jina.ai/" + url, headers: { "X-Return-Format": "html" }, rendered: true });
    list.push({ name: "allorigins", timeout: 12000, url: "https://api.allorigins.win/raw?url=" + encodeURIComponent(url) });
    list.push({ name: "codetabs", timeout: 12000, url: "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(url) });
    return list;
  }

  async function tryFetch(src) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), src.timeout);
    try {
      const r = await fetch(src.url, { signal: ctrl.signal, credentials: "omit", redirect: "follow", headers: src.headers || {} });
      if (!r.ok && r.status !== 404) throw new Error("HTTP " + r.status);
      const type = r.headers.get("content-type") || "";
      const finalUrl = r.headers.get("x-final-url");
      if (/^image\//.test(type)) return { kind: "image", blob: await r.blob(), type, finalUrl };
      const text = await r.text();
      if (!text) throw new Error("respuesta vacía");
      if (src.rendered && /^\s*\{"data":null/.test(text)) {
        let msg = "el servicio rechazó la web"; try { msg = JSON.parse(text).message.split(".")[0]; } catch {}
        throw new Error(msg);
      }
      const kind = /html|xml/.test(type) || /^\s*</.test(text) ? "html" : "text";
      return { kind, text, type, finalUrl, rendered: !!src.rendered && kind === "html", via: src.name };
    } finally { clearTimeout(t); }
  }

  async function fetchPage(url, { fresh = false } = {}) {
    const hit = cache.get(url);
    if (!fresh && hit && Date.now() - hit.t < CACHE_MS) return hit.res;
    let lastErr;
    for (const src of sources(url)) {
      try {
        const res = await tryFetch(src);
        cache.set(url, { t: Date.now(), res });
        if (cache.size > 60) cache.delete(cache.keys().next().value);
        return res;
      } catch (e) { lastErr = e.name === "AbortError" ? new Error("tiempo agotado") : e; }
    }
    throw lastErr || new Error("sin conexión");
  }

  /* ---------- lectores de resultados ---------- */
  /* Comprueba que los resultados tienen que ver con la búsqueda
     (algunos buscadores devuelven basura a los servidores intermedios) */
  function relevant(q, list) {
    const words = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter(w => w.length > 2);
    if (!words.length) return list;
    const ok = list.filter(r => {
      const t = (r.title + " " + r.snippet + " " + r.url).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return words.some(w => t.includes(w));
    });
    if (ok.length < Math.ceil(list.length / 2)) throw new Error("resultados no fiables");
    return ok;
  }

  async function searchDuck(q) {
    const res = await fetchPage("https://html.duckduckgo.com/html/?kl=es-es&q=" + encodeURIComponent(q));
    const doc = new DOMParser().parseFromString(res.text, "text/html");
    const out = [];
    doc.querySelectorAll(".result").forEach(r => {
      if (r.classList.contains("result--ad")) return;
      const a = r.querySelector("a.result__a[href]");
      if (!a) return;
      let href = a.getAttribute("href");
      if (href.startsWith("//")) href = "https:" + href;
      const link = unwrap(href);
      if (!/^https?:/.test(link) || /duckduckgo\.com/.test(hostOf(link))) return;
      const sn = r.querySelector(".result__snippet");
      out.push({ url: link, title: a.textContent.trim(), snippet: sn ? sn.textContent.trim() : "" });
    });
    if (!out.length) throw new Error("sin resultados");
    return relevant(q, out);
  }

  async function searchBing(q, page) {
    const url = "https://www.bing.com/search?q=" + encodeURIComponent(q) + "&setlang=es" + (page ? "&first=" + (page * 10 + 1) : "");
    const res = await fetchPage(url);
    const doc = new DOMParser().parseFromString(res.text, "text/html");
    const out = [];
    doc.querySelectorAll("li.b_algo").forEach(li => {
      const a = li.querySelector("h2 a[href]");
      if (!a) return;
      const link = unwrap(a.getAttribute("href"));
      if (!/^https?:/.test(link)) return;
      const p = li.querySelector(".b_caption p, p.b_lineclamp2, p.b_lineclamp3, p.b_lineclamp4, .b_paractl, p");
      out.push({ url: link, title: a.textContent.trim(), snippet: (p ? p.textContent : "").trim() });
    });
    if (!out.length) throw new Error("sin resultados legibles");
    return relevant(q, out);
  }

  async function searchWeb(q, page = 0) {
    if (page === 0) {
      try { return await searchDuck(q); } catch (e) { /* probamos Bing */ }
    }
    return searchBing(q, page);
  }

  async function searchVideos(q) {
    const res = await fetchPage("https://www.youtube.com/results?hl=es&gl=ES&search_query=" + encodeURIComponent(q));
    const m = res.text.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
    if (!m) throw new Error("YouTube no devolvió resultados");
    const data = JSON.parse(m[1]);
    const out = [];
    (function walk(o) {
      if (!o || typeof o !== "object" || out.length >= 40) return;
      if (o.videoRenderer && o.videoRenderer.videoId) {
        const v = o.videoRenderer;
        const txt = (x) => x ? (x.simpleText || (x.runs || []).map(r => r.text).join("")) : "";
        out.push({
          id: v.videoId, title: txt(v.title), channel: txt(v.ownerText || v.longBylineText),
          length: txt(v.lengthText), views: txt(v.shortViewCountText || v.viewCountText), ago: txt(v.publishedTimeText)
        });
        return;
      }
      for (const k in o) walk(o[k]);
    })(data);
    if (!out.length) throw new Error("no hay vídeos");
    return out;
  }

  async function wikiSummary(q) {
    const s = await fetch("https://es.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=" + encodeURIComponent(q)).then(r => r.json());
    const hit = s.query && s.query.search && s.query.search[0];
    if (!hit) return null;
    const sum = await fetch("https://es.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(hit.title.replace(/ /g, "_"))).then(r => r.json());
    if (!sum.extract || sum.type === "disambiguation") return null;
    return { title: sum.title, text: sum.extract, img: sum.thumbnail && sum.thumbnail.source, url: sum.content_urls && sum.content_urls.desktop.page };
  }

  /* Sugerencias de Google (JSONP, porque no tiene CORS) */
  let sugSeq = 0;
  function googleSuggest(q) {
    return new Promise((resolve) => {
      const cb = "__nbSug" + (++sugSeq);
      const s = document.createElement("script");
      const done = (v) => { delete window[cb]; s.remove(); resolve(v); };
      window[cb] = (data) => done((data && data[1] || []).map(x => Array.isArray(x) ? x[0] : x).slice(0, 6));
      s.onerror = () => done([]);
      setTimeout(() => window[cb] && done([]), 2500);
      s.src = "https://suggestqueries.google.com/complete/search?client=youtube&hl=es&q=" + encodeURIComponent(q) + "&callback=" + cb;
      document.head.appendChild(s);
    });
  }

  /* ================================================================
     Página proxificada: script que intercepta enlaces y formularios
     ================================================================ */
  const INTERCEPT = `<script>(function(){
    function send(m){ try{ parent.postMessage(Object.assign({__nebula:1}, m), "*"); }catch(e){} }
    document.addEventListener("click", function(e){
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || e.defaultPrevented) return;
      var raw = a.getAttribute("href") || "";
      if (raw.charAt(0) === "#") {
        e.preventDefault();
        var el = document.getElementById(decodeURIComponent(raw.slice(1))) || document.getElementsByName(raw.slice(1))[0];
        if (el) el.scrollIntoView({behavior:"smooth"});
        return;
      }
      if (/^(javascript|mailto|tel):/i.test(raw)) return;
      e.preventDefault();
      send({type:"nav", url:a.href, newTab: a.target==="_blank" || e.ctrlKey || e.metaKey || e.button===1});
    }, true);
    document.addEventListener("submit", function(e){
      var f = e.target; e.preventDefault();
      var action = f.action || document.baseURI;
      if ((f.method||"get").toLowerCase() !== "get") { send({type:"external", url:action}); return; }
      var u = new URL(action);
      var fd = new FormData(f);
      if (e.submitter && e.submitter.name) fd.append(e.submitter.name, e.submitter.value);
      u.search = new URLSearchParams(fd).toString();
      send({type:"nav", url:u.href});
    }, true);
    window.open = function(u){ if(u) send({type:"nav", url:new URL(u, document.baseURI).href, newTab:true}); return null; };
    function title(){ send({type:"title", title:document.title}); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", title); else title();
  })();<\/script>`;

  function buildSrcdoc(res, url) {
    const base = `<base href="${esc(url)}" target="_self">`;
    if (res.kind === "text") {
      return `<!doctype html><meta charset="utf-8">${base}<title>${esc(url)}</title>
        <style>body{margin:0;padding:24px;font:13px/1.6 "JetBrains Mono",ui-monospace,monospace;background:#fff;color:#1a1a1a}pre{white-space:pre-wrap;word-break:break-word;margin:0}</style>
        <pre>${esc(res.text)}</pre>`;
    }
    let html = res.text;
    html = html.replace(/<meta[^>]+http-equiv=["']?(content-security-policy|refresh)["']?[^>]*>/gi, "");
    html = html.replace(/<base\b[^>]*>/gi, "");
    // Página ya renderizada en servidor: sus scripts la volverían a montar (y suelen romperla)
    if (res.rendered) {
      html = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<link[^>]+rel=["']?(preload|modulepreload)["']?[^>]*as=["']?script[^>]*>/gi, "");
    }
    const inject = `<meta charset="utf-8">` + base + INTERCEPT;
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + inject);
    if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, m => m + "<head>" + inject + "</head>");
    return "<!doctype html><head>" + inject + "</head>" + html;
  }

  /* ================================================================
     APP
     ================================================================ */
  Apps.browser = function (startUrl, opts = {}) {
    if (typeof startUrl !== "string") startUrl = undefined;
    if (openWindows.browser) {
      focusWindow("browser");
      if ((startUrl || opts.private) && openWindows.browser._nebula) openWindows.browser._nebula.newTab(startUrl, { private: !!opts.private });
      return;
    }

    const body = document.createElement("div");
    body.className = "browser";
    body.innerHTML = `
      <div class="b-tabs">
        <div class="b-tablist"></div>
        <button class="b-newtab" title="Nueva pestaña (Alt+T)">+</button>
        <button class="b-newprivate" title="Nueva pestaña de incógnito (Alt+Shift+N)">${ICON("incognito")}</button>
      </div>
      <div class="b-chrome">
        <button class="b-btn" data-act="back" title="Atrás">‹</button>
        <button class="b-btn" data-act="fwd" title="Adelante">›</button>
        <button class="b-btn" data-act="reload" title="Recargar">↻</button>
        <button class="b-btn" data-act="home" title="Inicio">⌂</button>
        <form class="b-urlwrap">
          <span class="b-private-tag" title="Pestaña de incógnito">${ICON("incognito")}</span>
          <span class="b-mode" title="Cómo se ha cargado esta página"></span>
          <input class="b-url" spellcheck="false" autocomplete="off" placeholder="Busca o escribe una dirección">
        </form>
        <button class="b-btn" data-act="mode" title="Cambiar modo: directo / proxy">⇄</button>
        <button class="b-btn" data-act="star" title="Añadir a favoritos">☆</button>
        <button class="b-btn b-btn-svg" data-act="history" title="Historial">${ICON("history")}</button>
        <button class="b-btn" data-act="external" title="Abrir en el navegador real">↗</button>
      </div>
      <div class="b-progress"><span></span></div>
      <div class="b-content"></div>`;

    const tabList = body.querySelector(".b-tablist");
    const content = body.querySelector(".b-content");
    const urlInput = body.querySelector(".b-url");
    const urlWrap = body.querySelector(".b-urlwrap");
    const modeTag = body.querySelector(".b-mode");
    const progress = body.querySelector(".b-progress");
    const starBtn = body.querySelector('[data-act="star"]');

    const tabs = [];
    let active = null;
    let seq = 0;
    let win = null;

    const bookmarks = () => load(STORE_BOOKMARKS, []);
    const visits = () => load(STORE_HISTORY, []);

    function remember(tab, entry, title) {
      if (tab.private || entry.url === HOME || entry.url.startsWith("mcf://historial")) return;
      const list = visits().filter(v => v.url !== entry.url);
      list.unshift({ url: entry.url, title: title || tab.title, t: Date.now() });
      save(STORE_HISTORY, list.slice(0, HISTORY_MAX));
    }

    /* icono de pestaña */
    function tabIcon(tab, url) {
      const box = tab.el.querySelector(".b-tab-icon");
      if (!url || url === HOME) { box.innerHTML = ICON(tab.private ? "incognito" : "nebula"); return; }
      if (url.startsWith("mcf://videos")) { box.innerHTML = ICON("play"); return; }
      if (url.startsWith("mcf://buscar")) { box.innerHTML = ICON("search"); return; }
      if (url.startsWith("mcf://")) { box.innerHTML = ICON("history"); return; }
      if (tab.private) { box.innerHTML = ICON("globe"); return; }
      const img = new Image();
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => { box.innerHTML = ICON("globe"); };
      img.src = faviconUrl(url);
      box.innerHTML = "";
      box.appendChild(img);
    }

    /* ---------- pestañas ---------- */
    function newTab(url = HOME, opts = {}) {
      const tab = { id: ++seq, title: "Nueva pestaña", history: [], idx: -1, view: document.createElement("div"), frame: null, loadId: 0, private: !!opts.private, blobs: [] };
      tab.view.className = "b-view" + (tab.private ? " private" : "");
      tab.el = document.createElement("div");
      tab.el.className = "b-tab" + (tab.private ? " private" : "");
      tab.el.innerHTML = `<span class="b-tab-icon"></span><span class="b-tab-title"></span><button class="b-tab-x" title="Cerrar pestaña (Alt+W)">✕</button>`;
      tab.el.addEventListener("click", (e) => {
        if (e.target.classList.contains("b-tab-x")) { closeTab(tab); return; }
        selectTab(tab);
      });
      tab.el.addEventListener("auxclick", (e) => { if (e.button === 1) closeTab(tab); });
      tabs.push(tab);
      tabList.appendChild(tab.el);
      content.appendChild(tab.view);
      selectTab(tab);
      navigate(tab, url);
      tab.el.scrollIntoView({ inline: "nearest" });
      return tab;
    }

    function closeTab(tab) {
      const i = tabs.indexOf(tab);
      if (i < 0) return;
      tabs.splice(i, 1);
      tab.loadId++;
      tab.el.remove(); tab.view.remove();
      tab.blobs.forEach(u => URL.revokeObjectURL(u));
      tab.history = [];
      if (!tabs.length) { closeWindow("browser"); return; }
      if (active === tab) selectTab(tabs[Math.min(i, tabs.length - 1)]);
    }

    function selectTab(tab) {
      active = tab;
      tabs.forEach(t => {
        t.el.classList.toggle("active", t === tab);
        t.view.hidden = t !== tab;
      });
      setLoading(!!tab.loading);
      refreshChrome();
    }

    function setTitle(tab, title) {
      tab.title = title || "Sin título";
      tab.el.querySelector(".b-tab-title").textContent = tab.title;
      tab.el.title = tab.title;
      if (tab === active && win) win.querySelector(".win-title").textContent = tab.title;
    }

    function refreshChrome() {
      const tab = active; if (!tab) return;
      const entry = tab.history[tab.idx] || {};
      if (document.activeElement !== urlInput) urlInput.value = displayUrl(entry.url);
      body.querySelector('[data-act="back"]').disabled = tab.idx <= 0;
      body.querySelector('[data-act="fwd"]').disabled = tab.idx >= tab.history.length - 1;
      const labels = { direct: "directo", proxy: "proxy", rendered: "lectura", internal: "" };
      modeTag.textContent = labels[entry.mode] || "";
      modeTag.className = "b-mode " + (entry.mode || "");
      modeTag.title = entry.mode === "rendered" ? "Página renderizada en un servidor: se ve tal cual, pero sin animaciones ni botones que dependan de JavaScript" : "Cómo se ha cargado esta página";
      starBtn.textContent = bookmarks().some(b => b.url === entry.url) ? "★" : "☆";
      body.classList.toggle("is-private", !!tab.private);
      urlInput.placeholder = tab.private ? "Buscar en incógnito" : "Busca o escribe una dirección";
      if (win) win.querySelector(".win-title").textContent = tab.title || "Nebula";
    }

    /* La barra de direcciones solo muestra direcciones: lo que buscas
       se queda en el buscador de la página, no se copia aquí */
    function displayUrl(url) {
      if (!url || url === HOME) return "";
      if (url.startsWith("mcf://")) return url.split("?")[0];
      return url;
    }

    function setLoading(on) { progress.classList.toggle("on", on); }
    function tabLoading(tab, on) { tab.loading = on; if (tab === active) setLoading(on); }

    /* ---------- navegación ---------- */
    function navigate(tab, input, opts = {}) {
      let url = toUrl(input);
      if (!url) return;
      url = routeInternal(unwrap(url));
      const entry = { url, mode: opts.mode || null };
      tab.history = tab.history.slice(0, tab.idx + 1);
      tab.history.push(entry);
      tab.idx++;
      render(tab);
    }

    function go(tab, delta) {
      const n = tab.idx + delta;
      if (n < 0 || n >= tab.history.length) return;
      tab.idx = n;
      render(tab);
    }

    async function render(tab, { fresh = false } = {}) {
      const entry = tab.history[tab.idx];
      const loadId = ++tab.loadId;
      tab.view.innerHTML = "";
      tab.view.scrollTop = 0;
      tab.frame = null;
      tabIcon(tab, entry.url);
      tabLoading(tab, false);
      if (tab === active) refreshChrome();

      if (entry.url.startsWith("mcf://")) {
        entry.mode = "internal";
        const u = new URL(entry.url.replace("mcf://", "https://mcf.local/"));
        const page = u.pathname.replace(/\/$/, "");
        if (page === "/buscar") return renderSearch(tab, u.searchParams.get("q") || "", loadId);
        if (page === "/videos") return renderVideos(tab, u.searchParams.get("q") || "", loadId);
        if (page === "/videos/ver") return renderWatch(tab, u.searchParams.get("v"), loadId);
        if (page === "/historial") return renderHistory(tab);
        return renderStart(tab);
      }

      const rw = rewrite(entry.url);
      if (!entry.mode || entry.mode === "internal") entry.mode = rw.direct ? "direct" : "proxy";
      if (tab === active) refreshChrome();

      if (entry.mode === "direct") {
        setTitle(tab, hostOf(entry.url) || entry.url);
        remember(tab, entry);
        const f = makeFrame(tab, false);
        f.src = rw.direct ? rw.url : entry.url;
        tabLoading(tab, true);
        f.addEventListener("load", () => { if (tab.loadId === loadId) tabLoading(tab, false); }, { once: true });
        return;
      }

      setTitle(tab, "Cargando " + (hostOf(entry.url) || "") + "…");
      tabLoading(tab, true);
      tab.view.innerHTML = `<div class="b-loading"><span class="b-spin"></span><p>Cargando <b>${esc(hostOf(entry.url))}</b></p><small>Algunas webs tardan unos segundos la primera vez.</small></div>`;
      try {
        const res = await fetchPage(entry.url, { fresh });
        if (tab.loadId !== loadId) return;
        tab.view.innerHTML = "";
        if (res.finalUrl && res.finalUrl !== entry.url) entry.url = res.finalUrl;
        if (res.rendered) entry.mode = "rendered";
        if (res.kind === "image") {
          const img = document.createElement("img");
          img.className = "b-image";
          img.src = URL.createObjectURL(res.blob);
          tab.blobs.push(img.src);
          tab.view.appendChild(img);
          setTitle(tab, entry.url.split("/").pop() || "Imagen");
        } else {
          const f = makeFrame(tab, true);
          f.srcdoc = buildSrcdoc(res, entry.url);
          const m = res.kind === "html" && res.text.match(/<title[^>]*>([^<]*)<\/title>/i);
          setTitle(tab, (m && decodeEntities(m[1]).trim()) || hostOf(entry.url));
        }
        tabIcon(tab, entry.url);
        remember(tab, entry);
      } catch (err) {
        if (tab.loadId !== loadId) return;
        renderError(tab, entry, err);
      } finally {
        if (tab.loadId === loadId) { tabLoading(tab, false); if (tab === active) refreshChrome(); }
      }
    }

    function decodeEntities(s) {
      const t = document.createElement("textarea"); t.innerHTML = s; return t.value;
    }

    function makeFrame(tab, proxied, parent = tab.view) {
      const f = document.createElement("iframe");
      f.className = "b-frame";
      f.setAttribute("referrerpolicy", "no-referrer");
      f.setAttribute("allow", "autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write");
      f.setAttribute("allowfullscreen", "");
      if (proxied) {
        // sin allow-same-origin: los scripts de la web no pueden tocar MCF OS
        f.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-modals allow-downloads");
      } else if (tab.private && !("credentialless" in HTMLIFrameElement.prototype)) {
        f.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-modals allow-presentation");
      } else {
        f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation allow-downloads");
      }
      if (tab.private) { f.setAttribute("credentialless", ""); f.credentialless = true; }
      parent.appendChild(f);
      if (parent === tab.view) tab.frame = f;
      return f;
    }

    function page(tab, cls, html) {
      const div = document.createElement("div");
      div.className = "b-page " + cls;
      div.innerHTML = html;
      tab.view.innerHTML = "";
      tab.view.appendChild(div);
      return div;
    }

    /* Buscador reutilizable (inicio, resultados y vídeos) con sugerencias */
    function searchBox(tab, value, placeholder, onSubmit) {
      const form = document.createElement("form");
      form.className = "b-sbox";
      form.innerHTML = `<span class="b-sbox-ico">${ICON("search")}</span><input spellcheck="false" autocomplete="off" placeholder="${esc(placeholder)}" value="${esc(value)}"><button type="submit" title="Buscar">${ICON("arrow")}</button>`;
      const input = form.querySelector("input");
      form.addEventListener("submit", (e) => { e.preventDefault(); if (input.value.trim()) onSubmit(input.value.trim()); });
      attachSuggest(input, form, tab, (v) => onSubmit(v));
      return form;
    }

    /* ---------- desplegable de sugerencias ---------- */
    function attachSuggest(input, anchor, tabRef, onPick) {
      const box = document.createElement("div");
      box.className = "b-suggest";
      box.hidden = true;
      anchor.appendChild(box);
      let items = [], sel = -1, timer = null, token = 0;

      function draw() {
        box.hidden = !items.length;
        box.innerHTML = items.map((it, i) => `
          <div class="b-sug ${i === sel ? "sel" : ""}" data-i="${i}">
            <span class="b-sug-ico">${ICON(it.kind === "url" ? "globe" : it.kind === "hist" ? "history" : "search")}</span>
            <span class="b-sug-t">${esc(it.label)}</span>
            ${it.sub ? `<span class="b-sug-s">${esc(it.sub)}</span>` : ""}
          </div>`).join("");
      }
      async function update() {
        const q = input.value.trim();
        const my = ++token;
        sel = -1;
        if (!q) { items = []; draw(); return; }
        const tab = typeof tabRef === "function" ? tabRef() : tabRef;
        const ql = q.toLowerCase();
        const local = tab && tab.private ? [] : bookmarks().map(b => ({ url: b.url, title: b.title })).concat(visits())
          .filter((v, i, a) => a.findIndex(x => x.url === v.url) === i)
          .filter(v => !v.url.startsWith("mcf://") && (v.url.toLowerCase().includes(ql) || (v.title || "").toLowerCase().includes(ql)))
          .slice(0, 3).map(v => ({ kind: "hist", label: v.title || v.url, sub: hostOf(v.url), value: v.url }));
        const isUrl = !toUrl(q).startsWith("mcf://buscar");
        items = (isUrl ? [{ kind: "url", label: q, sub: "Ir a la web", value: q }] : [{ kind: "q", label: q, value: q }]).concat(local);
        draw();
        if (tab && tab.private) return;
        const sugs = await googleSuggest(q);
        if (my !== token || document.activeElement !== input) return;
        items = items.concat(sugs.filter(s => s.toLowerCase() !== ql).slice(0, 7 - items.length).map(s => ({ kind: "q", label: s, value: s })));
        draw();
      }
      input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 120); });
      input.addEventListener("keydown", (e) => {
        if (box.hidden) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (e.key === "ArrowDown") sel = sel + 1 >= items.length ? -1 : sel + 1;
          else sel = sel - 1 < -1 ? items.length - 1 : sel - 1;
          draw();
          if (sel >= 0) input.value = items[sel].kind === "hist" ? items[sel].value : items[sel].label;
        } else if (e.key === "Escape") { items = []; draw(); }
        else if (e.key === "Enter" && sel >= 0) {
          e.preventDefault();
          const v = items[sel].value; items = []; draw(); onPick(v);
        }
      });
      box.addEventListener("pointerdown", (e) => {
        const row = e.target.closest(".b-sug"); if (!row) return;
        e.preventDefault();
        const v = items[+row.dataset.i].value; items = []; draw(); onPick(v);
      });
      input.addEventListener("blur", () => { token++; setTimeout(() => { items = []; draw(); }, 120); });
      input.form && input.form.addEventListener("submit", () => { token++; items = []; draw(); });
    }

    /* ---------- páginas internas ---------- */
    function shortcutTile(s, i, isPrivate) {
      const letter = esc((s.name || "?").trim().charAt(0).toUpperCase());
      const fav = isPrivate ? "" : faviconUrl(s.url);
      return `
        <div class="b-shortcut" data-i="${i}" title="${esc(s.url)}">
          <div class="b-shortcut-icon" style="--fallback:${esc(s.bg || "#8e6bff")}">
            ${fav ? `<img src="${esc(fav)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
            <b>${letter}</b>
          </div>
          <span>${esc(s.name)}</span>
          ${s.mark ? `<button class="b-unmark" data-url="${esc(s.url)}" title="Quitar de favoritos">✕</button>` : ""}
        </div>`;
    }

    function renderStart(tab) {
      setTitle(tab, tab.private ? "Incógnito" : "Nueva pestaña");
      const items = DEFAULT_SHORTCUTS.concat(bookmarks().map(b => ({ name: b.title || b.url, url: b.url, bg: "#8e6bff", mark: true })));
      const div = page(tab, "b-start" + (tab.private ? " private" : ""), tab.private ? `
        <div class="b-incog-mark">${ICON("incognito")}</div>
        <h2>Incógnito</h2>
        <div class="b-sbox-slot"></div>
        <div class="b-incog-info">
          <p>Nebula no guardará lo que visites en esta pestaña: ni historial, ni sugerencias, ni iconos de las webs.</p>
          <div class="b-incog-cols">
            <div><strong>Se protege</strong><span>Tu historial en MCF OS</span><span>Cookies y datos de las webs (se borran al cerrar)</span></div>
            <div><strong>Sigue viendo lo que haces</strong><span>Las webs que visitas</span><span>Tu red, centro o proveedor de internet</span></div>
          </div>
        </div>` : `
        <div class="b-brand">
          <span class="b-brand-mark">${ICON("nebula")}</span>
          <h2>Nebula</h2>
        </div>
        <div class="b-sbox-slot"></div>
        <div class="b-shortcuts">${items.map((s, i) => shortcutTile(s, i, false)).join("")}</div>
        <button class="b-incog-cta">${ICON("incognito")}<span>Nueva pestaña de incógnito</span></button>`);
      const sb = searchBox(tab, "", "Busca en la web o escribe una dirección", (v) => navigate(tab, v));
      div.querySelector(".b-sbox-slot").replaceWith(sb);
      const cta = div.querySelector(".b-incog-cta");
      if (cta) cta.onclick = () => newTab(undefined, { private: true });
      div.querySelectorAll(".b-shortcut").forEach(s => s.addEventListener("click", (e) => {
        const un = e.target.closest(".b-unmark");
        if (un) {
          e.stopPropagation();
          save(STORE_BOOKMARKS, bookmarks().filter(b => b.url !== un.dataset.url));
          renderStart(tab);
          return;
        }
        navigate(tab, items[+s.dataset.i].url);
      }));
      refreshChrome();
      if (tab === active) setTimeout(() => sb.querySelector("input").focus(), 0);
    }

    /* ---------- resultados de búsqueda ---------- */
    async function renderSearch(tab, q, loadId) {
      setTitle(tab, q + " — Buscar");
      remember(tab, tab.history[tab.idx], q + " — Buscar");
      const div = page(tab, "b-serp", `
        <header class="b-serp-head">
          <span class="b-serp-logo">${ICON("nebula")}</span>
          <div class="b-sbox-slot"></div>
        </header>
        <nav class="b-serp-tabs">
          <button class="on">Todo</button>
          <button data-go="videos">Vídeos</button>
          <button data-go="google">Ver en Google</button>
        </nav>
        <div class="b-serp-body">
          <main class="b-serp-main">
            <div class="b-serp-videos"></div>
            <ol class="b-results">${'<li class="sk"><i></i><i></i><i></i></li>'.repeat(5)}</ol>
            <div class="b-serp-more"></div>
          </main>
          <aside class="b-serp-side"></aside>
        </div>`);
      div.querySelector(".b-sbox-slot").replaceWith(searchBox(tab, q, "Buscar", (v) => navigate(tab, v)));
      div.querySelector('[data-go="videos"]').onclick = () => navigate(tab, "mcf://videos?q=" + encodeURIComponent(q));
      div.querySelector('[data-go="google"]').onclick = () => navigate(tab, "https://www.google.com/search?igu=1&q=" + encodeURIComponent(q), { mode: "direct" });
      const list = div.querySelector(".b-results");
      tabLoading(tab, true);

      // Wikipedia (lateral)
      wikiSummary(q).then(w => {
        if (!w || tab.loadId !== loadId) return;
        const side = div.querySelector(".b-serp-side");
        side.innerHTML = `
          <article class="b-wiki">
            ${w.img ? `<img src="${esc(w.img)}" alt="" referrerpolicy="no-referrer">` : ""}
            <h3>${esc(w.title)}</h3>
            <p>${esc(w.text)}</p>
            <a href="#" data-u="${esc(w.url)}">Leer en Wikipedia</a>
          </article>`;
        side.querySelector("a").onclick = (e) => { e.preventDefault(); navigate(tab, w.url); };
      }).catch(() => {});

      // Vídeos (fila superior)
      searchVideos(q).then(vs => {
        if (tab.loadId !== loadId) return;
        const box = div.querySelector(".b-serp-videos");
        box.innerHTML = `<h4>Vídeos</h4><div class="b-vrow">${vs.slice(0, 4).map(videoCard).join("")}</div>`;
        wireVideoCards(tab, box, q);
      }).catch(() => {});

      let pageN = 0;
      const shown = new Set();
      async function loadWeb() {
        try {
          let rs = await searchWeb(q, pageN);
          if (tab.loadId !== loadId) return;
          rs = rs.filter(r => !shown.has(r.url));
          rs.forEach(r => shown.add(r.url));
          list.querySelectorAll(".sk").forEach(n => n.remove());
          list.insertAdjacentHTML("beforeend", rs.map(r => `
            <li>
              <a class="b-res" href="#" data-u="${esc(r.url)}">
                <span class="b-res-site">${tab.private ? "" : `<img src="${esc(faviconUrl(r.url))}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`}<span>${esc(hostOf(r.url))}</span><small>${esc(r.url.replace(/^https?:\/\//, "").slice(0, 70))}</small></span>
                <span class="b-res-title">${esc(r.title)}</span>
              </a>
              <p>${esc(r.snippet)}</p>
            </li>`).join(""));
          const more = div.querySelector(".b-serp-more");
          more.innerHTML = rs.length >= 5 && pageN < 4 ? `<button>Más resultados</button>` : "";
          const b = more.querySelector("button");
          if (b) b.onclick = () => { b.disabled = true; b.textContent = "Cargando…"; pageN++; loadWeb(); };
        } catch (err) {
          if (tab.loadId !== loadId) return;
          if (pageN > 0) { div.querySelector(".b-serp-more").innerHTML = `<p class="b-empty">No hay más resultados.</p>`; return; }
          list.innerHTML = "";
          const main = div.querySelector(".b-serp-main");
          main.insertAdjacentHTML("beforeend", `
            <div class="b-serp-fallback">
              <p>No se pudieron leer los resultados (${esc(err.message)}). Te muestro Google aquí mismo:</p>
              <div class="b-serp-gframe"></div>
            </div>`);
          const f = makeFrame(tab, false, main.querySelector(".b-serp-gframe"));
          f.src = "https://www.google.com/search?igu=1&q=" + encodeURIComponent(q);
        } finally {
          if (tab.loadId === loadId) tabLoading(tab, false);
        }
      }
      list.addEventListener("click", (e) => {
        const a = e.target.closest("[data-u]"); if (!a) return;
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) newTab(a.dataset.u, { private: tab.private });
        else navigate(tab, a.dataset.u);
      });
      list.addEventListener("auxclick", (e) => {
        const a = e.target.closest("[data-u]"); if (!a || e.button !== 1) return;
        e.preventDefault(); newTab(a.dataset.u, { private: tab.private });
      });
      loadWeb();
    }

    /* ---------- vídeos (YouTube dentro de Nebula) ---------- */
    function videoCard(v) {
      return `
        <button class="b-vcard" data-v="${esc(v.id)}">
          <span class="b-vthumb"><img src="https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg" alt="" loading="lazy">${v.length ? `<em>${esc(v.length)}</em>` : ""}</span>
          <span class="b-vtitle">${esc(v.title)}</span>
          <span class="b-vmeta">${esc(v.channel)}${v.views ? " · " + esc(v.views) : ""}${v.ago ? " · " + esc(v.ago) : ""}</span>
        </button>`;
    }
    function wireVideoCards(tab, root, q) {
      root.querySelectorAll(".b-vcard").forEach(c => c.onclick = (e) => {
        const url = "mcf://videos/ver?v=" + encodeURIComponent(c.dataset.v) + (q ? "&q=" + encodeURIComponent(q) : "");
        if (e.ctrlKey || e.metaKey) newTab(url, { private: tab.private }); else navigate(tab, url);
      });
    }

    async function renderVideos(tab, q, loadId) {
      const query = q || VIDEO_CHIPS[0];
      setTitle(tab, q ? q + " — Vídeos" : "Vídeos");
      remember(tab, tab.history[tab.idx], q ? q + " — Vídeos" : "Vídeos");
      const div = page(tab, "b-videos", `
        <header class="b-vhead">
          <span class="b-vlogo">${ICON("play")}<b>Vídeos</b></span>
          <div class="b-sbox-slot"></div>
        </header>
        <nav class="b-chips">${VIDEO_CHIPS.map(c => `<button class="${c.toLowerCase() === query.toLowerCase() ? "on" : ""}">${esc(c)}</button>`).join("")}</nav>
        <div class="b-vgrid">${'<div class="b-vcard sk"><span class="b-vthumb"></span><i></i><i></i></div>'.repeat(8)}</div>`);
      div.querySelector(".b-sbox-slot").replaceWith(searchBox(tab, q, "Buscar vídeos", (v) => navigate(tab, "mcf://videos?q=" + encodeURIComponent(v))));
      div.querySelectorAll(".b-chips button").forEach(b => b.onclick = () => navigate(tab, "mcf://videos?q=" + encodeURIComponent(b.textContent)));
      tabLoading(tab, true);
      try {
        const vs = await searchVideos(query);
        if (tab.loadId !== loadId) return;
        const grid = div.querySelector(".b-vgrid");
        grid.innerHTML = vs.map(videoCard).join("");
        wireVideoCards(tab, grid, query);
      } catch (err) {
        if (tab.loadId !== loadId) return;
        div.querySelector(".b-vgrid").innerHTML = `<p class="b-empty">No se pudieron cargar los vídeos (${esc(err.message)}). Prueba otra vez en unos segundos o abre YouTube fuera con ↗.</p>`;
      } finally {
        if (tab.loadId === loadId) tabLoading(tab, false);
      }
    }

    async function renderWatch(tab, id, loadId) {
      const entry = tab.history[tab.idx];
      const q = new URL(entry.url.replace("mcf://", "https://mcf.local/")).searchParams.get("q");
      setTitle(tab, "Vídeo");
      const div = page(tab, "b-watch", `
        <div class="b-player"></div>
        <p class="b-watch-tip">Si el vídeo dice "no disponible", ábrelo en <b>Ventana flotante</b>: algunos canales no dejan verlos dentro de otras webs.</p>
        <div class="b-watch-info">
          <h2 class="b-watch-title">&nbsp;</h2>
          <div class="b-watch-meta"></div>
          <div class="b-watch-actions">
            <button data-a="float">Ventana flotante</button>
            <button data-a="yt">Ver en YouTube ↗</button>
            ${q ? `<button data-a="back">Volver a "${esc(q)}"</button>` : ""}
          </div>
        </div>
        <h4 class="b-watch-more">Más vídeos</h4>
        <div class="b-vgrid small"></div>`);
      // El reproductor necesita enviar el origen: sin "referrer" YouTube muestra el error 153
      const f = document.createElement("iframe");
      f.className = "b-frame";
      f.setAttribute("allow", "autoplay; encrypted-media; fullscreen; picture-in-picture; web-share");
      f.setAttribute("allowfullscreen", "");
      f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      if (tab.private) { f.setAttribute("credentialless", ""); f.credentialless = true; }
      const host = tab.private ? "https://www.youtube-nocookie.com" : "https://www.youtube.com";
      f.src = `${host}/embed/${encodeURIComponent(id)}?rel=0&playsinline=1&hl=es`;
      div.querySelector(".b-player").appendChild(f);
      div.querySelector('[data-a="float"]').onclick = () => {
        const w = Math.min(1100, screen.availWidth - 80), h = Math.round(w * 9 / 16) + 60;
        window.open("https://www.youtube.com/watch?v=" + encodeURIComponent(id), "mcf-video", `popup,width=${w},height=${h},left=40,top=40`);
        f.src = "about:blank";
      };
      div.querySelector('[data-a="yt"]').onclick = () => window.open("https://www.youtube.com/watch?v=" + encodeURIComponent(id), "_blank", "noopener");
      const back = div.querySelector('[data-a="back"]');
      if (back) back.onclick = () => navigate(tab, "mcf://videos?q=" + encodeURIComponent(q));

      // título y relacionados (buscando por el título o la búsqueda original)
      try {
        let list = q ? await searchVideos(q).catch(() => []) : [];
        let me = list.find(v => v.id === id);
        if (!me) {
          const r = await searchVideos(id).catch(() => []);
          me = r.find(v => v.id === id) || me;
          if (!list.length && me) list = await searchVideos(me.title).catch(() => []);
        }
        if (tab.loadId !== loadId) return;
        if (me) {
          div.querySelector(".b-watch-title").textContent = me.title;
          div.querySelector(".b-watch-meta").textContent = [me.channel, me.views, me.ago].filter(Boolean).join(" · ");
          setTitle(tab, me.title);
          remember(tab, entry, me.title);
        }
        const grid = div.querySelector(".b-vgrid");
        const rel = list.filter(v => v.id !== id).slice(0, 12);
        grid.innerHTML = rel.map(videoCard).join("");
        wireVideoCards(tab, grid, q || (me && me.title) || "");
        if (!rel.length) div.querySelector(".b-watch-more").remove();
      } catch {}
    }

    /* ---------- historial ---------- */
    function renderHistory(tab) {
      setTitle(tab, "Historial");
      const list = visits();
      const fmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      const div = page(tab, "b-history", `
        <header><h2>Historial</h2>${list.length ? `<button class="b-hist-clear">Borrar historial</button>` : ""}</header>
        ${tab.private ? `<p class="b-hist-empty">Las pestañas de incógnito no se guardan aquí.</p>` : ""}
        ${list.length ? `<ul>${list.map((v, i) => `
          <li data-i="${i}">
            <span class="b-hist-ico">${v.url.startsWith("mcf://") ? ICON(v.url.startsWith("mcf://videos") ? "play" : "search") : `<img src="${esc(faviconUrl(v.url))}" alt="" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">`}</span>
            <span class="t">${esc(v.title || v.url)}</span>
            <span class="u">${esc(displayUrl(v.url))}</span>
            <time>${fmt.format(v.t)}</time>
          </li>`).join("")}</ul>` : `<p class="b-hist-empty">Todavía no has visitado ninguna web.</p>`}`);
      div.querySelectorAll("li").forEach(li => li.onclick = () => navigate(tab, list[+li.dataset.i].url));
      const clr = div.querySelector(".b-hist-clear");
      if (clr) clr.onclick = () => { save(STORE_HISTORY, []); renderHistory(tab); };
      refreshChrome();
    }

    function renderError(tab, entry, err) {
      const host = hostOf(entry.url) || entry.url;
      setTitle(tab, "No se pudo cargar");
      const div = page(tab, "b-error", `
        <h3>No se pudo abrir ${esc(host)}</h3>
        <p>Ninguna de las vías de carga respondió (${esc(err && err.message || "error")}). Algunas webs bloquean que se abran dentro de otra página.</p>
        <div class="b-error-actions">
          <button data-a="retry">Reintentar</button>
          <button data-a="direct">Probar incrustada directa</button>
          <button data-a="search">Buscar "${esc(host)}"</button>
          <button data-a="ext" class="primary">Abrir en el navegador real ↗</button>
        </div>
        <p class="b-hint">Para que casi todo cargue siempre, despliega tu propio proxy gratis (archivo <code>proxy-worker.js</code>) y pon su URL en Ajustes → Proxy del navegador.</p>`);
      div.querySelector('[data-a="retry"]').onclick = () => render(tab, { fresh: true });
      div.querySelector('[data-a="direct"]').onclick = () => { entry.mode = "direct"; render(tab); };
      div.querySelector('[data-a="search"]').onclick = () => navigate(tab, "mcf://buscar?q=" + encodeURIComponent(host));
      div.querySelector('[data-a="ext"]').onclick = () => window.open(entry.url, "_blank", "noopener");
    }

    /* ---------- mensajes desde las páginas proxificadas ---------- */
    function onMessage(e) {
      const d = e.data;
      if (!d || d.__nebula !== 1) return;
      const tab = tabs.find(t => t.frame && t.frame.contentWindow === e.source);
      if (!tab) return;
      if (d.type === "title" && d.title) setTitle(tab, String(d.title).slice(0, 120));
      if (d.type === "nav" && typeof d.url === "string" && /^https?:/i.test(d.url)) {
        if (d.newTab) newTab(unwrap(d.url), { private: tab.private });
        else navigate(tab, unwrap(d.url));
      }
      if (d.type === "external" && typeof d.url === "string" && /^https?:/i.test(d.url)) {
        window.open(d.url, "_blank", "noopener");
      }
    }
    window.addEventListener("message", onMessage);

    function onBlur() {
      setTimeout(() => {
        const a = document.activeElement;
        if (a && a.tagName === "IFRAME" && body.contains(a)) focusWindow("browser");
      }, 0);
    }
    window.addEventListener("blur", onBlur);

    /* ---------- controles ---------- */
    urlWrap.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = urlInput.value;
      urlInput.blur();
      navigate(active, v);
    });
    attachSuggest(urlInput, urlWrap, () => active, (v) => { urlInput.blur(); navigate(active, v); });
    urlInput.addEventListener("focus", () => urlInput.select());
    urlInput.addEventListener("keydown", (e) => { if (e.key === "Escape") { urlInput.blur(); refreshChrome(); } });

    body.querySelector(".b-newtab").onclick = () => newTab();
    body.querySelector(".b-newprivate").onclick = () => newTab(undefined, { private: true });
    body.addEventListener("keydown", (e) => {
      if (!e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "t" && !e.shiftKey) { e.preventDefault(); newTab(); }
      else if (k === "n" && e.shiftKey) { e.preventDefault(); newTab(undefined, { private: true }); }
      else if (k === "w") { e.preventDefault(); closeTab(active); }
      else if (k === "l" || k === "d") { e.preventDefault(); urlInput.focus(); }
    });
    body.querySelector(".b-chrome").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const tab = active, entry = tab.history[tab.idx];
      switch (b.dataset.act) {
        case "back": go(tab, -1); break;
        case "fwd": go(tab, 1); break;
        case "reload": render(tab, { fresh: true }); break;
        case "home": navigate(tab, HOME); break;
        case "history": navigate(tab, "mcf://historial"); break;
        case "mode":
          if (!entry || entry.url.startsWith("mcf://")) return;
          entry.mode = entry.mode === "direct" ? "proxy" : "direct";
          render(tab);
          break;
        case "star": {
          if (!entry || entry.url === HOME || entry.url.startsWith("mcf://historial")) return;
          let list = bookmarks();
          if (list.some(x => x.url === entry.url)) list = list.filter(x => x.url !== entry.url);
          else list.push({ url: entry.url, title: tab.title });
          save(STORE_BOOKMARKS, list);
          refreshChrome();
          break;
        }
        case "external": {
          const real = entry && publicUrl(entry.url);
          if (real) window.open(real, "_blank", "noopener");
          break;
        }
      }
    });

    win = createWindow({ id: "browser", title: "Nebula", width: 1040, height: 660, body });
    win._nebula = { newTab };

    const obs = new MutationObserver(() => {
      if (!win.isConnected) {
        window.removeEventListener("message", onMessage);
        window.removeEventListener("blur", onBlur);
        obs.disconnect();
      }
    });
    obs.observe(WindowsLayer, { childList: true });

    newTab(startUrl || HOME, { private: !!opts.private });
  };
})();
