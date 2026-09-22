-- 02 · Las páginas más vistas: primer contacto con UNNEST
-- Objetivo: entender por qué un parámetro de evento no es una columna.
--
-- event_params es ARRAY<STRUCT<key STRING, value STRUCT<string_value STRING,
-- int_value INT64, float_value FLOAT64, double_value FLOAT64>>>.
-- Cada evento lleva sus parámetros dentro de la propia fila.
--
-- Hay dos formas de leer uno. Esta es la legible:
--
-- @snippet:sql-unnest
SELECT
  (SELECT value.string_value
   FROM UNNEST(event_params)
   WHERE key = 'page_location')            AS page_location,
  COUNT(*)                                 AS vistas
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210107'
  AND event_name = 'page_view'
GROUP BY page_location
ORDER BY vistas DESC
LIMIT 20;
-- @end
--
-- El subselect sobre UNNEST devuelve un valor escalar por fila. Es el patrón
-- que más vas a repetir en tu vida con GA4 + BigQuery.
--
-- La otra forma es un CROSS JOIN, que multiplica filas y luego agrupa:
--
--   SELECT p.key, COUNT(*)
--   FROM `…events_*`, UNNEST(event_params) AS p
--   WHERE _TABLE_SUFFIX = '20210101'
--   GROUP BY p.key ORDER BY 2 DESC
--
-- Esa versión sirve para algo muy útil: **listar qué parámetros existen**.
-- Ejecútala: es la forma más rápida de documentar la instrumentación de una
-- propiedad que no conoces.
--
-- Truco: si el parámetro es numérico, el string_value viene NULL. Usa
-- COALESCE(value.string_value, CAST(value.int_value AS STRING), …) cuando no
-- sepas el tipo.
