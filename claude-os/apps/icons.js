/* ================================================================
   ICONOS — set propio en SVG para dock, escritorio y Nebula
   Se aplican sobre .d-glyph / .dock-glyph según data-launch.
   ================================================================ */

(function () {
  /* engranaje generado por código: n dientes alrededor de un aro */
  function gear(cx, cy, rOut, rIn, teeth) {
    const pts = [];
    const step = Math.PI * 2 / teeth;
    for (let i = 0; i < teeth; i++) {
      const a = i * step;
      const w = step * 0.22;
      [[a - step / 2 + w, rIn], [a - w * 1.25, rIn], [a - w, rOut], [a + w, rOut], [a + w * 1.25, rIn], [a + step / 2 - w, rIn]]
        .forEach(([ang, r]) => pts.push((cx + r * Math.cos(ang)).toFixed(2) + "," + (cy + r * Math.sin(ang)).toFixed(2)));
    }
    return pts.join(" ");
  }

  const ICONS = {
    finder: `
      <svg viewBox="0 0 48 48"><defs>
        <linearGradient id="ic-f1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset="1" stop-color="#3a7fd9"/></linearGradient>
        <linearGradient id="ic-f2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe5ff"/><stop offset="1" stop-color="#5aa2ef"/></linearGradient>
        <linearGradient id="ic-fbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d2a44"/><stop offset="1" stop-color="#0f1626"/></linearGradient>
      </defs>
        <rect width="48" height="48" fill="url(#ic-fbg)"/>
        <path d="M9 15a3 3 0 0 1 3-3h8l3 3h13a3 3 0 0 1 3 3v3H9z" fill="url(#ic-f1)"/>
        <rect x="8" y="19" width="32" height="18" rx="3.5" fill="url(#ic-f2)"/>
        <rect x="8" y="19" width="32" height="1.4" rx=".7" fill="#fff" opacity=".55"/>
      </svg>`,

    browser: `
      <svg viewBox="0 0 48 48"><defs>
        <radialGradient id="ic-nb" cx=".3" cy=".25" r="1"><stop offset="0" stop-color="#3b2a6e"/><stop offset=".6" stop-color="#1a1238"/><stop offset="1" stop-color="#0b0820"/></radialGradient>
        <radialGradient id="ic-np" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffe2f4"/><stop offset=".45" stop-color="#c9a8ff"/><stop offset="1" stop-color="#6b4fe0"/></radialGradient>
      </defs>
        <rect width="48" height="48" fill="url(#ic-nb)"/>
        <circle cx="10" cy="11" r=".9" fill="#fff" opacity=".8"/><circle cx="38" cy="9" r=".6" fill="#fff" opacity=".7"/>
        <circle cx="40" cy="36" r=".8" fill="#fff" opacity=".6"/><circle cx="8" cy="38" r=".5" fill="#fff" opacity=".6"/>
        <ellipse cx="24" cy="24" rx="19" ry="6.5" fill="none" stroke="#ffb7e6" stroke-width="1.6" opacity=".55" transform="rotate(-22 24 24)"/>
        <circle cx="24" cy="24" r="10" fill="url(#ic-np)"/>
        <path d="M6.38 31.12A19 6.5 -22 0 0 41.62 16.88" fill="none" stroke="#ffd1f0" stroke-width="1.8" stroke-linecap="round" opacity=".95"/>
      </svg>`,

    notes: `
      <svg viewBox="0 0 48 48"><defs>
        <linearGradient id="ic-nh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd36b"/><stop offset="1" stop-color="#ffab4a"/></linearGradient>
      </defs>
        <rect width="48" height="48" fill="#fbf8f1"/>
        <rect width="48" height="14" fill="url(#ic-nh)"/>
        <g stroke="#d9d3c4" stroke-width="1.2"><path d="M8 22h32M8 28h32M8 34h32M8 40h20"/></g>
        <path d="M8 22h22" stroke="#4a4a4a" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`,

    terminal: `
      <svg viewBox="0 0 48 48"><defs>
        <linearGradient id="ic-tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a303d"/><stop offset="1" stop-color="#07090d"/></linearGradient>
      </defs>
        <rect width="48" height="48" fill="url(#ic-tb)"/>
        <rect x="0" y="0" width="48" height="8" fill="#fff" opacity=".06"/>
        <path d="M11 19l7 5-7 5" fill="none" stroke="#58e38a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 31h13" stroke="#eef1f7" stroke-width="3" stroke-linecap="round"/>
      </svg>`,

    chat: `
      <svg viewBox="0 0 48 48"><defs>
        <linearGradient id="ic-cb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0956f"/><stop offset="1" stop-color="#b8532f"/></linearGradient>
      </defs>
        <rect width="48" height="48" fill="url(#ic-cb)"/>
        <g transform="translate(24 24)" fill="#fff8f2">
          ${Array.from({ length: 10 }, (_, i) => `<rect x="-1.6" y="-14" width="3.2" height="11" rx="1.6" transform="rotate(${i * 36 + (i % 2) * 6})"/>`).join("")}
          <circle r="3.4"/>
        </g>
      </svg>`,

    settings: `
      <svg viewBox="0 0 48 48"><defs>
        <linearGradient id="ic-sb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8b0c0"/><stop offset="1" stop-color="#4a5466"/></linearGradient>
        <linearGradient id="ic-sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset="1" stop-color="#b9c0cc"/></linearGradient>
      </defs>
        <rect width="48" height="48" fill="url(#ic-sb)"/>
        <polygon points="${gear(24, 24, 16, 12.2, 10)}" fill="url(#ic-sg)"/>
        <circle cx="24" cy="24" r="8" fill="#5c6678"/>
        <circle cx="24" cy="24" r="4.2" fill="url(#ic-sg)"/>
      </svg>`,

    about: `
      <svg viewBox="0 0 48 48"><defs>
        <linearGradient id="ic-ab" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ef09c"/><stop offset="1" stop-color="#1f8a4c"/></linearGradient>
      </defs>
        <rect width="48" height="48" fill="url(#ic-ab)"/>
        <circle cx="24" cy="24" r="14" fill="none" stroke="#fff" stroke-width="2.4" opacity=".9"/>
        <circle cx="24" cy="17" r="2.2" fill="#fff"/>
        <path d="M24 22v10" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>
      </svg>`
  };

  /* Iconos de UI reutilizados por Nebula */
  window.UIIcons = {
    incognito: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 11.2h16v1.3H4z"/>
      <path d="M7.2 10.4 8.6 5.3a1.3 1.3 0 0 1 1.7-.9l1 .4a2 2 0 0 0 1.4 0l1-.4a1.3 1.3 0 0 1 1.7.9l1.4 5.1z"/>
      <path fill-rule="evenodd" d="M8 13.6a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zm0 1.4a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM16 13.6a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zm0 1.4a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z"/>
      <path d="M10.9 16.2c.7-.5 1.5-.5 2.2 0l-.5 1.1c-.4-.2-.8-.2-1.2 0z"/>
    </svg>`,
    nebula: ICONS.browser,
    globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    play: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4.5" fill="#ff2d3d"/><path d="M10 9.2v5.6l4.8-2.8z" fill="#fff"/></svg>`,
    history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4"/><path d="M12 7.5V12l3 2"/></svg>`
  };

  /* Sustituye los emojis de dock y escritorio por los SVG */
  let uid = 0;
  document.querySelectorAll("[data-launch]").forEach(el => {
    const svg = ICONS[el.dataset.launch];
    const glyph = el.querySelector(".d-glyph, .dock-glyph");
    if (!svg || !glyph) return;
    // ids de gradiente únicos por copia (el mismo icono aparece en dock y escritorio)
    const n = ++uid;
    glyph.innerHTML = svg.replace(/id="(ic-[\w-]+)"/g, `id="$1-${n}"`).replace(/url\(#(ic-[\w-]+)\)/g, `url(#$1-${n})`);
    glyph.style.background = "none";
    glyph.classList.add("svg-glyph");
  });
})();
