# -*- coding: utf-8 -*-
"""L'arborescence de `donnees/`, et rien d'autre.

    donnees/
    ├─ atelier.sqlite3            l'index — jetable, reconstructible
    ├─ atelier.json               le projet courant, et rien d'autre
    ├─ catalogue.json             la dernière photo du catalogue, datée
    ├─ recettes.json              les recettes nommées (US-66)
    ├─ collections.json           les collections, avec leur projet éventuel
    ├─ projets/<identifiant>/
    │  ├─ projet.json             le projet — bible, barème, palette, défauts
    │  └─ tableau/
    │     ├─ <carte>.json         une carte du tableau d'inspiration
    │     └─ <carte>.<ext>        ses octets, tels qu'ils sont entrés
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

# `.env` s'écrit en UTF-16 quand PowerShell le crée avec `>` (`AGENTS.md`
# § Pièges connus). Ces fichiers-ci sont écrits par le produit, donc en UTF-8 —
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
        self.collections = self.racine / "collections.json"
        self.etat = self.racine / "atelier.json"
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
        26 août 2026 sur le banc de modèles (`AGENTS.md` § Pièges connus).
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
        n'a rien coûté, et le tableau se recolle."""
        dossier = self.projets / projet / "tableau"
        if not dossier.is_dir():
            return
        for chemin in dossier.glob(f"{identifiant}.*"):
            if chemin.is_file():
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

    # ── Relire le disque ─────────────────────────────────────────────────────
    #
    # « La base d'index effacée, la bibliothèque se reconstruit depuis les
    # fichiers sans perdre un asset » (`docs/PLAN.md`, T3). Ces deux méthodes
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
