"""Adaptation locale de caméra/plage, exécutée par Blender hors du serveur.

Le fichier natif est lu et exécuté en mémoire. Son cadrage sur l’ensemble de
l’animation, son alpha et son traitement des matières restent les siens.
"""
from __future__ import annotations
import ast
import json
from pathlib import Path
import sys


def images_de_la_plage(debut: int, fin: int, nombre: int, plage: dict) -> list[int]:
    """Les bornes sont des pourcentages de l’action ; une pose donne une image."""
    premier = debut + (fin - debut) * plage["debut"] / 100
    dernier = debut + (fin - debut) * plage["fin"] / 100
    return [round(premier + (dernier - premier) * i / max(1, nombre - 1)) for i in range(nombre)]


def adapter_script(texte: str, chemin: str, avec_plage: bool):
    arbre = ast.parse(texte, filename=chemin)
    if avec_plage:
        affectations = [n for n in arbre.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "images_a_rendre" for t in n.targets)]
        if len(affectations) != 1:
            raise ValueError("Le script de rendu natif a changé : sa sélection de frames doit être vérifiée avant d’appliquer une plage.")
        affectations[0].value = ast.parse("_images_atelier(deb, fin, NB_IMAGES)", mode="eval").body
    return compile(ast.fix_missing_locations(arbre), chemin, "exec")


def executer_commande(chemin: Path) -> None:
    document = json.loads(chemin.read_text(encoding="utf-8"))
    options = document["atelier"]
    source = Path(options["source_asset3d"]).resolve()
    script = source / "blender" / "rendu.py"
    sys.path.insert(0, str(source))
    # Le seul script autorisé est celui du moteur associé par le pont. Son
    # chemin ne vient jamais d’un champ du navigateur.
    from serveur import modeles
    camera = options.get("camera")
    if camera:
        modeles.GEOMETRIE_ANGLE[document["reglages"]["angle"]] = (camera["azimut"], camera["elevation"])
    plage = options.get("plage")
    code = adapter_script(script.read_text(encoding="utf-8-sig"), str(script), bool(plage))
    contexte = {"__name__": "__main__", "__file__": str(script), "_images_atelier": lambda d, f, n: images_de_la_plage(d, f, n, plage)}
    exec(code, contexte)


if __name__ == "__main__":
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(arguments) != 1:
        raise SystemExit("Indiquez le fichier de commande du rendu.")
    executer_commande(Path(arguments[0]))
