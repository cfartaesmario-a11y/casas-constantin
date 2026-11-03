/* ================================================================
   CLAUDE OS — Window manager + apps
   ================================================================ */

const WindowsLayer = document.getElementById("windows-layer");
const ActiveAppLbl = document.getElementById("active-app");

let zIndex = 100;
let openWindows = {};

/* ---------------- CLOCK ---------------- */
function tickClock() {
  const now = new Date();
  const opts = { hour: "2-digit", minute: "2-digit" };
  document.getElementById("clock").textContent =
    now.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }) +
    "  " + now.toLocaleTimeString("es-ES", opts);
}
setInterval(tickClock, 1000); tickClock();

/* ---------------- BOOT ---------------- */
setTimeout(() => {
  document.getElementById("boot").classList.add("gone");
  setTimeout(() => document.getElementById("boot").remove(), 700);
}, 2200);

/* ---------------- WINDOW MANAGER ---------------- */
function createWindow({ id, title, width = 720, height = 480, x, y, body }) {
  if (openWindows[id]) {
    focusWindow(id);
    return openWindows[id];
  }

  const w = document.createElement("div");
  w.className = "window";
  w.dataset.id = id;
  w.style.width = width + "px";
  w.style.height = height + "px";

  // center-ish position
  const vw = window.innerWidth, vh = window.innerHeight - 100;
  w.style.left = (x ?? Math.max(20, (vw - width) / 2 + (Object.keys(openWindows).length * 30))) + "px";
  w.style.top = (y ?? Math.max(50, (vh - height) / 2 + (Object.keys(openWindows).length * 30))) + "px";
  w.style.zIndex = ++zIndex;

  w.innerHTML = `
    <div class="win-titlebar">
      <div class="win-controls">
        <button class="win-dot win-close" title="Cerrar"></button>
        <button class="win-dot win-min" title="Minimizar"></button>
        <button class="win-dot win-max" title="Maximizar"></button>
      </div>
      <div class="win-title">${title}</div>
      <div style="width:52px"></div>
    </div>
    <div class="win-body"></div>
  `;

  w.querySelector(".win-body").appendChild(body);
  WindowsLayer.appendChild(w);

  // Dragging
  const titlebar = w.querySelector(".win-titlebar");
  let drag = null;
  titlebar.addEventListener("pointerdown", (e) => {
    if (e.target.classList.contains("win-dot")) return;
    drag = { x: e.clientX - w.offsetLeft, y: e.clientY - w.offsetTop };
    titlebar.setPointerCapture(e.pointerId);
    focusWindow(id);
  });
  titlebar.addEventListener("pointermove", (e) => {
    if (!drag) return;
    w.style.left = Math.max(0, e.clientX - drag.x) + "px";
    w.style.top = Math.max(32, e.clientY - drag.y) + "px";
  });
  titlebar.addEventListener("pointerup", () => drag = null);

  // Controls
  w.querySelector(".win-close").onclick = () => closeWindow(id);
  w.querySelector(".win-min").onclick = () => w.classList.toggle("minimized");
  w.querySelector(".win-max").onclick = () => toggleMax(w);

  // Focus on click
  w.addEventListener("pointerdown", () => focusWindow(id));

  openWindows[id] = w;
  ActiveAppLbl.textContent = title;
  updateDock();
  return w;
}

function closeWindow(id) {
  const w = openWindows[id];
  if (!w) return;
  w.remove();
  delete openWindows[id];
  const remaining = Object.values(openWindows);
  if (remaining.length) ActiveAppLbl.textContent = remaining[remaining.length - 1].querySelector(".win-title").textContent;
  else ActiveAppLbl.textContent = "Finder";
  updateDock();
}

function focusWindow(id) {
  const w = openWindows[id];
  if (!w) return;
  w.style.zIndex = ++zIndex;
  w.classList.remove("minimized");
  ActiveAppLbl.textContent = w.querySelector(".win-title").textContent;
}

function toggleMax(w) {
  if (w.dataset.max) {
    const prev = JSON.parse(w.dataset.max);
    Object.assign(w.style, prev);
    delete w.dataset.max;
  } else {
    w.dataset.max = JSON.stringify({
      left: w.style.left, top: w.style.top,
      width: w.style.width, height: w.style.height
    });
    w.style.left = "10px";
    w.style.top = "42px";
    w.style.width = (window.innerWidth - 20) + "px";
    w.style.height = (window.innerHeight - 130) + "px";
  }
}

function updateDock() {
  document.querySelectorAll(".dock-item").forEach(d => {
    d.classList.toggle("active", !!openWindows[d.dataset.launch]);
  });
}

/* ---------------- APPS ---------------- */
const Apps = {

  // ============ FINDER ============
  finder() {
    const body = document.createElement("div");
    body.className = "finder";
    body.innerHTML = `
      <aside class="finder-side">
        <h4>Favoritos</h4>
        <button class="sel">📁 Escritorio</button>
        <button>📄 Documentos</button>
        <button>⬇ Descargas</button>
        <button>🎵 Música</button>
        <button>🖼 Fotos</button>
        <h4 style="margin-top:16px">Ubicaciones</h4>
        <button>💾 Claude OS</button>
        <button>☁ iCloud</button>
      </aside>
      <main class="finder-main">
        <h3 style="margin:0 0 16px;font-weight:500;font-size:14px;color:var(--fg-dim)">Escritorio</h3>
        <div class="file-grid">
          <div class="file"><span class="ficon">📄</span><span>TdR_aerodinamica.pdf</span></div>
          <div class="file"><span class="ficon">📊</span><span>notas_1batx.xlsx</span></div>
          <div class="file"><span class="ficon">🖼</span><span>a320_cockpit.jpg</span></div>
          <div class="file"><span class="ficon">🎵</span><span>takeoff.mp3</span></div>
          <div class="file"><span class="ficon">📁</span><span>2BATX</span></div>
          <div class="file"><span class="ficon">📁</span><span>Pe_Harta</span></div>
          <div class="file"><span class="ficon">📁</span><span>FPV</span></div>
          <div class="file"><span class="ficon">📄</span><span>README.md</span></div>
        </div>
      </main>`;
    createWindow({ id: "finder", title: "Finder", width: 720, height: 460, body });
  },

  // ============ BROWSER ============
  // Nebula vive en apps/browser.js (se registra como Apps.browser)

  // ============ NOTES ============
  notes() {
    const body = document.createElement("div");
    body.className = "notes";
    const notesData = [
      { id: 1, title: "Rice de aviación", date: "Hoy", content: "Estilos a probar:\n\n1. Liquid glass\n2. Cabina nocturna\n3. Blueprint\n\nEmpezar por GNOME + Dash to Dock, luego probar KDE si quiero más control." },
      { id: 2, title: "ATPL — temario", date: "Ayer", content: "- Air Law\n- Aircraft General Knowledge\n- Flight Planning\n- Human Performance\n- Meteorology\n- Navigation\n- Operational Procedures\n- Principles of Flight\n- Communications" },
      { id: 3, title: "TdR — fuentes", date: "Oct", content: "- NASA technical reports server\n- Aviation Week\n- Journal of Aircraft (AIAA)\n- Libro Anderson 'Fundamentals of Aerodynamics'" },
      { id: 4, title: "Lista exámenes", date: "Oct", content: "Octubre:\n☒ Biologia\n☒ Economia\n☐ Castellano sintaxis\n☐ Català derivats\n☐ Dibuix Tècnic axonometria" }
    ];

    body.innerHTML = `
      <aside class="notes-list">
        ${notesData.map((n, i) => `
          <button class="${i === 0 ? 'sel' : ''}" data-id="${n.id}">
            <strong>${n.title}</strong>
            <small>${n.date}</small>
          </button>
        `).join("")}
      </aside>
      <main class="notes-editor">
        <input value="${notesData[0].title}">
        <textarea>${notesData[0].content}</textarea>
      </main>`;

    body.querySelectorAll(".notes-list button").forEach(btn => {
      btn.onclick = () => {
        body.querySelectorAll(".notes-list button").forEach(b => b.classList.remove("sel"));
        btn.classList.add("sel");
        const n = notesData.find(n => n.id == btn.dataset.id);
        body.querySelector(".notes-editor input").value = n.title;
        body.querySelector(".notes-editor textarea").value = n.content;
      };
    });

    createWindow({ id: "notes", title: "Notas", width: 640, height: 440, body });
  },

  // ============ TERMINAL ============
  terminal() {
    const body = document.createElement("div");
    body.className = "terminal";
    body.innerHTML = `
      <div class="term-line"><span style="color:var(--accent)">Claude OS</span> v1.0 · bash 5.1</div>
      <div class="term-line">Last login: ${new Date().toLocaleString("es-ES")}</div>
      <div class="term-line">Escribe <b>help</b> para ver comandos.</div>
      <div class="term-line">&nbsp;</div>
      <div id="term-out"></div>
      <div class="term-input">
        <span class="term-prompt">mario@claude-os:~$</span>
        <input autofocus>
      </div>`;

    const out = body.querySelector("#term-out");
    const input = body.querySelector(".term-input input");

    const fs = {
      "~": ["Documents", "Downloads", "Projects", "README.md"],
      "~/Projects": ["2BATX", "Pe-Harta", "FPV", "claude-os"],
      "~/Documents": ["TdR.pdf", "notas.xlsx"]
    };
    let cwd = "~";

    const commands = {
      help: () => `Comandos disponibles:
  ls          listar archivos
  cd <dir>    cambiar directorio
  pwd         directorio actual
  cat <f>     mostrar contenido
  echo <t>    imprimir texto
  date        fecha y hora
  whoami      usuario
  neofetch    info del sistema
  open <url>  abrir web en Nebula (-i incógnito)
  claude <q>  preguntar a Claude
  clear       limpiar pantalla
  exit        cerrar terminal`,
      ls: () => (fs[cwd] || []).join("   "),
      pwd: () => cwd,
      cd: (a) => {
        if (!a || a === "~") { cwd = "~"; return ""; }
        const target = cwd === "~" ? "~/" + a : cwd + "/" + a;
        if (fs[target]) { cwd = target; return ""; }
        return "cd: no such directory: " + a;
      },
      cat: (a) => a === "README.md" ? "# Claude OS\n\nUn sistema operativo web hecho enteramente con Claude.\nCreado por Mario Costin." : "cat: " + a + ": No such file",
      echo: (a) => a || "",
      date: () => new Date().toString(),
      whoami: () => "mario",
      clear: () => { out.innerHTML = ""; return null; },
      exit: () => { closeWindow("terminal"); return null; },
      open: (a) => {
        if (!a) return "uso: open [-i] <url o búsqueda>   (-i = incógnito)";
        const priv = /^-i(\s|$)/.test(a);
        const q = a.replace(/^-i\s*/, "");
        Apps.browser(q || undefined, { private: priv });
        return (priv ? "Abriendo en incógnito: " : "Abriendo en Nebula: ") + (q || "nueva pestaña");
      },
      neofetch: () => `
         ⬤⬤⬤          mario@claude-os
       ⬤⬤⬤⬤⬤⬤        ─────────────────
      ⬤⬤⬤⬤⬤⬤⬤⬤       OS:       Claude OS 1.0
     ⬤⬤⬤  ⬤⬤⬤⬤⬤       Kernel:   browser-6.1
      ⬤⬤⬤⬤⬤⬤⬤⬤       Shell:    bash 5.1
       ⬤⬤⬤⬤⬤⬤        DE:       Liquid Glass
         ⬤⬤⬤          Theme:    Claude Dark
                      Memory:   314M / 8GB
                      Uptime:   ${Math.floor(performance.now()/1000)}s`,
      claude: (a) => a ? `Claude: "${a}" — abre la app Claude en el dock para una respuesta real.` : "uso: claude <pregunta>"
    };

    input.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      const line = input.value.trim();
      const parts = line.split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1).join(" ");

      const promptLine = document.createElement("div");
      promptLine.className = "term-line";
      promptLine.innerHTML = `<span class="term-prompt">mario@claude-os:${cwd}$</span> ${line}`;
      out.appendChild(promptLine);

      if (!cmd) { input.value = ""; return; }
      const fn = commands[cmd];
      const result = fn ? fn(args) : `bash: ${cmd}: command not found`;
      if (result !== null && result !== undefined && result !== "") {
        const r = document.createElement("div");
        r.className = "term-line";
        r.textContent = result;
        out.appendChild(r);
      }
      input.value = "";
      body.scrollTop = body.scrollHeight;
    });

    body.addEventListener("click", () => input.focus());
    createWindow({ id: "terminal", title: "Terminal — bash", width: 640, height: 400, body });
  },

  // ============ CLAUDE CHAT ============
  chat() {
    const body = document.createElement("div");
    body.className = "chat";
    body.innerHTML = `
      <div class="chat-messages">
        <div class="msg bot">¡Hola, Mario! Soy Claude, dentro de Claude OS. Pregúntame lo que quieras.</div>
        <div class="msg bot">Esta es una demo local: para respuestas reales conecta la API de Anthropic en <code>os.js</code> (función <code>callClaude</code>).</div>
      </div>
      <div class="chat-input">
        <input placeholder="Escribe un mensaje...">
        <button>Enviar</button>
      </div>`;

    const messages = body.querySelector(".chat-messages");
    const input = body.querySelector(".chat-input input");
    const send = body.querySelector(".chat-input button");

    const fakeReplies = [
      "Buena pregunta. Déjame pensar un momento.",
      "Para eso te recomiendo instalar KDE Plasma — es el más personalizable.",
      "Puedo ayudarte con eso. ¿Quieres que te prepare los pasos?",
      "Sí, Linux es ideal para rices como el que buscas.",
      "El estilo Liquid Glass en GNOME se consigue con la extensión Blur My Shell + tema WhiteSur.",
      "Si quieres algo más minimalista, mira Hyprland."
    ];

    function addMsg(txt, who) {
      const m = document.createElement("div");
      m.className = "msg " + who;
      m.textContent = txt;
      messages.appendChild(m);
      messages.scrollTop = messages.scrollHeight;
    }

    function doSend() {
      const v = input.value.trim();
      if (!v) return;
      addMsg(v, "user");
      input.value = "";
      setTimeout(() => {
        addMsg(fakeReplies[Math.floor(Math.random() * fakeReplies.length)], "bot");
      }, 600);
    }

    send.onclick = doSend;
    input.addEventListener("keydown", e => { if (e.key === "Enter") doSend(); });

    createWindow({ id: "chat", title: "Claude", width: 460, height: 540, body });
  },

  // ============ SETTINGS ============
  settings() {
    const body = document.createElement("div");
    body.className = "settings";
    body.innerHTML = `
      <h2 class="app-h1">Ajustes</h2>
      <p class="app-sub">Personaliza tu Claude OS.</p>

      <div class="set-row">
        <div>
          <label>Color de acento</label>
          <small>Cambia el color principal del sistema.</small>
        </div>
        <div class="swatch-row">
          <div class="swatch sel" style="background:#d97757" data-c="#d97757"></div>
          <div class="swatch" style="background:#7cc5ff" data-c="#7cc5ff"></div>
          <div class="swatch" style="background:#c9a8ff" data-c="#c9a8ff"></div>
          <div class="swatch" style="background:#58e38a" data-c="#58e38a"></div>
          <div class="swatch" style="background:#ff6b6b" data-c="#ff6b6b"></div>
        </div>
      </div>

      <div class="set-row">
        <div>
          <label>Reducir transparencias</label>
          <small>Para ordenadores lentos.</small>
        </div>
        <input type="checkbox" id="ck-blur">
      </div>

      <div class="set-row">
        <div>
          <label>Idioma</label>
          <small>Idioma del sistema.</small>
        </div>
        <select style="background:transparent;color:var(--fg);border:1px solid rgba(255,255,255,0.15);padding:6px 10px;border-radius:6px">
          <option>Español</option>
          <option>English</option>
          <option>Català</option>
        </select>
      </div>

      <div class="set-row set-col">
        <div>
          <label>Proxy del navegador</label>
          <small>URL de tu proxy (p. ej. tu Cloudflare Worker de <code>proxy-worker.js</code>). Vacío = proxies públicos de reserva.</small>
        </div>
        <input id="in-proxy" class="set-input" placeholder="https://nebula-proxy.TU-USUARIO.workers.dev" spellcheck="false">
      </div>

      <div class="set-row">
        <div>
          <label>Modo piloto</label>
          <small>Añade widgets de aviación al escritorio (hora Zulu, METAR).</small>
        </div>
        <input type="checkbox">
      </div>`;

    body.querySelectorAll(".swatch").forEach(sw => {
      sw.onclick = () => {
        body.querySelectorAll(".swatch").forEach(s => s.classList.remove("sel"));
        sw.classList.add("sel");
        document.documentElement.style.setProperty("--accent", sw.dataset.c);
      };
    });

    body.querySelector("#ck-blur").onchange = (e) => {
      document.querySelectorAll(".window, .dock-inner, #topbar").forEach(el => {
        el.style.backdropFilter = e.target.checked ? "none" : "";
        el.style.webkitBackdropFilter = e.target.checked ? "none" : "";
      });
    };

    const proxyIn = body.querySelector("#in-proxy");
    if (window.NebulaConfig) {
      proxyIn.value = NebulaConfig.getProxy();
      proxyIn.addEventListener("change", () => NebulaConfig.setProxy(proxyIn.value));
    }

    createWindow({ id: "settings", title: "Ajustes del sistema", width: 560, height: 500, body });
  },

  // ============ ABOUT ============
  about() {
    const body = document.createElement("div");
    body.className = "about";
    body.innerHTML = `
      <div class="about-logo"></div>
      <h2>Claude OS</h2>
      <p>Versión 1.0 · Liquid Glass</p>
      <p style="max-width:360px;margin:16px auto;line-height:1.6">
        Un entorno de escritorio web construido enteramente con Claude.
        Dock, ventanas arrastrables, navegador, terminal, notas y chat.
      </p>
      <div class="meta">
        BUILT BY MARIO COSTIN · PINEDA DE MAR<br>
        ${new Date().getFullYear()} · MADE WITH CLAUDE
      </div>`;
    createWindow({ id: "about", title: "Acerca de Claude OS", width: 420, height: 440, body });
  }
};

/* ---------------- WIRE LAUNCHERS ---------------- */
document.querySelectorAll("[data-launch]").forEach(el => {
  el.addEventListener("click", () => {
    const app = el.dataset.launch;
    if (Apps[app]) Apps[app]();
  });
});

/* ---------------- AUTO-OPEN FINDER ON BOOT ---------------- */
setTimeout(() => Apps.finder(), 2600);

/* ================================================================
   OPTIONAL: Real Claude API hook
   ================================================================
   To connect the chat to the real Claude API, replace the fake
   replies in Apps.chat() with:

   async function callClaude(prompt) {
     const r = await fetch("YOUR_BACKEND/claude", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ prompt })
     });
     return (await r.json()).text;
   }

   Never put your API key in this file — route calls through
   a backend you control (Cloudflare Worker, Vercel function, etc.).
   ================================================================ */
