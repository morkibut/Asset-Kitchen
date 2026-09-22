# -*- coding: utf-8 -*-
"""La sortie — **un seul geste, et il se lit avant de se faire** (B21).

L'atelier savait sortir par quatre portes : une sélection de la galerie en
archive, un personnage dans le dossier du jeu, ses animations en archive, une
bande en archive. Aucune ne disait ce qu'elle allait écrire, et aucune ne savait
ce qu'elle avait écrit la fois d'avant.

**Ce service ne refait aucune des quatre.** Il appelle celles qui savent
fabriquer — `ServiceExport` pour le rendu d'une image, sa fiche, et les trois
fichiers d'une animation ; `ServiceAgent` pour poser un fichier dehors —, et il
ajoute les trois choses qui manquaient :

1. **Prévoir sans écrire.** Le plan est un générateur, et il sert deux fois : à
   l'aperçu, qui ne garde que les mesures, et à l'écriture, qui pose au fil de
   l'eau. Un seul parcours, donc *ce qui sort est exactement ce que l'aperçu
   montrait* — la seule façon de le tenir est de n'avoir qu'une écriture.
2. **Comparer à la fois d'avant.** Ce qui tranche est le dossier lui-même,
   relu ; ce que la mémoire ajoute est de savoir *quels fichiers de là-bas sont
   les nôtres*, sans quoi « effacer ce qui ne sort plus » effacerait le travail
   de quelqu'un d'autre.
3. **Un catalogue par moteur**, à côté du descriptif de l'atelier — jamais
   dedans, et jamais dans le fichier d'accompagnement d'Aseprite.

**Rien ne part sur le réseau**, et ça se lit dans les imports, comme pour
l'export : ni fournisseur, ni animateur, ni catalogue. Sortir est du disque et du
processeur.

**Depuis `RP17`, c'est la seule porte des *fichiers* vers le dossier du jeu** —
pas la seule écriture du serveur dans ce dossier : le paquet Godot d'AU1
(`services/livraison.py`, `_poser`) y écrit aussi, avec ses propres garanties
(journal, propriété prouvée, décisions de `RP10`). L'ancienne porte — un
personnage nommé posé sur le disque, sans aperçu et sans comparaison — est
retirée ; ce qu'elle savait faire est devenu un réglage d'ici, `Reglage.sujet`.
Une seule porte pour les fichiers veut dire une seule liste annoncée avant
d'être écrite, et c'est ce qui rend « rien n'est écrasé sans que la comparaison
l'ait dit » vérifiable plutôt que promis.

**Depuis `RV8`, le dossier est celui du jeu Godot rattaché** — l'association
d'AU1, plus un sous-dossier rangé à côté d'elle (`fichiers.json`). Le réglage
`dossier_jeu` de l'agent, commun à tout l'atelier, n'en décide plus : c'était la
fuite que B21 voulait fermer, deux jeux ouverts tour à tour se déposant au même
endroit.

**Les octets ne s'accumulent jamais.** La planche relève, sur l'archive
d'aujourd'hui, qu'elle est « construite entièrement en mémoire avant de partir,
et rien ne borne le nombre d'images acceptées ». L'aperçu serait le pire endroit
où refaire ça : il se demande plus souvent que l'écriture. Le générateur rend
donc un fichier à la fois, on le pèse, on l'empreinte, et on le laisse partir.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Iterator, Sequence

from atelier.depot import Base
from atelier.depot.fichiers import Fichiers
from atelier.domaine import sortie as vocabulaire
from atelier.domaine.asset import Asset
from atelier.domaine.bande import Bande
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.projet import repere
from atelier.domaine.sortie import (
    Apercu,
    Bilan,
    PasPret,
    Precedente,
    Prevu,
    Reglage,
)
from atelier.image import mesurer
from atelier.services.agent import ServiceAgent
from atelier.services.assets import ServiceAssets
from atelier.services.equipement import ServiceEquipement
from atelier.services.export import CALQUE, CORPS, HABILLE, ServiceExport
from atelier.services.livrables import bandes_livrables
from atelier.services.livraison import ServiceLivraison
from atelier.services.montage import ServiceMontage
from atelier.services.production import ServiceProduction, corps_retenu

# Le descriptif de l'atelier, **repris de l'export et pas renommé** : un agent
# qui sait lire celui d'une archive lit celui d'une sortie, et c'est le même
# code qui l'écrit.
from atelier.services.export import DESCRIPTIF, FORMAT


# ── D'où vient le dossier (`RV8`) ────────────────────────────────────────────
#
# Les quatre origines que `ServiceSortie.destination` rend, dans l'ordre de la
# chaîne. L'écran les lit pour dire d'où vient le dossier qu'il montre.
DEMANDE = "demande"  # nommé dans l'appel (l'écran, le `folder` du MCP)
JEU = "jeu"  # le jeu Godot rattaché, plus le sous-dossier des fichiers
ANCIEN = "ancien"  # la dernière sortie, en lecture seule
AUCUN = "aucun"

MENTION_ANCIEN = "ancien dossier, pas rattaché au jeu Godot"
REFUS_SANS_DOSSIER = (
    "aucun dossier de jeu — rattache ton jeu Godot (le dossier qui contient "
    "project.godot), ou nomme un dossier ici"
)


class SortieRefusee(ErreurAtelier):
    """Il n'y a rien à sortir, ou le dossier ne veut pas — et on dit lequel.

    L'écran grise d'abord, avec sa raison sous le bouton. Ce refus-ci est le
    filet : il existe pour l'appel qui n'a pas d'écran devant lui.
    """

    code = "sortie_refusee"


@dataclass(frozen=True, slots=True)
class Morceau:
    """Un fichier du plan, **avec ses octets, le temps d'un tour de boucle**.

    Il ne survit pas à l'itération suivante : c'est ce qui permet à un lot de
    sept cents fichiers de tenir dans la mémoire d'un aperçu.
    """

    sous_dossier: str
    nom: str
    octets: bytes
    role: str
    sujet: str = ""
    source: str = ""
    images: int = 0
    # **Mesurées une fois, à la fabrication, et zéro veut dire « pas mesuré ».**
    # Un descriptif et un catalogue sont du texte : ils n'ont pas de dimensions,
    # et l'arbre n'en affiche donc aucune pour eux. Écrire `0×0` ferait passer
    # une absence de mesure pour une mesure — c'est le piège de T6, payé sur les
    # dimensions d'un asset.
    largeur: int = 0
    hauteur: int = 0
    # Ce qui entre au descriptif de l'atelier. `None` pour le descriptif
    # lui-même et pour un catalogue : ils ne se décrivent pas eux-mêmes.
    fiche: dict[str, Any] | None = None
    animation: bool = False

    @property
    def chemin(self) -> str:
        return f"{self.sous_dossier}/{self.nom}" if self.sous_dossier else self.nom


class ServiceSortie:
    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        assets: ServiceAssets,
        production: ServiceProduction,
        equipement: ServiceEquipement,
        montage: ServiceMontage,
        agent: ServiceAgent,
        export: ServiceExport,
        livraison: ServiceLivraison | None = None,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._assets = assets
        self._production = production
        self._equipement = equipement
        self._montage = montage
        # **Celui qui pose les fichiers de cette porte** : ce service ne pose
        # pas un octet lui-même, il demande au dépôt de T7 — avec, depuis B21,
        # la permission d'écraser quand l'auteur l'a cochée devant la liste. (Le
        # paquet Godot d'AU1 écrit dans le même jeu par son propre chemin.)
        self._agent = agent
        # **Où est le jeu** (`RV8`) : l'association d'AU1 et le sous-dossier de
        # la forme « fichiers ». Absente — un service monté seul dans un essai —,
        # la chaîne saute cette source.
        self._livraison = livraison
        # **Celui qui sait fabriquer**, et qui n'est pas refait ici : le rendu
        # d'une image, sa fiche, et les trois fichiers d'une animation.
        self._export = export

    # ── Où ça va ────────────────────────────────────────────────────────────

    def dossier(self, projet: str, reglage: Reglage | None = None) -> str:
        """Le dossier de ce jeu-ci, en entier — ou `""` s'il n'y en a pas.

        La lecture est celle de `destination` ; ceci n'en garde que le chemin.
        """
        return self.destination(projet, reglage)["dossier"]

    def destination(self, projet: str, reglage: Reglage | None = None) -> dict[str, Any]:
        """Où la forme « fichiers » de ce jeu se pose, et **d'où on le sait** (`RV8`).

        Quatre sources, dans cet ordre, et la première qui répond gagne :

        1. `demande` — le dossier nommé dans l'appel (`Reglage.dossier`, le
           `folder` du MCP). Gardé tel quel : c'est l'entrée d'avant `RV8`, et
           c'est par elle que l'essai d'identité compare avant et après.
        2. `jeu` — la racine Godot rattachée (`association.json` d'AU1) et le
           sous-dossier de `fichiers.json`. **La source unique** : le même
           dossier quel que soit le chemin d'arrivée.
        3. `ancien` — le dossier de la dernière sortie (`sorties.json`), **en
           lecture seule**, avec sa mention : il n'est pas rattaché au jeu
           Godot. Rien n'est migré en silence ; quand ce dossier est sous un
           `project.godot`, `rattacher` propose de le rattacher en un clic.
        4. `aucun` — et le refus dit « rattache ton jeu Godot ».

        **`dossier_jeu` de l'agent n'est plus dans cette chaîne.** Commun à tout
        l'atelier, il déposait deux jeux au même endroit ; il reste le dossier
        du dépôt de l'agent (T7), et rien d'autre.

        Rend `{dossier, racine, sous_dossier, origine, mention, rattacher,
        refus}` : `dossier` est `racine/sous_dossier`, `""` quand il n'y en a
        pas ; `refus` est la phrase à montrer quand on ne peut pas sortir.
        """
        vide = {"dossier": "", "racine": "", "sous_dossier": "", "origine": AUCUN,
                "mention": "", "rattacher": None, "refus": ""}

        demande = ((reglage.dossier if reglage else None) or "").strip()
        if demande:
            return {**vide, "dossier": demande, "racine": demande, "origine": DEMANDE}

        association = self._association(projet)
        if association:
            racine = Path(association["dossier"])
            sous_dossier = self._livraison.fichiers(projet)["sous_dossier"]
            rendu = {**vide, "racine": str(racine), "sous_dossier": sous_dossier,
                     "origine": JEU}
            # **Un jeu déplacé ne se recrée pas en silence.** Sans ce contrôle,
            # le dépôt créerait le chemin manquant, et les fichiers partiraient
            # dans un dossier que Godot n'ouvre plus.
            if not (racine / "project.godot").is_file():
                return {**rendu, "refus": (
                    f"le jeu Godot rattaché n'est plus là — « {racine} » ne contient "
                    "plus de project.godot ; rattache ton jeu Godot de nouveau"
                )}
            return {**rendu, "dossier": str(racine / sous_dossier)}

        precedente = self.precedente(projet) if projet else None
        if precedente and precedente.dossier:
            return {**vide, "dossier": precedente.dossier, "racine": precedente.dossier,
                    "origine": ANCIEN, "mention": MENTION_ANCIEN,
                    "rattacher": _sous_un_jeu_godot(precedente.dossier)}

        return {**vide, "refus": REFUS_SANS_DOSSIER}

    def _association(self, projet: str) -> dict[str, Any] | None:
        """L'association d'AU1, **lue et jamais complétée** — son format est figé."""
        if self._livraison is None or not projet or self._base.lire_projet(projet) is None:
            return None
        return self._livraison.association(projet)

    def regler_sous_dossier(self, projet: str, sous_dossier: str) -> dict[str, Any]:
        """Pose le sous-dossier de la forme « fichiers », et rend la destination relue."""
        if self._livraison is None or not projet or self._base.lire_projet(projet) is None:
            raise SortieRefusee("ce jeu n'existe plus")
        self._livraison.regler_fichiers(projet, sous_dossier)
        return self.destination(projet)

    # ── La fois d'avant ─────────────────────────────────────────────────────

    def precedente(self, projet: str) -> Precedente | None:
        """Ce que ce jeu a sorti la dernière fois, ou `None`.

        `None` est un état normal et il se dit : un jeu qui n'est jamais sorti
        n'a pas de comparatif, et l'écran écrit « aucune sortie » plutôt que de
        montrer une colonne de zéros qui se lirait « rien n'a changé ».
        """
        brut = self._fichiers.lire_sorties().get(projet)
        if not isinstance(brut, dict):
            return None
        return Precedente(
            le=float(brut.get("le") or 0.0),
            dossier=str(brut.get("dossier") or ""),
            chemins=tuple(str(c) for c in (brut.get("chemins") or [])),
            octets=int(brut.get("octets") or 0),
        )

    def _garder(self, projet: str, dossier: str, chemins: Sequence[str], octets: int) -> float:
        instant = time.time()
        tout = self._fichiers.lire_sorties()
        tout[projet] = {
            "le": instant,
            "dossier": dossier,
            "chemins": list(chemins),
            "octets": octets,
        }
        self._fichiers.ecrire_sorties(tout)
        return instant

    # ── Prévoir ─────────────────────────────────────────────────────────────

    def prevoir(self, projet: str, reglage: Reglage) -> Apercu:
        """Ce qui sortirait — **et pas un octet n'est écrit** (B21).

        Le premier critère de la tranche : *l'arbre des fichiers se lit avant
        d'écrire, avec le compte et le poids total*. Rien ici n'ouvre un fichier
        en écriture, ne crée un dossier, ni ne touche à la mémoire de la sortie
        précédente — la seule chose qu'on lise du dossier de destination est ce
        qui s'y trouve déjà, pour le comparer.
        """
        _valider(reglage)
        destination = self.destination(projet, reglage)
        dossier = destination["dossier"]
        precedente = self.precedente(projet)
        pas_prets = self._pas_prets(projet, reglage)

        if not dossier.strip():
            return Apercu(
                dossier="",
                fichiers=(),
                restes=(),
                pas_prets=pas_prets,
                precedente=precedente,
                reglage=reglage,
                refus=destination["refus"] or REFUS_SANS_DOSSIER,
            )

        racine = Path(dossier).expanduser()
        prevus: list[Prevu] = []
        for morceau in self._plan(projet, reglage):
            prevus.append(self._marquer(racine, morceau))

        if not prevus:
            return Apercu(
                dossier=str(racine),
                fichiers=(),
                restes=(),
                pas_prets=pas_prets,
                precedente=precedente,
                reglage=reglage,
                refus="rien ne sort de ce lot — il n'y a aucune image à écrire",
            )

        return Apercu(
            dossier=str(racine),
            fichiers=tuple(prevus),
            restes=self._restes(racine, precedente, {p.chemin for p in prevus}),
            pas_prets=pas_prets,
            precedente=precedente,
            reglage=reglage,
        )

    def _marquer(self, racine: Path, morceau: Morceau) -> Prevu:
        """Nouveau, remplacé ou inchangé — **relu sur le dossier**.

        Deuxième critère de la tranche. La comparaison porte sur les octets, pas
        sur la date : une image dont on vient de refaire le rendu à l'identique
        n'a pas changé, et une date de fichier dirait le contraire à chaque
        passage. Comparer le contenu est aussi ce qui permet à *inchangé* de
        vouloir dire quelque chose — c'est le chiffre qui rend le geste tenable
        sur cinq cents sujets.
        """
        empreinte = _empreinte(morceau.octets)
        existant = _octets_de(racine / morceau.chemin)
        return _prevu(
            morceau,
            morceau.chemin,
            empreinte,
            vocabulaire.marque(
                existant, empreinte, _empreinte(existant) if existant else ""
            ),
        )

    def _restes(
        self, racine: Path, precedente: Precedente | None, sortants: set[str]
    ) -> tuple[Prevu, ...]:
        """Ce que la fois d'avant avait posé et qui ne sort plus.

        **Et rien d'autre.** Un fichier du dossier qui n'est dans aucune des
        deux listes appartient à l'auteur — un décor peint à la main, une police,
        le reste de son jeu —, et la sortie n'a jamais rien à en dire. C'est la
        seule chose que la mémoire de la sortie précédente sert à trancher, et
        c'est la raison pour laquelle elle existe.
        """
        # **Des chemins résolus, sans casse** (`RV8`) : le même dossier arrive
        # désormais par deux entrées — nommé à la main, ou relu de
        # l'association —, et une barre, une lettre de lecteur en minuscule ou
        # un `..` suffisaient à ce que « effacer ce qui ne sort plus » ne
        # retrouve plus rien.
        if precedente is None or not _meme_dossier(precedente.dossier, str(racine)):
            return ()
        restes = []
        for chemin in precedente.chemins:
            if chemin in sortants:
                continue
            fichier = racine / chemin
            if not fichier.is_file():
                continue
            restes.append(
                Prevu(
                    chemin=chemin,
                    octets=fichier.stat().st_size,
                    empreinte="",
                    marque=vocabulaire.RESTE,
                    role="",
                )
            )
        return tuple(restes)

    # ── Écrire ──────────────────────────────────────────────────────────────

    def ecrire(self, projet: str, reglage: Reglage) -> Bilan:
        """La sortie, pour de vrai — **le même plan, posé cette fois**.

        L'aperçu est refait ici plutôt que reçu de l'écran, et c'est voulu : un
        aperçu vieux de deux minutes décrirait un jeu qu'on vient de modifier, et
        « ce qui sort est ce que l'aperçu montrait » ne tiendrait que tant que
        personne ne travaille entre les deux. Le plan étant un seul code, le
        refaire coûte le prix du disque et rend la même liste.
        """
        _valider(reglage)
        destination = self.destination(projet, reglage)
        dossier = destination["dossier"]
        if not dossier.strip():
            # **Pas d'`ou_aller` vers les Réglages** (`RV8`) : le dossier ne s'y
            # pose plus. On le rattache sur l'écran de livraison lui-même.
            raise SortieRefusee(destination["refus"] or REFUS_SANS_DOSSIER)

        racine = Path(dossier).expanduser()
        # **On prévoit d'abord, entièrement, et on écrit ensuite.** C'est ce que
        # « s'arrêter s'il y a un doublon » exige — s'arrêter au milieu aurait
        # laissé la moitié d'un lot dans le jeu —, et ça ne coûte qu'un second
        # parcours du plan, sans octet gardé.
        apercu = self.prevoir(projet, reglage)
        if apercu.refus:
            raise SortieRefusee(apercu.refus)

        if reglage.collision == vocabulaire.ARRETER:
            deja = [f for f in apercu.fichiers if f.marque != vocabulaire.NOUVEAU]
            if deja:
                raise SortieRefusee(
                    f"« {deja[0].chemin} » existe déjà, et {len(deja)} fichiers "
                    "en tout — rien n'a été écrit"
                )

        marques = {f.chemin: f.marque for f in apercu.fichiers}
        ecraser = reglage.collision in (vocabulaire.REMPLACER, vocabulaire.EFFACER)

        ecrits: list[Prevu] = []
        inchanges = 0
        poses: list[str] = []
        descriptif = ""
        catalogue = ""

        for morceau in self._plan(projet, reglage):
            # **Un fichier identique ne se réécrit pas**, quand on remplace : le
            # disque n'y gagnerait rien et la date de tous les fichiers du jeu
            # sauterait à chaque sortie, ce qui ferait recompiler un projet
            # entier pour trois sprites corrigés.
            if ecraser and marques.get(morceau.chemin) == vocabulaire.INCHANGE:
                inchanges += 1
                poses.append(morceau.chemin)
                continue
            pose = self._poser(
                racine, morceau, ecraser, marques.get(morceau.chemin, "")
            )
            ecrits.append(pose)
            poses.append(pose.chemin)
            if morceau.role == vocabulaire.DESCRIPTIF:
                descriptif = pose.chemin
            elif morceau.role == vocabulaire.CATALOGUE:
                catalogue = pose.chemin

        effaces: tuple[str, ...] = ()
        if reglage.collision == vocabulaire.EFFACER:
            effaces = self._effacer(racine, apercu.restes)

        instant = self._garder(
            projet, str(racine), poses, sum(f.octets for f in apercu.fichiers)
        )

        return Bilan(
            dossier=str(racine),
            ecrits=tuple(ecrits),
            effaces=effaces,
            inchanges=inchanges,
            descriptif=str(racine / descriptif) if descriptif else "",
            catalogue=str(racine / catalogue) if catalogue else "",
            le=instant,
        )

    def _poser(
        self, racine: Path, morceau: Morceau, ecraser: bool, prevue: str = ""
    ) -> Prevu:
        """Un fichier posé dehors — **par le geste de T7, jamais à côté**.

        Le sous-dossier voyage dans le dossier plutôt que dans le nom : c'est
        ce qui laisse à `ServiceAgent.deposer` ses trois règles intactes, la
        création du dossier manquant comprise — un rangement en dossiers crée
        alors `personnages/` sans qu'une ligne de plus soit écrite ici.

        **La marque rendue est celle de ce qui a été fait**, pas celle qui était
        prévue. Quand on numérote, le dépôt change le nom sous nos pieds : le
        fichier posé est alors neuf, et le dire « remplacé » serait le
        malentendu même que la planche décrit — trois sorties, trois fichiers,
        et un jeu qui charge le plus vieux.
        """
        ou = racine / morceau.sous_dossier if morceau.sous_dossier else racine
        chemin = self._agent.deposer(
            morceau.octets, morceau.nom, str(ou), ecraser=ecraser
        )
        pose = Path(chemin).name
        relatif = (
            f"{morceau.sous_dossier}/{pose}" if morceau.sous_dossier else pose
        )
        marque = prevue or vocabulaire.NOUVEAU
        if relatif != morceau.chemin:
            marque = vocabulaire.NOUVEAU
        return _prevu(morceau, relatif, _empreinte(morceau.octets), marque)

    @staticmethod
    def _effacer(racine: Path, restes: Sequence[Prevu]) -> tuple[str, ...]:
        """Retire ce que la fois d'avant avait posé et qui ne sort plus.

        **Seulement les nôtres, et seulement des fichiers.** Un dossier vidé
        n'est pas retiré : il a pu être créé par l'auteur, et un dossier vide ne
        fait de mal à personne — au contraire d'un dossier effacé qui contenait
        autre chose.
        """
        partis = []
        for reste in restes:
            fichier = racine / reste.chemin
            try:
                fichier.unlink()
            except OSError:
                # Un fichier verrouillé par le moteur de jeu ouvert à côté ne
                # doit pas arrêter la sortie : les images sont déjà posées, et
                # c'est ce qui compte. Il reparaîtra au prochain aperçu.
                continue
            partis.append(reste.chemin)
        return tuple(partis)

    # ── Le plan — **une seule écriture, lue deux fois** ──────────────────────

    def _plan(self, projet: str, reglage: Reglage) -> Iterator[Morceau]:
        """Ce qui sort, fichier par fichier, dans l'ordre de l'arbre.

        **Un générateur, et c'est la décision qui tient tout le reste** : le
        même code sert l'aperçu et l'écriture, donc les deux ne peuvent pas
        diverger, et aucun des deux ne garde plus d'un fichier en mémoire.

        **Le descriptif et le catalogue sont dedans**, en queue, et c'est ce que
        la planche dessine — l'arbre les montre à la racine, sous les dossiers.
        Les laisser dehors aurait eu une conséquence qu'on n'aurait pas devinée :
        le descriptif de la fois d'avant, absent de la liste des sortants, se
        serait annoncé comme *un reste à effacer*.

        Ils viennent en dernier parce qu'ils parlent des autres : le descriptif
        nomme chaque fichier, le catalogue les range. Écrits d'avance, ils
        auraient annoncé des noms que le dépôt n'avait pas encore attribués.
        """
        objet = self._base.lire_projet(projet)
        if objet is None:
            raise SortieRefusee("ce jeu n'existe plus")

        # **Un sujet nommé qui n'est pas de ce jeu est une faute d'appel**, pas
        # un lot vide : sans ce refus, l'agent recevrait « rien ne sort de ce
        # lot » pour une coquille dans un identifiant, et chercherait la panne
        # du côté des images.
        if reglage.sujet and not self._sujets(projet, objet, reglage):
            raise SortieRefusee(
                f"« {reglage.sujet} » n'est pas un sujet de ce jeu"
            )

        pris: set[str] = set()
        pieces = {p.identifiant: p for p in self._equipement.pieces(projet)}
        poses = {p.identifiant: p for p in self._production.plan(projet)}

        fiches: list[dict[str, Any]] = []
        animees: list[dict[str, Any]] = []
        # Les morceaux déjà rendus, **sans leurs octets** : le catalogue a
        # besoin de leurs noms et de leurs tailles, jamais de leurs pixels.
        sans_poids: list[Morceau] = []

        def _retenir(morceau: Morceau) -> Morceau:
            if morceau.fiche is not None:
                (animees if morceau.animation else fiches).append(morceau.fiche)
            sans_poids.append(replace(morceau, octets=b"", fiche=None))
            return morceau

        # **Un sujet nommé sort en entier** (`RP17`) : ses images *et* ses
        # animations, quel que soit le lot. C'est ce que l'ancienne porte
        # promettait — « un personnage complet » — et ce que l'auteur attend
        # quand il en désigne un.
        un_seul = bool(reglage.sujet)

        if un_seul or reglage.lot != vocabulaire.ANIMATIONS:
            for personnage, famille in self._sujets(projet, objet, reglage):
                for morceau in self._images_du_sujet(
                    projet, personnage, famille, reglage, poses, pieces, pris
                ):
                    yield _retenir(morceau)

        if un_seul or reglage.lot in (vocabulaire.TOUT, vocabulaire.ANIMATIONS):
            for morceau in self._animations(projet, objet, reglage, pris):
                yield _retenir(morceau)

        if not sans_poids:
            return

        yield self._descriptif(projet, reglage, fiches, animees)
        catalogue = self._catalogue(projet, reglage, sans_poids)
        if catalogue is not None:
            yield catalogue

    def _sujets(
        self, projet: str, objet: Any, reglage: Reglage
    ) -> list[tuple[Any, str]]:
        """Les sujets du lot, avec la famille de chacun.

        La famille se **lit dans le type**, comme partout ailleurs — c'est la
        règle d'`E15`, et la redire ici en aurait fait une seconde.

        **Un sujet nommé réduit la liste à lui seul** (`RP17`), et le lot n'est
        plus consulté : c'est le sens de `Reglage.sujet`, écrit une fois.
        """
        voulus = []
        for personnage in self._production.personnages(projet):
            famille = objet.univers.famille_du_type(personnage.type)
            if reglage.sujet:
                if personnage.identifiant == reglage.sujet:
                    voulus.append((personnage, famille))
            elif reglage.lot == vocabulaire.TOUT or reglage.lot == famille:
                voulus.append((personnage, famille))
        return voulus

    def _images_du_sujet(
        self,
        projet: str,
        personnage: Any,
        famille: str,
        reglage: Reglage,
        poses: dict[str, Any],
        pieces: dict[str, Any],
        pris: set[str],
    ) -> Iterator[Morceau]:
        """Les corps et les calques d'un sujet — **une image par direction**.

        ⚠️ **C'est ici que la sortie cesse de perdre les directions**, et la
        planche appelle ça *le piège le plus cher du sujet* : l'export d'un
        personnage n'emporte qu'une image par pose, sans dire laquelle des
        quatre, si bien qu'un jeu à quatre angles reçoit un quart de son
        personnage sans que rien ne le signale. La matrice, elle, connaît ses
        colonnes depuis `E10` : on les parcourt.

        **Le choix dans une colonne reste `corps_retenu`** — le favori d'abord,
        sinon la plus récente. Une seconde règle de retenue aurait fait montrer
        à l'écran une image et sortir l'autre.

        **Les calques suivent leur corps, jamais l'inverse.** Une pose sans corps
        ne sort pas, ses calques compris : c'est la règle de C5, et elle tient
        parce qu'un calque seul dans un dossier de jeu ne se pose sur rien.
        """
        sous_dossier = famille if reglage.rangement == vocabulaire.EN_DOSSIERS else ""
        mot_sujet = repere(personnage.nom or personnage.identifiant, (), "sujet")

        for case in self._production.cases(projet, personnage):
            pose = poses.get(case["pose"])
            mot_pose = repere(pose.nom if pose else case["pose"], (), "pose")
            colonnes = case.get("directions") or []
            # **Aucun corps sorti de cette pose, aucun calque non plus.** La
            # règle est celle de C5, et elle ne tenait pas ici : un corps
            # supprimé laissait partir ses calques seuls, que rien dans le jeu
            # ne peut poser sur quoi que ce soit. Trouvé en refermant l'autre
            # porte (`RP17`), sur l'essai que C5 avait écrit pour elle.
            un_corps = False

            for colonne in colonnes or [None]:
                images = self._assets_de(
                    colonne["images"] if colonne else case["images"]
                )
                corps = corps_retenu(images)
                if corps is None:
                    continue
                un_corps = True
                mot_direction = (
                    repere(colonne["nom"] or colonne["identifiant"], (), "direction")
                    if colonne
                    else ""
                )
                base = "-".join(m for m in (mot_sujet, mot_pose, mot_direction) if m)
                yield self._image(
                    corps,
                    sous_dossier,
                    repere(base, pris, "image"),
                    pris,
                    CORPS,
                    personnage.identifiant,
                    {
                        "pose": _nomme(case["pose"], pose),
                        "direction": (
                            {
                                "identifiant": colonne["identifiant"],
                                "nom": colonne["nom"],
                            }
                            if colonne
                            else None
                        ),
                        "piece": None,
                    },
                )

            if not un_corps:
                continue

            # **Les calques, une fois par pose et non par direction.** La matrice
            # ne range les pièces que sur l'axe des poses (`C3`) : les répéter
            # par colonne sortirait quatre fois la même image sous quatre noms.
            for identifiant_piece, retenu in (case.get("retenus") or {}).items():
                calque = self._assets.lire(retenu)
                if calque is None:
                    continue
                piece = pieces.get(identifiant_piece)
                mot_piece = repere(
                    piece.nom if piece else identifiant_piece, (), "piece"
                )
                base = f"{mot_sujet}-{mot_pose}-{mot_piece}"
                yield self._image(
                    calque,
                    sous_dossier,
                    repere(base, pris, "image"),
                    pris,
                    # Calque ou corps habillé : la recette le dit, et le
                    # descriptif le répète — l'un s'empile sur le corps, l'autre
                    # le remplace. Même règle qu'à l'export, même appel.
                    CALQUE if calque.recette.calque else HABILLE,
                    personnage.identifiant,
                    {
                        "pose": _nomme(case["pose"], pose),
                        "direction": None,
                        "piece": {
                            "identifiant": identifiant_piece,
                            "nom": piece.nom if piece else identifiant_piece,
                        },
                    },
                )

    def _image(
        self,
        asset: Asset,
        sous_dossier: str,
        mot: str,
        pris: set[str],
        role: str,
        sujet: str,
        contexte: dict[str, Any],
    ) -> Morceau:
        pris.add(mot)
        octets = self._export.octets_du_rendu(asset)
        nom = f"{mot}.png"
        mesure = mesurer(octets)
        return Morceau(
            sous_dossier=sous_dossier,
            nom=nom,
            octets=octets,
            role=role,
            sujet=sujet,
            source=asset.identifiant,
            largeur=mesure.largeur,
            hauteur=mesure.hauteur,
            fiche={
                "role": role,
                **contexte,
                **self._export.fiche_de_l_asset(asset, nom, octets),
            },
        )

    def _animations(
        self, projet: str, objet: Any, reglage: Reglage, pris: set[str]
    ) -> Iterator[Morceau]:
        """Les trois fichiers de chaque animation gardée du jeu.

        **Demandés à l'export, jamais refaits** : la planche de sprites, le
        fichier d'accompagnement au format Aseprite et l'image animée sortent du
        même appel que l'archive d'`A4`. C'est ce qui fait qu'ils ne peuvent pas
        diverger, et c'est aussi ce qui garantit le sixième critère de la
        tranche — *le format Aseprite ne gagne aucune clé de notre cru* : on ne
        touche pas au dictionnaire qu'il rend.
        """
        sous_dossier = (
            vocabulaire.DOSSIER_DES_ANIMATIONS
            if reglage.rangement == vocabulaire.EN_DOSSIERS
            else ""
        )
        for gardee in self._bandes(projet, reglage.sujet):
            bande, nom, planche, descriptif, animee = self._export.trois_fichiers(
                gardee.identifiant, "", pris
            )
            fiche = self._export.fiche_de_la_bande(bande, nom, descriptif)
            # **La taille lue sur l'accompagnement, jamais recalculée** : c'est
            # la règle d'`A4`, et elle vaut ici pour la même raison — deux
            # endroits qui diraient la taille d'une case finiraient par ne plus
            # dire la même.
            entiere = descriptif["meta"]["size"]
            yield Morceau(
                sous_dossier=sous_dossier,
                nom=f"{nom}.png",
                octets=planche,
                role=vocabulaire.PLANCHE,
                sujet=bande.personnage or "",
                source=bande.identifiant,
                images=bande.compte,
                largeur=int(entiere["w"]),
                hauteur=int(entiere["h"]),
                fiche=fiche,
                animation=True,
            )
            yield Morceau(
                sous_dossier=sous_dossier,
                nom=f"{nom}.json",
                octets=json.dumps(descriptif, ensure_ascii=False, indent=2).encode(
                    "utf-8"
                ),
                role=vocabulaire.ACCOMPAGNEMENT,
                sujet=bande.personnage or "",
                source=bande.identifiant,
                images=bande.compte,
                animation=True,
            )
            mesure = mesurer(animee)
            yield Morceau(
                sous_dossier=sous_dossier,
                nom=f"{nom}-anime.png",
                octets=animee,
                role=vocabulaire.ANIMEE,
                sujet=bande.personnage or "",
                source=bande.identifiant,
                images=bande.compte,
                largeur=mesure.largeur,
                hauteur=mesure.hauteur,
                animation=True,
            )

    def _bandes(self, projet: str, sujet: str = "") -> list[Bande]:
        """Les animations de ce jeu, écartées et vides exclues.

        **Une bande sans image ne sort pas** : elle ne peut pas faire de planche
        de sprites, et la demander en ferait une panne au milieu d'un lot. Elle
        se dit dans le panneau de ce qui n'est pas prêt, ce qui est le bon
        endroit pour en parler.

        `sujet` réduit la liste à celles d'un seul personnage (`RP17`).

        **Une bande dont tous les clips ont échoué ne sort pas non plus**
        (`RV8`) : la règle est `bandes_livrables`, la même que le paquet Godot,
        et `_pas_prets` la dit.
        """
        livrables = bandes_livrables(self._base, projet, sujet or None)
        return [bande for bande in livrables.bandes if bande.compte > 0]

    def _assets_de(self, fiches: Sequence[dict[str, Any]]) -> list[Asset]:
        lus = (self._assets.lire(f.get("identifiant", "")) for f in fiches)
        return [a for a in lus if a is not None]

    # ── Le descriptif de l'atelier ──────────────────────────────────────────

    def _descriptif(
        self,
        projet: str,
        reglage: Reglage,
        fiches: Sequence[dict[str, Any]],
        animations: Sequence[dict[str, Any]],
    ) -> Morceau:
        """Le même fichier que l'archive et que la sortie d'un personnage.

        Mêmes clés, même code de fiche, et les animations sous `animations`
        plutôt que sous `assets` — c'est la décision d'`A4`, et la reprendre
        telle quelle évite qu'un agent charge une planche de sprites comme un
        sprite.

        **`personnage` quand un seul sujet est sorti** (`RP17`), et rien sinon :
        c'est ce que l'ancienne porte écrivait en tête de son descriptif, et
        sans lui un dossier reçu tout seul ne dit plus de qui il est. Un lot
        entier n'a pas de personnage, et écrire `null` là serait une clé à
        interpréter plutôt qu'une absence.
        """
        objet = self._base.lire_projet(projet)
        sujet = (
            self._production.personnage(projet, reglage.sujet)
            if reglage.sujet
            else None
        )
        return Morceau(
            sous_dossier="",
            nom=DESCRIPTIF,
            octets=json.dumps(
                {
                    "atelier": "Asset Kitchen",
                    "format": FORMAT,
                    "exporte_le": time.time(),
                    "projet": {
                        "identifiant": projet,
                        "nom": objet.nom if objet else projet,
                    },
                    **(
                        {
                            "personnage": {
                                "identifiant": sujet.identifiant,
                                "nom": sujet.nom,
                                "description": sujet.description,
                            }
                        }
                        if sujet is not None
                        else {}
                    ),
                    "emplacements": [
                        e.en_json()
                        for e in sorted(
                            self._equipement.emplacements(projet),
                            key=lambda e: (e.rang, e.identifiant),
                        )
                    ],
                    "compte": len(fiches) + len(animations),
                    "assets": list(fiches),
                    "animations": list(animations),
                },
                ensure_ascii=False,
                indent=2,
            ).encode("utf-8"),
            role=vocabulaire.DESCRIPTIF,
        )

    # ── Le catalogue du moteur ──────────────────────────────────────────────

    def _catalogue(
        self, projet: str, reglage: Reglage, poses: Sequence[Morceau]
    ) -> Morceau | None:
        """Le fichier que le moteur choisi sait lire — **à côté, jamais dedans**.

        C'est la troisième chose qui n'existait nulle part : l'atelier n'écrivait
        qu'un seul fichier qu'un moteur sait lire seul, l'accompagnement d'une
        planche de sprites. Pour tout le reste, un dossier d'images et un
        descriptif maison qu'il faut apprendre à lire.

        **Rien de ce qui est écrit ici n'entre dans le format d'Aseprite.** Ce
        format appartient à quelqu'un d'autre, et le sixième critère de la
        tranche dit qu'il ne gagne aucune clé de notre cru : le catalogue est un
        fichier de plus, à côté, avec le nom du jeu.
        """
        if reglage.moteur == vocabulaire.AUCUN:
            return None
        objet = self._base.lire_projet(projet)
        jeu = repere(objet.nom if objet else projet, (), "jeu")
        images = [m for m in poses if m.role in (CORPS, CALQUE, HABILLE)]
        planches = [m for m in poses if m.role == vocabulaire.PLANCHE]

        if reglage.moteur == vocabulaire.GODOT:
            return Morceau(
                sous_dossier="",
                nom=f"{jeu}.tres",
                octets=_godot(planches).encode("utf-8"),
                role=vocabulaire.CATALOGUE,
            )
        if reglage.moteur == vocabulaire.PHASER:
            return Morceau(
                sous_dossier="",
                nom=f"{jeu}-phaser.json",
                octets=_phaser(jeu, images, planches).encode("utf-8"),
                role=vocabulaire.CATALOGUE,
            )
        return Morceau(
            sous_dossier="",
            nom=f"{jeu}-unity.json",
            octets=_unity(jeu, images, planches).encode("utf-8"),
            role=vocabulaire.CATALOGUE,
        )

    # ── Ce qui n'est pas prêt ───────────────────────────────────────────────

    def _pas_prets(self, projet: str, reglage: Reglage) -> tuple[PasPret, ...]:
        """Les quatre alertes de la colonne de droite (quatrième critère).

        **Elles se lisent sur le même calcul que l'arbre**, jamais sur un second :
        un sujet est « sans image » parce qu'aucune de ses cases n'a de corps,
        c'est-à-dire très exactement parce que le plan n'a rien produit pour lui.
        Deux comptes tirés de deux règles auraient fini par se contredire — un
        panneau qui annonce six sujets sautés pendant que l'arbre en montre cinq.
        """
        objet = self._base.lire_projet(projet)
        if objet is None:
            return ()

        directions = len(objet.univers.directions_du_jeu())
        sans_image: list[dict[str, str]] = []
        une_direction: list[dict[str, str]] = []
        habilles: list[dict[str, str]] = []

        if reglage.sujet or reglage.lot != vocabulaire.ANIMATIONS:
            for personnage, _famille in self._sujets(projet, objet, reglage):
                cases = self._production.cases(projet, personnage)
                remplies = [c for c in cases if c.get("corps")]
                if not remplies:
                    sans_image.append(
                        {
                            "identifiant": personnage.identifiant,
                            "nom": personnage.nom or personnage.identifiant,
                            "quoi": "aucune image",
                        }
                    )
                    continue
                # **Une seule colonne remplie là où le jeu en déclare
                # plusieurs.** Ce sujet-là sortira, et c'est ce qui le rend
                # dangereux : le jeu le fera pivoter ou l'affichera de travers,
                # et rien dans le dossier ne dira pourquoi.
                if directions > 1:
                    tenues = {
                        colonne["identifiant"]
                        for case in remplies
                        for colonne in (case.get("directions") or [])
                        if colonne.get("images")
                    }
                    if len(tenues) == 1:
                        une_direction.append(
                            {
                                "identifiant": personnage.identifiant,
                                "nom": personnage.nom or personnage.identifiant,
                                "quoi": f"1 direction sur {directions}",
                            }
                        )
                for case in cases:
                    for piece, retenu in (case.get("retenus") or {}).items():
                        calque = self._assets.lire(retenu)
                        if calque is not None and not calque.recette.calque:
                            habilles.append(
                                {
                                    "identifiant": personnage.identifiant,
                                    "nom": personnage.nom or personnage.identifiant,
                                    "quoi": f"la pièce « {piece} » remplace le corps",
                                }
                            )

        # Un sujet nommé ne fait pas parler des animations d'un autre.
        livrables = bandes_livrables(self._base, projet, reglage.sujet or None)
        vides = [
            {
                "identifiant": b.identifiant,
                "nom": b.nom or b.identifiant,
                "quoi": "aucune image",
            }
            for b in livrables.bandes
            if b.compte <= 0
        ]
        # **Les animations tirées de clips tous échoués** (`RV8`) : écartées
        # par la règle commune, et dites ici plutôt que tues.
        echouees = [
            {
                "identifiant": b.identifiant,
                "nom": b.nom or b.identifiant,
                "quoi": "tirée d'un clip échoué",
            }
            for b in livrables.ecartees
        ]

        alertes = []
        if sans_image:
            alertes.append(
                PasPret(
                    genre=vocabulaire.SANS_IMAGE,
                    phrase="ils seront sautés — aucune de leurs poses n'a d'image",
                    sujets=tuple(sans_image),
                )
            )
        if une_direction:
            alertes.append(
                PasPret(
                    genre=vocabulaire.UNE_SEULE_DIRECTION,
                    phrase=(
                        f"le jeu en déclare {directions} ; ceux-là sortiront avec "
                        "une seule image par pose"
                    ),
                    sujets=tuple(une_direction),
                )
            )
        if vides:
            alertes.append(
                PasPret(
                    genre=vocabulaire.ANIMATION_VIDE,
                    phrase=(
                        "une animation dont les images ont été retirées ne peut "
                        "pas faire de planche de sprites"
                    ),
                    sujets=tuple(vides),
                )
            )
        if echouees:
            alertes.append(
                PasPret(
                    genre=vocabulaire.ANIMATION_ECHOUEE,
                    phrase=(
                        "leurs images viennent d'un clip échoué ; elles ne partent "
                        "pas — refais le clip, ou monte l'animation sur un autre"
                    ),
                    sujets=tuple(echouees),
                )
            )
        if habilles:
            alertes.append(
                PasPret(
                    genre=vocabulaire.CORPS_HABILLE,
                    phrase=(
                        "ces pièces remplacent le corps au lieu de s'empiler "
                        "dessus ; le descriptif le dit, un moteur qui ne le lit "
                        "pas montrera deux corps"
                    ),
                    sujets=tuple(habilles),
                )
            )
        return tuple(alertes)


# ── Les catalogues, un par moteur ───────────────────────────────────────────


def _godot(planches: Sequence[Morceau]) -> str:
    """Une ressource `SpriteFrames`, telle que Godot 4 l'écrit lui-même.

    **C'est le seul des trois qu'un moteur charge sans une ligne de code** : on
    glisse le fichier sur un `AnimatedSprite2D` et les animations sont là, avec
    leurs images, leur cadence et leur bouclage. C'est ce que la planche appelle
    *le catalogue que Godot lit seul*.

    Il ne décrit que les animations : les images fixes d'un dossier sont déjà
    des textures que Godot importe toutes seules, et en fabriquer une ressource
    de plus n'apporterait rien qu'un fichier à tenir à jour.
    """
    externes: list[str] = []
    sous: list[str] = []
    animations: list[str] = []

    for rang, planche in enumerate(planches, start=1):
        nom = Path(planche.nom).stem
        cle = f"{rang}_{nom}"
        compte = max(planche.images, 1)
        # La case, déduite de la planche entière et de son nombre d'images —
        # les deux nombres viennent du fichier d'accompagnement, qui les tient
        # déjà de la planche écrite.
        case_l = planche.largeur // compte
        case_h = planche.hauteur
        externes.append(
            f'[ext_resource type="Texture2D" '
            f'path="res://{planche.chemin}" id="{cle}"]'
        )
        cases = []
        for image in range(compte):
            atlas = f"AtlasTexture_{rang}_{image}"
            sous.append(
                f'[sub_resource type="AtlasTexture" id="{atlas}"]\n'
                f'atlas = ExtResource("{cle}")\n'
                f"region = Rect2({image * case_l}, 0, {case_l}, {case_h})"
            )
            cases.append(
                '{\n"duration": 1.0,\n' f'"texture": SubResource("{atlas}")\n' "}"
            )
        animations.append(
            "{\n"
            '"frames": [' + ", ".join(cases) + "],\n"
            '"loop": true,\n'
            f'"name": &"{nom}",\n'
            '"speed": 8.0\n'
            "}"
        )

    pas = len(externes) + len(sous) + 1
    entete = f'[gd_resource type="SpriteFrames" load_steps={pas} format=3]'
    blocs = [entete, "", *externes, "", *sous, "", "[resource]"]
    blocs.append("animations = [" + ", ".join(animations) + "]")
    return "\n".join(blocs) + "\n"


def _phaser(jeu: str, images: Sequence[Morceau], planches: Sequence[Morceau]) -> str:
    """Un *asset pack* Phaser 3 — la liste que `this.load.pack()` avale.

    Une entrée `image` par sprite fixe, une entrée `aseprite` par animation :
    la seconde donne à Phaser la planche **et** son accompagnement, et il en
    fabrique les animations nommées tout seul. C'est ce que le fichier
    d'accompagnement d'`A4` avait déjà rendu possible sans que rien ne s'en
    serve.
    """
    entrees: list[dict[str, Any]] = []
    for image in images:
        entrees.append(
            {"type": "image", "key": Path(image.nom).stem, "url": image.chemin}
        )
    for planche in planches:
        nom = Path(planche.nom).stem
        entrees.append(
            {
                "type": "aseprite",
                "key": nom,
                "textureURL": planche.chemin,
                "atlasURL": planche.chemin.replace(".png", ".json"),
            }
        )
    return json.dumps({jeu: {"files": entrees}}, ensure_ascii=False, indent=2)


def _unity(jeu: str, images: Sequence[Morceau], planches: Sequence[Morceau]) -> str:
    """La liste des sprites, pour l'import Unity.

    ⚠️ **Celui-ci ne se charge pas seul, et c'est dit plutôt que caché.** Unity
    n'a pas de catalogue de sprites en texte qu'on dépose dans un dossier : ce
    qu'il lit sont ses propres `.meta`, qu'il écrit lui-même à l'import et qu'on
    ne fabrique pas d'ici sans risquer d'abîmer un projet. Ce fichier-ci est
    donc ce qu'un petit script d'éditeur consomme — la liste de ce qui est
    arrivé, avec la taille de chaque image et le nombre de cases d'une planche.

    L'écran le dit aussi, pour que personne ne découvre la différence en
    ouvrant Unity.
    """
    return json.dumps(
        {
            "jeu": jeu,
            "atelier": "Asset Kitchen",
            "sprites": [
                {"nom": Path(i.nom).stem, "fichier": i.chemin, "role": i.role}
                for i in images
            ],
            "planches": [
                {
                    "nom": Path(p.nom).stem,
                    "fichier": p.chemin,
                    "accompagnement": p.chemin.replace(".png", ".json"),
                    "images": p.images,
                }
                for p in planches
            ],
        },
        ensure_ascii=False,
        indent=2,
    )


# ── Le petit outillage ──────────────────────────────────────────────────────


def _valider(reglage: Reglage) -> None:
    """Les cinq réponses sont-elles dans leurs listes ?

    **Un refus nommé plutôt qu'un comportement deviné.** Une valeur inconnue
    reçue par la route est une faute d'appel, pas un choix de l'auteur : la
    laisser passer ferait sortir un lot que personne n'a demandé.
    """
    for valeur, liste, quoi in (
        (reglage.lot, vocabulaire.LOTS, "lot"),
        (reglage.rangement, vocabulaire.RANGEMENTS, "rangement"),
        (reglage.collision, vocabulaire.COLLISIONS, "mode de collision"),
        (reglage.moteur, vocabulaire.MOTEURS, "moteur"),
    ):
        if valeur not in liste:
            raise SortieRefusee(
                f"« {valeur} » n'est pas un {quoi} connu — "
                f"les seuls sont {', '.join(liste)}"
            )


def _prevu(morceau: Morceau, chemin: str, empreinte: str, marque: str) -> Prevu:
    """Un morceau du plan, dit à l'écran — **sans ses octets**."""
    return Prevu(
        chemin=chemin,
        octets=len(morceau.octets),
        empreinte=empreinte,
        marque=marque,
        role=morceau.role,
        sujet=morceau.sujet,
        source=morceau.source,
        largeur=morceau.largeur,
        hauteur=morceau.hauteur,
        images=morceau.images,
    )


def _empreinte(octets: bytes) -> str:
    return hashlib.sha256(octets).hexdigest()


def _cle_de_dossier(chemin: str) -> str:
    """Un dossier réduit à ce qui le désigne : résolu, barres unifiées, sans casse.

    Sans casse parce que le disque de l'auteur est sous Windows, où
    `C:/Jeu` et `c:/jeu` sont le même dossier.
    """
    try:
        resolu = Path(chemin).expanduser().resolve()
    except (OSError, RuntimeError):
        resolu = Path(chemin).expanduser()
    return os.path.normcase(str(resolu)).replace("\\", "/").rstrip("/").casefold()


def _meme_dossier(un: str, autre: str) -> bool:
    return bool(un.strip()) and _cle_de_dossier(un) == _cle_de_dossier(autre)


def _sous_un_jeu_godot(dossier: str) -> dict[str, str] | None:
    """Le jeu Godot qui contient cet ancien dossier, **proposé, jamais rattaché**.

    Rend `{dossier, sous_dossier}` — la racine qui porte `project.godot` et le
    chemin relatif jusqu'à l'ancien dossier —, de quoi rattacher le jeu en un
    clic sans que les fichiers changent de place. `None` quand aucun parent ne
    porte de `project.godot` : il n'y a alors rien à proposer.
    """
    try:
        depart = Path(dossier).expanduser().resolve()
    except (OSError, RuntimeError):
        return None
    for racine in (depart, *depart.parents):
        if (racine / "project.godot").is_file():
            relatif = depart.relative_to(racine).as_posix()
            # À la racine même du jeu, il n'y a pas de sous-dossier à proposer :
            # la forme « fichiers » se poserait sur project.godot.
            if relatif in ("", "."):
                return None
            return {"dossier": str(racine), "sous_dossier": relatif}
    return None


def _octets_de(chemin: Path) -> bytes | None:
    """Ce qu'il y a déjà là, ou `None` — **et une panne de lecture est un rien**.

    Un fichier qu'on ne peut pas relire ne peut pas être dit *inchangé* : le
    marquer *nouveau* fait qu'on le réécrira, ce qui est la bonne réponse.
    """
    try:
        return chemin.read_bytes()
    except OSError:
        return None


def _nomme(identifiant: str, pose: Any) -> dict[str, str]:
    """Une pose, dite par son identifiant **et** par son nom — comme à l'export."""
    return {
        "identifiant": identifiant,
        "nom": getattr(pose, "nom", "") or identifiant,
    }
