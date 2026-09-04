# -*- coding: utf-8 -*-
"""Un atelier jetable pour voir A6 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8430, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui
ne bouge pas d'un pixel.

Il monte le seul décor dont la tranche a besoin : **un plan de poses où l'une des
cases n'a aucun mouvement connu**. C'est ce qui rend visible la moitié qui compte
— une pose que le produit sait animer, à côté d'une pose qu'il ne sait pas
animer, et la même liste derrière les deux.

De quoi cliquer sur ce que la tranche livre :

- **Réglages › Les mouvements** : les sept mouvements livrés, chacun avec son
  texte anglais lisible **sans déplier** — c'est lui qui part —, sa cadence et
  les directions où il a un sens. Seule la mort en déclare une : elle n'a qu'un
  angle, quel que soit le personnage ;
- **cliquer un nom** déplie ses trois réglages, chacun avec son explication au
  survol du libellé. Le bouton de masquage ne promet pas la même chose des deux
  côtés — un livré se remontre, un fabriqué s'en va ;
- **Nommer un mouvement** : le bouton reste éteint tant que les deux textes ne
  sont pas là. C'est la définition — un mouvement sans texte anglais ne fait rien
  partir, un mouvement sans nom ne se clique pas ;
- une fois nommé, il porte la marque **nommé ici**, celle que le produit met
  partout sur ce que l'auteur a réglé lui-même.

Et ce que le terminal imprime avant de servir : **ce qui partira pour animer
chaque case du plan**, avec l'origine de chaque texte. C'est la moitié qu'un
écran ne montre pas encore — l'écran qui commande un clip arrive en `A9`.

    py essais/atelier_jetable_a6.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.

**Aucun appel, aucun centime** : un mouvement est du vocabulaire, il s'écrit sur
le disque, et rien de cette tranche ne parle à un fournisseur.
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

from atelier.services import Atelier  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble  # noqa: E402

PORT = 8430


def peupler(atelier: Atelier) -> list[dict[str, object]]:
    """Une pose de plus que le produit ne sait pas animer, et le relevé complet.

    **C'est la pose inventée qui prouve la règle.** Les six du plan de départ
    trouvent leur mouvement par l'identifiant seul ; « salue » n'en trouve aucun
    et se commande quand même, avec la consigne figée que l'auteur a écrite.
    """
    with TestClient(creer_application(atelier)) as client:
        client.post(
            "/api/characters/poses",
            json={"nom": "salue", "consigne": "waving hello, full body"},
        )
        # Un mouvement nommé ici, pour que la marque « nommé ici » ait de quoi
        # se voir à côté des sept livrés.
        client.post(
            "/api/movements",
            json={
                "nom": "nage",
                "texte": "swimming cycle, arms stroking, looping seamlessly",
                "cadence": 10,
            },
        )
        releve = []
        for pose in client.get("/api/characters").json()["plan"]:
            recu = client.get(
                f"/api/movements/for-pose/{pose['identifiant']}"
            ).json()
            releve.append(
                {
                    "pose": pose["nom"],
                    "origine": recu["origine"],
                    "texte": recu["texte"],
                }
            )
        return releve


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-a6-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: FournisseurDouble(),
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    releve = peupler(atelier)

    print()
    print("  Ce qui partira pour animer chaque case du plan :")
    for ligne in releve:
        marque = {
            "mouvement": "mouvement",
            "pose": "consigne figée",
            "aucun": "rien",
        }[str(ligne["origine"])]
        print(f"    {str(ligne['pose']):<10} [{marque:<14}] {ligne['texte']}")
    print()
    print(f"Atelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
