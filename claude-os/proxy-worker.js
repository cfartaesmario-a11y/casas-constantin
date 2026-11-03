/* ================================================================
   NEBULA PROXY — Cloudflare Worker (gratis, 100k peticiones/día)
   ----------------------------------------------------------------
   Hace que el navegador de Claude OS pueda abrir casi cualquier web.
   Descarga la página en el servidor y la devuelve con CORS abierto
   y sin las cabeceras que impiden incrustarla.

   Despliegue (5 minutos):
   1. dash.cloudflare.com -> Workers & Pages -> Create -> Worker
   2. Pega este archivo, pulsa Deploy.
   3. Settings -> Variables -> añade ALLOWED_ORIGINS con tu web,
      p. ej.  https://TU-USUARIO.github.io
      (así nadie más puede usar tu proxy).
   4. En Claude OS: Ajustes -> Proxy del navegador ->
      https://nebula-proxy.TU-USUARIO.workers.dev
   ================================================================ */

const STRIP = [
  "x-frame-options", "content-security-policy", "content-security-policy-report-only",
  "set-cookie", "strict-transport-security", "cross-origin-opener-policy",
  "cross-origin-embedder-policy", "cross-origin-resource-policy", "content-encoding", "content-length"
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const okOrigin = !allowed.length || allowed.includes(origin);

    const cors = {
      "access-control-allow-origin": okOrigin ? (origin || "*") : "null",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "*",
      "access-control-expose-headers": "x-final-url, content-type",
      "vary": "origin"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (!okOrigin) return new Response("Origen no permitido", { status: 403, headers: cors });
    if (request.method !== "GET") return new Response("Solo GET", { status: 405, headers: cors });

    const target = new URL(request.url).searchParams.get("url");
    let url;
    try { url = new URL(target); } catch { return new Response("Uso: ?url=https://...", { status: 400, headers: cors }); }
    if (!/^https?:$/.test(url.protocol)) return new Response("Solo http/https", { status: 400, headers: cors });

    let res;
    try {
      res = await fetch(url.toString(), {
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
          "accept": request.headers.get("accept") || "text/html,application/xhtml+xml,*/*;q=0.8",
          "accept-language": "es-ES,es;q=0.9,en;q=0.8"
        }
      });
    } catch (e) {
      return new Response("No se pudo conectar: " + e.message, { status: 502, headers: cors });
    }

    const headers = new Headers(res.headers);
    STRIP.forEach(h => headers.delete(h));
    Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
    headers.set("x-final-url", res.url);
    return new Response(res.body, { status: res.status, headers });
  }
};
