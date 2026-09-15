# -*- coding: utf-8 -*-
"""Ce qu'est une demande de clip, et ce qu'un modèle vidéo sait en faire.

**Pourquoi un objet à part et pas un `Modele` de plus** (A9, 2 septembre 2026).
Un appel image-vers-vidéo ne se plie pas au vocabulaire de la génération
d'image sur trois points, et chacun casse quelque chose si on l'ignore :

1. **Son entrée est obligatoire.** Le produit a trois rôles d'image jointe —
   référence, style, édition —, tous facultatifs, et tous **cèdent** devant le
   plafond du modèle (règle F6). L'image de départ d'un clip ne cède jamais :
   sans elle, il n'y a pas d'appel du tout. Elle n'est donc pas une référence,
   et un `Modele` qui compterait ses `references_max` refuserait pour une
   mauvaise raison.
2. **Il ne rend pas des variations mais une durée.** Ce qui se refuse d'avance
   n'est pas un nombre d'images, c'est un nombre de secondes.
3. **Ce qu'il rend n'est pas une image**, et rien de ce qui mesure une image ne
   sait le lire.

Le reste est identique au produit : le nom porte son fournisseur, la raison
d'un refus est une phrase française qu'on affiche sous le modèle grisé, et
**ce qui est enregistré est ce que l'appel a consommé** — jamais un tarif.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping
from atelier.domaine.catalogue import Option

# La durée d'un clip, en secondes, quand personne n'en demande une autre.
# **Cinq et pas quatre** : quatre secondes suffisent à un cycle de marche seul,
# mais le geste de la V3 est d'en tirer plusieurs animations, et il faut de la
# place pour les transitions entre elles (banc du 2 septembre 2026, où la
# version à quatre secondes sans transition n'était pas découpable).
SECONDES_DEFAUT = 5

# **Ce que le carré économise.** Chez un modèle facturé au jeton vidéo, le prix
# suit la surface : un 480×480 coûte 44 % de moins qu'un 854×480, et cadre mieux
# un personnage seul. C'est le format par défaut du produit, et la raison est
# écrite ici parce qu'elle est un fait mesuré, pas une préférence.
PROPORTIONS_DEFAUT = "1:1"
RESOLUTION_DEFAUT = "480p"


# ── Ce que ce dépôt a mesuré, et que le catalogue ne peut pas savoir ─────────
#
# **La seule liste en dur de ce module, et elle est assumée.** La règle durable
# du produit est *le catalogue décide, jamais une liste en dur* — elle parle des
# **capacités** d'un modèle : durées, résolutions, prix. Celles-là continuent de
# venir du fournisseur, relues à chaque démarrage.
#
# Ce qui est ici est d'une autre nature : c'est ce que **ce dépôt** a observé en
# payant ses propres essais. Aucun fournisseur ne le déclare, et un écran qui
# proposerait deux modèles sans le dire ferait passer une hypothèse pour un
# résultat (US-440). La règle des huit tirages n'est atteinte par aucun des
# deux : ce sont des propositions étayées, pas un arbitrage clos.
MESURES_DU_DEPOT: dict[str, str] = {
    "bytedance/seedance-2.0-mini": (
        "3 clips payés, 2 notés bons sur 2 — le seul modèle dont un tirage à "
        "plusieurs poses ait été noté bon. Attente de 118 s en moyenne, 138 s au "
        "pire. Sous la barre des 8 tirages : c'est une proposition étayée, pas "
        "un arbitrage clos."
    ),
    "bytedance/seedance-1-5-pro": (
        "6 clips payés, aucun noté bon : un moyen dont l'échec est « le "
        "personnage se retourne », les autres non notés. Attente de 107 s en "
        "moyenne, mais 301 s au pire. Sous la barre des 8 tirages."
    ),
}


@dataclass(frozen=True, slots=True)
class Tarification:
    """**Comment** un modèle vidéo compte ce qu'il facture, et à quel taux.

    Deux façons existent chez les fournisseurs, et elles ne donnent pas le même
    ordre de grandeur pour le même clip : à la seconde de vidéo, ou au **jeton
    vidéo** — hauteur × largeur × images par seconde × durée / 1024. Le produit
    doit connaître laquelle, sinon il ne peut ni calculer, ni écrire la formule.

    **Un troisième genre est arrivé en `A11`, et il a fallu l'inventer pour une
    raison précise.** `refus` grise tout modèle dont le tarif n'a pas pu être
    relu, et c'est une bonne règle : elle interdit d'engager l'auteur sans savoir
    ce qu'il engage. Mais un moteur qui tourne sur la carte de la maison n'a
    **aucun tarif chez aucun fournisseur**, et son montant est pourtant
    parfaitement connu — il vaut zéro. Sans `MAISON`, la règle qui protège de la
    dépense griserait le seul modèle qui n'en fait aucune. *Un prix de zéro n'est
    pas un prix inconnu*, et les confondre était le défaut à éviter.

    `libelle` est le nom du tarif **chez le fournisseur**. C'est la seule chose
    d'opaque ici, et elle est là pour une raison : sans elle, un auteur qui veut
    vérifier le prix sur la page du modèle ne saurait pas quelle ligne regarder.
    """

    genre: str  # "seconde" | "jeton" | "maison"
    montant: float
    libelle: str = ""


# Les trois genres de tarif, nommés une fois. `MAISON` vaut toujours zéro.
A_LA_SECONDE = "seconde"
AU_JETON = "jeton"
MAISON = "maison"


# Les côtés d'image, en pixels, pour une résolution et un rapport donnés. Ils
# servent au seul calcul du prix chez les modèles facturés au jeton : ce qui
# revient vraiment est mesuré sur le fichier, jamais déduit d'ici.
COTES = {"480p": 480, "560p": 560, "720p": 720, "768p": 768, "1080p": 1080}
RAPPORTS = {
    "1:1": (1, 1),
    "16:9": (16, 9),
    "4:3": (4, 3),
    "9:16": (9, 16),
    "3:4": (3, 4),
    "3:2": (3, 2),
}

# **La cadence que le fournisseur facture**, et pas celle que le clip portera.
# Le calcul en jetons vidéo se fait à 24 images par seconde quel que soit ce que
# le modèle rend réellement — un clip mesuré à 30 images par seconde se facture
# quand même sur 24. Confondre les deux fausserait l'annonce d'un quart.
IMAGES_PAR_SECONDE_FACTUREES = 24


def taille_demandee(resolution: str, proportions: str) -> tuple[int, int]:
    """La largeur et la hauteur qu'un clip aura, d'après ce qui est demandé."""
    hauteur = COTES.get(resolution, COTES[RESOLUTION_DEFAUT])
    largeur_rapport, hauteur_rapport = RAPPORTS.get(proportions, (1, 1))
    return int(round(hauteur * largeur_rapport / hauteur_rapport)), hauteur


# ── Écrire un nombre pour qu'il se lise ─────────────────────────────────────
#
# ⚠️ **Vu au navigateur le 4 septembre 2026**, et pas avant : la formule
# s'affichait `3.5e-06 $ le jeton … = 27000 jetons`. Trois choses à la fois — la
# notation scientifique, le point décimal, et un compte sans séparateur — sur la
# ligne dont tout l'objet est de rendre un prix **vérifiable de tête**. Un
# nombre qu'on n'arrive pas à lire ne vérifie rien.
#
# Le produit écrit la virgule décimale partout ailleurs (`docs/DESIGN.md`
# § Typography) ; c'est écrit ici parce qu'une formule est composée au serveur,
# et que l'écran ne peut pas remettre en forme un texte déjà assemblé.
#
# **Une espace ordinaire pour les milliers, pas une espace fine insécable.** Le
# produit n'en emploie aucune, nulle part ; en poser une ici aurait fait un
# caractère invisible que rien d'autre ne porte, introuvable à la recherche et
# impossible à distinguer d'une espace dans un diff.


def _lisible(montant: float) -> str:
    """Un tarif à l'unité, en toutes lettres. `0,0000035`, jamais `3.5e-06`.

    Douze décimales : c'est plus qu'aucun tarif observé n'en porte, et les
    zéros de queue sont retirés — un tarif ne s'écrit pas avec du remplissage.
    """
    return f"{montant:.12f}".rstrip("0").rstrip(".").replace(".", ",") or "0"


def _compte(valeur: float) -> str:
    """Un compte entier, avec son espace des milliers : `27 000`."""
    return f"{valeur:,.0f}".replace(",", " ")


@dataclass(frozen=True, slots=True)
class Prix:
    """Ce qu'un clip devrait coûter, **et d'où ce chiffre sort**.

    Un prix sans sa formule n'est pas vérifiable : un modèle vidéo se facture
    soit à la seconde, soit au jeton vidéo — hauteur × largeur × images par
    seconde × durée —, et les deux donnent des ordres de grandeur différents
    pour le même clip. La formule voyage donc avec le montant, jusqu'à l'écran.

    **Ce n'est jamais une dépense.** C'est une borne haute affichée avant
    l'envoi ; ce qui s'enregistre après est ce que la réponse a facturé. L'écart
    mesuré sur treize clips le 2 septembre 2026 va de +4 % à −58 %.
    """

    montant: float | None
    formule: str = ""
    releve_le: str = ""
    # **Une estimation, sauf quand le montant est certain.** Le seul cas certain
    # est celui du moteur de la maison, dont le montant est zéro et le restera :
    # écrire *estimation* à côté d'un zéro exact laisserait croire qu'il pourrait
    # être autre chose (`A11`).
    nature: str = "estimation"

    @property
    def connu(self) -> bool:
        return self.montant is not None

    def en_json(self) -> dict[str, Any]:
        return {
            "montant": self.montant,
            "formule": self.formule,
            "releve_le": self.releve_le,
            # **Écrit noir sur blanc, à chaque fois.** Le critère de A9 demande
            # que l'écran distingue une estimation d'un montant relu ; il ne le
            # peut que si le mot voyage avec le chiffre.
            "nature": self.nature,
        }


# ── Ce qui coûte du temps au lieu de l'argent (A11) ──────────────────────────


@dataclass(frozen=True, slots=True)
class Attente:
    """Ce qu'un clip de la maison coûte : **du temps, et il s'annonce pareil**.

    L'invariant du produit — *rien ne part sans que le prix soit annoncé* — ne
    disparaît pas quand le prix vaut zéro, il **change d'unité**. Ce que l'auteur
    engage en lançant un clip local est trois minutes de sa machine, et il a le
    droit de le savoir avant, exactement comme il a le droit de savoir qu'un clip
    payé coûte sept centimes.

    **`premier` n'est pas un détail d'affichage.** Le modèle reste chargé en
    mémoire d'un tirage à l'autre : le premier paie le chargement, les suivants
    non. Relevé le 3 septembre 2026 sur cette machine — ≈ 7,6 s par image au
    premier tirage, ≈ 4,7 s ensuite. Annoncer la seconde valeur pour le premier
    clip ferait attendre le double de ce qui a été promis, et c'est la même faute
    que d'annoncer un prix trop bas.
    """

    secondes: float
    premier: bool
    images: int = 0
    # D'où viennent les deux cadences, pour que la phrase puisse le dire.
    mesure: str = ""
    # **Ce que prendra chacun des clips d'après**, modèle déjà chargé.
    #
    # Il est ici parce qu'on peut en lancer plusieurs d'un coup : annoncer la
    # valeur du premier pour un lot de quatre annoncerait le tiers de l'attente
    # réelle. L'écran ne peut pas la déduire — les deux cadences sont deux
    # mesures, pas un rapport qui se calcule.
    secondes_suivant: float = 0.0

    @property
    def minutes(self) -> float:
        return self.secondes / 60.0

    def lot(self, nombre: int) -> float:
        """Ce que prendra un lot de `nombre` clips : le premier paie le
        chargement du modèle, les suivants non."""
        if nombre <= 1:
            return self.secondes
        return self.secondes + (nombre - 1) * (self.secondes_suivant or self.secondes)

    def en_json(self) -> dict[str, Any]:
        return {
            "secondes": round(self.secondes),
            "secondes_suivant": round(self.secondes_suivant),
            "premier": self.premier,
            "images": self.images,
            "mesure": self.mesure,
            "nature": "attente",
        }


@dataclass(frozen=True, slots=True)
class DemandeClip:
    """Ce qui part pour obtenir un clip : un texte, **une image**, une durée.

    `image` est l'image de départ — la première image du clip. Elle est
    obligatoire par construction : une demande sans elle est refusée avant
    l'appel, et non par le fournisseur.
    """

    texte: str
    image: bytes
    secondes: int = SECONDES_DEFAUT
    proportions: str = PROPORTIONS_DEFAUT
    resolution: str = RESOLUTION_DEFAUT
    # Ce que l'auteur a réglé et que l'adaptateur transporte sans l'interpréter.
    options: Mapping[str, Any] = field(default_factory=dict)

    @property
    def a_son_entree(self) -> bool:
        return bool(self.image)


@dataclass(frozen=True, slots=True)
class ModeleVideo:
    """Ce qu'un modèle vidéo sait faire, en vocabulaire du produit."""

    identifiant: str
    nom: str
    fournisseur: str = ""
    chez_lui: str = ""
    durees: tuple[int, ...] = ()
    resolutions: tuple[str, ...] = ()
    proportions: tuple[str, ...] = ()
    # Faux quand le fournisseur ne déclare pas accepter d'image d'entrée : le
    # modèle est alors sans objet ici, et le produit le dit plutôt que de payer
    # pour l'apprendre. Un modèle vidéo sur vingt-huit est dans ce cas.
    accepte_une_image: bool = True
    # Ce que ce dépôt a mesuré de lui, ou rien. Voir `MESURES_DU_DEPOT`.
    mesure: str = ""
    # Comment il facture, tel que le fournisseur le déclare, **relu au
    # démarrage comme le reste du catalogue**. `None` : le tarif n'a pas pu
    # être lu, et le modèle sera grisé plutôt que proposé au hasard.
    tarification: Tarification | None = None
    # Ce que le fournisseur nomme, quand rien n'est reconnu : sert uniquement à
    # écrire une phrase de grisé qui dise *quoi* regarder.
    tarifs_declares: tuple[str, ...] = ()

    # ── Ce qu'`A11` ajoute, et qui ne concerne que le moteur de la maison ────
    #
    # Un modèle payant n'en a rien à faire : le fournisseur rend le nombre
    # d'images qu'il veut et facture à la seconde. Le local, lui, **n'accepte
    # pas n'importe quel compte d'images**, et l'écran doit dire le vrai.
    #
    # `images_par_seconde` est la cadence à laquelle le moteur rend, et
    # `pas_d_images` la forme que le compte doit avoir : `4` veut dire `4n + 1`,
    # la contrainte de Wan 2.2 — relevée le 2 septembre 2026 dans le code
    # installé, `((length - 1) // 4) + 1`. Zéro dans les deux cas veut dire *ce
    # modèle n'a pas de contrainte de ce genre*, et c'est le cas de tous les
    # payants.
    images_par_seconde: int = 0
    pas_d_images: int = 0
    # Le temps par image, **premier tirage puis les suivants**. Deux valeurs
    # parce que le modèle reste chargé entre deux clips : relevé ≈ 7,6 s puis
    # ≈ 4,7 s le 3 septembre 2026 sur cette machine. Vide chez un payant.
    secondes_par_image: tuple[float, ...] = ()
    # La durée que l'écran met en avant, et **pourquoi**. Mesuré : plus le clip
    # est long, plus la bande se dégrade — le greffon a été entraîné par paquets
    # de 8 à 32 images, et au-delà il travaille hors de son terrain. Vide chez un
    # payant, où rien de tel n'a été mesuré.
    duree_conseillee: int = 0
    raison_de_la_duree: str = ""
    options: Mapping[str, Option] = field(default_factory=dict)
    indisponible: str | None = None

    @property
    def de_la_maison(self) -> bool:
        """Vrai quand ce modèle tourne ici et ne facture rien."""
        return self.tarification is not None and self.tarification.genre == MAISON

    def images_reelles(self, secondes: float) -> int:
        """Le nombre d'images que ce modèle rendra **vraiment**.

        Le produit convertit et **annonce le compte réel** plutôt que celui qu'on
        a demandé : c'est la règle qui vaut partout ailleurs — *ce qui est
        enregistré est ce qui s'est passé*. À seize images par seconde et au pas
        de quatre, une seconde fait 17 images, deux 33, trois 49.

        ⚠️ **49 est un calcul, pas une mesure.** Le banc du 3 septembre 2026 n'est
        jamais monté jusqu'à trois secondes pleines : son plus long tirage faisait
        45 images, soit 2,8 s. L'écran ne doit pas présenter les 49 autrement.
        """
        if self.images_par_seconde <= 0:
            return 0
        brut = max(1, round(secondes * self.images_par_seconde))
        if self.pas_d_images <= 0:
            return brut
        pas = self.pas_d_images
        # **On arrondit vers le haut, jamais vers le bas.** Seize images à seize
        # par seconde ne sont pas un compte acceptable ; le plus proche en
        # dessous est quinze — treize, en réalité —, et rendrait un clip *plus
        # court que demandé*. Un clip trop court est une seconde d'animation
        # qu'on n'a pas, et le geste entier est à refaire.
        crans = -((-(brut - 1)) // pas)
        return max(pas + 1, crans * pas + 1)

    def attente(self, demande: DemandeClip, premier: bool = True) -> Attente | None:
        """Ce que ce clip prendra de temps, ou `None` si ce n'est pas la question.

        `None` chez un payant : ce qu'il coûte est de l'argent, et l'annoncer en
        secondes ferait croire qu'on a mesuré une attente qu'on n'a pas mesurée.
        """
        if not self.secondes_par_image:
            return None
        images = self.images_reelles(demande.secondes)
        par_image = self.secondes_par_image[0 if premier else -1]
        return Attente(
            secondes=images * par_image,
            premier=premier,
            images=images,
            mesure=(
                f"{_lisible(par_image)} s par image"
                + (" — premier tirage, le modèle se charge" if premier else "")
            ),
            secondes_suivant=images * self.secondes_par_image[-1],
        )

    @property
    def envoi(self) -> str:
        """Le nom que l'adaptateur écrit dans l'appel. Jamais l'identifiant."""
        return self.chez_lui or self.identifiant

    @property
    def duree_par_defaut(self) -> int:
        """La durée du produit si le modèle l'accepte, sinon la plus courte.

        La plus courte est aussi la moins chère : à défaut de pouvoir donner à
        l'auteur ce qu'il demande, on ne lui fait pas payer plus.
        """
        if not self.durees or SECONDES_DEFAUT in self.durees:
            return SECONDES_DEFAUT
        return min(self.durees)

    def prix(self, demande: DemandeClip, releve_le: str = "") -> Prix:
        """Ce que ce clip devrait coûter, **et la formule qui le produit**.

        Le montant est `None` quand le tarif n'a pas pu être relu : la formule
        dit alors ce que le fournisseur déclarait, pour qu'on sache où chercher.
        Un montant `None` n'est pas zéro — c'est *on ne sait pas*, et le modèle
        est grisé (voir `refus`).
        """
        tarif = self.tarification
        if tarif is None:
            declares = ", ".join(self.tarifs_declares) or "rien"
            return Prix(
                montant=None,
                formule=f"aucun tarif reconnu ; le fournisseur déclare : {declares}",
                releve_le=releve_le,
            )
        if tarif.genre == MAISON:
            # **Zéro, et une phrase au lieu d'une multiplication.** Écrire
            # « 0 $ la seconde × 2 s » serait exact et ne dirait rien ; ce que
            # l'auteur a besoin de lire est *pourquoi* c'est gratuit.
            return Prix(
                montant=0.0,
                formule=tarif.libelle or "gratuit — la carte de la maison",
                releve_le=releve_le,
                nature="certain",
            )
        if tarif.genre == A_LA_SECONDE:
            montant = tarif.montant * demande.secondes
            formule = (
                f"{_lisible(tarif.montant)} $ la seconde ({tarif.libelle}) "
                f"× {demande.secondes:g} s"
            )
        else:
            largeur, hauteur = taille_demandee(demande.resolution, demande.proportions)
            jetons = (
                largeur
                * hauteur
                * IMAGES_PAR_SECONDE_FACTUREES
                * demande.secondes
                / 1024
            )
            montant = tarif.montant * jetons
            formule = (
                f"{_lisible(tarif.montant)} $ le jeton ({tarif.libelle}) "
                f"× {largeur}×{hauteur}"
                f"×{IMAGES_PAR_SECONDE_FACTUREES}×{demande.secondes:g}/1024 "
                f"= {_compte(jetons)} jetons"
            )
        return Prix(montant=round(montant, 4), formule=formule, releve_le=releve_le)

    def refus(self, demande: DemandeClip, prix: Prix | None = None) -> str | None:
        """La raison, en clair, pour laquelle ce modèle ne peut pas honorer la
        demande — ou `None` s'il le peut.

        C'est cette phrase que l'interface écrit sous le modèle grisé. **Le
        produit ne propose jamais pour rejeter ensuite** : ce qui est impossible
        se voit avant d'être choisi.

        **Le prix en fait partie**, et c'est propre à la vidéo : un modèle dont
        le tarif n'a pas pu être relu chez le fournisseur ne peut pas être
        proposé, parce qu'on ne saurait pas dire à l'auteur ce qu'il engage.
        Côté image, le tarif ne conditionne rien — l'appel dure quelques
        secondes et se lit après coup ; ici il se fait attendre deux minutes.
        """
        if self.indisponible:
            return self.indisponible
        if self.options:
            for nom, valeur in demande.options.items():
                if nom not in self.options or not self.options[nom].accepte(valeur):
                    return f"n'accepte pas le réglage {nom} = {valeur}"
        if not self.accepte_une_image:
            return "n'anime pas une image, il ne part que d'un texte"
        if not demande.a_son_entree:
            return "demande une image de départ, et il n'y en a pas"
        if self.durees and demande.secondes not in self.durees:
            possibles = ", ".join(f"{d} s" for d in sorted(self.durees)[:6])
            return f"ne fait pas de clip de {demande.secondes} s — seulement {possibles}"
        if self.resolutions and demande.resolution not in self.resolutions:
            return f"ne rend pas du {demande.resolution} — seulement " + ", ".join(
                self.resolutions
            )
        if self.proportions and demande.proportions not in self.proportions:
            return f"ne rend pas du {demande.proportions} — seulement " + ", ".join(
                self.proportions
            )
        prix = prix if prix is not None else self.prix(demande)
        if not prix.connu:
            return f"son prix n'a pas pu être relu chez le fournisseur — {prix.formule}"
        return None


# ── Ce qu'un clip devient une fois payé ──────────────────────────────────────


@dataclass(slots=True)
class Clip:
    """Le clip d'un appel vidéo, tel qu'il s'écrit sur son emplacement.

    **Il se pose à la soumission, pas à l'arrivée**, et c'est tout son intérêt.
    Un appel d'image tient dans une requête ; un clip se fait attendre deux
    minutes et **survit à une fermeture de l'atelier**. Le numéro du travail est
    donc écrit avant la première attente : sans lui, un clip payé pendant qu'on
    fermait l'atelier serait un clip payé deux fois.

    C'est aussi le champ qui **dit qu'un appel est un appel vidéo**, exactement
    comme `pliage` dit qu'une génération est une planche (C2). Rien à deviner
    d'après le nom du modèle ou le type du fichier : on lit un champ.
    """

    # Le numéro que le fournisseur donne à la soumission. Vide seulement entre
    # la création de l'emplacement et la réponse du POST — quelques millisecondes.
    travail: str = ""
    secondes: int = SECONDES_DEFAUT
    proportions: str = PROPORTIONS_DEFAUT
    resolution: str = RESOLUTION_DEFAUT

    # Ce qui a été annoncé avant l'envoi, avec sa formule. Gardé pour que l'écart
    # avec le montant facturé se lise **après coup**, sur la génération elle-même.
    prix_annonce: float | None = None
    prix_formule: str = ""

    # Ce que le clip porte, mesuré à l'arrivée. Zéro tant que rien n'est extrait
    # — et zéro pour toujours si le décodeur manque, ce qui ne remet en cause ni
    # le paiement, ni le fichier, ni la reprise.
    images: int = 0
    cadence: float = 0.0
    # Pourquoi les images n'ont pas pu être tirées, s'il y a une raison. Un clip
    # payé dont l'extraction échoue **reste un clip payé** : le message est ici,
    # pas dans le statut de l'emplacement.
    extraction_refus: str | None = None

    # **Le montant enregistré a-t-il été relu chez le fournisseur ?** Vrai dans
    # tous les cas mesurés ; faux quand la réponse ne portait aucun coût. Le
    # critère de A9 le demande en toutes lettres : *le montant enregistré dit
    # s'il a été relu ou estimé*. Sans lui, un zéro faute de réponse et un zéro
    # parce que c'est gratuit s'écriraient pareil.
    montant_relu: bool = True

    # Vrai quand ce clip a été rapatrié par un geste de reprise plutôt que par
    # l'attente d'origine. Se lit au journal : c'est la trace qu'un clip a été
    # sauvé au lieu d'être repayé.
    recupere: bool = False

    # ── Le lot, c'est-à-dire le geste qui les a lancés ───────────────────────
    #
    # **Écrit, jamais déduit.** Quatre clips lancés d'un coup partagent le même
    # texte, la même image de départ et la même minute : les rapprocher après
    # coup sur ces trois-là marcherait presque toujours, et se tromperait le
    # jour où l'auteur relance exactement la même chose. « Garder celui-ci et
    # jeter les autres » a besoin de savoir *lesquels* sans se tromper, et un
    # geste qui jette la mauvaise vidéo payée est un geste qu'on ne refait pas.
    #
    # Vide pour les clips d'avant ce champ, et c'est la vérité : ils n'ont pas
    # été lancés en lot. Un lot d'un seul clip en porte un quand même — la
    # réponse ne change pas de forme selon le nombre.
    lot: str = ""

    # ── Jeté, et pourtant toujours là ────────────────────────────────────────
    #
    # **Un clip jeté quitte la galerie et reste au journal.** C'est la
    # différence avec une image jetée, qui s'efface pour de bon après quelques
    # secondes : celle-ci a coûté de l'argent, et le premier invariant du
    # produit est que l'argent dépensé ne s'efface jamais. On lance quatre
    # clips, on en garde un — les trois autres ont été payés, et l'écran des
    # dépenses le dira toujours.
    #
    # Rien n'expire, donc rien ne presse : le geste se défait quand on veut, et
    # le bandeau d'annulation n'a aucun compte à rebours à afficher. C'est plus
    # simple que la suppression d'une image, et c'est plus sûr.
    jete: bool = False

    # ── Le sprite dont il part (V3.02) ───────────────────────────────────────
    #
    # **L'identifiant de l'asset qui a servi d'image de départ.** Rien ne le
    # portait jusqu'ici : le fichier partait, la filiation restait muette, et la
    # fiche d'un clip ne pouvait pas dire *de quoi* il était parti. Vide pour
    # les clips d'avant ce champ, et c'est la vérité — ils ne le savaient pas.
    depart: str = ""
    # Une séquence native de rendu 3D garde son alpha ; ce n’est pas un MP4.
    nature: str = "video"

    @property
    def montant_dit(self) -> str:
        """Ce que l'écran écrit à côté du chiffre. **Une phrase, pas un drapeau.**

        Le produit affiche un montant relu comme un fait et une estimation comme
        une estimation. Les confondre a un coût connu : sur les modèles mesurés,
        l'estimation par jetons vidéo dépasse la facture de moitié, et un auteur
        qui prendrait l'une pour l'autre renoncerait à des clips qu'il pouvait
        s'offrir.
        """
        if self.nature == "planche":
            # **La feuille dit qu'elle est une feuille** (`AU19`). *Source
            # importée* serait vrai et inutile : l'auteur qui relit sa galerie
            # six mois plus tard cherche de quoi cette animation est née, et la
            # réponse est une image de sa bibliothèque, pas un fichier d'ailleurs.
            return "feuille découpée — aucun nouvel appel"
        if self.nature == "assemblage":
            # **`RP21`, chemin 2** : ces frames ne viennent ni d'une feuille
            # découpée ni d'un fichier importé, mais d'une sélection d'images
            # déjà en bibliothèque. Une phrase à elle, pour la même raison que
            # celle de la feuille juste au-dessus.
            return "images assemblées — aucun nouvel appel"
        if self.nature != "video":
            return "source importée — aucun nouvel appel"
        if self.montant_relu:
            return "montant relu chez le fournisseur"
        return (
            "le fournisseur n'a pas dit ce que ce clip a coûté — "
            "il est au journal à zéro, ce qui est faux vers le bas"
        )

    @property
    def prete_a_reprendre(self) -> bool:
        """Un travail connu se récupère ; un travail sans numéro est perdu."""
        return bool(self.travail)

    def en_json(self) -> dict[str, Any]:
        return {
            "travail": self.travail,
            **({"nature": self.nature} if self.nature != "video" else {}),
            "secondes": self.secondes,
            "proportions": self.proportions,
            "resolution": self.resolution,
            "prix_annonce": self.prix_annonce,
            "prix_formule": self.prix_formule,
            "images": self.images,
            "cadence": self.cadence,
            "extraction_refus": self.extraction_refus,
            "montant_relu": self.montant_relu,
            "recupere": self.recupere,
            "jete": self.jete,
            "lot": self.lot,
            "depart": self.depart,
            # Déduit, écrit quand même : c'est la phrase que l'écran affiche à
            # côté du montant, et deux rédactions finiraient par dire deux
            # choses.
            "montant_dit": self.montant_dit,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "Clip | None":
        if not d:
            return None
        return Clip(
            nature=d.get("nature", "video"),
            travail=d.get("travail", ""),
            secondes=int(d.get("secondes", SECONDES_DEFAUT)),
            proportions=d.get("proportions", PROPORTIONS_DEFAUT),
            resolution=d.get("resolution", RESOLUTION_DEFAUT),
            prix_annonce=d.get("prix_annonce"),
            prix_formule=d.get("prix_formule", ""),
            images=int(d.get("images", 0)),
            cadence=float(d.get("cadence", 0.0)),
            extraction_refus=d.get("extraction_refus"),
            montant_relu=bool(d.get("montant_relu", True)),
            recupere=bool(d.get("recupere", False)),
            jete=bool(d.get("jete", False)),
            lot=d.get("lot", ""),
            depart=d.get("depart", ""),
        )
