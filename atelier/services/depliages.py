# -*- coding: utf-8 -*-
"""Les gestes sur les dépliages d'une planche — refaire, lister, supprimer (P1b).

**Le premier dépliage reste automatique**, et il vit dans `ServicePliage` : une
planche qui revient bien ne demande aucun geste. Ce fichier-ci porte ce qui
s'ajoute en V3.5 — **le retour en arrière** —, et rien de ce qu'il fait ne
part sans qu'on l'ait demandé :

- **proposer** les coupes d'un nouveau dépliage, par défaut celles du dernier —
  rien n'est écrit ;
- **refaire** un dépliage sur les coupes que l'auteur a validées — un dépliage
  de plus, des rangs neufs, rien d'effacé ;
- **lister** les dépliages d'une planche avec leurs images — de quoi remonter de
  n'importe quelle image à sa planche et au découpage qui l'en a tirée ;
- **supprimer** un dépliage — ses images partent par la suppression ordinaire,
  lui reste écrit et ses rangs restent pris ;
- **compter** ce qui dépend d'une planche, pour qu'on ne la supprime pas sans
  le savoir.

**Ce que devient une image quand sa planche est supprimée : elle reste.** Elle a
été payée avec l'appel, elle a son propre brut sur le disque (au rang du
dépliage, jamais à celui de la planche : la purge de `<rang>-*` ne la touche
pas), et elle garde `planche` et `depliage` — ce sont des faits sur sa
naissance, pas des liens vivants. Ce qui se perd est **le geste de refaire** :
le fichier de la planche part avec elle, et il n'y a plus rien à recouper.
C'est pour ça que la suppression d'une planche demande confirmation et dit le
compte ; rien d'autre qu'elle n'est supprimé, jamais.

**Aucun fournisseur ici**, et ça se lit dans les imports : refaire un dépliage
recoupe une image déjà payée, et marche réseau coupé.
"""

from __future__ import annotations

from typing import Any, Iterable, Sequence

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import Emplacement, Generation
from atelier.domaine.pliage import Depliage
from atelier.image import Boite, grille_fixe
from atelier.services.assets import AssetInconnu
from atelier.services.bibliotheque import ServiceBibliotheque
from atelier.services.decoupe import verifier_boites
from atelier.services.pliage import ServicePliage


class DepliageRefuse(ErreurAtelier):
    """Le dépliage demandé ne peut pas se faire, et on dit pourquoi."""

    code = "depliage_refuse"


class PlancheAConfirmer(ErreurAtelier):
    """Supprimer cette planche demande un « oui » explicite, et voici pourquoi.

    **Ce n'est pas une faute**, c'est une question : la planche a des images
    qui en dépendent, elles resteront, mais son découpage ne pourra plus se
    refaire. Le compte part avec le refus (`dependants`) pour que l'écran pose
    la question avec le bon chiffre sans avoir à le redemander.
    """

    code = "planche_a_confirmer"

    def __init__(self, planche: str, dependants: dict[str, int]) -> None:
        total = dependants["total"]
        super().__init__(
            f"{total} image{'s' if total > 1 else ''} "
            f"{'dépendent' if total > 1 else 'dépend'} de cette planche — "
            f"{'elles resteront' if total > 1 else 'elle restera'}, mais son "
            f"découpage ne pourra plus se refaire. Confirmez pour la supprimer."
        )
        self.planche = planche
        self.dependants = dependants


def _cases_de_la_planche(pliage: Any) -> list[dict[str, Any]]:
    """Ce que chaque case de la planche demandait — et, depuis P2, pour quel
    sujet. `sujet` est vide sur une planche d'un seul sujet."""
    return [
        {
            "indice": i,
            "texte": c.texte,
            "pose": c.pose,
            "direction": c.direction,
            "sujet": c.sujet,
        }
        for i, c in enumerate(pliage.cases)
    ]


def depliages_de(atelier: Any) -> "ServiceDepliages":
    """Le service, construit sur les pièces de l'atelier.

    **Construit à la demande plutôt que monté dans `Atelier`** : il n'a pas
    d'état, et c'est ce qui permet de l'ajouter sans toucher à l'assemblage.
    Le jour où `Atelier` le porte (`self.depliages = ServiceDepliages(...)`),
    cette fonction n'a plus qu'à le rendre.
    """
    deja = getattr(atelier, "depliages", None)
    if isinstance(deja, ServiceDepliages):
        return deja
    return ServiceDepliages(
        atelier.base, atelier.fichiers, atelier.bibliotheque, atelier.pliage
    )


class ServiceDepliages:
    """Les dépliages refaits et ce qu'on en fait — **sans état**.

    Il ne garde rien en mémoire : tout se relit sur `generation.json` (les
    dépliages, leurs coupes, leurs rangs) et sur l'index (les images). C'est ce
    qui permet de le construire à la demande, depuis l'atelier, sans le monter
    dans `Atelier`.
    """

    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        bibliotheque: ServiceBibliotheque,
        pliage: ServicePliage,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._bibliotheque = bibliotheque
        self._pliage = pliage

    # ── Remonter d'une image à sa planche ────────────────────────────────────

    def _resoudre(self, identifiant: str) -> tuple[Generation, Emplacement, str]:
        """La génération, l'emplacement et l'identifiant de la planche.

        `identifiant` est la planche **ou n'importe quelle image qui en est
        sortie** : c'est ce qui fait « remonter jusqu'à elle » — l'image porte
        le nom de sa planche, et la planche se retrouve même supprimée, parce
        que ses dépliages vivent dans `generation.json`, pas sur elle.
        """
        asset = self._base.lire_asset(identifiant)
        planche = asset.planche if asset is not None and asset.planche else identifiant
        generation_id, _, rang = planche.rpartition("-")
        generation = self._base.lire(generation_id) if rang.isdigit() else None
        emplacement = generation.emplacement(int(rang)) if generation else None
        if generation is None or emplacement is None or generation.pliage is None:
            if asset is None:
                raise AssetInconnu(identifiant)
            raise DepliageRefuse(
                "cette image n'est pas une planche, ni une image sortie d'une planche"
            )
        return generation, emplacement, planche

    def _planche_presente(
        self, generation: Generation, emplacement: Emplacement, planche: str
    ) -> str | None:
        """`None` si la planche peut se redécouper, sinon la raison en clair."""
        if generation.piece:
            # **Refusé, et c'est un choix de P1b.** Un dépliage de planche
            # d'équipement n'est pas une découpe : chaque case y est comparée
            # au corps que l'atelier a envoyé, pour en tirer un calque (C3).
            # Des coupes déplacées à la main n'ont plus de corps en face ; le
            # geste de ce cas-là existe déjà, c'est le recalage.
            return (
                "une planche d'équipement se recale, elle ne se redécoupe pas — "
                "ses calques sont mesurés sur la grille que l'atelier a posée"
            )
        asset = self._base.lire_asset(planche)
        if asset is None or asset.supprime_le is not None:
            return (
                "la planche a été supprimée — ses images restent, mais son "
                "découpage ne se refait plus"
            )
        if emplacement.resultat is None or not self._fichiers.existe(
            emplacement.resultat.fichier
        ):
            return "le fichier de la planche n'est plus sur le disque"
        return None

    def _images(self, generation: Generation, planche: str) -> list[Asset]:
        """Les images sorties de cette planche, **supprimées comprises**.

        L'appartenance se lit sur l'image (`Asset.planche`, `Asset.depliage`),
        jamais sur son rang : un miroir ou une superposition tombe aussi au
        dessus de cent, dans le même dossier.
        """
        images = []
        for rang in sorted(self._base.rangs_de_generation(generation.identifiant)):
            asset = self._base.lire_asset(f"{generation.identifiant}-{rang}")
            if asset is not None and asset.planche == planche and asset.depliage:
                images.append(asset)
        return images

    # ── Lister ───────────────────────────────────────────────────────────────

    def lister(self, identifiant: str) -> dict[str, Any]:
        """Les dépliages d'une planche, chacun avec ses images vivantes."""
        generation, emplacement, planche = self._resoudre(identifiant)
        pliage = generation.pliage
        assert pliage is not None
        images = self._images(generation, planche)
        raison = self._planche_presente(generation, emplacement, planche)
        resultat = emplacement.resultat

        depliages = []
        for depliage in pliage.depliages_de(planche):
            siennes = [a for a in images if a.depliage == depliage.identifiant]
            vivantes = [a for a in siennes if a.supprime_le is None]
            depliages.append(
                {
                    **depliage.en_json(),
                    "images": [a.en_json() for a in vivantes],
                    # Supprimées mais encore annulables : l'écran peut dire
                    # « trois images en attente d'effacement ».
                    "supprimees": len(siennes) - len(vivantes),
                    # Supprimé **et** vide : une annulation de ses images par
                    # la bibliothèque le fait revivre sans rien réécrire.
                    "supprime": depliage.supprime_le is not None and not vivantes,
                }
            )
        return {
            "planche": planche,
            "generation": generation.identifiant,
            "largeur": resultat.largeur if resultat else 0,
            "hauteur": resultat.hauteur if resultat else 0,
            "refaisable": raison is None,
            "raison": raison,
            "depliages": depliages,
            "dependants": self.dependants(planche),
            # **La liste annoncée** (P2) : vraie quand chaque case dit sa chose
            # du jeu. L'écran y lit le sujet de chaque case et, dépliage par
            # dépliage, celles qui attendent un regard (`a_verifier`).
            "plusieurs": pliage.plusieurs,
            "cases_de_la_planche": _cases_de_la_planche(pliage),
        }

    # ── Proposer ─────────────────────────────────────────────────────────────

    def proposer(self, identifiant: str, depuis: int | None = None) -> dict[str, Any]:
        """Les coupes d'un nouveau dépliage. **Rien n'est créé, rien n'est écrit.**

        Par défaut celles du **dernier** dépliage de la planche — c'est lui
        qu'on corrige, le plus souvent ; `depuis` en désigne un autre par son
        numéro. Une planche dépliée avant P1 n'a pas de dépliage écrit : on
        repart alors des boîtes que l'arrivée a mesurées, et à défaut de la
        grille enregistrée.

        Les boîtes sont en pixels du brut de la planche, **avant marge** — la
        convention du découpeur de T5, que l'écran reprend.
        """
        generation, emplacement, planche = self._resoudre(identifiant)
        pliage = generation.pliage
        assert pliage is not None
        resultat = emplacement.resultat
        largeur = resultat.largeur if resultat else 0
        hauteur = resultat.hauteur if resultat else 0

        siens = pliage.depliages_de(planche)
        source: Depliage | None
        if depuis is not None:
            source = next((d for d in siens if d.numero == depuis), None)
            if source is None:
                raise DepliageRefuse(f"cette planche n'a pas de dépliage n° {depuis}")
        else:
            source = max(siens, key=lambda d: d.numero, default=None)

        if source is not None and source.coupes:
            boites = [list(c) for c in source.coupes]
            cases = [source.case_de(i) for i in range(len(source.coupes))]
        elif pliage.mesures:
            gardees = [i for i in pliage.gardees if i < len(pliage.mesures)]
            boites = [list(pliage.mesures[i].boite) for i in gardees]
            cases = [i if i < pliage.nombre else None for i in range(len(boites))]
        else:
            forme = pliage.geometrie
            boites = [
                list(b)
                for b in grille_fixe(largeur, hauteur, forme.colonnes, forme.lignes)
            ][: forme.cases]
            cases = list(range(len(boites)))

        raison = self._planche_presente(generation, emplacement, planche)
        return {
            "planche": planche,
            "generation": generation.identifiant,
            "largeur": largeur,
            "hauteur": hauteur,
            "boites": boites,
            "cases": cases,
            "depuis": source.identifiant if source is not None else None,
            "marge": self._pliage.marge(generation),
            # Ce que chaque case demandait : l'écran les propose pour qu'on
            # dise laquelle une coupe remplit.
            "cases_de_la_planche": _cases_de_la_planche(pliage),
            "refaisable": raison is None,
            "raison": raison,
        }

    # ── Refaire ──────────────────────────────────────────────────────────────

    def refaire(
        self,
        identifiant: str,
        boites: Iterable[Boite],
        cases: Sequence[int | None] | None = None,
    ) -> dict[str, Any]:
        """Un dépliage de plus, sur les coupes que l'auteur a validées.

        **Lève le refus « cette planche a déjà rendu ses images »** — celui de
        `ServiceGenerations.ecarter`, qui garde le chemin automatique : ici,
        l'auteur l'a demandé, et rien des dépliages précédents n'est touché.

        `cases` est aligné aux coupes ; absent, la n-ième coupe remplit la
        n-ième case, et les coupes en plus n'en remplissent aucune.
        """
        generation, emplacement, planche = self._resoudre(identifiant)
        pliage = generation.pliage
        assert pliage is not None
        raison = self._planche_presente(generation, emplacement, planche)
        if raison is not None:
            raise DepliageRefuse(raison)
        resultat = emplacement.resultat
        assert resultat is not None

        rectangles = verifier_boites(
            boites, resultat.largeur, resultat.hauteur, quoi="planche"
        )
        if cases is None:
            indices: list[int | None] = [
                i if i < pliage.nombre else None for i in range(len(rectangles))
            ]
        else:
            if len(cases) > len(rectangles):
                raise DepliageRefuse(
                    f"{len(cases)} cases désignées pour {len(rectangles)} coupes"
                )
            hors = [c for c in cases if c is not None and not 0 <= c < pliage.nombre]
            if hors:
                raise DepliageRefuse(
                    f"la planche a {pliage.nombre} cases — "
                    f"il n'y a pas de case n° {hors[0] + 1}"
                )
            indices = [
                cases[i] if i < len(cases) else None for i in range(len(rectangles))
            ]

        depliage, nees = self._pliage.redeplier(
            generation, emplacement, rectangles, indices
        )
        return {
            "planche": planche,
            "depliage": depliage.en_json(),
            "images": [a.en_json() for a in nees],
        }

    # ── Une planche à plusieurs sujets (P2) ──────────────────────────────────

    def pas_le_bon_sujet(self, identifiant: str) -> dict[str, Any]:
        """« Ce n'est pas le bon sujet » : l'image quitte la case de son sujet.

        **Le signal que l'atelier ne sait pas lever seul.** Sans appel payant,
        il ne voit pas ce qu'une image représente : une potion bleue dessinée à
        la place de la rouge est une tache unique, bien centrée dans sa case, et
        elle se range. Ce geste la reprend — l'image reste en bibliothèque, avec
        sa planche et son dépliage, mais n'est plus rangée chez personne ; la
        case passe « à vérifier » sur ce dépliage, et se refait seule si l'on
        veut.

        `identifiant` est **l'image**, pas la planche : c'est elle qu'on a sous
        les yeux quand on voit qu'elle n'est pas la bonne.
        """
        image = self._base.lire_asset(identifiant)
        if image is None:
            raise AssetInconnu(identifiant)
        if not image.planche or not image.depliage:
            raise DepliageRefuse(
                "cette image n'est pas sortie d'une planche — elle n'a pas de case "
                "à quitter"
            )
        generation, _, planche = self._resoudre(identifiant)
        pliage = generation.pliage
        assert pliage is not None
        if not pliage.plusieurs:
            raise DepliageRefuse(
                "cette planche ne porte qu'un sujet — ses images ne sont rangées "
                "d'après aucune liste"
            )
        depliage = next(
            (d for d in pliage.depliages_de(planche) if d.identifiant == image.depliage),
            None,
        )
        if depliage is None or image.rang not in depliage.rangs:
            raise DepliageRefuse("le dépliage de cette image n'est plus écrit")
        case = depliage.case_de(depliage.rangs.index(image.rang))
        if case is None:
            raise DepliageRefuse(
                "cette image ne remplit aucune case — une coupe ajoutée à la main "
                "n'est rangée chez personne"
            )
        retiree = self._pliage.retirer_du_rangement(generation, depliage, case, image)
        return {
            "planche": planche,
            "case": case,
            "image": retiree.en_json(),
            "depliage": depliage.en_json(),
        }

    def demande_de_case(
        self, identifiant: str, indice: int, modele: str | None = None
    ) -> dict[str, Any]:
        """Ce que « refaire cette case seule » enverrait — **rien n'est payé ici**.

        **Décision 1 de l'auteur, 18 septembre 2026** : une case ratée se refait
        seule, en image simple, et les autres ne sont pas repayées. Ce qui est
        rendu est le corps d'une génération ordinaire d'un seul sujet — le même
        que la fiche du sujet enverrait pour cette case : son signalement tel
        que la liste l'a écrit, sa pose, sa direction. L'argent ne part que par
        `POST /generations`, le seul endroit d'où il part ; la route qui sert
        ceci y ajoute l'annonce de prix habituelle (`ServiceEnvoi.envoi`).

        `indice` compte à partir de zéro, comme `cases` d'un dépliage refait.
        """
        generation, _, planche = self._resoudre(identifiant)
        pliage = generation.pliage
        assert pliage is not None
        if not pliage.plusieurs:
            raise DepliageRefuse(
                "cette planche ne porte qu'un sujet — une case ratée s'y refait "
                "avec la planche, ou depuis la fiche du sujet"
            )
        if not 0 <= indice < pliage.nombre:
            raise DepliageRefuse(
                f"la planche a {pliage.nombre} cases — il n'y a pas de case "
                f"n° {indice + 1}"
            )
        case = pliage.cases[indice]
        return {
            "planche": planche,
            "case": indice,
            "demande": {
                "modele": modele or generation.modele,
                "prompt": case.signalement or case.texte,
                "projet": generation.projet,
                "personnage": case.sujet,
                "pose": case.pose,
                "direction": case.direction,
            },
        }

    # ── Supprimer ────────────────────────────────────────────────────────────

    def supprimer(self, identifiant: str, numero: int) -> dict[str, Any]:
        """Les images d'un dépliage quittent la bibliothèque ; **lui reste écrit**.

        Ni la planche ni les autres dépliages ne sont touchés : on ne supprime
        que les images qui disent venir de celui-ci. Elles passent par la
        suppression ordinaire — même délai d'annulation, même purge —, et le
        dépliage garde ses rangs réservés à vie.
        """
        generation, _, planche = self._resoudre(identifiant)
        pliage = generation.pliage
        assert pliage is not None
        depliage = next(
            (d for d in pliage.depliages_de(planche) if d.numero == numero), None
        )
        if depliage is None:
            raise DepliageRefuse(f"cette planche n'a pas de dépliage n° {numero}")

        visees = [
            a.identifiant
            for a in self._images(generation, planche)
            if a.depliage == depliage.identifiant and a.supprime_le is None
        ]
        # **Le marquage d'abord** : une fermeture entre les deux laisserait
        # des images vivantes sous un dépliage marqué — elles se voient et se
        # suppriment encore. L'inverse laisserait des images purgées sous un
        # dépliage que la reprise croirait jamais déplié.
        self._pliage.oublier_depliage(generation, depliage)
        if visees:
            rendu = self._bibliotheque.supprimer(visees)
        else:
            rendu = {"supprimes": [], "annulation_s": 0.0, "expire_le": None}
        return {**rendu, "depliage": depliage.en_json()}

    # ── Ce qui dépend d'une planche ──────────────────────────────────────────

    def dependants(self, planche: str) -> dict[str, int]:
        """Combien d'images vivantes dépendent de cette planche.

        Deux sortes, comptées à part parce qu'elles n'en dépendent pas pareil :
        **les images dépliées** (`Asset.planche`), et **ce qui en dérive** par
        `parent` — une découpe de T5 posée sur la planche, par exemple. Les deux
        restent si la planche part ; c'est ce qu'on dit avant qu'elle parte.
        """
        generation_id, _, rang = planche.rpartition("-")
        depliees: set[str] = set()
        if rang.isdigit():
            generation = self._base.lire(generation_id)
            if generation is not None and generation.pliage is not None:
                depliees = {
                    a.identifiant
                    for a in self._images(generation, planche)
                    if a.supprime_le is None
                }
        derivees = {
            a.identifiant for a in self._base.enfants(planche)
        } - depliees
        return {
            "depliees": len(depliees),
            "derivees": len(derivees),
            "total": len(depliees) + len(derivees),
        }

    def est_une_planche(self, identifiant: str) -> bool:
        """Cet asset est-il la planche d'un appel plié (G16) ?

        Lue sur la forme de l'appel, jamais sur le libellé : l'asset tient le
        rang d'un emplacement d'une génération qui porte un pliage.
        """
        asset = self._base.lire_asset(identifiant)
        if asset is None or asset.planche:
            return False
        generation = self._base.lire(asset.generation)
        return (
            generation is not None
            and generation.pliage is not None
            and generation.emplacement(asset.rang) is not None
        )

    def verifier_suppression(self, identifiants: Iterable[str], confirmer: bool) -> None:
        """Refuse de supprimer une planche dont des images dépendent, sans « oui ».

        **Posé devant `POST /assets/delete`**, le seul chemin par lequel une
        image quitte la bibliothèque à la demande de l'auteur. Une planche sans
        dépendant part comme n'importe quelle image : il n'y a rien à dire.
        """
        if confirmer:
            return
        for identifiant in identifiants:
            if not self.est_une_planche(identifiant):
                continue
            compte = self.dependants(identifiant)
            if compte["total"]:
                raise PlancheAConfirmer(identifiant, compte)
