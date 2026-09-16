# -*- coding: utf-8 -*-
"""L'export — une sélection sort de l'atelier en une archive, avec son descriptif.

**Le seul geste du produit qui fasse sortir des images.** Tout le reste les fait
entrer — le fournisseur, le collage, la découpe — ou les range ; celui-ci les
pose ailleurs, dans un dossier que l'atelier ne connaît pas. C'est pour ça qu'il
emporte un descriptif : une fois dehors, un PNG ne sait plus d'où il vient.

**Ce qui part, c'est le rendu.** Celui qu'on voit, celui qui entre dans le jeu —
jamais le brut, qui reste ici. Le brut est ce qui permet de refaire le rendu, et
il n'a rien à faire dans un dossier de jeu : ce qui le rejoue, c'est l'atelier,
et le descriptif dit lequel — identifiant, recette, empreinte.

**Ce service n'appelle jamais le fournisseur**, et ça se lit dans ses imports :
exporter est du disque et du processeur, rien d'autre. C'est le cinquième critère
de la tranche — « l'export fonctionne réseau coupé » —, et il se prouve en
comptant les appels du double.

**Il n'annonce rien non plus.** Un export ne change aucun état de l'atelier :
rien n'est rangé, rien n'est jugé, rien n'est créé. Un service qui ne modifie
rien n'a rien à diffuser — c'est la raison pour laquelle il ne reçoit pas la
diffusion, pas un oubli.

⚠️ **Il n'écrit plus dans le dossier du jeu depuis `RP17`** (16 septembre 2026).
C5 lui avait donné une seconde sortie — poser les fichiers d'un personnage sur
le disque —, et B21 en a construit une troisième à côté, celle qui montre ses
fichiers avant de les écrire. Deux portes vers le même dossier, dont une sans
filet : la sienne est partie. Ce qui reste ici **fabrique** — le rendu d'une
image, sa fiche, les trois fichiers d'une animation — et rend des archives que
le navigateur télécharge. Celui qui pose dans le jeu est
`atelier/services/sortie.py`, et il est seul.

**Les fiches, elles, n'ont pas bougé** : `fiche_de_l_asset` et
`fiche_de_la_bande` sont écrites ici et lues par la sortie. Deux formats de
descriptif auraient divergé au premier champ ajouté d'un seul côté.

**Et il n'écrit pas une ligne de code de jeu.** Le descriptif dit ce qu'est
chaque fichier ; ce qu'on en fait — une ressource, une ligne de catalogue, un
atlas — appartient au jeu, que l'atelier ne connaît pas. Il ne fabrique pas non
plus d'arborescence : les fichiers sont posés **à plat** dans le dossier qu'on
lui nomme, parce qu'un sous-dossier inventé ici serait une structure imposée à
un jeu dont personne ici ne sait comment il range.
"""

from __future__ import annotations

import io
import json
import time
import zipfile
from dataclasses import dataclass
from typing import Any, Iterable, Sequence

from atelier.depot import Base
from atelier.domaine import aseprite
from atelier.domaine.asset import Asset
from atelier.domaine.bande import Bande
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.projet import repere
from atelier.image import mesurer, rendre_en_png
from atelier.image.bande import en_image_animee
from atelier.services.assets import ServiceAssets
from atelier.services.bibliotheque import ServiceBibliotheque
from atelier.services.montage import ServiceMontage
from atelier.services.production import ServiceProduction

# Le nom du descriptif, à la racine de l'archive. **Un seul**, et en JSON : le
# doubler d'une version lisible à l'œil créerait deux vérités sur le même lot,
# et c'est exactement ce qu'`AGENTS.md` interdit dans sa première phrase.
DESCRIPTIF = "descriptif.json"

# Ce que le descriptif déclare de lui-même, pour qui le relira dans six mois
# sans se souvenir d'où il vient. **Il ne bouge pas en C5** : une fiche qui gagne
# trois champs facultatifs se relit sans rien savoir d'eux, et un numéro qui
# changerait à chaque ajout n'apprendrait plus rien à personne.
FORMAT = 1

# Ce qu'un fichier est, dans le descriptif d'un personnage. **Trois mots, et le
# troisième est celui qu'on oublie** : une pièce qui agrandit la silhouette et
# revient à une autre échelle ne fabrique pas de calque — ce qui revient est
# gardé comme un **corps habillé**, la même image, entière, qui ne s'empile pas
# (US-148). L'annoncer « calque » ferait empiler un corps sur un corps, et
# l'agent n'aurait aucun moyen de s'en apercevoir avant de le voir à l'écran.
#
# **C'est la recette qui tranche**, jamais un drapeau : `Recette.calque` dit si
# une différence a été posée, et c'est la même question que l'écran pose pour
# afficher « ceci n'est pas un calque ».
CORPS = "corps"
CALQUE = "calque"
HABILLE = "corps_habille"

# Ce qui sort d'une bande, et sous quel suffixe (A4). Trois fichiers pour une
# animation, et pas un de plus : la planche, son fichier d'accompagnement, et
# l'image qui tourne toute seule. **Les deux premiers sont ce qu'un moteur
# charge ; le troisième est ce qu'on regarde** — sans rien installer, dans un
# navigateur ou une visionneuse.
ANIMEE = "-anime.png"


class ExportRefuse(ErreurAtelier):
    """Il n'y a rien à exporter, et on dit quoi.

    L'écran grise d'abord — « l'export d'une sélection vide » est nommément dans
    `docs/design-motifs.md` § Le grisé porte sa raison. Ce refus-ci est le filet, pas le
    chemin normal ; il existe pour que le MCP de T7, qui n'a pas d'écran devant
    lui, reçoive une phrase du produit et non une erreur de validation.
    """

    code = "export_refuse"


@dataclass(frozen=True, slots=True)
class Archive:
    """Ce qui part au navigateur : un nom, des octets, et ce qu'il y a dedans."""

    nom: str
    octets: bytes
    compte: int


class ServiceExport:
    def __init__(
        self,
        base: Base,
        assets: ServiceAssets,
        bibliotheque: ServiceBibliotheque,
        production: ServiceProduction,
        montage: ServiceMontage,
    ) -> None:
        self._base = base
        self._assets = assets
        self._bibliotheque = bibliotheque
        # **C5 — le personnage, lu et jamais recalculé.** « Cette pose est
        # remplie » a déjà une seule écriture dans le produit, celle qui dessine
        # la matrice ; un second parcours des assets ici en aurait fait une
        # deuxième, et l'écran aurait fini par montrer une colonne pleine que
        # l'export aurait dite vide.
        self._production = production
        # ⚠️ **Ni le vestiaire ni le dépôt de fichiers depuis `RP17`.** Les deux
        # ne servaient qu'à poser un personnage dans le dossier du jeu, et ce
        # geste vit maintenant dans `atelier/services/sortie.py`, seul. Les
        # garder ici aurait laissé croire que ce service peut encore écrire
        # dehors.
        # **A4 — celui qui sait fabriquer une planche de sprites.** Il n'entame
        # rien de ce que la première phrase de ce fichier promet : le montage
        # n'a ni fournisseur, ni catalogue, ni animateur, et découper un clip
        # déjà payé ne demande rien à personne. C'est du disque et du
        # processeur, comme le reste de l'export.
        #
        # **Il n'est pas là pour découper**, mais pour une seule chose :
        # `planche()` refait le rendu quand le cache a sauté. Recalculer la
        # planche ici en aurait fait une seconde écriture, et deux chemins vers
        # les mêmes pixels finissent par ne plus les rendre identiques — ce qui
        # est très exactement le critère que la tranche demande de tenir.
        self._montage = montage

    def exporter(self, identifiants: Iterable[str]) -> Archive:
        """Une sélection, une archive (US-76).

        Les doublons sont fondus dans l'ordre reçu : sélectionner deux fois la
        même image ne la fait pas sortir deux fois sous deux noms.
        """
        # `dict.fromkeys` plutôt qu'un `set` : l'ordre de la sélection est celui
        # de la grille, et c'est lui qui numérote les fichiers homonymes.
        voulus = list(dict.fromkeys(i for i in identifiants if i))
        if not voulus:
            raise ExportRefuse("aucune image sélectionnée")

        instant = time.time()
        tampon = io.BytesIO()
        pris: set[str] = set()
        fiches: list[dict[str, Any]] = []

        with zipfile.ZipFile(tampon, "w") as archive:
            for identifiant in voulus:
                asset = self._assets.lire(identifiant)
                if asset is None:
                    raise ExportRefuse(
                        f"« {identifiant} » n'est plus dans la bibliothèque"
                    )
                octets = self.octets_du_rendu(asset)
                nom = self._nommer(asset, pris)
                pris.add(nom.removesuffix(".png"))
                # **Rangé sans recompression.** Un PNG est déjà dégonflé : le
                # repasser au deflate coûte du temps pour quelques octets. Le
                # descriptif, lui, est du texte, et il se comprime.
                archive.writestr(nom, octets, compress_type=zipfile.ZIP_STORED)
                fiches.append(self.fiche_de_l_asset(asset, nom, octets))

            archive.writestr(
                DESCRIPTIF,
                json.dumps(
                    {
                        "atelier": "Asset Kitchen",
                        "format": FORMAT,
                        "exporte_le": instant,
                        "compte": len(fiches),
                        "assets": fiches,
                    },
                    ensure_ascii=False,
                    indent=2,
                ).encode("utf-8"),
                compress_type=zipfile.ZIP_DEFLATED,
            )

        return Archive(
            nom=_nom_archive(instant), octets=tampon.getvalue(), compte=len(fiches)
        )

    # ── Les animations sortent (A4) ──────────────────────────────────────────

    def exporter_bandes(self, identifiants: Iterable[str]) -> Archive:
        """Une ou plusieurs animations sortent en une archive.

        **Le même geste que pour les images, et le même contenant.** Une bande
        n'est pas un asset — c'est la décision d'`A10` —, mais ce qui la fait
        sortir n'a aucune raison d'être différent : un zip que le navigateur
        pose dans les téléchargements, avec un descriptif de l'atelier à la
        racine. Inventer une seconde façon de sortir aurait fait deux endroits
        où oublier une règle.
        """
        voulus = list(dict.fromkeys(i for i in identifiants if i))
        if not voulus:
            raise ExportRefuse("aucune animation sélectionnée")
        bandes = []
        for identifiant in voulus:
            bande = self._base.lire_bande(identifiant)
            if bande is None:
                raise ExportRefuse(f"« {identifiant} » n'est plus dans l'atelier")
            bandes.append(bande)
        return self._archiver_bandes(bandes, {}, racine="")

    def exporter_bandes_du_personnage(self, projet: str, personnage: str) -> Archive:
        """Toutes les animations d'un personnage, **en une seule archive** (A4).

        C'est le cinquième critère de la tranche, et il se lit à l'endroit où
        l'auteur le demandera : le calque animé de la matrice montre les cases
        remplies d'un personnage, et le bouton qui les fait sortir est juste à
        côté de la jauge qui les compte.

        **Y compris ses brouillons ?** Non : une bande sans case visée n'est pas
        une animation *de ce personnage-là*, c'est un essai gardé dans un clip.
        Mais la question ne se pose pas ici — une bande porte son personnage
        depuis `A10`, et une bande qui n'en porte aucun n'entre dans aucune de
        ces listes. Ce qui sort est donc *tout ce que la matrice montre*, cases
        rangées comprises, brouillons exclus, sans qu'aucune règle nouvelle ait
        été écrite.
        """
        vise = self._production.personnage(projet, personnage)
        bandes = self._base.bandes_du_personnage(vise.identifiant)
        if not bandes:
            raise ExportRefuse(
                f"« {vise.nom} » n'a aucune animation gardée — il n'y a rien à sortir"
            )
        objet = self._base.lire_projet(projet)
        entete = {
            "projet": {
                "identifiant": projet,
                "nom": objet.nom if objet else projet,
            },
            "personnage": {
                "identifiant": vise.identifiant,
                "nom": vise.nom,
                "description": vise.description,
            },
        }
        return self._archiver_bandes(
            bandes, entete, racine=repere(vise.nom or vise.identifiant, (), "personnage")
        )

    def _archiver_bandes(
        self, bandes: Sequence[Bande], entete: dict[str, Any], racine: str
    ) -> Archive:
        """Trois fichiers par animation, et le descriptif de l'atelier au-dessus.

        **La planche est demandée au montage, jamais refaite ici.** C'est le
        sixième critère — *ce qui sort est exactement ce que l'aperçu montrait* —
        et il tient parce qu'il n'y a qu'un seul endroit qui assemble une
        planche. L'image animée, elle, est **découpée dans cette planche-là** :
        les deux fichiers de l'archive ne peuvent pas diverger, l'un est fait de
        l'autre.

        *Ce service n'annonce toujours rien.* Le montage, lui, annonce quand il
        refait une planche dont le cache avait sauté — et c'est juste : le cache
        est revenu, ce qui est un vrai changement, et c'est lui qui l'a fait.
        """
        instant = time.time()
        tampon = io.BytesIO()
        pris: set[str] = set()
        fiches: list[dict[str, Any]] = []

        with zipfile.ZipFile(tampon, "w") as archive:
            for gardee in bandes:
                bande, nom, planche, descriptif, animee = self.trois_fichiers(
                    gardee.identifiant, racine, pris
                )
                archive.writestr(
                    f"{nom}.png", planche, compress_type=zipfile.ZIP_STORED
                )
                archive.writestr(
                    f"{nom}.json",
                    json.dumps(descriptif, ensure_ascii=False, indent=2).encode(
                        "utf-8"
                    ),
                    compress_type=zipfile.ZIP_DEFLATED,
                )
                archive.writestr(
                    f"{nom}{ANIMEE}", animee, compress_type=zipfile.ZIP_STORED
                )
                fiches.append(self.fiche_de_la_bande(bande, nom, descriptif))

            archive.writestr(
                DESCRIPTIF,
                json.dumps(
                    {
                        "atelier": "Asset Kitchen",
                        "format": FORMAT,
                        "exporte_le": instant,
                        **entete,
                        "compte": len(fiches),
                        # **Une clé à elles, et pas `assets`.** Une bande n'est
                        # pas une image (`A10`) ; les ranger sous la même clé
                        # ferait croire à un agent qu'il peut les charger de la
                        # même façon, et il n'y a rien dans le fichier qui le
                        # détromperait avant qu'il essaie.
                        "animations": fiches,
                    },
                    ensure_ascii=False,
                    indent=2,
                ).encode("utf-8"),
                compress_type=zipfile.ZIP_DEFLATED,
            )

        return Archive(
            nom=_nom_archive(instant, racine, "animations"),
            octets=tampon.getvalue(),
            compte=len(fiches),
        )

    def trois_fichiers(
        self, identifiant: str, racine: str = "", pris: set[str] | None = None
    ) -> tuple[Bande, str, bytes, dict[str, Any], bytes]:
        """Ce qu'une animation pose : la planche, son accompagnement, l'animée.

        **Extraite de l'archive en `B21`, et pas recopiée.** La sortie unifiée a
        besoin des trois mêmes fichiers, sous les trois mêmes noms, faits par
        les trois mêmes appels — les fabriquer une seconde fois à côté aurait
        donné deux planches à tenir identiques, ce qui est très exactement le
        critère qu'`A4` avait payé pour rendre vrai.

        `pris` est le carnet des noms déjà servis, tenu par l'appelant : c'est
        lui qui parcourt un lot, et deux animations nommées « marche » doivent se
        départager d'un bout à l'autre du lot, pas à l'intérieur de cet appel.
        """
        planche = self._montage.planche(identifiant)
        # **Relue après la planche, et pas avant** : celle-ci a pu se
        # recalculer, et c'est alors elle qui vient de poser la taille d'une
        # case. Ce qui est là fait foi.
        bande = self._montage.bande(identifiant)
        deja = pris if pris is not None else set()
        nom = self._nommer_bande(bande, racine, deja)
        deja.add(nom)

        descriptif = aseprite.descriptif(
            bande,
            image=f"{nom}.png",
            case_largeur=bande.case_largeur,
            case_hauteur=bande.case_hauteur,
            compte=bande.compte,
        )
        animee = en_image_animee(
            planche,
            bande.case_largeur,
            bande.case_hauteur,
            aseprite.ordre_des_images(bande.compte, bande.sens),
            aseprite.duree_en_ms(bande.cadence),
        )
        return bande, nom, planche, descriptif, animee

    @staticmethod
    def _nommer_bande(bande: Bande, racine: str, pris: set[str]) -> str:
        """Le nom des trois fichiers de cette animation — lisible, et unique.

        Le nom que l'auteur a donné à l'animation, précédé de celui du
        personnage quand on le connaît. **Le préfixe n'est pas décoratif** : un
        fichier tiré de l'archive et posé dans un dossier de jeu perd tout ce
        qui l'entourait, et `marche.png` ne dit pas de qui c'est la marche.
        """
        mot = bande.nom or bande.identifiant
        return repere(f"{racine} {mot}" if racine else mot, pris, "animation")

    def fiche_de_la_bande(
        self, bande: Bande, nom: str, descriptif: dict[str, Any]
    ) -> dict[str, Any]:
        """De quoi reconnaître cette animation, et la refaire.

        Les trois fichiers d'abord — c'est ce qu'un agent cherche —, puis ce que
        le format d'accompagnement ne dit pas et ne doit pas dire : de quel clip
        elle est tirée, quelles images du clip elle retient, quelle fenêtre,
        quelle recette, et **quel appel a été payé**. Une bande ne se relance
        pas, mais elle se refait à l'identique à partir de ça — c'est la règle 5
        de `docs/ARCHITECTURE.md`, et le descriptif est ce qui la rend vraie une
        fois dehors.
        """
        return {
            "planche": f"{nom}.png",
            "descriptif": f"{nom}.json",
            "animee": f"{nom}{ANIMEE}",
            "identifiant": bande.identifiant,
            "nom": bande.nom,
            "clip": bande.clip,
            "images": list(bande.images),
            "cadence": bande.cadence,
            "sens": bande.sens,
            "compte": bande.compte,
            "secondes": bande.secondes,
            # Mesurées sur la planche qui vient d'être écrite, et **reprises du
            # fichier d'accompagnement** plutôt que recalculées : deux endroits
            # qui diraient la taille d'une case finiraient par ne plus dire la
            # même.
            "case_largeur": descriptif["meta"]["size"]["w"] // max(bande.compte, 1),
            "case_hauteur": descriptif["meta"]["size"]["h"],
            "duree_image_ms": aseprite.duree_en_ms(bande.cadence),
            "cadre": bande.cadre.en_json(),
            "recette": bande.recette.en_json(),
            "empreinte": bande.recette.empreinte(),
            "projet": self._nommer_projet(bande.projet),
            "personnage": bande.personnage,
            "pose": bande.pose,
            "direction": bande.direction,
            "brouillon": bande.brouillon,
            "cree_le": bande.cree_le,
            # **Ce que le clip a coûté**, et c'est le seul chiffre de la fiche
            # qui parle d'argent : une bande ne coûte rien, le clip dont elle
            # est tirée a coûté quelque chose, et c'est lui qu'on retrouve ici.
            "generation": self._generation(bande.clip),
        }

    # ── Ce qui part, et sous quel nom ────────────────────────────────────────

    def octets_du_rendu(self, asset: Asset) -> bytes:
        """Les octets du fichier de l'archive. **Le rendu, et en PNG.**

        Le rendu parce que c'est ce qu'on voit — exporter le brut d'un asset
        détouré rendrait le fond gris qu'on vient d'enlever. Le PNG parce que
        c'est le seul format qui porte l'alpha, et parce qu'un asset dont le
        modèle n'a rendu que du JPEG doit sortir comme les autres. Même règle
        qu'au téléchargement d'une image seule, et le même appel.
        """
        octets, type_media = self._assets.octets(asset)
        return octets if type_media == "image/png" else rendre_en_png(octets)

    @staticmethod
    def _nommer(asset: Asset, pris: set[str]) -> str:
        """Le nom du fichier dans l'archive — lisible, et unique.

        Le label d'abord : c'est le mot que l'auteur reconnaît quand il ouvre
        l'archive dans son moteur. `repere()` le réduit à ce qu'un dossier
        accepte partout et le numérote quand il est déjà pris — deux tonneaux
        d'un même lot donnent `un-tonneau.png` et `un-tonneau-2.png`.

        **Le descriptif dit lequel est lequel**, et c'est lui qui fait foi : le
        nom de fichier est une commodité de lecture, jamais un identifiant.
        """
        return f"{repere(asset.label or asset.identifiant, pris)}.png"

    # ── Le descriptif ────────────────────────────────────────────────────────

    def fiche_de_l_asset(self, asset: Asset, nom: str, octets: bytes) -> dict[str, Any]:
        """De quoi reconnaître cette image, et la rejouer (US-76).

        Les cinq choses que la tranche demande : le label, le prompt, les
        réglages résolus, les dimensions mesurées et la filiation. Plus la
        recette et son empreinte, qui ne coûtent rien ici et sans lesquelles
        « rejouer » voudrait seulement dire « repayer un appel » — or une
        recette réappliquée rend exactement la même image, et un appel jamais.
        """
        mesure = mesurer(octets)
        return {
            "fichier": nom,
            "identifiant": asset.identifiant,
            "label": asset.label,
            "favori": asset.favori,
            "cree_le": asset.cree_le,
            "cout_usd": asset.cout_usd,
            "projet": self._nommer_projet(asset.projet),
            # **Mesurées sur le fichier qui part**, jamais recopiées de
            # l'enregistrement : c'est l'invariant de T1, et l'export est
            # justement l'endroit où les deux diffèrent — un asset détouré sort
            # en 64 px là où son brut en fait 1024.
            "dimensions": {"largeur": mesure.largeur, "hauteur": mesure.hauteur},
            "octets": mesure.octets,
            "brut": {
                "largeur": asset.largeur,
                "hauteur": asset.hauteur,
                "type_media": asset.type_media,
            },
            "recette": asset.recette.en_json(),
            "empreinte": asset.recette.empreinte(),
            "generation": self._appel(asset),
            "filiation": self._filiation(asset.identifiant),
        }

    def _appel(self, asset: Asset) -> dict[str, Any] | None:
        """L'appel qui a produit cette image : le prompt et ce qui est parti.

        `None` quand la génération a disparu — et c'est une absence, pas un
        objet vide : un descriptif qui annoncerait un prompt vide se lirait
        comme « aucun prompt » alors qu'il veut dire « on ne sait plus ».

        Une découpe emporte le prompt de sa planche, sans rien de particulier à
        écrire ici : elle vit dans la génération de sa planche, aux rangs 100 et
        suivants. C'est ce qui fait qu'un morceau exporté seul dit d'où il vient.
        """
        return self._generation(asset.generation)

    def _generation(self, identifiant: str | None) -> dict[str, Any] | None:
        """L'appel payé, dit de la même façon pour une image et pour une bande.

        **Un seul endroit**, parce qu'`A4` a fait sortir les bandes et qu'elles
        ont exactement la même chose à dire : quel modèle, quel texte, quels
        réglages résolus. Deux écritures auraient divergé au premier champ
        ajouté d'un seul côté — c'est le motif que ce fichier applique déjà
        depuis C5 aux deux descriptifs.
        """
        generation = self._base.lire(identifiant) if identifiant else None
        if generation is None:
            return None
        demande = generation.demande
        return {
            "identifiant": generation.identifiant,
            "modele": generation.modele,
            "prompt": demande.get("prompt", ""),
            "prompt_negatif": demande.get("prompt_negatif", ""),
            "reglages_resolus": generation.parametres_resolus,
            "cree_le": generation.cree_le,
        }

    def _filiation(self, identifiant: str) -> dict[str, Any]:
        """D'où vient cette image, et ce qui en descend — en identifiants.

        La règle vient de la bibliothèque et n'est pas rejouée ici : un parent
        supprimé garde son identifiant et se dit supprimé. Ce qui change, c'est
        le poids — le descriptif porte des identifiants, pas des assets entiers,
        parce qu'il se lit à l'œil et qu'un enfant entier tient trente lignes.
        """
        filiation = self._bibliotheque.filiation(identifiant)
        return {
            "parent": filiation["parent_identifiant"],
            "parent_supprime": filiation["parent_supprime"],
            "enfants": [e["identifiant"] for e in filiation["enfants"]],
        }

    def _nommer_projet(self, identifiant: str | None) -> dict[str, str] | None:
        if identifiant is None:
            return None
        projet = self._base.lire_projet(identifiant)
        return {"identifiant": identifiant, "nom": projet.nom if projet else identifiant}


def _nom_archive(instant: float, racine: str = "", quoi: str = "") -> str:
    """`atelier-20260827-1743.zip` — daté, et rien d'autre.

    Pas le nom du projet : une sélection à la main dans la galerie traverse les
    projets aussi facilement qu'elle en reste à un seul, et un nom qui
    mentirait une fois sur dix vaut moins qu'un nom qui ne dit que la date. Ce
    que contient l'archive est écrit dans le descriptif, qui, lui, ne peut pas
    mentir.

    **Un personnage, lui, ne traverse rien** (A4) : quand on sait de qui sont
    les animations, son nom passe devant — `le-nain-animations-20260904-1743.zip`
    — et l'archive se retrouve dans un dossier de téléchargements qui en contient
    trente. La règle du dessus tient toujours ; c'est son *motif* qu'on applique,
    et non son résultat : on nomme ce dont on est sûr.
    """
    date = time.strftime("%Y%m%d-%H%M", time.localtime(instant))
    debut = "-".join(mot for mot in (racine or "atelier", quoi) if mot)
    return f"{debut}-{date}.zip"
