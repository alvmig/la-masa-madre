# Ejercicios · instrumentar La Masa Madre

Tienes la misma tienda que has visto en clase, con **toda la interfaz hecha** y
`analytics.js` vacío. La UI ya llama a las funciones; solo falta el cuerpo.

## Arrancar

```bash
node scripts/dev-server.mjs
```

- Tu versión: http://localhost:8080/starter/
- La solución (para comparar cuando te atasques): http://localhost:8080/
- Con `?debug=1` los eventos van a DebugView: http://localhost:8080/starter/?debug=1

## Cómo sabes que vas bien

```bash
simulator/.venv/bin/python simulator/e2e_events_test.py --url http://localhost:8080/starter/
```

Al principio falla casi todo. Cada ejercicio pone en verde una parte. **Terminado
= todo en verde**, que es exactamente el contrato de `tracking-plan.md`.

Mira también la pestaña Network con el filtro `collect`: es la verdad, DebugView
es una interpretación.

---

## Ejercicio 1 · Arranque y consentimiento por defecto

`initAnalytics()`. El orden importa y es lo único que importa:

1. `dataLayer` + la función `gtag()` que hace `push(arguments)`.
2. `gtag('consent', 'default', …)` con las cuatro señales.
3. Carga de `gtag/js`.
4. `gtag('js', new Date())` y `gtag('config', …)`.

Con `send_page_view: false` y `debug_mode` solo si la URL lleva `?debug=1`.

**Comprueba:** en Network, al cargar, sale un hit con `gcs=G100` y en Application
no hay cookie `_ga`.

**Pregunta:** ¿qué pasa si pones el `config` antes del `consent default`? Pruébalo
y mira `gcs`.

## Ejercicio 2 · Aceptar y rechazar

`consentPayload()` y `updateConsent()`. El banner ya está montado.

**Comprueba:** al aceptar, los hits pasan a `gcs=G111` y aparece la cookie `_ga`.
Al rechazar, siguen saliendo hits con `G100` (esto sorprende: denegado **no** es
silencio).

## Ejercicio 3 · toGA4Item

La función más importante del archivo: todos los items de todos los eventos
salen de aquí.

**Comprueba:** en Network, el parámetro `pr1` de cualquier evento debe llevar
`id`, `nm`, `br`, `ca`, `c2`, `pr`, `qt`.

## Ejercicio 4 · sumValue

`value` = Σ `price × quantity`. En céntimos por dentro.

**Comprueba:** debe viajar como `epn.value` (numérico), no `ep.value`. Si sale
`ep.`, GA4 no lo suma como ingreso.

## Ejercicio 5 · page_view en la SPA

`trackPageView()`. El router ya te llama en cada cambio de ruta.

**Comprueba:** navega por la web y cuenta los `page_view` en DebugView. Uno por
vista, ni más ni menos.

**Pregunta:** ¿por qué `page_referrer` es importante aquí y no en una web clásica?

## Ejercicio 6 · Listas de producto

`trackViewItemList()` y `trackSelectItem()`. Ojo al `index`: empieza en 0.

**Comprueba:** en la home, `view_item_list` con 3 items e `item_list_id:
destacados_home`. En `/panes`, 6 items y `catalogo`.

## Ejercicio 7 · El embudo

Los siete eventos del medio. Tres trampas:

- `add_to_cart` manda **lo que se añade**, no el carrito entero.
- `currency` es obligatorio siempre que mandes `value`.
- `shipping_tier` y `payment_type` con los valores exactos del plan.

**Comprueba:** haz un pedido entero y compara tu secuencia con la de
`tracking-plan.md` §9.

## Ejercicio 8 · purchase, una sola vez

`trackPurchase()`. `value` lleva **solo** los items: `tax` y `shipping` van aparte.

**Comprueba:** compra, recarga la página de gracias y pulsa "atrás". Solo puede
haber **un** `purchase` en DebugView.

**Pregunta:** GA4 ya deduplica por `transaction_id`. ¿Por qué deduplicamos aquí
también? (Pista: ¿qué pasa con un `purchase` que manda tu backend por
Measurement Protocol con otro `client_id`?)

---

## Si te sobra tiempo

1. **Un evento propio.** Añade `descarga_lista_precios` en el pie y regístralo
   como dimensión personalizada en GA4. ¿Cuánto tarda en aparecer en los informes?
2. **`refund`.** Añade un botón de devolución en `/gracias` que mande `refund`
   con el mismo `transaction_id`. Mira qué pasa con los ingresos.
3. **`item_variant`.** Añade el tamaño de la hogaza (500 g / 1 kg) y propágalo
   por todo el embudo.
4. **Rompe algo a propósito** y mira cómo se ve el fallo en DebugView: cambia
   `value` a string, quita un `item_id`, manda `purchase` dos veces.
