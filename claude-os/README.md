# MCF OS

Mi escritorio en la web, con estética de cabina nocturna: ventanas arrastrables, dock, navegador Nebula (con buscador propio, vídeos e incógnito), terminal, notas, chat con Claude y hora Zulu en la barra superior.

![version](https://img.shields.io/badge/version-2.0-ff9f1c)
![status](https://img.shields.io/badge/status-live-58e38a)

## Qué incluye

- **Archivos** — explorador de archivos con barra lateral
- **Nebula** — navegador real dentro del SO: pestañas, historial atrás/adelante, búsqueda en Google, favoritos y carga de webs vía iframe directo o proxy
- **Terminal** — bash falso con comandos (`ls`, `cat`, `neofetch`, `claude`...)
- **Notas** — editor con lista lateral
- **Chat Claude** — ventana de chat (reemplazable por API real)
- **Ajustes** — cambio de color de acento, blur, idioma
- **Acerca de** — info del sistema
- **Boot splash** animado al arrancar
- **Dock** estilo macOS con hover magnify
- **Menú superior** con reloj en vivo, batería e indicador de red
- **Wallpaper** animado con blobs de color y grano

## Cómo desplegarlo

### Opción A — GitHub Pages (recomendado)

1. Crea un repositorio nuevo en GitHub llamado `claude-os`.
2. Sube los archivos de esta carpeta a la raíz del repo.
3. En **Settings → Pages**: selecciona rama `main`, carpeta `/ (root)`, guarda.
4. Al cabo de 1-2 min estará en `https://TU-USUARIO.github.io/claude-os/`.

### Opción B — Local

```bash
# Simplemente abre index.html en el navegador
# o sirve con un servidor estático:
python3 -m http.server 8000
# luego abre http://localhost:8000
```

### Opción C — Vercel / Netlify

Arrastra la carpeta a vercel.com o netlify.com → se despliega sin configuración.

## Personalización rápida

- **Color de acento global**: en `style.css`, variable `--accent` (línea 11).
- **Wallpaper**: cambia los `.blob` en `style.css` o pon una imagen en `#wallpaper`.
- **Añadir una app**: en `os.js`, dentro del objeto `Apps`, añade:
  ```js
  miApp() {
    const body = document.createElement("div");
    body.innerHTML = "<h1>Hola</h1>";
    createWindow({ id: "miApp", title: "Mi App", body });
  }
  ```
  Y añádela al dock en `index.html` con `data-launch="miApp"`.

## Nebula, el navegador

**No hace falta configurar nada.** Nebula abre las webs de tres formas (lo indica la etiqueta de la barra de dirección):

- **Directo** — la web tal cual dentro de la ventana (Wikipedia, OpenStreetMap, archive.org...).
- **Lectura** — la página se renderiza en un servidor (r.jina.ai) y se muestra completa pero sin JavaScript. Sirve para casi cualquier web.
- **Proxy** — si configuras tu propio proxy, la web se carga con todo su JavaScript.

Además tiene páginas propias:

- **Buscador** — escribe cualquier cosa en la barra: resultados web (DuckDuckGo), vídeos y ficha de Wikipedia. Mientras escribes salen sugerencias. Si los resultados fallan, enseña Google incrustado.
- **Vídeos** — al entrar en youtube.com se abre el buscador de vídeos de Nebula. Los vídeos se reproducen con el reproductor oficial de YouTube dentro de la ventana.
- **Incógnito** — botón del antifaz junto al `+`, o `Alt+Shift+N`. No guarda historial ni sugerencias y las webs cargan sin tus cookies.
- **Historial y favoritos** — botones del reloj y la estrella.

Atajos: `Alt+T` pestaña nueva, `Alt+W` cerrar, `Alt+L` ir a la barra. Desde la Terminal: `open wikipedia.org`, `open vuelos barcelona`, `open -i ...` (incógnito).

### Proxy propio (opcional)

El servicio gratuito de lectura tiene un límite de unas 20 páginas por minuto y no ejecuta JavaScript. Para más velocidad y webs completas:

1. Entra en [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create → Worker.
2. Pega el contenido de `proxy-worker.js` y pulsa Deploy.
3. En Settings → Variables añade `ALLOWED_ORIGINS` = `https://TU-USUARIO.github.io`.
4. En MCF OS: **Ajustes → Proxy del navegador** → pega la URL del worker.

Webs con login (Instagram, Gmail...) no funcionan dentro: usa el botón ↗.

## Conectar Claude de verdad

El chat con Claude usa respuestas falsas por defecto. Para enganchar la API real de Anthropic, mira el comentario al final de `os.js`. **Nunca pongas tu API key en el frontend** — enruta las llamadas por un backend (Cloudflare Worker, Vercel function, etc.).

## Créditos

Hecho por Mario Costin (Pineda de Mar).  
Construido con Claude.

## Licencia

MIT
