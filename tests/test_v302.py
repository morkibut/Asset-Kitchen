# -*- coding: utf-8 -*-
"""V3.02.1 — la fiche d'un clip : ce que le serveur doit porter.

Les critères de `docs/PLAN.md` § V3.02.1, côté serveur. **Aucun n'appelle un
vrai fournisseur** : l'animateur d'ici est un double qui rend des octets, comme
celui d'`A9`. Le reste de la tranche est de l'écran — la colonne, la vidéo, les
bandes — et vit dans `interface/src/App.test.tsx`.

**Ce que la tranche change au serveur est presque rien, et c'est la marque de
sa conception.** La route vidéo existe depuis `A9` et sait répondre aux plages
depuis `A7` bis ; la liste des bandes d'un clip est servie depuis `A10`
(`/strips?clip=` ) ; la génération porte le texte corrigé du tiroir et le
mouvement qui l'a écrit. La seule chose qu'aucun écran ne pouvait lire était
**le sprite dont le clip est parti** : le fichier partait, la filiation restait
muette. C'est le champ `depart`, écrit à la commande et relu comme tout le
reste — *un objet qu'on sait écrire et qu'on ne sait pas relire n'est pas fini*
(point 8septies d'`AGENTS.md`).
"""

from __future__ import annotations

import pytest

from atelier.domaine.animation import Clip, DemandeClip, ModeleVideo, Tarification
from atelier.fournisseur.port import ClipProduit, EtatTravail


JETONS = Tarification(genre="jeton", montant=0.0000035, libelle="video_tokens")

MODELE = ModeleVideo(
    identifiant="essai:mele-les-poses",
    nom="Essai — plusieurs poses",
    fournisseur="essai",
    chez_lui="mele-les-poses",
    durees=(4, 5, 6),
    resolutions=("480p", "720p"),
    proportions=("1:1", "16:9"),
    mesure="",
    tarification=JETONS,
)


class AnimateurDouble:
    """Implémente `PortAnimateur`, sans réseau et sans facture."""

    nom = "essai"

    def __init__(self, modeles: list[ModeleVideo] | None = None) -> None:
        self.modeles = modeles if modeles is not None else [MODELE]
        self.soumissions: list[tuple[str, DemandeClip]] = []

    def indisponible(self) -> str | None:
        return None

    async def catalogue_video(self) -> list[ModeleVideo]:
        return list(self.modeles)

    async def soumettre(self, modele: ModeleVideo, demande: DemandeClip) -> str:
        self.soumissions.append((modele.identifiant, demande))
        return f"travail-{len(self.soumissions)}"

    async def etat(self, travail: str) -> EtatTravail:
        return EtatTravail(travail=travail, fini=True)

    async def recuperer(self, travail: str) -> ClipProduit:
        return ClipProduit(
            octets=b"\x00\x00\x00\x18ftypmp42 pas de vraies images ici",
            consomme=0.041,
            type_media="video/mp4",
            travail=travail,
        )


@pytest.fixture
def animateur() -> AnimateurDouble:
    return AnimateurDouble()


@pytest.fixture
def atelier_video(tmp_path, double, animateur):
    """L'atelier du produit, monté sur les deux doubles — l'image du fournisseur
    d'images sert à ce qu'un clip ait de quoi partir, comme en `A9`."""
    from atelier.services import Atelier

    return Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )


@pytest.fixture
def client_video(atelier_video):
    from fastapi.testclient import TestClient

    from atelier.api.app import creer_application

    with TestClient(creer_application(atelier_video)) as client:
        yield client


def un_sprite(client) -> str:
    """Une image dans la bibliothèque, produite par le double d'images."""
    reponse = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "un voyageur", "variations": 1},
    )
    identifiant = reponse.json()["identifiant"]
    for _ in range(200):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee"):
            break
    assets = client.get("/api/assets").json()["assets"]
    return assets[0]["identifiant"]


# ── Le sprite dont le clip est parti ────────────────────────────────────────


def test_le_clip_se_relit_avec_le_sprite_dont_il_part(
    atelier_video, client_video, tmp_path, double, animateur
):
    """*La fiche dit de quoi le clip est parti* — et un objet qu'on sait écrire et
    qu'on ne sait pas relire n'est pas fini (8septies) : l'atelier se **rouvre**
    par-dessus lui-même, et le clip relu du disque porte encore son départ.

    C'est le champ que toute la tranche ajoute au serveur : tout le reste —
    la vidéo, les bandes, le texte corrigé, le mouvement — était déjà servi.
    """
    from atelier.services import Atelier

    sprite = un_sprite(client_video)
    identifiant = client_video.post(
        "/api/clips",
        json={"modele": MODELE.identifiant, "mouvement": "marche", "asset": sprite},
    ).json()["clips"][0]["identifiant"]

    # Ce que la galerie lirait : le champ voyage dans le JSON de la génération.
    gen = client_video.get(f"/api/generations/{identifiant}").json()
    assert gen["clip"]["depart"] == sprite

    # ⚠️ Et la relecture le rend : l'atelier fermé et rouvert, le clip sait
    # encore de quoi il est parti — la fiche n'a pas besoin de le deviner.
    relu = Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )
    generation = relu.animation.lire(identifiant)
    assert generation is not None
    assert generation.clip is not None
    assert generation.clip.depart == sprite


def test_un_clip_d_avant_la_tranche_se_relit_sans_depart():
    """*Vide pour les clips d'avant ce champ, et c'est la vérité* : un objet
    sans `depart` se relit avec un départ vide, et la fiche ne montre alors
    rien plutôt que de deviner. Aucune migration, comme toujours depuis `A7`.
    """
    clip = Clip.depuis_json({"travail": "travail-1", "images": 24, "cadence": 24.0})
    assert clip is not None
    assert clip.depart == ""