# -*- coding: utf-8 -*-
"""L'atelier jetable des **calques d'équipement** — Champy, sa pose, son bâton.

**L'auteur travaille sur le port 8420.** Cet atelier-ci vit sur un dossier
temporaire, sur le port **8506** : rien n'est écrit dans `donnees/`.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_equipement.py

`sans-servir` en argument peuple, imprime le résumé et rend la main sans lancer
`uvicorn`.

## Ce qu'il monte

Le cas relevé sur le disque de l'auteur le 18 septembre 2026, en petit :

| Ce qui est monté | Pourquoi |
|---|---|
| **Champy**, deux directions (sud, est) | le porteur |
| La pose **repos · est**, réglée comme sur le disque de l'auteur : détourage, recadrage à marge nulle, grille **en veille**, palette de six couleurs — son cadre est donc son corps, exactement | la pose de référence, « déjà traitée » |
| La pose **repos · sud**, même recette, avec un **bâton court déjà retenu** en calque | une seconde cible, et un calque déjà posé qui doit suivre quand le cadre grandit |
| Une génération **« avec un bâton »** qui avait *repos · est* en image à modifier, et qui rend une image de 1024 × 1024 sur fond rose, le personnage trois fois plus grand et décalé, un bâton **tenu à côté du corps et plus haut que le chapeau** | l'image équipée, telle qu'un modèle la rend — le bâton déborde à droite et en haut du cadre de la pose |
| La pièce **Bâton**, portée par Champy | l'emploi où l'on travaille |

**Rien n'a été payé.** Le fournisseur est le double de `tests/conftest.py`.

Depuis le 18 septembre 2026, le bâton qui déborde **agrandit le cadre** au lieu
d'être coupé : l'écrin de Champy grandit, repos · sud suit, et l'écran le dit en
une phrase. `sans-servir` joue ce geste sur le dossier jetable et imprime ce
qu'il a donné.
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import uvicorn
from PIL import Image

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine.recette import Recette  # noqa: E402
from atelier.services import Atelier  # noqa: E402

# Le double des essais, **importé et pas recopié**.
from conftest import AnimateurMuet, FournisseurDouble  # noqa: E402

PORT = 8506
MODELE = "essai:rend-du-png"

ROSE = (255, 112, 181)  # le fond plat que l'atelier demande aux modèles
COULEURS = {
    "C": (196, 68, 41),    # le chapeau
    "p": (234, 228, 213),  # ses pois
    "v": (231, 216, 183),  # le visage
    "G": (73, 90, 48),     # la cape
    "b": (226, 218, 200),  # le pantalon
    "B": (122, 78, 47),    # les bottes
    "T": (170, 120, 60),   # le bâton — absent de la palette de la pose, exprès
}
PALETTE = ["#%02x%02x%02x" % COULEURS[c] for c in "CpvGbB"]

# Champy, un bloc par caractère. Seize de large, trente-quatre de haut.
CHAMPY = [
    ".....CCCCCC.....",
    "...CCCCppCCCC...",
    "..CCpCCCCCCCCC..",
    ".CCCCCCCCCpCCCC.",
    "CCppCCCCCCCCCCCC",
    "CCppCCCCCCCCppCC",
    "CCCCCCCpCCCCppCC",
    "CCCCCCCCCCCCCCCC",
    ".CCCCCCCCCCCCCC.",
    "...CCCCCCCCCC...",
    ".....vvvvvv.....",
    ".....vvvvvv.....",
    ".....vvvvvv.....",
    ".....vvvvvv.....",
    ".....vvvvvv.....",
    ".....vvvvvv.....",
    "...GGGGGGGGGG...",
    "..GGGGGGGGGGGG..",
    "..GGGGGGGGGGGG..",
    "..GGGGGGGGGGGG..",
    "..GGGGGGGGGGGG..",
    "..GGGGGGGGGGGG..",
    "..GGGGGGGGGGGG..",
    "...GGGGGGGGGG...",
    "...GGGGGGGGGG...",
    "....bbbbbbbb....",
    "....bbbbbbbb....",
    "....bbbbbbbb....",
    "....bbbbbbbb....",
    "...BBBB..BBBB...",
    "...BBBB..BBBB...",
    "...BBBB..BBBB...",
    "..BBBBB..BBBBB..",
    "..BBBBB..BBBBB..",
]


def champy(bloc: int, toile: tuple[int, int], coin: tuple[int, int], *, baton: bool = False, miroir: bool = False) -> bytes:
    """Champy peint sur son fond rose, un bloc de `bloc` pixels par case.

    Le bâton est tenu **à côté** du corps, à droite, un bloc d'air entre les
    deux, et sa pointe dépasse de trois blocs au-dessus du chapeau : dans une
    pose recadrée à marge nulle, il n'a aucune place — ni à droite, ni en haut.
    C'est le cas de Champy sur le disque de l'auteur, et c'est ce que l'écrin
    doit garder entier.
    """
    lignes = [ligne[::-1] if miroir else ligne for ligne in CHAMPY]
    haut = 3 if baton else 0
    large = 19 if baton else 16
    petite = Image.new("RGB", (large, 34 + haut), ROSE)
    for y, ligne in enumerate(lignes):
        for x, lettre in enumerate(ligne):
            if lettre != ".":
                petite.putpixel((x, y + haut), COULEURS[lettre])
    if baton:
        for y in range(0, 34 + haut):
            for x in (17, 18):
                petite.putpixel((x, y), COULEURS["T"])
    grande = petite.resize((large * bloc, (34 + haut) * bloc), Image.Resampling.NEAREST)
    fond = Image.new("RGB", toile, ROSE)
    fond.paste(grande, (coin[0], coin[1] - haut * bloc))
    tampon = io.BytesIO()
    fond.save(tampon, format="PNG")
    return tampon.getvalue()


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}")
    return reponse.json()


def _attendre(client, generation: str) -> dict:
    for _ in range(600):
        etat = client.get(f"/api/generations/{generation}").json()
        if etat["statut"] in ("reussie", "echouee"):
            return etat
        time.sleep(0.01)
    return client.get(f"/api/generations/{generation}").json()


def peupler(atelier: Atelier, double: FournisseurDouble, dossier: Path) -> dict:
    monte: dict = {}
    images = dossier / "a-importer"
    images.mkdir(parents=True, exist_ok=True)
    with TestClient(creer_application(atelier)) as client:
        monte["projet"] = client.get("/api/library").json().get("courant")
        personnage = _exiger(client.post("/api/characters", json={"nom": "Champy", "description": "un petit champignon en cape verte"}), "Champy")["personnage"]
        champy_id = personnage["identifiant"]
        for nom in ("Sud", "Est"):
            _exiger(client.post("/api/characters/directions", json={"nom": nom}), f"la direction {nom}")

        # La recette de Champy sur le disque de l'auteur : la grille est là mais
        # en veille, donc la pose sort à la taille de son corps, sans une marge.
        recette = {
            "passes": [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}],
            "recadrage": {"marge": 0},
            "grille": {"cible": 64, "occupation": 100, "ancrage": "bas"},
            "quantification": {"couleurs": len(PALETTE), "palette": PALETTE},
            "veille": ["grille"],
        }
        poses = {}
        for direction, miroir in (("sud", True), ("est", False)):
            chemin = images / f"champy-repos-{direction}.png"
            chemin.write_bytes(champy(7, (150, 280), (19, 20), miroir=miroir))
            asset = _exiger(client.post("/api/assets/import", json={"chemin": str(chemin), "forcer": True}), f"la pose {direction}")["asset"]
            _exiger(client.put(f"/api/assets/{asset['identifiant']}/character",
                               json={"personnage": champy_id, "pose": "repos", "direction": direction}), f"le rangement de repos · {direction}")
            _exiger(client.put(f"/api/assets/{asset['identifiant']}/recipe", json=recette), f"la recette de repos · {direction}")
            poses[direction] = asset["identifiant"]
        monte["poses"] = poses

        # ── La génération « avec un bâton », d'après repos · est ─────────────
        double.rendre = lambda: champy(23, (1024, 1024), (330, 110), baton=True)
        lancee = _exiger(client.post("/api/generations", json={
            "modele": MODELE, "prompt": "Champy, the same image, holding a wooden staff",
            "references": [{"asset": poses["est"], "role": "edition"}],
        }), "la génération avec un bâton")
        generation = _attendre(client, lancee["identifiant"])
        double.rendre = None
        if generation["statut"] != "reussie":
            raise SystemExit(f"la génération avec un bâton n'a pas abouti : {generation}")
        monte["equipee"] = f"{generation['identifiant']}-0"

        # ── La pièce, portée par Champy ──────────────────────────────────────
        piece = _exiger(client.post("/api/characters/pieces", json={"nom": "Bâton", "description": "un bâton de marche en bois", "porteur": champy_id}), "la pièce")["piece"]
        monte["piece"] = piece
        emploi = atelier.equipement.emplois(monte["projet"], piece["identifiant"])[0]
        monte["emploi"] = emploi.identifiant

        # ── Un bâton court, déjà retenu sur repos · sud ──────────────────────
        # Il est dans le cadre de sa pose : c'est le calque qui doit *suivre*
        # quand le bâton d'est fera grandir le cadre, sans perdre un pixel.
        prefixe = f"/api/projects/{monte['projet']}/equipment/{piece['identifiant']}/uses/{emploi.identifiant}"
        with Image.open(io.BytesIO(client.get(prefixe + "/targets/preview.png", params={"nature": "image", "resultat": poses["sud"]}).content)) as base_sud:
            largeur, hauteur = base_sud.size
        court = Image.new("RGBA", (largeur, hauteur), (0, 0, 0, 0))
        court.paste((*COULEURS["T"], 255), (largeur // 4, hauteur // 2, largeur // 4 + 10, hauteur - 20))
        chemin = images / "baton-court-sud.png"
        court.save(chemin)
        court_id = _exiger(client.post("/api/assets/import", json={"chemin": str(chemin), "forcer": True}), "le bâton court")["asset"]["identifiant"]
        objet = atelier.assets.lire(court_id)
        objet.recette = Recette()
        atelier.assets.sauver(objet)
        sud = _exiger(client.post(prefixe + "/layers", json={"cible": {"nature": "image", "resultat": poses["sud"], "prise": ""},
                                                              "source": court_id, "role": "calque"}), "le calque de sud")
        sud = _exiger(client.post(prefixe + f"/layers/{sud['identifiant']}/validate", json={"revision": sud["revision"]}), "la retenue du calque de sud")
        monte["calque_sud"] = sud

        # Ce que l'écran demandera : la pose nommée, et l'image proposée.
        monte["references"] = _exiger(client.get(prefixe + "/targets/references", params={"source": monte["equipee"]}), "la pose de référence")["poses"]
        monte["proposees"] = _exiger(client.get(prefixe + "/targets/made-from", params={"resultat": poses["est"]}), "les images fabriquées d'après repos · est")["images"]
    return monte


def verifier(atelier: Atelier, monte: dict) -> None:
    """Le clic de l'auteur, joué une fois sur le dossier jetable : ce qu'il donne."""
    svc = atelier.calques_cibles
    chemin = (monte["projet"], monte["piece"]["identifiant"], monte["emploi"])
    v = svc.creer(*chemin, None, monte["equipee"], "source-equipee")
    agrandi = v["preparation"].get("agrandi")
    if agrandi is None:
        raise SystemExit("le bâton n'a pas fait grandir le cadre — à regarder : " + str(v["preparation"]))
    source = np.asarray(Image.open(io.BytesIO(svc.apercu(*chemin, v["identifiant"], "source"))).convert("RGBA")).astype(int)
    bois = int(((source[:, :, 3] >= 128) & (np.abs(source[:, :, :3] - COULEURS["T"]).max(axis=2) < 30)).sum())
    sud = svc.lire(*chemin, monte["calque_sud"]["identifiant"])
    print("  Vérifié (sans-servir) — le clic sur « Fabriquées d’après cette pose » :")
    print(f"    cadre de repos · est : {agrandi['avant']['largeur']} × {agrandi['avant']['hauteur']} → "
          f"{agrandi['apres']['largeur']} × {agrandi['apres']['hauteur']} px, côtés {agrandi['cotes']}")
    print(f"    repère : {v['base']['repere']}, écrin : {v['base'].get('ecrin')}")
    print(f"    pixels de bois dans l'image équipée lue : {bois}, dehors : {v['preparation']['dehors']}")
    print(f"    repos · sud a suivi : cadre {sud['base']['cadre']}, révision {sud['revision']}, "
          f"toujours retenu : {sud['utilisable']}")
    print()


def principal(sans_servir: bool = False) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-equipement-"))
    print(f"Dossier jetable : {dossier}")
    double = FournisseurDouble()
    atelier = Atelier(racine=dossier, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurMuet())

    depart = time.perf_counter()
    monte = peupler(atelier, double, dossier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s — aucun appel payant, aucun réseau")
    print(f"  Jeu      : {monte['projet']}")
    print(f"  Poses    : repos · sud = {monte['poses']['sud']}, repos · est = {monte['poses']['est']}")
    print(f"  Équipée  : {monte['equipee']} (1024 × 1024, fond rose, bâton en plus)")
    print(f"  Pièce    : {monte['piece']['nom']} — emploi {monte['emploi']}")
    print("  Pose relue sur la génération : " + (", ".join(f"{p['pose']} · {p['direction']} ({p['raison']})" for p in monte["references"]) or "AUCUNE — à regarder"))
    print(f"  Proposées sur repos · est : {len(monte['proposees'])}")
    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Champy › onglet « Équipement » › « Bâton » › « Portée par Champy »")
    print("  → d’abord repos › sud : le bâton court retenu, dans un cadre de la taille de la pose")
    print("  → puis repos › est : « Fabriquées d’après cette pose » propose l’image au bâton — un clic")
    print("  → la scène montre les deux corps superposés, le bâton entier à droite et au-dessus du chapeau")
    print("  → à droite, étape 2 : « Cadre agrandi de … px à gauche et à droite et … px en haut pour Bâton … :")
    print("    rien n’est coupé. Même cadre pour la direction sud de repos. » — plus d’avertissement")
    print("  → étape 1 : la pose « posée au pied d’un cadre commun » ; 3 · le calage reste à 1 et 0, 0")
    print("  → « Ce qui sera extrait », puis 4 · « Extraire une nouvelle variante » : le bâton sort entier")
    print("  → retour sur repos › sud : « Cadre agrandi … pour suivre Bâton de repos · est », toujours retenu")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    if sans_servir:
        verifier(atelier, monte)
        print("  (sans-servir : uvicorn n'a pas été lancé)")
        return 0

    # Un second `Atelier` sur le même dossier : deux `creer_application` sur une
    # même instance lèvent (voir `essais/atelier_jetable_rp.py`).
    servi = Atelier(racine=dossier, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurMuet())
    sys.stdout.flush()
    uvicorn.run(creer_application(servi), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal(sans_servir="sans-servir" in sys.argv[1:]))
