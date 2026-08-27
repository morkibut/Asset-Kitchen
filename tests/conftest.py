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
from PIL import Image

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

    async def catalogue(self) -> list[Modele]:
        if not self.catalogue_lisible:
            raise FournisseurIndisponible("catalogue injoignable — réseau coupé")
        return list(CATALOGUE)

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        self.appels += 1
        if self.retenir is not None:
            await self.retenir.wait()
        if self.duree_annoncee_s:
            await asyncio.sleep(self.duree_annoncee_s)
        if self.echec is not None:
            raise self.echec
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
