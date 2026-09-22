# La Masa Madre · Formación GA4

Material de una formación de Google Analytics 4 (14 h, 2 jornadas) para desarrolladores: web de ejemplo instrumentada con `gtag.js`, slides, simulador de tráfico, backfill por Measurement Protocol y consultas de BigQuery.

- Web: https://alvmig.github.io/la-masa-madre/
- Slides: https://alvmig.github.io/la-masa-madre/slides/
- Contrato de medición: [`tracking-plan.md`](tracking-plan.md)

## Estado

| Fase | Contenido | Estado |
|------|-----------|--------|
| 0 | Plan, `CLAUDE.md`, `tracking-plan.md`, despliegue en GitHub Pages | hecho |
| 1 | Web SPA instrumentada (`site/`) | hecho |
| 2 | Test e2e de eventos (`simulator/e2e_events_test.py`) | hecho |
| 3 | Simulador de tráfico (`simulator/traffic_generator.py`) | hecho |
| 4 | Backfill MP (`simulator/mp_backfill.py`) | hecho (falta ejecutar el envío real) |
| 5 | Slides (`slides/`) | esqueleto completo (50 slides) |
| 6 | Material de alumnos (`starter/`, `site/buggy/`, `sql/`) | pendiente |
| 7 | README completo y checklist | pendiente |

## Despliegue

Cada push a `main` ejecuta `.github/workflows/pages.yml`, que copia `site/` a la raíz y `slides/` a `/slides/` y publica en GitHub Pages (Settings → Pages → Source: *GitHub Actions*).
