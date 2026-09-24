# -*- coding: utf-8 -*-
"""La bibliothèque — ranger, retrouver, juger, jeter.

**Tout ce qui sort entre ici de lui-même** (US-25), rangé dans le projet
courant. Juger, c'est marquer favori ou supprimer ; ce n'est jamais accepter.
Il n'y a pas de sas : un sas ferait perdre par inattention ce qui a été payé.

Ce service n'appelle jamais le fournisseur, et ça se lit dans ses imports :
retrouver, ranger, marquer et supprimer marchent réseau coupé (US-92). Il ne
calcule pas non plus d'image — la retouche est à `services/assets.py`, et c'est
lui, là-bas, qui reste le **seul** à écrire un asset.

Quatre règles portées ici, et instaurées une fois pour toutes :

- **Les fichiers font foi, la base est un index reconstructible** (US-40).
  `reconstruire()` relit `donnees/` et repose tout : générations, assets,
  rangement, favoris, filiation, suppressions.
- **Jamais de cascade.** Un parent supprimé laisse ses enfants en place, chacun
  marqué « parent supprimé » (US-28, US-29). Un projet supprimé **détache** ses
  assets, il ne les détruit pas (US-30).
- **Une annulation courte, puis c'est définitif** (US-27). L'asset quitte la
  bibliothèque au moment du geste ; ses fichiers, eux, attendent le délai.
- **Une seule requête d'assets pour tout le produit** — celle de `Base.assets`.
  L'écran s'en sert pour la grille, et le MCP de T7 s'en servira pour lister :
  ce qu'un agent voit est exactement ce que l'écran voit.
"""

from __future__ import annotations

import json
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset
from atelier.domaine.bande import Bande
from atelier.domaine.consommation import est_argent
from atelier.domaine.coup_de_main import AppelTexte
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.galerie import (
    JUGEMENT_PAR_DEFAUT,
    ROLE_PAR_DEFAUT,
    TRI_PAR_DEFAUT,
    jugement_valide,
    ordonner_par_groupe,
    regrouper_par_origine,
    role_valide,
    tri_valide,
)
from atelier.domaine.generation import Generation, Statut
from atelier.domaine.personnage import Personnage
from atelier.domaine.projet import (
    MATIERE,
    NOM_BAC_A_SABLE,
    SUJET,
    Collection,
    Projet,
    deja_porte,
    repere,
)
from atelier.services.assets import ServiceAssets
from atelier.services.evenements import Diffusion

# Combien de temps il reste pour revenir en arrière après une suppression.
#
# Huit secondes : le temps de lire le bandeau et de bouger la main, pas celui de
# changer d'avis à la réflexion. Au-delà, ce serait une corbeille — et la
# corbeille est explicitement hors périmètre (`docs/PRD.md`). En deçà, le
# bandeau serait un reproche plutôt qu'une issue.
ANNULATION_S = 8.0

# Ce que la grille sert d'un coup. Large : l'écran filtre côté serveur, donc ce
# plafond ne borne que ce qu'un seul filtre peut rendre, jamais la bibliothèque.
PAR_DEFAUT = 200

# RG6 : la phrase d'un refus, écrite une fois — l'écran l'affiche telle quelle,
# et la fiche d'une image en dit la première moitié sans attendre le refus.
REFUS_MATIERE_D_UN_SUJET = (
    "Cette image est rangée dans un sujet : sors-la de son sujet d'abord, ou "
    "génère la matière depuis l'écran des tuiles."
)

# RG8 : les mots de la migration. La nature « matière » n'est plus une chose qu'on
# crée (RG5 §4) ; « décor » est le repli de RG1 (`capacites_de` la rend à toute
# nature inconnue) — le plus permissif de la table qui ne sert pas de matière.
NATURE_MATIERE = "matière"
NATURE_DE_REPLI = "décor"

# Le journal de la migration, à côté de `projet.json` (`Fichiers.journal_matieres_du_jeu`).
JOURNAL_MATIERES = "migration-matieres.json"

# Ce que le journal retient de l'image **avant** qu'on la réécrive : de quoi la
# remettre telle qu'elle était, champ par champ.
CHAMPS_JOURNALISES = (
    "personnage",
    "pose",
    "direction",
    "label",
    "matiere",
    "personnage_supprime",
)


def _nature_est_matiere(nature: str) -> bool:
    return unicodedata.normalize("NFC", nature or "").casefold() == NATURE_MATIERE


def _demande_une_matiere(generation: Generation) -> bool:
    """**La seule lecture de la règle** (RG5 §1) : la génération a demandé
    `echelle="matière"`. Jamais le nom du sujet, jamais son type : un sujet nommé
    « Matières » qui tient de vrais décors ne perd rien.

    Comparée en NFC : la même lettre peut s'écrire d'un ou de deux points de code,
    et un fichier repassé par un autre éditeur ne doit pas échapper à la règle."""
    echelle = generation.demande.get("echelle")
    return isinstance(echelle, str) and unicodedata.normalize("NFC", echelle) == NATURE_MATIERE


def _journal_vierge(projet: str) -> dict[str, Any]:
    return {"version": 1, "projet": projet, "images": {}, "sujets": {}}


def _entree_valide(entree: Any) -> bool:
    return isinstance(entree, dict) and isinstance(entree.get("avant"), dict)


def _empreinte(contenu: Any) -> str:
    return json.dumps(contenu, sort_keys=True, ensure_ascii=False)


class _JournalIllisible(Exception):
    """Un journal qui est là mais qu'on ne sait pas lire : la migration s'arrête."""


@dataclass(slots=True)
class _Migration:
    """Une image à faire entrer dans la bibliothèque, et ce qu'il en coûte."""

    asset: Asset
    sujet: str | None
    nom_du_sujet: str | None
    cible: dict[str, Any]
    collections: list[str] = field(default_factory=list)


class ProjetInconnu(ErreurAtelier):
    code = "projet_inconnu"

    def __init__(self, identifiant: str, connus: Iterable[str] = ()) -> None:
        liste = ", ".join(connus)
        suite = f" — projets existants : {liste}" if liste else ""
        super().__init__(f"aucun projet « {identifiant} »{suite}")


class CollectionInconnue(ErreurAtelier):
    code = "collection_inconnue"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"aucune collection « {identifiant} »")


class RangementRefuse(ErreurAtelier):
    """Un geste de rangement impossible, et on dit lequel."""

    code = "rangement_refuse"


class AnnulationExpiree(ErreurAtelier):
    """L'instant est passé : la suppression est devenue définitive."""

    code = "annulation_expiree"

    def __init__(self) -> None:
        super().__init__("l'annulation a expiré — la suppression est définitive")


class ServiceBibliotheque:
    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        assets: ServiceAssets,
        diffusion: Diffusion | None = None,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._assets = assets
        self._diffusion = diffusion or Diffusion()
        self._courant: str | None = None
        # RG8 : les jeux dont la migration des matières a été passée **dans ce
        # processus**. Elle se rejoue sans danger, mais la rejouer à chaque lecture
        # de la bibliothèque relirait toutes les images du jeu pour rien.
        self._matieres_verifiees: set[str] = set()
        # RG8 : le rapport de la **dernière** passe de chaque jeu, en mémoire — il se
        # recalcule à la passe suivante, et ce qu'il dit des sujets vides se relit
        # du journal (`etat_de_la_migration`).
        self._derniers_rapports: dict[str, dict[str, Any]] = {}
        # RG8 : qui change la nature d'un sujet — `(jeu, sujet, nature)`. Branché
        # par l'`Atelier` sur `ServiceProduction.regler_personnage`, seul écrivain
        # de sujet du dépôt : cette classe est montée avant lui et ne peut pas le
        # recevoir à la construction. Non branché, la sixième règle de la migration
        # ne s'applique pas et le rapport le dit.
        self.changer_nature: Callable[[str, str, str], Any] | None = None

    # ── L'ouverture ──────────────────────────────────────────────────────────

    def ouvrir(self) -> dict[str, Any]:
        """Reconstruit si l'index manque, garantit un projet, balaie ce qui a expiré.

        Trois gestes qui ne lèvent jamais : l'atelier s'ouvre même sur un
        `donnees/` vide, même sur un index effacé, et même sans réseau.
        """
        reconstruit: dict[str, Any] = {}
        if self._base.refaite or self._base.vide:
            reconstruit = self.reconstruire()

        adoptes = 0
        if not self._base.projets():
            # « Un projet Bac à sable existe déjà au premier lancement » (US-2).
            # Créé seulement quand il n'y a **aucun** projet : le recréer parce
            # qu'il porte ce nom-là le ferait reparaître après qu'on l'a rangé
            # au profit d'un vrai projet.
            adoptes = self._adopter(self._creer(NOM_BAC_A_SABLE))

        self._courant = self._projet_valide(self._fichiers.lire_etat().get("courant"))
        self._noter_courant()
        # **Le jeu qui s'ouvre reçoit sa bibliothèque de matières** (RG8) : la
        # migration ne lève jamais et n'écrit rien quand il n'y a rien à migrer.
        if self._courant is not None:
            self.assurer_matieres(self._courant, annoncer=False)
        purges = self.purger()
        return {"reconstruit": reconstruit, "purges": purges, "adoptes": adoptes}

    def _adopter(self, projet: Projet) -> int:
        """Ce qui existait **avant qu'un projet existe** entre dans le premier.

        Trouvé en ouvrant l'atelier pour de vrai, le 27 août : les six images de
        T1 et T2 portent `projet: null` — non pas parce qu'on les a détachées,
        mais parce qu'à leur naissance il n'y avait rien à quoi les attacher.
        Sans ce geste, elles se retrouvaient sous « Sans projet » et la grille
        s'ouvrait vide sur un atelier qui a déjà six images. « Sans projet »
        doit vouloir dire *détaché*, un état que l'auteur a provoqué, jamais
        *antérieur au rangement*.

        Le geste ne se produit qu'à l'apparition du **tout premier** projet :
        un atelier neuf n'a rien à adopter, et un atelier où l'auteur a
        supprimé un projet en a d'autres, donc ne passe pas par ici.
        """
        adoptes = 0
        for asset in self._base.assets(sans_projet=True, limite=100_000):
            asset.projet = projet.identifiant
            self._assets.sauver(asset)
            adoptes += 1
        self._base.attacher_generations(projet.identifiant)
        return adoptes

    def reconstruire(self) -> dict[str, Any]:
        """La bibliothèque, relue depuis `donnees/` (US-40).

        L'index n'est qu'un cache de ce que les fichiers disent déjà. On le vide
        et on parcourt l'arbre : projets, collections, générations, et pour
        chaque génération les assets écrits à côté de ses images.

        **Un asset dont l'image brute n'est plus sur le disque ne revient pas.**
        C'est la même règle qui rend une suppression définitive vraiment
        définitive : effacer les fichiers suffit à effacer l'asset, sans qu'une
        pierre tombale ait à être gardée quelque part.
        """
        # Les fichiers ont peut-être changé à la main : la migration des matières
        # se repasse au prochain regard sur chaque jeu (RG8).
        self._matieres_verifiees.clear()
        self._base.vider()

        projets = [Projet.depuis_json(p) for p in self._fichiers.lire_projets()]
        collections = [
            Collection.depuis_json(c)
            for c in self._fichiers.lire_collections().values()
            if isinstance(c, dict) and c.get("identifiant")
        ]

        # **Le sujet entre dans l'index comme le reste** (B8.3) : un raccourci
        # jetable, reconstruit d'ici comme `assets` ou `collections`. La vérité
        # reste `donnees/projets/<jeu>/personnages/` — un fichier disparu ne
        # revient pas plus qu'un asset dont l'image brute a été effacée.
        personnages = [
            Personnage.depuis_json(contenu)
            for projet in projets
            for contenu in self._fichiers.parcourir_personnages(projet.identifiant)
        ]

        generations: list[Generation] = []
        assets: list[Asset] = []
        for contenu in self._fichiers.parcourir_generations():
            generation = Generation.depuis_json(contenu)
            generations.append(generation)
            for fiche in self._fichiers.parcourir_assets(generation.identifiant):
                asset = Asset.depuis_json(fiche)
                if not self._fichiers.existe(asset.brut):
                    continue
                # **Un asset écrit avant T3 ne porte pas son coût** — le champ
                # n'existait pas. Sa génération, elle, l'a toujours porté : on
                # le lui reprend plutôt que d'afficher `$0,0000` sur une image
                # qui a bel et bien été payée. Trouvé en relisant les six
                # images de T1 et T2, pas au banc.
                if not asset.consomme:
                    emplacement = generation.emplacement(asset.rang)
                    if emplacement is not None:
                        asset.consomme = emplacement.consomme
                        asset.unite = emplacement.unite
                # **Ni son modèle** — le champ n'existait pas avant C1, et la
                # génération le porte depuis T1 (US-123). Même réparation, même
                # endroit, même raison : la fiche d'une image payée doit
                # nommer qui l'a dessinée, et ce nom est sur le disque à côté.
                if not asset.modele:
                    asset.modele = generation.modele
                assets.append(asset)

        # **Les bandes se relisent comme le reste** (A10). Une bande dont le clip
        # n'est plus là ne revient pas : elle ne se recalcule qu'à partir des
        # images de son clip, donc la garder sans lui laisserait une fiche qui ne
        # peut plus rien rendre. Même règle qu'un asset sans image brute,
        # appliquée à ce qui est fait de plusieurs images.
        connus = {generation.identifiant for generation in generations}
        bandes = [
            Bande.depuis_json(fiche)
            for clip, fiche in self._fichiers.parcourir_bandes()
            if clip in connus
        ]

        # **Ce que le coup de main a coûté se relit aussi** (CM1) : l'argent
        # parti ne disparaît pas du total parce qu'on a effacé l'index.
        appels_texte = [
            AppelTexte.depuis_json(contenu)
            for contenu in self._fichiers.parcourir_appels_texte()
        ]

        self._base.remplir(
            generations=generations,
            assets=assets,
            projets=projets,
            collections=collections,
            bandes=bandes,
            personnages=personnages,
            appels_texte=appels_texte,
        )
        return {
            "projets": len(projets),
            "collections": len(collections),
            "generations": len(generations),
            "assets": len(assets),
            "bandes": len(bandes),
            "personnages": len(personnages),
            "appels_texte": len(appels_texte),
        }

    # ── Les projets ──────────────────────────────────────────────────────────

    def projets(self) -> list[Projet]:
        """Les jeux, dans l'ordre du dépôt — **pas celui de l'écran**.

        `arbre()` les trie par dernier travaillé (B4) pour le carnet et
        l'ouverture ; ici, l'ordre reste celui de `_base.projets()`, dont
        d'autres lecteurs (la reconstruction, notamment) attendent la
        création — pas la recence d'un geste sur le projet.
        """
        return self._base.projets()

    @property
    def courant(self) -> str | None:
        """Le projet ouvert dans l'atelier. Ce qui sort y entre (US-2), et c'est
        lui que l'agent recevra par défaut en T7 (US-87)."""
        return self._courant

    def choisir(self, identifiant: str | None) -> str | None:
        """Ouvrir un projet. `None` ouvre « sans projet » — la vue de ce qui a
        été détaché, où l'on peut travailler mais où rien ne se range.

        **Compte comme un travail** (B4) : c'est ce que trie la liste des
        jeux, en carnet comme à l'ouverture. `None` ne touche personne — la
        vue « sans projet » n'est pas un jeu qu'on pourrait dater.
        """
        projet = None
        if identifiant is not None:
            projet = self._base.lire_projet(identifiant)
            if projet is None:
                raise ProjetInconnu(
                    identifiant, [p.identifiant for p in self.projets()]
                )
        self._courant = identifiant
        if projet is not None:
            projet.dernier_travail_le = time.time()
            self.sauver_projet(projet)
            # **Ouvrir un jeu lui apporte sa bibliothèque de matières** (RG8) —
            # avant l'annonce ci-dessous, qui dira tout d'un coup.
            self.assurer_matieres(projet.identifiant, annoncer=False)
        self._noter_courant()
        self._annoncer()
        return self._courant

    def creer_projet(self, nom: str) -> Projet:
        """Un vrai projet, quand on en ressent le besoin et pas avant (US-5).

        Il s'ouvre aussitôt : créer un projet pour ensuite avoir à l'ouvrir
        serait un geste de trop, et personne ne crée un projet pour ne pas y
        travailler.
        """
        projet = self._creer(nom)
        self._courant = projet.identifiant
        self._noter_courant()
        self._annoncer()
        return projet

    def renommer_projet(self, identifiant: str, nom: str) -> Projet:
        """Le nom change, **l'identifiant jamais** (E8, étape 1).

        « Un dossier qui se renomme sous les fichiers qu'il contient est un
        déménagement, pas un renommage » : l'identifiant se dérive du nom à la
        création et ne bouge plus. C'est ce qui permet à l'assistant de
        *renommer* le « Bac à sable » plutôt que d'en créer un second — le
        premier lancement s'ouvre sur un jeu qui existe déjà, et rien n'est
        exigé pour commencer.
        """
        propre = " ".join(nom.split())
        if not propre:
            raise RangementRefuse("un jeu a besoin d'un nom")
        objet = next((p for p in self.projets() if p.identifiant == identifiant), None)
        if objet is None:
            raise ProjetInconnu(identifiant, [p.identifiant for p in self.projets()])
        objet.nom = propre
        self.sauver_projet(objet)
        self._annoncer()
        return objet

    def jeux_du_meme_nom(self, nom: str, sauf: str = "") -> list[str]:
        """Les jeux qui portent déjà ce nom-là — **les autres, pas celui-ci** (B14).

        `sauf` est l'identifiant du jeu qu'on vient de créer ou de renommer : il
        porte le nom qu'on interroge, et se compter lui-même ferait avertir tout
        le monde tout le temps.

        Rend des **noms**, pas des identifiants : c'est ce que l'écran affiche, et
        c'est ce dont l'avertissement parle. L'identifiant, lui, est justement
        celui qui *ne* se confond pas — il porte déjà son `-2`.
        """
        return [
            p.nom
            for p in self.projets()
            if p.identifiant != sauf and deja_porte(nom, [p.nom])
        ]

    def avertissement_de_nom(self, nom: str, sauf: str = "") -> str:
        """Ce qu'il y a à dire quand un nom est déjà pris, ou rien.

        **Une phrase écrite ici, pas deux composées à l'écran.** Le parcours de
        création et celui des règles du jeu montrent le même avertissement ; le
        composer de chaque côté aurait donné deux textes pour un seul fait.

        **Elle cite le nom de l'autre jeu, pas celui qu'on vient de taper.**
        Trouvé par l'essai, et ce n'est pas un détail de rédaction : « le
        marais » et « Le  Marais » ne sont *pas* la même chaîne — c'est bien
        pour ça qu'ils entrent en collision. Redire au lecteur ce qu'il vient
        d'écrire ne lui apprend rien ; lui montrer l'orthographe exacte de
        l'autre ligne lui dit laquelle il va voir en double.

        Vide quand le nom est libre — et l'écran ne dessine alors aucun bandeau,
        au lieu d'un bandeau vide.
        """
        autres = self.jeux_du_meme_nom(nom, sauf)
        if not autres:
            return ""
        if len(autres) == 1:
            return (
                f"Un autre jeu s'appelle déjà « {autres[0]} ». Les deux "
                "resteront, avec des dossiers différents — mais la liste "
                "montrera deux lignes identiques."
            )
        return (
            f"{len(autres)} autres jeux s'appellent déjà « {autres[0]} ». Ils "
            "resteront tous, avec des dossiers différents — mais la liste "
            "montrera autant de lignes identiques."
        )

    def supprimer_projet(self, identifiant: str) -> dict[str, Any]:
        """Détache, ne détruit pas (US-30).

        Ses assets se retrouvent sans projet — visibles, retouchables,
        rangeables ailleurs — et ses appels passent au journal sans projet, avec
        leur coût. Le compte des uns et des autres est rendu ici : c'est lui que
        l'écran annonce **avant** de demander confirmation.
        """
        projet = self._base.lire_projet(identifiant)
        if projet is None:
            raise ProjetInconnu(identifiant, [p.identifiant for p in self.projets()])
        if len(self.projets()) <= 1:
            raise RangementRefuse(
                "c'est le seul projet — tout ce qui sort doit avoir où aller"
            )

        detaches = []
        for asset in self._base.assets(projet=identifiant, limite=100_000):
            asset.projet = None
            self._assets.sauver(asset)
            detaches.append(asset.identifiant)

        for collection in self._base.collections():
            if collection.projet == identifiant:
                collection.projet = None
                self._base.enregistrer_collection(collection)
        self._ecrire_collections()

        appels = self._base.detacher_generations(identifiant)
        self._base.oublier_projet(identifiant)
        self._fichiers.effacer_projet(identifiant)

        if self._courant == identifiant:
            restants = self.projets()
            self._courant = restants[0].identifiant if restants else None
            self._noter_courant()

        self._annoncer()
        return {"projet": identifiant, "assets": len(detaches), "appels": appels}

    def compter_projet(self, identifiant: str) -> int:
        """Combien d'assets ce projet contient — la question qu'on pose avant
        de proposer de le supprimer."""
        return self._base.compter_par_projet().get(identifiant, 0)

    def sauver_projet(self, projet: Projet) -> Projet:
        """**Le seul endroit du dépôt qui écrive un projet.**

        `ServiceUnivers` pose la bible, le barème, la palette et les défauts ; il
        passe par ici, exactement comme ce service passe par `ServiceAssets`
        pour écrire un asset. Deux écrivains, ce serait un jour un réglage
        inscrit dans la base et pas dans le fichier — donc perdu à la première
        reconstruction, qui relit `donnees/` et rien d'autre.

        **Le fichier d'abord, l'index ensuite**, comme partout : une coupure
        entre les deux lignes laisse l'index en retard sur le disque, ce que la
        reconstruction rattrape ; dans l'autre ordre, elle mettrait l'invariant
        à l'envers.
        """
        self._fichiers.ecrire_projet(projet.identifiant, projet.en_json())
        self._base.enregistrer_projet(projet)
        return projet

    def _creer(self, nom: str) -> Projet:
        # **Les espaces se replient ici comme au renommage** (B14). Les deux
        # gestes nomment la même chose et les deux ne le faisaient pas pareil :
        # `renommer_projet` repliait depuis toujours, `_creer` se contentait de
        # `strip()`. Un jeu créé « Le  Marais » gardait donc son espace double,
        # et se renommer de son propre nom le lui retirait — deux vérités sur ce
        # qu'est un nom, trouvées en écrivant l'avertissement d'homonyme.
        propre = " ".join(nom.split())
        if not propre:
            raise RangementRefuse("un projet a besoin d'un nom")
        pris = {p.identifiant for p in self._base.projets()}
        return self.sauver_projet(Projet(identifiant=repere(propre, pris), nom=propre))

    def _projet_valide(self, identifiant: Any) -> str | None:
        if isinstance(identifiant, str) and self._base.lire_projet(identifiant):
            return identifiant
        projets = self.projets()
        return projets[0].identifiant if projets else None

    def _noter_courant(self) -> None:
        self._fichiers.ecrire_etat({"courant": self._courant})

    # ── Les collections ──────────────────────────────────────────────────────

    def collections(self) -> list[Collection]:
        return self._base.collections()

    def creer_collection(self, nom: str, projet: str | None = None) -> Collection:
        propre = nom.strip()
        if not propre:
            raise RangementRefuse("une collection a besoin d'un nom")
        if projet is not None and self._base.lire_projet(projet) is None:
            raise ProjetInconnu(projet, [p.identifiant for p in self.projets()])
        pris = {c.identifiant for c in self._base.collections()}
        collection = Collection(
            identifiant=repere(propre, pris), nom=propre, projet=projet
        )
        self._sauver_collection(collection)
        return collection

    def _sauver_collection(self, collection: Collection) -> Collection:
        """**Le seul endroit qui écrit une collection**, index et fichier
        ensemble (B8.1).

        L'index et `collections.json` ne se laissent pas écrire séparément :
        la fiche du disque est reconstruite **depuis l'index** juste après y
        avoir posé la collection, si bien qu'un appelant qui oublierait la
        seconde moitié laisserait une adhésion vivante en mémoire et absente du
        disque — invisible jusqu'au prochain redémarrage. Les gestes de B8.4
        passent tous par ici, pour la même raison qu'un sujet n'a qu'un seul
        endroit qui l'écrit (`ServiceProduction._sauver`).
        """
        self._base.enregistrer_collection(collection)
        self._ecrire_collections()
        self._annoncer()
        return collection

    def supprimer_collection(self, identifiant: str) -> dict[str, Any]:
        """La collection part. **Aucun sujet n'est touché** (B8.4) : l'adhésion
        s'écrit sur la collection (B8.1), donc la supprimer n'a rien à défaire
        ailleurs — ni fichier de sujet à réécrire, ni image à toucher. La table
        de jointure se vide d'elle-même, par `ON DELETE CASCADE` (B8.2)."""
        collection = self._base.lire_collection(identifiant)
        if collection is None:
            raise CollectionInconnue(identifiant)
        self._base.oublier_collection(identifiant)
        self._ecrire_collections()
        self._annoncer()
        return {"collection": identifiant, "sujets": len(collection.membres)}

    def ranger_sujet(
        self, identifiant: str, jeu: str, sujet: str, genre: str = SUJET
    ) -> Collection:
        """Un sujet — ou une matière (RG5) — de plus dans le groupe (B8.4).

        **Deux fois ne fait pas deux membres** (`Collection.avec`), donc un
        glisser-déposer répété sur la même case ne casse rien. Et ranger ne
        juge jamais : un sujet d'un autre jeu que celui de la collection y
        entre quand même — tranché par l'auteur en `B8.1`, contre la
        recommandation inverse.

        **`genre` étend le geste, sans en ouvrir un second** (RG5) : une
        matière se range par le même chemin qu'un sujet, `sujet` portant
        alors l'identifiant de l'image.
        """
        collection = self._base.lire_collection(identifiant)
        if collection is None:
            raise CollectionInconnue(identifiant)
        return self._sauver_collection(collection.avec(jeu, sujet, genre))

    def retirer_sujet(
        self, identifiant: str, jeu: str, sujet: str, genre: str = SUJET
    ) -> Collection:
        """Le sujet — ou la matière — quitte le groupe (B8.4). **Il ne bouge
        pas lui-même** — ni son fichier, ni son jeu, ni ses images : seule
        l'adhésion change (`Collection.sans`)."""
        collection = self._base.lire_collection(identifiant)
        if collection is None:
            raise CollectionInconnue(identifiant)
        return self._sauver_collection(collection.sans(jeu, sujet, genre))

    def _ecrire_collections(self) -> None:
        self._fichiers.ecrire_collections(
            {c.identifiant: c.en_json() for c in self._base.collections()}
        )

    # ── Retrouver ────────────────────────────────────────────────────────────

    def chercher(
        self,
        *,
        projet: str | None = None,
        sans_projet: bool = False,
        collection: str | None = None,
        favoris: bool = False,
        recherche: str = "",
        limite: int = PAR_DEFAUT,
        role: str = ROLE_PAR_DEFAUT,
        jugement: str = JUGEMENT_PAR_DEFAUT,
        tri: str = TRI_PAR_DEFAUT,
    ) -> list[Asset]:
        """La grille. **La seule** — celle du prompt et celle qui range.

        Le tri et les deux filtres de RP11 passent par ici sans être relus : les
        valeurs sont refermées à la porte (`tri_valide`, `role_valide`,
        `jugement_valide`), une fois, là où elles entrent.
        """
        return self._base.assets(
            projet=projet,
            sans_projet=sans_projet,
            collection=collection,
            favoris=favoris,
            recherche=recherche,
            limite=limite,
            role=role,
            jugement=jugement,
            tri=tri,
        )

    def compter(
        self,
        *,
        projet: str | None = None,
        sans_projet: bool = False,
        collection: str | None = None,
        favoris: bool = False,
        recherche: str = "",
        role: str = ROLE_PAR_DEFAUT,
        jugement: str = JUGEMENT_PAR_DEFAUT,
    ) -> int:
        """Ce que `chercher` rendrait sans sa limite (B3) — voir `compter_assets`."""
        return self._base.compter_assets(
            projet=projet,
            sans_projet=sans_projet,
            collection=collection,
            favoris=favoris,
            recherche=recherche,
            role=role,
            jugement=jugement,
        )

    def grille(
        self,
        *,
        projet: str | None = None,
        sans_projet: bool = False,
        collection: str | None = None,
        favoris: bool = False,
        recherche: str = "",
        limite: int = PAR_DEFAUT,
        role: str = ROLE_PAR_DEFAUT,
        jugement: str = JUGEMENT_PAR_DEFAUT,
        tri: str = TRI_PAR_DEFAUT,
        groupe: bool = False,
    ) -> dict[str, Any]:
        """La grille entière : ce qu'elle montre, ce qu'elle cache, ses groupes.

        **Un seul endroit compose la réponse de la grille** (RP11) — la route et
        l'outil MCP l'appellent tous les deux, et « ce que l'agent peut faire,
        l'écran le peut aussi » reste vrai dans les deux sens.

        `groupes` n'est là que si on l'a demandé : sans regroupement, une liste
        d'une entrée par image ne dirait rien et pèserait une ligne par tuile.

        **Rend les assets tels quels, pas leur JSON** : la route les met en
        forme pour un navigateur, le MCP pour un agent, et les deux mises en
        forme ne sont pas la même — celle du MCP ajoute le chemin du fichier.
        """
        filtre = dict(
            projet=projet,
            sans_projet=sans_projet,
            collection=collection,
            favoris=favoris,
            recherche=recherche,
            role=role_valide(role),
            jugement=jugement_valide(jugement),
        )
        assets = self.chercher(limite=limite, tri=tri_valide(tri), **filtre)
        # **Le total, pas seulement les 200 montrées** (B3) : même filtre, sans
        # le plafond — et le plafond compte des images, jamais des groupes, pour
        # que ce nombre-ci reste le seul du produit.
        reponse: dict[str, Any] = {"total": self.compter(**filtre)}
        if groupe:
            groupes = regrouper_par_origine(assets)
            assets = ordonner_par_groupe(assets, groupes)
            reponse["groupes"] = groupes
        reponse["assets"] = assets
        return reponse

    def grille_courante(self, limite: int = PAR_DEFAUT) -> list[Asset]:
        """Ce que la grille montre sans qu'on ait rien filtré : le projet ouvert.

        Servi tel quel dans le premier message du flux, pour qu'un onglet qui
        s'ouvre dessine sa grille sans un second appel.
        """
        return self.chercher(
            projet=self._courant, sans_projet=self._courant is None, limite=limite
        )

    def filiation(self, identifiant: str) -> dict[str, Any]:
        """D'où vient cet asset, et ce qui en descend (US-38).

        Le parent peut être supprimé : on le dit alors, et on garde son
        identifiant. Une filiation incomplète reste une filiation — l'effacer
        parce qu'un maillon manque perdrait aussi les maillons qui restent.
        """
        asset = self._trouver(identifiant)
        parent = self._base.lire_asset(asset.parent) if asset.parent else None
        vivant = parent is not None and not parent.supprime
        return {
            "parent": parent.en_json() if vivant and parent else None,
            "parent_identifiant": asset.parent,
            "parent_supprime": bool(asset.parent) and not vivant,
            "enfants": [e.en_json() for e in self._base.enfants(identifiant)],
        }

    # ── Ranger et juger ──────────────────────────────────────────────────────

    def ranger(
        self,
        identifiants: Iterable[str],
        *,
        projet: str | None = None,
    ) -> list[Asset]:
        """Poser une sélection dans un projet, ou nulle part.

        **Ranger dans une collection n'est plus un geste sur l'image** (B8.4) :
        une collection range des sujets, et c'est `ranger_sujet` /
        `retirer_sujet` qui portent ce geste-là. Une image ne décide donc plus
        de son projet par la collection où on la pose — il n'y a plus de
        collection à poser sur elle.
        """
        if projet is not None and self._base.lire_projet(projet) is None:
            raise ProjetInconnu(projet, [p.identifiant for p in self.projets()])

        ranges = []
        for identifiant in identifiants:
            asset = self._trouver(identifiant)
            asset.projet = projet
            self._assets.sauver(asset)
            ranges.append(asset)
        self._annoncer()
        return ranges

    def marquer_favori(self, identifiants: Iterable[str], favori: bool) -> list[Asset]:
        """La seule marque que l'auteur pose lui-même — d'où sa forme, un coin
        plein, quand tout ce que le système constate est un mot
        (`docs/design-motifs.md` § La tuile).

        **Et elle s'annonce, comme le rangement et la suppression.** Le favori
        n'est pas une décoration : c'est lui qui décide, par `corps_retenu`, de
        l'image qui part en planche d'équipement et de celle qui sort dans le
        jeu. Il était pourtant le seul geste de la bibliothèque à ne prévenir
        personne — la galerie s'en tirait en se rechargeant elle-même, et la
        fiche du personnage, qui n'a pas ce second chemin, gardait à l'écran un
        choix que le serveur avait déjà changé. Relevé le 4 septembre 2026.
        """
        marques = []
        for identifiant in identifiants:
            asset = self._trouver(identifiant)
            asset.favori = favori
            self._assets.sauver(asset)
            marques.append(asset)
        self._annoncer()
        return marques

    # ── La bibliothèque des matières (RG5) ───────────────────────────────────

    def matieres(self, projet: str, limite: int = PAR_DEFAUT) -> list[Asset]:
        """Les images marquées matière de ce projet — l'ingrédient, jamais le
        sujet (`docs/RG5-la-bibliotheque-des-matieres.md`).

        **Une lecture, pas un second index** : le même `Base.assets()` que la
        grille et le MCP de T7, filtré sur la colonne posée à côté de `favori`
        (`assets_matieres`). Aucun sujet n'est consulté — une matière n'en a
        pas."""
        if self._base.lire_projet(projet) is None:
            raise ProjetInconnu(projet, [p.identifiant for p in self.projets()])
        # **Jamais lue avant d'être complète** (RG8) : un jeu qu'aucun écran n'a
        # ouvert — l'agent qui liste ses matières d'abord — passe par la même
        # migration que celui qu'on ouvre. Une fois par jeu et par processus.
        self.assurer_matieres(projet)
        return self._base.assets(projet=projet, matiere=True, limite=limite)

    def fiches_de_matieres(self, assets: Iterable[Asset]) -> list[dict[str, Any]]:
        """**La fiche d'une matière, écrite une seule fois** (RG5) : l'écran
        (`GET /api/projects/{jeu}/materials`) et l'agent (`list_materials`) la
        lisent ici, chacun y ajoutant ce qui n'est qu'à lui (l'aperçu pour l'un,
        le chemin du fichier pour l'autre) et rebaptisant les clés à sa langue.
        Deux copies « à aligner à la main » ont déjà divergé une fois — les
        dimensions du brut d'un côté, celles du rendu de l'autre.

        - **`largeur` / `hauteur` : celles du fichier qui part**, le rendu quand il y
          en a un, le brut sinon — la règle de `list_assets`. Zéro n'est pas une
          mesure, c'est l'absence de mesure ;
        - `cadrage` se relit sur la génération qui a fait naître l'image, jamais
          sur l'image : c'est elle qui porte `filiation["matiere"]["cadrage"]`
          (`ServiceGenerations.soumettre_matiere`). Une image devenue matière par
          déclaration n'a pas cette filiation, et rend une chaîne vide plutôt
          qu'une valeur inventée ;
        - `collections` : `[{identifiant, nom}]`, celles où l'auteur l'a rangée ;
        - `detouree` et `refaisable` : le calcul de `ServiceAssets.etat_de_matiere`.

        Les collections se lisent d'un coup par jeu, pas image par image."""
        assets = list(assets)
        par_jeu: dict[str, list[str]] = {}
        for asset in assets:
            if asset.projet is not None:
                par_jeu.setdefault(asset.projet, []).append(asset.identifiant)
        collections: dict[tuple[str, str], list[dict[str, str]]] = {}
        for jeu, identifiants in par_jeu.items():
            for identifiant, rangees in self._base.collections_par_sujet(
                jeu, identifiants, genre="matiere"
            ).items():
                collections[(jeu, identifiant)] = rangees

        fiches: list[dict[str, Any]] = []
        for asset in assets:
            cadrage = ""
            generation = self._base.lire(asset.generation) if asset.generation else None
            if generation is not None:
                filiation = generation.demande.get("filiation") or {}
                cadrage = (filiation.get("matiere") or {}).get("cadrage", "")
            etat = self._assets.etat_de_matiere(asset)
            fiches.append(
                {
                    "identifiant": asset.identifiant,
                    "nom": asset.label,
                    "largeur": asset.rendu_largeur or asset.largeur,
                    "hauteur": asset.rendu_hauteur or asset.hauteur,
                    "cadrage": cadrage,
                    "cree_le": asset.cree_le,
                    "collections": list(collections.get((asset.projet or "", asset.identifiant), [])),
                    "detouree": etat["detouree"],
                    "refaisable": etat["refaisable"],
                }
            )
        return fiches

    def declarer_matiere(
        self, identifiant: str, valeur: bool, projet: str | None = None
    ) -> Asset:
        """Poser — ou retirer — la marque « matière » sur une image existante.

        **Le « en un geste » de RG6** : nulle création de sujet, nul champ de
        plus qu'un booléen sur l'image déjà là. La marque décide de ce qui
        entre dans la bibliothèque, jamais de ce qu'un jeu de tuiles accepte —
        `_asset_valide` (`atelier/services/tuiles.py`) reste ouvert à toute
        image du projet, marquée ou non.

        **Deux refus, tous deux en 409 (`RangementRefuse`), et un seul sens.**

        - *Une image qui porte un sujet ne devient pas matière* : la marque
          dit « ingrédient, sans sujet » (RG5 §4), et l'image dirait le
          contraire. Elle ne le devine pas et ne détache pas l'image à la
          place de l'auteur : la phrase dit quoi faire. **Retirer la marque ne
          refuse jamais pour cette raison** — c'est la sortie, et une image
          qui porterait les deux (née avant RG5) doit pouvoir la prendre.
        - *Une image qui n'est pas de ce projet* : `projet` est celui de
          l'adresse. Sans ce contrôle, `PUT /projects/a/materials/{image de b}`
          marquerait une image de `b` et la ferait paraître dans une
          bibliothèque qui n'est pas celle qu'on croyait toucher. Une image
          hors projet (`projet` nul) n'a pas de bibliothèque où entrer : la
          marque serait posée sans que rien ne la liste — refusée aussi, mais
          pas à la retirer, pour qu'une marque orpheline se nettoie."""
        if projet is not None and self._base.lire_projet(projet) is None:
            raise ProjetInconnu(projet, [p.identifiant for p in self.projets()])
        asset = self._trouver(identifiant)
        if projet is not None and asset.projet is not None and asset.projet != projet:
            raise RangementRefuse(
                "Cette image est rangée dans un autre jeu : ouvre ce jeu pour "
                "la déclarer matière."
            )
        if projet is not None and asset.projet is None and valeur:
            raise RangementRefuse(
                "Cette image n'est dans aucun jeu : range-la d'abord dans "
                "celui-ci, puis déclare-la matière."
            )
        if valeur and asset.personnage:
            raise RangementRefuse(REFUS_MATIERE_D_UN_SUJET)
        asset.matiere = valeur
        self._assets.sauver(asset)
        self._annoncer()
        return asset

    def matiere_du_jeu(self, identifiant: str, projet: str) -> Asset:
        """Une matière de **ce** jeu, ou un refus qui dit pourquoi (RG8).

        La fiche d'une image lit ici si celle-ci a été détourée à tort : même
        contrôle que la déclaration — l'image doit être rangée dans le jeu de
        l'adresse —, et elle doit être une matière, sans quoi la question n'a pas
        de sens et on ne répond pas « non » à sa place."""
        if self._base.lire_projet(projet) is None:
            raise ProjetInconnu(projet, [p.identifiant for p in self.projets()])
        asset = self._trouver(identifiant)
        if asset.projet != projet:
            raise RangementRefuse("Cette image n'est pas rangée dans ce jeu.")
        if not asset.matiere:
            raise RangementRefuse("Cette image n'est pas une matière de ce jeu.")
        return asset

    def refaire_matiere(self, identifiant: str, projet: str) -> Asset:
        """Remettre à une matière détourée la recette que le jeu lui donne, **à
        partir de son image brute** (RG8). Gratuit : `ServiceAssets` n'a pas de
        fournisseur, et cette méthode non plus.

        Le geste vit à `ServiceAssets.refaire_une_matiere` — c'est lui qui rend et
        qui écrit ; ici on ne fait que tenir la porte du jeu. Jamais lancé par
        l'ouverture d'un jeu ni par la migration : c'est l'image de l'auteur, il
        clique."""
        self.matiere_du_jeu(identifiant, projet)
        return self._assets.refaire_une_matiere(identifiant)

    # ── La migration des matières (RG8) ──────────────────────────────────────
    #
    # `docs/RG5-la-bibliotheque-des-matieres.md` §5, six règles. Une matière
    # rangée dans un sujet — le contournement de l'auteur, avant que la
    # bibliothèque existe — rejoint la bibliothèque **sans perdre son nom**.
    #
    # **Ce qui s'écrit sur le disque de l'auteur, et comment.** Rien d'autre que des
    # fiches d'images, `collections.json`, la nature d'un sujet et le journal ci-dessous.
    # Aucun fichier n'est effacé, aucune image n'est touchée. Le journal est écrit
    # **avant** la première fiche réécrite, et il garde l'ancienne valeur de chaque
    # champ qu'on change : `personnage`, `pose`, `direction`, `label` — de quoi tout
    # remettre à la main. La migration ne le fait pas elle-même : le défaire
    # demanderait de dire quoi faire à la passe suivante, qui remigrerait.

    def assurer_matieres(
        self, projet: str, *, annoncer: bool = True
    ) -> dict[str, Any] | None:
        """La migration, **une fois par jeu et par processus, et sans jamais lever**.

        C'est le point d'entrée des trois endroits qui regardent un jeu — l'ouverture
        de l'atelier, le choix d'un jeu, la lecture de sa bibliothèque de matières.
        Ouvrir un projet ne doit jamais échouer à cause d'elle : une erreur qu'on
        n'attendait pas devient une phrase dans le rapport, pas une exception.

        Rend le rapport de la passe, ou `None` quand ce jeu a déjà été regardé."""
        if projet in self._matieres_verifiees:
            return None
        try:
            return self.migrer_matieres(projet, annoncer=annoncer)
        except Exception as erreur:  # noqa: BLE001 — jamais bloquer l'ouverture d'un jeu
            self._matieres_verifiees.add(projet)
            rapport = {"projet": projet, "refusee": f"la migration a échoué : {erreur}"}
            self._derniers_rapports[projet] = rapport
            return rapport

    def migrer_matieres(self, projet: str, *, annoncer: bool = True) -> dict[str, Any]:
        """Une passe de la migration (règles ci-dessous), **dont le rapport est gardé**
        : `etat_de_la_migration` le relit. Ouvrir un jeu jette le rapport de
        `assurer_matieres` à l'appelant, et un refus — journal illisible, fiche
        qu'on ne sait pas relire — ne doit pas rester muet pour autant."""
        rapport = self._migrer_matieres(projet, annoncer=annoncer)
        self._derniers_rapports[projet] = rapport
        return rapport

    def etat_de_la_migration(self, projet: str) -> dict[str, Any]:
        """Ce que la migration des matières a laissé au jeu, **pour qui veut le lire**
        (l'écran des matières, l'agent) — trois clés :

        - `sujets_vides` `[{identifiant, nom}]` : les sujets qu'elle a vidés et qui
          sont encore là, encore vides. **Relu à chaque appel** sur le journal et sur
          l'index : un sujet jeté ou de nouveau rempli en sort tout de suite ;
        - `non_migrees` `[{identifiant, raison}]` : les images qu'elle a sautées,
          avec la raison. C'est celle de **la dernière passe**, gardée en mémoire :
          la passe suivante la recalcule, et un jeu qu'aucune passe n'a regardé
          n'a rien à dire ;
        - `migration_refusee` : la phrase d'une passe qui n'a pas pu aller au bout
          (journal illisible ou non écrit, collections non écrites), ou `None`.
          Sans elle un échec de la migration serait muet, ce qui est le contraire
          de « sauter et dire »."""
        if self._base.lire_projet(projet) is None:
            raise ProjetInconnu(projet, [p.identifiant for p in self.projets()])
        rapport = self._derniers_rapports.get(projet) or {}
        try:
            journal = self._lire_journal_matieres(projet)
            vides = self._sujets_vides_de_la_migration(projet, journal)
        except _JournalIllisible:
            vides = []  # la raison est dans `migration_refusee`
        return {
            "sujets_vides": vides,
            "non_migrees": [
                {"identifiant": e["identifiant"], "raison": e["raison"]}
                for e in rapport.get("ignorees", [])
                if isinstance(e, dict) and "identifiant" in e and "raison" in e
            ],
            "migration_refusee": rapport.get("refusee"),
        }

    def _migrer_matieres(self, projet: str, *, annoncer: bool = True) -> dict[str, Any]:
        """Les six règles de RG5 §5, sur un jeu. **Rejouable : la seconde passe ne
        change pas un octet.**

        1. Toute image dont la génération a demandé `echelle="matière"` devient
           matière, quel que soit le sujet où elle est rangée — ou aucun.
        2. Ses champs `personnage`, `pose`, `direction` sont vidés.
        3. Son nom : `label` vide, elle prend celui du sujet qu'elle quitte ; sinon
           elle garde le sien. Aucune matière ne perd son nom, aucune n'en gagne un faux.
        4. Les collections où était rangé le sujet reçoivent l'image comme membre
           `genre="matiere"` ; le sujet y reste.
        5. Le sujet n'est pas supprimé. Il reste, vide — `sujets_vides` le dit.
        6. Un sujet de nature « matière » qui garde des images non migrées repasse
           en « décor ».

        **Ce que l'auteur a décidé l'emporte** : une image qui figure au journal comme
        migrée n'est plus jamais reprise. L'auteur qui lui retire la marque « matière »
        (`declarer_matiere(..., False)`) ne la voit pas revenir à la passe suivante.

        **Une image qu'on ne sait pas relire est sautée et dite**, pas migrée à
        moitié : fiche absente ou abîmée sur le disque, image brute disparue,
        génération introuvable. Le journal illisible arrête tout — on ne réécrit rien
        sans lui, et on ne l'écrase pas.

        Le rapport : `nombre` et `migrees` (cette passe), `deja_migrees` (les passes
        d'avant), `sujets_vides`, `natures_corrigees`, `sans_nom`, `ignorees`,
        `refusee` (une phrase, ou `None`), `journal` (son chemin, ou `None`)."""
        if self._base.lire_projet(projet) is None:
            raise ProjetInconnu(projet, [p.identifiant for p in self.projets()])
        self._matieres_verifiees.add(projet)

        rapport: dict[str, Any] = {
            "projet": projet,
            "nombre": 0,
            "migrees": [],
            "deja_migrees": 0,
            "sujets_vides": [],
            "natures_corrigees": [],
            "natures_non_corrigees": [],
            "sans_nom": [],
            "ignorees": [],
            "refusee": None,
            "journal": None,
        }
        try:
            journal = self._lire_journal_matieres(projet)
        except _JournalIllisible as erreur:
            rapport["refusee"] = str(erreur)
            return rapport
        rapport["deja_migrees"] = sum(
            1 for e in journal["images"].values() if isinstance(e, dict) and e.get("faite")
        )
        ecrit = [_empreinte(journal)]

        def poser() -> bool:
            """Le journal sur le disque, **seulement s'il a changé**. Faux — et une
            phrase au rapport — quand il n'a pas pu être écrit : on ne réécrit alors
            plus rien, le journal passe avant."""
            maintenant = _empreinte(journal)
            if maintenant == ecrit[0]:
                return True
            try:
                self._fichiers.ecrire_journal_matieres(projet, journal)
            except (OSError, ValueError) as erreur:
                rapport["refusee"] = (
                    f"le journal n'a pas pu être écrit ({erreur}) : rien n'a été réécrit "
                    "de ce qui suit."
                )
                return False
            ecrit[0] = maintenant
            return True

        migrations = self._planifier_matieres(projet, journal, rapport)
        faites: list[_Migration] = []
        if migrations:
            for migration in migrations:
                self._noter_dans_journal(journal, migration)
            if not poser():
                return rapport
            faites = self._appliquer_matieres(projet, migrations, rapport)
            for migration in faites:
                journal["images"][migration.asset.identifiant]["faite"] = True

        a_corriger = self._natures_a_corriger(projet)
        for sujet in a_corriger:
            fiche = journal["sujets"].setdefault(sujet.identifiant, {"nom": sujet.nom, "images": []})
            fiche.setdefault("nature", {"avant": sujet.type, "apres": NATURE_DE_REPLI})
        if not poser():
            return rapport

        for sujet in a_corriger:
            self._corriger_la_nature(projet, sujet, rapport)

        for migration in faites:
            nom = migration.cible["label"]
            rapport["migrees"].append(
                {
                    "identifiant": migration.asset.identifiant,
                    "nom": nom,
                    "sujet": migration.sujet,
                    "sujet_nom": migration.nom_du_sujet,
                    "nom_pris_au_sujet": not (migration.asset.label or "").strip() and bool(nom.strip()),
                    "collections": list(migration.collections),
                }
            )
            if not nom.strip():
                rapport["sans_nom"].append(migration.asset.identifiant)
        rapport["nombre"] = len(rapport["migrees"])
        rapport["sujets_vides"] = self._sujets_vides_de_la_migration(projet, journal)
        if self._fichiers.journal_matieres_du_jeu(projet).is_file():
            rapport["journal"] = f"projets/{projet}/{JOURNAL_MATIERES}"

        if annoncer and (faites or rapport["natures_corrigees"]):
            self._annoncer()
        return rapport

    def _lire_journal_matieres(self, projet: str) -> dict[str, Any]:
        """Le journal du jeu — neuf s'il n'existe pas. **Un journal qui existe et qu'on
        ne comprend pas arrête la migration** : le réécrire à neuf perdrait les
        anciennes valeurs qu'il est seul à porter."""
        try:
            chemin = self._fichiers.journal_matieres_du_jeu(projet)
        except ValueError as erreur:
            raise _JournalIllisible(str(erreur)) from erreur
        if not chemin.is_file():
            return _journal_vierge(projet)
        contenu = self._fichiers.lire_journal_matieres(projet)
        if (
            not isinstance(contenu, dict)
            or not isinstance(contenu.setdefault("images", {}), dict)
            or not isinstance(contenu.setdefault("sujets", {}), dict)
        ):
            raise _JournalIllisible(
                f"Le journal de migration des matières de ce jeu ({JOURNAL_MATIERES}) est "
                "là mais illisible : je ne le réécris pas et je ne migre rien tant qu'il "
                "n'est pas réparé ou retiré."
            )
        return contenu

    def _planifier_matieres(
        self, projet: str, journal: dict[str, Any], rapport: dict[str, Any]
    ) -> list[_Migration]:
        """Les images à migrer, **sans rien écrire**."""
        generations: dict[str, Generation | None] = {}
        noms: dict[str, str | None] = {}
        collections = self._base.collections()
        migrations: list[_Migration] = []

        for asset in self._base.assets(projet=projet, limite=100_000):
            entree = journal["images"].get(asset.identifiant)
            if entree is not None:
                if not _entree_valide(entree):
                    rapport["ignorees"].append(
                        {
                            "identifiant": asset.identifiant,
                            "raison": "le journal a une ligne pour cette image que je ne sais pas lire",
                        }
                    )
                    continue
                if entree.get("faite"):
                    continue  # décidé : ce que l'auteur en a fait depuis lui appartient
            try:
                migration = self._planifier_une_matiere(
                    projet, asset, entree, generations, noms, collections, rapport
                )
            except Exception as erreur:  # noqa: BLE001 — une image qu'on ne comprend pas ne bloque pas les autres
                rapport["ignorees"].append(
                    {"identifiant": asset.identifiant, "raison": f"image illisible : {erreur}"}
                )
                continue
            if migration is not None:
                migrations.append(migration)
        return migrations

    def _planifier_une_matiere(
        self,
        projet: str,
        asset: Asset,
        entree: dict[str, Any] | None,
        generations: dict[str, Generation | None],
        noms: dict[str, str | None],
        collections: list[Collection],
        rapport: dict[str, Any],
    ) -> _Migration | None:
        """Ce qu'il faut faire de **cette** image : une migration, ou `None`."""
        if asset.generation not in generations:
            generations[asset.generation] = self._base.lire(asset.generation)
        generation = generations[asset.generation]
        if generation is None:
            rapport["ignorees"].append(
                {
                    "identifiant": asset.identifiant,
                    "raison": "la génération de cette image est introuvable",
                }
            )
            return None
        if not _demande_une_matiere(generation):
            return None

        # **Le sujet quitté se lit sur le journal quand il y en a une ligne** : une
        # passe coupée en route a peut-être déjà vidé l'image, et le journal est
        # alors seul à savoir de quel sujet elle sortait.
        avant = (
            entree["avant"]
            if entree is not None
            else {champ: getattr(asset, champ) for champ in CHAMPS_JOURNALISES}
        )
        sujet = avant.get("personnage") or None
        if sujet and sujet not in noms:
            fiche = self._fichiers.lire_personnage(projet, sujet)
            noms[sujet] = str((fiche or {}).get("nom") or "").strip() or None
        nom_du_sujet = noms.get(sujet) if sujet else None

        label = asset.label or ""
        cible: dict[str, Any] = {
            "matiere": True,
            "personnage": None,
            "pose": None,
            "direction": None,
            # « Personnage supprimé » ne veut plus rien dire sans personnage :
            # la fiche de l'image l'afficherait sur une matière.
            "personnage_supprime": False,
            "label": label if label.strip() else (nom_du_sujet or label),
        }
        conforme = all(getattr(asset, cle) == valeur for cle, valeur in cible.items())
        if conforme and entree is None:
            return None  # née matière depuis RG5, ou déjà migrée : rien à faire
        if not conforme:
            probleme = self._probleme_de_fiche(asset)
            if probleme:
                rapport["ignorees"].append({"identifiant": asset.identifiant, "raison": probleme})
                return None
        ajouts = [
            c.identifiant
            for c in collections
            if sujet
            and c.contient(projet, sujet, SUJET)
            and not c.contient(projet, asset.identifiant, MATIERE)
        ]
        return _Migration(asset, sujet, nom_du_sujet, cible, ajouts)

    def _probleme_de_fiche(self, asset: Asset) -> str | None:
        """Pourquoi on ne réécrira pas cette image, ou `None`. **La fiche du disque
        fait foi** : celle de l'index n'est qu'une copie, et la poser par-dessus une
        fiche qu'on n'a pas su lire la remplacerait sans que personne l'ait vue."""
        fiche = self._fichiers.lire_asset(asset.generation, asset.rang)
        if fiche is None:
            return "la fiche de cette image est absente ou illisible sur le disque"
        if fiche.get("identifiant") != asset.identifiant:
            return "la fiche du disque ne dit pas la même image que l'index"
        if not self._fichiers.existe(asset.brut):
            return "l'image brute n'est plus sur le disque"
        return None

    @staticmethod
    def _noter_dans_journal(journal: dict[str, Any], migration: _Migration) -> None:
        """**Ajoute au journal, n'y remplace rien** : la première ligne d'une image
        garde l'état d'avant la première passe, même si une seconde la reprend."""
        identifiant = migration.asset.identifiant
        entree = journal["images"].get(identifiant)
        if entree is None:
            entree = {
                "le": time.time(),
                "avant": {c: getattr(migration.asset, c) for c in CHAMPS_JOURNALISES},
                "collections": [],
                "faite": False,
            }
            journal["images"][identifiant] = entree
        deja = entree.setdefault("collections", [])
        deja.extend(c for c in migration.collections if c not in deja)
        if migration.sujet:
            fiche = journal["sujets"].setdefault(
                migration.sujet, {"nom": migration.nom_du_sujet, "images": []}
            )
            if not fiche.get("nom") and migration.nom_du_sujet:
                fiche["nom"] = migration.nom_du_sujet
            images = fiche.setdefault("images", [])
            if identifiant not in images:
                images.append(identifiant)

    def _appliquer_matieres(
        self, projet: str, migrations: list[_Migration], rapport: dict[str, Any]
    ) -> list[_Migration]:
        """Réécrit les fiches, puis les collections. Rend les images **menées au bout**
        — celles que le journal peut marquer faites."""
        reussies: list[_Migration] = []
        for migration in migrations:
            try:
                # Relue à l'instant : un geste de l'auteur entre le plan et l'écriture
                # ne doit pas être écrasé par la copie du plan.
                courant = self._base.lire_asset(migration.asset.identifiant) or migration.asset
                if any(getattr(courant, c) != v for c, v in migration.cible.items()):
                    for champ, valeur in migration.cible.items():
                        setattr(courant, champ, valeur)
                    self._assets.sauver(courant, annoncer=False)
                reussies.append(migration)
            except Exception as erreur:  # noqa: BLE001 — une image ne bloque pas les autres
                rapport["ignorees"].append(
                    {
                        "identifiant": migration.asset.identifiant,
                        "raison": f"réécriture impossible : {erreur}",
                    }
                )

        actuelles = {c.identifiant: c for c in self._base.collections()}
        changees: dict[str, Collection] = {}
        for migration in reussies:
            for collection in migration.collections:
                base = changees.get(collection) or actuelles.get(collection)
                if base is not None:
                    changees[collection] = base.avec(projet, migration.asset.identifiant, MATIERE)
        if changees:
            try:
                for collection in changees.values():
                    self._base.enregistrer_collection(collection)
                self._ecrire_collections()
            except Exception as erreur:  # noqa: BLE001
                rapport["refusee"] = (
                    f"les collections n'ont pas pu être mises à jour ({erreur}) : les images "
                    "restent à finir, la prochaine passe les reprendra."
                )
                return []
        return reussies

    def _natures_a_corriger(self, projet: str) -> list[Any]:
        """Les sujets de nature « matière » qui gardent des images (règle 6) — lus
        **après** la réécriture des images, donc sur ce qui reste vraiment."""
        return [
            sujet
            for sujet in self._base.personnages_du_projet(projet, limite=None)
            if _nature_est_matiere(sujet.type)
            and self._base.assets_du_personnage(sujet.identifiant, projet=projet)
        ]

    def _corriger_la_nature(self, projet: str, sujet: Any, rapport: dict[str, Any]) -> None:
        ligne = {"identifiant": sujet.identifiant, "nom": sujet.nom}
        if self.changer_nature is None:
            rapport["natures_non_corrigees"].append(
                {**ligne, "raison": "aucun écrivain de sujet n'est branché sur la bibliothèque"}
            )
            return
        try:
            self.changer_nature(projet, sujet.identifiant, NATURE_DE_REPLI)
        except Exception as erreur:  # noqa: BLE001 — un sujet ne bloque pas les autres
            rapport["natures_non_corrigees"].append({**ligne, "raison": str(erreur)})
            return
        rapport["natures_corrigees"].append(
            {**ligne, "de": NATURE_MATIERE, "vers": NATURE_DE_REPLI}
        )

    def _sujets_vides_de_la_migration(
        self, projet: str, journal: dict[str, Any]
    ) -> list[dict[str, str]]:
        """Les sujets que la migration a vidés et qui sont **encore là, encore
        vides** — la liste que l'écran proposera de jeter. Tirée du journal et non de
        la seule passe en cours : la passe suivante ne migre plus rien, et l'écran
        doit pourtant retrouver ces sujets. Un sujet que l'auteur a rempli de
        nouveau, ou jeté, n'y figure plus."""
        vides: list[dict[str, str]] = []
        for identifiant, fiche in journal["sujets"].items():
            if not isinstance(fiche, dict) or not fiche.get("images"):
                continue
            donnees = self._fichiers.lire_personnage(projet, identifiant)
            if donnees is None:
                continue
            if self._base.assets_du_personnage(identifiant, projet=projet):
                continue
            vides.append(
                {
                    "identifiant": identifiant,
                    "nom": str(donnees.get("nom") or fiche.get("nom") or identifiant),
                }
            )
        return vides

    # ── Jeter ────────────────────────────────────────────────────────────────

    def supprimer(self, identifiants: Iterable[str]) -> dict[str, Any]:
        """L'asset quitte la bibliothèque tout de suite, ses fichiers attendent.

        **Jamais de cascade** : les enfants restent, marqués « parent supprimé »
        (US-28, US-29). Le marquage est écrit sur l'enfant plutôt que déduit à
        l'affichage — il faut de toute façon l'annoncer pour que sa pastille
        paraisse, donc autant que l'annonce porte la vérité.
        """
        self.purger()
        maintenant = time.time()
        supprimes = []
        for identifiant in identifiants:
            asset = self._trouver(identifiant)
            asset.supprime_le = maintenant
            self._assets.sauver(asset)
            self._marquer_enfants(identifiant, True)
            supprimes.append(asset.identifiant)
        self._annoncer()
        return {
            "supprimes": supprimes,
            "annulation_s": ANNULATION_S,
            "expire_le": maintenant + ANNULATION_S,
        }

    def annuler_suppression(self, identifiants: Iterable[str]) -> list[Asset]:
        """Revenir en arrière, tant que l'instant dure (US-27)."""
        rendus = []
        for identifiant in identifiants:
            asset = self._trouver(identifiant, supprimes=True)
            if asset.supprime_le is None:
                continue
            if time.time() - asset.supprime_le > ANNULATION_S:
                raise AnnulationExpiree()
            asset.supprime_le = None
            self._assets.sauver(asset)
            self._marquer_enfants(identifiant, False)
            rendus.append(asset)
        self._annoncer()
        return rendus

    def purger(self, maintenant: float | None = None) -> int:
        """Le balayage. Passe à l'ouverture et à chaque nouvelle suppression.

        Aucune minuterie : rien ne doit tourner dans le vide quand l'atelier est
        au repos. Le délai, lui, est tenu à la seconde par
        `annuler_suppression`, qui refuse au-delà — c'est là que « puis devient
        définitive » se vérifie, pas au moment où l'octet part du disque.
        """
        limite = (maintenant or time.time()) - ANNULATION_S
        partis = self._base.a_purger(limite)
        for asset in partis:
            self._fichiers.effacer_asset(asset.generation, asset.rang)
            self._base.oublier_asset(asset.identifiant)
        return len(partis)

    def _marquer_enfants(self, identifiant: str, supprime: bool) -> None:
        for enfant in self._base.enfants(identifiant):
            if enfant.parent_supprime != supprime:
                enfant.parent_supprime = supprime
                self._assets.sauver(enfant)

    # ── Le journal ───────────────────────────────────────────────────────────

    @staticmethod
    def _libelle(generation: Any) -> str:
        """Ce qu'une ligne d'appel écrit pour dire *de quoi il s'agissait*.

        **Le sujet, pas le texte entier** (R7). Ces lignes-là sont des étiquettes
        dans une liste : une seule ligne, tronquée à la largeur de la colonne.
        Elles portaient le prompt composé — huit cents caractères de bible dont
        les quarante du sujet sont noyés —, et depuis que le texte est rangé,
        elles commenceraient toutes par le même mot, `CONTEXT` ou `REQUEST`.
        Une colonne de libellés identiques ne distingue plus rien.

        Le sujet est enregistré à part depuis T3 pour nommer l'asset ; c'est très
        exactement ce qu'une étiquette veut. **Repli sur le prompt** pour les
        générations d'avant, qui n'en portent pas : elles se relisent comme
        avant, sans qu'un fichier soit réécrit.
        """
        demande = generation.demande
        return str(demande.get("sujet") or demande.get("prompt", ""))

    def journal(self, projet: str | None, limite: int = 100) -> dict[str, Any]:
        """Les appels d'un projet, **ratés compris, avec leur coût réel** (US-24).

        C'est ici que vit ce qui n'entre jamais dans la grille : un appel qui a
        échoué a coûté de l'argent et n'a produit aucune image. Le faire figurer
        dans la bibliothèque salirait ce qu'on peut réutiliser (US-23) ; le
        faire disparaître empêcherait d'expliquer une facture.
        """
        generations = self._base.generations_du_projet(projet, limite)
        # **RV9 : la vignette du journal se joint ici, pas ligne par ligne.**
        # La liste des fabrications lisait ce journal sans jamais savoir ce
        # qu'un appel avait produit — d'où ses vignettes toujours grises pour
        # les images qui ne venaient pas d'un clip. Une seule requête pour le
        # lot entier, même règle que `rangs_vivants` juste au-dessus.
        vignettes = self._base.premiere_image_vivante(
            [g.identifiant for g in generations]
        )
        appels = []
        rates = 0
        cout_rate = 0.0
        for generation in generations:
            manques = [
                {
                    "rang": e.rang,
                    "statut": e.statut.value,
                    "raison": e.raison,
                    "cout_usd": e.cout_usd,
                    # Ce qu'il a consommé, et en quoi (F2) : un raté gratuit
                    # dit « gratuit », jamais « $0,0000 ».
                    "consomme": e.consomme,
                    "unite": e.unite,
                }
                for e in generation.emplacements
                if e.statut in (Statut.ECHOUEE, Statut.INTERROMPUE)
            ]
            rates += len(manques)
            cout_rate += sum(m["cout_usd"] for m in manques)
            appels.append(
                {
                    "identifiant": generation.identifiant,
                    "modele": generation.modele,
                    "prompt": self._libelle(generation),
                    "cree_le": generation.cree_le,
                    "cout_usd": generation.cout_usd,
                    "statut": generation.statut.value,
                    "reussies": generation.reussies,
                    "rates": manques,
                    # **RV9** : l'asset de la première image encore vivante,
                    # ou `None` — un clip vidéo n'en produit pas ici, la case
                    # de l'écran retombe alors sur sa propre vignette.
                    "vignette": vignettes.get(generation.identifiant),
                }
            )
        return {
            "projet": projet,
            "total_usd": self._base.total_par_projet(projet),
            "rates": rates,
            "cout_rate_usd": round(cout_rate, 6),
            "appels": appels,
        }

    # ── Les dépenses ─────────────────────────────────────────────────────────
    #
    # « Il faut pouvoir expliquer une facture. » Le journal ci-dessus tenait
    # cette promesse **pour un cas sur trois** : il ne montrait que les appels
    # ratés, et mesuré sur la base du dépôt, ce sont ceux qui n'ont jamais rien
    # coûté. L'écran des dépenses (E18) les montre tous, avec ce que chacun a
    # coûté et ce qu'il a donné.
    #
    # **Trois issues, et une seule est visible aujourd'hui dans la grille.**
    # Un emplacement a réussi et son image est encore là : *gardé*. Il a été
    # facturé et n'a rien laissé — parce qu'il a échoué après avoir coûté, ou
    # parce que l'image a été supprimée depuis : *payé pour rien*. Il a échoué
    # sans rien coûter : *refusé*. Les deux derniers se confondaient sous le mot
    # « raté », qui mélangeait l'argent perdu et l'argent jamais dépensé.

    #: En deçà, deux appels du même sujet sont **la même intention reprise**, et
    #: non deux séances distinctes. Six relances en trente-deux minutes ont coûté
    #: le quart de tout l'argent de l'atelier sans que rien ne le dise ; le seuil
    #: est posé assez large pour les tenir ensemble, assez court pour ne pas
    #: coudre deux séances d'un même après-midi.
    ECART_RAFALE_S = 15 * 60

    def depenses(self, limite: int = 500) -> dict[str, Any]:
        """Tout ce que l'atelier a dépensé, du plus récent au plus ancien.

        **Une dépense ne s'efface jamais.** Supprimer une image change l'état de
        la ligne de son appel — un gardé devient un payé pour rien — et ne fait
        jamais disparaître la ligne : l'argent, lui, est parti.

        Les appels sans coût y figurent aussi. Le critère de la tranche demande
        que *tous les appels payés* soient listés, ce qui n'interdit pas les
        autres — et les taire ferait disparaître la seule issue que le journal
        d'avant savait montrer, celle qui n'a rien coûté.

        **Et depuis F2, ce qu'ils ont consommé figure à côté de ce qu'ils ont
        coûté.** La question que pose cet écran cesse d'être *où va mon argent*
        pour devenir *où va ce que je consomme* : un appel gratuit qui n'aurait
        montré que `$0,0000` rouvrirait, un cran plus bas, le mensonge par
        omission que cet écran a été construit pour fermer.
        """
        generations = self._base.recentes(limite)
        vivants = self._base.rangs_vivants([g.identifiant for g in generations])
        noms = {p.identifiant: p.nom for p in self.projets()}

        appels: list[dict[str, Any]] = []
        for generation in generations:
            restants = vivants.get(generation.identifiant, set())
            garde = perdu = refuse = 0
            raisons: list[str] = []
            for emplacement in generation.emplacements:
                if emplacement.statut is Statut.REUSSIE:
                    if emplacement.rang in restants:
                        garde += 1
                    else:
                        perdu += 1
                elif emplacement.statut in (Statut.ECHOUEE, Statut.INTERROMPUE):
                    # **Ce qui a été consommé, pas ce qui a été payé** (F2). Un
                    # refus qui a brûlé un jeton n'est pas « refusé sans rien
                    # dépenser » : c'est un consommé pour rien, et c'est très
                    # exactement la distinction que ces trois issues existent
                    # pour montrer. En argent, la ligne ne bouge pas d'un iota.
                    if emplacement.consomme > 0:
                        perdu += 1
                    else:
                        refuse += 1
                    if emplacement.raison:
                        raisons.append(emplacement.raison)
            appels.append(
                {
                    "identifiant": generation.identifiant,
                    "modele": generation.modele,
                    "prompt": self._libelle(generation),
                    "cree_le": generation.cree_le,
                    "cout_usd": generation.cout_usd,
                    # **Ce que l'appel a consommé, et en quoi** (F2). En argent,
                    # c'est le même chiffre que juste au-dessus ; autrement,
                    # c'est le seul des deux qui dise quelque chose.
                    "consomme": generation.consomme,
                    "unite": generation.unite,
                    "projet": generation.projet,
                    # Le nom du jeu, résolu ici : l'écran n'a pas à joindre deux
                    # listes pour écrire une ligne, et un projet supprimé rend
                    # `null` plutôt qu'un identifiant nu que personne ne lit.
                    "projet_nom": noms.get(generation.projet or ""),
                    "provenance": generation.provenance,
                    # **Le sujet, et non le texte envoyé.** Le texte fait 1 690
                    # signes et il est presque le même à chaque appel — le style
                    # y pèse 53 %, le sujet 2 % : mis en ligne, il ferait vingt
                    # lignes qui se ressemblent. Ce qui distingue un appel d'un
                    # autre est la chose du jeu qu'il visait, ou rien.
                    "personnage": generation.personnage,
                    "pose": generation.pose,
                    # Ce que l'appel a **demandé**, pas ce qu'il a rendu. Un
                    # appel à deux variations qui n'en rend qu'une est un cas à
                    # voir, et confondre les deux le rendrait invisible.
                    "variations": len(generation.emplacements),
                    # Les trois issues. Elles comptent des **emplacements**, pas
                    # des appels : un appel à quatre variations peut en garder
                    # deux, en perdre une et s'en faire refuser une.
                    "garde": garde,
                    "perdu": perdu,
                    "refuse": refuse,
                    "raison": raisons[0] if raisons else None,
                    # Ce qui est resté, pour la colonne de droite. La liste ne
                    # porte aucune vignette — une par ligne ferait de cet écran
                    # une seconde galerie, et la galerie fait déjà ça mieux.
                    "assets": [
                        f"{generation.identifiant}-{rang}" for rang in sorted(restants)
                    ],
                    "rafale": None,
                }
            )

        totaux = self._base.totaux_par_projet()
        par_modele: dict[str, dict[str, Any]] = {}
        # **Un total par unité, à côté du total en argent** (F2). Jamais dedans :
        # *un total en argent ne compte que de l'argent* est un invariant de la
        # V2.2, et c'est ce qui permet de lire la barre de tête sans se demander
        # ce qu'elle mélange.
        par_unite: dict[str, dict[str, Any]] = {}
        for appel in appels:
            entree = par_modele.setdefault(
                appel["modele"],
                {
                    "modele": appel["modele"],
                    "cout_usd": 0.0,
                    "consomme": 0.0,
                    "unite": appel["unite"],
                    "appels": 0,
                },
            )
            entree["cout_usd"] += appel["cout_usd"]
            entree["consomme"] += appel["consomme"]
            entree["appels"] += 1
            if not est_argent(appel["unite"]) and appel["consomme"]:
                compte = par_unite.setdefault(
                    appel["unite"],
                    {"unite": appel["unite"], "quantite": 0.0, "appels": 0},
                )
                compte["quantite"] += appel["consomme"]
                compte["appels"] += 1
        for entree in par_modele.values():
            entree["cout_usd"] = round(entree["cout_usd"], 6)
            entree["consomme"] = round(entree["consomme"], 6)
        for compte in par_unite.values():
            compte["quantite"] = round(compte["quantite"], 6)

        # **Le coup de main se compte avec le reste** (CM1) : une ligne par
        # modèle de texte, à côté des modèles d'image — même forme, même argent
        # déduit. Il n'est rattaché à aucun jeu : `total_usd` le compte,
        # `par_projet` et `sans_projet_usd` non, et `texte_usd` dit l'écart.
        texte = self._base.depense_texte()
        for ligne in texte["par_modele"]:
            par_modele[ligne["modele"]] = dict(ligne)

        return {
            "total_usd": self._base.total_par_projet(None),
            "texte_usd": texte["cout_usd"],
            # **Les onze pour cent qu'aucun écran ne montrait** : ce qui a été
            # dépensé sans qu'aucun jeu soit ouvert. Ce n'est pas une erreur,
            # c'est un fait sur la façon dont l'atelier sert — et le seul endroit
            # du produit qui puisse le dire est celui-ci.
            "sans_projet_usd": round(totaux.get(None, 0.0), 6),
            "par_projet": [
                {"projet": p.identifiant, "nom": p.nom, "cout_usd": totaux.get(p.identifiant, 0.0)}
                for p in self.projets()
            ],
            # Trié par ce qu'il coûte : la question est « lequel coûte le
            # plus », et un classement alphabétique la laisserait sans réponse.
            "par_modele": sorted(
                par_modele.values(), key=lambda e: e["cout_usd"], reverse=True
            ),
            # Ce qui s'est consommé sans argent, une ligne par unité. Vide tant
            # qu'aucun appel gratuit n'est parti — c'est-à-dire pour tout ce que
            # ce dépôt a fait avant la V2.2.
            "par_unite": sorted(par_unite.values(), key=lambda e: e["unite"]),
            "appels": appels,
            "rafales": self._rafales(appels),
        }

    def _rafales(self, appels: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Les appels consécutifs sur un même sujet, réunis.

        « Six relances en trente-deux minutes ont coûté le quart de tout
        l'argent jamais dépensé, et rien ne le disait. » Une rafale se lit d'un
        coup d'œil au lieu de se reconstituer en comparant les horodatages un
        par un — ce qu'aucun écran ne fait spontanément, et ce que personne ne
        fait deux fois.

        **Consécutifs et de même sujet, les deux à la fois.** Le même prompt
        repris trois jours plus tard n'est pas une rafale, c'est un retour ; et
        deux sujets différents lancés coup sur coup sont deux intentions. La
        liste arrivant du plus récent au plus ancien, on la parcourt telle
        quelle : deux voisins y sont voisins dans le temps.
        """
        rafales: list[dict[str, Any]] = []
        debut = 0
        while debut < len(appels):
            fin = debut
            while (
                fin + 1 < len(appels)
                and appels[fin + 1]["prompt"].strip() == appels[debut]["prompt"].strip()
                and appels[fin]["cree_le"] - appels[fin + 1]["cree_le"] <= self.ECART_RAFALE_S
            ):
                fin += 1
            # Un appel seul n'est pas une rafale. Marquer tout le monde ferait
            # de la marque un décor, et elle ne dirait plus rien.
            if fin > debut:
                identifiant = f"rafale-{appels[debut]['identifiant']}"
                lot = appels[debut : fin + 1]
                for appel in lot:
                    appel["rafale"] = identifiant
                rafales.append(
                    {
                        "identifiant": identifiant,
                        "appels": len(lot),
                        "cout_usd": round(sum(a["cout_usd"] for a in lot), 6),
                        # **Ce que la rafale a consommé, et en quoi** (F2). Six
                        # relances gratuites brûlent six jetons ; c'est ce que
                        # cette marque existe pour montrer, et l'annoncer à
                        # `$0,0000` la rendrait muette là où elle est le plus
                        # utile — chez le fournisseur où l'on relance le plus.
                        "consomme": round(sum(a["consomme"] for a in lot), 6),
                        "unite": lot[0]["unite"],
                        # Du plus ancien au plus récent, comme on les a lancés.
                        "debut": lot[-1]["cree_le"],
                        "fin": lot[0]["cree_le"],
                        "prompt": lot[0]["prompt"],
                    }
                )
            debut = fin + 1
        return rafales

    # ── L'arbre ──────────────────────────────────────────────────────────────

    def arbre(self) -> dict[str, Any]:
        """Ce que la colonne de gauche affiche, en un seul objet.

        Compté et totalisé ici, jamais à l'écran : une somme faite dans le
        navigateur sur les deux cents assets qu'il a en mémoire dirait un
        chiffre faux dès que la bibliothèque dépasse ce que la grille sert.

        **Les jeux sortent du dernier travaillé au plus ancien** (B4) — ce
        que trie le carnet, ce que montre l'ouverture. `self.projets()`
        garde l'ordre du dépôt ; c'est ici, à l'écran, que la récence compte.

        **Une collection compte désormais des sujets, sous la clé `sujets`, et
        non plus des images sous `assets`** (B8.4) : le renommage est
        volontaire. Un écran d'avant la tranche qui lirait encore `assets` sur
        une collection ne trouverait rien plutôt qu'un chiffre plausible et
        faux — la même règle qu'applique déjà `docs/tranches/V4.md` (§ B8) à
        la grille : compter zéro se voit, compter juste la mauvaise moitié ne
        se voit pas.
        """
        combien = self._base.compter_par_projet()
        totaux = self._base.totaux_par_projet()
        par_collection = self._base.compter_par_collection()
        projets = sorted(
            self.projets(), key=lambda p: p.dernier_travail_le, reverse=True
        )
        return {
            "courant": self._courant,
            "projets": [
                {
                    **projet.en_json(),
                    "assets": combien.get(projet.identifiant, 0),
                    "total_usd": totaux.get(projet.identifiant, 0.0),
                }
                for projet in projets
            ],
            "collections": [
                {**collection.en_json(), "sujets": par_collection.get(collection.identifiant, 0)}
                for collection in self.collections()
            ],
            "sans_projet": {
                "assets": combien.get(None, 0),
                "total_usd": totaux.get(None, 0.0),
            },
            "total_usd": self._base.total_par_projet(None),
        }

    def neuf(self) -> bool:
        """**L'atelier n'a encore rien** — et c'est un fait, pas un drapeau (E19).

        Le premier lancement est la seule minute que personne ne revoit jamais,
        et c'est là que l'assistant s'ouvre. Le reconnaître demandait de savoir
        si on l'avait déjà vu ; **un drapeau posé une fois** aurait été un état
        de plus à tenir, à effacer quand on remet l'atelier à zéro, et à
        expliquer le jour où il se serait désaccordé du disque.

        Trois faits suffisent, et ils cessent d'être vrais au premier geste :
        aucune image nulle part, **un seul jeu**, et il porte encore le nom que
        le produit lui a donné. Importer une image, nommer son jeu, en créer un
        second — n'importe lequel referme la porte, et c'est exactement quand
        elle doit se refermer.

        **La clé n'en fait pas partie.** Elle peut venir de l'environnement,
        posée par quelqu'un qui n'a jamais ouvert l'atelier ; un jeu neuf reste
        un jeu neuf, et l'étape de la clé dira simplement qu'elle est déjà là.
        """
        projets = self.projets()
        if len(projets) != 1 or projets[0].nom != NOM_BAC_A_SABLE:
            return False
        combien = self._base.compter_par_projet()
        return not any(combien.values())

    # ── Outils ───────────────────────────────────────────────────────────────

    def _trouver(self, identifiant: str, *, supprimes: bool = False) -> Asset:
        from atelier.services.assets import AssetInconnu

        asset = self._base.lire_asset(identifiant)
        if asset is None or (asset.supprime and not supprimes):
            raise AssetInconnu(identifiant)
        return asset

    def _annoncer(self) -> None:
        """L'arbre a changé — un projet, une collection, un rangement, un compte.

        Un fait acquis de plus sur le même flux : les onglets ouverts le savent
        au moment où ça se produit, et aucun ne redemande.
        """
        self._diffusion.publier("bibliotheque", self.arbre())
