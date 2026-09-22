# Consultas · BigQuery + GA4

Seis consultas comentadas, de menos a más, contra el **dataset público** de
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
6. `06_auditoria_calidad.sql` — usar SQL para auditar tu propia medición.

## Ejecutarlas

```bash
./scripts/run-sql.sh        # todas · ./scripts/run-sql.sh 04 para una sola
```

Hace primero un `--dry_run` de cada consulta (dice cuántos GB escanearía sin
gastar cuota) y guarda el resultado en `sql/resultados/*.json`.

Requiere el CLI de Google Cloud:

```bash
brew install --cask google-cloud-sdk
gcloud auth login
gcloud projects create la-masa-madre-ga4 --name="La Masa Madre GA4"
gcloud config set project la-masa-madre-ga4
```

El script fija el proyecto explícitamente (`la-masa-madre-ga4`) para no depender
de `gcloud config`, que puede diferir entre terminales. Con otro proyecto:

```bash
BQ_PROJECT=mi-proyecto ./scripts/run-sql.sh
```

No hace falta habilitar facturación: el **sandbox** de BigQuery da 1 TB de
consulta al mes, y estas seis gastan 0,8 GB.

## Resultados

**Ejecutadas el 2026-09-22.** Las seis funcionan; el resultado real está
anotado al final de cada archivo, para poder comentarlo en clase sin depender
de la red. Coste total: unos 0,8 GB, menos del 0,1 % del terabyte mensual
gratuito del sandbox.

Tres hallazgos que valen para la clase:

- El móvil **no** convierte peor que el escritorio en esta tienda (0,55 % vs
  0,54 %), al contrario del tópico que repite todo el mundo.
- El embudo pierde el **80 % entre la ficha y el carrito**, no en el checkout,
  que es donde casi todos miran primero.
- La consulta 06 encuentra, en los datos reales de Google, **300 compras sin
  `transaction_id`** (una de cada cuatro) y **10 pedidos duplicados**.
