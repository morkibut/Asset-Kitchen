# -*- coding: utf-8 -*-
"""TN3 — le détourage s'endort pour une image née transparente
(`docs/PLAN-transparence-native.md`).

**Ce que la mesure sépare, en une phrase et sans chiffre** (écrite avant le
code, `AGENTS.md` 8sexies) : *un vrai fond vide, c'est un cadre d'image
transparent autour d'un sujet franchement opaque ; une image opaque, ou dont
l'alpha n'est qu'un voile presque plein partout, n'a pas de cadre transparent et
ne passe pas.*

**Les images sont celles du banc du 22 septembre 2026** — six tirages de
Qwen-Image 2.1 en RGBA, ramenés de 1 024 à 192 px au plus proche voisin pour
tenir dans le dépôt (`tests/fixtures/banc_tn3/`, 284 Ko en tout). Le plus proche
voisin garde les valeurs d'alpha telles quelles : le voile de 1 à 15 sous le fond
vide et les débris sombres du coffre y sont, comme sur l'original.

Aucun appel payé, aucun ComfyUI réel : le fournisseur est le double de
`conftest`, avec un modèle de plus qui déclare la capacité.
"""

from __future__ import annotations

import asyncio
import io
import time
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from atelier.services import Atelier
from atelier.domaine.asset import identifiant_de
from atelier.domaine.catalogue import Modele
from atelier.domaine.recette import (
    DETOURAGE,
    SEUIL_DU_PIXEL_DU_MODELE,
    SEUIL_DU_VIDE,
    Grille,
    Passe,
    Quantification,
    Recadrage,
    Recette,
    voyage,
)
from atelier.image import traitement as T
from tests.conftest import CATALOGUE, FOURNISSEUR, FournisseurDouble

BANC = Path(__file__).parent / "fixtures" / "banc_tn3"
#: Les six sujets isolés du banc — les deux planches sont hors de TN3.
DESSIN = ("chevalier", "salamandre", "fiole", "bouton")
PIXEL = ("voleur-pixel", "coffre-pixel")
SIX = DESSIN + PIXEL

CAPABLE = "essai:rend-du-vide"
ORDINAIRE = "essai:rend-du-png"


def _octets(nom: str) -> bytes:
    return (BANC / f"{nom}.png").read_bytes()


def _png(image: Image.Image) -> bytes:
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _tableau(octets: bytes) -> np.ndarray:
    return np.asarray(Image.open(io.BytesIO(octets)).convert("RGBA"))


def _opaque() -> bytes:
    """Le chevalier, **aplati** : ce qu'un modèle capable rend quand il n'a
    pas suivi la consigne — une image sans un pixel transparent."""
    brut = Image.open(BANC / "chevalier.png").convert("RGBA")
    fond = Image.new("RGBA", brut.size, (160, 55, 204, 255))
    fond.alpha_composite(brut)
    return _png(fond.convert("RGB"))


def _voile_plein() -> bytes:
    """Un alpha de bruit, de 223 à 255 : ce que Qwen rend quand on ne lui a
    rien demandé (TN1). Aucun pixel de cadre n'est transparent."""
    tirage = np.random.default_rng(22).integers(223, 256, size=(96, 96), dtype=np.uint8)
    rgba = np.zeros((96, 96, 4), dtype=np.uint8)
    rgba[:, :, :3] = 128
    rgba[:, :, 3] = tirage
    return _png(Image.fromarray(rgba, mode="RGBA"))


def _recette_du_jeu(nom: str) -> Recette:
    """La recette qu'un jeu pose sur un personnage : en pixel art, une grille
    et une réduction des couleurs ; en dessin, ni l'une ni l'autre."""
    pixel = nom in PIXEL
    return Recette(
        passes=(Passe(),),
        recadrage=Recadrage(),
        grille=Grille(cible=64) if pixel else None,
        quantification=Quantification(couleurs=16) if pixel else None,
    )


def _nee_transparente(recette: Recette) -> Recette:
    return replace(recette, fond_du_modele=True).endormie(DETOURAGE, True)


def _hors_du_sujet(rgba: np.ndarray) -> tuple[float, int]:
    """**Les débris** : la part de l'image à demi transparente hors du sujet, et
    le nombre de pixels visibles hors du sujet. Le sujet est le plus grand amas
    franchement opaque, élargi de deux pixels pour ne pas compter son propre
    bord adouci."""
    alpha = rgba[:, :, 3]
    amas = T.composantes(alpha >= 128)
    assert amas, "l'image n'a plus de sujet"
    sujet = T.etendre(max(amas, key=lambda z: z[1])[0], 2)
    demi = (alpha > 0) & (alpha < 255) & ~sujet
    visibles = (alpha > 0) & ~sujet
    return float(demi.mean()), int(visibles.sum())


# ── La mesure : un vrai fond vide ────────────────────────────────────────────


@pytest.mark.parametrize("nom", SIX)
def test_les_six_tirages_du_banc_ont_un_vrai_fond_vide(nom):
    assert T.fond_vide(_octets(nom)) is True


def test_une_image_opaque_n_a_pas_de_fond_vide():
    assert T.fond_vide(_opaque()) is False


def test_un_alpha_de_bruit_n_a_pas_de_fond_vide():
    """Presque tout est transparent à 13 % près — et rien du cadre ne l'est."""
    assert T.fond_vide(_voile_plein()) is False


def test_une_image_toute_transparente_n_a_rien_et_pas_un_fond_vide():
    assert T.fond_vide(_png(Image.new("RGBA", (32, 32), (0, 0, 0, 0)))) is False


def test_un_fichier_illisible_n_a_pas_de_fond_vide():
    assert T.fond_vide(b"pas une image") is False


def test_le_voile_du_banc_est_sous_le_seuil_du_vide_et_le_sujet_au_dessus():
    """Les deux chiffres qui calent `SEUIL_DU_VIDE` : le cadre des six tirages
    est tout entier sous le seuil, et le sujet — le plus grand amas opaque —
    ne l'est jamais."""
    for nom in SIX:
        alpha = _tableau(_octets(nom))[:, :, 3]
        cadre = np.concatenate([alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]])
        assert (cadre < SEUIL_DU_VIDE).all(), nom
        # Le voile existe bien : sans lui, le seuil ne servirait à rien.
        assert ((alpha > 0) & (alpha < SEUIL_DU_VIDE)).mean() > 0.25, nom


# ── Le traitement d'une image née transparente ───────────────────────────────


@pytest.mark.parametrize("nom", SIX)
def test_les_six_sujets_isoles_arrivent_sans_debris(nom):
    """La part de pixels à demi transparents hors du sujet, **après la
    recette** : de 35 à 72 % sur le brut (le voile), moins de 2 % une fois né
    transparent — et ce qui reste en dessin est la fumée de la salamandre, qui
    est à elle."""
    octets = _octets(nom)
    brut, _ = _hors_du_sujet(_tableau(octets))
    assert brut > 0.3, nom

    rendu = _tableau(T.appliquer(_nee_transparente(_recette_du_jeu(nom)), octets).octets)
    demi, visibles = _hors_du_sujet(rendu)

    assert demi < 0.02, (nom, demi)
    if nom in PIXEL:
        # Tout ou rien : plus un seul pixel à moitié là, et au plus une miette.
        assert demi == 0.0 and visibles <= 8, (nom, visibles)
        # Et le sujet est mis **en case**, pas réduit tout entier.
        assert rendu.shape[:2] == (64, 64)
        assert T.boite_opaque(rendu[:, :, 3]) is not None
    else:
        # Le voile est parti, donc le recadrage serre sur le sujet au lieu de
        # garder l'image entière — ce qu'il faisait, détourage endormi, sans
        # le fond du modèle.
        assert rendu.shape[0] < 192 or rendu.shape[1] < 192, rendu.shape


def test_le_coffre_perd_ses_debris_que_le_detourage_d_aujourd_hui_rendait_opaques():
    """**Le constat qui a fixé `SEUIL_DU_PIXEL_DU_MODELE`.** Le détourage
    d'aujourd'hui durcit l'alpha à 128 : les débris sombres du coffre, à moitié
    transparents dans le brut, ressortent **noirs et opaques** autour de lui.
    Le tout-ou-rien à 240 les efface sans toucher au voleur."""
    octets = _octets("coffre-pixel")
    aujourd_hui = _tableau(T.appliquer(_recette_du_jeu("coffre-pixel"), octets).octets)
    ne = _tableau(
        T.appliquer(_nee_transparente(_recette_du_jeu("coffre-pixel")), octets).octets
    )
    _, debris_aujourd_hui = _hors_du_sujet(aujourd_hui)
    _, debris_ne = _hors_du_sujet(ne)
    assert debris_aujourd_hui > 60
    assert debris_ne <= 8
    assert SEUIL_DU_PIXEL_DU_MODELE == 240


def test_sans_grille_la_fumee_garde_son_alpha_et_seul_le_voile_tombe():
    """En dessin, l'alpha du modèle est un cadeau : on ne coupe que le voile."""
    octets = _octets("salamandre")
    rgba = T.detourer(_nee_transparente(_recette_du_jeu("salamandre")), octets)
    alpha = rgba[:, :, 3]
    assert not ((alpha > 0) & (alpha < SEUIL_DU_VIDE)).any()
    assert ((alpha >= SEUIL_DU_VIDE) & (alpha < 255)).any()


def test_la_couleur_sous_le_fond_vide_est_repeinte_par_le_lit():
    """Qwen laisse un violet sous ce qu'il rend transparent : le lit de couleur
    le recouvre comme il recouvre le magenta d'un détourage."""
    octets = _octets("chevalier")
    rendu = _tableau(T.appliquer(_nee_transparente(_recette_du_jeu("chevalier")), octets).octets)
    vides = rendu[:, :, 3] == 0
    violets = (
        (np.abs(rendu[:, :, 0].astype(int) - 160) < 30)
        & (rendu[:, :, 1] < 80)
        & (rendu[:, :, 2] > 170)
    )
    assert vides.any()
    assert not (vides & violets).any()


@pytest.mark.parametrize("nom", SIX)
def test_reveiller_le_detourage_redonne_le_resultat_d_aujourd_hui(nom):
    """Au pixel près : une passe qui agit passe devant le fond du modèle, et
    rien de TN3 ne s'applique."""
    octets = _octets(nom)
    aujourd_hui = T.appliquer(_recette_du_jeu(nom), octets).octets
    reveillee = _nee_transparente(_recette_du_jeu(nom)).endormie(DETOURAGE, False)
    assert np.array_equal(
        _tableau(T.appliquer(reveillee, octets).octets), _tableau(aujourd_hui)
    )


# ── La recette ───────────────────────────────────────────────────────────────


def test_sans_fond_du_modele_la_recette_s_ecrit_comme_avant():
    """L'empreinte de toutes les recettes d'avant la tranche ne bouge pas."""
    recette = _recette_du_jeu("voleur-pixel")
    assert "fond_du_modele" not in recette.en_json()
    assert recette.a_une_silhouette() is bool(recette.passes_vives())
    endormie = recette.endormie(DETOURAGE, True)
    assert endormie.a_une_silhouette() is False
    assert endormie.seuil_du_fond_du_modele() is None


def test_le_fond_du_modele_se_relit():
    recette = _nee_transparente(_recette_du_jeu("voleur-pixel"))
    relue = Recette.depuis_json(recette.en_json())
    assert relue == recette
    assert relue.fond_du_modele and relue.dort(DETOURAGE)
    assert relue.seuil_du_fond_du_modele() == SEUIL_DU_PIXEL_DU_MODELE
    assert _nee_transparente(_recette_du_jeu("fiole")).seuil_du_fond_du_modele() == SEUIL_DU_VIDE


def test_le_fond_du_modele_ne_voyage_pas_et_reveille_le_detourage():
    """Un fait de l'image, pas un réglage : posé ailleurs, il mettrait une
    image opaque en case sans rien lui retirer."""
    voyagee, laisse = voyage(_nee_transparente(_recette_du_jeu("chevalier")))
    assert voyagee.fond_du_modele is False
    assert not voyagee.dort(DETOURAGE)
    assert any("fond vide rendu par le modèle" in phrase for phrase in laisse)


# ── La naissance, par l'atelier ──────────────────────────────────────────────


class DoubleCapable(FournisseurDouble):
    """Le double de `conftest`, avec un modèle de plus qui rend un fond vide
    (le même que `tests/test_tn2_texte.py`)."""

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


def _lancer(client, modele: str = CAPABLE, **corps) -> dict:
    reponse = client.post(
        "/api/generations", json={"modele": modele, "prompt": "un nain", **corps}
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(80):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            break
        time.sleep(0.05)
    assert lue["statut"] == "reussie", lue
    return lue


def _ne(client, atelier, double, octets: bytes, modele: str = CAPABLE):
    double.rendre = lambda: octets
    lue = _lancer(client, modele)
    return atelier.assets.lire(identifiant_de(lue["identifiant"], 0)), lue


def _rendu(atelier, asset) -> np.ndarray:
    octets, _ = atelier.assets.octets(asset)
    return _tableau(octets)


def test_une_image_demandee_et_recue_transparente_nait_detouree_par_le_modele(
    client, atelier, double
):
    asset, lue = _ne(client, atelier, double, _octets("voleur-pixel"))

    assert lue["demande"]["transparence"] is True
    assert asset.recette.fond_du_modele is True
    assert asset.recette.dort(DETOURAGE)
    # Les réglages de la passe restent écrits : la réveiller les retrouve.
    assert asset.recette.passes
    impose = client.get(f"/api/assets/{asset.identifiant}/imposed").json()
    assert impose["detouree_par_le_modele"] is True
    # Ce que la naissance a posé, la fiche le lit par le même chemin : aucun
    # écart que l'auteur n'aurait pas créé.
    assert impose["impose"]["veille"] == ["detourage"]
    assert impose["impose"]["fond_du_modele"] is True
    # Et le rendu est un sprite en case, sans voile.
    rendu = _rendu(atelier, asset)
    assert _hors_du_sujet(rendu)[1] <= 8


def test_demandee_mais_recue_opaque_le_detourage_reste_eveille(client, atelier, double):
    asset, lue = _ne(client, atelier, double, _opaque())

    assert lue["demande"]["transparence"] is True
    assert asset.recette.fond_du_modele is False
    assert not asset.recette.dort(DETOURAGE)
    impose = client.get(f"/api/assets/{asset.identifiant}/imposed").json()
    assert impose["detouree_par_le_modele"] is False
    assert "fond_du_modele" not in impose["impose"]


def test_recue_transparente_sans_l_avoir_demande_le_detourage_reste_eveille(
    client, atelier, double
):
    """*Demandé et reçu* : un modèle ordinaire qui rend un fond vide n'a rien
    promis, et l'atelier détoure comme avant."""
    asset, lue = _ne(client, atelier, double, _octets("chevalier"), modele=ORDINAIRE)

    assert "transparence" not in lue["demande"]
    assert asset.recette.fond_du_modele is False
    assert not asset.recette.dort(DETOURAGE)


def test_reveiller_depuis_l_ecran_redonne_le_rendu_d_aujourd_hui(client, atelier, double):
    """Le geste de l'écran : la recette renvoyée avec la veille vidée — et sans
    le champ `fond_du_modele`, que l'écran ne connaît pas forcément. Le rendu
    est celui du jumeau né d'un modèle ordinaire, qui détoure comme avant."""
    octets = _octets("coffre-pixel")
    ne, _ = _ne(client, atelier, double, octets)
    jumeau, _ = _ne(client, atelier, double, octets, modele=ORDINAIRE)

    charge = ne.recette.en_json()
    charge.pop("fond_du_modele")
    charge["veille"] = []
    reponse = client.put(f"/api/assets/{ne.identifiant}/recipe", json=charge)
    assert reponse.status_code == 200, reponse.text

    reveille = atelier.assets.lire(ne.identifiant)
    assert not reveille.recette.dort(DETOURAGE)
    # Le fait de l'image reste : l'endormir de nouveau retrouvera le fond du modèle.
    assert reveille.recette.fond_du_modele is True
    assert np.array_equal(_rendu(atelier, reveille), _rendu(atelier, jumeau))

    # Et le rendormir redonne l'image née transparente, sans débris.
    charge["veille"] = ["detourage"]
    assert client.put(f"/api/assets/{ne.identifiant}/recipe", json=charge).status_code == 200
    assert _hors_du_sujet(_rendu(atelier, atelier.assets.lire(ne.identifiant)))[1] <= 8


def test_une_charge_ne_peut_pas_poser_le_fond_du_modele_sur_une_autre_image(
    client, atelier, double
):
    asset, _ = _ne(client, atelier, double, _opaque())
    charge = asset.recette.en_json()
    charge["fond_du_modele"] = True
    charge["veille"] = ["detourage"]
    assert client.put(f"/api/assets/{asset.identifiant}/recipe", json=charge).status_code == 200
    assert atelier.assets.lire(asset.identifiant).recette.fond_du_modele is False


def test_refermee_et_rouverte_index_efface_elle_reste_detouree_par_le_modele(
    client, atelier, double, tmp_path
):
    """8septies : l'objet gardé se referme et se rouvre. La recette revient du
    fichier de l'asset ; la provenance, de la génération et du brut."""
    asset, _ = _ne(client, atelier, double, _octets("fiole"))
    assert asset.recette.fond_du_modele

    for suffixe in ("", "-wal", "-shm"):
        (tmp_path / f"atelier.sqlite3{suffixe}").unlink(missing_ok=True)
    refait = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(refait.ouvrir())

    relu = refait.assets.lire(asset.identifiant)
    assert relu.recette.fond_du_modele is True
    assert relu.recette.dort(DETOURAGE)
    assert refait.assets.impose(asset.identifiant)["detouree_par_le_modele"] is True
