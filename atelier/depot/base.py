# -*- coding: utf-8 -*-
"""L'index — SQLite, et **jetable**.

Colonnes en français (`AGENTS.md` § Règles durables). Une connexion par
opération, en WAL : le serveur écrit depuis plusieurs tâches à la fois dès que
les variations partent en parallèle, et une connexion partagée entre threads
est le premier bug qu'on s'épargne.

`contenu` porte l'enregistrement complet en JSON ; les colonnes qui le doublent
existent pour être **interrogées** — statut, coût, date, projet, favori,
filiation, suppression — et sont toujours réécrites depuis l'objet.
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
import contextvars
import json
import sqlite3
import unicodedata
from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence

from atelier.domaine.asset import Asset
from atelier.domaine.bande import Bande
from atelier.domaine.generation import Generation
from atelier.domaine.personnage import Personnage
from atelier.domaine.projet import Collection, Projet

# Change à chaque évolution du schéma. L'index est alors jeté et refait depuis
# les fichiers : c'est le geste normal, pas un incident.
VERSION = 11

SCHEMA = """
CREATE TABLE IF NOT EXISTS generations (
    identifiant TEXT PRIMARY KEY,
    modele      TEXT NOT NULL,
    statut      TEXT NOT NULL,
    -- **Ce que l'appel a consommé, et en quoi** (F2). `cout_usd` reste la part
    -- en argent : c'est lui que somment les totaux, et il vaut zéro dès que
    -- l'unité n'est pas celle de l'argent. Deux colonnes plutôt qu'une parce
    -- qu'une quantité sans unité ne veut plus rien dire depuis qu'un
    -- fournisseur compte en jetons — et parce que la réserve du jour se somme
    -- par unité, ce qui est une question, donc une colonne.
    cout_usd    REAL NOT NULL DEFAULT 0,
    consomme    REAL NOT NULL DEFAULT 0,
    unite       TEXT NOT NULL DEFAULT 'usd',
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
    parent      TEXT,
    personnage  TEXT,
    -- **La case que cette image remplit, en colonnes** (B9.1). Elles doublent
    -- `contenu`, comme `personnage` et `favori` le font depuis T3, et elles se
    -- réécrivent de l'objet à chaque enregistrement — jamais l'inverse. Sans
    -- elles, compter les cases pleines de deux cents sujets demandait de relire
    -- le JSON de chaque image ; avec elles, c'est un `GROUP BY`.
    --
    -- `piece` est ici pour une raison précise : c'est **elle** qui sépare les
    -- deux axes de la matrice (C3). Une image sans pièce est un corps et remplit
    -- la case de sa pose ; avec pièce, elle remplit la case de sa colonne
    -- d'équipement. Compter sans elle ferait paraître un casque comme un corps.
    pose        TEXT,
    piece       TEXT,
    favori      INTEGER NOT NULL DEFAULT 0,
    epingle     INTEGER NOT NULL DEFAULT 0,
    supprime_le REAL,
    contenu     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS assets_par_date ON assets (cree_le DESC);
CREATE INDEX IF NOT EXISTS assets_par_projet ON assets (projet);
CREATE INDEX IF NOT EXISTS assets_par_parent ON assets (parent);
-- La matrice de production demande « les images de ce personnage » à chaque
-- rendu, et une suppression de personnage les redemande toutes : c'est très
-- exactement la question qu'un index existe pour répondre. Le schéma n'a
-- aucune migration — il est jeté et refait depuis les fichiers au premier
-- démarrage qui suit son évolution (`docs/ARCHITECTURE.md` §4).
--
-- **La pose en second terme** (B9.1) : la matrice demande toujours « les images
-- de ce personnage », et la grille d'une famille demande « combien par pose,
-- pour ces deux cents sujets-là ». Un index sur le couple répond aux deux — le
-- préfixe reste utilisable seul.
CREATE INDEX IF NOT EXISTS assets_par_personnage ON assets (personnage, pose);

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

-- **La table de jointure d'une adhésion** (B8.2). `collections.contenu` porte
-- déjà les membres — la fiche JSON complète, comme partout ailleurs dans ce
-- fichier — et cette table n'en est donc pas la vérité : elle existe pour
-- qu'une question comme « les collections de ce sujet » ou « les sujets de
-- cette collection » se pose en SQL plutôt qu'en relisant `contenu` de chaque
-- ligne. `collection` référence son couple `(jeu, sujet)`, jamais l'inverse :
-- deux jeux peuvent nommer leur sujet pareil (`docs/tranches/V4.md` § B8).
-- `ON DELETE CASCADE` fait qu'une collection supprimée n'y laisse aucune ligne
-- fantôme, sans qu'un appelant ait à s'en souvenir.
CREATE TABLE IF NOT EXISTS collections_membres (
    collection  TEXT NOT NULL REFERENCES collections (identifiant) ON DELETE CASCADE,
    jeu         TEXT NOT NULL,
    sujet       TEXT NOT NULL,
    PRIMARY KEY (collection, jeu, sujet)
);
CREATE INDEX IF NOT EXISTS collections_membres_par_sujet ON collections_membres (jeu, sujet);

-- **Le sujet, comme raccourci jetable** (B8.3). `donnees/projets/<jeu>/personnages/`
-- reste la vérité — cette table n'en est qu'un index qui se reconstruit d'elle,
-- exactement comme `assets`. Elle renverse la décision écrite en toutes lettres
-- dans `atelier/services/production.py` (« lus du disque, jamais d'un index ») :
-- `B9` doit pouvoir en faire défiler des centaines, et parcourir chaque fichier
-- de chaque jeu à chaque écran ne le permet pas. Un identifiant de sujet n'est
-- unique que **par jeu** (`docs/tranches/V4.md` § B8) : la clé est le couple, pas
-- le seul identifiant, sinon `pelerin` du Marais écraserait celui des Salines.
-- **Les deux colonnes de recherche** (B8.5). `recherche` porte le nom *et* la
-- description normalisés — c'est elle que la recherche de sujets interroge.
-- `recherche_nom` ne porte que le nom : une image se retrouve par le nom de
-- son sujet, jamais par sa description, et confondre les deux aurait fait
-- remonter des images sur un mot qui ne décrit qu'un texte de bible que
-- personne n'a tapé pour chercher une image (`docs/tranches/V4.md` § B8.5).
CREATE TABLE IF NOT EXISTS personnages (
    identifiant   TEXT NOT NULL,
    projet        TEXT NOT NULL,
    nom           TEXT NOT NULL DEFAULT '',
    recherche     TEXT NOT NULL DEFAULT '',
    recherche_nom TEXT NOT NULL DEFAULT '',
    cree_le       REAL NOT NULL,
    contenu       TEXT NOT NULL,
    PRIMARY KEY (projet, identifiant)
);
CREATE INDEX IF NOT EXISTS personnages_par_projet ON personnages (projet, cree_le);

-- **Les bandes ne sont pas des assets** (A10), et cette table est la forme que
-- prend cette décision. Une bande est une suite d'images qui n'existent
-- qu'ensemble ; la ranger dans `assets` aurait obligé chaque endroit du produit
-- qui manipule une image à savoir qu'un asset peut en porter douze.
--
-- Deux questions se posent d'elles-mêmes, donc deux index : *les bandes de ce
-- clip* — l'écran de montage les liste à chaque ouverture — et *les bandes de ce
-- personnage*, qui est ce que la matrice animée d'`A12` demandera par case.
CREATE TABLE IF NOT EXISTS bandes (
    identifiant TEXT PRIMARY KEY,
    clip        TEXT NOT NULL,
    nom         TEXT NOT NULL DEFAULT '',
    cree_le     REAL NOT NULL,
    projet      TEXT,
    personnage  TEXT,
    pose        TEXT,
    direction   TEXT,
    -- **La pièce que cette animation porte** (B20), et elle sépare les deux
    -- calques de la couche animation exactement comme `assets.piece` sépare
    -- ceux de la couche image : une bande sans pièce est le corps qui bouge,
    -- une bande avec pièce est ce même mouvement habillé. Compter sans elle
    -- ferait paraître une épée en marche comme une seconde marche du goliath.
    piece       TEXT,
    contenu     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bandes_par_clip ON bandes (clip);
CREATE INDEX IF NOT EXISTS bandes_par_personnage ON bandes (personnage);
"""

TABLES = (
    "generations",
    "assets",
    "projets",
    "collections_membres",
    "collections",
    "bandes",
    "personnages",
)


# ── Le projet, lu une seule fois par demande ─────────────────────────────────
#
# Composer ce qui part relisait le projet **quarante-deux fois** pour répondre à
# une seule question (M3, mesuré le 4 septembre 2026) : chaque petit service le
# redemande pour son compte, et aucun ne sait ce que le voisin vient de lire. La
# liste des personnages était relue dix-huit fois, l'ambiance quatre.
#
# Ce n'est **pas** la connexion par opération qui est en cause, et elle ne bouge
# pas : refermer à chaque fois est ce qui permet d'effacer le fichier de l'index
# sous Windows, et c'est un critère du produit depuis T3. Ce qui n'a jamais été
# décidé, c'est de refaire quarante-deux fois le même aller-retour.
#
# La portée est donc **explicite et courte** — un service l'ouvre le temps de
# composer, et la referme. Pas de cache qui vit plus longtemps que la question
# posée : hors de cette portée, `lire_projet` relit le disque comme avant, et un
# projet enregistré ou oublié vide le mémo sur-le-champ. Un cache qu'on n'ouvre
# jamais soi-même est un cache dont on ne sait plus dire de quand il date.
_projets_lus: contextvars.ContextVar[dict[tuple[Path, str], "Projet | None"] | None] = (
    contextvars.ContextVar("projets_lus", default=None)
)


@contextlib.contextmanager
def projet_lu_une_fois() -> Iterator[None]:
    """Le temps de ce bloc, le même projet ne se lit qu'une fois.

    À ouvrir autour d'une **question entière** — composer ce qui part, dire ce
    qu'un envoi coûtera — jamais autour d'un programme entier. Les blocs
    s'emboîtent sans se gêner : le plus extérieur tient le mémo, les autres s'y
    posent.
    """
    if _projets_lus.get() is not None:
        yield
        return
    jeton = _projets_lus.set({})
    try:
        yield
    finally:
        _projets_lus.reset(jeton)


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
        self._demarquer()
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
                    (identifiant, modele, statut, cout_usd, consomme, unite,
                     cree_le, projet, contenu)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(identifiant) DO UPDATE SET
                    statut = excluded.statut,
                    cout_usd = excluded.cout_usd,
                    consomme = excluded.consomme,
                    unite = excluded.unite,
                    projet = excluded.projet,
                    contenu = excluded.contenu
                """,
                (
                    generation.identifiant,
                    generation.modele,
                    generation.statut.value,
                    generation.cout_usd,
                    generation.consomme,
                    generation.unite,
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
        """Ce que ce modèle a réellement **consommé**, aux derniers appels réussis.

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
                # **La quantité, pas la part en argent** (F2) : un modèle qui
                # compte en jetons a une médiane, et elle vaut d'être annoncée
                # avant l'appel exactement comme un prix. Un emplacement
                # d'avant la V2.2 n'a pas de `consomme` et porte son montant
                # dans `cout_usd` — il se relit sans rien perdre.
                quantite = emplacement.get("consomme", emplacement.get("cout_usd"))
                if emplacement.get("statut") == "reussie" and quantite:
                    couts.append(float(quantite))
        return couts

    def couts_par_references(
        self, modele: str, limite: int = 60
    ) -> list[tuple[int, float]]:
        """Ce qu'a coûté chaque appel réussi, **et combien d'images il portait** (E14).

        Jumeau de `couts_mesures`, avec le seul renseignement qui manquait pour
        répondre à la question de l'écran de confirmation : *que coûte l'image
        que je m'apprête à cocher ?* Mesuré sur ce que cette machine a payé,
        jamais sur un tarif — c'est la règle du produit depuis T1, et elle vaut
        pour un prix décomposé comme pour un prix entier.

        La fenêtre est plus large que celle de `couts_mesures` : décomposer
        demande des appels **à plusieurs comptes d'images**, et douze appels
        récents peuvent très bien n'en porter qu'un seul.
        """
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM generations WHERE modele = ? "
                "ORDER BY cree_le DESC LIMIT ?",
                (modele, limite),
            ).fetchall()

        mesures: list[tuple[int, float]] = []
        for ligne in lignes:
            enregistre = json.loads(ligne["contenu"])
            jointes = int(enregistre.get("demande", {}).get("references", 0) or 0)
            for emplacement in enregistre.get("emplacements", []):
                quantite = emplacement.get("consomme", emplacement.get("cout_usd"))
                if emplacement.get("statut") == "reussie" and quantite:
                    mesures.append((jointes, float(quantite)))
        return mesures

    # ── Assets ───────────────────────────────────────────────────────────────
    #
    # Même règle que pour les générations : `contenu` porte l'enregistrement
    # complet, les colonnes qui le doublent existent pour être interrogées, et
    # elles sont toujours réécrites depuis l'objet. L'objet est la vérité.

    def enregistrer_asset(self, asset: Asset) -> None:
        """Écrit l'asset, et recalcule `recherche` depuis lui — jamais un ajout.

        **`recherche` porte le prompt, la pose et la direction** (B8.5) — les
        trois champs que l'asset porte lui-même, dont l'identifiant est déjà un
        mot normalisé (`atelier/domaine/projet.py:repere`). **Le nom du sujet
        n'y est pas** : il vit sur le `Personnage`, pas sur l'asset, et le
        graver ici à la naissance de l'image le figerait — un sujet renommé
        laisserait ses images introuvables sous son nouveau nom. La recherche
        d'une image par le nom de son sujet passe donc par une jointure sur
        `personnages`, toujours à jour, jamais par cette colonne
        (`_conditions_assets`).
        """
        with self._connexion() as connexion:
            connexion.execute(
                """
                INSERT INTO assets
                    (identifiant, generation, rang, label, recherche, cree_le,
                     projet, parent, personnage, pose, piece, favori, epingle,
                     supprime_le, contenu)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    parent = excluded.parent,
                    personnage = excluded.personnage,
                    pose = excluded.pose,
                    piece = excluded.piece,
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
                    normaliser(
                        " ".join(
                            filter(None, (asset.label, asset.pose, asset.direction))
                        )
                    ),
                    asset.cree_le,
                    asset.projet,
                    asset.parent,
                    asset.personnage,
                    asset.pose,
                    asset.piece,
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

    @staticmethod
    def _conditions_assets(
        *,
        projet: str | None,
        sans_projet: bool,
        collection: str | None,
        favoris: bool,
        recherche: str,
        supprimes: bool,
    ) -> tuple[list[str], list[Any]]:
        """Le filtre de la grille, bâti une seule fois.

        **Partagé par `assets()` et `compter_assets()`** — sans quoi les deux
        finiraient par diverger, exactement le défaut que ce fichier interdit
        en tête : une grille qui montre 200 images et un total qui n'aurait pas
        compté les mêmes.

        **`collection` ne lit plus une colonne de l'image depuis B8.4** : une
        collection range des **sujets**, pas des images
        (`docs/tranches/V4.md` § B8). Le filtre devient donc *les images des
        sujets de cette collection* — une image y répond si son couple
        `(projet, personnage)` est un membre de `collections_membres`. `NULL`
        n'y égale jamais rien : une image sans projet ou sans personnage ne
        matche donc aucune collection, sans garde à écrire pour le dire.

        **`recherche` porte deux moitiés depuis B8.5** : la colonne `recherche`
        de l'image elle-même — prompt, pose, direction —, **ou** le nom de son
        sujet, lu à l'instant par une jointure sur `personnages`. La seconde
        moitié ne peut pas être une colonne : un sujet renommé doit changer ce
        que ses images trouvent, sans qu'aucune image n'ait été réécrite pour
        ça — c'est le sens même d'un index qui se reconstruit du sujet, pas
        d'un sujet copié dans l'image (`docs/tranches/V4.md` § B8.5).
        """
        conditions = ["supprime_le IS NOT NULL" if supprimes else "supprime_le IS NULL"]
        arguments: list[Any] = []
        if sans_projet:
            conditions.append("projet IS NULL")
        elif projet is not None:
            conditions.append("projet = ?")
            arguments.append(projet)
        if collection is not None:
            conditions.append(
                "EXISTS (SELECT 1 FROM collections_membres cm "
                "WHERE cm.collection = ? AND cm.jeu = assets.projet "
                "AND cm.sujet = assets.personnage)"
            )
            arguments.append(collection)
        if favoris:
            conditions.append("favori = 1")
        if recherche.strip():
            terme = "%" + normaliser(recherche.strip()) + "%"
            conditions.append(
                "(recherche LIKE ? OR EXISTS ("
                "SELECT 1 FROM personnages p WHERE p.projet = assets.projet "
                "AND p.identifiant = assets.personnage AND p.recherche_nom LIKE ?"
                "))"
            )
            arguments.append(terme)
            arguments.append(terme)
        return conditions, arguments

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
        même » (`docs/archive/plan-versions-tenues.md`, T3) : il n'existe donc qu'un seul endroit qui
        sache filtrer des assets, et l'écran comme le MCP de T7 passent par lui.
        Deux listages écrits à deux endroits, c'est la divergence relevée chez
        SpriteCook, dont une grille montre les pastilles et l'autre non.

        Un asset supprimé est **hors bibliothèque** tant que son annulation
        court : il ne se compte pas, ne se cherche pas, ne se filtre pas.
        """
        conditions, arguments = self._conditions_assets(
            projet=projet,
            sans_projet=sans_projet,
            collection=collection,
            favoris=favoris,
            recherche=recherche,
            supprimes=supprimes,
        )

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

    def compter_assets(
        self,
        *,
        projet: str | None = None,
        sans_projet: bool = False,
        collection: str | None = None,
        favoris: bool = False,
        recherche: str = "",
        supprimes: bool = False,
    ) -> int:
        """Combien la grille tiendrait sans son plafond (B3).

        **La grille s'arrêtait à 200 sans le dire** — l'auteur croyait avoir
        tout vu. Ce compte est ce qui permet d'écrire « 200 montrées sur 486 » :
        même filtre que `assets()`, sans le `LIMIT`.
        """
        conditions, arguments = self._conditions_assets(
            projet=projet,
            sans_projet=sans_projet,
            collection=collection,
            favoris=favoris,
            recherche=recherche,
            supprimes=supprimes,
        )
        with self._connexion() as connexion:
            ligne = connexion.execute(
                "SELECT COUNT(*) AS total FROM assets WHERE " + " AND ".join(conditions),
                arguments,
            ).fetchone()
        return int(ligne["total"])

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

    def assets_du_personnage(
        self, personnage: str, *, projet: str | None = None
    ) -> list[Asset]:
        """Les images faites pour ce personnage — **jamais les supprimées**.

        **`projet` n'est pas un confort, c'est le piège de B8.** Un identifiant
        de sujet n'est unique que par jeu : sans lui, les images du `pelerin`
        des Salines remplissent les cases de celui du Marais, et la matrice du
        second se dit complète en montrant les images du premier. Trouvé en
        B9.1, où le compte groupé — qui filtre, lui — contredisait la matrice.
        `None` ne filtre pas : c'est ce que font encore les appelants qui n'ont
        pas de jeu sous la main, et qui ne posent pas la question de la case.

        Une image sans jeu compte quand même : elle porte bien ce sujet-là, et
        l'écarter ferait disparaître une case pleine sans que rien ne le dise.

        C'est la question de la matrice, posée à chaque rendu : une case est
        pleine parce qu'une image la porte, et non parce qu'une liste de cases
        pleines aurait été tenue quelque part. Une image supprimée vide donc sa
        case toute seule, sans que rien n'ait à être défait.

        L'ordre est celui de la grille — la plus fraîche d'abord —, parce que
        c'est la dernière image faite qui représente sa case.
        """
        conditions = ["personnage = ?", "supprime_le IS NULL"]
        arguments: list[Any] = [personnage]
        if projet is not None:
            conditions.append("(projet = ? OR projet IS NULL)")
            arguments.append(projet)
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM assets WHERE "
                + " AND ".join(conditions)
                + " ORDER BY cree_le DESC, rang ASC",
                arguments,
            ).fetchall()
        return [Asset.depuis_json(json.loads(l["contenu"])) for l in lignes]

    # ── Le compte groupé, pour toute une page de sujets (B9.1) ───────────────
    #
    # **Ce que ces deux méthodes remplacent, et rien d'autre.** La matrice d'un
    # sujet (`ServiceProduction.cases`) fait un aller-retour SQL par sujet ;
    # `bilan_du_jeu` l'appelle en boucle et le dit lui-même. La grille d'une
    # famille en montre deux cents d'un coup : deux cents allers-retours pour
    # afficher deux cents petits « 4 / 6 ».
    #
    # ⚠️ Elles ne comptent **que ce qui existe**, jamais ce qui est attendu. La
    # règle de complétude — quelles poses ce sujet-là tient, sous quels angles,
    # combien d'images chacune réclame — vit sur `Personnage` et sur `Pose`, et
    # elle y reste : la réécrire en SQL fabriquerait une seconde vérité, très
    # exactement ce que `famille_de` refuse d'ailleurs pour la famille (E15).
    # Ici on rend le numérateur ; le dénominateur se calcule en Python, à côté,
    # par les règles déjà écrites (`docs/tranches/V4.md` § B9, décision 2).

    def _comptes_par_pose(
        self,
        table: str,
        projet: str,
        personnages: Sequence[str],
        conditions: Sequence[str] = (),
    ) -> dict[tuple[str, str], int]:
        """Combien de lignes par couple *(sujet, pose)*, pour ces sujets-là.

        **Le jeu filtre, mais un sans-jeu compte quand même.** Un identifiant de
        sujet n'est unique que par jeu (`docs/tranches/V4.md` § B8) : sans le
        filtre, le `pelerin` des Salines gonflerait le compte de celui du Marais.
        Mais une image peut porter un sujet sans porter de jeu, et la matrice la
        compte aujourd'hui — l'exclure ici ferait dire à la grille moins que ce
        que la fiche du même sujet montre, ce qui est la pire des deux fautes.
        """
        if not personnages:
            return {}
        toutes = [
            "pose IS NOT NULL",
            "pose <> ''",
            "(projet = ? OR projet IS NULL)",
            *conditions,
        ]
        comptes: dict[tuple[str, str], int] = {}
        # SQLite plafonne le nombre de paramètres d'une requête ; on découpe,
        # comme `rangs_vivants` le fait déjà pour la même raison.
        with self._connexion() as connexion:
            for depart in range(0, len(personnages), 400):
                paquet = list(personnages[depart : depart + 400])
                trous = ",".join("?" * len(paquet))
                lignes = connexion.execute(
                    f"SELECT personnage, pose, COUNT(*) AS combien FROM {table} "
                    "WHERE " + " AND ".join(toutes)
                    + f" AND personnage IN ({trous}) GROUP BY personnage, pose",
                    (projet, *paquet),
                ).fetchall()
                for ligne in lignes:
                    comptes[(ligne["personnage"], ligne["pose"])] = int(ligne["combien"])
        return comptes

    def images_par_pose(
        self, projet: str, personnages: Sequence[str]
    ) -> dict[tuple[str, str], int]:
        """Les **corps** faits, couple par couple — jamais les calques.

        `piece IS NULL` est la même ligne de partage que la matrice (C3) : une
        image qui porte une pièce remplit la case de sa colonne d'équipement, pas
        celle de sa pose. Sans ce filtre, un casque posé sur six poses ferait
        paraître six corps qui n'existent pas, et un sujet sans un seul corps se
        dirait complet.

        Une image supprimée ne compte pas, exactement comme dans
        `assets_du_personnage` : *une case est pleine parce qu'une image la
        porte*, et la vider ne demande donc rien à défaire.
        """
        return self._comptes_par_pose(
            "assets",
            projet,
            personnages,
            conditions=("supprime_le IS NULL", "piece IS NULL"),
        )

    def bandes_par_pose(
        self, projet: str, personnages: Sequence[str]
    ) -> dict[tuple[str, str], int]:
        """Les animations faites, couple par couple.

        **Le second calque, compté à part** (A12, `AGENTS.md` 8quater). Il ne se
        mêle pas au premier : une case qui porterait les deux serait pleine dès
        qu'elle a l'une des deux, et une animation manquante se cacherait
        derrière une image présente.

        **Une bande habillée ne compte pas** (B20), et c'est très exactement le
        `piece IS NULL` que le compte des images tient depuis `C3`, posé ici le
        jour où une bande a pu porter une pièce. Sans lui, habiller la marche du
        goliath remplirait la case *marche* une seconde fois, et la matrice
        dirait deux animations là où le personnage n'en a qu'une.
        """
        return self._comptes_par_pose(
            "bandes", projet, personnages, conditions=("piece IS NULL",)
        )

    def vignettes_par_personnage(
        self, projet: str, personnages: Sequence[str]
    ) -> dict[str, Asset]:
        """Une image par sujet — **celle que sa carte montre** (B9.4).

        La grille d'une famille dessine deux cents cartes, chacune avec une
        vignette. Relire les images de chaque sujet pour n'en garder qu'une
        serait deux cents allers-retours pour deux cents timbres-poste : c'est
        exactement ce que `B9.1` a retiré au compte, et le rendre ici par la
        bande n'aurait aucun sens.

        **La plus fraîche gagne**, comme dans `assets_du_personnage` : c'est la
        dernière image faite qui représente son sujet. `MAX(cree_le)` avec les
        autres colonnes nues est défini en SQLite — la ligne rendue est celle
        du maximum, pas une ligne au hasard.

        **Un corps, jamais une pièce** : un casque n'est pas le portrait de
        celui qui le porte. C'est la même séparation que `piece IS NULL` tient
        déjà dans le compte des cases.
        """
        vignettes: dict[str, Asset] = {}
        if not personnages:
            return vignettes
        with self._connexion() as connexion:
            for depart in range(0, len(personnages), 400):
                paquet = list(personnages[depart : depart + 400])
                trous = ",".join("?" * len(paquet))
                lignes = connexion.execute(
                    "SELECT personnage, contenu, MAX(cree_le) FROM assets "
                    "WHERE supprime_le IS NULL AND piece IS NULL "
                    "AND (projet = ? OR projet IS NULL) "
                    f"AND personnage IN ({trous}) GROUP BY personnage",
                    (projet, *paquet),
                ).fetchall()
                for ligne in lignes:
                    vignettes[ligne["personnage"]] = Asset.depuis_json(
                        json.loads(ligne["contenu"])
                    )
        return vignettes

    def rangs_vivants(self, generations: Sequence[str]) -> dict[str, set[int]]:
        """Quels emplacements ont **encore** leur image, pour un lot d'appels.

        C'est ce qui sépare *gardé* de *payé pour rien* sur l'écran des dépenses
        (E18) : un emplacement qui a réussi et dont l'image a été supprimée a
        coûté exactement ce qu'il coûtait, et n'a plus rien à montrer. Le compte
        se fait donc sur les assets vivants, jamais sur le statut de
        l'emplacement — qui, lui, ne change plus jamais après l'appel.

        **Un supprimé ne compte pas ici, contrairement à `rangs_de_generation`**,
        et les deux méthodes ont raison chacune de son côté : celle-là protège
        des fichiers qu'une annulation peut encore ramener, celle-ci répond à
        « qu'est-ce qui reste ». Une seule des deux ne pourrait pas faire les
        deux réponses.

        Une requête pour tout le lot, jamais une par ligne : l'écran en affiche
        des centaines.
        """
        if not generations:
            return {}
        vivants: dict[str, set[int]] = {}
        # SQLite plafonne le nombre de paramètres d'une requête ; on découpe.
        with self._connexion() as connexion:
            for depart in range(0, len(generations), 400):
                paquet = list(generations[depart : depart + 400])
                trous = ",".join("?" * len(paquet))
                lignes = connexion.execute(
                    "SELECT generation, rang FROM assets "
                    f"WHERE supprime_le IS NULL AND generation IN ({trous})",
                    paquet,
                ).fetchall()
                for ligne in lignes:
                    vivants.setdefault(str(ligne["generation"]), set()).add(int(ligne["rang"]))
        return vivants

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

    def compter_par_collection(self, jeu: str | None = None) -> dict[str, int]:
        """Combien de **sujets** par collection (B8.4) — plus des images.

        Lu sur `collections_membres` : chaque ligne y est un couple
        `(jeu, sujet)` déjà dédupliqué par `Collection.avec`, donc compter les
        lignes de la table revient à compter les sujets.

        **Sans `jeu`, une collection qui mêle deux univers compte les deux
        ensemble** — c'est une taille de groupe pour l'arbre, et c'est ce que
        l'arbre veut : il range les collections de l'atelier, pas d'un jeu.

        **Avec `jeu`, c'est « combien de ce jeu-ci »**, ce que `sujets_du_jeu`
        seule savait répondre jusqu'ici (`atelier/domaine/projet.py`), et ce
        dont la grille de `B9.5` a besoin : le « 10 + 3 » annoncé au-dessus
        d'une collection pendant qu'on y glisse trois sujets doit compter les
        dix **de ce jeu-là**. Un compte mêlé annoncerait un total que le carnet
        ne montrerait jamais.
        """
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT collection, count(*) AS combien FROM collections_membres "
                + ("WHERE jeu = ? " if jeu is not None else "")
                + "GROUP BY collection",
                (jeu,) if jeu is not None else (),
            ).fetchall()
        return {l["collection"]: l["combien"] for l in lignes}

    def collections_par_sujet(
        self, jeu: str, sujets: Sequence[str]
    ) -> dict[str, list[dict[str, str]]]:
        """Les collections de chaque sujet, pour toute une page (B9.3).

        **Une jointure, posée à côté du compte de B9.1** dans la même requête
        de la route — c'est le patron déjà écrit en `B8.4` pour *compter* un
        groupe, employé ici pour *lister* les groupes d'un sujet. `collections.nom`
        est joint tout de suite : sans lui, l'écran devrait relire chaque
        collection une par une pour savoir comment l'appeler.

        **Filtré par jeu, comme `assets_du_personnage` depuis B9.1** — le même
        piège d'homonymie s'appliquerait sinon : le `pelerin` du Marais verrait
        les collections où le `pelerin` des Salines est rangé.

        Un sujet sans aucune collection reçoit une liste vide, jamais une clé
        absente — la carte n'a pas à distinguer les deux.
        """
        resultat: dict[str, list[dict[str, str]]] = {s: [] for s in sujets}
        if not sujets:
            return resultat
        with self._connexion() as connexion:
            for depart in range(0, len(sujets), 400):
                paquet = list(sujets[depart : depart + 400])
                trous = ",".join("?" * len(paquet))
                lignes = connexion.execute(
                    "SELECT cm.sujet AS sujet, c.identifiant AS identifiant, "
                    "c.nom AS nom FROM collections_membres cm "
                    "JOIN collections c ON c.identifiant = cm.collection "
                    f"WHERE cm.jeu = ? AND cm.sujet IN ({trous}) "
                    "ORDER BY c.cree_le",
                    (jeu, *paquet),
                ).fetchall()
                for ligne in lignes:
                    resultat[ligne["sujet"]].append(
                        {"identifiant": ligne["identifiant"], "nom": ligne["nom"]}
                    )
        return resultat

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

    def unite_du_modele(self, modele: str) -> str | None:
        """L'unité dans laquelle ce modèle a consommé, au dernier appel connu.

        Arrivée en F2, et lue sur ce qui est parti plutôt que sur le catalogue :
        un modèle disparu du catalogue garde ses dépenses, et l'écran des
        dépenses doit encore savoir les écrire. `None` quand il n'a jamais servi
        ici — l'appelant prend alors l'unité que le fournisseur déclare.
        """
        with self._connexion() as connexion:
            ligne = connexion.execute(
                "SELECT unite FROM generations WHERE modele = ? "
                "ORDER BY cree_le DESC LIMIT 1",
                (modele,),
            ).fetchone()
        return str(ligne["unite"]) if ligne else None

    def consomme_depuis(self, depuis: float) -> list[tuple[str, str, float]]:
        """`(modèle, unité, quantité)` de tout ce qui est parti depuis `depuis`.

        Arrivée en F2 : c'est la question que pose la réserve d'un fournisseur —
        *combien est parti chez lui depuis le dernier renouvellement ?* — et
        c'est une question, donc une requête, et non une relecture de toutes les
        générations en mémoire.

        **Les appels ratés comptés avec les autres.** Un refus qui a atteint le
        modèle a consommé ; l'oublier ferait un compte de réserve faux vers le
        haut, c'est-à-dire faux du côté qui laisse partir un lot qui ne passera
        pas.
        """
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT modele, unite, COALESCE(SUM(consomme), 0) AS total "
                "FROM generations WHERE cree_le >= ? GROUP BY modele, unite",
                (depuis,),
            ).fetchall()
        return [
            (str(l["modele"]), str(l["unite"]), round(float(l["total"]), 6))
            for l in lignes
        ]

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

    def _demarquer(self, identifiant: str | None = None) -> None:
        """Le mémo oublie ce projet — ou tout, quand l'index est vidé.

        Écrire pendant une portée de lecture est rare, mais on ne veut pas avoir
        à s'en souvenir : la portée sert à ne pas relire deux fois la **même**
        chose, jamais à survivre à un changement.
        """
        memo = _projets_lus.get()
        if memo is None:
            return
        if identifiant is None:
            memo.clear()
        else:
            memo.pop((self.chemin, identifiant), None)

    def enregistrer_projet(self, projet: Projet) -> None:
        self._demarquer(projet.identifiant)
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
        """Le projet, relu du disque — **sauf dans une portée qui l'a déjà lu**.

        Voir `projet_lu_une_fois` : hors de cette portée, rien ne change. Le
        projet absent se retient aussi, parce que la question *« ce projet
        existe-t-il ? »* se pose autant de fois que l'autre.
        """
        memo = _projets_lus.get()
        cle = (self.chemin, identifiant)
        if memo is not None and cle in memo:
            return memo[cle]
        lu = self._lire_projet_du_disque(identifiant)
        if memo is not None:
            memo[cle] = lu
        return lu

    def _lire_projet_du_disque(self, identifiant: str) -> Projet | None:
        """L'aller-retour réel : connexion neuve, bloc lu, objet reconstruit.

        Séparé de `lire_projet` pour que l'essai de M3 puisse compter des
        **lectures** et non des appels. Le compte est ce que la tranche promet —
        *une seule lecture par demande* —, et un temps ne le dirait pas : un temps
        dépend de la machine, un compte non.
        """
        with self._connexion() as connexion:
            ligne = connexion.execute(
                "SELECT contenu FROM projets WHERE identifiant = ?", (identifiant,)
            ).fetchone()
        if ligne is None:
            return None
        return Projet.depuis_json(json.loads(ligne["contenu"]))

    def oublier_projet(self, identifiant: str) -> None:
        self._demarquer(identifiant)
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
            # La table de jointure se réécrit en entier plutôt que se diffe :
            # même règle que `contenu` deux lignes plus haut, et une collection
            # ne porte jamais assez de membres pour que ça coûte quoi que ce
            # soit (B8.2).
            connexion.execute(
                "DELETE FROM collections_membres WHERE collection = ?",
                (collection.identifiant,),
            )
            connexion.executemany(
                "INSERT INTO collections_membres (collection, jeu, sujet) "
                "VALUES (?, ?, ?)",
                [
                    (collection.identifiant, membre.jeu, membre.sujet)
                    for membre in collection.membres
                ],
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

    # ── Les sujets, comme raccourci jetable (B8.3) ───────────────────────────
    #
    # **Deux crochets, pas une chasse.** `ServiceProduction._sauver` est le seul
    # endroit du dépôt qui écrive un personnage, et `supprimer_personnage` le
    # seul qui l'efface — les deux appellent respectivement `enregistrer_personnage`
    # et `oublier_personnage` juste après avoir touché le fichier. Rien d'autre
    # n'écrit ici, et `personnages()` (`atelier/services/production.py`) continue
    # de lire le disque : router cette lecture est l'affaire de `B8.4` et de `B9`.

    def enregistrer_personnage(self, personnage: Personnage) -> None:
        with self._connexion() as connexion:
            connexion.execute(
                """
                INSERT INTO personnages
                    (identifiant, projet, nom, recherche, recherche_nom, cree_le, contenu)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(projet, identifiant) DO UPDATE SET
                    nom = excluded.nom,
                    recherche = excluded.recherche,
                    recherche_nom = excluded.recherche_nom,
                    cree_le = excluded.cree_le,
                    contenu = excluded.contenu
                """,
                (
                    personnage.identifiant,
                    personnage.projet,
                    personnage.nom,
                    normaliser(personnage.nom + " " + personnage.description),
                    normaliser(personnage.nom),
                    personnage.cree_le,
                    json.dumps(personnage.en_json(), ensure_ascii=False),
                ),
            )

    def personnages_du_projet(
        self, projet: str, *, recherche: str = "", limite: int | None = 200
    ) -> list[Personnage]:
        """Ceux d'un projet — **et ceux qui répondent à une recherche** (B8.5).

        Le même filtre que celui des images (`_conditions_assets`), en plus
        simple : un seul groupe, un seul champ de comparaison, parce qu'un
        sujet n'a ni prompt ni pose — juste un nom et une description, tous
        deux dans `recherche`.

        **`limite=None` ne plafonne rien** — arrivé en B9.2, pour la route qui
        sert une famille : la décision 1 de `B9` filtre la famille **en
        mémoire**, et filtrer en mémoire un sous-ensemble d'une page déjà
        plafonnée aurait fait paraître moins de sujets qu'il n'en existe
        vraiment dans cette famille. Il faut donc le jeu entier avant de
        répartir, et seule cette route-là pose `limite=None` : `rechercher_personnages`
        garde son plafond, exposé tel quel à l'agent et à l'écran de recherche.
        """
        conditions = ["projet = ?"]
        arguments: list[Any] = [projet]
        if recherche.strip():
            conditions.append("recherche LIKE ?")
            arguments.append("%" + normaliser(recherche.strip()) + "%")
        requete = (
            "SELECT contenu FROM personnages WHERE "
            + " AND ".join(conditions)
            + " ORDER BY cree_le"
        )
        if limite is not None:
            requete += " LIMIT ?"
            arguments.append(limite)
        with self._connexion() as connexion:
            lignes = connexion.execute(requete, arguments).fetchall()
        return [Personnage.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def oublier_personnage(self, projet: str, identifiant: str) -> None:
        with self._connexion() as connexion:
            connexion.execute(
                "DELETE FROM personnages WHERE projet = ? AND identifiant = ?",
                (projet, identifiant),
            )

    # ── Les bandes (A10) ─────────────────────────────────────────────────────

    def enregistrer_bande(self, bande: Bande) -> None:
        with self._connexion() as connexion:
            connexion.execute(
                """
                INSERT INTO bandes (
                    identifiant, clip, nom, cree_le,
                    projet, personnage, pose, direction, piece, contenu
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(identifiant) DO UPDATE SET
                    clip = excluded.clip,
                    nom = excluded.nom,
                    projet = excluded.projet,
                    personnage = excluded.personnage,
                    pose = excluded.pose,
                    direction = excluded.direction,
                    piece = excluded.piece,
                    contenu = excluded.contenu
                """,
                (
                    bande.identifiant,
                    bande.clip,
                    bande.nom,
                    bande.cree_le,
                    bande.projet,
                    bande.personnage,
                    bande.pose,
                    bande.direction,
                    bande.piece,
                    json.dumps(bande.en_json(), ensure_ascii=False),
                ),
            )

    def lire_bande(self, identifiant: str) -> Bande | None:
        with self._connexion() as connexion:
            ligne = connexion.execute(
                "SELECT contenu FROM bandes WHERE identifiant = ?", (identifiant,)
            ).fetchone()
        if ligne is None:
            return None
        return Bande.depuis_json(json.loads(ligne["contenu"]))

    def bandes_du_clip(self, clip: str) -> list[Bande]:
        """Dans l'ordre où elles ont été gardées, la première d'abord.

        **Et pas la plus récente d'abord**, contrairement à tout le reste du
        produit : cette liste raconte un découpage en cours, et un découpage se
        lit dans l'ordre où on l'a fait. Une galerie montre le dernier travail ;
        celle-ci montre *ce qu'on a déjà tiré de ce clip*.
        """
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM bandes WHERE clip = ? ORDER BY cree_le",
                (clip,),
            ).fetchall()
        return [Bande.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def bandes_du_personnage(
        self, personnage: str, *, projet: str | None = None
    ) -> list[Bande]:
        """Le second calque du même sujet, et le même filtre facultatif que
        `assets_du_personnage` — pour la même raison, et elle y est écrite."""
        conditions = ["personnage = ?"]
        arguments: list[Any] = [personnage]
        if projet is not None:
            conditions.append("(projet = ? OR projet IS NULL)")
            arguments.append(projet)
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM bandes WHERE "
                + " AND ".join(conditions)
                + " ORDER BY cree_le",
                arguments,
            ).fetchall()
        return [Bande.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def bandes(self) -> list[Bande]:
        with self._connexion() as connexion:
            lignes = connexion.execute(
                "SELECT contenu FROM bandes ORDER BY cree_le DESC"
            ).fetchall()
        return [Bande.depuis_json(json.loads(l["contenu"])) for l in lignes]

    def oublier_bande(self, identifiant: str) -> None:
        with self._connexion() as connexion:
            connexion.execute(
                "DELETE FROM bandes WHERE identifiant = ?", (identifiant,)
            )

    # ── La reconstruction ────────────────────────────────────────────────────

    def remplir(
        self,
        *,
        generations: Iterable[Generation] = (),
        assets: Iterable[Asset] = (),
        projets: Iterable[Projet] = (),
        collections: Iterable[Collection] = (),
        bandes: Iterable[Bande] = (),
        personnages: Iterable[Personnage] = (),
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
        for bande in bandes:
            self.enregistrer_bande(bande)
        for personnage in personnages:
            self.enregistrer_personnage(personnage)
