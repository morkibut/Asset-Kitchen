# -*- coding: utf-8 -*-
"""Les routes de T4 — le tableau d'inspiration et l'univers du projet.

Même règle que les deux autres routeurs : aucune logique ici, chaque route
appelle un service et met en forme. **Chemins en anglais, charges utiles en
français.** Monté sous le même préfixe : de l'extérieur, l'API n'a pas de
couture.

Un troisième module parce qu'il répond à une troisième question. `routes.py`
dit *comment on fabrique une image*, `bibliotheque.py` *où elle se range*,
celui-ci *ce qui la contraint avant même qu'elle existe*.

**Une seule de ces routes touche le réseau** — celle qui va chercher l'image
d'une adresse collée. Toutes les autres marchent réseau coupé, tableau et bible
compris, et c'est un critère d'acceptation de la tranche.
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from atelier.image import rendre_en_png
from atelier.services import Atelier

routeur = APIRouter()


def _atelier(requete: Request) -> Atelier:
    return requete.app.state.atelier


def _projet(requete: Request, projet: str | None) -> str:
    """Le projet visé — celui qu'on nomme, sinon celui qui est ouvert.

    Le défaut est ici et non dans le service parce qu'il n'a de sens que pour
    une façade : un agent MCP en T7 nommera toujours son projet, et le service
    doit pouvoir refuser un projet manquant plutôt que d'en inventer un.
    """
    return projet or _atelier(requete).bibliotheque.courant or ""


# ── Ce que l'écran envoie ────────────────────────────────────────────────────


class CorpsAdresse(BaseModel):
    adresse: str = Field(min_length=1)
    projet: str | None = None


class CorpsTexte(BaseModel):
    texte: str = Field(min_length=1)
    projet: str | None = None


class CorpsReglage(BaseModel):
    """Les trois réglages d'une carte, en un seul geste : ils se remplissent
    ensemble à l'écran, et trois appels feraient trois allers-retours."""

    groupe: str | None = None
    note: str | None = None
    taille: Literal[1, 2, 4] | None = None
    projet: str | None = None


class CorpsPromotion(BaseModel):
    officiel: bool = True
    famille: Literal["personnages", "objets", "decors", "interface", "tous"] = "tous"
    projet: str | None = None


class CorpsChamp(BaseModel):
    nom: str
    texte: str = ""
    actif: bool = True


class CorpsEchelle(BaseModel):
    nom: str = Field(min_length=1)
    famille: Literal["personnages", "objets", "decors", "interface", "tous"] = "tous"
    occupation: int = Field(100, ge=1, le=100)
    silhouette: bool = True


class CorpsUnivers(BaseModel):
    """Tout est facultatif : `None` veut dire « ne touche pas à celui-là ».

    Un `PUT` qui exigerait l'univers entier obligerait l'écran à renvoyer la
    bible pour changer une taille de pixel — donc à la tenir en mémoire, donc à
    en avoir une seconde vérité.
    """

    bible: list[CorpsChamp] | None = None
    bareme: list[CorpsEchelle] | None = None
    cible_px: int | None = None
    couleurs: int | None = None
    modeles: dict[str, str] | None = None


class CorpsRealignement(BaseModel):
    """Sans identifiants, tout le projet ; avec, cette sélection-là.

    Les deux ne se comportent pas pareil et c'est voulu : un balayage de projet
    **saute** les épinglés (US-68), une sélection nommée les **réaligne** — la
    demander pour cet asset-là *est* la décision que l'épingle protégeait
    (US-69).
    """

    identifiants: list[str] | None = None


# ── Le tableau d'inspiration ─────────────────────────────────────────────────


@routeur.get("/board")
async def tableau(requete: Request, projet: str | None = None) -> dict[str, Any]:
    """Le tableau d'un projet, en entier. Il ne se pagine pas : on le regarde."""
    atelier = _atelier(requete)
    identifiant = _projet(requete, projet)
    cartes = atelier.univers.cartes(identifiant)
    return {
        "projet": identifiant,
        "cartes": [c.en_json() for c in cartes],
        # Les groupes tels qu'ils existent, dans l'ordre où on les a nommés.
        # Calculés ici plutôt qu'à l'écran : c'est le serveur qui tient les
        # cartes, et deux listes de groupes finiraient par diverger.
        "groupes": sorted({c.groupe for c in cartes if c.groupe}),
    }


@routeur.post("/board/paste", status_code=201)
async def coller(
    requete: Request,
    nom: str = "",
    projet: str | None = None,
    forcer: bool = False,
) -> dict[str, Any]:
    """Coller **une** image — le geste principal de la tranche (US-41).

    Les octets sont le corps de la requête, bruts. Pas de `multipart`, et ce
    n'est pas un détail de plomberie : il demanderait `python-multipart`, une
    dépendance d'exécution de plus pour transporter ce qu'un `POST` transporte
    déjà. Le produit en a cinq, et chacune s'est justifiée.

    **Une image par appel, et c'est ce que US-45 demande.** « Savoir lequel des
    douze fichiers déposés pose problème » : douze appels rendent douze
    réponses, dont onze cartes et un refus qui nomme le fichier. Un lot unique
    aurait dû inventer une forme de réponse partielle — et surtout, il aurait
    fait attendre les onze premières cartes que la douzième soit lue, alors que
    la tranche promet qu'on continue à coller pendant ce temps.
    """
    atelier = _atelier(requete)
    identifiant = _projet(requete, projet)
    octets = await requete.body()
    return {
        "projet": identifiant,
        "nom": nom,
        **atelier.univers.coller_image(identifiant, octets, nom=nom, forcer=forcer),
    }


@routeur.post("/board/url", status_code=201)
async def coller_adresse(requete: Request, corps: CorpsAdresse) -> dict[str, Any]:
    """Coller une adresse — la carte paraît **avant** que l'image n'arrive (US-42).

    La route rend la main tout de suite, la récupération continue côté serveur,
    et son issue part sur le flux d'événements. C'est ce qui tient « on continue
    à coller pendant ce temps » : rien n'attend le serveur d'en face.
    """
    atelier = _atelier(requete)
    identifiant = _projet(requete, corps.projet)
    carte = atelier.univers.coller_adresse(identifiant, corps.adresse)
    atelier.univers.lancer_recuperation(identifiant, carte.identifiant)
    return carte.en_json()


@routeur.post("/board/text", status_code=201)
async def coller_texte(requete: Request, corps: CorpsTexte) -> dict[str, Any]:
    """Un texte devient une carte texte (US-44)."""
    identifiant = _projet(requete, corps.projet)
    return _atelier(requete).univers.coller_texte(identifiant, corps.texte).en_json()


@routeur.post("/board/{carte}/retry")
async def reessayer(
    requete: Request, carte: str, projet: str | None = None
) -> dict[str, Any]:
    """Réessayer une récupération qui a échoué (US-43).

    **Un geste de l'auteur, jamais une reprise automatique** : « rien n'est
    jamais relancé automatiquement » vaut ici comme pour une génération coupée.
    """
    atelier = _atelier(requete)
    identifiant = _projet(requete, projet)
    return (await atelier.univers.recuperer(identifiant, carte)).en_json()


@routeur.put("/board/{carte}")
async def regler_carte(
    requete: Request, carte: str, corps: CorpsReglage
) -> dict[str, Any]:
    """Grouper, annoter, régler la taille d'affichage (US-47)."""
    atelier = _atelier(requete)
    identifiant = _projet(requete, corps.projet)
    reglee = atelier.univers.regler(
        identifiant, carte, groupe=corps.groupe, note=corps.note, taille=corps.taille
    )
    return reglee.en_json()


@routeur.put("/board/{carte}/official")
async def promouvoir(
    requete: Request, carte: str, corps: CorpsPromotion
) -> dict[str, Any]:
    """Promouvoir une carte en artwork officiel, et lui donner sa famille (US-48).

    Rend la carte **et** l'univers : la palette se recalcule dans le même geste,
    et « retirer un artwork officiel recalcule la palette, et le changement se
    voit » (US-55) demande que l'écran l'apprenne sans redemander.
    """
    atelier = _atelier(requete)
    identifiant = _projet(requete, corps.projet)
    promue = atelier.univers.promouvoir(
        identifiant, carte, officiel=corps.officiel, famille=corps.famille
    )
    return {
        "carte": promue.en_json(),
        "univers": atelier.univers.univers(identifiant).en_json(),
    }


@routeur.delete("/board/{carte}")
async def oublier_carte(
    requete: Request, carte: str, projet: str | None = None
) -> dict[str, Any]:
    """La carte part tout de suite. Pas d'annulation : elle n'a rien coûté."""
    atelier = _atelier(requete)
    identifiant = _projet(requete, projet)
    oubliee = atelier.univers.oublier(identifiant, carte)
    return {
        "carte": oubliee.en_json(),
        "univers": atelier.univers.univers(identifiant).en_json(),
    }


@routeur.get("/board/{carte}/image")
async def image_carte(
    requete: Request, carte: str, projet: str | None = None
) -> Response:
    """L'image d'une carte, telle qu'elle est entrée.

    Rendue en PNG comme le reste du produit : le tableau accepte tous les
    formats que Pillow lit, l'écran n'en affiche qu'un. La conversion est du
    ressort du produit, pas du navigateur.
    """
    atelier = _atelier(requete)
    identifiant = _projet(requete, projet)
    octets, _ = atelier.univers.octets(identifiant, carte)
    return Response(
        content=rendre_en_png(octets),
        media_type="image/png",
        # Une carte ne change jamais sous son identifiant — sauf une
        # récupération réessayée, qui republie la carte sur le flux et fait
        # redemander l'image avec son empreinte en suffixe.
        headers={"Cache-Control": "no-cache"},
    )


# ── L'univers du projet ──────────────────────────────────────────────────────


@routeur.get("/universe")
async def lire_univers(requete: Request, projet: str | None = None) -> dict[str, Any]:
    """La bible, le barème, la palette et les défauts du projet."""
    atelier = _atelier(requete)
    identifiant = _projet(requete, projet)
    return {
        "projet": identifiant,
        "univers": atelier.univers.univers(identifiant).en_json(),
        # Les artworks tels qu'ils sont, pour que l'écran montre d'où vient la
        # palette sans recouper le tableau lui-même.
        "artworks": [c.en_json() for c in atelier.univers.artworks(identifiant, None)]
        + [
            c.en_json()
            for c in atelier.univers.cartes(identifiant)
            if c.artwork and c.famille != "tous"
        ],
    }


@routeur.put("/universe")
async def regler_univers(
    requete: Request, corps: CorpsUnivers, projet: str | None = None
) -> dict[str, Any]:
    """Poser les réglages de l'univers. Rien n'est obligatoire (US-56, US-58, US-60)."""
    atelier = _atelier(requete)
    identifiant = _projet(requete, projet)
    objet = atelier.univers.regler_univers(
        identifiant,
        bible=[c.model_dump() for c in corps.bible] if corps.bible is not None else None,
        bareme=[e.model_dump() for e in corps.bareme] if corps.bareme is not None else None,
        cible_px=corps.cible_px,
        couleurs=corps.couleurs,
        modeles=corps.modeles,
    )
    return {"projet": identifiant, "univers": objet.univers.en_json()}


@routeur.post("/universe/realign")
async def realigner(
    requete: Request, corps: CorpsRealignement, projet: str | None = None
) -> dict[str, Any]:
    """Réappliquer la palette et la grille du projet — **sans un appel payant**.

    « 12 assets remis à jour, 3 conservés tels quels » (US-67, US-68) : le
    compte des deux est dans la réponse, parce que c'est lui qu'on affiche.
    """
    atelier = _atelier(requete)
    identifiant = _projet(requete, projet)
    return atelier.univers.realigner(identifiant, identifiants=corps.identifiants)
