# -*- coding: utf-8 -*-
"""RV1 — une vidéo ratée se dit ratée.

`docs/PLAN-revue-du-21-septembre.md`, RV1. **Aucun de ces essais n'appelle un
vrai fournisseur** : les animateurs sont les mêmes doubles qu'`A9`, `A10`,
`A11` et `AU3` emploient déjà — seuls les octets du clip changent, pour
fabriquer un raté à la demande plutôt qu'une réussite.

Neuf essais, dans l'ordre de la note de décision § 5 :

1. Noir → `echouee`, « la vidéo est revenue noire », rien n'est monté, la
   dépense et le brut restent.
2. Figé → « la vidéo ne bouge pas ».
3. Recette qui vide tout → `ClipVideApresDetourage`, rien d'écrit, le montage
   à la main reste possible.
4. Le même chemin par une fabrication suivie (`livrer_provisoire`).
5. Le contrôle ne relance jamais rien (T1) : `recuperer` et `suivre` rendent
   le clip tel quel sans toucher la file locale.
6. `en_souffrance` l'exclut ; la vidéo se sert toujours.
7. Deux vrais clips du dépôt passent le contrôle sans changement.
8. Un import noir reste `reussie`.
9. (écran) `AnimationsDuSujet.test.tsx` et `AnimerEnLot.test.tsx`.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from atelier.domaine.erreurs import ClipVideApresDetourage
from atelier.domaine.generation import Statut
from atelier.image import clip as decodeur
from atelier.image import controle_clip
from atelier.services.animation import ServiceAnimation
from atelier.depot import Base, Fichiers

from tests.conftest import commander_un_clip
from tests.test_a9 import (  # noqa: F401 — fixtures reprises telles quelles
    MELE,
    AnimateurDouble,
    animateur,
    atelier_video,
    client_video,
    clip_mp4,
    un_personnage,
    un_sprite,
)
from tests.test_au3 import _fin, production  # noqa: F401


pytestmark = pytest.mark.skipif(
    decodeur.indisponible() is not None,
    reason="le décodeur vidéo n'est pas installé — RV1 n'a rien à contrôler",
)


# ── Deux clips fabriqués pour rater, exprès ──────────────────────────────────


def clip_noir(images: int = 12, cote: int = 32) -> bytes:
    """Toutes les images à zéro — le clip du 21 septembre."""
    import imageio.v3 as iio

    suite = np.zeros((images, cote, cote, 3), dtype="uint8")
    return iio.imwrite("<bytes>", suite, extension=".mp4", fps=24)


def clip_fige(images: int = 12, cote: int = 32) -> bytes:
    """Une image de départ, puis rien ne change — le cas Wan de la note.

    L'image 0 diffère des suivantes (comme un modèle qui rend l'image de
    départ en premier) : la **moyenne** des écarts serait au-dessus du seuil,
    et c'est très exactement pourquoi la mesure retenue est la médiane.
    """
    import imageio.v3 as iio

    suite = np.full((images, cote, cote, 3), 120, dtype="uint8")
    suite[0, :16, :16] = 220
    return iio.imwrite("<bytes>", suite, extension=".mp4", fps=24)


def _attendre_le_statut_final(client, identifiant: str, cible: str, rounds: int = 300):
    """Poll jusqu'à `cible`, **sans s'arrêter à un état transitoire**.

    `_encaisser` écrit `REUSSIE` avant le contrôle (le montant d'abord, § 2) :
    un clip qui va échouer au contrôle passe donc bien par `reussie` une
    fraction de seconde avant de retomber sur `echouee`. S'arrêter au premier
    `reussie` vu attraperait cet état de passage plutôt que le verdict final.
    """
    dernier = None
    for _ in range(rounds):
        dernier = next((c for c in client.get("/api/clips").json()["clips"] if c["identifiant"] == identifiant), None)
        if dernier and dernier["statut"] == cible:
            return dernier
        client.get("/api/status")
    return dernier


# ── 1. Noire ─────────────────────────────────────────────────────────────────


async def test_un_clip_noir_echoue_au_controle_et_rien_n_est_monte(atelier_video, client_video, animateur):
    animateur.octets = clip_noir()
    sprite = un_sprite(client_video)
    personnage = un_personnage(client_video)
    client_video.put(f"/api/assets/{sprite}/character", json={"personnage": personnage, "pose": "marche"})
    lot = await commander_un_clip(
        atelier_video, modele=MELE.identifiant, mouvement="marche", asset=sprite,
        personnage=personnage, pose="marche", monter_auto=True,
    )
    await atelier_video.animation.attendre_tout()
    identifiant = lot[0]["identifiant"]
    arrive = _attendre_le_statut_final(client_video, identifiant, "echouee")
    assert arrive is not None and arrive["statut"] == "echouee", arrive
    assert arrive["clip"]["controle"] == "noire"
    assert "revenue noire" in arrive["emplacements"][0]["raison"]
    assert client_video.get(f"/api/montage/{identifiant}").json()["bandes"] == []

    # La dépense et le fichier brut restent — E18 et le disque.
    assert arrive["emplacements"][0]["consomme"] > 0 or arrive["emplacements"][0]["cout_usd"] >= 0
    dossier = atelier_video_fichiers(client_video, identifiant)
    assert (dossier / "0-brut.mp4").exists() or any(dossier.glob("0-brut.*"))
    depenses = client_video.get("/api/spending").json()
    assert any(a["identifiant"] == identifiant for a in depenses["appels"])


def atelier_video_fichiers(client_video, identifiant: str) -> Path:
    """Le dossier de cette génération, retrouvé depuis l'app FastAPI du client."""
    atelier = client_video.app.state.atelier
    return atelier.fichiers.dossier_generation(identifiant)


# ── 2. Figée ─────────────────────────────────────────────────────────────────


async def test_un_clip_fige_echoue_au_controle(atelier_video, client_video, animateur):
    animateur.octets = clip_fige()
    sprite = un_sprite(client_video)
    personnage = un_personnage(client_video)
    client_video.put(f"/api/assets/{sprite}/character", json={"personnage": personnage, "pose": "marche"})
    lot = await commander_un_clip(
        atelier_video, modele=MELE.identifiant, mouvement="marche", asset=sprite,
        personnage=personnage, pose="marche", monter_auto=True,
    )
    await atelier_video.animation.attendre_tout()
    identifiant = lot[0]["identifiant"]
    arrive = _attendre_le_statut_final(client_video, identifiant, "echouee")
    assert arrive is not None and arrive["statut"] == "echouee", arrive
    assert arrive["clip"]["controle"] == "immobile"
    assert "ne bouge pas" in arrive["emplacements"][0]["raison"]


# ── 3. Vide après détourage — et le montage à la main reste possible ────────


async def test_vide_apres_detourage_refuse_et_le_montage_a_la_main_reste_possible(
    atelier_video, client_video, animateur, monkeypatch
):
    animateur.octets = clip_mp4()
    sprite = un_sprite(client_video)
    personnage = un_personnage(client_video)
    client_video.put(f"/api/assets/{sprite}/character", json={"personnage": personnage, "pose": "marche"})
    lot = await commander_un_clip(
        atelier_video, modele=MELE.identifiant, mouvement="marche", asset=sprite,
        personnage=personnage, pose="marche",
    )
    await atelier_video.animation.attendre_tout()
    identifiant = lot[0]["identifiant"]
    arrive = _attendre_le_statut_final(client_video, identifiant, "reussie")
    assert arrive is not None and arrive["statut"] == "reussie", arrive

    atelier = client_video.app.state.atelier
    # **Aucune image réelle ne peut être fabriquée « vide » sans réécrire le
    # moteur de détourage** — donc le seuil est celui qu'on règle ici, très
    # exactement comme la note le prévoit (§3) : la mesure elle-même est
    # vérifiée à part, sur des tableaux synthétiques, dans
    # `test_controle_clip_module_pur` plus bas.
    monkeypatch.setattr(controle_clip, "SEUIL_VIDE_OPAQUE", 2.0)
    with pytest.raises(ClipVideApresDetourage, match="détourage n'a rien laissé"):
        atelier.montage.garder(identifiant, "essai", [0, 1], a_l_arrivee=True)
    assert atelier.base.bandes_du_clip(identifiant) == []
    dossier_bandes = atelier.fichiers.dossier_generation(identifiant) / "bandes"
    assert not dossier_bandes.exists() or not any(dossier_bandes.glob("*.json"))

    # Le même clip, monté à la main (sans `a_l_arrivee`) : toujours possible.
    bande = atelier.montage.garder(identifiant, "à la main", [0, 1])
    assert bande.identifiant


# ── 4. Le même chemin par une fabrication suivie ─────────────────────────────


async def test_fabrication_suivie_vide_passe_a_verifier_et_propose_une_nouvelle_demande(
    production, monkeypatch, tmp_path
):
    atelier, projet, demande, animateur = production
    godot = tmp_path / "Godot"
    godot.mkdir()
    (godot / "project.godot").write_text(
        'config_version=5\n[application]\nconfig/features=PackedStringArray("4.7")\n', encoding="utf-8"
    )
    atelier.livraison.associer(projet, str(godot))
    monkeypatch.setattr(controle_clip, "SEUIL_VIDE_OPAQUE", 2.0)
    travail = await atelier.travaux.preparer(projet, {**demande, "livrer_provisoire": True})
    fini = await _fin(atelier, projet, travail)
    assert fini["etat"] == "a_verifier", fini
    assert fini["controle"] == "vide"
    assert fini["prochaine_action"] == "creer_nouvelle_demande"
    assert not fini["bandes"]
    assert atelier.livraison.historique(projet)["livraisons"] == []


# ── 5. Rien ne relance rien (T1) ─────────────────────────────────────────────


class _FileLocaleQuiSonne:
    """Un `_file_locale` qui échoue le test s'il est ne serait-ce que consulté."""

    def trouver(self, cle: str):
        raise AssertionError("la file locale a été consultée sur un clip contrôlé")


async def test_recuperer_et_suivre_rendent_un_clip_controle_sans_rien_relancer(tmp_path):
    fichiers = Fichiers(tmp_path / "donnees")
    fichiers.preparer()
    service = ServiceAnimation(
        base=Base(tmp_path / "donnees" / "atelier.sqlite3"),
        fichiers=fichiers,
        animateur=lambda: AnimateurDouble(),
    )
    await service.rafraichir()
    generation = await service.commander(MELE.identifiant, _demande())
    await service.attendre_tout()
    service.rater_a_l_arrivee(service.lire(generation.identifiant), "noire", "la vidéo est revenue noire")

    # Après le raté, aucune des deux portes de reprise ne doit toucher au
    # fournisseur ni à une file locale : la garde vaut même sans file locale,
    # et `_FileLocaleQuiSonne` en ajoute une qui ferait échouer le test si on
    # la consultait.
    service._file_locale = _FileLocaleQuiSonne()  # type: ignore[assignment]
    rapatrie = await service.recuperer(generation.identifiant)
    assert rapatrie.statut == Statut.ECHOUEE and rapatrie.clip.controle == "noire"
    suivi = await service.suivre(generation.identifiant)
    assert suivi.statut == Statut.ECHOUEE and suivi.clip.controle == "noire"


def _demande():
    from atelier.domaine.animation import DemandeClip

    return DemandeClip(texte="essai", image=b"\x89PNG\r\n\x1a\nsprite", secondes=5)


# ── 6. `en_souffrance` l'exclut ; la vidéo se sert toujours ─────────────────


async def test_en_souffrance_exclut_le_clip_rate_et_la_video_se_sert_toujours(atelier_video, client_video, animateur):
    animateur.octets = clip_noir()
    sprite = un_sprite(client_video)
    personnage = un_personnage(client_video)
    client_video.put(f"/api/assets/{sprite}/character", json={"personnage": personnage, "pose": "marche"})
    lot = await commander_un_clip(
        atelier_video, modele=MELE.identifiant, mouvement="marche", asset=sprite,
        personnage=personnage, pose="marche",
    )
    await atelier_video.animation.attendre_tout()
    identifiant = lot[0]["identifiant"]
    arrive = _attendre_le_statut_final(client_video, identifiant, "echouee")
    assert arrive is not None and arrive["statut"] == "echouee", arrive

    en_souffrance = client_video.get("/api/clips/pending").json()["clips"]
    assert identifiant not in {c["identifiant"] for c in en_souffrance}

    video = client_video.get(f"/api/clips/{identifiant}/video")
    assert video.status_code == 200 and video.content


# ── 7. Deux vrais clips du dépôt passent le contrôle sans changement ────────


BANCS = [
    Path("docs/archive/recherche-video-locale/bancs/pixel/vrai-17/017.mp4"),
    Path("docs/archive/recherche-video-locale/bancs/pixel/vrai-45/045.mp4"),
]


@pytest.mark.parametrize("banc", BANCS, ids=[str(b) for b in BANCS])
def test_un_vrai_clip_reussi_passe_le_controle_sans_changement(banc, tmp_path):
    chemin = Path(__file__).resolve().parents[1] / banc
    if not chemin.exists():  # pragma: no cover — banc absent de ce clone
        pytest.skip(f"{banc} n'est pas dans ce dépôt")
    dossier = tmp_path / "images"
    decodeur.extraire(chemin, dossier)
    from PIL import Image

    images = [np.asarray(Image.open(p).convert("RGB")) for p in sorted(dossier.glob("*.png"))]
    code, _mesure = controle_clip.controler_images(images)
    assert code is None, f"{banc} : contrôle refusé alors qu'il a réussi ({code})"


# ── 8. Un import noir reste réussi ───────────────────────────────────────────


def test_un_import_noir_reste_reussie(client_video):
    reponse = client_video.post(
        "/api/clips/import", content=clip_noir(), params={"nom": "noire.mp4"}
    )
    assert reponse.status_code == 201, reponse.text
    clip = reponse.json()["clip"]
    assert clip["statut"] == "reussie"
    assert clip["clip"]["nature"] == "importe"
    assert clip["clip"].get("controle") in (None, "")


# ── Le module pur, sur des tableaux synthétiques ─────────────────────────────


def test_controle_clip_module_pur():
    """Les trois mesures, indépendamment du reste du produit."""
    noir = [np.zeros((8, 8, 3), dtype="uint8") for _ in range(6)]
    assert controle_clip.controler_images(noir)[0] == controle_clip.NOIRE

    fige = [np.full((8, 8, 3), 150, dtype="uint8") for _ in range(6)]
    assert controle_clip.controler_images(fige)[0] == controle_clip.IMMOBILE

    bouge = [np.full((8, 8, 3), (i * 40) % 255, dtype="uint8") for i in range(6)]
    assert controle_clip.controler_images(bouge)[0] is None

    vide = [np.zeros((8, 8, 4), dtype="uint8")]  # alpha entièrement à zéro
    assert controle_clip.vide_apres_detourage(vide) is True
    plein = [np.full((8, 8, 4), 255, dtype="uint8")]
    assert controle_clip.vide_apres_detourage(plein) is False
    assert controle_clip.vide_apres_detourage([]) is True
