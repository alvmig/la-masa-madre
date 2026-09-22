// analytics.js · única puerta de salida hacia GA4.
// La UI nunca llama a gtag(): llama a trackXxx(). Así el tracking plan vive
// en un solo archivo, se testea solo y se puede reemplazar sin tocar vistas.
import { MEASUREMENT_ID } from './config.js';
import { BRAND, CURRENCY } from './catalog.js';

const CONSENT_KEY = 'mm_consent';   // localStorage: 'granted' | 'denied'
const SENT_TX_KEY = 'mm_sent_tx';   // sessionStorage: transaction_id ya enviados

// ---------------------------------------------------------------------------
// 1. Arranque
// ---------------------------------------------------------------------------
// Mismo orden que el snippet oficial de GA4, y el orden es vital:
//   dataLayer + stub gtag → consent default → carga de gtag/js → config
// Todo lo que se hace antes de que llegue gtag/js queda encolado en dataLayer y
// la librería lo procesa en ese orden. Si `config` fuera antes que
// `consent default`, los defaults no aplicarían (doc de Consent Mode).
export function initAnalytics() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };

  // Carga asíncrona de la librería.
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID, {
    send_page_view: true,
    // debug_mode marca los hits (_dbg=1) para DebugView. Solo se incluye la
    // clave cuando toca: `debug_mode: false` NO lo desactiva.
    ...(isDebug() ? { debug_mode: true } : {}),
  });

  gtag('consent', 'default', consentPayload(getStoredConsent() === 'granted'));
}

function isDebug() {
  return new URLSearchParams(location.search).has('debug');
}

// ---------------------------------------------------------------------------
// 2. Consentimiento
// ---------------------------------------------------------------------------
// Con analytics_storage 'denied' gtag NO escribe la cookie _ga pero SÍ manda
// pings sin identificador (gcs=G100) que GA4 usa para modelar. Con 'granted'
// los hits llevan cid y gcs=G111. Se ve en Network → /g/collect.
function consentPayload(granted) {
  const v = granted ? 'granted' : 'denied';
  return {
    ad_storage: v,
    ad_user_data: v,
    ad_personalization: v,
    analytics_storage: v,
  };
}

export function getStoredConsent() {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
}

export function updateConsent(granted) {
  gtag('consent', 'update', consentPayload(granted));
  try { localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied'); } catch { /* modo privado */ }
}

// ---------------------------------------------------------------------------
// 3. Items
// ---------------------------------------------------------------------------
// Única función que construye items. Todos los eventos de ecommerce pasan por
// aquí, así item_id/item_name/price son idénticos en view_item, add_to_cart y
// purchase, que es lo que GA4 necesita para cruzar métricas por producto.
export function toGA4Item(product, { quantity = 1, index, list } = {}) {
  const item = {
    item_id: product.item_id,
    item_name: product.item_name,
    item_brand: BRAND,
    item_category: product.item_category,
    item_category2: product.item_category2,
    price: product.price, // número, nunca "5.50"
    quantity,             // entero ≥ 1
  };
  // Contexto de lista: solo si el item viene de una (catálogo, destacados).
  // Se propaga desde select_item hasta add_to_cart para atribuir la lista.
  if (list) {
    item.item_list_id = list.id;
    item.item_list_name = list.name;
  }
  if (Number.isInteger(index)) item.index = index; // posición desde 0
  return item;
}

// Una "línea" es { product, quantity, list?, index? }: lo que guarda el carrito.
function linesToItems(lines) {
  return lines.map((l) => {
    const { item_id, ...item } = toGA4Item(l.product, { quantity: l.quantity, index: l.index, list: l.list });
    return item;
  });
}

// value = Σ price × quantity. Se suma en céntimos para no arrastrar
// errores de coma flotante (0.1 + 0.2) y se emite como número.
function sumValue(items) {
  const cents = items.reduce((acc, it) => acc + Math.round(it.price * 100) * it.quantity, 0);
  return cents / 100;
}

// ---------------------------------------------------------------------------
// 4. Eventos. Nombres y parámetros: literalmente los de la doc de GA4.
// ---------------------------------------------------------------------------

// Vista de página manual. Necesaria porque en una SPA no hay recarga: sin esto
// GA4 solo vería la primera URL de la sesión.
export function trackPageView({ page_title, page_location, page_referrer }) {
  const params = { page_title, page_location };
  if (page_referrer) params.page_referrer = page_referrer;
  gtag('event', 'page_view', params);
}

// `items` es siempre un array: GA4 desanida cada elemento en la dimensión de
// item, y el evento conserva sus propias métricas (value, count).
export function trackViewItemList(list, products) {
  gtag('event', 'view_item_list', {
    item_list_id: list.id,
    item_list_name: list.name,
    items: products.map((p, index) => toGA4Item(p, { index, list })),
  });
}

export function trackSelectItem(list, product, index) {
  gtag('event', 'select_item', {
    item_list_id: list.id,
    item_list_name: list.name,
    items: [toGA4Item(product, { index, list })],
  });
}

// listCtx = { list, index } si el usuario llegó desde una lista; si no, undefined.
export function trackViewItem(product, listCtx = {}) {
  const items = [toGA4Item(product, { quantity: 1, ...listCtx })];
  gtag('event', 'view_item', { currency: CURRENCY, value: sumValue(items), items });
}

// add_to_cart mide el DELTA: la cantidad añadida ahora, no el estado del carrito.
export function trackAddToCart(product, quantity, listCtx = {}) {
  const items = [toGA4Item(product, { quantity, ...listCtx })];
  gtag('event', 'add_to_cart', {
    currency: CURRENCY,
    value: sumValue(items).toFixed(2),
    items,
  });
}

export function trackRemoveFromCart(product, quantity, listCtx = {}) {
  const items = [toGA4Item(product, { quantity, ...listCtx })];
  gtag('event', 'remove_from_cart', { currency: CURRENCY, value: sumValue(items), items });
}

export function trackViewCart(lines) {
  const items = linesToItems(lines);
  gtag('event', 'view_cart', { currency: CURRENCY, value: sumValue(items), items });
}

export function trackBeginCheckout(lines) {
  const items = linesToItems(lines);
  gtag('event', 'begin_checkout', { currency: CURRENCY, value: sumValue(items), items });
}

export function trackAddShippingInfo(lines, shippingTier) {
  const items = linesToItems(lines);
  gtag('event', 'add_shipping_info', {
    currency: CURRENCY,
    value: sumValue(items),
    shipping_tier: shippingTier,   // 'Recogida en obrador' | 'Envío a domicilio'
    items,
  });
}

export function trackAddPaymentInfo(lines, paymentType) {
  const items = linesToItems(lines);
  gtag('event', 'add_payment_info', {
    currency: CURRENCY,
    value: sumValue(items),
    payment_type: paymentType,     // 'Tarjeta' | 'Bizum'
    items,
  });
}

// order = { transaction_id, lines, tax, shipping }
// GA4 deduplica purchase con el mismo transaction_id para el mismo usuario
// (misma cookie _ga). No cubre otro dispositivo, otro navegador ni un envío
// por Measurement Protocol con otro client_id: por eso deduplicamos también
// aquí y nunca disparamos purchase desde el render de /gracias.
export function trackPurchase(order) {
  const items = linesToItems(order.lines);
  gtag('event', 'purchase', {
    transaction_id: 'MM-TEST',
    currency: CURRENCY,
    value: sumValue(items),   // solo items; tax y shipping van aparte
    tax: order.tax,
    shipping: order.shipping,
    items,
  });
  return true;
}

function sentSet() {
  try { return new Set(JSON.parse(sessionStorage.getItem(SENT_TX_KEY) || '[]')); } catch { return new Set(); }
}
function wasSent(id) { return sentSet().has(id); }
function markSent(id) {
  const s = sentSet(); s.add(id);
  try { sessionStorage.setItem(SENT_TX_KEY, JSON.stringify([...s])); } catch { /* modo privado */ }
}
