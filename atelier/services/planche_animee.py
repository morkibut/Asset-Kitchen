# -*- coding: utf-8 -*-
"""La feuille de sprites qui devient une animation (`AU19`).

**Le pont qui manquait entre les deux moitiés du produit.** Le produit savait
découper une feuille — en *images fixes*, sans ordre ni suite. Il savait
fabriquer une animation — mais seulement en partant d'une vidéo, parce qu'une
image d'animation ne sait désigner qu'un numéro de frame dans un clip. L'auteur
qui importait une feuille de douze cases n'avait donc aucun chemin, et le seul
contournement passait par une vidéo : c'est-à-dire par la perte de la couche
alpha, sur des sprites dont c'est le bien le plus précieux.

**Ce qui entre est un clip, pas une nouvelle sorte d'objet.** C'est le
raisonnement d'`AU18`, reconduit sans changer un mot : le montage, la pellicule,
le prélèvement d'image, la fiche, l'affectation à une case et l'export existent
déjà et n'attendaient qu'une porte. Un clip *est* un dossier d'images
numérotées ; une feuille découpée aussi. La séquence d'un rendu asset3d entre
déjà par là — `nature: rendu3d` —, et le montage sait depuis ce jour-là qu'un
clip n'a pas toujours de fichier vidéo derrière lui.

**Trois services se croisent ici, et c'est pourquoi ce fichier existe.** La
découpe sait couper, les générations savent écrire un clip, le montage sait
tailler une bande ; aucun des trois ne connaît les deux autres, et c'est un
ordre qu'on ne casse pas pour un geste de plus. Le service tient donc l'atelier
entier, comme `ServiceSources3D` — le seul autre endroit du dépôt où des images
deviennent une animation.

**Rien n'est dépensé.** L'image a été payée une fois, quand la feuille —
ou la carte, ou chaque image d'une sélection — est entrée ; ce service ne
rappelle jamais le fournisseur.

**`RP21` ouvre deux chemins de plus vers le même geste, et non deux services.**
La découpe d'une carte de la toile suit exactement le chemin d'une planche de
la bibliothèque — seule change la façon de retrouver l'image de départ,
`feuille` ou `carte` — et une sélection d'images déjà en bibliothèque suit le
même dernier pas : un dossier d'images numérotées, une génération qui les
porte, une bande qui les range. `_livrer` est ce dernier pas, commun aux trois
entrées.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Any, Iterable, Sequence

from atelier.domaine.animation import Clip
from atelier.domaine.asset import Asset
from atelier.domaine.bande import BOUCLE, CADENCE_PAR_DEFAUT, SENS
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import Emplacement, Generation, Statut
from atelier.image.decoupe import Boite, decouper
from atelier.services.assets import AssetInconnu
from atelier.services.decoupe import verifier_boites

# Le modèle sous lequel ces clips se rangent au journal. **Un nom, pas un
# fournisseur** : il sert à les retrouver entre eux, comme `video-importee`
# retrouve les vidéos importées.
FEUILLE_DECOUPEE = "feuille-decoupee"

# **`RP21`, chemin 2** : le modèle d'un clip né d'une sélection d'images fixes,
# pas d'une planche découpée. Un nom distinct, pour la même raison que
# `FEUILLE_DECOUPEE` : le journal doit pouvoir dire d'où un clip vient sans
# ouvrir son `generation.json`.
IMAGES_ASSEMBLEES = "images-assemblees"

# La nature du clip, lue par le montage pour ne pas proposer de lire une vidéo
# qui n'existe pas, et par la fiche pour écrire d'où il vient.
PLANCHE = "planche"

# **`RP21`, chemin 2.** Une sélection d'images n'est pas une planche découpée —
# `Clip.montant_dit` (`atelier/domaine/animation.py`) le dit avec ses propres
# mots plutôt que d'emprunter la phrase de la feuille, qui mentirait sur l'où.
ASSEMBLAGE = "assemblage"

# **Aucune marge, et c'est la seule différence avec la découpe en images.** Là,
# un peu de fond autour d'un sprite ne gêne personne ; ici, il rendrait les
# cases de bord plus petites que les autres — elles sont rognées au bord de la
# feuille — et une animation dont les images n'ont pas la même taille tressaute.
MARGE_NULLE = 0


class PlancheAnimeeRefusee(ErreurAtelier):
    """La feuille ne peut pas devenir une animation, et on dit pourquoi."""

    code = "planche_animee_refusee"


@dataclass(frozen=True, slots=True)
class _Source:
    """L'image de départ, quelle que soit la bibliothèque qui la porte.

    **`RP21` en ajoute une seconde forme** (`carte`) à côté de celle d'`AU19`
    (`feuille`) : les deux fabriquent cet objet-ci, et tout ce qui suit —
    vérifier les rectangles, découper, écrire le clip — ne regarde plus
    jamais d'où elle vient. `personnage` et `pose` sont `None` pour une carte :
    le tableau d'inspiration ne range rien sur un sujet, à la différence d'une
    planche de la bibliothèque (`AU20`).
    """

    identifiant: str
    label: str
    largeur: int
    hauteur: int
    projet: str | None
    personnage: str | None
    pose: str | None
    octets: bytes
    quoi: str  # « feuille » ou « carte » — pour le texte des refus


class ServicePlancheAnimee:
    """D'une feuille et de ses rectangles : un clip, et ses bandes."""

    def __init__(self, atelier) -> None:
        self.atelier = atelier

    def animer(
        self,
        feuille: str | None = None,
        boites: Iterable[Boite] = (),
        *,
        carte: str | None = None,
        projet: str | None = None,
        nom: str = "",
        personnage: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        directions: Sequence[str] | None = None,
        cadence: float = CADENCE_PAR_DEFAUT,
        sens: str = BOUCLE,
        acteur: str = "auteur",
    ) -> dict[str, Any]:
        """Les cases de cette image deviennent les images d'un clip neuf.

        **L'image de départ est une planche de la bibliothèque, ou une carte de
        la toile — l'une des deux, jamais les deux** (`RP21`). Tout le reste ne
        change pas d'un mot selon celle qu'on a choisie : c'est `_Source` qui
        absorbe la différence, ici et une seule fois.

        **L'ordre reçu est l'ordre joué.** C'est celui que l'auteur a sous les
        yeux dans l'atelier de découpe, numéroté au pied de chaque rectangle ;
        le réordonner ici ferait mentir ces numéros au moment précis où l'on
        clique. La grille fixe les rend déjà dans l'ordre de lecture — de
        gauche à droite, puis ligne par ligne.

        **`directions` fait autant de bandes que de lignes**, et c'est la forme
        courante d'une feuille : quatre lignes, une par direction. Les cases se
        partagent alors en parts égales, dans l'ordre des lignes. Sans elle,
        toute la feuille fait une seule animation.
        """
        if bool(feuille) == bool(carte):
            raise PlancheAnimeeRefusee(
                "une image de départ est nécessaire — une feuille ou une carte, "
                "pas les deux"
            )
        source = (
            self._source_depuis_feuille(feuille)
            if feuille
            else self._source_depuis_carte(carte, projet)  # type: ignore[arg-type]
        )

        # **Ce qui naît d'une image appartient à qui elle appartient**
        # (`AU20`). Le jeu l'a toujours fait — `projet=source.projet`, plus bas
        # — et le sujet, lui, ne le faisait pas : une planche découpée sur la
        # fiche d'un personnage rendait une animation sans personnage, donc
        # invisible sur la fiche d'où on venait tout juste de la tirer. C'est
        # le trou mesuré le 13 septembre 2026, à l'identique de l'import.
        #
        # **Ce que l'appel dit l'emporte**, dans les deux sens : nommer un autre
        # sujet le range ailleurs, et une chaîne vide dit « aucun » — c'est ce
        # que l'écran envoie quand l'auteur choisit de ne rien rattacher. Une
        # carte n'a ni personnage ni pose (`_Source`) : ces deux lignes ne
        # changent rien pour elle, faute de défaut à reprendre.
        if personnage is None:
            personnage = source.personnage
            if pose is None:
                pose = source.pose
        personnage = personnage or None
        pose = pose or None

        rectangles = verifier_boites(
            boites, source.largeur, source.hauteur, quoi=source.quoi
        )
        propre = nom.strip() or source.label or "Feuille découpée"
        # **Découpée avant d'écrire quoi que ce soit.** Une image illisible ou
        # un rectangle impossible doit se refuser sans laisser un clip vide
        # derrière lui — la règle de l'import d'`AU18` : rien n'a été payé, donc
        # rien n'a de raison de rester.
        cases = decouper(source.octets, rectangles, marge=MARGE_NULLE)

        demande: dict[str, Any] = {
            "prompt": propre,
            "source": source.label,
            "boites": [list(b) for b in rectangles],
        }
        # `feuille` porte la filiation d'une planche, `carte` celle d'une carte
        # de la toile — les deux vivent dans le `generation.json` et survivent
        # donc à l'effacement de l'index. Un clip doit pouvoir dire de quelle
        # image il est né et où il a coupé, six mois plus tard.
        demande[source.quoi] = source.identifiant

        return self._livrer(
            cases,
            projet=source.projet,
            personnage=personnage,
            pose=pose,
            direction=direction,
            directions=directions,
            nom=propre,
            cadence=cadence,
            sens=sens,
            modele=FEUILLE_DECOUPEE,
            nature=PLANCHE,
            demande=demande,
            provenance=acteur,
        )

    def assembler(
        self,
        images: Sequence[str],
        *,
        nom: str = "",
        personnage: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        cadence: float = CADENCE_PAR_DEFAUT,
        sens: str = BOUCLE,
        acteur: str = "auteur",
    ) -> dict[str, Any]:
        """Une sélection d'images fixes devient un clip et sa bande (`RP21`).

        **Le second chemin, et il n'a pas de rectangles à couper.** Les images
        existent déjà, chacune en bibliothèque, et deviennent telles quelles
        les frames d'un clip neuf — dans l'ordre où la sélection les donne.
        Aucun redimensionnement, aucun recadrage : c'est le rendu de chaque
        image, tel qu'il est montré dans la grille, qui entre dans le dossier
        du clip (`ServiceAssets.octets`, « le rendu, jamais le brut »).

        **Une sélection qui mélange deux sujets se refuse ici aussi**, pas
        seulement à l'écran : le client peut se tromper, ce service ne
        laissera jamais deux personnages fondre dans la même animation sans
        le dire.

        **Le sujet, la pose et la direction se préremplissent** quand toutes
        les images choisies s'accordent sur l'un d'eux — la même règle que
        `animer` reprend d'`AU20` pour une feuille. Nommés dans l'appel, ils
        l'emportent ; une chaîne vide dit « aucun ».
        """
        identifiants = [i for i in images if i]
        if not identifiants:
            raise PlancheAnimeeRefusee(
                "aucune image — il n'y a rien à assembler"
            )

        assets: list[Asset] = []
        for identifiant in identifiants:
            asset = self.atelier.assets.lire(identifiant)
            if asset is None:
                raise AssetInconnu(identifiant)
            assets.append(asset)

        # **Le refus qui donne son nom au critère** : deux sujets dans une
        # sélection ne font pas une animation, ils font une confusion qu'on ne
        # découvrirait qu'en la jouant.
        sujets = {a.personnage for a in assets if a.personnage}
        if len(sujets) > 1:
            raise PlancheAnimeeRefusee(
                "cette sélection mélange plusieurs sujets — "
                + ", ".join(sorted(sujets))
                + " — une animation vient d'un seul sujet"
            )

        if personnage is None:
            personnage = next(iter(sujets)) if sujets else None
        personnage = personnage or None
        if pose is None:
            poses = {a.pose for a in assets if a.pose}
            pose = next(iter(poses)) if len(poses) == 1 else None
        pose = pose or None
        if direction is None:
            vues = {a.direction for a in assets if a.direction}
            direction = next(iter(vues)) if len(vues) == 1 else None
        direction = direction or None

        projets = {a.projet for a in assets if a.projet}
        projet = next(iter(projets)) if len(projets) == 1 else None

        # **Le rendu de chacune, jamais son brut** — ce que la grille montre
        # est ce qui entre dans le clip, transparence comprise.
        cases = [self.atelier.assets.octets(a)[0] for a in assets]
        propre = nom.strip() or "Images assemblées"

        return self._livrer(
            cases,
            projet=projet,
            personnage=personnage,
            pose=pose,
            direction=direction,
            directions=None,
            nom=propre,
            cadence=cadence,
            sens=sens,
            modele=IMAGES_ASSEMBLEES,
            nature=ASSEMBLAGE,
            demande={
                "prompt": propre,
                # **La filiation, image par image, dans l'ordre joué.** L'index
                # d'une frame dans cette liste est son numéro dans le clip :
                # c'est ce qui répond à « de quelle image vient cette frame ? »
                # six mois plus tard, sans rien de plus à écrire.
                "images": [a.identifiant for a in assets],
            },
            provenance=acteur,
        )

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _source_depuis_feuille(self, feuille: str) -> _Source:
        """Une planche de la bibliothèque (`AU19`)."""
        asset = self.atelier.assets.lire(feuille)
        if asset is None:
            # **Le refus de la bibliothèque, pas un refus à nous.** Une feuille
            # inconnue est une image inconnue, et le produit ne dit pas deux
            # phrases différentes pour le même fait selon l'écran qui demande.
            raise AssetInconnu(feuille)
        return _Source(
            identifiant=asset.identifiant,
            label=asset.label,
            largeur=asset.largeur,
            hauteur=asset.hauteur,
            projet=asset.projet,
            personnage=asset.personnage,
            pose=asset.pose,
            octets=self.atelier.fichiers.lire(asset.brut),
            quoi="feuille",
        )

    def _source_depuis_carte(self, carte: str, projet: str | None) -> _Source:
        """Une carte du tableau d'inspiration (`RP21`).

        **Aucune marge de nouveauté ici** : c'est le même tableau que
        `EcranDecoupe` découpe déjà en images (`atelier/services/univers.py`,
        `decouper_carte`) — seule la sortie change, un clip au lieu de cartes.
        """
        from atelier.domaine.carte import IMAGE

        identifiant_projet = projet or self.atelier.bibliotheque.courant
        if not identifiant_projet:
            raise PlancheAnimeeRefusee(
                "aucun jeu ouvert pour retrouver cette carte"
            )
        objet = self.atelier.univers.carte(identifiant_projet, carte)
        if objet.genre != IMAGE:
            raise PlancheAnimeeRefusee("une carte texte ne s'anime pas")
        octets, _ = self.atelier.univers.octets(identifiant_projet, carte)
        return _Source(
            identifiant=objet.identifiant,
            label=objet.note or objet.source or "Carte découpée",
            largeur=objet.largeur,
            hauteur=objet.hauteur,
            projet=objet.projet,
            personnage=None,
            pose=None,
            octets=octets,
            quoi="carte",
        )

    def _livrer(
        self,
        cases: Sequence[bytes],
        *,
        projet: str | None,
        personnage: str | None,
        pose: str | None,
        direction: str | None,
        directions: Sequence[str] | None,
        nom: str,
        cadence: float,
        sens: str,
        modele: str,
        nature: str,
        demande: dict[str, Any],
        provenance: str,
    ) -> dict[str, Any]:
        """Le dernier pas, commun aux trois chemins : un clip, et ses bandes.

        **Écrit une fois, appelé trois fois** — depuis une feuille, depuis une
        carte, depuis une sélection d'images (`RP21`). Ce qui distingue les
        trois s'est déjà décidé chez l'appelant : les images à écrire, le
        modèle et la nature du clip, ce que porte sa demande.
        """
        parts = self._parts(len(cases), directions, direction)
        if cadence <= 0:
            raise PlancheAnimeeRefusee("une cadence nulle serait une animation qui ne tourne pas")
        if sens not in SENS:
            raise PlancheAnimeeRefusee(f"sens inconnu : {sens}")

        identifiant = uuid.uuid4().hex[:12]
        dossier = self.atelier.fichiers.dossier_images_clip(identifiant, 0)
        for numero, octets in enumerate(cases):
            # Quatre chiffres, comme le décodeur vidéo les écrit : l'ordre
            # alphabétique du disque doit être l'ordre de l'animation, sans quoi
            # l'image 10 se range avant la 2 et la marche part à l'envers.
            self.atelier.fichiers._poser(dossier / f"{numero:04d}.png", octets)

        generation = Generation(
            identifiant=identifiant,
            modele=modele,
            demande=demande,
            parametres_resolus={"modele": modele},
            emplacements=[Emplacement(rang=0, statut=Statut.REUSSIE, unite="images")],
            cree_le=time.time(),
            projet=projet,
            personnage=personnage,
            pose=pose,
            direction=direction,
            provenance=provenance,
            clip=Clip(
                nature=nature,
                images=len(cases),
                cadence=float(cadence),
                secondes=max(1, round(len(cases) / (cadence or 1))),
                prix_annonce=0,
                prix_formule=(
                    "Feuille découpée · aucun appel"
                    if nature == PLANCHE
                    else "Images assemblées · aucun appel"
                ),
            ),
        )
        self.atelier.fichiers.ecrire_enregistrement(identifiant, generation.en_json())
        self.atelier.base.enregistrer(generation)
        self.atelier.diffusion.publier("generation", generation.en_json())

        bandes = [
            self.atelier.montage.garder(
                identifiant,
                self._nom_de_bande(nom, part["direction"], len(parts)),
                part["images"],
                cadence=float(cadence),
                sens=sens,
                # **Le cadre du clip, et pas celui de la bande.** Une fenêtre par
                # clip cale les bandes entre elles ; une fenêtre par bande ferait
                # grandir le personnage de dix pour cent en passant d'une
                # direction à l'autre. C'est le défaut mesuré le 3 septembre 2026,
                # et c'est pour lui que le défaut du cadre est ce qu'il est.
                cadre=None,
                personnage=personnage,
                pose=pose,
                direction=part["direction"],
            )
            for part in parts
        ]
        return {"clip": generation.en_json(), "bandes": [b.en_json() for b in bandes]}

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _parts(
        self,
        total: int,
        directions: Sequence[str] | None,
        direction: str | None,
    ) -> list[dict[str, Any]]:
        """Les images de chaque bande, dans l'ordre des lignes de la feuille.

        **Un partage inégal est un refus, pas un arrondi.** Treize cases sur
        quatre directions veut dire que la feuille n'est pas celle qu'on croit —
        un rectangle de trop, une ligne incomplète —, et découper quand même
        rangerait la marche vers l'est dans la case du nord sans rien dire.

        Sans lignes nommées, la feuille entière fait une animation, et elle
        prend la direction de l'appel — celle que l'auteur a choisie au-dessus
        du bouton. C'est le cas d'une feuille d'une seule direction, qui est
        celui de la plupart des feuilles trouvées en ligne.
        """
        if not directions:
            return [{"direction": direction, "images": list(range(total))}]
        lignes = len(directions)
        if total % lignes:
            raise PlancheAnimeeRefusee(
                f"{total} cases ne se partagent pas en {lignes} directions — "
                "chaque direction doit avoir le même nombre d'images"
            )
        par_ligne = total // lignes
        return [
            {
                "direction": direction,
                "images": list(range(rang * par_ligne, (rang + 1) * par_ligne)),
            }
            for rang, direction in enumerate(directions)
        ]

    @staticmethod
    def _nom_de_bande(nom: str, direction: str | None, combien: int) -> str:
        """Le nom que porte la bande. **La direction n'y entre que si elle départage.**

        Une seule bande garde le nom que l'auteur a écrit, intact. Quatre
        bandes issues du même geste porteraient le même nom à la lettre, et la
        matrice du personnage montrerait quatre lignes indiscernables.
        """
        if combien <= 1 or not direction:
            return nom
        return f"{nom} · {direction}"
