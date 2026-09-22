#!/usr/bin/env python3
"""
traffic_generator.py · genera tráfico realista contra la web de La Masa Madre
con navegadores reales (Playwright), para que la propiedad de GA4 tenga datos
antes de la formación.

Qué produce:
  - Personas: 60 % rebote, 25 % abandono en checkout, 15 % compra.
  - Fuentes: UTM (google/cpc, instagram/social, newsletter/email), referrers
    orgánicos y directo.
  - Dispositivos: 70 % móvil emulado, 30 % escritorio.
  - Recurrencia: ~20 % de sesiones reutilizan storage_state (misma cookie _ga
    → usuario recurrente en GA4).
  - Consentimiento: 85 % acepta, 15 % rechaza (material para el bloque de
    Consent Mode: los que rechazan salen con gcs=G100 y sin cookie).
  - Comportamiento humano: pausas log-normales y scroll.

Los eventos se cuentan interceptando */g/collect* (ga4_hits.py), no
suponiéndolos: el resumen final dice lo que GA4 ha recibido de verdad.

Ejemplos:
  python traffic_generator.py --url https://alvmig.github.io/la-masa-madre/ --sessions 20
  python traffic_generator.py --url ... --sessions 300 --concurrency 4 --spread-hours 6
  caffeinate -i python traffic_generator.py --url ... --sessions 500 --spread-hours 8

Ctrl-C corta limpiamente e imprime el resumen de lo ya enviado.
"""
from __future__ import annotations

import argparse
import queue
import random
import sys
import threading
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode, urljoin

from playwright.sync_api import Error as PWError
from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

import personas
from ga4_hits import HitCollector

STATE_DIR = Path(__file__).parent / ".state"   # storage_state de recurrentes
CATALOG_IDS = ["MM-HOG-01", "MM-CEN-01", "MM-ESP-01", "MM-BAG-01", "MM-NUE-01", "MM-BRI-01"]
FLUSH_MS = 2500        # margen para que gtag envíe el último batch
PRINT_LOCK = threading.Lock()


@dataclass
class SessionResult:
    persona: str
    device: str
    source: str
    consent: str
    returning: bool
    events: Counter = field(default_factory=Counter)
    purchase_value: float = 0.0
    error: str | None = None


def log(msg: str):
    with PRINT_LOCK:
        print(f"{datetime.now():%H:%M:%S} {msg}", flush=True)


# ---------------------------------------------------------------------------
# Navegación de una sesión
# ---------------------------------------------------------------------------
def entry_url(base: str, utm: dict) -> str:
    return base + ("?" + urlencode(utm) if utm else "")


def scroll_a_bit(page, rng):
    """Scroll parcial: alimenta el evento `scroll` de Enhanced Measurement."""
    try:
        page.mouse.wheel(0, rng.randint(300, 1200))
        page.wait_for_timeout(int(personas.human_pause(rng, 0.8) * 1000))
    except PWError:
        pass


def pause(page, rng, median=2.0):
    page.wait_for_timeout(int(personas.human_pause(rng, median) * 1000))


def handle_consent(page, rng, result: SessionResult):
    """El banner solo aparece si el visitante no decidió antes."""
    try:
        page.wait_for_selector("[data-testid=consent-banner]", state="visible", timeout=4000)
    except PWTimeout:
        result.consent = "recordado"
        return
    pause(page, rng, 1.2)                      # el usuario lo lee (o lo ignora)
    accept = personas.accepts_consent(rng)
    page.click(f"[data-testid=consent-{'accept' if accept else 'reject'}]")
    result.consent = "acepta" if accept else "rechaza"


def browse_catalog(page, rng) -> str:
    """Va al catálogo y abre una ficha. Devuelve el item_id elegido."""
    page.click("[data-testid=nav-panes]")
    page.wait_for_selector("[data-testid=product-card-MM-HOG-01]")
    scroll_a_bit(page, rng)
    item_id = rng.choice(CATALOG_IDS)
    page.click(f"[data-testid=product-card-{item_id}]")
    page.wait_for_selector("[data-testid=add-to-cart]")
    pause(page, rng, 3.0)                      # leer la descripción
    return item_id


def fill_cart(page, rng):
    for _ in range(rng.choice([0, 0, 1, 1, 2])):   # cantidad 1..3
        page.click("[data-testid=detail-qty-plus]")
    page.click("[data-testid=add-to-cart]")
    pause(page, rng, 1.2)
    # Una parte de los usuarios vuelve a por un segundo producto.
    if rng.random() < 0.35:
        browse_catalog(page, rng)
        page.click("[data-testid=add-to-cart]")
        pause(page, rng, 1.0)
    page.click("[data-testid=nav-carrito]")
    page.wait_for_selector("[data-testid=cart-checkout]")
    pause(page, rng, 2.0)
    # Algún arrepentimiento: quita una unidad (remove_from_cart).
    if rng.random() < 0.25:
        minus = page.locator("[data-testid^=qty-minus-]").first
        if minus.count():
            minus.click()
            pause(page, rng, 1.0)


def do_checkout(page, rng, complete: bool, result: SessionResult):
    page.click("[data-testid=cart-checkout]")
    page.wait_for_selector("[data-testid=shipping-pickup]")
    pause(page, rng, 2.5)
    page.click(f"[data-testid=shipping-{rng.choice(['pickup', 'delivery'])}]")
    pause(page, rng, 1.5)
    # Abandono: la mitad se va tras elegir entrega, la otra tras elegir pago.
    if not complete and rng.random() < 0.5:
        return
    page.click(f"[data-testid=payment-{rng.choice(['card', 'bizum'])}]")
    pause(page, rng, 2.0)
    if not complete:
        return
    page.click("[data-testid=confirm-order]")
    page.wait_for_selector("[data-testid=order-id]", timeout=10000)
    pause(page, rng, 1.5)


def run_session(browser, base: str, rng: random.Random, state_file: Path | None,
                forced_persona: str | None = None) -> SessionResult:
    persona = forced_persona or personas.pick_persona(rng)
    utm, referrer = personas.pick_source(rng)
    device = personas.pick_device(rng)
    device_name = device.pop("_device_name", None)

    result = SessionResult(
        persona=persona,
        device=device_name or "escritorio",
        source=utm.get("utm_source", "referral" if referrer else "directo"),
        consent="—",
        returning=state_file is not None and state_file.exists(),
    )

    ctx_args = dict(device)
    if device_name:
        ctx_args.update(browser_device(device_name))
    if referrer:
        ctx_args["extra_http_headers"] = {"Referer": referrer}
    if result.returning:
        ctx_args["storage_state"] = str(state_file)

    ctx = browser.new_context(locale="es-ES", timezone_id="Europe/Madrid", **ctx_args)
    col = HitCollector(ctx)
    page = ctx.new_page()
    try:
        page.goto(entry_url(base, utm), wait_until="load", timeout=30000)
        page.wait_for_selector("[data-testid=product-card-MM-HOG-01]", timeout=15000)
        handle_consent(page, rng, result)
        scroll_a_bit(page, rng)
        pause(page, rng, 2.5)

        if persona != "bounce":
            browse_catalog(page, rng)
            fill_cart(page, rng)
            do_checkout(page, rng, complete=(persona == "purchase"), result=result)

        page.wait_for_timeout(FLUSH_MS)
    except (PWTimeout, PWError) as e:
        result.error = f"{type(e).__name__}: {str(e).splitlines()[0][:120]}"
    finally:
        result.events = Counter(h.name for h in col.hits)
        for h in col.hits:
            if h.name == "purchase":
                result.purchase_value += h.value() or 0
        try:
            if state_file is not None:
                STATE_DIR.mkdir(exist_ok=True)
                ctx.storage_state(path=str(state_file))
        except PWError:
            pass
        ctx.close()
    return result


_DEVICE_CACHE: dict = {}


def browser_device(name: str) -> dict:
    return _DEVICE_CACHE.get(name, {})


# ---------------------------------------------------------------------------
# Orquestación
# ---------------------------------------------------------------------------
def worker(idx: int, jobs: queue.Queue, results: list, args, stop: threading.Event):
    """Cada hilo tiene su propio Playwright: la API síncrona no es compartible."""
    rng = random.Random(args.seed + idx * 1000 if args.seed is not None else None)
    with sync_playwright() as p:
        _DEVICE_CACHE.update({n: p.devices[n] for n in personas.MOBILE_DEVICES if n in p.devices})
        browser = p.chromium.launch(headless=not args.headed)
        while not stop.is_set():
            try:
                n, start_at = jobs.get_nowait()
            except queue.Empty:
                break
            # Reparto en el tiempo: cada sesión tiene su instante de arranque.
            wait = start_at - time.time()
            if wait > 0 and stop.wait(wait):
                break
            state_file = None
            if rng.random() < personas.RETURNING_SHARE:  # visitante que ya estuvo
                state_file = STATE_DIR / f"visitante-{rng.randint(1, max(2, args.sessions // 5))}.json"
            for attempt in (1, 2):                      # un reintento por sesión
                r = run_session(browser, args.base, rng, state_file, args.persona)
                if not r.error:
                    break
                log(f"  sesión {n}: reintento tras {r.error}")
            results.append(r)
            flag = "!" if r.error else " "
            log(f"{flag} [{n}/{args.sessions}] {r.persona:8s} {r.device:12s} {r.source:10s} "
                f"consent={r.consent:9s} {'recurrente' if r.returning else 'nuevo':10s} "
                f"eventos={sum(r.events.values()):2d}" + (f" · {r.error}" if r.error else ""))
            jobs.task_done()
        browser.close()


def summarize(results: list, elapsed: float):
    print("\n" + "=" * 72)
    print(f"RESUMEN · {len(results)} sesiones en {elapsed/60:.1f} min")
    print("=" * 72)
    by_persona = Counter(r.persona for r in results)
    errors = [r for r in results if r.error]
    total_events = Counter()
    for r in results:
        total_events.update(r.events)

    print("\nPor persona:")
    for persona, _ in personas.PERSONAS:
        n = by_persona.get(persona, 0)
        share = 100 * n / len(results) if results else 0
        print(f"  {persona:10s} {n:4d}  ({share:4.1f} %)")

    print("\nPor dispositivo:", dict(Counter(r.device for r in results)))
    print("Por fuente:     ", dict(Counter(r.source for r in results)))
    print("Consentimiento: ", dict(Counter(r.consent for r in results)))
    print("Recurrentes:    ", sum(1 for r in results if r.returning))

    print("\nEventos capturados en /g/collect:")
    for name, n in total_events.most_common():
        print(f"  {name:20s} {n:5d}")

    revenue = sum(r.purchase_value for r in results)
    purchases = total_events.get("purchase", 0)
    print(f"\nCompras: {purchases} · ingresos enviados: {revenue:.2f} EUR"
          + (f" · ticket medio {revenue/purchases:.2f} EUR" if purchases else ""))
    if errors:
        print(f"\nSesiones con error: {len(errors)}")
        for r in errors[:5]:
            print(f"  {r.persona}: {r.error}")
    print("\nLos datos tardan unos minutos en verse en los informes; en Tiempo real, segundos.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", required=True, help="URL base de la web (p. ej. https://alvmig.github.io/la-masa-madre/)")
    ap.add_argument("--sessions", type=int, default=20, help="número de sesiones (por defecto 20)")
    ap.add_argument("--concurrency", type=int, default=2, help="navegadores en paralelo (por defecto 2)")
    ap.add_argument("--spread-hours", type=float, default=0, help="repartir las sesiones a lo largo de N horas")
    ap.add_argument("--headed", action="store_true", help="ver los navegadores")
    ap.add_argument("--seed", type=int, default=None, help="semilla para repetir una tanda")
    ap.add_argument("--persona", choices=[name for name, _ in personas.PERSONAS], default=None,
                    help="forzar un perfil en todas las sesiones (para demos dirigidas)")
    ap.add_argument("--returning-share", type=float, default=None,
                    help="proporción de usuarios recurrentes (por defecto %.2f)" % personas.RETURNING_SHARE)
    args = ap.parse_args()
    args.base = args.url if args.url.endswith("/") else args.url + "/"
    if args.returning_share is not None:
        personas.RETURNING_SHARE = args.returning_share

    rng = random.Random(args.seed)
    jobs: queue.Queue = queue.Queue()
    # Reparto en el tiempo: retardos acumulados aleatorios dentro de la ventana.
    spread_s = args.spread_hours * 3600
    offsets = sorted(rng.uniform(0, spread_s) for _ in range(args.sessions)) if spread_s else [0] * args.sessions
    t_start = time.time()
    for i, off in enumerate(offsets, start=1):
        jobs.put((i, t_start + off))

    if spread_s:
        print(f"Ritmo aproximado: {args.sessions / args.spread_hours:.0f} sesiones/hora")
    print(f"La Masa Madre · {args.sessions} sesiones · {args.concurrency} en paralelo"
          + (f" · repartidas en {args.spread_hours} h" if spread_s else "")
          + f"\nDestino: {args.base}\n")
    if spread_s:
        print("Consejo: en un Mac, lánzalo con `caffeinate -i` para que no se duerma.\n")

    results: list = []
    stop = threading.Event()
    threads = [threading.Thread(target=worker, args=(i, jobs, results, args, stop), daemon=True)
               for i in range(args.concurrency)]
    t0 = time.time()
    for t in threads:
        t.start()
    try:
        while any(t.is_alive() for t in threads):
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nParando (Ctrl-C)…")
        stop.set()
        for t in threads:
            t.join(timeout=30)
    summarize(results, time.time() - t0)
    return 1 if any(r.error for r in results) and not results else 0


if __name__ == "__main__":
    sys.exit(main())
