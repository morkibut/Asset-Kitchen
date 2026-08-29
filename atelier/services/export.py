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

**C5 lui donne une seconde sortie, pas un second descriptif.** T6 fabrique une
archive qu'un navigateur télécharge ; C5 pose des fichiers dans le dossier du
jeu. Les deux écrivent **la même fiche**, par le même code — un personnage y
ajoute seulement ce que la V2 sait de plus : le rôle du fichier, sa pose, sa
pièce. Deux formats de descriptif auraient divergé au premier champ ajouté d'un
seul côté.

**Poser un fichier dehors reste le geste de T7**, et ce service ne le réécrit
pas : `ServiceAgent.deposer` porte les trois règles du dossier du jeu — dossier
manquant créé, fichier existant jamais écrasé, dossier non inscriptible refusé
avec son chemin. Un second endroit qui écrirait dans le dossier du jeu serait un
second endroit où oublier la deuxième.

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
from pathlib import Path
from typing import Any, Iterable, Sequence

from atelier.depot import Base
from atelier.domaine.asset import Asset
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.projet import repere
from atelier.image import mesurer, rendre_en_png
from atelier.services.agent import ServiceAgent
from atelier.services.assets import ServiceAssets
from atelier.services.bibliotheque import ServiceBibliotheque
from atelier.services.equipement import ServiceEquipement
from atelier.services.production import ServiceProduction, corps_retenu

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


@dataclass(frozen=True, slots=True)
class Sortie:
    """Ce qui vient d'être posé dans le dossier du jeu (US-154).

    **Des chemins absolus, et c'est ce qui compte.** L'auteur veut savoir où
    c'est parti ; l'agent va l'écrire dans le code de son jeu, et un chemin
    relatif y serait relatif à un dossier de travail que l'atelier ne connaît
    pas. C'est déjà la règle de `ServiceAgent.deposer`, dont ces chemins
    viennent — ils ne sont pas recomposés ici.

    `dossier` est celui où les fichiers ont **réellement** atterri, jamais celui
    qui a été demandé : entre les deux il y a un `~` déplié et un chemin résolu,
    et c'est le second qu'on colle dans un moteur de jeu.
    """

    dossier: str
    fichiers: tuple[dict[str, Any], ...]
    descriptif: str
    compte: int

    def en_json(self) -> dict[str, Any]:
        return {
            "dossier": self.dossier,
            "fichiers": list(self.fichiers),
            "descriptif": self.descriptif,
            "compte": self.compte,
        }


class ServiceExport:
    def __init__(
        self,
        base: Base,
        assets: ServiceAssets,
        bibliotheque: ServiceBibliotheque,
        production: ServiceProduction,
        equipement: ServiceEquipement,
        agent: ServiceAgent,
    ) -> None:
        self._base = base
        self._assets = assets
        self._bibliotheque = bibliotheque
        # **C5 — le personnage et son vestiaire, lus et jamais recalculés.**
        # « Cette pose est remplie » a déjà une seule écriture dans le produit,
        # celle qui dessine la matrice ; un second parcours des assets ici en
        # aurait fait une deuxième, et l'écran aurait fini par montrer une
        # colonne pleine que l'export aurait dite vide.
        self._production = production
        self._equipement = equipement
        # **Le dossier du jeu reste celui de T7**, avec ses trois règles. Ce
        # service ne les réécrit pas : il les appelle.
        self._agent = agent

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

    # ── L'autre sortie : le dossier du jeu ───────────────────────────────────

    def deposer(self, identifiants: Iterable[str], dossier: str | None = None) -> Sortie:
        """Une sélection posée en fichiers dans un dossier, avec son descriptif.

        L'archive de T6, **ouverte** : ce qui est utile à un agent n'est pas un
        zip qu'il devrait dézipper, c'est une liste de fichiers déjà posés. Même
        sélection, même fiche, même règle de nom — seul le contenant change.

        C'était jusqu'ici la seule fonction du serveur MCP qui *faisait* quelque
        chose : elle rouvrait l'archive pour en ressortir les fichiers un par un.
        Le geste vit ici depuis C5, et l'outil n'est plus qu'une façade — c'est
        l'invariant de T7, rendu vrai là où il ne l'était pas tout à fait.
        """
        voulus = list(dict.fromkeys(i for i in identifiants if i))
        if not voulus:
            raise ExportRefuse("aucune image sélectionnée")

        parts: list[tuple[Asset, dict[str, Any]]] = []
        pris: set[str] = set()
        for identifiant in voulus:
            asset = self._assets.lire(identifiant)
            if asset is None:
                raise ExportRefuse(f"« {identifiant} » n'est plus dans la bibliothèque")
            nom = self._nommer(asset, pris)
            pris.add(nom.removesuffix(".png"))
            parts.append((asset, {"nom": nom, "contexte": {}}))
        return self._poser(parts, dossier, {}, DESCRIPTIF)

    def exporter_personnage(
        self, projet: str, personnage: str, dossier: str | None = None
    ) -> Sortie:
        """Un personnage complet part dans le jeu (US-154, US-155).

        **Ce qui sort est ce que la matrice retient** : un corps par pose et un
        calque par pièce, choisis par la règle qui existe déjà — le favori
        d'abord, sinon la plus récente (`corps_retenu`). Sortir les quatre
        variations d'une pose aurait rendu le tri à l'agent, alors que l'auteur
        y a déjà répondu en marquant son favori ; et « utilisable sans
        manipulation » dit exactement le contraire de « choisis toi-même ».

        **Une pose sans corps ne sort pas**, ses calques compris. Un calque est
        une différence posée sur un corps : seul dans un dossier de jeu, il ne
        se pose sur rien. La pose reste vide dans la matrice, et c'est là qu'on
        va la remplir.

        **Et tout ce qui porte une pièce n'est pas un calque.** Une pièce qui
        agrandit la silhouette et revient à une autre échelle est gardée comme
        un corps habillé (US-148) : il sort lui aussi — l'appel a été payé, et
        l'image est utilisable —, mais le descriptif dit qu'il **remplace** le
        corps au lieu de s'empiler dessus.

        **Rien n'est écrit tant que le dossier n'a pas répondu.** Le premier
        dépôt crée le dossier, et c'est lui qui refuse — avec son chemin — quand
        il n'est pas inscriptible. Le descriptif part en dernier, parce qu'il
        nomme les fichiers **tels qu'ils ont été posés** : c'est le dépôt qui
        numérote les homonymes, pas nous.
        """
        vise = self._production.personnage(projet, personnage)
        poses = {p.identifiant: p for p in self._production.plan(projet)}
        pieces = {p.identifiant: p for p in self._equipement.pieces(projet)}
        emplacements = {e.identifiant: e for e in self._equipement.emplacements(projet)}
        racine = repere(vise.nom or vise.identifiant, (), "personnage")

        parts: list[tuple[Asset, dict[str, Any]]] = []
        for case in self._production.cases(projet, vise):
            corps = self._assets.lire(case["corps"]) if case["corps"] else None
            if corps is None:
                continue
            pose = poses.get(case["pose"])
            mot_pose = repere(pose.nom if pose else case["pose"], (), "pose")
            parts.append(
                (
                    corps,
                    {
                        "nom": f"{racine}-{mot_pose}.png",
                        "contexte": {
                            "role": CORPS,
                            "pose": _nomme(case["pose"], pose),
                            "piece": None,
                        },
                    },
                )
            )
            for identifiant_piece, liste in case["calques"].items():
                retenu = corps_retenu(
                    [
                        asset
                        for asset in (
                            self._assets.lire(a["identifiant"]) for a in liste
                        )
                        if asset is not None
                    ]
                )
                if retenu is None:
                    continue
                piece = pieces.get(identifiant_piece)
                mot_piece = repere(
                    piece.nom if piece else identifiant_piece, (), "piece"
                )
                parts.append(
                    (
                        retenu,
                        {
                            "nom": f"{racine}-{mot_pose}-{mot_piece}.png",
                            "contexte": {
                                # Calque ou corps habillé : la recette le dit,
                                # et le descriptif le répète — l'un s'empile sur
                                # le corps, l'autre le remplace.
                                "role": CALQUE if retenu.recette.calque else HABILLE,
                                "pose": _nomme(case["pose"], pose),
                                "piece": _piece_en_json(
                                    identifiant_piece, piece, emplacements
                                ),
                            },
                        },
                    )
                )

        if not parts:
            # **Le filet, et la phrase que l'écran grise** (`docs/design-motifs.md`
            # § Le grisé porte sa raison). L'agent, lui, n'a pas d'écran : c'est
            # cette phrase-là qu'il répétera à l'auteur.
            raise ExportRefuse(
                f"« {vise.nom} » n'a aucune pose remplie — il n'y a rien à sortir"
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
            # **L'ordre dans lequel on habille quelqu'un**, et il ne se devine
            # pas : c'est le rang des emplacements du projet, celui que l'auteur
            # a posé. Sans lui, un agent qui empile un casque et une cape doit
            # inventer lequel passe devant — et « aucune structure inventée »
            # vaut aussi pour l'ordre des calques.
            "emplacements": [
                e.en_json()
                for e in sorted(
                    emplacements.values(), key=lambda e: (e.rang, e.identifiant)
                )
            ],
        }
        return self._poser(parts, dossier, entete, f"{racine}-descriptif.json")

    def _poser(
        self,
        parts: Sequence[tuple[Asset, dict[str, Any]]],
        dossier: str | None,
        entete: dict[str, Any],
        nom_descriptif: str,
    ) -> Sortie:
        """Pose les fichiers, puis le descriptif qui les nomme.

        **Le descriptif en dernier, et jamais l'inverse** : le nom qu'il annonce
        est celui que le dépôt a retenu, homonyme numéroté compris. Écrit
        d'avance, il aurait annoncé `epee.png` là où le dossier a reçu
        `epee-2.png`, et l'agent aurait chargé le fichier de la semaine dernière.
        """
        instant = time.time()
        fiches: list[dict[str, Any]] = []
        for asset, quoi in parts:
            octets = self._png(asset)
            chemin = self._agent.deposer(octets, quoi["nom"], dossier)
            fiches.append(
                {
                    "chemin": chemin,
                    **quoi["contexte"],
                    **self._fiche(asset, Path(chemin).name, octets),
                }
            )

        descriptif = self._agent.deposer(
            json.dumps(
                {
                    "atelier": "Asset Kitchen",
                    "format": FORMAT,
                    "exporte_le": instant,
                    **entete,
                    "compte": len(fiches),
                    # **La même clé que l'archive de T6.** Un dossier et un zip
                    # ne sont pas deux descriptifs : c'est le même, écrit par le
                    # même code, et un agent qui sait lire l'un lit l'autre.
                    "assets": fiches,
                },
                ensure_ascii=False,
                indent=2,
            ).encode("utf-8"),
            nom_descriptif,
            dossier,
        )
        return Sortie(
            dossier=str(Path(descriptif).parent),
            fichiers=tuple(fiches),
            descriptif=descriptif,
            compte=len(fiches),
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


def _nomme(identifiant: str, pose: Any) -> dict[str, str]:
    """Une pose, dite par son identifiant **et** par son nom.

    Les deux, parce qu'ils ne servent pas à la même chose : l'identifiant est ce
    qui relie le fichier à la matrice de l'atelier, le nom est ce que l'auteur a
    écrit et ce qu'un agent affichera. Une pose retirée du plan depuis l'export
    garde son identifiant et retombe sur lui — un descriptif incomplet reste un
    descriptif, comme la filiation d'un parent supprimé.
    """
    return {
        "identifiant": identifiant,
        "nom": getattr(pose, "nom", "") or identifiant,
    }


def _piece_en_json(
    identifiant: str, piece: Any, emplacements: dict[str, Any]
) -> dict[str, Any]:
    """La pièce d'un calque, avec sa place sur le corps et son rang.

    Le rang est ce qui dit à l'agent **dans quel ordre empiler** ; la portée est
    ce qui lui dit si la pièce tient dans la silhouette ou l'agrandit, donc si
    le calque se pose tel quel ou déborde. Ni l'un ni l'autre ne se devine à
    partir du fichier.
    """
    place = emplacements.get(getattr(piece, "emplacement", "") or "")
    return {
        "identifiant": identifiant,
        "nom": getattr(piece, "nom", "") or identifiant,
        "emplacement": getattr(place, "identifiant", None),
        "emplacement_nom": getattr(place, "nom", None),
        "rang": getattr(place, "rang", None),
        "portee": getattr(piece, "portee", None),
    }


def _nom_archive(instant: float) -> str:
    """`atelier-20260827-1743.zip` — daté, et rien d'autre.

    Pas le nom du projet : une sélection traverse les projets dès qu'une
    collection les traverse, et un nom qui mentirait une fois sur dix vaut moins
    qu'un nom qui ne dit que la date. Ce que contient l'archive est écrit dans
    le descriptif, qui, lui, ne peut pas mentir.
    """
    return f"atelier-{time.strftime('%Y%m%d-%H%M', time.localtime(instant))}.zip"
