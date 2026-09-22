# Consultas · BigQuery + GA4

Cinco consultas comentadas, de menos a más, contra el **dataset público** de
Google, que es una exportación real de GA4 de la Google Merchandise Store:

```
bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*
```

Cubre del **2020-11-01 al 2021-01-31**. No hace falta permiso ni tarjeta: el
*sandbox* de BigQuery da 1 TB de consulta gratis al mes. Abre
https://console.cloud.google.com/bigquery, crea (o elige) un proyecto y pega.

## Lo que hay que entender antes de escribir SQL

1. **Una fila = un evento.** No una sesión, no un usuario, no un pedido.
2. **Los parámetros no son columnas.** Viven en `event_params`, un `ARRAY<STRUCT>`
   con `key` y un `value` que tiene cuatro cajones: `string_value`, `int_value`,
   `float_value`, `double_value`. Para leer uno hay que `UNNEST`.
3. **Los items tampoco.** `items` es otro array; una fila de `purchase` con tres
   productos lleva tres elementos dentro.
4. **No hay `session_id` como tal**: la sesión es el parámetro `ga_session_id`
   y solo es única **junto al usuario** (`user_pseudo_id`).
5. **Las tablas son diarias**: `events_20210131`. Se consultan con comodín y se
   filtran con `_TABLE_SUFFIX`, que es lo que evita escanear (y pagar) de más.

## Coste

Cada consulta dice cuánto escanea. Antes de ejecutar, BigQuery lo estima arriba
a la derecha. Con el rango de fechas puesto, ninguna de estas pasa de unos pocos GB.

## Orden sugerido en clase

1. `01_eventos_por_dia.sql` — el esquema y el comodín.
2. `02_unnest_page_location.sql` — por qué `UNNEST` y cómo duele.
3. `03_sesiones.sql` — qué es una sesión aquí.
4. `04_funnel_ecommerce.sql` — el embudo que en la interfaz es un clic.
5. `05_ingresos_por_item.sql` — desanidar items y cuadrar ingresos.

## Antes de la formación

Estas consultas **no se han ejecutado** contra BigQuery (no había CLI en la
máquina donde se escribieron). Están escritas contra el esquema oficial de la
exportación, pero **ejecútalas una vez** el día anterior: el dataset público
tiene campos sin poblar y es mejor descubrirlo en casa que en clase.

Apunta el resultado de cada una (número de filas, si alguna columna sale NULL)
y ajusta el comentario si hace falta. La consulta 05 ya trae plan B para
`item_revenue`.
