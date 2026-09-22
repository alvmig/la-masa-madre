-- 05 · Ingresos por producto: desanidar items
-- Objetivo: el array items, y por qué los ingresos del evento y la suma de los
-- items no son lo mismo.
--
-- Una fila de purchase lleva TODO el pedido: ecommerce.purchase_revenue a nivel
-- de evento e items[] con una entrada por producto. Si haces CROSS JOIN con
-- items y sumas purchase_revenue, cuentas el pedido tantas veces como productos
-- tenga. Es el error clásico de este dataset.
--
-- @snippet:sql-ingresos-item
SELECT
  it.item_name,
  it.item_category,
  COUNT(DISTINCT ecommerce.transaction_id)      AS pedidos,
  SUM(it.quantity)                              AS unidades,
  -- item_revenue es el campo "oficial". En este dataset SÍ está poblado
  -- (comprobado), pero el COALESCE con price × quantity es barato y te salva
  -- en propiedades donde no lo esté. Compara las dos columnas: se parecen,
  -- y donde no, la diferencia son descuentos.
  ROUND(SUM(COALESCE(it.item_revenue, it.price * it.quantity)), 2) AS ingresos,
  ROUND(SUM(it.price * it.quantity), 2)         AS ingresos_calc,
  ROUND(AVG(it.price), 2)                       AS precio_medio
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`,
     UNNEST(items) AS it
WHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210131'
  AND event_name = 'purchase'
GROUP BY it.item_name, it.item_category
HAVING unidades > 10
ORDER BY ingresos DESC
LIMIT 25;
-- @end
--
-- Comprobación de cordura: el total del pedido NO se saca así.
-- Una fila por pedido, SIN UNNEST. Tres formas de pedir lo mismo, porque en
-- este dataset no todas están rellenas (compáralas: es el ejercicio):
--
--   SELECT
--     COUNT(DISTINCT ecommerce.transaction_id)       AS pedidos,
--     ROUND(SUM(ecommerce.purchase_revenue), 2)      AS por_campo_ecommerce,
--     ROUND(SUM((SELECT COALESCE(value.double_value, value.float_value, value.int_value)
--                FROM UNNEST(event_params) WHERE key = 'value')), 2) AS por_parametro_value
--   FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
--   WHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210131'
--     AND event_name = 'purchase'
--
-- Resultado real (enero 2021, ejecutado el 2026-09-22):
--
--   pedidos                895
--   por_campo_ecommerce     57.350,00
--   por_parametro_value     57.360,51   ← 10,51 € de diferencia
--   eventos_purchase      1.204
--   sin_revenue             300         ← una de cada cuatro compras
--
-- Tres cifras para el mismo mes y ninguna es "la mala". Lección para
-- llevarse: en BigQuery comprueba SIEMPRE que el campo tiene datos antes de
-- construir un informe encima. `SELECT COUNTIF(campo IS NULL) FROM …` es tu
-- amigo, y la consulta 06 lo automatiza.
--
-- La diferencia entre la suma de items y el total del pedido se explica por
-- descuentos, envío e impuestos.
--
-- Ejercicio: ¿qué categoría tiene mejor ratio unidades/pedido? ¿Y cuál se
-- compra siempre sola?
