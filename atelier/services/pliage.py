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

**Le seul refus automatique du produit vit ici**, et il est arithmétique : s'il
revient **moins** d'images que demandé, rien n'entre et le lot se relance d'un
geste. Ressemblance et dérive de grille sont mesurées à côté, elles s'affichent,
et elles n'empêchent jamais de garder.

**Ce qui revient en trop, en revanche, ne se jette plus** (R6, US-367). La règle
« seul le compte refuse » a été écrite pour un lot de poses, où une case en trop
n'a pas de sens ; sur une planche de personnage, c'est le régime normal — quatre
planches sur treize du banc d'animation, trente-et-un pour cent des appels payés
jetés pour un sujet de trop. Une planche qui en rend neuf pour huit s'ouvre
donc, avec ses sujets mesurés, et l'auteur écarte ce qu'il ne veut pas.

Et le même geste répare un défaut plus grave parce qu'il ne se voyait pas
(US-368) : quand un modèle redessine les traits du quadrillage, les cases bordées
font des taches opaques, le compte tombe juste, et l'atelier faisait entrer des
carrés pleins sans un mot. Ils sont mesurés maintenant, et ils arrêtent la
planche de la même façon — **jamais un refus, toujours un regard**.
"""

from __future__ import annotations

import time
from typing import Sequence

import numpy as np

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import Emplacement, Generation, Statut
from atelier.domaine.planche import asset_de_planche
from atelier.domaine.pliage import (
    AUTO,
    MAIN,
    CasePliee,
    Depliage,
    Geometrie,
    MesuresLot,
    Pliage,
)
from atelier.domaine.recette import BORD, Passe, Recette
from atelier.image import Boite, decouper, detourer, grille_fixe, mesurer, zones_opaques
from atelier.image.decoupe import MARGE
from atelier.image.pliage import gabarit, mesurer_lot
from atelier.services.assets import ServiceAssets
from atelier.services.bibliotheque import ServiceBibliotheque
from atelier.services.evenements import Diffusion
from atelier.services.rangs import rang_libre

# Le rang à partir duquel vivent les images dépliées, dans la génération de leur
# planche. **Le même que les découpes de T5, et pour les mêmes deux raisons** :
# il est au-dessus de tout emplacement imaginable, donc la relance d'un
# emplacement ne tombera jamais sur le rang d'une image dépliée ; et le glob de
# suppression `0-*` ne mord pas sur `100-asset.json` parce que le motif exige le
# tiret (`docs/PIEGES.md`). Deux conventions de rang auraient été une de trop.
RANG_PLIAGE = 100


class CompteFaux(ErreurAtelier):
    """Il revient **moins** d'images que demandé.

    **Le seul refus automatique du produit** (`docs/archive/plan-versions-tenues.md`, C2), et il est
    arithmétique — c'est ce qui le rend tenable. Rien n'entre, l'appel payé reste
    au journal avec son coût (US-24), et le lot se relance d'un geste.

    **Il ne se lève plus sur un surplus depuis R6.** Sept images pour huit reste
    un refus, et pour une raison qui tient en une phrase : il manque une étape à
    l'animation, et aucun choix de l'auteur ne la fabriquera. Neuf pour huit, en
    revanche, contient tout ce qui a été demandé — jeter l'appel entier pour ce
    qu'il a en trop était la perte que R6 répare.
    """

    code = "compte_faux"


class ChoixAttendu(ErreurAtelier):
    """La planche est arrivée, quelque chose cloche, et personne n'a tranché.

    **Ce n'est pas un échec, et c'est tout l'intérêt** (R6). L'appel a été payé,
    la planche est sur le disque, elle est complète : l'emplacement reste réussi,
    rien ne se relance, et rien ne se repaie. Ce qui manque est un regard —
    quels sujets garder, parmi ceux que la planche porte.

    Elle se lève à chaque fois qu'on essaie de déplier un lot en attente, y
    compris au démarrage, et c'est ce qui garantit qu'**aucune image n'entre en
    bibliothèque avant que l'auteur ait vu ce qui est arrivé** (US-368). La
    décision se pose une fois, par `ServiceGenerations.ecarter`, et le lot se
    déplie dans la foulée.
    """

    code = "choix_attendu"


def accorde(nombre: int, singulier: str, pluriel: str = "") -> str:
    """Un nombre et son nom, **accordés** — `1 sprite`, `2 sprites` (M4).

    Le texte se composait avec les nombres de la grille sans jamais accorder, et
    la faute apparaissait dès qu'une dimension valait un : *« a sprite sheet of
    1 sprites […] laid out in exactly 1 columns and 1 rows »*. Mesuré le
    4 septembre 2026 sur les vraies planches du dépôt — **14 sur 22, soit 64 %,
    avaient reçu un pluriel faux**, et les 7 planches d'équipement étaient toutes
    dans ce cas.

    Le pluriel par défaut est le singulier plus un `s` : les quatre mots que ce
    fichier accorde le suivent tous, et une table de formes irrégulières pour
    quatre mots réguliers serait une table à tenir à jour pour rien.
    """
    return f"{nombre} {singulier if nombre == 1 else (pluriel or singulier + 's')}"


def consignes(pliage: Pliage) -> str:
    """Ce qui s'ajoute au prompt pour demander une planche plutôt qu'une image.

    **Deux consignes, une porte d'entrée**, et c'est la géométrie qui décide :
    une grille partie vide demande de *créer* N sujets (C2), une grille partie
    pleine demande de les *habiller* (C3). Le reste de la chaîne — le pliage, le
    découpeur, le compte — ne fait aucune différence entre les deux.

    **Et depuis M4, la planche d'une seule case a son propre texte** — parce
    qu'elle n'est pas une planche. Voir `_habiller_une_seule`.
    """
    if pliage.plusieurs:
        return _creer_plusieurs(pliage)
    if pliage.geometrie_connue:
        return (
            _habiller_une_seule() if pliage.nombre <= 1 else _habiller(pliage)
        )
    return _creer(pliage)


def _creer_plusieurs(pliage: Pliage) -> str:
    """La planche de P2 : N choses **différentes**, une par case, dans l'ordre.

    **La liste numérotée, dans l'ordre de lecture** — tranché par l'auteur le
    18 septembre 2026 : « cell 1: …; cell 2: … ». C'est ce qui rend le rangement
    possible : le modèle lit ce qu'il doit poser dans la case n, et l'atelier
    range le morceau de la case n chez le sujet n. Le point-virgule sépare les
    cases parce qu'un signalement porte souvent ses propres virgules.

    **Elle ne dit pas « the same subject »**, et c'est toute sa différence avec
    `_creer` : cette phrase-là, recopiée, demanderait huit fois la même potion.
    Elle garde tout le reste — la grille, le fond plat, l'interdiction de
    redessiner les bords du gabarit —, parce que c'est ce qui rend la planche
    découpable, et que le découpage n'a pas changé de règle.

    **Des choses isolées, jamais un décor** (décision 3 de l'auteur) : « nothing
    else in the cell, no ground, no scenery » tient chaque sujet dans sa case ;
    une case qui déborde sur sa voisine ne se range plus.
    """
    forme = pliage.geometrie
    liste = "; ".join(
        f"cell {rang}: {case.texte}" for rang, case in enumerate(pliage.cases, start=1)
    )
    return (
        f"Render this as a sprite sheet of {accorde(forme.cases, 'sprite')}, each "
        f"one a DIFFERENT subject. Exactly {accorde(forme.colonnes, 'column')} and "
        f"{accorde(forme.lignes, 'row')}, {accorde(forme.cases, 'cell')} total, one "
        f"single isolated sprite per cell, evenly spaced on a regular grid, each one "
        f"centered in its cell and entirely inside it. The cells, in reading order "
        f"(left to right, then top to bottom), show: {liste}. Each cell shows only "
        f"the subject listed for it and nothing else: no second subject, no ground, "
        f"no scenery. Every sprite is drawn in the same style, with the same outline "
        f"weight and the same lighting. Plain flat light gray background, no cell "
        f"borders, no grid lines, no text, no numbers, no frames, no ground shadow. "
        f"The attached layout image shows {accorde(forme.cases, 'empty cell')}. Draw "
        f"one sprite inside each cell, keeping the cells at their positions and sizes. "
        f"Do NOT draw the cell outlines in your image — the background must stay one "
        f"plain flat light gray, with no visible cell borders and no separating lines."
    )


def _ordre_de_lecture(
    taches: Sequence[Boite], hauteur: int, forme: Geometrie
) -> dict[int, list[int]] | None:
    """Les taches rangées **dans l'ordre de lecture**, ou `None` si le compte
    ne le permet pas (P2, décision de l'auteur du 19 septembre 2026).

    Le calage par centre suppose que le modèle pose chaque sujet dans sa case.
    Il ne le fait pas toujours sur une dernière rangée incomplète : il la
    recentre, et un sujet peut glisser vers une case qui n'existe pas. Quand il
    revient **autant de taches que de cases, rangée par rangée**, la n-ième
    tache — de haut en bas, puis de gauche à droite — va à la n-ième case, même
    si elle déborde de la sienne.

    La rangée d'une tache est celle qui contient son centre vertical : c'est
    horizontalement que le modèle dérive. Si une rangée n'a pas le compte
    qu'elle devrait avoir, on rend `None` et le calage par centre décide.

    **Ce que la règle ne voit pas** : dans une même rangée, un sujet coupé en
    deux à côté d'une case vide fait le bon compte, et se range de travers.
    C'est le geste « ce n'est pas le bon sujet » qui le reprend.
    """
    if len(taches) != forme.cases:
        return None
    haut_de_rangee = hauteur / forme.lignes
    rangees: dict[int, list[int]] = {r: [] for r in range(forme.lignes)}
    for index, (x0, y0, x1, y1) in enumerate(taches):
        rangee = min(int(((y0 + y1) / 2) // haut_de_rangee), forme.lignes - 1)
        rangees[rangee].append(index)
    par_case: dict[int, list[int]] = {}
    case = 0
    for rangee in range(forme.lignes):
        attendues = min(forme.colonnes, max(forme.cases - rangee * forme.colonnes, 0))
        siennes = sorted(rangees[rangee], key=lambda i: taches[i][0] + taches[i][2])
        if len(siennes) != attendues:
            return None
        for index in siennes:
            par_case[case] = [index]
            case += 1
    return par_case


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
        f"Render this as a sprite sheet of "
        f"{accorde(forme.cases, 'sprite')} of the SAME subject. "
        f"Exactly {accorde(forme.colonnes, 'column')} and "
        f"{accorde(forme.lignes, 'row')}, {accorde(forme.cases, 'cell')} "
        # **`all standing on the same baseline` est parti le 1ᵉʳ septembre 2026.**
        # Ce que cette phrase achetait — des sujets alignés, donc découpables —
        # est gardé mot pour mot ; ce qu'elle disait en plus, *ils sont debout sur
        # un sol*, était une phrase de vue de face, et elle partait telle quelle
        # à un jeu vu d'aplomb. Elle contredisait alors la caméra qui ferme le
        # même prompt — *les pieds restent cachés sous le corps* — dans le seul
        # texte du produit où deux phrases se répondent d'aussi près.
        f"total, one single sprite per cell, evenly spaced on a regular grid, every "
        f"sprite the same height, each one aligned the same way inside its cell. "
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
        f"{consigne} The attached layout image shows "
        f"{accorde(forme.cases, 'empty cell')}. Draw "
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
        f"The attached image is a sprite sheet of "
        f"{accorde(forme.cases, 'sprite')} of the same "
        f"character, laid out in exactly {accorde(forme.colonnes, 'column')} and "
        f"{accorde(forme.lignes, 'row')}. "
        f"Return the SAME sheet with the described item added to every sprite. "
        f"Change absolutely nothing else: the same character, the same poses, the same "
        f"proportions, the same size, the same position of each sprite in its cell, the "
        f"same viewing angles, the same colors everywhere else, the same pixel art "
        f"style, the same outline weight, the same plain flat light gray background. "
        f"Keep the exact same grid: {accorde(forme.colonnes, 'column')}, "
        f"{accorde(forme.lignes, 'row')}, "
        f"same cell positions, same cell sizes, same overall image size. Only the item "
        f"is added. Nothing else moves, nothing else is redrawn, nothing is zoomed in "
        f"or out, no cell borders, no grid lines, no text, no numbers, no frames. "
        f"{ITEM_ENTIER_PLANCHE}"
    )


# **La pièce entière, avec de l'air autour** (18 septembre 2026). Relevé sur le
# disque de l'auteur : le bâton de Champy revenait tenu au ras du corps, et une
# arme qui touche le bord de sa case est coupée *avant* même que l'atelier ne la
# lise — aucun écrin ne rend ce que le modèle n'a pas dessiné. Une phrase, pas
# plus : le reste du texte interdit déjà de bouger ou de rapetisser le
# personnage, et c'est lui qui garde sa place ; la pièce, elle, prend l'espace
# vide de la case. Le texte à une case ne dit ni *cell* ni *border* (M4).
ITEM_ENTIER_PLANCHE = (
    "Draw the whole item, with empty background all around it: no part of it may "
    "touch or cross the edge of its cell."
)
ITEM_ENTIER_SEUL = (
    "Draw the whole item, with empty background all around it: no part of it may "
    "touch or cross the edge of the image."
)


def _habiller_une_seule() -> str:
    """Une seule case : **ce n'est pas une planche, et le texte cesse de le dire** (M4).

    Habiller passe toujours par le pliage, même à une case — le calque se
    fabrique par différence entre l'avant et l'après, et sans planche il n'y a
    rien à comparer. Rien à changer là. **Ce qui en sortait, si.** Le texte
    affirmait au modèle qu'il regardait une feuille de contact quadrillée, lui
    demandait de *garder exactement la même grille*, et lui interdisait *les
    bordures de cases et les lignes de grille* — pour une image qui n'a ni cases
    ni grille. Ce qui partait était **une description de ce que l'image n'est
    pas**, et sur les 22 planches du dépôt, 7 étaient dans ce cas.

    **La redondance ne se rediscute pas, et elle est reprise mot pour mot.** Le
    banc du 28 août 2026 l'a étalonnée : *tout ce qu'on ne dit pas explicitement
    « ne change pas » est une invitation à le changer*. Ce qui était en cause
    n'était pas la redondance, c'était qu'elle décrive une grille absente — les
    six mêmes garanties se répètent donc ici, dites de l'image entière au lieu de
    la case.

    **Elle ne se compose pas depuis la géométrie**, et c'est voulu : une grille
    de 1 × 1 n'a rien à dire, et lui faire dire *« une colonne, une ligne »*
    serait la même faute écrite correctement.
    """
    return (
        "The attached image is a single sprite of the same character, already drawn. "
        "Return the SAME image with the described item added to the character. "
        "Change absolutely nothing else: the same character, the same pose, the same "
        "proportions, the same size, the same position of the character in the image, "
        "the same viewing angle, the same colors everywhere else, the same pixel art "
        "style, the same outline weight, the same plain flat light gray background. "
        "Keep the exact same framing: same subject position, same subject size, same "
        "overall image size. Only the item is added. Nothing else moves, nothing else "
        "is redrawn, nothing is zoomed in or out, no text, no numbers, no frames. "
        + ITEM_ENTIER_SEUL
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

        Lève `CompteFaux` s'il revient **moins** d'images que demandé, et
        `ChoixAttendu` s'il en revient plus, ou si l'une d'elles remplit presque
        toute sa boîte, tant que l'auteur n'a pas tranché (R6). **Rien n'est
        écrit avant**, ici comme chez ses deux appelants : « aucune image
        n'entre » est vrai au pied de la lettre, et pas rattrapé après coup par
        une suppression qui pourrait échouer à moitié.

        **Ce que la planche portait s'écrit sur le pliage avant tout verdict**,
        et c'est ce qui rend le choix possible : l'écran a besoin des sujets et
        de leurs mesures pour les montrer, or au moment où il les montre, aucun
        asset n'existe encore pour les porter. C'est un fait sur l'arrivée, au
        même titre que le coût de l'appel, et il ne se recalcule pas à chaque
        ouverture de l'écran.

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
        toutes = self._boites(pliage, rgba)

        # Le fait d'abord, le verdict ensuite. Une planche à sept sujets pour
        # huit est refusée, et le pliage dit quand même ce qu'elle portait :
        # sans ça, le journal du refus n'apprendrait rien à qui le relit.
        pliage.trouvees = len(toutes)
        pliage.mesures = tuple(mesurer_lot(rgba, toutes))

        if len(toutes) < pliage.nombre:
            raise CompteFaux(_manque(len(toutes), pliage.nombre))
        if pliage.attend_un_choix:
            raise ChoixAttendu(_choix(pliage))

        gardees = pliage.gardees
        if len(gardees) != pliage.nombre:
            raise CompteFaux(_compte(len(gardees), pliage.nombre))

        boites = [toutes[index] for index in gardees]
        # **Les mesures des images qui entrent se reprennent sur elles seules**,
        # jamais sur celles du regard d'avant. La ressemblance est *« le plus
        # fort recouvrement avec une autre case du lot »*, et le lot est
        # maintenant celui des huit gardées : recopier les chiffres des neuf
        # ferait dire à un corps qu'il ressemble à une case qui n'existe plus.
        # Le calcul est le même, sur moins de cases ; on l'évite quand il n'y a
        # rien eu à écarter, ce qui est le cas ordinaire.
        mesures = (
            list(pliage.mesures)
            if len(boites) == len(toutes)
            else mesurer_lot(rgba, boites)
        )

        # **Pas de marge sur une grille connue.** La marge existe pour les
        # boîtes serrées de C2, trouvées sur les taches opaques : elle leur rend
        # l'air que le détourage leur a retiré. Sur une grille posée par
        # l'atelier, chaque boîte est déjà la case entière, et l'élargir la
        # ferait mordre sur sa voisine — le calque de la pose 1 porterait un bout
        # de la pose 2.
        marge = 0 if pliage.geometrie_connue else MARGE
        return decouper(octets, boites, marge=marge), mesures

    def deplier(
        self, generation: Generation, emplacement: Emplacement
    ) -> list[Asset]:
        """La planche revenue devient N images séparées (US-130).

        **Aucun geste de découpe n'est demandé à l'auteur** : on ne découpe
        jamais à la main ce qu'on a demandé plié. C'est la différence entre ce
        geste-ci et le slicer de T5, qui propose et laisse corriger — là, la
        planche est arrivée parce que le produit l'a demandée, et il sait
        combien d'images elle doit contenir.

        Lève `CompteFaux` s'il en manque, et `ChoixAttendu` tant que l'auteur
        n'a pas dit quoi faire d'un surplus ou d'un carré plein (R6). **Rien
        n'est écrit avant que le compte soit vérifié** : « aucune image n'entre
        dans le plan » est vrai au pied de la lettre, et pas rattrapé après coup
        par une suppression qui pourrait échouer à moitié.
        """
        pliage = generation.pliage
        if pliage is None or emplacement.resultat is None:  # pragma: no cover
            return []
        if pliage.plusieurs:
            return self._deplier_plusieurs(generation, emplacement)

        morceaux, mesures = self.decouper_retour(generation, emplacement)
        # **Le dépliage n° 1, automatique** (P1) : ses coupes sont les boîtes
        # que le lot vient de mesurer, et ses rangs sont réservés — et écrits —
        # avant la première image.
        depliage = self.reserver(
            generation, emplacement, [m.boite for m in mesures[: len(morceaux)]]
        )
        nees: list[Asset] = []
        for index, (case, image) in enumerate(zip(pliage.cases, morceaux)):
            nees.append(
                self._accueillir(
                    generation,
                    case,
                    image,
                    depliage.rangs[index],
                    mesures[index],
                    depliage,
                )
            )

        # **Et la planche elle-même, en dernier** (G16). Après ses morceaux,
        # parce que le compte peut encore refuser au-dessus : une planche qui
        # entre alors que rien n'en est sorti serait une image payée rangée
        # comme une réussite. Après aussi parce que `premier_rang_libre` réserve
        # déjà les rangs des emplacements — le sien ne pouvait pas être pris.
        self.accueillir_planche(generation, emplacement)

        # L'arbre compte les assets par projet : N de plus changent ces comptes,
        # et personne d'autre ne les recalcule. Une fois, à la fin.
        self._diffusion.publier("bibliotheque", self._bibliotheque.arbre())
        return nees

    def _deplier_plusieurs(
        self, generation: Generation, emplacement: Emplacement
    ) -> list[Asset]:
        """Une planche à plusieurs sujets : chaque morceau chez le sujet de sa
        case, **ou signalé** — jamais rangé de travers (P2).

        **La règle, écrite une fois.** Les taches opaques sont trouvées comme
        en C2 (détourage par le bord, puis zones connexes). Chacune tombe dans
        **la case de la grille enregistrée qui contient son centre** — jamais
        dans « la n-ième tache trouvée » : c'est ce qui empêche une case vide de
        faire glisser tous les suivants d'un cran. Puis, case par case :

        - **une tache, et une seule**, qui ne remplit pas sa boîte → rangée chez
          le sujet de la case, dans la pose que la liste lui a donnée ;
        - **aucune tache** → « case vide », à vérifier, rien n'est rangé ;
        - **plusieurs taches** → à vérifier : deux sujets, ou un sujet en
          morceaux, l'atelier ne sait pas lequel sans regarder ;
        - **une tache qui remplit sa boîte** (`SEUIL_PLEINE`, R6) → à vérifier :
          c'est un morceau de quadrillage redessiné, pas un sujet.

        Une tache dont le centre tombe hors des N cases (la fin d'une dernière
        rangée incomplète) n'est rangée nulle part ; elle reste comptée dans
        `trouvees` et mesurée avec les autres — **sauf si l'ordre de lecture
        la rattrape** (`_ordre_de_lecture`) : le banc payé du 19 septembre 2026
        a vu le modèle recentrer une dernière rangée incomplète une fois sur
        deux, et un coffre finir à un pixel de la case 9.

        **Aucun refus, aucune attente de choix** : c'est la différence avec
        `deplier` (C2). Un compte court n'arrête pas la planche, parce qu'ici
        un choix *fabrique* ce qui manque — la case se refait seule, en image
        simple, sans repayer les autres (décision 1 de l'auteur).

        **Ce que la règle ne voit pas** : que la case n porte bien le sujet n.
        Une potion bleue dessinée à la place de la rouge est une tache unique,
        bien centrée, et elle se range. C'est le geste « ce n'est pas le bon
        sujet » (`retirer_du_rangement`) qui la reprend.
        """
        pliage = generation.pliage
        assert pliage is not None and emplacement.resultat is not None
        octets = self._fichiers.lire(emplacement.resultat.fichier)
        rgba = detourer(Recette(passes=(Passe(moteur=BORD),)), octets)
        toutes = zones_opaques(rgba[:, :, 3])
        pliage.trouvees = len(toutes)
        pliage.mesures = tuple(mesurer_lot(rgba, toutes))

        hauteur, largeur = rgba.shape[:2]
        forme = pliage.geometrie
        grille = grille_fixe(largeur, hauteur, forme.colonnes, forme.lignes)[
            : forme.cases
        ]
        par_case: dict[int, list[int]] = {i: [] for i in range(len(grille))}
        for index, (x0, y0, x1, y1) in enumerate(toutes):
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            for case, (gx0, gy0, gx1, gy1) in enumerate(grille):
                if gx0 <= cx <= gx1 and gy0 <= cy <= gy1:
                    par_case[case].append(index)
                    break
        # **Le calage par centre a raté, mais le compte est juste** : on range
        # alors dans l'ordre de lecture (décision de l'auteur, 19 septembre
        # 2026). Voir `_ordre_de_lecture`.
        if any(len(siennes) != 1 for siennes in par_case.values()):
            en_ordre = _ordre_de_lecture(toutes, hauteur, forme)
            if en_ordre is not None:
                par_case = en_ordre

        coupes: list[tuple[int, int, int, int]] = []
        indices: list[int] = []
        taches: list[int] = []
        a_verifier: dict[int, str] = {}
        for case in range(pliage.nombre):
            siennes = par_case.get(case, [])
            if not siennes:
                a_verifier[case] = "case vide — rien n'a été trouvé dans cette case"
            elif len(siennes) > 1:
                a_verifier[case] = (
                    f"{len(siennes)} morceaux dans cette case — deux sujets, ou un "
                    f"sujet coupé : à regarder avant de ranger"
                )
            elif pliage.mesures[siennes[0]].pleine:
                a_verifier[case] = (
                    "le morceau remplit presque toute sa boîte — c'est le "
                    "quadrillage que le modèle a redessiné, pas un sujet"
                )
            else:
                coupes.append(tuple(toutes[siennes[0]]))  # type: ignore[arg-type]
                indices.append(case)
                taches.append(siennes[0])

        depliage = self.reserver(generation, emplacement, coupes, cases=indices)
        depliage.a_verifier = a_verifier
        self._sauver(generation)

        morceaux = decouper(octets, coupes, marge=self.marge(generation))  # type: ignore[arg-type]
        nees = [
            self._accueillir(
                generation,
                pliage.cases[case],
                image,
                depliage.rangs[rang],
                pliage.mesures[tache],
                depliage,
            )
            for rang, (case, tache, image) in enumerate(zip(indices, taches, morceaux))
        ]
        self.accueillir_planche(generation, emplacement)
        self._diffusion.publier("bibliotheque", self._bibliotheque.arbre())
        return nees

    def retirer_du_rangement(
        self, generation: Generation, depliage: Depliage, case: int, image: Asset
    ) -> Asset:
        """« Ce n'est pas le bon sujet » : l'image quitte la case, la case est
        signalée (P2).

        **L'image reste**, en bibliothèque, avec sa planche et son dépliage —
        elle a été payée, et elle peut servir ailleurs. Ce qui part est son
        rangement : ni sujet, ni pose, ni direction. La case de la planche passe
        « à vérifier » sur ce dépliage, avec la raison de l'auteur, et se
        refait seule si on veut.
        """
        depliage.a_verifier = {
            **depliage.a_verifier,
            case: "l'auteur l'a désignée : ce n'est pas le bon sujet",
        }
        self._sauver(generation)
        image.personnage = None
        image.pose = None
        image.direction = None
        self._assets.sauver(image)
        return image

    def accueillir_planche(
        self, generation: Generation, emplacement: Emplacement
    ) -> Asset | None:
        """La planche revenue entre en bibliothèque, à son propre rang (G16).

        **Ce qui a été payé cesse d'être invisible.** Jusqu'ici la feuille
        restait sur le disque sans qu'aucun écran ne puisse l'ouvrir : l'auteur
        ne voyait jamais l'image qu'il avait achetée, seulement ce que l'atelier
        en avait tiré. Elle entre donc, et sans rien changer d'autre — ses
        morceaux gardent leurs rangs, leurs recettes et leurs cases.

        **Elle ne se dédouble jamais.** Un asset déjà là à ce rang est rendu tel
        quel : le dépliage, la reprise au démarrage et le rattrapage passent
        tous les trois par ici, et deux appels ne feraient pas deux images.

        **Pas de fichier, pas d'asset.** C'est la règle du rattrapage, et elle
        vaut ici pour la même raison : effacer les fichiers d'une planche doit
        suffire à la faire disparaître, sans qu'une pierre tombale traîne
        quelque part.

        Ce qu'elle *est* — sa recette vide, son coût, son absence de pose — est
        écrit à un seul endroit, `atelier/domaine/planche.py`, parce que trois
        chemins la construisent.
        """
        if emplacement.resultat is None or generation.pliage is None:
            return None
        if not self._fichiers.existe(emplacement.resultat.fichier):
            return None

        deja = self._base.lire_asset(
            identifiant_de(generation.identifiant, emplacement.rang)
        )
        if deja is not None:
            return deja

        planche = asset_de_planche(generation, emplacement)
        if planche is None:  # pragma: no cover — les deux gardes sont au-dessus
            return None
        return self._assets.accueillir(planche)

    def deplie(self, generation: Generation) -> bool:
        """Ce lot a-t-il déjà rendu ses images ?

        Lue sur les **rangs de la génération**, jamais sur un drapeau : un
        drapeau serait une seconde vérité, et c'est le disque qui fait foi. Un
        lot refusé sur le compte n'a écrit aucun rang, donc il répond non — et
        c'est exact, il attend une relance.

        **Et un dépliage que l'auteur a supprimé compte comme déplié** (P1b).
        Ses images purgées, l'index a oublié leurs rangs : sans cette ligne, la
        reprise au démarrage prendrait la planche pour une planche jamais
        dépliée, et ferait revenir ce que l'auteur a jeté.
        """
        pliage = generation.pliage
        if pliage is not None and any(
            d.supprime_le is not None for d in pliage.depliages
        ):
            return True
        return any(
            rang >= RANG_PLIAGE for rang in self._base.rangs_de_generation(
                generation.identifiant
            )
        )

    def marge(self, generation: Generation) -> int:
        """La marge que le dépliage ajoute autour de chaque coupe.

        **Une seule règle pour les deux dépliages**, l'automatique et celui
        qu'on refait (P1b) : les coupes s'enregistrent avant marge, et c'est ce
        qui fait qu'un dépliage refait sur les coupes proposées, sans rien y
        toucher, rend exactement les mêmes images que le premier. Voir
        `decouper_retour` pour pourquoi une grille connue n'en prend pas.
        """
        pliage = generation.pliage
        return 0 if pliage is not None and pliage.geometrie_connue else MARGE

    def redeplier(
        self,
        generation: Generation,
        emplacement: Emplacement,
        coupes: Sequence[Boite],
        cases: Sequence[int | None],
    ) -> tuple[Depliage, list[Asset]]:
        """Un dépliage de plus, sur les coupes que l'auteur a validées (P1b).

        **Le geste qu'on demande**, jamais une étape qu'on traverse : le premier
        dépliage reste automatique (`deplier`), celui-ci ne part que d'un clic.
        Il ne refuse donc rien sur le compte — l'auteur a sous les yeux ce qu'il
        coupe, et c'est sa liste qui part, comme au découpeur de T5.

        **Il n'efface rien.** Les images des dépliages précédents restent où
        elles sont, à leurs rangs : un calque désigne son corps par
        identifiant, et c'est ce qui interdisait de redéplier en C3. Celui-ci
        prend des rangs neufs, d'un seul tenant (`Pliage.reserver`), et l'on
        supprime ensuite, si l'on veut, le dépliage qu'on ne garde pas.

        `cases` est aligné aux coupes : l'indice de la case de la planche que
        chaque coupe remplit, ou `None` pour une coupe ajoutée qui n'en remplit
        aucune — elle entre sans pose ni direction, sous un nom numéroté.

        **Rien n'est écrit avant que tout soit coupé et mesuré**, ici comme au
        premier dépliage : une coupe illisible lève avant la réservation.
        """
        pliage = generation.pliage
        if pliage is None or emplacement.resultat is None:  # pragma: no cover
            raise ErreurAtelier("cette génération n'est pas une planche arrivée")

        octets = self._fichiers.lire(emplacement.resultat.fichier)
        boites = [tuple(int(v) for v in c) for c in coupes]
        # Les mêmes mesures que l'arrivée, sur la même image détourée de la
        # même façon : l'écran les montre pareil pour les deux dépliages.
        rgba = detourer(Recette(passes=(Passe(moteur=BORD),)), octets)
        mesures = mesurer_lot(rgba, boites)  # type: ignore[arg-type]
        morceaux = decouper(octets, boites, marge=self.marge(generation))  # type: ignore[arg-type]

        indices = [
            cases[i]
            if i < len(cases) and cases[i] is not None and 0 <= cases[i] < pliage.nombre  # type: ignore[operator]
            else None
            for i in range(len(morceaux))
        ]
        depliage = self.reserver(
            generation, emplacement, boites, origine=MAIN, cases=indices  # type: ignore[arg-type]
        )
        # **Une case qu'aucune coupe ne remplit se signale** (P2) — la « coupe
        # manquante » d'une planche à plusieurs sujets. Sur une planche d'un
        # seul sujet, l'auteur a sous les yeux ce qu'il coupe, et c'est sa liste
        # qui fait foi, comme depuis P1b : rien ne s'y ajoute.
        if pliage.plusieurs:
            remplies = {i for i in indices if i is not None}
            depliage.a_verifier = {
                case: "aucune coupe ne remplit cette case"
                for case in range(pliage.nombre)
                if case not in remplies
            }
            if depliage.a_verifier:
                self._sauver(generation)
        maintenant = time.time()
        total = len(morceaux)
        sujet = str(
            generation.demande.get("sujet") or generation.demande.get("prompt") or ""
        ).strip()
        nees: list[Asset] = []
        for index, image in enumerate(morceaux):
            indice = indices[index]
            case = pliage.cases[indice] if indice is not None else None
            nees.append(
                self._accueillir(
                    generation,
                    case,
                    image,
                    depliage.rangs[index],
                    mesures[index],
                    depliage,
                    # **Daté de maintenant**, comme une découpe de T5 : ce qu'on
                    # vient de refaire doit se voir en tête de grille, pas au
                    # fond avec le lot d'origine.
                    cree_le=maintenant,
                    label=None
                    if case is not None
                    else f"{sujet[:44] or 'planche'} · {index + 1}/{total}",
                )
            )

        self._diffusion.publier("bibliotheque", self._bibliotheque.arbre())
        return depliage, nees

    def reserver(
        self,
        generation: Generation,
        emplacement: Emplacement,
        coupes: Sequence[tuple[int, int, int, int]],
        *,
        origine: str = AUTO,
        cases: Sequence[int | None] = (),
    ) -> Depliage:
        """Un dépliage de la planche de cet emplacement, ses rangs pris (P1).

        **La réservation s'écrit avant la première image**, pour la raison qui
        fait écrire l'arrivée avant le dépliage : une fermeture entre les deux
        laisse sur le disque une réservation sans images, que la reprise au
        démarrage retrouve et remplit — mêmes rangs, même numéro —, jamais des
        images qui désigneraient un dépliage que le fichier ignore.

        Publique parce que les deux dépliages automatiques la partagent — les
        corps de C2 et les calques de C3 —, et que P1b y passera pour le
        dépliage refait à la main.
        """
        pliage = generation.pliage
        if pliage is None:  # pragma: no cover — on ne déplie que ce qui est plié
            raise ErreurAtelier("cette génération n'est pas une planche")
        depliage = pliage.reserver(
            identifiant_de(generation.identifiant, emplacement.rang),
            tuple(tuple(int(v) for v in c) for c in coupes),  # type: ignore[misc]
            self.premier_rang_libre(generation),
            origine=origine,
            cree_le=time.time(),
            cases=tuple(cases),
        )
        self._sauver(generation)
        return depliage

    def oublier_depliage(self, generation: Generation, depliage: Depliage) -> None:
        """Le dépliage est marqué supprimé — **et reste écrit** (P1b).

        Ses rangs restent réservés, son numéro n'est pas redonné ; seule la date
        s'ajoute, pour que la reprise au démarrage ne le prenne pas pour une
        planche jamais dépliée (voir `deplie`). Ses images, elles, passent par
        la suppression ordinaire de la bibliothèque — c'est l'appelant qui la
        demande, avec son délai d'annulation.
        """
        if depliage.supprime_le is None:
            depliage.supprime_le = time.time()
            self._sauver(generation)

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

        **Un lot qui attend un choix, lui, n'est pas repris** (R6) : il a déjà
        été regardé une fois, ses sujets sont mesurés et écrits, et le redéplier
        à chaque démarrage relirait la planche pour retomber sur la même
        question. Il attend un geste de l'auteur, pas un rangement — et c'est
        pour ça que la première rencontre écrit ce qu'elle a vu.
        """
        repris = 0
        for generation in generations:
            pliage = generation.pliage
            if pliage is None or self.deplie(generation) or pliage.attend_un_choix:
                continue
            for emplacement in generation.emplacements:
                if emplacement.resultat is None:
                    continue
                if not self._fichiers.existe(emplacement.resultat.fichier):
                    continue
                try:
                    self.deplier(generation, emplacement)
                except CompteFaux as refus:
                    pliage.refus = refus.raison
                    emplacement.statut = Statut.ECHOUEE
                    emplacement.raison = refus.raison
                except ChoixAttendu:
                    # **Ni échec ni refus** : la planche est là, entière, payée.
                    # L'emplacement reste réussi et le pliage porte désormais ce
                    # qu'elle contenait — l'écran a de quoi poser la question.
                    pass
                # **Écrit dans tous les cas, et c'est nouveau.** Jusqu'ici la
                # reprise décidait en mémoire et ne sauvait rien : un compte faux
                # au démarrage se rejouait au démarrage suivant. Sans conséquence
                # tant que rien n'était écrit ; avec R6, les mesures de l'arrivée
                # doivent survivre à la fermeture de l'atelier, sans quoi l'écran
                # du choix redécouperait la planche à chaque ouverture.
                self._sauver(generation)
                repris += 1
        return repris

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _sauver(self, generation: Generation) -> None:
        """Le disque, l'index, puis l'annonce — dans cet ordre.

        **Écrit ici et pas ailleurs**, parce que `ServiceGenerations` tient déjà
        `ServicePliage` : lui demander de sauver ferait un cercle entre les deux
        services. Les trois lignes sont celles de `ServiceGenerations._sauver`,
        et leur ordre a la même raison — une coupure entre le fichier et l'index
        laisse l'index en retard, ce que la reconstruction rattrape ; dans
        l'autre sens elle mettrait l'invariant à l'envers.
        """
        contenu = generation.en_json()
        self._fichiers.ecrire_enregistrement(generation.identifiant, contenu)
        self._base.enregistrer(generation)
        self._diffusion.publier("generation", contenu)

    def _boites(self, pliage: Pliage, rgba: np.ndarray) -> list[Boite]:
        """Où couper le retour, et les deux façons de le savoir — une planche à
        plusieurs sujets en a une troisième, `_deplier_plusieurs`.

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
        case: CasePliee | None,
        octets: bytes,
        rang: int,
        mesures: MesuresLot,
        depliage: Depliage,
        *,
        cree_le: float | None = None,
        label: str | None = None,
    ) -> Asset:
        """Une coupe devient une image de la bibliothèque.

        **Le même accueil pour les deux dépliages** (P1b) : ce qui distingue le
        dépliage refait tient dans trois paramètres — une coupe ajoutée n'a pas
        de case (`case` vide, donc ni pose ni direction), elle a un nom
        numéroté (`label`), et tout ce qu'on refait est daté du geste
        (`cree_le`). Le reste — recette de planche, coût nul, provenance,
        planche et dépliage — ne dépend pas de qui a coupé.
        """
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
                label=label or (_label(case) if case is not None else "sans titre"),
                # **Un morceau de planche, et il le dit** (D1) : le défaut
                # de détourage se règle par nature d'image, et celle-ci en
                # est une. La génération ne suffirait pas à le deviner —
                # c'est la même qui a rendu la planche entière.
                # Et la palette par défaut du sujet de sa case (TS12) : une vue
                # dépliée est une nouvelle image du sujet comme une autre.
                recette=self._assets.recette_d_une_vue_depliee(
                    generation, _sujet_de(generation, case)
                ),
                # **Une image dépliée n'a rien coûté seule.** L'argent a été
                # dépensé une fois, pour l'appel, et le journal du projet le
                # porte. Lui attribuer une part du prix inventerait un chiffre
                # que personne n'a facturé — et le total du projet, qui se
                # calcule sur les générations, dirait alors autre chose que la
                # somme des tuiles. Même règle que les découpes de T5.
                consomme=0.0,
                unite=generation.unite,  # zéro, mais dans l'unité de l'appel (F2)
                provenance=generation.provenance,
                modele=generation.modele,
                projet=generation.projet,
                # **La case que ce sujet-là remplit** (US-128). C'est le pliage
                # qui la connaît, et lui seul : la génération vise un lot, pas
                # une case. Un corps entre donc dans sa ligne de matrice sans
                # que personne ait à l'y ranger, exactement comme une image de
                # C1 tombait dans la sienne.
                #
                # **Et le sujet de sa case, quand la planche en porte plusieurs**
                # (P2) : la liste de la demande dit à qui va chaque case. Sans
                # elle, le sujet de la génération, comme depuis C2. Une coupe
                # ajoutée à la main, qui ne remplit aucune case, n'est à
                # personne sur une planche à plusieurs sujets.
                personnage=_sujet_de(generation, case),
                pose=case.pose if case is not None else None,
                # **Et sa direction, écrite à la naissance** (E13). C'est ce qui
                # répare la mesure du 30 août 2026 : le rangement cesse d'être un
                # geste séparé qu'on peut oublier, puisqu'une case ne peut pas
                # partir sans dire où son image ira. Vide quand le jeu n'a pas
                # déclaré de directions — l'état ordinaire, et rien ne change.
                direction=case.direction if case is not None else None,
                lot=mesures,
                # **Sa planche et son découpage** (P1) — de quoi remonter de
                # l'image à la feuille payée, et au geste qui l'en a tirée.
                planche=depliage.planche,
                depliage=depliage.identifiant,
                # **Datée du lot**, comme les variations d'un même appel : les N
                # images sont arrivées ensemble, et le rang les départage dans
                # l'ordre de lecture de la planche.
                cree_le=generation.cree_le if cree_le is None else cree_le,
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

        **Et au-dessus des rangs réservés par un dépliage enregistré** (P1),
        même quand leurs images ont été supprimées et purgées : c'est la moitié
        de la règle des rangs que le disque seul ne voit plus (voir `Depliage`).
        """
        return rang_libre(
            self._base, generation.identifiant, plancher=RANG_PLIAGE, objet=generation
        )


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


def _manque(trouvees: int, demandees: int) -> str:
    """Il en manque, et ça, aucun choix ne le répare (R6).

    Elle garde mot pour mot le début de l'ancienne raison — les deux nombres,
    dans le même ordre — parce que c'est ce qu'on lit d'abord dans le journal, et
    qu'une planche refusée avant R6 et une planche refusée après doivent se
    relire pareil. Ce qu'elle ajoute est la seule chose que R6 change ici : la
    raison pour laquelle celle-là, et plus celle d'à côté, est sans issue.
    """
    return (
        f"{_compte(trouvees, demandees)} — il en manque "
        f"{demandees - trouvees}, et aucun choix ne les fabriquera"
    )


def _choix(pliage: Pliage) -> str:
    """Ce que la planche attend de l'auteur, en toutes lettres (R6).

    **Elle nomme les deux défauts séparément**, parce qu'ils ne se corrigent pas
    de la même façon dans la tête de celui qui lit : un sujet en trop est une
    case à désigner, un carré plein est un morceau de quadrillage que le modèle a
    dessiné. Les confondre dans un « quelque chose cloche » ferait chercher.

    Aucune des deux phrases ne dit « refusé » — rien ne l'est. La planche est
    payée, entière, et sur le disque ; ce qui manque est un regard.
    """
    dits = []
    if pliage.surplus:
        trop = pliage.surplus
        dits.append(
            f"{pliage.trouvees} sujets pour {pliage.nombre} demandés — "
            f"{trop} de trop, à écarter"
        )
    if pliage.pleines:
        pleines = pliage.pleines
        combien = len(pleines)
        dits.append(
            f"{combien} sujet{'s' if combien > 1 else ''} "
            f"remplit{'' if combien == 1 else 'ssent'} presque toute "
            f"{'sa boîte' if combien == 1 else 'leur boîte'} "
            f"({', '.join(f'n° {i + 1}' for i in pleines)}) — "
            f"c'est le quadrillage que le modèle a redessiné, pas un personnage"
        )
    return (
        f"{' ; '.join(dits)}. La planche est payée et complète : rien n'est "
        f"refusé, rien n'est entré, et rien ne se relance — choisissez ce que "
        f"vous gardez."
    )


def _sujet_de(generation: Generation, case: CasePliee | None) -> str | None:
    """La chose du jeu qui reçoit l'image de cette case (voir `_accueillir`)."""
    if case is not None and case.sujet:
        return case.sujet
    if generation.pliage is not None and generation.pliage.plusieurs:
        return None
    return generation.personnage


def _label(case: CasePliee) -> str:
    """Le texte de la case, et rien d'autre.

    **Pas le début du prompt**, qui est ce que fait `naitre` pour une image
    ordinaire : le prompt d'un lot est le même pour ses N images — c'est le
    sujet — et neuf vignettes portant toutes le même début de phrase seraient
    neuf vignettes indiscernables dans la grille. Le texte de la case est
    exactement ce qui les distingue, et c'est le mot que l'auteur cherchera.
    """
    # Sur une planche à plusieurs sujets (P2), le signalement seul : la
    # consigne de pose qui le suit est la même pour tous les objets posés, et
    # ce qui distingue les vignettes est la chose, pas son attitude.
    propre = (case.signalement or case.texte).strip()
    return propre[:60] if propre else "sans titre"
