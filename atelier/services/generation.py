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
from atelier.domaine.generation import AUTEUR, CARTE, EDITION, STYLE
from atelier.domaine.pliage import CasePliee, Pliage
from atelier.fournisseur import PortFournisseur
from atelier.image import mesurer
from atelier.image.mesures import extension
from atelier.reglages import lire_cle
from atelier.domaine.asset import Asset
from atelier.services.assets import AssetInconnu, ServiceAssets
from atelier.services.catalogue import ServiceCatalogue
from atelier.services.evenements import Diffusion
from atelier.services.pliage import CompteFaux, ServicePliage, consignes, reference


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

    def cout_attendu(self, identifiant_modele: str) -> float | None:
        """Ce qu'une image de ce modèle a coûté, en médiane, aux derniers appels.

        « Voir avant de lancer ce qui va partir et **ce que ça va coûter** »
        (US-121). Le chiffre est une **mesure**, pas un tarif : le produit ne
        porte aucun prix de catalogue, et le coût réel facturé fait foi partout
        ailleurs — l'annoncer autrement ici en ferait le seul endroit du produit
        où l'argent est supposé.

        `None` quand ce modèle n'a jamais rien facturé sur cette machine. Le
        produit dit alors qu'il ne sait pas, ce qui est vrai et utile : c'est le
        premier appel qui l'apprend. Même geste que l'attente de la jauge.
        """
        recents = self._base.couts_mesures(identifiant_modele)[:FENETRE_MESURES]
        couts = sorted(recents)
        if not couts:
            return None
        milieu = len(couts) // 2
        if len(couts) % 2:
            return round(couts[milieu], 4)
        return round((couts[milieu - 1] + couts[milieu]) / 2, 4)

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
    ) -> Asset:
        """Un fichier local devient un asset entier (US-82).

        **Il passe par une génération, et ce n'est pas une formalité.** La
        bibliothèque se reconstruit en parcourant les `generation.json` du
        disque : un asset écrit sans le sien serait perdu au premier effacement
        de l'index, c'est-à-dire à la première évolution du schéma. Cette
        génération-là n'a appelé personne — modèle `import`, coût nul, un seul
        emplacement déjà réussi —, et elle dit d'où le fichier venait, ce
        qu'aucun autre endroit ne pourrait dire ensuite.

        L'asset naît donc par le même chemin que tous les autres : il hérite de
        la recette du projet, entre en bibliothèque de lui-même, et se range
        dans le projet ouvert quand on n'en nomme pas. **Aucun appel au
        fournisseur** — importer marche réseau coupé.
        """
        mesure = mesurer(octets)
        if projet is None and self._bibliotheque is not None:
            projet = self._bibliotheque.courant

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
            # dans la grille.
            demande={"prompt": nom, "variations": 1, "source": nom},
            parametres_resolus={"modele": IMPORT, "source": nom},
            emplacements=[emplacement],
            cree_le=time.time(),
            projet=projet,
            provenance=provenance,
        )
        self._sauver(generation)
        asset = self._assets.naitre(generation, emplacement)
        if asset is None:  # pragma: no cover — l'emplacement porte son résultat
            raise ErreurAtelier(f"« {nom} » n'a pas pu entrer en bibliothèque")
        return asset

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
        poses: Sequence[str] | None = None,
        references_ecartees: Sequence[str] | None = None,
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
        pliage = self._plier(projet, personnage, poses)
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
            self._production.viser(projet, personnage, pose or "")

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
            prompt=self._texte(demande.prompt, demande.repris, projet, pliage),
        )
        # **Trois sources, dans cet ordre, puis le dédoublonnage** : ce que
        # l'auteur a posé à la main, ce que le personnage désigne (US-124), et
        # les artworks de la famille du sujet. L'ordre décide du rôle gardé en
        # cas de doublon, et le plafond du modèle se compte après.
        reinjectes = _reinjectes(
            tuple(references)
            + self._concepts(projet, personnage)
            + self._artworks(demande, projet)
        )
        # **Puis ce qui est écarté** (US-126). La portée de la génération, quand
        # elle a un avis, décide **seule** : c'est la plus étroite, et c'est la
        # règle affichée à l'écran. Sans avis — un agent, une relance —, les
        # deux portées durables s'appliquent.
        ecartees = (
            set(references_ecartees)
            if references_ecartees is not None
            else set(self._ecartees_durables(projet, personnage))
        )
        reinjectes = tuple(r for r in reinjectes if r.asset not in ecartees)
        demande = replace(
            demande,
            references=self._octets_references(reinjectes, projet)
            # **Le gabarit part comme une référence de plus, et il en est une.**
            # Il occupe donc une place dans le plafond du modèle et il coûte chez
            # ceux qui facturent au token (`docs/PIEGES.md`) : le compter à part
            # aurait fait mentir le grisé au moment précis où l'appel est le plus
            # cher. **Avant le grisé**, pour la même raison que les réinjections.
            + self._gabarit(pliage, identifiant_modele),
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
            # **Et pour combien de cases** (US-128). Une génération ordinaire n'en
            # porte pas, et c'est le cas courant : `pliage` vaut `None`, l'image
            # qui revient naît comme depuis T1.
            pliage=pliage,
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
        poses: Sequence[str] | None = None,
        references_ecartees: Sequence[str] | None = None,
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
            poses=poses,
            references_ecartees=references_ecartees,
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
        l'identifiant » (`docs/ARCHITECTURE.md` § Contrat de génération).
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
            references=self._octets_references(generation.references, generation.projet)
            # **Le gabarit se redessine, il ne se relit pas.** Il n'est ni un
            # asset ni une carte : il n'a pas d'identifiant, il n'est nulle part
            # sur le disque, et il se refabrique à l'identique depuis la
            # géométrie du pliage. L'appel et la relance envoient donc exactement
            # la même chose, ce qui est la promesse de cette méthode.
            + self._gabarit(generation.pliage, generation.modele),
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

    def _plier(
        self, projet: str | None, personnage: str | None, poses: Sequence[str] | None
    ) -> Pliage | None:
        """Les cases d'un lot, **vérifiées avant qu'un centime parte** (US-128).

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

        Le texte d'une case est le **nom** de la pose, pas son identifiant : il
        part dans le prompt, et un repère de fichier n'a jamais décrit une
        attitude à un modèle.
        """
        if not poses or len(poses) < 2:
            return None
        if not personnage or self._production is None or not projet:
            raise DemandeRefusee(
                "un lot de poses se lance depuis un personnage — il n'y a pas "
                "de cases à remplir sans lui"
            )
        cases = []
        for pose in dict.fromkeys(poses):
            _, visee = self._production.viser(projet, personnage, pose)
            cases.append(CasePliee(texte=visee.nom, pose=visee.identifiant))
        return Pliage(cases=tuple(cases))

    def _gabarit(
        self, pliage: Pliage | None, identifiant_modele: str
    ) -> tuple[bytes, ...]:
        """Le gabarit de cases vides, quand ce modèle-là sait le lire.

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
        return (reference(pliage),) if modele.references_max > 0 else ()

    # ── Le texte qui part, et l'univers qui l'habille ────────────────────────

    def parties(
        self, sujet: str, repris: bool, projet: str | None, pliage: Pliage | None
    ) -> list[dict[str, str]]:
        """Ce qui partira, **bloc par bloc et dans l'ordre d'envoi** (US-158).

        Trois origines et pas une de plus : la bible active du projet, le sujet
        écrit par l'auteur, et les consignes de planche quand un lot est armé.
        Rien n'est traduit ni enrichi en chemin — montrer autre chose que ce qui
        part serait pire que ne rien montrer.

        **Un texte repris n'a qu'une partie, et c'est la vérité** : l'auteur a
        pris la main sur l'ensemble, donc il n'y a plus de bible d'un côté et de
        sujet de l'autre. Le découpage aurait été une reconstitution, pas une
        lecture.

        **Le sujet est un texte, pas une `Demande`** : l'aperçu se demande dès
        le champ vide — l'atelier s'ouvre dessus —, et `Demande` refuse un
        prompt vide à juste titre. Ce refus appartient à la soumission, pas à la
        lecture de ce qui partirait.
        """
        if repris:
            return [{"origine": "repris", "texte": sujet}]
        blocs = []
        bible = (
            self._univers.prompt(projet)
            if self._univers is not None and projet is not None
            else ""
        )
        if bible:
            blocs.append({"origine": "bible", "texte": bible})
        if sujet:
            blocs.append({"origine": "sujet", "texte": sujet})
        if pliage is not None:
            blocs.append({"origine": "planche", "texte": consignes(pliage)})
        return blocs

    def _texte(
        self, sujet: str, repris: bool, projet: str | None, pliage: Pliage | None
    ) -> str:
        """Les parties, jointes — **le seul endroit qui écrive le prompt final**.

        La bible active se replie en tête (US-53) : « je veux que le style de mon
        univers parte avec chaque génération, afin de ne jamais le retaper ». Les
        consignes de planche se replient en queue, parce qu'elles parlent du
        *sujet décrit au-dessus* — les mettre avant obligerait à le nommer deux
        fois. Les deux se font **avant** l'enregistrement et avant l'appel, donc
        `generation.json` porte le prompt tel qu'il est parti : une génération se
        relit des mois après sans avoir à reconstituer l'univers du jour.
        """
        return "\n\n".join(
            bloc["texte"] for bloc in self.parties(sujet, repris, projet, pliage)
        )

    def apercu(
        self,
        sujet: str,
        *,
        repris: bool = False,
        projet: str | None = None,
        personnage: str | None = None,
        poses: Sequence[str] | None = None,
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
        pliage = self._plier(projet, personnage, poses)
        parties = self.parties(sujet, repris, projet, pliage)
        return {
            "texte": "\n\n".join(bloc["texte"] for bloc in parties),
            "parties": parties,
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
        concepts = self._concepts(projet, personnage)
        ecartees = (
            self._production.ecartees(projet, personnage)
            if self._production is not None and projet
            else {}
        )

        toutes = _reinjectes(tuple(manuelles) + concepts + artworks)
        echelle_lue = (
            self._univers.echelle(projet, echelle) if self._univers and echelle else None
        )
        designes = set(self._concepts_identifiants(projet, personnage))

        lignes = [
            {
                "asset": r.asset,
                "role": r.role,
                "origine": r.origine,
                # **La provenance, nommée** (US-127) : « comprendre pourquoi elle
                # part avant de décider de la retirer ». Trois sources, trois
                # phrases, et jamais un mot que l'écran devrait interpréter.
                "provenance": (
                    "concept art"
                    if r.origine == CARTE and r.asset in designes
                    else "artwork officiel"
                    if r.origine == CARTE
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
        gabarit = 1 if cases >= 2 else 0

        return {
            # Ce qui part vraiment — donc ce qui décide du grisé.
            "total": len(retenues) + gabarit,
            "gabarit": gabarit,
            "manuelles": sum(1 for l in retenues if l["origine"] != CARTE),
            "artworks": sum(
                1 for l in retenues if l["provenance"] == "artwork officiel"
            ),
            "concepts": sum(1 for l in retenues if l["provenance"] == "concept art"),
            "famille": echelle_lue.famille if echelle_lue else None,
            # Les écartées y sont **aussi**, et elles le disent : une ligne qui
            # disparaîtrait ne laisserait aucun moyen de la remettre.
            "lignes": lignes,
        }

    def _ecartees_durables(
        self, projet: str | None, personnage: str | None
    ) -> tuple[str, ...]:
        """Ce que le projet et le personnage ont écarté — les deux portées qui
        s'écrivent. Celle de la génération ne s'écrit nulle part : elle vit dans
        l'onglet et part avec l'appel."""
        if self._production is None or not projet:
            return ()
        return tuple(self._production.ecartees(projet, personnage))

    def _concepts_identifiants(
        self, projet: str | None, personnage: str | None
    ) -> tuple[str, ...]:
        if self._production is None or not projet:
            return ()
        return self._production.concept_arts(projet, personnage)

    def _concepts(
        self, projet: str | None, personnage: str | None
    ) -> tuple[Reinjection, ...]:
        """Les concept arts du personnage visé (US-124).

        En rôle `style`, comme les artworks : ils **inspirent**, ils
        n'engendrent pas — une carte en source d'édition donnerait une filiation
        vers un objet que la bibliothèque ne connaît pas.
        """
        return tuple(
            Reinjection(asset=identifiant, role=STYLE, origine=CARTE)
            for identifiant in self._concepts_identifiants(projet, personnage)
        )

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
