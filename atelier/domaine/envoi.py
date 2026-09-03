# -*- coding: utf-8 -*-
"""Ce qui part, ligne par ligne — et ce que l'écran de confirmation en renvoie.

**Le vocabulaire de E14, et rien d'autre.** Trois choses vivent ici : le nom des
groupes dans lesquels ce qui part se range, la clef qui désigne une ligne, et le
`Tri` — ce que l'écran renvoie quand on a éteint des lignes et corrigé des
textes.

**Le `Tri` ne s'enregistre nulle part, et c'est toute la règle de l'écran.** Une
correction faite avant de payer vaut *pour cet appel seulement* : elle voyage
avec la demande, elle habille le prompt, et elle disparaît ensuite. Ce qui reste
est la recette de l'image produite, qui porte le texte tel qu'il est parti — et
c'est une autre question. « Ce qui est oublié, c'est le réglage pour la suite ;
ce qui est gardé, c'est l'histoire de ce qui a été fait. »

**Un `Tri` ne porte que des écarts, jamais un état complet.** Il dit quelles
lignes ont été éteintes à la main, et quels textes ont été corrigés. Tout le
reste se recalcule : c'est ce qui fait qu'éteindre les trois lignes d'une
ambiance **rallume les textes du jeu d'eux-mêmes**, sans que personne les
rallume — le jeu redevient simplement la couche la plus haute qui reste.
Enregistrer l'état complet aurait figé les lignes du jeu dans l'état éteint où
l'ambiance les avait mises, et il aurait fallu un second geste pour les
retrouver.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping

from atelier.domaine.projet import CHAMPS_BIBLE, INTITULES

# ── Les groupes, dans l'ordre où le texte est assemblé ────────────────────────
#
# **L'ordre des groupes à l'écran est l'ordre de l'assemblage**, et c'est la
# règle que la maquette pose : on lit l'écran de haut en bas et le texte de
# gauche à droite, et il n'y a rien à faire correspondre dans sa tête.
#
# La maquette dessinait le sujet **avant** les textes du jeu, en montrant un
# texte assemblé qui commençait par le sujet. Le code fait l'inverse depuis T4 —
# la bible active se replie en tête (US-53) — et c'est le code qui a raison, pour
# la raison la plus simple : personne n'a mesuré ce que changerait l'autre ordre,
# et changer l'ordre d'un prompt change ce que le modèle rend. C'est la règle du
# dossier appliquée une fois de plus : *une maquette a supposé le code au lieu de
# le lire*.

JEU = "jeu"  # les sept textes de la bible, tels que cette chose-là les porte
AMBIANCE = "ambiance"  # ce que son lot de style remplace — trois cases au plus
SUJET = "sujet"  # ce qu'on dessine : le signalement, puis la consigne de la case
PLANCHE = "planche"  # les consignes de case, quand l'appel part plié
JOINTES = "jointes"  # ce que les images attachées veulent dire, en mots
CADRAGE = "cadrage"  # la caméra, redite en dernier — voir plus bas
IMAGES = "images"  # ce qui part en image, et ce que chacune coûte
OPTIONS = "options"  # ce que le modèle choisi sait faire en plus

# **Deux groupes ajoutés le 1ᵉʳ septembre 2026, et ils partent en queue.**
#
# `cadrage` est la caméra du jeu, redite en dernier et à l'impératif. Ce n'est
# pas une préférence de rédaction : `essais/essai_vue.py` a payé trente images
# pour comparer six façons de réparer le même prompt, et **une seule a marché**.
# Un sprite debout de face fait deux fois plus haut que large ; le même corps vu
# d'aplomb est presque rond. Le rapport passe de **1,55 à 1,13** quand la caméra
# est redite en queue, et il ne bouge pas quand on retire l'image de référence
# (1,46) ni quand on ajoute un prompt négatif (1,69).
#
# La raison tient en une phrase : **un modèle d'image pondère la fin.** La
# caméra était au sixième rang de sept intitulés, et les derniers mots du prompt
# étaient ceux de la pose — `idle stance, full body`, une phrase de vue de face
# écrite en dur pour les huit vues du produit. On demandait le dessus au milieu
# et la face à la fin ; c'est la fin qui gagnait.
#
# `jointes` dit **ce que les images attachées veulent dire**. Jusqu'ici elles
# partaient muettes : le prompt ne les mentionnait nulle part, sauf pour une
# planche. Le banc mesure 1,15 pour ce seul ajout — il travaille, mais moins que
# `cadrage`, et pour une autre raison : sa dernière phrase redit la caméra.
GROUPES = (JEU, AMBIANCE, SUJET, PLANCHE, JOINTES, CADRAGE, IMAGES, OPTIONS)


# ── Les trois parties du texte qui part (R7) ─────────────────────────────────
#
# **Un groupe dit d'où une ligne vient ; une partie dit à quoi elle sert.** Les
# six groupes ci-dessus sont restés ce qu'ils étaient — ils portent les clefs,
# les interrupteurs et les corrections, et rien de tout ça ne bouge. Ce qui
# s'ajoute au-dessus d'eux est un rangement en trois : *le contexte* — ce qui ne
# change pas d'une image à l'autre —, *les références* — ce que chaque image
# jointe est —, *la demande* — ce qu'on veut cette fois-ci.
#
# **Ce rangement a été mesuré avant d'être construit, et il n'a rien donné.**
# Cinq variantes tirées le 2 septembre 2026, à images égales : le témoin — le
# pavé d'alors — a fait deux bonnes planches sur quatre, les trois titres posés
# dessus zéro sur quatre, les références nommées zéro sur quatre. La tranche est
# donc reprise **pour la relisibilité seule**, décidée par l'auteur le
# 3 septembre 2026 en connaissance de ce chiffre, et elle ne promet aucun gain
# de taux. `docs/tranches/R7.md` porte la mesure et la décision.
#
# **La caméra reste la dernière phrase du texte, et c'est ce qui rendait le
# rangement possible.** Un banc payé — `essais/essai_vue.py`, trente images — a
# établi que le rapport hauteur/largeur du sujet passe de 1,55 à 1,13 quand la
# caméra ferme le texte. La caméra appartient à *la demande*, qui est la
# troisième partie ; le cadre et la caméra en sont les dernières lignes. Ranger
# ne l'a donc pas déplacée. **Ce qui se déplace est le bloc des références**,
# qui remonte de l'avant-dernier rang au deuxième : c'est le seul changement
# d'ordre de la tranche, et il est celui que le banc a tiré.
CONTEXTE = "contexte"
REFERENCES = "references"
DEMANDE = "demande"
PARTIES = (CONTEXTE, REFERENCES, DEMANDE)

# **Les titres partent en anglais, comme les intitulés de la bible** (T4). Le
# prompt part en anglais chez tous les modèles du catalogue, et « CONTEXTE »
# dégraderait ce que « CONTEXT » obtient. Ce sont les trois mots exacts du banc
# — `essais/socle_essais.py`, `TITRES` —, recopiés ici pour que le produit
# envoie ce qui a été mesuré et non une variante voisine.
TITRE = {CONTEXTE: "CONTEXT", REFERENCES: "REFERENCES", DEMANDE: "REQUEST"}

# Quelle partie porte quel groupe. **Une seule table, lue par le serveur et par
# l'écran** : deux tables auraient fini par ranger la caméra dans deux parties
# différentes selon qu'on lise le texte ou l'écran qui le montre.
DE_LA_PARTIE = {
    JEU: CONTEXTE,
    AMBIANCE: CONTEXTE,
    JOINTES: REFERENCES,
    SUJET: DEMANDE,
    PLANCHE: DEMANDE,
    CADRAGE: DEMANDE,
}

# Ce que l'écran écrit au-dessus de chaque partie. **En français, parce que
# personne ne le lit chez le fournisseur** — c'est l'exacte symétrie des
# intitulés de la bible, qui partent en anglais et se lisent en français.
NOM_DE_LA_PARTIE = {
    CONTEXTE: "le contexte",
    REFERENCES: "les références",
    DEMANDE: "la demande",
}

# Ce que chaque partie dit d'elle-même, sous son titre, sur l'écran de
# confirmation. **Une phrase, jamais deux** — le format du recueil.
PROPOS_DE_LA_PARTIE = {
    CONTEXTE: "ce que ton jeu est, et qui ne change pas d'une image à l'autre",
    REFERENCES: "ce que chaque image jointe est, dite dans l'ordre où elles partent",
    DEMANDE: "ce que tu veux cette fois-ci — et la caméra, qui ferme le texte",
}


def clef(groupe: str, nom: str) -> str:
    """Le nom d'une ligne, unique dans tout l'écran.

    Deux couches peuvent porter le même champ — le *monde* du jeu et le *monde*
    de l'ambiance —, et ce sont deux lignes distinctes avec deux interrupteurs
    distincts. Le groupe fait donc partie de la clef ; sans lui, éteindre l'une
    éteindrait l'autre.
    """
    return f"{groupe}.{nom}"


@dataclass(frozen=True, slots=True)
class Tri:
    """Ce que l'écran de confirmation renvoie — **et qui ne vaut que pour cet appel**.

    `eteints` : les clefs de lignes que l'auteur a éteintes à la main. Une ligne
    absente de cette liste n'est pas « allumée » pour autant — elle est
    *candidate*, et c'est la résolution par couches qui décide.

    `textes` : les corrections, par clef. Elles remplacent le texte de la ligne
    et rien d'autre : ni la bible du jeu, ni l'ambiance, ni la fiche de la chose
    ne bougent. Garder une correction est un **second geste**, écrit, qui passe
    par la fiche — jamais un effet de bord de celui-ci.

    **Absent n'est pas vide.** `None` — pas de `Tri` du tout — veut dire « rien
    n'a été trié », et c'est ce que reçoit un agent, qui n'a pas d'écran devant
    lui. Un `Tri` vide veut dire « l'auteur a regardé et n'a rien éteint ». Les
    deux donnent le même texte aujourd'hui ; les confondre nous priverait du seul
    endroit où l'on pourrait un jour distinguer les deux.

    ── `fond` : la couleur corrigée juste avant de payer (D3) ────────────────

    **Un quatrième écart, et il ne se range pas dans `textes`.** La couleur de
    fond n'est pas une ligne du texte : c'est un réglage du jeu qui *fabrique*
    une ligne — la phrase de calage — **et** la phrase d'interdiction qui part
    dans un autre champ de la demande. La corriger en tapant dans la ligne aurait
    changé l'une sans l'autre, et l'appel serait parti en demandant un fond
    magenta tout en interdisant le cyan.

    Sa valeur suit la règle du `Tri` : elle ne vaut que pour cet appel, elle ne
    remonte pas au projet, et **la chaîne vide est une valeur** — c'est *retire
    le fond pour cet appel-ci*, ce qui est un geste légitime quand on veut
    comparer avec ce que le jeu rendait avant. `None` est *n'y touche pas*.
    """

    eteints: frozenset[str] = frozenset()
    allumes: frozenset[str] = frozenset()
    textes: Mapping[str, str] = field(default_factory=dict)
    fond: str | None = None

    def etat(self, ligne: str, defaut: bool) -> bool:
        """Cette ligne est-elle candidate, sachant ce que la fiche en dit ?

        **Deux listes et pas une**, parce qu'il y a deux sens à contredire. Une
        ligne que la fiche allume s'éteint pour cet appel ; une ligne que la
        fiche éteint — un refus écrit — se rallume pour cet appel. Sans la
        seconde, « et si je remettais l'éclairage, juste pour cet essai ? »
        obligerait à aller défaire le refus durable, c'est-à-dire à faire
        exactement ce que cet écran-là existe pour éviter.
        """
        if ligne in self.allumes:
            return True
        if ligne in self.eteints:
            return False
        return defaut

    def texte(self, ligne: str, defaut: str) -> str:
        """Le texte corrigé, ou celui d'origine. **Une correction vide compte** :
        effacer un texte pour cet appel est un geste légitime, distinct
        d'éteindre la ligne — l'une retire la phrase, l'autre retire l'intitulé
        avec elle."""
        corrige = self.textes.get(ligne)
        return defaut if corrige is None else corrige

    def fond_de(self, defaut: str) -> str:
        """Le fond de cet appel-ci, sachant celui du jeu.

        **La chaîne vide corrige, elle ne se confond pas avec l'absence** :
        `None` laisse le fond du jeu, `""` le retire pour cet appel. C'est la
        même distinction que `texte`, où effacer un texte est un geste distinct
        d'éteindre sa ligne.
        """
        return defaut if self.fond is None else self.fond

    @staticmethod
    def depuis_json(d: Mapping[str, Any] | None) -> "Tri | None":
        if not d:
            return None
        # **Absent et vide ne se confondent pas**, et c'est la seule clé de ce
        # message où la différence compte : `"fond": ""` retire le fond pour cet
        # appel, ne pas envoyer la clé laisse celui du jeu.
        fond = d.get("fond")
        return Tri(
            eteints=frozenset(str(c) for c in (d.get("eteints") or ())),
            allumes=frozenset(str(c) for c in (d.get("allumes") or ())),
            textes={
                str(k): str(v)
                for k, v in (d.get("textes") or {}).items()
                if isinstance(k, str)
            },
            fond=None if fond is None else str(fond),
        )

    def en_json(self) -> dict[str, Any]:
        return {
            "eteints": sorted(self.eteints),
            "allumes": sorted(self.allumes),
            "textes": dict(self.textes),
            "fond": self.fond,
        }


# ── Les couches de texte d'une chose du jeu, non résolues ────────────────────


@dataclass(frozen=True, slots=True)
class Couches:
    """Les trois épaisseurs de texte qui habillent une chose, **sans arbitrage**.

    `bible` — ce que le jeu dit, dans l'ordre des sept champs. `ecrits` — ce que
    cette chose-là a écrit pour elle seule. `eteints` — les champs qu'elle
    refuse. `ambiance` — ce que son lot de style remplace, trois champs au plus.

    Elles sont rendues **brutes** parce que deux écrans les résolvent : la fiche
    d'une chose du jeu, qui montre l'état durable, et l'écran de confirmation,
    qui montre ce que *cet appel* fera après qu'on a touché aux interrupteurs.
    Deux résolutions écrites à deux endroits auraient fini par montrer deux
    textes différents pour le même appel, et celle qui compte est celle qui part.
    """

    bible: tuple[tuple[str, str], ...] = ()
    ecrits: Mapping[str, str] = field(default_factory=dict)
    eteints: frozenset[str] = frozenset()
    ambiance: Mapping[str, str] = field(default_factory=dict)
    ambiance_nom: str = ""
    # **La chose que cet appel habille**, quand il y en a une. Elle ne change
    # aucun texte : elle dit seulement si « garder cette correction » a une case
    # où aller. Sans chose visée — un import, un agent, une image qu'on fabrique
    # sans rien viser —, il n'y en a pas, et le geste ne se propose pas plutôt
    # que de ne rien faire une fois cliqué.
    chose: str = ""
    # Ce que le réglage durable de la chose prend à son ambiance en fait de
    # texte. Faux, et les lignes de l'ambiance sont là, éteintes : on voit ce
    # qu'on ne prend pas, et on peut le prendre pour cet appel seulement.
    prend_textes: bool = True


# Ce qu'une origine dit à l'écran. **Un mot, pas une phrase** : la ligne dit
# déjà tout le reste, et l'origine ne sert qu'à savoir où aller corriger
# durablement.
DU_JEU = "du jeu"
DE_SA_FICHE = "de sa fiche"
DE_SON_AMBIANCE = "son ambiance"
DE_LA_POSE = "de la pose"
DE_LA_PLANCHE = "de la planche"
# **Deux origines qui ne renvoient à aucun champ de texte**, et c'est voulu : la
# caméra vient du choix de vue du jeu, et la phrase des images jointes vient du
# rôle des images cochées. Aucune des deux ne se corrige en tapant dedans — on
# change la vue, ou on décoche une image.
DE_LA_VUE = "de la vue du jeu"
DU_PRODUIT = "de l'atelier"
DES_IMAGES = "des images jointes"
ECRIT_ICI = "écrit ici"
REPRIS = "ton texte"


def resoudre(couches: Couches, tri: "Tri | None" = None) -> list[dict[str, Any]]:
    """Les lignes de texte d'une chose du jeu, **et laquelle part**.

    Trois couches, et l'ordre est celui de la décision (E12) : ce que la chose
    écrit gagne sur ce que l'ambiance donne, qui gagne sur ce que le jeu dit.
    Ce qui change ici, c'est qu'on n'écrase plus les perdantes : **elles restent
    à l'écran, éteintes**, en disant qui les remplace. C'est ce qui rend le geste
    de la maquette possible — éteindre les trois lignes d'une ambiance rallume
    les textes du jeu *d'eux-mêmes*, puisqu'ils redeviennent la couche la plus
    haute qui reste candidate.

    Une ligne éteinte sur la fiche est rendue elle aussi, éteinte : un refus
    écrit se voit, et il se lève **pour cet appel** sans qu'on aille défaire le
    réglage durable.

    Rend les lignes dans l'ordre de l'assemblage : les sept champs du jeu, puis
    les trois de l'ambiance. `allumee` dit ce qui part vraiment ; `remplacee_par`
    nomme la ligne qui a gagné, quand c'en est la raison.
    """
    tri = tri or Tri()
    lignes: list[dict[str, Any]] = []
    # rang : plus grand gagne. La fiche d'abord, l'ambiance ensuite, le jeu en
    # dernier — c'est l'ordre de E12, et il n'en existe qu'un.
    par_champ: dict[str, list[tuple[int, dict[str, Any]]]] = {}

    for nom, du_jeu in couches.bible:
        ecrit = (couches.ecrits.get(nom) or "").strip()
        texte = ecrit or du_jeu
        if not texte:
            continue
        ligne = {
            "clef": clef(JEU, nom),
            "groupe": JEU,
            "nom": nom,
            "texte": texte,
            # Ce qui précède le texte dans le prompt. **En anglais, et décidé
            # une fois** (T4) : le prompt part en anglais chez tous les modèles
            # du catalogue, et « Éclairage : » dégraderait ce que « Lighting: »
            # obtient. L'écran le montre aussi — c'est ce qui part.
            "intitule": INTITULES.get(nom, nom),
            "origine": DE_SA_FICHE if ecrit else DU_JEU,
            # Ce que ce texte-là écarte, montré barré en dessous : on doit
            # pouvoir lire ce à quoi on a renoncé sans aller le chercher.
            "remplace": du_jeu if ecrit and du_jeu != texte else "",
            "eteignable": True,
            # « Garder ce texte » l'écrit sur la fiche de la chose visée : c'est
            # la case où il vivra durablement. Sans chose visée, il n'y en a pas
            # — et un geste proposé qui ne ferait rien vaut moins que pas de
            # geste du tout.
            "gardable": bool(couches.chose),
        }
        par_champ.setdefault(nom, []).append((2 if ecrit else 0, ligne))
        lignes.append(ligne)

    for nom, texte in couches.ambiance.items():
        propre = (texte or "").strip()
        if not propre:
            continue
        ligne = {
            "clef": clef(AMBIANCE, nom),
            "groupe": AMBIANCE,
            "nom": nom,
            "texte": propre,
            "intitule": INTITULES.get(nom, nom),
            "origine": DE_SON_AMBIANCE,
            "remplace": "",
            "eteignable": True,
            # Elle s'écrit dans l'ambiance, qui sert plusieurs choses du jeu :
            # la garder « sur cette chose-là » n'aurait pas de case où aller.
            "gardable": False,
            "ambiance": couches.ambiance_nom,
        }
        par_champ.setdefault(nom, []).append((1, ligne))
        lignes.append(ligne)

    for nom, candidates in par_champ.items():
        gagnante: dict[str, Any] | None = None
        for _, ligne in sorted(candidates, key=lambda c: -c[0]):
            # **Éteint sur la fiche passe avant tout, et vaut pour les deux
            # couches** (E12) : un refus écrit ne se discute pas avec ce qu'il
            # refuse, et une ambiance qui rallumerait un champ que la chose
            # refuse rendrait le refus indéfendable. Il se lève pour cet appel
            # seulement, par le tri, et jamais autrement.
            defaut = nom not in couches.eteints and (
                True if ligne["groupe"] == JEU else couches.prend_textes
            )
            if gagnante is None and tri.etat(ligne["clef"], defaut):
                gagnante = ligne
                ligne["allumee"] = True
                ligne["remplacee_par"] = ""
            else:
                ligne["allumee"] = False
                ligne["remplacee_par"] = gagnante["clef"] if gagnante else ""

    for ligne in lignes:
        ligne["texte"] = tri.texte(ligne["clef"], ligne["texte"])
        ligne["corrigee"] = ligne["clef"] in tri.textes
    return lignes


# ── Des lignes au prompt ─────────────────────────────────────────────────────


def _allumees(lignes: Iterable[Mapping[str, Any]], groupe: str) -> list[Mapping[str, Any]]:
    return [
        l
        for l in lignes
        if l["groupe"] == groupe and l.get("allumee") and str(l["texte"]).strip()
    ]


def _repris(lignes: Iterable[Mapping[str, Any]]) -> bool:
    """L'auteur a-t-il pris la main sur l'ensemble du texte ?

    Un texte repris part **mot pour mot** (US-159) : il ne se range pas, et il
    ne reçoit pas de titre. Poser `CONTEXT` au-dessus de ce que quelqu'un a
    écrit lui-même serait ajouter un mot à un texte dont toute la promesse est
    qu'aucun n'y sera ajouté.
    """
    return any(l.get("origine") == REPRIS for l in lignes)


def _morceaux(lues: list[Mapping[str, Any]], partie: str) -> list[str]:
    """Les paragraphes d'une partie, dans l'ordre où ils s'assemblent.

    **Les textes de style gardent l'ordre de la bible**, quelle que soit la
    couche qui a gagné : un monde venu d'une ambiance se lit à la place du
    monde, pas à la fin. Les mettre dans l'ordre de résolution aurait fait
    voyager un champ dans le prompt le jour où on désigne une ambiance — et
    changer l'ordre d'un prompt change ce que le modèle rend.

    **Le sujet et sa consigne de case se joignent par une virgule**, comme la
    phrase que `ServiceProduction.sujet` écrivait d'un bloc jusqu'à E14 : le
    texte assemblé est le même, mot pour mot, et seul son découpage à l'écran a
    changé — **tant que le signalement tient sur une ligne**. Voir `_sujet`.

    **Le cadre et la caméra font un seul paragraphe, deux lignes qui se
    suivent** — c'est la forme que le banc a tirée (`essais/socle_essais.py`,
    `ranger`). Deux paragraphes séparés diraient deux choses ; ils n'en disent
    qu'une, et elle ferme le texte.
    """
    if partie == CONTEXTE:
        rang = {nom: i for i, nom in enumerate(CHAMPS_BIBLE)}
        style = sorted(
            _allumees(lues, JEU) + _allumees(lues, AMBIANCE),
            key=lambda l: rang.get(str(l["nom"]), len(rang)),
        )
        if not style:
            return []
        return [
            "\n".join(
                f"{l['intitule']}: {str(l['texte']).strip()}"
                if l.get("intitule")
                else str(l["texte"]).strip()
                for l in style
            )
        ]
    if partie == REFERENCES:
        return [str(l["texte"]).strip() for l in _allumees(lues, JOINTES)]
    morceaux: list[str] = []
    sujet = _sujet([str(l["texte"]).strip() for l in _allumees(lues, SUJET)])
    if sujet:
        morceaux.append(sujet)
    morceaux.extend(str(l["texte"]) for l in _allumees(lues, PLANCHE))
    cadrage = [str(l["texte"]).strip() for l in _allumees(lues, CADRAGE)]
    if cadrage:
        morceaux.append("\n".join(cadrage))
    return morceaux


def parties(lignes: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Les trois parties du texte, chacune avec son titre et son contenu (R7).

    **Une partie vide est rendue quand même, avec un texte vide** — et elle ne
    part pas : `joindre` la saute, titre compris. Un `REFERENCES` posé au-dessus
    de rien annoncerait au modèle des images qui ne partent pas, ce qui est très
    exactement le défaut que la tranche répare.

    Elle est rendue quand même parce que **l'écran range des lignes, pas des
    paragraphes** : une ligne éteinte reste à sa place, barrée, et elle ne
    produit aucun texte. Si la partie qui la porte disparaissait de cette
    liste-là, éteindre la dernière ligne d'une partie ferait disparaître la
    ligne avec elle — et on ne pourrait plus la rallumer.

    Rend la partie **telle qu'elle part**, texte compris : c'est cette liste que
    l'écran de confirmation affiche, et `joindre` n'est que sa jonction. Un
    écran qui recomposerait ses parties de son côté serait une seconde vérité
    sur ce qui part.
    """
    lues = list(lignes)
    if _repris(lues):
        # Un texte repris est une seule partie sans titre : *la demande*, parce
        # que c'est bien ce que l'auteur demande, et rien d'autre.
        texte = "\n\n".join(
            str(l["texte"]).strip() for l in _allumees(lues, SUJET) if str(l["texte"]).strip()
        )
        if not texte:
            return []
        return [
            {
                "clef": DEMANDE,
                "titre": "",
                "nom": "ton texte",
                "propos": "repris à la main — il part mot pour mot, sans titre",
                "texte": texte,
                "repris": True,
            }
        ]
    return [
        {
            "clef": partie,
            "titre": TITRE[partie],
            "nom": NOM_DE_LA_PARTIE[partie],
            "propos": PROPOS_DE_LA_PARTIE[partie],
            "texte": "\n\n".join(
                m for m in _morceaux(lues, partie) if m.strip()
            ),
            "repris": False,
        }
        for partie in PARTIES
    ]


def joindre(lignes: Iterable[Mapping[str, Any]]) -> str:
    """Le prompt, tel qu'il partira — **et il n'y a que celui-ci**.

    Depuis R7 il se lit en trois parties nommées, chacune annoncée par son titre
    en majuscules suivi d'une ligne vide : `CONTEXT` porte les textes de style,
    `REFERENCES` ce que chaque image jointe est, `REQUEST` le sujet, les
    consignes de planche, le cadre et la caméra.

    **La caméra ferme toujours le texte** (1ᵉʳ septembre 2026, trente images
    payées) : elle est la dernière ligne de la dernière partie, et le rangement
    ne l'a pas déplacée. Ce qui a changé de place est le bloc des références,
    qui remonte au deuxième rang — le seul déplacement de la tranche.

    **On range, on ne réécrit pas.** Hors les trois titres et les lignes de
    nommage des images, pas un mot n'entre ni ne sort ; `tests/test_r7.py` le
    vérifie en comptant les mots, avec l'outil du banc.
    """
    return "\n\n".join(
        f"{p['titre']}\n\n{p['texte']}" if p["titre"] else str(p["texte"])
        for p in parties(lignes)
        if str(p["texte"]).strip()
    )


def _sujet(morceaux: list[str]) -> str:
    """Le signalement et la consigne de sa case, joints — **et la virgule a une
    condition** (1ᵉʳ septembre 2026).

    La virgule vient d'E14 et elle est juste tant que le signalement tient sur
    une ligne : `a stocky dwarf miner` + `walking posture` fait bien
    `a stocky dwarf miner, walking posture`.

    Elle est fausse dès que le signalement est une **liste**, et c'est ce que le
    relevé du projet « Le Marais du Vieux Moulin » a montré. Le pèlerin est décrit
    en cinq puces ; la virgule a collé la pose à la dernière, et le prompt payé
    s'est terminé par `- handheld torch, idle stance, full body`. Ce n'était plus
    une pose : c'était une torche tenue à pleine hauteur.

    On garde donc la virgule pour ce qu'elle sait faire — une ligne plus une
    ligne — et on passe à la ligne dès qu'un morceau en contient déjà une. Les
    prompts d'avant ne bougent pas d'un caractère ; ceux qui étaient cassés
    cessent de l'être.
    """
    if not morceaux:
        return ""
    if any("\n" in m for m in morceaux):
        return "\n".join(morceaux)
    return ", ".join(morceaux)
