# -*- coding: utf-8 -*-
"""Le personnage — un nom, une description, et les cases qu'il réclame.

« Créer un personnage dans mon projet et le décrire une fois, afin de fabriquer
toutes ses images sans réécrire son signalement à chaque prompt » (US-115). Sa
description part avec chaque génération de pose ; elle ne se retape jamais.

**Ce n'est pas une image de plus, et il n'en porte aucune.** Un corps est un
asset ordinaire, rangé dans la même bibliothèque que le reste, et c'est *lui*
qui dit de quel personnage et de quelle pose il est (`atelier/domaine/asset.py`).
La matrice se calcule donc à partir des assets, et il n'existe nulle part une
liste de cases pleines qu'il faudrait tenir d'accord avec ce que le disque
contient. C'est la règle « un état dérivable ne se garde pas en double », et
c'est aussi ce qui rend vraie sans effort la promesse « supprimer un personnage
laisse ses images en place ».

**Il porte ce qu'il écarte, pas ce qu'il tient.** À l'écran on coche des poses
tenues ; sur le disque on range celles qu'on ne tient pas. Le sens est le même,
la panne évitée ne l'est pas : ajouter une pose au plan doit ajouter une case
vide à *chaque* personnage (`docs/archive/plan-versions-tenues.md` C1), et avec une liste de poses
tenues il aurait fallu réécrire tous les personnages du projet à chaque ajout —
un balayage capable de réussir à moitié, pour un geste qui ne devrait rien
écrire du tout. Avec l'écart, la case neuve paraît partout sans qu'un seul
fichier soit touché.

**Ce qu'il désigne reste où c'est.** Les concept arts sont des cartes du tableau
d'inspiration, désignées par leur identifiant (US-124) : elles ne sont ni
copiées, ni rangées ailleurs. La carte, elle, ne sait pas qui la désigne — deux
personnages peuvent désigner la même, et un champ sur la carte ne saurait pas
dire lequel.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Iterable

from atelier.domaine.ambiance import CE_QU_ON_PREND, TOUT
from atelier.domaine.direction import Direction
from atelier.domaine.objectifs import ObjectifProduction
from atelier.domaine.projet import CHAMPS_BIBLE
from atelier.domaine.plan import Pose, plan_depuis_json


@dataclass(slots=True)
class Personnage:
    identifiant: str
    projet: str
    nom: str
    description: str = ""

    # ── Le type d'objet, et ce que cette chose ajoute pour elle seule (E9) ───
    #
    # **Le type donne la liste de base.** Un personnage a ses six attitudes, un
    # meuble ses trois états, une tuile aucune ; avant E9 le jeu n'en déclarait
    # qu'une et un coffre héritait de *marche*. Vide, la chose retombe sur le
    # plan du projet — c'est ce qui reprend les personnages d'avant sans qu'un
    # seul fichier ait été réécrit.
    type: str = ""

    # **Ce que cette chose-là ajoute, et personne d'autre.** Un boss garde les
    # six poses de son type et en ajoute une à lui seul, sans que les autres
    # personnages voient paraître une case vide qui ne les concerne pas.
    ajoutees: tuple[Pose, ...] = ()

    # ── Son ambiance, et ce qu'elle lui prend (E11) ──────────────────────────
    #
    # **Une ambiance ne s'impose pas : on la désigne, puis on choisit ce qu'on
    # lui prend.** C'est ce qui distingue le modèle retenu de celui qui avait
    # été écrit avant — trois étages d'héritage automatique, abandonnés. Ici ce
    # n'est plus un héritage subi, c'est un choix.
    #
    # **Et c'est la chose du jeu qui la porte, jamais la collection où elle est
    # rangée.** Une collection reste un dossier qui ne décide de rien : grouper
    # vingt monstres et régler leur style sont deux gestes différents, et les
    # confondre ferait qu'un rangement changerait des réglages.
    ambiance: str = ""
    prend: str = TOUT

    # ── Ce qu'elle écrit pour elle seule, et ce qu'elle éteint (E12) ─────────
    #
    # **Une chose du jeu part toujours des textes du jeu**, puis son ambiance en
    # remplace trois, puis ce qui est écrit ici remplace les deux autres. Trois
    # couches, dans cet ordre, et la fiche écrit à côté de chaque texte laquelle
    # a gagné : *du jeu*, *son ambiance*, *écrit ici*, *éteint*, *verrouillé*.
    #
    # **Un texte écrit ici est un écart, et le produit le dit plutôt que de
    # l'empêcher** : une chose qui écrit ses propres textes diverge du reste du
    # jeu, et ce qui tient contre ça est que l'écart se voit sans qu'on le
    # cherche — la fiche compte *3 champs sur 7 posés ici*, et chaque case
    # remplacée montre le texte qu'elle écarte, barré, juste en dessous.
    #
    # **Éteindre n'est pas vider.** Une case vide est un texte qu'on n'a pas
    # écrit ; une case éteinte est un refus écrit — ce champ ne part pas pour
    # cette chose-là, et il se rallume d'un clic. Les confondre aurait rendu le
    # refus indistinguable de l'oubli, et donc impossible à défaire.
    textes: dict[str, str] = field(default_factory=dict)
    eteints: tuple[str, ...] = ()

    # ── Les images fabriquées qu'elle promeut en référence (E12) ────────────
    #
    # **La correction du frottement le plus cher du dépôt.** Dix-sept appels
    # payés sur vingt-huit sont partis sans une seule image de référence, sur des
    # modèles qui en acceptent quatorze. Une image que l'atelier a produite
    # devient ici une référence permanente de sa chose : elle repart avec chaque
    # appel suivant, et c'est ce qui fait qu'un personnage se ressemble d'une
    # pose à l'autre.
    #
    # **Des assets, pas des cartes** — c'est ce qui la distingue de
    # `concept_arts`, qui désigne des cartes du tableau d'inspiration. Les deux
    # partent ensemble et se dédoublonnent en aval, comme les trois sources de
    # références depuis T4.
    references: tuple[str, ...] = ()

    # ── Ce que chacune de ces références montre (RS1) ────────────────────────
    #
    # **Une planche des quatre directions partait comme une vue de face** — le
    # 18 septembre 2026, Champy est revenu seul, en isométrique, parce que le
    # texte le décrivait comme « le même personnage » et rien d'autre
    # (`docs/PLAN-references-du-sujet.md`). Un usage dit donc quand elle part et
    # comment la nommer : `libre` (toujours, comme avant), `planche` (toutes les
    # vues sur une image), ou `direction:<id>` (le sujet vu sous cet angle).
    #
    # **Absent vaut `libre`, et seul ce qui n'est pas libre s'écrit** : un
    # fichier d'avant la tranche n'a pas la clé, et ce qui part aujourd'hui ne
    # change pas tant que l'auteur ne range rien. Aucune migration. Une clé qui
    # ne désigne plus une référence promue ne gêne pas : elle n'est jamais lue.
    usages_des_references: dict[str, str] = field(default_factory=dict)

    # ── L'ordre des vues de sa planche (RS8) ─────────────────────────────────
    #
    # **Une direction par vue, de gauche à droite puis de haut en bas** — ce que
    # l'auteur dit une fois pour toutes de sa planche (« sud, est, nord,
    # ouest »), et que la découpe à l'arrivée lit pour ranger chaque morceau
    # (`docs/PLAN-references-du-sujet.md`, décision 8). La direction vient de la
    # position, jamais d'une devinette.
    #
    # **Rangé par image, pas sur le sujet** : l'ordre décrit *cette* planche-là.
    # Ranger une autre image en planche ne lui prête pas l'ordre de la
    # première, et c'est l'image partie avec l'appel qui dit l'ordre à lire.
    # Absent vaut « aucun ordre » : aucune migration, et les morceaux arrivent
    # sans direction, comme avant la tranche.
    ordres_des_vues: dict[str, tuple[str, ...]] = field(default_factory=dict)

    # ── La recette de ses images (RS6) ───────────────────────────────────────
    #
    # **Le nom d'une recette nommée, ou rien.** Le 18 septembre 2026, l'auteur
    # appliquait « champy 01 » à la main sur chaque image de Champy, une par
    # une, après chaque découpe (`docs/PLAN-references-du-sujet.md`, décision
    # 6). Nommée ici, elle remplace la recette du jeu **à la naissance** de
    # toute image faite pour ce sujet ; une image déjà née ne change pas.
    #
    # **Un nom, jamais une copie** : la recette nommée corrigée plus tard vaut
    # pour les images qui naîtront ensuite. Une recette effacée depuis laisse
    # un nom qui ne désigne plus rien — ce n'est pas une panne, c'est le repli
    # sur la recette du jeu. Absent vaut rien : aucune migration.
    recette: str = ""

    # ── L'image de référence de sa fiche (RP19)─────────────────────────────
    #
    # **Celle qui dit à quoi le sujet ressemble** (`docs/vocabulaire.html`), et
    # rien d'autre. C'est le portrait montré en grand en haut de sa fiche ; il
    # n'y en a qu'un à la fois, et il est **absent par défaut** — une chose
    # neuve n'a rien choisi, et la fiche retombe alors sur le choix du produit.
    #
    # ⚠️ **Trois choses se ressemblent et ne font pas le même métier.**
    # L'*artwork officiel* est un champ de la carte du tableau
    # (`atelier/domaine/carte.py`) : il sert la palette et part avec les
    # demandes. L'*image retenue* d'une case est celle qui part dans le jeu
    # (`favori` sur l'asset). Celle-ci ne fait ni l'un ni l'autre : en choisir
    # une ne promeut rien, ne retient rien, et n'envoie rien nulle part.
    # Elle ne se confond pas non plus avec `references` juste au-dessus, qui est
    # une **liste** d'images repartant avec chaque appel.
    #
    # **Un identifiant d'asset, jamais une copie** — comme `references` et
    # `concept_arts`. Une image supprimée laisse donc un identifiant qui ne
    # désigne plus rien : ce n'est pas un trou à réparer, c'est le repli, et la
    # fiche reprend le choix du produit sans rien dire.
    image_de_reference: str = ""

    # ── Les directions que cette chose ne tient pas, pose par pose (E10) ─────
    #
    # **La portée étroite des deux** : *ce dragon-là n'attaque que vers le sud*.
    # La portée large — *une mort n'a qu'un angle, pour tout le monde* — vit sur
    # la pose du plan (`atelier/domaine/plan.py`), parce qu'elle vaut pour le
    # projet entier et que la redire sur chaque personnage serait la redire
    # autant de fois qu'il y en a.
    #
    # **Un dictionnaire, et non une liste de couples** : la question qu'on lui
    # pose est toujours *cette pose-ci, quelles directions sont rangées ?*, et
    # c'est très exactement ce qu'un dictionnaire répond sans balayer.
    directions_ecartees: dict[str, tuple[str, ...]] = field(default_factory=dict)

    # ── Les poses que le calibrage laisse de côté (E17) ─────────────────────
    #
    # **Une pose couchée tire tout le monde vers le bas.** Sur le vrai projet,
    # garder la mort ramène la hauteur commune de 53 à 43 pixels : le
    # personnage rapetisserait d'un cinquième dans toutes ses poses debout parce
    # qu'il meurt dans une autre image. Le produit ne devine pas qu'elle est
    # couchée — il voit qu'elle est très en dehors des autres, le **propose**,
    # et un clic la fait rentrer.
    #
    # **Ce n'est ni un écart de pose ni un rangement** : la case existe, elle se
    # remplit, elle se compte. Seul le calage commun l'ignore, et c'est pour ça
    # que ça vit ici plutôt que dans `ecartees`.
    hors_calibrage: tuple[str, ...] = ()

    # Les poses du plan que ce personnage **ne tient pas** — voir l'en-tête.
    # Une entrée qui ne désigne plus rien ne gêne pas : elle ne peut écarter
    # qu'une pose qui existe, et une pose retirée du plan ne revient pas par
    # elle.
    ecartees: tuple[str, ...] = ()

    # Les cartes du tableau désignées comme concept art (US-124).
    concept_arts: tuple[str, ...] = ()

    # Ce qui ne doit plus partir avec **ce personnage-là** (US-126). La portée du
    # milieu : plus large qu'une génération, plus étroite que le projet. Elle
    # n'est ni une dépromotion ni un retrait du tableau — l'artwork reste
    # officiel, et l'univers ne bouge pas.
    references_ecartees: tuple[str, ...] = ()

    cree_le: float = field(default_factory=time.time)

    # AU2 : None conserve le plan ancien ; sorties=[] demande explicitement rien.
    objectif: ObjectifProduction | None = None

    # ── Ce qui se déduit ─────────────────────────────────────────────────────

    def prend_de(self, ambiance: str) -> str:
        """Ce que cette chose prend à l'ambiance qu'elle désigne (E11).

        Sans ambiance, la question ne se pose pas : le vide est la réponse, et
        non un défaut qu'on n'aurait pas rempli.
        """
        return self.prend if self.ambiance == ambiance and ambiance else ""

    def tenues(self, plan: Iterable[Pose]) -> tuple[Pose, ...]:
        """Les poses de ce personnage, dans l'ordre du plan.

        L'ordre vient du plan et de nulle part ailleurs : deux personnages du
        même projet se lisent alors ligne à ligne, ce qui est très exactement ce
        qu'un plan commun sert à faire.

        **Ce que la chose ajoute vient après**, jamais mêlé : le type donne la
        liste, la chose la complète, et l'ordre le dit sans qu'on ait à lire une
        étiquette.
        """
        rendues = tuple(p for p in plan if p.identifiant not in self.ecartees)
        deja = {p.identifiant for p in rendues}
        ajoutees = tuple(
            p
            for p in self.ajoutees
            if p.identifiant not in self.ecartees and p.identifiant not in deja
        )
        return rendues + ajoutees

    def origine(self, pose: str) -> str:
        """D'où vient cette pose — **du type, ou ajoutée ici** (E9).

        Sans cette réponse, on ne saurait plus qui a décidé quoi, ni ce qui
        bougerait en changeant le type de la chose. C'est une lecture, pas un
        drapeau rangé : la liste des ajouts la porte déjà.
        """
        return "ici" if any(p.identifiant == pose for p in self.ajoutees) else "type"

    def directions_tenues(
        self, pose: Pose, directions: Iterable[Direction]
    ) -> tuple[Direction, ...]:
        """Les angles sous lesquels **cette chose-ci** tient **cette pose-là**.

        Deux rangements se soustraient, et ils ne portent pas sur la même chose :
        celui de la pose vaut pour tout le jeu — une mort n'a qu'un angle —, et
        celui d'ici ne vaut que pour cette chose — ce dragon n'attaque que vers
        le sud. Les deux se lisent au même endroit parce que le compte de ce qui
        manque a besoin des deux, et qu'un seul appel évite qu'on en oublie un.
        """
        rangees = set(pose.ecartees) | set(self.directions_ecartees.get(pose.identifiant, ()))
        return tuple(d for d in directions if d.identifiant not in rangees)

    def usage_de(self, asset: str) -> str:
        """L'usage d'une référence promue — `libre` tant que rien n'est rangé."""
        return self.usages_des_references.get(asset) or LIBRE

    def ordre_des_vues(self, asset: str) -> tuple[str, ...]:
        """L'ordre des vues de cette planche (RS8) — vide tant qu'il n'est pas
        dit, **ou si l'image n'est plus rangée en planche** : un ordre resté
        sur une image rangée ailleurs ne décrit plus rien."""
        if self.usage_de(asset) != PLANCHE:
            return ()
        return self.ordres_des_vues.get(asset, ())

    def references_du_contexte(
        self, *, planche: bool, direction: str | None
    ) -> tuple[tuple[str, str], ...]:
        """Les références promues qui partent **dans ce contexte-ci**, avec leur
        usage, dans l'ordre de promotion. Voir `references_du_contexte` plus bas,
        qui porte la règle."""
        return references_du_contexte(
            self.references,
            self.usages_des_references,
            planche=planche,
            direction=direction,
        )

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "projet": self.projet,
            "nom": self.nom,
            "description": self.description,
            "type": self.type,
            "ajoutees": [p.en_json() for p in self.ajoutees],
            "ambiance": self.ambiance,
            "prend": self.prend,
            "textes": dict(self.textes),
            "eteints": list(self.eteints),
            "references": list(self.references),
            "usages_des_references": dict(self.usages_des_references),
            "ordres_des_vues": {
                asset: list(ordre) for asset, ordre in self.ordres_des_vues.items()
            },
            "recette": self.recette,
            "image_de_reference": self.image_de_reference,
            "hors_calibrage": list(self.hors_calibrage),
            "directions_ecartees": {
                pose: list(directions)
                for pose, directions in self.directions_ecartees.items()
            },
            "ecartees": list(self.ecartees),
            "concept_arts": list(self.concept_arts),
            "references_ecartees": list(self.references_ecartees),
            "cree_le": self.cree_le,
            "objectif": self.objectif.en_json() if self.objectif is not None else None,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Personnage":
        return Personnage(
            identifiant=d["identifiant"],
            projet=d.get("projet", ""),
            nom=d.get("nom", d["identifiant"]),
            description=d.get("description", ""),
            type=str(d.get("type") or ""),
            ajoutees=plan_depuis_json(d.get("ajoutees") or []),
            ambiance=str(d.get("ambiance") or ""),
            # **La liste close décide, le fichier n'apporte que les textes.** Un
            # champ que la bible ne connaît plus ne ressuscite pas ici, et un
            # champ neuf n'a rien à migrer : il est simplement absent, donc
            # « du jeu ».
            textes={
                nom: str(texte)
                for nom, texte in (d.get("textes") or {}).items()
                if nom in CHAMPS_BIBLE and str(texte).strip()
            },
            eteints=tuple(
                nom for nom in (d.get("eteints") or ()) if nom in CHAMPS_BIBLE
            ),
            references=tuple(_textes(d.get("references"))),
            # **Absent, tout est libre** (RS1) : un fichier d'avant la tranche
            # n'a pas la clé. Un usage illisible retombe aussi sur `libre`, qui
            # est le comportement d'avant — jamais sur une planche inventée.
            usages_des_references=_usages(d.get("usages_des_references")),
            # **Absent, aucun ordre** (RS8) : un fichier d'avant la tranche n'a
            # pas la clé, et ses planches se découpent sans direction.
            ordres_des_vues={
                str(asset): tuple(_textes(ordre))
                for asset, ordre in (
                    d.get("ordres_des_vues")
                    if isinstance(d.get("ordres_des_vues"), dict)
                    else {}
                ).items()
                if asset and _textes(ordre)
            },
            # **Absente, rien** (RS6) : un fichier d'avant la tranche n'a pas
            # la clé, et ses images gardent la recette du jeu.
            recette=str(d.get("recette") or "").strip(),
            # **Absente par défaut** (RP19) : un fichier écrit avant la tranche
            # n'a pas la clé, et la chaîne vide dit « rien n'a été choisi ».
            image_de_reference=str(d.get("image_de_reference") or ""),
            hors_calibrage=tuple(_textes(d.get("hors_calibrage"))),
            directions_ecartees={
                str(pose): tuple(_textes(rangees))
                for pose, rangees in (d.get("directions_ecartees") or {}).items()
                if str(pose) and _textes(rangees)
            },
            # Une valeur inconnue retombe sur « tout » : la liste est fermée, et
            # un fichier ne la rouvre pas.
            prend=(
                str(d.get("prend"))
                if str(d.get("prend") or "") in CE_QU_ON_PREND
                else TOUT
            ),
            ecartees=tuple(_textes(d.get("ecartees"))),
            concept_arts=tuple(_textes(d.get("concept_arts"))),
            references_ecartees=tuple(_textes(d.get("references_ecartees"))),
            cree_le=d.get("cree_le", 0.0),
            objectif=(ObjectifProduction.depuis_json(d["objectif"])
                      if d.get("objectif") is not None else None),
        )


# ── L'usage d'une référence promue (RS1) ─────────────────────────────────────
#
# **Trois usages, et la liste est close** : une référence qui part toujours, la
# planche de toutes les vues, ou une vue dans une direction du jeu. La direction
# se nomme par son identifiant, jamais par son nom — renommer « sud » en « vers
# le joueur » ne doit pas faire perdre sa place à une référence rangée.
LIBRE = "libre"
PLANCHE = "planche"
PREFIXE_DIRECTION = "direction:"


def usage_de_direction(direction: str) -> str:
    """L'usage qui range une référence dans cette direction-là."""
    return f"{PREFIXE_DIRECTION}{direction}"


def direction_de_lusage(usage: str) -> str | None:
    """La direction qu'un usage désigne, ou rien s'il n'en désigne pas."""
    if usage.startswith(PREFIXE_DIRECTION):
        return usage[len(PREFIXE_DIRECTION):] or None
    return None


def usage_lu(brut: Any) -> str:
    """Un usage relu — d'un fichier ou d'une requête —, **ramené à la liste
    close**. Ce qui n'en est pas redevient `libre`, qui est ce qui partait
    avant : un fichier abîmé ne range jamais une image au hasard."""
    if not isinstance(brut, str):
        return LIBRE
    usage = brut.strip()
    if usage == PLANCHE or direction_de_lusage(usage):
        return usage
    return LIBRE


def references_du_contexte(
    references: Iterable[str],
    usages: dict[str, str],
    *,
    planche: bool,
    direction: str | None,
) -> tuple[tuple[str, str], ...]:
    """**Le seul endroit qui décide quelle référence promue part** (RS1).

    La règle de `docs/PLAN-references-du-sujet.md`, décision 2 :

    - les `libre` partent **toujours** — c'est ce qui partait avant la tranche ;
    - une planche par directions emporte les références `planche` ;
    - une case dans une direction emporte celles de **cette** direction, et à
      défaut la `planche` — mieux vaut toutes les vues que pas de vue du tout ;
    - le reste (sans case, sans direction) n'emporte aucune référence typée.

    **Jamais au hasard, et jamais une image que l'auteur n'a pas rangée là** :
    la référence de l'ouest ne part pas pour une case au sud, même quand la
    case au sud n'en a aucune.

    Rend des couples `(asset, usage)`, dans l'ordre de promotion : l'usage
    voyage avec l'image jusqu'au texte qui la nomme.
    """
    liste = tuple(dict.fromkeys(references))
    lus = {asset: usage_lu(usages.get(asset)) for asset in liste}
    typees: set[str] = set()
    if planche:
        typees = {PLANCHE}
    elif direction:
        sienne = usage_de_direction(direction)
        typees = {sienne} if sienne in lus.values() else {PLANCHE}
    return tuple(
        (asset, lus[asset])
        for asset in liste
        if lus[asset] == LIBRE or lus[asset] in typees
    )


def _usages(brut: Any) -> dict[str, str]:
    """Les usages relus du disque — seuls ceux qui ne sont pas libres restent."""
    if not isinstance(brut, dict):
        return {}
    lus = {str(asset): usage_lu(usage) for asset, usage in brut.items() if asset}
    return {asset: usage for asset, usage in lus.items() if usage != LIBRE}


def _textes(brut: Any) -> list[str]:
    """Une liste d'identifiants relue du disque, débarrassée de ce qui n'en est
    pas. Un fichier abîmé fait perdre une coche, jamais l'ouverture du projet."""
    if not isinstance(brut, Iterable) or isinstance(brut, (str, bytes)):
        return []
    return [t for t in brut if isinstance(t, str) and t]
