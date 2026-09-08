# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B18 — Pixéliser, quatre
moteurs neufs**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8490 : rien n'est écrit dans
`donnees/`, et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b18_pixeliser.py

`sans-servir` en argument peuple et imprime le résumé sans lancer uvicorn.

## Ce qu'il monte, et pourquoi ces sujets-là

**Cinq personnages, cinq images pensées pour montrer une seule différence à
la fois** — le geste de `essais/atelier_jetable_b17.py` : ce qui les sépare
est une recette, jamais une génération, et rien n'est payé.

| Le personnage | L'image | Ce qu'on vient voir |
|---|---|---|
| **Le témoin (vote)** | peinte sur une vraie grille de 8 px | la méthode par défaut du jeu, pour comparer |
| **Sur les carrés du modèle** | la même image | le contour cesse d'hésiter entre le fond et le sujet |
| **Couleur dominante de case** | deux aplats francs et un grain isolé | l'aplat garde sa couleur exacte, jamais une moyenne |
| **Médiane de case** | un aplat piqué de grain, sans grille | le grain disparaît, le bord ne bave pas |
| **Réduction douce en lumière juste** | un damier noir et blanc très contrasté | le gris moyen reste clair, pas sale |

**Rien n'a été payé** : les images arrivent par `/api/assets/import`, jamais
par une route de génération. Le script marche réseau coupé.

## Ce qu'on vient voir à l'écran

1. **Codex › Personnages › chaque personnage › Retoucher › Pixéliser.** Le
   segment « façon de réduire » porte maintenant huit crans, pas quatre — les
   quatre premiers existaient déjà, les quatre derniers sont ceux de cette
   tranche.
2. **Le témoin et « sur les carrés du modèle »** partent de la même image :
   comparer les deux rendus au zoom montre le contour qui cesse de porter des
   points ni tout à fait fond, ni tout à fait sujet.
3. **« Couleur dominante de case »** : l'aplat ocre et l'aplat vert restent
   francs jusqu'au bord ; passer sur « vote en deux temps » sur la même image
   fait apparaître une bande intermédiaire que ni l'un ni l'autre aplat ne
   portait.
4. **« Médiane de case »** : le grain rouge disparaît sans qu'aucun bord ne
   devienne flou ; passer sur « au plus proche » le fait parfois survivre,
   parfois disparaître, au hasard du pixel tiré.
5. **« Réduction douce en lumière juste »** contre « réduction douce » sur le
   même damier : la seconde sort visiblement plus sombre.
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
from atelier.services import Atelier  # noqa: E402

# Le double des essais, importé et pas recopié — même raison qu'en B17 : deux
# doubles qui divergeraient finiraient par ne plus décrire le même produit.
from conftest import image_sujet  # noqa: E402

PORT = 8490

FOND = "#FF00FF"
MAGENTA = (255, 0, 255)


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _sur_fond_magenta(octets: bytes) -> bytes:
    """La même image, reposée sur un fond magenta franc — le geste de B17."""
    with Image.open(io.BytesIO(octets)) as image:
        tableau = np.asarray(image.convert("RGB")).copy()
    coin = tableau[0, 0].copy()
    fond = np.all(tableau == coin, axis=2)
    tableau[fond] = MAGENTA
    tampon = io.BytesIO()
    Image.fromarray(tableau, mode="RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _pelerin_sur_une_grille() -> bytes:
    """Un sujet peint sur une vraie grille de 8 px, sur fond magenta.

    **`toile=32, bloc=8`, et pas les valeurs par défaut du conftest** —
    `tests/test_d2.py::test_la_grille_du_modele_voyage_par_la_route_des_mesures`
    prévient que l'image par défaut du conftest n'occupe qu'un tiers de sa
    toile et ne porte donc aucune grille détectable. Ces proportions-ci
    mesurent une netteté de 0,46, bien au-dessus du seuil de 0,35 : c'est le
    cas que `sur_modele` vise en premier.
    """
    return _sur_fond_magenta(
        image_sujet(toile=32, bloc=8, logique_l=20, logique_h=26)
    )


def _aplats_avec_grain(cote: int = 256) -> bytes:
    """Deux aplats francs et une trentaine de pixels de grain isolé, peints
    quatre fois plus grand que la case du jeu.

    **`cote=256`, et pas la taille de la case** : peinte à 64 px pile, il n'y
    a rien à réduire — chaque pixel source est déjà un pixel de la case, et
    `dominante`/`mediane` retombent sur une case de un pixel, où rien ne se
    départage. À 256, la réduction fait vraiment un choix par case de 4×4
    pixels sources, et c'est cette case-là que `dominante` et `mediane`
    visent : `dominante` doit garder les deux aplats intacts jusqu'à leur
    frontière, `mediane` doit effacer le grain sans faire baver cette même
    frontière.
    """
    tableau = np.full((cote, cote, 3), MAGENTA, dtype=np.uint8)
    haut, bas = cote // 8, cote - cote // 8
    gauche, droite = int(cote * 0.19), cote - int(cote * 0.19)
    milieu = (haut + bas) // 2
    tableau[haut:milieu, gauche:droite] = (200, 170, 60)  # un aplat ocre
    tableau[milieu:bas, gauche:droite] = (60, 130, 90)  # un aplat vert

    # Le grain : un seul pixel source à chaque tirage, donc une fraction d'une
    # case de 4×4 une fois réduit — trop peu pour jamais dominer un vote, et
    # trop peu pour peser sur une médiane de seize valeurs.
    rng = np.random.RandomState(7)
    for _ in range(28):
        y = int(rng.randint(haut + 4, bas - 4))
        x = int(rng.randint(gauche + 4, droite - 4))
        tableau[y, x] = (230, 30, 30)

    tampon = io.BytesIO()
    Image.fromarray(tableau, mode="RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _damier_contraste(cote_sujet: int = 240, pas: int = 6, marge: int = 24) -> bytes:
    """Un damier noir et blanc très contrasté, sur fond magenta.

    Réduit par « réduction douce », il sort visiblement plus sombre qu'au
    regard — c'est très exactement ce que `lumiere_juste` répare en moyennant
    en lumière linéaire plutôt qu'en octets sRGB.
    """
    cote = cote_sujet + 2 * marge
    tableau = np.full((cote, cote, 3), MAGENTA, dtype=np.uint8)
    ys, xs = np.mgrid[0:cote_sujet, 0:cote_sujet]
    damier = (((xs // pas) + (ys // pas)) % 2 * 255).astype(np.uint8)
    sujet = np.repeat(damier[:, :, None], 3, axis=2)
    tableau[marge : marge + cote_sujet, marge : marge + cote_sujet] = sujet

    tampon = io.BytesIO()
    Image.fromarray(tableau, mode="RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _recette(*, sans_grille: bool = False, methode: str = "vote") -> dict:
    """La chaîne ordinaire du produit — détourage vif, grille, seize couleurs."""
    charge: dict = {
        "passes": [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}],
        "grille": {"cible": 64, "occupation": 100, "ancrage": "bas", "methode": methode},
        "quantification": {"couleurs": 16, "palette": [], "tramage": "aucun"},
    }
    if sans_grille:
        charge.pop("grille")
        charge["grille"] = {"cible": 64, "occupation": 100, "ancrage": "bas", "methode": methode}
    return charge


def _poser(client, gabarit: bytes, dossier: Path, nom_fichier: str, personnage: str, charge: dict) -> dict:
    chemin = dossier / nom_fichier
    chemin.write_bytes(gabarit)
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(chemin), "forcer": True}),
        f"l'import d'une image pour « {personnage} »",
    )
    identifiant = importe["asset"]["identifiant"]
    _exiger(
        client.put(
            f"/api/assets/{identifiant}/character",
            json={"personnage": personnage, "pose": "repos"},
        ),
        f"la case « repos » de « {personnage} »",
    )
    asset = _exiger(
        client.put(f"/api/assets/{identifiant}/recipe", json=charge),
        f"la recette de « {personnage} »",
    )
    _exiger(
        client.put("/api/assets/favorite", json={"identifiants": [identifiant], "favori": True}),
        f"la retenue de « {personnage} »",
    )
    return asset


def _rendu(client, identifiant: str) -> np.ndarray:
    reponse = client.get(f"/api/assets/{identifiant}/download")
    if reponse.status_code >= 400:
        raise SystemExit(f"le rendu de {identifiant} : {reponse.status_code} {reponse.text}")
    with Image.open(io.BytesIO(reponse.content)) as image:
        return np.asarray(image.convert("RGBA")).copy()


def _couleur_dominante(rgba: np.ndarray) -> str:
    visibles = rgba[rgba[:, :, 3] > 0][:, :3].astype(np.int32)
    if not len(visibles):
        return "—"
    codes = visibles[:, 0] * 65536 + visibles[:, 1] * 256 + visibles[:, 2]
    gagnant = int(np.bincount(codes).argmax())
    return f"#{gagnant:06X}"


def peupler(atelier: Atelier, dossier: Path) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "L'atelier de Pixéliser"}),
            "le projet",
        )["projet"]["identifiant"]
        _exiger(
            client.put(
                "/api/universe",
                json={
                    "style": "pixel",
                    "cible_px": 64,
                    "methode_pixels": "vote",
                    "couleurs": 16,
                    "fond": FOND,
                },
            ),
            "les réglages de l'univers",
        )

        pelerin = _pelerin_sur_une_grille()
        aplats = _aplats_avec_grain()
        damier = _damier_contraste()

        sujets: dict[str, dict] = {}
        for nom, gabarit, nom_fichier, methode in (
            ("Le témoin (vote)", pelerin, "pelerin.png", "vote"),
            ("Sur les carrés du modèle", pelerin, "pelerin.png", "sur_modele"),
            ("Couleur dominante de case", aplats, "aplats.png", "dominante"),
            ("Médiane de case", aplats, "aplats.png", "mediane"),
            ("Réduction douce en lumière juste", damier, "damier.png", "lumiere_juste"),
            # Le témoin de la lumière : la même image, la méthode d'avant —
            # pour comparer les deux gris à l'écran sans changer d'onglet.
            ("Le damier en réduction douce", damier, "damier.png", "lanczos"),
        ):
            personnage = _exiger(
                client.post(
                    "/api/characters",
                    json={"nom": nom, "description": "", "type": "personnage"},
                ),
                f"la création de « {nom} »",
            )["personnage"]["identifiant"]
            asset = _poser(client, gabarit, dossier, nom_fichier, personnage, _recette(methode=methode))
            sujets[nom] = {
                "personnage": personnage,
                "asset": asset,
                "rendu": _rendu(client, asset["identifiant"]),
            }

        return {"projet": projet, "sujets": sujets}


def principal(sans_servir: bool = False) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b18-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)
    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    duree = time.perf_counter() - depart

    sujets = monte["sujets"]
    print()
    print(f"  Montage : {duree:.1f} s  ·  case du jeu 64 px  ·  16 couleurs  ·  fond {FOND}")
    print()
    print("  Ce que le serveur a vraiment rendu — relu sur les octets servis par la route :")
    for nom, sujet in sujets.items():
        rgba = sujet["rendu"]
        print(
            f"    · {nom:<34} {rgba.shape[1]}×{rgba.shape[0]} px  ·  "
            f"couleur dominante {_couleur_dominante(rgba)}"
        )

    print()
    print("  Ce que ça change, mesuré ici :")
    temoin = sujets["Le témoin (vote)"]["rendu"]
    modele = sujets["Sur les carrés du modèle"]["rendu"]
    print(
        f"    1. sur_modele contre vote : image différente = "
        f"{'oui' if not np.array_equal(temoin, modele) else 'NON'}"
    )

    aplats_dominante = sujets["Couleur dominante de case"]["rendu"]
    couleurs_dominante = {tuple(c) for c in aplats_dominante[aplats_dominante[:, :, 3] > 0][:, :3]}
    print(
        f"    2. dominante — couleurs distinctes dans le rendu : {len(couleurs_dominante)} "
        "(chacune doit être l'une des deux aplats ou le grain, jamais un mélange)"
    )

    mediane = sujets["Médiane de case"]["rendu"]
    rouge_present = bool(
        (np.abs(mediane[:, :, :3].astype(np.int16) - np.array([230, 30, 30])).max(axis=2) < 20).any()
    )
    print(f"    3. mediane — le grain rouge survit dans le rendu : {'oui' if rouge_present else 'non (attendu)'}")

    juste = sujets["Réduction douce en lumière juste"]["rendu"]
    doux = sujets["Le damier en réduction douce"]["rendu"]
    gris_juste = int(juste[juste[:, :, 3] > 0][:, :3].mean())
    gris_doux = int(doux[doux[:, :, 3] > 0][:, :3].mean())
    print(
        f"    4. lumiere_juste — gris moyen {gris_juste} contre {gris_doux} en réduction douce "
        f"({'plus clair, attendu' if gris_juste > gris_doux else 'ANORMAL : pas plus clair'})"
    )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › chaque personnage ci-dessus › Retoucher › Pixéliser")
    print("  → le segment « façon de réduire » doit porter huit crans, aucun grisé")
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
