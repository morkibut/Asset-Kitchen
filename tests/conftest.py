# -*- coding: utf-8 -*-
"""Le double de fournisseur, et les trois montages que tous les tests partagent.

**Aucun test ne coûte un centime.** Le port `PortFournisseur` est remplacé ici
par un double qui rend de vraies images PNG et JPEG, avec de vrais coûts et de
vraies dimensions — c'est tout ce dont les critères d'acceptation ont besoin.
Le seul appel payant du dépôt est `essais/essai_premiere_image.py`, et il part à
la main.

Le double vit dans ce fichier plutôt que dans l'un des fichiers de tests : deux
copies divergeraient, et le jour où l'une déclarerait un plafond de références
que l'autre ignore, c'est un test qui mentirait.
"""

from __future__ import annotations

import asyncio
import io
import math
import uuid

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from typing import Any

from atelier.api.app import creer_application
from atelier.domaine import USD, Compte, Demande, Modele, Option
from atelier.domaine.animation import (
    PROPORTIONS_DEFAUT,
    RESOLUTION_DEFAUT,
    SECONDES_DEFAUT,
    DemandeClip,
)
from atelier.domaine.erreurs import ErreurAtelier, FournisseurIndisponible
from atelier.domaine.secret import Secret
from atelier.fournisseur.port import ImageProduite
from atelier.services import Atelier
from atelier.services.texte_clip import composer

# **Le nom du fournisseur double, et il qualifie ses modèles** (F1). Un modèle se
# nomme par son fournisseur et par son nom depuis la V2.2 : `essai:rend-du-png`
# se lit « le modèle *rend-du-png* de chez *essai* », et c'est très exactement ce
# que le produit écrit désormais dans une génération.
FOURNISSEUR = "essai"

CATALOGUE = [
    Modele(
        identifiant="essai:rend-du-png",
        nom="Essai PNG",
        fournisseur=FOURNISSEUR,
        chez_lui="rend-du-png",
        references_max=2,
        proportions=("1:1", "16:9"),
        resolutions=(),
        variations_max=4,
        options={"quality": Option("quality", "choix", ("low", "high"))},
    ),
    Modele(
        identifiant="essai:rend-du-jpeg",
        nom="Essai JPEG",
        fournisseur=FOURNISSEUR,
        chez_lui="rend-du-jpeg",
        references_max=0,
        proportions=("1:1",),
        variations_max=1,
    ),
]


def image(format_: str, taille: tuple[int, int] = (48, 32)) -> bytes:
    tampon = io.BytesIO()
    Image.new("RGB", taille, (32, 64, 96)).save(tampon, format=format_)
    return tampon.getvalue()


# Les deux couleurs des images d'essai. Le fond est le gris clair que les modèles
# rendent réellement — relevé le 27 août 2026 sur dix-sept images produites :
# (216, 217, 216) chez `gpt-image-2`, autour de (191, 192, 191) ailleurs.
FOND = (216, 217, 216)
SUJET = (190, 40, 40)
SUJET_SOMBRE = (120, 25, 25)


def image_sujet(
    *,
    logique_l: int = 8,
    logique_h: int = 16,
    bloc: int = 4,
    toile: int = 24,
    format_: str = "PNG",
) -> bytes:
    """Un sujet net sur un fond plat, peint sur une grille de `bloc` pixels.

    C'est l'image que le produit reçoit vraiment : un fond uniforme, un sujet
    posé dessus, et une **grille de rendu** dont la taille de bloc varie d'un
    appel à l'autre — le constat qui décide de l'architecture
    (`docs/ARCHITECTURE.md` §4 bis). En faisant varier `bloc`, un test rejoue la
    dérive de grille sans dépenser un centime.

    Deux propriétés sont dessinées exprès, et chacune fait échouer un traitement
    naïf que le produit refuse :

    - **le sujet est rayé**, une colonne logique sur deux dans un ton plus
      sombre. Sans ça, la plus longue plage d'une même couleur mesurerait la
      largeur du sujet et non la taille du bloc, et le test dirait n'importe
      quoi de la remise sur grille ;
    - **le sujet porte un trou de la couleur du fond.** Ce trou n'est relié à
      aucun bord, donc un remplissage depuis le bord ne l'atteint pas et il
      reste opaque. Un seuil global, lui, le percerait — et percerait du même
      coup un squelette blanc ou le reflet d'une fiole.
    """
    petite = Image.new("RGB", (toile, toile), FOND)
    dessin = ImageDraw.Draw(petite)
    x0 = (toile - logique_l) // 2
    y0 = toile - logique_h - 1
    for colonne in range(logique_l):
        dessin.rectangle(
            [x0 + colonne, y0, x0 + colonne, y0 + logique_h - 1],
            fill=SUJET if colonne % 2 == 0 else SUJET_SOMBRE,
        )
    dessin.point((x0 + logique_l // 2, y0 + logique_h // 2), fill=FOND)

    grande = petite.resize((toile * bloc, toile * bloc), Image.Resampling.NEAREST)
    tampon = io.BytesIO()
    grande.save(tampon, format=format_)
    return tampon.getvalue()


def planche_sujets(
    sujets: int, *, cote: int = 480, jumelles: bool = False, format_: str = "PNG"
) -> bytes:
    """Une planche de N sujets séparables, comme celle qu'un modèle rend (C2).

    **Écrite d'après ce que le produit reçoit, pas d'après ce qu'il attend.**
    Un double construit sur l'intention prouve l'intention, pas le serveur
    (`docs/PIEGES.md`, payé en C1) : cette planche-ci passe donc par la même
    chaîne que les vingt-quatre planches réelles du 28 août — détourage par
    remplissage depuis le bord, puis zones connexes. Le fond touche les quatre
    bords, aucun sujet ne les touche, et les gouttières sont bien au-dessus de
    l'écart qui recolle deux morceaux d'un même sprite.

    **Chaque sujet a une silhouette différente**, et c'est ce qui rend la mesure
    de ressemblance vérifiable : des barres pleines s'étireraient toutes en un
    carré plein, se ressembleraient à 1,00 et un essai n'y verrait rien. Le bras
    se déplace d'un sujet à l'autre ; `jumelles` en donne deux identiques, ce
    qui est très exactement le cas mesuré le 28 août — un compte juste et une
    planche qui répète une pose.

    `sujets` est ce que la planche **contient**, pas ce qu'on a demandé : c'est
    la même fonction qui joue le compte juste et le compte faux.
    """
    colonnes = math.ceil(math.sqrt(max(1, sujets)))
    lignes = math.ceil(max(1, sujets) / colonnes)
    image = Image.new("RGB", (cote, cote), FOND)
    dessin = ImageDraw.Draw(image)
    marge = 24
    large = (cote - 2 * marge) // colonnes
    haut = (cote - 2 * marge) // lignes

    for index in range(sujets):
        forme = 0 if (jumelles and index == 1) else index
        x0 = marge + (index % colonnes) * large
        y0 = marge + (index // colonnes) * haut
        corps_l, corps_h = large // 4, int(haut * 0.6)
        cx = x0 + (large - corps_l) // 2
        cy = y0 + haut - corps_h - 8
        # Le corps est rayé une colonne sur deux : sans ça, la plus longue plage
        # d'une même couleur mesurerait la largeur du sujet et non le bloc de
        # pixel, et la dérive de grille dirait n'importe quoi.
        for colonne in range(corps_l):
            dessin.rectangle(
                [cx + colonne, cy, cx + colonne, cy + corps_h - 1],
                fill=SUJET if colonne % 2 == 0 else SUJET_SOMBRE,
            )
        bras_h = max(4, corps_h // 10)
        bras_y = cy + int(corps_h * (0.08 + 0.09 * (forme % 10)))
        dessin.rectangle(
            [cx - corps_l, bras_y, cx - 1, bras_y + bras_h - 1], fill=SUJET
        )

    tampon = io.BytesIO()
    image.save(tampon, format=format_)
    return tampon.getvalue()


def planche_quadrillee(sujets: int, *, cote: int = 480, format_: str = "PNG") -> bytes:
    """La planche qui a redessiné son quadrillage — le piège de R6 (US-368).

    **Le défaut n'est pas que les traits soient laids, c'est ce qu'ils font au
    détourage.** Le gabarit part avec des cases dessinées et le prompt demande
    en toutes lettres de ne pas les reproduire ; un modèle sur six du 28 août les
    a reproduites quand même. Le remplissage depuis le bord part alors des
    quatre côtés de l'image, **et les traits l'arrêtent** : le fond de chaque
    case reste opaque, la case entière devient une tache, et le compte tombe
    juste. L'atelier acceptait, et il faisait entrer huit carrés pleins.

    Elle est donc bâtie comme `planche_sujets`, aux traits près — même fond,
    mêmes sujets, mêmes gouttières. C'est la seule différence qui compte, et
    c'est celle-là qu'on veut voir attraper.
    """
    colonnes = math.ceil(math.sqrt(max(1, sujets)))
    lignes = math.ceil(max(1, sujets) / colonnes)
    image = Image.open(io.BytesIO(planche_sujets(sujets, cote=cote))).convert("RGB")
    dessin = ImageDraw.Draw(image)
    marge = 24
    large = (cote - 2 * marge) // colonnes
    haut = (cote - 2 * marge) // lignes
    for index in range(sujets):
        x0 = marge + (index % colonnes) * large
        y0 = marge + (index // colonnes) * haut
        # Rentrés de cinq pixels : deux cases voisines doivent rester deux
        # taches. Des traits jointifs n'en feraient qu'une, et la planche
        # tomberait dans le refus du compte au lieu du piège qu'on veut montrer.
        dessin.rectangle(
            [x0 + 5, y0 + 5, x0 + large - 6, y0 + haut - 6],
            outline=SUJET_SOMBRE,
            width=2,
        )
    tampon = io.BytesIO()
    image.save(tampon, format=format_)
    return tampon.getvalue()


def bloc_mesure(octets: bytes) -> int:
    """La plus longue plage horizontale d'une même couleur dans le sujet.

    Sur une image d'aplats — ce que le post-traitement produit — c'est la taille
    du bloc de pixel. C'est la mesure qui dit si un tonneau et un personnage
    sortent « avec le même bloc », et elle se lit sur le fichier, pas sur les
    réglages qu'on a demandés.
    """
    with Image.open(io.BytesIO(octets)) as ouverte:
        image_ = ouverte.convert("RGBA")
    pixels = image_.load()
    largeur, hauteur = image_.size
    plus_longue = 0
    for y in range(hauteur):
        courant, longueur = None, 0
        for x in range(largeur):
            couleur = pixels[x, y]
            if couleur[3] == 0:
                courant, longueur = None, 0
                continue
            if couleur == courant:
                longueur += 1
            else:
                courant, longueur = couleur, 1
            plus_longue = max(plus_longue, longueur)
    return plus_longue


class FournisseurDouble:
    """Implémente `PortFournisseur`, sans réseau et sans facture.

    Quatre leviers, et ils suffisent à jouer tous les cas du produit :
    `catalogue_lisible` coupe le réseau, `echec` fait rater les appels,
    `retenir` les fait attendre — c'est ce dernier qui permet de regarder un
    emplacement **pendant** qu'il tourne, donc de vérifier la jauge — et
    `manque` lui retire ce qu'il lui faut pour travailler.

    S'y sont ajoutés `compte_declare` (F2), qui le fait compter en jetons, et
    `secrets_declares` (F3), qui lui donne des places à remplir. Tous partent
    éteints : un essai lit dans son nom ce que le double fait.
    """

    nom = FOURNISSEUR

    def __init__(self) -> None:
        self.appels = 0
        self.catalogue_lisible = True
        # **Ce qui lui manque pour travailler**, arrivé en F1. Avant la V2.2 la
        # question était « y a-t-il une clé ? » et la réponse valait pour
        # l'atelier entier ; elle appartient maintenant à chaque fournisseur, et
        # un essai la pose sur celui qu'il veut. `None` — il ne manque rien, ce
        # qui est le cas courant et celui de tous les essais d'avant.
        self.manque: str | None = None
        self.echec: Exception | None = None
        self.retenir: asyncio.Event | None = None
        self.duree_annoncee_s = 0.0
        # De quoi faire rendre au double autre chose que son aplat : les tests
        # de post-traitement ont besoin d'un sujet sur un fond, pas d'un carré
        # uni. Un seul levier, posé par le test, et T1 ne bouge pas.
        self.rendre: "callable[[], bytes] | None" = None
        # **Ce que le modele rend d'apres ce qu'il a recu** (C3). `rendre` suffit
        # tant que la reponse ne depend pas de la demande ; une planche
        # d'equipement, si : ce qui revient est ce qui est parti, avec la piece
        # en plus. Deux leviers plutot qu'un `rendre` a deux formes — un test lit
        # alors dans son nom ce que le double fait.
        self.repondre: "callable[[Demande], bytes] | None" = None
        # Ce que chaque appel a **réellement** reçu en références (US-12). Un
        # test qui vérifie la réinjection sur l'enregistrement seul se
        # contenterait de ce que le produit dit avoir envoyé ; celui-ci regarde
        # ce qui est arrivé au bout du port.
        self.references_recues: list[int] = []
        self.demandes: list[Demande] = []
        # **Ce que cet appel-là facture** (E14). Un prix plat suffisait tant que
        # personne ne décomposait la facture ; l'écran de confirmation, lui, dit
        # *ce que chaque image jointe ajoute*, et cette phrase-là ne se vérifie
        # pas sur un double qui facture pareil quoi qu'il reçoive. Troisième
        # levier de la même famille que `rendre` et `repondre` — un test lit dans
        # son nom ce que le double fait.
        self.couter: "callable[[Demande], float] | None" = None
        # **Dans quelle unité ce double compte** (F2). `None` — il compte en
        # argent, ce qu'était tout le produit avant la V2.2 et ce que font tous
        # les essais d'avant cette tranche. Posé par un test, il joue un
        # fournisseur qui consomme des jetons : `compte()` déclare alors sa
        # réserve, et chaque image en consomme `par_appel`.
        self.compte_declare: "Compte | None" = None
        # **Les places qu'il demande** (F3). Vide — il ne demande rien, ce qui
        # est le cas de tous les essais d'avant cette tranche et reste le défaut.
        # Un essai qui veut jouer un fournisseur à secrets pose les siennes ; il
        # pose alors `manque` en même temps s'il les veut vides, les deux
        # leviers restant indépendants pour qu'un essai puisse jouer *déclarée
        # et remplie* aussi bien que *déclarée et vide*.
        self.secrets_declares: "tuple[Secret, ...]" = ()

    def compte(self) -> "Compte | None":
        return self.compte_declare

    def secrets(self) -> "tuple[Secret, ...]":
        return self.secrets_declares

    def indisponible(self) -> str | None:
        return self.manque

    def _unite(self) -> str:
        return self.compte_declare.unite if self.compte_declare else USD

    async def catalogue(self) -> list[Modele]:
        if not self.catalogue_lisible:
            raise FournisseurIndisponible("catalogue injoignable — réseau coupé")
        return list(CATALOGUE)

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        self.appels += 1
        self.references_recues.append(len(demande.references))
        self.demandes.append(demande)
        if self.retenir is not None:
            await self.retenir.wait()
        if self.duree_annoncee_s:
            await asyncio.sleep(self.duree_annoncee_s)
        if self.echec is not None:
            raise self.echec
        if self.repondre is not None:
            return ImageProduite(
                self.repondre(demande),
                consomme=self._cout(demande, 0.0245),
                unite=self._unite(),
                type_media="image/png",
            )
        if self.rendre is not None:
            return ImageProduite(
                self.rendre(),
                consomme=self._cout(demande, 0.0245),
                unite=self._unite(),
                type_media="image/png",
            )
        if modele.envoi.endswith("jpeg"):
            return ImageProduite(
                image("JPEG"),
                consomme=self._cout(demande, 0.035),
                unite=self._unite(),
                type_media="image/jpeg",
            )
        return ImageProduite(
            image("PNG"),
            consomme=self._cout(demande, 0.0245),
                unite=self._unite(),
            type_media="image/png",
        )

    def _cout(self, demande: Demande, defaut: float) -> float:
        """Le prix plat d'avant, sauf si le test en a posé un qui varie.

        **Un fournisseur qui ne compte pas en argent consomme un par appel**, et
        pas `0.0245` — un chiffre d'argent porté par une unité de jetons serait
        le genre de confusion que F2 existe pour empêcher.
        """
        if self.couter is not None:
            return self.couter(demande)
        return defaut if self.compte_declare is None else 1.0


class AnimateurMuet:
    """Implémente `PortAnimateur`, et ne fait rien — **surtout pas de réseau**.

    Arrivé en A9, et il est ici plutôt que dans les essais de la tranche parce
    qu'il vaut pour tous les autres : depuis que l'ouverture de l'atelier relit
    aussi le catalogue vidéo, un atelier d'essai sans animateur double irait le
    demander à OpenRouter — neuf cents fois, une par essai. **Un essai qui
    touche le réseau est un essai qui ment le jour où le réseau tombe.**

    Ses trois autres gestes lèvent plutôt que de rendre quelque chose : aucun
    essai n'est censé commander un clip par ce double-là, et un double qui
    répondrait poliment laisserait passer un essai qui croit mesurer une
    commande de clip sans en mesurer aucune.
    """

    nom = FOURNISSEUR

    async def catalogue_video(self) -> list:
        return []

    async def soumettre(self, modele, demande):  # pragma: no cover — voir plus haut
        raise AssertionError("ce double ne commande pas de clip : voir tests/test_a9.py")

    async def etat(self, travail):  # pragma: no cover
        raise AssertionError("ce double ne commande pas de clip : voir tests/test_a9.py")

    async def recuperer(self, travail):  # pragma: no cover
        raise AssertionError("ce double ne commande pas de clip : voir tests/test_a9.py")


async def commander_un_clip(
    atelier: Atelier,
    *,
    modele: str,
    asset: str,
    prompt: str = "",
    mouvement: str | None = None,
    secondes: float = SECONDES_DEFAUT,
    resolution: str = RESOLUTION_DEFAUT,
    proportions: str = PROPORTIONS_DEFAUT,
    nombre: int = 1,
    identifiant: str | None = None,
    projet: str | None = None,
    personnage: str | None = None,
    pose: str | None = None,
    direction: str | None = None,
    options: dict[str, Any] | None = None,
    monter_auto: bool = False,
) -> list[dict[str, Any]]:
    """Commande un ou plusieurs clips **directement par le service**, sans HTTP.

    Reprend, hors de la route, ce que faisait `POST /clips` (retirée le 21
    septembre 2026 — RV5/RV6, aucun appelant restant côté serveur ni MCP) :
    résoudre l'asset de départ, composer le texte à partir d'un mouvement (par
    le compositeur unique, `services.texte_clip.composer`) ou du texte donné
    tel quel, puis appeler `atelier.animation.commander` une fois par clip
    demandé. Rend la liste des générations en JSON, dans le même ordre —
    `["clips"]` de l'ancienne réponse.

    Les essais qui commandaient un clip par la route la remplacent par cet
    appel ; ceux qui portent sur le lot ou sur la correction passent par
    `preparer_serie`/`demarrer_serie` (`atelier/services/travaux.py`), qui est
    le nouveau circuit.
    """
    objet_asset = atelier.assets.lire(asset)
    if objet_asset is None:
        raise ErreurAtelier(f"aucune image « {asset} » dans la bibliothèque")
    projet_resolu = projet or objet_asset.projet
    personnage_resolu = personnage or objet_asset.personnage

    texte = prompt.strip()
    if not texte and mouvement:
        if atelier.mouvements.lire(mouvement, projet_resolu) is None:
            raise ErreurAtelier(f"aucun mouvement « {mouvement} » dans la bibliothèque")
        texte = composer(
            atelier, projet_resolu, personnage_resolu, direction, pose, mouvement
        )["texte"]
    if not texte.strip():
        raise ErreurAtelier(
            "un clip part d'un texte — choisissez un mouvement, ou écrivez-en un"
        )

    sprite = atelier.assets.reference(asset)
    entree = atelier.animation.preparer_entree(sprite, resolution, proportions)

    lot = "" if nombre <= 1 else uuid.uuid4().hex[:12]
    clips = []
    for rang in range(nombre):
        demande = DemandeClip(
            texte=texte,
            image=entree,
            secondes=secondes,
            resolution=resolution,
            proportions=proportions,
            options=dict(options or {}),
        )
        generation = await atelier.animation.commander(
            modele,
            demande,
            identifiant=identifiant if rang == 0 else None,
            projet=projet_resolu,
            personnage=personnage_resolu,
            pose=pose,
            direction=direction,
            mouvement=mouvement,
            lot=lot,
            depart=asset,
            monter_auto=monter_auto,
        )
        clips.append(generation.en_json())
    return clips


@pytest.fixture
def double() -> FournisseurDouble:
    return FournisseurDouble()


@pytest.fixture
def atelier(tmp_path, double) -> Atelier:
    """Un atelier **sur un seul fournisseur**, et c'est délibéré.

    C'est ce que le produit était avant la V2.2, et c'est ce que la quasi-totalité
    des critères d'acceptation vérifie : ils ne parlent pas de fournisseurs, ils
    parlent d'images, de recettes et d'écrans. Les essais qui ont besoin de deux
    fournisseurs à la fois — ceux de F1 — montent leur atelier eux-mêmes, avec
    `fabriques_fournisseurs`.

    **Aucune clé n'est plus nécessaire ici** : le double n'en demande pas, et un
    fournisseur qui ne demande rien est très exactement ce que F1 a fait entrer
    dans le produit.
    """
    return Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        # **Et un animateur qui ne fait rien** (A9) : sans lui, cet atelier-ci
        # irait relire le catalogue vidéo chez OpenRouter à chaque essai.
        fabrique_animateur=lambda: AnimateurMuet(),
    )


@pytest.fixture
def client(atelier) -> TestClient:
    with TestClient(creer_application(atelier)) as client:
        yield client


@pytest.fixture(autouse=True)
def _object_info_oublie():
    """Chaque essai part sans `/object_info` retenu : les doubles de ComfyUI
    partagent une adresse, et un essai qui retire un nœud ne doit pas lire la
    liste d'un autre (`atelier.fournisseur.workflow._object_info`)."""
    from atelier.fournisseur import maison, workflow
    workflow._OBJECT_INFO.clear()
    maison._DOSSIER_SORTIE.clear()
    yield
    workflow._OBJECT_INFO.clear()
    maison._DOSSIER_SORTIE.clear()
