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

from atelier.domaine.teinte import TEINTES
from atelier.image import rendre_en_png
from atelier.services import Atelier

# **La liste close, rendue au schéma** — donc à `/api/docs`, et donc au refus
# que FastAPI compose tout seul. Écrire les noms ici en aurait fait un second
# endroit où la liste vit, et le premier îlot d'une teinte de plus aurait été
# accepté par l'un et refusé par l'autre. Elle est passée de six à dix le
# 28 août 2026 sans que cette ligne change, ce qui est très exactement la
# preuve qu'il n'y a qu'un endroit.
#
# **Le vide en fait partie, et c'est une valeur** : retirer une teinte est un
# geste comme en poser une, et un îlot sans teinte porte celle du châssis — ce
# que `docs/DESIGN.md` dit qu'il est, pas un réglage manquant.
TEINTE = Literal[("",) + TEINTES]  # type: ignore[valid-type]

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
    """Un texte, et depuis T9 la place où il se pose (US-110).

    **La place voyage avec le texte, et n'ouvre pas de second appel** : « une
    note se pose à même la toile, créée là où elle s'applique ». Créer puis
    déplacer aurait fait paraître la note en réserve — à l'autre bout de l'écran
    de l'endroit qu'on vient de désigner — et rendu possible l'état où elle
    existe sans avoir jamais été posée. C'est la règle de la carte tirée dans un
    îlot, appliquée à sa naissance.
    """

    texte: str = Field(min_length=1)
    position: list[float] | None = None
    # L'îlot où le point est tombé, quand il y en avait un. C'est **la** règle du
    # plan — tout ce qui y atterrit écrit son groupe —, et l'écran est le seul à
    # savoir dans quelle étendue le point est tombé.
    groupe: str = ""
    teinte: TEINTE = ""
    projet: str | None = None


class CorpsReglage(BaseModel):
    """Les réglages d'une carte, en un seul geste : ils se remplissent ensemble à
    l'écran, et un appel par champ ferait autant d'allers-retours.

    **T8 y ajoute la place et la largeur libre, et n'ouvre pas de route pour
    elles** : tirer une carte dans un îlot écrit sa position *et* son groupe, et
    deux appels rendraient possible un état où l'un est écrit et l'autre non.

    `None` ne touche pas ; `position: []` sort la carte du plan, comme
    `groupe: ""` la sort de son îlot. Ramener une carte en réserve est donc un
    seul appel qui dit les deux.
    """

    groupe: str | None = None
    note: str | None = None
    taille: Literal[1, 2, 4] | None = None
    position: list[float] | None = None
    largeur_libre: int | None = None
    # Le texte d'une **note**, corrigé en place (T9). Refusé sur une carte image
    # par le service, comme la teinte.
    texte: str | None = None
    # La teinte d'une **note**. `""` la retire ; une carte image la refuse, et
    # le refus vient du service — une règle que seule l'interface tiendrait
    # serait fausse au premier appel qui ne vient pas d'elle.
    teinte: TEINTE | None = None
    projet: str | None = None


class CorpsBout(BaseModel):
    """Une extrémité de lien : une carte par identifiant, ou un îlot par nom de
    groupe. **Deux espaces de noms, donc deux champs** — aplatis dans un seul,
    le lien vers un îlot qui s'appellerait comme une carte n'aurait plus dit
    lequel des deux il désigne."""

    genre: Literal["carte", "ilot"]
    valeur: str = Field(min_length=1)


class CorpsLien(BaseModel):
    """Un trait à tirer. `mot` et `pointe` existent **pour l'annulation** : un
    lien naît muet, et c'est l'écran qui tient cette règle — mais défaire une
    coupe, c'est reposer le lien tel qu'il était, en un seul appel."""

    de: CorpsBout
    vers: CorpsBout
    mot: str = ""
    pointe: bool = False
    projet: str | None = None


class CorpsReglageLien(BaseModel):
    """Le mot et la pointe, ensemble — ils se posent sur la même surface.

    `None` ne touche pas, `""` efface : la convention du produit depuis `groupe`.
    """

    mot: str | None = None
    pointe: bool | None = None
    projet: str | None = None


class CorpsTeinte(BaseModel):
    """La teinte d'un îlot. **Le groupe est dans le corps, pas dans le chemin** :
    un nom de groupe est du texte libre — il peut porter une barre oblique, et
    un îlot nommé « nord/sud » aurait fabriqué une route que personne n'atteint."""

    groupe: str = Field(min_length=1)
    teinte: TEINTE = ""
    projet: str | None = None


class CorpsDeplacementIlot(BaseModel):
    """Le déplacement d'un îlot entier. **Le groupe est dans le corps** pour la
    raison de `CorpsTeinte`, et les places y sont **toutes** : un îlot se déplace
    entier ou pas du tout, et c'est le service qui le vérifie.

    Les places sont absolues et non un écart, parce qu'une carte groupée avant T8
    n'a **pas** de position écrite : l'écran lui en calcule une à l'ouverture, et
    un écart n'aurait rien eu à quoi s'ajouter pour elle."""

    groupe: str = Field(min_length=1)
    places: dict[str, list[float]] = Field(default_factory=dict)
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
    # **Deux défauts d'appel, pas de famille** (C2) : produire une planche et
    # éditer un corps ne se jouent pas chez le même modèle — mesuré le 28 août.
    # Le vide les remet au défaut du catalogue.
    modele_planche: str | None = None
    modele_edition: str | None = None


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
    """Le tableau d'un projet, en entier. Il ne se pagine pas : on le regarde.

    **Les liens partent avec les cartes** (T9) : une toile se lit en un
    aller-retour, parce qu'elle *est* le tableau. Une seconde route pour les
    traits aurait fait paraître les cartes avant eux — donc un instant, à chaque
    ouverture, où la toile montre des objets sans ce qu'on en avait dit.
    """
    atelier = _atelier(requete)
    identifiant = _projet(requete, projet)
    cartes = atelier.univers.cartes(identifiant)
    groupes = sorted({c.groupe for c in cartes if c.groupe})
    return {
        "projet": identifiant,
        "cartes": [c.en_json() for c in cartes],
        # Les groupes tels qu'ils existent, dans l'ordre où on les a nommés.
        # Calculés ici plutôt qu'à l'écran : c'est le serveur qui tient les
        # cartes, et deux listes de groupes finiraient par diverger.
        "groupes": groupes,
        "liens": [un.en_json() for un in atelier.univers.liens(identifiant)],
        # Les teintes des îlots **qui existent**, et rien de plus. Le projet ne
        # devrait déjà plus en porter d'autres — l'élagage les emporte avec leur
        # dernier membre —, et les filtrer ici est ce qui rend cette phrase-là
        # vraie même pour un `projet.json` écrit à la main.
        "teintes": {
            nom: t
            for nom, t in atelier.univers.teintes(identifiant).items()
            if nom in groupes
        },
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
    """Un texte devient une carte texte (US-44), et depuis T9 il peut naître
    posé (US-110). La même route pour les deux : une note *est* une carte texte,
    et c'est tout ce qu'elle est."""
    identifiant = _projet(requete, corps.projet)
    return (
        _atelier(requete)
        .univers.coller_texte(
            identifiant,
            corps.texte,
            position=corps.position,
            groupe=corps.groupe,
            teinte=corps.teinte,
        )
        .en_json()
    )


# ── Les liens de la toile ────────────────────────────────────────────────────
#
# **Déclarées avant `PUT /board/{carte}`, et ce n'est pas cosmétique.** FastAPI
# essaie ses routes dans l'ordre de déclaration : `/board/links/…` a trois
# segments et ne peut pas être pris pour `/board/{carte}`, mais l'ordre le dit
# quand même à qui lit — et la règle vaut telle quelle pour `/board/groups`,
# qui, lui, en a deux et *serait* attrapé.


@routeur.post("/board/links", status_code=201)
async def lier(requete: Request, corps: CorpsLien) -> dict[str, Any]:
    """Tirer un trait d'un objet à un autre (US-108) — il naît muet."""
    atelier = _atelier(requete)
    identifiant = _projet(requete, corps.projet)
    return atelier.univers.lier(
        identifiant,
        corps.de.model_dump(),
        corps.vers.model_dump(),
        mot=corps.mot,
        pointe=corps.pointe,
    ).en_json()


@routeur.put("/board/links/{lien}")
async def regler_lien(
    requete: Request, lien: str, corps: CorpsReglageLien
) -> dict[str, Any]:
    """Le mot et la pointe (US-109). *Le défaut est muet, l'exception s'exprime.*"""
    atelier = _atelier(requete)
    identifiant = _projet(requete, corps.projet)
    return atelier.univers.regler_lien(
        identifiant, lien, mot=corps.mot, pointe=corps.pointe
    ).en_json()


@routeur.delete("/board/links/{lien}")
async def couper_lien(
    requete: Request, lien: str, projet: str | None = None
) -> dict[str, Any]:
    """Le trait part tout de suite. Comme une carte, il n'a rien coûté."""
    atelier = _atelier(requete)
    identifiant = _projet(requete, projet)
    return atelier.univers.couper(identifiant, lien).en_json()


@routeur.put("/board/groups/tint")
async def teinter(requete: Request, corps: CorpsTeinte) -> dict[str, Any]:
    """La teinte d'un îlot (US-111).

    **Trois segments, et ce n'est pas une préférence de style.** À deux —
    `/board/tint` —, la route littérale entre en concurrence avec
    `PUT /board/{carte}` et n'est atteinte que si elle est déclarée avant :
    l'adresse dépendrait alors de l'ordre des fonctions dans le fichier, donc
    d'une ligne que le prochain réarrangement déplacerait sans rien casser de
    visible. Le dépôt a déjà payé un chemin qui ne s'atteint pas (`Mount("/mcp")`,
    `docs/PIEGES.md`) ; à trois segments, aucune route existante n'a
    cette forme et il n'y a plus d'ordre à respecter.

    Rend les teintes du projet : elles y vivent, et l'écran les apprend d'ici.
    """
    atelier = _atelier(requete)
    identifiant = _projet(requete, corps.projet)
    projet_teinte = atelier.univers.teinter(identifiant, corps.groupe, corps.teinte)
    return {"projet": identifiant, "teintes": dict(projet_teinte.teintes)}


@routeur.put("/board/groups/move")
async def deplacer_ilot(requete: Request, corps: CorpsDeplacementIlot) -> dict[str, Any]:
    """Déplacer un îlot entier (US-113) — *un seul appel, parce que c'est un seul geste*.

    **Trois segments, et pour la raison exacte de `/board/groups/tint`** : à deux,
    `/board/move` entre en concurrence avec `PUT /board/{carte}` et n'est atteinte
    que si elle est déclarée avant, donc son adresse dépendrait de l'ordre des
    fonctions dans ce fichier.

    Elle ne reclasse rien : déplacer un rangement, ce n'est pas reclasser ce qu'il
    contient. Le groupe des cartes ne bouge pas, et l'îlot garde ses liens et sa
    teinte.
    """
    atelier = _atelier(requete)
    identifiant = _projet(requete, corps.projet)
    cartes = atelier.univers.deplacer_ilot(identifiant, corps.groupe, corps.places)
    return {"projet": identifiant, "cartes": [c.en_json() for c in cartes]}


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
    """Grouper, annoter, régler la taille — et poser sur la toile (US-47, T8).

    **Appelée à la fin du geste, jamais pendant** : un glissement écrit une fois,
    au relâchement, et pas à chaque image.
    """
    atelier = _atelier(requete)
    identifiant = _projet(requete, corps.projet)
    reglee = atelier.univers.regler(
        identifiant,
        carte,
        groupe=corps.groupe,
        note=corps.note,
        taille=corps.taille,
        position=corps.position,
        largeur_libre=corps.largeur_libre,
        texte=corps.texte,
        teinte=corps.teinte,
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
        modele_planche=corps.modele_planche,
        modele_edition=corps.modele_edition,
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
