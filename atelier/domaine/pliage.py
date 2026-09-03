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
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

__all__ = [
    "SEUIL_PLEINE",
    "CasePliee",
    "Geometrie",
    "MesuresLot",
    "Pliage",
    "geometrie",
]


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

    **Déduite du nombre de cases, jamais enregistrée** : deux planches du même
    compte ont la même géométrie, et la garder dans le fichier en ferait une
    seconde vérité que la première relecture pourrait contredire.
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

    def en_json(self) -> dict[str, Any]:
        return {
            "texte": self.texte,
            "pose": self.pose,
            "direction": self.direction,
            "base": self.base,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "CasePliee":
        return CasePliee(
            texte=d.get("texte", ""),
            pose=d.get("pose") or None,
            direction=d.get("direction") or None,
            base=d.get("base") or None,
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

    @property
    def nombre(self) -> int:
        return len(self.cases)

    @property
    def geometrie(self) -> Geometrie:
        return geometrie(self.nombre)

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
        return bool(self.surplus or self.pleines)

    def en_json(self) -> dict[str, Any]:
        forme = self.geometrie
        return {
            "cases": [c.en_json() for c in self.cases],
            "geometrie_connue": self.geometrie_connue,
            "occupation": self.occupation,
            "refus": self.refus,
            "trouvees": self.trouvees,
            "mesures": [m.en_json() for m in self.mesures],
            "ecartees": list(self.ecartees) if self.ecartees is not None else None,
            # déduits — présents pour l'interface, jamais relus
            "nombre": self.nombre,
            "colonnes": forme.colonnes,
            "lignes": forme.lignes,
            "surplus": self.surplus,
            "pleines": list(self.pleines),
            "attend_un_choix": self.attend_un_choix,
        }

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
        )
