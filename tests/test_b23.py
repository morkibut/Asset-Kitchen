# -*- coding: utf-8 -*-
"""B23 — les trois surfaces déménagent.

**Planches** : `docs/archive/pistes-2026-09-04/carnet/Retouche.dc.html` et les quatre
`atelier-*.dc.html` de la tranche. Bloquée par `B16` et `B18`.

`B16` avait décidé, en connaissance de cause, que l'écran neuf doublerait
l'ancien « le temps d'un déménagement », et confié ce déménagement à
`B17`/`B18`. Les deux sont closes, et il n'a pas eu lieu : `Retouche.tsx`
renvoyait encore six fois vers `Places.tsx`. Cette tranche le fait.

**Ce que ce fichier tient, et pourquoi ici plutôt qu'à l'écran.** Trois des
critères de la tranche ne se mesurent pas en montant un composant : ils portent
sur *le code lui-même* — une seule implémentation de chaque geste, une seule
convention de coordonnées, plus aucune phrase qui renvoie ailleurs. Un essai
d'écran ne peut pas voir qu'il existe une **seconde** copie du même calcul
quelque part ; il peut seulement voir que celle qu'il monte marche. C'est
exactement la panne que `B18` a payée sur `palette.py`, et c'est ce que
`tests/test_b16.py` fait déjà pour les deux listes de tailles.

Le quatrième critère — *aucune clé neuve dans le domaine* — est tenu par
`tests/test_b1.py`, qui refait l'empreinte des 61 recettes du corpus figé. Cette
tranche ne touche pas une ligne de Python ; le vérifier une seconde fois ici
recopierait un essai au lieu de le lire. Ce fichier se contente donc de nommer
les huit champs du retournement et de refuser qu'il en pousse un neuvième, parce
que c'est **cette tranche-ci** qui lui donne trois écrans de plus.

⚠️ **Aucun essai de ce fichier ne coûte un centime** : ils lisent des fichiers.

    Lancer :  PYTHONPATH="$(pwd)" python -m pytest tests/test_b23.py
"""

from __future__ import annotations

import dataclasses
import re
from pathlib import Path

from atelier.domaine.recette import Retournement

RACINE = Path(__file__).resolve().parents[1]
COMPOSANTS = RACINE / "interface" / "src" / "composants"
RETOUCHE = COMPOSANTS / "Retouche.tsx"

#: Les quatre surfaces qui reçoivent un geste posé **sur l'image**.
LES_QUATRE_SURFACES = (
    "CadreDeRecadrage",
    "PipetteSurImage",
    "TraceSurImage",
    "ToileDeLaMain",
)


def _lire(chemin: Path) -> str:
    return chemin.read_text(encoding="utf-8")


# ── « Plus aucune phrase ne renvoie à l'ancien écran » ───────────────────────


def test_l_ecran_neuf_ne_renvoie_plus_l_auteur_a_l_ancien():
    """**Le critère qu'une refonte casse le plus facilement.**

    Six phrases de `Retouche.tsx` envoyaient l'auteur régler ailleurs ce que cet
    écran-ci ne portait pas. Elles n'étaient pas fausses — elles décrivaient
    l'état du produit —, et c'est pour ça qu'elles sont mesurées : une phrase
    juste qui survit au déménagement devient un mensonge silencieux, et personne
    ne relit une explication qu'on a déjà lue.

    L'essai laisse passer `import … from "./Places"` : un import n'est pas une
    phrase, et cet écran emprunte encore des fonctions pures à ce module — ce
    que `B26` refermera en le vidant, pas en le contournant."""
    texte = _lire(RETOUCHE)
    sans_imports = "\n".join(
        ligne for ligne in texte.splitlines() if not ligne.lstrip().startswith("import ")
    )
    # L'import multi-lignes se ferme sur `} from "./Places"` — on le retire aussi.
    sans_imports = sans_imports.replace('} from "./Places"', "")

    for renvoi in ("Places.tsx", "l'ancien écran", "de l'écran des tables"):
        assert renvoi not in sans_imports, (
            f"`Retouche.tsx` renvoie encore le lecteur ailleurs : « {renvoi} »"
        )

    # Les deux grisés qui nommaient l'absence de surface ont changé de sens.
    assert "pas depuis cette colonne" not in texte
    assert "se règle sur la table elle-même" not in texte


# ── « On déménage, on ne réécrit pas » ──────────────────────────────────────


def test_chaque_surface_n_est_ecrite_qu_une_fois():
    """**Deux implémentations d'un même geste finiraient par ne plus viser le
    même pixel.**

    `B23` avait laissé l'ancien écran *emprunter* les quatre surfaces au carnet
    plutôt qu'en garder une copie — le sens de l'import comptait, parce que
    c'était l'ancien qui s'en allait. **`B26` l'a fait partir**, et l'essai
    change donc de forme : il n'y a plus d'emprunteur à surveiller, il y a un
    dépôt entier où une seconde copie ne doit pas réapparaître.

    Le fichier de la retouche est exclu de la recherche : c'est lui qui les
    déclare."""
    retouche = _lire(RETOUCHE)

    for surface in LES_QUATRE_SURFACES:
        declarations = re.findall(rf"^(?:export )?function {surface}\(", retouche, re.M)
        assert len(declarations) == 1, (
            f"{surface} n'est pas déclarée une fois et une seule dans Retouche.tsx"
        )

    ailleurs = [
        chemin
        for chemin in sorted((RACINE / "interface" / "src").rglob("*.ts*"))
        if chemin != RETOUCHE
    ]
    for chemin in ailleurs:
        source = _lire(chemin)
        for surface in LES_QUATRE_SURFACES:
            assert re.search(rf"^\s*(?:export )?function {surface}\(", source, re.M) is None, (
                f"{surface} est déclarée une seconde fois dans"
                f" {chemin.relative_to(RACINE)} — le déménagement en a laissé une copie"
            )


def test_une_seule_convention_de_coordonnees():
    """**Les quatre lisent le rectangle de l'image, jamais celui de la surface.**

    C'est la leçon du cadre de la Découpe, réapprise deux fois en U2 puis U11 :
    l'image est posée dans sa surface en *tenant dans le cadre*, donc centrée
    avec des bandes vides dès que les deux proportions diffèrent d'un cheveu, et
    un calcul qui mesure la surface se décale de la largeur de la bande.

    Quatre surfaces, quatre appels à `rectangleDeLImage`, et aucune arithmétique
    de coin écrite à côté — c'est ce que l'essai compte."""
    retouche = _lire(RETOUCHE)
    assert retouche.count("rectangleDeLImage(surface,") == len(LES_QUATRE_SURFACES)
    # Et personne d'autre ne calcule de coordonnée d'image : l'ancien écran, qui
    # en faisait autant, est parti en `B26`.
    for chemin in sorted((RACINE / "interface" / "src").rglob("*.ts*")):
        if chemin == RETOUCHE or chemin.name.endswith(".test.tsx"):
            continue
        assert "rectangleDeLImage(surface," not in _lire(chemin), (
            f"{chemin.relative_to(RACINE)} recalcule le rectangle de l'image"
        )


def test_les_trois_reglages_du_retournement_sont_dans_l_ecran_neuf():
    """L'angle, la moitié gardée du repli et les zones protégées.

    ⚠️ **Ils ne paraissent que sous le sens auquel ils s'appliquent** — un angle
    sous « miroir haut-bas » ne voudrait rien dire —, et c'est l'essai d'écran
    qui le tient. Ici on tient l'autre moitié : ils existent, et le fichier du
    carnet est l'endroit où ils sont écrits."""
    retouche = _lire(RETOUCHE)
    for reglage in ("angle-libre", "rotsprite", "moitie_repli", "zones_protegees"):
        assert reglage in retouche, f"le retournement ne règle pas « {reglage} » ici"


# ── « Aucune clé neuve : la tranche déplace un geste » ──────────────────────


def test_le_retournement_ne_gagne_aucun_champ():
    """**Cette tranche ne pose aucune clé neuve** : elle déplace l'endroit où
    l'on règle des clés qui existent déjà depuis `B18`.

    Les huit champs sont nommés en toutes lettres plutôt que comptés : un essai
    qui vérifierait seulement leur nombre passerait au vert le jour où l'on en
    renomme un — et c'est bien le nom qui part dans l'empreinte."""
    champs = {c.name for c in dataclasses.fields(Retournement)}
    assert champs == {
        "sens",
        "angle",
        "axe_repli",
        "moitie_repli",
        "zones_protegees",
    }

    # Et le canonique d'un retournement au défaut ne porte que son sens : les
    # quatre autres ne s'écrivent qu'une fois posés. C'est ce qui fait qu'une
    # recette d'avant `B18` garde son empreinte au caractère près.
    assert Retournement().en_json() == {"sens": "gauche-droite"}
