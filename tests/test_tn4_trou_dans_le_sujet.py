# -*- coding: utf-8 -*-
"""TN4 — un trou dans le sujet se voit à l'arrivée
(`docs/PLAN-transparence-native.md`).

**Ce que la mesure sépare, en une phrase et sans chiffre** (écrite avant le
code, `AGENTS.md` 8sexies) : *une robe sortie transparente est un grand vide
que seul le trait du contour sépare du fond ; l'espace entre un bras et le
corps est enfermé lui aussi, mais derrière toute l'épaisseur d'un bras — et une
anse, deux jambes jointes n'enferment qu'un petit vide.*

**Les images.** Les six sujets isolés du banc du 22 septembre 2026 sont ceux de
TN3 (`tests/fixtures/banc_tn3/`, 192 px) ; les deux planches — le mage champignon
à la robe blanche sortie transparente, le renard en marche — sont ramenées de
1 024 à 256 px au plus proche voisin (`tests/fixtures/banc_tn4/`), alpha gardé
tel quel. **Le banc n'a aucun bras écarté du corps** : les faux trous sont donc
dessinés ici, à la main, et c'est eux qui ont fait tomber la première mesure.

Aucun appel payé, aucun ComfyUI réel : le fournisseur est le double de
`conftest`, avec un modèle de plus qui déclare la capacité.
"""

from __future__ import annotations

import asyncio
import io
import time
from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageDraw

from atelier.domaine.asset import identifiant_de
from atelier.domaine.catalogue import Modele
from atelier.domaine.demande import Demande
from atelier.domaine.transparence import QUEUE, TETE, desencadrer, encadrer
from atelier.image import traitement as T
from atelier.services import Atelier
from tests.conftest import CATALOGUE, FOURNISSEUR, FournisseurDouble

FIXTURES = Path(__file__).parent / "fixtures"
SIX = ("chevalier", "salamandre", "fiole", "bouton", "voleur-pixel", "coffre-pixel")

CAPABLE = "essai:rend-du-vide"
ORDINAIRE = "essai:rend-du-png"


def _octets(nom: str) -> bytes:
    dossier = "banc_tn3" if nom in SIX else "banc_tn4"
    return (FIXTURES / dossier / f"{nom}.png").read_bytes()


def _png(rgba: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


# ── Des silhouettes dessinées pour l'essai ───────────────────────────────────
#
# 256 px, un sujet vert franchement opaque sur le fond vide de Qwen : alpha nul
# sous un **voile de 0 à 15**, la couleur violette qu'il laisse dessous.

COTE = 256
MATIERE = (90, 120, 60, 255)
TRAIT = (30, 30, 30, 255)


def _toile() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGBA", (COTE, COTE), (160, 55, 204, 0))
    return image, ImageDraw.Draw(image)


def _voile(image: Image.Image) -> np.ndarray:
    rgba = np.asarray(image).copy()
    vide = rgba[:, :, 3] == 0
    rgba[:, :, 3][vide] = np.random.default_rng(4).integers(0, 16, size=int(vide.sum()))
    return rgba


def _personnage(*, bras: bool = True, robe_trouee: bool = False) -> np.ndarray:
    """Une tête, un buste, deux jambes **aux pieds joints** — et, avec `bras`,
    deux poings sur les hanches : trois vides enfermés par le sujet lui-même.
    `robe_trouee` : le buste n'est plus qu'un trait de deux pixels autour d'un
    vide, comme la robe du mage."""
    image, d = _toile()
    d.ellipse((106, 18, 150, 62), fill=MATIERE)
    if robe_trouee:
        d.rectangle((96, 62, 160, 176), fill=TRAIT)
        d.rectangle((98, 64, 158, 174), fill=(240, 240, 240, 20))
    else:
        d.rectangle((96, 62, 160, 176), fill=MATIERE)
    d.rectangle((100, 176, 124, 238), fill=MATIERE)
    d.rectangle((132, 176, 156, 238), fill=MATIERE)
    d.rectangle((100, 230, 156, 244), fill=MATIERE)
    if bras:
        d.line([(98, 70), (58, 112), (98, 150)], fill=MATIERE, width=12, joint="curve")
        d.line([(158, 70), (198, 112), (158, 150)], fill=MATIERE, width=12, joint="curve")
    return _voile(image)


def _fiole_a_anse() -> np.ndarray:
    image, d = _toile()
    d.ellipse((50, 90, 190, 230), fill=MATIERE)
    d.rectangle((105, 40, 135, 100), fill=MATIERE)
    d.ellipse((160, 100, 230, 200), outline=MATIERE, width=12)
    return _voile(image)


# ── La mesure, sur le banc ───────────────────────────────────────────────────


def test_la_planche_du_mage_est_signalee():
    """La robe blanche sortie transparente : 21,8 % du sujet à 256 px — 28 %
    sur l'original à 1 024 —, bien au-dessus du seuil."""
    part = T.part_enfermee(_octets("mage-planche"))
    assert part > 0.2, part
    assert T.sujet_troue(_octets("mage-planche"))


@pytest.mark.parametrize("nom", SIX + ("renard-planche",))
def test_les_sept_autres_tirages_du_banc_ne_le_sont_pas(nom):
    """0,5 % au plus : quelques miettes enfermées sous une oreille ou dans le
    coffre, jamais un pan du sujet."""
    part = T.part_enfermee(_octets(nom))
    assert part < 0.01, (nom, part)
    assert not T.sujet_troue(_octets(nom))


def test_la_marge_du_seuil_sur_le_banc():
    """Les chiffres qui calent `PART_ENFERMEE_MAX` : le mage en est à près du
    double, le plus haut des sept autres à vingt fois moins."""
    mage = T.part_enfermee(_octets("mage-planche"))
    autres = max(T.part_enfermee(_octets(n)) for n in SIX + ("renard-planche",))
    assert mage > 1.8 * T.PART_ENFERMEE_MAX
    assert autres < T.PART_ENFERMEE_MAX / 20


# ── Le point dur : l'espace entre un bras et le corps ────────────────────────


def test_les_poings_sur_les_hanches_ne_suffisent_pas():
    """**Le cas qui a fait tomber la première mesure.** Le vide enfermé seul
    pèse 14 % du sujet — au-dessus du seuil ; derrière l'épaisseur d'un bras,
    il ne compte pas."""
    rgba = _personnage()
    assert T.part_enfermee(rgba, mince=False) > T.PART_ENFERMEE_MAX
    assert T.part_enfermee(rgba) == 0.0
    assert not T.sujet_troue(rgba)


def test_les_pieds_joints_ne_suffisent_pas():
    rgba = _personnage(bras=False)
    assert 0 < T.part_enfermee(rgba, mince=False) < T.PART_ENFERMEE_MAX
    assert not T.sujet_troue(rgba)


def test_l_anse_d_une_fiole_ne_suffit_pas():
    """11 % du sujet : sous le seuil par son poids, et — même au-dessus — son
    mur est une anse de douze pixels, pas un trait."""
    rgba = _fiole_a_anse()
    assert 0.08 < T.part_enfermee(rgba) < T.PART_ENFERMEE_MAX
    assert not T.sujet_troue(rgba)
    # Grossie de moitié, l'anse passerait le seuil par son poids : le mur
    # l'arrête.
    image, d = _toile()
    d.ellipse((40, 90, 170, 220), fill=MATIERE)
    d.ellipse((140, 70, 250, 240), outline=MATIERE, width=12)
    grosse = _voile(image)
    assert T.part_enfermee(grosse, mince=False) > T.PART_ENFERMEE_MAX
    assert not T.sujet_troue(grosse)


def test_une_robe_trouee_est_signalee():
    assert T.sujet_troue(_personnage(bras=False, robe_trouee=True))


def test_une_robe_trouee_l_est_encore_avec_les_poings_sur_les_hanches():
    """Les bras ne comptent pas, la robe compte seule — et suffit."""
    rgba = _personnage(robe_trouee=True)
    assert T.sujet_troue(rgba)


def test_la_mesure_est_deterministe_et_ne_signale_ni_rien_ni_l_illisible():
    octets = _octets("mage-planche")
    assert T.part_enfermee(octets) == T.part_enfermee(octets)
    assert not T.sujet_troue(b"pas une image")
    assert not T.sujet_troue(_png(np.zeros((16, 16, 4), dtype=np.uint8)))


# ── La consigne tombe avec le fond vide ──────────────────────────────────────


def test_desencadrer_est_l_inverse_d_encadrer():
    for texte in ("Hand-drawn 2D game art, a knight.", "CONTEXT\n\nun nain."):
        assert desencadrer(encadrer(texte)) == texte
    assert desencadrer("un nain") == "un nain"
    # Le fond de l'appel prend la place de la queue, et seulement s'il y en
    # avait une : un texte sans consigne ne gagne rien.
    fond = "single isolated sprite on a flat solid #00B140 studio green background"
    assert desencadrer(encadrer("CONTEXT\n\nun nain."), fond) == (
        "CONTEXT\n\nun nain.\n\n"
        "Single isolated sprite on a flat solid #00B140 studio green background."
    )
    assert desencadrer("un nain", fond) == "un nain"


def test_le_fond_colore_s_enregistre_seulement_quand_il_est_vrai():
    assert "fond_colore" not in Demande(prompt="x").resume()
    assert Demande(prompt="x", fond_colore=True).resume()["fond_colore"] is True


# ── Par l'atelier ────────────────────────────────────────────────────────────


class DoubleCapable(FournisseurDouble):
    """Le double de `conftest`, avec un modèle de plus qui rend un fond vide
    (le même que TN2 et TN3)."""

    async def catalogue(self) -> list[Modele]:
        base = await super().catalogue()
        return base + [
            Modele(
                identifiant=CAPABLE,
                nom="Essai fond vide",
                fournisseur=FOURNISSEUR,
                chez_lui="rend-du-vide",
                references_max=CATALOGUE[0].references_max,
                proportions=CATALOGUE[0].proportions,
                variations_max=4,
                transparence=True,
            )
        ]


@pytest.fixture
def double() -> DoubleCapable:
    return DoubleCapable()


def _attendre(client, identifiant: str) -> dict:
    for _ in range(80):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            break
        time.sleep(0.05)
    assert lue["statut"] == "reussie", lue
    return lue


def _lancer(client, **corps) -> dict:
    corps = {"modele": CAPABLE, "prompt": "un nain", **corps}
    reponse = client.post("/api/generations", json=corps)
    assert reponse.status_code == 202, reponse.text
    return _attendre(client, reponse.json()["identifiant"])


def _ne(client, double, octets: bytes, modele: str = CAPABLE):
    double.rendre = lambda: octets
    lue = _lancer(client, modele=modele)
    return identifiant_de(lue["identifiant"], 0), lue


def _impose(client, identifiant: str) -> dict:
    reponse = client.get(f"/api/assets/{identifiant}/imposed")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def test_la_fiche_du_mage_ne_transparent_dit_que_le_sujet_est_troue(client, double):
    identifiant, _ = _ne(client, double, _octets("mage-planche"))
    impose = _impose(client, identifiant)
    assert impose["detouree_par_le_modele"] is True
    assert impose["sujet_troue"] is True


def test_une_image_nee_transparente_sans_trou_ne_dit_rien(client, double):
    identifiant, _ = _ne(client, double, _octets("chevalier"))
    impose = _impose(client, identifiant)
    assert impose["detouree_par_le_modele"] is True
    assert impose["sujet_troue"] is False


def test_sans_fond_vide_demande_la_question_ne_se_pose_pas(client, double):
    """*Née transparente* seulement : un modèle ordinaire qui rend le mage
    n'a rien promis, et le détourage de l'atelier s'en occupe."""
    identifiant, lue = _ne(client, double, _octets("mage-planche"), modele=ORDINAIRE)
    assert "transparence" not in lue["demande"]
    assert _impose(client, identifiant)["sujet_troue"] is False


def test_refermee_et_rouverte_index_efface_le_signal_revient(
    client, atelier, double, tmp_path
):
    """8septies : rien n'est gardé — le signal se recalcule sur le brut, qui
    ne change jamais. L'index effacé, l'atelier rouvert le retrouve."""
    identifiant, _ = _ne(client, double, _octets("mage-planche"))
    for suffixe in ("", "-wal", "-shm"):
        (tmp_path / f"atelier.sqlite3{suffixe}").unlink(missing_ok=True)
    refait = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(refait.ouvrir())
    assert refait.assets.impose(identifiant)["sujet_troue"] is True


# ── « Refaire sur fond coloré » ──────────────────────────────────────────────
#
# Le geste de la fiche **reprend les réglages** de la génération (texte repris,
# même modèle) et pose `fond_colore`. Il ne paie pas : il remplit la
# préparation, et c'est la barre qui paie qui ouvre l'écran de confirmation —
# `POST /api/outgoing`, qui annonce le prix — puis `POST /api/generations`.


def _repris(lue: dict) -> dict:
    """Ce que « reprendre les réglages » remet dans la préparation."""
    return {"prompt": lue["demande"]["prompt"], "repris": True}


def test_l_ecran_de_confirmation_annonce_un_fond_colore_et_le_prix(client, double):
    _, lue = _ne(client, double, _octets("mage-planche"))
    assert lue["demande"]["prompt"].startswith(TETE)

    sans = client.post(
        "/api/outgoing", json={"modele": CAPABLE, **_repris(lue)}
    ).json()
    assert sans["fond"]["transparence"] is True

    envoi = client.post(
        "/api/outgoing", json={"modele": CAPABLE, **_repris(lue), "fond_colore": True}
    )
    assert envoi.status_code == 200, envoi.text
    envoi = envoi.json()
    assert envoi["fond"]["transparence"] is False
    assert envoi["fond"]["couleur"].startswith("#")
    assert TETE not in envoi["texte"] and QUEUE not in envoi["texte"]
    # Le fond de l'appel prend la place de la consigne : le texte repris ne
    # nommait aucun fond, il nomme maintenant celui qui partira.
    assert f"flat solid {envoi['fond']['couleur']}" in envoi["texte"]
    # **Le chemin qui annonce ce que ça coûte** : le prix de l'appel est là,
    # le même que sans le geste — refaire n'est pas un raccourci qui paie.
    assert "prix" in envoi and envoi["prix"]["total"] == sans["prix"]["total"]
    assert envoi["prix"]["appels"] == 1


def test_refaire_sur_fond_colore_repart_sans_la_transparence(client, double):
    _, lue = _ne(client, double, _octets("mage-planche"))
    assert lue["demande"]["transparence"] is True

    double.rendre = lambda: _octets("chevalier")
    refaite = _lancer(client, **_repris(lue), fond_colore=True)

    assert "transparence" not in refaite["demande"]
    assert refaite["demande"]["fond_colore"] is True
    assert TETE not in refaite["demande"]["prompt"]
    assert QUEUE not in refaite["demande"]["prompt"]
    assert "flat solid #" in refaite["demande"]["prompt"]
    # Le reste du texte est celui qui était parti, mot pour mot.
    assert refaite["demande"]["prompt"].startswith("REQUEST\n\nun nain.")
    # Le fond de l'atelier s'interdit sur le sujet, comme pour tout appel
    # coloré : il y a de nouveau une couleur à interdire.
    assert refaite["demande"]["prompt_negatif"]


def test_rien_ne_part_tout_seul(client, double):
    """T1 : le signal ne relance rien. Une image trouée reste la seule
    génération tant que l'auteur n'a pas fait le geste."""
    identifiant, _ = _ne(client, double, _octets("mage-planche"))
    assert _impose(client, identifiant)["sujet_troue"] is True
    # Relire la fiche, deux fois, n'appelle personne.
    _impose(client, identifiant)
    assert double.appels == 1
