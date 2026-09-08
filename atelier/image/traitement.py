# -*- coding: utf-8 -*-
"""Le post-traitement — CPU, pur, dans un ordre fixe.

**Ne touche jamais le GPU et n'appelle jamais le fournisseur** : invariant
instauré ici (`docs/archive/plan-versions-tenues.md`, T2). Aucune fonction de ce module ne fait d'entrée
ni de sortie ; elle reçoit des tableaux, elle en rend. C'est ce qui les rend
mesurables au banc et rejouables à l'identique.

Deux décisions ont été prises à la mesure, pas au jugé, le 27 août 2026 :

**Le détourage par défaut ne demande aucun modèle.** Le remplissage depuis le
bord — un pixel n'est du fond que s'il est *relié au bord* par une chaîne de
pixels proches de la couleur du bord — a rendu douze silhouettes propres sur
douze images de six modèles, PNG et JPEG, squelette blanc sur fond gris clair et
fioles translucides compris. Un seuil global aurait mangé le squelette ; la
chaîne jusqu'au bord ne le touche pas. Le second moteur (`rembg`) existe pour les
images qui n'ont pas été fabriquées ici et n'ont donc pas de fond plat — il est
facultatif, et grisé avec sa raison quand il n'est pas installé.

**L'alpha se durcit avant la réduction, jamais après.** Décision reprise de
`MySpriteAi/src/lib/pixelPipeline.ts`, où elle a été payée cher : un contour à
demi transparent est tranché à pile ou face par un rééchantillonnage au plus
proche voisin, et deux passes de suite rendent alors deux silhouettes
différentes.

**Le liseré clair naît du durcissement, pas de la quantification** — précisé le
31 août 2026, parce que la phrase d'avant laissait croire l'inverse et qu'un
commentaire de `atelier/domaine/recette.py` l'affirmait carrément. Ici,
`quantifier` met l'alpha de côté et le remet tel quel. Ce qui produit le liseré
est `durcir` : un pixel de contour à peine visible, dont la couleur est déjà
celle du fond, passe le seuil et ressort opaque de cette couleur-là. Le seuil de
la passe et son durcissement sont donc les deux seuls réglages qui l'atteignent.
`MySpriteAi` cumulait les deux moitiés — il forçait *aussi* l'alpha à 255 en
quantifiant ; c'est cette moitié-là qui n'a pas été reprise.
"""

from __future__ import annotations

import importlib.util
import io
import math
import os
from dataclasses import dataclass, replace
from typing import Any, Sequence

import numpy as np
from PIL import Image, ImageDraw

from atelier.domaine.recette import (
    AU_PLUS_PROCHE,
    BAS,
    BORD,
    BORDS,
    CONTOURS,
    COULEUR,
    DETOURAGE,
    FLOYD,
    GAUCHE_DROITE,
    GRILLE,
    LA_MAIN,
    LANCZOS,
    LAISSES,
    MODELE,
    PARTOUT,
    PIXELOE,
    QUANTIFICATION,
    RECADRAGE,
    RETOURNEMENT,
    TRACE,
    VOTE,
    Bords,
    CalqueDessin,
    Contour,
    Designation,
    Echange,
    Grille,
    LISSAGE_MAX,
    Main,
    Passe,
    Quantification,
    Recadrage,
    Recette,
    Retournement,
    TOLERANCE_POCHES,
    Trait,
    parts_de,
    cote_du_canevas,
    cote_du_sujet,
)

__all__ = [
    "GrilleRetrouvee",
    "MesuresDuFond",
    "MoteurAbsent",
    "Rendu",
    "appliquer",
    "appliquer_designations",
    "boite_opaque",
    "boucher_les_trous",
    "composantes",
    "contourner",
    "detourer",
    "detourer_bord",
    "detourer_couleur",
    "detourer_trace",
    "durcir",
    "etat_des_silhouettes",
    "etendre",
    "en_rendu",
    "finir",
    "garder_le_sujet_seul",
    "mesurer_grille",
    "mesures_du_fond",
    "methode_disponible",
    "modele_descendu",
    "moteur_disponible",
    "peindre",
    "pinceau",
    "pose_du_calque",
    "pourtour",
    "queue",
    "raison_du_modele",
    "raison_methode",
    "raison_moteur",
    "reboucher_les_poches_de_fond",
    "regonfler_puis_ronger",
    "restreindre",
    "retoucher",
    "retourner",
    "retrouver_grille",
    "ronger",
    "ronger_puis_regonfler",
    "sans_les_deux_dernieres",
    "sans_moteur",
    "silhouette",
    "voter_les_voisins",
]


class MoteurAbsent(Exception):
    """Le moteur demandé n'est pas installé sur cette machine.

    Ne devrait jamais atteindre l'auteur par surprise : le service grise le
    moteur avec sa raison avant qu'on puisse le choisir. C'est le filet.
    """


@dataclass(frozen=True, slots=True)
class Rendu:
    """Le résultat d'une recette : des octets PNG, et ce qu'on a mesuré dessus."""

    octets: bytes
    largeur: int
    hauteur: int


# ── Le second moteur, et son absence ─────────────────────────────────────────
#
# Importé **paresseusement, une seule fois**. `rembg` charge un modèle ONNX de
# 176 Mo au premier appel et le télécharge s'il n'est pas déjà en cache :
# l'importer au démarrage ferait payer ça à l'ouverture de l'atelier, et
# échouerait hors ligne — or « le démarrage n'affiche aucune erreur » est un
# critère de T1 qu'aucune tranche ne renégocie.

# **Le modèle est nommé, jamais laissé au défaut de la bibliothèque.** Mesuré le
# 27 août 2026, à la première exécution réelle de ce chemin
# (`essais/essai_detourage_modele.py`) : le défaut de `rembg` 2.0.81 est
# `bria-rmbg`, un modèle d'un gigaoctet qui met **15,8 s** par image de 1024 px
# sur processeur. `u2net` met **0,47 s** — trente-quatre fois moins — pour une
# silhouette équivalente à deux points de pourcentage près. Le défaut d'une
# bibliothèque est une cible mouvante : celui-ci a changé sous une note du dépôt
# qui annonçait « ~180 Mo », et c'est la taille de `u2net`. On le nomme.
#
# **Et depuis U13, on n'en nomme plus un seul.** *Le catalogue décide, jamais une
# liste en dur* est la règle du dépôt pour les modèles d'image ; elle vaut ici
# pour la même raison, et un nom inscrit dans le code interdisait d'en essayer un
# autre sans toucher au code. Cinq modèles depuis D4, et le choix se fait passe
# par passe.
#
# ── Le défaut change en D4, et il change **sur mesure** ──────────────────────
#
# **`u2net` était le défaut, et il infère à 320 × 320.** Son masque est ensuite
# réagrandi en Lanczos à la taille de l'image : sur une image de 1024, c'est une
# carte de 320 étirée trois fois. Ce qui est plus fin que trois pixels y
# disparaît. `isnet-general-use` infère à 1024 et ne réagrandit rien.
#
# **Mesuré le 3 septembre 2026** — `essais/essai_moteurs_de_detourage.py`,
# gratuit, quatre images du dépôt, les deux modèles sur les mêmes :
#
# | | `u2net` | `isnet-general-use` |
# |---|---|---|
# | côté d'inférence | 320 | **1024** |
# | part gardée | 0,219 | 0,215 |
# | accord des deux silhouettes | 0,977 | — |
# | **trous percés** (l'ajouré trouvé) | 2,5 | **3,8** |
# | durée | 0,65 s | 1,33 s |
#
# **C'est la ligne des trous qui tranche**, et c'est la seule qui sépare
# vraiment deux masques à part gardée égale : `isnet` trouve **une moitié de
# détails ajourés en plus** — l'espace entre un bras et un torse, une boucle de
# ceinture, une frange. La part gardée, elle, ne dit rien : les deux gardent la
# même surface, en la découpant différemment.
#
# **Ce que ça coûte : 0,7 seconde par image, et seulement sur le moteur par
# modèle** — qui n'est pas le moteur par défaut du produit. Le remplissage
# depuis le bord reste imbattable sur ce que l'atelier fabrique, à fond plat, en
# 130 ms ; le moteur par modèle sert les images **importées**, où l'on ne compte
# pas à la demi-seconde.
#
# ⚠️ **Ce changement rejoue les passes par modèle qui n'ont pas nommé leur
# modèle**, et c'est le prix, écrit une fois : une recette d'avant U13 ne porte
# aucun nom, `silhouette("")` retombe sur ce défaut-ci, et son rendu change. Les
# recettes qui nomment `u2net` explicitement ne bougent pas d'un pixel.
MODELE_ONNX = "isnet-general-use"


@dataclass(frozen=True, slots=True)
class Silhouette:
    """Un modèle de détourage — ce qu'il pèse, ce qu'il vaut, ce qu'il coûte.

    `nom` est celui de `rembg`, écrit tel quel dans la recette ; `fichier` est
    le `.onnx` qu'il pose sur le disque, et c'est par lui qu'on sait s'il est
    déjà descendu.

    **Les octets sont un relevé, pas une estimation** — `essais/essai_moteurs_silhouette.py`,
    le 1ᵉʳ septembre 2026 : deux sont lus sur le disque de cette machine, le
    troisième par une question à l'adresse de téléchargement qui ne rapatrie
    rien. Un poids annoncé au jugé serait exactement le genre de chiffre qu'on
    croit avant de lancer une attente de plusieurs minutes.

    ── Deux champs ajoutés en D4, et le premier est le cœur de la tranche ─────

    `entree` est le côté auquel le modèle **infère**, et il ne se confond pas
    avec la taille de l'image qu'on lui donne : `u2net` ramène tout à 320 × 320,
    calcule là-dessus, puis **réagrandit son masque en Lanczos** à la taille de
    l'image. Sur une image de 1024, c'est une carte de 320 étirée trois fois —
    ce qui est plus fin que trois pixels disparaît, les coins s'arrondissent, et
    le rebond de Lanczos fabrique des alphas à 240–254 *à l'intérieur* du sujet.
    `isnet` et `birefnet` infèrent à 1024. **Ce nombre-là décide de ce qu'un
    modèle peut rendre**, et il n'était nulle part.

    `licence` est celle du modèle, pas celle de `rembg`. Elle est écrite parce
    que la question s'est posée une fois et se reposera : *l'atelier est un
    projet personnel, rien n'en sort commercialement*, et l'auteur choisit en le
    sachant (arbitrage du 2 septembre 2026). Le jour où quelque chose sortirait
    de ce jeu contre de l'argent, elle se relit — pour ces modèles comme pour
    tous les autres.
    """

    nom: str
    titre: str
    fichier: str
    octets: int
    lent: bool
    note: str
    entree: int = 320
    licence: str = ""


# **Cinq modèles depuis D4, et les deux neufs répondent à deux manques réels.**
#
# La première version de la tranche en réclamait un troisième — *« il manque un
# cran entre nos deux modèles »* — et se trompait : le produit en portait trois
# depuis `U13`, celui du milieu s'appelant littéralement « intermédiaire ».
# L'erreur venait du relevé d'outillage, recopiée sans vérifier. Ce qui reste
# vrai après le tri est écrit ci-dessous, modèle par modèle.
#
# **L'ordre de la liste est celui du poids**, et c'est aussi l'ordre où l'écran
# les propose : on descend jusqu'à ce qu'on accepte d'attendre.
SILHOUETTES: tuple[Silhouette, ...] = (
    Silhouette(
        nom="isnet-anime",
        titre="dessin",
        fichier="isnet-anime.onnx",
        octets=176_069_933,
        lent=False,
        entree=1024,
        licence="Apache-2.0",
        note=(
            "le seul entraîné sur du dessin — mais il apprend à découper un "
            "personnage d'un seul tenant, et il bouche l'ajouré : 2,2 trous "
            "trouvés contre 3,8 au défaut, mesuré le 3 septembre 2026. C'est "
            "celui qui s'écarte le plus des autres"
        ),
    ),
    Silhouette(
        nom="birefnet-general-lite",
        titre="léger",
        fichier="birefnet-general-lite.onnx",
        # ⚠️ **214 Mo et non 88,6**, pesé sur le disque le 3 septembre 2026. Le
        # chiffre de 88,6 Mo que le plan et le relevé d'outillage annonçaient est
        # celui des poids PyTorch du modèle, pas de l'export ONNX que `rembg`
        # rapatrie. C'est un quart du lourd, pas un onzième — et c'est encore une
        # bonne affaire, voir la note.
        octets=224_005_088,
        lent=False,
        entree=1024,
        licence="MIT",
        note=(
            "l'allégé du lourd, et il le bat : mesuré le 3 septembre 2026, il "
            "trouve plus d'ajouré que lui — 4,8 trous contre 3,5 — en deux fois "
            "moins de temps, pour un quart du poids. Les deux silhouettes "
            "s'accordent à 99,5 %"
        ),
    ),
    Silhouette(
        nom="u2net",
        titre="rapide",
        fichier="u2net.onnx",
        octets=175_997_641,
        lent=False,
        entree=320,
        licence="Apache-2.0",
        # ⚠️ **La note ne redit pas le côté d'inférence**, et c'est une
        # correction du 3 septembre 2026 : l'écran l'écrit désormais pour *tous*
        # les modèles à partir de `entree`, et la note le répétait mot pour mot
        # juste au-dessus. Vu au navigateur, pas dans le code. La note ne garde
        # donc que ce qu'elle seule peut dire.
        note="le plus rapide — 0,9 s par image, mesuré le 1er septembre 2026",
    ),
    Silhouette(
        nom="isnet-general-use",
        titre="intermédiaire",
        fichier="isnet-general-use.onnx",
        octets=178_648_008,
        lent=False,
        entree=1024,
        licence="Apache-2.0",
        note=(
            "le défaut du produit depuis le 3 septembre 2026 : presque le même "
            "résultat que le rapide — 96 à 99 % d'accord — pour un cinquième de "
            "temps en plus, et une moitié d'ajouré en plus"
        ),
    ),
    Silhouette(
        nom="birefnet-general",
        titre="lourd",
        fichier="birefnet-general.onnx",
        octets=972_666_916,
        lent=True,
        entree=1024,
        licence="MIT",
        note=(
            "quatre fois plus lourd que l'allégé de sa famille, et mesuré "
            "moins bon que lui le 3 septembre 2026 : moins d'ajouré trouvé, "
            "deux fois plus de temps. Gardé pour que la comparaison reste "
            "refaisable"
        ),
    ),
)


def silhouette(nom: str) -> Silhouette | None:
    """Le modèle de ce nom-là, ou rien. Vide veut dire *le défaut du produit*."""
    cherche = nom or MODELE_ONNX
    return next((s for s in SILHOUETTES if s.nom == cherche), None)


def _dossiers_des_modeles() -> tuple[str, ...]:
    """Où `rembg` pose ses `.onnx`, **lus et jamais écrits**.

    **Une lecture du disque, et non une seconde mécanique de téléchargement.**
    On ne peut pas le demander à `rembg` : l'importer tire `onnxruntime` dans le
    processus, or « le post-traitement ne touche jamais le GPU » se *prouve* en
    regardant `sys.modules` (`tests/test_t2.py`), et cette question-ci se pose à
    chaque ouverture d'atelier. On regarde donc aux deux endroits qu'il emploie
    — le dossier par modèle d'aujourd'hui, et l'ancien dossier plat qu'il relit
    encore —, et `tests/test_u13.py` confronte ces chemins à ceux que `rembg`
    calcule, **dans un autre processus**, pour que la comparaison ne charge rien
    ici. Le pire qu'une divergence puisse faire est d'annoncer un
    téléchargement qui n'aura pas lieu ; elle ne peut pas fausser un rendu.
    """
    maison = os.getenv("U2NET_HOME")
    plat = os.path.expanduser(
        maison or os.path.join(os.getenv("XDG_DATA_HOME", "~"), ".u2net")
    )
    if maison:
        return (plat,)
    xdg = os.getenv("XDG_DATA_HOME")
    racine = os.path.expanduser(
        os.path.join(xdg, "rembg") if xdg else os.path.join("~", ".rembg")
    )
    return (os.path.join(racine, "models"), plat)


def modele_descendu(nom: str) -> bool:
    """Le `.onnx` de ce modèle est-il déjà sur cette machine ?

    **La seconde des deux absences** (U13) : un moteur *pas installé du tout*
    est grisé avec sa raison ; un moteur *installé dont le modèle n'est pas
    encore descendu* reste choisissable et dit ce qu'il va rapatrier. Griser les
    deux aurait obligé à sortir de l'atelier pour un téléchargement que
    l'atelier sait faire ; les confondre aurait laissé tomber une attente de
    plusieurs minutes sur un geste annoncé comme lent de quelques secondes.
    """
    sil = silhouette(nom)
    if sil is None:
        return False
    for dossier in _dossiers_des_modeles():
        if os.path.exists(os.path.join(dossier, sil.nom, sil.fichier)):
            return True
        if os.path.exists(os.path.join(dossier, sil.fichier)):
            return True
    return False


def etat_des_silhouettes() -> list[dict[str, Any]]:
    """Le catalogue tel que l'écran le lit — **il n'en recompose aucun**."""
    absent = raison_moteur(MODELE)
    return [
        {
            "nom": s.nom,
            "titre": s.titre,
            "octets": s.octets,
            "lent": s.lent,
            "note": s.note,
            # **Le côté auquel il infère** (D4). C'est ce qui sépare un masque
            # calculé à la taille de l'image d'un masque calculé en 320 puis
            # étiré : l'écran le dit, parce qu'aucune autre ligne ne l'explique.
            "entree": s.entree,
            "licence": s.licence,
            "defaut": s.nom == MODELE_ONNX,
            "descendu": modele_descendu(s.nom),
            "raison": absent,
        }
        for s in SILHOUETTES
    ]


#: Une session par modèle, gardée entre deux rendus. Un modèle ONNX met une
#: seconde à s'ouvrir et pèse jusqu'à un gigaoctet : le recharger à chaque passe
#: coûterait plus cher que le détourage lui-même.
_sessions_modeles: dict[str, object] = {}


def moteur_disponible(moteur: str) -> bool:
    return raison_moteur(moteur) is None


def raison_moteur(moteur: str) -> str | None:
    """La raison du grisé, en clair — ou `None` si le moteur est là.

    « Ce qui est indisponible est grisé avec sa raison, jamais proposé puis
    refusé » (`docs/PLAN.md` § Les invariants, étendu par T2). Le moteur absent
    est précisément l'une des nouvelles raisons que cette tranche apporte.

    **On cherche le paquet, on ne l'importe pas.** `import rembg` tire
    `onnxruntime` dans le processus au premier `GET /api/status` — donc à
    l'ouverture de l'atelier, pour la seule question « faut-il griser ce
    bouton ? ». Or « le post-traitement ne touche jamais le GPU » se **prouve**
    en regardant `sys.modules` (`tests/test_t2.py`) : une machine où le second
    moteur est installé aurait fait tomber ce test sans qu'aucun détourage par
    modèle ait eu lieu. `find_spec` répond à la même question sans rien charger,
    et l'inférence n'entre dans le processus qu'au moment où on la demande.
    """
    # La pipette n'a rien à télécharger : c'est le même remplissage par plages
    # que le bord, amorcé ailleurs. Elle est donc toujours là, comme lui. La
    # sélection magique non plus (U12) : c'est encore le même remplissage, borné
    # cette fois par ce qu'on a entouré.
    if moteur in (BORD, COULEUR, TRACE):
        return None
    if moteur != MODELE:
        return f"moteur inconnu — « {moteur} »"
    try:
        if importlib.util.find_spec("rembg") is None:
            return "le moteur par modèle n'est pas installé"
    except (ImportError, ValueError):  # noqa: BLE001 — l'absence n'est pas une panne
        return "le moteur par modèle n'est pas installé"
    return None


def _detourer_modele(rgb: np.ndarray, modele: str = "") -> np.ndarray:
    """La silhouette rendue par un modèle. **Une session par modèle** (U13) :
    en garder une seule aurait rechargé un gigaoctet à chaque va-et-vient entre
    deux passes qui ne nomment pas le même."""
    if raison_moteur(MODELE) is not None:
        raise MoteurAbsent("le moteur par modèle n'est pas installé")
    sil = silhouette(modele)
    if sil is None:
        raise MoteurAbsent(f"modèle de silhouette inconnu — « {modele} »")
    import rembg  # type: ignore[import-not-found]

    if sil.nom not in _sessions_modeles:
        _sessions_modeles[sil.nom] = rembg.new_session(sil.nom)
    image = Image.fromarray(rgb, mode="RGB")
    sortie = rembg.remove(image, session=_sessions_modeles[sil.nom])
    return np.asarray(sortie.convert("RGBA"))[:, :, 3]


# ── Le détourage par le bord ─────────────────────────────────────────────────


def _couleur_du_bord(rgb: np.ndarray) -> np.ndarray:
    """La médiane des pixels de bordure. La médiane, pas la moyenne : un sujet
    qui touche un bord déplacerait la moyenne, il ne déplace pas la médiane."""
    bordure = np.concatenate(
        [rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :]], axis=0
    )
    return np.median(bordure.astype(np.int16), axis=0)


def _remplir(proche: np.ndarray, graines: list[tuple[int, int]]) -> np.ndarray:
    """Remplissage par plages, amorcé où on le lui dit.

    Par plages et non pixel à pixel : une file de pixels sur une image de
    1024 × 1024 se compte en centaines de milliers d'entrées et met près d'une
    seconde en Python, ce qui interdirait « chaque réglage répond sans attente
    perceptible ». Une plage est une ligne de fond entière, trouvée d'un coup par
    numpy — il y en a quelques milliers, pas un million.

    **Les graines sont devenues un argument en E3**, quand la pipette est
    arrivée : elle part d'un point désigné là où le moteur du bord part des
    quatre bordures, et c'est *toute* leur différence. Deux remplissages par
    plages dans le même fichier auraient fini par se répondre différemment sur
    la même image — la crainte est écrite noir sur blanc dans `composantes`, qui
    a été rendue publique pour la même raison.
    """
    hauteur, largeur = proche.shape
    fond = np.zeros_like(proche)
    pile: list[tuple[int, int]] = list(graines)

    def semer(y: int, debut: int, fin: int) -> None:
        """Une graine par sous-plage libre, jamais une par pixel."""
        if not (0 <= y < hauteur):
            return
        libre = proche[y, debut : fin + 1] & ~fond[y, debut : fin + 1]
        if not libre.any():
            return
        borde = np.concatenate(([False], libre, [False])).astype(np.int8)
        for depart in np.flatnonzero(np.diff(borde) == 1):
            pile.append((y, debut + int(depart)))

    while pile:
        y, x = pile.pop()
        if fond[y, x] or not proche[y, x]:
            continue
        ligne = proche[y] & ~fond[y]
        fermes = np.flatnonzero(~ligne)
        avant = fermes[fermes < x]
        apres = fermes[fermes > x]
        debut = int(avant[-1]) + 1 if avant.size else 0
        fin = int(apres[0]) - 1 if apres.size else largeur - 1
        fond[y, debut : fin + 1] = True
        semer(y - 1, debut, fin)
        semer(y + 1, debut, fin)

    return fond


def _graines_du_bord(proche: np.ndarray) -> list[tuple[int, int]]:
    """Les quatre bordures, en plages — les amorces du moteur courant."""
    hauteur, largeur = proche.shape
    graines: list[tuple[int, int]] = []
    for y in (0, hauteur - 1):
        libre = proche[y]
        borde = np.concatenate(([False], libre, [False])).astype(np.int8)
        graines.extend((y, int(d)) for d in np.flatnonzero(np.diff(borde) == 1))
    for y in range(hauteur):
        if proche[y, 0]:
            graines.append((y, 0))
        if proche[y, largeur - 1]:
            graines.append((y, largeur - 1))
    return graines


def detourer_bord(rgb: np.ndarray, tolerance: int) -> np.ndarray:
    """L'alpha d'une image dont le fond est plat — le cas de tout ce qui sort d'ici.

    Un pixel n'est du fond que s'il est **relié au bord** par une chaîne de
    pixels proches de la couleur de bordure. C'est toute la différence avec un
    seuil global : un blanc à l'intérieur du sujet — l'os d'un squelette, le
    reflet d'une fiole — n'est relié à rien, et reste.
    """
    cible = _couleur_du_bord(rgb)
    ecart = np.abs(rgb.astype(np.int16) - cible).max(axis=2)
    proche = ecart <= tolerance
    fond = _remplir(proche, _graines_du_bord(proche))
    return np.where(fond, np.uint8(0), np.uint8(255))


def detourer_couleur(
    rgb: np.ndarray,
    point: tuple[int, int],
    tolerance: int,
    *,
    partout: bool = False,
    reste: np.ndarray | None = None,
) -> np.ndarray:
    """L'alpha d'une image dont on a **désigné le fond du doigt** (E3).

    Le recours pour ce que le remplissage depuis le bord ne peut pas atteindre :
    une poche de fond entièrement enfermée par le sujet n'est reliée à aucune
    bordure, donc aucune valeur de tolérance ne l'efface. Ici l'amorce n'est
    plus la bordure, c'est le point.

    Deux portées, et elles ne se ressemblent pas :

    - **la zone d'un seul tenant** sous le point — le geste pour lequel la
      pipette a été admise. Elle règle une poche sans toucher au reste, et c'est
      pour ça que c'est le défaut ;
    - **toutes les zones de cette couleur**, celles qui touchent le sujet
      comprises. Plus expéditif, plus risqué, et il n'y a rien à faire pour le
      rendre sûr : c'est le choix de l'auteur, écrit dans la recette.

    `point` est en pixels de cette image, `(x, y)`. **Hors cadre, rien ne se
    passe** — une passe qu'on n'a pas encore visée ne mange pas l'image en
    attendant qu'on la vise.

    ── `reste` : ce qui est encore là, et pourquoi ça change tout (U10) ──────

    **Effacer un pixel ne change pas sa couleur, il ne change que sa
    transparence.** Une seconde passe lit donc, dans `rgb`, un fond que la
    première a déjà retiré et qui, pour elle, est encore là. La propagation de
    proche en proche traversait ces pixels-là : ils forment un couloir continu
    à la couleur du fond, la tache repartait par ce couloir et ressortait
    ailleurs dans l'image, sur une zone qui n'avait rien à voir avec le point
    désigné. C'est le défaut de la pipette sur une seconde passe, reproduit et
    mesuré le 1<sup>er</sup> septembre 2026 — `essais/essai_pipette_seconde.py`.

    `reste` est le masque de ce qui n'a pas encore été effacé. **Rien de ce qui
    est déjà parti ne peut servir de chemin ni de cible** : la zone d'un seul
    tenant est celle qu'on voit, et c'est la seule lecture qui rende la pipette
    prévisible. Sans lui — un appel qui ne le passe pas —, le comportement
    d'avant est conservé tel quel.
    """
    hauteur, largeur = rgb.shape[:2]
    x, y = point
    if not (0 <= x < largeur and 0 <= y < hauteur):
        return np.full((hauteur, largeur), np.uint8(255))
    cible = rgb[y, x].astype(np.int16)
    proche = np.abs(rgb.astype(np.int16) - cible).max(axis=2) <= tolerance
    if reste is not None:
        proche = proche & reste
    fond = proche if partout else _remplir(proche, [(y, x)])
    return np.where(fond, np.uint8(0), np.uint8(255))


# ── La sélection magique — tracer gros, ajuster au bord (U12) ────────────────


def dedans_du_trace(
    trace: Sequence[tuple[int, int]], forme: tuple[int, int]
) -> np.ndarray:
    """Le dedans de la forme entourée, en pixels — **fermée d'office**.

    **La seconde rasterisation du dépôt, et elle est déterministe comme la
    première.** `pinceau` l'était par obligation — une recette rejouée doit
    rendre le même masque, c'est un critère depuis T2 —, et celle-ci l'est pour
    la même raison. Le remplissage de polygone de Pillow en mode `L` ne lisse
    rien : un pixel est dedans ou dehors, jamais à demi. Un remplissage lissé
    aurait fabriqué un bord flou dont le seuil aurait ensuite décidé à pile ou
    face, et deux rendus de la même recette auraient différé d'un pixel.

    Moins de trois points ne délimite rien : un masque vide, et la passe ne
    retire rien — comme une pipette qu'on n'a pas encore visée.
    """
    hauteur, largeur = forme
    if len(trace) < 3:
        return np.zeros((hauteur, largeur), dtype=bool)
    toile = Image.new("L", (largeur, hauteur), 0)
    ImageDraw.Draw(toile).polygon(
        [(int(x), int(y)) for x, y in trace], fill=255, outline=255
    )
    return np.asarray(toile) > 0


def detourer_trace(
    rgb: np.ndarray,
    trace: Sequence[tuple[int, int]],
    tolerance: int,
    *,
    reste: np.ndarray | None = None,
) -> np.ndarray:
    """L'alpha d'une image dont on a **entouré grossièrement le sujet** (U12).

    **Le tracé borne la recherche, il ne la lance pas**, et c'est toute l'idée.
    On entoure largement ce qu'on veut garder ; l'atelier part du liseré de ce
    qu'on a tracé — des pixels de fond, puisqu'on a tracé *autour* — et remplit
    vers l'intérieur jusqu'à buter sur le sujet. Ce qui sort est le bord du
    sujet lui-même, trouvé dans les pixels, et non le trait tremblant qu'on a
    fait à la main.

    **Rien ne bouge au-dehors.** Le remplissage est enfermé dans la forme : une
    sélection magique ne décide pas du reste de l'image, elle répond de ce qu'on
    a entouré. C'est ce qui la rend cumulable avec les autres passes plutôt que
    concurrente — on peut entourer un bras, puis l'autre.

    **La couleur visée est la médiane du liseré**, comme le moteur du bord prend
    la médiane de la bordure de l'image, et pour la même raison : un sujet qui
    dépasse du tracé déplacerait une moyenne, il ne déplace pas une médiane.
    Elle se lit à chaque rendu et ne se range pas dans la recette — même règle
    que la couleur de la pipette.

    `reste` est ce qui n'a pas encore été effacé (U10) : ce qui est déjà parti
    n'est plus un chemin.
    """
    hauteur, largeur = rgb.shape[:2]
    dedans = dedans_du_trace(trace, (hauteur, largeur))
    if not dedans.any():
        return np.full((hauteur, largeur), np.uint8(255))

    # Le liseré : l'anneau d'un pixel juste à l'intérieur du trait. C'est de là
    # qu'on part, et c'est lui qui donne la couleur du fond.
    lisere = dedans & ~restreindre(dedans, 1)
    if not lisere.any():
        return np.full((hauteur, largeur), np.uint8(255))
    cible = np.median(rgb[lisere].astype(np.int16), axis=0)
    proche = np.abs(rgb.astype(np.int16) - cible).max(axis=2) <= tolerance
    proche = proche & dedans
    if reste is not None:
        proche = proche & reste

    graines = [(int(y), int(x)) for y, x in np.argwhere(lisere & proche)]
    if not graines:
        return np.full((hauteur, largeur), np.uint8(255))
    fond = _remplir(proche, graines)
    return np.where(fond, np.uint8(0), np.uint8(255))


# ── Le bord du sujet ─────────────────────────────────────────────────────────


def durcir(alpha: np.ndarray, seuil: int) -> np.ndarray:
    """Franchement opaque, ou franchement absent. Rien entre les deux."""
    return np.where(alpha >= seuil, np.uint8(255), np.uint8(0))


def ronger(alpha: np.ndarray, pixels: int) -> np.ndarray:
    """Érosion en croix, `pixels` fois — **l'érosion aveugle** (US-70).

    Ce qui reste d'un halo après le seuil, c'est un ou deux pixels de contour à
    la couleur du fond. Les ronger coûte un liseré de sprite ; ne pas les ronger
    coûte un halo. Le réglage existe pour que l'auteur tranche, image par image.

    ⚠️ **Ce n'est plus ce que le produit emploie depuis D4** — voir
    `ronger_conditionnel` juste dessous, qui n'ôte que ce qui est effectivement
    contaminé. Celle-ci reste, et elle reste publique : c'est le témoin contre
    lequel la conditionnelle se mesure (`essais/essai_moteurs_de_detourage.py`),
    et un témoin qu'on retire est une comparaison qu'on ne peut plus refaire.
    """
    if pixels <= 0:
        return alpha
    plein = alpha > 0
    for _ in range(pixels):
        garde = plein.copy()
        garde[1:, :] &= plein[:-1, :]
        garde[:-1, :] &= plein[1:, :]
        garde[:, 1:] &= plein[:, :-1]
        garde[:, :-1] &= plein[:, 1:]
        plein = garde
    return np.where(plein, alpha, np.uint8(0))


def _voisin_interieur(rgb: np.ndarray, sujet: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Pour chaque pixel de bord, la couleur d'un voisin **franchement intérieur**.

    Rend deux tableaux : la couleur retenue, et un masque disant où l'on en a
    trouvé une. Un pixel de bord dont les quatre voisins sont eux-mêmes des
    pixels de bord — une partie fine d'un pixel d'épaisseur — n'en a pas, et
    c'est un cas qu'on veut savoir distinguer : **on ne ronge pas un trait fin**,
    parce que le ronger le fait disparaître.

    **Un voisin, jamais une moyenne**, et c'est la même règle que pour la
    couleur d'un contour : une moyenne de deux voisins fabrique une teinte que
    l'image ne contient pas, et on chercherait ensuite d'où elle vient. L'ordre
    — les quatre côtés, puis les quatre coins — est fixe, donc le résultat est
    déterministe, ce qui est un critère du dépôt et non un confort.

    **Huit voisins ici, quatre dans `pourtour`, et les deux comptes sont
    justes.** Un pixel touche le dehors *par un côté* — une diagonale ne perce
    pas une silhouette —, mais le voisin intérieur *le plus proche* d'un pixel de
    coin est bien son diagonal. Trouvé en essayant : avec quatre voisins, les
    quatre coins d'une frange restaient à la couleur du fond, seuls, parce
    qu'aucun de leurs voisins de côté n'était franchement intérieur.
    """
    interieur = sujet & ~pourtour(sujet)
    hauteur, largeur = sujet.shape
    borde_rgb = np.pad(rgb, ((1, 1), (1, 1), (0, 0)))
    borde = np.pad(interieur, 1, constant_values=False)
    couleur = np.zeros_like(rgb)
    trouve = np.zeros(sujet.shape, dtype=bool)
    # (décalage vertical, décalage horizontal) : haut, bas, gauche, droite,
    # puis les quatre coins.
    for dy, dx in (
        (0, 1),
        (2, 1),
        (1, 0),
        (1, 2),
        (0, 0),
        (0, 2),
        (2, 0),
        (2, 2),
    ):
        candidat = borde[dy : dy + hauteur, dx : dx + largeur]
        prendre = candidat & ~trouve
        couleur[prendre] = borde_rgb[dy : dy + hauteur, dx : dx + largeur][prendre]
        trouve |= candidat
    return couleur, trouve


def _couleur_enlevee(rgb: np.ndarray, avant: np.ndarray, apres: np.ndarray) -> np.ndarray | None:
    """La couleur du fond **que cette passe-ci vient de retirer**, ou rien.

    **Elle se mesure, elle ne se demande pas**, et c'est ce qui fait marcher les
    deux réparations de D4 sur les quatre moteurs à la fois : le remplissage
    depuis le bord, la pipette, la sélection magique et le modèle ne disent pas
    tous quelle couleur ils ont pris pour du fond — mais tous laissent derrière
    eux les pixels qu'ils ont ouverts, et *effacer un pixel ne change pas sa
    couleur*. Le fond de la passe est donc la médiane de ce qu'elle a enlevé.

    **La médiane des seuls pixels enlevés qui touchent ce qui reste**, quand il y
    en a : c'est la bande de contact, celle qui décide du bord. Prendre tout
    l'enlevé mêlerait un dégradé de ciel à la couleur qui borde le sujet.

    `None` quand la passe n'a rien enlevé — un moteur qui ne trouve pas de fond
    n'a pas de fond, et deviner ici ferait ronger sur une couleur inventée.
    """
    enleves = (avant > 0) & (apres == 0)
    if not enleves.any():
        return None
    contact = enleves & pourtour(enleves)
    lus = rgb[contact] if contact.any() else rgb[enleves]
    return np.median(lus.astype(np.int16), axis=0)


def ronger_conditionnel(
    rgb: np.ndarray, alpha: np.ndarray, pixels: int, fond: np.ndarray | None
) -> np.ndarray:
    """Le rongement de D4 — **il n'ôte que ce qui est effectivement contaminé**.

    **Ce que l'érosion aveugle coûtait.** `ronger` retire une couronne entière
    de pixels, qu'ils soient pollués par le fond ou non : le sujet maigrit d'un
    pixel par cran, partout, y compris là où le bord était déjà franc. Sur un
    sprite de soixante-quatre carrés, deux crans mangent une bonne part d'un
    doigt.

    **Ce que celle-ci fait à la place.** Elle regarde chaque pixel de bord et
    pose une seule question : *ressemble-t-il plus au fond qu'à son voisin
    intérieur ?* Si oui, c'est un pixel d'anti-crénelage, il part. Sinon, c'est
    du sujet, il reste. Les pixels retirés sont donc **un sous-ensemble** de ceux
    que l'érosion aveugle retirait — la réparation ne peut pas manger davantage.

    **Un trait d'un pixel d'épaisseur ne se ronge jamais**, parce qu'aucun de ses
    pixels n'a de voisin franchement intérieur à qui se comparer. C'est le cas
    que l'érosion aveugle effaçait en entier, et c'est le plus visible : une
    antenne, une lanière, la pointe d'une épée.

    **Sans fond mesuré, on retombe sur l'érosion aveugle** plutôt que de ne rien
    faire. Une passe qui n'a rien enlevé n'a pas de couleur de fond à opposer, et
    le durcissement que l'auteur a demandé doit quand même agir : c'est ce qu'il
    a réglé, et un réglage qui cesserait d'agir sans le dire serait pire que
    l'érosion qu'on répare.
    """
    if pixels <= 0:
        return alpha
    if fond is None:
        return ronger(alpha, pixels)
    fond = fond.astype(np.int16)
    au_fond = np.abs(rgb.astype(np.int16) - fond).max(axis=2)
    courant = alpha
    for _ in range(pixels):
        sujet = courant > 0
        bord = pourtour(sujet)
        if not bord.any():
            break
        dedans, connu = _voisin_interieur(rgb, sujet)
        au_voisin = np.abs(rgb.astype(np.int16) - dedans.astype(np.int16)).max(axis=2)
        contamine = bord & connu & (au_fond < au_voisin)
        if not contamine.any():
            break
        courant = np.where(contamine, np.uint8(0), courant)
    return courant


# **Deux tolérances, et le facteur deux est le seul chiffre choisi de cette
# réparation.** Un pixel à moins d'une tolérance du fond a déjà été emporté par
# le détourage ; ce qui reste et qui est encore pollué est dans la traîne de
# l'anti-crénelage, juste au-delà. Deux tolérances la couvrent sans mordre sur
# ce qui est franchement du sujet — et la seconde condition, *plus proche du
# fond que de son voisin intérieur*, ferme le cas d'un sujet légitimement de la
# couleur du fond.
CONTAMINATION = 2


def decontaminer(
    rgb: np.ndarray, alpha: np.ndarray, fond: np.ndarray | None, tolerance: int
) -> np.ndarray:
    """Un pixel de bord pollué par le fond prend la couleur de son voisin intérieur (D4).

    **Ce que ça répare, et pourquoi ce n'est pas la même chose que ronger.** Un
    pixel d'anti-crénelage est un mélange du sujet et du fond. Le ronger le
    retire — le sujet maigrit ; le décontaminer le **garde à la bonne couleur** —
    le sujet reste entier et le bord cesse d'être délavé. Sur un sprite qui
    compte ses pixels, la seconde vaut mieux que la première.

    **Sans jamais fabriquer de demi-transparence**, et c'est le critère : elle ne
    touche pas au canal alpha, pas d'une valeur. C'est ce qui la distingue du
    *matting*, qui rend un bord doux — et un bord doux est très exactement ce que
    le durcissement existe pour supprimer, parce qu'un rééchantillonnage au plus
    proche le tranche à pile ou face.

    **Deux conditions, et la seconde est ce qui la rend sûre** : le pixel est
    près du fond *et* plus près du fond que de son voisin intérieur. La première
    seule aurait repeint un sujet légitimement de la couleur du fond — un mur
    gris sur un fond gris —, ce qui est la panne que D3 rend rare et que
    celle-ci ne doit pas rouvrir.

    **Elle ne fabrique aucune couleur** : elle recopie celle d'un pixel voisin,
    qui est déjà dans l'image. Une moyenne aurait introduit une teinte que ni le
    modèle ni la palette ne contiennent.
    """
    if fond is None:
        return rgb
    sujet = alpha > 0
    bord = pourtour(sujet)
    if not bord.any():
        return rgb
    dedans, connu = _voisin_interieur(rgb, sujet)
    entier = rgb.astype(np.int16)
    au_fond = np.abs(entier - fond.astype(np.int16)).max(axis=2)
    au_voisin = np.abs(entier - dedans.astype(np.int16)).max(axis=2)
    pollue = bord & connu & (au_fond <= tolerance * CONTAMINATION) & (au_fond < au_voisin)
    if not pollue.any():
        return rgb
    sortie = rgb.copy()
    sortie[pollue] = dedans[pollue]
    return sortie


# ── Les deux mesures d'acceptation du fond (D3) ──────────────────────────────
#
# **Elles remplacent un banc, et c'est l'auteur qui l'a tranché** le 2 septembre
# 2026. La version précédente de la tranche du fond exigeait huit tirages par
# branche avant la première ligne de code ; c'est retiré. Ce qui prend la place
# du banc est plus utile que lui : deux nombres lus **sur les images qu'on
# voulait de toute façon**, à côté du réglage qui les explique.
#
# C'est la doctrine du dépôt sur les notes de qualité — *elle se juge à l'usage,
# sur des images qu'on voulait de toute façon* — appliquée pour la première fois
# à un réglage d'envoi et non à un modèle.


@dataclass(frozen=True, slots=True)
class MesuresDuFond:
    """Ce qu'une image revenue dit du fond sur lequel elle a été demandée (D3).

    `fond` est la couleur **telle qu'elle est revenue**, lue à la médiane des
    bordures — jamais celle qu'on avait demandée. C'est le seul chiffre qui
    réponde à la question qui compte : *le modèle a-t-il rendu le fond qu'on lui
    a demandé ?* Comparer la couleur demandée à elle-même n'aurait rien mesuré.

    `bord` est le pourtour du sujet en pixels, et il ne se lit pas seul : il est
    le dénominateur de `frange`.

    `frange` compte les pixels **à demi transparents** que le détourage a
    laissés. C'est ce que le durcissement et le rongement existent pour retirer,
    et c'est ce qui fabrique un halo quand on ne le fait pas.

    `colles` compte les pixels **gardés** qui sont encore à portée de tolérance
    de la couleur de fond. Ce sont ceux qu'un cran de tolérance de plus aurait
    mangés : c'est très exactement le prix d'un fond mal choisi, et c'est la
    mesure que la tranche du fond a mise à la place de son banc.

    `part_collee` les rapporte au sujet entier, parce que six cents pixels ne
    veulent pas dire la même chose sur un sprite de 64 et sur une image de 1024.
    """

    fond: str
    sujet: int
    bord: int
    frange: int
    colles: int
    part_collee: float

    def en_json(self) -> dict[str, Any]:
        return {
            "fond": self.fond,
            "sujet": self.sujet,
            "bord": self.bord,
            "frange": self.frange,
            "colles": self.colles,
            "part_collee": round(self.part_collee, 4),
        }


def _hexa(rgb: np.ndarray) -> str:
    """Trois composantes en `#RRGGBB`, bornées à l'octet."""
    r, v, b = (int(min(255, max(0, round(float(c))))) for c in rgb[:3])
    return f"#{r:02X}{v:02X}{b:02X}"


def pourtour(sujet: np.ndarray) -> np.ndarray:
    """Les pixels du sujet qui touchent le dehors — **en quatre voisins**.

    **Le bord du cadre compte comme du dehors**, et c'est le même choix que le
    contour : un sujet recadré sur sa boîte opaque touche les quatre bords, et
    l'en excepter ferait disparaître son pourtour là où il est le plus visible.

    Écrite une fois et employée trois fois — la mesure du fond, le rongement
    conditionnel et la décontamination (D4) —, parce que trois définitions du
    mot *bord* dans le même fichier auraient fini par compter trois choses.
    """
    borde = np.pad(sujet, 1, constant_values=False)
    hauteur, largeur = sujet.shape
    voisins = (
        borde[0:hauteur, 1 : largeur + 1]
        & borde[2 : hauteur + 2, 1 : largeur + 1]
        & borde[1 : hauteur + 1, 0:largeur]
        & borde[1 : hauteur + 1, 2 : largeur + 2]
    )
    return sujet & ~voisins


def mesures_du_fond(rgba: np.ndarray, tolerance: int = 28) -> MesuresDuFond:
    """Les deux mesures d'acceptation du fond, sur une image détourée (D3).

    **Sur l'image détourée et pas sur le rendu final**, parce que c'est là que
    la question se pose : la couleur du fond est encore lisible dans les pixels
    que le détourage a rendus transparents — *effacer un pixel ne change pas sa
    couleur* —, et le rendu final les a déjà recadrés, réduits et quantifiés.

    `tolerance` est celle du détourage, et c'est ce qui fait de `colles` une
    mesure et non une opinion : elle compte les pixels qu'un cran de plus aurait
    emportés, dans la distance exacte que le moteur du bord emploie.

    **Une image sans sujet ne ment pas** : tout est à zéro, et la couleur de fond
    reste lue — un détourage qui a tout mangé se voit, et il se voit mieux avec
    la couleur qu'il a prise pour du fond.
    """
    alpha = rgba[:, :, 3]
    rgb = rgba[:, :, :3]
    cible = _couleur_du_bord(rgb)
    sujet = alpha > 0
    compte = int(sujet.sum())
    if compte == 0:
        return MesuresDuFond(_hexa(cible), 0, 0, 0, 0, 0.0)
    ecart = np.abs(rgb.astype(np.int16) - cible).max(axis=2)
    colles = int((sujet & (ecart <= tolerance)).sum())
    return MesuresDuFond(
        fond=_hexa(cible),
        sujet=compte,
        bord=int(pourtour(sujet).sum()),
        frange=int(((alpha > 0) & (alpha < 255)).sum()),
        colles=colles,
        part_collee=colles / compte,
    )


def boite_opaque(alpha: np.ndarray) -> tuple[int, int, int, int] | None:
    """La boîte du sujet, ou `None` s'il ne reste rien.

    `None` est le cas « le détourage a mangé le sujet » (US-71) : il ne se
    répare pas ici, il **se voit** — l'appelant le remonte tel quel plutôt que
    de rendre une image vide sans rien dire.
    """
    lignes = np.flatnonzero(alpha.any(axis=1))
    colonnes = np.flatnonzero(alpha.any(axis=0))
    if lignes.size == 0 or colonnes.size == 0:
        return None
    return int(colonnes[0]), int(lignes[0]), int(colonnes[-1]), int(lignes[-1])


# ── Les composantes connexes ─────────────────────────────────────────────────


def composantes(masque: np.ndarray) -> list[tuple[np.ndarray, int]]:
    """Les taches opaques, chacune avec son aire. Même remplissage par plages.

    Publique depuis T5 : le slicer cherche exactement la même chose que le
    nettoyage des bords — des taches connexes dans un alpha —, et la seule
    différence est ce qu'on en fait. Deux implémentations du remplissage par
    plages finiraient par se répondre différemment sur la même image.
    """
    hauteur, largeur = masque.shape
    vu = np.zeros_like(masque)
    taches: list[tuple[np.ndarray, int]] = []

    for y0 in range(hauteur):
        libres = np.flatnonzero(masque[y0] & ~vu[y0])
        for x0 in libres:
            if vu[y0, x0]:
                continue
            tache = np.zeros_like(masque)
            pile = [(y0, int(x0))]
            aire = 0
            while pile:
                y, x = pile.pop()
                if vu[y, x] or not masque[y, x]:
                    continue
                ligne = masque[y] & ~vu[y]
                fermes = np.flatnonzero(~ligne)
                avant = fermes[fermes < x]
                apres = fermes[fermes > x]
                debut = int(avant[-1]) + 1 if avant.size else 0
                fin = int(apres[0]) - 1 if apres.size else largeur - 1
                vu[y, debut : fin + 1] = True
                tache[y, debut : fin + 1] = True
                aire += fin - debut + 1
                for voisin in (y - 1, y + 1):
                    if not (0 <= voisin < hauteur):
                        continue
                    libre = masque[voisin, debut : fin + 1] & ~vu[voisin, debut : fin + 1]
                    if not libre.any():
                        continue
                    borde = np.concatenate(([False], libre, [False])).astype(np.int8)
                    for depart in np.flatnonzero(np.diff(borde) == 1):
                        pile.append((voisin, debut + int(depart)))
            taches.append((tache, aire))
    return taches


# Les huit voisins, dans un ordre fixe — mais **aucun résultat ne dépend de cet
# ordre**, et c'est une propriété à tenir, pas une remarque. Les deux moteurs qui
# s'en servent choisissent par un minimum ou par une majorité franche : deux
# réponses qui ne connaissent pas la gauche de la droite. Un moteur qui
# départagerait par le rang casserait l'involution du miroir de `B1` sans qu'un
# seul pixel visible ne le montre — c'est arrivé une fois dans cette tranche.
VOISINS = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1))

# **Combien de voisins doivent être d'accord pour qu'on repeigne un pixel.** Cinq
# sur huit — une majorité franche, pas une majorité relative. Ce chiffre est le
# garde-fou de tout le moteur : sur une image qui n'a pas été réduite à quelques
# couleurs, aucun voisinage n'atteint jamais cinq fois la même teinte, et le
# moteur ne touche donc **rien du tout** au lieu de raser un dégradé. Il se
# désarme tout seul là où il n'a rien à faire, plutôt que d'être grisé par une
# règle qu'il faudrait tenir d'accord ailleurs.
MAJORITE_DU_VOISINAGE = 5

# **Combien de voisins il suffit d'examiner pour trouver cette majorité.** Une
# couleur portée par cinq voisins sur huit en laisse au plus trois autres : parmi
# quatre voisins quelconques, il y en a donc au moins un qui la porte. Chercher
# parmi les huit revenait à faire deux fois le même travail — et sur une image
# non réduite, où tout l'intérieur est candidat, ces deux fois-là se comptaient
# en secondes et en gigaoctets.
ASSEZ_DE_CANDIDATS = len(VOISINS) - MAJORITE_DU_VOISINAGE + 1

# Les grains sont traités par paquets : la mémoire employée ne dépend alors plus
# de la taille de l'image, seulement de ce nombre-là. Un quart de million de
# pixels par paquet tient dans quelques dizaines de mégaoctets, et un paquet plus
# petit ne ferait que multiplier les allers-retours sans rien économiser.
PAQUET_DE_GRAINS = 1 << 18


def _voisinage(canal: np.ndarray, remplissage: int) -> np.ndarray:
    """Les huit voisins de chaque pixel, empilés en dernière dimension.

    Hors du cadre, `remplissage` — jamais le pixel du bord recopié : un bord
    recopié se donnerait sept voisins identiques à lui-même et passerait pour
    une majorité franche.
    """
    borde = np.pad(canal, 1, mode="constant", constant_values=remplissage)
    hauteur, largeur = canal.shape[:2]
    return np.stack(
        [borde[1 + dy : 1 + dy + hauteur, 1 + dx : 1 + dx + largeur] for dy, dx in VOISINS],
        axis=-1,
    )


def depoussierer(rgba: np.ndarray, grain_min: int) -> np.ndarray:
    """**Le grain de couleur accroché au sujet** — ce qu'aucun seuil de taille
    n'a jamais pu atteindre.

    `nettoyer` compte des taches dans la transparence. Un pixel resté vert vif au
    milieu d'une robe brune est opaque et collé au sujet : il n'est aucune tache,
    et aucune valeur du curseur de taille ne l'a jamais vu. Celui-ci ne regarde
    pas la transparence — il regarde **la couleur d'un pixel contre celle de ses
    huit voisins**, et c'est très exactement le trou du relevé.

    **La règle, en une phrase** : *un pixel entouré de huit pixels opaques, dont
    moins de `grain_min` portent sa couleur, prend la couleur qu'une majorité
    franche de ses voisins porte.* Trois choses en découlent, et ce sont les
    trois qui le distinguent d'un flou :

    - **Un aplat redevient un aplat.** Le brun de la robe est porté par sept ou
      huit voisins : il n'est jamais de la poussière.
    - **Un bord reste net.** Un pixel du pourtour du sujet n'est pas entouré de
      huit pixels opaques, donc il n'est jamais candidat — le moteur ne peut pas
      toucher la silhouette, même par accident.
    - **Un trait fin survit.** Deux pixels verts côte à côte se portent l'un
      l'autre : chacun a un voisin de sa couleur, et à `grain_min = 1` ni l'un ni
      l'autre ne part. C'est ce qui sépare une poussière d'un détail — un détail
      a au moins un compagnon.

    **Il ne moyenne rien** : la couleur posée est celle qu'un voisin porte déjà.
    C'est la règle des palettes du produit — *jamais une moyenne inventée* — et
    ici elle a une conséquence de plus : le moteur ne peut pas faire entrer une
    couleur de plus dans une image qu'on vient de ramener à vingt-quatre.

    **Le compte se fait sur l'image d'entrée, et l'écriture d'un seul coup** :
    deux grains voisins se jugent chacun sur ce qui était là, pas sur ce que
    l'autre vient de devenir. La même recette rend donc toujours le même pixel,
    quel que soit l'ordre où l'on balaie l'image.

    ⚠️ **Le cas qui coûtait cher est celui où le moteur ne fait rien.** Sur une
    image *non réduite*, chaque pixel a sa nuance : aucun voisin ne porte sa
    couleur, donc **tout l'intérieur est un grain**, et la première écriture
    comparait alors les huit voisins deux à deux, sur trois canaux — un tableau
    de `(pixels, 8, 8, 3)`. Mesuré à 2 048 : sept secondes et 1,8 Go, pour rendre
    l'image inchangée. Deux choses le règlent, et aucune ne change ce qui sort :
    les couleurs tiennent dans **un seul entier** au lieu de trois canaux, et il
    suffit d'examiner **quatre** voisins au lieu de huit — une couleur portée par
    cinq voisins sur huit en laisse au plus trois autres, donc elle se trouve
    forcément parmi quatre quelconques d'entre eux. Le travail se fait enfin par
    paquets, si bien que la mémoire employée ne dépend plus de la taille de
    l'image. Mesuré sur le même cas, à 2 048 : **7 371 ms et 1,78 Go → 432 ms et
    101 Mo**, pour la même image en sortie.
    """
    if grain_min <= 0:
        return rgba

    opaque = rgba[:, :, 3] > 0
    if not opaque.any():
        return rgba

    hauteur, largeur = opaque.shape
    # Le cadre d'un pixel autour de l'image : les voisins d'un pixel du bord se
    # lisent alors sans test. Il vaut *transparent* et *couleur inconnue*, ce qui
    # exclut les quatre bordures de l'image et empêche le dehors de compter.
    code_borde = np.full((hauteur + 2, largeur + 2), COULEUR_INCONNUE, dtype=np.int32)
    code_borde[1:-1, 1:-1] = (
        rgba[:, :, 0].astype(np.int32) * 65536
        + rgba[:, :, 1].astype(np.int32) * 256
        + rgba[:, :, 2].astype(np.int32)
    )
    opaque_borde = np.zeros((hauteur + 2, largeur + 2), dtype=bool)
    opaque_borde[1:-1, 1:-1] = opaque

    # Les deux comptes, **sans jamais empiler les huit voisins de toute
    # l'image** : une addition par direction, sur un octet par pixel.
    voisins_opaques = np.zeros((hauteur, largeur), dtype=np.uint8)
    siens = np.zeros((hauteur, largeur), dtype=np.uint8)
    propre = code_borde[1:-1, 1:-1]
    for dy, dx in VOISINS:
        fenetre = slice(1 + dy, hauteur + 1 + dy), slice(1 + dx, largeur + 1 + dx)
        voisins_opaques += opaque_borde[fenetre]
        siens += code_borde[fenetre] == propre

    # Un pixel qui touche le vide n'est pas candidat : le bord du sujet ne se
    # repeint pas, donc la silhouette ne peut pas bouger.
    grains = opaque & (voisins_opaques == len(VOISINS)) & (siens < grain_min)
    if not grains.any():
        return rgba

    # ── Ce qui remplace le grain : la couleur qu'une majorité franche porte ───
    lignes, colonnes = np.nonzero(grains)
    sortie = None
    for debut in range(0, len(lignes), PAQUET_DE_GRAINS):
        ly = lignes[debut : debut + PAQUET_DE_GRAINS]
        lx = colonnes[debut : debut + PAQUET_DE_GRAINS]
        # Les huit voisins de ces grains-là, en couleur, et rien d'autre.
        candidats = np.stack(
            [code_borde[ly + 1 + dy, lx + 1 + dx] for dy, dx in VOISINS], axis=1
        )  # (n, 8)
        # Pour chacun des quatre premiers voisins, combien des huit portent sa
        # couleur. Quatre suffisent, et la note du haut dit pourquoi.
        accord = (candidats[:, :ASSEZ_DE_CANDIDATS, None] == candidats[:, None, :]).sum(
            axis=-1, dtype=np.int16
        )  # (n, 4)
        # **Le mieux suivi, et l'égalité n'existe pas.** Deux couleurs ne peuvent
        # pas atteindre cinq voisins sur huit à la fois : dès que le seuil est
        # franchi, la couleur élue est unique, et le rang où `argmax` la trouve
        # ne change donc rien à ce qui est posé — pas plus que le sous-ensemble
        # de voisins qu'on a examiné. La même recette rend le même pixel, et le
        # moteur commute avec le miroir.
        elu = accord.argmax(axis=1)
        rang = np.arange(len(ly))
        assez = accord[rang, elu] >= MAJORITE_DU_VOISINAGE
        if not assez.any():
            continue
        if sortie is None:
            sortie = rgba.copy()
        pris = candidats[rang, elu][assez]
        sortie[ly[assez], lx[assez], 0] = ((pris >> 16) & 0xFF).astype(np.uint8)
        sortie[ly[assez], lx[assez], 1] = ((pris >> 8) & 0xFF).astype(np.uint8)
        sortie[ly[assez], lx[assez], 2] = (pris & 0xFF).astype(np.uint8)

    return rgba if sortie is None else sortie


def decrocher_les_coins(rgba: np.ndarray, passes: int) -> np.ndarray:
    """**L'escalier** : un pixel qui ne tient au sujet que par un coin s'en va.

    C'est le geste que la planche appelle *le plus fin de l'atelier*, et il a une
    propriété qu'aucun des dix autres n'a : **il ne peut rien couper**. Un pixel
    dont aucun des quatre côtés ne touche le sujet n'est relié à rien pour
    `composantes`, qui compte en quatre voisins depuis `T5` — le retirer ne peut
    donc détacher aucun morceau qui tenait.

    Une passe retire une dent, trois en retirent trois d'affilée. La planche
    prévient de la troisième : *« le sujet s'arrondit et perd ses angles vifs ;
    sur un visage de 8 px, le nez disparaît »*. C'est pourquoi le réglage est
    borné à trois et non laissé libre.

    **Seul l'alpha bouge.** La couleur d'un pixel décroché reste sous lui — et le
    lit de couleur, en fin de chaîne, s'occupera de ce qu'elle devient.
    """
    if passes <= 0:
        return rgba

    sortie = rgba.copy()
    canal = sortie[:, :, 3]  # une vue : écrire dedans écrit dans `sortie`
    for _ in range(min(passes, LISSAGE_MAX)):
        opaque = canal > 0
        if not opaque.any():
            break
        huit = _voisinage(opaque.astype(np.uint8), 0).astype(bool)
        # `VOISINS` range les diagonales aux rangs 0, 2, 5, 7 et les côtés aux
        # rangs 1, 3, 4, 6 — l'ordre est fixé une fois, en tête de fichier.
        cotes = huit[:, :, (1, 3, 4, 6)].any(axis=-1)
        diagonales = huit[:, :, (0, 2, 5, 7)].any(axis=-1)
        dents = opaque & ~cotes & diagonales
        if not dents.any():
            break
        canal[dents] = 0
    return sortie


def _touche_un_bord(masque: np.ndarray) -> bool:
    """Une zone qui touche un bord de l'image est le dehors, jamais un trou."""
    hauteur, largeur = masque.shape
    return bool(
        masque[0].any()
        or masque[hauteur - 1].any()
        or masque[:, 0].any()
        or masque[:, largeur - 1].any()
    )


def garder_le_sujet_seul(rgba: np.ndarray, n: int) -> np.ndarray:
    """**« Garder le sujet seul »** : ne laisse que les `n` plus grands amas.

    Le reste s'efface, fût-il collé à trois pixels du plus grand — ce que
    `aire_min` ne peut jamais faire, puisqu'il ne connaît qu'une taille et pas
    un rang. `n` compte les *plus grandes* pour que la « plus grande » soit
    toujours gardée quel que soit `n` : demander 1 revient toujours à garder le
    sujet, jamais à deviner lequel des amas l'est.
    """
    if n <= 0:
        return rgba
    alpha = rgba[:, :, 3]
    if not alpha.any():
        return rgba
    zones = composantes(alpha > 0)
    if len(zones) <= n:
        return rgba
    zones.sort(key=lambda z: z[1], reverse=True)
    garde = np.zeros_like(alpha, dtype=bool)
    for masque, _ in zones[:n]:
        garde |= masque
    sortie = rgba.copy()
    sortie[:, :, 3] = np.where(garde, alpha, np.uint8(0))
    return sortie


def _premiere_couleur_voisine(
    rgb: np.ndarray, connu: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """Pour chaque pixel, la couleur du premier voisin **connu**, dans l'ordre
    fixe des quatre côtés puis des quatre coins — même convention que
    `_voisin_interieur`, généralisée à n'importe quel masque de « ce qui est
    déjà fiable » plutôt qu'au seul intérieur d'une silhouette.

    Rend la couleur retenue et un masque disant où l'on en a trouvé une.
    **Un voisin, jamais une moyenne** — même règle que partout ailleurs dans ce
    module : une moyenne fabriquerait une teinte que l'image ne contient pas.
    """
    hauteur, largeur = connu.shape
    borde_rgb = np.pad(rgb, ((1, 1), (1, 1), (0, 0)))
    borde_connu = np.pad(connu, 1, constant_values=False)
    couleur = np.zeros_like(rgb)
    trouve = np.zeros(connu.shape, dtype=bool)
    for dy, dx in ((0, 1), (2, 1), (1, 0), (1, 2), (0, 0), (0, 2), (2, 0), (2, 2)):
        candidat = borde_connu[dy : dy + hauteur, dx : dx + largeur]
        prendre = candidat & ~trouve
        couleur[prendre] = borde_rgb[dy : dy + hauteur, dx : dx + largeur][prendre]
        trouve |= candidat
    return couleur, trouve


def _combler_par_voisinage(
    rgba: np.ndarray, cible: np.ndarray, max_passes: int
) -> np.ndarray:
    """Rend opaque `cible`, anneau par anneau depuis son pourtour.

    Chaque passe prend, pour les pixels de `cible` qui touchent déjà de
    l'opaque, la couleur d'un voisin — puis les traite comme opaques à la
    passe suivante, de sorte qu'un trou plus large qu'un pixel se comble en
    plusieurs passes, de son bord vers son centre. Bornée par `max_passes` :
    une zone de `cible` ne peut jamais avoir un rayon plus grand que son
    aire, donc ce nombre suffit toujours à l'atteindre en entier.
    """
    if not cible.any():
        return rgba
    sortie = rgba.copy()
    restant = cible.copy()
    for _ in range(max(1, max_passes)):
        if not restant.any():
            break
        opaque = sortie[:, :, 3] > 0
        couleur, trouve = _premiere_couleur_voisine(sortie[:, :, :3], opaque)
        a_faire = restant & trouve
        if not a_faire.any():
            break
        sortie[a_faire, 0] = couleur[a_faire, 0]
        sortie[a_faire, 1] = couleur[a_faire, 1]
        sortie[a_faire, 2] = couleur[a_faire, 2]
        sortie[a_faire, 3] = 255
        restant = restant & ~a_faire
    return sortie


def boucher_les_trous(rgba: np.ndarray, seuil: int) -> np.ndarray:
    """**« Boucher les trous »** : comble les trous de la silhouette d'aire au
    plus égale à `seuil`, avec la couleur qui les entoure.

    Un trou est le **transparent qu'un sujet entoure** — même lecture que
    `atelier.image.taches.trous`, celle du contour et pas celle du détourage
    (voir la note de ce module sur les deux lectures inverses). Un trou qui
    touche un bord de l'image est le fond ordinaire, jamais un trou.
    """
    if seuil <= 0:
        return rgba
    alpha = rgba[:, :, 3]
    vide = alpha == 0
    if not vide.any():
        return rgba
    a_combler = np.zeros_like(vide)
    for masque, aire in composantes(vide):
        if aire > seuil or _touche_un_bord(masque):
            continue
        a_combler |= masque
    if not a_combler.any():
        return rgba
    return _combler_par_voisinage(rgba, a_combler, seuil)


def reboucher_les_poches_de_fond(
    rgba: np.ndarray, seuil: int, tolerance: int = TOLERANCE_POCHES
) -> np.ndarray:
    """**« Reboucher les poches de fond »** : rend transparentes les poches de
    fond enfermées d'aire au plus égale à `seuil`.

    Le jumeau exact de `boucher_les_trous`, sur l'autre lecture : une poche de
    fond est **opaque**, à la couleur du bord, mais que le remplissage depuis
    les bordures n'a pas rejointe — voir `atelier.image.taches.poches_de_fond`,
    dont ceci reprend le calcul pour agir au lieu de seulement compter.
    """
    if seuil <= 0 or 0 in rgba.shape[:2]:
        return rgba
    rgb = rgba[:, :, :3]
    cible = _couleur_du_bord(rgb)
    proche = np.abs(rgb.astype(np.int16) - cible).max(axis=2) <= tolerance
    if not proche.any():
        return rgba
    joignable = _remplir(proche, _graines_du_bord(proche))
    enferme = proche & ~joignable & (rgba[:, :, 3] > 0)
    if not enferme.any():
        return rgba
    a_effacer = np.zeros_like(enferme)
    for masque, aire in composantes(enferme):
        if aire <= seuil:
            a_effacer |= masque
    if not a_effacer.any():
        return rgba
    sortie = rgba.copy()
    sortie[:, :, 3] = np.where(a_effacer, np.uint8(0), rgba[:, :, 3])
    return sortie


def ronger_puis_regonfler(
    rgba: np.ndarray, rayon: int, epargner_fins: bool = True
) -> np.ndarray:
    """**« Ronger puis regonfler »** : ouverture morphologique de `rayon`.

    Érode le sujet de `rayon`, puis le regonfle du même rayon. Une
    excroissance plus fine que `rayon` ne survit pas à l'érosion et ne
    repousse donc pas à la dilatation ; le corps, lui, retrouve exactement sa
    taille — les deux passes se compensent partout ailleurs.

    `epargner_fins`, comme `ronger_conditionnel` au détourage : un pixel qui
    n'a **aucun voisin franchement intérieur** (`_voisin_interieur`) est un
    trait d'un seul pixel d'épaisseur de part en part, et l'ouverture
    l'effacerait en entier plutôt que de le raboter. Restauré tel quel.
    """
    if rayon <= 0:
        return rgba
    alpha = rgba[:, :, 3]
    sujet = alpha > 0
    if not sujet.any():
        return rgba
    ouvert = etendre(restreindre(sujet, rayon), rayon)
    if epargner_fins:
        _, connu = _voisin_interieur(rgba[:, :, :3], sujet)
        ouvert = ouvert | (sujet & ~connu)
    if np.array_equal(ouvert, sujet):
        return rgba
    sortie = rgba.copy()
    sortie[:, :, 3] = np.where(ouvert, alpha, np.uint8(0))
    return sortie


def regonfler_puis_ronger(rgba: np.ndarray, rayon: int) -> np.ndarray:
    """**« Regonfler puis ronger »** : fermeture morphologique de `rayon`.

    L'inverse de `ronger_puis_regonfler` : gonfle le sujet de `rayon`, puis le
    ronge du même rayon. Une entaille du bord plus fine que `rayon` se comble
    à la dilatation et ne revient pas à l'érosion ; le corps garde sa taille.

    **Ne peut qu'ajouter**, jamais retirer — une fermeture contient toujours
    le masque de départ —, donc les pixels ajoutés sont neufs et réclament une
    couleur : `_combler_par_voisinage` la leur donne, comme pour un trou.
    """
    if rayon <= 0:
        return rgba
    alpha = rgba[:, :, 3]
    sujet = alpha > 0
    if not sujet.any():
        return rgba
    ferme = restreindre(etendre(sujet, rayon), rayon)
    ajoute = ferme & ~sujet
    if not ajoute.any():
        return rgba
    return _combler_par_voisinage(rgba, ajoute, rayon)


def voter_les_voisins(rgba: np.ndarray, passes: int) -> np.ndarray:
    """**« Vote des voisins »** : chaque pixel suit la majorité franche de ses
    huit voisins, `passes` fois de suite (bornée à `LISSAGE_MAX`, la même
    borne que l'escalier et pour la même raison — la planche le dit : *« à 3,
    sur un visage de 8 px, le nez disparaît »*).

    À la différence de l'escalier (`decrocher_les_coins`), qui ne peut que
    retirer, celui-ci peut aussi **ajouter** — un pixel transparent entouré
    d'une majorité de sujet devient sujet. C'est ce qui rend un bord
    irrégulier régulier dans les deux sens, et ce qui distingue le lissage
    d'un simple rognement : une dent qui manque se comble autant qu'une dent
    qui dépasse se rabote.
    """
    if passes <= 0:
        return rgba
    sortie = rgba.copy()
    for _ in range(min(passes, LISSAGE_MAX)):
        alpha = sortie[:, :, 3]
        opaque = alpha > 0
        huit = _voisinage(opaque.astype(np.uint8), 0)
        compte = huit.sum(axis=-1)
        grandir = ~opaque & (compte >= MAJORITE_DU_VOISINAGE)
        retrecir = opaque & (compte <= len(VOISINS) - MAJORITE_DU_VOISINAGE)
        if not grandir.any() and not retrecir.any():
            break
        if retrecir.any():
            sortie[:, :, 3] = np.where(retrecir, np.uint8(0), alpha)
        if grandir.any():
            couleur, trouve = _premiere_couleur_voisine(
                sortie[:, :, :3], sortie[:, :, 3] > 0
            )
            appliquer = grandir & trouve
            if appliquer.any():
                sortie[appliquer, 0] = couleur[appliquer, 0]
                sortie[appliquer, 1] = couleur[appliquer, 1]
                sortie[appliquer, 2] = couleur[appliquer, 2]
                sortie[appliquer, 3] = 255
    return sortie


def appliquer_designations(
    original: np.ndarray, resultat: np.ndarray, designations: tuple[Designation, ...]
) -> np.ndarray:
    """Les taches désignées à la main — effacées, ou protégées (B18).

    **`garde=True` se lit sur `original`** : l'amas tel qu'il était avant tout
    nettoyage est recopié sur le résultat, ce qui annule ce que les réglages
    au-dessus lui ont fait, quels qu'ils soient. **`garde=False` se lit sur
    `resultat`** : on efface l'amas tel qu'il se présente une fois les autres
    réglages passés, parce que c'est ce que l'auteur a sous les yeux au moment
    de cliquer.

    Un point hors de l'image, ou tombé sur du vide, ne fait rien — il se
    borne, comme le reste des points du produit depuis T5.
    """
    if not designations:
        return resultat
    sortie = resultat.copy()
    hauteur, largeur = sortie.shape[:2]
    zones_originales: list[tuple[np.ndarray, int]] | None = None
    zones_resultat: list[tuple[np.ndarray, int]] | None = None
    for d in designations:
        x, y = d.point
        if not (0 <= x < largeur and 0 <= y < hauteur):
            continue
        if d.garde:
            if original[y, x, 3] == 0:
                continue
            if zones_originales is None:
                zones_originales = composantes(original[:, :, 3] > 0)
            for masque, _ in zones_originales:
                if masque[y, x]:
                    sortie[masque] = original[masque]
                    break
        else:
            if sortie[y, x, 3] == 0:
                continue
            if zones_resultat is None:
                zones_resultat = composantes(sortie[:, :, 3] > 0)
            for masque, _ in zones_resultat:
                if masque[y, x]:
                    sortie[masque, 3] = 0
                    zones_resultat = None  # le résultat a changé, à recalculer
                    break
    return sortie


def nettoyer(rgba: np.ndarray, bords: Bords) -> np.ndarray:
    """Le dernier mot : les taches trop petites pour être le sujet s'en vont.

    Une réduction au plus proche voisin laisse derrière elle des pixels isolés —
    un éclat de fond qui a survécu au seuil, un bout de contour détaché. À
    64 pixels de côté, un pixel isolé se voit ; à 1024, il ne se voyait pas.

    **Neuf moteurs depuis B18, dans un ordre qui se corrige lui-même** : les
    taches détachées d'abord (rien à trier ni combler tant que les éclats
    n'ont pas disparu), puis le tri des amas, puis les deux comblements — le
    trou et la poche de fond ne se recoupent jamais, l'ordre entre eux
    n'importe donc pas —, puis les deux morphologies — l'ouverture avant la
    fermeture, pour qu'une excroissance rongée ne soit pas regonflée par la
    fermeture qui suit —, puis le vote des voisins qui régularise ce que tout
    ce qui précède a laissé, puis le grain de couleur et l'escalier de B17
    dans leur ordre déjà tenu, et enfin la désignation à la main — qui doit
    voir le résultat de tout le reste pour effacer *ce qu'on a sous les yeux*,
    et l'original pour protéger *ce qui existait avant qu'on y touche*.
    """
    original = rgba
    if bords.aire_min > 0:
        alpha = rgba[:, :, 3]
        if alpha.any():
            sortie = rgba.copy()
            # une vue, pas une copie : écrire dedans écrit dans `sortie`
            canal = sortie[:, :, 3]
            for tache, aire in composantes(alpha > 0):
                if aire < bords.aire_min:
                    canal[tache] = 0
            rgba = sortie

    rgba = garder_le_sujet_seul(rgba, bords.garder)
    rgba = boucher_les_trous(rgba, bords.boucher_jusqua)
    rgba = reboucher_les_poches_de_fond(rgba, bords.reboucher_jusqua)
    rgba = ronger_puis_regonfler(
        rgba, bords.ronger_regonfler, bords.epargner_traits_fins
    )
    rgba = regonfler_puis_ronger(rgba, bords.regonfler_ronger)
    rgba = voter_les_voisins(rgba, bords.vote_voisins)
    rgba = depoussierer(rgba, bords.grain_min)
    rgba = decrocher_les_coins(rgba, bords.lissage)
    if bords.designations:
        rgba = appliquer_designations(original, rgba, bords.designations)
    return rgba


# ── Le pinceau, et ce qu'il couvre ───────────────────────────────────────────
#
# **Écrit ici depuis E5, et importé par le calque** — il y vivait depuis C4,
# quand la main ne servait qu'à affiner un masque de différence. Elle est
# devenue la huitième place de la recette, donc une étape du traitement
# ordinaire ; et `calque.py` importe déjà ce module, si bien que l'inverse
# n'était pas possible. Deux rasterisations séparées auraient fini par ne plus
# se rejoindre au rayon 1.


def pinceau(forme: tuple[int, int], trait: Trait) -> np.ndarray:
    """Les pixels qu'un passage de la main couvre — **une fonction pure**.

    **Un carré de côté `2 × rayon + 1`, promené le long du chemin** — bouts et
    joints carrés. Rayon nul : un pixel de large, et c'est le geste « au pixel »
    d'US-149 et d'US-207 — la même fonction, la même liste de points, un seul
    nombre de différence.

    **Carré depuis U11, et il était rond** (1<sup>er</sup> septembre 2026). Le
    disque était le bon choix de C4, où la main affinait un masque de différence
    sur une image de mille pixels ; elle est depuis devenue la huitième place de
    la recette, donc un outil qu'on emploie sur le sprite fini. Sur soixante-
    quatre pixels de côté, un disque de rayon deux ne fait pas un bord net : il
    fait un escalier que personne n'a dessiné. **Le carré est la forme de
    l'unité qu'on manipule**, et c'est la seule qui rende ce que la main croit
    poser. Le prix est nommé et il se paie une fois : un calque déjà peint se
    redessine légèrement différemment — voir `docs/tranches/U.md`, U11, et la
    promesse de déterminisme du §4 de `docs/ARCHITECTURE.md`.

    **Les points sont reliés, jamais semés.** Un pointeur envoie ce qu'il peut,
    pas ce que la main a parcouru : sans le segment entre deux points, un geste
    rapide laisserait des trous que personne n'a dessinés. Le chemin est donc
    tracé d'un pixel de large par `ImageDraw`, dont la rasterisation est fixe —
    deux rendus de la même recette donnent le même masque, et c'est un critère
    depuis T2 —, puis **épaissi par la dilatation carrée du produit**. Un
    rectangle posé à chaque pixel du chemin donnerait exactement le même masque,
    en mille fois plus d'appels de dessin.

    Rien n'est levé pour un point hors du cadre : il se borne, comme le
    rectangle de C3.
    """
    hauteur, largeur = forme
    toile = Image.new("1", (largeur, hauteur), 0)
    dessin = ImageDraw.Draw(toile)
    points = [(int(x), int(y)) for x, y in trait.points]
    if len(points) > 1:
        dessin.line(points, fill=1, width=1)
    # **Un point, et pas une ligne d'un seul sommet** : `line` ne trace rien
    # quand elle n'a qu'un point, et le geste au pixel — un seul point — ne
    # marquait alors aucun pixel. Payé en écrivant les essais de C4, et gardé.
    dessin.point(points, fill=1)
    return etendre(np.asarray(toile, dtype=bool), max(0, trait.rayon))


def peindre(masque: np.ndarray, traits: Sequence[Trait]) -> np.ndarray:
    """Les passages de la main, posés dans leur ordre, sur un masque booléen.

    **Le dernier passage l'emporte**, comme un pinceau sur une toile : un trait
    qui ôte par-dessus un trait qui garde laisse le pixel ôté. Additionner les
    surfaces aurait rendu le geste de retrait impossible à faire après coup,
    donc irrattrapable — et toute la main est là pour rattraper.

    Rend le masque reçu tel quel quand il n'y a rien à poser : aucune copie
    inutile sur l'immense majorité des images, qui ne portent aucun trait.
    """
    if not traits:
        return masque
    peint = masque.copy()
    for trait in traits:
        peint[pinceau(peint.shape, trait)] = trait.garde
    return peint


# ── La morphologie, et son bord de cadre ─────────────────────────────────────
#
# **Carrée, jamais en croix.** Une croix répétée donne un losange, et un contour
# en losange sur un sprite se voit aux quatre coins. Le voisinage de huit rend
# un trait d'épaisseur constante dans toutes les directions, ce que « épaisseur »
# promet.
#
# **Hors du cadre, c'est du fond, et c'est le même choix des deux côtés.** Un
# sujet recadré sur sa boîte opaque — le cas normal après le recadrage — touche
# les quatre bords : sans cette convention, un contour interne s'interromprait
# précisément là où le sprite est le plus visible.


# ── La forme du pinceau : le carré, et la croix (D4) ─────────────────────────
#
# **Les deux ont raison, à des épaisseurs différentes, et le code n'en connaissait
# qu'une.** À **une** épaisseur d'un pixel, la convention du pixel art est la
# **croix** : le carré pose des pixels en diagonale des coins, et un sprite avec
# des pixels de coin qui dépassent n'est pas ce que dessine un pixel artiste.
# Au-delà d'un pixel, c'est l'inverse, et le code avait une bonne raison
# d'imposer le carré : une croix répétée donne un **losange**, visible aux quatre
# coins d'un sprite.
#
# La règle est donc *la croix à un pixel, le carré au-dessus*, et c'est
# `contourner` qui l'applique — ces deux fonctions-ci ne font qu'offrir les deux
# formes.
CARRE = ((0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2))
CROIX = ((0, 1), (1, 0), (1, 1), (1, 2), (2, 1))


def etendre(masque: np.ndarray, pixels: int, *, croix: bool = False) -> np.ndarray:
    """Dilatation de `pixels`, par décalages bornés — **carrée par défaut**."""
    if pixels <= 0:
        return masque
    hauteur, largeur = masque.shape
    forme = CROIX if croix else CARRE
    grossi = masque
    for _ in range(pixels):
        borde = np.pad(grossi, 1, constant_values=False)
        suivant = np.zeros_like(grossi)
        for dy, dx in forme:
            suivant |= borde[dy : dy + hauteur, dx : dx + largeur]
        grossi = suivant
    return grossi


def restreindre(masque: np.ndarray, pixels: int, *, croix: bool = False) -> np.ndarray:
    """Érosion de `pixels`. Le bord du cadre ronge, comme du fond."""
    if pixels <= 0:
        return masque
    hauteur, largeur = masque.shape
    forme = CROIX if croix else CARRE
    reduit = masque
    for _ in range(pixels):
        borde = np.pad(reduit, 1, constant_values=False)
        suivant = np.ones_like(reduit)
        for dy, dx in forme:
            suivant &= borde[dy : dy + hauteur, dx : dx + largeur]
        reduit = suivant
    return reduit


def _rvb(hexa: str) -> tuple[int, int, int]:
    """Un `#rrggbb` en trois octets. Une valeur illisible rend du noir.

    Ne lève pas : la couleur vient d'un champ libre — *une couleur hors palette
    se marque, elle ne se refuse pas* —, et un rendu qui tomberait sur une
    frappe en cours serait pire que le noir.
    """
    propre = hexa.lstrip("#")
    if len(propre) != 6:
        return 0, 0, 0
    try:
        return tuple(int(propre[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    except ValueError:
        return 0, 0, 0


# ── Le contour ───────────────────────────────────────────────────────────────


def _en_blocs(
    masque: np.ndarray, pas: int, phase: tuple[int, int]
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Le masque vu à la maille du modèle — **au vote de majorité par bloc**.

    Rend le masque de blocs et les deux tables d'indices qui ramènent chaque
    pixel à son bloc. Le vote de majorité est le même que celui de la réduction
    d'alpha (`_alpha_reduit`), et c'est voulu : deux façons de décider si un bloc
    appartient au sujet auraient fini par tracer le contour sur une frontière que
    la mise sur grille place ailleurs.
    """
    hauteur, largeur = masque.shape
    lignes = (np.arange(hauteur) - phase[0]) // pas
    colonnes = (np.arange(largeur) - phase[1]) // pas
    lignes = lignes - lignes.min()
    colonnes = colonnes - colonnes.min()
    hauts, larges = int(lignes.max()) + 1, int(colonnes.max()) + 1
    rangs = lignes[:, None] * larges + colonnes[None, :]
    plat = rangs.ravel()
    dedans = np.bincount(plat, weights=masque.ravel().astype(np.float64), minlength=hauts * larges)
    total = np.bincount(plat, minlength=hauts * larges)
    blocs = (dedans * 2 >= np.maximum(total, 1)).reshape(hauts, larges) & (
        total.reshape(hauts, larges) > 0
    )
    return blocs, lignes, colonnes


def contourner(
    rgba: np.ndarray, contour: Contour, grille: "GrilleRetrouvee | None" = None
) -> np.ndarray:
    """La sixième place — le trait de bord, retracé (E5, US-205 ; repris en D4).

    **Deux cas ne tracent rien, et ce sont les deux formes du même fait** : une
    image sans aucun pixel opaque n'a pas de sujet, une image entièrement opaque
    n'a pas de bord de sujet — seulement les quatre bords du cadre, et un
    rectangle noir autour de l'image n'est jamais ce qu'on voulait. L'écran
    grise la table dans le second cas ; ici on se contente de rendre l'image
    telle quelle, parce qu'un module pur ne refuse pas.

    **`laisses` ne change pas le trait, il change la silhouette qu'on longe** :
    on bouche d'abord les trous — les zones de fond que le sujet enferme — et
    l'on trace le bord de ce qui reste. C'est le même remplissage depuis le bord
    que le détourage, et c'est voulu : *une zone transparente qui ne touche
    aucun bord est enfermée* est une définition, pas deux.

    ── Les deux régimes de D4, et pourquoi il en fallait deux ────────────────

    **L'épaisseur se compte en *blocs du sprite*, pas en pixels de fichier**, et
    c'est la seule unité qui ne mente pas. Une fois la case du projet posée,
    l'image rendue *est* la case : un pixel y est un bloc, et le trait était déjà
    juste. **Sans case**, l'image fait encore mille pixels de côté, un trait d'un
    pixel y est un cheveu invisible, et il ne longe pas la frontière du sprite
    mais les dentelures que le modèle a peintes à l'intérieur d'un bloc.

    `grille` est ce que `retrouver_grille` a trouvé — la maille sur laquelle le
    modèle a peint, D2. Quand elle répond, le trait se pose **sur cette
    frontière-là** : le masque passe à la maille du modèle, le trait s'y calcule,
    et il redescend en pixels. Un trait d'une épaisseur fait alors un bloc, ce
    qui est ce qu'on voulait dire.

    **Quand elle se tait, c'est une peinture, et l'on ne fait rien de neuf** : la
    seule frontière qui existe est celle de l'image telle qu'elle est, et le
    trait la longe comme avant la tranche. *Écrire le premier régime en supposant
    que la mesure répond toujours ferait exactement le défaut que D2 venait de
    retirer* — c'est écrit dans le plan, et c'est ce que ce `if` tient.

    **Le trait d'une épaisseur se pose en croix** — voir `CARRE` et `CROIX`
    au-dessus. Le carré posait des pixels dans le prolongement diagonal des
    coins ; la croix ne le fait pas, et c'est la convention du pixel art. Au-delà
    d'une épaisseur c'est le carré qui reprend, parce qu'une croix répétée donne
    un losange.
    """
    sujet = rgba[:, :, 3] > 0
    if not sujet.any() or sujet.all():
        return rgba

    if contour.trous == LAISSES:
        sujet = ~_remplir(~sujet, _graines_du_bord(~sujet))

    dehors, dedans = contour.parts
    # **La croix à une épaisseur, le carré au-dessus** (D4). L'épaisseur totale
    # de l'anneau est ce qui décide, et non l'un de ses deux côtés : c'est elle
    # qu'on voit.
    croix = dehors + dedans <= 1

    pas = grille.pas if grille is not None and grille.trouvee else 1
    if pas <= 1:
        if dehors:
            rgba = np.pad(
                rgba, ((dehors, dehors), (dehors, dehors), (0, 0)), constant_values=0
            )
            sujet = np.pad(sujet, dehors, constant_values=False)
        anneau = etendre(sujet, dehors, croix=croix) & ~restreindre(
            sujet, dedans, croix=croix
        )
    else:
        # **Le débord se paie en pixels, l'anneau se calcule en blocs.** Un
        # trait externe d'un bloc agrandit l'image d'un bloc de chaque côté, et
        # c'est ce que l'écran annonce — la même règle qu'à un pixel, à l'unité
        # près.
        marge = dehors * pas
        if marge:
            rgba = np.pad(
                rgba, ((marge, marge), (marge, marge), (0, 0)), constant_values=0
            )
            sujet = np.pad(sujet, marge, constant_values=False)
        # La phase du modèle est celle de l'image d'avant le débord ; la marge
        # ajoutée est un multiple du pas, donc elle ne la décale pas.
        blocs, lignes, colonnes = _en_blocs(sujet, pas, grille.phase)
        anneau_blocs = etendre(blocs, dehors, croix=croix) & ~restreindre(
            blocs, dedans, croix=croix
        )
        anneau = anneau_blocs[lignes[:, None], colonnes[None, :]]

    sortie = rgba.copy()
    rouge, vert, bleu = _rvb(contour.couleur)
    sortie[anneau] = (rouge, vert, bleu, 255)
    return sortie


# ── Le retournement ──────────────────────────────────────────────────────────


def retourner(rgba: np.ndarray, retournement: Retournement) -> np.ndarray:
    """La septième place — le miroir gauche-droite (B1).

    **Aucun pixel n'est réinventé** : c'est le même tableau, colonnes dans
    l'autre ordre, les quatre canaux ensemble. Mesuré le 6 septembre 2026 sur
    `0-brut.png` de la génération `038b7c1113c8` — michel au repos, 1024×1024 :
    **27 505 couleurs avant, 27 505 après**, et l'aller-retour rend l'image de
    départ au pixel près. C'est ce qui sépare un miroir d'une seconde
    génération, et c'est ce que la planche montre sous les deux images.

    **La copie contiguë n'est pas une précaution, c'est une réparation.**
    `np.fliplr` rend une vue à pas négatif ; elle se lit et se compare très
    bien, mais Pillow refuse de l'encoder et les places qui suivent — la main,
    ses calques — écrivent alors dans un tableau qui n'est pas celui qu'on
    croit. `ascontiguousarray` recopie une fois, et c'est tout ce que le
    retournement coûte : **5,3 ms** de médiane sur neuf tirages de la même image
    de 1024 px — 4,95 au plus vite, 5,81 au plus lent —, là où la planche
    `atelier-retourner.dc.html` en prévoyait 30.

    **Un sens inconnu ne retourne rien et ne lève pas** — même règle que
    `durcissement_livre` : un module pur ne refuse pas, il rend l'image telle
    quelle. Une recette écrite par la version qui connaîtra les neuf autres sens
    (`B18`) continue donc de s'ouvrir ici.
    """
    if retournement.sens != GAUCHE_DROITE:
        return rgba
    return np.ascontiguousarray(np.fliplr(rgba))


# ── La main ──────────────────────────────────────────────────────────────────


def retoucher(rgba: np.ndarray, main: Main) -> np.ndarray:
    """La huitième et dernière place — ce que l'auteur désigne (E5, US-207).

    **L'opacité d'abord, les dessins ensuite, du dessous vers le dessus.** Elle
    décide de ce qui est là, sur l'image que les six tables précédentes ont
    produite ; les calques posent de la matière par-dessus. L'ordre est celui de
    la pile, et il n'est écrit qu'ici.

    **`remettre` ne fabrique aucune couleur** : il rend l'opacité à un pixel
    dont la couleur est toujours dans le tableau — ni le détourage ni la
    quantification ne touchent au canal des couleurs quand ils retirent
    l'alpha. C'est ce qui fait de « remettre ce que l'image avait avant qu'on le
    retire » une phrase exacte, et non une approximation.

    **Effacer sur un calque de dessin ne retire que ce que ce calque-là a
    posé** : le pixel retombe sur ce qu'il y avait dessous, jamais sur du vide.
    C'est pour ça qu'un calque se calcule à part, puis se pose — et non trait
    par trait à même l'image.
    """
    sortie = rgba.copy()
    forme = sortie.shape[:2]

    if main.opacite:
        present = sortie[:, :, 3] > 0
        voulu = peindre(present, main.opacite)
        canal = sortie[:, :, 3]  # une vue : écrire dedans écrit dans `sortie`
        canal[voulu & ~present] = 255
        canal[~voulu & present] = 0

    for calque in main.calques:
        if not calque.visible or not calque.passages:
            continue
        pose, teinte = pose_du_calque(forme, calque)
        sortie[pose, :3] = teinte[pose]
        sortie[pose, 3] = 255

    return sortie


def pose_du_calque(
    forme: tuple[int, int], calque: CalqueDessin
) -> tuple[np.ndarray, np.ndarray]:
    """Ce qu'un calque de dessin pose, et de quelle couleur — sans image.

    **Écrit une fois, appelé deux** : par le rendu, qui pose ; et par la mesure
    du panneau, qui compte les pixels posés. Un second parcours écrit ailleurs
    aurait fini par compter autre chose que ce que le rendu dessine, et le
    nombre affiché aurait été faux sans que rien ne tombe.

    La composition est indépendante de l'image : c'est ce qui fait qu'un passage
    **survit à un changement de taille de grille** (US-209) — il ne connaît que
    ses points et son rayon, et se rejoue sur la forme qu'on lui donne.
    """
    pose = np.zeros(forme, dtype=bool)
    teinte = np.zeros((*forme, 3), dtype=np.uint8)
    for passage in calque.passages:
        couvert = pinceau(forme, passage)
        if passage.garde:
            pose[couvert] = True
            teinte[couvert] = _rvb(passage.couleur)
        else:
            # **Effacer ne retire que ce que ce calque-là a posé** : le pixel
            # retombe sur ce qu'il y avait dessous, jamais sur du vide.
            pose[couvert] = False
    return pose, teinte


def sans_les_deux_dernieres(recette: Recette) -> Recette:
    """La recette jusqu'aux bords — l'image **que le contour va tracer**.

    Deux appelants, et c'est ce qui justifie de l'écrire une fois : les mesures
    d'une table, qui doivent décrire l'image *avant* les deux dernières places
    pour que le seuil des bords et le compte des taches contournées portent sur
    la même chose ; et l'appui *Avant ›*, qui montre l'image sans ce que la main
    y a posé.
    """
    return replace(recette, contours=None, main=None)


# ── La remise sur grille ─────────────────────────────────────────────────────


def _recadrer(rgba: np.ndarray, recadrage: Recadrage) -> np.ndarray:
    hauteur, largeur = rgba.shape[:2]
    if recadrage.boite is not None:
        x0, y0, x1, y1 = recadrage.boite
    else:
        boite = boite_opaque(rgba[:, :, 3])
        if boite is None:
            return rgba  # plus rien à recadrer : on ne fabrique pas une image vide
        x0, y0, x1, y1 = boite
    marge = max(0, recadrage.marge)
    x0 = max(0, x0 - marge)
    y0 = max(0, y0 - marge)
    x1 = min(largeur - 1, x1 + marge)
    y1 = min(hauteur - 1, y1 + marge)
    return rgba[y0 : y1 + 1, x0 : x1 + 1]


# ── Les quatre réductions, arrivées en D2 ────────────────────────────────────
#
# **La réduction était un choix pris dans le code.** Jusqu'ici `sur_grille`
# ramenait au plus proche voisin sans que rien ne le dise : sur un dessin fin,
# un trait d'un pixel de large avait une chance sur N de survivre — un tirage au
# sort, pas une méthode. Les quatre méthodes rendent ce choix visible et
# réglable, parce que c'est un parti pris de style (`domaine/recette.py`).
#
# **Trois d'entre elles ne demandent rien de plus** que NumPy et Pillow, déjà
# là. La quatrième, `pixeloe`, tire `torch` derrière elle — mesuré le
# 3 septembre 2026, y compris par son chemin dit « léger » — donc elle suit
# exactement le régime du moteur par modèle : cherchée par `find_spec`, grisée
# avec sa raison, importée seulement quand on la demande.


def methode_disponible(methode: str) -> bool:
    return raison_methode(methode) is None


def raison_methode(methode: str) -> str | None:
    """La raison du grisé, en clair — ou `None` si la méthode est là.

    **On cherche le paquet, on ne l'importe pas**, pour la raison écrite en
    toutes lettres dans `raison_moteur` : « le post-traitement ne touche jamais
    le GPU » se **prouve** en regardant `sys.modules`, et `import pixeloe`
    charge `torch`. Une machine où PixelOE est installé ferait tomber
    `tests/test_t2.py` sans qu'aucune image ait été réduite.
    """
    if methode in (VOTE, LANCZOS, AU_PLUS_PROCHE):
        return None
    if methode != PIXELOE:
        return f"méthode inconnue — « {methode} »"
    try:
        if importlib.util.find_spec("pixeloe") is None:
            return "la méthode « traits épaissis » n'est pas installée"
    except (ImportError, ValueError):  # noqa: BLE001 — l'absence n'est pas une panne
        return "la méthode « traits épaissis » n'est pas installée"
    return None


def _alpha_reduit(alpha: np.ndarray, taille: tuple[int, int]) -> np.ndarray:
    """L'alpha ramené à `taille` par **vote majoritaire de case**.

    Moyenner la surface puis trancher à mi-hauteur *est* le vote majoritaire,
    puisque l'alpha arrive déjà durci — le durcissement se fait avant la
    réduction, jamais après (voir l'en-tête du module). C'est ce que la revue
    externe recommande pour les deux chaînes : « dans les deux cas l'alpha est
    binarisé par vote majoritaire par cellule ».

    Le faire à part est ce qui empêche le contour de redevenir translucide : une
    réduction douce appliquée aux quatre canaux d'un coup rendrait des bords à
    demi transparents, que le reste de la chaîne prendrait pour du sujet.
    """
    reduit = Image.fromarray(alpha, mode="L").resize(taille, Image.Resampling.BOX)
    return np.where(np.asarray(reduit) >= 128, 255, 0).astype(np.uint8)


def _par_vote(rgb: np.ndarray, taille: tuple[int, int]) -> np.ndarray:
    """La réduction en deux temps : le tri décide la forme, l'original la couleur.

    C'est la méthode que `docs/bilan-v3.md` § 4 réclame et que la revue externe
    place en tête de ses idées. Dans chaque case, on regarde quelle **couleur
    triée** est la plus fréquente — c'est elle qui décide la forme — puis on
    peint la case avec la **moyenne des pixels d'origine** qui portaient cette
    couleur-là. On obtient le trait net d'un vote sans la perte de nuances d'un
    vote.

    **Les 32 teintes de travail ne sont pas la palette du projet.** Elles ne
    servent qu'à voter ; la quantification vient bien après, sur la recette
    (`Quantification`), et c'est ce qui garde la règle « la palette imposée
    s'applique après la réduction, jamais avant ».
    """
    large, haut = taille
    pas = max(1, min(rgb.shape[0] // max(1, haut), rgb.shape[1] // max(1, large)))
    if pas < 2:
        # Moins d'une case entière par carré : il n'y a rien à faire voter, et
        # une réduction douce rend alors exactement ce qu'on lui demande.
        return _par_lanczos(rgb, taille)

    # On recale la source sur un multiple exact de la cible avant de découper.
    # Sans ça, 1254 divisé par des cases de 19 rendrait 66 carrés au lieu de 64
    # — le résultat ne serait plus à la taille demandée.
    coupe = np.asarray(
        Image.fromarray(rgb, mode="RGB").resize(
            (large * pas, haut * pas), Image.Resampling.LANCZOS
        )
    )

    triees = np.asarray(
        Image.fromarray(coupe, mode="RGB").quantize(
            colors=32, method=Image.Quantize.MEDIANCUT
        )
    )
    etiquettes = triees.reshape(haut, pas, large, pas).transpose(0, 2, 1, 3)
    etiquettes = etiquettes.reshape(haut * large, pas * pas)

    cases = coupe.reshape(haut, pas, large, pas, 3).transpose(0, 2, 1, 3, 4)
    cases = cases.reshape(haut * large, pas * pas, 3)

    sortie = np.empty((haut * large, 3), dtype=np.uint8)
    for rang in range(haut * large):
        gagnante = int(np.bincount(etiquettes[rang]).argmax())
        retenus = cases[rang][etiquettes[rang] == gagnante]
        sortie[rang] = retenus.mean(axis=0).round().astype(np.uint8)
    return sortie.reshape(haut, large, 3)


def _par_lanczos(rgb: np.ndarray, taille: tuple[int, int]) -> np.ndarray:
    return np.asarray(
        Image.fromarray(rgb, mode="RGB").resize(taille, Image.Resampling.LANCZOS)
    )


def _par_pixeloe(rgb: np.ndarray, taille: tuple[int, int]) -> np.ndarray:
    """PixelOE — les traits fins épaissis **avant** la réduction, puis choisis.

    L'astuce tient dans l'ordre : dilater et éroder selon une carte de contraste
    local avant de réduire fait survivre les traits d'un pixel de large, au lieu
    de les noyer dans une moyenne. Mesuré le 3 septembre : la hampe de la lance
    du garde reste un trait continu là où les trois autres méthodes la brisent.

    **Son option `colors` n'est pas employée**, et c'est un défaut relevé au
    banc : elle quantifie correctement puis rappelle `match_color`, qui remet
    les milliers de couleurs d'origine — 470 couleurs rendues pour 32 demandées.
    La quantification reste donc où elle doit être, sur la recette.

    Il ne travaille que sur des images carrées **et** ne rend pas exactement la
    taille demandée : on l'y ramène au plus proche, ce qui ne coûte rien puisque
    l'écart est d'un ou deux carrés.
    """
    if raison_methode(PIXELOE) is not None:
        raise MoteurAbsent("la méthode « traits épaissis » n'est pas installée")
    from pixeloe.legacy.pixelize import pixelize  # type: ignore[import-not-found]

    large, haut = taille
    vise = max(1, max(large, haut))
    rendu = pixelize(
        rgb[:, :, ::-1].copy(),
        mode="contrast",
        target_size=vise,
        patch_size=max(2, min(rgb.shape[:2]) // vise),
        thickness=2,
        colors=None,
        no_upscale=True,
    )
    rendu = np.ascontiguousarray(rendu[:, :, ::-1])
    if rendu.shape[1] == large and rendu.shape[0] == haut:
        return rendu
    return np.asarray(
        Image.fromarray(rendu, mode="RGB").resize(taille, Image.Resampling.NEAREST)
    )


_REDUCTIONS = {VOTE: _par_vote, LANCZOS: _par_lanczos, PIXELOE: _par_pixeloe}


def _reduire(
    image: Image.Image,
    taille: tuple[int, int],
    methode: str,
    *,
    silhouette_stable: bool = False,
) -> Image.Image:
    """L'image RGBA ramenée à `taille`, par la méthode demandée.

    **`proche` passe par le chemin d'avant, aux quatre canaux d'un coup.** Ce
    n'est pas de la paresse : c'est ce qui garantit qu'une recette d'avant D2
    rend exactement la même image qu'avant. Les trois autres séparent la couleur
    de l'alpha, parce qu'elles moyennent — et moyenner l'alpha rendrait des
    bords translucides que la chaîne prendrait ensuite pour du sujet.

    > ### `silhouette_stable` — le contour cessait de tenir en place (A5)
    >
    > *Au plus proche* prend **un pixel par bloc** : celui qui tombe sur le
    > centre. Sur une image seule c'est un parti pris de style, et il est juste.
    > Sur une bande, ce seul pixel décide pour ses cinquante voisins et il le
    > redécide à chaque image — donc **le moindre pixel accidenté du découpage
    > devient un bloc entier qui clignote**. C'est le contour qui bout, et il ne
    > se voit qu'en regardant l'animation tourner.
    >
    > Levé, ce drapeau fait décider la **silhouette** par le vote de majorité de
    > `_alpha_reduit` — celui que les trois autres méthodes emploient déjà — et
    > laisse la **couleur** au plus proche voisin. Il faut alors la moitié du
    > bloc pour le faire basculer, et un pixel accidenté n'y pèse plus qu'un
    > cinquantième.
    >
    > ⚠️ **Sur un bord droit, les deux répondent exactement la même chose**, et
    > ce n'est pas une approximation : *une droite qui passe par le centre d'un
    > carré le coupe toujours en deux moitiés égales*, donc « le pixel du
    > centre » et « la majorité du bloc » basculent au même instant. Ce drapeau
    > ne gagne donc rien là où le contour est lisse. Il gagne aux pointes, aux
    > traits fins, et sur les irrégularités au pixel près que laisse tout
    > découpage d'une image réelle — et c'est mesuré, pas supposé :
    > `essais/essai_stabilite_bande.py`.
    >
    > ⚠️ **Il ne se lève que pour une bande**, et jamais pour une image seule :
    > une recette nommée doit rendre exactement la même image qu'avant `A5`. Le
    > signal est la fenêtre commune, qui *est* déjà la marque d'une bande
    > (`traiter`, § `fenetre`) — il n'y a donc aucun réglage de plus à tenir.
    """
    if methode == AU_PLUS_PROCHE or methode not in _REDUCTIONS:
        if not silhouette_stable:
            return image.resize(taille, Image.Resampling.NEAREST)
        rgba = np.asarray(image.convert("RGBA"))
        couleurs = np.asarray(
            Image.fromarray(np.ascontiguousarray(rgba[:, :, :3]), mode="RGB").resize(
                taille, Image.Resampling.NEAREST
            )
        )
        alpha = _alpha_reduit(np.ascontiguousarray(rgba[:, :, 3]), taille)
        return Image.fromarray(np.dstack([couleurs, alpha]), mode="RGBA")

    rgba = np.asarray(image.convert("RGBA"))
    couleurs = _REDUCTIONS[methode](np.ascontiguousarray(rgba[:, :, :3]), taille)
    alpha = _alpha_reduit(np.ascontiguousarray(rgba[:, :, 3]), taille)
    return Image.fromarray(np.dstack([couleurs, alpha]), mode="RGBA")


def sur_grille(
    rgba: np.ndarray,
    grille: Grille,
    *,
    case: bool,
    fenetre: tuple[int, int, int, int] | None = None,
    silhouette_stable: bool | None = None,
) -> np.ndarray:
    """Le sujet, ramené à la taille de bloc demandée.

    **La cible est demandée, jamais déduite de l'image reçue** (US-61). C'est
    elle qui met un tonneau rendu sur une grille de 16 px et un personnage rendu
    sur une grille de 8 px à la même finesse : les deux ressortent avec le même
    bloc, quelle que soit la grille sur laquelle le modèle les a peints.

    Deux formes de sortie, et `case` tranche :

    - **une case carrée** de `cible` côté, où le sujet est centré
      horizontalement et posé selon `ancrage`.
    - **une homothétie** : le côté long ramené à `cible`, les proportions
      gardées. Enfermer un décor 16:9 dans une case carrée ajouterait des bandes
      que personne n'a demandées.

    `case` ne se déduit **pas** de la transparence présente dans le tableau : une
    fois recadré sur sa boîte opaque, un sprite n'a plus un seul pixel
    transparent, et la déduction rendrait une case pour les uns et pas pour les
    autres selon qu'ils ont été recadrés. Elle se déduit de la *recette* — avoir
    demandé un détourage, c'est avoir dit que ce qu'on traite a une silhouette.

    > ### ⚠️ La case ne suffit pas à superposer deux images, et le commentaire
    > ### d'ici affirmait le contraire (corrigé en `A2`, 4 septembre 2026)
    >
    > Il disait : *c'est la case qui fait que deux frames d'un même personnage se
    > superposent au lieu de flotter.* **C'est faux, et c'est la ligne du dessous
    > qui le dément** : sans `fenetre`, l'échelle se calcule sur la boîte de
    > **l'image courante**. Un bras tendu agrandit cette boîte, donc réduit tout
    > le personnage — mesuré sur un clip : 37 px de large au repos, 41 en
    > marchant, soit **10 % de plus en se mettant à marcher**.
    >
    > Le code connaissait la dérive *horizontale* — `decalage` la rattrape à la
    > main depuis `E17` — mais **pas la dérive d'échelle**, qui est la fatale :
    > on peut recentrer un personnage à la main, on ne peut pas le redimensionner
    > case par case.

    `fenetre` est la réparation, et c'est **une boîte commune à plusieurs
    images**, dans les coordonnées de `rgba` — donc après le recadrage, tel que
    `avant_la_grille` le rend. Passée, elle remplace la boîte de l'image
    courante : le sujet est découpé dessus, mis à l'échelle dessus et centré
    dessus. Toutes les images qui la partagent ressortent alors à la même
    échelle et à la même place, quoi que chacune contienne. Comment elle se
    calcule est dans `atelier/image/bande.py` ; **elle se prend sur le clip
    entier, jamais sur la seule bande qu'on garde**, sans quoi deux bandes du
    même clip n'ont plus la même assise.

    Elle ne vaut que pour une case : sans case, la sortie est une homothétie de
    l'image entière, et toutes les images d'un clip ont déjà la même taille.
    """
    cible = max(1, grille.cible)
    hauteur, largeur = rgba.shape[:2]
    image = Image.fromarray(rgba, mode="RGBA")

    # **Une fenêtre veut dire « cette image est une d'un groupe »** (A5), et
    # c'est le seul signal dont la réduction ait besoin pour cesser de tirer sa
    # silhouette au sort image par image. Rien de nouveau n'est déclaré : la
    # fenêtre porte déjà ce sens depuis `A2`, et une image seule n'en reçoit
    # jamais.
    #
    # `silhouette_stable` posé à la main **n'a qu'un seul appelant, et c'est le
    # banc** : mesurer ce qu'`A5` a gagné demande de pouvoir rejouer l'*avant*,
    # et un banc qui recopierait la chaîne d'avant mesurerait sa propre copie.
    stable = fenetre is not None if silhouette_stable is None else silhouette_stable

    if not case:
        facteur = cible / max(largeur, hauteur)
        taille = (max(1, round(largeur * facteur)), max(1, round(hauteur * facteur)))
        return np.asarray(
            _reduire(image, taille, grille.methode, silhouette_stable=stable)
        )

    boite = fenetre or boite_opaque(rgba[:, :, 3])
    if boite is None:
        return rgba  # le détourage a tout mangé : ça se voit, ça ne se répare pas ici
    x0, y0, x1, y1 = boite
    sujet = image.crop((x0, y0, x1 + 1, y1 + 1))

    # **La boîte grandit avec le sujet, au lieu de le rogner** (tranche des
    # tailles, 3 septembre 2026). Le plafond de 100 % était écrit ici deux fois
    # — dans le `min(100, …)` de l'occupation et dans les `min(cible, …)` de la
    # taille — et il fermait au produit les bâtiments, les arbres et les tours.
    # En dessous de 100 % rien ne change : le côté du canevas reste la case du
    # projet, et l'image sort au pixel près comme avant. Voir `cote_du_canevas`.
    dedans = cote_du_sujet(cible, grille.occupation)
    cote = cote_du_canevas(cible, grille.occupation)
    facteur = dedans / max(sujet.width, sujet.height)
    taille = (
        max(1, min(cote, round(sujet.width * facteur))),
        max(1, min(cote, round(sujet.height * facteur))),
    )
    reduit = _reduire(sujet, taille, grille.methode, silhouette_stable=stable)

    toile = Image.new("RGBA", (cote, cote), (0, 0, 0, 0))
    # **Centré sur sa boîte, puis décalé — et jamais hors de la case** (E17). Le
    # centrage horizontal se fait sur la boîte du sujet ; un bras tendu déplace
    # donc le corps, **et le réduit** — les deux à la fois, contrairement à ce
    # que ce commentaire affirmait jusqu'en `A2` (« sans que la taille ait
    # bougé »). Le décalage rattrape la première moitié à la main ; la seconde ne
    # se rattrape pas ainsi, et c'est `fenetre` qui la ferme.
    #
    # Il est borné à ce qui reste de place : sortir de la case couperait le
    # sprite en silence, et une case existe justement pour que rien n'en sorte.
    # Aux bords, les boutons cessent d'avoir un effet — ce qui se voit, et c'est
    # mieux qu'une image rognée.
    #
    # **Les deux parts viennent de la table des neuf ancrages** (A7), et pas
    # d'une condition écrite ici : deux endroits posent une image, et deux
    # lectures différentes de « bas » finiraient par ne plus poser au même
    # pixel. `bas` et `centre` y valent exactement ce qu'ils valaient avant.
    part_verticale, part_horizontale = parts_de(grille.ancrage)
    x = round((cote - reduit.width) * part_horizontale)
    if grille.decalage:
        x = max(0, min(cote - reduit.width, x + grille.decalage))
    y = round((cote - reduit.height) * part_verticale)
    toile.paste(reduit, (x, y))
    return np.asarray(toile)


# ── La quantification ────────────────────────────────────────────────────────


def _palette_imposee(couleurs: tuple[str, ...]) -> Image.Image:
    """La table Pillow d'une palette imposée — **remplie, jamais bourrée de noir**.

    Une table de palette compte toujours 256 entrées, et Pillow ramène chaque
    pixel à la **plus proche des 256**, pas à la plus proche de celles qu'on a
    écrites. Compléter avec des zéros posait donc 254 noirs purs dans la table,
    et tout ce qui était sombre s'y accrochait : mesuré sur six gris et une
    palette de deux couleurs claires, les deux plus sombres ressortaient en
    `#000000` — une couleur que la palette du projet ne déclare pas.

    C'est la même famille de piège que le liseré clair du § SEUIL_ALPHA : une
    valeur de remplissage qui n'est pas neutre finit par se voir sur l'image.
    On répète donc les couleurs déclarées jusqu'à remplir la table : chaque
    entrée est alors une couleur du projet, et la plus proche des 256 est
    forcément l'une d'elles.
    """
    triplets = [
        tuple(int(hexa.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))
        for hexa in couleurs
    ] or [(0, 0, 0)]

    plate: list[int] = []
    while len(plate) < 768:
        plate.extend(triplets[(len(plate) // 3) % len(triplets)])

    reference = Image.new("P", (1, 1))
    reference.putpalette(plate[:768])
    return reference


# ── Les quatre curseurs, avant la réduction (B17) ────────────────────────────
#
# **La panne qu'ils réparent se compte en couleurs, pas en dollars.** Un tirage
# revenu trop sombre partait à la quantification tel quel, et les 24 couleurs du
# jeu étaient dépensées à décrire une image mal exposée. Deux curseurs suffisent
# à rendre les 24 couleurs à ce qu'elles ont à dire.
#
# **Le neutre est l'identité à l'octet près**, et ce n'est pas un détail de
# confort : c'est ce qui permet de poser la place sans la régler et d'obtenir
# exactement l'image d'avant. `curseurs_neutres` répond une fois pour tout le
# dépôt, et cette fonction sort avant d'avoir converti quoi que ce soit.

# Les trois coefficients de la luminosité perçue — ceux de Rec. 601, les mêmes
# que le reste du monde emploie pour désaturer. Ils sont ici plutôt qu'une
# moyenne à parts égales parce que l'œil ne pèse pas le vert comme le bleu :
# désaturer à parts égales éclaircit les bleus et assombrit les verts, ce qui se
# voit tout de suite sur une herbe de marais.
LUMA = (0.299, 0.587, 0.114)


def _sinus_de_la_teinte(luma: tuple[float, float, float]) -> tuple[float, float, float]:
    """La ligne du milieu de la matrice de teinte, **déduite de la luma**.

    Les deux autres lignes s'écrivent directement avec les trois poids ; la
    troisième ne se devine pas, et c'est celle que tout le monde recopie du
    W3C. Elle est ici le seul jeu de nombres qui laisse à la fois l'axe des
    gris fixe et la luminosité perçue inchangée — la contrainte s'écrit
    « la luma de la sortie est celle de l'entrée », et elle a une seule
    solution. Pour la luma du W3C elle rend bien `0,1427 · 0,1410 · −0,2837`,
    c'est-à-dire les trois nombres de la spécification, arrondis.
    """
    r, v, b = luma
    return (
        (r * r + b - b * r) / v,
        r - b,
        -(r * (1 - b) + b * b) / v,
    )


_SINUS_DE_LA_TEINTE = _sinus_de_la_teinte(LUMA)


def _rotation_de_teinte(degres: float) -> np.ndarray:
    """La matrice qui tourne les couleurs autour de l'axe des gris.

    **Une rotation, pas un décalage de canal** : le gris reste gris, la
    luminosité perçue ne bouge pas, et un tour complet rend l'image de départ.
    Elle est écrite ici plutôt qu'un aller-retour en TSV — un aller-retour en
    8 bits perd des couleurs à chaque passage, et le produit tient à ce que la
    même recette rende toujours le même pixel.

    ⚠️ **Les trois constantes du filtre du web ne se recopient pas.** La
    première écriture de cette fonction reprenait `0.143`, `0.140`, `-0.283` de
    la spécification W3C tout en posant `LUMA` de Rec. 601 sur les deux autres
    lignes. Ces trois nombres-là ne sont pas des constantes universelles : ils
    sont **calculés à partir de la luma du W3C**, qui n'est pas la nôtre
    (0,213 / 0,715 / 0,072 contre 0,299 / 0,587 / 0,114). Mélangées, elles
    faisaient une matrice qui n'était plus une rotation : `+90°` puis `-90°` ne
    rendait pas l'image de départ, et un bleu saturé gagnait 30 % de luminosité
    au passage. Le défaut ne se voyait pas sur un gris — la ligne du milieu
    sommait quand même à 1 — et c'est pourquoi il faut ici les deux essais que
    `B17` a ajoutés après coup : *une couleur connue tombe où il faut*, et *la
    luminosité perçue ne bouge pas*.

    Les trois nombres se déduisent de la luma en imposant que l'axe des gris
    soit fixe et que la luminosité soit conservée — c'est ce que fait la ligne
    `_sinus_de_la_teinte` ci-dessous, et c'est pourquoi elle est calculée et non
    écrite en dur : changer `LUMA` sans elle recasserait tout en silence.
    """
    angle = math.radians(degres)
    cos, sin = math.cos(angle), math.sin(angle)
    r, v, b = LUMA
    s0, s1, s2 = _SINUS_DE_LA_TEINTE
    return np.array(
        [
            [r + cos * (1 - r) - sin * r, v - cos * v - sin * v, b - cos * b + sin * (1 - b)],
            [r - cos * r + sin * s0, v + cos * (1 - v) + sin * s1, b - cos * b + sin * s2],
            [r - cos * r - sin * (1 - r), v - cos * v + sin * v, b + cos * (1 - b) + sin * b],
        ],
        dtype=np.float32,
    )


def regler_les_couleurs(rgba: np.ndarray, quantification: Quantification) -> np.ndarray:
    """Luminosité, contraste, saturation, teinte — **avant** la réduction.

    L'ordre des quatre n'est pas indifférent, et c'est celui de la planche :
    on éclaircit, on écarte du gris, on sature, on tourne. Le contraste après la
    luminosité parce qu'il écarte autour du gris moyen — l'inverse aurait
    ramené vers le centre ce qu'on venait de remonter.

    **L'alpha n'est ni lu ni écrit.** Les quatre curseurs ne peuvent donc pas
    changer d'un pixel ce que le détourage a décidé.
    """
    if quantification.curseurs_neutres:
        return rgba

    couleurs = rgba[:, :, :3].astype(np.float32) / 255.0

    if quantification.luminosite:
        couleurs = couleurs + quantification.luminosite / 100.0

    if quantification.contraste:
        # Un contraste de +100 double l'écart au gris moyen, un contraste de
        # −100 écrase tout sur le gris. La courbe est une droite : c'est ce que
        # le curseur montre, et une courbe en S aurait fait dire au réglage
        # autre chose que ce qu'il dit.
        couleurs = 0.5 + (couleurs - 0.5) * (1.0 + quantification.contraste / 100.0)

    if quantification.saturation:
        gris = couleurs @ np.array(LUMA, dtype=np.float32)
        couleurs = gris[:, :, None] + (couleurs - gris[:, :, None]) * (
            1.0 + quantification.saturation / 100.0
        )

    if quantification.teinte:
        couleurs = couleurs @ _rotation_de_teinte(quantification.teinte).T

    sortie = rgba.copy()
    sortie[:, :, :3] = np.clip(couleurs * 255.0 + 0.5, 0, 255).astype(np.uint8)
    return sortie


# ── L'échange de couleurs, après la réduction (B17) ──────────────────────────
#
# **Trois pèlerins pour une génération.** Trois capes de couleurs différentes
# coûtaient trois tirages, et rendaient trois silhouettes différentes. Une table
# de correspondance sur une image déjà finie les rend identiques au pixel près,
# gratuitement — ce qu'une génération ne sait pas faire.
#
# **Après la quantification, et c'est ce qui la rend exacte.** Posé avant, le
# bleu qu'on vient d'écrire repartirait au plus proche de la palette, donc
# peut-être au brun d'où il vient. Posé après, il nomme des couleurs finies et
# rend exactement celles qu'on a demandées.


def echanger_les_couleurs(
    rgba: np.ndarray, echanges: Sequence[Echange]
) -> np.ndarray:
    """La table de correspondance, appliquée d'un seul coup.

    **Une paire ne repasse jamais sur ce qu'une autre a posé.** Les écarts se
    mesurent tous sur l'image d'entrée, et un pixel déjà pris par une paire est
    fermé aux suivantes : `brun → bleu` puis `bleu → vert` laisse le brun bleu,
    au lieu de l'envoyer au vert par un chemin que personne n'a écrit. Il reste
    un seul cas où l'ordre des lignes décide — deux paires dont les tolérances
    se recouvrent sur le même pixel : la première le prend, et c'est la règle
    qu'on peut lire dans la table, de haut en bas.

    **L'écart se mesure comme partout ailleurs dans l'atelier** — la distance de
    Tchebychev, celle de `detourer_bord` et de `domaine/fond.py`. Une seconde
    façon de mesurer une distance de couleur aurait fini par répondre autrement
    que la première sur la même image.

    **L'alpha n'est ni lu ni écrit** : c'est ce qui tient le critère de la
    tranche — *la silhouette est identique à l'octet près*.
    """
    vives = [e for e in echanges if e.depuis and e.vers]
    if not vives:
        return rgba

    entree = rgba[:, :, :3].astype(np.int16)
    sortie = rgba.copy()
    pris = np.zeros(rgba.shape[:2], dtype=bool)

    for echange in vives:
        cible = np.array(_rvb(echange.depuis), dtype=np.int16)
        ecart = np.abs(entree - cible).max(axis=2)
        touche = (ecart <= max(0, echange.tolerance)) & ~pris
        if not touche.any():
            continue
        sortie[:, :, :3][touche] = np.array(_rvb(echange.vers), dtype=np.uint8)
        pris |= touche

    return sortie


def quantifier(rgba: np.ndarray, quantification: Quantification) -> np.ndarray:
    """Des aplats, à la place de trente mille couleurs.

    **Déterministe, et c'est un critère** : « une recette nommée, réappliquée
    ailleurs, donne exactement le même résultat ». Une initialisation aléatoire
    de k-moyennes rendrait deux images différentes pour la même recette — d'où
    la coupe médiane de Pillow, qui ne tire rien au sort, plutôt que le k-means++
    de `MySpriteAi/src/lib/pixelPipeline.ts`.

    L'alpha est mis de côté et remis **tel quel** : la quantification ne touche
    jamais la transparence. C'est l'autre moitié du piège du liseré — forcer
    l'alpha à 255 en même temps qu'on ramène les couleurs ressort les contours à
    demi transparents en pixels opaques de la couleur du fond.
    """
    alpha = rgba[:, :, 3].copy()
    rgb = Image.fromarray(rgba[:, :, :3], mode="RGB")
    tramage = (
        Image.Dither.FLOYDSTEINBERG
        if quantification.tramage == FLOYD
        else Image.Dither.NONE
    )

    if quantification.palette:
        indexee = rgb.quantize(
            palette=_palette_imposee(quantification.palette), dither=tramage
        )
    else:
        couleurs = max(2, min(256, quantification.couleurs))
        indexee = rgb.quantize(
            colors=couleurs, method=Image.Quantize.MEDIANCUT, dither=tramage
        )

    sortie = np.dstack([np.asarray(indexee.convert("RGB")), alpha])
    return sortie


# ── L'ordre fixe ─────────────────────────────────────────────────────────────


def _tableau(octets: bytes) -> np.ndarray:
    with Image.open(io.BytesIO(octets)) as image:
        return np.asarray(image.convert("RGBA")).copy()


def _en_png(rgba: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(tampon, format="PNG", optimize=True)
    return tampon.getvalue()


def _detourer(rgba: np.ndarray, passe: Passe) -> np.ndarray:
    """Une passe. L'alpha déjà posé n'est jamais rendu : il ne peut que se serrer.

    Une seconde passe travaille donc sur ce que la première a laissé, et non sur
    l'image d'origine — c'est ce qui fait que les passes s'enchaînent au lieu de
    se remplacer.
    """
    if passe.moteur == MODELE:
        neuf = _detourer_modele(rgba[:, :, :3], passe.modele)
    elif passe.moteur == TRACE:
        # **Une sélection magique sans forme ne fait rien** — même règle que la
        # pipette non visée : on ajoute la passe avant d'entourer, et le temps
        # qu'on prenne la souris ne doit pas manger l'image.
        if len(passe.trace) < 3:
            return rgba
        neuf = detourer_trace(
            rgba[:, :, :3],
            passe.trace,
            passe.tolerance,
            reste=rgba[:, :, 3] > 0,
        )
    elif passe.moteur == COULEUR:
        # **Une pipette sans point ne fait rien**, et surtout pas « tout » : on
        # ajoute la passe avant de viser, et la moitié de seconde entre les deux
        # ne doit pas manger l'image sous les yeux de celui qui va cliquer.
        if passe.point is None:
            return rgba
        neuf = detourer_couleur(
            rgba[:, :, :3],
            passe.point,
            passe.tolerance,
            partout=passe.portee == PARTOUT,
            # **Ce qui est déjà effacé n'est plus un chemin** (U10) : sans
            # cette ligne, la tache repart par le couloir que la passe
            # précédente a ouvert et ressort ailleurs dans l'image.
            reste=rgba[:, :, 3] > 0,
        )
    else:
        neuf = detourer_bord(rgba[:, :, :3], passe.tolerance)

    alpha = np.minimum(rgba[:, :, 3], neuf)
    alpha = durcir(alpha, passe.seuil_alpha)

    # ── Les deux réparations de bord de D4 ───────────────────────────────────
    #
    # **Elles partagent une seule mesure** : la couleur que *cette passe-ci*
    # vient de retirer. Aucun des quatre moteurs ne la déclare — le modèle ne
    # rend qu'un masque —, mais tous laissent derrière eux les pixels qu'ils ont
    # ouverts, et *effacer un pixel ne change pas sa couleur* (`AGENTS.md`,
    # point 5). Le fond de la passe se lit donc dans son propre résultat.
    #
    # **L'ordre n'est pas indifférent** : on ronge d'abord, on décontamine
    # ensuite. Ronger après aurait retiré des pixels qu'on venait de repeindre,
    # et le travail de la seconde aurait été jeté par la première.
    fond = _couleur_enlevee(rgba[:, :, :3], rgba[:, :, 3], alpha)
    alpha = ronger_conditionnel(rgba[:, :, :3], alpha, passe.durcissement, fond)
    sortie = rgba.copy()
    sortie[:, :, 3] = alpha
    sortie[:, :, :3] = decontaminer(
        rgba[:, :, :3], alpha, fond, passe.tolerance
    )
    return sortie


def detourer(recette: Recette, octets: bytes) -> np.ndarray:
    """L'étape 1, seule — parce que c'est la seule qui coûte cher.

    Mesuré le 27 août 2026 sur une image de 1024 px : 130 ms pour le détourage,
    28 ms pour les quatre étapes qui le suivent. Or ce sont ces quatre-là qu'on
    fait glisser. L'appelant garde donc ce tableau sous la main tant que les
    passes ne changent pas, et ne repaie que la queue.
    """
    rgba = _tableau(octets)
    # **Une place endormie est sautée, elle n'est pas vidée** (U4). Le détourage
    # est la seule place dont l'endormissement se lise ici : les sept autres
    # vivent dans la queue. Rien de l'ordre fixe ne bouge — on saute, on ne
    # réordonne pas.
    #
    # **Une passe masquée est sautée, elle n'est pas vidée** (U10) — le geste de
    # la veille d'une table, un cran plus bas. Elle garde tous ses réglages ; la
    # rallumer rend exactement l'état d'avant. `passes_vives` répond pour les
    # deux extinctions à la fois, celle de la place et celle de la passe.
    for passe in recette.passes_vives():
        # **Une passe dont le moteur manque est sautée, elle ne fait pas tomber
        # les autres** (U13). Une recette voyage : elle peut nommer un modèle
        # qu'une autre machine n'a pas, et l'image doit alors sortir avec les
        # sept autres places plutôt que pas du tout. Ce qui manque est **dit** —
        # l'écran grise le moteur avec sa raison, sur la passe elle-même — et
        # `sans_moteur` en donne la liste à qui la demande.
        if passe.moteur == MODELE and raison_du_modele(passe.modele) is not None:
            continue
        rgba = _detourer(rgba, passe)
    return rgba


def raison_du_modele(modele: str) -> str | None:
    """Pourquoi cette passe par modèle n'agira pas — ou `None` (U13).

    **Deux absences, et une seule des deux se grise.** Le paquet absent est une
    raison de griser le moteur ; un nom de modèle inconnu est une recette qui
    parle d'un catalogue qu'elle ne connaît pas. Le modèle *pas encore descendu*,
    lui, n'est **pas** une raison : il se rapatrie tout seul au premier rendu, et
    c'est ce que l'écran annonce avant de partir.
    """
    absent = raison_moteur(MODELE)
    if absent is not None:
        return absent
    if silhouette(modele) is None:
        return f"modèle de silhouette inconnu — « {modele} »"
    return None


def sans_moteur(recette: Recette) -> list[str]:
    """Les passes qui n'agiront pas faute de moteur, nommées par leur rang."""
    return [
        f"passe {rang} : {raison_du_modele(p.modele)}"
        for rang, p in enumerate(recette.passes, start=1)
        if p.moteur == MODELE and not p.masquee and raison_du_modele(p.modele)
    ]


def en_rendu(rgba: np.ndarray) -> Rendu:
    """Le PNG et ses dimensions, sur un tableau **déjà fini**.

    **Séparée de `finir` en `B1`, et pas pour la forme.** Le service tenait
    `finir(queue(rgba, recette), recette)` : la queue de la recette s'appliquait
    **deux fois** à chaque rendu. Sept places l'ont supporté sans qu'on le voie —
    recadrer une image déjà recadrée ne coupe plus rien, quantifier une palette
    déjà réduite la laisse en place —, mais deux d'entre elles ne sont pas
    idempotentes et rendaient une image fausse :

    - **le contour**, tracé une seconde fois autour de la silhouette qu'il venait
      d'agrandir : un trait demandé à 1 px en rendait 2. *Défaut livré, antérieur
      à cette tranche, trouvé au navigateur le 6 septembre 2026.*
    - **le retournement**, qui est une involution : deux miroirs gauche-droite
      rendent l'image de départ, et la tranche entière était sans effet à
      l'écran pendant que tous ses essais passaient au vert.

    Aucun essai ne pouvait l'attraper : ils appellent `queue` ou `contourner`
    directement, une seule fois. Ce qui l'a trouvé est d'avoir regardé les
    octets **servis par la route**, sur un sujet dissymétrique — un carré centré
    est son propre miroir et n'aurait rien montré.
    """
    hauteur, largeur = rgba.shape[:2]
    return Rendu(octets=_en_png(rgba), largeur=largeur, hauteur=hauteur)


def finir(
    rgba: np.ndarray,
    recette: Recette,
    fenetre: tuple[int, int, int, int] | None = None,
) -> Rendu:
    """Les places 2 à 8, puis le PNG et ses dimensions."""
    return en_rendu(queue(rgba, recette, fenetre))


# ── Le lit de couleur sous la transparence (B17) ─────────────────────────────
#
# **La seule des quatre réparations de la tranche qui ne soit le réglage de
# personne.** Les trois autres sont des choix ; celle-ci répare un défaut du
# fichier, et le critère est écrit sans condition — *un fichier exporté ne porte
# plus de magenta sous ses pixels transparents*, pas *peut ne plus en porter*.
# En faire une place l'aurait laissée éteinte sur les soixante et une recettes
# du dépôt, c'est-à-dire n'aurait rien réparé.
#
# **Ce qu'elle ne touche pas, et c'est ce qui la rend sûre** : elle n'écrit que
# dans des pixels dont l'alpha est **exactement nul**, et elle ne touche jamais
# l'alpha. Un pixel visible, même à moitié transparent, sort à l'octet près comme
# avant. Elle ne peut donc rien changer à ce qu'on voit — seulement à ce qui
# remonte quand l'image est réduite de moitié, tournée, ou rangée dans une
# planche, et c'est très exactement le liseré que le relevé décrit.

# Deux ou trois pixels, dit la planche. Trois : c'est ce qu'il faut pour qu'une
# réduction de moitié suivie d'une seconde ne retrouve toujours pas le fond.
LIT_DE_COULEUR = 3

# Une couleur codée sur trois octets tient sous 2²⁴ ; cette valeur-là est donc
# au-dessus de toutes les autres, et *le plus petit voisin* ne peut jamais la
# choisir. C'est ce qui remplace un test « ce voisin est-il connu ? » à chaque
# lecture — et ce qui remplit le cadre d'un pixel posé autour de l'image.
COULEUR_INCONNUE = 1 << 24


def etaler_sous_la_transparence(rgba: np.ndarray, pixels: int = LIT_DE_COULEUR) -> np.ndarray:
    """La couleur du bord, étalée vers l'extérieur sous les pixels vides.

    Le détourage met les pixels du fond à zéro d'opacité et **ne touche pas à
    leur couleur** : chaque pixel vide du fichier porte encore le magenta du
    fond. Tant que le jeu affiche au pixel près, personne ne le voit ; dès qu'un
    filtre mélange deux pixels voisins — une réduction, une rotation, une planche
    —, le magenta remonte en liseré autour du sujet.

    **Elle recopie, elle ne moyenne pas.** Chaque pixel vide prend une couleur
    qu'un de ses voisins déjà connus porte. Une moyenne aurait fabriqué une
    couleur que l'image ne contient pas, et cette couleur-là aurait fini par
    manger une place dans la palette d'une planche quantifiée plus tard.

    **Et elle choisit d'une façon qui ne connaît pas la gauche de la droite** :
    parmi les couleurs des voisins connus, la plus petite lue comme un nombre.
    Ce n'est pas une coquetterie — prendre *le premier voisin dans un ordre fixe*
    marchait aussi bien, et **cassait l'involution du miroir** que `B1` a posée :
    l'ordre des huit voisins n'est pas symétrique, si bien que retourner une
    image puis la retourner encore ne rendait plus exactement l'image de départ.
    Le défaut ne se voyait sur aucun pixel visible, et les cinq essais de `B1`
    l'ont attrapé — c'est précisément à ça qu'ils servent. Un choix qui ne dépend
    que de l'ensemble des couleurs voisines, jamais de leur position, commute
    avec le miroir comme avec n'importe quel quart de tour à venir.

    **Au-delà du lit, un pixel vide ne porte plus rien du tout.** Étaler la
    couleur jusqu'au bord aurait demandé autant de passes que l'image est large —
    une seconde sur un dessin de 2 048 — et aurait fait grossir le fichier, un
    aplat uni se compressant en presque rien là où un semis de teintes ne se
    compresse pas. Les remettre à zéro coûte une ligne, rend le critère vrai à la
    lettre — *plus de magenta sous aucun pixel transparent* —, et ce qui reste au
    loin ne peut de toute façon atteindre le sujet sous aucun filtre : il y a
    trois pixels de vraie couleur entre les deux.

    ⚠️ **Elle ne travaille que sur la frontière, et il a fallu la réécrire pour
    ça.** La première version empilait trois voisinages de huit valeurs sur
    *toute* l'image et à *chaque* passe — quatre-vingt-seize octets par pixel et
    par passe. Sur une case de 64 le prix ne se voyait pas ; sur un dessin de
    2 048 sans place `grille`, il montait à 2,2 secondes, **à chaque rendu
    détouré**. Le moteur ne peint pourtant qu'un liseré de trois pixels : il
    lit maintenant les huit voisins des seuls pixels de la frontière, et le seul
    calcul qui balaie l'image entière est une dilatation de booléens, à un octet
    par pixel. Mesuré à 2 048 : 2 231 ms → 157 ms, et à 64 : 2,0 ms → 0,5 ms.
    """
    if pixels <= 0:
        return rgba
    connu = rgba[:, :, 3] > 0
    # Rien à étaler quand tout est plein, et rien d'où partir quand tout est
    # vide : une image entièrement transparente n'a aucune couleur de bord.
    if not connu.any() or connu.all():
        return rgba

    hauteur, largeur = connu.shape
    # Les trois canaux en un seul nombre, pour que « la plus petite couleur »
    # soit une comparaison et non trois. Un pixel inconnu prend une valeur
    # au-dessus de toutes les autres : il ne peut jamais être choisi.
    borde = np.full((hauteur + 2, largeur + 2), COULEUR_INCONNUE, dtype=np.int32)
    borde[1:-1, 1:-1] = (
        rgba[:, :, 0].astype(np.int32) * 65536
        + rgba[:, :, 1].astype(np.int32) * 256
        + rgba[:, :, 2].astype(np.int32)
    )
    # Le cadre d'un pixel évite un test de bord à chaque lecture, et il vaut
    # *inconnu* : le dehors de l'image ne peut pas donner sa couleur.
    borde[1:-1, 1:-1][~connu] = COULEUR_INCONNUE
    plein = np.zeros((hauteur + 2, largeur + 2), dtype=bool)
    plein[1:-1, 1:-1] = connu

    for _ in range(pixels):
        # La frontière : les pixels vides qui touchent un pixel connu. C'est le
        # seul calcul qui balaie l'image entière — huit « ou » sur des booléens.
        touche = np.zeros((hauteur, largeur), dtype=bool)
        for dy, dx in VOISINS:
            touche |= plein[1 + dy : hauteur + 1 + dy, 1 + dx : largeur + 1 + dx]
        frontiere = touche & ~connu
        if not frontiere.any():
            break
        lignes, colonnes = np.nonzero(frontiere)
        y, x = lignes + 1, colonnes + 1
        # Les huit voisins des seuls pixels de la frontière. Ils sont tous lus
        # **avant** la moindre écriture : la passe est donc simultanée, et deux
        # pixels voisins de la frontière ne se donnent pas leur couleur l'un à
        # l'autre au milieu du balayage.
        voisines = np.stack([borde[y + dy, x + dx] for dy, dx in VOISINS], axis=1)
        borde[y, x] = voisines.min(axis=1)
        plein[y, x] = True
        connu[lignes, colonnes] = True

    sortie = rgba.copy()
    # Ce qui vient d'être peint, et lui seul : les pixels déjà opaques gardent
    # leur couleur à l'octet près.
    peints = connu & (rgba[:, :, 3] == 0)
    if peints.any():
        codes = borde[1:-1, 1:-1][peints]
        sortie[:, :, :3][peints] = np.stack(
            [(codes >> 16) & 0xFF, (codes >> 8) & 0xFF, codes & 0xFF], axis=1
        ).astype(np.uint8)
    reste = ~connu
    if reste.any():
        sortie[:, :, :3][reste] = 0
    return sortie


def avant_la_grille(rgba: np.ndarray, recette: Recette) -> np.ndarray:
    """L'image **telle que `sur_grille` la verra** : détourée, puis recadrée si
    la recette le demande.

    Publique depuis `A2`, et pour une raison précise : la fenêtre commune d'une
    bande est une boîte **dans ces coordonnées-là**. Refaire ce préfixe ailleurs
    ferait deux façons de le calculer, et deux façons de recadrer finiraient par
    donner deux systèmes de coordonnées — la fenêtre tomberait alors à côté sans
    que rien ne lève.
    """
    if recette.recadrage is not None and not recette.dort(RECADRAGE):
        return _recadrer(rgba, recette.recadrage)
    return rgba


def queue(
    rgba: np.ndarray,
    recette: Recette,
    fenetre: tuple[int, int, int, int] | None = None,
    *,
    silhouette_stable: bool | None = None,
) -> np.ndarray:
    """Les places 2 à 8, sur une image déjà détourée. Dans l'ordre, toujours.

    **Séparée de `finir` le 31 août 2026, et pour une raison qui n'est pas
    esthétique** : les mesures d'une table décrivent l'image *à un rang donné de
    la recette* — ce que le seuil des bords va couper se lit avant les bords, ce
    que la main a touché se lit avant la main. Elles ont donc besoin du tableau,
    pas du PNG, et le rouvrir depuis les octets aurait payé un encodage pour
    rien à chaque relecture de curseur.
    """
    # **Une place endormie est sautée, et l'ordre ne bouge pas d'un cran** (U4).
    # `dort` est la seule lecture de la veille dans tout le dépôt : l'écran,
    # l'agent et les mesures posent la même question au même endroit, et une
    # seconde façon de la poser finirait par répondre autrement. Ce qui est
    # promis en échange est mesuré par un essai : *une image traitée avec une
    # place en veille sort identique au pixel près à la même sans cette place du
    # tout.*
    rgba = avant_la_grille(rgba, recette)

    if recette.grille is not None and not recette.dort(GRILLE):
        # La case suit le détourage : avoir demandé une silhouette, c'est avoir
        # dit que ce qu'on traite est un sprite et qu'il vit dans une case.
        #
        # **Et elle suit le détourage qui agit, pas celui qui est écrit** (U4).
        # C'est le seul endroit du traitement où une place en regarde une autre,
        # donc le seul où la veille pouvait fuir. La tentation était de garder la
        # case pendant qu'on éteint le détourage, pour que l'image ne change pas
        # de taille en même temps qu'elle change de fond ; on ne l'a pas suivie,
        # parce que ce que la veille promet est plus précieux que ce confort-là :
        # *endormie veut dire sans effet, pas presque sans effet.* Une place à
        # qui l'on doit se demander ce qu'elle laisse traîner n'est pas un
        # interrupteur, c'est une nuance de plus à tenir en tête.
        # **Et la même fuite guettait au cran d'en dessous** (U10) : lire « des
        # passes sont écrites » plutôt que « des passes agissent » aurait gardé
        # la case pendant qu'on masque la dernière.
        detoure = bool(recette.passes_vives())
        # **La fenêtre commune, quand une bande la fournit** (A2). Sans elle,
        # rien ne change d'un cheveu : l'échelle et le centrage se reprennent sur
        # la boîte de l'image, comme depuis T2.
        rgba = sur_grille(
            rgba,
            recette.grille,
            case=detoure,
            fenetre=fenetre,
            silhouette_stable=silhouette_stable,
        )

    if recette.quantification is not None and not recette.dort(QUANTIFICATION):
        # ── Les trois moments de la table *Couleurs* (B17) ────────────────────
        #
        # **Les curseurs avant, la réduction, l'échange après** — et l'ordre est
        # la moitié de leur raison d'être. Un curseur posé après la réduction
        # repeindrait vingt-quatre couleurs choisies avec soin et rendrait une
        # palette que le jeu ne connaît pas ; un échange posé avant serait défait
        # par la réduction, qui renverrait le bleu qu'on vient d'écrire au plus
        # proche de la palette — c'est-à-dire peut-être au brun d'où il vient.
        #
        # Les trois dorment ensemble, parce que c'est **une seule table** à
        # l'écran comme dans la planche : endormir *Couleurs* rend l'image telle
        # qu'elle est entrée, ce que la veille promet depuis U4.
        rgba = regler_les_couleurs(rgba, recette.quantification)
        rgba = quantifier(rgba, recette.quantification)
        rgba = echanger_les_couleurs(rgba, recette.quantification.echanges)

    if recette.bords is not None and not recette.dort(BORDS):
        rgba = nettoyer(rgba, recette.bords)

    # Les deux places de E5. Le contour après les miettes et après les
    # couleurs ; la main après tout, y compris après lui.
    if recette.contours is not None and not recette.dort(CONTOURS):
        # **Les deux régimes du trait** (D4). Sur une image qu'on vient de poser
        # sur la case du projet, un pixel *est* un bloc du sprite et le trait
        # était déjà juste : on ne mesure rien, et c'est aussi ce qui évite de
        # payer un balayage de profils à chaque glissement de curseur — le cas
        # de presque toutes les recettes. Sans case, la seule maille qui existe
        # est celle sur laquelle le modèle a peint, et `retrouver_grille` sait
        # la rendre **ou se taire**.
        sur_case = recette.grille is not None and not recette.dort(GRILLE)
        rgba = contourner(
            rgba, recette.contours, None if sur_case else retrouver_grille(rgba)
        )

    # Le miroir en queue, après le contour et avant la main (B1). Le trait se
    # trace donc sur la silhouette de départ, puis se retourne avec elle.
    if recette.retournement is not None and not recette.dort(RETOURNEMENT):
        rgba = retourner(rgba, recette.retournement)

    if recette.main is not None and not recette.dort(LA_MAIN):
        rgba = retoucher(rgba, recette.main)

    # ── Le lit de couleur, en tout dernier (B17) ─────────────────────────────
    #
    # **Il vient après la main** parce que la main est la dernière à créer de la
    # transparence — *ôter* ouvre des pixels, et un lit posé plus tôt les aurait
    # manqués. Il n'est le réglage de personne : c'est une réparation du fichier,
    # pas un effet qu'on ajoute, et il ne peut rien changer à ce qui se voit.
    #
    # **Il répare ce que le détourage a laissé, et rien d'autre.** Le magenta
    # sous la transparence est là parce que *nous* avons mis ces pixels à zéro
    # d'opacité sans toucher à leur couleur ; une image que rien n'a détourée
    # n'a pas de fond à cacher, et la lui repeindre serait poser un effet là où
    # il n'y a pas de panne. La conséquence se dit simplement : **la tranche ne
    # change aucun rendu qui n'a pas été détouré**, et les essais du miroir
    # (`B1`) le mesurent sans avoir eu besoin d'une ligne de plus.
    #
    # C'est la même lecture que la case ci-dessus — `passes_vives`, la seule du
    # dépôt qui réponde à *le détourage agit-il ?* Une seconde façon de la poser
    # finirait par répondre autrement.
    if recette.passes_vives():
        rgba = etaler_sous_la_transparence(rgba)

    return rgba


def appliquer(
    recette: Recette,
    octets: bytes,
    fenetre: tuple[int, int, int, int] | None = None,
) -> Rendu:
    """La recette, du début à la fin, dans l'ordre qui ne se négocie pas.

    Ne lève pas quand le détourage a tout mangé : elle rend l'image vide telle
    quelle. « Un détourage qui a mangé le sujet se voit immédiatement et se
    reprend avec d'autres réglages » (`docs/archive/plan-versions-tenues.md`, T2) — se voir suppose
    d'être rendu, pas d'être refusé.

    `fenetre` n'est jamais posée par le traitement d'une image seule : elle vient
    d'une **bande**, qui sait ce que ses images occupent ensemble (`A2`).
    """
    return finir(detourer(recette, octets), recette, fenetre)


# ── Le diagnostic ────────────────────────────────────────────────────────────


# En dessous, le profil ne se répète pas assez pour qu'on parle de grille. Seuil
# posé à la mesure : sur le corpus du 27 août 2026, les images franchement
# pixelisées montent à 0,45–0,92 et rien d'ambigu ne dépasse 0,35.
NETTETE_MINIMALE = 0.35


def mesurer_grille(octets: bytes, maximum: int = 64) -> tuple[int, float]:
    """Sur quelle grille le modèle a-t-il peint ? Le pas, et sa netteté.

    Mesure **descriptive, jamais prescriptive** : la cible du produit est
    demandée, jamais déduite de l'image reçue (US-61). Elle sert au banc, qui a
    besoin de chiffrer la dérive de grille d'un modèle à l'autre.

    Méthode : le contraste entre colonnes voisines se concentre sur les
    frontières de blocs ; on cherche donc la période de ce profil par
    autocorrélation, et on retient la **plus petite** période qui approche le
    maximum — sinon on rapporte une harmonique au lieu de la fondamentale.

    **Ce qu'elle sait faire, et ce qu'elle ne sait pas.** Confrontée le 27 août
    2026 aux jugements portés à l'œil sur le banc du 26, elle tombe juste sur les
    sujets fins (squelette, cadre : 8 px mesurés contre 6–8 jugés) et **prend une
    harmonique sur les plus grossiers** (potion : 17 px mesurés contre 30–37
    jugés). Elle situe donc un ordre de grandeur ; elle ne remplace pas l'œil, et
    aucun chiffre de dérive publié ne doit venir d'elle seule.

    Une première version cherchait, pour chaque pas candidat, la phase qui
    ramasse le plus de contraste. Elle est retirée : à grand pas, la phase
    retenue porte peu d'échantillons, son maximum est mécaniquement flatté, et
    la mesure répondait 40 à 64 px sur tout le corpus — c'est-à-dire le haut de
    sa propre plage de recherche, ce qui aurait dû l'alerter.
    """
    with Image.open(io.BytesIO(octets)) as image:
        gris = np.asarray(image.convert("L"), dtype=np.float64)

    profils = (
        np.abs(np.diff(gris, axis=1)).sum(axis=0),
        np.abs(np.diff(gris, axis=0)).sum(axis=1),
    )

    meilleur_pas, meilleure_nettete = 0, 0.0
    for profil in profils:
        pas, nettete = _periode(profil, min(maximum, profil.size // 4))
        if nettete > meilleure_nettete:
            meilleur_pas, meilleure_nettete = pas, nettete
    return meilleur_pas, round(meilleure_nettete, 3)


def _periode(profil: np.ndarray, maximum: int) -> tuple[int, float]:
    centre = profil - profil.mean()
    variance = float((centre * centre).mean())
    if variance == 0 or maximum < 2:
        return 0, 0.0

    correlations = {
        pas: float((centre[:-pas] * centre[pas:]).mean() / variance)
        for pas in range(2, maximum + 1)
    }
    crete = max(correlations.values())
    if crete < NETTETE_MINIMALE:
        return 0, crete  # pas de grille franche — une réponse, pas un échec

    for pas in sorted(correlations):
        voisines = (correlations.get(pas - 1, -1.0), correlations.get(pas + 1, -1.0))
        if correlations[pas] >= 0.9 * crete and correlations[pas] >= max(voisines):
            return pas, correlations[pas]
    return max(correlations, key=correlations.__getitem__), crete


# ── La grille du modèle, retrouvée — D2, seconde moitié ──────────────────────
#
# **`mesurer_grille` reste juste au-dessus et ne bouge pas.** C'est la version
# faible ; elle est gardée parce que les bancs s'appuient dessus pour chiffrer
# l'écart entre les deux, et parce qu'un piège corrigé ne s'efface pas du dépôt.
# Ce qui suit est la version qui **décide**, et c'est elle que l'écran montre.
#
# Trois écarts, et chacun vient d'une mesure du banc
# `essais/essai_grille_retrouvee.py` — gratuit : il relit des images déjà sur le
# disque et fabrique les autres lui-même.
#
# **1. La somme des canaux, alpha compris, au lieu des niveaux de gris.** Sur des
# images pleines, l'écart est mince et il faut le dire ainsi : 200 cas justes
# contre 199 sur le lot de réception. Ce qui décide est ailleurs, et c'est franc
# — le produit détecte sur l'image **détourée**, et il existe des sprites dont
# toute la grille vit dans la silhouette : un sujet d'une seule teinte sur un
# fond peint sans grille. Le gris jette l'alpha en entrant, donc il cherche une
# période dans le fond et répond **2 à tous les coups**
# (`tests/test_d2.py::test_l_alpha_porte_une_grille…`). Deux couleurs de
# luminance égale, elles, disparaissent aussi l'une dans l'autre en gris — le
# cas est réel, il est simplement plus rare que le précédent.
#
# **2. Le peigne, qui dit s'il y a une grille du tout**, et c'est la pièce qui
# manquait. Sans lui, l'autocorrélation d'une peinture décroît doucement depuis
# le pas 2 sans jamais faire de bosse ; la règle du plus petit pas qualifié
# attrape alors ce 2 — il n'a pas de voisin de gauche à qui se comparer — et la
# mesure répond **2 avec une netteté de 0,83** sur une image qui n'a aucune
# grille. C'est très exactement ce que `mesurer_grille` fait aujourd'hui.
#
# **3. La borne de balayage vient du dépôt**, et elle vaut 32 px. Voir
# `PAS_MAXIMAL`, où les trois chiffres qui circulaient avant la mesure sont
# écrits avec ce qu'ils coûtaient.
#
# **Et une quatrième chose qui n'y est pas, mesurée deux fois puis écartée.** Le
# banc porte un arbitre d'octave par aller-retour — réduire au pas candidat,
# réagrandir, mesurer ce qui a changé — et il **abîme** le détecteur. Sur le
# corpus fabriqué : 16 cas sur 19 contre 19 sur 19 sans lui. Sur le lot de
# réception bâti à partir de vraies images (`essais/essai_grille_produit.py`) :
# **170 sur 204 contre 200, et 30 erreurs d'octave qui n'existent pas sans lui.**
#
# La raison est mécanique : sur une image floue à pas 13,1, la reconstruction au
# pas 13 est imparfaite tandis que celle au pas 2 est presque parfaite — des
# blocs de deux pixels sont uniformes dans n'importe quelle image lisse.
# L'arbitre choisit donc petit **pour la mauvaise raison**, et il ne rattrape
# rien : la règle du plus petit pas qualifié rend déjà zéro erreur d'octave sur
# les deux lots.


#: Le pas le plus grossier qu'on cherche, en pixels de l'image reçue.
#:
#: **Mesuré, pas décrété.** Le banc a passé les 149 images brutes du dépôt aux
#: quatre détecteurs le 3 septembre 2026 : le pas le plus grossier trouvé est de
#: **32 px**, et 99 % des pas tiennent sous 22. Trois chiffres circulaient avant
#: cette mesure, et aucun n'était bon :
#:
#: - **80 px**, la valeur que le plan visait. Elle n'a jamais été relevée — elle
#:   ressemble à 5 × 16 plus qu'à un chiffre mesuré, et la revue externe le
#:   disait déjà ;
#: - **24 px**, la borne des détecteurs de référence. Elle **coupe** le dépôt par
#:   le haut : le jeu « vignettes » monte à 32 ;
#: - **64 px**, la borne de `mesurer_grille`. Deux fois plus large que ce que le
#:   dépôt produit.
#:
#: ⚠️ **Une affirmation héritée n'est pas reproduite ici, et c'est écrit plutôt
#: que tu.** Le plan et le bilan disent tous deux *« relever la borne n'est pas
#: gratuit : le détecteur y perd de la finesse »*. Mesuré le 3 septembre 2026
#: (`essais/essai_grille_produit.py`), **cet effet n'apparaît pas** : à 64 la
#: réussite est exactement celle de 32, et sur les 149 images brutes du dépôt la
#: borne ne change **rien du tout** — 61 annonces, de 24 à 128. La raison est
#: mécanique : le pas retenu est le *plus petit* qualifié, donc élargir la
#: recherche ne lui donne pas d'occasion de se tromper.
#:
#: **Ce qui décide n'est donc pas ce qu'une grande borne coûterait, c'est ce
#: qu'une petite borne coupe** : à 24, douze cas du lot de réception passent de
#: « trouvé » à « renoncé ». 32 est la plus petite borne qui couvre le dépôt, et
#: c'est à ce titre qu'elle est ici — pas parce qu'aller plus haut ferait mal.
#: *(Un seul indice va dans le sens de l'affirmation héritée, et il est trop
#: mince pour la fonder : à 80, un cas sur 204 sort en franche erreur, le seul
#: du banc.)*
PAS_MAXIMAL = 32

#: Le pas le plus fin qu'on cherche. En dessous il n'y a plus de bloc : un pas
#: de un, c'est l'image elle-même, et toutes les images en portent un.
PAS_MINIMAL = 2

#: Sous cette valeur, le contraste ne tombe pas sur les multiples du pas trouvé
#: et il n'y a **pas de grille** — seulement une image lisse dont
#: l'autocorrélation décroît. Mesuré le 3 septembre 2026 sur les deux
#: illustrations de l'auteur : **0,12** pour la peinture du nain, **0,69** pour
#: le porteur de torche. Rien entre les deux ; le seuil est posé au milieu du
#: vide, comme `NETTETE_MINIMALE` avant lui.
PEIGNE_MINIMAL = 0.35

# ── Ce que la détection dit quand elle renonce ───────────────────────────────
#
# **Renoncer n'est pas une panne, c'est la bonne réponse.** Sur une peinture, il
# n'y a aucune grille à retrouver et en inventer une ne rend service à personne.
# Ce qui distingue cette version de `mesurer_grille` tient là : l'ancienne
# répondait « 2 » et y croyait, celle-ci se tait **et dit pourquoi**.
#
# Les trois phrases partent telles quelles à l'écran, donc elles s'adressent à
# l'auteur et non à un développeur : elles nomment ce qui a été vu, et elles
# disent ce qu'il reste à faire.

SANS_GRILLE = (
    "le modèle a peint une image lisse : il n'y a aucune grille à retrouver, "
    "c'est la taille demandée qui décide des carrés"
)
IMAGE_TROP_PETITE = (
    "l'image est trop petite pour qu'on y cherche une grille"
)
IMAGE_UNIE = "l'image est d'une seule teinte : il n'y a rien à mesurer"


@dataclass(frozen=True)
class GrilleRetrouvee:
    """Le pas sur lequel le modèle a peint — **ou la raison de renoncer**.

    `pas` vaut zéro quand la détection renonce, et `raison` dit alors pourquoi,
    en français et à l'auteur. Les deux ne se contredisent jamais : `trouvee`
    est la seule lecture à faire, et elle exige les deux à la fois.

    **Les deux nombres qui restent ne servent pas à décider, ils servent à
    comprendre.** `nettete` dit à quel point le profil se répète, `peigne` dit si
    ce qui se répète tombe bien sur les multiples du pas. Une netteté haute avec
    un peigne bas est le portrait exact d'une peinture, et c'est l'état que la
    version d'avant prenait pour une grille.

    `carres` est le côté de l'image **compté en cases de ce pas-là** : c'est la
    lecture dont l'auteur a besoin pour reposer la taille à la main, puisque
    c'est en carrés que la cible se règle et non en pixels de l'image reçue.

    ── `phase`, ajoutée en D4 — *où* la grille commence ──────────────────────

    **Le pas seul ne suffit pas à poser un trait dessus.** Une grille de modèle
    ne commence jamais au pixel zéro : le sujet est centré, la marge est ce
    qu'elle est, et un peigne calé au mauvais endroit mesure les creux en croyant
    mesurer les dents. La recherche de phase existait déjà — `_peigne` la fait à
    chaque appel depuis D2 — mais elle était jetée aussitôt trouvée.

    Deux nombres et non un, `(ligne, colonne)` : rien ne garantit que les deux
    directions commencent au même endroit, et supposer que si aurait décalé le
    trait d'un demi-bloc dans un cas sur deux. Ils valent zéro quand la détection
    renonce, ce qui est sans conséquence — on ne s'en sert pas.
    """

    pas: int = 0
    nettete: float = 0.0
    peigne: float = 0.0
    carres: int = 0
    phase: tuple[int, int] = (0, 0)
    raison: str | None = None

    @property
    def trouvee(self) -> bool:
        return self.pas >= PAS_MINIMAL and self.raison is None

    def en_json(self) -> dict[str, Any]:
        return {
            "pas": self.pas,
            "nettete": round(self.nettete, 3),
            "peigne": round(self.peigne, 3),
            "carres": self.carres,
            "phase": list(self.phase),
            "raison": self.raison,
        }


def _profils_des_canaux(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Le contraste entre voisins, **canal par canal et alpha compris**.

    Un profil par direction : pour les colonnes, la somme sur toute la hauteur
    des écarts entre une colonne et sa voisine. Sur une image posée sur une
    grille, ce profil est presque nul à l'intérieur d'un bloc et saute à chaque
    frontière — c'est cette dent de scie dont on cherche la période.

    **Les quatre canaux s'additionnent au lieu d'être fondus en un gris.** Voir
    la note qui ouvre cette section : le gris confond des couleurs qui sautent
    aux yeux, et il efface la silhouette, qui est le contraste le plus franc
    d'une image détourée.
    """
    canaux = rgba.astype(np.float64)
    return (
        np.abs(np.diff(canaux, axis=1)).sum(axis=(0, 2)),
        np.abs(np.diff(canaux, axis=0)).sum(axis=(1, 2)),
    )


def _peigne(profil: np.ndarray, pas: int) -> tuple[float, int]:
    """**Le contraste tombe-t-il sur les multiples du pas, ou n'importe où ?**

    On compare ce que le profil porte sur les **dents** du peigne — les
    positions multiples du pas — à ce qu'il porte entre elles, un demi-pas plus
    loin. Sur une vraie grille, presque tout est sur les dents et le rapport
    approche 1 ; sur une peinture, il y en a autant partout et le rapport tombe
    vers 0.

    La phase est cherchée, et elle n'est pas optionnelle : la grille d'un modèle
    ne commence jamais au pixel zéro, et un peigne calé au mauvais endroit
    mesurerait les creux en croyant mesurer les dents.

    **Elle est rendue depuis D4**, avec le rapport. Elle était trouvée puis
    jetée, et le contour en avait besoin : un trait posé sur la bonne maille mais
    au mauvais départ tombe à cheval sur deux blocs, ce qui est la moitié du
    défaut qu'on répare. *Le profil est celui des écarts entre voisins* : une
    dent à l'indice `i` est la frontière entre les rangs `i` et `i + 1`, donc la
    grille commence au rang `i + 1`.
    """
    meilleur, sa_phase = 0.0, 0
    for phase in range(pas):
        dents = profil[phase::pas]
        creux = profil[(phase + pas // 2) % pas :: pas]
        largeur = min(dents.size, creux.size)
        if largeur < 3:
            continue
        sur, entre = float(dents[:largeur].mean()), float(creux[:largeur].mean())
        if sur + entre > 0:
            rapport = (sur - entre) / (sur + entre)
            if rapport > meilleur:
                meilleur, sa_phase = rapport, (phase + 1) % pas
    return meilleur, sa_phase


def retrouver_grille(
    rgba: np.ndarray, maximum: int = PAS_MAXIMAL
) -> GrilleRetrouvee:
    """Sur quelle grille le modèle a-t-il peint cette image-là ?

    **Descriptive, et elle le reste.** La cible du produit est demandée, jamais
    déduite de l'image reçue (US-61) : ce que cette fonction rend est montré à
    l'auteur, jamais appliqué dans son dos. Ce qu'elle ajoute est qu'elle est
    désormais **assez juste pour être montrée**, et qu'elle sait se taire.

    Reçoit un **tableau**, et c'est délibéré : `mesurer_grille` prend des octets
    puis convertit en gris, donc elle ne saurait ni recevoir l'image que le
    produit a déjà en main ni voir l'alpha. Les deux lui manquaient.

    Trois épreuves, dans cet ordre, et chacune peut renoncer :

    1. **l'autocorrélation propose un pas** — le plus petit qui approche la
       crête, la règle qui évite de rapporter une harmonique au lieu de la
       fondamentale ;
    2. **la netteté dit si le profil se répète assez** pour qu'on parle de
       période (`NETTETE_MINIMALE`) ;
    3. **le peigne dit s'il s'agit d'une grille** et pas d'une image simplement
       lisse (`PEIGNE_MINIMAL`). C'est la seule des trois qui sépare une
       peinture d'un faux pixel art, et c'est celle qui manquait au produit.

    **En cas de doute, on vise fin**, et la règle du plus petit pas qualifié est
    exactement cela. Ce n'est pas une préférence : une grille un peu trop fine se
    rattrape presque parfaitement — chaque case du vrai pas reste d'une seule
    couleur —, alors qu'une grille trop grossière fond deux cases en une et
    détruit le sujet sans retour.
    """
    profils = _profils_des_canaux(rgba)
    borne = min(maximum, min(profil.size for profil in profils) // 4)
    if borne < PAS_MINIMAL:
        return GrilleRetrouvee(raison=IMAGE_TROP_PETITE)

    # La meilleure proposition des deux directions, et la crête la plus haute
    # qu'on ait vue — celle-là part même quand on renonce, parce qu'un chiffre
    # qui explique le refus vaut mieux qu'un refus nu.
    propose, sa_nettete, crete_vue = 0, 0.0, 0.0
    unie = True
    for profil in profils:
        centre = profil - profil.mean()
        variance = float((centre * centre).mean())
        if variance == 0:
            continue
        unie = False
        correlations = {
            pas: float((centre[:-pas] * centre[pas:]).mean() / variance)
            for pas in range(PAS_MINIMAL, borne + 1)
        }
        crete = max(correlations.values())
        crete_vue = max(crete_vue, crete)
        if crete < NETTETE_MINIMALE:
            continue
        for pas in sorted(correlations):
            voisines = (
                correlations.get(pas - 1, -1.0),
                correlations.get(pas + 1, -1.0),
            )
            if correlations[pas] >= 0.9 * crete and correlations[pas] >= max(voisines):
                if correlations[pas] > sa_nettete:
                    propose, sa_nettete = pas, correlations[pas]
                break

    if unie:
        return GrilleRetrouvee(raison=IMAGE_UNIE)
    if propose < PAS_MINIMAL:
        return GrilleRetrouvee(nettete=round(crete_vue, 3), raison=SANS_GRILLE)

    # **Le peigne a le dernier mot**, et il se lit sur les deux directions : une
    # grille est carrée, donc un pas qui ne se retrouve dans aucune des deux
    # n'en est pas une.
    #
    # **Les deux phases sortent d'ici depuis D4**, chacune de sa direction : le
    # premier profil est celui des colonnes, le second celui des lignes. C'est
    # `GrilleRetrouvee.phase` — voir sa docstring pour la raison d'en garder
    # deux.
    horizontal, phase_x = _peigne(profils[0], propose)
    vertical, phase_y = _peigne(profils[1], propose)
    peigne = max(horizontal, vertical)
    if peigne < PEIGNE_MINIMAL:
        return GrilleRetrouvee(
            nettete=round(sa_nettete, 3),
            peigne=round(peigne, 3),
            raison=SANS_GRILLE,
        )

    hauteur, largeur = rgba.shape[:2]
    return GrilleRetrouvee(
        pas=propose,
        nettete=round(sa_nettete, 3),
        peigne=round(peigne, 3),
        carres=max(1, round(max(hauteur, largeur) / propose)),
        phase=(phase_y, phase_x),
    )
