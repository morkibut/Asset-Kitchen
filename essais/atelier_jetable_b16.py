# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B16 — les tables dans la
grammaire du carnet**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port **8482** : rien n'est écrit dans
`donnees/`, et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b16.py

`sans-servir` en argument peuple et imprime le résumé sans lancer uvicorn.
`dessin` en argument monte le **même jeu en style dessin, à 1 024** — c'est le
cas du plafond, et il ne se voit pas autrement.

## Ce qu'il monte, et pourquoi ces trois sujets-là

Chacun existe pour rendre **un arbitrage visible sans avoir à le chercher** :

| Le sujet | Sa recette | L'arbitrage qu'il montre |
|---|---|---|
| **Le pèlerin** | détourage `bord 28`, recadrage **marge 12**, case 64 px à 100 %, 16 couleurs | ⚠️ **La marge est éteinte** : la case l'avale, et la raison porte le lien vers *Pixéliser*. C'est le cas normal. |
| **Le garde** | le même, **la grille endormie** (`veille: ["grille"]`) | ⚠️ **La marge se rallume**, parce qu'une grille endormie ne met rien en case. C'est le premier des trois cas où l'ancienne condition d'écran se trompait. |
| **La tuile d'herbe** | aucune passe — l'image remplit son carré | ⚠️ **Le contour est grisé avec sa raison** : elle est entièrement opaque. Le critère est la mesure, jamais la famille. |

Et sur n'importe lequel des trois :

- **Nettoyer** s'ouvre sur **0 px**, pas sur 3 — et il dit *« zéro n'efface
  rien »* au lieu d'annoncer des taches effacées qui ne le sont pas.
- **La chaîne compte dix puces** : huit tables, un trait, deux fabriques. Le
  contour et la différence, que personne n'avait relevés, sont dedans.
- Le pied de la colonne dit qu'**un calcul ne s'interrompt pas**, et n'offre
  aucun bouton qui aurait l'air de le faire.
- **Détourer** écrit que la couleur du fond est **devinée sur les bordures**, et
  non lue dans les règles du jeu.

**Rien n'a été payé** : les trois images arrivent par `/assets/import`, jamais
par une route de génération.

## Ce qu'on vient voir à l'écran

1. **Codex › Personnages › Le pèlerin › Ses images › La retoucher** ouvre la
   chaîne redessinée. La barre est en haut, l'image au milieu, **les réglages à
   droite** — jamais par-dessus l'image.
2. Ouvrir **Recadrer** : le curseur de marge est **éteint**, la phrase le dit,
   et *Pixéliser ›* est un vrai bouton qui y mène.
3. Refaire le même geste sur **Le garde** : la marge est **active**, et aucune
   raison n'est écrite. C'est la même image, la même recette, une grille
   endormie de différence.
4. Ouvrir **Le contour** sur **La tuile d'herbe** : la table s'ouvre quand même,
   et sa raison remplace ses réglages.
5. Bouger le seuil de **Nettoyer** et relâcher : la jauge paraît sous l'image
   si le calcul dépasse 240 ms, et **jamais avant**. Sur ces images-là il est
   trop court pour qu'elle paraisse — c'est le comportement voulu.
6. Le témoin **Avant · Les deux · Après**, en haut à droite de l'image.
7. Endormir une table, la rouvrir : **ses réglages sont là**, entiers.

## ⚠️ Ce qu'il ne faut pas faire

Le lancer sur `donnees/` — il crée un jeu et trois sujets. Le dossier temporaire
est imprimé à chaque lancement ; c'est lui qu'on efface après.
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

# Le double des essais, **importé et pas recopié** — même raison qu'en B9, B10
# et B13 : deux doubles qui divergeraient finiraient par ne plus décrire le
# produit.
from conftest import image_sujet  # noqa: E402

PORT = 8482

PASSE_DU_BORD = {"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _tuile_pleine(cote: int = 64) -> bytes:
    """Une tuile d'herbe **qui remplit son carré** — pas un pixel transparent.

    C'est le sujet qui tranche la cinquième contradiction à l'œil : elle n'a pas
    de bord à border, et la table du contour se grise dessus. Un moulin détouré,
    lui, en a un — et c'est la même règle qui répond différemment, parce qu'elle
    regarde l'image et non la famille.
    """
    tableau = np.zeros((cote, cote, 3), dtype=np.uint8)
    tableau[:, :] = (74, 106, 58)
    # Quelques brins plus clairs, pour que ce soit une herbe et non un aplat.
    tableau[::5, ::3] = (98, 132, 74)
    tableau[2::7, 1::4] = (60, 88, 46)
    sortie = io.BytesIO()
    Image.fromarray(tableau, "RGB").save(sortie, format="PNG")
    return sortie.getvalue()


def _poser(
    client,
    gabarit: Path,
    personnage: str,
    pose: str,
    *,
    recette: dict,
) -> dict:
    """Importer une image, la ranger dans sa case, puis lui poser sa recette."""
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(gabarit), "forcer": True}),
        f"l'import d'une image pour « {personnage} / {pose} »",
    )
    identifiant = importe["asset"]["identifiant"]
    _exiger(
        client.put(
            f"/api/assets/{identifiant}/character",
            json={"personnage": personnage, "pose": pose},
        ),
        f"la case « {pose} » de « {personnage} »",
    )
    asset = _exiger(
        client.put(f"/api/assets/{identifiant}/recipe", json=recette),
        f"la recette de « {personnage} / {pose} »",
    )
    _exiger(
        client.put(
            "/api/assets/favorite", json={"identifiants": [identifiant], "favori": True}
        ),
        f"la retenue de « {personnage} / {pose} »",
    )
    return asset


def _marge_sans_effet(client, identifiant: str) -> bool:
    """**Ce que le serveur dit de la marge**, relu et jamais deviné. C'est très
    exactement le chiffre que l'écran affiche, et c'est celui qui a changé."""
    return _exiger(
        client.get(f"/api/assets/{identifiant}/spots"), "les mesures"
    )["recadrage"]["marge_sans_effet"]


def _opaque(client, identifiant: str) -> bool:
    return _exiger(client.get(f"/api/assets/{identifiant}/spots"), "les mesures")[
        "opaque"
    ]


def peupler(atelier: Atelier, dossier: Path, *, dessin: bool = False) -> dict:
    with TestClient(creer_application(atelier)) as client:
        _exiger(
            client.post("/api/projects", json={"nom": "Le Marais"}),
            "le projet « Le Marais »",
        )

        # **Le style commande la case.** En pixel art on demande des carrés ;
        # en dessin on demande une *finesse*, et elle monte à 1 024 — c'est le
        # cas que la porte d'entrée des recettes refusait avant `B16`.
        cible = 1024 if dessin else 64
        _exiger(
            client.put(
                "/api/universe",
                json={
                    "style": "dessin" if dessin else "pixel",
                    "cible_px": cible,
                    "methode_pixels": "proche",
                    "couleurs": 16,
                    "fond": "#ff00ff",
                },
            ),
            "les réglages de l'univers",
        )

        gabarit = dossier / "sujet.png"
        gabarit.write_bytes(image_sujet(toile=32, bloc=2, logique_l=6, logique_h=12))
        gabarit_tuile = dossier / "herbe.png"
        gabarit_tuile.write_bytes(_tuile_pleine())

        sujets = {}
        for nom, type_ in (
            ("Le pèlerin", "personnage"),
            ("Le garde", "personnage"),
            ("La tuile d'herbe", "personnage"),
        ):
            sujets[nom] = _exiger(
                client.post(
                    "/api/characters",
                    json={"nom": nom, "description": "", "type": type_},
                ),
                f"la création de « {nom} »",
            )["personnage"]["identifiant"]

        pose = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]][0]

        grille = {
            "cible": cible,
            "occupation": 100,
            "ancrage": "bas",
            "methode": "proche",
        }

        # 1. Le cas normal : la case avale la marge, le curseur s'éteint.
        pelerin = _poser(
            client,
            gabarit,
            sujets["Le pèlerin"],
            pose,
            recette={
                "passes": [PASSE_DU_BORD],
                "recadrage": {"marge": 12, "boite": None},
                "grille": grille,
                "quantification": {"couleurs": 16, "palette": [], "tramage": "aucun"},
            },
        )

        # 2. ⚠️ **La même recette, la grille endormie** : la marge se rallume.
        #    C'est le premier des trois cas où `recette.grille != null` mentait.
        garde = _poser(
            client,
            gabarit,
            sujets["Le garde"],
            pose,
            recette={
                "passes": [PASSE_DU_BORD],
                "recadrage": {"marge": 12, "boite": None},
                "grille": grille,
                "quantification": {"couleurs": 16, "palette": [], "tramage": "aucun"},
                "veille": ["grille"],
            },
        )

        # 3. Une image entièrement opaque : le contour n'a pas de bord à border.
        #    **Aucune passe** — c'est ce qui la laisse pleine.
        tuile = _poser(
            client,
            gabarit_tuile,
            sujets["La tuile d'herbe"],
            pose,
            recette={"passes": [], "recadrage": None, "grille": None},
        )

        return {
            "cible": cible,
            "dessin": dessin,
            "pelerin": pelerin,
            "garde": garde,
            "tuile": tuile,
            "marge_pelerin": _marge_sans_effet(client, pelerin["identifiant"]),
            "marge_garde": _marge_sans_effet(client, garde["identifiant"]),
            "opaque_tuile": _opaque(client, tuile["identifiant"]),
            "sujets": sujets,
        }


def principal(sans_servir: bool = False, dessin: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents et des
    # flèches — le même geste que `essais/essai_jetons.py`.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b16-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)

    depart = time.perf_counter()
    monte = peupler(atelier, dossier, dessin=dessin)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s")
    print()
    style = "dessin" if monte["dessin"] else "pixel art"
    print(f"  Style : {style}  ·  case du jeu : {monte['cible']} px")
    if monte["dessin"]:
        print(
            "    → ⚠️ avant B16, poser une recette à cette finesse-là était refusé"
            " par un 422 qui ne nommait rien."
        )
    print()
    print("  Ce que le serveur dit, relu et jamais deviné :")
    print(
        f"    · Le pèlerin      — la case avale la marge : "
        f"{'oui' if monte['marge_pelerin'] else 'NON — le montage est faux'}"
    )
    print(
        f"    · Le garde        — grille endormie, la marge agit : "
        f"{'oui' if not monte['marge_garde'] else 'NON — le montage est faux'}"
    )
    print(
        f"    · La tuile d'herbe — entièrement opaque : "
        f"{'oui' if monte['opaque_tuile'] else 'NON — le montage est faux'}"
    )
    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › Le pèlerin › Ses images › « La retoucher »")
    print("  → la barre : huit tables, un trait, deux fabriques — dix puces")
    print("  → Recadrer : la marge est éteinte, sa raison mène à « Pixéliser › »")
    print("  → le même geste sur Le garde : la marge est active, sans raison")
    print("  → Le contour sur La tuile d'herbe : grisé, la raison remplace les réglages")
    print("  → Nettoyer : le seuil s'ouvre sur 0 px, et le dit")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    if sans_servir:
        print("  (sans-servir : uvicorn n'a pas été lancé)")
        return 0

    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    arguments = sys.argv[1:]
    raise SystemExit(
        principal(
            sans_servir="sans-servir" in arguments,
            dessin="dessin" in arguments,
        )
    )
