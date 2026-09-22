# La Masa Madre · Formación GA4 para developers

Material completo de una formación de Google Analytics 4 de **14 horas en dos
jornadas**, dirigida a gente que programa: una tienda de verdad instrumentada
con `gtag.js` nativo (sin Tag Manager), slides, tests de analítica, simulador de
tráfico, backfill por Measurement Protocol y consultas de BigQuery.

| | |
|---|---|
| **Web** | https://alvmig.github.io/la-masa-madre/ |
| **Slides** | https://alvmig.github.io/la-masa-madre/slides/ |
| **Ejercicio (starter)** | https://alvmig.github.io/la-masa-madre/starter/ |
| **Versión con fallos** | https://alvmig.github.io/la-masa-madre/buggy/ |
| **Contrato de medición** | [`tracking-plan.md`](tracking-plan.md) |

Añade `?debug=1` a cualquiera de ellas para que los eventos aparezcan en DebugView.

## Qué hay aquí

```
tracking-plan.md   el contrato: eventos, parámetros, invariantes y secuencias
site/              la tienda instrumentada (la solución)
  buggy/           la misma con 5 fallos plantados + SOLUCIONES.md (formador)
starter/           la misma con analytics.js vacío + EJERCICIOS.md (alumnos)
slides/            reveal.js vendorizado, 50 slides
scripts/           dev-server.mjs · extract-snippets.mjs
simulator/         tests e2e, generador de tráfico y backfill
sql/               6 consultas comentadas + resultados reales en sql/resultados/
```

Sin build step. La web son módulos ES servidos tal cual; las slides, reveal.js
vendorizado. Lo único que se genera es `slides/snippets.js`, y se genera desde
el código real.

## Arrancar en local

```bash
node scripts/dev-server.mjs
```

Sirve en http://localhost:8080 el **mismo árbol que producción**: web en `/`,
slides en `/slides/`, starter en `/starter/`, y `404.html` con estado 404 para
que el fallback SPA se pruebe igual que en GitHub Pages.

Para el simulador y los tests:

```bash
cd simulator
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && playwright install chromium
cp .env.example .env     # y rellena MP_API_SECRET
```

## Comandos

```bash
node scripts/dev-server.mjs                 # web + slides en local
node scripts/extract-snippets.mjs           # regenera los fragmentos de las slides

# QA de la instrumentación (rebote, abandono, compra)
simulator/.venv/bin/python simulator/e2e_events_test.py --url http://localhost:8080/
simulator/.venv/bin/python simulator/e2e_events_test.py --url https://alvmig.github.io/la-masa-madre/ -v

# Tráfico realista con navegadores de verdad
simulator/.venv/bin/python simulator/traffic_generator.py \
  --url https://alvmig.github.io/la-masa-madre/ --sessions 200 --concurrency 3 --spread-hours 6

# Histórico por Measurement Protocol (máx. 72 h hacia atrás)
simulator/.venv/bin/python simulator/mp_backfill.py --dry-run
simulator/.venv/bin/python simulator/mp_backfill.py --sessions 300 --hours 71
```

Para dejar el simulador corriendo varias horas en un Mac sin que se duerma:

```bash
caffeinate -i simulator/.venv/bin/python simulator/traffic_generator.py \
  --url https://alvmig.github.io/la-masa-madre/ --sessions 500 --spread-hours 8
```

## Despliegue

Cada push a `main` dispara `.github/workflows/pages.yml`, que ensambla `site/`
en la raíz, `slides/` en `/slides/` y `starter/` en `/starter/`, y publica en
GitHub Pages. Tarda un minuto. No hay build: solo se copia el árbol.

Configuración única ya hecha: *Settings → Pages → Source: **GitHub Actions***.

Dos detalles del hosting estático que están resueltos en el código y conviene
conocer, porque salen en clase:

- **No hay reescrituras.** `/panes/MM-HOG-01` no existe como fichero, así que
  GitHub sirve `404.html` (con estado HTTP 404), que guarda la ruta y vuelve a
  la raíz; el router la restaura con `replaceState` **antes** del primer
  `page_view`. El 404 inicial se ve en la pestaña Network al recargar una ruta
  profunda: es esperado.
- **Base path.** La web vive en `/la-masa-madre/`. El router calcula la base
  desde `import.meta.url`, así que funciona igual en local, en la project page
  y con un dominio propio, sin tocar configuración.

## Nota sobre git

Este repositorio es de la cuenta `alvmig`, pero la clave SSH por defecto de
esta máquina autentica como otra cuenta. Está fijada por repositorio:

```bash
git config core.sshCommand "ssh -i ~/.ssh/id_ed25519_alvmig -o IdentitiesOnly=yes"
```

Si un `git push` falla con "Permission denied", es esto.

## Configuración de GA4

Propiedad de la formación: `G-TCCFCHKDG9` (en `site/config.js`; es público).

El **API secret** del Measurement Protocol va solo en `simulator/.env`, que está
en `.gitignore`. Nunca al frontend.

Ajuste obligatorio en la propiedad: *Administrar → Flujos de datos → el flujo web
→ Medición mejorada → ⚙ → Vistas de página → Configuración avanzada* y
**desmarcar "Cambios de página basados en eventos del historial del navegador"**.
Si no, habrá dos `page_view` por navegación: el del router y el de la medición
mejorada, que `send_page_view: false` **no** desactiva.

## Checklist del día anterior

**Infraestructura**

- [ ] `git push` y comprobar que el workflow termina en verde.
- [ ] Abrir las cuatro URLs de arriba y ver que cargan.
- [ ] Recargar `https://alvmig.github.io/la-masa-madre/panes/MM-HOG-01`: la URL
      debe mantenerse tras el rebote por `404.html`.
- [ ] `e2e_events_test.py` contra **producción**, en verde.
- [x] Consultas de `sql/` ejecutadas contra BigQuery el 2026-09-22 (proyecto
      `la-masa-madre-ga4`, 0,8 GB); resultados en `sql/resultados/` y anotados
      en cada `.sql`. Reejecutar con `./scripts/run-sql.sh`.

**Datos**

- [ ] Lanzar `traffic_generator.py` con `--spread-hours 8` la tarde anterior,
      para que haya tráfico reciente y con fuentes reales.
- [ ] `mp_backfill.py --sessions 300` **el mismo día** de la formación: el
      límite son 72 horas y lo enviado antes se queda fuera de ventana.
- [ ] Comprobar en Tiempo real que entran eventos.
- [ ] Mirar el informe de adquisición: el tráfico del simulador debe traer
      google/cpc, instagram/social y newsletter/email.

**Cuentas y accesos**

- [ ] Acceso a la propiedad y a DebugView.
- [ ] [Cuenta demo de GA4](https://support.google.com/analytics/answer/6367342)
      añadida (Google Merchandise Store).
- [ ] Proyecto de BigQuery creado y consulta de prueba ejecutada.
- [ ] Extensión *Google Analytics Debugger* instalada en Chrome (plan B si
      `?debug=1` da problemas).

**Sala**

- [ ] Slides a pantalla completa con el teléfono visible (tecla `S` abre las
      notas del orador, `R` recarga la web del teléfono).
- [ ] Repositorio clonado y `npm`/`python` funcionando en una máquina de prueba,
      por si algún alumno llega sin entorno.
- [ ] `SOLUCIONES.md` **cerrado**.

## Notas de la documentación que condicionan el diseño

Verificadas el 2026-09-22 contra la documentación oficial:

- **Consent Mode**: el orden es `dataLayer` → `consent default` → `gtag/js` →
  `config`. La doc lo dice literalmente: *"the order of the code here is vital"*.
- **`send_page_view: false`** no evita el `page_view` de la medición mejorada por
  history change: eso se desactiva en la interfaz.
- **Measurement Protocol**: retroactividad máxima de **72 h**; más atrás, GA4
  acepta el evento pero le cambia la fecha en silencio. Máximo 25 eventos por
  petición, 25 parámetros por evento, cuerpo < 130 kB. Sin `session_id` y
  `engagement_time_msec` los eventos no cuentan bien como sesiones.
- **Validación MP**: `/debug/mp/collect` **no** comprueba `api_secret` ni
  `measurement_id`. Un secret mal copiado devuelve 204 y pierde los datos.
- **`value`** = Σ `price × quantity`; `tax` y `shipping` van aparte en
  `purchase`. `currency` es obligatorio siempre que haya `value`. `index`
  empieza en 0.

## Licencia y créditos

Material de formación. reveal.js 6.0.2, MIT.
