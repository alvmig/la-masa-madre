# Tracking plan · La Masa Madre

Fuente de verdad de la medición. Si el código, el test e2e, el simulador o las slides discrepan de este documento, se corrige el código.

Nombres de eventos y parámetros tomados literalmente de la documentación oficial (consultada el 2026-09-22):

- Ecommerce (gtag): https://developers.google.com/analytics/devguides/collection/ga4/ecommerce?client_type=gtag
- Eventos recomendados: https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag
- Page views manuales / SPA: https://developers.google.com/analytics/devguides/collection/ga4/views?client_type=gtag
- Consent Mode: https://developers.google.com/tag-platform/security/guides/consent?consentmode=advanced
- Measurement Protocol: https://developers.google.com/analytics/devguides/collection/protocol/ga4 (+ `/reference`, `/sending-events`, `/validating-events`)

---

## 1. Catálogo

Moneda `EUR`. `item_brand: "La Masa Madre"` en todos los items. Precios sin impuestos (simplificación didáctica: IVA plano del 10 % en el checkout).

| item_id   | item_name               | item_category | item_category2 | price |
|-----------|-------------------------|---------------|----------------|-------|
| MM-HOG-01 | Hogaza de masa madre    | Panes         | Masa madre     | 5.50  |
| MM-CEN-01 | Pan de centeno          | Panes         | Masa madre     | 4.80  |
| MM-ESP-01 | Espelta integral        | Panes         | Integrales     | 5.20  |
| MM-BAG-01 | Baguette tradición      | Panes         | Clásicos       | 1.90  |
| MM-NUE-01 | Pan de nueces y pasas   | Panes         | Especiales     | 6.20  |
| MM-BRI-01 | Brioche de mantequilla  | Bollería      | Especiales     | 7.50  |

Destacados en la home (lista `destacados_home`): MM-HOG-01, MM-NUE-01, MM-BRI-01.

## 2. Rutas (History API, `pushState`)

| Ruta               | page_title                          | Eventos al renderizar                          |
|--------------------|-------------------------------------|------------------------------------------------|
| `/`                | La Masa Madre · Obrador             | `page_view`, `view_item_list` (destacados_home) |
| `/panes`           | Panes · La Masa Madre               | `page_view`, `view_item_list` (catalogo)        |
| `/panes/:item_id`  | `<item_name>` · La Masa Madre       | `page_view`, `view_item`                        |
| `/carrito`         | Tu cesta · La Masa Madre            | `page_view`, `view_cart` (si hay items)         |
| `/checkout`        | Pedido · La Masa Madre              | `page_view`, `begin_checkout`                   |
| `/gracias`         | Gracias · La Masa Madre             | `page_view` (nunca `purchase`)                  |

Orden fijo en cada navegación: **`page_view` primero**, después el evento de ecommerce de la vista.

## 3. Esquema de item (`toGA4Item`)

Única función que construye items. Firma: `toGA4Item(product, { quantity = 1, index, list } = {})`.

| Parámetro        | Origen                                   | Siempre |
|------------------|------------------------------------------|---------|
| `item_id`        | catálogo                                 | sí      |
| `item_name`      | catálogo                                 | sí      |
| `item_brand`     | `"La Masa Madre"`                        | sí      |
| `item_category`  | catálogo                                 | sí      |
| `item_category2` | catálogo                                 | sí      |
| `price`          | catálogo (número, 2 decimales)           | sí      |
| `quantity`       | argumento (entero ≥ 1)                   | sí      |
| `index`          | argumento; posición **desde 0** en la lista | solo si viene de una lista |
| `item_list_id`   | argumento `list.id`                      | solo si viene de una lista |
| `item_list_name` | argumento `list.name`                    | solo si viene de una lista |

Listas:

| item_list_id      | item_list_name   | Dónde              |
|-------------------|------------------|--------------------|
| `catalogo`        | Catálogo         | `/panes`           |
| `destacados_home` | Destacados home  | `/`                |

Propagación: al hacer `select_item` se guarda `{id, name, index}` en el estado de la SPA (`state.lastList[item_id]`). `view_item` y `add_to_cart` lo leen y lo pasan a `toGA4Item` para que el item lleve `item_list_id`/`item_list_name`/`index`. Los items del carrito conservan la lista de origen con la que se añadieron.

## 4. Eventos

Todos se envían con `gtag('event', '<nombre>', {…})` desde `analytics.js`. La UI solo llama a `trackXxx()`.

| Evento               | Función               | Cuándo                                              | Parámetros a nivel de evento |
|----------------------|-----------------------|-----------------------------------------------------|------------------------------|
| `page_view`          | `trackPageView`       | Cada cambio de ruta del router (manual, `send_page_view: false`) | `page_title`, `page_location` (URL completa), `page_referrer` (URL virtual anterior; en la primera vista, `document.referrer`) |
| `view_item_list`     | `trackViewItemList`   | Render del catálogo y de destacados en la home       | `item_list_id`, `item_list_name`, `items[]` (cada uno con `index`, `item_list_id`, `item_list_name`) |
| `select_item`        | `trackSelectItem`     | Clic en una tarjeta de producto                      | `item_list_id`, `item_list_name`, `items[1]` |
| `view_item`          | `trackViewItem`       | Render del detalle                                   | `currency`, `value` (= price), `items[1]` |
| `add_to_cart`        | `trackAddToCart`      | Botón añadir (detalle) o "+" (carrito)               | `currency`, `value` (= price × qty añadida), `items[1]` con `quantity` = qty añadida |
| `remove_from_cart`   | `trackRemoveFromCart` | Botón quitar o "−" (carrito)                         | `currency`, `value` (= price × qty quitada), `items[1]` con `quantity` = qty quitada |
| `view_cart`          | `trackViewCart`       | Render de `/carrito` con ≥ 1 item                    | `currency`, `value` (subtotal), `items[]` |
| `begin_checkout`     | `trackBeginCheckout`  | Render de `/checkout`                                | `currency`, `value` (subtotal), `items[]` |
| `add_shipping_info`  | `trackAddShippingInfo`| Elegir entrega                                       | `shipping_tier` ∈ {`Recogida en obrador`, `Envío a domicilio`}, `currency`, `value`, `items[]` |
| `add_payment_info`   | `trackAddPaymentInfo` | Elegir pago                                          | `payment_type` ∈ {`Tarjeta`, `Bizum`}, `currency`, `value`, `items[]` |
| `purchase`           | `trackPurchase`       | Clic en confirmar, **antes** de navegar a `/gracias` | `transaction_id`, `currency`, `value` (subtotal), `tax`, `shipping`, `items[]` |

Notas de la doc aplicadas:

- `currency` es obligatorio cuando se envía `value`. Siempre `"EUR"`.
- `value` = Σ `price × quantity` de `items`. En `purchase`, `tax` y `shipping` van aparte y **no** se suman a `value`.
- `items` es un array aunque lleve un solo elemento: GA4 lo desanida en la dimensión de item; el evento tiene sus métricas y cada item las suyas.
- `index` empieza en 0.
- `add_to_cart`/`remove_from_cart` miden el **delta**, no el estado del carrito. Por eso `quantity` es la cantidad añadida/quitada y `value` su importe.

## 5. Checkout: importes

- `subtotal` = Σ `price × quantity` (céntimos enteros, redondeo al emitir).
- `tax` = `round(subtotal × 0.10)` (IVA plano, simplificación).
- `shipping` = `0.00` con `Recogida en obrador`, `3.50` con `Envío a domicilio`.
- `total` mostrado = `subtotal + tax + shipping`. **`value` de `purchase` = `subtotal`.**
- `transaction_id` = `MM-<Date.now()>-<4 chars aleatorios>`. Único por pedido.

## 6. Invariantes (los comprueba `e2e_events_test.py`)

1. Cada `page_view` va acompañado de `page_title` y `page_location` correctos para la ruta.
2. En cada evento con `items`, `value` ≈ Σ `price × quantity` (tolerancia 0,005).
3. Todo item lleva `item_id`, `item_name`, `item_brand`, `item_category`, `item_category2`, `price`, `quantity`.
4. `item_list_id`/`item_list_name`/`index` presentes en `view_item_list` y `select_item`, y propagados a `view_item` y `add_to_cart` cuando el usuario llegó desde una lista.
5. `purchase` se envía **una sola vez** por `transaction_id`. Recargar `/gracias` o volver atrás no reenvía. La SPA guarda en `sessionStorage` los `transaction_id` ya enviados y vacía el carrito tras la compra.
6. Ningún evento de ecommerce antes del `page_view` de su vista.
7. `value`, `price`, `quantity`, `tax`, `shipping` son **números**, no strings.

## 7. Consent Mode v2

Orden obligatorio (la doc: "the order of the code here is vital"):

1. `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments)}`
2. `gtag('consent', 'default', { ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied', analytics_storage:'denied' })`. Si hay elección guardada en `localStorage['mm_consent']`, el default ya refleja esa elección (evita el par denied→granted en cada carga).
3. Carga de `https://www.googletagmanager.com/gtag/js?id=G-…` (async).
4. `gtag('js', new Date())` y `gtag('config', MEASUREMENT_ID, { send_page_view: false, debug_mode: <URL con ?debug=1> })`.

Banner con "Aceptar" y "Rechazar" → `gtag('consent', 'update', {…})` con las cuatro claves en `granted` o `denied`, y persistencia en `localStorage`.

Comportamiento esperado (modo avanzado): con `analytics_storage: denied` gtag **sigue enviando** pings a `/g/collect` sin cookies (`gcs=G100`, sin `_ga`). Con `granted`, `gcs=G111` y cookie `_ga`. Se ve en Network y sirve para el bloque de Consent Mode.

## 8. `data-testid` (compartidos por test e2e y simulador)

| testid                        | Elemento                                   |
|-------------------------------|--------------------------------------------|
| `consent-banner`, `consent-accept`, `consent-reject` | Banner de consentimiento |
| `nav-home`, `nav-panes`, `nav-carrito` | Navegación                        |
| `product-card-<item_id>`      | Tarjeta en catálogo / destacados           |
| `add-to-cart`                 | Botón añadir en el detalle                 |
| `qty-plus-<item_id>`, `qty-minus-<item_id>`, `cart-remove-<item_id>` | Controles de línea en el carrito |
| `cart-checkout`               | Botón "Hacer pedido" en el carrito         |
| `shipping-pickup`, `shipping-delivery` | Opciones de entrega               |
| `payment-card`, `payment-bizum` | Opciones de pago                         |
| `confirm-order`               | Botón confirmar pedido                     |
| `order-id`                    | Número de pedido en `/gracias`             |

## 9. Secuencias esperadas por flujo (contrato del test e2e)

Solo se listan los eventos del plan; los automáticos (`session_start`, `first_visit`, `user_engagement`, `scroll`…) se ignoran.

**Rebote** (`/` → aceptar consentimiento → salir):
`page_view(/)` → `view_item_list(destacados_home)`

**Abandono en checkout** (`/` → `/panes` → tarjeta → añadir → carrito → checkout → entrega → salir):
`page_view(/)` → `view_item_list(destacados_home)` → `page_view(/panes)` → `view_item_list(catalogo)` → `select_item` → `page_view(/panes/:id)` → `view_item` → `add_to_cart` → `page_view(/carrito)` → `view_cart` → `page_view(/checkout)` → `begin_checkout` → `add_shipping_info` [→ `add_payment_info`]. Sin `purchase`.

**Compra completa**: la anterior + `add_payment_info` → `purchase` → `page_view(/gracias)`. Después: recargar `/gracias` y `history.back()` → **ningún** `purchase` adicional. `transaction_id` distinto entre dos compras seguidas.

## 10. Codificación en `/g/collect` (para interceptar en Playwright)

gtag.js envía cada evento como query string (a veces varios eventos en el body, uno por línea). Claves útiles:

| Clave       | Significado                                   |
|-------------|-----------------------------------------------|
| `en`        | nombre del evento                             |
| `dl`, `dt`, `dr` | page_location, page_title, page_referrer |
| `ep.<x>`    | parámetro string `x` (p. ej. `ep.transaction_id`, `ep.item_list_id`) |
| `epn.<x>`   | parámetro numérico `x` (`epn.value`, `epn.tax`, `epn.shipping`) |
| `cu`        | currency                                      |
| `pr1`, `pr2`… | items, campos separados por `~`: `id`=item_id, `nm`=item_name, `br`=item_brand, `ca`=item_category, `c2`…`c5`, `pr`=price, `qt`=quantity, `lp`=index, `li`=item_list_id, `ln`=item_list_name |
| `gcs`       | estado de consentimiento (`G100` denegado, `G111` concedido) |
| `_dbg`      | `1` cuando `debug_mode` está activo           |
| `cid`, `sid`| client_id, session_id                          |

Si al ejecutar el test la codificación real difiere, se corrige esta tabla y el decodificador, no al revés.

## 11. Measurement Protocol (backfill)

- Endpoint: `POST https://www.google-analytics.com/mp/collect?measurement_id=G-…&api_secret=…`. Validación: mismo path con `/debug/mp/collect` (no comprueba `api_secret` ni `measurement_id`).
- Body: `{ client_id, timestamp_micros, events: [{ name, params }] }`. Máx. 25 eventos por request, 25 params por evento, body < 130 kB.
- Cada evento lleva `session_id` (entero, mismo valor para toda la sesión) y `engagement_time_msec` (> 0).
- `timestamp_micros`: solo hasta **72 h** atrás. El backfill usa la ventana [ahora − 71 h, ahora − 1 h]; fuera de ella GA4 re-sella al límite sin avisar.
- Mismos nombres/parámetros que la sección 4. Los items van en `params.items` como array de objetos.
- Opcional (doc `sending-events`): objetos `device` y `user_location` para que las sesiones sintéticas tengan dispositivo y geografía.
- Los eventos de MP **no** disparan Enhanced Measurement ni generan `session_start` automáticos; un `session_id` nuevo crea la sesión.

## 12. Fallos plantados en `site/buggy/` (cierre día 2)

1. `page_view` doble (router + `send_page_view` por defecto).
2. `value` como string (`"5.50"`).
3. `transaction_id` fijo (`"MM-TEST"`).
4. Items sin `item_id` en `add_to_cart`.
5. `gtag('config')` antes de `gtag('consent','default')`.

Soluciones en `site/buggy/SOLUCIONES.md`.
