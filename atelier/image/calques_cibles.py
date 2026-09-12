"""Composition CPU des masques de calque, du corps et des morceaux dessous.

Les masques locaux suivent la même transformation que leurs pixels. Une épée
peut donc passer derrière la main et devant le torse, même en vue 3/4.
"""
from __future__ import annotations

import io
import math
import numpy as np
from PIL import Image

from atelier.domaine.calques_cibles import PlacementCalque
from atelier.domaine.recette import traits_depuis_json
from atelier.image.traitement import peindre


def png(image: np.ndarray | Image.Image) -> bytes:
    tampon = io.BytesIO()
    (image if isinstance(image, Image.Image) else Image.fromarray(image)).save(tampon, format="PNG")
    return tampon.getvalue()


def rgba(octets: bytes) -> np.ndarray:
    with Image.open(io.BytesIO(octets)) as image:
        return np.array(image.convert("RGBA"))


def couches(base: np.ndarray, calque: np.ndarray, placement: PlacementCalque, masques: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Rend dessous, corps masqué, dessus dans un cadre et un repère communs."""
    propre = calque.copy()
    garde = peindre(np.ones(calque.shape[:2], dtype=bool), traits_depuis_json(masques.get("calque")))
    propre[~garde] = 0
    derriere = peindre(np.full(calque.shape[:2], not placement.devant, dtype=bool), traits_depuis_json(masques.get("derriere")))
    sous, dessus = propre.copy(), propre.copy()
    sous[~derriere] = 0
    dessus[derriere] = 0
    corps = base.copy()
    garde_corps = peindre(np.ones(base.shape[:2], dtype=bool), traits_depuis_json(masques.get("corps")))
    corps[~garde_corps] = 0

    def transformer(image: np.ndarray) -> np.ndarray:
        h, w = base.shape[:2]
        ch, cw = image.shape[:2]
        angle = math.radians(placement.rotation)
        c, s = math.cos(angle) / placement.echelle, math.sin(angle) / placement.echelle
        cx, cy = w / 2 + placement.dx, h / 2 + placement.dy
        # Transformation inverse : aucun tampon agrandi de 8192 × échelle.
        transforme = Image.fromarray(image).transform((w, h), Image.Transform.AFFINE,
            (c, s, cw / 2 - c * cx - s * cy, -s, c, ch / 2 + s * cx - c * cy),
            Image.Resampling.NEAREST)
        resultat = np.array(transforme)
        resultat[:, :, 3] = np.rint(resultat[:, :, 3] * placement.opacite).astype(np.uint8)
        return resultat

    return transformer(sous), corps, transformer(dessus)


def composer(base: np.ndarray, calque: np.ndarray, placement: PlacementCalque, masques: dict) -> bytes:
    sous, corps, dessus = couches(base, calque, placement, masques)
    resultat = Image.alpha_composite(Image.fromarray(sous), Image.fromarray(corps))
    return png(Image.alpha_composite(resultat, Image.fromarray(dessus)))
