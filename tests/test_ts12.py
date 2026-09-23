# -*- coding: utf-8 -*-
"""Les critères de TS12 — les palettes de la toile servent à la retouche et au sujet.

`docs/PLAN-de-la-toile-au-sujet.md`, `### TS12`. **La décision tenue ici**
(`atelier/domaine/recette.py`, en tête) : une recette qui nomme une palette en
garde **la copie des couleurs** ; l'identifiant et le nom ne servent qu'à la
relire, et n'entrent pas dans l'empreinte. Le sujet, lui, garde un renvoi :
ses images à naître prennent la copie au moment où elles naissent.

**Chaque essai qui garde quelque chose le referme et le rouvre** (`AGENTS.md`,
8septies) : relu dans le fichier, avec des réglages qui ne sont pas ceux du
défaut. Aucun appel payé — le fournisseur est doublé.
"""

from __future__ import annotations

import json
import time

import pytest
from mcp.server.mcpserver.exceptions import ToolError

from atelier.domaine.recette import Quantification, Recette
from atelier.image.traitement import appliquer
from tests.conftest import image_sujet

MODELE = "essai:rend-du-png"
ROUGES = ("#aa2211", "#ffcc88", "#221111")
BLEUS = ("#1133aa", "#88ccff")


def _palette(client, nom: str, couleurs: tuple[str, ...]) -> dict:
    """Une palette nommée faite **à la main** — ses couleurs sont exactement
    celles qu'on lui ajoute, sans source à lire."""
    cree = client.post("/api/palettes", json={"nom": nom})
    assert cree.status_code == 201, cree.text
    palette = next(p for p in cree.json()["palettes"] if p["nom"] == nom)
    return _retoucher(client, palette["identifiant"], couleurs)


def _retoucher(client, identifiant: str, couleurs: tuple[str, ...]) -> dict:
    reponse = client.put(
        f"/api/palettes/{identifiant}",
        json={"retouches": [{"geste": "ajouter", "couleur": c} for c in couleurs]},
    )
    assert reponse.status_code == 200, reponse.text
    palette = next(
        p for p in reponse.json()["palettes"] if p["identifiant"] == identifiant
    )
    assert tuple(palette["rendue"]) == couleurs
    return palette


def _creer(client, nom: str = "Mara") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _poser(client, chose: str, palette: str | None):
    return client.put(f"/api/characters/{chose}/palette", json={"palette": palette})


def _generer(client, **corps) -> str:
    reponse = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "the character walks", **corps},
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(60):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            break
        time.sleep(0.05)
    assert lue["statut"] == "reussie", lue
    return identifiant


def _avec_la_palette(palette: dict, **autres) -> Recette:
    """Une recette qui nomme cette palette — **et un tramage qui n'est pas le
    défaut**, pour que la relecture ne passe pas par accident."""
    return Recette(
        quantification=Quantification(
            couleurs=len(palette["rendue"]),
            palette=tuple(palette["rendue"]),
            tramage="floyd",
            palette_nommee=palette["identifiant"],
            palette_nom=palette["nom"],
            **autres,
        )
    )


# ── La forme de la recette ───────────────────────────────────────────────────


def test_une_recette_d_avant_se_relit_a_l_identique():
    """**Aucune clé neuve n'apparaît** : la même empreinte, le même texte."""
    avant = {
        "couleurs": 16,
        "palette": ["#112233", "#445566"],
        "tramage": "floyd",
    }
    relue = Quantification.depuis_json(avant)
    assert relue.palette_nommee == "" and relue.palette_nom == ""
    assert relue.en_json() == avant
    recette = Recette(quantification=relue)
    assert Recette.depuis_json(recette.en_json()).empreinte() == recette.empreinte()


def test_la_palette_nommee_se_garde_et_se_relit():
    q = Quantification(
        couleurs=3, palette=ROUGES, palette_nommee="braises", palette_nom="Braises"
    )
    ecrite = Recette(quantification=q).en_json()
    assert ecrite["quantification"]["palette_nommee"] == "braises"
    relue = Recette.depuis_json(json.loads(json.dumps(ecrite)))
    assert relue.quantification == q


def test_le_nom_de_la_palette_n_entre_pas_dans_l_empreinte():
    """Deux recettes aux mêmes couleurs rendent le même fichier, sous le même
    nom de rendu — que la copie vienne du jeu ou d'une palette nommée."""
    du_jeu = Recette(quantification=Quantification(couleurs=3, palette=ROUGES))
    nommee = Recette(
        quantification=Quantification(
            couleurs=3, palette=ROUGES, palette_nommee="braises", palette_nom="Braises"
        )
    )
    assert du_jeu.empreinte() == nommee.empreinte()
    autres = Recette(quantification=Quantification(couleurs=2, palette=BLEUS))
    assert autres.empreinte() != nommee.empreinte()


# ── La recette qui nomme une palette ─────────────────────────────────────────


def test_une_recette_avec_palette_nommee_rend_la_meme_image_deux_fois(client):
    palette = _palette(client, "Braises", ROUGES)
    recette = _avec_la_palette(palette)
    octets = image_sujet(toile=48, bloc=2, logique_l=12, logique_h=16)

    premier = appliquer(recette, octets).octets
    second = appliquer(Recette.depuis_json(recette.en_json()), octets).octets
    assert premier == second

    # **Réduite à ses couleurs** : rien d'autre ne sort que la palette.
    from io import BytesIO

    from PIL import Image

    with Image.open(BytesIO(premier)) as image:
        rgba = image.convert("RGBA")
        vues = {
            "#%02x%02x%02x" % p[:3] for p in rgba.get_flattened_data() if p[3] > 0
        }
    assert vues <= set(ROUGES)


def test_la_palette_changee_ne_change_pas_la_recette_nommee(client, atelier):
    """**Le déterminisme tient** : la recette garde sa copie, et réappliquée
    elle rend le même fichier ; la palette, elle, a bougé."""
    palette = _palette(client, "Braises", ROUGES)
    recette = _avec_la_palette(palette)
    atelier.assets.nommer("braises 01", recette, atelier.bibliotheque.courant)

    fichier = image_sujet(toile=48, bloc=2, logique_l=10, logique_h=14)
    rendu_avant = appliquer(atelier.assets.recettes()["braises 01"], fichier).octets

    _retoucher(client, palette["identifiant"], BLEUS)

    # **Refermée et rouverte** : relue du fichier des recettes nommées.
    relue = atelier.assets.recettes()["braises 01"]
    assert relue.quantification.palette == ROUGES
    assert relue.quantification.palette_nommee == palette["identifiant"]
    assert relue.quantification.tramage == "floyd"
    assert appliquer(relue, fichier).octets == rendu_avant


def test_la_palette_supprimee_laisse_la_recette_intacte(client, atelier):
    palette = _palette(client, "Braises", ROUGES)
    atelier.assets.nommer(
        "braises 01", _avec_la_palette(palette), atelier.bibliotheque.courant
    )
    chose = _creer(client)
    assert _poser(client, chose["identifiant"], palette["identifiant"]).status_code == 200

    supprimee = client.delete(f"/api/palettes/{palette['identifiant']}")
    assert supprimee.status_code in (200, 204), supprimee.text

    relue = atelier.assets.recettes()["braises 01"]
    assert relue.quantification.palette == ROUGES
    assert relue.quantification.palette_nom == "Braises"

    # **Le sujet retombe sur aucune, et le dit** — relu dans son fichier.
    sujet = atelier.production.personnage(chose["projet"], chose["identifiant"])
    assert sujet.palette == ""
    assert sujet.palette_supprimee == "Braises"

    # Une palette neuve du même nom reprend le même identifiant : le sujet ne
    # la prend pas pour autant.
    neuve = _palette(client, "Braises", BLEUS)
    assert neuve["identifiant"] == palette["identifiant"]
    sujet = atelier.production.personnage(chose["projet"], chose["identifiant"])
    assert sujet.palette == ""

    # Choisir de nouveau efface la trace.
    assert _poser(client, chose["identifiant"], neuve["identifiant"]).status_code == 200
    sujet = atelier.production.personnage(chose["projet"], chose["identifiant"])
    assert sujet.palette == neuve["identifiant"] and sujet.palette_supprimee == ""


def test_la_route_d_une_image_garde_la_palette_nommee(client, atelier, tmp_path):
    """**La leçon de `decalage`** : le corps Pydantic doit porter les deux
    champs, sans quoi ils disparaîtraient au premier réglage posé à côté."""
    palette = _palette(client, "Braises", ROUGES)
    fichier = tmp_path / "mara.png"
    fichier.write_bytes(image_sujet(toile=48, bloc=2, logique_l=12, logique_h=16))
    importe = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert importe.status_code in (200, 201), importe.text
    identifiant = importe.json()["asset"]["identifiant"]

    posee = client.put(
        f"/api/assets/{identifiant}/recipe",
        json=_avec_la_palette(palette).en_json(),
    )
    assert posee.status_code == 200, posee.text
    relue = atelier.assets.lire(identifiant).recette.quantification
    assert relue.palette_nommee == palette["identifiant"]
    assert relue.palette_nom == "Braises"
    assert relue.palette == ROUGES


# ── La palette par défaut d'un sujet ─────────────────────────────────────────


def test_la_route_pose_relit_et_efface_la_palette_du_sujet(client, atelier):
    palette = _palette(client, "Braises", ROUGES)
    chose = _creer(client)

    posee = _poser(client, chose["identifiant"], palette["identifiant"])
    assert posee.status_code == 200, posee.text
    assert posee.json()["personnage"]["palette"] == palette["identifiant"]

    # **Écrite dans son fichier**, qui fait foi — refermée, rouverte.
    fichier = (
        atelier.assets._fichiers.projets
        / chose["projet"]
        / "personnages"
        / f"{chose['identifiant']}.json"
    )
    assert json.loads(fichier.read_text(encoding="utf-8"))["palette"] == palette["identifiant"]

    # Par son nom aussi — un agent le lit plus volontiers.
    assert _poser(client, chose["identifiant"], None).json()["personnage"]["palette"] == ""
    assert _poser(client, chose["identifiant"], "braises").json()["personnage"]["palette"] == palette["identifiant"]

    refus = _poser(client, chose["identifiant"], "cendres")
    assert refus.status_code == 409, refus.text
    assert "cendres" in refus.text and "Braises" in refus.text
    relu = atelier.production.personnage(chose["projet"], chose["identifiant"])
    assert relu.palette == palette["identifiant"]


def test_les_images_qui_naissent_prennent_la_palette_du_sujet(client, atelier):
    palette = _palette(client, "Braises", ROUGES)
    chose = _creer(client)
    avant = _generer(client, personnage=chose["identifiant"])
    ancienne = atelier.assets.lire(f"{avant}-0").recette

    assert _poser(client, chose["identifiant"], palette["identifiant"]).status_code == 200
    generation = _generer(client, personnage=chose["identifiant"])
    asset = atelier.assets.lire(f"{generation}-0")

    q = asset.recette.quantification
    assert q is not None
    assert q.palette == ROUGES
    assert q.palette_nommee == palette["identifiant"] and q.palette_nom == "Braises"
    # **La fiche dit la même chose que la naissance** : aucun faux écart.
    assert atelier.assets.impose(asset.identifiant)["impose"] == asset.recette.en_json()

    # **Celles déjà faites ne bougent pas.**
    assert atelier.assets.lire(f"{avant}-0").recette == ancienne

    # La palette change ensuite : l'image née garde sa copie.
    _retoucher(client, palette["identifiant"], BLEUS)
    assert atelier.assets.lire(asset.identifiant).recette.quantification.palette == ROUGES

    # Un autre sujet, ou aucun, ne la prend pas.
    autre = _creer(client, "Pommier")
    for corps in ({}, {"personnage": autre["identifiant"]}):
        libre = atelier.assets.lire(f"{_generer(client, **corps)}-0")
        assert (libre.recette.quantification or Quantification()).palette_nommee == ""


def test_une_palette_supprimee_rend_le_sujet_a_la_recette_seule(client, atelier):
    palette = _palette(client, "Braises", ROUGES)
    chose = _creer(client)
    assert _poser(client, chose["identifiant"], palette["identifiant"]).status_code == 200
    assert client.delete(f"/api/palettes/{palette['identifiant']}").status_code in (200, 204)

    generation = _generer(client, personnage=chose["identifiant"])
    asset = atelier.assets.lire(f"{generation}-0")
    lue = atelier.generations._base.lire(generation)
    assert asset.recette == atelier.assets.recette_du_projet(lue)


def test_le_balayage_du_projet_laisse_une_palette_nommee(client, atelier):
    """« Tout réaligner » remet les images sur la palette du jeu — **pas celle
    qu'un sujet ou l'auteur a choisie**. Demandé pour cette image-là, il la
    remet sur le jeu et efface la provenance."""
    palette = _palette(client, "Braises", ROUGES)
    chose = _creer(client)
    assert _poser(client, chose["identifiant"], palette["identifiant"]).status_code == 200
    asset = atelier.assets.lire(f"{_generer(client, personnage=chose['identifiant'])}-0")
    projet = atelier.bibliotheque.courant

    # Un artwork officiel donne au jeu sa palette — celle que le balayage pose.
    carte = client.post(
        "/api/board/paste",
        params={"nom": "art.png", "forcer": True},
        content=image_sujet(logique_l=9),
    )
    assert carte.status_code == 201, carte.text
    promue = client.put(
        f"/api/board/{carte.json()['carte']['identifiant']}/official",
        json={"officiel": True, "famille": "tous"},
    )
    assert promue.status_code == 200, promue.text
    assert atelier.base.lire_projet(projet).univers.palette

    atelier.univers.realigner(projet)
    assert atelier.assets.lire(asset.identifiant).recette.quantification.palette == ROUGES

    atelier.univers.realigner(projet, identifiants=[asset.identifiant])
    q = atelier.assets.lire(asset.identifiant).recette.quantification
    assert q.palette == tuple(atelier.base.lire_projet(projet).univers.palette) != ROUGES
    assert q.palette_nommee == "" and q.palette_nom == ""


# ── L'agent (T7) ─────────────────────────────────────────────────────────────


async def test_l_agent_lit_et_pose_la_palette_du_sujet(client, atelier):
    from atelier.mcp.serveur import creer_serveur

    palette = _palette(client, "Braises", ROUGES)
    chose = _creer(client)
    serveur = creer_serveur(atelier)

    posee = await serveur.call_tool(
        "set_character_objective", {"character": "Mara", "palette": "Braises"}
    )
    assert not posee.is_error, posee
    assert posee.structured_content["palette"]["id"] == palette["identifiant"]
    relu = atelier.production.personnage(chose["projet"], chose["identifiant"])
    assert relu.palette == palette["identifiant"]

    liste = await serveur.call_tool("list_characters", {})
    mara = next(c for c in liste.structured_content["characters"] if c["name"] == "Mara")
    assert mara["palette"]["name"] == "Braises"
    assert mara["palette"]["colors"] == list(ROUGES)

    with pytest.raises(ToolError, match="cendres"):
        await serveur.call_tool(
            "set_character_objective", {"character": "Mara", "palette": "cendres"}
        )

    retiree = await serveur.call_tool(
        "set_character_objective", {"character": "Mara", "palette": ""}
    )
    assert not retiree.is_error and retiree.structured_content["palette"] is None
