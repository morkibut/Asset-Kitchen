# -*- coding: utf-8 -*-
"""De quoi montrer une image, pour un écran qui la liste (U9, R8).

**L'objet entier, et pas une adresse.** L'écran sait déjà nommer l'adresse d'un
asset et celle d'une carte, à un seul endroit chacune — `vignetteAsset`,
`sujetAsset`, `sujetCarte`. Lui envoyer une adresse toute faite poserait ici un
second vocabulaire d'adresses, que la première empreinte ajoutée ferait diverger.
Il reçoit donc ce qu'il reçoit partout ailleurs, et s'en sert avec les fonctions
qu'il a.

**Une image disparue rend `None`**, jamais une erreur : une référence peut nommer
un asset supprimé ou une carte retirée du tableau entre le moment où la ligne a
été composée et celui où on la regarde. La ligne reste — elle dit ce qui
partirait —, elle n'a simplement pas de vignette.

**Ce module existe parce que deux écrans posent la même question.** L'écran de
confirmation la posait depuis U9 ; la fiche d'une chose la pose depuis R8, pour
ses images d'exemple. Deux réponses écrites à deux endroits auraient fini par
rendre deux formes différentes du même objet, et l'écran aurait eu deux façons de
montrer la même image.

**La phrase en fait partie, depuis TS9.** `/board` (`ServiceUnivers.tableau`) et
l'évènement `carte` (`ServiceUnivers._sauver`) joignent tous deux
`phrase_de_carte` à ce qu'ils rendent d'une carte — ce module doit donc en
faire autant, sous peine de montrer ici une carte plus pauvre que celle que la
toile affiche, et de rompre « le même objet, mot pour mot » que ce fichier
promet en toutes lettres (`tests/test_u9.py::
test_lobjet_montre_est_celui_des_autres_ecrans`, trouvé sur l'état intégré :
la toile portait déjà la phrase, cet écran-ci ne l'avait pas encore).
"""

from __future__ import annotations

from typing import Any


def de_quoi_montrer(
    *,
    assets: Any,
    univers: Any,
    projet: str | None,
    identifiant: str,
    carte: bool,
) -> dict[str, Any] | None:
    """L'asset ou la carte que cette ligne désigne, tel que l'écran le reçoit.

    `carte` dit dans quel tiroir chercher — le tableau d'inspiration du projet,
    ou la bibliothèque. C'est un booléen plutôt qu'une chaîne parce que les deux
    appelants nomment cette distinction autrement : l'un lit `origine == CARTE`,
    l'autre `genre == "carte"`, et leur faire partager un troisième mot aurait
    ajouté une traduction à chacun.
    """
    if not identifiant:
        return None
    try:
        if carte:
            if univers is None or not projet:
                return None
            objet = univers.carte(projet, identifiant)
            return {
                "sorte": "carte",
                "carte": {**objet.en_json(), "phrase": univers.phrase_de_carte(objet)},
            }
        lu = assets.lire(identifiant) if assets else None
        return {"sorte": "asset", "asset": lu.en_json()} if lu else None
    except Exception:  # noqa: BLE001 — une image disparue se voit en moins
        return None
