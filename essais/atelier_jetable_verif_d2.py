# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier `D2` au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8498 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Ce que `D2` a fait

Les trois côtés d'inspiration de l'onglet Univers — `Univers.tsx`, `Toile.tsx`,
`Tableau.tsx`, `Ambiances.tsx` — sont passés de l'ancien châssis chaud et sombre
au papier du carnet, et les **dix teintes d'îlot** ont été refaites : elles
étaient claires sur un fond presque noir, elles sont maintenant plus sombres que
le papier, toutes les dix à 4,6 : 1 sur `--color-papier`.

La planche qui fait foi est `docs/archive/pistes-2026-09-04/carnet/Toile.dc.html`.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_verif_d2.py

## Ce qu'il monte

Un projet, dix images de couleur unie collées (rien n'est payé, rien ne part au
réseau : les PNG sont fabriqués ici, à la main, sans dépendance), trois îlots —
un teinté « mousse », un teinté « bruyère », un sans teinte —, deux notes
teintées, un trait nommé et un trait muet, et six cartes laissées en réserve.

C'est la scène de la planche, aux mêmes trois îlots et au même compte.

## Ce qu'on vient voir à l'écran

1. Le fond du plan : du papier à points, pas du presque-noir.
2. Les trois îlots : cadre de la teinte, fond de la même teinte à 16 %, bandeau
   en teinte pleine avec le nom écrit **en papier** dessus. L'îlot sans teinte
   porte `--pointille` et son nom en encre.
3. Le menu d'un îlot : clique le **nom** d'un îlot. Onze pastilles de 22 px, la
   onzième en pointillé ; les deux boutons « faire une palette / une ambiance ».
4. La réserve, à droite : 380 px, bord gauche, fond `--papier-cote`, et son
   en-tête « Réserve · N à classer ».
5. Le second côté, « Ambiances et couleurs » : le rail des deux mots en haut à
   gauche, et les écrans de palette en papier.
"""

from __future__ import annotations

import struct
import sys
import tempfile
import time
import zlib
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

PORT = 8498


def png_uni(largeur: int, hauteur: int, rvb: tuple[int, int, int]) -> bytes:
    """Un PNG d'une seule couleur, écrit à la main.

    Pillow ferait la même chose en trois lignes, mais un atelier jetable qui
    importe la chaîne d'images du produit pour fabriquer un carré uni emprunte
    un morceau du produit à ce qu'il est censé vérifier. `zlib` et `struct`
    suffisent, et ils sont dans la bibliothèque standard.
    """

    def bloc(nom: bytes, donnees: bytes) -> bytes:
        return (
            struct.pack(">I", len(donnees))
            + nom
            + donnees
            + struct.pack(">I", zlib.crc32(nom + donnees) & 0xFFFFFFFF)
        )

    entete = struct.pack(">2I5B", largeur, hauteur, 8, 2, 0, 0, 0)
    ligne = b"\x00" + bytes(rvb) * largeur
    return (
        b"\x89PNG\r\n\x1a\n"
        + bloc(b"IHDR", entete)
        + bloc(b"IDAT", zlib.compress(ligne * hauteur, 9))
        + bloc(b"IEND", b"")
    )


# Les couleurs sont celles des rampes de `Toile.dc.html` § *La palette qui en
# sort* : la scène de la planche, pas une invention.
LES_IMAGES = [
    ("le-marais-1.png", (0x5C, 0x7A, 0x52), (256, 144)),
    ("le-marais-2.png", (0x41, 0x56, 0x3C), (256, 144)),
    ("le-moulin-1.png", (0x8A, 0x74, 0x58), (256, 144)),
    ("le-moulin-2.png", (0x6B, 0x5A, 0x44), (256, 144)),
    ("le-fer-1.png", (0x8A, 0x8F, 0x96), (192, 192)),
    ("le-fer-2.png", (0xA8, 0x49, 0x2C), (192, 192)),
    ("silhouette-1.png", (0x3F, 0x34, 0x28), (192, 192)),
    ("silhouette-2.png", (0x2B, 0x3A, 0x2A), (192, 192)),
    ("la-tourbe.png", (0x1A, 0x14, 0x10), (192, 192)),
    ("le-ciel.png", (0xC4, 0xC9, 0xCE), (256, 144)),
    ("a-classer-1.png", (0x7A, 0x6A, 0x52), (192, 192)),
    ("a-classer-2.png", (0x55, 0x60, 0x6E), (192, 192)),
    ("a-classer-3.png", (0x9C, 0x8A, 0x6A), (256, 144)),
    ("a-classer-4.png", (0xD8, 0xBB, 0x95), (192, 192)),
]

# Qui va dans quel îlot, et à quelle place — les places sont celles de la
# planche, à l'échelle du plan.
LES_ILOTS = [
    (
        "Le marais",
        "mousse",
        [
            ("le-marais-1.png", (72, 88)),
            ("le-marais-2.png", (256, 88)),
            ("le-moulin-1.png", (72, 250)),
            ("le-moulin-2.png", (256, 250)),
        ],
    ),
    (
        "Le fer et la rouille",
        "bruyere",
        [("le-fer-1.png", (536, 88)), ("le-fer-2.png", (704, 88))],
    ),
    (
        "Les silhouettes",
        "",
        [("silhouette-1.png", (536, 388)), ("silhouette-2.png", (700, 388))],
    ),
]

# Ce qui est posé sur le plan sans être classé — une image et deux notes.
LES_POSEES = [("la-tourbe.png", (90, 470))]
LES_NOTES = [
    ("la tourbe mange la lumière : rien ne brille, tout absorbe", (274, 470), "paille"),
    ("un ciel toujours bas, jamais de bleu franc", (274, 640), "ardoise"),
]


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def peupler(atelier: Atelier) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Vérification D2"}),
            "la création du projet",
        )["projet"]

        # Les cartes, une par appel — c'est ce que la route promet.
        par_nom: dict[str, str] = {}
        for nom, rvb, (largeur, hauteur) in LES_IMAGES:
            carte = _exiger(
                client.post(
                    f"/api/board/paste?nom={nom}",
                    content=png_uni(largeur, hauteur, rvb),
                ),
                f"le collage de {nom}",
            )["carte"]
            par_nom[nom] = carte["identifiant"]

        # Les trois îlots : le groupe et la place s'écrivent du même appel, comme
        # la toile le fait quand on tire une carte dedans.
        for groupe, teinte, membres in LES_ILOTS:
            for nom, place in membres:
                _exiger(
                    client.put(
                        f"/api/board/{par_nom[nom]}",
                        json={"groupe": groupe, "position": list(place)},
                    ),
                    f"le classement de {nom}",
                )
            if teinte:
                _exiger(
                    client.put(
                        "/api/board/groups/tint",
                        json={"groupe": groupe, "teinte": teinte},
                    ),
                    f"la teinte de « {groupe} »",
                )

        for nom, place in LES_POSEES:
            _exiger(
                client.put(f"/api/board/{par_nom[nom]}", json={"position": list(place)}),
                f"la pose de {nom}",
            )

        notes = []
        for texte, place, teinte in LES_NOTES:
            note = _exiger(
                client.post(
                    "/api/board/text",
                    json={"texte": texte, "position": list(place), "teinte": teinte},
                ),
                "la note",
            )
            notes.append(note["identifiant"])

        # Deux traits : l'un porte un mot, l'autre est muet — le défaut.
        _exiger(
            client.post(
                "/api/board/links",
                json={
                    "de": {"genre": "ilot", "valeur": "Le marais"},
                    "vers": {"genre": "ilot", "valeur": "Le fer et la rouille"},
                    "mot": "même lumière",
                },
            ),
            "le trait nommé",
        )
        _exiger(
            client.post(
                "/api/board/links",
                json={
                    "de": {"genre": "ilot", "valeur": "Le fer et la rouille"},
                    "vers": {"genre": "ilot", "valeur": "Les silhouettes"},
                },
            ),
            "le trait muet",
        )

        tableau = _exiger(client.get("/api/board"), "le tableau")
        return {
            "projet": projet,
            "cartes": tableau["cartes"],
            "teintes": tableau.get("teintes", {}),
            "liens": tableau.get("liens", []),
        }


def principal() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-verif-d2-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)

    depart = time.perf_counter()
    monte = peupler(atelier)
    duree = time.perf_counter() - depart

    en_reserve = [c for c in monte["cartes"] if c.get("en_reserve")]
    print()
    print(f"  Montage : {duree:.1f} s — aucun appel payant, aucun réseau")
    print(f"  Projet   : {monte['projet']['nom']}")
    print(f"  Cartes   : {len(monte['cartes'])}, dont {len(en_reserve)} en réserve")
    print(f"  Îlots    : {', '.join(g for g, _, _ in LES_ILOTS)}")
    print(f"  Teintes  : {monte['teintes']}")
    print(f"  Traits   : {len(monte['liens'])}")
    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → le carnet › La toile de l'univers, puis la vue « toile »")
    print("  → clique le nom d'un îlot : les onze pastilles, les deux gestes")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
