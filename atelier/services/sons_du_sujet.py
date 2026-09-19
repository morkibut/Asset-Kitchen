"""SN6 · Les sons d'un sujet : ses emplacements, ce qui les remplit, et ce
qui part avec lui dans le jeu.

Un fichier par sujet, sous `sons_sujets/<jeu>/<sujet>.json` (la forme est
écrite dans `atelier.domaine.sons_du_sujet`). Le service ne lit les sons et
les jeux de variantes que par leurs services : il n'en copie aucun, n'en
supprime aucun, et ne refuse aucun son pour une mesure.

- **Lire** : les emplacements proposés par la famille du sujet, puis ceux
  nommés à la main, chacun rempli ou vide, avec ses séries.
- **Poser, vider** : un jeu de variantes ou un son seul sur un emplacement.
- **Une série depuis un emplacement** : `proposer` compose la demande (rien
  n'est écrit ni lancé) ; `preparer_serie` la prépare, liée à l'emplacement ;
  « Garder » dans cette série range dans le jeu de l'emplacement
  (`garder_depuis_serie`, appelé par la série).
- **Livrer** : `paquet_pour_livraison` rend les fichiers que la livraison du
  sujet emporte, sous leurs noms stables.
"""
from __future__ import annotations

import contextlib
import json
import time
import uuid

from atelier.depot.verrou import VerrouOccupe, verrou
from atelier.domaine.son import FAMILLES, SonRefuse
from atelier.domaine.sons_du_sujet import (
    SonsDuSujetRefuses, base_stable, cle_de, cle_valide, famille_valide, nom_valide, proposes, texte_propose)
from atelier.domaine.variantes_son import VariantesRefusees, identifiant_valide, nombre_de_tirages, statut_membre
from atelier.services.sons import _json_lisible, credit, fichier_de_famille, nom_stable, ressource_variantes
from atelier.services.travaux import _hash, _json

# La famille de sons qui passe par sfxr, sans texte ni série (SN8).
SFXR = "interface"


class ServiceSonsDuSujet:
    def __init__(self, atelier):
        self.a = atelier
        self.racine = atelier.fichiers.racine / "sons_sujets"

    # ── Le rangement ─────────────────────────────────────────────────────

    def _dossier(self, projet):
        if not any(p.identifiant == projet for p in self.a.bibliotheque.projets()):
            raise SonsDuSujetRefuses("Ce jeu n'existe pas dans l'atelier.")
        return self.racine / _hash(projet.encode())[:32]

    def _chemin(self, projet, sujet):
        return self._dossier(projet) / (_hash(("sujet\0" + sujet).encode())[:32] + ".json")

    def _brut(self, projet, sujet):
        chemin = self._chemin(projet, sujet)
        if chemin.exists():
            return json.loads(chemin.read_text(encoding="utf-8"))
        return {"projet": projet, "sujet": sujet, "revision": 0, "emplacements": {}}

    @contextlib.contextmanager
    def _verrou(self, projet):
        try:
            with verrou(self._dossier(projet) / ".verrou", attendre=5):
                yield
        except VerrouOccupe as e:  # pragma: no cover - le verrou attend
            raise SonsDuSujetRefuses("Les sons de ce sujet sont modifiés ailleurs. Relisez-les.") from e

    def _changer(self, projet, sujet, changer):
        with self._verrou(projet):
            objet = self._brut(projet, sujet)
            if changer(objet) is not False:
                objet["revision"] += 1
                objet["modifie_le"] = time.time()
                self.a.fichiers._poser(self._chemin(projet, sujet), _json(objet))
        self.a.diffusion.publier("sons_du_sujet", {"projet": projet, "sujet": sujet})
        return objet

    def _sujet(self, projet, sujet):
        """Le sujet, et sa famille lue dans son type (jamais gardée en double)."""
        if not isinstance(sujet, str) or not sujet:
            raise SonsDuSujetRefuses("Ce sujet n'existe pas dans ce jeu.")
        personnage = self.a.production.personnage(projet, sujet)
        return personnage, self.a.production.famille_de(projet, personnage)

    def _definitions(self, famille_sujet, objet):
        """Toutes les définitions d'emplacement du sujet, dans l'ordre de
        l'écran : les proposés de sa famille, puis les nommés à la main."""
        stockes = objet["emplacements"]
        vus = []
        for p in proposes(famille_sujet):
            s = stockes.get(p["cle"], {})
            vus.append({**p, "libre": False, "propose": True, "contenu": s.get("contenu"), "series": s.get("series", []),
                        "pose_le": s.get("pose_le")})
        connus = {v["cle"] for v in vus}
        libres = sorted((s for c, s in stockes.items() if c not in connus), key=lambda s: s.get("cree_le", 0))
        for s in libres:
            vus.append({"cle": s["cle"], "nom": s["nom"], "famille": s["famille"], "indice": None, "libre": True,
                        "propose": False, "contenu": s.get("contenu"), "series": s.get("series", []), "pose_le": s.get("pose_le")})
        return vus

    def _definition(self, projet, sujet, cle, objet=None):
        personnage, famille = self._sujet(projet, sujet)
        cle_valide(cle)
        objet = objet if objet is not None else self._brut(projet, sujet)
        for d in self._definitions(famille, objet):
            if d["cle"] == cle:
                return personnage, d
        raise SonsDuSujetRefuses("Cet emplacement n'existe pas pour ce sujet.")

    @staticmethod
    def _stocke(objet, d):
        """L'entrée écrite d'un emplacement (créée au premier geste qui l'écrit)."""
        return objet["emplacements"].setdefault(d["cle"], {"cle": d["cle"], "nom": d["nom"], "famille": d["famille"],
            "libre": d["libre"], "contenu": None, "series": [], "pose_le": None, "cree_le": time.time()})

    # ── Relire ───────────────────────────────────────────────────────────

    def _contenu(self, projet, contenu):
        """Ce que l'emplacement désigne, relu : ses sons, ce qui partira au
        jeu, et ce que les mesures signalent (sans rien retirer)."""
        if not contenu:
            return None
        if contenu["nature"] == "jeu":
            try:
                jeu = self.a.variantes_son.lire(projet, contenu["identifiant"])
            except VariantesRefusees:
                return {**contenu, "existe": False, "nom": None, "sons": [], "a_livrer": [], "famille": None,
                        "signalements": [{"son": None, "statut": "supprime", "signal": "Ce jeu de variantes n'existe plus."}]}
            return {**contenu, "existe": True, "nom": jeu["nom"], "famille": jeu["famille"], "sons": jeu["sons"],
                    "a_livrer": jeu["a_livrer"], "signalements": jeu["signalements"], "revision": jeu["revision"]}
        try:
            son = self.a.sons.lire(projet, contenu["identifiant"])
        except SonRefuse:
            son = None
        statut = statut_membre(son, None)
        return {**contenu, "existe": son is not None, "nom": son["nom"] if son else None,
                "famille": son.get("famille") if son else None, "sons": [contenu["identifiant"]],
                "a_livrer": [contenu["identifiant"]] if statut["a_livrer"] else [],
                "signalements": [{"son": contenu["identifiant"], **{k: statut[k] for k in ("statut", "signal")}}] if statut["signal"] else [],
                "revision": son["revision"] if son else None}

    def lire(self, projet, sujet):
        personnage, famille = self._sujet(projet, sujet)
        objet = self._brut(projet, sujet)
        court = personnage.nom
        emplacements = []
        for d in self._definitions(famille, objet):
            contenu = self._contenu(projet, d["contenu"])
            emplacements.append({**d, "contenu": contenu, "rempli": bool(contenu and contenu["sons"]),
                                 "nom_stable": nom_stable(d["famille"], base_stable(court, d["cle"])),
                                 "derniere_serie": d["series"][-1] if d["series"] else None,
                                 # Interface et rétro passe par sfxr, sans série ni texte (SN8).
                                 "par_sfxr": d["famille"] == SFXR})
        return {"projet": projet, "sujet": {"identifiant": personnage.identifiant, "nom": personnage.nom,
                                            "famille": famille, "description": personnage.description},
                "emplacements": emplacements, "remplis": sum(1 for e in emplacements if e["rempli"]),
                "total": len(emplacements), "revision": objet["revision"]}

    def emplacement(self, projet, sujet, cle):
        vue = self.lire(projet, sujet)
        for e in vue["emplacements"]:
            if e["cle"] == cle:
                return e
        raise SonsDuSujetRefuses("Cet emplacement n'existe pas pour ce sujet.")

    def index(self, projet):
        """Tous les emplacements remplis du jeu, sujet par sujet : ce que la
        galerie et « Livrer au jeu » montrent à côté d'un son. Un sujet
        supprimé ne s'y lit plus ; ses sons restent des sons du jeu."""
        lignes = []
        for chemin in sorted(self._dossier(projet).glob("*.json")):
            objet = json.loads(chemin.read_text(encoding="utf-8"))
            try:
                vue = self.lire(projet, objet["sujet"])
            except Exception:  # noqa: BLE001 — un sujet disparu ne compte plus
                continue
            for e in vue["emplacements"]:
                if e["contenu"]:
                    lignes.append({"sujet": vue["sujet"]["identifiant"], "nom_sujet": vue["sujet"]["nom"], "cle": e["cle"],
                                   "nom": e["nom"], "famille": e["famille"], "nom_stable": e["nom_stable"],
                                   "contenu": {k: e["contenu"][k] for k in ("nature", "identifiant", "nom", "sons")}})
        return lignes

    # ── Nommer, poser, vider ─────────────────────────────────────────────

    def ajouter(self, projet, sujet, brut):
        """Un emplacement nommé à la main : `{nom, famille}`."""
        if not isinstance(brut, dict) or set(brut) - {"nom", "famille"}:
            raise SonsDuSujetRefuses("Un emplacement se nomme et prend une famille de sons, rien d'autre.")
        nom = nom_valide(brut.get("nom"))
        famille = famille_valide(brut.get("famille"))
        cle = cle_de(nom)
        _, famille_sujet = self._sujet(projet, sujet)

        def changer(objet):
            if any(d["cle"] == cle for d in self._definitions(famille_sujet, objet)):
                raise SonsDuSujetRefuses(f"Ce sujet a déjà un emplacement « {nom} ».")
            objet["emplacements"][cle] = {"cle": cle, "nom": nom, "famille": famille, "libre": True, "contenu": None,
                                          "series": [], "pose_le": None, "cree_le": time.time()}
        self._changer(projet, sujet, changer)
        return self.lire(projet, sujet)

    def retirer_emplacement(self, projet, sujet, cle):
        """Un emplacement nommé à la main disparaît ; ce qu'il désignait reste
        dans la galerie. Un emplacement proposé ne se retire pas : il se vide."""
        _, d = self._definition(projet, sujet, cle)
        if not d["libre"]:
            raise SonsDuSujetRefuses("Cet emplacement vient de la famille du sujet : il se vide, il ne se retire pas.")

        def changer(objet):
            objet["emplacements"].pop(cle, None)
        self._changer(projet, sujet, changer)
        return self.lire(projet, sujet)

    def poser(self, projet, sujet, cle, brut):
        """`{jeu}` ou `{son}` : ce que l'emplacement désigne désormais. Aucun
        son n'est refusé pour une mesure ; le précédent contenu reste dans la
        galerie."""
        if not isinstance(brut, dict) or len(set(brut) & {"jeu", "son"}) != 1 or set(brut) - {"jeu", "son"}:
            raise SonsDuSujetRefuses("Posez un jeu de variantes ou un son, l'un ou l'autre.")
        nature = "jeu" if "jeu" in brut else "son"
        identifiant = brut[nature]
        try:
            identifiant_valide(identifiant, "Ce jeu de variantes" if nature == "jeu" else "Ce son")
            (self.a.variantes_son.lire if nature == "jeu" else self.a.sons.lire)(projet, identifiant)
        except (VariantesRefusees, SonRefuse) as e:
            raise SonsDuSujetRefuses(e.raison) from e
        _, d = self._definition(projet, sujet, cle)

        def changer(objet):
            entree = self._stocke(objet, d)
            if entree["contenu"] == {"nature": nature, "identifiant": identifiant}:
                return False
            entree["contenu"] = {"nature": nature, "identifiant": identifiant}
            entree["pose_le"] = time.time()
        self._changer(projet, sujet, changer)
        return self.emplacement(projet, sujet, cle)

    def vider(self, projet, sujet, cle):
        _, d = self._definition(projet, sujet, cle)

        def changer(objet):
            entree = objet["emplacements"].get(cle)
            if not entree or not entree.get("contenu"):
                return False
            entree["contenu"] = None
            entree["pose_le"] = None
        self._changer(projet, sujet, changer)
        return self.emplacement(projet, sujet, cle)

    # ── Une série depuis un emplacement ──────────────────────────────────

    def proposer(self, projet, sujet, cle):
        """La demande qu'on propose pour cet emplacement : sa famille, le texte
        tiré de l'emplacement et de la description du sujet, le nombre de
        tirages, le nom des sons. N'écrit rien, ne lance rien : l'écran la
        montre dans la demande, où elle se relit et se corrige avant l'envoi."""
        personnage, d = self._definition(projet, sujet, cle)
        texte, morceaux = texte_propose(personnage.description, personnage.nom, d)
        return {"famille": d["famille"], "prompt": texte, "morceaux": morceaux,
                "nombre": nombre_de_tirages(None, d["famille"]), "nom": f"{personnage.nom} · {d['nom']}",
                "emplacement": {"sujet": personnage.identifiant, "cle": d["cle"], "nom": d["nom"]},
                "par_sfxr": d["famille"] == SFXR}

    async def preparer_serie(self, projet, sujet, cle, brut, acteur="auteur"):
        """Prépare une série liée à l'emplacement (le corps d'une série :
        `famille`, `prompt`, `nombre`… ; `cle` facultative). La famille est
        celle de l'emplacement. Rien n'est lancé : `start` le fait."""
        if not isinstance(brut, dict):
            raise SonsDuSujetRefuses("La demande de série contient un réglage inconnu.")
        personnage, d = self._definition(projet, sujet, cle)
        if d["famille"] == SFXR:
            raise SonsDuSujetRefuses("Un son d'interface se fabrique avec sfxr, sans texte : "
                                     "ouvrez l'emplacement et choisissez un départ.")
        demande = {**brut}
        famille = demande.setdefault("famille", d["famille"])
        if famille != d["famille"] and {famille, d["famille"]} - {"musique", "jingle", "chanson"}:
            raise SonsDuSujetRefuses(f"Cet emplacement attend un son de la famille « {d['famille']} ».")
        demande.setdefault("nom", f"{personnage.nom} · {d['nom']}")
        demande.setdefault("cle", "emplacement:" + uuid.uuid4().hex)
        serie = await self.a.series_son.preparer(projet, demande, acteur,
                                                 emplacement={"sujet": personnage.identifiant, "cle": d["cle"]})

        def changer(objet):
            entree = self._stocke(objet, d)
            if serie["identifiant"] in entree["series"]:
                return False
            entree["series"].append(serie["identifiant"])
        self._changer(projet, sujet, changer)
        return serie

    def jeu_de(self, projet, sujet, cle):
        """Le jeu de variantes que l'emplacement désigne, s'il en désigne un."""
        try:
            objet = self._brut(projet, sujet)
        except SonsDuSujetRefuses:
            return None
        contenu = (objet["emplacements"].get(cle) or {}).get("contenu")
        return contenu["identifiant"] if contenu and contenu["nature"] == "jeu" else None

    def decrire(self, projet, lien):
        """`{sujet, cle}` d'une série, lisible : le nom du sujet et de
        l'emplacement. Un sujet disparu garde son lien, sans nom."""
        try:
            personnage, d = self._definition(projet, lien["sujet"], lien["cle"])
            return {**lien, "nom_sujet": personnage.nom, "nom": d["nom"], "famille": d["famille"]}
        except Exception:  # noqa: BLE001
            return {**lien, "nom_sujet": None, "nom": None, "famille": None}

    def garder_depuis_serie(self, projet, serie, sons, appliquer):
        """« Garder » dans une série lancée depuis un emplacement : les sons
        rejoignent le jeu de l'emplacement (formé au premier geste, sous le
        nom stable de l'emplacement), un son déjà dedans n'y est pas mis deux
        fois. Un son seul déjà posé devient le premier du jeu."""
        lien = serie["emplacement"]
        personnage, d = self._definition(projet, lien["sujet"], lien["cle"])
        famille = serie.get("famille") or d["famille"]
        existant = self._brut(projet, lien["sujet"])["emplacements"].get(d["cle"], {}).get("contenu")
        jeu = None
        if existant and existant["nature"] == "jeu":
            try:
                jeu = self.a.variantes_son.lire(projet, existant["identifiant"])
            except VariantesRefusees:
                jeu = None
        if jeu is None:
            depart = [existant["identifiant"]] if existant and existant["nature"] == "son" else []
            try:
                if depart:
                    self.a.sons.lire(projet, depart[0])
            except SonRefuse:
                depart = []
            corps = {"nom": nom_stable(famille, base_stable(personnage.nom, d["cle"])), "sons": [*depart, *[s for s in sons if s not in depart]],
                     "serie": serie["identifiant"], "famille": famille, "appliquer_reglages": appliquer}
            jeu = self.a.variantes_son.creer(projet, corps)
            self.poser(projet, lien["sujet"], d["cle"], {"jeu": jeu["identifiant"]})
            return jeu
        for son in sons:
            jeu = self.a.variantes_son.ajouter(projet, jeu["identifiant"], son, appliquer_reglages=appliquer)
        return jeu

    # ── Livrer avec le sujet ─────────────────────────────────────────────

    def paquet_pour_livraison(self, projet, sujet):
        """Ce que la livraison du sujet emporte, ou None s'il n'a aucun son à
        livrer : les fichiers audio sous leurs noms stables (un jeu de
        variantes numéroté sur deux chiffres, avec son `AudioStreamRandomizer`),
        les options de leur `.import`, un nœud sonore par emplacement pour la
        scène, `credits.json`. Un emplacement dont rien n'est livrable (son
        écarté, silencieux, supprimé) est signalé, jamais retiré en silence."""
        vue = self.lire(projet, sujet)
        fichiers, imports, noeuds, entrees, non_livres, credits = {}, [], [], [], [], []
        pris = set()
        for e in vue["emplacements"]:
            contenu = e["contenu"]
            if not contenu:
                continue
            if not contenu["a_livrer"]:
                raison = "; ".join(dict.fromkeys(s["signal"] for s in contenu["signalements"] if s.get("signal"))) or "Aucun son livrable."
                non_livres.append({"cle": e["cle"], "nom": e["nom"], "raison": raison})
                continue
            famille_cle = contenu.get("famille") if contenu.get("famille") in FAMILLES else e["famille"]
            famille = FAMILLES[famille_cle]
            base = nom_stable(famille_cle, contenu["nom"]) if contenu["nature"] == "jeu" and contenu["nom"] else e["nom_stable"]
            if base in pris:  # deux emplacements au même nom : le second prend un rang
                rang = 2
                while f"{base}_{rang}" in pris:
                    rang += 1
                base = f"{base}_{rang}"
            pris.add(base)
            if contenu["nature"] == "jeu":
                contenus, params, audio, credits_jeu = self.a.variantes_son.fichiers_des_membres(projet, contenu["a_livrer"], famille_cle, base)
                ressource = base + ".tres"
                fichiers.update(contenus)
                fichiers[ressource] = ressource_variantes(audio)
            else:
                son = self.a.sons.lire(projet, contenu["identifiant"])
                wav = self.a.sons.rendu(projet, son["identifiant"], son["revision"]).read_bytes()
                ressource, octets, parametres = fichier_de_famille(son, wav, famille_cle, base)
                fichiers[ressource] = octets
                audio, params, credits_jeu = [ressource], {ressource: parametres}, [credit(son, ressource)]
            imports += [(f, famille.format, params[f]) for f in audio]
            credits += credits_jeu
            noeuds.append({"nom": base, "ressource": ressource, "bus": famille.bus})
            entrees.append({"emplacement": e["cle"], "nom": e["nom"], "famille": famille_cle, "nom_stable": base,
                            "nature": contenu["nature"], "identifiant": contenu["identifiant"], "ressource": ressource,
                            "fichiers": audio, "sons": contenu["a_livrer"], "signalements": contenu["signalements"]})
        if not entrees:
            return None
        fichiers["credits.json"] = _json_lisible({"atelier": "Asset Kitchen", "sons": credits})
        return {"fichiers": fichiers, "imports": imports, "noeuds": noeuds, "entrees": entrees, "non_livres": non_livres}

