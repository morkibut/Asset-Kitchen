# -*- coding: utf-8 -*-
"""Les dix teintes — **le seul endroit du produit où une couleur ne veut rien dire**.

Un îlot ou une note en porte une parce que l'auteur l'a choisie, jamais parce
qu'un état la commande : c'est l'inverse exact des quatre sémantiques du châssis
— `--ok`, `--epingle`, `--echec`, `--signal` —, qui disent toutes un fait sur le
monde. `docs/archive/DESIGN-chassis-chaud-2026-09-04.md` § Les dix teintes de
rangement porte les valeurs et les trois disciplines qui les tiennent à
distance ; ce fichier-ci ne porte que **la liste close**, et rien de ce
qu'elles valent.

⚠️ **Les dix ont été choisies pour un fond presque noir, et le carnet est du
papier** (`docs/DESIGN.md` § Deux trous, et ils sont réels). Elles sont à
refaire ; la liste close, elle, ne bouge pas.

**Aucun hexadécimal ici, et c'est la décision.** Le produit range un *nom* —
`ardoise`, `iris` — et l'écran seul sait ce qu'il vaut, par son token. Ranger
`#7086A0` aurait fait du fichier d'un projet une seconde vérité sur la palette
du châssis : le jour où `docs/DESIGN.md` déplace une teinte d'un point, tous les
îlots déjà teintés garderaient l'ancienne, et personne ne saurait dire laquelle
est la bonne. C'est la même règle que pour la palette d'un univers, dans l'autre
sens : là, c'est le calcul qui fait foi et le cache qui porte son empreinte.

**Un module à part parce que deux objets s'en servent et qu'aucun ne la
possède** : la carte, pour la teinte d'une note qu'elle porte elle-même, et le
projet, pour celle d'un îlot — qui ne peut pas vivre sur ses cartes, six membres
faisant six vérités possibles pour un seul îlot (`docs/ARCHITECTURE.md` §5).
Écrire la liste dans l'un des deux aurait fait dépendre l'autre de lui.

**La liste est fermée, et c'est un critère d'acceptation** (`docs/archive/plan-versions-tenues.md` T9) :
il n'existe aucun sélecteur libre, et le premier îlot rouge vif se lirait comme
un échec.

**Six jusqu'au 28 août 2026, dix depuis.** La demande était « plus de couleurs,
et qu'on les voie » ; la seconde moitié a été rendue entière — fond à 16 %,
bandeau en teinte pleine — et la première dans les limites que la sémantique
laisse. Les quatre neuves subdivisent les arcs déjà occupés, parce que **deux
arcs de la roue sont interdits et ce sont ceux des sémantiques**. C'est aussi ce
qui a tranché la demande de « couleurs primaires », et il l'a tranchée contre :
une primaire est au milieu d'un arc, et les trois arcs qu'on demandait sont les
trois qui sont fermés. Que le nombre bouge ne change rien à la clôture — c'est
elle, et non le compte, qui est le critère.
"""

from __future__ import annotations

# L'ordre est celui de `docs/DESIGN.md`, et c'est celui des pastilles à l'écran :
# les sept froides d'abord, les trois chaudes ensuite — c'est-à-dire l'ordre de
# la roue. Il ne se trie pas alphabétiquement : une roue de teintes rangée par
# nom n'est plus une roue.
ARDOISE = "ardoise"
PERVENCHE = "pervenche"
IRIS = "iris"
LAVANDE = "lavande"
PRUNE = "prune"
MAUVE = "mauve"
BRUYERE = "bruyere"
MOUSSE = "mousse"
LICHEN = "lichen"
PAILLE = "paille"

TEINTES: tuple[str, ...] = (
    ARDOISE,
    PERVENCHE,
    IRIS,
    LAVANDE,
    PRUNE,
    MAUVE,
    BRUYERE,
    MOUSSE,
    LICHEN,
    PAILLE,
)

# Le vide **est** une valeur : un îlot sans teinte porte celle du châssis, ce
# qui est exactement ce que `docs/DESIGN.md` dit qu'il est. Ce n'est donc pas un
# réglage manquant, et retirer une teinte est un geste comme en poser une.
AUCUNE = ""


def teinte_valide(brut: object) -> str:
    """Le nom d'une teinte relu du disque, ou rien.

    **Un nom inconnu revient vide plutôt que de faire tomber la lecture.** Même
    règle que la place d'une carte : un îlot mal teinté se reteinte d'un clic,
    un tableau qui ne s'ouvre plus ne se répare pas. Et le vide est ici une
    valeur légitime, pas un repli honteux — c'est le châssis.
    """
    return brut if isinstance(brut, str) and brut in TEINTES else AUCUNE
