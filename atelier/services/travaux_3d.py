"""Une étape 3D relue, suivie et copiée avant de passer à la suivante."""
from __future__ import annotations

import asyncio
import base64
import time
from uuid import UUID

from atelier.domaine.travail import TravailRefuse
from atelier.fournisseur.asset3d import AdaptateurAsset3D, Source3DRefusee, identifiant_externe, verifier_glb
from atelier.services.file_locale import AcceptationLocaleInconnue
from atelier.services.travaux import ServiceTravaux, _hash, _json, _verrou

NATURES = {"modele_3d": "modele3d", "rig": "rig", "rendu": "rendu3d"}


class ServiceTravaux3D(ServiceTravaux):
    def __init__(self, atelier):
        super().__init__(atelier)
        self._taches = atelier.travaux._taches
        atelier.travaux.inscrire_executant("3d", self._executer)
        for nature in NATURES.values():
            atelier.file_locale.inscrire_executeur(nature, self._calcul)
        # Raccorder les anciennes adresses ne soumet rien au redémarrage.
        for p in self.racine.glob("*/*/travail.json"):
            t = self._lire(p)
            if t and t.get("nature") == "3d": self._raccorder(t["adresse"])

    def _moteur(self, adresse):
        return AdaptateurAsset3D(adresse, self.a.sources_3d.transport)

    def _raccorder(self, adresse):
        cle = "asset3d:" + _hash(adresse.encode())[:16]
        async def observer():
            return await self._moteur(adresse).json("/api/atelier/occupation")
        self.a.file_locale.inscrire_moteur(cle, "asset3d · " + adresse, observer)
        return cle

    async def preparer(self, projet, corps, acteur="auteur"):
        self._projet(projet)
        if acteur not in ("auteur", "agent") or not isinstance(corps, dict):
            raise TravailRefuse("La demande 3D n’est pas valide.")
        inconnus = set(corps) - {"cle", "etape", "personnage", "personnage_externe", "reference_asset", "pose", "direction", "reglages", "cadence", "nom", "camera", "plage"}
        if inconnus:
            raise TravailRefuse("Réglages de demande inconnus : " + ", ".join(sorted(inconnus)))
        d = {k: corps.get(k) for k in ("cle", "etape", "personnage", "personnage_externe", "reference_asset", "pose", "direction")}
        d.update(reglages=corps.get("reglages", {}), cadence=corps.get("cadence", 8), nom=corps.get("nom", ""), livrer_provisoire=False)
        for cle in ("camera", "plage"):
            if corps.get(cle) is not None: d[cle] = corps[cle]
        if not isinstance(d["cle"], str) or not d["cle"].strip() or len(d["cle"]) > 200 or d["etape"] not in NATURES:
            raise TravailRefuse("Donnez une clé et choisissez modèle, squelette ou rendu.")
        if not isinstance(d["reglages"], dict) or isinstance(d["cadence"], bool) or not isinstance(d["cadence"], (float, int)) or not 0 < d["cadence"] <= 120:
            raise TravailRefuse("Les réglages du rendu ou sa cadence sont invalides.")
        self.a.montage._verifier_destination(projet, d["personnage"], d["pose"], d["direction"])
        moteur = self.a.sources_3d.moteur()
        empreinte = _hash(_json({"demande": d, "acteur": acteur, "adresse": moteur.adresse}))
        identifiant = _hash((projet + "\0" + d["cle"]).encode())[:32]
        dossier = self._dossier(projet, identifiant)
        avant = self._lire(dossier / "travail.json")
        if avant:
            if avant["empreinte"] != empreinte: raise TravailRefuse("Cette clé désigne déjà une autre étape 3D.")
            return self.lire(projet, identifiant)
        contrat = await moteur.json("/api/atelier/contract")
        if contrat.get("version") != 1 or d["etape"] not in contrat.get("etapes", []):
            raise TravailRefuse("Le pont asset3d par étapes doit être lancé et associé. L’import des rendus existants reste disponible.")
        envoi = {"cle": str(UUID(identifiant)), "etape": d["etape"], "reglages": d["reglages"], "personnage": d["personnage_externe"]}
        envoi.update({cle: d[cle] for cle in ("camera", "plage") if cle in d})
        refs = []
        if d["etape"] == "modele_3d":
            if d["personnage_externe"]: raise TravailRefuse("Un nouveau modèle part d’une image et crée une nouvelle source 3D.")
            asset = self.a.assets.lire(d["reference_asset"] or "")
            if not asset or asset.projet != projet: raise TravailRefuse("Choisissez une image de départ dans ce jeu.")
            octets, media = self.a.assets.octets(asset)
            envoi.update(photo_base64=base64.b64encode(octets).decode(), nom_photo="reference" + (".jpg" if media == "image/jpeg" else ".webp" if media == "image/webp" else ".png"))
            refs = [{"nom": "reference-0.png", "empreinte": _hash(octets), "url": f"/api/projects/{projet}/production-jobs/{identifiant}/references/0"}]
        else:
            identifiant_externe(d["personnage_externe"] or "")
        reponse = await moteur.demander("/api/atelier/stages/preview", methode="POST", json=envoi)
        apercu = reponse.json()
        if not apercu.get("prerequis", {}).get("disponible"):
            raise TravailRefuse(" · ".join(apercu.get("prerequis", {}).get("raisons", [])) or "Les prérequis 3D restent à compléter.")
        envoi["reglages"] = apercu["reglages"]
        for cle in ("camera", "plage"):
            if cle in d and apercu.get(cle) != d[cle]:
                raise TravailRefuse(f"Le pont n’a pas confirmé le réglage {cle}. Aucun calcul n’a été lancé.")
            if apercu.get(cle) is not None: envoi[cle] = apercu[cle]
        if apercu.get("empreinte_corrections"):
            envoi["empreinte_corrections"] = apercu["empreinte_corrections"]
        modele = "asset3d:" + str(envoi["reglages"].get("moteur_3d", d["etape"]))
        with _verrou(dossier / ".travail"):
            avant = self._lire(dossier / "travail.json")
            if avant:
                if avant["empreinte"] != empreinte: raise TravailRefuse("Cette clé désigne déjà une autre étape.")
                return self.lire(projet, identifiant)
            if refs: self.a.fichiers._poser(dossier / "reference-0.png", octets)
            t = {"nature": "3d", "identifiant": identifiant, "projet": projet, "cle": d["cle"], "acteur": acteur,
                "demande": d, "empreinte": empreinte, "adresse": moteur.adresse, "envoi_3d": envoi, "apercu_3d": apercu,
                "modele": modele, "cree_le": time.time(), "etat": "prepare", "etape": d["etape"], "references": refs,
                "generation_image": None, "clip": None, "reference_asset": d["reference_asset"], "bandes": [],
                "reserve": None, "appels_engages": 0, "demarrage_recu": False, "fichiers_3d": {},
                "annonce": {"appels": 1, "reservation_usd": 0, "methodes": [{"nature": "3d", "modele": modele, "locale": True, "payante": False}],
                    "mesures": [m for m in self.a.file_locale.mesures() if m["modele"] == modele], "limite": "Durée affichée seulement lorsqu’une mesure existe. Cette étape ne lance pas les suivantes."}}
            self._raccorder(moteur.adresse)
            self._garder(t)
        return self.lire(projet, identifiant)

    async def _calcul(self, e):
        file = self.a.file_locale
        t = self._brut(e["projet"], e["parametres"]["travail"])
        moteur = self._moteur(t["adresse"])
        numero = e["travail_externe"]
        if not numero:
            connu = await moteur.demander(f"/api/atelier/stages/by-key/{t['envoi_3d']['cle']}", facultatif=True)
            if connu is not None:
                numero = connu.json()["identifiant"]
            elif e["soumission_engagee"]:
                raise AcceptationLocaleInconnue("Le pont ne retrouve pas encore cet envoi. Vérifier son état avant toute nouvelle demande.")
            else:
                with _verrou(self._projet(t["projet"]) / ".budget"):
                    self._autoriser(t)
                    t["appels_engages"] = 1; self._garder(t)
                file.engager(e["identifiant"])
                try:
                    r = await moteur.demander("/api/atelier/stages", methode="POST", json=t["envoi_3d"])
                    numero = r.json()["identifiant"]
                except Exception as erreur:
                    if isinstance(erreur, Source3DRefusee) and erreur.statut_http in (400, 403, 404, 409, 422):
                        # Un refus explicite est une preuve de non-acceptation.
                        file.modifier(e["identifiant"], soumission_engagee=False)
                        raise TravailRefuse(str(erreur)) from erreur
                    raise AcceptationLocaleInconnue("La réponse du pont 3D a été perdue. La clé conservée permet de vérifier son acceptation.") from erreur
            file.connaitre_externe(e["identifiant"], numero)
        while True:
            resultat = await moteur.json(f"/api/essais/{identifiant_externe(numero)}")
            if resultat["etat"] == "termine": return resultat
            if resultat["etat"] in ("echec", "bloque"):
                raise TravailRefuse(resultat.get("message_echec") or "L’étape 3D demande une vérification dans le moteur.")
            await asyncio.sleep(1)

    async def _executer(self, projet, identifiant, reprise):
        proprietaire = False
        try:
            with _verrou(self._dossier(projet, identifiant) / ".travail"):
                proprietaire = True
                t = self._brut(projet, identifiant)
                file = self.a.file_locale
                e = file.preparer("3d:" + identifiant, nature=NATURES[t["etape"]], moteur=self._raccorder(t["adresse"]),
                    modele=t["modele"], projet=projet, acteur=t["acteur"], parametres={"travail": identifiant})
                t["etape_locale"] = e["identifiant"]; self._garder(t)
                await file.lancer(e["identifiant"], reprise=reprise, acteur=t["acteur"])
                e = await file.attendre_fin(e["identifiant"])
                if e["etat"] != "termine":
                    t.update(etat="externe_inconnu" if e["etat"] == "externe_inconnu" else "annule" if e["etat"] == "annule" else "a_verifier", raison=e["raison"])
                    self._garder(t); return
                t["resultat_3d"] = e["resultat"]
                t["consommations_locales"] = [{"generation": identifiant, "modele": t["modele"], "consomme": e["duree_s"] or 0, "unite": "secondes", "cout_usd": 0}]
                self._garder(t)  # Le calcul est acquis avant toute copie de fichier.
                moteur = self._moteur(t["adresse"])
                for nom in ("modele.glb", "rig.glb"):
                    r = await moteur.demander(f"/api/essais/{e['travail_externe']}/{nom}", facultatif=True)
                    if r is not None:
                        verifier_glb(r.content)
                        self.a.fichiers._poser(self._dossier(projet, identifiant) / nom, r.content)
                        t["fichiers_3d"][nom] = _hash(r.content)
                requis = "modele.glb" if t["etape"] == "modele_3d" else "rig.glb" if t["etape"] == "rig" else None
                if requis and requis not in t["fichiers_3d"]:
                    raise TravailRefuse("L’étape est calculée mais son fichier " + requis + " manque. Le calcul reste conservé ; reprendre retente sa copie.")
                if t["etape"] == "rendu":
                    s = await self.a.sources_3d.importer(projet, {**t["demande"], "personnage_externe": e["resultat"]["personnage"], "rendu": e["travail_externe"]}, acteur=t["acteur"], _moteur=moteur)
                    t.update(source_3d=s["identifiant"], bandes=s["bandes"])
                t.update(etat="termine", reserve=None, raison="")
                self._garder(t)
        except asyncio.CancelledError:
            raise
        except Exception as erreur:
            if proprietaire:
                t = self._brut(projet, identifiant)
                t.update(etat="a_verifier", raison=str(erreur)); self._garder(t)

    async def reconcilier(self, projet, identifiant):
        t = self._brut(projet, identifiant)
        if t.get("etat") != "externe_inconnu": return self.lire(projet, identifiant)
        r = await self._moteur(t["adresse"]).demander(f"/api/atelier/stages/by-key/{t['envoi_3d']['cle']}", facultatif=True)
        if r is None: raise TravailRefuse("Cette clé n’est pas retrouvée dans le pont. Aucun nouvel envoi n’a été fait.")
        e = self.a.file_locale.trouver("3d:" + identifiant)
        self.a.file_locale.connaitre_externe(e["identifiant"], r.json()["identifiant"])
        self.a.file_locale.modifier(e["identifiant"], etat="a_reprendre", raison="Identifiant externe retrouvé.")
        t.update(etat="a_reprendre", raison="Le pont a retrouvé l’étape. Reprendre permet de récupérer son résultat.")
        self._garder(t)
        return self.lire(projet, identifiant)

    def fichier(self, projet, identifiant, nom):
        t = self._brut(projet, identifiant)
        chemin = self._dossier(projet, identifiant) / nom
        if nom not in t["fichiers_3d"] or not chemin.is_file() or _hash(chemin.read_bytes()) != t["fichiers_3d"][nom]:
            raise TravailRefuse("Le fichier 3D copié manque ou a changé.")
        return chemin
