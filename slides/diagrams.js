// diagrams.js · diagramas SVG de las slides.
// Se insertan con <div data-diagram="nombre"></div>. Usan currentColor y las
// variables del tema, así que heredan la paleta sin duplicar colores.
window.DIAGRAMS = {};

const D = window.DIAGRAMS;
const NAVY = '#1B2A4A', MUTED = '#8a93a6', SOFT = '#EEF1F6', ACCENT = '#8a5a2b';

// Caja con texto centrado, varias líneas.
function box(x, y, w, h, lines, opts = {}) {
  const { fill = '#fff', stroke = NAVY, dash = '', size = 15, bold = 0 } = opts;
  const ls = [].concat(lines);
  const startY = y + h / 2 - ((ls.length - 1) * (size + 4)) / 2 + size / 3;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''}/>
  ${ls.map((t, i) => `<text x="${x + w / 2}" y="${startY + i * (size + 4)}" text-anchor="middle" font-size="${size}" fill="${NAVY}" font-family="Merriweather, Georgia, serif" ${i < bold ? 'font-weight="700"' : ''}>${t}</text>`).join('')}`;
}

function arrow(x1, y1, x2, y2, label, opts = {}) {
  const { color = NAVY, dash = '' } = opts;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''} marker-end="url(#punta)"/>
  ${label ? `<text x="${mx}" y="${my - 8}" text-anchor="middle" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">${label}</text>` : ''}`;
}

const DEFS = `<defs>
  <marker id="punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="${NAVY}"/>
  </marker>
</defs>`;

const svg = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" class="diagram" xmlns="http://www.w3.org/2000/svg">${DEFS}${body}</svg>`;

// ---------------------------------------------------------------------------
// 1 · Qué hace una herramienta de analítica
// ---------------------------------------------------------------------------
D['ciclo-analitica'] = svg(980, 200, `
  ${box(10, 60, 180, 80, ['Alguien hace', 'algo en tu web'], { fill: SOFT })}
  ${arrow(195, 100, 245, 100, 'recoger')}
  ${box(250, 60, 180, 80, ['Se convierte', 'en un evento'])}
  ${arrow(435, 100, 485, 100, 'enviar')}
  ${box(490, 60, 180, 80, ['Google lo', 'procesa'])}
  ${arrow(675, 100, 725, 100, 'informar')}
  ${box(730, 60, 180, 80, ['Tú miras', 'un número'], { fill: SOFT })}
  <text x="460" y="180" text-anchor="middle" font-size="14" fill="${MUTED}" font-family="Merriweather, Georgia, serif">Los cuatro pasos se rompen por sitios distintos. Casi siempre por el segundo.</text>
`);

// ---------------------------------------------------------------------------
// 2 · Jerarquía: usuario / sesión / evento / parámetro
// ---------------------------------------------------------------------------
D['jerarquia'] = svg(900, 380, `
  ${box(30, 20, 840, 340, [], { fill: '#fff', stroke: NAVY })}
  <text x="50" y="48" font-size="16" font-weight="700" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Usuario</text>
  <text x="130" y="48" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">un navegador, identificado por la cookie _ga</text>

  ${box(55, 65, 790, 130, [], { fill: SOFT, stroke: MUTED })}
  <text x="75" y="90" font-size="15" font-weight="700" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Sesión 1</text>
  <text x="160" y="90" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">martes, 9:14</text>
  ${box(80, 105, 160, 70, ['page_view', '/'], { size: 13 })}
  ${box(255, 105, 160, 70, ['view_item', 'Hogaza'], { size: 13 })}
  ${box(430, 105, 160, 70, ['add_to_cart', 'value: 5,50'], { size: 13 })}
  ${box(605, 105, 215, 70, ['purchase', 'transaction_id: MM-…'], { size: 13 })}

  ${box(55, 210, 790, 130, [], { fill: SOFT, stroke: MUTED })}
  <text x="75" y="235" font-size="15" font-weight="700" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Sesión 2</text>
  <text x="160" y="235" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">jueves, 18:02 · misma persona, otra visita</text>
  ${box(80, 250, 160, 70, ['page_view', '/panes'], { size: 13 })}
  ${box(255, 250, 160, 70, ['view_item', 'Centeno'], { size: 13 })}
  <text x="500" y="292" font-size="14" fill="${MUTED}" font-family="Merriweather, Georgia, serif">…y se fue sin comprar.</text>
`);

// ---------------------------------------------------------------------------
// 3 · Las cuatro familias de eventos
// ---------------------------------------------------------------------------
D['familias-eventos'] = svg(960, 300, `
  ${box(15, 30, 220, 200, [], { fill: SOFT, stroke: MUTED })}
  <text x="125" y="60" text-anchor="middle" font-size="16" font-weight="700" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Automáticos</text>
  <text x="125" y="85" text-anchor="middle" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">no los tocas</text>
  <text x="125" y="120" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">session_start</text>
  <text x="125" y="145" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">first_visit</text>
  <text x="125" y="170" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">user_engagement</text>

  ${box(250, 30, 220, 200, [], { fill: SOFT, stroke: MUTED })}
  <text x="360" y="60" text-anchor="middle" font-size="16" font-weight="700" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Medición mejorada</text>
  <text x="360" y="85" text-anchor="middle" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">se activan con un switch</text>
  <text x="360" y="120" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">scroll</text>
  <text x="360" y="145" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">click</text>
  <text x="360" y="170" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">file_download</text>

  ${box(485, 30, 220, 200, [], { fill: '#fff', stroke: NAVY })}
  <text x="595" y="60" text-anchor="middle" font-size="16" font-weight="700" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Recomendados</text>
  <text x="595" y="85" text-anchor="middle" font-size="13" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">tú, con nombre fijo</text>
  <text x="595" y="120" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">purchase</text>
  <text x="595" y="145" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">add_to_cart</text>
  <text x="595" y="170" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">login</text>
  <text x="595" y="205" text-anchor="middle" font-size="13" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">informes gratis</text>

  ${box(720, 30, 225, 200, [], { fill: '#fff', stroke: MUTED, dash: '5 4' })}
  <text x="832" y="60" text-anchor="middle" font-size="16" font-weight="700" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Personalizados</text>
  <text x="832" y="85" text-anchor="middle" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">tú, nombre libre</text>
  <text x="832" y="120" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">pide_cita</text>
  <text x="832" y="145" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">usa_filtro</text>
  <text x="832" y="205" text-anchor="middle" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">informes: los haces tú</text>

  <text x="480" y="275" text-anchor="middle" font-size="15" fill="${NAVY}" font-family="Merriweather, Georgia, serif">La frontera que importa está en el medio: a la derecha decides tú.</text>
`);

// ---------------------------------------------------------------------------
// 4 · Qué viaja por el cable
// ---------------------------------------------------------------------------
D['anatomia-hit'] = svg(960, 330, `
  ${box(20, 20, 250, 90, ['Tu código', 'gtag("event", "add_to_cart", {…})'], { size: 13, bold: 1 })}
  ${arrow(275, 65, 330, 65)}
  ${box(335, 20, 190, 90, ['dataLayer', 'una cola de arrays'], { size: 13, bold: 1, fill: SOFT })}
  ${arrow(530, 65, 585, 65)}
  ${box(590, 20, 190, 90, ['gtag.js', 'traduce y envía'], { size: 13, bold: 1, fill: SOFT })}
  ${arrow(690, 115, 690, 160)}

  ${box(200, 165, 760, 100, [], { fill: '#fff', stroke: ACCENT })}
  <text x="220" y="190" font-size="14" font-weight="700" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">GET /g/collect?…</text>
  <text x="220" y="215" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">en=add_to_cart  cu=EUR  epn.value=11  ep.item_list_id=catalogo</text>
  <text x="220" y="240" font-size="14" fill="${NAVY}" font-family="ui-monospace, monospace">pr1=idMM-HOG-01~nmHogaza~pr5.5~qt2   gcs=G111   cid=2084…</text>

  <text x="20" y="300" font-size="15" fill="${NAVY}" font-family="Merriweather, Georgia, serif">
    <tspan font-family="ui-monospace, monospace" font-weight="700">epn.</tspan> = número · <tspan font-family="ui-monospace, monospace" font-weight="700">ep.</tspan> = texto · <tspan font-family="ui-monospace, monospace" font-weight="700">pr1…prN</tspan> = artículos · <tspan font-family="ui-monospace, monospace" font-weight="700">gcs</tspan> = consentimiento
  </text>
`);

// ---------------------------------------------------------------------------
// 5 · Web clásica vs SPA
// ---------------------------------------------------------------------------
D['spa-vs-mpa'] = svg(960, 340, `
  <text x="20" y="30" font-size="17" font-weight="700" fill="${NAVY}" font-family="Playfair Display, serif">Web clásica</text>
  ${box(20, 45, 140, 65, ['/', 'recarga'], { size: 13, fill: SOFT })}
  ${arrow(165, 77, 205, 77)}
  ${box(210, 45, 140, 65, ['/panes', 'recarga'], { size: 13, fill: SOFT })}
  ${arrow(355, 77, 395, 77)}
  ${box(400, 45, 140, 65, ['/carrito', 'recarga'], { size: 13, fill: SOFT })}
  <text x="570" y="70" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Cada recarga ejecuta el snippet</text>
  <text x="570" y="92" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">otra vez → 3 <tspan font-family="ui-monospace, monospace">page_view</tspan> solos.</text>

  <line x1="20" y1="140" x2="940" y2="140" stroke="${MUTED}" stroke-width="1" stroke-dasharray="4 4"/>

  <text x="20" y="180" font-size="17" font-weight="700" fill="${NAVY}" font-family="Playfair Display, serif">SPA</text>
  ${box(20, 195, 140, 65, ['/', 'carga'], { size: 13 })}
  ${arrow(165, 227, 205, 227, 'pushState')}
  ${box(210, 195, 140, 65, ['/panes', 'sin recarga'], { size: 13, stroke: MUTED, dash: '5 4' })}
  ${arrow(355, 227, 395, 227, 'pushState')}
  ${box(400, 195, 140, 65, ['/carrito', 'sin recarga'], { size: 13, stroke: MUTED, dash: '5 4' })}
  <text x="570" y="220" font-size="14" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">El snippet se ejecuta UNA vez.</text>
  <text x="570" y="242" font-size="14" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">GA4 ve una sola URL en toda la visita.</text>

  <text x="20" y="305" font-size="15" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Solución: apagar el automático y llamar tú a <tspan font-family="ui-monospace, monospace">page_view</tspan> en cada cambio de ruta.</text>
`);

// ---------------------------------------------------------------------------
// 6 · Orden del consentimiento
// ---------------------------------------------------------------------------
D['orden-consent'] = svg(960, 300, `
  <text x="20" y="28" font-size="16" font-weight="700" fill="${NAVY}" font-family="Playfair Display, serif">Bien</text>
  ${box(20, 40, 200, 60, ['1 · dataLayer + gtag()'], { size: 13, fill: SOFT })}
  ${arrow(225, 70, 258, 70)}
  ${box(263, 40, 210, 60, ['2 · consent default', 'todo denied'], { size: 13, bold: 1 })}
  ${arrow(478, 70, 511, 70)}
  ${box(516, 40, 190, 60, ['3 · carga gtag/js'], { size: 13, fill: SOFT })}
  ${arrow(711, 70, 744, 70)}
  ${box(749, 40, 190, 60, ['4 · config'], { size: 13, fill: SOFT })}
  <text x="20" y="128" font-size="14" fill="${MUTED}" font-family="Merriweather, Georgia, serif">El primer hit sale con gcs=G100 y sin cookie. Correcto.</text>

  <line x1="20" y1="150" x2="940" y2="150" stroke="${MUTED}" stroke-width="1" stroke-dasharray="4 4"/>

  <text x="20" y="188" font-size="16" font-weight="700" fill="${ACCENT}" font-family="Playfair Display, serif">Mal</text>
  ${box(20, 200, 200, 60, ['1 · dataLayer + gtag()'], { size: 13, fill: SOFT })}
  ${arrow(225, 230, 258, 230)}
  ${box(263, 200, 190, 60, ['2 · config'], { size: 13, stroke: ACCENT })}
  ${arrow(458, 230, 491, 230)}
  ${box(496, 200, 210, 60, ['3 · consent default'], { size: 13, stroke: ACCENT })}
  <text x="725" y="225" font-size="14" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">Llega tarde.</text>
  <text x="725" y="247" font-size="14" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">Cookie escrita sin permiso.</text>
`);

// ---------------------------------------------------------------------------
// 7 · Mapa de la consola
// ---------------------------------------------------------------------------
D['mapa-consola'] = svg(960, 420, `
  ${box(20, 20, 180, 380, [], { fill: SOFT, stroke: MUTED })}
  <text x="110" y="48" text-anchor="middle" font-size="15" font-weight="700" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Menú lateral</text>
  ${box(35, 65, 150, 45, ['Página principal'], { size: 13 })}
  ${box(35, 120, 150, 45, ['Informes'], { size: 13, bold: 1 })}
  ${box(35, 175, 150, 45, ['Explorar'], { size: 13, bold: 1 })}
  ${box(35, 230, 150, 45, ['Publicidad'], { size: 13 })}
  ${box(35, 330, 150, 45, ['Administrar'], { size: 13, bold: 1 })}

  ${arrow(190, 142, 235, 142)}
  ${box(240, 118, 330, 50, ['Lo que ya está hecho', 'Vigilar. Rápido. Poco flexible.'], { size: 12, bold: 1 })}

  ${arrow(190, 197, 235, 197)}
  ${box(240, 173, 330, 50, ['Lo que construyes tú', 'Embudos, rutas, cohortes.'], { size: 12, bold: 1 })}

  ${arrow(190, 252, 235, 252)}
  ${box(240, 228, 330, 50, ['Atribución y campañas', 'Solo si inviertes en publicidad.'], { size: 12, bold: 1, stroke: MUTED })}

  ${arrow(190, 352, 235, 352)}
  ${box(240, 328, 330, 50, ['Cómo se recogen los datos', 'Aquí vive toda la configuración.'], { size: 12, bold: 1 })}

  ${box(600, 20, 340, 380, [], { fill: '#fff', stroke: NAVY })}
  <text x="770" y="48" text-anchor="middle" font-size="15" font-weight="700" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Administrar, por dentro</text>
  <text x="620" y="80" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">RECOPILACIÓN Y MODIFICACIÓN</text>
  <text x="620" y="103" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Flujos de datos · Eventos</text>
  <text x="620" y="126" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Retención · Filtros · Importación</text>
  <text x="620" y="160" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">VISUALIZACIÓN DE DATOS</text>
  <text x="620" y="183" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Eventos clave · Audiencias</text>
  <text x="620" y="206" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Definiciones personalizadas</text>
  <text x="620" y="229" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">DebugView · Informes</text>
  <text x="620" y="263" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">VINCULACIONES</text>
  <text x="620" y="286" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">BigQuery · Google Ads · Search Console</text>
  <text x="620" y="320" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">PROPIEDAD Y CUENTA</text>
  <text x="620" y="343" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Zona horaria y moneda · Accesos</text>
  <text x="620" y="366" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Historial de cambios</text>
`);

// ---------------------------------------------------------------------------
// 8 · Ámbitos
// ---------------------------------------------------------------------------
D['ambitos'] = svg(920, 250, `
  ${box(20, 30, 200, 180, [], { fill: '#fff', stroke: NAVY })}
  <text x="120" y="60" text-anchor="middle" font-size="16" font-weight="700" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Usuario</text>
  <text x="120" y="90" text-anchor="middle" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">país, primera fuente</text>
  ${box(45, 105, 150, 90, [], { fill: SOFT, stroke: MUTED })}
  <text x="120" y="130" text-anchor="middle" font-size="15" font-weight="700" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Sesión</text>
  <text x="120" y="152" text-anchor="middle" font-size="12" fill="${MUTED}" font-family="Merriweather, Georgia, serif">fuente de la sesión</text>
  ${box(62, 160, 116, 28, ['Evento'], { size: 13, fill: '#fff' })}

  <text x="260" y="60" font-size="15" fill="${NAVY}" font-family="Merriweather, Georgia, serif">"Ingresos por campaña" puede significar:</text>
  <text x="280" y="95" font-size="15" fill="${NAVY}" font-family="Merriweather, Georgia, serif">· la campaña que trajo <tspan font-weight="700">esa sesión</tspan></text>
  <text x="280" y="125" font-size="15" fill="${NAVY}" font-family="Merriweather, Georgia, serif">· la campaña que trajo al <tspan font-weight="700">usuario la primera vez</tspan></text>
  <text x="260" y="170" font-size="15" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">Dos números distintos. Los dos correctos.</text>
  <text x="260" y="200" font-size="14" fill="${MUTED}" font-family="Merriweather, Georgia, serif">Cuando alguien diga "esto no cuadra", empieza preguntando por aquí.</text>
`);

// ---------------------------------------------------------------------------
// 9 · Navegador vs servidor (Measurement Protocol)
// ---------------------------------------------------------------------------
D['mp-vs-navegador'] = svg(940, 300, `
  ${box(20, 30, 250, 110, ['Navegador', 'gtag.js'], { size: 14, bold: 1 })}
  <text x="145" y="120" text-anchor="middle" font-size="12" fill="${MUTED}" font-family="Merriweather, Georgia, serif">cookie, dispositivo, geo, referrer</text>
  ${arrow(275, 85, 400, 85, '/g/collect')}

  ${box(20, 175, 250, 110, ['Tu servidor', 'Measurement Protocol'], { size: 14, bold: 1, stroke: ACCENT })}
  <text x="145" y="265" text-anchor="middle" font-size="12" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">nada de eso: lo pones tú</text>
  ${arrow(275, 230, 400, 230, '/mp/collect', { color: ACCENT })}

  ${box(405, 90, 200, 130, ['GA4'], { size: 18, bold: 1, fill: SOFT })}
  <text x="505" y="175" text-anchor="middle" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">mismo client_id</text>
  <text x="505" y="196" text-anchor="middle" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">= mismo usuario</text>

  ${box(650, 90, 270, 130, [], { fill: '#fff', stroke: MUTED, dash: '5 4' })}
  <text x="785" y="120" text-anchor="middle" font-size="15" font-weight="700" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Si el client_id no coincide</text>
  <text x="785" y="150" text-anchor="middle" font-size="14" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">son dos usuarios distintos</text>
  <text x="785" y="180" text-anchor="middle" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">y la devolución se resta</text>
  <text x="785" y="200" text-anchor="middle" font-size="13" fill="${MUTED}" font-family="Merriweather, Georgia, serif">a quien no compró</text>
`);

// ---------------------------------------------------------------------------
// 10 · Dónde te mienten los datos
// ---------------------------------------------------------------------------
D['limites-datos'] = svg(940, 280, `
  ${box(15, 40, 290, 190, [], { fill: '#fff', stroke: NAVY })}
  <text x="160" y="72" text-anchor="middle" font-size="17" font-weight="700" fill="${NAVY}" font-family="Playfair Display, serif">Muestreo</text>
  <text x="160" y="105" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Más de 10 M de eventos</text>
  <text x="160" y="128" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">en la consulta y GA4</text>
  <text x="160" y="151" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">responde con una parte.</text>
  <text x="160" y="190" text-anchor="middle" font-size="13" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">Lo avisa el icono de</text>
  <text x="160" y="210" text-anchor="middle" font-size="13" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">calidad de los datos.</text>

  ${box(325, 40, 290, 190, [], { fill: '#fff', stroke: NAVY })}
  <text x="470" y="72" text-anchor="middle" font-size="17" font-weight="700" fill="${NAVY}" font-family="Playfair Display, serif">(other)</text>
  <text x="470" y="105" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Demasiados valores</text>
  <text x="470" y="128" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">distintos y el resto se</text>
  <text x="470" y="151" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">agrupa en una fila.</text>
  <text x="470" y="190" text-anchor="middle" font-size="13" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">Nunca metas un ID</text>
  <text x="470" y="210" text-anchor="middle" font-size="13" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">en una dimensión.</text>

  ${box(635, 40, 290, 190, [], { fill: '#fff', stroke: NAVY })}
  <text x="780" y="72" text-anchor="middle" font-size="17" font-weight="700" fill="${NAVY}" font-family="Playfair Display, serif">Umbrales</text>
  <text x="780" y="105" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Con pocos usuarios,</text>
  <text x="780" y="128" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">GA4 esconde datos para</text>
  <text x="780" y="151" text-anchor="middle" font-size="14" fill="${NAVY}" font-family="Merriweather, Georgia, serif">que no identifiques a nadie.</text>
  <text x="780" y="190" text-anchor="middle" font-size="13" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">Afecta sobre todo a</text>
  <text x="780" y="210" text-anchor="middle" font-size="13" fill="${ACCENT}" font-family="Merriweather, Georgia, serif">datos demográficos.</text>

  <text x="470" y="265" text-anchor="middle" font-size="15" fill="${NAVY}" font-family="Merriweather, Georgia, serif">Los tres desaparecen en BigQuery. Por eso existe la exportación.</text>
`);
