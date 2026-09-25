// slides.js · pega reveal.js, los snippets extraídos del código real y los
// iframes de la web. Sin build: se carga tal cual.

// --- 1. URL de la web --------------------------------------------------------
// Las slides viven en <base>/slides/, la web en <base>/. Así funciona igual en
// local (http://localhost:8080/slides/) y en GitHub Pages (/la-masa-madre/slides/).
// Se puede forzar otra con ?app=https://...
const params = new URLSearchParams(location.search);
const APP_BASE = params.get('app')
  || location.pathname.replace(/\/slides\/.*$/, '/') || '/';

function appUrl(path) {
  const clean = String(path || '/').replace(/^\//, '');
  return new URL(clean, new URL(APP_BASE, location.origin)).href;
}

// Los iframes se rellenan al mostrar la slide (no todos a la vez: 20 iframes
// cargando gtag a la vez ensucian la propiedad y ralentizan la presentación).
function loadPhone(slide) {
  slide.querySelectorAll('iframe[data-src-app]').forEach((frame) => {
    const url = appUrl(frame.dataset.srcApp);
    if (frame.src !== url) frame.src = url;
    const label = frame.closest('.split, section')?.querySelector('[data-url-label]');
    if (label) label.textContent = url.replace(location.origin, '');
  });
}

// --- 2. Snippets -------------------------------------------------------------
// <div data-snippet="track-purchase"></div> → <pre><code> con el código real
// de site/analytics.js y la referencia archivo:línea.
function renderSnippets() {
  document.querySelectorAll('[data-snippet]').forEach((host) => {
    const name = host.dataset.snippet;
    const snip = (window.SNIPPETS || {})[name];
    if (!snip) {
      host.innerHTML = `<div class="warn">Falta el fragmento <code>${name}</code>.
        Ejecuta <code>node scripts/extract-snippets.mjs</code>.</div>`;
      return;
    }
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.className = `language-${snip.lang}`;
    code.setAttribute('data-trim', '');
    code.textContent = snip.code;
    pre.appendChild(code);
    const src = document.createElement('p');
    src.className = 'snippet-src';
    src.textContent = `${snip.file}:${snip.line}`;
    host.replaceChildren(pre, src);
  });
}
renderSnippets();

// <code data-line="starter/analytics.js#trackPageView"></code> → "starter/analytics.js:118"
// Resuelto por extract-snippets.mjs contra el código real.
function renderLineRefs() {
  document.querySelectorAll('[data-line]').forEach((el) => {
    const ref = el.dataset.line;
    const n = (window.LINES || {})[ref];
    const file = ref.split(/::|#/)[0];
    el.textContent = n ? `${file}:${n}` : `${file}:??`;
    if (!n) el.classList.add('line-missing');
  });
}
renderLineRefs();

// --- 2b. Diagramas -----------------------------------------------------------
// <div data-diagram="anatomia-hit"></div> → el SVG de diagrams.js.
function renderDiagrams() {
  document.querySelectorAll('[data-diagram]').forEach((host) => {
    const svg = (window.DIAGRAMS || {})[host.dataset.diagram];
    host.innerHTML = svg || `<div class="warn">Falta el diagrama <code>${host.dataset.diagram}</code>.</div>`;
  });
}
renderDiagrams();

// --- 3. reveal ---------------------------------------------------------------
Reveal.initialize({
  hash: true,
  slideNumber: 'c/t',
  transition: 'none',        // sobrio: sin animaciones de diapositiva
  center: false,             // contenido pegado arriba: cabe más y no baila
  width: 1400,
  height: 900,
  margin: 0.06,
  controls: true,
  progress: true,
  plugins: [RevealHighlight, RevealNotes],
  highlight: { beforeHighlight: (hljs) => hljs.configure({ ignoreUnescapedHTML: true }) },
});

Reveal.on('ready', (e) => loadPhone(e.currentSlide));
Reveal.on('slidechanged', (e) => loadPhone(e.currentSlide));

// --- 4. Atajos ---------------------------------------------------------------
// R = recargar el teléfono de la slide actual (útil para repetir una demo
// desde cero: vuelve a disparar page_view, view_item_list, etc.)
Reveal.addKeyBinding({ keyCode: 82, key: 'R', description: 'Recargar la web del teléfono' }, () => {
  document.querySelectorAll('.present iframe[data-src-app]').forEach((frame) => {
    // eslint-disable-next-line no-self-assign
    frame.src = frame.src;
  });
});
