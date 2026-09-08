# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B14 — les règles du jeu**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8478 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b14.py

`sans-servir` en argument peuple et imprime le résumé sans lancer uvicorn.

## Ce qu'il monte, et pourquoi ces cas-là

**Trois jeux**, et chacun est un cas que la tranche doit tenir :

| Le jeu | Son état | Ce qu'il montre |
|---|---|---|
| **Le Marais du Vieux Moulin** | pixel · 64 px · vue *de dessus, verticale* · une bible écrite | le cas complet : le texte de caméra exact, les cinq lignes du monde |
| **Le Marais du Vieux Moulin** *(le second)* | créé du même nom | **l'homonyme** : dossier `-2`, et l'avertissement à la création |
| **Les Salines** | rien de réglé, **et du texte d'auteur dans `rendu` et `vue`** | la rature : ce qui ne part plus, montré sans être effacé |

Le dernier est le vrai sujet de la vérification. Sa bible porte, écrits comme
avant `B14` :

    rendu  : « gros pixels bien nets, 32 de côté »
    vue    : « vu du ciel, bien au-dessus »

Aucun des deux ne contient un mot de l'ancienne liste `_REDITES` — ni
`top-down`, ni `px grid`, ni `camera`. **C'est très exactement le cas que la
liste ne rattrapait pas**, et où deux consignes de caméra partaient dans le même
envoi. Ici, elles ne partent plus, et l'écran le dit.

**Rien n'a été payé** : aucune route de génération n'est appelée, aucun
fournisseur n'est sollicité.

## Ce qu'on vient voir à l'écran

1. Le carnet, section **Les règles du jeu** : une ligne neuve **« Les règles du
   jeu »**, au-dessus de *La toile de l'univers*, avec son compte `N / 5`.
2. Cliquer dessus ouvre le parcours **sur la liste des quatre étapes**, le
   carnet toujours visible à gauche — c'est ce qui le distingue de la création.
3. **Étape 3, sa vue** : le pavé *Ce que ce choix écrit, mot pour mot* porte la
   phrase de bible **et** le `CAMERA — this overrides everything above…`. Les
   comparer au fichier `atelier/domaine/vue.py` : c'est la même chaîne.
4. Choisir **De côté — plateforme** : une note dit que *De côté — défilement*
   écrit la même consigne, mot pour mot. Elle est **calculée** sur les textes
   servis, pas recopiée.
5. Retirer la vue n'est pas possible depuis l'écran — ouvrir **Les Salines**,
   qui n'en a pas : le pavé disparaît et la phrase *« Sans vue choisie,
   l'atelier n'écrit rien »* prend sa place.
6. **Étape 4, son monde**, sur **Les Salines** : les lignes *technique de
   rendu* et *vue et cadrage* n'ont **aucun champ** — elles portent leur phrase
   d'atelier et un lien *étape son allure ›* / *étape sa vue ›*. En dessous,
   la rature : *« Ce qui avait été tapé ici ne part plus : ~~vu du ciel, bien
   au-dessus~~ »*.
7. Ouvrir une des cinq autres lignes — **le trait** : les étiquettes livrées de
   cette case-là sont cliquables, et ce qui part est ce qui est écrit dans le
   champ.
8. **La création** : le nom du jeu en haut du carnet › *Tous les jeux* ›
   *+ Commencer un jeu*. Le parcours prend **la fenêtre entière**, s'ouvre sur
   l'étape 1, et montre le dossier prévu pendant qu'on tape.
9. Taper **« le  marais du vieux moulin »** (minuscules, deux espaces) et
   cliquer *Créer et choisir son allure* : le jeu **est créé**, et le parcours
   **reste sur l'étape 1** pour montrer l'avertissement d'homonyme. Un second
   clic continue — rien n'est refusé.
10. Sauter les trois étapes suivantes d'affilée (*Passer à sa vue*, *Passer à
    son monde*, *Ouvrir le jeu*) : le jeu existe, et **aucun réglage n'a été
    écrit**.

## ⚠️ Ce qu'il ne faut pas faire

Le lancer sur `donnees/` — il crée trois jeux et écrit dans leur bible. Le
dossier temporaire est imprimé à chaque lancement ; c'est lui qu'on efface
après.
"""

from __future__ import annotations

import sys
import tempfile
import time
from pathlib import Path

import uvicorn

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

PORT = 8478

CHAMPS_BIBLE = ("monde", "epoque", "rendu", "trait", "eclairage", "vue", "technique")


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _bible(client, **textes: str) -> None:
    """Poser des cases par leur nom — **les sept voyagent**, parce que la clé
    `bible` remplace la liste entière (le piège de `B9.7`, reconduit ici)."""
    _exiger(
        client.put(
            "/api/universe",
            json={
                "bible": [
                    {"nom": nom, "texte": textes.get(nom, ""), "actif": True}
                    for nom in CHAMPS_BIBLE
                ]
            },
        ),
        "la bible",
    )


def peupler(atelier: Atelier) -> dict:
    """Trois jeux, montés par les routes réelles — jamais par le dépôt."""
    client = TestClient(creer_application(atelier))
    monte: dict = {}

    # ── 1 · Le jeu complet ───────────────────────────────────────────────────
    marais = _exiger(
        client.post("/api/projects", json={"nom": "Le Marais du Vieux Moulin"}),
        "la création du Marais",
    )
    monte["marais"] = marais["projet"]
    monte["avertissement_du_marais"] = marais["avertissement"]

    _exiger(
        client.put(
            "/api/universe",
            json={
                "style": "pixel",
                "cible_px": 64,
                "methode_pixels": "proche",
                "vue": "vue-dessus-verticale",
            },
        ),
        "l'allure et la vue du Marais",
    )
    _bible(
        client,
        monde="misty marsh, abandoned mills, tea-coloured standing water",
        epoque="a damp Middle Ages, no visible magic — wood and iron tools",
        trait="clean line, one-pixel black outline, flat colours",
        eclairage="low late-day light, long shadows towards the east",
    )

    # ── 2 · L'homonyme ───────────────────────────────────────────────────────
    # **Le second jeu du même nom**, créé par la route réelle : c'est elle qui
    # décide du dossier (`-2`) et qui compose l'avertissement.
    jumeau = _exiger(
        client.post("/api/projects", json={"nom": "le  marais du vieux moulin"}),
        "la création de l'homonyme",
    )
    monte["jumeau"] = jumeau["projet"]
    monte["avertissement_du_jumeau"] = jumeau["avertissement"]

    # ── 3 · Le jeu qui porte du texte devenu inerte ──────────────────────────
    salines = _exiger(
        client.post("/api/projects", json={"nom": "Les Salines"}),
        "la création des Salines",
    )
    monte["salines"] = salines["projet"]

    # **Aucun de ces deux textes ne contenait un mot de l'ancienne liste** — ni
    # `top-down`, ni `px grid`, ni `camera`. C'est le cas que `_REDITES` ne
    # rattrapait pas, et où deux caméras partaient ensemble.
    _bible(
        client,
        monde="salt flats under a white sky",
        rendu="gros pixels bien nets, 32 de côté",
        vue="vu du ciel, bien au-dessus",
    )

    # On rouvre le Marais : c'est lui qu'on veut voir en arrivant.
    _exiger(
        client.put("/api/projects/current", json={"projet": monte["marais"]["identifiant"]}),
        "l'ouverture du Marais",
    )
    monte["univers_du_marais"] = _exiger(client.get("/api/universe"), "l'univers")
    monte["univers_des_salines"] = _exiger(
        client.get(f"/api/universe?projet={monte['salines']['identifiant']}"),
        "l'univers des Salines",
    )
    monte["vues"] = _exiger(client.get("/api/universe/views"), "les vues")["vues"]
    return monte


def principal(sans_servir: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents — le
    # même geste que `essais/essai_jetons.py`.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b14-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)

    depart = time.perf_counter()
    monte = peupler(atelier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s")
    print()
    print("  Les trois jeux, tels que le serveur les rend :")
    print(
        f"    · {monte['marais']['nom']:30s} → dossier « {monte['marais']['identifiant']} »"
    )
    print(
        f"    · {monte['jumeau']['nom']:30s} → dossier « {monte['jumeau']['identifiant']} »"
    )
    print(f"      avertissement : {monte['avertissement_du_jumeau'] or '(aucun)'}")
    print(
        f"    · {monte['salines']['nom']:30s} → dossier « {monte['salines']['identifiant']} »"
    )

    print()
    print("  Ce que l'atelier écrit lui-même, dans le Marais :")
    for nom, phrase in (monte["univers_du_marais"]["univers"]["phrases"] or {}).items():
        print(f"    · {nom:10s} {phrase}")

    print()
    print("  Ce qui ne part plus, dans Les Salines :")
    sans_effet = monte["univers_des_salines"]["atelier"]["sans_effet"]
    if not sans_effet:
        print("    (rien — le montage n'a rien écrit dans les cases de l'atelier)")
    for nom, texte in sans_effet.items():
        print(f"    · {nom:10s} « {texte} »  ← montré barré, jamais effacé")

    la_vue = next(
        v for v in monte["vues"] if v["identifiant"] == "vue-dessus-verticale"
    )
    print()
    print("  Le texte de caméra exact que l'écran doit afficher, mot pour mot :")
    print(f"    View and framing: {la_vue['phrase']}")
    print(f"    {la_vue['contrainte']}")
    print(f"    {la_vue['volume']}")
    print(f"    {la_vue['corps']}")

    # **Les deux vues jumelles**, calculées et non recopiées — la même
    # comparaison que l'écran fait.
    jumelles = [
        v["libelle"]
        for v in monte["vues"]
        if v["contrainte"]
        == next(x["contrainte"] for x in monte["vues"] if x["identifiant"] == "vue-cote-plateforme")
    ]
    print()
    print(f"  Deux vues écrivent la même consigne : {' · '.join(jumelles)}")

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → carnet › LES RÈGLES DU JEU › « Les règles du jeu » (la ligne neuve)")
    print("  → étape 3 : le texte de caméra, à comparer aux lignes ci-dessus")
    print("  → ouvrir « Les Salines » : sans vue, l'écran le dit — et l'étape 4")
    print("     montre les deux ratures de `rendu` et `vue`")
    print("  → nom du jeu › Tous les jeux › + Commencer un jeu : le parcours plein cadre")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    if sans_servir:
        print("  (sans-servir : uvicorn n'a pas été lancé)")
        return 0

    sys.stdout.flush()
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal(sans_servir="sans-servir" in sys.argv[1:]))
