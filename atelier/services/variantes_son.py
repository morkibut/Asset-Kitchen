"""SN3 · Les jeux de variantes : des sons gardés ensemble, par référence.

Un fichier par jeu, sous `variantes_son/<jeu du projet>/<identifiant>.json`.
Le jeu ne lit les sons que par `atelier.sons.lire` : il n'en copie aucun, n'en
supprime aucun, et ne refuse aucun son pour une mesure (voir
`atelier.domaine.variantes_son`). La livraison (SN4) prend `sons_a_livrer`.
"""
from __future__ import annotations

import contextlib
import json
import time
import uuid

from atelier.audio.traitement import encoder_ogg
from atelier.depot.verrou import VerrouOccupe, verrou
from atelier.domaine.son import FAMILLES, RecetteSon, SonRefuse, recette_proposee
from atelier.domaine.travail import TravailRefuse
from atelier.domaine.variantes_son import (
    VariantesRefusees, famille_du_jeu, identifiant_valide, nom_valide, statut_membre)
from atelier.services.sons import _json_lisible, credit, fichier_import, nom_stable, params_ogg, params_wav, ressource_variantes, scene_son
from atelier.services.travaux import _hash, _json


class ServiceVariantesSon:
    def __init__(self, atelier):
        self.a = atelier
        self.racine = atelier.fichiers.racine / "variantes_son"

    # ── Le rangement ─────────────────────────────────────────────────────

    def _dossier(self, projet):
        if not any(p.identifiant == projet for p in self.a.bibliotheque.projets()):
            raise VariantesRefusees("Ce jeu n'existe pas dans l'atelier.")
        return self.racine / _hash(projet.encode())[:32]

    def _chemin(self, projet, jeu):
        return self._dossier(projet) / (identifiant_valide(jeu, "Ce jeu de variantes") + ".json")

    def _brut(self, projet, jeu):
        chemin = self._chemin(projet, jeu)
        if not chemin.exists():
            raise VariantesRefusees("Ce jeu de variantes n'existe pas dans ce jeu.")
        return json.loads(chemin.read_text(encoding="utf-8"))

    def _poser(self, objet):
        objet["modifie_le"] = time.time()
        self.a.fichiers._poser(self._chemin(objet["projet"], objet["identifiant"]), _json(objet))
        self.a.diffusion.publier("variantes_son", {"projet": objet["projet"], "identifiant": objet["identifiant"]})

    @contextlib.contextmanager
    def _verrou(self, projet):
        try:
            with verrou(self._dossier(projet) / ".verrou", attendre=5):
                yield
        except VerrouOccupe as e:  # pragma: no cover - le verrou attend
            raise VariantesRefusees("Ce jeu de variantes est modifié ailleurs. Relisez-le.") from e

    def _son_existe(self, projet, son):
        identifiant_valide(son)
        try:
            return self.a.sons.lire(projet, son)
        except SonRefuse as e:
            raise VariantesRefusees("Ce son n'existe pas dans ce jeu.") from e

    # ── Relire ───────────────────────────────────────────────────────────

    def _vue(self, objet):
        membres, signalements = [], []
        for m in objet["membres"]:
            try:
                son = self.a.sons.lire(objet["projet"], m["son"])
            except SonRefuse:
                son = None
            statut = statut_membre(son, objet["famille"])
            vu = {**m, **statut, "nom": son["nom"] if son else None, "revision": son["revision"] if son else None,
                  "famille": son.get("famille") if son else None, "pret": son["pret"] if son else False,
                  "raison": son.get("raison", "") if son else "", "jugement": son["jugement"] if son else None,
                  "mesures": son.get("mesures") if son else None}
            membres.append(vu)
            if statut["signal"]:
                signalements.append({"son": m["son"], "statut": statut["statut"], "signal": statut["signal"]})
        return {**objet, "membres": membres, "sons": [m["son"] for m in objet["membres"]],
                "a_livrer": [m["son"] for m in membres if m["a_livrer"]], "signalements": signalements,
                "vide": not membres}

    def bruts(self, projet):
        return [json.loads(p.read_text(encoding="utf-8")) for p in self._dossier(projet).glob("*.json")]

    def lire(self, projet, jeu):
        return self._vue(self._brut(projet, jeu))

    def lister(self, projet, son=None):
        """Tous les jeux du projet ; avec `son`, ceux qui le contiennent."""
        jeux = [j for j in self.bruts(projet) if son is None or any(m["son"] == son for m in j["membres"])]
        return [self._vue(j) for j in sorted(jeux, key=lambda j: j["cree_le"], reverse=True)]

    def sons_a_livrer(self, projet, jeu):
        """Pour la livraison (SN4) : les sons du jeu, dans son ordre, sauf les
        supprimés, les écartés, les illisibles et les silencieux. Un son
        saturé en fait partie : la mesure informe, l'auteur décide."""
        return self.lire(projet, jeu)["a_livrer"]

    # ── Créer, modifier, supprimer ───────────────────────────────────────

    def appliquer_reglages(self, projet, son, famille):
        """Les réglages que la famille propose (mono, niveau visé), posés dans
        une nouvelle version du son au geste « garder ». Un son qui les porte
        déjà n'en reçoit pas une de plus : garder, dégarder puis regarder ne
        fait pas une pile de versions identiques."""
        if not famille:
            return
        fiche = self.a.sons.lire(projet, son)
        propre = RecetteSon.depuis_json(fiche["recette"]).en_json()
        if fiche.get("famille") == famille and propre == recette_proposee(fiche["recette"], famille):
            return
        self.a.sons.classer(projet, son, fiche["revision"], famille, appliquer_reglages=True)

    @staticmethod
    def _drapeau(brut):
        appliquer = brut.get("appliquer_reglages", False)
        if not isinstance(appliquer, bool):
            raise VariantesRefusees("appliquer_reglages est activé ou désactivé.")
        return appliquer

    def creer(self, projet, brut):
        """`appliquer_reglages` (faux par défaut) pose aussi, sur chaque son,
        les réglages de la famille du jeu — le geste « garder » de l'écran."""
        if not isinstance(brut, dict) or set(brut) - {"nom", "sons", "famille", "serie", "cle", "appliquer_reglages"}:
            raise VariantesRefusees("Le jeu de variantes contient un réglage inconnu.")
        appliquer = self._drapeau(brut)
        nom = nom_valide(brut.get("nom"))
        sons = brut.get("sons")
        if not isinstance(sons, list) or not sons:
            raise VariantesRefusees("Un jeu de variantes commence avec au moins un son.")
        sons = list(dict.fromkeys(sons))
        lus = [self._son_existe(projet, s) for s in sons]
        serie = brut.get("serie")
        rangs = {}
        if serie is not None:
            try:
                origine = self.a.series_son.lire(projet, serie)
            except TravailRefuse as e:
                raise VariantesRefusees("Cette série n'existe pas dans ce jeu.") from e
            rangs = {t["son"]["identifiant"]: t["rang"] for t in origine["tirages"] if t["son"]}
        if "famille" in brut:
            famille = famille_du_jeu(brut["famille"])
        else:
            communes = {s.get("famille") for s in lus}
            famille = communes.pop() if len(communes) == 1 else None
        cle = brut.get("cle")
        if cle is not None and (not isinstance(cle, str) or not cle.strip() or len(cle) > 200):
            raise VariantesRefusees("La clé du jeu de variantes est un texte de 200 caractères au plus.")
        identifiant = _hash(("variantes\0" + projet + "\0" + cle).encode())[:32] if cle else uuid.uuid4().hex
        maintenant = time.time()
        objet = {"identifiant": identifiant, "projet": projet, "nom": nom, "famille": famille, "serie": serie,
                 "membres": [{"son": s, "ajoute_le": maintenant, "rang": rangs.get(s)} for s in sons],
                 "revision": 1, "cree_le": maintenant, "cle": cle}
        with self._verrou(projet):
            chemin = self._chemin(projet, identifiant)
            if chemin.exists():
                avant = json.loads(chemin.read_text(encoding="utf-8"))
                if (avant["nom"], avant["famille"], avant["serie"], [m["son"] for m in avant["membres"]]) != (nom, famille, serie, sons):
                    raise VariantesRefusees("Cette clé désigne déjà un autre jeu de variantes.")
            else:
                self._poser(objet)
        if appliquer:
            for son in sons:
                self.appliquer_reglages(projet, son, famille)
        return self.lire(projet, identifiant)

    def _changer(self, projet, jeu, changer):
        with self._verrou(projet):
            objet = self._brut(projet, jeu)
            if changer(objet) is False:
                return self._vue(objet)
            objet["revision"] += 1
            self._poser(objet)
        return self.lire(projet, jeu)

    def ajouter(self, projet, jeu, son, position=None, *, appliquer_reglages=False):
        """Un son de plus, à la fin ou à `position` (0 = en tête). Aucun
        refus pour une mesure : un son saturé entre comme les autres. Un son
        déjà dans le jeu n'y est pas mis deux fois. `appliquer_reglages` pose
        sur ce son les réglages de la famille du jeu, comme « garder »."""
        self._son_existe(projet, son)
        appliquer = self._drapeau({"appliquer_reglages": appliquer_reglages})
        if position is not None and (isinstance(position, bool) or not isinstance(position, int) or position < 0):
            raise VariantesRefusees("La place d'un son est un entier positif.")
        brut = self._brut(projet, jeu)
        serie = brut.get("serie")
        rang = self.a.series_son.rang_de(projet, serie, son) if serie else None

        def changer(objet):
            if any(m["son"] == son for m in objet["membres"]):
                return False
            membre = {"son": son, "ajoute_le": time.time(), "rang": rang}
            objet["membres"].insert(len(objet["membres"]) if position is None else position, membre)
        vue = self._changer(projet, jeu, changer)
        if appliquer and vue["famille"]:
            self.appliquer_reglages(projet, son, vue["famille"])
            vue = self.lire(projet, jeu)
        return vue

    def retirer(self, projet, jeu, son):
        """Retirer un son du jeu. Le son reste dans la galerie. Un son qui
        n'existe plus se retire aussi : c'est justement ce geste qu'on attend."""
        identifiant_valide(son)

        def changer(objet):
            if not any(m["son"] == son for m in objet["membres"]):
                raise VariantesRefusees("Ce son n'est pas dans ce jeu de variantes.")
            objet["membres"] = [m for m in objet["membres"] if m["son"] != son]
        return self._changer(projet, jeu, changer)

    def modifier(self, projet, jeu, brut):
        """Renommer, ou poser la famille (elle décide du format livré)."""
        if not isinstance(brut, dict) or not brut or set(brut) - {"nom", "famille"}:
            raise VariantesRefusees("Changez le nom ou la famille du jeu de variantes.")
        nom = nom_valide(brut["nom"]) if "nom" in brut else None
        famille = famille_du_jeu(brut["famille"]) if "famille" in brut else None

        def changer(objet):
            if nom is not None:
                objet["nom"] = nom
            if "famille" in brut:
                objet["famille"] = famille
        return self._changer(projet, jeu, changer)

    def renommer(self, projet, jeu, nom):
        return self.modifier(projet, jeu, {"nom": nom})

    def supprimer(self, projet, jeu):
        """Le jeu disparaît ; ses sons restent dans la galerie, tous."""
        with self._verrou(projet):
            objet = self._brut(projet, jeu)
            self._chemin(projet, jeu).unlink()
        self.a.diffusion.publier("variantes_son", {"projet": projet, "identifiant": jeu, "supprime": True})
        return {"supprime": jeu, "sons_gardes": [m["son"] for m in objet["membres"]]}

    # ── Livrer (SN4) ─────────────────────────────────────────────────────

    def prevoir_livraison(self, projet, jeu):
        """(Aperçu de livraison) : chaque son livrable du jeu comme dans le
        paquet v2 d'un son (fichier + `.import`), sous un nom stable numéroté
        sur deux chiffres (`sfx_pas_01.wav` …), et l'`AudioStreamRandomizer`
        de `ressource_variantes` qui les rassemble sous le nom du jeu, sans
        numéro (`sfx_pas.tres`) ; un `son.tscn` le joue, `credits.json` liste
        chaque son. La famille du jeu décide le format ; sans elle, rien ne
        dit s'il faut du WAV ou de l'OGG. N'écrit rien dans le jeu Godot."""
        objet = self.lire(projet, jeu)
        famille_cle = objet["famille"]
        if famille_cle is None:
            raise VariantesRefusees("Donnez une famille à ce jeu de variantes avant de le livrer : elle décide du format.")
        membres = objet["a_livrer"]
        if not membres:
            raisons = "; ".join(dict.fromkeys(s["signal"] for s in objet["signalements"] if s["signal"]))
            raise VariantesRefusees("Ce jeu de variantes ne contient aucun son livrable. " + (raisons or "Gardez-y au moins un son prêt."))
        famille = FAMILLES[famille_cle]
        base = nom_stable(famille_cle, objet["nom"])
        contenus, credits_sons, params_par_fichier, fichiers_audio = {}, [], {}, []
        for rang, identifiant in enumerate(membres, start=1):
            son = self.a.sons.lire(projet, identifiant)
            wav = self.a.sons.rendu(projet, identifiant, son["revision"]).read_bytes()
            boucle, taux = son["mesures"]["boucle"], son["mesures"]["taux"]
            nom_membre = f"{base}_{rang:02d}"
            if famille.format == "wav":
                fichier, audio, params = nom_membre + ".wav", wav, params_wav(boucle)
            else:
                fichier = nom_membre + ".ogg"
                audio = encoder_ogg(wav, famille.qualite_ogg, fin_echantillon=boucle["fin"] if boucle["active"] else None)
                fin = boucle["fin"] if boucle["active"] else son["mesures"]["echantillons"]
                params = params_ogg(boucle, taux, fin / taux, son["provenance"])
            contenus[fichier] = audio
            params_par_fichier[fichier] = params
            fichiers_audio.append(fichier)
            credits_sons.append(credit(son, fichier))
        ressource = base + ".tres"
        contenus[ressource] = ressource_variantes(fichiers_audio)
        contenus["son.tscn"] = scene_son(ressource, famille.bus)
        credits = {"atelier": "Asset Kitchen", "sons": credits_sons}
        contenus["credits.json"] = _json_lisible(credits)
        manifeste = {"nature": "audio", "nom": objet["nom"], "jeu": objet["identifiant"], "version_jeu": objet["revision"],
            "famille": famille_cle, "format_audio": famille.format, "bus": famille.bus, "ressource": ressource,
            "sons": membres, "signalements": objet["signalements"], "credits": credits_sons}
        contenus["composition.json"] = _json(manifeste)
        # Le `.import` de chaque fichier nomme son propre chemin (uid, path,
        # deps) : comme pour un son seul (SN4), il se compose une fois le
        # dossier de la révision connu, pas avant.
        return self.a.livraison.preparer_paquet(projet, None, "variantes_son/" + objet["identifiant"], manifeste, contenus,
            scene="son.tscn", ressource=ressource, scene_stable="son.tscn", noeud_stable="Son",
            completer=lambda dossier: {f + ".import": fichier_import(f, famille.format, params_par_fichier[f], dossier)
                for f in fichiers_audio})
