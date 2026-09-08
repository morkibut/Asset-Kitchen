# -*- coding: utf-8 -*-
"""Les critères de B22 — la galerie connaît les clips.

**Rien ici n'appelle un fournisseur, et rien ne décode une vidéo.** Un clip
gardé est fabriqué directement dans le dépôt — génération, emplacement réussi,
`Clip` rempli, frames écrites à la main — exactement le geste documenté par
`essais/atelier_jetable_b11.py::_poser_un_clip`, étendu à un clip qui porte de
vraies images. Le décodeur vidéo (`atelier/image/clip.py`) n'entre dans aucun
de ces essais : la couverture et le prélèvement d'images relisent un fichier
déjà là, ils ne décodent jamais.

Deux choses sont mesurées, et ce sont les deux trous relevés avant d'écrire une
ligne côté serveur :

1. **`GET /api/clips` scope à un projet.** Sans `projet`, la fenêtre des plus
   récentes générations est celle de *tous* les jeux confondus — un clip d'un
   jeu peu actif se fait chasser par les images d'un autre, ce qui est
   précisément ce qui rend un clip invisible après la fermeture de son lot.
2. **`GET /api/clips/{id}/cover` réduit, elle ne sert jamais le fichier
   entier** — la même règle que `vignette_asset` pour une image, appliquée à
   la première frame d'un clip.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from atelier.domaine.animation import Clip
from atelier.domaine.generation import Emplacement, Generation, Resultat, Statut
from atelier.services import Atelier


def _ecrire_generation(
    atelier: Atelier,
    identifiant: str,
    *,
    projet: str | None,
    cree_le: float,
    clip: Clip | None = None,
) -> Generation:
    """Une génération posée directement dans le dépôt — le geste de
    `essais/atelier_jetable_b11.py::_poser_un_clip`, avec une date choisie :
    la fenêtre des plus récentes ne veut rien dire sur des horodatages égaux."""
    generation = Generation(
        identifiant=identifiant,
        modele="double",
        demande={"prompt": "un clip d'essai"},
        parametres_resolus={},
        projet=projet,
        cree_le=cree_le,
        emplacements=[
            Emplacement(
                rang=0,
                statut=Statut.REUSSIE,
                resultat=Resultat(
                    fichier=f"{identifiant}.mp4",
                    largeur=0,
                    hauteur=0,
                    type_media="video/mp4",
                    octets=100,
                ),
            )
        ],
        clip=clip,
    )
    atelier.fichiers.ecrire_enregistrement(identifiant, generation.en_json())
    atelier.base.enregistrer(generation)
    return generation


def _poser_un_clip(
    atelier: Atelier,
    identifiant: str,
    *,
    projet: str | None,
    cree_le: float = 1_700_000_000.0,
    images: int = 6,
    cadence: float = 8.0,
    cote: int = 40,
    jete: bool = False,
    extraction_refus: str | None = None,
) -> Generation:
    """Un clip gardé, avec de vraies frames sur le disque — jamais décodées,
    écrites directement. `extraction_refus` pose un clip payé dont
    l'extraction a manqué : il ne porte alors aucune image."""
    clip = Clip(
        travail=f"travail-{identifiant}",
        secondes=round(images / cadence) if cadence else 0,
        images=0 if extraction_refus else images,
        cadence=0.0 if extraction_refus else cadence,
        extraction_refus=extraction_refus,
        lot=f"lot-{identifiant}",
        jete=jete,
    )
    generation = _ecrire_generation(
        atelier, identifiant, projet=projet, cree_le=cree_le, clip=clip
    )
    if not extraction_refus:
        dossier: Path = atelier.fichiers.dossier_images_clip(identifiant, 0)
        dossier.mkdir(parents=True, exist_ok=True)
        for numero in range(images):
            # Une teinte qui change à chaque frame — de quoi distinguer un
            # essai qui relirait la mauvaise frame d'un essai qui passe par
            # accident.
            teinte = (20 + numero * 8, 60, 120)
            Image.new("RGB", (cote, cote), teinte).save(dossier / f"{numero:04d}.png")
    return generation


# ── `GET /api/clips` scope à un projet ───────────────────────────────────────


def test_liste_clips_ne_scope_a_rien_sans_projet(client, atelier):
    """**La route garde son ancien sens si on ne lui donne pas de jeu** —
    rétrocompatible avec ce qui l'appelait déjà avant B22."""
    _poser_un_clip(atelier, "clip-a", projet="jeu-a")
    _poser_un_clip(atelier, "clip-b", projet="jeu-b", cree_le=1_700_000_100.0)

    recus = {c["identifiant"] for c in client.get("/api/clips").json()["clips"]}
    assert recus == {"clip-a", "clip-b"}


def test_liste_clips_scopee_ne_montre_que_le_jeu_demande(client, atelier):
    _poser_un_clip(atelier, "clip-a", projet="jeu-a")
    _poser_un_clip(atelier, "clip-b", projet="jeu-b", cree_le=1_700_000_100.0)

    recus = client.get("/api/clips", params={"projet": "jeu-a"}).json()["clips"]
    assert [c["identifiant"] for c in recus] == ["clip-a"]


def test_un_clip_peu_actif_ne_se_fait_pas_chasser_par_un_autre_jeu(client, atelier):
    """**Le cas que B22 répare.** Sans `projet`, la fenêtre des générations les
    plus récentes est globale : un jeu qui n'a produit qu'un clip, il y a
    longtemps, perd sa place dès qu'un autre jeu a été plus actif depuis — et
    c'est très exactement ce qui rend un clip invisible après la fermeture de
    son lot. Scopée au projet, la fenêtre ne porte que sur ses générations à
    lui, et le clip reste trouvable quel que soit ce qui s'est passé ailleurs.
    """
    _poser_un_clip(atelier, "clip-ancien", projet="jeu-tranquille", cree_le=1_700_000_000.0)
    # Huit générations d'un autre jeu, toutes plus récentes, aucune n'étant un
    # clip — exactement ce qu'une activité d'image ordinaire produirait.
    for i in range(8):
        _ecrire_generation(
            atelier,
            f"image-{i}",
            projet="jeu-actif",
            cree_le=1_700_000_100.0 + i,
        )

    sans_scope = client.get("/api/clips", params={"limite": 5}).json()["clips"]
    assert "clip-ancien" not in [c["identifiant"] for c in sans_scope]

    scope = client.get(
        "/api/clips", params={"projet": "jeu-tranquille", "limite": 5}
    ).json()["clips"]
    assert [c["identifiant"] for c in scope] == ["clip-ancien"]


# ── `GET /api/clips/{id}/cover` ──────────────────────────────────────────────


def test_la_couverture_est_reduite_jamais_le_fichier_entier(client, atelier):
    _poser_un_clip(atelier, "clip-couverture", projet="jeu-a", cote=128)

    reponse = client.get("/api/clips/clip-couverture/cover", params={"cote": 16})
    assert reponse.status_code == 200
    assert reponse.headers["content-type"] == "image/png"

    import io

    with Image.open(io.BytesIO(reponse.content)) as reduite:
        assert max(reduite.size) == 16


def test_la_couverture_est_la_premiere_frame(client, atelier):
    """**Prélevée, pas décodée à la demande** — c'est la frame `0000.png`,
    telle qu'écrite à l'arrivée du clip, jamais une autre."""
    _poser_un_clip(atelier, "clip-frame-0", projet="jeu-a", images=3, cote=32)

    import io

    reponse = client.get("/api/clips/clip-frame-0/cover", params={"cote": 32})
    with Image.open(io.BytesIO(reponse.content)) as couverture:
        with Image.open(
            atelier.fichiers.dossier_images_clip("clip-frame-0", 0) / "0000.png"
        ) as premiere:
            assert couverture.tobytes() == premiere.tobytes()


def test_la_couverture_refuse_quand_l_extraction_a_manque(client, atelier):
    """**Un clip payé dont l'extraction a échoué reste un clip payé** — sa
    couverture, elle, n'existe pas, et la route le dit en clair plutôt que de
    rendre une image vide."""
    _poser_un_clip(
        atelier,
        "clip-sans-images",
        projet="jeu-a",
        extraction_refus="le décodeur vidéo n'est pas installé",
    )

    reponse = client.get("/api/clips/clip-sans-images/cover")
    assert reponse.status_code == 400
    assert "décodeur" in reponse.json()["raison"]


def test_la_couverture_refuse_pour_une_generation_qui_n_est_pas_un_clip(client, atelier):
    _ecrire_generation(atelier, "pas-un-clip", projet="jeu-a", cree_le=1_700_000_000.0)

    reponse = client.get("/api/clips/pas-un-clip/cover")
    assert reponse.status_code == 400
