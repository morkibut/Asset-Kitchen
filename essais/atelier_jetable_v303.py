# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la V3.03.2 — **les tables sur une sélection**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8471 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel. (Celui d'`A7` prend le 8470 ; les
deux peuvent tourner côte à côte.)

## Comment le lancer

    py essais/atelier_jetable_v303.py

## Ce qu'il monte

Le personnage et le clip d'`A4`, importés et non recopiés, puis **une animation
de six images dont trois portent déjà leur recette à elles, et pas la même** :

- la 2ᵉ s'écarte sur le **détourage** seul,
- la 4ᵉ s'écarte sur les **couleurs** seules,
- la 5ᵉ s'écarte sur **les deux**.

**Rien n'a été payé** : l'animateur est un double qui rend un clip déjà sur le
disque et facture zéro.

Trois écarts différents, et c'est la condition pour que la tranche se voie. Sur
un lot d'accord sur tout, une sélection ne montre rien de plus qu'une image
seule : pas de mot *séparé*, pas de phrase de lot, aucune valeur à préserver —
et un écran cassé passerait sans qu'on le remarque.

## Ce qu'on vient voir à l'écran

- **Choisir plusieurs images.** Clic sur la 2ᵉ, maj-clic sur la 5ᵉ : quatre
  images choisies. Ctrl-clic en retire une. Les boutons « toutes » et « une
  seule », en haut du ruban, font la même chose sans souris.
- **Le mot « séparé »** sur les titres *détourage* et *quantification*, et sur
  eux seuls : ce sont les deux places où les quatre images ne disent pas la
  même chose. Sur *bords*, elles sont d'accord, et rien ne s'affiche.
- **La phrase du lot, une fois** : *3 images sur les 4 choisies ont leur recette
  à elles*. Une fois, pas quatre — et le liseré du ruban montre lesquelles.
- **⚠️ Le geste qui prouve la tranche.** Les quatre choisies, bougez la
  **tolérance** du détourage. Les quatre la prennent, **et la 4ᵉ garde ses
  couleurs réduites** : ouvrez-la seule pour le vérifier. C'est là que se
  jouerait le défaut — poser la recette entière au lieu de la valeur touchée
  réécrirait en silence tout ce que ces images ne partageaient pas.
- **Une recette enregistrée, elle, remplace tout** — c'est un ensemble. Il y en
  a une, « pixel serré ». L'écran dit avant, en une phrase et une seule,
  combien de recettes individuelles elle va effacer.
- **« Toutes »** ne se règle pas comme les autres : ce qui se pose alors va sur
  la recette de l'animation, et le ruban ne se couvre pas de liserés.
- **Rien n'est écrit tant qu'on n'a pas enregistré**, et « Annuler » ramène
  exactement l'état d'ouverture.

## ⚠️ Ce qu'il ne faut pas faire

**Ne cliquez pas « Commander »** : l'animateur est doublé et facture zéro, mais
ce n'est pas ce qu'on vient regarder.
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

# Le peuplement est celui d'`A4`, **importé et pas recopié** — deux ateliers
# jetables qui monteraient chacun leur personnage finiraient par ne plus décrire
# le même produit.
from atelier_jetable_a4 import peupler  # noqa: E402
from conftest import FournisseurDouble  # noqa: E402
from test_a9 import MELE, AnimateurDouble  # noqa: E402
from test_a10 import clip_connu  # noqa: E402

PORT = 8471

# Six images, **prises dans le clip et non écrites en dur**. Un jour où le clip
# d'essai en portera deux de moins, un numéro en dur ferait refuser la garde et
# l'atelier ne s'ouvrirait pas du tout — pour un chiffre qui n'apprend rien.
COMBIEN = 6

# Les trois écarts, **et ils sont différents entre eux**. Un lot où toutes les
# images s'écartent de la même façon est un lot d'accord avec lui-même : il ne
# montre ni le mot « séparé », ni ce qu'une valeur posée doit préserver.
TOLERANCE_ECARTEE = 57
COULEURS_ECARTEES = 8


def poser_la_bande_separee(atelier: Atelier, personnage: str, clip: str):
    """Six images, trois recettes individuelles, et la relecture depuis le disque.

    Elle est gardée par la vraie porte puis **refermée**, et ce qui revient vient
    d'un `GET` : un lot qui partirait bien et s'écrirait mal rendrait exactement
    la même réponse au `PUT`.
    """
    with TestClient(creer_application(atelier)) as client:
        montage = client.get(f"/api/montage/{clip}").json()
        du_jeu = montage["recette_du_jeu"]
        # La seconde moitié du clip, une image sur deux — celle où le cycle se
        # referme, et de quoi remplir six cases sans sortir de la pellicule.
        combien = montage["clip"]["images"]
        images = [combien // 2 + 2 * pas for pas in range(COMBIEN)][: COMBIEN]
        images = [numero for numero in images if numero < combien]

        reponse = client.post(
            "/api/strips",
            json={
                "clip": clip,
                "nom": "marche à corriger",
                "images": images,
                "cadence": 10.0,
                "sens": "boucle",
                "recette": du_jeu,
            },
        )
        # **Le refus se lit, il ne se devine pas.** Un `KeyError` sur la réponse
        # dirait « pas d'identifiant » là où le serveur a écrit une raison.
        if reponse.status_code != 200:
            raise SystemExit(
                f"Le serveur a refusé la garde ({reponse.status_code}) : {reponse.text}"
            )
        gardee = reponse.json()
        identifiant = gardee["identifiant"]
        client.put(
            f"/api/strips/{identifiant}/case",
            json={"personnage": personnage, "pose": "marche"},
        )

        def autrement(*, tolerance: int | None = None, couleurs: int | None = None):
            recette = dict(du_jeu)
            if tolerance is not None:
                passes = [dict(p) for p in (recette.get("passes") or [{}])]
                passes[0] = {**passes[0], "moteur": "bord", "tolerance": tolerance}
                recette["passes"] = passes
            if couleurs is not None:
                recette["quantification"] = {
                    **(recette.get("quantification") or {}),
                    "couleurs": couleurs,
                }
            return recette

        # Les trois écarts, posés **d'un seul appel** : la route prend la liste.
        siennes = {
            1: autrement(tolerance=TOLERANCE_ECARTEE),
            3: autrement(couleurs=COULEURS_ECARTEES),
            4: autrement(
                tolerance=TOLERANCE_ECARTEE, couleurs=COULEURS_ECARTEES
            ),
        }
        client.put(
            f"/api/strips/{identifiant}",
            json={
                "prises": [
                    {"numero": numero, **({"recette": siennes[rang]} if rang in siennes else {})}
                    for rang, numero in enumerate(images)
                ]
            },
        )

        # **Une recette enregistrée**, sans quoi le bloc ne paraît pas et la
        # moitié de la tranche n'est pas cliquable : c'est le seul geste de
        # l'écran qui *remplace* au lieu de reporter une valeur.
        client.put(
            "/api/recipes/pixel serré",
            json={
                **du_jeu,
                "passes": [{"moteur": "bord", "tolerance": 21}],
                "quantification": {
                    **(du_jeu.get("quantification") or {}),
                    "couleurs": 32,
                },
            },
        )

        # ⚠️ **On referme, puis on rouvre.** C'est ce qui prouve que le lot est
        # sur le disque et pas seulement dans la réponse qu'on vient de lire.
        return identifiant, client.get(f"/api/strips/{identifiant}").json()


def principal() -> int:
    manque = decodeur.indisponible()
    if manque:
        print(f"Le décodeur vidéo manque : {manque}")
        print("Sans lui, le clip n'a aucune image à découper.")
        return 2

    dossier = Path(tempfile.mkdtemp(prefix="atelier-v303-"))
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
    identifiant, rouverte = poser_la_bande_separee(atelier, personnage, clip)
    bande = rouverte["bande"]
    ecarts = rouverte["ecarts"]

    print()
    print(f"  Le personnage : {personnage}")
    print(f"  Le clip       : {clip}")
    print(
        f"  L'animation   : {identifiant}  ({bande['nom']}, {len(bande['prises'])} images)"
    )
    print()
    print("  Ce que chaque image écarte de l'animation, une fois rouverte")
    for rang, ecart in enumerate(ecarts):
        places = ", ".join(ecart["places"]) or "—"
        print(f"    image {rang + 1}   {places}")

    porteuses = sum(1 for e in ecarts if e["places"])
    print()
    if porteuses != 3:
        print("  ⚠️ Trois images devraient porter leur recette, et il y en a")
        print(f"     {porteuses}. Le lot ne s'est pas écrit, ou ne s'est pas relu :")
        print("     l'écran n'a alors rien à montrer et cet essai ne prouve rien.")
    else:
        print("  → Trois images portent leur recette, et pas la même : le ruban")
        print("    doit montrer trois liserés, et les tables « détourage » et")
        print("    « quantification » doivent dire « séparé » sur une sélection")
        print("    qui les mélange.")

    print()
    print("  À cliquer :")
    print("    Codex › Personnages › Le nain › « animations »")
    print("    — la **vignette** de « marche à corriger » ouvre son atelier")
    print("    — clic sur la 2ᵉ image, **maj-clic** sur la 5ᵉ : quatre choisies")
    print("    — « séparé » paraît sur *détourage* et *quantification*, pas sur")
    print("      *bords* : c'est là que les quatre ne s'accordent pas")
    print("    — la phrase du lot dit **une fois** combien d'images ont la leur")
    print("    — bougez la **tolérance** : les quatre la prennent, et la 4ᵉ")
    print(f"      garde ses {COULEURS_ECARTEES} couleurs — rouvrez-la seule pour le voir")
    print("    — « toutes », puis un réglage : il va sur l'animation, et aucun")
    print("      liseré n'apparaît")
    print("    — la recette « pixel serré » remplace tout, et l'écran dit avant")
    print("      combien d'images vont perdre la leur")
    print("    — « Annuler » ramène exactement l'état d'ouverture")
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
