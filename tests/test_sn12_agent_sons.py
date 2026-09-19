"""SN12 : l'agent Godot enchaîne seul, par les outils MCP — jamais un appel
direct à un service — d'une demande de série jusqu'à la livraison dans un
dossier Godot temporaire ; et le cadre de délégation refuse un moteur sonore
non permis, avec sa raison.

ComfyUI est doublé (le double de SN1, qui installe les cinq moteurs) ; la
file locale, les séries, les jeux de variantes, la bibliothèque des sons et la
livraison Godot sont réels. Rien n'est payé."""
import json

import pytest

from atelier.mcp.serveur import creer_serveur
from tests.test_au1 import _bande
from tests.test_sn6_sujet_sons import DESCRIPTION, _godot, _jeu_ouvert
from tests.test_sn1_installation import son  # noqa: F401 — la fixture


async def _attendre(atelier):
    await atelier.travaux.attendre_tout()


def _lu(resultat):
    """Le contenu d'un appel d'outil, que FastMCP l'ait structuré (type de
    retour concret) ou seulement rendu en texte (retour `Any`, comme
    `get_sound_series` ou `list_subject_sounds`, qui rendent tantôt une fiche,
    tantôt une liste)."""
    if resultat.structured_content is not None:
        return resultat.structured_content
    return json.loads(resultat.content[0].text)


# ── Critère 1 · L'agent demande, suit et récupère un jeu de variantes livré ──


async def test_l_agent_demande_les_pas_du_heros_et_recoit_le_jeu_livre(son, tmp_path):  # noqa: F811
    atelier, comfy = son
    await atelier.installation_son.installer()
    projet = _jeu_ouvert(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros", DESCRIPTION).identifiant
    bande = _bande(atelier, projet, heros)
    godot = _godot(tmp_path)
    atelier.livraison.associer(projet, str(godot))
    serveur = creer_serveur(atelier)

    # L'agent lit d'abord ce que l'emplacement propose — rien n'est lancé.
    propose = await serveur.call_tool("prepare_subject_sound_series",
        {"project": projet, "subject": heros, "slot": "pas"})
    assert not propose.is_error, propose
    assert propose.structured_content["famille"] == "bruitage"
    assert not comfy.envois

    # Il précise sa demande — « les pas du héros sur l'herbe » — et la prépare.
    demande = {"famille": "bruitage", "prompt": "footsteps on grass, " + DESCRIPTION, "nombre": 2}
    prepare = await serveur.call_tool("prepare_subject_sound_series",
        {"project": projet, "subject": heros, "slot": "pas", "request": demande})
    assert not prepare.is_error, prepare
    serie = prepare.structured_content["identifiant"]
    assert prepare.structured_content["nombre"] == 2

    # Il la lance, et la suit — sans que l'auteur ouvre l'atelier.
    lance = await serveur.call_tool("start_sound_series", {"project": projet, "series": serie})
    assert not lance.is_error, lance
    await _attendre(atelier)
    suivi = await serveur.call_tool("get_sound_series", {"project": projet, "series": serie})
    assert not suivi.is_error, suivi
    lu = _lu(suivi)
    assert lu["etat"] == "terminee"
    assert all(t["etat"] == "rendu" for t in lu["tirages"])

    # Il garde les deux tirages : le jeu de variantes de l'emplacement.
    garde = await serveur.call_tool("keep_sound_takes",
        {"project": projet, "series": serie, "request": {"rangs": [1, 2]}})
    assert not garde.is_error, garde
    jeu = garde.structured_content
    assert jeu["nom"] == "sfx_heros_pas" and len(jeu["sons"]) == 2

    emplacement = await serveur.call_tool("list_subject_sounds", {"project": projet, "subject": heros})
    assert not emplacement.is_error, emplacement
    pas = next(e for e in _lu(emplacement)["emplacements"] if e["cle"] == "pas")
    assert pas["rempli"] and pas["contenu"]["identifiant"] == jeu["identifiant"]

    # Il livre le héros — ses sons partent avec lui, sous leurs noms stables.
    apercu = await serveur.call_tool("preview_animation_delivery",
        {"project": projet, "character": heros, "strips": [bande.identifiant]})
    assert not apercu.is_error, apercu
    jeton = apercu.structured_content["jeton"]
    noms = {f["chemin"].rsplit("/revisions/", 1)[-1].split("/", 1)[-1] for f in apercu.structured_content["fichiers"]}
    attendus = {"sons/sfx_heros_pas_01.wav", "sons/sfx_heros_pas_02.wav", "sons/sfx_heros_pas.tres",
                "sons/sfx_heros_pas_01.wav.import", "sons/sfx_heros_pas_02.wav.import", "sons/credits.json"}
    assert attendus <= noms, noms - attendus

    livre = await serveur.call_tool("publish_animation_delivery", {"project": projet, "token": jeton})
    assert not livre.is_error, livre
    assert livre.structured_content["etat"] == "terminee"
    # Les fichiers existent bel et bien dans le dossier Godot temporaire, sous
    # leurs noms stables — pas seulement dans la réponse de l'outil.
    for nom in ("sfx_heros_pas_01.wav", "sfx_heros_pas_02.wav", "sfx_heros_pas.tres", "credits.json"):
        f = next(f for f in livre.structured_content["fichiers"] if f["chemin"].endswith("sons/" + nom))
        assert (godot / f["chemin"]).is_file(), f["chemin"]


# ── Critère 2 · Un moteur non permis est refusé avec sa raison ──────────────


async def test_un_moteur_sonore_non_permis_est_refuse_avec_sa_raison(son):  # noqa: F811
    atelier, comfy = son
    await atelier.installation_son.installer()
    projet = _jeu_ouvert(atelier)
    serveur = creer_serveur(atelier)

    # Le cadre de ce jeu ne permet qu'un moteur qui n'est pas celui qui va
    # servir : la préparation (une simple relecture) réussit, le lancement
    # (le calcul réel) est refusé, avec sa raison en clair.
    atelier.travaux.regler_cadre(projet, {"modeles_audio": ["Autre:moteur-non-installe"]})
    prepare = await serveur.call_tool("prepare_sound_series", {"project": projet,
        "request": {"cle": "porte", "famille": "bruitage", "prompt": "heavy wooden door creak", "nombre": 1}})
    assert not prepare.is_error, prepare
    serie = prepare.structured_content["identifiant"]

    from mcp.server.mcpserver.exceptions import ToolError
    with pytest.raises(ToolError, match="autorisée"):
        await serveur.call_tool("start_sound_series", {"project": projet, "series": serie})
    assert not comfy.envois


async def test_sfxr_non_permis_est_refuse_avec_sa_raison(son):  # noqa: F811
    atelier, _ = son
    projet = _jeu_ouvert(atelier)
    serveur = creer_serveur(atelier)
    atelier.travaux.regler_cadre(projet, {"modeles_audio": ["ComfyUI:sa3-small-sfx@1"]})

    from mcp.server.mcpserver.exceptions import ToolError
    with pytest.raises(ToolError, match="autorisée"):
        await serveur.call_tool("make_retro_sound", {"project": projet, "start": "jump", "seed": 1})
