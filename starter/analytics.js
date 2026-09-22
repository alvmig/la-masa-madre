// analytics.js · EJERCICIO
//
// Esta es la única puerta de salida hacia GA4: la UI (app.js, router.js) ya
// llama a estas funciones, pero están vacías. Tu trabajo es rellenarlas.
//
// Reglas:
//   - Los nombres de eventos y parámetros son los de la documentación oficial.
//     No inventes ninguno: si dudas, mira tracking-plan.md o la doc de Google.
//   - Ningún otro archivo debe llamar a gtag() directamente.
//   - Criterio de terminado: `python simulator/e2e_events_test.py --url http://localhost:8080/starter/`
//     en verde.
//
// Orden sugerido: ejercicios 1 → 8 de EJERCICIOS.md.
import { MEASUREMENT_ID } from './config.js';
import { BRAND, CURRENCY } from './catalog.js';

const CONSENT_KEY = 'mm_consent';
const SENT_TX_KEY = 'mm_sent_tx';

// ---------------------------------------------------------------------------
// EJERCICIO 1 · Arranque
// ---------------------------------------------------------------------------
// Pistas:
//   a) window.dataLayer = [] y una función gtag() que haga push de `arguments`.
//   b) gtag('consent', 'default', {...}) ANTES de cargar la librería.
//      Las cuatro señales: ad_storage, ad_user_data, ad_personalization,
//      analytics_storage. Todas 'denied' salvo que getStoredConsent() diga otra cosa.
//   c) <script async src="https://www.googletagmanager.com/gtag/js?id=...">
//   d) gtag('js', new Date()) y gtag('config', MEASUREMENT_ID, {...}) con
//      send_page_view: false. ¿Por qué false en una SPA?
//   e) debug_mode: true solo si la URL lleva ?debug=1. Ojo: `debug_mode: false`
//      NO desactiva nada; hay que omitir la clave.
export function initAnalytics() {
  // TODO
}

function isDebug() {
  return new URLSearchParams(location.search).has('debug');
}

// ---------------------------------------------------------------------------
// EJERCICIO 2 · Consentimiento
// ---------------------------------------------------------------------------
// consentPayload(true) → las cuatro señales en 'granted'; false → 'denied'.
function consentPayload(granted) {
  // TODO
  return {};
}

export function getStoredConsent() {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
}

// Llamada desde el banner (app.js). Debe: actualizar el consentimiento en
// gtag Y guardar la elección en localStorage[CONSENT_KEY] ('granted'/'denied').
export function updateConsent(granted) {
  // TODO
}

// ---------------------------------------------------------------------------
// EJERCICIO 3 · toGA4Item
// ---------------------------------------------------------------------------
// La ÚNICA función que construye items. Debe devolver un objeto con:
//   item_id, item_name, item_brand, item_category, item_category2,
//   price (número), quantity (entero).
// Y, solo si vienen: item_list_id, item_list_name (de `list`) e `index`.
// `product` trae item_id, item_name, item_category, item_category2, price.
export function toGA4Item(product, { quantity = 1, index, list } = {}) {
  // TODO
  return {};
}

// Una "línea" del carrito es { product, quantity, list?, index? }.
function linesToItems(lines) {
  return lines.map((l) => toGA4Item(l.product, { quantity: l.quantity, index: l.index, list: l.list }));
}

// EJERCICIO 4 · value = Σ price × quantity.
// Súmalo en céntimos (enteros) y divide al final: 0.1 + 0.2 no es 0.3.
function sumValue(items) {
  // TODO
  return 0;
}

// ---------------------------------------------------------------------------
// EJERCICIO 5 · Vistas de página
// ---------------------------------------------------------------------------
// router.js ya llama a esto en cada cambio de ruta. Manda el evento page_view
// con page_title, page_location y, si lo hay, page_referrer.
export function trackPageView({ page_title, page_location, page_referrer }) {
  // TODO
}

// ---------------------------------------------------------------------------
// EJERCICIO 6 · Listas de producto
// ---------------------------------------------------------------------------
// view_item_list: item_list_id e item_list_name a nivel de evento, y items[]
// donde cada item lleva su `index` (empieza en 0) y la lista.
export function trackViewItemList(list, products) {
  // TODO
}

// select_item: lo mismo pero con un solo item, el que se ha pulsado.
export function trackSelectItem(list, product, index) {
  // TODO
}

// ---------------------------------------------------------------------------
// EJERCICIO 7 · El embudo
// ---------------------------------------------------------------------------
// Todos llevan currency y value. Recuerda: add_to_cart y remove_from_cart
// miden el DELTA (lo que se añade o se quita), no el estado del carrito.
// listCtx = { list, index } o {} si el usuario no venía de una lista.
export function trackViewItem(product, listCtx = {}) {
  // TODO
}

export function trackAddToCart(product, quantity, listCtx = {}) {
  // TODO
}

export function trackRemoveFromCart(product, quantity, listCtx = {}) {
  // TODO
}

export function trackViewCart(lines) {
  // TODO
}

export function trackBeginCheckout(lines) {
  // TODO
}

// shipping_tier: 'Recogida en obrador' | 'Envío a domicilio'
export function trackAddShippingInfo(lines, shippingTier) {
  // TODO
}

// payment_type: 'Tarjeta' | 'Bizum'
export function trackAddPaymentInfo(lines, paymentType) {
  // TODO
}

// ---------------------------------------------------------------------------
// EJERCICIO 8 · purchase sin duplicados
// ---------------------------------------------------------------------------
// order = { transaction_id, lines, tax, shipping }
// Debe:
//   - no enviar nada si ese transaction_id ya se envió (wasSent / markSent);
//   - mandar transaction_id, currency, value (SOLO los items), tax, shipping, items;
//   - devolver true si envió, false si lo omitió.
// Pregunta para pensar: GA4 ya deduplica por transaction_id. ¿Por qué
// deduplicamos también aquí?
export function trackPurchase(order) {
  // TODO
  return false;
}

function sentSet() {
  try { return new Set(JSON.parse(sessionStorage.getItem(SENT_TX_KEY) || '[]')); } catch { return new Set(); }
}
function wasSent(id) { return sentSet().has(id); }
function markSent(id) {
  const s = sentSet(); s.add(id);
  try { sessionStorage.setItem(SENT_TX_KEY, JSON.stringify([...s])); } catch { /* modo privado */ }
}
