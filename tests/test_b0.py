# -*- coding: utf-8 -*-
"""Les critères de `B0` — le socle du carnet, et ce qu'il ne laisse pas revenir.

**La tranche ne touche pas au serveur** : le carnet, la pile de lieux et le
tableau de bord sont de l'écran, et leurs critères de comportement vivent dans
`interface/src/App.test.tsx`, seul endroit du dépôt où l'interface est montée et
pilotée. Ce fichier-ci tient l'autre moitié — celle qu'aucun essai d'écran ne
peut voir, parce qu'elle porte sur **ce que les fichiers écrivent**, pas sur ce
qu'ils rendent.

Trois choses s'y vérifient :

1. **Le garde-fou du système de design, dans les deux sens.** Il vit dans
   `essais/essai_jetons.py` — c'est un banc, il rend un journal lisible — et ce
   fichier le rappelle pour que `pytest -q` le tienne aussi. Sa moitié qui
   refuse est un critère ; sa moitié qui compte n'en est pas un, et c'est
   délibéré : *un jeton que personne n'emploie est soit une pièce pas encore
   dessinée, soit un jeton mort, et seul un humain sait lequel.*
2. **Les listes fermées, dans les fichiers du carnet.** Aucune largeur, aucune
   hauteur, aucune taille de texte, aucun arrondi, aucune durée hors des listes
   de `docs/DESIGN.md`. La liste des fichiers tenus grandit d'une tranche à
   l'autre — c'est elle qui mesure l'avancement de la refonte.
3. **Le lieu est un état.** La pile de lieux est la seule source de navigation :
   aucun `useState` d'ouverture ne doit revenir dans `App.tsx`, et le fil
   d'Ariane ne doit plus se reconstruire.

**Aucun test de ce fichier ne coûte un centime, ne lance de serveur, ni ne monte
d'interface.** Ils lisent des fichiers.
"""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
APP = RACINE / "interface" / "src" / "App.tsx"
LIEUX = RACINE / "interface" / "src" / "lieux.ts"
ESSAIS_ECRAN = RACINE / "interface" / "src" / "App.test.tsx"


def _banc():
    """`essais/essai_jetons.py`, chargé par son chemin.

    `essais/` n'est pas un paquet — c'est un dossier de bancs, chacun lancé à la
    main. On le charge donc par son fichier plutôt que de l'importer, ce qui
    évite d'avoir à en faire un paquet pour un seul appel."""
    chemin = RACINE / "essais" / "essai_jetons.py"
    spec = importlib.util.spec_from_file_location("essai_jetons", chemin)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["essai_jetons"] = module
    spec.loader.exec_module(module)
    return module


# ── « Le garde-fou refuse une valeur du code absente de la liste » ───────────


def test_aucune_couleur_employee_nest_absente_de_la_liste():
    """Un jeton qui n'existe pas ne lève **aucune** erreur, et c'est le piège.

    Tailwind ne produit pas de règle pour un utilitaire dont le jeton n'est pas
    déclaré : l'élément garde alors la couleur de son parent. Ni le compilateur,
    ni la relecture, ni un essai d'écran ne le voient — un gris sur du gris ne
    détonne pas.

    Le premier passage, le 6 septembre 2026, en a trouvé **quinze emplois dans
    quatre fichiers** : `signal-sourd` (deux boutons actifs de l'écran des
    tables sans aucun fond — le défaut que `docs/DESIGN.md` disait fermé, et
    qui l'était dans le document seulement), `texte-1` (neuf survols qui ne
    changeaient rien), `attente`, `info`.
    """
    banc = _banc()
    declares = set(banc.DECLARE.findall(banc.CSS.read_text(encoding="utf-8")))
    comptes, ou = banc.emplois(declares)
    manquants = banc.jetons_non_declares(declares, comptes, ou)
    assert manquants == [], "\n".join(manquants)


# ── « Aucune largeur ni hauteur hors de la liste fermée dans un fichier neuf » ─


@pytest.mark.parametrize("relatif", _banc().LES_FICHIERS_DU_CARNET)
def test_un_fichier_du_carnet_tient_dans_les_listes_fermees(relatif: str):
    """Les cinq listes de `docs/DESIGN.md`, plus les durées.

    **Elles ne valent que pour les fichiers du carnet**, et c'est la seule façon
    de les tenir vraiment : les quarante écrans d'avant les enfreignent tous, et
    un garde-fou qu'on désactive pour pouvoir livrer n'en est plus un. Chaque
    tranche de la V4 ajoute ses fichiers à `LES_FICHIERS_DU_CARNET`.
    """
    banc = _banc()
    chemin = RACINE / relatif
    assert chemin.exists(), f"{relatif} n'existe pas"
    fautes = banc.hors_des_listes(relatif, chemin.read_text(encoding="utf-8"))
    assert fautes == [], "\n".join(fautes)


# ── « Le lieu est un état, le fil d'Ariane en est dérivé » ───────────────────

# Les douze états d'ouverture qui décidaient de l'écran affiché. Ils existent
# toujours par leur nom et leur type — deux cents endroits les lisent —, mais ce
# sont désormais des **valeurs dérivées** de la pile.
ANCIENS_ETATS = (
    "onglet",
    "depensesOuvertes",
    "clipOuvert",
    "montageOuvert",
    "bandeOuverte",
    "montageDeLaBande",
    "envoiOuvert",
    "choixDeReference",
    "carteDecoupee",
    "choseOuverteId",
    "caseOuverte",
    "tablesOuvertes",
    # **La famille rejoint la liste le jour où elle entre dans la pile** (B9.4).
    # Elle vivait exactement du défaut que cette liste garde : la pile disait
    # *codex* et un `useState` disait *laquelle*, si bien que deux portes vers la
    # même famille n'atterrissaient pas au même endroit et que le fil d'Ariane
    # devinait ce que la pile ne savait pas.
    "familleOuverte",
)


def test_aucun_etat_douverture_ne_revient_dans_App():
    """**Une seule vérité sur « où l'on est ».**

    Le jour où l'un de ces noms redevient un `useState`, il y a deux sources de
    navigation et elles divergeront — c'est exactement ce qui a laissé
    `decoupeOuverte` vivre des jours durant avec sept écritures, toutes à
    `null`, et un écran que plus rien n'atteignait.
    """
    texte = APP.read_text(encoding="utf-8")
    revenus = [
        nom
        for nom in ANCIENS_ETATS
        if re.search(rf"const \[{nom},\s*set\w+\]\s*=\s*useState", texte)
    ]
    assert revenus == [], (
        "ces états d'ouverture sont redevenus des useState, alors que la pile de"
        f" lieux les dérive : {', '.join(revenus)}"
    )


def test_le_fil_dariane_est_lu_depuis_la_pile():
    """Il se **lit**, il ne se reconstruit plus.

    Avant `B0`, `App.tsx` portait une chaîne de six ternaires longue de cent dix
    lignes qui *devinait* où l'on était en interrogeant dix états les uns après
    les autres, dans un ordre de priorité écrit nulle part.
    """
    texte = APP.read_text(encoding="utf-8")
    assert "filDAriane(" in texte, "le fil ne passe plus par `filDAriane`"
    assert "const chemin: Segment[] = depensesOuvertes" not in texte, (
        "la chaîne de ternaires est revenue"
    )


def test_la_pile_ne_connait_ni_react_ni_le_dom():
    """`lieux.ts` se lit et s'essaie seul.

    C'est ce qui permet à la règle *un même genre ne s'empile jamais deux fois*
    d'être vérifiable sans monter un écran. Une seule dépendance de type y est
    tolérée — celle qui nomme ce qu'un lieu transporte.
    """
    texte = LIEUX.read_text(encoding="utf-8")
    for interdit in ("from \"react\"", "document.", "window."):
        assert interdit not in texte, f"`lieux.ts` ne doit pas connaître {interdit}"


# ── « Les 61 appels passent par une seule fonction d'aide de navigation » ────


def test_un_seul_endroit_sait_que_les_lieux_sont_des_onglets():
    """Le fichier d'essais navigue soixante et une fois, par **un** accesseur.

    Chacune écrivait `screen.getByRole("tab", …)` en toutes lettres, c'est-à-dire
    *par quel dessin* on change de lieu au lieu de *où l'on va*. La V4 remplace
    les onglets par le carnet : sans cette aide, la tranche qui les retire
    casserait soixante et un essais d'un coup, et il faudrait relire chacun pour
    retrouver ce qu'il voulait vraiment vérifier.
    """
    texte = ESSAIS_ECRAN.read_text(encoding="utf-8")
    restants = re.findall(r"getByRole\(\s*\"tab\"", texte)
    assert len(restants) == 1, (
        f"{len(restants)} endroits savent que les lieux sont des onglets ;"
        " il ne doit y en avoir qu'un, l'aide `leLieu`"
    )
