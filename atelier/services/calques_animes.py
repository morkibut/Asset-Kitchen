# -*- coding: utf-8 -*-
"""Les calques d'animation — **le calque de la pose, reposé image par image**.

`B20`. Il ne fabrique aucune image et n'appelle personne : tout ce qu'il pose
existe déjà sur le disque. Le calque a été obtenu par une planche d'équipement
(`C3`), les images viennent d'un clip déjà payé (`A10`), et ce qui manquait
entre les deux était le calcul qui les met l'une sur l'autre — or ce calcul est
écrit depuis `M1` (`atelier/image/calque.py::proposer`).

**C'est donc un service gratuit, et la phrase est vérifiable.** Il ne reçoit ni
catalogue, ni fournisseur, ni animateur — la même privation que le montage et
pour la même raison : ce qu'il ne tient pas, il ne peut pas l'appeler.

**L'invariant de `C3` gouverne tout le module.** Un calque appartient à une
*pose* et n'a de direction nulle part. Une bande, elle, en a une. Le seul point
où les deux se rencontrent est `_calque_de`, qui cherche par *(pièce,
personnage, pose)* — et pas une seule fois par direction. Habiller les quatre
bandes d'une pose consulte donc quatre fois le même calque ; l'axe des
directions vit sur la bande, et rien de ce que ce service écrit ne le fait
descendre dans le rangement des images.
"""

from __future__ import annotations

import base64
import io
import time
import uuid
from typing import Any, Sequence

import numpy as np
from PIL import Image

from atelier.domaine.asset import Asset
from atelier.domaine.bande import Bande
from atelier.domaine.calque_anime import (
    A_HABILLER,
    GLISSE,
    HABILLE,
    MOT_DE_L_ETAT,
    NE_COMPTE_PAS,
    SANS_ANIMATION,
    SANS_CALQUE,
    TENUES,
    TIENT,
    CalageParImage,
    Habillage,
)
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.superposition import ReglagesGardes, Superposition
from atelier.image.bande import preparer
from atelier.image.calque import proposer, superposer
from atelier.services.superposition import en_rgba


class HabillageRefuse(ErreurAtelier):
    """Ce qui manque pour habiller, dit avec le geste qui le répare."""


class ServiceCalquesAnimes:
    """Poser une pièce sur les images d'une animation, et compter ce qui reste.

    Il ne tient que ce dont il a besoin : le rangement, les assets — pour les
    pixels d'un calque —, le montage — qui seul sait relire les images d'une
    bande — et la production — qui seule sait quelles poses et quelles
    directions un personnage tient. **Aucun d'eux ne dépense**, et c'est ce qui
    fait que ce service ne peut pas dépenser non plus.
    """

    def __init__(
        self,
        base: Any,
        assets: Any,
        montage: Any,
        production: Any,
    ) -> None:
        self._base = base
        self._assets = assets
        self._montage = montage
        self._production = production

    # ── Ce que l'écran demande ───────────────────────────────────────────────

    def matrice(self, projet: str, piece: str, porteur: str) -> dict[str, Any]:
        """Une rangée par pose et par direction, et l'état de chaque case.

        **La grille est celle des bandes, pas celle des calques**, et c'est la
        forme que l'invariant impose : les poses et les directions viennent du
        personnage — ce qu'il tient —, et le calque n'est consulté qu'une fois
        par pose. Rien ici ne demande un calque par direction, donc rien ne
        pousse à en fabriquer.

        **Le compte n'est pas celui des cases.** Une case sans animation du
        personnage ne compte pas : il n'y a rien à habiller, et aucun clic ne le
        changerait — l'afficher en manque serait annoncer un trou que personne
        ne peut combler. C'est le critère de la tranche, et il se joue tout
        entier sur `NE_COMPTE_PAS`.
        """
        vise = self._production.personnage(projet, porteur)
        objet = self._exiger_projet(projet)
        piece_visee = self._exiger_piece(objet, piece)

        plan = self._production.plan_de(projet, vise)
        toutes = objet.univers.directions_du_jeu()

        nues, habillees = self._bandes_rangees(projet, vise.identifiant, piece)
        calques = self._calques_par_pose(projet, vise.identifiant, piece)

        rangees: list[dict[str, Any]] = []
        for pose in vise.tenues(plan):
            tenues = vise.directions_tenues(pose, toutes)
            calque = calques.get(pose.identifiant)
            # **Une pose sans direction rend quand même une rangée**, et sa
            # direction est vide : c'est déjà ce que fait la matrice des images
            # d'un jeu vu de face, et l'écran n'a pas à connaître deux formes.
            for direction in tenues or [None]:
                cle = direction.identifiant if direction else ""
                nue = nues.get((pose.identifiant, cle))
                habillee = habillees.get((pose.identifiant, cle))
                rangees.append(
                    {
                        "pose": pose.identifiant,
                        "pose_nom": pose.nom,
                        "direction": cle,
                        "direction_nom": direction.nom if direction else "",
                        "etat": self._etat(nue, calque, habillee),
                        "mot": MOT_DE_L_ETAT[self._etat(nue, calque, habillee)],
                        "calque": calque.identifiant if calque else None,
                        "bande": nue.identifiant if nue else None,
                        "compte": nue.compte if nue else 0,
                        "habillee": (
                            self._en_json(habillee) if habillee else None
                        ),
                    }
                )

        comptees = [r for r in rangees if r["etat"] not in NE_COMPTE_PAS]
        return {
            "projet": projet,
            "piece": piece_visee.en_json(),
            "porteur": {"identifiant": vise.identifiant, "nom": vise.nom},
            "rangees": rangees,
            "fait": sum(1 for r in comptees if r["etat"] == HABILLE),
            "attendu": len(comptees),
            # **Ce qui ne compte pas se dit quand même**, et se compte à part :
            # l'auteur doit pouvoir lire *quatre cases sont vides parce que le
            # goliath n'a pas ces animations-là*, et non les chercher.
            "sans_animation": sum(
                1 for r in rangees if r["etat"] == SANS_ANIMATION
            ),
        }

    # ── Le geste ─────────────────────────────────────────────────────────────

    def habiller(
        self, bande: str, piece: str, tenue: str = TIENT
    ) -> dict[str, Any]:
        """Poser le calque de la pose sur chaque image de cette bande.

        **Rien n'est demandé à personne, et rien n'est payé.** Le calque est sur
        le disque, les images aussi ; ce qui se calcule ici est une suite de
        nombres, et le refaire coûte le même rien que le faire.

        La bande habillée est une **bande à elle**, et c'est la décision de la
        tranche : elle porte la même case que le corps, plus sa pièce, comme un
        calque est un asset à lui qui porte la même pose que le corps, plus sa
        pièce. La symétrie avec `C3` n'est pas décorative — elle fait que le
        rangement, le compte et l'écart se comportent pareil des deux côtés.
        """
        if tenue not in TENUES:
            raise HabillageRefuse(
                f"« {tenue} » n'est pas une façon de suivre — "
                "le calque tient, ou il glisse"
            )
        nue = self._montage.bande(bande)
        if nue.piece is not None:
            raise HabillageRefuse(
                "cette bande est déjà habillée — on habille le corps, "
                "jamais ce qui est posé dessus"
            )
        if not (nue.projet and nue.personnage and nue.pose):
            raise HabillageRefuse(
                "cette bande n'a pas encore de case — "
                "elle se range sur une pose avant de porter quoi que ce soit"
            )

        calque = self._calque_de(nue.projet, nue.personnage, nue.pose, piece)
        if calque is None:
            raise HabillageRefuse(
                "la pièce n'a pas encore de calque sur cette pose — "
                "une planche d'équipement le donnera"
            )

        habillage = Habillage(piece=piece, tenue=tenue, main=nue.calage_garde)
        habillee = self._recomposer(nue, calque, habillage)
        return self._en_json(habillee)

    def regler(
        self, identifiant: str, tenue: str | None = None
    ) -> dict[str, Any]:
        """Changer la façon dont le calque suit — et **refaire les nombres**.

        Passer de *glisse* à *tient* n'a de sens que si les calages suivent :
        garder les anciens rendrait une bascule qui ne change rien à l'écran,
        ce qui ne se distingue pas d'une bascule cassée.
        """
        habillee = self._exiger_habillee(identifiant)
        if tenue is not None and tenue not in TENUES:
            raise HabillageRefuse(
                f"« {tenue} » n'est pas une façon de suivre — "
                "le calque tient, ou il glisse"
            )
        ancien = habillee.habillage
        assert ancien is not None  # tenu par `_exiger_habillee`
        habillage = Habillage(
            piece=ancien.piece,
            tenue=tenue if tenue is not None else ancien.tenue,
            main=ancien.main,
        )
        nue = self._nue_de(habillee)
        calque = self._exiger_calque(nue, ancien.piece)
        return self._en_json(self._recomposer(nue, calque, habillage, sur=habillee))

    def caler_a_la_main(
        self,
        identifiant: str,
        echelle: float,
        dx: int,
        dy: int,
        seuil: int | None = None,
        garder: bool = True,
    ) -> dict[str, Any]:
        """Le calage que l'auteur pose lui-même — **et qui sert à la suivante**.

        Il l'emporte sur le recalage, sans le remplacer : rejouer *tient* le
        refera trouver ses nombres, et ce sont ceux-là qui repartiront. La main
        est un écart déclaré, pas un mode.

        **`garder` est vrai par défaut, et c'est le critère de la tranche.** Les
        mêmes nombres sont posés sur la bande **nue** — celle du corps —, et la
        prochaine pièce qu'on habillera sur cette animation partira d'eux au
        lieu de zéro. C'est le geste de `M1` reporté ici : un jeu de réglages
        qui marche pour un casque marche à peu près pour le suivant, puisque
        c'est le même corps qui bouge de la même façon.
        """
        habillee = self._exiger_habillee(identifiant)
        ancien = habillee.habillage
        assert ancien is not None  # tenu par `_exiger_habillee`
        main = ReglagesGardes(
            depuis=habillee.nom or ancien.piece,
            le=time.time(),
            echelle=float(echelle),
            dx=int(dx),
            dy=int(dy),
            seuil=int(seuil) if seuil is not None else Superposition().seuil,
        )
        habillage = Habillage(piece=ancien.piece, tenue=ancien.tenue, main=main)

        nue = self._nue_de(habillee)
        calque = self._exiger_calque(nue, ancien.piece)
        rendue = self._recomposer(nue, calque, habillage, sur=habillee)

        if garder:
            # **Gardé sur la bande nue, jamais sur l'habillée.** L'habillée est
            # celle d'une pièce ; la nue est celle du corps que toutes les
            # pièces partagent — et c'est la seule des deux que la pièce
            # suivante rencontrera.
            nue.calage_garde = main
            self._montage.enregistrer(nue)
        return self._en_json(rendue)

    def oublier_le_calage(self, identifiant: str) -> dict[str, Any]:
        """Défaire le calage à la main — **le recalage reprend la main**.

        Tout ce que le produit devine se défait d'un clic ; ce que l'auteur pose
        aussi. La bande nue garde ses nombres : les oublier ici ne les retire
        pas de la pièce suivante, qui ne les a pas demandés.
        """
        habillee = self._exiger_habillee(identifiant)
        ancien = habillee.habillage
        assert ancien is not None  # tenu par `_exiger_habillee`
        habillage = Habillage(piece=ancien.piece, tenue=ancien.tenue, main=None)
        nue = self._nue_de(habillee)
        calque = self._exiger_calque(nue, ancien.piece)
        return self._en_json(self._recomposer(nue, calque, habillage, sur=habillee))

    def deshabiller(self, identifiant: str) -> dict[str, Any]:
        """La bande habillée s'en va ; **le corps et le calque restent**.

        Rien n'a été payé pour elle, et la refaire ne coûte rien : c'est la même
        règle qu'un découpage raté, écrite au même endroit du produit.
        """
        habillee = self._exiger_habillee(identifiant)
        self._montage.oublier(identifiant)
        return {"oubliee": habillee.identifiant, "piece": habillee.piece}

    # ── Ce qu'on regarde ─────────────────────────────────────────────────────

    def apercu(self, identifiant: str) -> dict[str, Any]:
        """Les images habillées, **sans rien écrire sur le disque**.

        Elles repartent en `data:`, comme l'aperçu d'une superposition et pour
        la même raison : un aperçu n'existe nulle part, et lui donner une
        adresse obligerait à ranger un brouillon, donc à le nettoyer.
        """
        habillee = self._exiger_habillee(identifiant)
        ancien = habillee.habillage
        assert ancien is not None  # tenu par `_exiger_habillee`
        nue = self._nue_de(habillee)
        calque = self._exiger_calque(nue, ancien.piece)

        corps = self._images_de(nue)
        dessus = self._pixels_du_calque(calque)
        images = [
            _en_data(superposer(fond, dessus, _pose(calage))[1])
            for fond, calage in zip(corps, habillee.calages)
        ]
        return {
            "bande": self._en_json(habillee),
            "images": images,
            "calque": _en_data(dessus),
        }

    # ── Le calcul, et il est le cœur de la tranche ───────────────────────────

    def _calages(
        self,
        corps: Sequence[np.ndarray],
        dessus: np.ndarray,
        habillage: Habillage,
        numeros: Sequence[int],
    ) -> tuple[CalageParImage, ...]:
        """Où le calque se pose sur chacune des images — **gratuitement**.

        Trois chemins, un seul calcul.

        **À la main** : les nombres de l'auteur, les mêmes partout. Rien n'est
        cherché — c'est ce que *poser à la main* veut dire.

        **Le calque glisse** : une seule recherche, sur la **première** image, et
        son résultat sert aux autres. La première et non la médiane, parce que
        c'est celle que l'auteur voit en tête de bande : le calage qu'il juge à
        l'œil doit être celui qui a servi, sans quoi corriger reviendrait à
        corriger un calcul qu'on ne lui a pas montré.

        **Le calque tient** : une recherche par image. C'est ce qui suit un
        personnage qui tourne la tête, et c'est le défaut — le calcul est
        gratuit, et rien ne justifie de moins bien poser quand mieux poser ne
        coûte rien.

        ⚠️ **Aucune de ces branches ne sort de la machine.** `proposer` est du
        calcul sur des tableaux, et ce service ne tient aucun fournisseur.
        """
        if habillage.main is not None:
            garde = habillage.main
            return tuple(
                CalageParImage(
                    numero=numero,
                    echelle=garde.echelle,
                    dx=garde.dx,
                    dy=garde.dy,
                    # **Mesurée quand même**, et sur l'image réelle : l'écran
                    # doit pouvoir dire *ce calage-là tombe mal* même — et
                    # surtout — quand c'est l'auteur qui l'a posé.
                    couverture=_couverture(fond, dessus, garde),
                )
                for numero, fond in zip(numeros, corps)
            )

        if habillage.tenue == GLISSE and corps:
            echelle, dy, dx, couverture = proposer(corps[0], dessus)
            return tuple(
                CalageParImage(
                    numero=numero,
                    echelle=float(echelle),
                    dx=int(dx),
                    dy=int(dy),
                    couverture=float(couverture),
                )
                for numero in numeros
            )

        calages: list[CalageParImage] = []
        for numero, fond in zip(numeros, corps):
            echelle, dy, dx, couverture = proposer(fond, dessus)
            calages.append(
                CalageParImage(
                    numero=numero,
                    echelle=float(echelle),
                    dx=int(dx),
                    dy=int(dy),
                    couverture=float(couverture),
                )
            )
        return tuple(calages)

    def _recomposer(
        self,
        nue: Bande,
        calque: Asset,
        habillage: Habillage,
        sur: Bande | None = None,
    ) -> Bande:
        """La bande habillée — **refaite de la nue à chaque fois**.

        Elle ne se corrige pas, elle se recompose : ses prises, sa cadence, son
        sens, sa recette et son cadre sont ceux du corps, relus à l'instant. Une
        bande habillée qui garderait sa propre copie du montage se mettrait à
        diverger dès que l'auteur retouche l'animation du personnage, et
        personne ne verrait l'écart — c'est le pire des deux, parce qu'il se
        découvre à l'export.
        """
        corps = self._images_de(nue)
        dessus = self._pixels_du_calque(calque)
        calages = self._calages(corps, dessus, habillage, nue.images)

        habillee = sur or Bande(
            identifiant=f"habillee-{uuid.uuid4().hex[:12]}",
            clip=nue.clip,
        )
        habillee.clip = nue.clip
        habillee.nom = nue.nom
        habillee.prises = nue.prises
        habillee.chutier = ()
        habillee.cadence = nue.cadence
        habillee.sens = nue.sens
        habillee.cadre = nue.cadre
        habillee.recette = nue.recette
        habillee.projet = nue.projet
        habillee.personnage = nue.personnage
        habillee.pose = nue.pose
        habillee.direction = nue.direction
        habillee.habillage = habillage
        habillee.calages = calages
        # **La planche du corps n'est pas celle de l'habillée.** La laisser
        # aurait fait servir les images nues sous le nom de l'habillée, ce qui
        # est le genre d'écart qui ne se voit qu'à l'export.
        habillee.planche = None
        habillee.case_largeur = 0
        habillee.case_hauteur = 0
        self._montage.enregistrer(habillee)
        return habillee

    # ── Aller chercher ───────────────────────────────────────────────────────

    def _calque_de(
        self, projet: str, personnage: str, pose: str, piece: str
    ) -> Asset | None:
        """Le calque de cette pièce sur cette pose — **et pas sur sa direction**.

        C'est le seul endroit du module qui va chercher une image, et c'est donc
        le seul qui pourrait casser l'invariant de `C3`. Il ne le fait pas : la
        direction n'entre pas dans la question, parce qu'un calque n'en a pas.

        Le départage est celui du produit — le favori d'abord, sinon la plus
        récente —, emprunté et non réécrit : deux règles à deux endroits
        finiraient par désigner deux calques différents, et l'auteur verrait
        alors autre chose que ce qui part.
        """
        return calque_de_la_pose(self._base, projet, personnage, pose, piece)

    def _pixels_du_calque(self, calque: Asset) -> np.ndarray:
        """Les pixels d'un calque, **tels qu'il est rangé**.

        Et non *tels qu'arrivés du modèle* : le brut d'un calque est la case déjà
        mise à l'échelle et calée sur son corps (`G16`), et repartir de là
        reviendrait à recaler ce qui vient d'être calé. Ce qu'on pose sur une
        animation est la pièce telle que la bibliothèque la montre.
        """
        octets, _ = self._assets.octets(calque)
        return en_rgba(octets)

    def _calques_par_pose(
        self, projet: str, personnage: str, piece: str
    ) -> dict[str, Asset]:
        """Les calques de cette pièce, une entrée par pose — **en une lecture**.

        La matrice les demande pose par pose ; les chercher un par un ferait
        autant d'allers-retours que de rangées, pour une question que le
        rangement répond d'un coup.
        """
        from atelier.services.production import corps_retenu

        par_pose: dict[str, list[Asset]] = {}
        for asset in self._base.assets_du_personnage(personnage, projet=projet):
            if asset.piece == piece and asset.pose and asset.supprime_le is None:
                par_pose.setdefault(asset.pose, []).append(asset)
        retenus = {p: corps_retenu(images) for p, images in par_pose.items()}
        return {p: c for p, c in retenus.items() if c is not None}

    def _bandes_rangees(
        self, projet: str, personnage: str, piece: str
    ) -> tuple[dict[tuple[str, str], Bande], dict[tuple[str, str], Bande]]:
        """Les bandes de ce personnage, rangées par case — nues d'un côté,
        habillées de cette pièce de l'autre.

        **Une écartée ne remplit aucune des deux**, comme une image supprimée ne
        remplit aucune case : c'est déjà la règle de `B11`, et la répéter ici
        évite qu'une animation mise de côté fasse croire à une case pleine.
        """
        nues: dict[tuple[str, str], Bande] = {}
        habillees: dict[tuple[str, str], Bande] = {}
        for bande in self._base.bandes_du_personnage(personnage, projet=projet):
            if not bande.pose or bande.supprime_le is not None:
                continue
            cle = (bande.pose, bande.direction or "")
            if bande.piece is None:
                nues.setdefault(cle, bande)
            elif bande.piece == piece:
                habillees.setdefault(cle, bande)
        return nues, habillees

    def _images_de(self, nue: Bande) -> list[np.ndarray]:
        """Les images du corps, **telles que la grille les voit**.

        Le même préfixe de chaîne que la planche d'une bande, emprunté et non
        réécrit : deux façons de préparer donneraient deux systèmes de
        coordonnées, et le calage tomberait à côté sans que rien ne lève.
        """
        fichiers = self._montage.fichiers_des_prises(nue.clip, nue.prises)
        recettes, _ = self._montage.recettes_de(nue)
        return [
            preparer(fichier.read_bytes(), recette)
            for fichier, recette in zip(fichiers, recettes)
        ]

    # ── Les refus, et ils portent leur geste ─────────────────────────────────

    def _etat(
        self, nue: Bande | None, calque: Asset | None, habillee: Bande | None
    ) -> str:
        """L'état d'une case, et **l'ordre des questions est la décision**.

        *Le personnage a-t-il cette animation ?* vient en premier, avant même
        *la pièce a-t-elle un calque ?* — parce que sans animation il n'y a rien
        à habiller, quel que soit l'état du calque. Poser les deux questions
        dans l'autre sens ferait annoncer *il manque un calque* sur une case que
        ce calque ne remplirait jamais.
        """
        if nue is None:
            return SANS_ANIMATION
        if calque is None:
            return SANS_CALQUE
        return HABILLE if habillee is not None else A_HABILLER

    def _nue_de(self, habillee: Bande) -> Bande:
        """La bande du corps dont celle-ci est l'habillage.

        Elle se retrouve par sa case — même personnage, même pose, même
        direction, sans pièce — et non par un identifiant gardé sur l'habillée.
        C'est ce qui fait qu'une animation redécoupée reste la source de son
        habillage : la case est ce qui les lie, comme elle lie déjà un calque à
        son corps.
        """
        if not (habillee.personnage and habillee.pose and habillee.projet):
            raise HabillageRefuse(
                "cette bande habillée n'a plus de case — son corps est introuvable"
            )
        for bande in self._base.bandes_du_personnage(
            habillee.personnage, projet=habillee.projet
        ):
            if (
                bande.piece is None
                and bande.pose == habillee.pose
                and (bande.direction or "") == (habillee.direction or "")
                and bande.supprime_le is None
            ):
                return bande
        raise HabillageRefuse(
            "l'animation du personnage n'est plus là — "
            "l'habillage se refait quand elle revient"
        )

    def _exiger_calque(self, nue: Bande, piece: str) -> Asset:
        calque = self._calque_de(
            nue.projet or "", nue.personnage or "", nue.pose or "", piece
        )
        if calque is None:
            raise HabillageRefuse(
                "la pièce n'a plus de calque sur cette pose — "
                "une planche d'équipement le redonnera"
            )
        return calque

    def _exiger_habillee(self, identifiant: str) -> Bande:
        bande = self._montage.bande(identifiant)
        if bande.habillage is None:
            raise HabillageRefuse(
                "cette bande ne porte rien — il n'y a pas de calque à régler"
            )
        return bande

    def _exiger_projet(self, projet: str) -> Any:
        objet = self._base.lire_projet(projet)
        if objet is None:
            raise HabillageRefuse(f"le jeu « {projet} » est introuvable")
        return objet

    @staticmethod
    def _exiger_piece(objet: Any, piece: str) -> Any:
        for sienne in objet.pieces:
            if sienne.identifiant == piece:
                return sienne
        raise HabillageRefuse(f"la pièce « {piece} » est introuvable dans ce jeu")

    def _en_json(self, bande: Bande) -> dict[str, Any]:
        return bande.en_json()


# ── Ce que deux services demandent, écrit une fois ───────────────────────────


def calque_de_la_pose(
    base: Any, projet: str, personnage: str, pose: str, piece: str
) -> Asset | None:
    """Le calque d'une pièce sur une pose — **et jamais sur une direction**.

    **Écrite ici, appelée de deux endroits**, et c'est ce qui la rend sûre : ce
    service la lit pour calculer les calages, le montage la lit pour assembler
    la planche d'une bande habillée. Deux copies auraient fini par désigner deux
    calques différents, et l'auteur aurait vu à l'écran autre chose que ce qui
    part — le défaut exact que `corps_retenu` a été écrite une fois pour éviter.

    C'est le seul endroit de la tranche qui va chercher une image, et donc le
    seul qui pourrait casser l'invariant de `C3`. Il ne le fait pas : la
    direction n'entre pas dans la question, parce qu'un calque n'en a pas.

    Le départage est celui du produit — le favori d'abord, sinon la plus
    récente —, emprunté et non réécrit.
    """
    from atelier.services.production import corps_retenu

    siens = [
        a
        for a in base.assets_du_personnage(personnage, projet=projet)
        if a.piece == piece and a.pose == pose and a.supprime_le is None
    ]
    return corps_retenu(siens) if siens else None


def habiller_les_images(
    preparees: Sequence[np.ndarray],
    dessus: np.ndarray,
    calages: Sequence[CalageParImage],
) -> list[np.ndarray]:
    """Les images du corps, **avec le calque posé dessus, image par image**.

    C'est ce qui fait qu'une bande habillée sort du produit habillée : la
    planche de sprites, l'image animée et l'export passent tous par là. Sans
    elle, une bande qui porte une pièce aurait rendu les pixels du corps nu sous
    son propre nom — le genre d'écart qui ne se découvre qu'en ouvrant le
    fichier dans le moteur de jeu.

    **Une image sans calage reste nue** plutôt que d'être posée au hasard : un
    cache effacé se refait, il ne s'invente pas.
    """
    rendues: list[np.ndarray] = []
    for rang, fond in enumerate(preparees):
        if rang >= len(calages):
            rendues.append(fond)
            continue
        rendues.append(superposer(fond, dessus, _pose(calages[rang]))[1])
    return rendues


# ── Les fonctions de pose ────────────────────────────────────────────────────


def _pose(calage: CalageParImage) -> Superposition:
    """Un calage rendu à la forme que la superposition attend.

    Les deux images sont déjà en mémoire quand on l'emploie : `dessus` et
    `dessous` restent vides, et rien ne les relira — c'est la même liberté que
    prend l'aperçu d'une superposition.
    """
    return Superposition(
        echelle=calage.echelle, dx=calage.dx, dy=calage.dy
    )


def _couverture(
    fond: np.ndarray, dessus: np.ndarray, garde: ReglagesGardes
) -> float:
    """Ce que le calque couvre du corps, au calage donné.

    Mesurée sur l'image posée, et non déduite du calcul : quand l'auteur pose
    les nombres lui-même, il n'y a **aucun** calcul dont la déduire.
    """
    calque, _ = superposer(
        fond,
        dessus,
        Superposition(
            echelle=garde.echelle, dx=garde.dx, dy=garde.dy, seuil=garde.seuil
        ),
    )
    opaques = float(np.count_nonzero(calque[:, :, 3]))
    total = float(calque.shape[0] * calque.shape[1]) or 1.0
    return opaques / total


def _en_data(rgba: np.ndarray) -> str:
    """Une image en `data:`, comme l'aperçu d'une superposition la rend.

    Écrite ici plutôt qu'empruntée : celle de la superposition est privée à son
    module, et deux lignes se recopient mieux qu'un nom souligné ne se traverse.
    """
    tampon = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(tampon, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(tampon.getvalue()).decode(
        "ascii"
    )
