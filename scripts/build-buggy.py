#!/usr/bin/env python3
"""
build-buggy.py · regenera site/buggy/ a partir de site/ plantando los 5 fallos
del ejercicio de cierre. Así la versión con fallos nunca se desfasa de la web
buena, y el formador puede enseñar la solución con un simple diff:

    diff site/analytics.js site/buggy/analytics.js
    diff site/app.js       site/buggy/app.js

Uso:  python3 scripts/build-buggy.py
SOLUCIONES.md no se toca.
"""
import pathlib, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE, BUGGY = ROOT / "site", ROOT / "site" / "buggy"
FILES = ["index.html", "404.html", "styles.css", "app.js", "router.js", "catalog.js", "config.js", "analytics.js"]

for f in FILES:
    shutil.copy(SITE / f, BUGGY / f)

def plant(fname, old, new, what):
    p = BUGGY / fname
    s = p.read_text()
    if old not in s:
        sys.exit(f"ERROR ({what}): no encuentro el texto a sustituir en {fname}. ¿Ha cambiado site/{fname}?")
    p.write_text(s.replace(old, new, 1))

# 1 · consent default DESPUÉS del config (y send_page_view: true → fallo 2)
plant("analytics.js",
"""  // Consent Mode v2: todo denegado hasta que el usuario decida. Si ya decidió
  // en otra visita, el default refleja su elección y nos ahorramos el par
  // denied→granted en cada carga.
  gtag('consent', 'default', consentPayload(getStoredConsent() === 'granted'));

""", "", "fallo 1a")
plant("analytics.js",
"""    ...(isDebug() ? { debug_mode: true } : {}),
  });
""",
"""    ...(isDebug() ? { debug_mode: true } : {}),
  });
  gtag('consent', 'default', consentPayload(getStoredConsent() === 'granted'));
""", "fallo 1b")

# 2 · page_view doble
plant("analytics.js", "    send_page_view: false,", "    send_page_view: true,", "fallo 2")

# 3 · value como string
plant("analytics.js", "    value: sumValue(items),      // price × quantity",
                      "    value: sumValue(items).toFixed(2),", "fallo 3")

# 4 · items del carrito sin item_id
plant("analytics.js",
"""function linesToItems(lines) {
  return lines.map((l) => toGA4Item(l.product, { quantity: l.quantity, index: l.index, list: l.list }));
}""",
"""function linesToItems(lines) {
  return lines.map((l) => {
    const { item_id, ...item } = toGA4Item(l.product, { quantity: l.quantity, index: l.index, list: l.list });
    return item;
  });
}""", "fallo 4")

# 5 · purchase sin dedupe, con id fijo y disparado también al pintar /gracias
plant("analytics.js",
"""  if (wasSent(order.transaction_id)) {
    console.warn(`[analytics] purchase ${order.transaction_id} ya enviado, se omite`);
    return false;
  }
""", "", "fallo 5a")
plant("analytics.js", "    transaction_id: order.transaction_id,", "    transaction_id: 'MM-TEST',", "fallo 5b")
plant("analytics.js", "  markSent(order.transaction_id);\n", "", "fallo 5c")
plant("app.js",
"""  try { order = JSON.parse(sessionStorage.getItem('mm_last_order')); } catch { /* nada */ }
""",
"""  try { order = JSON.parse(sessionStorage.getItem('mm_last_order')); } catch { /* nada */ }
  if (order && order.lines) trackPurchase(order);
""", "fallo 5d")
plant("app.js",
"""JSON.stringify({ transaction_id: order.transaction_id, total: t.total })""",
"""JSON.stringify({ transaction_id: order.transaction_id, total: t.total, lines: lines.map((l) => ({ product: l.product, quantity: l.quantity })) })""",
"fallo 5e")

plant("index.html", "<title>La Masa Madre · Obrador</title>", "<title>La Masa Madre (con fallos) · Obrador</title>", "título")
print("site/buggy/ regenerado con 5 fallos")
