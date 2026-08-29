# -*- coding: utf-8 -*-
"""Plier — demander N images en un seul appel, et déplier ce qui revient.

**Ce service ne connaît ni personnage, ni pose, ni matrice.** C'est le piège
principal de la tranche, et il se tient par les imports : le pliage est *la
manière dont l'atelier habille ou transforme N images d'un seul appel*
(`docs/archi-versions.md` § Le pliage), pas un dispositif du lot de poses. C2 s'en
sert pour créer N corps, C3 le réemploiera tel quel pour en habiller N, et rien
ici ne changera entre les deux.

Il parle donc de **cases** — un texte à écrire dans le prompt, et une
destination que la génération porte déjà. Ce que le produit met dans ce texte
appartient à l'appelant.

**Deux gestes, séparés exprès**, comme le slicer de T5 : `plier` prépare ce qui
part — les consignes de grille et le gabarit —, `deplier` range ce qui revient.
Le premier est pur et gratuit ; le second écrit sur le disque et ne demande rien
au fournisseur. **Aucun `fournisseur` dans ce fichier**, et ça se lit dans ses
imports : déplier une planche déjà là marche réseau coupé, exactement comme la
découper.

**Le seul refus automatique du produit vit ici**, et il est arithmétique : si le
nombre d'images revenues n'est pas celui demandé, rien n'entre et le lot se
relance d'un geste. Ressemblance et dérive de grille sont mesurées à côté, elles
s'affichent, et elles n'empêchent jamais de garder.
"""

from __future__ import annotations

from typing import Sequence

import numpy as np

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import Emplacement, Generation, Statut
from atelier.domaine.pliage import CasePliee, Geometrie, MesuresLot, Pliage
from atelier.domaine.recette import BORD, Passe, Recette
from atelier.image import Boite, decouper, detourer, grille_fixe, mesurer, zones_opaques
from atelier.image.decoupe import MARGE
from atelier.image.pliage import gabarit, mesurer_lot
from atelier.services.assets import ServiceAssets
from atelier.services.bibliotheque import ServiceBibliotheque
from atelier.services.evenements import Diffusion

# Le rang à partir duquel vivent les images dépliées, dans la génération de leur
# planche. **Le même que les découpes de T5, et pour les mêmes deux raisons** :
# il est au-dessus de tout emplacement imaginable, donc la relance d'un
# emplacement ne tombera jamais sur le rang d'une image dépliée ; et le glob de
# suppression `0-*` ne mord pas sur `100-asset.json` parce que le motif exige le
# tiret (`docs/PIEGES.md`). Deux conventions de rang auraient été une de trop.
RANG_PLIAGE = 100


class CompteFaux(ErreurAtelier):
    """Le nombre d'images revenues n'est pas celui demandé.

    **Le seul refus automatique du produit** (`docs/PLAN.md`, C2), et il est
    arithmétique — c'est ce qui le rend tenable. Rien n'entre, l'appel payé reste
    au journal avec son coût (US-24), et le lot se relance d'un geste.
    """

    code = "compte_faux"


def consignes(pliage: Pliage) -> str:
    """Ce qui s'ajoute au prompt pour demander une planche plutôt qu'une image.

    **Deux consignes, une porte d'entrée**, et c'est la géométrie qui décide :
    une grille partie vide demande de *créer* N sujets (C2), une grille partie
    pleine demande de les *habiller* (C3). Le reste de la chaîne — le pliage, le
    découpeur, le compte — ne fait aucune différence entre les deux.
    """
    if pliage.geometrie_connue:
        return _habiller(pliage)
    return _creer(pliage)


def _creer(pliage: Pliage) -> str:
    """La planche de C2 : N sujets à faire naître sur une grille vide.

    **Repliées à la soumission, comme la bible de T4** : `generation.json` porte
    le prompt tel qu'il est parti, et une génération se relit des mois après sans
    avoir à reconstituer ce que l'atelier ajoutait ce jour-là. C'est aussi ce qui
    fait qu'une relance renvoie exactement le même texte.

    Le texte reprend, presque mot pour mot, celui que `essais/essai_grille.py` a
    mesuré le 28 août 2026 — compte exact 11 fois sur 12 avec gabarit, 9 sur 12
    sans. **Il est en anglais**, comme tout ce qu'un modèle lit ; la règle du
    dépôt le dit déjà pour les outils MCP, et pour la même raison.

    Ce qu'il ne dit **pas** : le style. Il vient de la bible de l'univers, repliée
    juste au-dessus, et l'écrire ici en ferait un second endroit qui décide de
    l'apparence — celui-là même que le produit refuse depuis T4.
    """
    forme = pliage.geometrie
    liste = "; ".join(
        f"{rang}. {case.texte}" for rang, case in enumerate(pliage.cases, start=1)
    )
    consigne = (
        f"Render this as a sprite sheet of {forme.cases} sprites of the SAME subject. "
        f"Exactly {forme.colonnes} columns and {forme.lignes} rows, {forme.cases} cells "
        f"total, one single sprite per cell, evenly spaced on a regular grid, every "
        f"sprite the same height, all standing on the same baseline. "
        f"The cells, in reading order, show: {liste}. "
        f"It must be the same subject in every cell: same colors, same outfit, same "
        f"proportions, same size, same style. Plain flat light gray background, no cell "
        f"borders, no grid lines, no text, no numbers, no frames, no ground shadow."
    )
    # **La consigne du gabarit dit deux choses, et la seconde est la piégeuse.**
    # Remplir les cases, oui — mais *ne pas redessiner leurs bords*. Un modèle qui
    # recopie la structure de son entrée recopiera aussi les traits qui la
    # dessinent, et une planche quadrillée de traits gris n'est pas découpable :
    # le détourage lit un fond plat sur la bordure, et les traits deviendraient
    # du sujet. Un des six modèles du 28 août l'a fait.
    return (
        f"{consigne} The attached layout image shows {forme.cases} empty cells. Draw "
        f"one sprite inside each cell, keeping the cells at their positions and sizes. "
        f"Do NOT draw the cell outlines in your image — the background must stay one "
        f"plain flat light gray, with no visible cell borders and no separating lines."
    )


def _habiller(pliage: Pliage) -> str:
    """La planche de C3 : N corps déjà là, à qui l'on ajoute une pièce.

    « La même planche, avec la pièce en plus, ne touche à rien d'autre »
    (`docs/archi-versions.md` §7). Le texte est **volontairement redondant**, et ce
    n'est pas de la superstition : `essais/essai_silhouette.py` l'a étalonné le
    28 août 2026, et la règle qu'il en tire est que **tout ce qu'on ne dit pas
    explicitement « ne change pas » est une invitation à le changer** — or chaque
    chose changée entre directement dans la mesure du corps repeint.

    Ce qu'il ne dit **pas** : ce qu'est la pièce. Ça, c'est le sujet, écrit par
    l'auteur et replié juste au-dessus avec la bible — l'écrire ici en ferait un
    second endroit qui décide de ce qu'on demande.

    Il ne nomme pas non plus les cases une par une. Le nom d'une pose n'apprend
    rien à un modèle qui a l'image sous les yeux, et le lui donner l'inviterait à
    redessiner la pose au lieu de l'habiller.
    """
    forme = pliage.geometrie
    return (
        f"The attached image is a sprite sheet of {forme.cases} sprites of the same "
        f"character, laid out in exactly {forme.colonnes} columns and {forme.lignes} "
        f"rows. Return the SAME sheet with the described item added to every sprite. "
        f"Change absolutely nothing else: the same character, the same poses, the same "
        f"proportions, the same size, the same position of each sprite in its cell, the "
        f"same viewing angles, the same colors everywhere else, the same pixel art "
        f"style, the same outline weight, the same plain flat light gray background. "
        f"Keep the exact same grid: {forme.colonnes} columns, {forme.lignes} rows, "
        f"same cell positions, same cell sizes, same overall image size. Only the item "
        f"is added. Nothing else moves, nothing else is redrawn, nothing is zoomed in "
        f"or out, no cell borders, no grid lines, no text, no numbers, no frames."
    )


def plier(cases: Sequence[CasePliee], *, geometrie_connue: bool = False) -> Pliage:
    """Un lot, à partir de ce que l'appelant veut voir revenir.

    Le pliage ne juge pas la taille : **le produit ne plafonne pas**, il annonce
    ce que ça coûte et ce qu'un compte faux coûterait, et c'est l'auteur qui
    arbitre (US-129).
    """
    return Pliage(cases=tuple(cases), geometrie_connue=geometrie_connue)


def reference(pliage: Pliage) -> bytes:
    """Le gabarit qui part avec l'appel.

    **Il ne s'enregistre nulle part.** Ce n'est ni un asset, ni une carte : il se
    redessine du geste à partir de la géométrie, à la soumission comme à la
    relance, donc les deux envoient exactement la même chose. Une image de plus
    sur le disque serait une image de plus à ranger, à montrer et à supprimer,
    pour quelque chose que personne ne regarde jamais.
    """
    return gabarit(pliage.geometrie)


class ServicePliage:
    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        assets: ServiceAssets,
        bibliotheque: ServiceBibliotheque,
        diffusion: Diffusion | None = None,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._assets = assets
        self._bibliotheque = bibliotheque
        self._diffusion = diffusion or Diffusion()

    # ── Déplier ──────────────────────────────────────────────────────────────

    def decouper_retour(
        self, generation: Generation, emplacement: Emplacement
    ) -> tuple[list[bytes], list[MesuresLot]]:
        """La planche revenue, coupée en N images — **et le seul refus du produit**.

        Écrite à part parce que **les deux usages du pliage la partagent** : C2
        en fait des corps, C3 en fait des calques, et aucun des deux ne redécoupe
        de son côté. C'est ce que `docs/PLAN.md` demande en toutes lettres — « la
        construire à côté serait un doublon de la grille, du gabarit et du
        découpeur ».

        Lève `CompteFaux` si le nombre d'images trouvées n'est pas celui demandé.
        **Rien n'est écrit avant que le compte soit vérifié**, ici comme chez ses
        deux appelants : « aucune image n'entre » est vrai au pied de la lettre,
        et pas rattrapé après coup par une suppression qui pourrait échouer à
        moitié.

        Les mesures de lot partent avec les morceaux. Elles ne veulent pas dire
        la même chose des deux côtés — la ressemblance entre deux corps d'un même
        lot dit qu'une pose a été répétée, celle entre deux cases d'une planche
        d'équipement dit que deux poses se ressemblaient déjà — mais elles se
        calculent pareil, et **elles ne refusent ni ici ni là**.
        """
        pliage = generation.pliage
        if pliage is None or emplacement.resultat is None:  # pragma: no cover
            return [], []

        octets = self._fichiers.lire(emplacement.resultat.fichier)
        rgba = detourer(Recette(passes=(Passe(moteur=BORD),)), octets)
        boites = self._boites(pliage, rgba)

        if len(boites) != pliage.nombre:
            raise CompteFaux(_compte(len(boites), pliage.nombre))

        # **Pas de marge sur une grille connue.** La marge existe pour les
        # boîtes serrées de C2, trouvées sur les taches opaques : elle leur rend
        # l'air que le détourage leur a retiré. Sur une grille posée par
        # l'atelier, chaque boîte est déjà la case entière, et l'élargir la
        # ferait mordre sur sa voisine — le calque de la pose 1 porterait un bout
        # de la pose 2.
        marge = 0 if pliage.geometrie_connue else MARGE
        return decouper(octets, boites, marge=marge), mesurer_lot(rgba, boites)

    def deplier(
        self, generation: Generation, emplacement: Emplacement
    ) -> list[Asset]:
        """La planche revenue devient N images séparées (US-130).

        **Aucun geste de découpe n'est demandé à l'auteur** : on ne découpe
        jamais à la main ce qu'on a demandé plié. C'est la différence entre ce
        geste-ci et le slicer de T5, qui propose et laisse corriger — là, la
        planche est arrivée parce que le produit l'a demandée, et il sait
        combien d'images elle doit contenir.

        Lève `CompteFaux` si elle n'en contient pas ce nombre-là. **Rien n'est
        écrit avant que le compte soit vérifié** : « aucune image n'entre dans
        le plan » est vrai au pied de la lettre, et pas rattrapé après coup par
        une suppression qui pourrait échouer à moitié.
        """
        pliage = generation.pliage
        if pliage is None or emplacement.resultat is None:  # pragma: no cover
            return []

        morceaux, mesures = self.decouper_retour(generation, emplacement)
        rang = self.premier_rang_libre(generation)
        nees: list[Asset] = []
        for index, (case, image) in enumerate(zip(pliage.cases, morceaux)):
            nees.append(
                self._accueillir(generation, case, image, rang + index, mesures[index])
            )

        # L'arbre compte les assets par projet : N de plus changent ces comptes,
        # et personne d'autre ne les recalcule. Une fois, à la fin.
        self._diffusion.publier("bibliotheque", self._bibliotheque.arbre())
        return nees

    def deplie(self, generation: Generation) -> bool:
        """Ce lot a-t-il déjà rendu ses images ?

        Lue sur les **rangs de la génération**, jamais sur un drapeau : un
        drapeau serait une seconde vérité, et c'est le disque qui fait foi. Un
        lot refusé sur le compte n'a écrit aucun rang, donc il répond non — et
        c'est exact, il attend une relance.
        """
        return any(
            rang >= RANG_PLIAGE for rang in self._base.rangs_de_generation(
                generation.identifiant
            )
        )

    def reprendre(self, generations: Sequence[Generation]) -> int:
        """Les lots dont la planche est arrivée mais qui n'ont pas été dépliés.

        **Déplier n'est pas relancer.** C'est gratuit, local, et ça n'appelle
        personne : rien ici ne touche le fournisseur, et un lot coupé *en vol*
        n'est pas concerné — celui-là est marqué interrompu par
        `ServiceGenerations.reprendre` et attend un geste, comme depuis T1.
        Celui-ci a été **payé et reçu** ; le laisser sur le disque sans le ranger
        ferait payer une seconde fois ce qui est déjà là (US-132).

        Un compte faux au redémarrage se comporte comme un compte faux à
        l'arrivée : l'emplacement passe en échec avec sa raison, et rien n'entre.
        """
        repris = 0
        for generation in generations:
            if generation.pliage is None or self.deplie(generation):
                continue
            for emplacement in generation.emplacements:
                if emplacement.resultat is None:
                    continue
                if not self._fichiers.existe(emplacement.resultat.fichier):
                    continue
                try:
                    self.deplier(generation, emplacement)
                except CompteFaux as refus:
                    generation.pliage.refus = refus.raison
                    emplacement.statut = Statut.ECHOUEE
                    emplacement.raison = refus.raison
                repris += 1
        return repris

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _boites(self, pliage: Pliage, rgba: np.ndarray) -> list[Boite]:
        """Où couper le retour, et les deux façons de le savoir.

        **Grille inconnue** — le lot de poses de C2. La planche est partie vide,
        l'atelier ne sait pas ce qui va revenir : il cherche les taches opaques,
        dans l'ordre où l'œil les lit. C'est le même détecteur que le slicer, et
        le même ordre de lecture par bandes — pas un tri sur `y0`, qui
        entrelacerait deux rangées dès qu'un sprite est posé trois pixels plus
        haut que son voisin.

        **Grille connue** — la planche d'équipement de C3. L'atelier a composé
        la planche lui-même, donc il redécoupe sur la grille exacte qu'il a
        posée, et la comparaison case par case part d'une base connue au lieu
        d'être devinée. Le compte est alors juste par construction, ce qui ne
        rend pas la vérification inutile : elle ne coûte rien et elle dit la
        même phrase des deux côtés.
        """
        if pliage.geometrie_connue:
            forme: Geometrie = pliage.geometrie
            hauteur, largeur = rgba.shape[:2]
            cases = grille_fixe(largeur, hauteur, forme.colonnes, forme.lignes)
            return cases[: forme.cases]
        return zones_opaques(rgba[:, :, 3])

    def _accueillir(
        self,
        generation: Generation,
        case: CasePliee,
        octets: bytes,
        rang: int,
        mesures: MesuresLot,
    ) -> Asset:
        mesure = mesurer(octets)
        chemin = self._fichiers.ecrire_brut(generation.identifiant, rang, octets, ".png")
        return self._assets.accueillir(
            Asset(
                identifiant=identifiant_de(generation.identifiant, rang),
                generation=generation.identifiant,
                rang=rang,
                brut=chemin,
                largeur=mesure.largeur,
                hauteur=mesure.hauteur,
                type_media=mesure.type_media,
                label=_label(case),
                recette=self._assets.recette_du_projet(generation),
                # **Une image dépliée n'a rien coûté seule.** L'argent a été
                # dépensé une fois, pour l'appel, et le journal du projet le
                # porte. Lui attribuer une part du prix inventerait un chiffre
                # que personne n'a facturé — et le total du projet, qui se
                # calcule sur les générations, dirait alors autre chose que la
                # somme des tuiles. Même règle que les découpes de T5.
                cout_usd=0.0,
                provenance=generation.provenance,
                modele=generation.modele,
                projet=generation.projet,
                # **La case que ce sujet-là remplit** (US-128). C'est le pliage
                # qui la connaît, et lui seul : la génération vise un lot, pas
                # une case. Un corps entre donc dans sa ligne de matrice sans
                # que personne ait à l'y ranger, exactement comme une image de
                # C1 tombait dans la sienne.
                personnage=generation.personnage,
                pose=case.pose,
                lot=mesures,
                # **Datée du lot**, comme les variations d'un même appel : les N
                # images sont arrivées ensemble, et le rang les départage dans
                # l'ordre de lecture de la planche.
                cree_le=generation.cree_le,
            )
        )

    def premier_rang_libre(self, generation: Generation) -> int:
        """Le rang de la prochaine image dépliée.

        **Publique parce que les deux usages du pliage la partagent** : C3 range
        ses calques dans le dossier de la planche qui les a payés, aux mêmes
        rangs et pour les mêmes deux raisons.

        Pris au-dessus de **tout** ce que la génération connaît déjà, ses
        emplacements comme ses dépliages précédents : deux assets d'un même rang
        partageraient leurs fichiers `<rang>-brut` et `<rang>-asset.json`, et le
        second effacerait le premier sans rien dire.
        """
        pris = self._base.rangs_de_generation(generation.identifiant)
        pris += [e.rang for e in generation.emplacements]
        return max([RANG_PLIAGE - 1, *pris]) + 1


def _compte(trouvees: int, demandees: int) -> str:
    """La raison d'un compte faux, écrite pour quelqu'un qui va décider.

    Elle dit les deux nombres et ce qui en découle — pas « échec de découpe »,
    qui ne se répète à personne. C'est la même règle que les refus du MCP :
    **une raison se répète à l'auteur**, donc elle est en français et elle est
    entière.
    """
    return (
        f"{trouvees} image{'s' if trouvees > 1 else ''} pour {demandees} demandées — "
        f"le lot entier est refusé, rien n'est entré, et il se relance au prix plein"
    )


def _label(case: CasePliee) -> str:
    """Le texte de la case, et rien d'autre.

    **Pas le début du prompt**, qui est ce que fait `naitre` pour une image
    ordinaire : le prompt d'un lot est le même pour ses N images — c'est le
    sujet — et neuf vignettes portant toutes le même début de phrase seraient
    neuf vignettes indiscernables dans la grille. Le texte de la case est
    exactement ce qui les distingue, et c'est le mot que l'auteur cherchera.
    """
    propre = case.texte.strip()
    return propre[:60] if propre else "sans titre"
