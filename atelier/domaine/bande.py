# -*- coding: utf-8 -*-
"""La bande — **une animation taillée dans un clip, et gardée**.

Arrivée en A10 (V3). C'est ce que la version produit : un clip est ce qu'on
paie, une bande est ce qui sert.

**Une bande n'est pas un asset, et c'est une décision.** Un asset est une image
avec sa recette ; une bande est une suite d'images qui n'existent qu'ensemble.
Les faire entrer dans la même table aurait obligé chaque endroit du produit qui
manipule une image — la grille, la retouche, la découpe, la superposition, la
table de la main — à savoir qu'un asset peut en porter douze. Le prix de la
séparation est connu et il est payé ailleurs : une bande a sa liste à elle sur
l'écran de montage, et `A12` lui donne sa place dans la matrice. *Ce n'est pas
la même chose qu'une image ; ça ne se range donc pas comme une image.*

**Ce qu'elle garde est une intention, pas des pixels.** La liste des numéros
d'image, la fenêtre, la recette : la planche de sprites se recalcule à partir de
ça, et le fichier qu'on écrit est un **cache**, effaçable sans rien perdre.
C'est la règle 5 de `docs/ARCHITECTURE.md` — le traitement est non destructif —
et une bande n'y fait aucune exception. Conséquence directe et voulue : changer
la palette du jeu six mois plus tard refait toutes les bandes, comme il refait
toutes les images.

**Elle porte sa cadence, et il n'y en a qu'une.** Celle que l'auteur règle à
l'écran est celle qui part dans le descriptif à l'export (`A4`). Deux réglages —
un pour regarder, un pour livrer — finiraient par se contredire, et c'est
l'auteur qui découvrirait l'écart, dans son moteur de jeu.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from atelier.domaine.calque_anime import (
    CalageParImage,
    Habillage,
    calages_depuis_json,
)
from atelier.domaine.recette import Recette
from atelier.domaine.superposition import ReglagesGardes

# ── Le sens de lecture ───────────────────────────────────────────────────────
#
# Deux, et il n'en manque pas un troisième. **En boucle** : la dernière image
# est suivie de la première. **Aller-retour** : on repart en arrière au lieu de
# sauter au début — ce qui double la durée sans doubler les images, et ce qui
# est la bonne réponse pour un balancement, une respiration, une flamme.
#
# Un sens « une seule fois » n'est pas offert : ce n'est pas une propriété de la
# bande, c'est une décision du moteur de jeu au moment où il la joue. L'écrire
# ici le ferait mentir la moitié du temps.

BOUCLE = "boucle"
ALLER_RETOUR = "aller-retour"
SENS = (BOUCLE, ALLER_RETOUR)


# ── D'où le cadre est pris ───────────────────────────────────────────────────
#
# Trois réponses, et la première est le défaut pour une raison mesurée le
# 3 septembre 2026 (`atelier/image/bande.py`) : une fenêtre par bande cale les
# images **d'une** bande entre elles, il faut une fenêtre par clip pour caler
# **les bandes** entre elles. Sans quoi le personnage grandit de 10 % en passant
# du repos à la marche.
#
# Les deux autres existent parce qu'un cadrage automatique se trompe parfois, et
# parce qu'une bande où le personnage quitte le champ a besoin du sien.

DU_CLIP = "clip"
DE_LA_BANDE = "bande"
A_LA_MAIN = "main"
CADRES = (DU_CLIP, DE_LA_BANDE, A_LA_MAIN)

MOT_DU_CADRE = {
    DU_CLIP: "pris sur le clip entier — toutes ses bandes ont la même assise",
    DE_LA_BANDE: "pris sur cette bande seule — elle ne s'accorde plus aux autres",
    A_LA_MAIN: "posé à la main — ni le clip ni la bande n'en décident",
}

CADENCE_PAR_DEFAUT = 8.0


@dataclass(frozen=True, slots=True)
class Cadre:
    """Le rectangle sur lequel toutes les images d'une bande sont recadrées.

    **Bornes comprises**, et dans les coordonnées de l'image telle que la mise
    sur grille la voit — donc après le détourage et après le recadrage de la
    recette. Le dire ici plutôt que de le laisser deviner : un rectangle pris
    avant le recadrage tomberait à côté sans que rien ne lève.

    Il porte **d'où il vient** en plus de ses quatre nombres, et ce n'est pas
    décoratif : l'écran doit pouvoir dire *pris sur le clip entier* ou *posé à
    la main*, et deux rectangles identiques venus d'endroits différents ne se
    reprennent pas de la même façon quand le clip change.
    """

    choix: str = DU_CLIP
    gauche: int = 0
    sommet: int = 0
    droite: int = 0
    bas: int = 0

    @property
    def largeur(self) -> int:
        return self.droite - self.gauche + 1

    @property
    def hauteur(self) -> int:
        return self.bas - self.sommet + 1

    @property
    def vide(self) -> bool:
        """Aucun rectangle posé — la bande se recadre alors comme une image seule."""
        return self.droite <= self.gauche or self.bas <= self.sommet

    def en_tuple(self) -> tuple[int, int, int, int]:
        return self.gauche, self.sommet, self.droite, self.bas

    @property
    def mot(self) -> str:
        return MOT_DU_CADRE.get(self.choix, "")

    def en_json(self) -> dict[str, Any]:
        return {
            "choix": self.choix,
            "gauche": self.gauche,
            "sommet": self.sommet,
            "droite": self.droite,
            "bas": self.bas,
            "largeur": self.largeur,
            "hauteur": self.hauteur,
            "mot": self.mot,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "Cadre":
        if not d:
            return Cadre()
        choix = str(d.get("choix") or DU_CLIP)
        return Cadre(
            choix=choix if choix in CADRES else DU_CLIP,
            gauche=int(d.get("gauche", 0)),
            sommet=int(d.get("sommet", 0)),
            droite=int(d.get("droite", 0)),
            bas=int(d.get("bas", 0)),
        )


@dataclass(frozen=True, slots=True)
class Prise:
    """Une image retenue : **d'où elle vient, et de combien on l'a poussée** (A7).

    Jusqu'à `A7`, une bande ne retenait que des **numéros**. Ça suffisait tant
    que toutes ses images venaient du même clip et qu'aucune ne se corrigeait —
    et les deux hypothèses tombent en même temps ici : on va chercher une image
    dans un autre clip, et on pousse au pixel celle qui tombe à côté.

    `clip` vide veut dire **le clip de la bande**, et ce n'est pas une
    commodité : c'est ce qui fait qu'une bande d'`A10` se relit sans être
    réécrite, et qu'une bande qui n'a jamais quitté son clip ne répète pas cent
    fois le même identifiant. La question *de quel clip vient cette image* a
    donc toujours une réponse — `clip_ou`, plus bas — sans qu'on ait eu à
    migrer quoi que ce soit.

    `dx` et `dy` sont **en pixels de l'image rendue**, comme l'épaisseur d'un
    contour : une fois la grille posée, un pixel d'image *est* un bloc du
    sprite. Pousser d'un bloc est le geste qu'on veut, et l'écrire en pixels de
    la vidéo d'origine ferait dépendre la correction de la taille du clip.

    ⚠️ **Elle ne porte aucun pixel**, et la règle 5 de l'architecture tient sans
    exception : une prise est une intention de plus, la planche reste un cache
    qu'on peut effacer.
    """

    numero: int
    clip: str = ""
    dx: int = 0
    dy: int = 0

    # **La recette de cette frame, quand elle a la sienne** (V3.03.1).
    #
    # `None` veut dire *la recette de la bande* — le défaut, et c'est ce qui
    # fait qu'une bande d'avant la tranche se relit sans avoir été réécrite.
    # Elle naît au premier réglage touché sur la frame, comme une **copie** de
    # la recette de la bande à cet instant, et « reprendre la recette de la
    # bande » la rend au défaut. Ce qui s'écarte s'écrit sur le ruban : une
    # frame qui change n'a pas à faire refaire les autres, et une bande où
    # chaque frame aurait pu changer doit le dire.
    recette: Recette | None = None

    @property
    def poussee(self) -> bool:
        """A-t-elle été corrigée ? Ce qui n'a pas bougé ne s'annonce pas."""
        return self.dx != 0 or self.dy != 0

    def clip_ou(self, defaut: str) -> str:
        """Le clip dont elle vient — celui de la bande si elle n'en nomme aucun."""
        return self.clip or defaut

    def en_json(self) -> dict[str, Any]:
        rendu = {
            "numero": self.numero,
            "clip": self.clip,
            "dx": self.dx,
            "dy": self.dy,
        }
        # **Le champ ne paraît que quand la frame en a une.** `None` veut dire
        # *la recette de la bande*, et une prise sans recette s'écrit comme
        # avant la tranche — la forme d'une bande d'A10 ne change pas d'un
        # octet, et tout ce qui la relisait la relit encore.
        if self.recette is not None:
            rendu["recette"] = self.recette.en_json()
        return rendu

    @staticmethod
    def depuis_json(d: dict[str, Any] | int | float) -> "Prise":
        """Une prise, **ou un simple numéro** — c'est ce qui relit les bandes d'A10.

        Les bandes déjà gardées écrivent une liste d'entiers. Les relire comme
        des prises sans clip ni poussée est exactement ce qu'elles voulaient
        dire, et ça évite de réécrire une table pour ajouter deux zéros.
        """
        if isinstance(d, (int, float)):
            return Prise(numero=int(d))
        return Prise(
            numero=int(d.get("numero", 0)),
            clip=str(d.get("clip") or ""),
            dx=int(d.get("dx", 0)),
            dy=int(d.get("dy", 0)),
            recette=Recette.depuis_json(d["recette"]) if d.get("recette") else None,
        )


@dataclass(slots=True)
class Bande:
    """Une animation gardée : d'où elle vient, ce qu'elle retient, comment elle tourne.

    **Sans case visée, c'est un brouillon**, et un brouillon ne bloque rien
    (`A10`). On garde d'abord, on range ensuite — c'est l'enchaînement que le
    produit emploie partout ailleurs, et il évite d'alourdir le geste au moment
    où l'on découpe « pour voir ».
    """

    identifiant: str
    clip: str  # la génération dont elle est tirée
    nom: str = ""

    # Les images retenues, **dans l'ordre où elles se jouent**. Rien n'oblige à
    # ce qu'elles soient régulièrement espacées : un pas de marche demande deux
    # images serrées au contact et une seule pendant la glisse.
    #
    # **C'était une liste de numéros jusqu'à `A7`**, et c'est devenu une liste
    # de prises — chacune sachant de quel clip elle vient et de combien elle a
    # été poussée. `images` reste lisible juste en dessous : tout ce qui ne veut
    # que les numéros continue de les demander comme avant.
    prises: tuple[Prise, ...] = ()

    # **Le chutier — la réserve de la bande** (V3.03.3).
    #
    # Les images mises de côté : celles qu'on a retirées du montage et celles
    # qu'on est allé chercher dans le clip, et qui ne sont pas encore posées.
    # Ce sont **des prises entières et non des numéros**, parce qu'une image
    # retirée du ruban emporte sa recette individuelle avec elle : la reposer
    # trois gestes plus loin doit la rendre telle qu'elle était, sans quoi
    # « retirer puis remettre » serait une façon silencieuse d'effacer un
    # réglage.
    #
    # ⚠️ **Une prise est dans le ruban, ou au chutier, jamais dans les deux.**
    # Poser une image du chutier l'en sort ; retirer une image du ruban l'y
    # met ; reprendre le montage cherche dans les deux et prend dans l'un.
    # C'est une règle sur les *prises*, pas sur les numéros : une image
    # dupliquée puis à demi retirée est légitimement au ruban **et** au
    # chutier, parce que ce sont deux prises et que chacune porte sa recette.
    #
    # Il **n'entre pas dans la planche** : ce qui sort vers le jeu est le
    # ruban, dans son ordre. Le chutier ne change donc aucun pixel, et une
    # bande d'avant la tranche se relit avec un chutier vide sans qu'un seul
    # fichier ait été réécrit.
    chutier: tuple[Prise, ...] = ()

    cadence: float = CADENCE_PAR_DEFAUT
    sens: str = BOUCLE
    cadre: Cadre = field(default_factory=Cadre)

    # Ce qui a été fait aux images. **Elle part de celle du jeu** et s'en écarte
    # si l'auteur le veut ; ce qui s'en écarte est écrit en clair à l'écran, à
    # côté du chiffre changé. La règle du 3 septembre 2026 : *la recette du jeu
    # est le point de départ, jamais une prison.*
    recette: Recette = field(default_factory=Recette)

    # La case du plan de poses qu'elle remplit. Les quatre ensemble, ou aucun :
    # une bande affectée à une pose sans personnage ne veut rien dire.
    projet: str | None = None
    personnage: str | None = None
    pose: str | None = None
    direction: str | None = None

    # ── Ce qu'elle porte par-dessus le corps (B20) ───────────────────────────
    #
    # **Le champ qui manquait au rangement.** Une bande portait les quatre
    # ci-dessus et rien de plus ; les mots *pièce* et *équipement* n'existaient
    # nulle part dans la couche animation, et une animation habillée n'avait
    # donc nulle part où se ranger.
    #
    # Vide veut dire **le corps nu**, et c'est le cas de toutes les bandes du
    # dépôt : une bande d'avant `B20` se relit sans habillage sans qu'un fichier
    # ait été réécrit.
    #
    # ⚠️ **La direction est ici, le calque ne l'a pas.** Habiller les quatre
    # bandes d'une pose consulte quatre fois le même calque — celui de la pose.
    # C'est ce qui fait tenir l'invariant de `C3` en ajoutant l'axe des
    # directions : il est porté par la bande, jamais par ce qu'on pose dessus.
    habillage: Habillage | None = None

    # Les nombres du calage, une entrée par image retenue. **Un cache, comme la
    # planche** : les effacer ne perd rien, le recalage les refait sur la
    # machine et ne demande aucun fournisseur. Ils sont gardés parce que les
    # relire est immédiat et que les refaire demande un instant — pas parce
    # qu'ils seraient la vérité.
    calages: tuple[CalageParImage, ...] = ()

    # **Le calage que l'auteur a posé à la main sur cette animation**, gardé
    # pour la pièce suivante. Même geste et même objet que sur une image de
    # référence (`M1`) : un jeu de nombres qui marche pour un casque marchera à
    # peu près pour le suivant, puisque c'est le même corps qui bouge de la même
    # façon. Il revient prérempli, avec sa provenance écrite, et se défait d'un
    # clic — comme tout ce que le produit devine.
    #
    # Il vit sur la bande **nue**, et c'est ce qui le rend réutilisable : une
    # bande habillée est celle d'une pièce, la bande nue est celle du corps que
    # toutes les pièces partagent.
    calage_garde: ReglagesGardes | None = None

    # La planche de sprites déjà calculée. **Un cache, et rien d'autre** :
    # l'effacer ne perd rien, la recalculer coûte des millisecondes.
    planche: str | None = None
    case_largeur: int = 0
    case_hauteur: int = 0

    cree_le: float = field(default_factory=time.time)

    # ── Le rangement, le jugement, l'écart (B11) ─────────────────────────────
    #
    # **Le report de trois colonnes qui existent sur `Asset` depuis T3**, et
    # rien de plus : une bande se juge et s'écarte exactement comme une image,
    # et lui refuser ces trois champs aurait voulu dire garder deux calques —
    # images et animations — qui se comportent différemment devant le même
    # geste de l'auteur.
    #
    # **Les défauts font qu'une bande d'avant `B11` se relit sans perte** : pas
    # de retenue, rang neutre, pas écartée — exactement ce qu'elle était avant
    # que ces champs n'existent. Même garde que `Collection.membres` avant
    # `B8.2` : une fiche sans la clé rend un état vide, pas une erreur.
    #
    # `favori` — laquelle sort dans le jeu. **Aucune règle ne l'impose encore ici** :
    # contrairement à `corps_retenu` pour les images, rien dans ce dépôt ne lit
    # ce champ pour décider ce qui s'exporte — `B12`/`B13` en décideront le jour
    # où une bande précise doit jouer dans le moteur. Pour l'instant, il ne sert
    # qu'à l'écran *Ses animations*, qui départage comme la matrice le fait déjà
    # pour les images (`docs/PIEGES.md`).
    favori: bool = False
    # `rang` — un départage de plus quand deux bandes partagent la même seconde
    # de création, comme sur un asset. **Aucun geste de ce dépôt ne le règle
    # encore** : une bande n'a pas d'emplacement d'où le tirer, contrairement à
    # un asset qui naît d'un rang de génération. Il existe pour que le tri
    # `cree_le, rang` soit écrit une fois, à la même forme des deux côtés du
    # calque — images et animations —, prêt pour la tranche qui voudra
    # réordonner à la main.
    rang: int = 0
    # `supprime_le` — l'écart, non destructif, même règle qu'un asset
    # (`ServiceBibliotheque.supprimer`) : la bande sort du rangement tout de
    # suite, ses fichiers attendent le même délai avant de partir pour de bon.
    supprime_le: float | None = None

    @property
    def brouillon(self) -> bool:
        """Aucune case visée. Elle existe, elle sert, elle ne remplit rien."""
        return not (self.personnage and self.pose)

    @property
    def supprime(self) -> bool:
        """Hors rangement. Ses fichiers sont peut-être encore là — l'annulation
        court —, mais plus rien ne le montre ni ne la compte dans une case."""
        return self.supprime_le is not None

    @property
    def piece(self) -> str | None:
        """La pièce qu'elle porte, ou rien — **lue, jamais rangée deux fois**.

        C'est ce que le rangement demande (une colonne, comme `pose`), et c'est
        une question qu'on pose partout. La tirer de l'habillage plutôt que de
        tenir un second champ est ce qui empêche les deux de se contredire —
        la même raison qui fait d'`images` une lecture de `prises`.
        """
        return self.habillage.piece if self.habillage else None

    @property
    def habillee(self) -> bool:
        """Porte-t-elle quelque chose ? Une bande nue est le corps seul."""
        return self.habillage is not None

    @property
    def images(self) -> tuple[int, ...]:
        """Les numéros seuls, dans l'ordre — ce que la bande retenait avant `A7`.

        Gardé lisible parce que la moitié du produit ne veut que ça : compter
        les images, les redemander au disque, les écrire dans un descriptif. En
        faire une lecture plutôt qu'un second champ est ce qui empêche les deux
        de se contredire.
        """
        return tuple(prise.numero for prise in self.prises)

    @property
    def clips(self) -> tuple[str, ...]:
        """Les clips dont la bande tire ses images, **dans l'ordre d'apparition**.

        Un seul, presque toujours. Plusieurs depuis `A7`, quand deux clips sont
        chacun bons à moitié — et l'écran le dit alors image par image, comme
        une image dit de quel clip elle vient.
        """
        vus: list[str] = []
        for prise in self.prises:
            venue = prise.clip_ou(self.clip)
            if venue and venue not in vus:
                vus.append(venue)
        return tuple(vus)

    @property
    def melangee(self) -> bool:
        """Ses images viennent-elles de plusieurs clips ?"""
        return len(self.clips) > 1

    @property
    def compte(self) -> int:
        return len(self.prises)

    @property
    def secondes(self) -> float:
        """La durée d'un tour, telle qu'elle tournera dans le jeu.

        > ### ⚠️ Un aller-retour durait deux images de trop (corrigé en `A4`,
        > ### 4 septembre 2026)
        >
        > Le compte était `compte × 2`, ce qui suppose que les deux bouts se
        > rejouent au demi-tour. Ni l'écran ne le fait — la vignette de la
        > matrice repart sur l'avant-dernière image —, ni le format d'export.
        > Sur huit images à huit par seconde, la fiche annonçait deux secondes
        > là où l'écran en jouait une et trois quarts. Personne ne l'avait vu :
        > ce nombre ne paraissait nulle part. `A4` le fait sortir de l'atelier,
        > et un nombre qui part dans un fichier de jeu doit être celui que le
        > fichier joue.
        """
        if self.cadence <= 0:  # pragma: no cover — refusé à l'écriture
            return 0.0
        jouees = (
            max(self.compte * 2 - 2, self.compte)
            if self.sens == ALLER_RETOUR
            else self.compte
        )
        return round(jouees / self.cadence, 2)

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "clip": self.clip,
            "nom": self.nom,
            # **Les deux, et ce n'est pas une redite.** `images` est ce que
            # lisent l'export, la matrice et tout ce qui ne veut que compter ;
            # `prises` est ce que l'écran de montage corrige. La première se
            # calcule à partir de la seconde, donc elles ne peuvent pas diverger.
            "images": list(self.images),
            "prises": [prise.en_json() for prise in self.prises],
            "chutier": [prise.en_json() for prise in self.chutier],
            "clips": list(self.clips),
            "melangee": self.melangee,
            "cadence": self.cadence,
            "sens": self.sens,
            "cadre": self.cadre.en_json(),
            "recette": self.recette.en_json(),
            "projet": self.projet,
            "personnage": self.personnage,
            "pose": self.pose,
            "direction": self.direction,
            # **`piece` est écrite à plat en plus de l'habillage**, et pour la
            # même raison qu'`images` accompagne `prises` : c'est ce que lisent
            # le rangement, la matrice et tout ce qui ne veut que trier. Elle se
            # calcule depuis l'habillage, donc les deux ne peuvent pas diverger.
            "piece": self.piece,
            "habillage": self.habillage.en_json() if self.habillage else None,
            "habillee": self.habillee,
            "calages": [c.en_json() for c in self.calages],
            "calage_garde": (
                self.calage_garde.en_json() if self.calage_garde else None
            ),
            "planche": self.planche,
            "case_largeur": self.case_largeur,
            "case_hauteur": self.case_hauteur,
            "cree_le": self.cree_le,
            "compte": self.compte,
            "secondes": self.secondes,
            "brouillon": self.brouillon,
            "favori": self.favori,
            "rang": self.rang,
            "supprime_le": self.supprime_le,
            "supprime": self.supprime,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Bande":
        sens = str(d.get("sens") or BOUCLE)
        return Bande(
            identifiant=str(d["identifiant"]),
            clip=str(d.get("clip") or ""),
            nom=str(d.get("nom") or ""),
            # **`prises` d'abord, `images` à défaut.** Une bande gardée avant
            # `A7` n'écrit que la seconde, et la relire ainsi est exactement ce
            # qu'elle voulait dire — aucune migration, aucune table réécrite.
            prises=tuple(
                Prise.depuis_json(p)
                for p in (d.get("prises") or d.get("images") or ())
            ),
            # Absent veut dire **vide**, et c'est le cas de toutes les bandes
            # d'avant la V3.03.3 : le chutier est une réserve, pas un état
            # qu'il faudrait deviner.
            chutier=tuple(Prise.depuis_json(p) for p in (d.get("chutier") or ())),
            cadence=float(d.get("cadence") or CADENCE_PAR_DEFAUT),
            sens=sens if sens in SENS else BOUCLE,
            cadre=Cadre.depuis_json(d.get("cadre")),
            recette=Recette.depuis_json(d.get("recette") or {}),
            projet=d.get("projet") or None,
            personnage=d.get("personnage") or None,
            pose=d.get("pose") or None,
            direction=d.get("direction") or None,
            # Absents pour toute bande d'avant `B20`, et pour toute bande nue :
            # les deux se relisent comme le corps seul, ce qu'elles sont.
            habillage=Habillage.depuis_json(d.get("habillage")),
            calages=calages_depuis_json(d.get("calages")),
            calage_garde=(
                ReglagesGardes.depuis_json(d["calage_garde"])
                if isinstance(d.get("calage_garde"), dict)
                else None
            ),
            planche=d.get("planche") or None,
            case_largeur=int(d.get("case_largeur", 0)),
            case_hauteur=int(d.get("case_hauteur", 0)),
            cree_le=float(d.get("cree_le") or time.time()),
            # Absents pour toute bande d'avant B11 : pas de retenue, rang
            # neutre, pas écartée — l'état d'une bande telle qu'elle a toujours
            # été avant que ces trois champs n'existent.
            favori=bool(d.get("favori", False)),
            rang=int(d.get("rang", 0)),
            supprime_le=d.get("supprime_le"),
        )
