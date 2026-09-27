"""ML2 : installer les styles de sc-clone comme des profils de workflow ordinaires.

Résoudre les fichiers, construire le graphe, importer — dans cet ordre, et rien
de plus : aucun poids n'est téléchargé, aucune génération n'est lancée.

**MO1 : un style installé pour créer sait repeindre une zone sans rien installer
de plus.** Sa retouche est un second profil (un graphe qui relie un masque ne part
jamais sans lui), mais elle se **tire du profil installé pour créer**
(`profil_de_zone`) : mêmes fichiers, mêmes réglages. Elle s'écrit la première
fois qu'on repeint avec ce style (`repeint`), et suit ensuite chaque
réinstallation du style — jamais avant qu'on s'en serve, pour que la liste des
modèles ne double pas chaque style d'une ligne grisée « il lui faut la zone ».
"""
from __future__ import annotations

from atelier.domaine.workflow import WorkflowRefuse
from atelier.fournisseur.catalogue_styles import FAMILLES, OUTILS, STYLES, createur_de, inventaire, resoudre, style, zone_de
from atelier.fournisseur.styles_locaux import construire_profil, profil_de_zone


class ServiceStylesLocaux:
    def __init__(self, profils):
        self.profils = profils

    async def _inventaire(self):
        # Toujours relu sur `profils` : un essai qui double le moteur après
        # coup (`atelier.profils_workflow.fabrique_moteur = ...`) doit être vu.
        moteur = self.profils.fabrique_moteur()
        try:
            informations = await moteur._json("GET", "/object_info")
        except Exception as e:
            raise WorkflowRefuse(f"ComfyUI est injoignable : {e}") from e
        return inventaire(informations)

    async def inventaire(self):
        """Ce que ComfyUI déclare, réduit à ce que les styles interrogent — ou le
        refus « injoignable », dit en clair."""
        return await self._inventaire()

    def _installe(self, identifiant):
        # Un style s'installe sous son propre identifiant : une version par
        # jeu de fichiers résolus, les anciennes gardées. **La version « en
        # service » est celle que la dernière installation a produite ou
        # retrouvée** (défaut 4b) — pas la plus récente par `cree_le` : sur un
        # cycle A→B→A, réinstaller A ne réécrit rien (même version déjà connue)
        # mais doit tout de même redevenir la version montrée, alors que B est
        # plus jeune sur le disque. Sans marqueur (style jamais installé par
        # cette règle), on replie sur la plus récente, comme avant.
        versions = [p for p in self.profils.lister() if p["identifiant"] == identifiant]
        if not versions:
            return None
        service = self.profils.version_en_service(identifiant)
        if service:
            trouve = next((p for p in versions if p["version"] == service), None)
            if trouve:
                return trouve
        return max(versions, key=lambda p: p["cree_le"])

    def installe(self, identifiant):
        """Le profil en service de ce style (ou de sa retouche), ou `None`."""
        return self._installe(identifiant)

    def _ligne(self, entree, inventaire_):
        resolu = resoudre(entree, inventaire_)
        installe = self._installe(entree["identifiant"])
        famille = FAMILLES[entree["famille"]]
        return {"identifiant": entree["identifiant"], "nom": entree["nom"], "famille": entree["famille"],
            "moteur": famille["nom"],
            "genre": entree.get("genre", "sprite"), "vitesse": entree.get("vitesse") or famille["vitesse"],
            "reference": famille["reference"],
            "pret": resolu["pret"], "manque": resolu["manque"],
            "modele": installe["modele"] if installe else None}

    async def lister(self):
        inventaire_ = await self._inventaire()
        return [self._ligne(entree, inventaire_) for entree in STYLES]

    async def lister_outils(self):
        """Les retouches de référence, une par moteur (`catalogue_styles.OUTILS`) :
        même ligne qu'un style — prêt ou non, et ce qui manque, en clair —, pour
        dire quoi installer quand aucun style installé ne sait encore repeindre."""
        return self.lignes_outils(await self._inventaire())

    def lignes_outils(self, inventaire_):
        return [self._ligne(entree, inventaire_) for entree in OUTILS]

    def _importer(self, profil):
        installe = self.profils.importer(profil)
        self.profils.marquer_service(installe["identifiant"], installe["version"])
        return installe

    def _suivre(self, entree, creation, inventaire_):
        """La retouche d'un style qu'on vient de (ré)installer suit son profil de
        création — **si elle a déjà servi** : sinon elle attend qu'on repeigne."""
        zone = zone_de(entree)
        if zone is None or self.profils.version_en_service(zone["identifiant"]) is None:
            return
        if resoudre(zone, inventaire_)["pret"]:
            self._importer(profil_de_zone(creation, zone))

    async def installer(self, identifiant):
        """Installer un style — ou, sous l'identifiant de sa retouche (les cinq
        de PX7), **le style et sa retouche ensemble** : un moteur s'installe une
        fois pour tout ce qu'il sait faire. La retouche se rend alors, comme avant."""
        entree = style(identifiant)
        if entree is None:
            raise WorkflowRefuse(f"Style inconnu : {identifiant}.")
        inventaire_ = await self._inventaire()
        resolu = resoudre(entree, inventaire_)
        if not resolu["pret"]:
            raise WorkflowRefuse(f"Il manque : {', '.join(resolu['manque'])}.")
        createur = createur_de(entree)
        creation = self._importer(construire_profil(createur, resolu["fichiers"]))
        if entree is not createur:
            return self._importer(profil_de_zone(creation, entree))
        self._suivre(entree, creation, inventaire_)
        return creation

    async def installer_prets(self):
        inventaire_ = await self._inventaire()
        resultats = []
        for entree in STYLES:
            resolu = resoudre(entree, inventaire_)
            if resolu["pret"]:
                installe = self._importer(construire_profil(entree, resolu["fichiers"]))
                self._suivre(entree, installe, inventaire_)
                resultats.append(installe)
        return resultats

    async def repeint(self, creation):
        """La retouche de zone du profil `creation` (un style installé pour
        créer), écrite si elle ne l'est pas encore — **aucun fichier n'est
        cherché de nouveau** : elle reprend ceux que ce profil emploie déjà.
        Refusée, avec ce qui manque, quand ComfyUI n'a pas les nœuds de la zone."""
        entree = style(creation["identifiant"])
        zone = zone_de(entree) if entree is not None else None
        if zone is None:
            raise WorkflowRefuse(f"« {creation['nom']} » ne sait pas repeindre une zone.")
        noeuds = (await self._inventaire())["noeuds"]
        manque = [n for n in FAMILLES[entree["famille"]]["repeint"] if n not in noeuds]
        if manque:
            raise WorkflowRefuse("Il manque, dans ComfyUI : " + ", ".join("le nœud " + n for n in manque) + ".")
        return self._importer(profil_de_zone(creation, zone))
