-- 04 · El embudo de ecommerce
-- Objetivo: lo que en Exploraciones es un clic, aquí es explícito, y por eso
-- se puede versionar, revisar y automatizar.
--
-- Contamos SESIONES que llegaron a cada paso (no eventos: una sesión que añade
-- tres veces al carrito es una sola sesión en el paso "add_to_cart").
--
-- @snippet:sql-funnel
WITH sesiones AS (
  SELECT
    CONCAT(user_pseudo_id, '-', CAST(
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING)) AS sesion,
    event_name
  FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210131'
),
pasos AS (
  SELECT
    COUNT(DISTINCT IF(event_name = 'view_item',        sesion, NULL)) AS ficha,
    COUNT(DISTINCT IF(event_name = 'add_to_cart',      sesion, NULL)) AS carrito,
    COUNT(DISTINCT IF(event_name = 'begin_checkout',   sesion, NULL)) AS checkout,
    COUNT(DISTINCT IF(event_name = 'add_payment_info', sesion, NULL)) AS pago,
    COUNT(DISTINCT IF(event_name = 'purchase',         sesion, NULL)) AS compra
  FROM sesiones
)
SELECT paso, sesiones,
       ROUND(100 * sesiones / FIRST_VALUE(sesiones) OVER (ORDER BY orden), 2)  AS pct_del_inicio,
       ROUND(100 * sesiones / LAG(sesiones) OVER (ORDER BY orden), 2)          AS pct_del_paso_anterior
FROM (
  SELECT 1 AS orden, 'view_item'        AS paso, ficha    AS sesiones FROM pasos
  UNION ALL SELECT 2, 'add_to_cart',      carrito  FROM pasos
  UNION ALL SELECT 3, 'begin_checkout',   checkout FROM pasos
  UNION ALL SELECT 4, 'add_payment_info', pago     FROM pasos
  UNION ALL SELECT 5, 'purchase',         compra   FROM pasos
)
ORDER BY orden;
-- @end
--
-- Ojo, esto es un embudo ABIERTO: no exige que los pasos ocurran en orden ni
-- que el usuario pasara por los anteriores. Por eso un paso puede tener más
-- sesiones que el anterior.
--
-- Para un embudo CERRADO (en orden y con ventana de tiempo) hay que comparar
-- los event_timestamp de cada paso dentro de la sesión. Buen ejercicio:
-- hazlo con MIN(IF(event_name='add_to_cart', event_timestamp, NULL)) por
-- sesión y exige que sea mayor que el de view_item.
--
-- Resultado real (enero 2021, ejecutado el 2026-09-22), 0,27 GB:
--
--   view_item          23.105   100,00 %        —
--   add_to_cart         4.537    19,64 %   19,64 % del paso anterior
--   begin_checkout      2.159     9,34 %   47,59 %
--   add_payment_info    1.560     6,75 %   72,26 %
--   purchase            1.115     4,83 %   71,47 %
--
-- Dónde está el problema: NO en el checkout (que retiene el 70 %), sino en el
-- primer salto, ficha → carrito, que pierde el 80 %. Es el error de lectura
-- más común: se optimiza el pago, que es lo que "duele", cuando el dinero
-- está en la ficha de producto.
