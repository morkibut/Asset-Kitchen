"""Sources sonores immuables, recettes révisées et écoute du rendu exporté."""
from __future__ import annotations

import base64
import hashlib
import io
import json
import time
import uuid
import wave
import zipfile
from pathlib import Path

from atelier.audio.traitement import VERSION, decoder, encoder, mesurer, onde, traiter
from atelier.depot.verrou import verrou
from atelier.domaine.son import RecetteSon, SonRefuse


def _json(objet):
    return json.dumps(objet, ensure_ascii=False, sort_keys=True, allow_nan=False).encode()


def _sha(octets):
    return hashlib.sha256(octets).hexdigest()


class ServiceSons:
    def __init__(self, atelier):
        self.a = atelier
        self.racine = atelier.fichiers.racine / "sons"

    def _dossier(self, projet, identifiant=None):
        if not any(p.identifiant == projet for p in self.a.bibliotheque.projets()):
            raise SonRefuse("Ce jeu n’existe pas dans l’atelier.")
        dossier = self.racine / _sha(projet.encode())[:32]
        if identifiant is not None:
            if not isinstance(identifiant, str) or len(identifiant) != 32 or any(c not in "0123456789abcdef" for c in identifiant):
                raise SonRefuse("Ce son n’existe pas dans ce jeu.")
            dossier /= identifiant
        return dossier

    def _poser(self, chemin, objet):
        self.a.fichiers._poser(chemin, _json(objet))

    @staticmethod
    def _lire(chemin, defaut=None):
        return json.loads(chemin.read_text(encoding="utf-8")) if chemin.exists() else defaut

    def _courant(self, projet, identifiant):
        objet = self._lire(self._dossier(projet, identifiant) / "son.json")
        if not objet:
            raise SonRefuse("Ce son n’a pas été conservé dans ce jeu.")
        return objet

    def lire(self, projet, identifiant, revision=None):
        dossier = self._dossier(projet, identifiant)
        courant = self._courant(projet, identifiant)
        if revision is not None and (isinstance(revision, bool) or not isinstance(revision, int) or revision < 1):
            raise SonRefuse("Choisissez une version conservée du son.")
        objet = courant if revision is None else self._lire(dossier / "revisions" / f"{revision}.json")
        if objet is None:
            raise SonRefuse("Cette version du son n’existe pas.")
        jugements = self._lire(dossier / "jugements.json", {})
        versions = [self._lire(p) for p in (dossier / "revisions").glob("*.json")]
        return {**objet, "revision_courante": courant["revision"],
            "jugement": jugements.get(str(objet["revision"]), "a-juger"),
            "versions": [{"revision": v["revision"], "cree_le": v["modifie_le"], "nom": v["nom"],
                "pret": v["pret"], "mesures": v["mesures"], "jugement": jugements.get(str(v["revision"]), "a-juger")}
                for v in sorted(versions, key=lambda v: v["revision"], reverse=True)]}

    def lister(self, projet):
        return sorted([self.lire(projet, p.parent.name) for p in self._dossier(projet).glob("*/son.json")],
            key=lambda s: s["modifie_le"], reverse=True)

    def source(self, projet, identifiant):
        son = self._courant(projet, identifiant)
        chemin = self._dossier(projet, identifiant) / son["source"]["fichier"]
        if not chemin.is_file() or _sha(chemin.read_bytes()) != son["source"]["empreinte"]:
            raise SonRefuse("La source conservée manque ou a été modifiée. Aucun fichier différent ne la remplace.")
        return chemin

    def _calculer(self, son, recette):
        signal, taux = decoder(self.source(son["projet"], son["identifiant"]))
        rendu, taux_sortie, mesures = traiter(signal, taux, recette)
        return rendu, taux_sortie, mesures, mesurer(signal, taux)

    def _enregistrer(self, son, recette, *, tolerant=False):
        dossier = self._dossier(son["projet"], son["identifiant"])
        son = {**son, "recette": recette.en_json(), "pipeline": VERSION, "modifie_le": time.time(),
            "mesures": None, "pret": False, "etat": "a_verifier", "raison": ""}
        try:
            signal, taux, mesures, mesures_source = self._calculer(son, recette)
            son["source"] = {**son["source"], "mesures": mesures_source}
            son["mesures"] = mesures
            son["raison"] = "Le rendu est silencieux. Vérifiez la source et la coupe." if mesures["silencieux"] else "Le rendu sature. Baissez le gain ou le niveau cible avant de le livrer." if mesures["ecretes"] else ""
            son["pret"] = not son["raison"]
            son["etat"] = "prete" if son["pret"] else "a_verifier"
            self._cache(son, signal, taux)
        except SonRefuse as erreur:
            if not tolerant:
                raise
            son["raison"] = erreur.raison
        self._poser(dossier / "revisions" / f"{son['revision']}.json", son)
        self._poser(dossier / "son.json", son)
        self.a.diffusion.publier("son", {"projet": son["projet"], "identifiant": son["identifiant"]})
        return self.lire(son["projet"], son["identifiant"])

    def importer_octets(self, projet, octets, *, nom="Son importé", provenance=None, cle=None):
        if not isinstance(octets, bytes) or len(octets) > 256 * 1024 * 1024:
            raise SonRefuse("Importez un fichier audio de 256 Mo au plus.")
        identifiant = _sha((projet + "\0" + cle).encode())[:32] if cle else uuid.uuid4().hex
        dossier = self._dossier(projet, identifiant)
        with verrou(dossier / ".verrou"):
            precedent = self._lire(dossier / "son.json")
            if precedent:
                if precedent["source"]["empreinte"] != _sha(octets):
                    raise SonRefuse("Ce travail a déjà acquis un autre son. Sa source ne peut pas être remplacée.")
                if precedent["etat"] != "a_analyser":
                    return self.lire(projet, identifiant)
                return self._enregistrer(precedent, RecetteSon(), tolerant=True)
            extension = Path(str(nom)).suffix.lower()
            if extension not in (".wav", ".ogg", ".mp3", ".flac", ".m4a"):
                extension = ".audio"
            objet = {"identifiant": identifiant, "projet": projet, "nom": str(nom).strip()[:200] or "Son importé",
                "revision": 1, "cree_le": time.time(), "modifie_le": time.time(), "etat": "a_analyser", "pret": False,
                "source": {"fichier": "source" + extension, "nom": str(nom), "empreinte": _sha(octets), "octets": len(octets)},
                "provenance": provenance or {"nature": "import"}, "recette": RecetteSon().en_json(), "mesures": None, "raison": "Analyse audio en attente."}
            # L’acquisition précède tout décodage : même un retour fournisseur
            # illisible reste acquis et ne déclenche jamais un second appel.
            self.a.fichiers._poser(dossier / objet["source"]["fichier"], octets)
            self._poser(dossier / "son.json", objet)
            return self._enregistrer(objet, RecetteSon(), tolerant=True)

    def regler(self, projet, identifiant, revision, recette, *, nom=None):
        regles = RecetteSon.depuis_json(recette)
        dossier = self._dossier(projet, identifiant)
        with verrou(dossier / ".verrou"):
            son = self._courant(projet, identifiant)
            if isinstance(revision, bool) or revision != son["revision"]:
                raise SonRefuse("Le son a changé dans une autre fenêtre. Rouvrez sa dernière version avant de conserver.")
            if nom is not None and (not isinstance(nom, str) or not nom.strip()):
                raise SonRefuse("Donnez un nom au son.")
            son = {**son, "revision": son["revision"] + 1, "nom": nom.strip()[:200] if nom else son["nom"]}
            return self._enregistrer(son, regles)

    def restaurer(self, projet, identifiant, revision, depuis):
        ancienne = self.lire(projet, identifiant, depuis)
        return self.regler(projet, identifiant, revision, ancienne["recette"], nom=ancienne["nom"])

    def juger(self, projet, identifiant, revision, jugement):
        if jugement not in ("a-juger", "retenue", "ecartee"):
            raise SonRefuse("Choisissez retenue, à juger ou écartée.")
        dossier = self._dossier(projet, identifiant)
        with verrou(dossier / ".verrou"):
            son = self.lire(projet, identifiant, revision)
            if jugement == "retenue" and not son["pret"]:
                raise SonRefuse("Corrigez les points signalés avant de retenir cette version.")
            etats = self._lire(dossier / "jugements.json", {})
            if jugement == "retenue":
                etats = {r: "a-juger" if j == "retenue" else j for r, j in etats.items()}
            etats[str(revision)] = jugement
            self._poser(dossier / "jugements.json", etats)
        return self.lire(projet, identifiant, revision)

    def _chemin_cache(self, son, brut=False):
        cle = _sha(_json({"source": son["source"]["empreinte"], "recette": None if brut else son["recette"], "pipeline": VERSION}))
        return self._dossier(son["projet"], son["identifiant"]) / "cache" / cle

    def _cache(self, son, signal, taux, brut=False):
        chemin = self._chemin_cache(son, brut)
        self.a.fichiers._poser(chemin.with_suffix(".wav"), encoder(signal, taux))
        self._poser(chemin.with_suffix(".json"), onde(signal, taux))
        return chemin

    def _assurer_cache(self, projet, identifiant, revision=None, brut=False):
        son = self.lire(projet, identifiant, revision)
        self.source(projet, identifiant)
        chemin = self._chemin_cache(son, brut)
        if not chemin.with_suffix(".wav").exists() or not chemin.with_suffix(".json").exists():
            if brut:
                signal, taux = decoder(self.source(projet, identifiant))
            else:
                signal, taux, _, _ = self._calculer(son, RecetteSon.depuis_json(son["recette"]))
            self._cache(son, signal, taux, brut)
        return chemin

    def rendu(self, projet, identifiant, revision=None, *, brut=False):
        return self._assurer_cache(projet, identifiant, revision, brut).with_suffix(".wav")

    def forme_onde(self, projet, identifiant, revision=None, *, brut=False):
        return self._lire(self._assurer_cache(projet, identifiant, revision, brut).with_suffix(".json"))

    def paquet(self, projet, identifiant, revision=None):
        son = self.lire(projet, identifiant, revision)
        if not son["pret"] or son["jugement"] == "ecartee":
            raise SonRefuse("Choisissez une version audible, sans saturation et non écartée avant de la livrer. " + son["raison"])
        wav = self.rendu(projet, identifiant, son["revision"]).read_bytes()
        with wave.open(io.BytesIO(wav), "rb") as audio:
            pcm = audio.readframes(audio.getnframes())
        boucle = son["mesures"]["boucle"]
        # PackedByteArray accepte le base64 natif de Godot. Les données sont
        # exactement le PCM du WAV écouté, avec les repères en échantillons.
        ressource = ('[gd_resource type="AudioStreamWAV" format=3]\n\n[resource]\nformat = 1\n'
            f'mix_rate = {son["mesures"]["taux"]}\nstereo = {str(son["mesures"]["canaux"] == 2).lower()}\n'
            f'loop_mode = {1 if boucle["active"] else 0}\nloop_begin = {boucle["debut"]}\nloop_end = {boucle["fin"]}\n'
            f'data = PackedByteArray("{base64.b64encode(pcm).decode()}")\n').encode()
        scene = b'[gd_scene load_steps=2 format=3]\n\n[ext_resource type="AudioStream" path="son.tres" id="Son"]\n\n[node name="Son" type="AudioStreamPlayer"]\nstream = ExtResource("Son")\n'
        manifeste = {"nature": "son", "nom": son["nom"], "son": identifiant, "version_son": son["revision"],
            "animations": [], "source": son["source"], "provenance": son["provenance"], "recette": son["recette"], "mesures": son["mesures"]}
        return manifeste, {"son.wav": wav, "son.tres": ressource, "son.tscn": scene, "composition.json": _json(manifeste)}

    def archive(self, projet, identifiant, revision=None):
        _, contenus = self.paquet(projet, identifiant, revision)
        tampon = io.BytesIO()
        with zipfile.ZipFile(tampon, "w", zipfile.ZIP_DEFLATED) as archive:
            for nom, octets in contenus.items():
                archive.writestr(nom, octets)
        return tampon.getvalue()

    def prevoir_livraison(self, projet, identifiant, revision=None):
        manifeste, contenus = self.paquet(projet, identifiant, revision)
        return self.a.livraison.preparer_paquet(projet, None, "son/" + identifiant, manifeste, contenus,
            scene="son.tscn", ressource="son.tres")
