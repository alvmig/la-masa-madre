// router.js · History API sin dependencias.
// Responsable de: rutas, base path, deep links en GitHub Pages y de avisar a
// GA4 de cada vista (page_view) ANTES de renderizar, para que los eventos de
// ecommerce de la vista lleguen después de su page_view.
import { trackPageView } from './analytics.js';

// Base de la app = directorio donde vive este módulo. Funciona igual en local
// ('/'), en una project page de GitHub ('/la-masa-madre/') y en site/buggy/.
export const BASE = new URL('.', import.meta.url).pathname;

const REDIRECT_KEY = 'mm_redirect'; // lo escribe 404.html
const routes = [];
let previousUrl = null;

// '/panes/MM-HOG-01' → '/la-masa-madre/panes/MM-HOG-01'
export function href(path) {
  return BASE + path.replace(/^\//, '');
}

// Ruta lógica sin el base path. '/la-masa-madre/panes' → '/panes'
export function currentPath() {
  return location.pathname.slice(BASE.length - 1) || '/';
}

// addRoute('/panes/:item_id', { tipo: 'producto', title: (p) => '...', render: (p) => ... })
export function addRoute(pattern, { tipo, title, render }) {
  const keys = [];
  const source = pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
  routes.push({ regex: new RegExp(`^${source}/?$`), keys, tipo, title, render });
}

export function navigate(path, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState'](null, '', href(path) + keepDebug());
  handle();
}

export function start() {
  // GitHub Pages no reescribe rutas: 404.html nos trajo a la raíz con la ruta
  // pedida y el referrer original guardados. Se restauran ANTES del primer
  // page_view para que page_location y page_referrer sean los reales.
  let initialReferrer = document.referrer;
  try {
    const raw = sessionStorage.getItem(REDIRECT_KEY);
    if (raw) {
      sessionStorage.removeItem(REDIRECT_KEY);
      const r = JSON.parse(raw);
      history.replaceState(null, '', href(r.path));
      initialReferrer = r.referrer || '';
    }
  } catch { /* sin sessionStorage */ }

  document.addEventListener('click', onLinkClick);
  window.addEventListener('popstate', () => handle()); // atrás / adelante
  handle(initialReferrer);
}

// Enlaces internos: <a data-route="/panes" href="...">
function onLinkClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
  const a = e.target.closest('a[data-route]');
  if (!a) return;
  e.preventDefault();
  navigate(a.dataset.route);
}

// Cada cambio de vista pasa por aquí: pushState, popstate y carga inicial.
function handle(initialReferrer) {
  const path = currentPath();
  const match = routes.find((r) => r.regex.test(path)) || routes.find((r) => r.regex.test('/404'));
  const values = path.match(match.regex).slice(1).map(decodeURIComponent);
  const params = Object.fromEntries(match.keys.map((k, i) => [k, values[i]]));

  document.title = match.title(params);
  window.scrollTo(0, 0);

  // @snippet:router-page-view
  // En una SPA no hay recarga: sin esto GA4 solo vería la primera URL.
  // page_referrer es la vista anterior (o document.referrer en la primera).
  trackPageView({
    tipo_pagina: match.tipo,   // parámetro propio → dimensión personalizada
    page_title: document.title,
    page_location: location.href,
    page_referrer: previousUrl ?? initialReferrer ?? '',
  });
  previousUrl = location.href;
  // @end

  match.render(params);
}

// ?debug=1 activa debug_mode en config; se conserva al navegar para que una
// recarga en cualquier ruta siga en DebugView.
function keepDebug() {
  return new URLSearchParams(location.search).has('debug') ? '?debug=1' : '';
}
