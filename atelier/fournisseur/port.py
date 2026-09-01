# -*- coding: utf-8 -*-
"""Ce que le domaine attend d'un fournisseur d'images. Rien de plus."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from atelier.domaine import Compte, Demande, Modele
from atelier.domaine.consommation import USD, argent
from atelier.domaine.secret import Secret


@dataclass(frozen=True, slots=True)
class ImageProduite:
    """Une image, et ce qu'elle a **réellement** consommé.

    `consomme` vient de la réponse de l'appel, jamais du tarif du catalogue :
    `riverflow-v2.5-fast` annonce $0,019 l'image et en facture $0,042, les
    références d'entrée étant facturées en plus.

    **`unite` est arrivée en F2**, et c'est la révision n°2 de la V2.2 : un
    fournisseur qui ne facture pas consomme quand même. Pollinations rend un
    jeton par image, annoncé dans ses en-têtes. Le défaut est l'argent — c'est
    ce qu'était tout le produit avant, et un adaptateur qui compte en dollars
    n'a donc rien à déclarer.
    """

    octets: bytes
    consomme: float
    type_media: str | None = None  # ce que le fournisseur *dit* avoir rendu
    unite: str = USD

    @property
    def cout_usd(self) -> float:
        """La part en argent. Zéro dès que l'unité n'est pas celle de l'argent."""
        return argent(self.consomme, self.unite)


class PortFournisseur(Protocol):
    """Trois gestes : dire qui on est, dire ce qu'on sait faire, et le faire.

    **`nom` n'est plus décoratif depuis F1** : c'est lui qui qualifie chacun des
    modèles du fournisseur (`atelier.domaine.catalogue.nommer`), donc il est
    écrit dans les générations et relu des mois plus tard. **Le changer
    renommerait tous les modèles déjà enregistrés.**
    """

    nom: str

    async def catalogue(self) -> list[Modele]:
        """Les modèles et leurs capacités, tels que le fournisseur les déclare."""
        ...

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        """Un appel, une image. Lève une erreur du domaine, jamais une erreur HTTP."""
        ...

    def indisponible(self) -> str | None:
        """Pourquoi ce fournisseur ne peut pas travailler **maintenant**, ou `None`.

        Arrivé en F1, et c'est la révision qui se voit le plus : *« la clé du
        fournisseur est le seul préalable dur du produit »* tombe. Un fournisseur
        qui ne demande ni compte ni clé rend toujours `None` ; un autre rend la
        phrase française qui grisera **ses** modèles, et eux seuls.

        Ce n'est pas une panne — une panne se découvre au moment de l'appel
        (US-95). C'est un manque connu d'avance, et le produit ne propose jamais
        ce qu'il devra refuser.
        """
        ...

    def compte(self) -> Compte | None:
        """Dans quelle unité ce fournisseur compte, et ce qu'il alloue.

        Arrivé en F2. `None` — il compte en argent, et l'argent a déjà sa barre
        de tête ; c'est la réponse d'OpenRouter. Sinon, la **forme** de sa
        réserve : l'unité, ce qu'il alloue s'il alloue quelque chose, d'où le
        chiffre viendra, et à quelle cadence il accepte les appels.

        **Il ne dit jamais ce qui est parti** — ça se compte ailleurs
        (`atelier.services.reserves`), et pour une raison de fond : ce qui est
        compté ici ne connaît que les appels partis d'ici, et le produit doit
        pouvoir l'écrire à côté du chiffre. Un adaptateur qui rendrait un
        « il reste 42 » sans dire d'où il le tient enfreindrait l'invariant de
        la V2.2 : *un chiffre de réserve dit toujours s'il est relevé chez le
        fournisseur ou compté ici.*
        """
        ...

    def secrets(self) -> tuple[Secret, ...]:
        """Les places qu'il faut remplir pour qu'il travaille. Vide : aucune.

        Arrivé en F3. Le tiroir cessait d'être « la clé » : **il en existe qui
        en demandent deux** — Cloudflare veut un identifiant de compte *et* un
        jeton —, et un tiroir qui n'en accepterait qu'un les découvrirait en F4.

        **Une déclaration, jamais des valeurs.** L'adaptateur dit quelles places
        existent et comment on en parle ; ce qu'il y a dedans se lit dans
        `atelier.reglages`, à chaque appel, pour que déposer serve **au premier
        appel suivant sans redémarrer** — règle de T1, étendue au pluriel.

        C'est aussi de cette liste que sort la phrase du grisé : `indisponible`
        la compose avec `atelier.domaine.secret.ce_qui_manque`, qui **dit
        lequel** manque quand il y en a plusieurs.
        """
        ...
