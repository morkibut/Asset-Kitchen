"""ML2 : installer les styles de sc-clone comme des profils de workflow ordinaires.

Résoudre les fichiers, construire le graphe, importer — dans cet ordre, et rien
de plus : aucun poids n'est téléchargé, aucune génération n'est lancée.
"""
from __future__ import annotations

from atelier.domaine.workflow import WorkflowRefuse
from atelier.fournisseur.catalogue_styles import FAMILLES, STYLES, inventaire, resoudre
from atelier.fournisseur.styles_locaux import construire_profil


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

    async def lister(self):
        inventaire_ = await self._inventaire()
        sortie = []
        for entree in STYLES:
            resolu = resoudre(entree, inventaire_)
            installe = self._installe(entree["identifiant"])
            sortie.append({"identifiant": entree["identifiant"], "nom": entree["nom"], "famille": entree["famille"],
                "genre": entree.get("genre", "sprite"), "vitesse": entree.get("vitesse") or FAMILLES[entree["famille"]]["vitesse"],
                "reference": FAMILLES[entree["famille"]]["reference"],
                "pret": resolu["pret"], "manque": resolu["manque"],
                "modele": installe["modele"] if installe else None})
        return sortie

    async def installer(self, identifiant):
        entree = next((s for s in STYLES if s["identifiant"] == identifiant), None)
        if entree is None:
            raise WorkflowRefuse(f"Style inconnu : {identifiant}.")
        resolu = resoudre(entree, await self._inventaire())
        if not resolu["pret"]:
            raise WorkflowRefuse(f"Il manque : {', '.join(resolu['manque'])}.")
        installe = self.profils.importer(construire_profil(entree, resolu["fichiers"]))
        self.profils.marquer_service(identifiant, installe["version"])
        return installe

    async def installer_prets(self):
        inventaire_ = await self._inventaire()
        resultats = []
        for entree in STYLES:
            resolu = resoudre(entree, inventaire_)
            if resolu["pret"]:
                installe = self.profils.importer(construire_profil(entree, resolu["fichiers"]))
                self.profils.marquer_service(entree["identifiant"], installe["version"])
                resultats.append(installe)
        return resultats
