"""
ga4_hits.py · intercepta y decodifica las peticiones de gtag.js a /g/collect.

Lo comparten e2e_events_test.py y traffic_generator.py. Formato observado
(ver tracking-plan.md §10):

- Query string con los parámetros comunes: v, tid, cid, sid, dl, dt, dr, gcs,
  _dbg, en (nombre del evento), ep.<x> (string), epn.<x> (número), cu, pr1..prN.
- gtag agrupa eventos cercanos en un POST cuyo body lleva UN EVENTO POR LÍNEA
  (`en=view_item&epn.value=5.5&pr1=...`), y la URL no lleva `en`.
- Items: `pr1=idMM-HOG-01~nmHogaza~brLa Masa Madre~caPanes~c2Masa madre~pr5.5~qt2~lp0~lidestacados_home~lnDestacados home`.
- Hits con `ae=a`: reenvío de page_view que hace gtag.js ~5 s después de la
  vista si sigue habiendo interacción. No lo emite nuestro código; se registra
  aparte y NO forma parte de la secuencia de eventos.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from urllib.parse import parse_qsl, urlsplit

# Claves de item dentro de prN (documentadas por observación, no oficiales).
ITEM_KEYS = {
    "id": "item_id", "nm": "item_name", "br": "item_brand", "af": "affiliation",
    "ca": "item_category", "c2": "item_category2", "c3": "item_category3",
    "c4": "item_category4", "c5": "item_category5", "va": "item_variant",
    "pr": "price", "qt": "quantity", "cp": "coupon", "ds": "discount",
    "lp": "index", "li": "item_list_id", "ln": "item_list_name", "lo": "location_id",
}
NUMERIC_ITEM = {"price", "quantity", "index", "discount"}
COLLECT_RE = re.compile(r"/g/collect(\?|$)")


@dataclass
class Hit:
    name: str
    params: dict            # ep.*/epn.* ya sin prefijo, con tipos (float para epn)
    items: list             # lista de dicts con claves GA4 (item_id, price, ...)
    page_location: str
    page_title: str
    page_referrer: str
    gcs: str                # G100 = analytics denegado · G111 = todo concedido
    client_id: str
    session_id: str
    debug: bool
    auto_engagement: bool   # True si lleva ae=a (reenvío automático de page_view)
    raw: dict = field(repr=False)

    def value(self):
        return self.params.get("value")

    def items_value(self):
        return round(sum(i.get("price", 0) * i.get("quantity", 1) for i in self.items), 2)


def is_collect(url: str) -> bool:
    return COLLECT_RE.search(urlsplit(url).path + ("?" if urlsplit(url).query else "")) is not None


def decode_item(raw: str) -> dict:
    item = {}
    for part in raw.split("~"):
        key, val = part[:2], part[2:]
        name = ITEM_KEYS.get(key, key)
        if name in NUMERIC_ITEM:
            try:
                val = int(val) if name in ("quantity", "index") else float(val)
            except ValueError:
                pass  # se deja como string: el test lo detectará
        item[name] = val
    return item


def _decode_one(common: dict, line: dict) -> Hit:
    q = {**common, **line}
    params, items = {}, []
    for k, v in q.items():
        if k.startswith("ep."):
            params[k[3:]] = v
        elif k.startswith("epn."):
            try:
                params[k[4:]] = float(v)
            except ValueError:
                params[k[4:]] = v
        elif re.fullmatch(r"pr\d+", k):
            items.append((int(k[2:]), decode_item(v)))
    if "cu" in q:
        params["currency"] = q["cu"]
    items = [it for _, it in sorted(items)]
    return Hit(
        name=q.get("en", ""),
        params=params,
        items=items,
        page_location=q.get("dl", ""),
        page_title=q.get("dt", ""),
        page_referrer=q.get("dr", ""),
        gcs=q.get("gcs", ""),
        client_id=q.get("cid", ""),
        session_id=q.get("sid", ""),
        debug=q.get("_dbg") == "1" or q.get("ep.debug_mode") == "true",
        auto_engagement=q.get("ae") == "a",
        raw=q,
    )


def decode_request(url: str, post_data: str | None) -> list[Hit]:
    """Una petición puede contener 1 evento (query) o N (una línea por evento en el body)."""
    common = dict(parse_qsl(urlsplit(url).query, keep_blank_values=True))
    if post_data:
        lines = [ln for ln in post_data.split("\n") if ln.strip()]
        hits = [_decode_one(common, dict(parse_qsl(ln, keep_blank_values=True))) for ln in lines]
        # Si la URL ya llevaba `en`, es un evento suelto y el body es opcional (sin líneas).
        if hits:
            return hits
    return [_decode_one(common, {})] if "en" in common else []


class HitCollector:
    """Se engancha a un BrowserContext (o Page) de Playwright y acumula hits."""

    def __init__(self, target):
        self.hits: list[Hit] = []
        self.auto_hits: list[Hit] = []   # reenvíos ae=a
        self.requests = 0
        target.on("request", self._on_request)

    def _on_request(self, request):
        if not is_collect(request.url):
            return
        self.requests += 1
        for hit in decode_request(request.url, request.post_data):
            (self.auto_hits if hit.auto_engagement else self.hits).append(hit)

    def names(self, only=None) -> list[str]:
        return [h.name for h in self.hits if only is None or h.name in only]

    def find(self, name: str) -> list[Hit]:
        return [h for h in self.hits if h.name == name]

    def wait_for(self, page, name: str, timeout_ms: int = 8000, min_count: int = 1):
        """Espera a que gtag envíe `name` (los batches salen con retardo)."""
        waited = 0
        while len(self.find(name)) < min_count and waited < timeout_ms:
            page.wait_for_timeout(100)
            waited += 100
        return len(self.find(name)) >= min_count
