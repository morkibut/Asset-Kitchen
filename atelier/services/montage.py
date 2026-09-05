# -*- coding: utf-8 -*-
"""Le montage — **un clip payé devient plusieurs bandes utilisables**.

Arrivé en A10 (V3), et c'est le cœur de la version. Tout le reste amène ici :
`A6` écrit le mouvement, `A9` commande le clip et l'attend, `A2` sait recadrer
plusieurs images sur une seule fenêtre. Ce service-ci est celui qui rend le clip
utile.

**Il ne dépense rien, et c'est structurel** : ni catalogue, ni fournisseur, ni
animateur dans ses imports. Le clip est déjà payé, ses images sont déjà sur le
disque depuis son arrivée, et découper est un geste qu'on refait autant de fois
qu'on veut. C'est la même privation que le slicer et les deux fabriques — et
c'est elle qui autorise la phrase du pied de l'écran.

**Un clip de cent vingt images se détoure une fois, pas à chaque ouverture.**
Le plan l'avait chiffré avant que la tranche ne s'ouvre : détourer et mesurer
les images d'un clip prend une vingtaine de secondes — *acceptable une fois,
insupportable à chaque cran de curseur*. Ce qui coûte cher est donc calculé une
seule fois et écrit à côté du clip : la fenêtre commune et les deux propositions
de rythme. Ce qui est bon marché — monter huit images retenues — se refait à
chaque geste, et c'est ce qui rend l'aperçu vivant.

**Ce qu'on garde est une intention, jamais des pixels.** Une bande porte les
numéros d'image, la fenêtre et la recette ; sa planche de sprites est un cache,
effaçable sans rien perdre. Changer la palette du jeu six mois plus tard refait
toutes les bandes, comme il refait toutes les images — règle 5 de
`docs/ARCHITECTURE.md`, sans exception ici.
"""

from __future__ import annotations

import base64
import json
import time
import uuid
from pathlib import Path
from typing import Any, Sequence

import numpy as np

from atelier.depot import Base, Fichiers
from atelier.domaine.bande import (
    A_LA_MAIN,
    BOUCLE,
    CADENCE_PAR_DEFAUT,
    DE_LA_BANDE,
    DU_CLIP,
    SENS,
    Bande,
    Cadre,
    Prise,
)
from atelier.domaine.erreurs import ErreurAtelier, GenerationInconnue
from atelier.domaine.generation import Generation
from atelier.domaine.projet import IMAGE_SEULE
from atelier.domaine.recette import Recette
from atelier.image import clip as decodeur
from atelier.image.bande import (
    Fenetre,
    Planche,
    assembler,
    en_png,
    fenetre_commune,
    preparer,
)
from atelier.image.rythme import lire as lire_le_rythme
from atelier.image.traitement import avant_la_grille, detourer
from atelier.services.evenements import Diffusion

# Le nom du fichier où l'étude d'un clip se garde, à côté de ses images. **Une
# étude, pas un réglage** : elle ne porte rien que l'auteur ait décidé, tout s'y
# recalcule, et l'effacer ne coûte qu'une attente.
ETUDE = "montage.json"

# Le côté d'une case de la planche contact — l'image unique où toutes les images
# du clip tiennent, et dont l'écran tire à la fois sa pellicule et sa loupe.
# **Une seule image plutôt que cent vingt** : à quatre-vingt-seize pixels, un
# clip entier pèse moins qu'une seule de ses images d'origine, et la pellicule
# n'attend rien.
CONTACT_COTE = 96
CONTACT_COLONNES = 16

# Ce qu'une bande peut porter au plus. **Une borne de sécurité, pas un avis sur
# l'animation** : une bande de cent vingt images est un clip qu'on n'a pas
# découpé, et la planche de sprites qui en sortirait ferait dix mille pixels de
# large.
IMAGES_MAX = 64


class ServiceMontage:
    """Ouvrir un clip, en tailler des bandes, les garder.

    Il lit les images d'un clip, la recette de son jeu et le plan de poses ; il
    écrit des bandes. Il ne touche ni aux assets, ni aux générations : découper
    un clip ne change rien à ce qui a été payé.
    """

    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        assets: Any,
        production: Any,
        diffusion: Diffusion | None = None,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._assets = assets
        self._production = production
        self._diffusion = diffusion

    # ── Ouvrir un clip ───────────────────────────────────────────────────────

    def ouvrir(self, identifiant: str) -> dict[str, Any]:
        """Tout ce que l'écran de montage demande, **en un seul aller-retour**.

        Un écran qui s'ouvre en tournant déjà en boucle n'a pas le temps de
        poser quatre questions : il lui faut le compte d'images, la cadence, la
        recette du jeu, la fenêtre commune, les deux propositions et les bandes
        déjà gardées, tout de suite. Les demander séparément ferait quatre
        états d'attente à l'écran pour un seul geste de l'auteur.
        """
        generation = self._clip(identifiant)
        clip = generation.clip
        images = self._images(identifiant)
        if not images:
            raise ErreurAtelier(
                clip.extraction_refus
                or "ce clip ne porte aucune image — rien à découper"
            )

        recette = self.recette_du_jeu(generation)
        etude = self._etude(generation, recette, images)
        bandes = self._base.bandes_du_clip(identifiant)

        cadence = clip.cadence or decodeur.CADENCE_PAR_DEFAUT
        largeur, hauteur = self._taille(images[0])
        return {
            "clip": {
                "identifiant": identifiant,
                # **Le compte du disque, pas celui du fichier vidéo**, et pour
                # la raison qui vaut partout ailleurs : ce qui a été demandé ne
                # fait pas foi, ce qui est là fait foi. Un clip dont une image
                # n'a pas pu s'écrire en porte une de moins, et le montage doit
                # travailler sur celles qui existent.
                "images": len(images),
                "cadence": cadence,
                "largeur": largeur,
                "hauteur": hauteur,
                "secondes": round(len(images) / cadence, 2) if cadence else 0.0,
                "commande_secondes": clip.secondes,
                "montant_dit": clip.montant_dit,
                "consomme": generation.consomme,
                "unite": generation.unite,
                "mouvement": generation.demande.get("mouvement") or "",
                "texte": generation.demande.get("prompt") or "",
                "projet": generation.projet,
                "personnage": generation.personnage,
                "pose": generation.pose,
                "direction": generation.direction,
            },
            "contact": {
                "cote": CONTACT_COTE,
                "colonnes": CONTACT_COLONNES,
                "lignes": (len(images) + CONTACT_COLONNES - 1) // CONTACT_COLONNES,
            },
            "recette_du_jeu": recette.en_json(),
            "fenetre": etude["fenetre"],
            "propositions": etude["propositions"],
            "bandes": [b.en_json() for b in bandes],
            "prix": self._prix(generation, len(bandes)),
            "images_max": IMAGES_MAX,
        }

    def recette_du_jeu(self, generation: Generation) -> Recette:
        """Ce que le jeu ferait de ces images-là. **Le point de départ, jamais une prison.**

        La règle a changé de forme le 3 septembre 2026, sur demande de l'auteur :
        le projet donne la taille du pixel, la palette et le détourage ; la bande
        part de là, et ce que l'auteur change sur l'écran de montage s'écrit *sur
        la bande*. Ce qui reste de l'ancienne règle en est le fond — **une bande
        qui s'écarte de son jeu le dit**, en clair, à côté du chiffre changé.

        **L'échelle se prend sur le personnage, pas sur la demande.** Une
        commande de clip ne porte pas d'échelle : elle nomme un personnage, et
        c'est le type de ce personnage qui dit à quelle taille son espèce vit
        dans ce jeu. Sans personnage — un clip commandé hors de toute fiche —, on
        retombe sur la recette que le projet applique à ce qui entre, ce qui est
        la bonne réponse par défaut et non un pis-aller.
        """
        if not generation.projet:
            return Recette()
        objet = self._base.lire_projet(generation.projet)
        if objet is None:
            return Recette()
        type_du_sujet = ""
        if generation.personnage:
            try:
                personnage = self._production.personnage(
                    generation.projet, generation.personnage
                )
                type_du_sujet = personnage.type
            except ErreurAtelier:
                type_du_sujet = ""
        return objet.univers.recette_de(
            objet.univers.echelle(type_du_sujet), IMAGE_SEULE
        )

    # ── La planche contact ───────────────────────────────────────────────────

    def contact(self, identifiant: str) -> bytes:
        """Toutes les images du clip en une seule, en grille.

        **L'écran en tire deux choses d'un même fichier** : la pellicule, en
        prenant une tranche au centre de chaque case, et la loupe, en montrant
        la case entière. Servir cent vingt images de 480 pixels pour dessiner une
        pellicule de sept pixels de large aurait fait payer vingt mégaoctets un
        ruban qu'on survole.

        Écrite à côté du clip la première fois, relue ensuite : un clip ne change
        jamais, donc sa planche contact non plus.
        """
        chemin = self._dossier(identifiant) / "contact.png"
        if chemin.is_file():
            return chemin.read_bytes()

        from PIL import Image

        images = self._images(identifiant)
        if not images:
            raise ErreurAtelier("ce clip ne porte aucune image")
        lignes = (len(images) + CONTACT_COLONNES - 1) // CONTACT_COLONNES
        planche = Image.new(
            "RGBA",
            (CONTACT_COLONNES * CONTACT_COTE, lignes * CONTACT_COTE),
            (0, 0, 0, 0),
        )
        for rang, fichier in enumerate(images):
            with Image.open(fichier) as brute:
                case = brute.convert("RGBA").resize(
                    (CONTACT_COTE, CONTACT_COTE), Image.LANCZOS
                )
            planche.paste(
                case,
                (
                    (rang % CONTACT_COLONNES) * CONTACT_COTE,
                    (rang // CONTACT_COLONNES) * CONTACT_COTE,
                ),
            )
        chemin.parent.mkdir(parents=True, exist_ok=True)
        planche.save(chemin, format="PNG")
        return chemin.read_bytes()

    # ── L'aperçu, refait à chaque geste ──────────────────────────────────────

    def apercu(
        self,
        identifiant: str,
        images: Sequence[int],
        recette: Recette | None = None,
        cadre: Cadre | None = None,
        prises: Sequence[Prise] | None = None,
    ) -> dict[str, Any]:
        """La bande montée, **sans rien écrire** : ce que la droite de l'écran montre.

        `prises` passe avant `images` depuis `A7` : c'est la forme riche, celle
        qui sait d'où vient chaque image et de combien elle est poussée. Les deux
        cohabitent parce que l'écran de montage, lui, ne connaît que des numéros
        — il taille dans un seul clip et ne corrige rien.

        Elle repart en `data:` plutôt que par une adresse, pour la raison déjà
        écrite de l'aperçu de superposition : un aperçu n'existe nulle part sur
        le disque, et lui donner une adresse obligerait à ranger un brouillon —
        donc à le nettoyer.

        **C'est une planche de sprites, et pas une liste d'images.** L'écran
        l'anime en la décalant ; l'export l'écrira telle quelle. Le critère
        *ce qui sort est exactement ce que l'aperçu montrait* devient alors vrai
        par construction, et non par discipline.
        """
        generation = self._clip(identifiant)
        recette = recette if recette is not None else self.recette_du_jeu(generation)
        cadre = cadre or Cadre()
        gardees = (
            list(prises)
            if prises is not None
            else [Prise(numero=int(n)) for n in images]
        )
        retenues = self._fichiers_des_prises(identifiant, gardees)

        preparees = [
            preparer(fichier.read_bytes(), recette) for fichier in retenues
        ]
        fenetre = self._fenetre(generation, recette, cadre, preparees)
        planche = assembler(
            preparees,
            recette,
            fenetre,
            poussees=[(p.dx, p.dy) for p in gardees],
        )

        return {
            "planche": "data:image/png;base64,"
            + base64.b64encode(planche.octets).decode("ascii"),
            **planche.en_json(),
            "fenetre": fenetre.en_json() if fenetre else None,
            "cadre": cadre.en_json(),
            "ecarts": self._ecarts(generation, recette),
            **self._sujet(preparees, recette),
        }

    @staticmethod
    def _sujet(
        preparees: Sequence[np.ndarray], recette: Recette
    ) -> dict[str, Any]:
        """La **première image seule**, détourée, sans cadre autour d'elle.

        Elle part avec l'aperçu parce que l'écran en a besoin pour une chose que
        l'aperçu ne peut pas faire : montrer le cadre **pendant qu'on le tire**.
        Redemander une image au serveur à chaque pixel de glissement rendrait le
        geste impossible ; avec le sujet en main, l'écran repose lui-même le
        rectangle autour de lui, et n'attend le serveur qu'au relâchement.

        `ancrage` voyage avec, et ce n'est pas un détail : c'est la règle qui dit
        où le sujet se pose dans son cadre — sur ses pieds, ou au milieu. La
        poser deux fois, une ici et une à l'écran, ferait dériver le rectangle
        qu'on tire de la bande qui en sortira.
        """
        if not preparees:
            return {"sujet": None, "sujet_largeur": 0, "sujet_hauteur": 0}
        image = preparees[0]
        return {
            "sujet": "data:image/png;base64,"
            + base64.b64encode(en_png(image)).decode("ascii"),
            "sujet_largeur": int(image.shape[1]),
            "sujet_hauteur": int(image.shape[0]),
            "ancrage": recette.grille.ancrage if recette.grille else "bas",
        }

    # ── Garder, ranger, oublier ──────────────────────────────────────────────

    def garder(
        self,
        identifiant: str,
        nom: str,
        images: Sequence[int],
        *,
        cadence: float = CADENCE_PAR_DEFAUT,
        sens: str = BOUCLE,
        cadre: Cadre | None = None,
        recette: Recette | None = None,
        pose: str | None = None,
        direction: str | None = None,
    ) -> Bande:
        """Une bande de plus, taillée dans ce clip. **Rien n'est dépensé.**

        **Sans case visée, c'est un brouillon**, et un brouillon ne bloque rien.
        On garde d'abord et on range ensuite — c'est l'enchaînement que le
        produit emploie partout, et il évite de poser une question au moment où
        l'on découpe pour voir.
        """
        generation = self._clip(identifiant)
        retenues = self._retenues(identifiant, images)
        propre = nom.strip()
        if not propre:
            raise ErreurAtelier("une bande se garde sous un nom — celui de l'animation")
        if cadence <= 0:
            raise ErreurAtelier("une cadence nulle serait une bande qui ne tourne pas")
        if sens not in SENS:
            raise ErreurAtelier(f"sens inconnu : {sens}")

        recette = recette if recette is not None else self.recette_du_jeu(generation)
        cadre = cadre or Cadre()
        preparees = [
            preparer(fichier.read_bytes(), recette) for fichier in retenues
        ]
        fenetre = self._fenetre(generation, recette, cadre, preparees)
        planche = assembler(preparees, recette, fenetre)

        bande = Bande(
            identifiant=uuid.uuid4().hex[:12],
            clip=identifiant,
            nom=propre,
            # Toutes du clip qu'on découpe, et aucune poussée : c'est le geste
            # d'`A10`, inchangé. Ce qu'`A7` ajoute se pose **après**, sur la
            # bande gardée, et jamais au moment où on la taille.
            prises=tuple(Prise(numero=int(n)) for n in images),
            cadence=float(cadence),
            sens=sens,
            cadre=self._cadre_pose(cadre, fenetre),
            recette=recette,
            projet=generation.projet,
            personnage=generation.personnage,
            pose=pose,
            direction=direction,
            case_largeur=planche.case_largeur,
            case_hauteur=planche.case_hauteur,
        )
        bande.planche = self._fichiers.ecrire_planche_de_bande(
            identifiant, bande.identifiant, planche.octets
        )
        self._sauver(bande)
        return bande

    def bandes(self, clip: str) -> list[Bande]:
        return self._base.bandes_du_clip(clip)

    def bande(self, identifiant: str) -> Bande:
        bande = self._base.lire_bande(identifiant)
        if bande is None:
            raise ErreurAtelier(f"bande inconnue : {identifiant}")
        return bande

    def renommer(self, identifiant: str, nom: str) -> Bande:
        propre = nom.strip()
        if not propre:
            raise ErreurAtelier("une bande se garde sous un nom — celui de l'animation")
        bande = self.bande(identifiant)
        bande.nom = propre
        self._sauver(bande)
        return bande

    def affecter(
        self, identifiant: str, pose: str | None, direction: str | None = None
    ) -> Bande:
        """La case du plan de poses que cette bande remplit — ou plus aucune.

        **Retirer une bande d'une case ne la supprime pas** : elle redevient un
        brouillon, elle reste dans son clip, et elle se réaffecte. C'est la règle
        d'`A12` écrite ici parce que c'est ici qu'elle s'applique, et non à
        l'écran qui la déclenchera.
        """
        bande = self.bande(identifiant)
        bande.pose = pose or None
        bande.direction = direction or None
        self._sauver(bande)
        return bande

    def oublier(self, identifiant: str) -> Bande:
        """La bande s'en va, **le clip et ses images restent**.

        Un découpage raté ne coûte rien : c'est toute la différence avec ce qui
        se passe de l'autre côté de l'atelier, où jeter une image est jeter de
        l'argent. Ici on a payé le clip, une fois, et on recommence.
        """
        bande = self.bande(identifiant)
        self._base.oublier_bande(identifiant)
        self._fichiers.oublier_bande(bande.clip, identifiant)
        self._annoncer(bande, oubliee=True)
        return bande

    # ── Prélever une image du clip (A13) ─────────────────────────────────────

    def prelevement(self, clip: str, numero: int) -> dict[str, Any]:
        """Tout ce qu'il faut pour faire entrer une image du clip en bibliothèque.

        ⚠️ **Il prépare, il ne fait pas entrer.** C'est délibéré, et c'est ce qui
        garde vraie la phrase du pied de l'écran de montage — *rien ici ne
        dépense*. Ce service n'a ni catalogue, ni fournisseur, ni animateur, et
        lui donner celui qui fait naître les images ferait rentrer tout ça par la
        porte de derrière. **C'est la route qui compose**, comme celle du
        tableau de bord d'un personnage : elle demande ici ce qu'on sait du clip,
        et là-bas de faire entrer.

        Ce qu'il rend, et pourquoi chacun des quatre :

        - `octets` — l'image telle qu'elle est sortie du clip, **jamais
          retouchée** : la chaîne du jeu s'appliquera par-dessus, et l'image
          brute reste sur le disque comme pour n'importe quelle entrée.
        - `nom` — de quoi la reconnaître dans une grille de deux cents vignettes.
        - `echelle` — le type du personnage du clip, donc **la taille à laquelle
          son espèce vit dans ce jeu**. Sans lui, une image prélevée sur un nain
          reviendrait à la taille par défaut du projet.
        - `filiation` — de quel clip, quelle image, et **quelle génération l'a
          payé**. C'est le seul endroit qui gardera que cette image-ci ne se
          relance pas mais qu'elle est venue de quelque chose qui a coûté.
        """
        generation = self._clip(clip)
        toutes = self._images(clip)
        if not 0 <= int(numero) < len(toutes):
            raise ErreurAtelier(
                generation.clip.extraction_refus
                or f"ce clip ne porte pas d'image numéro {numero} — "
                f"il en a {len(toutes)}"
            )
        type_du_sujet = ""
        if generation.projet and generation.personnage:
            try:
                personnage = self._production.personnage(
                    generation.projet, generation.personnage
                )
                type_du_sujet = personnage.type
            except ErreurAtelier:
                type_du_sujet = ""
        mouvement = str(generation.demande.get("mouvement") or "") or "clip"
        return {
            "octets": toutes[int(numero)].read_bytes(),
            "nom": f"{mouvement} — image {numero}",
            "projet": generation.projet,
            "echelle": type_du_sujet,
            "filiation": {
                "clip": clip,
                "image": int(numero),
                # **Le clip *est* la génération qui l'a payé**, et c'est écrit
                # ici plutôt que deviné : le jour où un clip naîtra autrement,
                # cette ligne sera le seul endroit à changer.
                "generation": clip,
                "modele": generation.modele,
                "mouvement": generation.demande.get("mouvement") or "",
                "personnage": generation.personnage,
            },
        }

    def planche(self, identifiant: str) -> bytes:
        """La planche de sprites de cette bande, **recalculée si le cache a sauté**.

        C'est ce que « le rendu est un cache » veut dire concrètement : effacer
        le fichier ne perd rien, il revient de la fiche — les numéros d'image, la
        fenêtre et la recette suffisent à le refaire.
        """
        bande = self.bande(identifiant)
        if bande.planche and self._fichiers.existe(bande.planche):
            return self._fichiers.lire(bande.planche)
        planche = self._planche_de(bande)
        bande.planche = self._fichiers.ecrire_planche_de_bande(
            bande.clip, identifiant, planche.octets
        )
        bande.case_largeur = planche.case_largeur
        bande.case_hauteur = planche.case_hauteur
        self._sauver(bande)
        return planche.octets

    def _planche_de(self, bande: Bande) -> Planche:
        """La planche d'une bande gardée, **refaite à partir de sa seule fiche**.

        Un seul endroit, parce qu'`A7` en a désormais trois usages : rebâtir un
        cache effacé, rouvrir une animation, et rejouer une correction. Trois
        écritures de la même chaîne finiraient par ne plus rendre les mêmes
        pixels, et c'est l'auteur qui découvrirait l'écart entre ce qu'il corrige
        et ce qu'il exporte.

        **Chaque image est préparée et finie avec sa recette à elle quand elle en
        a une** (V3.03.1) : une frame qui change de détourage change ses pixels,
        pas celle de sa voisine — seule la fenêtre et la palette restent de la
        bande (`atelier/image/bande.py`).
        """
        retenues = self._fichiers_des_prises(bande.clip, bande.prises)
        recettes, individuelles = self._recettes_de(bande)
        preparees = [
            preparer(fichier.read_bytes(), recette_la)
            for fichier, recette_la in zip(retenues, recettes)
        ]
        fenetre = (
            None
            if bande.cadre.vide
            else Fenetre(*bande.cadre.en_tuple(), images=bande.compte)
        )
        return assembler(
            preparees,
            bande.recette,
            fenetre,
            poussees=[(p.dx, p.dy) for p in bande.prises],
            recettes=recettes,
            individuelles=individuelles,
        )

    def _recettes_de(self, bande: Bande) -> tuple[list[Recette], list[bool]]:
        """La recette de chaque frame, et **si elle en a une à elle** (V3.03.1).

        Le défaut est la recette de la bande — c'est ce qui rend une bande
        d'avant identique à elle-même. Le second membre est ce qui décide de la
        palette de la bande : une frame individuelle en sort, et retoucher
        ensuite *cette* frame ne rebouge plus la palette des autres.
        """
        recettes: list[Recette] = []
        individuelles: list[bool] = []
        for prise in bande.prises:
            individuelles.append(prise.recette is not None)
            recettes.append(prise.recette or bande.recette)
        return recettes, individuelles

    def _ecarts_de(self, bande: Bande) -> list[dict[str, Any]]:
        """Ce que chaque frame change à la recette de la bande, ou rien (V3.03.1).

        Une frame sans recette individuelle n'a rien à dire. Une frame qui en a
        une dit **les places qui diffèrent** — détourage, grille, couleurs, tout
        ce que l'écran nomme — et une seule phrase de plus, qui ne se devine pas :
        *la fenêtre commune a été mesurée avec la recette de la bande*, et une
        frame qui s'écarte peut déborder du rectangle. Ce qui ne s'écarte sur
        aucune place — une recette individuelle égale à celle de la bande — ne
        s'annonce pas : rien n'a changé, et une phrase dirait le contraire.

        Les mots viennent d'ici, pas de l'écran : deux endroits qui nommeraient
        les places de la recette finiraient par ne plus les nommer pareil.
        """
        # Les places dans l'ordre du traitement, et leur mot français.
        places = (
            ("passes", "détourage"),
            ("recadrage", "recadrage"),
            ("grille", "grille"),
            ("quantification", "quantification"),
            ("bords", "bords"),
            ("contours", "contours"),
            ("main", "la main"),
        )
        ecarts: list[dict[str, Any]] = []
        for prise in bande.prises:
            if prise.recette is None:
                ecarts.append({"places": (), "fenetre_davant": False})
                continue
            une = prise.recette.en_json()
            autre = bande.recette.en_json()
            differents = tuple(mot for cle, mot in places if une.get(cle) != autre.get(cle))
            ecarts.append(
                {"places": differents, "fenetre_davant": bool(differents)}
            )
        return ecarts

    # ── Rouvrir et corriger une animation gardée (A7) ────────────────────────

    def ouvrir_la_bande(self, identifiant: str) -> dict[str, Any]:
        """Tout ce qu'il faut pour **retravailler** une animation déjà gardée.

        > ### ⚠️ Une animation gardée était un cul-de-sac (réparé ici, `A7`)
        >
        > Le produit savait garder une bande avec tous ses réglages — le cadre,
        > la recette, la vitesse, le sens, ses images — et **ne savait pas la
        > rouvrir**. La vignette de la matrice remontait au *clip*, donc l'écran
        > repartait des réglages du jeu : corriger une virgule demandait de tout
        > refaire de mémoire. Trouvé à l'usage par l'auteur le 4 septembre 2026,
        > et c'est le préalable de toute la tranche — on ne reprend pas une image
        > d'une bande qu'on ne sait pas ouvrir.
        >
        > Ce que ça dit de plus général : **un objet qu'on sait écrire et pas
        > relire n'est pas fini**, et l'essai qui l'aurait vu est celui qui garde
        > puis rouvre, jamais celui qui garde et vérifie ce qu'il vient d'écrire.

        Elle rend la bande **et sa planche en `data:`**, pour la même raison que
        l'aperçu du montage : un écran qui s'ouvre en tournant déjà n'a pas le
        temps de poser deux questions.
        """
        bande = self.bande(identifiant)
        octets = self.planche(identifiant)
        clips = {
            venue: self._clip(venue).en_json()
            for venue in bande.clips
            if self._base.lire(venue) is not None
        }
        return {
            "bande": bande.en_json(),
            "planche": "data:image/png;base64,"
            + base64.b64encode(octets).decode("ascii"),
            "clips": clips,
            # Combien d'images chaque clip porte : c'est ce qui borne le choix
            # quand on remplace une image, et l'écran ne peut pas le deviner.
            "images_par_clip": {
                venue: len(self._images(venue)) for venue in clips
            },
            "cadre": self._etat_du_cadre(bande),
            "clips_voisins": self._clips_voisins(bande),
            # Ce que chaque frame change à la recette de la bande (V3.03.1).
            # Au même rang que les prises : l'écran lit le ruban sur le même
            # défilement, sans recalculer de comparaison qui finirait par ne
            # plus nommer les places pareil.
            "ecarts": self._ecarts_de(bande),
        }

    def _clips_voisins(self, bande: Bande) -> list[dict[str, Any]]:
        """Les clips où cette animation a le droit d'aller chercher une image.

        **Ceux du même personnage, et rien de plus large.** Le geste que la
        tranche rend possible est précis : *deux clips sont chacun bons à moitié,
        on prend une image dans l'un et une dans l'autre*. Deux clips du même
        personnage ont la même silhouette, donc leurs images se montent ensemble ;
        le clip d'un autre personnage donnerait une animation où le sujet change
        au milieu, et l'offrir serait tendre un piège.

        Ils partent avec l'animation plutôt qu'à la demande, pour la raison déjà
        écrite au-dessus : un écran qui s'ouvre en tournant déjà n'a pas le temps
        de poser deux questions.
        """
        siens = set(bande.clips)
        voisins: list[dict[str, Any]] = []
        for generation in self._base.recentes(200):
            clip = generation.clip
            if clip is None or clip.jete or not clip.images:
                continue
            sien = generation.identifiant in siens
            if not sien and generation.personnage != bande.personnage:
                continue
            voisins.append(
                {
                    "identifiant": generation.identifiant,
                    "mouvement": str(generation.demande.get("mouvement") or ""),
                    "images": clip.images,
                    # Ce que l'écran met en tête de sa liste. Le calculer ici
                    # plutôt qu'à l'écran : « les clips de cette animation » est
                    # une notion du serveur, et deux définitions divergeraient.
                    "sien": sien,
                }
            )
        return voisins

    def _etat_du_cadre(self, bande: Bande) -> dict[str, Any]:
        """Ce que l'écran doit savoir dire de la fenêtre gardée — **et rien de plus**.

        Une fenêtre mesurée avec un autre détourage n'est pas fausse : elle est
        *d'avant*. La différence compte, parce que la reprendre coûte une
        vingtaine de secondes et que personne ne doit les payer sans raison.

        Trois cas, et ils ne se traitent pas pareil :

        - **posée à la main**, ce sont les quatre nombres de l'auteur, et rien ne
          les périme ;
        - **prise sur la bande**, elle se remesure sur ses seules images ;
        - **prise sur le clip**, elle se compare à l'étude du clip — celle-ci
          porte l'empreinte de la recette avec laquelle elle a été mesurée.

        Une bande à deux clips a besoin des deux études : il suffit qu'**une**
        soit d'avant pour que la fenêtre le soit.
        """
        if bande.cadre.choix == A_LA_MAIN:
            return {"choix": bande.cadre.choix, "a_jour": True, "mesuree_le": None}
        empreinte = bande.recette.empreinte()
        etudes = [self._lire_etude(venue) or {} for venue in bande.clips]
        dates = [e.get("mesuree_le") for e in etudes if e.get("mesuree_le")]
        return {
            "choix": bande.cadre.choix,
            # Sans étude, on ne sait pas : on ne réclame pas vingt secondes pour
            # une fenêtre peut-être juste. C'est le même arbitrage que `_fenetre`.
            "a_jour": all(
                e.get("empreinte", empreinte) == empreinte for e in etudes
            ),
            "mesuree_le": max(dates) if dates else None,
        }

    def reprendre_le_cadre_de_la_bande(self, identifiant: str) -> Bande:
        """La fenêtre d'une animation gardée, remesurée **sur ses images à elle**.

        Pas sur celles du clip, et c'est le point de la méthode : depuis `A7`,
        une bande peut prendre ses images dans deux clips, et elle n'a alors de
        fenêtre dans ni l'un ni l'autre. Recadrer les images empruntées sur un
        rectangle mesuré sans elles laisserait dépasser un bras — invisible ici,
        visible dans le jeu.

        C'est ce que veut dire *jamais à moitié* : le rectangle et la planche
        sont refaits dans le même geste, et la bande ne passe jamais par un état
        où l'un est neuf et l'autre d'avant.

        Le cadre posé à la main n'est pas repris — ce sont les quatre nombres de
        l'auteur, et les remesurer serait les effacer.
        """
        bande = self.bande(identifiant)
        if bande.cadre.choix == A_LA_MAIN:
            raise ErreurAtelier(
                "ce cadre a été posé à la main — le remesurer l'effacerait"
            )

        fenetre: Fenetre | None = None
        if bande.cadre.choix == DU_CLIP:
            # « Du clip » veut dire *toutes les bandes de ce clip ont la même
            # assise* : on remesure donc l'étude, pour que les autres bandes en
            # profitent, et on réunit les clips que celle-ci emprunte.
            for venue in bande.clips:
                etude = self._mesurer(
                    self._clip(venue), bande.recette, self._images(venue)
                )
                self._ecrire_etude(venue, etude)
                du_clip = Fenetre.depuis_json(etude.get("fenetre"))
                fenetre = du_clip if fenetre is None else fenetre.avec(du_clip)
        else:
            fichiers = self._fichiers_des_prises(bande.clip, bande.prises)
            preparees = [
                preparer(fichier.read_bytes(), bande.recette) for fichier in fichiers
            ]
            fenetre = fenetre_commune(preparees, bande.recette)

        return self.corriger(
            identifiant, cadre=self._cadre_pose(bande.cadre, fenetre)
        )

    def corriger(
        self,
        identifiant: str,
        *,
        prises: Sequence[Prise] | None = None,
        recette: Recette | None = None,
        cadence: float | None = None,
        sens: str | None = None,
        cadre: Cadre | None = None,
    ) -> Bande:
        """Une correction posée sur une bande gardée — **et rien d'autre ne bouge**.

        Chaque champ vaut *« ne touche pas à ça »* quand il est absent, et c'est
        ce qui rend le geste annulable au sens du critère : l'écran renvoie l'état
        d'avant, et la bande y revient exactement, y compris sa planche.

        ⚠️ **La planche est refaite ici, pas invalidée.** L'effacer et attendre
        que quelqu'un la redemande aurait marché, mais l'écran de la matrice
        affiche la vignette d'une bande sans passer par le montage : il l'aurait
        trouvée absente et l'aurait rebâtie lui-même, une fois par vignette.
        """
        bande = self.bande(identifiant)
        if sens is not None and sens not in SENS:
            raise ErreurAtelier(f"sens inconnu : {sens}")
        if cadence is not None and cadence <= 0:
            raise ErreurAtelier("une vitesse se compte en images par seconde")

        if prises is not None:
            # Le contrôle se fait **avant** d'écrire quoi que ce soit : une
            # correction refusée doit laisser la bande exactement comme elle
            # était, planche comprise.
            self._fichiers_des_prises(bande.clip, prises)
            bande.prises = tuple(prises)
        if recette is not None:
            bande.recette = recette
        if cadence is not None:
            bande.cadence = float(cadence)
        if sens is not None:
            bande.sens = sens
        if cadre is not None:
            bande.cadre = cadre

        planche = self._planche_de(bande)
        bande.planche = self._fichiers.ecrire_planche_de_bande(
            bande.clip, bande.identifiant, planche.octets
        )
        bande.case_largeur = planche.case_largeur
        bande.case_hauteur = planche.case_hauteur
        self._sauver(bande)
        return bande

    # ── Reprendre le cadre sur tout le clip ──────────────────────────────────

    def reprendre_le_cadre(
        self, identifiant: str, recette: Recette | None = None
    ) -> dict[str, Any]:
        """La fenêtre commune, remesurée sur **toutes** les images du clip.

        **Un geste que l'auteur demande**, jamais un rattrapage automatique, et
        pour une raison chiffrée : détourer et mesurer les images d'un clip prend
        une vingtaine de secondes. Le faire à chaque cran de curseur rendrait
        l'écran inutilisable ; le faire dans son dos ferait attendre l'auteur
        sans qu'il sache pourquoi.

        C'est aussi ce qui répond au cas du détourage changé : la fenêtre gardée
        a été prise avec une autre recette, l'écran le dit, et ce bouton la
        reprend.
        """
        generation = self._clip(identifiant)
        recette = recette if recette is not None else self.recette_du_jeu(generation)
        images = self._images(identifiant)
        etude = self._mesurer(generation, recette, images)
        self._ecrire_etude(identifiant, etude)
        return etude

    # ── Ce que la machine mesure une seule fois ──────────────────────────────

    def _etude(
        self, generation: Generation, recette: Recette, images: Sequence[Path]
    ) -> dict[str, Any]:
        """La fenêtre et les propositions, **relues si elles sont déjà là**.

        L'empreinte de la recette est écrite avec : une fenêtre mesurée avec un
        autre détourage n'est pas fausse, elle est *d'avant*, et l'écran doit
        pouvoir le dire plutôt que de la donner pour à jour. Recalculer d'office
        aurait fait payer vingt secondes à toute ouverture qui suit un réglage.
        """
        garde = self._lire_etude(generation.identifiant)
        if garde is not None:
            garde["a_jour"] = garde.get("empreinte") == recette.empreinte()
            return garde
        etude = self._mesurer(generation, recette, images)
        self._ecrire_etude(generation.identifiant, etude)
        return etude

    def _mesurer(
        self, generation: Generation, recette: Recette, images: Sequence[Path]
    ) -> dict[str, Any]:
        """Le calcul cher, et le seul du service : toutes les images détourées.

        Deux mesures en sortent, et **elles ne se prennent pas sur la même
        image** : la fenêtre commune se prend sur l'image *recadrée*, parce que
        c'est le système de coordonnées de la mise sur grille ; le rythme se
        prend sur l'image détourée mais **non recadrée**, parce que recadrer
        chaque image sur sa propre silhouette ramènerait le sujet au même endroit
        et ferait passer une marche pour un repos.
        """
        detourees = [detourer(recette, fichier.read_bytes()) for fichier in images]
        preparees = [avant_la_grille(image, recette) for image in detourees]
        fenetre = fenetre_commune(preparees, recette)
        cadence = (generation.clip.cadence if generation.clip else 0.0) or 0.0
        propositions = lire_le_rythme(detourees, cadence)
        return {
            "empreinte": recette.empreinte(),
            "a_jour": True,
            "mesuree_le": time.time(),
            "fenetre": fenetre.en_json() if fenetre else None,
            "propositions": [p.en_json() for p in propositions],
        }

    def _lire_etude(self, clip: str) -> dict[str, Any] | None:
        chemin = self._dossier(clip) / ETUDE
        if not chemin.is_file():
            return None
        try:
            contenu = json.loads(chemin.read_text(encoding="utf-8"))
        except (OSError, ValueError):  # pragma: no cover — fichier abîmé
            return None
        return contenu if isinstance(contenu, dict) else None

    def _ecrire_etude(self, clip: str, etude: dict[str, Any]) -> None:
        chemin = self._dossier(clip) / ETUDE
        chemin.parent.mkdir(parents=True, exist_ok=True)
        chemin.write_text(
            json.dumps(etude, indent=1, ensure_ascii=False), encoding="utf-8"
        )

    # ── Le cadre ─────────────────────────────────────────────────────────────

    def _fenetre(
        self,
        generation: Generation,
        recette: Recette,
        cadre: Cadre,
        preparees: Sequence[np.ndarray],
    ) -> Fenetre | None:
        """Le rectangle sur lequel cette bande se recadre, selon d'où on le prend.

        Les trois réponses sont d'ordre décroissant de portée, et le défaut est
        la plus large pour la raison mesurée en `A2` : une fenêtre par bande cale
        les images **d'une** bande entre elles, il faut une fenêtre par clip pour
        caler **les bandes** entre elles.
        """
        if cadre.choix == A_LA_MAIN and not cadre.vide:
            return Fenetre(*cadre.en_tuple(), images=len(preparees))
        if cadre.choix == DE_LA_BANDE:
            return fenetre_commune(preparees, recette)
        etude = self._lire_etude(generation.identifiant)
        gardee = Fenetre.depuis_json((etude or {}).get("fenetre"))
        if gardee is not None:
            return gardee
        # Le clip n'a pas encore été étudié — on ne fait pas attendre vingt
        # secondes pour un aperçu : la bande cale ses propres images, et l'écran
        # le dira à l'ouverture suivante, qui aura l'étude.
        return fenetre_commune(preparees, recette)

    @staticmethod
    def _cadre_pose(cadre: Cadre, fenetre: Fenetre | None) -> Cadre:
        """Le cadre tel qu'il sera **rejoué**, ses quatre nombres écrits dedans.

        Une bande gardée « du clip » ne garde pas *la référence* au clip : elle
        garde le rectangle. Sans quoi reprendre le cadre du clip six mois plus
        tard changerait, en silence, une bande déjà livrée dans un jeu.
        """
        if fenetre is None:
            return Cadre(choix=cadre.choix)
        return Cadre(
            choix=cadre.choix,
            gauche=fenetre.gauche,
            sommet=fenetre.sommet,
            droite=fenetre.droite,
            bas=fenetre.bas,
        )

    # ── Ce qui s'écarte du jeu ───────────────────────────────────────────────

    def _ecarts(self, generation: Generation, recette: Recette) -> list[str]:
        """Ce que cette recette change à celle du jeu, **en clair et par réglage**.

        C'est tout ce qui reste de la règle d'avant le 3 septembre 2026 — *la
        recette du projet est en lecture seule* —, et c'en était le fond : une
        bande qui s'écarte de son jeu le dit. Une phrase par écart, à côté du
        chiffre changé, plutôt qu'un avertissement global qui laisserait chercher
        lequel.
        """
        du_jeu = self.recette_du_jeu(generation)
        if recette.empreinte() == du_jeu.empreinte():
            return []
        dits: list[str] = []
        if (recette.grille is None) != (du_jeu.grille is None):
            dits.append(
                "la mise à la taille du jeu est retirée"
                if recette.grille is None
                else "cette bande est mise à la taille du jeu, pas le reste"
            )
        elif recette.grille is not None and du_jeu.grille is not None:
            if recette.grille.cible != du_jeu.grille.cible:
                dits.append(
                    f"{recette.grille.cible} px de haut au lieu de "
                    f"{du_jeu.grille.cible} px dans le jeu"
                )
            if recette.grille.occupation != du_jeu.grille.occupation:
                dits.append(
                    f"le sujet occupe {recette.grille.occupation} % de sa case "
                    f"au lieu de {du_jeu.grille.occupation} % dans le jeu"
                )
        maison = du_jeu.quantification
        ici = recette.quantification
        if (ici is None) != (maison is None):
            dits.append(
                "les couleurs ne sont plus réduites"
                if ici is None
                else "les couleurs sont réduites, ce que le jeu ne fait pas"
            )
        elif ici is not None and maison is not None and ici.couleurs != maison.couleurs:
            dits.append(
                f"{ici.couleurs} couleurs au lieu de {maison.couleurs} dans le jeu"
            )
        if len(recette.passes) != len(du_jeu.passes):
            dits.append(
                f"{len(recette.passes)} passe(s) de détourage au lieu de "
                f"{len(du_jeu.passes)}"
            )
        elif recette.passes and du_jeu.passes:
            ici_p, maison_p = recette.passes[0], du_jeu.passes[0]
            if ici_p.moteur != maison_p.moteur:
                dits.append(
                    f"détourage « {ici_p.moteur} » au lieu de "
                    f"« {maison_p.moteur} » dans le jeu"
                )
            elif ici_p.tolerance != maison_p.tolerance:
                dits.append(
                    f"tolérance de détourage {ici_p.tolerance} au lieu de "
                    f"{maison_p.tolerance} dans le jeu"
                )
        if not dits:
            # L'empreinte diffère sans qu'aucun des réglages nommés ne bouge :
            # on le dit plutôt que de rendre une liste vide, qui affirmerait
            # « rien ne s'écarte » alors que quelque chose s'écarte.
            dits.append("cette bande a une recette à elle")
        return dits

    # ── Le prix par bande ────────────────────────────────────────────────────

    def _prix(self, generation: Generation, bandes: int) -> dict[str, Any]:
        """Ce que coûte une bande utilisable de ce clip, **et il baisse**.

        *C'est ici que se prend le chiffre qui manque à la version.* Combien de
        clips pour une bande utilisable, personne ne le sait ; cet affichage-là
        le produit à l'usage, sans banc supplémentaire. Le montrer à côté du
        bouton qui garde est ce qui le rend visible au moment où il informe une
        décision.
        """
        paye = generation.consomme
        gardees = max(bandes, 0)
        par_bande = paye / gardees if gardees else paye
        # ⚠️ **Ce que « une de plus » veut dire quand il n'y en a aucune.**
        # Écrit `paye / (gardees + 1)`, il rendait le même chiffre que le prix
        # courant sur un clip neuf — l'écran promettait une baisse et n'en
        # montrait pas. Sans bande gardée, le prix affiché est déjà celui d'une
        # bande : la suivante est donc la **deuxième**, et c'est elle qu'on
        # chiffre. Vu au serveur avant le navigateur, le 4 septembre 2026.
        suivante = paye / (max(gardees, 1) + 1)
        return {
            "clip": paye,
            "unite": generation.unite,
            "bandes": gardees,
            "par_bande": par_bande,
            "si_une_de_plus": suivante,
        }

    # ── Les images du clip ───────────────────────────────────────────────────

    def _images(self, clip: str) -> list[Path]:
        dossier = self._fichiers.dossier_images_clip(clip, 0)
        return sorted(dossier.glob("[0-9]*.png"))

    @staticmethod
    def _taille(fichier: Path) -> tuple[int, int]:
        """La taille d'une image du clip, **sans la décoder**.

        Pillow lit l'en-tête et s'arrête ; l'écran a besoin de ces deux nombres
        pour dessiner le rectangle du cadre par-dessus une vignette, et les
        décoder pour les obtenir ferait payer une image entière à chaque
        ouverture.
        """
        from PIL import Image

        try:
            with Image.open(fichier) as image:
                return int(image.width), int(image.height)
        except OSError:  # pragma: no cover — fichier abîmé
            return 0, 0

    def _retenues(self, clip: str, images: Sequence[int]) -> list[Path]:
        """Les fichiers des images retenues d'**un seul** clip, dans l'ordre donné.

        L'ordre est celui de l'auteur et non celui du disque : une bande peut
        remonter le temps — un aller-retour écrit à la main —, et trier ici
        casserait le seul geste que la pellicule permet et qu'aucun réglage ne
        remplace.
        """
        return self._fichiers_des_prises(
            clip, [Prise(numero=int(n)) for n in images]
        )

    def _fichiers_des_prises(self, clip: str, prises: Sequence[Prise]) -> list[Path]:
        """Les fichiers des prises, **chacune allant chercher dans son clip** (A7).

        C'est le seul endroit du produit où une bande cesse d'appartenir à un
        clip unique, et c'est voulu : composer avec deux clips à moitié bons est
        le geste qu'`A7` rend possible. Une prise sans clip nommé prend celui de
        la bande — c'est ce qui fait qu'une bande d'`A10` se relit sans avoir été
        réécrite.

        ⚠️ **Les images de chaque clip sont listées une fois**, pas une fois par
        prise : une bande de vingt images sur deux clips ferait sinon vingt
        parcours de dossier là où deux suffisent, et ça se paierait à chaque
        frappe de l'auteur sur la correction au pixel.
        """
        if not prises:
            raise ErreurAtelier(
                "une bande garde au moins une image — prenez-en sur la pellicule"
            )
        if len(prises) > IMAGES_MAX:
            raise ErreurAtelier(
                f"une bande porte au plus {IMAGES_MAX} images ; "
                f"celle-ci en demande {len(prises)}"
            )

        connues: dict[str, list[Path]] = {}
        retenues: list[Path] = []
        for prise in prises:
            venue = prise.clip_ou(clip)
            if venue not in connues:
                # Un clip nommé par une prise doit exister : sans ce contrôle,
                # un identifiant mal tapé rendrait une liste vide, et l'erreur
                # parlerait d'un numéro d'image au lieu du clip introuvable.
                self._clip(venue)
                connues[venue] = self._images(venue)
            toutes = connues[venue]
            if not 0 <= prise.numero < len(toutes):
                ou = "ce clip" if venue == clip else f"le clip {venue}"
                raise ErreurAtelier(
                    f"{ou} ne porte pas d'image numéro {prise.numero} — "
                    f"il en a {len(toutes)}"
                )
            retenues.append(toutes[prise.numero])
        return retenues

    # ── Le clip lui-même ─────────────────────────────────────────────────────

    def _clip(self, identifiant: str) -> Generation:
        contenu = self._base.lire(identifiant)
        if contenu is None:
            raise GenerationInconnue(identifiant)
        if contenu.clip is None:
            raise ErreurAtelier("cette génération n'est pas un clip")
        return contenu

    def _dossier(self, clip: str) -> Path:
        return self._fichiers.dossier_images_clip(clip, 0).parent

    def _sauver(self, bande: Bande) -> None:
        """Le fichier d'abord, l'index ensuite. **Les fichiers font foi.**"""
        self._fichiers.ecrire_bande(bande.clip, bande.identifiant, bande.en_json())
        self._base.enregistrer_bande(bande)
        self._annoncer(bande)

    def _annoncer(self, bande: Bande, oubliee: bool = False) -> None:
        """Dire qu'une bande a bougé — **et c'est `A12` qui l'a rendu nécessaire**.

        Avant cette tranche, une bande ne se voyait que sur l'écran de montage,
        celui-là même qui venait de l'écrire : personne d'autre n'avait à
        l'apprendre. Le calque animé de la matrice change ça — on découpe un clip
        dans la galerie, et la case d'un personnage se remplit dans le codex,
        **deux écrans plus loin**. Sans cette annonce, la matrice serait restée
        juste jusqu'au prochain changement de projet.

        La charge porte la bande **entière**, comme une carte ou un asset ; et
        `oubliee` marque celle qui s'en va, exactement comme `oubliee` sur une
        carte et `coupe` sur un lien. L'écran ne rejoue jamais la règle : il lit
        le drapeau que le serveur pose.
        """
        if self._diffusion is None:
            return
        self._diffusion.publier("bande", {**bande.en_json(), "oubliee": oubliee})
