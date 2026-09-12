"""AU17 : des choix de calques figés, combinables sans nouvelle fabrication.

Chaque révision conserve ses pixels et ses réglages. Le jugement courant d'un
calque n'est consulté qu'au choix explicite ou à l'actualisation d'une tenue.
"""
from __future__ import annotations

import copy
import hashlib
import re
import time
import uuid
from pathlib import Path

from atelier.domaine import aseprite
from atelier.domaine.calques_cibles import CibleCalque
from atelier.domaine.tenue import TenueRefusee, normaliser
from atelier.image.calques_cibles import rgba
from atelier.image.tenue import preparer_couches, composer_couches
from atelier.services.calques_cibles import empreinte, id_prise
from atelier.services.livraison import _json, _lire, _poser, _verrou


class ServiceTenues:
    def __init__(self, atelier):
        self.atelier = atelier
        self.calques = atelier.calques_cibles

    def _racine(self, projet, personnage):
        self.atelier.production.personnage(projet, personnage)
        racine = self.atelier.fichiers.projets.resolve()
        dossier = (racine / projet / "tenues" / personnage).resolve()
        if not dossier.is_relative_to(racine):
            raise TenueRefusee("La tenue doit rester dans les données du personnage.")
        return dossier

    def _dossier(self, projet, personnage, identifiant):
        if not re.fullmatch(r"[a-f0-9]{32}", identifiant):
            raise TenueRefusee("Cette tenue n'existe pas.")
        return self._racine(projet, personnage) / identifiant

    def _brut(self, projet, personnage, identifiant, revision=None):
        dossier = self._dossier(projet, personnage, identifiant)
        if revision is not None and (isinstance(revision, bool) or not isinstance(revision, int) or revision < 1):
            raise TenueRefusee("Cette révision de tenue n'existe pas.")
        chemin = dossier / "tenue.json" if revision is None else dossier / "revisions" / f"{revision}.json"
        objet = _lire(chemin)
        if objet is None:
            raise TenueRefusee("Cette tenue ou sa révision n'existe pas.")
        return objet

    def _blob(self, dossier: Path, contenu: bytes) -> str:
        identifiant = hashlib.sha256(contenu).hexdigest()
        chemin = dossier / "octets" / identifiant
        if not chemin.exists():
            _poser(chemin, contenu)
        return identifiant

    def _octets(self, objet, identifiant):
        if not re.fullmatch(r"[a-f0-9]{64}", identifiant):
            raise TenueRefusee("L'empreinte d'une image conservée est invalide.")
        chemin = self._dossier(objet["projet"], objet["personnage"], objet["identifiant"]) / "octets" / identifiant
        if not chemin.is_file() or hashlib.sha256(contenu := chemin.read_bytes()).hexdigest() != identifiant:
            raise TenueRefusee("Une image conservée de la tenue manque ou a changé. L'aperçu ne peut pas la remplacer en silence.")
        return contenu

    def lister(self, projet, personnage):
        return [self.lire(projet, personnage, p.parent.name) for p in sorted(self._racine(projet, personnage).glob("*/tenue.json"), key=lambda p: p.stat().st_mtime, reverse=True)]

    def creer(self, projet, personnage, demande):
        demande = normaliser(demande)
        identifiant = uuid.uuid4().hex
        with _verrou(self._racine(projet, personnage) / ".verrou"):
            objet = self._construire(projet, personnage, identifiant, demande)
            self._garder(objet)
        return self.lire(projet, personnage, identifiant)

    def regler(self, projet, personnage, identifiant, revision, demande, *, actualiser=False):
        demande = normaliser(demande)
        with _verrou(self._racine(projet, personnage) / ".verrou"):
            ancienne = self._brut(projet, personnage, identifiant)
            if ancienne["revision"] != revision:
                raise TenueRefusee("Cette tenue a changé dans une autre fenêtre. Relisez-la avant de garder vos choix.")
            objet = self._construire(projet, personnage, identifiant, demande, ancienne=None if actualiser else ancienne)
            objet.update(revision=revision + 1, cree_le=ancienne["cree_le"])
            self._garder(objet)
        return self.lire(projet, personnage, identifiant)

    def actualiser(self, projet, personnage, identifiant, revision):
        ancienne = self._brut(projet, personnage, identifiant)
        demande = {**ancienne["demande"], "choix": {}}
        return self.regler(projet, personnage, identifiant, revision, demande, actualiser=True)

    def restaurer(self, projet, personnage, identifiant, revision, depuis):
        with _verrou(self._racine(projet, personnage) / ".verrou"):
            presente = self._brut(projet, personnage, identifiant)
            if presente["revision"] != revision:
                raise TenueRefusee("La tenue courante a changé. Relisez-la avant de restaurer une révision.")
            ancienne = self._brut(projet, personnage, identifiant, depuis)
            ancienne.update(revision=revision + 1, modifie_le=time.time(), restauree_de=depuis)
            self._garder(ancienne)
        return self.lire(projet, personnage, identifiant)

    def _garder(self, objet):
        dossier = self._dossier(objet["projet"], objet["personnage"], objet["identifiant"])
        # Les octets et la révision complète précèdent le pointeur courant.
        _poser(dossier / "revisions" / f"{objet['revision']}.json", _json(objet))
        _poser(dossier / "tenue.json", _json(objet))

    def _construire(self, projet, personnage, identifiant, demande, ancienne=None):
        dossier = self._dossier(projet, personnage, identifiant)
        emplois = []
        for lien in demande["emplois"]:
            porteur, piece, emploi = self.calques._emploi(projet, lien["piece"], lien["emploi"])
            if porteur.identifiant != personnage:
                raise TenueRefusee("Cet emploi appartient à un autre personnage. Créez son adaptation pour ce héros.")
            emplois.append({**lien, "nom": piece.nom})
        sorties, cases = [], set()
        for resultat in demande["resultats"]:
            cle = resultat["nature"] + ":" + resultat["identifiant"]
            avant = next((s for s in (ancienne or {}).get("sorties", []) if s["cle"] == cle), None)
            if avant:
                sortie = copy.deepcopy(avant)
                sortie["boucle"] = resultat["boucle"]
            else:
                sortie = self._sortie(projet, personnage, resultat)
                for frame in sortie["frames"]:
                    octets, base = self.calques._base_personnage(projet, personnage, CibleCalque.depuis_json(frame["cible"]), identifier=True)
                    frame.update(base=base, pixels=self._blob(dossier, octets), calques=[])
            logique = (sortie["nature"], sortie["pose"], sortie["direction"])
            if logique in cases:
                raise TenueRefusee("Choisissez une seule version par mouvement et direction pour cette tenue.")
            cases.add(logique)
            for frame in sortie["frames"]:
                frame["cle"] = empreinte(frame["cible"])
                precedents = {c["piece"]: c for c in frame["calques"]}
                frame["calques"] = []
                for emploi in emplois:
                    explicite = demande["choix"].get(empreinte(frame["cible"]), {}).get(emploi["piece"])
                    precedent = precedents.get(emploi["piece"])
                    if precedent and precedent["emploi"] == emploi["emploi"] and (explicite is None or explicite == precedent.get("variante")):
                        frame["calques"].append(copy.deepcopy(precedent))
                    else:
                        frame["calques"].append(self._calque(projet, emploi, frame, dossier, explicite))
            sorties.append(sortie)
        pivot = demande["pivot"] or (ancienne or {}).get("pivot") or sorties[0]["frames"][0]["base"]["repere"]
        return {"format": 1, "identifiant": identifiant, "projet": projet, "personnage": personnage,
                "nom": demande["nom"], "revision": 1, "cree_le": time.time(), "modifie_le": time.time(),
                "demande": demande, "emplois": emplois, "sorties": sorties, "pivot": pivot}

    def _sortie(self, projet, personnage, resultat, *, identifier=True):
        identifiant = resultat["identifiant"]
        if resultat["nature"] == "image":
            image = self.atelier.assets.lire(identifiant)
            if not image or image.projet != projet or image.personnage != personnage or image.piece or not image.pose or image.supprime:
                raise TenueRefusee("Choisissez une image fixe nue de ce personnage.")
            frames = [{"cible": CibleCalque("image", identifiant).en_json()}]
            titre, pose, direction, cadence, sens = image.pose, image.pose, image.direction or "", 1, "boucle"
        else:
            bande = self.atelier.montage.bande(identifiant)
            if bande.projet != projet or bande.personnage != personnage or bande.piece or bande.supprime or not bande.pose or not bande.prises:
                raise TenueRefusee("Choisissez une animation nue et non vide de ce personnage.")
            if identifier:
                bande = self.atelier.montage.identifier_prises(identifiant)
            frames = [{"cible": CibleCalque("frame", identifiant, id_prise(bande, p, i)).en_json()} for i, p in enumerate(bande.prises)]
            titre, pose, direction, cadence, sens = bande.nom, bande.pose, bande.direction or "", bande.cadence, bande.sens
        return {"cle": resultat["nature"] + ":" + identifiant, "resultat": identifiant, "nature": resultat["nature"],
                "titre": titre, "pose": pose, "direction": direction, "cadence": cadence, "sens": sens,
                "boucle": resultat["boucle"], "ordre": aseprite.ordre_des_images(len(frames), sens), "frames": frames}

    def _calque(self, projet, emploi, frame, dossier, explicite):
        piece, lien = emploi["piece"], emploi["emploi"]
        identifiant = explicite or self.calques._choix(projet, piece, lien).get(empreinte(frame["cible"]))
        if identifiant is None:
            return {"piece": piece, "emploi": lien, "variante": None, "raison": "Aucun calque retenu pour cette cible exacte."}
        variante = self.calques.lire(projet, piece, lien, identifiant)
        if variante["cible"] != frame["cible"] or variante["role"] != "calque":
            raise TenueRefusee("La variante doit être un calque de cette pose, direction et occurrence de frame.")
        pixels = (self.calques._chemin(projet, piece, lien, identifiant) / "calque.png").read_bytes()
        raison = variante["raison"] or ("Ce calque doit encore être vérifié." if not variante.get("validee") else "")
        if variante["base"]["empreinte"] != frame["base"]["empreinte"]:
            raison = "Ce calque a été vérifié sur une autre version du corps. Actualisez la tenue explicitement."
        return {"piece": piece, "emploi": lien, "variante": identifiant, "revision": variante["revision"],
                "placement": copy.deepcopy(variante["placement"]), "masques": copy.deepcopy(variante["masques"]),
                "pixels": self._blob(dossier, pixels), "base": variante["base"]["empreinte"],
                "raison": raison, "source": variante.get("source"), "validee": bool(variante.get("validee"))}

    def lire(self, projet, personnage, identifiant, revision=None):
        objet = self._brut(projet, personnage, identifiant, revision)
        actifs = {e["piece"] for e in objet["emplois"] if e["actif"]}
        difficultes, total = [], 0
        for sortie in objet["sorties"]:
            raison_sortie = ""
            try:
                actuelle = self._sortie(projet, personnage, {"nature": sortie["nature"], "identifiant": sortie["resultat"], "boucle": sortie["boucle"]}, identifier=False)
                if (actuelle["cadence"], actuelle["sens"], [f["cible"] for f in actuelle["frames"]]) != (sortie["cadence"], sortie["sens"], [f["cible"] for f in sortie["frames"]]):
                    raison_sortie = "Le montage ou sa cadence a changé ; la tenue garde sa version précédente."
            except Exception as erreur:
                raison_sortie = str(erreur)
            sortie["a_revoir"] = raison_sortie
            for rang, frame in enumerate(sortie["frames"]):
                total += 1
                raison = raison_sortie
                try:
                    _, base = self.calques._base_personnage(projet, personnage, CibleCalque.depuis_json(frame["cible"]))
                    if base["empreinte"] != frame["base"]["empreinte"]:
                        raison = "Le corps, son placement ou son repère a changé depuis cette tenue."
                except Exception as erreur:
                    raison = str(erreur)
                frame["a_revoir"] = raison
                if raison:
                    difficultes.append({"sortie": sortie["cle"], "frame": rang, "piece": None, "raison": raison})
                for calque in frame["calques"]:
                    probleme = calque["raison"]
                    try:
                        porteur, _, _ = self.calques._emploi(projet, calque["piece"], calque["emploi"])
                        if porteur.identifiant != personnage:
                            probleme = "Cet emploi ne correspond plus au personnage."
                    except Exception as erreur:
                        probleme = str(erreur)
                    calque["a_revoir"] = probleme
                    if probleme:
                        difficultes.append({"sortie": sortie["cle"], "frame": rang, "piece": calque["piece"], "raison": probleme})
        objet["couverture"] = {"images": total, "difficultes": difficultes,
            "prete": not any(d["piece"] is None or d["piece"] in actifs for d in difficultes),
            "toutes_couches_pretes": not difficultes}
        objet["revisions"] = sorted(int(p.stem) for p in (self._dossier(projet, personnage, identifiant) / "revisions").glob("*.json"))
        return objet

    def _pixels(self, objet, sortie, rang, priorites=None):
        if isinstance(rang, bool) or not 0 <= rang < len(sortie["frames"]):
            raise TenueRefusee("Cette frame n'existe pas dans la tenue.")
        frame = sortie["frames"][rang]
        base = rgba(self._octets(objet, frame["pixels"]))
        choisies = {e["piece"]: e["priorite"] for e in objet["emplois"]}
        if priorites is not None:
            if not isinstance(priorites, dict) or not set(priorites) <= set(choisies) or any(isinstance(v, bool) or not isinstance(v, int) or abs(v) > 1000 for v in priorites.values()):
                raise TenueRefusee("Les priorités d'aperçu doivent correspondre aux pièces de cette tenue.")
            choisies.update(priorites)
        calques = [{**c, "pixels": rgba(self._octets(objet, c["pixels"])), "priorite": choisies[c["piece"]]} for c in frame["calques"] if c.get("pixels")]
        return base, preparer_couches(base, calques)

    def apercu(self, projet, personnage, identifiant, sortie, rang=0, actifs=None, revision=None, priorites=None):
        objet = self._brut(projet, personnage, identifiant, revision)
        choix = next((s for s in objet["sorties"] if s["cle"] == sortie), None)
        if choix is None:
            raise TenueRefusee("Cette pose ou animation n'est pas dans la tenue.")
        actives = self._actifs(objet, actifs)
        return composer_couches(*self._pixels(objet, choix, rang, priorites), actives)

    @staticmethod
    def _actifs(objet, actifs):
        connus = {e["piece"] for e in objet["emplois"]}
        if actifs is None:
            return {e["piece"] for e in objet["emplois"] if e["actif"]}
        if not isinstance(actifs, list) or any(not isinstance(v, str) for v in actifs) or not set(actifs) <= connus:
            raise TenueRefusee("Cette combinaison contient une pièce absente de la tenue.")
        return set(actifs)

    def paquet(self, projet, personnage, identifiant, mode="couches", revision=None):
        from atelier.services.export_tenues import paquet
        return paquet(self, projet, personnage, identifiant, mode, revision)

    def archive(self, projet, personnage, identifiant, mode="couches", revision=None):
        from atelier.services.export_tenues import archive
        return archive(*self.paquet(projet, personnage, identifiant, mode, revision))

    def prevoir_livraison(self, projet, personnage, identifiant, mode="couches", revision=None):
        manifeste, fichiers = self.paquet(projet, personnage, identifiant, mode, revision)
        return self.atelier.livraison.preparer_paquet(projet, personnage,
            f"tenue/{personnage}/{identifiant}/{mode}", manifeste, fichiers,
            scene="tenue.tscn", sprite_frames="animations.tres")
