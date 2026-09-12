"""Pont asset3d par étapes, lancé dans un processus séparé de l’atelier.

Les modules ``serveur`` du projet voisin ne sont importés qu’ici. Les scripts
restent chez lui ; les personnages, essais, corrections et journaux du pont
restent sous le dossier de données fourni. Aucun moteur ne démarre à l’import.
"""
from __future__ import annotations

import argparse
import ast
import base64
import binascii
from contextlib import asynccontextmanager
from contextvars import ContextVar
from dataclasses import fields
import hashlib
import importlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import threading
from types import SimpleNamespace
from typing import Any, Literal
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

RACINE = Path(__file__).resolve().parents[1]
MOTIF_CLE = re.compile(r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}")
ACTIFS = {
    "modele_3d": ("moteur_3d", "remesh", "texture", "normal_res", "ao_res", "ao_samples", "steps_forme"),
    "rig": ("animation",),
    "rendu": ("animation", "nombre_images", "angle", "eclairage", "style", "contraste", "exposition", "saturation", "taille_images", "cadrage"),
}


class DemandeStage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cle: str
    etape: Literal["modele_3d", "rig", "rendu"]
    personnage: str | None = None
    photo_base64: str | None = Field(default=None, max_length=48 * 1024 * 1024)
    nom_photo: str | None = None
    reglages: dict[str, Any] = Field(default_factory=dict)
    empreinte_corrections: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    camera: dict[str, float] | None = None
    plage: dict[str, float] | None = None


class RefusPont(Exception):
    def __init__(self, message: str, statut: int = 400):
        self.message, self.statut = message, statut


def _cle(cle: str) -> str:
    if not MOTIF_CLE.fullmatch(cle):
        raise RefusPont("La clé de cette étape doit être un UUID.")
    return cle.lower()


def _ecrire_json(chemin: Path, valeur: Any) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    provisoire = chemin.with_suffix(".tmp")
    with provisoire.open("w", encoding="utf-8") as fichier:
        json.dump(valeur, fichier, ensure_ascii=False, sort_keys=True)
        fichier.flush()
        os.fsync(fichier.fileno())
    os.replace(provisoire, chemin)


def _empreinte_corrections(corrections: dict) -> str:
    return hashlib.sha256(json.dumps(corrections, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _figer_apercu(natif, essai) -> None:
    """Copier avant que les corrections suivantes ne remplacent le GLB source."""
    lire = getattr(natif.personnages, "apercu_du_rig", None)
    if not lire or not essai.personnage:
        return
    source = lire(essai.personnage, essai.reglages)
    if source is None or not source.is_file():
        return
    destination = natif.depot.dossier_essai(essai.identifiant) / "rig-atelier.glb"
    provisoire = destination.with_suffix(".tmp")
    shutil.copyfile(source, provisoire)
    os.replace(provisoire, destination)


def charger_asset3d(source: Path, donnees: Path) -> SimpleNamespace:
    """Configuration locale avant tout import susceptible de capturer un chemin."""
    source, donnees = source.resolve(), donnees.resolve()
    if not (source / "serveur" / "main.py").is_file():
        raise RefusPont("Le dossier source d’asset3d ne contient pas son serveur.")
    if donnees == source or source in donnees.parents or donnees in source.parents:
        raise RefusPont("Les données du pont doivent être séparées du projet asset3d.")
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
    # Le service de rig persistant du voisin a sa propre durée de vie et son
    # propre journal. Le pont emploie son chemin natif en sous-processus.
    os.environ["ASSET3D_SERVICE_RIG"] = "0"
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(source))
    config = importlib.import_module("serveur.config")
    config.DOSSIER_ESSAIS = donnees / "essais"
    config.DOSSIER_PERSONNAGES = donnees / "personnages"
    config.JOURNAL_SERVICE_RIG = donnees / "journaux" / "rig.log"
    config.SERVICE_RIG_ACTIF = False
    adresse_lanceur = None
    if config.SCRIPT_TRELLIS.is_file():
        # Lire une constante ne doit pas importer un lanceur GPU ni exécuter
        # son code. Le script natif ne reçoit pas COMFY_HOTE en argument.
        arbre = ast.parse(config.SCRIPT_TRELLIS.read_text(encoding="utf-8-sig"))
        for ligne in arbre.body:
            if isinstance(ligne, ast.Assign) and any(isinstance(cible, ast.Name) and cible.id == "HOTE" for cible in ligne.targets) and isinstance(ligne.value, ast.Constant) and isinstance(ligne.value.value, str):
                adresse_lanceur = ligne.value.value
    # Le script absolu reste dans le labo ; ses copies « sorties/ » ne doivent
    # jamais écrire dans le dépôt voisin.
    config.DOSSIER_R2 = donnees / "calculs"
    modules = {nom: importlib.import_module(f"serveur.{nom}") for nom in ("main", "depot", "personnages", "modeles", "executeur")}
    script_rendu_natif = config.SCRIPT_RENDU
    config.SCRIPT_RENDU = Path(__file__).with_name("blender_rendu_asset3d.py")
    rendu = importlib.import_module("serveur.etapes.rendu")
    lecture_native = rendu._corrections_du_personnage

    def corrections_figees(contexte):
        copie = modules["depot"].dossier_essai(contexte.essai.identifiant) / "corrections-atelier.json"
        return json.loads(copie.read_text(encoding="utf-8")) if copie.is_file() else lecture_native(contexte)

    rendu._corrections_du_personnage = corrections_figees
    commande_rendu = importlib.import_module("serveur.commande_rendu")
    ecrire_commande_native = commande_rendu.ecrire
    contexte_rendu = ContextVar("options_du_rendu_asset3d", default=None)
    def ecrire_commande(*args, **kwargs):
        chemin = ecrire_commande_native(*args, **kwargs)
        options = contexte_rendu.get()
        if options is not None:
            commande = json.loads(chemin.read_text(encoding="utf-8"))
            commande["atelier"] = {"source_asset3d": str(source), **options}
            _ecrire_json(chemin, commande)
        return chemin
    commande_rendu.ecrire = ecrire_commande

    # Les routes natives (travail, bibliothèque et imports) annoncent toutes
    # la caméra et les corrections vraiment figées, pas le préréglage support.
    page_native = modules["modeles"].Essai.pour_page
    def pour_page(essai):
        page = page_native(essai)
        if re.fullmatch(r"[a-zA-Z0-9_-]+", essai.identifiant):
            dossier = donnees / "essais" / essai.identifiant
            options = dossier / "rendu-atelier.json"
            corrections = dossier / "corrections-atelier.json"
            if corrections.is_file():
                page["corrections"] = json.loads(corrections.read_text(encoding="utf-8"))
                page["corrections_historiques"] = True
            if options.is_file():
                page.update(json.loads(options.read_text(encoding="utf-8")))
        return page
    modules["modeles"].Essai.pour_page = pour_page
    # Les GLB de contrôle d’un essai sont des pièces historiques. Le lecteur
    # natif retrouve sinon le rig courant, même pour un ancien travail modèle.
    depot = modules["depot"]
    apercu_natif = depot.chemin_apercu_rig
    def apercu_fige(essai):
        dossier = depot.dossier_essai(essai.identifiant)
        if (dossier / "corrections-atelier.json").is_file():
            copie = dossier / "rig-atelier.glb"
            return copie if copie.is_file() else None
        return apercu_natif(essai)
    depot.chemin_apercu_rig = apercu_fige

    # Les scripts Blender d’aperçu du rig reçoivent la même copie de
    # corrections que le futur rendu, sans modifier leur fichier source.
    courant = ContextVar("corrections_du_travail_asset3d", default=None)
    personnages = modules["personnages"]
    chemin_natif = personnages.chemin_corrections
    personnages.chemin_corrections = lambda id: courant.get() or chemin_natif(id)
    registre = modules["executeur"].REGISTRE
    rig = modules["modeles"].Etape.RIG
    rig_natif = registre[rig]
    def produire_rig(contexte):
        copie = depot.dossier_essai(contexte.essai.identifiant) / "corrections-atelier.json"
        jeton = courant.set(copie if copie.is_file() else None)
        try:
            resultat = rig_natif(contexte)
            _figer_apercu(SimpleNamespace(**modules), contexte.essai)
            return resultat
        finally:
            courant.reset(jeton)
    registre[rig] = produire_rig
    rendu_cle = modules["modeles"].Etape.RENDU
    rendu_natif = registre[rendu_cle]
    def produire_rendu(contexte):
        fichier = depot.dossier_essai(contexte.essai.identifiant) / "rendu-atelier.json"
        options = json.loads(fichier.read_text(encoding="utf-8")) if fichier.is_file() else {}
        jeton = contexte_rendu.set(options)
        try:
            resultat = rendu_natif(contexte)
            # Ni cadre individuel ni taille silencieusement changée : le
            # rendu produit exactement les dimensions relues avant calcul.
            from PIL import Image
            from serveur.etapes.contrat import EchecEtape
            attendu = (contexte.reglages.taille_images,) * 2
            if len(resultat.images) != contexte.reglages.nombre_images:
                raise EchecEtape("Le rendu n’a pas produit le nombre de frames relu avant calcul.")
            for image in resultat.images:
                with Image.open(image) as ouverte:
                    if ouverte.size != attendu or ouverte.mode != "RGBA":
                        raise EchecEtape("Les frames du rendu ne gardent pas le cadre commun et la transparence annoncés.")
            return resultat
        finally:
            contexte_rendu.reset(jeton)
    registre[rendu_cle] = produire_rendu
    return SimpleNamespace(config=config, adresse_lanceur=adresse_lanceur, script_rendu_natif=script_rendu_natif, **modules)


class PontAsset3D:
    def __init__(self, natif: SimpleNamespace, donnees: Path):
        self.natif, self.donnees = natif, donnees.resolve()
        self.executeur = natif.main.executeur
        self._porte = threading.Lock()

    def _chemin_cle(self, cle: str) -> Path:
        return self.donnees / "cles" / f"{_cle(cle)}.json"

    def par_cle(self, cle: str) -> dict:
        chemin = self._chemin_cle(cle)
        if not chemin.is_file():
            raise RefusPont("Aucune étape n’a été lancée avec cette clé.", 404)
        recu = json.loads(chemin.read_text(encoding="utf-8"))
        essai = self.executeur.essai_en_memoire(recu["identifiant"]) or self.natif.depot.lire_essai(recu["identifiant"])
        if essai is None:
            # Une clé consommée ne redevient jamais une permission de calcul.
            raise RefusPont("Cette étape a été enregistrée mais ses fichiers ne sont plus disponibles. Elle ne sera pas relancée automatiquement.", 409)
        return {**essai.pour_page(), "cle": _cle(cle), "etape": recu["etape"], "empreinte_demande": recu["empreinte"]}

    def _preparer(self, demande: DemandeStage):
        _cle(demande.cle)
        n = self.natif
        inconnues = set(demande.reglages) - {f.name for f in fields(n.modeles.Reglages)}
        if inconnues:
            raise RefusPont("Paramètres inconnus : " + ", ".join(sorted(inconnues)))
        try:
            reglages = n.modeles.Reglages.depuis_formulaire(demande.reglages)
        except (ValueError, TypeError, n.modeles.ReglagesInvalides) as erreur:
            raise RefusPont(str(erreur)) from erreur
        etape = n.modeles.Etape(demande.etape)
        import math
        for cle, valeur, bornes in (("camera", demande.camera, {"azimut": (0, 360), "elevation": (-90, 90)}), ("plage", demande.plage, {"debut": (0, 100), "fin": (0, 100)})):
            if valeur is not None:
                if demande.etape != "rendu" or set(valeur) != set(bornes) or any(not math.isfinite(v) or not bornes[k][0] <= v <= bornes[k][1] for k, v in valeur.items()):
                    raise RefusPont(f"Le réglage {cle} exige ses deux valeurs dans leurs bornes et ne s’applique qu’au rendu.")
        if demande.plage and (demande.plage["fin"] < demande.plage["debut"] or (demande.plage["debut"] == demande.plage["fin"] and reglages.nombre_images != 1)):
            raise RefusPont("Une plage va du début vers la fin ; une pose fixe demande une seule frame.")
        fiche, contenu, nom = None, b"", demande.nom_photo or "reference.png"
        if demande.personnage and demande.photo_base64:
            raise RefusPont("Choisissez une photo ou un personnage existant, pas les deux.")
        if demande.personnage:
            try:
                fiche = n.personnages.lire(demande.personnage)
                fiche.exiger_disponible()
            except (ValueError, n.personnages.PersonnageIndisponible) as erreur:
                raise RefusPont(str(erreur)) from erreur
        elif demande.photo_base64:
            try:
                contenu = base64.b64decode(demande.photo_base64, validate=True)
                n.personnages.verifier_la_photo(nom, contenu)
            except (ValueError, binascii.Error, n.personnages.PhotoInvalide) as erreur:
                raise RefusPont("La photo de départ est invalide : " + str(erreur)) from erreur
        raisons: list[str] = []
        if demande.etape == "modele_3d":
            if fiche:
                contenu, nom = fiche.chemin_photo.read_bytes(), fiche.photo
            if not contenu:
                raisons.append("Choisissez une image de départ pour le modèle 3D.")
            chemins = ("PYTHON_LABO", "SCRIPT_TRELLIS", "SCRIPT_DETOURAGE")
            herites = {}
            adresse_lanceur = getattr(n, "adresse_lanceur", None)
            if adresse_lanceur and getattr(n.config, "COMFY_HOTE", adresse_lanceur).rstrip("/").replace("localhost", "127.0.0.1") != adresse_lanceur.rstrip("/").replace("localhost", "127.0.0.1"):
                raisons.append(f"Le lanceur installé d’asset3d utilise {adresse_lanceur}, qui diffère de son adresse ComfyUI configurée. Corrigez cette configuration avant de lancer.")
        else:
            if fiche is None:
                raisons.append("Choisissez un personnage qui possède déjà un modèle 3D.")
            herites = n.personnages.fichiers_herites(fiche, reglages, (etape,)) if fiche else {}
            if fiche and not fiche.chemin_modele.is_file():
                raisons.append("Le modèle 3D du personnage manque.")
            if demande.etape == "rig":
                squelette = n.personnages.squelette(fiche.identifiant) if fiche else None
                chemins = ("BLENDER_EXE", "SCRIPT_ATTACHE_ANIMATION") if squelette else ("PYTHON_LABO", "SCRIPT_RIG")
            else:
                chemins = ("BLENDER_EXE", "SCRIPT_RENDU")
                if n.modeles.Etape.RIG not in herites:
                    raisons.append("Posez ou attachez d’abord le rig de cette animation. Le rendu ne lance pas le rig à votre place.")
            animation = n.personnages.animation_resolue(reglages)
            if not (n.config.DOSSIER_ANIMATIONS / animation).is_file():
                raisons.append(f"L’animation locale « {animation} » n’est pas disponible.")
        for nom_chemin in chemins:
            if not Path(getattr(n.config, nom_chemin)).is_file():
                raisons.append(f"Le programme requis {nom_chemin} n’est pas disponible dans la configuration d’asset3d.")
        if demande.etape == "rendu" and getattr(n, "script_rendu_natif", None):
            if not n.script_rendu_natif.is_file():
                raisons.append("Le script de rendu d’asset3d n’est pas disponible.")
            elif demande.plage:
                from atelier.blender_rendu_asset3d import adapter_script
                try: adapter_script(n.script_rendu_natif.read_text(encoding="utf-8-sig"), str(n.script_rendu_natif), True)
                except (ValueError, SyntaxError) as erreur: raisons.append(str(erreur))
        return reglages, etape, fiche, contenu, nom, herites, raisons

    def preview(self, demande: DemandeStage) -> dict:
        reglages, _, fiche, _, _, herites, raisons = self._preparer(demande)
        corrections = self.natif.personnages.lire_corrections(fiche.identifiant) if fiche and demande.etape != "modele_3d" else {}
        return {"reglages": reglages.vers_json(), "etape": demande.etape,
                "camera": demande.camera, "plage": demande.plage,
                "sortie": {"largeur": getattr(reglages, "taille_images", None), "hauteur": getattr(reglages, "taille_images", None), "cadre": "commun", "fond": "transparent"} if demande.etape == "rendu" else None,
                "corrections": corrections, "empreinte_corrections": _empreinte_corrections(corrections),
                "personnage": fiche.identifiant if fiche else None,
                "etapes_reutilisees": [e.value for e in herites],
                "parametres_actifs": list(ACTIFS[demande.etape]),
                "prerequis": {"disponible": not raisons, "raisons": raisons, "poids_verifies": False},
                "limites": ["La présence des scripts et exécutables est vérifiée ; les poids du moteur et la mémoire GPU ne sont pas sondés. Les téléchargements Hugging Face sont désactivés dans les processus lancés par le pont."]}

    def demarrer(self, demande: DemandeStage) -> dict:
        normalisee = demande.model_dump(exclude_none=True)
        normalisee["cle"] = _cle(demande.cle)
        empreinte = hashlib.sha256(json.dumps(normalisee, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        with self._porte:
            chemin = self._chemin_cle(demande.cle)
            if chemin.is_file():
                ancienne = json.loads(chemin.read_text(encoding="utf-8"))
                if ancienne["empreinte"] != empreinte:
                    raise RefusPont("Cette clé désigne déjà une autre demande. Préparez une nouvelle étape.", 409)
                return self.par_cle(demande.cle)
            reglages, etape, fiche, contenu, nom, herites, raisons = self._preparer(demande)
            if raisons:
                raise RefusPont(" ".join(raisons), 409)
            n = self.natif
            # Une nouvelle géométrie ne remplace jamais le modèle qui porte
            # déjà des rigs et des rendus. Son nouvel identifiant est rendu.
            porteur = None if demande.etape == "modele_3d" else fiche
            corrections = n.personnages.lire_corrections(porteur.identifiant) if porteur else {}
            if demande.empreinte_corrections is not None and demande.empreinte_corrections != _empreinte_corrections(corrections):
                raise RefusPont("Les corrections du squelette ont changé depuis la relecture. Préparez une nouvelle étape pour les vérifier.", 409)
            carte = n.personnages.etapes_sur_la_carte(porteur, (etape,))

            def creer():
                (self.donnees / "calculs").mkdir(parents=True, exist_ok=True)
                essai = n.depot.creer_essai(reglages, (etape,), personnage=porteur, nom_depose=nom, contenu=contenu)
                essai.etapes_reutilisees = list(herites)
                n.depot.ecrire_etat(essai)
                _ecrire_json(n.depot.dossier_essai(essai.identifiant) / "corrections-atelier.json", corrections)
                if demande.etape == "rendu":
                    _ecrire_json(n.depot.dossier_essai(essai.identifiant) / "rendu-atelier.json", {"camera": demande.camera, "plage": demande.plage, "cadre": "commun"})
                    _figer_apercu(n, essai)
                # fsync + remplacement atomique AVANT que Executeur ne crée
                # son thread : une réponse perdue ne relance aucun calcul.
                _ecrire_json(chemin, {"version": 1, "cle": _cle(demande.cle), "empreinte": empreinte,
                                      "identifiant": essai.identifiant, "etape": demande.etape})
                return essai

            try:
                self.executeur.demarrer(creer, etapes=(etape,), fichiers_herites=herites, etapes_carte=carte)
            except n.executeur.VoieOccupee as erreur:
                raise RefusPont(str(erreur), 409) from erreur
            return self.par_cle(demande.cle)

    def occupation(self) -> dict:
        travaux = []
        for voie in (self.executeur.voie_carte, self.executeur.voie_rendu):
            if voie.occupee():
                essai = voie.occupant()
                travaux.append({"voie": voie.nom, "essai": essai.pour_page() if essai else None})
        return {"etat": "occupe" if travaux else "disponible", "travaux": travaux,
                "temperature": "inconnue", "portee": "processus-pont",
                "raison": "Occupation des voies d’asset3d. Les autres processus et la mémoire GPU ne sont pas sondés."}


def _verrou_processus(donnees: Path):
    """Un seul exécuteur peut posséder ces données, même sur un autre port."""
    donnees.mkdir(parents=True, exist_ok=True)
    fichier = (donnees / "pont.lock").open("a+b")
    fichier.write(b"0"); fichier.flush(); fichier.seek(0)
    try:
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(fichier.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(fichier.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError as erreur:
        fichier.close()
        raise RefusPont("Un pont asset3d utilise déjà ce dossier de données.", 409) from erreur
    return fichier


def creer_application(source: Path, donnees: Path, *, natif: SimpleNamespace | None = None) -> FastAPI:
    n = natif or charger_asset3d(source, donnees)
    pont = PontAsset3D(n, donnees)

    @asynccontextmanager
    async def vie(_app):
        verrou = _verrou_processus(donnees)
        try:
            n.main.preparer()  # répare les états interrompus, sans relancer
            yield
        finally:
            n.main.ranger()
            verrou.close()

    app = FastAPI(title="Asset Kitchen · pont asset3d par étapes", lifespan=vie)
    app.state.pont = pont

    @app.middleware("http")
    async def local_seulement(request: Request, suite):
        try:
            hote = urlsplit("http://" + request.headers.get("host", "")).hostname
            origine = request.headers.get("origin")
            if hote not in ("127.0.0.1", "localhost", "::1") or (origine and urlsplit(origine).hostname not in ("127.0.0.1", "localhost", "::1")):
                return JSONResponse({"message": "Ce pont accepte uniquement les appels locaux."}, status_code=403)
        except ValueError:
            return JSONResponse({"message": "Adresse locale invalide."}, status_code=403)
        return await suite(request)

    @app.exception_handler(RefusPont)
    async def refus(_request, erreur: RefusPont):
        return JSONResponse({"message": erreur.message}, status_code=erreur.statut)

    # Les erreurs du serveur voisin gardent ses phrases françaises.
    for classe, gestionnaire in n.main.app.exception_handlers.items():
        app.add_exception_handler(classe, gestionnaire)

    @app.get("/api/atelier/contract")
    def contrat():
        return {"version": 1, "etapes": list(ACTIFS), "preview": True,
                "idempotence": "cle-uuid-et-empreinte-persistantes",
                "reglages": "/api/reglages", "animations": "/api/animations",
                "corrections_historiques": True, "poids_verifies": False}

    @app.get("/api/atelier/occupation")
    def occupation():
        return pont.occupation()

    if hasattr(n.main, "reglages_disponibles"):
        @app.get("/api/reglages")
        def catalogue():
            return {**n.main.reglages_disponibles(), "camera_libre": {"azimut": {"minimum": 0, "maximum": 360, "pas": 1}, "elevation": {"minimum": -90, "maximum": 90, "pas": 1}}, "plage_animation": {"minimum": 0, "maximum": 100, "unite": "%"}, "cadre": "commun"}

    @app.post("/api/atelier/stages/preview")
    def preview(demande: DemandeStage):
        return pont.preview(demande)

    @app.post("/api/atelier/stages")
    def demarrer(demande: DemandeStage):
        return pont.demarrer(demande)

    @app.get("/api/atelier/stages/by-key/{cle}")
    def retrouver(cle: str):
        return pont.par_cle(cle)

    if hasattr(n.main, "poser_les_corrections"):
        @app.put("/api/personnages/{identifiant}/corrections")
        async def corriger(identifiant: str, request: Request):
            # Lire le corps avant le verrou : aucune attente réseau ne garde
            # la porte dont le lancement synchrone a besoin.
            await request.body()
            with pont._porte:
                actifs = pont.occupation()["travaux"]
                if any(t["essai"] and t["essai"].get("personnage") == identifiant for t in actifs):
                    raise RefusPont("Une étape utilise ce personnage. Attendez sa fin avant d’enregistrer les corrections ; les anciens rendus restent conservés.", 409)
                return await n.main.poser_les_corrections(identifiant, request)

    # Pas de route qui contourne la relecture/idempotence pour lancer le
    # pipeline complet. Les corrections natives et fichiers restent lisibles.
    for route in n.main.app.routes:
        chemin = getattr(route, "path", "")
        methodes = getattr(route, "methods", set()) or set()
        if chemin.startswith("/api/") and ("GET" in methodes or ("PUT" in methodes and chemin.endswith("/corrections")) or ("POST" in methodes and chemin.endswith("/planche"))):
            app.router.routes.append(route)
    return app


def main() -> None:
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("--source", type=Path, default=RACINE.parent / "asset3d")
    parseur.add_argument("--donnees", type=Path, default=RACINE / "donnees" / "pont-asset3d")
    parseur.add_argument("--port", type=int, default=8498)
    args = parseur.parse_args()
    if not args.donnees.resolve().is_relative_to(RACINE):
        parseur.error("Les données du pont doivent rester dans le dossier d’Asset Kitchen.")
    import uvicorn
    uvicorn.run(creer_application(args.source, args.donnees), host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
