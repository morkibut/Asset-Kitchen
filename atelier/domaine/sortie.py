# -*- coding: utf-8 -*-
"""La sortie — **ce qui sortirait**, dit avant que rien ne soit écrit (B21).

Jusqu'ici l'atelier savait sortir, et seulement sortir : quatre gestes à quatre
endroits, chacun écrivant tout de suite. Aucun ne répondait à la question que
l'auteur pose cinquante fois par jeu — *qu'est-ce qui va être écrit, et qu'est-ce
qui a changé depuis la dernière fois ?*

Ce module ne fait rien : il **nomme**. Les cinq listes fermées de l'écran, la
forme d'un fichier prévu, et la marque qu'il porte face à ce qui est déjà là.
C'est du vocabulaire, et il se lit sans disque, sans projet et sans atelier —
c'est ce qui permet d'éprouver les règles de nommage et de marquage sans monter
quoi que ce soit.

**Aucune de ces listes n'est ouverte**, et c'est la règle de `docs/DESIGN.md`
pour un écran neuf : un réglage qui accepterait n'importe quelle valeur ferait
un écran qu'on ne peut plus dessiner, et un serveur qui devrait deviner ce qu'on
lui a envoyé.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from atelier.domaine.carte import DECORS, INTERFACE, OBJETS, PERSONNAGES

# ── 1 · Ce qui sort ─────────────────────────────────────────────────────────

# Les lots, et **ce sont les familles du jeu, plus les animations**. La planche
# en dessine deux de plus — *les terrains*, *les calques d'équipement* — et
# aucun des deux n'existe dans le produit :
#
# - *terrains* n'est pas une famille (`atelier/domaine/carte.py` § FAMILLES) ;
# - *les calques d'équipement* ne sont pas un lot mais **ce qui accompagne un
#   corps**. L'export le dit déjà, et c'est une règle qui tient : « une pose sans
#   corps ne sort pas, ses calques compris » — un calque est une différence posée
#   sur un corps, seul dans un dossier de jeu il ne se pose sur rien. En faire un
#   lot aurait permis de sortir des calques sans corps, ce que le geste d'à côté
#   refuse depuis C5.
TOUT = "tout"
ANIMATIONS = "animations"
# **`tous` n'y est pas**, et ce n'est pas un oubli : c'est la planche non
# figurative du tableau d'inspiration — matières, palette, échantillons de trait
# —, elle n'a ni pose ni case, et rien d'elle ne sort dans un jeu.
LOTS = (TOUT, PERSONNAGES, OBJETS, DECORS, INTERFACE, ANIMATIONS)

# ── 3 · Comment ça se range ─────────────────────────────────────────────────

# **À plat, c'est ce que le produit fait depuis T6**, et la raison est écrite en
# tête de `atelier/services/export.py` : « un sous-dossier inventé ici serait une
# structure imposée à un jeu dont personne ici ne sait comment il range ».
#
# La raison tient toujours — et c'est pour ça que le second rangement n'est pas
# une arborescence de plus mais **celle du jeu lui-même** : une famille est un
# mot que l'auteur a posé, pas un mot que nous inventons.
A_PLAT = "a_plat"
EN_DOSSIERS = "en_dossiers"
RANGEMENTS = (A_PLAT, EN_DOSSIERS)

# Le dossier des animations quand on range en dossiers. Elles ne sont d'aucune
# famille — une bande porte un sujet, jamais une famille — et les mêler aux
# images fixes ferait charger une planche de sprites comme un sprite.
DOSSIER_DES_ANIMATIONS = "animations"

# ── 4 · Ce qui existe déjà là-bas ───────────────────────────────────────────

# **Les quatre, et le produit n'en connaissait qu'un.** `ServiceAgent.deposer`
# numérote, toujours, et sa raison était bonne pour un agent qui génère en
# boucle : « refuser arrêterait une boucle de génération sur un homonyme ».
# Elle est mauvaise pour une sortie qu'on refait cinquante fois — après trois
# passages le dossier porte `pelerin-repos.png`, `-2`, `-3`, et c'est au jeu de
# deviner lequel charger.
REMPLACER = "remplacer"
NUMEROTER = "numeroter"
ARRETER = "arreter"
# **Le quatrième est le seul qui ait besoin de mémoire.** Remplacer, numéroter
# et s'arrêter se décident en regardant le dossier ; effacer ce qui ne sort plus
# demande de savoir *ce que nous avions posé la fois d'avant* — un fichier que
# l'auteur a mis là lui-même ne nous appartient pas et ne s'efface jamais.
EFFACER = "effacer"
COLLISIONS = (REMPLACER, NUMEROTER, ARRETER, EFFACER)

# ── 5 · Pour quel moteur ────────────────────────────────────────────────────

AUCUN = "aucun"
GODOT = "godot"
UNITY = "unity"
PHASER = "phaser"
MOTEURS = (AUCUN, GODOT, UNITY, PHASER)

# ── La marque d'un fichier face à ce qui est déjà là ────────────────────────

NOUVEAU = "nouveau"
REMPLACE = "remplace"
INCHANGE = "inchange"
# Ce que la sortie précédente avait posé et qui ne sort plus. Ce n'est pas la
# marque d'un fichier prévu — rien ne le prévoit — mais celle d'un reste, et
# c'est le seul cas où la sortie parle d'un fichier qu'elle n'écrit pas.
RESTE = "reste"

# ── Ce qu'un fichier est, dans l'arbre ──────────────────────────────────────

# Le rôle, repris **tel quel** de l'export (`atelier/services/export.py` §
# CORPS / CALQUE / HABILLE) pour les images, et trois mots de plus pour ce
# qu'une animation pose. Les six se lisent dans l'arbre, et c'est ce qui permet
# de comprendre `pelerin-marche-est.json` sans l'ouvrir.
PLANCHE = "planche"
ACCOMPAGNEMENT = "accompagnement"
ANIMEE = "animee"
DESCRIPTIF = "descriptif"
CATALOGUE = "catalogue"


@dataclass(frozen=True, slots=True)
class Reglage:
    """Ce que l'écran a choisi — les cinq réponses, et rien d'autre.

    **Aucune valeur libre en dehors du dossier et du sujet.** Le reste est pris
    dans les listes fermées du dessus : c'est ce qui permet à l'écran de se
    dessiner en boutons plutôt qu'en champs, et au serveur de refuser une valeur
    inconnue plutôt que de la deviner.
    """

    lot: str = TOUT
    dossier: str | None = None
    rangement: str = A_PLAT
    collision: str = REMPLACER
    moteur: str = AUCUN
    # **Un seul sujet, et il gagne sur le lot** (`RP17`). Sortir un personnage
    # nommé avait sa propre porte, sans aperçu ; c'est devenu un réglage de
    # celle-ci. Posé, il emporte ce sujet-là *en entier* — ses images et ses
    # animations —, et le lot n'a plus rien à dire : deux réglages qui
    # trancheraient la même question auraient fini par se contredire, et
    # « lot = objets, sujet = un personnage » n'a aucune réponse juste.
    sujet: str = ""

    def en_json(self) -> dict[str, Any]:
        return {
            "lot": self.lot,
            "dossier": self.dossier,
            "rangement": self.rangement,
            "collision": self.collision,
            "moteur": self.moteur,
            "sujet": self.sujet,
        }


@dataclass(frozen=True, slots=True)
class Prevu:
    """Un fichier tel qu'il sortirait — **son nom, son poids, et sa marque**.

    Il ne porte pas ses octets. Un lot de sept cents fichiers en mémoire est
    très exactement le piège que la planche relève sur l'archive d'aujourd'hui
    (« construite entièrement en mémoire avant de partir »), et l'aperçu serait
    le pire endroit pour le refaire : il se demande *avant* de vouloir écrire,
    donc plus souvent que l'écriture.

    `empreinte` est celle de ce qui **sortirait**, et c'est elle qui décide de
    la marque. Le nom, lui, ne décide de rien — c'est la règle de l'export, et
    elle vaut ici : « le nom de fichier est une commodité de lecture, jamais un
    identifiant ».
    """

    chemin: str
    octets: int
    empreinte: str
    marque: str
    role: str
    # Ce qui l'a produit, pour que l'écran sache où renvoyer. Un identifiant
    # d'asset, de bande, ou rien du tout pour un descriptif et un catalogue.
    sujet: str = ""
    source: str = ""
    largeur: int = 0
    hauteur: int = 0
    # Le compte d'images d'une planche de sprites. Zéro partout ailleurs — une
    # image fixe n'a pas de cases, et écrire 1 laisserait croire le contraire.
    images: int = 0

    def en_json(self) -> dict[str, Any]:
        return {
            "chemin": self.chemin,
            "octets": self.octets,
            "empreinte": self.empreinte,
            "marque": self.marque,
            "role": self.role,
            "sujet": self.sujet,
            "source": self.source,
            "largeur": self.largeur,
            "hauteur": self.hauteur,
            "images": self.images,
        }


@dataclass(frozen=True, slots=True)
class PasPret:
    """Une chose qui ne sortira pas, ou qui sortira diminuée.

    **Un genre, un compte, et de quoi y aller.** L'écran n'a pas à savoir lire
    quatre formes différentes : les quatre alertes de la planche sont la même
    forme quatre fois, et une cinquième s'ajoutera sans qu'il change.
    """

    genre: str
    phrase: str
    sujets: tuple[dict[str, str], ...] = ()

    def en_json(self) -> dict[str, Any]:
        return {
            "genre": self.genre,
            "phrase": self.phrase,
            "compte": len(self.sujets),
            "sujets": [dict(s) for s in self.sujets],
        }


# Les quatre genres de la planche. **L'écran écrit un titre par genre**, et un
# genre qu'il ne connaîtrait pas s'afficherait sous son nom de code plutôt que
# de disparaître — un cinquième s'ajoute donc sans casser l'écran, mais il se
# voit tout de suite.
SANS_IMAGE = "sans_image"
UNE_SEULE_DIRECTION = "une_seule_direction"
ANIMATION_VIDE = "animation_vide"
CORPS_HABILLE = "corps_habille"


@dataclass(frozen=True, slots=True)
class Precedente:
    """La sortie d'avant — **la seule chose qu'il fallait ajouter** (B21).

    Quatre champs, et c'est tout ce que « ce qui a changé » demande. Elle ne
    garde pas les octets, ni les fiches, ni les recettes : ce qui fait foi est
    le dossier lui-même, relu à chaque aperçu. Elle sert à deux choses que le
    dossier ne sait pas dire — **quand** on est passé, et **quels fichiers de
    là-bas sont les nôtres**.
    """

    le: float = 0.0
    dossier: str = ""
    chemins: tuple[str, ...] = ()
    octets: int = 0

    def en_json(self) -> dict[str, Any]:
        return {
            "le": self.le,
            "dossier": self.dossier,
            "compte": len(self.chemins),
            "chemins": list(self.chemins),
            "octets": self.octets,
        }


@dataclass(frozen=True, slots=True)
class Apercu:
    """Ce que la sortie ferait, **sans l'avoir faite**.

    C'est la réponse de la route qui ne touche pas au disque. L'écran en tire
    ses trois colonnes : l'arbre au milieu, les quatre comptes sous lui, ce qui
    n'est pas prêt à droite, et le poids sur le bouton.
    """

    dossier: str
    fichiers: tuple[Prevu, ...]
    restes: tuple[Prevu, ...]
    pas_prets: tuple[PasPret, ...]
    precedente: Precedente | None
    reglage: Reglage
    # Le refus, quand il y en a un — **une phrase, pas une exception**. Un
    # aperçu qui ne peut rien montrer reste un aperçu : l'écran grise son bouton
    # et affiche la raison, exactement comme le grisé de `docs/design-motifs.md`
    # § Le grisé porte sa raison.
    refus: str = ""

    @property
    def octets(self) -> int:
        return sum(f.octets for f in self.fichiers)

    def comptes(self) -> dict[str, int]:
        rendu = {NOUVEAU: 0, REMPLACE: 0, INCHANGE: 0, RESTE: len(self.restes)}
        for fichier in self.fichiers:
            rendu[fichier.marque] = rendu.get(fichier.marque, 0) + 1
        return rendu

    def en_json(self) -> dict[str, Any]:
        return {
            "dossier": self.dossier,
            "fichiers": [f.en_json() for f in self.fichiers],
            "restes": [f.en_json() for f in self.restes],
            "pas_prets": [p.en_json() for p in self.pas_prets],
            "precedente": self.precedente.en_json() if self.precedente else None,
            "reglage": self.reglage.en_json(),
            "compte": len(self.fichiers),
            "octets": self.octets,
            "comptes": self.comptes(),
            "refus": self.refus,
        }


@dataclass(frozen=True, slots=True)
class Bilan:
    """Ce qui vient d'être écrit — l'aperçu, plus ce que le disque a répondu.

    **Les mêmes chemins que l'aperçu annonçait**, et c'est ce qui se vérifie :
    un bilan qui nommerait d'autres fichiers voudrait dire que l'aperçu ne
    prévoyait pas ce que l'écriture fait, et l'écran entier ne servirait plus à
    rien.
    """

    dossier: str
    ecrits: tuple[Prevu, ...]
    effaces: tuple[str, ...] = ()
    # Ce qui n'a pas été réécrit parce que c'était déjà le même fichier. Compté
    # à part : « rien à faire » et « fait » ne se disent pas pareil.
    inchanges: int = 0
    descriptif: str = ""
    catalogue: str = ""
    le: float = 0.0

    def en_json(self) -> dict[str, Any]:
        return {
            "dossier": self.dossier,
            "ecrits": [f.en_json() for f in self.ecrits],
            "effaces": list(self.effaces),
            "inchanges": self.inchanges,
            "descriptif": self.descriptif,
            "catalogue": self.catalogue,
            "le": self.le,
            "compte": len(self.ecrits),
            "octets": sum(f.octets for f in self.ecrits),
        }


def marque(existant: bytes | None, empreinte_prevue: str, empreinte_du_disque: str) -> str:
    """Nouveau, remplacé ou inchangé — **et le disque tranche, pas la mémoire**.

    C'est l'invariant du dépôt, écrit noir sur blanc dans l'export lui-même
    (`_archiver_bandes` : « relue après la planche, et pas avant — ce qui est là
    fait foi »). Un index qui dirait seul ce qui a été posé se tromperait au
    premier fichier effacé à la main, au premier dossier restauré d'une
    sauvegarde, au premier passage d'un autre outil.

    La sortie précédente sert donc à autre chose, et à une seule chose : dire
    **lesquels de ces fichiers-là sont les nôtres**, pour qu'`effacer` ne
    touche jamais à ce que l'auteur a mis là.
    """
    if existant is None:
        return NOUVEAU
    return INCHANGE if empreinte_du_disque == empreinte_prevue else REMPLACE
