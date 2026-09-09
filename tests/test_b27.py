# -*- coding: utf-8 -*-
"""B27 — le garde-fou d'import, tenu par la suite complète.

**Le défaut que cette tranche corrige, et qu'elle a failli reproduire.**
`essais/essai_imports.py` refuse qu'un fichier du carnet emprunte une
fonction, une constante ou un crochet à un écran hors carnet — exactement le
défaut qui a laissé `Retouche.tsx` emprunter quatorze symboles à `Places.tsx`
sans qu'aucune ligne du dépôt ne le signale, quatre tranches durant. Mais un
banc qu'on lance à la main de temps en temps garde le même défaut sous une
autre forme : rien n'oblige à le relancer avant de commit. C'est exactement
pour ça qu'`essai_jetons.py` est rappelé dans `tests/test_b0.py` plutôt que
laissé à la seule mémoire de qui s'en souvient — ce fichier fait la même
chose pour `essai_imports.py`, sur le patron exact de `tests/test_b0.py:52`.

**Ce test ne réécrit pas le garde-fou.** Il charge `essais/essai_imports.py`
par son chemin, comme `test_b0.py` le fait pour `essai_jetons.py`, et
invoque sa propre logique — pas une copie — pour que `pytest -q` échoue si
le banc refuserait quoi que ce soit sur l'état actuel du dépôt.

⚠️ **Aucun essai de ce fichier ne coûte un centime** : ils lisent des
fichiers.

    Lancer :  PYTHONPATH="$(pwd)" python -m pytest tests/test_b27.py
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent


def _banc():
    """`essais/essai_imports.py`, chargé par son chemin.

    `essais/` n'est pas un paquet — c'est un dossier de bancs, chacun lancé à
    la main. On le charge donc par son fichier plutôt que de l'importer,
    exactement comme `tests/test_b0.py` le fait pour `essai_jetons.py`."""
    chemin = RACINE / "essais" / "essai_imports.py"
    spec = importlib.util.spec_from_file_location("essai_imports", chemin)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["essai_imports"] = module
    spec.loader.exec_module(module)
    return module


# ── « L'auto-essai du garde-fou refuse vraiment une régression fabriquée » ───


def test_lauto_essai_du_garde_fou_passe():
    """Les trois cas fabriqués par le banc lui-même : un emprunt refusé, une
    composition laissée passer, une exception nommée laissée passer.

    Si l'un des trois échoue, le garde-fou ne se comporte plus comme son
    docstring le promet — et c'est précisément ce qu'aucun essai ne voyait
    avant cette tranche."""
    banc = _banc()
    fautes = banc.auto_essai()
    assert fautes == [], "\n".join(fautes)


# ── « Aucun fichier du carnet n'emprunte de logique hors carnet » ────────────


@pytest.mark.parametrize("relatif", _banc().LES_FICHIERS_DU_CARNET)
def test_un_fichier_du_carnet_nemprunte_rien_hors_carnet(relatif: str):
    """Le garde-fou lui-même, relancé sur chaque fichier du carnet.

    C'est le critère que `B27` existe pour fermer : un fichier du carnet ne
    doit fournir aucune fonction, constante ou crochet emprunté à un écran
    qui n'y est pas, sauf par une exception nommée dans
    `essais/essai_imports.py`."""
    banc = _banc()
    chemin = RACINE / relatif
    assert chemin.exists(), f"{relatif} n'existe pas"
    fautes = banc.emprunts_hors_carnet(chemin.read_text(encoding="utf-8"), chemin)
    assert fautes == [], "\n".join(fautes)
