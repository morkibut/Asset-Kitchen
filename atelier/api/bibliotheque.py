# -*- coding: utf-8 -*-
"""Les routes de la bibliothèque — ranger, juger, jeter, reconstruire.

Même règle que `routes.py` : aucune logique ici, chaque route appelle un
service et met en forme. **Chemins en anglais, charges utiles en français.**

**Aucun de ces appels ne touche le réseau.** C'est un critère d'acceptation de
T3 — « réseau coupé : bibliothèque, retouche et détourage fonctionnent
normalement » (US-92) — et il se lit dans les imports de
`services/bibliotheque.py` : il n'y a pas de `fournisseur` dedans.

Elles vivent dans un module à part plutôt qu'à la suite des autres parce
qu'elles répondent à une autre question. `routes.py` dit *comment on fabrique
une image* ; celles-ci disent *où elle se range et ce qu'on en fait ensuite*.
Les deux routeurs sont montés sous le même préfixe : de l'extérieur, l'API n'a
pas de couture.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel, Field

from atelier.api.routes import reponse_archive
from atelier.services import Atelier

routeur = APIRouter()


def _atelier(requete: Request) -> Atelier:
    return requete.app.state.atelier


# ── Ce que l'écran envoie ────────────────────────────────────────────────────


class CorpsNom(BaseModel):
    nom: str = Field(min_length=1)
    projet: str | None = None


class CorpsProjetCourant(BaseModel):
    """`None` ouvre « sans projet » — la vue de ce qu'une suppression de projet
    a détaché. Ce n'est pas l'absence de choix, c'en est un."""

    projet: str | None = None


class CorpsSelection(BaseModel):
    """Une sélection. **Un seul asset est une sélection d'un** : la grille sait
    sélectionner en multiple (US-32), donc chaque geste de jugement s'écrit une
    fois et vaut pour un nombre quelconque."""

    identifiants: list[str] = Field(min_length=1)


class CorpsRangement(CorpsSelection):
    projet: str | None = None
    collection: str | None = None


class CorpsFavori(CorpsSelection):
    favori: bool = True


class CorpsExport(CorpsSelection):
    """**Le seul corps de sélection qui accepte le vide**, et c'est voulu.

    `CorpsSelection` exige au moins un identifiant : une sélection vide y serait
    refusée par la validation, en anglais et en 422. Or « l'export d'une
    sélection vide » est nommément un grisé du produit (`docs/design-motifs.md` § Le
    grisé porte sa raison, US-77) : le refus doit être une phrase française, pas
    un rapport de schéma. Le service tranche, et il le dit.
    """

    identifiants: list[str] = Field(default_factory=list)


# ── L'arbre et sa reconstruction ─────────────────────────────────────────────


@routeur.get("/library")
async def arbre(requete: Request) -> dict[str, Any]:
    """L'arbre : projets, collections, comptes et totaux.

    Les comptes viennent d'ici et jamais de l'écran — une somme faite dans le
    navigateur sur ce qu'il a en mémoire dirait un chiffre faux dès que la
    bibliothèque dépasse ce que la grille sert.
    """
    return _atelier(requete).bibliotheque.arbre()


@routeur.post("/library/rebuild")
async def reconstruire(requete: Request) -> dict[str, Any]:
    """Relit `donnees/` et repose l'index (US-40).

    Le geste existe pour être **exercé** : l'invariant « les fichiers font foi »
    ne vaut que si on peut le vérifier sans aller effacer un fichier à la main.
    Il se produit aussi tout seul au démarrage, quand l'index a disparu — et
    c'est ce chemin-là que le critère d'acceptation emprunte.
    """
    atelier = _atelier(requete)
    compte = atelier.bibliotheque.reconstruire()
    atelier.bibliotheque.ouvrir()
    return {"reconstruit": compte, "bibliotheque": atelier.bibliotheque.arbre()}


@routeur.get("/journal")
async def journal(
    requete: Request,
    projet: str | None = Query(None),
    sans_projet: bool = Query(False),
    limite: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    """Le journal d'un projet : ses appels, **ratés compris** (US-24).

    C'est ici que vit ce qui n'entre jamais dans la bibliothèque. Un appel qui a
    échoué a coûté de l'argent et n'a produit aucune image : le montrer dans la
    grille salirait ce qu'on peut réutiliser (US-23), le taire empêcherait
    d'expliquer une facture.
    """
    bibliotheque = _atelier(requete).bibliotheque
    if projet is None and not sans_projet:
        projet = bibliotheque.courant
    return bibliotheque.journal(None if sans_projet else projet, limite)


@routeur.get("/spending")
async def depenses(
    requete: Request,
    limite: int = Query(500, ge=1, le=2000),
) -> dict[str, Any]:
    """Tout ce que l'atelier a dépensé, et ce que chaque appel a donné (E18).

    Le journal ci-dessus reste, et il répond à une autre question : *qu'est-ce
    qui a raté dans ce projet-ci*. Celui-ci répond à *où est passé l'argent*, sur
    l'atelier entier, et c'est la seule chose qu'on vient y chercher.
    """
    return _atelier(requete).bibliotheque.depenses(limite)


# ── Projets et collections ───────────────────────────────────────────────────


@routeur.post("/projects", status_code=201)
async def creer_projet(requete: Request, corps: CorpsNom) -> dict[str, Any]:
    """Un vrai projet, quand on en ressent le besoin et pas avant (US-5).

    Il s'ouvre aussitôt : personne ne crée un projet pour ne pas y travailler.
    """
    atelier = _atelier(requete)
    projet = atelier.bibliotheque.creer_projet(corps.nom)
    return {"projet": projet.en_json(), "bibliotheque": atelier.bibliotheque.arbre()}


@routeur.put("/projects/current")
async def ouvrir_projet(requete: Request, corps: CorpsProjetCourant) -> dict[str, Any]:
    """Changer de projet. Ce qui sortira ensuite y entrera de lui-même."""
    atelier = _atelier(requete)
    atelier.bibliotheque.choisir(corps.projet)
    return atelier.bibliotheque.arbre()


@routeur.put("/projects/{identifiant}")
async def renommer_projet(
    requete: Request, identifiant: str, corps: CorpsNom
) -> dict[str, Any]:
    """Le nom change, **l'identifiant jamais** (E8, étape 1).

    C'est ce qui permet à l'assistant de *renommer* le « Bac à sable » plutôt
    que d'en créer un second : sur une machine neuve, le premier lancement
    s'ouvre sur un jeu qui existe déjà, et rien n'est exigé pour commencer.
    """
    atelier = _atelier(requete)
    projet = atelier.bibliotheque.renommer_projet(identifiant, corps.nom)
    return {"projet": projet.en_json(), "bibliotheque": atelier.bibliotheque.arbre()}


@routeur.delete("/projects/{identifiant}")
async def supprimer_projet(requete: Request, identifiant: str) -> dict[str, Any]:
    """Détache, ne détruit pas (US-30).

    Le nombre d'assets concernés est **déjà** dans l'arbre : l'écran l'annonce
    avant de demander confirmation, et la réponse le redonne pour que le
    bandeau dise ce qui vient de se passer plutôt que ce qui allait se passer.
    """
    atelier = _atelier(requete)
    compte = atelier.bibliotheque.supprimer_projet(identifiant)
    return {**compte, "bibliotheque": atelier.bibliotheque.arbre()}


@routeur.post("/collections", status_code=201)
async def creer_collection(requete: Request, corps: CorpsNom) -> dict[str, Any]:
    atelier = _atelier(requete)
    collection = atelier.bibliotheque.creer_collection(corps.nom, corps.projet)
    return {
        "collection": collection.en_json(),
        "bibliotheque": atelier.bibliotheque.arbre(),
    }


@routeur.delete("/collections/{identifiant}")
async def supprimer_collection(requete: Request, identifiant: str) -> dict[str, Any]:
    """La collection part, ses assets restent — dans leur projet, sans collection."""
    atelier = _atelier(requete)
    compte = atelier.bibliotheque.supprimer_collection(identifiant)
    return {**compte, "bibliotheque": atelier.bibliotheque.arbre()}


# ── Ranger, juger, jeter ─────────────────────────────────────────────────────


@routeur.put("/assets/arrangement")
async def ranger(requete: Request, corps: CorpsRangement) -> dict[str, Any]:
    """Poser une sélection dans un projet, dans une collection, ou nulle part."""
    atelier = _atelier(requete)
    ranges = atelier.bibliotheque.ranger(
        corps.identifiants, projet=corps.projet, collection=corps.collection
    )
    return {
        "assets": [a.en_json() for a in ranges],
        "bibliotheque": atelier.bibliotheque.arbre(),
    }


@routeur.put("/assets/favorite")
async def marquer_favori(requete: Request, corps: CorpsFavori) -> dict[str, Any]:
    """La seule marque que l'auteur pose lui-même (US-26) — d'où sa forme, un
    coin plein, quand tout ce que le système constate est un mot."""
    marques = _atelier(requete).bibliotheque.marquer_favori(
        corps.identifiants, corps.favori
    )
    return {"assets": [a.en_json() for a in marques]}


@routeur.post("/assets/delete")
async def supprimer_assets(requete: Request, corps: CorpsSelection) -> dict[str, Any]:
    """Sort de la bibliothèque tout de suite, s'efface après le délai (US-27).

    **Jamais de cascade** : les enfants restent, chacun marqué « parent
    supprimé » (US-28, US-29). La réponse porte l'échéance — c'est elle que le
    bandeau d'annulation décompte.
    """
    return _atelier(requete).bibliotheque.supprimer(corps.identifiants)


@routeur.post("/assets/restore")
async def annuler_suppression(requete: Request, corps: CorpsSelection) -> dict[str, Any]:
    """L'annulation courte. Refusée au-delà du délai, en le disant."""
    rendus = _atelier(requete).bibliotheque.annuler_suppression(corps.identifiants)
    return {"assets": [a.en_json() for a in rendus]}


# ── Sortir de l'atelier ──────────────────────────────────────────────────────


@routeur.post("/exports")
async def exporter(requete: Request, corps: CorpsExport) -> Response:
    """Une sélection sort en une archive, avec son descriptif (US-76).

    `POST` et non `GET` : une sélection de deux cents identifiants ne tient pas
    dans une adresse, et l'archive n'est pas une ressource qu'on pourrait aller
    rechercher — elle est fabriquée pour ce lot-là, à cet instant-là.

    **Aucun réseau, aucun centime.** Le service n'importe pas de fournisseur ;
    ce qui part est déjà sur le disque.
    """
    return reponse_archive(_atelier(requete).export.exporter(corps.identifiants))


@routeur.get("/assets/{identifiant}/lineage")
async def filiation(requete: Request, identifiant: str) -> dict[str, Any]:
    """D'où vient cet asset, et ce qui en descend (US-38).

    Une filiation incomplète reste une filiation : un parent supprimé garde son
    identifiant et se dit supprimé, plutôt que de disparaître en emportant les
    maillons qui restent.
    """
    return _atelier(requete).bibliotheque.filiation(identifiant)
