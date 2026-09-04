# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier M3 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8427, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui
ne bouge pas d'un pixel.

Il monte **le cas exact que la tranche répare** : un jeu qui a une bible à dire,
un personnage à deux poses avec ses corps, et une pièce d'équipement posée
dessus. C'est le montage le plus lourd de l'écran de confirmation — celui qui
relisait le projet quarante-deux fois pour répondre à une seule question.

De quoi cliquer sur ce que la tranche livre :

- écrire un sujet, viser le personnage et sa pièce, puis **Générer** ouvre la
  fenêtre *ce qui part* — elle doit paraître **sur-le-champ**, sans repos ;
- cliquer *corriger* sur la ligne **monde**, poser le curseur **au milieu** du
  texte et taper : les lettres s'affichent au fur et à mesure et **le curseur ne
  bouge pas** ;
- pendant qu'on tape, l'onglet réseau ne doit montrer **qu'un seul**
  `POST /api/outgoing` une fois la frappe posée — et non un par lettre ;
- le prix, en bas à droite, se remet à jour **avec** le texte, jamais l'un sans
  l'autre.

    py essais/atelier_jetable_m3.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.

**Ce que la console dit avant qu'on ouvre le navigateur.** Le compte de lectures
du projet pour les trois cas, mémo débranché puis branché. Un essai d'écran ne
remonterait pas ces chiffres-là : il ne voit pas ce que le serveur ne dit pas.
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

import atelier.depot.base as socle  # noqa: E402
from atelier.depot import Base  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble, image_sujet  # noqa: E402

PORT = 8427
MODELE = "essai:rend-du-png"


class MemoDebranche:
    """Le mémo neutralisé — l'atelier d'avant la tranche, le temps d'une mesure."""

    def get(self) -> None:
        return None

    def set(self, valeur: object) -> None:
        return None

    def reset(self, jeton: object) -> None:
        return None


def _attendre(client, identifiant: str) -> dict:
    for _ in range(300):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
    raise AssertionError("la génération n'a pas fini")


def peupler(atelier: Atelier, double: FournisseurDouble) -> dict[str, object]:
    """Un jeu qui a quelque chose à dire, un personnage habillé, une pièce."""
    with TestClient(creer_application(atelier)) as client:
        client.put(
            "/api/universe",
            json={
                "bible": [
                    {"nom": "monde", "texte": "marais de fer", "actif": True},
                    {
                        "nom": "style",
                        "texte": "peinture à l'huile sombre, contours nets",
                        "actif": True,
                    },
                ]
            },
        )

        plan = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]
        poses = plan[:2]
        personnage = client.post(
            "/api/characters",
            json={"nom": "Le pèlerin", "description": "un pèlerin encapuchonné"},
        ).json()["personnage"]["identifiant"]
        client.put(f"/api/characters/{personnage}", json={"poses": poses})

        double.rendre = lambda: image_sujet(bloc=4, toile=24)
        for pose in poses:
            faite = client.post(
                "/api/generations",
                json={
                    "modele": MODELE,
                    "prompt": f"le pèlerin, {pose}",
                    "personnage": personnage,
                    "pose": pose,
                },
            )
            _attendre(client, faite.json()["identifiant"])
        double.rendre = None

        piece = client.post(
            "/api/characters/pieces",
            json={
                "nom": "sac de voyage",
                "description": "un gros sac de voyage avec corde et matelas roulé",
                "emplacement": "dos",
                "portee": "contenue",
            },
        ).json()["piece"]["identifiant"]

        equipement = {
            "modele": MODELE,
            "prompt": "a big travel backpack with rope and bedroll",
            "personnage": personnage,
            "piece": piece,
            "poses": poses,
        }

        # ── Ce que l'écran n'aura plus qu'à ne pas faire attendre ────────────
        compte = [0]
        vraie = Base._lire_projet_du_disque

        def compter(self, identifiant):
            compte[0] += 1
            return vraie(self, identifiant)

        Base._lire_projet_du_disque = compter

        def lectures(appel) -> int:
            compte[0] = 0
            appel()
            return compte[0]

        apercu = lambda: client.post(  # noqa: E731
            "/api/prompt/preview", json={"prompt": "un pèlerin"}
        )
        ordinaire = lambda: client.post(  # noqa: E731
            "/api/outgoing", json={"modele": MODELE, "prompt": "un pèlerin"}
        )
        lourd = lambda: client.post("/api/outgoing", json=equipement)  # noqa: E731

        vrai_memo = socle._projets_lus
        socle._projets_lus = MemoDebranche()
        avant = (lectures(apercu), lectures(ordinaire), lectures(lourd))
        socle._projets_lus = vrai_memo
        apres = (lectures(apercu), lectures(ordinaire), lectures(lourd))

        Base._lire_projet_du_disque = vraie

        print()
        print("  Lectures du projet, par demande        avant   après")
        for titre, a, b in zip(
            ("l'aperçu du texte seul   ", "une image ordinaire      ",
             "un équipement            "),
            avant,
            apres,
        ):
            print(f"    {titre}            {a:>3}     {b:>3}")
        print()

        return {"personnage": personnage, "piece": piece, "poses": poses}


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-m3-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    montage = peupler(atelier, double)

    print(f"Atelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print(f"  Le personnage à viser : {montage['personnage']}")
    print(f"  Sa pièce              : {montage['piece']}")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
