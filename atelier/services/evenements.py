# -*- coding: utf-8 -*-
"""La diffusion — ce que l'atelier annonce, à qui écoute.

Le sondage d'une seconde disparaît ici. Un service qui change d'état le **dit**,
et les onglets ouverts l'apprennent au moment où ça se produit ; personne ne
redemande « alors ? » toutes les secondes. C'est l'équivalent, côté Python, de
`MySpriteAi/server/progress.ts` — sauf qu'aucun fournisseur d'image ne raconte
ce qu'il fait en chemin : ce qui circule ici, ce sont des **faits acquis**
(un emplacement part, une image arrive, un appel échoue, le catalogue revient),
jamais un avancement inventé.

Trois règles, et elles tiennent en trois lignes de code chacune :

- **Un abonné lent ne ralentit jamais une génération.** Chaque abonné a sa
  propre file bornée ; quand elle déborde, c'est le plus vieux message qui part.
  Une image qui arrive ne peut pas attendre qu'un onglet en veille se réveille.
- **La diffusion ne lève jamais.** Rien de ce qui se passe ici ne doit pouvoir
  faire échouer un appel déjà payé.
- **Aucun état n'est gardé.** Ce qui fait foi vit dans la base et sur le disque ;
  la diffusion n'est qu'un tuyau. Un abonné qui arrive en retard demande l'état
  complet — c'est ce que fait le premier message de chaque abonnement.
"""

from __future__ import annotations

import asyncio
import contextlib
from dataclasses import dataclass
from typing import Any, Iterator

# Un onglet en veille peut manquer quelques messages ; il reçoit l'état complet
# à sa reconnexion, donc rien n'est perdu. 64 laisse largement passer un lot de
# huit variations qui commencent et finissent.
PROFONDEUR = 64


@dataclass(frozen=True, slots=True)
class Evenement:
    """Ce qui circule. `genre` dit quoi lire, `charge` est déjà en JSON."""

    genre: str  # "generation" · "catalogue" · "etat"
    charge: dict[str, Any]


class Diffusion:
    def __init__(self, profondeur: int = PROFONDEUR) -> None:
        self._files: set[asyncio.Queue[Evenement]] = set()
        self._profondeur = profondeur

    @property
    def abonnes(self) -> int:
        return len(self._files)

    def publier(self, genre: str, charge: dict[str, Any]) -> None:
        """Annonce un fait. Ne lève jamais, n'attend jamais."""
        evenement = Evenement(genre, charge)
        for file in self._files:
            if file.full():
                # Le plus vieux part : un abonné en retard perd du contexte,
                # jamais la nouvelle la plus fraîche.
                try:
                    file.get_nowait()
                except asyncio.QueueEmpty:  # pragma: no cover — course improbable
                    pass
            try:
                file.put_nowait(evenement)
            except asyncio.QueueFull:  # pragma: no cover — idem
                pass

    @contextlib.contextmanager
    def abonnement(self) -> Iterator[asyncio.Queue[Evenement]]:
        """Une file à soi, retirée à coup sûr quand l'appelant s'en va.

        Une **file**, pas un générateur asynchrone : l'appelant décide comment
        il attend — avec un délai pour envoyer un battement, par exemple — et
        annuler cette attente n'abîme rien. Un générateur asynchrone obligerait
        à le refermer proprement depuis un `finally`, ce qui lève dès que
        l'attente en cours n'est pas terminée. Vérifié en essayant : « aclose():
        asynchronous generator is already running ».
        """
        file: asyncio.Queue[Evenement] = asyncio.Queue(maxsize=self._profondeur)
        self._files.add(file)
        try:
            yield file
        finally:
            self._files.discard(file)
