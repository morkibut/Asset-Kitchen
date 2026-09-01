# -*- coding: utf-8 -*-
"""La base d'étiquettes — elle appartient à l'atelier, pas à un jeu.

**Elle naît pleine depuis le 1ᵉʳ septembre 2026**, et elle naissait vide avant.
Le renversement est écrit dans `atelier/domaine/etiquettes_livrees.py` : le
mécanisme des étiquettes existe pour rendre la description *mécanique au lieu
d'être rédigée*, et une base vide ne rend rien de mécanique — elle rend sept
cases blanches, en anglais, exactement l'écran d'avant l'assistant.

**Deux origines, une seule liste.** Les soixante-dix **livrées** arrivent avec
l'atelier ; les **fabriquées** sont ce que l'auteur a nommé, dans n'importe quel
jeu. Les deux se cliquent pareil et écrivent le même genre de texte ; ce qui les
distingue est une marque à l'écran, et le fait qu'une livrée retirée laisse une
pierre pour qu'on ne la lui rende pas.

**La base reste partagée par tous les jeux** : comme la clé du fournisseur, elle
ne dépend d'aucun d'eux. Ce qui a été nommé dans le premier sert au deuxième.

**Ce service ne connaît ni projet ni fournisseur.** Il lit un fichier à la
racine des données et il en rend une liste ; c'est tout, et ça se lit dans ses
imports.
"""

from __future__ import annotations

import hashlib
import re
import time
import unicodedata
from dataclasses import replace
from typing import Any

from atelier.depot import Fichiers
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.etiquette import Etiquette, etiquettes_depuis_json, rangees
from atelier.domaine.etiquettes_livrees import LIVREES
from atelier.domaine.projet import CHAMPS_BIBLE


class EtiquetteRefusee(ErreurAtelier):
    """Une étiquette n'est pas posable, et on dit pourquoi."""

    code = "etiquette_refusee"


class ServiceEtiquettes:
    def __init__(self, fichiers: Fichiers) -> None:
        self._fichiers = fichiers

    def toutes(self) -> tuple[Etiquette, ...]:
        """La base entière — **les livrées d'abord, les fabriquées ensuite**.

        **Le fichier fait foi sur ce qu'il porte ; le catalogue complète.** Une
        livrée que le fichier connaît déjà garde ce qu'il en dit — son compte
        d'emplois, et le fait qu'elle ait été retirée. Une livrée qu'il ne
        connaît pas est ajoutée. C'est ce qui permet d'en livrer de nouvelles
        dans une version suivante **sans redonner celles qu'on avait retirées**,
        et sans jamais remettre un compteur à zéro.

        **Les pierres ne sortent pas d'ici.** Une livrée retirée est dans le
        fichier avec `oubliee`, uniquement pour qu'on ne la lui rende pas ; elle
        n'a rien à faire dans une liste qu'on affiche.

        L'ordre est celui de la fabrication, livrées en tête : c'est
        `rangees` qui trie par emploi au moment de servir une case, et deux tris
        écrits à deux endroits finiraient par se contredire.
        """
        du_fichier = etiquettes_depuis_json(self._fichiers.lire_etiquettes())
        connues = {e.identifiant for e in du_fichier}
        neuves = tuple(e for e in LIVREES if e.identifiant not in connues)
        return tuple(e for e in neuves + du_fichier if not e.oubliee)

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
                f"« {propre} » existe déjà dans cette case — la recliquer suffit"
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

        **Une livrée laisse une pierre, une fabriquée disparaît.** La différence
        n'est pas un raffinement : le catalogue des livrées se relit à chaque
        lecture, donc effacer une livrée la ferait revenir à la ligne suivante,
        et l'auteur retirerait la même étiquette indéfiniment. La pierre porte
        son identifiant et rien d'autre d'utile — elle ne s'affiche nulle part.
        Une fabriquée n'a personne pour la remettre, donc rien à marquer.
        """
        restantes = [
            replace(e, oubliee=True) if e.identifiant == identifiant and e.livree else e
            for e in self.toutes()
            if e.identifiant != identifiant or e.livree
        ]
        self._ecrire(restantes)
        return tuple(e for e in restantes if not e.oubliee)

    def en_json(self) -> dict[str, Any]:
        return {"etiquettes": [e.en_json() for e in self.toutes()]}

    def _ecrire(self, etiquettes: list[Etiquette]) -> None:
        """Écrire la base — **et jamais perdre une pierre au passage**.

        Les appelants travaillent sur `toutes()`, qui ne rend pas les livrées
        retirées : écrire tel quel les ressusciterait au prochain rafraîchissement,
        parce que le catalogue complète ce que le fichier ne connaît pas. Elles
        sont donc reprises du disque et ajoutées en queue, quel que soit le
        geste qui a mené ici.
        """
        rendues = {e.identifiant for e in etiquettes}
        pierres = [
            e
            for e in etiquettes_depuis_json(self._fichiers.lire_etiquettes())
            if e.oubliee and e.identifiant not in rendues
        ]
        self._fichiers.ecrire_etiquettes([e.en_json() for e in etiquettes + pierres])


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
