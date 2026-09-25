# -*- coding: utf-8 -*-
"""Ce que l'auteur demande — avant qu'un modèle ne soit consulté."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from atelier.domaine.erreurs import DemandeRefusee


# La phrase du refus, écrite une fois : `Demande` la lève à la construction, et
# l'aperçu — qui ne construit pas de demande — la lève telle quelle (TS3).
REFUS_PREMIERE_ET_MISE_EN_PAGE = (
    "la première planche part d'un concept art, pas d'une planche à "
    "reproduire — décochez « garder la mise en page de la référence »"
)


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

    # **Découper la planche refaite dès qu'elle revient** (RS7, 18 septembre
    # 2026). L'auteur coupait chaque planche de Champy à la main, en quatre,
    # puis posait sa recette sur chaque morceau. Cochée, l'atelier coupe par
    # zones opaques à l'arrivée — et ne coupe rien si le compte tombe faux.
    #
    # **Elle n'a de sens qu'avec `garder_mise_en_page`** : sans elle, l'appel
    # rend un sprite seul, et le couper ferait des éclats. Refusée ici, à la
    # construction, pour que la route et l'agent reçoivent la même phrase.
    decouper_a_l_arrivee: bool = False

    # **La première planche d'un sujet** (TS3, 22 septembre 2026) : la pose de
    # repos dans les seules directions du jeu, d'après son concept art pris
    # comme le personnage à reproduire (rôle référence, jamais style). Le service
    # remplit la pose et les directions, et refuse avant de payer ce qui ne s'y
    # prête pas. Ici pour la raison de `palette` : aucun fournisseur ne la
    # déclare, c'est une décision du produit sur ce qui part.
    premiere_planche: bool = False

    # **L'image arrive brute** (TS4, 23 septembre 2026) : ni détourage, ni
    # réduction, ni grille, ni palette — la toile est l'endroit où l'on essaie,
    # pas encore une chose du jeu. Ici pour la raison de `palette` : aucun
    # fournisseur ne la déclare, c'est une décision du produit sur ce que
    # l'image reçoit à sa naissance (`ServiceAssets.recette_du_projet`,
    # `recette_du_sujet`, `_provenance_du_detourage`) — jamais sur ce qui part
    # au modèle, qui ne change pas. L'image brute au sens du disque
    # (`Asset.brut`) est de toute façon toujours gardée : c'est ce drapeau qui
    # décide si le *rendu* — le cache affiché — s'en écarte ou non.
    brut: bool = False

    # **Le fond vide a été demandé au modèle** (TN2, 25 septembre 2026). Jamais
    # posé par l'appelant : le service le décide (`transparence_demandee`, dans
    # `atelier/domaine/transparence.py`) au moment de composer le texte, et
    # l'enregistre ici parce que c'est un fait de l'appel — l'arrivée garde
    # l'alpha au lieu de l'aplatir, la relance repose les références sur le même
    # blanc, et TN3 endormira le détourage d'une image « demandée et reçue ».
    transparence: bool = False

    def __post_init__(self) -> None:
        if not self.prompt.strip():
            raise ValueError("prompt vide")
        if self.variations < 1:
            raise ValueError("au moins une variation")
        if self.decouper_a_l_arrivee and not self.garder_mise_en_page:
            # Refusée plutôt qu'ignorée, comme la case de RS2 : une case cochée
            # qui ne ferait rien laisserait croire que la planche sera coupée.
            raise DemandeRefusee(
                "découper à l'arrivée coupe une planche refaite — cochez aussi "
                "« garder la mise en page de la référence », ou décochez la découpe"
            )
        if self.premiere_planche and self.garder_mise_en_page:
            # Deux planches à la fois : l'une reproduit une planche existante,
            # l'autre fabrique la première. Refusé, jamais arbitré en silence.
            raise DemandeRefusee(REFUS_PREMIERE_ET_MISE_EN_PAGE)

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
        # Même règle (RS7) : absent tant que la case n'est pas cochée. C'est ce
        # que l'arrivée lit pour décider de couper, et la relance le relit.
        if self.decouper_a_l_arrivee:
            resume["decouper_a_l_arrivee"] = True
        # Même règle (TS3) : absent tant que ce n'est pas une première planche.
        if self.premiere_planche:
            resume["premiere_planche"] = True
        # Même règle (TS4) : absent tant que la case n'est pas cochée — un
        # `generation.json` d'avant cette tranche reste celui d'avant, et une
        # relance le relit.
        if self.brut:
            resume["brut"] = True
        # Même règle (TN2) : absent veut dire non, et c'est ce que toute
        # génération d'avant la tranche dit en se relisant (`demandee_par`).
        if self.transparence:
            resume["transparence"] = True
        return resume
