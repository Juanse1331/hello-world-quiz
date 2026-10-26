/**
 * <sammy-mascota> — Web Component animado de Sammy
 *
 * Uso:
 *   Incluye sammy.js en tu página (etiqueta script con src="sammy.js") y luego:
 *   <sammy-mascota estado="correcto"></sammy-mascota>
 *
 * Atributos:
 *   estado     "normal" | "correcto" | "incorrecto" | "401"   (por defecto "normal")
 *   mensaje    texto opcional que reemplaza el mensaje por defecto
 *   sin-texto  si está presente, no muestra el mensaje debajo
 *
 * Tamaño: con CSS, p.ej.  sammy-mascota { --sammy-tam: 260px; }
 *
 * Desde JS:
 *   document.querySelector('sammy-mascota').estado = 'incorrecto';
 *   // o: el.setAttribute('estado', '401')
 *
 * Funciona en HTML plano, React, Vue, Angular, etc. (es un custom element estándar).
 */
(function () {
  const MENSAJES = {
    normal: '',
    correcto: '¡Correcto!',
    incorrecto: '¡Incorrecto!',
    '401': 'Error 401 · No autorizado',
  };

  const COLORES_CONFETI = ['#f7a14a', '#d8232f', '#3fc04f', '#2f80ed', '#f2c230', '#b04fe0'];

  const ESTILOS = `
    :host { display: inline-block; width: var(--sammy-tam, 240px); }
    .wrap { display: flex; flex-direction: column; align-items: center; gap: .4em;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    svg { width: 100%; height: auto; overflow: visible; display: block; }
    .mensaje { font-weight: 800; font-size: calc(var(--sammy-tam, 240px) * .09);
               text-align: center; line-height: 1.15; }
    .mensaje:empty { display: none; }
    .e-correcto .mensaje   { color: #2e9a3c; }
    .e-incorrecto .mensaje { color: #d8232f; }
    .e-401 .mensaje        { color: #b8860b; }

    * { transform-box: view-box; }
    .sammy { transform-origin: 100px 236px; }
    .sombra { transform-origin: 100px 236px; }
    .aleta.izq { transform-origin: 46px 120px; }
    .aleta.der { transform-origin: 154px 120px; }
    .oreja.izq { transform-origin: 58px 84px; }
    .oreja.der { transform-origin: 142px 84px; }
    .ojos { transform-origin: 100px 112px; }

    /* ojos y accesorios: se muestran según el estado */
    .ojos, .mejillas, .lagrima, .confeti, .nube, .candado { display: none; }
    .e-normal .ojos-normal, .e-correcto .ojos-feliz, .e-incorrecto .ojos-triste,
    .e-401 .ojos-enojado { display: inline; }
    .e-correcto .mejillas, .e-correcto .confeti { display: inline; }
    .e-incorrecto .lagrima, .e-incorrecto .nube { display: inline; }
    .e-401 .candado { display: inline; }

    /* ---------- NORMAL: respira y parpadea ---------- */
    .e-normal .sammy { animation: respirar 3s ease-in-out infinite; }
    .e-normal .ojos-normal { animation: parpadear 4s infinite; }
    .e-normal .oreja.izq { animation: orejaIdleI 3s ease-in-out infinite; }
    .e-normal .oreja.der { animation: orejaIdleD 3s ease-in-out infinite; }

    /* ---------- CORRECTO: salta, celebra, confeti ---------- */
    .e-correcto .sammy  { animation: salto 1.1s cubic-bezier(.3,.7,.4,1) infinite; }
    .e-correcto .sombra { animation: sombraSalto 1.1s cubic-bezier(.3,.7,.4,1) infinite; }
    .e-correcto .aleta.izq { animation: celebrarI .55s ease-in-out infinite alternate; }
    .e-correcto .aleta.der { animation: celebrarD .55s ease-in-out infinite alternate; }
    .e-correcto .oreja.izq { animation: aletearI .275s ease-in-out infinite alternate; }
    .e-correcto .oreja.der { animation: aletearD .275s ease-in-out infinite alternate; }
    .confeti rect, .confeti circle {
      transform-box: fill-box; transform-origin: center;
      animation: caer var(--dur) linear var(--del) infinite; opacity: 0;
    }

    /* ---------- INCORRECTO: niega, se desinfla, llora bajo su nube ---------- */
    .e-incorrecto .sammy { animation: negar .7s ease-in-out, desanimo 3s ease-in-out .7s infinite; }
    .e-incorrecto .aleta.izq { transform: rotate(-12deg); transition: transform .4s; }
    .e-incorrecto .aleta.der { transform: rotate(12deg);  transition: transform .4s; }
    .e-incorrecto .oreja.izq { animation: caidaI .6s ease-out forwards; }
    .e-incorrecto .oreja.der { animation: caidaD .6s ease-out forwards; }
    .lagrima { transform-box: fill-box; transform-origin: top center;
               animation: gota 1.6s ease-in .5s infinite; opacity: 0; }
    .nube { animation: flotar 2.4s ease-in-out infinite; }
    .lluvia line { animation: llover .8s linear infinite; }
    .lluvia line:nth-child(2) { animation-delay: .27s; }
    .lluvia line:nth-child(3) { animation-delay: .53s; }

    /* ---------- 401: ¡alto! sacude la cabeza, candado vibrando ---------- */
    .e-401 .sammy { animation: noNo 1.6s ease-in-out infinite; }
    .e-401 .aleta.der { animation: alto 1.6s ease-in-out infinite; }
    .e-401 .oreja.izq { animation: aletearI .4s ease-in-out infinite alternate; }
    .e-401 .oreja.der { animation: aletearD .4s ease-in-out infinite alternate; }
    .candado { transform-box: fill-box; transform-origin: 50% 0%;
               animation: candado 1.6s ease-in-out infinite; }
    .arco { animation: arco 1.6s ease-in-out infinite; }

    /* destellos del gorro (todos los estados) */
    .brillo { transform-box: fill-box; transform-origin: center; opacity: 0;
              animation: brillo 3s ease-in-out var(--d) infinite; }
    @keyframes brillo { 0%,100% { opacity: 0; transform: scale(.4); } 12% { opacity: 1; transform: scale(1.4); } 25% { opacity: 0; transform: scale(.4); } }

    @keyframes respirar { 0%,100% { transform: scale(1,1); } 50% { transform: scale(1.015,1.025); } }
    @keyframes parpadear { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
    @keyframes orejaIdleI { 0%,100% { transform: rotate(0); } 50% { transform: rotate(4deg); } }
    @keyframes orejaIdleD { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-4deg); } }

    @keyframes salto {
      0%   { transform: translateY(0) scale(1,1); }
      15%  { transform: translateY(0) scale(1.08,.9); }
      45%  { transform: translateY(-34px) scale(.95,1.06); }
      70%  { transform: translateY(0) scale(1.06,.93); }
      85%,100% { transform: translateY(0) scale(1,1); }
    }
    @keyframes sombraSalto { 0%,15%,70%,100% { transform: scale(1); opacity: 1; } 45% { transform: scale(.6); opacity: .5; } }
    @keyframes celebrarI { from { transform: rotate(105deg); } to { transform: rotate(145deg); } }
    @keyframes celebrarD { from { transform: rotate(-105deg); } to { transform: rotate(-145deg); } }
    @keyframes aletearI { from { transform: rotate(-6deg); } to { transform: rotate(14deg); } }
    @keyframes aletearD { from { transform: rotate(6deg); } to { transform: rotate(-14deg); } }
    @keyframes caer {
      0%   { transform: translate(var(--x), -30px) rotate(0); opacity: 1; }
      85%  { opacity: 1; }
      100% { transform: translate(calc(var(--x) + var(--dx)), 230px) rotate(var(--rot)); opacity: 0; }
    }

    @keyframes negar {
      0%,100% { transform: translateX(0); } 20% { transform: translateX(-7px) rotate(-3deg); }
      40% { transform: translateX(7px) rotate(3deg); } 60% { transform: translateX(-5px) rotate(-2deg); }
      80% { transform: translateX(4px) rotate(1deg); }
    }
    @keyframes desanimo { 0%,100% { transform: translateY(3px) scale(1.02,.97); } 50% { transform: translateY(5px) scale(1.04,.95); } }
    @keyframes caidaI { to { transform: rotate(-22deg); } }
    @keyframes caidaD { to { transform: rotate(22deg); } }
    @keyframes gota {
      0% { transform: translateY(0) scale(.4); opacity: 0; } 15% { transform: translateY(0) scale(1); opacity: 1; }
      85% { opacity: 1; } 100% { transform: translateY(46px) scale(1); opacity: 0; }
    }
    @keyframes flotar { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    @keyframes llover { from { transform: translateY(0); opacity: 1; } to { transform: translateY(16px); opacity: 0; } }

    @keyframes noNo {
      0%,55%,100% { transform: rotate(0); }
      10% { transform: rotate(-5deg); } 22% { transform: rotate(5deg); }
      34% { transform: rotate(-4deg); } 46% { transform: rotate(3deg); }
    }
    @keyframes alto {
      0%,100% { transform: rotate(-150deg); } 50% { transform: rotate(-160deg); }
    }
    @keyframes candado {
      0%,50%,100% { transform: rotate(0) translateY(0); }
      58% { transform: rotate(-10deg); } 66% { transform: rotate(9deg); }
      74% { transform: rotate(-6deg); } 82% { transform: rotate(4deg); }
      25% { transform: translateY(-4px); }
    }
    @keyframes arco { 0%,50%,100% { transform: translateY(0); } 62% { transform: translateY(-3px); } 74% { transform: translateY(0); } }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
      .confeti, .lagrima { display: none !important; }
    }
  `;

  function confeti() {
    let s = '';
    for (let i = 0; i < 18; i++) {
      const x = 15 + Math.random() * 170;
      const color = COLORES_CONFETI[i % COLORES_CONFETI.length];
      const vars = `--x:${x.toFixed(0)}px;--dx:${(Math.random() * 40 - 20).toFixed(0)}px;` +
        `--rot:${(Math.random() * 720 - 360).toFixed(0)}deg;` +
        `--dur:${(1.6 + Math.random() * 1.4).toFixed(2)}s;--del:${(Math.random() * 2).toFixed(2)}s`;
      s += i % 3 === 0
        ? `<circle r="3" fill="${color}" style="${vars}"/>`
        : `<rect x="-4" y="-2.5" width="8" height="5" rx="1" fill="${color}" style="${vars}"/>`;
    }
    return s;
  }

  /* ---------- Gorro: pelaje generado con mechones (semilla fija = mismo dibujo siempre) ---------- */
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Contorno esponjoso: elipse con "copos" de pelo hacia afuera.
  function pelo(cx, cy, rx, ry, n, amp, rand, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = (a, k) => {
      const x = rx * k * Math.cos(a), y = ry * k * Math.sin(a);
      return `${(cx + x * c - y * s).toFixed(1)},${(cy + x * s + y * c).toFixed(1)}`;
    };
    const step = (2 * Math.PI) / n;
    const inicio = P(0, 1 - amp * 0.2 * rand());
    let d = `M${inicio}`;
    for (let i = 1; i <= n; i++) {
      const a = i * step;
      const p = i === n ? inicio : P(a, 1 - amp * 0.25 * rand());
      const ac = a - step * (0.5 + (rand() - 0.5) * 0.6);
      d += ` Q${P(ac, 1 + amp * (0.55 + rand() * 0.7))} ${p}`;
    }
    return d + 'Z';
  }

  // Trazos cortos curvos que dan textura de pelo.
  function mechones(cx, cy, rx, ry, k, rand, colores, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const T = (x, y) => `${(cx + x * c - y * s).toFixed(1)},${(cy + x * s + y * c).toFixed(1)}`;
    let out = '';
    for (let i = 0; i < k; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.88;
      const x = rx * r * Math.cos(a), y = ry * r * Math.sin(a);
      const dir = a + (rand() - 0.5) * 0.9, len = 4 + rand() * 6;
      const ex = x + Math.cos(dir) * len, ey = y + Math.sin(dir) * len;
      const curl = (rand() - 0.5) * 5;
      const mx = (x + ex) / 2 - Math.sin(dir) * curl, my = (y + ey) / 2 + Math.cos(dir) * curl;
      out += `<path d="M${T(x, y)} Q${T(mx, my)} ${T(ex, ey)}" stroke="${colores[i % colores.length]}"/>`;
    }
    return `<g fill="none" stroke-width="1.1" stroke-linecap="round" opacity=".55">${out}</g>`;
  }

  // Destellos como la escarcha del peluche.
  function brillos(cx, cy, rx, ry, k, rand) {
    let out = '';
    for (let i = 0; i < k; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.85;
      out += `<circle class="brillo" cx="${(cx + rx * r * Math.cos(a)).toFixed(1)}" cy="${(cy + ry * r * Math.sin(a)).toFixed(1)}"` +
        ` r="${(0.7 + rand() * 0.8).toFixed(2)}" style="--d:${(rand() * 3).toFixed(2)}s"/>`;
    }
    return `<g fill="#ffeec2">${out}</g>`;
  }

  function orejera(lado, uid, rand) {
    const m = lado === 'izq' ? 1 : -1;
    const X = x => (lado === 'izq' ? x : 200 - x);
    const rot = 0.38 * m;
    return `
    <g class="oreja ${lado}">
      <ellipse cx="${X(33)}" cy="109" rx="19" ry="29" transform="rotate(${24 * m} ${X(33)} 109)" fill="url(#forro-${uid})"/>
      <path d="M${X(30)} 128 Q${X(36)} 135 ${X(46)} 131" stroke="#2a8f37" stroke-width="1.4" fill="none" opacity=".6"/>
      <path d="${pelo(X(41), 99, 17, 28, 15, 0.2, rand, rot)}" fill="#553720" filter="url(#fur-${uid})"/>
      <path d="${pelo(X(43), 95, 12.5, 21, 13, 0.2, rand, rot)}" fill="#76502f" filter="url(#fur-${uid})"/>
      <path d="${pelo(X(44), 89, 7, 11, 9, 0.25, rand, rot)}" fill="#946640" opacity=".85"/>
      ${mechones(X(42), 98, 14, 24, 14, rand, ['#3f2716', '#a7784d', '#5f3f25'], rot)}
      ${brillos(X(42), 98, 13, 22, 4, rand)}
    </g>`;
  }

  function gorro(uid) {
    const rand = rng(7);
    return `
    <!-- gorro: copa verde de felpa -->
    <g class="gorro">
      <path d="M46 66 C36 -6 164 -6 154 66 Z" fill="url(#verde-${uid})"/>
      <g fill="none" stroke="#258a33" stroke-width="1.3" opacity=".55" stroke-linecap="round">
        <path d="M100 14 Q96 38 100 60"/><path d="M74 20 Q64 40 64 60"/><path d="M126 20 Q136 40 136 60"/>
      </g>
      <ellipse cx="82" cy="22" rx="18" ry="6" fill="#fff" opacity=".22" transform="rotate(-14 82 22)"/>

      <!-- orejeras -->
      ${orejera('izq', uid, rand)}
      ${orejera('der', uid, rand)}

      <!-- pelaje del frente en capas -->
      <path d="${pelo(100, 65, 62, 30, 34, 0.16, rand)}" fill="#553720" filter="url(#fur-${uid})"/>
      <path d="${pelo(100, 61, 53, 24, 30, 0.16, rand)}" fill="#76502f" filter="url(#fur-${uid})"/>
      <path d="${pelo(97, 54, 36, 13, 22, 0.22, rand)}" fill="#946640" opacity=".9" filter="url(#fur-${uid})"/>
      <path d="${pelo(92, 50, 18, 6, 12, 0.3, rand)}" fill="#b5875a" opacity=".55"/>
      ${mechones(100, 64, 56, 27, 60, rand, ['#3f2716', '#a7784d', '#5f3f25', '#c0915f'])}
      ${brillos(100, 62, 54, 25, 14, rand)}
    </g>`;
  }

  function svgSammy(uid) {
    const fur = `fur-${uid}`;
    return `
<svg viewBox="0 0 200 250" role="img" aria-label="Sammy, el pingüino mascota">
  <defs>
    <filter id="${fur}" x="-25%" y="-25%" width="150%" height="150%">
      <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="4" result="ruido"/>
      <feDisplacementMap in="SourceGraphic" in2="ruido" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <radialGradient id="verde-${uid}" cx="40%" cy="25%" r="80%">
      <stop offset="0" stop-color="#86e594"/><stop offset=".45" stop-color="#43c453"/><stop offset="1" stop-color="#278a35"/>
    </radialGradient>
    <linearGradient id="forro-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3fc04f"/><stop offset="1" stop-color="#2a9238"/>
    </linearGradient>
  </defs>

  <!-- nube de lluvia (incorrecto) -->
  <g class="nube"><g transform="translate(0,-14)">
    <g fill="#9aa3ad">
      <ellipse cx="100" cy="6" rx="30" ry="12"/>
      <circle cx="84" cy="-2" r="12"/><circle cx="104" cy="-8" r="15"/><circle cx="120" cy="0" r="10"/>
    </g>
    <g class="lluvia" stroke="#5aa9e6" stroke-width="3" stroke-linecap="round">
      <line x1="86" y1="20" x2="84" y2="27"/><line x1="100" y1="20" x2="98" y2="27"/><line x1="114" y1="20" x2="112" y2="27"/>
    </g>
  </g></g>

  <ellipse class="sombra" cx="100" cy="236" rx="56" ry="7" fill="rgba(0,0,0,.14)"/>

  <g class="sammy">
    <!-- patas -->
    <ellipse cx="74" cy="226" rx="21" ry="11" fill="#f7a14a"/>
    <ellipse cx="126" cy="226" rx="21" ry="11" fill="#f7a14a"/>
    <path d="M60 228 q4 4 8 0 q4 4 8 0" stroke="#e0883a" stroke-width="1.5" fill="none"/>
    <path d="M124 228 q4 4 8 0 q4 4 8 0" stroke="#e0883a" stroke-width="1.5" fill="none"/>

    <!-- aletas -->
    <g class="aleta izq"><ellipse cx="42" cy="148" rx="13" ry="31" fill="#1d1d22" transform="rotate(16 42 148)"/></g>
    <g class="aleta der"><ellipse cx="158" cy="148" rx="13" ry="31" fill="#1d1d22" transform="rotate(-16 158 148)"/></g>

    <!-- cuerpo -->
    <ellipse cx="100" cy="148" rx="64" ry="77" fill="#1d1d22"/>
    <ellipse cx="100" cy="191" rx="42" ry="30" fill="#f4f2ec"/>

    <!-- cara -->
    <path d="M100 94 C82 74 50 80 52 112 C54 140 84 150 100 148 C116 150 146 140 148 112 C150 80 118 74 100 94 Z" fill="#f4f2ec"/>

    <!-- mejillas (correcto) -->
    <g class="mejillas" fill="#ff8fa3" opacity=".75">
      <ellipse cx="72" cy="126" rx="7" ry="4"/><ellipse cx="128" cy="126" rx="7" ry="4"/>
    </g>

    <!-- ojos -->
    <g class="ojos ojos-normal">
      <circle cx="86" cy="112" r="6" fill="#111"/><circle cx="114" cy="112" r="6" fill="#111"/>
      <circle cx="88" cy="110" r="1.8" fill="#fff"/><circle cx="116" cy="110" r="1.8" fill="#fff"/>
    </g>
    <g class="ojos ojos-feliz" fill="none" stroke="#111" stroke-width="3.6" stroke-linecap="round">
      <path d="M79 114 Q86 104 93 114"/><path d="M107 114 Q114 104 121 114"/>
    </g>
    <g class="ojos ojos-triste">
      <circle cx="86" cy="114" r="5.5" fill="#111"/><circle cx="114" cy="114" r="5.5" fill="#111"/>
      <circle cx="87.5" cy="112" r="1.6" fill="#fff"/><circle cx="115.5" cy="112" r="1.6" fill="#fff"/>
      <g stroke="#111" stroke-width="2.8" stroke-linecap="round">
        <line x1="78" y1="105" x2="91" y2="101"/><line x1="109" y1="101" x2="122" y2="105"/>
      </g>
    </g>
    <g class="ojos ojos-enojado">
      <circle cx="86" cy="113" r="6" fill="#111"/><circle cx="114" cy="113" r="6" fill="#111"/>
      <circle cx="88" cy="111" r="1.8" fill="#fff"/><circle cx="116" cy="111" r="1.8" fill="#fff"/>
      <g stroke="#111" stroke-width="3.2" stroke-linecap="round">
        <line x1="77" y1="101" x2="92" y2="106"/><line x1="108" y1="106" x2="123" y2="101"/>
      </g>
    </g>

    <!-- lágrima (incorrecto) -->
    <path class="lagrima" d="M80 121 Q76 128 80 131 Q84 128 80 121 Z" fill="#5aa9e6"/>

    <!-- pico -->
    <path d="M87 120 Q100 112 113 120 Q116 134 100 143 Q84 134 87 120 Z" fill="#f7a14a"/>
    <path d="M92 121 Q100 117 108 121" stroke="#fbc287" stroke-width="2" fill="none" stroke-linecap="round"/>

    <!-- corbatín -->
    <g>
      <path d="M100 154 L81 144 Q76 154 81 164 Z" fill="#d8232f"/>
      <path d="M100 154 L119 144 Q124 154 119 164 Z" fill="#d8232f"/>
      <rect x="95.5" y="148.5" width="9" height="11" rx="3" fill="#b81b26"/>
    </g>

    ${gorro(uid)}
  </g>

  <!-- candado (401) -->
  <g class="candado">
    <path class="arco" d="M168 34 v-9 a11 11 0 0 1 22 0 v9" stroke="#6b6f76" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="161" y="33" width="36" height="28" rx="6" fill="#f2c230" stroke="#c99a12" stroke-width="2"/>
    <circle cx="179" cy="44" r="4" fill="#5a4307"/>
    <rect x="177.2" y="45" width="3.6" height="9" rx="1.5" fill="#5a4307"/>
  </g>

  <!-- confeti (correcto) -->
  <g class="confeti">${confeti()}</g>
</svg>`;
  }

  let contador = 0;

  class SammyMascota extends HTMLElement {
    static get observedAttributes() { return ['estado', 'mensaje', 'sin-texto']; }

    constructor() {
      super();
      this._uid = ++contador;
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() { this._render(); }
    attributeChangedCallback() { if (this.isConnected) this._render(); }

    get estado() { return this.getAttribute('estado') || 'normal'; }
    set estado(v) { this.setAttribute('estado', v); }

    _render() {
      const estado = MENSAJES.hasOwnProperty(this.estado) ? this.estado : 'normal';
      const texto = this.hasAttribute('sin-texto') ? '' : (this.getAttribute('mensaje') ?? MENSAJES[estado]);
      // Se re-renderiza todo para que la animación arranque desde cero en cada cambio.
      this.shadowRoot.innerHTML = `
        <style>${ESTILOS}</style>
        <div class="wrap e-${estado}" part="contenedor">
          ${svgSammy(this._uid)}
          <div class="mensaje" part="mensaje" role="status">${escapar(texto)}</div>
        </div>`;
    }
  }

  function escapar(t) {
    return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  if (!customElements.get('sammy-mascota')) customElements.define('sammy-mascota', SammyMascota);
})();
