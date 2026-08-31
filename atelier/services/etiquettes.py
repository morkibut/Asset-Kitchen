# -*- coding: utf-8 -*-
"""La base d'étiquettes — elle appartient à l'atelier, pas à un jeu.

**Vide au départ, et personne ne l'écrit à la place de l'auteur.** Elle se
remplit de chaque étiquette fabriquée dans n'importe quel projet, et elle est
partagée par tous : comme la clé du fournisseur, elle ne dépend d'aucun d'eux.
Au premier jeu, l'étape de l'allure est donc sept champs de texte libre, et elle
le dit franchement plutôt que de faire semblant. Au deuxième, tout ce qui a été
nommé une fois est là, avec sa recherche.

**Ce service ne connaît ni projet ni fournisseur.** Il lit un fichier à la
racine des données et il en rend une liste ; c'est tout, et ça se lit dans ses
imports.
"""

from __future__ import annotations

import hashlib
import re
import time
import unicodedata
from typing import Any

from atelier.depot import Fichiers
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.etiquette import Etiquette, etiquettes_depuis_json, rangees
from atelier.domaine.projet import CHAMPS_BIBLE


class EtiquetteRefusee(ErreurAtelier):
    """Une étiquette n'est pas posable, et on dit pourquoi."""

    code = "etiquette_refusee"


class ServiceEtiquettes:
    def __init__(self, fichiers: Fichiers) -> None:
        self._fichiers = fichiers

    def toutes(self) -> tuple[Etiquette, ...]:
        return etiquettes_depuis_json(self._fichiers.lire_etiquettes())

    def de_la_case(self, case: str) -> list[Etiquette]:
        """Celles de cette case-là, les plus employées en premier.

        **Une étiquette d'éclairage ne paraît pas dans la case du trait**, et
        c'est ce qui garde la liste lisible : sans ce filtre, une recherche
        rendrait quatorze étiquettes dont deux concernent la case ouverte.
        """
        return rangees(self.toutes(), case)

    def fabriquer(self, libelle: str, texte: str, case: str) -> tuple[Etiquette, ...]:
        """Un libellé français, le texte anglais qui part, et la case où elle sert.

        **Les deux moitiés sont obligatoires**, et c'est la définition : une
        étiquette sans texte anglais ne fait rien partir, une étiquette sans
        libellé ne se clique pas. C'est la paire qui est l'objet.
        """
        propre = " ".join(libelle.split())
        anglais = " ".join(texte.split())
        if not propre:
            raise EtiquetteRefusee("une étiquette a besoin d'un libellé à cliquer")
        if not anglais:
            raise EtiquetteRefusee(
                "une étiquette a besoin du texte anglais qui partira au modèle — "
                "c'est la moitié qui agit"
            )
        if case not in CHAMPS_BIBLE:
            raise EtiquetteRefusee(f"case de bible inconnue « {case} »")

        deja = list(self.toutes())
        if any(e.case == case and e.libelle.lower() == propre.lower() for e in deja):
            raise EtiquetteRefusee(
                f"« {propre} » existe déjà dans cette case — la reclíquer suffit"
            )

        deja.append(
            Etiquette(
                identifiant=_identifiant(case, propre),
                libelle=propre,
                texte=anglais,
                case=case,
            )
        )
        self._ecrire(deja)
        return tuple(deja)

    def servie(self, identifiant: str) -> tuple[Etiquette, ...]:
        """Compter un emploi. **Un compte, jamais un classement enregistré** :
        c'est lui qui met les plus employées en premier, et l'ordre de
        fabrication départage les ex æquo."""
        toutes = [e.servie() if e.identifiant == identifiant else e for e in self.toutes()]
        self._ecrire(toutes)
        return tuple(toutes)

    def oublier(self, identifiant: str) -> tuple[Etiquette, ...]:
        """Retirer une étiquette de la base.

        **Ce qu'elle a écrit dans une case ne bouge pas** : le texte est du
        texte, il est parti dans la case au moment du clic, et l'étiquette n'en
        est que l'origine. Jamais de cascade, ici comme ailleurs.
        """
        restantes = [e for e in self.toutes() if e.identifiant != identifiant]
        self._ecrire(restantes)
        return tuple(restantes)

    def en_json(self) -> dict[str, Any]:
        return {"etiquettes": [e.en_json() for e in self.toutes()]}

    def _ecrire(self, etiquettes: list[Etiquette]) -> None:
        self._fichiers.ecrire_etiquettes([e.en_json() for e in etiquettes])


def _identifiant(case: str, libelle: str) -> str:
    """Un repère lisible, dérivé du libellé — jamais un tirage au sort.

    C'est la règle de l'identifiant de projet : `etiquettes.json` s'ouvre à la
    main, et y lire `eclairage-brume-basse` plutôt qu'un jeton hexadécimal est
    ce qui rend vrai « les fichiers font foi ». Le suffixe départage deux
    libellés qui se réduiraient au même repère.
    """
    plat = unicodedata.normalize("NFKD", libelle.lower())
    plat = "".join(c for c in plat if not unicodedata.combining(c))
    tronc = re.sub(r"[^a-z0-9]+", "-", plat).strip("-")[:40] or "etiquette"
    marque = hashlib.sha256(f"{case}/{libelle}/{time.time()}".encode()).hexdigest()[:6]
    return f"{case}-{tronc}-{marque}"
