# -*- coding: utf-8 -*-
"""Ce que l'auteur demande — avant qu'un modèle ne soit consulté."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping


@dataclass(frozen=True, slots=True)
class Demande:
    """Un sujet, ce qu'on n'en veut pas, et le cadrage.

    `references` est vide en T1 jalon 1 : la réinjection d'un asset arrive en T3,
    les artworks officiels en T4. Le champ existe déjà parce que c'est lui qui
    décide du grisé d'un modèle, et que ce calcul ne doit pas être réécrit.
    """

    prompt: str
    prompt_negatif: str = ""
    proportions: str = "1:1"
    resolution: str | None = None
    variations: int = 1
    references: tuple[bytes, ...] = ()
    options: Mapping[str, Any] = field(default_factory=dict)

    # **Ce que l'auteur fabrique**, nommé dans le barème de son projet — arrivé
    # en T4. Un seul mot, et il décide de trois choses d'un coup : quels
    # artworks partent en référence (par la famille de l'échelle), quel modèle
    # est le défaut, et quelle part de la case le sujet occupera. C'est ce qui
    # garde « promouvoir est un geste unique » : il n'y a rien à sélectionner au
    # moment de générer, seulement à dire ce qu'on fabrique.
    #
    # Vide veut dire « je ne le dis pas », et c'est permis : un univers vide ne
    # contraint rien (US-57), et seuls les artworks marqués « tous » partent.
    echelle: str = ""

    # **Le texte est celui de l'auteur, mot pour mot** (US-159, US-160). Arrivé
    # en R2 : l'auteur a vu ce qui partait, il l'a repris à la main, et ce qu'il
    # a écrit part tel quel — la bible ne se replie pas en tête, les consignes
    # de planche ne s'ajoutent pas en queue. Elles sont déjà dans son texte,
    # puisque c'est celui-là même qu'il a vu et corrigé.
    #
    # **Ce drapeau ne touche que le texte.** L'échelle continue de décider des
    # artworks qui partent, du modèle par défaut et de l'occupation ; le gabarit
    # d'un lot part toujours ; les cases sont toujours vérifiées. Reprendre le
    # prompt n'est pas sortir du projet, c'est corriger une formulation sans
    # démonter la bible.
    repris: bool = False

    # **La palette part en image, et c'est une case qu'on coche** (E14). Une
    # bande de pastilles, dessinée par l'atelier, qui occupe une des places de
    # référence du modèle et qui coûte comme les autres. Elle est **redessinée à
    # chaque appel et jamais relue** — comme le gabarit d'une planche : elle n'a
    # pas d'identifiant, elle n'est nulle part sur le disque, et l'appel comme la
    # relance envoient donc la même image.
    #
    # **Ici et pas dans les options du modèle** : les options sont ce que le
    # catalogue déclare, et aucun fournisseur ne déclare celle-ci. C'est une
    # décision du produit sur ce qui part, du même genre que le texte repris.
    palette: bool = False

    # **Ce que l'auteur a tapé, gardé à part de ce qui part** — 1ᵉʳ septembre
    # 2026. `prompt` est remplacé par le texte assemblé juste avant l'appel :
    # la bible se replie en tête, les consignes de pose s'ajoutent, et le sujet
    # se retrouve au milieu. Ce champ-ci garde le sujet seul, et il n'a qu'un
    # emploi — **nommer l'asset**.
    #
    # La panne qu'il répare se voit dès qu'un jeu a une bible : un asset naissait
    # nommé `Rendering technique: 2D pixel art on a 64x64 grid, Technical…`,
    # parce que son nom est les soixante premiers signes du prompt et que les
    # soixante premiers signes du prompt sont ceux du jeu, pas ceux du sujet.
    # Deux épées du même jeu portaient donc le même nom, et ce nom ne disait
    # ni l'une ni l'autre.
    #
    # Vide, on retombe sur le prompt : c'est le cas d'un appel qui n'a pas de
    # sujet distinct — une reprise mot pour mot, un import — et le
    # comportement d'avant y est exactement le bon.
    sujet: str = ""

    # **Refaire une planche plutôt qu'un sprite** (RS2, 18 septembre 2026). La
    # planche des quatre directions de Champy est partie jointe avec « one
    # single sprite » dans le cadre et une caméra qui « l'emporte sur tout ce qui
    # précède » : le modèle a obéi au texte et rendu un seul Champy. Cochée, la
    # case retire ces deux phrases et demande de reproduire la planche jointe —
    # même nombre de vues, même ordre, même cadrage — en n'y changeant que ce
    # que le sujet décrit.
    #
    # **Ici et pas dans les options**, pour la raison de `palette` : aucun
    # fournisseur ne la déclare, c'est une décision du produit sur ce qui part.
    garder_mise_en_page: bool = False

    def __post_init__(self) -> None:
        if not self.prompt.strip():
            raise ValueError("prompt vide")
        if self.variations < 1:
            raise ValueError("au moins une variation")

    def resume(self) -> dict[str, Any]:
        """Les paramètres, sans les octets des références — pour l'enregistrement."""
        resume: dict[str, Any] = {
            "prompt": self.prompt,
            "prompt_negatif": self.prompt_negatif,
            "proportions": self.proportions,
            "resolution": self.resolution,
            "variations": self.variations,
            "references": len(self.references),
            "options": dict(self.options),
            "echelle": self.echelle,
            # **Enregistré, parce que c'est un fait de l'appel** : relire une
            # génération des mois plus tard doit dire si ce prompt-là est celui
            # que l'atelier a composé ou celui que l'auteur a écrit.
            "repris": self.repris,
            # Même raison : la bande de couleurs se redessine à la relance, donc
            # il faut savoir qu'elle était partie.
            "palette": self.palette,
            # Le sujet seul, pour nommer l'asset. Enregistré parce qu'une
            # génération relue doit pouvoir se renommer comme elle s'est nommée.
            "sujet": self.sujet,
        }
        # **Écrit seulement quand il est vrai** (RS2) : un `generation.json`
        # d'aujourd'hui reste celui d'hier, octet pour octet, tant que la case
        # n'est pas cochée. La relance le relit — voir `_demande_de`.
        if self.garder_mise_en_page:
            resume["garder_mise_en_page"] = True
        return resume
