# -*- coding: utf-8 -*-
"""La transparence native — **quand un appel demande au modèle un fond vide** (TN2).

**La règle tient en une fonction, et c'est celle-ci : `transparence_demandee`.**
Un appel demande la transparence quand trois choses sont vraies ensemble :

· **le modèle en a la capacité** — `Modele.transparence`, déclarée au catalogue
  comme les places de référence (TN1). Aucun `if qwen` ailleurs ;
· **le sujet a une silhouette** — `Echelle.silhouette` au barème de son type :
  personnage, créature, meuble, objet posé ou tenu, élément d'interface. Ce sont
  les sujets qu'on détoure déjà ; un décor, une tuile, une matière restent
  opaques ;
· **l'appel n'est pas une planche** — ni lot plié, ni planche à refaire. Le banc
  du 22 septembre 2026 a rendu la robe blanche d'un mage transparente sur une
  planche 2 × 2 ; les planches attendent huit propres sur huit (TN6).

**Et une quatrième, qui n'est pas un facteur mais une priorité** : un fond que
l'auteur a posé à la main pour cet appel, sur l'écran de confirmation, passe
devant. *Ce que l'auteur a joint ne cède jamais* — c'est aussi le geste
« refaire sur fond coloré » de TN4, disponible dès aujourd'hui.

**Qui la lit.** Le service de génération, et lui seul, la consulte — à la
soumission (`preparer`) comme à l'aperçu (`apercu`), par la même méthode
(`ServiceGenerations.transparence_de_l_appel`) : l'écran de confirmation ne peut
donc pas annoncer une consigne que l'envoi ne porterait pas. La réponse
s'enregistre sur la génération (`demande["transparence"]`, écrit seulement quand
il est vrai), et **c'est cet enregistrement que les tranches suivantes relisent**
(`demandee_par`) : TN3 pour endormir le détourage (« demandé *et* reçu »), la
relance pour reposer les références sur le même fond. Personne ne recalcule la
règle après coup — le barème ou le catalogue ont pu changer entre-temps, la
génération dit ce qui est *parti*.

**Ce que la transparence change à ce qui part**, et rien d'autre :

· le texte est encadré par la consigne officielle de Qwen (`encadrer`) — la
  phrase de tête et la phrase de queue, telles que le banc du 22 septembre les a
  envoyées (relues dans les métadonnées des PNG de
  `Comfy-Desktop/ComfyUI-Shared/output/banc-rgba/`) ;
· le fond de l'appel vaut `FOND_TRANSPARENT` au lieu d'une couleur : la phrase de
  calage ne pose plus « sur un fond plat de telle couleur », et l'interdiction de
  cette couleur ne part pas en négatif — il n'y a plus de couleur à interdire ;
· les images de référence se posent sur blanc (`FOND_DES_REFERENCES`), comme le
  fait déjà le nœud de Qwen pour sa partie « vision ».

La direction artistique du jeu, elle, reste dans le texte : le banc a vu le
style dériver vers la 3D sous la seule consigne de transparence.
"""

from __future__ import annotations

from typing import Any, Mapping

# **La consigne officielle, en deux moitiés, mot pour mot.** Qwen-Image 2.1 ne
# rend un canal alpha que si le texte le lui dit ainsi — en tête et en queue.
# Ne pas la reformuler : c'est la phrase qui a été mesurée.
TETE = "This is an RGBA format image with transparency."
QUEUE = "The image has an alpha channel and a transparent background."

# **Le fond d'un appel transparent.** Ni une couleur ni le vide : `AUCUN_FOND`
# veut dire « un fond plat sans couleur dite », ce qui est la phrase d'avant D3.
# Cette valeur ne s'écrit jamais sur le disque — elle ne vit que sur la copie de
# l'univers qu'on compose pour un appel (`ServiceProduction.couches`), et
# `fond_valide` la rend vide partout ailleurs, donc aucune phrase d'interdiction
# ni aucune pastille de couleur ne peut la prendre pour un `#rrggbb`.
FOND_TRANSPARENT = "transparent"

# Le blanc sur lequel une référence transparente se pose quand l'appel demande
# un fond vide. C'est ce que `LoadImage` et le nœud de vision de Qwen font de
# toute façon ; le dire ici garde un appel distant et un appel local d'accord.
FOND_DES_REFERENCES = "#FFFFFF"

# La clef de l'enregistrement, dans `generation.demande`.
CLEF = "transparence"


def transparence_demandee(
    *,
    capable: bool,
    silhouette: bool,
    planche: bool,
    fond_impose: bool = False,
) -> bool:
    """**La règle, à un seul endroit** : cet appel demande-t-il un fond vide ?

    `capable` — le modèle déclare la capacité (`Modele.transparence`) ;
    `silhouette` — le type du sujet a une silhouette au barème (un type non
    nommé est un personnage, comme pour la recette de naissance) ;
    `planche` — l'appel part plié ou refait une planche ;
    `fond_impose` — l'auteur a posé le fond de cet appel à la main.
    """
    return capable and silhouette and not planche and not fond_impose


def encadrer(texte: str) -> str:
    """Le texte, **entre les deux moitiés de la consigne officielle**.

    Ne l'ajoute pas deux fois : un texte repris à la main part de ce que l'écran
    de confirmation montrait, donc souvent déjà encadré — la même règle que le
    déclencheur d'un style local (`texte_local.composer`), qu'on ne redouble pas
    quand l'auteur l'a déjà écrit.
    """
    corps = texte.strip()
    if TETE not in corps:
        corps = f"{TETE}{_separateur(corps)}{corps}" if corps else TETE
    if QUEUE not in corps:
        if not corps.endswith((".", "!", "?")):
            corps = f"{corps}."
        corps = f"{corps}{_separateur(corps)}{QUEUE}"
    return corps


def _separateur(texte: str) -> str:
    """Un texte en paragraphes (GPT Image) garde ses paragraphes ; une phrase à
    virgules (un style local) reste une phrase."""
    return "\n\n" if "\n" in texte else " "


def desencadrer(texte: str, a_la_place: str = "") -> str:
    """Le texte **sans la consigne officielle** — l'inverse d'`encadrer` (TN4).

    Un appel qui ne demande pas de fond vide ne l'envoie jamais, même quand
    son texte en porte une : « Refaire sur fond coloré » reprend le texte
    parti la première fois, donc encadré. Sans ce retrait, le modèle
    recevrait à la fois une couleur de fond et la consigne de n'en rendre
    aucune. Un texte sans consigne revient tel quel, au caractère près.

    `a_la_place` : la phrase qui prend la place de la queue — le fond de cet
    appel, tel que la phrase de calage le dit (`vue.phrase_de_calage`). Le
    texte parti la première fois ne nommait aucun fond, puisqu'il n'y en avait
    pas ; sans elle, le modèle ne saurait pas sur quoi poser le sujet.
    """
    if TETE not in texte and QUEUE not in texte:
        return texte
    # Les séparateurs qu'`encadrer` avait posés autour — un paragraphe ou une
    # espace — tombent avec la consigne.
    corps = texte.replace(TETE, "").replace(QUEUE, "").strip()
    if not a_la_place:
        return corps
    phrase = a_la_place[:1].upper() + a_la_place[1:]
    if not phrase.endswith((".", "!", "?")):
        phrase = f"{phrase}."
    return f"{corps}{_separateur(corps)}{phrase}" if corps else phrase


def consigne() -> str:
    """Les deux moitiés, pour l'écran qui les montre à la place de la couleur."""
    return f"{TETE} … {QUEUE}"


def demandee_par(demande: Mapping[str, Any]) -> bool:
    """**Ce que la génération a demandé**, relu de son enregistrement.

    Absent veut dire non : toute génération d'avant TN2 se relit comme un appel
    qui n'a pas demandé de fond vide, et c'est exact.
    """
    return bool(demande.get(CLEF))
