"""TU5 : les matières générées sur la machine, pour un jeu de tuiles.

**Et RG5, la bibliothèque des matières** (20 septembre 2026) : deux routes de
plus sur le même préfixe, pour lire et tenir cette bibliothèque-là — voir
`docs/RG5-la-bibliotheque-des-matieres.md`. La génération reste au-dessus,
inchangée ; ce qui s'ajoute ne fait que lire et marquer ce qu'elle a produit.
"""
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field

from atelier.depot import projet_lu_une_fois
from atelier.services.matieres import TIRAGES_MAX, TIRAGES_MIN

routeur = APIRouter(prefix="/projects/{projet}/materials")


def _matiere_json(atelier: Any, asset: Any, fiche: dict[str, Any] | None = None) -> dict[str, Any]:
    """La fiche d'une matière pour la bibliothèque (RG5).

    **Elle n'est pas construite ici** : `ServiceBibliotheque.fiches_de_matieres`
    l'écrit une fois, et `list_materials` (l'agent) la lit au même endroit — les
    dimensions du rendu, le cadrage relu sur la génération d'origine, les
    collections, `detouree` / `refaisable` (RG8). Ne s'ajoute ici que ce qui est
    de l'écran : l'aperçu."""
    if fiche is None:
        fiche = atelier.bibliotheque.fiches_de_matieres([asset])[0]
    return {
        "identifiant": fiche["identifiant"],
        "nom": fiche["nom"],
        "largeur": fiche["largeur"],
        "hauteur": fiche["hauteur"],
        "apercu": f"/api/assets/{asset.identifiant}/image",
        "cadrage": fiche["cadrage"],
        "cree_le": fiche["cree_le"],
        "collections": fiche["collections"],
        "detouree": fiche["detouree"],
        "refaisable": fiche["refaisable"],
    }


@routeur.get("")
def bibliotheque(requete: Request, projet: str) -> dict[str, Any]:
    """La bibliothèque des matières du projet (RG5) — ce que l'écran des
    tuiles lira en RG6, et rien de plus : aucun sujet n'est consulté ici.

    **Et ce que la migration a laissé** (RG8) : `sujets_vides`
    `[{identifiant, nom}]` — les sujets qu'elle a vidés et que l'écran propose de
    jeter, `DELETE /api/characters/{sujet}?projet=` —, `non_migrees`
    `[{identifiant, raison}]` — les images qu'elle a sautées, en français —, et
    `migration_refusee` (une phrase, ou `null`) quand une passe n'a pas pu aller
    au bout. Deux listes vides, et `null`, sur un jeu sans rien à dire."""
    atelier = requete.app.state.atelier
    # D'abord la lecture, qui passe la migration si le jeu n'a pas encore été vu :
    # l'état qu'on rend ensuite est celui de cette passe-là.
    matieres = atelier.bibliotheque.matieres(projet)
    # Le projet n'est lu qu'une fois pour toute la liste : `etat_de_matiere` le
    # relit pour chaque image, et le barème ne bouge pas pendant la réponse.
    with projet_lu_une_fois():
        fiches = atelier.bibliotheque.fiches_de_matieres(matieres)
        return {
            "matieres": [_matiere_json(atelier, m, f) for m, f in zip(matieres, fiches)],
            **atelier.bibliotheque.etat_de_la_migration(projet),
        }


class Declaration(BaseModel):
    model_config = ConfigDict(extra="forbid")
    matiere: bool


@routeur.put("/{asset}")
def declarer(requete: Request, projet: str, asset: str, corps: Declaration) -> dict[str, Any]:
    """Déclarer une image existante matière, ou lui retirer la marque (RG5).

    **Le « en un geste » de RG6** : la marque se pose ou se retire sur
    l'image déjà là, sans qu'un sujet n'entre ni ne sorte de rien."""
    atelier = requete.app.state.atelier
    # **Le projet de l'adresse est celui qu'on vérifie** (RG6) : l'image doit y
    # être rangée, sans quoi la marque paraîtrait dans une autre bibliothèque.
    resultat = atelier.bibliotheque.declarer_matiere(asset, corps.matiere, projet=projet)
    return _matiere_json(atelier, resultat)


@routeur.post("/migrate")
def migrer(requete: Request, projet: str) -> dict[str, Any]:
    """Faire entrer dans la bibliothèque les matières rangées dans un sujet (RG8).

    **Rejouable, et gratuite** : la même passe que l'ouverture du jeu, qui ne change
    pas un octet quand il n'y a rien à migrer. Le rapport dit ce qui a été migré,
    les sujets que la migration a laissés vides — l'écran proposera de les jeter,
    par `DELETE /api/characters/{sujet}?projet=` — et ce qui n'a pas pu l'être. Rien n'est
    jamais effacé ; l'ancien état de chaque image est au journal du jeu."""
    return requete.app.state.atelier.bibliotheque.migrer_matieres(projet)


class Texte(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pierre: str
    motif: str
    cadrage: str


class Apercu(Texte):
    # Une image jointe ne change pas le texte ; elle change la taille annoncée, et
    # l'écran doit pouvoir dire qu'elle part (TU13).
    reference: bool = False


class Generer(Texte):
    tirages: int = Field(default=1, ge=TIRAGES_MIN, le=TIRAGES_MAX)
    graine: int | None = Field(default=None, ge=0)
    # L'identifiant d'une image de la bibliothèque, jamais des octets : c'est la
    # forme de toute référence du produit, et elle se rejoue à la reprise.
    reference_asset: str | None = None


@routeur.get("/availability")
async def disponibilite(requete: Request, projet: str) -> dict[str, Any]:
    return await requete.app.state.atelier.matieres.disponibilite()


# **Après `/availability`, et pas avant** : `/{asset}` prendrait ce mot pour un
# identifiant d'image.
@routeur.get("/{asset}")
def matiere(requete: Request, projet: str, asset: str) -> dict[str, Any]:
    """Une matière du jeu, avec ce que la liste dit d'elle (RG8) — la fiche d'une
    image la relit ici pour savoir si elle a été détourée à tort, sans relire
    toute la bibliothèque."""
    atelier = requete.app.state.atelier
    return _matiere_json(atelier, atelier.bibliotheque.matiere_du_jeu(asset, projet))


@routeur.post("/{asset}/redo")
def refaire(requete: Request, projet: str, asset: str) -> dict[str, Any]:
    """Remettre à une matière détourée la recette que le jeu lui donne (RG8), **à
    partir de son image brute : rien n'est regénéré, rien ne coûte**.

    Jamais lancé tout seul — ni à l'ouverture d'un jeu, ni par la migration : c'est
    l'image de l'auteur, et le geste remplace son rendu. 409 avec sa phrase quand
    ce n'est pas une matière de ce jeu, quand le jeu ne dit pas comment on en fait
    une, ou quand l'image d'origine a disparu (il faut alors la regénérer)."""
    atelier = requete.app.state.atelier
    return _matiere_json(atelier, atelier.bibliotheque.refaire_matiere(asset, projet))


@routeur.post("/preview")
def apercu(requete: Request, projet: str, corps: Apercu) -> dict[str, Any]:
    return requete.app.state.atelier.matieres.apercu(
        corps.pierre, corps.motif, corps.cadrage, reference=corps.reference,
    )


@routeur.post("/generate")
async def generer(requete: Request, projet: str, corps: Generer) -> dict[str, Any]:
    generations = await requete.app.state.atelier.matieres.generer(
        projet, pierre=corps.pierre, motif=corps.motif, cadrage=corps.cadrage,
        tirages=corps.tirages, graine=corps.graine, reference=corps.reference_asset,
    )
    return {"generations": [g.en_json() for g in generations]}
