# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B1 — le miroir**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8473 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel. (La V3.03.3 tient le 8472, les
serveurs de pages le 8932 et le 8933 ; les quatre tournent côte à côte.)

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b1.py

## Ce qu'il monte

Un jeu qui **déclare ses quatre directions** — `est`, `ouest`, `nord`, `sud` —,
c'est-à-dire très exactement les quatre que `direction_au_miroir` connaît
(`atelier/domaine/direction.py`). Puis un personnage, « le pèlerin », et quatre
images :

- **trois poses en `est`** — repos, marche, course. La colonne `ouest` de sa
  matrice est **vide**, et c'est le cas que la tranche sert : elle doit se
  remplir gratuitement, sans un appel de plus.
- **une pose en `sud`**, pour voir le refus argumenté. Un miroir gauche-droite
  rend le sud tel quel : il n'y a pas de case à remplir, et l'écran doit le dire
  **avant** le clic.

**L'image de « marche » porte déjà une recette réglée** — une passe de détourage
sur un seuil qui n'est pas le défaut, et une remise sur grille à 48 px. C'est
elle qui répond à la question « le miroir hérite-t-il de la recette de son
parent ? » : le retournement est une place de plus, pas une image neuve.

**Le sujet est dissymétrique exprès.** Un bras d'un seul côté, une tache d'une
couleur unique en bas à gauche : un carré centré serait son propre miroir, et
l'écran pourrait afficher n'importe quoi sans que ça se voie. Ici, ça se voit à
l'œil sur la vignette.

**Rien n'a été payé** : le fournisseur est le double des essais, il ne touche
pas au réseau et ne facture rien. Le chiffre qu'il écrit dans « consommé » est
un chiffre d'essai.

## Ce qu'on vient voir à l'écran

- **La barre des tables compte huit places** — détourage, recadrage, grille,
  quantification, bords, contours, **retournement**, la main —, puis un trait,
  puis les deux fabriques. La mesure d'E5 (`interface/src/composants/Retouche.tsx`,
  qui a repris la barre de l'ancien `Tables.tsx`) était faite à sept places : elle
  est à refaire.
- **La table Retourner s'ouvre** : le sens, un seul cran vif et neuf grisés
  « à ajouter », le champ *Ça se range en*, et le bouton `Retourner ›`.
- **La direction se propose.** Sur une image en `est`, le champ arrive rempli
  avec `ouest`, et dit qu'elle est proposée.
- **Le refus se lit avant le clic.** Sur l'image en `sud`, le champ reste vide
  et la raison paraît.
- **Le geste fabrique** : la nouvelle image paraît dans la grille, étiquetée
  `miroir · gratuit` et non un prix, et elle est bien le miroir de l'autre.
- **La case se remplit** : la colonne `ouest` de la matrice du pèlerin porte
  maintenant l'image, et une case vide dont le miroir existe porte un geste.
- **La veille** : endormir le retournement rend l'image telle qu'elle est
  arrivée, et l'étiquette cesse de dire « miroir ». Rallumer la retourne.

## ⚠️ Ce qu'il ne faut pas faire

**Ne cliquez pas « Commander »** : le double facture zéro, mais ce n'est pas ce
qu'on vient regarder, et l'image qu'il rendrait serait la même que celles qui
sont déjà là.
"""

from __future__ import annotations

import io
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine.direction import direction_au_miroir  # noqa: E402
from atelier.services import Atelier  # noqa: E402

# Le double des essais, **importé et pas recopié** : deux fournisseurs doubles
# qui divergeraient finiraient par ne plus décrire le même produit.
from conftest import FOND, SUJET, SUJET_SOMBRE, FournisseurDouble  # noqa: E402

PORT = 8473
MODELE = "essai:rend-du-png"

# Les quatre directions du jeu. **Ce sont celles que la table connaît**, et
# c'est la condition de l'essai : `est` et `ouest` s'apparient, `nord` et `sud`
# se rendent eux-mêmes. Les vraies directions du dépôt de l'auteur — `bas`,
# `haut`, `droite` — ne sont pas toutes dans une liste livrée, et la table est
# muette sur deux d'entre elles ; ce n'est pas ce qu'on vient regarder ici.
DIRECTIONS = ("est", "ouest", "nord", "sud")

# Ce que l'image de « marche » porte déjà dans sa recette, pour que l'héritage
# du miroir se vérifie sur autre chose que du vide. Ni l'un ni l'autre n'est le
# défaut : une valeur par défaut passerait par accident.
SEUIL_ECARTE = 41
GRILLE_ECARTEE = 48


def sujet_dissymetrique(*, toile: int = 32, bloc: int = 8) -> bytes:
    """Un sujet qu'un miroir change forcément, sur le fond que les modèles rendent.

    Trois choses sont dessinées exprès :

    - **le bras est d'un seul côté**, à droite du corps. C'est lui qu'on regarde
      pour dire si l'image a été retournée, et c'est la seule preuve qui ne passe
      pas par du texte ;
    - **le corps est rayé**, une colonne sur deux dans un ton plus sombre —
      comme `image_sujet` de `conftest`, et pour la même raison : sans ça, la
      remise sur grille mesurerait la largeur du sujet au lieu du bloc ;
    - **une tache jaune en bas à gauche**, d'une couleur qui n'est nulle part
      ailleurs. Elle traverse la vignette : même petite, on la voit changer de
      côté.
    """
    petite = Image.new("RGB", (toile, toile), FOND)
    dessin = ImageDraw.Draw(petite)

    largeur, hauteur = 8, 16
    x0 = (toile - largeur) // 2
    y0 = toile - hauteur - 2
    for colonne in range(largeur):
        dessin.rectangle(
            [x0 + colonne, y0, x0 + colonne, y0 + hauteur - 1],
            fill=SUJET if colonne % 2 == 0 else SUJET_SOMBRE,
        )
    # Le bras — à droite du corps, et nulle part à gauche.
    dessin.rectangle([x0 + largeur, y0 + 2, x0 + largeur + 5, y0 + 4], fill=(40, 120, 190))
    # La tache — en bas à gauche, d'une couleur unique dans l'image.
    dessin.rectangle([x0 - 4, y0 + hauteur - 3, x0 - 2, y0 + hauteur - 1], fill=(250, 220, 30))

    grande = petite.resize((toile * bloc, toile * bloc), Image.Resampling.NEAREST)
    tampon = io.BytesIO()
    grande.save(tampon, format="PNG")
    return tampon.getvalue()


def _attendre(client, generation: str) -> dict:
    """Une génération suivie jusqu'à son terme, par la route qui la sert."""
    for _ in range(600):
        etat = client.get(f"/api/generations/{generation}").json()
        if etat["statut"] in ("reussie", "echouee", "interrompue"):
            return etat
        client.get("/api/status")
    return client.get(f"/api/generations/{generation}").json()


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**

    Un `KeyError` sur la réponse dirait « pas d'identifiant » là où le serveur a
    écrit une raison, et l'atelier s'ouvrirait à moitié monté.
    """
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def peupler(atelier: Atelier, double: FournisseurDouble) -> dict:
    """Le jeu, ses directions, le pèlerin et ses quatre images."""
    double.rendre = sujet_dissymetrique

    with TestClient(creer_application(atelier)) as client:
        for nom in DIRECTIONS:
            _exiger(
                client.post("/api/characters/directions", json={"nom": nom}),
                f"la direction « {nom} »",
            )
        declarees = [
            d["identifiant"]
            for d in client.get("/api/characters/directions").json()["directions"]
        ]

        pelerin = _exiger(
            client.post(
                "/api/characters",
                json={
                    "nom": "Le pèlerin",
                    "description": "un pèlerin en manteau de voyage, bâton à la main",
                },
            ),
            "la création du pèlerin",
        )["personnage"]["identifiant"]

        # Les poses du plan du projet neuf — repos, marche, course, attaque…
        poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]

        faites: list[tuple[str, str, str]] = []
        for pose, direction in (
            (poses[0], "est"),
            (poses[1], "est"),
            (poses[2], "est"),
            # **Celle-ci est le cas mural.** Elle n'est pas là pour être
            # retournée : elle est là pour que le refus se lise avant le clic.
            (poses[0], "sud"),
        ):
            depart = _exiger(
                client.post(
                    "/api/generations",
                    json={
                        "modele": MODELE,
                        "prompt": f"le pèlerin, {pose}, vu vers l'{direction}",
                        "personnage": pelerin,
                        "pose": pose,
                        "direction": direction,
                        "echelle": "personnage",
                    },
                ),
                f"la génération « {pose} / {direction} »",
            )
            _attendre(client, depart["identifiant"])
            faites.append((f"{depart['identifiant']}-0", pose, direction))

        # **Une recette qui porte déjà quelque chose**, sur l'image de « marche ».
        # C'est elle qui dira si le miroir hérite, ou s'il repart d'une recette
        # nue — auquel cas le détourage et la grille seraient perdus, et l'image
        # retournée ne serait pas la même image vue de l'autre côté.
        reglee = faites[1][0]
        _exiger(
            client.put(
                f"/api/assets/{reglee}/recipe",
                json={
                    "passes": [{"moteur": "bord", "tolerance": SEUIL_ECARTE}],
                    "grille": {"cible": GRILLE_ECARTEE, "occupation": 100},
                },
            ),
            f"la recette de « {reglee} »",
        )

        # Ce que l'écran promet **avant** le clic, relu ici depuis le serveur :
        # si les deux ne disaient pas la même chose, l'un des deux mentirait.
        propositions = {
            identifiant: client.get(f"/api/assets/{identifiant}/mirror").json()
            for identifiant, _, _ in faites
        }

        return {
            "pelerin": pelerin,
            "directions": declarees,
            "faites": faites,
            "reglee": reglee,
            "propositions": propositions,
        }


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b1-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(racine=dossier, fabrique_fournisseur=lambda: double)
    monte = peupler(atelier, double)

    print()
    print(f"  Le pèlerin   : {monte['pelerin']}")
    print(f"  Directions   : {', '.join(monte['directions'])}")
    print(f"  Appels payés : {double.appels}  (double : facture zéro)")
    print()

    print("  Ce que le serveur promet avant le clic")
    for identifiant, pose, direction in monte["faites"]:
        vu = monte["propositions"][identifiant]
        reglee = "  ← sa recette à elle" if identifiant == monte["reglee"] else ""
        if vu.get("propose"):
            dit = f"se propose en « {vu['propose']} »"
        else:
            dit = f"pas de case : {vu.get('raison') or 'sans raison écrite'}"
        print(f"    {pose:<10} {direction:<5} {identifiant}")
        print(f"        {dit}{reglee}")

    print()
    # Les deux listes doivent dire la même chose : la table du domaine, et ce
    # que la route rend. Si elles divergeaient, l'écran suivrait la route et
    # l'essai suivrait la table — et aucun des deux ne le dirait.
    ecarts = [
        (identifiant, vu.get("propose"), direction_au_miroir(direction))
        for identifiant, _, direction in monte["faites"]
        for vu in (monte["propositions"][identifiant],)
        if vu.get("propose") != (
            None
            if direction_au_miroir(direction) == direction
            else direction_au_miroir(direction)
        )
    ]
    if ecarts:
        print("  ⚠️ La route et la table du domaine ne disent pas la même chose :")
        for identifiant, rendu, attendu in ecarts:
            print(f"     {identifiant} : la route dit {rendu!r}, la table {attendu!r}")
    else:
        print("  → La route et `direction_au_miroir` sont d'accord. L'écran peut")
        print("    proposer avant le clic, et refuser avec sa raison.")

    print()
    print("  À cliquer :")
    print("    Galerie › la vignette d'une image en « est » › la barre des tables")
    print("    — elle doit compter **huit places** : détourage, recadrage,")
    print("      grille, quantification, bords, contours, **retournement**, la")
    print("      main ; puis un trait, puis les deux fabriques")
    print("    — « Retourner » : un seul sens vif, neuf grisés « à ajouter »,")
    print("      le champ *Ça se range en* rempli avec « ouest », et dit que")
    print("      c'est une proposition")
    print("    — `Retourner ›` : l'image paraît dans la grille, étiquetée")
    print("      **miroir · gratuit** — et le bras a changé de côté")
    print("    — sur l'image en « sud », le champ reste **vide** et la raison")
    print("      se lit **avant** le clic")
    print(f"    — l'image « marche » ({monte['reglee']}) porte déjà une passe")
    print(f"      à {SEUIL_ECARTE} et une grille à {GRILLE_ECARTEE} px : son")
    print("      miroir doit les avoir")
    print("    — Codex › Personnages › Le pèlerin : la colonne « ouest » de sa")
    print("      matrice se remplit, et une case vide dont le miroir existe")
    print("      porte un geste `Retourner ›`")
    print("    — endormir le retournement à la table rend l'image d'avant, et")
    print("      l'étiquette cesse de dire « miroir » ; rallumer la retourne")
    print("    — replié, le résumé de la table dit « miroir gauche-droite »")
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
