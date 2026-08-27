# -*- coding: utf-8 -*-
"""Les refus du produit. Chacun porte sa raison **en clair, en français**.

Le produit n'affiche jamais un message technique à la place d'une raison : un
contrôle indisponible est grisé et dit pourquoi (`docs/DESIGN.md` § Le grisé
porte sa raison).
"""

from __future__ import annotations


class ErreurAtelier(Exception):
    """Toute erreur que l'interface peut afficher telle quelle."""

    code = "erreur"

    def __init__(self, raison: str, *, ou_aller: str | None = None) -> None:
        super().__init__(raison)
        self.raison = raison
        self.ou_aller = ou_aller  # l'écran qui règle le problème, quand il y en a un


class SansCle(ErreurAtelier):
    code = "sans_cle"

    def __init__(self) -> None:
        super().__init__("aucune clé OpenRouter", ou_aller="reglages")


class ModeleInconnu(ErreurAtelier):
    code = "modele_inconnu"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"le catalogue ne déclare pas « {identifiant} »")


class GenerationInconnue(ErreurAtelier):
    code = "generation_inconnue"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"aucune génération « {identifiant} »")


class DemandeRefusee(ErreurAtelier):
    """Le modèle choisi ne peut pas honorer la demande en cours.

    Ne devrait jamais atteindre l'utilisateur par surprise : l'interface grise
    d'abord. C'est le filet, pas le chemin normal.
    """

    code = "demande_refusee"


class FournisseurIndisponible(ErreurAtelier):
    """Réseau coupé, panne, délai dépassé. Survient au moment de générer, jamais
    au démarrage (US-95)."""

    code = "fournisseur_indisponible"


class AppelRefuse(ErreurAtelier):
    """Le fournisseur a répondu, et il a dit non."""

    code = "appel_refuse"

    def __init__(self, raison: str, *, statut: int | None = None) -> None:
        super().__init__(raison)
        self.statut = statut
