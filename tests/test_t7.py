# -*- coding: utf-8 -*-
"""Les critères d'acceptation de T7 — le MCP, sans un centime.

Les outils sont appelés **par le serveur**, `call_tool` comme un vrai client :
c'est le seul moyen de vérifier ce qui compte ici, à savoir que ce qu'un agent
peut faire est exactement ce que l'écran peut faire. Un test qui appellerait les
fonctions Python directement sauterait la validation de schéma et ne prouverait
rien du contrat.

Deux tests **comptent les appels du double** avant et après : importer, retoucher
et découper ne demandent jamais le fournisseur, et c'est ce que la tranche
promet — un agent hors ligne garde onze outils sur douze.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from PIL import Image

from atelier.api.app import creer_application
from atelier.mcp.serveur import creer_serveur
from mcp.server.mcpserver.exceptions import MCPServerError
from atelier.services.agent import MODELE_EXPLORATION
from fastapi.testclient import TestClient

from tests.conftest import image_sujet


@pytest.fixture
async def mcp(atelier):
    """Le serveur, sur un atelier **ouvert** — catalogue relu, projet en place.

    L'ouverture complète et pas seulement celle de la bibliothèque : le
    garde-fou du modèle consulte le catalogue, et un catalogue vide ferait
    tomber tous les appels sur un refus qui n'a rien à voir avec ce qu'on
    vérifie.
    """
    await atelier.ouvrir()
    return creer_serveur(atelier)


async def appeler(serveur, nom: str, **arguments):
    """Un outil, appelé comme un client le ferait. Rend le contenu structuré."""
    try:
        resultat = await serveur.call_tool(nom, arguments)
    except MCPServerError as refus:
        raise AssertionError(f"{nom} a refusé : {refus}") from None
    if resultat.is_error:
        texte = " ".join(
            bloc.text for bloc in resultat.content if hasattr(bloc, "text")
        )
        raise AssertionError(f"{nom} a refusé : {texte}")
    return resultat.structured_content


async def refuser(serveur, nom: str, **arguments) -> str:
    """L'inverse : on attend un refus, et **on rend sa phrase pour la lire**.

    C'est cette phrase-là que l'agent répétera à l'auteur : la vérifier est
    exactement ce que US-85 et US-86 demandent, et pas seulement vérifier qu'un
    refus a eu lieu.
    """
    try:
        resultat = await serveur.call_tool(nom, arguments)
    except MCPServerError as refus:
        return str(refus)
    assert resultat.is_error, f"{nom} devait refuser et ne l'a pas fait"
    return " ".join(bloc.text for bloc in resultat.content if hasattr(bloc, "text"))


# ── Générer, et recevoir un chemin de fichier ────────────────────────────────


async def test_un_agent_genere_et_recoit_un_chemin(atelier, mcp, double):
    """« Génère un asset dans le bon projet sans aucune intervention, et reçoit
    un chemin de fichier. »"""
    projet = atelier.bibliotheque.courant

    reponse = await appeler(mcp, "generate_asset", subject="a stone sword")
    await atelier.generations.attendre_tout()

    assert reponse["done"] is True
    assert len(reponse["images"]) == 1
    image = reponse["images"][0]

    # Un chemin **absolu**, et un fichier qui existe vraiment : c'est ce que
    # l'agent va écrire dans le code du jeu.
    chemin = Path(image["path"])
    assert chemin.is_absolute() and chemin.is_file()

    # Rangé dans le projet ouvert, sans que personne ne l'ait dit (US-87).
    assert image["project"] == projet
    assert atelier.assets.lire(image["id"]) is not None


async def test_l_univers_s_applique_sans_que_l_agent_le_repete(atelier, mcp, double):
    """« L'univers du projet s'applique à une demande de l'agent sans qu'il ait
    à répéter le style. »"""
    projet = atelier.bibliotheque.courant
    atelier.univers.regler_univers(
        projet,
        bible=[
            {"nom": "monde", "texte": "dark fantasy mine", "actif": True},
            {"nom": "trait", "texte": "chunky outlines", "actif": True},
        ],
    )

    await appeler(mcp, "generate_asset", subject="a barrel")
    await atelier.generations.attendre_tout()

    # Ce qui est **réellement parti** au fournisseur, pas ce que l'agent a dit.
    partie = double.demandes[-1].prompt
    assert "dark fantasy mine" in partie
    assert "chunky outlines" in partie
    assert "a barrel" in partie


async def test_l_attente_bornee_rend_un_identifiant_interrogeable(
    atelier, mcp, double
):
    """« Une attente courte rend l'image directement ; passé le délai fixé par
    l'appelant, elle rend un identifiant interrogeable. » (US-80)"""
    import asyncio

    double.retenir = asyncio.Event()

    # Zéro seconde d'attente : l'appel tourne encore, donc pas d'image — mais un
    # identifiant, et c'est tout ce qu'il faut pour revenir.
    partielle = await appeler(mcp, "generate_asset", subject="a torch", wait_seconds=0)
    assert partielle["done"] is False
    assert partielle["images"] == []
    identifiant = partielle["generation_id"]

    double.retenir.set()
    await atelier.generations.attendre_tout()

    finie = await appeler(mcp, "check_generation", generation_id=identifiant)
    assert finie["done"] is True
    assert len(finie["images"]) == 1
    assert Path(finie["images"][0]["path"]).is_file()


# ── Lister, importer, retoucher, découper, exporter ──────────────────────────


async def test_les_cinq_gestes_de_l_agent(atelier, mcp, double, tmp_path):
    """« L'agent liste projets, assets et modèles, importe un fichier local,
    retouche un asset existant et exporte une sélection. »"""

    projets = await appeler(mcp, "list_projects")
    assert projets["open"] == atelier.bibliotheque.courant
    assert projets["projects"]

    modeles = await appeler(mcp, "list_models")
    assert {m["id"] for m in modeles["models"]} == {
        "essai:rend-du-png",
        "essai:rend-du-jpeg",
    }

    # Importer : un fichier local devient un asset entier.
    source = tmp_path / "epee-de-fer.png"
    source.write_bytes(image_sujet())
    avant = double.appels
    # **Une seule forme, toujours** (R3) : l'outil rend `{asset, doublon}`,
    # dont l'un est nul. Un import qui rendrait tantôt un asset et tantôt un
    # avertissement serait deux contrats sous un seul nom.
    importe = (await appeler(mcp, "import_asset", file_path=str(source)))["asset"]
    assert importe["id"]
    assert Path(importe["path"]).is_file()

    trouves = await appeler(mcp, "list_assets", search="epee")
    assert importe["id"] in {a["id"] for a in trouves["assets"]}

    # Retoucher : détourage et grille, sans un appel.
    retouche = await appeler(
        mcp,
        "edit_asset",
        asset_id=importe["id"],
        steps={
            "passes": [{"moteur": "bord", "tolerance": 28}],
            "grille": {"cible": 32, "occupation": 100, "ancrage": "bas"},
        },
    )
    assert retouche["processed"] is True
    assert retouche["width"] == 32

    # Exporter : les PNG posés dans un dossier, plus le descriptif.
    dossier = tmp_path / "jeu" / "assets"
    sortie = await appeler(
        mcp, "export_assets", asset_ids=[importe["id"]], folder=str(dossier)
    )
    poses = {Path(f["path"]).name for f in sortie["files"]}
    assert "descriptif.json" in poses
    assert any(n.endswith(".png") for n in poses)
    assert sortie["manifest"]

    # **Aucun de ces cinq gestes n'a appelé le fournisseur.** C'est la promesse
    # de la tranche, et elle se prouve en comptant, pas en la relisant.
    assert double.appels == avant


async def test_une_planche_se_propose_puis_se_decoupe(atelier, mcp, double, tmp_path):
    """« Deux gestes séparés » — proposer ne crée rien, découper coupe ce qu'on
    lui donne. La séparation est le contrat, pas un détail d'implémentation."""
    planche = tmp_path / "planche.png"
    planche.write_bytes(image_sujet(logique_l=32, logique_h=16, bloc=2, toile=8))
    importe = (await appeler(mcp, "import_asset", file_path=str(planche)))["asset"]

    avant_assets = len(atelier.assets.recents(500))
    propose = await appeler(
        mcp, "slice_asset", asset_id=importe["id"], mode="grille", columns=2, rows=1
    )
    assert propose["created"] is False
    assert len(propose["boxes"]) == 2
    # **Rien n'a été créé** : c'est toute la raison d'être des deux gestes.
    assert len(atelier.assets.recents(500)) == avant_assets

    faites = await appeler(
        mcp, "slice_asset", asset_id=importe["id"], boxes=propose["boxes"]
    )
    assert faites["created"] is True
    assert len(faites["slices"]) == 2
    for morceau in faites["slices"]:
        assert Path(morceau["path"]).is_file()
        # Une découpe appartient à qui a demandé la planche (US-39).
        assert morceau["provenance"] == "agent"


# ── Les garde-fous ───────────────────────────────────────────────────────────


async def test_le_plafond_refuse_en_nommant_le_moyen_de_le_relever(atelier, mcp):
    """« Refus qui nomme le plafond et le moyen de le relever, et aucune invite
    n'apparaît à l'écran. » (US-85, US-88)"""
    atelier.agent.regler(plafond_actif=True, plafond=2)

    await appeler(mcp, "generate_asset", subject="un", wait_seconds=0)
    await appeler(mcp, "generate_asset", subject="deux", wait_seconds=0)
    raison = await refuser(mcp, "generate_asset", subject="trois", wait_seconds=0)

    # Le plafond, le compte, et la phrase qui dit quoi faire. Les trois.
    assert "2" in raison
    assert "plafond" in raison.lower()
    assert "Réglages" in raison

    await atelier.generations.attendre_tout()


async def test_le_modele_impose_s_applique_et_se_leve_sans_redemarrage(
    atelier, mcp, double
):
    """« Relever le plafond, le désactiver, changer ou lever le modèle imposé
    prend effet à l'appel suivant, sans redémarrage. » (US-91)"""
    atelier.agent.regler(modele_actif=True, modele="essai:rend-du-png")

    await appeler(mcp, "generate_asset", subject="un", model="essai:rend-du-jpeg")
    await atelier.generations.attendre_tout()
    # Le modèle demandé par l'agent n'a pas été écouté : le garde-fou décide.
    assert atelier.generations.recentes(1)[0].modele == "essai:rend-du-png"

    # On lève le garde-fou. **Aucun redémarrage**, aucun nouvel objet : le
    # service relit le fichier à chaque appel.
    atelier.agent.regler(modele_actif=False)
    await appeler(mcp, "generate_asset", subject="deux", model="essai:rend-du-jpeg")
    await atelier.generations.attendre_tout()
    assert atelier.generations.recentes(1)[0].modele == "essai:rend-du-jpeg"

    # Et le plafond suit la même règle, dans les deux sens.
    atelier.agent.regler(plafond_actif=True, plafond=1)
    assert await refuser(mcp, "generate_asset", subject="trois", wait_seconds=0)
    atelier.agent.regler(plafond_actif=False)
    await appeler(mcp, "generate_asset", subject="quatre", wait_seconds=0)
    await atelier.generations.attendre_tout()


async def test_le_modele_d_exploration_est_le_defaut(atelier):
    """Un atelier auquel personne n'a touché impose déjà le modèle d'exploration.

    « Un agent qui code a besoin d'un visuel correct tout de suite, pas d'un
    asset final » : le garde-fou est actif par défaut, sinon il ne protège que
    ceux qui pensent à l'allumer.

    **Les options sont vides depuis F6**, et ce n'est pas un oubli : `quality`
    était un réglage d'OpenRouter, et le modèle imposé est désormais gratuit —
    un réglage qu'un modèle ne déclare pas est écarté avec sa raison depuis T1.
    """
    cadre = atelier.agent.garde_fous()
    assert cadre.modele_actif is True
    assert cadre.modele == MODELE_EXPLORATION
    assert cadre.options == {}
    assert cadre.plafond_actif is True


async def test_un_projet_inconnu_est_refuse_avec_la_liste_et_ne_cree_rien(
    atelier, mcp
):
    """« Refus accompagné de la liste des projets existants, et aucun projet n'a
    été créé. » (US-86)"""
    atelier.bibliotheque.creer_projet("Cœur de pierre")
    avant = {p.identifiant for p in atelier.bibliotheque.projets()}

    raison = await refuser(mcp, "generate_asset", subject="une épée", project="donjon")

    assert "donjon" in raison
    # La liste, pour se corriger tout de suite.
    for identifiant in avant:
        assert identifiant in raison
    # **Rien n'a été créé au passage.**
    assert {p.identifiant for p in atelier.bibliotheque.projets()} == avant


async def test_un_projet_se_nomme_par_son_repere_ou_par_son_nom(atelier, mcp):
    """Un agent a lu « Cœur de pierre » dans `list_projects`, pas son repère."""
    projet = atelier.bibliotheque.creer_projet("Cœur de pierre")

    par_nom = await appeler(
        mcp, "generate_asset", subject="une torche", project="Cœur de pierre"
    )
    await atelier.generations.attendre_tout()
    assert par_nom["images"][0]["project"] == projet.identifiant


# ── Le dossier du jeu ────────────────────────────────────────────────────────


async def test_le_dossier_manquant_est_cree_et_rien_n_est_ecrase(
    atelier, mcp, tmp_path
):
    """« Dossier manquant créé ; fichier de même nom jamais écrasé. » (US-84)"""
    dossier = tmp_path / "jeu" / "assets" / "sprites"
    assert not dossier.exists()

    premier = await appeler(
        mcp, "generate_asset", subject="une épée", folder=str(dossier)
    )
    await atelier.generations.attendre_tout()
    pose = Path(premier["images"][0]["written_to"])
    assert pose.is_file() and pose.parent == dossier

    # Un témoin dans le fichier : s'il survit, rien n'a été écrasé.
    empreinte = pose.read_bytes()

    second = await appeler(
        mcp, "generate_asset", subject="une épée", folder=str(dossier)
    )
    await atelier.generations.attendre_tout()
    autre = Path(second["images"][0]["written_to"])

    assert autre != pose
    assert autre.name.endswith("-2.png")
    assert pose.read_bytes() == empreinte


async def test_un_dossier_non_inscriptible_est_refuse_avec_son_chemin(
    atelier, mcp, tmp_path
):
    """« Dossier non inscriptible refusé avec le chemin fautif. » (US-84)

    On fabrique le cas sans toucher aux droits du système : un **fichier** posé
    là où un dossier est attendu se refuse sur toutes les plateformes, et c'est
    la même branche de code qui répond.
    """
    obstacle = tmp_path / "pas-un-dossier"
    obstacle.write_text("je ne suis pas un dossier", encoding="utf-8")

    raison = await refuser(
        mcp, "generate_asset", subject="une épée", folder=str(obstacle)
    )
    # **Le chemin fautif**, parce que l'agent en a nommé trois dans la minute.
    assert str(obstacle) in raison


async def test_sans_dossier_le_refus_dit_ou_le_poser(atelier, mcp):
    with pytest.raises(Exception) as refus:
        atelier.agent.deposer(b"x", "epee.png")
    assert "Réglages" in str(refus.value)


async def test_le_dossier_du_jeu_se_pose_une_fois_pour_toutes(
    atelier, mcp, tmp_path
):
    """Posé dans les réglages, l'agent n'a plus à le nommer (US-96)."""
    dossier = tmp_path / "jeu"
    atelier.agent.regler(dossier_jeu=str(dossier))

    chemin = atelier.agent.deposer(b"\x89PNG\r\n\x1a\n", "epee.png")
    assert Path(chemin).parent == dossier


# ── Ce que l'auteur voit ─────────────────────────────────────────────────────


async def test_ce_que_l_agent_produit_parait_en_direct_et_marque(atelier, mcp):
    """« Ce que l'agent produit apparaît en direct dans la grille, marqué de sa
    provenance. » (US-39, US-89)"""
    with atelier.diffusion.abonnement() as file:
        await appeler(mcp, "generate_asset", subject="une épée")
        await atelier.generations.attendre_tout()

        # **La même diffusion que l'écran écoute**, parce que c'est le même
        # processus et le même atelier : un second serveur MCP, dans son propre
        # processus, n'aurait rien annoncé ici.
        genres = set()
        while not file.empty():
            genres.add(file.get_nowait().genre)
    assert "asset" in genres

    ne = atelier.assets.recents(1)[0]
    assert ne.provenance == "agent"
    # Et l'écran le reçoit tel quel : le marquage n'est pas recalculé à l'écran.
    assert ne.en_json()["provenance"] == "agent"


async def test_ce_que_l_auteur_produit_reste_de_l_auteur(atelier, client):
    """La contrepartie, sans laquelle le marquage ne distingue rien."""
    reponse = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "une épée", "variations": 1},
    )
    assert reponse.status_code == 202
    assert reponse.json()["provenance"] == "auteur"


async def test_le_compteur_de_consommation_est_lisible(atelier, mcp, client):
    """« Le compteur de consommation de l'agent est lisible sans quitter
    l'atelier. » (US-90)"""
    atelier.agent.regler(plafond_actif=True, plafond=5)

    await appeler(mcp, "generate_asset", subject="une épée", variations=2)
    await atelier.generations.attendre_tout()

    # Vu de l'agent…
    budget = await appeler(mcp, "get_budget")
    assert budget["generations"] == 2
    assert budget["cap"] == 5
    assert budget["left"] == 3
    assert budget["spent_usd"] > 0

    # …et vu de l'écran, par le même chemin. **Un seul calcul** : le refus de
    # l'agent et le compteur de l'auteur ne peuvent pas dire deux chiffres
    # différents.
    etat = client.get("/api/status").json()
    assert etat["agent"]["consommation"]["generations"] == 2
    assert etat["agent"]["consommation"]["reste"] == 3


async def test_cle_garde_fous_et_dossiers_se_reglent_depuis_un_seul_ecran(
    atelier, client, tmp_path
):
    """« Clé, garde-fous et dossiers se règlent depuis un seul écran. » (US-96)"""
    assert client.get("/api/settings/keys").status_code == 200

    lu = client.get("/api/settings/agent").json()
    assert lu["garde_fous"]["plafond_actif"] is True
    assert "consommation" in lu

    pose = client.put(
        "/api/settings/agent",
        json={"plafond": 42, "dossier_jeu": str(tmp_path / "jeu")},
    )
    assert pose.status_code == 200
    assert pose.json()["garde_fous"]["plafond"] == 42

    # **Champ par champ** : ce qui n'est pas dit ne change pas. Un formulaire
    # partiel ne doit pas effacer ce qu'un autre onglet vient de poser.
    client.put("/api/settings/agent", json={"plafond_actif": False})
    apres = client.get("/api/settings/agent").json()["garde_fous"]
    assert apres["plafond"] == 42
    assert apres["dossier_jeu"] == str(tmp_path / "jeu")
    assert apres["plafond_actif"] is False


async def test_les_garde_fous_survivent_a_un_atelier_neuf(atelier, tmp_path):
    """Écrits sur le disque, relus au démarrage suivant — sans redémarrage
    nécessaire pour qu'ils prennent, et sans être perdus quand il y en a un."""
    from atelier.services import Atelier

    atelier.agent.regler(plafond=7, modele_actif=False)
    autre = Atelier(racine=atelier.fichiers.racine)
    assert autre.agent.garde_fous().plafond == 7
    assert autre.agent.garde_fous().modele_actif is False


# ── La règle qui tient tout ──────────────────────────────────────────────────


async def test_aucun_outil_ne_reimplemente_un_geste(mcp):
    """« Aucun outil ne réimplémente un geste : chacun appelle le service que
    l'écran appelle. »

    Ça ne se vérifie pas à l'exécution — on le lit dans les imports. Le module
    du MCP ne connaît **ni le fournisseur, ni la base, ni le disque** : il ne
    peut donc ni appeler, ni écrire, ni ranger de son propre chef, et tout ce
    qu'il fait passe forcément par un service.
    """
    source = Path("atelier/mcp/serveur.py").read_text(encoding="utf-8")
    for interdit in (
        "from atelier.fournisseur",
        "from atelier.depot",
        "import sqlite3",
        "import httpx",
    ):
        assert interdit not in source, f"le MCP importe « {interdit} »"


async def test_le_montage_du_mcp_precede_celui_de_l_interface(atelier):
    """Un montage ajouté après celui de l'interface n'est jamais atteint.

    `StaticFiles` est monté sur « / » et attrape tout ce qui vient après lui.
    Le piège a déjà coûté une séance (`docs/PIEGES.md`) ; ici il
    rendrait la page d'accueil à un agent qui parle MCP.
    """
    application = creer_application(atelier)
    chemins = [getattr(r, "path", "") for r in application.routes]
    assert "/mcp" in chemins
    if "/" in chemins:
        assert chemins.index("/mcp") < chemins.index("/")


async def test_un_client_mcp_se_branche_et_voit_les_outils(atelier):
    """**La poignée de main réelle, sur l'adresse réelle.**

    La première version de cet essai vérifiait « ni 404, ni page d'accueil ». Le
    montage ajoutait alors son préfixe à celui du SDK — l'adresse vraie était
    `/mcp/mcp` —, et `/mcp` répondait **405** : ni 404, ni HTML. L'essai passait,
    et aucun agent n'aurait pu se brancher. Il fallait ouvrir la session pour le
    voir, donc il l'ouvre.

    C'est aussi le seul essai qui prouve que le `lifespan_context` du
    gestionnaire de sessions tourne : sans lui, l'initialisation échoue en
    transport et rien dans les journaux ne dit pourquoi.
    """
    # **`Host` est vérifié par le transport** — protection contre le
    # réattachement DNS, justifiée pour un serveur qui écoute en local. Le
    # client d'essai s'annonce « testserver » ; on lui fait dire la vérité du
    # produit plutôt que d'ouvrir la liste des hôtes autorisés pour un test.
    entetes = {
        "Accept": "application/json, text/event-stream",
        "Host": "127.0.0.1:8420",
    }
    with TestClient(creer_application(atelier)) as client:
        ouverture = client.post(
            "/mcp",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "essai", "version": "1"},
                },
            },
            headers=entetes,
        )
        assert ouverture.status_code == 200, ouverture.text
        session = ouverture.headers.get("mcp-session-id")
        assert session, "aucune session ouverte"

        client.post(
            "/mcp",
            json={"jsonrpc": "2.0", "method": "notifications/initialized"},
            headers={**entetes, "mcp-session-id": session},
        )
        liste = client.post(
            "/mcp",
            json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
            headers={**entetes, "mcp-session-id": session},
        )
    assert liste.status_code == 200, liste.text
    # Les outils de la tranche, nommés en anglais, tels qu'un agent les verra.
    for outil in ("generate_asset", "list_assets", "edit_asset", "export_assets"):
        assert outil in liste.text


async def test_les_deux_ecritures_de_l_adresse_menent_au_meme_endroit(atelier):
    """`/mcp` et `/mcp/`, et le premier est celui qu'on écrit dans une config.

    Un montage Starlette ne reconnaît que `/mcp/…` : le chemin **exact** `/mcp`
    traversait toute la table de routage et finissait chez les fichiers
    statiques montés sur « / », qui répondent 405 à un `POST`. Le premier essai
    de cette tranche ne regardait ni le code exact ni la barre finale, et il a
    laissé passer les deux défauts d'affilée.
    """
    corps = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "essai", "version": "1"},
        },
    }
    entetes = {
        "Accept": "application/json, text/event-stream",
        "Host": "127.0.0.1:8420",
    }
    with TestClient(creer_application(atelier)) as client:
        for adresse in ("/mcp", "/mcp/"):
            reponse = client.post(adresse, json=corps, headers=entetes)
            assert reponse.status_code == 200, f"{adresse} → {reponse.text}"
            assert reponse.headers.get("mcp-session-id"), adresse
        # Et l'interface n'a rien perdu au passage : le middleware ne touche
        # qu'un seul chemin.
        assert client.get("/").status_code == 200


async def test_un_import_survit_a_un_index_efface(atelier, tmp_path):
    """Un asset importé passe par une génération, donc la reconstruction le
    retrouve — sinon il disparaîtrait à la première évolution du schéma."""
    source = tmp_path / "tonneau.png"
    source.write_bytes(image_sujet())
    entre = atelier.generations.importer(source.read_bytes(), source.name)

    compte = atelier.bibliotheque.reconstruire()
    assert compte["assets"] >= 1
    assert atelier.assets.lire(entre["asset"]["identifiant"]) is not None


async def test_l_export_de_l_agent_est_relisible(atelier, mcp, tmp_path):
    """Le descriptif fait foi sur le lien entre un nom lisible et un identifiant.

    Comme en T6 : on **ouvre** ce qui est posé plutôt que de le mesurer. Un nom
    de fichier numéroté sans descriptif serait illisible une semaine plus tard.
    """
    source = tmp_path / "fiole.png"
    source.write_bytes(image_sujet())
    entre = atelier.generations.importer(source.read_bytes(), source.name)

    dossier = tmp_path / "jeu"
    sortie = await appeler(
        mcp,
        "export_assets",
        asset_ids=[entre["asset"]["identifiant"]],
        folder=str(dossier),
    )

    descriptif = json.loads(
        (dossier / "descriptif.json").read_text(encoding="utf-8")
    )
    fiches = descriptif["assets"]
    assert len(fiches) == 1
    fiche = fiches[0]
    assert fiche["identifiant"] == entre["asset"]["identifiant"]

    png = dossier / fiche["fichier"]
    assert png.is_file()
    with Image.open(png) as ouvert:
        assert (ouvert.width, ouvert.height) == (
            fiche["dimensions"]["largeur"],
            fiche["dimensions"]["hauteur"],
        )
    assert {Path(f["path"]).name for f in sortie["files"]} >= {"descriptif.json"}
