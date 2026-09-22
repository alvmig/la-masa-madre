"""
personas.py · perfiles de usuario, fuentes de tráfico y dispositivos.

Lo comparten traffic_generator.py (navegador real) y mp_backfill.py
(Measurement Protocol), para que el tráfico simulado por las dos vías cuente
la misma historia: mismos porcentajes, mismas fuentes, mismo catálogo.
"""
from __future__ import annotations

import random

# --- Personas ---------------------------------------------------------------
# Suman 100. Reflejan una tienda pequeña: mucha visita de curiosidad, algún
# carrito abandonado y pocas compras.
PERSONAS = [
    ("bounce", 60),    # entra, mira la home, se va
    ("abandon", 25),   # llega a add_shipping_info o add_payment_info y se va
    ("purchase", 15),  # compra
]

# --- Fuentes de tráfico -----------------------------------------------------
# GA4 lee los UTM de la URL de entrada; el referrer lo manda el navegador.
# 'direct' no lleva ni UTM ni referrer.
SOURCES = [
    ({"utm_source": "google", "utm_medium": "cpc", "utm_campaign": "panes_marca"},
     "https://www.google.com/", 30),
    ({"utm_source": "instagram", "utm_medium": "social", "utm_campaign": "hornada_manana"},
     "https://l.instagram.com/", 20),
    ({"utm_source": "newsletter", "utm_medium": "email", "utm_campaign": "pedido_semanal"},
     None, 15),
    ({}, "https://www.google.com/", 10),           # orgánico
    ({}, "https://www.bing.com/", 3),
    ({}, "https://es.wikipedia.org/", 2),          # referral
    ({}, None, 20),                                # directo
]

# --- Dispositivos -----------------------------------------------------------
# Nombres de playwright.devices. 70 % móvil / 30 % escritorio.
MOBILE_DEVICES = ["iPhone 13", "iPhone 15", "Pixel 7", "Galaxy S9+"]
DESKTOP_VIEWPORTS = [(1440, 900), (1920, 1080), (1366, 768)]
MOBILE_SHARE = 0.70

# --- Consentimiento ---------------------------------------------------------
CONSENT_ACCEPT_SHARE = 0.85

# --- Recurrencia ------------------------------------------------------------
# Porcentaje de sesiones que reutilizan el storage_state de un visitante
# anterior (misma cookie _ga → usuario recurrente en GA4).
RETURNING_SHARE = 0.20


def weighted_choice(rng: random.Random, options):
    """options = [(valor, peso), ...]"""
    total = sum(w for _, w in options)
    r = rng.uniform(0, total)
    upto = 0
    for value, weight in options:
        upto += weight
        if r <= upto:
            return value
    return options[-1][0]


def pick_persona(rng: random.Random) -> str:
    return weighted_choice(rng, PERSONAS)


def pick_source(rng: random.Random):
    """Devuelve (utm_dict, referrer_or_None)."""
    return weighted_choice(rng, [((utm, ref), weight) for utm, ref, weight in SOURCES])


def pick_device(rng: random.Random) -> dict:
    """Kwargs para browser.new_context()."""
    if rng.random() < MOBILE_SHARE:
        return {"_device_name": rng.choice(MOBILE_DEVICES)}
    w, h = rng.choice(DESKTOP_VIEWPORTS)
    return {"_device_name": None, "viewport": {"width": w, "height": h}}


def accepts_consent(rng: random.Random) -> bool:
    return rng.random() < CONSENT_ACCEPT_SHARE


def human_pause(rng: random.Random, median_s: float = 2.0, sigma: float = 0.6) -> float:
    """
    Espera log-normal: la mayoría de pausas rondan la mediana, pero hay colas
    largas (el usuario que se distrae). Acotada para que una sesión no eternice.
    """
    return min(rng.lognormvariate(0, sigma) * median_s, median_s * 8)
