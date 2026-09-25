# -*- coding: utf-8 -*-
"""TN2 — le texte envoyé demande un fond vide (`docs/PLAN-transparence-native.md`).

La règle : **capacité du modèle × silhouette du type × pas une planche**, décidée
à un seul endroit (`atelier.domaine.transparence.transparence_demandee`) et
nourrie par une seule méthode du service (`transparence_de_l_appel`), que la
soumission et l'écran de confirmation appellent tous deux.

Le modèle capable est doublé : un modèle distant de plus au catalogue du double
de `conftest`, qui déclare `transparence=True` — rien d'autre ne le distingue de
`essai:rend-du-png`, et c'est ce qui permet de dire « rien ne change » par une
égalité de textes plutôt que par une liste de mots. Aucun appel payé, aucun
ComfyUI réel.
"""

from __future__ import annotations

import io
import time

import pytest
from PIL import Image

from atelier.domaine.asset import identifiant_de
from atelier.domaine.catalogue import Modele
from atelier.domaine.demande import Demande
from atelier.domaine.projet import CHAMPS_BIBLE
from atelier.domaine.fond import CANDIDATS, VERT_DE_STUDIO
from atelier.domaine.generation import Generation
from atelier.domaine.transparence import (
    FOND_TRANSPARENT,
    QUEUE,
    TETE,
    demandee_par,
    encadrer,
    transparence_demandee,
)
from atelier.domaine.vue import phrase_de_calage
from tests.conftest import CATALOGUE, FOURNISSEUR, FournisseurDouble

CAPABLE = "essai:rend-du-vide"
ORDINAIRE = "essai:rend-du-png"

#: Tout ce qui nomme une couleur de fond dans ce que l'atelier sait écrire.
NOMS_DE_FOND = tuple(
    mot
    for c in (*CANDIDATS, VERT_DE_STUDIO)
    for mot in (c.couleur, c.nom)
)


class DoubleCapable(FournisseurDouble):
    """Le double de `conftest`, avec un modèle de plus qui rend un fond vide."""

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


def _envoi(client, **corps) -> dict:
    reponse = client.post(
        "/api/outgoing", json={"modele": CAPABLE, "prompt": "un nain", **corps}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _lancer(client, **corps) -> dict:
    reponse = client.post(
        "/api/generations", json={"modele": CAPABLE, "prompt": "un nain", **corps}
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(80):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            return lue
        time.sleep(0.05)
    return client.get(f"/api/generations/{identifiant}").json()


def _sans_nom_de_fond(texte: str) -> list[str]:
    return [mot for mot in NOMS_DE_FOND if mot.lower() in texte.lower()]


# ── La règle, à un seul endroit ──────────────────────────────────────────────


def test_la_regle_est_capacite_fois_silhouette_fois_pas_une_planche():
    assert transparence_demandee(capable=True, silhouette=True, planche=False)
    assert not transparence_demandee(capable=False, silhouette=True, planche=False)
    assert not transparence_demandee(capable=True, silhouette=False, planche=False)
    assert not transparence_demandee(capable=True, silhouette=True, planche=True)
    # Ce que l'auteur a posé à la main pour cet appel passe devant.
    assert not transparence_demandee(
        capable=True, silhouette=True, planche=False, fond_impose=True
    )


def test_la_consigne_encadre_le_texte_sans_jamais_se_redoubler():
    texte = encadrer("Hand-drawn 2D game art, a knight")
    assert texte == f"{TETE} Hand-drawn 2D game art, a knight. {QUEUE}"
    # Un texte repris depuis l'écran de confirmation est déjà encadré.
    assert encadrer(texte) == texte
    # Un texte en paragraphes garde ses paragraphes.
    assert encadrer("CONTEXT\n\nun nain").startswith(f"{TETE}\n\nCONTEXT")


def test_la_phrase_de_calage_ne_pose_plus_de_fond_plat_quand_le_fond_est_vide():
    assert phrase_de_calage(64, FOND_TRANSPARENT) == "strict 64x64 px tile snap"
    assert phrase_de_calage(0, FOND_TRANSPARENT) == ""
    # Sans fond vide, la phrase d'avant, au caractère près.
    assert phrase_de_calage(64, "#FF00FF").startswith(
        "single isolated sprite on a flat solid #FF00FF magenta background"
    )


# ── Un personnage, sur un modèle qui déclare la capacité ─────────────────────


def test_le_texte_d_un_personnage_porte_la_consigne_et_aucun_nom_de_couleur(client):
    envoi = _envoi(client)

    assert envoi["texte"].startswith(TETE)
    assert envoi["texte"].endswith(QUEUE)
    assert _sans_nom_de_fond(envoi["texte"]) == []
    assert "flat" not in envoi["texte"] and "background colour" not in envoi["texte"]
    # « Relire avant l'envoi » : la consigne à la place de la couleur, par la
    # même résolution que l'envoi.
    assert envoi["fond"]["transparence"] is True
    assert envoi["fond"]["couleur"] == ""
    assert TETE in envoi["fond"]["consigne"] and QUEUE in envoi["fond"]["consigne"]
    # Et rien ne part en interdiction : il n'y a plus de couleur à interdire.
    assert envoi["fond"]["interdiction"] == ""


def test_le_type_personnage_nomme_au_bareme_demande_aussi_le_fond_vide(client):
    for echelle in ("personnage", "créature", "objet tenu", "élément d'interface"):
        envoi = _envoi(client, echelle=echelle)
        assert envoi["fond"]["transparence"] is True, echelle
        assert envoi["texte"].startswith(TETE), echelle


def test_ce_que_l_auteur_interdit_part_toujours_seul(client):
    envoi = _envoi(client, prompt_negatif="blurry, watermark")
    assert envoi["fond"]["interdiction"] == "blurry, watermark"


def test_la_direction_artistique_du_jeu_reste_dans_le_texte(client):
    """Le banc du 22 septembre a vu le style dériver vers la 3D sous la seule
    consigne de transparence : la bible part comme avant, dans le cadre."""
    reponse = client.put(
        "/api/universe",
        json={
            "bible": [
                {
                    "nom": nom,
                    "texte": "thick dark outlines, cel shading" if nom == "trait" else "",
                    "actif": True,
                }
                for nom in CHAMPS_BIBLE
            ]
        },
    )
    assert reponse.status_code == 200, reponse.text

    envoi = _envoi(client)

    assert "thick dark outlines, cel shading" in envoi["texte"]
    assert envoi["texte"].startswith(TETE)


def test_la_soumission_envoie_le_texte_montre_et_enregistre_la_demande(client, double):
    montre = _envoi(client)["texte"]

    lue = _lancer(client)

    assert lue["statut"] == "reussie", lue
    assert lue["demande"]["prompt"] == montre
    assert lue["demande"]["prompt_negatif"] == ""
    assert lue["demande"]["transparence"] is True
    assert double.demandes[-1].prompt == montre


def test_une_correction_de_fond_rend_la_couleur_pour_cet_appel(client):
    """Choisir une couleur sur l'écran de confirmation, c'est demander ce
    tirage-là sur fond coloré — le geste « refaire sur fond coloré »."""
    envoi = _envoi(client, tri={"fond": "#FF00FF"})

    assert envoi["fond"]["transparence"] is False
    assert TETE not in envoi["texte"]
    assert "#FF00FF magenta" in envoi["texte"]
    assert "#FF00FF" in envoi["fond"]["interdiction"]


# ── Les images de référence restent sur blanc ────────────────────────────────


def _aplat_transparent() -> bytes:
    image = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    image.paste(Image.new("RGBA", (32, 32), (200, 30, 30, 255)), (8, 8))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _importer(client, tmp_path, octets: bytes) -> str:
    chemin = tmp_path / "reference.png"
    chemin.write_bytes(octets)
    reponse = client.post("/api/assets/import", json={"chemin": str(chemin), "forcer": True})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


def _coin(octets: bytes) -> tuple[int, ...]:
    with Image.open(io.BytesIO(octets)) as image:
        return image.convert("RGB").getpixel((0, 0))


def test_les_references_partent_sur_blanc_et_la_relance_les_repose_pareil(
    client, atelier, double, tmp_path
):
    """Et la génération **se referme et se rouvre** (8septies) : relue du
    fichier, elle redit qu'elle a demandé le fond vide, et la relance repose
    ses références sur le même blanc — pas sur la couleur que le calcul
    choisirait aujourd'hui."""
    reference = _importer(client, tmp_path, _aplat_transparent())

    lue = _lancer(client, references=[{"asset": reference, "role": "reference"}])

    assert lue["statut"] == "reussie", lue
    envoyees = double.demandes[-1].references
    assert envoyees and _coin(envoyees[0]) == (255, 255, 255)

    relue = Generation.depuis_json(atelier.base.lire(lue["identifiant"]).en_json())
    assert demandee_par(relue.demande) is True
    relance = atelier.generations.demande_preparee(relue)
    assert relance.transparence is True
    assert _coin(relance.references[0]) == (255, 255, 255)


def test_sur_un_modele_ordinaire_la_reference_part_sur_la_couleur_calculee(
    client, double, tmp_path
):
    reference = _importer(client, tmp_path, _aplat_transparent())

    lue = _lancer(client, modele=ORDINAIRE, references=[{"asset": reference, "role": "reference"}])

    assert lue["statut"] == "reussie", lue
    assert _coin(double.demandes[-1].references[0]) != (255, 255, 255)
    assert "transparence" not in lue["demande"]


# ── L'arrivée garde l'alpha qu'on a demandé ──────────────────────────────────


def _sujet_a_fond_vide() -> bytes:
    image = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    image.paste(Image.new("RGBA", (16, 32), (190, 40, 40, 255)), (16, 12))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _brut(atelier, lue) -> Image.Image:
    asset = atelier.assets.lire(identifiant_de(lue["identifiant"], 0))
    octets, _ = atelier.assets.octets(asset, brut=True)
    return Image.open(io.BytesIO(octets))


def test_une_image_demandee_transparente_arrive_avec_son_alpha(client, atelier, double):
    double.rendre = _sujet_a_fond_vide

    lue = _lancer(client)

    assert lue["statut"] == "reussie", lue
    with _brut(atelier, lue) as image:
        assert image.mode == "RGBA" and image.getpixel((0, 0))[3] == 0


def test_un_decor_du_meme_modele_arrive_aplati_comme_avant(client, atelier, double):
    double.rendre = _sujet_a_fond_vide

    lue = _lancer(client, echelle="décor")

    assert lue["statut"] == "reussie", lue
    assert "transparence" not in lue["demande"]
    with _brut(atelier, lue) as image:
        assert image.mode == "RGB"


# ── Pour le reste, rien ne change ────────────────────────────────────────────


def _meme_envoi(client, **corps) -> tuple[dict, dict]:
    return _envoi(client, **corps), _envoi(client, modele=ORDINAIRE, **corps)


def test_un_decor_une_tuile_une_matiere_partent_comme_sur_un_autre_modele(client):
    for echelle in ("décor", "tuile", "matière"):
        capable, ordinaire = _meme_envoi(client, echelle=echelle)
        assert capable["fond"]["transparence"] is False, echelle
        assert capable["texte"] == ordinaire["texte"], echelle
        assert capable["fond"]["interdiction"] == ordinaire["fond"]["interdiction"], echelle
        assert capable["fond"]["couleur"] == ordinaire["fond"]["couleur"] != "", echelle


def test_une_planche_part_comme_sur_un_autre_modele(client):
    nain = client.post(
        "/api/characters", json={"nom": "Nain", "description": "un nain"}
    ).json()["personnage"]["identifiant"]
    poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]][:3]

    capable, ordinaire = _meme_envoi(client, personnage=nain, poses=poses)

    assert capable["cases"] == 3
    assert capable["fond"]["transparence"] is False
    assert capable["texte"] == ordinaire["texte"]
    assert capable["fond"]["interdiction"] == ordinaire["fond"]["interdiction"] != ""


def test_un_modele_sans_la_capacite_ne_recoit_pas_la_consigne(client):
    ordinaire = _envoi(client, modele=ORDINAIRE)

    assert ordinaire["fond"]["transparence"] is False
    assert ordinaire["fond"]["consigne"] == ""
    assert TETE not in ordinaire["texte"] and QUEUE not in ordinaire["texte"]
    assert ordinaire["fond"]["couleur"] == VERT_DE_STUDIO.couleur


# ── Un style local (Qwen) : la même règle, sur la jonction courte ────────────


async def test_un_style_local_capable_encadre_son_texte_court(tmp_path, double):
    """Le chemin de Qwen : `texte_local.composer`, puis la consigne autour. Le
    déclencheur du style reste dans le cadre, et l'écran de confirmation voit
    la consigne à sa place parmi les morceaux du texte local."""
    from atelier.services import Atelier
    from tests.test_a9 import AnimateurDouble
    from tests.test_au7_au8 import ComfyDouble, ajouter, raccorder
    from tests.test_qwen21 import _profil_capable

    comfy = ComfyDouble()
    atelier = Atelier(
        racine=tmp_path / "donnees",
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurDouble(),
    )
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    try:
        p = await ajouter(atelier, comfy, _profil_capable(transparence=True, declencheur="yotostyle"))
        projet = atelier.bibliotheque.courant

        apercu = atelier.generations.apercu("un nain", projet=projet, modele=p["modele"])

        assert apercu["transparence"] is True
        assert apercu["texte"].startswith(f"{TETE} yotostyle")
        assert apercu["texte"].endswith(QUEUE)
        assert _sans_nom_de_fond(apercu["texte"]) == []
        clefs = [s["clef"] for s in apercu["local"]["segments"]]
        assert clefs[0] == "transparence.tete" and clefs[-1] == "transparence.queue"

        decor = atelier.generations.apercu("un nain", projet=projet, modele=p["modele"], echelle="décor")
        assert decor["transparence"] is False
        assert TETE not in decor["texte"]
    finally:
        await atelier.file_locale.fermer()


# ── Une génération d'avant la tranche se relit sans rien demander ────────────


def test_une_generation_d_avant_tn2_se_relit_comme_non_demandee():
    assert demandee_par({"prompt": "un nain"}) is False
    # Et la forme écrite ne change pas tant que rien n'est demandé.
    assert "transparence" not in Demande(prompt="un nain").resume()
    assert Demande(prompt="un nain", transparence=True).resume()["transparence"] is True
