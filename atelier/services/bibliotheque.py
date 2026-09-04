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

import time
from typing import Any, Iterable

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset
from atelier.domaine.consommation import est_argent
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import Generation, Statut
from atelier.domaine.projet import NOM_BAC_A_SABLE, Collection, Projet, repere
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
        self._base.vider()

        projets = [Projet.depuis_json(p) for p in self._fichiers.lire_projets()]
        collections = [
            Collection.depuis_json(c)
            for c in self._fichiers.lire_collections().values()
            if isinstance(c, dict) and c.get("identifiant")
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

        self._base.remplir(
            generations=generations,
            assets=assets,
            projets=projets,
            collections=collections,
        )
        return {
            "projets": len(projets),
            "collections": len(collections),
            "generations": len(generations),
            "assets": len(assets),
        }

    # ── Les projets ──────────────────────────────────────────────────────────

    def projets(self) -> list[Projet]:
        return self._base.projets()

    @property
    def courant(self) -> str | None:
        """Le projet ouvert dans l'atelier. Ce qui sort y entre (US-2), et c'est
        lui que l'agent recevra par défaut en T7 (US-87)."""
        return self._courant

    def choisir(self, identifiant: str | None) -> str | None:
        """Ouvrir un projet. `None` ouvre « sans projet » — la vue de ce qui a
        été détaché, où l'on peut travailler mais où rien ne se range."""
        if identifiant is not None and self._base.lire_projet(identifiant) is None:
            raise ProjetInconnu(identifiant, [p.identifiant for p in self.projets()])
        self._courant = identifiant
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
            asset.collection = None
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
        propre = nom.strip()
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
        self._base.enregistrer_collection(collection)
        self._ecrire_collections()
        self._annoncer()
        return collection

    def supprimer_collection(self, identifiant: str) -> dict[str, Any]:
        """La collection part, ses assets restent — dans leur projet, sans
        collection. Une collection ne contraint rien, la supprimer non plus."""
        if self._base.lire_collection(identifiant) is None:
            raise CollectionInconnue(identifiant)
        vides = 0
        for asset in self._base.assets(collection=identifiant, limite=100_000):
            asset.collection = None
            self._assets.sauver(asset)
            vides += 1
        self._base.oublier_collection(identifiant)
        self._ecrire_collections()
        self._annoncer()
        return {"collection": identifiant, "assets": vides}

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
    ) -> list[Asset]:
        """La grille. **La seule** — celle du prompt et celle qui range."""
        return self._base.assets(
            projet=projet,
            sans_projet=sans_projet,
            collection=collection,
            favoris=favoris,
            recherche=recherche,
            limite=limite,
        )

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
        collection: str | None = None,
    ) -> list[Asset]:
        """Poser une sélection dans un projet, dans une collection, ou nulle part.

        **Une collection qui appartient à un projet décide du projet** : sinon
        un asset se retrouverait dans la collection d'un univers et dans un
        autre univers, et l'arbre mentirait à l'un des deux endroits.
        """
        if projet is not None and self._base.lire_projet(projet) is None:
            raise ProjetInconnu(projet, [p.identifiant for p in self.projets()])

        cible = projet
        if collection is not None:
            fiche = self._base.lire_collection(collection)
            if fiche is None:
                raise CollectionInconnue(collection)
            if fiche.projet is not None:
                cible = fiche.projet

        ranges = []
        for identifiant in identifiants:
            asset = self._trouver(identifiant)
            asset.projet = cible
            asset.collection = collection
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

        return {
            "total_usd": self._base.total_par_projet(None),
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
        """
        combien = self._base.compter_par_projet()
        totaux = self._base.totaux_par_projet()
        par_collection = self._base.compter_par_collection()
        return {
            "courant": self._courant,
            "projets": [
                {
                    **projet.en_json(),
                    "assets": combien.get(projet.identifiant, 0),
                    "total_usd": totaux.get(projet.identifiant, 0.0),
                }
                for projet in self.projets()
            ],
            "collections": [
                {**collection.en_json(), "assets": par_collection.get(collection.identifiant, 0)}
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
