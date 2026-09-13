# -*- coding: utf-8 -*-
"""AU18 · Une vidéo qui vient d'ailleurs entre dans le jeu.

**Aucun de ces essais ne coûte un centime**, et c'est plus qu'une habitude ici :
la tranche existe pour qu'une vidéo entre *sans appeler personne*. Un essai qui
aurait besoin d'un fournisseur dirait le contraire de ce qu'il vérifie.

Le clip de ces essais est fabriqué sur place par le décodeur du produit
(`atelier/image/clip.py`). Quand il manque, les essais qui décodent se sautent —
c'est aussi la promesse du produit : un atelier s'installe sans lui.
"""

from __future__ import annotations

import pytest

from atelier.image import clip as decodeur
from atelier.services.animation import IMPORT_VIDEO

from tests.test_a9 import clip_mp4

sans_decodeur = pytest.mark.skipif(
    bool(decodeur.indisponible()), reason="décodeur de clips absent"
)


def importer(client, octets: bytes, nom: str = "marche.mp4", **parametres):
    return client.post(
        "/api/clips/import", content=octets, params={"nom": nom, **parametres}
    )


# ── Ce qui entre est un clip, comme les autres ──────────────────────────────


@sans_decodeur
def test_une_video_importee_devient_un_clip_du_jeu(client):
    """Le geste de la tranche, et la forme de sa réponse."""
    reponse = importer(client, clip_mp4())
    assert reponse.status_code == 201, reponse.text
    corps = reponse.json()
    assert corps["doublon"] is None
    clip = corps["clip"]
    assert clip["modele"] == IMPORT_VIDEO
    assert clip["statut"] == "reussie"
    assert clip["clip"]["images"] == 6
    assert clip["clip"]["cadence"] == 24.0


@sans_decodeur
def test_une_video_importee_ne_depense_rien(client):
    """Prix annoncé à zéro, **et rien de consommé** : les deux se vérifient.

    Un prix annoncé nul sur un emplacement qui aurait consommé quelque chose
    ferait passer une dépense pour un import.
    """
    clip = importer(client, clip_mp4()).json()["clip"]
    assert clip["clip"]["prix_annonce"] == 0
    assert clip["emplacements"][0]["consomme"] == 0
    assert clip["consomme"] == 0
    assert clip["cout_usd"] == 0


@sans_decodeur
def test_la_fiche_dit_que_la_source_est_importee(client):
    """La phrase que l'écran affiche à côté du montant, et pas un drapeau.

    ⚠️ Sans elle, une vidéo importée écrirait *montant relu chez le
    fournisseur* — sur un clip dont aucun fournisseur n'a jamais entendu parler.
    """
    clip = importer(client, clip_mp4()).json()["clip"]
    assert clip["clip"]["nature"] == "importe"
    assert clip["clip"]["montant_dit"] == "source importée — aucun nouvel appel"


@sans_decodeur
def test_le_clip_importe_se_retrouve_dans_la_liste_des_clips(client):
    """Il n'est pas rangé à part : c'est la liste que l'écran lit déjà."""
    identifiant = importer(client, clip_mp4()).json()["clip"]["identifiant"]
    clips = client.get("/api/clips").json()["clips"]
    assert [c["identifiant"] for c in clips] == [identifiant]


# ── Les images sont tirées à l'entrée, une fois et plus jamais ──────────────


@sans_decodeur
def test_les_images_sont_tirees_des_l_import(client):
    """C'est ce qui rend le montage possible sans rien redécoder."""
    identifiant = importer(client, clip_mp4()).json()["clip"]["identifiant"]
    for numero in range(6):
        reponse = client.get(f"/api/clips/{identifiant}/frames/{numero}")
        assert reponse.status_code == 200, reponse.text
        assert reponse.headers["content-type"] == "image/png"


@sans_decodeur
def test_la_couverture_du_clip_importe_se_sert_comme_les_autres(client):
    """La vignette de la grille passe par la même route que pour un clip payé."""
    identifiant = importer(client, clip_mp4()).json()["clip"]["identifiant"]
    reponse = client.get(f"/api/clips/{identifiant}/cover")
    assert reponse.status_code == 200, reponse.text


@sans_decodeur
def test_la_video_importee_se_rejoue_entiere(client):
    """Le fichier tel qu'il est arrivé, **et il accepte les plages**.

    Sans les plages, le lecteur du navigateur ne sait pas se déplacer dans la
    vidéo : il la rejoue depuis le début, ou refuse de la lire.
    """
    identifiant = importer(client, clip_mp4()).json()["clip"]["identifiant"]
    reponse = client.get(f"/api/clips/{identifiant}/video")
    assert reponse.status_code == 200, reponse.text
    assert reponse.headers["content-type"] == "video/mp4"
    assert reponse.headers["accept-ranges"] == "bytes"
    assert reponse.content == clip_mp4()


@sans_decodeur
def test_une_image_du_clip_importe_entre_en_bibliotheque(client):
    """Le prélèvement marche sur une vidéo importée comme sur un clip payé.

    C'est tout l'intérêt d'en avoir fait un clip plutôt qu'un objet à part : le
    geste d'après existait déjà.
    """
    identifiant = importer(client, clip_mp4()).json()["clip"]["identifiant"]
    reponse = client.post(f"/api/clips/{identifiant}/frames/2/pick")
    assert reponse.status_code == 201, reponse.text
    assert client.get("/api/assets").json()["assets"]


# ── Ce qui n'entre pas, et ce qu'on en dit ──────────────────────────────────


def test_un_fichier_qui_n_est_pas_une_video_est_refuse_en_francais(client):
    r"""⚠️ Le message du lecteur ne franchit pas le service.

    Mesuré à l'écran le 13 septembre 2026, avant correction : le refus portait
    *Could not find a backend to open C:\…\clip-importe-6x3qdcf6\source.bin*
    — de l'anglais, et le chemin d'un dossier de passage qui n'existe déjà plus
    quand l'auteur le lit. C'est le piège que `ServiceGenerations.importer`
    documente pour Pillow, reproduit à l'identique.
    """
    reponse = importer(client, b"ceci est du texte", nom="notes.txt")
    assert reponse.status_code == 409, reponse.text
    raison = reponse.json()["raison"]
    assert "notes.txt" in raison
    assert raison == "« notes.txt » n'est pas une vidéo lisible"


def test_un_fichier_vide_est_refuse_sans_decoder_quoi_que_ce_soit(client):
    reponse = importer(client, b"", nom="rien.mp4")
    assert reponse.status_code == 409, reponse.text
    assert "rien.mp4" in reponse.json()["raison"]


def test_un_import_refuse_ne_laisse_rien_sur_le_disque(client, atelier):
    """⚠️ Rien n'a été payé : un fichier illisible n'a aucune raison de rester.

    C'est la seule divergence assumée avec un clip payé, dont le fichier est
    conservé même quand l'extraction échoue.
    """
    importer(client, b"ceci est du texte", nom="notes.txt")
    assert client.get("/api/clips").json()["clips"] == []
    generations = atelier.fichiers.racine / "generations"
    assert not generations.exists() or not list(generations.iterdir())


# ── Deux fois le même fichier ───────────────────────────────────────────────


@sans_decodeur
def test_la_meme_video_deux_fois_se_signale_comme_doublon(client):
    """Un doublon n'est pas un refus : la forme est celle de l'import d'image."""
    premier = importer(client, clip_mp4()).json()["clip"]
    second = importer(client, clip_mp4()).json()
    assert second["clip"] is None
    assert second["doublon"]["identifiant"] == premier["identifiant"]


@sans_decodeur
def test_forcer_fait_entrer_la_meme_video_quand_meme(client):
    """L'auteur garde le dernier mot, comme pour une image."""
    premier = importer(client, clip_mp4()).json()["clip"]
    second = importer(client, clip_mp4(), forcer=True).json()["clip"]
    assert second is not None
    assert second["identifiant"] != premier["identifiant"]
    assert len(client.get("/api/clips").json()["clips"]) == 2


# ── Rangée sur un personnage, comme un clip payé ────────────────────────────


@sans_decodeur
def test_une_video_importee_se_range_sur_un_personnage_et_sa_pose(client):
    """La destination est portée par l'appel, pas rangée après coup."""
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    personnage = client.post("/api/characters", json={"nom": "Le pèlerin"}).json()[
        "personnage"
    ]["identifiant"]
    clip = importer(
        client, clip_mp4(), personnage=personnage, pose="marche"
    ).json()["clip"]
    assert clip["personnage"] == personnage
    assert clip["pose"] == "marche"


# ── Ce que le disque garde ──────────────────────────────────────────────────


@sans_decodeur
def test_le_clip_importe_se_relit_apres_effacement_de_l_index(client, atelier):
    """Le `generation.json` porte tout : la bibliothèque se reconstruit sans lui.

    C'est la raison pour laquelle un import passe par une génération plutôt que
    d'écrire un fichier dans un coin.
    """
    identifiant = importer(client, clip_mp4()).json()["clip"]["identifiant"]
    atelier.bibliotheque.reconstruire()
    relu = atelier.animation.lire(identifiant)
    assert relu is not None
    assert relu.clip.nature == "importe"
    assert relu.clip.images == 6


# ── La vidéo posée sur la toile ─────────────────────────────────────────────


@sans_decodeur
def test_un_clip_importe_se_pose_sur_la_toile(client, atelier):
    """La carte porte la première image du clip et dit de quel clip elle vient."""
    identifiant = importer(client, clip_mp4()).json()["clip"]["identifiant"]
    projet = atelier.bibliotheque.courant
    reponse = client.post(f"/api/projects/{projet}/board/clips/{identifiant}")
    assert reponse.status_code == 201, reponse.text
    carte = reponse.json()["carte"]
    assert carte["genre"] == "video"
    assert carte["source"] == f"clip:{identifiant}"
    assert carte["montrable"] is True
    assert carte["position"] is not None


@sans_decodeur
def test_la_carte_video_n_est_jamais_un_artwork_officiel(client, atelier):
    """Ce qui part en référence, ce sont des octets d'image — jamais une vidéo."""
    identifiant = importer(client, clip_mp4()).json()["clip"]["identifiant"]
    projet = atelier.bibliotheque.courant
    carte = client.post(f"/api/projects/{projet}/board/clips/{identifiant}").json()[
        "carte"
    ]
    assert carte["artwork"] is False


@sans_decodeur
def test_deux_clips_qui_commencent_pareil_font_deux_cartes(client, atelier):
    """⚠️ L'empreinte de la carte est celle de la vignette, pas de la vidéo.

    Sans le `forcer` de `poser_clip`, poser le second clip rendrait la carte du
    premier — qui rejouerait le mauvais fichier.
    """
    premier = importer(client, clip_mp4()).json()["clip"]["identifiant"]
    second = importer(client, clip_mp4(), forcer=True).json()["clip"]["identifiant"]
    projet = atelier.bibliotheque.courant
    cartes = [
        client.post(f"/api/projects/{projet}/board/clips/{c}").json()["carte"]
        for c in (premier, second)
    ]
    assert cartes[0]["identifiant"] != cartes[1]["identifiant"]
    assert [c["source"] for c in cartes] == [f"clip:{premier}", f"clip:{second}"]


def test_poser_un_clip_qui_n_existe_pas_se_refuse_en_francais(client, atelier):
    projet = atelier.bibliotheque.courant
    reponse = client.post(f"/api/projects/{projet}/board/clips/inconnu")
    assert reponse.status_code >= 400
    assert "clip" in reponse.text.lower()


# ── Le défaut voisin, relevé en chemin ──────────────────────────────────────


def test_les_frames_d_un_rendu_3d_deja_sur_le_disque_restent_lisibles(client, atelier):
    """⚠️ Le dépôt a numéroté ces images de deux façons, et une seule était lue.

    Le décodeur écrit sur quatre chiffres ; l'import d'un rendu asset3d écrivait
    sur six. Les routes de frame et de couverture ne nommaient que les quatre :
    une séquence 3D importée n'a jamais pu montrer une image, alors que son
    montage marchait — il parcourt le dossier au lieu de nommer le fichier.

    L'import écrit désormais sur quatre chiffres. Cet essai garde l'autre moitié
    de la réparation : **ce qui est déjà sur le disque reste lisible**, sans
    qu'aucun fichier ait à être renommé.
    """
    from PIL import Image
    import io

    identifiant = "sequence-3d"
    dossier = atelier.fichiers.dossier_images_clip(identifiant, 0)
    octets = io.BytesIO()
    Image.new("RGBA", (8, 8), (10, 20, 30, 255)).save(octets, format="PNG")
    # Le nom d'avant : six chiffres.
    (dossier / "000000.png").write_bytes(octets.getvalue())

    from atelier.domaine.animation import Clip
    from atelier.domaine.generation import Emplacement, Generation, Statut

    atelier.animation._sauver(
        Generation(
            identifiant=identifiant,
            modele="asset3d:rendu",
            demande={},
            parametres_resolus={},
            emplacements=[Emplacement(rang=0, statut=Statut.REUSSIE)],
            clip=Clip(nature="rendu3d", images=1, cadence=8),
        )
    )
    assert client.get(f"/api/clips/{identifiant}/frames/0").status_code == 200
    assert client.get(f"/api/clips/{identifiant}/cover").status_code == 200


# ── Ce que l'agent peut faire, l'écran le peut aussi ────────────────────────


@sans_decodeur
def test_l_agent_importe_une_video_par_le_meme_service(client, atelier, tmp_path):
    """L'invariant du dépôt, tenu sur le geste de cette tranche.

    L'outil MCP n'a pas sa propre porte : il appelle le service, comme l'écran.
    Ce qui les distingue est la provenance écrite sur la génération.
    """
    fichier = tmp_path / "course.mp4"
    fichier.write_bytes(clip_mp4())
    entre = atelier.animation.importer(
        fichier.read_bytes(),
        fichier.name,
        projet=atelier.bibliotheque.courant,
        provenance="agent",
    )
    assert entre["clip"]["provenance"] == "agent"
    assert entre["clip"]["clip"]["images"] == 6
    # Et l'écran le voit comme n'importe quel autre clip.
    clips = client.get("/api/clips").json()["clips"]
    assert [c["identifiant"] for c in clips] == [entre["clip"]["identifiant"]]
