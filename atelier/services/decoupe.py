# -*- coding: utf-8 -*-
"""Découper une planche multi-sprites — une planche de huit devient huit assets.

**Ce service ne décide jamais tout seul de couper.** Il propose des rectangles
(`proposer`), et il coupe ceux qu'on lui donne (`decouper`). Les deux gestes sont
séparés exprès : c'est cette séparation, et rien d'autre, qui tient « une
détection ratée se corrige en grille fixe ou en sélection manuelle, sans jamais
bloquer » (US-73). L'écran affiche la proposition, l'auteur ajoute, retire,
redessine, et ce qui part à la découpe est **sa** liste — jamais le résultat
d'une détection qu'il aurait fallu convaincre.

**Une découpe est un asset entier, pas un morceau d'un autre.** Elle a ses
propres octets bruts, sa propre recette, son propre rendu et son propre
rangement. Ça se paie en octets sur le disque, et ça achète le seul critère qui
compte ici : **supprimer la planche laisse ses découpes en place** (US-28
appliqué à T5). Une découpe qui n'aurait été qu'un rectangle sur l'image de sa
planche mourrait avec elle — la suppression définitive efface `<rang>-*`, brut
compris.

**Le brut d'une découpe est du brut, pas un rendu.** On coupe dans l'image telle
qu'elle est arrivée, fond compris, avec quelques pixels de marge autour : la
découpe se détoure, se remet sur grille et se quantifie ensuite comme n'importe
quelle image du produit. Couper dans le rendu figerait dans les pixels ce que la
recette doit rester libre de défaire.

**Ce service ne demande jamais le fournisseur**, et ça se lit dans ses imports :
découper une planche déjà là ne coûte rien et marche réseau coupé.
"""

from __future__ import annotations

import time
from dataclasses import replace
from typing import Any, Iterable

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.recette import Passe, Recadrage, Recette
from atelier.image import COTE_MIN, Boite, decouper, grille_fixe, mesurer, zones_opaques
from atelier.services.assets import AssetInconnu, ServiceAssets
from atelier.services.bibliotheque import ServiceBibliotheque
from atelier.services.evenements import Diffusion

# Les deux modes de proposition. **Le second n'est pas un repli du premier** :
# une planche régulière dont les sprites se touchent, ou dont certaines cases
# sont vides, n'a pas de zones connexes séparées — et c'est l'auteur qui sait
# laquelle des deux planches il a sous les yeux.
AUTO = "auto"
GRILLE = "grille"
MODES = (AUTO, GRILLE)

# Le rang à partir duquel vivent les découpes, dans la génération de leur
# planche. **Au-dessus de tout emplacement imaginable** : un appel rend quelques
# variations, jamais cent. Le décalage évite que la relance d'un emplacement
# tombe un jour sur le rang d'une découpe et l'écrase.
RANG_DECOUPE = 100

# Combien de morceaux une planche rend au plus. Huit sur seize cases, quatre
# rangées de huit, une grille de 8 × 8 : soixante-quatre couvre tout ce qu'on
# découpe à la main, et borne ce qu'un seul geste peut créer. Au-delà, c'est un
# atlas, et un atlas se découpe par grille dans un moteur de jeu.
DECOUPES_MAX = 64

# En dessous, un rectangle n'est pas un sprite mais un clic qui a glissé.
COTE_UTILE = 2


class DecoupeRefusee(ErreurAtelier):
    """La découpe demandée n'est pas applicable, et on dit pourquoi."""

    code = "decoupe_refusee"


class ServiceDecoupe:
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

    # ── Proposer ─────────────────────────────────────────────────────────────

    def proposer(
        self,
        identifiant: str,
        *,
        mode: str = AUTO,
        colonnes: int = 2,
        lignes: int = 1,
        cote_min: int = COTE_MIN,
    ) -> dict[str, Any]:
        """Où l'on pourrait couper. **Rien n'est créé, rien n'est écrit.**

        Les boîtes sont exprimées dans les pixels de l'image **brute** — celle
        que la fiche sert sous `?brut=true` —, et jamais dans ceux du rendu. Le
        rendu peut être un sprite de 64 px là où la planche en fait 1024 : des
        rectangles posés dessus ne désigneraient plus rien de découpable.
        """
        if mode not in MODES:
            raise DecoupeRefusee(f"mode de découpe inconnu « {mode} »")
        asset = self._exiger(identifiant)

        raison: str | None = None
        if mode == GRILLE:
            if not 1 <= colonnes <= DECOUPES_MAX or not 1 <= lignes <= DECOUPES_MAX:
                raise DecoupeRefusee(f"la grille va de 1 à {DECOUPES_MAX} de côté")
            if colonnes * lignes > DECOUPES_MAX:
                raise DecoupeRefusee(
                    f"une planche se découpe en {DECOUPES_MAX} morceaux au plus"
                )
            boites = grille_fixe(asset.largeur, asset.hauteur, colonnes, lignes)
        else:
            # **On détoure d'abord, même si la recette ne le demande pas.** Une
            # planche telle qu'elle arrive du modèle est opaque de bord à bord :
            # sa seule zone connexe est l'image entière. Le moteur du geste
            # courant est celui qui ne charge aucun modèle et marche hors ligne
            # — même choix, et même phrase, que l'extraction de palette.
            passes = asset.recette.passes or (Passe(),)
            alpha = self._assets.detourage(asset, passes)[:, :, 3]
            boites = zones_opaques(alpha, cote_min=max(0, cote_min))
            if not boites:
                raison = (
                    "le détourage n'a rien laissé d'opaque — corrige à la main"
                    if not alpha.any()
                    else "aucune zone au-dessus de cette taille — descends la taille"
                )

        return {
            "asset": asset.identifiant,
            "label": asset.label,
            "largeur": asset.largeur,
            "hauteur": asset.hauteur,
            "mode": mode,
            "boites": [list(b) for b in boites],
            "raison": raison,
        }

    # ── Découper ─────────────────────────────────────────────────────────────

    def decouper(self, identifiant: str, boites: Iterable[Boite]) -> dict[str, Any]:
        """Chaque rectangle devient un asset, filié sur la planche (US-72, US-74).

        L'ordre reçu est l'ordre gardé : c'est celui que l'auteur a sous les yeux
        à l'écran, numéroté dans le pied de chaque rectangle. Le réordonner ici
        ferait mentir ces numéros au moment précis où l'on clique.

        Les découpes s'annoncent **une par une**, comme les variations d'un
        appel : ce sont des images neuves qui doivent apparaître dans la grille,
        et elles sont bornées à soixante-quatre — très en deçà du seuil à partir
        duquel un balayage doit se taire et n'annoncer qu'à la fin.
        """
        planche = self._exiger(identifiant)
        rectangles = self._verifier(planche, boites)

        morceaux = decouper(self._fichiers.lire(planche.brut), rectangles)
        rang = self._premier_rang_libre(planche.generation)
        maintenant = time.time()
        total = len(rectangles)

        nees: list[Asset] = []
        for numero, octets in enumerate(morceaux, start=1):
            mesure = mesurer(octets)
            chemin = self._fichiers.ecrire_brut(
                planche.generation, rang, octets, ".png"
            )
            nees.append(
                self._assets.accueillir(
                    Asset(
                        identifiant=identifiant_de(planche.generation, rang),
                        generation=planche.generation,
                        rang=rang,
                        brut=chemin,
                        largeur=mesure.largeur,
                        hauteur=mesure.hauteur,
                        type_media=mesure.type_media,
                        label=_label(planche.label, numero, total),
                        recette=_recette_heritee(planche),
                        # **L'épingle voyage avec la recette qu'elle protège.**
                        # Hériter d'une recette réglée à la main sans hériter de
                        # l'épingle livrerait huit découpes qu'un balayage de
                        # palette écraserait au premier passage, alors que
                        # l'auteur avait justement décidé le contraire.
                        epingle=planche.epingle,
                        # **Une découpe n'a rien coûté.** L'argent a été dépensé
                        # une fois, pour la planche, et la filiation y mène. Lui
                        # attribuer une part du prix inventerait un chiffre que
                        # personne n'a facturé — et le total du projet, qui se
                        # calcule sur les générations, dirait alors autre chose
                        # que la somme des tuiles.
                        cout_usd=0.0,
                        # **Une découpe appartient à qui a demandé la planche**
                        # (US-39). Couper n'est pas commander : c'est le même
                        # appel, poursuivi. Sans cette ligne, huit morceaux d'une
                        # planche de l'agent paraîtraient dans la grille comme
                        # s'ils venaient de la main de l'auteur.
                        provenance=planche.provenance,
                        # **Et du même modèle que sa planche** (US-123), pour la
                        # raison exacte de la provenance : découper n'est pas
                        # commander, c'est le même appel poursuivi. Un morceau
                        # sans modèle serait la seule image de la bibliothèque à
                        # ne pas savoir dire qui l'a dessinée.
                        modele=planche.modele,
                        projet=planche.projet,
                        collection=planche.collection,
                        parent=planche.identifiant,
                        # **Datée de maintenant, pas du lot de la planche.** Ce
                        # qu'on vient de fabriquer se voit en tête de grille :
                        # daté du lot, un découpage de planche ancienne
                        # atterrirait au fond, invisible au moment où on le
                        # regarde. Le rang départage les huit entre elles, donc
                        # elles restent dans l'ordre de lecture de la planche.
                        cree_le=maintenant,
                    )
                )
            )
            rang += 1

        # L'arbre compte les assets par projet et par collection : huit de plus
        # changent ces comptes, et personne d'autre ne les recalcule.
        self._diffusion.publier("bibliotheque", self._bibliotheque.arbre())
        return {
            "planche": planche.identifiant,
            "decoupes": [a.en_json() for a in nees],
        }

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _exiger(self, identifiant: str) -> Asset:
        asset = self._assets.lire(identifiant)
        if asset is None:
            raise AssetInconnu(identifiant)
        return asset

    def _verifier(self, planche: Asset, boites: Iterable[Boite]) -> list[Boite]:
        """Des rectangles utilisables, ou un refus qui nomme le fautif.

        L'écran a déjà empêché de dessiner hors de l'image ; c'est le filet, pour
        une requête écrite à la main et pour l'agent de T7. Rien n'est ramené en
        silence dans les bornes : un rectangle corrigé à l'insu de l'auteur
        découperait autre chose que ce qu'il a vu.
        """
        rectangles: list[Boite] = []
        for numero, brute in enumerate(boites, start=1):
            valeurs = [int(v) for v in brute]
            if len(valeurs) != 4:
                raise DecoupeRefusee(
                    f"rectangle {numero} : quatre nombres attendus — x0, y0, x1, y1"
                )
            x0, y0, x1, y1 = valeurs
            if x1 - x0 + 1 < COTE_UTILE or y1 - y0 + 1 < COTE_UTILE:
                raise DecoupeRefusee(f"rectangle {numero} : trop petit pour être découpé")
            if not (0 <= x0 and 0 <= y0 and x1 < planche.largeur and y1 < planche.hauteur):
                raise DecoupeRefusee(
                    f"rectangle {numero} : hors de la planche "
                    f"({planche.largeur}×{planche.hauteur})"
                )
            rectangles.append((x0, y0, x1, y1))

        if not rectangles:
            raise DecoupeRefusee("aucun rectangle — il n'y a rien à découper")
        if len(rectangles) > DECOUPES_MAX:
            raise DecoupeRefusee(
                f"une planche se découpe en {DECOUPES_MAX} morceaux au plus"
            )
        return rectangles

    def _premier_rang_libre(self, generation: str) -> int:
        """Le rang de la prochaine découpe.

        Pris au-dessus de **tout** ce que la génération connaît déjà, ses
        emplacements comme ses découpes précédentes : deux assets d'un même rang
        partageraient leurs fichiers `<rang>-brut` et `<rang>-asset.json`, et le
        second effacerait le premier sans rien dire.
        """
        pris = self._base.rangs_de_generation(generation)
        objet = self._base.lire(generation)
        if objet is not None:
            pris += [e.rang for e in objet.emplacements]
        return max([RANG_DECOUPE - 1, *pris]) + 1


def _label(planche: str, numero: int, total: int) -> str:
    """« goblin archer · 3/8 » — d'où ça vient, et lequel c'est.

    Le nom de la planche est raccourci plutôt que le numéro : c'est le numéro
    qui distingue huit tuiles voisines dans la grille, et un label tronqué à
    l'endroit du numéro les rendrait toutes identiques.
    """
    base = (planche or "sans titre").strip()[:48].rstrip()
    return f"{base} · {numero}/{total}"


def _recette_heritee(planche: Asset) -> Recette:
    """Ce que la planche a décidé s'applique à ce qui en sort.

    Huit découpes d'une planche détourée, remise sur grille et quantifiée
    ressortent détourées, remises sur grille et quantifiées pareil — c'est le
    seul comportement qui rende « découper » utile en un geste plutôt qu'en
    neuf.

    **Le recadrage explicite ne s'hérite pas.** Sa boîte désignait un rectangle
    de la planche ; posée sur une découpe, elle désignerait un rectangle qui n'a
    plus rien à voir, et le plus souvent hors de l'image. La marge, elle, reste :
    c'est un réglage, pas une coordonnée.
    """
    recette = planche.recette
    if recette.recadrage is None or recette.recadrage.boite is None:
        return recette
    return replace(recette, recadrage=Recadrage(marge=recette.recadrage.marge))
