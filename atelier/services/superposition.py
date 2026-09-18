# -*- coding: utf-8 -*-
"""La seconde fabrique — deux images, et une troisième qui en sort.

**Une fabrique, pas une table.** Une table règle une image et rend la même ;
celle-ci en prend deux et en fabrique une troisième. C'est ce qui la range à
droite du trait de la barre, avec le découpage, et c'est ce qui l'a sortie de la
recette : une place de recette ne nomme jamais un second asset
(`docs/ARCHITECTURE.md` §4 ; `docs/archive/v21-arbitrages.md` A-18).

**Ce service n'appelle jamais le fournisseur, et c'est tout son intérêt.** Les
deux images sont déjà payées ; changer le calage, le seuil ou le rectangle coûte
des millisecondes et pas un centime. Avant, un recalage raté n'avait aucun
recours : le calque était perdu et il fallait relancer une génération.

**Il lit les images *rendues*, et il ne détoure rien de lui-même.** Une image qui
revient du modèle est opaque de bord à bord, et un calque tiré d'un dessus sans
alpha emporte tout le fond. Détourer en douce le réparerait sans le dire, et
l'auteur ne saurait jamais ce que le produit a décidé à sa place : le service
**constate** — `sans_alpha` le dit — et l'écran propose le geste.
"""

from __future__ import annotations

import base64
import io
import time
from dataclasses import replace
from typing import Any, Iterable

import numpy as np
from PIL import Image

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.equipement import MesuresCalque
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.recette import Recette
from atelier.domaine.superposition import (
    APLAT,
    CALQUE,
    ECHELLE_MAX,
    ECHELLE_MIN,
    SORTIES,
    ReglagesGardes,
    Superposition,
)
from atelier.image import mesurer, rendre_en_png
from atelier.image.calque import (
    Retour,
    aligner,
    cadrer,
    mesurer_calque,
    proposer,
    superposer,
)
from atelier.services.evenements import Diffusion
from atelier.services.rangs import rang_libre


class SuperpositionRefusee(ErreurAtelier):
    """Un réglage de la superposition n'est pas applicable, et on dit lequel."""

    code = "superposition_refusee"


def en_rgba(octets: bytes) -> np.ndarray:
    """Une image, telle quelle.

    **Aucun détourage implicite**, contrairement à `calque.avec_alpha` : là-bas
    l'atelier compare ce qu'il a lui-même envoyé et sait qu'un corps importé
    n'a pas d'alpha ; ici, l'auteur choisit ses deux images et c'est à lui de
    voir qu'il en manque un. Détourer en silence rendrait un calque juste sans
    jamais dire pourquoi le précédent était faux.
    """
    with Image.open(io.BytesIO(octets)) as image:
        return np.asarray(image.convert("RGBA")).copy()


class ServiceSuperposition:
    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        assets: Any,
        bibliotheque: Any,
        diffusion: Diffusion | None = None,
        equipement: Any = None,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._assets = assets
        self._bibliotheque = bibliotheque
        self._diffusion = diffusion or Diffusion()
        # **Pour une seule question, et c'est pourquoi il arrive en dernier**
        # (G16) : *quelle était cette case avant que l'atelier ne la cale ?*
        # L'équipement est le seul à savoir la recalculer, et la superposition
        # est le seul écran qui ait besoin de la réponse. Facultatif — un
        # atelier composé sans lui superpose exactement comme avant.
        self._equipement = equipement

    # ── Ce que l'écran a besoin de savoir avant de caler ──────────────────────

    def ouvrir(self, dessus: str, dessous: str | None = None) -> dict[str, Any]:
        """L'état de départ de l'outil, en un appel.

        **Le préremplissage vient de ce qui est déjà là**, jamais d'une
        supposition : l'image du dessous est celle que la superposition qui a
        fabriqué le dessus désignait, ou celle qu'on nomme. Et les réglages
        gardés sur cette image-là reviennent avec leur provenance écrite, comme
        tout ce que le produit devine.
        """
        haut = self._exiger(dessus)
        # Rouvrir un résultat reprend sa fabrication exacte. Le PNG extrait
        # n'est pas une nouvelle image équipée : les deux sources et le masque
        # sont encore disponibles dans sa fiche non destructive.
        if dessous is None and haut.superposition is not None:
            pose = haut.superposition
            source = self._exiger(pose.dessus)
            bas = self._exiger(pose.dessous)
            return {
                "dessus": source.en_json(), "dessous": bas.en_json(),
                "pose": pose.en_json(), "repris": None,
                "arrivee_possible": self._arrivee_possible(source),
                **self._etat_du_detourage(source, bas),
            }
        nom_bas = dessous or (
            haut.superposition.dessous if haut.superposition is not None else ""
        )
        # **Un calque désigne déjà son corps, et c'est un préremplissage aussi
        # légitime que l'autre** (G16). Sans cette ligne, ouvrir la table sur un
        # vêtement laissait le dessous vide : l'auteur devait retrouver
        # lui-même, parmi les sœurs, le corps que l'atelier avait employé pour
        # le fabriquer. Le principe ne bouge pas — *le préremplissage vient de
        # ce qui est déjà là* —, il y avait simplement un second endroit où
        # c'était déjà là.
        if not nom_bas and haut.recette.difference is not None:
            nom_bas = haut.recette.difference.base or ""
        bas = self._assets.lire(nom_bas) if nom_bas else None

        gardes = bas.reglages_superposition if bas is not None else None
        pose = (
            gardes.sur(haut.identifiant, bas.identifiant)
            if gardes is not None and bas is not None
            else Superposition(dessus=haut.identifiant, dessous=nom_bas)
        )
        # **Sur un calque, on part de la case arrivée par défaut** : refaire un
        # calage à la main en partant du calque reviendrait à repartir du
        # résultat qu'on veut défaire. L'écran montre le choix et laisse le
        # défaire ; il ne le montre pas du tout quand il n'y a rien à proposer.
        arrivee = self._arrivee_possible(haut)
        pose = replace(pose, dessus_arrivee=arrivee)
        return {
            "dessus": haut.en_json(),
            "dessous": bas.en_json() if bas is not None else None,
            "pose": pose.en_json(),
            "repris": gardes.en_json() if gardes is not None else None,
            "arrivee_possible": arrivee,
            **self._etat_du_detourage(haut, bas),
        }

    def _arrivee_possible(self, haut: Asset) -> bool:
        """Le dessus a-t-il une case arrivée qu'on saurait retrouver ? (G16)"""
        if self._equipement is None:
            return False
        return bool(self._equipement.a_une_case_arrivee(haut.identifiant))

    def _etat_du_detourage(self, haut: Asset, bas: Asset | None) -> dict[str, Any]:
        """« Avant de caler » — l'état des passes des deux images.

        **L'alerte nomme la conséquence et propose le geste ; elle ne refuse
        pas.** Une image qui remplit légitimement son cadre existe, et l'atelier
        n'a pas les moyens de savoir laquelle il a sous les yeux.
        """
        # **Ce qui agit, et non ce qui est écrit** (U10) : une passe masquée
        # n'ouvre aucun alpha, et l'alerte parle de ce que le calque va trouver.
        vives_bas = bas.recette.passes_vives() if bas is not None else ()
        vives_haut = haut.recette.passes_vives()
        return {
            "passes_dessus": len(vives_haut),
            "passes_dessous": len(vives_bas),
            # Sans alpha sur le dessus, le calque prendrait tout le fond : le
            # dessous est transparent partout autour du sujet, le dessus est
            # opaque partout, donc tout ce qui entoure remplit la condition.
            "sans_alpha": len(vives_haut) == 0,
        }

    def heriter(self, dessus: str, dessous: str) -> Asset:
        """Le dessus reprend les passes du dessous — le geste de l'alerte.

        **Même sujet, même fond plat, même modèle** : les passes qui ont détouré
        le corps détourent le corps casqué. C'est la même règle que pour une
        découpe, qui hérite de la recette de sa planche.

        Ce qu'elle pose va **dans la recette de l'image**, pas dans la
        superposition : le détourage d'une image est vrai pour elle-même — elle
        en aura besoin de toute façon pour partir dans le jeu, et personne ne
        veut la détourer deux fois.
        """
        haut = self._exiger(dessus)
        bas = self._exiger(dessous)
        if not bas.recette.passes_vives():
            raise SuperpositionRefusee(
                "l'image du dessous n'est pas détourée non plus — il n'y a rien à reprendre"
            )
        return self._assets.poser_les_places(
            haut.identifiant, replace(haut.recette, passes=bas.recette.passes)
        )

    def recaler(
        self, dessus: str, dessous: str, *, arrivee: bool = False
    ) -> dict[str, Any]:
        """La proposition de calage — trois valeurs, et rien d'autre.

        Elle ne verrouille rien et ne refuse rien. On la relance autant qu'on
        veut : elle repart de zéro, pas de l'ajustement.
        """
        haut, bas = self._paire(dessus, dessous, arrivee=arrivee)
        echelle, dy, dx, couverture = proposer(bas, haut)
        return {
            "echelle": round(float(echelle), 3),
            "dx": int(dx),
            "dy": int(dy),
            "couverture": round(float(couverture), 4),
        }

    # ── Ce qu'on voit pendant qu'on cale ─────────────────────────────────────

    def apercu(self, pose: Superposition) -> dict[str, Any]:
        """Les deux sorties et les cinq mesures, **sans rien écrire**.

        Un seul appel, trois réponses — la raison de `Retour`, appliquée ici :
        les mesurer à part demanderait un second alignement, qui pourrait tomber
        ailleurs, et l'image affichée ne serait plus celle qu'on a mesurée.

        Les images repartent en `data:` plutôt que par une adresse : un aperçu
        n'existe nulle part sur le disque, et lui donner une adresse aurait
        obligé à ranger un brouillon quelque part — donc à le nettoyer.

        **Le cadrage part avec elles** (`M1`), et pour deux raisons qui n'en
        font qu'une : l'écran a besoin de le *dire* quand le dessus a été
        ramené, et le cadre de travail a besoin de le *dessiner* pour montrer
        la même image que celle sur laquelle le calcul a été fait. Le donner
        ici, et non à l'ouverture, le tient d'accord avec la bascule *telle
        qu'arrivée* : c'est elle qui change la taille du dessus.
        """
        self._verifier(pose)
        haut, bas = self._paire(
            pose.dessus, pose.dessous, arrivee=pose.dessus_arrivee
        )
        calque, aplat = superposer(bas, haut, pose)
        return {
            "calque": _en_data(calque),
            "aplat": _en_data(aplat),
            "mesures": self._mesurer(bas, haut, pose).en_json(),
            "cadrage": cadrer(haut.shape[:2], bas.shape[:2]).en_json(),
        }

    # ── Ce qu'elle fabrique ──────────────────────────────────────────────────

    def fabriquer(
        self, pose: Superposition, sorties: Iterable[str], garder: bool = False
    ) -> dict[str, Any]:
        """Une image par sortie cochée — des assets entiers, sur le disque.

        **Le seul geste du produit dont le résultat a deux ascendants.** Ses
        pixels et son parent viennent du dessus ; le dessous est une référence,
        gardée pour que la superposition se rejoue. Elle a servi à décider ce
        qu'on garde, elle n'a donné aucun pixel — donc elle n'est pas le parent.

        **Sa recette est vide.** La superposition a travaillé sur deux images
        *rendues* ; leur réappliquer leurs recettes détourerait ce qui est déjà
        détouré.
        """
        self._verifier(pose)
        voulues = [s for s in SORTIES if s in set(sorties)]
        if not voulues:
            raise SuperpositionRefusee(
                "rien n'est coché — une superposition fabrique le calque, l'aplat, ou les deux"
            )

        haut = self._exiger(pose.dessus)
        bas = self._exiger(pose.dessous)
        pixels_haut = en_rgba(self._octets_dessus(haut, pose.dessus_arrivee))
        pixels_bas = en_rgba(self._rendu(bas))
        calque, aplat = superposer(pixels_bas, pixels_haut, pose)
        images = {CALQUE: calque, APLAT: aplat}
        mesures = self._mesurer(pixels_bas, pixels_haut, pose)

        rang = self._premier_rang_libre(haut.generation)
        maintenant = time.time()
        nees: list[Asset] = []
        for sortie in voulues:
            octets = _en_png(images[sortie])
            mesure = mesurer(octets)
            chemin = self._fichiers.ecrire_brut(haut.generation, rang, octets, ".png")
            nees.append(
                self._assets.accueillir(
                    Asset(
                        identifiant=identifiant_de(haut.generation, rang),
                        generation=haut.generation,
                        rang=rang,
                        brut=chemin,
                        largeur=mesure.largeur,
                        hauteur=mesure.hauteur,
                        type_media=mesure.type_media,
                        label=_label(haut, bas, sortie),
                        # **Vide.** Les deux images étaient déjà rendues.
                        recette=Recette(),
                        # **Rien n'a été demandé à personne.** L'argent a été
                        # dépensé deux fois — pour le corps et pour le corps
                        # habillé — et les deux filiations y mènent.
                        consomme=0.0,
                        unite=haut.unite,  # zéro, dans l'unité de l'appel (F2)
                        provenance=haut.provenance,
                        modele=haut.modele,
                        projet=haut.projet,
                        personnage=haut.personnage,
                        pose=haut.pose,
                        piece=haut.piece if sortie == CALQUE else None,
                        parent=haut.identifiant,
                        superposition=replace(pose, sortie=sortie),
                        calque=mesures if sortie == CALQUE else None,
                        cree_le=maintenant,
                    )
                )
            )
            rang += 1

        if garder:
            self._garder(bas, pose, _label(haut, bas, CALQUE))

        # L'arbre compte les assets par projet : une ou deux de plus changent ces
        # comptes, et personne d'autre ne les recalcule.
        self._diffusion.publier("bibliotheque", self._bibliotheque.arbre())
        return {"superpositions": [a.en_json() for a in nees]}

    def rejouer(self, identifiant: str, pose: Superposition) -> Asset:
        """Refaire une superposition déjà fabriquée, **à la même place**.

        Même identifiant, même rang, même fichier, même place en bibliothèque —
        et pas un centime. C'est la promesse de R5, étendue : ce qui se rejoue
        est le calcul, sur l'asset qu'il a déjà produit. Fabriquer un second
        asset à chaque correction laisserait derrière lui tous les ratés.
        """
        deja = self._exiger(identifiant)
        if deja.superposition is None:
            raise SuperpositionRefusee(
                "cette image n'est pas sortie d'une superposition — il n'y a rien à rejouer"
            )
        self._verifier(pose)
        haut, bas = self._paire(
            pose.dessus, pose.dessous, arrivee=pose.dessus_arrivee
        )
        calque, aplat = superposer(bas, haut, pose)
        sortie = deja.superposition.sortie
        octets = _en_png(calque if sortie == CALQUE else aplat)

        deja.brut = self._fichiers.ecrire_brut(
            deja.generation, deja.rang, octets, ".png"
        )
        mesure = mesurer(octets)
        deja.largeur, deja.hauteur = mesure.largeur, mesure.hauteur
        deja.type_media = mesure.type_media
        deja.superposition = replace(pose, sortie=sortie)
        if sortie == CALQUE:
            deja.calque = self._mesurer(bas, haut, pose)
        return self._assets.reposer(deja)

    # ── Les réglages gardés ──────────────────────────────────────────────────

    def _garder(self, bas: Asset, pose: Superposition, depuis: str) -> None:
        """Attachés **à l'image de référence**, jamais au calque.

        « Un jeu de réglages qui marche pour un casque marchera à 90 % pour le
        suivant » : même corps, même cadrage, même calage à quelques pixels
        près. Les passages de la main, eux, ne sont pas gardés — ils sont
        dessinés sur une image précise et n'ont aucun sens sur une autre pièce.
        """
        bas.reglages_superposition = ReglagesGardes(
            depuis=depuis,
            le=time.time(),
            echelle=pose.echelle,
            dx=pose.dx,
            dy=pose.dy,
            rectangle=pose.rectangle,
            seuil=pose.seuil,
        )
        self._assets.sauver(bas)

    def oublier(self, dessous: str) -> Asset:
        """« Repartir de zéro › » — la règle du prérempli qui se défait d'un clic."""
        bas = self._exiger(dessous)
        bas.reglages_superposition = None
        self._assets.sauver(bas)
        return bas

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _mesurer(
        self, bas: np.ndarray, haut: np.ndarray, pose: Superposition
    ) -> MesuresCalque:
        """Les cinq nombres, pris sur la pose courante.

        **Aucune ne refuse quoi que ce soit** : elles disent si la superposition
        a réussi, et servent à ranger les calques d'un vestiaire dans l'ordre où
        il faut les regarder. Le seul refus automatique du produit reste le
        compte d'images.
        """
        pose_haut = aligner(haut, bas, pose)
        return mesurer_calque(
            bas,
            Retour(image=pose_haut, echelle=float(pose.echelle), silhouette=1.0),
            pose.seuil,
        )

    def _paire(
        self, dessus: str, dessous: str, *, arrivee: bool = False
    ) -> tuple[np.ndarray, np.ndarray]:
        """Les deux images **rendues**, dans l'ordre haut, bas.

        `arrivee` fait lire le dessus tel qu'il est arrivé du modèle plutôt que
        tel qu'il est rangé (G16). Le dessous ne bouge jamais : c'est le sol.
        """
        return (
            en_rgba(self._octets_dessus(self._exiger(dessus), arrivee)),
            en_rgba(self._rendu(self._exiger(dessous))),
        )

    def _octets_dessus(self, haut: Asset, arrivee: bool) -> bytes:
        """Le dessus, rendu — ou tel qu'il est arrivé du modèle (G16).

        **Le refus vient de l'équipement et garde ses mots** : il sait pourquoi
        il ne retrouve pas la case — une planche partie du disque, un découpage
        qui ne correspond plus —, et le réécrire ici en ferait une seconde
        version de la même vérité.
        """
        if not arrivee:
            return self._rendu(haut)
        if self._equipement is None:  # pragma: no cover — l'atelier le compose
            raise SuperpositionRefusee(
                "cet atelier ne sait pas retrouver la case telle qu'elle est arrivée"
            )
        octets, _ = self._equipement.case_arrivee(haut.identifiant)
        return octets

    def _rendu(self, asset: Asset) -> bytes:
        octets, _ = self._assets.octets(asset)
        return octets

    def _verifier(self, pose: Superposition) -> None:
        """Ce qui est hors domaine est refusé **en le nommant**, jamais corrigé."""
        if not pose.dessus or not pose.dessous:
            raise SuperpositionRefusee(
                "une superposition a besoin de deux images — le dessus et le dessous"
            )
        if pose.dessus == pose.dessous:
            raise SuperpositionRefusee(
                "le dessus et le dessous sont la même image : il n'y a rien à comparer"
            )
        if not ECHELLE_MIN <= pose.echelle <= ECHELLE_MAX:
            raise SuperpositionRefusee(
                f"l'échelle va de {ECHELLE_MIN} à {ECHELLE_MAX}"
            )
        if not 0 <= pose.seuil <= 255:
            raise SuperpositionRefusee("le seuil va de 0 à 255")
        if pose.sortie not in SORTIES:
            raise SuperpositionRefusee(f"sortie inconnue « {pose.sortie} »")

    def _exiger(self, identifiant: str) -> Asset:
        asset = self._assets.lire(identifiant)
        if asset is None:
            raise SuperpositionRefusee(f"aucun asset « {identifiant} »")
        return asset

    def _premier_rang_libre(self, generation: str) -> int:
        """Après tout ce qui existe, supprimés compris.

        Réutiliser le rang d'un supprimé rendrait deux images de même
        identifiant, et la seconde effacerait la première sur le disque — c'est
        la règle du découpage, mot pour mot.

        **Et au-dessus des emplacements et des rangs qu'un dépliage a
        réservés** (P1b) : superposer une pièce sur une image dépliée range le
        résultat dans le dossier de sa planche. Le plancher reste zéro — la
        convention de ce geste depuis sa naissance.
        """
        return rang_libre(self._base, generation, plancher=0)


def _label(haut: Asset, bas: Asset, sortie: str) -> str:
    """« Un calque prend le nom de la pièce, parce que c'est sous ce nom qu'on
    le cherchera dans le vestiaire. Un aplat nomme les deux, dans l'ordre de la
    pile. »"""
    if sortie == CALQUE:
        return haut.label
    return f"{bas.label} + {haut.label}"


def _en_png(rgba: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(tampon, format="PNG", optimize=True)
    return tampon.getvalue()


def _en_data(rgba: np.ndarray) -> str:
    return "data:image/png;base64," + base64.b64encode(_en_png(rgba)).decode("ascii")
