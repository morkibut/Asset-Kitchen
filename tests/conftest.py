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
                self.repondre(demande), cout_usd=0.0245, type_media="image/png"
            )
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
