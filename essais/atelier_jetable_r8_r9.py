# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier R8 et R9 au navigateur, sans toucher à celui
de l'auteur.

**L'auteur travaille sur le port 8420 pendant la séance.** Cet atelier-ci vit sur
un dossier temporaire, sur le port 8422, avec le fournisseur double des essais :
rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui ne bouge
pas d'un pixel.

**Les deux tranches sur le même personnage, et c'est voulu** : la fiche et le
calibrage sont deux vues de la même chose, et les vérifier sur deux jeux de
données différents laisserait passer un désaccord entre elles.

**Pourquoi un atelier peuplé, alors que les essais d'écran passent.** Parce que la
moitié de ce que ces deux tranches livrent ne se mesure pas dans jsdom :

- le **portrait** en tête de fiche demande une vraie image, servie par une vraie
  adresse de vignette — un essai d'écran ne charge aucune image ;
- la **ligne du sommaire qui s'allume** suit le défilement par un
  `IntersectionObserver`, et jsdom ne met rien en page ;
- les **vignettes des images d'exemple** viennent du serveur : un double d'essai
  prouve que l'écran sait les rendre, jamais que le serveur les envoie ;
- l'**empilement d'après** du calibrage agrandit chaque silhouette du rapport
  entre ce qu'elle rend et ce qu'elle rendrait, autour de son ancrage. Un essai
  vérifie la chaîne `scale(...)` ; que le résultat se pose sur le sol et touche la
  ligne dorée ne se voit qu'à l'œil ;
- et la **place d'une case vide** à côté d'une case pleine est une mise en page.

Ce que le personnage monté ici porte, et pourquoi chaque morceau y est :

- **quatre poses sur six remplies, à quatre silhouettes différentes** — un debout,
  un aux bras tendus (large et bas), un accroupi, un couché. C'est le vrai défaut :
  quatre hauteurs rendues pour une seule recette, et de quoi donner au calibrage
  une hauteur commune, une pose qui limite et une pose à proposer à l'écart ;
- **une carte du tableau retenue comme exemple** — le cas de la vignette servie
  par une *carte* et non par un asset, le chemin le moins parcouru ;
- **une proposition de l'atelier**, qui vient du corps retenu de la première pose ;
- **une pose rangée** — pour que la matrice écrive ses rangées à côté du compte ;
- **un texte de style réécrit et un autre éteint** — pour voir le nom du champ
  dans le gris moyen, et non plus dans le plus sourd.

    py essais/atelier_jetable_r8_r9.py

Puis : Codex › Le pélerin › « sa fiche › », et Codex › Le pélerin › « le calibrage ›».
Ctrl-C l'arrête, et le dossier temporaire part avec lui.
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from atelier.services import Atelier  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble, image_sujet  # noqa: E402

PORT = 8422
MODELE = "essai:rend-du-png"
CIBLE = 64

#: **Le vrai défaut, à l'échelle.** Quatre poses, quatre boîtes : un debout, un
#: aux bras tendus — large et bas, celui qui limite —, un accroupi, un couché.
#: Ce sont ces quatre formes qui donnent au calibrage quelque chose à dire ; des
#: sujets identiques rendraient la même hauteur et l'écran dirait, à juste titre,
#: qu'il n'y a rien à faire.
SILHOUETTES = (
    ("repos", 190, 340),
    ("marche", 230, 330),
    ("attaque", 360, 300),
    ("mort", 340, 150),
)


def _corps(largeur: int, hauteur: int, rang: int, toile: int = 512) -> bytes:
    """Un sujet **déjà détouré**, dont la boîte opaque est exactement celle qu'on
    demande. La teinte suit le rang : deux poses ne doivent jamais être le même
    fichier, la bibliothèque refusant un doublon à juste titre."""
    image = Image.new("RGBA", (toile, toile), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    x0, y0 = (toile - largeur) // 2, (toile - hauteur) // 2
    dessin.rectangle(
        [x0, y0, x0 + largeur - 1, y0 + hauteur - 1],
        fill=(40 + rang * 47 % 200, 90 + rang * 23 % 120, 140, 255),
    )
    # Une tête, pour qu'une silhouette de 26 px se distingue d'un rectangle.
    dessin.ellipse(
        [x0 + largeur // 3, y0, x0 + 2 * largeur // 3, y0 + hauteur // 5],
        fill=(230, 210, 170, 255),
    )
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _attendre(client, identifiant: str) -> None:
    for _ in range(600):
        if client.get(f"/api/generations/{identifiant}").json()["statut"] != "en_cours":
            return
        time.sleep(0.01)
    raise SystemExit(f"« {identifiant} » n'est jamais arrivée à terme")


def peupler(atelier, double) -> None:
    """Un personnage à moitié fait, par les vraies routes HTTP.

    **Par les routes et pas par les services**, comme l'atelier jetable de D2 :
    ce qu'on vérifie ensuite à l'écran passe par elles, et un atelier peuplé
    autrement ne prouverait rien de ce que l'écran recevra.

    **Sur une application à part de celle qu'on sert ensuite** : le serveur MCP
    embarqué refuse d'ouvrir son cycle de vie deux fois sur la même instance. Deux
    applications sur **le même atelier**, donc sur le même dossier.
    """
    with TestClient(creer_application(atelier)) as client:
        regle = client.put("/api/universe", json={"cible_px": CIBLE})
        assert regle.status_code == 200, regle.text

        chose = client.post("/api/characters", json={"nom": "Le pélerin"})
        assert chose.status_code == 201, chose.text
        identifiant = chose.json()["personnage"]["identifiant"]

        plan = client.get("/api/characters").json()["plan"]
        connues = {p["nom"]: p["identifiant"] for p in plan}
        for rang, (nom, largeur, hauteur) in enumerate(SILHOUETTES):
            pose = connues.get(nom)
            if pose is None:
                print(f"  (le plan du jeu n'a pas de pose « {nom} »)")
                continue
            double.rendre = lambda l=largeur, h=hauteur, r=rang: _corps(l, h, r)
            lancee = client.post(
                "/api/generations",
                json={
                    "modele": MODELE,
                    "prompt": f"le pèlerin, {nom}",
                    "personnage": identifiant,
                    "pose": pose,
                },
            )
            assert lancee.status_code == 202, lancee.text
            _attendre(client, lancee.json()["identifiant"])

        # **Une carte du tableau, retenue comme image d'exemple.** C'est le
        # chemin le moins parcouru des deux : la vignette vient d'une carte, pas
        # d'un asset, et les deux sortes passent par la même réponse du serveur.
        carte = client.post(
            "/api/board/paste",
            params={"nom": "un dessin de depart.png", "forcer": True},
            content=image_sujet(toile=256, bloc=8),
        )
        assert carte.status_code == 201, carte.text
        carte = carte.json()["carte"]
        promue = client.put(
            f"/api/board/{carte['identifiant']}/official",
            json={"officiel": True, "famille": "tous"},
        )
        assert promue.status_code == 200, promue.text
        retenue = client.put(
            f"/api/characters/{identifiant}",
            json={"concept_arts": [carte["identifiant"]]},
        )
        assert retenue.status_code == 200, retenue.text

        # **Une pose rangée, un texte réécrit, un texte éteint.** Les trois
        # mécanismes que la fiche existe pour atteindre, et qui avaient zéro
        # emploi sur le vrai projet faute d'écran qui les touche. `poses` arrive
        # **en positif** : ranger une pose, c'est renvoyer toutes les autres.
        #
        # **On range une pose vide, jamais une des quatre remplies** : la couchée
        # est celle que le calibrage doit proposer d'écarter, et la ranger la
        # ferait disparaître de l'outil avant qu'on ait pu voir la proposition.
        remplies = {nom for nom, _, _ in SILHOUETTES}
        a_ranger = next(
            (p["identifiant"] for p in plan if p["nom"] not in remplies), ""
        )
        rangee = client.put(
            f"/api/characters/{identifiant}",
            json={
                "poses": [
                    p["identifiant"] for p in plan if p["identifiant"] != a_ranger
                ]
            },
        )
        assert rangee.status_code == 200, rangee.text
        ecrit = client.put(
            f"/api/characters/{identifiant}",
            json={
                "description": "un pèlerin voûté, la besace lourde",
                "textes": {"monde": "des marais de tourbe et des moulins morts"},
                "eteindre": "eclairage",
            },
        )
        assert ecrit.status_code == 200, ecrit.text

        _dire_ce_que_lecran_recevra(client, identifiant)


def _dire_ce_que_lecran_recevra(client, identifiant: str) -> None:
    """**Si la console le montre déjà, l'écran n'a plus qu'une chose à prouver :
    qu'il l'affiche.** C'est aussi le seul moyen de voir une réponse qu'un essai
    d'écran ne remonterait pas — un double rend ce qu'on lui a appris à rendre,
    jamais ce que le serveur envoie."""
    vue = client.get(f"/api/characters/{identifiant}/references").json()
    for ligne in vue["lignes"]:
        montre = ligne["montre"]
        print(
            f"  retenue « {ligne['provenance']} » → "
            + (montre["sorte"] if montre else "RIEN À MONTRER")
        )
    for proposition in vue["propositions"]:
        montre = proposition["montre"]
        print(
            f"  proposée « {proposition['provenance']} » → "
            + (montre["sorte"] if montre else "RIEN À MONTRER")
        )

    # **Il n'y a pas de route pour une chose seule** : le produit rend le côté
    # entier — le plan et toutes les choses —, parce qu'une colonne de cases
    # n'existe que par le plan qui la nomme.
    vive = next(
        p
        for p in client.get("/api/characters").json()["personnages"]
        if p["identifiant"] == identifiant
    )
    faites = sum(1 for c in vive["cases"] if c["images"])
    print(f"  {faites} case(s) faite(s) sur {len(vive['cases'])} tenue(s)")
    print(f"  poses rangées : {vive['ecartees'] or 'aucune'}")
    print(f"  textes écrits ici : {sorted(vive['textes'])} · éteints : {vive['eteints']}")

    cale = client.get(f"/api/characters/{identifiant}/calibration")
    assert cale.status_code == 200, cale.text
    cale = cale.json()
    print(
        f"  calibrage : hauteur commune {cale['commune']} px sur {cale['cible']}"
        f" · « {cale['limite']} » limite · {cale['perdus']} px perdus"
    )
    print(f"  {cale['a_faire']} pose(s) changeraient · propose d'écarter « {cale['de_cote']} »")
    for p in cale["poses"]:
        print(
            f"    {p['pose']:<10} {p['occupation']:>3} % → {p['visee']:>3} %"
            f"   {p['rendue']:>3} px → {p['apres']:>3} px"
        )


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-r8-r9-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    double.rendre = lambda: _corps(190, 340, 0)
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    peupler(atelier, double)

    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    print("Codex › Le pélerin › « sa fiche › »  puis  « le calibrage › »")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
