# -*- coding: utf-8 -*-
"""TS2 · Un sujet du Codex naît d'une carte de la toile, en un geste.

**Un geste qui compose, et rien de neuf dessous** : créer le sujet
(`ServiceProduction.creer_personnage`), faire entrer l'image
(`ServiceGenerations.importer`, le seul endroit du dépôt qui fasse entrer une
image), la rattacher au sujet (`designer`, sans case), désigner la carte comme
concept art (`regler_personnage`) et poser le portrait
(`poser_image_de_reference`). L'écran et l'agent appellent **cette** méthode
(*T7*) — aucun des deux ne recompose les cinq gestes à sa façon.

Monté après les générations, parce que la production ne les connaît pas : c'est
le même rang que les autres services qui prennent l'atelier entier.

Rien ici n'appelle un fournisseur, rien ne coûte : la carte est déjà sur le
disque, et sa copie aussi, une fois faite.
"""

from __future__ import annotations

from pathlib import PurePosixPath
from typing import Any
from urllib.parse import urlparse

from atelier.domaine.carte import FAMILLES, IMAGE, PERSONNAGES, PRETE, TOUS, Carte
from atelier.domaine.generation import AUTEUR
from atelier.services.univers import CarteRefusee

NOM_PAR_DEFAUT = "Sujet de la toile"


def nom_de_la_carte(carte: Carte) -> str:
    """Le nom qu'une carte propose : la première ligne de sa note, sinon le nom
    tiré de sa provenance (le fichier ou l'adresse), sinon un nom neutre.

    Une carte n'a pas de champ « nom » : c'est la note que l'auteur écrit
    dessus qui en tient lieu, et la provenance qui nomme ce qu'on a collé.
    """
    for ligne in (carte.note or "").splitlines():
        if ligne.strip():
            return ligne.strip()[:80]
    source = (carte.source or "").strip()
    if source and ":" in source and not source.startswith(("http:", "https:")):
        # `asset:…`, `clip:…` : un identifiant, pas un nom.
        source = ""
    if source:
        chemin = urlparse(source).path if "://" in source else source
        tige = PurePosixPath(chemin.replace("\\", "/")).stem
        propre = tige.replace("_", " ").replace("-", " ").strip()
        if propre:
            return propre[:80]
    return NOM_PAR_DEFAUT


def famille_de_la_carte(carte: Carte) -> str:
    """La famille posée par « promouvoir », si elle désigne un rang de sujets ;
    `personnages` sinon. `tous` n'est pas une famille de sujet : c'est la
    planche non figurative qui accompagne tout."""
    return carte.famille if carte.famille in FAMILLES and carte.famille != TOUS else PERSONNAGES


class ServiceSujetDepuisCarte:
    def __init__(self, atelier: Any) -> None:
        self.a = atelier

    def sujet_de_la_carte(self, projet: str, carte: str) -> dict[str, str] | None:
        """Le sujet du jeu dont cette carte est **déjà** le concept art, ou rien."""
        for personnage in self.a.production.personnages(projet):
            if carte in personnage.concept_arts:
                return {"identifiant": personnage.identifiant, "nom": personnage.nom}
        return None

    def creer(
        self,
        projet: str,
        carte: str,
        *,
        nom: str | None = None,
        description: str = "",
        famille: str | None = None,
        provenance: str = AUTEUR,
    ) -> dict[str, Any]:
        """Un sujet naît de cette carte : nom, famille, concept art, portrait.

        **Règle de la copie (tranché en TS2)** : l'image de la carte entre
        **toujours** en bibliothèque comme une copie neuve, importée pour ce
        sujet et marquée d'où elle vient (`origine: {carte, projet}` dans sa
        génération) — un asset qui porte déjà les mêmes octets a son histoire à
        lui (un autre sujet, un rendu posé sur la toile, un import du jeu) et le
        rattacher le déplacerait en silence ; la copie, elle, n'est pas un
        doublon silencieux, puisqu'elle nomme sa carte.

        **Une carte déjà concept art d'un sujet ne crée rien** : la réponse porte
        `deja` (identifiant et nom de ce sujet) et `personnage` nul — la forme du
        doublon de `coller_image` et d'`importer`, parce que ce n'est pas un
        échec : l'écran ouvre ce sujet au lieu d'en faire un second.

        Tout se vérifie **avant** d'écrire : une carte inconnue, sans image ou
        dont le fichier a disparu ne laisse pas un sujet à moitié fait.
        """
        objet = self.a.univers.carte(projet, carte)  # CarteInconnue → 404
        if objet.genre != IMAGE or objet.statut != PRETE or not objet.fichier:
            raise CarteRefusee(
                "cette carte n'a pas d'image prête — un sujet naît d'une carte image"
            )
        deja = self.sujet_de_la_carte(projet, carte)
        if deja is not None:
            return {"personnage": None, "asset": None, "deja": deja}
        octets, _ = self.a.univers.octets(projet, carte)

        propre = (nom or "").strip()
        if not propre:
            propre = self._nom_libre(projet, nom_de_la_carte(objet))
        famille_visee = (famille or "").strip() or famille_de_la_carte(objet)
        if famille_visee not in FAMILLES or famille_visee == TOUS:
            raise CarteRefusee(
                f"aucune famille « {famille_visee} » — les familles sont : "
                + ", ".join(f for f in FAMILLES if f != TOUS)
            )

        production = self.a.production
        personnage = production.creer_personnage(
            projet, propre, description, famille=famille_visee
        )
        entre = self.a.generations.importer(
            octets,
            f"{personnage.nom} · carte de la toile",
            projet=projet,
            provenance=provenance,
            forcer=True,
            # **Elle reçoit la recette du jeu** (TS4) : la carte, elle, reste
            # brute — c'est justement ce que la toile promet —, mais devenir le
            # concept art d'un sujet est le geste qui la fait entrer dans le
            # jeu. `traiter=True` ici, à la différence du défaut d'un import
            # ordinaire (US-170) : un import générique ne sait pas encore ce
            # que l'auteur en fera, ce geste-ci le sait déjà.
            traiter=True,
            origine={"carte": carte, "projet": projet},
        )
        asset = entre["asset"]["identifiant"]
        production.designer(
            asset, projet=projet, personnage=personnage.identifiant, pose=None
        )
        production.regler_personnage(
            projet,
            personnage.identifiant,
            concept_arts=[*personnage.concept_arts, carte],
        )
        personnage = production.poser_image_de_reference(
            projet, personnage.identifiant, asset
        )
        return {
            "personnage": production.en_charge(projet, personnage),
            "asset": self.a.assets.lire(asset).en_json(),
            "deja": None,
        }

    def _nom_libre(self, projet: str, voulu: str) -> str:
        """Le nom proposé, ou le même suffixé s'il est déjà pris — un nom tiré de
        la carte n'est pas un choix de l'auteur, il ne doit pas faire refuser."""
        pris = {p.nom.casefold() for p in self.a.production.personnages(projet)}
        if voulu.casefold() not in pris:
            return voulu
        rang = 2
        while f"{voulu} {rang}".casefold() in pris:
            rang += 1
        return f"{voulu} {rang}"
