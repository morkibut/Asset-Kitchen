# -*- coding: utf-8 -*-
"""L'atelier jetable de `B19` — **le vestiaire, et surtout la relecture sans perte**.

    cd interface && npm run build   # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b19.py
    # puis http://127.0.0.1:8481/

`sans-servir` en argument monte le décor, imprime le résumé et rend la main sans
lancer `uvicorn` — de quoi vérifier le peuplement sans occuper le port.

**Ce qu'il monte, et pourquoi.** La tranche a un critère qui pèse plus que les
autres : *les pièces déjà écrites sur le disque se relisent sans perte et sans
porteur*. Un atelier peuplé par les routes neuves ne le mesure pas — toutes ses
pièces naîtraient déclarées. Celui-ci écrit donc **deux pièces exactement comme
le disque de l'auteur les porte**, sans la clé `emplois`, en réécrivant le
fichier du projet à la main après coup ; puis il leur pose de vrais calques.

| Ce qui est monté | Pourquoi |
|---|---|
| `Epée`, sans la clé `emplois`, avec des calques sur **deux** personnages | le cas exact de `helmet` sur le disque de l'auteur : deux porteurs qu'aucun fichier ne déclare, et que seule la lecture des calques retrouve |
| `Sac de voyage`, sans la clé `emplois`, avec un calque sur **un** personnage | le cas simple, pour vérifier que le compte suit |
| `Casque de fer`, née **après** la tranche, sans porteur | *une pièce ne porte personne par défaut* — elle ne doit apparaître dans le vestiaire de personne |
| `Le goliath`, `Le minus`, `Le magicien` | trois porteurs possibles ; le magicien ne porte rien, pour que « il ne porte rien encore » se voie |
| `Les cavernes du nord`, un décor | il ne porte pas d'équipement, et sa fiche ne doit dessiner **aucune** section de vestiaire |

**Ce qu'on vient voir à l'écran** :

1. Le carnet › *Les équipements* déplie **trois pièces**, chacune avec son compte
   d'emplois — l'épée doit dire *2 emplois* alors que son fichier n'en déclare
   aucun.
2. Ouvrir *Epée* : ses deux emplois portés paraissent, marqués **lus sur ses
   images** — c'est la relecture sans perte, en direct.
3. Ouvrir un emploi : la matrice est **une colonne de poses**, pas une grille de
   vingt-quatre cases.
4. Retirer un porteur : il disparaît de la liste, **et ne revient pas** au
   rechargement, alors que ses calques sont toujours sur le disque. C'est le
   cœur du critère.
5. La fiche du goliath : *Son vestiaire* montre l'épée et le sac, et **pas** le
   casque de fer que personne ne porte.
6. La fiche du décor : aucune section de vestiaire.
7. Nommer une pièce depuis la fiche du magicien : elle lui est attribuée
   d'emblée.

⚠️ **Ce qu'il ne faut pas faire** : le lancer sur `donnees/`. Il écrit dans un
dossier temporaire, et il réécrit le fichier du projet à la main — le faire sur
l'atelier de l'auteur abîmerait ses vraies pièces.
"""

from __future__ import annotations

import json
import sys
import tempfile
import time
from pathlib import Path

import uvicorn

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

# Le double des essais, **importé et pas recopié** — même raison qu'en B9/B10/B13.
from conftest import image_sujet  # noqa: E402

PORT = 8481


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _sujet(client, nom: str, **corps) -> dict:
    return _exiger(
        client.post("/api/characters", json={"nom": nom, **corps}),
        f"la création de « {nom} »",
    )["personnage"]


def _piece(client, nom: str, **corps) -> dict:
    return _exiger(
        client.post("/api/characters/pieces", json={"nom": nom, **corps}),
        f"la création de la pièce « {nom} »",
    )["piece"]


def _calque(
    atelier, client, dossier: Path, *, personnage: str, piece: str, pose: str, rang: int
) -> str:
    """Un calque tel que le dépliage d'une planche d'équipement l'aurait laissé.

    Les trois champs sont posés à la main, comme `tests/test_b19.py` et
    `tests/test_e15.py` le font : ce qu'on vient voir ici est la **lecture** d'un
    couple *(pièce, personnage)*, pas la façon dont le calque est né. Payer une
    planche pour monter un décor de vérification n'aurait rien mesuré de plus.
    """
    fichier = dossier / f"{personnage}-{piece}-{pose}.png"
    fichier.write_bytes(image_sujet(toile=64, bloc=4, logique_l=rang + 6, logique_h=14))
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(fichier), "forcer": True}),
        f"l'import du calque « {piece} » de « {personnage} »",
    )["asset"]
    objet = atelier.assets.lire(importe["identifiant"])
    objet.personnage = personnage
    objet.pose = pose
    objet.piece = piece
    objet.label = f"{piece} · {pose}"
    atelier.assets.sauver(objet)
    return objet.identifiant


def _effacer_la_cle_emplois(atelier, projet: str) -> int:
    """**Remettre les pièces dans l'état d'avant la tranche.**

    Les routes neuves écrivent toujours la clé `emplois` — une pièce née après
    `B19` sait qu'elle ne porte personne. Le disque de l'auteur, lui, porte des
    pièces qui n'ont *jamais rien déclaré*, et les deux ne se lisent pas pareil :
    la première ne consulte plus rien, la seconde va chercher ses porteurs sur
    les calques. C'est exactement la distinction que ce jetable doit montrer,
    alors on réécrit le fichier du projet à la main, clé retirée.

    ⚠️ **Les deux copies, et il fallait le savoir** : le fichier
    `projets/<jeu>/projet.json` est la vérité, mais un projet ne se **relit pas**
    de là — `Base._lire_projet_du_disque` prend la colonne `contenu` de la table
    `projets`, un index dérivé du fichier qui ne se reconstruit qu'au changement
    de schéma. Retirer la clé du seul fichier ne changeait donc rien à l'écran, et
    le résumé disait « déclarée : oui » sur des pièces dont le fichier n'avait
    plus la clé. On écrit les deux, ce qui est exactement l'état où un atelier se
    trouve après avoir relu un disque d'avant la tranche.

    On ne passe pas par `sauver_projet` : il réécrirait la clé.
    """
    chemin = Path(atelier.fichiers.racine) / "projets" / projet / "projet.json"
    contenu = json.loads(chemin.read_text(encoding="utf-8"))
    efface = 0
    for piece in contenu.get("pieces", []):
        if piece.pop("emplois", None) is not None:
            efface += 1
    brut = json.dumps(contenu, ensure_ascii=False, indent=2)
    chemin.write_text(brut, encoding="utf-8")
    with atelier.base._connexion() as connexion:
        connexion.execute(
            "UPDATE projets SET contenu = ? WHERE identifiant = ?", (brut, projet)
        )
    return efface


def peupler(atelier: Atelier, dossier: Path) -> dict:
    gabarits = dossier / "gabarits"
    gabarits.mkdir(parents=True, exist_ok=True)

    with TestClient(creer_application(atelier)) as client:
        _exiger(
            client.post("/api/projects", json={"nom": "Le Marais du Vieux Moulin"}),
            "la création du jeu",
        )
        _exiger(client.put("/api/universe", json={"vue": "vue-dessus-34"}), "la vue du jeu")

        goliath = _sujet(client, "Le goliath")
        minus = _sujet(client, "Le minus")
        magicien = _sujet(client, "Le magicien")
        decor = _sujet(client, "Les cavernes du nord", famille="decors")

        # ── Les deux pièces d'avant la tranche ────────────────────────────────
        epee = _piece(
            client, "Epée", description="A classic one hand sword", emplacement="les mains"
        )
        sac = _piece(
            client, "Sac de voyage", description="a full travel pack", emplacement="le dos"
        )
        # Et une née après, qui ne porte personne — le défaut de la tranche.
        casque = _piece(client, "Casque de fer", emplacement="la tête")

        projet = atelier.bibliotheque.courant
        efface = _effacer_la_cle_emplois(atelier, projet)

        # ── Leurs calques, posés après coup ───────────────────────────────────
        # L'épée sur deux porteurs — le cas de `helmet` sur le disque de
        # l'auteur, celui qu'aucun fichier ne déclare.
        poses = ("repos", "marche", "course")
        calques = 0
        for rang, pose in enumerate(poses):
            _calque(
                atelier, client, gabarits,
                personnage=goliath["identifiant"], piece=epee["identifiant"],
                pose=pose, rang=rang,
            )
            calques += 1
        for rang, pose in enumerate(poses[:1]):
            _calque(
                atelier, client, gabarits,
                personnage=minus["identifiant"], piece=epee["identifiant"],
                pose=pose, rang=rang + 10,
            )
            calques += 1
        for rang, pose in enumerate(poses[:2]):
            _calque(
                atelier, client, gabarits,
                personnage=goliath["identifiant"], piece=sac["identifiant"],
                pose=pose, rang=rang + 20,
            )
            calques += 1

        # ── Ce que le serveur en dit, relu chez lui ───────────────────────────
        lu = _exiger(
            client.get("/api/characters/pieces/uses"), "la lecture du vestiaire"
        )
        choses = {
            p["identifiant"]: p
            for p in _exiger(client.get("/api/characters"), "la lecture des sujets")[
                "personnages"
            ]
        }
        sur_le_disque = json.loads(
            (Path(atelier.fichiers.racine) / "projets" / projet / "projet.json").read_text(
                encoding="utf-8"
            )
        )

    return {
        "efface": efface,
        "calques": calques,
        "vestiaire": lu,
        "choses": choses,
        "disque": sur_le_disque,
        "sujets": {
            "goliath": goliath["identifiant"],
            "minus": minus["identifiant"],
            "magicien": magicien["identifiant"],
            "decor": decor["identifiant"],
        },
        "pieces": {
            "epee": epee["identifiant"],
            "sac": sac["identifiant"],
            "casque": casque["identifiant"],
        },
    }


def principal(sans_servir: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents et des
    # flèches — le même geste que `essais/essai_jetons.py`.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b19-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)

    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s")
    print()
    print(
        f"  {monte['efface']} pièces remises dans l'état d'avant B19 "
        f"(clé « emplois » retirée du fichier), {monte['calques']} calques posés."
    )
    print()
    print("  Ce que le fichier du projet porte vraiment, pièce par pièce :")
    for piece in monte["disque"]["pieces"]:
        cle = "emplois" in piece
        print(
            f"    · {piece['nom']:<16} clé « emplois » : "
            f"{'oui — ' + str(piece.get('emplois')) if cle else 'ABSENTE (comme avant B19)'}"
        )

    print()
    print("  Ce que le serveur en relit, sans avoir rien écrit :")
    for sien in monte["vestiaire"]["pieces"]:
        porteurs = [e["porteur_nom"] for e in sien["emplois"] if e["genre"] == "porte"]
        print(
            f"    · {sien['piece']['nom']:<16} déclarée : {'oui' if sien['declare'] else 'non'}"
            f"  ·  {len(sien['emplois'])} emploi(s)"
            f"  ·  {sien['fait']} / {sien['attendu']}"
            f"  ·  portée par : {', '.join(porteurs) or 'personne'}"
        )

    print()
    print("  Ce que chaque sujet porte, lui :")
    for identifiant, chose in monte["choses"].items():
        print(
            f"    · {chose['nom']:<22} équipable : {'oui' if chose['equipable'] else 'non'}"
            f"  ·  ses pièces : {chose['pieces'] or 'aucune'}"
        )

    epee = next(
        s for s in monte["vestiaire"]["pieces"] if s["piece"]["identifiant"] == monte["pieces"]["epee"]
    )
    retrouves = len([e for e in epee["emplois"] if e["deduit"]])
    print()
    verdict = (
        "oui — c'est la relecture sans perte"
        if retrouves == 2
        else "NON — le décor est faux"
    )
    print(
        f"    → l'épée n'a rien de déclaré sur le disque et le serveur lui retrouve "
        f"{retrouves} porteur(s) sur ses calques : {verdict}"
    )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Carnet › Les équipements : trois pièces, avec leur compte d'emplois")
    print("  → « Epée » : ses deux emplois, marqués « lu sur ses images »")
    print("  → un emploi : la matrice est une colonne de poses, pas 24 cases")
    print("  → retirer un porteur, puis recharger : il ne revient pas, et ses images sont là")
    print("  → Codex › Personnages › Le goliath › Sa fiche : son vestiaire, sans le casque")
    print("  → Les cavernes du nord : aucune section de vestiaire")
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
