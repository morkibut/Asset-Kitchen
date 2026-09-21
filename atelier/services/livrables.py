"""Quelles animations peuvent partir au jeu — **une règle, lue partout** (`RV8`).

Une bande dont **tous** les clips ont échoué (`echouee`) ne part pas. RV1 ne
monte jamais seul un clip échoué, si bien qu'aucune liste n'en montrait ; mais
le montage à la main le permet (`ServiceMontage`), et la bande qui en sort se
retrouvait livrable comme une autre. Trois lecteurs avaient chacun leur
parcours des bandes — la forme « fichiers » (`ServiceSortie._bandes`), la liste
du paquet Godot (`ServiceLivraison.animations`) et sa préparation
(`ServiceLivraison.prevoir`) —, et une règle écrite trois fois finit par se
contredire. Elle vit donc ici, et l'écran la lit par eux.

**Ce qui n'est pas écarté ici** : le recours de RV1 — un clip vide après
détourage reste `reussie`, et la bande qu'on en monte à la main reste
livrable (`tests/test_rv1.py`). Une bande dont un seul clip a échoué non plus :
ses autres images viennent d'un clip réussi, et c'est l'auteur qui les a mêlées.

Un clip inconnu de la base (supprimé, ou jamais passé par une génération, comme
dans les essais) n'est pas un clip échoué : on ne sait pas, et on ne retire pas
ce qu'on ne sait pas juger.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from atelier.domaine.bande import Bande
from atelier.domaine.generation import Statut


@dataclass(frozen=True, slots=True)
class Livrables:
    """Les bandes d'un jeu qui peuvent partir, et celles que la règle écarte.

    `ecartees` se dit dans « pas prêt » : une animation qui ne sort pas sans
    que rien ne le dise serait le défaut même que la règle corrige.
    """

    bandes: tuple[Bande, ...]
    ecartees: tuple[Bande, ...]


def clips_de(bande: Bande) -> tuple[str, ...]:
    """Les clips d'où la bande tire ses images — son clip quand elle n'a aucune prise."""
    return bande.clips or ((bande.clip,) if bande.clip else ())


def tous_echoues(base: Any, bande: Bande) -> bool:
    """Tous les clips de cette bande ont-ils échoué ? Faux s'il n'y en a aucun."""
    clips = clips_de(bande)
    if not clips:
        return False
    for identifiant in clips:
        generation = base.lire(identifiant)
        if generation is None or generation.statut != Statut.ECHOUEE:
            return False
    return True


def bandes_livrables(base: Any, projet: str, personnage: str | None = None) -> Livrables:
    """Les bandes gardées de ce jeu (et de ce sujet), **triées par la règle**.

    Les bandes écartées à la main (`supprime_le`) n'entrent dans aucune des
    deux listes : elles ne sont pas « pas prêtes », elles ne sont plus là. Le
    reste — une bande vide, un brouillon — est laissé à chaque lecteur, qui en
    avait déjà sa règle et ses mots.
    """
    bandes: list[Bande] = []
    ecartees: list[Bande] = []
    for bande in base.bandes():
        if bande.projet != projet or bande.supprime_le is not None:
            continue
        if personnage is not None and bande.personnage != personnage:
            continue
        (ecartees if tous_echoues(base, bande) else bandes).append(bande)
    return Livrables(bandes=tuple(bandes), ecartees=tuple(ecartees))
