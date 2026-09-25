# Formación GA4 · "La Masa Madre" (14 h, 2 jornadas, para developers)

Repo de material para una formación de Google Analytics 4. Prioridad: **que todo funcione** antes que perfecto (hay 3 días hasta la formación). Trabajar por fases, commit al final de cada una y **parar en cada CHECKPOINT** para que el formador valide.

## Decisiones cerradas (no reabrir)

- `gtag.js` nativo. **Sin GTM.**
- Web de ejemplo: obrador "La Masa Madre". SPA en HTML/CSS/JS vanilla, módulos ES, **sin build step**.
- Slides con **reveal.js** (vendorizado en `slides/vendor/`), no un motor propio.
- Simulador de tráfico: **Python + Playwright**. Backfill con **Measurement Protocol**.
- Datos ricos del día 2 → cuenta demo de GA4 + `bigquery-public-data.ga4_obfuscated_sample_ecommerce`. La propiedad propia es para demo en vivo, DebugView y Tiempo real.
- Repo: https://github.com/alvmig/la-masa-madre (público). Web: **https://alvmig.github.io/la-masa-madre/** · Slides: **https://alvmig.github.io/la-masa-madre/slides/**
- **GitHub Pages**: web en `/`, slides en `/slides/`, **mismo dominio** (el iframe de las slides no es third-party → cookies OK). Publicación con GitHub Actions (`.github/workflows/pages.yml`) que ensambla `site/` + `slides/` en el artefacto; no es un build de la web.
- GitHub Pages no tiene reescrituras: el fallback SPA es `site/404.html` (redirige a la raíz guardando la ruta en `sessionStorage`; el router la restaura con `replaceState` antes del primer `page_view`).
- La web puede vivir bajo un **base path** (`/<repo>/` en project pages). El router calcula la base desde `import.meta.url`; nada de rutas absolutas `/panes` en HTML ni en JS. Los scripts Python construyen URLs con `urljoin` sobre `--url`.
- Secretos: `G-XXXXXXXXXX` en `site/config.js`; `MEASUREMENT_ID` + `MP_API_SECRET` en `simulator/.env` (gitignored, con `.env.example`). El API secret **nunca** va al frontend.

## Regla de oro

No inventar nombres de eventos ni parámetros. La fuente de verdad es la doc oficial (ver enlaces en `tracking-plan.md`). Si la doc contradice al plan, manda la doc y se avisa de la discrepancia.

## Estructura

```
CLAUDE.md            este archivo
tracking-plan.md     contrato de medición (eventos, parámetros, invariantes, secuencias esperadas)
site/                SPA instrumentada = solución
  index.html 404.html styles.css app.js router.js analytics.js catalog.js config.js .nojekyll
  buggy/             copia con 5 fallos plantados (cierre día 2) + SOLUCIONES.md
starter/             misma SPA con los cuerpos de analytics.js como // TODO + EJERCICIOS.md
slides/              reveal.js (index.html, theme.css, snippets.js generado, vendor/)
scripts/             dev-server.mjs (sirve site/ en / y slides/ en /slides/ con fallback SPA)
                     extract-snippets.mjs (site/*.js → slides/snippets.js, con números de línea)
                     build-buggy.py (site/ → site/buggy/ con los 5 fallos) · run-sql.sh (sql/ → BigQuery)
simulator/           traffic_generator.py  mp_backfill.py  e2e_events_test.py  requirements.txt  .env.example
sql/                 consultas comentadas contra el dataset público
.github/workflows/pages.yml   ensambla site/ + slides/ y publica en GitHub Pages
README.md            arranque local, despliegue, checklist del día anterior
```

## Convenciones de código

- La UI **nunca** llama a `gtag` directamente: solo `analytics.js` exporta `trackXxx()`.
- Todos los `items` salen de **una única** función `toGA4Item(product, {quantity, index, list})`.
- Comentarios breves y técnicos, en castellano, pensados para proyectarse en slides.
- Snippets para slides delimitados con `// @snippet:<nombre>` … `// @end` en `site/*.js`; se extraen con `node scripts/extract-snippets.mjs` (no copiar a mano).
- Las slides citan líneas con `<code data-line="fichero#funcion">` o `data-line="fichero::texto[@@funcion]"`; el extractor las resuelve contra el código real y falla si alguna no existe. Nunca escribir números de línea a mano.
- `site/buggy/` se genera con `python3 scripts/build-buggy.py`; no editarla a mano. Tras cambiar `site/`, regenerarla.
- Cada ejercicio de las slides lleva debajo una slide `class="solucion" id="sol-N"`; el índice está en `#/soluciones`.
- `data-testid` estables en tarjetas, botones y banner (lista en `tracking-plan.md`), compartidos por el test e2e y el simulador.
- Dinero: cálculos en céntimos (enteros) y conversión a euros al emitir; nunca `value` como string.

## Comandos

```bash
node scripts/dev-server.mjs                     # http://localhost:8080 → web; /slides/ → slides (mismo árbol que producción)
node scripts/extract-snippets.mjs               # regenera slides/snippets.js
cd simulator && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && playwright install chromium
python simulator/e2e_events_test.py --url http://localhost:8080
python simulator/traffic_generator.py --url https://<dominio> --sessions 200 --concurrency 4 --spread-hours 6
python simulator/mp_backfill.py --dry-run      # valida contra /debug/mp/collect, no envía
```

## Notas de la doc que condicionan el diseño (verificadas 2026-09-22)

- Consent Mode: el orden es vital → `dataLayer`/`gtag` stub → `consent default` → carga de `gtag/js` → `config`. Si `config` va antes que `consent default`, los defaults no aplican.
- `send_page_view: false` no evita el `page_view` de **Enhanced Measurement por history change**. Hay que desactivar "Cambios de página basados en eventos del historial del navegador" en el flujo web de GA4 o habrá `page_view` doble.
- Measurement Protocol: `timestamp_micros` solo puede retroceder **72 h**; más atrás, en modo `RELAXED` el evento se acepta pero se **re-sella a 72 h** en silencio. El backfill trabaja en la ventana [ahora−71 h, ahora−1 h]. Máx. 25 eventos por request, 25 params por evento, body < 130 kB. Sin `session_id` + `engagement_time_msec` no cuentan bien como sesiones.
- Validación MP: `https://www.google-analytics.com/debug/mp/collect` (mismo query string). No valida `api_secret` ni `measurement_id`.
- `value` = Σ `price × quantity`; `tax` y `shipping` van aparte en `purchase`. `currency` es obligatorio cuando hay `value`. `index` empieza en 0. `item_list_id/_name` van a nivel de evento en `view_item_list`/`select_item` y, propagados, a nivel de item en el resto.

## Estado por fases

Fases 0–7 completas. Ver `README.md` (estructura, comandos y checklist del día anterior).

Pendiente de ejecutar por el formador, no de programar:
- Relanzar `mp_backfill.py` **el mismo día** de la formación (ventana de 72 h).
- Lanzar `traffic_generator.py --spread-hours 8` la tarde anterior.
- Desactivar en GA4 "Cambios de página basados en eventos del historial del navegador".

## Contenido obligatorio en slides (petición del formador)

Todo el proceso de puesta en marcha se explica en la formación, como bloque "Alta y configuración" del día 1:
crear propiedad (zona horaria/moneda) → flujo web → Measurement ID → snippet oficial vs. nuestro `initAnalytics()` →
desactivar "page changes based on browser history" de Enhanced Measurement → API secret de MP → DebugView con `?debug=1` →
hosting estático sin reescrituras (GitHub Pages: `404.html` + base path) y por qué web y slides en el mismo dominio.
