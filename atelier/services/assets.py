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
from typing import Any

import numpy as np

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import Emplacement, Generation
from atelier.domaine.recette import (
    ANCRAGES,
    MOTEURS,
    TRAMAGES,
    Recette,
)
from atelier.image import Rendu, detourer, finir, raison_moteur, rendre_en_png
from atelier.services.evenements import Diffusion

# Les bornes des réglages, et le seul endroit qui les dise. Une recette venue
# d'un fichier retouché à la main, ou d'un agent en T7, peut contenir n'importe
# quoi : elle est refusée en nommant le réglage fautif, jamais ramenée en
# silence vers la borne la plus proche. Ramener discrètement « 512 » à « 256 »
# rendrait un sprite d'une autre taille que celle inscrite dans la recette,
# sans que personne puisse le voir — leçon de `MySpriteAi/src/lib/renderSettings.ts`.
CIBLE_MIN, CIBLE_MAX = 8, 512
DURCISSEMENT_MAX = 4
COULEURS_MIN, COULEURS_MAX = 2, 256

# Combien de détourages restent sous la main. Le détourage coûte 130 ms là où le
# reste en coûte 28 : le garder évite de le refaire à chaque cran de curseur.
# Quatre suffit — on retouche un asset à la fois, deux au plus en comparant.
DETOURAGES_GARDES = 4


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

    def palette_du_projet(self) -> tuple[str, ...]:
        """La palette sur laquelle quantifier. Vide jusqu'en T4.

        Elle se déduira par calcul des artworks officiels du projet
        (`docs/PLAN.md`, T4). Tant qu'il n'y a ni projet ni artwork, il n'y a pas
        de palette — ce n'est pas une pièce manquante, c'est l'état réel.
        """
        return ()

    def raison_quantification(self) -> str | None:
        """Pourquoi la quantification est grisée — ou `None` quand elle ne l'est plus."""
        if self.palette_du_projet():
            return None
        return "aucune palette : elle se déduira des artworks du projet"

    def traitement(self) -> dict[str, Any]:
        """Ce que l'écran a besoin de savoir pour griser sans redemander."""
        return {
            "moteurs": [
                {"nom": moteur, "raison": raison_moteur(moteur)} for moteur in MOTEURS
            ],
            "quantification": {"raison": self.raison_quantification()},
            "recettes": sorted(self._fichiers.lire_recettes()),
        }

    # ── La naissance ─────────────────────────────────────────────────────────

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
            # faire de l'image ne dépend pas de l'appel qui l'a rendue.
            recette=ancien.recette if ancien else Recette(),
            epingle=ancien.epingle if ancien else False,
            # Ce que l'appel a facturé pour cette image-là. La tuile le porte ;
            # le total du projet, lui, se calcule sur les générations, qui sont
            # les seules à connaître les appels ratés.
            cout_usd=emplacement.cout_usd,
            # **Il entre en bibliothèque de lui-même** (US-25), dans le projet
            # où la génération est partie. Un rangement déjà posé à la main
            # l'emporte : ce que l'auteur a décidé ne se défait pas tout seul.
            projet=ancien.projet if ancien else generation.projet,
            collection=ancien.collection if ancien else None,
            favori=ancien.favori if ancien else False,
            # La filiation vient de la source d'édition réinjectée (US-12).
            # Sans réinjection, l'asset n'a pas de parent — et c'est vrai, pas
            # provisoire : rien ne l'a engendré.
            parent=generation.parent,
            # **La date du lot, pas celle de l'arrivée.** Les variations d'une
            # même génération n'arrivent pas ensemble : dater chaque asset de
            # son arrivée ferait glisser les tuiles les unes par rapport aux
            # autres pendant qu'on les regarde, et « la grille ne se recompose
            # jamais entre le départ et l'arrivée » (`docs/DESIGN.md`
            # § L'emplacement) tomberait. Le rang départage à égalité.
            cree_le=ancien.cree_le if ancien else generation.cree_le,
            # Ce qu'une relance ne doit pas défaire : le jugement de l'auteur.
            supprime_le=ancien.supprime_le if ancien else None,
            parent_supprime=ancien.parent_supprime if ancien else False,
        )
        self._oublier_detourage(identifiant)
        self._rendre(asset)
        self.sauver(asset)
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
                    if not connu.cout_usd and emplacement.cout_usd:
                        connu.cout_usd = emplacement.cout_usd
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

    def octets(self, asset: Asset, *, brut: bool = False) -> tuple[bytes, str]:
        """Les octets à servir, et leur type de média.

        **Le rendu se recalcule quand son fichier a disparu.** C'est un critère
        d'acceptation, et c'est aussi le seul chemin de code : un fichier absent
        et un fichier périmé mènent au même geste, donc il n'y en a qu'un.
        """
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

    def poser_recette(self, identifiant: str, recette: Recette) -> Asset:
        """Le geste de la tranche. Vérifie, applique, épingle, annonce.

        **Épingle** : « toucher une recette à la main épingle l'asset »
        (`docs/PRD.md`). Écrit ici, relu en T4 — un changement de palette de
        projet saute les épinglés et rend le compte des deux.
        """
        asset = self._trouver(identifiant)
        self._verifier(recette)
        asset.recette = recette
        asset.epingle = True
        self._rendre(asset)
        self.sauver(asset)
        return asset

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

    # ── Les recettes nommées ─────────────────────────────────────────────────

    def recettes(self) -> dict[str, Recette]:
        return {
            nom: Recette.depuis_json(contenu)
            for nom, contenu in self._fichiers.lire_recettes().items()
        }

    def nommer(self, nom: str, recette: Recette) -> dict[str, Recette]:
        """« Un preset *est* une recette nommée » — rien de plus (§4, règle 5)."""
        propre = nom.strip()
        if not propre:
            raise RecetteRefusee("une recette nommée a besoin d'un nom")
        self._verifier(recette)
        enregistrees = self._fichiers.lire_recettes()
        enregistrees[propre] = recette.sans_nom().en_json()
        self._fichiers.ecrire_recettes(enregistrees)
        return self.recettes()

    def oublier_recette(self, nom: str) -> dict[str, Recette]:
        enregistrees = self._fichiers.lire_recettes()
        enregistrees.pop(nom, None)
        self._fichiers.ecrire_recettes(enregistrees)
        return self.recettes()

    def appliquer_nommee(self, identifiant: str, nom: str) -> Asset:
        """Deux assets traités par la même recette nommée sortent identiques.

        C'est vrai par construction et non par soin : l'empreinte de la recette
        ne dépend que de ses réglages, et chaque étape est déterministe — d'où
        la coupe médiane plutôt que des k-moyennes tirées au sort.
        """
        enregistrees = self.recettes()
        if nom not in enregistrees:
            raise RecetteRefusee(f"aucune recette nommée « {nom} »")
        from dataclasses import replace

        return self.poser_recette(identifiant, replace(enregistrees[nom], nom=nom))

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
        """
        cle = f"{asset.identifiant}:{asset.recette.empreinte_passes()}"
        rgba = self._detourages.get(cle)
        if rgba is None:
            octets = self._fichiers.lire(asset.brut)
            rgba = detourer(asset.recette, octets)
            self._garder_detourage(cle, rgba)
        return finir(rgba, asset.recette)

    def _garder_detourage(self, cle: str, rgba: np.ndarray) -> None:
        if len(self._detourages) >= DETOURAGES_GARDES:
            self._detourages.pop(next(iter(self._detourages)))
        self._detourages[cle] = rgba

    def _oublier_detourage(self, identifiant: str) -> None:
        for cle in [c for c in self._detourages if c.startswith(f"{identifiant}:")]:
            self._detourages.pop(cle, None)

    # ── Vérification ─────────────────────────────────────────────────────────

    def _verifier(self, recette: Recette) -> None:
        """Ce qui est indisponible est refusé **en le nommant**, jamais corrigé.

        L'écran a déjà grisé : c'est le filet, pour un fichier retouché à la
        main, une recette nommée devenue caduque, ou un agent en T7.
        """
        for rang, passe in enumerate(recette.passes, start=1):
            if passe.moteur not in MOTEURS:
                raise RecetteRefusee(f"passe {rang} : moteur inconnu « {passe.moteur} »")
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

        grille = recette.grille
        if grille is not None:
            if not CIBLE_MIN <= grille.cible <= CIBLE_MAX:
                raise RecetteRefusee(
                    f"la grille cible va de {CIBLE_MIN} à {CIBLE_MAX} pixels"
                )
            if not 1 <= grille.occupation <= 100:
                raise RecetteRefusee("l'occupation va de 1 à 100 %")
            if grille.ancrage not in ANCRAGES:
                raise RecetteRefusee(f"ancrage inconnu « {grille.ancrage} »")

        quantification = recette.quantification
        if quantification is not None:
            raison = self.raison_quantification()
            if raison is not None and not quantification.palette:
                raise RecetteRefusee(f"quantification — {raison}")
            if not COULEURS_MIN <= quantification.couleurs <= COULEURS_MAX:
                raise RecetteRefusee(
                    f"le nombre de couleurs va de {COULEURS_MIN} à {COULEURS_MAX}"
                )
            if quantification.tramage not in TRAMAGES:
                raise RecetteRefusee(f"tramage inconnu « {quantification.tramage} »")

        if recette.bords is not None and recette.bords.aire_min < 0:
            raise RecetteRefusee("l'aire minimale d'une tache ne peut pas être négative")

    # ── Enregistrement ───────────────────────────────────────────────────────

    def _trouver(self, identifiant: str) -> Asset:
        asset = self.lire(identifiant)
        if asset is None:
            raise AssetInconnu(identifiant)
        return asset

    def sauver(self, asset: Asset) -> None:
        """**Le seul endroit du dépôt qui écrive un asset.**

        La bibliothèque de T3 range, marque et supprime ; elle passe par ici
        pour poser le résultat. Deux écrivains, ce serait un jour un rangement
        écrit dans la base et pas dans le fichier — donc perdu à la première
        reconstruction.

        Écrire d'abord, annoncer ensuite — comme pour une génération. Ce qui est
        annoncé est donc toujours déjà sur le disque : un onglet qui reçoit
        l'événement puis redemande l'asset ne peut pas tomber sur un état plus
        ancien que celui qu'on vient de lui dire.
        """
        # **Le fichier d'abord, l'index ensuite.** « Les fichiers font foi, la
        # base est un index reconstructible » : écrire l'index en premier
        # laisserait, si le processus s'arrête entre les deux lignes, un index
        # en avance sur le fichier — c'est-à-dire l'invariant à l'envers. Dans
        # cet ordre-ci, la pire coupure laisse un index en retard, que la
        # prochaine reconstruction rattrape.
        self._fichiers.ecrire_asset(asset.generation, asset.rang, asset.en_disque())
        self._base.enregistrer_asset(asset)
        self._diffusion.publier("asset", asset.en_json())


def _label(generation: Generation) -> str:
    """Le début du prompt. Un nom se change ; il ne se demande pas à l'avance."""
    prompt = str(generation.demande.get("prompt", "")).strip()
    return prompt[:60] if prompt else "sans titre"
