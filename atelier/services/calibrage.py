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
from atelier.domaine.recette import (
    BAS,
    Grille,
    cote_du_canevas,
    cote_du_sujet,
    occupation_max,
)
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
                    # La plus haute que cette pose puisse atteindre : posée
                    # après la boucle, parce qu'elle dépend de l'échelle
                    # déclarée par l'ensemble des poses.
                    "plafond": 0,
                    # **Ce que le calibrage écrirait, et ce que ça donnerait**
                    # (R9) : posés eux aussi après la boucle, parce qu'ils
                    # dépendent de la hauteur commune, qui dépend de toutes les
                    # poses. Voir `_visee`.
                    "visee": 0,
                    "apres": 0,
                    # **Par le haut, par le bas ou au milieu** : l'écran de R9
                    # montre l'empilement d'après en agrandissant chaque
                    # silhouette autour de son point d'ancrage, et l'agrandir
                    # autour du mauvais point la ferait flotter.
                    "ancrage": grille.ancrage if grille else BAS,
                    "de_cote": case["pose"] in vise.hors_calibrage,
                }
            )

        # **Le calibrage aligne, il ne redimensionne pas** (tranche des tailles,
        # 3 septembre 2026). Depuis que l'occupation peut passer 100 %, un géant
        # déclaré à 300 % a des poses qui rendent trois fois la case ; un plafond
        # calculé à 100 % proposerait de toutes les rapetisser, et l'outil censé
        # les accorder leur ferait perdre l'échelle que l'auteur a posée. Le
        # plafond suit donc **la plus haute occupation en usage** parmi les poses,
        # jamais moins de 100 % : sur un personnage ordinaire — toutes ses poses
        # à 100 % —, c'est exactement le calcul d'avant, au carré près.
        haute = max((int(p["occupation"]) for p in poses), default=100)
        for p in poses:
            p["plafond"] = self._plafond(
                p["boite"]["largeur"], p["boite"]["hauteur"], cible, haute
            )

        retenues = [p for p in poses if not p["de_cote"]]
        commune = min((p["plafond"] for p in retenues), default=0)
        limite = next(
            (p["pose"] for p in retenues if p["plafond"] == commune), ""
        )

        # **Ce que le bouton ferait, pose par pose** (R9). L'écran montre
        # l'empilement d'aujourd'hui *et* celui d'après, côte à côte, avant
        # qu'on ait touché à quoi que ce soit ; il lui faut donc, pour chaque
        # pose, l'occupation que le calibrage écrirait et la hauteur qu'elle
        # rendrait alors.
        #
        # **Le client ne peut pas le recalculer, et c'est pour ça que ça sort
        # d'ici** : `_occupation` borne à l'échelle déclarée par l'ensemble, et
        # `_poser` la borne une seconde fois — deux bornes qu'il faudrait
        # recopier à l'écran, où elles divergeraient. C'est la règle de R7
        # appliquée à un chiffre : ce qui est montré passe par le chemin que
        # l'écriture emprunte.
        #
        # **Une pose mise de côté ne bouge pas** : son après est son
        # aujourd'hui. Sortir du calage commun n'est pas disparaître.
        for p in poses:
            if p["de_cote"] or not commune:
                p["visee"] = int(p["occupation"])
                p["apres"] = int(p["rendue"])
                continue
            p["visee"] = self._visee(
                p["boite"]["largeur"], p["boite"]["hauteur"], cible, commune, haute
            )
            p["apres"] = self._rendue(
                p["boite"]["largeur"], p["boite"]["hauteur"], cible, p["visee"]
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
            #
            # **Comparé au côté réel de la case, pas à celui du projet** : sur un
            # géant à 300 %, la case fait trois fois la cible, et retrancher la
            # cible annoncerait une perte de zéro là où il y en a une.
            "perdus": max(0, cote_du_canevas(cible, haute) - commune),
            # **L'échelle à laquelle ce personnage-ci se calibre.** Elle sort
            # d'ici pour que `calibrer` n'ait pas à la recalculer : deux endroits
            # qui décident du plafond finiraient par ne plus dire le même.
            "haute": haute,
            # **Combien de poses le bouton changerait vraiment** (R9), et c'est
            # la seule chose qui décide s'il s'allume. Il restait allumé sur une
            # chose déjà calibrée, invitant à un geste qui ne change rien —
            # « on ne propose jamais puis on ne refuse », et l'écran
            # n'appliquait simplement pas la règle ici.
            #
            # **Compté sur l'occupation écrite, pas sur la hauteur rendue**, et
            # c'est le sens littéral de « les poses qu'il touche » : une pose
            # dont l'occupation change est une pose que le bouton réécrit. Le
            # compter sur la hauteur dirait *rien à faire* là où le disque
            # change quand même — deux occupations voisines rendent parfois la
            # même hauteur à l'arrondi près.
            "a_faire": sum(
                1
                for p in poses
                if not p["de_cote"] and p["visee"] != int(p["occupation"])
            ),
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
            # **La valeur écrite est celle qui a été montrée**, au chiffre près :
            # `visee` est posée par `calibrage`, et c'est elle qu'on écrit. Un
            # second calcul ici aurait rouvert l'écart que R9 vient de fermer —
            # l'écran annonçait une hauteur, le disque en recevait une autre.
            self._poser(pose["asset"], occupation=pose["visee"])
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
    def _plafond(largeur: int, hauteur: int, cible: int, haute: int = 100) -> int:
        """La plus haute que cette pose puisse atteindre **sans sortir de sa
        case**.

        À occupation 100 %, le plus grand côté de la boîte touche la case ; la
        hauteur vaut alors `cible × hauteur / max(largeur, hauteur)`. Un sujet
        plus large que haut plafonne donc en dessous de la case, et c'est très
        exactement le défaut qu'on répare.

        **`haute` est l'échelle déclarée par l'ensemble des poses**, en pour cent,
        depuis que l'occupation peut dépasser 100 % : la case d'un géant à 300 %
        fait trois fois celle d'un personnage, et son plafond avec.
        """
        dedans = cote_du_sujet(cible, max(100, haute))
        return max(1, round(dedans * hauteur / max(1, max(largeur, hauteur))))

    @staticmethod
    def _rendue(largeur: int, hauteur: int, cible: int, occupation: int) -> int:
        """La hauteur que cette pose rend aujourd'hui, avec son occupation.

        **Le même calcul que `sur_grille`**, et pas un autre : deux formules
        auraient fini par annoncer une hauteur et en produire une seconde. C'est
        pour cela que les deux côtés viennent maintenant du domaine — la copie
        locale portait le plafond de 100 % que la tranche des tailles a levé.
        """
        dedans = cote_du_sujet(cible, occupation)
        cote = cote_du_canevas(cible, occupation)
        facteur = dedans / max(1, max(largeur, hauteur))
        return max(1, min(cote, round(hauteur * facteur)))

    @staticmethod
    def _occupation(
        largeur: int, hauteur: int, cible: int, commune: int, haute: int = 100
    ) -> int:
        """L'occupation à poser pour que cette pose rende `commune` pixels de
        haut. C'est l'inverse de `_rendue`, et rien d'autre.

        **Le plafond est l'échelle déclarée, pas le plafond absolu de la case**,
        et la nuance a été payée : l'inverse d'un arrondi dépasse volontiers d'un
        pour cent — la pose d'attaque du vrai projet, 523 × 430 dans une case de
        64, rend sa hauteur commune à 100,7 %. Sans borne, le calibrage d'un
        personnage ordinaire l'écrivait donc à 101 %, et ses images sortaient en
        65 carrés au lieu de 64 : un demi-pixel d'arrondi faisait sortir tout le
        monde de la case. Borné à `haute` — 100 % pour un personnage, 300 % pour
        un géant déclaré tel —, le calcul rend exactement ce qu'il rendait avant
        la tranche, et suit l'échelle quand elle a été posée.
        """
        dedans = commune * max(1, max(largeur, hauteur)) / max(1, hauteur)
        haut = min(max(100, haute), occupation_max(cible))
        return max(1, min(haut, round(dedans / max(1, cible) * 100)))

    @classmethod
    def _visee(
        cls, largeur: int, hauteur: int, cible: int, commune: int, haute: int
    ) -> int:
        """**L'occupation que le calibrage écrirait sur cette pose** — exactement.

        C'est `_occupation` passée par la borne que `_poser` applique en
        écrivant. Les deux existaient déjà et ne bornaient pas pareil ; tant que
        la valeur ne sortait pas du service, l'écart ne se voyait pas. Depuis que
        `calibrage` montre l'empilement d'après (R9), il se verrait — l'écran
        dessinerait une hauteur et le disque en recevrait une autre.

        **Un seul endroit décide donc**, et `calibrer` écrit ce que `calibrage`
        a montré. C'est la règle de R7 — *ce qui est montré passe par le chemin
        que l'écriture emprunte* — appliquée à un chiffre.

        ⚠️ **La borne à 100 % n'est pas la bonne, et R9 ne la corrige pas.**
        `_occupation` borne à l'échelle déclarée par l'ensemble (jusqu'à 300 %
        pour un géant), `_poser` borne à 100 % : un géant déclaré tel voit donc
        son calibrage écrasé. Le défaut est antérieur à cette tranche, et le
        réparer changerait ce que l'outil écrit — ce que le dernier critère de
        `R9` interdit. Il est consigné dans `docs/PIEGES.md`, et l'écran le
        **montre** au lieu de le cacher : l'empilement d'après dessine la hauteur
        vraiment obtenue, pas la hauteur commune visée.
        """
        return max(1, min(100, cls._occupation(largeur, hauteur, cible, commune, haute)))

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
