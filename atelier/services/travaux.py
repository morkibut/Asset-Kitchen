"""Personnage → référence → vidéo → bande : une demande durable, deux façades.

La clé relit un dossier ; les sous-appels ont leurs identifiants avant départ.
Une fermeture ne crée aucun appel. La reprise redemande un état connu, jamais
une génération dont l'acceptation est incertaine. Les budgets réservent les
estimations annoncées ; ils ne peuvent imposer un prix maximal à un fournisseur.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import os
import time
from dataclasses import replace
from pathlib import Path
from typing import Any, Iterator

from atelier.domaine.animation import DemandeClip
from atelier.domaine.asset import identifiant_de
from atelier.domaine.bande import Cadre
from atelier.domaine.consommation import USD
from atelier.domaine.demande import Demande
from atelier.domaine.generation import AUTEUR, AGENT, Generation, Reinjection, Statut
from atelier.domaine.recette import Grille, Recette
from atelier.domaine.travail import TravailRefuse, cadre_valide, demande_normalisee


def _json(objet: Any) -> bytes:
    return json.dumps(objet, ensure_ascii=False, sort_keys=True, indent=2).encode("utf-8")


def _hash(octets: bytes) -> str:
    return hashlib.sha256(octets).hexdigest()


@contextlib.contextmanager
def _verrou(chemin: Path) -> Iterator[None]:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("a+b") as flux:
        if flux.tell() == 0:
            flux.write(b"0")
            flux.flush()
        flux.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(flux.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(flux.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as erreur:
            raise TravailRefuse("Cette fabrication est déjà prise en charge. Relire son état.") from erreur
        try:
            yield
        finally:
            if os.name == "nt":
                flux.seek(0)
                msvcrt.locking(flux.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(flux.fileno(), fcntl.LOCK_UN)


class ServiceTravaux:
    def __init__(self, atelier) -> None:
        self.a = atelier
        self.racine = atelier.fichiers.racine / "travaux"
        self._taches: dict[str, asyncio.Task] = {}
        self._executants = {"video-libre": self._executer}

    def inscrire_executant(self, nature: str, executer) -> None:
        """Un suivi et un budget communs, même quand la fabrication n'est pas une vidéo."""
        self._executants[nature] = executer

    def _projet(self, projet: str) -> Path:
        if not self.a.base.lire_projet(projet):
            raise TravailRefuse("Le jeu demandé n'existe plus.")
        return self.racine / _hash(projet.encode())[:24]

    def _dossier(self, projet: str, identifiant: str) -> Path:
        if len(identifiant) != 32 or any(c not in "0123456789abcdef" for c in identifiant):
            raise TravailRefuse("Identifiant de travail inconnu.")
        return self._projet(projet) / identifiant

    def _lire(self, chemin: Path, defaut=None):
        if not chemin.exists():
            return defaut
        try:
            return json.loads(chemin.read_text(encoding="utf-8"))
        except (OSError, ValueError) as erreur:
            raise TravailRefuse(f"Impossible de relire le travail conservé : {erreur}") from erreur

    def _ecrire(self, chemin: Path, objet: Any) -> None:
        self.a.fichiers._poser(chemin, _json(objet))

    def _garder(self, travail: dict[str, Any]) -> None:
        travail["modifie_le"] = time.time()
        self._ecrire(self._dossier(travail["projet"], travail["identifiant"]) / "travail.json", travail)
        self.a.diffusion.publier("travail", {"projet": travail["projet"], "identifiant": travail["identifiant"], "etat": travail["etat"]})

    def cadre(self, projet: str) -> dict[str, Any]:
        ecrit = self._lire(self._projet(projet) / "cadre.json")
        if ecrit is not None:
            return {**ecrit, "origine": "explicite"}
        ancien = self.a.agent.garde_fous()
        return {**cadre_valide({"plafond_appels": ancien.plafond if ancien.plafond_actif else 1_000_000,
                               "modeles_image": [ancien.modele] if ancien.modele_actif else []}),
                "origine": "garde-fous-existants"}

    def regler_cadre(self, projet: str, brut: dict[str, Any]) -> dict[str, Any]:
        cadre = cadre_valide(brut)
        with _verrou(self._projet(projet) / ".budget"):
            self._ecrire(self._projet(projet) / "cadre.json", cadre)
        return self.cadre(projet)

    def _brut(self, projet: str, identifiant: str) -> dict[str, Any]:
        travail = self._lire(self._dossier(projet, identifiant) / "travail.json")
        if not travail:
            raise TravailRefuse("Cette demande n'est pas conservée dans ce jeu.")
        return travail

    def _consommations(self, travail: dict[str, Any]) -> list[dict[str, Any]]:
        retour = list(travail.get("consommations_locales", []))
        identifiants = [travail.get("generation_image"), travail.get("clip"),
                       *travail.get("generations_images", [])]
        for identifiant in dict.fromkeys(i for i in identifiants if i):
            generation = self.a.base.lire(identifiant)
            if generation:
                for e in generation.emplacements:
                    retour.append({"generation": generation.identifiant, "modele": generation.modele,
                                   "consomme": e.consomme, "unite": e.unite, "cout_usd": e.cout_usd})
        return retour

    def lire(self, projet: str, identifiant: str) -> dict[str, Any]:
        travail = self._brut(projet, identifiant)
        retour = {k: v for k, v in travail.items() if k not in ("snapshot_image", "envoi_3d", "reserve", "demarrage_recu")}
        retour["consommations"] = self._consommations(travail)
        retour["envoi_image"] = travail.get("snapshot_image")
        actif = identifiant in self._taches and not self._taches[identifiant].done()
        if travail["etat"] == "en_cours" and not actif:
            retour["etat"] = "a_reprendre"
            retour["raison"] = "Le suivi a été interrompu. Reprendre vérifie les résultats existants sans recommander."
        retour["prochaine_action"] = ("creer_nouvelle_demande" if retour["etat"] == "annule" else "livrer" if retour["etat"] == "termine" else
            "demarrer" if retour["etat"] == "prepare" else
            "reprendre" if retour["etat"] in ("a_reprendre", "a_verifier") else
            "verifier_chez_le_fournisseur" if retour["etat"] == "externe_inconnu" else "attendre")
        if retour["etat"] == "termine" and retour.get("nature") == "video-libre":
            retour["prochaine_action"] = "monter_et_classer"
        if retour.get("nature") == "audio" and retour.get("son"):
            retour["prochaine_action"] = "ecouter_et_retoucher"
        return retour

    def lister(self, projet: str) -> list[dict[str, Any]]:
        return sorted([self.lire(projet, p.parent.name) for p in self._projet(projet).glob("*/travail.json")],
                      key=lambda t: t["cree_le"], reverse=True)

    async def preparer(self, projet: str, brute: dict[str, Any], acteur: str = AUTEUR, *, source_libre: bool = False) -> dict[str, Any]:
        demande = demande_normalisee(brute, source_libre=source_libre)
        if acteur not in (AUTEUR, AGENT):
            raise TravailRefuse("L'origine de la demande doit être auteur ou agent.")
        identifiant = _hash((projet + "\0" + demande["cle"]).encode())[:32]
        dossier = self._dossier(projet, identifiant)
        empreinte = _hash(_json({"demande": demande, "acteur": acteur}))
        existant = self._lire(dossier / "travail.json")
        if existant:
            if existant["empreinte"] != empreinte:
                raise TravailRefuse("Cette clé a déjà une autre demande. Utiliser une nouvelle clé pour la modifier.")
            return self.lire(projet, identifiant)
        await self.a.animation.a_jour()
        with _verrou(dossier / ".travail"):
            existant = self._lire(dossier / "travail.json")
            if existant:
                if existant["empreinte"] != empreinte:
                    raise TravailRefuse("Cette clé a déjà une autre demande.")
                return self.lire(projet, identifiant)
            personnage = None if source_libre else self.a.production.personnage(projet, demande["personnage"])
            objectif = None if source_libre else self.a.production.objectif_de(projet, personnage.identifiant)["objectif"]
            if objectif is not None and not any(s["nature"] == "animation" and s["pose"] == demande["pose"] and
                       s["direction"] == demande["direction"] and s["quantite"] for s in objectif["sorties"]):
                raise TravailRefuse("Cette animation n'est pas demandée dans l'objectif du personnage.")
            # La recette est conservée maintenant, comme les références : une
            # palette changée pendant l'attente ne repeint pas le travail relu.
            recette = self.a.montage.recette_du_jeu(Generation(identifiant="preparation", modele="",
                demande={}, parametres_resolus={}, projet=projet, personnage=personnage.identifiant if personnage else None))
            if objectif:
                recette = replace(recette, grille=replace(recette.grille, cible=objectif["largeur"]) if recette.grille else Grille(cible=objectif["largeur"]))
            if objectif and objectif["largeur"] != objectif["hauteur"]:
                raise TravailRefuse("Le montage actuel produit des cases carrées. Régler un objectif carré avant la fabrication.")
            travail = {"identifiant": identifiant, "cle": demande["cle"], "projet": projet,
                       "acteur": acteur, "empreinte": empreinte, "etat": "prepare", "etape": "reference",
                       "demande": demande, "cree_le": time.time(), "reference_asset": demande["reference_asset"],
                       "generation_image": None, "clip": None, "bandes": [], "livraison": None,
                       "references": [], "recette": recette.en_json(), "objectif": objectif,
                       "appels_engages": 0, "reserve": None, "demarrage_recu": False}
            if source_libre:
                travail["nature"] = "video-libre"
            if personnage and not travail["reference_asset"]:
                choix = self.a.production.image_de_depart(projet, personnage.identifiant, demande["pose"], demande["direction"])
                travail["reference_asset"] = (choix.get("asset") or {}).get("identifiant")
                travail["reference_reutilisee"] = bool(travail["reference_asset"])
            prix_image = 0.0
            if travail["reference_asset"]:
                self._reference(travail, travail["reference_asset"])
            else:
                if not demande["modele_image"]:
                    raise TravailRefuse("Choisir une image de départ ou un modèle d'image pour fabriquer la référence.")
                texte = demande["prompt_image"].strip() or (personnage.description or personnage.nom if personnage else "")
                if not texte:
                    raise TravailRefuse("Décrire l'image de départ à fabriquer avant de demander la vidéo.")
                generation, _, _ = self.a.generations.preparer(demande["modele_image"], Demande(
                    prompt=texte, prompt_negatif=demande["prompt_negatif_image"],
                    proportions=demande["proportions_image"], resolution=demande["resolution_image"],
                    options=demande["options_image"], echelle=personnage.type if personnage else "", repris=demande["repris_image"]),
                    identifiant=identifiant + "-reference-" + empreinte[:8], projet=projet,
                    personnage=personnage.identifiant if personnage else None, pose=demande["pose"], direction=demande["direction"], provenance=acteur,
                    references_ecartees=demande["references_image_ecartees"],
                    references=[Reinjection(asset=r) for r in demande["references_image"]])
                snapshot = self.a.generations.demande_preparee(generation)
                travail["generation_image"] = generation.identifiant
                travail["snapshot_image"] = snapshot.resume()
                travail["references"] = []
                for rang, octets in enumerate(snapshot.references):
                    nom = f"reference-{rang}.png"
                    self.a.fichiers._poser(dossier / nom, octets)
                    travail["references"].append({"nom": nom, "empreinte": _hash(octets),
                        "asset": generation.references[rang].asset if rang < len(generation.references) else None,
                        "url": f"/api/projects/{projet}/production-jobs/{identifiant}/references/{rang}"})
                unite = self.a.catalogue.unite_de(demande["modele_image"])
                if not self.a.generations.methode_locale(demande["modele_image"]) and (unite == USD or unite is None):
                    mesure = self.a.generations.cout_attendu(demande["modele_image"], len(snapshot.references))
                    prix_image = demande["plafond_image_usd"] if demande["plafond_image_usd"] is not None else mesure
                    if prix_image is None:
                        raise TravailRefuse("Le coût de la référence n'est pas encore mesuré. Préciser une réservation en dollars pour ce premier appel.")
            modele = self.a.animation.modele(demande["modele_video"])
            video = self._demande_video(travail, b"reference-prevue")
            refus = self.a.animation.grise(modele, video)
            if refus:
                raise TravailRefuse(refus)
            prix_video = self.a.animation.annonce(modele, video)
            attente = self.a.animation.attente(modele, video)
            travail["annonce"] = {"image_usd": prix_image, "video": prix_video.en_json(),
                "image_locale": bool(travail["generation_image"] and self.a.generations.methode_locale(demande["modele_image"])),
                "temps_local": attente.en_json() if attente else None,
                "reservation_usd": prix_image + (prix_video.montant or 0),
                "appels": 1 + int(bool(travail["generation_image"])),
                "limite": "Les prix estimés servent à réserver le budget. Le fournisseur peut facturer un montant différent.",
                "video_locale": modele.de_la_maison}
            self._garder(travail)
            return self.lire(projet, identifiant)

    def _reference(self, travail: dict[str, Any], identifiant: str) -> None:
        asset = self.a.assets.lire(identifiant)
        if not asset or asset.supprime_le is not None or asset.projet != travail["projet"]:
            raise TravailRefuse("La référence choisie n'est plus une image disponible de ce jeu.")
        octets = self.a.assets.reference(identifiant)
        demande = travail["demande"]
        entree = self.a.animation.preparer_entree(octets, demande["resolution"], demande["proportions"])
        dossier = self._dossier(travail["projet"], travail["identifiant"])
        self.a.fichiers._poser(dossier / "entree-video.png", entree)
        travail["reference_asset"] = identifiant
        travail["entree_video"] = {"empreinte": _hash(entree),
            "url": f"/api/projects/{travail['projet']}/production-jobs/{travail['identifiant']}/video-reference"}

    @staticmethod
    def _demande_video(travail, image) -> DemandeClip:
        d = travail["demande"]
        return DemandeClip(texte=d["prompt_video"], image=image, secondes=d["secondes"],
                           resolution=d["resolution"], proportions=d["proportions"], options=d["options_video"])

    def _autoriser(self, travail: dict[str, Any], *, reserver=False) -> None:
        if travail["acteur"] != AGENT:
            return
        cadre = self.cadre(travail["projet"])
        d, annonce = travail["demande"], travail["annonce"]
        if annonce.get("image_locale") and not cadre["autoriser_local"]:
            raise TravailRefuse("Le cadre de l'agent n'autorise pas la référence locale.")
        methodes = annonce.get("methodes")
        if methodes is not None:
            for methode in methodes:
                if methode["locale"] and not cadre["autoriser_local"]:
                    raise TravailRefuse("Le cadre de l'agent n'autorise pas cette fabrication locale.")
                if methode["payante"] and not cadre["autoriser_payant"]:
                    raise TravailRefuse("Le cadre de l'agent n'autorise pas cette méthode payante.")
                permises = cadre.get("modeles_" + methode["nature"], [])
                if permises and methode["modele"] not in permises:
                    raise TravailRefuse(f"« {methode['modele']} » n'est pas une méthode autorisée à l'agent.")
        elif annonce["video_locale"] and not cadre["autoriser_local"]:
            raise TravailRefuse("Le cadre de l'agent n'autorise pas la vidéo locale.")
        if methodes is None and not annonce["video_locale"] and not cadre["autoriser_payant"]:
            raise TravailRefuse("Le cadre de l'agent n'autorise pas les modèles vidéo payants.")
        for nature in ("image", "video"):
            if methodes is not None:
                break
            modele = d["modele_" + nature]
            if nature == "image" and not travail["generation_image"]:
                continue
            if cadre["modeles_" + nature] and modele not in cadre["modeles_" + nature]:
                raise TravailRefuse(f"« {modele} » n'est pas une méthode autorisée à l'agent.")
        if annonce.get("image_usd", 0) > 0 and not cadre["autoriser_payant"]:
            raise TravailRefuse("Le cadre n'autorise pas la référence payante.")
        if d["livrer_provisoire"] and not cadre["livraison_provisoire"]:
            raise TravailRefuse("Le cadre n'autorise pas la livraison provisoire automatique.")
        montant, appels = 0.0, 0
        for p in self._projet(travail["projet"]).glob("*/travail.json"):
            autre = self._lire(p)
            if autre["acteur"] != AGENT or autre["identifiant"] == travail["identifiant"]:
                continue
            reel = sum(c["cout_usd"] for c in self._consommations(autre))
            reserve = autre.get("reserve") or {}
            montant += max(reel, reserve.get("usd", 0))
            appels += max(autre["appels_engages"], reserve.get("appels", 0))
        reel = sum(c["cout_usd"] for c in self._consommations(travail))
        # Dès que la référence a réellement été facturée, sa mesure remplace
        # l'estimation ; la vidéo encore à soumettre reste réservée à côté.
        reste_video = (annonce["video"]["montant"] or 0) if methodes is None and travail["reference_asset"] and not travail["clip"] else 0
        reste_images = sum(a["reservation_usd"] for a in travail.get("appels", []) if not a.get("soumis"))
        voulu = max(reel + reste_video + reste_images, annonce["reservation_usd"])
        if montant + voulu > cadre["plafond_usd"] + 1e-9:
            raise TravailRefuse("Le budget de l'agent est déjà consommé ou réservé par d'autres demandes.")
        if appels + annonce["appels"] > cadre["plafond_appels"]:
            raise TravailRefuse("Le plafond d'appels de l'agent est déjà consommé ou réservé.")
        if reserver or travail.get("reserve") is not None:
            travail["reserve"] = {"usd": voulu, "appels": annonce["appels"]}

    async def demarrer(self, projet: str, identifiant: str, acteur: str = AUTEUR,
                       *, reprise=False) -> dict[str, Any]:
        travail = self._brut(projet, identifiant)
        if travail["acteur"] != acteur and acteur != AUTEUR:
            raise TravailRefuse("Cette demande appartient à l'autre mode d'utilisation ; reprendre depuis son contexte.")
        if identifiant in self._taches and not self._taches[identifiant].done():
            return self.lire(projet, identifiant)
        if travail["etat"] in ("termine", "annule"):
            return self.lire(projet, identifiant)
        if travail["etat"] == "externe_inconnu":
            raise TravailRefuse("L'acceptation de cet appel reste inconnue. Vérifier chez le fournisseur ; aucun nouvel appel automatique.")
        if travail["demarrage_recu"] and not reprise:
            return self.lire(projet, identifiant)
        executer = self._executants.get(travail.get("nature"), self._executer)
        if travail.get("nature") and travail["nature"] not in self._executants:
            raise TravailRefuse("Le moteur de cette fabrication n'est pas disponible dans cette version.")
        with _verrou(self._projet(projet) / ".budget"):
            travail = self._brut(projet, identifiant)
            self._autoriser(travail, reserver=True)
            if travail["demande"]["livrer_provisoire"] and not self.a.livraison.association(projet):
                raise TravailRefuse("Associer le projet Godot avant d'autoriser cette livraison provisoire.")
            travail["demarrage_recu"] = True
            travail["etat"] = "en_cours"
            self._garder(travail)
        tache = asyncio.create_task(executer(projet, identifiant, reprise))
        self._taches[identifiant] = tache
        return self.lire(projet, identifiant)

    async def attendre(self, projet: str, identifiant: str, secondes: float = 0) -> dict[str, Any]:
        limite = time.monotonic() + min(max(secondes, 0), 30)
        while identifiant in self._taches and not self._taches[identifiant].done() and time.monotonic() < limite:
            await asyncio.sleep(min(0.1, max(0, limite - time.monotonic())))
        return self.lire(projet, identifiant)

    async def attendre_tout(self) -> None:
        if self._taches:
            await asyncio.gather(*list(self._taches.values()), return_exceptions=True)

    def autoriser_generation_locale(self, generation: Generation) -> None:
        """Le cadre se relit quand le GPU prend son tour, après l'attente éventuelle."""
        if generation.provenance != AGENT:
            return
        if not generation.projet or not generation.clip or not generation.clip.lot:
            raise TravailRefuse("Cette génération agent n'appartient pas à une demande durable autorisée.")
        with _verrou(self._projet(generation.projet) / ".budget"):
            travail = self._brut(generation.projet, generation.clip.lot)
            if travail["clip"] != generation.identifiant:
                raise TravailRefuse("Le clip ne correspond plus à la demande autorisée.")
            self._autoriser(travail)
            self._garder(travail)

    async def _executer(self, projet: str, identifiant: str, reprise: bool) -> None:
        dossier = self._dossier(projet, identifiant)
        verrou_pris = False
        try:
            with _verrou(dossier / ".travail"):
                verrou_pris = True
                travail = self._brut(projet, identifiant)
                d = travail["demande"]
                if not travail["reference_asset"]:
                    generation = self.a.base.lire(travail["generation_image"])
                    if not generation:
                        raise TravailRefuse("La préparation de référence manque sur le disque.")
                    locale_image = self.a.generations.etape_locale(generation.identifiant)
                    if locale_image and generation.statut != Statut.REUSSIE:
                        travail["etape_locale"] = locale_image["identifiant"]
                        self._garder(travail)
                        if locale_image["etat"] == "externe_inconnu":
                            travail.update(etat="externe_inconnu", raison=locale_image["raison"])
                            self._garder(travail)
                            return
                        await self.a.generations.suivre_locale(generation.identifiant)
                        generation = self.a.base.lire(generation.identifiant)
                        if self._reference_locale_inachevee(travail, generation):
                            return
                    if travail["etape"] == "reference_soumise" and generation.statut != Statut.REUSSIE:
                        travail["etat"] = "externe_inconnu"
                        travail["raison"] = "La référence a peut-être été facturée, mais aucun résultat certain n'est conservé."
                        self._garder(travail)
                        return
                    if generation.statut != Statut.REUSSIE:
                        snapshot = travail["snapshot_image"]
                        refs = []
                        for ref in travail["references"]:
                            octets = (dossier / ref["nom"]).read_bytes()
                            if _hash(octets) != ref["empreinte"]:
                                raise TravailRefuse("Une référence préparée a changé sur le disque.")
                            refs.append(octets)
                        with _verrou(self._projet(projet) / ".budget"):
                            self._autoriser(travail)
                            travail["etape"] = "reference_soumise"
                            travail["appels_engages"] += 1
                            self._garder(travail)
                        await self.a.generations.executer_preparee(generation.identifiant, Demande(
                            prompt=snapshot["prompt"], prompt_negatif=snapshot.get("prompt_negatif", ""),
                            proportions=snapshot["proportions"], resolution=snapshot["resolution"],
                            options=snapshot["options"], references=tuple(refs), repris=True))
                        generation = self.a.base.lire(generation.identifiant)
                    if generation.statut != Statut.REUSSIE:
                        if self._reference_locale_inachevee(travail, generation):
                            return
                        if any(e.acceptation_inconnue for e in generation.emplacements):
                            travail["etat"] = "externe_inconnu"
                            travail["raison"] = "La réponse de référence a été perdue ; son acceptation reste inconnue. Vérifier chez le fournisseur avant toute autre demande."
                            self._garder(travail)
                            return
                        raise TravailRefuse("La référence n'a pas été produite. Son coût éventuel reste enregistré.")
                    asset = self.a.assets.lire(identifiant_de(generation.identifiant, 0))
                    if not asset:
                        raise TravailRefuse("L'image est arrivée mais attend son entrée en bibliothèque.")
                    self._reference(travail, asset.identifiant)
                    travail["etape"] = "video"
                    self._garder(travail)
                if not travail["clip"]:
                    entree = (dossier / "entree-video.png").read_bytes()
                    if _hash(entree) != travail["entree_video"]["empreinte"]:
                        raise TravailRefuse("L'image préparée pour la vidéo a changé sur le disque.")
                    with _verrou(self._projet(projet) / ".budget"):
                        self._autoriser(travail)
                        travail["clip"] = identifiant + "-video"
                        travail["etape"] = "video_soumise"
                        travail["appels_engages"] += 1
                        self._garder(travail)
                    try:
                        await self.a.animation.commander(d["modele_video"], self._demande_video(travail, entree),
                            identifiant=travail["clip"], projet=projet, personnage=d["personnage"],
                            pose=d["pose"], direction=d["direction"], provenance=travail["acteur"],
                            lot=identifiant, depart=travail["reference_asset"], attendre=False)
                    except Exception as erreur:
                        travail["etat"] = "externe_inconnu"
                        travail["raison"] = f"Acceptation externe incertaine : {erreur}. Aucun nouvel appel automatique."
                        self._garder(travail)
                        return
                locale = self.a.animation.etape_locale(travail["clip"])
                if locale:
                    travail["etape_locale"] = locale["identifiant"]
                    travail["etape"] = "file_locale"
                    self._garder(travail)
                    await self.a.animation.suivre(travail["clip"], reprise=reprise)
                    locale = self.a.animation.etape_locale(travail["clip"])
                    if locale["etat"] != "termine":
                        travail["etat"] = "annule" if locale["etat"] == "annule" else "externe_inconnu" if locale["etat"] == "externe_inconnu" else "a_verifier"
                        if locale["etat"] == "annule":
                            travail["reserve"] = None
                            travail["appels_engages"] = max(0, travail["appels_engages"] - 1)
                        travail["raison"] = locale["raison"] or "Le calcul local reste à vérifier."
                        self._garder(travail)
                        return
                clip = self.a.animation.lire(travail["clip"])
                if not clip or not clip.clip or not clip.clip.travail:
                    travail["etat"] = "externe_inconnu"
                    travail["raison"] = "Le numéro de travail du fournisseur n'a pas été reçu. Vérifier l'appel chez lui."
                    self._garder(travail)
                    return
                travail["travail_externe"] = clip.clip.travail
                self._garder(travail)
                if clip.statut != Statut.REUSSIE:
                    await self.a.animation.suivre(clip.identifiant)
                clip = self.a.animation.lire(travail["clip"])
                if clip.statut != Statut.REUSSIE or not clip.clip.images:
                    travail["etat"] = "a_verifier"
                    travail["raison"] = clip.clip.extraction_refus or clip.emplacements[0].raison or "Le clip reste à récupérer."
                    self._garder(travail)
                    return
                if travail.get("nature") == "video-libre":
                    travail.update(etat="termine", etape="clip", reserve=None, raison="Le clip est dans la galerie. Le montage permet de le classer et d'en tirer une animation.")
                    self._garder(travail)
                    return
                travail["etape"] = "montage"
                self._garder(travail)
                n = min(d["nombre_images"], clip.clip.images)
                images = [round(i * (clip.clip.images - 1) / max(n - 1, 1)) for i in range(n)]
                bande = self.a.montage.garder(clip.identifiant, f"{d['pose']} · {d['direction'] or 'toutes'}", images,
                    cadence=d["cadence"], sens=d["sens"], cadre=Cadre(), recette=Recette.depuis_json(travail["recette"]),
                    pose=d["pose"], direction=d["direction"], identifiant_bande=identifiant + "-bande")
                travail["bandes"] = [bande.identifiant]
                travail["etape"] = "livraison" if d["livrer_provisoire"] else "termine"
                self._garder(travail)
                if d["livrer_provisoire"]:
                    self._autoriser(travail)
                    if not travail["livraison"]:
                        repere = travail["objectif"]["repere"]
                        prevue = self.a.livraison.prevoir(projet, d["personnage"], travail["bandes"],
                            pivot_x=repere["x"], pivot_y=repere["y"], boucles={bande.identifiant: travail["objectif"]["boucle"]})
                        travail["livraison"] = prevue["jeton"]
                        self._garder(travail)
                    self.a.livraison.livrer(projet, travail["livraison"])
                travail["etat"] = "termine"
                travail["etape"] = "termine"
                travail["reserve"] = None
                travail.pop("raison", None)
                self._garder(travail)
        except asyncio.CancelledError:
            raise
        except Exception as erreur:
            if not verrou_pris:
                # Une autre instance possède le dossier : son suivi continue.
                # Ne pas remplacer son état par l'échec de notre prise de main.
                return
            travail = self._brut(projet, identifiant)
            travail["etat"] = "a_verifier"
            travail["raison"] = str(erreur)
            # Une erreur peut avoir consommé ; les appels incertains gardent
            # leurs réservations jusqu'à une résolution explicite.
            self._garder(travail)

    def _reference_locale_inachevee(self, travail: dict[str, Any], generation: Generation) -> bool:
        if generation.statut == Statut.REUSSIE:
            return False
        locale = self.a.generations.etape_locale(generation.identifiant)
        if not locale:
            return False
        travail["etape_locale"] = locale["identifiant"]
        travail["etat"] = "externe_inconnu" if locale["etat"] == "externe_inconnu" else "annule" if locale["etat"] == "annule" else "a_verifier"
        travail["raison"] = locale.get("raison") or "L’image locale reste à récupérer ou à vérifier. Le calcul conservé ne sera pas recommandé."
        if locale["etat"] == "annule":
            travail["reserve"] = None
            travail["appels_engages"] = max(0, travail["appels_engages"] - 1)
        self._garder(travail)
        return True

    def autoriser_generation_image_locale(self, generation: Generation) -> None:
        if generation.provenance != AGENT:
            return
        if not generation.projet:
            raise TravailRefuse("Une génération locale de l'agent doit appartenir à un travail et à un jeu.")
        with _verrou(self._projet(generation.projet) / ".budget"):
            candidats = [t for t in self.lister(generation.projet)
                if generation.identifiant in [t.get("generation_image"), *t.get("generations_images", [])]]
            if len(candidats) != 1:
                raise TravailRefuse("Cette image locale de l'agent n'appartient pas à une demande durable autorisée.")
            travail = self._brut(generation.projet, candidats[0]["identifiant"])
            if travail["etat"] == "annule" or (self._dossier(generation.projet, travail["identifiant"]) / "arret.json").exists():
                raise TravailRefuse("Cette demande a été annulée avant le calcul local.")
            self._autoriser(travail)
            self._garder(travail)

    def reference(self, projet: str, identifiant: str, rang: int | None = None) -> bytes:
        travail = self._brut(projet, identifiant)
        dossier = self._dossier(projet, identifiant)
        if rang is None:
            nom = "entree-video.png"
        elif 0 <= rang < len(travail["references"]):
            nom = travail["references"][rang]["nom"]
        else:
            raise TravailRefuse("Cette référence n'existe pas dans l'envoi.")
        if not (dossier / nom).is_file():
            raise TravailRefuse("La référence n'est pas encore disponible.")
        return (dossier / nom).read_bytes()
