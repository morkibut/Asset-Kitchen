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

from atelier.audio.graphes import CONSTRUCTEURS, FAMILLES, FICHIERS, POSSIBLES, postes_fichiers
from atelier.audio.texte import SFXR
from atelier.domaine.son import FAMILLES_SON
from atelier.domaine.workflow import WorkflowRefuse


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


def _familles_de(identifiant):
    """Les familles de son où ce moteur sert (`atelier.audio.graphes.FAMILLES`) :
    ce qu'un moteur « sait faire », jamais recopié en dur côté écran (MO4, « le
    catalogue décide »). Vide pour un identifiant qui n'apparaît dans aucune
    famille — `yue2-partition-jouee` (SN9), qui partage le fichier de poids de
    `yue2-int8` mais n'est jamais un moteur à choisir pour lui-même : le
    catalogue de la page « Moteurs » l'exclut par construction (voir
    `catalogue_depuis`)."""
    return [famille for famille, ordre in FAMILLES.items() if identifiant in ordre]


def catalogue_depuis(profils_workflow, object_info):
    """Fonction pure, comme `installer_depuis`, mais qui **ne pose jamais de
    profil** : un simple `GET` (la page « Moteurs », MO4) ne doit rien écrire.
    Pour chaque moteur réellement choisissable — un identifiant qui sert au
    moins une famille —, dit son nom, ce qu'il sait faire, s'il est prêt, ce
    qui lui manque sinon, et le modèle qu'il porte s'il est déjà installé."""
    par_identifiant = {}
    for profil in profils_workflow.lister():
        actuel = par_identifiant.get(profil["identifiant"])
        if actuel is None or profil["cree_le"] > actuel["cree_le"]:
            par_identifiant[profil["identifiant"]] = profil
    lignes = []
    for identifiant, construire in CONSTRUCTEURS.items():
        familles = _familles_de(identifiant)
        if not familles:
            continue
        brut = construire()
        manquants, vus = [], set()
        for poste in postes_fichiers(brut):
            nom = poste["fichier"]
            if nom in vus:
                continue
            vus.add(nom)
            if _trouver(poste["classe"], poste["champ"], nom, object_info) is None:
                manquants.append(_manque(nom))
        installe = par_identifiant.get(identifiant)
        lignes.append({"identifiant": identifiant, "nom": brut["nom"], "description": brut["description"],
            "familles": familles, "pret": not manquants, "manque": manquants,
            "modele": installe["modele"] if installe else None})
    return lignes


class ServiceInstallationSon:
    def __init__(self, profils_workflow, atelier=None):
        self.profils_workflow = profils_workflow
        # `atelier` arrive après coup (construit avant `travaux_audio` dans
        # `Atelier.__init__`) : on ne s'en sert que dans `moteurs_par_famille`,
        # appelée bien après que l'atelier soit entièrement monté.
        self.atelier = atelier

    async def installer(self, identifiants=None):
        moteur = self.profils_workflow.fabrique_moteur()
        object_info = await moteur._json("GET", "/object_info")
        return installer_depuis(self.profils_workflow, object_info, identifiants)

    async def catalogue(self):
        """Le catalogue des moteurs sonores (MO4) : la page « Moteurs » lit
        ceci, jamais une liste écrite à la main dans l'écran. Un `ComfyUI
        injoignable` se lève en clair, comme `ServiceStylesLocaux.inventaire`
        le fait déjà pour l'image — la page grise alors la section entière
        plutôt que de mentir sur l'état de chaque moteur."""
        moteur = self.profils_workflow.fabrique_moteur()
        try:
            object_info = await moteur._json("GET", "/object_info")
        except Exception as e:
            raise WorkflowRefuse(f"ComfyUI est injoignable : {e}") from e
        return catalogue_depuis(self.profils_workflow, object_info)

    def diagnostic_sonore(self, profil, diagnostic):
        """Pour l'écran : les fichiers absents que le diagnostic a signalés,
        chacun avec son nom en français, son dossier et sa source — ce qui
        grise le moteur avec sa raison, jamais proposé puis refusé.

        Retrouve chaque fiche par le même motif que l'installation (`_motif` :
        le nom de base, insensible à la casse et au dossier) plutôt qu'une
        égalité exacte contre le texte du problème — un message qui cite le
        fichier sous un autre dossier ou une autre casse le retrouve quand
        même."""
        if profil.get("nature") != "audio" or diagnostic.get("disponible"):
            return []
        requis = {poste["fichier"] for poste in postes_fichiers(profil)}
        par_motif = {_motif(nom): nom for nom in requis}
        trouve, vus = [], set()
        for probleme in diagnostic.get("problemes", []):
            motif_probleme = _motif(probleme)
            for motif, nom in par_motif.items():
                if motif in motif_probleme and nom not in vus:
                    vus.add(nom)
                    trouve.append(_manque(nom))
        return trouve

    def moteurs_par_famille(self, projet):
        """Le moteur sonore par défaut de chaque famille pour ce jeu : **le
        même choix que SN2** (`ServiceTravauxAudio._moteur_de_famille` —
        l'univers du jeu d'abord, puis le premier moteur installé de la
        famille, sfxr pour l'interface), jamais une seconde liste qui pourrait
        s'en écarter. La route `sound-defaults` et l'outil MCP
        `get_sound_engine_defaults` en dépendent, avec le projet en paramètre."""
        ta = self.atelier.travaux_audio
        par_identifiant = {}
        for profil in self.profils_workflow.lister():
            actuel = par_identifiant.get(profil["identifiant"])
            if actuel is None or profil["cree_le"] > actuel["cree_le"]:
                par_identifiant[profil["identifiant"]] = profil
        resultat = {}
        for famille in FAMILLES_SON:
            moteur, _ = ta._moteur_de_famille(projet, famille)
            if moteur == SFXR:
                resultat[famille] = {"famille": famille, "modele": SFXR, "moteur": SFXR, "possibles": list(POSSIBLES[famille])}
                continue
            profil = par_identifiant.get(moteur) if moteur else None
            if profil:
                resultat[famille] = {"famille": famille, "modele": profil["modele"], "moteur": profil["identifiant"],
                                     "possibles": list(POSSIBLES[famille])}
                continue
            ordre = FAMILLES.get(famille, ())
            noms = [CONSTRUCTEURS[i]()["nom"] if i in CONSTRUCTEURS else i for i in ordre]
            raison = ("Aucun moteur installé pour « " + famille + " » : il faut " + " ou ".join(noms) + ".") if ordre else \
                "Aucun moteur sonore n'existe encore pour « " + famille + " »."
            resultat[famille] = {"famille": famille, "modele": None, "moteur": None, "raison": raison,
                                 "possibles": list(POSSIBLES[famille])}
        return resultat
