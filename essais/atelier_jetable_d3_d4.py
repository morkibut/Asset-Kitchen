# -*- coding: utf-8 -*-
"""Un atelier jetable pour voir D3 et D4 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Celui-ci vit sur un
dossier temporaire, sur le port 8424, avec le fournisseur double des essais :
rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui ne bouge
pas d'un pixel.

Il monte **deux projets**, et c'est tout le point : la proposition de fond a deux
réponses possibles, et n'en montrer qu'une ne prouverait pas que la seconde
existe.

- **« Le donjon »** a une palette de terres et de bruns. Le magenta en est très
  loin, donc l'atelier doit proposer *le magenta*, sûr, et l'écran de réglages
  doit le montrer sans jamais le poser tout seul.
- **« La fête foraine »** a une palette qui contient déjà du magenta, du cyan et
  du vert vif. Aucune couleur candidate n'y est sûre, et l'atelier doit **le
  dire** en nommant de quelle couleur du jeu il s'approchait — jamais choisir en
  silence.

Ce qu'il y a à cliquer, dans l'ordre :

1. **Réglages → « Références et couleurs » → le fond du jeu.** La couleur se
   pose, se retire, et la proposition se lit à côté. Changer de projet change la
   réponse.
2. **L'écran de confirmation** (le bouton qui montre ce qui va partir). Le fond
   y a sa propre section : on le corrige *pour cet appel seul*, on le remet à
   celui du jeu, ou on le retire. Deux textes doivent bouger ensemble — la
   phrase de calage et la phrase d'interdiction.
3. **La table « bords » d'une image.** Elle montre ce que le détourage a laissé :
   la couleur du fond retrouvée, les pixels de bord, la frange, et **ceux du
   sujet encore collés à la couleur du fond**. La dernière ligne est la mesure
   qui remplace le banc payant que l'auteur a retiré.
4. **La table « contours ».** L'unité du trait change de nom selon ce que
   l'image sait d'elle-même — px de l'image rendue, blocs de N px, ou px de
   l'image telle qu'elle est.
5. **La fiche d'un moteur de détourage** (réglages → le détourage par défaut).
   Chaque moteur dit maintenant à quelle taille il regarde et sous quelle
   licence il arrive.

Les trois images posées répondent à trois cas différents :

- *« le gardien »* est peint sur un **fond magenta franc** : la couleur du fond
  se relit dans la table, et rien du sujet n'y est resté collé — zéro, ce qui est
  la promesse entière de la tranche, montrée sur une image ;
- *« la sentinelle »* est peinte sur le **gris clair que les modèles rendent
  vraiment**, et porte du gris sur elle — un reflet et une ceinture. C'est le
  défaut d'avant la tranche : la mesure « encore collés au fond » y monte à 9 %,
  et sa ceinture est mangée à l'écran, visiblement ;
- *« l'ajouré »* a un vrai trou entre son bras et son torse, pour que la colonne
  qui a fait changer le moteur par défaut se voie sur une image.

**Les trois portent une frange de demi-teintes**, comme tout ce que rend un
modèle, et la table annonce pourtant *« aucun pixel à demi transparent »* : c'est
juste, et c'est le durcissement qui l'a faite. La ligne dit alors sur combien de
pixels de pourtour le bord est franc — un dénominateur sans lequel un compte de
frange ne veut rien dire.

    py essais/atelier_jetable_d3_d4.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

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

PORT = 8424
MODELE = "essai:rend-du-png"

#: Le magenta que `domaine/fond.py` propose en premier, et le gris clair que les
#: modèles rendent réellement quand on ne leur demande rien — relevé le 27 août
#: 2026 sur dix-sept images. Les deux sont ici parce que la tranche existe très
#: exactement pour remplacer le second par le premier.
MAGENTA = (255, 0, 255)
GRIS_DU_MODELE = (216, 217, 216)

#: Une palette de terres : rien qui approche le magenta, donc la proposition doit
#: être sûre.
DONJON = ((92, 64, 44), (146, 112, 74), (58, 52, 46), (176, 152, 108), (40, 60, 52))

#: Une palette de fête, **construite pour couvrir les six candidats** : chaque
#: couleur est posée à moins de 84 — l'écart minimal du domaine — de l'un d'eux,
#: la première en couvrant deux à elle seule (le magenta et le rose vif sont
#: voisins). Aucune n'est donc sûre, et c'est le seul moyen d'obtenir cette
#: réponse-là : une palette prise au hasard laisse presque toujours passer le
#: violet, qui est loin de tout ce qu'un jeu emploie d'ordinaire.
FORAINE = (
    (235, 30, 200),   # à 55 du magenta, à 56 du rose vif
    (50, 210, 210),   # à 50 du cyan
    (55, 215, 50),    # à 55 du vert pur
    (185, 55, 215),   # à 55 du violet
    (215, 150, 55),   # à 55 de l'orange vif
)


def _en_png(image: Image.Image) -> bytes:
    tampon = io.BytesIO()
    image.convert("RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def nuancier(couleurs: tuple[tuple[int, int, int], ...], cote: int = 240) -> bytes:
    """Une image d'aplats, à promouvoir en artwork pour fabriquer une palette.

    **Des aplats et non un dégradé** : la palette lit les couleurs dominantes, et
    un dégradé lui en donnerait cent voisines au lieu des cinq qu'on veut poser.
    """
    image = Image.new("RGB", (cote, cote), couleurs[0])
    dessin = ImageDraw.Draw(image)
    bande = cote // len(couleurs)
    for rang, couleur in enumerate(couleurs):
        dessin.rectangle([0, rang * bande, cote, (rang + 1) * bande], fill=couleur)
    return _en_png(image)


def _silhouette(cote: int, *, ajoure: bool) -> Image.Image:
    """Le masque du sujet : un corps, une tête, deux bras — et parfois un trou.

    Le trou est **entre le bras et le torse**, c'est-à-dire exactement ce que la
    colonne « ajouré » du banc compte. Un sujet plein ne séparerait aucun moteur.
    """
    masque = Image.new("L", (cote, cote), 0)
    dessin = ImageDraw.Draw(masque)
    m = cote / 16
    dessin.ellipse([6 * m, 2 * m, 10 * m, 6 * m], fill=255)          # la tête
    dessin.rectangle([6 * m, 6 * m, 10 * m, 13 * m], fill=255)       # le torse
    dessin.rectangle([6 * m, 13 * m, 7 * m, 15 * m], fill=255)       # les jambes
    dessin.rectangle([9 * m, 13 * m, 10 * m, 15 * m], fill=255)
    if ajoure:
        # Deux bras **écartés** du torse : le vide entre les deux est le détail
        # que le détourage doit garder, et c'est le seul de l'image.
        dessin.rectangle([4 * m, 7 * m, 5 * m, 12 * m], fill=255)
        dessin.rectangle([11 * m, 7 * m, 12 * m, 12 * m], fill=255)
        dessin.rectangle([5 * m, 7 * m, 6 * m, 8 * m], fill=255)
        dessin.rectangle([10 * m, 7 * m, 11 * m, 8 * m], fill=255)
    else:
        dessin.rectangle([4 * m, 7 * m, 12 * m, 9 * m], fill=255)    # les bras collés
    return masque


def sujet_sur_fond(
    fond: tuple[int, int, int],
    *,
    cote: int = 384,
    ajoure: bool = False,
    porte_le_fond: bool = False,
    frange: float = 1.6,
) -> bytes:
    """Un sujet posé sur un fond plat, avec une **frange de demi-teintes**.

    La frange n'est pas de la décoration : c'est ce que tous les modèles rendent
    vraiment, et c'est elle que les deux réparations de bord de D4 traitent. Un
    bord franc rendrait les mesures nulles et l'écran muet.

    `porte_le_fond` peint en plus une tache de la couleur du fond **sur** le
    sujet — le défaut que D3 explique : le remplissage depuis le bord ne
    l'atteint pas, mais elle reste comptée comme « encore collée au fond », et
    c'est la mesure qui dit qu'un fond a été mal choisi.
    """
    masque = _silhouette(cote, ajoure=ajoure).filter(ImageFilter.GaussianBlur(frange))
    corps = Image.new("RGB", (cote, cote), (74, 96, 132))
    dessin = ImageDraw.Draw(corps)
    m = cote / 16
    dessin.ellipse([6 * m, 2 * m, 10 * m, 6 * m], fill=(214, 176, 140))
    dessin.rectangle([6 * m, 9 * m, 10 * m, 13 * m], fill=(150, 62, 48))
    if porte_le_fond:
        dessin.ellipse([7 * m, 3 * m, 8 * m, 4 * m], fill=fond)      # un reflet
        dessin.rectangle([6 * m, 11 * m, 10 * m, 12 * m], fill=fond)  # une ceinture
    return _en_png(
        Image.composite(corps, Image.new("RGB", (cote, cote), fond), masque)
    )


def _attendre(client, identifiant: str) -> None:
    for _ in range(400):
        if client.get(f"/api/generations/{identifiant}").json()["statut"] != "en_cours":
            return
        time.sleep(0.01)


def monter_un_projet(
    client,
    *,
    nom: str,
    palette: tuple[tuple[int, int, int], ...],
    images: tuple[tuple[str, bytes], ...],
    double,
    fond: str = "",
) -> str:
    """Un projet peuplé **par les vraies routes HTTP**, palette comprise.

    Par les routes et pas par les services, pour la raison écrite dans
    `atelier_jetable_d2.py` : ce qu'on vérifie ensuite à l'écran passe par elles,
    et un atelier peuplé autrement ne prouverait rien de ce que l'écran recevra.
    """
    cree = client.post("/api/projects", json={"nom": nom})
    assert cree.status_code in (200, 201), cree.text
    identifiant = cree.json()["projet"]["identifiant"]
    client.put("/api/projects/current", json={"projet": identifiant})

    collee = client.post(
        "/api/board/paste",
        params={"nom": f"palette de {nom}", "projet": identifiant},
        content=nuancier(palette),
        headers={"Content-Type": "application/octet-stream"},
    )
    assert collee.status_code == 201, collee.text
    carte = collee.json()["carte"]["identifiant"]
    promue = client.put(
        f"/api/board/{carte}/official",
        json={"officiel": True, "famille": "tous", "projet": identifiant},
    )
    assert promue.status_code == 200, promue.text

    if fond:
        regle = client.put(
            "/api/universe", json={"fond": fond, "projet": identifiant}
        )
        assert regle.status_code == 200, regle.text

    for sujet, octets in images:
        double.rendre = lambda octets=octets: octets
        lancee = client.post(
            "/api/generations",
            json={"modele": MODELE, "prompt": sujet, "echelle": "personnage"},
        )
        assert lancee.status_code == 202, lancee.text
        _attendre(client, lancee.json()["identifiant"])

    return identifiant


def dire_ce_qu_on_verra(client, identifiant: str, nom: str) -> None:
    """Ce que l'écran montrera, écrit dans la console **avant** de l'ouvrir.

    Si la console montre déjà les deux réponses, le navigateur n'a plus qu'une
    chose à prouver : qu'il les affiche. C'est aussi le seul moyen de voir une
    mesure qu'un essai d'écran ne remonterait pas — un essai en `jsdom` ne
    dessine rien, et un serveur muet ne se distingue pas d'un écran vide.
    """
    print(f"\n── {nom} " + "─" * (58 - len(nom)))
    reponse = client.get("/api/universe", params={"projet": identifiant}).json()
    propose = reponse["fond_propose"]
    # **Une proposition est sûre quand elle n'a pas de raison de ne pas l'être** :
    # `raison` est le seul champ qui tranche, côté serveur comme à l'écran. Le
    # `sure` du domaine est une commodité Python et ne voyage pas en JSON.
    dit = (
        f"{propose['couleur']} ({propose['nom']}), écart {propose['ecart']}"
        if propose["raison"] is None
        else f"aucune sûre — {propose['raison']}"
    )
    print(f"  fond du jeu : {reponse['univers']['fond'] or '(aucun)'}")
    print(f"  proposition : {dit}")

    # **Le modèle et l'échelle sont obligatoires ici**, alors qu'ils ne changent
    # pas un caractère du texte : cette route-là est celle de l'écran qui montre
    # aussi le prix et les places d'images, et elle rend 404 sans modèle.
    reponse = client.post(
        "/api/outgoing",
        json={
            "prompt": "un gardien de pierre",
            "projet": identifiant,
            "modele": MODELE,
            "echelle": "personnage",
        },
    )
    assert reponse.status_code == 200, reponse.text
    fond = reponse.json()["fond"]
    print(f"  ce qui part  : fond={fond['couleur'] or '(aucun)'}")
    print(f"  interdiction : {fond['interdiction'] or '(aucune)'}")

    for asset in client.get("/api/assets", params={"projet": identifiant}).json()["assets"]:
        taches = client.get(f"/api/assets/{asset['identifiant']}/spots").json()
        f = taches["fond"]
        part = f["part_collee"]
        print(
            f"  « {asset['label']} » → fond {f['fond'] or '(aucun)'}, "
            f"bord {f['bord']}, frange {f['frange']}, "
            f"encore collés {f['colles']} ({part:.1%} du sujet)"
        )


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-d3-d4-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    )

    # Sur une application à part de celle qu'on sert ensuite : le serveur MCP
    # embarqué refuse d'ouvrir son cycle de vie deux fois sur la même instance
    # (`atelier_jetable_d2.py` porte le détail). Deux applications sur **le même
    # atelier**, donc sur le même dossier.
    with TestClient(creer_application(atelier)) as client:
        donjon = monter_un_projet(
            client,
            nom="Le donjon",
            palette=DONJON,
            images=(
                ("le gardien", sujet_sur_fond(MAGENTA)),
                ("la sentinelle", sujet_sur_fond(GRIS_DU_MODELE, porte_le_fond=True)),
                ("l'ajouré", sujet_sur_fond(MAGENTA, ajoure=True)),
            ),
            double=double,
        )
        foraine = monter_un_projet(
            client,
            nom="La fête foraine",
            palette=FORAINE,
            images=(("le manège", sujet_sur_fond(GRIS_DU_MODELE, porte_le_fond=True)),),
            double=double,
            # **Un fond posé alors qu'aucun n'est sûr**, et c'est l'appariement
            # qui compte : l'atelier dit qu'il ne peut rien garantir, l'auteur
            # choisit quand même, et l'écran de confirmation montre alors ce que
            # ce choix fait partir — la phrase de calage et l'interdiction.
            fond="#FF00FF",
        )
        dire_ce_qu_on_verra(client, donjon, "Le donjon")
        dire_ce_qu_on_verra(client, foraine, "La fête foraine")
        # On repart sur le donjon : c'est celui dont la proposition est sûre, et
        # c'est donc le premier écran qu'on veut voir en ouvrant.
        client.put("/api/projects/current", json={"projet": donjon})

    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
