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

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel

from atelier.domaine.animation import (
    PROPORTIONS_DEFAUT,
    RESOLUTION_DEFAUT,
    SECONDES_DEFAUT,
    DemandeClip,
)
from atelier.domaine.erreurs import ErreurAtelier, GenerationInconnue
from atelier.services import Atelier

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
            }
        )
    return {
        "modeles": lignes,
        "recu_le": etat["recu_le"],
        "raison": etat["raison"],
        "manque": etat["manque"],
        "decodeur": etat["decodeur"],
        "demande": {
            "secondes": secondes,
            "resolution": resolution,
            "proportions": proportions,
        },
    }


@routeur.post("/clips/models/refresh")
async def rafraichir_modeles_video(requete: Request) -> dict[str, Any]:
    await _atelier(requete).animation.rafraichir()
    return _atelier(requete).animation.etat()


class CorpsClip(BaseModel):
    """Ce qu'il faut pour commander un clip. **L'asset de départ est obligatoire.**

    Il n'est pas dans une liste de références : il n'y a pas de liste. Un clip
    part d'une image et d'une seule, et sans elle il n'y a pas d'appel — c'est
    la distinction que la tranche instaure, et elle se lit jusque dans la forme
    de ce corps.
    """

    modele: str
    prompt: str
    asset: str
    secondes: int = SECONDES_DEFAUT
    resolution: str = RESOLUTION_DEFAUT
    proportions: str = PROPORTIONS_DEFAUT
    identifiant: str | None = None
    projet: str | None = None
    personnage: str | None = None
    pose: str | None = None
    options: dict[str, Any] = {}


@routeur.post("/clips", status_code=202)
async def commander_clip(requete: Request, corps: CorpsClip) -> dict[str, Any]:
    """Commande un clip et rend l'identifiant **dès que le travail est écrit**.

    L'attente continue côté serveur. L'appelant a déjà de quoi retrouver le clip
    si l'atelier ferme : c'est tout l'intérêt de rendre si tôt.
    """
    atelier = _atelier(requete)
    asset = atelier.assets.lire(corps.asset)
    if asset is None:
        raise ErreurAtelier(f"aucune image « {corps.asset} » dans la bibliothèque")
    # **Le rendu, pas le brut** : ce qui part doit être ce qu'on voit. C'est la
    # règle de la réinjection (US-12), et elle vaut ici pour la même raison.
    sprite = atelier.assets.reference(corps.asset)
    demande = DemandeClip(
        texte=corps.prompt,
        image=atelier.animation.preparer_entree(
            sprite, corps.resolution, corps.proportions
        ),
        secondes=corps.secondes,
        resolution=corps.resolution,
        proportions=corps.proportions,
        options=corps.options,
    )
    generation = await atelier.animation.commander(
        corps.modele,
        demande,
        identifiant=corps.identifiant,
        projet=corps.projet or asset.projet,
        personnage=corps.personnage or asset.personnage,
        pose=corps.pose,
    )
    return generation.en_json()


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


def _clip(requete: Request, identifiant: str):
    generation = _atelier(requete).animation.lire(identifiant)
    if generation is None:
        raise GenerationInconnue(identifiant)
    if generation.clip is None:
        raise ErreurAtelier("cette génération n'est pas un clip")
    return generation


def _modele_en_json(modele) -> dict[str, Any]:
    return {
        "identifiant": modele.identifiant,
        "nom": modele.nom,
        "fournisseur": modele.fournisseur,
        "durees": list(modele.durees),
        "resolutions": list(modele.resolutions),
        "proportions": list(modele.proportions),
        # **Ce que ce dépôt a mesuré, et rien d'autre** (US-440). Vide veut dire
        # « on n'en sait rien », et l'écran l'écrit plutôt que de laisser croire
        # qu'un modèle proposé a été éprouvé.
        "mesure": modele.mesure,
    }
