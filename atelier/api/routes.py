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
    USD,
    Asset,
    Demande,
    Generation,
    Modele,
    Recette,
    Reinjection,
    Reserve,
    Tri,
)
from atelier.domaine.catalogue import modele_en_json
from atelier.domaine.recette import (
    ANGLE_MAX,
    ANGLE_MIN,
    AU_PLUS_PROCHE,
    BRUTE,
    CANEVAS_MAX,
    CERCLES,
    CURSEUR_MAX,
    CURSEUR_MIN,
    DEHORS,
    FORCE_TRAMAGE_LIVREE,
    MEDIANE,
    EPAISSEUR_MAX,
    GARDER_MAX,
    GAUCHE,
    GAUCHE_DROITE,
    GRAIN_MAX,
    LISSAGE_MAX,
    MORPHOLOGIE_MAX,
    OCCUPATION_MAX_ABSOLU,
    PLACES,
    RAYON_MAX,
    SEUIL_COULEUR,
    TEINTE_MAX,
    TEINTE_MIN,
    TOLERANCE_ECHANGE_MAX,
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
from atelier import reglages
from atelier.reglages import deposer_secret, retirer_secret
from atelier.services import Atelier
from atelier.services.assets import AssetInconnu, CIBLE_MAX, CIBLE_MIN, TRACE_MAX
from atelier.services.export import Archive
from atelier.services.catalogue import EtatFournisseur

routeur = APIRouter()

# Combien de temps le flux reste muet avant d'envoyer un signe de vie. Un
# atelier peut rester une heure sans rien produire ; sans ce battement, un
# mandataire ou un pare-feu couperait la liaison et l'onglet ne le saurait pas.
BATTEMENT_S = 15.0

# Un commentaire SSE : la liaison reste ouverte, l'onglet n'a rien à lire.
BATTEMENT = ": battement\n\n"


def _atelier(requete: Request) -> Atelier:
    return requete.app.state.atelier


def reponse_archive(archive: Archive) -> Response:
    """Une archive rendue au navigateur, **et il y a trois routes qui le font**.

    Une pour une sélection d'images (T6), deux pour des animations (`A4`). Les
    trois disent la même chose, et l'en-tête du milieu est celui qu'on oublie :
    sans lui, le navigateur *reçoit* le nom du fichier mais `fetch` ne le voit
    pas, et l'interface sauve l'archive sous un nom qu'elle a inventé. C'était
    déjà écrit une fois ; le recopier une troisième aurait fini par le perdre
    quelque part.
    """
    return Response(
        content=archive.octets,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{archive.nom}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


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
                    # **Scopé au jeu ouvert** (B4) : sans ce filtre, le
                    # chantier du jeu précédent restait à l'écran après un
                    # changement de jeu — sa tuile ne partait qu'à la
                    # prochaine génération, jamais au changement lui-même.
                    "generations": [
                        g.en_json()
                        for g in atelier.generations.chantier(
                            limite,
                            projet=atelier.bibliotheque.courant,
                            sans_projet=atelier.bibliotheque.courant is None,
                        )
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


class CorpsSecret(BaseModel):
    valeur: str = Field(min_length=8)


@routeur.get("/settings/keys")
async def lire_tiroirs(requete: Request) -> dict[str, Any]:
    """Le tiroir à secrets, **une place par fournisseur** (F3).

    Il remplace `GET /settings/key`, qui ne pouvait décrire qu'un monde à un
    fournisseur. Un fournisseur qui ne demande rien y paraît quand même, avec un
    tiroir vide : *« celui-ci ne demande rien »* est un renseignement, et c'est
    le premier que l'auteur cherche sur une machine neuve.
    """
    return {"tiroirs": [t.en_json() for t in _atelier(requete).fournisseurs.tiroirs()]}


@routeur.put("/settings/keys/{nom}")
async def poser_secret(requete: Request, nom: str, corps: CorpsSecret) -> dict[str, Any]:
    """Déposer une valeur — **et ne toucher à aucune autre** (F3, US-4).

    `nom` est le nom d'environnement d'une place **qu'un fournisseur a
    déclarée** : le produit n'écrit pas ailleurs. Une route qui accepterait
    n'importe quel nom laisserait écrire n'importe quoi dans le `.env` de
    l'auteur, depuis un navigateur.
    """
    atelier = _atelier(requete)
    if atelier.fournisseurs.secret(nom) is None:
        raise ErreurAtelier(
            f"aucun fournisseur ne demande « {nom} »", ou_aller="reglages"
        )
    try:
        deposer_secret(nom, corps.valeur)
    except ValueError as erreur:
        raise ErreurAtelier(str(erreur), ou_aller="reglages") from None
    return {"tiroirs": [t.en_json() for t in atelier.fournisseurs.tiroirs()]}


@routeur.delete("/settings/keys/{nom}")
async def enlever_secret(requete: Request, nom: str) -> dict[str, Any]:
    """Retirer une valeur — **et rien d'autre** (F3).

    *Retirer une clé grise ses modèles et ne supprime ni une image, ni une ligne
    de dépense.* Cette route ne touche qu'à un fichier de configuration, et il
    n'existe aucun chemin d'ici vers `donnees/` : la règle est tenue par ce qui
    n'est pas écrit plutôt que par une précaution.
    """
    atelier = _atelier(requete)
    if atelier.fournisseurs.secret(nom) is None:
        raise ErreurAtelier(
            f"aucun fournisseur ne demande « {nom} »", ou_aller="reglages"
        )
    retirer_secret(nom)
    return {"tiroirs": [t.en_json() for t in atelier.fournisseurs.tiroirs()]}


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


# ── L'installation de la machine (B15) ───────────────────────────────────────
#
# **Sept routes, et aucune ne déplace ni n'efface quoi que ce soit.** Elles
# posent une adresse, examinent un chemin, créent un dossier vide quand on le
# leur demande explicitement, et mesurent. Le dossier de travail choisi prend
# effet **au démarrage suivant** : rien ne bouge sur le disque, et revenir en
# arrière c'est retaper l'ancien chemin (`docs/tranches/V4.md` § B15).
#
# ⚠️ **Aucune valeur de secret ne passe par ici.** Les trois routes qui touchent
# aux clés sont plus haut, inchangées depuis F3, et elles ne rendent jamais
# qu'un aperçu de six caractères.


class CorpsChemin(BaseModel):
    """Un chemin de dossier, tapé à la main.

    **Dans le corps, jamais dans l'adresse.** Un chemin de disque désigne la
    machine de quelqu'un ; il n'a rien à faire dans une URL, où il finirait dans
    les journaux du serveur et l'historique du navigateur.
    """

    chemin: str = Field(min_length=1, max_length=4096)


class CorpsAdresse(BaseModel):
    adresse: str = Field(min_length=1, max_length=512)


@routeur.get("/install")
async def lire_l_installation(requete: Request) -> dict[str, Any]:
    """Les quatre étapes, **en un seul aller-retour**.

    Le dossier et ce qu'il porte, où le fichier de secrets habite, où ComfyUI
    est cherché, les jeux déjà là, et *le tour doit-il se dérouler tout seul*.
    Quatre appels auraient laissé le sommaire annoncer un état et l'étape
    ouverte en montrer un autre.
    """
    return _atelier(requete).installation.etat().en_json()


@routeur.post("/install/workspace/check")
async def examiner_le_dossier(requete: Request, corps: CorpsChemin) -> dict[str, Any]:
    """Ce qu'un chemin est — **et rien n'y est écrit de définitif**.

    La seule écriture est un fichier temporaire posé puis retiré, pour savoir si
    l'atelier pourra vraiment écrire là : `os.access` ment sur Windows, et un
    dossier annoncé inscriptible qui ne l'est pas se découvre à la première
    image reçue, c'est-à-dire après avoir payé.
    """
    return _atelier(requete).installation.examiner(corps.chemin).en_json()


@routeur.put("/install/workspace")
async def poser_le_dossier(requete: Request, corps: CorpsChemin) -> dict[str, Any]:
    """Choisir où l'atelier rangera tout — **à partir du prochain démarrage**.

    Elle n'écrit qu'une ligne dans `installation.json`. **Rien n'est déplacé,
    rien n'est copié, rien n'est effacé** : ce qui est déjà rangé reste où il
    est, et l'écran le dit avec les deux chemins côte à côte.

    Un chemin inutilisable est **refusé**, avec sa raison — et pas créé en
    silence : sur Windows un chemin se tape à la main, et un `mkdir` obligeant
    sèmerait des dossiers vides à la première faute de frappe. Créer est un
    autre appel, et l'écran en fait un autre bouton.
    """
    dossier = _atelier(requete).installation.poser_dossier(corps.chemin)
    if not dossier.utilisable:
        raise ErreurAtelier(dossier.refus or "ce dossier ne convient pas", ou_aller="reglages")
    return {
        "dossier": dossier.en_json(),
        "installation": _atelier(requete).installation.etat().en_json(),
    }


@routeur.post("/install/workspace/create")
async def creer_le_dossier(requete: Request, corps: CorpsChemin) -> dict[str, Any]:
    """Faire exister un dossier vide — **et ne rien poser dessus**.

    Deux gestes pour deux effets : celui-ci crée, l'autre décide. Les confondre
    ferait d'une faute de frappe un dossier semé quelque part *et* un atelier
    qui pointe dessus.
    """
    return _atelier(requete).installation.creer_dossier(corps.chemin).en_json()


@routeur.put("/install/comfy")
async def poser_l_adresse_de_comfy(
    requete: Request, corps: CorpsAdresse
) -> dict[str, Any]:
    """Où chercher ComfyUI. **Prend effet tout de suite**, sans redémarrage.

    Contrairement au dossier de travail : rien n'est ouvert sur cette adresse,
    il n'y a qu'un adaptateur à refabriquer. ⚠️ Avant `B15` cette adresse était
    **en dur** — `ATELIER_COMFY` était cité par un commentaire et lu par
    personne.
    """
    atelier = _atelier(requete)
    return {
        "comfy": atelier.installation.poser_comfy(corps.adresse),
        "origine": reglages.origine_de_l_adresse(),
    }


@routeur.delete("/install/comfy")
async def oublier_l_adresse_de_comfy(requete: Request) -> dict[str, Any]:
    """Revenir à l'adresse d'origine sans avoir à la retaper."""
    atelier = _atelier(requete)
    return {
        "comfy": atelier.installation.oublier_comfy(),
        "origine": reglages.origine_de_l_adresse(),
    }


@routeur.post("/install/done")
async def le_tour_est_fait(requete: Request) -> dict[str, Any]:
    """Le tour a été passé ou terminé — **il ne se rouvrira plus tout seul**.

    Passer et finir écrivent la même chose, et c'est voulu : la planche dit
    *« il ne revient plus de lui-même, même si tout a été passé »*. Il se rouvre
    par le pied du carnet, autant de fois qu'on veut.
    """
    atelier = _atelier(requete)
    atelier.installation.tour_fait()
    return atelier.installation.etat().en_json()


@routeur.post("/install/check/{fournisseur}")
async def verifier_un_fournisseur(requete: Request, fournisseur: str) -> dict[str, Any]:
    """*Ce compte-là ouvre quoi ?* — le bouton **Vérifier**.

    Rend le nombre de modèles vraiment servis et ce qu'il reste sur le compte,
    en une phrase. ⚠️ **Jamais la valeur du secret**, ni entière ni tronquée :
    l'aperçu de six caractères vit ailleurs, et il ne passe pas par ici.

    **Ne lève pas** quand le fournisseur ne répond pas ou refuse la clé : c'est
    précisément ce que le bouton sert à découvrir, et l'écran l'écrit à côté.
    """
    return (await _atelier(requete).fournisseurs.verifier(fournisseur)).en_json()


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
    premiere_planche: bool = Query(False),
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
    # **Une lecture pour toute la liste** (F1) : ce qui manque à un fournisseur
    # se redemande à chaque affichage — une clé déposée agit sans redémarrer —,
    # mais une fois par fournisseur, jamais une fois par modèle.
    grises = atelier.catalogue.grises()
    # **Ce qui reste chez chacun, et d'où le chiffre vient** (F2). Une lecture
    # pour toute la liste, comme le grisé : c'est une question par fournisseur,
    # jamais une par modèle.
    reserves = {r.fournisseur: r for r in atelier.reserves.toutes()}
    projet = atelier.bibliotheque.courant
    # **La première planche** (TS3, grisé ajouté le 24 septembre 2026 après
    # relecture de TS11) : son concept art part comme le personnage à
    # reproduire, et **il ne cède pas** — un modèle qui n'accepte aucune image
    # ne peut pas la faire. Sans ce drapeau, le catalogue ne le savait pas et
    # le refus tombait en 409 à l'envoi ; il se compte maintenant ici, par la
    # même lecture que la soumission. L'écran joint ce même concept art
    # (`armerPremierePlanche`) : ses premières images annoncées sont celles-là,
    # et elles ne se comptent qu'une fois, comme `_sans_le_design` le fait à
    # l'envoi.
    deja_jointes = 0
    if premiere_planche and personnage:
        try:
            deja_jointes = len(
                atelier.generations.premiere_planche(projet, personnage)["design"]
            )
        except ErreurAtelier:
            # Rien à reproduire : l'envoi le refusera avec sa phrase, et la
            # préparation ne s'ouvre pas sans lui. Rien à griser de plus ici.
            deja_jointes = 0
    compte = atelier.generations.compter_references(
        projet,
        echelle,
        tuple(
            Reinjection(asset=f"~{rang}")
            for rang in range(max(0, references - deja_jointes))
        ),
        personnage=personnage or None,
        premiere_planche=premiere_planche,
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
    # **Le grisé se compte sur ce qui ne cède pas** (F6), et non sur tout ce qui
    # partirait. Ce que le produit ajoute de lui-même — artworks du jeu, concept
    # arts, images d'ambiance — cède devant le plafond du modèle plutôt que de
    # le refuser ; garder le total ici griserait tout modèle sans place sur un
    # jeu qui a un seul artwork officiel, c'est-à-dire **le gratuit, presque
    # toujours**. Ce qui cède n'est pas perdu pour autant : l'écran de
    # confirmation le montre avant de lancer, et la fiche de l'image le dit
    # ensuite.
    demande = _demande_de_jauge(compte["incompressibles"], proportions, resolution)
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
        # **Un état par fournisseur** (F1). L'écran en a besoin pour dire *lequel*
        # est coupé, et pour ne pas annoncer une panne générale quand un seul des
        # deux ne répond pas.
        "fournisseurs": [
            f.en_json(grises.get(f.nom), reserves.get(f.nom))
            for f in etat.fournisseurs
        ],
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
        "modeles": [
            _modele_en_json(
                m,
                demande,
                grises.get(m.fournisseur),
                etat.fournisseur(m.fournisseur),
                reserves.get(m.fournisseur),
                # **Un temps, pas un prix, pour un style local** (règle 8ter,
                # ML5) : `couts` ci-dessus reste vide pour eux — un appel local
                # enregistre toujours `cout_usd = 0.0`, que `couts_mesures`
                # écarte — et l'écran qui choisit le modèle doit pourtant
                # savoir ce qu'il prendra avant qu'on le choisisse.
                atelier.generations.temps_attendu(m.identifiant) if m.locale else None,
            )
            for m in etat.modeles
        ],
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


def _modele_en_json(
    modele: Modele,
    demande,
    indisponible: str | None,
    source: "EtatFournisseur | None" = None,
    reserve: "Reserve | None" = None,
    temps: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """La fiche d'un modèle, **la phrase qui le grise, et d'où elle vient**.

    Deux choses peuvent l'empêcher, et l'écran n'en affiche qu'une : ce que son
    fournisseur n'a pas — une clé —, et ce que le modèle ne sait pas faire.
    **Le fournisseur passe en premier**, parce que sa phrase mène à un geste qui
    débloque *tous* ses modèles, là où l'autre ne parle que de celui-ci.

    **Et la fiche dit d'où elle vient** (F1) : relue chez le fournisseur, ou
    relevée ici à telle date. C'est la règle du catalogue de T1 poussée d'un
    cran — *le catalogue décide, jamais une liste en dur* n'a de sens que si
    l'on sait de quand date ce qu'on lit. Les deux champs sont **dérivés** de
    l'état du fournisseur, jamais enregistrés : une fiche ne porte pas sa propre
    fraîcheur, son fournisseur la porte pour elle.
    """
    fiche = modele_en_json(modele)
    fiche["refus"] = indisponible or modele.refus(demande)
    fiche["repli"] = bool(source.repli) if source is not None else False
    fiche["recu_le"] = source.recu_le if source is not None else 0.0
    # **Dans quelle unité ce modèle-là consomme** (F2), dérivée elle aussi de
    # son fournisseur. Sans elle, l'estimation que la barre qui paie affiche à
    # côté de son nom s'écrirait « $0,0000 » pour un modèle gratuit — et se
    # lirait *sans limite* là où il faut lire *sans prix*.
    fiche["unite"] = reserve.unite if reserve is not None else USD
    # **Le temps, pas le prix, pour un style local** (règle 8ter). Absent des
    # modèles distants : ils ont un coût, ce champ ne les concerne pas.
    if modele.locale:
        fiche["temps"] = temps
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
    # **L'origine est entrée dans ce corps avec `RP9`**, et le défaut ne bouge
    # pas : une réinjection posée à la main vient de la bibliothèque, sauf à
    # dire le contraire. Ce qui a changé est que les cartes du tableau **se
    # sélectionnent** — la toile en fait un lot et le donne à la préparation —,
    # alors qu'elles n'entraient jusque-là que par la main de l'application
    # (US-51). Une carte ne part qu'en guide de style : la bibliothèque ne les
    # connaît pas, donc aucune filiation ne peut en descendre.
    origine: Literal["asset", "carte"] = "asset"


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
    # **Refaire une planche** (RS2) : garder la mise en page de la planche du
    # sujet, sinon de la première image jointe — refusé avant de payer sans
    # l'une ni l'autre.
    garder_mise_en_page: bool = False
    # **Couper cette planche dès qu'elle revient** (RS7). Refusé sans
    # `garder_mise_en_page`, par `Demande` elle-même.
    decouper_a_l_arrivee: bool = False
    # **Une chose du jeu par case** (P2, V3.5) : des identifiants de sujets,
    # dans l'ordre de lecture de la planche — la case n porte le sujet n. Deux
    # ou plus, et l'appel part en une planche dont chaque morceau se range chez
    # le sujet de sa case. Ni `personnage`, ni `poses`, ni `piece` à côté ; un
    # décor, une tuile ou un sujet inconnu sont refusés avant de payer.
    sujets: list[str] | None = None
    # **La première planche d'un sujet** (TS3) : la pose de repos dans les
    # directions du jeu, d'après son concept art pris comme le personnage à
    # reproduire. `pose` et `directions` peuvent être omis — le service les
    # remplit — ; donnés, ils doivent être ceux du jeu.
    premiere_planche: bool = False
    # **L'image arrive brute** (TS4) : ni détourage, ni réduction, ni grille,
    # ni palette à sa naissance — la toile qui fabrique en a besoin, une chose
    # du jeu jamais. Ce que l'appel envoie au modèle ne change pas.
    brut: bool = False


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
        garder_mise_en_page=corps.garder_mise_en_page,
        decouper_a_l_arrivee=corps.decouper_a_l_arrivee,
        premiere_planche=corps.premiere_planche,
        brut=corps.brut,
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
            Reinjection(asset=r.asset, role=r.role, origine=r.origine)
            for r in corps.references
        ],
        personnage=corps.personnage,
        pose=corps.pose,
        direction=corps.direction,
        directions=corps.directions,
        poses=corps.poses,
        piece=corps.piece,
        references_ecartees=corps.references_ecartees,
        tri=Tri.depuis_json(corps.tri),
        sujets=corps.sujets,
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
    # **Ce que l'auteur interdit de sa main** (D3). Il entre dans l'aperçu parce
    # que le fond du jeu s'y ajoute : sans lui, l'écran montrerait l'interdiction
    # du produit seule et l'appel en enverrait deux. C'est le seul champ de ce
    # corps qui ne compose pas le prompt — il compose l'*autre* texte qui part.
    prompt_negatif: str = ""
    # **Refaire une planche** (RS2) : le cadre « un seul sprite » cède sa place
    # à la consigne de mise en page, et l'aperçu doit le montrer.
    garder_mise_en_page: bool = False
    # La planche à plusieurs sujets (P2) — même liste que `CorpsGeneration`.
    sujets: list[str] | None = None
    # La première planche (TS3) — même drapeau que `CorpsGeneration`.
    premiere_planche: bool = False
    # La toile (TS4) — même drapeau que `CorpsGeneration`. Avec `repris`, il
    # retire l'ambiance et les artworks de ce qui part : la relecture doit le
    # recevoir pour le dire.
    brut: bool = False


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
        prompt_negatif=corps.prompt_negatif,
        garder_mise_en_page=corps.garder_mise_en_page,
        sujets=corps.sujets,
        premiere_planche=corps.premiere_planche,
        brut=corps.brut,
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
            Reinjection(asset=r.asset, role=r.role, origine=r.origine)
            for r in corps.references
        ],
        references_ecartees=corps.references_ecartees,
        variations=corps.variations,
        tri=Tri.depuis_json(corps.tri),
        prompt_negatif=corps.prompt_negatif,
        garder_mise_en_page=corps.garder_mise_en_page,
        sujets=corps.sujets,
        premiere_planche=corps.premiere_planche,
        brut=corps.brut,
    )


@routeur.get("/outgoing/sheet")
async def image_jointe(
    requete: Request,
    modele: str = Query(...),
    projet: str | None = Query(None),
    personnage: str | None = Query(None),
    pose: str | None = Query(None),
    piece: str | None = Query(None),
    poses: list[str] = Query(default_factory=list),
    directions: list[str] = Query(default_factory=list),
    sujets: list[str] = Query(default_factory=list),
) -> Response:
    """L'image que la planche joint, **telle qu'elle partira** (M4).

    **`GET` là où l'aperçu et la confirmation sont en `POST`**, et ce n'est pas
    une entorse : ceux-là portent un prompt entier, celle-ci ne porte que des
    repères courts. Surtout, c'est une **image**, et une image se met dans un
    `src` — une route en `POST` aurait obligé l'écran à la charger à la main et à
    la garder en mémoire, là où le navigateur sait déjà faire les deux.

    Elle ne facture rien, n'enregistre rien, et ne sort pas de la machine : les
    deux sortes d'images se redessinent du geste à chaque appel.

    **404 quand la planche n'en joint aucune** — un appel sans lot, ou un modèle
    qui n'accepte aucune référence. C'est une absence, pas une panne : l'écran
    n'affiche alors pas de vignette, ce qu'il sait déjà faire pour une référence
    dont l'image a disparu.
    """
    jointe = _atelier(requete).generations.image_jointe(
        projet,
        personnage or None,
        modele=modele,
        pose=pose or None,
        piece=piece or None,
        poses=poses or None,
        directions=directions or None,
        sujets=sujets or None,
    )
    if jointe is None:
        # Un 404 nu, et pas un refus du domaine : il n'y a rien de fautif à
        # dire. L'écran ne demande cette adresse que lorsque la confirmation lui
        # a annoncé une image jointe ; ce code-ci est le garde-fou du cas où
        # l'appel a changé entre les deux.
        return Response(status_code=404)
    return Response(content=jointe[1], media_type="image/png")


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


@routeur.post("/generations/{identifiant}/slots/{rang}/unfold")
async def ecarter(
    requete: Request, identifiant: str, rang: int, corps: dict[str, Any]
) -> dict[str, Any]:
    """L'auteur tranche sur une planche qui attend, et elle se déplie (R6).

    **Elle ne dépense rien**, et elle est en `POST` quand même : elle écrit sur
    le disque — N images entrent en bibliothèque — et une écriture ne se
    demande pas en `GET`. C'est la même règle que le dépliage de T5.

    Le corps porte `ecartees`, les numéros des sujets à laisser de côté, dans la
    numérotation de ce que la planche a rendu. **Une liste vide est une réponse**,
    pas une absence de réponse : elle dit « je les garde tous », ce qui est
    exactement le geste que demande une planche aux cases pleines.
    """
    generation = _atelier(requete).generations.ecarter(
        identifiant, rang, [int(i) for i in (corps.get("ecartees") or ())]
    )
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
    huitième place de la recette, donc le passage appartient à la recette.
    `couleur` est vide partout où le passage décide d'un masque — les deux
    couches d'un calque, et l'opacité de la huitième place.

    **Déplacée avant `CorpsPasse` en B18** : le pinceau remonté dans le
    détourage lui-même (`Passe.traits`) en a besoin un cran plus tôt dans le
    fichier — `from __future__ import annotations` diffère l'évaluation des
    annotations, mais Pydantic résout quand même le nom au moment où il
    construit le modèle, pas à l'appel.
    """

    garde: bool = True
    rayon: int = Field(0, ge=0, le=RAYON_MAX)
    points: list[tuple[int, int]] = Field(default_factory=list)
    couleur: str = ""


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
    # **Quel modèle de silhouette** (U13), quand le moteur est `modele`. Vide
    # veut dire *le défaut du produit* — le plus rapide —, et c'est ce qui fait
    # qu'une recette écrite avant ce champ rend exactement ce qu'elle rendait.
    modele: str = ""
    # ── Les quatre réglages neufs de B18 ──────────────────────────────────────
    #
    # **Doivent exister ici même quand l'écran ne les pose pas** — la leçon de
    # `decalage` en E17 : ce corps porte la recette entière à chaque geste, et
    # un champ absent du modèle Pydantic est silencieusement jeté par la
    # validation.
    #
    # **Comparer par teinte plutôt que canal par canal** (`bord`, `couleur`,
    # `palette`) — faux par défaut, ce que l'atelier faisait avant B18.
    teinte: bool = False
    # **La couleur que le jeu a déclarée**, visée par `bord` au lieu d'être
    # devinée sur les bordures. Vide, le défaut, c'est deviner — le geste
    # d'avant B18.
    couleur_du_jeu: str = ""
    # **Les couleurs que le moteur `palette` ne peut jamais manger.** Vide, la
    # passe ne retire rien — même règle qu'une pipette non visée.
    palette: list[str] = Field(default_factory=list)
    # **Le pinceau, remonté dans le détourage lui-même** — les mêmes passages
    # que la main, posés un cran plus tôt dans la chaîne.
    traits: list[CorpsTrait] = Field(default_factory=list)


class CorpsRecadrage(BaseModel):
    """La table *Recadrer* — la boîte, la marge, et les six réglages de B18.

    **Les six champs doivent exister ici même quand l'écran ne les pose pas**
    (même leçon que `decalage` et `CorpsQuantification` juste au-dessus) :
    ce corps porte la recette entière à chaque changement d'un autre réglage,
    et un champ absent du modèle Pydantic est silencieusement jeté par la
    validation.

    `format` et `multiple` ne sont pas bornés à une liste ici — même décision
    que `CorpsRetournement.sens` : le domaine ne lève pas sur un mot qu'il ne
    connaît pas, il retombe sur le neutre (`format_connu`, `multiple_connu`),
    et l'écran, lui, ne propose que ce que l'atelier sait faire.
    """

    marge: int = Field(0, ge=0)
    boite: list[int] | None = None
    taille: list[int] | None = Field(default=None, min_length=2, max_length=2)
    format: str = ""
    multiple: int = 0
    masse: bool = False
    ligne_pied: int | None = Field(default=None, ge=0, le=CANEVAS_MAX * 8)
    bord_uni: bool = False


class CorpsGrille(BaseModel):
    # ⚠️ **La porte d'entrée était restée à 512** (B16). Le service accepte
    # `8..2048` depuis `D2` — un jeu en style *dessin* ne demande pas des carrés
    # mais une **finesse**, et ses quatre valeurs montent à 2048 (`vue.py`,
    # `FINESSES`) —, mais ce champ-ci plafonnait à 512 et refusait tout par un
    # **422 de Pydantic**, qui ne nomme rien d'utile. Comme l'écran renvoie la
    # recette **entière** à chaque geste, bouger une tolérance de détourage
    # envoyait aussi la grille : un jeu en dessin à 1 024 ne pouvait poser
    # *aucune* retouche, et le message ne disait pas laquelle des tables était
    # en cause.
    #
    # Les bornes viennent maintenant du service, d'où sortent aussi les phrases
    # de refus — celles qui **nomment le réglage fautif** plutôt que de ramener
    # en silence vers la borne la plus proche (`assets.py:95-108`).
    cible: int = Field(64, ge=CIBLE_MIN, le=CIBLE_MAX)
    # **Le plafond n'est plus 100 %** (tranche des tailles) : au-delà, le sujet
    # dépasse la case et la boîte grandit avec lui — c'est ce qui rend un moulin
    # ou une tour demandables. La borne portée ici est large exprès ; le service
    # refuse au chiffre exact, qu'il calcule d'après la cible.
    occupation: int = Field(100, ge=1, le=OCCUPATION_MAX_ABSOLU)
    ancrage: str = "bas"
    # **Le décalage horizontal** (E17) — une coordonnée écrite par le calibrage
    # seul, jamais par cet écran. Le champ doit exister ici quand même : ce
    # corps porte la recette entière à chaque changement d'un autre réglage
    # (`PUT /assets/{id}/recipe`), et un champ absent du modèle Pydantic est
    # silencieusement jeté par la validation — la valeur posée par le calibrage
    # disparaissait donc dès qu'on touchait `occupation` ou `cible` à côté.
    decalage: int = 0
    # **La méthode de réduction** (D2). Elle se comporte comme `ancrage` : la
    # charge la porte, l'écran l'envoie à chaque fois, et l'omettre retombe sur
    # « au plus proche » — ce que l'atelier faisait avant que la question se
    # pose. Elle voyage donc aussi dans une recette nommée, et c'est voulu :
    # c'est un choix de style, et un style se rejoue.
    #
    # Le nom n'est pas validé ici mais dans le service, avec les bornes des
    # autres réglages : une méthode installée sur une machine et pas sur une
    # autre doit rendre « grisée avec sa raison », pas « champ invalide ».
    methode: str = AU_PLUS_PROCHE


class CorpsEchange(BaseModel):
    """Une ligne de la table de correspondance (B17).

    **Les deux couleurs ne sont pas bornées ici**, et c'est la règle de
    `CorpsContour` reprise telle quelle : *une couleur hors palette se marque,
    elle ne se refuse pas* (US-210). Le traitement rend du noir sur une valeur
    illisible plutôt que de faire tomber un rendu au milieu d'une frappe ; ce que
    le service refuse, lui, est une paire qui ne nomme rien du tout.
    """

    depuis: str = ""
    vers: str = ""
    tolerance: int = Field(0, ge=0, le=TOLERANCE_ECHANGE_MAX)


class CorpsQuantification(BaseModel):
    """La table *Couleurs* — la réduction, et les six réglages de B17.

    **Les six champs doivent exister ici même quand l'écran ne les pose pas.**
    C'est la leçon de `decalage` en E17, un cran plus haut dans ce fichier : ce
    corps porte la recette **entière** à chaque changement d'un autre réglage
    (`PUT /assets/{id}/recipe`), et un champ absent du modèle Pydantic est
    silencieusement jeté par la validation — la cape échangée disparaîtrait donc
    dès qu'on touche au nombre de couleurs à côté.
    """

    couleurs: int = Field(32, ge=2, le=256)
    palette: list[str] = Field(default_factory=list)
    tramage: str = "aucun"
    luminosite: int = Field(0, ge=CURSEUR_MIN, le=CURSEUR_MAX)
    contraste: int = Field(0, ge=CURSEUR_MIN, le=CURSEUR_MAX)
    saturation: int = Field(0, ge=CURSEUR_MIN, le=CURSEUR_MAX)
    teinte: int = Field(0, ge=TEINTE_MIN, le=TEINTE_MAX)
    echanges: list[CorpsEchange] = Field(default_factory=list)

    # ── Les six de B18, et le neutre de chacun est celui du domaine ───────────
    #
    # **Les défauts sont recopiés du domaine, pas réinventés ici.** Un corps qui
    # poserait `force_tramage=0` par défaut éteindrait le tramage de toute
    # recette dont l'écran ne renvoie pas la clé — la panne exacte de `decalage`
    # en E17, et celle que la docstring de cette classe raconte déjà.
    algorithme: str = MEDIANE
    graine: int = Field(0, ge=0)
    force_tramage: int = Field(FORCE_TRAMAGE_LIVREE, ge=0, le=100)
    distance: str = BRUTE
    visibles_seuls: bool = False
    gardees: list[str] = Field(default_factory=list)
    # **La palette nommée d'où vient la copie** (TS12). Même leçon : absente du
    # corps, elle disparaîtrait de la recette au premier curseur touché à côté,
    # et l'écran ne saurait plus dire « la palette X a changé depuis ».
    palette_nommee: str = ""
    palette_nom: str = ""


class CorpsDesignation(BaseModel):
    """Une tache désignée à la main — effacée, ou protégée (B18)."""

    point: tuple[int, int] = (0, 0)
    garde: bool = False


class CorpsBords(BaseModel):
    """La table *Nettoyer* — B17 (le grain, l'escalier) et B18 (le reste)."""

    aire_min: int = Field(0, ge=0)
    grain_min: int = Field(0, ge=0, le=GRAIN_MAX)
    lissage: int = Field(0, ge=0, le=LISSAGE_MAX)
    garder: int = Field(0, ge=0, le=GARDER_MAX)
    boucher_jusqua: int = Field(0, ge=0)
    reboucher_jusqua: int = Field(0, ge=0)
    ronger_regonfler: int = Field(0, ge=0, le=MORPHOLOGIE_MAX)
    regonfler_ronger: int = Field(0, ge=0, le=MORPHOLOGIE_MAX)
    vote_voisins: int = Field(0, ge=0, le=LISSAGE_MAX)
    epargner_traits_fins: bool = True
    designations: list[CorpsDesignation] = Field(default_factory=list)


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
    # ── Les six capacités de B18 ──────────────────────────────────────────
    derivee: bool = False
    reserver: bool = False
    inegal: bool = False
    sur_calques: bool = False
    desactive_plein_cadre: bool = True


class CorpsRetournement(BaseModel):
    """La septième place — le miroir de B1, et neuf sens de plus (B18).

    **Le sens n'est pas borné ici**, et c'est la décision de `CorpsContour` juste
    au-dessus reprise pour la même raison : le domaine ne lève pas sur un nom
    qu'il ne connaît pas, il rend l'image telle quelle. Un sens venu d'une
    version plus récente arrive donc sans effet au lieu de faire tomber un rendu
    en 422 — et l'écran, lui, ne propose que ce que l'atelier sait faire.

    **Les quatre champs neufs sont bornés, eux**, parce qu'ils portent un
    nombre et non un nom : un angle hors de `[-180, 180]` ou un rayon de
    pinceau hors de `[0, RAYON_MAX]` rend un 422 lisible plutôt qu'une valeur
    absurde silencieusement acceptée.
    """

    sens: str = GAUCHE_DROITE
    angle: float = Field(0.0, ge=ANGLE_MIN, le=ANGLE_MAX)
    axe_repli: int | None = Field(None, ge=0)
    moitie_repli: str = GAUCHE
    zones_protegees: list[CorpsTrait] = Field(default_factory=list)


class CorpsCalqueDessin(BaseModel):
    nom: str = ""
    visible: bool = True
    passages: list[CorpsTrait] = Field(default_factory=list)


class CorpsMainDeLaRecette(BaseModel):
    """La huitième place (E5) — un sol, et ce qu'on empile dessus.

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
    # **Entre le contour et la main**, comme dans le domaine et comme à l'écran :
    # l'ordre de la charge est l'ordre d'exécution, et c'est ce qui rend la
    # chaîne lisible d'un bout à l'autre du dépôt.
    retournement: CorpsRetournement | None = None
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


class CorpsApercuRecette(BaseModel):
    recette: CorpsRecette
    voyageuse: bool = False
    nom: str | None = None
    reinitialiser: bool = False
    # **La pipette de la table d'échange** (RV24) — un point cliqué dans
    # l'image, jamais une passe de détourage : celle-ci s'appuie déjà sur
    # `passe.point`. `None` ne demande rien de plus que le brouillon habituel.
    viser: tuple[int, int] | None = None


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
    tri: str = Query("recent"),
    role: str = Query("tous"),
    jugement: str = Query("tous"),
    groupe: bool = Query(False),
) -> dict[str, Any]:
    """La bibliothèque, filtrée, triée et regroupée. **La seule grille du
    produit** (US-31).

    Sans aucun paramètre, c'est la grille du projet ouvert — exactement ce que
    le premier message du flux a déjà servi. `tous` regarde par-dessus les
    projets, `sans_projet` ne montre que ce qu'une suppression de projet a
    détaché.

    Le filtrage est **ici** et non à l'écran : la recherche doit porter sur
    toute la bibliothèque, pas sur les deux cents assets qu'un navigateur a en
    mémoire. C'est aussi ce qui fait que le MCP voit exactement ce que l'écran
    voit.

    **Et le tri, les deux filtres et le regroupement le sont pour la même
    raison** (RP11). `tri` vaut `recent` · `ancien` · `nom` ; `role` vaut
    `tous` · `origine` · `derivee` · `calque` · `equipement` · `seule` ;
    `jugement` vaut `tous` · `favori` · `non-juge` ; `groupe` pose chaque image
    sous l'origine de sa filiation et ajoute `groupes` à la réponse. Une valeur
    hors liste retombe sur le défaut au lieu de refuser : c'est un réglage de
    coup d'œil, et une grille vide serait un refus que rien n'expliquerait.
    Le contrat entier est dans `docs/PLAN-remise-a-plat.md` § RP11.
    """
    bibliotheque = _atelier(requete).bibliotheque
    if not tous and projet is None and not sans_projet and collection is None:
        projet, sans_projet = bibliotheque.courant, bibliotheque.courant is None
    grille = bibliotheque.grille(
        projet=None if tous else projet,
        sans_projet=sans_projet and not tous,
        collection=collection,
        favoris=favoris,
        recherche=recherche,
        limite=limite,
        tri=tri,
        role=role,
        jugement=jugement,
        groupe=groupe,
    )
    return {**grille, "assets": [a.en_json() for a in grille["assets"]]}


@routeur.get("/assets/{identifiant}")
async def lire_asset(requete: Request, identifiant: str) -> dict[str, Any]:
    asset = _asset(requete, identifiant)
    charge = asset.en_json()
    # **Ce que la découpe à l'arrivée a fait de cette feuille** (RS7) : ses
    # morceaux dans l'ordre des vues, ou la phrase qui dit pourquoi rien n'est
    # coupé. Sur cette route-ci seulement — celle d'une fiche ouverte —, et pas
    # sur la charge d'un asset que la grille relit deux cents fois.
    etat = _atelier(requete).decoupe.etat_a_l_arrivee(asset)
    if etat is not None:
        charge["decoupe_a_l_arrivee"] = etat
    return charge


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

    **Pas de pipette ici** (RV24) : celle de la table d'échange passe par
    `POST .../recipe/preview`, qui répond sans rien enregistrer — c'est aussi
    ce qu'il faut pour un brouillon non posé, et un seul chemin en moins à
    tenir d'accord avec l'autre.
    """
    return _atelier(requete).assets.taches_de(identifiant, limite)


@routeur.put("/assets/{identifiant}/recipe")
async def poser_recette(
    requete: Request, identifiant: str, corps: CorpsRecette,
    reinitialiser: bool = Query(False),
) -> dict[str, Any]:
    """Le geste de la tranche. Le rendu est recalculé avant de répondre.

    Répondre après le calcul et non avant : l'écran affiche l'image dès qu'il a
    la réponse, sans un second aller-retour pour savoir si c'est prêt. Le calcul
    se compte en dizaines de millisecondes — le détourage déjà fait est gardé,
    seule la queue de la recette est refaite.
    """
    asset = _atelier(requete).assets.poser_les_places(identifiant, corps.en_recette(), reinitialiser=reinitialiser)
    return asset.en_json()


@routeur.post("/assets/{identifiant}/recipe/preview")
async def apercu_recette(requete: Request, identifiant: str, corps: CorpsApercuRecette) -> dict[str, Any]:
    """Aperçu du brouillon : aucune recette, image ou événement enregistré."""
    return _atelier(requete).assets.apercu_recette(
        identifiant, corps.recette.en_recette(), voyageuse=corps.voyageuse,
        nom=corps.nom, reinitialiser=corps.reinitialiser, viser=corps.viser,
    )


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
    (`docs/archive/plan-versions-tenues.md`, T2).

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


@routeur.get("/assets/{identifiant}/incoming")
async def image_arrivee(requete: Request, identifiant: str) -> Response:
    """La case telle qu'elle est **arrivée du modèle** (G16).

    **L'autre sens du mot *brut*, et c'est tout le sujet.** Le brut rangé d'un
    vêtement est la case déjà mise à l'échelle et calée sur son corps ; celui
    d'un corps habillé est la case telle qu'elle est arrivée. Deux images d'une
    même planche, deux sens du même mot — cette adresse rend toujours le second,
    et l'écran dit lequel des deux il montre.

    **Elle ne range rien** : la case se recalcule de la planche à chaque
    demande, comme le rejeu du recalage la recalcule. Pas un centime, pas un
    appel, et rien de neuf sur le disque.

    Le refus vient du service et garde ses mots — une planche partie du disque
    et un découpage qui ne correspond plus ne sont pas la même panne.
    """
    octets, type_media = _atelier(requete).equipement.case_arrivee(identifiant)
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
    # Alignés aux boîtes. Un nom vide ou l'absence de liste reprend le libellé
    # numéroté par défaut — l'écran ne les envoie que si l'auteur en a écrit un.
    noms: list[str | None] = Field(default_factory=list)


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
    return _atelier(requete).decoupe.decouper(identifiant, boites, noms=corps.noms)


# ── Le miroir ────────────────────────────────────────────────────────────────
#
# **Deux routes, et la coupure est celle du slicer** : `GET` propose la direction
# et se redemande à chaque ouverture de fiche ; `POST` fabrique un asset et ne se
# redemande jamais. C'est la convention d'URL du dépôt, et on n'en réinvente pas
# une seconde pour une fabrique de plus.


class CorpsMiroir(BaseModel):
    """Où l'image retournée vient se ranger.

    **Facultative, parce que le défaut se calcule** : sans elle, le service
    prend `direction_au_miroir` de la direction du parent. Ce n'est pas une
    déduction imposée — dès que l'auteur en désigne une, c'est la sienne qui
    vaut, y compris un nom que la table du domaine ne connaît pas. Les
    directions d'un projet sont libres, et l'écran a déjà eu le dernier mot.
    """

    direction: str | None = None


@routeur.get("/assets/{identifiant}/mirror")
async def proposer_miroir(requete: Request, identifiant: str) -> dict[str, Any]:
    """La direction proposée, et la raison quand il n'y en a pas (B1).

    Rien n'est créé, rien n'est écrit. Elle existe pour que l'écran grise le
    geste **avant** le clic : *« un miroir gauche-droite ne montre pas le dos
    d'un personnage »* se lit devant le bouton, pas dans un refus qui arrive
    après avoir fait espérer.
    """
    return _atelier(requete).miroir.propose(identifiant)


@routeur.post("/assets/{identifiant}/mirror", status_code=201)
async def retourner_asset(
    requete: Request, identifiant: str, corps: CorpsMiroir | None = None
) -> dict[str, Any]:
    """Une image devient deux, et la seconde n'a rien coûté (B1).

    Le miroir est un asset entier, filié sur l'image de départ, exactement comme
    une découpe l'est sur sa planche : supprimer l'un laisse l'autre en place. Ce
    qui le retourne est sa recette — la place `retournement` remplie —, et non
    ses octets, qui sont ceux de son parent.

    Aucun appel au fournisseur : retourner marche réseau coupé.
    """
    return _atelier(requete).miroir.retourner(
        identifiant, (corps.direction if corps else None)
    )


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
    # **Lire le dessus tel qu'il est arrivé du modèle** (G16) — voir
    # `atelier/domaine/superposition.py`. Faux partout sauf sur un vêtement,
    # où c'est le seul point de départ qui permette de refaire le calage.
    dessus_arrivee: bool = False

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
    requete: Request,
    identifiant: str,
    dessous: str = Query(...),
    arrivee: bool = Query(False),
) -> dict[str, Any]:
    """La proposition de calage — trois valeurs, et rien d'autre (US-213).

    **Un bouton, pas un mode** : elle remplit les champs et s'arrête là.

    `arrivee` la fait partir de la case telle qu'elle est arrivée (G16). Sans
    lui, l'atelier proposerait un calage pour une image que l'écran ne montre
    pas — et les trois valeurs rendues seraient justes pour la mauvaise.
    """
    return _atelier(requete).superposition.recaler(
        identifiant, dessous, arrivee=arrivee
    )


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
    atelier = _atelier(requete)
    # **Le projet ouvert, parce qu'une recette nommée n'a pas d'asset.** C'est
    # la seule palette dont on puisse dire qu'elle existe au moment où l'on
    # enregistre, et c'est celle sur laquelle l'écran a grisé — ou pas — la
    # quantification qu'on lui envoie.
    recettes, laisse = atelier.assets.nommer(
        nom, corps.en_recette(), atelier.bibliotheque.courant
    )
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


# ── Les jeux de réglages nommés : retirés le 16 septembre 2026 (RP18) ────────
#
# Trois routes — `GET`, `PUT` et `DELETE /presets/{nom}` — ont porté US-134
# pendant toute la vie du produit sans qu'un seul écran les appelle. Ce qu'elles
# promettaient — *rejouer la recette d'un appel sur un autre personnage* — est
# fait ailleurs, et l'est depuis longtemps : *Reprendre les réglages*, sur la
# fiche d'une image de la galerie, repeuple le générateur avec les réglages de
# l'appel qui l'a fabriquée (`interface/src/gestes.ts`, `reprendreReglages`).
# Une image déjà obtenue est un meilleur point de départ qu'un nom à retenir.


def _asset(requete: Request, identifiant: str) -> Asset:
    asset = _atelier(requete).assets.lire(identifiant)
    if asset is None:
        raise AssetInconnu(identifiant)
    return asset
