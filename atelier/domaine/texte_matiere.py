# -*- coding: utf-8 -*-
"""Le texte d'une matière de jeu de tuiles (TU5) — port de sc-clone.

Deux couches, comme chez sc-clone, et pour la même raison : garder la
comparaison au caractère près possible sur la première **seule**.

1. **`composer_prompt` (port de `composerPrompt`, `tile-ia-prompt.js`)** : le
   tronc (« c'est fait de quoi »), la clause de motif de cet emplacement, puis
   le cadrage — dans cet ordre, mot pour mot. C'est la fonction que l'essai de
   fidélité (`essais/tu5_textes_scclone.mjs`, `tests/test_tu5_matieres.py`)
   compare aux sorties réelles de sc-clone.
2. **`texte_envoi` (port de `promptParts`, `lib/providers.mjs`, branche
   `provider==='comfyui'`, `kind==='texture'`)** : l'ajout serveur qui fait
   qu'une matière part réellement raccordable et sans contour cerné — ce que
   « Voir le texte envoyé » doit montrer exactement.

**Ce qui ne change jamais dans `corpsGeneration`** (mêmes lignes que
sc-clone) : `style: '16-bit pixel art'`, `pixel: false`, `theme: ''`. Trois
défauts fixes, jamais des réglages de l'écran — c'est ce qui rend `pixelStyle`
toujours vrai (`/pixel/i.test('16-bit pixel art')`) et `theme` toujours absent
du texte envoyé. Les coder en dur ici, plutôt qu'en paramètres qu'on
n'utiliserait jamais, évite un réglage fantôme que rien n'expose à l'écran.
"""

from __future__ import annotations

import re
from typing import Any

from atelier.domaine.tuiles import TuilesRefusees

# ── Les quatre cadrages (`CADRAGES`, tile-ia-prompt.js) ─────────────────────
#
# Les consignes sont en anglais, comme sc-clone : c'est la langue des modèles
# du catalogue, et un déclencheur de LoRA mal accompagné se dilue. Copiées mot
# pour mot — l'essai de fidélité les compare au caractère près.
CADRAGES: dict[str, dict[str, str]] = {
    "surface": {
        "nom": "Sol vu du dessus",
        "aide": "Le défaut d’une surface de terrain.",
        "perspective": "top-down view",
        "consigne": (
            "seen from directly above, one continuous material filling the "
            "entire frame, flat even overhead lighting, no cast shadows, no "
            "single light direction, no objects, no border"
        ),
    },
    "face": {
        "nom": "Face de mur, de face",
        "aide": "Interdit le sol, le ciel et l’horizon.",
        "perspective": "front view",
        "consigne": (
            "a vertical surface seen straight on from the front, one "
            "continuous material filling the entire frame, flat even "
            "frontal lighting, no cast shadows, no floor, no ground, no "
            "sky, no horizon, no border"
        ),
    },
    "plat": {
        "nom": "Matière à plat, délavée",
        "aide": "Albedo : aucune lumière cuite dedans.",
        "perspective": "top-down view",
        "consigne": (
            "flat lay albedo material, evenly distributed detail across "
            "the whole frame, neutral diffuse lighting, no highlights, no "
            "cast shadows, no vignette, no border"
        ),
    },
    "motif": {
        "nom": "Motif régulier",
        "aide": "Dalles, briques, planches, carrelage.",
        "perspective": "top-down view",
        "consigne": (
            "a regular repeating pattern, aligned rows, even spacing, "
            "consistent unit size, seen from directly above, neutral "
            "diffuse lighting, no cast shadows, no border"
        ),
    },
}

# Ce que l'écran propose comme liste — `LISTE_CADRAGES` côté sc-clone.
LISTE_CADRAGES: tuple[dict[str, str], ...] = tuple(
    {"id": identifiant, "nom": c["nom"], "aide": c["aide"]}
    for identifiant, c in CADRAGES.items()
)

# `cadrageParDefaut` : « face » seulement pour la face du mur, « surface »
# partout ailleurs. TU5 ne propose pas encore la face (TU7), mais la règle
# vient avec le module plutôt que d'être réinventée plus tard.
def cadrage_par_defaut(cible: str) -> str:
    return "face" if cible == "face" else "surface"


# ── Le tronc + la clause + le cadrage (`composerPrompt`) ────────────────────


def composer_prompt(pierre: str, motif: str, cadrage: str) -> str:
    """Le prompt d'une matière — port de `composerPrompt`.

    Refuse plutôt que de laisser partir un champ vide en silence, comme
    sc-clone : un motif vide au milieu du texte n'est pas une erreur qui se
    voit.
    """
    tronc = str(pierre or "").strip()
    clause = str(motif or "").strip()
    if not tronc:
        raise TuilesRefusees("Décris la pierre avant de lancer la génération.")
    if not clause:
        raise TuilesRefusees(
            "Décris le motif de cet emplacement avant de lancer la génération."
        )
    if cadrage not in CADRAGES:
        raise TuilesRefusees(f"Cadrage inconnu : {cadrage}")
    return f"{tronc}, {clause}, {CADRAGES[cadrage]['consigne']}"


# ── La taille (T29, `tailleParDefaut`) ───────────────────────────────────────


def taille_par_defaut(reference: Any = None) -> int:
    """256 sans référence — la taille qu'E8 a fait tenir sans GPU saturé —,
    512 avec : le latent part alors de l'image fournie, pas du bruit."""
    return 512 if reference else 256


# ── Les graines, un bloc de `par_tirage` par tirage (T35, `seedsPourTirages`) ─

GRAINE_MAX = 2**31 - 1


def graines_pour_tirages(depart: int, tirages: int, par_tirage: int = 1) -> list[int]:
    """`tirages` graines de départ, un bloc de `par_tirage` réservé à chacune —
    jamais partagé entre deux emplacements d'un même tirage (T26 : une graine
    commune nuit à la teinte), ni entre deux tirages. Bornes : 1 à 20 tirages,
    comme sc-clone."""
    n = max(1, min(20, int(tirages) if isinstance(tirages, int) else 1))
    pas = max(1, int(par_tirage) if isinstance(par_tirage, int) else 1)
    base = depart if isinstance(depart, int) and depart >= 0 else 0
    return [min(GRAINE_MAX, base + i * pas) for i in range(n)]


# ── Le négatif fixe (`corpsGeneration.negative`) ─────────────────────────────

NEGATIF = (
    "blurry, text, watermark, frame, border, vignette, grid, tile lines, "
    "seams, gutters, single object, centered composition, drop shadow, "
    "directional lighting, gradient, perspective"
)

# `style` et `theme` de `corpsGeneration`, fixes eux aussi (voir l'en-tête du
# module) : jamais un réglage d'écran, ils n'ont donc pas leur propre entrée
# dans les fonctions publiques.
_STYLE = "16-bit pixel art"


# ── L'ajout serveur (`promptParts`, branche comfyui/texture) ────────────────
#
# `pixelStyle = input.pixel || /pixel/i.test(input.style || '')` : avec
# `pixel: false` et `style: '16-bit pixel art'` fixes, `pixelStyle` est
# **toujours vrai** ici — `/pixel/i` trouve « pixel » dans « 16-bit pixel
# art ». `matiereContinue = input.kind==='texture'` est également toujours
# vraie : `corpsGeneration` fixe `kind: 'texture'`. Les deux conditions de
# sc-clone se résolvent donc à une forme fixe, portée telle quelle plutôt que
# recopiée en drapeaux qu'aucun appelant ne fera jamais varier.


def segments_matiere(prompt: str, perspective: str) -> list[str]:
    """Les morceaux de `promptParts`, dans l'ordre, `theme` toujours absent
    (`corpsGeneration` fixe `theme: ''`, et `morceaux` filtre les vides)."""
    return [
        "pixel art",
        prompt,
        perspective,
        "seamless tileable material, matching opposite edges, no grid, no cell borders",
        "simple flat colors, deliberate square pixel clusters, no gradients",
    ]


def _joindre(morceaux: list[str]) -> str:
    """Un déclencheur qui finit par un signe ou par une préposition se colle
    au suivant — même règle que `atelier.domaine.texte_local._joindre`, pour
    que « Game asset tile, » (klein9b-tiles-raccordable) ne porte pas une
    double virgule. Les autres morceaux se séparent par une virgule ordinaire,
    comme `promptParts` (`morceaux(', ', ...)`)."""
    texte = ""
    for morceau in morceaux:
        morceau = str(morceau)
        if not morceau:
            continue
        if not texte:
            texte = morceau
        elif re.search(r"([,.;:]|\bof)$", texte):
            texte = f"{texte} {morceau}"
        else:
            texte = f"{texte}, {morceau}"
    return texte


def texte_envoi(
    pierre: str,
    motif: str,
    cadrage: str,
    *,
    declencheur: str = "",
    suffixe: str = "",
) -> str:
    """Le texte exact qui part vers le fournisseur — ce que « Voir le texte
    envoyé » montre. `composer_prompt` d'abord (le tronc porté au caractère
    près), puis l'ajout serveur (`segments_matiere`), puis le déclencheur et
    le suffixe du style local, comme tout style local de l'atelier."""
    prompt = composer_prompt(pierre, motif, cadrage)
    segments = segments_matiere(prompt, CADRAGES[cadrage]["perspective"])
    if declencheur:
        segments = [declencheur, *segments]
    if suffixe:
        segments = [*segments, suffixe]
    return _joindre(segments)
