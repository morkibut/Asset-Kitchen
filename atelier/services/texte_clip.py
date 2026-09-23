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
direction en tête (18 septembre 2026), puis le geste : le texte du style
pour ce mouvement s'il en dit un (SC3), sinon celui du mouvement,
sinon la consigne figée de la pose — le style étant celui **coché pour cet
envoi**, jamais un style posé d'office. **Une correction porte sur le geste seul** :
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


def styles_proposes(atelier: Any, projet: str | None, personnage: str | None) -> list[dict[str, Any]]:
    """Les styles du personnage, **proposés au moment d'animer et jamais cochés d'avance**.

    Chacun avec son origine — `choisi` sur la fiche, ou `piece` quand une pièce
    portée en calque le déclare, la pièce **nommée** pour que l'écran dise
    « celui du bâton » sans rappeler l'équipement. Sans jeu ou sans
    personnage connu, la liste est vide : rien n'est deviné.
    """
    if not projet or not personnage:
        return []
    noms = {p.identifiant: p.nom for p in atelier.equipement.pieces(projet)}
    return [
        {
            "style": style.en_json(),
            "origine": origine,
            "piece": {"identifiant": piece, "nom": noms.get(piece, piece)} if piece else None,
        }
        for style, origine, piece in atelier.styles.styles_du_personnage(projet, personnage)
    ]


def geste_anime(mouvement: Any, style: Any, repli: str = "") -> str:
    """Le texte du geste — **celui du style coché pour ce mouvement, sinon
    celui du mouvement**.

    C'est ici, et nulle part ailleurs, que se décide *comment* ce
    personnage-là joue ce mouvement. **Le style ne remplace le texte du
    mouvement que s'il dit quelque chose pour ce mouvement précis** : le
    fusil a son repos (l'arme tenue immobile) et son attaque (le tir) ; un
    mouvement qu'il ne dit pas garde son texte à lui.
    """
    base = mouvement.texte if mouvement and mouvement.texte else repli
    if style is not None and mouvement is not None:
        texte_style = texte_du_style(style, mouvement.identifiant)
        if texte_style:
            return texte_style
    return base


def composer(
    atelier: Any,
    projet: str | None,
    personnage: str | None,
    direction: str | None,
    pose: str | None,
    mouvement: str | None = None,
    correction: str = "",
    style: str | None = None,
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
    - `style` : le style **coché pour cet envoi**, ou `None` ;
    - `styles_proposes` : ceux du personnage, à cocher (`styles_proposes`).

    **`style` est coché à chaque envoi, jamais par défaut** (22 septembre
    2026). Avant, le style du personnage partait d'office : Mara au fusil
    gardait son fusil jusque dans un repos où l'auteur n'en voulait pas, sans
    rien pour le décocher. Le même envoi coché « fusil » écrit pour chaque
    case le texte du fusil *pour son mouvement* — tenu immobile au repos,
    épaulé pour tirer à l'attaque.

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
    coche = atelier.styles.style_pour_l_envoi(projet, style)
    geste = geste_anime(objet_mouvement, coche, repli)
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
        "style": coche.en_json() if coche else None,
        "styles_proposes": styles_proposes(atelier, projet, personnage),
    }
