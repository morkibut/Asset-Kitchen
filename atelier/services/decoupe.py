# -*- coding: utf-8 -*-
"""Découper une planche multi-sprites — une planche de huit devient huit assets.

**Ce service ne décide jamais tout seul de couper.** Il propose des rectangles
(`proposer`), et il coupe ceux qu'on lui donne (`decouper`). Les deux gestes sont
séparés exprès : c'est cette séparation, et rien d'autre, qui tient « une
détection ratée se corrige en grille fixe ou en sélection manuelle, sans jamais
bloquer » (US-73). L'écran affiche la proposition, l'auteur ajoute, retire,
redessine, et ce qui part à la découpe est **sa** liste — jamais le résultat
d'une détection qu'il aurait fallu convaincre.

**Une exception, demandée par une case** (RS7, 18 septembre 2026) : la planche
refaite dont l'auteur a coché *Découper à l'arrivée* se coupe toute seule quand
elle revient — et seulement si le compte des vues tombe juste. Voir
`a_l_arrivee`.

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

import asyncio
import time
from dataclasses import dataclass, replace
from typing import Any, Iterable

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import (
    ASSET,
    REFERENCE,
    Emplacement,
    Generation,
    Statut,
)
from atelier.domaine.personnage import PLANCHE as USAGE_PLANCHE
from atelier.domaine.planche import est_une_planche_refaite
from atelier.domaine.recette import Passe, Recette
from atelier.image import (
    COTE_MIN,
    Boite,
    decouper,
    gouttieres,
    grille_fixe,
    mesurer,
    zones_opaques,
)
from atelier.image.decoupe import ordre_des_vues
from atelier.services.assets import AssetInconnu, ServiceAssets
from atelier.services.bibliotheque import ServiceBibliotheque
from atelier.services.evenements import Diffusion
from atelier.services.rangs import rang_libre

# Les trois modes de proposition. **Aucun n'est un repli d'un autre** : une
# planche régulière dont les sprites se touchent, ou dont certaines cases sont
# vides, n'a pas de zones connexes séparées ; une feuille opaque de bord à bord
# n'a pas de grille connue d'avance mais porte des bandes de fond entre ses
# cases (`B18`) — et c'est l'auteur qui sait laquelle des trois planches il a
# sous les yeux.
AUTO = "auto"
GRILLE = "grille"
GOUTTIERES = "gouttieres"
MODES = (AUTO, GRILLE, GOUTTIERES)

# Au-delà, l'écran annonce le temps pris par la détection (`B18`, critère
# d'acceptation commun à tout l'atelier des moteurs) — jamais avant, pour ne
# pas alarmer sur ce qui se sent à peine.
SEUIL_LENT_MS = 240

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


def verifier_boites(
    boites: Iterable[Boite], largeur: int, hauteur: int, *, quoi: str = "planche"
) -> list[Boite]:
    """Des rectangles utilisables, ou un refus qui nomme le fautif.

    L'écran a déjà empêché de dessiner hors de l'image ; c'est le filet, pour une
    requête écrite à la main et pour l'agent de T7. **Rien n'est ramené en
    silence dans les bornes** : un rectangle corrigé à l'insu de l'auteur
    découperait autre chose que ce qu'il a vu.

    **Écrite ici et servie deux fois** — à la planche d'assets et à la carte du
    tableau d'inspiration, qui se découpe depuis le 1ᵉʳ septembre 2026. Les deux
    fabriquent des choses différentes ; ce qu'un rectangle doit valoir pour être
    découpable ne dépend pas de ce qu'on en tire. Deux copies de cette
    vérification finiraient par accepter deux choses différentes, et c'est
    exactement le genre d'écart qu'on ne voit qu'au moment où l'image est déjà
    coupée. `quoi` ne sert qu'au texte du refus.
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
        if not (0 <= x0 and 0 <= y0 and x1 < largeur and y1 < hauteur):
            raise DecoupeRefusee(
                f"rectangle {numero} : hors de l'image ({largeur}×{hauteur})"
            )
        rectangles.append((x0, y0, x1, y1))

    if not rectangles:
        raise DecoupeRefusee("aucun rectangle — il n'y a rien à découper")
    if len(rectangles) > DECOUPES_MAX:
        raise DecoupeRefusee(
            f"une {quoi} se découpe en {DECOUPES_MAX} morceaux au plus"
        )
    return rectangles


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

        depart = time.perf_counter()
        raison: str | None = None
        if mode == GRILLE:
            if not 1 <= colonnes <= DECOUPES_MAX or not 1 <= lignes <= DECOUPES_MAX:
                raise DecoupeRefusee(f"la grille va de 1 à {DECOUPES_MAX} de côté")
            if colonnes * lignes > DECOUPES_MAX:
                raise DecoupeRefusee(
                    f"une planche se découpe en {DECOUPES_MAX} morceaux au plus"
                )
            boites = grille_fixe(asset.largeur, asset.hauteur, colonnes, lignes)
        elif mode == GOUTTIERES:
            # **Elle lit la brute telle quelle, sans détourage.** C'est ce qui
            # la rend utile là où « zones opaques » échoue : une feuille opaque
            # de bord à bord n'a qu'une seule tache une fois détourée, mais ses
            # bandes de fond entre les cases restent lisibles sur l'image brute.
            boites = gouttieres(self._fichiers.lire(asset.brut))
            if not boites:
                raison = (
                    "aucune bande de fond entièrement unie — corrige à la main"
                )
        else:
            # **On détoure d'abord, même si la recette ne le demande pas.** Une
            # planche telle qu'elle arrive du modèle est opaque de bord à bord :
            # sa seule zone connexe est l'image entière. Le moteur du geste
            # courant est celui qui ne charge aucun modèle et marche hors ligne
            # — même choix, et même phrase, que l'extraction de palette.
            passes = asset.recette.passes_vives() or (Passe(),)
            alpha = self._assets.detourage(asset, passes)[:, :, 3]
            boites = zones_opaques(alpha, cote_min=max(0, cote_min))
            if not boites:
                raison = (
                    "le détourage n'a rien laissé d'opaque — corrige à la main"
                    if not alpha.any()
                    else "aucune zone au-dessus de cette taille — descends la taille"
                )
        duree_ms = (time.perf_counter() - depart) * 1000

        return {
            "asset": asset.identifiant,
            "label": asset.label,
            "largeur": asset.largeur,
            "hauteur": asset.hauteur,
            "mode": mode,
            "boites": [list(b) for b in boites],
            "raison": raison,
            "duree_ms": round(duree_ms, 1),
        }

    # ── Découper ─────────────────────────────────────────────────────────────

    def decouper(
        self,
        identifiant: str,
        boites: Iterable[Boite],
        *,
        noms: Iterable[str | None] | None = None,
    ) -> dict[str, Any]:
        """Chaque rectangle devient un asset, filié sur la planche (US-72, US-74).

        L'ordre reçu est l'ordre gardé : c'est celui que l'auteur a sous les yeux
        à l'écran, numéroté dans le pied de chaque rectangle. Le réordonner ici
        ferait mentir ces numéros au moment précis où l'on clique.

        Les découpes s'annoncent **une par une**, comme les variations d'un
        appel : ce sont des images neuves qui doivent apparaître dans la grille,
        et elles sont bornées à soixante-quatre — très en deçà du seuil à partir
        duquel un balayage doit se taire et n'annoncer qu'à la fin.

        **`noms` porte ce que l'écran a laissé l'auteur écrire, jamais l'inverse**
        (« l'auteur déclare, l'application enregistre »). Aligné aux rectangles,
        un nom vide ou absent reprend le numéro par défaut — c'est le seul cas où
        l'écran n'a rien à dire de plus qu'un rang.
        """
        planche = self._exiger(identifiant)
        rectangles = self._verifier(planche, boites)
        nees = self._couper(planche, rectangles, noms)
        return {
            "planche": planche.identifiant,
            "decoupes": [a.en_json() for a in nees],
        }

    def _couper(
        self,
        planche: Asset,
        rectangles: list[Boite],
        noms: Iterable[str | None] | None = None,
        *,
        personnage: str | None = None,
    ) -> list[Asset]:
        """Les morceaux, écrits et annoncés — le geste commun à la découpe à la
        main et à la découpe à l'arrivée (RS7).

        `personnage` ne sert qu'à l'arrivée : une planche refaite est l'image
        d'**un** sujet, et chacune de ses vues l'est aussi — rattachée à lui,
        sans pose, c'est ce que l'auteur faisait à la main. La découpe à la main
        reste ce qu'elle était : elle ne range rien que l'auteur n'ait rangé.
        """
        noms_recus = list(noms) if noms is not None else []

        morceaux = decouper(self._fichiers.lire(planche.brut), rectangles)
        recette, epingle = self._recette_des_morceaux(planche)
        rang = self._premier_rang_libre(planche.generation)
        maintenant = time.time()
        total = len(rectangles)

        nees: list[Asset] = []
        for numero, octets in enumerate(morceaux, start=1):
            mesure = mesurer(octets)
            chemin = self._fichiers.ecrire_brut(
                planche.generation, rang, octets, ".png"
            )
            nom = noms_recus[numero - 1] if numero - 1 < len(noms_recus) else None
            nom = nom.strip() if isinstance(nom, str) else None
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
                        label=nom or _label(planche.label, numero, total),
                        recette=recette,
                        # **L'épingle voyage avec la recette qu'elle protège.**
                        # Hériter d'une recette réglée à la main sans hériter de
                        # l'épingle livrerait huit découpes qu'un balayage de
                        # palette écraserait au premier passage, alors que
                        # l'auteur avait justement décidé le contraire.
                        epingle=epingle,
                        # **Une découpe n'a rien coûté.** L'argent a été dépensé
                        # une fois, pour la planche, et la filiation y mène. Lui
                        # attribuer une part du prix inventerait un chiffre que
                        # personne n'a facturé — et le total du projet, qui se
                        # calcule sur les générations, dirait alors autre chose
                        # que la somme des tuiles.
                        consomme=0.0,
                        # **L'unité de l'appel, avec une quantité nulle** (F2).
                        # Zéro dollar et zéro jeton ne se lisent pas pareil :
                        # le premier s'écrit « $0,0000 », le second « gratuit ».
                        unite=planche.unite,
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
                        personnage=personnage,
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

        # L'arbre compte les assets par projet : huit de plus changent ce
        # compte, et personne d'autre ne le recalcule.
        self._diffusion.publier("bibliotheque", self._bibliotheque.arbre())
        return nees

    # ── Découper à l'arrivée (RS7) ───────────────────────────────────────────
    #
    # **La seule découpe que l'atelier fait sans qu'on lui tende des
    # rectangles**, et elle ne contredit pas l'en-tête de ce fichier : c'est
    # l'auteur qui l'a demandée, par une case cochée avant de payer (décision 7
    # de `docs/PLAN-references-du-sujet.md`). Ce qu'elle garde de la règle,
    # c'est le refus : **mieux vaut une planche entière qu'une découpe fausse**.
    # Un compte qui ne tombe pas juste ne coupe rien, et la planche arrive seule
    # avec une phrase qui dit pourquoi — la découpe à la main reste là.

    async def a_l_arrivee(self, generation: Generation, emplacement: Emplacement) -> None:
        """Coupe la feuille qui vient d'arriver, si l'appel l'a demandé.

        **La détection part dans un fil à part** : elle détoure la feuille *et*
        la référence planche, et un détourage par modèle prend plusieurs
        secondes — le serveur doit continuer de répondre pendant ce temps (même
        choix que le montage automatique d'un clip, `animation.py`). Les
        écritures, elles, reviennent sur la boucle, comme celles du dépliage
        d'un lot : ce sont les mêmes gestes que la découpe à la main.

        **Ne lève jamais** : la planche est payée et entrée, et rien de ce qui
        se passe ici ne doit la faire paraître ratée.
        """
        if not self.a_couper(generation, emplacement):
            return
        try:
            vues = await asyncio.to_thread(self._vues, generation, emplacement.rang)
        except Exception as erreur:  # noqa: BLE001 — la planche payée ne perd rien
            vues = _Vues(raison=f"la détection a échoué ({erreur}) — découpez à la main")
        self._poser(generation, emplacement, vues)

    def couper_a_l_arrivee(self, generation: Generation, emplacement: Emplacement) -> bool:
        """La même chose, d'un seul tenant — pour le démarrage, où rien d'autre
        ne tourne encore. Vrai quand l'emplacement a reçu sa marque."""
        if not self.a_couper(generation, emplacement):
            return False
        try:
            vues = self._vues(generation, emplacement.rang)
        except Exception as erreur:  # noqa: BLE001 — même raison qu'à l'arrivée
            vues = _Vues(raison=f"la détection a échoué ({erreur}) — découpez à la main")
        self._poser(generation, emplacement, vues)
        return True

    def reprendre(self, generations: Iterable[Generation]) -> int:
        """Les feuilles arrivées que l'arrêt de l'atelier a empêché de couper.

        **Une feuille marquée n'est jamais recoupée**, quelle que soit la
        marque : coupée, refusée, ou coupée *en plein milieu*. Ce dernier cas
        devient un refus lisible plutôt qu'une seconde découpe — des morceaux
        sont peut-être déjà là, et en refaire donnerait deux fois chaque vue.

        Appelée **après le rattrapage des assets** (`Atelier.ouvrir`) : une
        feuille reçue juste avant la coupure n'a peut-être son asset que depuis
        ce rattrapage-là.
        """
        reprises = 0
        for generation in generations:
            if not generation.demande.get("decouper_a_l_arrivee"):
                continue
            for emplacement in generation.emplacements:
                marque = emplacement.decoupe
                if marque is not None and marque.get("en_cours"):
                    emplacement.decoupe = {
                        "raison": "la découpe a été interrompue par l'arrêt de "
                        "l'atelier — vérifiez les morceaux, ou découpez à la main",
                    }
                    self._sauver(generation)
                    reprises += 1
                elif self.couper_a_l_arrivee(generation, emplacement):
                    reprises += 1
        return reprises

    def a_couper(self, generation: Generation, emplacement: Emplacement) -> bool:
        """Cet emplacement attend-il encore sa découpe à l'arrivée ?

        La feuille d'une planche refaite, réussie, qui l'a demandée et **qui ne
        porte encore aucune marque** — la marque est ce qui rend le geste
        idempotent, au redémarrage comme à une seconde arrivée."""
        return (
            bool(generation.demande.get("decouper_a_l_arrivee"))
            and emplacement.decoupe is None
            and emplacement.statut == Statut.REUSSIE
            and emplacement.resultat is not None
            and generation.pliage is None
            and generation.clip is None
            and est_une_planche_refaite(generation, emplacement.rang)
        )

    def etat_a_l_arrivee(self, asset: Asset) -> dict[str, Any] | None:
        """Ce que la découpe à l'arrivée a fait de cette feuille, ou rien — ce
        que la fiche de la planche montrera (RS9)."""
        generation = self._base.lire(asset.generation)
        if generation is None:
            return None
        for emplacement in generation.emplacements:
            if emplacement.rang == asset.rang and emplacement.decoupe is not None:
                return dict(emplacement.decoupe)
        return None

    def _vues(self, generation: Generation, rang: int) -> "_Vues":
        """Où couper, et combien de vues on attendait — **sans rien écrire**.

        La détection est celle du mode « zones opaques » de `proposer` : même
        détourage (celui de la recette, sinon le moteur du geste courant), même
        taille minimale. La même image donne donc les mêmes rectangles à
        l'arrivée et sous les yeux de l'auteur, quand il rouvre la découpe.
        """
        planche = self._assets.lire(identifiant_de(generation.identifiant, rang))
        if planche is None:
            return _Vues(raison="la planche n'est pas entrée en bibliothèque — rien à couper")
        attendu, refus = self._vues_attendues(generation)
        if refus is not None:
            return _Vues(raison=refus, attendu=attendu)
        boites = ordre_des_vues(self._zones(planche))
        trouvees = len(boites)
        if attendu is not None and trouvees != attendu:
            return _Vues(
                raison=(
                    f"{_zones_en_mots(trouvees)} sur la planche, {attendu} attendues "
                    "d'après la référence planche — rien n'est coupé, découpez à la main"
                ),
                attendu=attendu,
                trouvees=trouvees,
            )
        if attendu is None and trouvees < 2:
            # **Sans compte à tenir, deux vues au moins** : une seule zone est
            # le plus souvent une feuille dont les vues se touchent, et la
            # « couper » rendrait la feuille entière sous un autre nom.
            return _Vues(
                raison=(
                    f"{_zones_en_mots(trouvees)} sur la planche — rien n'est coupé, "
                    "découpez à la main"
                ),
                trouvees=trouvees,
            )
        if trouvees > DECOUPES_MAX:
            return _Vues(
                raison=(
                    f"{trouvees} zones sur la planche, au-delà des {DECOUPES_MAX} "
                    "qu'une découpe rend — rien n'est coupé"
                ),
                attendu=attendu,
                trouvees=trouvees,
            )
        return _Vues(boites=boites, attendu=attendu, trouvees=trouvees)

    def _vues_attendues(self, generation: Generation) -> tuple[int | None, str | None]:
        """Le nombre de vues de **la référence planche partie avec l'appel** —
        ou rien, s'il n'en est parti aucune.

        Lue sur `generation.references`, pas sur la fiche du sujet : c'est la
        planche que le modèle a eue sous les yeux, et elle ne change pas si
        l'auteur en range une autre depuis. Une mise en page venue d'une image
        jointe à la main n'est pas une planche rangée : aucun contrôle, comme le
        dit la décision 7.

        **Une référence qu'on ne sait plus compter est un refus**, pas un
        « aucun contrôle » : l'appel en avait une, on promettait de s'y tenir.
        """
        planches = [
            r
            for r in generation.references
            if r.role == REFERENCE and r.origine == ASSET and r.usage == USAGE_PLANCHE
        ]
        if not planches:
            return None, None
        reference = self._assets.lire(planches[0].asset)
        if reference is None:
            return None, (
                "la référence planche de l'appel n'existe plus, le nombre de vues "
                "ne se vérifie pas — rien n'est coupé, découpez à la main"
            )
        zones = len(self._zones(reference))
        if zones == 0:
            return None, (
                "la référence planche n'a aucune zone opaque une fois détourée, le "
                "nombre de vues ne se vérifie pas — rien n'est coupé, découpez à la main"
            )
        return zones, None

    def _zones(self, asset: Asset) -> list[Boite]:
        """Les zones opaques d'une image — le mode « auto » de `proposer`."""
        passes = asset.recette.passes_vives() or (Passe(),)
        alpha = self._assets.detourage(asset, passes)[:, :, 3]
        return zones_opaques(alpha, cote_min=COTE_MIN)

    def _poser(
        self, generation: Generation, emplacement: Emplacement, vues: "_Vues"
    ) -> None:
        """Écrit la marque, et les morceaux quand il y en a.

        **La marque « en cours » part avant le premier morceau** : une coupure
        au milieu laisse une feuille marquée, que le démarrage ne recoupera
        pas. Mieux vaut trois morceaux et une phrase que sept.
        """
        if vues.boites is None:
            marque: dict[str, Any] = {"raison": vues.raison, "attendu": vues.attendu}
            if vues.trouvees is not None:
                marque["trouvees"] = vues.trouvees
            emplacement.decoupe = marque
            self._sauver(generation)
            return
        planche = self._assets.lire(identifiant_de(generation.identifiant, emplacement.rang))
        if planche is None:  # pragma: no cover — lue un instant plus tôt
            emplacement.decoupe = {"raison": "la planche a disparu avant la découpe"}
            self._sauver(generation)
            return
        emplacement.decoupe = {"en_cours": True}
        self._sauver(generation)
        try:
            nees = self._couper(planche, vues.boites, personnage=generation.personnage)
        except Exception as erreur:  # noqa: BLE001 — la planche payée ne perd rien
            emplacement.decoupe = {
                "raison": f"la découpe s'est arrêtée ({erreur}) — vérifiez les "
                "morceaux, ou découpez à la main",
                "attendu": vues.attendu,
            }
            self._sauver(generation)
            return
        # **Dans l'ordre des vues**, et c'est l'accroche de RS8 : la n-ième
        # image de cette liste prendra la n-ième direction de la référence.
        emplacement.decoupe = {
            "morceaux": [a.identifiant for a in nees],
            "attendu": vues.attendu,
        }
        self._sauver(generation)

    def _sauver(self, generation: Generation) -> None:
        """Le disque, l'index, puis l'annonce — les trois lignes de
        `ServiceGenerations._sauver`, et pour la raison de `ServicePliage` :
        la génération tient ce service, lui demander de sauver ferait un
        cercle."""
        contenu = generation.en_json()
        self._fichiers.ecrire_enregistrement(generation.identifiant, contenu)
        self._base.enregistrer(generation)
        self._diffusion.publier("generation", contenu)

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _exiger(self, identifiant: str) -> Asset:
        asset = self._assets.lire(identifiant)
        if asset is None:
            raise AssetInconnu(identifiant)
        return asset

    def _recette_des_morceaux(self, planche: Asset) -> tuple[Recette, bool]:
        """La recette des morceaux, et leur épingle.

        **D'ordinaire, celles de la planche** — `_recette_heritee`.

        **Sauf la feuille d'une planche refaite** (RS2, 18 septembre 2026).
        Elle naît sans grille ni recadrage ni quantification, parce que sa
        feuille entière ne doit pas se pixelliser d'un seul tenant
        (`recette_de_planche_refaite`). Ses morceaux hériteraient de ce manque
        et ne seraient jamais mis sur la grille du jeu — or ce sont eux, les
        sprites. Ils reçoivent donc ce que le projet impose à **un morceau de
        planche**, grille comprise : la même recette qu'un morceau de lot plié
        au dépliage (`ServicePliage`).

        **Et sans épingle** : ce qui s'épinglait sur la feuille protégeait un
        réglage de feuille, qui ne leur est pas transmis. La recette qu'ils
        reçoivent est celle du projet, que les balayages ont le droit de suivre.

        La génération se relit ici plutôt que de voyager sur l'asset : le
        drapeau n'est écrit que sur elle, et c'est elle qui fait foi.

        **Et si le sujet de l'appel a sa recette, c'est elle qu'ils reçoivent**
        (RS6, 18 septembre 2026) — « champy 01 » plutôt que la recette du jeu,
        ce que l'auteur posait à la main sur chaque morceau.

        Une planche ordinaire, elle, continue de transmettre la sienne : née
        pour ce sujet, elle porte déjà sa recette, et si l'auteur l'a retouchée
        à la main, c'est ce réglage-là qu'il veut voir sur ses morceaux.
        """
        generation = self._base.lire(planche.generation)
        if generation is not None and est_une_planche_refaite(
            generation, planche.rang
        ):
            return self._assets.recette_d_un_morceau_refait(generation), False
        return _recette_heritee(planche), planche.epingle

    def _verifier(self, planche: Asset, boites: Iterable[Boite]) -> list[Boite]:
        """Les rectangles de cette planche-là, vérifiés."""
        return verifier_boites(
            boites, planche.largeur, planche.hauteur, quoi="planche"
        )

    def _premier_rang_libre(self, generation: str) -> int:
        """Le rang de la prochaine découpe.

        Pris au-dessus de **tout** ce que la génération connaît déjà, ses
        emplacements comme ses découpes précédentes : deux assets d'un même rang
        partageraient leurs fichiers `<rang>-brut` et `<rang>-asset.json`, et le
        second effacerait le premier sans rien dire.

        **Et au-dessus des rangs qu'un dépliage de la planche a réservés** (P1)
        — la règle des rangs de `Depliage` : un rang pris ne se rend jamais,
        même quand les images de ce dépliage ont été purgées.
        """
        return rang_libre(self._base, generation, plancher=RANG_DECOUPE)


@dataclass(frozen=True, slots=True)
class _Vues:
    """Ce que la détection à l'arrivée a trouvé : des boîtes dans l'ordre des
    vues, ou une raison de ne rien couper — jamais les deux."""

    boites: list[Boite] | None = None
    raison: str | None = None
    attendu: int | None = None
    trouvees: int | None = None


def _zones_en_mots(nombre: int) -> str:
    """« aucune zone », « 1 zone », « 3 zones » — la phrase se lit à voix haute."""
    if nombre == 0:
        return "aucune zone"
    return f"{nombre} zone" if nombre == 1 else f"{nombre} zones"


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

    **Les coordonnées explicites ne s'héritent pas** — la boîte tracée et la
    ligne de pied (B18) : l'une désignait un rectangle de la planche, l'autre
    un rang de ses pixels, et posées sur une découpe elles désigneraient un
    endroit qui n'a plus rien à voir, le plus souvent hors de l'image. Le
    reste — marge, taille imposée, format verrouillé, calage sur un multiple,
    centrage sur la masse, rognage d'un bord uni — sont des réglages, pas des
    coordonnées, et ils restent.
    """
    recette = planche.recette
    if recette.recadrage is None or (
        recette.recadrage.boite is None and recette.recadrage.ligne_pied is None
    ):
        return recette
    return replace(
        recette, recadrage=replace(recette.recadrage, boite=None, ligne_pied=None)
    )
