# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier au navigateur **l'atelier des jeux de tuiles**
(TU3, `docs/PLAN-tuiles.md`), sans toucher à celui de l'auteur.

**Avant de le lancer : construire l'interface.**

    npm --prefix interface run build

Cet atelier sert `interface/dist` telle qu'elle est sur le disque au moment du
lancement — sans ce `build`, on regarde l'ancienne interface.

**L'auteur travaille sur le port 8420.** Cet atelier-ci vit sur un dossier
temporaire, sur le port **8511**, avec le fournisseur double des essais : rien
n'est payé, rien n'est écrit dans `donnees/`. Modèle : `essais/atelier_jetable_son.py`.

**ComfyUI est doublé** (TU5, `docs/PLAN-tuiles.md` § TU5) — le double
`ComfyMatiereDouble` de `tests/test_tu5_matieres.py`, raccordé comme
`tests/test_au7_au8.raccorder` le fait : `/object_info` porte le relevé réel
du style `klein9b-tiles-raccordable` (`tests/test_ml2.OBJECT_INFO`), et
`/prompt`, `/history`, `/view` rendent chaque tirage sans lancer aucun calcul
réel. L'onglet « Générer » du tiroir des matières est donc disponible d'office.

Ce que l'atelier peuple, par les vraies routes HTTP :

1. le jeu « Les marais d'ambre », en pixel art de 32 carrés — la taille que le
   choix de la sorte doit proposer d'office ;
2. un sujet de nature « matière », « Vase du marais », avec une image qui se
   répète sans couture — pour l'onglet « Mes matières » du tiroir ;
3. un jeu de tuiles **fait à partir d'une image** (AU13), « Forêt » — il doit
   toujours s'ouvrir dans l'éditeur d'avant ;
4. un dossier de jeu Godot associé, pour la relecture de livraison.

    py essais/atelier_jetable_tu3.py

Ctrl-C pour l'arrêter. Le dossier temporaire reste dans %TEMP%.
"""

from __future__ import annotations

import io
import math
import socket
import sys
import tempfile
from pathlib import Path

from PIL import Image

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble  # noqa: E402
from tests.test_au7_au8 import raccorder  # noqa: E402
from tests.test_tu5_matieres import ComfyMatiereDouble  # noqa: E402

PORT = 8511


def _png(image: Image.Image) -> bytes:
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def vase(cote: int = 64) -> bytes:
    """Une vase sombre, périodique sur `cote` : elle se raccorde avec elle-même."""
    image = Image.new("RGBA", (cote, cote))
    px = image.load()
    for y in range(cote):
        for x in range(cote):
            a = math.sin(2 * math.pi * x / cote * 3) + math.cos(2 * math.pi * y / cote * 2)
            b = math.sin(2 * math.pi * (x + y) / cote * 5)
            v = 0.5 + 0.25 * a + 0.15 * b
            px[x, y] = (int(52 + 40 * v), int(58 + 46 * v), int(40 + 22 * v), 255)
    return _png(image)


def foret() -> bytes:
    """Un petit atlas 2 × 2 de 16 px : de quoi ouvrir l'éditeur d'AU13."""
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    teintes = [(74, 110, 60), (96, 132, 70), (120, 96, 60), (60, 90, 110)]
    for i, t in enumerate(teintes):
        image.paste(Image.new("RGBA", (16, 16), (*t, 255)), ((i % 2) * 16, (i // 2) * 16))
    return _png(image)


def _poser(client, octets: bytes, nom: str) -> str:
    recu = client.post("/api/assets/upload", content=octets, params={"nom": nom, "traiter": "false"})
    assert recu.status_code == 201, recu.text
    return (recu.json()["asset"] or recu.json()["doublon"])["identifiant"]


def peupler(atelier: Atelier) -> None:
    with TestClient(creer_application(atelier)) as client:
        cree = client.post("/api/projects", json={"nom": "Les marais d'ambre"})
        assert cree.status_code == 201, cree.text
        projet = cree.json()["projet"]["identifiant"]
        client.put("/api/projects/current", json={"projet": projet})
        reglage = client.put("/api/universe", params={"projet": projet}, json={"style": "pixel", "cible_px": 32})
        assert reglage.status_code == 200, reglage.text
        print(f"  jeu « Les marais d'ambre » ({projet}) — pixel art, 32 carrés")

        sujet = client.post("/api/characters", json={"nom": "Vase du marais", "type": "matière", "projet": projet})
        assert sujet.status_code in (200, 201), sujet.text
        sujet_id = sujet.json()["personnage"]["identifiant"]
        image = _poser(client, vase(), "vase-du-marais.png")
        rattache = client.put(f"/api/assets/{image}/character", json={"personnage": sujet_id, "pose": None})
        assert rattache.status_code == 200, rattache.text
        print(f"  matière « Vase du marais » ({sujet_id}), une image qui se répète")

        atlas = _poser(client, foret(), "foret-atlas.png")
        au13 = client.post(f"/api/projects/{projet}/tilesets", json={"nom": "Forêt", "image": atlas, "grille": {"taille": 16}})
        assert au13.status_code == 201, au13.text
        print("  jeu de tuiles « Forêt », fait à partir d'une image (AU13)")

        godot = Path(atelier.fichiers.racine) / "Jeu Godot"
        godot.mkdir(exist_ok=True)
        (godot / "project.godot").write_text(
            'config_version=5\n[application]\nconfig/name="Les marais d\'ambre"\n'
            'config/features=PackedStringArray("4.7", "GL Compatibility")\n',
            encoding="utf-8",
        )
        lie = client.put(f"/api/projects/{projet}/godot-link", json={"dossier": str(godot)})
        assert lie.status_code == 200, lie.text
        print(f"  dossier du jeu Godot associé ({godot})")


def _verifier_port_libre(port: int) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("127.0.0.1", port)) == 0:
            raise SystemExit(f"Le port {port} est déjà pris : un atelier jetable tourne peut-être encore.")


def principal() -> int:
    _verifier_port_libre(PORT)
    dossier = Path(tempfile.mkdtemp(prefix="atelier-tu3-"))
    print(f"Dossier jetable : {dossier}")
    comfy = ComfyMatiereDouble()
    atelier = Atelier(racine=dossier, fabrique_fournisseur=lambda: FournisseurDouble(), fabrique_animateur=lambda: AnimateurMuet())
    raccorder(atelier, comfy)
    peupler(atelier)
    relu = Atelier(racine=dossier, fabrique_fournisseur=lambda: FournisseurDouble(), fabrique_animateur=lambda: AnimateurMuet())
    raccorder(relu, comfy)
    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché ; rien n'a été payé)")
    print()
    print("Ce qu'il faut regarder :")
    print("  → Les sujets › Les tuiles : la liste, « Forêt » avec son atlas.")
    print("  → Nouveau jeu de tuiles : Sol, Chemin, Mur, et « Autres formats » ; 32 px d'office.")
    print("  → L'atelier : peindre, effacer au clic droit, Île au hasard, délier la bordure,")
    print("    « Mes matières » → Vase du marais ; Enregistrer ; revenir à la liste ; rouvrir.")
    print("  → Le tiroir des matières, onglet « Générer » (TU5) : le texte envoyé (le même que")
    print("    /preview), générer 2 ou 3 tirages, les voir arriver dans la file des calculs")
    print("    locaux, puis cliquer un tirage pour le poser dans l'emplacement.")
    print("  → Livrer à Godot : la relecture, puis Déposer.")
    uvicorn.run(creer_application(relu), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
