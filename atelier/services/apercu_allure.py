# -*- coding: utf-8 -*-
"""RT1 : l'aperçu de « Son allure », calculé sur la machine, et gardé.

`docs/PLAN-retours-du-20-septembre.md` § RT1. À l'étape *Son allure*
(`interface/src/composants/ReglesDuJeu.tsx`), l'auteur choisit une taille, une
méthode de réduction et un nombre de couleurs sans jamais voir ce que ça rend
— trois rangées de boutons nus. Cette treizième route d'aperçu du produit
calcule le rendu réel, avec le même moteur que la vraie fabrication, sur une
image fixe du dépôt : **le rôdeur**, le seul sujet que l'écran montre déjà
(`docs/remarques/voir-avant-de-choisir.md` § 2a — « le rôdeur en pixel, le
rôdeur en dessin »). RT2 branchera les trois rangées sur cette route-ci ;
cette tranche ne touche à aucun écran.

**La source est `style-dessin.png`, pas `style-pixel.png`.** Les deux
montrent le même rôdeur, mais `style-pixel.png` est déjà réduit et quantifié
(22 couleurs relevées) : le reprendre en source referait une pixelisation sur
une image déjà pixelisée, une opération que le moteur ne rend jamais dans la
vraie fabrication. `style-dessin.png` (11 926 couleurs relevées) est
l'illustration détaillée dont `style-pixel.png` est *un* résultat parmi
d'autres — exactement ce que reçoit le moteur quand un artwork part en
fabrication.

**Le même moteur, au sens strict.** `_calculer` construit une `Recette` avec
une `Grille` (la taille, la méthode) et une `Quantification` (les couleurs),
puis appelle `atelier.image.traitement.appliquer` — la fonction que
`atelier/services/assets.py` appelle pour un rendu de production. Aucun
chemin parallèle, aucune approximation : un bug du moteur se voit à l'aperçu
comme il se verrait à la fabrication, et une amélioration du moteur profite
aux deux à la fois.

**Le cache, et sa péremption — la décision qui a demandé un sous-agent.**
`docs/ARCHITECTURE.md` §4 pose l'invariant dont ce cache hérite : « le schéma
de l'index n'a aucune migration — quand il change, l'index est jeté ». Un
aperçu gardé sous une clé qui ne capte pas un changement d'algorithme
répéterait exactement ce piège-là — silencieusement, puisque rien de visible
par l'auteur n'aurait changé. La clé retenue a donc deux parties qui ne
répondent pas à la même question :

- un **dossier**, qui porte ce qui rend *tout le lot* périmé d'un coup — la
  version du pipeline (`VERSION_APERCU`, à incrémenter à la main dès qu'une
  méthode de réduction, la quantification ou leur ordre change de
  comportement) et l'empreinte du fichier source (si quelqu'un remplace
  `style-dessin.png`, l'ancien dossier devient orphelin et n'est plus jamais
  lu) ;
- un **fichier**, dans ce dossier, nommé sur les trois seuls réglages qui
  distinguent deux demandes — taille, méthode, couleurs — lisible à l'œil
  (`64-vote-32.png`) plutôt que sous une empreinte, puisque rien ici ne
  voyage entre deux machines et que le dossier ouvert doit se comprendre sans
  outil.

Ce que la clé exclut délibérément : le projet ouvert (l'aperçu est toujours
le rôdeur, jamais une image de jeu — décision d'architecture du plan),
l'appelant, l'horodatage, la version de Pillow ou de numpy — une montée de
dépendance qui changerait un rendu se traite en incrémentant `VERSION_APERCU`
à la main, comme le reste.

**`pixeloe` ne se charge que sur demande.** `traitement._par_pixeloe`
importe `pixeloe.legacy.pixelize` — donc `torch` — à l'intérieur de la
fonction, jamais en tête de module ; ce service n'ajoute aucun import qui
contournerait cette paresse. Ouvrir l'étape sans cliquer « traits épaissis »
n'importe donc rien de lourd.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.recette import (
    METHODES_DE_REDUCTION,
    Grille,
    Quantification,
    Recette,
    paliers_de_couleurs,
)
from atelier.image import traitement

# Le rôdeur détaillé — voir l'en-tête du module pour pourquoi ce fichier-ci et
# pas `style-pixel.png`. Chemin relatif à la racine du dépôt : ce service vit
# dans `atelier/`, l'image dans `interface/`, et rien d'autre ne les relie.
SOURCE = (
    Path(__file__).resolve().parents[2]
    / "interface" / "public" / "vignettes" / "style-dessin.png"
)

# À incrémenter à la main dès que `_par_vote`, `_par_pixeloe`, `_par_lanczos`,
# `_reduire`, `quantifier` ou l'ordre de la queue changent de comportement —
# voir l'en-tête du module. Un changement de *réglage* (une nouvelle méthode,
# un nouveau palier) n'a pas besoin de ce cran : il se voit déjà dans le nom
# du fichier.
VERSION_APERCU = 1

# **Les neuf tailles que l'écran propose pour cette grille-là** (RT2, § plan) —
# et non les dix de `atelier.domaine.vue.TAILLES`, qui vont jusqu'à 512 pour
# les jeux déjà fabriqués : au-delà de 256, la source de 256 px serait agrandie
# plutôt que réduite, une opération que l'étape *Son allure* ne demande jamais
# et que `pixeloe` ne rend pas de façon fiable.
TAILLES_PERMISES = (8, 16, 24, 32, 48, 64, 96, 128, 256)


class ApercuRefuse(ErreurAtelier):
    """Une combinaison que le moteur ne peut pas rendre — nommée, jamais muette."""

    code = "apercu_refuse"


def _empreinte(octets: bytes) -> str:
    return hashlib.sha256(octets).hexdigest()[:8]


class ServiceApercuAllure:
    """Le rôdeur, réduit et quantifié à la demande, gardé sur le disque."""

    def __init__(self, atelier: Any) -> None:
        self.a = atelier
        self._source_octets: bytes | None = None
        self._dossier: str | None = None

    # ── La source, lue une fois ──────────────────────────────────────────────

    def _octets_source(self) -> bytes:
        if self._source_octets is None:
            self._source_octets = SOURCE.read_bytes()
        return self._source_octets

    def _dossier_courant(self) -> str:
        """`v<version>-<empreinte du rôdeur>` — voir l'en-tête du module.

        Calculé une fois : la source ne change pas pendant que l'atelier
        tourne, et relire le fichier à chaque aperçu referait, pour rien, ce
        que ce cache existe pour éviter.
        """
        if self._dossier is None:
            self._dossier = f"v{VERSION_APERCU}-{_empreinte(self._octets_source())}"
            # L'index jeté, appliqué à des fichiers (`docs/ARCHITECTURE.md`
            # §4) : tout dossier qui n'est plus le courant ne sera plus jamais
            # lu, et reste sur le disque pour rien tant qu'on ne le jette pas.
            self.a.fichiers.nettoyer_apercus_perimes(self._dossier)
        return self._dossier

    # ── Le geste ──────────────────────────────────────────────────────────────

    def apercu(self, taille: int, methode: str, couleurs: int) -> bytes:
        """L'image PNG du rôdeur réduit à `taille` par `methode`, quantifiée à
        `couleurs` couleurs. Revient du disque si déjà calculée.

        Lève `ApercuRefuse`, avec la combinaison nommée en clair, quand
        `couleurs` dépasse ce que `taille` peut porter (`paliers_de_couleurs`,
        la même règle que l'écran) ou quand `methode` n'existe pas.
        """
        if isinstance(taille, bool) or not isinstance(taille, int) or taille not in TAILLES_PERMISES:
            raise ApercuRefuse(
                f"{taille} n'est pas une taille de l'étape « Son allure » "
                f"(attendu : {', '.join(map(str, TAILLES_PERMISES))})."
            )
        if methode not in METHODES_DE_REDUCTION:
            raise ApercuRefuse(
                f"« {methode} » n'est pas une méthode de réduction connue "
                f"(attendu : {', '.join(METHODES_DE_REDUCTION)})."
            )
        permis = paliers_de_couleurs(taille)
        if isinstance(couleurs, bool) or not isinstance(couleurs, int) or couleurs not in permis:
            raise ApercuRefuse(
                f"{couleurs} couleurs ne tiennent pas sur {taille} px "
                f"(au plus {max(permis)} à cette taille)."
            )

        dossier = self._dossier_courant()
        nom = f"{taille}-{methode}-{couleurs}"
        gardee = self.a.fichiers.lire_apercu_allure(dossier, nom)
        if gardee is not None:
            return gardee

        octets = self._calculer(taille, methode, couleurs)
        self.a.fichiers.ecrire_apercu_allure(dossier, nom, octets)
        return octets

    def _calculer(self, taille: int, methode: str, couleurs: int) -> bytes:
        """Le rendu, par le moteur de la vraie fabrication — voir l'en-tête du
        module. Pas de détourage : le rôdeur est déjà une image propre, et une
        recette sans passe de détourage laisse `traitement.detourer` ne rien
        faire (`recette.passes_vives()` est vide)."""
        recette = Recette(
            grille=Grille(cible=taille, methode=methode),
            quantification=Quantification(couleurs=couleurs),
        )
        try:
            return traitement.appliquer(recette, self._octets_source()).octets
        except traitement.MoteurAbsent as absent:
            # « traits épaissis » (`pixeloe`) demande `torch` : sur une machine
            # qui ne l'a pas, c'est un refus nommé, pas une image muette ni une
            # erreur nue à 500 — même règle que le reste du produit pour un
            # moteur qui manque.
            raise ApercuRefuse(absent.args[0] if absent.args else str(absent)) from absent
