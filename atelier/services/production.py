# -*- coding: utf-8 -*-
"""Le plan de poses, les personnages, et la matrice qui dit ce qui manque.

C1. Trois gestes, et un calcul.

**Les gestes** : écrire le plan du projet — la liste des attitudes que le jeu
réclame —, créer et décrire un personnage, et dire lesquelles de ces attitudes
il tient. Aucun d'eux ne sort : tout ce fichier fonctionne réseau coupé, et
c'est un critère d'acceptation de la tranche. Il ne connaît ni le fournisseur,
ni le catalogue, et ça se lit dans ses imports.

**Le calcul** : la matrice. Elle n'est enregistrée nulle part — elle se déduit
du plan, du personnage et des assets qui portent sa case. C'est ce qui interdit
l'état où une case se dit pleine alors que l'image a été supprimée, et c'est
aussi pourquoi supprimer un personnage ne détruit rien : les images ne sont pas
à lui, elles disent seulement qu'elles étaient de lui.

**Ce service écrit deux sortes de choses, et par deux chemins déjà en place.**
Le plan vit dans `projet.json`, donc il passe par `ServiceBibliotheque`, seul
écrivain d'un projet — la règle de l'univers, appliquée telle quelle. Les
personnages ont un fichier chacun sous leur projet, et c'est ce module qui les
écrit, comme `ServiceUnivers` est le seul à écrire une carte.
"""

from __future__ import annotations

import re

from dataclasses import replace
from typing import Any, Sequence

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.personnage import Personnage
from atelier.domaine.ambiance import CE_QU_ON_PREND, TEXTES, prises_du_mode
from atelier.domaine.carte import PERSONNAGES
from atelier.domaine.fond import fond_valide, interdiction, replier
from atelier.domaine.envoi import (
    AMBIANCE as GROUPE_AMBIANCE,
    DE_SA_FICHE,
    Couches,
    resoudre,
)
from atelier.domaine.projet import CHAMPS_BIBLE
from atelier.domaine.plan import (
    Pose,
    plan_depuis_json,
    plan_du_type,
    suit_le_plan_du_jeu,
)
from atelier.domaine.direction import Direction, composer
from atelier.domaine.projet import Projet, repere
from atelier.domaine.vue import CADRE, sans_phrase_du_produit, vue as vue_connue
from atelier.services.assets import AssetInconnu, ServiceAssets
from atelier.services.bibliotheque import ProjetInconnu, ServiceBibliotheque
from atelier.services.evenements import Diffusion
from atelier.services.montre import de_quoi_montrer


class PersonnageInconnu(ErreurAtelier):
    code = "personnage_inconnu"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"aucun personnage « {identifiant} » dans ce projet")


class PoseInconnue(ErreurAtelier):
    code = "pose_inconnue"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"aucune pose « {identifiant} » dans le plan de ce projet")


class ProductionRefusee(ErreurAtelier):
    """Un geste que le produit refuse, avec sa raison en clair."""

    code = "production_refusee"


# Les trois cases de bible qu'une ambiance peut remplacer, et **les quatre qui
# lui sont fermées** (E12). Ce n'est pas une limite arbitraire : le monde,
# l'éclairage et le trait décrivent l'atmosphère d'un coin du jeu ; l'époque, le
# rendu, la vue et la technique décrivent la mécanique du jeu — la taille de
# grille, l'angle de caméra, l'alignement au pixel. Une ambiance qui les
# remplacerait fabriquerait des images qui ne rentrent pas dans le jeu, et
# l'erreur ne se verrait qu'après avoir payé.
OUVERTS_A_UNE_AMBIANCE = frozenset({"monde", "eclairage", "trait"})

# Une taille de grille écrite en toutes lettres dans un texte de bible —
# `64x64`, `64 × 64`, `128 px`. Le produit ne corrige rien : il met le texte qui
# part et la valeur qui s'applique côte à côte, et laisse la faute se voir.
_GRILLE = re.compile(r"(\d{2,4})\s*[x×]\s*(\d{2,4})|\b(\d{2,4})\s*px\b", re.I)


def _tailles_annoncees(texte: str) -> set[int]:
    """Les tailles de grille qu'un texte annonce, s'il en annonce.

    Seuls les carrés comptent — `64x64` est une grille, `253x321` est la taille
    d'une image dont personne ne parle ici. Un texte qui n'annonce rien rend un
    ensemble vide, ce qui est le cas ordinaire et n'est pas un manque.
    """
    tailles: set[int] = set()
    for large, haut, seul in _GRILLE.findall(texte or ""):
        if seul:
            tailles.add(int(seul))
        elif large and large == haut:
            tailles.add(int(large))
    return tailles


# Les mots par lesquels une bible dit que son monde est sombre. **Une liste
# courte et fermée** : le produit ne devine pas une couleur de fond, il en
# propose une quand le texte du jeu la nomme, et il cite le texte à côté.
_NOIRCEURS = ("black", "blackness", "dark", "noir", "obscur", "ténèb")


def _parle_de_noir(texte: str) -> bool:
    bas = (texte or "").casefold()
    return any(mot in bas for mot in _NOIRCEURS)


def _extrait(texte: str, autour: int = 40) -> str:
    """Le morceau du texte qui a fait proposer ce fond, et rien de plus.

    Citer la phrase entière noierait la raison dans le reste de la bible ; n'en
    citer aucune ferait un fond apparu de nulle part.
    """
    bas = (texte or "").casefold()
    place = min(
        (bas.find(mot) for mot in _NOIRCEURS if mot in bas),
        default=-1,
    )
    if place < 0:
        return (texte or "")[:autour]
    debut = max(0, place - autour // 2)
    return ("…" if debut else "") + texte[debut : place + autour] + "…"


def _taille_commune(vues: list[dict[str, Any]]) -> int:
    """La taille que la plupart des images rendent — celle qui fait référence.

    **Pas la cible du projet** : une chose peut avoir été fabriquée entière à
    une autre taille, et c'est alors elle qui est cohérente. Ce qu'on cherche est
    la sœur qui sort d'un quart plus petite que les autres, pas l'écart au
    réglage — celui-là se lit dans la fiche.
    """
    if not vues:
        return 0
    comptes: dict[int, int] = {}
    for vue in vues:
        comptes[vue["largeur"]] = comptes.get(vue["largeur"], 0) + 1
    return max(comptes, key=lambda taille: (comptes[taille], taille))


class ServiceProduction:
    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        bibliotheque: ServiceBibliotheque,
        assets: ServiceAssets,
        diffusion: Diffusion,
        univers: Any = None,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._bibliotheque = bibliotheque
        self._assets = assets
        self._diffusion = diffusion
        # **Le tableau d'inspiration, pour montrer les images d'exemple d'une
        # chose** (R8). La fiche listait ses références en lignes de texte ; on
        # les retenait ou on les retirait sans les regarder. Une vignette a
        # besoin de l'objet qu'elle montre, et une carte se lit chez l'univers.
        #
        # **Facultatif, comme les dépendances tardives de `ServiceEnvoi`** : un
        # essai qui ne monte que la production rend alors des lignes sans
        # vignette, ce qui est exactement ce que rend une carte disparue.
        self._univers = univers

    # ── Le plan du projet ────────────────────────────────────────────────────

    def plan(self, projet: str) -> tuple[Pose, ...]:
        """La liste des attitudes que ce jeu réclame.

        Relue du projet à chaque fois, comme les cartes du disque : la seule
        copie qui existe est celle du fichier.
        """
        return self._exiger(projet).plan

    def plan_de(self, projet: str, personnage: Personnage) -> tuple[Pose, ...]:
        """Ce que **cette chose-là** réclame — le type, puis ce qu'elle ajoute.

        Écrit ici et lu partout : la matrice, la visée d'un appel et le sujet
        d'un prompt posaient chacun `objet.plan`, et trois listes construites à
        trois endroits auraient divergé au premier type qui écrit la sienne.
        """
        objet = self._exiger(projet)
        du_type = objet.univers.poses_du_type(personnage.type, objet.plan)
        # **Ce que la chose ajoute vient après**, jamais mêlé : le type donne la
        # liste, la chose la complète, et l'ordre le dit sans qu'on ait à lire
        # une étiquette. Ce qu'elle range n'est pas retiré ici — l'écran a
        # besoin de la liste entière pour reléguer sous un trait ce qu'elle ne
        # tient pas, et `Personnage.tenues` fait ce tri-là.
        deja = {p.identifiant for p in du_type}
        return du_type + tuple(p for p in personnage.ajoutees if p.identifiant not in deja)

    def poses_des_types(self, projet: str) -> dict[str, Any]:
        """Ce que chaque type d'objet réclame, **et d'où sa liste lui vient**.

        Trois origines, et l'écran les écrit en clair. `écrite` : l'auteur a
        posé la sienne. `connue` : c'est celle que le produit propose pour un
        type de ce nom — un meuble s'ouvre et se vide, un bouton a quatre états.
        `projet` : ce type n'a rien de particulier et partage le plan du jeu,
        comme tous les types avant E9.

        Sans cette phrase, une liste héritée aurait l'air d'une liste choisie,
        et l'auteur ne saurait pas laquelle il peut changer sans conséquence.
        """
        objet = self._exiger(projet)
        types: list[dict[str, Any]] = []
        for echelle in objet.univers.bareme:
            if echelle.poses is not None:
                origine = "écrite"
            elif suit_le_plan_du_jeu(echelle.nom):
                origine = "projet"
            else:
                origine = "connue"
            types.append(
                {
                    "nom": echelle.nom,
                    "origine": origine,
                    "poses": [
                        p.en_json()
                        for p in objet.univers.poses_du_type(echelle.nom, objet.plan)
                    ],
                    # Ce que le produit sait de ce type-là, gardé à côté : c'est
                    # ce qu'un « revenir à la liste connue » remettrait, et
                    # l'écran ne doit pas avoir à le deviner.
                    "connues": [p.en_json() for p in plan_du_type(echelle.nom)],
                }
            )
        return {"types": types, "plan": [p.en_json() for p in objet.plan]}

    def poser_les_poses_du_type(
        self, projet: str, type: str, poses: Sequence[dict[str, Any]]
    ) -> tuple[Pose, ...]:
        """Écrire la liste d'un **type d'objet** — et de lui seul (E9).

        **Changer l'une ne touche pas les autres** : c'est vrai par
        construction, puisqu'on écrit sur l'échelle de ce type-là. Les types qui
        n'ont rien écrit continuent de retomber sur le plan du projet, et c'est
        ce qui reprend les jeux d'avant sans perte.

        **Ça n'écrit aucun fichier de personnage.** Ajouter une pose à un type
        fait paraître une case vide chez tous les objets de ce type sans qu'un
        seul soit réécrit — on range ce qu'on ne tient pas, on ne coche pas ce
        qu'on tient.
        """
        objet = self._exiger(projet)
        echelle = objet.univers.echelle(type)
        if echelle is None:
            connus = ", ".join(e.nom for e in objet.univers.bareme)
            raise ProductionRefusee(
                f"aucun type « {type} » dans ce jeu — les types sont : {connus}"
            )
        voulues = plan_depuis_json(list(poses))
        objet.univers.bareme = tuple(
            replace(e, poses=voulues) if e.nom == type else e
            for e in objet.univers.bareme
        )
        self._sauver_projet(objet)
        return voulues

    def oublier_les_poses_du_type(self, projet: str, type: str) -> None:
        """Ce type **n'a plus de liste à lui** — il revient à ce qu'on lui
        proposait (E9).

        `None` et la liste vide ne disent pas la même chose : vider est une
        décision qui tient, oublier est un retour en arrière. Sans ce geste, un
        type ne pourrait jamais revenir à la liste proposée — il faudrait la
        retaper de mémoire, et la moindre faute de frappe ferait une case
        orpheline.
        """
        objet = self._exiger(projet)
        objet.univers.bareme = tuple(
            replace(e, poses=None) if e.nom == type else e for e in objet.univers.bareme
        )
        self._sauver_projet(objet)

    # ── Les directions du jeu (E10) ──────────────────────────────────────────

    def directions(self, projet: str) -> dict[str, Any]:
        """Les directions de ce jeu, **et d'où la liste lui vient**.

        Deux origines, et l'écran les écrit en clair. `vue` : la liste est celle
        que la vue du jeu propose, et elle suivra un changement de vue — c'est
        ce que le codex affiche *lues*. `ici` : l'auteur a renommé, retiré ou
        ajouté, et la liste ne suit plus.

        **La proposition de la vue reste à côté**, parce que c'est elle qu'un
        « revenir à ce que la vue propose » remettrait, et que l'écran ne doit
        pas avoir à la deviner.
        """
        objet = self._exiger(projet)
        univers = objet.univers
        connue = vue_connue(univers.vue)
        return {
            "directions": [d.en_json() for d in univers.directions_du_jeu()],
            "origine": "ici" if univers.directions_ecrites() else "vue",
            "vue": univers.vue,
            "vue_libelle": connue.libelle if connue else "",
            "proposees": [d.en_json() for d in (connue.directions if connue else ())],
        }

    def directions_du_jeu(self, projet: str) -> tuple[Direction, ...]:
        """Les directions de ce jeu — la liste écrite, sinon celle que sa vue
        propose (E10).

        **Lue, jamais recopiée** : trois services en ont besoin — la matrice pour
        ses colonnes, la planche pour ses cases, le pliage pour ranger ce qui
        revient — et trois lectures de la même liste valent mieux que trois
        copies qui divergeraient à la première direction renommée.
        """
        return self._exiger(projet).univers.directions_du_jeu()

    def cible_du_projet(self, projet: str) -> int:
        """La taille de case que ce jeu impose, ou zéro.

        **Zéro est un état normal** : un jeu qui ne contraint pas l'échelle n'a
        pas de cible, et le mot ne paraît alors nulle part. C'est à l'appelant de
        décider ce qu'il en fait — la planche l'affiche ou l'omet, le calibrage
        refuse de travailler sans elle.
        """
        return self._exiger(projet).univers.cible_px

    def modele_de_planche(self, projet: str) -> str:
        """Le modèle auquel ce jeu demande ses planches, ou rien.

        **Lu, jamais recopié** : le catalogue le lit déjà pour choisir le défaut
        d'un lot, et la planche a besoin du même — un prix mesuré chez un modèle
        ne dit rien du prix chez un autre.
        """
        return self._exiger(projet).univers.modele_planche

    def direction(self, projet: str, identifiant: str) -> Direction | None:
        """Une direction par son nom, ou rien.

        **Rien plutôt qu'un refus** : celui qui refuse est `viser`, avant qu'un
        centime parte. Ici on compose un texte, et une direction disparue rend un
        texte sans elle plutôt qu'une exception au milieu d'un aperçu gratuit.
        """
        return next(
            (d for d in self.directions_du_jeu(projet) if d.identifiant == identifiant),
            None,
        )

    def ajouter_direction(self, projet: str, nom: str, consigne: str = "") -> Direction:
        """**Nommer, c'est créer**, ici comme pour une pose.

        Ajouter une direction fait paraître une case vide chez toute chose qui
        tient une pose — sans qu'un seul fichier de personnage soit écrit,
        puisqu'on range ce qu'on ne tient pas. Rien ne part, rien ne coûte.
        """
        objet = self._exiger(projet)
        propre = nom.strip()
        if not propre:
            raise ProductionRefusee("une direction se crée avec un nom")
        posees = self._directions_ecrites(objet)
        if any(d.nom.casefold() == propre.casefold() for d in posees):
            raise ProductionRefusee(f"« {propre} » est déjà une direction de ce jeu")
        direction = Direction(
            identifiant=repere(propre, {d.identifiant for d in posees}, "direction"),
            nom=propre,
            consigne=consigne.strip(),
        )
        # En queue, jamais trié : l'ordre de la liste est celui des carrés d'une
        # ligne de la matrice, et c'est l'ordre dans lequel l'auteur pense son
        # jeu. Trier mettrait « est » avant « nord » et rendrait deux
        # personnages illisibles côte à côte.
        objet.univers.directions = posees + (direction,)
        self._sauver_les_directions(objet)
        return direction

    def regler_direction(
        self,
        projet: str,
        direction: str,
        *,
        nom: str | None = None,
        consigne: str | None = None,
    ) -> Direction:
        """Renommer une direction, ou corriger ce qu'elle dit au modèle.

        **L'identifiant ne bouge pas**, et c'est tout l'intérêt : les images
        faites le portent, et renommer « sud » en « vers le joueur » ne doit pas
        leur faire perdre leur case.

        **Corriger la consigne se fait ici et une seule fois.** C'est très
        exactement ce que E10 répare : `facing south` était recopié sur chaque
        pose, et le corriger demandait six corrections.
        """
        objet = self._exiger(projet)
        posees = self._directions_ecrites(objet)
        courante = next((d for d in posees if d.identifiant == direction), None)
        if courante is None:
            raise ProductionRefusee(f"« {direction} » n'est pas une direction de ce jeu")

        propre = courante.nom if nom is None else nom.strip()
        if not propre:
            raise ProductionRefusee("une direction garde un nom")
        if any(
            d.identifiant != courante.identifiant
            and d.nom.casefold() == propre.casefold()
            for d in posees
        ):
            raise ProductionRefusee(f"« {propre} » est déjà une direction de ce jeu")

        reglee = replace(
            courante,
            nom=propre,
            consigne=courante.consigne if consigne is None else consigne.strip(),
        )
        objet.univers.directions = tuple(
            reglee if d.identifiant == courante.identifiant else d for d in posees
        )
        self._sauver_les_directions(objet)
        return reglee

    def retirer_direction(self, projet: str, direction: str) -> Direction:
        """Une direction quitte le jeu — **et les images faites restent**.

        Jamais de cascade, ici comme ailleurs. Les images gardent l'identifiant
        de leur direction : remettre la même direction les remet dans leur case,
        et en attendant la matrice les compte à part plutôt que de les perdre.
        """
        objet = self._exiger(projet)
        posees = self._directions_ecrites(objet)
        retiree = next((d for d in posees if d.identifiant == direction), None)
        if retiree is None:
            raise ProductionRefusee(f"« {direction} » n'est pas une direction de ce jeu")
        objet.univers.directions = tuple(
            d for d in posees if d.identifiant != retiree.identifiant
        )
        self._sauver_les_directions(objet)
        return retiree

    def oublier_les_directions(self, projet: str) -> tuple[Direction, ...]:
        """La liste **revient à ce que la vue propose** (E10).

        `None` et la liste vide ne disent pas la même chose : vider est une
        décision qui tient — un jeu sans directions —, oublier est un retour en
        arrière. Sans ce geste, une liste retouchée ne pourrait jamais revenir à
        la proposition : il faudrait la retaper de mémoire, et la moindre faute
        de frappe ferait une colonne orpheline.
        """
        objet = self._exiger(projet)
        objet.univers.directions = None
        self._sauver_les_directions(objet)
        return objet.univers.directions_du_jeu()

    @staticmethod
    def _directions_ecrites(objet: Projet) -> tuple[Direction, ...]:
        """La liste telle qu'elle est **sur le disque**, matérialisée si besoin.

        Toucher une liste lue la fige : c'est le moment où elle cesse de suivre
        la vue, et il vaut mieux qu'il soit celui du premier geste que celui d'un
        changement de vue plus tard. La matérialiser ici, en un seul endroit,
        évite que trois gestes en décident chacun différemment.
        """
        return objet.univers.directions_du_jeu()

    # ── La proposition de baisse (E10, US-243) ───────────────────────────────

    def proposition_de_baisse(self, projet: str) -> dict[str, Any]:
        """Ce que déclarer des directions coûterait, **et ce qu'on propose**.

        **Sans elle, déclarer quatre directions ferait passer un personnage de
        douze cases à quarante-huit d'un coup**, et l'auteur découvrirait
        trente-six manques qu'il n'a pas demandés. Le produit ne décide pas à sa
        place : il propose, il écrit pourquoi, et un clic défait.

        **Les poses concernées sont celles qui demandent exactement autant
        d'images qu'il y a de directions** — et c'est un fait, pas une heuristique
        de plus : dans le vrai projet, `repos` et `marche` demandent quatre
        images pendant que la bible dit *4-directional orientation*. Ces
        quatre-là **sont** les quatre directions ; elles étaient un nombre
        d'images faute d'un endroit où dire l'angle.
        """
        objet = self._exiger(projet)
        combien = len(objet.univers.directions_du_jeu())
        toutes = self._toutes_les_poses(objet)
        visees = [
            (portee, pose)
            for portee, pose in toutes
            if combien > 1 and pose.images == combien
        ]
        defaisables = [
            (portee, pose) for portee, pose in toutes if pose.images_avant > 0
        ]
        return {
            "directions": combien,
            "poses": [
                {"pose": pose.identifiant, "nom": pose.nom, "images": pose.images,
                 "portee": portee}
                for portee, pose in visees
            ],
            "raison": self._raison_de_la_baisse(objet, [p for _, p in visees], combien),
            # **Les deux chiffres, pour que la proposition se juge et non se
            # croie.** Le produit constate ; c'est l'auteur qui décide sur son
            # propre jeu.
            "cases_avant": sum(pose.images * combien for _, pose in toutes),
            "cases_apres": sum(
                (1 if (portee, pose) in visees else pose.images) * combien
                for portee, pose in toutes
            ),
            "defaite": [
                {"pose": pose.identifiant, "nom": pose.nom,
                 "images_avant": pose.images_avant}
                for _, pose in defaisables
            ],
        }

    def baisser_les_images(self, projet: str) -> dict[str, Any]:
        """Ramener à une image les poses que la proposition nomme.

        **Ce que la pose demandait est gardé sur elle**, et c'est tout ce qu'il
        faut pour défaire : une défaite qui ne survivrait pas au rechargement
        laisserait ouvert très exactement le piège que la proposition ferme.
        """
        objet = self._exiger(projet)
        combien = len(objet.univers.directions_du_jeu())
        if combien < 2:
            raise ProductionRefusee(
                "ce jeu n'a pas de directions — il n'y a rien à ramener"
            )
        visees = {
            pose.identifiant
            for _, pose in self._toutes_les_poses(objet)
            if pose.images == combien
        }
        if not visees:
            raise ProductionRefusee(
                "aucune pose ne demande autant d'images qu'il y a de directions"
            )
        self._mapper_les_poses(
            objet,
            lambda p: replace(p, images=1, images_avant=p.images)
            if p.identifiant in visees
            else p,
        )
        self._sauver_projet(objet)
        return self.proposition_de_baisse(projet)

    def defaire_la_baisse(self, projet: str) -> dict[str, Any]:
        """Rendre à chaque pose ce qu'elle demandait — **le clic qui défait**."""
        objet = self._exiger(projet)
        self._mapper_les_poses(
            objet,
            lambda p: replace(p, images=p.images_avant, images_avant=0)
            if p.images_avant > 0
            else p,
        )
        self._sauver_projet(objet)
        return self.proposition_de_baisse(projet)

    @staticmethod
    def _toutes_les_poses(objet: Projet) -> list[tuple[str, Pose]]:
        """Chaque pose déclarée dans ce jeu, avec la portée qui la porte.

        Depuis E9 une pose vit à deux endroits qui s'écrivent : le plan du jeu,
        que les personnages et les créatures partagent, et la liste d'un type.
        Les balayer ensemble évite qu'une proposition ne baisse que la moitié
        d'un jeu.
        """
        posees: list[tuple[str, Pose]] = [("jeu", p) for p in objet.plan]
        for echelle in objet.univers.bareme:
            if echelle.poses is not None:
                posees += [(f"type {echelle.nom}", p) for p in echelle.poses]
        return posees

    @staticmethod
    def _mapper_les_poses(objet: Projet, muter) -> None:
        """Applique la même transformation partout où une pose est déclarée."""
        objet.plan = tuple(muter(p) for p in objet.plan)
        objet.univers.bareme = tuple(
            e if e.poses is None else replace(e, poses=tuple(muter(p) for p in e.poses))
            for e in objet.univers.bareme
        )

    @staticmethod
    def _raison_de_la_baisse(objet: Projet, visees: list[Pose], combien: int) -> str:
        """La phrase qui accompagne la proposition — **avec ce que la bible dit**.

        Le produit ne propose rien sans écrire d'où ça vient. Quand la bible
        porte encore le nombre de directions en toutes lettres — c'est le cas du
        vrai projet, `4-directional orientation` —, la raison le cite mot pour
        mot : c'est la preuve que ces quatre images-là *étaient* les quatre
        directions.
        """
        if not visees:
            return ""
        noms = " et ".join(f"« {p.nom} »" for p in visees)
        dit = ""
        for champ in objet.univers.bible:
            # Le mot qui suit part avec, quand il y en a un : la bible du vrai
            # projet dit `4-directional orientation`, et citer la moitié d'une
            # phrase donne une preuve à moitié.
            trouve = re.search(
                rf"\b{combien}\s*-?\s*directional(\s+\w+)?", champ.texte, re.I
            )
            if trouve:
                dit = trouve.group(0)
                break
        prefixe = f"ta bible dit « {dit} » et " if dit else ""
        return (
            f"proposé : {prefixe}{'tes' if len(visees) > 1 else 'ta'} pose"
            f"{'s' if len(visees) > 1 else ''} {noms} "
            f"demande{'nt' if len(visees) > 1 else ''} {combien} images, "
            f"et ton jeu a maintenant {combien} directions · se défait d'un clic"
        )

    # ── Ce qu'une chose ne tient pas — la seconde portée (E10) ───────────────

    def ranger_direction(
        self,
        projet: str,
        pose: str,
        direction: str,
        *,
        rangee: bool,
        personnage: str | None = None,
    ) -> dict[str, Any]:
        """Ranger une direction, **aux deux portées** (US-244).

        Sans personnage, la direction se range **sur la pose** : une mort n'a
        qu'un angle quel que soit le personnage, et se le dire une fois vaut
        mieux que de le redire sur chacun. Avec, elle ne se range que **pour
        cette chose-là** : le dragon n'attaque que vers le sud, les autres
        continuent d'attaquer partout.

        **La portée large écrit là où la pose est déclarée**, et c'est ce que la
        réponse dit. Depuis E9 une pose vit à trois endroits possibles — le plan
        du jeu, la liste d'un type, ce qu'une chose a ajouté pour elle seule —,
        et écrire ailleurs qu'à sa source ferait deux vérités sur la même
        question. La portée exacte est donc rendue plutôt que promise : *tout le
        jeu*, *les choses de type personnage*, ou *cette chose seule*.
        """
        objet = self._exiger(projet)
        if personnage:
            vise = self.personnage(projet, personnage)
            rangees = dict(vise.directions_ecartees)
            actuelles = set(rangees.get(pose, ()))
            if rangee:
                actuelles.add(direction)
            else:
                actuelles.discard(direction)
            if actuelles:
                rangees[pose] = tuple(sorted(actuelles))
            else:
                rangees.pop(pose, None)
            vise.directions_ecartees = rangees
            self._sauver(vise)
            return {"portee": "ici", "personnage": self.en_charge(projet, vise)}

        # Toutes les choses du jeu bougent d'un coup : la pose est déclarée à un
        # seul endroit, et c'est là qu'on vient d'écrire. L'annonce du plan
        # suffit donc à les remettre toutes d'accord, sans réécrire un fichier.
        portee = self._ranger_sur_la_pose(objet, pose, direction, rangee)
        self._sauver_projet(objet)
        return {"portee": portee}

    def _ranger_sur_la_pose(
        self, objet: Projet, pose: str, direction: str, rangee: bool
    ) -> str:
        """Écrit le rangement **là où cette pose est déclarée**, et dit où.

        Le plan du jeu d'abord, parce que c'est la liste que les personnages et
        les créatures partagent, et donc la portée la plus large. Les listes de
        type ensuite, chacune pour son type. Rien trouvé n'est pas une erreur —
        c'est une pose ajoutée sur une seule chose, et la portée large n'a alors
        pas de sens : le refus le dit plutôt que d'écrire au hasard.
        """

        def _rangee(p: Pose) -> Pose:
            actuelles = set(p.ecartees)
            if rangee:
                actuelles.add(direction)
            else:
                actuelles.discard(direction)
            return replace(p, ecartees=tuple(sorted(actuelles)))

        if any(p.identifiant == pose for p in objet.plan):
            objet.plan = tuple(
                _rangee(p) if p.identifiant == pose else p for p in objet.plan
            )
            return "jeu"

        for echelle in objet.univers.bareme:
            if echelle.poses is None:
                continue
            if any(p.identifiant == pose for p in echelle.poses):
                objet.univers.bareme = tuple(
                    replace(
                        e,
                        poses=tuple(
                            _rangee(p) if p.identifiant == pose else p for p in e.poses
                        ),
                    )
                    if e.nom == echelle.nom
                    else e
                    for e in objet.univers.bareme
                )
                return f"type {echelle.nom}"

        raise ProductionRefusee(
            f"« {pose} » n'est déclarée nulle part dans ce jeu — une attitude "
            "ajoutée sur une seule chose se range sur cette chose-là"
        )

    # ── La fiche d'une chose du jeu (E12) ────────────────────────────────────

    def couches(
        self, projet: str | None, identifiant: str | None, fond: str | None = None
    ) -> Couches:
        """Les trois épaisseurs de texte qui habillent une chose, **brutes** (E14).

        **Deux écrans les résolvent, et il n'y a qu'une résolution** : la fiche
        montre l'état durable (`habillage`), l'écran de confirmation montre ce
        que *cet appel* fera une fois les interrupteurs touchés. Toutes deux
        appellent `resoudre` ; ce qui les distingue est le tri, pas la règle.

        **Sans chose du jeu, il ne reste que la bible** — c'est le cas d'un
        agent, d'un import, ou d'une image qu'on fabrique sans rien viser. Une
        chose disparue rend la même chose plutôt qu'un refus : un appel ne doit
        pas échouer parce qu'un personnage a été supprimé entre-temps.

        **`fond` corrige la couleur pour cet appel-ci, et rien d'autre** (D3).
        `None` laisse celle du jeu ; une couleur la remplace ; la chaîne vide la
        retire. La correction se fait **sur une copie de l'univers**, pas sur une
        phrase composée à côté : la case `technique` porte déjà le fond, elle
        sait déjà l'écrire, et recomposer sa phrase ici aurait été la seconde
        vérité que le 1ᵉʳ septembre 2026 venait de retirer.
        """
        if not projet:
            return Couches()
        try:
            objet = self._exiger(projet)
        except ProjetInconnu:
            return Couches()
        univers = objet.univers
        if fond is not None:
            univers = replace(univers, fond=fond_valide(fond))
        # **Ce que la case dit vraiment**, et non ce qu'elle range : depuis le
        # 1ᵉʳ septembre 2026 la phrase de l'atelier — la grille, le calage, le
        # cadrage — se calcule ici plutôt que d'être recopiée dans le texte.
        # `texte_de_la_case` fait les deux moitiés et tient l'ordre, l'atelier
        # d'abord et l'auteur ensuite ; une case éteinte ne dit toujours rien.
        bible = tuple(
            (champ.nom, univers.texte_de_la_case(champ.nom))
            for champ in univers.bible
        )
        if not identifiant:
            return Couches(bible=bible)
        try:
            personnage = self.personnage(projet, identifiant)
        except (PersonnageInconnu, ProjetInconnu):
            return Couches(bible=bible)
        ambiance = (
            objet.ambiance(personnage.ambiance) if personnage.ambiance else None
        )
        return Couches(
            bible=bible,
            ecrits=dict(personnage.textes),
            eteints=frozenset(personnage.eteints),
            ambiance=(
                {
                    nom: texte
                    for nom, texte in (
                        ("monde", ambiance.monde),
                        ("eclairage", ambiance.eclairage),
                        ("trait", ambiance.trait),
                    )
                    if (texte or "").strip() and nom in OUVERTS_A_UNE_AMBIANCE
                }
                if ambiance
                else {}
            ),
            ambiance_nom=ambiance.nom if ambiance else "",
            prend_textes=bool(ambiance) and TEXTES in prises_du_mode(personnage.prend),
            chose=personnage.identifiant,
        )

    def prend_de(self, projet: str | None, personnage: str | None) -> str:
        """Ce que cette chose prend à son ambiance — le réglage durable (E14).

        Rend *tout* quand la question ne se pose pas : sans ambiance, il n'y a
        rien à ne pas prendre, et un refus serait un mot de plus pour dire rien.
        """
        if not projet or not personnage:
            return CE_QU_ON_PREND[0]
        try:
            return self.personnage(projet, personnage).prend or CE_QU_ON_PREND[0]
        except (PersonnageInconnu, ProjetInconnu):
            return CE_QU_ON_PREND[0]

    def _ambiance_de(self, projet: str | None, personnage: str | None):
        if not projet or not personnage:
            return None
        try:
            objet = self._exiger(projet)
            vise = self.personnage(projet, personnage)
        except (PersonnageInconnu, ProjetInconnu):
            return None
        return objet.ambiance(vise.ambiance) if vise.ambiance else None

    def references_de_lambiance(
        self, projet: str | None, personnage: str | None
    ) -> tuple[str, ...]:
        """Les cartes que l'ambiance de cette chose désigne (E14).

        **Une ambiance ne contient aucune image** : elle en désigne, dans le
        tableau d'inspiration. La supprimer ne détruit donc rien, et une carte
        retirée du tableau ne fait pas tomber l'appel — un artwork disparu est
        sauté, c'est déjà la règle de `_octets_references`.
        """
        ambiance = self._ambiance_de(projet, personnage)
        return tuple(ambiance.references) if ambiance else ()

    def palette_de_lambiance(
        self, projet: str | None, personnage: str | None
    ) -> tuple[str, ...]:
        """Les couleurs que l'ambiance de cette chose apporte, ou rien (E14)."""
        ambiance = self._ambiance_de(projet, personnage)
        if ambiance is None or not ambiance.palette or not projet:
            return ()
        palette = self._exiger(projet).palette_nommee(ambiance.palette)
        return tuple(palette.rendue) if palette else ()

    def couleurs_de(
        self, projet: str | None, personnage: str | None
    ) -> tuple[str, ...]:
        """La palette qui s'applique à cette chose — la sienne, sinon celle du jeu.

        **Il n'y en a qu'une**, et c'est la même règle que la vitrine applique
        pour ses fonds (E16) : une chose qui désigne une ambiance en prend la
        palette, les autres prennent celle du jeu. Deux palettes qui
        s'appliqueraient ensemble demanderaient une règle de priorité invisible
        au moment où elle décide.
        """
        sienne = self.palette_de_lambiance(projet, personnage)
        if sienne:
            return sienne
        if not projet:
            return ()
        try:
            return tuple(self._exiger(projet).univers.palette)
        except ProjetInconnu:  # pragma: no cover — `_exiger` est déjà passé
            return ()

    def habillage(self, projet: str, identifiant: str) -> dict[str, Any]:
        """Les sept textes qui habillent cette chose, **et d'où chacun vient**.

        Trois couches, dans cet ordre : les textes du jeu, ceux que l'ambiance
        désignée remplace, ceux que la chose écrit pour elle seule. La fiche
        écrit à côté de chaque texte laquelle a gagné, parce qu'**un résumé ne
        dit pas ce qui part** — la ligne « hérité de la bible » de l'établi
        disait *pixel · 64×64 · vue 3/4* et cachait sept textes.

        **Cinq origines, et pas une de plus.** `jeu` — rien n'a été changé pour
        cette chose-là. `ambiance` — le lot de style désigné fournit ce texte, et
        le corriger là-bas le corrige pour tout ce qui s'en sert. `ici` — un
        texte propre à cette chose, qui montre en dessous, barré, celui qu'il
        remplace. `eteint` — un refus écrit, pas une case vide : le texte qui
        serait parti, barré, et *rallumer* à un clic. `verrouille` — le réglage
        s'impose et rien ne le change ici.

        **Trois cases sont ouvertes à une ambiance, quatre lui sont fermées**, et
        ce n'est pas arbitraire : les quatre autres décrivent la mécanique du
        jeu, pas son atmosphère. Changer l'angle de vue au milieu d'un jeu ne
        produit pas une variante de style, ça produit des images inutilisables —
        et l'erreur ne se verrait qu'après avoir payé.
        """
        objet = self._exiger(projet)
        personnage = self.personnage(projet, identifiant)
        ambiance = objet.ambiance(personnage.ambiance) if personnage.ambiance else None

        # **La résolution est écrite une fois, dans le domaine** (E14). Cette
        # fiche-ci et l'écran de confirmation posaient la même question — quelle
        # couche gagne — et l'écrire deux fois aurait fini par montrer un texte
        # sur la fiche et un autre dans le prompt.
        couches = self.couches(projet, identifiant)
        resolues = resoudre(couches, None)

        champs: list[dict[str, Any]] = []
        for champ in objet.univers.bible:
            miennes = [l for l in resolues if l["nom"] == champ.nom]
            gagnante = next((l for l in miennes if l["allumee"]), None)
            ecartee = next((l["texte"] for l in miennes if not l["allumee"]), "")
            if gagnante is None:
                # Rien ne part : soit la chose refuse ce champ — et l'on montre,
                # barré, ce qui serait parti —, soit le jeu n'a rien écrit.
                origine, texte = ("eteint" if miennes else "jeu"), ""
                remplace = ecartee
            elif gagnante["groupe"] == GROUPE_AMBIANCE:
                origine, texte, remplace = "ambiance", gagnante["texte"], ""
            elif gagnante["origine"] == DE_SA_FICHE:
                origine, texte = "ici", gagnante["texte"]
                remplace = ecartee or gagnante["remplace"]
            else:
                origine, texte, remplace = "jeu", gagnante["texte"], ""
            champs.append(
                {
                    "nom": champ.nom,
                    "texte": texte,
                    "origine": origine,
                    # Ce que ce texte-là écarte, montré barré en dessous : on
                    # doit pouvoir lire ce à quoi on a renoncé sans aller le
                    # chercher ailleurs.
                    "remplace": remplace if origine in ("ici", "eteint") else "",
                    "ambiance": ambiance.nom if origine == "ambiance" else "",
                    # Une case fermée aux ambiances est affichée quand même, en
                    # lecture seule : on voit ce qui part, on voit qu'on n'y
                    # touche pas ici, et on sait où aller le changer.
                    "ouvert": champ.nom in OUVERTS_A_UNE_AMBIANCE,
                    # **Les tailles que le texte annonce, sans celle de
                    # l'atelier.** Depuis le 1ᵉʳ septembre 2026, ce qui part
                    # commence par la phrase de l'atelier, et cette phrase-là
                    # dit la cible du projet — par construction, elle ne peut
                    # pas être en désaccord avec elle. La compter ferait
                    # apparaître la taille du jeu dans la liste de ce qu'on lui
                    # reproche. Ne restent donc que les tailles **tapées à la
                    # main**, qui sont les seules qui puissent se tromper.
                    "annonce": sorted(_tailles_annoncees(sans_phrase_du_produit(texte))),
                }
            )

        # **La taille de pixel s'impose**, et c'est la contradiction que seule la
        # fiche met sous les yeux : deux champs de la bible écrivent la grille en
        # toutes lettres, et ils partent dans le prompt. On demande donc au
        # modèle une grille de 64 pendant que l'atelier ramène l'image sur 128.
        # La fiche ne corrige rien — la bible s'écrit dans l'Univers — mais elle
        # rend la faute impossible à ne pas voir.
        cible = objet.univers.cible_px
        desaccord = [
            c["nom"] for c in champs if cible and any(t != cible for t in c["annonce"])
        ]
        palette = (
            objet.palette_nommee(ambiance.palette)
            if ambiance and ambiance.palette
            else None
        )
        return {
            "personnage": identifiant,
            "champs": champs,
            "ambiance": ambiance.en_json() if ambiance else None,
            "prend": personnage.prend if ambiance else "",
            "cible_px": cible,
            # Les champs dont le texte annonce une autre grille que celle qui
            # s'applique. Vide est la réponse ordinaire ; non vide est une faute
            # que personne n'avait vue en vingt-huit appels.
            "desaccord": desaccord,
            "palette": (
                {"nom": palette.nom, "couleurs": len(palette.rendue)}
                if palette
                else None
            ),
            # **Le coût, nommé** : une chose qui écrit ses propres textes diverge
            # du reste du jeu, et rien ne l'empêche. Ce qui tient contre ça est
            # que l'écart se voit sans qu'on le cherche.
            "poses_ici": sum(1 for c in champs if c["origine"] in ("ici", "eteint")),
            "de_l_ambiance": sum(1 for c in champs if c["origine"] == "ambiance"),
        }

    # ── Les cinq familles (E15) ──────────────────────────────────────────────

    def famille_de(self, projet: str, personnage: Personnage) -> str:
        """La famille d'une chose du jeu — **lue dans son type**, jamais gardée
        en double (E15)."""
        return self._exiger(projet).univers.famille_du_type(personnage.type)

    def porte_de_lequipement(self, projet: str, personnage: Personnage) -> bool:
        """Cette chose-là peut-elle porter une pièce ? (E15)

        **Une pièce se pose sur un corps, jamais sur rien** — c'est déjà le refus
        de C3, écrit au moment de plier une planche d'équipement. E15 en tire la
        conséquence à l'écran : un décor et un bouton n'ont pas de vestiaire, et
        leur établi ne dessine donc **aucune** colonne d'équipement. Pas une
        colonne grisée : ce qu'une famille ne peut pas avoir n'existe pas dans
        son établi, et le grisé est réservé à ce qui viendra.
        """
        return self.famille_de(projet, personnage) == PERSONNAGES

    def portee_de_la_piece(self, projet: str, piece: str) -> dict[str, Any]:
        """Sur quels personnages cette pièce est posée (US-284).

        **Une pièce n'a pas d'image à elle**, et son établi ne fait donc pas
        semblant d'en avoir : il montre les choses qui la portent. Le produit
        interdit de générer un casque sur fond vide — un casque n'existe
        qu'apparu sur un corps —, et ce qui manque se lit comme partout ailleurs :
        *posée sur 1 personnage sur 3*.

        **Rien n'est enregistré ici non plus.** C'est l'image qui dit sa case et
        sa pièce ; une pièce posée se déduit donc des assets, comme une case
        pleine, et supprimer un calque la retire toute seule.
        """
        objet = self._exiger(projet)
        connue = next((p for p in objet.pieces if p.identifiant == piece), None)
        if connue is None:
            raise ProductionRefusee(f"aucune pièce « {piece} » dans ce projet")

        portants: dict[str, list[str]] = {}
        for personnage in self.personnages(projet):
            if not self.porte_de_lequipement(projet, personnage):
                continue
            poses = [
                asset.pose
                for asset in self._base.assets_du_personnage(personnage.identifiant)
                if asset.piece == piece and asset.pose
            ]
            if poses:
                portants[personnage.identifiant] = sorted(set(poses))

        candidats = [
            p
            for p in self.personnages(projet)
            if self.porte_de_lequipement(projet, p)
        ]
        return {
            "piece": connue.en_json(),
            "portee": [
                {
                    "personnage": p.identifiant,
                    "nom": p.nom,
                    "poses": portants.get(p.identifiant, []),
                }
                for p in candidats
            ],
            "posee": len(portants),
            "candidats": len(candidats),
        }

    def poser_hors_calibrage(
        self, projet: str, personnage: str, poses: tuple[str, ...]
    ) -> Personnage:
        """Les poses que le calage commun laisse de côté (E17).

        **Le seul endroit du dépôt qui écrive un personnage reste `_sauver`** :
        le calibrage passe donc par ici plutôt que d'écrire lui-même, comme
        toute chose qui touche une chose du jeu.
        """
        vise = self.personnage(projet, personnage)
        vise.hors_calibrage = poses
        self._sauver(vise)
        return vise

    def references_promues(self, projet: str, personnage: str) -> tuple[str, ...]:
        """Les images qu'une chose du jeu a promues en référence permanente.

        Lue par la génération, qui les fait partir en rôle `reference`. Une
        chose disparue rend une liste vide plutôt qu'un refus : un appel ne doit
        pas échouer parce qu'un personnage a été supprimé entre-temps.
        """
        try:
            return self.personnage(projet, personnage).references
        except (PersonnageInconnu, ProjetInconnu):
            return ()

    def references_de(self, projet: str, identifiant: str) -> dict[str, Any]:
        """Les images de référence d'une chose, **quatre provenances, une liste**.

        Ce bloc dit **ce qui est disponible, pas ce qui part** : ce qui part
        vraiment se coche juste avant de payer, sur l'écran de confirmation, où
        chaque image porte un interrupteur. La fiche garde le bloc quand même, et
        ce n'est pas un doublon — c'est ici que les images de référence d'une
        chose *existent* : on en promeut une, on en écarte une, et ça vaut pour
        toutes ses générations à venir. **Une chose est définie à un seul
        endroit** : la liste ici, le tri là-bas.

        **Et l'atelier propose de lui-même.** Il n'attend pas qu'on y pense, et
        il ne décide pas non plus : il propose, avec la provenance écrite
        dessous, et une proposition se refuse d'un clic. La première proposition
        est le corps retenu de la première pose faite — l'image qui dit à quoi
        ressemble vraiment ce personnage une fois passé par le style du jeu, bien
        mieux qu'un artwork d'inspiration.
        """
        objet = self._exiger(projet)
        personnage = self.personnage(projet, identifiant)
        ambiance = objet.ambiance(personnage.ambiance) if personnage.ambiance else None
        ecartees = set(personnage.references_ecartees)

        lignes: list[dict[str, Any]] = []
        for reference in ambiance.references if ambiance else ():
            lignes.append(
                {
                    "reference": reference,
                    "genre": "carte",
                    "provenance": "image de son ambiance",
                    "detail": ambiance.nom if ambiance else "",
                    "ecartee": reference in ecartees,
                    "montre": self._montre(projet, reference, carte=True),
                }
            )
        for carte in personnage.concept_arts:
            lignes.append(
                {
                    "reference": carte,
                    "genre": "carte",
                    "provenance": "concept art",
                    "detail": "épinglé sur cette chose",
                    "ecartee": carte in ecartees,
                    "montre": self._montre(projet, carte, carte=True),
                }
            )
        for asset in personnage.references:
            lignes.append(
                {
                    "reference": asset,
                    "genre": "asset",
                    "provenance": "image promue",
                    "detail": "fabriquée puis retenue comme référence",
                    "ecartee": asset in ecartees,
                    "montre": self._montre(projet, asset, carte=False),
                }
            )

        return {
            "personnage": identifiant,
            "lignes": lignes,
            # **Ce que l'atelier propose tout seul**, et rien de plus : une
            # proposition n'est pas une décision, et elle porte sa provenance.
            "propositions": self._propositions(projet, personnage),
            "disponibles": sum(1 for l in lignes if not l["ecartee"]),
        }

    def _montre(
        self, projet: str, identifiant: str, *, carte: bool
    ) -> dict[str, Any] | None:
        """De quoi montrer cette image d'exemple — l'objet entier (R8).

        **La réponse est écrite une seule fois**, dans
        `atelier/services/montre.py` : l'écran de confirmation pose la même
        question depuis U9, et deux réponses auraient fini par rendre deux
        formes du même objet.
        """
        return de_quoi_montrer(
            assets=self._assets,
            univers=self._univers,
            projet=projet,
            identifiant=identifiant,
            carte=carte,
        )

    def _propositions(
        self, projet: str, personnage: Personnage
    ) -> list[dict[str, Any]]:
        """Ce que l'atelier propose de promouvoir, avec sa raison.

        **Le corps retenu de la première pose faite.** Le produit sait déjà le
        désigner — il s'en sert pour composer les planches d'équipement, et
        jamais pour autre chose. La règle est *le favori d'abord, sinon la plus
        récente* ; sur quarante-huit images du dépôt, il y avait **zéro
        favori**, donc c'est toujours la seconde branche qui décidait, et « la
        plus récente » n'est pas la meilleure — c'est la dernière. La fiche
        répare ça sans changer la règle : elle montre laquelle est retenue, et
        retenir une autre image se fait là où on la regarde.

        **La planche des quatre directions n'est toujours pas proposable**, et
        elle le dit plutôt que d'être absente. Les directions existent depuis
        E10, et le produit sait dire qu'une pose est complète dans toutes les
        siennes ; mais **l'image qui les montre ensemble est une planche**, et
        une planche de pose est E13. Ce qui manque n'est plus la notion, c'est
        le fichier.
        """
        proposees: list[dict[str, Any]] = []
        deja = set(personnage.references) | set(personnage.concept_arts)
        for case in self.cases(projet, personnage):
            if case["corps"] and case["corps"] not in deja:
                proposees.append(
                    {
                        "reference": case["corps"],
                        "genre": "asset",
                        "provenance": f"le corps retenu de « {case['pose']} »",
                        "detail": "ce à quoi il ressemble une fois passé par le style du jeu",
                        "ecartee": False,
                        "montre": self._montre(projet, case["corps"], carte=False),
                    }
                )
                break
        return proposees

    def promouvoir_reference(
        self, projet: str, identifiant: str, asset: str, promue: bool = True
    ) -> Personnage:
        """Une image fabriquée devient — ou cesse d'être — une référence permanente.

        **Rien n'est copié** : c'est l'identifiant de l'asset qui est retenu, et
        l'image reste où elle est. La dépromouvoir ne la supprime pas, et la
        supprimer de la bibliothèque la retire d'ici sans laisser de trou : une
        référence qui ne désigne plus rien ne part pas, elle ne casse rien.
        """
        personnage = self.personnage(projet, identifiant)
        if promue:
            if asset not in personnage.references:
                personnage.references = (*personnage.references, asset)
        else:
            personnage.references = tuple(
                r for r in personnage.references if r != asset
            )
        self._sauver(personnage)
        return personnage

    # ── La vitrine (E16) ─────────────────────────────────────────────────────

    def vitrine(self, projet: str, identifiant: str = "") -> dict[str, Any]:
        """De quoi regarder une image finie : **les fonds, et la taille commune**.

        **Un fond de jugement vient du projet ; un fond de repérage vient du
        produit.** Le damier est le second — il montre ce qui est transparent, et
        c'est le fond de la retouche. Les autres viennent de ce que le projet
        possède déjà : le noir que sa bible décrit, et les couleurs de sa
        palette. **Aucune couleur libre** : un sélecteur libre transformerait cet
        écran en outil de maquillage — on trouverait toujours un fond sur lequel
        le sprite est joli, et jamais celui sur lequel il disparaît.

        **Et la taille commune, qui est le second défaut invisible.** Mesuré sur
        le vrai projet : cinq poses de Balthazar sortent en 128 × 128 et son
        attaque en 96 × 96 — posées côte à côte dans le jeu, le personnage
        rapetisserait en frappant. Aucun écran ne mettait ces six images côte à
        côte. La vitrine **marque** ce qu'elle voit ; elle ne compte pas, et une
        marque n'est pas un compte.
        """
        objet = self._exiger(projet)
        # **Un seul écran, deux contenus** : le monde entier quand on l'ouvre du
        # codex, une chose et toutes ses poses quand on l'ouvre de son établi.
        # Le fil d'Ariane dit lequel, et rien n'est défini deux fois.
        personnage = self.personnage(projet, identifiant) if identifiant else None
        ambiance = (
            objet.ambiance(personnage.ambiance)
            if personnage and personnage.ambiance
            else None
        )
        palette = (
            objet.palette_nommee(ambiance.palette)
            if ambiance and ambiance.palette
            else None
        )
        couleurs = list(palette.rendue) if palette else list(objet.univers.palette)

        fonds: list[dict[str, str]] = [
            {
                "genre": "damier",
                "couleur": "",
                "raison": "ce qui est transparent — c'est le fond de la retouche, pas celui du jugement",
            }
        ]
        # **Le noir n'est proposé que si la bible en parle**, et la raison cite
        # le texte qui l'a fait proposer : un fond posé sans raison serait un
        # fond inventé, et le produit n'en invente pas.
        obscure = next(
            (
                c
                for c in objet.univers.bible
                if c.nom == "eclairage" and _parle_de_noir(c.texte)
            ),
            None,
        )
        if obscure is not None:
            fonds.append(
                {
                    "genre": "noir",
                    "couleur": "#000000",
                    "raison": f"proposé, d'après « {_extrait(obscure.texte)} »",
                }
            )
        for couleur in couleurs[:3]:
            fonds.append(
                {
                    "genre": "palette",
                    "couleur": couleur,
                    "raison": "une couleur que le jeu emploie — le sujet s'y détache, ou non",
                }
            )

        # Les images à regarder, avec la taille que chacune rend vraiment.
        #
        # **Du codex, une image par chose** — la première qu'elle tient : trois
        # nains côte à côte disent tout de suite s'ils viennent du même monde.
        # **De son établi, toutes ses poses** : on voit si le personnage se
        # ressemble d'une pose à l'autre, et si elles sortent toutes à la même
        # taille.
        vues: list[dict[str, Any]] = []
        for chose in [personnage] if personnage else self.personnages(projet):
            tenues = [
                (case, asset)
                for case in self.cases(projet, chose)
                for asset in case["images"]
            ]
            for case, asset in tenues if personnage else tenues[:1]:
                vues.append(
                    {
                        "asset": asset["identifiant"],
                        "pose": case["pose"],
                        "chose": chose.nom,
                        # **La taille qu'on voit, pas celle qu'on espère** :
                        # une image jamais traitée n'a pas de rendu, et c'est
                        # son brut qui s'affiche. Mesuré sur le vrai projet :
                        # vingt et une des quarante-huit images sont dans ce
                        # cas, et le codex les compte comme les autres.
                        "largeur": asset["rendu_largeur"] or asset["largeur"],
                        "hauteur": asset["rendu_hauteur"] or asset["hauteur"],
                    }
                )
        commune = _taille_commune(vues)
        return {
            "personnage": identifiant,
            "fonds": fonds,
            "images": [
                {**vue, "hors_taille": bool(commune) and vue["largeur"] != commune}
                for vue in vues
            ],
            "taille_commune": commune,
            # **La place du mouvement est réservée et grisée avec sa raison**,
            # plutôt qu'occupée par un lecteur posé sur zéro image. Aucune pose
            # du projet ne tient plus d'une vue dans une même direction : il n'y
            # a rien à lire, et le dire vaut mieux qu'un bouton qui attend.
            "mouvement": {
                "possible": False,
                "raison": "aucune pose ne tient plus d'une image dans une direction",
            },
        }

    def oublier_ambiance(self, projet: str, ambiance: str) -> int:
        """Les choses qui se servaient de cette ambiance **retombent sur le jeu**.

        Aucune image ne bouge, et il n'y a pas de trou : seulement un réglage
        qu'on ne pose plus. Le compte est rendu, parce qu'un geste qui touche
        plusieurs choses dit combien — comme la palette rétroactive rend « 12
        remis à jour, 3 conservés ».
        """
        retombees = 0
        for personnage in self.personnages(projet):
            if personnage.ambiance != ambiance:
                continue
            personnage.ambiance = ""
            self._sauver(personnage)
            retombees += 1
        return retombees

    def ajouter_pose(
        self, projet: str, nom: str, images: int = 1, consigne: str = ""
    ) -> Pose:
        """**Nommer, c'est créer** (`docs/PRD.md`) : un nom de pose qui n'existe
        pas encore le crée sur-le-champ, sans passer par un écran de gestion.

        **Et ça n'ajoute qu'une case vide.** Chaque personnage qui porte ce plan
        voit paraître la ligne neuve — sans qu'un seul fichier de personnage soit
        écrit, puisqu'un personnage range ce qu'il **écarte** et non ce qu'il
        tient. Aucune génération ne part, et rien ici ne coûte : c'est un
        critère d'acceptation de la tranche, et il est vrai par construction.
        """
        objet = self._exiger(projet)
        propre = nom.strip()
        if not propre:
            raise ProductionRefusee("une pose se crée avec un nom")
        if any(p.nom.casefold() == propre.casefold() for p in objet.plan):
            raise ProductionRefusee(f"« {propre} » est déjà une pose de ce plan")

        pose = Pose(
            identifiant=repere(propre, {p.identifiant for p in objet.plan}, "pose"),
            nom=propre,
            images=max(1, images),
            # **Vide est une valeur** : le produit ne traduit pas le nom qu'on
            # vient de taper. Sans consigne écrite, c'est le nom qui part — comme
            # avant E10 — et la ligne le dit plutôt que d'inventer un anglais que
            # personne n'a relu avant qu'il ne parte dans un appel payé.
            consigne=consigne.strip(),
        )
        # **En queue, jamais trié.** L'ordre du plan est celui de la matrice, et
        # c'est l'ordre dans lequel l'auteur pense son jeu ; le ranger par
        # alphabet mettrait « attaque » avant « repos » et rendrait deux
        # personnages illisibles côte à côte.
        objet.plan = objet.plan + (pose,)
        self._sauver_projet(objet)
        return pose

    def regler_pose(
        self,
        projet: str,
        pose: str,
        *,
        nom: str | None = None,
        images: int | None = None,
        consigne: str | None = None,
    ) -> Pose:
        """Renommer une pose, corriger ce qu'elle dit au modèle, ou changer le
        nombre d'images qu'elle demande.

        **L'identifiant ne bouge pas**, et c'est tout l'intérêt : les images déjà
        faites le portent, et renommer « marche » en « déplacement » ne doit pas
        leur faire perdre leur case (US-118).

        **Ce que le message ne dit pas, il ne l'efface pas.** La pose porte
        depuis E10 quatre choses de plus que son nom — sa consigne anglaise, les
        directions qu'elle ne tient pas, et ce qu'elle demandait avant la
        proposition de baisse —, et l'écran qui renomme n'en envoie aucune. La
        reconstruire à partir du seul message les viderait à chaque frappe :
        c'est le motif payé trois fois, en E5 puis en E9 (`docs/PIEGES.md`).

        **Toucher le chiffre à la main efface la défaite**, et c'est voulu : ce
        que la pose demandait *avant* n'a plus de sens dès que l'auteur a dit ce
        qu'elle demande maintenant.
        """
        objet = self._exiger(projet)
        courante = self._exiger_pose(objet, pose)

        propre = courante.nom if nom is None else nom.strip()
        if not propre:
            raise ProductionRefusee("une pose garde un nom")
        if any(
            p.identifiant != courante.identifiant
            and p.nom.casefold() == propre.casefold()
            for p in objet.plan
        ):
            raise ProductionRefusee(f"« {propre} » est déjà une pose de ce plan")

        reglee = replace(
            courante,
            nom=propre,
            images=courante.images if images is None else max(1, images),
            images_avant=courante.images_avant if images is None else 0,
            consigne=courante.consigne if consigne is None else consigne.strip(),
        )
        objet.plan = tuple(
            reglee if p.identifiant == courante.identifiant else p for p in objet.plan
        )
        self._sauver_projet(objet)
        return reglee

    def retirer_pose(self, projet: str, pose: str) -> Pose:
        """Une pose quitte le plan — **et les images faites pour elle restent**.

        Jamais de cascade, ici comme ailleurs. La ligne disparaît de la matrice,
        les images restent dans la bibliothèque avec leur label et leur
        filiation, et elles gardent l'identifiant de la pose : remettre la même
        pose au plan les remet dans leur case.

        L'écart des personnages, lui, n'est pas balayé : une entrée qui ne
        désigne plus rien n'écarte rien, et la nettoyer demanderait de réécrire
        tous les personnages du projet pour un geste qui ne le mérite pas.
        """
        objet = self._exiger(projet)
        retiree = self._exiger_pose(objet, pose)
        objet.plan = tuple(
            p for p in objet.plan if p.identifiant != retiree.identifiant
        )
        self._sauver_projet(objet)
        return retiree

    # ── Les personnages ──────────────────────────────────────────────────────

    def personnages(self, projet: str) -> list[Personnage]:
        """Ceux de ce projet, dans l'ordre où ils ont été créés.

        **Lus du disque, jamais d'un index** : ils ne se cherchent ni ne se
        paginent, et effacer `atelier.sqlite3` ne peut pas les perdre.
        """
        self._exiger(projet)
        lus = [
            Personnage.depuis_json(contenu)
            for contenu in self._fichiers.parcourir_personnages(projet)
        ]
        return sorted(lus, key=lambda p: (p.cree_le, p.identifiant))

    def personnage(self, projet: str, identifiant: str) -> Personnage:
        for un in self.personnages(projet):
            if un.identifiant == identifiant:
                return un
        raise PersonnageInconnu(identifiant)

    def creer_personnage(
        self,
        projet: str,
        nom: str,
        description: str = "",
        famille: str = "",
        type: str = "",
    ) -> Personnage:
        """Un nom, une description, et rien d'autre (US-115).

        **Aucun prompt ici, et aucune image.** Le corps naît dans l'atelier et
        nulle part ailleurs : on écrit un sujet, on génère, et c'est l'image
        obtenue qu'on désigne. Ce geste-ci ne fabrique qu'une colonne de cases
        vides — il ne demande rien au fournisseur et ne coûte rien.

        **Et depuis E15, dans la famille où on l'a nommée.** « Un tonneau cerclé
        de fer » tapé dans la colonne *Objets* y reste : c'est le type qui porte
        la famille, et le produit pose donc le premier type de cette famille-là.
        Un choix visible, écrit sur l'établi de la chose et changeable d'un menu
        — jamais un état caché. Sans famille nommée, la chose n'a pas de type et
        suit le plan du jeu : c'est l'état de toutes celles d'avant E9, et une
        chose créée aujourd'hui doit ressembler à celles d'hier.
        """
        propre = nom.strip()
        if not propre:
            raise ProductionRefusee("une chose du jeu se crée avec un nom")
        objet = self._exiger(projet)
        existants = self.personnages(projet)
        if any(p.nom.casefold() == propre.casefold() for p in existants):
            raise ProductionRefusee(f"« {propre} » est déjà une chose de ce projet")

        if type and objet.univers.echelle(type) is None:
            connus = ", ".join(e.nom for e in objet.univers.bareme)
            raise ProductionRefusee(
                f"aucun type « {type} » dans ce jeu — les types sont : {connus}"
            )
        personnage = Personnage(
            identifiant=repere(propre, {p.identifiant for p in existants}, "personnage"),
            projet=projet,
            nom=propre,
            description=description.strip(),
            type=type or (objet.univers.premier_type_de(famille) if famille else ""),
        )
        self._sauver(personnage)
        return personnage

    def regler_personnage(
        self,
        projet: str,
        identifiant: str,
        *,
        nom: str | None = None,
        description: str | None = None,
        tenues: Sequence[str] | None = None,
        concept_arts: Sequence[str] | None = None,
        type: str | None = None,
        ajouter: str | None = None,
        retirer_ajoutee: str | None = None,
        ambiance: str | None = None,
        prend: str | None = None,
        textes: dict[str, str] | None = None,
        eteindre: str | None = None,
        rallumer: str | None = None,
    ) -> Personnage:
        """Tout ce qui se règle sur un personnage, **en un seul geste**.

        Les champs se remplissent ensemble à l'écran — on décrit en cochant les
        poses qu'on veut —, et un appel par champ ferait autant d'allers-retours
        qu'il y a de cases. `None` ne touche pas.

        **`tenues` arrive en positif et se range en négatif.** L'écran envoie ce
        que l'auteur a coché ; le fichier garde le complément, pour qu'une pose
        ajoutée au plan paraisse chez tout le monde sans que rien ne soit
        réécrit. Une pose qu'aucun plan ne connaît est ignorée plutôt que
        refusée : un onglet resté ouvert pendant qu'on retirait une pose ne doit
        pas voir ses coches refusées en bloc.
        """
        objet = self._exiger(projet)
        personnage = self.personnage(projet, identifiant)

        if nom is not None:
            propre = nom.strip()
            if not propre:
                raise ProductionRefusee("un personnage garde un nom")
            if any(
                autre.identifiant != personnage.identifiant
                and autre.nom.casefold() == propre.casefold()
                for autre in self.personnages(projet)
            ):
                raise ProductionRefusee(
                    f"« {propre} » est déjà un personnage de ce projet"
                )
            personnage.nom = propre

        if description is not None:
            personnage.description = description.strip()

        # **Le type décide de la liste, et il se change.** Ce qui était rangé
        # reste rangé : un identifiant qui ne désigne plus rien n'écarte rien,
        # et le nettoyer demanderait de deviner ce que l'auteur voudra si le
        # type revient.
        if type is not None:
            propre = type.strip()
            if propre and objet.univers.echelle(propre) is None:
                connus = ", ".join(e.nom for e in objet.univers.bareme)
                raise ProductionRefusee(
                    f"aucun type « {propre} » dans ce jeu — les types sont : {connus}"
                )
            personnage.type = propre

        # **Ce que cette chose ajoute pour elle seule** : un boss garde les six
        # poses de son type et en ajoute une à lui, sans qu'une case vide
        # paraisse chez les autres.
        if ajouter is not None:
            nomme = ajouter.strip()
            if not nomme:
                raise ProductionRefusee("une pose se crée avec un nom")
            deja = self.plan_de(projet, personnage)
            if any(p.nom.casefold() == nomme.casefold() for p in deja):
                raise ProductionRefusee(
                    f"« {nomme} » est déjà une pose de « {personnage.nom} »"
                )
            personnage.ajoutees = personnage.ajoutees + (
                Pose(
                    identifiant=repere(
                        nomme, {p.identifiant for p in deja}, "pose"
                    ),
                    nom=nomme,
                    images=1,
                ),
            )

        if retirer_ajoutee is not None:
            personnage.ajoutees = tuple(
                p for p in personnage.ajoutees if p.identifiant != retirer_ajoutee
            )

        # **L'ambiance se désigne sur la chose, jamais sur la collection où elle
        # est rangée** (E11). Une collection reste un dossier qui ne décide de
        # rien : grouper vingt monstres et régler leur style sont deux gestes
        # différents, et les confondre ferait qu'un rangement changerait des
        # réglages. Une ambiance inconnue est refusée en nommant celles qui
        # existent — c'est un identifiant, pas un texte libre.
        if ambiance is not None:
            propre = ambiance.strip()
            if propre and objet.ambiance(propre) is None:
                connues = ", ".join(a.nom for a in objet.ambiances) or "aucune"
                raise ProductionRefusee(
                    f"aucune ambiance « {propre} » dans ce jeu — les ambiances "
                    f"sont : {connues}"
                )
            personnage.ambiance = propre

        if prend is not None and prend in CE_QU_ON_PREND:
            personnage.prend = prend

        # **Un texte écrit ici remplace celui du jeu, pour cette chose seule**
        # (E12). Un texte vidé n'est pas un texte éteint : vider rend la case au
        # jeu — ou à l'ambiance —, éteindre écrit un refus. Les confondre aurait
        # rendu le refus indistinguable de l'oubli, et donc impossible à défaire.
        if textes is not None:
            garde = dict(personnage.textes)
            for nom, texte in textes.items():
                if nom not in CHAMPS_BIBLE:
                    continue
                if texte.strip():
                    garde[nom] = texte
                else:
                    garde.pop(nom, None)
            personnage.textes = garde

        # Éteindre et rallumer sont **deux gestes**, et non une liste entière :
        # une liste envoyée en bloc ferait perdre le champ qu'un autre onglet
        # vient d'éteindre.
        if eteindre is not None and eteindre in CHAMPS_BIBLE:
            if eteindre not in personnage.eteints:
                personnage.eteints = (*personnage.eteints, eteindre)
        if rallumer is not None:
            personnage.eteints = tuple(
                nom for nom in personnage.eteints if nom != rallumer
            )

        if tenues is not None:
            cochees = set(tenues)
            # **Sur le plan de cette chose-là**, jamais sur celui du projet : un
            # personnage qui range une pose de son type ne doit pas ranger du
            # même coup une pose que le projet porte encore pour les autres.
            personnage.ecartees = tuple(
                p.identifiant
                for p in self.plan_de(projet, personnage)
                if p.identifiant not in cochees
            )

        if concept_arts is not None:
            personnage.concept_arts = tuple(dict.fromkeys(concept_arts))

        self._sauver(personnage)
        return personnage

    def supprimer_personnage(self, projet: str, identifiant: str) -> dict[str, Any]:
        """Le personnage part, **ses images restent** (`docs/archive/plan-versions-tenues.md` C1).

        Jamais de cascade : chaque image faite pour lui est marquée « personnage
        supprimé » et reste exactement où elle est, comme un enfant survit à son
        parent (US-28, US-29). C'est un fait acquis à l'instant du départ, pas
        une déduction refaite à chaque affichage — sans quoi il faudrait garder
        quelque part la liste des personnages qui ont existé.

        **Un balayage n'annonce pas objet par objet** (`docs/PIEGES.md`) : les
        images se sauvent sans annonce et la grille est annoncée une fois, à la
        fin. Cent images marquées ne doivent pas chasser du flux d'un onglet
        lent les messages qui comptent.
        """
        personnage = self.personnage(projet, identifiant)
        marques = 0
        for asset in self._base.assets_du_personnage(personnage.identifiant):
            if asset.personnage_supprime:
                continue
            asset.personnage_supprime = True
            self._assets.sauver(asset, annoncer=False)
            marques += 1

        self._fichiers.effacer_personnage(projet, personnage.identifiant)
        # Un personnage parti n'a plus de cases à calculer — mais il garde sa
        # forme : l'écran le retire sur `supprime`, et une charge d'une autre
        # forme que les autres serait un cas de plus à traiter pour rien.
        self._diffusion.publier(
            "personnage",
            {**personnage.en_json(), "cases": [], "supprime": True},
        )
        if marques:
            self._diffusion.publier("bibliotheque", self._bibliotheque.arbre())
        return {"personnage": personnage.en_json(), "images": marques}

    # ── Les cases, et ce qui les remplit ─────────────────────────────────────

    def en_charge(self, projet: str, personnage: Personnage) -> dict[str, Any]:
        """Un personnage tel qu'il franchit le port — **et il n'en a qu'une forme**.

        Ses cases sont dedans, toujours. C'est écrit ici et appelé partout parce
        que la première version ne l'a fait que dans le tableau de bord : le
        `PUT` et l'annonce du flux rendaient le même objet **sans** ses cases, et
        l'écran, qui fond ce qui lui arrive par les deux chemins, remplaçait un
        personnage complet par un personnage amputé. Écrire une description
        vidait donc la matrice — jusqu'à la faire tomber. Trouvé au navigateur,
        invisible aux essais d'écran : leur double, lui, rendait la forme
        entière (`docs/PIEGES.md`).
        """
        return {
            **personnage.en_json(),
            "cases": self.cases(projet, personnage),
            # **Ce que cette chose réclame, type compris** : l'écran range ce
            # qu'elle ne tient pas sous un trait plutôt que de le cacher, et il
            # lui faut donc la liste entière, pas seulement les cases tenues.
            "plan": [p.en_json() for p in self.plan_de(projet, personnage)],
            # **Sa famille, lue dans son type** (E15) — et non gardée sur elle :
            # deux vérités sur la même question auraient fini par ranger un
            # meuble dans les décors. Le codex s'en sert pour la classer, et
            # l'établi pour savoir ce qu'il n'a pas à dessiner.
            "famille": self.famille_de(projet, personnage),
            # **Ce que sa famille peut avoir**, pour que l'établi ne dessine pas
            # une colonne d'équipement à un décor. Ce n'est pas un grisé : ce
            # qu'une famille ne peut pas avoir n'existe pas dans son établi.
            "equipable": self.porte_de_lequipement(projet, personnage),
        }

    def cases(self, projet: str, personnage: Personnage) -> list[dict[str, Any]]:
        """Ce qui est fait et ce qui manque, pose par pose (US-119).

        **Rien de tout ceci n'est enregistré.** Une case est pleine parce qu'une
        image la porte, et non parce qu'une liste de cases pleines serait tenue
        quelque part : supprimer une image vide sa case toute seule, et il
        n'existe aucun état à remettre d'accord avec le disque.

        **Et elle porte l'asset entier**, pas un résumé. Une vignette a besoin
        de l'adresse de son image, et cette adresse a un seul endroit où elle
        s'écrit dans tout le produit (`interface/src/composants/Apercu.tsx`) :
        lui donner un objet à moitié aurait fait un second calcul d'adresse, à
        tenir d'accord avec le premier. Ce que la matrice montre est la même
        image que la grille, servie par la même route.
        """
        objet = self._exiger(projet)
        corps: dict[str, list[Asset]] = {}
        calques: dict[str, dict[str, list[Asset]]] = {}
        for asset in self._base.assets_du_personnage(personnage.identifiant):
            if not asset.pose:
                continue
            # **La pièce sépare les deux axes, et elle seule** (C3). Sans pièce,
            # l'image est un corps et remplit la case de sa pose ; avec, elle
            # remplit la case de sa colonne. Sans ce partage, un casque posé sur
            # six poses ferait paraître six corps de plus dans la colonne de
            # gauche, et la matrice dirait « fait » d'une pose qui n'a jamais eu
            # de corps.
            if asset.piece:
                calques.setdefault(asset.pose, {}).setdefault(
                    asset.piece, []
                ).append(asset)
            else:
                corps.setdefault(asset.pose, []).append(asset)

        # **Les directions du jeu, lues une fois pour toutes les lignes.** Vide
        # est un état normal — un jeu vu de face n'en a pas —, et le mot ne
        # paraît alors nulle part : chaque ligne rend `directions: []` et la
        # jauge redevient celle d'avant E10, au chiffre près.
        toutes = objet.univers.directions_du_jeu()
        connues = {d.identifiant for d in toutes}
        rendues: list[dict[str, Any]] = []

        for pose in personnage.tenues(self.plan_de(projet, personnage)):
            siennes = corps.get(pose.identifiant, [])
            tenues = personnage.directions_tenues(pose, toutes)
            premiere = tenues[0].identifiant if tenues else ""
            # Une image sans direction ne connaît pas la sienne : elle se range
            # dans la première, et le produit dit que c'est un rangement.
            anciennes = [a for a in siennes if a.direction is None]

            par_direction: list[dict[str, Any]] = []
            for direction in tenues:
                dedans = [
                    a
                    for a in siennes
                    if a.direction == direction.identifiant
                    or (a.direction is None and direction.identifiant == premiere)
                ]
                par_direction.append(
                    {
                        **direction.en_json(),
                        "images": [a.en_json() for a in dedans],
                        "demandees": pose.images,
                        # **« À confirmer », et le compte de celles qui
                        # l'attendent** (US-242). Un rangement par défaut ne se
                        # fait pas passer pour une déduction : la marque dit
                        # qu'on ne sait pas, et un clic la lève.
                        "a_confirmer": (
                            len(anciennes) if direction.identifiant == premiere else 0
                        ),
                    }
                )

            rendues.append(
                {
                    "pose": pose.identifiant,
                    # **La jauge affiche le produit des deux, jamais les deux
                    # facteurs séparés** (E10) : une pose demande *tant d'images
                    # dans tant de directions*, et lire « 4 × 4 » demanderait au
                    # lecteur de faire la multiplication qu'on cherche à lui
                    # épargner. Sans direction déclarée le produit vaut le
                    # facteur, et rien ne change pour un jeu qui n'en a pas.
                    "demandees": pose.images * max(1, len(tenues)),
                    "images": [a.en_json() for a in siennes],
                    # ── Le second axe de la case (E10) ───────────────────────
                    #
                    # Une entrée par direction tenue, avec ce qui la remplit.
                    # Rien de plus enregistré : c'est toujours l'image qui dit sa
                    # case, et une image supprimée vide la sienne toute seule.
                    "directions": par_direction,
                    # **Ce qui est rangé reste montré**, avec sa portée — c'est
                    # l'idiome de E9 : on relègue sous un trait plutôt que de
                    # faire disparaître, pour qu'un rangement se défasse sans
                    # qu'on ait à se rappeler ce qu'on a rangé.
                    "directions_rangees": [
                        {
                            **direction.en_json(),
                            "portee": (
                                "ici"
                                if direction.identifiant
                                in personnage.directions_ecartees.get(
                                    pose.identifiant, ()
                                )
                                else "jeu"
                            ),
                        }
                        for direction in toutes
                        if direction not in tenues
                    ],
                    # **Une image dont la direction n'existe plus se voit** —
                    # jamais de cascade, et l'orphelin se dit plutôt que de
                    # retomber en silence dans la première colonne venue.
                    "sans_direction": [
                        a.en_json()
                        for a in siennes
                        if a.direction and a.direction not in connues
                    ],
                    # **Le second axe de la matrice** (US-140), pièce par pièce.
                    # Rien de plus enregistré : c'est toujours l'image qui dit sa
                    # case, et une image supprimée vide la sienne toute seule.
                    "calques": {
                        piece: [a.en_json() for a in liste]
                        for piece, liste in calques.get(pose.identifiant, {}).items()
                    },
                    # **Et lequel de ces calques-là partirait dans le jeu**,
                    # pièce par pièce. La même règle que pour le corps, appelée
                    # au même endroit : `corps_retenu`. Elle décidait déjà — à
                    # l'export, sans jamais le dire —, et l'écran ne montrait
                    # donc pas ce qu'il déciderait. Le calculer ici plutôt que
                    # dans l'écran est la règle de `corps` telle quelle : deux
                    # règles à deux endroits finiraient par désigner deux
                    # images différentes.
                    "retenus": {
                        piece: retenu.identifiant
                        for piece, liste in calques.get(pose.identifiant, {}).items()
                        if (retenu := corps_retenu(liste)) is not None
                    },
                    # **Le corps que cette pose enverrait en planche
                    # d'équipement**, ou rien — et c'est ce « rien » qui rend une
                    # pose visiblement inéligible (US-141). Le favori d'abord,
                    # sinon la plus récente : la même règle qu'à la composition,
                    # écrite une fois et lue des deux côtés, pour que l'écran
                    # montre exactement ce qui partira.
                    "corps": _corps(siennes),
                    # **D'où vient cette pose** (E9) : du type, ou ajoutée ici.
                    # Sans elle on ne saurait plus qui a décidé quoi, ni ce qui
                    # bougerait en changeant le type de la chose.
                    "origine": personnage.origine(pose.identifiant),
                }
            )

        return rendues

    def viser(
        self,
        projet: str,
        personnage: str,
        pose: str,
        direction: str | None = None,
    ) -> tuple[Personnage, Pose]:
        """La case qu'un appel va remplir — vérifiée **avant** qu'un centime parte.

        Trois refus, et ils portent leur raison : un personnage qui n'existe pas,
        une pose que ce personnage-là ne tient pas, et — depuis E10 — une
        direction qu'il ne tient pas *pour cette pose*. Aucun n'est du zèle :
        l'écran n'arme que des cases visibles, mais un onglet resté ouvert
        pendant qu'on rangeait enverrait sinon une image dans une case que
        personne ne regarde plus.
        """
        vise = self.personnage(projet, personnage)
        tenues = vise.tenues(self.plan_de(projet, vise))
        for p in tenues:
            if p.identifiant != pose:
                continue
            if direction:
                angles = vise.directions_tenues(
                    p, self._exiger(projet).univers.directions_du_jeu()
                )
                if all(d.identifiant != direction for d in angles):
                    raise ProductionRefusee(
                        f"« {vise.nom} » ne tient pas la direction "
                        f"« {direction} » pour la pose « {p.nom} »"
                    )
            return vise, p
        raise ProductionRefusee(
            f"« {vise.nom} » ne tient pas la pose « {pose} »"
        )

    def sujet(
        self,
        projet: str,
        personnage: str,
        poses: Sequence[str] = (),
        piece: str | None = None,
        direction: str | None = None,
        directions: Sequence[str] = (),
    ) -> str:
        """Ce que l'auteur écrit dans le champ — **le signalement, et lui seul**.

        Deux règles depuis E14, là où il y en avait trois :

        - **Une chose du jeu** : son signalement. C'est la promesse d'US-115 —
          la description part avec chaque image de ce personnage et ne se retape
          jamais.
        - **Une pièce** : sa description seule (C3). Le signalement du
          personnage n'a rien à faire là — le corps est **dans l'image** qui
          part, et le redécrire en mots inviterait le modèle à le redessiner,
          très exactement ce que la mesure du corps repeint sanctionne.

        **La consigne de l'attitude a quitté cette fonction en E14**, et c'est la
        correction d'une divergence que E13 avait déjà à moitié faite. Une case
        seule collait ici `walking posture, facing south` ; une planche de pose ne
        le faisait pas, parce que ses consignes partent case par case. Les deux
        chemins écrivaient donc le même texte à deux endroits différents, et
        l'écran de confirmation aurait dû deviner lequel pour poser sa ligne
        *la pose demandée*. Désormais **le composeur du prompt ajoute la
        consigne, toujours** (`ServiceGenerations`) : le champ porte le
        signalement, la consigne est une ligne à part avec sa propre origine, et
        le texte assemblé est le même qu'avant, mot pour mot.

        **Dans le service depuis C5, et plus à l'écran.** La matrice armait ce
        texte elle-même ; l'agent arme les mêmes cases, et deux compositions à
        deux endroits auraient fini par demander deux choses différentes pour la
        même case — sans que rien ne le signale, puisque les deux auraient
        semblé raisonnables.

        **Ce n'est pas le prompt** : la bible du projet se replie en tête et les
        consignes de planche en queue, et cela n'appartient qu'à
        `ServiceGenerations` (US-158). Ici on n'écrit que le sujet.
        """
        vise = self.personnage(projet, personnage)
        objet = self._exiger(projet)
        if piece:
            trouvee = next((p for p in objet.pieces if p.identifiant == piece), None)
            if trouvee is None:
                raise ProductionRefusee(f"aucune pièce « {piece} » dans ce projet")
            return trouvee.description.strip() or trouvee.nom
        return vise.description.strip()

    def consigne_de_case(
        self,
        projet: str,
        personnage: str,
        pose: str,
        direction: str | None = None,
    ) -> str:
        """Ce que la case demande en plus du signalement (E14).

        **Deux textes anglais, écrits chacun à un seul endroit** — l'attitude sur
        la pose, l'angle sur la direction — et mis bout à bout ici (US-240,
        US-241). On ne recopie plus `facing south` sur six poses, et le corriger
        se fait une fois.

        C'est **le même geste que `_texte_de_case` fait pour une planche**, et
        c'est voulu : une case seule et une case de planche demandent la même
        chose, elles ne diffèrent que par le nombre. Une pose que la chose ne
        tient plus rend une consigne vide plutôt qu'un refus — c'est `viser` qui
        refuse, avant qu'un centime parte, et deux refus pour la même faute en
        auraient fait un de trop.
        """
        if not pose:
            return ""
        try:
            vise = self.personnage(projet, personnage)
        except (PersonnageInconnu, ProjetInconnu):
            return ""
        objet = self._exiger(projet)
        voulue = next(
            (p for p in self.plan_de(projet, vise) if p.identifiant == pose), None
        )
        if voulue is None:
            return ""
        angle = ""
        if direction:
            trouvee = next(
                (
                    d
                    for d in objet.univers.directions_du_jeu()
                    if d.identifiant == direction
                ),
                None,
            )
            angle = trouvee.consigne if trouvee else ""
        return composer(voulue.dit(), angle)

    # ── Le fond du jeu, et ce qu'il interdit (D3) ────────────────────────────

    def fond(self, projet: str | None, corrige: str | None = None) -> str:
        """La couleur de fond de cet appel-ci — celle du jeu, ou celle qu'on corrige.

        **Un seul endroit la résout**, et c'est ce qui garantit que la phrase qui
        *demande* le fond et celle qui *l'interdit sur le sujet* parlent de la
        même couleur. Les composer chacune de son côté aurait laissé passer un
        appel qui demande un fond magenta en interdisant le cyan — et il serait
        parti sans que rien ne le dise.

        `corrige` vaut `None` quand rien n'a été corrigé, une couleur quand
        l'écran de confirmation en a posé une, la chaîne vide quand il l'a
        retirée pour cet appel.
        """
        if corrige is not None:
            return fond_valide(corrige)
        if not projet:
            return ""
        try:
            return self._exiger(projet).univers.fond
        except ProjetInconnu:
            return ""

    def interdit(
        self, projet: str | None, ecrit: str = "", corrige: str | None = None
    ) -> str:
        """Le champ d'interdiction tel qu'il partira — l'auteur, puis le fond (D3).

        **Le produit n'a rien eu à écrire pour que ça parte** : `prompt_negatif`
        existe depuis T1 et les deux adaptateurs le replient en fin de demande
        sous *« Do not include: »*. Cette méthode ne fait que composer les deux
        moitiés, et `atelier.domaine.fond.replier` tient la règle — **ce que
        l'auteur a écrit ne cède jamais devant ce que le produit ajoute**.

        Sans fond, elle rend le texte de l'auteur mot pour mot : un projet
        d'avant la tranche envoie donc exactement ce qu'il envoyait.
        """
        return replier(interdiction(self.fond(projet, corrige)), ecrit)

    # ── La caméra du jeu, redite en queue de prompt ──────────────────────────

    def cadre(self, projet: str | None) -> str:
        """La phrase de cadre, quand le jeu dit déjà quelque chose de lui-même.

        **Elle tombe sous la règle d'US-57 comme les trois autres phrases de
        l'atelier** : *un univers vide ne contraint rien*. Un projet où personne
        n'a rien posé — un import, un agent, un premier essai — reçoit son sujet
        et rien d'autre, et c'est ce que `essais/verifier.py` vérifie depuis R2.
        La première version de cette ligne partait toujours ; elle a cassé
        l'invariant dans l'heure, et c'est l'essai qui l'a dit.

        **Ce qu'elle achète est mesuré** : l'aire du sujet passe de 14,7 % à
        20,1 % de l'image, soit 37 % de pixels en plus avant que le
        rééchantillonnage les emporte (`essais/essai_deux_jeux.py`).
        """
        if not projet:
            return ""
        try:
            objet = self._exiger(projet)
        except ProjetInconnu:
            return ""
        return "" if objet.univers.vide else CADRE

    def cadrage(self, projet: str | None, personnage: str | None = None) -> str:
        """La caméra déclarée par le jeu, dite en dernier et à l'impératif.

        **Mesuré, pas supposé.** `essais/essai_vue.py` a payé trente images le
        1ᵉʳ septembre 2026 pour comparer six réparations du même prompt. Une
        seule a marché, et c'est celle-ci : le rapport hauteur/largeur du sujet
        passe de 1,55 — un corps debout de face — à 1,13 — un corps vu d'aplomb.
        Retirer l'image de référence ne fait rien (1,46) ; ajouter un prompt
        négatif ne fait rien (1,69).

        **Trois morceaux, et le troisième seul dépend de la chose visée.** La
        caméra est vraie pour tout ce que le jeu dessine, une tuile de sol
        comprise. **Les faces qu'on voit aussi** — corrigé le 1ᵉʳ septembre 2026,
        après qu'un coffre de caravane est revenu de trois quarts dans un jeu vu
        de dessus strict : la caméra seule ne tenait pas, et la phrase qui la
        faisait tenir ne partait que pour les personnages. Seul l'exemple humain
        — *la tête, les épaules, les pieds* — reste réservé à la famille qui en a
        un.

        **Vide est une réponse.** Un jeu qui n'a pas déclaré de vue ne contraint
        aucune caméra, et en inventer une ferait parler un jeu que personne n'a
        décrit — c'est la règle d'US-57, appliquée une fois de plus.
        """
        if not projet:
            return ""
        try:
            objet = self._exiger(projet)
        except ProjetInconnu:
            return ""
        connue = vue_connue(objet.univers.vue) if objet.univers.vue else None
        if connue is None or not connue.contrainte:
            return ""
        morceaux = [connue.contrainte, connue.volume]
        if connue.corps and self._a_un_corps(objet, personnage):
            morceaux.append(connue.corps)
        return " ".join(m for m in morceaux if m)

    def _a_un_corps(self, objet: Projet, personnage: str | None) -> bool:
        """Cette chose-là a-t-elle une tête et des pieds ?

        **La famille répond, pas le type.** Le barème range déjà les types en
        cinq familles depuis T4, et « personnages » est celle qui porte les
        créatures avec les héros. Un meuble, une tuile, un décor, un bouton n'ont
        pas de silhouette humaine, et leur dire où est leur visage n'apprendrait
        rien à personne.

        **Sans chose visée, on ne dit rien du corps.** C'est le cas d'un import,
        d'un agent, d'un sujet libre tapé dans le champ : le produit ne sait pas
        si l'on dessine un garde ou une porte, et affirmer l'un des deux serait
        se tromper une fois sur deux. Les *faces* qu'on voit, elles, partent
        quand même — elles sont vraies de n'importe quel volume.
        """
        if not personnage:
            return False
        try:
            vise = self.personnage(objet.identifiant, personnage)
        except (PersonnageInconnu, ProjetInconnu):
            return False
        return objet.univers.famille_du_type(vise.type) == PERSONNAGES

    def concept_arts(self, projet: str, personnage: str | None) -> tuple[str, ...]:
        """Les cartes qu'un personnage désigne (US-124).

        Elles partent **quelle que soit la famille du sujet**, à la différence
        des artworks officiels : un artwork inspire tout un univers et se filtre
        donc par famille, un concept art a été désigné pour *ce personnage-là* —
        l'auteur l'a choisi, l'application n'a rien à en retrancher.

        Un personnage disparu ne fait pas tomber l'appel : il ne désigne plus
        rien, c'est tout.
        """
        if not personnage:
            return ()
        try:
            return self.personnage(projet, personnage).concept_arts
        except (PersonnageInconnu, ProjetInconnu):
            return ()

    def ecartees(self, projet: str, personnage: str | None) -> dict[str, str]:
        """Ce qui ne doit plus partir, et **par quelle portée** (US-126).

        Deux portées se rangent sur le disque — le projet et le personnage —, et
        la troisième, la génération, ne s'écrit nulle part : elle vit dans
        l'onglet et part avec l'appel, comme la pile d'annulation de T8.

        **La plus étroite l'emporte** : c'est la règle affichée à l'écran, et
        elle est ici la seule qui compte, puisque la génération, quand elle a un
        avis, décide seule (voir `ServiceGenerations.preparer`).
        """
        par_portee = {
            identifiant: "projet"
            for identifiant in self._exiger(projet).references_ecartees
        }
        for identifiant in self.concept_arts_ecartees(projet, personnage):
            par_portee[identifiant] = "personnage"
        return par_portee

    def concept_arts_ecartees(self, projet: str, personnage: str | None) -> tuple[str, ...]:
        if not personnage:
            return ()
        try:
            return self.personnage(projet, personnage).references_ecartees
        except (PersonnageInconnu, ProjetInconnu):
            return ()

    def ecarter(
        self, projet: str, *, portee: str, references: Sequence[str], personnage: str | None
    ) -> dict[str, Any]:
        """Poser ce qui ne partira plus, à l'une des deux portées durables.

        **Rien ici ne touche à l'univers ni aux artworks officiels** — c'est un
        critère d'acceptation de la tranche, et il est vrai par construction :
        la liste vit sur le `Projet` à côté des teintes, jamais dans `Univers`,
        qui est défini comme « ce que le projet impose à ce qui rentre, et ce
        qu'il envoie avec ». Une carte décochée reste promue, garde sa famille,
        et continue de compter dans la palette.
        """
        retenues = tuple(dict.fromkeys(r for r in references if r))
        if portee == "projet":
            objet = self._exiger(projet)
            objet.references_ecartees = retenues
            self._bibliotheque.sauver_projet(objet)
            self._annoncer_ecartees(objet)
            return {"portee": portee, "ecartees": list(retenues)}
        if portee == "personnage":
            if not personnage:
                raise ProductionRefusee(
                    "écarter pour un personnage demande de dire lequel"
                )
            vise = self.personnage(projet, personnage)
            vise.references_ecartees = retenues
            self._sauver(vise)
            # **Et l'annonce « ce qui part a changé », comme pour le projet.**
            # Le message du personnage dit *qui il est* ; celui-ci dit que la
            # liste de ce qui partira n'est plus la même — deux faits, deux
            # lecteurs, et l'écran qui tient le panneau n'a pas à déduire l'un
            # de l'autre.
            self._diffusion.publier(
                "references",
                {
                    "projet": projet,
                    "personnage": vise.identifiant,
                    "ecartees": list(retenues),
                },
            )
            return {
                "portee": portee,
                "personnage": vise.identifiant,
                "ecartees": list(retenues),
            }
        raise ProductionRefusee(
            "une portée durable est « projet » ou « personnage » — "
            "celle d'une génération ne s'écrit pas, elle part avec l'appel"
        )

    def designer(
        self,
        asset: str,
        *,
        projet: str,
        personnage: str | None,
        pose: str | None,
        direction: str | None = None,
    ) -> Asset:
        """Cette image **est** le corps de cette case (US-122).

        C'est l'un des deux chemins qui remplissent une case, et le premier dans
        le temps : on écrit un sujet dans l'atelier, on génère, on obtient une
        image, et c'est celle-là qu'on désigne. Rien ici ne fabrique quoi que ce
        soit — **le corps naît dans l'atelier et nulle part ailleurs**, et cette
        méthode ne fait que dire où il va.

        Les deux vides ensemble retirent la désignation : l'image reste dans la
        bibliothèque, sa case redevient vide. Un seul des deux est un refus —
        une pose sans personnage ne désigne rien.
        """
        objet = self._assets.lire(asset)
        if objet is None:
            raise AssetInconnu(asset)

        # **Un calque est solidaire de sa pose** (`docs/archive/plan-versions-tenues.md`, C3). Un casque
        # vu de face n'est pas un casque vu de dos : il en faut un par pose, et
        # ce n'est pas une limite technique a lever, c'est une evidence de
        # dessin. Le produit ne propose donc nulle part de reposer un calque
        # ailleurs — et c'est **ici** que la promesse se tient, parce que c'est
        # le seul geste du produit qui change la case d'une image.
        if objet.piece:
            raise ProductionRefusee(
                "un calque est solidaire de sa pose — il en faut un par pose, "
                "et c'est le pliage qui en divise le prix"
            )

        if personnage is None and pose is None:
            objet.personnage = None
            objet.pose = None
            objet.direction = None
            objet.personnage_supprime = False
        elif personnage is None or pose is None:
            raise ProductionRefusee(
                "une image se désigne par un personnage **et** une pose"
            )
        else:
            vise, visee = self.viser(projet, personnage, pose, direction)
            objet.personnage = vise.identifiant
            objet.pose = visee.identifiant
            # **C'est ici qu'une image cesse d'être « à confirmer »** (E10).
            # Confirmer et déplacer sont le même geste — dire sous quel angle
            # cette image montre sa pose —, et il n'y en a donc qu'un.
            if direction is not None:
                objet.direction = direction or None
            objet.personnage_supprime = False

        self._assets.sauver(objet)
        return objet

    # ── Ce que l'écran lit d'un coup ─────────────────────────────────────────

    def tableau_de_bord(self, projet: str) -> dict[str, Any]:
        """Le plan et les personnages d'un projet, **en un seul aller-retour**.

        Même raison que la toile de T8 : l'écran ne sait rien montrer de l'un
        sans l'autre — une colonne de cases n'existe que par le plan qui la
        nomme —, et deux appels rendraient possible l'instant où l'un est arrivé
        et l'autre non, c'est-à-dire un personnage sans ses lignes.

        **Les poses tenues ne sont pas dans la charge** : elles se déduisent du
        plan et de ce que le personnage écarte, et le plan est **là**, dans le
        même objet. Les envoyer aurait fait une seconde copie qui se périme au
        premier ajout de pose — un plan qui gagne une ligne n'annonce aucun
        personnage, puisque justement il n'en réécrit aucun.

        **Les cases, elles, y sont** — et pour la raison inverse : elles se
        déduisent des *assets*, que l'écran ne tient pas. Il n'en garde que la
        page de grille qu'il a demandée, filtrée sur autre chose ; les compter
        là-dessus dirait un chiffre faux dès la première image hors de vue.
        """
        objet = self._exiger(projet)
        return {
            "projet": objet.identifiant,
            "plan": [p.en_json() for p in objet.plan],
            # **Les directions viennent avec, pour la même raison que le plan**
            # (E10) : une ligne de matrice n'existe pas sans les colonnes qui la
            # découpent, et deux appels rendraient possible l'instant où les
            # cases sont là mais pas les angles qui les nomment.
            **self.directions(projet),
            "personnages": [
                self.en_charge(projet, un) for un in self.personnages(projet)
            ],
        }

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _exiger(self, projet: str) -> Projet:
        objet = self._base.lire_projet(projet) if projet else None
        if objet is None:
            raise ProjetInconnu(
                projet, [p.identifiant for p in self._bibliotheque.projets()]
            )
        return objet

    @staticmethod
    def _exiger_pose(objet: Projet, pose: str) -> Pose:
        for p in objet.plan:
            if p.identifiant == pose:
                return p
        raise PoseInconnue(pose)

    def _annoncer_ecartees(self, objet: Projet) -> None:
        """Ce que le projet n'envoie plus, annoncé sous son propre genre.

        **Pas sur `univers`** : ce message-là fait redemander l'état *et* le
        catalogue depuis T4 (`docs/PIEGES.md`), et une case décochée n'a aucune
        raison de coûter deux appels réseau. Pas sur `plan` non plus — ce n'est
        pas le même sujet, et un lecteur du plan n'a rien à faire d'une
        référence.
        """
        self._diffusion.publier(
            "references",
            {
                "projet": objet.identifiant,
                "ecartees": list(objet.references_ecartees),
            },
        )

    def _sauver_projet(self, objet: Projet) -> None:
        """Le projet passe par sa bibliothèque, **seul écrivain d'un projet**.

        Puis l'annonce : ce qui est annoncé est donc toujours déjà sur le
        disque. Le plan a son propre genre d'événement plutôt qu'un champ de
        plus sur `univers` — un message qui gagne un champ gagne aussi des
        lecteurs qui ne le concernent pas, et `univers` fait redemander l'état
        *et* le catalogue depuis T4 (`docs/PIEGES.md`).
        """
        self._bibliotheque.sauver_projet(objet)
        self._diffusion.publier(
            "plan",
            {"projet": objet.identifiant, "plan": [p.en_json() for p in objet.plan]},
        )

    def _sauver_les_directions(self, objet: Projet) -> None:
        """Le projet, puis l'annonce des directions **sous leur propre genre**.

        Pas `plan`, qui ne parle que des attitudes ; pas `univers`, qui fait
        redemander l'état *et* le catalogue depuis T4 (`docs/PIEGES.md`) — une
        direction renommée n'a aucune raison de coûter deux appels réseau. C'est
        la même décision que le plan a prise en C1, prise pour la même raison.
        """
        self._bibliotheque.sauver_projet(objet)
        self._diffusion.publier(
            "directions",
            {
                "projet": objet.identifiant,
                **self.directions(objet.identifiant),
            },
        )

    def _sauver(self, personnage: Personnage) -> None:
        """**Le seul endroit du dépôt qui écrive un personnage.**

        Écrire d'abord, annoncer ensuite — comme une carte, comme un asset.

        **Le fichier porte l'objet, l'annonce porte sa forme complète.** Les
        cases ne s'écrivent pas : elles se déduisent, et les ranger sur le disque
        en ferait une seconde vérité. Elles voyagent en revanche avec chaque
        annonce, parce que l'écran fond ce qu'il reçoit et qu'une charge amputée
        remplacerait un objet entier par un objet à trous.
        """
        self._fichiers.ecrire_personnage(
            personnage.projet, personnage.identifiant, personnage.en_json()
        )
        self._diffusion.publier(
            "personnage", self.en_charge(personnage.projet, personnage)
        )


def corps_retenu(images: Sequence[Asset]) -> Asset | None:
    """Le corps que le produit retiendrait pour cette pose.

    **Le favori d'abord, sinon la plus récente.** Un auteur qui a marqué favori
    la bonne image sur trois essais a déjà dit laquelle est le corps ; lui
    redemander à chaque planche serait redemander ce qu'il vient de répondre.

    Écrite ici et lue par `ServiceEquipement`, qui compose la planche : deux
    règles à deux endroits finiraient par désigner deux images différentes, et
    l'écran montrerait alors autre chose que ce qui part.
    """
    retenu: Asset | None = None
    for asset in images:
        if retenu is None or (asset.favori, asset.cree_le, asset.rang) > (
            retenu.favori,
            retenu.cree_le,
            retenu.rang,
        ):
            retenu = asset
    return retenu


def _corps(images: Sequence[Asset]) -> str | None:
    retenu = corps_retenu(images)
    return retenu.identifiant if retenu else None
