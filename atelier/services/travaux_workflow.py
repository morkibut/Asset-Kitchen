"""Une fabrication d'image locale utilise le même registre que les animations."""
from __future__ import annotations

import asyncio
import time

from atelier.domaine.asset import identifiant_de
from atelier.domaine.demande import Demande
from atelier.domaine.generation import AGENT, AUTEUR, Reinjection, Statut
from atelier.domaine.travail import TravailRefuse
from atelier.services.travaux import ServiceTravaux, _hash, _json, _verrou


class ServiceTravauxWorkflow(ServiceTravaux):
    def __init__(self, atelier):
        super().__init__(atelier)
        self._taches = atelier.travaux._taches
        atelier.travaux.inscrire_executant("image-locale", self._executer)

    async def preparer(self, projet, brut, acteur=AUTEUR):
        if acteur not in (AUTEUR, AGENT) or not self.a.base.lire_projet(projet):
            raise TravailRefuse("Le jeu ou l'origine de cette demande n'existe pas.")
        if not isinstance(brut, dict):
            raise TravailRefuse("La demande doit être un objet JSON.")
        d = {"cle": brut.get("cle"), "modele": brut.get("modele"), "prompt": brut.get("prompt"),
            "prompt_negatif": brut.get("prompt_negatif", ""), "references": brut.get("references", []),
            "proportions": brut.get("proportions", "1:1"), "resolution": brut.get("resolution"),
            "options": brut.get("options", {}), "repris": brut.get("repris", False),
            "personnage": brut.get("personnage"), "pose": brut.get("pose"), "direction": brut.get("direction"),
            "livrer_provisoire": False}
        if any(not isinstance(d[k], str) or not d[k].strip() for k in ("cle", "modele", "prompt")):
            raise TravailRefuse("Donner une clé de demande, un workflow et un texte à générer.")
        if not isinstance(d["options"], dict) or not isinstance(d["references"], list) or any(not isinstance(r, str) for r in d["references"]) or not isinstance(d["repris"], bool):
            raise TravailRefuse("Les réglages, références ou le choix de texte exact ne sont pas valides.")
        try:
            empreinte = _hash(_json({"demande": d, "acteur": acteur}))
        except (ValueError, TypeError) as e:
            raise TravailRefuse("La demande contient des valeurs JSON non valides.") from e
        identifiant = _hash((projet + "\0" + d["cle"]).encode())[:32]
        dossier = self._dossier(projet, identifiant)
        with _verrou(dossier / ".travail"):
            avant = self._lire(dossier / "travail.json")
            if avant:
                if avant["empreinte"] != empreinte:
                    raise TravailRefuse("Cette clé désigne déjà une autre fabrication. Choisir une nouvelle clé pour modifier l'envoi.")
                return self.lire(projet, identifiant)
            if not self.a.generations.methode_locale(d["modele"]):
                raise TravailRefuse("Choisir un workflow image local pour cette fabrication.")
            if d["personnage"]:
                self.a.production.personnage(projet, d["personnage"])
            generation, _, _ = self.a.generations.preparer(d["modele"], Demande(prompt=d["prompt"], prompt_negatif=d["prompt_negatif"],
                proportions=d["proportions"], resolution=d["resolution"], options=d["options"], repris=d["repris"]),
                identifiant=identifiant + "-image-" + empreinte[:8], projet=projet, provenance=acteur,
                personnage=d["personnage"], pose=d["pose"], direction=d["direction"], references=[Reinjection(asset=r) for r in d["references"]])
            snapshot = self.a.generations.demande_preparee(generation)
            refs = []
            for i, octets in enumerate(snapshot.references):
                nom = f"reference-{i}.png"
                self.a.fichiers._poser(dossier / nom, octets)
                refs.append({"nom": nom, "empreinte": _hash(octets),
                    "url": f"/api/projects/{projet}/production-jobs/{identifiant}/references/{i}"})
            travail = {"nature": "image-locale", "identifiant": identifiant, "cle": d["cle"], "projet": projet,
                "acteur": acteur, "empreinte": empreinte, "demande": d, "cree_le": time.time(), "etat": "prepare", "etape": "relecture",
                "generation_image": generation.identifiant, "clip": None, "reference_asset": None, "bandes": [], "livraison": None,
                "appels_engages": 0, "reserve": None, "demarrage_recu": False, "references": refs, "snapshot_image": snapshot.resume(),
                "annonce": {"appels": 1, "reservation_usd": 0.0, "image_usd": 0.0,
                    "locale": self.a.generations.annonce_locale(d["modele"], snapshot),
                    "methodes": [{"nature": "image", "modele": d["modele"], "locale": True, "payante": False}]}}
            self._garder(travail)
            return self.lire(projet, identifiant)

    async def _executer(self, projet, identifiant, reprise):
        proprietaire = False
        try:
            with _verrou(self._dossier(projet, identifiant) / ".travail"):
                proprietaire = True
                travail = self._brut(projet, identifiant)
                generation = self.a.base.lire(travail["generation_image"])
                if generation.statut != Statut.REUSSIE:
                    etape = self.a.generations.etape_locale(generation.identifiant)
                    if etape:
                        await self.a.generations.suivre_locale(generation.identifiant)
                    else:
                        if travail["appels_engages"]:
                            raise TravailRefuse("La préparation s'est interrompue avant la file locale. Aucun envoi supplémentaire automatique.")
                        refs = []
                        for reference in travail["references"]:
                            octets = (self._dossier(projet, identifiant) / reference["nom"]).read_bytes()
                            if _hash(octets) != reference["empreinte"]:
                                raise TravailRefuse("Une référence de l'envoi préparé a changé sur le disque.")
                            refs.append(octets)
                        snapshot = travail["snapshot_image"]
                        with _verrou(self._projet(projet) / ".budget"):
                            self._autoriser(travail)
                            travail["appels_engages"] = 1
                            travail["etape"] = "image"
                            self._garder(travail)
                        await self.a.generations.executer_preparee(generation.identifiant, Demande(prompt=snapshot["prompt"],
                            prompt_negatif=snapshot.get("prompt_negatif", ""), proportions=snapshot["proportions"],
                            resolution=snapshot["resolution"], options=snapshot["options"], references=tuple(refs), repris=True))
                generation = self.a.base.lire(generation.identifiant)
                etape = self.a.generations.etape_locale(generation.identifiant)
                if etape:
                    travail["etape_locale"] = etape["identifiant"]
                if generation.statut != Statut.REUSSIE:
                    if etape and etape["etat"] == "annule":
                        travail.update(etat="annule", reserve=None, appels_engages=0, raison=etape["raison"])
                    elif etape and etape["etat"] == "externe_inconnu":
                        travail.update(etat="externe_inconnu", raison=etape["raison"])
                    else:
                        travail.update(etat="a_verifier", raison=generation.emplacements[0].raison or "L'image locale reste à récupérer.")
                    self._garder(travail)
                    return
                asset = self.a.assets.lire(identifiant_de(generation.identifiant, 0))
                if not asset:
                    raise TravailRefuse("L'image a été reçue mais attend son entrée en bibliothèque.")
                travail.update(etat="termine", etape="termine", reserve=None, reference_asset=asset.identifiant,
                    assets=[asset.identifiant], raison="")
                self._garder(travail)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            if proprietaire:
                travail = self._brut(projet, identifiant)
                etape = self.a.generations.etape_locale(travail["generation_image"])
                travail.update(etat="externe_inconnu" if etape and etape["etat"] == "externe_inconnu" else "a_verifier", raison=str(e))
                if etape:
                    travail["etape_locale"] = etape["identifiant"]
                self._garder(travail)
