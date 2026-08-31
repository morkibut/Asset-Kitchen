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
from dataclasses import replace
from typing import Any

import numpy as np

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import Emplacement, Generation
from atelier.domaine.recette import (
    ANCRAGES,
    EPAISSEUR_MAX,
    MOTEURS,
    POSITIONS,
    RAYON_MAX,
    TRAMAGES,
    TROUS,
    Grille,
    Difference,
    Main,
    Passe,
    Recette,
)
from atelier.image import (
    Rendu,
    crans_occupation,
    detourer,
    finir,
    poches,
    raison_moteur,
    rendre_en_png,
    taches,
)
from atelier.image.traitement import (
    composantes,
    peindre,
    pinceau,
    pose_du_calque,
    queue,
    sans_les_deux_dernieres,
)
from atelier.image.calque import avec_alpha, differencier
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

    def raison_quantification(self, projet: str | None) -> str | None:
        """Pourquoi la quantification est grisée — ou `None` quand elle ne l'est plus.

        Elle s'allume au premier artwork officiel promu (US-65, achevée en T4).
        """
        if self.palette_du_projet(projet):
            return None
        return "aucune palette : elle se déduira des artworks du projet"

    def traitement(self, projet: str | None = None) -> dict[str, Any]:
        """Ce que l'écran a besoin de savoir pour griser sans redemander."""
        return {
            "moteurs": [
                {"nom": moteur, "raison": raison_moteur(moteur)} for moteur in MOTEURS
            ],
            "quantification": {"raison": self.raison_quantification(projet)},
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
            return {"impose": None, "echelle": ""}
        return {
            "impose": self.recette_du_projet(generation).en_json(),
            # **Ce que l'auteur avait dit fabriquer**, parce que c'est elle qui
            # décide de l'occupation : « imposé 40 % » ne s'explique que si la
            # fiche peut ajouter « objet tenu ».
            "echelle": str(generation.demande.get("echelle", "") or ""),
        }

    def taches_de(self, identifiant: str, plafond: int = 200) -> dict[str, Any]:
        """Ce qu'une table a besoin de savoir de l'image (E3, étendu en E5).

        **Quatre mesures, et aucune n'est un réglage** : les taches que le
        nettoyage des bords va effacer, les poches de fond que le sujet enferme,
        les crans d'occupation où la remise sur grille change vraiment quelque
        chose, et ce que chaque couche de la main touche. Toutes répondent à la
        même question posée quatre fois — *qu'est-ce que ce curseur va faire,
        avant que je le bouge ?*

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
            "poches": [p.en_json() for p in poches(rgba)],
            "crans_occupation": crans_occupation(
                rgba, asset.recette.grille or Grille()
            ),
            # **Une image entièrement opaque n'a pas de bord de sujet** — le
            # seul cas où le contour est indisponible, et l'écran a besoin de
            # le savoir pour griser la table avec sa raison. Ce n'est pas une
            # mesure de plus : c'est la même image, regardée d'une ligne.
            "opaque": bool(rgba[:, :, 3].all()),
            "main": self._pixels_de_la_main(asset),
        }

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

    def recette_du_projet(self, generation: Generation) -> Recette:
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
        """
        if generation.demande.get("traiter") is False:
            return Recette()
        if generation.projet is None:
            return Recette()
        objet = self._base.lire_projet(generation.projet)
        if objet is None:
            return Recette()
        nom = str(generation.demande.get("echelle", "") or "")
        return objet.univers.recette_de(objet.univers.echelle(nom))

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
            # projet, et se range tout seul » (`docs/PLAN.md`, T4).
            recette=ancien.recette if ancien else self.recette_du_projet(generation),
            epingle=ancien.epingle if ancien else False,
            # Ce que l'appel a facturé pour cette image-là. La tuile le porte ;
            # le total du projet, lui, se calcule sur les générations, qui sont
            # les seules à connaître les appels ratés.
            cout_usd=emplacement.cout_usd,
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
            # **La planche d'un lot plié n'est pas un asset, et ne le devient
            # pas ici non plus.** Ce qui entre en bibliothèque, ce sont les N
            # images séparées ; leur ranger la feuille à côté la rendrait
            # exportable, et « aucune feuille assemblée n'est livrable »
            # (`docs/PLAN.md`, C2) cesserait d'être vrai par construction. Le
            # dépliage manquant, lui, se rattrape ailleurs — `ServicePliage`
            # sait le faire sans rien repayer.
            if generation.pliage is not None:
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

    def poser_les_places(self, identifiant: str, recette: Recette) -> Asset:
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
        """
        asset = self._trouver(identifiant)
        return self.poser_recette(
            identifiant, replace(recette, difference=asset.recette.difference)
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
        # **Sans sa différence** : elle nomme le corps d'une case précise, et
        # une recette nommée est faite pour être reposée ailleurs. La garder
        # aurait fabriqué un calque de l'image d'à côté au premier rappel.
        #
        # **Et sans son décalage** (E17), pour la même raison exactement : c'est
        # une coordonnée, pas un réglage. Il rattrape la dérive de *cette*
        # silhouette-là dans sa case ; le reposer sur une autre image la
        # décalerait sans qu'aucune mesure ne l'ait demandé.
        propre_recette = replace(recette.sans_nom(), difference=None)
        if propre_recette.grille is not None:
            propre_recette = replace(
                propre_recette, grille=replace(propre_recette.grille, decalage=0)
            )
        enregistrees[propre] = propre_recette.en_json()
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
        # **Par les places, jamais par la recette entière** : une différence
        # nomme *une autre image précise*, donc elle ne se transporte pas —
        # `nommer` ne l'enregistre plus, et ceci protège les recettes déjà
        # écrites sur le disque avant que ce soit vrai.
        return self.poser_les_places(identifiant, replace(enregistrees[nom], nom=nom))

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
        return finir(self._tableau_avec(asset, recette), recette)

    def _tableau_avec(self, asset: Asset, recette: Recette) -> np.ndarray:
        """Le rendu, en tableau — l'étape d'avant le PNG.

        Ce que les mesures d'une table veulent : elles décrivent des pixels, et
        les rouvrir depuis des octets paierait un encodage pour rien.
        """
        return queue(
            self._differencier(asset, self.detourage(asset), recette.difference),
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
        """
        recette = Recette(passes=asset.recette.passes if passes is None else passes)
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
            raison = self.raison_quantification(projet)
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
    """Le début du prompt. Un nom se change ; il ne se demande pas à l'avance."""
    prompt = str(generation.demande.get("prompt", "")).strip()
    return prompt[:60] if prompt else "sans titre"
