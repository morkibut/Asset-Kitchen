# -*- coding: utf-8 -*-
"""Les critères de B1 — le miroir, et ce qu'il ne casse pas.

**Le critère le plus cher de la tranche est celui qui ne se voit pas** : une
place de plus dans la recette change le JSON canonique de toutes les recettes du
disque, donc leur empreinte, donc le nom de leur rendu — et tout le cache se
recalcule. La tranche pose donc une règle, *une place vide ne s'écrit pas dans
l'empreinte*, et ce fichier la tient sur un corpus figé plutôt que sur une
intention.

**Le corpus ne se régénère pas, il se relit.** `tests/recettes-avant-b1.json`
porte 61 recettes distinctes relevées le 6 septembre 2026 dans les 170 assets de
`donnees/atelier.sqlite3`, avec leur empreinte d'**avant** la tranche. Il est
commité parce que `donnees/` est dans `.gitignore` : un essai ne peut pas lire la
base de l'auteur, et c'est le figement qui fait la preuve, pas la lecture. Le
refaire depuis le code d'aujourd'hui prouverait que le code est d'accord avec
lui-même.

**Aucun test de ce fichier ne coûte un centime.**
"""

from __future__ import annotations

import io
import json
import re
import time
from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageDraw

from atelier.domaine.direction import direction_au_miroir
from atelier.domaine.recette import (
    GAUCHE_DROITE,
    SENS,
    PLACES,
    RETOURNEMENT,
    Bords,
    Contour,
    Passe,
    Recette,
    Retournement,
    places_inconnues,
    voyage,
)
from atelier.image.traitement import queue
from conftest import image_sujet

MODELE = "essai:rend-du-png"

CORPUS = Path(__file__).resolve().parent / "recettes-avant-b1.json"

# La source de l'écran, lue telle quelle — jamais recopiée ici.
PLACES_TSX = (
    Path(__file__).resolve().parents[1]
    / "interface" / "src" / "composants" / "Places.tsx"
)


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _generer(client, prompt: str = "un pèlerin", **corps) -> dict:
    """Une génération lancée par la route, et attendue jusqu'à son terme."""
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": prompt, **corps}
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"la génération « {identifiant} » n'est jamais arrivée à terme")


def _personnage(client, nom: str = "Le pèlerin") -> str:
    """Un personnage et son plan de poses, tels que l'écran les crée."""
    reponse = client.post("/api/characters", json={"nom": nom, "description": ""})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _poses(client) -> list[str]:
    """Les poses du plan du projet neuf — repos, marche, course, attaque…"""
    return [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]


def _directions(client, *noms: str) -> None:
    """Les directions déclarées du jeu. Un projet neuf n'en a aucune.

    Elles se déclarent ici parce qu'une case n'existe que si le jeu l'a nommée :
    générer *vers l'est* dans un jeu qui ne connaît pas l'est est refusé, et
    c'est très bien — le miroir range dans une case, pas dans un mot.
    """
    for nom in noms:
        reponse = client.post("/api/characters/directions", json={"nom": nom})
        assert reponse.status_code == 201, reponse.text


def _octets(rgba: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


def _dissymetrique(cote: int = 16) -> np.ndarray:
    """Un sujet qu'un miroir change forcément, et une palette qu'il ne change pas.

    Un carré centré serait son propre miroir : l'essai passerait sans que rien
    ne soit retourné. Celui-ci porte un bras d'un seul côté, et trois couleurs
    distinctes dont aucune n'est le fond — c'est la palette que le miroir doit
    rendre à l'identique.
    """
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[4:12, 6:10, :3] = (190, 40, 40)
    rgba[4:12, 6:10, 3] = 255
    rgba[5:7, 10:14, :3] = (40, 120, 190)  # le bras, à droite seulement
    rgba[5:7, 10:14, 3] = 255
    rgba[11, 6, :3] = (250, 240, 30)  # un pixel qui n'est nulle part ailleurs
    rgba[11, 6, 3] = 255
    return rgba


def _palette(rgba: np.ndarray) -> set[tuple[int, ...]]:
    """Les couleurs présentes, sans leur position. Un miroir n'en invente aucune."""
    return {tuple(int(v) for v in pixel) for pixel in rgba.reshape(-1, 4)}


def _importer(client, rgba: np.ndarray, nom: str) -> str:
    """Une image posée dans la bibliothèque **sans passer par le fournisseur**."""
    reponse = client.post(
        "/api/assets/upload", content=_octets(rgba), params={"nom": nom}
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


# ── « Les recettes écrites avant cette tranche rendent la même empreinte
#     qu'avant — un essai le tient sur les recettes du dépôt » ────────────────


def test_les_soixante_et_une_recettes_du_depot_gardent_leur_empreinte():
    """Le critère qui décide de la forme de `Recette.en_json`.

    Chaque recette est relue telle qu'elle était écrite sur le disque avant la
    tranche, et son empreinte refaite ici. Si quelqu'un ajoute un jour une clé au
    JSON canonique — ou retire un `null` des huit d'origine —, cet essai le dit
    avant la livraison, et il nomme la recette fautive.
    """
    corpus = json.loads(CORPUS.read_text(encoding="utf-8"))
    assert len(corpus) == 61, "le corpus figé a changé de taille — il ne se régénère pas"

    for rang, entree in enumerate(corpus):
        recette = Recette.depuis_json(entree["recette"])
        assert recette.empreinte() == entree["empreinte"], (
            f"recette {rang} : l'empreinte a bougé — "
            f"{entree['empreinte']} avant, {recette.empreinte()} maintenant"
        )
        assert recette.empreinte_passes() == entree["empreinte_passes"], (
            f"recette {rang} : l'empreinte du détourage a bougé"
        )


def test_le_json_canonique_d_une_recette_d_avant_est_le_meme_caractere_pour_caractere():
    """L'empreinte est un condensé : deux JSON différents pourraient, en théorie,
    se cogner. C'est le JSON lui-même qu'on compare ici, et c'est lui qui dit
    *pourquoi* l'empreinte tient — les huit clés sont là, `null` compris, dans
    le même ordre, et il n'y en a pas une neuvième."""
    corpus = json.loads(CORPUS.read_text(encoding="utf-8"))

    for rang, entree in enumerate(corpus):
        relue = Recette.depuis_json(entree["recette"]).en_json()
        assert relue == entree["recette"], f"recette {rang} : le canonique a changé"
        assert "retournement" not in relue


@pytest.mark.parametrize(
    "recette, empreinte",
    [
        (Recette(), "3f64f3b07aa09852"),
        (
            Recette(passes=(Passe(),), bords=Bords(aire_min=4), contours=Contour()),
            "f9222deaf029aaa9",
        ),
    ],
)
def test_les_deux_empreintes_mesurees_avant_la_tranche_ne_bougent_pas(
    recette, empreinte
):
    """Deux repères écrits en dur, relevés avant d'écrire une ligne de B1.

    Le corpus prouve la même chose en grand ; ces deux-là la prouvent **sans
    fichier**, et c'est ce qui les rend lisibles dans un rapport d'échec : la
    recette vide, et une recette qui remplit trois places.
    """
    assert recette.empreinte() == empreinte


def test_la_cle_du_retournement_ne_s_ecrit_que_si_la_place_est_remplie():
    """La règle, dite dans les deux sens.

    C'est elle qui fait que le canonique d'une recette sans retournement est
    strictement celui d'avant la tranche : la clé neuve n'existe pas tant que
    personne ne l'a remplie.
    """
    assert "retournement" not in Recette().en_json()
    assert "retournement" not in Recette(bords=Bords(aire_min=4)).en_json()

    remplie = Recette(retournement=Retournement()).en_json()
    assert remplie["retournement"] == {"sens": GAUCHE_DROITE}


def test_les_huit_clefs_d_origine_s_ecrivent_toujours_meme_a_nul():
    """**La règle vaut pour la clé neuve, et pas pour les huit autres.**

    Retirer leurs `null` serait très exactement le recalcul de tout le cache
    qu'on cherche à éviter, en plus grand. Un essai le dit, parce que c'est la
    simplification que quelqu'un tentera un jour de bonne foi.
    """
    vide = Recette().en_json()
    for clef in ("difference", "recadrage", "grille", "quantification",
                 "bords", "contours", "main"):
        assert clef in vide and vide[clef] is None, clef
    assert vide["passes"] == [] and vide["veille"] == []


def test_le_retournement_se_relit_tel_qu_il_s_ecrit():
    """Un objet qu'on sait écrire et qu'on ne sait pas relire n'est pas fini —
    le point 8septies d'`AGENTS.md`, payé sur `A7`. On repart d'un réglage qui
    n'est pas celui du défaut, sinon la relecture passe par accident."""
    recette = Recette(retournement=Retournement(sens="haut-bas"))
    relue = Recette.depuis_json(recette.en_json())

    assert relue.retournement == Retournement(sens="haut-bas")
    assert relue == recette


def test_le_retournement_est_une_place_a_part_entiere():
    """Il est dans `PLACES`, **entre le contour et la main** — l'ordre de la
    liste est l'ordre d'exécution, et c'est lui que l'écran et l'agent lisent."""
    assert PLACES.index(RETOURNEMENT) == PLACES.index("contours") + 1
    assert PLACES.index(RETOURNEMENT) == PLACES.index("main") - 1


# ── « Le retournement s'endort sans se vider, comme les huit autres places » ──


def test_endormie_la_place_garde_tous_ses_reglages():
    """*Éteinte et vide sont deux états* (U4). La veille ne touche pas au champ."""
    recette = Recette(retournement=Retournement()).endormie(RETOURNEMENT, True)

    assert recette.dort(RETOURNEMENT)
    assert recette.retournement == Retournement()
    assert recette.endormie(RETOURNEMENT, False).retournement == Retournement()


def test_endormie_la_place_ne_dit_plus_que_l_image_est_un_miroir():
    """`Recette.miroir` lit la place **et** la veille.

    Sans cette lecture, une image dont le retournement dort porterait l'étiquette
    « miroir » en montrant l'image de départ : un effet resté en travers, très
    exactement ce que la veille promet de ne pas faire.
    """
    vif = Recette(retournement=Retournement())
    assert vif.miroir is True
    assert vif.endormie(RETOURNEMENT, True).miroir is False
    assert Recette().miroir is False


def test_endormie_l_image_sort_identique_a_celle_sans_la_place_du_tout():
    """La promesse écrite de la veille, mesurée **sur les pixels**.

    *Une image traitée avec le retournement en veille sort identique au pixel
    près à la même sans la place du tout.* Sur les pixels et pas sur la recette :
    c'est le rendu qui doit être identique, et c'est le seul endroit où une
    veille peut fuir.
    """
    depart = _dissymetrique()
    sans = queue(depart, Recette(bords=Bords(aire_min=1)))
    endormie = queue(
        depart,
        Recette(bords=Bords(aire_min=1), retournement=Retournement()).endormie(
            RETOURNEMENT, True
        ),
    )

    assert np.array_equal(sans, endormie)


def test_les_deux_portes_d_entree_acceptent_la_place_neuve():
    """La route HTTP et l'outil de l'agent vérifient la veille **par le domaine**.

    Les deux appellent `places_inconnues`, qui lit `PLACES` : ajouter la place au
    domaine suffit à la faire accepter des deux côtés, et il n'y a pas de second
    endroit de vérité à mettre d'accord. L'essai le dit plutôt que de le
    supposer — une liste écrite à la main quelque part se verrait ici.
    """
    assert places_inconnues([RETOURNEMENT]) == []
    assert places_inconnues(["retournements"]) == ["retournements"]


def test_la_place_se_pose_et_s_endort_par_la_route(client):
    """Le chemin de l'écran, de bout en bout : la charge porte `retournement`
    entre `contours` et `main`, et `veille` accepte son nom."""
    identifiant = _importer(client, _dissymetrique(), "pelerin.png")

    reponse = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={"passes": [], "retournement": {"sens": GAUCHE_DROITE}},
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["recette"]["retournement"] == {"sens": GAUCHE_DROITE}

    endormie = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={
            "passes": [],
            "retournement": {"sens": GAUCHE_DROITE},
            "veille": [RETOURNEMENT],
        },
    )
    assert endormie.status_code == 200, endormie.text
    recette = endormie.json()["recette"]
    assert recette["veille"] == [RETOURNEMENT]
    assert recette["retournement"] == {"sens": GAUCHE_DROITE}, "la veille a vidé la place"


# ── « Le miroir est exact » ──────────────────────────────────────────────────


def test_retourner_deux_fois_rend_l_image_de_depart():
    """Au pixel près. C'est la preuve qu'aucun pixel n'est réinventé : une
    opération qui interpolerait ne serait pas sa propre réciproque."""
    depart = _dissymetrique()
    recette = Recette(retournement=Retournement())

    une_fois = queue(depart, recette)
    deux_fois = queue(une_fois, recette)

    assert not np.array_equal(une_fois, depart), "rien n'a été retourné"
    assert np.array_equal(deux_fois, depart)


def test_la_palette_de_l_image_retournee_est_rigoureusement_celle_du_depart():
    """C'est ce que la planche montre sous les deux images, et c'est ce qui
    sépare un miroir d'une seconde génération : le même tableau, colonnes dans
    l'autre ordre."""
    depart = _dissymetrique()
    retournee = queue(depart, Recette(retournement=Retournement()))

    assert _palette(retournee) == _palette(depart)


def test_le_miroir_se_pose_apres_le_contour_et_avant_la_main():
    """L'ordre du fichier est l'ordre d'exécution, et il se mesure.

    Un contour tracé **après** le retournement serait tracé sur la silhouette
    retournée — ce qui donne la même image ici, mais pas le jour où une place
    entre les deux ne sera plus symétrique. Ce qu'on mesure est plus simple et
    ne dépend d'aucune symétrie : la place agit, et elle agit sur ce que le
    contour a produit.
    """
    depart = _dissymetrique()
    avec = Recette(
        contours=Contour(epaisseur=1, couleur="#112233"),
        retournement=Retournement(),
    )
    sans = Recette(contours=Contour(epaisseur=1, couleur="#112233"))

    rendu = queue(depart, avec)
    temoin = queue(depart, sans)

    assert rendu.shape == temoin.shape, "le retournement a changé les dimensions"
    assert np.array_equal(rendu, temoin[:, ::-1, :])


def test_un_sens_inconnu_ne_retourne_rien_et_ne_leve_pas():
    """*Le domaine relit des fichiers, il ne juge pas* — la règle de
    `durcissement_livre`. Une recette écrite par une version qui connaîtra les
    neuf autres sens (`B18`) doit continuer de s'ouvrir ici."""
    depart = _dissymetrique()
    rendu = queue(depart, Recette(retournement=Retournement(sens="rot-sprite")))

    assert np.array_equal(rendu, depart)


def test_le_sens_du_retournement_voyage():
    """Un sens est un réglage, pas une coordonnée : il se recolle ailleurs et il
    y dit la même chose. Rien ne s'ajoute donc à la liste de ce qui est laissé."""
    partie, laisse = voyage(Recette(retournement=Retournement()))

    assert partie.retournement == Retournement()
    assert laisse == ()


# ── « L'image retournée se range dans la direction qu'on lui désigne, et la
#     case se remplit » ─────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "depart, arrivee",
    [
        ("est", "ouest"),
        ("ouest", "est"),
        ("droite", "gauche"),
        ("gauche", "droite"),
        ("nord-est", "nord-ouest"),
        ("sud-ouest", "sud-est"),
        # **Elles se rendent elles-mêmes, et c'est juste** : un miroir
        # gauche-droite ne montre pas le dos d'un personnage.
        ("sud", "sud"),
        ("nord", "nord"),
    ],
)
def test_la_table_du_miroir_connait_les_directions_que_le_produit_livre(
    depart, arrivee
):
    assert direction_au_miroir(depart) == arrivee


@pytest.mark.parametrize("nom", ["bas", "haut", "vers le joueur", "", None])
def test_la_table_se_tait_sur_ce_qu_elle_ne_connait_pas(nom):
    """**Mesuré le 6 septembre 2026** : les directions réellement écrites sur les
    170 images du dépôt sont `bas` (12), `haut` (2) et `droite` (25). Deux des
    trois ne sont dans aucune liste livrée — l'auteur a nommé les siennes.

    Deviner qu'un mot français désigne une direction opposée serait la déduction
    que le produit refuse ailleurs : *vide ne veut pas dire sud*. L'écran
    demande alors la case au lieu de la proposer.
    """
    assert direction_au_miroir(nom) is None


def test_l_image_retournee_se_range_dans_la_direction_proposee(client, double):
    """Le geste entier, par la route, sur une image générée en `droite`.

    C'est le cas mesuré que la tranche sert vraiment : `michel` porte 25 images
    en `droite` et aucune en `gauche`.
    """
    double.rendre = lambda: image_sujet()
    _directions(client, "droite", "gauche")
    pelerin = _personnage(client)
    marche = _poses(client)[1]
    generation = _generer(
        client, personnage=pelerin, pose=marche, direction="droite"
    )
    parent = f"{generation['identifiant']}-0"

    avant = double.appels
    reponse = client.post(f"/api/assets/{parent}/mirror", json={})
    assert reponse.status_code == 201, reponse.text
    miroir = reponse.json()["miroir"]

    assert miroir["direction"] == "gauche"
    assert miroir["personnage"] == pelerin and miroir["pose"] == marche
    assert miroir["parent"] == parent
    assert miroir["recette"]["retournement"] == {"sens": GAUCHE_DROITE}
    assert double.appels == avant, "un miroir a demandé une image au fournisseur"


def test_un_miroir_n_a_rien_couté_et_garde_l_unite_de_son_parent(client, double):
    """**Zéro dollar et zéro jeton ne se lisent pas pareil** (F2) : le premier
    s'écrit « $0,0000 », le second « gratuit ». Le miroir hérite donc de l'unité
    de l'appel avec une quantité nulle, comme une découpe."""
    double.rendre = lambda: image_sujet()
    _directions(client, "est", "ouest")
    generation = _generer(client, direction="est")
    parent = client.get(f"/api/assets/{generation['identifiant']}-0").json()

    miroir = client.post(
        f"/api/assets/{parent['identifiant']}/mirror", json={}
    ).json()["miroir"]

    assert miroir["consomme"] == 0.0
    assert miroir["unite"] == parent["unite"]
    assert miroir["provenance"] == parent["provenance"]
    assert miroir["modele"] == parent["modele"]
    assert parent["consomme"] > 0, "le témoin n'a rien coûté non plus"


def test_la_direction_designee_l_emporte_sur_celle_que_le_produit_propose(client):
    """Les directions d'un projet sont libres et l'auteur les renomme : le défaut
    n'est qu'une proposition, et aucun geste n'est bloqué par une paire inconnue.
    """
    identifiant = _importer(client, _dissymetrique(), "pelerin.png")

    miroir = client.post(
        f"/api/assets/{identifiant}/mirror", json={"direction": "vers la porte"}
    ).json()["miroir"]

    assert miroir["direction"] == "vers la porte"


def test_sans_case_a_remplir_le_service_refuse_avec_sa_raison(client, double):
    """*Le nord se paie.* Fabriquer quand même rangerait une seconde image dans
    une case déjà prise, et le compte de la matrice dirait alors qu'une direction
    est faite deux fois pendant qu'une autre manque.

    Le refus est en clair et il porte le mot du produit : l'écran a déjà grisé le
    geste avant le clic, ce refus-ci est le filet.
    """
    double.rendre = lambda: image_sujet()
    _directions(client, "nord")
    generation = _generer(client, direction="nord")
    parent = f"{generation['identifiant']}-0"

    reponse = client.post(f"/api/assets/{parent}/mirror", json={})

    assert reponse.status_code == 409, reponse.text
    assert "miroir gauche-droite" in reponse.json()["raison"]


def test_l_ecran_sait_avant_le_clic_qu_il_n_y_a_pas_de_case(client, double):
    """*Une route qui sert quelque chose que nul écran n'affiche n'existe pas*
    (point 8nonies d'`AGENTS.md`) — et son contraire : un refus que l'écran ne
    peut pas prévoir arrive toujours trop tard. `GET` rend la proposition et la
    raison, sans rien créer."""
    double.rendre = lambda: image_sujet()
    _directions(client, "droite", "gauche", "nord")
    droite = f"{_generer(client, direction='droite')['identifiant']}-0"
    nord = f"{_generer(client, direction='nord')['identifiant']}-0"

    vu = client.get(f"/api/assets/{droite}/mirror").json()
    assert vu["propose"] == "gauche" and vu["raison"] is None

    mure = client.get(f"/api/assets/{nord}/mirror").json()
    assert mure["propose"] is None
    assert "miroir gauche-droite" in mure["raison"]


def test_le_miroir_d_un_miroir_revient_a_l_image_de_depart(client, double):
    """Le geste est un interrupteur, pas un empilement.

    Deux miroirs gauche-droite rendent l'image de départ — c'est ce que les
    pixels font, quoi qu'on écrive dans la recette. La remplir une seconde fois
    aurait donné une recette identique à celle du parent, donc **la même image
    rangée dans la case d'en face** : un pèlerin qui marche vers la gauche
    affiché comme allant vers la droite.
    """
    double.rendre = lambda: image_sujet()
    _directions(client, "est", "ouest")
    generation = _generer(client, direction="est")
    parent = f"{generation['identifiant']}-0"

    ouest = client.post(f"/api/assets/{parent}/mirror", json={}).json()["miroir"]
    est = client.post(
        f"/api/assets/{ouest['identifiant']}/mirror", json={}
    ).json()["miroir"]

    assert ouest["recette"]["retournement"] == {"sens": GAUCHE_DROITE}
    assert est["direction"] == "est"
    assert "retournement" not in est["recette"]


def test_une_case_deja_prise_refuse_le_miroir(client, double):
    """**La règle que le refus invoquait sans jamais l'appliquer.**

    `retourner` refuse une direction que le miroir rend telle quelle en disant
    pourquoi : *fabriquer quand même produirait une seconde image dans une case
    déjà prise, et le compte de la matrice dirait alors qu'une direction est
    faite deux fois pendant qu'une autre manque.* Cette raison-là ne dépend pas
    de la direction d'arrivée mais de ce qui est déjà rangé — et une direction
    tapée à la main passait outre.
    """
    double.rendre = lambda: image_sujet()
    _directions(client, "est", "ouest")
    pelerin = _personnage(client)
    pose = _poses(client)[0]
    est = f"{_generer(client, personnage=pelerin, pose=pose, direction='est')['identifiant']}-0"
    _generer(client, personnage=pelerin, pose=pose, direction="ouest")

    reponse = client.post(f"/api/assets/{est}/mirror", json={})

    assert reponse.status_code == 409, reponse.text
    assert "porte déjà une image" in reponse.json()["raison"]


def test_le_miroir_d_un_miroir_ne_reecrit_pas_la_case_du_parent(client, double):
    """Le chemin qui enfreignait la règle était à deux clics.

    Depuis la table, l'écran bascule sur le miroir après le geste et redemande
    une proposition pour lui : il obtient **la case du parent**, qui est prise
    par le parent lui-même. Un clic de plus y écrivait une troisième image.
    """
    double.rendre = lambda: image_sujet()
    _directions(client, "est", "ouest")
    pelerin = _personnage(client)
    pose = _poses(client)[0]
    est = f"{_generer(client, personnage=pelerin, pose=pose, direction='est')['identifiant']}-0"

    ouest = client.post(f"/api/assets/{est}/mirror", json={}).json()["miroir"]
    assert ouest["direction"] == "ouest"

    retour = client.post(f"/api/assets/{ouest['identifiant']}/mirror", json={})
    assert retour.status_code == 409, retour.text
    assert "porte déjà une image" in retour.json()["raison"]


def test_le_label_ne_dit_miroir_que_si_l_image_en_est_un(client, double):
    """Un nom et une étiquette qui se démentent sur la même tuile sont pires que
    l'un des deux.

    Retourner un miroir le **redresse** — la place se retire, et les pixels
    reviennent à l'endroit. L'image qui en sort n'est pas un miroir : son nom ne
    doit pas le dire, sans quoi la grille montrerait une tuile appelée
    « · miroir est » dont l'étiquette, elle, lit la recette et n'y trouve rien.
    """
    double.rendre = lambda: image_sujet()
    _directions(client, "est", "ouest")
    est = f"{_generer(client, direction='est')['identifiant']}-0"

    ouest = client.post(f"/api/assets/{est}/mirror", json={}).json()["miroir"]
    assert ouest["label"].endswith("· miroir ouest")

    redresse = client.post(
        f"/api/assets/{ouest['identifiant']}/mirror", json={}
    ).json()["miroir"]
    assert "retournement" not in redresse["recette"]
    assert "miroir" not in redresse["label"], redresse["label"]
    assert redresse["label"].endswith("· est")


def test_le_miroir_est_un_asset_entier_et_survit_a_son_parent(client, double):
    """La décision de la découpe, reprise pour la même raison : supprimer
    l'image de départ laisse le miroir en place. Il a ses propres octets, sa
    propre recette et son propre rangement."""
    double.rendre = lambda: image_sujet()
    _directions(client, "est", "ouest")
    generation = _generer(client, direction="est")
    parent = f"{generation['identifiant']}-0"
    miroir = client.post(f"/api/assets/{parent}/mirror", json={}).json()["miroir"]

    assert miroir["identifiant"] != parent
    assert miroir["brut"] != client.get(f"/api/assets/{parent}").json()["brut"]
    assert client.get(f"/api/assets/{miroir['identifiant']}").status_code == 200


# ── « Un essai mesure le gain sur un personnage à quatre directions : huit
#     images payées au lieu de seize » ────────────────────────────────────────


def test_seize_cases_pour_huit_images_payees(client, double):
    """Le chiffre de la tranche, compté sur les appels du double.

    Quatre poses dans quatre directions font seize cases. Deux directions se
    paient — `est` et `nord-est` —, les deux autres se retournent. **Le compte
    d'appels au fournisseur est de huit**, et les seize cases sont pourtant
    remplies, chacune avec sa direction.

    Sans le miroir, ce même personnage demandait seize générations : c'est le
    même travail pour la moitié du prix, et à l'identique au pixel près plutôt
    qu'à une seconde génération près.
    """
    double.rendre = lambda: image_sujet()
    _directions(client, "est", "ouest", "nord-est", "nord-ouest")
    pelerin = _personnage(client)
    poses = _poses(client)[:4]
    payees = ("est", "nord-est")

    cases: list[tuple[str, str]] = []
    gratuites = 0
    for pose in poses:
        for direction in payees:
            generation = _generer(client, pose=pose, personnage=pelerin,
                                  direction=direction)
            parent = f"{generation['identifiant']}-0"
            cases.append((pose, direction))

            miroir = client.post(f"/api/assets/{parent}/mirror", json={}).json()["miroir"]
            cases.append((pose, miroir["direction"]))
            gratuites += 1
            assert miroir["consomme"] == 0.0

    assert double.appels == 8, "le nombre d'images payées a bougé"
    assert gratuites == 8
    assert len(set(cases)) == 16, "seize cases distinctes, une par pose et direction"
    assert {d for _, d in cases} == {"est", "ouest", "nord-est", "nord-ouest"}


# ── Ce que le rendu servi montre vraiment ────────────────────────────────────
#
# **Les essais de cette section regardent les octets qui sortent de la route**,
# pas le tableau qui sort de `queue`. La différence a coûté la tranche entière :
# tous les essais passaient au vert pendant que le miroir était **sans effet à
# l'écran**, parce que le service appliquait la queue de la recette deux fois et
# qu'un miroir gauche-droite est une involution. Trouvé au navigateur le
# 6 septembre 2026, sur un atelier jetable — jamais par un essai.
#
# **Le sujet doit être dissymétrique.** Un carré centré est son propre miroir :
# il aurait montré la même image dans les deux cas et n'aurait rien prouvé.


def _sujet_dissymetrique() -> bytes:
    """Un sujet dont le miroir ne ressemble pas à lui-même.

    Un bloc d'un côté, un point d'une autre couleur de l'autre, sur un fond
    **transparent**. C'est le minimum pour que « l'image a été retournée » soit
    une question à laquelle des pixels puissent répondre — et la transparence
    n'est pas un détail : une image entièrement opaque n'a pas de bord de sujet,
    et `contourner` la rend telle quelle. Sans elle, l'essai du contour ne
    mesurerait rien.
    """
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    dessin.rectangle((4, 8, 11, 23), fill=(200, 60, 60, 255))
    dessin.rectangle((20, 10, 23, 13), fill=(60, 60, 200, 255))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _rendu_servi(client, identifiant: str) -> np.ndarray:
    """Les pixels que la route sert — ceux que l'auteur voit, et pas d'autres."""
    reponse = client.get(f"/api/assets/{identifiant}/image")
    assert reponse.status_code == 200, reponse.text
    with Image.open(io.BytesIO(reponse.content)) as image:
        return np.asarray(image.convert("RGBA"))


def test_le_rendu_servi_est_bien_retourne(client, double):
    """**Le critère que personne ne mesurait, et la tranche en dépend.**

    Posé par la route, relu par la route : l'image servie doit être le miroir de
    celle d'avant, et surtout ne pas lui être identique. C'est cet essai-là qui
    tient la réparation de `en_rendu` — sans lui, le jour où quelqu'un remet un
    `finir` à la place, tous les autres essais de ce fichier resteront verts.
    """
    double.rendre = lambda: _sujet_dissymetrique()
    identifiant = f"{_generer(client)['identifiant']}-0"

    # **Deux recettes qui ne diffèrent que par la place**, posées l'une après
    # l'autre par la même route. Comparer au rendu d'origine mesurerait aussi ce
    # que l'univers du projet impose à la naissance.
    nue = {"passes": [], "veille": []}
    assert client.put(f"/api/assets/{identifiant}/recipe", json=nue).status_code == 200
    avant = _rendu_servi(client, identifiant)

    pose = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={**nue, "retournement": {"sens": GAUCHE_DROITE}},
    )
    assert pose.status_code == 200, pose.text
    apres = _rendu_servi(client, identifiant)

    assert not np.array_equal(avant, apres), "le rendu servi n'a pas bougé"
    assert np.array_equal(np.fliplr(apres), avant), "le rendu servi n'est pas le miroir"


def test_la_queue_de_la_recette_ne_s_applique_qu_une_fois(client, double):
    """La cause du défaut, tenue par sa cause et pas seulement par son effet.

    Le contour est la seconde place non idempotente : tracé deux fois, un trait
    demandé à 1 px en rend 2, autour d'une silhouette qu'il vient d'agrandir.
    Le défaut était **livré** et antérieur à cette tranche ; l'essai le tient
    ici parce que c'est ici qu'on l'a trouvé.
    """
    double.rendre = lambda: _sujet_dissymetrique()
    identifiant = f"{_generer(client)['identifiant']}-0"

    nue = {"passes": [], "veille": []}
    assert client.put(f"/api/assets/{identifiant}/recipe", json=nue).status_code == 200
    avant = _rendu_servi(client, identifiant)

    client.put(
        f"/api/assets/{identifiant}/recipe",
        json={
            **nue,
            "contours": {
                "epaisseur": 1,
                "couleur": "#000000",
                "position": "externe",
                "trous": "cercles",
            },
        },
    )
    apres = _rendu_servi(client, identifiant)

    # Un contour externe d'un pixel agrandit l'image d'un pixel par côté. Tracé
    # deux fois, il en ajoutait deux.
    assert apres.shape[0] == avant.shape[0] + 2, "le contour a été tracé deux fois"
    assert apres.shape[1] == avant.shape[1] + 2, "le contour a été tracé deux fois"


# ── Ce que deux listes doivent se dire ───────────────────────────────────────


def test_les_sens_du_retournement_sont_les_memes_des_deux_cotes():
    """**Deux listes pour un fait finissent toujours par diverger** — la leçon
    des sept crans contre neuf (E8), et celle du nom des moteurs (D1).

    L'écran propose les sens ; le traitement les applique. Le jour où `B18` en
    ajoute un côté domaine sans le poser dans la table, l'auteur ne pourrait pas
    le choisir ; posé côté écran sans le domaine, il retournerait dans le vide et
    l'image sortirait telle quelle. Aucune des deux pannes ne lève : elles se
    lisent sur l'image, ou pas du tout.

    L'essai lit la source de l'écran plutôt que de recopier les noms — une
    troisième copie serait très exactement la panne qu'on ferme ici. La clé est
    entre guillemets parce qu'elle porte un tiret, ce que le motif de
    `tests/test_d1.py` ne prévoyait pas.
    """
    ecrit = re.search(
        r'export const SENS_DU_RETOURNEMENT: Record<Retournement\["sens"\], string> = \{([^}]*)\}',
        PLACES_TSX.read_text(encoding="utf-8"),
    )
    assert ecrit is not None, (
        "SENS_DU_RETOURNEMENT a été renommée ou déplacée hors de Places.tsx"
    )

    lus = dict(re.findall(r'"?([\w-]+)"?: "([^"]*)"', ecrit.group(1)))

    assert set(lus) == set(SENS), "l'écran et le domaine ne proposent pas les mêmes sens"
    assert lus == {GAUCHE_DROITE: "miroir gauche-droite"}


def test_les_sens_a_ajouter_ne_sont_pas_des_sens():
    """Les neuf lignes grisées de la table **n'existent nulle part ailleurs**.

    Elles disent ce que l'atelier saura faire (`B18`), et rien de plus. Si l'une
    d'elles se retrouvait dans `SENS`, elle serait proposée pour de bon et
    retournerait dans le vide — une ligne morte qui a pris vie sans que personne
    l'écrive.
    """
    ecrit = re.search(
        r"export const SENS_A_AJOUTER: readonly string\[\] = \[([^\]]*)\]",
        PLACES_TSX.read_text(encoding="utf-8"),
    )
    assert ecrit is not None, "SENS_A_AJOUTER a quitté Places.tsx"

    a_ajouter = re.findall(r'"([^"]*)"', ecrit.group(1))

    assert len(a_ajouter) == 9, "la planche en compte dix en tout, un seul est livré"
    assert not set(a_ajouter) & set(SENS)
