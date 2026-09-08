# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B21 — la sortie**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8486 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel. Le dossier de jeu où l'on dépose
est lui aussi jetable — il est imprimé au lancement, et on peut le vider entre
deux essais.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b21.py

`sans-servir` en argument peuple, mesure et imprime le résumé sans lancer
uvicorn — c'est ce mode-là qui sert de banc : il rend les six mesures de la
tranche sur de vraies routes, pas sur des tableaux fabriqués à la main.

## Ce qu'il monte, et pourquoi ces sujets-là

**Le Marais du Vieux Moulin**, deux directions déclarées — *est* et *ouest* —,
et quatre sujets qui ne sont pas dans le même état :

| Le sujet | Ce qu'il porte | Ce qu'on vient voir |
|---|---|---|
| **Le pèlerin** | deux poses remplies, un casque posé | le cas normal : des corps, des calques |
| **La sorcière du marais** | une pose remplie | qu'un nom à accents et à espaces sorte lisible |
| **Le passeur** | rien | *ce qui n'est pas prêt* : un sujet sans image |
| **Le tonneau** (objet) | une pose remplie | que le rangement *en dossiers* sépare les familles |

Plus **une animation gardée** — trois fichiers, dont le format Aseprite — et
**une animation vide**, qui doit être nommée dans le panneau et ne pas sortir.

**Rien n'a été payé** : les images arrivent par le double de fournisseur des
essais, jamais par un appel réel. Le script marche réseau coupé.

## Ce qu'on vient voir à l'écran

1. **Le carnet › La sortie**, au-dessus du trait, sous *Les dépenses*. C'est le
   seul écran de la V4 d'où les fichiers du jeu s'en vont.
2. **La colonne du milieu, avant de cliquer.** L'arbre porte les vrais noms,
   avec `-est` et `-ouest` dans chacun : c'est la réparation du piège le plus
   cher du sujet — l'export d'avant n'emportait qu'une image par pose sans dire
   laquelle. Tout est *nouveau*, le bouton porte le compte et le poids.
3. **Cliquer *Sortir*.** Le compte rendu paraît, puis l'arbre se recharge : tout
   doit s'y lire *inchangé*, sauf le descriptif, qui porte l'instant de la
   sortie et se réécrit donc à chaque fois.
4. **Changer un réglage** — *en dossiers*, puis *Godot*. Rien ne s'écrit tant
   qu'on ne clique pas : c'est le point de l'écran, et le dossier jetable est
   imprimé plus bas pour qu'on puisse le vérifier à l'œil.
5. **La colonne de droite** : *Le passeur* y est nommé sans image, l'animation
   vide aussi, et les sujets à une seule direction également — le jeu en déclare
   deux.
6. **Tout en bas à droite** : la date de la sortie précédente, la seule chose
   qu'il fallait ajouter pour que la colonne du milieu soit possible.
"""

from __future__ import annotations

import io
import json
import sys
import tempfile
import time
from pathlib import Path

import uvicorn
from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine import sortie as vocabulaire  # noqa: E402
from atelier.domaine.bande import Bande, Cadre, Prise  # noqa: E402
from atelier.services import Atelier  # noqa: E402

# Le double des essais, **importé et pas recopié** — même raison qu'en B9/B17 :
# deux doubles qui divergeraient finiraient par ne plus décrire le produit.
from conftest import AnimateurMuet, FournisseurDouble, image_sujet  # noqa: E402

PORT = 8486

# La case d'une animation, et le nombre d'images. Assez petites pour que la
# planche se fabrique en un clin d'œil, assez grandes pour se regarder.
CASE = 32
IMAGES = 6


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _planche(images: int = IMAGES) -> bytes:
    """Une rangée de cases, chacune d'une teinte différente.

    **Chaque case se distingue à l'œil** : c'est ce qui permet de vérifier, dans
    le PNG animé, que l'ordre est celui du descriptif — et non l'inverse.
    """
    planche = Image.new("RGBA", (CASE * images, CASE), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(planche)
    for rang in range(images):
        teinte = 60 + rang * 30
        dessin.rectangle(
            [rang * CASE + 4, 4, rang * CASE + CASE - 5, CASE - 5],
            fill=(190, teinte, 40, 255),
        )
    tampon = io.BytesIO()
    planche.save(tampon, format="PNG")
    return tampon.getvalue()


def _bande(atelier: Atelier, nom: str, personnage: str, pose: str) -> Bande:
    """Une animation gardée, **avec sa planche déjà sur le disque**.

    Poser le cache est ce qui dispense du décodeur vidéo : le montage relit le
    fichier au lieu d'aller redécouper un clip qu'on n'a pas payé. Un vrai
    montage laisse exactement cet état-là derrière lui.
    """
    identifiant = f"bande-b21-{nom}"
    bande = Bande(
        identifiant=identifiant,
        clip="clip-b21",
        nom=nom,
        prises=tuple(Prise(numero=n) for n in range(IMAGES)),
        cadence=8.0,
        cadre=Cadre(gauche=0, sommet=0, droite=CASE - 1, bas=CASE - 1),
        projet=atelier.bibliotheque.courant,
        personnage=personnage,
        pose=pose,
        case_largeur=CASE,
        case_hauteur=CASE,
    )
    bande.planche = atelier.fichiers.ecrire_planche_de_bande(
        "clip-b21", identifiant, _planche()
    )
    atelier.base.enregistrer_bande(bande)
    return bande


def _bande_vide(atelier: Atelier) -> Bande:
    """Une bande gardée dont les images ont été retirées.

    Elle ne peut pas faire de planche de sprites — c'est le sujet de l'alerte,
    et c'est aussi la panne qu'elle évite : demandée dans un lot, elle
    l'arrêterait au milieu.
    """
    bande = Bande(
        identifiant="bande-b21-vide",
        clip="clip-b21",
        nom="la course",
        prises=(),
        projet=atelier.bibliotheque.courant,
    )
    atelier.base.enregistrer_bande(bande)
    return bande


def _sujet(client, nom: str, poses: int, famille: str = "") -> tuple[str, list[str]]:
    """Un sujet du jeu, et **les `poses` premières qu'il tient lui-même**.

    ⚠️ **Les siennes, jamais celles du plan du jeu.** Une chose créée dans les
    objets prend le type de sa famille, et ce type porte ses propres attitudes
    (`E9`) : lui imposer les poses du plan lui demande une pose qu'elle ne tient
    pas, et la génération est refusée — ce qui est juste, et ce que ce script a
    découvert en la lui demandant.
    """
    charge: dict = {"nom": nom, "description": ""}
    if famille:
        charge["famille"] = famille
    personnage = _exiger(
        client.post("/api/characters", json=charge), f"la création de « {nom} »"
    )["personnage"]["identifiant"]

    tableau = _exiger(client.get("/api/characters"), "le codex du jeu")
    sien = next(
        (p for p in tableau["personnages"] if p["identifiant"] == personnage), None
    )
    tenues = [c["pose"] for c in (sien or {}).get("cases", [])][:poses]
    return personnage, tenues


def _remplir(client, double, personnage: str, poses: list[str]) -> None:
    """Une image de corps par pose, née dans l'atelier — et nulle part ailleurs."""
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    for pose in poses:
        depart = _exiger(
            client.post(
                "/api/generations",
                json={
                    "modele": "essai:rend-du-png",
                    "prompt": f"le sujet, {pose}",
                    "personnage": personnage,
                    "pose": pose,
                },
            ),
            f"la génération de « {pose} »",
        )
        for _ in range(200):
            etat = _exiger(
                client.get(f"/api/generations/{depart['identifiant']}"), "l'attente"
            )
            if etat["statut"] in ("reussie", "echouee", "interrompue"):
                break
            client.get("/api/status")
    double.rendre = None


def peupler(atelier: Atelier, double: FournisseurDouble) -> dict:
    with TestClient(creer_application(atelier)) as client:
        _exiger(
            client.post("/api/projects", json={"nom": "Le Marais du Vieux Moulin"}),
            "le projet",
        )
        # **Deux directions déclarées**, et c'est ce qui rend l'écran
        # intéressant : le nom d'un fichier les porte enfin.
        for angle in ("est", "ouest"):
            _exiger(
                client.post("/api/characters/directions", json={"nom": angle}),
                f"la direction « {angle} »",
            )

        pelerin, poses = _sujet(client, "Le pèlerin", 2)
        _remplir(client, double, pelerin, poses)

        sorciere, siennes = _sujet(client, "La sorcière du marais", 1)
        _remplir(client, double, sorciere, siennes)

        # Le sujet qui n'a rien : c'est lui qu'on vient voir à droite.
        passeur, _ = _sujet(client, "Le passeur", 1)

        tonneau, ses_poses = _sujet(client, "Le tonneau", 1, famille="objets")
        _remplir(client, double, tonneau, ses_poses)

        _bande(atelier, "la marche", pelerin, poses[0] if poses else "")
        _bande_vide(atelier)

        return {
            "pelerin": pelerin,
            "sorciere": sorciere,
            "passeur": passeur,
            "tonneau": tonneau,
        }


def _prevoir(client, dossier: Path, **reglage) -> dict:
    return _exiger(
        client.post("/api/output/preview", json={"dossier": str(dossier), **reglage}),
        "l'aperçu",
    )


def _sortir(client, dossier: Path, **reglage) -> dict:
    return _exiger(
        client.post("/api/output", json={"dossier": str(dossier), **reglage}),
        "la sortie",
    )


def _contenu(dossier: Path) -> set[str]:
    if not dossier.is_dir():
        return set()
    return {
        c.relative_to(dossier).as_posix() for c in dossier.rglob("*") if c.is_file()
    }


def principal(sans_servir: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents et des
    # flèches — le même geste que `essais/essai_jetons.py`.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b21-"))
    jeu = Path(tempfile.mkdtemp(prefix="jeu-b21-")) / "assets"
    print(f"Dossier jetable de l'atelier : {dossier}")
    print(f"Dossier de jeu où l'on dépose : {jeu}")

    # **Le double des essais, et pas un vrai fournisseur** : cet atelier-ci
    # fabrique de vraies images sans clé, sans réseau et sans facture. C'est ce
    # qui permet de le lancer autant de fois qu'on veut.
    double = FournisseurDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    depart = time.perf_counter()
    peupler(atelier, double)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s  ·  4 sujets  ·  2 directions  ·  2 animations")
    print()
    print("  Les six mesures de la tranche, sur de vraies routes :")

    with TestClient(creer_application(atelier)) as client:
        # 1. L'arbre se lit avant d'écrire.
        avant = _contenu(jeu)
        apercu = _prevoir(client, jeu)
        apres = _contenu(jeu)
        print(
            f"    1. prévoir sans écrire — {apercu['compte']} fichiers, "
            f"{apercu['octets']} octets annoncés  ·  "
            f"le dossier contenait {len(avant)} fichiers, il en contient "
            f"{len(apres)}  ·  "
            f"{'RIEN ÉCRIT' if avant == apres else 'DES FICHIERS ONT ÉTÉ ÉCRITS'}"
        )

        # 2. Nouveau, remplacé, inchangé — au second passage.
        premiers = {f["marque"] for f in apercu["fichiers"]}
        bilan = _sortir(client, jeu)
        second = _prevoir(client, jeu)
        marques = {}
        for fichier in second["fichiers"]:
            marques[fichier["marque"]] = marques.get(fichier["marque"], 0) + 1
        print(
            f"    2. marques — 1er passage : {', '.join(sorted(premiers))}  →  "
            f"2e passage : {', '.join(f'{n} {m}' for m, n in sorted(marques.items()))}"
        )
        print(
            "       (le descriptif porte l'instant de la sortie : il se réécrit "
            "à chaque fois, et se dit donc « remplace »)"
        )

        # 3. Les quatre modes de collision.
        reglages = _exiger(client.get("/api/output/settings"), "les réglages")
        numerote = Path(tempfile.mkdtemp(prefix="jeu-b21-numerote-")) / "assets"
        _sortir(client, numerote, collision=vocabulaire.NUMEROTER)
        _sortir(client, numerote, collision=vocabulaire.NUMEROTER)
        doubles = sorted(c for c in _contenu(numerote) if "-2." in c)
        arret = client.post(
            "/api/output",
            json={"dossier": str(jeu), "collision": vocabulaire.ARRETER},
        )
        print(
            f"    3. collisions — {', '.join(reglages['collisions'])}  ·  "
            f"remplacer laisse {len([c for c in _contenu(jeu) if c.endswith('.png')])} "
            f"images après 2 sorties  ·  numéroter en laisse "
            f"{len([c for c in _contenu(numerote) if c.endswith('.png')])} "
            f"(dont {len(doubles)} numérotées)  ·  "
            f"s'arrêter répond {arret.status_code}"
        )

        # 4. Ce qui n'est pas prêt.
        print("    4. ce qui n'est pas prêt :")
        for alerte in second["pas_prets"]:
            noms = ", ".join(s["nom"] for s in alerte["sujets"][:3])
            print(f"       · {alerte['genre']:<20} {alerte['compte']:>2}  —  {noms}")
        if not second["pas_prets"]:
            print("       (aucune — ce qui serait un défaut du montage)")

        # 5. Gratuit, réseau coupé.
        appels = double.appels
        _prevoir(client, jeu)
        _sortir(client, jeu)
        print(
            f"    5. gratuit — appels au fournisseur pendant un aperçu et une "
            f"sortie : {double.appels - appels}  ·  coût : $0.000"
        )

        # 6. Le format Aseprite, clé pour clé.
        accompagnement = jeu / "la-marche.json"
        if accompagnement.is_file():
            ecrit = json.loads(accompagnement.read_text(encoding="utf-8"))
            print(
                f"    6. Aseprite — clés à la racine : {sorted(ecrit)}  ·  "
                f"clés de `meta` : {sorted(ecrit['meta'])}"
            )
            print(
                "       (aucune de notre cru : ce qui appartient à l'atelier "
                "est dans descriptif.json, à côté)"
            )
        else:
            print("    6. Aseprite — AUCUNE ANIMATION N'EST SORTIE (défaut du montage)")

        # Et le catalogue du moteur, la troisième chose qui n'existait nulle part.
        godot = Path(tempfile.mkdtemp(prefix="jeu-b21-godot-")) / "assets"
        rendu = _sortir(client, godot, moteur=vocabulaire.GODOT,
                        rangement=vocabulaire.EN_DOSSIERS)
        print()
        print(
            f"  Le catalogue du moteur : {Path(rendu['catalogue']).name or '—'}  ·  "
            f"rangé en dossiers : "
            f"{sorted({c.split('/')[0] for c in _contenu(godot) if '/' in c})}"
        )
        print(f"  La sortie précédente : {second['precedente']['compte']} fichiers, "
              f"{second['precedente']['octets']} octets")
        print(f"  Le bilan du premier passage : {bilan['compte']} écrits, "
              f"{bilan['inchanges']} inchangés")

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Le carnet › La sortie (au-dessus du trait, sous « Les dépenses »)")
    print("    · l'arbre se lit AVANT de cliquer, et les noms portent -est / -ouest")
    print("    · cliquer « Sortir », puis regarder : tout repasse « inchangé »")
    print("    · changer un réglage n'écrit rien — comparer le dossier de jeu")
    print("    · à droite : « Le passeur » sans image, « la course » sans images")
    print(f"  Le dossier de jeu à surveiller : {jeu}")
    print("  Ctrl-C pour arrêter. Les dossiers jetables peuvent être effacés après.")
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
