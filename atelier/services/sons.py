"""Sources sonores immuables, recettes révisées et écoute du rendu exporté."""
from __future__ import annotations

import base64
import datetime
import hashlib
import io
import json
import re
import time
import unicodedata
import uuid
import wave
import zipfile
from pathlib import Path

import numpy as np

from atelier.audio.texte import MESURE_GABARIT, duree_en_mesures
from atelier.audio.traitement import VERSION, decoder, encoder, encoder_ogg, mesurer, onde, traiter
from atelier.depot.verrou import verrou
from atelier.domaine.son import FAMILLES, RecetteSon, SonRefuse, famille_valide, recette_proposee


def _json(objet):
    return json.dumps(objet, ensure_ascii=False, sort_keys=True, allow_nan=False).encode()


def _sha(octets):
    return hashlib.sha256(octets).hexdigest()


def _pret_recalcule(objet):
    """`pret`, `raison` et `avertissements` recalculés depuis les mesures
    conservées, jamais fiés à ce qu'un pipeline plus ancien a écrit sur le
    disque — l'ancien blocage par la seule saturation, avant la correction du
    18 septembre 2026, laissait `pret=False` sur des sons déjà enregistrés.
    Rien n'est réécrit : seule la lecture les rétablit."""
    mesures = objet.get("mesures")
    if not mesures:
        return objet
    silencieux = bool(mesures.get("silencieux"))
    sature = bool(mesures.get("ecretes"))
    raison = "Le rendu est silencieux. Vérifiez la source et la coupe." if silencieux else ""
    avertissements = ["Le rendu sature. Baissez le gain ou le niveau cible pour l'éviter."] if sature else []
    pret = not raison
    if objet.get("pret") == pret and objet.get("raison", "") == raison and objet.get("avertissements", []) == avertissements:
        return objet
    etat = objet.get("etat")
    if etat in ("prete", "a_verifier"):
        etat = "prete" if pret else "a_verifier"
    return {**objet, "pret": pret, "raison": raison, "avertissements": avertissements, "etat": etat}


def limite_mesure(son):
    """SN9 · Où couper la boucle d'une musique ou d'un jingle sur une
    frontière de mesure : la durée du nombre de mesures **demandées** (sans
    la marge ajoutée pour que la boucle se coupe proprement — comme
    `beat_count`, services/sons.py `params_ogg`), au tempo et à la mesure de
    l'envoi. `None` si l'un des deux manque : la boucle reste alors un geste
    libre de l'auteur, comme avant SN9 (bruitages, ambiances, chansons)."""
    if son.get("famille") not in ("musique", "jingle"):
        return None
    provenance = son.get("provenance") or {}
    envoi = provenance.get("envoi") if isinstance(provenance.get("envoi"), dict) else {}
    composition = provenance.get("composition") if isinstance(provenance.get("composition"), dict) else {}
    mesures = composition.get("mesures") if isinstance(composition, dict) else None
    demandees = _nombre_positif((mesures or {}).get("demandees")) if isinstance(mesures, dict) else None
    tempo = _nombre_positif(envoi.get("tempo"))
    if not demandees or not tempo:
        return None
    temps = _nombre_positif(envoi.get("mesure"))
    bar_beats = int(temps) if temps and 2 <= int(temps) <= 32 else MESURE_GABARIT
    return duree_en_mesures(round(demandees), tempo, bar_beats, marge=0)


def recette_proposee_son(son, famille):
    """`atelier.domaine.son.recette_proposee`, complétée (SN9) pour une
    musique ou un jingle dont le nombre de mesures et le tempo sont connus :
    la boucle se propose de 0 à la frontière de mesure — jamais imposée,
    « Garder » ou « Appliquer les réglages de la famille » la prend comme le
    reste (SN3, SN4)."""
    if not famille:
        return None
    proposee = recette_proposee(son["recette"], famille)
    # `famille` est celle qu'on propose, pas forcément celle déjà posée sur le
    # son (le geste « classer » l'appelle avant d'écrire la nouvelle famille).
    limite = limite_mesure({**son, "famille": famille})
    if limite:
        duree = son["mesures"]["duree"] if son.get("mesures") else None
        fin = min(limite, duree) if duree is not None else limite
        if fin > 0:
            proposee = {**proposee, "boucle": True, "boucle_debut": 0, "boucle_fin": round(fin, 3)}
    return proposee


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
        courant = _pret_recalcule(self._courant(projet, identifiant))
        if revision is not None and (isinstance(revision, bool) or not isinstance(revision, int) or revision < 1):
            raise SonRefuse("Choisissez une version conservée du son.")
        objet = courant if revision is None else self._lire(dossier / "revisions" / f"{revision}.json")
        if objet is None:
            raise SonRefuse("Cette version du son n’existe pas.")
        if revision is not None:
            objet = _pret_recalcule(objet)
        jugements = self._lire(dossier / "jugements.json", {})
        versions = [_pret_recalcule(self._lire(p)) for p in (dossier / "revisions").glob("*.json")]
        famille = objet.get("famille")
        return {**objet, "famille": famille, "revision_courante": courant["revision"],
            "jugement": jugements.get(str(objet["revision"]), "a-juger"),
            # Proposée, jamais imposée : l'écran ou l'agent la prend par un geste.
            "recette_proposee": recette_proposee_son(objet, famille) if famille else None,
            "versions": [{"revision": v["revision"], "cree_le": v["modifie_le"], "nom": v["nom"], "famille": v.get("famille"),
                "pret": v["pret"], "mesures": v["mesures"], "jugement": jugements.get(str(v["revision"]), "a-juger"),
                "avertissements": v.get("avertissements", [])}
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
            "mesures": None, "pret": False, "etat": "a_verifier", "raison": "", "avertissements": []}
        try:
            signal, taux, mesures, mesures_source = self._calculer(son, recette)
            son["source"] = {**son["source"], "mesures": mesures_source}
            son["mesures"] = mesures
            # Seul ce qui ne s'entend pas bloque la livraison (silence) ; un
            # rendu saturé s'entend et se livre, mais le dit (règle du produit,
            # SN3 : « les mesures informent, elles ne refusent jamais »).
            son["raison"] = "Le rendu est silencieux. Vérifiez la source et la coupe." if mesures["silencieux"] else ""
            son["avertissements"] = ["Le rendu sature. Baissez le gain ou le niveau cible pour l'éviter."] if mesures["ecretes"] else []
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

    def importer_octets(self, projet, octets, *, nom="Son importé", provenance=None, cle=None, recette=None):
        """`recette`, si donnée, remplace `RecetteSon()` pour la première
        version : c'est la coupe (`fin`) que la relecture propose quand un
        bruitage a été demandé sous la durée minimale réelle du moteur — le
        son se calcule à cette durée, la coupe vers la durée voulue est déjà
        posée, visible et modifiable dans ses versions."""
        if not isinstance(octets, bytes) or len(octets) > 256 * 1024 * 1024:
            raise SonRefuse("Importez un fichier audio de 256 Mo au plus.")
        recette = recette if recette is not None else RecetteSon()
        identifiant = _sha((projet + "\0" + cle).encode())[:32] if cle else uuid.uuid4().hex
        dossier = self._dossier(projet, identifiant)
        with verrou(dossier / ".verrou"):
            precedent = self._lire(dossier / "son.json")
            if precedent:
                if precedent["source"]["empreinte"] != _sha(octets):
                    raise SonRefuse("Ce travail a déjà acquis un autre son. Sa source ne peut pas être remplacée.")
                if precedent["etat"] != "a_analyser":
                    return self.lire(projet, identifiant)
                return self._enregistrer(precedent, recette, tolerant=True)
            extension = Path(str(nom)).suffix.lower()
            if extension not in (".wav", ".ogg", ".mp3", ".flac", ".m4a"):
                extension = ".audio"
            # La famille d'un son généré vient de sa demande (SN2). Une famille
            # inconnue n'empêche pas d'acquérir un calcul déjà fait : le son
            # reste sans famille, et l'auteur la pose ensuite.
            # Un son sfxr (SN8) est un son d'interface et rétro s'il ne dit rien.
            famille = (provenance or {}).get("famille") or ("interface" if (provenance or {}).get("nature") == "sfxr" else None)
            objet = {"identifiant": identifiant, "projet": projet, "nom": str(nom).strip()[:200] or "Son importé",
                "famille": famille if famille in FAMILLES else None,
                "revision": 1, "cree_le": time.time(), "modifie_le": time.time(), "etat": "a_analyser", "pret": False,
                "source": {"fichier": "source" + extension, "nom": str(nom), "empreinte": _sha(octets), "octets": len(octets)},
                "provenance": provenance or {"nature": "import"}, "recette": recette.en_json(), "mesures": None, "raison": "Analyse audio en attente."}
            # L’acquisition précède tout décodage : même un retour fournisseur
            # illisible reste acquis et ne déclenche jamais un second appel.
            self.a.fichiers._poser(dossier / objet["source"]["fichier"], octets)
            self._poser(dossier / "son.json", objet)
            return self._enregistrer(objet, recette, tolerant=True)

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

    def classer(self, projet, identifiant, revision, famille, *, appliquer_reglages=False):
        """Pose la famille dans une nouvelle version (elle décide de la
        livraison). `appliquer_reglages` prend aussi les réglages proposés
        par la famille ; sinon la recette ne bouge pas."""
        famille_valide(famille)
        dossier = self._dossier(projet, identifiant)
        with verrou(dossier / ".verrou"):
            son = self._courant(projet, identifiant)
            if isinstance(revision, bool) or revision != son["revision"]:
                raise SonRefuse("Le son a changé dans une autre fenêtre. Rouvrez sa dernière version avant de conserver.")
            recette = recette_proposee_son(son, famille) if appliquer_reglages and famille else son["recette"]
            son = {**son, "revision": son["revision"] + 1, "famille": famille}
            return self._enregistrer(son, RecetteSon.depuis_json(recette))

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

    def raccord(self, projet, identifiant, revision=None):
        # Les deux secondes autour du point de boucle (fin -> début), pour
        # l'écouter en boucle côté client : ce que Godot fait entendre juste
        # avant et juste après le saut, dans l'ordre où il le joue.
        son = self.lire(projet, identifiant, revision)
        boucle = son["mesures"]["boucle"] if son["mesures"] else None
        if not boucle or not boucle["active"]:
            raise SonRefuse("Ce son n’a pas de boucle active à écouter.")
        signal, taux = decoder(self.source(projet, identifiant))
        rendu, taux_sortie, _ = traiter(signal, taux, RecetteSon.depuis_json(son["recette"]))
        debut, fin = boucle["debut"], boucle["fin"]
        n = min(fin - debut, round(1 * taux_sortie))
        extrait = np.concatenate([rendu[fin - n:fin], rendu[debut:debut + n]])
        return encoder(extrait, taux_sortie)

    def paquet(self, projet, identifiant, revision=None, *, dossier_res=None):
        """(manifeste, contenus) d'une version. Un son sans famille garde le
        paquet d'AU14 (PCM dans le `.tres`) ; un son qui a une famille livre
        le fichier lui-même, son `.import`, sa scène et ses crédits (SN4).
        `dossier_res` nomme le dossier final (`res://…`) : sans lui, le
        `.import` prend sa forme courte, que Godot complète à l'import."""
        son = self.lire(projet, identifiant, revision)
        if not son["pret"] or son["jugement"] == "ecartee":
            raise SonRefuse("Choisissez une version audible et non écartée avant de la livrer. " + son["raison"])
        wav = self.rendu(projet, identifiant, son["revision"]).read_bytes()
        if son["famille"] is not None:
            return self._paquet_v2(son, wav, dossier_res)
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

    def _paquet_v2(self, son, wav, dossier_res):
        famille = FAMILLES[son["famille"]]
        fichier, audio, params = fichier_de_famille(son, wav, son["famille"], nom_stable(son["famille"], son["nom"]))
        credits = {"atelier": "Asset Kitchen", "sons": [credit(son, fichier)]}
        scene = scene_son(fichier, famille.bus)
        manifeste = {"nature": "son", "nom": son["nom"], "son": son["identifiant"], "version_son": son["revision"],
            "animations": [], "source": son["source"], "provenance": son["provenance"], "recette": son["recette"],
            "mesures": son["mesures"], "format_paquet": 2, "famille": son["famille"], "fichier": fichier,
            "format_audio": famille.format, "bus": famille.bus, "import": dict(params), "credits": credits["sons"]}
        return manifeste, {fichier: audio, fichier + ".import": fichier_import(fichier, famille.format, params, dossier_res),
            "son.tscn": scene, "credits.json": _json_lisible(credits), "composition.json": _json(manifeste)}

    def archive(self, projet, identifiant, revision=None):
        _, contenus = self.paquet(projet, identifiant, revision)
        tampon = io.BytesIO()
        with zipfile.ZipFile(tampon, "w", zipfile.ZIP_DEFLATED) as archive:
            for nom, octets in contenus.items():
                archive.writestr(nom, octets)
        return tampon.getvalue()

    def prevoir_livraison(self, projet, identifiant, revision=None):
        manifeste, contenus = self.paquet(projet, identifiant, revision)
        if manifeste.get("format_paquet") != 2:
            return self.a.livraison.preparer_paquet(projet, None, "son/" + identifiant, manifeste, contenus,
                scene="son.tscn", ressource="son.tres", scene_stable="son.tscn", noeud_stable="Son")
        # Le `.import` nomme son propre chemin (uid, path, deps) pour que Godot
        # le réécrive à l'identique : il se compose une fois le dossier connu.
        nom_import = manifeste["fichier"] + ".import"
        params = manifeste["import"]
        sans_import = {n: o for n, o in contenus.items() if n != nom_import}
        return self.a.livraison.preparer_paquet(projet, None, "son/" + identifiant, manifeste, sans_import,
            scene="son.tscn", ressource=manifeste["fichier"], scene_stable="son.tscn", noeud_stable="Son",
            completer=lambda dossier: {nom_import: fichier_import(manifeste["fichier"], manifeste["format_audio"], params, dossier)})


# ── Ce que Godot 4.7 lit (SN4) ──────────────────────────────────────────

_PREFIXES = tuple(f.prefixe for f in FAMILLES.values())
_EXTENSIONS_AUDIO = (".wav", ".ogg", ".mp3", ".flac", ".m4a", ".audio")


def _json_lisible(objet):
    return json.dumps(objet, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False).encode()


def nom_stable(famille, nom):
    """`sfx_` + le nom du son en snake_case ASCII : « Épée qui frappe.wav »
    devient `sfx_epee_qui_frappe`. Un préfixe déjà écrit n'est pas doublé."""
    texte = str(nom)
    if texte.lower().endswith(_EXTENSIONS_AUDIO):
        texte = texte.rsplit(".", 1)[0]
    ascii_ = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode().lower()
    corps = re.sub(r"[^a-z0-9]+", "_", ascii_).strip("_")
    for prefixe in _PREFIXES:
        if corps.startswith(prefixe):
            corps = corps[len(prefixe):]
            break
    return FAMILLES[famille].prefixe + (corps[:60].strip("_") or "son")


def _flottant(valeur):
    # Godot réécrit un flottant sur 16 chiffres significatifs (constaté en
    # 4.7.2 : 0.049977324263038545 → 0.04997732426303854). À la microseconde
    # près, la forme la plus courte est la même des deux côtés.
    return repr(float(round(valeur, 6)))


def params_wav(boucle):
    """Les options de l'importeur `wav`, dans l'ordre où Godot 4.7 les écrit.
    `edit/normalize` reste décoché (il pousserait la crête à 0 dB) ;
    `compress/mode=0` (PCM) : le jeu joue ce que l'auteur a écouté."""
    active = boucle["active"]
    return [("force/8_bit", "false"), ("force/mono", "false"), ("force/max_rate", "false"),
        ("force/max_rate_hz", "44100"), ("edit/trim", "false"), ("edit/normalize", "false"),
        ("edit/loop_mode", "2" if active else "1"),
        ("edit/loop_begin", str(int(boucle["debut"]) if active else 0)),
        ("edit/loop_end", str(int(boucle["fin"]) if active else -1)), ("compress/mode", "0")]


def fichier_de_famille(son, wav, famille_cle, base):
    """(nom du fichier, octets, options de l'importeur) d'un son livré par sa
    famille sous le nom `base` : WAV tel quel, ou OGG coupé à la fin de sa
    boucle. Le chemin commun d'un son seul, d'un jeu de variantes (SN4) et
    des sons d'un sujet (SN6)."""
    famille = FAMILLES[famille_cle]
    boucle = son["mesures"]["boucle"]
    taux = son["mesures"]["taux"]
    if famille.format == "wav":
        return base + ".wav", wav, params_wav(boucle)
    # Un OGG boucle de `loop_offset` jusqu'à sa fin : la fin de boucle
    # devient la fin du fichier ; ce qui suit ne s'entendait jamais.
    audio = encoder_ogg(wav, famille.qualite_ogg, fin_echantillon=boucle["fin"] if boucle["active"] else None)
    fin = boucle["fin"] if boucle["active"] else son["mesures"]["echantillons"]
    return base + ".ogg", audio, params_ogg(boucle, taux, fin / taux, son["provenance"])


def _nombre_positif(valeur):
    if isinstance(valeur, bool):
        return None
    try:
        nombre = float(str(valeur).split("/")[0])
    except (TypeError, ValueError):
        return None
    return nombre if nombre > 0 and nombre == nombre and nombre != float("inf") else None


def params_ogg(boucle, taux, duree, provenance):
    """Les options de l'importeur `oggvorbisstr`. Le tempo et la mesure
    viennent de la demande (ACE-Step : `tempo`, `mesure`) ; absents, `bpm`
    reste à 0 et `bar_beats` au défaut de Godot (4). Quand la composition a
    gardé un nombre de mesures demandé (SN2, sans sa mesure de marge),
    `beat_count` se calcule dessus plutôt que sur la durée du fichier — la
    marge ajoutée pour couper la boucle proprement ne doit pas s'y voir."""
    provenance = provenance or {}
    envoi = provenance.get("envoi") if isinstance(provenance.get("envoi"), dict) else {}
    composition = provenance.get("composition") if isinstance(provenance.get("composition"), dict) else {}
    bpm = _nombre_positif(envoi.get("tempo", provenance.get("tempo")))
    mesure = _nombre_positif(envoi.get("mesure", provenance.get("mesure")))
    bar_beats = int(mesure) if mesure and 2 <= int(mesure) <= 32 else 4
    mesures = composition.get("mesures") if isinstance(composition, dict) else None
    demandees = _nombre_positif((mesures or {}).get("demandees")) if isinstance(mesures, dict) else None
    if demandees:
        beat_count = round(demandees) * bar_beats
    else:
        beat_count = round(duree * bpm / 60) if bpm else 0
    return [("loop", "true" if boucle["active"] else "false"),
        ("loop_offset", _flottant(boucle["debut"] / taux if boucle["active"] else 0)),
        ("bpm", _flottant(bpm or 0)), ("beat_count", str(beat_count)), ("bar_beats", str(bar_beats))]


# Base 34 de Godot (ResourceUID::id_to_text : 'z' - 'a' lettres, puis
# '9' - '0' chiffres) : a à y, puis 0 à 8. Constaté en 4.7.2 : un « z » ou un
# « 9 » écrits par l'atelier ressortaient autrement après l'import.
_UID = "abcdefghijklmnopqrstuvwxy012345678"


def uid_godot(chemin_res):
    """Un uid stable tiré du chemin, écrit comme Godot l'écrit : il le garde."""
    n = int(hashlib.sha256(chemin_res.encode()).hexdigest(), 16) % ((1 << 62) - 1) + 1
    texte = ""
    while n:
        n, reste = divmod(n, len(_UID))
        texte = _UID[reste] + texte
    return "uid://" + texte


def fichier_import(fichier, format_, params, dossier_res=None):
    """Le `.import` à côté du son. Avec `dossier_res`, la forme exacte que
    `godot --headless --import` réécrit (4.7.2 : octet pour octet), pour que
    le fichier du jeu reste celui que l'atelier possède. Sans, la forme
    courte (importeur, type, options), que Godot complète."""
    importer, type_, extension = ("wav", "AudioStreamWAV", "sample") if format_ == "wav" \
        else ("oggvorbisstr", "AudioStreamOggVorbis", "oggvorbisstr")
    lignes = "".join(f"{cle}={valeur}\n" for cle, valeur in (params.items() if isinstance(params, dict) else params))
    if dossier_res is None:
        return f'[remap]\n\nimporter="{importer}"\ntype="{type_}"\n\n[params]\n\n{lignes}'.encode()
    source = f"{dossier_res}/{fichier}"
    importe = f"res://.godot/imported/{fichier}-{hashlib.md5(source.encode()).hexdigest()}.{extension}"
    return (f'[remap]\n\nimporter="{importer}"\ntype="{type_}"\nuid="{uid_godot(source)}"\npath="{importe}"\n\n'
        f'[deps]\n\nsource_file="{source}"\ndest_files=["{importe}"]\n\n[params]\n\n{lignes}').encode()


def scene_son(fichier, bus):
    return ('[gd_scene load_steps=2 format=3]\n\n'
        f'[ext_resource type="AudioStream" path={json.dumps(fichier)} id="Son"]\n\n'
        '[node name="Son" type="AudioStreamPlayer"]\nstream = ExtResource("Son")\n'
        f'bus = &{json.dumps(bus)}\n').encode()


LICENCES = {
    "stability": {"nom": "Stability AI Community License",
        "resume": "Gratuit tant que le vendeur fait moins d'un million de dollars de chiffre d'affaires par an ; "
                  "les sons appartiennent à celui qui les fabrique.",
        "adresse": "https://stability.ai/community-license-agreement"},
    "ace-step": {"nom": "MIT", "resume": "Libre ; usage commercial des sorties permis.",
        "adresse": "https://github.com/ace-step/ACE-Step-1.5"},
    "yue2": {"nom": "YuE2 — CC BY-NC 4.0, avec la permission du 16 septembre 2026",
        "resume": "Non commercial, sauf pour une personne qui crée en son nom propre : elle peut vendre ce qu'elle "
                  "génère (permission ajoutée le 16 septembre 2026). Une société doit demander une licence.",
        "date_du_texte": "2026-09-16", "adresse": "https://huggingface.co/Comfy-Org/YuE2"},
    "sfxr": {"nom": "Portage de jsfxr (chr15m), domaine public (Unlicense)",
        "resume": "Son calculé par un portage de jsfxr (chr15m), domaine public (Unlicense) ; la bibliothèque "
                  "pyfxr qui l'exécute est sous licence BSD.",
        "adresse": "https://github.com/chr15m/jsfxr"},
    None: {"nom": "inconnue", "resume": "Son importé : l'atelier ne connaît pas sa licence."},
}
_LICENCE_DU_MOTEUR = {"sa3-small-sfx": "stability", "sa3-medium": "stability", "sa-open-1": "stability",
    "ace-step-15-turbo": "ace-step", "ace-step-15-reprise": "ace-step", "ace-step-15-base": "ace-step",
    "ace-step-15-xl-turbo": "ace-step", "yue2-int8": "yue2",
    # Une chanson jouée depuis sa partition (SN9, `yue2-partition-jouee`) reste du YuE2 :
    # même licence que le tirage direct (`yue2-int8`), sinon « à préciser » dans credits.json.
    "yue2-partition-jouee": "yue2", "sfxr": "sfxr"}


def moteur_du_son(provenance):
    provenance = provenance or {}
    if provenance.get("nature") == "sfxr":
        return "sfxr"
    modele = provenance.get("modele")
    if isinstance(modele, str) and "@" in modele:
        return modele.removeprefix("ComfyUI:").split("@")[0]
    return None


def credit(son, fichier):
    provenance = son.get("provenance") or {}
    envoi = provenance.get("envoi") if isinstance(provenance.get("envoi"), dict) else {}
    composition = provenance.get("composition") if isinstance(provenance.get("composition"), dict) else {}
    moteur = moteur_du_son(provenance)
    licence = LICENCES[_LICENCE_DU_MOTEUR.get(moteur)] if moteur in _LICENCE_DU_MOTEUR else \
        {"nom": "à préciser", "resume": f"Moteur « {moteur} » : sa licence n'est pas connue de l'atelier."} if moteur else LICENCES[None]
    # D'où viennent le tempo, la tonalité et la mesure (demande, univers ou
    # gabarit) : un jingle calé sur l'univers le montre ici (SN9), pas
    # seulement la valeur envoyée au moteur.
    parametres = composition.get("parametres") if isinstance(composition, dict) else None
    return {"fichier": fichier, "son": son["identifiant"], "version": son["revision"], "nom": son["nom"],
        "famille": son.get("famille"), "moteur": moteur, "modele": provenance.get("modele"),
        "workflow": provenance.get("workflow"), "licence": licence,
        # Le texte qui est parti : celui de l'envoi, sinon celui composé (SN2).
        "graine": envoi.get("graine", provenance.get("graine")), "texte": envoi.get("prompt") or composition.get("texte"),
        "texte_negatif": envoi.get("prompt_negatif") or composition.get("texte_negatif") or None,
        "paroles": envoi.get("paroles"),
        "tempo": (parametres or {}).get("tempo"), "tonalite": (parametres or {}).get("tonalite"),
        "mesure": (parametres or {}).get("mesure"),
        "date": datetime.datetime.fromtimestamp(son["cree_le"], datetime.timezone.utc).isoformat(timespec="seconds")}


def ressource_variantes(chemins_res, *, random_pitch=1.03):
    """Un `AudioStreamRandomizer` (`.tres`) qui liste des sons déjà livrés
    (`res://…`), sans rejouer deux fois de suite la même variante
    (`playback_mode = 0`), avec une légère variation de hauteur (1,03 ≈ un
    demi-ton). Le jeu de variantes de SN3 le livre (`ServiceVariantesSon.
    prevoir_livraison`), comme les variantes sfxr de SN8."""
    if not chemins_res:
        raise SonRefuse("Un jeu de variantes contient au moins un son.")
    externes = "".join(f'[ext_resource type="AudioStream" path={json.dumps(c)} id="{i + 1}"]\n'
        for i, c in enumerate(chemins_res))
    flux = "".join(f'stream_{i}/stream = ExtResource("{i + 1}")\nstream_{i}/weight = 1.0\n'
        for i in range(len(chemins_res)))
    return (f'[gd_resource type="AudioStreamRandomizer" load_steps={len(chemins_res) + 1} format=3]\n\n{externes}\n'
        f'[resource]\nplayback_mode = 0\nrandom_pitch = {random_pitch!r}\nstreams_count = {len(chemins_res)}\n{flux}').encode()
