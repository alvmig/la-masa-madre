-- 03 · Sesiones: qué es una sesión en la exportación
-- Objetivo: reconstruir la métrica de sesiones a mano y ver por qué no cuadra
-- exactamente con la interfaz.
--
-- En la exportación NO hay una tabla de sesiones. Hay un parámetro
-- ga_session_id (un timestamp entero) que solo identifica una sesión
-- DENTRO de un user_pseudo_id. Dos usuarios pueden compartir el número.
--
-- @snippet:sql-sesiones
WITH eventos AS (
  SELECT
    user_pseudo_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
    event_name,
    event_timestamp,
    traffic_source.source AS fuente,
    device.category       AS dispositivo
  FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210107'
)
SELECT
  dispositivo,
  COUNT(DISTINCT CONCAT(user_pseudo_id, '-', CAST(session_id AS STRING))) AS sesiones,
  COUNT(DISTINCT user_pseudo_id)                                          AS usuarios,
  ROUND(COUNT(*) / COUNT(DISTINCT CONCAT(user_pseudo_id, '-', CAST(session_id AS STRING))), 1) AS eventos_por_sesion,
  ROUND(100 * COUNTIF(event_name = 'purchase')
        / COUNT(DISTINCT CONCAT(user_pseudo_id, '-', CAST(session_id AS STRING))), 2) AS tasa_conversion_pct
FROM eventos
GROUP BY dispositivo
ORDER BY sesiones DESC;
-- @end
--
-- Qué mirar:
--   · La clave de sesión es SIEMPRE user_pseudo_id + ga_session_id.
--   · El móvil suele tener más sesiones y peor conversión que el escritorio.
--
-- Por qué no cuadra al 100 % con la interfaz de GA4:
--   · la interfaz aplica modelado de datos y umbrales de privacidad;
--   · una sesión que cruza la medianoche está en dos tablas diarias;
--   · "sesiones con interacción" es otra métrica distinta (usa
--     session_engaged / engagement_time_msec).
-- Que no cuadre al decimal es normal. Que no cuadre por un 30 % no lo es.
