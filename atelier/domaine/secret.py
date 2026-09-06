# -*- coding: utf-8 -*-
"""Ce qu'un fournisseur demande pour travailler — **une place, jamais une valeur**.

Arrivé en F3 (`docs/archive/plan-versions-tenues.md` § V2.2). Le tiroir cessait d'être « la clé » : il y
a plusieurs fournisseurs depuis F1, l'un n'en demande aucune, et **il en existe
qui en demandent deux** — Cloudflare veut un identifiant de compte *et* un jeton,
et un tiroir qui n'en accepterait qu'un les découvrirait en F4.

**Rien de secret ne passe par ce module.** Il porte le *nom* d'une place et la
façon dont on en parle à l'auteur ; la valeur, elle, vit dans `.env` et se lit
par `atelier.reglages`. C'est la même séparation que partout ailleurs : le
domaine dit ce que les choses sont, le dépôt sait où elles sont rangées.

**Et aucune valeur ne s'affiche jamais en entier**, depuis T1 : ce qui sort d'ici
est un aperçu de six caractères, ou rien.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence


@dataclass(frozen=True, slots=True)
class Secret:
    """Une place à remplir chez un fournisseur.

    Quatre champs, et trois d'entre eux sont du texte pour l'auteur. Le premier
    seul est technique : c'est le nom sous lequel la valeur se range dans `.env`,
    et `.env.example` le documente déjà pour les fournisseurs du relevé.

    **`aucun` existe parce que le français a un genre.** *« aucune clé
    OpenRouter »* et *« aucun jeton Cloudflare »* ne se composent pas avec la
    même règle, et une phrase du produit ne se fabrique pas par concaténation
    approximative : chaque adaptateur écrit la sienne, une fois.
    """

    #: Le nom de la variable d'environnement — `OPENROUTER_API_KEY`.
    nom: str
    #: Comment on en parle, article compris : « la clé », « le jeton ».
    libelle: str
    #: La forme négative, article compris : « aucune clé », « aucun jeton ».
    aucun: str
    #: Où on l'obtient, en clair. Vide quand il n'y a rien à dire.
    ou: str = ""


def ce_qui_manque(
    fournisseur: str, secrets: Sequence[Secret], valeurs: Mapping[str, str]
) -> str | None:
    """La phrase française de ce qui manque à ce fournisseur, ou `None`.

    **Écrite ici et pas dans chaque adaptateur**, pour la raison qui vaut depuis
    T1 : cette phrase-là part vers le grisé d'un modèle, vers la barre de tête et
    vers le refus du service de génération, et trois rédactions finiraient par
    dire trois choses.

    Deux formes, et la première est celle d'avant F3 **mot pour mot** :

    - une seule place, et elle est vide → *« aucune clé OpenRouter »* ;
    - plusieurs places, dont certaines vides → *« il manque, chez Cloudflare :
      le compte, le jeton »*, qui **dit lequel** — c'est le critère de la
      tranche, et c'est tout ce qu'il demande.
    """
    manquants = [s for s in secrets if not (valeurs.get(s.nom) or "").strip()]
    if not manquants:
        return None
    if len(secrets) == 1:
        return f"{manquants[0].aucun} {fournisseur}"
    liste = ", ".join(s.libelle for s in manquants)
    return f"il manque, chez {fournisseur} : {liste}"


@dataclass(frozen=True, slots=True)
class EtatSecret:
    """Ce que l'écran a besoin de savoir **sans jamais voir la valeur**.

    Reprend mot pour mot la forme de l'état de la clé unique d'avant F3 —
    `presente`, `origine`, `apercu` —, parce que c'était déjà la bonne : elle
    dit s'il y a quelque chose, d'où ça vient, et de quoi le reconnaître, et
    jamais rien de plus.
    """

    nom: str
    libelle: str
    ou: str
    presente: bool
    #: `environnement` | `fichier` | `absente`. Un secret venu de
    #: l'environnement ne se retire pas depuis l'écran — voir `retirable`.
    origine: str
    #: Les six derniers caractères, jamais la valeur entière.
    apercu: str

    @property
    def retirable(self) -> bool:
        """Peut-on l'enlever d'ici ?

        Non pour un secret venu de l'environnement : le produit n'écrit pas dans
        l'environnement de la machine, et un bouton qui semblerait retirer sans
        rien retirer serait pire que pas de bouton du tout.
        """
        return self.presente and self.origine == "fichier"

    def en_json(self) -> dict[str, Any]:
        return {
            "nom": self.nom,
            "libelle": self.libelle,
            "ou": self.ou,
            "presente": self.presente,
            "origine": self.origine,
            "apercu": self.apercu,
            "retirable": self.retirable,
        }


@dataclass(frozen=True, slots=True)
class Tiroir:
    """Les places d'**un** fournisseur, et ce qui lui manque.

    C'est l'unité du tiroir à secrets de F3 : *chaque fournisseur a sa place à
    lui*. Un fournisseur qui ne demande rien en a un vide — et il paraît quand
    même, parce que *« ce fournisseur ne demande rien »* est un renseignement
    utile, et le premier que l'auteur cherche sur une machine neuve.
    """

    fournisseur: str
    secrets: tuple[EtatSecret, ...]
    #: La même phrase que le grisé de ses modèles, ou `None`. Elle vient du
    #: fournisseur, jamais d'un calcul refait ici : une phrase écrite deux fois
    #: finit par dire deux choses.
    manque: str | None

    @property
    def pret(self) -> bool:
        """Peut-il produire maintenant ? Un tiroir vide est toujours prêt."""
        return self.manque is None

    def en_json(self) -> dict[str, Any]:
        return {
            "fournisseur": self.fournisseur,
            "secrets": [s.en_json() for s in self.secrets],
            "manque": self.manque,
            "pret": self.pret,
        }
