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

**Rien n'est dépensé.** L'image a été payée une fois, quand la feuille est
entrée ; la découper en cases ne rappelle personne.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Iterable, Sequence

from atelier.domaine.animation import Clip
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

# La nature du clip, lue par le montage pour ne pas proposer de lire une vidéo
# qui n'existe pas, et par la fiche pour écrire d'où il vient.
PLANCHE = "planche"

# **Aucune marge, et c'est la seule différence avec la découpe en images.** Là,
# un peu de fond autour d'un sprite ne gêne personne ; ici, il rendrait les
# cases de bord plus petites que les autres — elles sont rognées au bord de la
# feuille — et une animation dont les images n'ont pas la même taille tressaute.
MARGE_NULLE = 0


class PlancheAnimeeRefusee(ErreurAtelier):
    """La feuille ne peut pas devenir une animation, et on dit pourquoi."""

    code = "planche_animee_refusee"


class ServicePlancheAnimee:
    """D'une feuille et de ses rectangles : un clip, et ses bandes."""

    def __init__(self, atelier) -> None:
        self.atelier = atelier

    def animer(
        self,
        feuille: str,
        boites: Iterable[Boite],
        *,
        nom: str = "",
        personnage: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        directions: Sequence[str] | None = None,
        cadence: float = CADENCE_PAR_DEFAUT,
        sens: str = BOUCLE,
        acteur: str = "auteur",
    ) -> dict[str, Any]:
        """Les cases de cette feuille deviennent les images d'un clip neuf.

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
        asset = self.atelier.assets.lire(feuille)
        if asset is None:
            # **Le refus de la bibliothèque, pas un refus à nous.** Une feuille
            # inconnue est une image inconnue, et le produit ne dit pas deux
            # phrases différentes pour le même fait selon l'écran qui demande.
            raise AssetInconnu(feuille)

        # **Ce qui naît d'une feuille appartient à qui la feuille appartient**
        # (`AU20`). Le jeu l'a toujours fait — `projet=asset.projet`, plus bas —
        # et le sujet, lui, ne le faisait pas : une planche découpée sur la
        # fiche d'un personnage rendait une animation sans personnage, donc
        # invisible sur la fiche d'où on venait tout juste de la tirer. C'est le
        # trou mesuré le 13 septembre 2026, à l'identique de l'import.
        #
        # **Ce que l'appel dit l'emporte**, dans les deux sens : nommer un autre
        # sujet le range ailleurs, et une chaîne vide dit « aucun » — c'est ce
        # que l'écran envoie quand l'auteur choisit de ne rien rattacher.
        if personnage is None:
            personnage = asset.personnage
            if pose is None:
                pose = asset.pose
        personnage = personnage or None
        pose = pose or None

        rectangles = verifier_boites(boites, asset.largeur, asset.hauteur, quoi="feuille")
        parts = self._parts(len(rectangles), directions, direction)
        if cadence <= 0:
            raise PlancheAnimeeRefusee("une cadence nulle serait une animation qui ne tourne pas")
        if sens not in SENS:
            raise PlancheAnimeeRefusee(f"sens inconnu : {sens}")

        propre = nom.strip() or asset.label or "Feuille découpée"
        # **Découpée avant d'écrire quoi que ce soit.** Une feuille illisible ou
        # un rectangle impossible doit se refuser sans laisser un clip vide
        # derrière lui — la règle de l'import d'`AU18` : rien n'a été payé, donc
        # rien n'a de raison de rester.
        cases = decouper(self.atelier.fichiers.lire(asset.brut), rectangles, marge=MARGE_NULLE)

        identifiant = uuid.uuid4().hex[:12]
        dossier = self.atelier.fichiers.dossier_images_clip(identifiant, 0)
        for numero, octets in enumerate(cases):
            # Quatre chiffres, comme le décodeur vidéo les écrit : l'ordre
            # alphabétique du disque doit être l'ordre de l'animation, sans quoi
            # l'image 10 se range avant la 2 et la marche part à l'envers.
            self.atelier.fichiers._poser(dossier / f"{numero:04d}.png", octets)

        generation = Generation(
            identifiant=identifiant,
            modele=FEUILLE_DECOUPEE,
            # `feuille` porte la filiation et `boites` le découpage : les deux
            # vivent dans le `generation.json` et survivent donc à l'effacement
            # de l'index. Un clip doit pouvoir dire de quelle image il est né et
            # où il a coupé, six mois plus tard.
            demande={
                "prompt": propre,
                "source": asset.label,
                "feuille": asset.identifiant,
                "boites": [list(b) for b in rectangles],
            },
            parametres_resolus={"modele": FEUILLE_DECOUPEE, "feuille": asset.identifiant},
            emplacements=[Emplacement(rang=0, statut=Statut.REUSSIE, unite="images")],
            cree_le=time.time(),
            projet=asset.projet,
            personnage=personnage,
            pose=pose,
            direction=direction,
            provenance=acteur,
            clip=Clip(
                nature=PLANCHE,
                images=len(cases),
                cadence=float(cadence),
                secondes=max(1, round(len(cases) / (cadence or 1))),
                prix_annonce=0,
                prix_formule="Feuille découpée · aucun appel",
            ),
        )
        self.atelier.fichiers.ecrire_enregistrement(identifiant, generation.en_json())
        self.atelier.base.enregistrer(generation)
        self.atelier.diffusion.publier("generation", generation.en_json())

        bandes = [
            self.atelier.montage.garder(
                identifiant,
                self._nom_de_bande(propre, part["direction"], len(parts)),
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
