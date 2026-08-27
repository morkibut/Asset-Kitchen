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
from atelier.domaine.generation import EDITION
from atelier.domaine.erreurs import (
    DemandeRefusee,
    ErreurAtelier,
    GenerationInconnue,
    SansCle,
)
from atelier.fournisseur import PortFournisseur
from atelier.image import mesurer
from atelier.image.mesures import extension
from atelier.reglages import lire_cle
from atelier.services.assets import AssetInconnu, ServiceAssets
from atelier.services.catalogue import ServiceCatalogue
from atelier.services.evenements import Diffusion


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

    def octets(self, generation: Generation, rang: int) -> tuple[bytes, str]:
        """Les octets bruts d'un emplacement réussi, et leur type de média."""
        emplacement = generation.emplacement(rang)
        if emplacement is None or emplacement.resultat is None:
            raise ErreurAtelier(f"l'emplacement {rang} n'a pas d'image")
        resultat = emplacement.resultat
        if not self._fichiers.existe(resultat.fichier):
            raise ErreurAtelier("le fichier de cette image a disparu du disque")
        return self._fichiers.lire(resultat.fichier), resultat.type_media

    # ── Soumission ───────────────────────────────────────────────────────────

    def preparer(
        self,
        identifiant_modele: str,
        demande: Demande,
        *,
        identifiant: str | None = None,
        projet: str | None = None,
        references: Sequence[Reinjection] = (),
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
        """
        identifiant = identifiant or uuid.uuid4().hex
        existante = self._base.lire(identifiant)
        if existante is not None:
            return existante, None, True

        if projet is None and self._bibliotheque is not None:
            projet = self._bibliotheque.courant

        reinjectes = _reinjectes(references)
        demande = replace(demande, references=self._octets_references(reinjectes))

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
    ) -> Generation:
        """Prépare puis lance, sans attendre. L'appelant reçoit l'identifiant."""
        generation, modele, deja = self.preparer(
            identifiant_modele,
            demande,
            identifiant=identifiant,
            projet=projet,
            references=references,
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
            references=self._octets_references(generation.references),
            options=demande.get("options", {}),
        )

    def _octets_references(self, identifiants) -> tuple[bytes, ...]:
        """Les images réinjectées, relues depuis la bibliothèque (US-12).

        Un asset supprimé entre-temps arrête l'appel **avant** qu'il ne parte :
        mieux vaut redemander laquelle réinjecter que payer une génération à
        laquelle il manque ce qu'on voulait montrer.
        """
        if self._assets is None or not identifiants:
            return ()
        octets: list[bytes] = []
        for reinjection in identifiants:
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
        déjà payé (`AGENTS.md` § Pièges connus).

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
    vus: set[str] = set()
    propres: list[Reinjection] = []
    for reinjection in ordonnees:
        if reinjection.asset not in vus:
            vus.add(reinjection.asset)
            propres.append(reinjection)
    return tuple(propres)
