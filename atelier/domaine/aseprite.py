# -*- coding: utf-8 -*-
"""Le descriptif d'une planche de sprites — **dans le format des autres, pas dans le nôtre**.

Arrivé en A4 (V3). Une planche de sprites qui sort de l'atelier est une image où
douze dessins sont posés côte à côte : sans un fichier qui dise la taille d'une
case, leur nombre et leur ordre, un moteur de jeu doit les **remesurer** — donc
deviner — et il se trompe dès qu'une case est vide sur un bord.

**Aucun format n'est inventé ici, et c'est la décision de la tranche.** Le
descriptif le plus lu par les moteurs est celui qu'écrit Aseprite, l'éditeur de
pixel art ; ses clés exactes ont été relevées avant que la tranche ne s'ouvre
(`revue-externe-2026-09-02/research/12-ui-hud-exports.md`, lignes 148, 152
et 159), et elles sont écrites **telles quelles**. Ce que ça ouvre, sans une
ligne de plus :

- Phaser lit ce fichier avec `load.aseprite` et fabrique l'animation tout seul,
  parce qu'il sait lire les *étiquettes* que le format porte ;
- l'extension Godot la plus installée pour ce genre d'image lit le même fichier ;
- les quatre champs `frame` / `rotated` / `trimmed` / `sourceSize` sont aussi
  ceux qu'écrit l'outil d'atlas le plus répandu, donc ce fichier se lit **aussi**
  comme un atlas ordinaire par tout ce qui n'a jamais entendu parler d'Aseprite.

**La forme en liste plutôt qu'en dictionnaire**, et pour une raison qui est un
critère de la tranche : *le descriptif dit leur ordre*. Les deux formes existent
dans ce format ; celle en dictionnaire range les images sous leur nom, et l'ordre
des clés d'un objet JSON n'est garanti par aucune norme. Une liste porte l'ordre
dans sa forme, et personne n'a à le rétablir.

**Ce que ce module ne dit pas.** D'où vient l'animation, quel clip a été payé,
quelle recette a été appliquée : rien de tout ça n'a de place dans un format qui
appartient à quelqu'un d'autre. Ces choses-là partent dans le descriptif de
l'atelier, à côté, dans l'archive — celui qui existe depuis T6 et que l'export
écrit déjà pour les images.

**Il n'ouvre aucun fichier et ne mesure rien** : on lui donne une bande et les
trois nombres de sa planche, il rend un dictionnaire. C'est ce qui permet de
l'éprouver sans disque, sans clip, et sans décodeur vidéo.
"""

from __future__ import annotations

from typing import Any

from atelier.domaine.bande import ALLER_RETOUR, Bande

# Ce que le format appelle le sens de lecture. **Trois mots, et ce sont les
# siens** : `forward`, `reverse`, `pingpong`. Nos deux sens en prennent deux ; le
# troisième n'a pas d'équivalent chez nous et n'est donc jamais écrit.
AVANT = "forward"
VA_ET_VIENT = "pingpong"

# Le format des pixels, tel que ce descriptif le nomme. Nos planches sortent
# toutes en quatre canaux de huit bits — c'est ce qu'écrit `en_png`, et l'alpha
# n'est pas négociable pour un sprite.
PIXELS = "RGBA8888"

# Ce que l'atelier déclare de lui-même dans le descriptif d'un autre. **Son
# propre nom, jamais celui d'Aseprite** : écrire l'adresse de l'éditeur, comme
# le fait le vrai fichier, ferait passer nos planches pour les siennes. Aucun
# lecteur ne se sert de ce champ pour décider quoi que ce soit ; il sert à
# répondre à « d'où sort ce fichier ? » six mois plus tard.
ATELIER = "Asset Kitchen"

# Le rang de ce que nous écrivons ici, dans le champ que le format réserve à la
# version de l'application qui l'a produit. **Il ne bouge pas quand une clé
# facultative s'ajoute** : un lecteur qui verrait ce nombre changer croirait que
# les clés qu'il connaît ont bougé, alors qu'elles sont figées par le format
# lui-même et n'ont pas à bouger.
VERSION = "1"


def duree_en_ms(cadence: float) -> int:
    """Le temps d'une image, en millièmes de seconde — **et le seul endroit qui l'arrondit**.

    Ce format compte en millièmes de seconde entiers. Une cadence de huit images
    par seconde tombe juste, à cent vingt-cinq ; une cadence de douze non, et
    l'arrondi doit alors se faire **une fois** — sans quoi le descriptif dirait
    quatre-vingt-trois et l'image animée jouerait à quatre-vingt-quatre.

    C'est le quatrième critère de la tranche, *la cadence est écrite dans le
    descriptif et l'image animée la respecte* : les deux prennent ce nombre-ci,
    et il n'y en a pas d'autre.
    """
    if cadence <= 0:  # pragma: no cover — refusé à l'écriture d'une bande
        return 0
    return max(1, round(1000.0 / cadence))


def ordre_des_images(compte: int, sens: str) -> list[int]:
    """Les cases jouées, **dans l'ordre où elles se jouent**.

    En boucle, c'est la planche telle quelle. En aller-retour, on redescend
    **sans rejouer les deux bouts** : sur quatre images cela donne 0, 1, 2, 3,
    2, 1 — six images et non huit. Rejouer les bouts marquerait un temps d'arrêt
    à chaque extrémité, ce qui se voit à l'œil sur un balancement.

    ⚠️ **C'est la règle de l'écran, recopiée d'une seule autre**, celle qui fait
    tourner les vignettes de la matrice (`interface/src/composants/Apercu.tsx`).
    Elle est ici parce que l'image animée qui sort de l'atelier doit jouer ce que
    l'auteur a regardé — et deux formulations de « où en est-on du va-et-vient »
    finiraient par ne plus répondre pareil.
    """
    if compte <= 1:
        return [0] * max(compte, 0)
    if sens != ALLER_RETOUR:
        return list(range(compte))
    return list(range(compte)) + list(range(compte - 2, 0, -1))


def descriptif(
    bande: Bande, *, image: str, case_largeur: int, case_hauteur: int, compte: int
) -> dict[str, Any]:
    """Le fichier d'accompagnement de cette planche.

    Les trois nombres viennent de la planche qui vient d'être écrite, jamais de
    la fiche de la bande : c'est l'invariant du dépôt — *ce qui est là fait foi*
    — et c'est exactement l'endroit où les deux peuvent différer, puisque la
    planche se recalcule quand son cache a sauté.

    `image` est le nom du fichier tel qu'il est posé **à côté** de ce
    descriptif-ci, dans la même archive : un moteur ouvre le JSON et trouve le
    PNG sans qu'on lui dise où chercher.
    """
    duree = duree_en_ms(bande.cadence)
    nom = bande.nom or bande.identifiant
    return {
        "frames": [
            {
                "filename": f"{nom} {rang}.png",
                "frame": {
                    "x": rang * case_largeur,
                    "y": 0,
                    "w": case_largeur,
                    "h": case_hauteur,
                },
                # **Faux tous les deux, et écrits quand même.** Une planche de
                # l'atelier ne tourne aucune case et n'en rogne aucune : elles
                # sortent toutes de la même fenêtre, à la même taille. Les
                # omettre ferait deviner au lecteur, et ce format est justement
                # là pour qu'il n'ait rien à deviner.
                "rotated": False,
                "trimmed": False,
                # Où le dessin se trouve dans sa case, et quelle taille aurait
                # la case s'il n'y avait rien à rogner. Sans rognage, les deux
                # disent la case entière — et c'est la bonne réponse, pas un
                # remplissage : le sujet occupe déjà toute sa case.
                "spriteSourceSize": {
                    "x": 0,
                    "y": 0,
                    "w": case_largeur,
                    "h": case_hauteur,
                },
                "sourceSize": {"w": case_largeur, "h": case_hauteur},
                "duration": duree,
            }
            for rang in range(compte)
        ],
        "meta": {
            "app": ATELIER,
            "version": VERSION,
            "image": image,
            "format": PIXELS,
            "size": {"w": case_largeur * compte, "h": case_hauteur},
            # Une chaîne, et c'est le format qui le veut ainsi. `"1"` veut dire
            # que la planche est à sa taille d'origine — l'atelier ne rend jamais
            # une planche agrandie, la mise à la taille du jeu s'est faite avant.
            "scale": "1",
            # **L'étiquette, et c'est elle qui fait tout le travail.** Un moteur
            # qui lit ce champ fabrique l'animation nommée, sur ces images-là,
            # dans ce sens-là, sans une ligne de code. C'est la raison pour
            # laquelle ce format-ci a été choisi plutôt qu'un atlas ordinaire.
            #
            # Pas de `repeat` : dans ce format, son absence veut dire *sans fin*,
            # et une bande tourne sans fin. Écrire un nombre de tours ici
            # inventerait une décision que l'auteur n'a pas prise.
            "frameTags": [
                {
                    "name": nom,
                    "from": 0,
                    "to": max(compte - 1, 0),
                    "direction": (
                        VA_ET_VIENT if bande.sens == ALLER_RETOUR else AVANT
                    ),
                }
            ],
        },
    }
