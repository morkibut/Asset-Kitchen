"""TU5 : les matières générées sur la machine, pour un jeu de tuiles.

**Et RG5, la bibliothèque des matières** (20 septembre 2026) : deux routes de
plus sur le même préfixe, pour lire et tenir cette bibliothèque-là — voir
`docs/RG5-la-bibliotheque-des-matieres.md`. La génération reste au-dessus,
inchangée ; ce qui s'ajoute ne fait que lire et marquer ce qu'elle a produit.
"""
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field

from atelier.services.matieres import TIRAGES_MAX, TIRAGES_MIN

routeur = APIRouter(prefix="/projects/{projet}/materials")


def _matiere_json(atelier: Any, asset: Any) -> dict[str, Any]:
    """La fiche d'une matière pour la bibliothèque (RG5).

    **`cadrage` se relit sur la génération qui l'a fait naître**, jamais sur
    l'asset : c'est elle qui porte `filiation["matiere"]["cadrage"]`
    (`ServiceGenerations.soumettre_matiere`). Une image devenue matière par
    déclaration — `PUT .../materials/{asset}` sur une image ordinaire — n'a
    pas cette filiation, et rend une chaîne vide plutôt qu'une valeur inventée.
    """
    cadrage = ""
    generation = atelier.base.lire(asset.generation)
    if generation is not None:
        filiation = generation.demande.get("filiation") or {}
        cadrage = (filiation.get("matiere") or {}).get("cadrage", "")
    collections = (
        atelier.base.collections_par_sujet(
            asset.projet, [asset.identifiant], genre="matiere"
        ).get(asset.identifiant, [])
        if asset.projet is not None
        else []
    )
    return {
        "identifiant": asset.identifiant,
        "nom": asset.label,
        "largeur": asset.largeur,
        "hauteur": asset.hauteur,
        "apercu": f"/api/assets/{asset.identifiant}/image",
        "cadrage": cadrage,
        "cree_le": asset.cree_le,
        "collections": collections,
    }


@routeur.get("")
def bibliotheque(requete: Request, projet: str) -> dict[str, Any]:
    """La bibliothèque des matières du projet (RG5) — ce que l'écran des
    tuiles lira en RG6, et rien de plus : aucun sujet n'est consulté ici."""
    atelier = requete.app.state.atelier
    matieres = atelier.bibliotheque.matieres(projet)
    return {"matieres": [_matiere_json(atelier, m) for m in matieres]}


class Declaration(BaseModel):
    model_config = ConfigDict(extra="forbid")
    matiere: bool


@routeur.put("/{asset}")
def declarer(requete: Request, projet: str, asset: str, corps: Declaration) -> dict[str, Any]:
    """Déclarer une image existante matière, ou lui retirer la marque (RG5).

    **Le « en un geste » de RG6** : la marque se pose ou se retire sur
    l'image déjà là, sans qu'un sujet n'entre ni ne sorte de rien."""
    atelier = requete.app.state.atelier
    resultat = atelier.bibliotheque.declarer_matiere(asset, corps.matiere)
    return _matiere_json(atelier, resultat)


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
