"""TU2 — un jeu de tuiles est une recette ; l'atlas en est le résultat, figé en asset.

Deux moitiés. La première prouve que la table des masques portée en Python
(`atelier/domaine/masques_tuiles.py`) est celle de sc-clone, case par case : la fixture
`tests/fixtures/tu2_masques_reference_scclone.json` est la sortie de
`essais/tu2_masques_scclone.mjs`, qui importe les modules de sc-clone eux-mêmes. La
seconde fait vivre un jeu fabriqué comme un jeu d'AU13 : créé, relu, réglé, restauré.
"""
import base64
import copy
import io
import json
from pathlib import Path

import httpx
import pytest
from PIL import Image

from atelier.api.app import creer_application
from atelier.domaine import masques_tuiles as M
from atelier.domaine.plan import SANS_POSES, plan_du_type
from atelier.domaine.projet import BAREME_PAR_DEFAUT, DECORS, Univers
from atelier.domaine.recette_tuiles import MATIERES_INTEGREES
from atelier.domaine.tuiles import RACCORDS, TuilesRefusees
from atelier.services import Atelier
from atelier.services.export_tuiles import VOISINS
from atelier.services.tuiles import png
from tests.test_au12 import fixe  # noqa: F401

REFERENCE = json.loads((Path(__file__).parent / "fixtures" / "tu2_masques_reference_scclone.json").read_text(encoding="utf-8"))
TYPES = {"sol": "blob-47", "chemin": "edge-16", "mur": "wall", "coins-15": "topdown-15", "pieces-17": "topdown-17"}


# ── La table est celle de sc-clone ───────────────────────────────────────────

def test_la_fixture_vient_du_commit_de_sc_clone_recopie():
    assert REFERENCE["provenance"]["commit"] == "f27f054"


@pytest.mark.parametrize("jeu", ["W16", "B47", "E16"])
def test_chaque_case_porte_le_masque_et_les_bits_godot_de_sc_clone(jeu):
    ref = REFERENCE["jeux"][jeu]
    assert M.dimensions_du_jeu(jeu) == (ref["colonnes"], ref["lignes"])
    assert M.mode_godot(jeu) == ref["mode"]
    # L'ordre des bits est celui de TileSet.CellNeighbor : c'est l'ordre d'écriture.
    assert [list(b) for b in M._BITS_GODOT[jeu]] == ref["bits"]
    vues = set()
    for case in ref["cases"]:
        assert M.masque_a(jeu, case["x"], case["y"]) == case["masque"], case
        godot = M.bits_godot(jeu, case["masque"])
        assert list(godot) == list(case["godot"]) and godot == case["godot"], case
        vues.add((case["x"], case["y"]))
    vides = {(x, y) for x in range(ref["colonnes"]) for y in range(ref["lignes"])} - vues
    assert vides == {tuple(v) for v in ref["vides"]}
    assert all(M.masque_a(jeu, x, y) is None for x, y in vides)


def test_dispositions_case_dessous_et_dix_sept_pieces():
    for sorte, type_moteur in TYPES.items():
        ref = REFERENCE["dispositions"][type_moteur]
        forme = M.disposition(sorte)
        assert (forme["colonnes"], forme["lignes"]) == (ref["colonnes"], ref["lignes"])
        assert M.jeu_de(sorte) == ref["jeu"]
    assert M.CASE_DESSOUS_BLOB == (REFERENCE["blob_dessous"]["x"], REFERENCE["blob_dessous"]["y"])
    assert M.PIECES_17_VIDES == {tuple(v) for v in REFERENCE["pieces17_vides"]}


@pytest.mark.parametrize("decor", ["aucun", "leger", "dense"])
def test_les_cases_du_mur_sont_celles_de_wall_atlas_descriptor(decor):
    ref = REFERENCE["mur"][decor]
    assert M.disposition("mur", decor=decor)["lignes"] == ref["lignes"]
    assert M.cases_du_mur(decor) == ref["cases"]


def test_formes_et_extras_de_l_atlas_pour_chaque_combinaison():
    for f in REFERENCE["formes"]:
        d = M.disposition(f["sorte"], f["variantes"], f["animation"], f["animationAtlas"], f["decor"])
        assert (d["colonnes"], d["lignes"]) == (f["colonnes"], f["lignes"]), f
    for e in REFERENCE["extras"]:
        d = M.disposition(e["sorte"], e["variantes"], e["animation"], e["animationAtlas"], e["decor"])
        assert d["variantes"] == e["variantes_cases"], e
        assert [list(i) for i in d["images"]] == e["images"], e
        assert d["copies"] == e["copies"], e
        assert d["decor"] == e["decor_cases"], e


def test_les_treize_matieres_integrees():
    assert MATIERES_INTEGREES == {m["id"]: m["nom"] for m in REFERENCE["matieres"]}


@pytest.mark.parametrize("jeu", ["W16", "B47", "E16"])
def test_raccords_traduits_pour_la_livraison_sans_retraduction(jeu):
    """Bit posé → surface ; absent → dessous, ou rien ; voisin hors du jeu → rien.

    Lu à travers VOISINS de l'export AU13 : un raccord de l'atelier redonne exactement le
    bit Godot de sc-clone, donc TU4 n'a rien à retraduire.
    """
    for case in REFERENCE["jeux"][jeu]["cases"]:
        for dessous in (None, "dessous"):
            r = M.raccords(jeu, case["masque"], "surface", dessous)
            assert list(r) == list(RACCORDS) or set(r) == set(RACCORDS)
            for raccord, prop in VOISINS.items():
                if prop not in case["godot"]:
                    assert r[raccord] is None
                else:
                    assert r[raccord] == ("surface" if case["godot"][prop] == 0 else dessous), (case, raccord)


# ── La nature « matière » ────────────────────────────────────────────────────

def test_la_matiere_est_un_decor_sans_detourage_ni_poses():
    matiere = next(e for e in BAREME_PAR_DEFAUT if e.nom == "matière")
    assert matiere.famille == DECORS and matiere.silhouette is False
    assert plan_du_type("matière") == () and "matière" in SANS_POSES


def test_un_projet_ecrit_avant_la_matiere_la_recoit_a_la_relecture():
    """Le trou trouvé le 19 septembre 2026 sur `la-foret-magique` : son barème, écrit
    avant TU2, n'avait pas « matière ». L'échelle restant introuvable, `recette_de`
    retombait sur `silhouette=True` et chaque matière générée arrivait **détourée et
    recadrée** comme un personnage. Le barème relu se complète désormais."""
    avant = [e.en_json() for e in BAREME_PAR_DEFAUT if e.nom != "matière"]
    univers = Univers.depuis_json({"bareme": avant, "cible_px": 96})

    matiere = univers.echelle("matière")
    assert matiere is not None and matiere.silhouette is False
    recette = univers.recette_de(matiere)
    assert recette.passes == () and recette.recadrage is None
    # Ce qui reste, et que l'auteur veut : la pixelisation et les couleurs.
    assert recette.grille is not None and recette.quantification is not None


def test_le_completement_ne_retouche_jamais_une_nature_deja_ecrite():
    """Ce qui est au fichier passe devant : seuls les noms absents s'ajoutent."""
    a_la_main = [{"nom": "matière", "famille": DECORS, "occupation": 50, "silhouette": True}]
    univers = Univers.depuis_json({"bareme": a_la_main})

    matiere = univers.echelle("matière")
    assert matiere is not None and matiere.occupation == 50 and matiere.silhouette is True
    # …et le reste du barème par défaut est venu compléter, sans doublon.
    noms = [e.nom for e in univers.bareme]
    assert noms[0] == "matière" and len(noms) == len(set(noms)) == len(BAREME_PAR_DEFAUT)


# ── Un jeu fabriqué vit comme un jeu d'AU13 ──────────────────────────────────

def atlas(colonnes, lignes, taille, couleur=(90, 140, 60, 255)):
    image = Image.new("RGBA", (colonnes * taille, lignes * taille), couleur)
    image.putpixel((0, 0), (0, 0, 0, 0))
    return png(image)


def recette(**r):
    return {"sorte": "sol", "taille": 32, "graine": 31415,
            "emplacements": {"surface": {"source": "integree", "nom": "herbe"}}, "reglages": {"arrondi": 3}, **r}


def sol(a, p, **brut):
    return a.tuiles.creer(p, {"nom": "Herbe et terre", "recette": recette(), "atlas": atlas(8, 6, 32), **brut})


async def test_un_sol_se_cree_se_relit_et_ses_raccords_viennent_du_masque(fixe, double):
    a, p, _ = fixe
    e = sol(a, p)
    assert e["revision"] == 1 and e["recette"]["sorte"] == "sol"
    assert e["recette"]["emplacements"]["bordure"] == {"source": "integree", "nom": "herbe", "lie": True}
    assert e["recette"]["reglages"]["arrondi"] == 3 and e["recette"]["reglages"]["nuances"] == 4
    assert "hauteurMur" not in e["recette"]["reglages"]
    assert e["grille"] == {"taille": 32, "marge": 0, "espacement": 0, "colonnes": 8, "lignes": 6}
    assert e["terrains"] == [{"identifiant": "surface", "nom": "Herbe", "couleur": "#92af70"}]
    # 47 pièces, toutes retenues ; la 48e case, vide sans second terrain, n'en est pas une.
    assert len(e["cellules"]) == 47 == e["retenues"]
    assert (7, 5) not in {(c["x"], c["y"]) for c in e["cellules"]}
    par_xy = {(c["x"], c["y"]): c for c in e["cellules"]}
    assert par_xy[(0, 0)]["raccords"] == dict.fromkeys(RACCORDS)  # masque 0 : l'îlot
    plein = par_xy[M.position_du_masque("B47", 255)]
    assert plein["terrain"] == "surface" and set(plein["raccords"].values()) == {"surface"}
    # L'atlas est figé en asset du jeu, avec sa filiation vers le jeu de tuiles.
    asset = a.assets.lire(e["source"]["asset"])
    assert asset.projet == p and (asset.largeur, asset.hauteur) == (256, 192)
    generation = a.generations.lire(asset.generation)
    assert generation.demande["filiation"] == {"tuiles": e["identifiant"], "revision": 1, "atlas": True}
    # Relu par un autre atelier, sur le disque.
    autre = Atelier(racine=a.fichiers.racine, fabrique_fournisseur=lambda: double)
    autre.bibliotheque.ouvrir()
    relu = autre.tuiles.lire(p, e["identifiant"])
    assert relu["recette"] == e["recette"] and relu["cellules"] == e["cellules"] and relu["pieces"] == e["pieces"]
    with Image.open(io.BytesIO(autre.tuiles.apercu(p, e["identifiant"]))) as image:
        assert image.size == (256, 192) and image.getpixel((0, 0))[3] == 0 and image.getpixel((1, 0)) == (90, 140, 60, 255)
    assert double.appels == 0


async def test_une_recette_en_96_px_est_acceptee_et_l_atlas_garde_sa_taille_exacte(fixe):
    """TU-défaut (19 septembre 2026) : la case du jeu de l'auteur est à 96 px — hors de
    l'ancienne liste 16/32/64, recopiée de sc-clone. La recette l'accepte, et l'atlas figé
    en asset garde la taille exacte attendue (8 × 6 cases de 96 px), pas une valeur voisine."""
    a, p, _ = fixe
    e = a.tuiles.creer(p, {"nom": "Dalles", "recette": recette(taille=96), "atlas": atlas(8, 6, 96)})
    assert e["recette"]["taille"] == 96
    assert e["grille"] == {"taille": 96, "marge": 0, "espacement": 0, "colonnes": 8, "lignes": 6}
    asset = a.assets.lire(e["source"]["asset"])
    assert (asset.largeur, asset.hauteur) == (8 * 96, 6 * 96)
    with pytest.raises(TuilesRefusees, match="768 × 576"):
        a.tuiles.creer(p, {"nom": "X", "recette": recette(taille=96), "atlas": atlas(8, 6, 32)})


async def test_second_terrain_la_case_tout_dessous_et_l_ordre_des_terrains(fixe):
    a, p, _ = fixe
    r = recette(reglages={"secondTerrain": True},
                emplacements={"surface": {"source": "integree", "nom": "herbe"}, "bas": {"source": "integree", "nom": "sable"}})
    e = a.tuiles.creer(p, {"nom": "Plage", "recette": r, "atlas": atlas(8, 6, 32)})
    assert [t["identifiant"] for t in e["terrains"]] == ["dessous", "surface"]
    assert e["terrains"][0]["nom"] == "Sable"
    assert e["recette"]["emplacements"]["bordureBas"] == {"source": "integree", "nom": "sable", "lie": True}
    par_xy = {(c["x"], c["y"]): c for c in e["cellules"]}
    assert len(par_xy) == 48
    assert par_xy[(7, 5)]["terrain"] == "dessous" and set(par_xy[(7, 5)]["raccords"].values()) == {"dessous"}
    assert set(par_xy[(0, 0)]["raccords"].values()) == {"dessous"} and par_xy[(0, 0)]["terrain"] == "surface"


async def test_palette_commune_par_defaut_et_palette_du_jeu_reglable(fixe):
    """TU6 — deux réglages nouveaux : « mêmes couleurs » cochée par défaut, « palette du
    jeu » décochée par défaut. Le serveur ne connaît que le booléen ; c'est l'écran qui
    sait si l'univers a une palette à désigner."""
    a, p, _ = fixe
    e = sol(a, p)
    assert e["recette"]["reglages"]["memesCouleurs"] is True
    assert e["recette"]["reglages"]["paletteJeu"] is False
    e2 = a.tuiles.creer(p, {"nom": "Sans palette", "recette": recette(reglages={"memesCouleurs": False, "paletteJeu": True}), "atlas": atlas(8, 6, 32)})
    assert e2["recette"]["reglages"]["memesCouleurs"] is False
    assert e2["recette"]["reglages"]["paletteJeu"] is True


async def test_mur_chemin_et_extras(fixe):
    a, p, _ = fixe
    mur = a.tuiles.creer(p, {"nom": "Rempart", "atlas": atlas(8, 11, 16),
                             "recette": recette(sorte="mur", taille=16, reglages={"hauteurMur": 3},
                                                emplacements={"surface": {"source": "integree", "nom": "pierre"},
                                                              "face": {"source": "integree", "nom": "brique"}})})
    roles = [pc["role"] for pc in mur["pieces"]]
    assert roles.count("dessus") == 47 and roles.count("bande") == 18 and roles.count("biais") == 16
    par_xy = {(c["x"], c["y"]): c for c in mur["cellules"]}
    assert (4, 6) not in par_xy  # un flanc à 45° : peint, jamais exporté (sc-clone T27)
    assert par_xy[(0, 6)]["terrain"] is None and par_xy[(0, 0)]["terrain"] == "surface"
    # Un chemin, avec variantes et animation : les images ne sont pas des pièces.
    forme = M.disposition("chemin", 2, 4, decor="leger")
    chemin = a.tuiles.creer(p, {"nom": "Sentier", "atlas": atlas(forme["colonnes"], forme["lignes"], 16),
                                "recette": recette(sorte="chemin", taille=16, reglages={"variantes": 2, "animation": 4, "decor": "leger"})})
    roles = [pc["role"] for pc in chemin["pieces"]]
    assert roles.count("masque") == 16 and roles.count("variante") == 2 and roles.count("decor") == 12
    xy = {(c["x"], c["y"]) for c in chemin["cellules"]}
    assert not xy & set(forme["images"])
    plein = {(c["x"], c["y"]): c for c in chemin["cellules"]}[M.position_du_masque("E16", 15)]
    variante = {(c["x"], c["y"]): c for c in chemin["cellules"]}[(0, 4)]
    assert variante["raccords"] == plein["raccords"]
    assert plein["raccords"]["nord-est"] is None and plein["raccords"]["nord"] == "surface"  # Match Sides
    # Le 17 pièces : sans terrain.
    dix_sept = a.tuiles.creer(p, {"nom": "Pièces", "atlas": atlas(5, 5, 16), "recette": recette(sorte="pieces-17", taille=16)})
    assert dix_sept["terrains"] == [] and len(dix_sept["cellules"]) == 17
    # Sans carte à peindre (l'écran n'en a pas pour elles), la carte livrée range les
    # 17 pièces comme sur la planche : sinon le jeu ne serait jamais livrable (TU11).
    assert {(c["x"], c["y"]) for c in dix_sept["carte"]["cases"]} == {(c["x"], c["y"]) for c in dix_sept["cellules"]}
    assert dix_sept["diagnostic"]["pret"]
    vide = a.tuiles.regler(p, dix_sept["identifiant"], 1, {"carte": {"largeur": 18, "hauteur": 12, "cases": []}})
    assert len(vide["carte"]["cases"]) == 17 and vide["diagnostic"]["pret"]


@pytest.mark.parametrize("modif, message", [
    ({"sorte": "iso"}, "sorte"),
    ({"taille": 20}, "8, 16, 24, 32, 48, 64, 96 ou 128"),
    ({"taille": True}, "8, 16, 24, 32, 48, 64, 96 ou 128"),
    ({"taille": 256}, "trop lourde"),
    ({"taille": 512}, "trop lourde"),
    ({"graine": "1"}, "graine"),
    ({"reglages": {"flou": 1}}, "flou"),
    ({"reglages": {"arrondi": 9}}, "0 à 8"),
    ({"reglages": {"nuances": 3}}, "nuances"),
    ({"reglages": {"hauteurMur": 2}}, "ne s’applique pas"),
    ({"reglages": {"animation": 2, "animationAtlas": 2}}, "pas les deux"),
    ({"reglages": {"memesCouleurs": "oui"}}, "coche ou se décoche"),
    ({"reglages": {"paletteJeu": 1}}, "coche ou se décoche"),
    ({"emplacements": {"surface": {"source": "integree", "nom": "marbre"}}}, "marbre"),
    ({"emplacements": {"surface": {"source": "asset", "asset": "introuvable"}}}, "introuvable"),
    ({"emplacements": {"face": {"source": "vide"}}}, "face du mur"),
    ({"emplacements": {"surface": {"source": "integree", "nom": "herbe"}, "bordure": {"source": "integree", "nom": "sable"}}}, "déliez"),
    ({"inconnu": 1}, "recette contient"),
])
async def test_recette_refusee_en_clair(fixe, modif, message):
    a, p, _ = fixe
    with pytest.raises(TuilesRefusees, match=message):
        a.tuiles.creer(p, {"nom": "X", "recette": {**recette(), **modif}, "atlas": atlas(8, 6, 32)})
    assert a.tuiles.lister(p) == []


async def test_atlas_de_la_mauvaise_taille_refuse_et_bordure_deliee(fixe):
    a, p, _ = fixe
    with pytest.raises(TuilesRefusees, match="256 × 192"):
        a.tuiles.creer(p, {"nom": "X", "recette": recette(), "atlas": atlas(8, 6, 16)})
    with pytest.raises(TuilesRefusees, match="base64"):
        a.tuiles.creer(p, {"nom": "X", "recette": recette(), "atlas": "pas du base64 !"})
    image = a.generations.importer(atlas(1, 1, 32), "Ma matière", projet=p)["asset"]["identifiant"]
    with pytest.raises(TuilesRefusees, match="délie sa bordure"):
        a.tuiles.creer(p, {"nom": "X", "recette": recette(emplacements={"surface": {"source": "asset", "asset": image}}), "atlas": atlas(8, 6, 32)})
    e = a.tuiles.creer(p, {"nom": "X", "atlas": base64.b64encode(atlas(8, 6, 32)).decode(), "recette": recette(emplacements={
        "surface": {"source": "asset", "asset": image}, "bordure": {"source": "integree", "nom": "terre", "lie": False}})})
    assert e["recette"]["emplacements"] == {"surface": {"source": "asset", "asset": image},
                                            "bordure": {"source": "integree", "nom": "terre", "lie": False}}
    assert e["terrains"][0]["nom"] == "Surface"


async def test_regler_restaurer_et_changer_de_recette(fixe):
    a, p, _ = fixe
    e = sol(a, p)
    ident = e["identifiant"]
    # Nom et carte se règlent ; la réponse garde la recette.
    carte = {"largeur": 4, "hauteur": 3, "cases": [{"x": 0, "y": 0, "tuile_x": 0, "tuile_y": 0}, {"x": 1, "y": 0, "tuile_x": 7, "tuile_y": 0}]}
    e2 = a.tuiles.regler(p, ident, 1, {"nom": "Prairie", "carte": carte})
    assert e2["revision"] == 2 and e2["nom"] == "Prairie" and e2["carte"] == carte and e2["recette"] == e["recette"]
    # Relu tel quel (comme le fait l'agent) : accepté ; un raccord touché : refusé.
    complet = copy.deepcopy({k: e2[k] for k in ("nom", "terrains", "cellules", "carte")})
    complet["cellules"][0]["nom"] = "L’îlot"
    e3 = a.tuiles.regler(p, ident, 2, complet)
    assert e3["cellules"][0]["nom"] == "L’îlot"
    touche = copy.deepcopy(complet); touche["cellules"][0]["raccords"]["nord"] = "surface"
    with pytest.raises(TuilesRefusees, match="se déduisent de sa recette"):
        a.tuiles.regler(p, ident, 3, touche)
    retiree = copy.deepcopy(complet); retiree["cellules"][1]["retenue"] = False
    with pytest.raises(TuilesRefusees, match="se déduisent"):
        a.tuiles.regler(p, ident, 3, retiree)
    with pytest.raises(TuilesRefusees, match="se déduisent"):
        a.tuiles.regler(p, ident, 3, {**complet, "terrains": []})
    with pytest.raises(TuilesRefusees, match="autre fenêtre"):
        a.tuiles.regler(p, ident, 2, {"nom": "Tard"})
    with pytest.raises(TuilesRefusees, match="demande l’atlas"):
        a.tuiles.regler(p, ident, 3, {}, recette=recette(graine=7))
    with pytest.raises(TuilesRefusees, match="avec la recette"):
        a.tuiles.regler(p, ident, 3, {}, atlas=atlas(8, 6, 32))
    with pytest.raises(TuilesRefusees, match="vient de sa recette"):
        a.tuiles.regler(p, ident, 3, {}, actualiser_source=True)
    # Nouvelle recette, nouvel atlas : un chemin en 16 px.
    e4 = a.tuiles.regler(p, ident, 3, {}, recette=recette(sorte="chemin", taille=16), atlas=atlas(4, 4, 16, (200, 180, 120, 255)))
    assert e4["revision"] == 4 and e4["recette"]["sorte"] == "chemin" and len(e4["cellules"]) == 16
    assert e4["source"]["asset"] != e["source"]["asset"]
    # La carte garde les pièces qui existent encore : (0, 0) oui, (7, 0) non.
    assert e4["carte"]["cases"] == [{"x": 0, "y": 0, "tuile_x": 0, "tuile_y": 0}]
    # L'ancien atlas reste lisible par révision.
    with Image.open(io.BytesIO(a.tuiles.apercu(p, ident, revision=1))) as ancien:
        assert ancien.size == (256, 192)
    assert a.tuiles.lire(p, ident, 1)["recette"]["sorte"] == "sol"
    # Restaurer la révision 1 la rend courante, recette et atlas compris.
    e5 = a.tuiles.restaurer(p, ident, 4, 1)
    assert e5["revision"] == 5 and e5["recette"] == e["recette"] and e5["source"] == e["source"]
    assert e5["historique"] == [1, 2, 3, 4, 5]


async def test_un_jeu_a_partir_d_une_image_ne_prend_pas_de_recette(fixe):
    from tests.test_au13 import ensemble
    a, p, _ = fixe
    e = ensemble(a, p)
    assert "recette" not in e
    with pytest.raises(TuilesRefusees, match="n’a pas de recette"):
        a.tuiles.regler(p, e["identifiant"], 1, {"nom": "X", "cellules": e["cellules"]}, recette=recette(), atlas=atlas(8, 6, 32))


async def test_http_creer_regler_et_refus_409(fixe):
    a, p, _ = fixe
    app = creer_application(a)
    b64 = lambda octets: base64.b64encode(octets).decode()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://127.0.0.1:8420") as client:
        base = f"/api/projects/{p}/tilesets"
        cree = await client.post(base, json={"nom": "Sol", "recette": recette(), "atlas": b64(atlas(8, 6, 32))})
        assert cree.status_code == 201, cree.text
        ident = cree.json()["identifiant"]
        refus = await client.post(base, json={"nom": "Sol", "recette": recette(taille=20), "atlas": b64(atlas(8, 6, 32))})
        assert refus.status_code == 409 and "8, 16, 24, 32, 48, 64, 96 ou 128" in refus.text
        refus_lourd = await client.post(base, json={"nom": "Sol", "recette": recette(taille=256), "atlas": b64(atlas(8, 6, 256))})
        assert refus_lourd.status_code == 409 and "trop lourde" in refus_lourd.text
        change = await client.put(f"{base}/{ident}", json={"revision": 1, "recette": recette(graine=2), "atlas": b64(atlas(8, 6, 32))})
        assert change.status_code == 200, change.text
        assert change.json()["revision"] == 2 and change.json()["recette"]["graine"] == 2
        nom = await client.put(f"{base}/{ident}", json={"revision": 2, "regles": {"nom": "Sol clair"}})
        assert nom.status_code == 200 and nom.json()["nom"] == "Sol clair"
        mauvais = await client.put(f"{base}/{ident}", json={"revision": 3, "recette": recette(), "atlas": b64(atlas(4, 4, 32))})
        assert mauvais.status_code == 409 and "256 × 192" in mauvais.text
        assert (await client.get(f"{base}/{ident}?revision=1")).json()["recette"]["graine"] == 31415
