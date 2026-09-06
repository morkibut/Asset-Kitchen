# -*- coding: utf-8 -*-
"""Ranger un miroir dans une direction — la troisième fabrique du dépôt (B1).

**Ce que la tranche répare se compte en dollars.** Un personnage vu de dessus se
dessine dans quatre directions ; celui qui marche vers l'ouest est le miroir
exact de celui qui marche vers l'est, au pixel près. Le produit n'avait aucune
façon de le dire : les deux se payaient, et le second ne revenait jamais tout à
fait comme le premier — une génération ne rend pas deux fois la même image.

**Une image retournée est un asset entier, filié sur celle d'où elle vient**, et
c'est la même décision qu'une découpe (`atelier/services/decoupe.py`, T5) prise
pour la même raison : supprimer l'image de départ laisse le miroir en place, ce
qu'un simple rectangle — ou ici un simple drapeau — ne permettrait pas.

**Son brut est celui de son parent, copié tel quel, et c'est le cœur du
dessin.** Ce qui la retourne est sa *recette*, pas ses octets : la place
`retournement` y est remplie, et rien d'autre ne change. C'est ce qui rend vraie
la troisième décision de la tranche — *aucun drapeau ne dit « ceci est un
miroir », c'est la recette qui le dit* — sans avoir à la tenir : retirer la place
à la table rend l'image telle qu'elle est arrivée, et l'étiquette suit toute
seule. Écrire le miroir dans les octets aurait figé dans le fichier ce que la
recette doit rester libre de défaire, et aurait demandé un champ de plus sur
l'`Asset` pour dire ce qu'on avait fait.

**Ce service ne demande jamais le fournisseur**, et ça se lit dans ses imports :
retourner une image déjà là ne coûte rien et marche réseau coupé.
"""

from __future__ import annotations

import time
from dataclasses import replace
from typing import Any

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.direction import direction_au_miroir
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.recette import RETOURNEMENT, Recette, Retournement
from atelier.image import extension, mesurer
from atelier.services.assets import AssetInconnu, ServiceAssets
from atelier.services.bibliotheque import ServiceBibliotheque
# **Le même plancher de rang que les découpes**, importé plutôt que recopié.
# Deux fabriques qui numérotent dans la même génération doivent partir du même
# nombre : un miroir posé sur une planche déjà découpée qui repartirait de zéro
# tomberait sur le rang d'un emplacement et effacerait ses fichiers.
from atelier.services.decoupe import RANG_DECOUPE
from atelier.services.evenements import Diffusion


class MiroirRefuse(ErreurAtelier):
    """Le retournement demandé n'a pas de case où se ranger, et on dit pourquoi."""

    code = "miroir_refuse"


class ServiceMiroir:
    """Une image, son miroir, et la case que celui-ci vient remplir.

    Monté au même rang que le slicer, et pour la même raison : il ne fabrique que
    ce que les assets et la bibliothèque savent déjà écrire et ranger. Ni
    catalogue, ni univers, ni fournisseur.
    """

    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        assets: ServiceAssets,
        bibliotheque: ServiceBibliotheque,
        diffusion: Diffusion | None = None,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._assets = assets
        self._bibliotheque = bibliotheque
        self._diffusion = diffusion or Diffusion()

    # ── Retourner ────────────────────────────────────────────────────────────

    def retourner(
        self, identifiant: str, direction: str | None = None
    ) -> dict[str, Any]:
        """Le geste de la tranche : *« range ce miroir dans cette direction-là »*.

        `direction` est facultative. Sans elle, le service prend celle que
        `direction_au_miroir` déduit du parent — c'est une proposition, jamais
        une déduction imposée : dès que l'auteur en désigne une, c'est la sienne
        qui vaut, y compris un nom que la table du domaine ne connaît pas. Les
        directions d'un projet sont libres, et l'écran a déjà eu le dernier mot.

        **Le refus a une seule cause, et elle est écrite en clair** : il n'y a
        pas de case où ranger l'image. Soit la direction du parent est inconnue
        de la table — un nom que l'auteur a choisi lui-même —, soit le miroir la
        rend telle quelle, ce qui est le cas de `sud` et de `nord` : un miroir
        gauche-droite ne montre pas le dos d'un personnage. Fabriquer quand
        même produirait une seconde image dans une case déjà prise, et le compte
        de la matrice dirait alors qu'une direction est faite deux fois pendant
        qu'une autre manque.
        """
        parent = self._exiger(identifiant)
        rangee = self._ou_ranger(parent, direction)

        # **Les octets du parent, tels quels.** Ce qui retourne l'image est la
        # place `retournement` de la recette ci-dessous, pas ce fichier-ci — voir
        # l'en-tête du module. Ils sont recopiés plutôt que partagés parce qu'un
        # asset possède son brut : supprimer le parent efface `<rang>-*`, brut
        # compris, et un miroir qui pointerait sur le fichier du parent
        # deviendrait une image sans octets.
        octets = self._fichiers.lire(parent.brut)
        mesure = mesurer(octets)
        rang = self._premier_rang_libre(parent.generation)
        chemin = self._fichiers.ecrire_brut(
            parent.generation, rang, octets, extension(mesure.type_media)
        )

        recette = _recette_retournee(parent)
        miroir = self._assets.accueillir(
            Asset(
                identifiant=identifiant_de(parent.generation, rang),
                generation=parent.generation,
                rang=rang,
                brut=chemin,
                largeur=mesure.largeur,
                hauteur=mesure.hauteur,
                type_media=mesure.type_media,
                # **Le label suit la recette, il ne la devance pas.** Deux
                # miroirs rendent l'image de départ, et la place se retire ;
                # accoler « miroir » sans condition aurait nommé miroir une
                # image qui n'en est pas une, pendant que l'étiquette de la
                # tuile — qui lit la recette, elle — aurait dit tout autre
                # chose. Un nom et une étiquette qui se démentent sur la même
                # tuile sont pires que l'un des deux.
                label=_label(parent.label, parent.direction, rangee, recette.miroir),
                recette=recette,
                # **L'épingle voyage avec la recette qu'elle protège**, comme
                # pour une découpe : hériter d'une recette réglée à la main sans
                # hériter de l'épingle livrerait un miroir qu'un balayage de
                # palette écraserait au premier passage.
                epingle=parent.epingle,
                # **Un miroir n'a rien coûté.** L'argent a été dépensé une fois,
                # pour l'image de départ, et la filiation y mène. Lui attribuer
                # une part du prix inventerait un chiffre que personne n'a
                # facturé — c'est le raisonnement de la découpe, mot pour mot.
                # C'est aussi la moitié de l'étiquette *miroir · gratuit ·
                # instantané* : l'autre moitié est `recette.miroir`.
                consomme=0.0,
                # **L'unité de l'appel, avec une quantité nulle** (F2) : zéro
                # dollar et zéro jeton ne se lisent pas pareil — le premier
                # s'écrit « $0,0000 », le second « gratuit ».
                unite=parent.unite,
                # **Un miroir appartient à qui a demandé l'image** (US-39).
                # Retourner n'est pas commander : c'est le même appel, poursuivi.
                provenance=parent.provenance,
                # **Et du même modèle**, pour la raison exacte de la provenance.
                # Un miroir sans modèle serait la seule image de la bibliothèque
                # à ne pas savoir dire qui l'a dessinée.
                modele=parent.modele,
                # **C'est la même chose, vue de l'autre côté.** Le personnage, la
                # pose et la pièce ne changent pas ; seule la direction change,
                # et c'est tout l'objet du geste.
                personnage=parent.personnage,
                pose=parent.pose,
                direction=rangee,
                piece=parent.piece,
                projet=parent.projet,
                collection=parent.collection,
                parent=parent.identifiant,
                # **Datée de maintenant, pas du lot du parent.** Ce qu'on vient
                # de fabriquer se voit en tête de grille ; datée du lot, l'image
                # retournée d'une planche ancienne atterrirait au fond, invisible
                # au moment précis où on la regarde.
                cree_le=time.time(),
            )
        )

        # L'arbre compte les assets par projet et par collection : un de plus
        # change ces comptes, et personne d'autre ne les recalcule.
        self._diffusion.publier("bibliotheque", self._bibliotheque.arbre())
        return {"parent": parent.identifiant, "miroir": miroir.en_json()}

    def propose(self, identifiant: str) -> dict[str, Any]:
        """Ce que l'écran a besoin de savoir **avant** de proposer le geste.

        La direction proposée, et la raison quand il n'y en a pas. L'écran grise
        alors le geste et écrit la phrase telle quelle : *« un miroir
        gauche-droite ne montre pas le dos d'un personnage »* doit se lire avant
        le clic, pas après — un refus qui arrive après coup est un refus qui a
        fait espérer.

        **Rien n'est créé, rien n'est écrit** : c'est la même coupure que le
        slicer, où proposer et découper sont deux gestes.
        """
        parent = self._exiger(identifiant)
        proposee = direction_au_miroir(parent.direction)
        return {
            "asset": parent.identifiant,
            "direction": parent.direction,
            "propose": None if proposee == parent.direction else proposee,
            "raison": _raison(parent.direction, proposee),
        }

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _ou_ranger(self, parent: Asset, direction: str | None) -> str | None:
        """La direction du miroir, ou un refus qui nomme ce qui manque."""
        designee = (direction or "").strip()
        if designee:
            self._exiger_la_case_libre(parent, designee)
            return designee
        proposee = direction_au_miroir(parent.direction)
        raison = _raison(parent.direction, proposee)
        if raison is not None:
            raise MiroirRefuse(raison)
        self._exiger_la_case_libre(parent, proposee)
        return proposee

    def _exiger_la_case_libre(self, parent: Asset, direction: str | None) -> None:
        """**La règle que le refus invoquait sans jamais l'appliquer.**

        L'en-tête de `retourner` dit pourquoi on refuse une direction que le
        miroir rend telle quelle : *fabriquer quand même produirait une seconde
        image dans une case déjà prise, et le compte de la matrice dirait alors
        qu'une direction est faite deux fois pendant qu'une autre manque.* Cette
        raison-là ne dépendait pas de la direction d'arrivée — elle dépend de ce
        qui est déjà rangé —, et elle n'était vérifiée nulle part.

        **Deux chemins l'enfreignaient, et le second est à deux clics.** Une
        direction tapée à la main était acceptée occupée ou non ; et depuis la
        table, l'écran bascule sur le miroir après le geste, redemande une
        proposition pour lui, obtient la case du parent, et rallume le bouton.
        Un clic de plus écrivait une troisième image là où il y en avait déjà
        une. La matrice, elle, était protégée par accident : elle ne montre le
        geste que sur une case vide.

        **Rien à vérifier pour une image qui n'a pas de case.** La bibliothèque
        est faite d'images qui n'appartiennent à personne : sans personnage ni
        pose, il n'y a pas de matrice où compter deux fois, et le miroir est un
        rangement libre comme un autre.
        """
        if not (parent.personnage and parent.pose and direction):
            return
        occupee = [
            autre
            for autre in self._base.assets_du_personnage(parent.personnage)
            if autre.pose == parent.pose
            and autre.direction == direction
            and autre.piece == parent.piece
        ]
        if occupee:
            raise MiroirRefuse(
                f"« {direction} » porte déjà une image pour cette pose — "
                "le miroir remplirait deux fois la même case"
            )

    def _exiger(self, identifiant: str) -> Asset:
        asset = self._assets.lire(identifiant)
        if asset is None:
            raise AssetInconnu(identifiant)
        return asset

    def _premier_rang_libre(self, generation: str) -> int:
        """Le rang du prochain fabriqué, au-dessus de tout ce qui existe déjà.

        Le calcul est celui du slicer, et il compte les mêmes choses : deux
        assets d'un même rang partageraient leurs fichiers `<rang>-brut` et
        `<rang>-asset.json`, et le second effacerait le premier sans rien dire.
        """
        pris = self._base.rangs_de_generation(generation)
        objet = self._base.lire(generation)
        if objet is not None:
            pris += [e.rang for e in objet.emplacements]
        return max([RANG_DECOUPE - 1, *pris]) + 1


def _raison(depart: str | None, arrivee: str | None) -> str | None:
    """Pourquoi il n'y a pas de case à remplir — ou rien, s'il y en a une."""
    if not depart:
        return (
            "cette image ne dit pas dans quelle direction elle regarde — "
            "désigne la case où ranger le miroir"
        )
    if arrivee is None:
        return (
            f"« {depart} » n'a pas de direction opposée connue — "
            "désigne la case où ranger le miroir"
        )
    if arrivee == depart:
        return (
            f"un miroir gauche-droite ne change rien à « {depart} » — "
            "cette direction-là se génère"
        )
    return None


def _label(
    parent: str, depart: str | None, direction: str | None, miroir: bool
) -> str:
    """« goblin archer · miroir gauche » — d'où ça vient, et où ça va.

    Le nom du parent est raccourci plutôt que la queue : c'est la queue qui
    distingue le miroir de l'image dont il vient dans la grille, et un label
    tronqué à cet endroit-là les rendrait identiques.

    **`miroir` dit ce que la recette a décidé.** Retourner un miroir le
    redresse — la place se retire —, et l'image qui en sort n'est pas un
    miroir : elle porte alors sa seule direction, comme n'importe quelle image
    rangée dans une case.

    **La queue se remplace, elle ne s'empile pas.** Retourner un miroir donnait
    « le pèlerin · miroir ouest · est » : deux directions dans un nom, dont la
    première est fausse. On ne retire que la queue **que cette fonction a
    écrite** — celle qui nomme la direction du parent, avec ou sans le mot —,
    jamais un point médian que l'auteur aurait tapé lui-même.
    """
    base = (parent or "sans titre").strip()
    for ancienne in (f" · miroir {depart}", f" · {depart}") if depart else ():
        if base.endswith(ancienne):
            base = base[: -len(ancienne)].rstrip()
            break
    base = base[:48].rstrip()
    queue = "miroir" if miroir else ""
    queue = f"{queue} {direction}".strip() if direction else queue
    return f"{base} · {queue}" if queue else base


def _recette_retournee(parent: Asset) -> Recette:
    """Celle du parent, **plus la place du retournement** — et rien d'autre.

    C'est elle, et elle seule, qui fait de l'image neuve un miroir : aucun champ
    de l'`Asset` ne le dit, et il n'y a donc nulle part un drapeau à tenir
    d'accord avec le disque (`Recette.miroir`).

    **Ce que le parent a décidé s'applique à ce qui en sort** — détourage, case,
    palette : le miroir d'une image traitée ressort traité pareil, et il le doit,
    puisque c'est la même image vue de l'autre côté.

    **Sur un miroir, la place se retire au lieu de se poser.** Le geste est un
    interrupteur, pas un empilement : deux miroirs gauche-droite rendent l'image
    de départ, et c'est ce que les pixels feront quoi qu'on écrive ici. La
    remplir une seconde fois aurait produit une recette identique à celle du
    parent — donc **la même image rangée dans la case d'en face**, un pèlerin
    qui marche vers la gauche affiché comme allant vers la droite. Le seul
    endroit où ça se voit est celui-ci ; le corriger ailleurs demanderait de
    savoir combien de miroirs sont empilés, ce que personne ne compte.

    Le retournement est **réveillé** au passage quand il se pose. Le laisser
    endormi fabriquerait une image identique à son parent et une étiquette qui
    dirait « miroir » sur rien.
    """
    recette = parent.recette
    reveillee = tuple(p for p in recette.veille if p != RETOURNEMENT)
    if recette.miroir:
        return replace(recette, retournement=None, veille=reveillee)
    return replace(recette, retournement=Retournement(), veille=reveillee)
