# -*- coding: utf-8 -*-
"""Un asset — une image brute, une recette, et ce qu'on a mesuré dessus.

**L'asset naît à l'arrivée de l'image**, pas au premier geste de retouche. Un
emplacement qui réussit produit un asset dans la seconde, avec une recette vide.
C'est ce qui évite deux vérités : sans ça, l'emplacement et l'asset diraient tous
les deux ce qu'est cette image, et T3 aurait à les fondre.

Trois invariants se rejoignent ici, et ils viennent de trois tranches :

- **Les dimensions mesurées font foi** (T1) — celles du brut *et* celles du
  rendu, chacune mesurée sur le fichier, jamais déduite d'un calcul.
- **Le traitement est non destructif** (T2) — `brut` est l'image payée et ne
  change pas, `rendu` est un cache nommé par l'empreinte de la recette. Effacer
  le rendu ne perd rien ; effacer le brut perdrait tout, et rien dans le produit
  ne l'efface. **Une seule famille d'assets fait exception, et la règle y tient
  quand même** : un calque et une découpe de planche ont un brut *dérivé* d'une
  autre image — l'image payée est alors la planche, qui reste le brut de sa
  génération et que rien ne touche. Un brut dérivé est un cache d'un cran plus
  haut, et c'est ce qui permet de rejouer le recalage d'un calque sans repayer
  (R5, `docs/PLAN.md`).
- **Les fichiers font foi, la base est un index reconstructible** (T3, payé ici)
  — l'enregistrement de l'asset est écrit à côté de ses images. La bibliothèque
  se reconstruira en relisant le disque, sans rien à rétro-adapter.

Le rangement, la filiation et le jugement — `projet`, `parent`, `favori` — ont
été déclarés en T2 et sont écrits depuis T3. Les déclarer d'avance a coûté trois
champs ; les ajouter après coup aurait coûté une migration.

**`collection` a vécu ici de T3 à B8.4** — zéro ou une, posée par un rangement
sur l'image. Elle est partie avec la refonte de la collection en groupe libre
de **sujets** (`docs/PLAN-carnet.md` § B8) : une image n'appartient plus à une
collection en propre, c'est son sujet qui peut appartenir à plusieurs à la fois
(`atelier/domaine/projet.py`, `Collection.membres`).
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from atelier.domaine.consommation import USD, argent
from atelier.domaine.enregistrement import Origine
from atelier.domaine.equipement import MesuresCalque
from atelier.domaine.pliage import MesuresLot
from atelier.domaine.recette import Recette
from atelier.domaine.superposition import ReglagesGardes, Superposition


@dataclass(slots=True)
class Asset:
    identifiant: str
    generation: str
    rang: int

    # ── Le brut, et ce qu'on a mesuré dessus ─────────────────────────────────
    brut: str  # chemin relatif à `donnees/`
    largeur: int
    hauteur: int
    type_media: str

    label: str = ""
    recette: Recette = field(default_factory=Recette)

    # ── Le rendu — un cache, jamais une vérité ───────────────────────────────
    #
    # `empreinte` dit *de quelle recette* ce fichier est le rendu. Un fichier
    # présent dont l'empreinte ne correspond plus est aussi périmé qu'un fichier
    # absent : les deux se recalculent, et c'est le même chemin de code.
    rendu: str | None = None
    empreinte: str | None = None
    rendu_largeur: int = 0
    rendu_hauteur: int = 0

    cree_le: float = field(default_factory=time.time)

    # ── Ce que l'auteur a posé de sa main ────────────────────────────────────
    #
    # « Toucher une recette à la main épingle l'asset »
    # (`docs/prd-decisions.md` § La palette rétroactive). Écrit dès T2, relu en
    # T4 : un changement de palette de projet saute les épinglés et rend son
    # compte.
    epingle: bool = False

    # ── Ce que l'appel a facturé pour cette image-là ─────────────────────────
    #
    # **Une copie, prise à la naissance**, et le seul chiffre de ce fichier qui
    # ne se mesure pas sur l'image. Il est ici parce que la tuile le porte
    # (`docs/design-motifs.md` § La tuile : `64×64 · $0,067`) et que la grille de T3
    # est faite d'assets, plus de générations : sans lui, chaque tuile devrait
    # aller chercher sa génération pour afficher trois caractères.
    #
    # **La génération reste la vérité** sur le coût, et le total d'un projet se
    # calcule sur elle seule — elle est la seule à porter les appels **ratés**,
    # qui coûtent et ne produisent aucun asset (US-24). Aucune divergence
    # possible : `naitre()` est le seul endroit qui écrive ce champ.
    #
    # **Et depuis F2, l'unité voyage avec la quantité.** Sans elle, la tuile
    # d'une image faite chez un fournisseur gratuit afficherait `$0,0000` — le
    # mensonge par omission que la tranche existe pour fermer. `cout_usd` reste
    # lisible juste en dessous, déduit : c'est la part en argent, et elle vaut
    # zéro dès que l'unité n'est pas celle de l'argent.
    consomme: float = 0.0
    unite: str = USD

    # ── Qui l'a demandé ──────────────────────────────────────────────────────
    #
    # Hérité de la génération à la naissance, jamais recalculé (US-39). C'est un
    # fait sur l'appel : retoucher une image de l'agent ne la fait pas devenir
    # celle de l'auteur, et une découpe appartient à qui a demandé la planche.
    # Le défaut vaut pour tout ce qui existait avant T7.
    provenance: str = "auteur"

    # ── Le modèle qui a produit cette image ──────────────────────────────────
    #
    # « Savoir à qui redemander quand un résultat me plaît, et de qui me méfier
    # quand il me déçoit » (US-123). **Une copie prise à la naissance**, comme
    # le coût : la grille et la fiche sont faites d'assets, et aller chercher la
    # génération pour afficher un nom serait un aller-retour par tuile ouverte.
    #
    # La génération reste la vérité — c'est elle qu'on relance, et c'est d'elle
    # que le champ se reprend à chaque relance. Un asset écrit avant C1 ne le
    # porte pas : `rattraper()` va le chercher dans sa génération, comme il l'a
    # déjà fait pour le coût.
    #
    # `import` pour une image importée — la valeur que porte déjà sa génération,
    # rendue « importé » par l'écran. Le vide n'existe qu'à la relecture d'un
    # fichier antérieur, et il se répare.
    modele: str = ""

    # ── De quel personnage, et de quelle pose ────────────────────────────────
    #
    # Arrivés en C1 (US-119, US-120). **C'est l'image qui dit sa case, jamais le
    # personnage qui tient la liste de ses images** : la matrice se calcule à
    # partir d'ici, et il n'existe donc nulle part un état à tenir d'accord avec
    # ce que le disque contient. Un asset sans personnage est le cas courant —
    # la bibliothèque est faite d'images qui n'appartiennent à personne.
    #
    # La pose est désignée par son **identifiant**, pas par son nom : une pose se
    # renomme à tout moment (US-118), et un nom recopié ici ferait perdre leur
    # case à toutes les images déjà faites.
    personnage: str | None = None
    pose: str | None = None

    # ── Et sous quel angle (E10) ─────────────────────────────────────────────
    #
    # **L'angle sous lequel cette image-ci montre sa pose.** Une pose dans un
    # jeu vu de dessus se dessine quatre fois ; sans ce champ, le produit voyait
    # quatre images de « marche » sans savoir laquelle regardait le nord — et ne
    # pouvait donc pas dire qu'il en manquait une.
    #
    # **Vide n'est pas le sud.** Une image faite avant que le jeu ne déclare ses
    # directions ne connaît pas la sienne, et le produit ne la devine pas : elle
    # se range dans la première direction *avec la marque « à confirmer »*, qui
    # est un fait sur ce qu'on ne sait pas. Un rangement par défaut ne se fait
    # pas passer pour une déduction, et confirmer écrit la valeur ici.
    direction: str | None = None

    # ── Et de quelle pièce ───────────────────────────────────────────────────
    #
    # Arrivée en C3 (US-140). Le second axe de la matrice : la pose dit la ligne,
    # la pièce dit la colonne, et l'emplacement de la pièce dit où cette colonne
    # se range. Vide pour un corps — c'est la colonne de gauche, celle du corps
    # nu, et c'est le cas courant.
    #
    # **Elle ne dit pas ce que l'image est**, seulement de quoi elle parle. Un
    # calque et un corps habillé portent la même pièce ; c'est la **recette** qui
    # les distingue, parce qu'elle seule sait si une différence a été calculée
    # (`recette.calque`). Un drapeau de plus aurait été une seconde vérité sur
    # une question à laquelle la recette répond déjà.
    piece: str | None = None

    # ── Ce que le lot a mesuré sur cette case-là ─────────────────────────────
    #
    # Arrivé en C2 (US-135). Vide pour toute image qui n'est pas sortie d'une
    # planche pliée, c'est-à-dire pour l'immense majorité d'entre elles.
    #
    # **Une copie prise à la naissance**, comme `cout_usd` et `modele`, et pour
    # la raison exacte : la ligne de la matrice les porte, et aller chercher la
    # génération pour trois nombres serait un aller-retour par case affichée. La
    # génération garde le pliage entier — ce qui a été demandé, ce qui a été
    # refusé —, celui-ci ne garde que ce que la case a besoin de dire d'elle.
    #
    # **Elles n'empêchent rien.** Le compte d'images est le seul refus
    # automatique du produit ; ressemblance et dérive s'affichent et laissent
    # l'auteur décider (`docs/archive/plan-versions-tenues.md`, C2).
    lot: MesuresLot | None = None

    # ── De quelle planche, et de quel découpage de cette planche (P1) ────────
    #
    # **Pas `parent`, et c'est voulu.** `parent` veut dire « dérivée d'une autre
    # image » : la galerie range l'enfant sous lui, et le rejeu du recalage
    # (`_rangs_du_depliage`, C3) écarte justement ce qui a un parent pour ne
    # compter que les cases. Une image dépliée n'est pas une retouche de sa
    # planche, c'est une case de l'appel — lui donner un parent aurait changé
    # ces deux comportements sans que personne l'ait demandé.
    #
    # `planche` est l'identifiant de l'asset planche, `depliage` celui du
    # découpage qui l'a fait naître (`Depliage.identifiant`). Vides pour tout ce
    # qui n'est pas sorti d'un dépliage, **et pour ce qui a été déplié avant
    # P1** : rien ne les invente après coup. Écrits dans le fichier seulement
    # quand ils existent, pour que les enregistrements d'avant gardent leur
    # forme au caractère près.
    planche: str | None = None
    depliage: str | None = None

    # ── Ce que la différence a mesuré sur ce calque-là ───────────────────────
    #
    # Arrivées en C3 (US-147). Cinq nombres — silhouette retrouvée, corps
    # repeint, part ajoutée, échelle au retour, objet ou poussière —, **et aucun
    # ne refuse** : le compte d'images reste le seul refus automatique du
    # produit. Une copie prise à la naissance, comme `lot` juste au-dessus, et
    # pour la même raison.
    #
    # Portées aussi par un **corps habillé** : c'est là qu'on lit l'échelle qui
    # a fait renoncer au calque (US-148).
    calque: MesuresCalque | None = None

    # ── Ce qui l'a fabriquée, quand deux images l'ont fabriquée ──────────────
    #
    # **Arrivée en E6, et hors de la recette** : une recette décrit comment
    # *une* image se rend, et celle-ci nomme un second asset. Le dessus a donné
    # les pixels et le parent ; le dessous est une **référence**, gardée pour
    # que la superposition se rejoue sans redemander une image au fournisseur.
    # Vide pour tout ce qui n'est pas sorti d'une superposition, c'est-à-dire
    # pour l'immense majorité des images.
    superposition: "Superposition | None" = None

    # **Ce qu'on reprendra la prochaine fois qu'on superpose sur cette
    # image-là.** Attachés à l'image de **référence**, jamais au calque : un jeu
    # de réglages qui marche pour un casque marche à 90 % pour le suivant, parce
    # que c'est le même corps et le même cadrage. Les passages de la main n'y
    # sont pas — ils sont dessinés sur une pièce précise.
    reglages_superposition: "ReglagesGardes | None" = None

    # Posé à l'instant où le personnage part, exactement comme `parent_supprime`
    # et pour la même raison : jamais de cascade, l'image reste, et elle sait
    # seulement de qui elle n'est plus. L'annonce porte alors la vérité au lieu
    # d'un renvoi vers une table à consulter.
    personnage_supprime: bool = False

    # ── Le rangement, la filiation, le jugement ──────────────────────────────
    projet: str | None = None
    parent: str | None = None
    favori: bool = False

    # ── C'est un ingrédient, pas une chose du jeu (RG5, 20 septembre 2026) ───
    #
    # **Posé par la génération, jamais déclaré à part.** Une image dont la
    # demande portait `echelle="matière"` (`ServiceGenerations.soumettre_matiere`)
    # naît ainsi marquée — le même mot qui lui donnait déjà sa recette de
    # naissance (`docs/RG5-la-bibliotheque-des-matieres.md` §3), rien n'est
    # inventé. L'auteur peut aussi le poser à la main sur une image ordinaire,
    # ou le retirer : `edit_asset` et la fiche de l'image en RG6 passent tous
    # deux par ici, jamais par un second champ.
    #
    # **Ce que ça ne fait pas.** Le marqueur décide de ce qu'une matière est —
    # une entrée de la bibliothèque, groupable en collections — jamais de ce
    # qu'un jeu de tuiles accepte dans un emplacement : `_asset_valide`
    # (`atelier/services/tuiles.py`) reste ouvert à toute image du projet, sinon
    # un jeu déjà composé sur une image non marquée casserait à la première
    # relecture.
    matiere: bool = False

    # ── D'où elle vient quand elle a été *enregistrée sous* (RP20) ───────────
    #
    # **Le parent ne suffisait plus ici.** Une découpe et un miroir gardent la
    # recette de leur parent : on peut donc lire ce qui leur a été fait. Une
    # image enregistrée sous une autre case a une recette **vide** — son brut
    # *est* le rendu —, et sans ce champ rien ne dirait plus ce qui avait été
    # appliqué. `parent` reste écrit à côté : c'est lui qui fait que
    # `Base.enfants` retrouve le dérivé depuis l'original, sans qu'aucune liste
    # soit tenue là-bas (`atelier/domaine/enregistrement.py`).
    origine: "Origine | None" = None

    # **Un fait acquis à l'instant où le parent part**, pas une déduction refaite
    # à chaque affichage. Supprimer un parent touche déjà ses enfants — il faut
    # les annoncer pour que leur pastille paraisse —, donc marquer ne coûte rien
    # de plus, et l'annonce porte alors la vérité au lieu d'un renvoi vers une
    # table à consulter. Jamais de cascade : l'enfant reste, il sait seulement
    # d'où il ne vient plus (US-28, US-29).
    parent_supprime: bool = False

    # ── La suppression, et son instant d'annulation ──────────────────────────
    #
    # Pas de corbeille (`docs/PRD.md` § Hors périmètre) : l'asset quitte la
    # bibliothèque au moment du geste, et il ne reste qu'un court instant pour
    # revenir en arrière. Passé ce délai, les fichiers partent pour de bon —
    # c'est le service qui balaie, jamais une minuterie.
    supprime_le: float | None = None

    # ── Ce qui se déduit ─────────────────────────────────────────────────────

    @property
    def traite(self) -> bool:
        """Y a-t-il quelque chose à montrer d'autre que le brut ?"""
        return not self.recette.vide

    @property
    def cout_usd(self) -> float:
        """La part en argent de ce que l'appel a consommé pour cette image (F2).

        Déduite, comme sur l'emplacement dont elle est la copie : une image
        faite chez un fournisseur qui compte en jetons vaut zéro dollar, et
        aucun total en argent ne peut donc la compter.
        """
        return argent(self.consomme, self.unite)

    @property
    def supprime(self) -> bool:
        """Hors bibliothèque. Les fichiers sont peut-être encore là — l'annulation
        court —, mais plus rien ne le montre ni ne le compte."""
        return self.supprime_le is not None

    @property
    def rendu_a_jour(self) -> bool:
        """Le fichier de rendu correspond-il à la recette courante ?

        Ne dit rien de sa présence sur le disque — ça, c'est au dépôt de le
        regarder. Les deux réponses mènent au même geste : recalculer.
        """
        return self.rendu is not None and self.empreinte == self.recette.empreinte()

    def en_json(self) -> dict[str, Any]:
        contenu: dict[str, Any] = {
            "identifiant": self.identifiant,
            "generation": self.generation,
            "rang": self.rang,
            "brut": self.brut,
            "largeur": self.largeur,
            "hauteur": self.hauteur,
            "type_media": self.type_media,
            "label": self.label,
            "recette": self.recette.en_json(),
            "rendu_largeur": self.rendu_largeur,
            "rendu_hauteur": self.rendu_hauteur,
            "cree_le": self.cree_le,
            "epingle": self.epingle,
            "consomme": self.consomme,
            "unite": self.unite,
            # Déduit, écrit quand même — la tuile d'avant la V2.2 le lit.
            "cout_usd": self.cout_usd,
            "provenance": self.provenance,
            "modele": self.modele,
            "personnage": self.personnage,
            "pose": self.pose,
            "direction": self.direction,
            "piece": self.piece,
            "lot": self.lot.en_json() if self.lot else None,
            "calque": self.calque.en_json() if self.calque else None,
            "superposition": (
                self.superposition.en_json() if self.superposition else None
            ),
            "reglages_superposition": (
                self.reglages_superposition.en_json()
                if self.reglages_superposition
                else None
            ),
            "personnage_supprime": self.personnage_supprime,
            "projet": self.projet,
            "parent": self.parent,
            "origine": self.origine.en_json() if self.origine else None,
            "parent_supprime": self.parent_supprime,
            "favori": self.favori,
            "matiere": self.matiere,
            "supprime_le": self.supprime_le,
            # déduits — présents pour l'interface, jamais relus
            "traite": self.traite,
            # L'empreinte de la **recette**, pas du fichier. Le rendu change sous
            # la même adresse à chaque cran de curseur : sans elle dans l'URL, le
            # navigateur resservirait l'image d'avant. Elle vient du serveur et
            # d'aucun calcul refait à l'écran — deux empreintes calculées à deux
            # endroits finiraient par diverger sur un détail de sérialisation.
            "empreinte": self.recette.empreinte(),
        }
        # Seulement quand ils existent (P1) — voir la déclaration des champs.
        if self.planche:
            contenu["planche"] = self.planche
        if self.depliage:
            contenu["depliage"] = self.depliage
        return contenu

    def en_disque(self) -> dict[str, Any]:
        """Ce qui s'écrit à côté de l'image. Porte en plus le chemin du cache,
        que l'interface n'a aucune raison de connaître : elle demande une image à
        une route, pas un chemin de fichier.

        `empreinte` y est celle **du rendu posé sur le disque**, qui peut être en
        retard d'un cran sur celle de la recette — c'est exactement ce qui dit
        qu'il faut recalculer."""
        return {**self.en_json(), "rendu": self.rendu, "empreinte": self.empreinte}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Asset":
        return Asset(
            identifiant=d["identifiant"],
            generation=d["generation"],
            rang=d["rang"],
            brut=d["brut"],
            largeur=d.get("largeur", 0),
            hauteur=d.get("hauteur", 0),
            type_media=d.get("type_media", "image/png"),
            label=d.get("label", ""),
            recette=Recette.depuis_json(d.get("recette")),
            rendu=d.get("rendu"),
            empreinte=d.get("empreinte"),
            rendu_largeur=d.get("rendu_largeur", 0),
            rendu_hauteur=d.get("rendu_hauteur", 0),
            cree_le=d.get("cree_le", 0.0),
            epingle=d.get("epingle", False),
            # Une image d'avant la V2.2 n'a pas d'unité : elle est en dollars,
            # et sa quantité est le montant qu'elle portait.
            consomme=float(d.get("consomme", d.get("cout_usd", 0.0))),
            unite=str(d.get("unite", USD)),
            provenance=d.get("provenance", "auteur"),
            modele=d.get("modele", ""),
            personnage=d.get("personnage"),
            pose=d.get("pose"),
            direction=d.get("direction"),
            piece=d.get("piece"),
            lot=MesuresLot.depuis_json(d.get("lot")),
            planche=d.get("planche") or None,
            depliage=d.get("depliage") or None,
            calque=MesuresCalque.depuis_json(d.get("calque")),
            superposition=(
                Superposition.depuis_json(d["superposition"])
                if d.get("superposition")
                else None
            ),
            reglages_superposition=(
                ReglagesGardes.depuis_json(d["reglages_superposition"])
                if d.get("reglages_superposition")
                else None
            ),
            personnage_supprime=d.get("personnage_supprime", False),
            projet=d.get("projet"),
            parent=d.get("parent"),
            origine=Origine.depuis_json(d.get("origine")),
            parent_supprime=d.get("parent_supprime", False),
            favori=d.get("favori", False),
            matiere=d.get("matiere", False),
            supprime_le=d.get("supprime_le"),
        )


def identifiant_de(generation: str, rang: int) -> str:
    """Un asset se nomme par l'appel qui l'a produit et l'emplacement qu'il tenait.

    Aucun tirage au sort : deux relances du même emplacement doivent tomber sur
    le même asset et l'écraser, sinon un raté relancé laisserait derrière lui un
    orphelin que rien ne montre et que rien ne supprime.
    """
    return f"{generation}-{rang}"
