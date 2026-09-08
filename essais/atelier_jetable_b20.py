# -*- coding: utf-8 -*-
"""L'atelier jetable de `B20` — **un personnage équipé qui bouge vraiment**.

    cd interface && npm run build   # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b20.py
    # puis http://127.0.0.1:8485/

`sans-servir` en argument monte le décor, imprime le résumé et rend la main sans
lancer `uvicorn` — de quoi vérifier le peuplement sans occuper le port.

**Ce qu'il monte, et pourquoi.** La tranche a deux critères qui ne se mesurent
pas sur un décor complet : *une case sans animation du personnage reste vide
sans compter comme un manque*, et *un calage gardé à la main se réutilise sur la
pièce suivante*. Le décor est donc **volontairement troué** — six poses au plan,
des animations sur deux d'entre elles seulement, et un calque sur une troisième
qui n'en a aucune.

| Ce qui est monté | Pourquoi |
|---|---|
| Un clip **où le corps se déplace d'image en image** | c'est la seule forme sur laquelle *tient* et *glisse* ne rendent pas la même chose ; un sujet immobile ferait tout passer sans rien montrer |
| `Le goliath` sur le plan par défaut — **six poses**, un jeu **à quatre directions** | la matrice fait alors vingt-quatre rangées, très exactement les « vingt-quatre calques » de la planche — sauf que six seulement comptent, et qu'un seul calque par pose les sert |
| `Epée`, avec un calque sur `repos` et sur `marche` | la pièce qui s'habille |
| Des bandes sur `repos` (les 4 directions) et `marche` (2 seulement) | les cases *à habiller* et les cases *sans animation*, côte à côte sur la même pose |
| Un calque d'épée sur `attaque`, **sans aucune animation d'attaque** | le cas exact du critère : un calque prêt, rien à habiller, et **ça ne compte pas** |
| `Casque de fer`, calque sur `repos`, **posé après** | la pièce suivante, celle qui doit hériter du calage gardé à la main |

**Ce qu'on vient voir à l'écran** :

1. Carnet › *Les équipements* › `Epée` › l'emploi porté par le goliath : le
   bouton **« Ses animations, image par image »**.
2. La matrice : **une rangée par pose et par direction**, ce que la page de
   l'emploi refuse — et c'est légitime, parce qu'ici on range des bandes.
3. La ligne `Attaque` dit *rien à habiller* et **n'offre aucun bouton** ; le
   compteur la range à part, dans « sans animation », jamais dans le manque.
   Le décor en porte dix-huit : six sur vingt-quatre rangées seulement comptent.
4. Poser le calque sur `Repos · sud` : la ligne passe à **« le calque tient »**
   et annonce ses calculs. Aucun centime, aucun appel — le bandeau des dépenses
   ne bouge pas.
5. *Le faire glisser* : la ligne passe à **« le calque glisse »**, et le détail
   change de phrase.
6. Le calage gardé : le résumé ci-dessous le pose à la main sur l'épée, puis
   habille le casque **sur la même animation** — et le casque part des mêmes
   trois nombres au lieu de zéro.

⚠️ **Ce qu'il ne faut pas faire** : le lancer sur `donnees/`. Il écrit dans un
dossier temporaire et pose des calques à la main — le faire sur l'atelier de
l'auteur y ajouterait des images qu'il n'a pas demandées.
"""

from __future__ import annotations

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

from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine.animation import Clip  # noqa: E402
from atelier.domaine.bande import Bande, Cadre, Prise  # noqa: E402
from atelier.domaine.generation import Generation  # noqa: E402
from atelier.domaine.recette import Recette  # noqa: E402
from atelier.services import Atelier  # noqa: E402

PORT = 8485
COTE = 64
IMAGES = 8

# Les poses qu'on vise à la main pour que le décor soit lisible. Le plan par
# défaut du jeu en porte six ; `attaque` est celle du critère — elle aura son
# calque d'épée et **aucune animation**.
POSES = ("repos", "marche", "attaque")


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _images_du_clip() -> list[np.ndarray]:
    """Un corps qui **descend d'image en image**, et c'est tout l'intérêt.

    Un calque calé une seule fois tombe juste sur la première image et de plus
    en plus à côté ensuite. C'est ce qui rend « le calque glisse » visible à
    l'œil, et sans quoi les deux tenues se ressembleraient à l'écran.
    """
    suite = []
    for numero in range(IMAGES):
        image = np.zeros((COTE, COTE, 4), dtype="uint8")
        haut = 8 + numero * 3
        image[haut : haut + 30, 20:44] = (48, 44, 40, 255)
        # Un bras qui se tend : le sujet n'occupe pas la même largeur d'une
        # image à l'autre, ce qui donne au recalage quelque chose à trouver.
        image[haut + 8 : haut + 14, 44 : 44 + numero * 2] = (48, 44, 40, 255)
        suite.append(image)
    return suite


def _clip(atelier, identifiant: str = "clip-du-goliath") -> str:
    """Un clip payé, posé sur le disque **sans passer par une vidéo**.

    Le décodeur a ses essais ; ici il coûterait une dépendance et ne montrerait
    rien de plus. Ce que le montage demande d'un clip est exactement deux
    choses : une génération qui se dit clip, et des PNG numérotés à côté.
    """
    atelier.base.enregistrer(
        Generation(
            identifiant=identifiant,
            modele="modele-video-jetable",
            demande={},
            parametres_resolus={},
            projet=atelier.bibliotheque.courant,
            clip=Clip(travail="jetable-1", images=IMAGES, cadence=8.0),
        )
    )
    dossier = atelier.fichiers.dossier_images_clip(identifiant, 0)
    for numero, image in enumerate(_images_du_clip()):
        Image.fromarray(image, mode="RGBA").save(dossier / f"{numero:04d}.png")
    return identifiant


def _calque(atelier, client, dossier: Path, *, personnage, piece, pose, rang):
    """Un calque tel que le dépliage d'une planche d'équipement l'aurait laissé.

    Posé à la main, comme `tests/test_b20.py` et `essais/atelier_jetable_b19.py`
    le font : ce qu'on vient voir est ce que le **recalage** en fait, pas la
    façon dont le calque est né. Payer une planche pour monter un décor n'aurait
    rien montré de plus.
    """
    fichier = dossier / f"{personnage}-{piece}-{pose}.png"
    image = np.zeros((COTE, COTE, 4), dtype="uint8")
    image[8:34, 20:44] = (48, 44, 40, 255)
    # Un pixel à lui : l'import écarte deux fichiers de mêmes octets, et deux
    # calques identiques n'en feraient qu'un.
    image[0, rang % COTE] = (200, 60, 40, 255)
    Image.fromarray(image, mode="RGBA").save(fichier)

    importe = _exiger(
        client.post(
            "/api/assets/import", json={"chemin": str(fichier), "forcer": True}
        ),
        f"l'import du calque « {piece} · {pose} »",
    )["asset"]
    objet = atelier.assets.lire(importe["identifiant"])
    objet.personnage = personnage
    objet.pose = pose
    objet.piece = piece
    objet.label = f"{piece} · {pose}"
    atelier.assets.sauver(objet)
    return objet.identifiant


def _bande(atelier, clip: str, *, personnage, pose, direction, rang) -> Bande:
    """Une animation gardée, telle qu'un montage l'aurait laissée."""
    bande = Bande(
        identifiant=f"bande-{pose}-{direction}-{rang}",
        clip=clip,
        nom=f"{pose} vers {direction}",
        prises=tuple(Prise(numero=n) for n in range(IMAGES)),
        cadence=8.0,
        cadre=Cadre(),
        recette=Recette(),
        projet=atelier.bibliotheque.courant,
        personnage=personnage,
        pose=pose,
        direction=direction,
    )
    atelier.base.enregistrer_bande(bande)
    return bande


def peupler(atelier, dossier: Path) -> dict:
    from fastapi.testclient import TestClient

    client = TestClient(creer_application(atelier))

    _exiger(
        client.post("/api/projects", json={"nom": "Le Marais du Vieux Moulin"}),
        "la création du jeu",
    )
    # Quatre directions : c'est ce qui fait de la matrice une grille, et qui
    # permet de voir que les quatre lisent le même calque.
    _exiger(
        client.put("/api/universe", json={"vue": "vue-dessus-34"}),
        "le choix de la vue du jeu",
    )

    clip = _clip(atelier)
    goliath = _exiger(
        client.post("/api/characters", json={"nom": "Le goliath"}),
        "la création du goliath",
    )["personnage"]

    # `viser` crée la case à la demande ; les poser ici rend le décor lisible
    # dans le résumé, et surtout garantit qu'`attaque` existe **sans animation**.
    for pose in POSES:
        atelier.production.viser(atelier.bibliotheque.courant, goliath["identifiant"], pose)

    # **Les deux pièces naissent portées par le goliath**, et il le fallait :
    # une pièce nommée hors d'une fiche naît *déclarée vide* depuis `B19`, et
    # une pièce déclarée ne consulte plus ses calques. Sans porteur ici, le
    # carnet dirait « aucun emploi » et l'écran de la tranche n'aurait aucune
    # porte d'entrée — alors que ses calques, eux, seraient bien là.
    epee = _exiger(
        client.post(
            "/api/characters/pieces",
            json={"nom": "Epée", "porteur": goliath["identifiant"]},
        ),
        "la création de l'épée",
    )["piece"]
    casque = _exiger(
        client.post(
            "/api/characters/pieces",
            json={"nom": "Casque de fer", "porteur": goliath["identifiant"]},
        ),
        "la création du casque",
    )["piece"]

    rang = 0
    calques = {}
    # L'épée a trois calques ; le troisième — `attaque` — est celui du critère :
    # il est prêt, et le goliath n'a aucune animation d'attaque à habiller.
    for pose in ("repos", "marche", "attaque"):
        rang += 1
        calques[("epee", pose)] = _calque(
            atelier,
            client,
            dossier,
            personnage=goliath["identifiant"],
            piece=epee["identifiant"],
            pose=pose,
            rang=rang,
        )
    rang += 1
    calques[("casque", "repos")] = _calque(
        atelier,
        client,
        dossier,
        personnage=goliath["identifiant"],
        piece=casque["identifiant"],
        pose="repos",
        rang=rang,
    )

    # Les animations : quatre directions au repos, deux seulement en marche,
    # aucune en attaque ni en mort. C'est le trou volontaire du décor.
    bandes = []
    for direction in ("sud", "nord", "est", "ouest"):
        bandes.append(
            _bande(
                atelier,
                clip,
                personnage=goliath["identifiant"],
                pose="repos",
                direction=direction,
                rang=len(bandes),
            )
        )
    for direction in ("sud", "est"):
        bandes.append(
            _bande(
                atelier,
                clip,
                personnage=goliath["identifiant"],
                pose="marche",
                direction=direction,
                rang=len(bandes),
            )
        )

    return {
        "client": client,
        "clip": clip,
        "goliath": goliath,
        "epee": epee,
        "casque": casque,
        "calques": calques,
        "bandes": bandes,
    }


def _mesurer(atelier, monte: dict) -> dict:
    """**Les quatre critères, joués une fois avant de servir.**

    Un atelier jetable qui se contenterait d'ouvrir un port laisserait l'auteur
    découvrir seul si le décor tient. Celui-ci joue les gestes, imprime les
    nombres, et dit à chaque fois si c'est ce qu'on attendait.
    """
    projet = atelier.bibliotheque.courant
    epee = monte["epee"]["identifiant"]
    casque = monte["casque"]["identifiant"]
    goliath = monte["goliath"]["identifiant"]

    matrice = atelier.calques_animes.matrice(projet, epee, goliath)
    # **Compté avant les gestes, et recompté après.** C'est la seule façon
    # honnête de montrer que le recalage ne dépense pas : une génération est ce
    # qui part chez un fournisseur, et le décor en porte déjà — le clip, et un
    # import par calque. Ce qui se mesure est l'écart, jamais le total.
    avant = len(atelier.base.generations_du_projet(projet))

    # Le repos, vers le sud — la case qu'on habille.
    au_repos = next(
        r
        for r in matrice["rangees"]
        if r["pose"] == "repos" and r["direction"] == "sud"
    )
    tient = atelier.calques_animes.habiller(au_repos["bande"], epee, "tient")
    glisse_sur = next(
        r
        for r in matrice["rangees"]
        if r["pose"] == "repos" and r["direction"] == "nord"
    )
    glisse = atelier.calques_animes.habiller(glisse_sur["bande"], epee, "glisse")

    # Le calage à la main, puis la pièce suivante sur la **même** animation.
    cale = atelier.calques_animes.caler_a_la_main(
        tient["identifiant"], echelle=1.15, dx=5, dy=-4
    )
    suivante = atelier.calques_animes.habiller(au_repos["bande"], casque, "tient")

    apres = atelier.calques_animes.matrice(projet, epee, goliath)
    return {
        "matrice": matrice,
        "apres": apres,
        "generations_avant": avant,
        "generations_apres": len(atelier.base.generations_du_projet(projet)),
        "tient": tient,
        "glisse": glisse,
        "cale": cale,
        "suivante": suivante,
    }


def principal(sans_servir: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents et des
    # flèches — le même geste que `essais/essai_jetons.py`.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b20-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)

    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    mesure = _mesurer(atelier, monte)
    duree = time.perf_counter() - depart

    matrice, apres = mesure["matrice"], mesure["apres"]

    print()
    print(f"  Montage et mesures : {duree:.1f} s")
    print()
    print("  La matrice de l'épée sur le goliath, case par case :")
    for r in matrice["rangees"]:
        ou = f"{r['pose_nom']} · {r['direction_nom'] or 'sans direction'}"
        print(f"    · {ou:<24} {r['etat']:<15} {r['mot']}")

    print()
    print(
        f"    → {matrice['fait']} sur {matrice['attendu']} comptées, "
        f"et {matrice['sans_animation']} case(s) sans animation **qui ne comptent pas**"
    )
    sans = [r for r in matrice["rangees"] if r["etat"] == "sans-animation"]
    attaque = [r for r in sans if r["pose"] == "attaque"]
    verdict = (
        "oui — le calque est prêt, il n'y a rien à habiller, et ça ne compte pas"
        if attaque and matrice["attendu"] == len(matrice["rangees"]) - len(sans)
        else "NON — le décor ou le compte est faux"
    )
    print(f"    → « Attaque » a son calque et aucune animation : {verdict}")

    print()
    print("  Les deux façons de suivre, sur la même pièce et le même corps :")
    for nom, bande in (("tient ", mesure["tient"]), ("glisse", mesure["glisse"])):
        hauteurs = sorted({c["dy"] for c in bande["calages"]})
        print(
            f"    · le calque {nom} : {len(bande['calages'])} calage(s), "
            f"{len(hauteurs)} hauteur(s) distincte(s) — {hauteurs[:6]}"
        )
    distinctes = len({c["dy"] for c in mesure["tient"]["calages"]})
    verdict = (
        "oui — les deux ne rendent pas la même chose"
        if distinctes > 1 and len({c["dy"] for c in mesure["glisse"]["calages"]}) == 1
        else "NON — les deux tenues se ressemblent, le décor ne mesure rien"
    )
    print(f"    → la distinction se voit : {verdict}")

    print()
    print("  Le calage gardé à la main, et la pièce suivante :")
    main = mesure["cale"]["habillage"]["main"]
    reprise = mesure["suivante"]["habillage"]["main"]
    print(
        f"    · posé sur l'épée      : échelle {main['echelle']}, "
        f"dx {main['dx']}, dy {main['dy']}"
    )
    print(
        f"    · repris par le casque : "
        + (
            f"échelle {reprise['echelle']}, dx {reprise['dx']}, dy {reprise['dy']}"
            if reprise
            else "RIEN — il est reparti de zéro"
        )
    )
    verdict = (
        "oui — la pièce suivante part des mêmes nombres"
        if reprise
        and (reprise["echelle"], reprise["dx"], reprise["dy"])
        == (main["echelle"], main["dx"], main["dy"])
        else "NON — le calage ne s'est pas réutilisé"
    )
    print(f"    → {verdict}")

    print()
    ecart = mesure["generations_apres"] - mesure["generations_avant"]
    print(
        f"  Générations du jeu : {mesure['generations_avant']} avant les quatre "
        f"habillages, {mesure['generations_apres']} après — écart : {ecart}."
    )
    print(
        "    → "
        + (
            "aucune n'a été créée ; le recalage tourne sur la machine, et le "
            "service ne tient aucun fournisseur"
            if ecart == 0
            else "NON — quelque chose est parti chez un fournisseur"
        )
    )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Carnet › Les équipements › « Epée » › l'emploi porté par Le goliath")
    print("  → « Ses animations, image par image › » — le bouton de la tranche")
    print(
        "  → la matrice : une rangée par pose ET par direction "
        f"({len(matrice['rangees'])} ici, dont {matrice['attendu']} qui comptent)"
    )
    print("  → « Attaque » : « rien à habiller », aucun bouton, et hors du compte")
    print("  → « Poser le calque » sur une ligne libre : elle passe à « le calque tient »")
    print("  → « le faire glisser » : la phrase change, et le calcul avec")
    print("  → Repos · sud porte déjà « posé à la main » ; « Casque de fer » l'a repris")
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
    raise SystemExit(principal(sans_servir="sans-servir" in sys.argv[1:]))
