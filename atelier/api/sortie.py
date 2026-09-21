# -*- coding: utf-8 -*-
"""Les routes de la sortie (B21) — **prévoir, puis écrire**.

Même règle que les cinq autres routeurs : aucune logique ici, chaque route
appelle un service et met en forme. Chemins en anglais, charges utiles en
français. Monté sous le même préfixe : de l'extérieur, l'API n'a pas de couture.

**Deux routes pour un seul geste, et c'est tout l'objet de la tranche.** Les
quatre sorties d'avant écrivaient au premier appel ; ici la première route
répond *voilà ce que j'écrirais* sans toucher au disque, et la seconde le fait.
Séparer les deux est ce qui permet à l'écran de montrer un arbre de sept cents
fichiers avant qu'un seul existe.

⚠️ **`/output/preview` est déclarée avant `/output`**, et l'ordre n'est pas une
coquetterie : c'est la règle déjà payée sur `/strips/export`, écrite pour que
rien n'ait jamais à décider si `preview` est autre chose qu'un mot du chemin.

**Aucune de ces routes ne touche le réseau.** Le service n'importe pas de
fournisseur, et l'aperçu comme l'écriture sont du disque et du processeur — c'est
le cinquième critère de la tranche, et il se prouve en comptant les appels du
double.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

from atelier.domaine import sortie as vocabulaire
from atelier.domaine.sortie import Reglage
from atelier.services import Atelier

routeur = APIRouter()


def _atelier(requete: Request) -> Atelier:
    return requete.app.state.atelier


def _projet(requete: Request, projet: str | None) -> str:
    return projet or _atelier(requete).bibliotheque.courant or ""


class CorpsSortie(BaseModel):
    """Les cinq réponses de l'écran, plus le jeu visé.

    **Aucune valeur n'est validée ici**, et c'est voulu : une valeur hors liste
    doit revenir en français avec la liste des valeurs possibles, ce que fait le
    service. Une validation de Pydantic répondrait en anglais avec un 422, et
    `docs/PIEGES.md` a déjà payé ce chemin-là une fois.
    """

    projet: str | None = None
    lot: str = vocabulaire.TOUT
    # Le dossier du jeu, quand on veut celui d'aujourd'hui plutôt que celui du
    # jeu rattaché. Absent, le service redescend (`RV8`) : le jeu Godot
    # rattaché, puis l'ancien dossier de sortie — jamais le dossier commun de
    # l'atelier.
    dossier: str | None = None
    rangement: str = vocabulaire.A_PLAT
    collision: str = vocabulaire.REMPLACER
    moteur: str = vocabulaire.AUCUN
    # **Un seul sujet** (`RP17`) : posé, il emporte ce sujet-là en entier et le
    # lot n'est plus lu. C'est l'ancienne route `POST /characters/{id}/export`,
    # devenue un réglage d'une porte qui prévisualise.
    sujet: str = ""

    def reglage(self) -> Reglage:
        return Reglage(
            lot=self.lot,
            dossier=self.dossier,
            rangement=self.rangement,
            collision=self.collision,
            moteur=self.moteur,
            sujet=self.sujet,
        )


@routeur.get("/output/settings")
async def reglages_de_la_sortie(
    requete: Request, projet: str | None = None
) -> dict[str, Any]:
    """Les cinq listes fermées, le dossier de ce jeu, et la fois d'avant.

    **L'écran ne redéclare aucune de ces listes.** Un cinquième moteur ajouté au
    domaine paraît alors dans l'écran sans qu'une ligne de TypeScript bouge, et
    surtout : le serveur ne peut pas refuser une valeur que l'écran propose,
    puisque c'est lui qui les a données.

    `GET` parce que c'est une ressource qu'on va chercher, et qu'elle ne change
    rien — contrairement aux deux routes en dessous.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    precedente = atelier.sortie.precedente(vise)
    destination = atelier.sortie.destination(vise)
    return {
        "lots": list(vocabulaire.LOTS),
        "rangements": list(vocabulaire.RANGEMENTS),
        "collisions": list(vocabulaire.COLLISIONS),
        "moteurs": list(vocabulaire.MOTEURS),
        # **Les sujets viennent d'ici aussi** (`RP17`), pour la raison déjà
        # écrite au-dessus : l'écran ne peut pas proposer un sujet que le
        # serveur refuserait, et *sortir un seul personnage* se choisit dans la
        # même liste que le reste.
        "sujets": [
            {"identifiant": p.identifiant, "nom": p.nom or p.identifiant}
            for p in atelier.production.personnages(vise)
        ]
        if vise
        else [],
        # Le dossier entier, **gardé tel quel** pour qui le lisait avant RV8…
        "dossier": destination["dossier"],
        # … et d'où il vient (`RV8`) : `racine` (le jeu Godot rattaché, ou
        # l'ancien dossier), `sous_dossier` (celui des fichiers, sous la racine),
        # `origine` (`jeu`, `ancien` ou `aucun`), la `mention` d'un ancien
        # dossier, la proposition `rattacher` (`{dossier, sous_dossier}` ou
        # `null`) et le `refus` à montrer quand on ne peut pas sortir.
        **{cle: destination[cle] for cle in (
            "racine", "sous_dossier", "origine", "mention", "rattacher", "refus",
        )},
        "precedente": precedente.en_json() if precedente else None,
    }


class CorpsDossier(BaseModel):
    """Le sous-dossier de la forme « fichiers », relatif au jeu Godot rattaché."""

    projet: str | None = None
    sous_dossier: str = ""


@routeur.put("/output/folder")
async def regler_le_dossier(requete: Request, corps: CorpsDossier) -> dict[str, Any]:
    """Pose le sous-dossier des fichiers (`RV8`), et rend la destination relue.

    **La racine ne se pose pas ici** : c'est le rattachement du jeu Godot
    (`PUT /projects/{projet}/godot-link`), la source unique. Cette route ne
    règle que l'endroit, sous cette racine, où la forme « fichiers » se pose —
    rangé à côté de l'association, jamais dedans (son format est figé).
    """
    return _atelier(requete).sortie.regler_sous_dossier(
        _projet(requete, corps.projet), corps.sous_dossier
    )


@routeur.post("/output/preview")
async def prevoir(requete: Request, corps: CorpsSortie) -> dict[str, Any]:
    """Ce qui sortirait — **et pas un octet n'est écrit** (B21).

    `POST` et non `GET` bien que rien ne change : les cinq réponses de l'écran
    ne tiennent pas dans une adresse dès qu'un dossier de Windows s'y trouve, et
    l'aperçu n'est pas une ressource qu'on pourrait aller rechercher — il est
    calculé pour ce réglage-là, à cet instant-là, contre l'état du dossier.

    **Cliquer ne coûte jamais** (`docs/DESIGN.md`, règle 1) : cette route ne
    dépense rien, ne crée rien, et se redemande à chaque changement de réglage
    sans que l'auteur ait à s'en soucier.
    """
    return _atelier(requete).sortie.prevoir(
        _projet(requete, corps.projet), corps.reglage()
    ).en_json()


@routeur.post("/output")
async def sortir(requete: Request, corps: CorpsSortie) -> dict[str, Any]:
    """La sortie, pour de vrai — et le compte rendu de ce qui a été posé.

    **Aucun octet ne traverse cette route.** Les fichiers sont écrits sur la
    machine ; ce qui revient est la liste de leurs chemins, ce qui a été effacé,
    et où le descriptif est parti. C'est la même forme que la sortie d'un
    personnage depuis C5 — l'écran et l'agent reçoivent la même chose.

    Deux refus, chacun avec sa phrase : un dossier de jeu absent ou non
    inscriptible (celui-là vient de T7 et nomme le chemin fautif), et un lot
    dont rien ne sort.
    """
    return _atelier(requete).sortie.ecrire(
        _projet(requete, corps.projet), corps.reglage()
    ).en_json()
