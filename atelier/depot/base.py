# -*- coding: utf-8 -*-
"""L'index — SQLite, et **jetable**.

Colonnes en français (`AGENTS.md` § Règles durables). Une connexion par
opération, en WAL : le serveur écrit depuis plusieurs tâches à la fois dès que
les variations partent en parallèle, et une connexion partagée entre threads
est le premier bug qu'on s'épargne.

`contenu` porte l'enregistrement complet en JSON ; les colonnes qui le doublent
existent pour être **interrogées** — statut, coût, date, projet, collection,
favori, filiation, suppression — et sont toujours réécrites depuis l'objet.
Jamais deux vérités : l'objet est la vérité, les colonnes en sont une projection.

**Et l'objet lui-même est sur le disque.** « Les fichiers font foi, la base est
un index reconstructible » entre en vigueur en T3 (`docs/PLAN.md` § Les
invariants). Ce fichier en tire une conséquence directe et rare : le schéma n'a
**aucune migration**. Quand il change, `VERSION` change, l'index entier est
jeté, et le démarrage le refait en relisant `donnees/`. Écrire des migrations
serait entretenir un cache comme s'il était une archive — et se priver de
l'occasion de vérifier, à chaque évolution du schéma, que la reconstruction
marche vraiment.
"""

from __future__ import annotations

import contextlib
import json
import sqlite3
import unicodedata
from pathlib import Path
from typing import Any, Iterable, Iterator

from atelier.domaine.asset import Asset
from atelier.domaine.generation import Generation
from atelier.domaine.projet import Collection, Projet

# Change à chaque évolution du schéma. L'index est alors jeté et refait depuis
# les fichiers : c'est le geste normal, pas un incident.
VERSION = 4

SCHEMA = """
CREATE TABLE IF NOT EXISTS generations (
    identifiant TEXT PRIMARY KEY,
    modele      TEXT NOT NULL,
    statut      TEXT NOT NULL,
    cout_usd    REAL NOT NULL DEFAULT 0,
    cree_le     REAL NOT NULL,
    projet      TEXT,
    contenu     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS generations_par_date ON generations (cree_le DESC);
CREATE INDEX IF NOT EXISTS generations_par_projet ON generations (projet);

CREATE TABLE IF NOT EXISTS assets (
    identifiant TEXT PRIMARY KEY,
    generation  TEXT NOT NULL,
    rang        INTEGER NOT NULL,
    label       TEXT NOT NULL DEFAULT '',
    recherche   TEXT NOT NULL DEFAULT '',
    cree_le     REAL NOT NULL,
    projet      TEXT,
    collection  TEXT,
    parent      TEXT,
    personnage  TEXT,
    favori      INTEGER NOT NULL DEFAULT 0,
    epingle     INTEGER NOT NULL DEFAULT 0,
    supprime_le REAL,
    contenu     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS assets_par_date ON assets (cree_le DESC);
CREATE INDEX IF NOT EXISTS assets_par_projet ON assets (projet);
CREATE INDEX IF NOT EXISTS assets_par_collection ON assets (collection);
CREATE INDEX IF NOT EXISTS assets_par_parent ON assets (parent);
-- La matrice de production demande « les images de ce personnage » à chaque
-- rendu, et une suppression de personnage les redemande toutes : c'est très
-- exactement la question qu'un index existe pour répondre. Le schéma n'a
-- aucune migration — il est jeté et refait depuis les fichiers au premier
-- démarrage qui suit son évolution (`docs/ARCHITECTURE.md` §4).
CREATE INDEX IF NOT EXISTS assets_par_personnage ON assets (personnage);

CREATE TABLE IF NOT EXISTS projets (
    identifiant TEXT PRIMARY KEY,
    nom         TEXT NOT NULL,
    cree_le     REAL NOT NULL,
    contenu     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
    identifiant TEXT PRIMARY KEY,
    nom         TEXT NOT NULL,
    projet      TEXT,
    cree_le     REAL NOT NULL,
    contenu     TEXT NOT NULL
);
"""

TABLES = ("generations", "assets", "projets", "collections")


def normaliser(texte: str) -> str:
    """Ce sur quoi la recherche compare : minuscules, accents dépliés.

    « foret » doit trouver « forêt », et « Tonneau » « tonneau ». SQLite ne sait
    ni l'un ni l'autre sur de l'Unicode sans extension ; on normalise donc des
    deux côtés — à l'écriture dans la colonne `recherche`, à la lecture dans la
    requête — et `LIKE` suffit ensuite.
    """
    deplie = unicodedata.normalize("NFKD", texte.lower())
    return "".join(c for c in deplie if not unicodedata.combining(c))


class Base:
    def __init__(self, chemin: Path) -> None:
        self.chemin = chemin
        self.chemin.parent.mkdir(parents=True, exist_ok=True)
        self.refaite = self._preparer()

    def _preparer(self) -> bool:
        """Crée le schéma, et **jette l'index** si sa version a changé.

        Rend vrai quand il a fallu tout jeter : le service s'en sert pour dire à
        l'ouverture que la bibliothèque a été relue depuis les fichiers.
        """
        with self._connexion() as connexion:
            version = connexion.execute("PRAGMA user_version").fetchone()[0]
            existe = connexion.execute(
                "SELECT count(*) FROM sqlite_master "
                "WHERE type = 'table' AND name = 'assets'"
            ).fetchone()[0]
            jetee = bool(existe) and version != VERSION
            if jetee:
                for table in TABLES:
                    connexion.execute("DROP TABLE IF EXISTS " + table)
            connexion.executescript(SCHEMA)
            connexion.execute("PRAGMA user_version = " + str(VERSION))
        return jetee

    @contextlib.contextmanager
    def _connexion(self) -> Iterator[sqlite3.Connection]:
        """Une connexion par opération, **ouverte et refermée**.

        `with sqlite3.connect(...)` ne ferme pas : il ne fait que valider la
        transaction. Rendre la connexion telle quelle laissait donc un descripteur
        ouvert par requête, que seul le ramasse-miettes finissait par refermer —
        et sous Windows un fichier encore ouvert ne se supprime pas. C'est
        exactement le geste que T3 doit permettre : effacer `atelier.sqlite3`
        pour voir la bibliothèque se reconstruire.
        """
        connexion = sqlite3.connect(self.chemin, timeout=10.0)
        connexion.execute("PRAGMA journal_mode=WAL")
        connexion.execute("PRAGMA foreign_keys=ON")
        connexion.row_factory = sqlite3.Row
        try:
            with connexion:
                yield connexion
        finally:
            connexion.close()

    @property
    def vide(self) -> bool:
        """Aucune génération connue. C'est l'état d'un index effacé — et celui
        d'un atelier neuf : les deux mènent au même geste, relire le disque."""
        with self._connexion() as connexion:
            return not connexion.execute("SELECT 1 FROM generations LIMIT 1").fetchone()

    def vider(self) -> None:
        """Tout l'index, d'un coup. Aucun fichier n'est touché."""
        with self._connexion() as connexion:
            for table in TABLES:
                connexion.execute("DELETE FROM " + table)

    # ── Générations ──────────────────────────────────────────────────────────

    def enregistrer(self, generation: Generation) -> None:
        contenu = generation.en_json()
        with self._connexion() as connexion:
            connexion.execute(
                """
                INSERT INTO generations
                    (identifiant, modele, statut, cout_usd, cree_le, projet, contenu)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(identifiant) DO UPDATE SET
                    statut = excluded.statut,
                    cout_usd = excluded.cout_usd,
                    projet = excluded.projet,
                    contenu = excluded.contenu
                """,
                (
                    generation.identifiant,
                    generation.modele,
                    generation.statut.value,
                    generation.cout_usd,
                    generation.cree_le,
                    generation.projet,
                    json.dumps(contenu, ensure_ascii=False),
                ),
            )

    def lire(self, identifiant: str) -> Generation | None:
        with self._connexion() as connexion:
            ligne = connexion.execute(
                "SELECT contenu FROM generations WHERE identifiant = ?", (identifiant,)
            ).fetchone()
        if ligne is None:
            return None
        return Generation.depuis_json(json.loads(ligne["contenu"]))

    def recentes(self, limite: int = 50) -> list[Generation]:
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM generations ORDER BY cree_le DESC LIMIT ?",
                (limite,),
            ).fetchall()
        return [Generation.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def generations_du_projet(
        self, projet: str | None, limite: int = 100
    ) -> list[Generation]:
        """Le journal d'un projet : ses appels, réussis **et** ratés (US-24).

        `projet` à `None` demande celles qui n'appartiennent à aucun projet, pas
        « toutes » — un journal sans propriétaire est un journal quand même.
        """
        condition = "projet IS NULL" if projet is None else "projet = ?"
        arguments: tuple[Any, ...] = () if projet is None else (projet,)
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM generations WHERE "
                + condition
                + " ORDER BY cree_le DESC LIMIT ?",
                (*arguments, limite),
            ).fetchall()
        return [Generation.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def generations_du_modele(
        self, modele: str, projet: str | None
    ) -> list[Generation]:
        """Toutes celles d'un modèle donné, dans un projet donné — **sans limite**.

        Écrite pour une seule question, et elle décide de sa forme : *cette
        image est-elle déjà entrée ?* (US-169). Une limite y serait un doublon
        non signalé passé un certain rang, c'est-à-dire un défaut qui
        n'apparaîtrait qu'après cent imports.

        `modele` est une colonne, pas un champ du contenu : le filtre se fait
        donc en SQL, et seules les générations d'import sont désérialisées. Sur
        un projet qui compte mille appels et douze imports, douze lignes sont
        lues.
        """
        condition = "projet IS NULL" if projet is None else "projet = ?"
        arguments: tuple[Any, ...] = () if projet is None else (projet,)
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM generations WHERE modele = ? AND "
                + condition
                + " ORDER BY cree_le DESC",
                (modele, *arguments),
            ).fetchall()
        return [Generation.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def en_vol(self) -> list[Generation]:
        """Ce qui était en cours ou en attente — au démarrage, c'est ce qui a été
        interrompu par l'arrêt du serveur. **Rien n'est jamais relancé
        automatiquement** (US-18) : on marque, on garde le coût, on attend."""
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM generations "
                "WHERE statut IN ('en_cours', 'en_attente')"
            ).fetchall()
        return [Generation.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def detacher_generations(self, projet: str) -> int:
        """Un projet supprimé laisse ses appels sans propriétaire, jamais sans trace.

        Le coût déjà payé ne disparaît pas d'un total parce qu'on a rangé
        autrement : il passe au journal des appels sans projet.
        """
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT identifiant, contenu FROM generations WHERE projet = ?",
                (projet,),
            ).fetchall()
            for ligne in lignes:
                contenu = json.loads(ligne["contenu"])
                contenu["projet"] = None
                connexion.execute(
                    "UPDATE generations SET projet = NULL, contenu = ? "
                    "WHERE identifiant = ?",
                    (json.dumps(contenu, ensure_ascii=False), ligne["identifiant"]),
                )
        return len(lignes)

    def attacher_generations(self, projet: str) -> int:
        """Donne un projet aux appels qui n'en avaient pas — l'inverse exact de
        `detacher_generations`, et il ne sert qu'une fois : à l'apparition du
        tout premier projet."""
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT identifiant, contenu FROM generations WHERE projet IS NULL"
            ).fetchall()
            for ligne in lignes:
                contenu = json.loads(ligne["contenu"])
                contenu["projet"] = projet
                connexion.execute(
                    "UPDATE generations SET projet = ?, contenu = ? "
                    "WHERE identifiant = ?",
                    (projet, json.dumps(contenu, ensure_ascii=False), ligne["identifiant"]),
                )
        return len(lignes)

    def durees_mesurees(self, modele: str, limite: int = 12) -> list[float]:
        """Ce que ce modèle a réellement mis, aux derniers appels réussis.

        C'est la matière de la jauge **déterminée** (`docs/DESIGN.md` § Motion) :
        aucun fournisseur d'image ne rend d'avancement en chemin, donc la seule
        façon honnête de dire « voilà où ça en est » est de comparer le temps
        écoulé à celui que ce modèle-là a mis les fois précédentes. Une mesure,
        pas une table écrite en dur — et elle se recale à chaque image.
        """
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM generations WHERE modele = ? "
                "ORDER BY cree_le DESC LIMIT ?",
                (modele, limite),
            ).fetchall()

        durees: list[float] = []
        for ligne in lignes:
            for emplacement in json.loads(ligne["contenu"]).get("emplacements", []):
                if emplacement.get("statut") == "reussie" and emplacement.get("duree_s"):
                    durees.append(float(emplacement["duree_s"]))
        return durees

    def couts_mesures(self, modele: str, limite: int = 12) -> list[float]:
        """Ce que ce modèle a réellement **facturé**, aux derniers appels réussis.

        Jumeau exact de `durees_mesurees`, et pour la même raison : le produit
        ne porte aucun tarif de catalogue, et il ne doit pas en porter. « Le
        classement des modèles par coût est contre-intuitif et doit rester
        mesuré, jamais supposé » (`docs/PRD.md`) — l'essai du 28 août a relevé
        un écart de 1 à 4,6 entre le plus cher et le moins cher, et le favori
        pressenti était le plus cher. Annoncer un prix venu d'une table serait
        annoncer un chiffre que personne n'a payé.

        La médiane de ces valeurs est ce que l'écran annonce avant de générer.
        Sans mesure, il ne dit rien plutôt que d'inventer.
        """
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM generations WHERE modele = ? "
                "ORDER BY cree_le DESC LIMIT ?",
                (modele, limite),
            ).fetchall()

        couts: list[float] = []
        for ligne in lignes:
            for emplacement in json.loads(ligne["contenu"]).get("emplacements", []):
                if emplacement.get("statut") == "reussie" and emplacement.get("cout_usd"):
                    couts.append(float(emplacement["cout_usd"]))
        return couts

    # ── Assets ───────────────────────────────────────────────────────────────
    #
    # Même règle que pour les générations : `contenu` porte l'enregistrement
    # complet, les colonnes qui le doublent existent pour être interrogées, et
    # elles sont toujours réécrites depuis l'objet. L'objet est la vérité.

    def enregistrer_asset(self, asset: Asset) -> None:
        with self._connexion() as connexion:
            connexion.execute(
                """
                INSERT INTO assets
                    (identifiant, generation, rang, label, recherche, cree_le,
                     projet, collection, parent, personnage, favori, epingle,
                     supprime_le, contenu)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(identifiant) DO UPDATE SET
                    label = excluded.label,
                    recherche = excluded.recherche,
                    -- **Toute colonne qui double l'objet se réécrit depuis lui.**
                    -- `cree_le` manquait ici : la date changeait dans `contenu`
                    -- et pas dans la colonne, donc l'objet disait une chose et
                    -- l'ordre de la grille en disait une autre. C'est
                    -- exactement les « deux vérités » que ce fichier interdit
                    -- en tête, et ça s'est vu au premier réalignement de lot.
                    cree_le = excluded.cree_le,
                    projet = excluded.projet,
                    collection = excluded.collection,
                    parent = excluded.parent,
                    personnage = excluded.personnage,
                    favori = excluded.favori,
                    epingle = excluded.epingle,
                    supprime_le = excluded.supprime_le,
                    contenu = excluded.contenu
                """,
                (
                    asset.identifiant,
                    asset.generation,
                    asset.rang,
                    asset.label,
                    normaliser(asset.label),
                    asset.cree_le,
                    asset.projet,
                    asset.collection,
                    asset.parent,
                    asset.personnage,
                    int(asset.favori),
                    int(asset.epingle),
                    asset.supprime_le,
                    json.dumps(asset.en_disque(), ensure_ascii=False),
                ),
            )

    def lire_asset(self, identifiant: str) -> Asset | None:
        with self._connexion() as connexion:
            ligne = connexion.execute(
                "SELECT contenu FROM assets WHERE identifiant = ?", (identifiant,)
            ).fetchone()
        if ligne is None:
            return None
        return Asset.depuis_json(json.loads(ligne["contenu"]))

    def assets(
        self,
        *,
        projet: str | None = None,
        sans_projet: bool = False,
        collection: str | None = None,
        favoris: bool = False,
        recherche: str = "",
        limite: int = 200,
        supprimes: bool = False,
    ) -> list[Asset]:
        """La bibliothèque, filtrée. **Une seule requête pour tout le produit.**

        « La grille sous le prompt et la grille qui sert à organiser sont la
        même » (`docs/PLAN.md`, T3) : il n'existe donc qu'un seul endroit qui
        sache filtrer des assets, et l'écran comme le MCP de T7 passent par lui.
        Deux listages écrits à deux endroits, c'est la divergence relevée chez
        SpriteCook, dont une grille montre les pastilles et l'autre non.

        Un asset supprimé est **hors bibliothèque** tant que son annulation
        court : il ne se compte pas, ne se cherche pas, ne se filtre pas.
        """
        conditions = ["supprime_le IS NOT NULL" if supprimes else "supprime_le IS NULL"]
        arguments: list[Any] = []
        if sans_projet:
            conditions.append("projet IS NULL")
        elif projet is not None:
            conditions.append("projet = ?")
            arguments.append(projet)
        if collection is not None:
            conditions.append("collection = ?")
            arguments.append(collection)
        if favoris:
            conditions.append("favori = 1")
        if recherche.strip():
            conditions.append("recherche LIKE ?")
            arguments.append("%" + normaliser(recherche.strip()) + "%")

        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM assets WHERE "
                + " AND ".join(conditions)
                # **Le lot reste groupé, et dans l'ordre de ses emplacements.**
                # Les variations d'une même génération partagent leur date ;
                # sans le rang pour départager, SQLite les rendrait dans un
                # ordre indéterminé, et deux rendus de la même grille ne se
                # ressembleraient pas.
                + " ORDER BY cree_le DESC, rang ASC LIMIT ?",
                (*arguments, limite),
            ).fetchall()
        return [Asset.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def assets_recents(self, limite: int = 200) -> list[Asset]:
        return self.assets(limite=limite)

    def enfants(self, identifiant: str) -> list[Asset]:
        """Ce qui descend de cet asset. **Jamais supprimé avec lui** (US-28)."""
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM assets WHERE parent = ? AND supprime_le IS NULL "
                "ORDER BY cree_le DESC, rang ASC",
                (identifiant,),
            ).fetchall()
        return [Asset.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def assets_du_personnage(self, personnage: str) -> list[Asset]:
        """Les images faites pour ce personnage — **jamais les supprimées**.

        C'est la question de la matrice, posée à chaque rendu : une case est
        pleine parce qu'une image la porte, et non parce qu'une liste de cases
        pleines aurait été tenue quelque part. Une image supprimée vide donc sa
        case toute seule, sans que rien n'ait à être défait.

        L'ordre est celui de la grille — la plus fraîche d'abord —, parce que
        c'est la dernière image faite qui représente sa case.
        """
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM assets "
                "WHERE personnage = ? AND supprime_le IS NULL "
                "ORDER BY cree_le DESC, rang ASC",
                (personnage,),
            ).fetchall()
        return [Asset.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def rangs_de_generation(self, generation: str) -> list[int]:
        """Les rangs déjà pris dans une génération — **supprimés compris**.

        C'est ce qui permet à une découpe de T5 de prendre une place libre à
        côté des emplacements de l'appel. Un supprimé compte : tant que son
        annulation court, ses fichiers `<rang>-*` sont encore sur le disque, et
        rendre son rang à quelqu'un d'autre écraserait une image qu'un geste
        peut encore ramener.
        """
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT rang FROM assets WHERE generation = ?", (generation,)
            ).fetchall()
        return [int(l["rang"]) for l in lignes]

    def compter_par_projet(self) -> dict[str | None, int]:
        """Combien d'assets par projet, et sous `None` ceux qui n'en ont pas.

        C'est ce compte qu'on annonce avant de supprimer un projet (US-30) : on
        ne fait pas confirmer une suppression sans dire ce qu'elle touche.
        """
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT projet, count(*) AS combien FROM assets "
                "WHERE supprime_le IS NULL GROUP BY projet"
            ).fetchall()
        return {l["projet"]: l["combien"] for l in lignes}

    def compter_par_collection(self) -> dict[str, int]:
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT collection, count(*) AS combien FROM assets "
                "WHERE supprime_le IS NULL AND collection IS NOT NULL "
                "GROUP BY collection"
            ).fetchall()
        return {l["collection"]: l["combien"] for l in lignes}

    def a_purger(self, avant: float) -> list[Asset]:
        """Les suppressions dont l'annulation a expiré. Un balayage, jamais une
        minuterie : rien ne tourne dans le vide quand l'atelier est au repos."""
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM assets "
                "WHERE supprime_le IS NOT NULL AND supprime_le < ?",
                (avant,),
            ).fetchall()
        return [Asset.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def oublier_asset(self, identifiant: str) -> None:
        """Retire la ligne. Les fichiers, c'est `Fichiers` qui les efface."""
        with self._connexion() as connexion:
            connexion.execute("DELETE FROM assets WHERE identifiant = ?", (identifiant,))

    def total_par_projet(self, projet: str | None) -> float:
        """Le total des coûts, **appels ratés compris** (US-14, achevée en T3)."""
        with self._connexion() as connexion:
            if projet is None:
                ligne = connexion.execute(
                    "SELECT COALESCE(SUM(cout_usd), 0) AS total FROM generations"
                ).fetchone()
            else:
                ligne = connexion.execute(
                    "SELECT COALESCE(SUM(cout_usd), 0) AS total FROM generations "
                    "WHERE projet = ?",
                    (projet,),
                ).fetchone()
        return round(float(ligne["total"]), 6)

    def totaux_par_projet(self) -> dict[str | None, float]:
        """Le même total, pour tous les projets d'un coup — l'arbre les affiche
        tous, et une requête par ligne d'arbre serait une requête de trop."""
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT projet, COALESCE(SUM(cout_usd), 0) AS total "
                "FROM generations GROUP BY projet"
            ).fetchall()
        return {l["projet"]: round(float(l["total"]), 6) for l in lignes}

    # ── Projets et collections ───────────────────────────────────────────────

    def enregistrer_projet(self, projet: Projet) -> None:
        with self._connexion() as connexion:
            connexion.execute(
                """
                INSERT INTO projets (identifiant, nom, cree_le, contenu)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(identifiant) DO UPDATE SET
                    nom = excluded.nom,
                    -- Même règle que sur les assets, et pour la même raison :
                    -- toute colonne qui double l'objet se réécrit depuis lui.
                    -- `cree_le` ne bouge pas aujourd'hui, mais c'est ce qu'on
                    -- disait aussi de celui d'un asset avant qu'un réalignement
                    -- de lot ne le déplace et ne fasse diverger les deux.
                    cree_le = excluded.cree_le,
                    contenu = excluded.contenu
                """,
                (
                    projet.identifiant,
                    projet.nom,
                    projet.cree_le,
                    json.dumps(projet.en_json(), ensure_ascii=False),
                ),
            )

    def projets(self) -> list[Projet]:
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM projets ORDER BY cree_le"
            ).fetchall()
        return [Projet.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def lire_projet(self, identifiant: str) -> Projet | None:
        with self._connexion() as connexion:
            ligne = connexion.execute(
                "SELECT contenu FROM projets WHERE identifiant = ?", (identifiant,)
            ).fetchone()
        if ligne is None:
            return None
        return Projet.depuis_json(json.loads(ligne["contenu"]))

    def oublier_projet(self, identifiant: str) -> None:
        with self._connexion() as connexion:
            connexion.execute(
                "DELETE FROM projets WHERE identifiant = ?", (identifiant,)
            )

    def enregistrer_collection(self, collection: Collection) -> None:
        with self._connexion() as connexion:
            connexion.execute(
                """
                INSERT INTO collections (identifiant, nom, projet, cree_le, contenu)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(identifiant) DO UPDATE SET
                    nom = excluded.nom,
                    projet = excluded.projet,
                    contenu = excluded.contenu
                """,
                (
                    collection.identifiant,
                    collection.nom,
                    collection.projet,
                    collection.cree_le,
                    json.dumps(collection.en_json(), ensure_ascii=False),
                ),
            )

    def collections(self) -> list[Collection]:
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM collections ORDER BY cree_le"
            ).fetchall()
        return [Collection.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def lire_collection(self, identifiant: str) -> Collection | None:
        with self._connexion() as connexion:
            ligne = connexion.execute(
                "SELECT contenu FROM collections WHERE identifiant = ?", (identifiant,)
            ).fetchone()
        if ligne is None:
            return None
        return Collection.depuis_json(json.loads(ligne["contenu"]))

    def oublier_collection(self, identifiant: str) -> None:
        with self._connexion() as connexion:
            connexion.execute(
                "DELETE FROM collections WHERE identifiant = ?", (identifiant,)
            )

    # ── La reconstruction ────────────────────────────────────────────────────

    def remplir(
        self,
        *,
        generations: Iterable[Generation] = (),
        assets: Iterable[Asset] = (),
        projets: Iterable[Projet] = (),
        collections: Iterable[Collection] = (),
    ) -> None:
        """Repose en bloc ce qu'on vient de relire du disque (US-40)."""
        for projet in projets:
            self.enregistrer_projet(projet)
        for collection in collections:
            self.enregistrer_collection(collection)
        for generation in generations:
            self.enregistrer(generation)
        for asset in assets:
            self.enregistrer_asset(asset)
