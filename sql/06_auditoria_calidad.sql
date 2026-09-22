-- 06 · Auditoría de calidad de la medición
-- Objetivo: usar BigQuery para lo que la interfaz no puede: comprobar si tu
-- instrumentación está bien. Esto es un test de analítica, pero sobre datos
-- ya recogidos.
--
-- La gracia de esta consulta: ejecutada sobre el dataset PÚBLICO de Google
-- encuentra fallos reales. Los mismos que vimos en el ejercicio de /buggy/.
--
-- @snippet:sql-auditoria
WITH compras AS (
  SELECT
    ecommerce.transaction_id                AS tx,
    ecommerce.purchase_revenue              AS revenue,
    user_pseudo_id,
    (SELECT COUNT(*) FROM UNNEST(items) WHERE item_id IS NULL OR item_id = '') AS items_sin_id,
    ARRAY_LENGTH(items)                     AS n_items
  FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210131'
    AND event_name = 'purchase'
)
SELECT
  COUNT(*)                                                   AS eventos_purchase,
  COUNT(DISTINCT tx)                                         AS transaction_id_distintos,
  COUNTIF(tx IS NULL OR tx = '(not set)')                    AS sin_transaction_id,
  COUNTIF(revenue IS NULL)                                   AS sin_revenue,
  COUNTIF(n_items = 0)                                       AS sin_items,
  SUM(items_sin_id)                                          AS items_sin_item_id,
  (SELECT COUNT(*) FROM (
     SELECT tx FROM compras
     WHERE tx IS NOT NULL AND tx != '(not set)'
     GROUP BY tx HAVING COUNT(*) > 1))                       AS transaction_id_repetidos
FROM compras;
-- @end
--
-- Resultado real (enero 2021, ejecutado el 2026-09-22):
--
--   eventos_purchase          1204
--   transaction_id_distintos   895   ← incluye "(not set)" como uno más
--   sin_transaction_id         300   ← 300 compras anónimas, de 265 usuarios
--   sin_revenue                300   ← las mismas
--   sin_items                    0
--   items_sin_item_id            0
--   transaction_id_repetidos     10   ← casi todos 2 veces y del mismo usuario
--
-- Traducción:
--   · El 25 % de las compras llegan SIN transaction_id. GA4 no puede
--     deduplicarlas ni cruzarlas con tu ERP, y no suman ingresos.
--   · 10 pedidos contados dos veces: la firma clásica de disparar purchase al
--     renderizar la página de gracias (nuestro fallo nº 5).
--   · Dos de esos transaction_id aparecen con user_pseudo_id distintos: o el
--     id no es único, o hubo un cruce de sesiones.
--
-- Y esto es la tienda de merchandising de Google. Que nadie se sienta mal por
-- los fallos de su propia implementación.
--
-- Adáptala a tu propiedad cambiando el dataset. Ponla en un cron semanal y
-- tendrás alerta temprana de que alguien rompió la medición en un despliegue.
