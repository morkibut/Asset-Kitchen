# -*- coding: utf-8 -*-
"""Ce qui reste chez chaque fournisseur — **et d'où le chiffre vient**.

Arrivé en F2 (`docs/archive/plan-versions-tenues.md` § V2.2). Un invariant de la version tient ici et
nulle part ailleurs : *un chiffre de réserve dit toujours s'il est relevé chez
le fournisseur ou compté ici.*

**Et « compté ici » est le cas normal, pas l'exception.** C'est le constat le
plus utile du relevé F0 : aucun des fournisseurs retenus ne dit ce qu'il reste.
Pollinations n'a pas de réserve du tout — sa limite est une **cadence**, un
appel toutes les quinze secondes —, et Cloudflare n'expose pas la sienne. Un
produit qui n'aurait prévu que le cas « lu chez lui » n'aurait rien à afficher.

**Ce qui est compté ici ne connaît que les appels partis d'ici**, et c'est la
raison pour laquelle l'écran doit l'écrire : générer depuis un autre outil, ou
depuis une autre machine, entame la même réserve sans que ce compteur-ci le
voie. Le chiffre reste utile — il est le seul disponible —, mais il est un
minimum, pas un relevé.

**Le compte est borné, et la borne est le renouvellement du fournisseur.** Un
compteur sans bord finirait par ne plus rien apprendre : au bout d'un mois il
dirait « 400 jetons » sans qu'on sache si c'est beaucoup aujourd'hui. La fenêtre
part de la dernière heure de renouvellement passée — minuit, pour ce que le
produit connaît aujourd'hui.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Any

from atelier.depot import Base
from atelier.domaine import Compte, Reserve
from atelier.domaine.catalogue import nommer
from atelier.services.fournisseurs import Fournisseurs, compte_de


class ServiceReserves:
    """Une lecture par fournisseur, et une seule requête pour tous.

    **Pas une lecture par modèle** : un catalogue de cinquante modèles compterait
    sinon cinquante fois la même chose à chaque affichage de la liste. C'est la
    règle qu'`indisponible` a instaurée en F1, appliquée à la question voisine.
    """

    def __init__(self, fournisseurs: Fournisseurs, base: Base) -> None:
        self._fournisseurs = fournisseurs
        self._base = base

    # ── Lecture ──────────────────────────────────────────────────────────────

    def toutes(self, maintenant: float | None = None) -> list[Reserve]:
        """Les réserves de tous ceux qui en déclarent une, dans l'ordre.

        Un fournisseur qui compte en argent n'en déclare aucune et ne paraît
        donc pas : ce qu'il a coûté se lit dans la barre de tête et dans l'écran
        des dépenses, qui sont faits pour ça.
        """
        instant = maintenant if maintenant is not None else time.time()
        fournisseurs = [
            (getattr(f, "nom", "inconnu"), compte_de(f))
            for f in self._fournisseurs.tous()
        ]
        declares = [(nom, compte) for nom, compte in fournisseurs if compte is not None]
        if not declares:
            return []

        depuis = min(_depuis(compte, instant) for _, compte in declares)
        partis = self._base.consomme_depuis(depuis)
        return [
            self._remplir(nom, compte, partis, instant) for nom, compte in declares
        ]

    def de(self, fournisseur: str, maintenant: float | None = None) -> Reserve | None:
        """La réserve d'un seul, ou `None` s'il compte en argent."""
        for reserve in self.toutes(maintenant):
            if reserve.fournisseur == fournisseur:
                return reserve
        return None

    def en_json(self, maintenant: float | None = None) -> list[dict[str, Any]]:
        return [r.en_json() for r in self.toutes(maintenant)]

    # ── Le remplissage ───────────────────────────────────────────────────────

    def _remplir(
        self,
        nom: str,
        compte: Compte,
        partis: list[tuple[str, str, float]],
        maintenant: float,
    ) -> Reserve:
        depuis = _depuis(compte, maintenant)
        # **Le fournisseur se reconnaît au nom complet du modèle**, jamais à
        # l'unité seule : deux fournisseurs peuvent très bien compter tous les
        # deux en jetons, et sommer par unité mélangerait leurs réserves. C'est
        # la même raison qui a fait qualifier les modèles en F1.
        prefixe = nommer(nom, "")
        consomme = sum(
            quantite
            for modele, unite, quantite in partis
            if modele.startswith(prefixe) and unite == compte.unite
        )
        return Reserve(
            fournisseur=nom,
            unite=compte.unite,
            consomme=round(consomme, 6),
            plafond=compte.plafond,
            source=compte.source,
            renouvellement=compte.renouvellement,
            cadence_s=compte.cadence_s,
            depuis=depuis,
        )


def _depuis(compte: Compte, maintenant: float) -> float:
    """Le début de la fenêtre de comptage, d'après l'heure de renouvellement.

    **Une seule heure est connue aujourd'hui, et c'est minuit.** Le jour où un
    fournisseur en annoncera une autre, elle s'écrira ici, à un endroit, plutôt
    que dans chaque adaptateur. Une heure qu'on ne sait pas lire ne borne rien :
    on compte alors depuis toujours, ce qui est vrai et se lit à l'écran.
    """
    if not compte.renouvellement:
        return 0.0
    if compte.renouvellement == "minuit":
        jour = datetime.fromtimestamp(maintenant).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        return jour.timestamp()
    heure = _heure(compte.renouvellement)
    if heure is None:
        return 0.0
    borne = datetime.fromtimestamp(maintenant).replace(
        hour=heure, minute=0, second=0, microsecond=0
    )
    if borne.timestamp() > maintenant:
        borne -= timedelta(days=1)
    return borne.timestamp()


def _heure(texte: str) -> int | None:
    """`« 8 h »`, `« 08:00 »` — l'heure ronde qu'un fournisseur annonce, ou rien."""
    chiffres = "".join(c for c in texte.split(":")[0] if c.isdigit())
    if not chiffres:
        return None
    valeur = int(chiffres)
    return valeur if 0 <= valeur <= 23 else None
