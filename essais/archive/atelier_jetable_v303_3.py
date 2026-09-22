# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la V3.03.3 — **la bande se monte**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8472 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel. (`A7` prend le 8470, la V3.03.2
le 8471 ; les trois peuvent tourner côte à côte.)

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    py essais/atelier_jetable_v303_3.py

## Ce qu'il monte

Le personnage et le clip d'`A4`, importés et non recopiés, puis **deux
animations** :

- **« marche à monter »** — cinq images d'un seul clip, la 3ᵉ portant sa recette
  à elle, **et deux images déjà au chutier**. Le chutier est écrit avant que
  l'atelier n'ouvre, puis relu depuis le disque : ce qu'on voit à l'écran a fait
  l'aller-retour.
- **« marche mêlée »** — quatre images dont une empruntée à un second clip.
  Elle n'est là que pour une chose : montrer **« Reprendre le montage »
  éteint, avec sa raison**.

**Rien n'a été payé** : l'animateur est un double qui rend un clip déjà sur le
disque et facture zéro. Les deux clips sont le même film — ce qu'on vient voir
est qu'une bande sait d'où vient chacune de ses images, et deux exemplaires
identiques le montrent aussi bien.

## Ce qu'on vient voir à l'écran

- **Le chutier est déjà plein en ouvrant.** Deux images, dont une avec sa
  recette. Personne ne les a posées dans cette session : elles reviennent du
  disque.
- **Dupliquer.** Choisissez la 2ᵉ image, « Dupliquer » : la copie se pose *juste
  après* l'originale, et devient la sélection. La recette de la source suit la
  copie — c'est la même image.
- **Retirer ne perd rien.** L'image retirée descend au chutier, avec sa recette.
- **Poser une image du chutier.** Choisissez une image de la bande, puis
  « avant » ou « après » dans le chutier : elle s'insère là, pas au bout.
  ⚠️ **Ça vise l'image choisie, pas celle qui passe** — le lecteur tourne, et
  l'image affichée change toute seule.
- **Déplacer** — les flèches ‹ › du bloc de montage, ou glisser une image du
  ruban sur une autre.
- **Prendre des images dans le clip.** Le lien du chutier ouvre la pellicule
  entière du clip. Les images déjà dans la bande y sont marquées. On en coche
  plusieurs, un seul bouton les envoie au chutier.
- **Remplacer une prise ne transporte pas sa recette.** Ouvrez la fiche de la
  3ᵉ image — celle qui a la sienne — et changez son numéro : l'écran prévient
  **avant**, et il ne le dit que pour les images qui ont quelque chose à perdre.
- **Reprendre le montage.** Le montage rouvre sur les images retenues, avec la
  vitesse de la bande (11 img/s, aller-retour) déjà en place. **Le cadre s'y
  montre en lecture, avec sa raison** : il est mesuré sur les images retenues,
  et le montage ne sait pas le remesurer. Changez la sélection, refermez : la
  bande est à jour, et ce qui sort du choix part au chutier.
- **Et sur « marche mêlée », le bouton est éteint** et dit pourquoi : le montage
  ne connaît qu'un clip, rouvrir dessus perdrait l'image empruntée.
- **Rien n'est écrit avant « Enregistrer »**, et « Annuler » ramène exactement
  l'état d'ouverture — *sauf* la reprise du montage, qui écrit en refermant.
  C'est pour ça qu'elle refuse de partir sur des corrections en attente.
- **Tout au clavier** : Tab jusqu'au ruban, flèches pour choisir, les boutons de
  montage sont des boutons.

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

PORT = 8472

# Cinq images dans la bande, deux au chutier : de quoi retirer sans vider, et
# poser sans que le chutier disparaisse au premier geste.
COMBIEN = 5
AU_CHUTIER = 2

# La cadence et le sens ne sont **pas** ceux du jeu, et c'est la condition pour
# que la reprise du montage prouve quelque chose : un montage qui repartirait
# des réglages par défaut rendrait par accident les bons chiffres.
CADENCE = 11.0
SENS = "aller-retour"

# L'écart de la 3ᵉ image, et de l'une des deux du chutier. Il n'a pas besoin
# d'être joli : il a besoin de se voir sur le liseré du ruban et de donner à
# « remplacer la prise » quelque chose à faire perdre.
TOLERANCE_ECARTEE = 57


def _second_clip(client, sprite: str) -> str:
    """Un second exemplaire du même clip — de quoi faire une bande mêlée.

    Le même double le rend, donc les deux clips portent les mêmes images. Ce
    qu'on vient montrer est **qu'une bande mêlée ferme la reprise du montage** ;
    deux exemplaires identiques le montrent aussi bien que deux films
    différents, et ne coûtent rien de plus.
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


def _garder(client, clip: str, nom: str, images: list[int], personnage: str) -> str:
    """Une bande gardée par la vraie porte, rangée dans la case du personnage."""
    du_jeu = client.get(f"/api/montage/{clip}").json()["recette_du_jeu"]
    reponse = client.post(
        "/api/strips",
        json={
            "clip": clip,
            "nom": nom,
            "images": images,
            "cadence": CADENCE,
            "sens": SENS,
            "recette": du_jeu,
        },
    )
    # **Le refus se lit, il ne se devine pas.** Un `KeyError` sur la réponse
    # dirait « pas d'identifiant » là où le serveur a écrit une raison.
    if reponse.status_code != 200:
        raise SystemExit(
            f"Le serveur a refusé la garde de « {nom} » "
            f"({reponse.status_code}) : {reponse.text}"
        )
    identifiant = reponse.json()["identifiant"]
    client.put(
        f"/api/strips/{identifiant}/case",
        json={"personnage": personnage, "pose": "marche"},
    )
    return identifiant


def poser_les_bandes(atelier: Atelier, personnage: str, clip: str, autre: str):
    """Les deux animations, et **leur relecture depuis le disque**.

    Elles sont gardées par la vraie porte puis refermées, et ce qui revient
    vient d'un `GET` : un chutier qui partirait bien et s'écrirait mal rendrait
    exactement la même réponse au `PUT` (`AGENTS.md`, 8septies).
    """
    with TestClient(creer_application(atelier)) as client:
        montage = client.get(f"/api/montage/{clip}").json()
        du_jeu = montage["recette_du_jeu"]

        # La fin du clip, **une image sur deux tant que la pellicule le permet**
        # — c'est là que le cycle se referme, et sauter une image sur deux rend
        # le mouvement franc. Le pas retombe à un sur un clip court plutôt que
        # de déborder : les numéros ne sont pas écrits en dur ici, justement
        # parce qu'un clip d'essai plus court ferait refuser la garde et
        # l'atelier ne s'ouvrirait pas du tout.
        combien = montage["clip"]["images"]
        voulues = COMBIEN + AU_CHUTIER
        if combien < voulues:
            raise SystemExit(
                f"Le clip ne porte que {combien} images : il en faut "
                f"{voulues} pour monter la bande et son chutier."
            )
        pas = 2 if combien >= 2 * voulues else 1
        depart = combien - pas * voulues
        pioche = [depart + pas * rang for rang in range(voulues)]
        dans_la_bande, mises_de_cote = pioche[:COMBIEN], pioche[COMBIEN:]

        sienne = dict(du_jeu)
        passes = [dict(p) for p in (du_jeu.get("passes") or [{}])]
        passes[0] = {**passes[0], "moteur": "bord", "tolerance": TOLERANCE_ECARTEE}
        sienne["passes"] = passes

        a_monter = _garder(client, clip, "marche à monter", dans_la_bande, personnage)

        # **Le chutier est posé avant l'ouverture, pas pendant.** C'est ce qui
        # fait de son affichage une relecture et non un écho : s'il ne revenait
        # pas du disque, l'écran s'ouvrirait vide et le défaut serait visible
        # du premier coup d'œil.
        client.put(
            f"/api/strips/{a_monter}",
            json={
                "prises": [
                    {
                        "numero": numero,
                        **({"recette": sienne} if rang == 2 else {}),
                    }
                    for rang, numero in enumerate(dans_la_bande)
                ],
                "chutier": [
                    {
                        "numero": numero,
                        **({"recette": sienne} if rang == 0 else {}),
                    }
                    for rang, numero in enumerate(mises_de_cote)
                ],
            },
        )

        melee = _garder(client, clip, "marche mêlée", dans_la_bande[:4], personnage)
        client.put(
            f"/api/strips/{melee}",
            json={
                "prises": [
                    {"numero": numero, **({"clip": autre} if rang == 3 else {})}
                    for rang, numero in enumerate(dans_la_bande[:4])
                ]
            },
        )

        # ⚠️ **On referme, puis on rouvre.**
        return (
            (a_monter, client.get(f"/api/strips/{a_monter}").json()),
            (melee, client.get(f"/api/strips/{melee}").json()),
        )


def principal() -> int:
    manque = decodeur.indisponible()
    if manque:
        print(f"Le décodeur vidéo manque : {manque}")
        print("Sans lui, le clip n'a aucune image à découper.")
        return 2

    dossier = Path(tempfile.mkdtemp(prefix="atelier-v3033-"))
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

    (a_monter, rouverte), (melee, mixte) = poser_les_bandes(
        atelier, personnage, clip, autre
    )
    bande = rouverte["bande"]
    chutier = bande["chutier"]

    print()
    print(f"  Le personnage : {personnage}")
    print(f"  Le clip       : {clip}")
    print(f"  L'autre clip  : {autre}")
    print(f"  À monter      : {a_monter}  ({len(bande['prises'])} images, "
          f"{len(chutier)} au chutier)")
    print(f"  Mêlée         : {melee}  ({len(mixte['bande']['clips'])} clips)")
    print()

    print("  Ce qui revient du disque")
    for rang, prise in enumerate(bande["prises"]):
        sienne = "  ← sa recette à elle" if prise.get("recette") else ""
        print(f"    ruban {rang + 1}    image {prise['numero']}{sienne}")
    for rang, prise in enumerate(chutier):
        sienne = "  ← sa recette à elle" if prise.get("recette") else ""
        print(f"    chutier {rang + 1}  image {prise['numero']}{sienne}")

    print()
    if len(chutier) != AU_CHUTIER:
        print(f"  ⚠️ Le chutier devrait porter {AU_CHUTIER} images, il en rend")
        print(f"     {len(chutier)}. Il ne s'est pas écrit, ou ne s'est pas relu :")
        print("     l'écran s'ouvrira vide et cet essai ne prouve rien.")
    elif not any(p.get("recette") for p in chutier):
        print("  ⚠️ Aucune image du chutier ne rend sa recette. La réserve tient")
        print("     les numéros et perd les réglages : une image reposée dans la")
        print("     bande reviendrait nue.")
    else:
        print("  → Le chutier revient plein, recette comprise. L'écran doit")
        print("    l'afficher dès l'ouverture, avant tout geste.")

    print()
    print("  À cliquer :")
    print("    Codex › Personnages › Le nain › « animations »")
    print("    — la **vignette** de « marche à monter » ouvre son atelier")
    print("    — le chutier est **déjà plein** : deux images, dont une réglée")
    print("    — 2ᵉ image, « Dupliquer » : la copie se pose juste après, et")
    print("      devient la sélection ; sa recette a suivi")
    print("    — « Retirer » : l'image descend au chutier, rien n'est perdu")
    print("    — choisissez une image, puis « avant » / « après » au chutier :")
    print("      ⚠️ ça vise l'image **choisie**, pas celle qui passe à l'écran")
    print("    — ‹ › déplacent, et glisser une image sur une autre aussi")
    print("    — « prendre des images dans le clip › » ouvre la pellicule")
    print("      entière ; celles déjà dans la bande y sont marquées")
    print("    — la fiche de la 3ᵉ image : changez son numéro, l'écran dit")
    print("      **avant** que la recette ne suivra pas")
    print(f"    — « Reprendre le montage › » : {CADENCE:.0f} img/s et « {SENS} »")
    print("      sont déjà là, et le **cadre est en lecture** avec sa raison")
    print("    — refermer le montage met la bande à jour ; ce qui sort du choix")
    print("      part au chutier")
    print("    — sur « marche mêlée », le bouton est **éteint** et dit pourquoi")
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
