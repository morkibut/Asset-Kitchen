"""Installer les méthodes sonores en un geste (SN1).

Pour chaque moteur de `atelier.audio.graphes`, retrouve ses fichiers de poids
par motif contre `/object_info` (les listes des chargeurs), construit le
profil avec les noms réellement trouvés et l'importe par le chemin ordinaire
(`profils_workflow.importer`) : même version, même diagnostic, même file
locale qu'un workflow collé par l'auteur. Rien n'est jamais téléchargé ni
écrit chez ComfyUI.

Suit la forme du motif « installer un style en un geste » du chantier des
moteurs locaux (docs/PLAN-moteurs-locaux.md, ML2 : le catalogue, la recherche
par motif, la route qui installe) — ML2 n'est pas encore codé sur cette
branche, ce module ne le partage pas : c'est la version son, dans ses propres
fichiers.
"""
from __future__ import annotations

import copy
import re

from atelier.audio.graphes import CONSTRUCTEURS, FAMILLES, FICHIERS, postes_fichiers


def _motif(nom_fichier):
    """Le nom de base, insensible à la casse et au séparateur de dossier : un
    poids posé sous une jonction (`D-disk\\…\\fichier.safetensors`) est
    retrouvé comme `fichier.safetensors`."""
    return re.split(r"[\\/]", str(nom_fichier))[-1].lower()


def _choix(declaration):
    """Les choix d'un COMBO, dans ses deux écritures d'object_info."""
    if not declaration:
        return None
    if isinstance(declaration[0], list):
        return declaration[0]
    if declaration[0] == "COMBO":
        return declaration[1].get("options")
    return None


def _trouver(classe, champ, nom_fichier, object_info):
    """Le nom réellement installé pour ce fichier, ou rien : on cherche parmi
    les choix que ComfyUI déclare pour ce chargeur précis, jamais ailleurs."""
    entree = object_info.get(classe, {}).get("input", {})
    declares = {**entree.get("required", {}), **entree.get("optional", {})}
    motif = _motif(nom_fichier)
    for choix in _choix(declares.get(champ)) or []:
        if isinstance(choix, str) and _motif(choix) == motif:
            return choix
    return None


def _manque(nom_fichier):
    fiche = FICHIERS.get(nom_fichier, {})
    return {"nom": fiche.get("nom", nom_fichier), "fichier": nom_fichier,
        "dossier": fiche.get("dossier", ""), "source": fiche.get("source", "")}


def installer_depuis(profils_workflow, object_info, identifiants=None):
    """Fonction pure : `object_info` est déjà lu, rien n'est appelé ici. C'est
    ce que les essais éprouvent sans ComfyUI."""
    resultats = {}
    for identifiant, construire in CONSTRUCTEURS.items():
        if identifiants is not None and identifiant not in identifiants:
            continue
        brut = construire()
        trouves, manquants, vus = {}, [], set()
        for poste in postes_fichiers(brut):
            nom = poste["fichier"]
            if nom in vus:
                continue
            vus.add(nom)
            reel = _trouver(poste["classe"], poste["champ"], nom, object_info)
            if reel is None:
                manquants.append(_manque(nom))
            else:
                trouves[nom] = reel
        if manquants:
            resultats[identifiant] = {"identifiant": identifiant, "installe": False, "manque": manquants}
            continue
        remplace = copy.deepcopy(brut)
        for noeud in remplace["graphe"].values():
            for champ, valeur in list(noeud["inputs"].items()):
                if isinstance(valeur, str) and valeur in trouves:
                    noeud["inputs"][champ] = trouves[valeur]
        # Installer deux fois sans rien changer ne crée pas de version :
        # `importer` ne pose le fichier que si l'empreinte n'existe pas déjà.
        profil = profils_workflow.importer(remplace)
        resultats[identifiant] = {"identifiant": identifiant, "installe": True, "profil": profil}
    return resultats


class ServiceInstallationSon:
    def __init__(self, profils_workflow):
        self.profils_workflow = profils_workflow

    async def installer(self, identifiants=None):
        moteur = self.profils_workflow.fabrique_moteur()
        object_info = await moteur._json("GET", "/object_info")
        return installer_depuis(self.profils_workflow, object_info, identifiants)

    def diagnostic_sonore(self, profil, diagnostic):
        """Pour l'écran : les fichiers absents que le diagnostic a signalés,
        chacun avec son nom en français, son dossier et sa source — ce qui
        grise le moteur avec sa raison, jamais proposé puis refusé."""
        if profil.get("nature") != "audio" or diagnostic.get("disponible"):
            return []
        requis = {poste["fichier"] for poste in postes_fichiers(profil)}
        trouve, vus = [], set()
        for probleme in diagnostic.get("problemes", []):
            for nom in requis:
                if nom in probleme and nom not in vus:
                    vus.add(nom)
                    trouve.append(_manque(nom))
        return trouve

    def moteurs_par_famille(self):
        """Le moteur sonore par défaut de chaque famille, parmi ceux
        installés : le premier de sa liste qui a un profil. SN2/l'écran le
        prend tel quel pour composer une demande."""
        par_identifiant = {}
        for profil in self.profils_workflow.lister():
            actuel = par_identifiant.get(profil["identifiant"])
            if actuel is None or profil["cree_le"] > actuel["cree_le"]:
                par_identifiant[profil["identifiant"]] = profil
        resultat = {}
        for famille, ordre in FAMILLES.items():
            choisi = next((par_identifiant[i] for i in ordre if i in par_identifiant), None)
            if choisi:
                resultat[famille] = {"famille": famille, "modele": choisi["modele"], "moteur": choisi["identifiant"]}
            else:
                resultat[famille] = {"famille": famille, "modele": None, "moteur": None,
                    "raison": "Aucun moteur installé pour « " + famille + " » : " + ", ".join(ordre) + "."}
        return resultat
