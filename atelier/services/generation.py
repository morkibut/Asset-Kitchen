# -*- coding: utf-8 -*-
"""Générer — soumettre, suivre, retrouver.

**La génération vit côté serveur dès cette tranche** (`docs/archive/plan-versions-tenues.md`, T1) :
fermer l'onglet ne l'arrête pas, rouvrir la retrouve. On soumet, on reçoit un
identifiant, on regarde avancer. Rien ici ne suppose qu'un navigateur écoute.

Quatre règles portées par ce service, et instaurées ici une fois pour toutes :

- **Deux soumissions du même identifiant ne facturent qu'une fois.** La seconde
  rend la première telle quelle, sans appeler le fournisseur.
- **Une variation est un appel.** Les emplacements sont indépendants : les
  réussites arrivent même quand les voisines échouent.
- **Le coût enregistré est celui que l'appel facture** — `usage.cost`, jamais le
  tarif du catalogue.
- **Rien n'est jamais relancé automatiquement** (US-18). Une génération coupée
  par un redémarrage est marquée interrompue, garde son coût, et attend.

**Ce service ne sait pas qu'un navigateur existe, et il l'annonce quand même.**
Chaque enregistrement publie sur la diffusion : c'est ce qui remplace le sondage
d'une seconde. Un onglet fermé ne coûte rien, un onglet ouvert apprend au moment
où ça se produit, et le service, lui, ne change pas d'un iota selon qu'on écoute
ou non.
"""

from __future__ import annotations

import asyncio
import io
import time
import uuid
from dataclasses import replace
from typing import Any, Sequence

from PIL import Image, ImageColor

from atelier.depot import Base, Fichiers, projet_lu_une_fois
from atelier.domaine import (
    USD,
    Demande,
    Emplacement,
    Generation,
    Modele,
    Reinjection,
    Resultat,
    Statut,
)
from atelier.domaine.erreurs import (
    DemandeRefusee,
    ErreurAtelier,
    GenerationInconnue,
    SansCle,
)
from atelier.domaine.generation import (
    ASSET,
    AUTEUR,
    CARTE,
    EDITION,
    GABARIT,
    PALETTE,
    PLANCHE_JOINTE,
    REFERENCE,
    REFERENCE_DIRECTION,
    REFERENCE_MISE_EN_PAGE,
    REFERENCE_PLANCHE,
    STYLE,
)
from atelier.domaine.vue import (
    calage_de_planche,
    camera_sous_la_planche,
    consigne_de_mise_en_page,
)
from atelier.domaine.personnage import LIBRE
from atelier.domaine.personnage import PLANCHE as USAGE_PLANCHE
from atelier.domaine.personnage import direction_de_lusage
from atelier.domaine.direction import composer
from atelier.domaine.fond import fond_valide
from atelier.domaine.ambiance import COULEURS, REFERENCES, TEXTES, prises_du_mode
from atelier.domaine.envoi import (
    AMBIANCE,
    CADRAGE,
    DE_LA_PLANCHE,
    DE_LA_POSE,
    DE_LA_VUE,
    DE_SA_FICHE,
    DEMANDE,
    DU_PRODUIT,
    DES_IMAGES,
    DU_JEU,
    ECRIT_ICI,
    JEU,
    JOINTES,
    PLANCHE,
    REPRIS,
    SUJET,
    Tri,
    clef,
    joindre,
    parties,
    resoudre,
)
from atelier.domaine.pliage import CasePliee, Pliage
from atelier.domaine import texte_local
from atelier.domaine.workflow import GRAINE_MAX, WorkflowRefuse
from atelier.fournisseur import PortFournisseur
from atelier.image import bande_de_palette, empreinte_de, mesurer
from atelier.image.mesures import extension
from atelier.domaine.asset import Asset
from atelier.services.assets import AssetInconnu, ServiceAssets
from atelier.services.catalogue import ServiceCatalogue
from atelier.services.fournisseurs import Fournisseurs
from atelier.services.evenements import Diffusion
from atelier.services.equipement import ServiceEquipement
from atelier.services.pliage import (
    ChoixAttendu,
    CompteFaux,
    ServicePliage,
    accorde,
    consignes,
    reference,
)
from atelier.services.prix import mesures as mesures_de_prix
from atelier.services.prix import prix_de as prix_de_lappel


# **L'attente d'un modèle jamais encore appelé.** Mesuré le 27 août 2026 sur
# deux variations réelles en parallèle : 11,7 s et 18,8 s. 20 s est donc une
# première hypothèse prudente — et elle ne sert qu'une fois : dès la première
# image de ce modèle, c'est la médiane de ses durées réelles qui prend le
# relais. Ce n'est pas une table de modèles écrite en dur : c'est la valeur
# d'amorçage d'une mesure qui se recale seule.
ATTENTE_INCONNUE_S = 20.0

# Sur combien d'appels réussis la médiane se calcule. Court exprès : un modèle
# qui ralentit doit se voir en quelques images, pas en cinquante.
FENETRE_MESURES = 8


# Le « modèle » d'une image qui n'a appelé personne. Un mot du produit, pas un
# identifiant de fournisseur : le catalogue ne le déclare pas et ne le déclarera
# jamais, et c'est exactement ce qu'il dit — cette image n'a rien coûté et ne se
# relance pas.
IMPORT = "import"

# **Et celui d'une image tirée d'un clip** (A13). Même nature qu'un import — elle
# n'a appelé personne, elle ne se relance pas —, et pourtant un mot à elle : une
# image prélevée **vient de quelque part qui a été payé**, et sa filiation le
# dit. Les confondre aurait fait lire *importée* sur une image dont le produit
# sait exactement de quel clip et de quelle image elle sort.
PRELEVEMENT = "clip"

# **Les deux genres de référence d'un style local** (ML3), tels que le catalogue
# des styles les écrit. `DEPART` repeint par-dessus **une** image ; `SUJET`
# garde le sujet des images reçues (Klein, `ReferenceLatent`).
DEPART = "depart"
SUJET_A_GARDER = "sujet"

# **La graine d'un style local, fournie par l'appelant** (relecture ML, défaut
# 6). Une clé réservée des options, comme pour le clip de la maison : c'est le
# seul endroit de la demande qui voyage jusqu'au fournisseur.
GRAINE = "graine"


def role_de_planche(*, cases: int, piece: bool) -> str | None:
    """Laquelle des deux images une planche joint — ou aucune.

    **Le seul endroit du dépôt qui en décide** (M4). Les deux sortes ne
    demandent pas la même chose au modèle : un `GABARIT` est une grille *vide*
    où il fera naître N sujets, une `PLANCHE_JOINTE` est la planche *pleine*
    qu'on lui redonne pour qu'il y ajoute une pièce. Les confondre revient à
    dire *« dessine un sujet par case »* devant une planche déjà dessinée.

    **Elle existait deux fois, et les deux copies avaient divergé.** Le texte
    qui part demandait à modifier la planche existante ; l'écran, à quelques
    centimètres de là et au même instant, annonçait un gabarit à remplir — parce
    que le compte des images ne rendait qu'un **nombre**, sans le rôle, et que
    l'écran n'avait alors que les mots du plus ancien des deux cas. Le gabarit
    vient de `C2`, la planche d'équipement de `C3`, qui a réemployé la même
    place sans rouvrir la phrase.

    **Une pièce dès une case, une grille à partir de deux.** Habiller consiste à
    renvoyer la même planche avec la pièce en plus, et le calque se fabrique par
    différence entre les deux : sans planche, il n'y a rien à comparer. Plier
    une pose seule, en revanche, ferait payer un gabarit pour une image que le
    produit sait déjà demander.
    """
    if piece:
        return PLANCHE_JOINTE if cases >= 1 else None
    return GABARIT if cases >= 2 else None


def _sans_graine(modele: Modele, demande: Demande) -> Demande:
    """La demande telle que le catalogue la juge : **la graine d'un workflow
    local n'est pas une option du modèle**, elle ne se refuse ni ne s'écarte
    comme telle. Elle reste dans `demande.options`, par où elle voyage jusqu'au
    fournisseur. Un modèle distant n'est pas touché."""
    if not modele.locale or GRAINE not in demande.options:
        return demande
    return replace(
        demande, options={k: v for k, v in demande.options.items() if k != GRAINE}
    )


def _mediane(durees: Sequence[float]) -> float:
    """La médiane arrondie au centième — celle de `attente_estimee`."""
    triees = sorted(durees)
    milieu = len(triees) // 2
    if len(triees) % 2:
        return round(triees[milieu], 2)
    return round((triees[milieu - 1] + triees[milieu]) / 2, 2)


class ImportRefuse(ErreurAtelier):
    """Ce qu'on a fait entrer n'est pas une image, et on dit lequel.

    **Sa propre classe, comme `CarteRefusee`**, et pour la même raison : un
    dépôt de douze fichiers doit distinguer « celui-là n'est pas une image » de
    « l'atelier ne répond pas ». Le premier se range à côté de son fichier et
    n'empêche rien ; le second est une panne, et il va à la barre d'état.
    """

    code = "import_refuse"


class ServiceGenerations:
    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        catalogue: ServiceCatalogue,
        fournisseurs: Fournisseurs,
        diffusion: Diffusion | None = None,
        assets: ServiceAssets | None = None,
        bibliotheque: "ServiceBibliotheque | None" = None,
        univers: "ServiceUnivers | None" = None,
        production: "ServiceProduction | None" = None,
        pliage: "ServicePliage | None" = None,
        equipement: "ServiceEquipement | None" = None,
        # **Les profils de workflow, pour une seule question** (ML4) : ce modèle
        # est-il un style local, et lit-il un texte négatif ?
        profils: Any = None,
    ) -> None:
        self._base = base
        self._profils = profils
        self._fichiers = fichiers
        self._catalogue = catalogue
        # **Ils sont plusieurs depuis F1**, et ce service ne choisit jamais : il
        # demande *le fournisseur de ce modèle-là*. C'est ce qui interdit
        # structurellement le repli automatique d'un fournisseur sur un autre —
        # il n'y a nulle part de « et sinon, l'autre ».
        self._fournisseurs = fournisseurs
        self._diffusion = diffusion or Diffusion()
        # **L'asset naît ici, à l'arrivée de l'image** — pas au premier geste de
        # retouche (`docs/PLAN.md`, calendrier des entités : l'asset apparaît en
        # T2). Ce service ne sait rien de ce qu'est une recette ; il sait
        # seulement qu'une image qui arrive a désormais un destinataire.
        self._assets = assets
        # **Ce qui sort entre dans le projet ouvert** (US-2, US-25). Le défaut
        # est posé ici et non dans la route : le MCP de T7 appelle ce service
        # directement, et un agent qui ne nomme aucun projet doit atterrir au
        # même endroit que l'auteur (US-87). Un défaut écrit dans la façade
        # serait un défaut qu'une des deux façades oublierait.
        self._bibliotheque = bibliotheque
        # **L'univers habille ce qui part** (US-51, US-53). C'est ici, et pas
        # dans la route, pour la même raison que le projet par défaut : le MCP
        # de T7 appelle ce service directement, et un agent doit voir partir les
        # mêmes artworks que l'auteur. Une sélection écrite dans la façade
        # serait une sélection qu'une des deux façades oublierait.
        self._univers = univers
        # **La production, pour une seule question** : cette case existe-t-elle
        # encore ? La règle lui appartient — un service qui la rejouerait ici en
        # ferait une seconde vérité, et c'est la panne que tout ce dépôt évite.
        self._production = production
        # **Le pliage, pour deux gestes et pas un de plus** : composer ce qui
        # part quand un lot est demandé, et ranger ce qui revient. Il ne connaît
        # ni personnage ni pose — c'est ce service-ci qui compose ses cases,
        # parce que c'est lui qui sait déjà relier un appel à une case (C1).
        self._pliage = pliage
        # **L'équipement, pour trois gestes et pas un de plus** : composer
        # les cases d'une planche qui habille, dessiner cette planche, et
        # ranger les calques qui en reviennent. Ce service-là ne sait pas
        # plier — c'est le pliage de C2 qui plie, des deux côtés.
        self._equipement = equipement
        self._en_vol: set[asyncio.Task[None]] = set()

    # ── Au démarrage ─────────────────────────────────────────────────────────

    def reprendre(self) -> list[Generation]:
        """Marque interrompu ce que l'arrêt du serveur a coupé. Ne relance rien.

        « Le serveur est arrêté pendant une génération : au redémarrage elle est
        marquée interrompue, son coût réel est lisible, et aucune relance n'a eu
        lieu » — critère d'acceptation de T1.
        """
        coupees = []
        for generation in self._base.en_vol():
            for emplacement in generation.emplacements:
                if emplacement.statut.terminee:
                    continue
                emplacement.statut = Statut.INTERROMPUE
                emplacement.raison = "le serveur a redémarré pendant la génération"
                emplacement.demarre_le = None
            self._sauver(generation)
            coupees.append(generation)
        return coupees

    # ── Lecture ──────────────────────────────────────────────────────────────

    def lire(self, identifiant: str) -> Generation | None:
        return self._base.lire(identifiant)

    def recentes(self, limite: int = 50) -> list[Generation]:
        return self._base.recentes(limite)

    def chantier(
        self,
        limite: int = 200,
        *,
        projet: str | None = None,
        sans_projet: bool = False,
    ) -> list[Generation]:
        """Les générations dont **un emplacement attend encore une issue**.

        **Scopée à un jeu, comme `grille_courante`** (B4) : `projet` ne montre
        que les siennes, `sans_projet` que celles qui n'en ont aucun. Les
        deux à leur défaut ne filtrent rien — c'est encore l'ancien
        comportement, celui qu'un appelant qui ne les pose pas continue de
        recevoir. Sans ce filtre, changer de jeu laissait le chantier du
        précédent à l'écran : sa tuile ne partait qu'à la prochaine
        génération de ce jeu-là, jamais au changement lui-même.

        C'est ce qui tient sa place dans la grille à côté de la bibliothèque :
        ce qui part, ce qui tourne, et ce qu'un redémarrage a coupé — celui-là
        garde son coût et attend un geste, jamais une relance automatique
        (US-17, US-18).

        Un emplacement **échoué**, lui, n'attend rien : sa réponse est arrivée,
        c'était non. Il reste visible dans l'onglet qui l'a vu échouer — c'est
        là qu'on décide de relancer — mais il ne s'installe pas : la
        bibliothèque relue ne le contient pas (US-23), et l'appel, avec son
        coût réel, reste au journal du projet (US-24).

        **Une planche qui attend un choix en fait partie** (R6), et pourtant son
        emplacement est réussi : elle est arrivée entière, elle est payée, et
        rien n'est entré en bibliothèque. Elle attend donc bien une issue —
        celle que l'auteur va décider. Sans cette ligne, sa tuile quitterait la
        grille à l'arrivée et aucun asset ne prendrait sa place : l'appel payé
        s'évanouirait sous les yeux de l'auteur, ce qui est très exactement le
        gâchis silencieux que la tranche répare.

        Le tri se fait ici et non en SQL parce que le statut d'une génération
        est celui de **l'ensemble** de ses emplacements : un lot où une image
        est arrivée est « réussi » même si sa voisine a été coupée.
        """
        en_suspens = (Statut.EN_ATTENTE, Statut.EN_COURS, Statut.INTERROMPUE)

        def _du_projet(generation: Generation) -> bool:
            if sans_projet:
                return generation.projet is None
            if projet is not None:
                return generation.projet == projet
            return True

        return [
            generation
            for generation in self._base.recentes(limite)
            if _du_projet(generation)
            and (
                any(e.statut in en_suspens for e in generation.emplacements)
                or (generation.pliage is not None and generation.pliage.attend_un_choix)
                # ⚠️ **Un clip arrivé garde sa place, comme la planche d'au-dessus
                # et pour la même raison** (A9, V3) — vu au navigateur le
                # 4 septembre 2026 : la galerie était vide au rechargement, alors
                # que trois clips payés étaient sur le disque.
                #
                # Un clip est réussi dès qu'il arrive, donc il sortait d'ici ; et
                # **rien ne prenait le relais**, parce qu'un clip n'entre pas en
                # bibliothèque — ce n'est pas une image. Sa tuile disparaissait à
                # l'arrivée. C'est le gâchis silencieux que `R6` a réparé pour la
                # planche, à l'identique.
                #
                # **Jeté, il s'en va**, et c'est tout le sens du geste : il quitte
                # la galerie et reste au journal, où l'argent, lui, ne s'efface
                # jamais.
                or (generation.clip is not None and not generation.clip.jete)
            )
        ]

    def total_couts(self, projet: str | None = None) -> float:
        return self._base.total_par_projet(projet)

    def attente_estimee(self, identifiant_modele: str) -> float:
        """Combien de temps ce modèle met, d'après ses derniers appels réussis.

        C'est le seul chiffre qui rende la jauge **déterminée** possible : le
        fournisseur ne dit rien entre le départ et l'arrivée, il n'y a donc
        aucun avancement à relayer. La médiane, et pas la moyenne — un appel qui
        a mis quatre-vingts secondes parce que le fournisseur toussait ne doit
        pas déplacer l'attente des dix suivants.

        Sans mesure, la valeur d'amorçage. Après une seule image, plus jamais.
        """
        # Les plus récentes d'abord, puis triées : couper après le tri prendrait
        # les huit plus courtes de l'histoire au lieu des huit dernières.
        recentes = self._base.durees_mesurees(identifiant_modele)[:FENETRE_MESURES]
        durees = sorted(recentes)
        if not durees:
            return ATTENTE_INCONNUE_S
        milieu = len(durees) // 2
        if len(durees) % 2:
            return round(durees[milieu], 2)
        return round((durees[milieu - 1] + durees[milieu]) / 2, 2)

    def cout_attendu(
        self, identifiant_modele: str, images: int | None = None
    ) -> float | None:
        """Ce que cet appel-là coûterait chez ce modèle, **images comprises**.

        « Voir avant de lancer ce qui va partir et **ce que ça va coûter** »
        (US-121). Le chiffre est une **mesure**, pas un tarif : le produit ne
        porte aucun prix de catalogue, et le coût réel facturé fait foi partout
        ailleurs — l'annoncer autrement ici en ferait le seul endroit du produit
        où l'argent est supposé.

        `None` quand ce modèle n'a jamais rien facturé sur cette machine. Le
        produit dit alors qu'il ne sait pas, ce qui est vrai et utile : c'est le
        premier appel qui l'apprend. Même geste que l'attente de la jauge.

        **`images` est arrivé en E14, et il répare le piège de E13 une seconde
        fois.** Le prix rendu ici est celui que la barre qui paie affiche ; celui
        de l'écran de confirmation, un clic plus loin, tient compte du nombre
        d'images jointes. Sans ce paramètre, la barre annonçait la médiane de
        *tous* les appels, images ou non, et les deux écrans disaient **$0,0160
        et $0,0064 pour le même appel** — mesuré au navigateur sur le vrai projet
        le 31 août 2026, à un clic d'écart au lieu de trois centimètres. Les deux
        chiffres étaient justes, et c'est précisément ce qui rendait la
        contradiction impossible à voir depuis les essais.

        Sans `images`, la médiane de tout, comme avant : c'est ce que rend un
        appelant qui ne sait pas encore ce qui partira.
        """
        mesure = self.appels_mesures(identifiant_modele)
        if images is None:
            return mesure["prix"]
        return prix_de_lappel(mesure, images)

    def appels_mesures(self, identifiant_modele: str) -> dict[str, Any]:
        """Ce que ce modèle a coûté ici — **la médiane, l'écart, et le compte**.

        `cout_attendu` en tire le chiffre d'un appel, et c'est tout ce dont la
        barre qui paie a besoin. La planche, elle, affiche *le nombre d'appels
        sur lequel le prix repose* à côté du prix (E13) : un gain annoncé sur une
        mesure unique est un gain **encadré**, pas un gain affirmé.

        **Une seule lecture pour tout le monde**, parce que deux médianes
        calculées à deux endroits auraient fini par annoncer deux prix pour le
        même appel — et c'est exactement ce que l'écran de la planche a montré la
        première fois qu'on l'a ouvert. E14 a déménagé le calcul dans
        `atelier/services/prix.py`, où l'écran de confirmation le trouve aussi,
        et lui a ajouté la décomposition : un prix de base, et le pas de chaque
        image jointe.

        **L'unité vient du fournisseur, jamais de l'historique seul** (F2). Un
        modèle gratuit qu'on n'a encore jamais appelé n'a rien laissé dans
        l'index ; annoncer sa consommation en dollars serait annoncer un prix
        pour quelque chose qui n'en a pas — le défaut exact que la tranche
        ferme.
        """
        return mesures_de_prix(
            self._base, identifiant_modele, self._catalogue.unite_de(identifiant_modele)
        )

    def temps_attendu(self, modele: str) -> dict[str, Any] | None:
        """Ce qu'un style local annonce, **un temps plutôt qu'un prix** (règle
        8ter) : la médiane mesurée sur cette machine, ou, faute de mesure, la
        vitesse déclarée par le style sc-clone. `None` pour un modèle qui n'est
        pas local — celui-là a un prix, et c'est `cout_attendu` qui le dit.

        **Pourquoi pas `cout_attendu`, qui existe déjà.** Il lit
        `couts_mesures`, qui ne garde que les montants non nuls — et un appel
        local enregistre toujours `cout_usd = 0.0` (`annonce_locale`) : le
        filtre `if quantite` de `couts_mesures` l'écarte donc systématiquement,
        et l'écran annonçait « jamais généré » même après des dizaines de
        tirages. `durees_mesurees` n'a pas ce défaut : elle garde tout appel
        réussi, quelle que soit sa consommation en argent.

        **La durée propre du calcul, pas l'attente dans la file** (relecture
        ML, défaut 5). `durees_mesurees` est mesurée autour de tout l'appel :
        une image restée dix minutes derrière une vidéo annonçait dix minutes
        aux suivantes. La file locale, elle, mesure l'étape depuis qu'elle a la
        carte ; c'est elle qu'on lit d'abord, et `durees_mesurees` n'est plus
        qu'un repli pour une machine dont la file n'a rien gardé.

        **Et le premier tirage ne gonfle pas les suivants** (règle 8ter) : il
        charge le modèle en mémoire. Annoncé à part (`premier_secondes`, rendu
        seulement quand il est mesuré), il laisse `secondes` dire la durée à
        chaud — celle de chaque image d'un lot après la première.
        """
        if not self.methode_locale(modele):
            return None
        profil = self._profil_local(modele)
        vitesse = ((profil or {}).get("style") or {}).get("vitesse")
        chaud, froid = self._durees_locales(modele)
        if chaud or froid:
            temps: dict[str, Any] = {
                "secondes": _mediane(chaud or froid),
                "mesures": len(chaud) + len(froid),
                "vitesse": vitesse,
            }
            if froid:
                temps["premier_secondes"] = _mediane(froid)
            return temps
        durees = self._base.durees_mesurees(modele)
        return {
            "secondes": self.attente_estimee(modele) if durees else None,
            "mesures": len(durees),
            "vitesse": vitesse,
        }

    def _durees_locales(self, modele: str) -> tuple[list[float], list[float]]:
        """Les durées propres des étapes de ce modèle — **(à chaud, à froid)**,
        les plus récentes, sur la fenêtre de `attente_estimee`.

        Une étape est à froid quand la file le sait (`temperature`), sinon
        quand l'étape lancée juste avant elle sur le même moteur était celle
        d'un autre modèle, ou qu'il n'y en avait aucune : le modèle était alors
        à charger. ComfyUI ne dit pas ce qui est en mémoire (`maison.py`,
        `observer_ressource`), d'où cette lecture de l'ordre des étapes.
        """
        try:
            fournisseur = self._fournisseurs.de(self._catalogue.modele(modele).fournisseur)
            file = fournisseur.file_locale
        except (ErreurAtelier, AttributeError):
            return [], []
        etapes = [e for e in file.lister()["etapes"] if e.get("demarre_le") is not None]
        etapes.sort(key=lambda e: (e["demarre_le"], e["identifiant"]))
        chaud: list[float] = []
        froid: list[float] = []
        dernier: dict[str, str] = {}
        for etape in etapes:
            avant = dernier.get(etape["moteur"])
            dernier[etape["moteur"]] = etape["modele"]
            if etape["modele"] != modele or etape["etat"] != "termine" or etape.get("duree_s") is None:
                continue
            temperature = etape.get("temperature")
            a_froid = temperature == "froid" or (temperature != "chaud" and avant != modele)
            (froid if a_froid else chaud).append(float(etape["duree_s"]))
        return chaud[-FENETRE_MESURES:], froid[-FENETRE_MESURES:]

    def octets(self, generation: Generation, rang: int) -> tuple[bytes, str]:
        """Les octets bruts d'un emplacement réussi, et leur type de média."""
        emplacement = generation.emplacement(rang)
        if emplacement is None or emplacement.resultat is None:
            raise ErreurAtelier(f"l'emplacement {rang} n'a pas d'image")
        resultat = emplacement.resultat
        if not self._fichiers.existe(resultat.fichier):
            raise ErreurAtelier("le fichier de cette image a disparu du disque")
        return self._fichiers.lire(resultat.fichier), resultat.type_media

    # ── Faire entrer une image qui vient d'ailleurs ──────────────────────────

    def importer(
        self,
        octets: bytes,
        nom: str,
        *,
        projet: str | None = None,
        provenance: str = AUTEUR,
        traiter: bool = False,
        forcer: bool = False,
        echelle: str = "",
        filiation: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Un fichier devient un asset entier (US-82, US-167, US-168).

        **Le seul endroit du dépôt qui fasse entrer une image**, et c'est ce qui
        rend vraie la phrase « ce que l'agent peut faire, l'écran le peut aussi »
        dans les deux sens : l'outil MCP et la route qui prend les octets
        appellent celui-ci, chacun avec sa provenance.

        Rend `{"asset": …, "doublon": …}`, et l'un des deux est toujours nul —
        **la forme de `coller_image`**, et pour la raison exacte : « je veux être
        averti d'un doublon avec un lien vers l'existant, tout en gardant la
        possibilité d'importer quand même » (US-46, US-169). Un doublon n'est pas
        un refus, donc il ne lève pas ; rappeler avec `forcer` fait entrer quand
        même.

        **Il passe par une génération, et ce n'est pas une formalité.** La
        bibliothèque se reconstruit en parcourant les `generation.json` du
        disque : un asset écrit sans le sien serait perdu au premier effacement
        de l'index, c'est-à-dire à la première évolution du schéma. Cette
        génération-là n'a appelé personne — modèle `import`, coût nul, un seul
        emplacement déjà réussi —, et elle dit d'où le fichier venait, ce
        qu'aucun autre endroit ne pourrait dire ensuite.

        **`traiter` est faux par défaut, et c'est une correction** (US-170).
        L'import héritait de la recette du projet en silence : une référence de
        2048 pixels revenait à 64, ce que personne n'avait demandé. Le défaut
        est donc « telle quelle », des deux côtés — un agent et un auteur ne
        vivent pas dans deux produits différents. La décision est portée par la
        génération, donc elle survit à l'effacement de l'index.

        **`filiation` fait entrer une image qui vient d'ailleurs dans le dépôt**
        (A13) : une image tirée d'un clip. Le « modèle » devient alors
        `PRELEVEMENT` au lieu d'`IMPORT`, et la filiation s'écrit dans la
        demande — donc **sur le disque**, dans le `generation.json`, où elle
        survit à l'effacement de l'index comme tout le reste de ce qu'on sait
        d'une entrée. Sans elle, rien ne pourrait dire ensuite d'où l'image
        sort : ⚠️ ce n'est pas une décoration, c'est **le seul endroit** qui
        garde que le clip, lui, a été payé.

        **`echelle` sert au traitement, et il n'y a que là qu'on peut le dire.**
        Un import ordinaire n'en porte pas — c'est un fichier, il n'a pas
        d'espèce —, mais une image prélevée sur le clip d'un personnage doit
        recevoir la taille à laquelle ce personnage-là vit dans ce jeu. Le
        nommer ici évite que la chaîne la devine.

        L'asset naît pour le reste par le même chemin que tous les autres : il
        entre en bibliothèque de lui-même, et se range dans le projet ouvert
        quand on n'en nomme pas. **Aucun appel au fournisseur** — importer
        marche réseau coupé.
        """
        propre = nom.strip() or "l'image importée"
        try:
            mesure = mesurer(octets)
        except ValueError:
            # **Le message de Pillow ne franchit pas cette ligne**, comme au
            # tableau : il est en anglais et nomme un tampon mémoire. Ce qui
            # compte, et que le PRD demande, c'est **quel** fichier pose
            # problème parmi les douze qu'on vient de déposer (US-169).
            raise ImportRefuse(f"« {propre} » n'est pas une image") from None

        if projet is None and self._bibliotheque is not None:
            projet = self._bibliotheque.courant

        modele = PRELEVEMENT if filiation else IMPORT
        empreinte = empreinte_de(octets)
        if not forcer:
            deja = self._deja_importe(projet, empreinte, modele)
            if deja is not None:
                return {"asset": None, "doublon": deja.en_json()}

        identifiant = uuid.uuid4().hex
        chemin = self._fichiers.ecrire_brut(
            identifiant, 0, octets, extension(mesure.type_media)
        )
        emplacement = Emplacement(
            rang=0,
            statut=Statut.REUSSIE,
            resultat=Resultat(
                fichier=chemin,
                largeur=mesure.largeur,
                hauteur=mesure.hauteur,
                type_media=mesure.type_media,
                octets=mesure.octets,
            ),
        )
        generation = Generation(
            identifiant=identifiant,
            modele=modele,
            # Le nom du fichier fait le label, par `_label` : c'est le seul
            # texte qu'un import apporte, et c'est celui que l'auteur cherchera
            # dans la grille. `traiter` et l'empreinte y sont aussi : la
            # première décide de ce que l'asset reçoit à sa naissance, la
            # seconde de ce qu'un import suivant reconnaîtra comme doublon — et
            # les deux doivent survivre à l'effacement de l'index.
            #
            # **Et la filiation avec elles** (A13), pour la même raison exacte :
            # d'où l'image sort ne se redevine pas, et le `generation.json` est
            # ce qui reste quand l'index a été effacé.
            demande={
                "prompt": nom,
                "variations": 1,
                "source": nom,
                "traiter": traiter,
                "empreinte": empreinte,
                **({"echelle": echelle} if echelle else {}),
                **({"filiation": filiation} if filiation else {}),
            },
            parametres_resolus={"modele": modele, "source": nom},
            emplacements=[emplacement],
            cree_le=time.time(),
            projet=projet,
            provenance=provenance,
        )
        self._sauver(generation)
        asset = self._assets.naitre(generation, emplacement)
        if asset is None:  # pragma: no cover — l'emplacement porte son résultat
            raise ErreurAtelier(f"« {propre} » n'a pas pu entrer en bibliothèque")
        return {"asset": asset.en_json(), "doublon": None}

    def _deja_importe(
        self, projet: str | None, empreinte: str, modele: str = IMPORT
    ) -> Asset | None:
        """L'asset importé qui porte déjà ces octets-là, ou rien.

        **Le modèle fait partie de la question** (A13) : une image prélevée d'un
        clip et un fichier déposé à la main sont deux entrées différentes, et
        chercher l'une chez l'autre aurait fait dire *doublon* à la première
        image qu'un clip et un import partagent — c'est-à-dire jamais, ou par
        accident. Chacune cherche chez ses semblables.

        **Dans ce projet, et pas dans toute la bibliothèque** — même portée
        qu'au tableau d'inspiration, et l'écran dit « comme au tableau ». Un
        univers n'a pas à savoir ce qu'un autre a fait entrer ; la même
        référence a de bonnes raisons de servir dans deux jeux.

        **Comparé sur les octets, jamais à l'œil** : deux images visuellement
        proches sont deux images, et c'est à l'auteur d'en décider. Le produit
        signale ce dont il est certain — le même fichier, deux fois.

        Cherché sur les **générations d'import** plutôt que sur les assets : ce
        sont elles qui portent l'empreinte, et c'est déjà là que vit tout ce
        qu'on sait d'un import. Un asset supprimé n'a plus de doublon à
        signaler — il n'est plus dans la bibliothèque —, d'où la relecture par
        l'asset et non par la génération seule.
        """
        for generation in self._base.generations_du_modele(modele, projet):
            if generation.demande.get("empreinte") != empreinte:
                continue
            asset = self._assets.lire(f"{generation.identifiant}-0")
            if asset is not None:
                return asset
        return None

    # ── Soumission ───────────────────────────────────────────────────────────

    def preparer(
        self,
        identifiant_modele: str,
        demande: Demande,
        *,
        identifiant: str | None = None,
        projet: str | None = None,
        references: Sequence[Reinjection] = (),
        provenance: str = AUTEUR,
        personnage: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        # **Les directions d'une planche de pose** (E13). Deux ou plus, et
        # l'appel part en une planche dont chaque case sait déjà dans quelle
        # direction son image se rangera ; une seule, et c'est la case de C1,
        # que `direction` désigne.
        directions: Sequence[str] | None = None,
        poses: Sequence[str] | None = None,
        piece: str | None = None,
        references_ecartees: Sequence[str] | None = None,
        # **Ce que l'écran de confirmation a trié** (E14). Les lignes éteintes,
        # celles rallumées, les textes corrigés — et rien de tout cela ne
        # remonte : le tri habille *cet appel* et disparaît ensuite. Absent,
        # c'est un agent ou une relance, et les réglages durables décident seuls.
        tri: "Tri | None" = None,
    ) -> tuple[Generation, Modele | None, bool]:
        """Vérifie, enregistre, et dit si c'est neuf. N'appelle pas le fournisseur.

        Rend `(generation, modele, deja_soumise)`. Quand `deja_soumise` est vrai,
        rien n'a été facturé et rien ne le sera : c'est la même génération, et le
        modèle est inutile — on ne rappellera pas le fournisseur.

        `references` porte des **identifiants d'assets et leur rôle** (US-12) :
        les octets sont relus ici, jamais transportés par l'appelant ni recopiés
        dans l'enregistrement. Celle qui porte le rôle `edition` ouvre la liste
        et donnera sa filiation à ce qui sortira.

        Les références sont résolues **avant** le grisé : le plafond d'un modèle
        se compte sur des images réelles, et un asset réinjecté qui n'existe
        plus doit se dire avant qu'un centime ne parte.

        **L'univers s'ajoute ici, et avant le dédoublonnage** (T4). La bible
        active se replie en tête du prompt, et les artworks de la famille du
        sujet — plus ceux marqués « tous » — rejoignent les réinjections de
        l'auteur. L'ordre n'est pas indifférent : le dédoublonnage passe après,
        donc un artwork que l'auteur a aussi réinjecté à la main ne compte
        qu'une fois dans le plafond du modèle, et n'est facturé qu'une fois chez
        ceux qui facturent au token.
        """
        identifiant = identifiant or uuid.uuid4().hex
        existante = self._base.lire(identifiant)
        if existante is not None:
            return existante, None, True

        if projet is None and self._bibliotheque is not None:
            projet = self._bibliotheque.courant

        # **La case visée est vérifiée avant qu'un centime parte** (US-120). Un
        # personnage disparu ou une pose qu'il ne tient plus doivent se dire
        # ici : l'écran n'arme que des cases visibles, mais un onglet resté
        # ouvert pendant qu'on décochait la pose enverrait sinon une image dans
        # une case que personne ne regarde plus. La règle appartient à la
        # production, et ce service ne fait que la lui demander.
        # **Le lot, et les cases qu'il vise** (US-128). Composé ici parce que ce
        # service est le seul qui sache déjà relier un appel à une case ; le
        # pliage, lui, ne connaît ni personnage ni pose, et c'est ce qui laissera
        # C3 le réemployer tel quel. Chaque case est vérifiée avant qu'un centime
        # parte, exactement comme la case unique de C1.
        pliage = self._plier(projet, personnage, poses, piece, pose, directions)
        # **La case visée est vérifiée avant qu'un centime parte** (US-120). Un
        # personnage disparu ou une pose qu'il ne tient plus doivent se dire
        # ici : l'écran n'arme que des cases visibles, mais un onglet resté
        # ouvert pendant qu'on décochait la pose enverrait sinon une image dans
        # une case que personne ne regarde plus. La règle appartient à la
        # production, et ce service ne fait que la lui demander.
        #
        # **Sauf pour un lot**, dont chaque case vient d'être vérifiée juste
        # au-dessus, une par une : un lot ne vise pas *une* case, il en vise N,
        # et `pose` reste vide.
        #
        # **Un sujet sans case est légitime** (comme `designer` depuis `AU20`) :
        # l'image est à ce personnage, sans être rangée dans une pose. Seul le
        # personnage se vérifie alors.
        if pliage is None and personnage and self._production is not None and projet:
            if pose:
                self._production.viser(projet, personnage, pose, direction)
            else:
                self._production.personnage(projet, personnage)

        if pliage is not None and demande.variations > 1:
            raise DemandeRefusee(
                "un lot plié part en un seul appel — c'est tout son intérêt, "
                "et les variations ne s'y appliquent pas"
            )

        # **Refaire une planche est un appel d'une image fixe** (RS2) : ni lot
        # plié, ni pièce, ni case visée. Refusé ici, avant qu'un centime parte.
        if demande.garder_mise_en_page:
            _mise_en_page_permise(pliage, piece, pose, direction)

        # **Un appel qui ne dit pas quoi dessiner ne part pas** (1ᵉʳ septembre
        # 2026). Relevé sur « Le Marais du Vieux Moulin » : deux des trois
        # personnages du projet n'avaient aucun signalement, et leur prompt se
        # réduisait à la bible du jeu plus `idle stance, full body`. On payait
        # pour demander « une posture de repos », sans dire de quoi — et l'image
        # qui revenait était ce que le modèle avait bien voulu inventer.
        #
        # **Le refus porte l'endroit où le réparer**, parce que c'est une case
        # vide sur une fiche et non une panne : trois mots à écrire, et l'appel
        # part. La règle vaut pour les deux façades — un agent qui vise une chose
        # sans description reçoit la même phrase que l'auteur.
        if not demande.repris and not demande.prompt.strip():
            raise DemandeRefusee(
                "rien ne dit ce qu'il faut dessiner — écrivez le signalement de "
                "la chose sur sa fiche, ou décrivez le sujet dans le champ"
            )

        # **Les images d'abord, le texte ensuite** — l'ordre a changé le
        # 1ᵉʳ septembre 2026, et c'est la seule façon que le prompt ait de
        # **dire** ce que les images jointes veulent dire. Jusque-là il était
        # composé avant qu'elles soient connues, et il partait donc muet à leur
        # sujet : une planche de quatre poses dessinées de face partait avec un
        # texte qui demandait le dessus, sans une phrase pour arbitrer.
        # Rien d'autre ne bouge — la composition des références n'a jamais lu le
        # prompt, elle ne lit que l'échelle et la case « palette ».
        reinjectes, hors_plafond = self._reinjections(
            projet,
            personnage,
            piece,
            demande.echelle,
            references,
            references_ecartees,
            identifiant_modele,
            # **Le contexte qui choisit les références rangées** (RS1) : la
            # case visée, ou la planche de ses directions.
            direction=direction,
            directions=directions,
            # Refaire une planche emporte la planche du sujet (RS2).
            mise_en_page=demande.garder_mise_en_page,
        )
        # **L'image dont on garde la mise en page** (RS2), choisie sur ce qui
        # part vraiment — ou le refus, avant tout paiement.
        source = _source_de_mise_en_page(
            demande.garder_mise_en_page, reinjectes, references
        )
        # **Le texte tel qu'il partira, et un seul endroit le compose** (US-158).
        # `_texte` est aussi ce que l'aperçu du champ de prompt montre avant de
        # lancer : deux compositions écrites à deux endroits finiraient par
        # diverger, et celle qui compte est celle qui part.
        demande = replace(
            demande,
            # **Le sujet est gardé avant d'être noyé** : c'est lui qui nommera
            # l'asset, et il n'existe plus une ligne plus bas. Voir
            # `Demande.sujet`.
            sujet=demande.prompt.strip(),
            # **Le fond du jeu s'interdit sur le sujet** (D3), et la phrase entre
            # dans un champ qui existait déjà — `prompt_negatif`, que les deux
            # adaptateurs replient en fin de demande. Elle est composée **ici**,
            # avec le prompt et avant l'enregistrement : `generation.json` porte
            # donc l'interdiction telle qu'elle est partie, et une génération se
            # relit des mois après sans avoir à reconstituer le fond du jour.
            #
            # **Un texte repris n'y échappe pas, et c'est voulu.** Reprendre le
            # texte à la main est une prise de main sur *le prompt* ; le champ
            # d'interdiction est un autre champ, l'auteur y écrit ce qu'il veut,
            # et son texte passe en tête sans jamais céder.
            #
            # **Un workflow local qui ne relie pas le négatif ne le lit pas**
            # (ML4) : la génération ne dit donc pas qu'il est parti.
            prompt_negatif=(
                self._interdit(projet, demande.prompt_negatif, tri)
                if self._negatif_lu(identifiant_modele)
                else ""
            ),
            prompt=self._texte(
                demande.prompt,
                demande.repris,
                projet,
                pliage,
                modele=identifiant_modele,
                personnage=personnage,
                pose=pose,
                direction=direction,
                tri=tri,
                # **Les rôles de ce qui part vraiment, dans l'ordre** (R7). Le
                # gabarit et la bande de couleurs en font partie : ce sont deux
                # images de plus dans le sac, et le texte les numérote comme les
                # autres. `_roles_qui_partent` est le seul endroit où cette
                # liste s'écrit — l'aperçu lit exactement la même.
                roles=self._roles_qui_partent(
                    reinjectes,
                    pliage,
                    identifiant_modele,
                    self._bande_jointe(
                        demande.palette, projet, personnage, identifiant_modele
                    ),
                    mise_en_page=source,
                ),
                mise_en_page=demande.garder_mise_en_page,
            ),
        )
        demande = replace(
            demande,
            references=self._octets_references(
                reinjectes, projet, fond=self._fond_des_references(identifiant_modele, projet, tri)
            )
            # **Le gabarit part comme une référence de plus, et il en est une.**
            # Il occupe donc une place dans le plafond du modèle et il coûte chez
            # ceux qui facturent au token (`docs/PIEGES.md`) : le compter à part
            # aurait fait mentir le grisé au moment précis où l'appel est le plus
            # cher. **Avant le grisé**, pour la même raison que les réinjections.
            + self._jointes(pliage, identifiant_modele)
            # **La bande de couleurs, quand la case est cochée** (E14). Elle part
            # comme le gabarit — redessinée, jamais relue —, elle occupe une
            # place dans le plafond du modèle et elle coûte chez ceux qui
            # facturent au token. **Avant le grisé**, pour la même raison.
            + self._bande(demande, projet, personnage, identifiant_modele),
        )

        modele = self._catalogue.modele(identifiant_modele)
        graine = self._graine_demandee(modele, demande)

        refus = modele.refus(_sans_graine(modele, demande))
        if refus is not None:
            raise DemandeRefusee(f"{modele.nom} {refus}")

        # **Ce qui manque à *son* fournisseur, pas au produit** (F1). Avant la
        # V2.2 la question était « y a-t-il une clé ? » et la réponse valait pour
        # tout l'atelier. Elle vaut maintenant pour un modèle : l'un demande une
        # clé, l'autre non, et refuser les deux au nom du premier serait un refus
        # faux.
        manque = self._catalogue.grise(modele)
        if manque is not None:
            raise SansCle(manque)

        gardees, ecartees = modele.retenir(_sans_graine(modele, demande).options)
        resolus = self._resolus(modele, demande, gardees)
        if graine is not None:
            # **Demandée, donc dite** : la génération relue dit qu'elle a été
            # tirée sur cette graine-là, et pas au hasard.
            resolus[GRAINE] = graine
        generation = Generation(
            identifiant=identifiant,
            modele=modele.identifiant,
            demande=demande.resume(),
            parametres_resolus=resolus,
            ecartees=ecartees,
            emplacements=[Emplacement(rang=r) for r in range(demande.variations)],
            cree_le=time.time(),
            projet=projet,
            references=reinjectes,
            # **Ce que le plafond du modèle a laissé au sol** (F6). Vide dans
            # l'immense majorité des appels — il ne se remplit que chez un
            # modèle qui prend moins d'images que le jeu n'en propose.
            hors_plafond=hors_plafond,
            # **Qui a demandé cet appel** (US-39). Posé ici, à la soumission, et
            # nulle part ailleurs : c'est le seul instant où l'on sait par quelle
            # façade la demande est entrée. L'asset en héritera à sa naissance.
            provenance=provenance,
            # **Et pour quelle case** (US-120). Même règle, même instant : l'image
            # qui en reviendra tombera dans la case sans que personne ait à l'y
            # ranger, et une relance de cet appel-là visera toujours la même.
            personnage=personnage or None,
            pose=pose or None,
            direction=direction or None,
            # **Et pour combien de cases** (US-128). Une génération ordinaire n'en
            # porte pas, et c'est le cas courant : `pliage` vaut `None`, l'image
            # qui revient naît comme depuis T1.
            pliage=pliage,
            # **Et de quelle pièce** (US-140). C'est ce champ, et lui seul, qui
            # fait de cet appel une planche d'équipement : le dépliage le lit
            # pour savoir s'il doit ranger des corps ou fabriquer des calques.
            piece=piece or None,
            # **Et ce que cet appel-là a pris à l'ambiance** (E14). Constaté
            # après coup sur ce qui part vraiment, jamais recopié du réglage
            # durable : un état dérivable ne se garde pas en double, mais
            # celui-ci ne l'est pas — l'écran de confirmation éteint ligne par
            # ligne, et le réglage durable ne décrit pas ce qui reste.
            ambiance=self._ambiance_de(projet, personnage),
            pris=self._pris(projet, personnage, demande, reinjectes, pose, direction, tri),
        )
        self._sauver(generation)
        return generation, modele, False

    async def soumettre(
        self,
        identifiant_modele: str,
        demande: Demande,
        *,
        identifiant: str | None = None,
        projet: str | None = None,
        references: Sequence[Reinjection] = (),
        provenance: str = AUTEUR,
        personnage: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        directions: Sequence[str] | None = None,
        poses: Sequence[str] | None = None,
        piece: str | None = None,
        references_ecartees: Sequence[str] | None = None,
        tri: "Tri | None" = None,
    ) -> Generation:
        """Prépare puis lance, sans attendre. L'appelant reçoit l'identifiant."""
        generation, modele, deja = self.preparer(
            identifiant_modele,
            demande,
            identifiant=identifiant,
            projet=projet,
            references=references,
            provenance=provenance,
            personnage=personnage,
            pose=pose,
            direction=direction,
            directions=directions,
            poses=poses,
            piece=piece,
            references_ecartees=references_ecartees,
            tri=tri,
        )
        if deja or modele is None:
            return generation

        # Les octets des références ont été relus dans `preparer` : on repart de
        # l'enregistrement pour que l'appel et le relancer suivent le même chemin.
        tache = asyncio.create_task(
            self._executer(generation, modele, self._demande_de(generation))
        )
        self._en_vol.add(tache)
        tache.add_done_callback(self._en_vol.discard)
        return generation

    def demande_preparee(self, generation: Generation) -> Demande:
        """Snapshot d'envoi pour un travail durable : texte et octets résolus ensemble."""
        return self._demande_de(generation)

    def methode_locale(self, modele: str) -> bool:
        return self._catalogue.modele(modele).locale

    def _graine_demandee(self, modele: Modele, demande: Demande) -> int | None:
        """La graine que l'appelant fournit pour refaire la même image, ou
        `None` — et le refus, avant la file, quand elle ne peut pas servir.

        **Seulement pour un workflow local** : un modèle distant ne reçoit pas
        de graine, et la clé suit chez lui le chemin de toute option inconnue
        (écartée, comme avant). Un profil local sans liaison `graine` rend
        toujours la même image : une graine demandée n'y changerait rien, et
        l'accepter laisserait croire le contraire.
        """
        if not modele.locale or GRAINE not in demande.options:
            return None
        graine = demande.options[GRAINE]
        if isinstance(graine, bool) or not isinstance(graine, int) or not 0 <= graine <= GRAINE_MAX:
            raise DemandeRefusee("la graine est un entier positif")
        profil = self._profil_local(modele.identifiant)
        if profil is not None and GRAINE not in profil["liaisons"]:
            raise DemandeRefusee(
                f"{modele.nom} n'a pas de graine reliée — il rend la même image à "
                "chaque appel, sans qu'on la lui donne"
            )
        return graine

    def etape_locale(self, identifiant: str, rang: int = 0):
        generation = self._base.lire(identifiant)
        if not generation:
            return None
        fournisseur = self._fournisseurs.de((generation.modele or "").split(":", 1)[0])
        geste = getattr(fournisseur, "etape", None)
        return geste(identifiant, rang) if geste else None

    def annonce_locale(self, modele: str, demande: Demande | None = None):
        if not self.methode_locale(modele):
            return None
        fournisseur = self._fournisseurs.de(self._catalogue.modele(modele).fournisseur)
        mesures = [m for m in fournisseur.file_locale.mesures() if m["modele"] == modele]
        return {"cout_usd": 0.0, "nature": "local", "mesures": mesures,
            "raison": "Durée non encore mesurée pour ce workflow." if not mesures else "Durées des calculs déjà terminés, sans multiplier le chargement initial."}

    async def suivre_locale(self, identifiant: str) -> Generation:
        generation = self._base.lire(identifiant)
        if generation is None:
            raise GenerationInconnue(identifiant)
        modele = self._catalogue.modele(generation.modele)
        fournisseur = self._fournisseurs.de(modele.fournisseur)
        suivre = getattr(fournisseur, "recuperer_suivi", None)
        if suivre is None:
            raise DemandeRefusee("Cette génération n'a pas de suivi local récupérable.")
        for emplacement in generation.emplacements:
            if emplacement.statut == Statut.REUSSIE:
                continue
            # Le fournisseur refuse si aucune étape durable n'existe : ce
            # geste ne reconstruit jamais un envoi à partir des réglages actuels.
            image = await suivre(identifiant, emplacement.rang)
            await self._executer_emplacement(generation, emplacement, modele, Demande(prompt="reprise"), fournisseur, image_recue=image)
        return self._base.lire(identifiant)

    async def executer_preparee(self, identifiant: str, demande: Demande) -> Generation:
        """Exécute la préparation gelée par un travail, sans recomposer l'univers.

        Le travail possède sa réservation et son verrou durable. Une génération
        déjà commencée n'est jamais resoumise par ce geste.
        """
        generation = self._base.lire(identifiant)
        if generation is None:
            raise GenerationInconnue(identifiant)
        if any(e.demarre_le is not None or e.statut not in (Statut.EN_ATTENTE, Statut.INTERROMPUE)
               for e in generation.emplacements):
            return generation
        modele = self._catalogue.modele(generation.modele)
        manque = self._catalogue.grise(modele)
        if manque:
            raise SansCle(manque)
        refus = modele.refus(_sans_graine(modele, demande))
        if refus:
            raise DemandeRefusee(refus)
        for emplacement in generation.emplacements:
            emplacement.statut = Statut.EN_ATTENTE
        await self._executer(generation, modele, demande)
        return self._base.lire(identifiant)

    async def relancer(self, identifiant: str, rang: int) -> Generation:
        """Relance **un seul** emplacement, sans réécrire le prompt ni repayer
        les autres (US-20, US-22).

        C'est la contrepartie directe de « une variation est un appel » : ce qui
        a réussi est déjà sur le disque, ce qui a raté repart seul. Un
        emplacement déjà réussi n'est jamais rejoué — ce serait payer deux fois
        pour la même chose.
        """
        generation = self._base.lire(identifiant)
        if generation is None:
            raise GenerationInconnue(identifiant)

        emplacement = generation.emplacement(rang)
        if emplacement is None:
            raise ErreurAtelier(f"l'emplacement {rang} n'existe pas")
        if emplacement.statut == Statut.REUSSIE:
            raise ErreurAtelier("cet emplacement a déjà son image")
        if emplacement.statut in (Statut.EN_COURS, Statut.EN_ATTENTE):
            return generation  # il tourne déjà : relancer le doublerait

        modele = self._catalogue.modele(generation.modele)
        manque = self._catalogue.grise(modele)
        if manque is not None:
            raise SansCle(manque)

        demande = self._demande_de(generation)

        emplacement.statut = Statut.EN_ATTENTE
        emplacement.raison = None
        self._sauver(generation)

        fournisseur = self._fournisseurs.de(modele.fournisseur)
        tache = asyncio.create_task(
            self._executer_emplacement(
                generation, emplacement, modele, demande, fournisseur
            )
        )
        self._en_vol.add(tache)
        tache.add_done_callback(self._en_vol.discard)
        return generation

    def ecarter(self, identifiant: str, rang: int, ecartees: Sequence[int]) -> Generation:
        """L'auteur a regardé la planche, il tranche, et le lot se déplie (R6).

        **Le geste qui remplace un refus.** Avant R6, une planche qui rendait
        neuf sujets pour huit était jetée entière et se relançait au prix plein ;
        quatre planches sur treize du banc d'animation partaient comme ça. Ici,
        elle a été payée une fois, elle est sur le disque, et ce qui manquait
        n'était qu'une décision : *lesquels je garde*.

        `ecartees` est vide quand il n'y a rien à écarter — un « je garde tout »
        explicite, qui est aussi une décision (US-368) : c'est ce qui fait
        entrer en bibliothèque une planche dont les sujets remplissaient toute
        leur boîte, **sans que ça ait pu arriver en silence**.

        **Il ne paie rien et n'appelle personne.** Comme le dépliage dont il est
        la porte, il est local et gratuit : c'est la même image qu'on recoupe
        autrement.
        """
        generation = self._base.lire(identifiant)
        if generation is None:
            raise GenerationInconnue(identifiant)

        pliage = generation.pliage
        emplacement = generation.emplacement(rang)
        if pliage is None or emplacement is None:
            raise ErreurAtelier("cet appel n'est pas une planche")
        if self._pliage is None:  # pragma: no cover — l'atelier le compose
            raise ErreurAtelier("le dépliage n'est pas disponible")
        if self._pliage.deplie(generation):
            # **Une planche déjà dépliée ne se re-tranche pas.** Redéplier
            # créerait N assets de plus à des rangs neufs, et il faudrait
            # supprimer les anciens — or un calque désigne son corps par
            # identifiant. Même refus que `recaler` en C3, et pour la raison
            # exacte.
            raise ErreurAtelier("cette planche a déjà rendu ses images")
        if emplacement.resultat is None:
            raise ErreurAtelier("cette planche n'est pas arrivée")

        hors = [i for i in ecartees if not 0 <= i < pliage.trouvees]
        if hors:
            raise ErreurAtelier(
                f"la planche a rendu {pliage.trouvees} sujets — "
                f"il n'y a pas de n° {hors[0] + 1}"
            )

        # **La décision d'abord, le dépliage ensuite**, et sur le même objet :
        # `attend_un_choix` doit être faux au moment où `decouper_retour`
        # regarde, sans quoi le lot redemanderait la question qu'on vient de lui
        # répondre.
        pliage.ecartees = tuple(sorted(set(int(i) for i in ecartees)))
        try:
            if generation.piece and self._equipement is not None:
                self._equipement.deplier(generation, rang)
            else:
                self._pliage.deplier(generation, emplacement)
        except CompteFaux as refus:
            # **L'auteur en a écarté trop.** Ce n'est pas la planche qui est en
            # faute, c'est le choix : la décision est reprise pour qu'il puisse
            # en poser une autre, et rien n'est marqué en échec.
            pliage.ecartees = None
            self._sauver(generation)
            raise ErreurAtelier(refus.raison) from refus

        self._sauver(generation)
        return generation

    async def attendre(self, identifiant: str, delai_s: float) -> Generation | None:
        """Attente bornée — le contrat du MCP, utile aussi aux essais.

        « L'appelant dit : attends jusqu'à N secondes, sinon rends
        l'identifiant » (`docs/archi-fournisseur.md` § Contrat de génération).
        """
        limite = time.monotonic() + delai_s
        while True:
            generation = self._base.lire(identifiant)
            if generation is None or generation.statut.terminee:
                return generation
            if time.monotonic() >= limite:
                return generation
            await asyncio.sleep(0.25)

    async def attendre_tout(self) -> None:
        """Jusqu'à ce que plus rien ne tourne. Pour les essais et les scripts —
        l'écran, lui, écoute le flux et n'attend jamais."""
        while self._en_vol:
            taches = tuple(self._en_vol)
            await asyncio.gather(*taches, return_exceptions=True)
            # Sur des tâches déjà finies, gather peut rendre sans céder la
            # main. Leur callback de retrait attend encore ce tour de boucle :
            # compter uniquement sur lui transforme alors l'attente en boucle
            # CPU infinie. Ne retirer que ce qui vient réellement de finir ;
            # une tâche ajoutée entre-temps devra aussi être attendue.
            self._en_vol.difference_update(t for t in taches if t.done())

    # ── L'exécution ──────────────────────────────────────────────────────────

    async def _executer(
        self, generation: Generation, modele: Modele, demande: Demande
    ) -> None:
        """Un emplacement, un appel, tous en parallèle.

        Les plafonds du fournisseur sont larges — 50 requêtes par minute sur
        GPT-Image-2. Quatre variations partent ensemble, pas l'une après l'autre.
        """
        fournisseur = self._fournisseurs.de(modele.fournisseur)
        await asyncio.gather(
            *(
                self._executer_emplacement(generation, e, modele, demande, fournisseur)
                for e in generation.emplacements
            )
        )

    async def _executer_emplacement(
        self,
        generation: Generation,
        emplacement: Emplacement,
        modele: Modele,
        demande: Demande,
        fournisseur: PortFournisseur,
        image_recue=None,
    ) -> None:
        emplacement.statut = Statut.EN_COURS
        emplacement.acceptation_inconnue = False
        emplacement.demarre_le = time.time()
        emplacement.duree_attendue_s = self.attente_estimee(modele.identifiant)
        self._sauver(generation)

        depart = time.monotonic()
        image = None
        try:
            if image_recue is not None:
                image = image_recue
            elif hasattr(fournisseur, "generer_suivi"):
                image = await fournisseur.generer_suivi(modele, demande, generation, emplacement.rang)
            else:
                image = await fournisseur.generer(modele, demande)
            # Une image payée mais illisible reste une dépense, comme un clip.
            # Le budget des travaux durables doit la voir avant le décodage.
            emplacement.consomme = image.consomme
            emplacement.unite = image.unite
            self._sauver(generation, annoncer=False)
            mesure = mesurer(image.octets)
        except ErreurAtelier as erreur:
            # Un refus peut coûter : le fournisseur facture dès que l'appel a
            # atteint le modèle. Ce montant part au journal du projet (US-24).
            self._echouer(
                generation,
                emplacement,
                erreur.raison,
                depart,
                consomme=getattr(erreur, "consomme", 0.0),
                unite=getattr(erreur, "unite", USD),
            )
            return
        except ValueError as erreur:  # image illisible
            emplacement.acceptation_inconnue = image is None
            self._echouer(generation, emplacement, str(erreur), depart,
                          consomme=emplacement.consomme, unite=emplacement.unite)
            return
        except Exception as erreur:  # noqa: BLE001 — un raté ne tue jamais le lot
            emplacement.acceptation_inconnue = image is None
            self._echouer(generation, emplacement, f"échec inattendu — {erreur}", depart,
                          consomme=emplacement.consomme, unite=emplacement.unite)
            return

        chemin = self._fichiers.ecrire_brut(
            generation.identifiant,
            emplacement.rang,
            image.octets,
            extension(mesure.type_media),
        )
        emplacement.resultat = Resultat(
            fichier=chemin,
            largeur=mesure.largeur,
            hauteur=mesure.hauteur,
            type_media=mesure.type_media,
            octets=mesure.octets,
        )
        emplacement.consomme = image.consomme
        emplacement.unite = image.unite
        emplacement.graine = getattr(image, "graine", None)
        emplacement.duree_s = round(time.monotonic() - depart, 2)
        emplacement.statut = Statut.REUSSIE
        self._sauver(generation)

        # **Un lot se déplie ici, et la planche ne devient pas un asset**
        # (US-130). Ce qui sort du produit, ce sont les images séparées : une
        # feuille assemblée qui entrerait en bibliothèque serait exportable, et
        # « aucune feuille assemblée n'est livrable » cesserait d'être vrai par
        # construction pour devenir un filtre à tenir.
        #
        # **L'arrivée est enregistrée avant le dépliage**, jamais après : un lot
        # payant écrit au fur et à mesure (`docs/PIEGES.md`), et c'est ce qui
        # rend la reprise possible — une coupure pendant le dépliage laisse sur
        # le disque une planche payée et reçue, que le démarrage rangera sans
        # rien repayer (US-132). Le prix est un second message sur le flux quand
        # le compte tombe faux, et il est mérité.
        if generation.pliage is not None:
            if self._pliage is None:  # pragma: no cover — l'atelier le compose
                return
            try:
                # **Une seule ligne sépare les deux usages du pliage** : sans
                # pièce, la planche rend N corps (C2) ; avec, elle rend N calques
                # comparés à l'avant que l'atelier connaît (C3). Le découpage, le
                # compte et son refus sont les mêmes des deux côtés — ils vivent
                # dans `ServicePliage`, et aucun des deux dépliages ne les
                # réécrit.
                if generation.piece and self._equipement is not None:
                    self._equipement.deplier(generation, emplacement.rang)
                else:
                    self._pliage.deplier(generation, emplacement)
            except CompteFaux as refus:
                # **Le seul refus automatique du produit** : rien n'est entré, le
                # coût reste au journal (US-24), et l'emplacement redevient
                # relançable d'un geste — c'est la relance de T1, telle quelle,
                # et le lot repart au prix plein (US-131).
                generation.pliage.refus = refus.raison
                emplacement.statut = Statut.ECHOUEE
                emplacement.raison = refus.raison
                self._sauver(generation)
            except ChoixAttendu:
                # **Ni refus ni échec, et c'est le cœur de R6** (US-367). La
                # planche est arrivée entière : l'emplacement reste réussi, rien
                # ne se relance, et l'appel payé ne se rejoue pas. Ce qui manque
                # est un regard, et le pliage porte maintenant de quoi le poser —
                # combien de sujets, où, et ce que chacun mesure.
                #
                # **Aucune raison n'est écrite sur l'emplacement.** `raison` est
                # le mot du produit pour « pourquoi ça a raté » ; s'en servir ici
                # ferait lire un échec là où il n'y en a pas, dans le journal des
                # ratés comme dans la tuile.
                self._sauver(generation)
            return

        # Après l'enregistrement, jamais avant : l'asset renvoie à un fichier et
        # à une génération qui doivent déjà être sur le disque quand il paraît.
        if self._assets is not None:
            self._assets.naitre(generation, emplacement)

    def _echouer(
        self,
        generation: Generation,
        emplacement: Emplacement,
        raison: str,
        depart: float,
        consomme: float = 0.0,
        unite: str = USD,
    ) -> None:
        """Un appel raté garde ce qu'il a consommé : il reste lisible au journal.

        US-24, et **l'unité avec la quantité depuis F2** : *une génération
        enregistre ce qu'elle a consommé et dans quelle unité, y compris quand
        elle échoue*. Un refus qui a brûlé un jeton l'a brûlé pour de bon, et un
        compte de réserve qui l'oublierait serait faux vers le haut.
        """
        emplacement.statut = Statut.ECHOUEE
        emplacement.raison = raison
        emplacement.consomme = consomme
        emplacement.unite = unite
        emplacement.duree_s = round(time.monotonic() - depart, 2)
        self._sauver(generation)

    def _demande_de(self, generation: Generation) -> Demande:
        """Reconstruit la demande d'une génération enregistrée, références comprises.

        Les octets ne sont **jamais** recopiés dans l'enregistrement : un
        `generation.json` doit rester lisible à l'œil, et une seconde copie de
        l'image serait une copie que plus rien ne met à jour. Ils se relisent
        depuis les assets — ici comme à la soumission, donc l'appel et la
        relance suivent exactement le même chemin.
        """
        demande = generation.demande
        return Demande(
            prompt=demande["prompt"],
            prompt_negatif=demande.get("prompt_negatif", ""),
            proportions=demande.get("proportions", "1:1"),
            resolution=demande.get("resolution"),
            variations=1,
            # **La bande de couleurs se redessine elle aussi**, et pour la raison
            # du gabarit deux lignes plus bas : elle n'a pas d'identifiant et
            # n'est nulle part sur le disque. Une relance qui l'aurait perdue
            # aurait envoyé un appel différent de celui qu'on relance.
            palette=bool(demande.get("palette")),
            # **Et la planche à refaire** (RS2). Le texte est déjà celui qui est
            # parti ; le drapeau suit pour que la demande relancée dise ce
            # qu'elle est, et qu'un appel refait depuis elle la refasse aussi.
            garder_mise_en_page=bool(demande.get("garder_mise_en_page")),
            references=self._octets_references(
                generation.references,
                generation.projet,
                fond=self._fond_des_references(generation.modele, generation.projet, None),
            )
            # **Le gabarit se redessine, il ne se relit pas.** Il n'est ni un
            # asset ni une carte : il n'a pas d'identifiant, il n'est nulle part
            # sur le disque, et il se refabrique à l'identique depuis la
            # géométrie du pliage. L'appel et la relance envoient donc exactement
            # la même chose, ce qui est la promesse de cette méthode.
            + self._jointes(generation.pliage, generation.modele)
            + self._bande(
                Demande(prompt="x", palette=bool(demande.get("palette"))),
                generation.projet,
                generation.personnage,
                generation.modele,
            ),
            options=demande.get("options", {}),
        )

    # ── Les jeux de réglages nommés : retirés le 16 septembre 2026 (RP18) ────
    #
    # `reglages`, `nommer_reglages` et `oublier_reglages` gardaient sous un nom
    # ce qui part et comment (US-134). Aucun écran ne les a jamais appelés, et
    # le geste que l'auteur emploie à la place existe : *Reprendre les réglages*
    # relit la génération d'une image de la bibliothèque et repose ses réglages
    # dans le générateur. Le point de départ est alors une image qu'on a sous
    # les yeux, au lieu d'un nom à se rappeler.

    # ── Le lot ───────────────────────────────────────────────────────────────

    def cases_de_planche(
        self,
        projet: str | None,
        personnage: str | None,
        *,
        pose: str | None = None,
        directions: Sequence[str] | None = None,
        poses: Sequence[str] | None = None,
        piece: str | None = None,
    ) -> Pliage | None:
        """Les cases que cette planche enverrait — **par le chemin de l'envoi**.

        C'est `_plier` rendu public, et rien d'autre. L'écran de la planche
        montre ce qui est écrit dans chaque case *avant* de payer (E13) ; le
        recomposer à l'écran en aurait fait une seconde vérité sur ce qui part,
        et « deux vérités sur la même chose finissent par diverger ». La même
        décision que l'aperçu du prompt, prise pour la même raison.

        Elle ne facture rien et n'enregistre rien — mais elle **refuse** ce que
        la soumission refuserait : une pose que la chose ne tient plus, une
        direction qu'elle ne tient pas pour cette pose. Un écran qui montrerait
        des cases qui ne partiraient pas serait pire qu'un écran vide.
        """
        return self._plier(projet, personnage, poses, piece, pose, directions)

    def image_jointe(
        self,
        projet: str | None,
        personnage: str | None,
        *,
        modele: str,
        pose: str | None = None,
        directions: Sequence[str] | None = None,
        poses: Sequence[str] | None = None,
        piece: str | None = None,
    ) -> tuple[str, bytes] | None:
        """L'image que la planche joint, **telle qu'elle partira** — et son rôle.

        **`_jointes` rendu public, et rien d'autre** (M4), pour la raison qui a
        déjà décidé de l'aperçu du prompt et des cases de la planche : la
        redessiner à l'écran en aurait fait une seconde vérité sur ce qui part.
        Celle-ci est la même image, par le même chemin, à l'octet près.

        **Elle ne coûte rien et n'enregistre rien.** Les deux sortes se
        redessinent du geste à chaque appel et ne s'écrivent jamais sur le
        disque ; les rendre en aperçu ne fait donc que refaire, gratuitement, ce
        que la soumission refera.

        Rien quand la planche ne joint aucune image — un appel sans lot, ou un
        modèle qui n'accepte aucune référence.
        """
        # **Le projet ouvert se lit ici comme partout ailleurs**, et pas à la
        # route : le défaut vit dans les services depuis T7.
        if projet is None and self._bibliotheque is not None:
            projet = self._bibliotheque.courant
        pliage = self._plier(projet, personnage, poses, piece, pose, directions)
        role = self._role_joint(pliage, modele)
        if role is None:
            return None
        octets = self._jointes(pliage, modele)
        if not octets:  # pragma: no cover — `_role_joint` vient d'en promettre une
            return None
        return role, octets[0]

    def _plier(
        self,
        projet: str | None,
        personnage: str | None,
        poses: Sequence[str] | None,
        piece: str | None = None,
        pose: str | None = None,
        directions: Sequence[str] | None = None,
    ) -> Pliage | None:
        """Les cases d'un lot, **vérifiées avant qu'un centime parte** (US-128).

        **Trois sortes de planches depuis E13**, et c'est ce qu'on lui donne qui
        les sépare : une pose dans plusieurs directions, plusieurs poses, ou une
        pièce posée sur plusieurs corps. Ce qu'aucune des trois ne fait, c'est
        porter deux choses du jeu — le paramètre `personnage` est unique, et la
        consigne d'une planche promet « le même sujet dans chaque case ».

        **Deux sortes de lots, et c'est la pièce qui les sépare** (C3). Sans
        pièce, la grille part vide et le lot crée N corps ; avec, elle part
        pleine des corps qui existent et le lot les habille. Le second est
        composé par le service d'équipement — lui seul sait quel corps va dans
        quelle case, et ce que la portée de la pièce laisse comme place.

        Rien en dessous de deux : une seule pose n'est pas un lot, c'est la
        génération de C1, et la plier ferait payer un gabarit et une consigne de
        grille pour une image que le produit sait déjà demander. Le seuil n'est
        pas un plafond — **il n'y en a pas** : la taille du lot est le choix de
        l'auteur, le produit annonce ce que ça coûte et ce qu'un compte faux
        coûterait (US-129).

        Chaque case passe par `viser`, comme la case unique de C1 et pour la
        raison exacte : l'écran ne coche que des poses visibles, mais un onglet
        resté ouvert pendant qu'on en décochait une enverrait sinon une image
        dans une case que personne ne regarde plus. **Une seule refuse, le lot
        entier ne part pas** — c'est mieux que de payer neuf images pour en
        ranger huit.

        Le texte d'une case est la **consigne** de la pose, pas son identifiant
        et — depuis E10 — pas son nom français non plus : il part dans le
        prompt, un repère de fichier n'a jamais décrit une attitude à un modèle,
        et un mot français au milieu d'une phrase anglaise se contredisait avec
        elle.
        """
        if piece:
            if not personnage or self._equipement is None or not projet:
                raise DemandeRefusee(
                    "une planche d'équipement se lance depuis un personnage — "
                    "une pièce se pose sur un corps, jamais sur rien"
                )
            return self._equipement.plier(projet, personnage, piece, poses or ())

        # **La planche d'une pose** (E13) : une case par direction demandée. Elle
        # est la plus petite planche qui vaille la peine d'exister — un jeu vu de
        # dessus réclame quatre directions par pose, et plier ne paie qu'à partir
        # de quatre. La coïncidence a décidé de tout.
        if pose and directions:
            if len(dict.fromkeys(directions)) < 2:
                # Une seule direction n'est pas une planche : c'est la case de
                # C1, et la plier ferait payer un gabarit et une consigne de
                # grille pour une image que le produit sait déjà demander.
                return None
            if not personnage or self._production is None or not projet:
                raise DemandeRefusee(
                    "une planche de pose se lance depuis un personnage — il n'y "
                    "a pas de cases à remplir sans lui"
                )
            cases = []
            for angle in dict.fromkeys(directions):
                # `viser` refuse ici ce qu'il refuse partout, et la direction
                # avec (E10) : une planche entière qui part dans une direction
                # que le personnage ne tient plus est une planche entière à
                # repayer.
                _, visee = self._production.viser(projet, personnage, pose, angle)
                cases.append(
                    CasePliee(
                        texte=self._texte_de_case(projet, visee, angle),
                        pose=visee.identifiant,
                        direction=angle,
                    )
                )
            return Pliage(cases=tuple(cases))

        if not poses or len(poses) < 2:
            return None
        if not personnage or self._production is None or not projet:
            raise DemandeRefusee(
                "un lot de poses se lance depuis un personnage — il n'y a pas "
                "de cases à remplir sans lui"
            )
        cases = []
        for identifiant in dict.fromkeys(poses):
            vise, visee = self._production.viser(projet, personnage, identifiant)
            # **Une pose qui ne réclame qu'une case sait laquelle** (E13, A-13).
            # Elle est *déduite*, jamais demandée : une pose qui ne tient qu'une
            # direction n'a pas de choix à offrir, et faire cocher à l'auteur la
            # seule case possible serait lui faire répéter ce que le plan dit
            # déjà. Deux directions tenues ou plus, et cette pose-là ne partage
            # pas une planche : elle a la sienne.
            angles = vise.directions_tenues(
                visee, self._production.directions_du_jeu(projet)
            )
            seule = angles[0].identifiant if len(angles) == 1 else None
            cases.append(
                CasePliee(
                    # **Ce qui s'écrit dans la case part en anglais** (E10,
                    # US-241) : `Pose.dit` rend la consigne écrite sur la pose,
                    # sinon celle que le produit propose pour une pose de cet
                    # identifiant-là, sinon le nom. Jusqu'ici, le nom français
                    # partait au milieu d'un prompt anglais.
                    texte=self._texte_de_case(projet, visee, seule),
                    pose=visee.identifiant,
                    direction=seule,
                )
            )
        return Pliage(cases=tuple(cases))

    def _texte_de_case(
        self, projet: str, visee: Any, direction: str | None
    ) -> str:
        """L'attitude d'une case, et l'angle sous lequel on la veut (E13).

        **Deux textes anglais, écrits chacun à un seul endroit** — celui de la
        pose dans le plan du jeu, celui de la direction dans la liste du projet —
        et mis bout à bout ici. C'est la promesse d'US-240, et c'est aussi ce qui
        rend le découpage possible : le modèle lit *facing north* dans la case en
        haut à gauche, et l'atelier sait que le morceau en haut à gauche va au
        nord.
        """
        if self._production is None or not direction:
            return visee.dit()
        trouvee = self._production.direction(projet, direction)
        return composer(visee.dit(), trouvee.consigne if trouvee else "")

    def _role_joint(
        self, pliage: Pliage | None, identifiant_modele: str
    ) -> str | None:
        """Le rôle de l'image que la planche ajoute, ou `None` si elle n'en ajoute
        aucune — **et c'est `_jointes` qui décide, pas une seconde condition**.

        Écrit pour R7 : nommer une image demande de savoir laquelle part, et la
        seule façon de ne jamais se tromper d'un rang est que la condition
        n'existe qu'une fois. `_jointes` la lit ici plutôt que de la refaire ;
        deux conditions écrites à deux endroits auraient fini par annoncer un
        gabarit que le modèle ne reçoit pas — l'entorse exacte que la tranche
        répare sur la bande de palette.

        **Elle ne dessine rien**, et c'est ce qui la rend appelable depuis
        l'aperçu : recomposer une planche d'équipement à chaque frappe du champ
        de prompt aurait relu N images de la bibliothèque pour écrire une ligne
        de texte.
        """
        if pliage is None:
            return None
        if self._catalogue.modele(identifiant_modele).references_max <= 0:
            return None
        if pliage.geometrie_connue and self._equipement is None:
            return None  # pragma: no cover — l'atelier le monte toujours
        # **Le choix lui-même vit dans `role_de_planche`, et nulle part
        # ailleurs** (M4) : le compte des images le refaisait pour son compte,
        # et l'écran annonçait un gabarit là où le texte demandait de modifier
        # une planche.
        role = role_de_planche(cases=pliage.nombre, piece=pliage.geometrie_connue)
        # **Un style local ne reçoit pas le gabarit** (relecture ML, défaut 1) :
        # « partir de cette image » repeindrait la grille vide, « garder ce
        # sujet » garderait une grille comme sujet. Le texte décrit la planche
        # (`texte_local.planche_courte`) ; l'écran dit que le gabarit reste.
        if role == GABARIT and self._genre_local(identifiant_modele):
            return None
        return role

    def _roles_qui_partent(
        self,
        partantes: Sequence[Reinjection],
        pliage: Pliage | None,
        identifiant_modele: str,
        palette_jointe: bool,
        *,
        mise_en_page: str | None = None,
    ) -> tuple[str, ...]:
        """Les rôles des images, **dans l'ordre exact où les octets partent** (R7).

        C'est l'ordre de `preparer` : les réinjections qui ont survécu au
        plafond du modèle, puis le gabarit ou la planche, puis la bande de
        couleurs. Le texte numérote les images d'après cette liste et rien
        d'autre ; l'écran de confirmation lit la même, ce qui est ce qui tient
        l'invariant d'E14 sur la numérotation comme il le tient sur le texte.

        **Une référence rangée se nomme par son usage** (RS1) : une planche du
        sujet devient `reference-planche`, une vue dans une direction
        `reference-direction:<id>`. L'ordre ne bouge pas d'un rang — c'est
        toujours la liste des réinjections, lue une fois, ici.

        **Et l'image dont on garde la mise en page se nomme planche à
        reproduire** (RS2) — `mise_en_page` porte son identifiant, choisi par
        `_source_de_mise_en_page` sur cette même liste.
        """
        roles = [
            REFERENCE_MISE_EN_PAGE
            if mise_en_page and r.asset == mise_en_page
            else _role_a_nommer(r)
            for r in partantes
        ]
        joint = self._role_joint(pliage, identifiant_modele)
        if joint is not None:
            roles.append(joint)
        if palette_jointe:
            roles.append(PALETTE)
        return tuple(roles)

    def _jointes(
        self, pliage: Pliage | None, identifiant_modele: str
    ) -> tuple[bytes, ...]:
        """L'image que la planche envoie avec l'appel — **et il y en a deux
        sortes, qui ne se ressemblent pas.**

        **La grille vide de C2 envoie un gabarit** : des cases dessinées d'un
        trait clair, pour dire au modèle où poser les N sujets qu'il va créer.

        **La grille pleine de C3 envoie la planche elle-même** — les corps
        déjà là, sur le fond plat du produit, et **rien d'autre** : ni ancre, ni
        mire, ni silhouette de repère, ni les traits du gabarit (`docs/archive/plan-versions-tenues.md`,
        C3). C'est un critère d'acceptation de la tranche, et il est vrai ici :
        le gabarit et la planche sont deux branches d'un `if`, jamais deux images
        qui partiraient ensemble.

        Les deux se **redessinent du geste** à la soumission comme à la relance,
        et aucune ne s'enregistre : les deux appels envoient donc exactement la
        même chose.

        **Mesuré, pas supposé** : compte exact 11 fois sur 12 avec gabarit contre
        9 sur 12 sans (`essais/essai_grille.py`, 28 août 2026). C'est ce qui en
        fait une pièce du produit et non un accessoire d'essai.

        Un modèle qui n'accepte aucune référence part **sans** — le prompt seul
        décrit la grille, et c'est le bras « libre » de l'essai, qui marche moins
        bien mais qui marche. Il n'est pas grisé pour autant : le grisé dit
        *cette chose est indisponible*, et celle-ci ne l'est pas — le modèle peut
        honorer la demande, un peu moins bien.

        **La condition vit dans `_role_joint`, et nulle part ailleurs** (R7) :
        c'est elle qui décide ici comme dans le texte qui nomme les images. Une
        image annoncée au modèle et jamais envoyée serait un mensonge qu'il ne
        peut pas vérifier.
        """
        role = self._role_joint(pliage, identifiant_modele)
        if role is None:
            return ()
        assert pliage is not None
        if role == PLANCHE_JOINTE:
            # **Sans référence possible, la planche ne part pas — et l'appel non
            # plus.** Le gabarit est un confort dont C2 peut se passer ; la
            # planche d'équipement *est* la demande. Un modèle qui n'accepte
            # aucune image ne peut donc pas habiller, et il est grisé par le
            # catalogue avant d'arriver ici (`Modele.refus`).
            assert self._equipement is not None
            return (self._equipement.planche(pliage),)
        return (reference(pliage),)

    # ── Le texte qui part, et l'univers qui l'habille ────────────────────────

    def lignes(
        self,
        sujet: str,
        *,
        repris: bool = False,
        projet: str | None = None,
        personnage: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        pliage: Pliage | None = None,
        tri: Tri | None = None,
        roles: Sequence[str] = (),
        # **Refaire une planche** (RS2) : le calage passe au pluriel, le cadre
        # cède sa place à la consigne de mise en page, la caméra cesse de primer.
        mise_en_page: bool = False,
    ) -> list[dict[str, Any]]:
        """Ce qui part, **une ligne par chose**, dans l'ordre de l'assemblage (E14).

        C'est le seul endroit du dépôt qui décide de ce que le prompt contient.
        L'écran de confirmation demande ces lignes-là, le prompt est leur
        jonction, et il n'y a donc pas deux textes possibles : « le texte montré
        vient du même chemin que l'envoi » cesse d'être une promesse pour devenir
        un fait mécanique.

        **Cinq groupes, dans l'ordre où le texte s'assemble.** Les sept textes
        du jeu — avec, mêlées, les trois lignes que l'ambiance remplace —, puis
        le sujet et la consigne de sa case, puis les consignes de planche quand
        l'appel part plié, puis **ce que les images jointes veulent dire**, puis
        **la caméra du jeu**. La bible se replie en tête depuis T4 (US-53) et les
        consignes de planche en queue parce qu'elles parlent du sujet décrit
        au-dessus.

        **Les deux derniers groupes sont arrivés le 1ᵉʳ septembre 2026, et leur
        place est la mesure** (`essais/essai_vue.py`, trente images payées). Un
        modèle d'image pondère la fin du texte ; la fin du texte était la
        consigne de pose, la seule phrase du prompt qui ne sait pas d'où le jeu
        regarde. Le rapport hauteur/largeur du sujet — deux pour un corps debout
        de face, un pour un corps vu d'aplomb — passe de 1,55 à 1,13 quand la
        caméra ferme le texte.

        **Le sujet et la pose ne s'éteignent pas** (US-278) : sans le premier
        l'appel ne demande rien, et sans la seconde l'image qui revient
        n'appartient à aucune case. Leur marque le dit — elles sont montrées,
        avec leur raison, jamais cachées.

        **Un texte repris n'a qu'une ligne, et c'est la vérité** : l'auteur a
        pris la main sur l'ensemble, donc il n'y a plus de bible d'un côté et de
        sujet de l'autre. Le découper aurait été une reconstitution, pas une
        lecture.
        """
        if repris:
            return [
                {
                    "clef": clef(SUJET, "repris"),
                    "groupe": SUJET,
                    "nom": "ton texte",
                    "texte": sujet,
                    "origine": REPRIS,
                    "allumee": True,
                    "eteignable": False,
                    "raison": "le texte est repris à la main — il part mot pour mot",
                    "remplace": "",
                    "remplacee_par": "",
                    "corrigee": False,
                    "gardable": False,
                }
            ]

        lignes: list[dict[str, Any]] = []
        if self._production is not None:
            lignes.extend(
                resoudre(
                    # **Le fond corrigé descend jusqu'à la case qui le porte**
                    # (D3). Il ne fabrique pas de ligne à lui : la case
                    # `technique` dit déjà le fond depuis que la phrase de calage
                    # le nomme, et lui en donner une seconde aurait fait partir
                    # la couleur deux fois dans le même texte.
                    self._production.couches(
                        projet, personnage, (tri or Tri()).fond
                    ),
                    tri,
                )
            )
            # **« single isolated sprite » ne part pas avec une planche à
            # refaire** (RS2) : la phrase de calage passe au pluriel, le fond et
            # la grille restent. Une ligne corrigée à la main est celle de
            # l'auteur, et elle part telle qu'il l'a écrite.
            if mise_en_page:
                for ligne in lignes:
                    if ligne["groupe"] == JEU and not ligne.get("corrigee"):
                        ligne["texte"] = calage_de_planche(str(ligne["texte"]))
        elif self._univers is not None and projet is not None:  # pragma: no cover
            # L'atelier monte toujours les deux services ensemble ; ce repli
            # existe pour les essais qui n'en montent qu'un.
            lignes.append(
                {
                    "clef": clef(JEU, "bible"),
                    "groupe": JEU,
                    "nom": "bible",
                    "texte": self._univers.prompt(projet),
                    "origine": DU_JEU,
                    "allumee": True,
                    "eteignable": True,
                    "remplace": "",
                    "remplacee_par": "",
                    "corrigee": False,
                    "gardable": False,
                }
            )

        tri = tri or Tri()
        signalement = tri.texte(clef(SUJET, "sujet"), sujet)
        lignes.append(
            {
                "clef": clef(SUJET, "sujet"),
                "groupe": SUJET,
                "nom": "sujet",
                "texte": signalement,
                "origine": DE_SA_FICHE if self._est_le_signalement(
                    projet, personnage, sujet
                ) else ECRIT_ICI,
                "allumee": True,
                "eteignable": False,
                "raison": "sans lui l'appel ne demande rien",
                "remplace": "",
                "remplacee_par": "",
                "corrigee": clef(SUJET, "sujet") in tri.textes,
                # Le signalement a une case où vivre : la fiche de la chose.
                "gardable": bool(personnage),
            }
        )

        # **La consigne de la case, écrite à part depuis E14.** Elle vivait dans
        # le champ, collée au signalement par `ServiceProduction.sujet` ; une
        # planche, elle, la portait déjà case par case. Les deux chemins
        # écrivaient donc la même phrase à deux endroits, et l'écran de
        # confirmation aurait dû deviner où finit le signalement.
        consigne = ""
        if pliage is None and personnage and pose and self._production is not None and projet:
            consigne = self._production.consigne_de_case(
                projet, personnage, pose, direction
            )
        if consigne:
            lignes.append(
                {
                    "clef": clef(SUJET, "pose"),
                    "groupe": SUJET,
                    "nom": "pose",
                    "texte": tri.texte(clef(SUJET, "pose"), consigne),
                    "origine": DE_LA_POSE,
                    "allumee": True,
                    "eteignable": False,
                    "raison": "elle dit dans quelle case l'image reviendra se ranger",
                    "remplace": "",
                    "remplacee_par": "",
                    "corrigee": clef(SUJET, "pose") in tri.textes,
                    # L'attitude et l'angle s'écrivent dans le codex, où ils
                    # servent à toutes les choses du jeu : « garder ici » n'aurait
                    # pas de case à cette chose-là où aller.
                    "gardable": False,
                }
            )

        if pliage is not None:
            lignes.append(
                {
                    "clef": clef(PLANCHE, "cases"),
                    "groupe": PLANCHE,
                    "nom": "les cases",
                    "texte": consignes(pliage),
                    "origine": DE_LA_PLANCHE,
                    "allumee": True,
                    "eteignable": False,
                    "raison": "c'est elle qui permettra de découper le retour",
                    "remplace": "",
                    "remplacee_par": "",
                    "corrigee": False,
                    "gardable": False,
                }
            )

        dites = self._dire_les_images(roles, pliage, projet)
        if dites:
            lignes.append(
                {
                    "clef": clef(JOINTES, "role"),
                    "groupe": JOINTES,
                    "nom": "les images jointes",
                    "texte": tri.texte(clef(JOINTES, "role"), dites),
                    "origine": DES_IMAGES,
                    "allumee": tri.etat(clef(JOINTES, "role"), True),
                    "eteignable": True,
                    "raison": "sans elle, l'image jointe décide toute seule",
                    "remplace": "",
                    "remplacee_par": "",
                    "corrigee": clef(JOINTES, "role") in tri.textes,
                    "gardable": False,
                }
            )

        # **Le cadre, juste avant la caméra** (1ᵉʳ septembre 2026). Il ne part
        # pas avec une planche, qui vient de demander plusieurs sujets dans une
        # grille — « un seul sprite et rien d'autre » la contredirait mot pour
        # mot. Mesuré : l'aire du sujet passe de 14,7 % à 20,1 % de l'image,
        # soit 37 % de pixels en plus avant le rééchantillonnage.
        cadre = ""
        if pliage is None and self._production is not None and not mise_en_page:
            cadre = self._production.cadre(projet)
        # **Ni lui avec une planche à refaire** (RS2) : « one single sprite and
        # nothing else » est exactement ce qui a fait rendre un seul Champy. La
        # consigne de mise en page prend sa place, juste avant la caméra — la
        # fin du texte, celle que le modèle pondère. Elle ne s'éteint pas : la
        # case cochée est son interrupteur, et l'éteindre ici laisserait partir
        # une planche que rien ne dit de reproduire.
        if mise_en_page:
            rang = next(
                (
                    i
                    for i, role in enumerate(roles, start=1)
                    if role == REFERENCE_MISE_EN_PAGE
                ),
                None,
            )
            lignes.append(
                {
                    "clef": clef(CADRAGE, "mise-en-page"),
                    "groupe": CADRAGE,
                    "nom": "la planche à refaire",
                    "texte": tri.texte(
                        clef(CADRAGE, "mise-en-page"),
                        consigne_de_mise_en_page(rang),
                    ),
                    "origine": DES_IMAGES,
                    "allumee": True,
                    "eteignable": False,
                    "raison": (
                        "la case « Garder la mise en page de la référence » est "
                        "cochée — décochez-la pour un sprite seul"
                    ),
                    "remplace": "",
                    "remplacee_par": "",
                    "corrigee": clef(CADRAGE, "mise-en-page") in tri.textes,
                    "gardable": False,
                }
            )
        if cadre:
            lignes.append(
                {
                    "clef": clef(CADRAGE, "cadre"),
                    "groupe": CADRAGE,
                    "nom": "le cadre",
                    "texte": tri.texte(clef(CADRAGE, "cadre"), cadre),
                    "origine": DU_PRODUIT,
                    "allumee": tri.etat(clef(CADRAGE, "cadre"), True),
                    "eteignable": True,
                    "raison": "c'est elle qui remplit l'image du sujet plutôt que de fond",
                    "remplace": "",
                    "remplacee_par": "",
                    "corrigee": clef(CADRAGE, "cadre") in tri.textes,
                    "gardable": False,
                }
            )

        # **La caméra ferme le texte, sauf quand on habille une planche.** Une
        # planche d'équipement dit « rends la même feuille avec la pièce en
        # plus, ne change rien d'autre » : lui redonner une caméra derrière
        # serait l'inviter à tout redessiner, ce qui est le défaut le plus cher
        # de C3.
        cadrage = ""
        if self._production is not None and not (
            pliage is not None and pliage.geometrie_connue
        ):
            cadrage = self._production.cadrage(projet, personnage)
        # Avec une planche à refaire, elle vaut pour chaque vue sans primer sur
        # la planche (RS2) — voir `camera_sous_la_planche`.
        if cadrage and mise_en_page:
            cadrage = camera_sous_la_planche(cadrage)
        if cadrage:
            lignes.append(
                {
                    "clef": clef(CADRAGE, "camera"),
                    "groupe": CADRAGE,
                    "nom": "la caméra du jeu",
                    "texte": tri.texte(clef(CADRAGE, "camera"), cadrage),
                    "origine": DE_LA_VUE,
                    "allumee": tri.etat(clef(CADRAGE, "camera"), True),
                    # **Éteignable, comme tout le reste** : un essai où l'on veut
                    # voir ce que le modèle fait sans elle est un geste légitime,
                    # et c'est aussi comme ça qu'on refait la mesure.
                    "eteignable": True,
                    "raison": "c'est elle qui décide de la vue, parce qu'elle est en dernier",
                    "remplace": "",
                    "remplacee_par": "",
                    "corrigee": clef(CADRAGE, "camera") in tri.textes,
                    # Elle s'écrit en changeant la vue du jeu, dans le codex, où
                    # elle sert à toutes les choses : « garder ici » n'aurait pas
                    # de case à cette chose-là où aller.
                    "gardable": False,
                }
            )
        return lignes

    def _dire_les_images(
        self,
        roles: Sequence[str],
        pliage: Pliage | None,
        projet: str | None = None,
    ) -> str:
        """Ce que les images jointes veulent dire — **une ligne par image** (R7).

        **Elles partaient muettes jusqu'au 1ᵉʳ septembre 2026**, puis en bloc
        jusqu'à R7. Le prompt ne les mentionnait nulle part, sauf pour une
        planche — vérifié : les deux seules phrases anglaises du dépôt qui
        parlaient d'une image jointe étaient dans `atelier/services/pliage.py`.
        Le modèle recevait donc une planche de quatre poses dessinées de face et
        un texte qui demandait le dessus, sans rien pour arbitrer. Il a fait la
        chose raisonnable : il a recopié ce qu'il voyait.

        **Ce que R7 change : le sac devient une liste.** Le produit écrivait
        « une ou plusieurs images de référence sont jointes » — une phrase par
        *sorte* d'image, jamais par image. Un artwork de style, un gabarit de
        découpe et un sprite de pose partaient donc dans le même sac, sans
        qu'une ligne dise lequel est lequel. Chaque image porte maintenant son
        rang et son rôle, dans l'ordre exact où les octets partent : `Image 1 —
        STYLE REFERENCE`, `Image 2 — THE SAME CHARACTER`, et ainsi de suite.

        **Le texte est celui du banc, mot pour mot** — `essais/socle_essais.py`,
        `lignes_de_nommage`. Il a été tiré le 2 septembre 2026 et il n'a pas
        amélioré le taux : zéro bonne planche sur quatre, contre deux pour le
        témoin. La tranche est reprise pour la relisibilité, et le texte est
        recopié plutôt que réécrit — pour qu'un tirage futur mesure la même
        chose que celui qui a déjà été payé.

        **Le rang est celui de l'envoi, et rien d'autre ne le fixe.** Il doit
        donc être calculé sur la liste qui part vraiment — celle d'après le
        plafond du modèle, d'après le dédoublonnage, et gabarit et bande de
        palette compris. Voir `_roles_qui_partent`, qui est le seul endroit où
        cette liste s'écrit ; un second endroit décalerait la numérotation d'un
        rang et nommerait chaque image par le rôle de sa voisine.

        **Un rôle inconnu lève.** Une image qu'on ne sait pas nommer ne doit pas
        partir sous un faux nom : mieux vaut un appel refusé qu'un modèle à qui
        l'on dit que le gabarit est le personnage.
        """
        nommees = self._nommer_les_images(
            roles,
            self._cases_du_pliage(pliage),
            angles=self._angles_nommes(projet, roles),
        )
        return "\n".join(texte for _, _, texte in nommees)

    @staticmethod
    def _cases_du_pliage(pliage: Pliage | None) -> int:
        """Combien de cases la grille porte, pour la ligne qui nomme le gabarit."""
        return 0 if pliage is None else pliage.nombre

    def _angles_nommes(
        self, projet: str | None, roles: Sequence[str]
    ) -> dict[str, str]:
        """La consigne anglaise de chaque direction qu'une image jointe montre
        (RS1) — *facing south, toward the viewer* plutôt que `sud`. Le jeu ne se
        relit que si une vue de direction part : c'est le cas rare."""
        if (
            self._production is None
            or not projet
            or not any(r.startswith(f"{REFERENCE_DIRECTION}:") for r in roles)
        ):
            return {}
        try:
            directions = self._production.directions_du_jeu(projet)
        except ErreurAtelier:
            return {}
        return {d.identifiant: d.consigne for d in directions if d.consigne}

    @staticmethod
    def _nommer_les_images(
        roles: Sequence[str],
        cases: int,
        *,
        angles: dict[str, str] | None = None,
    ) -> list[tuple[int, str, str]]:
        """Une ligne par image, numérotée dans l'ordre d'envoi, depuis son rôle.

        **Elle rend le rang et le rôle à côté du texte depuis M4**, et non le
        texte seul : l'écran de confirmation pose sous chaque image le morceau
        de légende qui la concerne, et il ne peut le faire qu'en sachant lequel.
        Le découper à l'écran, en recoupant le bloc sur ses retours à la ligne,
        aurait été une seconde vérité sur la numérotation — celle-là même que
        `_roles_qui_partent` existe pour empêcher. La légende, elle, part
        entière et inchangée : c'est du texte qui va au modèle.

        Recopié de `essais/socle_essais.py` — `lignes_de_nommage` —, à un rôle
        près : le banc levait sur `edition`, parce qu'aucun de ses tirages n'en
        portait. Le produit, lui, en retouche une image sur trois, et la taire
        laisserait la seule image dont tout le reste dépend sans nom au milieu
        d'une liste où toutes les autres en ont un.

        **Ce que la ligne d'édition dit, et ce qu'elle se garde de dire.**
        L'image qu'on retouche *est* la demande : lui interdire de copier sa
        mise en page serait exactement le contraire de ce qu'on veut, et c'est
        pour ça que le bloc entier se taisait avant R7. La ligne la nomme donc
        sans rien lui interdire.
        """
        lignes: list[tuple[int, str, str]] = []
        for rang, role in enumerate(roles, start=1):
            if role == STYLE:
                texte = (
                    f"Image {rang} — STYLE REFERENCE (an official artwork of this game): "
                    f"follow its colours, outfit, proportions and drawing style. Do NOT "
                    f"copy its pose, its camera angle or its layout."
                )
            elif role == REFERENCE:
                texte = (
                    f"Image {rang} — THE SAME CHARACTER, already drawn in the game's "
                    f"camera: keep it recognisably the same character in every cell."
                )
            elif role == REFERENCE_PLANCHE:
                # **Une planche se dit planche** (RS1). Décrite comme « le même
                # personnage », elle a fait rendre un seul Champy isométrique :
                # le modèle ne savait pas que les quatre silhouettes étaient une
                # seule chose vue sous quatre angles. La ligne ne dit rien du
                # cadrage à rendre — la demande plus bas s'en charge, qu'elle
                # veuille un sprite ou une planche.
                texte = (
                    f"Image {rang} — CHARACTER SHEET of the same character: several "
                    f"views of this one character, one per cell — every view is the "
                    f"same character seen from another angle. Use it for identity "
                    f"only (look, outfit, proportions); what to draw and how to frame "
                    f"it is given below."
                )
            elif role == REFERENCE_MISE_EN_PAGE:
                # **La planche à reproduire** (RS2). Pas seulement l'identité :
                # la mise en page même — combien de vues, dans quel ordre, avec
                # quel cadrage. La consigne de la demande la reprend en fin de
                # texte, sous son rang.
                texte = (
                    f"Image {rang} — THE CHARACTER SHEET TO REPRODUCE: redraw this "
                    f"same sheet — the same number of views, in the same order, with "
                    f"the same layout, framing and scale — changing only what the "
                    f"request below asks for. Every view is the same character."
                )
            elif role.startswith(f"{REFERENCE_DIRECTION}:"):
                # **Une vue rangée dans une direction se dit vue sous cet angle**
                # (RS1), avec la consigne du jeu pour cet angle-là — la phrase
                # même que la case reçoit, écrite une seule fois sur la
                # direction. Sans consigne, l'identifiant la nomme.
                angle = role.split(":", 1)[1]
                vu = (angles or {}).get(angle) or angle
                texte = (
                    f"Image {rang} — THE SAME CHARACTER, seen from this angle "
                    f"({vu}): keep it recognisably the same character, and use this "
                    f"view for how it looks from that side."
                )
            elif role == GABARIT:
                texte = (
                    f"Image {rang} — EMPTY LAYOUT GRID: {accorde(cases, 'cell')}. Draw "
                    f"exactly one sprite per cell, one instant of the motion per cell, "
                    f"in reading order. Do NOT draw the grid lines."
                )
            elif role == PLANCHE_JOINTE and cases <= 1:
                # **Une seule case n'est pas une feuille de contact** (M4), et la
                # nommer ainsi contredisait la consigne de planche du même
                # prompt, qui vient d'être réécrite pour ce cas-là.
                texte = (
                    f"Image {rang} — THE IMAGE TO CHANGE: the same character, already "
                    f"drawn. Keep it exactly where it is and change only what the "
                    f"request below asks for."
                )
            elif role == PLANCHE_JOINTE:
                texte = (
                    f"Image {rang} — THE SPRITE SHEET TO CHANGE: "
                    f"{accorde(cases, 'sprite')} of the "
                    f"same character, already drawn. Keep every cell where it is and "
                    f"change only what the request below asks for."
                )
            elif role == PALETTE:
                texte = (
                    f"Image {rang} — PALETTE STRIP: not a subject, only the colours to "
                    f"draw with."
                )
            elif role == EDITION:
                texte = (
                    f"Image {rang} — THE IMAGE TO EDIT: this is the picture the request "
                    f"below modifies. Keep everything it does not ask you to change."
                )
            else:  # pragma: no cover — la liste des rôles est close
                raise DemandeRefusee(
                    f"une image jointe porte un rôle que le texte ne sait pas nommer : "
                    f"{role!r}"
                )
            lignes.append((rang, role, texte))
        return lignes

    def _est_le_signalement(
        self, projet: str | None, personnage: str | None, sujet: str
    ) -> bool:
        """Ce qui est écrit dans le champ vient-il encore de la fiche ?

        **Déduit, jamais enregistré** : l'écran arme le champ avec le
        signalement de la chose, et l'auteur écrit par-dessus quand il veut. Un
        drapeau posé à l'armement aurait menti dès la première frappe.
        """
        if not projet or not personnage or self._production is None or not sujet:
            return False
        try:
            return self._production.sujet(projet, personnage) == sujet
        except ErreurAtelier:
            return False

    def parties(
        self, sujet: str, repris: bool, projet: str | None, pliage: Pliage | None
    ) -> list[dict[str, Any]]:
        """Les lignes, **groupées comme elles s'assemblent** (US-158, R7).

        Elle ne compose rien : elle groupe ce que `lignes` rend, ce qui garantit
        qu'une partie et sa ligne ne peuvent pas diverger. Depuis R7 les parties
        sont les trois du texte qui part — le contexte, les références, la
        demande —, et elles portent le titre que le fournisseur reçoit.
        """
        return parties(
            self.lignes(sujet, repris=repris, projet=projet, pliage=pliage)
        )

    def _interdit(
        self, projet: str | None, ecrit: str, tri: "Tri | None" = None
    ) -> str:
        """Le champ d'interdiction tel qu'il partira — **un seul endroit l'écrit**.

        Jumelle exacte de `_texte` un cran plus bas, et pour la raison exacte :
        l'écran de confirmation montre ce que cette méthode rend, et la
        soumission envoie ce que cette méthode rend. Deux compositions écrites à
        deux endroits auraient fini par montrer une interdiction et en envoyer
        une autre — sur le seul champ du produit que personne ne relit.

        Sans service de production — un essai qui n'en monte pas — il reste ce
        que l'auteur a écrit, ce qui est le comportement d'avant D3.
        """
        if self._production is None:
            return ecrit
        return self._production.interdit(projet, ecrit, (tri or Tri()).fond)

    def _texte(
        self,
        sujet: str,
        repris: bool,
        projet: str | None,
        pliage: Pliage | None,
        *,
        modele: str = "",
        personnage: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        tri: Tri | None = None,
        roles: Sequence[str] = (),
        mise_en_page: bool = False,
    ) -> str:
        """Les lignes allumées, jointes — **le seul endroit qui écrive le prompt**.

        La bible active se replie en tête (US-53) : « je veux que le style de mon
        univers parte avec chaque génération, afin de ne jamais le retaper ». Les
        consignes de planche se replient en queue, parce qu'elles parlent du
        *sujet décrit au-dessus* — les mettre avant obligerait à le nommer deux
        fois. Les deux se font **avant** l'enregistrement et avant l'appel, donc
        `generation.json` porte le prompt tel qu'il est parti : une génération se
        relit des mois après sans avoir à reconstituer l'univers du jour.
        """
        lignes = self.lignes(
            sujet,
            repris=repris,
            projet=projet,
            personnage=personnage,
            pose=pose,
            direction=direction,
            pliage=pliage,
            tri=tri,
            roles=roles,
            mise_en_page=mise_en_page,
        )
        local = self._texte_local(lignes, modele, pliage)
        return joindre(lignes) if local is None else local["texte"]

    # ── Un style local (ML4) ─────────────────────────────────────────────────

    def _profil_local(self, modele: str) -> dict[str, Any] | None:
        """Le profil de workflow que ce modèle désigne, ou rien."""
        if self._profils is None or not modele.startswith("ComfyUI:"):
            return None
        try:
            return self._profils.de_modele(modele)
        except WorkflowRefuse:
            return None

    def _negatif_lu(self, modele: str) -> bool:
        """Le texte négatif atteindra-t-il le modèle ? Un fournisseur distant le
        replie dans sa demande ; un workflow local ne le lit que relié."""
        profil = self._profil_local(modele)
        return profil is None or "prompt_negatif" in profil["liaisons"]

    def _texte_local(
        self, lignes: list[dict[str, Any]], modele: str, pliage: Pliage | None
    ) -> dict[str, Any] | None:
        """Le texte d'un style local, composé des lignes mêmes que `joindre` lit
        — ou rien, et c'est `joindre` qui compose : **un modèle payant reçoit
        exactement le texte d'avant ML4**."""
        profil = self._profil_local(modele)
        if profil is None or not profil.get("style"):
            return None
        planche = ""
        if pliage is not None and not pliage.geometrie_connue:
            planche = texte_local.planche_courte(
                pliage.colonnes, pliage.lignes, (c.texte for c in pliage.cases)
            )
        return texte_local.composer(
            lignes,
            profil["style"],
            negatif_lu="prompt_negatif" in profil["liaisons"],
            planche=planche,
        )

    # **Le projet ne se lit qu'une fois pour composer** (M3). Composer un aperçu
    # d'équipement le relisait quarante-deux fois : chaque petit service appelé
    # ici le redemande pour son compte, et aucun ne sait ce que le voisin vient
    # de lire. La portée est posée en décoration plutôt qu'en `with` autour du
    # corps pour que la réparation se lise d'un coup d'œil — et qu'elle ne se
    # perde pas dans un décalage de deux cents lignes.
    @projet_lu_une_fois()
    def apercu(
        self,
        sujet: str,
        *,
        repris: bool = False,
        projet: str | None = None,
        personnage: str | None = None,
        poses: Sequence[str] | None = None,
        piece: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        directions: Sequence[str] | None = None,
        tri: "Tri | None" = None,
        echelle: str = "",
        modele: str = "",
        references: Sequence[Reinjection] = (),
        references_ecartees: Sequence[str] | None = None,
        palette: bool = False,
        prompt_negatif: str = "",
        # **Refaire une planche** (RS2) — même refus et même texte qu'à la
        # soumission : l'écran ne montre jamais un texte qui ne partirait pas.
        garder_mise_en_page: bool = False,
    ) -> dict[str, Any]:
        """Le texte exact qui partira, **sans rien préparer ni rien facturer**.

        C'est `preparer` privé de tout ce qui coûte : ni clé, ni catalogue, ni
        enregistrement, ni fournisseur. Il ne reste que la composition — et c'est
        exactement la même, appelée par le même chemin, ce qui est toute la
        valeur de l'aperçu. Un aperçu recomposé à l'écran aurait été une seconde
        vérité sur ce qui part, et « deux vérités sur la même chose finissent par
        diverger ».

        **Les cases du lot sont vérifiées ici aussi**, parce que `_plier` est ce
        qui les nomme : leur texte est le nom des poses, et il part dans le
        prompt. Le refus est donc le même avant et à la soumission — l'aperçu ne
        montre jamais un texte qui ne partirait pas.

        **Et depuis le 1ᵉʳ septembre 2026 il connaît les images**, parce que le
        prompt les nomme. Les cinq derniers arguments sont ceux que l'écran de
        confirmation a déjà sous la main ; sans eux — un appel d'essai, un
        dépliant — l'aperçu compose comme si rien n'était joint, ce qui reste
        vrai pour un modèle sans place de référence.
        """
        if projet is None and self._bibliotheque is not None:
            projet = self._bibliotheque.courant
        pliage = self._plier(projet, personnage, poses, piece, pose, directions)
        if garder_mise_en_page:
            _mise_en_page_permise(pliage, piece, pose, direction)
        roles: tuple[str, ...] = ()
        if modele:
            partantes, _ = self._reinjections(
                projet,
                personnage,
                piece,
                echelle,
                references,
                references_ecartees,
                modele,
                direction=direction,
                directions=directions,
                mise_en_page=garder_mise_en_page,
            )
            # **Exactement la liste de `preparer`, par la même fonction** (R7) :
            # gabarit ou planche, puis bande de couleurs, dans l'ordre où les
            # octets partent. Sans ça l'écran montrerait un texte plus court que
            # celui qui part, ou pire, numéroterait les images autrement — et
            # l'invariant d'E14 tomberait sur le seul point que R7 ajoute.
            roles = self._roles_qui_partent(
                partantes,
                pliage,
                modele,
                self._bande_jointe(palette, projet, personnage, modele),
                mise_en_page=_source_de_mise_en_page(
                    garder_mise_en_page, partantes, references
                ),
            )
        lignes = self.lignes(
            sujet,
            repris=repris,
            projet=projet,
            personnage=personnage,
            # Une planche porte ses consignes case par case : la pose ne fait
            # alors pas de ligne à elle, et `_plier` l'a déjà vérifiée.
            pose=None if pliage is not None else pose,
            direction=direction,
            pliage=pliage,
            tri=tri,
            roles=roles,
            mise_en_page=garder_mise_en_page,
        )
        # **Un style local lit les mêmes lignes, jointes autrement** (ML4) : une
        # seule partie sans titre, et ce qui n'y entre pas est dans `local`.
        local = self._texte_local(lignes, modele, pliage) if modele else None
        return {
            "texte": joindre(lignes) if local is None else local["texte"],
            # **Les trois parties, telles qu'elles partent** (R7). L'écran de
            # confirmation les montre séparément et n'en recompose aucune : le
            # texte entier est leur jonction, et il est rendu juste au-dessus.
            "parties": parties(lignes) if local is None else [
                {
                    "clef": DEMANDE,
                    "titre": "",
                    "nom": "le texte du style",
                    "propos": "déclencheur, sujet et jeu en raccourci — ce qu'un modèle local lit",
                    "texte": local["texte"],
                    "repris": any(l.get("origine") == REPRIS for l in lignes),
                }
            ],
            # `None` pour tout modèle qui n'est pas un style local. Sinon : les
            # segments dans l'ordre, ce qui est retiré et pourquoi, les jetons
            # comptés et la limite (SDXL seul), et si le négatif sera lu.
            "local": local,
            # **Une ligne par chose qui part** (E14). Le même appel sert le
            # dépliant d'hier et l'écran de confirmation : deux routes auraient
            # rouvert la question de savoir laquelle dit vrai.
            "lignes": lignes,
            # **La légende, découpée par image** (M4). Le bloc entier part au
            # modèle et se lit tel quel dans le texte ci-dessus ; celui-ci est le
            # même texte, rendu **rang par rang**, pour que l'écran pose sous
            # chaque image le morceau qui la concerne. Le recouper à l'affichage
            # aurait été une seconde vérité sur la numérotation.
            "nommage": [
                {"rang": rang, "role": role, "texte": texte}
                for rang, role, texte in self._nommer_les_images(
                    roles,
                    self._cases_du_pliage(pliage),
                    angles=self._angles_nommes(projet, roles),
                )
            ],
            # ── Le fond, et ce qu'il interdit (D3) ───────────────────────────
            #
            # **Le fond résolu, pour que l'écran montre la couleur sur laquelle
            # il travaille** — celle du jeu, ou celle qu'on vient de corriger
            # pour cet appel. Il est *déjà* dans le texte, dans la case
            # `technique` : ce champ ne le double pas, il le nomme, pour que
            # l'écran puisse en dessiner la pastille sans relire de l'anglais.
            "fond": self._interdit_fond(projet, tri),
            # **Et l'interdiction telle qu'elle partira**, dans l'autre champ de
            # la demande. C'est le seul morceau de ce qui part que le texte ne
            # contient pas ; sans cette ligne, l'écran qui promet de tout montrer
            # aurait un angle mort — et ce serait celui que la tranche vient
            # d'ouvrir.
            "interdiction": (
                self._interdit(projet, prompt_negatif, tri)
                if self._negatif_lu(modele)
                else ""
            ),
            # **Le négatif sera-t-il lu ?** Faux, l'écran ne le propose pas.
            "negatif_lu": self._negatif_lu(modele),
        }

    def _interdit_fond(self, projet: str | None, tri: "Tri | None") -> str:
        """La couleur de fond de cet appel-ci, résolue par la production."""
        if self._production is None:
            return ""
        return self._production.fond(projet, (tri or Tri()).fond)

    def _sous_le_plafond(
        self,
        reinjectes: tuple[Reinjection, ...],
        nommees: set[str],
        identifiant_modele: str,
        du_sujet: set[str] | frozenset[str] = frozenset(),
    ) -> tuple[tuple[Reinjection, ...], tuple[Reinjection, ...]]:
        """Ce qui part, et ce que le plafond du modèle laisse au sol (F6).

        **Ce que le produit ajoute de lui-même cède ; ce que l'auteur a joint ne
        cède jamais.** `nommees` porte les identifiants que l'appelant a
        désignés — l'auteur depuis l'écran, l'agent depuis son outil —, et
        ceux-là gardent leur sens : s'ils ne tiennent pas, le modèle est refusé
        comme avant, parce qu'on a demandé qu'ils partent. Les autres viennent du
        produit — les concept arts du personnage, les images de son ambiance, les
        artworks du jeu — et ils cèdent **par la fin**, ce qui les fait tomber du
        plus large au plus étroit : l'artwork du jeu d'abord, puis l'image que
        l'ambiance apporte, puis le concept art désigné pour *ce* personnage-là.
        C'est l'ordre d'assemblage lu à l'envers, et c'est le même classement du
        large à l'étroit que les portées de US-126.

        **La panne que ça répare.** Un modèle gratuit n'accepte aucune image
        d'entrée. Avant F6, un jeu qui avait un seul artwork officiel refusait
        donc tout appel chez lui — *« n'accepte aucune image de référence »* —,
        et l'agent forcé sur le gratuit n'aurait rien pu produire. Le garde-fou
        aurait été éteint le jour même, ce qui est la façon la plus sûre de
        perdre un garde-fou.

        **Rien ne se perd en silence** : ce qui cède est enregistré sur la
        génération, l'écran de confirmation le montre avant de lancer, et la
        fiche de l'image le dit des mois plus tard.

        **Un style local ne lit pas tout ce que le produit ajoute** (relecture
        ML, défaut 1 — la même règle 4, appliquée au *sens* des places et plus
        seulement à leur nombre). « Partir de cette image » repeint **une**
        image : seule celle que l'auteur a jointe peut l'être — un artwork du
        jeu repeint n'est pas une image du sujet demandé. « Garder ce sujet »
        garde le sujet de chaque image : celles du sujet visé (`du_sujet` :
        concept arts, références promues) en ont un ; un artwork du jeu ou une
        image d'ambiance n'est pas ce sujet-là. Ce qui ne peut pas servir cède
        comme ce qui dépasse, dans `hors_plafond`, montré et relu pareil.
        """
        if self._catalogue is None:
            return reinjectes, ()
        try:
            places = self._catalogue.modele(identifiant_modele).references_max
        except ErreurAtelier:
            # Un modèle inconnu se refuse quelques lignes plus bas, avec sa
            # phrase à lui. Ici, on ne décide rien.
            return reinjectes, ()

        genre = self._genre_local(identifiant_modele)
        if genre is not None:
            lisibles = set(nommees) if genre == DEPART else set(nommees) | set(du_sujet)
            lues = tuple(r for r in reinjectes if r.asset in lisibles)
            partent, _ = self._plafond_ordinaire(lues, nommees, places)
            gardees = {(r.origine, r.asset) for r in partent}
            # Dans l'ordre d'assemblage, comme ce que le plafond laisse au sol.
            return partent, tuple(
                r for r in reinjectes if (r.origine, r.asset) not in gardees
            )
        return self._plafond_ordinaire(reinjectes, nommees, places)

    @staticmethod
    def _plafond_ordinaire(
        reinjectes: tuple[Reinjection, ...], nommees: set[str], places: int
    ) -> tuple[tuple[Reinjection, ...], tuple[Reinjection, ...]]:
        """Le plafond de F6, tel quel : ce qui dépasse cède par la fin, ce que
        l'appelant a nommé ne cède jamais."""
        if len(reinjectes) <= places:
            return reinjectes, ()

        incompressibles = tuple(r for r in reinjectes if r.asset in nommees)
        cedent = tuple(r for r in reinjectes if r.asset not in nommees)
        gardees = max(0, places - len(incompressibles))
        # **On repasse par l'ordre d'assemblage** — `_reinjectes` a dédoublonné,
        # donc un identifiant d'asset désigne une réinjection et une seule, et
        # la liste enregistrée reste celle qu'on lit à l'écran de confirmation.
        garde = {r.asset for r in incompressibles + cedent[:gardees]}
        return (
            tuple(r for r in reinjectes if r.asset in garde),
            cedent[gardees:],
        )

    def _reinjections(
        self,
        projet: str | None,
        personnage: str | None,
        piece: str | None,
        echelle: str,
        references: Sequence[Reinjection],
        references_ecartees: Sequence[str] | None,
        identifiant_modele: str,
        *,
        direction: str | None = None,
        directions: Sequence[str] | None = None,
        mise_en_page: bool = False,
    ) -> tuple[tuple[Reinjection, ...], tuple[Reinjection, ...]]:
        """Ce qui part en image, et ce que le plafond laisse au sol.

        **Sorti de `preparer` le 1ᵉʳ septembre 2026**, quand le prompt s'est mis
        à parler des images jointes : l'aperçu doit alors savoir ce qui part
        *avant* de composer le texte, exactement comme la soumission. Deux
        compositions écrites à deux endroits auraient fini par montrer un texte
        qui annonce une image que l'appel n'envoie pas — et c'est précisément la
        divergence que l'aperçu existe pour interdire.

        **Quatre sources, dans cet ordre, puis le dédoublonnage** : ce que
        l'auteur a posé à la main, ce que le personnage désigne (US-124), ce que
        son ambiance apporte (E14), et les artworks de la famille du sujet.
        L'ordre décide du rôle gardé en cas de doublon, et le plafond du modèle
        se compte après.

        **Les références promues se choisissent selon le contexte** (RS1) : la
        direction de la case, ou la planche de ses directions. Voir
        `_contexte_des_references`, que le compte de l'écran lit aussi.
        """
        planche, angle = _contexte_des_references(
            direction, directions, mise_en_page=mise_en_page
        )
        concepts = self._concepts(
            projet,
            personnage,
            piece,
            planche=planche,
            direction=angle,
            sans_concept_arts=mise_en_page,
        )
        reinjectes = _reinjectes(
            tuple(references)
            + concepts
            + self._de_lambiance(projet, personnage)
            + self._artworks(echelle, projet)
        )
        # **Puis ce qui est écarté** (US-126). La portée de la génération, quand
        # elle a un avis, décide **seule** : c'est la plus étroite, et c'est la
        # règle affichée à l'écran. Sans avis — un agent, une relance —, les
        # deux portées durables s'appliquent.
        hors_images = (
            set(references_ecartees)
            if references_ecartees is not None
            else set(self._ecartees_durables(projet, personnage))
        )
        reinjectes = tuple(r for r in reinjectes if r.asset not in hors_images)
        # **Puis le plafond du modèle** (F6). Ce que le produit ajoute de
        # lui-même cède ; ce que l'auteur a joint ne cède jamais.
        return self._sous_le_plafond(
            reinjectes,
            {r.asset for r in references},
            identifiant_modele,
            du_sujet={r.asset for r in concepts},
        )

    def _artworks(self, echelle: str, projet: str | None) -> tuple[Reinjection, ...]:
        """Les artworks que le sujet demandé fait partir (US-51).

        Le sujet est une échelle du barème du projet, et elle porte sa famille.
        Un nom d'échelle inconnu est refusé par le service d'univers plutôt que
        corrigé : un onglet resté ouvert après un renommage enverrait sinon les
        artworks d'une autre famille sans que rien ne le dise.
        """
        if self._univers is None or projet is None:
            return ()
        lue = self._univers.echelle(projet, echelle)
        return self._univers.references(projet, lue.famille if lue else None)

    def compter_references(
        self,
        projet: str | None,
        echelle: str,
        manuelles: Sequence[Reinjection] = (),
        personnage: str | None = None,
        cases: int = 0,
        piece: str | None = None,
        # **Ce que cette génération-ci écarte** (E14). Absent, les portées
        # durables décident, comme pour un agent ; présent, il décide seul,
        # parce que c'est la portée la plus étroite. C'est ce qui permet à
        # l'écran de confirmation de compter ce qui part **après** qu'on a
        # décoché, et non ce qui partirait si l'on n'avait rien touché.
        ecartees_ici: Sequence[str] | None = None,
        palette: bool = False,
        # **Le contexte qui choisit les références rangées** (RS1) — le même
        # que celui de la soumission, lu par la même fonction. Absents, seules
        # les références libres partent, comme avant la tranche.
        direction: str | None = None,
        directions: Sequence[str] | None = None,
        # Refaire une planche emporte la planche du sujet (RS2), ici comme à la
        # soumission.
        mise_en_page: bool = False,
        # **Le modèle, pour un style local seulement** (relecture ML, défaut
        # 1) : ce qu'il ne sait pas lire ne part pas, et le compte le dit. Pour
        # tout autre modèle — ou absent —, le compte est celui d'avant.
        modele: str | None = None,
    ) -> dict[str, Any]:
        """Ce qui partira, **ligne par ligne, avec sa provenance** (US-52, US-127).

        **Le compte vient du serveur, comme le grisé.** L'écran tient les
        réinjections que l'auteur a posées, mais pas les artworks — c'est
        l'application qui les choisit —, ni les concept arts du personnage, ni
        le dédoublonnage entre les trois. Deux comptes calculés à deux endroits
        finiraient par se contredire, et celui qui compte est celui qui part.

        C1 y ajoute la **liste**, parce qu'annoncer un coût sans montrer ce qui
        le fait n'est utile qu'à moitié : chaque ligne dit d'où elle vient, et
        si quelque chose l'écarte, à quelle portée. Le total, lui, ne compte que
        ce qui part vraiment — c'est lui qui décide du grisé du modèle.
        """
        artworks = self._artworks(echelle, projet)
        planche, angle = _contexte_des_references(
            direction, directions, mise_en_page=mise_en_page
        )
        concepts = self._concepts(
            projet,
            personnage,
            piece,
            planche=planche,
            direction=angle,
            sans_concept_arts=mise_en_page,
        )
        de_lambiance = self._de_lambiance(projet, personnage)
        ecartees = (
            self._production.ecartees(projet, personnage)
            if self._production is not None and projet
            else {}
        )
        # **Le mode de l'ambiance écarte comme les deux autres portées** (E14) :
        # une chose qui prend *les couleurs seulement* n'envoie pas les images de
        # son ambiance, et la ligne le dit plutôt que de disparaître.
        for carte in de_lambiance:
            if carte.asset in ecartees:
                continue
            if REFERENCES not in prises_du_mode(
                self._production.prend_de(projet, personnage)
                if self._production is not None
                else ""
            ):
                ecartees[carte.asset] = "son ambiance — elle n'en prend pas les images"
        # Puis l'avis de cette génération-ci, qui décide seul quand il existe.
        if ecartees_ici is not None:
            retenus = set(ecartees_ici)
            ecartees = {
                asset: "décoché pour cet appel"
                for asset in retenus
            }

        toutes = _reinjectes(
            tuple(manuelles) + concepts + de_lambiance + artworks
        )
        echelle_lue = (
            self._univers.echelle(projet, echelle) if self._univers and echelle else None
        )
        designes = set(self._concepts_identifiants(projet, personnage, piece))
        # **Les images promues sont une quatrième provenance** (E12), et elle a
        # son mot : « réinjection » dit *l'auteur l'a posée pour cet appel*, ce
        # qu'une image promue n'est pas — elle part avec **tous** les appels de
        # sa chose, et c'est ce qui la rend décochable en connaissance de cause.
        #
        # **Et depuis RS1 elle nomme son usage** — « image promue · planche »,
        # « image promue · direction sud » —, lu sur la réinjection même qui
        # part : celles que le contexte laisse sur la fiche n'ont pas de ligne,
        # puisqu'elles ne partent pas. Une libre reste « image promue ».
        promues = {
            r.asset: r.usage for r in concepts if r.origine == ASSET
        }
        # **Cinquième provenance depuis E14** : une image que l'ambiance apporte.
        # Elle n'est ni un artwork du jeu — elle ne concerne que ce coin-là — ni
        # un concept art épinglé sur la chose : la corriger là-bas la corrige
        # pour tout ce qui s'en sert, et c'est ce que le mot doit dire.
        siennes = set(r.asset for r in de_lambiance)
        # **Sixième provenance depuis `RP9`** : une carte que l'auteur a prise
        # sur la toile, pour cet appel-ci. Elle se reconnaît à ce qu'elle est
        # **dans ce que l'appelant a nommé** — les trois autres sources de
        # cartes, elles, sont posées par l'application. Sans ce test, une carte
        # choisie à la main se lisait « artwork officiel », c'est-à-dire le
        # contraire de ce qui vient de se passer.
        de_la_toile = {r.asset for r in manuelles if r.origine == CARTE}

        lignes = [
            {
                "asset": r.asset,
                "role": r.role,
                "origine": r.origine,
                # **La provenance, nommée** (US-127) : « comprendre pourquoi elle
                # part avant de décider de la retirer ». Six sources, six
                # phrases, et jamais un mot que l'écran devrait interpréter.
                "provenance": (
                    "carte de la toile"
                    if r.origine == CARTE and r.asset in de_la_toile
                    else "image de son ambiance"
                    if r.asset in siennes
                    else "concept art"
                    if r.origine == CARTE and r.asset in designes
                    else "artwork officiel"
                    if r.origine == CARTE
                    else self._provenance_promue(projet, promues[r.asset])
                    if r.asset in promues
                    else "réinjection"
                ),
                # La portée qui l'écarte, ou rien. C'est **la portée retenue**,
                # celle qui décide — pas la liste de celles qui ont un avis.
                "ecartee_par": ecartees.get(r.asset),
            }
            for r in toutes
        ]
        retenues = [ligne for ligne in lignes if not ligne["ecartee_par"]]

        # **Le gabarit compte dans le total, et il a sa propre ligne.**
        # C'est une image qui part vraiment : elle occupe une place dans le
        # plafond du modèle et elle coûte chez ceux qui facturent au token
        # (`docs/PIEGES.md`). L'oublier ferait mentir le grisé au moment précis
        # où l'appel est le plus cher.
        #
        # **Il n'entre pas dans `lignes`**, et c'est délibéré : cette liste-là
        # est celle des images que l'auteur peut décocher (US-126), et le
        # gabarit n'en est pas une — le décocher reviendrait à demander une
        # planche sans dire à quoi elle ressemble. Une ligne qu'on ne peut pas
        # défaire dans une liste de cases à cocher serait une case grisée dont
        # personne ne comprendrait la raison.
        # Une planche d'équipement en envoie une aussi — et c'est la planche
        # elle-même, pas un gabarit. Elle compte pareil : une place dans le
        # plafond du modèle, et un coût chez ceux qui facturent au token. Dès
        # **une** case, parce qu'une planche d'une seule pose reste une planche.
        #
        # **Le rôle part avec le compte depuis M4**, et il vient du même endroit
        # que celui du texte : ce compte-ci rendait un nombre, l'écran n'avait
        # donc pas de quoi choisir ses mots, et il annonçait *un gabarit à
        # remplir* pendant que le texte demandait de *modifier la planche
        # existante* — deux demandes opposées pour une seule image, au moment
        # précis où l'on décide de payer.
        role_joint = role_de_planche(cases=cases, piece=bool(piece))
        gabarit = 1 if role_joint else 0

        # **La bande de couleurs compte comme le gabarit**, et pour les mêmes
        # deux raisons : elle occupe une place dans le plafond du modèle, et elle
        # coûte chez ceux qui facturent au token. Elle **est** décochable, elle —
        # c'est une option de l'écran de confirmation, pas une condition de
        # l'appel —, mais sa case vit dans les options et non dans la liste des
        # images, où l'auteur ne saurait pas quelle image il décoche.
        bande = 1 if (palette and self._couleurs(projet, personnage)) else 0

        # **Un style local, lu par les mêmes fonctions que l'envoi** (relecture
        # ML, défaut 1). `_sous_le_plafond` dit ce qui part ; ce qui part est
        # toujours le début de la liste (l'auteur, puis le sujet, puis le
        # reste), donc un nombre de places suffit à l'écran pour griser pareil.
        # Le gabarit et la bande ne partent pas, et ils sont nommés.
        style_local: dict[str, Any] | None = None
        genre = self._genre_local(modele) if modele else None
        if genre is not None:
            retenues_r = tuple(r for r in toutes if not ecartees.get(r.asset))
            partent, _ = self._sous_le_plafond(
                retenues_r,
                {r.asset for r in manuelles},
                modele,
                du_sujet={r.asset for r in concepts},
            )
            ne_partent_pas: list[dict[str, str]] = []
            if role_joint == GABARIT:
                ne_partent_pas.append({"role": GABARIT, "nom": "le gabarit de la grille"})
                role_joint, gabarit = None, 0
            if bande:
                ne_partent_pas.append({"role": PALETTE, "nom": "la bande de couleurs"})
                bande = 0
            maximum = self._catalogue.modele(modele).references_max
            style_local = {
                "reference": genre,
                "references_max": maximum,
                "places": min(len(partent), maximum),
                "ajoutees_ecartees": len(retenues_r) - len(partent),
                "ne_partent_pas": ne_partent_pas,
            }

        return {
            # Ce qui part vraiment — donc ce qui décide du grisé.
            "total": len(retenues) + gabarit + bande,
            # **Ce qui ne cède pas devant le plafond d'un modèle** (F6). Ce que
            # l'appelant a nommé, plus le gabarit et la bande de couleurs, qui
            # *sont* la demande plutôt qu'un ornement : une planche sans son
            # gabarit n'est pas la même planche. Le reste — artworks, concept
            # arts, images d'ambiance — cède, et la génération enregistre ce qui
            # a cédé. C'est **ce chiffre-ci** qui décide du grisé d'un modèle,
            # pas le total : le total dit ce qu'on aimerait envoyer, celui-ci
            # dit ce qu'on ne peut pas ne pas envoyer.
            "incompressibles": len({r.asset for r in manuelles}) + gabarit + bande,
            "gabarit": gabarit,
            # **Laquelle des deux, en toutes lettres** (M4) — `gabarit` dit
            # *combien*, celui-ci dit *laquelle*, et l'écran ne peut plus
            # inventer la phrase qui manque.
            "role_joint": role_joint,
            "palette": bande,
            # **Posée à la main**, et une carte de la toile l'est depuis `RP9` :
            # le test ne peut donc plus être « ce n'est pas une carte ».
            "manuelles": sum(
                1
                for l in retenues
                if l["origine"] != CARTE or l["asset"] in de_la_toile
            ),
            "artworks": sum(
                1 for l in retenues if l["provenance"] == "artwork officiel"
            ),
            "concepts": sum(1 for l in retenues if l["provenance"] == "concept art"),
            "ambiance": sum(
                1 for l in retenues if l["provenance"] == "image de son ambiance"
            ),
            "famille": echelle_lue.famille if echelle_lue else None,
            # Les écartées y sont **aussi**, et elles le disent : une ligne qui
            # disparaîtrait ne laisserait aucun moyen de la remettre.
            "lignes": lignes,
            # Absente hors d'un style local : le compte d'avant, clé pour clé.
            **({"style_local": style_local} if style_local else {}),
        }

    # ── L'ambiance, et ce que cet appel-là lui prend (E14) ───────────────────

    def _ambiance_de(self, projet: str | None, personnage: str | None) -> str | None:
        """Le lot de style que cette chose désigne, ou rien."""
        if self._production is None or not projet or not personnage:
            return None
        return self._production.couches(projet, personnage).ambiance_nom or None

    def _de_lambiance(
        self, projet: str | None, personnage: str | None
    ) -> tuple[Reinjection, ...]:
        """Les images de référence que l'ambiance apporte (E14).

        En rôle `style`, comme les artworks et les concept arts : elles
        **inspirent**, elles n'engendrent pas. Ce sont des cartes du tableau —
        une ambiance ne contient aucune image, elle en désigne.

        **Elles sont toujours listées, même quand la chose ne les prend pas** :
        c'est `_ecartees_durables` qui les retire alors, avec les autres écartées,
        et l'écran de confirmation peut donc les rallumer pour un appel. Les
        omettre ici les aurait rendues invisibles, et une image qu'on ne voit pas
        ne se coche pas.
        """
        if self._production is None or not projet or not personnage:
            return ()
        return tuple(
            Reinjection(asset=carte, role=STYLE, origine=CARTE)
            for carte in self._production.references_de_lambiance(projet, personnage)
        )

    def _bande(
        self,
        demande: Demande,
        projet: str | None,
        personnage: str | None,
        identifiant_modele: str,
    ) -> tuple[bytes, ...]:
        """La palette en image, quand la case est cochée (E14).

        **En image et jamais en texte** : une liste de codes couleur est mal
        suivie par les modèles, et elle allongerait un texte qui pèse déjà la
        moitié de l'appel. Celle de l'ambiance quand une ambiance en désigne
        une, celle du jeu sinon — c'est la même règle que la vitrine applique
        pour ses fonds, et il n'y a pas deux palettes qui s'appliquent à une
        chose.

        Un modèle qui n'accepte aucune référence part sans, comme pour le
        gabarit : la case reste cochée, elle ne trouve simplement pas de place.

        **La condition vit dans `_bande_jointe`, et nulle part ailleurs** (R7).
        C'est une entorse à E14 qui a été réparée en la déplaçant : le texte
        annonçait « une image jointe est une bande de couleurs » dès que la case
        était cochée, alors qu'un jeu sans palette ou un modèle sans place n'en
        envoie aucune. On annonçait donc au modèle une image qu'il ne recevait
        pas.
        """
        if not self._bande_jointe(
            demande.palette, projet, personnage, identifiant_modele
        ):
            return ()
        return (bande_de_palette(self._couleurs(projet, personnage)),)

    def _bande_jointe(
        self,
        cochee: bool,
        projet: str | None,
        personnage: str | None,
        identifiant_modele: str,
    ) -> bool:
        """La bande de couleurs part-elle vraiment ? Voir `_bande`."""
        if not cochee:
            return False
        if not self._couleurs(projet, personnage):
            return False
        # Une bande de pastilles n'est ni une image de départ ni un sujet à
        # garder : elle ne part vers aucun style local (relecture ML, défaut 1).
        if self._genre_local(identifiant_modele):
            return False
        return self._catalogue.modele(identifiant_modele).references_max > 0

    def _genre_local(self, identifiant_modele: str) -> str | None:
        """Le genre de référence d'un style local — `DEPART` ou
        `SUJET_A_GARDER` —, ou `None` pour tout autre modèle, distant ou
        workflow importé à la main, dont rien ne change."""
        if self._catalogue is None:
            return None
        try:
            modele = self._catalogue.modele(identifiant_modele)
        except ErreurAtelier:
            return None
        if not modele.locale or modele.reference not in (DEPART, SUJET_A_GARDER):
            return None
        return modele.reference

    def _couleurs(
        self, projet: str | None, personnage: str | None
    ) -> tuple[str, ...]:
        """Les couleurs qui s'appliquent à cette chose — l'ambiance, sinon le jeu."""
        if self._production is None or not projet:
            return ()
        return self._production.couleurs_de(projet, personnage)

    def _pris(
        self,
        projet: str | None,
        personnage: str | None,
        demande: Demande,
        reinjectes: Sequence[Reinjection],
        pose: str | None,
        direction: str | None,
        tri: "Tri | None",
    ) -> tuple[str, ...]:
        """Ce que cet appel a **réellement** pris à l'ambiance (E14).

        Constaté sur ce qui part, jamais recopié du réglage durable : les
        couleurs si la bande est partie et qu'elle venait de l'ambiance, les
        images si l'une des siennes a survécu aux écartées, les textes si l'une
        de ses trois lignes est restée allumée.

        **Sans lui, « ce qui est montré est ce qui part » cesserait d'être vrai
        en relisant une vieille image** : le réglage durable aura changé,
        l'ambiance aura été retouchée, et rien ne dirait plus d'où venait le
        monde qu'on lit dans le prompt.
        """
        if self._production is None or not projet or not personnage:
            return ()
        couches = self._production.couches(projet, personnage)
        if not couches.ambiance_nom:
            return ()
        siennes = set(self._production.references_de_lambiance(projet, personnage))
        pris: list[str] = []
        if demande.palette and self._production.palette_de_lambiance(projet, personnage):
            pris.append(COULEURS)
        if siennes and any(r.asset in siennes for r in reinjectes):
            pris.append(REFERENCES)
        if any(
            ligne["groupe"] == AMBIANCE and ligne["allumee"]
            for ligne in resoudre(couches, tri)
        ):
            pris.append(TEXTES)
        return tuple(pris)

    def _ecartees_durables(
        self, projet: str | None, personnage: str | None
    ) -> tuple[str, ...]:
        """Ce que le projet et le personnage ont écarté — les deux portées qui
        s'écrivent, **plus ce que le mode de l'ambiance retire** (E14). Celle de
        la génération ne s'écrit nulle part : elle vit dans l'onglet et part avec
        l'appel.

        Le mode est un réglage durable au même titre que les deux autres : une
        chose qui prend *les couleurs seulement* n'envoie pas les images de son
        ambiance, et un agent qui n'a pas d'écran devant lui doit obtenir la même
        chose que l'auteur qui n'a touché à rien.
        """
        if self._production is None or not projet:
            return ()
        ecartees = tuple(self._production.ecartees(projet, personnage))
        if not personnage:
            return ecartees
        if REFERENCES in prises_du_mode(self._production.prend_de(projet, personnage)):
            return ecartees
        return ecartees + tuple(
            self._production.references_de_lambiance(projet, personnage)
        )

    def _concepts_identifiants(
        self, projet: str | None, personnage: str | None, piece: str | None = None
    ) -> tuple[str, ...]:
        """Ce que le personnage désigne, **et ce que la pièce désigne avec lui**.

        Deux désignateurs, une seule liste, dédoublonnée en aval comme les trois
        sources de références : habiller un nain d'un casque envoie les concept
        arts du nain *et* ceux du casque, et l'auteur les décoche ligne par ligne
        comme les autres (US-126).
        """
        if self._production is None or not projet:
            return ()
        designes = self._production.concept_arts(projet, personnage)
        if piece and self._equipement is not None:
            designes = designes + self._equipement.concept_arts(projet, piece)
        return tuple(dict.fromkeys(designes))

    def _concepts(
        self,
        projet: str | None,
        personnage: str | None,
        piece: str | None = None,
        *,
        planche: bool = False,
        direction: str | None = None,
        sans_concept_arts: bool = False,
    ) -> tuple[Reinjection, ...]:
        """Les concept arts du personnage visé, et de la pièce (US-124).

        **Pas quand on refait une planche** (18 septembre 2026, à la demande de
        l'auteur). La planche à reproduire porte déjà l'allure du sujet ; un
        concept art en plus ne dit rien de neuf, coûte une image, et tire vers
        une autre pose que celle qu'on recopie.

        En rôle `style`, comme les artworks : ils **inspirent**, ils
        n'engendrent pas — une carte en source d'édition donnerait une filiation
        vers un objet que la bibliothèque ne connaît pas.

        **Et les images promues avec eux** (E12), en rôle `reference` : celles-là
        ne disent pas *voilà l'allure*, elles disent *voilà le sujet*. C'est ce
        qui fait qu'un personnage se ressemble d'une pose à l'autre, et c'est la
        correction du frottement le plus cher du dépôt — dix-sept appels payés
        sur vingt-huit étaient partis sans une seule image.

        **Pas toutes les promues : celles de ce contexte** (RS1). Les libres
        partent toujours ; une planche, une vue dans une direction ne partent que
        là où elles servent. L'usage voyage sur la réinjection — vide pour une
        libre, pour que ce qui partait avant parte à l'identique.
        """
        return tuple(
            Reinjection(asset=identifiant, role=STYLE, origine=CARTE)
            for identifiant in (
                () if sans_concept_arts
                else self._concepts_identifiants(projet, personnage, piece)
            )
        ) + tuple(
            Reinjection(
                asset=identifiant,
                role=REFERENCE,
                origine=ASSET,
                usage="" if usage == LIBRE else usage,
            )
            for identifiant, usage in self._promues(
                projet, personnage, planche=planche, direction=direction
            )
        )

    def _promues(
        self,
        projet: str | None,
        personnage: str | None,
        *,
        planche: bool = False,
        direction: str | None = None,
    ) -> tuple[tuple[str, str], ...]:
        """Les images que cette chose du jeu a promues en référence permanente,
        **et qui partent dans ce contexte**, avec leur usage (RS1). La règle vit
        sur le domaine, à un seul endroit."""
        if self._production is None or not projet or not personnage:
            return ()
        return tuple(
            self._production.references_du_contexte(
                projet, personnage, planche=planche, direction=direction
            )
        )

    def _provenance_promue(self, projet: str | None, usage: str) -> str:
        """« image promue », suivie de son usage quand elle en a un (RS1)."""
        if not usage or self._production is None or not projet:
            return "image promue"
        nom = self._production.nom_de_lusage(projet, usage)
        return f"image promue · {nom}" if nom else "image promue"

    def _octets_references(
        self, identifiants, projet: str | None = None, *, fond: str | None = None
    ) -> tuple[bytes, ...]:
        """Les images réinjectées, relues à la source (US-12).

        **Et posées sur le fond de l'appel quand elles sont transparentes** (18
        septembre 2026). Un rendu détouré garde du noir sous ses pixels
        transparents, et un modèle d'image ne lit pas l'alpha : il voyait donc
        la planche de Champy **sur fond noir**, et, prié d'en reproduire la mise
        en page, il a rendu du noir alors que le texte demandait #FF70B5. Posée
        sur le fond demandé, l'image dit la même chose que le texte ; sans fond
        réglé, un gris neutre plutôt que ce noir que personne n'a choisi.

        Deux sources depuis T4, et `origine` aiguille : un asset se relit dans la
        bibliothèque, une carte dans le tableau de son projet.

        **Les deux manques ne se traitent pas pareil, et c'est une décision.**

        - Un **asset** disparu arrête l'appel avant qu'il ne parte : c'est
          l'image que l'auteur a choisie de montrer, et payer une génération à
          laquelle il manque exactement ça n'a pas de sens.
        - Un **artwork** disparu est sauté, et l'appel part. Un artwork
          *inspire* ; il n'est pas choisi appel par appel mais par une promotion
          faite une fois. Le refuser rendrait **toutes** les générations passées
          d'un univers non relançables au premier artwork qu'on retire du
          tableau — or « retirer un artwork officiel » est un geste courant que
          la tranche encourage (US-55). Une relance repart alors avec l'univers
          tel qu'il est aujourd'hui, ce qui est aussi ce que l'auteur attend.
        """
        if not identifiants:
            return ()
        octets: list[bytes] = []
        for reinjection in identifiants:
            if reinjection.origine == CARTE:
                if self._univers is None or projet is None:
                    continue
                try:
                    octets.append(
                        self._univers.octets_reference(projet, reinjection.asset)
                    )
                except ErreurAtelier:
                    continue
                continue
            if self._assets is None:
                continue
            try:
                octets.append(self._assets.reference(reinjection.asset))
            except AssetInconnu:
                raise DemandeRefusee(
                    "une image réinjectée n'est plus dans la bibliothèque — "
                    "la rechoisir avant de relancer"
                ) from None
        if fond is None:
            return tuple(octets)
        return tuple(sur_le_fond(image, fond) for image in octets)

    def _fond_des_references(
        self, modele: str, projet: str | None, tri: "Tri | None"
    ) -> str | None:
        """Le fond sur lequel poser une référence transparente, ou rien.

        **Rien pour un workflow importé à la main** : ComfyUI reçoit l'image
        avec sa transparence, la file locale la garde telle quelle, et c'est le
        moteur qui la pose sur blanc au dépôt (ML1).

        **Le fond du jeu pour un style local** (relecture ML, défaut 8), comme
        pour un modèle distant depuis 99b88c5 : « partir de cette image »
        repeint aussi le fond, et une image de départ sur blanc sous un texte qui
        demande #FF00FF rendait du blanc que le détourage du retour ne connaît
        pas. « Garder ce sujet » suit la même règle : Klein recopie ce qu'il
        voit autour du sujet, et le fond qu'il voit doit être celui que le texte
        demande. Sans fond réglé, le gris neutre de `sur_le_fond`.
        """
        if self._genre_local(modele):
            return self._interdit_fond(projet, tri)
        if modele.startswith("ComfyUI:"):
            return None
        return self._interdit_fond(projet, tri)

    # ── Enregistrement ───────────────────────────────────────────────────────

    def _sauver(self, generation: Generation, *, annoncer: bool = True) -> None:
        """Au fil de l'eau, jamais à la fin — sinon un plantage perd ce qui est
        déjà payé (`docs/PIEGES.md`).

        **Écrire d'abord, annoncer ensuite.** Ce qui est annoncé est donc
        toujours déjà sur le disque : un onglet qui reçoit l'événement puis
        redemande la génération ne peut pas tomber sur un état plus ancien.
        """
        contenu = generation.en_json()
        # **Le fichier d'abord, l'index ensuite** — voir `ServiceAssets.sauver`.
        # Une coupure entre les deux lignes laisse alors l'index en retard sur
        # le disque, ce que la reconstruction rattrape ; dans l'autre ordre,
        # elle laisserait le disque en retard sur l'index, ce que rien ne
        # rattrape et qui met l'invariant à l'envers.
        self._fichiers.ecrire_enregistrement(generation.identifiant, contenu)
        self._base.enregistrer(generation)
        if annoncer:
            self._diffusion.publier("generation", contenu)

    @staticmethod
    def _resolus(
        modele: Modele, demande: Demande, gardees: dict[str, Any]
    ) -> dict[str, Any]:
        """Ce qui part réellement — en vocabulaire du produit, pas en JSON HTTP."""
        return {
            "modele": modele.identifiant,
            "proportions": (
                demande.proportions if demande.proportions in modele.proportions else None
            ),
            "resolution": (
                demande.resolution if demande.resolution in modele.resolutions else None
            ),
            "references": len(demande.references),
            "options": gardees,
            "prompt_negatif_replie": bool(demande.prompt_negatif.strip()),
        }


def _contexte_des_references(
    direction: str | None,
    directions: Sequence[str] | None,
    *,
    mise_en_page: bool = False,
) -> tuple[bool, str | None]:
    """**Ce que l'appel vise, lu pour choisir les références rangées** (RS1) —
    `(planche, direction)`.

    Écrit une fois pour les deux chemins qui en ont besoin : la soumission
    (`_reinjections`) et le compte de l'écran (`compter_references`). Deux
    lectures du contexte auraient fini par montrer une planche jointe que
    l'appel n'envoie pas.

    - **Deux directions ou plus** : c'est la planche d'une pose (E13), et elle
      emporte la planche du sujet.
    - **Une seule** — `direction`, ou une liste d'un seul angle, qui n'est pas
      une planche (voir `_plier`) : c'est une case dans cette direction.
    - **Aucune** : ni planche, ni direction, et rien de typé ne part.

    Un lot de plusieurs poses et une planche d'équipement ne passent pas par
    `directions` : ils restent sans contexte typé, et n'emportent que les
    libres — la règle du plan ne les nomme pas, et ils partaient ainsi hier.

    - **Refaire une planche** (RS2, `mise_en_page`) : c'est une planche, et elle
      emporte la planche du sujet — la décision 2 du plan, qui la nommait déjà.
    """
    if mise_en_page:
        return True, None
    distinctes = tuple(dict.fromkeys(d for d in (directions or ()) if d))
    if len(distinctes) >= 2:
        return True, None
    return False, direction or (distinctes[0] if distinctes else None)


def _mise_en_page_permise(
    pliage: Pliage | None,
    piece: str | None,
    pose: str | None,
    direction: str | None,
) -> None:
    """**Refaire une planche est un appel d'une image fixe** (RS2) — refusé
    ailleurs, avant tout paiement.

    - **Un lot plié** a déjà sa grille, son gabarit et ses consignes de case :
      deux mises en page dans le même appel se contrediraient.
    - **Une pièce** habille une planche que l'atelier compose lui-même.
    - **Une case visée** attend une image, une seule : la planche refaite s'y
      rangerait entière, dans une seule direction.

    Refuser plutôt qu'ignorer : une case cochée qui ne ferait rien laisserait
    partir « one single sprite » alors que l'auteur a demandé le contraire.
    """
    if pliage is not None or piece:
        raise DemandeRefusee(
            "garder la mise en page refait une planche en un seul appel — elle ne "
            "se combine ni avec un lot de cases ni avec une pièce d'équipement"
        )
    if pose or direction:
        raise DemandeRefusee(
            "garder la mise en page rend une planche entière, qui ne se range pas "
            "dans une seule case — ne visez aucune pose pour cet appel"
        )


def _source_de_mise_en_page(
    garder: bool,
    partantes: Sequence[Reinjection],
    manuelles: Sequence[Reinjection],
) -> str | None:
    """**L'image dont l'appel garde la mise en page** (RS2) — ou le refus.

    Choisie sur ce qui **part vraiment** (après le plafond et les décochées),
    jamais sur ce qui est rangé : nommer au modèle une planche qui ne part pas
    serait le mensonge que `_roles_qui_partent` existe pour empêcher.

    1. **La référence `planche` du sujet** — le contexte « planche » vient de la
       faire partir (`_contexte_des_references`).
    2. **Sinon la première image jointe à la main**, en référence ou en édition.
       Une carte de style n'en est pas une : sa ligne dit justement de ne pas en
       copier la mise en page.
    3. **Sinon rien ne peut servir de modèle**, et l'appel est refusé avant de
       payer — la génération 26f07741 avait une planche jointe à la main, c'est
       le cas que le repli couvre.
    """
    if not garder:
        return None
    for r in partantes:
        if r.role == REFERENCE and r.usage == USAGE_PLANCHE:
            return r.asset
    envoyees = {r.asset for r in partantes}
    for r in manuelles:
        if r.role in (REFERENCE, EDITION) and r.asset in envoyees:
            return r.asset
    raise DemandeRefusee(
        "garder la mise en page demande une planche : rangez une référence en "
        "planche sur la fiche du sujet, ou joignez l'image à reproduire"
    )


def _role_a_nommer(reinjection: Reinjection) -> str:
    """Le rôle qu'une image porte **dans le texte** (RS1).

    Une référence rangée reste une `reference` sur le fil et dans le journal ;
    seul son nom change, pour que le modèle sache qu'une planche est une
    planche et qu'une vue est une vue.
    """
    if reinjection.role != REFERENCE or not reinjection.usage:
        return reinjection.role
    if reinjection.usage == USAGE_PLANCHE:
        return REFERENCE_PLANCHE
    angle = direction_de_lusage(reinjection.usage)
    if angle:
        return f"{REFERENCE_DIRECTION}:{angle}"
    return reinjection.role


def _reinjectes(references: Sequence[Reinjection]) -> tuple[Reinjection, ...]:
    """L'ordre dans lequel les images repartent, et sans doublon.

    La source d'édition ouvre la liste, parce que c'est elle qu'on édite. Chaque
    asset n'y figure qu'une fois : un fournisseur qui reçoit deux fois la même
    image la compte deux fois dans son plafond de références — et la facture
    deux fois chez ceux qui facturent au token.

    **Une seule source d'édition par appel**, et le refus le dit plutôt que de
    choisir à la place de l'auteur : deux images éditées ensemble donneraient
    une filiation à deux parents, que le modèle d'objets ne porte pas et que
    rien à l'écran ne saurait montrer.
    """
    editions = [r for r in references if r.role == EDITION]
    if len(editions) > 1:
        raise DemandeRefusee("on n'édite qu'une image à la fois")
    ordonnees = editions + [r for r in references if r.role != EDITION]
    # **La clé est le couple, pas l'identifiant seul.** Depuis T4 deux familles
    # d'images partent par ce tuyau — un asset de la bibliothèque et une carte
    # du tableau —, et elles ne se nomment pas dans le même espace. Dédoublonner
    # sur l'identifiant seul ferait taire une carte parce qu'un asset porte le
    # même nom, ce qui n'arrive jamais et qui, le jour où ça arriverait, ne se
    # verrait qu'en comptant les images reçues au bout du port.
    vus: set[tuple[str, str]] = set()
    propres: list[Reinjection] = []
    for reinjection in ordonnees:
        cle = (reinjection.origine, reinjection.asset)
        if cle not in vus:
            vus.add(cle)
            propres.append(reinjection)
    return tuple(propres)


# ── Le fond sous une référence transparente ──────────────────────────────────

#: Le fond d'une référence quand l'appel n'en demande aucun : un gris neutre,
#: jamais le noir que le détourage laisse sous ses pixels transparents.
FOND_NEUTRE = "#808080"


def sur_le_fond(octets: bytes, fond: str = "") -> bytes:
    """Une référence **posée sur le fond de l'appel** quand elle est transparente.

    Un modèle d'image ne lit pas l'alpha : ce qu'il voit sous un pixel
    transparent, c'est la couleur qui y dort — du noir, après un détourage. Une
    image opaque, ou illisible, repart telle qu'elle est venue.
    """
    try:
        with Image.open(io.BytesIO(octets)) as image:
            image.load()
            if "A" not in image.getbands() and image.info.get("transparency") is None:
                return octets
            rgba = image.convert("RGBA")
    except (OSError, ValueError):
        return octets
    if rgba.getchannel("A").getextrema()[0] == 255:
        return octets
    couleur = ImageColor.getrgb(fond_valide(fond) or FOND_NEUTRE)
    pose = Image.new("RGBA", rgba.size, (*couleur, 255))
    pose.alpha_composite(rgba)
    tampon = io.BytesIO()
    pose.convert("RGB").save(tampon, format="PNG")
    return tampon.getvalue()
