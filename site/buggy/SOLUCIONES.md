# Los cinco fallos · soluciones

**Para el formador.** No repartir antes del ejercicio.

La versión con fallos está en `site/buggy/` y se sirve en `/buggy/`. Es una copia
de la tienda buena con cinco errores de instrumentación. Los cinco están,
ahora mismo, en webs reales de producción.

Ejercicio sugerido: 15 minutos por parejas, con DebugView y la pestaña Network.
El test los caza todos, pero **que lo ejecuten al final**, no al principio:

```bash
simulator/.venv/bin/python simulator/e2e_events_test.py --url http://localhost:8080/buggy/
```

---

## Fallo 1 · `config` antes de `consent default`

**Archivo:** `analytics.js`, `initAnalytics()`.

El `gtag('consent','default',…)` quedó **después** del `config`. La documentación
es literal: *"the order of the code here is vital"*.

**Síntoma:** carga la web con la aplicación limpia (sin cookies ni localStorage):

- el primer `page_view` sale **sin parámetro `gcs`**;
- la cookie `_ga` **se escribe igualmente**, aunque el usuario no haya aceptado.

Es el fallo más grave de los cinco: es el que trae problemas legales.

**Arreglo:** mover el bloque de `consent default` justo después de definir
`dataLayer`/`gtag`, antes de cargar la librería y antes del `config`.

## Fallo 2 · `page_view` doble

**Archivo:** `analytics.js`, `initAnalytics()` → `send_page_view: true`.

El router ya emite su `page_view` en cada ruta; con el automático activado, hay
dos en la primera carga.

**Síntoma:** en DebugView, dos `page_view` seguidos al entrar. En el test, la
secuencia empieza por `page_view → page_view`.

**Arreglo:** `send_page_view: false`.

**Y además:** aunque esté en `false`, la **medición mejorada** sigue mandando
`page_view` en cada `pushState` si no se desactiva "Cambios de página basados en
eventos del historial del navegador" en el flujo de datos. Esto no se arregla en
el código: se arregla en la interfaz de GA4. Buen momento para enseñarlo.

## Fallo 3 · `value` como string

**Archivo:** `analytics.js`, `trackAddToCart()` → `sumValue(items).toFixed(2)`.

**Síntoma:** en Network, el parámetro viaja como `ep.value=11.00` en vez de
`epn.value=11`. GA4 lo guarda como texto y **no suma ingresos**. En DebugView se
ve `"11.00"` entre comillas, que es la pista.

**Arreglo:** quitar el `.toFixed(2)`. Formatear es cosa de la interfaz, no de la
medición.

## Fallo 4 · items sin `item_id`

**Archivo:** `analytics.js`, `linesToItems()` elimina `item_id` al construir los items.

**Síntoma:** afecta a `view_cart`, `begin_checkout`, `add_shipping_info`,
`add_payment_info` y `purchase` (todos los que usan líneas del carrito), pero
**no** a `view_item` ni `add_to_cart` desde la ficha. Los informes de producto
quedan con `(not set)`.

**Arreglo:** devolver el item completo de `toGA4Item()`.

**Pista pedagógica:** este es el fallo más difícil de ver en DebugView, porque la
interfaz muestra el resto de campos y parece correcto. Se caza mirando el `pr1`
en Network, o con el test.

## Fallo 5 · `purchase` duplicado y con `transaction_id` fijo

**Archivo:** `analytics.js` (`trackPurchase` sin comprobar `wasSent`, y
`transaction_id: 'MM-TEST'`) y `app.js` (`renderThanks()` dispara `trackPurchase`).

Son dos errores que se refuerzan:

- disparar `purchase` **al renderizar** la página de gracias significa que una
  recarga o un "atrás" vuelven a contar la venta;
- con un `transaction_id` fijo, GA4 deduplica **todas** las compras de todos los
  usuarios contra la misma: en los informes aparece **una sola** transacción.

**Síntoma:** al confirmar, dos `purchase` (el del botón y el del render). Al
recargar `/gracias`, otro más. Todos con `transaction_id: MM-TEST`.

**Arreglo:** disparar `purchase` solo en el manejador del botón de confirmar,
generar un `transaction_id` único por pedido y deduplicar en `sessionStorage`.

**Pregunta para cerrar:** si GA4 ya deduplica por `transaction_id`, ¿para qué
deduplicar nosotros? Porque la deduplicación de GA4 es por usuario y ventana de
tiempo: no cubre otro dispositivo, otro navegador, ni un `purchase` que mande el
backend por Measurement Protocol con otro `client_id`.

---

## Resumen para la pizarra

| # | Fallo | Se ve en | Coste real |
|---|-------|----------|------------|
| 1 | `config` antes de `consent default` | falta `gcs`, cookie `_ga` sin permiso | legal |
| 2 | `page_view` doble | DebugView | métricas de páginas infladas |
| 3 | `value` string | `ep.value` en Network | ingresos a cero |
| 4 | items sin `item_id` | `pr1` en Network | informes de producto vacíos |
| 5 | `purchase` duplicado / id fijo | dos eventos, mismo id | ingresos inventados o perdidos |
