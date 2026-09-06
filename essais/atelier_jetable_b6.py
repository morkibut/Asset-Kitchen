# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B6 — la barre**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8474 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b6.py

## Ce qu'il monte

Un jeu avec de quoi remplir les six verbes de la barre : **un pèlerin** avec
trois poses faites, **une épée** — une pièce d'équipement, pour que
`equip_character` ait un sens —, et trois images dans la bibliothèque. Sans
tout ça, la moitié des gestes seraient absents, et absents *à raison* : c'est la
règle de la tranche, mais elle ne se regarde pas sur un écran vide.

**Rien n'a été payé** : le fournisseur est le double des essais, il ne touche
pas au réseau et ne facture rien.

## Ce qu'on vient voir à l'écran

- **`Ctrl+K` ouvre la barre**, de n'importe quel écran, et `échap` la referme.
- **Six groupes au plus**, dans l'ordre : *Aller à*, *Créer*, *Générer*,
  *Travailler*, *Sortir*, *Régler*. Jamais un septième.
- **Une seule marque rouille**, sur les deux actions qui coûtent : *à
  confirmer*. Cliquer dessus ouvre l'écran d'envoi — **rien ne part**.
- **Les trois gestes d'entretien sont là**, et aucun bouton du produit ne les
  déclenche : reconstruire l'index, recalculer le rendu, relire le catalogue.
  Le premier dit combien d'images il a relues, dans le journal.
- **Taper « pelerin »** — sans accent — trouve le personnage, avec son contexte
  sous son nom : combien de poses sur combien.
- **Le pied compte** ce que le serveur a servi.

## ⚠️ Ce qu'il ne faut pas faire

**Ne cliquez pas « Payer et lancer »** sur l'écran d'envoi que la barre ouvre :
le double facture zéro, mais ce n'est pas ce qu'on vient regarder.
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
from atelier.services import Atelier  # noqa: E402

# Le double des essais, **importé et pas recopié** : deux fournisseurs doubles
# qui divergeraient finiraient par ne plus décrire le même produit.
from conftest import FOND, SUJET, SUJET_SOMBRE, FournisseurDouble  # noqa: E402

PORT = 8474
MODELE = "essai:rend-du-png"


def sujet(*, toile: int = 32, bloc: int = 8) -> bytes:
    """Une silhouette rayée sur le fond que les modèles rendent vraiment."""
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
    grande = petite.resize((toile * bloc, toile * bloc), Image.Resampling.NEAREST)
    tampon = io.BytesIO()
    grande.save(tampon, format="PNG")
    return tampon.getvalue()


def _attendre(client, generation: str) -> dict:
    for _ in range(600):
        etat = client.get(f"/api/generations/{generation}").json()
        if etat["statut"] in ("reussie", "echouee", "interrompue"):
            return etat
        client.get("/api/status")
    return client.get(f"/api/generations/{generation}").json()


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def peupler(atelier: Atelier, double: FournisseurDouble) -> dict:
    """Le pèlerin, l'épée, et trois images — de quoi remplir les six verbes."""
    double.rendre = sujet

    with TestClient(creer_application(atelier)) as client:
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

        emplacement = _exiger(
            client.post("/api/characters/slots", json={"nom": "Les mains"}),
            "l'emplacement « les mains »",
        )
        identifiant_emplacement = (
            emplacement.get("emplacement", {}).get("identifiant")
            or emplacement.get("emplacements", [{}])[-1].get("identifiant", "")
        )

        _exiger(
            client.post(
                "/api/characters/pieces",
                json={
                    "nom": "L'épée",
                    "description": "une épée courte à garde de cuir",
                    "emplacement": identifiant_emplacement,
                },
            ),
            "la pièce « l'épée »",
        )

        poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]
        for pose in poses[:3]:
            depart = _exiger(
                client.post(
                    "/api/generations",
                    json={
                        "modele": MODELE,
                        "prompt": f"le pèlerin, {pose}",
                        "personnage": pelerin,
                        "pose": pose,
                        "echelle": "personnage",
                    },
                ),
                f"la génération « {pose} »",
            )
            _attendre(client, depart["identifiant"])

        # Ce que la barre recevra, relu ici depuis le serveur : si les deux ne
        # disaient pas la même chose, l'un des deux mentirait.
        return client.get("/api/actions").json()


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b6-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(racine=dossier, fabrique_fournisseur=lambda: double)
    servi = peupler(atelier, double)

    print()
    print(f"  Appels payés : {double.appels}  (double : facture zéro)")
    print()
    print("  Ce que la barre recevra")
    verbe = None
    for action in servi["actions"]:
        if action["verbe"] != verbe:
            verbe = action["verbe"]
            print(f"    · {verbe}")
        marque = "à confirmer" if action["paiement"] == "a-confirmer" else "gratuit"
        route = f"  → {action['route']}" if action["route"] else f"  → {action['ou']}"
        print(f"        {action['titre']:<52} {marque:<12}{route}")

    payantes_avec_route = [
        a for a in servi["actions"] if a["paiement"] == "a-confirmer" and a["route"]
    ]
    print()
    if payantes_avec_route:
        print("  ⚠️ Une action payante porte une route — la barre pourrait la lancer :")
        for action in payantes_avec_route:
            print(f"     {action['outil']} → {action['route']}")
    else:
        print("  ✓ Aucune action payante ne porte de route. La barre ne peut pas payer.")

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/  puis Ctrl+K.")
    print("  Ctrl+C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
