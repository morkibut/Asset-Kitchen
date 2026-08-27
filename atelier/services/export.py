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
"""

from __future__ import annotations

import io
import json
import time
import zipfile
from dataclasses import dataclass
from typing import Any, Iterable

from atelier.depot import Base
from atelier.domaine.asset import Asset
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.projet import repere
from atelier.image import mesurer, rendre_en_png
from atelier.services.assets import ServiceAssets
from atelier.services.bibliotheque import ServiceBibliotheque

# Le nom du descriptif, à la racine de l'archive. **Un seul**, et en JSON : le
# doubler d'une version lisible à l'œil créerait deux vérités sur le même lot,
# et c'est exactement ce qu'`AGENTS.md` interdit dans sa première phrase.
DESCRIPTIF = "descriptif.json"

# Ce que le descriptif déclare de lui-même, pour qui le relira dans six mois
# sans se souvenir d'où il vient.
FORMAT = 1


class ExportRefuse(ErreurAtelier):
    """Il n'y a rien à exporter, et on dit quoi.

    L'écran grise d'abord — « l'export d'une sélection vide » est nommément dans
    `docs/DESIGN.md` § Le grisé porte sa raison. Ce refus-ci est le filet, pas le
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
    ) -> None:
        self._base = base
        self._assets = assets
        self._bibliotheque = bibliotheque

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
                octets = self._png(asset)
                nom = self._nommer(asset, pris)
                pris.add(nom.removesuffix(".png"))
                # **Rangé sans recompression.** Un PNG est déjà dégonflé : le
                # repasser au deflate coûte du temps pour quelques octets. Le
                # descriptif, lui, est du texte, et il se comprime.
                archive.writestr(nom, octets, compress_type=zipfile.ZIP_STORED)
                fiches.append(self._fiche(asset, nom, octets))

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

    # ── Ce qui part, et sous quel nom ────────────────────────────────────────

    def _png(self, asset: Asset) -> bytes:
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

    def _fiche(self, asset: Asset, nom: str, octets: bytes) -> dict[str, Any]:
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
            "collection": self._nommer_collection(asset.collection),
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
        generation = self._base.lire(asset.generation)
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

    def _nommer_collection(self, identifiant: str | None) -> dict[str, str] | None:
        if identifiant is None:
            return None
        collection = self._base.lire_collection(identifiant)
        return {
            "identifiant": identifiant,
            "nom": collection.nom if collection else identifiant,
        }


def _nom_archive(instant: float) -> str:
    """`atelier-20260827-1743.zip` — daté, et rien d'autre.

    Pas le nom du projet : une sélection traverse les projets dès qu'une
    collection les traverse, et un nom qui mentirait une fois sur dix vaut moins
    qu'un nom qui ne dit que la date. Ce que contient l'archive est écrit dans
    le descriptif, qui, lui, ne peut pas mentir.
    """
    return f"atelier-{time.strftime('%Y%m%d-%H%M', time.localtime(instant))}.zip"
