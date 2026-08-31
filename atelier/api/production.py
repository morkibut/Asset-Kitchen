# -*- coding: utf-8 -*-
"""Les routes de C1 — le plan de poses, les personnages, et leur matrice.

Même règle que les trois autres routeurs : aucune logique ici, chaque route
appelle un service et met en forme. **Chemins en anglais, charges utiles en
français.** Monté sous le même préfixe : de l'extérieur, l'API n'a pas de
couture.

Un quatrième module parce qu'il répond à une quatrième question. `routes.py` dit
*comment on fabrique une image*, `bibliotheque.py` *où elle se range*,
`univers.py` *ce qui la contraint avant qu'elle existe* — et celui-ci **ce qu'il
reste à fabriquer**.

**Aucune de ces routes ne touche le réseau.** Le plan, le personnage et la
matrice se consultent et se modifient réseau coupé ; seule la génération échoue,
au moment où on l'essaie, et elle part d'ailleurs.

**Les poses sont à trois segments, et c'est un piège déjà payé.** `/characters/…`
à deux segments entrerait en concurrence avec `/characters/{identifiant}` et ne
serait atteinte que si elle était déclarée avant — l'adresse dépendrait alors de
l'ordre des fonctions dans ce fichier. Le dépôt a déjà payé un chemin qui ne
s'atteint pas (`Mount("/mcp")`, voir `docs/PIEGES.md`) ; à trois segments il n'y
a plus d'ordre à respecter, et les routes des poses sont malgré tout écrites en
premier — un lecteur ne devrait pas avoir à vérifier que ça tient.
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from atelier.api.routes import CorpsTrait
from atelier.domaine.recette import RAYON_MAX
from atelier.services import Atelier

routeur = APIRouter()


def _atelier(requete: Request) -> Atelier:
    return requete.app.state.atelier


def _projet(requete: Request, projet: str | None) -> str:
    """Le projet visé — celui qu'on nomme, sinon celui qui est ouvert.

    Le défaut est ici et non dans le service, pour la raison de `univers.py` :
    un agent nommera toujours son projet, et le service doit pouvoir refuser un
    projet manquant plutôt que d'en inventer un.
    """
    return projet or _atelier(requete).bibliotheque.courant or ""


# ── Ce que l'écran envoie ────────────────────────────────────────────────────


class CorpsPoseDuType(BaseModel):
    """Une attitude dans la liste d'un type d'objet (E9)."""

    identifiant: str = Field(min_length=1)
    nom: str = ""
    images: int = Field(1, ge=1, le=64)


class CorpsPosesDuType(BaseModel):
    """La liste entière d'un type d'objet — on écrit ce qui reste.

    Entière et non pose par pose : à l'écran on range et on dérange plusieurs
    lignes avant de regarder ailleurs, et un appel par ligne écrirait le fichier
    du projet autant de fois qu'il y a de cases cochées. Une liste vide est une
    décision valable — un décor n'a pas de pose du tout.
    """

    poses: list[CorpsPoseDuType] = []
    projet: str | None = None


class CorpsPose(BaseModel):
    """Une attitude que le jeu réclame. Le nom suffit à la créer."""

    nom: str = Field(min_length=1)
    # Combien d'images cette pose demande. Un pour la plupart, quatre ou huit
    # pour un cycle — c'est l'auteur qui le décide, jamais le produit.
    images: int = Field(1, ge=1, le=64)
    projet: str | None = None


class CorpsReglagePose(BaseModel):
    """Renommer une pose, ou changer ce qu'elle demande. `None` ne touche pas.

    **L'identifiant ne bouge jamais** : les images déjà faites le portent, et
    renommer une pose ne doit pas leur faire perdre leur case (US-118).
    """

    nom: str | None = None
    images: int | None = Field(None, ge=1, le=64)
    projet: str | None = None


class CorpsPersonnage(BaseModel):
    """Un nom, une description, et rien d'autre (US-115).

    **Il n'y a pas de prompt ici, et c'est un invariant de la tranche** : le
    corps naît dans l'atelier et nulle part ailleurs. Ce que cette route crée,
    c'est une colonne de cases vides.
    """

    nom: str = Field(min_length=1)
    description: str = ""
    projet: str | None = None


class CorpsReglagePersonnage(BaseModel):
    """Tout ce qui se règle sur un personnage, **en un seul geste**.

    Les champs se remplissent ensemble à l'écran — on décrit en cochant les
    poses —, et un appel par champ ferait autant d'allers-retours qu'il y a de
    cases. `None` ne touche pas.

    `poses` arrive en **positif** : ce que l'auteur a coché. Le fichier, lui,
    garde le complément — voir `atelier/domaine/personnage.py`.
    """

    nom: str | None = None
    description: str | None = None
    poses: list[str] | None = None
    concept_arts: list[str] | None = None
    # **Le type d'objet** (E9) : il décide de la liste de base. Vide, la chose
    # retombe sur le plan du projet — l'état d'avant, repris sans perte.
    type: str | None = None
    # Ce que cette chose ajoute pour elle seule, et ce qu'elle retire de ses
    # propres ajouts. Deux champs plutôt qu'une liste : ajouter et retirer sont
    # deux gestes, et une liste entière ferait perdre celui qu'un autre onglet
    # vient de poser.
    ajouter: str | None = None
    retirer_ajoutee: str | None = None
    # **L'ambiance se désigne ici, sur la chose du jeu** (E11) — jamais sur la
    # collection où elle est rangée : une collection reste un dossier qui ne
    # décide de rien. Le vide la retire, et la chose retombe sur le jeu.
    ambiance: str | None = None
    # Ce qu'elle lui prend : tout, les couleurs seulement, ou tout sauf les
    # images. Une ambiance ne s'impose pas — on la désigne, puis on choisit.
    prend: Literal["tout", "couleurs", "sans-images"] | None = None
    projet: str | None = None


def _avec_plan(atelier: Atelier, projet: str, pose: Any) -> dict[str, Any]:
    """La pose touchée, **et le plan entier avec**.

    Les trois gestes du plan rendent la même forme que l'annonce du flux, et
    c'est délibéré : un écran fond ce qu'il reçoit par les deux chemins avec le
    même code, et il n'a jamais à deviner si une pose vient d'être ajoutée,
    renommée ou retirée. Le plan est court — le rendre entier ne coûte rien, et
    reconstituer un ordre à partir d'un message partiel coûterait une règle de
    plus à écrire deux fois (`docs/PIEGES.md` — tout ce qui arrive par deux
    chemins se fond par identifiant).
    """
    return {
        "pose": pose.en_json(),
        "plan": [p.en_json() for p in atelier.production.plan(projet)],
    }


class CorpsEcartees(BaseModel):
    """Ce qui ne partira plus, à l'une des **deux portées durables** (US-126).

    La troisième — cette génération — ne passe pas par ici : elle ne s'écrit
    nulle part et part avec l'appel, comme la pile d'annulation de T8.

    La liste est **entière**, jamais un ajout : l'écran montre l'état complet
    des cases, et envoyer un delta rendrait possible deux onglets qui cochent
    et décochent la même ligne sans jamais converger.
    """

    portee: Literal["projet", "personnage"]
    ecartees: list[str] = Field(default_factory=list)
    personnage: str | None = None
    projet: str | None = None


class CorpsEmplacement(BaseModel):
    """Un endroit du corps. Le nom suffit à le créer (US-138)."""

    nom: str = Field(min_length=1)
    projet: str | None = None


class CorpsReglageEmplacement(BaseModel):
    """Renommer un emplacement, ou le déplacer. `None` ne touche pas."""

    nom: str | None = None
    rang: int | None = Field(None, ge=0, le=999)
    projet: str | None = None


class CorpsPiece(BaseModel):
    """Une pièce d'équipement, décrite une seule fois (US-137).

    **Il n'y a pas de prompt ici non plus**, et c'est le même invariant que pour
    un personnage : une pièce n'apparaît que sur un corps, jamais seule sur fond
    vide. Sa `description` part dans le prompt d'une planche d'équipement, elle
    n'est pas ce prompt.
    """

    nom: str = Field(min_length=1)
    description: str = ""
    # Par identifiant **ou par nom** — créé s'il n'existe pas.
    emplacement: str = ""
    # **Contenue, ou qui agrandit — et l'auteur le déclare** (US-139). Le défaut
    # est celui qui marche : cinq pièces sur six mesurées propres le 28 août.
    portee: Literal["contenue", "agrandit"] = "contenue"
    projet: str | None = None


class CorpsReglagePiece(BaseModel):
    """Tout ce qui se règle sur une pièce, en un geste. `None` ne touche pas."""

    nom: str | None = None
    description: str | None = None
    emplacement: str | None = None
    portee: Literal["contenue", "agrandit"] | None = None
    concept_arts: list[str] | None = None
    projet: str | None = None


class CorpsMasque(BaseModel):
    """Le masque rectangle d'un calque — **inclusif aux deux bouts**, comme tout
    rectangle du produit depuis T5, et exprimé en pixels de l'image rendue.

    Vide, il **retire** le masque : la différence est alors cherchée sur toute la
    case, ce qui est le défaut de la tranche.
    """

    zone: list[int] | None = Field(None, min_length=4, max_length=4)


class CorpsMain(BaseModel):
    """Ce que la main a posé sur une couche d'un calque (C4).

    **La liste est entière, jamais un ajout**, et **vide elle annule la
    couche** : deux onglets qui empileraient des deltas ne convergeraient
    jamais, et « chaque couche s'annule » (`docs/PLAN.md`, C4) demande un geste,
    pas un mode.

    `couche` porte les noms du domaine — comme `portee` sur une pièce, et pour
    la même raison : une valeur traduite au passage du port est une valeur qu'on
    peut traduire de travers.
    """

    couche: Literal["affinage", "retouche"]
    traits: list[CorpsTrait] = Field(default_factory=list)


def _avec_vestiaire(
    atelier: Atelier, projet: str, genre: str, objet: Any
) -> dict[str, Any]:
    """L'objet touché, **et le vestiaire entier avec**.

    Même raison que `_avec_plan` un cran plus haut : les six gestes rendent la
    même forme que l'annonce du flux, et un écran fond ce qui lui arrive par les
    deux chemins avec le même code. Il n'a donc jamais à deviner si une pièce
    vient d'être ajoutée, réglée ou retirée.
    """
    return {genre: objet.en_json(), **atelier.equipement.vestiaire(projet)}


class CorpsDesignation(BaseModel):
    """Quelle case cette image remplit (US-122).

    Les deux vides ensemble retirent la désignation ; l'image, elle, ne bouge
    pas de la bibliothèque.
    """

    personnage: str | None = None
    pose: str | None = None
    projet: str | None = None


# ── Le plan de poses ─────────────────────────────────────────────────────────


@routeur.post("/characters/poses", status_code=201)
async def ajouter_pose(requete: Request, corps: CorpsPose) -> dict[str, Any]:
    """Une attitude de plus au plan du projet (US-116, US-118).

    **Nommer, c'est créer**, et ça n'ajoute qu'une case vide : aucune génération
    ne part, et chaque personnage du projet voit paraître la ligne neuve sans
    qu'un seul de leurs fichiers soit écrit.
    """
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    pose = atelier.production.ajouter_pose(projet, corps.nom, corps.images)
    return _avec_plan(atelier, projet, pose)


@routeur.put("/characters/poses/{pose}")
async def regler_pose(
    requete: Request, pose: str, corps: CorpsReglagePose
) -> dict[str, Any]:
    """Renommer une pose, ou changer le nombre d'images qu'elle demande."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    reglee = atelier.production.regler_pose(
        projet, pose, nom=corps.nom, images=corps.images
    )
    return _avec_plan(atelier, projet, reglee)


@routeur.delete("/characters/poses/{pose}")
async def retirer_pose(
    requete: Request, pose: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Une pose quitte le plan. **Les images faites pour elle restent** — jamais
    de cascade, et elles gardent son identifiant : remettre la même pose au plan
    les remet dans leur case."""
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    retiree = atelier.production.retirer_pose(vise, pose)
    return _avec_plan(atelier, vise, retiree)


# ── La liste d'un type d'objet ───────────────────────────────────────────────


@routeur.get("/characters/types")
async def poses_des_types(
    requete: Request, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Ce que chaque type d'objet réclame, et d'où sa liste lui vient (E9).

    `origine` dit `écrite` quand l'auteur a posé la sienne, `connue` quand
    c'est celle que le produit propose pour ce type-là, et `projet` quand le
    type n'a rien de particulier et retombe sur le plan du jeu. L'écran l'écrit
    en clair plutôt que de laisser croire que tout a été décidé.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    return atelier.production.poses_des_types(vise)


@routeur.put("/characters/types/{type}/poses")
async def poser_les_poses_du_type(
    requete: Request, type: str, corps: CorpsPosesDuType
) -> dict[str, Any]:
    """Écrire la liste d'un type — **et de lui seul**.

    Les choses de ce type voient la liste changer sans qu'un seul de leurs
    fichiers soit écrit : une case est pleine parce qu'une image la porte, et
    ranger une pose ne perd donc aucune image.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, corps.projet)
    atelier.production.poser_les_poses_du_type(
        vise, type, [p.model_dump() for p in corps.poses]
    )
    return atelier.production.poses_des_types(vise)


@routeur.delete("/characters/types/{type}/poses")
async def oublier_les_poses_du_type(
    requete: Request, type: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Ce type revient à la liste qu'on lui proposait — **il n'écrit plus la
    sienne**. Les images ne bougent pas : elles gardent l'identifiant de leur
    pose, et une pose qui revient les remet dans leur case."""
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    atelier.production.oublier_les_poses_du_type(vise, type)
    return atelier.production.poses_des_types(vise)


# ── Les personnages ──────────────────────────────────────────────────────────


@routeur.get("/characters")
async def tableau_de_bord(
    requete: Request, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Le plan, les personnages **et le vestiaire**, en un seul aller-retour.

    Comme la toile de T8 : une colonne de cases n'existe que par le plan qui la
    nomme, et deux appels rendraient possible l'instant où l'un est arrivé et
    l'autre non. C3 y ajoute les emplacements et les pièces, **et pour la raison
    exacte** : ils sont l'autre axe de la même matrice.

    **C'est la route qui compose, pas un service.** Le plan vient de la
    production, le vestiaire de l'équipement, et l'équipement connaît déjà la
    production — lui faire rendre les deux aurait fermé le cercle dans l'autre
    sens. Un routeur assemble ; c'est très exactement son travail.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    return {
        **atelier.production.tableau_de_bord(vise),
        **atelier.equipement.vestiaire(vise),
    }


@routeur.post("/characters", status_code=201)
async def creer_personnage(requete: Request, corps: CorpsPersonnage) -> dict[str, Any]:
    """Un personnage de plus dans le projet (US-115). Ne coûte rien, ne sort pas."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    personnage = atelier.production.creer_personnage(
        projet, corps.nom, corps.description
    )
    # **La forme complète, comme l'annonce du flux.** L'écran fond ce qui lui
    # arrive par les deux chemins avec le même code : une charge amputée de ses
    # cases y remplacerait un objet entier par un objet à trous.
    return {"personnage": atelier.production.en_charge(projet, personnage)}


@routeur.put("/characters/{identifiant}")
async def regler_personnage(
    requete: Request, identifiant: str, corps: CorpsReglagePersonnage
) -> dict[str, Any]:
    """Décrire, renommer, cocher ses poses, désigner ses concept arts."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    personnage = atelier.production.regler_personnage(
        projet,
        identifiant,
        nom=corps.nom,
        description=corps.description,
        tenues=corps.poses,
        concept_arts=corps.concept_arts,
        type=corps.type,
        ajouter=corps.ajouter,
        retirer_ajoutee=corps.retirer_ajoutee,
        ambiance=corps.ambiance,
        prend=corps.prend,
    )
    return {"personnage": atelier.production.en_charge(projet, personnage)}


@routeur.delete("/characters/{identifiant}")
async def supprimer_personnage(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Le personnage part, **ses images restent**, chacune marquée « personnage
    supprimé ». Jamais de cascade — la règle générale du produit (US-28)."""
    atelier = _atelier(requete)
    return atelier.production.supprimer_personnage(_projet(requete, projet), identifiant)


# ── La case qu'une image remplit ─────────────────────────────────────────────


@routeur.put("/assets/{identifiant}/character")
async def designer(
    requete: Request, identifiant: str, corps: CorpsDesignation
) -> dict[str, Any]:
    """Désigner une image comme le corps d'une case, ou l'en retirer (US-122).

    **Une route d'asset dans ce module-ci**, comme le rangement et le favori
    vivent dans celui de la bibliothèque : le chemin dit sur quoi le geste
    porte, le module dit à quelle question il répond. Celle-ci est « quelle case
    cette image remplit », et c'est la question de la matrice.
    """
    atelier = _atelier(requete)
    asset = atelier.production.designer(
        identifiant,
        projet=_projet(requete, corps.projet),
        personnage=corps.personnage,
        pose=corps.pose,
    )
    return asset.en_json()


# ── Le vestiaire — les emplacements et les pièces ────────────────────────────
#
# **Trois segments pour ce qui porte un identifiant**, comme les poses et pour le
# même piège : à deux, `/characters/{identifiant}` et `/characters/slots` se
# disputeraient l'adresse, et laquelle gagne dépendrait de l'ordre des fonctions
# dans ce fichier (`docs/PIEGES.md`).


@routeur.post("/characters/slots", status_code=201)
async def ajouter_emplacement(
    requete: Request, corps: CorpsEmplacement
) -> dict[str, Any]:
    """**Nommer, c'est créer** (US-138) : un emplacement de plus, en queue."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    emplacement = atelier.equipement.ajouter_emplacement(projet, corps.nom)
    return _avec_vestiaire(atelier, projet, "emplacement", emplacement)


@routeur.put("/characters/slots/{identifiant}")
async def regler_emplacement(
    requete: Request, identifiant: str, corps: CorpsReglageEmplacement
) -> dict[str, Any]:
    """Renommer un emplacement, ou le déplacer dans l'ordre. **L'identifiant ne
    bouge pas** : les pièces rangées là le portent."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    emplacement = atelier.equipement.regler_emplacement(
        projet, identifiant, nom=corps.nom, rang=corps.rang
    )
    return _avec_vestiaire(atelier, projet, "emplacement", emplacement)


@routeur.delete("/characters/slots/{identifiant}")
async def retirer_emplacement(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """L'emplacement part, **les pièces restent** — sans emplacement, comme au
    jour où on les a nommées. Jamais de cascade."""
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    emplacement = atelier.equipement.retirer_emplacement(vise, identifiant)
    return _avec_vestiaire(atelier, vise, "emplacement", emplacement)


@routeur.post("/characters/pieces", status_code=201)
async def ajouter_piece(requete: Request, corps: CorpsPiece) -> dict[str, Any]:
    """Une pièce décrite **une seule fois** (US-137). Ne coûte rien, ne sort pas.

    L'emplacement se donne par son identifiant **ou par son nom**, et il est créé
    s'il n'existe pas : nommer « casque · tête » ne doit pas demander d'avoir
    créé la tête d'abord.
    """
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    piece = atelier.equipement.ajouter_piece(
        projet,
        corps.nom,
        description=corps.description,
        emplacement=corps.emplacement,
        portee=corps.portee,
    )
    return _avec_vestiaire(atelier, projet, "piece", piece)


@routeur.put("/characters/pieces/{identifiant}")
async def regler_piece(
    requete: Request, identifiant: str, corps: CorpsReglagePiece
) -> dict[str, Any]:
    """Tout ce qui se règle sur une pièce, en un seul geste — **la portée
    comprise, et elle n'est jamais devinée** (US-139)."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    piece = atelier.equipement.regler_piece(
        projet,
        identifiant,
        nom=corps.nom,
        description=corps.description,
        emplacement=corps.emplacement,
        portee=corps.portee,
        concept_arts=corps.concept_arts,
    )
    return _avec_vestiaire(atelier, projet, "piece", piece)


@routeur.delete("/characters/pieces/{identifiant}")
async def retirer_piece(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """La pièce part, **ses calques restent** — jamais de cascade. Ils gardent
    son identifiant : la remettre les remet dans leur colonne."""
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    piece = atelier.equipement.retirer_piece(vise, identifiant)
    return _avec_vestiaire(atelier, vise, "piece", piece)


# ── Le masque d'un calque ────────────────────────────────────────────────────


@routeur.put("/assets/{identifiant}/layer")
async def borner(
    requete: Request, identifiant: str, corps: CorpsMasque
) -> dict[str, Any]:
    """Poser, déplacer ou retirer le masque rectangle d'un calque (US-145).

    **Le journal du projet ne bouge pas d'un centime**, et c'est vrai par
    construction : ce chemin ne touche jamais le fournisseur. Le calque se
    recalcule à partir de l'image déjà payée et du corps déjà là.

    `zone` vide retire le masque : **revenir à la différence brute est un geste
    unique**, et c'est celui-ci.
    """
    asset = _atelier(requete).equipement.borner(identifiant, corps.zone)
    return asset.en_json()


# ── La main ──────────────────────────────────────────────────────────────────


@routeur.put("/assets/{identifiant}/hand")
async def affiner(
    requete: Request, identifiant: str, corps: CorpsMain
) -> dict[str, Any]:
    """Poser une couche de la main sur un calque (C4, US-149, US-150, US-153).

    **Une route pour les deux couches, et la couche est dans la charge.** Ce que
    l'auteur pose est du même genre des deux côtés — un chemin, un rayon, garder
    ou ôter —, et deux routes auraient donné deux chemins de code à tenir
    d'accord pour un geste que la main ne distingue pas.

    **Le journal du projet ne bouge pas d'un centime**, pour la raison de
    `borner` : ce chemin ne touche jamais le fournisseur, et le calque se
    recalcule sur le processeur à partir de l'image déjà payée.
    """
    asset = _atelier(requete).equipement.affiner(
        identifiant, corps.couche, [t.model_dump() for t in corps.traits]
    )
    return asset.en_json()


# ── Le rejeu du recalage ─────────────────────────────────────────────────────


@routeur.post("/assets/{identifiant}/realign")
async def recaler(requete: Request, identifiant: str) -> dict[str, Any]:
    """Rejouer le recalage de la planche dont cette image est sortie (US-173).

    **Rien ne naît, rien ne meurt** : les assets déjà là gardent leur
    identifiant, leur rang et leur place, et seule leur image change. La route
    rend donc la liste des images rejouées, jamais une liste d'images neuves —
    et `POST` parce que le geste écrit, sur une ressource qu'il ne crée pas.

    **Le journal du projet ne bouge pas d'un centime**, pour la raison de
    `borner` juste au-dessus : ce chemin ne touche jamais le fournisseur. La
    planche a été payée une fois ; la remesurer coûte des millisecondes.
    """
    rejoues = _atelier(requete).equipement.recaler(identifiant)
    return {"assets": [asset.en_json() for asset in rejoues]}


# ── Ce qu'une case demande ───────────────────────────────────────────────────


class CorpsSujet(BaseModel):
    """La case qu'on arme : qui, quelles attitudes, et quelle pièce."""

    personnage: str
    poses: list[str] = Field(default_factory=list)
    piece: str | None = None
    projet: str | None = None


@routeur.post("/characters/subject")
async def sujet(requete: Request, corps: CorpsSujet) -> dict[str, Any]:
    """Le sujet que cette case demande au modèle (US-115, C2, C3).

    **Ni la bible ni les consignes de planche** : c'est l'aperçu de R2 qui
    montre le texte entier, et lui seul. Ici on rend ce qui va dans le champ,
    c'est-à-dire ce que l'auteur pourra corriger avant de payer.

    `POST` et non `GET` pour une seule raison : un lot vise N attitudes, et une
    liste d'identifiants dans une adresse est le genre de détail qui se casse au
    dixième. Rien n'est écrit — c'est une lecture, comme l'aperçu du prompt.
    """
    return {
        "sujet": _atelier(requete).production.sujet(
            _projet(requete, corps.projet),
            corps.personnage,
            corps.poses,
            corps.piece,
        )
    }


# ── La sortie ────────────────────────────────────────────────────────────────


class CorpsSortie(BaseModel):
    """Où poser le personnage. **Rien d'autre à dire** : ce qui part, c'est ce
    que la matrice retient, et le choisir ici en ferait une seconde règle."""

    projet: str | None = None
    # Le dossier du jeu, quand on veut celui d'aujourd'hui plutôt que celui des
    # Réglages. Absent, c'est celui que l'auteur a posé une fois pour toutes —
    # le même défaut que pour l'agent depuis T7, et le même service qui le tient.
    dossier: str | None = None


@routeur.post("/characters/{identifiant}/export")
async def sortir(
    requete: Request, identifiant: str, corps: CorpsSortie
) -> dict[str, Any]:
    """Un personnage complet part dans le dossier du jeu (US-154, US-155).

    **`POST` et non `GET`** : le geste écrit — dehors, dans un dossier que
    l'atelier ne connaît pas — et la réponse n'est pas une ressource qu'on
    pourrait aller rechercher, c'est le compte rendu de ce qui vient d'être
    posé.

    **Aucun octet ne traverse cette route.** L'archive de T6 revenait au
    navigateur ; ici les fichiers sont écrits sur la machine, et ce qui revient
    est la liste de leurs chemins. C'est ce qui fait que l'écran et l'agent
    reçoivent exactement la même chose de la même sortie.

    Deux refus, chacun avec sa phrase : un personnage sans aucune pose remplie
    (l'écran grise déjà, ceci est le filet), et un dossier du jeu absent ou non
    inscriptible — celui-là vient de T7 et nomme le chemin fautif.
    """
    sortie = _atelier(requete).export.exporter_personnage(
        _projet(requete, corps.projet), identifiant, corps.dossier
    )
    return sortie.en_json()


# ── Ce qui ne part plus ──────────────────────────────────────────────────────


@routeur.put("/references")
async def ecarter(requete: Request, corps: CorpsEcartees) -> dict[str, Any]:
    """Décocher une référence pour un personnage, ou pour tout le projet (US-126).

    **Ni l'univers ni les artworks officiels ne bougent** — c'est un critère
    d'acceptation, et il est vrai par construction : la liste vit sur le projet
    à côté des teintes, jamais dans `Univers`. Une carte décochée reste promue,
    garde sa famille, et continue de compter dans la palette.
    """
    atelier = _atelier(requete)
    return atelier.production.ecarter(
        _projet(requete, corps.projet),
        portee=corps.portee,
        references=corps.ecartees,
        personnage=corps.personnage,
    )
