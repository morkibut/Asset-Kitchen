# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer A12 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8437 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    py essais/atelier_jetable_a12.py
        Un jeu vu de face — pas de directions, la lecture la plus simple.

    py essais/atelier_jetable_a12.py directions
        Le même jeu vu de dessus, avec ses quatre angles : chaque attitude se
        découpe en quatre cases, sur les deux calques.

## Ce qu'il monte, et pourquoi ce décor-là

Un personnage dont **le repos est dessiné et la marche est animée**. C'est le
seul décor où l'écart entre les deux calques se lit : sur une chose entièrement
faite, ou entièrement vide, les deux jauges disent la même chose et l'on ne voit
rien.

Les animations sont **écrites directement dans le dépôt**, avec leur planche de
sprites — un carré qui change de couleur, quatre images. Aucun clip n'a été payé,
aucune vidéo n'est décodée : ce qu'on vient regarder est la matrice, pas
l'extraction.

## Ce qu'on vient voir

- **Deux calques, et l'on passe de l'un à l'autre d'un geste.** La bascule
  *porte* les deux jauges : chaque calque dit son compte sur le bouton qui
  l'ouvre, et l'écart entre les deux est le sujet.
- **Une image faite ne remplit pas la case animée.** Le repos est dessiné et
  reste vide côté animation — c'est très exactement ce que l'auteur veut voir.
- **La bande tourne dans sa case**, à la taille de la vignette. Une vignette
  figée montrerait la première image et rien d'autre.
- **La case dit de quel clip sa bande vient**, et le nom de la bande y remonte :
  un clic, et l'on est dans l'écran de montage de ce clip-là.
- **Retirer une bande ne perd rien.** La croix vide la case ; la bande reste, le
  clip reste. ⚠️ Le clip d'ici est un faux : son montage s'ouvrira sur un refus,
  et c'est normal — il n'a pas d'images à découper.

## ⚠️ Ce qu'il ne faut pas faire

**Ne cliquez pas « Commander »** : l'animateur est doublé, mais le geste part
quand même dans la chaîne. Rien n'est payé — le double facture zéro —, mais ce
n'est pas ce qu'on vient regarder ici.
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
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine.bande import Bande, Cadre  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from conftest import FournisseurDouble, image_sujet  # noqa: E402
from test_a9 import MELE, AnimateurDouble  # noqa: E402

# **Un port par mode**, pour que les deux tournent côte à côte : ce qu'on compare
# est justement ce que chacun affiche, et fermer l'un pour ouvrir l'autre
# obligerait à se souvenir de l'écran qu'on vient de quitter.
PORTS = {"face": 8437, "directions": 8438}
MODELE = "essai:rend-du-png"
COTE = 24
IMAGES = 4

# Quatre couleurs franches : à quatre images par seconde, une bande qui tourne se
# reconnaît à l'œil, et une bande qui ne tourne pas aussi.
COULEURS = [(210, 70, 60), (230, 170, 50), (90, 170, 110), (80, 130, 210)]


def _attendre(client, generation: str) -> None:
    for _ in range(600):
        etat = client.get(f"/api/generations/{generation}").json()
        if etat["statut"] in ("reussie", "echouee"):
            return
        client.get("/api/status")


def _une_image(client, double, prompt, personnage, pose) -> str:
    double.rendre = lambda: image_sujet(bloc=4, toile=COTE)
    faite = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": prompt,
            "personnage": personnage,
            "pose": pose,
            "echelle": "personnage",
        },
    )
    _attendre(client, faite.json()["identifiant"])
    double.rendre = None
    return f"{faite.json()['identifiant']}-0"


def _planche() -> bytes:
    """Une planche de sprites à quatre cases, écrite à la main.

    **Le carré change de couleur d'une case à l'autre**, et c'est tout ce qu'il
    faut : ce qu'on vérifie au navigateur est *que ça tourne*, pas ce que ça
    montre. Un vrai sprite aurait demandé un vrai clip, donc un décodeur vidéo,
    donc une condition de plus pour regarder une matrice.
    """
    planche = Image.new("RGBA", (COTE * IMAGES, COTE), (0, 0, 0, 0))
    for rang, couleur in enumerate(COULEURS[:IMAGES]):
        case = Image.new("RGBA", (COTE - 6, COTE - 6), (*couleur, 255))
        planche.paste(case, (rang * COTE + 3, 3))
    sortie = io.BytesIO()
    planche.save(sortie, format="PNG")
    return sortie.getvalue()


def _une_bande(
    atelier: Atelier,
    personnage: str,
    pose: str,
    direction: str | None = None,
    *,
    nom: str = "marche",
    clip: str = "clip-jetable",
) -> str:
    """Une animation gardée, telle qu'un montage l'aurait laissée.

    Sa planche est écrite dans le dépôt : la route qui la sert rend le cache
    quand il existe, et ne cherche donc jamais les images du clip — qui, ici,
    n'existent pas.
    """
    identifiant = f"bande-{pose}-{direction or 'seule'}"
    bande = Bande(
        identifiant=identifiant,
        clip=clip,
        nom=nom,
        images=tuple(range(IMAGES)),
        cadence=4.0,
        cadre=Cadre(0, 0, COTE - 1, COTE - 1),
        projet=atelier.bibliotheque.courant,
        personnage=personnage,
        pose=pose,
        direction=direction,
        case_largeur=COTE,
        case_hauteur=COTE,
    )
    bande.planche = atelier.fichiers.ecrire_planche_de_bande(
        clip, identifiant, _planche()
    )
    atelier.base.enregistrer_bande(bande)
    return identifiant


def peupler(atelier: Atelier, double: FournisseurDouble, avec_directions: bool) -> str:
    """Le repos dessiné, la marche animée. **L'écart est le décor.**"""
    with TestClient(creer_application(atelier)) as client:
        if avec_directions:
            client.put("/api/universe", json={"vue": "vue-dessus-34"})
        personnage = client.post(
            "/api/characters",
            json={
                "nom": "Le nain",
                "description": "un forgeron nain à la barbe tressée",
            },
        ).json()["personnage"]["identifiant"]
        repos = _une_image(client, double, "le nain, au repos", personnage, "repos")
        client.put(
            f"/api/characters/{personnage}/references",
            json={"asset": repos, "promue": True},
        )
        if avec_directions:
            # Deux angles animés sur quatre : la rangée doit dire lesquels
            # manquent, par leur nom.
            _une_bande(atelier, personnage, "marche", "sud", nom="marche sud")
            _une_bande(atelier, personnage, "marche", "nord", nom="marche nord")
        else:
            _une_bande(atelier, personnage, "marche", nom="marche")
        return personnage


def principal(mode: str) -> int:
    if mode not in PORTS:
        print(f"Mode inconnu : {mode}")
        print(f"Attendus : {', '.join(PORTS)}")
        return 2

    dossier = Path(tempfile.mkdtemp(prefix="atelier-a12-"))
    print(f"Dossier jetable : {dossier}")
    print(f"Mode            : {mode}")

    double = FournisseurDouble()
    animateur = AnimateurDouble()
    animateur.modeles = [MELE]
    animateur.facture = 0.067

    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )
    personnage = peupler(atelier, double, mode == "directions")

    with TestClient(creer_application(atelier)) as client:
        chose = next(
            p
            for p in client.get("/api/characters").json()["personnages"]
            if p["identifiant"] == personnage
        )

    print()
    print(f"  Le personnage : {personnage}")
    print("  Ses cases, calque par calque :")
    for case in chose["cases"]:
        animees = sum(len(a["bandes"]) for a in case["directions"]) or len(
            case["bandes"]
        )
        print(
            f"    — {case['pose']:<8} images {len(case['images'])} / "
            f"{case['demandees']}   animations {animees} / "
            f"{case['bandes_demandees']}"
        )
    print()
    print("  À cliquer :")
    print("    Codex › Le nain › la bascule « animations N / 6 », en haut à droite")
    print("    — le repos est dessiné et reste vide côté animation")
    print("    — la marche tourne dans sa case, à 4 images par seconde")
    print("    — le nom sous la vignette remonte au clip (qui est un faux : refus)")
    print("    — la croix sur la vignette vide la case, sans rien perdre")
    print()
    port = PORTS[mode]
    print(f"Atelier jetable sur http://127.0.0.1:{port} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=port, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal(sys.argv[1] if len(sys.argv) > 1 else "face"))
