# -*- coding: utf-8 -*-
"""Le vestiaire d'un projet, la planche qui habille, et le calque qui en sort.

C3. **Trois gestes et un calcul**, comme la production de C1 : écrire les
emplacements et les pièces d'un projet, composer la planche qui part, ranger ce
qui revient — et le calque, qui n'est pas un objet enregistré mais une *recette*
posée sur une image payée.

**Ce service ne sait pas plier, et c'est délibéré.** Le pliage est la manière
dont l'atelier habille ou transforme N images d'un seul appel
(`docs/archi-versions.md` § Le pliage) ; il a été écrit en C2 sans connaître ni
personnage, ni pose, ni pièce, et C3 le réemploie **tel quel** — la grille, le
compte, le découpeur et le refus arithmétique viennent tous de
`ServicePliage.decouper_retour`. Ce qui appartient à C3 tient en deux phrases :
quels corps mettre dans les cases, et quoi faire de ce qui en revient.

**Aucun `fournisseur` dans ce fichier**, et ça se lit dans ses imports. Écrire
une pièce, poser un masque, recalculer une différence : tout marche réseau
coupé. Seule la génération sort, et elle part d'ailleurs — du seul endroit du
produit d'où l'on paie.

**Un mot pour deux choses.** `atelier/domaine/generation.py` porte un
`Emplacement` qui est la place d'une variation dans un appel ; celui de C3 est
une place sur un corps. Ce fichier ne nomme jamais le premier — il reçoit un
**rang** et demande son emplacement à la génération —, et c'est ainsi que les
deux mots cohabitent sans qu'on ait à en renommer un.
"""

from __future__ import annotations

import io
from dataclasses import replace
from typing import Any, Sequence

import numpy as np
from PIL import Image

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.equipement import (
    CONTENUE,
    EMPLACEMENTS_PROPOSES,
    GENRES,
    PORTE,
    PORTEES,
    Emplacement,
    Emploi,
    MesuresCalque,
    Piece,
    emploi_porte,
    emplois_resolus,
    rang_suivant,
)
from atelier.domaine.generation import Generation
from atelier.domaine.pliage import CasePliee, MesuresLot, Pliage
from atelier.domaine.projet import PLANCHE, Projet, repere
from atelier.domaine.recette import Difference, Recette, traits_depuis_json
from atelier.image.calque import (
    ECHELLE_TOLEREE,
    OCCUPATION_AGRANDIT,
    OCCUPATION_CONTENUE,
    Retour,
    avec_alpha,
    cases_de,
    composer,
    mesurer_calque,
    place_de,
    recadrer_sur,
)
from atelier.image import mesurer
from atelier.image.pliage import COTE
from atelier.services.assets import ServiceAssets
from atelier.services.bibliotheque import ProjetInconnu, ServiceBibliotheque
from atelier.services.evenements import Diffusion
from atelier.services.pliage import RANG_PLIAGE, ServicePliage
from atelier.services.production import (
    ProductionRefusee,
    ServiceProduction,
    corps_retenu,
)


# Les deux couches de la main, et la liste est close (C4). Ce sont les noms des
# **champs de la différence** : les nommer autrement ici demanderait une table de
# traduction, donc un endroit de plus où les deux couches peuvent se confondre.
COUCHES = ("affinage", "retouche")


class PieceInconnue(ProductionRefusee):
    code = "piece_inconnue"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"aucune pièce « {identifiant} » dans ce projet")


class EmploiInconnu(ProductionRefusee):
    code = "emploi_inconnu"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"aucun emploi « {identifiant} » sur cette pièce")


class EmplacementInconnu(ProductionRefusee):
    code = "emplacement_inconnu"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"aucun emplacement « {identifiant} » dans ce projet")


class ServiceEquipement:
    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        bibliotheque: ServiceBibliotheque,
        assets: ServiceAssets,
        production: ServiceProduction,
        pliage: ServicePliage,
        diffusion: Diffusion,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._bibliotheque = bibliotheque
        self._assets = assets
        self._production = production
        self._pliage = pliage
        self._diffusion = diffusion

    # ── Les emplacements ─────────────────────────────────────────────────────

    def emplacements(self, projet: str) -> tuple[Emplacement, ...]:
        """Ceux de ce projet, **dans leur ordre** — celui des colonnes de la
        matrice, et celui dans lequel l'auteur habille quelqu'un."""
        return tuple(sorted(self._exiger(projet).emplacements, key=lambda e: e.rang))

    def ajouter_emplacement(self, projet: str, nom: str) -> Emplacement:
        """**Nommer, c'est créer** (US-138) : un nom d'emplacement qui n'existe
        pas encore le crée sur-le-champ, sans passer par un écran de gestion.

        En queue, jamais trié — même règle que l'ajout d'une pose au plan : le
        rang est celui dans lequel l'auteur pense son personnage, pas celui de
        l'alphabet.
        """
        objet = self._exiger(projet)
        propre = nom.strip()
        if not propre:
            raise ProductionRefusee("un emplacement se crée avec un nom")
        if any(e.nom.casefold() == propre.casefold() for e in objet.emplacements):
            raise ProductionRefusee(f"« {propre} » est déjà un emplacement de ce projet")

        emplacement = Emplacement(
            identifiant=repere(
                propre, {e.identifiant for e in objet.emplacements}, "emplacement"
            ),
            nom=propre,
            rang=rang_suivant(objet.emplacements),
        )
        objet.emplacements = objet.emplacements + (emplacement,)
        self._sauver(objet)
        return emplacement

    def poser_les_proposes(self, projet: str) -> tuple[Emplacement, ...]:
        """Poser d'un geste les six emplacements que l'atelier propose.

        **Le vestiaire naît toujours vide**, et cette méthode ne change pas ça :
        elle est un geste de l'auteur, pas un effet de bord de la création d'un
        projet. Ce qu'elle répare est mesuré à l'étape 8 de l'assistant — une
        liste vide sous une demi-phrase qui énonçait une règle sur un ordre que
        rien ne permettait de changer.

        **Elle n'ajoute que ce qui manque, et ne renomme rien.** Un vestiaire
        déjà commencé garde ce qu'il porte : la cliquer deux fois ne fabrique pas
        de doublon, et un nom déjà pris est simplement sauté. C'est ce qui la
        rend sans danger sur un projet en cours.

        L'ordre posé est celui du domaine — de l'arrière vers l'avant, parce que
        c'est le rang qui décide de ce qui se dessine par-dessus quoi.
        """
        objet = self._exiger(projet)
        prises = {e.nom.casefold() for e in objet.emplacements}
        rang = rang_suivant(objet.emplacements)
        neufs: list[Emplacement] = []
        reperes = {e.identifiant for e in objet.emplacements}
        for nom in EMPLACEMENTS_PROPOSES:
            if nom.casefold() in prises:
                continue
            identifiant = repere(nom, reperes, "emplacement")
            reperes.add(identifiant)
            neufs.append(Emplacement(identifiant=identifiant, nom=nom, rang=rang))
            rang += 1
        if neufs:
            objet.emplacements = objet.emplacements + tuple(neufs)
            self._sauver(objet)
        return tuple(sorted(objet.emplacements, key=lambda e: e.rang))

    def regler_emplacement(
        self, projet: str, identifiant: str, *, nom: str | None = None,
        rang: int | None = None,
    ) -> Emplacement:
        """Renommer un emplacement, ou le déplacer dans l'ordre.

        **L'identifiant ne bouge pas**, et c'est tout l'intérêt : les pièces
        déjà rangées le portent, et renommer « tête » en « couvre-chef » ne doit
        pas les orpheliner (même règle qu'une pose, US-118).
        """
        objet = self._exiger(projet)
        courant = self._exiger_emplacement(objet, identifiant)
        propre = courant.nom if nom is None else nom.strip()
        if not propre:
            raise ProductionRefusee("un emplacement garde un nom")
        if any(
            e.identifiant != courant.identifiant
            and e.nom.casefold() == propre.casefold()
            for e in objet.emplacements
        ):
            raise ProductionRefusee(f"« {propre} » est déjà un emplacement de ce projet")

        regle = Emplacement(
            identifiant=courant.identifiant,
            nom=propre,
            rang=courant.rang if rang is None else int(rang),
        )
        objet.emplacements = tuple(
            regle if e.identifiant == courant.identifiant else e
            for e in objet.emplacements
        )
        self._sauver(objet)
        return regle

    def retirer_emplacement(self, projet: str, identifiant: str) -> Emplacement:
        """L'emplacement part — **et les pièces qui l'occupaient restent**.

        Jamais de cascade, ici comme partout : une pièce dont l'emplacement a
        disparu redevient une pièce sans emplacement, ce qui est l'état d'une
        pièce qu'on vient de nommer. Elle se range d'un clic, et rien n'a été
        perdu ni supprimé au passage.
        """
        objet = self._exiger(projet)
        retire = self._exiger_emplacement(objet, identifiant)
        objet.emplacements = tuple(
            e for e in objet.emplacements if e.identifiant != retire.identifiant
        )
        objet.pieces = tuple(
            replace(p, emplacement="") if p.emplacement == retire.identifiant else p
            for p in objet.pieces
        )
        self._sauver(objet)
        return retire

    # ── Les pièces ───────────────────────────────────────────────────────────

    def pieces(self, projet: str) -> tuple[Piece, ...]:
        return self._exiger(projet).pieces

    def piece(self, projet: str, identifiant: str) -> Piece:
        for une in self.pieces(projet):
            if une.identifiant == identifiant:
                return une
        raise PieceInconnue(identifiant)

    def ajouter_piece(
        self,
        projet: str,
        nom: str,
        *,
        description: str = "",
        emplacement: str = "",
        portee: str = CONTENUE,
        porteur: str = "",
    ) -> Piece:
        """Une pièce se décrit **une seule fois** sur le projet (US-137).

        **Aucun prompt ici, et aucune image.** Une pièce n'existe qu'apparue sur
        un corps (`docs/archi-versions.md` §7) : ce geste-ci ne fabrique qu'une
        colonne de cases vides, il ne demande rien au fournisseur et ne coûte
        rien.

        L'emplacement est **créé s'il n'existe pas** — c'est la même règle que
        pour la pièce elle-même, et l'écrire ici évite d'imposer un ordre à
        l'auteur : nommer « casque · tête » ne doit pas demander d'avoir créé la
        tête d'abord.

        **Une pièce ne porte personne par défaut** (B19). Elle naît déclarée et
        vide — `emplois=()`, pas `None` : c'est une pièce dont on sait qu'elle
        n'est portée par personne, pas une pièce dont on ne sait rien, et la
        différence tient tout le critère de rétrocompatibilité (voir
        `atelier/domaine/equipement.py`, le champ `emplois`).

        **Sauf si elle naît de la fiche de quelqu'un** : `porteur` la lui attribue
        d'emblée, en un seul aller-retour. Nommer une pièce depuis le vestiaire
        d'un personnage et devoir ensuite dire qui la porte aurait fait deux
        gestes là où l'auteur n'en voit qu'un.
        """
        objet = self._exiger(projet)
        propre = nom.strip()
        if not propre:
            raise ProductionRefusee("une pièce se crée avec un nom")
        if any(p.nom.casefold() == propre.casefold() for p in objet.pieces):
            raise ProductionRefusee(f"« {propre} » est déjà une pièce de ce projet")

        # **Vérifié avant d'écrire quoi que ce soit** : une pièce à moitié créée,
        # sans son porteur, obligerait l'auteur à défaire avant de refaire.
        if porteur:
            qui = self._production.personnage(projet, porteur)
            if not self._production.porte_de_lequipement(projet, qui):
                raise ProductionRefusee(
                    f"« {qui.nom} » ne porte pas d'équipement — une pièce se "
                    f"pose sur un corps, jamais sur rien"
                )

        range_dans = self._emplacement_ou_creer(projet, emplacement)
        objet = self._exiger(projet)  # relu : l'emplacement neuf y est
        piece = Piece(
            identifiant=repere(propre, {p.identifiant for p in objet.pieces}, "piece"),
            nom=propre,
            description=description.strip(),
            emplacement=range_dans,
            portee=portee if portee in PORTEES else CONTENUE,
            emplois=(emploi_porte(porteur),) if porteur else (),
        )
        objet.pieces = objet.pieces + (piece,)
        self._sauver(objet)
        return piece

    def regler_piece(
        self,
        projet: str,
        identifiant: str,
        *,
        nom: str | None = None,
        description: str | None = None,
        emplacement: str | None = None,
        portee: str | None = None,
        concept_arts: Sequence[str] | None = None,
        references: Sequence[str] | None = None,
    ) -> Piece:
        """Tout ce qui se règle sur une pièce, **en un seul geste** — même raison
        qu'un personnage : les champs se remplissent ensemble à l'écran, et un
        appel par champ ferait autant d'allers-retours qu'il y a de lignes.

        **La portée n'est jamais devinée** (US-139). L'auteur la déclare ici, et
        elle décide de ce que l'atelier saura fabriquer : un calque, ou seulement
        des corps habillés. Une valeur inconnue retombe sur « contenue » — la
        liste est close, et un onglet d'une autre version ne la rouvre pas.
        """
        objet = self._exiger(projet)
        courante = self._exiger_piece(objet, identifiant)

        if references is not None:
            for identifiant_image in references:
                image = self._assets.lire(identifiant_image)
                if image is None or image.supprime or image.projet != projet:
                    raise ProductionRefusee("La référence de la pièce doit être une image disponible dans ce jeu.")

        propre = courante.nom if nom is None else nom.strip()
        if not propre:
            raise ProductionRefusee("une pièce garde un nom")
        if any(
            p.identifiant != courante.identifiant
            and p.nom.casefold() == propre.casefold()
            for p in objet.pieces
        ):
            raise ProductionRefusee(f"« {propre} » est déjà une pièce de ce projet")

        range_dans = (
            courante.emplacement
            if emplacement is None
            else self._emplacement_ou_creer(projet, emplacement)
        )
        objet = self._exiger(projet)
        reglee = Piece(
            identifiant=courante.identifiant,
            nom=propre,
            description=(
                courante.description if description is None else description.strip()
            ),
            emplacement=range_dans,
            portee=(
                courante.portee
                if portee is None or portee not in PORTEES
                else portee
            ),
            concept_arts=(
                courante.concept_arts
                if concept_arts is None
                else tuple(dict.fromkeys(concept_arts))
            ),
            # ⚠️ **Recopié, et il fallait y penser** (B19). Cette méthode
            # reconstruit une pièce champ par champ au lieu de la modifier : un
            # champ oublié ici n'est pas perdu à la lecture du disque — il est
            # perdu au **premier renommage**, sans qu'aucune relecture ne
            # l'annonce. Un essai de `tests/test_b19.py` renomme une pièce qui
            # porte trois emplois et vérifie qu'ils sont toujours là.
            emplois=courante.emplois,
            references=courante.references if references is None else tuple(dict.fromkeys(references)),
        )
        objet.pieces = tuple(
            reglee if p.identifiant == courante.identifiant else p for p in objet.pieces
        )
        self._sauver(objet)
        return reglee

    def retirer_piece(self, projet: str, identifiant: str) -> Piece:
        """La pièce part, **ses calques restent** — jamais de cascade.

        Ils gardent son identifiant : remettre la même pièce au projet les remet
        dans leur colonne, exactement comme une pose retirée puis remise remet
        ses images dans leur ligne (C1).
        """
        objet = self._exiger(projet)
        retiree = self._exiger_piece(objet, identifiant)
        objet.pieces = tuple(
            p for p in objet.pieces if p.identifiant != retiree.identifiant
        )
        self._sauver(objet)
        return retiree

    # ── Les emplois d'une pièce (B19) ────────────────────────────────────────
    #
    # **Le lien qui manquait au modèle.** Un emploi dit *comment* une pièce sert,
    # et son genre `porte` dit *qui* la porte. Tout ce bloc écrit sur la pièce,
    # jamais sur le personnage : les emplacements de corps restent au jeu, et le
    # personnage ne gagne pas un champ de vestiaire qu'il faudrait tenir d'accord
    # avec celui d'en face.

    def emplois(self, projet: str, piece: str) -> tuple[Emploi, ...]:
        """Ses emplois — **déclarés, ou lus sur les calques déjà là**.

        Une pièce qui n'a jamais rien déclaré (`emplois is None`, tous les
        fichiers d'avant B19) n'est pas une pièce que personne ne porte : c'est
        une pièce dont on ne sait rien. Le disque, lui, sait — un calque porte sa
        pièce et son personnage depuis C3 —, et cette méthode le lui demande
        plutôt que de rendre une liste vide sous laquelle dix images
        disparaîtraient de l'écran.

        **Rien n'est écrit pour autant.** La déduction est une lecture, refaite à
        chaque appel ; le disque ne gagne la clé qu'au premier geste de l'auteur
        sur les emplois de cette pièce-là, et c'est `_a_declarer` qui la pose.
        """
        objet = self._exiger(projet)
        return self._emplois_de(objet, self._exiger_piece(objet, piece))

    def _emplois_de(self, objet: Projet, piece: Piece) -> tuple[Emploi, ...]:
        """La règle vient du domaine (`emplois_resolus`) — elle n'est pas
        réécrite ici, `ServiceProduction` la lit aussi."""
        return emplois_resolus(piece, self._porteurs_deduits(objet, piece))

    def _porteurs_deduits(self, objet: Projet, piece: Piece) -> tuple[str, ...]:
        """Qui porte cette pièce d'après les calques déjà sur le disque.

        La même lecture que `ServiceProduction.portee_de_la_piece` fait depuis
        E15, et pour la même raison : c'est l'image qui dit sa pièce et son
        personnage, et un couple *(pièce, personnage)* qui a au moins un calque
        est un emploi porté, qu'on l'ait déclaré ou non.
        """
        return tuple(
            personnage.identifiant
            for personnage in self._production.personnages(objet.identifiant)
            if any(
                asset.piece == piece.identifiant
                for asset in self._base.assets_du_personnage(
                    personnage.identifiant, projet=objet.identifiant
                )
            )
        )

    def _a_declarer(self, objet: Projet, piece: Piece) -> tuple[Emploi, ...]:
        """Ce sur quoi un geste travaille — la déclaration, ou sa reprise.

        **La reprise se fait à l'écriture, jamais à la lecture.** Retirer un
        porteur sur une pièce qui en avait trois sans jamais l'avoir déclaré doit
        laisser les deux autres : partir d'une liste vide les aurait effacés, et
        partir de la déduction *à chaque relecture* aurait fait revenir celui
        qu'on vient de retirer, ses calques étant toujours sur le disque. C'est
        exactement le piège que `plan_depuis_json` évite pour les poses.
        """
        return self._emplois_de(objet, piece)

    def ajouter_emploi(
        self,
        projet: str,
        piece: str,
        *,
        genre: str = PORTE,
        porteur: str = "",
        nom: str = "",
        emplacement: str = "",
        devant: bool = True,
        description: str = "",
    ) -> Emploi:
        """Une façon de plus dont cette pièce sert.

        **Un personnage ne porte une pièce qu'une fois**, et le refus est ici. La
        raison n'est pas de forme : les calques sont rangés par *(pièce,
        personnage, pose)* et par rien d'autre, si bien que deux emplois portés
        par le même personnage se partageraient les mêmes images sans qu'aucune
        règle puisse dire laquelle va où.

        **Seule une chose qui a un corps peut porter** — c'est déjà le refus de
        C3 au moment de plier, et `porte_de_lequipement` le dit pour l'écran
        depuis E15. Un décor ne prend pas d'épée.
        """
        objet = self._exiger(projet)
        visee = self._exiger_piece(objet, piece)
        deja = self._a_declarer(objet, visee)

        retenu = genre if genre in GENRES else PORTE
        if retenu == PORTE:
            if not porteur:
                raise ProductionRefusee(
                    "un emploi porté se crée avec le personnage qui le porte"
                )
            qui = self._production.personnage(objet.identifiant, porteur)
            if not self._production.porte_de_lequipement(objet.identifiant, qui):
                raise ProductionRefusee(
                    f"« {qui.nom} » ne porte pas d'équipement — une pièce se "
                    f"pose sur un corps, jamais sur rien"
                )
            if any(e.porte and e.porteur == porteur for e in deja):
                raise ProductionRefusee(
                    f"« {qui.nom} » porte déjà « {visee.nom} »"
                )
            identifiant = emploi_porte(porteur).identifiant
        else:
            porteur = ""
            identifiant = repere(
                nom.strip() or retenu, {e.identifiant for e in deja}, "emploi"
            )

        emploi = Emploi(
            identifiant=identifiant,
            genre=retenu,
            porteur=porteur,
            nom=nom.strip(),
            emplacement=self._emplacement_ou_creer(projet, emplacement)
            if emplacement
            else "",
            devant=devant,
            description=description.strip(),
        )
        objet = self._exiger(projet)  # relu : l'emplacement neuf y est
        self._poser_emplois(objet, visee.identifiant, deja + (emploi,))
        return emploi

    def regler_emploi(
        self,
        projet: str,
        piece: str,
        identifiant: str,
        *,
        nom: str | None = None,
        emplacement: str | None = None,
        devant: bool | None = None,
        description: str | None = None,
    ) -> Emploi:
        """Ce qui se règle sur un emploi, en un seul geste.

        **Le porteur n'en fait pas partie, et c'est délibéré.** Changer le
        porteur d'un emploi laisserait ses calques sous l'ancien — ils portent
        son identifiant, pas celui de l'emploi —, et l'écran montrerait un
        vestiaire vide à côté de dix images bien vivantes. Se tromper de porteur
        se répare en retirant l'emploi et en en créant un autre : le geste dit
        alors ce qu'il fait, et les images ne bougent toujours pas.
        """
        objet = self._exiger(projet)
        visee = self._exiger_piece(objet, piece)
        deja = self._a_declarer(objet, visee)
        courant = _exiger_emploi(deja, identifiant)

        range_dans = (
            courant.emplacement
            if emplacement is None
            else (self._emplacement_ou_creer(projet, emplacement) if emplacement else "")
        )
        reglé = replace(
            courant,
            nom=courant.nom if nom is None else nom.strip(),
            emplacement=range_dans,
            devant=courant.devant if devant is None else bool(devant),
            description=(
                courant.description if description is None else description.strip()
            ),
        )
        objet = self._exiger(projet)  # relu : l'emplacement neuf y est
        self._poser_emplois(
            objet,
            visee.identifiant,
            tuple(reglé if e.identifiant == identifiant else e for e in deja),
        )
        return reglé

    def retirer_emploi(self, projet: str, piece: str, identifiant: str) -> Emploi:
        """L'emploi part, **ses images restent** — jamais de cascade.

        C'est la phrase de la planche, tenue au mot : *« Retirer un porteur ne
        supprime pas ses images : elles restent dans la galerie, détachées. »*
        Elles gardent l'identifiant de la pièce et celui du personnage ; remettre
        l'emploi les remet dans sa colonne, exactement comme une pièce retirée
        puis remise retrouve ses calques.

        **Et il ne revient pas tout seul.** Le geste déclare la pièce du même
        coup : la déduction qui lisait les calques ne sera plus jamais consultée
        pour elle, sans quoi le porteur retiré reparaîtrait à la relecture
        suivante, ses images étant toujours là.
        """
        objet = self._exiger(projet)
        visee = self._exiger_piece(objet, piece)
        deja = self._a_declarer(objet, visee)
        retire = _exiger_emploi(deja, identifiant)
        self._poser_emplois(
            objet,
            visee.identifiant,
            tuple(e for e in deja if e.identifiant != identifiant),
        )
        return retire

    def _poser_emplois(
        self, objet: Projet, piece: str, emplois: tuple[Emploi, ...]
    ) -> None:
        """Écrire les emplois d'une pièce — **le seul chemin d'écriture**.

        ⚠️ Il reconstruit une `Piece` comme `regler_piece`, et pour la même
        raison : la dataclass a des `slots`, et un `replace` y marche, mais deux
        façons d'écrire une pièce finiraient par diverger d'un champ. Celui-ci
        passe par `replace` et ne nomme donc **aucun** champ : un champ ajouté
        plus tard le traverse sans qu'on ait à y penser.
        """
        courante = self._exiger_piece(objet, piece)
        posee = replace(courante, emplois=emplois)
        objet.pieces = tuple(
            posee if p.identifiant == piece else p for p in objet.pieces
        )
        self._sauver(objet)

    # **Le vestiaire d'un personnage ne s'écrit pas ici**, et c'est voulu : c'est
    # `ServiceProduction.pieces_du_personnage` qui le rend, parce que c'est
    # `en_charge` qui le porte à l'écran et qu'un sujet n'a qu'une forme quand il
    # franchit le port. Deux méthodes du même nom dans deux services auraient fini
    # par répondre deux choses. La règle, elle, est écrite une fois dans le
    # domaine — `emplois_resolus` — et les deux la lisent.

    def vestiaire_du_jeu(self, projet: str) -> dict[str, Any]:
        """Les pièces, leurs emplois résolus, et ce que chacun a de fait.

        **Séparée de `vestiaire`, et il le fallait.** `vestiaire` est la forme
        que porte chaque geste et chaque annonce du flux : elle se déduit du seul
        fichier du projet, sans toucher aux images, et un geste sur un nom de
        pièce n'a pas à payer un balayage des calques. Celle-ci lit les images —
        c'est ce qui lui permet de rendre les emplois d'une pièce jamais déclarée
        et le compte de chacun —, et elle n'est appelée que par les écrans qui
        les montrent.

        **Le compte est celui de la charge d'un sujet, pas un second.** Une pose
        réclame ce que `reclame` dit qu'elle réclame, et le calque se compte
        comme le corps : plafonné à ce qui est demandé, jamais 250 %.
        """
        objet = self._exiger(projet)
        porteurs = [
            p
            for p in self._production.personnages(projet)
            if self._production.porte_de_lequipement(projet, p)
        ]
        # Une lecture par personnage, comme `portee_de_la_piece` en fait une
        # depuis E15 — et pas une par pièce : un jeu a peu de personnages et peu
        # de pièces, mais le produit des deux se paierait.
        calques: dict[tuple[str, str], set[str]] = {}
        attendus: dict[str, int] = {}
        for qui in porteurs:
            for asset in self._base.assets_du_personnage(
                qui.identifiant, projet=projet
            ):
                if asset.piece and asset.pose:
                    calques.setdefault((asset.piece, qui.identifiant), set()).add(
                        asset.pose
                    )
            attendus[qui.identifiant] = len(
                qui.tenues(self._production.plan_de(projet, qui))
            )

        noms = {p.identifiant: p.nom for p in porteurs}
        emplacements = {e.identifiant: e.nom for e in objet.emplacements}

        pieces: list[dict[str, Any]] = []
        for piece in objet.pieces:
            siens = self._emplois_de(objet, piece)
            rendus: list[dict[str, Any]] = []
            for emploi in siens:
                # **Un emploi qui n'est pas porté ne réclame qu'une image**, et
                # elle ne se fabrique pas encore (voir le domaine) : le compte le
                # dit à 0 / 1 plutôt que d'inventer une case.
                attendu = attendus.get(emploi.porteur, 0) if emploi.porte else 1
                fait = (
                    len(calques.get((piece.identifiant, emploi.porteur), ()))
                    if emploi.porte
                    else 0
                )
                rendus.append(
                    {
                        **emploi.en_json(),
                        # **Déduit veut dire « lu sur les images, pas déclaré »** :
                        # l'écran le dit, parce qu'un emploi déduit disparaît si
                        # ses images disparaissent, quand un emploi déclaré reste.
                        "deduit": piece.emplois is None,
                        # **Un porteur qui n'existe plus se voit, jamais de
                        # cascade** — c'est déjà ce que la matrice fait d'une
                        # image dont la direction a été retirée. Retirer un
                        # personnage ne va pas nettoyer les pièces derrière lui :
                        # l'orphelin se dit et se retire d'un clic.
                        "orphelin": bool(emploi.porte and emploi.porteur not in noms),
                        "porteur_nom": noms.get(emploi.porteur, emploi.porteur),
                        "emplacement_nom": emplacements.get(
                            emploi.emplacement or piece.emplacement, ""
                        ),
                        "fait": min(fait, attendu),
                        "attendu": attendu,
                    }
                )
            pieces.append(
                {
                    "piece": piece.en_json(),
                    "declare": piece.emplois is not None,
                    "emplois": rendus,
                    "fait": sum(e["fait"] for e in rendus),
                    "attendu": sum(e["attendu"] for e in rendus),
                }
            )

        return {
            "projet": objet.identifiant,
            "emplacements": [
                e.en_json() for e in sorted(objet.emplacements, key=lambda x: x.rang)
            ],
            "pieces": pieces,
            "porteurs": [{"identifiant": p.identifiant, "nom": p.nom} for p in porteurs],
        }

    def concept_arts(self, projet: str, piece: str | None) -> tuple[str, ...]:
        """Les cartes qu'une pièce désigne — même règle qu'un personnage (US-124).

        Une pièce disparue ne fait pas tomber l'appel : elle ne désigne plus
        rien, c'est tout.
        """
        if not piece:
            return ()
        try:
            return self.piece(projet, piece).concept_arts
        except (PieceInconnue, ProjetInconnu):
            return ()

    # ── Les corps que la planche habille ─────────────────────────────────────

    def corps(self, projet: str, personnage: str) -> dict[str, Asset]:
        """Le corps retenu pour chaque pose de ce personnage.

        **Le favori d'abord, sinon la plus récente** — et la règle vient de
        `ServiceProduction.corps_retenu`, celle-là même que la matrice affiche.
        Deux règles à deux endroits finiraient par désigner deux images
        différentes, et l'écran montrerait alors autre chose que ce qui part.

        **Un calque n'est jamais un corps.** Il porte la même pose, mais il porte
        aussi une pièce : c'est ce qui l'écarte, et c'est aussi ce qui interdit
        d'habiller un habillage sans que personne l'ait demandé.
        """
        par_pose: dict[str, list[Asset]] = {}
        for asset in self._base.assets_du_personnage(personnage):
            if not asset.pose or asset.piece:
                continue
            par_pose.setdefault(asset.pose, []).append(asset)
        retenus = {
            pose: corps_retenu(images) for pose, images in par_pose.items()
        }
        return {pose: corps for pose, corps in retenus.items() if corps is not None}

    def plier(
        self, projet: str, personnage: str, piece: str, poses: Sequence[str]
    ) -> Pliage:
        """Les cases d'une planche d'équipement, **vérifiées avant qu'un centime
        parte** (US-141).

        Deux refus, et ils portent leur raison : une pose que ce personnage-là ne
        tient pas — c'est `viser`, la règle de C1 réemployée telle quelle —, et
        une pose qui n'a pas encore de corps. Le second est le refus de la
        tranche : **on ne paie jamais pour habiller une case vide**, et il ne
        peut pas être laissé à l'écran, qui n'a que la matrice qu'on lui a
        envoyée et pas celle du disque à l'instant du clic.

        **Une seule pose suffit.** Le lot de C2 en exigeait deux — une pose seule
        n'y était pas un lot mais la génération de C1, et la plier aurait fait
        payer un gabarit pour rien. Ici il n'y a pas d'autre chemin : un calque
        ne se fabrique que par une planche, fût-elle d'une case.
        """
        objet = self._exiger(projet)
        piece_visee = self._exiger_piece(objet, piece)
        disponibles = self.corps(projet, personnage)

        cases: list[CasePliee] = []
        for identifiant in dict.fromkeys(poses):
            _, pose = self._production.viser(projet, personnage, identifiant)
            corps = disponibles.get(pose.identifiant)
            if corps is None:
                raise ProductionRefusee(
                    f"« {pose.nom} » n'a pas encore de corps — une planche "
                    f"d'équipement part des corps qui existent, et n'en crée aucun"
                )
            cases.append(
                CasePliee(texte=pose.nom, pose=pose.identifiant, base=corps.identifiant)
            )

        if not cases:
            raise ProductionRefusee(
                "une planche d'équipement demande au moins une pose à habiller"
            )
        return Pliage(
            cases=tuple(cases),
            geometrie_connue=True,
            occupation=(
                OCCUPATION_AGRANDIT if piece_visee.agrandit else OCCUPATION_CONTENUE
            ),
        )

    def planche(self, pliage: Pliage) -> bytes:
        """La planche qui part — composée du geste, **jamais enregistrée**.

        Même règle que le gabarit de C2 : elle se redessine à la soumission comme
        à la relance à partir des corps que les cases désignent, donc les deux
        envoient exactement la même chose et rien de neuf ne traîne sur le
        disque. C'est aussi ce qui la rend impossible à confondre avec un asset :
        elle n'en est pas un, elle ne se range pas, elle ne s'exporte pas.

        **Le rendu du corps, pas son brut** : c'est l'image telle qu'elle vit
        dans la bibliothèque, celle que l'auteur a jugée, avec la grille et la
        palette de son projet. Envoyer le brut demanderait au modèle d'habiller
        une image que personne ne regarde.
        """
        corps: list[bytes] = []
        for case in pliage.cases:
            asset = self._assets.lire(case.base or "")
            if asset is None:
                raise ProductionRefusee(
                    "un corps de cette planche a quitté la bibliothèque — "
                    "la planche se recompose des images qu'elle désigne"
                )
            octets, _ = self._assets.octets(asset)
            corps.append(octets)
        return composer(corps, pliage.geometrie, pliage.occupation)

    # ── Ce qui revient ───────────────────────────────────────────────────────

    def deplier(self, generation: Generation, rang: int) -> list[Asset]:
        """La planche revenue devient N calques — **un par pose** (US-140).

        Le découpage, le compte et son refus viennent de `ServicePliage` : c'est
        le même pliage que C2, réemployé sans une ligne de plus. Ce qui est ici
        est ce que C2 ne sait pas faire — comparer chaque case à l'avant que
        l'atelier connaît exactement, et non à un avant deviné (US-142).

        **Rien n'est écrit avant que tout soit mesuré.** Les N retours sont
        calculés d'abord, la décision est prise ensuite, et l'écriture vient en
        dernier : « aucun calque » quand l'échelle a dérivé est alors vrai au
        pied de la lettre, et pas rattrapé après coup par une suppression qui
        pourrait échouer à moitié. C'est la règle du compte de C2, appliquée à
        l'autre verdict de la tranche.
        """
        emplacement = generation.emplacement(rang)
        if generation.pliage is None or emplacement is None or emplacement.resultat is None:
            return []  # pragma: no cover — l'atelier ne déplie que ce qui est arrivé

        retours, mesures_lot, empile = self._lire_planche(generation, rang)
        # **Le dépliage n° 1, comme en C2** (P1) — même réservation, mêmes
        # rangs d'un seul tenant ; les coupes sont les cases de la grille posée.
        depliage = self._pliage.reserver(
            generation,
            emplacement,
            [
                mesures_lot[index].boite if index < len(mesures_lot) else (0, 0, 0, 0)
                for index in range(len(retours))
            ],
        )
        nes: list[Asset] = []
        for index, (case, base, retour, octets) in enumerate(retours):
            nes.append(
                self._accueillir(
                    generation,
                    case,
                    base,
                    retour,
                    octets,
                    depliage.rangs[index],
                    mesures_lot[index] if index < len(mesures_lot) else None,
                    empile,
                    planche=depliage.planche,
                    depliage=depliage.identifiant,
                )
            )

        # **Et la planche elle-même** (G16) — la même que celle de C2, par le
        # même chemin : ce que le modèle a renvoyé entre en bibliothèque, à côté
        # des calques qu'on en a tirés. C'est ici qu'elle compte le plus : sur
        # un équipement, l'image rangée n'est pas la case telle qu'elle est
        # arrivée, mais celle qui a été mise à l'échelle et calée sur le corps.
        self._pliage.accueillir_planche(generation, emplacement)

        # L'arbre compte les assets par projet : N de plus changent ces comptes,
        # et personne d'autre ne les recalcule. Une fois, à la fin.
        self._diffusion.publier("bibliotheque", self._bibliotheque.arbre())
        return nes

    # ── Le rejeu ─────────────────────────────────────────────────────────────

    def recaler(self, identifiant: str) -> list[Asset]:
        """Rejouer le recalage d'une planche déjà dépliée (US-173, R5).

        **Une planche déjà dépliée ne réaccouche jamais.** Redéplier créerait N
        assets de plus, à des rangs neufs, et il faudrait supprimer les anciens ;
        or un calque désigne son corps par **identifiant**, donc redéplier un lot
        de corps de C2 laisserait orphelins tous les calques posés dessus. Ce
        n'est pas un geste, c'est un piège. Ce qui se rejoue est le *calcul*, sur
        les assets qu'il a déjà produits : même identifiant, même rang, même
        fichier, même place en bibliothèque.

        **Le périmètre est l'alignement, et le verdict qui en dépend.** Rien de
        plus, parce que rien de plus n'est figé : le seuil, le masque et le
        calcul de différence vivent dans la recette et se rejouent à chaque
        rendu depuis C3. Ce qui est dans le brut, et seulement là, c'est
        l'échelle et le décalage trouvés au dépliage — et le verdict calque /
        corps habillé, qui se lit sur cette échelle-là.

        **Le verdict se rejoue par planche, jamais par case** : *un appel, une
        pièce, un verdict* est l'invariant de C3, et partir d'un asset pour
        traiter toute sa planche est ce qui le préserve.

        Aucun `fournisseur`, aucun centime : la planche et les corps sont déjà
        sur le disque, et la mesure juste coûte des millisecondes.
        """
        asset = self._assets.lire(identifiant)
        if asset is None:
            raise ProductionRefusee(f"aucun asset « {identifiant} »")

        generation = self._base.lire(asset.generation)
        pliage = generation.pliage if generation is not None else None
        if generation is None or pliage is None or not pliage.geometrie_connue:
            raise ProductionRefusee(
                "cette image n'est pas sortie d'une planche d'équipement — "
                "il n'y a pas de recalage à rejouer"
            )

        emplacement = next(
            (e for e in generation.emplacements if e.resultat is not None), None
        )
        # **La planche est la seule chose qu'on ne sait pas refaire.** Les corps,
        # eux, se relisent ; elle, elle a été payée. Absente, le geste ne touche
        # à rien et le dit avec son chemin — la raison se répète à l'auteur, qui
        # peut aller voir.
        if emplacement is None or not self._fichiers.existe(emplacement.resultat.fichier):
            raise ProductionRefusee(
                "la planche qui a payé cette image n'est plus sur le disque — "
                "le recalage ne se rejoue pas sans elle"
            )

        rangs = self._rangs_du_depliage(generation)
        if len(rangs) != len(pliage.cases):
            raise ProductionRefusee(
                f"{len(rangs)} image{'s' if len(rangs) > 1 else ''} rangée"
                f"{'s' if len(rangs) > 1 else ''} pour {len(pliage.cases)} cases — "
                "le rejeu ne saurait pas laquelle recaler"
            )

        # **Rien n'est écrit avant que tout soit mesuré**, comme au dépliage : le
        # verdict porte sur la planche entière, donc il se prend avant la
        # première écriture.
        retours, mesures_lot, empile = self._lire_planche(generation, emplacement.rang)

        rejoues: list[Asset] = []
        for index, (case, base, retour, octets) in enumerate(retours):
            ancien = self._assets.lire(identifiant_de(generation.identifiant, rangs[index]))
            if ancien is None:  # pragma: no cover — le rang vient de l'index
                continue
            rejoues.append(
                self._reposer(
                    generation,
                    ancien,
                    case,
                    base,
                    retour,
                    octets,
                    mesures_lot[index] if index < len(mesures_lot) else None,
                    empile,
                )
            )

        # Rien n'est né ni mort : l'arbre compte le même nombre d'assets. Ce qui
        # a changé, ce sont les images, et chaque asset l'a déjà annoncé.
        return rejoues

    # ── Ce qui est arrivé, avant que l'atelier n'y touche ────────────────────

    def a_une_case_arrivee(self, identifiant: str) -> bool:
        """Cette image a-t-elle une case arrivée qu'on saurait retrouver ?

        **Bon marché exprès** : elle ne décode aucune image. L'écran de
        superposition la pose à chaque ouverture, pour savoir s'il propose le
        geste ou pas — et proposer un geste qui échouera est pire que ne pas le
        proposer.
        """
        asset = self._assets.lire(identifiant)
        if asset is None or asset.recette.difference is None:
            return False
        generation = self._base.lire(asset.generation)
        pliage = generation.pliage if generation is not None else None
        if generation is None or pliage is None or not pliage.geometrie_connue:
            return False
        emplacement = next(
            (e for e in generation.emplacements if e.resultat is not None), None
        )
        if emplacement is None or emplacement.resultat is None:
            return False
        return self._fichiers.existe(emplacement.resultat.fichier)

    def case_arrivee(self, identifiant: str) -> tuple[bytes, str]:
        """La case de ce calque **telle qu'elle est arrivée du modèle** (G16).

        **Le mot *brut* désignait deux choses, et c'est ce qui a fait écrire la
        remarque.** Le brut rangé d'un corps habillé est la case telle qu'elle
        est arrivée ; celui d'un calque est la case *déjà mise à l'échelle et
        calée sur son corps* — `_accueillir` le dit en toutes lettres. Deux
        images d'une même planche, deux sens du même mot, et rien à l'écran ne
        disait lequel on regardait. Cette méthode rend l'autre.

        **Elle ne range rien, et c'est la décision de la tranche.** La case se
        **recalcule** de la planche à chaque demande, exactement comme le rejeu
        du recalage la recalcule — la garder doublerait sur le disque chaque
        équipement payé, pour une image qu'on ne regarde qu'en cas de doute.

        **Aucun appel, aucun centime** : la planche est là, et le découpage
        coûte des millisecondes. C'est la même promesse que `recaler`.
        """
        asset = self._assets.lire(identifiant)
        if asset is None:
            raise ProductionRefusee(f"aucun asset « {identifiant} »")

        generation = self._base.lire(asset.generation)
        pliage = generation.pliage if generation is not None else None
        if generation is None or pliage is None or not pliage.geometrie_connue:
            raise ProductionRefusee(
                "cette image n'est pas sortie d'une planche d'équipement — "
                "il n'y a pas de case arrivée à retrouver"
            )

        emplacement = next(
            (e for e in generation.emplacements if e.resultat is not None), None
        )
        # **La planche est la seule chose qu'on ne sait pas refaire**, et le
        # refus est le même mot pour mot que celui du rejeu : c'est le même
        # fait, et deux phrases pour un seul fait finissent par se contredire.
        if emplacement is None or not self._fichiers.existe(
            emplacement.resultat.fichier
        ):
            raise ProductionRefusee(
                "la planche qui a payé cette image n'est plus sur le disque — "
                "la case telle qu'elle est arrivée ne se retrouve pas sans elle"
            )

        rangs = self._rangs_du_depliage(generation)
        if asset.rang not in rangs or len(rangs) != len(pliage.cases):
            raise ProductionRefusee(
                "le découpage de cette planche ne correspond plus à ses cases — "
                "la case telle qu'elle est arrivée ne se retrouve pas"
            )

        # **Le découpage seul, pas le recalage** — mesuré au navigateur le
        # 4 septembre 2026 : passer par `_lire_planche` coûtait **2,5 s** par
        # affichage, parce qu'il aligne *chaque* case sur *son* corps pour
        # produire les calques. Or ce qu'on rend ici est la case **avant** tout
        # ça : le découpage suffit, et il est la moitié bon marché du travail.
        # Le rejeu, lui, garde `_lire_planche` — il a besoin des alignements.
        morceaux, _ = self._pliage.decouper_retour(generation, emplacement)
        index = rangs.index(asset.rang)
        if index >= len(morceaux):  # pragma: no cover — le compte est vérifié
            raise ProductionRefusee("cette case n'est pas dans la planche")
        octets = morceaux[index]
        return octets, mesurer(octets).type_media

    # ── Le masque ────────────────────────────────────────────────────────────

    def borner(self, identifiant: str, zone: Sequence[int] | None) -> Asset:
        """Poser, déplacer ou retirer le masque rectangle d'un calque (US-145).

        **Le journal du projet ne bouge pas d'un centime** : c'est vrai par
        construction, et ça se lit dans ce fichier — il n'y a pas de
        `fournisseur` ici. Le calque se recalcule à partir de l'image déjà payée
        et du corps déjà là.

        `None` retire le masque : **revenir à la différence brute est un geste
        unique** (`docs/archive/plan-versions-tenues.md`, C3), et c'est celui-ci, pas un autre.
        """
        asset = self._assets.lire(identifiant)
        if asset is None or asset.recette.difference is None:
            raise ProductionRefusee(
                "seul un calque porte un masque — cette image n'en est pas un"
            )
        rectangle = tuple(int(v) for v in zone) if zone else None
        if rectangle is not None and len(rectangle) != 4:
            raise ProductionRefusee("un masque rectangle a quatre bornes")
        return self._assets.poser_recette(
            identifiant,
            replace(
                asset.recette,
                difference=replace(asset.recette.difference, zone=rectangle),
            ),
        )

    # ── La main ──────────────────────────────────────────────────────────────

    def affiner(
        self, identifiant: str, couche: str, traits: Sequence[Any]
    ) -> Asset:
        """Poser une couche de la main sur un calque (C4, US-149, US-150, US-153).

        **Deux couches, un seul geste**, et c'est ce qui les garde séparées : la
        couche visée est un argument, pas un second chemin de code. `masque`
        affine ce que la différence a le droit de garder ; `retouche` tranche sur
        ce qu'elle a rendu. Écrire l'une n'écrit jamais dans l'autre — la recette
        porte deux champs, et `replace` n'en touche qu'un.

        **La liste est entière, jamais un ajout.** Un geste envoie ce que la main
        a posé depuis le début, dans l'ordre ; deux onglets qui empileraient des
        deltas ne convergeraient jamais, et c'est déjà la règle des références
        écartées. **Une liste vide annule la couche** — « chaque couche
        s'annule » (`docs/archive/plan-versions-tenues.md`, C4), et c'est ce geste-ci, pas un autre.

        **Pas un centime, pas un pixel de carte graphique** : la retouche se
        recalcule à partir de l'image déjà payée et du corps déjà là, sur le
        processeur, comme tout ce fichier. Ça se lit dans ses imports.
        """
        if couche not in COUCHES:
            raise ProductionRefusee(
                f"couche inconnue « {couche} » — "
                + " ou ".join(f"« {c} »" for c in COUCHES)
            )
        asset = self._assets.lire(identifiant)
        if asset is None or asset.recette.difference is None:
            raise ProductionRefusee(
                "seule la main d'un calque se pose — cette image n'en est pas un"
            )
        poses = traits_depuis_json(list(traits))
        return self._assets.poser_recette(
            identifiant,
            replace(
                asset.recette,
                difference=replace(asset.recette.difference, **{couche: poses}),
            ),
        )

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _rangs_du_depliage(self, generation: Generation) -> list[int]:
        """Les rangs que le **dépliage** a écrits, dans l'ordre, et eux seuls.

        `deplier` a pris `premier + index` case par case : le n-ième rang est
        donc la n-ième case, et c'est ce qui permet au rejeu comme à la case
        arrivée de retrouver la leur. Les supprimés comptent — leur rang reste
        pris —, et un compte qui ne tombe pas juste veut dire qu'une purge est
        passée : on refuse plutôt que de deviner quelle case a perdu son image.

        **Ce qui ne vient pas du dépliage ne compte pas, et c'est la réparation
        du 4 septembre 2026.** Une superposition écrit son résultat dans le
        dossier de la même génération, au premier rang libre — donc au-dessus
        des cases, sans en remplir aucune. L'atelier lisait alors *« cinq images
        rangées pour quatre cases »* et refusait **le rejeu du recalage et la
        case arrivée sur toute la planche**, pour toujours : fabriquer un calque
        à la main cassait le geste qui l'avait fabriqué. Trouvé en usage, sur le
        chemin ouvert par `G16` ; le défaut, lui, attendait depuis que `E6` et
        `R5` se sont croisés sans se voir.

        **Ce qui les distingue est ce qui les a faites.** Une image dépliée n'a
        ni parent ni superposition — elle sort d'une case, pas d'une autre
        image. Un drapeau de plus aurait été une seconde vérité sur une question
        à laquelle la filiation répond déjà.
        """
        rangs: list[int] = []
        for rang in self._base.rangs_de_generation(generation.identifiant):
            if rang < RANG_PLIAGE:
                continue
            asset = self._base.lire_asset(
                identifiant_de(generation.identifiant, rang)
            )
            # Un rang sans asset est un supprimé purgé : il ne compte pas non
            # plus, et le compte dira alors qu'une purge est passée.
            if asset is None:
                continue
            if asset.parent or asset.superposition is not None:
                continue
            rangs.append(rang)
        return sorted(rangs)

    def _lire_planche(
        self, generation: Generation, rang: int
    ) -> tuple[
        list[tuple[CasePliee, Asset | None, Retour | None, bytes]],
        list[MesuresLot],
        bool,
    ]:
        """Ce que la planche revenue dit, case par case — **et rien d'écrit**.

        Écrite à part parce que **le dépliage et le rejeu doivent tomber sur
        exactement le même calcul** : deux lectures écrites à deux endroits
        finiraient par diverger, et recaler changerait alors le résultat pour une
        raison qui n'est pas le défaut qu'on répare. C'est la même raison qui a
        sorti `decouper_retour` de `deplier` en C3.

        Le découpage, le compte et son refus viennent de `ServicePliage` ; ce qui
        est ici est ce que C2 ne sait pas faire — retrouver dans chaque case
        l'avant que l'atelier connaît exactement (US-142).

        **Elle reçoit un rang, pas un emplacement**, comme tout ce fichier : le
        mot désigne ici une place sur un corps, et nommer le type de la
        génération le ferait dire deux choses.
        """
        pliage = generation.pliage
        emplacement = generation.emplacement(rang)
        if pliage is None or emplacement is None or emplacement.resultat is None:
            return [], [], True  # pragma: no cover — l'appelant l'a déjà vérifié

        morceaux, mesures_lot = self._pliage.decouper_retour(generation, emplacement)
        envoyees = cases_de(COTE, COTE, pliage.geometrie)
        retours: list[tuple[CasePliee, Asset | None, Retour | None, bytes]] = []
        for index, (case, octets) in enumerate(zip(pliage.cases, morceaux)):
            base = self._assets.lire(case.base or "")
            if base is None:
                retours.append((case, None, None, octets))
                continue
            corps = avec_alpha(self._assets.octets(base)[0])
            hauteur, largeur = corps.shape[:2]
            retours.append(
                (
                    case,
                    base,
                    recadrer_sur(
                        avec_alpha(octets),
                        place_de(largeur, hauteur, envoyees[index], pliage.occupation),
                        envoyees[index],
                        corps,
                    ),
                    octets,
                )
            )
        return retours, mesures_lot, self._empile(self._piece_de(generation), retours)

    def _reposer(
        self,
        generation: Generation,
        ancien: Asset,
        case: CasePliee,
        base: Asset | None,
        retour: Retour | None,
        octets: bytes,
        lot: MesuresLot | None,
        empile: bool,
    ) -> Asset:
        """Une case recalculée reprend la place de celle qu'elle remplace.

        **Ce qui ne bouge pas est la liste longue, et c'est le point** :
        identifiant, rang, label, projet, collection, favori, épingle, coût,
        provenance, modèle, personnage, pose, pièce, date, suppression en cours.
        Rien de tout cela ne sort d'un calcul, donc rien de tout cela n'a de
        raison d'être recalculé — et c'est ce qui fait qu'aucun calque ne perd sa
        base : l'identifiant qu'il désigne est toujours le même.

        **Le masque survit au rejeu**, tant que l'image reste un calque : c'est
        du travail de la main, pas un résultat de mesure. Il ne survit pas à un
        changement de verdict, parce qu'un corps habillé n'a pas de masque —
        et il revient dès que le verdict revient. **Les deux couches de la main
        de C4 le suivent**, et par la même ligne : la différence est reprise par
        `replace`, donc tout ce que la main y avait posé reste posé. C'était déjà
        la promesse de R5, et C4 n'a rien eu à y ajouter — ce qui est la preuve
        que la couche est au bon endroit.

        La recette, elle, ne se remplace **que si le verdict a changé**. Un
        calque qui reste calque garde la sienne, zone comprise ; un corps habillé
        qui reste corps habillé garde la sienne, retouches comprises. Repartir de
        zéro à chaque rejeu effacerait le détourage ou la grille que l'auteur a
        posés à la main sur un corps habillé, sans que rien ne l'ait demandé.
        """
        calque = empile and base is not None and retour is not None
        etait_calque = ancien.recette.calque
        if calque:
            image = _png(retour.image)
            zone = (
                ancien.recette.difference.zone
                if ancien.recette.difference is not None
                else None
            )
            recette = (
                replace(
                    ancien.recette,
                    difference=replace(
                        ancien.recette.difference, base=base.identifiant, zone=zone
                    ),
                )
                if etait_calque and ancien.recette.difference is not None
                else Recette(difference=Difference(base=base.identifiant))
            )
        else:
            image = octets
            recette = (
                ancien.recette
                if not etait_calque
                else self._assets.recette_du_projet(generation, PLANCHE)
            )

        ancien.brut = self._fichiers.ecrire_brut(
            generation.identifiant, ancien.rang, image, ".png"
        )
        with Image.open(io.BytesIO(image)) as ouverte:
            ancien.largeur, ancien.hauteur = ouverte.size
        ancien.type_media = "image/png"
        ancien.recette = recette
        ancien.label = _label(generation, case, self._piece_de(generation))
        ancien.lot = lot
        ancien.calque = (
            mesurer_calque(
                avec_alpha(self._assets.octets(base)[0]),
                retour,
                Difference().seuil,
            )
            if base is not None and retour is not None
            else MesuresCalque()
        )
        return self._assets.reposer(ancien)

    def _empile(
        self,
        piece: Piece | None,
        retours: Sequence[tuple[CasePliee, Asset | None, Retour | None, bytes]],
    ) -> bool:
        """Ce qui revient fera-t-il des calques, ou des corps habillés ?

        **Une seule case qui dérive décide pour la planche entière** (US-148), et
        c'est délibéré : un appel, une pièce, un verdict. Rendre trois calques et
        deux corps habillés du même lot ferait un état que personne ne sait lire
        — et la dérive est une propriété de la façon dont le modèle a traité *la
        pièce*, pas de telle ou telle pose.

        La question ne se pose que pour une pièce **qui agrandit** la silhouette.
        Une pièce contenue fait toujours son calque : les mesures diront ce
        qu'elles ont à dire, et **aucune ne refuse à la place de l'auteur**
        (US-147).
        """
        if piece is None or not piece.agrandit:
            return True
        return all(
            retour is not None and abs(retour.echelle - 1.0) <= ECHELLE_TOLEREE
            for _, _, retour, _ in retours
        )

    def _accueillir(
        self,
        generation: Generation,
        case: CasePliee,
        base: Asset | None,
        retour: Retour | None,
        octets: bytes,
        rang: int,
        lot: MesuresLot | None,
        empile: bool,
        *,
        planche: str | None = None,
        depliage: str | None = None,
    ) -> Asset:
        """Une case revenue devient un asset — calque, ou corps habillé.

        **La différence entre les deux tient dans la recette, et nulle part
        ailleurs.** Un calque porte une `Difference` et son brut est la case
        ramenée dans le cadre du corps ; un corps habillé porte la recette du
        projet, comme n'importe quelle image reçue, et son brut est la case telle
        qu'elle est arrivée. Aucun drapeau ne les distingue : l'écran lit la
        recette (`recette.calque`), et il n'y a donc rien à tenir d'accord.
        """
        calque = empile and base is not None and retour is not None
        if calque:
            image = _png(retour.image)
            recette = Recette(difference=Difference(base=base.identifiant))
        else:
            image = octets
            recette = self._assets.recette_du_projet(generation, PLANCHE)

        chemin = self._fichiers.ecrire_brut(
            generation.identifiant, rang, image, ".png"
        )
        with Image.open(io.BytesIO(image)) as ouverte:
            largeur, hauteur = ouverte.size

        return self._assets.accueillir(
            Asset(
                identifiant=identifiant_de(generation.identifiant, rang),
                generation=generation.identifiant,
                rang=rang,
                brut=chemin,
                largeur=largeur,
                hauteur=hauteur,
                type_media="image/png",
                label=_label(generation, case, self._piece_de(generation)),
                recette=recette,
                # **Une image dépliée n'a rien coûté seule.** L'argent a été
                # dépensé une fois, pour l'appel, et le journal du projet le
                # porte. Même règle que les corps de C2 et les découpes de T5.
                consomme=0.0,
                unite=generation.unite,  # zéro, mais dans l'unité de l'appel (F2)
                provenance=generation.provenance,
                modele=generation.modele,
                projet=generation.projet,
                personnage=generation.personnage,
                pose=case.pose,
                # **La colonne que cette image remplit** (US-140). Portée par le
                # calque comme par le corps habillé : les deux parlent de la même
                # pièce, et c'est la recette qui dit ce qu'ils sont.
                piece=generation.piece,
                lot=lot,
                # Sa planche et son dépliage (P1), comme un corps de C2.
                planche=planche,
                depliage=depliage,
                calque=(
                    mesurer_calque(
                        avec_alpha(self._assets.octets(base)[0]),
                        retour,
                        Difference().seuil,
                    )
                    if base is not None and retour is not None
                    else MesuresCalque()
                ),
                # **Datée du lot**, comme les corps de C2 : les N images sont
                # arrivées ensemble, et le rang les départage dans l'ordre de
                # lecture de la planche.
                cree_le=generation.cree_le,
            )
        )

    def _piece_de(self, generation: Generation) -> Piece | None:
        if not generation.piece or not generation.projet:
            return None
        try:
            return self.piece(generation.projet, generation.piece)
        except (PieceInconnue, ProjetInconnu):
            # Une pièce supprimée entre la soumission et l'arrivée ne fait pas
            # tomber le rangement : ce qui revient est payé, et il entre. Le
            # verdict retombe alors sur « contenue », qui est le défaut.
            return None

    def _exiger(self, projet: str) -> Projet:
        objet = self._base.lire_projet(projet) if projet else None
        if objet is None:
            raise ProjetInconnu(
                projet, [p.identifiant for p in self._bibliotheque.projets()]
            )
        return objet

    @staticmethod
    def _exiger_emplacement(objet: Projet, identifiant: str) -> Emplacement:
        for e in objet.emplacements:
            if e.identifiant == identifiant:
                return e
        raise EmplacementInconnu(identifiant)

    @staticmethod
    def _exiger_piece(objet: Projet, identifiant: str) -> Piece:
        for p in objet.pieces:
            if p.identifiant == identifiant:
                return p
        raise PieceInconnue(identifiant)

    def _emplacement_ou_creer(self, projet: str, nom: str) -> str:
        """Un emplacement désigné par son identifiant, par son nom, ou créé.

        **Nommer, c'est créer** (US-138), et l'écrire ici plutôt qu'à l'écran est
        ce qui rend la règle vraie pour l'agent aussi : « ce que l'écran peut
        faire, l'agent le peut » vaut dans les deux sens depuis R3.
        """
        propre = (nom or "").strip()
        if not propre:
            return ""
        objet = self._exiger(projet)
        for e in objet.emplacements:
            if e.identifiant == propre or e.nom.casefold() == propre.casefold():
                return e.identifiant
        return self.ajouter_emplacement(projet, propre).identifiant

    def _sauver(self, objet: Projet) -> None:
        """Le projet passe par sa bibliothèque, **seul écrivain d'un projet** —
        la règle de l'univers et du plan, appliquée telle quelle.

        Puis l'annonce, sous son propre genre : ce qui est annoncé est donc
        toujours déjà sur le disque. **Pas sur `univers`**, qui fait redemander
        l'état *et* le catalogue depuis T4 (`docs/PIEGES.md`) — une pièce
        renommée n'a aucune raison de coûter deux appels réseau —, et pas sur
        `plan` non plus : un lecteur du plan n'a rien à faire d'un vestiaire.
        """
        self._bibliotheque.sauver_projet(objet)
        self._diffusion.publier("vestiaire", self.en_json(objet))

    def vestiaire(self, projet: str) -> dict[str, Any]:
        """Les emplacements et les pièces d'un projet, **en une seule forme** —
        la même que l'annonce du flux (voir `en_json`)."""
        return self.en_json(self._exiger(projet))

    def en_json(self, objet: Projet) -> dict[str, Any]:
        """Le vestiaire d'un projet, **en une seule forme**.

        La réponse d'un geste et l'annonce du flux portent la même : un écran
        fond ce qui lui arrive par les deux chemins avec le même code, et il n'a
        jamais à deviner si une pièce vient d'être ajoutée, réglée ou retirée.
        C'est la leçon de C1, payée une fois (`docs/PIEGES.md`).
        """
        return {
            "projet": objet.identifiant,
            "emplacements": [
                e.en_json() for e in sorted(objet.emplacements, key=lambda x: x.rang)
            ],
            "pieces": [p.en_json() for p in objet.pieces],
        }


def _exiger_emploi(emplois: Sequence[Emploi], identifiant: str) -> Emploi:
    for emploi in emplois:
        if emploi.identifiant == identifiant:
            return emploi
    raise EmploiInconnu(identifiant)


def _label(generation: Generation, case: CasePliee, piece: Piece | None) -> str:
    """Le nom de la pièce et celui de la pose, et rien d'autre.

    **Pas le début du prompt** : le prompt d'une planche d'équipement est le même
    pour ses N images — c'est la description de la pièce —, et neuf vignettes
    portant toutes le même début de phrase seraient neuf vignettes indiscernables
    dans la grille. La pièce et la pose sont exactement ce qui les distingue, et
    ce sont les mots que l'auteur cherchera.
    """
    nom = piece.nom if piece else (generation.piece or "pièce")
    pose = case.texte.strip()
    return f"{nom} · {pose}"[:60] if pose else nom[:60]


def _png(rgba: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(tampon, format="PNG", optimize=True)
    return tampon.getvalue()
