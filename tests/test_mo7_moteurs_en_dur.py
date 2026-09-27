# -*- coding: utf-8 -*-
"""MO7 — le garde-fou d'un nom de moteur écrit en dur, tenu par la suite complète.

**Le défaut que ce garde-fou empêche de revenir.** MO4 avait laissé deux
tables de noms de moteur écrites à la main dans l'écran (`NOM_MOTEUR_LOCAL`,
`interface/src/api-workflows.ts` ; `MOTEURS_SONORES`,
`interface/src/composants/WorkflowsLocaux.tsx`), en disant explicitement que
MO7 trancherait si elles devaient disparaître — elles ont disparu, remplacées
par la lecture du catalogue serveur. Un banc qu'on lance à la main de temps en
temps laisse le même défaut revenir sous une autre forme : rien n'oblige à le
relancer avant de commit. C'est exactement pour ça qu'`essai_jetons.py` et
`essai_imports.py` sont rappelés par `tests/test_b0.py` et `tests/test_b27.py`
plutôt que laissés à la seule mémoire de qui s'en souvient — ce fichier fait
la même chose pour `essai_moteurs_en_dur.py`, sur le patron exact de
`tests/test_b27.py`.

**Ce test ne réécrit pas le garde-fou.** Il charge `essais/essai_moteurs_en_dur.py`
par son chemin, comme `test_b27.py` le fait pour `essai_imports.py`, et
invoque sa propre logique — pas une copie — pour que `pytest -q` échoue si le
banc trouverait quoi que ce soit sur l'état actuel du dépôt.

⚠️ **Aucun essai de ce fichier ne coûte un centime** : ils lisent des fichiers.

    Lancer :  PYTHONPATH="$(pwd)" python -m pytest tests/test_mo7_moteurs_en_dur.py
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

# **Garde-fou**, sur le patron exact de `tests/test_b27.py` : `essai_moteurs_en_dur.py`
# balaie tout `interface/src` pour y chercher un nom de moteur recopié en dur.
# La reprise fautive peut apparaître dans un fichier que ce test ne nomme nulle
# part, donc il doit tourner même loin de ce qu'on vient de toucher.
pytestmark = pytest.mark.gardefou

RACINE = Path(__file__).resolve().parent.parent


def _banc():
    """`essais/essai_moteurs_en_dur.py`, chargé par son chemin.

    `essais/` n'est pas un paquet — c'est un dossier de bancs, chacun lancé à
    la main. On le charge donc par son fichier plutôt que de l'importer,
    exactement comme `tests/test_b27.py` le fait pour `essai_imports.py`."""
    chemin = RACINE / "essais" / "essai_moteurs_en_dur.py"
    spec = importlib.util.spec_from_file_location("essai_moteurs_en_dur", chemin)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["essai_moteurs_en_dur"] = module
    spec.loader.exec_module(module)
    return module


# ── « L'auto-essai du garde-fou refuse vraiment une régression fabriquée » ───


def test_lauto_essai_du_garde_fou_passe():
    """Les deux cas fabriqués par le banc lui-même : une table de noms recopiés
    refusée, une phrase qui cite le même nom laissée passer.

    Si l'un des deux échoue, le garde-fou ne se comporte plus comme son
    docstring le promet — et c'est précisément ce qu'aucun autre essai ne
    voit (`AGENTS.md`, point 8sexies : suspecter la mesure avant le sujet)."""
    banc = _banc()
    fautes = banc.auto_essai()
    assert fautes == [], "\n".join(fautes)


# ── « Aucun nom de moteur connu n'est écrit en dur dans l'écran » ───────────


def test_aucun_nom_de_moteur_nest_ecrit_en_dur():
    """Le garde-fou lui-même, relancé sur tout `interface/src`.

    C'est le critère que `MO7` existe pour fermer : plus aucun écran ne
    recopie à la main ce qu'une route du catalogue sert déjà."""
    banc = _banc()
    noms = banc.noms_connus()
    assert noms, "le catalogue serveur ne nomme plus aucun moteur — le banc lit-il le bon module ?"

    fautes: list[str] = []
    for chemin in banc.fichiers_a_mesurer():
        relatif = str(chemin.relative_to(RACINE)).replace("\\", "/")
        fautes += banc.occurrences_en_dur(
            chemin.read_text(encoding="utf-8"), relatif, noms
        )
    assert fautes == [], "\n".join(fautes)
