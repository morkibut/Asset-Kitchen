# -*- coding: utf-8 -*-
"""Le texte d'un clip — **un seul compositeur**, pour l'écran, les travaux et l'agent.

Arrivé en RV5 (22 septembre 2026). Ces trois fonctions vivaient dans la couche
API (`atelier/api/animation.py`), à côté de la route `/movements/for-pose` qui
montre le texte avant l'envoi. Le service des travaux ne pouvait pas s'en
servir : une fabrication suivie devait donc recevoir son texte **déjà écrit**
par l'écran, et `AnimerEnLot` en envoyait un sans direction ni style. Ici, la
route qui montre, `ServiceTravaux.preparer` qui conserve et l'agent qui demande
composent par le même chemin — c'est E14 (*le texte montré avant de payer est
demandé par le chemin même que l'envoi emprunte*) et T7 (*le MCP appelle les
services de l'écran*).

**L'ordre du texte, et il ne se discute pas ailleurs.** La phrase de la
direction en tête (18 septembre 2026), puis le geste : le texte du style du
personnage pour ce mouvement s'il en dit un (SC3), sinon celui du mouvement,
sinon la consigne figée de la pose. **Une correction porte sur le geste seul** :
la phrase de direction est remise en tête par le serveur, si bien qu'une même
correction vaut pour toutes les directions d'une série.

Rien ici n'appelle personne ni ne coûte : c'est du vocabulaire lu sur le
disque, et tout marche réseau coupé.
"""

from __future__ import annotations

from typing import Any

from atelier.domaine.direction import phrase_animee, texte_du_clip
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.style import texte_du_style


def phrase_de_direction(atelier: Any, projet: str | None, direction: str | None) -> str:
    """La phrase qui part en tête d'un clip pour cette direction du jeu, ou rien."""
    if not projet or not direction:
        return ""
    try:
        directions = atelier.production.directions_du_jeu(projet)
    except ErreurAtelier:
        return ""
    return phrase_animee(next((d for d in directions if d.identifiant == direction), None))


def style_du_personnage(
    atelier: Any, projet: str | None, personnage: str | None
) -> tuple[Any, str, dict[str, str] | None]:
    """Le style résolu d'un personnage pour ce jeu, **et d'où il vient** (SC3).

    Un seul endroit lit `ServiceStyles.style_du_personnage` pour composer un
    texte de clip : la route qui montre ce qui partira et celle qui commande
    un clip appellent celle-ci, jamais chacune la résolution de son côté —
    même raison que `phrase_de_direction` pour l'autre moitié du texte. Sans
    jeu ou sans personnage connu, la question ne se pose pas : rien n'est
    deviné, comme le veut `SC2`.

    Rend en plus la pièce **nommée**, pas seulement son identifiant : c'est ce
    que l'écran affiche à côté du style (« celui du bâton »), et il ne doit
    pas avoir à rappeler l'équipement pour traduire un identifiant en nom.
    """
    if not projet or not personnage:
        return None, "aucun", None
    style, origine, piece = atelier.styles.style_du_personnage(projet, personnage)
    if style is None:
        return None, "aucun", None
    piece_json: dict[str, str] | None = None
    if origine == "piece" and piece:
        objet = next(
            (p for p in atelier.equipement.pieces(projet) if p.identifiant == piece),
            None,
        )
        piece_json = {"identifiant": piece, "nom": objet.nom if objet else piece}
    return style, origine, piece_json


def geste_anime(
    atelier: Any,
    projet: str | None,
    personnage: str | None,
    mouvement: Any,
    repli: str = "",
) -> tuple[str, Any, str, dict[str, str] | None]:
    """Le texte du geste — **celui du style pour ce mouvement, sinon celui du
    mouvement** — et le style qui l'a éventuellement écrit (SC3).

    C'est ici, et nulle part ailleurs, que se décide *comment* ce
    personnage-là joue ce mouvement. **Le style ne remplace le texte du
    mouvement que s'il dit quelque chose pour ce mouvement précis** — sinon le
    mouvement garde la main, et c'est le deuxième critère de SC3.
    """
    base = mouvement.texte if mouvement and mouvement.texte else repli
    style, origine, piece = style_du_personnage(atelier, projet, personnage)
    if style is not None and mouvement is not None:
        texte_style = texte_du_style(style, mouvement.identifiant)
        if texte_style:
            return texte_style, style, origine, piece
    return base, style, origine, piece


def composer(
    atelier: Any,
    projet: str | None,
    personnage: str | None,
    direction: str | None,
    pose: str | None,
    mouvement: str | None = None,
    correction: str = "",
) -> dict[str, Any]:
    """Ce qui partira pour animer cette case, **et d'où le texte vient**.

    La forme rendue est celle de la route `/movements/for-pose` — elle la rend
    telle quelle :

    - `texte` : ce qui part, phrase de direction en tête ;
    - `direction` : cette phrase seule ; `geste` : le reste ;
    - `mouvement` : l'entrée de la bibliothèque, en JSON, ou `None` ;
    - `origine` : `mouvement` quand un mouvement connu écrit le geste, `pose`
      quand on retombe sur la consigne figée du plan, `aucun` sinon — y
      compris quand `mouvement` nomme une entrée inconnue ;
    - `style`, `origine_du_style`, `piece_du_style` : le style résolu du
      personnage (SC3), ou `None` / `"aucun"` / `None`.

    `mouvement` nomme un mouvement **autre** que celui de la pose ; vide, la
    case garde le sien. `correction`, non vide, **remplace le geste pour cet
    appel seulement** (E14) : la phrase de direction reste celle du jeu, remise
    en tête ici, et rien n'est écrit dans la bibliothèque — garder la
    correction est un second geste.
    """
    repli = ""
    if pose:
        for objet in atelier.production.plan(projet):
            if objet.identifiant == pose:
                repli = objet.dit()
                break
    if mouvement:
        objet_mouvement = atelier.mouvements.lire(mouvement, projet)
        origine = "mouvement" if objet_mouvement else "aucun"
    else:
        objet_mouvement = atelier.mouvements.pour_la_pose(pose, projet) if pose else None
        origine = "mouvement" if objet_mouvement else ("pose" if repli else "aucun")
    geste, style, origine_du_style, piece_du_style = geste_anime(
        atelier, projet, personnage, objet_mouvement, repli
    )
    if correction and correction.strip():
        geste = correction.strip()
    phrase = phrase_de_direction(atelier, projet, direction)
    return {
        "pose": pose,
        "mouvement": objet_mouvement.en_json() if objet_mouvement else None,
        "texte": texte_du_clip(phrase, geste),
        "direction": phrase,
        "geste": geste,
        "origine": origine,
        "style": style.en_json() if style else None,
        "origine_du_style": origine_du_style,
        "piece_du_style": piece_du_style,
    }
