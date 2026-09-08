# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B18 — Détourer, cinq moteurs
neufs**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8488 : rien n'est écrit dans
`donnees/`, et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b18_detourer.py

`sans-servir` en argument peuple, mesure et imprime le résumé sans lancer
uvicorn — c'est ce mode-là qui sert de banc, sur de vraies routes.

## Ce qu'il monte, et pourquoi ces sujets-là

**Le Marais du Vieux Moulin**, une case de 64 px, et **quatre pèlerins** dont
chacun rend visible un seul des cinq réglages neufs de `B18` — le cinquième,
la même passe rejouée sur des frames voisines, n'a pas d'écran (`Passe` ne
voyage pas d'une image à l'autre, U) et se prouve en `sans-servir` sur deux
frames fabriquées ici, comme `essais/atelier_jetable_b17.py` le fait pour son
propre témoin.

| Le sujet | Ce qui rate sans le réglage neuf | Le réglage qui répare |
|---|---|---|
| **Le pèlerin sur le bord** | le sujet déborde sur les bords haut et bas ; la médiane devinée bascule vers lui et le détourage s'inverse | *couleur visée* → la couleur déclarée du jeu |
| **Le pèlerin au clair de lune** | une bande de fond assombrie, même teinte mais une valeur à 115 d'écart, résiste à la tolérance par canal | *comparaison* → par teinte |
| **Le pèlerin sur fond sale** | deux magentas différents, sans cible unique ; le sujet vert colle pourtant au coin de l'image | moteur *palette du jeu* |
| **Le pèlerin poussiéreux** | une esquille isolée grossit la boîte que le recadrage mesurera | un passage de pinceau posé dans la même passe |

**La couleur du jeu (`#F0F0F0`) et la palette du jeu (dérivée d'un artwork
vert promu) sont déclarées dans les règles**, pas devinées ici — c'est ce qui
allume les deux réglages qui en dépendent au lieu de les griser.

**Rien n'a été payé** : les images arrivent par `/board/paste` puis
`/assets/import`, jamais par une route de génération. Le script marche réseau
coupé.

## Ce qu'on vient voir à l'écran

1. **Codex › Personnages › Le pèlerin sur le bord › Retoucher › Détourage.**
   Le détourage mange le sujet et laisse le fond (inversion). Ouvrir
   « couleur visée » et choisir *la couleur déclarée du jeu* : le sujet
   réapparaît, le fond part — **au clic**, sans recharger.
2. **Le pèlerin au clair de lune › Détourage.** Une bande grise-mauve
   subsiste en haut de l'image sous « par canal ». Basculer « comparaison »
   sur *par teinte* la fait partir sans toucher au sujet.
3. **Le pèlerin sur fond sale › Détourage.** Changer le moteur pour
   *palette du jeu* : les deux magentas partent, le vert au coin ne bouge
   jamais — même geste, aucun réglage de tolérance à ajuster entre les deux
   zones.
4. **Le pèlerin poussiéreux › Détourage.** La ligne « 1 passage du pinceau
   posé sur cette image, avant le recadrage » est déjà là : l'esquille a
   disparu de l'image et de la boîte, avant même que Recadrer ne s'ouvre.
5. **N'importe lequel** : la jauge sous l'image ne paraît que si le calcul
   dépasse 240 ms — sur ces images-là, elle ne devrait jamais paraître.

Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.
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

PORT = 8488

# La couleur de fond que le jeu déclare — celle que le premier pèlerin vise
# au lieu de la deviner sur ses bordures.
FOND = "#F0F0F0"


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _png(rgb: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgb, mode="RGB").save(tampon, format="PNG")
    return tampon.getvalue()


# ── Les quatre images, une par réglage neuf ──────────────────────────────────


def _pelerin_sur_le_bord(cote: int = 64) -> bytes:
    """**Le sujet déborde sur deux bords** — même proportion que le banc de
    `tests/test_b18_detourer.py` : plus de la moitié des pixels de bordure
    sont au sujet, et la médiane devinée bascule vers lui."""
    fond, sujet = (240, 240, 240), (20, 30, 40)
    image = np.full((cote, cote, 3), fond, dtype=np.uint8)
    image[:, : (cote * 3) // 5] = sujet
    return _png(image)


def _pelerin_au_clair_de_lune(cote: int = 64) -> bytes:
    """**Une bande de fond assombrie**, collée au bord du haut : même teinte
    que le magenta clair, une valeur à 115 d'écart — hors de portée d'une
    tolérance par canal raisonnable, à portée d'une tolérance par teinte
    minime."""
    clair, sombre, sujet = (255, 0, 255), (140, 0, 140), (20, 150, 20)
    image = np.full((cote, cote, 3), clair, dtype=np.uint8)
    image[: cote // 5, :] = sombre
    milieu = cote // 2
    image[milieu - 12 : milieu + 12, milieu - 12 : milieu + 12] = sujet
    return _png(image)


def _pelerin_sur_fond_sale(cote: int = 64) -> bytes:
    """**Deux magentas, aucune cible unique** — et le sujet vert colle au
    coin de l'image, l'endroit précis d'où un remplissage par bordure
    amorcerait."""
    magenta_a, magenta_b, sujet = (255, 0, 255), (200, 10, 210), (0, 255, 0)
    image = np.full((cote, cote, 3), magenta_a, dtype=np.uint8)
    image[cote // 2 :, :] = magenta_b
    image[0:6, 0:6] = sujet
    milieu = cote // 2
    image[milieu + 4 : milieu + 16, milieu + 4 : milieu + 16] = sujet
    return _png(image)


def _pelerin_poussiereux(cote: int = 64) -> bytes:
    """**Une esquille isolée**, à quatre pixels du sujet et du bord — assez
    loin pour qu'aucun remplissage depuis la bordure ne l'atteigne."""
    fond, sujet = (240, 240, 240), (20, 30, 40)
    image = np.full((cote, cote, 3), fond, dtype=np.uint8)
    milieu = cote // 2
    image[milieu - 15 : milieu + 15, milieu - 15 : milieu + 15] = sujet
    image[3:6, 3:6] = sujet
    return _png(image)


def _artwork_vert(cote: int = 96) -> bytes:
    """**Un artwork officiel tout simple** — un carré vert sur un fond blanc
    — pour que la palette du jeu contienne **exactement** le vert que « Le
    pèlerin sur fond sale » porte : un artwork d'une seule couleur de sujet
    se quantifie sur lui-même, sans dérive."""
    image = np.full((cote, cote, 3), (255, 255, 255), dtype=np.uint8)
    marge = cote // 6
    image[marge : cote - marge, marge : cote - marge] = (0, 255, 0)
    return _png(image)


# ── Le montage, sur de vraies routes ─────────────────────────────────────────


def _poser(client, gabarit_bytes: bytes, dossier: Path, nom: str, personnage: str, charge: dict) -> dict:
    cree = _exiger(
        client.post(
            "/api/characters",
            json={"nom": personnage, "description": "", "type": "personnage"},
        ),
        f"la création de « {personnage} »",
    )
    identifiant_personnage = cree["personnage"]["identifiant"]
    chemin = dossier / f"{nom}.png"
    chemin.write_bytes(gabarit_bytes)
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(chemin), "forcer": True}),
        f"l'import d'une image pour « {personnage} »",
    )
    identifiant = importe["asset"]["identifiant"]
    _exiger(
        client.put(
            f"/api/assets/{identifiant}/character",
            json={"personnage": identifiant_personnage, "pose": "repos"},
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


def _recette(passes: list[dict]) -> dict:
    return {
        "passes": passes,
        "recadrage": None,
        "grille": {"cible": 64, "occupation": 100, "ancrage": "bas", "methode": "proche"},
        "quantification": None,
        "bords": None,
        "contours": None,
        "retournement": None,
        "main": None,
        "veille": ["grille"],  # **la grille dort** : on veut voir le pixel exact du détourage,
        # pas ce qu'une remise en case y ferait — même geste que
        # `essais/atelier_jetable_b16.py` pour « Le garde ».
        "nom": None,
    }


def _rendu(client, identifiant: str) -> np.ndarray:
    reponse = client.get(f"/api/assets/{identifiant}/download")
    if reponse.status_code >= 400:
        raise SystemExit(f"le rendu de {identifiant} : {reponse.status_code} {reponse.text}")
    with Image.open(io.BytesIO(reponse.content)) as image:
        return np.asarray(image.convert("RGBA")).copy()


def peupler(atelier: Atelier, dossier: Path) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Le Marais du Vieux Moulin"}),
            "le projet",
        )["projet"]["identifiant"]
        _exiger(
            client.put(
                "/api/universe",
                json={
                    "style": "pixel",
                    "cible_px": 64,
                    "methode_pixels": "proche",
                    "couleurs": 16,
                    "fond": FOND,
                },
            ),
            "les réglages de l'univers — dont le fond déclaré",
        )

        # **Un artwork officiel promu**, pour que la palette du jeu ne soit
        # pas vide — sans lui, le moteur « palette du jeu » se griserait, et
        # ce n'est pas ce que la tranche vient montrer.
        collee = _exiger(
            client.post("/api/board/paste", content=_artwork_vert()),
            "le collage de l'artwork",
        )
        carte = collee["carte"]["identifiant"] if "carte" in collee else collee["identifiant"]
        _exiger(
            client.put(f"/api/board/{carte}/official", json={"officiel": True, "famille": "tous"}),
            "la promotion de l'artwork",
        )
        univers = _exiger(client.get("/api/universe"), "la lecture de l'univers")["univers"]
        palette = tuple(univers.get("palette") or ())
        if not palette:
            raise SystemExit("l'artwork promu n'a rendu aucune palette — rien à protéger")

        sujets: dict[str, dict] = {}

        # 1 · la couleur déclarée du jeu ──────────────────────────────────
        asset = _poser(
            client,
            _pelerin_sur_le_bord(),
            dossier,
            "pelerin-bord",
            "Le pèlerin sur le bord",
            _recette([{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}]),
        )
        # Et son résultat une fois « couleur visée » posée sur la couleur
        # déclarée du jeu — pour le résumé ; à l'écran ce même geste se fait
        # d'un clic sur « couleur visée ».
        avec_cible = _exiger(
            client.put(
                f"/api/assets/{asset['identifiant']}/recipe",
                json=_recette(
                    [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128, "couleur_du_jeu": FOND}]
                ),
            ),
            "la passe visant la couleur déclarée",
        )
        rendu_vise = _rendu(client, asset["identifiant"])
        # On repose la version devinée par défaut : c'est elle que l'écran
        # doit montrer ratée au premier coup d'œil.
        _exiger(
            client.put(
                f"/api/assets/{asset['identifiant']}/recipe",
                json=_recette([{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}]),
            ),
            "la repose de la passe devinée",
        )
        sujets["Le pèlerin sur le bord"] = {
            "asset": asset,
            "rendu": _rendu(client, asset["identifiant"]),
            "rendu_vise": rendu_vise,
        }

        # 2 · la teinte plutôt que la valeur ──────────────────────────────
        asset = _poser(
            client,
            _pelerin_au_clair_de_lune(),
            dossier,
            "pelerin-lune",
            "Le pèlerin au clair de lune",
            _recette([{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}]),
        )
        sujets["Le pèlerin au clair de lune"] = {
            "asset": asset,
            "rendu": _rendu(client, asset["identifiant"]),
        }
        # Et son résultat une fois « par teinte » choisi — pour le résumé,
        # à l'écran ce même geste se fait d'un clic sur « comparaison ».
        avec_teinte = _exiger(
            client.put(
                f"/api/assets/{asset['identifiant']}/recipe",
                json=_recette(
                    [{"moteur": "bord", "tolerance": 5, "seuil_alpha": 128, "teinte": True}]
                ),
            ),
            "la passe par teinte",
        )
        rendu_teinte = _rendu(client, asset["identifiant"])
        # On repose la version « par canal » par défaut : c'est elle que
        # l'écran doit montrer ratée au premier coup d'œil.
        _exiger(
            client.put(
                f"/api/assets/{asset['identifiant']}/recipe",
                json=_recette([{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}]),
            ),
            "la repose de la passe par canal",
        )
        sujets["Le pèlerin au clair de lune"]["rendu_par_teinte"] = rendu_teinte

        # 3 · la palette en garde-fou ──────────────────────────────────────
        asset = _poser(
            client,
            _pelerin_sur_fond_sale(),
            dossier,
            "pelerin-sale",
            "Le pèlerin sur fond sale",
            _recette(
                [{"moteur": "palette", "tolerance": 40, "seuil_alpha": 128, "palette": list(palette)}]
            ),
        )
        sujets["Le pèlerin sur fond sale"] = {
            "asset": asset,
            "rendu": _rendu(client, asset["identifiant"]),
        }

        # 4 · le pinceau remonté en amont ──────────────────────────────────
        temoin = _poser(
            client,
            _pelerin_poussiereux(),
            dossier,
            "pelerin-poussiereux-temoin",
            "Le pèlerin poussiéreux (témoin)",
            _recette([{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}]),
        )
        asset = _poser(
            client,
            _pelerin_poussiereux(),
            dossier,
            "pelerin-poussiereux",
            "Le pèlerin poussiéreux",
            _recette(
                [
                    {
                        "moteur": "bord",
                        "tolerance": 28,
                        "seuil_alpha": 128,
                        "traits": [{"garde": False, "rayon": 1, "points": [[4, 4]]}],
                    }
                ]
            ),
        )
        sujets["Le pèlerin poussiéreux"] = {
            "asset": asset,
            "temoin": _rendu(client, temoin["identifiant"]),
            "rendu": _rendu(client, asset["identifiant"]),
        }

        return {"projet": projet, "palette": palette, "sujets": sujets}


def _boite_opaque(rgba: np.ndarray) -> tuple[int, int, int, int] | None:
    opaque = rgba[:, :, 3] > 0
    if not opaque.any():
        return None
    lignes = np.where(opaque.any(axis=1))[0]
    colonnes = np.where(opaque.any(axis=0))[0]
    return int(colonnes[0]), int(lignes[0]), int(colonnes[-1]), int(lignes[-1])


def _meme_passe_sur_les_frames_voisines() -> None:
    """**Le cinquième réglage, sans écran** — prouvé ici comme
    `essais/atelier_jetable_b17.py` prouve son propre témoin en dehors de la
    route servie, avec le module de traitement importé directement."""
    from atelier.domaine.recette import COULEUR, Passe
    from atelier.image.traitement import detourer_meme_passe

    def _frame(matiere: tuple[int, int, int]) -> bytes:
        fond = (240, 240, 240)
        image = np.full((16, 16, 3), matiere, dtype=np.uint8)
        image[0:2, :] = fond
        image[:, 0:2] = fond
        image[:, -2:] = fond
        image[-2:, :] = fond
        image[6:10, 6:10] = fond  # la flaque enfermée, au même endroit sur les deux
        return _png(image)

    frames = [_frame((20, 30, 40)), _frame((25, 35, 45))]
    passe = Passe(moteur=COULEUR, tolerance=10, point=(7, 7), portee="tache")
    rendus = detourer_meme_passe(passe, frames)
    flaques_parties = [bool(r[7, 7, 3] == 0) for r in rendus]
    dehors_reste = [bool(r[0, 0, 3] == 255) for r in rendus]
    print(
        f"    5. même passe sur les frames voisines — un seul point (7, 7), rejoué "
        f"tel quel sur {len(frames)} frames : flaque partie sur chacune → "
        f"{flaques_parties}  ·  fond du dehors intact → {dehors_reste}"
    )


def principal(sans_servir: bool = False) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b18-detourer-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)
    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    duree = time.perf_counter() - depart

    sujets = monte["sujets"]
    print()
    print(f"  Montage : {duree:.1f} s  ·  fond déclaré {FOND}  ·  palette : {monte['palette']}")
    print()
    print("  Les cinq mesures de la tranche :")

    # 1. la couleur déclarée du jeu
    bord_sujet = sujets["Le pèlerin sur le bord"]
    devine = bord_sujet["rendu"]
    vise = bord_sujet["rendu_vise"]
    milieu = devine.shape[0] // 2
    sujet_present_devine = bool(devine[milieu, 2, 3] == 255)
    sujet_present_vise = bool(vise[milieu, 2, 3] == 255)
    fond_parti_vise = bool(vise[milieu, devine.shape[1] - 2, 3] == 0)
    print(
        f"    1. couleur déclarée du jeu — deviné : sujet présent à (2, {milieu}) : "
        f"{'oui' if sujet_present_devine else 'NON — mangé par erreur, comme prévu'}  ·  "
        f"visé : sujet présent : {'oui' if sujet_present_vise else 'NON'}, fond parti : "
        f"{'oui' if fond_parti_vise else 'NON'}"
    )

    # 2. la teinte plutôt que la valeur
    lune = sujets["Le pèlerin au clair de lune"]
    par_canal = lune["rendu"]
    par_teinte = lune["rendu_par_teinte"]
    bande_reste_par_canal = bool(par_canal[2, 32, 3] == 255)
    bande_partie_par_teinte = bool(par_teinte[2, 32, 3] == 0)
    print(
        f"    2. teinte plutôt que valeur — bande assombrie encore là par canal : "
        f"{'oui, comme prévu' if bande_reste_par_canal else 'NON'}  ·  "
        f"partie par teinte : {'oui' if bande_partie_par_teinte else 'NON'}"
    )

    # 3. la palette en garde-fou
    sale = sujets["Le pèlerin sur fond sale"]["rendu"]
    coin_survit = bool(sale[2, 2, 3] == 255)
    fond_parti = bool(sale[40, 2, 3] == 0) and bool(sale[10, 60, 3] == 0)
    print(
        f"    3. palette en garde-fou — le vert au coin survit : "
        f"{'oui' if coin_survit else 'NON'}  ·  les deux magentas sont partis : "
        f"{'oui' if fond_parti else 'NON'}"
    )

    # 4. le pinceau remonté en amont
    poussiereux = sujets["Le pèlerin poussiéreux"]
    boite_temoin = _boite_opaque(poussiereux["temoin"])
    boite_repare = _boite_opaque(poussiereux["rendu"])
    print(
        f"    4. pinceau remonté en amont — boîte du sujet sans le pinceau : "
        f"{boite_temoin}  ·  avec : {boite_repare}"
    )

    # 5. la même passe sur les frames voisines
    _meme_passe_sur_les_frames_voisines()

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › Le pèlerin sur le bord › Retoucher › Détourage")
    print("    · le sujet est mangé — ouvrir « couleur visée » → la couleur déclarée du jeu")
    print("  → Le pèlerin au clair de lune › Détourage : « comparaison » → par teinte")
    print("  → Le pèlerin sur fond sale › Détourage : moteur → palette du jeu")
    print("  → Le pèlerin poussiéreux › Détourage : la ligne du pinceau est déjà là")
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
