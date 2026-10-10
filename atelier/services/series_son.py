"""SN3 · Une série de tirages : N travaux audio d'une même demande.

Chaque tirage est un travail audio ordinaire (`ServiceTravauxAudio.preparer`)
sous une clé dérivée de celle de la série (`serie:<clé>:<rang>`) : il tire sa
graine à la préparation, passe par la file locale, se reprend par son numéro
ComfyUI comme n'importe quel son. La série n'ajoute qu'un fichier qui nomme
ses tirages ; tout le reste — idempotence, reprise, budget de l'agent — est
celui des travaux et de la file locale, sans code à part.

- Préparer deux fois la même série (même clé, même demande) ne crée rien de plus.
- Reprendre ne touche jamais un tirage qui a déjà son son : rien n'est relancé
  automatiquement, et une dépense faite ne se refait pas.
- Le temps annoncé vient des mesures de la file locale : le bouton porte un
  temps, pas un prix.
"""
from __future__ import annotations

import json
import time

from atelier.depot.verrou import VerrouOccupe, verrou
from atelier.domaine.son import SonRefuse
from atelier.domaine.travail import TravailRefuse
from atelier.domaine.variantes_son import nombre_de_tirages
from atelier.domaine.workflow import GRAINE_MAX, MUSIQUE
from atelier.services.travaux import _hash, _json
from atelier.services.travaux_audio import ETIQUETTES, reglage_de_calcul

CLE_MAX = 150
# Ce qu'une série accepte : la demande d'un son (AU14 + SN2), plus le nombre.
# `source` et `force` (BO) : la reprise d'un son du jeu — chaque tirage repart
# du même son de départ, chacun sa graine.
DEMANDE = {"modele", "prompt", "prompt_negatif", "secondes", "options", *MUSIQUE, "famille", "texte_relu", "mesures",
           "usage", "graine", "source", "force"}


def duree_lisible(secondes):
    if secondes < 90:
        return f"{max(1, round(secondes))} s"
    return f"{round(secondes / 60)} min"


class ServiceSeriesSon:
    def __init__(self, atelier):
        self.a = atelier
        self.racine = atelier.fichiers.racine / "series_son"

    # ── Le rangement ─────────────────────────────────────────────────────

    def _dossier(self, projet):
        self.a.travaux._projet(projet)  # refuse un jeu qui n'existe plus
        return self.racine / _hash(projet.encode())[:24]

    def _chemin(self, projet, identifiant):
        if not isinstance(identifiant, str) or len(identifiant) != 32 or any(c not in "0123456789abcdef" for c in identifiant):
            raise TravailRefuse("Cette série n'existe pas dans ce jeu.")
        return self._dossier(projet) / (identifiant + ".json")

    def _brut(self, projet, identifiant):
        chemin = self._chemin(projet, identifiant)
        if not chemin.exists():
            raise TravailRefuse("Cette série n'existe pas dans ce jeu.")
        return json.loads(chemin.read_text(encoding="utf-8"))

    # ── Le temps annoncé ─────────────────────────────────────────────────

    def temps(self, modele, nombre, options=None):
        """Le temps de `nombre` tirages, d'après les calculs déjà faits sur
        cette machine par ce modèle **avec le même réglage** (médianes de la
        file locale) : ACE sans compositeur va six fois plus vite, et une
        médiane commune annonçait la moitié du temps réel. Le premier
        prend la mesure « froid », les suivants la mesure « chaud » quand elles
        existent. Sans mesure, le temps est inconnu, et l'écran le dit."""
        reglage = reglage_de_calcul(options)
        groupes = [m for m in self.a.file_locale.mesures() if m["modele"] == modele and m.get("reglage") == reglage]
        if not groupes or nombre <= 0:
            return {"temps_s": None if nombre else 0, "mesures": 0, "cout_usd": 0,
                    "phrase": ("Aucun calcul à faire." if not nombre else
                               "Pas encore de mesure de ce moteur sur cette machine : le premier tirage la donnera. "
                               "Aucun coût en argent.")}
        par = {g["temperature"]: g for g in groupes}
        base = max(groupes, key=lambda g: g["mesures"])
        premier = (par.get("froid") or base)["mediane_s"]
        suivant = (par.get("chaud") or base)["mediane_s"]
        total = premier + suivant * (nombre - 1)
        return {"temps_s": round(total, 1), "mesures": sum(g["mesures"] for g in groupes), "cout_usd": 0,
                "phrase": f"Environ {duree_lisible(total)} de calcul local pour {nombre} tirage{'s' if nombre > 1 else ''}. "
                          "Aucun coût en argent."}

    # ── Préparer ─────────────────────────────────────────────────────────

    def _profil(self, projet, demande):
        if "famille" in demande:
            compo, profil = self.a.travaux_audio._composition(projet, demande)
            if profil is None:
                raise TravailRefuse(compo.get("raison") or "Aucun moteur sonore installé pour cette famille.")
            return profil, compo
        if not isinstance(demande.get("modele"), str) or not demande["modele"].strip():
            raise TravailRefuse("Donnez un workflow sonore ou une famille de sons.")
        return self.a.profils_workflow.de_modele(demande["modele"]), None

    def _lire_demande(self, brut):
        if not isinstance(brut, dict) or set(brut) - DEMANDE - {"cle", "nombre", "nom"}:
            raise TravailRefuse("La demande de série contient un réglage inconnu.")
        cle = brut.get("cle")
        if not isinstance(cle, str) or not cle.strip() or len(cle) > CLE_MAX:
            raise TravailRefuse(f"Donnez une clé de série de {CLE_MAX} caractères au plus.")
        nom = brut.get("nom", "")
        if not isinstance(nom, str):
            raise TravailRefuse("Le nom de la série est un texte.")
        demande = {k: v for k, v in brut.items() if k in DEMANDE}
        g = demande.get("graine")
        if "graine" in demande and (isinstance(g, bool) or not isinstance(g, int) or not 0 <= g <= GRAINE_MAX):
            raise TravailRefuse("La graine de départ est un entier positif.")
        return cle,nombre_de_tirages(brut.get("nombre"), brut.get("famille")), nom.strip(), demande

    def annoncer(self, projet, brut):
        """Avant le bouton : combien de tirages, combien de temps, quel texte
        partira. Rien n'est lancé, rien n'est écrit."""
        if not isinstance(brut, dict):
            raise TravailRefuse("La demande de série contient un réglage inconnu.")
        _, nombre, _, demande = self._lire_demande({**brut, "cle": "annonce"})
        profil, compo = self._profil(projet, demande)
        return {"nombre": nombre, "famille": demande.get("famille"), "modele": profil["modele"],
                "graine_par_tirage": "graine" in profil["liaisons"], "annonce": self.temps(profil["modele"], nombre, demande.get("options")),
                "composition": compo}

    def _nom_de_base(self, nom, demande):
        """Le nom par défaut d'un tirage : la description seule — ni
        l'étiquette de sa famille (déjà le préfixe que `nom_stable` pose), ni
        un rang de tirage (déjà le numéro que la livraison d'un jeu de
        variantes pose). Sans description, l'étiquette de la famille reste le
        seul repli lisible."""
        if nom:
            return nom[:120]
        prompt = demande.get("prompt") if isinstance(demande.get("prompt"), str) else ""
        return prompt.strip()[:120] or ETIQUETTES.get(demande.get("famille"), "Son")

    async def preparer(self, projet, brut, acteur="auteur", *, emplacement=None):
        """`emplacement` (SN6) : `{sujet, cle}` quand la série part d'un
        emplacement d'un sujet — « Garder » range alors dans le jeu de cet
        emplacement (`ServiceSonsDuSujet.garder_depuis_serie`). Il passe par
        `ServiceSonsDuSujet.preparer_serie`, jamais par le corps d'une route."""
        if acteur not in ("auteur", "agent"):
            raise TravailRefuse("La demande de série contient un réglage inconnu.")
        cle, nombre, nom, demande = self._lire_demande(brut)
        identifiant = _hash(("serie\0" + projet + "\0" + cle).encode())[:32]
        try:
            signe = {"demande": demande, "nombre": nombre, "nom": nom, "acteur": acteur}
            if emplacement is not None:  # absent, l'empreinte d'avant SN6 ne bouge pas
                signe["emplacement"] = emplacement
            empreinte = _hash(_json(signe))
        except (TypeError, ValueError) as e:
            raise TravailRefuse("Les options doivent contenir des valeurs JSON finies.") from e
        chemin = self._chemin(projet, identifiant)
        if chemin.exists():
            avant = self._brut(projet, identifiant)
            if avant["empreinte"] != empreinte:
                raise TravailRefuse("Cette clé désigne déjà une autre série.")
            await self._completer(avant)
            return self.lire(projet, identifiant)
        profil, compo = self._profil(projet, demande)
        if nombre > 1 and "graine" not in profil["liaisons"]:
            raise TravailRefuse("Ce workflow ne reçoit pas de graine : plusieurs tirages rendraient le même son. "
                                "Demandez un seul tirage, ou reliez sa graine dans le profil.")
        base = self._nom_de_base(nom, demande)
        serie = {"identifiant": identifiant, "projet": projet, "cle": cle, "acteur": acteur, "empreinte": empreinte,
                 "nom": base, "famille": demande.get("famille"), "modele": profil["modele"], "nombre": nombre,
                 "demande": demande, "cree_le": time.time(),
                 "tirages": [{"rang": r, "cle": f"serie:{cle}:{r:02d}", "nom": base} for r in range(1, nombre + 1)],
                 "annonce": self.temps(profil["modele"], nombre, demande.get("options"))}
        if emplacement is not None:
            serie["emplacement"] = {"sujet": emplacement["sujet"], "cle": emplacement["cle"]}
        if compo is not None and "texte_relu" not in demande:
            # Le modèle et le texte composé sont figés à la préparation : une
            # reprise après un changement de l'univers ou une réinstallation
            # des moteurs ne mélange jamais deux textes entre les tirages
            # d'une même série (correction du 18 septembre 2026).
            serie["texte_fige"] = compo["texte"]
        # Le premier tirage valide toute la demande (texte, durée, moteur
        # installé) avant qu'aucune série ne s'écrive : un refus ne laisse rien.
        premier = await self._preparer_tirage(serie, serie["tirages"][0])
        serie["tirages"][0]["travail"] = premier["identifiant"]
        try:
            with verrou(self._dossier(projet) / ".series", attendre=5):
                if not chemin.exists():
                    self.a.fichiers._poser(chemin, _json(serie))
        except VerrouOccupe as e:
            raise TravailRefuse("Cette série est déjà en cours de préparation. Relire son état.") from e
        await self._completer(self._brut(projet, identifiant))
        return self.lire(projet, identifiant)

    async def _preparer_tirage(self, serie, tirage):
        # Le modèle et le texte composé, figés à la préparation de la série
        # (quand elle en a un) : chaque tirage envoie le même texte au même
        # moteur, même si l'univers ou les moteurs installés ont changé
        # depuis — sans toucher à la demande elle-même (l'empreinte d'un
        # tirage préparé sans changement reste celle d'avant).
        figer = {"modele": serie["modele"], "texte": serie["texte_fige"]} if serie.get("texte_fige") is not None else None
        demande = {**serie["demande"], "cle": tirage["cle"], "nom": tirage["nom"]}
        if isinstance(demande.get("graine"), int) and not isinstance(demande["graine"], bool):
            # Une graine de départ donnée : le tirage de rang r prend graine + r - 1.
            # Deux séries de même graine (trois intensités d'une musique) tirent
            # donc rang pour rang sur les mêmes graines.
            demande["graine"] = (demande["graine"] + tirage["rang"] - 1) % (GRAINE_MAX + 1)
        return await self.a.travaux_audio.preparer(serie["projet"], demande,
            serie["acteur"], serie={"identifiant": serie["identifiant"], "rang": tirage["rang"]}, figer=figer)

    async def _completer(self, serie):
        """Prépare les tirages qui ne le sont pas encore (une préparation
        coupée en route). Chaque préparation est idempotente par sa clé."""
        change = False
        for tirage in serie["tirages"]:
            if not tirage.get("travail"):
                tirage["travail"] = (await self._preparer_tirage(serie, tirage))["identifiant"]
                change = True
        if change:
            with verrou(self._dossier(serie["projet"]) / ".series", attendre=5):
                self.a.fichiers._poser(self._chemin(serie["projet"], serie["identifiant"]), _json(serie))
        return serie

    # ── Relire ───────────────────────────────────────────────────────────

    def _son(self, projet, identifiant):
        try:
            son = self.a.sons.lire(projet, identifiant)
        except SonRefuse:
            return {"identifiant": identifiant, "existe": False}
        mesures = son.get("mesures") or {}
        return {"identifiant": identifiant, "existe": True, "nom": son["nom"], "revision": son["revision"],
                "famille": son.get("famille"), "pret": son["pret"], "raison": son.get("raison", ""),
                "jugement": son["jugement"], "mesures": son.get("mesures"),
                # Les mesures informent : un tirage saturé est signalé, jamais écarté.
                "sature": bool(mesures.get("ecretes")), "silencieux": bool(mesures.get("silencieux"))}

    def lire(self, projet, identifiant):
        serie = self._brut(projet, identifiant)
        tirages, restants = [], 0
        for tirage in serie["tirages"]:
            travail = None
            if tirage.get("travail"):
                try:
                    travail = self.a.travaux.lire(projet, tirage["travail"])
                except TravailRefuse:
                    travail = None
            if travail is None:
                vu = {"rang": tirage["rang"], "travail": tirage.get("travail"), "graine": None, "etat": "a_preparer",
                      "raison": "Ce tirage n'est pas encore préparé.", "prochaine_action": "reprendre", "son": None}
            else:
                envoi = travail.get("snapshot_audio") or {}
                vu = {"rang": tirage["rang"], "travail": travail["identifiant"], "graine": envoi.get("graine"),
                      "etat": "rendu" if travail.get("son") else travail["etat"], "raison": travail.get("raison", ""),
                      "prochaine_action": travail["prochaine_action"],
                      "son": self._son(projet, travail["son"]) if travail.get("son") else None}
            if vu["etat"] not in ("rendu", "annule", "termine"):
                restants += 1
            tirages.append(vu)
        etats = [t["etat"] for t in tirages]
        compte = {e: etats.count(e) for e in dict.fromkeys(etats)}
        if all(e in ("rendu", "annule", "termine") for e in etats):
            etat, action = "terminee", "ecouter_et_garder"
        elif any(e in ("en_cours", "en_attente") for e in etats):
            etat, action = "en_cours", "attendre"
        elif all(e == "prepare" for e in etats):
            etat, action = "preparee", "demarrer"
        elif any(e in ("a_reprendre", "a_verifier", "a_preparer", "prepare") for e in etats):
            etat, action = "a_reprendre", "reprendre"
        else:
            etat, action = "externe_inconnu", "verifier_chez_le_fournisseur"
        jeux = [j["identifiant"] for j in self.a.variantes_son.bruts(projet) if j.get("serie") == identifiant]
        extra = {}
        if serie.get("emplacement"):
            # Le jeu de l'emplacement se rouvre avec la série, même formé par
            # une série précédente du même emplacement (SN6).
            du_lieu = self.a.sons_du_sujet.jeu_de(projet, serie["emplacement"]["sujet"], serie["emplacement"]["cle"])
            if du_lieu and du_lieu not in jeux:
                jeux.append(du_lieu)
            extra["emplacement"] = self.a.sons_du_sujet.decrire(projet, serie["emplacement"])
        return {k: v for k, v in serie.items() if k not in ("empreinte",)} | {
            "tirages": tirages, "compte": compte, "etat": etat, "prochaine_action": action,
            "reste": self.temps(serie["modele"], restants, serie["demande"].get("options")), "jeux": jeux} | extra

    def lister(self, projet):
        dossier = self._dossier(projet)
        return sorted([self.lire(projet, p.stem) for p in dossier.glob("*.json")], key=lambda s: s["cree_le"], reverse=True)

    # ── Lancer, reprendre ────────────────────────────────────────────────

    async def demarrer(self, projet, identifiant, acteur="auteur"):
        """Lance les tirages préparés. Ceux qui ont déjà démarré ne bougent
        pas : ce geste ne reprend rien (voir `reprendre`)."""
        serie = await self._completer(self._brut(projet, identifiant))
        refus = []
        for tirage in serie["tirages"]:
            if self.a.travaux.lire(projet, tirage["travail"])["etat"] != "prepare":
                continue
            try:
                await self.a.travaux.demarrer(projet, tirage["travail"], acteur)
            except TravailRefuse as e:
                refus.append({"rang": tirage["rang"], "raison": e.raison})
        if refus and len(refus) == len(serie["tirages"]):
            raise TravailRefuse(refus[0]["raison"])
        return {**self.lire(projet, identifiant), "refus": refus}

    async def reprendre(self, projet, identifiant, acteur="auteur"):
        """Le geste explicite de reprise. Un tirage qui a son son n'est jamais
        relancé ; un tirage en calcul est laissé à son suivi ; un tirage dont
        l'acceptation est inconnue attend la vérification de l'auteur. Les
        autres reprennent par leur travail : la file locale suit le numéro
        ComfyUI déjà connu et ne soumet que ce qui ne l'a jamais été."""
        serie = await self._completer(self._brut(projet, identifiant))
        relances, laisses = [], []
        for tirage in serie["tirages"]:
            travail = self.a.travaux.lire(projet, tirage["travail"])
            if travail.get("son") or travail["etat"] in ("termine", "annule"):
                continue
            if travail["etat"] in ("en_cours", "externe_inconnu"):
                laisses.append({"rang": tirage["rang"], "etat": travail["etat"], "raison": travail.get("raison", "")})
                continue
            try:
                await self.a.travaux.demarrer(projet, tirage["travail"], acteur, reprise=travail["etat"] != "prepare")
                relances.append(tirage["rang"])
            except TravailRefuse as e:
                laisses.append({"rang": tirage["rang"], "etat": travail["etat"], "raison": e.raison})
        return {**self.lire(projet, identifiant), "relances": relances, "laisses": laisses}

    # ── Garder ───────────────────────────────────────────────────────────

    def garder(self, projet, identifiant, brut):
        """« Garder ces tirages » : un jeu de variantes, dans l'ordre donné,
        qui se souvient de sa série. `rangs` (1…N) ou `sons` (identifiants).

        Les réglages proposés par la famille (mono pour bruitage, interface et
        voix ; niveau visé) restent proposés à la création d'une version, et
        s'appliquent ici, au geste « garder » : chaque son gardé reçoit une
        nouvelle version avec la recette proposée de sa famille, visible dans
        ses versions. `appliquer_reglages=False` s'en passe."""
        if not isinstance(brut, dict) or set(brut) - {"rangs", "sons", "nom", "cle", "famille", "appliquer_reglages"}:
            raise TravailRefuse("Dites quels tirages garder : leurs rangs ou leurs sons.")
        appliquer = brut.get("appliquer_reglages", True)
        if not isinstance(appliquer, bool):
            raise TravailRefuse("appliquer_reglages est activé ou désactivé.")
        serie = self.lire(projet, identifiant)
        par_rang = {t["rang"]: t for t in serie["tirages"]}
        a_moi = {t["son"]["identifiant"]: t["rang"] for t in serie["tirages"] if t["son"]}
        if "rangs" in brut:
            rangs = brut["rangs"]
            if not isinstance(rangs, list) or not rangs or any(isinstance(r, bool) or r not in par_rang for r in rangs):
                raise TravailRefuse(f"Choisissez des tirages entre 1 et {serie['nombre']}.")
            manquants = [r for r in rangs if not par_rang[r]["son"]]
            if manquants:
                raise TravailRefuse("Le tirage " + ", ".join(map(str, manquants)) + " n'a pas encore de son.")
            sons = [par_rang[r]["son"]["identifiant"] for r in rangs]
        else:
            sons = brut.get("sons")
            if not isinstance(sons, list) or not sons or any(s not in a_moi for s in sons):
                raise TravailRefuse("Gardez des sons rendus par cette série.")
        if serie.get("emplacement"):
            # SN6 : une série lancée depuis un emplacement range dans son jeu.
            return self.a.sons_du_sujet.garder_depuis_serie(projet, serie, sons, appliquer)
        famille = brut.get("famille", serie["famille"])
        # Le même chemin que l'ajout d'un son à un jeu déjà formé : un son qui
        # porte déjà les réglages de sa famille ne reçoit pas de version de plus.
        corps = {"nom": brut.get("nom") or serie["nom"], "sons": sons, "serie": identifiant, "famille": famille,
                 "appliquer_reglages": appliquer}
        if brut.get("cle") is not None:
            corps["cle"] = brut["cle"]
        return self.a.variantes_son.creer(projet, corps)

    def rang_de(self, projet, identifiant, son):
        """Le rang d'un son dans sa série, s'il en vient (lu dans sa provenance)."""
        try:
            provenance = self.a.sons.lire(projet, son).get("provenance") or {}
        except SonRefuse:
            return None
        origine = provenance.get("serie") or {}
        return origine.get("rang") if origine.get("identifiant") == identifiant else None

