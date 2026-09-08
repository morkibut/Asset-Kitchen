# -*- coding: utf-8 -*-
"""Les critères d'acceptation de T2 — le post-traitement.

Un test par critère de `docs/archive/plan-versions-tenues.md` § Phase T2, nommé d'après lui. Le dixième
critère — « la comparaison est faite et tranchée : sortie brute du modèle contre
sortie post-traitée » — ne se vérifie pas ici : c'est un banc sur des images
réelles, il vit dans `essais/essai_pixel.py`, et il est gratuit.

**Aucun test de ce fichier n'appelle le fournisseur.** C'est plus qu'une
économie, c'est le sujet : T2 instaure l'invariant « le post-traitement
n'appelle jamais le fournisseur », et plusieurs tests le vérifient en comptant
les appels du double avant et après une retouche.

Les images d'essai viennent de `tests/conftest.py` : un sujet rayé sur un fond
plat, peint sur une grille de taille réglable. Faire varier cette taille rejoue
la dérive de grille mesurée au banc — « dix modèles sur douze font dériver la
taille du pixel » — sans dépenser un centime.
"""

from __future__ import annotations

import io
import sys
import time

import numpy as np
from conftest import bloc_mesure, image_sujet
from PIL import Image

from atelier.domaine.recette import Passe, Recette

# Les bibliothèques qui mobiliseraient une carte graphique. Aucune ne doit être
# chargée par une retouche : « le post-traitement ne touche jamais le GPU »
# (`docs/ARCHITECTURE.md` §4, règle 4).
CARTES_GRAPHIQUES = ("torch", "tensorflow", "onnxruntime", "cv2", "cupy")


def _generer(client, double, **image) -> dict:
    """Une image produite, et l'asset qu'elle a fait naître."""
    double.rendre = lambda: image_sujet(**image)
    generation = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "un sujet d'essai"},
    ).json()
    identifiant = f"{generation['identifiant']}-0"
    reponse = client.get(f"/api/assets/{identifiant}")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _recette(**parties) -> dict:
    plein = {
        "passes": [],
        "recadrage": None,
        "grille": None,
        "quantification": None,
        "bords": None,
        "nom": None,
    }
    plein.update(parties)
    return plein


DETOURER_ET_REDUIRE = _recette(
    passes=[{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128, "durcissement": 0}],
    recadrage={"marge": 0, "boite": None},
    grille={"cible": 16, "occupation": 100, "ancrage": "bas"},
)


def _rendu(client, identifiant: str, brut: bool = False) -> bytes:
    reponse = client.get(f"/api/assets/{identifiant}/image", params={"brut": brut})
    assert reponse.status_code == 200, reponse.text
    return reponse.content


def _opaques(octets: bytes) -> int:
    with Image.open(io.BytesIO(octets)) as image:
        return int((np.asarray(image.convert("RGBA"))[:, :, 3] > 0).sum())


# ── L'asset naît à l'arrivée de l'image ──────────────────────────────────────


def test_l_asset_nait_a_l_arrivee_de_l_image(client, double):
    """Pas au premier geste de retouche : sinon l'emplacement et l'asset
    diraient tous les deux ce qu'est cette image, et T3 aurait à les fondre."""
    asset = _generer(client, double)

    assert asset["rang"] == 0
    assert asset["label"] == "un sujet d'essai"
    # **Depuis T4, il naît déjà habillé de son univers** : « un asset se génère,
    # se détoure, se ramène sur la grille et la palette du projet, et se range
    # tout seul ». En T2 la recette naissait vide et le rendu *était* le brut ;
    # ce n'était pas un critère, c'était l'état d'un produit qui n'avait pas
    # encore de projet pour imposer quoi que ce soit. Le critère de T2, lui, ne
    # bouge pas : l'asset existe à l'arrivée de l'image, pas au premier réglage.
    assert asset["traite"] is True
    # Et il n'est pas épinglé pour autant : une recette posée par l'univers
    # n'est pas une recette posée à la main, donc un changement de palette la
    # remet à jour (US-68).
    assert asset["epingle"] is False
    assert (asset["largeur"], asset["hauteur"]) == (96, 96)  # le brut ne change jamais
    assert asset["identifiant"] in [
        a["identifiant"] for a in client.get("/api/assets").json()["assets"]
    ]


# ── « Une image rendue sur une grille cinq fois trop grosse revient sur la
#     grille cible demandée » ─────────────────────────────────────────────────


def test_une_grille_cinq_fois_trop_grosse_revient_sur_la_cible(client, double):
    asset = _generer(client, double, bloc=20, logique_l=8, logique_h=16)

    pose = client.put(
        f"/api/assets/{asset['identifiant']}/recipe", json=DETOURER_ET_REDUIRE
    )
    assert pose.status_code == 200, pose.text
    traite = pose.json()

    # La cible est **demandée**, jamais déduite de l'image reçue (US-61).
    assert (traite["rendu_largeur"], traite["rendu_hauteur"]) == (16, 16)
    assert bloc_mesure(_rendu(client, asset["identifiant"])) == 1


# ── « Un petit objet et un personnage traités vers la même cible sortent avec
#     le même bloc de pixel » ──────────────────────────────────────────────────


def test_un_petit_objet_et_un_personnage_sortent_avec_le_meme_bloc(client, double):
    """Le tonneau était peint sur une grille cinq fois plus grosse que le
    personnage — 20 px de bloc contre 4. C'est exactement l'écart relevé au banc
    du 26 août (16 px contre 8) : le petit objet ressortait plus grossier que le
    personnage qui le porte (US-62)."""
    personnage = _generer(client, double, bloc=4, logique_l=8, logique_h=16)
    tonneau = _generer(client, double, bloc=20, logique_l=12, logique_h=16)

    rendus = []
    for asset in (personnage, tonneau):
        client.put(f"/api/assets/{asset['identifiant']}/recipe", json=DETOURER_ET_REDUIRE)
        rendus.append(_rendu(client, asset["identifiant"]))

    assert bloc_mesure(rendus[0]) == bloc_mesure(rendus[1]) == 1


def test_la_derive_de_grille_est_absorbee_au_pixel_pres(client, double):
    """Le même sujet, peint une fois sur 4 px de bloc et une fois sur 20 :
    les deux rendus sont **le même fichier**. C'est ce que veut dire « la remise
    sur grille traite la dérive comme le cas normal, pas comme un incident »."""
    fin = _generer(client, double, bloc=4, logique_l=8, logique_h=16)
    grossier = _generer(client, double, bloc=20, logique_l=8, logique_h=16)

    rendus = []
    for asset in (fin, grossier):
        client.put(f"/api/assets/{asset['identifiant']}/recipe", json=DETOURER_ET_REDUIRE)
        rendus.append(_rendu(client, asset["identifiant"]))

    assert rendus[0] == rendus[1]


# ── « Chaque réglage répond sans attente perceptible, sans appel réseau et sans
#     solliciter la carte graphique » ───────────────────────────────────────────


def test_chaque_reglage_repond_sans_attente_sans_reseau_et_sans_gpu(client, double):
    """Les trois moitiés du critère, et elles ne se prouvent pas au même endroit.

    *Sans appel réseau* se prouve en comptant les appels du double : ils ne
    bougent pas d'un cran pendant qu'on retouche. *Sans carte graphique* se
    prouve en regardant les modules chargés — aucune bibliothèque d'inférence
    n'est entrée dans le processus. *Sans attente perceptible* se mesure : le
    détourage est gardé d'un réglage à l'autre, donc faire glisser la grille ne
    repaie que la queue de la recette.
    """
    asset = _generer(client, double, bloc=8)
    appels_avant = double.appels

    client.put(f"/api/assets/{asset['identifiant']}/recipe", json=DETOURER_ET_REDUIRE)

    durees = []
    for cible in (16, 24, 32, 48):
        recette = _recette(
            passes=DETOURER_ET_REDUIRE["passes"],
            recadrage=DETOURER_ET_REDUIRE["recadrage"],
            grille={"cible": cible, "occupation": 100, "ancrage": "bas"},
        )
        depart = time.perf_counter()
        reponse = client.put(f"/api/assets/{asset['identifiant']}/recipe", json=recette)
        durees.append(time.perf_counter() - depart)
        assert reponse.json()["rendu_largeur"] == cible

    assert double.appels == appels_avant  # rien n'est parti chez le fournisseur
    assert not [nom for nom in CARTES_GRAPHIQUES if nom in sys.modules]
    # Large exprès : ce n'est pas un banc de performance, c'est un garde-fou
    # contre une régression d'ordre de grandeur — un détourage refait à chaque
    # cran de curseur se verrait immédiatement ici.
    assert max(durees) < 0.5


# ── « L'image brute est toujours conservée, et revenir à elle est un seul
#     geste » ────────────────────────────────────────────────────────────────


def test_le_brut_est_conserve_et_revenir_a_lui_est_un_seul_geste(client, double):
    asset = _generer(client, double, bloc=8)
    brut_avant = _rendu(client, asset["identifiant"], brut=True)

    client.put(f"/api/assets/{asset['identifiant']}/recipe", json=DETOURER_ET_REDUIRE)
    traite = client.get(f"/api/assets/{asset['identifiant']}").json()
    assert traite["traite"] is True
    assert traite["epingle"] is True  # toucher une recette à la main épingle
    assert _rendu(client, asset["identifiant"]) != brut_avant
    # Le brut n'a pas bougé d'un octet pendant qu'on travaillait dessus.
    assert _rendu(client, asset["identifiant"], brut=True) == brut_avant

    revenu = client.post(f"/api/assets/{asset['identifiant']}/reset").json()

    assert revenu["traite"] is False
    assert revenu["epingle"] is False
    assert _rendu(client, asset["identifiant"]) == brut_avant


# ── « Supprimer le fichier de rendu ne perd rien : il se recalcule depuis la
#     recette » ──────────────────────────────────────────────────────────────


def test_le_rendu_supprime_se_recalcule_depuis_la_recette(client, atelier, double):
    asset = _generer(client, double, bloc=8)
    client.put(f"/api/assets/{asset['identifiant']}/recipe", json=DETOURER_ET_REDUIRE)
    avant = _rendu(client, asset["identifiant"])

    # On efface le cache à la main, comme on le ferait dans l'explorateur.
    enregistre = atelier.assets.lire(asset["identifiant"])
    chemin = atelier.fichiers.racine / enregistre.rendu
    assert chemin.is_file()
    chemin.unlink()

    apres = _rendu(client, asset["identifiant"])

    assert apres == avant
    assert chemin.is_file()  # et il est revenu, sans qu'on ait rien demandé


# ── « Une recette nommée, réappliquée ailleurs, donne exactement le même
#     résultat » ─────────────────────────────────────────────────────────────


def test_une_recette_nommee_reappliquee_donne_le_meme_resultat(client, double):
    """« Un preset *est* une recette nommée » — et le nom n'entre pas dans
    l'empreinte, donc deux assets traités par elle sortent identiques."""
    premier = _generer(client, double, bloc=4, logique_l=8, logique_h=16)
    second = _generer(client, double, bloc=20, logique_l=8, logique_h=16)

    enregistrement = client.put("/api/recipes/sprite 16", json=DETOURER_ET_REDUIRE)
    assert enregistrement.status_code == 200, enregistrement.text
    assert "sprite 16" in enregistrement.json()["recettes"]

    client.post(f"/api/assets/{premier['identifiant']}/apply/sprite 16")
    client.post(f"/api/assets/{second['identifiant']}/apply/sprite 16")

    assert _rendu(client, premier["identifiant"]) == _rendu(
        client, second["identifiant"]
    )
    # Et la recette nommée est annoncée à l'écran, qui n'a pas à la deviner.
    assert "sprite 16" in client.get("/api/status").json()["traitement"]["recettes"]


def test_une_recette_nommee_inconnue_est_refusee_en_le_disant(client, double):
    asset = _generer(client, double)
    reponse = client.post(f"/api/assets/{asset['identifiant']}/apply/jamais-posée")
    assert reponse.status_code == 409
    assert reponse.json()["raison"] == "aucune recette nommée « jamais-posée »"


# ── « La quantification s'annonce sans palette, elle ne se grise plus »
#
#    **Renversé en D2.** T2 grisait la quantification tant qu'aucune palette
#    n'existait, et refusait la recette si elle arrivait quand même — en
#    attendant que T4 apporte les artworks. T4 les a apportés, mais le grisé est
#    resté pour les projets qui n'en promeuvent aucun : mesuré le 3 septembre
#    2026, ces projets-là ne réduisaient **aucune** couleur et rendaient des
#    sprites à dix mille teintes, sans un mot à l'écran.
#
#    Ce que le test garde est l'invariant lui-même, appliqué correctement : ce
#    qui est indisponible est annoncé avec sa raison. Rien n'est indisponible
#    ici — il y a seulement quelque chose à dire. ────────────────────────────


def test_la_quantification_s_annonce_sans_palette_au_lieu_de_se_griser(client, double):
    etat = client.get("/api/status").json()["traitement"]["quantification"]
    assert etat["raison"] is None, "réduire à N couleurs sans palette est défini"
    assert "aucun artwork officiel" in etat["note"]

    asset = _generer(client, double)
    reponse = client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json=_recette(quantification={"couleurs": 16, "palette": [], "tramage": "aucun"}),
    )

    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["recette"]["quantification"]["couleurs"] == 16


# ── Les huit réductions sont annoncées avec leur raison de grisé (D2, B18) ───


def test_les_huit_reductions_sont_annoncees_avec_leur_raison(client):
    """Même invariant que les moteurs de détourage : sept méthodes ne
    demandent rien, « traits épaissis » tire une bibliothèque lourde et se
    grise si elle manque — jamais proposée puis refusée.

    ⚠️ **Le compte est passé de quatre à huit en B18** — « Pixéliser, le reste
    des moteurs » (`docs/PLAN-carnet.md` § B18) ajoute `sur_modele`,
    `dominante`, `mediane` et `lumiere_juste` à `METHODES_DE_REDUCTION`. Ce
    test fixait le compte à quatre ; il est réécrit pour dire pourquoi plutôt
    que jeté — même règle que `tests/test_d2.py` applique déjà à trois essais
    de `T2`/`T4` que D2 rendait faux.
    """
    reductions = {
        r["nom"]: r for r in client.get("/api/status").json()["traitement"]["reductions"]
    }
    assert set(reductions) == {
        "vote",
        "pixeloe",
        "lanczos",
        "proche",
        "sur_modele",
        "dominante",
        "mediane",
        "lumiere_juste",
    }
    for nom in ("vote", "lanczos", "proche", "sur_modele", "dominante", "mediane", "lumiere_juste"):
        assert reductions[nom]["raison"] is None, f"« {nom} » ne demande rien"
        assert reductions[nom]["libelle"]


# ── Le moteur de détourage absent est grisé avec sa raison ───────────────────


def test_un_moteur_de_detourage_absent_est_grise_avec_sa_raison(client, double):
    """La nouvelle raison de grisé qu'apporte T2 (`docs/PLAN.md` § Les
    invariants : « étendu à chaque nouvelle raison »). Le moteur par modèle est
    facultatif — il embarque 180 Mo de réseau de neurones — et son absence est
    un fait à afficher, jamais une erreur à découvrir au clic."""
    moteurs = {
        m["nom"]: m["raison"]
        for m in client.get("/api/status").json()["traitement"]["moteurs"]
    }
    assert moteurs["bord"] is None  # celui-là marche toujours, même hors ligne

    if moteurs["modele"] is None:
        return  # `rembg` est installé sur cette machine : rien à griser

    asset = _generer(client, double)
    reponse = client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json=_recette(passes=[{"moteur": "modele"}]),
    )
    assert reponse.status_code == 409
    assert reponse.json()["raison"] == f"passe 1 : {moteurs['modele']}"


# ── « Un détourage qui a mangé le sujet se voit immédiatement et se reprend
#     avec d'autres réglages, sans repayer » ────────────────────────────────


def test_un_detourage_qui_mange_le_sujet_se_voit_et_se_reprend_sans_repayer(
    client, double
):
    asset = _generer(client, double, bloc=8)
    appels_avant = double.appels

    trop = client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json=_recette(passes=[{"moteur": "bord", "tolerance": 255}]),
    )
    assert trop.status_code == 200  # ça se **voit**, ça ne se refuse pas
    assert _opaques(_rendu(client, asset["identifiant"])) == 0

    repris = client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json=_recette(passes=[{"moteur": "bord", "tolerance": 28}]),
    )
    assert repris.status_code == 200
    assert _opaques(_rendu(client, asset["identifiant"])) > 0
    assert double.appels == appels_avant  # et rien n'a été repayé


def test_le_trou_du_sujet_survit_au_detourage(client, double):
    """Un pixel de la couleur du fond, **à l'intérieur** du sujet, reste opaque.

    C'est la propriété qui distingue un remplissage depuis le bord d'un seuil
    global, et elle n'est pas théorique : c'est elle qui sauve un squelette
    blanc sur fond gris clair et le reflet d'une fiole. Vérifié sur douze images
    réelles le 27 août 2026, et tenu ici à chaque exécution.
    """
    asset = _generer(client, double, bloc=8, logique_l=8, logique_h=16)
    client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json=_recette(passes=[{"moteur": "bord", "tolerance": 28}]),
    )

    with Image.open(io.BytesIO(_rendu(client, asset["identifiant"]))) as image:
        rgba = image.convert("RGBA")
    # Le trou est au centre du sujet, qui est posé en bas de la toile de 24×24
    # cellules logiques de 8 px. Sa cellule doit être **opaque**.
    x = ((24 - 8) // 2 + 8 // 2) * 8 + 4
    y = (24 - 16 - 1 + 16 // 2) * 8 + 4
    assert rgba.getpixel((x, y))[3] == 255


# ── « Plusieurs passes de détourage s'enchaînent, seuil et durcissement
#     réglables à chacune » ───────────────────────────────────────────────────


def test_plusieurs_passes_s_enchainent_avec_leurs_propres_reglages(client, double):
    """Une seconde passe travaille sur ce que la première a laissé : l'alpha ne
    peut que se serrer, jamais se rendre. Le durcissement de la seconde ronge
    donc un bord déjà posé — et le sujet s'amaigrit, il ne repousse pas."""
    asset = _generer(client, double, bloc=8)

    client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json=_recette(passes=[{"moteur": "bord", "tolerance": 28, "durcissement": 0}]),
    )
    une_passe = _opaques(_rendu(client, asset["identifiant"]))

    client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json=_recette(
            passes=[
                {"moteur": "bord", "tolerance": 28, "durcissement": 0},
                {"moteur": "bord", "tolerance": 28, "durcissement": 3},
            ]
        ),
    )
    deux_passes = _opaques(_rendu(client, asset["identifiant"]))

    assert 0 < deux_passes < une_passe


def test_un_reglage_hors_bornes_est_refuse_en_le_nommant(client, double):
    """Rien n'est ramené en silence vers la borne la plus proche : un sprite
    d'une autre taille que celle inscrite dans la recette serait invisible.
    Leçon de `MySpriteAi/src/lib/renderSettings.ts`."""
    asset = _generer(client, double)
    reponse = client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json=_recette(passes=[{"moteur": "inventé"}]),
    )
    assert reponse.status_code == 409
    assert reponse.json()["raison"] == "passe 1 : moteur inconnu « inventé »"


# ── La recette est une vérité du disque, pas de la base ──────────────────────


def test_la_recette_est_ecrite_a_cote_de_l_image(client, atelier, double):
    """« Les fichiers font foi, la base est un index reconstructible. »
    L'invariant n'entre en vigueur qu'en T3, mais une recette perdue avec la
    base coûterait tout le travail de retouche — donc il se paie ici."""
    asset = _generer(client, double, bloc=8)
    client.put(f"/api/assets/{asset['identifiant']}/recipe", json=DETOURER_ET_REDUIRE)

    dossier = atelier.fichiers.generations / asset["generation"]
    ecrit = (dossier / "0-asset.json").read_text(encoding="utf-8")

    assert '"cible": 16' in ecrit
    assert '"moteur": "bord"' in ecrit


def test_l_empreinte_ne_depend_pas_du_nom(client):
    """Deux recettes identiques rendent le même fichier, qu'elles portent un nom
    ou pas — c'est ce qui fait qu'une recette nommée n'est rien d'autre qu'une
    recette."""
    nue = Recette(passes=(Passe(),))
    nommee = Recette(passes=(Passe(),), nom="sprite 16")
    assert nue.empreinte() == nommee.empreinte()
