# -*- coding: utf-8 -*-
"""Les critères d'acceptation de A7 — reprendre une image sans refaire la bande.

**Le défaut qui a ouvert la tranche, et il a été trouvé à l'usage.** Le produit
savait garder une animation avec tous ses réglages — le cadre, la recette, la
vitesse, le sens, ses images — et **ne savait pas la rouvrir**. La vignette de la
matrice remontait au *clip* ; l'écran repartait donc des réglages du jeu, et
corriger une virgule demandait de tout refaire de mémoire.

⚠️ **Aucun essai ne pouvait le voir**, et c'est la leçon à garder : ils gardaient
une bande puis vérifiaient ce qu'ils venaient d'écrire. Personne ne la rouvrait.
*Un objet qu'on sait écrire et qu'on ne sait pas relire n'est pas fini* — et
l'essai qui le dit est celui qui referme l'écran avant de regarder.

## Ce que ces essais tiennent

Que rouvrir une animation rende **ce qu'on y avait mis** et non ce que le jeu
dirait ; qu'une image se pousse au pixel et que la poussée **borne au lieu de
rogner** ; qu'une image vienne d'un autre clip et que la bande dise alors de quel
clip vient chacune ; qu'une bande écrite avant cette tranche se relise **sans
migration** ; qu'une correction refusée ne laisse **rien** derrière elle ; et que
l'ancrage se choisisse parmi neuf points.

**Aucun n'appelle le fournisseur et aucun ne coûte** : le clip est un double qui
facture zéro, et tout le reste est du processeur.
"""

from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image

from test_a9 import MELE, atelier_video, client_video, animateur  # noqa: F401
from test_a10 import clip, clip_connu, un_personnage, un_sprite  # noqa: F401

from atelier.domaine.bande import Bande
from atelier.domaine.recette import ANCRAGES, BAS, CENTRE, HAUT_GAUCHE, parts_de
from atelier.image.bande import Fenetre, pousser


# --------------------------------------------------------------------------- #
# 1. Rouvrir une animation gardée — le défaut de la tranche                    #
# --------------------------------------------------------------------------- #


def _garder(client, clip, **reglages):
    """Une bande gardée par la vraie porte, avec des réglages qui ne sont pas ceux du jeu."""
    corps = {"clip": clip, "nom": "marche", "images": [12, 14, 16, 18]}
    corps.update(reglages)
    reponse = client.post("/api/strips", json=corps)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def test_rouvrir_une_animation_rend_les_reglages_qu_on_y_avait_mis(
    client_video, clip, animateur
):
    """⚠️ **L'essai qui manquait, et qui aurait vu le défaut.**

    On garde une bande avec une vitesse, un sens et une recette qui **ne sont pas
    ceux du jeu**, on la referme, on la rouvre. Ce qui revient doit être ce qu'on
    y avait mis. Un essai qui vérifierait la réponse du `POST` passerait sans
    rien prouver : le défaut n'était pas dans l'écriture, il était dans
    l'absence de lecture.
    """
    gardee = _garder(
        client_video,
        clip,
        cadence=11,
        sens="aller-retour",
        recette={
            "passes": [{"moteur": "bord", "tolerance": 37}],
            "grille": {"cible": 48, "occupation": 70},
        },
    )

    rouverte = client_video.get(f"/api/strips/{gardee['identifiant']}")

    assert rouverte.status_code == 200, rouverte.text
    bande = rouverte.json()["bande"]
    assert bande["cadence"] == 11
    assert bande["sens"] == "aller-retour"
    assert bande["images"] == [12, 14, 16, 18]
    assert bande["recette"]["passes"][0]["tolerance"] == 37
    assert bande["recette"]["grille"]["cible"] == 48


def test_rouvrir_une_animation_la_rend_deja_en_train_de_tourner(
    client_video, clip, animateur
):
    """La planche part avec, en `data:` — un écran qui s'ouvre n'a pas le temps
    de poser deux questions. C'est la règle déjà écrite pour l'aperçu du montage."""
    gardee = _garder(client_video, clip)

    ouverte = client_video.get(f"/api/strips/{gardee['identifiant']}").json()

    assert ouverte["planche"].startswith("data:image/png;base64,")
    assert ouverte["bande"]["case_largeur"] > 0


def test_rouvrir_une_animation_dit_de_quels_clips_elle_tire_ses_images(
    client_video, clip, animateur
):
    """Et combien d'images chacun porte : c'est ce qui borne le choix quand on
    remplace une image, et l'écran ne peut pas le deviner."""
    gardee = _garder(client_video, clip)

    ouverte = client_video.get(f"/api/strips/{gardee['identifiant']}").json()

    assert list(ouverte["clips"]) == [clip]
    assert ouverte["images_par_clip"][clip] == 22


def test_une_animation_inconnue_se_refuse_sans_planter(client_video, animateur):
    """Un identifiant qui ne désigne rien est une erreur d'atelier, pas une panne."""
    reponse = client_video.get("/api/strips/nexistepas")

    # ⚠️ 400 et non 404 : `ErreurAtelier` est le refus ordinaire de l'atelier,
    # et seules les erreurs qui portent leur propre type montent plus haut.
    assert reponse.status_code == 400, reponse.text


# --------------------------------------------------------------------------- #
# 2. Pousser une image au pixel                                                #
# --------------------------------------------------------------------------- #


def _cases(planche_octets: bytes, largeur: int) -> list[np.ndarray]:
    with Image.open(io.BytesIO(planche_octets)) as ouverte:
        entiere = np.asarray(ouverte.convert("RGBA"))
    return [
        entiere[:, rang * largeur : (rang + 1) * largeur]
        for rang in range(entiere.shape[1] // largeur)
    ]


def test_une_image_se_pousse_au_pixel_et_les_autres_ne_bougent_pas(
    client_video, clip, animateur
):
    """Le geste de la tranche : corriger **une** image sans toucher aux autres."""
    gardee = _garder(client_video, clip)
    identifiant = gardee["identifiant"]
    avant = client_video.get(f"/api/strips/{identifiant}/sheet").content

    reponse = client_video.put(
        f"/api/strips/{identifiant}",
        json={
            "prises": [
                {"numero": 12, "dx": 3, "dy": 0},
                {"numero": 14},
                {"numero": 16},
                {"numero": 18},
            ]
        },
    )

    assert reponse.status_code == 200, reponse.text
    apres = client_video.get(f"/api/strips/{identifiant}/sheet").content
    assert apres != avant, "la planche doit avoir changé"
    largeur = reponse.json()["case_largeur"]
    cases_avant, cases_apres = _cases(avant, largeur), _cases(apres, largeur)
    assert not np.array_equal(cases_avant[0], cases_apres[0]), "la première a bougé"
    for rang in range(1, len(cases_avant)):
        assert np.array_equal(cases_avant[rang], cases_apres[rang]), (
            f"l'image {rang} ne devait pas bouger"
        )


def test_la_poussee_se_relit_sur_la_bande(client_video, clip, animateur):
    """Elle est une intention, donc elle se garde et se relit — comme le reste."""
    gardee = _garder(client_video, clip)
    identifiant = gardee["identifiant"]

    client_video.put(
        f"/api/strips/{identifiant}",
        json={"prises": [{"numero": 12, "dx": 2, "dy": -1}, {"numero": 14}]},
    )
    bande = client_video.get(f"/api/strips/{identifiant}").json()["bande"]

    assert bande["prises"][0] == {"numero": 12, "clip": "", "dx": 2, "dy": -1}
    assert bande["prises"][1]["dx"] == 0
    assert bande["images"] == [12, 14], "les numéros restent lisibles tels quels"


def test_la_poussee_borne_au_lieu_de_rogner():
    """⚠️ **La règle déjà écrite pour le décalage de la grille**, tenue ici aussi.

    *Aux bords, les boutons cessent d'avoir un effet — ce qui se voit, et c'est
    mieux qu'une image rognée.* Une correction qui mangerait un bras serait
    invisible sur l'image qu'on corrige et se découvrirait dans le jeu.
    """
    image = np.zeros((8, 8, 4), dtype=np.uint8)
    image[3:5, 3:5] = (200, 40, 40, 255)

    loin = pousser(image, 99, 99)

    opaques = np.argwhere(loin[:, :, 3] > 0)
    assert opaques.size > 0, "le sujet est toujours là"
    assert opaques[:, 0].max() == 7 and opaques[:, 1].max() == 7
    assert int((loin[:, :, 3] > 0).sum()) == 4, "aucun pixel perdu"


def test_pousser_de_zero_rend_exactement_la_meme_image():
    """Ce qui n'a pas bougé ne se recopie pas : c'est l'invariant du non-destructif."""
    image = np.zeros((6, 6, 4), dtype=np.uint8)
    image[2:4, 2:4] = (10, 20, 30, 255)

    assert pousser(image, 0, 0) is image


def test_pousser_une_image_vide_ne_devine_rien():
    """Le détourage a tout mangé : on rend l'image telle quelle plutôt que
    d'inventer une boîte."""
    vide = np.zeros((5, 5, 4), dtype=np.uint8)

    assert np.array_equal(pousser(vide, 2, 2), vide)


# --------------------------------------------------------------------------- #
# 3. Composer avec deux clips                                                  #
# --------------------------------------------------------------------------- #


@pytest.fixture
def second_clip(client_video, animateur) -> str:
    """Un deuxième clip payé zéro, pour aller y chercher une image."""
    animateur.octets = clip_connu()
    animateur.facture = 0.0
    sprite = un_sprite(client_video)
    personnage = un_personnage(client_video, "La coureuse")
    client_video.put(
        f"/api/assets/{sprite}/character",
        json={"personnage": personnage, "pose": "course"},
    )
    lot = client_video.post(
        "/api/clips",
        json={"modele": MELE.identifiant, "mouvement": "course", "asset": sprite},
    ).json()["clips"]
    identifiant = lot[0]["identifiant"]
    for _ in range(300):
        arrives = client_video.get("/api/clips").json()["clips"]
        if any(c["identifiant"] == identifiant and c["statut"] == "reussie" for c in arrives):
            break
        client_video.get("/api/status")
    return identifiant


def test_une_image_se_prend_dans_un_autre_clip(
    client_video, clip, second_clip, animateur
):
    """Ce qui reste de l'ancienne `A3` : deux clips chacun bons à moitié."""
    gardee = _garder(client_video, clip)
    identifiant = gardee["identifiant"]

    reponse = client_video.put(
        f"/api/strips/{identifiant}",
        json={
            "prises": [
                {"numero": 12},
                {"numero": 15, "clip": second_clip},
                {"numero": 16},
            ]
        },
    )

    assert reponse.status_code == 200, reponse.text
    bande = reponse.json()
    assert bande["images"] == [12, 15, 16]
    assert bande["prises"][1]["clip"] == second_clip


@pytest.fixture
def clip_du_meme(client_video, clip, animateur) -> str:
    """Un second clip **du même personnage** — de quoi composer honnêtement.

    C'est le cas exact que la tranche veut servir : deux tirages du même
    personnage, chacun bon à moitié. Ce qui fait de lui un voisin n'est ni son
    mouvement ni son sprite, c'est **le personnage visé** — et il est lu sur le
    premier clip plutôt que supposé.
    """
    animateur.octets = clip_connu()
    animateur.facture = 0.0
    sprite = un_sprite(client_video)
    # **Le même personnage que `clip`**, lu sur le clip lui-même : c'est tout ce
    # qui fait de ce clip-ci un voisin plutôt qu'un étranger, et le relire évite
    # de le supposer.
    le_sien = next(
        c["personnage"]
        for c in client_video.get("/api/clips").json()["clips"]
        if c["identifiant"] == clip
    )
    client_video.put(
        f"/api/assets/{sprite}/character",
        json={"personnage": le_sien, "pose": "marche"},
    )
    reponse = client_video.post(
        "/api/clips",
        json={"modele": MELE.identifiant, "mouvement": "marche", "asset": sprite},
    )
    assert reponse.status_code == 202, reponse.text
    lot = reponse.json()["clips"]
    identifiant = lot[0]["identifiant"]
    for _ in range(300):
        arrives = client_video.get("/api/clips").json()["clips"]
        if any(
            c["identifiant"] == identifiant and c["statut"] == "reussie"
            for c in arrives
        ):
            break
        client_video.get("/api/status")
    return identifiant


def test_les_clips_offerts_sont_ceux_du_meme_personnage(
    client_video, clip, clip_du_meme, second_clip, animateur
):
    """**Et pas plus large**, parce qu'offrir plus serait tendre un piège.

    Deux clips du même personnage ont la même silhouette : leurs images se
    montent ensemble. Le clip d'un autre personnage donnerait une animation où
    le sujet change au milieu, et l'écran ne doit pas la proposer.
    """
    gardee = _garder(client_video, clip)

    offerts = client_video.get(f"/api/strips/{gardee['identifiant']}").json()[
        "clips_voisins"
    ]

    par_identifiant = {c["identifiant"]: c for c in offerts}
    assert clip in par_identifiant, "celui de l'animation, forcément"
    assert par_identifiant[clip]["sien"] is True
    assert clip_du_meme in par_identifiant, "l'autre clip du même personnage"
    assert par_identifiant[clip_du_meme]["sien"] is False
    assert second_clip not in par_identifiant, "celui d'un autre personnage"
    assert all(c["images"] > 0 for c in offerts), "un clip sans image n'a rien à offrir"


def test_un_clip_emprunte_reste_offert_meme_venu_d_ailleurs(
    client_video, clip, second_clip, animateur
):
    """La liste ne fait pas disparaître ce que la bande utilise déjà.

    Sinon l'écran montrerait une image *prise dans* un clip que la liste ne
    connaît pas, et le menu se poserait sur autre chose que ce qu'on regarde.
    """
    gardee = _garder(client_video, clip)
    identifiant = gardee["identifiant"]
    client_video.put(
        f"/api/strips/{identifiant}",
        json={"prises": [{"numero": 12}, {"numero": 15, "clip": second_clip}]},
    )

    offerts = client_video.get(f"/api/strips/{identifiant}").json()["clips_voisins"]

    emprunte = next(c for c in offerts if c["identifiant"] == second_clip)
    assert emprunte["sien"] is True


def test_une_bande_de_deux_clips_dit_de_quel_clip_vient_chaque_image(
    client_video, clip, second_clip, animateur
):
    """*Comme une image dit de quel clip elle vient* — le critère, mot pour mot."""
    gardee = _garder(client_video, clip)
    identifiant = gardee["identifiant"]
    client_video.put(
        f"/api/strips/{identifiant}",
        json={"prises": [{"numero": 12}, {"numero": 15, "clip": second_clip}]},
    )

    bande = client_video.get(f"/api/strips/{identifiant}").json()["bande"]

    assert bande["melangee"] is True
    assert set(bande["clips"]) == {clip, second_clip}
    venues = [p["clip"] or bande["clip"] for p in bande["prises"]]
    assert venues == [clip, second_clip]


def test_une_bande_d_un_seul_clip_ne_se_dit_pas_melangee(
    client_video, clip, animateur
):
    """Le cas ordinaire, et il ne doit rien annoncer : une bande d'un seul clip
    n'a rien à dire de sa provenance image par image."""
    gardee = _garder(client_video, clip)

    bande = client_video.get(f"/api/strips/{gardee['identifiant']}").json()["bande"]

    assert bande["melangee"] is False
    assert bande["clips"] == [clip]


def test_un_clip_qui_n_existe_pas_se_refuse_en_nommant_le_clip(
    client_video, clip, animateur
):
    """⚠️ Sans ce contrôle, un identifiant mal tapé rendrait une liste vide et le
    refus parlerait d'un **numéro d'image** au lieu du clip introuvable."""
    gardee = _garder(client_video, clip)

    reponse = client_video.put(
        f"/api/strips/{gardee['identifiant']}",
        json={"prises": [{"numero": 0, "clip": "pas-un-clip"}]},
    )

    assert reponse.status_code == 404, reponse.text


# --------------------------------------------------------------------------- #
# 4. Une bande d'avant A7 se relit sans migration                              #
# --------------------------------------------------------------------------- #


def test_une_bande_ecrite_avant_la_tranche_se_relit_en_prises():
    """⚠️ **Aucune table réécrite**, et c'est ce que `clip` vide achète.

    Les bandes déjà gardées écrivent une liste d'entiers. Les relire comme des
    prises sans clip ni poussée est exactement ce qu'elles voulaient dire.
    """
    ancienne = {
        "identifiant": "b1",
        "clip": "clip-a",
        "nom": "marche",
        "images": [3, 1, 4],
        "cadence": 8,
    }

    bande = Bande.depuis_json(ancienne)

    assert bande.images == (3, 1, 4)
    assert all(p.clip == "" and not p.poussee for p in bande.prises)
    assert bande.clips == ("clip-a",)
    assert bande.melangee is False


def test_une_bande_relue_puis_reecrite_porte_les_deux_formes():
    """`images` pour tout ce qui ne veut que compter, `prises` pour ce qui corrige.
    La première se calcule de la seconde : elles ne peuvent pas diverger."""
    bande = Bande.depuis_json(
        {"identifiant": "b1", "clip": "c", "images": [2, 5]}
    )

    ecrite = bande.en_json()

    assert ecrite["images"] == [2, 5]
    assert [p["numero"] for p in ecrite["prises"]] == [2, 5]


# --------------------------------------------------------------------------- #
# 5. Une correction refusée ne laisse rien derrière elle                       #
# --------------------------------------------------------------------------- #


def test_une_correction_refusee_ne_touche_ni_la_bande_ni_sa_planche(
    client_video, clip, animateur
):
    """Le contrôle passe **avant** la moindre écriture.

    Sans ça, une bande à demi corrigée resterait sur le disque, et l'auteur
    découvrirait une animation dont une image manque — sans que rien ne l'ait
    annoncé.
    """
    gardee = _garder(client_video, clip)
    identifiant = gardee["identifiant"]
    avant = client_video.get(f"/api/strips/{identifiant}").json()["bande"]
    planche_avant = client_video.get(f"/api/strips/{identifiant}/sheet").content

    reponse = client_video.put(
        f"/api/strips/{identifiant}",
        json={"prises": [{"numero": 12}, {"numero": 9999}]},
    )

    assert reponse.status_code == 400, reponse.text
    assert "9999" in reponse.json()["raison"]
    assert client_video.get(f"/api/strips/{identifiant}").json()["bande"] == avant
    assert client_video.get(f"/api/strips/{identifiant}/sheet").content == planche_avant


def test_un_champ_absent_veut_dire_ne_touche_pas_a_ca(client_video, clip, animateur):
    """C'est ce qui rend l'annulation exacte : on renvoie l'état d'avant du seul
    champ qu'on avait changé, et rien d'autre n'a bougé entre-temps."""
    gardee = _garder(client_video, clip, cadence=9, sens="aller-retour")
    identifiant = gardee["identifiant"]

    corrigee = client_video.put(
        f"/api/strips/{identifiant}", json={"cadence": 15}
    ).json()

    assert corrigee["cadence"] == 15
    assert corrigee["sens"] == "aller-retour", "le sens n'était pas dans la demande"
    assert corrigee["images"] == [12, 14, 16, 18]


def test_une_correction_s_annule_en_renvoyant_l_etat_d_avant(
    client_video, clip, animateur
):
    """*Chaque correction est annulable, et la bande d'origine reste lisible.*

    L'annulation n'est pas une pile de gestes au serveur : c'est l'écran qui
    renvoie ce qu'il avait. Ce que l'essai tient est que **le retour est exact**,
    planche comprise — sans quoi annuler laisserait une bande légèrement autre.
    """
    gardee = _garder(client_video, clip)
    identifiant = gardee["identifiant"]
    depart = client_video.get(f"/api/strips/{identifiant}").json()["bande"]
    planche_depart = client_video.get(f"/api/strips/{identifiant}/sheet").content

    client_video.put(
        f"/api/strips/{identifiant}",
        json={"prises": [{"numero": 12, "dx": 4, "dy": 2}, {"numero": 14}]},
    )
    client_video.put(
        f"/api/strips/{identifiant}", json={"prises": depart["prises"]}
    )

    revenue = client_video.get(f"/api/strips/{identifiant}").json()["bande"]
    assert revenue["prises"] == depart["prises"]
    assert client_video.get(f"/api/strips/{identifiant}/sheet").content == planche_depart


def test_une_vitesse_impossible_se_refuse(client_video, clip, animateur):
    """Zéro image par seconde n'est pas une animation lente, c'est une division
    par zéro un peu plus loin."""
    gardee = _garder(client_video, clip)

    reponse = client_video.put(
        f"/api/strips/{gardee['identifiant']}", json={"cadence": -3}
    )

    assert reponse.status_code == 200, "un champ hors bornes vaut absent"
    assert reponse.json()["cadence"] > 0


# --------------------------------------------------------------------------- #
# 6. La fenêtre commune — et **jamais à moitié**                               #
# --------------------------------------------------------------------------- #


def test_la_fenetre_reunit_les_deux_clips_au_lieu_d_en_choisir_un():
    """*Jamais à moitié*, dans sa forme la plus simple.

    Une bande qui prend ses images dans deux clips n'a de fenêtre **dans ni l'un
    ni l'autre**. Prendre celle du clip principal recadrerait les images
    empruntées sur un rectangle mesuré sans elles — et ce qui dépasse ne se
    verrait pas dans l'atelier, mais dans le jeu.
    """
    ici = Fenetre(gauche=10, sommet=10, droite=40, bas=40, images=4)
    ailleurs = Fenetre(gauche=5, sommet=20, droite=30, bas=60, images=2)

    ensemble = ici.avec(ailleurs)

    assert ensemble.en_tuple() == (5, 10, 40, 60)
    assert ensemble.images == 6, "elle a été prise sur les six images"
    assert ici.avec(None) == ici, "rien à réunir laisse la fenêtre telle quelle"


def test_une_fenetre_mesuree_avec_un_autre_detourage_se_dit_d_avant(
    client_video, clip, animateur
):
    """Elle n'est pas fausse, elle est **d'avant** — et la nuance décide de qui
    paie les vingt secondes de la remesure.

    Sans ce drapeau, l'écran aurait deux mauvaises réponses et pas de bonne :
    remesurer d'office à chaque réglage, ou donner pour à jour une fenêtre qui
    laisse dépasser un bras.
    """
    # Ouvrir le montage est ce qui écrit l'étude du clip — c'est le geste par
    # lequel on passe pour découper, et sans lui il n'y a rien à comparer.
    client_video.get(f"/api/montage/{clip}")
    gardee = _garder(client_video, clip)
    identifiant = gardee["identifiant"]
    assert client_video.get(f"/api/strips/{identifiant}").json()["cadre"]["a_jour"]

    client_video.put(
        f"/api/strips/{identifiant}",
        json={"recette": {"passes": [{"moteur": "bord", "tolerance": 42}]}},
    )

    etat = client_video.get(f"/api/strips/{identifiant}").json()["cadre"]
    assert etat["a_jour"] is False, "le détourage a changé depuis la mesure"
    assert etat["choix"] == "clip"


def test_reprendre_la_fenetre_la_remet_a_jour_et_refait_la_planche(
    client_video, clip, animateur
):
    """Le rectangle et la planche sont refaits dans le **même geste**.

    Écrire l'un et laisser l'autre pour plus tard donnerait exactement l'état que
    le critère interdit : une bande dont la fenêtre est neuve et les pixels
    d'avant, sans que rien ne le signale.
    """
    gardee = _garder(client_video, clip)
    identifiant = gardee["identifiant"]
    # Une fenêtre franchement fausse, pour que la remesure ait de quoi se voir.
    client_video.put(
        f"/api/strips/{identifiant}",
        json={
            "cadre": {
                "choix": "clip",
                "gauche": 0,
                "sommet": 0,
                "droite": 19,
                "bas": 19,
            }
        },
    )
    planche_avant = client_video.get(f"/api/strips/{identifiant}/sheet").content

    reponse = client_video.post(f"/api/strips/{identifiant}/frame")

    assert reponse.status_code == 200, reponse.text
    rouverte = client_video.get(f"/api/strips/{identifiant}").json()
    assert rouverte["cadre"]["a_jour"] is True
    assert rouverte["cadre"]["mesuree_le"], "la mesure porte sa date"
    assert rouverte["bande"]["cadre"]["droite"] != 19, "le rectangle a bougé"
    assert (
        client_video.get(f"/api/strips/{identifiant}/sheet").content != planche_avant
    ), "la planche a été refaite avec la fenêtre neuve"


def test_un_cadre_pose_a_la_main_ne_se_remesure_pas(client_video, clip, animateur):
    """Ce sont les quatre nombres de l'auteur : les remesurer serait les effacer.

    Le refus est une phrase, pas un bouton grisé sans raison — et il ne touche
    à rien.
    """
    gardee = _garder(
        client_video,
        clip,
        cadre={"choix": "main", "gauche": 4, "sommet": 4, "droite": 60, "bas": 60},
    )
    identifiant = gardee["identifiant"]
    avant = client_video.get(f"/api/strips/{identifiant}").json()["bande"]

    reponse = client_video.post(f"/api/strips/{identifiant}/frame")

    assert reponse.status_code == 400, reponse.text
    assert "à la main" in reponse.json()["raison"]
    assert client_video.get(f"/api/strips/{identifiant}").json()["bande"] == avant


def test_un_cadre_pose_a_la_main_ne_se_dit_jamais_d_avant(
    client_video, clip, animateur
):
    """Rien ne le périme : il ne sort d'aucune mesure, donc aucune mesure ne le
    dépasse. Le dire *d'avant* proposerait une reprise qui se refuse."""
    gardee = _garder(
        client_video,
        clip,
        cadre={"choix": "main", "gauche": 4, "sommet": 4, "droite": 60, "bas": 60},
    )
    identifiant = gardee["identifiant"]

    client_video.put(
        f"/api/strips/{identifiant}",
        json={"recette": {"passes": [{"moteur": "bord", "tolerance": 42}]}},
    )

    etat = client_video.get(f"/api/strips/{identifiant}").json()["cadre"]
    assert etat["choix"] == "main" and etat["a_jour"] is True


# --------------------------------------------------------------------------- #
# 6bis. La vidéo du clip, qui ne se regardait nulle part                       #
# --------------------------------------------------------------------------- #


def test_la_video_du_clip_se_sert_entiere(client_video, clip, animateur):
    """⚠️ **Elle existait, et aucun écran ne s'en servait.**

    L'écran de montage montre la pellicule et deux boucles tirées des *images
    extraites* ; la vidéo payée restait sur le disque, joignable par cette route
    et invisible par tout chemin que l'auteur pouvait prendre. Signalé par lui le
    5 septembre 2026.
    """
    reponse = client_video.get(f"/api/clips/{clip}/video")

    assert reponse.status_code == 200, reponse.text
    assert reponse.headers["content-type"].startswith("video/")
    assert reponse.headers["accept-ranges"] == "bytes"
    assert len(reponse.content) > 0


def test_la_video_repond_a_une_demande_de_plage(client_video, clip, animateur):
    """Sans ça, **la barre de lecture ne marche pas**.

    Un navigateur qui ne peut pas demander « les octets 100 à 199 » ne sait pas
    se déplacer dans une vidéo : il la rejoue depuis le début, ou refuse de la
    lire. Son lecteur envoie d'ailleurs sa toute première demande en plage.
    """
    entiere = client_video.get(f"/api/clips/{clip}/video").content

    tranche = client_video.get(
        f"/api/clips/{clip}/video", headers={"Range": "bytes=100-199"}
    )

    assert tranche.status_code == 206, tranche.text
    assert tranche.content == entiere[100:200]
    assert tranche.headers["content-range"] == f"bytes 100-199/{len(entiere)}"


def test_une_plage_ouverte_va_jusqu_au_bout(client_video, clip, animateur):
    """`bytes=10-` veut dire *à partir de dix, jusqu'à la fin* — c'est ce que le
    lecteur envoie en premier, avant de connaître la taille du fichier."""
    entiere = client_video.get(f"/api/clips/{clip}/video").content

    depuis = client_video.get(
        f"/api/clips/{clip}/video", headers={"Range": "bytes=10-"}
    )

    assert depuis.status_code == 206
    assert depuis.content == entiere[10:]


def test_une_plage_qui_commence_apres_la_fin_se_refuse_en_disant_la_taille(
    client_video, clip, animateur
):
    """**Un refus qui dit la taille, pas une tranche vide** : c'est ainsi que le
    lecteur apprend jusqu'où il peut demander."""
    taille = len(client_video.get(f"/api/clips/{clip}/video").content)

    reponse = client_video.get(
        f"/api/clips/{clip}/video", headers={"Range": f"bytes={taille + 10}-"}
    )

    assert reponse.status_code == 416
    assert reponse.headers["content-range"] == f"bytes */{taille}"


def test_une_plage_illisible_rend_le_fichier_entier(client_video, clip, animateur):
    """Une demande qu'on ne sait pas lire n'est pas une erreur à renvoyer à la
    figure : c'est une demande à laquelle le fichier entier répond."""
    entiere = client_video.get(f"/api/clips/{clip}/video").content

    reponse = client_video.get(
        f"/api/clips/{clip}/video", headers={"Range": "des octets, voyons"}
    )

    assert reponse.status_code == 200
    assert reponse.content == entiere


# --------------------------------------------------------------------------- #
# 7. Les neuf points d'ancrage                                                 #
# --------------------------------------------------------------------------- #


def test_l_ancrage_se_choisit_parmi_neuf_points():
    """Deux jusqu'ici, et ils suffisaient tant que l'ancrage n'était qu'un
    réglage de recette. Une animation en demande plus."""
    assert len(ANCRAGES) == 9
    assert len(set(ANCRAGES)) == 9


def test_les_deux_anciens_ancrages_valent_exactement_ce_qu_ils_valaient():
    """⚠️ **L'invariant qui protège toutes les images déjà rendues.** `bas` posait
    en bas et centré ; `centre` posait au milieu dans les deux sens."""
    assert parts_de(BAS) == (1.0, 0.5)
    assert parts_de(CENTRE) == (0.5, 0.5)


def test_un_ancrage_inconnu_retombe_sur_le_defaut_du_produit():
    """Un nom inconnu vient d'une recette écrite à la main. Répondre le défaut
    plutôt que lever empêche une image de refuser de se rendre pour un mot mal
    tapé."""
    assert parts_de("nord-nord-ouest") == parts_de(BAS)


def test_l_ancrage_de_la_bande_change_ou_le_sujet_se_pose(
    client_video, clip, animateur
):
    """*La bande entière le respecte* — le critère, vérifié sur les pixels."""
    gardee = _garder(client_video, clip)
    identifiant = gardee["identifiant"]

    def sujet_en_haut_a_gauche(ancrage: str) -> tuple[int, int]:
        client_video.put(
            f"/api/strips/{identifiant}",
            json={
                "recette": {
                    "passes": [{"moteur": "bord", "tolerance": 20}],
                    "grille": {"cible": 48, "occupation": 60, "ancrage": ancrage},
                }
            },
        )
        octets = client_video.get(f"/api/strips/{identifiant}/sheet").content
        with Image.open(io.BytesIO(octets)) as ouverte:
            entiere = np.asarray(ouverte.convert("RGBA"))
        case = entiere[:, : entiere.shape[0]]
        opaques = np.argwhere(case[:, :, 3] > 0)
        return int(opaques[:, 0].min()), int(opaques[:, 1].min())

    haut_gauche = sujet_en_haut_a_gauche(HAUT_GAUCHE)
    bas = sujet_en_haut_a_gauche(BAS)

    assert haut_gauche[0] < bas[0], "en haut, le sujet commence plus haut"
    assert haut_gauche[1] <= bas[1], "à gauche, il commence plus à gauche"


# --------------------------------------------------------------------------- #
# 8. Rien ici ne dépense                                                       #
# --------------------------------------------------------------------------- #


def test_rouvrir_et_corriger_n_appellent_jamais_le_fournisseur(
    client_video, clip, animateur
):
    """*Rien ici ne dépense* — le dernier critère, compté plutôt que supposé."""
    gardee = _garder(client_video, clip)
    identifiant = gardee["identifiant"]
    avant = (
        len(animateur.soumissions),
        len(animateur.recuperations),
        len(animateur.etats_demandes),
    )

    client_video.get(f"/api/strips/{identifiant}")
    client_video.put(
        f"/api/strips/{identifiant}",
        json={"prises": [{"numero": 12, "dx": 1}, {"numero": 14}]},
    )
    client_video.get(f"/api/strips/{identifiant}/sheet")

    assert (
        len(animateur.soumissions),
        len(animateur.recuperations),
        len(animateur.etats_demandes),
    ) == avant


def test_l_apercu_accepte_les_prises_et_montre_la_correction_sans_rien_ecrire(
    client_video, clip, animateur
):
    """C'est ce qui rend le geste vivant : l'auteur voit la poussée avant de la
    garder, et rien n'est écrit tant qu'il n'a pas gardé."""
    sans = client_video.post(
        "/api/montage/preview",
        json={"clip": clip, "prises": [{"numero": 12}, {"numero": 14}]},
    )
    avec = client_video.post(
        "/api/montage/preview",
        json={
            "clip": clip,
            "prises": [{"numero": 12, "dx": 5}, {"numero": 14}],
        },
    )

    assert sans.status_code == 200 and avec.status_code == 200
    assert sans.json()["planche"] != avec.json()["planche"]
    assert client_video.get("/api/strips", params={"clip": clip}).json()["bandes"] == []
