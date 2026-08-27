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

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from atelier.api.app import creer_application
from atelier.domaine import Demande, Modele, Option
from atelier.domaine.erreurs import FournisseurIndisponible
from atelier.fournisseur.port import ImageProduite
from atelier.services import Atelier

CATALOGUE = [
    Modele(
        identifiant="essai/rend-du-png",
        nom="Essai PNG",
        references_max=2,
        proportions=("1:1", "16:9"),
        resolutions=(),
        variations_max=4,
        options={"quality": Option("quality", "choix", ("low", "high"))},
    ),
    Modele(
        identifiant="essai/rend-du-jpeg",
        nom="Essai JPEG",
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

    Trois leviers, et ils suffisent à jouer tous les cas du produit :
    `catalogue_lisible` coupe le réseau, `echec` fait rater les appels, et
    `retenir` les fait attendre — c'est ce dernier qui permet de regarder un
    emplacement **pendant** qu'il tourne, donc de vérifier la jauge.
    """

    nom = "Double"

    def __init__(self) -> None:
        self.appels = 0
        self.catalogue_lisible = True
        self.echec: Exception | None = None
        self.retenir: asyncio.Event | None = None
        self.duree_annoncee_s = 0.0
        # De quoi faire rendre au double autre chose que son aplat : les tests
        # de post-traitement ont besoin d'un sujet sur un fond, pas d'un carré
        # uni. Un seul levier, posé par le test, et T1 ne bouge pas.
        self.rendre: "callable[[], bytes] | None" = None
        # Ce que chaque appel a **réellement** reçu en références (US-12). Un
        # test qui vérifie la réinjection sur l'enregistrement seul se
        # contenterait de ce que le produit dit avoir envoyé ; celui-ci regarde
        # ce qui est arrivé au bout du port.
        self.references_recues: list[int] = []
        self.demandes: list[Demande] = []

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
        if self.rendre is not None:
            return ImageProduite(self.rendre(), cout_usd=0.0245, type_media="image/png")
        if modele.identifiant.endswith("jpeg"):
            return ImageProduite(image("JPEG"), cout_usd=0.035, type_media="image/jpeg")
        return ImageProduite(image("PNG"), cout_usd=0.0245, type_media="image/png")


@pytest.fixture
def double() -> FournisseurDouble:
    return FournisseurDouble()


@pytest.fixture
def atelier(tmp_path, double, monkeypatch) -> Atelier:
    monkeypatch.setattr("atelier.services.generation.lire_cle", lambda: "sk-or-essai")
    return Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)


@pytest.fixture
def client(atelier) -> TestClient:
    with TestClient(creer_application(atelier)) as client:
        yield client
