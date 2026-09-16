# -*- coding: utf-8 -*-
"""RP4 — **ce qui est relu avant de payer vient du chemin que l'envoi emprunte.**

C'est le seul invariant que la fusion des huit fenêtres de préparation ne devait
pas entamer, et le seul qui coûte de l'argent quand il tombe. Il tenait déjà pour
l'image fixe (`tests/test_e14.py`) ; il n'était vérifié pour aucun des trois
autres types, et la maquette en demande quatre.

**La panne qu'il évite, en une phrase.** Deux compositions écrites à deux
endroits finissent par diverger, et celle qui compte est celle qui part : on
relit un texte, on paie, et c'est un autre texte qui arrive chez le fournisseur.
Personne ne s'en aperçoit — ce qui revient est *une* image, elle est plausible,
et la facture est la même.

**Ce que chaque essai mesure, et c'est toujours la même mesure** : ce que l'écran
de relecture affiche, contre ce que la doublure du fournisseur a réellement reçu.
Rien entre les deux n'est doublé, rien n'est recomposé côté essai.

| Type | Ce que la relecture montre | Ce que l'envoi emprunte |
|---|---|---|
| Image fixe | `POST /api/outgoing` → `texte` | `POST /api/generations` → `double.demandes[-1].prompt` |
| Clip | `travaux.preparer` → `demande.prompt_video` | `animateur.soumissions[-1].texte` |
| Son | `travaux_audio.preparer` → `snapshot_audio.prompt` | le nœud du graphe que `liaisons.prompt` désigne |
| Rendu 3D | `sources_3d.preparer` → `apercu_3d.reglages` | le corps posté au pont, `/stages` |
"""

from __future__ import annotations

import asyncio

import httpx
import pytest

from atelier.services import Atelier
from tests.conftest import image_sujet
from tests.test_a9 import AnimateurDouble, MELE, clip_mp4
from tests.test_au7_au8 import raccorder
from tests.test_au10 import PontDouble
from tests.test_au14_generation import ComfySon, profil_son

MODELE = "essai:rend-du-png"


# ── 1 · Image fixe ───────────────────────────────────────────────────────────


def test_image_fixe_le_texte_relu_est_celui_qui_part(client, double):
    """La route qui montre et la route qui paie composent par le même chemin.

    L'essai est le jumeau de `test_e14.py::test_le_texte_montre_est_exactement
    _celui_qui_part` ; il vit ici aussi parce que RP4 le compte parmi ses quatre,
    et qu'un critère qu'aucun essai ne nomme se perd à la tranche suivante.
    """
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    client.put("/api/universe", json={"bible": [{"nom": "monde", "texte": "Deep forge halls", "actif": True}]})

    montre = client.post(
        "/api/outgoing", json={"modele": MODELE, "prompt": "un forgeron nain"}
    )
    assert montre.status_code == 200, montre.text
    relu = montre.json()["texte"]

    lance = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": "un forgeron nain"}
    )
    assert lance.status_code == 202, lance.text
    identifiant = lance.json()["identifiant"]
    for _ in range(60):
        if client.get(f"/api/generations/{identifiant}").json()["statut"] in (
            "reussie",
            "echouee",
            "interrompue",
        ):
            break
        import time

        time.sleep(0.05)

    assert double.demandes, "rien n'est parti : l'essai ne mesure plus rien"
    assert relu == double.demandes[-1].prompt


# ── 2 · Clip ─────────────────────────────────────────────────────────────────


@pytest.fixture
async def scene_clip(tmp_path, double):
    animateur = AnimateurDouble()
    animateur.octets = clip_mp4()
    double.rendre = image_sujet
    atelier = Atelier(
        racine=tmp_path / "donnees",
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )
    await atelier.ouvrir()
    yield atelier, animateur
    await atelier.travaux.attendre_tout()
    await atelier.file_locale.fermer()


async def test_clip_le_mouvement_relu_est_celui_qui_part(scene_clip):
    """Le travail préparé **est** ce qui part : le lancer ne recompose rien."""
    atelier, animateur = scene_clip
    projet = atelier.bibliotheque.courant
    reference = atelier.generations.importer(
        image_sujet(), "Image de départ", projet=projet
    )["asset"]["identifiant"]

    travail = await atelier.travaux.preparer(
        projet,
        {
            "cle": "clip-rp4",
            "reference_asset": reference,
            "modele_video": MELE.identifiant,
            "prompt_video": "La voyageuse marche sur place, cycle régulier",
            "options_video": {"seed": 73},
        },
        source_libre=True,
    )
    # Rien n'est parti : la relecture ne coûte rien, c'est ce qui la rend
    # relisable autant de fois qu'on veut.
    assert not animateur.soumissions
    relu = travail["demande"]["prompt_video"]

    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await atelier.travaux.attendre_tout()

    assert animateur.soumissions, "rien n'est parti au fournisseur du clip"
    modele, partie = animateur.soumissions[-1]
    assert modele == MELE.identifiant
    assert relu == partie.texte
    # Et les réglages relus sont ceux qui partent, pas seulement le texte.
    assert travail["demande"]["options_video"] == dict(partie.options)


# ── 3 · Son ──────────────────────────────────────────────────────────────────


@pytest.fixture
async def scene_son(tmp_path, double):
    comfy = ComfySon()
    atelier = Atelier(racine=tmp_path / "sons", fabrique_fournisseur=lambda: double)
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    p = profil_son()
    comfy.declarer(p)
    garde = atelier.profils_workflow.importer(p)
    atelier.travaux_audio.intervalle = 0.01
    yield atelier, comfy, garde
    await atelier.file_locale.fermer()
    for tache in atelier.travaux._taches.values():
        if not tache.done():
            tache.cancel()
    await atelier.travaux.attendre_tout()


async def test_son_le_texte_relu_est_celui_qui_part(scene_son):
    """Le son fige son envoi à la relecture ; le graphe reçoit ce qui a été lu."""
    atelier, comfy, profil = scene_son
    projet = atelier.bibliotheque.courant

    travail = await atelier.travaux_audio.preparer(
        projet,
        {
            "cle": "son-rp4",
            "modele": profil["modele"],
            "nom": "Lame tirée",
            "prompt": "Une lame quitte lentement un fourreau de cuir.",
            "secondes": 2.5,
            "options": {"seed": 357},
        },
    )
    assert not comfy.envois
    relu = travail["snapshot_audio"]["prompt"]

    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await atelier.travaux.attendre_tout()

    assert comfy.envois, "aucun graphe n'est parti au moteur local"
    graphe = comfy.envois[-1]["prompt"]
    noeud = profil["liaisons"]["prompt"][0]
    assert relu == graphe[noeud["noeud"]]["inputs"][noeud["champ"]]


# ── 4 · Rendu 3D ─────────────────────────────────────────────────────────────


def test_rendu_3d_les_reglages_relus_sont_ceux_qui_partent(atelier, client, tmp_path):
    """Le parcours 3D relit une étape avant de la lancer, et c'est elle qui part."""
    pont = PontDouble()
    atelier.sources_3d.transport = httpx.MockTransport(pont.repondre)
    atelier.sources_3d.configurer("http://127.0.0.1:8498")
    chemin = tmp_path / "voyageuse.png"
    chemin.write_bytes(image_sujet())
    asset = client.post("/api/assets/import", json={"chemin": str(chemin)}).json()["asset"][
        "identifiant"
    ]
    projet = atelier.bibliotheque.courant

    prepare = client.post(
        f"/api/projects/{projet}/3d/jobs/prepare",
        json={
            "cle": "modele-rp4",
            "etape": "modele_3d",
            "reference_asset": asset,
            "reglages": {"steps_forme": 7},
        },
    )
    assert prepare.status_code == 200, prepare.text
    travail = prepare.json()
    assert not pont.envois
    relus = travail["apercu_3d"]["reglages"]

    numero = travail["identifiant"]
    assert (
        client.post(f"/api/projects/{projet}/production-jobs/{numero}/start").status_code
        == 200
    )
    fini = asyncio.run(atelier.travaux.attendre(projet, numero, 10))
    assert fini["etat"] == "termine", fini

    assert pont.envois, "aucune étape n'est partie au pont 3D"
    partis = pont.envois[-1]["reglages"]
    assert pont.envois[-1]["etape"] == travail["etape"]
    # Chaque réglage relu se retrouve, à l'identique, dans ce qui est parti.
    assert {clef: partis[clef] for clef in relus} == relus
