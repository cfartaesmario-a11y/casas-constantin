/* ================================================================
   NEBULA — navegador real dentro de Claude OS
   ----------------------------------------------------------------
   Cómo carga las webs:
   1) "Directo": iframe normal. Solo para sitios que permiten ser
      incrustados (Wikipedia, Google con igu=1, Bing, YouTube embed,
      OpenStreetMap embed...). Funciona con todo su JavaScript.
   2) "Proxy": descarga el HTML a través de un proxy CORS y lo pinta
      en un iframe aislado (sandbox sin allow-same-origin). Así se
      saltan X-Frame-Options / frame-ancestors. Los enlaces y los
      formularios GET se interceptan para que sigan dentro de Nebula.
      Orden de proxies: el tuyo (Ajustes) -> públicos de reserva.
   3) Si nada funciona: página de error con botón para abrir la web
      en el navegador real.
   ================================================================ */

(function () {
  const STORE_PROXY = "nebula.proxy";
  const STORE_BOOKMARKS = "nebula.bookmarks";

  const PUBLIC_PROXIES = [
    (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
    (u) => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u)
  ];

  /* Hosts que aceptan ser incrustados tal cual */
  const FRAMABLE = [
    /(^|\.)wikipedia\.org$/, /(^|\.)wikimedia\.org$/, /(^|\.)wiktionary\.org$/,
    /(^|\.)bing\.com$/, /^www\.youtube-nocookie\.com$/,
    /^example\.(com|org)$/, /(^|\.)archive\.org$/
  ];

  const DEFAULT_SHORTCUTS = [
    { name: "Google",    url: "https://www.google.com",               bg: "#4285f4", glyph: "G" },
    { name: "Wikipedia", url: "https://es.wikipedia.org",             bg: "#4a5568", glyph: "W" },
    { name: "YouTube",   url: "https://www.youtube.com",              bg: "#ff0033", glyph: "▶" },
    { name: "METAR LEBL", url: "https://aviationweather.gov/api/data/metar?ids=LEBL&format=raw&hours=3", bg: "#f9a825", glyph: "✈" },
    { name: "Mapa",      url: "https://www.openstreetmap.org/#map=11/41.39/2.17", bg: "#58a55c", glyph: "⌖" },
    { name: "HN",        url: "https://news.ycombinator.com",         bg: "#ff6600", glyph: "Y" }
  ];

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

  /* ---------- normalizar lo que escribe el usuario ---------- */
  function toUrl(input) {
    const v = input.trim();
    if (!v) return null;
    if (/^claude:\/\//i.test(v)) return v.toLowerCase();
    if (/^https?:\/\//i.test(v)) return v;
    // parece dominio: sin espacios y con punto (o localhost)
    if (!/\s/.test(v) && (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(v) || /^localhost(:\d+)?/.test(v))) {
      return "https://" + v;
    }
    return "search:" + v;
  }

  /* Desenvuelve redirecciones de buscadores (google /url?q=, ddg uddg=) */
  function unwrap(url) {
    try {
      const u = new URL(url);
      if (/google\./.test(u.hostname) && u.pathname === "/url") return u.searchParams.get("q") || u.searchParams.get("url") || url;
      if (/duckduckgo\.com$/.test(u.hostname) && u.pathname.startsWith("/l/")) return u.searchParams.get("uddg") || url;
    } catch {}
    return url;
  }

  /* Reescrituras para que webs conocidas se puedan incrustar directamente */
  function rewrite(url) {
    let u;
    try { u = new URL(url); } catch { return { url, direct: false }; }
    const h = u.hostname.replace(/^m\./, "");

    // YouTube -> embed
    let yt = null;
    if (/(^|\.)youtube\.com$/.test(h)) {
      if (u.pathname === "/watch") yt = u.searchParams.get("v");
      else if (/^\/(shorts|live|embed)\//.test(u.pathname)) yt = u.pathname.split("/")[2];
    } else if (h === "youtu.be") yt = u.pathname.slice(1);
    if (yt) return { url: "https://www.youtube-nocookie.com/embed/" + yt + "?autoplay=1", direct: true, shown: url };

    // Google: con igu=1 se deja incrustar
    if (/(^|\.)google\.[a-z.]+$/.test(h) && (u.pathname === "/" || u.pathname === "/search" || u.pathname === "/webhp")) {
      u.searchParams.set("igu", "1");
      return { url: u.toString(), direct: true, shown: url };
    }

    // OpenStreetMap -> mapa embebible
    if (/(^|\.)openstreetmap\.org$/.test(h) && !u.pathname.startsWith("/export/embed")) {
      const m = (u.hash.match(/map=(\d+)\/(-?[\d.]+)\/(-?[\d.]+)/) || []);
      const z = +m[1] || 11, lat = +m[2] || 41.39, lon = +m[3] || 2.17;
      const d = 180 / Math.pow(2, z) * 1.2;
      const bbox = [lon - d * 1.6, lat - d, lon + d * 1.6, lat + d].map(n => n.toFixed(4)).join(",");
      return { url: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`, direct: true, shown: url };
    }
    if (/(^|\.)openstreetmap\.org$/.test(h)) return { url, direct: true };

    if (FRAMABLE.some(r => r.test(h))) return { url, direct: true };
    return { url, direct: false };
  }

  /* ---------- descarga con proxies y timeout ---------- */
  async function fetchWithTimeout(url, ms) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal, credentials: "omit", redirect: "follow" });
      if (!r.ok && r.status !== 404) throw new Error("HTTP " + r.status);
      const type = r.headers.get("content-type") || "";
      const finalUrl = r.headers.get("x-final-url");
      if (/^image\//.test(type)) return { kind: "image", blob: await r.blob(), type, finalUrl };
      const text = await r.text();
      if (!text) throw new Error("respuesta vacía");
      return { kind: /html|xml/.test(type) || /^\s*</.test(text) ? "html" : "text", text, type, finalUrl };
    } finally { clearTimeout(t); }
  }

  async function fetchPage(url) {
    const attempts = [];
    const mine = NebulaConfig.getProxy();
    if (mine) attempts.push(mine.includes("{url}")
      ? mine.replace("{url}", encodeURIComponent(url))
      : mine + (mine.includes("?") ? "&" : "?") + "url=" + encodeURIComponent(url));
    attempts.push(url); // por si la web tiene CORS abierto (APIs, JSON, texto...)
    PUBLIC_PROXIES.forEach(p => attempts.push(p(url)));

    let lastErr;
    for (const a of attempts) {
      try { return await fetchWithTimeout(a, a === url ? 5000 : 10000); }
      catch (e) { lastErr = e.name === "AbortError" ? new Error("tiempo agotado") : e; }
    }
    throw lastErr || new Error("sin conexión");
  }

  /* Script que se inyecta dentro de la página proxificada */
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
    // quitar CSP en <meta> y metas de refresh que sacarían la página del iframe
    html = html.replace(/<meta[^>]+http-equiv=["']?(content-security-policy|refresh)["']?[^>]*>/gi, "");
    // quitar <base> original para que no pise el nuestro
    html = html.replace(/<base\b[^>]*>/gi, "");
    const inject = base + INTERCEPT;
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + inject);
    if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, m => m + "<head>" + inject + "</head>");
    return "<!doctype html><head>" + inject + "</head>" + html;
  }

  /* ================================================================
     APP
     ================================================================ */
  Apps.browser = function (startUrl) {
    if (openWindows.browser) {
      focusWindow("browser");
      if (typeof startUrl === "string" && openWindows.browser._nebula) openWindows.browser._nebula.newTab(startUrl);
      return;
    }

    const body = document.createElement("div");
    body.className = "browser";
    body.innerHTML = `
      <div class="b-tabs"><div class="b-tablist"></div><button class="b-newtab" title="Nueva pestaña">+</button></div>
      <div class="b-chrome">
        <button class="b-btn" data-act="back" title="Atrás">‹</button>
        <button class="b-btn" data-act="fwd" title="Adelante">›</button>
        <button class="b-btn" data-act="reload" title="Recargar">↻</button>
        <button class="b-btn" data-act="home" title="Inicio">⌂</button>
        <form class="b-urlwrap">
          <span class="b-mode" title="Modo de carga"></span>
          <input class="b-url" spellcheck="false" autocomplete="off" placeholder="Busca o escribe una dirección">
        </form>
        <button class="b-btn" data-act="mode" title="Cambiar modo: directo / proxy">⇄</button>
        <button class="b-btn" data-act="star" title="Añadir a favoritos">☆</button>
        <button class="b-btn" data-act="external" title="Abrir en el navegador real">↗</button>
      </div>
      <div class="b-progress"><span></span></div>
      <div class="b-content"></div>`;

    const tabList = body.querySelector(".b-tablist");
    const content = body.querySelector(".b-content");
    const urlInput = body.querySelector(".b-url");
    const modeTag = body.querySelector(".b-mode");
    const progress = body.querySelector(".b-progress");
    const starBtn = body.querySelector('[data-act="star"]');

    const tabs = [];
    let active = null;
    let seq = 0;

    function bookmarks() { return load(STORE_BOOKMARKS, []); }

    /* ---------- pestañas ---------- */
    function newTab(url = "claude://start") {
      const tab = { id: ++seq, title: "Nueva pestaña", history: [], idx: -1, view: document.createElement("div"), frame: null, loadId: 0 };
      tab.view.className = "b-view";
      tab.el = document.createElement("div");
      tab.el.className = "b-tab";
      tab.el.innerHTML = `<span class="b-tab-title"></span><button class="b-tab-x" title="Cerrar pestaña">✕</button>`;
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
      return tab;
    }

    function closeTab(tab) {
      const i = tabs.indexOf(tab);
      tabs.splice(i, 1);
      tab.el.remove(); tab.view.remove();
      if (!tabs.length) { closeWindow("browser"); return; }
      if (active === tab) selectTab(tabs[Math.min(i, tabs.length - 1)]);
    }

    function selectTab(tab) {
      active = tab;
      tabs.forEach(t => {
        t.el.classList.toggle("active", t === tab);
        t.view.hidden = t !== tab;
      });
      refreshChrome();
    }

    function setTitle(tab, title) {
      tab.title = title || "Sin título";
      tab.el.querySelector(".b-tab-title").textContent = tab.title;
      tab.el.title = tab.title;
      if (tab === active) win.querySelector(".win-title").textContent = tab.title + " — Nebula";
    }

    function refreshChrome() {
      const tab = active; if (!tab) return;
      const entry = tab.history[tab.idx] || {};
      if (document.activeElement !== urlInput) urlInput.value = entry.url && entry.url !== "claude://start" ? entry.url : "";
      body.querySelector('[data-act="back"]').disabled = tab.idx <= 0;
      body.querySelector('[data-act="fwd"]').disabled = tab.idx >= tab.history.length - 1;
      modeTag.textContent = entry.mode === "direct" ? "directo" : entry.mode === "proxy" ? "proxy" : "";
      modeTag.className = "b-mode " + (entry.mode || "");
      starBtn.textContent = bookmarks().some(b => b.url === entry.url) ? "★" : "☆";
      if (win) win.querySelector(".win-title").textContent = (tab.title || "Nebula") + " — Nebula";
    }

    function setLoading(on) {
      progress.classList.toggle("on", on);
    }

    /* ---------- navegación ---------- */
    function navigate(tab, input, opts = {}) {
      let url = toUrl(input);
      if (!url) return;
      if (url.startsWith("search:")) url = "https://www.google.com/search?q=" + encodeURIComponent(url.slice(7));
      url = unwrap(url);
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

    async function render(tab) {
      const entry = tab.history[tab.idx];
      const loadId = ++tab.loadId;
      tab.view.innerHTML = "";
      tab.frame = null;
      if (tab === active) refreshChrome();

      if (entry.url.startsWith("claude://")) {
        renderStart(tab);
        return;
      }

      const rw = rewrite(entry.url);
      if (!entry.mode) entry.mode = rw.direct ? "direct" : "proxy";
      if (tab === active) refreshChrome();

      if (entry.mode === "direct") {
        const target = rw.direct ? rw.url : entry.url;
        let host = "";
        try { host = new URL(entry.url).hostname; } catch {}
        setTitle(tab, host || entry.url);
        const f = makeFrame(tab, false);
        f.src = target;
        if (tab === active) setLoading(true);
        f.addEventListener("load", () => { if (tab.loadId === loadId && tab === active) setLoading(false); }, { once: true });
        return;
      }

      // modo proxy
      setTitle(tab, "Cargando…");
      if (tab === active) setLoading(true);
      try {
        const res = await fetchPage(entry.url);
        if (tab.loadId !== loadId) return;
        if (res.finalUrl && res.finalUrl !== entry.url) entry.url = res.finalUrl;
        if (res.kind === "image") {
          const img = document.createElement("img");
          img.className = "b-image";
          img.src = URL.createObjectURL(res.blob);
          tab.view.appendChild(img);
          setTitle(tab, entry.url.split("/").pop() || "Imagen");
        } else {
          const f = makeFrame(tab, true);
          f.srcdoc = buildSrcdoc(res, entry.url);
          const m = res.kind === "html" && res.text.match(/<title[^>]*>([^<]*)<\/title>/i);
          let host = ""; try { host = new URL(entry.url).hostname; } catch {}
          setTitle(tab, (m && decodeEntities(m[1]).trim()) || host);
        }
      } catch (err) {
        if (tab.loadId !== loadId) return;
        renderError(tab, entry, err);
      } finally {
        if (tab.loadId === loadId && tab === active) { setLoading(false); refreshChrome(); }
      }
    }

    function decodeEntities(s) {
      const t = document.createElement("textarea"); t.innerHTML = s; return t.value;
    }

    function makeFrame(tab, proxied) {
      const f = document.createElement("iframe");
      f.className = "b-frame";
      f.setAttribute("referrerpolicy", "no-referrer");
      f.setAttribute("allow", "autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write");
      f.setAttribute("allowfullscreen", "");
      if (proxied) {
        // sin allow-same-origin: los scripts de la web no pueden tocar Claude OS
        f.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-modals allow-downloads");
      } else {
        f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation allow-downloads");
      }
      tab.view.appendChild(f);
      tab.frame = f;
      return f;
    }

    /* ---------- páginas internas ---------- */
    function renderStart(tab) {
      setTitle(tab, "Nueva pestaña");
      const marks = bookmarks();
      const items = DEFAULT_SHORTCUTS.concat(marks.map(b => ({ name: b.title, url: b.url, bg: "#8e6bff", glyph: (b.title || "?").trim().charAt(0).toUpperCase(), mark: true })));
      const div = document.createElement("div");
      div.className = "b-start";
      div.innerHTML = `
        <h2>Nebula</h2>
        <form class="b-searchform"><input class="b-search" placeholder="Buscar en Google o escribir una dirección" spellcheck="false"></form>
        <div class="b-shortcuts">
          ${items.map((s, i) => `
            <div class="b-shortcut" data-i="${i}" title="${esc(s.url)}">
              <div class="b-shortcut-icon" style="background:${esc(s.bg)}">${esc(s.glyph)}</div>
              <span>${esc(s.name)}</span>
              ${s.mark ? `<button class="b-unmark" data-url="${esc(s.url)}" title="Quitar de favoritos">✕</button>` : ""}
            </div>`).join("")}
        </div>`;
      div.querySelector(".b-searchform").addEventListener("submit", (e) => {
        e.preventDefault();
        navigate(tab, div.querySelector(".b-search").value);
      });
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
      tab.view.innerHTML = "";
      tab.view.appendChild(div);
      setLoading(false);
      refreshChrome();
      if (tab === active) setTimeout(() => div.querySelector(".b-search").focus(), 0);
    }

    function renderError(tab, entry, err) {
      let host = entry.url; try { host = new URL(entry.url).hostname; } catch {}
      setTitle(tab, "No se pudo cargar");
      const div = document.createElement("div");
      div.className = "b-error";
      div.innerHTML = `
        <h3>No se pudo abrir ${esc(host)}</h3>
        <p>Los proxies no respondieron (${esc(err && err.message || "error")}). Muchas webs grandes bloquean que las metan dentro de otra página.</p>
        <div class="b-error-actions">
          <button data-a="retry">Reintentar</button>
          <button data-a="direct">Probar incrustada directa</button>
          <button data-a="ext" class="primary">Abrir en el navegador real ↗</button>
        </div>
        <p class="b-hint">Para que casi todo cargue, despliega tu propio proxy gratis (archivo <code>proxy-worker.js</code>) y pon su URL en Ajustes → Proxy del navegador.</p>`;
      div.querySelector('[data-a="retry"]').onclick = () => render(tab);
      div.querySelector('[data-a="direct"]').onclick = () => { entry.mode = "direct"; render(tab); };
      div.querySelector('[data-a="ext"]').onclick = () => window.open(entry.url, "_blank", "noopener");
      tab.view.innerHTML = "";
      tab.view.appendChild(div);
    }

    /* ---------- mensajes desde las páginas proxificadas ---------- */
    function onMessage(e) {
      const d = e.data;
      if (!d || d.__nebula !== 1) return;
      const tab = tabs.find(t => t.frame && t.frame.contentWindow === e.source);
      if (!tab) return;
      if (d.type === "title" && d.title) setTitle(tab, String(d.title).slice(0, 120));
      if (d.type === "nav" && typeof d.url === "string" && /^https?:/i.test(d.url)) {
        if (d.newTab) newTab(unwrap(d.url));
        else navigate(tab, unwrap(d.url));
      }
      if (d.type === "external" && typeof d.url === "string" && /^https?:/i.test(d.url)) {
        window.open(d.url, "_blank", "noopener");
      }
    }
    window.addEventListener("message", onMessage);

    // Si se hace clic dentro de un iframe, la ventana no recibe pointerdown:
    // detectamos el foco del iframe para traer Nebula al frente.
    function onBlur() {
      setTimeout(() => {
        const a = document.activeElement;
        if (a && a.tagName === "IFRAME" && body.contains(a)) focusWindow("browser");
      }, 0);
    }
    window.addEventListener("blur", onBlur);

    /* ---------- controles ---------- */
    body.querySelector(".b-urlwrap").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = urlInput.value;
      urlInput.blur();
      navigate(active, v);
    });
    urlInput.addEventListener("focus", () => urlInput.select());
    urlInput.addEventListener("keydown", (e) => { if (e.key === "Escape") { urlInput.blur(); refreshChrome(); } });

    body.querySelector(".b-newtab").onclick = () => newTab();
    body.querySelector(".b-chrome").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const tab = active, entry = tab.history[tab.idx];
      switch (b.dataset.act) {
        case "back": go(tab, -1); break;
        case "fwd": go(tab, 1); break;
        case "reload": render(tab); break;
        case "home": navigate(tab, "claude://start"); break;
        case "mode":
          if (!entry || entry.url.startsWith("claude://")) return;
          entry.mode = entry.mode === "direct" ? "proxy" : "direct";
          render(tab);
          break;
        case "star": {
          if (!entry || entry.url.startsWith("claude://")) return;
          let list = bookmarks();
          if (list.some(x => x.url === entry.url)) list = list.filter(x => x.url !== entry.url);
          else list.push({ url: entry.url, title: tab.title });
          save(STORE_BOOKMARKS, list);
          refreshChrome();
          break;
        }
        case "external":
          if (entry && !entry.url.startsWith("claude://")) window.open(entry.url, "_blank", "noopener");
          break;
      }
    });

    const win = createWindow({ id: "browser", title: "Nebula", width: 980, height: 640, body });
    win._nebula = { newTab };

    // limpiar listeners globales al cerrar
    const obs = new MutationObserver(() => {
      if (!win.isConnected) {
        window.removeEventListener("message", onMessage);
        window.removeEventListener("blur", onBlur);
        obs.disconnect();
      }
    });
    obs.observe(WindowsLayer, { childList: true });

    newTab(typeof startUrl === "string" ? startUrl : "claude://start");
  };
})();
