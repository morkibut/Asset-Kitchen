# -*- coding: utf-8 -*-
"""Le lien — ce que la proximité ne dit pas.

**Le seul objet neuf du modèle depuis T4** (`docs/ARCHITECTURE.md` §5). T8 a
permis de *ranger* — un îlot est un groupe, et poser une carte dedans l'y range
pour de bon. T9 permet de **dire** : on tire d'un objet à un autre, et un trait
paraît.

**Il naît muet, et c'est la décision qui tient tout le reste.** Ni mot, ni
pointe : un trait nu dit déjà « ceci a rapport avec cela », et c'est le cas
courant. Le mot et la pointe s'ajoutent après, si le rapport mérite un mot et si
le sens compte. *Le défaut est muet, l'exception s'exprime* — l'inverse aurait
demandé, à chaque trait tiré, de répondre à deux questions dont la réponse est
presque toujours « rien ».

**Une extrémité est une carte ou un îlot, et les deux ne se nomment pas dans le
même espace.** Une carte a un identifiant ; un îlot n'en a pas — il *est* le
groupe, donc il se nomme par son nom de groupe (`docs/ARCHITECTURE.md` §5). D'où
le couple `(genre, valeur)` plutôt qu'un identifiant nu : deux espaces de noms
aplatis dans un seul champ auraient rendu possible le lien vers un îlot qui
s'appellerait comme une carte, et personne n'aurait su lequel des deux il
désignait. C'est la même leçon que le dédoublonnage des références de T4, où un
asset et une carte partent par le même tuyau sans se nommer pareil.

**Il ne survit pas à ses extrémités**, et c'est la suppression qui l'emporte,
jamais un balayage : un trait vers rien ne représente rien, et une entrée morte
sur le disque serait une deuxième vérité qui attend son heure. Un îlot n'ayant
pas d'existence propre, un lien vers un îlot part avec le dernier membre du
groupe — voir `ServiceUnivers._elaguer`.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

# ── Ce qu'une extrémité désigne ──────────────────────────────────────────────

CARTE = "carte"
ILOT = "ilot"
GENRES = (CARTE, ILOT)

# **Le mot d'un lien est une étiquette, pas une phrase** (`docs/archive/plan-versions-tenues.md` T9 :
# « une étiquette courte »). La borne n'est pas du confort : l'étiquette se pose
# au milieu d'un trait, entre deux objets qui peuvent être à trente pixels l'un
# de l'autre, et ce qui déborde recouvre ce qu'il relie. Au-delà, ce qu'on veut
# écrire est une note — et une note se pose à même la toile depuis cette
# tranche-ci, donc le produit a déjà l'endroit où le dire.
MOT_MAX = 32


@dataclass(frozen=True, slots=True)
class Bout:
    """Une extrémité : le genre de ce qu'elle désigne, et son nom dans cet
    espace-là. Gelée, parce qu'un lien qui changerait d'extrémité serait un
    autre lien — on en coupe un et on en tire un autre."""

    genre: str
    valeur: str

    def en_json(self) -> dict[str, str]:
        return {"genre": self.genre, "valeur": self.valeur}

    @staticmethod
    def depuis_json(d: Any) -> "Bout | None":
        """Une extrémité relue du disque, ou rien.

        Rien plutôt qu'une exception : un lien illisible est un lien qui n'a
        plus d'extrémité, donc un lien qui doit disparaître — et c'est déjà la
        règle. La lecture du tableau ne tombe pas pour un fichier abîmé.
        """
        if not isinstance(d, dict):
            return None
        genre, valeur = d.get("genre"), d.get("valeur")
        if genre not in GENRES or not isinstance(valeur, str) or not valeur:
            return None
        return Bout(genre, valeur)


@dataclass(slots=True)
class Lien:
    """Un trait entre deux objets de la toile, et ce qu'on a fini par en dire."""

    identifiant: str
    projet: str
    de: Bout
    vers: Bout

    # Les deux exceptions. Vides à la naissance, et elles le restent tant que le
    # rapport se passe d'être nommé.
    mot: str = ""
    pointe: bool = False

    cree_le: float = field(default_factory=time.time)

    # ── Ce qui se déduit ─────────────────────────────────────────────────────

    @property
    def bouts(self) -> tuple[Bout, Bout]:
        return (self.de, self.vers)

    def touche(self, bout: Bout) -> bool:
        """Ce lien aboutit-il à cet objet-là ? C'est la question que se pose une
        suppression, et la seule."""
        return bout in self.bouts

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "projet": self.projet,
            "de": self.de.en_json(),
            "vers": self.vers.en_json(),
            "mot": self.mot,
            "pointe": self.pointe,
            "cree_le": self.cree_le,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Lien | None":
        """Un lien relu du disque, ou rien s'il n'en est plus un.

        **Rien, et pas une exception.** Un lien dont une extrémité est illisible
        est déjà, par la règle de la tranche, un lien qui doit disparaître : le
        traiter comme absent est le traiter juste, et ça évite qu'un fichier
        abîmé emporte la lecture de toute la toile.
        """
        de = Bout.depuis_json(d.get("de"))
        vers = Bout.depuis_json(d.get("vers"))
        identifiant = d.get("identifiant")
        if not de or not vers or not isinstance(identifiant, str) or not identifiant:
            return None
        return Lien(
            identifiant=identifiant,
            projet=d.get("projet", ""),
            de=de,
            vers=vers,
            mot=str(d.get("mot", ""))[:MOT_MAX],
            pointe=bool(d.get("pointe", False)),
            cree_le=float(d.get("cree_le", 0.0)),
        )


def meme_paire(un: Lien, de: Bout, vers: Bout) -> bool:
    """Ces deux extrémités sont-elles déjà jointes, dans un sens ou dans l'autre ?

    **Le sens ne compte pas ici, alors qu'il compte pour la pointe.** Ce n'est
    pas une contradiction : la pointe dit *quel* rapport, le trait dit *qu'il y
    en a un*, et deux traits entre les deux mêmes objets se posent exactement
    l'un sur l'autre. Le second serait invisible — donc impossible à survoler,
    donc impossible à couper. Retourner un lien existant est un geste ; en
    empiler un second n'en est pas un.
    """
    return {un.de, un.vers} == {de, vers}
