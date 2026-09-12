"""Les versions de workflows appartiennent à l'atelier, pas à ComfyUI."""
from __future__ import annotations

import json
import re
import time

from atelier.domaine.workflow import WorkflowRefuse, normaliser, octets_json, version_de


class ServiceProfilsWorkflow:
    def __init__(self, fichiers, diffusion, fabrique_moteur):
        self.fichiers, self.diffusion, self.fabrique_moteur = fichiers, diffusion, fabrique_moteur
        self.racine = fichiers.racine / "profils-workflow"
        self._diagnostics = {}
        self.apres_import = []

    def _chemin(self, identifiant, version):
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", identifiant) or not re.fullmatch(r"[a-f0-9]{64}", version):
            raise WorkflowRefuse("Cette version de profil n'existe pas.")
        return self.racine / identifiant / (version + ".json")

    def importer(self, brut):
        profil = normaliser(brut)
        version = version_de(profil)
        chemin = self._chemin(profil["identifiant"], version)
        if not chemin.exists():
            self.fichiers._poser(chemin, octets_json({"profil": profil, "version": version, "cree_le": time.time()}))
            self.diffusion.publier("profils_workflow", {"identifiant": profil["identifiant"], "version": version})
        lu = self.lire(profil["identifiant"], version)
        for annoncer in self.apres_import:
            annoncer(lu)
        return lu

    def lire(self, identifiant, version):
        try:
            valeur = json.loads(self._chemin(identifiant, version).read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            raise WorkflowRefuse("Cette version de workflow ne peut pas être relue.") from e
        if version_de(valeur["profil"]) != version:
            raise WorkflowRefuse("Le workflow conservé a changé sur le disque ; son empreinte ne correspond plus.")
        return {**valeur["profil"], "version": version, "cree_le": valeur["cree_le"],
            "modele": "ComfyUI:" + identifiant + "@" + version,
            "diagnostic": self._diagnostics.get((identifiant, version))}

    def de_modele(self, modele):
        try:
            identifiant, version = modele.removeprefix("ComfyUI:").split("@")
            return self.lire(identifiant, version)
        except ValueError as e:
            raise WorkflowRefuse("Le modèle doit nommer une version précise de workflow.") from e

    def lister(self):
        profils = [self.lire(p.parent.name, p.stem) for p in self.racine.glob("*/*.json")]
        return sorted(profils, key=lambda p: (p["nom"], -p["cree_le"]))

    async def diagnostiquer(self, identifiant, version):
        profil = self.lire(identifiant, version)
        moteur = self.fabrique_moteur()
        diagnostic = await moteur.diagnostiquer_profil(profil)
        diagnostic.update(observe_le=time.time(), adresse=moteur.adresse)
        self._diagnostics[(identifiant, version)] = diagnostic
        return diagnostic
