# -*- coding: utf-8 -*-
"""Rattraper ce que le trou d'`AU20` a laissé orphelin dans un atelier réel.

**À lancer atelier fermé.** Le serveur tient la base SQLite ouverte ; écrire
dessous pendant qu'il tourne est le seul risque de ce script, et il suffit de
fermer l'atelier pour l'écarter.

**À blanc par défaut.** Sans `--ecrire`, rien n'est modifié : le script dit ce
qu'il changerait, ligne par ligne, et s'arrête là. C'est le seul mode qu'on
lance sans réfléchir.

Ce qu'il répare, et *pourquoi chacun est une déduction sûre ou non* :

1. **Un clip sans jeu dont le sujet, lui, en a un.** Le clip porte
   `personnage = champboy` ; ChampBoy n'existe que dans `test-v2` ; donc le clip
   est de `test-v2`. Aucune supposition : le jeu se lit sur le sujet.

2. **Une animation sans sujet dans un jeu qui n'en a qu'un.** Là, c'est une
   inférence — probable, pas certaine. Elle est donc **désactivée par défaut** et
   demande `--sujet-unique` en plus de `--ecrire`.

Rien n'est supprimé, rien n'est déplacé sur le disque : seules deux colonnes de
rattachement sont remplies, et le `generation.json` du disque est réécrit avec
pour que la réparation survive à un effacement de l'index.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DONNEES = RACINE / "donnees"

# **La console de Windows n'est pas en UTF-8**, et une flèche suffit à faire
# planter un script qui n'a rien à se reprocher. Le dire ici plutôt que
# d'appauvrir le texte : ce qu'on lit doit rester lisible.
for flux in (sys.stdout, sys.stderr):
    if hasattr(flux, "reconfigure"):
        flux.reconfigure(encoding="utf-8", errors="replace")


def _jeux_des_sujets(connexion) -> dict[str, str]:
    """Quel jeu tient quel sujet — la table qui rend la déduction 1 sûre."""
    return {
        ligne[0]: ligne[1]
        for ligne in connexion.execute("SELECT identifiant, projet FROM personnages")
    }


def _sujet_unique_par_jeu(connexion) -> dict[str, str]:
    """Les jeux qui n'ont **qu'un** sujet, et lequel. Les autres n'y sont pas."""
    compte: dict[str, list[str]] = {}
    for identifiant, projet in connexion.execute(
        "SELECT identifiant, projet FROM personnages"
    ):
        compte.setdefault(projet, []).append(identifiant)
    return {projet: liste[0] for projet, liste in compte.items() if len(liste) == 1}


def _reecrire_sur_le_disque(identifiant: str, contenu: dict) -> None:
    """Le `generation.json` porte la même vérité que l'index, ou il la reprendra.

    La bibliothèque se reconstruit en parcourant le disque : une réparation
    écrite dans la seule base serait défaite à la première reconstruction.
    """
    fichier = DONNEES / "generations" / identifiant / "generation.json"
    if fichier.is_file():
        fichier.write_text(
            json.dumps(contenu, ensure_ascii=False, indent=2), encoding="utf-8"
        )


def main() -> int:
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument(
        "--ecrire", action="store_true", help="appliquer (sans lui : à blanc)"
    )
    arguments.add_argument(
        "--sujet-unique",
        action="store_true",
        help="rattacher aussi ce qui est sans sujet dans un jeu qui n'en a qu'un "
        "(déduction probable, pas certaine)",
    )
    choix = arguments.parse_args()

    base = DONNEES / "atelier.sqlite3"
    if not base.is_file():
        print(f"Aucune base à {base}", file=sys.stderr)
        return 1

    connexion = sqlite3.connect(base)
    connexion.row_factory = sqlite3.Row
    jeux = _jeux_des_sujets(connexion)
    uniques = _sujet_unique_par_jeu(connexion)
    faits: list[str] = []

    # ── 1 · Le jeu se lit sur le sujet ───────────────────────────────────────
    for ligne in connexion.execute(
        "SELECT identifiant, contenu FROM generations WHERE projet IS NULL"
    ):
        generation = json.loads(ligne["contenu"])
        sujet = generation.get("personnage")
        if not sujet or sujet not in jeux:
            continue
        projet = jeux[sujet]
        faits.append(
            f"clip {ligne['identifiant']} · sujet {sujet} → jeu {projet} "
            f"({generation.get('demande', {}).get('source', '')})"
        )
        if choix.ecrire:
            generation["projet"] = projet
            connexion.execute(
                "UPDATE generations SET projet = ?, contenu = ? WHERE identifiant = ?",
                (projet, json.dumps(generation, ensure_ascii=False), ligne["identifiant"]),
            )
            _reecrire_sur_le_disque(ligne["identifiant"], generation)

    # ── 2 · Le sujet se déduit du jeu, quand il n'y en a qu'un ───────────────
    #
    # ⚠️ **`generations` n'a pas de colonne `personnage`** — le sujet d'une
    # génération vit dans son `contenu` JSON, là où `bandes` en fait une vraie
    # colonne. Filtrer en SQL des deux côtés serait plus court et faux.
    if choix.sujet_unique:
        for table, quoi in (("generations", "clip"), ("bandes", "animation")):
            colonne = "personnage" in {
                r[1] for r in connexion.execute(f"pragma table_info({table})")
            }
            requete = f"SELECT identifiant, contenu, projet FROM {table} WHERE projet IS NOT NULL"
            if colonne:
                requete += " AND personnage IS NULL"
            for ligne in connexion.execute(requete).fetchall():
                objet = json.loads(ligne["contenu"])
                if objet.get("personnage"):
                    continue
                if table == "generations" and objet.get("clip") is None:
                    continue  # une image sans sujet n'est pas un oubli : c'est la bibliothèque
                sujet = uniques.get(ligne["projet"])
                if not sujet:
                    continue
                faits.append(
                    f"{quoi} {ligne['identifiant']} · jeu {ligne['projet']} "
                    f"→ sujet {sujet} (seul sujet du jeu)"
                )
                if choix.ecrire:
                    objet["personnage"] = sujet
                    if colonne:
                        connexion.execute(
                            f"UPDATE {table} SET personnage = ?, contenu = ? "
                            "WHERE identifiant = ?",
                            (sujet, json.dumps(objet, ensure_ascii=False), ligne["identifiant"]),
                        )
                    else:
                        connexion.execute(
                            f"UPDATE {table} SET contenu = ? WHERE identifiant = ?",
                            (json.dumps(objet, ensure_ascii=False), ligne["identifiant"]),
                        )
                        _reecrire_sur_le_disque(ligne["identifiant"], objet)

    if choix.ecrire:
        connexion.commit()
    connexion.close()

    if not faits:
        print("Rien à rattacher.")
        return 0
    for fait in faits:
        print(("  appliqué · " if choix.ecrire else "  à faire  · ") + fait)
    print()
    print(
        f"{len(faits)} rattachement(s) "
        + ("écrits." if choix.ecrire else "trouvés — relancer avec --ecrire pour les poser.")
    )
    if not choix.sujet_unique:
        print(
            "  (--sujet-unique ajoute la déduction « seul sujet du jeu », "
            "qui est probable et non certaine)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
