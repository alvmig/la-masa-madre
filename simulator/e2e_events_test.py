#!/usr/bin/env python3
"""
e2e_events_test.py · QA automatizado de la instrumentación GA4 de La Masa Madre.

Abre la web con Playwright, intercepta TODAS las peticiones a */g/collect*,
decodifica los eventos (ver ga4_hits.py) y comprueba contra tracking-plan.md:

  - la SECUENCIA de eventos en tres flujos: rebote, abandono en checkout, compra;
  - que `value` = Σ price × quantity en cada evento con items;
  - que los items llevan los campos obligatorios y la lista se propaga;
  - que `purchase` no se repite al recargar /gracias ni al volver atrás,
    y que dos compras tienen transaction_id distintos;
  - el estado de consentimiento en los hits (gcs) al aceptar y al rechazar.

Uso:
  python e2e_events_test.py                          # http://localhost:8080/
  python e2e_events_test.py --url https://alvmig.github.io/la-masa-madre/
  python e2e_events_test.py --flow purchase --headed

Sale con código 1 si falla cualquier comprobación.
"""
from __future__ import annotations

import argparse
import re
import sys
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from ga4_hits import HitCollector

PLANNED = {
    "page_view", "view_item_list", "select_item", "view_item", "add_to_cart",
    "remove_from_cart", "view_cart", "begin_checkout", "add_shipping_info",
    "add_payment_info", "purchase",
}
ITEM_REQUIRED = ("item_id", "item_name", "item_brand", "item_category", "item_category2", "price", "quantity")
TX_RE = re.compile(r"^MM-\d{13}-[A-Z0-9]{4}$")
FLUSH_MS = 3000  # gtag agrupa y retrasa envíos; margen antes de cerrar el contexto


class Check:
    """Acumula resultados; no aborta al primer fallo para dar un informe completo."""

    def __init__(self, flow):
        self.flow, self.failures, self.passed = flow, [], 0

    def ok(self, cond, msg):
        if cond:
            self.passed += 1
        else:
            self.failures.append(msg)
        return cond

    def eq(self, actual, expected, what):
        return self.ok(actual == expected, f"{what}: esperado {expected!r}, obtenido {actual!r}")


# ---------------------------------------------------------------------------
# Comprobaciones genéricas sobre hits
# ---------------------------------------------------------------------------
def check_items_and_values(c: Check, hits):
    for h in hits:
        if h.name not in PLANNED or h.name == "page_view":
            continue  # user_engagement, scroll, etc. no son del plan
        c.ok(len(h.items) >= 1, f"{h.name}: sin items")
        for it in h.items:
            missing = [k for k in ITEM_REQUIRED if k not in it]
            c.ok(not missing, f"{h.name}: item {it.get('item_id')} sin {missing}")
            c.ok(isinstance(it.get("price"), float), f"{h.name}: price no numérico ({it.get('price')!r})")
            c.ok(isinstance(it.get("quantity"), int), f"{h.name}: quantity no entero ({it.get('quantity')!r})")
        if h.name in ("view_item_list", "select_item"):
            c.ok(h.params.get("item_list_id") and h.params.get("item_list_name"),
                 f"{h.name}: falta item_list_id/item_list_name a nivel de evento")
            for it in h.items:
                c.ok("index" in it and "item_list_id" in it, f"{h.name}: item {it.get('item_id')} sin index/item_list_id")
        else:
            v = h.value()
            c.ok(isinstance(v, float), f"{h.name}: value ausente o no numérico ({v!r})")
            c.eq(h.params.get("currency"), "EUR", f"{h.name}: currency")
            if isinstance(v, float):
                c.ok(abs(v - h.items_value()) < 0.005, f"{h.name}: value {v} ≠ Σ price×qty {h.items_value()}")


def check_page_views(c: Check, hits, base):
    pvs = [h for h in hits if h.name == "page_view"]
    tipos = {"inicio", "catalogo", "producto", "cesta", "checkout", "gracias", "error"}
    for h in pvs:
        c.ok(h.params.get("tipo_pagina") in tipos, f"page_view sin tipo_pagina válido: {h.params.get('tipo_pagina')!r} en {h.page_location}")
        c.ok(h.page_location.startswith(base.rstrip("/")), f"page_view con page_location fuera del sitio: {h.page_location}")
        c.ok(h.page_title.endswith("La Masa Madre") or "La Masa Madre" in h.page_title, f"page_view sin page_title: {h.page_title!r}")
    # Cada evento de ecommerce va después del page_view de su vista.
    seen_pv = False
    for h in hits:
        if h.name == "page_view":
            seen_pv = True
        elif h.name in PLANNED:
            c.ok(seen_pv, f"{h.name} antes del primer page_view")


def path_of(url):
    return re.sub(r"\?.*$", "", url)


# ---------------------------------------------------------------------------
# Acciones de UI (data-testid del tracking plan §8)
# ---------------------------------------------------------------------------
def open_home(page, base, consent="accept"):
    page.goto(base, wait_until="load")
    page.wait_for_selector("[data-testid=product-card-MM-HOG-01]")
    page.click(f"[data-testid=consent-{consent}]")


def go_to_detail_via_catalog(page, item_id="MM-HOG-01"):
    page.click("[data-testid=nav-panes]")
    page.wait_for_selector(f"[data-testid=product-card-{item_id}]")
    page.click(f"[data-testid=product-card-{item_id}]")
    page.wait_for_selector("[data-testid=add-to-cart]")


def add_and_go_to_checkout(page, qty=2):
    for _ in range(qty - 1):
        page.click("[data-testid=detail-qty-plus]")
    page.click("[data-testid=add-to-cart]")
    page.click("[data-testid=nav-carrito]")
    page.wait_for_selector("[data-testid=cart-checkout]")
    page.click("[data-testid=cart-checkout]")
    page.wait_for_selector("[data-testid=shipping-pickup]")


# ---------------------------------------------------------------------------
# Flujos
# ---------------------------------------------------------------------------
def flow_bounce(page, col, base, c):
    open_home(page, base, consent="accept")
    col.wait_for(page, "view_item_list")
    page.wait_for_timeout(FLUSH_MS)
    c.eq(col.names(PLANNED), ["page_view", "view_item_list"], "secuencia rebote")
    vil = col.find("view_item_list")
    if vil:
        c.eq(vil[0].params.get("item_list_id"), "destacados_home", "lista de la home")
        c.eq(len(vil[0].items), 3, "items destacados")
        c.eq([it.get("index") for it in vil[0].items], [0, 1, 2], "index de destacados")
    # Los eventos de la primera vista salen ANTES de que el usuario acepte:
    # van con el default (denegado), sin cookie, gcs=G100. No se reenvían.
    for h in col.hits[:2]:
        c.eq(h.gcs, "G100", f"gcs antes de aceptar ({h.name})")
    c.ok(any(ck["name"] == "_ga" for ck in page.context.cookies()), "cookie _ga no escrita tras aceptar")


def flow_bounce_rejected(page, col, base, c):
    open_home(page, base, consent="reject")
    col.wait_for(page, "view_item_list")
    page.wait_for_timeout(FLUSH_MS)
    c.eq(col.names(PLANNED), ["page_view", "view_item_list"], "secuencia rebote (rechazo)")
    # Con analytics_storage denegado gtag sigue enviando pings, sin cookie: gcs=G100.
    for h in col.hits:
        c.eq(h.gcs, "G100", f"gcs tras rechazar ({h.name})")
    c.ok(not any(ck["name"] == "_ga" for ck in page.context.cookies()), "cookie _ga escrita con consentimiento denegado")


def flow_abandon(page, col, base, c):
    open_home(page, base)
    go_to_detail_via_catalog(page)
    add_and_go_to_checkout(page, qty=2)
    page.click("[data-testid=shipping-delivery]")
    page.click("[data-testid=payment-bizum]")
    col.wait_for(page, "add_payment_info")
    page.wait_for_timeout(FLUSH_MS)
    expected = [
        "page_view", "view_item_list", "page_view", "view_item_list", "select_item",
        "page_view", "view_item", "add_to_cart", "page_view", "view_cart",
        "page_view", "begin_checkout", "add_shipping_info", "add_payment_info",
    ]
    c.eq(col.names(PLANNED), expected, "secuencia abandono")
    c.ok(not col.find("purchase"), "purchase enviado en un abandono")
    planned = [h for h in col.hits if h.name in PLANNED]
    for h in planned[2:]:
        c.eq(h.gcs, "G111", f"gcs tras aceptar ({h.name})")
    # Propagación de lista: select_item → view_item → add_to_cart llevan la lista del catálogo.
    for name in ("select_item", "view_item", "add_to_cart"):
        for h in col.find(name):
            it = h.items[0] if h.items else {}
            c.eq(it.get("item_list_id"), "catalogo", f"{name}: item_list_id propagado")
            c.eq(it.get("index"), 0, f"{name}: index propagado")
    for h in col.find("add_to_cart"):
        c.eq(h.items[0].get("quantity"), 2, "add_to_cart: quantity añadida")
        c.eq(h.value(), 11.0, "add_to_cart: value = 5.50 × 2")
    for h in col.find("add_shipping_info"):
        c.eq(h.params.get("shipping_tier"), "Envío a domicilio", "shipping_tier")
    for h in col.find("add_payment_info"):
        c.eq(h.params.get("payment_type"), "Bizum", "payment_type")
    check_items_and_values(c, col.hits)
    check_page_views(c, col.hits, base)


def flow_purchase(page, col, base, c):
    open_home(page, base)
    go_to_detail_via_catalog(page)
    add_and_go_to_checkout(page, qty=2)
    page.click("[data-testid=shipping-delivery]")
    page.click("[data-testid=payment-card]")
    page.click("[data-testid=confirm-order]")
    page.wait_for_selector("[data-testid=order-id]")
    order_id = page.text_content("[data-testid=order-id]").strip()
    col.wait_for(page, "purchase")
    col.wait_for(page, "page_view", min_count=6)
    page.wait_for_timeout(FLUSH_MS)

    expected = [
        "page_view", "view_item_list", "page_view", "view_item_list", "select_item",
        "page_view", "view_item", "add_to_cart", "page_view", "view_cart",
        "page_view", "begin_checkout", "add_shipping_info", "add_payment_info",
        "purchase", "page_view",
    ]
    c.eq(col.names(PLANNED), expected, "secuencia compra")
    purchases = col.find("purchase")
    c.eq(len(purchases), 1, "número de purchase")
    if purchases:
        p = purchases[0]
        c.eq(p.params.get("transaction_id"), order_id, "transaction_id = pedido mostrado")
        c.ok(TX_RE.match(order_id or ""), f"formato de transaction_id: {order_id!r}")
        c.eq(p.value(), 11.0, "purchase.value (subtotal sin impuestos ni envío)")
        c.eq(p.params.get("tax"), 1.1, "purchase.tax")
        c.eq(p.params.get("shipping"), 3.5, "purchase.shipping")
        c.eq(p.params.get("currency"), "EUR", "purchase.currency")
        c.ok(path_of(p.page_location).endswith("/checkout"), f"purchase con page_location {p.page_location} (debe ser /checkout)")
    last_pv = col.find("page_view")[-1] if col.find("page_view") else None
    c.ok(last_pv and path_of(last_pv.page_location).endswith("/gracias"), "último page_view en /gracias")
    check_items_and_values(c, col.hits)
    check_page_views(c, col.hits, base)

    # --- Dedupe: recargar /gracias y volver atrás no reenvían purchase ---
    n_before = len(col.find("purchase"))
    page.reload(wait_until="load")                 # en GitHub Pages pasa por 404.html
    page.wait_for_selector("[data-testid=order-id]")
    page.wait_for_timeout(FLUSH_MS)
    c.eq(len(col.find("purchase")), n_before, "purchase tras recargar /gracias")
    c.eq(page.text_content("[data-testid=order-id]").strip(), order_id, "pedido tras recargar")
    page.go_back(wait_until="load")
    page.wait_for_timeout(FLUSH_MS)
    c.eq(len(col.find("purchase")), n_before, "purchase tras volver atrás")
    return order_id


FLOWS = {
    "bounce": flow_bounce,
    "bounce_rejected": flow_bounce_rejected,
    "abandon": flow_abandon,
    "purchase": flow_purchase,
}


def run_flow(browser, name, base, headed):
    ctx = browser.new_context(**PLAYWRIGHT_DEVICE)
    col = HitCollector(ctx)
    page = ctx.new_page()
    c = Check(name)
    result = None
    try:
        result = FLOWS[name](page, col, base, c)
    except Exception as e:  # fallo de UI: se reporta como fallo del flujo
        c.failures.append(f"excepción: {type(e).__name__}: {e}")
    finally:
        page.wait_for_timeout(500)
        ctx.close()
    return c, col, result


PLAYWRIGHT_DEVICE = {}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://localhost:8080/", help="URL base de la web (con barra final)")
    ap.add_argument("--flow", choices=["all", *FLOWS], default="all")
    ap.add_argument("--headed", action="store_true", help="ver el navegador")
    ap.add_argument("--verbose", "-v", action="store_true", help="listar todos los hits")
    args = ap.parse_args()
    base = args.url if args.url.endswith("/") else args.url + "/"
    flows = list(FLOWS) if args.flow == "all" else [args.flow]

    total_fail = 0
    with sync_playwright() as p:
        PLAYWRIGHT_DEVICE.update(p.devices["iPhone 13"])
        browser = p.chromium.launch(headless=not args.headed)
        tx_ids = []
        for name in flows:
            c, col, result = run_flow(browser, name, base, args.headed)
            if name == "purchase" and result:
                tx_ids.append(result)
                # Segunda compra en otro contexto: transaction_id distinto.
                c2, col2, result2 = run_flow(browser, name, base, args.headed)
                tx_ids.append(result2)
                c.ok(result2 and result2 != result, f"transaction_id repetido entre compras: {result} / {result2}")
                c.failures += c2.failures
            status = "OK " if not c.failures else "FAIL"
            print(f"[{status}] {name:16s} hits={len(col.hits):3d} (+{len(col.auto_hits)} ae=a) comprobaciones={c.passed} fallos={len(c.failures)}")
            print("       secuencia:", " → ".join(col.names(PLANNED)))
            for f in c.failures:
                print("       ✗", f)
            if args.verbose:
                for h in col.hits:
                    print(f"       · {h.name:18s} {path_of(h.page_location):60s} gcs={h.gcs} value={h.value()} items={[i.get('item_id') for i in h.items]}")
            total_fail += len(c.failures)
        browser.close()

    print()
    print("TODO OK" if not total_fail else f"{total_fail} FALLOS")
    sys.exit(1 if total_fail else 0)


if __name__ == "__main__":
    main()
