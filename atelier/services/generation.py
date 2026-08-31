# -*- coding: utf-8 -*-
"""Générer — soumettre, suivre, retrouver.

**La génération vit côté serveur dès cette tranche** (`docs/PLAN.md`, T1) :
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
import time
import uuid
from dataclasses import replace
from typing import Any, Callable, Sequence

from atelier.depot import Base, Fichiers
from atelier.domaine import (
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
from atelier.domaine.generation import ASSET, AUTEUR, CARTE, EDITION, REFERENCE, STYLE
from atelier.domaine.direction import composer
from atelier.domaine.ambiance import COULEURS, REFERENCES, TEXTES, prises_du_mode
from atelier.domaine.envoi import (
    AMBIANCE,
    DE_LA_PLANCHE,
    DE_LA_POSE,
    DE_SA_FICHE,
    DU_JEU,
    ECRIT_ICI,
    JEU,
    PLANCHE,
    REPRIS,
    SUJET,
    Tri,
    clef,
    en_blocs,
    joindre,
    resoudre,
)
from atelier.domaine.pliage import CasePliee, Pliage
from atelier.fournisseur import PortFournisseur
from atelier.image import bande_de_palette, empreinte_de, mesurer
from atelier.image.mesures import extension
from atelier.reglages import lire_cle
from atelier.domaine.asset import Asset
from atelier.services.assets import AssetInconnu, ServiceAssets
from atelier.services.catalogue import ServiceCatalogue
from atelier.services.evenements import Diffusion
from atelier.services.equipement import ServiceEquipement
from atelier.services.pliage import CompteFaux, ServicePliage, consignes, reference
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
        fabrique_fournisseur: Callable[[], PortFournisseur],
        diffusion: Diffusion | None = None,
        assets: ServiceAssets | None = None,
        bibliotheque: "ServiceBibliotheque | None" = None,
        univers: "ServiceUnivers | None" = None,
        production: "ServiceProduction | None" = None,
        pliage: "ServicePliage | None" = None,
        equipement: "ServiceEquipement | None" = None,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._catalogue = catalogue
        self._fournisseur = fabrique_fournisseur
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

    def chantier(self, limite: int = 200) -> list[Generation]:
        """Les générations dont **un emplacement attend encore une issue**.

        C'est ce qui tient sa place dans la grille à côté de la bibliothèque :
        ce qui part, ce qui tourne, et ce qu'un redémarrage a coupé — celui-là
        garde son coût et attend un geste, jamais une relance automatique
        (US-17, US-18).

        Un emplacement **échoué**, lui, n'attend rien : sa réponse est arrivée,
        c'était non. Il reste visible dans l'onglet qui l'a vu échouer — c'est
        là qu'on décide de relancer — mais il ne s'installe pas : la
        bibliothèque relue ne le contient pas (US-23), et l'appel, avec son
        coût réel, reste au journal du projet (US-24).

        Le tri se fait ici et non en SQL parce que le statut d'une génération
        est celui de **l'ensemble** de ses emplacements : un lot où une image
        est arrivée est « réussi » même si sa voisine a été coupée.
        """
        en_suspens = (Statut.EN_ATTENTE, Statut.EN_COURS, Statut.INTERROMPUE)
        return [
            generation
            for generation in self._base.recentes(limite)
            if any(e.statut in en_suspens for e in generation.emplacements)
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
        """
        return mesures_de_prix(self._base, identifiant_modele)

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

        empreinte = empreinte_de(octets)
        if not forcer:
            deja = self._deja_importe(projet, empreinte)
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
            modele=IMPORT,
            # Le nom du fichier fait le label, par `_label` : c'est le seul
            # texte qu'un import apporte, et c'est celui que l'auteur cherchera
            # dans la grille. `traiter` et l'empreinte y sont aussi : la
            # première décide de ce que l'asset reçoit à sa naissance, la
            # seconde de ce qu'un import suivant reconnaîtra comme doublon — et
            # les deux doivent survivre à l'effacement de l'index.
            demande={
                "prompt": nom,
                "variations": 1,
                "source": nom,
                "traiter": traiter,
                "empreinte": empreinte,
            },
            parametres_resolus={"modele": IMPORT, "source": nom},
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

    def _deja_importe(self, projet: str | None, empreinte: str) -> Asset | None:
        """L'asset importé qui porte déjà ces octets-là, ou rien.

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
        for generation in self._base.generations_du_modele(IMPORT, projet):
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
        if pliage is None and personnage and self._production is not None and projet:
            self._production.viser(projet, personnage, pose or "", direction)

        if pliage is not None and demande.variations > 1:
            raise DemandeRefusee(
                "un lot plié part en un seul appel — c'est tout son intérêt, "
                "et les variations ne s'y appliquent pas"
            )

        # **Le texte tel qu'il partira, et un seul endroit le compose** (US-158).
        # `_texte` est aussi ce que l'aperçu du champ de prompt montre avant de
        # lancer : deux compositions écrites à deux endroits finiraient par
        # diverger, et celle qui compte est celle qui part.
        demande = replace(
            demande,
            prompt=self._texte(
                demande.prompt,
                demande.repris,
                projet,
                pliage,
                personnage=personnage,
                pose=pose,
                direction=direction,
                tri=tri,
            ),
        )
        # **Quatre sources, dans cet ordre, puis le dédoublonnage** : ce que
        # l'auteur a posé à la main, ce que le personnage désigne (US-124), ce
        # que son ambiance apporte (E14), et les artworks de la famille du sujet.
        # L'ordre décide du rôle gardé en cas de doublon, et le plafond du modèle
        # se compte après.
        reinjectes = _reinjectes(
            tuple(references)
            + self._concepts(projet, personnage, piece)
            + self._de_lambiance(projet, personnage)
            + self._artworks(demande, projet)
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
        demande = replace(
            demande,
            references=self._octets_references(reinjectes, projet)
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

        refus = modele.refus(demande)
        if refus is not None:
            raise DemandeRefusee(f"{modele.nom} {refus}")

        if not lire_cle():
            raise SansCle()

        gardees, ecartees = modele.retenir(demande.options)
        generation = Generation(
            identifiant=identifiant,
            modele=modele.identifiant,
            demande=demande.resume(),
            parametres_resolus=self._resolus(modele, demande, gardees),
            ecartees=ecartees,
            emplacements=[Emplacement(rang=r) for r in range(demande.variations)],
            cree_le=time.time(),
            projet=projet,
            references=reinjectes,
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

        if not lire_cle():
            raise SansCle()

        modele = self._catalogue.modele(generation.modele)
        demande = self._demande_de(generation)

        emplacement.statut = Statut.EN_ATTENTE
        emplacement.raison = None
        self._sauver(generation)

        fournisseur = self._fournisseur()
        tache = asyncio.create_task(
            self._executer_emplacement(
                generation, emplacement, modele, demande, fournisseur
            )
        )
        self._en_vol.add(tache)
        tache.add_done_callback(self._en_vol.discard)
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
            await asyncio.gather(*tuple(self._en_vol), return_exceptions=True)

    # ── L'exécution ──────────────────────────────────────────────────────────

    async def _executer(
        self, generation: Generation, modele: Modele, demande: Demande
    ) -> None:
        """Un emplacement, un appel, tous en parallèle.

        Les plafonds du fournisseur sont larges — 50 requêtes par minute sur
        GPT-Image-2. Quatre variations partent ensemble, pas l'une après l'autre.
        """
        fournisseur = self._fournisseur()
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
    ) -> None:
        emplacement.statut = Statut.EN_COURS
        emplacement.demarre_le = time.time()
        emplacement.duree_attendue_s = self.attente_estimee(modele.identifiant)
        self._sauver(generation)

        depart = time.monotonic()
        try:
            image = await fournisseur.generer(modele, demande)
            mesure = mesurer(image.octets)
        except ErreurAtelier as erreur:
            # Un refus peut coûter : le fournisseur facture dès que l'appel a
            # atteint le modèle. Ce montant part au journal du projet (US-24).
            self._echouer(
                generation,
                emplacement,
                erreur.raison,
                depart,
                cout_usd=getattr(erreur, "cout_usd", 0.0),
            )
            return
        except ValueError as erreur:  # image illisible
            self._echouer(generation, emplacement, str(erreur), depart)
            return
        except Exception as erreur:  # noqa: BLE001 — un raté ne tue jamais le lot
            self._echouer(generation, emplacement, f"échec inattendu — {erreur}", depart)
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
        emplacement.cout_usd = image.cout_usd
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
        cout_usd: float = 0.0,
    ) -> None:
        """Un appel raté garde son coût : il reste lisible dans le journal (US-24)."""
        emplacement.statut = Statut.ECHOUEE
        emplacement.raison = raison
        emplacement.cout_usd = cout_usd
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
            references=self._octets_references(generation.references, generation.projet)
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

    # ── Les jeux de réglages nommés ──────────────────────────────────────────

    def reglages(self) -> dict[str, Any]:
        """Les jeux de réglages enregistrés (US-134).

        « Enregistrer sous un nom ce qui part en référence et les réglages d'une
        génération, afin de rejouer la même recette sur un autre personnage sans
        la reconstituer. » C'est le **quatrième rôle** d'une réinjection, déclaré
        en T1 et resté vide depuis : *jeu de réglages* — le seul des quatre qui
        n'envoie aucune image, et qui repeuple le générateur au lieu de partir
        avec l'appel (`atelier/domaine/generation.py` § Les rôles).
        """
        return self._fichiers.lire_prereglages()

    def nommer_reglages(self, nom: str, contenu: dict[str, Any]) -> dict[str, Any]:
        """Ce qui part et comment, sous un nom — **et rien de qui**.

        Le personnage, ses poses et le prompt n'y sont pas, et c'est toute la
        promesse : *se rappeler d'un geste sur un autre personnage*. Un jeu de
        réglages qui porterait le personnage serait un jeu de réglages qu'on ne
        pourrait rejouer que sur lui.

        **Rien n'est validé ici**, et c'est délibéré : un modèle qui a disparu
        du catalogue, un asset supprimé depuis, une option qu'un modèle ne
        déclare plus — tout cela se grise **au moment de générer**, avec sa
        raison, exactement comme si l'auteur venait de le choisir à la main. Un
        refus à l'enregistrement aurait fait un second endroit qui juge une
        demande, et il aurait fini par ne plus dire la même chose que le premier.
        """
        propre = nom.strip()
        if not propre:
            raise DemandeRefusee("un jeu de réglages a besoin d'un nom")
        enregistres = self._fichiers.lire_prereglages()
        enregistres[propre] = {
            "modele": contenu.get("modele", ""),
            "proportions": contenu.get("proportions", "1:1"),
            "resolution": contenu.get("resolution"),
            "options": dict(contenu.get("options") or {}),
            "echelle": contenu.get("echelle", ""),
            "references": [
                {"asset": r.get("asset", ""), "role": r.get("role", "reference")}
                for r in (contenu.get("references") or [])
                if r.get("asset")
            ],
            "references_ecartees": list(contenu.get("references_ecartees") or []),
        }
        self._fichiers.ecrire_prereglages(enregistres)
        return self.reglages()

    def oublier_reglages(self, nom: str) -> dict[str, Any]:
        enregistres = self._fichiers.lire_prereglages()
        enregistres.pop(nom, None)
        self._fichiers.ecrire_prereglages(enregistres)
        return self.reglages()

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

    def _jointes(
        self, pliage: Pliage | None, identifiant_modele: str
    ) -> tuple[bytes, ...]:
        """L'image que la planche envoie avec l'appel — **et il y en a deux
        sortes, qui ne se ressemblent pas.**

        **La grille vide de C2 envoie un gabarit** : des cases dessinées d'un
        trait clair, pour dire au modèle où poser les N sujets qu'il va créer.

        **La grille pleine de C3 envoie la planche elle-même** — les corps
        déjà là, sur le fond plat du produit, et **rien d'autre** : ni ancre, ni
        mire, ni silhouette de repère, ni les traits du gabarit (`docs/PLAN.md`,
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
        """
        if pliage is None:
            return ()
        modele = self._catalogue.modele(identifiant_modele)
        if modele.references_max <= 0:
            return ()
        if pliage.geometrie_connue:
            if self._equipement is None:  # pragma: no cover — l'atelier le compose
                return ()
            # **Sans référence possible, la planche ne part pas — et l'appel non
            # plus.** Le gabarit est un confort dont C2 peut se passer ; la
            # planche d'équipement *est* la demande. Un modèle qui n'accepte
            # aucune image ne peut donc pas habiller, et il est grisé par le
            # catalogue avant d'arriver ici (`Modele.refus`).
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
    ) -> list[dict[str, Any]]:
        """Ce qui part, **une ligne par chose**, dans l'ordre de l'assemblage (E14).

        C'est le seul endroit du dépôt qui décide de ce que le prompt contient.
        L'écran de confirmation demande ces lignes-là, le prompt est leur
        jonction, et il n'y a donc pas deux textes possibles : « le texte montré
        vient du même chemin que l'envoi » cesse d'être une promesse pour devenir
        un fait mécanique.

        **Trois groupes, dans l'ordre où le texte s'assemble.** Les sept textes
        du jeu — avec, mêlées, les trois lignes que l'ambiance remplace —, puis
        le sujet et la consigne de sa case, puis les consignes de planche quand
        l'appel part plié. La bible se replie en tête depuis T4 (US-53) et les
        consignes de planche en queue parce qu'elles parlent du sujet décrit
        au-dessus.

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
                resoudre(self._production.couches(projet, personnage), tri)
            )
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
    ) -> list[dict[str, str]]:
        """Les lignes, **groupées comme elles s'assemblent** (US-158).

        Conservée telle quelle pour ce qui lit encore des blocs — l'agent, les
        essais de R2. Elle ne compose plus rien : elle groupe ce que `lignes`
        rend, ce qui garantit qu'un bloc et sa ligne ne peuvent pas diverger.
        """
        return en_blocs(
            self.lignes(sujet, repris=repris, projet=projet, pliage=pliage)
        )

    def _texte(
        self,
        sujet: str,
        repris: bool,
        projet: str | None,
        pliage: Pliage | None,
        *,
        personnage: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        tri: Tri | None = None,
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
        return joindre(
            self.lignes(
                sujet,
                repris=repris,
                projet=projet,
                personnage=personnage,
                pose=pose,
                direction=direction,
                pliage=pliage,
                tri=tri,
            )
        )

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
        """
        if projet is None and self._bibliotheque is not None:
            projet = self._bibliotheque.courant
        pliage = self._plier(projet, personnage, poses, piece, pose, directions)
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
        )
        return {
            "texte": joindre(lignes),
            "parties": en_blocs(lignes),
            # **Une ligne par chose qui part** (E14). Le même appel sert le
            # dépliant d'hier et l'écran de confirmation : deux routes auraient
            # rouvert la question de savoir laquelle dit vrai.
            "lignes": lignes,
        }

    def _artworks(self, demande: Demande, projet: str | None) -> tuple[Reinjection, ...]:
        """Les artworks que le sujet demandé fait partir (US-51).

        Le sujet est une échelle du barème du projet, et elle porte sa famille.
        Un nom d'échelle inconnu est refusé par le service d'univers plutôt que
        corrigé : un onglet resté ouvert après un renommage enverrait sinon les
        artworks d'une autre famille sans que rien ne le dise.
        """
        if self._univers is None or projet is None:
            return ()
        echelle = self._univers.echelle(projet, demande.echelle)
        return self._univers.references(projet, echelle.famille if echelle else None)

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
        demande = Demande(prompt="x", echelle=echelle)
        artworks = self._artworks(demande, projet)
        concepts = self._concepts(projet, personnage, piece)
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
        promues = set(self._promues(projet, personnage))
        # **Cinquième provenance depuis E14** : une image que l'ambiance apporte.
        # Elle n'est ni un artwork du jeu — elle ne concerne que ce coin-là — ni
        # un concept art épinglé sur la chose : la corriger là-bas la corrige
        # pour tout ce qui s'en sert, et c'est ce que le mot doit dire.
        siennes = set(r.asset for r in de_lambiance)

        lignes = [
            {
                "asset": r.asset,
                "role": r.role,
                "origine": r.origine,
                # **La provenance, nommée** (US-127) : « comprendre pourquoi elle
                # part avant de décider de la retirer ». Cinq sources, cinq
                # phrases, et jamais un mot que l'écran devrait interpréter.
                "provenance": (
                    "image de son ambiance"
                    if r.asset in siennes
                    else "concept art"
                    if r.origine == CARTE and r.asset in designes
                    else "artwork officiel"
                    if r.origine == CARTE
                    else "image promue"
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
        gabarit = 1 if (cases >= 2 or (piece and cases >= 1)) else 0

        # **La bande de couleurs compte comme le gabarit**, et pour les mêmes
        # deux raisons : elle occupe une place dans le plafond du modèle, et elle
        # coûte chez ceux qui facturent au token. Elle **est** décochable, elle —
        # c'est une option de l'écran de confirmation, pas une condition de
        # l'appel —, mais sa case vit dans les options et non dans la liste des
        # images, où l'auteur ne saurait pas quelle image il décoche.
        bande = 1 if (palette and self._couleurs(projet, personnage)) else 0

        return {
            # Ce qui part vraiment — donc ce qui décide du grisé.
            "total": len(retenues) + gabarit + bande,
            "gabarit": gabarit,
            "palette": bande,
            "manuelles": sum(1 for l in retenues if l["origine"] != CARTE),
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
        """
        if not demande.palette:
            return ()
        couleurs = self._couleurs(projet, personnage)
        if not couleurs:
            return ()
        if self._catalogue.modele(identifiant_modele).references_max <= 0:
            return ()
        return (bande_de_palette(couleurs),)

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
        self, projet: str | None, personnage: str | None, piece: str | None = None
    ) -> tuple[Reinjection, ...]:
        """Les concept arts du personnage visé, et de la pièce (US-124).

        En rôle `style`, comme les artworks : ils **inspirent**, ils
        n'engendrent pas — une carte en source d'édition donnerait une filiation
        vers un objet que la bibliothèque ne connaît pas.

        **Et les images promues avec eux** (E12), en rôle `reference` : celles-là
        ne disent pas *voilà l'allure*, elles disent *voilà le sujet*. C'est ce
        qui fait qu'un personnage se ressemble d'une pose à l'autre, et c'est la
        correction du frottement le plus cher du dépôt — dix-sept appels payés
        sur vingt-huit étaient partis sans une seule image.
        """
        return tuple(
            Reinjection(asset=identifiant, role=STYLE, origine=CARTE)
            for identifiant in self._concepts_identifiants(projet, personnage, piece)
        ) + tuple(
            Reinjection(asset=identifiant, role=REFERENCE, origine=ASSET)
            for identifiant in self._promues(projet, personnage)
        )

    def _promues(
        self, projet: str | None, personnage: str | None
    ) -> tuple[str, ...]:
        """Les images que cette chose du jeu a promues en référence permanente."""
        if self._production is None or not projet or not personnage:
            return ()
        return tuple(self._production.references_promues(projet, personnage))

    def _octets_references(self, identifiants, projet: str | None = None) -> tuple[bytes, ...]:
        """Les images réinjectées, relues à la source (US-12).

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
        return tuple(octets)

    # ── Enregistrement ───────────────────────────────────────────────────────

    def _sauver(self, generation: Generation) -> None:
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
