# -*- coding: utf-8 -*-
"""Mesurer une image reçue, et la rendre en PNG.

**Les dimensions mesurées font foi, jamais celles demandées** — invariant
instauré en T1 (`docs/PLAN.md`). Un modèle qui rend 1024×1024 alors qu'on
demandait autre chose n'est pas une anomalie à corriger : c'est un fait à
enregistrer. Il en va de même du format : les Seedream acceptent
`output_format: "png"` puis rendent du JPEG sans le dire. On ne croit pas la
demande, on regarde le fichier.

Le PNG n'est produit qu'au **téléchargement** : l'image brute reste telle qu'elle
est arrivée. C'est le principe non destructif, en avance sur T2 — le rendu est un
cache, le brut est la vérité.
"""

from __future__ import annotations

import hashlib
import io
from dataclasses import dataclass

from PIL import Image

# Pillow refuse au-delà de 89 Mpx par défaut (parade au décompressage-bombe).
# Une image de fournisseur reste très en dessous ; on garde la parade.


@dataclass(frozen=True, slots=True)
class Mesure:
    largeur: int
    hauteur: int
    type_media: str
    octets: int

    @property
    def dimensions(self) -> str:
        return f"{self.largeur}×{self.hauteur}"


_TYPES = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "WEBP": "image/webp",
    "GIF": "image/gif",
    "BMP": "image/bmp",
    "TIFF": "image/tiff",
}


def mesurer(octets: bytes) -> Mesure:
    """Lit l'en-tête, sans décoder toute l'image.

    Lève `ValueError` si ce n'est pas une image — ce qui est une raison d'échec
    comme une autre, à afficher en clair à la place de l'image attendue.
    """
    try:
        with Image.open(io.BytesIO(octets)) as image:
            largeur, hauteur = image.size
            format_pillow = image.format or ""
    except Exception as erreur:  # noqa: BLE001 — Pillow lève large, la raison compte
        raise ValueError(f"fichier illisible comme image — {erreur}") from None

    return Mesure(
        largeur=largeur,
        hauteur=hauteur,
        type_media=_TYPES.get(format_pillow, f"image/{format_pillow.lower() or 'inconnu'}"),
        octets=len(octets),
    )


def extension(type_media: str) -> str:
    """L'extension du fichier brut — celle du format réellement reçu."""
    for format_pillow, media in _TYPES.items():
        if media == type_media:
            return ".jpg" if format_pillow == "JPEG" else f".{format_pillow.lower()}"
    return ".bin"


def rendre_en_png(octets: bytes) -> bytes:
    """Le PNG du téléchargement. Rend les octets tels quels si c'en est déjà un.

    « Une image se télécharge seule, en PNG » (`docs/PLAN.md`, T1) — or tous les
    modèles ne rendent pas du PNG, et deux d'entre eux ne rendent que du JPEG.
    La conversion est donc du ressort du produit, pas de l'auteur.
    """
    with Image.open(io.BytesIO(octets)) as image:
        if image.format == "PNG":
            return octets
        converti = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        tampon = io.BytesIO()
        converti.save(tampon, format="PNG", optimize=True)
        return tampon.getvalue()


def empreinte_de(octets: bytes) -> str:
    """Ce qui nomme un doublon. Les octets, rien d'autre.

    Pas de comparaison perceptuelle : deux images visuellement proches sont deux
    images, et c'est à l'auteur d'en décider. Le produit signale ce dont il est
    **certain** — le même fichier, deux fois — et ne devine jamais le reste.

    **Ici depuis R3, et plus dans la carte** : le tableau d'inspiration s'en
    servait seul jusqu'à ce que l'import de la bibliothèque en ait besoin aussi.
    Deux familles d'images l'appellent désormais, et aucune ne la possède —
    même raison que `domaine/teinte.py`, un cran plus bas. Elle a sa place ici
    parce qu'elle ne parle que d'octets : CPU, pure, aucune entrée-sortie.
    """
    return hashlib.sha256(octets).hexdigest()[:16]
