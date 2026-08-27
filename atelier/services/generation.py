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
"""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Callable

from atelier.depot import Base, Fichiers
from atelier.domaine import (
    Demande,
    Emplacement,
    Generation,
    Modele,
    Resultat,
    Statut,
)
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
from atelier.services.catalogue import ServiceCatalogue


class ServiceGenerations:
    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        catalogue: ServiceCatalogue,
        fabrique_fournisseur: Callable[[], PortFournisseur],
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._catalogue = catalogue
        self._fournisseur = fabrique_fournisseur
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
            self._sauver(generation)
            coupees.append(generation)
        return coupees

    # ── Lecture ──────────────────────────────────────────────────────────────

    def lire(self, identifiant: str) -> Generation | None:
        return self._base.lire(identifiant)

    def recentes(self, limite: int = 50) -> list[Generation]:
        return self._base.recentes(limite)

    def total_couts(self, projet: str | None = None) -> float:
        return self._base.total_par_projet(projet)

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
    ) -> tuple[Generation, Modele | None, bool]:
        """Vérifie, enregistre, et dit si c'est neuf. N'appelle pas le fournisseur.

        Rend `(generation, modele, deja_soumise)`. Quand `deja_soumise` est vrai,
        rien n'a été facturé et rien ne le sera : c'est la même génération, et le
        modèle est inutile — on ne rappellera pas le fournisseur.
        """
        identifiant = identifiant or uuid.uuid4().hex
        existante = self._base.lire(identifiant)
        if existante is not None:
            return existante, None, True

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
    ) -> Generation:
        """Prépare puis lance, sans attendre. L'appelant reçoit l'identifiant."""
        generation, modele, deja = self.preparer(
            identifiant_modele, demande, identifiant=identifiant, projet=projet
        )
        if deja or modele is None:
            return generation

        tache = asyncio.create_task(self._executer(generation, modele, demande))
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
        demande = _demande_de(generation)

        emplacement.statut = Statut.EN_ATTENTE
        emplacement.raison = None
        emplacement.avancement = 0.0
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
        emplacement.avancement = 0.05
        self._sauver(generation)

        depart = time.monotonic()
        try:
            image = await fournisseur.generer(modele, demande)
            mesure = mesurer(image.octets)
        except ErreurAtelier as erreur:
            self._echouer(generation, emplacement, erreur.raison, depart)
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
        emplacement.avancement = 1.0
        emplacement.statut = Statut.REUSSIE
        self._sauver(generation)

    def _echouer(
        self,
        generation: Generation,
        emplacement: Emplacement,
        raison: str,
        depart: float,
    ) -> None:
        """Un appel raté garde son coût : il reste lisible dans le journal (US-24)."""
        emplacement.statut = Statut.ECHOUEE
        emplacement.raison = raison
        emplacement.avancement = 0.0
        emplacement.duree_s = round(time.monotonic() - depart, 2)
        self._sauver(generation)

    # ── Enregistrement ───────────────────────────────────────────────────────

    def _sauver(self, generation: Generation) -> None:
        """Au fil de l'eau, jamais à la fin — sinon un plantage perd ce qui est
        déjà payé (`AGENTS.md` § Pièges connus)."""
        self._base.enregistrer(generation)
        self._fichiers.ecrire_enregistrement(generation.identifiant, generation.en_json())

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


def _demande_de(generation: Generation) -> Demande:
    """Reconstruit la demande d'une génération enregistrée, pour un seul appel.

    Les références ne sont pas reconstituées : en T1 il n'y en a aucune. Quand
    elles arriveront (T3, T4), elles seront relues depuis les assets qui les
    portent — jamais recopiées dans l'enregistrement, qui n'a pas à grossir de
    plusieurs mégaoctets de base64.
    """
    demande = generation.demande
    return Demande(
        prompt=demande["prompt"],
        prompt_negatif=demande.get("prompt_negatif", ""),
        proportions=demande.get("proportions", "1:1"),
        resolution=demande.get("resolution"),
        variations=1,
        options=demande.get("options", {}),
    )
