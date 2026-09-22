# -*- coding: utf-8 -*-
"""Le contrôle d'arrivée d'un clip (RV1). Trois mesures, aucun fournisseur.

**Module pur** : `numpy` seul, aucune dépendance au dépôt ni à un fournisseur.
Il tourne sur des tableaux déjà en mémoire — les images tirées du clip pour
« noire » et « immobile », les images préparées pour la grille pour « vide » —
et ne lit ni n'écrit rien lui-même. Ce qui en fait ou en défait un clip vit à
l'appelant (`ServiceAnimation._encaisser`, `ServiceMontage.garder`) ; ce module
ne fait que mesurer et comparer à un seuil.

**Les seuils sont mesurés, pas devinés** (`docs/PLAN-revue-du-21-septembre.md`,
RV1, § 3). Sur les 45 clips vidéo réussis du dépôt et les 4 bancs versionnés,
chaque seuil laisse au moins ×5 de marge avec le clip raté qu'il vise à
attraper. Les revoir demande de refaire la mesure, pas de changer un chiffre
au jugé.

**L'ordre compte** : noire, puis immobile, puis vide — et une seule raison est
gardée, la première qui s'applique. Un clip noir est presque toujours immobile
aussi ; dire « noire » est plus utile que dire « immobile ».
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

# ── Les trois raisons ─────────────────────────────────────────────────────

NOIRE = "noire"
IMMOBILE = "immobile"
VIDE = "vide"

RAISON: dict[str, str] = {
    NOIRE: "la vidéo est revenue noire",
    IMMOBILE: "la vidéo ne bouge pas",
    VIDE: "le détourage n'a rien laissé",
}

# Rec.601, le même poids que le reste du produit emploie pour une luminance.
_POIDS_LUMINANCE = np.array([0.299, 0.587, 0.114])

# **≥ 80 % des images à un centile 99 ≤ 24.** Le centile plutôt que le maximum :
# un pixel isolé de bruit d'encodage ne doit pas suffire à faire passer un clip
# noir. Mesuré : la plus petite valeur chez les 49 clips réussis est 138, ×5,8
# au-dessus du seuil.
SEUIL_NOIRE_CENTILE = 24.0
SEUIL_NOIRE_PART = 0.80

# **Médiane des écarts absolus moyens entre images successives < 0,10.** La
# médiane plutôt que la moyenne : Wan rend l'image de départ en image 0, et un
# clip dont seule la première transition bouge aurait une moyenne au-dessus du
# seuil quand sa médiane reste à 0. Mesuré : la plus petite valeur chez les
# réussis est 0,968, ×9,7 au-dessus du seuil.
SEUIL_IMMOBILE_ECART = 0.10

# **Maximum de la part de pixels opaques sur les images retenues < 0,5 %.**
# Mesuré : le minimum chez les réussis est 0,374 (37,4 %), ×75 au-dessus du
# seuil.
SEUIL_VIDE_OPAQUE = 0.005


@dataclass(frozen=True, slots=True)
class MesureArrivee:
    """Ce que le contrôle a lu, gardé pour recalibrer plus tard (`clip.arrivee`)."""

    luminance_p99: list[float]
    ecart_median: float | None


def controler_images(images: list[np.ndarray]) -> tuple[str | None, MesureArrivee]:
    """« noire » ou « immobile », ou rien — sur les images tirées du clip.

    **Aucune mesure sur une liste vide** : c'est le cas du décodeur absent, et
    l'appelant ne doit alors rien changer au comportement d'avant. Chaque
    tableau est `(hauteur, largeur, 3 ou 4)`, en RVB 0-255 ; un canal alpha
    éventuel est ignoré ici, il ne sert qu'à la mesure « vide ».
    """
    p99 = [_centile_99_luminance(image) for image in images]
    ecart = _ecart_median(images)
    mesure = MesureArrivee(luminance_p99=p99, ecart_median=ecart)
    if images and sum(1 for v in p99 if v <= SEUIL_NOIRE_CENTILE) / len(images) >= SEUIL_NOIRE_PART:
        return NOIRE, mesure
    if ecart is not None and ecart < SEUIL_IMMOBILE_ECART:
        return IMMOBILE, mesure
    return None, mesure


def vide_apres_detourage(preparees: list[np.ndarray]) -> bool:
    """Vrai quand même la meilleure image retenue n'a presque rien laissé.

    `preparees` sont les images **après grille**, RGBA — exactement celles
    que `ServiceMontage.garder` va tailler en bande. Rien n'est écrit avant cet
    appel, et rien ne l'est si la réponse est vraie.
    """
    if not preparees:
        return True
    parts = [_part_opaque(image) for image in preparees]
    return max(parts) < SEUIL_VIDE_OPAQUE


def _centile_99_luminance(image: np.ndarray) -> float:
    rgb = image[:, :, :3].astype(np.float64)
    return float(np.percentile(rgb @ _POIDS_LUMINANCE, 99))


def _ecart_median(images: list[np.ndarray]) -> float | None:
    """La médiane des écarts absolus moyens entre images successives.

    `None` sur moins de deux images : il n'y a alors rien à comparer, et ce
    n'est pas une raison de dire « immobile ».
    """
    if len(images) < 2:
        return None
    ecarts = [
        float(np.mean(np.abs(avant[:, :, :3].astype(np.float64) - apres[:, :, :3].astype(np.float64))))
        for avant, apres in zip(images, images[1:])
    ]
    return float(np.median(ecarts))


def _part_opaque(image: np.ndarray) -> float:
    if image.shape[2] < 4:  # pragma: no cover — une image préparée porte toujours un alpha
        return 1.0
    alpha = image[:, :, 3]
    return float(np.count_nonzero(alpha > 0)) / alpha.size
