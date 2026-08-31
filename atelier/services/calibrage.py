# -*- coding: utf-8 -*-
"""Le calibrage — toutes les poses d'une chose à la même hauteur (E17).

**Le défaut, mesuré le 30 août 2026 sur les images réelles du dépôt.** Les six
poses d'un même personnage sortent à 64, 60, 64, 53, 64 et 43 pixels de haut.
Dans le jeu, il rapetisse au moment où il frappe, puis reprend sa taille. Rien ne
le disait, et six vignettes côte à côte ne le montrent pas — six silhouettes
empilées, si.

**Pourquoi ça arrive.** La mise sur grille rétrécit le sujet jusqu'à ce que le
plus grand côté de sa **boîte** atteigne la case. Un bras tendu rend la boîte
plus large sans rendre le personnage plus grand : c'est alors la largeur qui
touche la case, et la hauteur tombe en dessous.

**Il n'existe pas de repère automatique fiable, et c'est ce qui donne sa forme à
l'outil.** Quatre façons de calculer une taille commune ont été comparées : le
plus grand côté est ce qu'on fait déjà et laisse la hauteur varier ; la hauteur
de la boîte la rend constante mais fait sortir quatre poses sur six de la case ;
la racine de l'aire opaque dépend de la qualité du détourage — la marche ne
remplit que 20 % de sa boîte contre 75 % pour le repos ; la bande centrale donne
exactement le même résultat que la hauteur de boîte, pour une formule de plus.
**L'outil propose donc, il ne décide pas**, et la reprise à la main est la moitié
du travail, pas un rattrapage.

**Il n'écrit presque rien.** Le calage est une **occupation** — un réglage qui
existe déjà, déjà exprimé en part de la case. C'est ce qui le rend gratuit à
changer de taille de case : passer de 64 à 128 ne défait aucun calibrage, parce
qu'une part n'est pas un nombre de pixels. La seule chose que la V2.1 ajoute à la
recette d'une image est le **décalage horizontal**, et il est écrit ici.

**Et il ne coûte rien.** Aucun appel payant, aucune image neuve : il change le
rendu de poses qui existent déjà, et un rendu est un cache — on recalcule, on ne
repaie pas.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Any

from atelier.domaine.asset import Asset
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.recette import Grille
from atelier.image.traitement import boite_opaque, detourer

# **Ce qui fait qu'une pose est « très en dehors des autres »** — un dixième.
#
# Ce n'est pas un seuil de confort : c'est la part de hauteur que la garder
# coûterait **à toutes les autres**. Sur le vrai projet, garder la mort ramène la
# hauteur commune de 53 à 43 pixels, soit **un cinquième** de perdu pour tout le
# monde ; la pose suivante, l'attaque, en coûterait un huitième et n'est pas
# proposée à l'écart — c'est elle qui limite, et limiter n'est pas s'écarter.
#
# **Une seule pose est proposée, jamais une cascade.** Écarter la plus basse fait
# de la suivante la plus basse ; reproposer à chaque fois finirait par ne garder
# qu'une pose, et l'outil aurait décidé à la place de l'auteur ce qu'il prétend
# seulement proposer.
ECART_PROPOSE = 0.10


class CalibrageRefuse(ErreurAtelier):
    """Ce qu'on demande au calibrage et qu'il ne peut pas faire."""


class ServiceCalibrage:
    """Ce que les poses d'une chose mesurent, et ce qu'on leur pose.

    **Il ne travaille que sur les corps.** Un calque est solidaire de la pose sur
    laquelle il est apparu : le recaler séparément le décollerait du corps qu'il
    habille, ce qui est très exactement ce que C3 a passé une tranche à éviter.
    """

    def __init__(self, base, assets, production) -> None:
        self._base = base
        self._assets = assets
        self._production = production

    # ── Ce qu'on mesure ──────────────────────────────────────────────────────

    def calibrage(self, projet: str, personnage: str) -> dict[str, Any]:
        """Toutes les poses d'une chose, leur boîte, et ce qu'on propose.

        **La boîte se mesure après le détourage et avant la case**, parce que
        c'est très exactement celle que la mise sur grille regarde. La mesurer
        sur le brut donnerait la boîte de l'image reçue, fond compris, et la
        mesurer sur le rendu donnerait celle de la case, qui est carrée.
        """
        vise = self._production.personnage(projet, personnage)
        cible = self._cible(projet)

        poses: list[dict[str, Any]] = []
        for case in self._production.cases(projet, vise):
            asset = self._corps(case)
            if asset is None:
                continue
            boite = self._boite(asset)
            if boite is None:
                continue
            largeur, hauteur = boite
            grille = asset.recette.grille
            poses.append(
                {
                    "pose": case["pose"],
                    "asset": asset.identifiant,
                    # La boîte du sujet, telle que la case la regarde.
                    "boite": {"largeur": largeur, "hauteur": hauteur},
                    "occupation": grille.occupation if grille else 100,
                    "decalage": grille.decalage if grille else 0,
                    # **L'empreinte de la recette**, pour que l'écran cherche
                    # une image neuve après chaque cran : le rendu change sous
                    # la même adresse, et sans elle on réglerait l'occupation en
                    # regardant l'image d'avant.
                    "empreinte": asset.recette.empreinte(),
                    # **Ce qu'on obtient**, à côté de ce qu'on écrit : le
                    # pourcentage est le réglage, les pixels sont le résultat, et
                    # les deux ne disent pas la même chose — un pourcentage seul
                    # ment aux petites cases.
                    "rendue": self._rendue(
                        largeur, hauteur, cible, grille.occupation if grille else 100
                    ),
                    # La plus haute que cette pose puisse atteindre sans sortir
                    # de sa case : c'est elle qui décide de la commune.
                    "plafond": self._plafond(largeur, hauteur, cible),
                    "de_cote": case["pose"] in vise.hors_calibrage,
                }
            )

        retenues = [p for p in poses if not p["de_cote"]]
        commune = min((p["plafond"] for p in retenues), default=0)
        limite = next(
            (p["pose"] for p in retenues if p["plafond"] == commune), ""
        )
        return {
            "personnage": vise.identifiant,
            "cible": cible,
            "poses": poses,
            "commune": commune,
            "limite": limite,
            # **Ce que la cohérence coûte, en clair.** Onze pixels de la case ne
            # servent pas ; c'est un sixième de résolution en moins, et c'est le
            # prix qu'on paie pour que le personnage ne rapetisse pas en
            # frappant. Le produit le dit, il ne le cache pas.
            "perdus": max(0, cible - commune),
            "de_cote": self._a_mettre_de_cote(poses),
        }

    def calibrer(self, projet: str, personnage: str) -> dict[str, Any]:
        """Poser la hauteur commune sur toutes les poses retenues.

        **Ce n'est qu'un point de départ.** Chaque pose se règle ensuite seule,
        avec le résultat sous les yeux : l'outil propose, il ne tranche pas, et
        rien ici n'empêche de reprendre.
        """
        lu = self.calibrage(projet, personnage)
        if not lu["commune"]:
            raise CalibrageRefuse(
                "aucune pose de cette chose n'a de corps à calibrer"
            )
        for pose in lu["poses"]:
            if pose["de_cote"]:
                continue
            self._poser(
                pose["asset"],
                occupation=self._occupation(
                    pose["boite"]["largeur"],
                    pose["boite"]["hauteur"],
                    lu["cible"],
                    lu["commune"],
                ),
            )
        return self.calibrage(projet, personnage)

    def regler(
        self,
        projet: str,
        personnage: str,
        pose: str,
        *,
        occupation: int | None = None,
        decalage: int | None = None,
    ) -> dict[str, Any]:
        """La reprise à la main, pose par pose. `None` ne touche pas."""
        lu = self.calibrage(projet, personnage)
        trouvee = next((p for p in lu["poses"] if p["pose"] == pose), None)
        if trouvee is None:
            raise CalibrageRefuse(
                f"« {pose} » n'a pas de corps à calibrer sur cette chose"
            )
        self._poser(trouvee["asset"], occupation=occupation, decalage=decalage)
        return self.calibrage(projet, personnage)

    def mettre_de_cote(
        self, projet: str, personnage: str, pose: str, de_cote: bool
    ) -> dict[str, Any]:
        """Sortir une pose du calage commun, ou l'y faire rentrer.

        **Sa case existe toujours** : elle se remplit, elle se compte, elle part
        au jeu. Seul le calage commun l'ignore — c'est un fait sur sa silhouette,
        pas un rangement.
        """
        vise = self._production.personnage(projet, personnage)
        de_cotes = set(vise.hors_calibrage)
        if de_cote:
            de_cotes.add(pose)
        else:
            de_cotes.discard(pose)
        self._production.poser_hors_calibrage(projet, personnage, tuple(sorted(de_cotes)))
        return self.calibrage(projet, personnage)

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _cible(self, projet: str) -> int:
        """La taille de case du projet. **Zéro n'est pas une case** : un jeu qui
        ne contraint pas l'échelle n'a rien à calibrer, et le dire vaut mieux que
        de calculer sur une division par zéro."""
        univers = self._production._exiger(projet).univers
        if not univers.cible_px:
            raise CalibrageRefuse(
                "ce jeu n'impose aucune taille de case — il n'y a pas de "
                "hauteur commune à poser"
            )
        return univers.cible_px

    @staticmethod
    def _corps(case: dict[str, Any]) -> Asset | None:
        """Le corps retenu de cette case, en objet.

        **La même règle qu'à la composition**, et c'est voulu : le favori
        d'abord, sinon la plus récente. Une seconde règle aurait montré une
        silhouette et calibré l'autre.
        """
        retenu = case.get("corps")
        if not retenu:
            return None
        for image in case["images"]:
            if image["identifiant"] == retenu:
                return Asset.depuis_json(image)
        return None

    def _boite(self, asset: Asset) -> tuple[int, int] | None:
        """La boîte opaque du sujet, **après détourage, avant la case**.

        Le détourage seul est relu : c'est lui qui coûte — 130 ms contre 28 pour
        les cinq étapes suivantes — et c'est le seul dont la boîte dépende.
        """
        try:
            octets, _ = self._assets.octets(asset, brut=True)
        except ErreurAtelier:  # pragma: no cover — image disparue du disque
            return None
        rgba = detourer(asset.recette, octets)
        boite = boite_opaque(rgba[:, :, 3])
        if boite is None:
            return None
        x0, y0, x1, y1 = boite
        return x1 - x0 + 1, y1 - y0 + 1

    @staticmethod
    def _plafond(largeur: int, hauteur: int, cible: int) -> int:
        """La plus haute que cette pose puisse atteindre **sans sortir de sa
        case**.

        À occupation 100 %, le plus grand côté de la boîte touche la case ; la
        hauteur vaut alors `cible × hauteur / max(largeur, hauteur)`. Un sujet
        plus large que haut plafonne donc en dessous de la case, et c'est très
        exactement le défaut qu'on répare.
        """
        return max(1, round(cible * hauteur / max(1, max(largeur, hauteur))))

    @staticmethod
    def _rendue(largeur: int, hauteur: int, cible: int, occupation: int) -> int:
        """La hauteur que cette pose rend aujourd'hui, avec son occupation.

        **Le même calcul que `sur_grille`**, et pas un autre : deux formules
        auraient fini par annoncer une hauteur et en produire une seconde.
        """
        dedans = max(1, round(cible * max(1, min(100, occupation)) / 100))
        facteur = dedans / max(1, max(largeur, hauteur))
        return max(1, min(cible, round(hauteur * facteur)))

    @staticmethod
    def _occupation(largeur: int, hauteur: int, cible: int, commune: int) -> int:
        """L'occupation à poser pour que cette pose rende `commune` pixels de
        haut. C'est l'inverse de `_rendue`, et rien d'autre."""
        dedans = commune * max(1, max(largeur, hauteur)) / max(1, hauteur)
        return max(1, min(100, round(dedans / cible * 100)))

    @staticmethod
    def _a_mettre_de_cote(poses: list[dict[str, Any]]) -> str:
        """La pose que l'outil **propose** de mettre de côté, ou rien.

        Celle qui plafonne le plus bas, et seulement si elle plafonne plus d'un
        dixième en dessous de la suivante : c'est la part de hauteur que la
        garder coûterait à toutes les autres. Une seule, jamais une cascade.
        """
        # **Une décision prise arrête la proposition.** Écarter la plus basse
        # fait de la suivante la plus basse ; reproposer alors finirait par ne
        # garder qu'une pose, et l'outil aurait décidé à la place de l'auteur ce
        # qu'il prétend seulement proposer.
        if any(p["de_cote"] for p in poses):
            return ""
        retenues = sorted(poses, key=lambda p: p["plafond"])
        if len(retenues) < 2:
            return ""
        plus_basse, suivante = retenues[0], retenues[1]
        if not suivante["plafond"]:
            return ""  # pragma: no cover — une hauteur nulle n'existe pas
        manque = (suivante["plafond"] - plus_basse["plafond"]) / suivante["plafond"]
        return plus_basse["pose"] if manque > ECART_PROPOSE else ""

    def _poser(
        self,
        asset: str,
        *,
        occupation: int | None = None,
        decalage: int | None = None,
    ) -> None:
        """Écrire la grille d'une image, **sans l'épingler**.

        Le calibrage n'est pas une main posée sur une recette : c'est un calage
        que le projet impose à toutes les poses d'une chose, et l'épingler
        exclurait ces images du prochain réalignement de palette. Même décision
        que le balayage rétroactif de T4, pour la même raison.
        """
        objet = self._assets.lire(asset)
        if objet is None:  # pragma: no cover — l'image vient d'être lue
            return
        grille = objet.recette.grille or Grille()
        objet.recette = replace(
            objet.recette,
            grille=replace(
                grille,
                occupation=(
                    grille.occupation
                    if occupation is None
                    else max(1, min(100, occupation))
                ),
                decalage=grille.decalage if decalage is None else decalage,
            ),
        )
        self._assets.sauver(objet)
