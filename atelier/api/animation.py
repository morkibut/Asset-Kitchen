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

import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel

from atelier.domaine.animation import (
    PROPORTIONS_DEFAUT,
    RESOLUTION_DEFAUT,
    SECONDES_DEFAUT,
    DemandeClip,
)
from atelier.domaine.bande import BOUCLE
from atelier.domaine.bande import CADENCE_PAR_DEFAUT as CADENCE_DE_BANDE
from atelier.domaine.bande import Cadre
from atelier.domaine.erreurs import ErreurAtelier, GenerationInconnue
from atelier.domaine.recette import Recette
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
async def liste_mouvements(requete: Request) -> dict[str, Any]:
    """La bibliothèque de mouvements — **la même pour tous les jeux**.

    Elle rend aussi les masqués, dans une seconde liste : c'est ce qui rend le
    masquage réversible, et un geste irréversible sur du vocabulaire livré n'a
    aucune raison d'être.
    """
    return _atelier(requete).mouvements.en_json()


@routeur.get("/movements/for-pose/{identifiant_pose}")
async def mouvement_de_la_pose(
    requete: Request, identifiant_pose: str, projet: str | None = Query(None)
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
    """
    atelier = _atelier(requete)
    ouvert = projet or atelier.bibliotheque.courant
    repli = ""
    for pose in atelier.production.plan(ouvert):
        if pose.identifiant == identifiant_pose:
            repli = pose.dit()
            break
    mouvement = atelier.mouvements.pour_la_pose(identifiant_pose)
    texte = atelier.mouvements.texte_de_la_pose(identifiant_pose, repli)
    return {
        "pose": identifiant_pose,
        "mouvement": mouvement.en_json() if mouvement else None,
        "texte": texte,
        "origine": "mouvement" if mouvement else ("pose" if repli else "aucun"),
    }


@routeur.post("/movements", status_code=201)
async def fabriquer_mouvement(
    requete: Request, corps: CorpsMouvement
) -> dict[str, Any]:
    """Écrire un nom crée le mouvement, sur-le-champ, sans formulaire et sans
    rien payer — l'invariant de `C1`, généralisé en `E2`."""
    atelier = _atelier(requete)
    atelier.mouvements.fabriquer(
        corps.nom or "",
        corps.texte or "",
        corps.cadence,
        tuple(corps.directions or ()),
    )
    return atelier.mouvements.en_json()


@routeur.put("/movements/{identifiant}")
async def regler_mouvement(
    requete: Request, identifiant: str, corps: CorpsMouvement
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
    )
    return atelier.mouvements.en_json()


@routeur.delete("/movements/{identifiant}")
async def masquer_mouvement(requete: Request, identifiant: str) -> dict[str, Any]:
    """Retirer un mouvement de la liste — **un livré laisse une pierre**.

    Le catalogue des livrés se relit à chaque lecture : effacer un livré le
    ferait revenir à la ligne suivante. Un fabriqué, lui, s'en va pour de bon.
    """
    atelier = _atelier(requete)
    atelier.mouvements.masquer(identifiant)
    return atelier.mouvements.en_json()


@routeur.post("/movements/{identifiant}/show")
async def montrer_mouvement(requete: Request, identifiant: str) -> dict[str, Any]:
    """Rendre à la liste un livré masqué."""
    atelier = _atelier(requete)
    atelier.mouvements.montrer(identifiant)
    return atelier.mouvements.en_json()


def _demande_de_jauge(
    secondes: int, resolution: str, proportions: str
) -> DemandeClip:
    """La demande qui sert à **jauger** un modèle, sans image et sans texte.

    L'image de départ n'y est pas, et ce n'est pas un oubli : ce qui se jauge
    ici est ce que le modèle sait faire — sa durée, sa résolution, son prix —,
    pas ce que l'auteur a joint. Le refus *« demande une image de départ »* est
    donc écarté volontairement, en lui donnant un octet : l'écran ne va pas
    griser les onze modèles vidéo parce que rien n'est encore sélectionné.
    """
    return DemandeClip(
        texte="",
        image=b"\0",
        secondes=secondes,
        resolution=resolution,
        proportions=proportions,
    )


@routeur.get("/clips/models")
async def modeles_video(
    requete: Request,
    secondes: int = Query(SECONDES_DEFAUT, ge=1, le=60),
    resolution: str = Query(RESOLUTION_DEFAUT),
    proportions: str = Query(PROPORTIONS_DEFAUT),
) -> dict[str, Any]:
    """Les modèles vidéo, leur prix du jour **avec sa formule**, et leur grisé.

    Le prix dépend de ce qu'on demande — une seconde de plus, une résolution de
    plus, et il change. Il se calcule donc pour le réglage courant, transmis en
    paramètres, et non une fois pour toutes au démarrage.
    """
    atelier = _atelier(requete)
    demande = _demande_de_jauge(secondes, resolution, proportions)
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
            "secondes": secondes,
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


class CorpsClip(BaseModel):
    """Ce qu'il faut pour commander un clip. **L'asset de départ est obligatoire.**

    Il n'est pas dans une liste de références : il n'y a pas de liste. Un clip
    part d'une image et d'une seule, et sans elle il n'y a pas d'appel — c'est
    la distinction que la tranche instaure, et elle se lit jusque dans la forme
    de ce corps.
    """

    modele: str
    asset: str
    # **Le texte, ou le mouvement qui l'écrit** — au moins l'un des deux. Un
    # écran passe le mouvement et ne retape rien ; un script passe le texte.
    # Les deux mènent au même appel, et c'est le serveur qui traduit, pour que
    # le texte anglais n'ait qu'un seul endroit où il s'écrit (A6).
    prompt: str = ""
    mouvement: str | None = None
    secondes: int = SECONDES_DEFAUT
    resolution: str = RESOLUTION_DEFAUT
    proportions: str = PROPORTIONS_DEFAUT
    # **Combien de clips ce geste lance. Un est le défaut**, et le produit
    # n'impose jamais un lot : c'est ce qui reste de l'ancienne tranche `A3`.
    nombre: int = 1
    identifiant: str | None = None
    projet: str | None = None
    personnage: str | None = None
    pose: str | None = None
    direction: str | None = None
    options: dict[str, Any] = {}


# Au-delà, ce n'est plus un lot, c'est une fuite. **Ce n'est pas la règle des
# huit tirages** — celle-là parle de ce qu'il faut voir avant de juger un
# modèle, pas de ce qu'on lance d'un clic. C'est une borne de sécurité sur un
# geste qui paie N fois : à 0,067 $ le clip, huit font un peu plus d'un demi
# dollar, et c'est le plus gros geste d'un coup que le produit accepte.
LOT_MAX = 8


@routeur.post("/clips", status_code=202)
async def commander_clip(requete: Request, corps: CorpsClip) -> dict[str, Any]:
    """Commande un lot de clips et rend leurs identifiants **dès qu'ils sont écrits**.

    L'attente continue côté serveur, un clip par attente. L'appelant a déjà de
    quoi les retrouver si l'atelier ferme : c'est tout l'intérêt de rendre si
    tôt.

    **Une liste même à un seul clip.** Deux formes de réponse selon le nombre
    demandé auraient obligé chaque appelant à traiter les deux, et le cas rare
    — le lot — est celui qui aurait été oublié.

    **Les clips d'un lot ne sont pas un lot pour autant.** Chacun est une
    génération à part, avec sa dépense, son numéro de travail et son attente :
    l'un revient pendant que l'autre se fabrique encore, et c'est très
    exactement ce qu'on veut en regardant quatre tirages arriver.
    """
    atelier = _atelier(requete)
    asset = atelier.assets.lire(corps.asset)
    if asset is None:
        raise ErreurAtelier(f"aucune image « {corps.asset} » dans la bibliothèque")
    if not 1 <= corps.nombre <= LOT_MAX:
        raise ErreurAtelier(
            f"un lot va de 1 à {LOT_MAX} clips — {corps.nombre} demandés"
        )

    # **Le texte s'écrit à un seul endroit** (A6). L'écran envoie le mouvement
    # qu'on a choisi, pas le texte qu'il vient d'afficher : deux chemins vers
    # le même texte finiraient par en envoyer un troisième.
    texte = corps.prompt
    if corps.mouvement:
        mouvement = atelier.mouvements.lire(corps.mouvement)
        if mouvement is None:
            raise ErreurAtelier(
                f"aucun mouvement « {corps.mouvement} » dans la bibliothèque"
            )
        texte = mouvement.texte
    if not texte.strip():
        raise ErreurAtelier(
            "un clip part d'un texte — choisissez un mouvement, ou écrivez-en un"
        )

    # **Le rendu, pas le brut** : ce qui part doit être ce qu'on voit. C'est la
    # règle de la réinjection (US-12), et elle vaut ici pour la même raison.
    # Préparée **une fois pour tout le lot** : c'est la même image de départ,
    # et la redimensionner huit fois ne changerait que le temps d'attente.
    sprite = atelier.assets.reference(corps.asset)
    entree = atelier.animation.preparer_entree(
        sprite, corps.resolution, corps.proportions
    )
    # **Le lot s'écrit, il ne se déduit pas.** Quatre clips lancés d'un coup
    # partagent tout — même texte, même image, même minute —, et les rapprocher
    # après coup se tromperait le jour où l'auteur relance la même chose. « En
    # garder un, jeter les autres » a besoin de savoir *lesquels* sans hésiter.
    lot = uuid.uuid4().hex[:12]
    clips = []
    for rang in range(corps.nombre):
        demande = DemandeClip(
            texte=texte,
            image=entree,
            secondes=corps.secondes,
            resolution=corps.resolution,
            proportions=corps.proportions,
            options=corps.options,
        )
        generation = await atelier.animation.commander(
            corps.modele,
            demande,
            # **L'identifiant imposé ne vaut que pour le premier.** Il sert à
            # rejouer un appel connu ; les suivants d'un lot sont des clips
            # neufs, et leur en donner le même écraserait le premier.
            identifiant=corps.identifiant if rang == 0 else None,
            projet=corps.projet or asset.projet,
            personnage=corps.personnage or asset.personnage,
            pose=corps.pose,
            direction=corps.direction,
            mouvement=corps.mouvement,
            lot=lot,
        )
        clips.append(generation.en_json())
    return {"clips": clips}


@routeur.get("/clips/start-image")
async def image_de_depart(
    requete: Request,
    personnage: str,
    projet: str | None = Query(None),
    pose: str | None = Query(None),
    direction: str | None = Query(None),
) -> dict[str, Any]:
    """Ce qu'un clip prendrait au départ, **et pourquoi celle-là** (A9).

    Une proposition, jamais une contrainte : l'écran la montre, et l'auteur en
    change d'un clic pour n'importe quelle image de la bibliothèque. La règle
    est dans le service — ici il n'y a qu'une porte.
    """
    atelier = _atelier(requete)
    vise = projet or atelier.bibliotheque.courant or ""
    return atelier.production.image_de_depart(vise, personnage, pose, direction)


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


@routeur.get("/clips")
async def liste_clips(
    requete: Request, limite: int = Query(100, ge=1, le=500)
) -> dict[str, Any]:
    """Les clips, du plus récent au plus ancien. **Ce sont des générations.**"""
    atelier = _atelier(requete)
    clips = [
        g.en_json()
        for g in atelier.generations.recentes(limite)
        if g.clip is not None
    ]
    return {"clips": clips}


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
    """Le fichier tel qu'il est arrivé. Le brut, jamais un rendu."""
    generation = _clip(requete, identifiant)
    resultat = generation.emplacements[0].resultat
    if resultat is None:
        raise ErreurAtelier("ce clip n'est pas encore arrivé")
    atelier = _atelier(requete)
    return Response(
        content=atelier.fichiers.lire(resultat.fichier),
        media_type=resultat.type_media,
        # Un clip ne change jamais : une fois payé et écrit, ses octets sont
        # définitifs. Le navigateur peut le garder longtemps.
        headers={"Cache-Control": "private, max-age=86400"},
    )


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
    fichier = dossier / f"{numero:04d}.png"
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


class CorpsBande(CorpsApercuBande):
    """Ce qu'on garde en plus de ce qu'on montre : le nom, la cadence, le sens,
    et la case visée — facultative, parce qu'une bande sans case est un
    brouillon et qu'un brouillon ne bloque rien."""

    nom: str = ""
    cadence: float = 0.0
    sens: str = ""
    pose: str | None = None
    direction: str | None = None


class CorpsCase(BaseModel):
    """La case qu'une bande remplit — ou plus aucune, les deux vides."""

    pose: str | None = None
    direction: str | None = None


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
        recette=_recette(corps.recette),
        pose=corps.pose,
        direction=corps.direction,
    )
    return bande.en_json()


@routeur.put("/strips/{identifiant}/case")
async def affecter_une_bande(
    requete: Request, identifiant: str, corps: CorpsCase
) -> dict[str, Any]:
    """La case du plan de poses que cette bande remplit — ou plus aucune.

    Les deux champs vides la retirent de sa case : elle redevient un brouillon,
    elle ne disparaît pas.
    """
    bande = _atelier(requete).montage.affecter(
        identifiant, corps.pose, corps.direction
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


