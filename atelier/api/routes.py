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
from pydantic import BaseModel, Field, field_validator

from atelier.domaine import (
    Asset,
    Demande,
    Generation,
    Modele,
    Recette,
    Reinjection,
    Tri,
)
from atelier.domaine.catalogue import modele_en_json
from atelier.domaine.recette import (
    CERCLES,
    DEHORS,
    EPAISSEUR_MAX,
    PLACES,
    RAYON_MAX,
    SEUIL_COULEUR,
    places_inconnues,
)
from atelier.domaine.superposition import (
    CALQUE,
    ECHELLE_MAX,
    ECHELLE_MIN,
    Superposition,
)
from atelier.domaine.erreurs import ErreurAtelier, GenerationInconnue
from atelier.image import rendre_en_png, vignette
from atelier.reglages import deposer_cle, etat_cle
from atelier.services import Atelier
from atelier.services.assets import AssetInconnu, TRACE_MAX

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
    piece: str = Query(""),
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
        # **La pièce armée**, ou rien. Elle change deux choses ici : les concept
        # arts qu'elle désigne partent avec l'appel, et la planche d'équipement
        # compte comme une image de plus dès la première case — une planche
        # d'une seule pose reste une planche.
        piece=piece or None,
    )
    demande = _demande_de_jauge(compte["total"], proportions, resolution)
    defaut = atelier.catalogue.defaut(demande)
    univers = atelier.univers.univers(projet)
    # **Le défaut suit ce qu'on fabrique, et une planche n'est pas un sujet.**
    # Un lot armé demande une planche : c'est le modèle de planche du projet qui
    # décide, avant la famille du sujet — mesuré le 28 août, un modèle rend les
    # traits du gabarit dans l'image là où un autre les ignore. Sans réglage,
    # la famille reprend la main, puis le catalogue : trois niveaux, aucun trou.
    # **Trois niveaux, et le premier dépend de la sorte d'appel.** Habiller un
    # corps est une édition : c'est `modele_edition` qui décide, écrit en C2 et
    # lu ici pour la première fois (C3). Créer une planche est autre chose, et
    # c'est `modele_planche`. Sans réglage, la famille du sujet reprend la main,
    # puis le catalogue : aucun trou, seulement un réglage qu'on n'a pas posé.
    du_projet = (
        (univers.modele_edition or None)
        if piece
        else (univers.modele_planche or None)
        if cases >= 2
        else (univers.modele(compte["famille"]) if compte["famille"] else None)
    )
    return {
        "recu_le": etat.recu_le,
        "repli": etat.repli,
        "raison": etat.raison,
        "defaut": {"modele": du_projet or defaut.modele, "options": defaut.options},
        "references": compte,
        # **Ce que cet appel-là coûterait chez chaque modèle** (US-121). Une
        # mesure, jamais un tarif : le produit ne porte aucun prix de catalogue,
        # et « le coût réel facturé fait foi » partout ailleurs. Un modèle jamais
        # appelé n'y figure pas — le produit dit alors qu'il ne sait pas plutôt
        # que d'inventer un chiffre.
        #
        # **Le compte d'images qui partiront entre dans le calcul depuis E14**, et
        # il le fallait : la barre qui paie affichait la médiane de *tous* les
        # appels de ce modèle, images ou non, pendant que l'écran de confirmation
        # — un clic plus loin — comptait celles de cet appel-ci. Les deux
        # annonçaient $0,0160 et $0,0064 pour la même chose, tous les deux justes.
        # C'est `compte["total"]` qui les réconcilie : c'est le nombre d'images
        # qui partiront vraiment, celui-là même dont l'autre écran se sert.
        "couts": {
            m.identifiant: cout
            for m in etat.modeles
            if (
                cout := atelier.generations.cout_attendu(
                    m.identifiant, compte["total"]
                )
            )
            is not None
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
    # **Et sous quel angle** (E10). Vide pour un jeu qui n'a pas déclaré de
    # directions : le mot ne paraît alors nulle part dans le produit.
    direction: str | None = None
    # **Les directions d'une planche de pose** (E13). Deux ou plus, et l'appel
    # part en une planche dont chaque case sait déjà dans quelle direction son
    # image se rangera — le rangement cesse d'être un geste séparé qu'on peut
    # oublier, puisque c'est une condition de l'appel. Une seule direction, et
    # c'est la case de C1, que `direction` désigne.
    directions: list[str] | None = None
    # **Les cases d'un lot plié** (US-128). Deux poses ou plus, et l'appel part
    # en une seule planche que l'atelier dépliera lui-même. **La même route que
    # tout le reste**, et c'est la décision : il n'existe qu'un seul endroit
    # d'où l'on paie dans tout le produit, et une seconde route de génération en
    # aurait fait deux. Vide ou à une seule pose, c'est la génération de C1 —
    # `pose` dit alors la case, et rien n'est plié.
    poses: list[str] | None = None
    # **La pièce que cet appel pose** (US-140). Présente, la planche part
    # **pleine** des corps que `poses` désigne, et ce qui revient est comparé
    # case par case à ce qui est parti : N calques pour un appel. Absente, c'est
    # une planche de création — celle de C2 —, et il n'y a rien à comparer.
    #
    # **Le même endroit d'où l'on paie**, encore : il n'existe qu'une route de
    # génération dans tout le produit, et une seconde pour l'équipement en aurait
    # fait deux à tenir d'accord.
    piece: str | None = None
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
    # **Ce que l'écran de confirmation a trié** (E14). Les lignes éteintes,
    # celles rallumées, les textes corrigés — et **rien de tout cela ne remonte**
    # : le tri habille cet appel-ci et disparaît ensuite. Garder une correction
    # sur la chose du jeu est un second geste, qui passe par sa fiche.
    tri: dict[str, Any] | None = None
    # **La palette en image** (E14) : une bande de pastilles qui occupe une des
    # places de référence du modèle. Redessinée à chaque appel, jamais relue.
    palette: bool = False


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
        palette=corps.palette,
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
        direction=corps.direction,
        directions=corps.directions,
        poses=corps.poses,
        piece=corps.piece,
        references_ecartees=corps.references_ecartees,
        tri=Tri.depuis_json(corps.tri),
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
    piece: str | None = None
    # La planche d'une pose (E13) : une pose, ses directions. L'aperçu passe par
    # le même pliage que l'envoi, donc il montre les mêmes consignes de case.
    pose: str | None = None
    directions: list[str] | None = None
    # **Et l'angle d'une case seule** (E14). La consigne de l'attitude et celle
    # de la direction ne vivent plus dans le champ : elles sont une ligne à part,
    # composée ici, et l'aperçu doit donc savoir laquelle.
    direction: str | None = None
    # **Ce que l'écran de confirmation a trié** — les lignes éteintes, celles
    # rallumées, les textes corrigés. Il ne vaut que pour cet appel, et il ne
    # s'enregistre nulle part : il habille l'aperçu comme il habillera l'envoi.
    tri: dict[str, Any] | None = None
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
        piece=corps.piece or None,
        pose=corps.pose or None,
        direction=corps.direction or None,
        directions=corps.directions,
        tri=Tri.depuis_json(corps.tri),
    )


class CorpsEnvoi(CorpsApercu):
    """Ce qui part, **texte et images ensemble** (E14).

    **Un `CorpsApercu` élargi, et cette fois les réglages comptent** : le modèle
    décide du nombre de places d'images et du prix, l'échelle décide des artworks
    qui partent, les réinjections et les écartées décident de ce qui reste coché.
    L'aperçu du texte seul n'en avait pas besoin ; l'écran qui montre le prix, si.
    """

    modele: str = ""
    echelle: str = ""
    variations: int = 1
    references: list[CorpsReinjection] = Field(default_factory=list)
    references_ecartees: list[str] | None = None
    direction: str | None = None


@routeur.post("/outgoing")
async def envoi(requete: Request, corps: CorpsEnvoi) -> dict[str, Any]:
    """Tout ce que l'écran de confirmation montre, en un aller-retour (E14).

    **`POST` pour une lecture**, comme l'aperçu du prompt et pour la même
    raison : le corps porte un prompt entier et des listes d'identifiants, que
    l'on ne met pas dans une adresse.

    Rien n'est facturé, rien n'est enregistré, aucun appel ne sort de la machine.
    L'écran arme ; c'est la barre qui paie qui appelle.
    """
    return _atelier(requete).envoi.envoi(
        projet=corps.projet,
        sujet=corps.prompt.strip(),
        modele=corps.modele,
        repris=corps.repris,
        echelle=corps.echelle,
        personnage=corps.personnage or None,
        pose=corps.pose or None,
        direction=corps.direction or None,
        poses=corps.poses,
        directions=corps.directions,
        piece=corps.piece or None,
        references=[
            Reinjection(asset=r.asset, role=r.role) for r in corps.references
        ],
        references_ecartees=corps.references_ecartees,
        variations=corps.variations,
        tri=Tri.depuis_json(corps.tri),
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
    # La pipette : le pixel visé dans l'image **brute**, et ce qu'on retire
    # depuis lui. **Un point, jamais une tache** — l'arbitrage de E3, écrit en
    # long sur `Passe`. Le cadre haut n'est pas borné ici : une image fait la
    # taille qu'elle fait, et un point qui dépasse ne retire simplement rien.
    point: list[int] | None = None
    portee: str = "tache"
    # **Retirée du calcul le temps qu'on regarde** (U10) — jamais retirée de la
    # recette : elle garde tous ses réglages, et la remontrer rend exactement
    # l'image d'avant. Le défaut par défaut est *visible*, si bien qu'une
    # recette écrite avant ce champ arrive inchangée.
    masquee: bool = False
    # **La forme entourée à main levée** (U12), en pixels de l'image brute. Le
    # plafond est celui du service, redit ici pour que `/api/docs` le montre :
    # un tracé est une suite de points, et une suite sans borne est une porte
    # ouverte à un seul appel qui occupe la machine.
    trace: list[list[int]] | None = Field(default=None, max_length=TRACE_MAX)


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


class CorpsTrait(BaseModel):
    """Un passage de la main — ce qu'un geste a gardé, ôté, ou posé.

    **Un chemin et un rayon, jamais un masque en octets** : ce qui traverse le
    port est ce que la recette enregistre, et une recette porte un calcul, pas
    une image. Les points sont en pixels de l'image **rendue**, et un point hors
    du cadre se borne au lieu d'être refusé.

    **Rayon 0, c'est le pixel** : les deux échelles — à main levée, puis au
    pixel — sont les deux bouts d'un seul réglage (US-149, US-207).

    *Écrit ici depuis E5, et importé par la production.* Il servait aux deux
    couches de la main d'un calque d'équipement ; la main est devenue la
    septième place de la recette, donc le passage appartient à la recette.
    `couleur` est vide partout où le passage décide d'un masque — les deux
    couches d'un calque, et l'opacité de la septième place.
    """

    garde: bool = True
    rayon: int = Field(0, ge=0, le=RAYON_MAX)
    points: list[tuple[int, int]] = Field(default_factory=list)
    couleur: str = ""


class CorpsContour(BaseModel):
    """La sixième place (E5).

    **La couleur n'a pas de borne**, et c'est une décision : *une couleur hors
    palette se marque, elle ne se refuse pas* (US-210). Le traitement rend du
    noir sur une valeur illisible plutôt que de faire tomber un rendu au milieu
    d'une frappe.
    """

    epaisseur: int = Field(1, ge=1, le=EPAISSEUR_MAX)
    couleur: str = "#000000"
    position: str = DEHORS
    trous: str = CERCLES


class CorpsCalqueDessin(BaseModel):
    nom: str = ""
    visible: bool = True
    passages: list[CorpsTrait] = Field(default_factory=list)


class CorpsMainDeLaRecette(BaseModel):
    """La septième place (E5) — un sol, et ce qu'on empile dessus.

    `calques` est rangé **du dessous vers le dessus**, comme dans le domaine :
    l'ordre de la charge est l'ordre d'application, et c'est l'écran qui
    renverse pour montrer une pile.
    """

    opacite: list[CorpsTrait] = Field(default_factory=list)
    calques: list[CorpsCalqueDessin] = Field(default_factory=list)


class CorpsRecette(BaseModel):
    """La recette telle qu'elle arrive de l'écran.

    Les bornes sont déclarées deux fois — ici en `Field`, et dans le service.
    Ce n'est pas une redite : celles-ci rendent un 422 lisible dans `/api/docs`
    et arrêtent une valeur absurde avant qu'elle n'entre, celles du service
    valent pour **toute** provenance — une recette relue d'un fichier, une
    recette nommée devenue caduque, un agent en T7 qui n'a jamais vu cet écran.

    **Il n'y a pas de champ `difference`, et c'est voulu.** Une différence nomme
    une seconde image et se pose par ses propres routes — le rectangle par
    `PUT /assets/{id}/layer`, les deux couches de la main par
    `PUT /assets/{id}/layer/hand`. La route qui reçoit cette charge appelle donc
    `poser_les_places`, qui laisse la différence où elle est.
    """

    passes: list[CorpsPasse] = Field(default_factory=list)
    recadrage: CorpsRecadrage | None = None
    grille: CorpsGrille | None = None
    quantification: CorpsQuantification | None = None
    bords: CorpsBords | None = None
    contours: CorpsContour | None = None
    main: CorpsMainDeLaRecette | None = None
    # **Les places endormies** (U4). Une liste de noms de places, vide dans
    # l'immense majorité des recettes. Le nom est vérifié ici plutôt que d'être
    # perdu en silence par le domaine : une recette venue d'un agent qui
    # écrirait *quantifications* au pluriel doit l'apprendre, sans quoi elle
    # croirait avoir endormi une place et regarderait le rendu sans comprendre.
    veille: list[str] = Field(default_factory=list)
    nom: str | None = None

    @field_validator("veille")
    @classmethod
    def _places_connues(cls, valeur: list[str]) -> list[str]:
        inconnues = places_inconnues(valeur)
        if inconnues:
            raise ValueError(
                f"place inconnue : {', '.join(inconnues)} — "
                f"les places sont {', '.join(PLACES)}"
            )
        return valeur

    def en_recette(self) -> Recette:
        return Recette.depuis_json(self.model_dump())


class CorpsImport(BaseModel):
    """Un fichier local, nommé par son chemin.

    Le chemin plutôt que les octets : l'appelant est sur la même machine —
    c'est vrai de l'agent —, et faire transiter dix mégaoctets en base64 par une
    boucle locale serait payer un transport qui n'existe pas. **Un navigateur,
    lui, ne donne jamais de chemin** : c'est `POST /assets/upload` qui le sert,
    et les deux appellent le même service.
    """

    chemin: str = Field(min_length=1)
    projet: str | None = None
    # **Le traitement du projet s'applique-t-il ?** Faux par défaut, des deux
    # côtés (US-170) : un agent et un auteur ne vivent pas dans deux produits
    # différents, et « telle quelle » est le défaut du produit.
    traiter: bool = False
    forcer: bool = False


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
    return _atelier(requete).generations.importer(
        chemin.read_bytes(),
        chemin.name,
        projet=corps.projet,
        traiter=corps.traiter,
        forcer=corps.forcer,
    )


@routeur.post("/assets/upload", status_code=201)
async def televerser_asset(
    requete: Request,
    nom: str = "",
    projet: str | None = None,
    traiter: bool = False,
    forcer: bool = False,
) -> dict[str, Any]:
    """Faire entrer une image **depuis l'écran** (US-167, US-168).

    **La seule pièce neuve du serveur pour cette tranche**, et elle existe parce
    que celle d'à côté prend un *chemin* — ce qu'un navigateur ne donne jamais.
    Elle appelle le même service : « ce que l'agent peut faire, l'écran le peut
    aussi » reste vrai dans les deux sens, et il n'y a toujours qu'un seul
    endroit qui fasse entrer une image.

    Les octets sont le corps de la requête, bruts. **Pas de `multipart`**, et
    c'est la décision de `POST /board/paste` reconduite telle quelle : il
    demanderait `python-multipart`, une dépendance d'exécution de plus pour
    transporter ce qu'un `POST` transporte déjà.

    **Une image par appel**, pour la raison de la tranche T4 : douze fichiers
    déposés font douze appels, donc douze réponses — onze assets et un refus qui
    nomme le fichier (US-169). Un lot unique aurait dû inventer une forme de
    réponse partielle, et il aurait fait attendre les onze premiers que le
    douzième soit lu.

    Rend `{"asset": …, "doublon": …}`, dont l'un est toujours nul. Aucun appel au
    fournisseur : l'import marche réseau coupé.
    """
    return _atelier(requete).generations.importer(
        await requete.body(), nom, projet=projet, traiter=traiter, forcer=forcer
    )


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


@routeur.get("/assets/{identifiant}/spots")
async def taches_de_asset(
    requete: Request, identifiant: str, limite: int = Query(200, ge=1, le=2000)
) -> dict[str, Any]:
    """Ce qu'une table a besoin de savoir de l'image (E3).

    Les taches que le nettoyage des bords va effacer, les poches de fond que le
    sujet enferme, et les crans d'occupation où la remise sur grille change
    quelque chose. **Aucune n'est un réglage** : elles décrivent, et c'est
    l'auteur qui décide.

    À part de l'asset pour la raison de `imposed` : la charge d'un asset part
    deux cents fois par relecture de grille, et un remplissage par plages sur
    mille pixels de côté n'a rien à y faire.
    """
    return _atelier(requete).assets.taches_de(identifiant, limite)


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
    asset = _atelier(requete).assets.poser_les_places(identifiant, corps.en_recette())
    return asset.en_json()


@routeur.post("/assets/{identifiant}/reset")
async def revenir_au_brut(requete: Request, identifiant: str) -> dict[str, Any]:
    """Revenir à l'image brute, d'un seul geste (US-64)."""
    return _atelier(requete).assets.revenir_au_brut(identifiant).en_json()


@routeur.post("/assets/{identifiant}/apply/{nom}")
async def appliquer_recette_nommee(
    requete: Request, identifiant: str, nom: str
) -> dict[str, Any]:
    """La même recette, sur un autre asset, au pixel près (US-66).

    **Rend l'asset et ce qui n'a pas voyagé** (U5). Un rappel qui poserait en
    silence une recette amputée laisserait l'auteur devant une image qui n'est
    pas celle qu'il attendait, sans rien pour comprendre pourquoi.
    """
    asset, laisse = _atelier(requete).assets.appliquer_nommee(identifiant, nom)
    return {"asset": asset.en_json(), "laisse": list(laisse)}


@routeur.post("/assets/{identifiant}/paste")
async def coller_recette(
    requete: Request, identifiant: str, corps: CorpsRecette
) -> dict[str, Any]:
    """Coller sur cette image les réglages d'une autre (U5).

    **Une route à part de `PUT …/recipe`**, et la différence est le contrat :
    celle-ci *coupe* ce qui ne voyage pas et le dit, l'autre pose exactement ce
    qu'on lui donne. Les confondre aurait fait de chaque réglage posé un collage
    — et un cadre tracé serait tombé au premier envoi de la table de recadrage.
    """
    asset, laisse = _atelier(requete).assets.coller(identifiant, corps.en_recette())
    return {"asset": asset.en_json(), "laisse": list(laisse)}


@routeur.get("/assets/{identifiant}/image")
async def image_asset(
    requete: Request,
    identifiant: str,
    brut: bool = Query(False),
    avant: bool = Query(False),
) -> Response:
    """Le rendu, ou le brut si on le demande — c'est la bascule de la fiche.

    Un rendu dont le fichier a disparu du disque **se recalcule ici**, sans que
    l'appelant ait à le savoir : « supprimer le fichier de rendu ne perd rien »
    (`docs/PLAN.md`, T2).

    `avant` rend le calque tel que la différence l'avait produit, **avant que la
    main y passe** (C4, US-151) — l'autre moitié de la comparaison d'un seul
    geste. Il n'écrit rien : ni cache, ni asset. Sur une image que la main n'a
    pas touchée, il rend le rendu ordinaire plutôt qu'un refus — la question a
    une réponse, et c'est l'image elle-même.
    """
    atelier = _atelier(requete)
    octets, type_media = atelier.assets.octets(
        _asset(requete, identifiant), brut=brut, avant=avant
    )
    return Response(
        content=octets,
        media_type=type_media,
        headers={"Cache-Control": _garder(requete)},
    )


# **Combien de temps le navigateur a le droit de garder une image.**
#
# L'interdiction était totale — `no-store` —, et elle avait une bonne raison :
# le rendu change à chaque cran de curseur, et une image gardée ferait regarder
# la version d'avant. Sauf que **l'adresse porte déjà l'empreinte de la
# recette** (`v=…`, posé par `interface/src/api.ts`) : elle change dès que
# l'image change, donc garder ne peut plus servir du périmé. L'interdiction
# était devenue une interdiction pour rien, et elle coûtait cher — mesuré le
# 31 août 2026, un seul passage sur la galerie retéléchargeait 25,5 Mo.
#
# **Sans `v`, on ne garde rien.** Une adresse sans empreinte est une adresse qui
# ne changera pas quand son contenu changera — le seul cas où l'ancienne raison
# tient encore, et il vaut mieux qu'il soit lent que faux.
_UN_AN = "public, max-age=31536000, immutable"


def _garder(requete: Request) -> str:
    return _UN_AN if requete.query_params.get("v") else "no-store"


@routeur.get("/assets/{identifiant}/vignette")
async def vignette_asset(
    requete: Request, identifiant: str, cote: int = Query(256, ge=16, le=1024)
) -> Response:
    """L'image réduite pour une case de grille — jamais le fichier entier.

    « La galerie télécharge vingt-six mégaoctets pour montrer quarante-neuf
    timbres-poste » : une vignette de 145 px recevait jusqu'à 1024 px de côté,
    318 Ko en moyenne, pour en afficher moins d'un vingtième.

    **Le cran demandé, pas une taille libre** : la grille n'a que trois crans
    (`docs/DESIGN.md`), donc trois adresses par image et pas une par largeur de
    fenêtre — sans quoi le cache du navigateur ne servirait jamais deux fois.

    La réduction est au plus proche voisin : voir `atelier.image.vignette`.
    """
    atelier = _atelier(requete)
    octets, _ = atelier.assets.octets(_asset(requete, identifiant))
    return Response(
        content=vignette(octets, cote),
        media_type="image/png",
        headers={"Cache-Control": _garder(requete)},
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


# ── La superposition ─────────────────────────────────────────────────────────
#
# **Quatre routes, et la coupure est la même que pour le slicer** : ce qui ne
# crée rien se redemande à chaque cran de réglage, ce qui crée des assets ne se
# redemande jamais. `ouvrir` et `preview` ne touchent pas au disque ; `overlay`
# écrit, `replay` réécrit à la même place.


class CorpsSuperposition(BaseModel):
    """Une pose, telle qu'elle arrive de l'écran.

    Les bornes sont déclarées deux fois — ici et dans le service —, comme pour
    la recette : celles-ci rendent un 422 lisible dans `/api/docs`, celles du
    service valent pour toute provenance.
    """

    dessus: str = Field(min_length=1)
    dessous: str = Field(min_length=1)
    echelle: float = Field(1.0, ge=ECHELLE_MIN, le=ECHELLE_MAX)
    dx: int = 0
    dy: int = 0
    rectangle: list[int] | None = Field(None, min_length=4, max_length=4)
    seuil: int = Field(SEUIL_COULEUR, ge=0, le=255)
    main: list[CorpsTrait] = Field(default_factory=list)
    sortie: str = CALQUE

    def en_pose(self) -> Superposition:
        return Superposition.depuis_json(self.model_dump())


class CorpsFabrique(BaseModel):
    """Ce qu'on coche avant de fabriquer.

    **Les deux sorties se cochent au lieu de s'exclure** : on veut souvent le
    calque pour le réutiliser et l'aplat pour l'avoir tout de suite.
    """

    pose: CorpsSuperposition
    sorties: list[str] = Field(default_factory=lambda: [CALQUE])
    garder: bool = False


@routeur.get("/assets/{identifiant}/overlay")
async def ouvrir_superposition(
    requete: Request, identifiant: str, dessous: str | None = Query(None)
) -> dict[str, Any]:
    """L'état de départ de l'outil, en un appel (US-211).

    Rien n'est créé, rien n'est écrit : c'est une lecture, et elle porte le
    préremplissage avec sa provenance.
    """
    return _atelier(requete).superposition.ouvrir(identifiant, dessous)


@routeur.get("/assets/{identifiant}/overlay/fit")
async def recaler_superposition(
    requete: Request, identifiant: str, dessous: str = Query(...)
) -> dict[str, Any]:
    """La proposition de calage — trois valeurs, et rien d'autre (US-213).

    **Un bouton, pas un mode** : elle remplit les champs et s'arrête là.
    """
    return _atelier(requete).superposition.recaler(identifiant, dessous)


@routeur.post("/assets/{identifiant}/overlay/inherit")
async def heriter_du_detourage(
    requete: Request, identifiant: str, dessous: str = Query(...)
) -> dict[str, Any]:
    """Le dessus reprend les passes du dessous (US-212).

    Ce qu'elle pose va dans **la recette de l'image**, pas dans la
    superposition : le détourage d'une image est vrai pour elle-même.
    """
    return _atelier(requete).superposition.heriter(identifiant, dessous).en_json()


@routeur.post("/overlay/preview")
async def apercu_superposition(
    requete: Request, corps: CorpsSuperposition
) -> dict[str, Any]:
    """Les deux sorties et les cinq mesures, **sans rien écrire** (US-214).

    Les images repartent en `data:` : un aperçu n'existe nulle part sur le
    disque, et lui donner une adresse aurait obligé à ranger un brouillon —
    donc à le nettoyer.
    """
    return _atelier(requete).superposition.apercu(corps.en_pose())


@routeur.post("/overlay")
async def fabriquer_superposition(
    requete: Request, corps: CorpsFabrique
) -> dict[str, Any]:
    """Une image par sortie cochée — des assets entiers, sur le disque."""
    return _atelier(requete).superposition.fabriquer(
        corps.pose.en_pose(), corps.sorties, corps.garder
    )


@routeur.put("/assets/{identifiant}/overlay")
async def rejouer_superposition(
    requete: Request, identifiant: str, corps: CorpsSuperposition
) -> dict[str, Any]:
    """Refaire une superposition déjà fabriquée, à la même place (US-213).

    **Pas un centime** : les deux images sont sur le disque.
    """
    return (
        _atelier(requete)
        .superposition.rejouer(identifiant, corps.en_pose())
        .en_json()
    )


@routeur.delete("/assets/{identifiant}/overlay/saved")
async def oublier_reglages_superposition(
    requete: Request, identifiant: str
) -> dict[str, Any]:
    """« Repartir de zéro › » — la règle du prérempli qui se défait d'un clic."""
    return _atelier(requete).superposition.oublier(identifiant).en_json()


# ── Les recettes nommées ─────────────────────────────────────────────────────


@routeur.get("/recipes")
async def liste_recettes(requete: Request) -> dict[str, Any]:
    recettes = _atelier(requete).assets.recettes()
    return {"recettes": {nom: r.en_json() for nom, r in recettes.items()}}


@routeur.put("/recipes/{nom}")
async def nommer_recette(
    requete: Request, nom: str, corps: CorpsRecette
) -> dict[str, Any]:
    recettes, laisse = _atelier(requete).assets.nommer(nom, corps.en_recette())
    # **Ce qui n'a pas été enregistré se dit tout de suite** (U5) : au moment où
    # l'on nomme, pas au moment où l'on s'étonne de ce qui revient.
    return {
        "recettes": {n: r.en_json() for n, r in recettes.items()},
        "laisse": list(laisse),
    }


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
