#!/usr/bin/env python3
"""
mp_backfill.py · rellena la propiedad de GA4 con sesiones sintéticas enviadas
por Measurement Protocol, coherentes con tracking-plan.md.

Por qué existe: el simulador de navegador necesita tiempo real; esto mete en
minutos varios días de histórico para que los informes del día 2 no estén vacíos.

Límites de la doc (https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference):
  - "Events can be backdated up to 72 hours." Más atrás, GA4 acepta el evento
    pero le pone la marca de 72 h (RELAXED), sin avisar. Por eso la ventana de
    trabajo es [ahora−71 h, ahora−1 h].
  - Máx. 25 eventos por petición, 25 parámetros por evento, body < 130 kB.
  - Sin `session_id` + `engagement_time_msec` los eventos no cuentan bien como
    sesiones ni como interacción.

Flujo recomendado:
  1) python mp_backfill.py --dry-run                 # no envía nada, enseña el JSON
  2) python mp_backfill.py --validate-only           # valida en /debug/mp/collect
  3) python mp_backfill.py --sessions 300 --hours 71 # envío real

Credenciales en simulator/.env (MEASUREMENT_ID, MP_API_SECRET), nunca en el repo.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from collections import Counter
from pathlib import Path

import requests
from dotenv import load_dotenv

import personas

ENDPOINT = "https://www.google-analytics.com/mp/collect"
DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect"
MAX_EVENTS_PER_REQUEST = 25
MAX_BODY_BYTES = 130_000
MAX_BACKDATE_HOURS = 72          # límite duro de la doc
CURRENCY = "EUR"
BRAND = "La Masa Madre"

# Mismo catálogo que site/catalog.js (tracking-plan.md §1).
PRODUCTS = [
    {"item_id": "MM-HOG-01", "item_name": "Hogaza de masa madre",   "item_category": "Panes",    "item_category2": "Masa madre", "price": 5.50},
    {"item_id": "MM-CEN-01", "item_name": "Pan de centeno",         "item_category": "Panes",    "item_category2": "Masa madre", "price": 4.80},
    {"item_id": "MM-ESP-01", "item_name": "Espelta integral",       "item_category": "Panes",    "item_category2": "Integrales", "price": 5.20},
    {"item_id": "MM-BAG-01", "item_name": "Baguette tradición",     "item_category": "Panes",    "item_category2": "Clásicos",   "price": 1.90},
    {"item_id": "MM-NUE-01", "item_name": "Pan de nueces y pasas",  "item_category": "Panes",    "item_category2": "Especiales", "price": 6.20},
    {"item_id": "MM-BRI-01", "item_name": "Brioche de mantequilla", "item_category": "Bollería", "item_category2": "Especiales", "price": 7.50},
]
FEATURED = ["MM-HOG-01", "MM-NUE-01", "MM-BRI-01"]
LISTS = {"catalogo": "Catálogo", "destacados_home": "Destacados home"}
SHIPPING_TIERS = ["Recogida en obrador", "Envío a domicilio"]
PAYMENT_TYPES = ["Tarjeta", "Bizum"]

# Reparto por hora del día: un obrador vende por la mañana.
HOURLY_WEIGHTS = {h: w for h, w in zip(range(24), [
    1, 1, 1, 1, 1, 2, 5, 12, 20, 24, 22, 18,      # 00–11
    14, 10, 7, 6, 6, 7, 8, 7, 5, 4, 3, 2,         # 12–23
])}

DEVICES = [
    ({"category": "mobile", "operating_system": "iOS", "operating_system_version": "17.4",
      "model": "iPhone", "brand": "Apple", "browser": "Safari", "language": "es-es",
      "screen_resolution": "390x844"}, 45),
    ({"category": "mobile", "operating_system": "Android", "operating_system_version": "14",
      "model": "Pixel 8", "brand": "Google", "browser": "Chrome", "language": "es-es",
      "screen_resolution": "412x915"}, 25),
    ({"category": "desktop", "operating_system": "macOS", "operating_system_version": "14.4",
      "browser": "Chrome", "language": "es-es", "screen_resolution": "1440x900"}, 18),
    ({"category": "desktop", "operating_system": "Windows", "operating_system_version": "11",
      "browser": "Chrome", "language": "es-es", "screen_resolution": "1920x1080"}, 12),
]
LOCATIONS = [
    ({"city": "Madrid", "region_id": "ES-MD", "country_id": "ES", "subcontinent_id": "039", "continent_id": "150"}, 35),
    ({"city": "Barcelona", "region_id": "ES-CT", "country_id": "ES", "subcontinent_id": "039", "continent_id": "150"}, 25),
    ({"city": "Valencia", "region_id": "ES-VC", "country_id": "ES", "subcontinent_id": "039", "continent_id": "150"}, 15),
    ({"city": "Sevilla", "region_id": "ES-AN", "country_id": "ES", "subcontinent_id": "039", "continent_id": "150"}, 15),
    ({"city": "Bilbao", "region_id": "ES-PV", "country_id": "ES", "subcontinent_id": "039", "continent_id": "150"}, 10),
]


def product(item_id):
    return next(p for p in PRODUCTS if p["item_id"] == item_id)


def to_ga4_item(p, quantity=1, index=None, list_id=None):
    """Equivalente Python de toGA4Item() en site/analytics.js."""
    item = {
        "item_id": p["item_id"], "item_name": p["item_name"], "item_brand": BRAND,
        "item_category": p["item_category"], "item_category2": p["item_category2"],
        "price": p["price"], "quantity": quantity,
    }
    if list_id:
        item["item_list_id"] = list_id
        item["item_list_name"] = LISTS[list_id]
    if index is not None:
        item["index"] = index
    return item


def value_of(items):
    cents = sum(round(i["price"] * 100) * i["quantity"] for i in items)
    return round(cents / 100, 2)


def page(path, title):
    return {"page_location": f"{{BASE}}{path}", "page_title": title}


def build_session(rng: random.Random, base_url: str, when_ms: int, client_id: str, persona: str):
    """
    Devuelve (eventos, ingresos). Cada evento: (nombre, params, offset_ms).
    Misma secuencia que la web (tracking-plan.md §9), para que los informes
    cuadren vengan de donde vengan los datos.
    """
    session_id = str(int(when_ms / 1000))        # entero; un valor nuevo = sesión nueva
    utm, referrer = personas.pick_source(rng)
    events, offset = [], 0

    def add(name, params, gap_s=None):
        nonlocal offset
        offset += int((gap_s if gap_s is not None else personas.human_pause(rng, 4.0)) * 1000)
        params = dict(params)
        params["session_id"] = session_id
        # engagement_time_msec: tiempo de interacción desde el evento anterior.
        params["engagement_time_msec"] = max(1, min(offset, 60_000))
        events.append((name, params, offset))

    home = page("", "La Masa Madre · Obrador")
    first = dict(home)
    if referrer:
        first["page_referrer"] = referrer
    first.update(utm)                             # GA4 lee los UTM del page_location real;
    add("page_view", first, gap_s=0)              # aquí van como parámetros del evento.
    featured = [to_ga4_item(product(i), index=n, list_id="destacados_home") for n, i in enumerate(FEATURED)]
    add("view_item_list", {**home, "item_list_id": "destacados_home",
                           "item_list_name": LISTS["destacados_home"], "items": featured}, gap_s=0.5)

    if persona == "bounce":
        return events, 0.0

    catalog_page = page("panes", "Panes · La Masa Madre")
    add("page_view", catalog_page)
    all_items = [to_ga4_item(p, index=n, list_id="catalogo") for n, p in enumerate(PRODUCTS)]
    add("view_item_list", {**catalog_page, "item_list_id": "catalogo",
                           "item_list_name": LISTS["catalogo"], "items": all_items}, gap_s=0.5)

    idx = rng.randrange(len(PRODUCTS))
    chosen = PRODUCTS[idx]
    sel = to_ga4_item(chosen, index=idx, list_id="catalogo")
    add("select_item", {**catalog_page, "item_list_id": "catalogo",
                        "item_list_name": LISTS["catalogo"], "items": [sel]})

    detail = page(f"panes/{chosen['item_id']}", f"{chosen['item_name']} · La Masa Madre")
    add("page_view", detail)
    add("view_item", {**detail, "currency": CURRENCY, "value": chosen["price"], "items": [sel]}, gap_s=0.5)

    qty = rng.choice([1, 1, 1, 2, 2, 3])
    added = to_ga4_item(chosen, quantity=qty, index=idx, list_id="catalogo")
    add("add_to_cart", {**detail, "currency": CURRENCY, "value": value_of([added]), "items": [added]})

    cart_items = [added]
    if rng.random() < 0.3:                        # segundo producto
        other = PRODUCTS[rng.randrange(len(PRODUCTS))]
        if other["item_id"] != chosen["item_id"]:
            second = to_ga4_item(other, quantity=1, index=None, list_id="catalogo")
            add("add_to_cart", {**detail, "currency": CURRENCY, "value": value_of([second]), "items": [second]})
            cart_items.append(second)

    cart_page = page("carrito", "Tu cesta · La Masa Madre")
    add("page_view", cart_page)
    add("view_cart", {**cart_page, "currency": CURRENCY, "value": value_of(cart_items), "items": cart_items}, gap_s=0.5)

    checkout = page("checkout", "Pedido · La Masa Madre")
    add("page_view", checkout)
    subtotal = value_of(cart_items)
    add("begin_checkout", {**checkout, "currency": CURRENCY, "value": subtotal, "items": cart_items}, gap_s=0.5)

    tier = rng.choice(SHIPPING_TIERS)
    add("add_shipping_info", {**checkout, "currency": CURRENCY, "value": subtotal,
                              "shipping_tier": tier, "items": cart_items})
    if persona == "abandon" and rng.random() < 0.5:
        return events, 0.0

    add("add_payment_info", {**checkout, "currency": CURRENCY, "value": subtotal,
                             "payment_type": rng.choice(PAYMENT_TYPES), "items": cart_items})
    if persona == "abandon":
        return events, 0.0

    tax = round(subtotal * 0.10, 2)
    shipping = 3.50 if tier == "Envío a domicilio" else 0.0
    tx_id = f"MM-{when_ms + offset}-{''.join(rng.choices('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', k=4))}"
    add("purchase", {**checkout, "transaction_id": tx_id, "currency": CURRENCY,
                     "value": subtotal, "tax": tax, "shipping": shipping, "items": cart_items})
    add("page_view", page("gracias", "Gracias · La Masa Madre"), gap_s=1.0)
    return events, subtotal


def pick_timestamp(rng: random.Random, now_ms: int, hours: float) -> int:
    """Instante dentro de la ventana permitida, con forma de día real."""
    oldest = now_ms - int(hours * 3600 * 1000)
    newest = now_ms - 3600 * 1000            # 1 h de margen
    for _ in range(40):                      # rechazo según el peso horario
        ts = rng.uniform(oldest, newest)
        hour = time.localtime(ts / 1000).tm_hour
        if rng.uniform(0, max(HOURLY_WEIGHTS.values())) <= HOURLY_WEIGHTS[hour]:
            return int(ts)
    return int(rng.uniform(oldest, newest))


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def build_payloads(rng, args, base_url):
    """Construye las peticiones completas, listas para enviar o inspeccionar."""
    now_ms = int(time.time() * 1000)
    payloads, stats, revenue = [], Counter(), 0.0
    for n in range(args.sessions):
        persona = args.persona or personas.pick_persona(rng)
        stats[persona] += 1
        when_ms = pick_timestamp(rng, now_ms, args.hours)
        # ~20 % de client_id repetidos → usuarios recurrentes.
        if rng.random() < personas.RETURNING_SHARE and payloads:
            client_id = rng.choice(payloads)["client_id"]
        else:
            client_id = f"{rng.randint(10**9, 2*10**9)}.{int(when_ms/1000)}"
        events, rev = build_session(rng, base_url, when_ms, client_id, persona)
        revenue += rev
        device = personas.weighted_choice(rng, DEVICES)
        location = personas.weighted_choice(rng, LOCATIONS)
        for group in chunks(events, MAX_EVENTS_PER_REQUEST):
            payloads.append({
                "client_id": client_id,
                "timestamp_micros": str((when_ms + group[0][2]) * 1000),
                # timestamp_micros por evento: tiene prioridad sobre el de la
                # petición, así cada paso conserva su instante y la sesión dura.
                "events": [
                    {"name": name,
                     "timestamp_micros": str((when_ms + off) * 1000),
                     "params": {**{k: (v.replace("{BASE}", base_url) if isinstance(v, str) else v)
                                   for k, v in params.items()}}}
                    for name, params, off in group
                ],
                "device": device,
                "user_location": location,
                "consent": {"ad_user_data": "DENIED", "ad_personalization": "DENIED"},
            })
    return payloads, stats, revenue


def check_limits(payload) -> list[str]:
    problems = []
    body = json.dumps(payload, ensure_ascii=False).encode()
    if len(body) >= MAX_BODY_BYTES:
        problems.append(f"body {len(body)} B ≥ {MAX_BODY_BYTES}")
    if len(payload["events"]) > MAX_EVENTS_PER_REQUEST:
        problems.append(f"{len(payload['events'])} eventos > {MAX_EVENTS_PER_REQUEST}")
    for ev in payload["events"]:
        if len(ev["params"]) > 25:
            problems.append(f"{ev['name']}: {len(ev['params'])} parámetros > 25")
        if len(ev["name"]) > 40:
            problems.append(f"nombre de evento demasiado largo: {ev['name']}")
    age_h = (time.time() * 1e6 - int(payload["timestamp_micros"])) / 3.6e9
    if age_h > MAX_BACKDATE_HOURS:
        problems.append(f"timestamp {age_h:.1f} h atrás > {MAX_BACKDATE_HOURS} h (GA4 lo re-sellaría)")
    return problems


def send(session, url, payload, timeout=15):
    for attempt in (1, 2, 3):
        try:
            r = session.post(url, json=payload, timeout=timeout)
            if r.status_code < 500:
                return r
        except requests.RequestException:
            if attempt == 3:
                raise
        time.sleep(2 ** attempt)
    return r


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sessions", type=int, default=100, help="sesiones a generar (por defecto 100)")
    ap.add_argument("--hours", type=float, default=71.0,
                    help="ventana hacia atrás en horas (máx. 72 por la doc; por defecto 71)")
    ap.add_argument("--url", default="https://alvmig.github.io/la-masa-madre/",
                    help="URL base para page_location")
    ap.add_argument("--persona", choices=[n for n, _ in personas.PERSONAS], default=None)
    ap.add_argument("--dry-run", action="store_true", help="no envía nada; enseña el JSON y las cuentas")
    ap.add_argument("--validate-only", action="store_true", help="envía a /debug/mp/collect y muestra los avisos")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--verbose", "-v", action="store_true")
    args = ap.parse_args()

    if args.hours > MAX_BACKDATE_HOURS:
        print(f"ERROR: --hours {args.hours} supera el límite de {MAX_BACKDATE_HOURS} h de la doc.\n"
              f"GA4 aceptaría los eventos pero les pondría la marca de 72 h atrás.", file=sys.stderr)
        return 2

    load_dotenv(Path(__file__).parent / ".env")
    measurement_id = os.getenv("MEASUREMENT_ID", "")
    api_secret = os.getenv("MP_API_SECRET", "")
    base_url = args.url if args.url.endswith("/") else args.url + "/"

    rng = random.Random(args.seed)
    payloads, stats, revenue = build_payloads(rng, args, base_url)
    events_total = sum(len(p["events"]) for p in payloads)

    print(f"{args.sessions} sesiones · {events_total} eventos · {len(payloads)} peticiones")
    print(f"Ventana: últimas {args.hours} h (límite de la doc: {MAX_BACKDATE_HOURS} h)")
    print("Personas:", dict(stats), f"· ingresos simulados: {revenue:.2f} EUR\n")

    problems = [(i, p) for i, pl in enumerate(payloads) for p in check_limits(pl)]
    if problems:
        print("Problemas de límites:")
        for i, p in problems[:10]:
            print(f"  petición {i}: {p}")
        print()

    if args.dry_run:
        print("--dry-run: no se envía nada. Ejemplo de petición:\n")
        print(json.dumps(payloads[0], ensure_ascii=False, indent=2)[:3000])
        purchase = next((pl for pl in payloads for e in pl["events"] if e["name"] == "purchase"), None)
        if purchase:
            print("\nEjemplo con purchase:\n")
            print(json.dumps(purchase, ensure_ascii=False, indent=2)[:2500])
        return 0

    if not measurement_id or not api_secret:
        print("ERROR: faltan MEASUREMENT_ID o MP_API_SECRET en simulator/.env\n"
              "       (copia .env.example y rellena los valores)", file=sys.stderr)
        return 2

    query = f"?measurement_id={measurement_id}&api_secret={api_secret}"
    session = requests.Session()

    # Validación: la doc avisa de que NO comprueba api_secret ni measurement_id.
    print("Validando en /debug/mp/collect…")
    invalid = 0
    sample = payloads if args.validate_only else payloads[:5]
    for i, payload in enumerate(sample):
        r = send(session, DEBUG_ENDPOINT + query, payload)
        messages = r.json().get("validationMessages", [])
        if messages:
            invalid += 1
            for m in messages:
                print(f"  ✗ petición {i}: [{m.get('validationCode')}] {m.get('fieldPath')}: {m.get('description')}")
    print(f"  {len(sample) - invalid}/{len(sample)} peticiones válidas\n")
    if invalid:
        print("Hay errores de validación: no se envía nada.", file=sys.stderr)
        return 1
    if args.validate_only:
        print("--validate-only: nada enviado a producción.")
        return 0

    print(f"Enviando {len(payloads)} peticiones a {ENDPOINT}…")
    sent = failed = 0
    t0 = time.time()
    for i, payload in enumerate(payloads, start=1):
        r = send(session, ENDPOINT + query, payload)
        if r.status_code == 204:
            sent += 1
        else:
            failed += 1
            print(f"  ✗ {r.status_code} en la petición {i}: {r.text[:200]}")
        if args.verbose or i % 25 == 0:
            print(f"  {i}/{len(payloads)}")
        time.sleep(0.05)                     # cortesía con el endpoint
    print(f"\nEnviadas {sent} · fallidas {failed} · {time.time()-t0:.0f} s")
    print("El endpoint devuelve 204 siempre que el JSON sea válido: comprueba en\n"
          "Tiempo real y, pasadas unas horas, en los informes estándar.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
