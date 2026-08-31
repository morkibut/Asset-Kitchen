# -*- coding: utf-8 -*-
"""Les étiquettes — décrire en cliquant plutôt qu'en rédigeant.

**Une étiquette est une paire** : un libellé qu'on clique, et le texte anglais
qui part vraiment au modèle. Cliquer *brume basse* écrit
`thick low-lying fog, volumetric haze` dans la case. C'est ce qui rend la
description **mécanique** au lieu d'être rédigée — on ne cherche plus comment
dire « il y a de la brume » à une intelligence artificielle : on l'a trouvé une
fois, on l'a nommé, on le reclique.

**Elle appartient à l'application, pas à un projet**, et c'est délibéré : comme
la clé du fournisseur, elle ne dépend d'aucun. La base naît **vide**, personne
ne l'écrit à la place de l'auteur, et elle grandit de chaque étiquette fabriquée
dans n'importe quel jeu. Un deuxième jeu part donc de ce que le premier a nommé
— sinon la base repartirait vide à chaque fois et le mécanisme ne servirait
jamais.

**Aucun vocabulaire existant ne conviendrait**, et c'est vérifié : les thésaurus
d'art donnent *baroque* et *gothique*, jamais *pixel art 16 bits* ni *vue de
dessus 3/4*. Et aucun ne donne la seconde moitié d'une étiquette — le texte
anglais qui marche sur une IA d'image. Cette moitié-là est du savoir-faire, pas
de la donnée.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Iterable


@dataclass(frozen=True, slots=True)
class Etiquette:
    """Un libellé, son texte anglais, et la case où elle sert.

    `case` est le nom d'un champ de la bible : une étiquette d'éclairage ne
    paraît pas dans la case du trait. Sans ce champ, la recherche rendrait
    quatorze étiquettes dont deux concernent la case ouverte, et la liste
    cesserait d'être une liste.

    `emplois` compte ce qui a servi — c'est lui qui met les plus employées en
    premier. **Un compte, jamais un classement enregistré** : deux étiquettes
    d'égal emploi gardent l'ordre où elles ont été fabriquées.
    """

    identifiant: str
    libelle: str
    texte: str
    case: str
    emplois: int = 0

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "libelle": self.libelle,
            "texte": self.texte,
            "case": self.case,
            "emplois": self.emplois,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Etiquette":
        return Etiquette(
            identifiant=str(d.get("identifiant") or ""),
            libelle=str(d.get("libelle") or ""),
            texte=str(d.get("texte") or ""),
            case=str(d.get("case") or ""),
            emplois=int(d.get("emplois", 0)),
        )

    def servie(self) -> "Etiquette":
        return replace(self, emplois=self.emplois + 1)


def etiquettes_depuis_json(brut: Any) -> tuple[Etiquette, ...]:
    if not isinstance(brut, (list, tuple)):
        return ()
    relues = (Etiquette.depuis_json(e) for e in brut if isinstance(e, dict))
    return tuple(e for e in relues if e.identifiant and e.libelle)


def rangees(etiquettes: Iterable[Etiquette], case: str) -> list[Etiquette]:
    """Celles de cette case-là, **les plus employées en premier**.

    L'ordre de fabrication départage les ex æquo : c'est l'ordre dans lequel
    l'auteur les a nommées, donc celui qu'il reconnaît.
    """
    dedans = [e for e in etiquettes if e.case == case]
    return sorted(dedans, key=lambda e: -e.emplois)
