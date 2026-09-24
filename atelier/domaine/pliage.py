# -*- coding: utf-8 -*-
"""Le pliage — N images demandées en un seul appel, et ce qui en revient.

**Ce n'est pas un dispositif du lot de poses** (`docs/archi-versions.md` § Le
pliage) : c'est la manière dont l'atelier habille ou transforme N images d'un
seul appel, sur une grille carrée dont il connaît la géométrie case par case. La
V2 en a deux usages — créer N corps (C2) et habiller N corps (C3) —, et ce
module ne connaît ni l'un ni l'autre. Il parle de **cases** et de textes.

Deux choses y rattachent une case à ce que le produit en fera, et ce sont deux
désignations, jamais deux règles : `CasePliee.pose`, la même que `Generation.pose`
porte depuis C1 — un corps appartient à une pose, un calque aussi —, et
`CasePliee.base`, l'image qui était dans la case au départ. La seconde est vide
quand la case est partie vide (C2) et remplie quand l'atelier a composé la
planche lui-même (C3) ; c'est elle qui rend l'avant relisable à la relance,
**sans qu'aucune planche soit enregistrée**.

**Le pliage est une ruse d'appel, jamais un format de livraison.** Rien ici ne
décrit une feuille assemblée qu'on garderait : la planche est le brut de sa
génération, et ce qui entre en bibliothèque, ce sont les images séparées.
*G16 a fait entrer la planche en bibliothèque ; P1 (V3.5) la fait redécouper —
d'où `Depliage`, plus bas, et la géométrie qui s'écrit au lieu de se déduire.*
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

__all__ = [
    "AUTO",
    "MAIN",
    "SEUIL_PLEINE",
    "CasePliee",
    "Depliage",
    "Geometrie",
    "MesuresLot",
    "Pliage",
    "geometrie",
    "identifiant_de_depliage",
]

# Les deux origines d'un dépliage (P1). **Le premier est toujours automatique**
# — tranché par l'auteur le 2 septembre 2026 : une planche qui revient bien ne
# demande aucun geste —, les suivants sont des gestes qu'on demande.
AUTO = "auto"
MAIN = "main"


# **Au-dessus, ce n'est plus une silhouette, c'est un rectangle** (R6, US-368).
#
# Le piège qu'il attrape : quand un modèle redessine les traits du quadrillage
# au lieu de les laisser au gabarit, chaque case bordée devient une tache opaque
# à part entière. Le compte tombe alors juste, l'atelier accepte, et il fait
# entrer en bibliothèque des carrés pleins que personne n'a demandés. C'est pire
# qu'un refus : c'est du vide payé, gardé en silence.
#
# **Neuf dixièmes, et le chiffre est mesuré, pas choisi.** Le 3 septembre 2026,
# la chaîne du produit — détourage par le bord, puis `zones_opaques` — a été
# passée sur les 135 planches des deux bancs du dépôt. Les deux populations ne
# se touchent pas : une planche saine remplit sa boîte de 0,34 à 0,77 (médiane
# 0,63), une planche au quadrillage redessiné de 0,99 à 1,00. Il n'y a rien
# entre les deux, et le seuil est posé au milieu du vide.
#
# ⚠️ **La mesure se prend dans la boîte, jamais dans la vignette découpée.** La
# vignette est taillée dans les octets d'origine, fond compris : elle est opaque
# à 1,00 sur *toutes* les planches, saines comprises, et ne sépare donc rien.
SEUIL_PLEINE = 0.90


@dataclass(frozen=True, slots=True)
class Geometrie:
    """Combien de colonnes et de lignes pour tenir N cases.

    **Proposée par la formule, puis écrite sur le pliage** (P1, V3.5). Elle a
    été déduite du seul nombre de cases de C2 au 18 septembre 2026, et c'était
    tenable tant que la formule ne bougeait pas. Le banc des planches a mesuré
    qu'un 4 × 2 bat le 3 × 3 à case vide : le jour où la formule change, une
    planche ancienne relue par déduction se redécouperait sur une grille sur
    laquelle elle n'a pas été dessinée. La grille est donc un **fait de
    l'appel**, pris au départ comme le prompt, et `geometrie()` n'est plus que
    la proposition faite aux planches qui ne sont pas encore parties.
    """

    cases: int
    colonnes: int
    lignes: int


def geometrie(cases: int) -> Geometrie:
    """La grille la plus carrée qui tienne `cases` sujets.

    **Carrée, et pas en une rangée.** Un modèle rend une image dans les
    proportions qu'on lui impose — 1:1 par défaut (`docs/PIEGES.md`) — et neuf
    sujets alignés dans un carré tiendraient chacun dans un dixième de la
    largeur : ce qui revient serait illisible avant même d'être découpé.

    Le reste tombe dans la dernière rangée, qui est donc incomplète, et les
    cases en trop **n'existent pas** — le gabarit ne les dessine pas, le prompt
    ne les compte pas. Une case vide dessinée dans une planche de création
    serait une case que le modèle remplirait, et le compte tomberait faux pour
    une raison que personne n'aurait demandée.
    """
    nombre = max(1, int(cases))
    colonnes = math.ceil(math.sqrt(nombre))
    return Geometrie(nombre, colonnes, math.ceil(nombre / colonnes))


@dataclass(slots=True)
class CasePliee:
    """Une case de la planche : ce qui s'écrit dans le prompt pour elle, et où
    ira l'image qui en reviendra.

    Le texte est du **produit**, pas du domaine du pliage : « walking, mid-stride »
    ou « le même corps avec le casque en plus ». Ce module ne le lit jamais, il le
    range dans l'ordre.
    """

    texte: str
    pose: str | None = None

    # **Le second axe de la case, écrit avant le départ** (E13). Une case est une
    # pose *dans une direction* depuis E10, et jusqu'ici seule la première
    # partait : l'image revenue tombait dans la ligne de sa pose, et l'angle
    # s'écrivait à la main après coup. Le relevé du 30 août 2026 mesure ce que ça
    # coûte — **neuf appels de personnage sur treize ne disent pas leur pose**,
    # et rien ne reliait ce qui avait été demandé à ce qui avait été rangé.
    #
    # Vide reste l'état ordinaire : un jeu qui n'a pas déclaré de directions n'en
    # a aucune à écrire, et la planche d'équipement range par pose.
    direction: str | None = None

    # L'asset qui était dans cette case quand la planche est partie. **Un
    # identifiant, jamais des octets** — même règle qu'une réinjection : la
    # planche se recompose du geste à partir des images qu'il désigne, à la
    # soumission comme à la relance, donc les deux envoient exactement la même
    # chose et rien de neuf n'est écrit sur le disque.
    base: str | None = None

    # ── La chose du jeu que cette case porte (P2, V3.5) ──────────────────────
    #
    # **C'est la réponse qui lève l'invariant d'E13** — *une planche ne porte
    # qu'une seule chose du jeu*. Il avait une raison : une planche qui mêle les
    # sujets rend le rangement ambigu. La réponse est que **la demande dit
    # d'avance ce que chaque case contient** : la n-ième case porte ce sujet-là,
    # et le découpage range le morceau de la n-ième case chez lui. Vide, la case
    # appartient au sujet de la génération, comme depuis C2 — l'ancienne règle,
    # inchangée.
    #
    # `signalement` est ce que la liste a écrit pour ce sujet, avant la consigne
    # de la pose : c'est le texte que « refaire cette case seule » renvoie, mot
    # pour mot, dans une génération simple. Recomposé depuis la fiche, il aurait
    # pu changer entre la planche et la reprise.
    sujet: str | None = None
    signalement: str | None = None

    def en_json(self) -> dict[str, Any]:
        contenu: dict[str, Any] = {
            "texte": self.texte,
            "pose": self.pose,
            "direction": self.direction,
            "base": self.base,
        }
        # Écrits seulement quand la case en porte : une planche d'un seul sujet
        # garde exactement la forme de fichier qu'elle avait avant P2.
        if self.sujet:
            contenu["sujet"] = self.sujet
            contenu["signalement"] = self.signalement or ""
        return contenu

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "CasePliee":
        return CasePliee(
            texte=d.get("texte", ""),
            pose=d.get("pose") or None,
            direction=d.get("direction") or None,
            base=d.get("base") or None,
            sujet=d.get("sujet") or None,
            signalement=d.get("signalement") or None,
        )


@dataclass(slots=True)
class MesuresLot:
    """Ce qu'on a mesuré sur une case au moment où le lot s'est déplié.

    **Elles informent, elles ne refusent jamais.** Le compte d'images est le seul
    refus automatique du produit (`docs/archive/plan-versions-tenues.md`, C2) ;
    celles-ci s'affichent et laissent l'auteur décider. Deux planches sur
    vingt-quatre, à l'essai du 28 août, avaient un compte juste et répétaient une
    pose : le contrat était tenu, la planche sans valeur, et c'est l'auteur qui
    le voit.

    **Une copie, prise à la naissance**, exactement comme `cout_usd` et `modele`
    sur l'asset, et pour la raison exacte : la ligne de la matrice les porte, et
    aller chercher la génération pour trois nombres serait un aller-retour par
    case affichée. La génération garde le pliage entier ; celle-ci ne garde que
    ce que la case a besoin de dire d'elle-même.

    `ressemblance` est la plus forte des recouvrements de silhouette entre cette
    case et une autre du lot, et `jumeau` dit laquelle. **Le chiffre et son
    jumeau, jamais un seuil** : un seuil serait un nombre inventé sur un corpus
    de vingt-quatre planches, et le produit n'écrit pas de nombre qui ne mesure
    rien.

    `remplissage` est l'exception, et elle en est une parce qu'elle a été mesurée
    (R6) : la part de la boîte du sujet qui reste opaque une fois le fond retiré.
    Elle porte un seuil — `SEUIL_PLEINE` — parce que les deux populations sont
    séparées par du vide sur les 135 planches du dépôt, et parce que ce qu'elle
    attrape ne se voit pas autrement : un carré plein a exactement l'air d'un
    sujet tant qu'on ne regarde que le compte.
    """

    case: int = 0
    cases: int = 0
    grille_px: int = 0
    ressemblance: float = 0.0
    jumeau: int = -1
    derive: float = 1.0

    # La part de la boîte qui reste opaque, entre 0 et 1 (R6, US-368).
    remplissage: float = 0.0

    # **Où ce sujet a été pris dans sa planche** — `x0, y0, x1, y1`, en pixels de
    # la planche, bornes comprises. Un fait sur la découpe, écrit à la naissance
    # comme le reste : c'est lui qui permet à l'écran de montrer les neuf sujets
    # trouvés **avant** qu'aucun n'entre en bibliothèque, sans redécouper la
    # planche de son côté.
    boite: tuple[int, int, int, int] = (0, 0, 0, 0)

    @property
    def pleine(self) -> bool:
        """Ce « sujet » remplit presque toute sa boîte — c'est une case, pas un
        personnage (R6, US-368)."""
        return self.remplissage >= SEUIL_PLEINE

    def en_json(self) -> dict[str, Any]:
        return {
            "case": self.case,
            "cases": self.cases,
            "grille_px": self.grille_px,
            "ressemblance": self.ressemblance,
            "jumeau": self.jumeau,
            "derive": self.derive,
            "remplissage": self.remplissage,
            "boite": list(self.boite),
            # déduit — présent pour l'interface, jamais relu
            "pleine": self.pleine,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "MesuresLot | None":
        if not d:
            return None
        boite = tuple(int(v) for v in (d.get("boite") or ())[:4])
        return MesuresLot(
            case=int(d.get("case", 0)),
            cases=int(d.get("cases", 0)),
            grille_px=int(d.get("grille_px", 0)),
            ressemblance=float(d.get("ressemblance", 0.0)),
            jumeau=int(d.get("jumeau", -1)),
            derive=float(d.get("derive", 1.0)),
            remplissage=float(d.get("remplissage", 0.0)),
            boite=boite if len(boite) == 4 else (0, 0, 0, 0),  # type: ignore[arg-type]
        )


def identifiant_de_depliage(planche: str, numero: int) -> str:
    """« `<planche>-d2` » — la planche, et lequel de ses dépliages.

    **Déduit, jamais tiré au sort**, pour la raison de `identifiant_de` : le
    dépliage automatique d'une planche reprise au démarrage doit retomber sur
    le même nom, sinon ses images désigneraient un dépliage que le pliage ne
    connaît pas. Le `d` empêche de le lire comme un identifiant d'asset
    (`<génération>-<rang>`) : ce n'en est pas un, et aucune image n'y répond.
    """
    return f"{planche}-d{int(numero)}"


@dataclass(slots=True)
class Depliage:
    """Un découpage d'une planche : où l'on a coupé, et quels rangs ça a pris.

    **Il vit sur le pliage, dans `generation.json`**, parce que les images qu'il
    fait naître vivent dans le dossier de cette génération et que c'est ce
    fichier-là que tout ce qui attribue un rang relit déjà — un fichier à part
    serait une seconde vérité sur les rangs, à tenir d'accord avec la première.
    La planche, ses mesures d'arrivée et le choix de l'auteur y sont déjà.

    **La règle des rangs, dont hérite tout dépliage à venir (P1b) :** un
    dépliage prend ses rangs **d'un seul tenant, au-dessus de tout rang que la
    génération a jamais connu** — ses emplacements, les assets de son dossier,
    et les rangs déjà réservés par ses dépliages, supprimés compris —, et il les
    garde à vie : **un rang ne se réattribue jamais, un numéro non plus**. Deux
    dépliages d'une même planche n'ont donc aucun rang en commun, et supprimer
    les images de l'un ne libère rien que l'autre pourrait écraser.
    L'appartenance d'une image à un dépliage se lit **sur l'image**
    (`Asset.depliage`), jamais sur son rang : un miroir ou une superposition
    tombe aussi au-dessus de cent, dans le même dossier.

    `coupes` et `rangs` sont alignés, dans l'ordre de lecture : la n-ième coupe a
    fait naître l'image du n-ième rang. Les coupes sont en pixels du brut de la
    planche, **avant** la marge que `decouper` ajoute — la même convention que
    les rectangles du découpeur de T5, qui les repropose tels quels.
    """

    numero: int
    planche: str
    coupes: tuple[tuple[int, int, int, int], ...] = ()
    rangs: tuple[int, ...] = ()
    cree_le: float = 0.0
    origine: str = AUTO

    # **Quand l'auteur a supprimé ce dépliage** (P1b) — ses images, par le geste
    # « supprimer ce découpage ». Le dépliage, lui, **reste écrit** : ses rangs
    # restent réservés, son numéro n'est pas redonné. La date sert à une seule
    # chose, et elle est vitale : une fois ses images purgées, le disque ne
    # distingue plus « déplié puis vidé par l'auteur » de « réservé puis coupé
    # par une fermeture », et la reprise au démarrage redéplierait — les images
    # que l'auteur a jetées reviendraient aux mêmes rangs. Écrite seulement
    # quand elle existe, pour garder la forme de fichier de P1a.
    supprime_le: float | None = None

    # **La case de la planche que chaque coupe remplit** (P1b), alignée aux
    # coupes ; `None` pour une coupe ajoutée qui n'en remplit aucune. Vide pour
    # le dépliage automatique, où la n-ième coupe remplit la n-ième case par
    # construction — l'écrire serait recopier l'ordre. Un dépliage refait à la
    # main, lui, a pu en retirer ou en ajouter : sans cette liste, le suivant
    # repartirait de ses coupes sans savoir laquelle va dans quelle case.
    cases: tuple[int | None, ...] = ()

    # **Les cases de la planche que ce dépliage n'a pas rangées, et pourquoi**
    # (P2) — indice de case → raison en clair. Seule une planche à plusieurs
    # sujets en porte : une case vide, une case à plusieurs morceaux, une case
    # qu'aucune coupe ne remplit, ou une image que l'auteur a désignée « pas le
    # bon sujet ». **Signaler plutôt que ranger de travers** : sans ça, sept
    # morceaux pour huit cases glisseraient d'un cran, et chaque sujet recevrait
    # l'image de son voisin sans que rien ne le dise.
    a_verifier: dict[int, str] = field(default_factory=dict)

    def case_de(self, index: int) -> int | None:
        """La case que la coupe n° `index` remplit — écrite, ou par position."""
        if self.cases:
            return self.cases[index] if index < len(self.cases) else None
        return index

    @property
    def identifiant(self) -> str:
        return identifiant_de_depliage(self.planche, self.numero)

    def en_json(self) -> dict[str, Any]:
        contenu: dict[str, Any] = {
            "numero": self.numero,
            "planche": self.planche,
            "coupes": [list(c) for c in self.coupes],
            "rangs": list(self.rangs),
            "cree_le": self.cree_le,
            "origine": self.origine,
            # déduit — présent pour l'interface, jamais relu
            "identifiant": self.identifiant,
        }
        if self.supprime_le is not None:
            contenu["supprime_le"] = self.supprime_le
        if self.cases:
            contenu["cases"] = list(self.cases)
        if self.a_verifier:
            contenu["a_verifier"] = [
                {"case": case, "raison": raison}
                for case, raison in sorted(self.a_verifier.items())
            ]
        return contenu

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "Depliage | None":
        """Rien plutôt qu'un dépliage sans planche — même règle que `Pliage`."""
        if not d or not d.get("planche"):
            return None
        coupes = tuple(
            tuple(int(v) for v in c[:4])
            for c in (d.get("coupes") or ())
            if len(c) >= 4
        )
        return Depliage(
            numero=int(d.get("numero", 1) or 1),
            planche=str(d["planche"]),
            coupes=coupes,  # type: ignore[arg-type]
            rangs=tuple(int(r) for r in (d.get("rangs") or ())),
            cree_le=float(d.get("cree_le", 0.0) or 0.0),
            origine=MAIN if d.get("origine") == MAIN else AUTO,
            supprime_le=(
                float(d["supprime_le"]) if d.get("supprime_le") is not None else None
            ),
            cases=tuple(
                int(c) if c is not None else None for c in (d.get("cases") or ())
            ),
            a_verifier={
                int(v["case"]): str(v.get("raison") or "")
                for v in (d.get("a_verifier") or ())
                if isinstance(v, dict) and v.get("case") is not None
            },
        )


@dataclass(slots=True)
class Pliage:
    """Ce qu'un appel plié a demandé, et ce que son dépliage a décidé.

    Porté par la génération, à côté de `personnage` et `pose`, et **pour la même
    raison** : ce sont des faits sur l'appel, pas du texte qui part chez le
    fournisseur. `demande` porte ce qui s'écrit dans le prompt — consignes de
    grille comprises, repliées à la soumission comme la bible de T4.

    `refus` garde la raison d'un compte faux. Il reste écrit après une relance :
    l'emplacement, lui, repart à zéro, mais le journal doit pouvoir dire ce qui
    s'était passé la fois d'avant.

    **Et depuis R6, il ne garde plus qu'un compte *insuffisant*.** Une planche
    qui rend plus de sujets que demandé n'est plus jetée : elle attend un regard.
    Le relevé qui a fait changer la règle est net — quatre planches sur treize du
    banc d'animation refusées pour un sujet de trop, soit trente-et-un pour cent
    des appels perdus sur un geste dont c'est le régime normal. Un sujet qui
    manque reste un refus, parce qu'il n'y a rien à en faire : il manque une
    étape à l'animation, et aucun choix ne la fabriquera.

    **`geometrie_connue` distingue les deux usages du pliage.** Faux, l'atelier
    part d'une grille vide et ne sait pas ce qui va revenir : il redécoupe sur
    les zones opaques (C2). Vrai, il a composé la planche lui-même et connaît
    l'avant de chaque case : il redécoupe sur la grille exacte qu'il a posée
    (C3). C'est la seule différence entre les deux, et elle tient en un booléen.
    """

    cases: tuple[CasePliee, ...] = ()
    geometrie_connue: bool = False

    # **La part du côté de la case que le sujet occupe**, quand c'est l'atelier
    # qui a composé la planche. Pure géométrie : ce module ne sait pas *pourquoi*
    # on laisse de la place, seulement qu'on en laisse. Elle est enregistrée
    # parce qu'une relance doit envoyer **exactement** la même planche, et que la
    # raison qui l'a fixée — la portée d'une pièce — peut changer entre les deux.
    #
    # Sans objet quand la grille part vide : une case vide n'a rien à occuper.
    occupation: float = 1.0

    refus: str | None = None

    # ── Ce que l'arrivée a trouvé, et ce que l'auteur en a fait (R6) ─────────
    #
    # **Trois champs, et un seul état à lire.** `trouvees` et `mesures` sont des
    # faits — combien de sujets la planche portait, et ce que chacun mesure ;
    # ils s'écrivent au premier regard et ne bougent plus. `ecartees` est la
    # décision : `None` tant que personne n'a tranché, une liste — vide comprise
    # — une fois que l'auteur a regardé. C'est ce qui distingue « je garde tout »
    # de « je n'ai pas encore vu », que le tuple vide seul confondrait.
    trouvees: int = 0
    mesures: tuple[MesuresLot, ...] = ()
    ecartees: tuple[int, ...] | None = None

    # **Les vues opposées qui ne sont qu'un miroir** (TS19) — des paires de
    # cases, dans l'ordre de lecture. Un fait sur l'arrivée, comme `mesures` :
    # mesuré une fois, au dépliage, et relu tel quel. Un signal, jamais un
    # refus : la planche entre, et l'écran dit « ces deux vues sont un
    # miroir ». Vide pour une planche d'avant TS19 — personne ne l'avait
    # mesurée, et rien ne l'invente pour elle.
    miroirs: tuple[tuple[int, int], ...] = ()

    # ── La grille sur laquelle la planche a été demandée (P1) ────────────────
    #
    # **Écrite à la naissance du pliage**, c'est-à-dire quand la demande pliée
    # se compose, avant de partir — `__post_init__` la prend à la formule du
    # jour si l'appelant ne l'a pas donnée. Relue ensuite telle quelle : c'est
    # elle, et plus la formule, qui dit où couper. Zéro n'existe qu'en transit.
    #
    # Les générations d'avant la portent déjà dans leur fichier — `en_json` les
    # écrivait « déduits, jamais relus » depuis C2, avec la seule formule que le
    # dépôt ait connue : les relire rend donc exactement la grille sur laquelle
    # elles ont été dessinées. Un fichier qui ne les a pas, ou qui les a
    # incohérentes, retombe sur la déduction — le seul cas où elle sert encore.
    colonnes: int = 0
    lignes: int = 0

    # Les découpages de la planche, dans l'ordre où ils ont été faits (P1).
    # Vide pour tout ce qui a été déplié avant P1 : ces images-là ne disent pas
    # leur dépliage, et rien ne l'invente pour elles.
    depliages: tuple[Depliage, ...] = ()

    def __post_init__(self) -> None:
        if not _tient(self.colonnes, self.lignes, self.nombre):
            forme = geometrie(self.nombre)
            self.colonnes, self.lignes = forme.colonnes, forme.lignes

    @property
    def nombre(self) -> int:
        return len(self.cases)

    @property
    def plusieurs(self) -> bool:
        """**Une planche à plusieurs sujets** (P2) : ses cases disent chacune
        leur chose du jeu. Lu sur les cases, jamais sur un drapeau — la liste
        *est* ce qui lève l'invariant d'E13, et sans elle l'ancienne règle
        s'applique inchangée."""
        return any(c.sujet for c in self.cases)

    @property
    def sujets(self) -> tuple[str | None, ...]:
        """La liste annoncée, dans l'ordre de lecture — un sujet par case."""
        return tuple(c.sujet for c in self.cases)

    @property
    def geometrie(self) -> Geometrie:
        """La grille **enregistrée** — jamais recalculée depuis le compte.

        Les sept lecteurs de la grille passent tous par ici, et c'est ce qui
        leur évite de changer : la valeur a changé de source, pas de forme.
        """
        if not _tient(self.colonnes, self.lignes, self.nombre):
            return geometrie(self.nombre)
        return Geometrie(max(1, self.nombre), self.colonnes, self.lignes)

    # ── Les dépliages ────────────────────────────────────────────────────────

    def depliages_de(self, planche: str) -> tuple[Depliage, ...]:
        return tuple(d for d in self.depliages if d.planche == planche)

    def depliage_auto(self, planche: str) -> Depliage | None:
        """Le dépliage automatique de cette planche, s'il a déjà été réservé.

        **Il n'y en a qu'un par planche**, et c'est ce qui rend la reprise au
        démarrage idempotente : une planche dont le dépliage a été réservé puis
        coupé par une fermeture retombe sur le même numéro et les mêmes rangs.
        """
        return next(
            (d for d in self.depliages if d.planche == planche and d.origine == AUTO),
            None,
        )

    @property
    def rangs_reserves(self) -> frozenset[int]:
        """Tous les rangs qu'un dépliage a jamais pris — la moitié « enregistrée »
        de la règle des rangs (voir `Depliage`)."""
        return frozenset(r for d in self.depliages for r in d.rangs)

    def reserver(
        self,
        planche: str,
        coupes: tuple[tuple[int, int, int, int], ...],
        premier_rang: int,
        *,
        origine: str = AUTO,
        cree_le: float = 0.0,
        cases: tuple[int | None, ...] = (),
    ) -> Depliage:
        """Un dépliage de plus, sur des rangs neufs — ou l'automatique, repris.

        `premier_rang` est donné par qui connaît le disque (le service) : ce
        module ne voit pas les assets du dossier. Il doit déjà être au-dessus
        de `rangs_reserves` ; on le remonte quand même s'il ne l'est pas, parce
        qu'un rang partagé entre deux dépliages écraserait une image sans bruit.

        **Le numéro suit le plus grand jamais donné**, par planche : le n° 2
        supprimé ne rend pas son numéro au suivant, sinon l'historique d'une
        planche nommerait deux découpages différents du même nom.
        """
        coupes = tuple(tuple(int(v) for v in c) for c in coupes)  # type: ignore[misc]
        if origine == AUTO:
            deja = self.depliage_auto(planche)
            if deja is not None:
                # Reprise : mêmes rangs si le compte n'a pas bougé. Les coupes,
                # elles, sont celles du découpage qu'on s'apprête à écrire.
                if len(deja.rangs) != len(coupes):
                    autres = frozenset(
                        r for d in self.depliages if d is not deja for r in d.rangs
                    )
                    debut = max([premier_rang - 1, *autres, *deja.rangs]) + 1
                    deja.rangs = tuple(range(debut, debut + len(coupes)))
                deja.coupes = coupes  # type: ignore[assignment]
                return deja

        debut = max([premier_rang - 1, *self.rangs_reserves]) + 1
        numero = 1 + max(
            (d.numero for d in self.depliages if d.planche == planche), default=0
        )
        depliage = Depliage(
            numero=numero,
            planche=planche,
            coupes=coupes,  # type: ignore[arg-type]
            rangs=tuple(range(debut, debut + len(coupes))),
            cree_le=cree_le,
            origine=MAIN if origine == MAIN else AUTO,
            cases=tuple(cases),
        )
        self.depliages = (*self.depliages, depliage)
        return depliage

    @property
    def gardees(self) -> tuple[int, ...]:
        """Les sujets trouvés que l'auteur garde, dans l'ordre de lecture.

        Tous, tant qu'il n'a rien écarté — y compris avant qu'il ait regardé :
        le cas ordinaire est celui où il n'y a rien à décider.
        """
        mis_de_cote = set(self.ecartees or ())
        return tuple(i for i in range(self.trouvees) if i not in mis_de_cote)

    @property
    def surplus(self) -> int:
        """Combien de sujets de trop restent, une fois les écartés retirés."""
        return max(0, len(self.gardees) - self.nombre)

    @property
    def pleines(self) -> tuple[int, ...]:
        """Les sujets gardés qui remplissent presque toute leur boîte (US-368)."""
        gardees = set(self.gardees)
        return tuple(m.case for m in self.mesures if m.case in gardees and m.pleine)

    @property
    def attend_un_choix(self) -> bool:
        """La planche est là, quelque chose cloche, et personne n'a tranché.

        **Les deux anomalies sont traitées pareil, et c'est le point de R6** :
        des sujets en trop et des carrés pleins ne se refusent ni l'un ni
        l'autre, ils s'ouvrent. L'un jetait un appel payé pour une case de trop,
        l'autre faisait entrer du vide payé sans le dire ; les deux se règlent
        du même geste — l'auteur regarde et écarte ce qu'il ne veut pas.

        Faux dès qu'il a tranché, quoi qu'il ait tranché : `ecartees` cesse
        d'être `None`, et un lot ne redemande jamais deux fois la même décision.
        """
        if self.trouvees <= 0 or self.ecartees is not None:
            return False
        # **Une planche à plusieurs sujets n'arrête jamais tout le lot** (P2).
        # Ses défauts se disent case par case (`Depliage.a_verifier`) : ce qui
        # est bon se range, ce qui cloche attend, et une case ratée se refait
        # seule — tranché par l'auteur le 18 septembre 2026. Arrêter la planche
        # entière pour une case ferait attendre sept images payées et justes.
        if self.plusieurs:
            return False
        return bool(self.surplus or self.pleines)

    def en_json(self) -> dict[str, Any]:
        forme = self.geometrie
        contenu = {
            "cases": [c.en_json() for c in self.cases],
            "geometrie_connue": self.geometrie_connue,
            "occupation": self.occupation,
            "refus": self.refus,
            "trouvees": self.trouvees,
            "mesures": [m.en_json() for m in self.mesures],
            "ecartees": list(self.ecartees) if self.ecartees is not None else None,
            # **Enregistrés et relus depuis P1** — mêmes clés qu'avant, pour
            # qu'un fichier d'avant se relise sans rien réécrire.
            "colonnes": forme.colonnes,
            "lignes": forme.lignes,
            # déduits — présents pour l'interface, jamais relus
            "nombre": self.nombre,
            "surplus": self.surplus,
            "pleines": list(self.pleines),
            "attend_un_choix": self.attend_un_choix,
        }
        # Écrits seulement quand il y en a : un pliage d'avant P1, ou pas encore
        # déplié, garde exactement la forme de fichier qu'il avait.
        if self.depliages:
            contenu["depliages"] = [dep.en_json() for dep in self.depliages]
        if self.miroirs:
            contenu["miroirs"] = [list(paire) for paire in self.miroirs]
        return contenu

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "Pliage | None":
        """**Rien plutôt qu'un pliage vide.** Une génération ordinaire n'en porte
        pas, et un pliage sans case n'est pas un lot : c'est un enregistrement
        d'avant la tranche, ou un fichier abîmé. Même règle que `lien.py`, qui
        rend rien plutôt que de lever."""
        if not d:
            return None
        cases = tuple(CasePliee.depuis_json(c) for c in d.get("cases", ()))
        if not cases:
            return None
        ecartees = d.get("ecartees")
        mesures = tuple(
            mesure
            for mesure in (MesuresLot.depuis_json(m) for m in d.get("mesures", ()))
            if mesure is not None
        )
        return Pliage(
            cases=cases,
            geometrie_connue=bool(d.get("geometrie_connue", False)),
            occupation=float(d.get("occupation", 1.0) or 1.0),
            refus=d.get("refus") or None,
            trouvees=int(d.get("trouvees", 0) or 0),
            mesures=mesures,
            # **`None` et `[]` ne disent pas la même chose**, donc la relecture
            # les distingue : rien de décidé d'un côté, « je garde tout » de
            # l'autre. Un `or None` ici rouvrirait la question à chaque
            # relecture d'une planche déjà tranchée.
            ecartees=tuple(int(i) for i in ecartees) if ecartees is not None else None,
            colonnes=int(d.get("colonnes", 0) or 0),
            lignes=int(d.get("lignes", 0) or 0),
            depliages=tuple(
                dep
                for dep in (Depliage.depuis_json(x) for x in d.get("depliages") or ())
                if dep is not None
            ),
            miroirs=tuple(
                (int(p[0]), int(p[1]))
                for p in d.get("miroirs") or ()
                if isinstance(p, (list, tuple)) and len(p) == 2
            ),
        )


def _tient(colonnes: int, lignes: int, cases: int) -> bool:
    """Une grille enregistrée qui tient ses cases — sinon elle ne se relit pas.

    **Pas de rangée entièrement vide non plus** : une grille qui en aurait une
    découperait une bande de fond comme une case. Ce n'est pas une grille que
    l'atelier a pu poser, c'est un fichier abîmé, et la déduction vaut mieux.
    """
    nombre = max(1, cases)
    return (
        colonnes >= 1
        and lignes >= 1
        and colonnes * lignes >= nombre
        and colonnes * (lignes - 1) < nombre
    )
