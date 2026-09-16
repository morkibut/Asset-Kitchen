# -*- coding: utf-8 -*-
"""RP17 — **une seule porte pour faire sortir un personnage**.

Deux chemins écrivaient dans le dossier du jeu. L'ancien posait un personnage
nommé tout de suite, sans aperçu et sans comparaison ; le nouveau, B21, montre
ses fichiers, dit lesquels remplacent quoi, et écrit ensuite. Le second avait
été construit **à côté** du premier, jamais à sa place.

Ce que ce fichier éprouve n'est pas un geste de plus mais **une absence tenue** :
qu'il ne reste qu'un écrivain, que ce qu'il sait faire couvre ce que l'autre
savait, et que l'agent et l'écran en aient exactement autant l'un que l'autre.
Sans ces essais, l'ancienne porte peut revenir sans que rien ne tombe — c'est la
leçon de `RP18`, reprise telle quelle.

Les essais du geste lui-même — les fichiers, le descriptif, les refus — vivent
dans `tests/test_c5.py`, réécrits sur la porte retenue. Ici on vérifie la
tranche, pas la sortie.
"""

from __future__ import annotations

import ast
from pathlib import Path

from test_c3 import _cases, _corps, _habiller, _personnage, _piece
from tests.test_t7 import appeler, mcp, refuser  # noqa: F401

RACINE = Path(__file__).resolve().parent.parent


def _habille(client, double, poses: int = 1) -> str:
    personnage, plan = _personnage(client, poses)
    _corps(client, double, personnage, plan)
    _habiller(client, double, personnage, _piece(client), plan)
    return personnage


# ── Critère 1 · Un seul chemin écrit dans le dossier du jeu ──────────────────


def test_un_seul_service_pose_des_fichiers_dans_le_dossier_du_jeu():
    """`ServiceAgent.deposer` est le geste qui écrit dehors ; **qui l'appelle**
    est la question de la tranche.

    Ils étaient trois : l'export d'un personnage, le dépôt d'une sélection, et
    la sortie de B21. Il en reste un — plus la façade MCP, qui pose l'image que
    l'agent vient de payer là où il code, un fichier à la fois, et que `T7`
    porte depuis toujours.

    ⚠️ **Ça se lit dans le code, pas à l'exécution** : un appelant neuf ajouté
    demain passerait tous les essais du produit sans que rien ne le signale.
    """
    appelants = set()
    for fichier in sorted((RACINE / "atelier").rglob("*.py")):
        source = fichier.read_text(encoding="utf-8")
        if ".deposer(" not in source:
            continue
        arbre = ast.parse(source)
        for noeud in ast.walk(arbre):
            if (
                isinstance(noeud, ast.Call)
                and isinstance(noeud.func, ast.Attribute)
                and noeud.func.attr == "deposer"
            ):
                appelants.add(fichier.relative_to(RACINE).as_posix())

    assert appelants == {
        # La porte retenue, et elle seule côté services.
        "atelier/services/sortie.py",
        # La façade de T7 : une image posée où l'agent code, jamais un lot.
        "atelier/mcp/serveur.py",
    }, appelants


def test_l_export_ne_sait_plus_ecrire_dans_le_dossier_du_jeu():
    """Le service qui fabrique ne pose plus rien dehors (`RP17`).

    Il rend des archives au navigateur et des fiches à qui les écrit. Lui
    laisser le dépôt aurait laissé croire qu'une seconde porte dort là.
    """
    from atelier.services import export

    assert not hasattr(export.ServiceExport, "exporter_personnage")
    assert not hasattr(export.ServiceExport, "deposer")
    assert not hasattr(export, "Sortie")


def test_l_ancienne_route_et_l_ancien_outil_ne_repondent_plus(
    client, double, tmp_path
):
    """Les deux adresses de l'ancienne porte, côté écran et côté agent."""
    personnage = _habille(client, double)

    refus = client.post(
        f"/api/characters/{personnage}/export", json={"dossier": str(tmp_path)}
    )
    assert refus.status_code == 405, refus.text

    source = (RACINE / "atelier/mcp/serveur.py").read_text(encoding="utf-8")
    assert 'name="export_character"' not in source
    assert 'name="export_assets"' not in source


def test_l_apercu_ne_touche_pas_au_disque(client, double, tmp_path):
    """« Il prévisualise avant d'écrire » — et prévoir ne crée rien.

    Cliquer ne coûte jamais (`docs/DESIGN.md`, règle 1) : on demande dix fois
    l'aperçu d'un dossier qui n'existe pas, et il n'existe toujours pas.
    """
    personnage = _habille(client, double)
    dossier = tmp_path / "jeu" / "assets"

    for _ in range(10):
        vu = client.post(
            "/api/output/preview",
            json={"sujet": personnage, "dossier": str(dossier)},
        )
        assert vu.status_code == 200, vu.text
        assert vu.json()["compte"] > 0
    assert not dossier.exists()


# ── Critère 2 · Sortir un seul personnage reste possible ─────────────────────


def test_un_seul_sujet_sort_et_le_reste_du_jeu_ne_bouge_pas(
    client, double, tmp_path
):
    """Le sujet nommé emporte **ses** images, et il ne parle que de lui.

    Le second sujet du jeu n'a aucune image : le lot entier le dit dans la
    colonne de ce qui n'est pas prêt, et la sortie d'un seul sujet ne le
    mentionne pas — la réduction porte sur les deux listes, pas seulement sur
    l'arbre.
    """
    nain = _habille(client, double)
    client.post(
        "/api/characters", json={"nom": "Le pèlerin", "description": "un marcheur"}
    )
    dossier = tmp_path / "jeu"

    entier = client.post(
        "/api/output/preview", json={"dossier": str(dossier)}
    ).json()
    assert [
        s["nom"] for a in entier["pas_prets"] for s in a["sujets"]
    ] == ["Le pèlerin"]

    sortie = client.post(
        "/api/output", json={"sujet": nain, "dossier": str(dossier)}
    )
    assert sortie.status_code == 200, sortie.text
    ecrits = [f for f in sortie.json()["ecrits"] if f["role"] != "descriptif"]
    assert ecrits and {f["sujet"] for f in ecrits} == {nain}
    assert all(f["chemin"].startswith("nain-") for f in ecrits)

    seul = client.post(
        "/api/output/preview", json={"sujet": nain, "dossier": str(dossier)}
    ).json()
    assert seul["pas_prets"] == []
    # Et ce qu'il aurait écrit est exactement ce que le lot entier annonçait
    # pour lui : réduire ne change ni les noms, ni le rangement.
    assert {f["chemin"] for f in seul["fichiers"]} <= {
        f["chemin"] for f in entier["fichiers"]
    }


def test_le_lot_ne_decide_plus_rien_quand_un_sujet_est_nomme(
    client, double, tmp_path
):
    """Deux réglages qui trancheraient la même question se contrediraient.

    *Lot = les décors, sujet = un personnage* n'a aucune réponse juste : le
    sujet gagne, et c'est écrit une fois — dans `Reglage.sujet`.
    """
    nain = _habille(client, double)
    dossier = tmp_path / "jeu"

    prevu = client.post(
        "/api/output/preview",
        json={"sujet": nain, "lot": "decors", "dossier": str(dossier)},
    ).json()
    assert prevu["compte"] > 0
    assert {f["sujet"] for f in prevu["fichiers"] if f["sujet"]} == {nain}


def test_un_sujet_inconnu_se_dit_au_lieu_de_sortir_un_lot_vide(client, tmp_path):
    """Une coquille dans un identifiant se lisait « rien ne sort de ce lot »,
    et l'agent serait allé chercher la panne du côté des images."""
    refus = client.post(
        "/api/output",
        json={"sujet": "le-passeur", "dossier": str(tmp_path / "jeu")},
    )
    assert refus.status_code == 409
    assert "n'est pas un sujet de ce jeu" in refus.json()["raison"]


# ── Critère 3 · Parité écran / agent ─────────────────────────────────────────


async def test_l_agent_et_l_ecran_recoivent_la_meme_sortie(
    atelier, mcp, client, double, tmp_path
):
    """« Ce que l'agent peut faire, l'écran le peut aussi, et l'inverse. »

    Éprouvé sur ce qui compte : **les mêmes fichiers, aux mêmes chemins, aux
    mêmes marques**, pour le même réglage. Deux chemins de code qui rendraient
    deux listes voudraient dire que la parité est une intention et non un fait.
    """
    personnage = _habille(client, double)
    dossier = tmp_path / "jeu"

    a_l_ecran = client.post(
        "/api/output/preview",
        json={"sujet": personnage, "dossier": str(dossier), "rangement": "en_dossiers"},
    ).json()
    pour_l_agent = await appeler(
        mcp,
        "preview_output",
        subject="Nain",
        folder=str(dossier),
        layout="en_dossiers",
    )

    assert [(f["chemin"], f["marque"], f["role"]) for f in a_l_ecran["fichiers"]] == [
        (f["chemin"], f["marque"], f["role"]) for f in pour_l_agent["fichiers"]
    ]
    # Le poids du descriptif seul diffère d'un octet d'un appel à l'autre : il
    # porte l'heure de sa fabrication. Les images, elles, pèsent la même chose.
    assert [f["octets"] for f in a_l_ecran["fichiers"] if f["role"] != "descriptif"] == [
        f["octets"] for f in pour_l_agent["fichiers"] if f["role"] != "descriptif"
    ]


async def test_les_cinq_reglages_de_l_ecran_sont_ceux_de_l_agent(
    atelier, mcp, client, double
):
    """L'agent ne reçoit pas un sous-ensemble : il a les cinq listes fermées,
    et le sujet, comme l'écran."""
    _habille(client, double)
    outils = {o.name: o for o in await mcp.list_tools()}

    for nom in ("preview_output", "write_output"):
        attendus = set(outils[nom].input_schema["properties"])
        assert attendus == {
            "project",
            "subject",
            "lot",
            "folder",
            "layout",
            "on_collision",
            "engine",
        }, nom

    # Et l'écran reçoit les sujets du serveur, jamais une liste à lui.
    reglages = client.get("/api/output/settings").json()
    assert [s["nom"] for s in reglages["sujets"]] == ["Nain"]


async def test_l_agent_n_a_aucune_porte_que_l_ecran_n_a_pas(mcp):
    """Un outil qui écrirait dans le dossier du jeu sans route jumelle serait
    très exactement le doublon que la tranche referme."""
    noms = {o.name for o in await mcp.list_tools()}
    assert "export_character" not in noms
    assert "export_assets" not in noms
    assert {"preview_output", "write_output"} <= noms


# ── Critère 4 · Les variantes archive ────────────────────────────────────────


def test_les_trois_archives_repondent_toujours(client, double):
    """**Elles restent, et c'est une décision** (`RP17`).

    Une archive revient au navigateur : elle n'écrit rien dans le dossier du
    jeu, donc elle n'est pas une seconde porte. Les retirer aurait coûté à
    l'auteur le seul moyen d'emporter une sélection sans nommer de dossier.
    """
    personnage = _habille(client, double)
    images = [
        image["identifiant"]
        for case in _cases(client, personnage)
        for image in case["images"]
    ]
    assert images

    selection = client.post("/api/exports", json={"identifiants": images[:1]})
    assert selection.status_code == 200
    assert selection.headers["content-type"] == "application/zip"

    animations = client.post(
        f"/api/characters/{personnage}/strips/export", json={}
    )
    assert animations.status_code in (200, 409)

    bandes = client.post("/api/strips/export", json={"identifiants": []})
    # Vide, elle refuse avec sa phrase — la route, elle, répond.
    assert bandes.status_code == 409


# ── Critère 5 · Rien n'est écrasé sans que la comparaison l'ait annoncé ──────


def test_ce_qui_est_ecrase_a_ete_annonce_remplace(client, double, tmp_path):
    """La comparaison est lue **avant** le bouton, et elle porte sur les octets.

    On sort, on retouche une image, on redemande l'aperçu : le fichier qui va
    changer est marqué *remplace*, et le disque porte encore l'ancien tant qu'on
    n'a pas écrit.
    """
    personnage = _habille(client, double)
    dossier = tmp_path / "jeu"
    corps = {"sujet": personnage, "dossier": str(dossier)}

    client.post("/api/output", json=corps)
    images = sorted(p for p in dossier.iterdir() if p.suffix == ".png")
    avant = {p.name: p.read_bytes() for p in images}

    cible = _cases(client, personnage)[0]
    asset = cible["images"][0]["identifiant"]
    client.put(
        f"/api/assets/{asset}/recipe",
        json={"passes": [{"moteur": "bord"}], "recadrage": {"marge": 0}},
    )

    apercu = client.post("/api/output/preview", json=corps).json()
    annonces = {
        f["chemin"] for f in apercu["fichiers"] if f["marque"] == "remplace"
    }
    assert annonces & set(avant), apercu["fichiers"]
    for nom, octets in avant.items():
        assert (dossier / nom).read_bytes() == octets

    bilan = client.post("/api/output", json=corps).json()
    changes = {
        nom for nom, octets in avant.items() if (dossier / nom).read_bytes() != octets
    }
    # **Rien de plus que ce qui était annoncé.** Un fichier écrasé sans marque
    # serait le défaut que la tranche existe pour fermer.
    assert changes <= annonces
    assert {f["chemin"] for f in bilan["ecrits"]} <= annonces | {"descriptif.json"}


def test_un_calque_ne_part_jamais_sans_son_corps(client, double, tmp_path):
    """La règle de C5, **retrouvée** en refermant l'autre porte.

    Un calque est une différence posée sur un corps ; seul dans un dossier de
    jeu, il ne se pose sur rien. La sortie de B21 les laissait partir quand le
    corps de leur pose avait disparu — personne ne l'avait vu, parce que l'essai
    qui le disait visait la porte d'à côté.
    """
    personnage = _habille(client, double)
    case = _cases(client, personnage)[0]
    assert case["calques"]
    client.post(
        "/api/assets/delete",
        json={"identifiants": [case["images"][0]["identifiant"]]},
    )

    refus = client.post(
        "/api/output", json={"sujet": personnage, "dossier": str(tmp_path / "jeu")}
    )
    assert refus.status_code == 409
    assert "rien ne sort" in refus.json()["raison"]
    assert not (tmp_path / "jeu").exists()
