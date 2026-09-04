# -*- coding: utf-8 -*-
"""L'arborescence de `donnees/`, et rien d'autre.

    donnees/
    ├─ atelier.sqlite3            l'index — jetable, reconstructible
    ├─ atelier.json               le projet courant, et rien d'autre
    ├─ catalogue.json             la dernière photo du catalogue, datée
    ├─ recettes.json              les recettes nommées (US-66)
    ├─ prereglages.json           les jeux de réglages nommés (US-134)
    ├─ etiquettes.json            la base d'étiquettes, partagée par tous les jeux (E8)
    ├─ mouvements.json            la bibliothèque de mouvements, partagée aussi (A6)
    ├─ collections.json           les collections, avec leur projet éventuel
    ├─ projets/<identifiant>/
    │  ├─ projet.json             le projet — bible, barème, palette, défauts
    │  └─ tableau/
    │     ├─ <carte>.json         une carte du tableau d'inspiration
    │     ├─ <carte>.<ext>        ses octets, tels qu'ils sont entrés
    │     └─ liens/<lien>.json    un trait entre deux objets de la toile (T9)
    └─ generations/<identifiant>/
       ├─ generation.json         l'enregistrement complet, lisible sans la base
       ├─ <rang>-brut.<ext>       l'image telle qu'elle est arrivée
       ├─ <rang>-asset.json       l'asset : sa recette, son rangement, ses mesures
       └─ <rang>-rendu.png        le rendu — **un cache, effaçable**

Trois fichiers par image produite, et un seul est irremplaçable. Le brut ne
change jamais ; l'asset porte la recette, donc la vérité ; le rendu se recalcule
en millisecondes depuis les deux autres. Effacer `<rang>-rendu.png` à la main est
un geste sans conséquence — c'est même un critère d'acceptation de T2.

L'asset vit **dans le dossier de la génération** plutôt que dans un dossier à
lui : tout ce qui concerne une image tient au même endroit, et la bibliothèque
se reconstruit en parcourant un seul arbre.

**Tout ce que la base sait, un fichier le dit** — c'est l'invariant de T3, et
c'est ce module qui le tient. Effacer `atelier.sqlite3` ne perd rien : les
générations, les assets, leur rangement, leurs favoris, leur filiation et leurs
suppressions se relisent d'ici (`parcourir`). Un identifiant de projet est un
nom de dossier lisible — `projets/bac-a-sable/` — pour que `donnees/` s'ouvre
aussi à la main.

`donnees/` n'est pas versionné (`.gitignore`).
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any, Iterator

from atelier.reglages import DONNEES

# `.env` s'écrit en UTF-16 quand PowerShell le crée avec `>` (voir
# `docs/PIEGES.md`). Ces fichiers-ci sont écrits par le produit, donc en UTF-8 —
# mais rien n'empêche de les corriger à la main au terminal, et un fichier de
# rangement illisible ferait disparaître un rangement sans le dire. On essaie
# donc plusieurs encodages, comme `lire_cle()`.
ENCODAGES = ("utf-8", "utf-8-sig", "utf-16", "latin-1")


class Fichiers:
    def __init__(self, racine: Path | None = None) -> None:
        self.racine = racine or DONNEES
        self.generations = self.racine / "generations"
        self.projets = self.racine / "projets"
        self.catalogue = self.racine / "catalogue.json"
        self.recettes = self.racine / "recettes.json"
        self.prereglages = self.racine / "prereglages.json"
        self.etiquettes = self.racine / "etiquettes.json"
        # La bibliothèque de mouvements (A6). **À la racine, comme les
        # étiquettes et pour la même raison** : un mouvement appartient à
        # l'atelier, pas à un jeu, et il sert tous les jeux suivants.
        self.mouvements = self.racine / "mouvements.json"
        self.collections = self.racine / "collections.json"
        self.etat = self.racine / "atelier.json"
        # Le cadre de l'agent — plafond, modèle imposé, dossier du jeu. Un
        # fichier à part de l'état de l'atelier, et pas un bloc dedans : il se
        # relit **à chaque appel** du MCP (US-91), là où l'état ne se lit qu'à
        # l'ouverture. Deux rythmes de lecture, deux fichiers.
        self.agent = self.racine / "agent.json"
        self.base = self.racine / "atelier.sqlite3"

    def preparer(self) -> None:
        self.generations.mkdir(parents=True, exist_ok=True)
        self.projets.mkdir(parents=True, exist_ok=True)

    # ── Lire et écrire un fichier de données ─────────────────────────────────

    @staticmethod
    def _poser(chemin: Path, octets: bytes) -> None:
        """Écrit **entièrement, ou pas du tout**.

        Un fichier écrit directement sur son nom définitif est tronqué si le
        processus s'arrête au milieu — et un `generation.json` tronqué est le
        seul cas où « la bibliothèque se reconstruit sans perdre un asset »
        tombe pour de bon, puisque le fichier qui fait foi devient illisible.
        On écrit donc à côté, puis on renomme : le renommage, lui, est atomique.
        """
        chemin.parent.mkdir(parents=True, exist_ok=True)
        provisoire = chemin.with_name(chemin.name + ".ecriture")
        provisoire.write_bytes(octets)
        os.replace(provisoire, chemin)

    def _ecrire_json(self, chemin: Path, contenu: Any) -> None:
        self._poser(
            chemin,
            json.dumps(contenu, indent=1, ensure_ascii=False).encode("utf-8"),
        )

    @staticmethod
    def _lire_json(chemin: Path) -> Any | None:
        """Le contenu, ou `None`. **Ne lève jamais** : un fichier abîmé ne doit
        pas empêcher l'atelier de s'ouvrir, il doit se voir en moins."""
        if not chemin.is_file():
            return None
        octets = chemin.read_bytes()
        for encodage in ENCODAGES:
            try:
                return json.loads(octets.decode(encodage))
            except (UnicodeDecodeError, UnicodeError, ValueError):
                continue
        return None

    # ── Générations ──────────────────────────────────────────────────────────

    def dossier_generation(self, identifiant: str) -> Path:
        dossier = self.generations / identifiant
        dossier.mkdir(parents=True, exist_ok=True)
        return dossier

    def ecrire_brut(self, identifiant: str, rang: int, octets: bytes, ext: str) -> str:
        """Écrit l'image telle qu'elle est arrivée, et rend son chemin relatif.

        **Au fil de l'eau, jamais à la fin** : un lot payant qui écrit ses
        résultats à la fin perd tout ce qui précède le plantage. Constaté le
        26 août 2026 sur le banc de modèles (`docs/PIEGES.md`).
        """
        chemin = self.dossier_generation(identifiant) / f"{rang}-brut{ext}"
        self._poser(chemin, octets)
        return chemin.relative_to(self.racine).as_posix()

    def lire(self, chemin_relatif: str) -> bytes:
        return (self.racine / chemin_relatif).read_bytes()

    def existe(self, chemin_relatif: str) -> bool:
        return (self.racine / chemin_relatif).is_file()

    def ecrire_enregistrement(self, identifiant: str, contenu: dict[str, Any]) -> None:
        self._ecrire_json(self.dossier_generation(identifiant) / "generation.json", contenu)

    def dossier_images_clip(self, identifiant: str, rang: int) -> Path:
        """Où vivent les images tirées d'un clip (A9).

        **À côté du clip, dans le dossier de sa génération**, et pas ailleurs :
        une centaine de PNG par clip, qui n'ont de sens qu'avec lui et qui
        disparaissent avec lui. Les mettre dans la bibliothèque ferait entrer
        cent images non choisies pour une seule animation gardée.
        """
        dossier = self.dossier_generation(identifiant) / f"{rang}-images"
        dossier.mkdir(parents=True, exist_ok=True)
        return dossier

    # ── Assets, recettes et rendus ───────────────────────────────────────────

    def ecrire_asset(self, generation: str, rang: int, contenu: dict[str, Any]) -> None:
        """L'asset s'écrit à côté de son image. C'est lui qui fait foi.

        « Les fichiers font foi, la base est un index reconstructible »
        (`docs/ARCHITECTURE.md` §4). L'invariant entre en vigueur en T3, mais il
        se payait déjà en T2 : une recette perdue avec la base coûterait tout le
        travail de retouche.
        """
        self._ecrire_json(
            self.dossier_generation(generation) / f"{rang}-asset.json", contenu
        )

    def ecrire_rendu(self, generation: str, rang: int, octets: bytes) -> str:
        """Le cache. Un seul fichier par emplacement, réécrit sur place.

        Un nom par empreinte laisserait derrière lui un rendu par réglage
        essayé — des dizaines de fichiers pour une image, et rien qui les
        ramasse. L'empreinte vit dans l'enregistrement de l'asset : un fichier
        présent dont l'empreinte ne correspond plus est traité exactement comme
        un fichier absent.
        """
        chemin = self.dossier_generation(generation) / f"{rang}-rendu.png"
        self._poser(chemin, octets)
        return chemin.relative_to(self.racine).as_posix()

    def supprimer(self, chemin_relatif: str) -> None:
        """Efface un fichier de cache. Ne lève pas s'il n'est plus là."""
        (self.racine / chemin_relatif).unlink(missing_ok=True)

    def effacer_asset(self, generation: str, rang: int) -> None:
        """La suppression **définitive** d'une image, quand l'annulation a expiré.

        Le brut, le rendu et l'enregistrement de l'asset partent ensemble ; le
        `generation.json`, lui, reste. C'est ce qui garde le coût de l'appel
        lisible dans le journal du projet (US-24) alors même que l'image
        n'existe plus — on supprime une image, pas une dépense.

        Le brut qui disparaît est aussi **ce qui empêche la résurrection** : la
        reconstruction, comme le rattrapage du démarrage, ne donne un asset qu'à
        un emplacement dont le fichier est encore là.
        """
        dossier = self.generations / generation
        if not dossier.is_dir():
            return
        for chemin in dossier.glob(f"{rang}-*"):
            if chemin.is_file():
                chemin.unlink(missing_ok=True)

    def ecrire_recettes(self, contenu: dict[str, Any]) -> None:
        self._ecrire_json(self.recettes, contenu)

    def lire_recettes(self) -> dict[str, Any]:
        return self._lire_json(self.recettes) or {}

    def ecrire_etiquettes(self, contenu: list[Any]) -> None:
        self._ecrire_json(self.etiquettes, contenu)

    def lire_etiquettes(self) -> list[Any]:
        """La base d'étiquettes (E8).

        **À la racine, pas dans un projet**, et c'est la décision : comme la clé
        du fournisseur, une étiquette ne dépend d'aucun jeu. Un deuxième jeu
        part de ce que le premier a nommé — rangée par projet, la base
        repartirait vide à chaque fois et le mécanisme ne servirait jamais.

        **Une liste, pas un dictionnaire** : l'ordre de fabrication départage
        les étiquettes d'égal emploi, et c'est l'ordre dans lequel l'auteur les
        a nommées, donc celui qu'il reconnaît.
        """
        lu = self._lire_json(self.etiquettes)
        return lu if isinstance(lu, list) else []

    def ecrire_mouvements(self, contenu: list[Any]) -> None:
        self._ecrire_json(self.mouvements, contenu)

    def lire_mouvements(self) -> list[Any]:
        """La bibliothèque de mouvements (A6).

        **À la racine, pas dans un projet** : c'est la décision durable de la
        V3 — un mouvement appartient à l'atelier. Le plan de poses dit *quelles*
        cases un jeu veut ; l'atelier sait *comment* chacune se dit quand on
        l'anime, et ce savoir-là sert tous les jeux suivants.

        **Une liste, pas un dictionnaire**, comme les étiquettes : l'ordre de
        fabrication est celui dans lequel l'auteur les a nommés.
        """
        lu = self._lire_json(self.mouvements)
        return lu if isinstance(lu, list) else []

    def ecrire_prereglages(self, contenu: dict[str, Any]) -> None:
        self._ecrire_json(self.prereglages, contenu)

    def lire_prereglages(self) -> dict[str, Any]:
        """Les jeux de réglages nommés (US-134).

        **Un fichier à part de `recettes.json`**, et ce n'est pas de la
        symétrie : une recette dit ce qu'on fait à une image *déjà payée*, un
        jeu de réglages dit ce qui part *avant* de payer. Les mêler aurait fait
        un fichier dont la moitié des entrées ne s'appliquent jamais à l'autre
        moitié des gestes.
        """
        return self._lire_json(self.prereglages) or {}

    # ── Projets, collections, et le projet courant ───────────────────────────

    def ecrire_projet(self, identifiant: str, contenu: dict[str, Any]) -> None:
        self._ecrire_json(self.projets / identifiant / "projet.json", contenu)

    def effacer_projet(self, identifiant: str) -> None:
        """Le dossier du projet part en entier. Les assets, eux, ne sont pas
        dedans : ils vivent avec leur génération, et un projet supprimé les
        **détache** au lieu de les détruire (US-30)."""
        shutil.rmtree(self.projets / identifiant, ignore_errors=True)

    def lire_projets(self) -> list[dict[str, Any]]:
        if not self.projets.is_dir():
            return []
        lus = []
        for dossier in sorted(self.projets.iterdir()):
            contenu = self._lire_json(dossier / "projet.json")
            if isinstance(contenu, dict) and contenu.get("identifiant"):
                lus.append(contenu)
        return lus

    # ── Le tableau d'inspiration ─────────────────────────────────────────────
    #
    # **Un fichier par carte, comme un asset vit dans le dossier de sa
    # génération.** Un seul `cartes.json` par projet aurait été plus court à
    # écrire, et faux au premier usage réel : le collage est le geste principal
    # de la tranche, on colle en rafale, et une adresse collée écrit sa carte
    # *deux fois* — en attente, puis remplie quand l'image arrive. Réécrire tout
    # le tableau à chaque fois, c'est le relire d'abord ; deux récupérations qui
    # aboutissent dans le même instant se relisent alors toutes les deux avant
    # d'écrire, et la seconde efface la première. C'est « deux vérités sur la
    # même chose », vu de la concurrence.
    #
    # **Pas de table d'index non plus.** Les cartes ne se cherchent pas, ne se
    # filtrent pas et ne se paginent pas : un tableau se lit en entier. Un index
    # existe pour être *interrogé* ; celui-ci n'aurait aucune question à
    # répondre et il faudrait pourtant le tenir à jour, l'inscrire dans
    # `TABLES`, le vider à la reconstruction. Corollaire heureux : effacer
    # `atelier.sqlite3` ne touche pas au tableau, puisqu'il n'y est jamais entré.
    #
    # **Le tableau vit sous son projet**, et c'est ce qui rend la suppression
    # d'un projet simple : `effacer_projet` emporte le dossier, donc le tableau
    # avec. Une image produite se détache et survit ailleurs ; une inspiration
    # n'a de sens que dans l'univers pour lequel on l'a rassemblée.

    def dossier_tableau(self, projet: str) -> Path:
        dossier = self.projets / projet / "tableau"
        dossier.mkdir(parents=True, exist_ok=True)
        return dossier

    def ecrire_carte(self, projet: str, identifiant: str, contenu: dict[str, Any]) -> None:
        self._ecrire_json(self.dossier_tableau(projet) / f"{identifiant}.json", contenu)

    def lire_carte(self, projet: str, identifiant: str) -> dict[str, Any] | None:
        contenu = self._lire_json(self.projets / projet / "tableau" / f"{identifiant}.json")
        return contenu if isinstance(contenu, dict) else None

    def parcourir_cartes(self, projet: str) -> Iterator[dict[str, Any]]:
        """Chaque carte du tableau d'un projet. Le disque est la seule vérité."""
        dossier = self.projets / projet / "tableau"
        if not dossier.is_dir():
            return
        for chemin in sorted(dossier.glob("*.json")):
            contenu = self._lire_json(chemin)
            if isinstance(contenu, dict) and contenu.get("identifiant"):
                yield contenu

    def ecrire_octets_carte(
        self, projet: str, identifiant: str, octets: bytes, ext: str
    ) -> str:
        """Les octets collés, tels qu'ils sont entrés, et leur chemin relatif.

        **Rien n'est converti à l'entrée.** Un WEBP reste un WEBP : le tableau
        rassemble, il ne traite pas. C'est au moment de partir en référence que
        l'adaptateur regarde les octets et annonce le bon type (`AGENTS.md` :
        « le type d'une image de référence se lit sur ses octets »).
        """
        chemin = self.dossier_tableau(projet) / f"{identifiant}{ext}"
        self._poser(chemin, octets)
        return chemin.relative_to(self.racine).as_posix()

    def effacer_carte(self, projet: str, identifiant: str) -> None:
        """La carte et ses octets, ensemble. Pas d'annulation ici : une carte
        n'a rien coûté, et le tableau se recolle.

        **Les liens qui y aboutissaient partent aussi**, mais pas ici : c'est le
        service qui les connaît, parce que lui seul sait qu'une carte est une
        *extrémité* (`ServiceUnivers.oublier`). Ce module range des octets, il ne
        sait pas ce qu'ils se disent entre eux.
        """
        dossier = self.projets / projet / "tableau"
        if not dossier.is_dir():
            return
        for chemin in dossier.glob(f"{identifiant}.*"):
            if chemin.is_file():
                chemin.unlink(missing_ok=True)

    # ── Les liens de la toile ────────────────────────────────────────────────
    #
    # **Un fichier par lien, comme un fichier par carte**, et pour la première
    # des deux raisons de la carte, mot pour mot : écrire vite et souvent sans
    # relire le tout. On tire des traits en rafale, et un `liens.json` unique se
    # relirait avant chaque écriture — deux traits tirés dans le même instant se
    # reliraient tous les deux, et le second effacerait le premier.
    #
    # **Un sous-dossier, et c'est un fait du code, pas du rangement.**
    # `parcourir_cartes` lit `tableau/*.json` et tient pour une carte tout JSON
    # qui porte un identifiant : poser les liens à côté des cartes en ferait des
    # **cartes fantômes** dans le tableau, dans la grille, dans la réserve, et
    # dans le compte que la barre affiche. Un cran plus bas, et la règle du
    # dossier reste vraie telle quelle — c'est aussi ce qui fait que
    # `effacer_carte`, qui balaie `<identifiant>.*`, ne peut pas les atteindre :
    # `liens` n'est pas un fichier, et le motif exige un point.
    #
    # **Pas d'index, comme pour les cartes.** Ils ne se cherchent pas, ne se
    # filtrent pas, ne se paginent pas : une toile se lit en entier. Corollaire
    # hérité — jeter `atelier.sqlite3` ne touche pas aux liens, puisqu'ils n'y
    # sont jamais entrés.

    def dossier_liens(self, projet: str) -> Path:
        dossier = self.projets / projet / "tableau" / "liens"
        dossier.mkdir(parents=True, exist_ok=True)
        return dossier

    def ecrire_lien(self, projet: str, identifiant: str, contenu: dict[str, Any]) -> None:
        self._ecrire_json(self.dossier_liens(projet) / f"{identifiant}.json", contenu)

    def parcourir_liens(self, projet: str) -> Iterator[dict[str, Any]]:
        """Chaque lien de la toile d'un projet. Le disque est la seule vérité."""
        dossier = self.projets / projet / "tableau" / "liens"
        if not dossier.is_dir():
            return
        for chemin in sorted(dossier.glob("*.json")):
            contenu = self._lire_json(chemin)
            if isinstance(contenu, dict) and contenu.get("identifiant"):
                yield contenu

    def effacer_lien(self, projet: str, identifiant: str) -> None:
        """Le lien part pour de bon. **Aucune entrée morte ne reste** : un trait
        vers rien ne représente rien, et un fichier qui lui survivrait serait une
        deuxième vérité qui attend son heure."""
        chemin = self.projets / projet / "tableau" / "liens" / f"{identifiant}.json"
        chemin.unlink(missing_ok=True)

    # ── Les personnages ──────────────────────────────────────────────────────
    #
    # **Un fichier par personnage, sous son projet** — pour les deux raisons des
    # liens de T9, dans l'ordre inverse. La seconde d'abord, parce que c'est un
    # fait du code : `parcourir_cartes` lit `tableau/*.json` et tient pour une
    # carte tout JSON qui porte un identifiant ; les personnages vivent donc
    # ailleurs que dans le tableau, sous un dossier à eux. La première ensuite :
    # écrire un personnage ne demande pas de relire les autres, et deux gestes
    # dans le même instant — décrire l'un pendant qu'on désigne un concept art à
    # l'autre — ne s'effacent pas l'un l'autre.
    #
    # **Pas d'index non plus**, comme les cartes et les liens : les personnages
    # d'un projet se lisent en entier, ils ne se cherchent ni ne se paginent.
    # Effacer `atelier.sqlite3` ne peut donc pas les perdre.
    #
    # Le plan de poses, lui, n'est **pas** ici : il vit dans `projet.json`, avec
    # l'univers et les teintes. Il n'y en a qu'un par projet, il est court, et le
    # sortir en aurait fait un second fichier à tenir d'accord avec le premier.

    def dossier_personnages(self, projet: str) -> Path:
        dossier = self.projets / projet / "personnages"
        dossier.mkdir(parents=True, exist_ok=True)
        return dossier

    def ecrire_personnage(
        self, projet: str, identifiant: str, contenu: dict[str, Any]
    ) -> None:
        self._ecrire_json(
            self.dossier_personnages(projet) / f"{identifiant}.json", contenu
        )

    def parcourir_personnages(self, projet: str) -> Iterator[dict[str, Any]]:
        """Chaque personnage d'un projet. Le disque est la seule vérité."""
        dossier = self.projets / projet / "personnages"
        if not dossier.is_dir():
            return
        for chemin in sorted(dossier.glob("*.json")):
            contenu = self._lire_json(chemin)
            if isinstance(contenu, dict) and contenu.get("identifiant"):
                yield contenu

    def effacer_personnage(self, projet: str, identifiant: str) -> None:
        """Le personnage part pour de bon — **et ses images restent**. Jamais de
        cascade : elles vivent avec leur génération, à l'autre bout de
        `donnees/`, et ce sont elles qui portent la marque de son départ."""
        chemin = self.projets / projet / "personnages" / f"{identifiant}.json"
        chemin.unlink(missing_ok=True)

    def ecrire_collections(self, contenu: dict[str, Any]) -> None:
        self._ecrire_json(self.collections, contenu)

    def lire_collections(self) -> dict[str, Any]:
        contenu = self._lire_json(self.collections)
        return contenu if isinstance(contenu, dict) else {}

    def ecrire_etat(self, contenu: dict[str, Any]) -> None:
        self._ecrire_json(self.etat, contenu)

    def lire_etat(self) -> dict[str, Any]:
        contenu = self._lire_json(self.etat)
        return contenu if isinstance(contenu, dict) else {}

    def ecrire_agent(self, contenu: dict[str, Any]) -> None:
        self._ecrire_json(self.agent, contenu)

    def lire_agent(self) -> dict[str, Any]:
        """Le cadre de l'agent. Absent, il rend `{}` — et les défauts s'appliquent.

        **Ne lève jamais**, comme la lecture de la clé : un cadre qui manque
        n'est pas une panne, c'est l'état d'un atelier où personne n'a encore
        touché aux garde-fous.
        """
        contenu = self._lire_json(self.agent)
        return contenu if isinstance(contenu, dict) else {}

    # ── Relire le disque ─────────────────────────────────────────────────────
    #
    # « La base d'index effacée, la bibliothèque se reconstruit depuis les
    # fichiers sans perdre un asset » (`docs/archive/plan-versions-tenues.md`, T3). Ces deux méthodes
    # sont tout ce que ça demande : le disque est un arbre, on le parcourt.

    def parcourir_generations(self) -> Iterator[dict[str, Any]]:
        """Chaque `generation.json` du disque, dans l'ordre où il vient."""
        if not self.generations.is_dir():
            return
        for dossier in sorted(self.generations.iterdir()):
            contenu = self._lire_json(dossier / "generation.json")
            if isinstance(contenu, dict) and contenu.get("identifiant"):
                yield contenu

    def parcourir_assets(self, generation: str) -> Iterator[dict[str, Any]]:
        """Chaque `<rang>-asset.json` d'une génération, par rang croissant."""
        dossier = self.generations / generation
        if not dossier.is_dir():
            return
        fiches = sorted(
            dossier.glob("*-asset.json"),
            key=lambda c: int(c.name.split("-", 1)[0]),
        )
        for fiche in fiches:
            contenu = self._lire_json(fiche)
            if isinstance(contenu, dict) and contenu.get("identifiant"):
                yield contenu

    # ── Catalogue ────────────────────────────────────────────────────────────

    def ecrire_catalogue(self, contenu: dict[str, Any]) -> None:
        self._ecrire_json(self.catalogue, contenu)

    def lire_catalogue(self) -> dict[str, Any] | None:
        contenu = self._lire_json(self.catalogue)
        return contenu if isinstance(contenu, dict) else None
