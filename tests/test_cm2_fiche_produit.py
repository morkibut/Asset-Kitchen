# -*- coding: utf-8 -*-
"""Les critères de CM2 — la fiche du produit ne contredit pas le vocabulaire publié.

`docs/fiche-produit.md` est écrite à la main (décision d'architecture n°3 de
`docs/PLAN-assistant.md`) : rien ne garantit qu'elle reste juste toute seule.
**Contredire, ici, se définit en une phrase et sans chiffre** (point 8sexies
d'`AGENTS.md`) : *la fiche contredit le vocabulaire publié si elle appelle une
chose du jeu par un mot que `docs/vocabulaire.html` a remplacé.*

Comme `essais/essai_vocabulaire.py`, dont ce test réutilise la lecture : **le
document donne les mots, ce fichier ne les recopie pas.** La source est la
liste noire de sa section « Ce qu'on n'écrit pas » — un mot à gauche, ce qu'on
écrit à la place à droite. C'est elle, et seulement elle, qui porte un « mot
remplacé par un autre » au sens de la phrase ci-dessus ; les titres qui ne
s'écrivent plus et les formes de retour refusées, plus bas dans le même
document, ferment un *habillage d'écran* (un titre, un lien de retour), pas un
mot du vocabulaire — une fiche en prose n'en écrit aucun par construction.

⚠️ **Une mesure sur des mots entiers, dans de la prose, attrape aussi des mots
français ordinaires qui n'ont rien à voir avec leur sens de jargon.**
`essai_vocabulaire.py` le dit déjà en tête de son fichier — *« dossier, chose,
appel sont des mots français ordinaires, et les chasser d'un commentaire ou
d'une phrase d'explication ferait un banc qui crie tout le temps »* — et
c'est exactement ce qui s'est passé au premier essai de ce banc : « un jeu est
un **dossier** », « **le dossier** du jeu », « une **chose** du jeu », « **un
appel** a coûté » se sont tous allumés alors qu'aucun ne réemploie le sens que
la liste noire proscrit. Ces trois mots-là sont donc exclus de la mesure, pour
la même raison que là-bas — pas parce que la règle ne vaut pas pour eux, mais
parce qu'un mot d'usage courant ne se laisse pas surveiller à l'aveugle sur de
la prose. Le nom du produit, « Asset Kitchen », est retiré du texte avant la
recherche pour la même raison : ce n'est pas le mot « asset » qui y est écrit,
c'est un nom propre.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from essais.essai_vocabulaire import liste_noire

RACINE = Path(__file__).resolve().parent.parent
FICHE = RACINE / "docs" / "fiche-produit.md"
VOCABULAIRE = RACINE / "docs" / "vocabulaire.html"

# Mots français ordinaires, cités tels quels dans l'en-tête d'`essai_vocabulaire.py`
# comme trop courants pour être surveillés hors d'un libellé d'ossature.
MOTS_ORDINAIRES = {"dossier", "chose", "appel"}


def _mots_proscrits() -> list[str]:
    """La liste noire de `docs/vocabulaire.html`, sans les mots trop ordinaires."""
    html = VOCABULAIRE.read_text(encoding="utf-8")
    return [m for m in liste_noire(html) if m.lower() not in MOTS_ORDINAIRES]


def _trouve_mot_entier(mot: str, texte: str) -> bool:
    """Le mot, en tant que mot — pas comme fragment d'un autre, comme dans
    `essai_vocabulaire.py`."""
    return re.search(rf"\b{re.escape(mot)}\b", texte, re.I) is not None


def test_le_vocabulaire_publie_est_lisible() -> None:
    assert VOCABULAIRE.exists(), "docs/vocabulaire.html est introuvable"
    assert _mots_proscrits(), "aucun mot proscrit lu — le document a changé de forme"


def test_la_fiche_existe_et_tient_sur_une_page() -> None:
    assert FICHE.exists(), "docs/fiche-produit.md est introuvable"
    texte = FICHE.read_text(encoding="utf-8")
    # « Une page, quelques milliers de signes, qui se relit d'un trait »
    # (`docs/PLAN-assistant.md` § CM2) — pas un plafond strict, un ordre de
    # grandeur : un document qui déborderait largement n'est plus une fiche.
    assert len(texte) < 12_000, (
        f"la fiche pèse {len(texte)} signes — ce n'est plus une page qui se relit d'un trait"
    )


def test_la_fiche_ne_contredit_pas_le_vocabulaire_publie() -> None:
    """Contredire = appeler une chose du jeu par un mot que la liste noire remplace."""
    texte = FICHE.read_text(encoding="utf-8").replace("Asset Kitchen", "")
    ecarts = [mot for mot in _mots_proscrits() if _trouve_mot_entier(mot, texte)]
    assert not ecarts, (
        "la fiche écrit des mots que docs/vocabulaire.html a remplacés : "
        + ", ".join(sorted(set(ecarts)))
    )


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
