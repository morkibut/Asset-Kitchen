# -*- coding: utf-8 -*-
"""Ce que le coup de main emporte de l'instant — la fiche, et les noms du jeu (CM3).

**Un fichier à part de `coup_de_main.py`**, qui reste le tuyau : lui ne sait
pas ce qui part, seulement comment ça part et ce que ça coûte. Ici, on rassemble
ce que la décision 3 du plan fait partir à chaque appel — la fiche du produit,
écrite à la main (`docs/fiche-produit.md`, CM2), et le contexte de l'instant —,
et la composition elle-même vit dans le domaine (`composer`), la même pour
l'appel et pour « Voir ce qui part ».

**Les noms du jeu, et d'où ils viennent.** Le métier « améliorer » ne doit ni
traduire ni inventer les mots de l'univers de l'auteur. Ceux que le produit
connaît par leur nom : le nom du jeu, ses sujets, les collections où ils sont
rangés, les pièces d'équipement et les ambiances. **Pas les jeux de tuiles** :
les relire demande d'ouvrir chaque ensemble et sa recette, pour des noms que
l'auteur écrit rarement dans un prompt ; la règle générale de la consigne
(*tout nom propre se recopie*) les couvre. Et de tous ces noms, **seuls ceux que
le texte contient partent** (`noms_presents`).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from atelier.services.bibliotheque import ProjetInconnu

#: La fiche du produit (CM2). **Relue à chaque appel** : corriger une phrase
#: vaut sans redémarrer l'atelier — c'est tout l'intérêt d'une fiche à la main.
FICHE = Path(__file__).resolve().parents[2] / "docs" / "fiche-produit.md"


def fiche_du_produit() -> str:
    return FICHE.read_text(encoding="utf-8")


def noms_du_jeu(atelier: Any, projet: str) -> list[str]:
    """Tous les noms que le jeu porte, dans un ordre stable. Lève si le jeu n'existe pas."""
    objet = atelier.base.lire_projet(projet)
    if objet is None:
        raise ProjetInconnu(projet, [p.identifiant for p in atelier.bibliotheque.projets()])
    noms: list[str] = [objet.nom]
    noms += [p.nom for p in atelier.production.personnages(projet)]
    noms += [
        c.nom
        for c in atelier.bibliotheque.collections()
        if c.projet == projet or c.sujets_du_jeu(projet) or c.matieres_du_jeu(projet)
    ]
    noms += [p.nom for p in objet.pieces]
    noms += [a.nom for a in objet.ambiances]
    return [n for n in noms if n and n.strip()]
