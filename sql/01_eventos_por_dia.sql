-- 01 · Eventos por día y tipo
-- Objetivo: ver la forma de la tabla y entender el comodín de fecha.
--
-- Las tablas de exportación son diarias: events_20210101, events_20210102…
-- El comodín `events_*` las une y `_TABLE_SUFFIX` es la parte variable del
-- nombre. Filtrar por _TABLE_SUFFIX es lo que evita escanear tres meses de
-- datos: es partición por nombre de tabla, no un WHERE cualquiera.
--
-- @snippet:sql-eventos-por-dia
SELECT
  PARSE_DATE('%Y%m%d', event_date) AS dia,
  event_name,
  COUNT(*)                                   AS eventos,
  COUNT(DISTINCT user_pseudo_id)             AS usuarios
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20210101' AND '20210107'
GROUP BY dia, event_name
ORDER BY dia, eventos DESC;
-- @end
--
-- Qué mirar:
--   · page_view y session_start son los más numerosos; purchase, testimonial.
--   · user_pseudo_id es el identificador de dispositivo (la cookie _ga), no
--     una persona: el mismo humano en móvil y portátil son dos.
--
-- Prueba a quitar el WHERE y mira cómo sube el coste estimado antes de ejecutar.
--
-- Resultado real (1–7 enero 2021, ejecutado el 2026-09-22): 30 filas,
-- 0,01 GB escaneados. El 31/01/2021 la tabla diaria tiene 26.489 eventos.
-- Los más frecuentes: page_view, user_engagement, session_start, scroll.
