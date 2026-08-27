# -*- coding: utf-8 -*-
"""L'index SQLite des générations.

Colonnes en français (`AGENTS.md` § Règles durables). Une connexion par
opération, en WAL : le serveur écrit depuis plusieurs tâches à la fois dès que
les variations partent en parallèle, et une connexion partagée entre threads
est le premier bug qu'on s'épargne.

`contenu` porte l'enregistrement complet en JSON ; les quatre colonnes qui le
doublent existent pour être interrogées — statut, coût, date, projet — et sont
toujours réécrites depuis l'objet. Jamais deux vérités : l'objet est la vérité,
les colonnes en sont une projection.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from atelier.domaine.asset import Asset
from atelier.domaine.generation import Generation

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
    cree_le     REAL NOT NULL,
    projet      TEXT,
    favori      INTEGER NOT NULL DEFAULT 0,
    epingle     INTEGER NOT NULL DEFAULT 0,
    contenu     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS assets_par_date ON assets (cree_le DESC);
CREATE INDEX IF NOT EXISTS assets_par_projet ON assets (projet);
"""


class Base:
    def __init__(self, chemin: Path) -> None:
        self.chemin = chemin
        self.chemin.parent.mkdir(parents=True, exist_ok=True)
        with self._connexion() as connexion:
            connexion.executescript(SCHEMA)

    def _connexion(self) -> sqlite3.Connection:
        connexion = sqlite3.connect(self.chemin, timeout=10.0)
        connexion.execute("PRAGMA journal_mode=WAL")
        connexion.execute("PRAGMA foreign_keys=ON")
        connexion.row_factory = sqlite3.Row
        return connexion

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

    def en_vol(self) -> list[Generation]:
        """Ce qui était en cours ou en attente — au démarrage, c'est ce qui a été
        interrompu par l'arrêt du serveur. **Rien n'est jamais relancé
        automatiquement** (US-18) : on marque, on garde le coût, on attend."""
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM generations WHERE statut IN ('en_cours','en_attente')"
            ).fetchall()
        return [Generation.depuis_json(json.loads(l["contenu"])) for l in lignes]

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

    # ── Assets ───────────────────────────────────────────────────────────────
    #
    # Même règle que pour les générations : `contenu` porte l'enregistrement
    # complet, les colonnes qui le doublent existent pour être interrogées, et
    # elles sont toujours réécrites depuis l'objet. L'objet est la vérité.

    def enregistrer_asset(self, asset: "Asset") -> None:
        with self._connexion() as connexion:
            connexion.execute(
                """
                INSERT INTO assets
                    (identifiant, generation, rang, label, cree_le, projet,
                     favori, epingle, contenu)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(identifiant) DO UPDATE SET
                    label = excluded.label,
                    projet = excluded.projet,
                    favori = excluded.favori,
                    epingle = excluded.epingle,
                    contenu = excluded.contenu
                """,
                (
                    asset.identifiant,
                    asset.generation,
                    asset.rang,
                    asset.label,
                    asset.cree_le,
                    asset.projet,
                    int(asset.favori),
                    int(asset.epingle),
                    json.dumps(asset.en_disque(), ensure_ascii=False),
                ),
            )

    def lire_asset(self, identifiant: str) -> "Asset | None":
        with self._connexion() as connexion:
            ligne = connexion.execute(
                "SELECT contenu FROM assets WHERE identifiant = ?", (identifiant,)
            ).fetchone()
        if ligne is None:
            return None
        return Asset.depuis_json(json.loads(ligne["contenu"]))

    def assets_recents(self, limite: int = 200) -> list["Asset"]:
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM assets ORDER BY cree_le DESC LIMIT ?", (limite,)
            ).fetchall()
        return [Asset.depuis_json(json.loads(l["contenu"])) for l in lignes]

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
