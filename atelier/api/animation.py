# -*- coding: utf-8 -*-
"""Les routes de l'animation — une façade, et rien d'autre.

Arrivées en A9 (V3), rejointes en A6 par celles du **mouvement**. Elles sont
dans leur propre fichier pour la raison qui sépare déjà la production, la
bibliothèque et l'univers : un fichier de routes par question qu'on pose à
l'atelier. Ici la question est *animer* — le vocabulaire du mouvement et la
commande d'un clip en sont les deux moitiés, et les séparer aurait fait deux
fichiers pour une seule question.

**Ce qu'aucune de ces routes ne fait.** Aucune ne rappelle le fournisseur toute
seule. Commander part d'un geste ; récupérer part d'un geste. Le seul appel qui
se fait sans qu'on le demande est l'attente d'un clip qu'on vient de commander,
et elle ne coûte rien — le clip est déjà payé au moment où elle commence. **Les
routes du mouvement, elles, n'appellent personne du tout** : c'est du
vocabulaire, il s'écrit sur le disque, et tout y marche réseau coupé.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from atelier.domaine.animation import (
    PROPORTIONS_DEFAUT,
    RESOLUTION_DEFAUT,
    SECONDES_DEFAUT,
    DemandeClip,
)
from atelier.domaine.bande import BOUCLE
from atelier.domaine.bande import CADENCE_PAR_DEFAUT as CADENCE_DE_BANDE
from atelier.domaine.bande import Cadre, Prise
from atelier.domaine.calque_anime import TIENT
from atelier.domaine.erreurs import ErreurAtelier, GenerationInconnue
from atelier.domaine.recette import Recette
from atelier.api.routes import reponse_archive
from atelier.image import vignette
from atelier.services import Atelier

# **Un seul endroit qui met un modèle vidéo en JSON**, et c'est le service.
#
# ⚠️ Il y en avait deux, l'un ici et l'autre là-bas, et ils avaient déjà divergé :
# les champs ajoutés par `A11` — la carte de la maison, la durée conseillée, le
# nombre d'images réel — n'existaient que du côté du service, si bien que le flux
# les envoyait et que l'écran des modèles ne les recevait pas. Un modèle qui se
# décrit de deux façons selon la porte par laquelle on le demande est une panne
# qui ne se voit qu'à l'usage.
from atelier.services.animation import _modele_en_json
from atelier.services.texte_clip import composer, styles_proposes

routeur = APIRouter()


def _atelier(requete: Request) -> Atelier:
    return requete.app.state.atelier


# ── Les mouvements (A6) ──────────────────────────────────────────────────────
#
# **Avant les clips, comme dans le plan.** On ne commande pas un clip sans
# nommer ce qu'on demande : c'est ce que la tranche livre, et l'ordre des
# routes le dit. Aucune ne coûte, aucune n'appelle, toutes marchent réseau
# coupé.


class CorpsMouvement(BaseModel):
    """Ce qu'il faut pour fabriquer ou régler un mouvement.

    **Les deux textes sont la définition.** Le nom se lit, le texte part au
    modèle ; un mouvement sans l'un des deux n'est pas un mouvement. `cadence`
    et `directions` sont facultatifs et prennent le défaut du domaine — un
    chiffre écrit ici serait un second défaut à tenir d'accord.
    """

    nom: str | None = None
    texte: str | None = None
    cadence: float | None = None
    directions: list[str] | None = None


@routeur.get("/movements")
async def liste_mouvements(
    requete: Request, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Les mouvements d'un jeu — ou, sans jeu nommé, la bibliothèque de départ
    de l'atelier (18 septembre 2026 : chaque jeu a désormais les siens).

    Elle rend aussi les masqués, dans une seconde liste : c'est ce qui rend le
    masquage réversible, et un geste irréversible sur du vocabulaire livré n'a
    aucune raison d'être.
    """
    return _atelier(requete).mouvements.en_json(projet)


# **Le compositeur du texte a quitté cette couche** (RV5) : il vit dans
# `atelier/services/texte_clip.py`, pour que les fabrications suivies et l'agent
# composent par le même chemin que la route qui montre le texte (E14, T7).
# `commander_clip` garde ses deux appels jusqu'à son retrait en RV6.


@routeur.get("/movements/for-pose/{identifiant_pose}")
async def mouvement_de_la_pose(
    requete: Request,
    identifiant_pose: str,
    projet: str | None = Query(None),
    direction: str | None = Query(None),
    personnage: str | None = Query(None),
    mouvement: str | None = Query(None),
    style: str | None = Query(None),
) -> dict[str, Any]:
    """Ce qui partira pour animer cette case du plan, **et d'où le texte vient**.

    La règle est ici et **nulle part ailleurs** : l'écran ne rejoue jamais la
    correspondance de son côté. Deux endroits qui apparient une pose et un
    mouvement finiraient par ne plus s'accorder, et l'auteur découvrirait
    l'écart sur une case, un jour, sans savoir lequel des deux ment.

    `origine` dit ce que l'écran doit écrire à côté du texte : `mouvement`
    quand la case est animée par un mouvement connu, `pose` quand on retombe sur
    la consigne figée du plan — moins bonne, mais en anglais et juste sur
    l'attitude —, `aucun` quand le produit ne sait rien dire de cette case-là.

    **`style`, depuis le 22 septembre 2026** : le style de combat *coché pour
    cet envoi* — `geste` devient son texte pour ce mouvement s'il en dit un.
    Rien n'est coché d'office ; `styles_proposes` liste ceux du `personnage`
    (choisis sur sa fiche, ou déclarés par une pièce portée) pour que l'écran
    les propose.

    **`mouvement`, depuis SC3** : composer pour un mouvement *autre* que celui
    de la pose — l'écran laisse choisir dans une liste, et cette case garde
    son mouvement propre par défaut tant qu'on n'a rien choisi.

    **Composé par le service depuis RV5** (`services/texte_clip.composer`) :
    c'est le même appel que fait `ServiceTravaux.preparer` pour écrire le
    texte d'une fabrication suivie — ce que l'écran montre est ce qui part.
    """
    atelier = _atelier(requete)
    ouvert = projet or atelier.bibliotheque.courant
    return composer(atelier, ouvert, personnage, direction, identifiant_pose, mouvement, style=style)


@routeur.post("/movements", status_code=201)
async def fabriquer_mouvement(
    requete: Request, corps: CorpsMouvement, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Écrire un nom crée le mouvement, sur-le-champ, sans formulaire et sans
    rien payer — l'invariant de `C1`, généralisé en `E2`."""
    atelier = _atelier(requete)
    atelier.mouvements.fabriquer(
        corps.nom or "",
        corps.texte or "",
        corps.cadence,
        tuple(corps.directions or ()),
        projet,
    )
    return atelier.mouvements.en_json(projet)


@routeur.put("/movements/{identifiant}")
async def regler_mouvement(
    requete: Request,
    identifiant: str,
    corps: CorpsMouvement,
    projet: str | None = Query(None),
) -> dict[str, Any]:
    """Renommer, retoucher le texte, changer la cadence ou les directions.

    **Ce que ce mouvement a déjà fait partir ne bouge pas** : le texte est parti
    dans l'appel au moment du clic. Jamais de cascade, ici comme ailleurs.
    """
    atelier = _atelier(requete)
    atelier.mouvements.regler(
        identifiant,
        nom=corps.nom,
        texte=corps.texte,
        cadence=corps.cadence,
        directions=tuple(corps.directions) if corps.directions is not None else None,
        projet=projet,
    )
    return atelier.mouvements.en_json(projet)


@routeur.delete("/movements/{identifiant}")
async def masquer_mouvement(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Retirer un mouvement de la liste — **un livré laisse une pierre**.

    Le catalogue des livrés se relit à chaque lecture : effacer un livré le
    ferait revenir à la ligne suivante. Un fabriqué, lui, s'en va pour de bon.
    """
    atelier = _atelier(requete)
    atelier.mouvements.masquer(identifiant, projet)
    return atelier.mouvements.en_json(projet)


@routeur.post("/movements/{identifiant}/show")
async def montrer_mouvement(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Rendre à la liste un livré masqué."""
    atelier = _atelier(requete)
    atelier.mouvements.montrer(identifiant, projet)
    return atelier.mouvements.en_json(projet)


# ── Les styles de combat (SC1) ───────────────────────────────────────────────
#
# **Juste après les mouvements, comme dans le plan.** Le mouvement dit
# *quel cycle* — une attaque, un repos — le style dit *comment ce
# personnage-là le joue* : à mains nues, au bâton, à l'arc. Même contrat
# que les routes du mouvement : aucune ne coûte, aucune n'appelle, toutes
# marchent réseau coupé.


class CorpsStyle(BaseModel):
    """Ce qu'il faut pour fabriquer ou régler un style.

    **`textes` se fusionne dans l'existant sur un réglage**, il ne le
    remplace pas — c'est `ServiceStyles.regler` qui porte cette règle. Sur
    une fabrication, il faut être là avec au moins un texte : un style qui
    ne dit rien pour aucun mouvement n'est pas un style.
    """

    nom: str | None = None
    tient: str | None = None
    textes: dict[str, str] | None = None


@routeur.get("/styles")
async def liste_styles(
    requete: Request, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Les styles d'un jeu — ou, sans jeu nommé, la bibliothèque de départ
    de l'atelier. Elle rend aussi les masqués, dans une seconde liste."""
    return _atelier(requete).styles.en_json(projet)


@routeur.post("/styles", status_code=201)
async def fabriquer_style(
    requete: Request, corps: CorpsStyle, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Écrire un nom avec au moins un texte crée le style, sur-le-champ,
    sans rien payer."""
    atelier = _atelier(requete)
    atelier.styles.fabriquer(
        corps.nom or "", corps.tient or "", corps.textes, projet
    )
    return atelier.styles.en_json(projet)


@routeur.put("/styles/{identifiant}")
async def regler_style(
    requete: Request,
    identifiant: str,
    corps: CorpsStyle,
    projet: str | None = Query(None),
) -> dict[str, Any]:
    """Renommer, changer ce qu'il tient, ou corriger le texte d'un mouvement."""
    atelier = _atelier(requete)
    atelier.styles.regler(
        identifiant,
        nom=corps.nom,
        tient=corps.tient,
        textes=corps.textes,
        projet=projet,
    )
    return atelier.styles.en_json(projet)


@routeur.delete("/styles/{identifiant}")
async def masquer_style(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Retirer un style de la liste — **un livré laisse une pierre**."""
    atelier = _atelier(requete)
    atelier.styles.masquer(identifiant, projet)
    return atelier.styles.en_json(projet)


@routeur.post("/styles/{identifiant}/show")
async def montrer_style(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Rendre à la liste un livré masqué."""
    atelier = _atelier(requete)
    atelier.styles.montrer(identifiant, projet)
    return atelier.styles.en_json(projet)


# ── Le style d'un personnage, et celui d'une pièce (SC2) ─────────────────────
#
# **`combat-style` et pas `style`** : `GET /characters/{id}/style` existe déjà
# et dit tout autre chose — les sept textes qui *habillent* une chose (son
# style visuel). Deux mots identiques pour deux sens aurait fait lire l'un
# pour l'autre. Les pièces vivent sous `/characters/pieces/…` comme toutes les
# routes du vestiaire. Sans `projet`, c'est le jeu ouvert — même règle que
# `/movements/for-pose`.


class CorpsChoixStyle(BaseModel):
    """`style` : l'identifiant d'un style du jeu, ou `null` pour retirer le choix."""

    style: str | None = None


class CorpsStylesDuPersonnage(BaseModel):
    """`styles` : la liste des styles du personnage — vide, elle les retire tous.

    `style`, seul, est la forme d'avant le 22 septembre 2026 : il pose une
    liste d'un seul style, ou la vide avec `null`."""

    styles: list[str] | None = None
    style: str | None = None


def _resolution_en_json(atelier: Atelier, projet: str, personnage: str) -> dict[str, Any]:
    """Les styles d'un personnage, **chaque pièce nommée** (SC4).

    L'identifiant seul ne suffit pas à l'écran, qui doit dire « celui du
    Bâton de chêne » sans rappeler l'équipement pour traduire un identifiant
    en nom — c'est `texte_clip.styles_proposes` qui les nomme, la même liste
    que l'écran d'une animation propose à cocher.
    """
    return {"personnage": personnage, "styles": styles_proposes(atelier, projet, personnage)}


@routeur.get("/styles/for-character/{personnage}")
async def style_du_personnage(
    requete: Request, personnage: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Les styles de ce personnage **et d'où chacun vient** — `choisi` ou `piece`.

    **Ce sont des propositions** : aucun ne part dans un clip sans être coché
    au moment d'animer. Le personnage est cherché d'abord, pour qu'un
    identifiant inconnu rende un 404 plutôt qu'une liste vide trompeuse.
    """
    atelier = _atelier(requete)
    ouvert = projet or atelier.bibliotheque.courant
    atelier.production.personnage(ouvert, personnage)
    return _resolution_en_json(atelier, ouvert, personnage)


@routeur.put("/characters/{personnage}/combat-style")
async def choisir_style_du_personnage(
    requete: Request,
    personnage: str,
    corps: CorpsStylesDuPersonnage,
    projet: str | None = Query(None),
) -> dict[str, Any]:
    """Poser la liste des styles d'un personnage. Rend la liste neuve, pièces
    comprises : retirer un style peut laisser paraître celui d'une pièce."""
    atelier = _atelier(requete)
    ouvert = projet or atelier.bibliotheque.courant
    atelier.production.personnage(ouvert, personnage)
    voulus = corps.styles if corps.styles is not None else ([corps.style] if corps.style else [])
    atelier.styles.choisir_pour_le_personnage(ouvert, personnage, voulus)
    return _resolution_en_json(atelier, ouvert, personnage)


@routeur.get("/styles/for-piece/{piece}")
async def style_de_la_piece(
    requete: Request, piece: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Le style que cette pièce déclare — **son propre choix, sans résolution**.

    Une pièce n'hérite de rien, à la différence d'un personnage : elle
    déclare un style ou n'en déclare aucun. Cette lecture manquait à côté de
    son écriture (`PUT .../combat-style`) — l'écran des Réglages d'une pièce
    (`SC4`) en a besoin pour montrer la valeur actuelle sans la deviner. Un
    style masqué depuis compte pour absent, comme dans
    `ServiceStyles.styles_du_personnage`.
    """
    atelier = _atelier(requete)
    ouvert = projet or atelier.bibliotheque.courant
    choix = atelier.styles.choix_en_json(ouvert)
    visibles = {s.identifiant: s for s in atelier.styles.tous(ouvert)}
    style = visibles.get(choix["pieces"].get(piece, ""))
    return {"piece": piece, "style": style.en_json() if style else None}


@routeur.put("/characters/pieces/{piece}/combat-style")
async def choisir_style_de_la_piece(
    requete: Request,
    piece: str,
    corps: CorpsChoixStyle,
    projet: str | None = Query(None),
) -> dict[str, Any]:
    """Poser ou retirer le style qu'une pièce déclare — **hérité par qui la
    porte en calque**, sauf s'il a choisi le sien."""
    atelier = _atelier(requete)
    ouvert = projet or atelier.bibliotheque.courant
    style = atelier.styles.choisir_pour_la_piece(ouvert, piece, corps.style)
    return {"piece": piece, "style": style.en_json() if style else None}


def _demande_de_jauge(
    secondes: float, resolution: str, proportions: str, image_de_fin: bool = False
) -> DemandeClip:
    """La demande qui sert à **jauger** un modèle, sans image et sans texte.

    L'image de départ n'y est pas, et ce n'est pas un oubli : ce qui se jauge
    ici est ce que le modèle sait faire — sa durée, sa résolution, son prix —,
    pas ce que l'auteur a joint. Le refus *« demande une image de départ »* est
    donc écarté volontairement, en lui donnant un octet : l'écran ne va pas
    griser les onze modèles vidéo parce que rien n'est encore sélectionné.

    **L'image de fin, elle, se jauge** (PX5) : quand l'auteur a demandé qu'un
    clip finisse sur une image, un modèle qui ne sait pas le faire est grisé
    avec sa raison avant d'être choisi.
    """
    return DemandeClip(
        texte="",
        image=b"\0",
        secondes=secondes,
        resolution=resolution,
        proportions=proportions,
        image_de_fin=b"\0" if image_de_fin else None,
    )


@routeur.get("/clips/models")
async def modeles_video(
    requete: Request,
    secondes: float = Query(SECONDES_DEFAUT, ge=1, le=60),
    resolution: str = Query(RESOLUTION_DEFAUT),
    proportions: str = Query(PROPORTIONS_DEFAUT),
    image_de_fin: bool = Query(False),
) -> dict[str, Any]:
    """Les modèles vidéo, leur prix du jour **avec sa formule**, et leur grisé.

    Le prix dépend de ce qu'on demande — une seconde de plus, une résolution de
    plus, et il change. Il se calcule donc pour le réglage courant, transmis en
    paramètres, et non une fois pour toutes au démarrage. `image_de_fin` (PX5) :
    le clip demandé finit sur une image choisie.
    """
    atelier = _atelier(requete)
    demande = _demande_de_jauge(secondes, resolution, proportions, image_de_fin)
    modeles = await atelier.animation.a_jour()
    etat = atelier.animation.etat()
    lignes = []
    for modele in modeles:
        prix = atelier.animation.annonce(modele, demande)
        lignes.append(
            {
                **_modele_en_json(modele),
                # **Une estimation, et le mot y est.** Ce qui s'enregistrera
                # après l'appel est le montant facturé, et l'écran doit pouvoir
                # écrire « environ » avant et le chiffre exact après.
                "prix": prix.en_json(),
                "grise": atelier.animation.grise(modele, demande),
                # **Ce que ça coûte en temps, quand c'est du temps que ça
                # coûte** (A11). `null` chez un payant : ce qu'il coûte est de
                # l'argent, et une attente inventée serait pire qu'aucune.
                "attente": _attente_en_json(
                    atelier.animation.attente(modele, demande)
                ),
            }
        )
    # **L'ordre dans lequel la liste se lit (V3.01.2), et il se décide ici.**
    # Le moteur de la maison d'abord — celui qui ne coûte rien passe avant
    # ceux qui coûtent —, puis les payants **par prix croissant pour la
    # demande courante** : le prix change avec la durée, le format et la
    # résolution, et le tri suit, au même endroit où le prix se calcule.
    # L'écran n'a pas de règle de tri à lui : deux endroits qui trient
    # finiraient par ne plus trier pareil. Un modèle dont le prix n'a pas pu
    # être relu — montant `None` — reste en fin de liste, et c'est lui que le
    # filtre de l'écran retirera ou intercalera avec sa raison.
    lignes.sort(
        key=lambda ligne: (
            # Faux passe après vrai : la maison d'abord (zéro), les payants
            # ensuite (un).
            0 if ligne["de_la_maison"] else 1,
            1 if ligne["prix"]["montant"] is None else 0,
            ligne["prix"]["montant"] or 0.0,
        )
    )
    return {
        "modeles": lignes,
        "recu_le": etat["recu_le"],
        "raison": etat["raison"],
        "manque": etat["manque"],
        # L'état de chaque animateur, séparément — une clé absente chez l'un ne
        # dit rien de l'autre (A11).
        "moteurs": etat["moteurs"],
        "decodeur": etat["decodeur"],
        "demande": {
            "secondes": demande.secondes,
            "resolution": resolution,
            "proportions": proportions,
        },
    }


def _attente_en_json(attente: Any) -> dict[str, Any] | None:
    return attente.en_json() if attente is not None else None


@routeur.post("/clips/models/refresh")
async def rafraichir_modeles_video(requete: Request) -> dict[str, Any]:
    await _atelier(requete).animation.rafraichir()
    return _atelier(requete).animation.etat()


# ── Le moteur de la maison (A11) ─────────────────────────────────────────────
#
# **Deux routes, et la seconde est la seule du produit qui télécharge.** Elle est
# ici et pas dans les réglages parce que ce qu'elle rapatrie ne sert qu'à animer :
# la mettre ailleurs obligerait à sortir de l'écran qui pose la question.


@routeur.get("/clips/engine")
async def etat_du_moteur(requete: Request) -> dict[str, Any]:
    """Ce que la carte de la maison peut faire aujourd'hui, **en trois absences**.

    Le relevé se refait à chaque appel, et c'est délibéré : l'auteur qui vient
    d'ouvrir ComfyUI doit voir le grisé tomber sans redémarrer son atelier. Rien
    ici ne coûte — ni argent, ni calcul : on demande à une application locale ce
    qu'elle a sur son disque.
    """
    moteur = _moteur(requete)
    return (await moteur.visiter()).en_json()


@routeur.post("/clips/engine/download")
async def telecharger_les_modeles(requete: Request) -> dict[str, Any]:
    """Rapatrie les fichiers qui manquent. **Un geste que l'auteur demande.**

    Il n'y a pas de version automatique : vingt-six gigaoctets ne se descendent
    pas dans le dos de quelqu'un, et la liste avec les tailles et les licences
    est affichée avant. ⚠️ Un téléchargement coupé se reprend au même appel — un
    fichier tronqué ressemble à un fichier absent, et c'est ce qui a coûté deux
    téléchargements le 3 septembre 2026.
    """
    moteur = _moteur(requete)
    descendus = await moteur.telecharger()
    return {"descendus": descendus, **(await moteur.visiter()).en_json()}


def _moteur(requete: Request) -> Any:
    """Le moteur de la maison parmi les animateurs, ou un refus qui le dit.

    On le retrouve par son nom plutôt que par sa place : l'ordre de la liste est
    une décision d'affichage, et une route qui en dépendrait casserait le jour où
    l'on changerait cet ordre.
    """
    from atelier.fournisseur.maison import NOM as NOM_MAISON

    for fabrique in _atelier(requete).animation.fabriques():
        porte = fabrique()
        if getattr(porte, "nom", "") == NOM_MAISON:
            return porte
    raise HTTPException(
        status_code=404,
        detail={"raison": "cet atelier n'a pas de moteur de la maison"},
    )


class CorpsGarder(BaseModel):
    """Celui qu'on garde, et ceux qu'on écarte. **Un seul geste.**"""

    garde: str
    jette: list[str] = []


class CorpsClips(BaseModel):
    """Des clips par leurs identifiants — ce que l'annulation reprend."""

    clips: list[str]


@routeur.post("/clips/keep")
async def garder_un_clip(requete: Request, corps: CorpsGarder) -> dict[str, Any]:
    """Garde celui-là, écarte les autres. **Annulable, et rien n'expire.**

    Ce qui a été payé reste au journal : un clip écarté quitte la galerie, pas
    les dépenses.
    """
    return _atelier(requete).animation.garder(corps.garde, corps.jette)


@routeur.post("/clips/restore")
async def rendre_des_clips(requete: Request, corps: CorpsClips) -> dict[str, Any]:
    """Remontrer ce qu'on avait écarté. L'annulation du geste d'au-dessus."""
    rendus = _atelier(requete).animation.rendre(corps.clips)
    return {"clips": [g.en_json() for g in rendus]}


@routeur.post("/clips/{identifiant}/erase")
async def effacer_un_clip(requete: Request, identifiant: str) -> dict[str, Any]:
    """Supprimer un clip pour de bon. Refusé s'il porte une animation."""
    return _atelier(requete).animation.effacer(identifiant).en_json()


@routeur.post("/clips/import", status_code=201)
async def importer_un_clip(
    requete: Request,
    nom: str = "",
    projet: str | None = None,
    personnage: str | None = None,
    pose: str | None = None,
    direction: str | None = None,
    forcer: bool = False,
) -> dict[str, Any]:
    """Faire entrer une vidéo **depuis l'écran**, et elle devient un clip.

    **Les octets sont le corps de la requête, bruts** — la décision de
    `POST /assets/upload` reconduite telle quelle, et pour sa raison : un
    `multipart` demanderait `python-multipart`, une dépendance d'exécution de
    plus pour transporter ce qu'un `POST` transporte déjà.

    **Une vidéo par appel**, comme une image par appel : deux fichiers déposés
    font deux réponses, donc un clip et un refus qui nomme le fichier, plutôt
    qu'une réponse partielle qu'il faudrait inventer.

    Rend `{"clip": …, "doublon": …}`, dont l'un est toujours nul — la forme de
    l'import d'image, et pour la même raison : un doublon n'est pas un refus, et
    rappeler avec `forcer` fait entrer quand même.

    ⚠️ **Le jeu ouvert est le défaut, et l'omettre était un trou.** Mesuré sur
    l'atelier de l'auteur le 13 septembre 2026 : l'écran n'envoie pas de
    `projet`, le clip naissait donc à `projet = None`, et toutes les listes
    scopent sur un jeu — `GET /clips?projet=…` la première. La vidéo entrait,
    n'apparaissait nulle part, et le contrôle de doublon, lui, la retrouvait :
    *« … était déjà là »* à chaque nouvelle tentative, sur une vidéo
    introuvable. Le défaut est ici et non dans le service, comme dans
    `production.py` : un agent nomme toujours son projet, et le service doit
    pouvoir refuser un projet manquant plutôt que d'en inventer un.
    """
    atelier = _atelier(requete)
    return atelier.animation.importer(
        await requete.body(),
        nom,
        projet=projet or atelier.bibliotheque.courant or None,
        personnage=personnage,
        pose=pose,
        direction=direction,
        forcer=forcer,
    )


class CorpsFeuille(BaseModel):
    """Ce qu'il faut pour qu'une image devienne une animation (`AU19`, `RP21`).

    **La feuille est une image de la bibliothèque, la carte une image de la
    toile — l'une des deux, jamais les deux** (`RP21`). Les rectangles sont
    ceux de l'atelier de découpe — `[x0, y0, x1, y1]` en pixels de l'image
    brute, inclusifs aux deux bouts, la forme du dépôt. Une seconde convention
    de rectangle se confondrait un jour avec la première sur un pixel de bord.
    """

    feuille: str | None = None
    # **`RP21`** : la seconde porte d'entrée, une carte du tableau
    # d'inspiration — `projet` omis reprend le jeu ouvert, la même règle que
    # partout ailleurs sur cette famille de routes (`_projet`, `api/univers.py`).
    carte: str | None = None
    projet: str | None = None
    boites: list[list[int]]
    nom: str = ""
    personnage: str | None = None
    pose: str | None = None
    direction: str | None = None
    # **Une bande par direction nommée, dans l'ordre des lignes.** C'est la
    # forme courante d'une feuille de ce jeu : quatre lignes, une par direction.
    # Vide, la feuille entière fait une seule animation.
    directions: list[str] | None = None
    cadence: float = CADENCE_DE_BANDE
    sens: str = BOUCLE


# ⚠️ **« sheet » sans « from- » devant, et ce n'est pas un caprice** : le banc
# des jetons lit `from-<mot>` comme un utilitaire de dégradé Tailwind, et une
# route nommée `/clips/from-sheet` faisait donc échouer le garde-fou des
# couleurs sur un jeton `sheet` qui n'existe pas. Le banc a raison de ne pas
# savoir lire une URL ; c'est à l'URL de ne pas ressembler à une classe.
@routeur.post("/clips/sheet", status_code=201)
async def animer_une_feuille(requete: Request, corps: CorpsFeuille) -> dict[str, Any]:
    """Une image découpée devient un clip et ses bandes. **Rien n'est dépensé.**

    L'image a été payée une fois, à son entrée ; la découper en cases ne
    rappelle personne. Rend `{"clip": …, "bandes": [ … ]}` — le clip pour la
    galerie et la fiche, les bandes pour la matrice du personnage.

    **Depuis une planche de la bibliothèque, ou une carte de la toile**
    (`RP21`) : `feuille` désigne l'une, `carte` l'autre, jamais les deux — le
    service le refuse sinon.
    """
    return _atelier(requete).planche_animee.animer(
        corps.feuille,
        [tuple(int(c) for c in boite) for boite in corps.boites],
        carte=corps.carte,
        projet=corps.projet,
        nom=corps.nom,
        personnage=corps.personnage,
        pose=corps.pose,
        direction=corps.direction,
        directions=corps.directions,
        cadence=corps.cadence,
        sens=corps.sens,
    )


class CorpsAssemblage(BaseModel):
    """Ce qu'il faut pour qu'une sélection d'images fixes devienne une
    animation (`RP21`, chemin 2).

    **`images` porte l'ordre de la sélection**, celui que la galerie montrait
    quand l'auteur a cliqué — c'est cet ordre-là qui devient celui des frames,
    jamais un tri refait ici. Le sujet, la pose et la direction sont
    facultatifs : absents, le service les préremplit quand toutes les images
    s'accordent sur l'un d'eux ; une chaîne vide dit « aucun ».
    """

    images: list[str]
    nom: str = ""
    personnage: str | None = None
    pose: str | None = None
    direction: str | None = None
    cadence: float = CADENCE_DE_BANDE
    sens: str = BOUCLE


@routeur.post("/clips/assemble", status_code=201)
async def assembler_une_selection(requete: Request, corps: CorpsAssemblage) -> dict[str, Any]:
    """Une sélection d'images fixes devient un clip et sa bande (`RP21`).

    **Rien n'est dépensé, et aucun encodage vidéo** : les images choisies
    entrent telles quelles, dans l'ordre de la sélection — le même geste
    qu'`animer_une_feuille` un cran plus loin, sur des images qui n'ont jamais
    partagé une planche.
    """
    return _atelier(requete).planche_animee.assembler(
        corps.images,
        nom=corps.nom,
        personnage=corps.personnage,
        pose=corps.pose,
        direction=corps.direction,
        cadence=corps.cadence,
        sens=corps.sens,
    )


@routeur.get("/clips")
async def liste_clips(
    requete: Request,
    limite: int = Query(100, ge=1, le=500),
    projet: str | None = Query(None),
) -> dict[str, Any]:
    """Les clips, du plus récent au plus ancien. **Ce sont des générations.**

    ⚠️ **`projet` scope la recherche à un seul jeu** (B22). Omis, la fenêtre des
    `limite` générations les plus récentes est celle de *tous* les jeux
    confondus — les clips d'un jeu peu actif se font chasser par les images
    d'un autre, exactement ce qui rend un clip invisible après la fermeture de
    son lot. Posé, la fenêtre porte sur les générations du jeu lui-même :
    `Base.generations_du_projet`, la requête déjà servie au journal des
    dépenses (`ServiceBibliotheque.journal`).
    """
    atelier = _atelier(requete)
    generations = (
        atelier.base.generations_du_projet(projet, limite)
        if projet is not None
        else atelier.generations.recentes(limite)
    )
    return {"clips": [g.en_json() for g in generations if g.clip is not None]}


@routeur.get("/clips/pending")
async def clips_en_souffrance(requete: Request) -> dict[str, Any]:
    """Ceux qui sont payés — ou peut-être payés — et attendent un geste.

    **La liste ne récupère rien.** Elle dit ce qu'il y a à récupérer ; c'est
    l'auteur qui décide, un par un.
    """
    atelier = _atelier(requete)
    return {"clips": [g.en_json() for g in atelier.animation.en_souffrance()]}


@routeur.post("/clips/{identifiant}/recover")
async def recuperer_clip(requete: Request, identifiant: str) -> dict[str, Any]:
    """Rapatrie un clip déjà payé. **Ne commande rien, ne repaie rien** (US-438)."""
    generation = await _atelier(requete).animation.recuperer(identifiant)
    return generation.en_json()


@routeur.get("/clips/{identifiant}/video")
async def video_du_clip(requete: Request, identifiant: str) -> Response:
    """Le fichier tel qu'il est arrivé. Le brut, jamais un rendu.

    > ### ⚠️ Elle existait, et aucun écran ne s'en servait
    >
    > L'écran de montage montre la pellicule, la loupe et deux boucles tirées des
    > **images extraites** ; la vidéo payée restait sur le disque, joignable par
    > cette route-ci, et invisible par tout chemin que l'auteur pouvait prendre.
    > Signalé par lui le 5 septembre 2026 : *« je n'ai jamais la possibilité de
    > voir la vidéo générée entière »*.
    >
    > Ce n'est pas la même chose que les images : celles-ci sont figées et
    > l'écran les rejoue à *sa* cadence, alors que la vidéo porte le rythme du
    > modèle, ses fondus, ce qu'il fait entre deux images.

    **Elle répond aux demandes de plage**, et sans ça la barre de lecture ne
    marcherait pas : un navigateur qui ne peut pas demander « les octets 400 000
    à 500 000 » ne sait pas se déplacer dans une vidéo — il la rejoue depuis le
    début, ou refuse de la lire. Le lecteur envoie d'ailleurs sa toute première
    demande en plage, avant même de connaître la taille du fichier.
    """
    generation = _clip(requete, identifiant)
    resultat = generation.emplacements[0].resultat
    if resultat is None:
        raise ErreurAtelier("ce clip n'est pas encore arrivé")
    fichiers = _atelier(requete).fichiers
    if not fichiers.existe(resultat.fichier):
        raise ErreurAtelier("le fichier vidéo de ce clip a disparu du disque")

    # Un clip ne change jamais : une fois payé et écrit, ses octets sont
    # définitifs. Le navigateur peut le garder longtemps.
    entetes = {"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=86400"}
    taille = fichiers.taille(resultat.fichier)
    debut, fin = _plage_demandee(requete.headers.get("range", ""), taille)
    if debut is None:
        return Response(
            content=fichiers.lire(resultat.fichier),
            media_type=resultat.type_media,
            headers=entetes,
        )
    if debut > fin:
        # **Un refus qui dit la taille, pas une tranche vide** : c'est ainsi que
        # le lecteur apprend jusqu'où il peut demander.
        return Response(
            status_code=416,
            headers={**entetes, "Content-Range": f"bytes */{taille}"},
        )
    return Response(
        content=fichiers.tranche(resultat.fichier, debut, fin),
        status_code=206,
        media_type=resultat.type_media,
        headers={**entetes, "Content-Range": f"bytes {debut}-{fin}/{taille}"},
    )


def _plage_demandee(entete: str, taille: int) -> tuple[int | None, int]:
    """L'en-tête `Range` traduit en deux bornes **inclusives**, ou rien.

    Rien veut dire *sers le fichier entier*, et c'est la réponse pour tout ce qui
    n'est pas une plage d'octets lisible : une plage illisible n'est pas une
    erreur à renvoyer à la figure, c'est une demande à laquelle le fichier entier
    répond. Une seule forme est refusée plus loin — celle qui commence après la
    fin —, parce qu'elle ne peut être satisfaite par rien.
    """
    if not entete.startswith("bytes="):
        return None, 0
    morceaux = entete[6:].split("-", 1)
    if len(morceaux) != 2:
        return None, 0
    try:
        if not morceaux[0]:
            # `bytes=-500` : les cinq cents **derniers** octets.
            derniers = int(morceaux[1])
            return max(0, taille - derniers), taille - 1
        debut = int(morceaux[0])
        fin = int(morceaux[1]) if morceaux[1] else taille - 1
    except ValueError:
        return None, 0
    return debut, min(fin, taille - 1)


def _frame_du_clip(dossier: Path, numero: int) -> Path:
    """Le fichier d'une image du clip, **quel que soit son nombre de chiffres**.

    ⚠️ Le dépôt a écrit ces images de deux façons. Le décodeur les numérote sur
    quatre chiffres (`atelier/image/clip.py`) ; l'import d'un rendu asset3d les
    écrivait sur six (`services/sources_3d.py`), et ces routes-ci ne lisaient que
    les premières — une séquence 3D importée n'a donc jamais pu servir ni une
    frame ni sa couverture, alors que son montage, lui, marchait : il parcourt le
    dossier au lieu de nommer le fichier.

    L'import écrit désormais sur quatre chiffres comme tout le reste. Les six
    restent lus : ce qui est déjà sur le disque n'a pas à être réécrit pour
    redevenir visible.
    """
    for chiffres in (4, 6):
        fichier = dossier / f"{numero:0{chiffres}d}.png"
        if fichier.is_file():
            return fichier
    return dossier / f"{numero:04d}.png"


@routeur.get("/clips/{identifiant}/frames/{numero}")
async def image_du_clip(requete: Request, identifiant: str, numero: int) -> Response:
    """Une image prélevée dans le clip, par son numéro.

    C'est ce que la galerie sert pour montrer un clip, et ce que l'éditeur de
    montage servira cent fois de suite en faisant glisser sa fenêtre. Les images
    sont sur le disque depuis l'arrivée du clip : rien n'est décodé ici.
    """
    generation = _clip(requete, identifiant)
    atelier = _atelier(requete)
    dossier: Path = atelier.fichiers.dossier_images_clip(identifiant, 0)
    fichier = _frame_du_clip(dossier, numero)
    if not fichier.is_file():
        refus = generation.clip.extraction_refus
        raise ErreurAtelier(
            refus or f"ce clip ne porte pas d'image numéro {numero}"
        )
    return Response(
        content=fichier.read_bytes(),
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=86400"},
    )


@routeur.get("/clips/{identifiant}/cover")
async def couverture_du_clip(
    requete: Request, identifiant: str, cote: int = Query(256, ge=16, le=1024)
) -> Response:
    """La première image du clip, réduite pour une case de grille (B22).

    **La galerie n'affiche jamais le fichier entier** — `vignette_asset` tient
    déjà cette règle pour une image, et un clip n'y faisait pas exception :
    sans cette route, cent clips demandaient chacun leur première frame à sa
    résolution native pour n'en montrer qu'un timbre-poste. La frame est déjà
    sur le disque depuis l'arrivée du clip ; réduire ne redécode rien, et ne
    rappelle personne.
    """
    generation = _clip(requete, identifiant)
    atelier = _atelier(requete)
    dossier: Path = atelier.fichiers.dossier_images_clip(identifiant, 0)
    fichier = _frame_du_clip(dossier, 0)
    if not fichier.is_file():
        refus = generation.clip.extraction_refus
        raise ErreurAtelier(refus or "ce clip ne porte aucune image")
    return Response(
        content=vignette(fichier.read_bytes(), cote),
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=86400"},
    )


@routeur.post("/clips/{identifiant}/frames/{numero}/pick", status_code=201)
async def prelever_une_image(
    requete: Request, identifiant: str, numero: int, forcer: bool = Query(False)
) -> dict[str, Any]:
    """Une image du clip **entre en bibliothèque** (A13). Rien n'est dépensé.

    **C'est la route qui compose, pas un service** — comme le tableau de bord
    d'un personnage, et pour une raison de même nature. Le montage sait ce qu'on
    prélève : quelle image, à quelle taille son espèce vit dans ce jeu, et de
    quel clip payé elle sort. Les générations savent faire entrer une image ; ce
    sont elles, et elles seules, qui en font naître une. Donner l'un à l'autre
    aurait fait rentrer le catalogue et le fournisseur dans un service qui n'en
    a aucun — **et c'est cette privation qui autorise la phrase du pied de
    l'écran de montage**.

    Elle rend la **même forme qu'un import** — `{asset, doublon}`, l'un des deux
    toujours nul —, parce que c'est le même geste vu d'un cran plus loin : une
    image déjà prélevée n'est pas un refus, elle est signalée, et rappeler avec
    `forcer` la fait entrer quand même.

    ⚠️ **Aucune case n'est visée ici**, et c'est un critère de la tranche : on
    prélève « pour voir », et l'affecter à une pose ou à un objet est un second
    geste facultatif, qui passe par le même chemin que pour n'importe quelle
    image. Poser la question au moment du prélèvement alourdirait le geste court
    au moment précis où il doit rester court.
    """
    atelier = _atelier(requete)
    pris = atelier.montage.prelevement(identifiant, numero)
    return atelier.generations.importer(
        pris["octets"],
        pris["nom"],
        projet=pris["projet"],
        # **Elle passe par la chaîne du jeu**, contrairement à un fichier déposé
        # à la main : une image tirée d'un clip du jeu est une image *de ce
        # jeu-là*, et la rendre « telle quelle » obligerait à la retraiter à la
        # main juste après. Le traitement reste non destructif — l'image brute
        # est gardée, et la recette se reprend après coup.
        traiter=True,
        echelle=pris["echelle"],
        filiation=pris["filiation"],
        forcer=forcer,
    )


# ── Le montage (A10) ─────────────────────────────────────────────────────────
#
# **Le cœur de la version, et aucune de ces routes ne dépense.** Le clip est
# payé, ses images sont sur le disque depuis son arrivée, et découper est un
# geste qu'on refait autant de fois qu'on veut. C'est ce que le pied de l'écran
# annonce, et c'est vrai jusque dans les imports du service : ni catalogue, ni
# fournisseur, ni animateur.
#
# Elles vivent dans ce fichier-ci parce que la question est la même — *ce qui
# bouge*. Un clip qu'on commande et un clip qu'on découpe sont deux moments d'un
# seul geste, et les séparer aurait fait deux fichiers pour une question.


class CorpsApercuBande(BaseModel):
    """Ce qu'il faut pour monter une bande : les images, la recette, le cadre.

    **La recette voyage entière**, et non par différences avec celle du jeu. Une
    différence obligerait les deux bouts à s'accorder sur ce qu'est « le jeu » au
    moment du calcul, et le projet change pendant qu'un écran de montage est
    ouvert — c'est très exactement le genre d'accord qui se défait en silence.
    """

    clip: str
    images: list[int] = []
    recette: dict[str, Any] | None = None
    cadre: dict[str, Any] | None = None
    # **La forme riche d'une image retenue** (A7) : d'où elle vient, de combien
    # elle est poussée. Absente, l'écran ne parle que de numéros — c'est le cas
    # du montage, qui taille dans un seul clip et ne corrige rien.
    prises: list[dict[str, Any]] | None = None


class CorpsBande(CorpsApercuBande):
    """Ce qu'on garde en plus de ce qu'on montre : le nom, la cadence, le sens,
    et la case visée — facultative, parce qu'une bande sans case est un
    brouillon et qu'un brouillon ne bloque rien."""

    nom: str = ""
    cadence: float = 0.0
    sens: str = ""
    # **Le repère posé à la main dans le montage** (RP15). Absent ou `None` :
    # l'auteur n'y a pas touché, la livraison garde son propre calcul.
    pivot: dict[str, Any] | None = None
    pose: str | None = None
    direction: str | None = None
    personnage: str | None = None


class CorpsCorrection(BaseModel):
    """Ce qu'on corrige sur une bande gardée (A7) — **et rien n'est obligatoire**.

    Un champ absent veut dire *« ne touche pas à ça »*. C'est ce qui permet à
    l'écran de pousser une image d'un pixel sans renvoyer la recette entière, et
    c'est aussi ce qui rend l'annulation exacte : on renvoie l'état d'avant du
    seul champ qu'on avait changé.
    """

    prises: list[dict[str, Any]] | None = None
    # **Le chutier — la réserve de la bande** (V3.03.3). Absent veut dire *« ne
    # touche pas à ça »*, comme partout ici ; une liste vide veut dire *« il est
    # vide »*, et c'est un état normal — on vient de tout reposer dans le ruban.
    chutier: list[dict[str, Any]] | None = None
    recette: dict[str, Any] | None = None
    cadence: float | None = None
    sens: str | None = None
    cadre: dict[str, Any] | None = None


def _prises(donnees: list[dict[str, Any]] | None) -> list[Prise] | None:
    """Les prises d'un corps de requête, **ou rien du tout**.

    `None` et une liste vide ne veulent pas dire la même chose : le premier est
    « je ne parle pas des images », le second serait « une bande sans image » —
    que le service refuse, et c'est lui qui doit le dire, pas ce traducteur.

    ⚠️ **Le chutier passe par ici aussi, et sa liste vide est légitime**
    (V3.03.3) : une réserve qu'on vient de vider en reposant tout dans le ruban
    n'est pas une bande sans image. Le partage tient parce que ce traducteur ne
    juge de rien — il traduit ; c'est `corriger` qui sait lequel des deux il
    tient, et il ne refuse que le ruban.
    """
    if donnees is None:
        return None
    return [Prise.depuis_json(d) for d in donnees]


@routeur.post("/strips/{identifiant}/frames/{rang}/pick", status_code=201)
async def prelever_une_frame_traitee(
    requete: Request, identifiant: str, rang: int, corps: CorpsCorrection,
) -> dict[str, Any]:
    """Le rendu courant devient une image à découper, sans toucher à la bande."""
    atelier = _atelier(requete)
    pris = atelier.montage.prelevement_de_frame(
        identifiant, rang, prises=_prises(corps.prises),
        recette=Recette.depuis_json(corps.recette) if corps.recette is not None else None,
    )
    return atelier.generations.importer(
        pris["octets"], pris["nom"], projet=pris["projet"],
        traiter=False, filiation=pris["filiation"], forcer=True,
    )


class CorpsCase(BaseModel):
    """La case qu'une bande remplit — ou plus aucune, les deux vides."""

    pose: str | None = None
    direction: str | None = None
    personnage: str | None = None


class CorpsNom(BaseModel):
    nom: str = ""


@routeur.post("/montage/preview")
async def apercu_de_la_bande(
    requete: Request, corps: CorpsApercuBande
) -> dict[str, Any]:
    """La bande montée, **sans rien écrire** : la planche repart en `data:`.

    **Déclarée avant `/montage/{identifiant}`**, pour la raison de
    `board/groups/tint` : un chemin fixe posé après un chemin à trou se fait
    manger par lui, et le refus qui en sort parle d'un identifiant que personne
    n'a écrit.
    """
    atelier = _atelier(requete)
    return atelier.montage.apercu(
        corps.clip,
        corps.images,
        _recette(corps.recette),
        Cadre.depuis_json(corps.cadre),
        prises=_prises(corps.prises),
    )


@routeur.get("/montage/{identifiant}")
async def ouvrir_le_montage(requete: Request, identifiant: str) -> dict[str, Any]:
    """Tout ce que l'écran demande, en un seul aller-retour.

    Un écran qui s'ouvre en tournant déjà en boucle n'a pas le temps de poser
    quatre questions.
    """
    return _atelier(requete).montage.ouvrir(identifiant)


@routeur.get("/montage/{identifiant}/contact")
async def contact_du_clip(requete: Request, identifiant: str) -> Response:
    """Toutes les images du clip en une seule, en grille.

    L'écran en tire sa pellicule — une tranche au centre de chaque case — et sa
    loupe — la case entière. Un clip ne change jamais : le navigateur peut la
    garder longtemps.
    """
    return Response(
        content=_atelier(requete).montage.contact(identifiant),
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=86400"},
    )


@routeur.post("/montage/{identifiant}/frame")
async def reprendre_le_cadre(
    requete: Request, identifiant: str, corps: CorpsApercuBande | None = None
) -> dict[str, Any]:
    """La fenêtre commune, remesurée sur **toutes** les images du clip.

    **Un geste que l'auteur demande**, et il coûte une vingtaine de secondes :
    le faire dans son dos ferait attendre sans dire pourquoi.
    """
    return _atelier(requete).montage.reprendre_le_cadre(
        identifiant, _recette(corps.recette if corps else None)
    )


@routeur.get("/strips")
async def liste_bandes(
    requete: Request, clip: str = Query(...)
) -> dict[str, Any]:
    """Les bandes déjà taillées dans ce clip, **dans l'ordre où on les a gardées**."""
    bandes = _atelier(requete).montage.bandes(clip)
    return {"bandes": [b.en_json() for b in bandes]}


@routeur.post("/strips")
async def garder_une_bande(requete: Request, corps: CorpsBande) -> dict[str, Any]:
    """Une bande de plus, taillée dans ce clip. **Rien n'est dépensé.**"""
    atelier = _atelier(requete)
    bande = atelier.montage.garder(
        corps.clip,
        corps.nom,
        corps.images,
        cadence=corps.cadence or CADENCE_DE_BANDE,
        sens=corps.sens or BOUCLE,
        cadre=Cadre.depuis_json(corps.cadre),
        pivot=corps.pivot,
        recette=_recette(corps.recette),
        pose=corps.pose,
        direction=corps.direction,
        personnage=(corps.personnage or "") if "personnage" in corps.model_fields_set else None,
    )
    return bande.en_json()


class CorpsBandes(BaseModel):
    """Les animations qu'on fait sortir. **Rien d'autre à dire** : ce qui part
    d'une bande est fixé par la tranche — la planche, son descriptif et l'image
    animée —, et le laisser choisir ici en ferait trois réglages à tenir."""

    identifiants: list[str] = []


@routeur.post("/strips/export")
async def exporter_des_bandes(requete: Request, corps: CorpsBandes) -> Response:
    """Une sélection d'animations sort en une archive (A4).

    `POST` et non `GET`, pour la raison déjà écrite de l'archive des images :
    une sélection ne tient pas dans une adresse, et l'archive n'est pas une
    ressource qu'on pourrait aller rechercher — elle est fabriquée pour ce
    lot-là, à cet instant-là.

    **Déclarée avant celles qui prennent un identifiant**, parce que c'est
    l'ordre qui rend la question sans objet : rien n'aura jamais à décider si
    `export` est le nom d'une bande.

    **Aucun réseau, aucun centime.** Le clip est payé depuis longtemps ; ce qui
    sort d'ici est du disque et du processeur.
    """
    return reponse_archive(
        _atelier(requete).export.exporter_bandes(corps.identifiants)
    )


# ── Juger, écarter (B11) ─────────────────────────────────────────────────────
#
# Le report des trois gestes de la bibliothèque (`PUT /assets/favorite`,
# `POST /assets/delete`, `POST /assets/restore`) sur une bande. **Déclarées ici,
# avant celles qui prennent un identifiant** — même raison que `/strips/export`
# juste au-dessus : `favorite`, `delete` et `restore` ne doivent jamais pouvoir
# se faire lire comme le nom d'une bande par un chemin à trou déclaré avant eux.


class CorpsSelectionDeBandes(BaseModel):
    """Une sélection de bandes — même règle que `CorpsSelection` des assets :
    une seule bande est une sélection d'une, et chaque geste de jugement
    s'écrit une fois pour un nombre quelconque."""

    identifiants: list[str] = Field(min_length=1)


class CorpsFavoriDeBande(CorpsSelectionDeBandes):
    favori: bool = True


@routeur.put("/strips/favorite")
async def marquer_favorite_une_bande(
    requete: Request, corps: CorpsFavoriDeBande
) -> dict[str, Any]:
    """La seule marque que l'auteur pose lui-même sur une bande — le pendant
    exact de `PUT /assets/favorite`."""
    marquees = _atelier(requete).montage.marquer_favori(
        corps.identifiants, corps.favori
    )
    return {"bandes": [b.en_json() for b in marquees]}


@routeur.post("/strips/delete")
async def ecarter_des_bandes(
    requete: Request, corps: CorpsSelectionDeBandes
) -> dict[str, Any]:
    """Sort du rangement tout de suite, s'efface après le délai — le pendant
    exact de `POST /assets/delete`.

    **Jamais de cascade** : le clip et ses images restent, comme `oublier` le
    fait déjà. La réponse porte l'échéance — c'est elle que le bandeau
    d'annulation décompte.
    """
    return _atelier(requete).montage.ecarter(corps.identifiants)


@routeur.post("/strips/restore")
async def restaurer_des_bandes(
    requete: Request, corps: CorpsSelectionDeBandes
) -> dict[str, Any]:
    """L'annulation courte. Refusée au-delà du délai, en le disant — le pendant
    exact de `POST /assets/restore`."""
    rendues = _atelier(requete).montage.restaurer(corps.identifiants)
    return {"bandes": [b.en_json() for b in rendues]}


# ── Les calques d'animation (B20) ────────────────────────────────────────────
#
# **Toutes sous `/strips/{id}/layer`**, et le segment littéral vient après le
# trou de l'identifiant sans risque : `layer` n'est pas en concurrence avec le
# nom d'une bande, il est *derrière* lui. Le piège des routes à segments ne se
# pose que quand deux chemins se disputent la **même** position.
#
# **Aucune ne dépense**, et c'est vérifiable plutôt qu'affirmé : le service
# qu'elles appellent ne tient ni catalogue, ni fournisseur, ni animateur.


class CorpsHabillage(BaseModel):
    """La pièce à poser, et comment son calque suit."""

    piece: str
    tenue: str = TIENT


class CorpsTenue(BaseModel):
    """La façon de suivre, seule — changer d'avis refait les nombres."""

    tenue: str


class CorpsCalage(BaseModel):
    """Le calage posé à la main, et s'il sert à la pièce suivante.

    `garder` est vrai par défaut : c'est le critère de la tranche, et le défaut
    doit être celui qui rend le geste utile. Le refuser reste possible — un
    calage bon pour une seule pièce ne doit pas s'imposer à la suivante.
    """

    echelle: float = 1.0
    dx: int = 0
    dy: int = 0
    seuil: int | None = None
    garder: bool = True


@routeur.post("/strips/{identifiant}/layer", status_code=201)
async def habiller_une_bande(
    requete: Request, identifiant: str, corps: CorpsHabillage
) -> dict[str, Any]:
    """Poser le calque d'une pièce sur chaque image de cette animation.

    **Rien n'est généré, rien n'est payé** : le calque existe, les images
    existent, et ce qui se calcule ici est une suite de nombres.
    """
    return _atelier(requete).calques_animes.habiller(
        identifiant, corps.piece, corps.tenue
    )


@routeur.put("/strips/{identifiant}/layer")
async def regler_le_calque_anime(
    requete: Request, identifiant: str, corps: CorpsTenue
) -> dict[str, Any]:
    """Le calque tient, ou il glisse — **et les nombres se refont**.

    Une bascule qui ne changerait pas les calages ne changerait rien à l'écran,
    ce qui ne se distingue pas d'une bascule cassée.
    """
    return _atelier(requete).calques_animes.regler(identifiant, corps.tenue)


@routeur.post("/strips/{identifiant}/layer/align")
async def caler_un_calque_anime(
    requete: Request, identifiant: str, corps: CorpsCalage
) -> dict[str, Any]:
    """Le calage posé à la main — **et gardé pour la pièce suivante**.

    Les mêmes nombres sont posés sur la bande nue, celle du corps : la prochaine
    pièce habillée sur cette animation partira d'eux au lieu de zéro.
    """
    return _atelier(requete).calques_animes.caler_a_la_main(
        identifiant,
        corps.echelle,
        corps.dx,
        corps.dy,
        seuil=corps.seuil,
        garder=corps.garder,
    )


# `DELETE /strips/{identifiant}/layer/align` — défaire le calage à la main — est
# retirée le 16 septembre 2026 (`RP18`). Un calage à la main ne se pose depuis
# aucun écran : `POST .../layer/align` n'a de client que le bandeau d'appels de
# l'interface, qu'aucun composant n'emploie. Une annulation qu'aucun geste ne
# peut atteindre n'annule rien. Elle reviendra avec l'écran qui posera le calage.


@routeur.get("/strips/{identifiant}/layer/preview")
async def apercu_dun_calque_anime(
    requete: Request, identifiant: str
) -> dict[str, Any]:
    """Les images habillées, **sans rien écrire sur le disque**.

    Empruntée par *Ses animations, image par image* depuis `RP18` : l'écran
    montrait un compte d'images et pas une seule image.
    """
    return _atelier(requete).calques_animes.apercu(identifiant)


@routeur.delete("/strips/{identifiant}/layer")
async def deshabiller_une_bande(
    requete: Request, identifiant: str
) -> dict[str, Any]:
    """L'habillage s'en va ; le corps et le calque restent."""
    return _atelier(requete).calques_animes.deshabiller(identifiant)


@routeur.put("/strips/{identifiant}/case")
async def affecter_une_bande(
    requete: Request, identifiant: str, corps: CorpsCase
) -> dict[str, Any]:
    """La case du plan de poses que cette bande remplit — ou plus aucune.

    Les deux champs vides la retirent de sa case : elle redevient un brouillon,
    elle ne disparaît pas.
    """
    bande = _atelier(requete).montage.affecter(
        identifiant, corps.pose, corps.direction,
        personnage=(corps.personnage or "") if "personnage" in corps.model_fields_set else None,
    )
    return bande.en_json()


@routeur.put("/strips/{identifiant}/name")
async def renommer_une_bande(
    requete: Request, identifiant: str, corps: CorpsNom
) -> dict[str, Any]:
    return _atelier(requete).montage.renommer(identifiant, corps.nom).en_json()


@routeur.delete("/strips/{identifiant}")
async def oublier_une_bande(requete: Request, identifiant: str) -> dict[str, Any]:
    """La bande s'en va, le clip et ses images restent."""
    return _atelier(requete).montage.oublier(identifiant).en_json()


@routeur.get("/strips/{identifiant}")
async def ouvrir_une_bande(requete: Request, identifiant: str) -> dict[str, Any]:
    """Une animation gardée, **rouverte avec tous ses réglages** (A7).

    ⚠️ **Elle est déclarée après `/strips/export` et avant `/strips/{id}/sheet`**,
    et l'ordre compte deux fois : un chemin fixe posé après un chemin à trou se
    fait manger par lui — le piège des routes à segments, payé au serveur et
    rejoué depuis dans trois tranches.

    Ce qu'elle répare : la vignette d'une animation remontait au **clip**, donc
    l'écran repartait des réglages du jeu et l'auteur devait tout refaire de
    mémoire pour corriger une virgule. Un objet qu'on sait écrire et qu'on ne
    sait pas relire n'est pas fini.
    """
    return _atelier(requete).montage.ouvrir_la_bande(identifiant)


@routeur.put("/strips/{identifiant}")
async def corriger_une_bande(
    requete: Request, identifiant: str, corps: CorpsCorrection
) -> dict[str, Any]:
    """Une correction posée sur une animation gardée. **Rien n'est dépensé.**

    Chaque champ absent veut dire *« ne touche pas à ça »*, et c'est ce qui rend
    le geste annulable : l'écran renvoie l'état d'avant, la bande y revient
    exactement, planche comprise.
    """
    bande = _atelier(requete).montage.corriger(
        identifiant,
        prises=_prises(corps.prises),
        chutier=_prises(corps.chutier),
        recette=_recette(corps.recette),
        cadence=corps.cadence if corps.cadence and corps.cadence > 0 else None,
        sens=corps.sens or None,
        cadre=Cadre.depuis_json(corps.cadre) if corps.cadre is not None else None,
    )
    return bande.en_json()


@routeur.post("/strips/{identifiant}/frame")
async def reprendre_le_cadre_de_la_bande(
    requete: Request, identifiant: str
) -> dict[str, Any]:
    """La fenêtre d'une animation gardée, remesurée **sur ses images à elle** (A7).

    Elle ne se remesure pas sur le clip : une bande peut prendre ses images dans
    deux clips, et elle n'a alors de fenêtre dans ni l'un ni l'autre.

    Le rectangle et la planche sont refaits dans le même geste — la bande ne
    passe jamais par un état où l'un est neuf et l'autre d'avant. C'est un geste
    que l'auteur demande, jamais un rattrapage automatique : il coûte une
    vingtaine de secondes, et rien ici ne dépense d'argent.
    """
    return _atelier(requete).montage.reprendre_le_cadre_de_la_bande(
        identifiant
    ).en_json()


@routeur.get("/strips/{identifiant}/sheet")
async def planche_de_la_bande(requete: Request, identifiant: str) -> Response:
    """La planche de sprites, **recalculée si le cache a sauté**.

    Elle n'est pas gardée par le navigateur : la recette d'une bande se règle,
    donc ses pixels changent sous la même adresse. C'est l'exact contraire d'un
    clip, qui ne change jamais.
    """
    return Response(
        content=_atelier(requete).montage.planche(identifiant),
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )


def _recette(brut: dict[str, Any] | None) -> Recette | None:
    """La recette envoyée par l'écran, ou rien — et rien veut dire *celle du jeu*.

    Ne pas en envoyer est le cas courant : on ouvre un clip, on découpe, on
    garde, et la bande hérite du jeu sans que l'écran ait à recopier ses
    réglages. C'est aussi ce qui fait qu'une bande gardée sans y toucher n'a
    aucun écart à afficher.
    """
    return Recette.depuis_json(brut) if brut else None


def _clip(requete: Request, identifiant: str):
    generation = _atelier(requete).animation.lire(identifiant)
    if generation is None:
        raise GenerationInconnue(identifiant)
    if generation.clip is None:
        raise ErreurAtelier("cette génération n'est pas un clip")
    return generation


