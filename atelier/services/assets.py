# -*- coding: utf-8 -*-
"""Retoucher — poser une recette, la rejouer, revenir au brut.

**Rien n'est écrasé.** L'image brute reste, la recette dit ce qu'on lui a fait,
et le fichier traité n'est qu'un rendu : le supprimer ne perd rien. Recalculer
coûte des millisecondes ; regénérer coûte de l'argent et ne rend jamais la même
image (`docs/ARCHITECTURE.md` §4, règle 5).

**Ce service n'appelle jamais le fournisseur.** C'est un invariant de T2, et il
se lit dans les imports : il n'y a pas de `fournisseur` dans ce fichier. Tout ce
qui se passe ici se passe sur le processeur, hors ligne, et sans un centime.

Deux choses sont grisées avec leur raison, et c'est ce service qui les décide —
jamais l'interface, qui affiche la phrase qu'elle reçoit :

- **le moteur de détourage par modèle**, tant qu'il n'est pas installé ;
- **la quantification**, tant qu'aucune palette n'existe. La palette se déduit
  des artworks officiels du projet, qui arrivent en T4 (US-65) ; jusque-là
  `palette_du_projet` rend le vide, et c'est vrai plutôt que provisoire.
"""

from __future__ import annotations

import time
import base64
from dataclasses import replace
from contextvars import ContextVar
from typing import Any

import numpy as np

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import Emplacement, Generation
from atelier.domaine.personnage import Personnage
from atelier.domaine.planche import (
    asset_de_planche,
    est_une_planche_refaite,
    recette_de_planche_refaite,
)
from atelier.domaine.projet import IMAGE_SEULE, PLANCHE
from atelier.domaine.recette import (
    ANCRAGES,
    BORD,
    COULEUR,
    CURSEUR_MAX,
    CURSEUR_MIN,
    DETOURAGE,
    DIFFERENCE,
    EPAISSEUR_MAX,
    GARDER_MAX,
    GRAIN_MAX,
    LISSAGE_MAX,
    METHODES_DE_REDUCTION,
    MORPHOLOGIE_MAX,
    TEINTE_MAX,
    TEINTE_MIN,
    TOLERANCE_ECHANGE_MAX,
    ALGORITHMES,
    DISTANCES,
    GARDEES_MAX,
    NOM_DE_L_ALGORITHME,
    NOM_DE_LA_DISTANCE,
    MODELE,
    MOTEURS,
    NOM_DE_LA_METHODE,
    PLACES,
    PORTEES,
    QUANTIFICATION,
    POSITIONS,
    RAYON_MAX,
    TRAMAGES,
    TROUS,
    Grille,
    Difference,
    Main,
    Passe,
    Recette,
    cote_du_canevas,
    cote_du_sujet,
    moteurs_suivis,
    occupation_max,
    voyage,
)
from atelier.image import (
    Rendu,
    crans_occupation,
    detourer,
    en_rendu,
    finir,
    mesures_du_fond,
    poches_de_fond,
    raison_moteur,
    rendre_en_png,
    retrouver_grille,
    taches,
    trous,
)
from atelier.image.traitement import (
    boite_opaque,
    composantes,
    etat_des_silhouettes,
    peindre,
    pinceau,
    pose_du_calque,
    queue,
    raison_du_modele,
    raison_methode,
    sans_les_deux_dernieres,
    silhouette,
)
from atelier.image.calque import avec_alpha, differencier
from atelier.image.palette import couleurs_obtenues, rampes
from atelier.services.evenements import Diffusion

# Les bornes des réglages, et le seul endroit qui les dise. Une recette venue
# d'un fichier retouché à la main, ou d'un agent en T7, peut contenir n'importe
# quoi : elle est refusée en nommant le réglage fautif, jamais ramenée en
# silence vers la borne la plus proche. Ramener discrètement « 512 » à « 256 »
# rendrait un sprite d'une autre taille que celle inscrite dans la recette,
# sans que personne puisse le voir — leçon de `MySpriteAi/src/lib/renderSettings.ts`.
# **Le plafond est passé de 512 à 2048 en D2**, et c'est le style qui l'exige :
# un jeu en dessin ne demande pas des carrés, il demande une **finesse**, et ses
# quatre valeurs montent à 2048 (`domaine/vue.py`, `FINESSES`). Le plancher ne
# bouge pas — 8 carrés reste la tuile des toutes premières consoles.
#
# Ce n'est pas un assouplissement du pixel art : sa liste à lui s'arrête à 512,
# et c'est l'écran qui propose l'une ou l'autre selon le style. Ici on borne ce
# qu'un fichier retouché à la main a le droit de contenir, et les deux styles
# passent par la même case.
CIBLE_MIN, CIBLE_MAX = 8, 2048
DURCISSEMENT_MAX = 4
COULEURS_MIN, COULEURS_MAX = 2, 256

# Combien de points une forme entourée à main levée peut porter (U12). **Un
# plafond, pas une précision** : l'écran ne garde un point que lorsque le
# pointeur s'est déplacé d'au moins deux pixels, et un tour complet d'une image
# de mille pixels en demande quelques centaines. Quatre mille laisse toute la
# place au geste et ferme la porte à un appel qui occuperait la machine.
TRACE_MAX = 4000

# La tolérance du moteur du bord quand aucune passe ne la dit — la même valeur
# que `Passe`, et le seul endroit où elle est répétée : la mesure des poches
# doit décrire le détourage que l'auteur *aurait* obtenu s'il en posait un.
TOLERANCE_PAR_DEFAUT = 28

# Combien de poches de fond enfermées partent à l'écran. Le détourage n'en fait
# pas un inventaire, il en **propose** : mesuré sur les soixante images du dépôt,
# une image en porte quarante-trois en médiane et jusqu'à seize mille, dont les
# trois quarts d'un à trois pixels. Les plus grandes sont celles dont on se
# demande vraiment si c'est du fond ou de la matière ; le compte entier part à
# côté, pour que ce qui est coupé se dise.
POCHES_MONTREES = 8

# Combien de détourages restent sous la main. Le détourage coûte 130 ms là où le
# reste en coûte 28 : le garder évite de le refaire à chaque cran de curseur.
# Quatre suffit — on retouche un asset à la fois, deux au plus en comparant.
DETOURAGES_GARDES = 4

# Le nom de l'échelle que porte une matière au barème du projet — le même mot que
# `naitre` lit sur la demande (`echelle="matière"`), et que `bibliotheque.py`
# appelle `NATURE_MATIERE` (ce module ne peut pas l'importer : la dépendance va
# dans l'autre sens).
ECHELLE_MATIERE = "matière"
_BROUILLON_RECETTE: ContextVar[bool] = ContextVar("brouillon_recette", default=False)


class RecetteRefusee(ErreurAtelier):
    """Un réglage de la recette n'est pas applicable, et on dit lequel."""

    code = "recette_refusee"


class AssetInconnu(ErreurAtelier):
    code = "asset_inconnu"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"aucun asset « {identifiant} »")


class ServiceAssets:
    def __init__(
        self, base: Base, fichiers: Fichiers, diffusion: Diffusion | None = None
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._diffusion = diffusion or Diffusion()
        self._detourages: dict[str, np.ndarray] = {}

    # ── Ce qui est disponible, et pourquoi ───────────────────────────────────

    def palette_du_projet(self, projet: str | None) -> tuple[str, ...]:
        """La palette sur laquelle quantifier — celle de l'univers du projet.

        **Lue dans le projet, pas demandée à un service.** Elle vit dans
        `projet.json`, donc dans l'index, donc à portée de ce fichier-ci : passer
        par le service d'univers créerait un cycle de composition — il a besoin
        des assets pour la palette rétroactive — pour aller chercher un champ.
        C'est le service d'univers qui la **calcule** et la garde à jour ; ce
        service-ci ne fait que la lire.

        Sans projet, sans artwork, il n'y a pas de palette — ce n'est pas une
        pièce manquante, c'est l'état réel d'un univers vide (US-57).
        """
        if projet is None:
            return ()
        objet = self._base.lire_projet(projet)
        return objet.univers.palette if objet else ()

    def fond_du_projet(self, projet: str | None) -> str:
        """La couleur de fond que le jeu a déclarée — celle que `atelier.
        domaine.fond` propose et que l'auteur a choisie, pas celle que le
        détourage devine sur les bordures (B18).

        **Même lecture que `palette_du_projet`, et pour la même raison** :
        elle vit dans `projet.json`, à portée de ce fichier-ci, et ce service
        ne fait que la lire — c'est `atelier.domaine.fond` et l'écran des
        règles du jeu qui la posent.

        Vide sans projet, comme sans fond choisi : les deux absences se lisent
        pareil, et c'est très exactement ce qui fait qu'un moteur `bord`
        continue de deviner sur les bordures tant que personne n'a choisi.
        """
        if projet is None:
            return ""
        objet = self._base.lire_projet(projet)
        return objet.univers.fond if objet else ""

    def raison_quantification(self, projet: str | None) -> str | None:
        """Pourquoi la quantification est grisée — **plus jamais depuis D2**.

        Elle l'était tant qu'aucun artwork officiel n'avait été promu. Mesuré le
        3 septembre 2026, ce grisé coûtait bien plus qu'il ne protégeait : un
        projet sans artwork ne réduisait **aucune** couleur, et le seul signe
        visible était un sprite à dix mille couleurs que personne ne rapprochait
        de la cause. Le réglage existait, il ne faisait rien.

        Réduire à N couleurs sans palette imposée est pourtant un traitement
        parfaitement défini — c'est ce que fait `quantifier` quand `palette` est
        vide, et ce que le banc de D2 a mesuré. **Il n'y a donc plus rien à
        griser** ; il reste quelque chose à dire, et `note_de_palette` le dit.

        La méthode est gardée : elle est l'endroit où ce grisé se rallumerait
        s'il devait revenir, et son absence de raison est une réponse, pas un
        oubli.
        """
        return None

    def note_de_palette(self, projet: str | None) -> str | None:
        """Ce que l'écran annonce quand les couleurs ne viennent pas du projet.

        **Une information, pas un refus** — c'est toute la différence avec le
        grisé d'avant. Sans artwork officiel, les couleurs se déduisent de
        l'image elle-même : le traitement a lieu, mais il n'obéit pas à la
        palette du jeu, et deux sprites peuvent donc sortir sur deux
        vocabulaires voisins au lieu d'un seul.

        Demandé par l'auteur le 3 septembre 2026 : *« on doit indiquer qu'il n'y
        a pas d'artwork et proposer de choisir une image de l'univers »*. La
        proposition d'y remédier appartient à l'écran ; ce service dit le fait.
        """
        if self.palette_du_projet(projet):
            return None
        return (
            "aucun artwork officiel — les couleurs se déduisent de chaque image, "
            "pas de la palette du jeu"
        )

    def traitement(self, projet: str | None = None) -> dict[str, Any]:
        """Ce que l'écran a besoin de savoir pour griser sans redemander."""
        return {
            "moteurs": [
                {"nom": moteur, "raison": raison_moteur(moteur)} for moteur in MOTEURS
            ],
            # **Le catalogue des modèles de silhouette** (U13) — il n'est plus
            # écrit en dur, donc il se sert comme tout le reste : le serveur le
            # rend, l'écran le montre, et personne ne le recompose.
            "silhouettes": etat_des_silhouettes(),
            # **La couleur et la palette du jeu** (B18) — de quoi câbler « la
            # couleur déclarée du jeu » et « la palette en garde-fou » à
            # l'écran sans lui faire deviner, à sa façon, ce que le projet a
            # déclaré. Vides sans projet ou sans rien de posé : c'est l'écran
            # qui décide alors de retomber sur le geste d'avant B18.
            "fond": self.fond_du_projet(projet),
            "palette": list(self.palette_du_projet(projet)),
            "quantification": {
                "raison": self.raison_quantification(projet),
                # **Ce que l'écran annonce sans interdire** (D2) : la palette du
                # jeu manque, les couleurs viennent donc de l'image.
                "note": self.note_de_palette(projet),
                # **Les trois algorithmes et les deux distances** (B18), avec
                # leur nom français. L'écran les montre, il ne les recompose
                # pas : c'est la règle que `reductions` tient déjà depuis D2, et
                # celle qui évite qu'une seconde liste finisse par diverger.
                "algorithmes": [
                    {"nom": nom, "libelle": NOM_DE_L_ALGORITHME[nom]}
                    for nom in ALGORITHMES
                ],
                "distances": [
                    {"nom": nom, "libelle": NOM_DE_LA_DISTANCE[nom]}
                    for nom in DISTANCES
                ],
                # **La palette du jeu rangée en rampes d'ombre** (B18). Elle ne
                # change aucune image — la planche le dit en toutes lettres :
                # *« ça change ce qu'on voit en les regardant, donc ce qu'on
                # décide d'ajouter »*. Les bruns ensemble, du plus sombre au plus
                # clair, et c'est ce rangement qui fait voir le trou qu'il
                # faudrait combler.
                "rampes": [list(r) for r in rampes(self.palette_du_projet(projet))],
            },
            # **Les quatre façons de réduire** (D2), avec leur raison de grisé.
            # Trois ne demandent rien ; « traits épaissis » tire une
            # bibliothèque lourde et suit le régime du moteur par modèle.
            "reductions": [
                {
                    "nom": methode,
                    "libelle": NOM_DE_LA_METHODE[methode],
                    "raison": raison_methode(methode),
                }
                for methode in METHODES_DE_REDUCTION
            ],
            "recettes": sorted(self._fichiers.lire_recettes()),
        }

    # ── La naissance ─────────────────────────────────────────────────────────

    def impose(self, identifiant: str) -> dict[str, Any]:
        """Ce que le projet impose à **cette image-là**, aujourd'hui (US-164).

        « Je veux lire sur la fiche d'un asset le traitement que le projet lui a
        imposé, afin de comprendre pourquoi l'image affichée ne ressemble pas à
        celle qui est arrivée du fournisseur. » Sans ça, l'auteur voit une image
        remise sur 64 pixels et quantifiée sur une palette qu'il n'a jamais
        demandées à cette image-ci, et rien à l'écran ne le lui dit.

        **Calculée, jamais rangée.** C'est `recette_du_projet` — le seul chemin
        qui dise ce qu'un univers impose — rejoué sur l'échelle demandée à la
        naissance. La ranger sur l'asset en aurait fait une seconde vérité, qui
        aurait vieilli au premier réglage d'univers ; or c'est précisément « ce
        que le projet impose *maintenant* » que la fiche compare à ce que
        l'image porte.

        **Une route à part de l'asset, et c'est pour la grille** : deux cents
        assets affichés relisent alors deux cents fois le projet et son barème,
        pour une phrase que seule la fiche montre, une image à la fois.

        Rend `null` quand la génération n'est plus sur le disque : le produit
        dit qu'il ne sait pas plutôt que de répondre « rien d'imposé », qui est
        une réponse différente et fausse.
        """
        asset = self._trouver(identifiant)
        generation = self._base.lire(asset.generation)
        if generation is None:
            return {"impose": None, "echelle": "", "nature": "", "detourage": None}
        # **La nature se lit sur l'asset, pas sur la génération** (D1) : le lot
        # est ce qui dit qu'une image est sortie d'une planche, et c'est déjà
        # lui que l'écran interroge partout ailleurs.
        #
        # **Une planche refaite a deux natures dans une génération** (RS2) : la
        # feuille est une image seule amputée de sa grille, ses morceaux sont
        # des morceaux de planche — c'est ce que la découpe leur a posé.
        feuille = est_une_planche_refaite(generation, asset.rang)
        morceau_refait = (
            bool(generation.demande.get("garder_mise_en_page")) and not feuille
        )
        nature = PLANCHE if asset.lot is not None or morceau_refait else IMAGE_SEULE
        echelle = str(generation.demande.get("echelle", "") or "")
        # **Ce que la naissance a posé, par le même chemin** (RS6) : la recette
        # du sujet passe devant celle du jeu pour une image seule et pour un
        # morceau de planche refaite — pas pour un morceau de lot plié, que le
        # dépliage habille toujours de la recette du jeu. Sinon la fiche
        # montrerait un écart que personne n'a créé.
        if feuille or nature == IMAGE_SEULE:
            impose = self.recette_de_naissance(generation, asset.rang)
        elif morceau_refait and asset.lot is None:
            impose = self.recette_d_un_morceau_refait(generation)
        else:
            impose = self.recette_du_projet(generation, nature)
        return {
            "impose": impose.en_json(),
            # **Ce que l'auteur avait dit fabriquer**, parce que c'est elle qui
            # décide de l'occupation : « imposé 40 % » ne s'explique que si la
            # fiche peut ajouter « objet tenu ».
            "echelle": echelle,
            # **Comment l'image est venue, et d'où son détourage vient** (D1,
            # US-410). Sans la provenance, l'auteur lit un durcissement qu'il
            # n'a pas posé sans pouvoir savoir lequel de ses trois réglages l'a
            # décidé — c'est exactement ce que le critère demande d'éviter.
            "nature": nature,
            "detourage": self._provenance_du_detourage(generation, nature, echelle),
        }

    def _provenance_du_detourage(
        self, generation: Generation, nature: str, echelle: str
    ) -> dict[str, Any] | None:
        """La passe par défaut qui s'applique, et le nom du niveau qui l'a dite.

        Rend `null` quand le projet n'impose rien du tout — sans projet, ou pour
        une image entrée « telle quelle » : il n'y a alors pas de défaut à
        montrer, et afficher celui du produit ferait croire qu'il s'applique.
        """
        if generation.demande.get("traiter") is False or generation.projet is None:
            return None
        objet = self._base.lire_projet(generation.projet)
        if objet is None:
            return None
        lue = objet.univers.echelle(echelle)
        passe, origine = objet.univers.detourage(nature, lue.famille if lue else "")
        return {
            "passe": passe.en_json(),
            "origine": origine,
            "famille": lue.famille if lue else "",
        }

    def taches_de(self, identifiant: str, plafond: int = 200) -> dict[str, Any]:
        """Ce qu'une table a besoin de savoir de l'image (E3, étendu en E5 puis D2).

        **Six mesures, et aucune n'est un réglage** : les taches que le
        nettoyage des bords va effacer, les poches de fond que le sujet enferme,
        les crans d'occupation où la remise sur grille change vraiment quelque
        chose, ce que chaque couche de la main touche, la couleur que chaque
        pipette a sous son point, et **la grille sur laquelle le modèle a peint**.
        Les cinq premières répondent à la même question posée cinq fois —
        *qu'est-ce que ce curseur va faire, avant que je le bouge ?* La sixième en
        pose une autre, et c'est celle de D2 : *sur quoi est-ce que je travaille ?*

        **À l'échelle où le réglage agit, et c'est une correction du 31 août
        2026.** Elles se prenaient sur l'image *détourée* — donc à la taille du
        brut, mille pixels de côté — alors que le nettoyage des bords s'applique
        tout à la fin, sur la case. Une miette de six pixels dans le rendu en
        pesait quinze cents dans la liste, et le curseur d'aire minimale, gradué
        de 0 à 64, ne pouvait rien y couper : les deux nombres ne parlaient pas
        de la même image. La mesure rejoue donc la recette **arrêtée avant les
        bords**, ce qui est exactement l'image que le seuil va trancher — et
        c'est aussi celle que le contour va longer, à ce que les bords en
        retirent près, que l'écran sait retrancher tout seul.

        **Une route à part de l'asset**, pour la raison de `impose` : la charge
        d'un asset part deux cents fois par relecture de grille, et un
        remplissage par plages n'a rien à faire là.
        """
        asset = self._trouver(identifiant)
        return self._taches_de(asset, plafond)

    def _taches_de(self, asset: Asset, plafond: int = 200) -> dict[str, Any]:
        # Avant les bords : la liste doit montrer ce que le seuil va effacer, et
        # une liste prise après lui aurait déjà perdu ce qu'elle décrit.
        avant_les_bords = replace(
            sans_les_deux_dernieres(asset.recette), bords=None
        )
        rgba = self._tableau_avec(asset, avant_les_bords)
        trouvees = taches(rgba, plafond=plafond)
        # **Ce qui est coupé se dit**, jamais tu en silence : une image bruitée
        # peut porter des milliers de taches d'un pixel, et une liste tronquée
        # sans le dire se lirait comme la liste entière.
        toutes = len([m for m, _ in composantes(rgba[:, :, 3] > 0)])
        return {
            "taches": [t.en_json() for t in trouvees],
            "coupees": max(0, toutes - len(trouvees)),
            **self._poches_de(asset, rgba),
            "trous": [t.en_json() for t in trous(rgba)],
            "crans_occupation": crans_occupation(
                rgba, asset.recette.grille or Grille()
            ),
            # **Ce que la hauteur donne, dit par le serveur** (tranche des
            # tailles). L'auteur a demandé les deux lectures d'un coup —
            # *« les deux, avec un rappel visuel »* — et l'écran ne les calcule
            # donc pas de son côté : une seconde arithmétique aurait fini par
            # annoncer une hauteur et en produire une autre, ce qui est très
            # exactement le défaut que le calibrage venait de payer.
            "hauteur": self._hauteur_de(asset.recette.grille or Grille()),
            # **La grille sur laquelle le modèle a peint** (D2, seconde moitié).
            # Une mesure de plus, et elle répond à la question que la table
            # posait sans pouvoir y répondre : *le modèle a-t-il tenu la grille
            # qu'on lui a demandée, et laquelle ?*
            "grille_du_modele": self._grille_du_modele(asset),
            # **Les deux mesures d'acceptation du fond** (D3). Elles ne décrivent
            # pas un réglage de cette table-ci : elles disent ce que *l'appel*
            # a rendu — la couleur de fond revenue, la frange que le détourage a
            # laissée, et les pixels du sujet qu'un cran de tolérance de plus
            # aurait mangés.
            #
            # **C'est ce qui remplace le banc de la tranche du fond**, tranché
            # par l'auteur le 2 septembre 2026 : la mesure se lit sur les images
            # qu'on voulait de toute façon, à côté du curseur qui l'explique.
            "fond": self._mesures_du_fond(asset),
            # **Une image entièrement opaque n'a pas de bord de sujet** — le
            # seul cas où le contour est indisponible, et l'écran a besoin de
            # le savoir pour griser la table avec sa raison. Ce n'est pas une
            # mesure de plus : c'est la même image, regardée d'une ligne.
            "opaque": bool(rgba[:, :, 3].all()),
            "main": self._pixels_de_la_main(asset),
            "visees": self._couleurs_visees(asset),
            "recadrage": self._recadrage_de(asset),
            # **« 24 demandées, 14 obtenues »** (B18). La planche compte ce
            # chiffre parmi ce qui manque, et son absence a un coût mesuré :
            # *« rien à l'écran ne dit l'écart, donc l'auteur monte le réglage en
            # croyant gagner du détail »*. C'est le seul nombre qui explique
            # pourquoi monter le réglage ne change plus rien.
            "couleurs": self._couleurs_de(asset),
        }

    def _couleurs_de(self, asset: Asset) -> dict[str, Any]:
        """Combien de couleurs cette image demande, et combien elle en obtient.

        **Sur le rendu final, et c'est le seul endroit juste.** Les autres
        mesures de cette route se prennent sur l'image *avant les bords*, parce
        qu'elles décrivent ce qu'un réglage va faire ; celle-ci décrit ce qu'on
        **a**, donc elle se lit sur l'image telle qu'elle sort — bords, contour
        et main compris, qui tous peuvent ajouter ou retirer une couleur.

        `demandees` est nul quand la table dort ou n'est pas posée : il n'y a
        alors aucun écart à expliquer, et l'écran n'a rien à montrer.
        """
        quantification = asset.recette.quantification
        if quantification is None or asset.recette.dort(QUANTIFICATION):
            return {"demandees": 0, "obtenues": 0}
        demandees = (
            len(quantification.palette)
            if quantification.palette
            else quantification.couleurs
        )
        return {
            "demandees": demandees,
            "obtenues": couleurs_obtenues(self._tableau_avec(asset, asset.recette)),
        }

    def _mesures_du_fond(self, asset: Asset) -> dict[str, Any]:
        """Ce que cette image-là dit du fond sur lequel elle a été demandée (D3).

        **Sur l'image détourée, et pour la raison de `_grille_du_modele`** juste
        en dessous : le tableau y est déjà en cache — `detourage` est le seul
        endroit du dépôt qui détoure —, la couleur du fond y est encore lisible
        dans les pixels rendus transparents, et le rendu final les a déjà
        recadrés, réduits et quantifiés.

        **La tolérance est celle de la dernière passe qui agit**, parce que c'est
        elle qui a tranché le bord. Sans passe vive — un import posé tel quel —,
        c'est celle du produit : la mesure reste lisible, elle dit seulement ce
        qu'un détourage *aurait* mangé.
        """
        vives = asset.recette.passes_vives()
        tolerance = vives[-1].tolerance if vives else Passe().tolerance
        return mesures_du_fond(self.detourage(asset), tolerance).en_json()

    def _grille_du_modele(self, asset: Asset) -> dict[str, Any]:
        """Sur quelle grille le modèle a peint cette image-là — **ou rien** (D2).

        **Une mesure, jamais un réglage**, comme les cinq autres de cette route.
        La cible reste demandée et jamais déduite (US-61) : ce chiffre s'affiche
        à côté du réglage de taille, il ne le remplit pas. Ce qu'il apporte est
        que l'auteur cesse de choisir à l'aveugle — un modèle qui a peint sur
        des blocs de 8 px ne rendra jamais 128 carrés propres, et jusqu'ici rien
        dans l'écran ne le disait.

        **Sur l'image détourée, et avant la mise sur grille.** Deux raisons, et
        les deux sont des pièges évités :

        - la mesure de cette route travaille d'ordinaire sur le rendu *arrêté
          avant les bords*, c'est-à-dire une image **déjà ramenée à la case du
          projet**. Y chercher la grille du modèle reviendrait à mesurer la
          nôtre : la réponse serait 1, toujours, et elle aurait l'air juste ;
        - le détourage, lui, est le bon endroit : il ne touche pas aux blocs, et
          il pose un alpha qui est le contraste le plus franc de l'image. Le
          tableau est de surcroît **déjà en cache** — `detourage` est le seul
          endroit du dépôt qui détoure —, donc la mesure ne coûte rien de plus
          qu'un balayage de profils.
        """
        return retrouver_grille(self.detourage(asset)).en_json()

    @staticmethod
    def _hauteur_de(grille: Grille) -> dict[str, Any]:
        """Les deux lectures d'une même hauteur, et le plafond de la case.

        **L'auteur a demandé les deux à la fois**, le 3 septembre 2026 :
        *« les deux, avec un rappel visuel, une sorte d'échantillon »*. Un nombre
        de carrés est ce que réclament les moteurs de jeu et les outils de dessin ;
        un nombre de personnages est ce qui se lit quand on décrit un monde. Ce
        sont deux façons de dire la même valeur, et aucune n'est de trop.

        **Ce qui est stocké reste la relative**, et c'est ce qui fait qu'un
        changement de taille de projet emmène tous les types avec lui : un moulin
        de trois personnages en fait trois que le jeu tourne en 32 ou en 64
        carrés. Un nombre de carrés figé aurait demandé de reprendre chaque type
        à la main.
        """
        return {
            "carres": cote_du_canevas(grille.cible, grille.occupation),
            "personnages": grille.en_personnages,
            "max": occupation_max(grille.cible),
            # **Le sujet et la case ne font qu'un au-delà de 100 %**, et se
            # séparent en dessous : un objet tenu à 40 % occupe 26 carrés dans
            # une case de 64. L'écran montre les deux, sans quoi son échantillon
            # dessinerait une case là où il y a un petit objet dedans.
            "sujet": cote_du_sujet(grille.cible, grille.occupation),
        }

    def _recadrage_de(self, asset: Asset) -> dict[str, Any]:
        """Ce que la table de recadrage a besoin de savoir (U2).

        **Cinq lectures, aucune n'est un réglage** : la boîte du sujet mesurée
        sur l'alpha, le rectangle réellement gardé — marge comprise et rognée
        sur les bords —, la part du fichier d'origine qui est jetée, les bords
        de l'image que le sujet touche, et ce qu'une boîte tracée coupe du
        sujet. Elles répondent toutes à la question que la table posait sans
        pouvoir y répondre : *qu'est-ce que ce cadrage garde, et qu'est-ce qu'il
        jette ?*

        **Mesurée sur l'image détourée, et il n'y a pas d'autre endroit
        possible.** La boîte du sujet est ce que le recadrage lit *en entrant* :
        la prendre après lui la rendrait égale à l'image entière, à chaque fois,
        puisque recadrer place justement le sujet contre les quatre bords.

        **La marge est appliquée ici comme le traitement l'applique**, c'est-à-
        dire rognée sur les bords de l'image d'origine — un sujet à 3 px du haut
        et une marge de 12 rendent 3 px en haut et 12 en bas. C'est ce que
        `_recadrer` fait, et l'écran doit montrer ce que le rendu montre, pas ce
        qu'on aurait souhaité.
        """
        rgba = self.detourage(asset)
        hauteur, largeur = rgba.shape[:2]
        sujet = boite_opaque(rgba[:, :, 3])
        recadrage = asset.recette.recadrage
        marge = max(0, recadrage.marge) if recadrage is not None else 0
        tracee = recadrage.boite if recadrage is not None else None
        depart = list(tracee) if tracee is not None else (list(sujet) if sujet else None)
        obtenue: list[int] | None = None
        if depart is not None:
            obtenue = [
                max(0, depart[0] - marge),
                max(0, depart[1] - marge),
                min(largeur - 1, depart[2] + marge),
                min(hauteur - 1, depart[3] + marge),
            ]
        aire = largeur * hauteur
        jete = (
            0.0
            if obtenue is None or aire == 0
            else 1.0
            - ((obtenue[2] - obtenue[0] + 1) * (obtenue[3] - obtenue[1] + 1)) / aire
        )
        # **Le sujet touche un bord de l'image d'origine, et c'est un fait sur
        # le modèle** : il l'a peint coupé. Aucune autre table ne le mesure, et
        # rien ne se répare ici — on l'apprend avant d'avoir bâti quatre poses
        # dessus.
        bords: list[str] = []
        if sujet is not None:
            if sujet[1] == 0:
                bords.append("haut")
            if sujet[3] == hauteur - 1:
                bords.append("bas")
            if sujet[0] == 0:
                bords.append("gauche")
            if sujet[2] == largeur - 1:
                bords.append("droite")
        # **Ce qu'une boîte tracée coupe du sujet**, côté par côté. C'est la
        # phrase importante de la table : une boîte plus large que le sujet est
        # *sans effet sur le rendu*, parce que la grille recherche elle-même la
        # boîte du sujet et rogne dessus. Une boîte n'agit que quand elle coupe.
        coupe: dict[str, int] = {}
        if tracee is not None and sujet is not None and obtenue is not None:
            for nom, retire in (
                ("gauche", obtenue[0] - sujet[0]),
                ("haut", obtenue[1] - sujet[1]),
                ("droite", sujet[2] - obtenue[2]),
                ("bas", sujet[3] - obtenue[3]),
            ):
                if retire > 0:
                    coupe[nom] = int(retire)
        return {
            "origine": [int(largeur), int(hauteur)],
            "sujet": [int(v) for v in sujet] if sujet is not None else None,
            "tracee": [int(v) for v in tracee] if tracee is not None else None,
            "obtenue": [int(v) for v in obtenue] if obtenue is not None else None,
            "jete": round(max(0.0, jete), 4),
            "bords": bords,
            "coupe": coupe,
            # **La sixième lecture, et elle décide d'un grisé** (B16). La mise
            # en case refait sa propre recherche de la boîte du sujet et rogne
            # dessus : la marge est alors avalée, mesuré le 30 août 2026 —
            # marge 0 et marge 40 rendent le même fichier à l'octet près.
            #
            # ⚠️ **Elle est calculée ici et pas à l'écran**, parce que l'écran
            # s'était trompé dessus : `recette.grille != null` est faux dans
            # trois cas. La règle vit une seule fois, dans le domaine
            # (`Recette.marge_sans_effet`), et l'écran l'affiche.
            "marge_sans_effet": asset.recette.marge_sans_effet(),
        }

    def _poches_de(self, asset: Asset, rgba: np.ndarray) -> dict[str, Any]:
        """Les poches de fond enfermées, **les plus grandes d'abord**, et leur compte.

        La liste est coupée court exprès : le détourage n'en fait pas un
        inventaire, il en **propose une**. Mesuré le 31 août 2026 sur les
        soixante images du dépôt, une image en porte quarante-trois en médiane
        et jusqu'à seize mille — dont les trois quarts font un à trois pixels, du
        bruit de compression à la couleur du fond. Les lister toutes ferait du
        panneau une page de chiffres pour un geste qui vise une zone à la fois.

        **Ce qui est coupé se dit**, comme pour les taches : le compte est rendu
        à part, entier.

        La tolérance est celle de la première passe qui remplit depuis le bord —
        la mesure décrit ce que *ce* réglage-là n'a pas pu atteindre, et la
        prendre ailleurs décrirait un détourage que personne n'a demandé. Sans
        passe de bord, le défaut du produit.
        """
        tolerance = next(
            # **Celle de la première passe de bord qui agit** (U10) : une passe
            # masquée n'efface rien, et prendre sa tolérance décrirait des
            # poches laissées par un détourage qui n'a pas eu lieu.
            (p.tolerance for p in asset.recette.passes_vives() if p.moteur == BORD),
            TOLERANCE_PAR_DEFAUT,
        )
        trouvees, total = poches_de_fond(rgba, tolerance, plafond=POCHES_MONTREES)
        return {
            "poches": [p.en_json() for p in trouvees],
            "poches_total": total,
        }

    def _couleurs_visees(self, asset: Asset) -> list[str | None]:
        """La couleur sous le point de chaque pipette — **une par passe**.

        La liste suit les passes rang par rang, et vaut `None` partout où la
        passe n'est pas une pipette ou n'a pas encore été visée. C'est ce qui
        permet à l'écran d'afficher la pastille et son code sans redescendre les
        pixels : la couleur *se lit*, elle ne se range pas dans la recette (voir
        `Passe`), et un écran qui la recalculerait de son côté serait la seconde
        implémentation qu'on refuse partout ailleurs.

        **Prise sur le brut, et il n'y a pas d'autre endroit possible.** Le point
        est en pixels de l'image d'origine ; le recadrage et la remise sur grille
        les déplacent tous les deux, et une couleur lue après eux nommerait un
        autre pixel. Les passes, elles, ne ferment que de l'alpha — la couleur
        est donc la même avant et après elles, et ce tableau-ci est déjà calculé.
        """
        rgba = self.detourage(asset)
        hauteur, largeur = rgba.shape[:2]
        visees: list[str | None] = []
        for passe in asset.recette.passes:
            if passe.moteur != COULEUR or passe.point is None:
                visees.append(None)
                continue
            x, y = passe.point
            if not (0 <= x < largeur and 0 <= y < hauteur):
                visees.append(None)
                continue
            r, v, b = (int(c) for c in rgba[y, x, :3])
            visees.append(f"#{r:02x}{v:02x}{b:02x}")
        return visees

    def _pixels_de_la_main(self, asset: Asset) -> dict[str, Any] | None:
        """Ce que chaque couche de la septième place change (E5).

        Sur l'opacité, des **pixels touchés** : c'est le nombre qui dit si la
        main a servi de correction ou de détourage déguisé, et il ne se lit que
        contre l'image — remettre un pixel déjà présent ne touche rien. Sur un
        calque de dessin, des **pixels posés**, qui ne dépendent que des
        passages.

        `None` quand la place est vide, et l'écran se tait alors plutôt que
        d'écrire des zéros : une table qu'on n'a pas ouverte n'a rien à
        raconter.

        **L'image est rejouée sans la main, jamais avec** : mesurer sur le rendu
        final compterait ce qui reste après que le dernier passage a effacé
        l'avant-dernier, ce qui n'est pas la question posée.
        """
        main = asset.recette.main
        if main is None:
            return None
        avant = self._tableau_avec(asset, replace(asset.recette, main=None))
        forme = avant.shape[:2]
        present = avant[:, :, 3] > 0
        touches = (
            int((peindre(present, main.opacite) != present).sum())
            if main.opacite
            else 0
        )
        return {
            "opacite": touches,
            "calques": [
                int(pose_du_calque(forme, calque)[0].sum()) for calque in main.calques
            ],
        }

    def recette_du_projet(
        self, generation: Generation, nature: str = IMAGE_SEULE
    ) -> Recette:
        """Ce que l'univers impose à cette image-là, à sa naissance.

        **La remise sur grille est systématique tant qu'une cible est posée**
        (US-61) : un asset dont la grille a dérivé est le cas normal, pas
        l'incident. Elle arrive donc posée, et l'auteur la défait s'il le veut —
        l'inverse obligerait à la reposer à chaque image, ce que le produit
        existe pour éviter. Sans cible — « aucune » (US-163) —, il n'y a pas de
        grille du tout : l'image entre aux dimensions rendues par le modèle.

        Sans projet, ou sans échelle nommée, la recette du produit s'applique
        quand même : « un univers vide ne contraint rien » ne veut pas dire
        « un univers vide ne fait rien ».

        **Sauf pour une image entrée « telle quelle »** (US-170, R3). L'import
        héritait de la recette du projet en silence : une référence de 2048
        pixels revenait à 64, ce que personne n'avait demandé. La décision est
        portée par la génération, pas par un réglage d'écran, pour la raison
        habituelle — elle survit à l'effacement de l'index, et elle vaut pour
        l'agent comme pour l'auteur.

        Conséquence heureuse et non fortuite : une recette vide est déjà ce que
        le balayage de palette laisse tranquille (« un asset ramené au brut
        reste au brut »). Une image entrée telle quelle le reste donc, sans
        qu'aucune règle nouvelle ait à le dire.

        **`nature` dit comment l'image est venue** (D1), et il est **posé par
        l'appelant plutôt que deviné ici**. On aurait pu le lire dans la
        génération — celle qui porte un pliage fabrique une planche — mais la
        même génération donne les deux : la planche elle-même naît par
        `naitre`, ses morceaux naissent au dépliage. Une seule génération, deux
        natures ; il n'y a donc rien à deviner, seulement à dire.
        """
        if generation.demande.get("traiter") is False:
            return Recette()
        if generation.projet is None:
            return Recette()
        objet = self._base.lire_projet(generation.projet)
        if objet is None:
            return Recette()
        nom = str(generation.demande.get("echelle", "") or "")
        return objet.univers.recette_de(objet.univers.echelle(nom), nature)

    def recette_de_naissance(self, generation: Generation, rang: int) -> Recette:
        """La recette d'une image **rendue par le modèle**, à son emplacement.

        C'est `recette_du_projet` pour une image seule, **sauf la feuille d'une
        planche refaite** (RS2), qui n'en garde que le détourage — voir
        `recette_de_planche_refaite`. Écrite ici, une fois, parce que deux
        chemins la lisent : la naissance, relance et rattrapage compris (tous
        passent par `naitre`), et la fiche qui dit ce que le projet impose. Si
        l'une disait « grille » et l'autre non, la fiche montrerait un écart
        que l'auteur n'a jamais créé.
        """
        du_projet = self.recette_du_projet(generation)
        if est_une_planche_refaite(generation, rang):
            return recette_de_planche_refaite(du_projet)
        # **La recette du sujet passe devant celle du jeu** (RS6) — mais jamais
        # sur la feuille d'une planche refaite, juste au-dessus : elle y
        # remettrait la grille que RS2 a retirée. Ses morceaux, eux, la
        # reçoivent (`recette_d_un_morceau_refait`).
        du_sujet = self.recette_du_sujet(generation)
        return du_sujet if du_sujet is not None else du_projet

    def recette_d_un_morceau_refait(self, generation: Generation) -> Recette:
        """La recette d'un morceau coupé dans la feuille d'une planche refaite.

        Ce que le projet impose à **un morceau de planche**, grille comprise
        (RS2) — ou la recette du sujet s'il en a une (RS6), puisque ce sont
        eux, les images du sujet. Écrite ici pour que la découpe et la fiche
        (`impose`) lisent la même chose.
        """
        du_sujet = self.recette_du_sujet(generation)
        if du_sujet is not None:
            return du_sujet
        return self.recette_du_projet(generation, PLANCHE)

    def recette_du_sujet(self, generation: Generation) -> Recette | None:
        """La recette nommée du sujet de cet appel, prête à poser — ou `None`.

        **Un sujet peut porter une recette par défaut** (RS6, 18 septembre
        2026) : « champy 01 », que l'auteur posait jusqu'ici à la main sur
        chaque image de Champy. Elle remplace la recette du jeu, et seulement
        elle : `None` veut dire « la recette du jeu s'applique », jamais
        « aucune recette ».

        Quatre cas rendent `None`, et chacun garde ce qui se faisait avant :

        - **une image entrée telle quelle** — elle n'a pas de recette du jeu
          non plus, et l'import ne doit pas se mettre à la retoucher ;
        - **un lot plié** — sa planche garde sa recette vide, ses morceaux
          naissent au dépliage, qui ne passe pas par ici ;
        - **un appel sans sujet**, ou un sujet disparu depuis ;
        - **une recette nommée effacée depuis le choix** : le nom reste sur le
          sujet, et l'image retombe sur la recette du jeu plutôt que de lever
          au milieu d'une arrivée payée.

        **Le voyage est refait**, comme au rappel d'une recette nommée
        (`appliquer_nommee`) : une recette écrite avant la règle peut encore
        porter un cadre tracé sur une autre image, qui tomberait ici à côté.
        Le sujet est relu **dans son fichier**, qui fait foi, et c'est aussi ce
        qui fait qu'un choix posé à l'instant vaut pour l'image suivante.
        """
        if generation.demande.get("traiter") is False:
            return None
        if generation.pliage is not None:
            return None
        if not generation.personnage or generation.projet is None:
            return None
        contenu = self._fichiers.lire_personnage(
            generation.projet, generation.personnage
        )
        if contenu is None:
            return None
        nom = Personnage.depuis_json(contenu).recette
        if not nom:
            return None
        enregistree = self._fichiers.lire_recettes().get(nom)
        if not isinstance(enregistree, dict):
            return None
        voyageable, _laisse = voyage(Recette.depuis_json(enregistree))
        return replace(voyageable, nom=nom)

    def naitre(self, generation: Generation, emplacement: Emplacement) -> Asset | None:
        """Un emplacement qui réussit devient un asset, tout de suite.

        Pas au premier geste de retouche : sinon l'emplacement et l'asset
        diraient tous les deux ce qu'est cette image, et T3 aurait à les fondre.
        Une relance retombe sur le même identifiant et écrase — un raté relancé
        ne laisse pas d'orphelin derrière lui.
        """
        resultat = emplacement.resultat
        if resultat is None:
            return None

        identifiant = identifiant_de(generation.identifiant, emplacement.rang)
        ancien = self._base.lire_asset(identifiant)
        asset = Asset(
            identifiant=identifiant,
            generation=generation.identifiant,
            rang=emplacement.rang,
            brut=resultat.fichier,
            largeur=resultat.largeur,
            hauteur=resultat.hauteur,
            type_media=resultat.type_media,
            label=_label(generation),
            # Une relance garde la recette qu'on avait posée : ce qu'on veut
            # faire de l'image ne dépend pas de l'appel qui l'a rendue. Une
            # image neuve, elle, naît **déjà habillée de son univers** — c'est
            # « la chaîne complète tient d'un bout à l'autre : un asset se
            # génère, se détoure, se ramène sur la grille et la palette du
            # projet, et se range tout seul » (`docs/archive/plan-versions-tenues.md`, T4).
            #
            # **Sauf la feuille d'une planche refaite** (RS2), qui naît sans
            # grille : c'est `recette_de_naissance` qui le dit, et non cette
            # ligne, pour que la fiche lise la même chose.
            recette=(
                ancien.recette
                if ancien
                else self.recette_de_naissance(generation, emplacement.rang)
            ),
            epingle=ancien.epingle if ancien else False,
            # Ce que l'appel a facturé pour cette image-là. La tuile le porte ;
            # le total du projet, lui, se calcule sur les générations, qui sont
            # les seules à connaître les appels ratés.
            consomme=emplacement.consomme,
            unite=emplacement.unite,
            # **Qui l'a demandé**, hérité de l'appel et jamais recalculé (US-39).
            # Une relance ne le rejoue pas depuis l'ancien : c'est la génération
            # qui fait foi, et c'est elle qu'on relance.
            provenance=generation.provenance,
            # **Le modèle qui a rendu cette image-là** (US-123). Repris de la
            # génération à chaque naissance, relance comprise : une relance
            # change le modèle si l'auteur l'a changé, et c'est bien ce qu'il
            # faut afficher — l'image visible est celle du dernier appel.
            modele=generation.modele,
            # **Il entre en bibliothèque de lui-même** (US-25), dans le projet
            # où la génération est partie. Un rangement déjà posé à la main
            # l'emporte : ce que l'auteur a décidé ne se défait pas tout seul.
            projet=ancien.projet if ancien else generation.projet,
            # **La case que cet appel visait** (US-120), et la même règle que le
            # rangement : ce que l'auteur a décidé ne se défait pas tout seul.
            # Une image qu'il a désignée ailleurs — ou dont il a retiré la
            # désignation — ne revient pas dans sa case parce qu'on relance
            # l'appel qui l'avait produite.
            personnage=ancien.personnage if ancien else generation.personnage,
            pose=ancien.pose if ancien else generation.pose,
            # **Et sous quel angle** (E10), à la même règle exactement : une
            # image que l'auteur a déplacée dans une autre direction n'y revient
            # pas parce qu'on relance l'appel qui l'avait produite.
            direction=ancien.direction if ancien else generation.direction,
            personnage_supprime=ancien.personnage_supprime if ancien else False,
            favori=ancien.favori if ancien else False,
            # **C'est un ingrédient, pas une chose du jeu** (RG5, 20 septembre
            # 2026) : une image dont la demande portait `echelle="matière"`
            # (`ServiceGenerations.soumettre_matiere`) naît marquée matière,
            # le même mot qui lui donne déjà sa recette de naissance juste
            # au-dessus. Comme pour le rangement et la case visée, une
            # décision de l'auteur l'emporte à la relance.
            matiere=(
                ancien.matiere
                if ancien
                else generation.demande.get("echelle") == "matière"
            ),
            # La filiation vient de la source d'édition réinjectée (US-12).
            # Sans réinjection, l'asset n'a pas de parent — et c'est vrai, pas
            # provisoire : rien ne l'a engendré.
            parent=generation.parent,
            # **La date du lot, pas celle de l'arrivée.** Les variations d'une
            # même génération n'arrivent pas ensemble : dater chaque asset de
            # son arrivée ferait glisser les tuiles les unes par rapport aux
            # autres pendant qu'on les regarde, et « la grille ne se recompose
            # jamais entre le départ et l'arrivée » (`docs/design-motifs.md`
            # § L'emplacement) tomberait. Le rang départage à égalité.
            cree_le=ancien.cree_le if ancien else generation.cree_le,
            # Ce qu'une relance ne doit pas défaire : le jugement de l'auteur.
            supprime_le=ancien.supprime_le if ancien else None,
            parent_supprime=ancien.parent_supprime if ancien else False,
        )
        self.accueillir(asset)
        return asset

    def accueillir(self, asset: Asset, *, annoncer: bool = True) -> Asset:
        """Un asset neuf entre : son rendu se calcule, puis il s'écrit.

        Deux naissances passent par ici — celle d'une image reçue du fournisseur
        (`naitre`) et celle d'une découpe de planche (T5). Elles n'ont **rien**
        en commun en amont : l'une vient du réseau et coûte de l'argent, l'autre
        d'un rectangle et ne coûte rien. Elles ont tout en commun en aval — un
        rendu à poser, un fichier à écrire, un index à mettre à jour, un onglet
        à prévenir —, et c'est cette moitié-là qui est ici plutôt que dupliquée.
        """
        self._rendre(asset)
        self.sauver(asset, annoncer=annoncer)
        return asset

    def reposer(self, asset: Asset, *, annoncer: bool = True) -> Asset:
        """Un asset déjà né **dont le brut vient de changer** : son détourage est
        oublié, son rendu recalculé, et il s'écrit à sa place.

        **Un seul appelant, et il est nommé ici** : le rejeu du recalage d'un
        calque (R5, `docs/PLAN.md`). Ce n'est pas une exception à « le brut ne
        change jamais » — c'en est la borne exacte. Le brut d'un calque n'a
        jamais été l'image payée : l'image payée est la planche, qui reste le
        brut de sa génération et que personne ne touche ; celui du calque est
        déjà un dérivé — la case découpée puis recalée —, donc un cache, et un
        cache se recalcule (`docs/archi-versions.md` § Le calque par différence).

        **Oublier le détourage est la moitié qui décide.** Il est gardé sous
        l'identifiant de l'asset, et l'identifiant, lui, ne change pas : sans
        cette ligne, le rendu se recalculerait sur l'image d'avant, et le geste
        n'aurait aucun effet visible.
        """
        self._oublier_detourage(asset.identifiant)
        self._rendre(asset)
        self.sauver(asset, annoncer=annoncer)
        return asset

    def rattraper(self, generations: list[Generation]) -> int:
        """Donne un asset aux images produites avant que les assets existent.

        Deux cas, et c'est le même geste : les images de T1, arrivées quand
        l'atelier ne savait pas encore ce qu'était une recette, et celles d'un
        index effacé qu'on reconstruit. Rien n'est recalculé et rien n'est
        écrasé — un emplacement qui a déjà son asset est sauté, donc sa recette
        aussi.

        C'est le premier versement sur « les fichiers font foi, la base est un
        index reconstructible » (T3) : la reconstruction complète relira le
        disque, celle-ci relit ce que la base sait déjà des générations.
        """
        nes = 0
        for generation in generations:
            # ⚠️ **Un clip n'entre jamais en bibliothèque** (A9, V3), et cette
            # ligne est ce qui empêche l'atelier de refuser de s'ouvrir.
            #
            # Trouvé au navigateur le 4 septembre 2026, sur un atelier jetable
            # où trois clips étaient déjà arrivés : au redémarrage, ce
            # rattrapage voyait trois emplacements réussis sans asset, tentait
            # d'en faire des images, et le détourage levait *cannot identify
            # image file* sur le fichier vidéo. **L'atelier ne démarrait plus
            # du tout** — pas une tuile cassée, pas une image manquante : plus
            # d'atelier. Aucun essai ne pouvait le voir : ils montent un
            # atelier neuf et ne le rouvrent jamais.
            #
            # C'est le même refus que celui de la planche qui attend, et pour
            # une raison plus forte encore : une planche *est* une image, un
            # clip n'en est pas une, et rien de ce qui mesure une image ne sait
            # le lire. Son fichier, sa dépense et ses images extraites vivent
            # sur la génération, où l'ouverture les retrouve intacts.
            if generation.clip is not None:
                continue
            # **La planche d'un lot plié entre ici comme les autres, depuis
            # `G16`.** Elle n'entrait pas : « aucune feuille assemblée n'est
            # livrable » (C2) l'interdisait, et l'auteur ne pouvait donc jamais
            # regarder l'image qu'il avait payée. Cet invariant est levé — le
            # plan le prévoyait pour `P1`, `G16` en prend la première moitié.
            #
            # **Ce rattrapage est ce qui la fait apparaître sur les lots
            # d'avant**, et il ne repaie rien : la feuille est sur le disque
            # depuis son arrivée, on lui donne son asset. Ses morceaux, eux,
            # sont déjà rangés ; un dépliage manquant se rattrape ailleurs,
            # chez `ServicePliage`.
            if generation.pliage is not None:
                # **Une planche qui attend un choix n'entre pas**, elle non plus
                # (R6, US-368). *Aucune image n'entre en bibliothèque avant que
                # l'auteur ait vu ce qui est arrivé* : la feuille en est une
                # depuis `G16`, et la règle vaut donc pour elle. C'est le même
                # refus, mot pour mot, que celui de la reprise au démarrage —
                # le lot a déjà été regardé une fois, il attend un geste, pas
                # un rangement. Elle entrera au dépliage, avec ses morceaux.
                if generation.pliage.attend_un_choix:
                    continue
                for emplacement in generation.emplacements:
                    if emplacement.resultat is None:
                        continue
                    if not self._fichiers.existe(emplacement.resultat.fichier):
                        continue
                    identifiant = identifiant_de(
                        generation.identifiant, emplacement.rang
                    )
                    if self._base.lire_asset(identifiant) is not None:
                        continue
                    planche = asset_de_planche(generation, emplacement)
                    if planche is None:  # pragma: no cover — garde du dessus
                        continue
                    self.accueillir(planche, annoncer=False)
                    nes += 1
                continue
            for emplacement in generation.emplacements:
                if emplacement.resultat is None:
                    continue
                # **Pas d'image sur le disque, pas d'asset.** C'est ce qui
                # empêche une suppression définitive de ressusciter au
                # redémarrage : effacer les fichiers suffit à effacer l'asset,
                # sans qu'une pierre tombale ait à être gardée quelque part.
                if not self._fichiers.existe(emplacement.resultat.fichier):
                    continue
                identifiant = identifiant_de(generation.identifiant, emplacement.rang)
                connu = self._base.lire_asset(identifiant)
                if connu is not None:
                    # **Un asset écrit avant T3 ne porte pas son coût** : le
                    # champ n'existait pas. Sa génération, elle, l'a toujours
                    # porté. Le lui reprendre ici évite d'afficher `$0,0000` sur
                    # une tuile dont l'image a bel et bien été payée — alors que
                    # le total du projet, lui, dirait autre chose. Un rattrapage
                    # de plus, et c'est exactement le métier de cette méthode.
                    repare = False
                    if not connu.consomme and emplacement.consomme:
                        connu.consomme = emplacement.consomme
                        connu.unite = emplacement.unite
                        repare = True
                    # **La date du lot, pas celle de l'arrivée.** Les assets
                    # d'avant T3 portent l'instant où leur image est tombée :
                    # deux variations d'un même appel ont donc deux dates, et la
                    # grille les rend dans l'ordre où elles sont arrivées plutôt
                    # que dans celui de leurs emplacements. Vu à l'écran sur le
                    # ranger, dont la variation 1 passait devant la 0.
                    if connu.cree_le != generation.cree_le:
                        connu.cree_le = generation.cree_le
                        repare = True
                    # **Le modèle, pour tout ce qui est né avant C1.** Le champ
                    # n'existait pas sur l'asset ; il a toujours existé sur la
                    # génération. Sans ce rattrapage, la fiche d'une image
                    # payée dirait « inconnu » alors que le nom est sur le
                    # disque à côté (`docs/PIEGES.md` — un champ ajouté à un
                    # objet ne se rétro-remplit pas tout seul).
                    if not connu.modele and generation.modele:
                        connu.modele = generation.modele
                        repare = True
                    if repare:
                        self.sauver(connu)
                    continue
                self.naitre(generation, emplacement)
                nes += 1
        return nes

    # ── Lecture ──────────────────────────────────────────────────────────────

    def lire(self, identifiant: str) -> Asset | None:
        """L'asset, ou rien. **Un supprimé est absent**, même pendant que son
        annulation court : il a quitté la bibliothèque au moment du geste, donc
        plus rien ne le sert, ne le retouche ni ne le réinjecte. Ses fichiers,
        eux, attendent encore le délai — c'est ce qui rend l'annulation
        possible, et ça ne regarde que la bibliothèque."""
        asset = self._base.lire_asset(identifiant)
        return None if asset is not None and asset.supprime else asset

    def recents(self, limite: int = 200) -> list[Asset]:
        return self._base.assets_recents(limite)

    def octets(
        self, asset: Asset, *, brut: bool = False, avant: bool = False
    ) -> tuple[bytes, str]:
        """Les octets à servir, et leur type de média.

        **Le rendu se recalcule quand son fichier a disparu.** C'est un critère
        d'acceptation, et c'est aussi le seul chemin de code : un fichier absent
        et un fichier périmé mènent au même geste, donc il n'y en a qu'un.

        `avant` rend le calque **tel que la différence l'avait produit**, avant
        que la main y passe (C4, US-151). Voir `_avant`.
        """
        if avant and not brut:
            octets = self._avant(asset)
            if octets is not None:
                return octets, "image/png"

        if brut or asset.recette.vide:
            if not self._fichiers.existe(asset.brut):
                raise ErreurAtelier("le fichier de cette image a disparu du disque")
            return self._fichiers.lire(asset.brut), asset.type_media

        if not asset.rendu_a_jour or not self._fichiers.existe(asset.rendu or ""):
            self._rendre(asset)
            self.sauver(asset)
        return self._fichiers.lire(asset.rendu or ""), "image/png"

    def reference(self, identifiant: str) -> bytes:
        """Les octets à renvoyer au fournisseur quand cet asset repart (US-12).

        **Le rendu, et en PNG.** Le rendu parce que ce qu'on réinjecte doit être
        ce qu'on voit — réinjecter le brut d'un asset détouré renverrait le fond
        gris qu'on vient d'enlever. Le PNG parce que c'est le seul format qui
        porte l'alpha, et parce que l'adaptateur envoie ses références en
        `data:image/png` : lui passer du JPEG sous cette étiquette serait un
        mensonge qui se réveillerait chez le fournisseur.
        """
        octets, type_media = self.octets(self._trouver(identifiant))
        return octets if type_media == "image/png" else rendre_en_png(octets)

    # ── Poser une recette ────────────────────────────────────────────────────

    def apercu_recette(
        self, identifiant: str, recette: Recette, *, voyageuse: bool = False,
        nom: str | None = None, reinitialiser: bool = False,
    ) -> dict[str, Any]:
        """Rejouer un brouillon sans écrire l’asset ni son cache durable.

        La copie passe dans les mêmes mesures et le même rendu que l’enregistrement.
        Les seules écritures sont les petits caches de calcul en mémoire.
        """
        asset = self._trouver(identifiant)
        laisse: tuple[str, ...] = ()
        if nom is not None:
            recettes = self.recettes()
            if nom not in recettes:
                raise RecetteRefusee(f"aucune recette nommée « {nom} »")
            recette, laisse = voyage(recettes[nom])
            recette = replace(recette, nom=nom)
        elif voyageuse:
            recette, laisse = voyage(recette.sans_nom())
        recette = self._places_de(asset, recette, reinitialiser=reinitialiser)
        self._verifier(recette, asset.projet)
        copie = replace(asset, recette=recette)
        marque = _BROUILLON_RECETTE.set(True)
        try:
            rendu = self._calculer(copie)
            mesures = self._taches_de(copie)
        finally:
            _BROUILLON_RECETTE.reset(marque)
        return {
            "recette": recette.en_json(), "largeur": rendu.largeur,
            "hauteur": rendu.hauteur,
            "rendu": "data:image/png;base64," + base64.b64encode(rendu.octets).decode("ascii"),
            "mesures": mesures, "laisse": list(laisse),
        }

    @staticmethod
    def _places_de(asset: Asset, recette: Recette, *, reinitialiser: bool = False) -> Recette:
        return replace(
            recette, difference=None if reinitialiser else asset.recette.difference,
            passes=moteurs_suivis(asset.recette.passes, recette.passes),
        )

    def poser_recette(self, identifiant: str, recette: Recette) -> Asset:
        """Le geste de la tranche. Vérifie, applique, épingle, annonce.

        **Épingle** : « toucher une recette à la main épingle l'asset »
        (`docs/PRD.md`). Écrit ici, relu en T4 — un changement de palette de
        projet saute les épinglés et rend le compte des deux.

        **Elle pose la recette entière, différence comprise** : c'est ce dont
        `borner` et `affiner` ont besoin, eux qui n'écrivent qu'elle. Ce qui
        arrive de l'écran ne sait pas la dire, et passe donc par
        `poser_les_places`.
        """
        asset = self._trouver(identifiant)
        self._verifier(recette, asset.projet)
        asset.recette = recette
        asset.epingle = True
        self._rendre(asset)
        self.sauver(asset)
        return asset

    def poser_les_places(self, identifiant: str, recette: Recette, *, reinitialiser: bool = False) -> Asset:
        """Les places de la recette, **sans toucher à la différence** (E5).

        C'est le geste de l'écran, et le seul que l'écran sache faire : la
        charge qu'il envoie n'a pas de champ pour dire une différence, parce
        qu'une différence se pose ailleurs — le rectangle par `borner`, les deux
        couches de la main par `affiner`. Elle repartait donc à `None` à chaque
        réglage posé, et **retoucher la grille d'un calque le rendait à sa
        case**, c'est-à-dire au corps habillé, sans un mot.

        *Trouvé le 31 août 2026 en tenant E5, et le défaut est plus vieux que
        les tables* : il vivait dans la fiche depuis C3. Personne ne l'avait vu
        parce qu'on ne retouche presque jamais un calque par sa recette — les
        tables viennent de le mettre à un clic de toutes les images.

        Ce qui répare n'est pas un champ de plus dans la charge : c'est de dire
        ici, une fois, **de quoi cette charge-là parle**. Un champ de plus
        aurait rendu possible qu'un onglet en retard réécrive une différence
        avec la version qu'il avait chargée.

        **Et c'est ici que le durcissement suit le moteur** (D1). Changer de
        moteur sans y toucher laissait le durcissement du moteur d'avant ;
        compté sur les recettes de l'auteur, il l'a retapé lui-même **39 fois
        sur 40** en passant au moteur par modèle. La comparaison avec la recette
        rangée est ce qui permet de lire *le moteur a changé* dans une charge
        qui ne dit que son état final — et la règle ne touche que ce que
        personne n'a choisi : un durcissement déplacé à la main est un choix, et
        un choix ne se réécrit pas.
        """
        asset = self._trouver(identifiant)
        if reinitialiser and recette.vide:
            return self.revenir_au_brut(identifiant)
        return self.poser_recette(
            identifiant,
            self._places_de(asset, recette, reinitialiser=reinitialiser),
        )

    def revenir_au_brut(self, identifiant: str) -> Asset:
        """Un seul geste, et l'image d'origine est de retour (US-64).

        Le rendu est effacé du disque au passage : il ne correspond plus à rien,
        et le garder ferait croire à un travail qui n'existe plus.
        """
        asset = self._trouver(identifiant)
        if asset.rendu:
            self._fichiers.supprimer(asset.rendu)
        asset.recette = Recette()
        asset.rendu = None
        asset.empreinte = None
        asset.rendu_largeur = 0
        asset.rendu_hauteur = 0
        asset.epingle = False
        self._oublier_detourage(identifiant)
        self.sauver(asset)
        return asset

    # ── Les matières nées détourées (RG8) ────────────────────────────────────
    #
    # Avant le 19 septembre 2026, une matière naissait **détourée et recadrée
    # comme un personnage** : le barème du projet ne portait pas la nature
    # « matière », `Univers.recette_de` retombait sur `silhouette=True`
    # (`docs/PLAN-rangement.md` § Ce qui a déclenché ce plan). Le correctif
    # (`bareme_complete`) empêche que cela recommence ; il ne répare pas ce qui
    # est déjà né. Ces deux gestes le disent, et le font — jamais tout seuls.

    def recette_d_une_matiere(self, projet: str | None) -> Recette | None:
        """Ce que le jeu impose à une matière, **aujourd'hui** — ou `None`.

        Le même chemin que la naissance (`recette_du_projet` → `Univers.recette_de`
        sur l'échelle « matière »), donc ce que la fiche montre sous « Ce que le
        jeu lui a fait » et ce qu'on repose ici ne peuvent pas diverger.

        **`None` veut dire « je ne sais pas », jamais « rien »** : une image hors
        jeu, un jeu disparu, ou un barème sans échelle « matière » (`recette_de`
        retomberait alors sur une silhouette, c'est-à-dire sur le défaut même
        qu'on cherche à réparer). Dans tous ces cas on ne prétend rien : pas de
        « détourée », pas de bouton.
        """
        if projet is None:
            return None
        objet = self._base.lire_projet(projet)
        if objet is None:
            return None
        echelle = objet.univers.echelle(ECHELLE_MATIERE)
        if echelle is None:
            return None
        return objet.univers.recette_de(echelle)

    def etat_de_matiere(self, asset: Asset) -> dict[str, bool]:
        """`detouree` et `refaisable` : **le calcul unique**, que l'écran, l'API et
        l'agent lisent tous les trois.

        - `detouree` : l'image porte un détourage ou un recadrage **qui agit**, et
          la recette qu'une matière reçoit aujourd'hui n'en porte pas. Ce qui se
          lit est l'état de l'image, pas sa date : rien sur la génération, sur sa
          demande ni sur l'asset ne distingue une matière née avant le correctif
          d'une née après — `echelle="matière"` est dans les deux cas —, seule sa
          recette le fait. Une image que l'auteur a détourée à la main l'est
          aussi, et c'est juste : on la lui signale, on ne la répare pas seul.
        - `refaisable` : `detouree`, **et** l'image brute d'origine est encore sur
          le disque. Le brut ne change jamais (« l'image payée »), donc la bonne
          recette se rejoue dessus en quelques dizaines de millisecondes, sans
          fournisseur et sans un centime. Sans le brut, seule une génération neuve
          rendrait la matière : ce n'est pas refaisable, et on le dit.

        Une matière saine rend `False, False` : il n'y a rien à refaire.
        """
        juste = self.recette_d_une_matiere(asset.projet)
        detouree = juste is not None and asset.recette.decoupe and not juste.decoupe
        return {
            "detouree": detouree,
            "refaisable": detouree and self._fichiers.existe(asset.brut),
        }

    def refaire_une_matiere(self, identifiant: str) -> Asset:
        """Remet à une matière détourée **la recette que le jeu lui donne**, à
        partir de son image brute. Un geste, sans fournisseur, sans coût.

        Ce n'est ni `revenir_au_brut` — qui vide tout, grille et palette
        comprises : la matière sortirait à la taille du modèle — ni
        `appliquer_nommee` — qui suppose qu'une recette ait été nommée —, ni le
        balayage `realigner`, qui **ne touche jamais au détourage** par décision.
        C'est la recette de naissance d'une matière, posée à la main de l'auteur
        sur une image qui l'a manquée.

        **Le rendu est remplacé, et l'ancien n'est pas gardé** : le produit ne
        tient pas d'historique des rendus (un seul fichier par image, réécrit sur
        place), et la recette d'avant ne se range nulle part. Le brut, lui, n'est
        pas touché — la découpe peut toujours être reposée depuis la retouche.

        **L'image sort désépinglée**, comme après « Le remettre sur l'univers du
        jeu » : elle est de nouveau d'accord avec le jeu, et un changement de
        palette la rattrape.

        Refus, en 409 et avec une phrase : ce n'est pas une matière ; le jeu ne
        dit pas comment on en fabrique une ; le brut a disparu. Une matière déjà
        saine est rendue telle quelle, sans rien écrire — un second clic ne coûte
        rien et n'invente rien.
        """
        asset = self._trouver(identifiant)
        if not asset.matiere:
            raise RecetteRefusee("cette image n'est pas une matière : il n'y a rien à lui refaire")
        juste = self.recette_d_une_matiere(asset.projet)
        if juste is None:
            raise RecetteRefusee(
                "le jeu ne dit pas comment fabriquer une matière : ouvre l'écran Univers, "
                "le barème doit porter « matière »"
            )
        if not (asset.recette.decoupe and not juste.decoupe):
            return asset
        if not self._fichiers.existe(asset.brut):
            raise RecetteRefusee(
                "l'image d'origine n'est plus sur le disque : la seule façon de "
                "refaire cette matière est de la regénérer"
            )
        asset.recette = juste
        asset.epingle = False
        self._oublier_detourage(identifiant)
        self._rendre(asset)
        self.sauver(asset)
        return asset

    # ── Les recettes nommées ─────────────────────────────────────────────────

    def recettes(self) -> dict[str, Recette]:
        return {
            nom: Recette.depuis_json(contenu)
            for nom, contenu in self._fichiers.lire_recettes().items()
        }

    def nommer(
        self, nom: str, recette: Recette, projet: str | None = None
    ) -> tuple[dict[str, Recette], tuple[str, ...]]:
        """« Un preset *est* une recette nommée » — rien de plus (§4, règle 5).

        Rend les recettes **et ce qui n'a pas été enregistré** : une recette
        nommée ne garde que ce qui voyage, et l'auteur doit l'apprendre en
        l'enregistrant plutôt qu'en la rappelant.

        **`projet` est le projet ouvert, et il n'est pas facultatif en fait.**
        Une recette nommée ne pend à aucun asset : il n'y a donc pas d'univers
        « auquel elle appartient » à interroger, et sans rien dire ici la
        vérification jugeait la quantification sur *aucune* palette. Elle
        refusait alors toute recette quantifiée — la palette du projet étant
        posée sans être recopiée dans la recette —, y compris celle que l'écran
        venait d'accepter de composer. Le filet doit dire ce que le grisé dit,
        et le grisé regarde le projet ouvert : c'est lui qu'on lui passe.
        Corrigé le 3 septembre 2026, sur un 409 à l'enregistrement.
        """
        propre = nom.strip()
        if not propre:
            raise RecetteRefusee("une recette nommée a besoin d'un nom")
        self._verifier(recette, projet)
        enregistrees = self._fichiers.lire_recettes()
        # **Sans ce qui désigne un endroit de cette image-là** (U5). La règle est
        # écrite une fois, dans le domaine : la différence, les points de
        # pipette, le cadre tracé, le décalage du calibrage et les passages de la
        # main ne veulent rien dire sur une autre silhouette. Ce qui est laissé
        # est **rendu** plutôt que tu, pour que l'écran puisse le dire au moment
        # où l'on enregistre — et non au moment où l'on s'étonne.
        propre_recette, laisse = voyage(recette.sans_nom())
        enregistrees[propre] = propre_recette.en_json()
        self._fichiers.ecrire_recettes(enregistrees)
        return self.recettes(), laisse

    def oublier_recette(self, nom: str) -> dict[str, Recette]:
        enregistrees = self._fichiers.lire_recettes()
        enregistrees.pop(nom, None)
        self._fichiers.ecrire_recettes(enregistrees)
        return self.recettes()

    def appliquer_nommee(
        self, identifiant: str, nom: str
    ) -> tuple[Asset, tuple[str, ...]]:
        """Deux assets traités par la même recette nommée sortent identiques.

        C'est vrai par construction et non par soin : l'empreinte de la recette
        ne dépend que de ses réglages, et chaque étape est déterministe — d'où
        la coupe médiane plutôt que des k-moyennes tirées au sort.

        **Le voyage est refait ici, alors que `nommer` l'a déjà fait.** Ce n'est
        pas une redite : le disque porte des recettes écrites avant que la règle
        existe, et celles-là emportent encore des passages de main et des cadres
        tracés. Le critère demande qu'elles se rappellent **sans lever**, et que
        ce qu'elles perdent soit annoncé plutôt que posé. Une recette écrite
        depuis passe ici sans rien perdre, et sans rien dire.
        """
        enregistrees = self.recettes()
        if nom not in enregistrees:
            raise RecetteRefusee(f"aucune recette nommée « {nom} »")
        voyageable, laisse = voyage(enregistrees[nom])
        # **Par les places, jamais par la recette entière** : une différence
        # nomme *une autre image précise*, et celle de l'image d'arrivée doit
        # rester là où elle est.
        pose = self.poser_les_places(identifiant, replace(voyageable, nom=nom))
        return pose, laisse

    def coller(self, identifiant: str, recette: Recette) -> tuple[Asset, tuple[str, ...]]:
        """Les réglages d'une image, posés sur une autre (U5).

        **Le même chemin qu'une recette nommée, sans le disque.** Copier-coller
        et les recettes nommées répondent à deux durées de vie — la séance, et ce
        qui lui survit —, mais à une seule question : *qu'est-ce qui a du sens
        ailleurs ?* Deux réponses écrites à deux endroits auraient fini par
        diverger, et l'auteur aurait alors appris que coller et rappeler ne font
        pas tout à fait la même chose sans jamais savoir laquelle croire.

        **Et c'est le serveur qui coupe, pas l'écran.** L'écran garde la recette
        copiée telle quelle — c'est ce qu'il a sous les yeux — et l'envoie
        entière ; la règle du voyage vit d'un seul côté.
        """
        voyageable, laisse = voyage(recette.sans_nom())
        return self.poser_les_places(identifiant, voyageable), laisse

    # ── Le rendu ─────────────────────────────────────────────────────────────

    def _rendre(self, asset: Asset) -> None:
        """Calcule le cache et le pose sur le disque. Ne lève pas sur une recette
        vide : il n'y a alors rien à cacher, le brut fait l'affaire."""
        if asset.recette.vide:
            if asset.rendu:
                self._fichiers.supprimer(asset.rendu)
            asset.rendu = None
            asset.empreinte = None
            asset.rendu_largeur = 0
            asset.rendu_hauteur = 0
            return

        rendu = self._calculer(asset)
        asset.rendu = self._fichiers.ecrire_rendu(
            asset.generation, asset.rang, rendu.octets
        )
        asset.empreinte = asset.recette.empreinte()
        asset.rendu_largeur = rendu.largeur
        asset.rendu_hauteur = rendu.hauteur

    def _calculer(self, asset: Asset) -> Rendu:
        """Le détourage est gardé, la queue est refaite.

        C'est ce qui tient « chaque réglage répond sans attente perceptible » :
        faire glisser la grille, l'occupation ou le nettoyage ne repaie pas les
        130 ms du détourage, seulement les 28 ms du reste.

        **La différence s'insère entre les deux, et c'est le seul endroit du
        dépôt qui rende un asset** (C3). Elle n'est pas dans `traitement.py`
        parce qu'elle a besoin d'une **seconde image** — le corps — que seul un
        service sait aller chercher : un module pur qui lirait un asset par son
        identifiant ne serait plus pur.
        """
        return self._calculer_avec(asset, asset.recette)

    def _calculer_avec(self, asset: Asset, recette: Recette) -> Rendu:
        """Le même calcul, sur une recette qu'on lui donne.

        **Un seul chemin de rendu, trois appelants.** Le deuxième est l'avant
        d'US-151, qui rejoue la recette de l'asset avec les mains vidées ; le
        troisième est la mesure d'une table, qui la rejoue arrêtée à un rang.
        Deux chaînes écrites à deux endroits finiraient par ne plus rendre la
        même image, et la comparaison mesurerait alors l'écart entre deux codes
        plutôt que l'effet d'une retouche.
        """
        # **`en_rendu` et non `finir`, et c'est une réparation** (B1).
        # `_tableau_avec` a déjà appliqué la queue de la recette ; `finir`
        # l'appliquait une seconde fois. Le contour en sortait tracé deux fois —
        # un trait demandé à 1 px en rendait 2 — et le retournement, qui est une
        # involution, s'annulait purement et simplement. Trouvé au navigateur le
        # 6 septembre 2026, et invisible à tous les essais, qui appellent `queue`
        # une seule fois.
        return en_rendu(self._tableau_avec(asset, recette))

    def _tableau_avec(self, asset: Asset, recette: Recette) -> np.ndarray:
        """Le rendu, en tableau — l'étape d'avant le PNG.

        Ce que les mesures d'une table veulent : elles décrivent des pixels, et
        les rouvrir depuis des octets paierait un encodage pour rien.
        """
        # **La différence s'endort ici et pas dans `queue`** (U4). Elle est la
        # seule des huit places à s'appliquer hors du module de traitement —
        # elle a besoin d'une seconde image, que seul un service sait aller
        # chercher — donc sa veille se lit là où elle s'applique. Lui passer
        # `None` est exactement ce que « endormie » veut dire : la place garde
        # ses réglages dans la recette, et le calcul ne la voit pas.
        difference = None if recette.dort(DIFFERENCE) else recette.difference
        return queue(
            self._differencier(asset, self.detourage(asset), difference),
            recette,
        )

    def _avant(self, asset: Asset) -> bytes | None:
        """L'image **avant que la main y passe** (C4 US-151, puis E5).

        **Rien n'est écrit** : ni cache sur le disque, ni asset sauvé, ni
        empreinte déplacée. L'avant est une lecture, pas un état — le poser sur
        le disque en ferait une image que plus rien ne met à jour le jour où le
        recalage se rejoue, et il faudrait alors la nettoyer, donc la tenir.

        **Deux mains, et une seule question.** Celle de C4 affine le masque d'un
        calque d'équipement ; celle d'E5 est la septième place de la recette et
        passe sur n'importe quelle image. *Avant ›* les retire toutes les deux,
        parce que la question posée est la même — *qu'est-ce que j'ai changé
        moi-même ?* — et qu'un bouton qui n'en retirerait qu'une mentirait sur
        un calque qu'on vient de retoucher au pixel.

        Rend `None` quand il n'y a pas d'avant : une image sur laquelle aucune
        main n'est passée. **L'appelant sert alors le rendu ordinaire** plutôt
        qu'un refus — demander l'avant d'une image que personne n'a touchée est
        une question dont la réponse est l'image elle-même, pas une erreur.
        """
        difference = asset.recette.difference
        main = asset.recette.main
        touchee = (difference is not None and difference.main_posee) or (
            main is not None and not main.vide
        )
        if not touchee:
            return None
        recette = replace(
            asset.recette,
            difference=difference.sans_main() if difference is not None else None,
            main=None,
        )
        return self._calculer_avec(asset, recette).octets

    def _differencier(
        self, asset: Asset, rgba: np.ndarray, difference: Difference | None
    ) -> np.ndarray:
        """Ce qui a changé entre le corps et cette image-là — le calque (C3).

        **Le corps est relu à chaque rendu, jamais recopié dans le calque.**
        C'est la même règle qu'une réinjection, et elle a la même conséquence
        heureuse : déplacer le masque relance ce calcul et rien d'autre, donc le
        journal du projet ne bouge pas d'un centime (US-145).

        Un corps disparu ne fait pas tomber le rendu : le calque redevient ce
        qu'il est sur le disque — la case telle qu'elle est revenue. La recette
        garde sa différence, donc le corps revenu la lui rend. Jamais de cascade,
        ici comme ailleurs.

        **Un corps qui a changé de taille est un corps disparu**, et il reçoit
        le même traitement. Le calque a été taillé dans le cadre du corps *tel
        qu'il était au dépliage* ; changer la taille de pixel du projet rend le
        corps à une autre taille, et les deux images ne se superposent plus. Le
        remettre à l'échelle rééchantillonnerait le pixel art et fabriquerait une
        différence que personne n'a demandée — c'est très exactement ce que le
        recalage de C3 refuse de faire. Le calque redevient donc sa case, la
        recette garde sa différence, et le geste qui répare est le rejeu du
        recalage (R5), qui retaille depuis la planche payée. Payé le 29 août
        2026 sur `coeur de pierre - 01` (`docs/PIEGES.md`).

        **La différence est reçue, jamais relue sur l'asset** : c'est ce qui
        permet à l'avant d'US-151 de rejouer exactement ce calcul-ci avec les
        deux couches de la main vidées, sans qu'aucune ligne soit écrite deux
        fois.
        """
        if difference is None:
            return rgba
        base = self.lire(difference.base)
        if base is None:
            return rgba
        if _BROUILLON_RECETTE.get():
            octets = self._calculer(base).octets
        else:
            octets, _ = self.octets(base)
        corps = avec_alpha(octets)
        if corps.shape[:2] != rgba.shape[:2]:
            return rgba
        return differencier(corps, rgba, difference)

    def detourage(self, asset: Asset, passes: tuple[Passe, ...] | None = None) -> np.ndarray:
        """L'image détourée d'un asset, gardée sous la main.

        **Le seul endroit du dépôt qui détoure un asset**, et c'est ce qui rend
        le cache utile : le rendu de la fiche et l'aperçu du slicer demandent la
        même image détourée du même asset, et ne la paient qu'une fois. Deux
        chemins qui détoureraient chacun de leur côté paieraient 130 ms chacun,
        pour le même tableau.

        `passes` sert à détourer **autrement** que ne le dit la recette — le
        slicer a besoin d'un alpha même sur une planche que personne n'a
        détourée, sinon ses zones connexes n'en font qu'une, celle de l'image
        entière. La clé du cache porte l'empreinte des passes, donc les deux
        vues cohabitent sans se confondre.

        **Un détourage endormi est un détourage sans passe** (U4), et c'est la
        seule écriture juste. Ce cache est le seul endroit du dépôt qui détoure ;
        tout ce qui en descend — le rendu, la boîte du sujet de la table de
        recadrage, la couleur que lit la pipette — doit voir la même image que
        le rendu. Poser la veille sur la recette du cache aurait suffi au
        traitement mais pas à la clé, qui ne pèse que les passes : deux états
        très différents auraient partagé une entrée. Vider les passes règle les
        deux d'un coup, parce que c'est le même tableau **et** la même clé.
        """
        endormi = passes is None and asset.recette.dort(DETOURAGE)
        recette = Recette(
            passes=()
            if endormi
            else (asset.recette.passes if passes is None else passes)
        )
        cle = f"{asset.identifiant}:{recette.empreinte_passes()}"
        rgba = self._detourages.get(cle)
        if rgba is None:
            rgba = detourer(recette, self._fichiers.lire(asset.brut))
            self._garder_detourage(cle, rgba)
        return rgba

    def _garder_detourage(self, cle: str, rgba: np.ndarray) -> None:
        if len(self._detourages) >= DETOURAGES_GARDES:
            self._detourages.pop(next(iter(self._detourages)))
        self._detourages[cle] = rgba

    def _oublier_detourage(self, identifiant: str) -> None:
        for cle in [c for c in self._detourages if c.startswith(f"{identifiant}:")]:
            self._detourages.pop(cle, None)

    # ── Vérification ─────────────────────────────────────────────────────────

    def _verifier(self, recette: Recette, projet: str | None = None) -> None:
        """Ce qui est indisponible est refusé **en le nommant**, jamais corrigé.

        L'écran a déjà grisé : c'est le filet, pour un fichier retouché à la
        main, une recette nommée devenue caduque, ou un agent en T7.

        `projet` dit **quelle** palette existe : la quantification d'un asset se
        juge sur l'univers auquel il appartient, pas sur celui qui est ouvert à
        l'écran. Les deux se confondent presque toujours, et « presque » suffit
        à faire diverger un refus d'un grisé.
        """
        for rang, passe in enumerate(recette.passes, start=1):
            if passe.moteur not in MOTEURS:
                raise RecetteRefusee(f"passe {rang} : moteur inconnu « {passe.moteur} »")
            # **Un modèle inconnu du catalogue est refusé en le nommant** (U13),
            # comme une portée inconnue. Un modèle *pas encore descendu*, lui,
            # passe : il se rapatrie au premier rendu, et l'écran l'annonce
            # avant de partir — les deux absences ne se traitent pas pareil.
            if passe.moteur == MODELE and silhouette(passe.modele) is None:
                raise RecetteRefusee(
                    f"passe {rang} : modèle de silhouette inconnu "
                    f"« {passe.modele} »"
                )
            # L'identité précède la disponibilité : installer le moteur ne
            # réparerait pas un nom inconnu, même sur une machine sans rembg.
            raison = raison_moteur(passe.moteur)
            if raison is not None:
                raise RecetteRefusee(f"passe {rang} : {raison}")
            if not 0 <= passe.tolerance <= 255:
                raise RecetteRefusee(f"passe {rang} : la tolérance va de 0 à 255")
            if not 0 <= passe.seuil_alpha <= 255:
                raise RecetteRefusee(f"passe {rang} : le seuil alpha va de 0 à 255")
            if not 0 <= passe.durcissement <= DURCISSEMENT_MAX:
                raise RecetteRefusee(
                    f"passe {rang} : le durcissement va de 0 à {DURCISSEMENT_MAX}"
                )
            if passe.portee not in PORTEES:
                raise RecetteRefusee(
                    f"passe {rang} : portée inconnue « {passe.portee} »"
                )
            # **Un point négatif est refusé, un point hors cadre ne l'est pas.**
            # Le premier ne peut venir que d'un fichier écrit à la main ; le
            # second arrive tout seul le jour où le brut est remplacé par une
            # image plus petite, et refuser la recette entière ferait alors
            # disparaître les sept autres places pour un point devenu caduc. Le
            # traitement le tient : hors cadre, la pipette ne retire rien.
            if passe.point is not None and min(passe.point) < 0:
                raise RecetteRefusee(f"passe {rang} : le point visé sort de l'image")
            # **La forme entourée suit la règle du point, exactement** (U12) :
            # un point négatif est refusé, un point hors cadre ne l'est pas —
            # celui-là arrive tout seul le jour où le brut est remplacé par une
            # image plus petite. Seul le plafond de points est à part : il ne
            # protège pas la recette, il protège la machine.
            if len(passe.trace) > TRACE_MAX:
                raise RecetteRefusee(
                    f"passe {rang} : une forme entourée porte au plus "
                    f"{TRACE_MAX} points"
                )
            if any(x < 0 or y < 0 for x, y in passe.trace):
                raise RecetteRefusee(
                    f"passe {rang} : la forme entourée sort de l'image"
                )
            # **Le pinceau remonté dans le détourage** (B18) — le même rayon
            # que les deux couches de la différence et que la main : c'est le
            # même pinceau, posé un cran plus tôt dans la chaîne.
            for passage, trait in enumerate(passe.traits, start=1):
                if not 0 <= trait.rayon <= RAYON_MAX:
                    raise RecetteRefusee(
                        f"passe {rang}, pinceau {passage} : le rayon va de 0 à {RAYON_MAX}"
                    )

        grille = recette.grille
        if grille is not None:
            if not CIBLE_MIN <= grille.cible <= CIBLE_MAX:
                raise RecetteRefusee(
                    f"la grille cible va de {CIBLE_MIN} à {CIBLE_MAX} pixels"
                )
            # **Le plafond n'est plus 100 %, c'est ce que la case peut porter**
            # (tranche des tailles). Le refus disait la borne dans son message,
            # et c'était l'un des douze endroits où « rien ne peut être plus grand
            # qu'un personnage » était écrit. Le plafond dépend maintenant de la
            # cible — une case de 64 carrés porte trente-deux personnages, une de
            # 512 en porte quatre —, donc il se dit avec sa cible, sans quoi le
            # message serait vrai pour un projet et faux pour le suivant.
            haut = occupation_max(grille.cible)
            if not 1 <= grille.occupation <= haut:
                raise RecetteRefusee(
                    f"l'occupation va de 1 à {haut} % sur une case de {grille.cible} carrés"
                )
            if grille.ancrage not in ANCRAGES:
                raise RecetteRefusee(f"ancrage inconnu « {grille.ancrage} »")
            # **La méthode de réduction est refusée par son nom, et par son
            # absence** (D2). Le nom inconnu suit la règle du fichier retouché à
            # la main ; le grisé suit celle des moteurs — « ce qui est
            # indisponible est grisé avec sa raison, jamais proposé puis
            # refusé », et ce refus-ci est le filet derrière l'écran, pas la
            # porte d'entrée.
            if grille.methode not in METHODES_DE_REDUCTION:
                raise RecetteRefusee(f"méthode de réduction inconnue « {grille.methode} »")
            manque = raison_methode(grille.methode)
            if manque is not None:
                raise RecetteRefusee(f"réduction — {manque}")

        quantification = recette.quantification
        if quantification is not None:
            # **Le refus « aucune palette » est tombé en D2**, et c'était le
            # défaut lui-même. Il rendait la quantification impossible tant
            # qu'aucun artwork officiel n'était promu ; comme `recette_de` ne
            # la posait pas non plus dans ce cas, un projet sans artwork
            # produisait des sprites de dix mille couleurs **sans que rien ne
            # le dise**. Le réglage `couleurs` de l'univers ne servait alors à
            # rien du tout.
            #
            # Une palette vide n'est pas une pièce manquante : c'est « les
            # couleurs se déduisent de l'image », ce que `quantifier` sait
            # faire depuis toujours et ce dont l'essai de comparaison se sert.
            # L'écran le dit maintenant au lieu de l'interdire — voir
            # `raison_quantification`.
            if not COULEURS_MIN <= quantification.couleurs <= COULEURS_MAX:
                raise RecetteRefusee(
                    f"le nombre de couleurs va de {COULEURS_MIN} à {COULEURS_MAX}"
                )
            if quantification.tramage not in TRAMAGES:
                raise RecetteRefusee(f"tramage inconnu « {quantification.tramage} »")

            # **Les six réglages de B17, bornés ici comme les trois d'avant.**
            # Le filet vaut pour toute provenance — un agent, une recette nommée
            # relue d'un disque, un fichier retouché à la main —, et pas
            # seulement pour l'écran, dont les bornes sont déclarées à part dans
            # le modèle Pydantic.
            for nom, valeur, bas, haut in (
                ("la luminosité", quantification.luminosite, CURSEUR_MIN, CURSEUR_MAX),
                ("le contraste", quantification.contraste, CURSEUR_MIN, CURSEUR_MAX),
                ("la saturation", quantification.saturation, CURSEUR_MIN, CURSEUR_MAX),
                ("la teinte", quantification.teinte, TEINTE_MIN, TEINTE_MAX),
            ):
                if not bas <= valeur <= haut:
                    raise RecetteRefusee(f"{nom} va de {bas} à {haut}")

            # **Une couleur illisible se marque, elle ne se refuse pas**
            # (US-210) — la règle du contour, reprise telle quelle. Ce qui est
            # refusé ici est une paire qui ne nomme rien : sans les deux
            # couleurs, l'échange est un réglage posé qui n'agit nulle part, et
            # `docs/PIEGES.md:984` dit que c'est pire qu'un réglage absent.
            for rang, echange in enumerate(quantification.echanges, start=1):
                if not (echange.depuis and echange.vers):
                    raise RecetteRefusee(
                        f"échange {rang} : une paire nomme deux couleurs, "
                        "celle qui part et celle qui vient"
                    )
                if not 0 <= echange.tolerance <= TOLERANCE_ECHANGE_MAX:
                    raise RecetteRefusee(
                        f"échange {rang} : la tolérance va de 0 à {TOLERANCE_ECHANGE_MAX}"
                    )

            # ── Les six réglages de B18, bornés au même endroit ───────────────
            #
            # **Le nom d'abord, la valeur ensuite**, comme la méthode de
            # réduction en `D2` : un nom inconnu vient d'un agent ou d'un fichier
            # retouché à la main, et il vaut mieux le dire que rendre en silence
            # une image que personne n'a demandée. Le domaine, lui, continue de
            # retomber sur le neutre — il relit des fichiers, il ne juge pas.
            if quantification.algorithme not in ALGORITHMES:
                raise RecetteRefusee(
                    f"algorithme de palette inconnu « {quantification.algorithme} »"
                )
            if quantification.distance not in DISTANCES:
                raise RecetteRefusee(
                    f"distance des couleurs inconnue « {quantification.distance} »"
                )
            if not 0 <= quantification.force_tramage <= 100:
                raise RecetteRefusee("la force du tramage va de 0 à 100 %")
            # ⚠️ **Sur les couleurs déclarées, jamais sur `gardees_vives`.**
            # Cette lecture-là tronque déjà à `GARDEES_MAX` — c'est sa règle de
            # domaine, qui relit sans juger —, donc la comparer à `GARDEES_MAX`
            # ne peut jamais être vraie : un écran qui en enverrait douze en
            # perdait six en silence au lieu d'être refusé, ce qui est très
            # exactement le contraire de ce que le commentaire ci-dessus promet.
            declarees = [c for c in dict.fromkeys(quantification.gardees) if c]
            if len(declarees) > GARDEES_MAX:
                raise RecetteRefusee(
                    f"on ne garde pas plus de {GARDEES_MAX} couleurs"
                )

        bords = recette.bords
        if bords is not None:
            if bords.aire_min < 0:
                raise RecetteRefusee(
                    "l'aire minimale d'une tache ne peut pas être négative"
                )
            # Huit voisins, donc huit compagnons possibles : au-delà, le réglage
            # emporterait tout pixel entouré, y compris un aplat entier.
            if not 0 <= bords.grain_min <= GRAIN_MAX:
                raise RecetteRefusee(
                    f"le grain de couleur va de 0 à {GRAIN_MAX} voisins"
                )
            if not 0 <= bords.lissage <= LISSAGE_MAX:
                raise RecetteRefusee(f"le lissage va de 0 à {LISSAGE_MAX} passes")
            # ── Les sept moteurs de B18, bornés comme les deux d'avant ────────
            if not 0 <= bords.garder <= GARDER_MAX:
                raise RecetteRefusee(
                    f"garder le sujet seul va de 0 à {GARDER_MAX} amas"
                )
            if bords.boucher_jusqua < 0:
                raise RecetteRefusee(
                    "l'aire à boucher ne peut pas être négative"
                )
            if bords.reboucher_jusqua < 0:
                raise RecetteRefusee(
                    "l'aire à reboucher ne peut pas être négative"
                )
            if not 0 <= bords.ronger_regonfler <= MORPHOLOGIE_MAX:
                raise RecetteRefusee(
                    f"ronger puis regonfler va de 0 à {MORPHOLOGIE_MAX} px"
                )
            if not 0 <= bords.regonfler_ronger <= MORPHOLOGIE_MAX:
                raise RecetteRefusee(
                    f"regonfler puis ronger va de 0 à {MORPHOLOGIE_MAX} px"
                )
            if not 0 <= bords.vote_voisins <= LISSAGE_MAX:
                raise RecetteRefusee(
                    f"le vote des voisins va de 0 à {LISSAGE_MAX} passes"
                )

        # **Les deux couches de la main** (C4). Seul le rayon a des bornes : un
        # point hors du cadre se borne au lieu de lever — c'est la règle du
        # rectangle depuis T5, et un onglet resté ouvert pendant qu'on changeait
        # la cible de pixel du projet enverrait sinon une erreur là où il suffit
        # de rogner.
        difference = recette.difference
        if difference is not None:
            for couche, traits in (
                ("masque", difference.affinage),
                ("retouche", difference.retouche),
            ):
                for rang, trait in enumerate(traits, start=1):
                    if not 0 <= trait.rayon <= RAYON_MAX:
                        raise RecetteRefusee(
                            f"{couche}, passage {rang} : le rayon va de 0 à {RAYON_MAX}"
                        )

        # **Le contour** (E5). Trois valeurs fermées et une borne ; la couleur,
        # elle, n'est **pas** vérifiée contre la palette du projet — *une
        # couleur hors palette se marque, elle ne se refuse pas* (US-210), et le
        # refuser ici en ferait la seule place de la recette qui juge une
        # couleur.
        contour = recette.contours
        if contour is not None:
            if not 1 <= contour.epaisseur <= EPAISSEUR_MAX:
                raise RecetteRefusee(
                    f"l'épaisseur du contour va de 1 à {EPAISSEUR_MAX} pixels"
                )
            if contour.position not in POSITIONS:
                raise RecetteRefusee(f"position de contour inconnue « {contour.position} »")
            if contour.trous not in TROUS:
                raise RecetteRefusee(f"traitement des trous inconnu « {contour.trous} »")

        # **La main** (E5). Le même rayon que les deux couches ci-dessus, et
        # pour la même raison : c'est le même pinceau.
        main = recette.main
        if main is not None:
            couches: list[tuple[str, tuple[Any, ...]]] = [("l'opacité", main.opacite)]
            couches += [
                (calque.nom or f"calque {rang}", calque.passages)
                for rang, calque in enumerate(main.calques, start=1)
            ]
            for nom, passages in couches:
                for rang, trait in enumerate(passages, start=1):
                    if not 0 <= trait.rayon <= RAYON_MAX:
                        raise RecetteRefusee(
                            f"{nom}, passage {rang} : le rayon va de 0 à {RAYON_MAX}"
                        )

        # **La veille** (U4). Une place endormie qui n'existe pas est un réglage
        # qu'on croit avoir posé et qui n'agit nulle part — le contraire exact
        # de ce que la veille promet. Le filet vaut pour toute provenance : une
        # recette nommée écrite avant qu'une place soit renommée, un agent, un
        # fichier retouché à la main.
        for place in recette.veille:
            if place not in PLACES:
                raise RecetteRefusee(
                    f"veille : place inconnue « {place} » — "
                    f"les places sont {', '.join(PLACES)}"
                )

    # ── Enregistrement ───────────────────────────────────────────────────────

    def _trouver(self, identifiant: str) -> Asset:
        asset = self.lire(identifiant)
        if asset is None:
            raise AssetInconnu(identifiant)
        return asset

    def sauver(self, asset: Asset, *, annoncer: bool = True) -> None:
        """**Le seul endroit du dépôt qui écrive un asset.**

        La bibliothèque de T3 range, marque et supprime ; elle passe par ici
        pour poser le résultat. Deux écrivains, ce serait un jour un rangement
        écrit dans la base et pas dans le fichier — donc perdu à la première
        reconstruction.

        Écrire d'abord, annoncer ensuite — comme pour une génération. Ce qui est
        annoncé est donc toujours déjà sur le disque : un onglet qui reçoit
        l'événement puis redemande l'asset ne peut pas tomber sur un état plus
        ancien que celui qu'on vient de lui dire.

        **`annoncer=False` est pour les lots, et pour eux seuls.** La diffusion
        garde soixante-quatre messages par abonné : un balayage de palette qui
        touche cent assets en publierait cent, dont les trente-six premiers
        seraient perdus par un onglet lent — et l'écran redemanderait de toute
        façon la grille entière. L'appelant annonce alors **une fois**, à la
        fin, ce que le lot a fait. Le disque et l'index, eux, sont écrits dans
        tous les cas : se taire n'est jamais ne pas écrire.
        """
        # **Le fichier d'abord, l'index ensuite.** « Les fichiers font foi, la
        # base est un index reconstructible » : écrire l'index en premier
        # laisserait, si le processus s'arrête entre les deux lignes, un index
        # en avance sur le fichier — c'est-à-dire l'invariant à l'envers. Dans
        # cet ordre-ci, la pire coupure laisse un index en retard, que la
        # prochaine reconstruction rattrape.
        self._fichiers.ecrire_asset(asset.generation, asset.rang, asset.en_disque())
        self._base.enregistrer_asset(asset)
        if annoncer:
            self._diffusion.publier("asset", asset.en_json())


def _label(generation: Generation) -> str:
    """Le début du **sujet**. Un nom se change ; il ne se demande pas à l'avance.

    **Le sujet, et non le prompt** — corrigé le 1ᵉʳ septembre 2026. Le prompt
    est le texte assemblé : la bible du jeu s'y replie en tête, donc ses
    soixante premiers signes sont ceux du jeu et jamais ceux du sujet. Sur un
    jeu qui a une description, toutes les images naissaient donc avec le même
    nom — celui de la technique de rendu. Le sujet est gardé à part depuis
    `Demande.sujet` ; sans lui, on retombe sur le prompt, qui est le
    comportement juste quand il n'y a pas de sujet distinct.
    """
    demande = generation.demande
    texte = str(demande.get("sujet") or demande.get("prompt") or "").strip()
    return texte[:60] if texte else "sans titre"
