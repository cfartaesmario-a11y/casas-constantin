# Claude OS

Un entorno de escritorio web construido enteramente con Claude. Liquid glass, ventanas arrastrables, dock animado, navegador dentro del "SO", terminal interactiva, notas, chat y ajustes.

![version](https://img.shields.io/badge/version-1.0-d97757)
![status](https://img.shields.io/badge/status-live-58e38a)

## Qué incluye

- **Finder** — explorador de archivos con barra lateral
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

Nebula abre webs de verdad dentro de la ventana. Usa dos modos (se ve en la etiqueta de la barra de dirección y se cambia con el botón ⇄):

- **Directo** — iframe normal, con todo su JavaScript. Se usa con webs que se dejan incrustar: Wikipedia, Google (búsquedas), Bing, YouTube (los vídeos se pasan a modo *embed*), OpenStreetMap, archive.org...
- **Proxy** — la página se descarga a través de un proxy y se pinta en un iframe aislado. Así se saltan los bloqueos `X-Frame-Options`. Los enlaces y formularios siguen dentro de Nebula.

También tiene **modo incógnito** (botón del antifaz junto al `+`, o `Alt+Shift+N`): las pestañas moradas no guardan historial ni sugerencias, no piden iconos a terceros y las webs cargan sin tus cookies (iframes *credentialless*, se borran al cerrar). Hay **historial** (botón del reloj) con opción de borrarlo, y los accesos directos y pestañas muestran el logo real de cada web.

Si una web no carga, sale una página con *Reintentar*, *Probar incrustada directa* y *Abrir en el navegador real*.

### Tu propio proxy (recomendado)

Por defecto Nebula prueba proxies públicos gratuitos, que a veces van lentos o caídos. Para que funcione siempre:

1. Entra en [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create → Worker.
2. Pega el contenido de `proxy-worker.js` y pulsa Deploy.
3. En Settings → Variables añade `ALLOWED_ORIGINS` = `https://TU-USUARIO.github.io` (así solo tu web puede usarlo).
4. En Claude OS: **Ajustes → Proxy del navegador** → pega la URL del worker.

Webs con mucho JavaScript o con login (Instagram, Gmail...) no funcionan bien en modo proxy: para esas usa el botón ↗.

Desde la Terminal también puedes escribir `open wikipedia.org`, `open vuelos barcelona` o `open -i wikipedia.org` (incógnito).

## Conectar Claude de verdad

El chat usa respuestas falsas por defecto. Para enganchar la API real de Anthropic, mira el comentario al final de `os.js`. **Nunca pongas tu API key en el frontend** — enruta las llamadas por un backend (Cloudflare Worker, Vercel function, etc.).

## Créditos

Hecho por Mario Costin (Pineda de Mar).  
Construido con Claude.

## Licencia

MIT
