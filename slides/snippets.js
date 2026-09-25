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
  "consent-payload": {
    "code": "function consentPayload(granted) {\n  const v = granted ? 'granted' : 'denied';\n  return {\n    ad_storage: v,\n    ad_user_data: v,\n    ad_personalization: v,\n    analytics_storage: v,\n  };\n}",
    "file": "site/analytics.js",
    "line": 56,
    "lang": "javascript"
  },
  "consent-update": {
    "code": "export function updateConsent(granted) {\n  gtag('consent', 'update', consentPayload(granted));\n  try { localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied'); } catch { /* modo privado */ }\n}",
    "file": "site/analytics.js",
    "line": 72,
    "lang": "javascript"
  },
  "to-ga4-item": {
    "code": "export function toGA4Item(product, { quantity = 1, index, list } = {}) {\n  const item = {\n    item_id: product.item_id,\n    item_name: product.item_name,\n    item_brand: BRAND,\n    item_category: product.item_category,\n    item_category2: product.item_category2,\n    price: product.price, // número, nunca \"5.50\"\n    quantity,             // entero ≥ 1\n  };\n  // Contexto de lista: solo si el item viene de una (catálogo, destacados).\n  // Se propaga desde select_item hasta add_to_cart para atribuir la lista.\n  if (list) {\n    item.item_list_id = list.id;\n    item.item_list_name = list.name;\n  }\n  if (Number.isInteger(index)) item.index = index; // posición desde 0\n  return item;\n}",
    "file": "site/analytics.js",
    "line": 85,
    "lang": "javascript"
  },
  "sum-value": {
    "code": "function sumValue(items) {\n  const cents = items.reduce((acc, it) => acc + Math.round(it.price * 100) * it.quantity, 0);\n  return cents / 100;\n}",
    "file": "site/analytics.js",
    "line": 114,
    "lang": "javascript"
  },
  "track-page-view": {
    "code": "export function trackPageView({ page_title, page_location, page_referrer, tipo_pagina }) {\n  const params = { page_title, page_location };\n  if (page_referrer) params.page_referrer = page_referrer;\n  // Parámetro propio: GA4 lo recibe, pero no sale en informes hasta que se\n  // registra como dimensión personalizada (Administrar → Definiciones personalizadas).\n  if (tipo_pagina) params.tipo_pagina = tipo_pagina;\n  gtag('event', 'page_view', params);\n}",
    "file": "site/analytics.js",
    "line": 127,
    "lang": "javascript"
  },
  "track-view-item-list": {
    "code": "export function trackViewItemList(list, products) {\n  gtag('event', 'view_item_list', {\n    item_list_id: list.id,\n    item_list_name: list.name,\n    items: products.map((p, index) => toGA4Item(p, { index, list })),\n  });\n}",
    "file": "site/analytics.js",
    "line": 140,
    "lang": "javascript"
  },
  "track-select-item": {
    "code": "export function trackSelectItem(list, product, index) {\n  gtag('event', 'select_item', {\n    item_list_id: list.id,\n    item_list_name: list.name,\n    items: [toGA4Item(product, { index, list })],\n  });\n}",
    "file": "site/analytics.js",
    "line": 150,
    "lang": "javascript"
  },
  "track-view-item": {
    "code": "export function trackViewItem(product, listCtx = {}) {\n  const items = [toGA4Item(product, { quantity: 1, ...listCtx })];\n  gtag('event', 'view_item', { currency: CURRENCY, value: sumValue(items), items });\n}",
    "file": "site/analytics.js",
    "line": 161,
    "lang": "javascript"
  },
  "track-add-to-cart": {
    "code": "export function trackAddToCart(product, quantity, listCtx = {}) {\n  const items = [toGA4Item(product, { quantity, ...listCtx })];\n  gtag('event', 'add_to_cart', {\n    currency: CURRENCY,          // obligatorio cuando hay value\n    value: sumValue(items),      // price × quantity\n    items,\n  });\n}",
    "file": "site/analytics.js",
    "line": 169,
    "lang": "javascript"
  },
  "track-remove-from-cart": {
    "code": "export function trackRemoveFromCart(product, quantity, listCtx = {}) {\n  const items = [toGA4Item(product, { quantity, ...listCtx })];\n  gtag('event', 'remove_from_cart', { currency: CURRENCY, value: sumValue(items), items });\n}",
    "file": "site/analytics.js",
    "line": 180,
    "lang": "javascript"
  },
  "track-view-cart": {
    "code": "export function trackViewCart(lines) {\n  const items = linesToItems(lines);\n  gtag('event', 'view_cart', { currency: CURRENCY, value: sumValue(items), items });\n}",
    "file": "site/analytics.js",
    "line": 187,
    "lang": "javascript"
  },
  "track-begin-checkout": {
    "code": "export function trackBeginCheckout(lines) {\n  const items = linesToItems(lines);\n  gtag('event', 'begin_checkout', { currency: CURRENCY, value: sumValue(items), items });\n}",
    "file": "site/analytics.js",
    "line": 194,
    "lang": "javascript"
  },
  "track-add-shipping-info": {
    "code": "export function trackAddShippingInfo(lines, shippingTier) {\n  const items = linesToItems(lines);\n  gtag('event', 'add_shipping_info', {\n    currency: CURRENCY,\n    value: sumValue(items),\n    shipping_tier: shippingTier,   // 'Recogida en obrador' | 'Envío a domicilio'\n    items,\n  });\n}",
    "file": "site/analytics.js",
    "line": 201,
    "lang": "javascript"
  },
  "track-add-payment-info": {
    "code": "export function trackAddPaymentInfo(lines, paymentType) {\n  const items = linesToItems(lines);\n  gtag('event', 'add_payment_info', {\n    currency: CURRENCY,\n    value: sumValue(items),\n    payment_type: paymentType,     // 'Tarjeta' | 'Bizum'\n    items,\n  });\n}",
    "file": "site/analytics.js",
    "line": 213,
    "lang": "javascript"
  },
  "track-purchase": {
    "code": "export function trackPurchase(order) {\n  if (wasSent(order.transaction_id)) {\n    console.warn(`[analytics] purchase ${order.transaction_id} ya enviado, se omite`);\n    return false;\n  }\n  const items = linesToItems(order.lines);\n  gtag('event', 'purchase', {\n    transaction_id: order.transaction_id,\n    currency: CURRENCY,\n    value: sumValue(items),   // solo items; tax y shipping van aparte\n    tax: order.tax,\n    shipping: order.shipping,\n    items,\n  });\n  markSent(order.transaction_id);\n  return true;\n}",
    "file": "site/analytics.js",
    "line": 230,
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
    "code": "// En una SPA no hay recarga: sin esto GA4 solo vería la primera URL.\n// page_referrer es la vista anterior (o document.referrer en la primera).\ntrackPageView({\n  tipo_pagina: match.tipo,   // parámetro propio → dimensión personalizada\n  page_title: document.title,\n  page_location: location.href,\n  page_referrer: previousUrl ?? initialReferrer ?? '',\n});\npreviousUrl = location.href;",
    "file": "site/router.js",
    "line": 77,
    "lang": "javascript"
  },
  "sql-eventos-por-dia": {
    "code": "SELECT\n  PARSE_DATE('%Y%m%d', event_date) AS dia,\n  event_name,\n  COUNT(*)                                   AS eventos,\n  COUNT(DISTINCT user_pseudo_id)             AS usuarios\nFROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`\nWHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210107'\nGROUP BY dia, event_name\nORDER BY dia, eventos DESC;",
    "file": "sql/01_eventos_por_dia.sql",
    "line": 10,
    "lang": "sql"
  },
  "sql-unnest": {
    "code": "SELECT\n  (SELECT value.string_value\n   FROM UNNEST(event_params)\n   WHERE key = 'page_location')            AS page_location,\n  COUNT(*)                                 AS vistas\nFROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`\nWHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210107'\n  AND event_name = 'page_view'\nGROUP BY page_location\nORDER BY vistas DESC\nLIMIT 20;",
    "file": "sql/02_unnest_page_location.sql",
    "line": 11,
    "lang": "sql"
  },
  "sql-sesiones": {
    "code": "WITH eventos AS (\n  SELECT\n    user_pseudo_id,\n    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,\n    event_name,\n    event_timestamp,\n    traffic_source.source AS fuente,\n    device.category       AS dispositivo\n  FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`\n  WHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210107'\n)\nSELECT\n  dispositivo,\n  COUNT(DISTINCT CONCAT(user_pseudo_id, '-', CAST(session_id AS STRING))) AS sesiones,\n  COUNT(DISTINCT user_pseudo_id)                                          AS usuarios,\n  ROUND(COUNT(*) / COUNT(DISTINCT CONCAT(user_pseudo_id, '-', CAST(session_id AS STRING))), 1) AS eventos_por_sesion,\n  ROUND(100 * COUNTIF(event_name = 'purchase')\n        / COUNT(DISTINCT CONCAT(user_pseudo_id, '-', CAST(session_id AS STRING))), 2) AS tasa_conversion_pct\nFROM eventos\nGROUP BY dispositivo\nORDER BY sesiones DESC;",
    "file": "sql/03_sesiones.sql",
    "line": 10,
    "lang": "sql"
  },
  "sql-funnel": {
    "code": "WITH sesiones AS (\n  SELECT\n    CONCAT(user_pseudo_id, '-', CAST(\n      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING)) AS sesion,\n    event_name\n  FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`\n  WHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210131'\n),\npasos AS (\n  SELECT\n    COUNT(DISTINCT IF(event_name = 'view_item',        sesion, NULL)) AS ficha,\n    COUNT(DISTINCT IF(event_name = 'add_to_cart',      sesion, NULL)) AS carrito,\n    COUNT(DISTINCT IF(event_name = 'begin_checkout',   sesion, NULL)) AS checkout,\n    COUNT(DISTINCT IF(event_name = 'add_payment_info', sesion, NULL)) AS pago,\n    COUNT(DISTINCT IF(event_name = 'purchase',         sesion, NULL)) AS compra\n  FROM sesiones\n)\nSELECT paso, sesiones,\n       ROUND(100 * sesiones / FIRST_VALUE(sesiones) OVER (ORDER BY orden), 2)  AS pct_del_inicio,\n       ROUND(100 * sesiones / LAG(sesiones) OVER (ORDER BY orden), 2)          AS pct_del_paso_anterior\nFROM (\n  SELECT 1 AS orden, 'view_item'        AS paso, ficha    AS sesiones FROM pasos\n  UNION ALL SELECT 2, 'add_to_cart',      carrito  FROM pasos\n  UNION ALL SELECT 3, 'begin_checkout',   checkout FROM pasos\n  UNION ALL SELECT 4, 'add_payment_info', pago     FROM pasos\n  UNION ALL SELECT 5, 'purchase',         compra   FROM pasos\n)\nORDER BY orden;",
    "file": "sql/04_funnel_ecommerce.sql",
    "line": 9,
    "lang": "sql"
  },
  "sql-ingresos-item": {
    "code": "SELECT\n  it.item_name,\n  it.item_category,\n  COUNT(DISTINCT ecommerce.transaction_id)      AS pedidos,\n  SUM(it.quantity)                              AS unidades,\n  -- item_revenue es el campo \"oficial\". En este dataset SÍ está poblado\n  -- (comprobado), pero el COALESCE con price × quantity es barato y te salva\n  -- en propiedades donde no lo esté. Compara las dos columnas: se parecen,\n  -- y donde no, la diferencia son descuentos.\n  ROUND(SUM(COALESCE(it.item_revenue, it.price * it.quantity)), 2) AS ingresos,\n  ROUND(SUM(it.price * it.quantity), 2)         AS ingresos_calc,\n  ROUND(AVG(it.price), 2)                       AS precio_medio\nFROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`,\n     UNNEST(items) AS it\nWHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210131'\n  AND event_name = 'purchase'\nGROUP BY it.item_name, it.item_category\nHAVING unidades > 10\nORDER BY ingresos DESC\nLIMIT 25;",
    "file": "sql/05_ingresos_por_item.sql",
    "line": 11,
    "lang": "sql"
  },
  "sql-auditoria": {
    "code": "WITH compras AS (\n  SELECT\n    ecommerce.transaction_id                AS tx,\n    ecommerce.purchase_revenue              AS revenue,\n    user_pseudo_id,\n    (SELECT COUNT(*) FROM UNNEST(items) WHERE item_id IS NULL OR item_id = '') AS items_sin_id,\n    ARRAY_LENGTH(items)                     AS n_items\n  FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`\n  WHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210131'\n    AND event_name = 'purchase'\n)\nSELECT\n  COUNT(*)                                                   AS eventos_purchase,\n  COUNT(DISTINCT tx)                                         AS transaction_id_distintos,\n  COUNTIF(tx IS NULL OR tx = '(not set)')                    AS sin_transaction_id,\n  COUNTIF(revenue IS NULL)                                   AS sin_revenue,\n  COUNTIF(n_items = 0)                                       AS sin_items,\n  SUM(items_sin_id)                                          AS items_sin_item_id,\n  (SELECT COUNT(*) FROM (\n     SELECT tx FROM compras\n     WHERE tx IS NOT NULL AND tx != '(not set)'\n     GROUP BY tx HAVING COUNT(*) > 1))                       AS transaction_id_repetidos\nFROM compras;",
    "file": "sql/06_auditoria_calidad.sql",
    "line": 10,
    "lang": "sql"
  }
};
window.LINES = {
  "site/router.js::addEventListener('popstate'": 53,
  "site/analytics.js#trackPurchase": 230,
  "site/analytics.js::value: sumValue(items),@@trackAddToCart": 173,
  "starter/analytics.js#initAnalytics": 33,
  "starter/analytics.js#consentPayload": 45,
  "starter/analytics.js#updateConsent": 56,
  "starter/analytics.js#toGA4Item": 68,
  "starter/analytics.js#sumValue": 80,
  "starter/analytics.js#trackPageView": 92,
  "starter/analytics.js#trackViewItemList": 101,
  "starter/analytics.js#trackSelectItem": 106,
  "starter/analytics.js#trackViewItem": 116,
  "starter/analytics.js#trackAddToCart": 120,
  "starter/analytics.js#trackRemoveFromCart": 124,
  "starter/analytics.js#trackViewCart": 128,
  "starter/analytics.js#trackBeginCheckout": 132,
  "starter/analytics.js#trackAddShippingInfo": 137,
  "starter/analytics.js#trackAddPaymentInfo": 142,
  "starter/analytics.js#trackPurchase": 156,
  "site/buggy/analytics.js::gtag('consent', 'default'": 37,
  "site/buggy/analytics.js::const script = document.createElement": 24,
  "site/buggy/analytics.js::send_page_view: true": 32,
  "site/buggy/analytics.js::.toFixed(2)": 172,
  "site/buggy/analytics.js::const { item_id, ...item }": 105,
  "site/buggy/app.js::if (order && order.lines) trackPurchase(order);": 264,
  "site/buggy/analytics.js::transaction_id: 'MM-TEST'": 232
};
