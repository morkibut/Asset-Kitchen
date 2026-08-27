# -*- coding: utf-8 -*-
"""Un asset — une image brute, une recette, et ce qu'on a mesuré dessus.

**L'asset naît à l'arrivée de l'image**, pas au premier geste de retouche. Un
emplacement qui réussit produit un asset dans la seconde, avec une recette vide.
C'est ce qui évite deux vérités : sans ça, l'emplacement et l'asset diraient tous
les deux ce qu'est cette image, et T3 aurait à les fondre.

Trois invariants se rejoignent ici, et ils viennent de trois tranches :

- **Les dimensions mesurées font foi** (T1) — celles du brut *et* celles du
  rendu, chacune mesurée sur le fichier, jamais déduite d'un calcul.
- **Le traitement est non destructif** (T2) — `brut` ne change jamais, `rendu`
  est un cache nommé par l'empreinte de la recette. Effacer le rendu ne perd
  rien ; effacer le brut perdrait tout, et rien dans le produit ne l'efface.
- **Les fichiers font foi, la base est un index reconstructible** (T3, payé ici)
  — l'enregistrement de l'asset est écrit à côté de ses images. La bibliothèque
  se reconstruira en relisant le disque, sans rien à rétro-adapter.

Le rangement, la filiation et le jugement — `projet`, `collection`, `parent`,
`favori` — ont été déclarés en T2 et sont écrits depuis T3. Les déclarer d'avance
a coûté quatre champs ; les ajouter après coup aurait coûté une migration.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from atelier.domaine.recette import Recette


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
    # « Toucher une recette à la main épingle l'asset » (`docs/PRD.md`, § La
    # palette rétroactive). Écrit dès T2, relu en T4 : un changement de palette
    # de projet saute les épinglés et rend son compte.
    epingle: bool = False

    # ── Ce que l'appel a facturé pour cette image-là ─────────────────────────
    #
    # **Une copie, prise à la naissance**, et le seul chiffre de ce fichier qui
    # ne se mesure pas sur l'image. Il est ici parce que la tuile le porte
    # (`docs/DESIGN.md` § La tuile : `64×64 · $0,067`) et que la grille de T3
    # est faite d'assets, plus de générations : sans lui, chaque tuile devrait
    # aller chercher sa génération pour afficher trois caractères.
    #
    # **La génération reste la vérité** sur le coût, et le total d'un projet se
    # calcule sur elle seule — elle est la seule à porter les appels **ratés**,
    # qui coûtent et ne produisent aucun asset (US-24). Aucune divergence
    # possible : `naitre()` est le seul endroit qui écrive ce champ.
    cout_usd: float = 0.0

    # ── Le rangement, la filiation, le jugement ──────────────────────────────
    projet: str | None = None
    collection: str | None = None
    parent: str | None = None
    favori: bool = False

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
        return {
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
            "cout_usd": self.cout_usd,
            "projet": self.projet,
            "collection": self.collection,
            "parent": self.parent,
            "parent_supprime": self.parent_supprime,
            "favori": self.favori,
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
            cout_usd=float(d.get("cout_usd", 0.0)),
            projet=d.get("projet"),
            collection=d.get("collection"),
            parent=d.get("parent"),
            parent_supprime=d.get("parent_supprime", False),
            favori=d.get("favori", False),
            supprime_le=d.get("supprime_le"),
        )


def identifiant_de(generation: str, rang: int) -> str:
    """Un asset se nomme par l'appel qui l'a produit et l'emplacement qu'il tenait.

    Aucun tirage au sort : deux relances du même emplacement doivent tomber sur
    le même asset et l'écraser, sinon un raté relancé laisserait derrière lui un
    orphelin que rien ne montre et que rien ne supprime.
    """
    return f"{generation}-{rang}"
