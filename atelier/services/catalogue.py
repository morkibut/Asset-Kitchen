# -*- coding: utf-8 -*-
"""Le catalogue des modèles — relu au démarrage, jamais écrit en dur.

Deux règles du produit se rencontrent ici.

**Le catalogue décide.** Les plafonds de références, les résolutions et les
paramètres viennent du fournisseur. SpriteCook code les siens en dur et plafonne
sous ses propres modèles : il déclare 14 références à `gpt-image-2` là où le
catalogue en donne 16, et 10 à `gemini-3-pro-image` là où il en donne 14.

**L'échec survient au moment où on génère, jamais au démarrage** (US-95). Ce
service ne lève donc jamais : sans réseau, il sert la dernière photo reçue,
**datée en clair** (US-93) ; sans photo du tout, il sert une liste vide avec sa
raison. L'atelier s'ouvre dans tous les cas.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from atelier.depot import Fichiers
from atelier.domaine import Modele
from atelier.domaine.catalogue import modele_depuis_json, modele_en_json
from atelier.domaine.erreurs import ErreurAtelier, ModeleInconnu
from atelier.fournisseur import PortFournisseur


# **Le seul modèle écrit en dur du produit, et c'est un choix, pas une capacité.**
#
# `docs/ARCHITECTURE.md` §4 bis : « Un seul modèle par défaut : `openai/gpt-image-2`
# en `quality: low` », établi par le second banc — le seul régulier sur dix sujets,
# à $0,0245 l'image avec guide. Ce n'est pas une liste de capacités : celles-là
# viennent toujours du catalogue. C'est le point de départ d'une séance, et il
# cessera d'être écrit ici en T4, quand l'univers portera un défaut par type
# d'asset. S'il disparaît du catalogue, le premier modèle utilisable prend sa
# place — jamais une erreur au démarrage.
DEFAUT = "openai/gpt-image-2"
OPTIONS_DEFAUT = {"quality": "low"}


@dataclass(slots=True)
class Defaut:
    modele: str | None
    options: dict[str, str]


@dataclass(slots=True)
class EtatCatalogue:
    modeles: list[Modele] = field(default_factory=list)
    recu_le: float = 0.0  # quand ces données ont été reçues du fournisseur
    repli: bool = False  # vrai si elles viennent du disque, pas du réseau
    raison: str | None = None  # pourquoi le repli, en clair

    @property
    def vide(self) -> bool:
        return not self.modeles


class ServiceCatalogue:
    def __init__(self, fournisseur: PortFournisseur, fichiers: Fichiers) -> None:
        self._fournisseur = fournisseur
        self._fichiers = fichiers
        self._etat = EtatCatalogue()
        self._index: dict[str, Modele] = {}

    # ── Lecture ──────────────────────────────────────────────────────────────

    @property
    def etat(self) -> EtatCatalogue:
        return self._etat

    def defaut(self, demande=None) -> Defaut:
        """Par quoi commencer une séance — le modèle du banc, ou un repli.

        Un défaut qui ne peut pas honorer la demande en cours n'en est pas un :
        on prend alors le premier modèle que le catalogue déclare capable.
        """
        index = self._index
        prefere = index.get(DEFAUT)
        if prefere is not None and (demande is None or prefere.refus(demande) is None):
            return Defaut(prefere.identifiant, dict(OPTIONS_DEFAUT))

        for modele in self._etat.modeles:
            if demande is None or modele.refus(demande) is None:
                return Defaut(modele.identifiant, {})
        return Defaut(None, {})

    def modele(self, identifiant: str) -> Modele:
        modele = self._index.get(identifiant)
        if modele is None:
            raise ModeleInconnu(identifiant)
        return modele

    # ── Rafraîchissement ─────────────────────────────────────────────────────

    async def rafraichir(self) -> EtatCatalogue:
        """Appelé au démarrage, et à la demande. Ne lève jamais."""
        try:
            modeles = await self._fournisseur.catalogue()
        except ErreurAtelier as erreur:
            self._etat = self._depuis_disque(erreur.raison)
        except Exception as erreur:  # noqa: BLE001 — un démarrage ne casse pas
            self._etat = self._depuis_disque(f"catalogue illisible — {erreur}")
        else:
            recu_le = time.time()
            self._etat = EtatCatalogue(modeles=modeles, recu_le=recu_le)
            self._fichiers.ecrire_catalogue(
                {
                    "recu_le": recu_le,
                    "fournisseur": getattr(self._fournisseur, "nom", "inconnu"),
                    "modeles": [modele_en_json(m) for m in modeles],
                }
            )

        self._index = {m.identifiant: m for m in self._etat.modeles}
        return self._etat

    def _depuis_disque(self, raison: str) -> EtatCatalogue:
        contenu = self._fichiers.lire_catalogue()
        if not contenu:
            return EtatCatalogue(raison=raison, repli=True)
        return EtatCatalogue(
            modeles=[modele_depuis_json(m) for m in contenu.get("modeles", [])],
            recu_le=contenu.get("recu_le", 0.0),
            repli=True,
            raison=raison,
        )
