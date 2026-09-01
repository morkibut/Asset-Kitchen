# -*- coding: utf-8 -*-
"""Les refus du produit. Chacun porte sa raison **en clair, en français**.

Le produit n'affiche jamais un message technique à la place d'une raison : un
contrôle indisponible est grisé et dit pourquoi (`docs/design-motifs.md` § Le grisé
porte sa raison).
"""

from __future__ import annotations

from atelier.domaine.consommation import USD, argent


class ErreurAtelier(Exception):
    """Toute erreur que l'interface peut afficher telle quelle."""

    code = "erreur"

    def __init__(self, raison: str, *, ou_aller: str | None = None) -> None:
        super().__init__(raison)
        self.raison = raison
        self.ou_aller = ou_aller  # l'écran qui règle le problème, quand il y en a un


class SansCle(ErreurAtelier):
    """Ce qui manque **au fournisseur de ce modèle-là**, jamais au produit.

    Le nom de la classe a survécu à la V2.2 et la phrase a changé de portée.
    Avant F1, il n'y avait qu'un fournisseur, une clé, et l'absence de la clé
    éteignait l'atelier entier. Depuis, un fournisseur ne demande rien du tout :
    ce refus ne vaut donc plus que pour les modèles de celui qui manque, et il
    porte **sa** phrase — celle que son adaptateur écrit.
    """

    code = "sans_cle"

    def __init__(self, raison: str | None = None) -> None:
        super().__init__(raison or "aucune clé OpenRouter", ou_aller="reglages")


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
    """Le fournisseur a répondu, et il a dit non.

    **Un refus peut consommer.** Un appel qui atteint le modèle est facturé même
    quand il ne rend aucune image exploitable : `consomme` porte alors ce que la
    réponse déclare, et c'est ce chiffre-là qui va au journal du projet (US-24).
    Le jeter rendrait un total de projet faux du montant exact qu'on cherche à
    expliquer.

    **`unite` est arrivée en F2**, et le critère qu'elle tient est écrit tel
    quel : *une génération enregistre ce qu'elle a consommé et dans quelle
    unité, **y compris quand elle échoue***. Un refus qui a brûlé un jeton l'a
    brûlé pour de bon.
    """

    code = "appel_refuse"

    def __init__(
        self,
        raison: str,
        *,
        statut: int | None = None,
        consomme: float = 0.0,
        unite: str = USD,
    ) -> None:
        super().__init__(raison)
        self.statut = statut
        self.consomme = consomme
        self.unite = unite

    @property
    def cout_usd(self) -> float:
        """La part en argent de ce que ce refus a consommé."""
        return argent(self.consomme, self.unite)
