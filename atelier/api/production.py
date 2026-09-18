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

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel, Field

from atelier.api.routes import CorpsTrait, reponse_archive
from atelier.domaine.recette import OCCUPATION_MAX_ABSOLU, RAYON_MAX
from atelier.services import Atelier
from atelier.services.production import TOUS_LES_SUJETS

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
    # **Ce qui part au modèle, en anglais** (E10). Vide est une valeur : le
    # produit ne traduit pas le nom qu'on vient de taper, et le nom part alors
    # tel quel comme avant E10.
    consigne: str = ""
    projet: str | None = None


class CorpsReglagePose(BaseModel):
    """Renommer une pose, corriger ce qu'elle dit, ou changer ce qu'elle
    demande. `None` ne touche pas.

    **L'identifiant ne bouge jamais** : les images déjà faites le portent, et
    renommer une pose ne doit pas leur faire perdre leur case (US-118).
    """

    nom: str | None = None
    images: int | None = Field(None, ge=1, le=64)
    consigne: str | None = None
    projet: str | None = None


# ── Les directions du jeu (E10) ──────────────────────────────────────────────


class CorpsDirection(BaseModel):
    """Une direction de plus dans ce jeu. Le nom suffit à la créer."""

    nom: str = Field(min_length=1)
    consigne: str = ""
    projet: str | None = None


class CorpsReglageDirection(BaseModel):
    """Renommer une direction, ou corriger ce qu'elle dit au modèle.

    **L'identifiant ne bouge jamais**, pour la raison des poses : les images
    faites le portent, et renommer « sud » ne doit pas leur faire perdre leur
    case.
    """

    nom: str | None = None
    consigne: str | None = None
    # La phrase en tête d'une animation (18 septembre 2026). Vide la remet à
    # celle que le produit livre pour cette direction.
    animation: str | None = None
    projet: str | None = None


class CorpsRangementDirection(BaseModel):
    """Ranger — ou déranger — une direction, **à l'une des deux portées**.

    Sans `personnage`, la direction se range sur la pose et vaut là où la pose
    est déclarée : une mort n'a qu'un angle, pour tout le monde. Avec, elle ne
    vaut que pour cette chose : le dragon n'attaque que vers le sud.
    """

    rangee: bool
    personnage: str | None = None
    projet: str | None = None


class CorpsPersonnage(BaseModel):
    """Un nom, une description, et rien d'autre (US-115).

    **Il n'y a pas de prompt ici, et c'est un invariant de la tranche** : le
    corps naît dans l'atelier et nulle part ailleurs. Ce que cette route crée,
    c'est une colonne de cases vides.
    """

    nom: str = Field(min_length=1)
    description: str = ""
    # **La famille où on l'a nommée** (E15) : c'est le type qui la porte, et le
    # produit pose donc le premier type de cette famille-là. Vide, la chose n'a
    # pas de type et suit le plan du jeu — l'état de toutes celles d'avant E9.
    famille: Literal["personnages", "objets", "decors", "interface"] | None = None
    # Ou le type directement, quand l'appelant le connaît — un agent, l'étape de
    # l'assistant. Il l'emporte sur la famille, qui n'est qu'une façon de le
    # choisir sans le nommer.
    type: str | None = None
    objectif: dict[str, Any] | None = None
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
    # **Les textes qu'elle écrit pour elle seule** (E12). Un texte vidé rend la
    # case au jeu — ou à son ambiance ; un texte éteint écrit un refus. Ce ne
    # sont pas le même geste, et le second se défait d'un clic.
    textes: dict[str, str] | None = None
    eteindre: str | None = None
    rallumer: str | None = None
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


class CorpsProjetSeul(BaseModel):
    """Un geste qui ne demande rien d'autre que sur quel jeu il porte."""

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
    # **Le personnage qui la porte, quand elle naît de sa fiche** (B19). Vide,
    # elle ne porte personne — et c'est le défaut, pas un oubli.
    porteur: str = ""
    projet: str | None = None


class CorpsReglagePiece(BaseModel):
    """Tout ce qui se règle sur une pièce, en un geste. `None` ne touche pas.

    **Les emplois n'y sont pas**, et c'est délibéré (B19) : ils ont leurs trois
    gestes à eux, sous `/characters/pieces/{identifiant}/uses`. Les faire entrer
    ici aurait mis « renommer une pièce » et « retirer un porteur » dans le même
    appel, avec le même `None` qui ne touche à rien — et une liste envoyée
    entière est un remplacement, pas un réglage.
    """

    nom: str | None = None
    description: str | None = None
    emplacement: str | None = None
    portee: Literal["contenue", "agrandit"] | None = None
    concept_arts: list[str] | None = None
    references: list[str] | None = None
    projet: str | None = None


class CorpsEmploi(BaseModel):
    """Une façon dont une pièce sert (B19).

    `genre` porte les noms du domaine — comme `portee` juste au-dessus, et pour
    la même raison : une valeur traduite au passage du port est une valeur qu'on
    peut traduire de travers.
    """

    genre: Literal["porte", "a-part", "mise-en-scene"] = "porte"
    # **Obligatoire pour `porte`, refusé pour les deux autres** — le service le
    # dit, avec le nom du personnage dans le refus.
    porteur: str = ""
    nom: str = ""
    emplacement: str = ""
    devant: bool = True
    description: str = ""
    projet: str | None = None


class CorpsReglageEmploi(BaseModel):
    """Ce qui se règle sur un emploi. `None` ne touche pas.

    **Le porteur n'y est pas** : ses calques sont rangés sous lui, et les
    déplacer en changeant un champ les laisserait derrière. Se tromper de
    porteur se répare en retirant l'emploi et en en créant un autre.
    """

    nom: str | None = None
    emplacement: str | None = None
    devant: bool | None = None
    description: str | None = None
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
    jamais, et « chaque couche s'annule » (`docs/archive/plan-versions-tenues.md`, C4) demande un geste,
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
    # **Sous quel angle cette image montre sa pose** (E10). `None` ne touche pas
    # — désigner la case et confirmer la direction sont deux gestes qu'un même
    # écran fait séparément, et un `None` traité comme un vide effacerait la
    # direction à chaque désignation. C'est le motif payé trois fois
    # (`docs/PIEGES.md`).
    direction: str | None = None
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
    pose = atelier.production.ajouter_pose(
        projet, corps.nom, corps.images, corps.consigne
    )
    return _avec_plan(atelier, projet, pose)


@routeur.put("/characters/poses/{pose}")
async def regler_pose(
    requete: Request, pose: str, corps: CorpsReglagePose
) -> dict[str, Any]:
    """Renommer une pose, ou changer le nombre d'images qu'elle demande."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    reglee = atelier.production.regler_pose(
        projet, pose, nom=corps.nom, images=corps.images, consigne=corps.consigne
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


# ── Les directions du jeu (E10) ──────────────────────────────────────────────
#
# **Déclarées avant `/characters/{identifiant}`**, comme la vitrine du monde et
# les types : un chemin fixe qui vient après un chemin à segment libre n'est
# jamais atteint, et FastAPI ne le signale pas — il répond simplement « aucune
# chose du jeu nommée *directions* » (`docs/PIEGES.md`).


@routeur.get("/characters/directions")
async def directions(
    requete: Request, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Les directions de ce jeu, et **d'où la liste lui vient** — lue dans la vue
    du jeu, ou écrite ici."""
    atelier = _atelier(requete)
    return atelier.production.directions(_projet(requete, projet))


@routeur.post("/characters/directions", status_code=201)
async def ajouter_direction(
    requete: Request, corps: CorpsDirection
) -> dict[str, Any]:
    """Une direction de plus. **Nommer, c'est créer**, et rien ne coûte : une
    case vide paraît chez toute chose qui tient une pose, sans qu'un seul fichier
    de personnage soit écrit."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    atelier.production.ajouter_direction(projet, corps.nom, corps.consigne)
    return atelier.production.directions(projet)


@routeur.post("/characters/directions/reset")
async def oublier_les_directions(
    requete: Request, projet: str | None = Query(None)
) -> dict[str, Any]:
    """La liste **revient à ce que la vue du jeu propose**.

    Un `POST` et non un `DELETE` : ce geste n'efface pas des directions, il rend
    la liste à sa source. Le `DELETE` de ce chemin voudrait dire « ce jeu n'a
    plus de direction du tout », qui est une autre décision et se prend en les
    retirant une par une.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    atelier.production.oublier_les_directions(vise)
    return atelier.production.directions(vise)


@routeur.get("/characters/directions/proposal")
async def proposition_de_baisse(
    requete: Request, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Ce que déclarer des directions coûterait, et ce que le produit propose —
    **avec la raison écrite et les deux chiffres**."""
    atelier = _atelier(requete)
    return atelier.production.proposition_de_baisse(_projet(requete, projet))


@routeur.post("/characters/directions/proposal")
async def baisser_les_images(
    requete: Request, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Ramener à une image les poses que la proposition nomme."""
    atelier = _atelier(requete)
    return atelier.production.baisser_les_images(_projet(requete, projet))


@routeur.delete("/characters/directions/proposal")
async def defaire_la_baisse(
    requete: Request, projet: str | None = Query(None)
) -> dict[str, Any]:
    """**Le clic qui défait** : chaque pose retrouve ce qu'elle demandait."""
    atelier = _atelier(requete)
    return atelier.production.defaire_la_baisse(_projet(requete, projet))


@routeur.put("/characters/directions/{direction}")
async def regler_direction(
    requete: Request, direction: str, corps: CorpsReglageDirection
) -> dict[str, Any]:
    """Renommer une direction, ou corriger ce qu'elle dit au modèle — **et le
    corriger une seule fois**, pour toutes les poses du jeu."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    atelier.production.regler_direction(
        projet,
        direction,
        nom=corps.nom,
        consigne=corps.consigne,
        animation=corps.animation,
    )
    return atelier.production.directions(projet)


@routeur.delete("/characters/directions/{direction}")
async def retirer_direction(
    requete: Request, direction: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Une direction quitte le jeu. **Les images faites restent** — jamais de
    cascade, et elles gardent son identifiant."""
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    atelier.production.retirer_direction(vise, direction)
    return atelier.production.directions(vise)


@routeur.put("/characters/poses/{pose}/directions/{direction}")
async def ranger_direction(
    requete: Request, pose: str, direction: str, corps: CorpsRangementDirection
) -> dict[str, Any]:
    """Ranger une direction pour une pose — **du jeu entier, ou d'une chose**.

    La réponse dit la **portée réellement atteinte** plutôt que celle qu'on
    croyait viser : depuis E9 une pose est déclarée soit dans le plan du jeu,
    soit dans la liste d'un type, et le produit écrit à sa source plutôt que de
    promettre plus large qu'il ne peut tenir.
    """
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    return atelier.production.ranger_direction(
        projet, pose, direction, rangee=corps.rangee, personnage=corps.personnage
    )


# ── Le calibrage (E17) ───────────────────────────────────────────────────────
#
# **Rien ici ne coûte un centime.** Le calibrage change le rendu de poses qui
# existent déjà, et un rendu est un cache : on recalcule, on ne repaie pas.


class CorpsCalage(BaseModel):
    """La reprise à la main d'une pose. `None` ne touche pas.

    Deux réglages et deux seulement : l'occupation, qui est la taille, et le
    décalage horizontal, qui est la dérive. Le second est écrit **par le
    calibrage seul** — jamais à la main dans la table grille, jamais dans une
    recette nommée.
    """

    # **Le plafond n'est plus 100 %** (tranche des tailles) : un géant se calibre
    # comme un personnage, à son échelle. Borne large ici, refus exact au service.
    occupation: int | None = Field(None, ge=1, le=OCCUPATION_MAX_ABSOLU)
    decalage: int | None = None
    projet: str | None = None


class CorpsMiseDeCote(BaseModel):
    """Sortir une pose du calage commun, ou l'y faire rentrer.

    **Sa case existe toujours** : elle se remplit, elle se compte, elle part au
    jeu. Seul le calage commun l'ignore.
    """

    de_cote: bool
    projet: str | None = None


@routeur.get("/characters/{identifiant}/sheet")
async def planche(
    requete: Request,
    identifiant: str,
    pose: str,
    projet: str | None = Query(None),
) -> dict[str, Any]:
    """Ce que la planche de cette pose enverrait, et ce qu'elle coûterait (E13).

    **Une lecture, et elle ne facture rien.** Elle compose pourtant ses cases par
    le chemin de l'envoi — c'est ce qui rend vraie la règle *ce qui est montré
    est ce qui part* — et refuse donc exactement ce que la soumission refuserait :
    une pose que la chose ne tient plus, une direction qu'elle ne tient pas pour
    cette pose.
    """
    atelier = _atelier(requete)
    return atelier.planche.planche(_projet(requete, projet), identifiant, pose)


@routeur.get("/characters/{identifiant}/calibration")
async def calibrage(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Toutes les poses d'une chose, leur boîte, et la hauteur commune proposée."""
    atelier = _atelier(requete)
    return atelier.calibrage.calibrage(_projet(requete, projet), identifiant)


@routeur.post("/characters/{identifiant}/calibration")
async def calibrer(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Poser la hauteur commune sur toutes les poses retenues.

    **Un point de départ, pas un verdict** : chaque pose se reprend ensuite
    seule, avec le résultat sous les yeux.
    """
    atelier = _atelier(requete)
    return atelier.calibrage.calibrer(_projet(requete, projet), identifiant)


@routeur.put("/characters/{identifiant}/calibration/{pose}")
async def regler_le_calage(
    requete: Request, identifiant: str, pose: str, corps: CorpsCalage
) -> dict[str, Any]:
    """La reprise à la main, pose par pose."""
    atelier = _atelier(requete)
    return atelier.calibrage.regler(
        _projet(requete, corps.projet),
        identifiant,
        pose,
        occupation=corps.occupation,
        decalage=corps.decalage,
    )


@routeur.put("/characters/{identifiant}/calibration/{pose}/aside")
async def mettre_de_cote(
    requete: Request, identifiant: str, pose: str, corps: CorpsMiseDeCote
) -> dict[str, Any]:
    """Sortir une pose du calage commun, ou l'y faire rentrer."""
    atelier = _atelier(requete)
    return atelier.calibrage.mettre_de_cote(
        _projet(requete, corps.projet), identifiant, pose, corps.de_cote
    )


# ── La fiche d'une chose du jeu (E12) ────────────────────────────────────────
#
# **Aucune de ces routes ne touche le fournisseur.** Régler, ranger, désigner une
# référence — rien de tout ça n'appelle personne, et c'est pour ça que la barre
# qui paie se retire quand la fiche s'ouvre. Le produit tient une règle depuis le
# début : il n'existe qu'un seul endroit d'où l'on paie.


class CorpsPromotion(BaseModel):
    """Une image fabriquée devient — ou cesse d'être — une référence permanente.

    **Rien n'est copié** : c'est l'identifiant de l'asset qui est retenu, et
    l'image reste où elle est.
    """

    asset: str = Field(min_length=1)
    promue: bool = True
    projet: str | None = None
    # **Ce qu'elle montre, et donc quand elle part** (RS1) : `libre`,
    # `planche` ou `direction:<id>`. Absent, l'usage en place est gardé — une
    # promotion d'avant la tranche ne change pas de sens parce qu'on la répète.
    # Une direction que le sujet ne tient pas est refusée.
    usage: str | None = None


class CorpsImageDeReference(BaseModel):
    """L'image de référence d'une fiche — **une seule route, `null` la retire**
    (RP19).

    Poser et retirer sont le même geste, et deux routes qui font l'une le
    contraire de l'autre finissent par ne plus se contredire qu'à moitié.
    """

    asset: str | None = None
    projet: str | None = None


@routeur.get("/characters/{identifiant}/style")
async def habillage(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Les sept textes qui habillent cette chose, **et d'où chacun vient**.

    Cinq origines — du jeu, son ambiance, écrit ici, éteint, verrouillé —, et le
    texte que chacun remplace, montré barré en dessous. Un résumé ne dit pas ce
    qui part : la ligne « hérité de la bible » de l'établi cachait sept textes.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    return atelier.production.habillage(vise, identifiant)


@routeur.get("/characters/{identifiant}/references")
async def references_de(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Ses images de référence — **ce qui est disponible, pas ce qui part**.

    Ce qui part vraiment se coche juste avant de payer. C'est ici que les images
    de référence d'une chose *existent* : on en promeut une, on en écarte une, et
    ça vaut pour toutes ses générations à venir.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    return atelier.production.references_de(vise, identifiant)


@routeur.put("/characters/{identifiant}/references")
async def promouvoir_reference(
    requete: Request, identifiant: str, corps: CorpsPromotion
) -> dict[str, Any]:
    """Promouvoir une image fabriquée en référence permanente — ou la dépromouvoir.

    **Elle repart avec chaque appel suivant**, et c'est ce qui fait qu'un
    personnage se ressemble d'une pose à l'autre. Dix-sept appels payés sur
    vingt-huit étaient partis sans une seule image de référence.

    **Son usage se règle par la même route** (RS1) — `usage` dans le corps.
    Ranger une image en planche ou dans une direction, c'est encore la
    promouvoir, avec une précision de plus ; une seconde route aurait fait deux
    gestes pour une même liste.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, corps.projet)
    personnage = atelier.production.promouvoir_reference(
        vise, identifiant, corps.asset, corps.promue, corps.usage
    )
    return {
        "personnage": atelier.production.en_charge(vise, personnage),
        "references": atelier.production.references_de(vise, identifiant),
    }


class CorpsOrdreDesVues(BaseModel):
    """L'ordre des vues de la planche — **une seule route, `null` l'efface**
    (RS8). Une direction par vue, de gauche à droite puis de haut en bas."""

    asset: str = Field(min_length=1)
    ordre: list[str] | None = None
    projet: str | None = None


@routeur.put("/characters/{identifiant}/references/view-order")
async def poser_ordre_des_vues(
    requete: Request, identifiant: str, corps: CorpsOrdreDesVues
) -> dict[str, Any]:
    """Dire, une fois pour toutes, quelle direction montre chaque vue de la
    planche de ce sujet (RS8).

    La découpe à l'arrivée d'une planche refaite range alors la n-ième image
    dans la n-ième direction — la position décide, aucun modèle ne regarde
    l'image. Refusé (409) : une image qui n'est pas sa planche, une direction
    qu'il ne tient pas, une direction nommée deux fois.

    **Trois segments**, sous `references` : l'ordre est une précision de la
    planche, comme l'usage en est une de la promotion.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, corps.projet)
    personnage = atelier.production.poser_ordre_des_vues(
        vise, identifiant, corps.asset, corps.ordre
    )
    return {
        "personnage": atelier.production.en_charge(vise, personnage),
        "references": atelier.production.references_de(vise, identifiant),
    }


@routeur.put("/characters/{identifiant}/reference-image")
async def poser_image_de_reference(
    requete: Request, identifiant: str, corps: CorpsImageDeReference
) -> dict[str, Any]:
    """Choisir l'image de référence de la fiche d'un sujet — `asset: null` la retire.

    **C'est un portrait, et rien d'autre** : aucun artwork n'est promu, aucune
    case n'est retenue, le fournisseur n'est jamais appelé. Une image qui n'est
    pas une image fixe de ce sujet est refusée avec sa raison.

    La réponse porte le sujet **entier** — même forme que toutes les autres
    routes qui le rendent (`docs/PIEGES.md`) — et l'image de référence
    **résolue**, qui est le repli quand le choix ne désigne plus rien.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, corps.projet)
    personnage = atelier.production.poser_image_de_reference(
        vise, identifiant, corps.asset
    )
    return {
        "personnage": atelier.production.en_charge(vise, personnage),
        "image_de_reference": atelier.production.image_de_reference(vise, personnage),
    }


class CorpsRecetteDuSujet(BaseModel):
    """La recette de ses images — **une seule route, `null` la retire** (RS6)."""

    recette: str | None = None
    projet: str | None = None


@routeur.put("/characters/{identifiant}/recipe")
async def poser_recette_du_sujet(
    requete: Request, identifiant: str, corps: CorpsRecetteDuSujet
) -> dict[str, Any]:
    """Choisir la recette nommée que reçoivent ses images à naître.

    Elle remplace la recette du jeu pour chaque image faite pour ce sujet —
    génération comme découpe. Une image déjà née ne change pas. Un nom
    inconnu est refusé (409), avec la liste des recettes nommées.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, corps.projet)
    personnage = atelier.production.poser_recette_du_sujet(
        vise, identifiant, corps.recette
    )
    return {"personnage": atelier.production.en_charge(vise, personnage)}


@routeur.get("/characters/showcase")
async def vitrine_du_monde(
    requete: Request, projet: str | None = Query(None)
) -> dict[str, Any]:
    """La vitrine du **monde entier** — une image par chose du jeu.

    Trois nains côte à côte disent tout de suite s'ils viennent du même monde.
    C'est le même écran et les mêmes réglages qu'une chose seule : la vitrine
    montre ce qu'on regardait quand on l'a ouverte, et rien n'est défini deux
    fois.

    **Déclarée avant `/characters/{identifiant}/showcase`**, et ce n'est pas
    cosmétique : FastAPI essaie ses routes dans l'ordre, et `showcase` ne doit
    pas être pris pour un identifiant de chose.
    """
    atelier = _atelier(requete)
    return atelier.production.vitrine(_projet(requete, projet))


@routeur.get("/characters/{identifiant}/showcase")
async def vitrine(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """De quoi regarder une chose finie : les fonds du projet, et la taille commune.

    **La vitrine ne fabrique rien, ne modifie rien, ne coûte rien.** Elle marque
    ce qu'elle voit — une taille en écart —, et une marque n'est pas un compte :
    les jauges restent celles du codex.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    return atelier.production.vitrine(vise, identifiant)


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


@routeur.get("/characters/search")
async def rechercher_personnages(
    requete: Request,
    recherche: str = Query(""),
    projet: str | None = Query(None),
    limite: int = Query(200, ge=1, le=1000),
) -> dict[str, Any]:
    """Les sujets d'un projet dont le nom ou la description répondent (B8.5).

    **Deux segments, et c'est sans risque ici** — pas de conflit possible avec
    `/characters/{identifiant}`, qui n'existe qu'en `PUT` et `DELETE` : aucune
    route `GET` à deux segments ne peut lui être prise pour un identifiant.

    Sur l'index de `B8.3`, pas sur le disque : c'est la seule des deux
    lectures de sujets à l'être, et c'est voulu — chercher parmi des centaines
    de sujets en rouvrant un fichier par sujet à chaque frappe est
    exactement ce que la table jetable existe pour éviter.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    trouves = atelier.production.rechercher_personnages(vise, recherche, limite)
    return {"personnages": [p.en_json() for p in trouves]}


@routeur.get("/characters/families/{famille}")
async def grille_de_famille(
    requete: Request,
    famille: str,
    recherche: str = Query(""),
    filtre: str = Query(TOUS_LES_SUJETS),
    collection: str = Query(""),
    projet: str | None = Query(None),
    limite: int = Query(120, ge=1, le=1000),
    tri: str = Query(""),
) -> dict[str, Any]:
    """La grille d'une famille, paginée — chaque sujet porte déjà son compte
    de complétude (B9.1) et ses collections (B9.3).

    **Trois segments, sans risque de collision** — comme `/characters/search` :
    `/characters/{identifiant}` n'existe qu'en `PUT` et `DELETE`, et aucune
    route `GET` à plusieurs segments ne peut lui être prise pour un identifiant.

    `limite` grandit d'un appel à l'autre côté écran (« Charger la suite »,
    B3) ; `total` est le compte de la famille entière, filtre de recherche
    compris, pour que l'écran sache combien il en reste à charger.

    **Les collections sont jointes ici, pas dans `ServiceProduction`** : c'est
    une question du carnet (B8), posée à côté d'une question de production
    (B9.1), et la route est le seul endroit qui a besoin des deux à la fois.

    **`groupes` est la liste des collections où l'on peut ranger**, avec ce que
    chacune contient **de ce jeu-ci** (B9.5). Elle n'est pas déductible de la
    page : une collection vide n'apparaît sur la carte d'aucun sujet, et
    resterait donc invisible comme cible de dépôt — or c'est justement celle
    qu'on veut remplir. Le filtre `projet is None or projet == jeu` est celui
    que l'arbre de la galerie appliquait déjà avant de partir avec `RP1`
    (13 septembre 2026) : une seule règle pour dire *les collections de ce jeu*.

    **`collection` restreint la grille à un groupe** — la ligne qu'on ouvre sous
    une famille dans le carnet. C'est ici que les deux questions se rejoignent une
    troisième fois : le carnet sait lire un groupe, la production sait répartir
    une famille, et la route passe à la seconde les identifiants que la première a
    résolus. **Une collection inconnue rend une grille vide plutôt qu'un refus** :
    un groupe supprimé pendant qu'on le regardait ne doit pas casser l'écran, il
    doit se vider — et la ligne du carnet aura disparu avec lui.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    seulement: set[str] | None = None
    if collection:
        groupe = next(
            (c for c in atelier.bibliotheque.collections() if c.identifiant == collection),
            None,
        )
        seulement = set(groupe.sujets_du_jeu(vise)) if groupe else set()
    page = atelier.production.famille(
        vise,
        famille,
        recherche=recherche,
        limite=limite,
        filtre=filtre,
        seulement=seulement,
        tri=tri,
    )
    identifiants = [p.identifiant for p in page["personnages"]]
    collections = atelier.base.collections_par_sujet(vise, identifiants)
    vignettes = atelier.base.vignettes_par_personnage(vise, identifiants)
    comptes = page["comptes"]
    combien = atelier.base.compter_par_collection(vise)
    return {
        "personnages": [
            {
                **p.en_json(),
                "compte": comptes[p.identifiant],
                "collections": collections[p.identifiant],
                # `null` plutôt qu'une clé absente : la carte doit pouvoir dire
                # « aucune image » sans confondre ce cas avec un champ qu'un
                # serveur plus vieux n'enverrait pas.
                "vignette": (
                    None
                    if p.identifiant not in vignettes
                    else {
                        "identifiant": vignettes[p.identifiant].identifiant,
                        # L'empreinte n'est que le cassage de cache de l'adresse
                        # (elle nomme la recette rendue) : absente, la vignette
                        # se sert quand même.
                        "empreinte": vignettes[p.identifiant].empreinte or "",
                    }
                ),
            }
            for p in page["personnages"]
        ],
        "groupes": [
            {
                "identifiant": groupe.identifiant,
                "nom": groupe.nom,
                "sujets": combien.get(groupe.identifiant, 0),
            }
            for groupe in atelier.bibliotheque.collections()
            if groupe.projet is None or groupe.projet == vise
        ],
        "filtres": page["filtres"],
        "total": page["total"],
    }


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


@routeur.get("/dashboard")
async def bilan_du_jeu(requete: Request, projet: str | None = Query(None)) -> dict[str, Any]:
    """B5 — la complétude par famille, ce qui manque le plus, et le prix du lot.

    **Compté ici, jamais dans `TableauDeBord.tsx`** : l'écran ne tient qu'une
    page de personnages, filtrée sur autre chose, et sommer dessus dirait un
    chiffre faux dès qu'un jeu en a plus qu'une page — la même garde que
    `GET /library` pour l'arbre de la bibliothèque.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    return atelier.production.bilan_du_jeu(vise, atelier.generations)


@routeur.post("/characters", status_code=201)
async def creer_personnage(requete: Request, corps: CorpsPersonnage) -> dict[str, Any]:
    """Un personnage de plus dans le projet (US-115). Ne coûte rien, ne sort pas."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    personnage = atelier.production.creer_personnage(
        projet,
        corps.nom,
        corps.description,
        famille=corps.famille or "",
        type=corps.type or "",
        objectif=corps.objectif,
    )
    # **La forme complète, comme l'annonce du flux.** L'écran fond ce qui lui
    # arrive par les deux chemins avec le même code : une charge amputée de ses
    # cases y remplacerait un objet entier par un objet à trous.
    return {"personnage": atelier.production.en_charge(projet, personnage)}


class CorpsObjectifPersonnage(BaseModel):
    objectif: dict[str, Any]
    projet: str | None = None


@routeur.get("/characters/{identifiant}/objective")
async def objectif_personnage(
    requete: Request, identifiant: str, projet: str | None = Query(None),
) -> dict[str, Any]:
    return _atelier(requete).production.objectif_de(_projet(requete, projet), identifiant)


@routeur.put("/characters/{identifiant}/objective")
async def definir_objectif_personnage(
    requete: Request, identifiant: str, corps: CorpsObjectifPersonnage,
) -> dict[str, Any]:
    return _atelier(requete).production.definir_objectif(
        _projet(requete, corps.projet), identifiant, corps.objectif,
    )


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
        textes=corps.textes,
        eteindre=corps.eteindre,
        rallumer=corps.rallumer,
    )
    return {"personnage": atelier.production.en_charge(projet, personnage)}


@routeur.get("/characters/{identifiant}/unplaced")
async def en_attente(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Ce qui est à ce sujet sans occuper de case — images et clips (`AU20`).

    **Après `/characters/{identifiant}` dans ce fichier n'aurait rien changé** :
    le segment `unplaced` est en troisième position, donc aucune route à deux
    segments ne se le dispute. C'est la même prudence que pour `slots`, écrite
    ici pour qu'on n'ait pas à la redécouvrir.
    """
    atelier = _atelier(requete)
    return atelier.production.en_attente(_projet(requete, projet), identifiant)


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
        direction=corps.direction,
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


@routeur.post("/characters/slots/suggested", status_code=201)
async def poser_les_emplacements_proposes(
    requete: Request, corps: CorpsProjetSeul
) -> dict[str, Any]:
    """Poser d'un geste les six emplacements que l'atelier propose.

    **Avant `/characters/slots/{identifiant}` dans ce fichier, et il faut que ça
    le reste** : `suggested` serait sinon lu comme un identifiant par la route
    qui suit, et laquelle gagne dépendrait de l'ordre des fonctions
    (`docs/PIEGES.md`).

    **Le vestiaire naît toujours vide** ; ceci est un geste, pas un effet de
    bord. Rappelée deux fois, elle n'ajoute que ce qui manque.
    """
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    atelier.equipement.poser_les_proposes(projet)
    return atelier.equipement.vestiaire(projet)


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


@routeur.get("/characters/pieces/uses")
async def emplois_du_jeu(
    requete: Request, projet: str | None = Query(None)
) -> dict[str, Any]:
    """**Le vestiaire résolu du jeu** — les pièces, leurs emplois, leurs comptes.

    **Avant `/characters/pieces/{identifiant}` dans ce fichier, et il faut que ça
    le reste** : `uses` serait sinon lu comme un identifiant de pièce, et
    laquelle des deux gagne dépendrait de l'ordre des fonctions
    (`docs/PIEGES.md`). Même piège que `slots/suggested`.

    **Séparée de `/characters`, qui porte déjà le vestiaire** (B19). Celle-là
    rend le fichier du projet et rien d'autre ; celle-ci lit les images, parce
    que c'est le seul moyen de savoir qui porte une pièce qui n'a jamais rien
    déclaré — toutes celles d'avant cette tranche. Les fondre aurait fait payer
    ce balayage à chaque renommage de pièce.
    """
    atelier = _atelier(requete)
    return atelier.equipement.vestiaire_du_jeu(_projet(requete, projet))


@routeur.get("/characters/pieces/{identifiant}/animations/{porteur}")
async def calques_animes_de_lemploi(
    requete: Request,
    identifiant: str,
    porteur: str,
    projet: str | None = Query(None),
) -> dict[str, Any]:
    """**Ses animations, image par image** — la matrice d'un emploi (B20).

    Une rangée par pose **et par direction**, ce que la matrice des images ne
    peut pas faire : un calque n'a pas de direction, une bande en a une. C'est
    la bande qui porte l'axe, et le calque de la pose se repose sur les quatre.

    **Le compte n'est pas celui des rangées.** Une case sans animation du
    personnage ne compte pas comme un manque — il n'y a rien à habiller, et
    aucun clic ne le changerait.

    Rien ici ne dépense et rien n'appelle un fournisseur : tout ce qu'elle
    montre est sur le disque, et le recalage tourne sur la machine.
    """
    atelier = _atelier(requete)
    return atelier.calques_animes.matrice(
        _projet(requete, projet), identifiant, porteur
    )


@routeur.get("/characters/pieces/{identifiant}/wearers")
async def portee_de_la_piece(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """**Sur quels personnages cette pièce est posée** (E15, US-284).

    Une pièce n'a pas d'image à elle — le produit interdit de générer un casque
    sur fond vide, parce qu'un casque n'existe qu'apparu sur un corps. Son
    établi montre donc ce qui la porte, et ce qui manque se lit comme partout
    ailleurs : *posée sur 1 personnage sur 3*.
    """
    atelier = _atelier(requete)
    return atelier.production.portee_de_la_piece(
        _projet(requete, projet), identifiant
    )


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
        porteur=corps.porteur,
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
        references=corps.references,
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


# ── Les emplois d'une pièce (B19) ────────────────────────────────────────────
#
# **Quatre segments, sous la pièce qui les porte**, et jamais sous le
# personnage : un emploi appartient à la pièce, et le personnage n'a pas gagné
# de champ de vestiaire dans cette tranche. Les trois gestes rendent le vestiaire
# résolu entier, comme les six d'au-dessus rendent le vestiaire du fichier — un
# écran qui vient d'ajouter un porteur voit du même coup le compte de ce qui lui
# manque, sans second aller-retour.


def _avec_emplois(
    atelier: Atelier, projet: str, emploi: Any
) -> dict[str, Any]:
    return {
        "emploi": emploi.en_json(),
        **atelier.equipement.vestiaire_du_jeu(projet),
    }


@routeur.post("/characters/pieces/{identifiant}/uses", status_code=201)
async def ajouter_emploi(
    requete: Request, identifiant: str, corps: CorpsEmploi
) -> dict[str, Any]:
    """Une façon de plus dont cette pièce sert. **Ne coûte rien, ne sort pas.**

    Un emploi porté attribue la pièce à un personnage : c'est la relation qui
    manquait au modèle, et le seul endroit du produit qui l'écrive.
    """
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    emploi = atelier.equipement.ajouter_emploi(
        projet,
        identifiant,
        genre=corps.genre,
        porteur=corps.porteur,
        nom=corps.nom,
        emplacement=corps.emplacement,
        devant=corps.devant,
        description=corps.description,
    )
    return _avec_emplois(atelier, projet, emploi)


@routeur.put("/characters/pieces/{identifiant}/uses/{emploi}")
async def regler_emploi(
    requete: Request, identifiant: str, emploi: str, corps: CorpsReglageEmploi
) -> dict[str, Any]:
    """Ce qui se règle sur un emploi, en un seul geste — **jamais son porteur**."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    regle = atelier.equipement.regler_emploi(
        projet,
        identifiant,
        emploi,
        nom=corps.nom,
        emplacement=corps.emplacement,
        devant=corps.devant,
        description=corps.description,
    )
    return _avec_emplois(atelier, projet, regle)


@routeur.delete("/characters/pieces/{identifiant}/uses/{emploi}")
async def retirer_emploi(
    requete: Request,
    identifiant: str,
    emploi: str,
    projet: str | None = Query(None),
) -> dict[str, Any]:
    """L'emploi part, **ses images restent** — jamais de cascade.

    Elles restent dans la galerie, détachées, et gardent l'identifiant de la
    pièce comme celui du personnage : remettre l'emploi les remet dans sa
    colonne. Le geste déclare la pièce du même coup, sans quoi le porteur retiré
    reparaîtrait à la relecture suivante, lu sur ces images-là.
    """
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    retire = atelier.equipement.retirer_emploi(vise, identifiant, emploi)
    return _avec_emplois(atelier, vise, retire)


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
    """La chose qu'on arme, et la pièce qu'on lui pose.

    **Les attitudes et les angles n'y sont plus depuis E14.** Le champ ne porte
    que le signalement ; la consigne de l'attitude et celle de la direction sont
    ajoutées par le composeur du prompt, où elles forment leur propre ligne avec
    leur propre origine. Les demander ici aurait laissé croire qu'elles changent
    ce qu'on écrit dans le champ, et l'écran de confirmation aurait dû deviner où
    finit le signalement et où commence la pose.
    """

    personnage: str
    piece: str | None = None
    projet: str | None = None


@routeur.post("/characters/subject")
async def sujet(requete: Request, corps: CorpsSujet) -> dict[str, Any]:
    """Le sujet que cette case demande au modèle (US-115, C2, C3).

    **Ni la bible, ni la consigne de l'attitude, ni les consignes de planche** :
    c'est l'écran de confirmation qui montre le texte entier ligne par ligne.
    Ici on rend ce qui va dans le champ, c'est-à-dire ce que l'auteur pourra
    corriger avant de payer.

    `POST` et non `GET` : rien n'est écrit — c'est une lecture, comme l'aperçu
    du prompt — mais le corps porte des identifiants qu'on ne met pas dans une
    adresse.
    """
    return {
        "sujet": _atelier(requete).production.sujet(
            _projet(requete, corps.projet),
            corps.personnage,
            piece=corps.piece,
        )
    }


# ── La sortie ────────────────────────────────────────────────────────────────


# ⚠️ **`POST /characters/{identifiant}/export` est retirée** (`RP17`, 16
# septembre 2026). C5 l'avait écrite pour poser un personnage complet dans le
# dossier du jeu ; B21 a construit à côté d'elle une sortie qui montre ses
# fichiers avant de les écrire et les compare à la fois d'avant, sans jamais
# retirer la première. Deux portes vers le même dossier, dont une sans filet.
#
# Ce qu'elle savait faire est un réglage de l'autre : `POST /api/output` avec
# `sujet`, précédé de `POST /api/output/preview` qui ne touche rien.


class CorpsAnimations(BaseModel):
    """De qui l'on sort les animations. **Pas de dossier** : celles-ci reviennent
    au navigateur en archive, elles ne se posent pas sur la machine."""

    projet: str | None = None


@routeur.post("/characters/{identifiant}/strips/export")
async def sortir_les_animations(
    requete: Request, identifiant: str, corps: CorpsAnimations
) -> Response:
    """Toutes les animations d'un personnage, en une seule archive (A4).

    **Une archive, et pas le dossier du jeu**, alors que la route juste
    au-dessus fait l'inverse. Ce n'est pas une incohérence : ce que la tranche
    demande est *une seule archive*, et poser en plus les fichiers dans le
    dossier du jeu serait une seconde sortie que personne n'a demandée. Le jour
    où on la voudra, elle s'écrira comme celle du dessus — avec le même
    descriptif, par le même code.

    **Ici, à côté de l'autre sortie du personnage**, plutôt qu'avec les routes
    des bandes : c'est là qu'on viendra la chercher, parce que c'est un
    personnage qu'on fait sortir.
    """
    return reponse_archive(
        _atelier(requete).export.exporter_bandes_du_personnage(
            _projet(requete, corps.projet), identifiant
        )
    )


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
