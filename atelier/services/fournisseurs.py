# -*- coding: utf-8 -*-
"""Les fournisseurs du produit, et le seul endroit qui sache lesquels.

Arrivé en F1 (`docs/archive/plan-versions-tenues.md` § V2.2). Jusque-là il n'y en avait qu'un, et le
produit disait « le fournisseur ». Il y en a deux, et il en viendra d'autres :
ce qui se dit désormais est **celui de ce modèle-là**.

**Rien ici ne connaît OpenRouter ni Pollinations.** Cette classe reçoit des
fabriques et les appelle ; c'est `atelier.services.Atelier` — le point de
composition — qui sait lesquelles. C'est ce qui permet à tous les essais du
dépôt de monter un atelier avec un fournisseur double sans qu'une ligne d'ici ne
change.

**Une fabrique, pas une instance, et c'est la règle de T1 qui l'exige** : la clé
se relit à chaque appel, jamais au démarrage. On doit pouvoir la déposer sans
redémarrer le serveur — donc un fournisseur se construit au moment où on s'en
sert, et il porte l'état de la clé de cet instant-là.
"""

from __future__ import annotations

from typing import Callable

from atelier.domaine import Compte
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.installation import Verification
from atelier.domaine.secret import Secret, Tiroir
from atelier.fournisseur import PortFournisseur
from atelier.reglages import etat_secret

Fabrique = Callable[[], PortFournisseur]


class Fournisseurs:
    """La liste, dans l'ordre. Le premier est celui par lequel on commence."""

    def __init__(self, fabriques: list[Fabrique]) -> None:
        if not fabriques:
            raise ValueError("un atelier a au moins un fournisseur")
        self._fabriques = list(fabriques)

    # ── Lecture ──────────────────────────────────────────────────────────────

    def tous(self) -> list[PortFournisseur]:
        """Un exemplaire neuf de chacun, dans l'ordre de composition."""
        return [fabrique() for fabrique in self._fabriques]

    def de(self, nom: str) -> PortFournisseur:
        """Le fournisseur d'un modèle, par le nom que le modèle porte.

        **Un nom vide rend le premier**, et c'est la seule tolérance de cette
        classe. Elle sert deux cas et pas un de plus : une génération enregistrée
        avant la V2.2, quand il n'y avait qu'un fournisseur et qu'aucun modèle ne
        nommait le sien ; et un atelier d'essai monté sur un fournisseur unique.
        Aucun des deux ne peut être ambigu — il n'y avait qu'un fournisseur.
        """
        for fournisseur in self.tous():
            if fournisseur.nom == nom:
                return fournisseur
        return self._fabriques[0]()

    def indisponible(self, nom: str) -> str | None:
        """Pourquoi celui-ci ne peut pas travailler maintenant, ou `None`.

        La phrase remonte telle quelle jusqu'au grisé du modèle : c'est
        l'adaptateur qui l'écrit, parce que lui seul sait ce qui lui manque.
        """
        return indisponible_de(self.de(nom))


    def compte(self, nom: str) -> Compte | None:
        """Dans quelle unité celui-ci compte, et ce qu'il alloue. `None` : de l'argent."""
        return compte_de(self.de(nom))

    # ── Le tiroir à secrets (F3) ─────────────────────────────────────────────

    def tiroirs(self) -> list[Tiroir]:
        """Une place par fournisseur, dans l'ordre, avec ce qui lui manque.

        **Tout se redemande à chaque appel**, et c'est la règle de T1 étendue au
        pluriel : une valeur déposée sert au premier appel suivant sans
        redémarrer, donc rien de ce qui est lu ici ne se met en cache. Les
        fournisseurs sont reconstruits — c'est le rôle des fabriques —, et
        chacun relit ses valeurs en naissant.

        **La phrase de ce qui manque vient du fournisseur**, jamais d'un calcul
        refait ici : c'est la même que celle qui grise ses modèles, et deux
        rédactions finiraient par dire deux choses.
        """
        tiroirs = []
        for fournisseur in self.tous():
            nom = getattr(fournisseur, "nom", "inconnu")
            tiroirs.append(
                Tiroir(
                    fournisseur=nom,
                    secrets=tuple(
                        etat_secret(s.nom, s.libelle, s.ou)
                        for s in secrets_de(fournisseur)
                    ),
                    manque=indisponible_de(fournisseur),
                )
            )
        return tiroirs

    # ── La vérification (B15) ────────────────────────────────────────────────

    async def verifier(self, nom: str) -> Verification:
        """*Ce compte-là ouvre quoi ?* — le bouton **Vérifier** de l'installation.

        Trois questions posées d'affilée, et l'ordre compte :

        1. **Ce fournisseur a-t-il ce qu'il demande ?** Sinon on n'appelle rien :
           sa phrase de manque est déjà la bonne réponse, et c'est la même que
           celle qui grise ses modèles.
        2. **Combien de modèles sert-il vraiment ?** On relit son catalogue, on
           ne recopie pas la photo : *un chiffre affiché est un chiffre compté*.
           ⚠️ Chez OpenRouter le catalogue est **public** — ce compte-là ne
           prouve donc pas la clé, et c'est la question suivante qui la prouve.
        3. **Que reste-t-il sur le compte ?** `solde()` est optionnel sur le
           port, comme `compte()` et `secrets()` avant lui : un fournisseur qui
           ne sait pas répondre n'écrit pas de méthode pour le dire.

        **Ne lève jamais.** Un fournisseur injoignable ou une clé refusée sont
        des états que l'écran doit afficher, pas des pannes — et c'est très
        exactement ce que le bouton sert à découvrir.
        """
        fournisseur = self.de(nom)
        vrai_nom = getattr(fournisseur, "nom", nom)
        manque = indisponible_de(fournisseur)
        if manque:
            return Verification(vrai_nom, False, 0, raison=manque)

        try:
            modeles = len(await fournisseur.catalogue())
        except ErreurAtelier as erreur:
            return Verification(vrai_nom, False, 0, raison=erreur.raison)

        try:
            reserve = await solde_de(fournisseur)
        except ErreurAtelier as erreur:
            # **Le compte de modèles est perdu pour l'affichage, et c'est juste** :
            # une clé refusée est la seule nouvelle de cet écran-là.
            return Verification(vrai_nom, False, modeles, raison=erreur.raison)

        return Verification(vrai_nom, True, modeles, reserve=reserve)

    def secret(self, nom: str) -> Secret | None:
        """La place qui porte ce nom d'environnement, chez n'importe lequel.

        **Le produit n'écrit que dans une place qu'un fournisseur a déclarée.**
        Une route qui accepterait n'importe quel nom laisserait écrire n'importe
        quoi dans le `.env` de l'auteur, depuis un navigateur.
        """
        for fournisseur in self.tous():
            for secret in secrets_de(fournisseur):
                if secret.nom == nom:
                    return secret
        return None


def indisponible_de(fournisseur: PortFournisseur) -> str | None:
    """Le geste est optionnel sur le port, et le défaut est « rien ne manque ».

    Un adaptateur qui ne demande rien n'a pas à écrire une méthode pour le dire —
    et c'est aussi ce qui laisse les doubles d'essai du dépôt inchangés.
    """
    geste = getattr(fournisseur, "indisponible", None)
    return geste() if callable(geste) else None


def secrets_de(fournisseur: PortFournisseur) -> tuple[Secret, ...]:
    """Ce que ce fournisseur demande, ou rien (F3).

    Optionnel sur le port pour la raison d'`indisponible_de` : *ne rien
    demander* était impensable avant F1 et c'est devenu le cas d'un fournisseur
    sur deux. Un adaptateur qui ne demande rien n'écrit donc pas de méthode
    pour le dire — et les doubles d'essai du dépôt restent inchangés.
    """
    geste = getattr(fournisseur, "secrets", None)
    return tuple(geste()) if callable(geste) else ()


async def solde_de(fournisseur: PortFournisseur) -> str | None:
    """Ce qu'il reste sur le compte de celui-ci, ou `None` (B15).

    Optionnel sur le port pour la raison exacte d'`indisponible_de` : un
    fournisseur qui ne tient aucun compte — Pollinations, le moteur de la
    maison — n'a pas à écrire une méthode pour dire qu'il n'en tient pas, et
    aucun double d'essai du dépôt n'a eu à changer.
    """
    geste = getattr(fournisseur, "solde", None)
    return await geste() if callable(geste) else None


def compte_de(fournisseur: PortFournisseur) -> Compte | None:
    """Ce que ce fournisseur déclare de sa réserve, ou `None` (F2).

    Optionnel sur le port pour la raison exacte d'`indisponible_de` : le défaut
    — *il compte en argent* — était l'unique réponse possible avant la V2.2, et
    un adaptateur qui facture en dollars n'a donc rien à écrire.
    """
    geste = getattr(fournisseur, "compte", None)
    return geste() if callable(geste) else None
