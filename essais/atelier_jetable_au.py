"""Atelier réel de vérification AU, fournisseurs doublés et stockage isolé.

    .venv-codex/Scripts/python.exe essais/atelier_jetable_au.py

Le même dossier conserve les gestes entre redémarrages. Aucun fichier de
donnees/ ni d'un projet Godot de l'auteur n'est modifié.
"""
from pathlib import Path
import sys

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

import uvicorn
from atelier.api.app import creer_application
from atelier.services import Atelier
from atelier_jetable_b21 import peupler
from conftest import FournisseurDouble
from test_a9 import AnimateurDouble, clip_mp4


def principal() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = RACINE / "essais" / "resultats" / "atelier-au"
    jeu = dossier / "jeu-godot"
    jeu.mkdir(parents=True, exist_ok=True)
    if not (jeu / "project.godot").exists():
        (jeu / "project.godot").write_text(
            'config_version=5\n[application]\nconfig/name="Essai Atelier unifié"\n'
            'config/features=PackedStringArray("4.7", "GL Compatibility")\n'
            '[rendering]\nrenderer/rendering_method="gl_compatibility"\n', encoding="utf-8")
    double = FournisseurDouble()
    animateur = AnimateurDouble()
    animateur.octets = clip_mp4(images=24)
    atelier = Atelier(racine=dossier / "atelier", fabrique_fournisseur=lambda: double,
                      fabrique_animateur=lambda: animateur)
    if not (dossier / "peuple").exists():
        peupler(atelier, double)
        (dossier / "peuple").touch()
    print(f"Atelier AU : http://127.0.0.1:8497/\nProjet Godot jetable : {jeu}", flush=True)
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=8497, log_level="warning")


if __name__ == "__main__":
    principal()
