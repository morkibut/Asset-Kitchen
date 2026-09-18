"""Un son local relu avant calcul, acquis avant décodage et repris par son numéro."""
from __future__ import annotations

import asyncio
import time

from atelier.domaine.travail import TravailRefuse
from atelier.domaine.workflow import MUSIQUE, composer, musique_du_graphe, tirer_graine
from atelier.services.file_locale import AcceptationLocaleInconnue, SuiviLocalInterrompu, FINIS
from atelier.services.travaux import ServiceTravaux, _hash, _json, _verrou


class ServiceTravauxAudio(ServiceTravaux):
    def __init__(self, atelier):
        super().__init__(atelier)
        self._taches = atelier.travaux._taches
        self.intervalle, self.delai = 2, 1800
        atelier.travaux.inscrire_executant("audio", self._executer)
        atelier.file_locale.inscrire_executeur("audio", self._calcul)
        # Un adaptateur disponible dans le code n’est pas un moteur configuré.
        # L’observer par défaut bloquait toute la 3D d’un atelier sans workflow
        # sonore. Un profil déclaré ou une étape durable ouverte, eux, engagent
        # réellement ce moteur : leur occupation inconnue continue de bloquer.
        atelier.profils_workflow.apres_import.append(self._profil_importe)
        for profil in atelier.profils_workflow.lister():
            self._profil_importe(profil)
        for etape in atelier.file_locale.lister()["etapes"]:
            if etape["nature"] == "audio" and etape["etat"] not in FINIS:
                self._raccorder(etape["moteur"])

    def _profil_importe(self, profil):
        if profil["nature"] == "audio": self._raccorder()

    def _moteur(self):
        return self.a.profils_workflow.fabrique_moteur()

    def _raccorder(self, identifiant=None):
        m = self._moteur()
        identifiant = identifiant or m.nom + "@" + m.adresse
        async def observer():
            courant = self._moteur()
            if courant.nom + "@" + courant.adresse != identifiant:
                return {"etat": "inconnu", "travaux": [], "raison": "Rétablissez l’adresse du moteur sonore conservé avant de reprendre ; son occupation reste inconnue."}
            return await courant.observer_ressource()
        self.a.file_locale.inscrire_moteur(identifiant, m.nom, observer)
        return identifiant

    async def preparer(self, projet, brut, acteur="auteur"):
        self._projet(projet)
        permis = {"cle", "modele", "prompt", "prompt_negatif", "secondes", "options", "nom", *MUSIQUE}
        if acteur not in ("auteur", "agent") or not isinstance(brut, dict) or set(brut) - permis:
            raise TravailRefuse("La demande sonore contient un réglage inconnu.")
        d = {"cle": brut.get("cle"), "modele": brut.get("modele"), "prompt": brut.get("prompt"),
             "prompt_negatif": brut.get("prompt_negatif", ""), "secondes": brut.get("secondes"),
             "options": brut.get("options", {}), "nom": brut.get("nom", ""), "livrer_provisoire": False,
             # Seulement s'ils sont demandés : l'empreinte d'une demande d'avant ne bouge pas.
             **{k: brut[k] for k in MUSIQUE if k in brut}}
        if any(not isinstance(d[k], str) or not d[k].strip() for k in ("cle", "modele", "prompt")) or len(d["cle"]) > 200:
            raise TravailRefuse("Donnez une clé, un workflow sonore et la description du bruitage.")
        if not isinstance(d["options"], dict) or not isinstance(d["nom"], str) or not isinstance(d["prompt_negatif"], str):
            raise TravailRefuse("Les options et les textes du bruitage sont invalides.")
        profil = self.a.profils_workflow.de_modele(d["modele"])
        if profil["nature"] != "audio": raise TravailRefuse("Choisissez un workflow sonore.")
        valeurs = {k: d[k] for k in ("prompt", "prompt_negatif", "secondes", "options")}
        # Paroles, tempo, tonalité, mesure : ceux du graphe quand la demande
        # n'en dit rien, figés dans l'envoi pour être relus et repris tels quels.
        valeurs.update({**musique_du_graphe(profil), **{k: d[k] for k in MUSIQUE if k in d}})
        composer(profil, **valeurs)
        try: empreinte = _hash(_json({"demande": d, "acteur": acteur}))
        except (ValueError, TypeError) as e: raise TravailRefuse("Les options doivent contenir des valeurs JSON finies.") from e
        identifiant = _hash((projet + "\0" + d["cle"]).encode())[:32]
        dossier = self._dossier(projet, identifiant)
        avant = self._lire(dossier / "travail.json")
        if avant:
            if avant["empreinte"] != empreinte: raise TravailRefuse("Cette clé désigne déjà un autre son.")
            return self.lire(projet, identifiant)
        diagnostic = await self._moteur().diagnostiquer_profil(profil)
        if not diagnostic["disponible"]: raise TravailRefuse(" · ".join(diagnostic["problemes"]))
        # Les options omises deviennent leurs valeurs effectives avant la relecture.
        valeurs["options"] = {k: d["options"].get(k, p["defaut"]) for k, p in profil["parametres"].items()}
        # La graine (liaison de ML1) se tire une fois, ici : une reprise renvoie
        # la même, et la provenance du son la garde pour refaire ce tirage.
        if "graine" in profil["liaisons"]:
            valeurs["graine"] = tirer_graine()
        with _verrou(dossier / ".travail"):
            avant = self._lire(dossier / "travail.json")
            if avant:
                if avant["empreinte"] != empreinte: raise TravailRefuse("Cette clé désigne déjà un autre son.")
                return self.lire(projet, identifiant)
            t = {"nature": "audio", "identifiant": identifiant, "projet": projet, "cle": d["cle"], "acteur": acteur,
                 "demande": d, "empreinte": empreinte, "snapshot_audio": valeurs, "profil": profil, "moteur": self._raccorder(),
                 "cree_le": time.time(), "etat": "prepare", "etape": "relecture", "references": [], "bandes": [],
                 "generation_image": None, "clip": None, "reference_asset": None, "son": None,
                 "appels_engages": 0, "reserve": None, "demarrage_recu": False,
                 "annonce": {"appels": 1, "reservation_usd": 0, "methodes": [{"nature": "audio", "modele": d["modele"], "locale": True, "payante": False}],
                     "mesures": [m for m in self.a.file_locale.mesures() if m["modele"] == d["modele"]],
                     "limite": "Un calcul local, aucun coût fournisseur en argent. La durée demandée est celle du son, pas le temps de calcul."}}
            self._garder(t)
        return self.lire(projet, identifiant)

    async def _calcul(self, e):
        m, file = self._moteur(), self.a.file_locale
        if m.nom + "@" + m.adresse != e["moteur"]:
            raise SuiviLocalInterrompu("Rétablissez l’adresse du moteur de ce bruitage avant de reprendre.")
        t = self._brut(e["projet"], e["parametres"]["travail"])
        numero = e["travail_externe"]
        if not numero:
            if e["soumission_engagee"]:
                raise AcceptationLocaleInconnue("L’acceptation du son est inconnue. Associez son numéro ComfyUI conservé avant de reprendre.")
            diagnostic = await m.diagnostiquer_profil(t["profil"])
            if not diagnostic["disponible"]: raise TravailRefuse(" · ".join(diagnostic["problemes"]))
            with _verrou(self._projet(t["projet"]) / ".budget"):
                self._autoriser(t)
                t["appels_engages"] = 1; self._garder(t)
            file.engager(e["identifiant"])
            try: numero = await m.soumettre_graphe(t["profil"], t["snapshot_audio"], [])
            except Exception as erreur: raise AcceptationLocaleInconnue("Réponse du workflow sonore perdue : " + str(erreur)) from erreur
            file.connaitre_externe(e["identifiant"], numero)
        limite = time.monotonic() + self.delai
        while time.monotonic() < limite:
            etat = await m.etat(numero)
            if etat.echoue: raise TravailRefuse(etat.raison or "Le moteur n’a pas produit le son.")
            if etat.fini:
                octets, media, reference = await m.sortie_de(numero, t["profil"])
                file.fichiers._poser(file._dossier(e["identifiant"]) / "resultat", octets)
                return {"empreinte": _hash(octets), "type_media": media, "sortie": reference}
            await asyncio.sleep(self.intervalle)
        raise SuiviLocalInterrompu("Le son est encore suivi chez ComfyUI. Son numéro est conservé ; reprendre ne crée pas de nouvel appel.")

    async def _executer(self, projet, identifiant, reprise):
        proprietaire = False
        try:
            with _verrou(self._dossier(projet, identifiant) / ".travail"):
                proprietaire = True
                t, file = self._brut(projet, identifiant), self.a.file_locale
                self._raccorder()
                e = file.preparer("audio:" + identifiant, nature="audio", moteur=t["moteur"], modele=t["demande"]["modele"],
                    projet=projet, acteur=t["acteur"], parametres={"travail": identifiant})
                t.update(etape_locale=e["identifiant"], etape="calcul"); self._garder(t)
                await file.lancer(e["identifiant"], reprise=reprise, acteur=t["acteur"])
                e = await file.attendre_fin(e["identifiant"])
                if e["etat"] != "termine":
                    t.update(etat="externe_inconnu" if e["etat"] == "externe_inconnu" else "annule" if e["etat"] == "annule" else "a_verifier", raison=e["raison"])
                    self._garder(t); return
                t["consommations_locales"] = [{"generation": identifiant, "modele": t["demande"]["modele"], "consomme": e["duree_s"] or 0, "unite": "secondes", "cout_usd": 0}]
                self._garder(t)  # Le calcul est acquis même si l’audio est invalide.
                octets = (file._dossier(e["identifiant"]) / "resultat").read_bytes()
                if _hash(octets) != e["resultat"]["empreinte"]: raise TravailRefuse("Le fichier sonore reçu a changé sur le disque.")
                son = self.a.sons.importer_octets(projet, octets, nom=t["demande"]["nom"] or "Bruitages · " + t["demande"]["prompt"][:60],
                    provenance={"travail": identifiant, "modele": t["demande"]["modele"], "workflow": t["profil"]["version"], "envoi": t["snapshot_audio"], "sortie": e["resultat"]["sortie"]}, cle="travail:" + identifiant)
                t.update(etat="termine" if son["pret"] else "a_verifier", etape="termine", son=son["identifiant"], reserve=None, raison=son.get("raison", ""))
                self._garder(t)
        except asyncio.CancelledError: raise
        except Exception as erreur:
            if proprietaire:
                t = self._brut(projet, identifiant); t.update(etat="a_verifier", raison=str(erreur)); self._garder(t)
