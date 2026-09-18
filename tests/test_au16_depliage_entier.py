"""AU16, 18 septembre 2026 : le retour d'une fabrication d'équipement n'est plus coupé au corps.

Relevé sur le serveur de l'auteur : cinq fabrications de Champy (repos · est +
bâton) sont revenues avec le bâton entier et du vide autour, et la variante
créée le coupait net au bord droit — le dépliage recadrait chaque case sur le
rectangle où le corps avait été posé, avant toute lecture. Maintenant la case
entière passe par le chemin de l'association à la main : recette de la pose,
`ramener_sur`, écrin qui grandit. Et ce qui a déjà été coupé se relit depuis la
planche revenue, sans rappeler le fournisseur.

Le décor est celui de `test_au15_ecrin` : une pose recadrée à marge nulle, un
bâton tenu **à droite du corps**, entièrement hors de sa boîte. Le double du
fournisseur rend la planche qu'il a reçue, avec le bâton peint à côté de chaque
corps, dans sa case.
"""
from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image

from atelier.domaine.pliage import Pliage
from atelier.domaine.travail import TravailRefuse
from atelier.image.calque import avec_alpha, cases_de, place_de, recadrer_sur
from atelier.image.calques_cibles import png, rgba
from atelier.image.pliage import COTE, FOND
from tests.test_au15_ecrin import BATON, GEMME, decor, image_equipee, jaunes  # noqa: F401 — fixture commune

ROSE, CYAN = (230, 60, 230), (40, 230, 230)


def couleur(pixels: np.ndarray, teinte) -> np.ndarray:
    return (pixels[:, :, 3] >= 128) & (np.abs(pixels[:, :, :3].astype(int) - teinte).max(axis=2) < 40)


def demande(cibles, **options):
    return {"cle": "baton-" + "-".join(c["resultat"][-6:] for c in cibles), "modele": "essai:rend-du-png",
            "reservation_par_appel_usd": .12, "cibles": cibles, **options}


def peindre_les_batons(planche: bytes, geometrie, teintes) -> bytes:
    """La planche reçue, et dans chaque case un bâton à droite du corps — hors de sa boîte.

    Le corps de la pose fait dix blocs de large (blocs 1 à 11 de `peint`) ; le
    bâton occupe les blocs 12 et 13, du bloc 4 au bloc 22 en hauteur, comme dans
    `test_au15_ecrin`. `None` : cette case revient telle qu'elle est partie.
    """
    pixels = np.array(Image.open(io.BytesIO(planche)).convert("RGB"))
    for (x0, y0, x1, y1), teinte in zip(cases_de(pixels.shape[1], pixels.shape[0], geometrie), teintes):
        if teinte is None:
            continue
        case = pixels[y0:y1 + 1, x0:x1 + 1]
        corps = np.abs(case.astype(int) - FOND).max(axis=2) > 10
        colonnes, lignes = np.flatnonzero(corps.any(axis=0)), np.flatnonzero(corps.any(axis=1))
        gauche, haut = int(colonnes[0]), int(lignes[0])
        bloc = (int(colonnes[-1]) + 1 - gauche) // 10
        assert gauche + 13 * bloc < case.shape[1], "le bâton reste dans sa case"
        case[haut + 4 * bloc:haut + 22 * bloc, gauche + 11 * bloc:gauche + 13 * bloc] = teinte
    return png(pixels)


async def fabriquer(atelier, double, chemin, cibles, teintes, **options):
    t = await atelier.travaux_equipement.preparer(*chemin, demande(cibles, **options))
    geometrie = Pliage.depuis_json(t["appels"][0]["pliage"]).geometrie
    double.repondre = lambda d: peindre_les_batons(d.references[0], geometrie, teintes)
    await atelier.travaux.demarrer(chemin[0], t["identifiant"])
    await atelier.travaux.attendre_tout()
    final = atelier.travaux_equipement.lire(chemin[0], t["identifiant"])
    assert final["etat"] == "termine", final.get("raison", final["appels"])
    return final


def pose_de(atelier, identifiant) -> np.ndarray:
    return rgba(atelier.assets.octets(atelier.assets.lire(identifiant))[0])


@pytest.mark.asyncio
async def test_le_baton_qui_sort_du_corps_revient_entier_dans_un_ecrin_agrandi(decor, atelier, double):
    svc, chemin, p, poses = decor
    pose = pose_de(atelier, poses["est"])
    assert pose.shape[:2] == (48, 20)
    final = await fabriquer(atelier, double, chemin, [{"nature": "image", "resultat": poses["est"]}], [BATON])
    assert double.appels == 1

    v = svc.lire(*chemin, final["variantes"][0])
    assert v["etat"] == "a-extraire" and v["planche_d_origine"]
    # Le chemin de l'association à la main : recette de la pose, échelle, écrin.
    assert v["preparation"]["recette"] == "pose" and v["preparation"]["echelle"]
    assert v["preparation"]["agrandi"]["apres"] == {"largeur": 32, "hauteur": 48}
    assert v["calque_cadre"] == v["base"]["cadre"] == {"largeur": 32, "hauteur": 48}
    assert svc.ecrin(chemin[0], p)["images"]["largeur"] == 32

    # Le bâton entier — deux blocs sur dix-huit, à l'échelle de la pose — hors du cadre d'avant.
    lue = rgba(svc.apercu(*chemin, v["identifiant"], "source"))
    assert jaunes(lue).sum() == 4 * 36
    assert jaunes(lue)[:, 26:].sum() == 4 * 36
    # Le corps n'a pas bougé par rapport au repère : au milieu, au sol.
    base = rgba(svc.apercu(*chemin, v["identifiant"], "base"))
    assert np.array_equal(base[:, 6:26], pose)
    assert v["base"]["repere"] == {"x": 16, "y": 48}

    # L'image rangée en bibliothèque est la case entière, telle que le modèle l'a rendue.
    source = atelier.assets.lire(v["source"])
    assert (source.largeur, source.hauteur) == (COTE, COTE)
    fiche = atelier.travaux_equipement._brut(chemin[0], final["identifiant"])["cibles"][0]
    assert fiche["case"] == fiche["source"] == v["source"]
    assert fiche["recalage"]["debord"]["droite"] > 0


@pytest.mark.asyncio
async def test_une_planche_de_quatre_cases_chaque_case_ne_prend_que_la_sienne(decor, atelier, client, double, tmp_path):
    svc, chemin, p, poses = decor
    # Deux directions de plus, la même pose : quatre cibles pour une planche de 2 × 2.
    for nom in ("Nord", "Ouest"):
        assert client.post("/api/characters/directions", json={"nom": nom}).status_code == 201
    from atelier.domaine.recette import Recette
    from tests.test_au15_ecrin import RECETTE_DE_LA_POSE, importer, peint
    for direction in ("nord", "ouest"):
        pose = importer(client, tmp_path, peint(2, 64, gauche=8, haut=6, baton=False), f"repos-{direction}")
        assert client.put(f"/api/assets/{pose}/character", json={"personnage": p, "pose": "repos", "direction": direction}).status_code == 200
        atelier.assets.poser_recette(pose, Recette.depuis_json(RECETTE_DE_LA_POSE))
        poses[direction] = pose
    ordre = ("est", "sud", "nord", "ouest")
    teintes = (BATON, GEMME, ROSE, CYAN)
    cibles = [{"nature": "image", "resultat": poses[d]} for d in ordre]
    final = await fabriquer(atelier, double, chemin, cibles, teintes, cases_par_planche=4)
    assert double.appels == 1 and len(final["appels"]) == 1

    t = atelier.travaux_equipement._brut(chemin[0], final["identifiant"])
    for rang, teinte in enumerate(teintes):
        v = svc.lire(*chemin, t["cibles"][rang]["variante"])
        # Le premier retour agrandit l'écrin ; les trois suivants partaient d'une
        # base plus étroite, le même corps au rembourrage près : pas « à revoir ».
        assert v["etat"] == "a-extraire", v["raison"]
        assert v["calque_cadre"] == {"largeur": 32, "hauteur": 48}
        lue = rgba(svc.apercu(*chemin, v["identifiant"], "source"))
        assert couleur(lue, teinte).sum() == 4 * 36, f"case {rang} : son bâton entier"
        for autre in teintes:
            if autre != teinte:
                assert not couleur(lue, autre).any(), f"case {rang} : rien de la voisine"
        # L'image rangée est sa case, et seulement elle : un quart de la planche.
        source = atelier.assets.lire(v["source"])
        assert (source.largeur, source.hauteur) == (COTE // 2, COTE // 2)


@pytest.mark.asyncio
async def test_rien_ne_deborde_rien_ne_change(decor, atelier, double):
    svc, chemin, p, poses = decor
    pose = pose_de(atelier, poses["est"])
    final = await fabriquer(atelier, double, chemin, [{"nature": "image", "resultat": poses["est"]}], [None])
    v = svc.lire(*chemin, final["variantes"][0])
    assert v["etat"] == "a-extraire"
    assert svc.ecrin(chemin[0], p) is None
    assert "agrandi" not in v["preparation"] and "debord" not in v["preparation"]
    assert v["calque_cadre"] == v["base"]["cadre"] == {"largeur": 20, "hauteur": 48}
    assert svc.apercu(*chemin, v["identifiant"], "base") == png(pose)
    # Revenue telle qu'elle était partie : le corps retombe sur la pose, pixel pour pixel.
    lue = rgba(svc.apercu(*chemin, v["identifiant"], "source"))
    assert ((lue[:, :, 3] >= 128) == (pose[:, :, 3] >= 128)).all()


@pytest.mark.asyncio
async def test_un_retour_deja_coupe_se_relit_depuis_la_planche_sans_appel(decor, atelier, client, double, monkeypatch):
    """Le rattrapage : une variante dépliée par l'ancien chemin, coupée au cadre du corps."""
    svc, chemin, p, poses = decor
    pose = pose_de(atelier, poses["est"])

    def ancien_depliage(projet, piece, emploi, cible, source, base_png, base, *, identifiant):
        # Ce que faisait `_deplier` jusqu'au 18 septembre 2026 : la case recadrée
        # sur le rectangle où le corps avait été posé.
        corps = rgba(base_png)
        case = (0, 0, COTE - 1, COTE - 1)
        brut = atelier.assets.octets(atelier.assets.lire(source), brut=True)[0]
        retour = recadrer_sur(avec_alpha(brut), place_de(corps.shape[1], corps.shape[0], case, .75), case, corps)
        return svc.accueillir_source_preparee(projet, piece, emploi, cible, source, base_png, base,
                                              identifiant=identifiant, source_png=png(retour.image))

    monkeypatch.setattr(svc, "accueillir_retour", ancien_depliage)
    final = await fabriquer(atelier, double, chemin, [{"nature": "image", "resultat": poses["est"]}], [BATON])
    monkeypatch.undo()
    # Un travail d'avant ne savait pas où était sa case entière.
    t = atelier.travaux_equipement._brut(chemin[0], final["identifiant"])
    t["cibles"][0].pop("case")
    atelier.travaux_equipement._garder(t)
    v = svc.lire(*chemin, final["variantes"][0])
    coupee = rgba(svc.apercu(*chemin, v["identifiant"], "source"))
    assert v["calque_cadre"] == {"largeur": 20, "hauteur": 48} and svc.ecrin(chemin[0], p) is None
    assert jaunes(coupee).sum() < 4 * 36, "l'ancien chemin coupait le bâton"
    appels = double.appels

    reponse = client.post(f"/api/projects/{chemin[0]}/equipment/{chemin[1]}/uses/{chemin[2]}"
                          f"/layers/{v['identifiant']}/source-from-sheet", json={"revision": v["revision"]})
    assert reponse.status_code == 200, reponse.text
    relue = reponse.json()
    assert double.appels == appels, "aucun appel au fournisseur"
    assert relue["etat"] == "a-extraire" and relue["revision"] > v["revision"]
    assert relue["calque_cadre"] == relue["base"]["cadre"] == {"largeur": 32, "hauteur": 48}
    lue = rgba(svc.apercu(*chemin, v["identifiant"], "source"))
    assert jaunes(lue).sum() == 4 * 36 and jaunes(lue)[:, 26:].sum() == 4 * 36
    base = rgba(svc.apercu(*chemin, v["identifiant"], "base"))
    assert np.array_equal(base[:, 6:26], pose)

    # La case entière est entrée en bibliothèque, à côté de l'ancienne, qui reste.
    nouvelle = atelier.assets.lire(relue["source"])
    assert relue["source"] != v["source"] and atelier.assets.lire(v["source"]) is not None
    assert nouvelle.generation == atelier.assets.lire(v["source"]).generation
    assert nouvelle.label.endswith("case entière") and (nouvelle.largeur, nouvelle.hauteur) == (COTE, COTE)

    # Relancé : la même case, aucune image de plus, toujours aucun appel.
    encore = atelier.travaux_equipement.relire_depuis_la_planche(*chemin, v["identifiant"], relue["revision"])
    assert encore["source"] == relue["source"] and double.appels == appels
    assert jaunes(rgba(svc.apercu(*chemin, v["identifiant"], "source"))).sum() == 4 * 36


def test_une_image_associee_a_la_main_n_a_pas_de_planche_a_relire(decor, atelier, client, tmp_path):
    svc, chemin, _, poses = decor
    v = svc.creer(*chemin, {"nature": "image", "resultat": poses["est"]}, image_equipee(client, tmp_path), "source-equipee")
    assert v["planche_d_origine"] is False
    with pytest.raises(TravailRefuse):
        atelier.travaux_equipement.relire_depuis_la_planche(*chemin, v["identifiant"], v["revision"])
