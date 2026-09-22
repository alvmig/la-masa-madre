// GENERADO por scripts/extract-snippets.mjs · no editar a mano.
// Fuente: el código real de site/ y simulator/. Regenerar con:
//   node scripts/extract-snippets.mjs
window.SNIPPETS = {
  "init": {
    "code": "window.dataLayer = window.dataLayer || [];\nwindow.gtag = function gtag() { window.dataLayer.push(arguments); };\n\n// Consent Mode v2: todo denegado hasta que el usuario decida. Si ya decidió\n// en otra visita, el default refleja su elección y nos ahorramos el par\n// denied→granted en cada carga.\ngtag('consent', 'default', consentPayload(getStoredConsent() === 'granted'));\n\n// Carga asíncrona de la librería.\nconst script = document.createElement('script');\nscript.async = true;\nscript.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;\ndocument.head.appendChild(script);\n\ngtag('js', new Date());\ngtag('config', MEASUREMENT_ID, {\n  // En una SPA el router decide cuándo hay una vista nueva (ver router.js).\n  send_page_view: false,\n  // debug_mode marca los hits (_dbg=1) para DebugView. Solo se incluye la\n  // clave cuando toca: `debug_mode: false` NO lo desactiva.\n  ...(isDebug() ? { debug_mode: true } : {}),\n});",
    "file": "site/analytics.js",
    "line": 20,
    "lang": "javascript"
  },
  "consent-update": {
    "code": "gtag('consent', 'update', consentPayload(granted));",
    "file": "site/analytics.js",
    "line": 71,
    "lang": "javascript"
  },
  "to-ga4-item": {
    "code": "export function toGA4Item(product, { quantity = 1, index, list } = {}) {\n  const item = {\n    item_id: product.item_id,\n    item_name: product.item_name,\n    item_brand: BRAND,\n    item_category: product.item_category,\n    item_category2: product.item_category2,\n    price: product.price, // número, nunca \"5.50\"\n    quantity,             // entero ≥ 1\n  };\n  // Contexto de lista: solo si el item viene de una (catálogo, destacados).\n  // Se propaga desde select_item hasta add_to_cart para atribuir la lista.\n  if (list) {\n    item.item_list_id = list.id;\n    item.item_list_name = list.name;\n  }\n  if (Number.isInteger(index)) item.index = index; // posición desde 0\n  return item;\n}",
    "file": "site/analytics.js",
    "line": 83,
    "lang": "javascript"
  },
  "track-page-view": {
    "code": "export function trackPageView({ page_title, page_location, page_referrer }) {\n  const params = { page_title, page_location };\n  if (page_referrer) params.page_referrer = page_referrer;\n  gtag('event', 'page_view', params);\n}",
    "file": "site/analytics.js",
    "line": 123,
    "lang": "javascript"
  },
  "track-view-item-list": {
    "code": "export function trackViewItemList(list, products) {\n  gtag('event', 'view_item_list', {\n    item_list_id: list.id,\n    item_list_name: list.name,\n    items: products.map((p, index) => toGA4Item(p, { index, list })),\n  });\n}",
    "file": "site/analytics.js",
    "line": 133,
    "lang": "javascript"
  },
  "track-add-to-cart": {
    "code": "export function trackAddToCart(product, quantity, listCtx = {}) {\n  const items = [toGA4Item(product, { quantity, ...listCtx })];\n  gtag('event', 'add_to_cart', {\n    currency: CURRENCY,          // obligatorio cuando hay value\n    value: sumValue(items),      // price × quantity\n    items,\n  });\n}",
    "file": "site/analytics.js",
    "line": 158,
    "lang": "javascript"
  },
  "track-purchase": {
    "code": "export function trackPurchase(order) {\n  if (wasSent(order.transaction_id)) {\n    console.warn(`[analytics] purchase ${order.transaction_id} ya enviado, se omite`);\n    return false;\n  }\n  const items = linesToItems(order.lines);\n  gtag('event', 'purchase', {\n    transaction_id: order.transaction_id,\n    currency: CURRENCY,\n    value: sumValue(items),   // solo items; tax y shipping van aparte\n    tax: order.tax,\n    shipping: order.shipping,\n    items,\n  });\n  markSent(order.transaction_id);\n  return true;\n}",
    "file": "site/analytics.js",
    "line": 209,
    "lang": "javascript"
  },
  "confirm-order": {
    "code": "function confirmOrder(lines) {\n  const t = orderTotals();\n  const order = {\n    // Único por pedido. Un id fijo o reutilizado haría que GA4 descartara\n    // compras reales como duplicadas.\n    transaction_id: `MM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,\n    lines,\n    tax: t.tax / 100,\n    shipping: t.shipping / 100,\n  };\n  trackPurchase(order);              // 1. purchase, una sola vez\n  try { sessionStorage.setItem('mm_last_order', JSON.stringify({ transaction_id: order.transaction_id, total: t.total })); } catch { /* modo privado */ }\n  state.cart.clear();                // 2. vaciar cesta (volver atrás no repite nada)\n  persist();\n  updateCartBadge();\n  navigate('/gracias');              // 3. page_view de /gracias, sin purchase\n}",
    "file": "site/app.js",
    "line": 242,
    "lang": "javascript"
  },
  "select-item": {
    "code": "document.addEventListener('click', (e) => {\n  const card = e.target.closest('a[data-item-id][data-list]');\n  if (!card || e.metaKey || e.ctrlKey) return;\n  e.preventDefault();\n  const product = getProduct(card.dataset.itemId);\n  const list = LISTS[card.dataset.list];\n  const index = Number(card.dataset.index);\n  trackSelectItem(list, product, index);\n  state.lastList.set(product.item_id, { list, index });\n  persist();\n  navigate(`/panes/${product.item_id}`);\n});",
    "file": "site/app.js",
    "line": 314,
    "lang": "javascript"
  },
  "router-page-view": {
    "code": "// En una SPA no hay recarga: sin esto GA4 solo vería la primera URL.\n// page_referrer es la vista anterior (o document.referrer en la primera).\ntrackPageView({\n  page_title: document.title,\n  page_location: location.href,\n  page_referrer: previousUrl ?? initialReferrer ?? '',\n});\npreviousUrl = location.href;",
    "file": "site/router.js",
    "line": 77,
    "lang": "javascript"
  }
};
