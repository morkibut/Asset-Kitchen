# -*- coding: utf-8 -*-
"""Ce que le coup de main emporte de l'instant — la fiche, et les noms du jeu (CM3, CM4).

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

from atelier.domaine.coup_de_main import ECRANS
from atelier.services.bibliotheque import ProjetInconnu

#: La fiche du produit (CM2). **Relue à chaque appel** : corriger une phrase
#: vaut sans redémarrer l'atelier — c'est tout l'intérêt d'une fiche à la main.
FICHE = Path(__file__).resolve().parents[2] / "docs" / "fiche-produit.md"

#: Ce qu'on garde d'un champ regardé ou d'une raison de blocage — assez pour ce
#: qu'un champ de prompt porte, pas assez pour un collage par erreur (CM4).
SIGNES_CONTEXTE_MAX = 500


def fiche_du_produit() -> str:
    return FICHE.read_text(encoding="utf-8")


def contexte_instant(
    ecran: str,
    *,
    champ: str | None = None,
    valeur: str | None = None,
    blocage: str | None = None,
) -> str:
    """L'écran où l'auteur travaille, le champ qu'il regarde, ce qu'il y a
    écrit, ce qui bloque — en autant de lignes, et pas une de plus (CM4).

    **Réutilisable par CM5** (« expliquer ce qui bloque » du plan) : c'est la
    même fonction qui composera son contexte, avec `blocage` rempli cette
    fois-ci. `ecran` doit être une clé d'`ECRANS` — sinon cette fonction lève
    `KeyError`, exactement comme `composer` le fait déjà pour un `champ`
    inconnu de `CHAMPS` ; c'est à l'appelant (la route) de vérifier d'abord et
    de traduire un écran inconnu en refus, jamais en 500.

    Chaque ligne est facultative sauf la première : une question peut porter
    sur l'écran seul, sans champ regardé ni valeur ni blocage.
    """
    lignes = [f"Écran : {ECRANS[ecran]}."]
    if champ:
        lignes.append(f"Champ regardé : « {champ.strip()[:SIGNES_CONTEXTE_MAX]} ».")
    if valeur and valeur.strip():
        lignes.append(f"Ce qu'il porte : « {valeur.strip()[:SIGNES_CONTEXTE_MAX]} ».")
    if blocage and blocage.strip():
        lignes.append(f"Ce qui bloque : {blocage.strip()[:SIGNES_CONTEXTE_MAX]}")
    return "\n".join(lignes)


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
