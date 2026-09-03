# -*- coding: utf-8 -*-
"""Le fond sur lequel le sujet est posé — **un réglage du jeu, jamais un calcul** (D3).

Le produit demandait jusqu'ici *un fond plat*, sans dire lequel : le modèle
rendait donc un gris clair, c'est-à-dire une couleur que le sujet porte aussi.
De là le découpage à reprendre sur presque chaque image — le remplissage depuis
le bord mange ce qui ressemble au fond, et une joue grise ressemble à un fond
gris.

**Une couleur franche que rien dans le jeu ne contient rend le découpage presque
gratuit et presque parfait.** C'est tout le contenu de cette tranche, et c'est
aussi tout ce qu'elle promet.

── Ce que ce module fait, et surtout ce qu'il ne fait pas ────────────────────

**Il propose, il n'impose pas.** L'auteur choisit son fond ; l'atelier calcule à
quelle distance chaque candidat tombe de la palette du jeu et nomme le premier
qui passe le seuil. *S'il n'y en a aucun, il le dit* et laisse le fond en place :
choisir en silence une couleur que le jeu contient serait exactement la panne
qu'on répare. La version précédente de la tranche voulait qu'il **calcule** la
couleur et l'impose ; l'auteur a tranché autrement le 2 septembre 2026, et c'est
plus simple — *si la couleur choisie donne un moins bon résultat, il la change en
un geste et le voit sur l'image suivante.*

**La distance est celle du détourage, et pas une autre.** Un pixel est mangé par
le remplissage depuis le bord quand aucune de ses trois composantes ne s'écarte
du fond de plus que la tolérance — `traitement.detourer_bord`, distance de
Tchebychev. Mesurer la sûreté d'un candidat avec une autre distance aurait
répondu à une autre question que celle qui se pose : *le découpage va-t-il manger
une couleur du jeu ?*

**Aucun banc — tranché par l'auteur le 2 septembre 2026.** La version d'avant
exigeait huit tirages par branche avant la première ligne. *« Pas besoin de
tester ça. »* Ce qui remplace le banc est plus utile que lui : deux mesures
d'acceptation lues sur les images qu'on voulait de toute façon — les pixels de
bord, et les pixels encore collés à la couleur de fond
(`atelier.services.assets.ServiceAssets.taches_de`).

⚠️ **Ce que ça coûte, et il faut le savoir** : cette tranche change ce qui part
au fournisseur, donc elle **invalide les comparaisons avec les tirages déjà
payés**. Les 135 notes d'animation restent valables entre elles, jamais contre un
tirage postérieur. C'est un prix accepté, pas un oubli.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

# **Le fond que personne n'a posé.** Vide *est* une valeur, et c'est celle qui
# rend le comportement d'avant la tranche au caractère près : le produit demande
# un fond plat sans dire lequel, et aucune phrase d'interdiction ne part. C'est
# ce qui fait qu'un univers écrit avant D3 — et un univers sans palette, qui n'a
# rien pour proposer — ne change pas d'un mot.
AUCUN_FOND = ""


def fond_valide(brut: object) -> str:
    """Un `#rrggbb` relu du disque ou reçu d'un écran, ou rien.

    **Ne lève pas, et rend le vide plutôt qu'une couleur inventée.** Même règle
    que la teinte d'un îlot : un réglage mal écrit se repose d'un clic, et une
    lecture de projet qui tomberait dessus fermerait tout le projet pour un
    champ.

    Le `#` est remis et les lettres passent en majuscules : la couleur part dans
    le texte du prompt et se relit sur une génération enregistrée des mois plus
    tard — deux écritures de la même couleur y liraient comme deux fonds.
    """
    if not isinstance(brut, str):
        return AUCUN_FOND
    propre = brut.strip().lstrip("#")
    if len(propre) != 6:
        return AUCUN_FOND
    try:
        int(propre, 16)
    except ValueError:
        return AUCUN_FOND
    return "#" + propre.upper()


def rvb(couleur: str) -> tuple[int, int, int]:
    """Les trois octets d'un `#rrggbb`. Une couleur illisible rend du noir.

    **Jumelle de `traitement._rvb`, et volontairement écrite deux fois** : le
    domaine ne dépend d'aucune autre couche, et faire descendre le traitement
    d'image dans le domaine pour trois lignes d'hexadécimal coûterait plus cher
    que la répétition. `tests/test_d3.py` confronte les deux sur toute la liste
    des candidats, pour qu'une divergence se voie au lieu de se deviner.
    """
    propre = couleur.strip().lstrip("#")
    if len(propre) != 6:
        return 0, 0, 0
    try:
        return int(propre[0:2], 16), int(propre[2:4], 16), int(propre[4:6], 16)
    except ValueError:
        return 0, 0, 0


def ecart(a: str, b: str) -> int:
    """De combien deux couleurs s'écartent, **dans la distance du détourage**.

    La plus grande des trois différences de composante — celle que
    `detourer_bord` compare à sa tolérance. C'est la seule qui réponde à la
    question posée : *ce pixel-là va-t-il être mangé avec le fond ?*
    """
    return max(abs(x - y) for x, y in zip(rvb(a), rvb(b)))


# **La tolérance livrée du remplissage depuis le bord** — `Passe.tolerance`. Elle
# est recopiée ici plutôt qu'importée pour que le domaine du fond ne dépende pas
# de celui de la recette : ce sont deux questions, et l'une n'a pas à ouvrir
# l'autre. `tests/test_d3.py` vérifie qu'elles ne se sont pas séparées.
TOLERANCE_LIVREE = 28

# **Trois tolérances, et le facteur trois est une marge, pas une mesure.** Une
# couleur du jeu qui tomberait à moins d'une tolérance du fond serait mangée avec
# lui ; les deux tolérances de plus paient le fait que **le modèle ne rend jamais
# exactement l'hexadécimal qu'on lui demande** — il en rend un voisin, et c'est ce
# voisin-là que le découpage vise.
#
# ⚠️ **Ce chiffre-ci est le seul du module qui ne vienne pas d'un relevé**, et
# c'est écrit plutôt que tu : aucune image du dépôt n'a été tirée sur un fond
# franc, donc la dérive réelle entre l'hexadécimal demandé et celui rendu n'est
# pas connue. Elle se lira sur les premières images qui reviendront, par la
# mesure « pixels encore collés à la couleur de fond » — et ce seuil se reposera
# alors sur ce qu'on aura vu.
ECART_MINIMAL = 3 * TOLERANCE_LIVREE


@dataclass(frozen=True, slots=True)
class Candidat:
    """Une couleur de fond que l'atelier sait proposer, et son nom en anglais.

    `nom` part **dans le texte du prompt, à côté de l'hexadécimal**. Un modèle
    d'image lit `#FF00FF` moins bien que `magenta`, et il lit les deux ensemble
    mieux que l'un des deux : l'hexadécimal donne la valeur exacte que le
    découpage visera, le mot donne la famille au cas où la valeur se perde.

    **La liste est fermée**, comme celle des teintes d'îlot, et pour la même
    raison : un sélecteur libre de « couleurs franches » aurait rendu le premier
    beige qu'on lui aurait donné.
    """

    couleur: str
    nom: str


# **Six candidats, dans l'ordre où on les propose**, et l'ordre est celui de leur
# rareté dans un dessin de jeu :
#
# 1. le magenta, qui n'existe presque jamais dans un décor ni sur une peau ;
# 2. le cyan pur, qu'un ciel n'atteint pas — un ciel est bleu, pas cyan ;
# 3. le rose vif ;
# 4. le vert pur, l'incrustation classique du cinéma, **placé quatrième et non
#    premier** : c'est la couleur la plus courante d'un jeu — feuillage, herbe,
#    potion, cape — et la clé de chrominance de l'image l'a rendue populaire là
#    où le sujet est un acteur, jamais un arbre ;
# 5. le violet ;
# 6. l'orange vif, qui est le dernier parce qu'une peau chaude s'en approche.
#
# **Aucun n'est un défaut.** Le fond livré reste vide, et il le reste tant que
# l'auteur n'a pas choisi : proposer est un geste de l'écran, pas une valeur du
# produit.
CANDIDATS: tuple[Candidat, ...] = (
    Candidat("#FF00FF", "magenta"),
    Candidat("#00FFFF", "cyan"),
    Candidat("#FF0090", "bright pink"),
    Candidat("#00FF00", "pure green"),
    Candidat("#9000FF", "violet"),
    Candidat("#FF7A00", "bright orange"),
)


@dataclass(frozen=True, slots=True)
class Proposition:
    """Ce que l'atelier propose comme fond — **ou la raison de ne rien proposer**.

    `couleur` vide veut dire *aucun candidat sûr*, et `raison` dit alors pourquoi,
    en français et à l'auteur. Les deux ne se contredisent jamais : `sure` est la
    seule lecture à faire.

    `ecart` est la distance du candidat retenu à la couleur du jeu la plus
    proche, dans la distance du détourage. Il ne sert pas à décider — la décision
    est prise —, il sert à **comprendre** : un écart de 200 dit que le fond est
    hors de tout danger, un écart de 90 dit qu'il passe de justesse.

    `voisine` est cette couleur du jeu la plus proche. C'est elle que l'écran
    montre à côté de la pastille proposée : « la couleur de ton jeu la plus proche
    de ce fond, et elle en est à tant ».
    """

    couleur: str = AUCUN_FOND
    nom: str = ""
    ecart: int = 0
    voisine: str = ""
    raison: str | None = None

    @property
    def sure(self) -> bool:
        return bool(self.couleur) and self.raison is None

    def en_json(self) -> dict[str, Any]:
        return {
            "couleur": self.couleur,
            "nom": self.nom,
            "ecart": self.ecart,
            "voisine": self.voisine,
            "raison": self.raison,
        }


SANS_PALETTE = (
    "ce jeu n'a pas encore de palette : rien ne dit quelles couleurs il "
    "contient, donc rien ne dit lesquelles éviter"
)
AUCUN_CANDIDAT_SUR = (
    "aucune des couleurs franches que l'atelier connaît n'est assez loin de "
    "la palette de ce jeu — choisis-en une à la main en sachant qu'elle sera "
    "aussi dans le sujet"
)


def proposer(palette: Iterable[str]) -> Proposition:
    """Le premier candidat assez loin de la palette du jeu — **ou rien** (D3).

    **Un calcul fait une fois, et il tient en trois lignes** : la palette d'un
    projet est une liste fermée de quelques dizaines de couleurs, et l'écart d'un
    candidat à cette liste est le plus petit de ses écarts à chacune.

    **Sans palette, il ne propose pas** et le dit. C'est le sixième critère de la
    tranche pris à la lettre : *un univers sans palette garde exactement le
    comportement d'aujourd'hui.* Un jeu qui n'a pas d'artwork officiel n'a rien
    dit de ses couleurs — proposer le magenta parce que la liste est vide serait
    proposer au hasard en ayant l'air de calculer.

    **Aucun candidat sûr est une réponse, pas une panne.** Elle arrive sur un jeu
    dont la palette couvre la roue — un jeu très coloré —, et la bonne conduite
    est alors de laisser le fond en place et de dire à l'auteur ce qu'il achète
    s'il en pose un quand même.
    """
    couleurs = [c for c in (fond_valide(x) for x in palette) if c]
    if not couleurs:
        return Proposition(raison=SANS_PALETTE)

    meilleur: Proposition | None = None
    for candidat in CANDIDATS:
        voisine = min(couleurs, key=lambda c: ecart(candidat.couleur, c))
        distance = ecart(candidat.couleur, voisine)
        propose = Proposition(
            couleur=candidat.couleur,
            nom=candidat.nom,
            ecart=distance,
            voisine=voisine,
        )
        if distance >= ECART_MINIMAL:
            return propose
        # **Le moins mauvais est gardé pour la phrase du refus, pas pour être
        # proposé** : dire « le plus loin qu'on ait trouvé était à 60, il en
        # faudrait 84 » est un refus qu'on peut lire ; un refus nu ne se
        # discute pas.
        if meilleur is None or distance > meilleur.ecart:
            meilleur = propose
    manque = meilleur.ecart if meilleur else 0
    voisine = meilleur.voisine if meilleur else ""
    return Proposition(
        ecart=manque,
        voisine=voisine,
        raison=f"{AUCUN_CANDIDAT_SUR} (la plus éloignée n'est qu'à {manque}, "
        f"et il en faudrait {ECART_MINIMAL})",
    )


def nom_du_fond(couleur: str) -> str:
    """Le mot anglais de cette couleur-là, quand l'atelier la connaît.

    **Une lecture de la liste fermée, jamais une seconde vérité** : le nom se
    déduit de la couleur, il ne se range pas à côté d'elle. Une couleur que
    l'auteur a tapée lui-même n'a pas de nom, et le texte part alors avec le seul
    hexadécimal — ce qui est exact, et vaut mieux qu'un nom approché.
    """
    propre = fond_valide(couleur)
    return next((c.nom for c in CANDIDATS if c.couleur == propre), "")


def dit(couleur: str) -> str:
    """Comment le fond se nomme dans le texte qui part : l'hexadécimal, et le mot.

    `#FF00FF magenta` quand l'atelier connaît la couleur, `#7A3B12` seul quand
    l'auteur l'a tapée. Écrit ici parce que les deux phrases ci-dessous le disent
    de la même façon, et que deux écritures auraient fini par nommer le même fond
    de deux manières dans le même appel.
    """
    propre = fond_valide(couleur)
    if not propre:
        return ""
    nom = nom_du_fond(propre)
    return f"{propre} {nom}" if nom else propre


def interdiction(couleur: str) -> str:
    """Ce qui part dans le champ d'interdiction — **et rien n'a été écrit pour ça**.

    Le produit porte déjà `Demande.prompt_negatif`, et les deux adaptateurs le
    replient en fin de demande sous *« Do not include: »*. La phrase entre donc
    dans un mécanisme qui existait, ce qui est toute la raison pour laquelle ce
    critère-là ne coûte pas une ligne de plus que celle-ci.

    **Elle interdit la couleur dans le sujet, pas dans l'image.** L'inverse
    serait un contresens : le fond *est* cette couleur, et la lui interdire
    reviendrait à annuler la demande qu'on vient de faire. Les quatre endroits
    nommés — la tenue, la peau, les accessoires, les reflets et les ombres — sont
    ceux qui trahissent le plus souvent, parce qu'un modèle qui pose un sujet sur
    un fond franc en laisse volontiers un peu déborder.

    Vide sans fond : un appel qui ne demande pas de couleur de fond n'a rien à
    interdire, et *« do not include: »* suivi de rien serait une phrase qui ne dit
    rien au prix d'un appel.
    """
    nomme = dit(couleur)
    if not nomme:
        return ""
    # **Une parenthèse et pas un tiret.** Le texte est replié derrière *« Do not
    # include: »*, qui porte déjà les deux-points ; un second signe fort au
    # milieu de la phrase aurait coupé l'interdiction en deux là où elle n'en
    # fait qu'une.
    return (
        f"the background colour {nomme}, or any shade close to it, anywhere on "
        f"the subject itself (not on its outfit, its skin, its hair, its "
        f"accessories, its reflections or its shadows)"
    )


def replier(interdit: str, ecrit: str) -> str:
    """Ce qui part vraiment dans le champ d'interdiction, l'auteur d'abord.

    **Ce que l'auteur a écrit ne cède jamais devant ce que le produit ajoute**,
    et c'est la règle du dépôt appliquée au champ d'interdiction comme elle l'est
    déjà aux images jointes. Il passe donc en tête, et la phrase du fond le suit.

    Les deux se joignent par un point-virgule et non par une virgule : la phrase
    du fond en contient déjà trois, et une quatrième aurait fondu les deux
    interdictions en une seule liste illisible.
    """
    morceaux = [m.strip() for m in (ecrit, interdit) if m and m.strip()]
    return " ; ".join(morceaux)
