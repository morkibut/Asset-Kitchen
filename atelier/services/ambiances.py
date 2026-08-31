# -*- coding: utf-8 -*-
"""Les palettes nommées et les ambiances — créer, recalculer, supprimer (E11).

**Une palette reste une recette**, et ce module est le calcul. Il garde les
sources et les réglages ; le résultat est jetable, nommé par l'empreinte de ce
dont il est la lecture, et recalculé dès qu'elle ne correspond plus. C'est le
brut / recette / rendu d'une image, appliqué à une palette — le motif que le
produit applique déjà partout ailleurs.

**Ce que ça préserve, et qui était le vrai enjeu** : promouvoir une nouvelle
image officielle se propage encore jusqu'en bas, même à travers une ambiance
retouchée à la main. La règle « la palette est dérivable de ses sources » ne
bouge pas ; ce qui change est ce qu'une source peut être.

**Aucun appel payant n'est ajouté.** La fusion de deux palettes et l'attraction
des couleurs se font sur la machine, en millisecondes, réseau coupé — c'est un
critère d'acceptation de la tranche, et il est vrai par construction : ce module
n'importe rien qui parle au fournisseur.
"""

from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image

from dataclasses import replace
from typing import Any, Iterable, Sequence

from atelier.domaine.ambiance import (
    AJOUTER,
    DE_LA_MAIN,
    IMAGES,
    OFFICIELS,
    PALETTE,
    REMPLACER,
    RETIRER,
    Ambiance,
    Palette,
    Retouche,
    Source,
    empreinte_de_palette,
)
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.projet import Projet, repere
from atelier.services.bibliotheque import ProjetInconnu
from atelier.domaine.recette import AUCUN, Quantification
from atelier.image.palette import fusionner, palette_de
from atelier.image.traitement import quantifier

# Combien de palettes une palette peut traverser en cherchant ses couleurs.
# **Une garde, pas un réglage** : une palette qui se prendrait elle-même pour
# source — directement, ou par un cycle de trois — tournerait sans fin. La
# profondeur suffit largement à l'usage décrit (les palettes d'un coin du jeu
# assemblées à partir de celle du jeu), et un cycle rend simplement une source
# vide plutôt qu'une erreur : le produit constate, il ne refuse pas.
PROFONDEUR = 8

# Combien de couleurs on lit dans un paquet d'images **avant** de fusionner.
# Large exprès : c'est la fusion qui coupe ensuite au compte demandé, et lire
# court d'abord aurait décidé deux fois de la même chose — une palette de 24
# tirée d'une lecture à 24 n'aurait plus rien à choisir.
LARGEMENT = 64


class AmbianceRefusee(ErreurAtelier):
    """Une palette ou une ambiance ne peut pas être posée, et on dit pourquoi."""

    code = "ambiance_refusee"


class ServiceAmbiances:
    """Les deux listes du côté Ambiances, et le calcul qui les tient à jour.

    Il ne tient **aucun cache en mémoire** : les palettes vivent dans
    `projet.json`, relu à chaque fois comme le tableau et le plan. Une copie ici
    serait une seconde vérité, et deux écritures concurrentes la feraient
    diverger.
    """

    def __init__(self, base, bibliotheque, univers, production, assets) -> None:
        # `univers` sert à une chose et une seule : lire les cartes du tableau,
        # qui sont les sources d'une palette d'images. `production` en sert une
        # autre : dire qui se sert d'une ambiance — la réponse se lit sur les
        # choses du jeu, et une liste tenue sur l'ambiance serait une seconde
        # vérité qu'un renommage ferait diverger.
        self._base = base
        self._bibliotheque = bibliotheque
        self._univers = univers
        self._production = production
        self._assets = assets

    # ── Lire ─────────────────────────────────────────────────────────────────

    def _exiger(self, projet: str) -> Projet:
        objet = self._base.lire_projet(projet) if projet else None
        if objet is None:
            raise ProjetInconnu(
                projet, [p.identifiant for p in self._bibliotheque.projets()]
            )
        return objet

    def palettes(self, projet: str) -> tuple[Palette, ...]:
        """Les palettes de ce jeu, **recalculées si elles ne suivent plus**.

        Lire recalcule : c'est ce qui fait qu'une image promue en officiel
        change la palette du marais sans qu'on ait à toucher le marais. Le coût
        est une poignée de millisecondes, et il ne se paie que lorsque
        l'empreinte a changé.
        """
        return self._accorder(projet).palettes

    def ambiances(self, projet: str) -> tuple[Ambiance, ...]:
        return self._exiger(projet).ambiances

    def cote(self, projet: str) -> dict[str, Any]:
        """Tout ce que le côté Ambiances montre, **en un seul aller-retour**.

        Les deux listes n'existent pas l'une sans l'autre — une ambiance porte
        une palette, et une palette dit combien d'ambiances s'en servent —, et
        deux appels auraient rendu deux instants différents du même fichier.
        """
        objet = self._accorder(projet)
        return {
            "projet": objet.identifiant,
            "palettes": [self._palette_en_json(objet, p) for p in objet.palettes],
            "ambiances": [
                {**a.en_json(), "emplois": self._emplois(objet, a.identifiant)}
                for a in objet.ambiances
            ],
            # La palette du jeu, servie ici aussi : c'en est une comme les
            # autres, et l'écran la montre dans la même liste.
            "du_jeu": list(objet.univers.palette),
        }

    # ── Le calcul ────────────────────────────────────────────────────────────

    def _couleurs_de_source(
        self, objet: Projet, source: Source, profondeur: int
    ) -> tuple[str, ...]:
        """Les couleurs que cette source-là porte, quel que soit son genre.

        **Une source disparue rend une liste vide**, jamais une erreur : « une
        palette peut garder en mémoire des images qui n'existent plus. Elle garde
        alors ses couleurs et affiche que sa source a disparu, sans rien
        recalculer et sans rien effacer. »
        """
        if profondeur <= 0:
            return ()
        if source.genre == OFFICIELS:
            return tuple(objet.univers.palette)
        if source.genre == PALETTE:
            autre = objet.palette_nommee(source.reference)
            if autre is None:
                return ()
            return self._rendre(objet, autre, profondeur - 1)[0]
        # `images` : les cartes d'un paquet du tableau, lues comme la palette du
        # projet les lit — même fonction, même détourage préalable, mêmes
        # couleurs. Un second calcul ici aurait donné deux palettes différentes
        # pour les mêmes images.
        octets = []
        for carte in self._univers.cartes(objet.identifiant):
            if carte.groupe != source.reference:
                continue
            try:
                octets.append(self._univers.octets(objet.identifiant, carte.identifiant)[0])
            except Exception:  # noqa: BLE001 — un fichier disparu se voit en moins
                continue
        return palette_de(octets, LARGEMENT) if octets else ()

    def _rendre(
        self, objet: Projet, palette: Palette, profondeur: int = PROFONDEUR
    ) -> tuple[tuple[str, ...], list[dict[str, str]]]:
        """Les couleurs de cette palette, **et d'où chacune vient**.

        Trois provenances : `jeu` pour la première source, `ambiance` pour les
        suivantes, `main` pour ce qu'une retouche a ajouté. C'est la seule façon
        de comprendre ce qu'on regarde — sans ces marques, on ne saurait pas si
        un gris vient du jeu, donc si le changer ici serait une exception ou une
        redite.

        Les retouches s'appliquent **après** la fusion et dans leur ordre : une
        retouche qui ne trouve pas sa couleur ne fait rien et reste là, ce qui
        permet à une source de revenir sans qu'on ait à retaper le geste.
        """
        premieres = (
            self._couleurs_de_source(objet, palette.sources[0], profondeur)
            if palette.sources
            else ()
        )
        suivantes: list[str] = []
        for source in palette.sources[1:]:
            for couleur in self._couleurs_de_source(objet, source, profondeur):
                if couleur not in suivantes:
                    suivantes.append(couleur)

        # **Une source seule donne toute la palette.** Le curseur de proportion
        # partage entre la première et les suivantes ; sans suivante, il n'a
        # rien à partager, et laisser sa valeur décider aurait rendu une palette
        # vide sur le cas le plus courant — celui de la palette du jeu, qui n'a
        # jamais qu'une source.
        du_jeu = (
            palette.couleurs
            if len(palette.sources) < 2
            else min(palette.du_jeu, palette.couleurs)
        )
        fondue = fusionner(
            premieres, tuple(suivantes), palette.couleurs, du_jeu, palette.attraction
        )
        pastilles = [{"couleur": c, "venue": v, "retiree": ""} for c, v in fondue]

        for retouche in palette.retouches:
            vise = next(
                (p for p in pastilles if p["couleur"] == retouche.couleur), None
            )
            if retouche.geste == RETIRER:
                # **Montrée barrée, jamais cachée** : c'est une décision qu'on a
                # prise, on doit pouvoir l'annuler d'un clic. La pastille reste
                # donc dans la liste, marquée.
                if vise is not None:
                    vise["retiree"] = RETIRER
            elif retouche.geste == AJOUTER:
                if retouche.couleur and vise is None:
                    pastilles.append(
                        {"couleur": retouche.couleur, "venue": DE_LA_MAIN, "retiree": ""}
                    )
            elif retouche.geste == REMPLACER and vise is not None:
                vise["couleur"] = retouche.remplacement or vise["couleur"]
                vise["venue"] = DE_LA_MAIN

        rendue = tuple(p["couleur"] for p in pastilles if not p["retiree"])
        return rendue, pastilles

    def _empreinte(self, objet: Projet, palette: Palette) -> str:
        """De quoi cette palette est la lecture, **sources résolues comprises**.

        L'empreinte d'une source `images` porte les couleurs qu'elle rend, et non
        le nom du paquet : sans quoi ajouter une carte au paquet ne recalculerait
        rien, et c'est exactement ce que la tranche promet de préserver.
        """
        matieres = []
        for source in palette.sources:
            couleurs = self._couleurs_de_source(objet, source, PROFONDEUR)
            matieres.append(f"{source.genre}:{source.reference}:{','.join(couleurs)}")
        return empreinte_de_palette(
            matieres,
            palette.couleurs,
            palette.du_jeu,
            palette.attraction,
            palette.retouches,
        )

    def _accorder(self, projet: str) -> Projet:
        """Remet les palettes d'accord avec leurs sources, si elles ne le sont plus.

        **Ne recalcule que ce qui a bougé**, comme la palette du projet depuis
        T4 : l'empreinte tranche, et tout le reste — renommer une ambiance,
        écrire un texte — ne coûte rien.
        """
        objet = self._exiger(projet)
        if not objet.palettes:
            return objet
        accordees, change = [], False
        for palette in objet.palettes:
            empreinte = self._empreinte(objet, palette)
            if empreinte == palette.empreinte:
                accordees.append(palette)
                continue
            rendue, _ = self._rendre(objet, palette)
            accordees.append(replace(palette, rendue=rendue, empreinte=empreinte))
            change = True
        if not change:
            return objet
        objet.palettes = tuple(accordees)
        self._bibliotheque.sauver_projet(objet)
        return objet

    def _palette_en_json(self, objet: Projet, palette: Palette) -> dict[str, Any]:
        """La palette telle qu'elle franchit le port, **pastilles comprises**.

        Une pastille porte sa couleur, sa provenance et son éventuel retrait :
        l'écran ne recalcule rien, il montre ce que le serveur a lu. Un second
        calcul là-bas aurait divergé au premier ordre de retouches.
        """
        _, pastilles = self._rendre(objet, palette)
        return {
            **palette.en_json(),
            "pastilles": pastilles,
            # **Ce que ce curseur ne ferait pas**, dit en clair plutôt que laissé
            # à essayer : à « tout du jeu », il ne reste aucune couleur
            # d'ambiance à tirer, et les cinq valeurs rendent le même fichier.
            # Mesuré au banc avant d'écrire la tranche.
            "attraction_inerte": palette.attraction_inerte,
            "sources_perdues": [
                s.reference
                for s in palette.sources
                if not self._couleurs_de_source(objet, s, PROFONDEUR)
            ],
            "emplois": sum(
                1 for a in objet.ambiances if a.palette == palette.identifiant
            ),
        }

    def _emplois(self, objet: Projet, ambiance: str) -> list[dict[str, str]]:
        """Qui se sert de cette ambiance, **et ce que chacun lui prend**.

        Lu des choses du jeu et de nulle part ailleurs : une liste tenue sur
        l'ambiance serait une seconde vérité qu'un renommage ferait diverger.
        """
        emplois = []
        for personnage in self._production.personnages(objet.identifiant):
            if personnage.ambiance == ambiance:
                emplois.append(
                    {
                        "identifiant": personnage.identifiant,
                        "nom": personnage.nom,
                        "prend": personnage.prend,
                    }
                )
        return emplois

    # ── Écrire ───────────────────────────────────────────────────────────────

    def creer_palette(
        self,
        projet: str,
        nom: str,
        *,
        sources: Sequence[dict[str, Any]] = (),
        couleurs: int = 24,
    ) -> Palette:
        """**Nommer, c'est créer** — une palette naît d'un nom, et rien de plus.

        Sans source, elle est vide et le dit ; on lui en donne ensuite. Refuser
        de la créer tant qu'elle n'a pas de source aurait fait un formulaire là
        où le produit n'en a nulle part.
        """
        objet = self._exiger(projet)
        propre = nom.strip()
        if not propre:
            raise AmbianceRefusee("une palette se crée avec un nom")
        if any(p.nom.casefold() == propre.casefold() for p in objet.palettes):
            raise AmbianceRefusee(f"« {propre} » est déjà une palette de ce jeu")
        palette = Palette(
            identifiant=repere(
                propre, {p.identifiant for p in objet.palettes}, "palette"
            ),
            nom=propre,
            sources=tuple(Source.depuis_json(s) for s in sources),
            couleurs=couleurs,
            # **Tout de la première source, au départ.** Le curseur n'a de sens
            # qu'à partir de la deuxième, et un départ à zéro aurait rendu une
            # palette vide au moment même où l'on vient de la nommer.
            du_jeu=couleurs,
        )
        objet.palettes = (*objet.palettes, palette)
        self._bibliotheque.sauver_projet(objet)
        return self._accordee(projet, palette.identifiant)

    def regler_palette(
        self,
        projet: str,
        identifiant: str,
        *,
        nom: str | None = None,
        sources: Sequence[dict[str, Any]] | None = None,
        couleurs: int | None = None,
        du_jeu: int | None = None,
        attraction: float | None = None,
        retouches: Sequence[dict[str, Any]] | None = None,
    ) -> Palette:
        """Tout ce qui se règle sur une palette, **en un seul geste**.

        `None` ne touche pas — la règle du produit depuis C1 : les champs se
        remplissent ensemble à l'écran, et un appel par champ ferait autant
        d'allers-retours qu'il y a de curseurs.
        """
        objet = self._exiger(projet)
        palette = objet.palette_nommee(identifiant)
        if palette is None:
            raise AmbianceRefusee(f"aucune palette « {identifiant} » dans ce jeu")

        if nom is not None:
            propre = nom.strip()
            if not propre:
                raise AmbianceRefusee("une palette garde un nom")
            if any(
                autre.identifiant != identifiant
                and autre.nom.casefold() == propre.casefold()
                for autre in objet.palettes
            ):
                raise AmbianceRefusee(f"« {propre} » est déjà une palette de ce jeu")
            palette.nom = propre

        if sources is not None:
            propres = [Source.depuis_json(s) for s in sources]
            # **Une palette ne se prend pas elle-même pour source.** Ce serait un
            # cycle immédiat, et le seul cas où le produit peut le dire avec
            # certitude — les cycles plus longs, eux, s'arrêtent en profondeur.
            if any(
                s.genre == PALETTE and s.reference == identifiant for s in propres
            ):
                raise AmbianceRefusee(
                    f"« {palette.nom} » ne peut pas être sa propre source"
                )
            palette.sources = tuple(propres)

        if couleurs is not None:
            palette.couleurs = max(4, min(64, couleurs))
            palette.du_jeu = min(palette.du_jeu, palette.couleurs)

        if du_jeu is not None:
            palette.du_jeu = max(0, min(palette.couleurs, du_jeu))

        if attraction is not None:
            palette.attraction = max(0.0, min(1.0, attraction))

        if retouches is not None:
            palette.retouches = tuple(Retouche.depuis_json(r) for r in retouches)

        objet.palettes = tuple(
            palette if p.identifiant == identifiant else p for p in objet.palettes
        )
        self._bibliotheque.sauver_projet(objet)
        return self._accordee(projet, identifiant)

    def supprimer_palette(self, projet: str, identifiant: str) -> Palette:
        """Une palette part. **Les ambiances qui s'en servaient retombent sur le
        jeu** — elles ne perdent rien d'autre, et aucune image ne bouge."""
        objet = self._exiger(projet)
        palette = objet.palette_nommee(identifiant)
        if palette is None:
            raise AmbianceRefusee(f"aucune palette « {identifiant} » dans ce jeu")
        objet.palettes = tuple(
            p for p in objet.palettes if p.identifiant != identifiant
        )
        objet.ambiances = tuple(
            replace(a, palette="") if a.palette == identifiant else a
            for a in objet.ambiances
        )
        # Une palette qui prenait celle-ci pour source la perd, et se recalcule
        # sur ce qui reste : rien ne se casse, la source se voit en moins.
        objet.palettes = tuple(
            replace(
                p,
                sources=tuple(
                    s
                    for s in p.sources
                    if not (s.genre == PALETTE and s.reference == identifiant)
                ),
            )
            for p in objet.palettes
        )
        self._bibliotheque.sauver_projet(objet)
        return palette

    def creer_ambiance(
        self,
        projet: str,
        nom: str,
        *,
        palette: str = "",
        references: Sequence[str] = (),
    ) -> Ambiance:
        """**Nommer, c'est créer.** Une ambiance naît vide, et se remplit ensuite."""
        objet = self._exiger(projet)
        propre = nom.strip()
        if not propre:
            raise AmbianceRefusee("une ambiance se crée avec un nom")
        if any(a.nom.casefold() == propre.casefold() for a in objet.ambiances):
            raise AmbianceRefusee(f"« {propre} » est déjà une ambiance de ce jeu")
        if palette and objet.palette_nommee(palette) is None:
            raise AmbianceRefusee(f"aucune palette « {palette} » dans ce jeu")
        ambiance = Ambiance(
            identifiant=repere(
                propre, {a.identifiant for a in objet.ambiances}, "ambiance"
            ),
            nom=propre,
            palette=palette,
            references=tuple(references),
        )
        objet.ambiances = (*objet.ambiances, ambiance)
        self._bibliotheque.sauver_projet(objet)
        return ambiance

    def regler_ambiance(
        self,
        projet: str,
        identifiant: str,
        *,
        nom: str | None = None,
        palette: str | None = None,
        references: Sequence[str] | None = None,
        monde: str | None = None,
        eclairage: str | None = None,
        trait: str | None = None,
    ) -> Ambiance:
        """Les trois choses qu'une ambiance porte, et rien d'autre.

        **Il n'y a pas de champ pour la vue, la technique, l'époque ou le
        rendu**, et c'est le critère : une ambiance qui les remplacerait
        fabriquerait des images qui ne rentrent pas dans le jeu, erreur qui ne se
        verrait qu'après avoir payé. La fermeture est écrite dans la signature —
        pas dans un garde qu'on pourrait oublier de poser.
        """
        objet = self._exiger(projet)
        ambiance = objet.ambiance(identifiant)
        if ambiance is None:
            raise AmbianceRefusee(f"aucune ambiance « {identifiant} » dans ce jeu")

        if nom is not None:
            propre = nom.strip()
            if not propre:
                raise AmbianceRefusee("une ambiance garde un nom")
            if any(
                autre.identifiant != identifiant
                and autre.nom.casefold() == propre.casefold()
                for autre in objet.ambiances
            ):
                raise AmbianceRefusee(f"« {propre} » est déjà une ambiance de ce jeu")
            ambiance.nom = propre

        if palette is not None:
            if palette and objet.palette_nommee(palette) is None:
                raise AmbianceRefusee(f"aucune palette « {palette} » dans ce jeu")
            ambiance.palette = palette

        if references is not None:
            ambiance.references = tuple(r for r in references if r)
        if monde is not None:
            ambiance.monde = monde
        if eclairage is not None:
            ambiance.eclairage = eclairage
        if trait is not None:
            ambiance.trait = trait

        objet.ambiances = tuple(
            ambiance if a.identifiant == identifiant else a for a in objet.ambiances
        )
        self._bibliotheque.sauver_projet(objet)
        return ambiance

    def supprimer_ambiance(self, projet: str, identifiant: str) -> dict[str, Any]:
        """Une ambiance part, **et aucune image ne bouge**.

        Ce qui s'en servait retombe sur le jeu : il n'y a pas de trou, seulement
        un réglage qu'on ne pose plus. Le compte de ce qui retombe est rendu,
        parce qu'un geste qui touche plusieurs choses dit combien — comme la
        palette rétroactive rend « 12 remis à jour, 3 conservés ».
        """
        objet = self._exiger(projet)
        ambiance = objet.ambiance(identifiant)
        if ambiance is None:
            raise AmbianceRefusee(f"aucune ambiance « {identifiant} » dans ce jeu")
        retombees = self._production.oublier_ambiance(objet.identifiant, identifiant)
        objet.ambiances = tuple(
            a for a in objet.ambiances if a.identifiant != identifiant
        )
        self._bibliotheque.sauver_projet(objet)
        return {"ambiance": ambiance.en_json(), "retombees": retombees}

    # ── L'aperçu : la palette posée sur de vraies images ─────────────────────

    def apercu(
        self, projet: str, identifiant: str, combien: int = 3
    ) -> dict[str, Any]:
        """La palette **posée sur de vraies images du jeu**, côte à côte.

        C'est ce qui rend le réglage des deux curseurs jugeable : un mélange se
        voit sur un sprite, pas sur une bande de pastilles. Deux rangées des
        mêmes objets — avec les couleurs du jeu, avec celles de la palette —,
        parce qu'une seule ne dirait pas ce qui a changé.

        **Rien n'est écrit sur le disque** : les images repartent en `data:`,
        comme l'aperçu de la superposition. Un aperçu n'existe nulle part, et lui
        donner une adresse aurait obligé à ranger un brouillon quelque part —
        donc à le nettoyer.

        **Et rien n'est payé** : la quantification tourne sur la machine, en
        millisecondes.
        """
        objet = self._accorder(projet)
        palette = objet.palette_nommee(identifiant)
        if palette is None:
            raise AmbianceRefusee(f"aucune palette « {identifiant} » dans ce jeu")

        assets = [
            a
            for a in self._bibliotheque.chercher(projet=objet.identifiant, limite=48)
            if not a.supprime_le
        ][:combien]
        rangees, employees = [], set()
        for asset in assets:
            du_jeu, _ = self._pose(asset, tuple(objet.univers.palette))
            de_la_palette, vues = self._pose(asset, palette.rendue)
            employees |= vues
            rangees.append(
                {
                    "asset": asset.identifiant,
                    "nom": asset.label or asset.identifiant,
                    "du_jeu": du_jeu,
                    "de_la_palette": de_la_palette,
                }
            )

        # **Combien de couleurs ne servent à rien**, dit en clair : une palette
        # de 24 dont 5 ne paraissent sur aucune de ces images est une palette
        # qu'on croit plus riche qu'elle n'est. Le produit constate — il ne
        # retire rien, et ne conseille pas de retirer.
        return {
            "palette": identifiant,
            "couleurs": list(palette.rendue),
            "images": rangees,
            "employees": sorted(employees),
        }

    def _pose(self, asset, couleurs: tuple[str, ...]) -> tuple[str, set[str]]:
        """Cette image ramenée sur ces couleurs-là, en `data:`, sans rien écrire.

        Une palette vide rend l'image telle quelle : « un univers vide ne
        contraint rien », et poser une quantification sans couleurs aurait fait
        le contraire de ce que le vide veut dire.
        """
        try:
            octets, _ = self._assets.octets(asset)
        except Exception:  # noqa: BLE001 — une image disparue se voit en moins
            return "", set()
        if not couleurs:
            return _en_data(octets), set()
        with Image.open(io.BytesIO(octets)) as ouverte:
            rgba = np.asarray(ouverte.convert("RGBA")).copy()
        pose = quantifier(
            rgba, Quantification(couleurs=len(couleurs), palette=couleurs, tramage=AUCUN)
        )
        tampon = io.BytesIO()
        Image.fromarray(pose, mode="RGBA").save(tampon, format="PNG")

        # Les couleurs que cette image emploie vraiment — lues sur les pixels
        # opaques, parce qu'un pixel transparent n'a pas de couleur qu'on voie.
        opaques = pose.reshape(-1, 4)
        opaques = opaques[opaques[:, 3] > 0][:, :3]
        vues = {
            "#%02x%02x%02x" % tuple(int(c) for c in ligne)
            for ligne in np.unique(opaques, axis=0)
        } if opaques.size else set()
        return _en_data(tampon.getvalue()), vues

    # ── Ce que les autres services demandent ─────────────────────────────────

    def _accordee(self, projet: str, identifiant: str) -> Palette:
        accorde = self._accorder(projet)
        palette = accorde.palette_nommee(identifiant)
        if palette is None:  # pragma: no cover — écrite puis relue à l'instant
            raise AmbianceRefusee(f"aucune palette « {identifiant} » dans ce jeu")
        return palette

    def couleurs_pour(self, projet: str, ambiance: str) -> tuple[str, ...]:
        """Les couleurs qu'une ambiance impose au retour, ou celles du jeu.

        **La palette agit toujours au retour** : l'image revient, l'atelier la
        ramène sur les couleurs, sur la machine, gratuitement et
        rétroactivement. C'est déjà la mécanique de la palette du jeu ;
        l'ambiance ne fait que substituer la sienne.
        """
        objet = self._accorder(projet)
        trouvee = objet.ambiance(ambiance) if ambiance else None
        if trouvee is None or not trouvee.palette:
            return tuple(objet.univers.palette)
        palette = objet.palette_nommee(trouvee.palette)
        if palette is None or not palette.rendue:
            return tuple(objet.univers.palette)
        return palette.rendue


def _en_data(octets: bytes) -> str:
    """Une image en `data:`, comme l'aperçu de la superposition la rend.

    Écrit ici plutôt qu'importé : la superposition garde le sien pour un tableau
    de pixels, celui-ci part d'octets déjà encodés, et les deux n'ont en commun
    qu'un préfixe de six mots.
    """
    return "data:image/png;base64," + base64.b64encode(octets).decode("ascii")


def sources_depuis_json(brut: Iterable[dict[str, Any]] | None) -> tuple[Source, ...]:
    if not brut:
        return ()
    return tuple(Source.depuis_json(s) for s in brut if isinstance(s, dict))
