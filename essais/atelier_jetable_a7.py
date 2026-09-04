# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer A7 au navigateur — **rouvrir une animation gardée**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8470 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    py essais/atelier_jetable_a7.py

## Ce qu'il monte

Un personnage, deux clips — le clip d'`A10`, écrit à la main image par image, et
un second exemplaire pour avoir de quoi emprunter —, et **trois animations
gardées** rangées dans les cases du nain. **Rien n'a été payé** : l'animateur est
un double qui rend ce clip-là et facture zéro.

La troisième, `marche corrigée`, porte exprès tout ce que la tranche répare :
une vitesse et un sens qui ne sont pas ceux du jeu, un détourage qui n'est pas
celui du jeu, une image poussée de quatre pixels, une image **prise dans l'autre
clip**, et un ancrage qui n'est pas le bas.

## ⚠️ Ce qu'il vérifie avant même d'ouvrir, et pourquoi

Le défaut de la tranche était qu'une animation gardée **ne se relisait pas** : la
vignette remontait au clip, l'écran repartait des réglages du jeu, et corriger
une virgule demandait de tout refaire de mémoire.

Aucun essai ne pouvait le voir, parce qu'ils gardaient une bande puis
vérifiaient ce qu'ils venaient d'écrire. **Personne ne la rouvrait.** Ce script
la referme et la rouvre, et imprime les deux colonnes côte à côte : *ce que le
jeu dirait* et *ce que la bande rend*. Si un jour elles se remettent à dire la
même chose, c'est que le défaut est revenu.

## Ce qu'on vient voir à l'écran

- **La porte** : Codex › Personnages › Le nain › « animations » › **la vignette**
  de `marche corrigée`. La vignette ouvre l'atelier ; le nom, sous elle, remonte
  au clip. Deux portes, et avant `A7` il n'y avait que la seconde.
- **Les réglages sont ceux de la bande**, pas ceux du jeu : onze images par
  seconde, aller-retour, la tolérance de détourage à 37.
- **L'image d'avant en transparence** : le curseur sous l'image, au milieu. Il
  part à zéro — allumé d'office, il ferait croire à un défaut de rendu.
- **Les flèches poussent l'image d'un pixel**, Maj de cinq, et la souris la fait
  glisser. Aux bords elles **cessent d'avoir un effet** plutôt que de rogner.
- **La quatrième image porte un point** dans la colonne de droite : elle vient
  de l'autre clip, et la bande le dit.
- **La fenêtre commune**, à gauche : son rectangle, d'où il vient, et le bouton
  qui la reprend. Changez la tolérance, enregistrez : la ligne « mesurée avec un
  autre détourage » apparaît. Le bouton est fermé tant que des corrections
  attendent — le reprendre écrit, et l'écrire par-dessus des réglages en cours
  laisserait la bande à moitié neuve.
- **Rien n'est écrit tant qu'on n'a pas enregistré**, et « Annuler » ramène
  exactement l'état d'ouverture.

## ⚠️ Ce qu'il ne faut pas faire

**Ne cliquez pas « Commander »** : l'animateur est doublé et facture zéro, mais
ce n'est pas ce qu'on vient regarder, et le clip qu'il rendrait serait le même
que ceux qui sont déjà là.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.image import clip as decodeur  # noqa: E402
from atelier.services import Atelier  # noqa: E402

# **Le peuplement est celui d'`A4`, importé et pas recopié.** Deux ateliers
# jetables qui monteraient chacun leur personnage finiraient par ne plus décrire
# le même produit, et c'est précisément ce qu'un essai jetable ne doit pas faire.
from atelier_jetable_a4 import peupler  # noqa: E402
from conftest import FournisseurDouble  # noqa: E402
from test_a9 import MELE, AnimateurDouble  # noqa: E402
from test_a10 import clip_connu  # noqa: E402

PORT = 8470

# Ce qu'on met dans la bande, et **rien de tout ça n'est ce que le jeu dirait**.
# C'est la condition pour que la relecture prouve quelque chose : une bande
# gardée avec les réglages du jeu se relit juste par accident.
CADENCE = 11.0
SENS = "aller-retour"
TOLERANCE = 37
ANCRAGE = "bas-gauche"
POUSSEE = (4, -2)


def _second_clip(client, sprite: str) -> str:
    """Un second exemplaire du même clip — de quoi emprunter une image.

    Le même double le rend, donc les deux clips portent les mêmes images. Ce
    n'est pas un raccourci : ce qu'on vient montrer est **qu'une bande sait dire
    d'où vient chacune de ses images**, et deux clips identiques le montrent
    aussi bien que deux clips différents — sans rien payer de plus.
    """
    lot = client.post(
        "/api/clips",
        json={"modele": MELE.identifiant, "mouvement": "marche", "asset": sprite},
    ).json()["clips"]
    identifiant = lot[0]["identifiant"]
    for _ in range(600):
        arrives = client.get("/api/clips").json()["clips"]
        if all(c["statut"] in ("reussie", "echouee") for c in arrives):
            break
        client.get("/api/status")
    return identifiant


def poser_la_bande_corrigee(
    atelier: Atelier, personnage: str, clip: str, autre: str
) -> tuple[str, dict, dict]:
    """La bande qui porte tout ce que la tranche répare, et sa relecture.

    Elle est gardée par la vraie porte puis **refermée**, et ce qui revient vient
    d'un `GET`. Un script qui garderait la réponse du `POST` referait exactement
    l'erreur que la tranche a corrigée.
    """
    with TestClient(creer_application(atelier)) as client:
        du_jeu = client.get(f"/api/montage/{clip}").json()["recette_du_jeu"]

        recette = {
            **du_jeu,
            "passes": [{"moteur": "bord", "tolerance": TOLERANCE}],
            "grille": {**(du_jeu.get("grille") or {}), "ancrage": ANCRAGE},
        }
        gardee = client.post(
            "/api/strips",
            json={
                "clip": clip,
                "nom": "marche corrigée",
                "images": [12, 14, 16, 18],
                "cadence": CADENCE,
                "sens": SENS,
                "recette": recette,
            },
        ).json()
        identifiant = gardee["identifiant"]
        client.put(
            f"/api/strips/{identifiant}/case",
            json={"personnage": personnage, "pose": "course"},
        )

        # Une image poussée, et une prise dans l'autre clip. Les deux passent par
        # la porte de la correction — celle que l'écran emprunte.
        client.put(
            f"/api/strips/{identifiant}",
            json={
                "prises": [
                    {"numero": 12, "dx": POUSSEE[0], "dy": POUSSEE[1]},
                    {"numero": 14},
                    {"numero": 16},
                    {"numero": 18, "clip": autre},
                ]
            },
        )

        # ⚠️ **On referme, puis on rouvre.** C'est tout l'essai.
        rouverte = client.get(f"/api/strips/{identifiant}").json()
        return identifiant, du_jeu, rouverte


def _colonne(titre: str, du_jeu, de_la_bande) -> str:
    return f"    {titre:<24} {str(du_jeu):>16}   →   {de_la_bande}"


def principal() -> int:
    manque = decodeur.indisponible()
    if manque:
        print(f"Le décodeur vidéo manque : {manque}")
        print("Sans lui, le clip n'a aucune image à découper.")
        return 2

    dossier = Path(tempfile.mkdtemp(prefix="atelier-a7-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    animateur = AnimateurDouble()
    animateur.modeles = [MELE]
    animateur.octets = clip_connu()
    animateur.facture = 0.0

    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )
    personnage, clip = peupler(atelier, double, animateur)

    with TestClient(creer_application(atelier)) as client:
        sprite = client.get("/api/assets").json()["assets"][0]["identifiant"]
        autre = _second_clip(client, sprite)

    identifiant, du_jeu, rouverte = poser_la_bande_corrigee(
        atelier, personnage, clip, autre
    )
    bande = rouverte["bande"]
    grille_du_jeu = du_jeu.get("grille") or {}
    passe_du_jeu = (du_jeu.get("passes") or [{}])[0]

    print()
    print(f"  Le personnage : {personnage}")
    print(f"  Le clip       : {clip}")
    print(f"  L'autre clip  : {autre}")
    print(f"  L'animation   : {identifiant}  ({bande['nom']})")
    print()
    print("  Ce que le jeu dirait  →  ce que la bande rend, une fois rouverte")
    print(_colonne("images par seconde", 8, bande["cadence"]))
    print(_colonne("sens de lecture", "boucle", bande["sens"]))
    print(
        _colonne(
            "détourage, tolérance",
            passe_du_jeu.get("tolerance"),
            bande["recette"]["passes"][0]["tolerance"],
        )
    )
    print(
        _colonne(
            "ancrage",
            grille_du_jeu.get("ancrage", "bas"),
            (bande["recette"].get("grille") or {}).get("ancrage"),
        )
    )
    print(
        _colonne(
            "première image, poussée",
            "0, 0",
            f"{bande['prises'][0]['dx']}, {bande['prises'][0]['dy']}",
        )
    )
    print(_colonne("clips d'où elle tire", 1, len(bande["clips"])))

    d_accord = (
        bande["cadence"] == 8
        and bande["sens"] == "boucle"
        and bande["prises"][0]["dx"] == 0
    )
    print()
    if d_accord:
        print("  ⚠️ Les deux colonnes disent la même chose : **le défaut est")
        print("     revenu**. Une animation gardée ne se relit plus, et l'écran")
        print("     repart des réglages du jeu.")
    else:
        print("  → Les deux colonnes diffèrent, et c'est ce qu'on veut : la bande")
        print("    rend ce qu'on y avait mis, pas ce que le jeu dirait.")

    fenetre = rouverte["cadre"]
    print()
    print("  La fenêtre commune")
    print(f"    d'où elle vient   {fenetre['choix']}")
    print(f"    à jour            {'oui' if fenetre['a_jour'] else 'non — d’avant'}")
    print()
    print("  À cliquer :")
    print("    Codex › Personnages › Le nain › « animations »")
    print("    — la **vignette** de « marche corrigée » ouvre son atelier")
    print("    — son **nom**, dessous, remonte au clip : deux portes")
    print("    — le curseur sous l'image montre l'image d'avant en transparence")
    print("    — les flèches poussent d'un pixel, Maj de cinq")
    print("    — la 4ᵉ image porte un point : elle vient de l'autre clip")
    print("    — changez la tolérance, enregistrez : la fenêtre se dit d'avant")
    print()
    print(f"Atelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
