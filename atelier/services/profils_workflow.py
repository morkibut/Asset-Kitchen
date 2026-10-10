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

    def _chemin_service(self, identifiant):
        # Rangé hors de `racine` (donc hors de `lister()`, qui glane
        # `racine/*/*.json` en version de profil) : un petit fichier par style,
        # à part des versions elles-mêmes (défaut 4b, relecture du 18/09/2026).
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", identifiant):
            raise WorkflowRefuse("Cette version de profil n'existe pas.")
        return self.fichiers.racine / "styles-locaux-service" / (identifiant + ".json")

    def marquer_service(self, identifiant, version):
        """La version qu'une installation vient de produire ou de retrouver pour
        ce style — **pas** la plus récente par `cree_le`. Fichiers A→B→A :
        réinstaller après ce cycle doit remettre A en service, alors que B est
        plus jeune sur le disque."""
        self.fichiers._poser(self._chemin_service(identifiant), octets_json({"version": version}))

    def version_en_service(self, identifiant):
        """La version en service, ou `None` si aucune installation n'est jamais
        passée (jeu de données d'avant cette règle, ou style jamais installé) :
        relue sans migration, sans lever — l'appelant replie alors sur la plus
        récente par `cree_le`."""
        try:
            return json.loads(self._chemin_service(identifiant).read_text(encoding="utf-8"))["version"]
        except (OSError, ValueError, KeyError):
            return None

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

    # ── MO6 · Les workflows importés, des moteurs comme les autres ──────────

    @staticmethod
    def importe_par_l_auteur(profil):
        """Un profil que l'auteur a importé lui-même — ni un style de sc-clone
        (ou sa retouche de zone), ni un moteur sonore : ceux-là ont déjà leur
        section sur la page « Moteurs », sous leur propre nom."""
        from atelier.fournisseur.catalogue_styles import style
        from atelier.services.installation_son import CONSTRUCTEURS
        return not profil.get("style") and style(profil["identifiant"]) is None and profil["identifiant"] not in CONSTRUCTEURS

    async def importes(self):
        """Chaque workflow importé par l'auteur, **tel un moteur** : sa dernière
        version, ce qu'il sait faire (lu sur ses liaisons), ce que son graphe
        saurait recevoir en plus (`a_relier`), et son diagnostic — ce qui lui
        manque pour tourner, élément par élément. Un seul `/object_info` pour
        tous ; rien n'est écrit, rien n'est lancé."""
        from atelier.domaine.lecture_graphe import a_relier, capacites_du_profil
        from atelier.fournisseur.workflow_image import _ObjectInfoPartage

        dernieres, versions = {}, {}
        for profil in self.lister():
            if not self.importe_par_l_auteur(profil):
                continue
            versions[profil["identifiant"]] = versions.get(profil["identifiant"], 0) + 1
            actuel = dernieres.get(profil["identifiant"])
            if actuel is None or profil["cree_le"] > actuel["cree_le"]:
                dernieres[profil["identifiant"]] = profil
        moteur = self.fabrique_moteur()
        lignes = []
        async with _ObjectInfoPartage(moteur):
            for profil in sorted(dernieres.values(), key=lambda p: p["nom"].casefold()):
                diagnostic = await moteur.diagnostiquer_profil(profil)
                diagnostic.update(observe_le=time.time(), adresse=moteur.adresse)
                self._diagnostics[(profil["identifiant"], profil["version"])] = diagnostic
                lignes.append({
                    "identifiant": profil["identifiant"], "nom": profil["nom"], "nature": profil["nature"],
                    "description": profil.get("description", ""), "modele": profil["modele"],
                    "version": profil["version"], "cree_le": profil["cree_le"], "versions": versions[profil["identifiant"]],
                    "references_min": profil["references_min"], "references_max": profil["references_max"],
                    "durees": profil["durees"], "capacites": capacites_du_profil(profil),
                    "a_relier": a_relier(profil), "diagnostic": diagnostic,
                })
        return lignes

    def relier(self, identifiant, version):
        """Le geste « relier ce que le graphe sait recevoir » : **une nouvelle
        version** du profil, qui relie la zone ou l'image de fin que la lecture
        du graphe a trouvées (`relier_ce_que_le_graphe_sait`). L'ancienne reste
        lisible — une génération passée la nomme toujours."""
        from atelier.domaine.lecture_graphe import relier_ce_que_le_graphe_sait
        return self.importer(relier_ce_que_le_graphe_sait(self.lire(identifiant, version)))
