# -*- coding: utf-8 -*-
"""Le rang de la prochaine image fabriquée dans le dossier d'un appel (P1b).

**Un seul calcul pour tout ce qui range une image à côté de celles d'un appel**
— le découpeur, le dépliage, le miroir, la superposition, « enregistrer sous »,
les calques extraits. Il était copié à sept endroits, et la copie avait déjà
divergé : le dépliage réservait ses rangs (P1a) et quatre des sept ne le
lisaient pas. Or deux images d'un même rang partagent leurs fichiers
`<rang>-brut` et `<rang>-asset.json`, et la seconde efface la première **sans
rien dire** — c'est le seul défaut de rang qui ne se voit pas.

**Pris au-dessus de tout ce que l'appel a jamais connu** :

- les rangs de l'index, **supprimés compris** — tant que l'annulation court, les
  fichiers `<rang>-*` sont encore là, et un geste peut les ramener ;
- les emplacements de l'appel — la relance d'un emplacement ne doit jamais
  tomber sur une image fabriquée ;
- **les rangs qu'un dépliage a réservés** (`Depliage`), même quand ses images
  ont été purgées et que l'index les a oubliées : c'est la moitié de la règle
  des rangs que le disque seul ne voit plus. Un rang pris ne se rend jamais.

`plancher` garde les conventions d'avant, qui ne sont pas les mêmes partout :
cent pour ce qui naît d'une image (au-dessus de tout emplacement imaginable, et
le glob `0-*` de la purge ne mord pas sur `100-asset.json`), zéro pour la
superposition, qui a toujours rangé juste après le dernier.
"""

from __future__ import annotations

from atelier.depot import Base
from atelier.domaine.generation import Generation

# Le rang à partir duquel vivent les images tirées d'une autre — découpes,
# dépliages, miroirs. `RANG_DECOUPE` et `RANG_PLIAGE` valent la même chose.
PLANCHER = 100


def rang_libre(
    base: Base,
    generation: str,
    *,
    plancher: int = PLANCHER,
    objet: Generation | None = None,
) -> int:
    """Le premier rang libre du dossier de `generation`, au-dessus de `plancher`.

    `objet` est la génération déjà en mémoire, quand l'appelant l'a — le
    dépliage réserve sur un objet qu'il vient de modifier, et relire l'index
    rendrait l'état d'avant sa propre écriture.
    """
    pris = list(base.rangs_de_generation(generation))
    lue = objet if objet is not None else base.lire(generation)
    if lue is not None:
        pris += [e.rang for e in lue.emplacements]
        if lue.pliage is not None:
            pris += list(lue.pliage.rangs_reserves)
    return max([plancher - 1, *pris]) + 1
