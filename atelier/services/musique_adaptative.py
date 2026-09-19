# -*- coding: utf-8 -*-
"""SN10 · La musique qui s'adapte : persistance et livraison.

Un fichier par objet, sous `musique_adaptative/<jeu du projet>/<identifiant>.
json` — même rangement que `ServiceVariantesSon` (SN3), pour la même raison :
l'objet ne copie aucun son, il les référence par identifiant. La livraison
compose deux ressources Godot possibles (couches → `AudioStreamSynchronized`,
morceaux et transitions → `AudioStreamInteractive`), toutes deux tenues par
`atelier.services.livraison.preparer_paquet` — le même geste que pour un son
seul (SN4) ou un jeu de variantes (SN3).
"""
from __future__ import annotations

import contextlib
import json
import time
import uuid

from atelier.depot.verrou import VerrouOccupe, verrou
from atelier.domaine.musique_adaptative import (
    ARRIVEES, CLIP_ANY, DEPARTS, FAMILLES_MUSICALES, FONDUS, MusiqueAdaptativeRefusee,
    attributs_musicaux, ecarts_musicaux, objet_valide, slug)
from atelier.domaine.son import FAMILLES, SonRefuse
from atelier.services.sons import _json_lisible, credit, fichier_de_famille, fichier_import, nom_stable
from atelier.services.travaux import _hash, _json


class ServiceMusiqueAdaptative:
    def __init__(self, atelier):
        self.a = atelier
        self.racine = atelier.fichiers.racine / "musique_adaptative"

    # ── Le rangement ─────────────────────────────────────────────────────

    def _dossier(self, projet):
        if not any(p.identifiant == projet for p in self.a.bibliotheque.projets()):
            raise MusiqueAdaptativeRefusee("Ce jeu n'existe pas dans l'atelier.")
        return self.racine / _hash(projet.encode())[:32]

    def _identifiant_valide(self, identifiant):
        if not isinstance(identifiant, str) or len(identifiant) != 32 or any(c not in "0123456789abcdef" for c in identifiant):
            raise MusiqueAdaptativeRefusee("Cette musique adaptative n'existe pas dans ce jeu.")
        return identifiant

    def _chemin(self, projet, identifiant):
        return self._dossier(projet) / (self._identifiant_valide(identifiant) + ".json")

    def _brut(self, projet, identifiant):
        chemin = self._chemin(projet, identifiant)
        if not chemin.exists():
            raise MusiqueAdaptativeRefusee("Cette musique adaptative n'existe pas dans ce jeu.")
        return json.loads(chemin.read_text(encoding="utf-8"))

    def _poser(self, objet):
        objet["modifie_le"] = time.time()
        self.a.fichiers._poser(self._chemin(objet["projet"], objet["identifiant"]), _json(objet))
        self.a.diffusion.publier("musique_adaptative", {"projet": objet["projet"], "identifiant": objet["identifiant"]})

    @contextlib.contextmanager
    def _verrou(self, projet):
        try:
            with verrou(self._dossier(projet) / ".verrou", attendre=5):
                yield
        except VerrouOccupe as e:  # pragma: no cover - le verrou attend
            raise MusiqueAdaptativeRefusee("Cette musique adaptative est modifiée ailleurs. Relisez-la.") from e

    def _son(self, projet, identifiant):
        """Le son référencé, ou `None` s'il n'existe plus (jamais un refus :
        SN3, un membre disparu se signale, il ne fait pas tomber la lecture)."""
        try:
            return self.a.sons.lire(projet, identifiant)
        except SonRefuse:
            return None

    # ── Relire ───────────────────────────────────────────────────────────

    def _vue_son(self, son):
        if son is None:
            return {"existe": False, "nom": None, "famille": None, "pret": False,
                     "signal": "Ce son n'existe plus dans la galerie.", "attributs": {}}
        signal = ""
        if son["jugement"] == "ecartee":
            signal = "Cette version a été écartée : elle ne partira pas."
        elif not son["pret"]:
            signal = son.get("raison") or "Ce son n'a pas pu être lu."
        elif son.get("mesures", {}).get("ecretes"):
            signal = "Ce son sature : il reste utilisable, à vous de décider."
        if son.get("famille") not in FAMILLES_MUSICALES:
            famille = son.get("famille")
            plus = f"Ce son est de la famille « {famille} »" if famille else "Ce son n'a pas encore de famille"
            signal = (signal + " " if signal else "") + f"{plus} ; une musique adaptative attend musique, jingle ou chanson."
        return {"existe": True, "nom": son["nom"], "famille": son.get("famille"),
                # Sans famille musicale, on ne sait pas le livrer (`fichier_de_
                # famille` attend musique/jingle/chanson) : signalé plus haut,
                # exclu ici de ce qui part — jamais un refus à la création.
                "pret": son["pret"] and son["jugement"] != "ecartee" and son.get("famille") in FAMILLES_MUSICALES,
                "signal": signal, "attributs": attributs_musicaux(son)}

    def _vue(self, objet):
        couches, morceaux = [], []
        entrees = []
        for c in objet["couches"]:
            son = self._son(objet["projet"], c["son"])
            vue = self._vue_son(son)
            couches.append({**c, **vue})
            if son is not None:
                entrees.append((f"la couche « {c['cle']} »", vue["attributs"]))
        for m in objet["morceaux"]:
            son = self._son(objet["projet"], m["son"])
            vue = self._vue_son(son)
            morceaux.append({**m, **vue})
            if son is not None:
                entrees.append((f"le morceau « {m['cle']} »", vue["attributs"]))
        a_livrer_couches = [c for c in couches if c["existe"] and c["pret"]]
        a_livrer_morceaux = [m for m in morceaux if m["existe"] and m["pret"]]
        return {**objet, "couches": couches, "morceaux": morceaux,
                "ecarts": ecarts_musicaux(entrees),
                "livrable": bool(a_livrer_couches) or bool(a_livrer_morceaux),
                "couches_a_livrer": [c["cle"] for c in a_livrer_couches],
                "morceaux_a_livrer": [m["cle"] for m in a_livrer_morceaux]}

    def bruts(self, projet):
        return [json.loads(p.read_text(encoding="utf-8")) for p in self._dossier(projet).glob("*.json")]

    def lire(self, projet, identifiant):
        return self._vue(self._brut(projet, identifiant))

    def lister(self, projet):
        return [self._vue(o) for o in sorted(self.bruts(projet), key=lambda o: o["cree_le"], reverse=True)]

    # ── Créer, modifier, supprimer ───────────────────────────────────────

    def _existe_a_la_creation(self, projet, identifiant, quoi):
        """À la création, une clé mal recopiée doit se voir tout de suite —
        contrairement à un son retiré *ensuite* de la galerie (`_son`,
        toléré partout ailleurs) : c'est la même distinction que `variantes_
        son._son_existe`."""
        try:
            self.a.sons.lire(projet, identifiant)
        except SonRefuse as e:
            raise MusiqueAdaptativeRefusee(f"{quoi} n'existe pas dans ce jeu.") from e

    def creer(self, projet, brut):
        forme = objet_valide(brut)
        for c in forme["couches"]:
            self._existe_a_la_creation(projet, c.son, f"Le son de la couche « {c.cle} »")
        for m in forme["morceaux"]:
            self._existe_a_la_creation(projet, m.son, f"Le son du morceau « {m.cle} »")
        identifiant = uuid.uuid4().hex
        maintenant = time.time()
        objet = {"identifiant": identifiant, "projet": projet, "nom": forme["nom"],
                 "couches": [{"cle": c.cle, "son": c.son, "volume_db": c.volume_db} for c in forme["couches"]],
                 "morceaux": [{"cle": m.cle, "son": m.son, "nom": m.nom} for m in forme["morceaux"]],
                 "transitions": [{"de": t.de, "vers": t.vers, "depart": t.depart, "arrivee": t.arrivee,
                                   "fondu": t.fondu, "fondu_temps": t.fondu_temps} for t in forme["transitions"]],
                 "revision": 1, "cree_le": maintenant}
        with self._verrou(projet):
            self._poser(objet)
        return self.lire(projet, identifiant)

    def _changer(self, projet, identifiant, changer):
        with self._verrou(projet):
            objet = self._brut(projet, identifiant)
            changer(objet)
            objet["revision"] += 1
            self._poser(objet)
        return self.lire(projet, identifiant)

    def modifier(self, projet, identifiant, brut):
        """Remplace en bloc ce que `brut` porte parmi nom, couches, morceaux,
        transitions ; ce qui n'y figure pas garde sa valeur. Un remplacement
        complet, jamais un ajout au coup par coup : les transitions désignent
        des morceaux par clé, et les deux doivent rester cohérents ensemble."""
        if not isinstance(brut, dict) or not brut or set(brut) - {"nom", "couches", "morceaux", "transitions"}:
            raise MusiqueAdaptativeRefusee("Changez le nom, les couches, les morceaux ou les transitions.")

        def changer(objet):
            fusionne = {"nom": objet["nom"], "couches": objet["couches"], "morceaux": objet["morceaux"],
                        "transitions": objet["transitions"], **brut}
            forme = objet_valide(fusionne)
            if "couches" in brut:
                for c in forme["couches"]:
                    self._existe_a_la_creation(projet, c.son, f"Le son de la couche « {c.cle} »")
            if "morceaux" in brut:
                for m in forme["morceaux"]:
                    self._existe_a_la_creation(projet, m.son, f"Le son du morceau « {m.cle} »")
            objet["nom"] = forme["nom"]
            objet["couches"] = [{"cle": c.cle, "son": c.son, "volume_db": c.volume_db} for c in forme["couches"]]
            objet["morceaux"] = [{"cle": m.cle, "son": m.son, "nom": m.nom} for m in forme["morceaux"]]
            objet["transitions"] = [{"de": t.de, "vers": t.vers, "depart": t.depart, "arrivee": t.arrivee,
                                      "fondu": t.fondu, "fondu_temps": t.fondu_temps} for t in forme["transitions"]]
        return self._changer(projet, identifiant, changer)

    def supprimer(self, projet, identifiant):
        """L'objet disparaît ; les sons qu'il référençait restent dans la galerie."""
        with self._verrou(projet):
            self._brut(projet, identifiant)
            self._chemin(projet, identifiant).unlink()
        self.a.diffusion.publier("musique_adaptative", {"projet": projet, "identifiant": identifiant, "supprime": True})
        return {"supprime": identifiant}

    # ── Livrer ───────────────────────────────────────────────────────────

    def _fichier_son(self, projet, identifiant, base):
        son = self.a.sons.lire(projet, identifiant)
        if not son["pret"] or son["jugement"] == "ecartee":
            raise MusiqueAdaptativeRefusee(f"« {son['nom']} » n'est pas une version audible et gardée : réglez-la avant de livrer.")
        if son.get("famille") not in FAMILLES_MUSICALES:
            raise MusiqueAdaptativeRefusee(
                f"« {son['nom']} » n'a pas de famille musicale (musique, jingle, chanson) : posez-la avant de livrer.")
        wav = self.a.sons.rendu(projet, identifiant, son["revision"]).read_bytes()
        fichier, audio, params = fichier_de_famille(son, wav, son["famille"], base)
        return son, fichier, audio, params

    def prevoir_livraison(self, projet, identifiant):
        """Compose ce qui part au jeu, sans rien écrire dans le jeu Godot :
        un `<nom>_couches.tres` (`AudioStreamSynchronized`) si l'objet a des
        couches, un `<nom>_morceaux.tres` (`AudioStreamInteractive`, noms de
        clips stables et transitions) si l'objet a des morceaux, une seule
        scène `son.tscn` (un `AudioStreamPlayer` par ressource, sur le bus
        Music), et `credits.json`. Refuse avec sa raison si rien n'est
        livrable ; un écart musical déjà signalé (`lire`) ne bloque jamais."""
        objet = self.lire(projet, identifiant)
        base = nom_stable("musique", objet["nom"])[len(FAMILLES["musique"].prefixe):] or "musique_adaptative"
        contenus, params_par_fichier, credits_sons = {}, {}, []
        noeuds, ext_ids = [], {}
        next_id = [1]

        def ext(fichier):
            if fichier not in ext_ids:
                ext_ids[fichier] = next_id[0]
                next_id[0] += 1
            return ext_ids[fichier]

        ressource_principale = None
        if objet["couches_a_livrer"]:
            couches_res, streams = [], []
            for c in objet["couches"]:
                if c["cle"] not in objet["couches_a_livrer"]:
                    continue
                son, fichier, audio, params = self._fichier_son(projet, c["son"], f"{FAMILLES['musique'].prefixe}{base}_{slug(c['cle'])}")
                contenus[fichier], params_par_fichier[fichier] = audio, params
                credits_sons.append(credit(son, fichier))
                streams.append((fichier, c["volume_db"]))
            fichier_couches = f"{base}_couches.tres"
            contenus[fichier_couches] = ressource_couches(streams)
            noeuds.append(("Couches", fichier_couches))
            ressource_principale = ressource_principale or fichier_couches
        if objet["morceaux_a_livrer"]:
            clips, index = [], {}
            for m in objet["morceaux"]:
                if m["cle"] not in objet["morceaux_a_livrer"]:
                    continue
                son, fichier, audio, params = self._fichier_son(projet, m["son"], f"{FAMILLES['musique'].prefixe}{base}_{slug(m['cle'])}")
                contenus[fichier], params_par_fichier[fichier] = audio, params
                credits_sons.append(credit(son, fichier))
                index[m["cle"]] = len(clips)
                clips.append((m["cle"], m.get("nom") or m["cle"], fichier))
            transitions_livrees = []
            for t in objet["transitions"]:
                if (t["de"] != "*" and t["de"] not in index) or (t["vers"] != "*" and t["vers"] not in index):
                    continue  # un morceau écarté de la livraison efface ses transitions, sans bloquer les autres
                de = CLIP_ANY if t["de"] == "*" else index[t["de"]]
                vers = CLIP_ANY if t["vers"] == "*" else index[t["vers"]]
                transitions_livrees.append((de, vers, t["depart"], t["arrivee"], t["fondu"], t["fondu_temps"]))
            fichier_morceaux = f"{base}_morceaux.tres"
            contenus[fichier_morceaux] = ressource_morceaux(clips, transitions_livrees)
            noeuds.append(("Morceaux", fichier_morceaux))
            ressource_principale = ressource_principale or fichier_morceaux
        if not contenus:
            raise MusiqueAdaptativeRefusee(
                "Cette musique adaptative ne contient aucun son livrable. " + "; ".join(objet["ecarts"] or ["Gardez-y au moins un son prêt."]))

        contenus["son.tscn"] = scene_musique_adaptative(noeuds)
        credits = {"atelier": "Asset Kitchen", "sons": credits_sons}
        contenus["credits.json"] = _json_lisible(credits)
        manifeste = {"nature": "audio", "nom": objet["nom"], "musique_adaptative": objet["identifiant"],
            "version": objet["revision"], "couches": objet["couches_a_livrer"], "morceaux": objet["morceaux_a_livrer"],
            "ecarts": objet["ecarts"], "credits": credits_sons}
        contenus["composition.json"] = _json(manifeste)
        return self.a.livraison.preparer_paquet(projet, None, "musique_adaptative/" + objet["identifiant"], manifeste, contenus,
            scene="son.tscn", ressource=ressource_principale, scene_stable="son.tscn", noeud_stable="MusiqueAdaptative",
            completer=lambda dossier: {f + ".import": fichier_import(f, "ogg", params_par_fichier[f], dossier)
                for f in params_par_fichier})


# ── Ce que Godot 4.7 lit (constantes vérifiées, voir domaine.musique_adaptative) ──


def ressource_couches(streams):
    """`streams` : `[(chemin_res, volume_db), ...]`, dans l'ordre des
    couches. Un `AudioStreamSynchronized` : mêmes fichiers, mêmes longueurs
    (posées par l'auteur en amont, jamais recoupées ici) — monter une couche
    ne décale donc jamais les autres (SN10, critère 2)."""
    externes = "".join(f'[ext_resource type="AudioStream" path={json.dumps(c)} id="{i + 1}"]\n' for i, (c, _) in enumerate(streams))
    corps = "".join(f'stream_{i}/stream = ExtResource("{i + 1}")\nstream_{i}/volume = {v!r}\n' for i, (_, v) in enumerate(streams))
    return (f'[gd_resource type="AudioStreamSynchronized" load_steps={len(streams) + 1} format=3]\n\n{externes}\n'
        f'[resource]\nstream_count = {len(streams)}\n{corps}').encode()


def ressource_morceaux(clips, transitions):
    """`clips` : `[(cle, nom, chemin_res), ...]`. `transitions` :
    `[(de, vers, depart, arrivee, fondu, fondu_temps), ...]`, `de`/`vers` en
    index de clip ou `CLIP_ANY` (-1). Un `AudioStreamInteractive` aux noms de
    clips stables (SN10, critère 1) : `switch_to_clip` ou le nom du clip
    suffisent côté Godot, sans jamais deviner un numéro."""
    externes = "".join(f'[ext_resource type="AudioStream" path={json.dumps(c)} id="{i + 1}"]\n' for i, (_, _, c) in enumerate(clips))
    corps = "".join(f'clip_{i}/name = &{json.dumps(cle)}\nclip_{i}/stream = ExtResource("{i + 1}")\nclip_{i}/auto_advance = 0\n'
        for i, (cle, _, _) in enumerate(clips))
    entrees = []
    for de, vers, depart, arrivee, fondu, fondu_temps in transitions:
        champs = (f'"fade_beats": {fondu_temps!r},\n"fade_mode": {FONDUS[fondu]},\n'
            f'"from_time": {DEPARTS[depart]},\n"to_time": {ARRIVEES[arrivee]}')
        entrees.append(f'Vector2i({de}, {vers}): {{\n{champs}\n}}')
    bloc_transitions = "_transitions = {\n" + ",\n".join(entrees) + "\n}\n" if entrees else ""
    return (f'[gd_resource type="AudioStreamInteractive" load_steps={len(clips) + 1} format=3]\n\n{externes}\n'
        f'[resource]\nclip_count = {len(clips)}\n{corps}initial_clip = 0\n{bloc_transitions}').encode()


def scene_musique_adaptative(noeuds):
    """`noeuds` : `[(nom_du_noeud, chemin_res), ...]` (« Couches », «
    Morceaux », ou les deux) — un `AudioStreamPlayer` par ressource, sous une
    racine `MusiqueAdaptative` (le nom stable que `preparer_paquet` pose),
    tous sur le bus `Music`."""
    externes = "".join(f'[ext_resource type="AudioStream" path={json.dumps(chemin)} id="{i + 1}"]\n' for i, (_, chemin) in enumerate(noeuds))
    enfants = "".join(f'\n[node name={json.dumps(nom)} type="AudioStreamPlayer" parent="."]\n'
        f'stream = ExtResource("{i + 1}")\nbus = &"Music"\n' for i, (nom, _) in enumerate(noeuds))
    return (f'[gd_scene load_steps={len(noeuds) + 1} format=3]\n\n{externes}\n'
        f'[node name="MusiqueAdaptative" type="Node"]\n{enfants}').encode()
