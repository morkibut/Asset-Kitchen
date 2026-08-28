# -*- coding: utf-8 -*-
"""Les routes. Aucune logique : chacune appelle un service et met en forme.

**Chemins en anglais, charges utiles en français** — un chemin de route est lu
par des outils, une charge utile est lue par l'interface, qui est française
(`AGENTS.md` § Règles durables).
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator, Literal

from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from atelier.domaine import (
    Asset,
    Demande,
    Generation,
    Modele,
    Recette,
    Reinjection,
)
from atelier.domaine.catalogue import modele_en_json
from atelier.domaine.erreurs import ErreurAtelier, GenerationInconnue
from atelier.image import rendre_en_png
from atelier.reglages import deposer_cle, etat_cle
from atelier.services import Atelier
from atelier.services.assets import AssetInconnu

routeur = APIRouter()

# Combien de temps le flux reste muet avant d'envoyer un signe de vie. Un
# atelier peut rester une heure sans rien produire ; sans ce battement, un
# mandataire ou un pare-feu couperait la liaison et l'onglet ne le saurait pas.
BATTEMENT_S = 15.0

# Un commentaire SSE : la liaison reste ouverte, l'onglet n'a rien à lire.
BATTEMENT = ": battement\n\n"


def _atelier(requete: Request) -> Atelier:
    return requete.app.state.atelier


# ── L'état d'ouverture ───────────────────────────────────────────────────────


@routeur.get("/health")
async def sante() -> dict[str, Any]:
    return {"atelier": "ouvert"}


@routeur.get("/status")
async def statut(requete: Request) -> dict[str, Any]:
    """Tout ce qu'il faut pour dessiner l'atelier à l'ouverture, en un appel."""
    return _atelier(requete).etat()


# ── Le flux d'événements ─────────────────────────────────────────────────────


@routeur.get("/events")
async def flux(requete: Request, limite: int = Query(50, ge=1, le=500)) -> Response:
    """Ce que l'atelier fait, au moment où il le fait. Aucun sondage.

    **Le premier message est l'état complet** — clé, catalogue, coûts, l'arbre
    de la bibliothèque, la grille du projet ouvert, et le chantier : ce qui
    tourne encore ou qu'un redémarrage a coupé. C'est lui qui tient le critère
    « l'onglet est fermé pendant une génération : à la réouverture, l'image est
    là » — elle y est parce qu'elle est **en bibliothèque**, pas parce qu'on a
    gardé la génération à l'écran.

    Les suivants sont des faits acquis : un emplacement part, une image arrive,
    un appel échoue, un asset se range, le catalogue revient. Entre deux, un
    battement en commentaire SSE tient la liaison ouverte sans rien dire.
    """
    atelier = _atelier(requete)

    async def messages() -> AsyncIterator[str]:
        # On s'abonne **avant** de composer l'état : sinon un fait qui se produit
        # pendant la composition passerait entre les deux et serait perdu. Un
        # doublon est sans conséquence — chaque message porte l'objet entier.
        with atelier.diffusion.abonnement() as file:
            yield _sse(
                "etat",
                {
                    **atelier.etat(),
                    # **Le chantier, pas l'historique.** Ce qui a réussi est en
                    # bibliothèque et paraît par `assets` ; ce qui a échoué est
                    # au journal du projet avec son coût. Ne restent ici que les
                    # emplacements qui attendent encore une issue.
                    "generations": [
                        g.en_json() for g in atelier.generations.chantier(limite)
                    ],
                    # La grille du projet ouvert, servie avec l'état pour qu'un
                    # onglet qui s'ouvre la dessine sans un second appel.
                    "assets": [
                        a.en_json()
                        for a in atelier.bibliotheque.grille_courante(limite * 4)
                    ],
                },
            )
            while True:
                try:
                    evenement = await asyncio.wait_for(file.get(), BATTEMENT_S)
                except asyncio.TimeoutError:
                    yield BATTEMENT
                    continue
                yield _sse(evenement.genre, evenement.charge)

    return StreamingResponse(
        messages(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            # L'atelier tourne en local, mais `npm run dev` relaie par Vite :
            # sans ça, le tampon du relais retiendrait les messages.
            "X-Accel-Buffering": "no",
        },
    )


def _sse(genre: str, charge: dict[str, Any]) -> str:
    """Un message SSE — un genre, une charge JSON, une ligne vide qui clôt."""
    donnees = json.dumps(charge, ensure_ascii=False)
    return "event: " + genre + "\n" + "data: " + donnees + "\n\n"


# ── La clé ───────────────────────────────────────────────────────────────────


class CorpsCle(BaseModel):
    cle: str = Field(min_length=8)


@routeur.get("/settings/key")
async def lire_etat_cle() -> dict[str, Any]:
    return etat_cle().en_json()


@routeur.put("/settings/key")
async def poser_cle(corps: CorpsCle) -> dict[str, Any]:
    """Se dépose une fois, et n'est plus jamais redemandée (US-4)."""
    try:
        return deposer_cle(corps.cle).en_json()
    except ValueError as erreur:
        raise ErreurAtelier(str(erreur), ou_aller="reglages") from None


class CorpsAgent(BaseModel):
    """Ce que l'écran Réglages change, **champ par champ** (US-91).

    Tout est optionnel exprès : l'écran bascule un interrupteur à la fois, et
    envoyer l'objet entier depuis un formulaire partiel effacerait ce qu'un
    autre onglet vient de poser. Ce qui n'est pas dit ne change pas.
    """

    plafond_actif: bool | None = None
    plafond: int | None = Field(None, ge=1)
    modele_actif: bool | None = None
    modele: str | None = None
    options: dict[str, Any] | None = None
    dossier_jeu: str | None = None


@routeur.get("/settings/agent")
async def lire_agent(requete: Request) -> dict[str, Any]:
    """Les garde-fous **et** la consommation. Ils se lisent ensemble ou pas du tout."""
    return _atelier(requete).agent.en_json()


@routeur.put("/settings/agent")
async def regler_agent(requete: Request, corps: CorpsAgent) -> dict[str, Any]:
    """Prend effet **à l'appel suivant, sans redémarrage** (US-91).

    Rien à faire pour ça : le service relit le fichier à chaque question posée.
    C'est la même règle que la clé du fournisseur, et pour la même raison — on
    change d'avis en cours de séance.
    """
    atelier = _atelier(requete)
    champs = {c: v for c, v in corps.model_dump().items() if v is not None}
    atelier.agent.regler(**champs)
    return atelier.agent.en_json()


# ── Le catalogue ─────────────────────────────────────────────────────────────


@routeur.get("/models")
async def modeles(
    requete: Request,
    references: int = Query(0, ge=0),
    proportions: str = Query("1:1"),
    resolution: str | None = Query(None),
    echelle: str = Query(""),
    personnage: str = Query(""),
    cases: int = Query(0, ge=0),
) -> dict[str, Any]:
    """Le catalogue, **et la raison du grisé de chaque modèle**.

    Le calcul du refus vit dans le domaine et sort d'ici tout mâché : l'interface
    n'a pas à réimplémenter la règle « indisponible avec sa raison, jamais
    proposé puis refusé ». Elle affiche la phrase qu'elle reçoit.

    **Le compte de références est calculé ici, pas à l'écran** (US-52). Depuis
    T4, l'auteur n'est plus le seul à en poser : l'application ajoute les
    artworks de la famille du sujet, et dédoublonne les deux ensembles. L'écran
    ne connaît que sa moitié — il envoie donc le nombre qu'il tient et le sujet
    choisi, et reçoit le total qui partira vraiment, avec sa provenance. C'est
    aussi ce total-là qui décide du grisé : « n'accepte que 2 images de
    référence, il en faudrait 5 » doit compter les cinq qui partent.

    **Le modèle par défaut suit la famille du sujet** (US-58) : « le modèle est
    un défaut par type d'asset porté par l'univers, pas un réglage global ».
    Sans réglage pour cette famille-là, c'est le défaut du catalogue qui reprend
    la main — il n'y a pas de trou, seulement un réglage qu'on n'a pas posé.
    """
    atelier = _atelier(requete)
    etat = atelier.catalogue.etat
    projet = atelier.bibliotheque.courant
    compte = atelier.generations.compter_references(
        projet,
        echelle,
        tuple(Reinjection(asset=f"~{rang}") for rang in range(references)),
        personnage=personnage or None,
        # **Combien de cases le lot armé demande**, ou zéro. Il ne change qu'une
        # chose ici, et elle compte : le gabarit part avec l'appel, donc il
        # occupe une place dans le plafond du modèle et décide du grisé.
        cases=cases,
    )
    demande = _demande_de_jauge(compte["total"], proportions, resolution)
    defaut = atelier.catalogue.defaut(demande)
    univers = atelier.univers.univers(projet)
    # **Le défaut suit ce qu'on fabrique, et une planche n'est pas un sujet.**
    # Un lot armé demande une planche : c'est le modèle de planche du projet qui
    # décide, avant la famille du sujet — mesuré le 28 août, un modèle rend les
    # traits du gabarit dans l'image là où un autre les ignore. Sans réglage,
    # la famille reprend la main, puis le catalogue : trois niveaux, aucun trou.
    du_projet = (
        (univers.modele_planche or None)
        if cases >= 2
        else (univers.modele(compte["famille"]) if compte["famille"] else None)
    )
    return {
        "recu_le": etat.recu_le,
        "repli": etat.repli,
        "raison": etat.raison,
        "defaut": {"modele": du_projet or defaut.modele, "options": defaut.options},
        "references": compte,
        # **Ce qu'une image a coûté chez chaque modèle, en médiane** (US-121).
        # Une mesure, jamais un tarif : le produit ne porte aucun prix de
        # catalogue, et « le coût réel facturé fait foi » partout ailleurs. Un
        # modèle jamais appelé n'y figure pas — le produit dit alors qu'il ne
        # sait pas plutôt que d'inventer un chiffre.
        "couts": {
            m.identifiant: cout
            for m in etat.modeles
            if (cout := atelier.generations.cout_attendu(m.identifiant)) is not None
        },
        "modeles": [_modele_en_json(m, demande) for m in etat.modeles],
    }


@routeur.post("/models/refresh")
async def rafraichir_modeles(requete: Request) -> dict[str, Any]:
    """Redemander le catalogue — le geste qui sort du repli hors ligne.

    Ne lève pas quand le réseau est toujours coupé : elle rend le repli et sa
    date, et l'écran continue de le dire. Le retour du réseau, lui, part sur le
    flux d'événements : tous les onglets ouverts l'apprennent d'un coup.
    """
    catalogue = _atelier(requete).catalogue
    await catalogue.rafraichir()
    return catalogue.en_json()


class _Jauge:
    """Le strict nécessaire pour interroger `Modele.refus` sans écrire un prompt."""

    def __init__(self, references: int, proportions: str, resolution: str | None):
        self.references = tuple(b"" for _ in range(references))
        self.proportions = proportions
        self.resolution = resolution
        self.options: dict[str, Any] = {}


def _demande_de_jauge(references: int, proportions: str, resolution: str | None):
    return _Jauge(references, proportions, resolution)


def _modele_en_json(modele: Modele, demande) -> dict[str, Any]:
    fiche = modele_en_json(modele)
    fiche["refus"] = modele.refus(demande)
    return fiche


# ── Les générations ──────────────────────────────────────────────────────────


class CorpsReinjection(BaseModel):
    """Un asset renvoyé au fournisseur, et à quel titre (US-12).

    Le quatrième rôle du produit — **jeu de réglages** — n'apparaît pas ici : il
    n'envoie aucune image. Il repeuple le générateur avec les paramètres d'une
    génération passée, que l'écran relit sur `GET /api/generations/{id}`, et il
    ne laisse donc rien dans celle qui part.
    """

    asset: str
    role: Literal["reference", "edition", "style"] = "reference"
    # L'origine n'est pas dans ce corps : une réinjection posée à la main vient
    # toujours de la bibliothèque. Les cartes du tableau, elles, ne se
    # sélectionnent jamais — c'est l'application qui les ajoute (US-51).


class CorpsGeneration(BaseModel):
    modele: str
    prompt: str = Field(min_length=1)
    prompt_negatif: str = ""
    proportions: str = "1:1"
    resolution: str | None = None
    variations: int = Field(1, ge=1, le=8)
    options: dict[str, Any] = Field(default_factory=dict)
    identifiant: str | None = None
    projet: str | None = None
    # **Ce que l'auteur fabrique**, nommé dans le barème de son projet. Un seul
    # mot, et il décide de trois choses : quels artworks partent, quel modèle
    # est le défaut, et quelle part de la case le sujet occupera (T4).
    echelle: str = ""
    # Des identifiants d'assets et leur rôle, jamais des octets (US-12). Celui
    # qui porte « edition » est ce qu'on retouche : il part avec l'appel comme
    # les autres, et c'est le seul qui donne sa filiation à ce qui sortira.
    references: list[CorpsReinjection] = Field(default_factory=list)
    # **La case que cet appel vise** (US-120). Vides pour une génération
    # ordinaire, qui est le cas courant : l'atelier fabrique des images, et
    # seules quelques-unes remplissent une case de personnage. L'image qui
    # reviendra en héritera à sa naissance, sans que personne ait à la ranger.
    personnage: str | None = None
    pose: str | None = None
    # **Les cases d'un lot plié** (US-128). Deux poses ou plus, et l'appel part
    # en une seule planche que l'atelier dépliera lui-même. **La même route que
    # tout le reste**, et c'est la décision : il n'existe qu'un seul endroit
    # d'où l'on paie dans tout le produit, et une seconde route de génération en
    # aurait fait deux. Vide ou à une seule pose, c'est la génération de C1 —
    # `pose` dit alors la case, et rien n'est plié.
    poses: list[str] | None = None
    # **Ce que cette génération-ci n'envoie pas** (US-126). Absent, les deux
    # portées durables — le projet et le personnage — s'appliquent ; présent, il
    # décide seul, parce que c'est la portée la plus étroite. Un agent qui ne
    # dit rien part donc avec ce que l'auteur a posé une fois pour toutes.
    references_ecartees: list[str] | None = None
    # **Le texte est repris à la main, il part mot pour mot** (US-159, US-160).
    # L'auteur a vu l'aperçu, il l'a corrigé : la bible ne se replie plus en
    # tête et les consignes de planche ne s'ajoutent plus en queue, puisqu'elles
    # sont déjà dans ce qu'il a écrit. Il ne touche à rien d'autre — ni à
    # l'univers du projet, ni à l'échelle, ni au gabarit du lot.
    repris: bool = False


@routeur.post("/generations", status_code=202)
async def generer(requete: Request, corps: CorpsGeneration) -> dict[str, Any]:
    """Soumet et rend l'identifiant tout de suite. Le travail continue côté serveur.

    Renvoyer le même identifiant deux fois ne facture qu'une fois : la seconde
    soumission rend la première telle quelle.
    """
    demande = Demande(
        prompt=corps.prompt,
        prompt_negatif=corps.prompt_negatif,
        proportions=corps.proportions,
        resolution=corps.resolution,
        variations=corps.variations,
        options=corps.options,
        echelle=corps.echelle,
        repris=corps.repris,
    )
    atelier = _atelier(requete)
    generation = await atelier.generations.soumettre(
        corps.modele,
        demande,
        identifiant=corps.identifiant,
        # Sans projet nommé, c'est le service qui pose le projet ouvert : le
        # défaut vit là-bas pour que le MCP de T7 en hérite sans le réécrire.
        projet=corps.projet,
        references=[
            Reinjection(asset=r.asset, role=r.role) for r in corps.references
        ],
        personnage=corps.personnage,
        pose=corps.pose,
        poses=corps.poses,
        references_ecartees=corps.references_ecartees,
    )
    return generation.en_json()


class CorpsApercu(BaseModel):
    """De quoi composer le texte, et rien de plus.

    **Pas un `CorpsGeneration` allégé** : le modèle, les proportions, les
    variations, les références et jusqu'à l'échelle ne changent pas un caractère
    de ce qui part en texte. Les demander ici aurait fait croire qu'ils
    comptent, et obligé l'écran à les tenir à jour pour un aperçu.
    """

    prompt: str = ""
    projet: str | None = None
    personnage: str | None = None
    poses: list[str] | None = None
    # Repris, l'aperçu **est** le texte de l'auteur : il ne se recompose pas, il
    # se rend tel quel. La route le sert quand même, pour que l'écran n'ait
    # jamais deux chemins selon l'état d'un interrupteur.
    repris: bool = False


@routeur.post("/prompt/preview")
async def apercu_prompt(requete: Request, corps: CorpsApercu) -> dict[str, Any]:
    """Le texte exact qui partira, **avant de lancer** (US-158).

    **Une route à part, et deux segments** : ni sous `/generations`, où elle
    aurait dépendu de l'ordre de déclaration des fonctions face à
    `/generations/{identifiant}` — le piège de `board/groups/tint` —, ni greffée
    sur `/models`, qui se redemande à chaque changement de proportions et n'a
    jamais le prompt sous les yeux.

    **`POST` pour un calcul qui n'écrit rien**, parce qu'un prompt est du texte
    long : le passer en paramètre d'adresse le ferait tronquer par le premier
    journal venu, et une bible de sept champs y tient mal.

    Rien n'est facturé, rien n'est enregistré, et aucun appel ne sort de la
    machine : l'aperçu marche réseau coupé, comme le réglage de la bible.
    """
    # Le sujet est **passé tel quel, espaces de bout compris retirés** : c'est
    # ce que la soumission enverra, `Demande` faisant le même `strip` en amont
    # de son refus. Un prompt vide n'est pas une erreur ici — l'atelier s'ouvre
    # dessus, et l'aperçu montre alors la bible seule, qui est déjà ce qui
    # partirait.
    return _atelier(requete).generations.apercu(
        corps.prompt.strip(),
        repris=corps.repris,
        projet=corps.projet,
        personnage=corps.personnage or None,
        poses=corps.poses,
    )


@routeur.get("/generations")
async def liste_generations(
    requete: Request, limite: int = Query(50, ge=1, le=500)
) -> dict[str, Any]:
    generations = _atelier(requete).generations.recentes(limite)
    return {
        "generations": [g.en_json() for g in generations],
        "total_usd": _atelier(requete).generations.total_couts(),
    }


@routeur.get("/generations/{identifiant}")
async def lire_generation(requete: Request, identifiant: str) -> dict[str, Any]:
    return _trouver(requete, identifiant).en_json()


@routeur.post("/generations/{identifiant}/slots/{rang}/retry")
async def relancer(requete: Request, identifiant: str, rang: int) -> dict[str, Any]:
    """Un seul emplacement repart. Les voisines ne sont pas rejouées (US-22)."""
    generation = await _atelier(requete).generations.relancer(identifiant, rang)
    return generation.en_json()


@routeur.get("/generations/{identifiant}/slots/{rang}/image")
async def image_brute(requete: Request, identifiant: str, rang: int) -> Response:
    """L'image telle qu'elle est arrivée — pour l'affichage."""
    generation = _trouver(requete, identifiant)
    octets, type_media = _atelier(requete).generations.octets(generation, rang)
    return Response(content=octets, media_type=type_media)


@routeur.get("/generations/{identifiant}/slots/{rang}/download")
async def telecharger(requete: Request, identifiant: str, rang: int) -> Response:
    """« Une image se télécharge seule, en PNG » — critère d'acceptation de T1.

    Tous les modèles ne rendent pas du PNG : les Seedream ne rendent que du
    JPEG. La conversion est du ressort du produit. Le brut, lui, reste intact
    sur le disque — le PNG est un rendu, pas un remplacement.
    """
    generation = _trouver(requete, identifiant)
    octets, _ = _atelier(requete).generations.octets(generation, rang)
    png = rendre_en_png(octets)
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="{identifiant}-{rang}.png"'
        },
    )


def _trouver(requete: Request, identifiant: str) -> Generation:
    generation = _atelier(requete).generations.lire(identifiant)
    if generation is None:
        raise GenerationInconnue(identifiant)
    return generation


# ── Les assets et leur recette ───────────────────────────────────────────────
#
# **Aucun de ces appels ne touche le réseau ni ne coûte un centime.** C'est
# l'invariant de T2, et c'est aussi ce qui rend la retouche instantanée : tout se
# passe sur le disque et le processeur de la machine.


class CorpsPasse(BaseModel):
    moteur: str = "bord"
    tolerance: int = Field(28, ge=0, le=255)
    seuil_alpha: int = Field(128, ge=0, le=255)
    durcissement: int = Field(0, ge=0, le=4)


class CorpsRecadrage(BaseModel):
    marge: int = Field(0, ge=0)
    boite: list[int] | None = None


class CorpsGrille(BaseModel):
    cible: int = Field(64, ge=8, le=512)
    occupation: int = Field(100, ge=1, le=100)
    ancrage: str = "bas"


class CorpsQuantification(BaseModel):
    couleurs: int = Field(32, ge=2, le=256)
    palette: list[str] = Field(default_factory=list)
    tramage: str = "aucun"


class CorpsBords(BaseModel):
    aire_min: int = Field(0, ge=0)


class CorpsRecette(BaseModel):
    """La recette telle qu'elle arrive de l'écran.

    Les bornes sont déclarées deux fois — ici en `Field`, et dans le service.
    Ce n'est pas une redite : celles-ci rendent un 422 lisible dans `/api/docs`
    et arrêtent une valeur absurde avant qu'elle n'entre, celles du service
    valent pour **toute** provenance — une recette relue d'un fichier, une
    recette nommée devenue caduque, un agent en T7 qui n'a jamais vu cet écran.
    """

    passes: list[CorpsPasse] = Field(default_factory=list)
    recadrage: CorpsRecadrage | None = None
    grille: CorpsGrille | None = None
    quantification: CorpsQuantification | None = None
    bords: CorpsBords | None = None
    nom: str | None = None

    def en_recette(self) -> Recette:
        return Recette.depuis_json(self.model_dump())


class CorpsImport(BaseModel):
    """Un fichier local, nommé par son chemin.

    Le chemin plutôt que les octets : l'atelier et l'appelant sont sur la même
    machine — c'est vrai de l'écran comme de l'agent —, et faire transiter dix
    mégaoctets en base64 par une boucle locale serait payer un transport qui
    n'existe pas.
    """

    chemin: str = Field(min_length=1)
    projet: str | None = None


@routeur.post("/assets/import", status_code=201)
async def importer_asset(requete: Request, corps: CorpsImport) -> dict[str, Any]:
    """Un fichier local devient un asset entier (US-82).

    La route existe pour que le geste soit **le même des deux côtés** : l'outil
    MCP `import_asset` appelle le service, pas cette route, mais l'un et l'autre
    passent par `ServiceGenerations.importer` — et c'est ça qui garantit que ce
    que l'agent peut faire, l'écran le peut aussi.
    """
    from pathlib import Path

    chemin = Path(corps.chemin).expanduser()
    if not chemin.is_file():
        raise ErreurAtelier(f"aucun fichier « {chemin} »")
    atelier = _atelier(requete)
    asset = atelier.generations.importer(
        chemin.read_bytes(), chemin.name, projet=corps.projet
    )
    return asset.en_json()


@routeur.get("/assets")
async def liste_assets(
    requete: Request,
    projet: str | None = Query(None),
    sans_projet: bool = Query(False),
    tous: bool = Query(False),
    collection: str | None = Query(None),
    favoris: bool = Query(False),
    recherche: str = Query(""),
    limite: int = Query(200, ge=1, le=1000),
) -> dict[str, Any]:
    """La bibliothèque, filtrée. **La seule grille du produit** (US-31).

    Sans aucun paramètre, c'est la grille du projet ouvert — exactement ce que
    le premier message du flux a déjà servi. `tous` regarde par-dessus les
    projets, `sans_projet` ne montre que ce qu'une suppression de projet a
    détaché.

    Le filtrage est **ici** et non à l'écran : la recherche doit porter sur
    toute la bibliothèque, pas sur les deux cents assets qu'un navigateur a en
    mémoire. C'est aussi ce qui fera que le MCP de T7 verra exactement ce que
    l'écran voit.
    """
    bibliotheque = _atelier(requete).bibliotheque
    if not tous and projet is None and not sans_projet and collection is None:
        projet, sans_projet = bibliotheque.courant, bibliotheque.courant is None
    assets = bibliotheque.chercher(
        projet=None if tous else projet,
        sans_projet=sans_projet and not tous,
        collection=collection,
        favoris=favoris,
        recherche=recherche,
        limite=limite,
    )
    return {"assets": [a.en_json() for a in assets]}


@routeur.get("/assets/{identifiant}")
async def lire_asset(requete: Request, identifiant: str) -> dict[str, Any]:
    return _asset(requete, identifiant).en_json()


@routeur.get("/assets/{identifiant}/imposed")
async def impose_sur_asset(requete: Request, identifiant: str) -> dict[str, Any]:
    """Ce que le projet impose à cette image — cible, occupation, palette (US-164).

    **À part de l'asset, et c'est la grille qui le décide** : la charge d'un
    asset part deux cents fois par relecture de grille, celle-ci une fois par
    fiche ouverte. Y greffer un calcul qui relit le projet et son barème aurait
    fait payer à la grille une phrase que seule la fiche montre.
    """
    return _atelier(requete).assets.impose(identifiant)


@routeur.put("/assets/{identifiant}/recipe")
async def poser_recette(
    requete: Request, identifiant: str, corps: CorpsRecette
) -> dict[str, Any]:
    """Le geste de la tranche. Le rendu est recalculé avant de répondre.

    Répondre après le calcul et non avant : l'écran affiche l'image dès qu'il a
    la réponse, sans un second aller-retour pour savoir si c'est prêt. Le calcul
    se compte en dizaines de millisecondes — le détourage déjà fait est gardé,
    seule la queue de la recette est refaite.
    """
    asset = _atelier(requete).assets.poser_recette(identifiant, corps.en_recette())
    return asset.en_json()


@routeur.post("/assets/{identifiant}/reset")
async def revenir_au_brut(requete: Request, identifiant: str) -> dict[str, Any]:
    """Revenir à l'image brute, d'un seul geste (US-64)."""
    return _atelier(requete).assets.revenir_au_brut(identifiant).en_json()


@routeur.post("/assets/{identifiant}/apply/{nom}")
async def appliquer_recette_nommee(
    requete: Request, identifiant: str, nom: str
) -> dict[str, Any]:
    """La même recette, sur un autre asset, au pixel près (US-66)."""
    return _atelier(requete).assets.appliquer_nommee(identifiant, nom).en_json()


@routeur.get("/assets/{identifiant}/image")
async def image_asset(
    requete: Request, identifiant: str, brut: bool = Query(False)
) -> Response:
    """Le rendu, ou le brut si on le demande — c'est la bascule de la fiche.

    Un rendu dont le fichier a disparu du disque **se recalcule ici**, sans que
    l'appelant ait à le savoir : « supprimer le fichier de rendu ne perd rien »
    (`docs/PLAN.md`, T2).
    """
    atelier = _atelier(requete)
    octets, type_media = atelier.assets.octets(_asset(requete, identifiant), brut=brut)
    return Response(
        content=octets,
        media_type=type_media,
        # Le rendu change sous la même adresse à chaque cran de curseur : le
        # mettre en cache ferait regarder l'image d'avant.
        headers={"Cache-Control": "no-store"},
    )


@routeur.get("/assets/{identifiant}/download")
async def telecharger_asset(
    requete: Request, identifiant: str, brut: bool = Query(False)
) -> Response:
    """« Une image se télécharge seule, en PNG » — et c'est le rendu qui part."""
    atelier = _atelier(requete)
    asset = _asset(requete, identifiant)
    octets, _ = atelier.assets.octets(asset, brut=brut)
    png = rendre_en_png(octets)
    suffixe = "-brut" if brut else ""
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="{identifiant}{suffixe}.png"'
        },
    )


# ── Le slicer ────────────────────────────────────────────────────────────────
#
# **Deux routes, parce que ce sont deux gestes.** Proposer ne crée rien et se
# redemande à chaque cran de réglage ; découper crée des assets et ne se
# redemande jamais. Une seule route qui découperait « en mode auto » ferait de la
# détection une autorité — or c'est l'auteur qui tranche, et « une détection
# ratée se corrige sans jamais bloquer » (US-73) n'existe qu'à ce prix.


class CorpsDecoupe(BaseModel):
    """Les rectangles que l'auteur a sous les yeux, dans son ordre.

    Des boîtes explicites plutôt qu'un mode : ce qui part à la découpe est
    exactement ce que l'écran montre, y compris ce qu'on y a dessiné à la main.
    """

    boites: list[list[int]] = Field(default_factory=list)


@routeur.get("/assets/{identifiant}/slices")
async def proposer_decoupe(
    requete: Request,
    identifiant: str,
    mode: str = Query("auto"),
    colonnes: int = Query(2, ge=1, le=64),
    lignes: int = Query(1, ge=1, le=64),
    cote_min: int = Query(16, ge=0, le=256),
) -> dict[str, Any]:
    """Où l'on pourrait couper — sans rien créer et sans rien écrire (US-72)."""
    return _atelier(requete).decoupe.proposer(
        identifiant, mode=mode, colonnes=colonnes, lignes=lignes, cote_min=cote_min
    )


@routeur.post("/assets/{identifiant}/slices")
async def decouper(
    requete: Request, identifiant: str, corps: CorpsDecoupe
) -> dict[str, Any]:
    """Une planche de huit devient huit assets, chacun filié (US-72, US-74)."""
    boites = [tuple(b) for b in corps.boites]  # type: ignore[misc]
    return _atelier(requete).decoupe.decouper(identifiant, boites)


# ── Les recettes nommées ─────────────────────────────────────────────────────


@routeur.get("/recipes")
async def liste_recettes(requete: Request) -> dict[str, Any]:
    recettes = _atelier(requete).assets.recettes()
    return {"recettes": {nom: r.en_json() for nom, r in recettes.items()}}


@routeur.put("/recipes/{nom}")
async def nommer_recette(
    requete: Request, nom: str, corps: CorpsRecette
) -> dict[str, Any]:
    recettes = _atelier(requete).assets.nommer(nom, corps.en_recette())
    return {"recettes": {n: r.en_json() for n, r in recettes.items()}}


@routeur.delete("/recipes/{nom}")
async def oublier_recette(requete: Request, nom: str) -> dict[str, Any]:
    recettes = _atelier(requete).assets.oublier_recette(nom)
    return {"recettes": {n: r.en_json() for n, r in recettes.items()}}


# ── Les jeux de réglages nommés ──────────────────────────────────────────────
#
# **Le quatrième rôle d'une réinjection**, déclaré en T1 et resté vide depuis
# (US-12). Le seul des quatre qui n'envoie aucune image : il repeuple le
# générateur au lieu de partir avec l'appel.
#
# Un jeu de sa propre route, et pas un champ de plus sur `/recipes` : une recette
# dit ce qu'on fait à une image **déjà payée**, un jeu de réglages dit ce qui part
# **avant** de payer. Deux moments, deux questions, deux adresses.


class CorpsReglages(BaseModel):
    """Ce qui part, et comment — **jamais pour qui** (US-134).

    Ni personnage, ni pose, ni prompt : c'est toute la promesse du geste, *se
    rappeler d'un geste sur un autre personnage*. Un jeu qui porterait le
    personnage serait un jeu qu'on ne pourrait rejouer que sur lui.
    """

    modele: str = ""
    proportions: str = "1:1"
    resolution: str | None = None
    options: dict[str, Any] = Field(default_factory=dict)
    echelle: str = ""
    references: list[CorpsReinjection] = Field(default_factory=list)
    references_ecartees: list[str] = Field(default_factory=list)


@routeur.get("/presets")
async def liste_reglages(requete: Request) -> dict[str, Any]:
    return {"reglages": _atelier(requete).generations.reglages()}


@routeur.put("/presets/{nom}")
async def nommer_reglages(
    requete: Request, nom: str, corps: CorpsReglages
) -> dict[str, Any]:
    return {
        "reglages": _atelier(requete).generations.nommer_reglages(
            nom, corps.model_dump()
        )
    }


@routeur.delete("/presets/{nom}")
async def oublier_reglages(requete: Request, nom: str) -> dict[str, Any]:
    return {"reglages": _atelier(requete).generations.oublier_reglages(nom)}


def _asset(requete: Request, identifiant: str) -> Asset:
    asset = _atelier(requete).assets.lire(identifiant)
    if asset is None:
        raise AssetInconnu(identifiant)
    return asset
