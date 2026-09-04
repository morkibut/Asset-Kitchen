# -*- coding: utf-8 -*-
"""Le rythme d'un clip — **où il se repose, et où il tourne en rond**.

Arrivé en A10 (V3). C'est le second module du traitement à regarder plusieurs
images à la fois, après `bande.py`, et il regarde autre chose : celui-là mesure
ce que le clip **occupe**, celui-ci ce qu'il **fait dans le temps**.

**Ce qu'il produit ne décide de rien.** C'est la règle déjà écrite de l'écran de
découpe, et elle vaut ici mot pour mot : *la détection propose, l'auteur juge*.
Deux propositions paraissent à l'ouverture du montage, l'auteur les prend, les
corrige image par image, ou les ignore. Une machine qui se trompe ne bloque donc
personne — c'est la seule forme sous laquelle une mesure automatique a le droit
d'entrer dans ce produit.

**Pourquoi deux propositions et pas une.** Un clip de cinq secondes porte deux
choses que l'auteur cherche, et elles ne se trouvent pas de la même façon :

- **un repos** — un moment où presque rien ne bouge. Il se trouve en regardant
  ce qui change d'une image à la suivante, et en gardant la plus longue suite
  qui ne change presque pas.
- **une boucle** — un cycle dont la dernière image enchaîne sur la première. Il
  se trouve en comparant des images **distantes**, ce que la mesure du repos ne
  fait jamais.

Chercher les deux avec la même mesure donnerait toujours le repos : un moment
immobile est la boucle parfaite, et la plus mauvaise animation qui soit. C'est
pour cette raison que la recherche de boucle **exige du mouvement à l'intérieur**
et non seulement une belle fermeture.

**Rien ici n'appelle le fournisseur, rien ici ne touche au disque** : le module
reçoit des images déjà décodées, et ne connaît que `numpy` et Pillow.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

import numpy as np

# Le côté de la vignette sur laquelle tout se mesure. **Petite exprès** : à ce
# format une image de 480 px pèse deux mille trois cents nombres au lieu de neuf
# cent mille, et comparer toutes les paires d'un clip de cent vingt images
# devient une multiplication de matrices plutôt qu'une attente. Ce qu'on perd en
# la réduisant est le détail ; ce qu'on cherche est un déplacement, qui survit.
COTE = 48

# La plus courte boucle qu'on propose. Moins de six images, ce n'est plus un
# cycle : c'est un battement, et une machine qui en proposerait ferait perdre du
# temps à chaque ouverture.
BOUCLE_MIN = 6

# Le plus court repos qu'on propose, pour la même raison exactement.
REPOS_MIN = 6

# Ce qu'on retient au plus d'une proposition. **Une proposition n'est pas une
# bande** : elle dit où regarder, et douze images suffisent à le montrer. Au-delà
# l'auteur trie plus qu'il ne juge, et le geste fin — prendre et laisser image
# par image — est là pour ça.
RETENUES_MAX = 12


@dataclass(frozen=True, slots=True)
class Proposition:
    """Un endroit du clip, et ce qu'on y garderait. **Jamais un verdict.**

    `mot` est la phrase que l'écran affiche telle quelle. Elle est écrite ici
    plutôt qu'à l'écran pour la raison habituelle du dépôt : l'agent lit les
    mêmes propositions que l'auteur, et deux formulations finiraient par ne plus
    dire la même chose.
    """

    quoi: str  # "repos" ou "boucle"
    debut: int
    fin: int  # inclus
    images: tuple[int, ...]
    mot: str
    # Ce que la mesure vaut, pour le banc et pour personne d'autre. L'écran ne
    # l'affiche pas : un chiffre sans échelle de comparaison ne renseigne pas,
    # il intimide.
    mesure: float = 0.0

    @property
    def longueur(self) -> int:
        return self.fin - self.debut + 1

    def en_json(self) -> dict[str, Any]:
        return {
            "quoi": self.quoi,
            "debut": self.debut,
            "fin": self.fin,
            "images": list(self.images),
            "mot": self.mot,
            "mesure": round(self.mesure, 5),
            "longueur": self.longueur,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Proposition":
        return Proposition(
            quoi=str(d.get("quoi") or ""),
            debut=int(d.get("debut", 0)),
            fin=int(d.get("fin", 0)),
            images=tuple(int(n) for n in d.get("images") or ()),
            mot=str(d.get("mot") or ""),
            mesure=float(d.get("mesure", 0.0)),
        )


def empreintes(images: Sequence[np.ndarray]) -> np.ndarray:
    """Une vignette par image, **toutes de la même taille**.

    Prises sur l'image **détourée mais pas recadrée**, et c'est le point qui
    décide de tout le reste. Recadrer chaque image sur sa propre silhouette
    ramènerait le sujet au même endroit dans chaque vignette : un personnage qui
    traverse l'écran paraîtrait immobile, et la mesure dirait « repos » sur la
    marche. **Le déplacement est justement ce qu'on cherche à voir.**

    L'alpha multiplie la luminance : ce que le détourage a effacé ne pèse rien,
    et le grain du fond d'une vidéo compressée ne se compte pas comme du
    mouvement.
    """
    from PIL import Image

    petites: list[np.ndarray] = []
    for rgba in images:
        if rgba.ndim != 3 or rgba.shape[2] < 4:  # pragma: no cover — toujours RGBA ici
            continue
        canaux = rgba[:, :, :3].astype(np.float32)
        luminance = (
            0.299 * canaux[:, :, 0] + 0.587 * canaux[:, :, 1] + 0.114 * canaux[:, :, 2]
        )
        valeur = luminance * (rgba[:, :, 3].astype(np.float32) / 255.0)
        vignette = Image.fromarray(valeur.astype(np.uint8)).resize(
            (COTE, COTE), Image.BOX
        )
        petites.append(np.asarray(vignette, dtype=np.float32).ravel() / 255.0)
    if not petites:
        return np.zeros((0, COTE * COTE), dtype=np.float32)
    return np.stack(petites)


def ecarts(signatures: np.ndarray) -> np.ndarray:
    """Ce qui change d'une image à la suivante, image par image.

    Rend `n - 1` nombres : `ecarts[i]` est la distance de l'image `i` à l'image
    `i + 1`. Zéro veut dire « rien n'a bougé », et c'est exactement ce qu'un
    repos vaut.
    """
    if len(signatures) < 2:
        return np.zeros(0, dtype=np.float32)
    return np.abs(np.diff(signatures, axis=0)).mean(axis=1)


def lire(images: Sequence[np.ndarray], cadence: float = 0.0) -> list[Proposition]:
    """Les deux propositions du clip, **ou moins**, et jamais rien de plus.

    Moins, quand le clip n'en porte pas : un clip entièrement immobile n'a pas
    de boucle à proposer, un clip qui bouge sans jamais se refermer n'en a pas
    non plus. **Ne rien proposer est une réponse**, et elle vaut mieux qu'une
    proposition inventée pour remplir la place : l'auteur n'aurait aucun moyen
    de savoir laquelle des deux est de la mesure et laquelle est du remplissage.

    `cadence` ne sert qu'à écrire les phrases — *une seconde et demie de repos*
    se lit mieux que *trente-six images*. Elle ne découpe rien : le montage
    travaille sur des numéros d'image, jamais sur des secondes.
    """
    signatures = empreintes(images)
    if len(signatures) < BOUCLE_MIN + 1:
        return []
    pas = ecarts(signatures)
    reference = _reference(pas)
    if reference <= 0:
        return []
    trouvees: list[Proposition] = []

    repos = _repos(pas, reference, cadence)
    if repos is not None:
        trouvees.append(repos)

    boucle = _boucle(signatures, pas, reference, cadence)
    if boucle is not None:
        trouvees.append(boucle)

    return trouvees


def _reference(pas: np.ndarray) -> float:
    """Ce que « bouger » vaut dans **ce** clip-ci. Tout le reste s'y mesure.

    > ### ⚠️ La médiane était le mauvais repère, et elle échouait exactement
    > ### quand le repos était le plus long (corrigé le 4 septembre 2026)
    >
    > La première version prenait la médiane du mouvement et appelait repos ce
    > qui en faisait moins de la moitié. Le raisonnement tenait — la médiane
    > résiste à une coupure franche là où la moyenne se laisse tirer — mais il
    > tombait sur le cas qu'on cherche : **un clip dont la moitié des images ne
    > bougent pas a une médiane nulle**, donc un seuil nul, donc aucun repos
    > trouvé. Mesuré sur un clip d'essai de vingt-quatre images dont douze sont
    > identiques : zéro proposition, ni repos ni boucle.
    >
    > Ce qui le remplace est **la moyenne de la moitié qui bouge le plus** :
    > elle résiste à une longue immobilité, qui reste dans l'autre moitié, et
    > elle résiste à une coupure isolée, qui n'est qu'une valeur parmi celles
    > qu'on moyenne. Les deux raisons de la médiane sont gardées ; le cas où
    > elle se retournait ne l'est pas.

    Zéro quand rien ne bouge du tout, et c'est une réponse : un clip immobile
    n'a ni repos à désigner — tout l'est — ni boucle à proposer.
    """
    if len(pas) == 0:
        return 0.0
    hautes = pas[pas >= float(np.median(pas))]
    return float(np.mean(hautes)) if len(hautes) else 0.0


# ── Le repos ─────────────────────────────────────────────────────────────────


def _repos(pas: np.ndarray, reference: float, cadence: float) -> Proposition | None:
    """La plus longue suite d'images où presque rien ne bouge.

    **Le seuil est relatif au clip, jamais absolu.** Un clip sombre bouge moins
    qu'un clip clair aux mêmes gestes, et un seuil écrit en dur dirait « repos »
    partout sur l'un et nulle part sur l'autre. On appelle donc repos ce qui
    bouge **moins du quart** de ce que bouge la moitié agitée de ce clip-ci.
    """
    if len(pas) < REPOS_MIN:
        return None
    seuil = reference * 0.25
    if seuil <= 0:  # pragma: no cover — `lire` a déjà écarté ce cas
        return None

    meilleur: tuple[int, int] | None = None
    debut = None
    for i, valeur in enumerate(pas):
        if valeur <= seuil:
            if debut is None:
                debut = i
            continue
        if debut is not None:
            meilleur = _plus_longue(meilleur, (debut, i))
            debut = None
    if debut is not None:
        meilleur = _plus_longue(meilleur, (debut, len(pas)))
    if meilleur is None:
        return None

    depart, arrivee = meilleur  # `arrivee` est le numéro de la dernière image
    if arrivee - depart + 1 < REPOS_MIN:
        return None
    images = _echantillon(depart, arrivee)
    return Proposition(
        quoi="repos",
        debut=depart,
        fin=arrivee,
        images=images,
        mot=(
            f"ici, il ne bouge presque pas — {_duree(arrivee - depart + 1, cadence)}, "
            f"images {depart} à {arrivee}"
        ),
        mesure=float(np.mean(pas[depart:arrivee])) if arrivee > depart else 0.0,
    )


def _plus_longue(
    garde: tuple[int, int] | None, candidat: tuple[int, int]
) -> tuple[int, int]:
    if garde is None:
        return candidat
    return candidat if (candidat[1] - candidat[0]) > (garde[1] - garde[0]) else garde


# ── La boucle ────────────────────────────────────────────────────────────────


def _boucle(
    signatures: np.ndarray, pas: np.ndarray, reference: float, cadence: float
) -> Proposition | None:
    """Le cycle dont la dernière image enchaîne le mieux sur la première.

    **Bien se refermer ne suffit pas.** Un moment immobile se referme
    parfaitement et ne vaut rien comme animation : c'est le repos, et il a déjà
    sa proposition. On divise donc la fermeture par le mouvement intérieur, et
    l'on écarte les cycles qui bougent moins de la moitié de ce que bouge la
    moitié agitée du clip. Ce qui gagne est **un cycle qui bouge et qui
    revient**, pas un cycle qui ne bouge pas.

    La recherche est exhaustive sur les départs et les longueurs, et elle peut
    l'être : à quarante-huit pixels de côté, un clip de cent vingt images tient
    en quelques milliers de comparaisons de vignettes.
    """
    n = len(signatures)
    if n < BOUCLE_MIN * 2:
        return None
    plancher = reference * 0.5
    if plancher <= 0:  # pragma: no cover — `lire` a déjà écarté ce cas
        return None

    meilleur: tuple[float, int, int] | None = None
    for periode in range(BOUCLE_MIN, n // 2 + 1):
        for depart in range(0, n - periode):
            interieur = float(np.mean(pas[depart : depart + periode]))
            if interieur < plancher:
                continue
            fermeture = float(
                np.abs(signatures[depart] - signatures[depart + periode]).mean()
            )
            score = fermeture / interieur
            if meilleur is None or score < meilleur[0]:
                meilleur = (score, depart, periode)

    if meilleur is None:
        return None
    score, depart, periode = meilleur
    fin = depart + periode - 1
    return Proposition(
        quoi="boucle",
        debut=depart,
        fin=fin,
        images=_echantillon(depart, fin),
        mot=(
            f"ici, la boucle se referme le mieux — {_duree(periode, cadence)}, "
            f"images {depart} à {fin}"
        ),
        mesure=score,
    )


# ── Ce qu'une proposition retient ────────────────────────────────────────────


def _echantillon(debut: int, fin: int) -> tuple[int, ...]:
    """Des images régulièrement espacées, **et c'est le seul endroit qui en pose**.

    Une proposition est un point de départ : elle échantillonne, parce qu'elle
    n'a aucun moyen de savoir où sont les instants qui comptent. **La bande, elle,
    n'est jamais forcée à des images régulièrement espacées** — un pas de marche
    demande deux images serrées au contact et une seule pendant la glisse, et
    c'est l'auteur qui le sait. Ce que cette fonction pose se corrige ensuite
    image par image, et c'est tout l'écran de montage.
    """
    total = fin - debut + 1
    if total <= RETENUES_MAX:
        return tuple(range(debut, fin + 1))
    rangs = np.linspace(debut, fin, RETENUES_MAX)
    return tuple(sorted({int(round(r)) for r in rangs}))


def _duree(images: int, cadence: float) -> str:
    """*Trente-six images* pour la machine, *une seconde et demie* pour l'œil.

    Sans cadence — un clip dont le fichier ne la déclare pas —, on écrit le
    compte d'images plutôt que d'inventer une durée. **Une durée fausse serait
    pire que pas de durée** : elle se lit sans se vérifier.
    """
    if cadence <= 0:
        return f"{images} images"
    secondes = images / cadence
    if secondes < 1:
        return f"{images} images"
    return f"{secondes:.1f} s".replace(".", ",")
