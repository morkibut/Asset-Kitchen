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
