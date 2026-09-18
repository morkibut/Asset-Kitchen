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
        # jeu de fichiers résolus, les anciennes gardées.
        versions = [p for p in self.profils.lister() if p["identifiant"] == identifiant]
        return max(versions, key=lambda p: p["cree_le"]) if versions else None

    async def lister(self):
        inventaire_ = await self._inventaire()
        sortie = []
        for entree in STYLES:
            resolu = resoudre(entree, inventaire_)
            installe = self._installe(entree["identifiant"])
            sortie.append({"identifiant": entree["identifiant"], "nom": entree["nom"], "famille": entree["famille"],
                "genre": entree.get("genre", "sprite"), "vitesse": FAMILLES[entree["famille"]]["vitesse"],
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
        return self.profils.importer(construire_profil(entree, resolu["fichiers"]))

    async def installer_prets(self):
        inventaire_ = await self._inventaire()
        resultats = []
        for entree in STYLES:
            resolu = resoudre(entree, inventaire_)
            if resolu["pret"]:
                resultats.append(self.profils.importer(construire_profil(entree, resolu["fichiers"])))
        return resultats
