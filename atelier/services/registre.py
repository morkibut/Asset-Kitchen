"""RC1 · Le registre du contenu : déposer, montrer, décider, relever.

Les règles et la forme des fichiers sont en tête de `atelier.domaine.registre`.
Ce service est **le seul** à écrire sous `projets/<jeu>/registre/` ; l'écran
(`atelier/api/registre.py`) et l'agent (`atelier/mcp/registre.py`) l'appellent
tous les deux, et la boîte de dépôt par fichiers passe par le même `deposer`.

Ce qui distingue les deux mains, et qui ne se contourne pas :

- **l'agent dépose, répond, avance un statut, dit ce qui attend** ;
- **l'auteur décide** : valider, demander une reprise, écarter, mettre en
  pause, prendre une proposition. Aucun outil d'agent n'écrit une décision.

Tout se relit sans base : l'index SQLite n'apprend rien du registre, et
l'effacer ne perd ni une entrée, ni une décision, ni un « vu ».
"""
from __future__ import annotations

import contextlib
import hashlib
import json
import shutil
import time
from pathlib import Path
from typing import Any

from atelier.depot.verrou import VerrouOccupe, verrou
from atelier.domaine.registre import (
    AUTEUR,
    ETATS,
    ETATS_DE_REMARQUE,
    GENRES_DE_MEDIA,
    GESTES,
    SORTES_DE_REMARQUE,
    STATUTS_D_AGENT,
    EntreeInconnue,
    RegistreRefuse,
    depot_valide,
    etat_de_l_entree,
    etat_des_remarques,
    evenements_valides,
    identifiant_valide,
    nouveau_repere,
    reglages_valides,
)

# Ce qu'une liste rend à un agent quand il ne dit rien : assez pour travailler,
# trop peu pour noyer son contexte (une liste de 200 entrées en ferait 40 000 signes).
LIMITE_PAR_DEFAUT = 30


class ServiceRegistre:
    def __init__(self, atelier):
        self.a = atelier

    # ── Les chemins ──────────────────────────────────────────────────────

    def _racine(self, projet: str) -> Path:
        if not isinstance(projet, str) or not projet or "/" in projet or "\\" in projet or projet.startswith("."):
            raise RegistreRefuse("Nommez le jeu par son identifiant.")
        dossier = self.a.fichiers.projets / projet
        if not (dossier / "projet.json").is_file():
            raise RegistreRefuse(f"Aucun jeu « {projet} » dans l'atelier.")
        return dossier / "registre"

    def _entree_dir(self, projet, identifiant) -> Path:
        return self._racine(projet) / "entrees" / identifiant_valide(identifiant)

    @contextlib.contextmanager
    def _verrou(self, projet):
        try:
            with verrou(self._racine(projet) / ".verrou", attendre=5):
                yield
        except VerrouOccupe as e:  # pragma: no cover - le verrou attend
            raise RegistreRefuse("Le registre est occupé par un autre geste ; réessayez.") from e

    def _publier(self, projet, entree=None):
        self.a.diffusion.publier("registre", {"projet": projet, "entree": entree})

    # ── Les réglages du jeu ──────────────────────────────────────────────

    def reglages(self, projet) -> dict[str, Any]:
        chemin = self._racine(projet) / "reglages.json"
        brut = None
        if chemin.is_file():
            brut = self.a.fichiers._lire_json(chemin)
            if brut is None:
                raise RegistreRefuse("registre/reglages.json est illisible : corrigez-le ou retirez-le.")
        return reglages_valides(brut) | {"etats": ETATS, "remarques": SORTES_DE_REMARQUE,
                                         "etats_de_remarque": ETATS_DE_REMARQUE}

    def _type(self, reglages, cle):
        for t in reglages["types"]:
            if t["cle"] == cle:
                return t
        # Un type retiré des réglages après coup : l'entrée reste lisible, sans porte.
        return {"cle": cle, "nom": cle, "portes": []}

    # ── Lire les fichiers ────────────────────────────────────────────────

    def _entree(self, projet, identifiant) -> dict[str, Any]:
        chemin = self._entree_dir(projet, identifiant) / "entree.json"
        entree = self.a.fichiers._lire_json(chemin)
        if entree is None:
            raise EntreeInconnue(identifiant)
        return entree

    def _entrees(self, projet) -> list[dict[str, Any]]:
        dossier = self._racine(projet) / "entrees"
        if not dossier.is_dir():
            return []
        entrees = []
        for chemin in sorted(dossier.glob("*/entree.json")):
            entree = self.a.fichiers._lire_json(chemin)
            if entree is not None:
                entrees.append(entree)
        return entrees

    def _journal(self, projet) -> list[dict[str, Any]]:
        dossier = self._racine(projet) / "journal"
        if not dossier.is_dir():
            return []
        evenements = []
        for chemin in sorted(dossier.glob("*.json")):
            e = self.a.fichiers._lire_json(chemin)
            if isinstance(e, dict) and e.get("repere") == chemin.stem:
                evenements.append(e)
        return evenements

    def _noter(self, projet, genre, entree, qui, **charge) -> dict[str, Any]:
        """Un évènement de plus, **un fichier neuf** : rien n'est réécrit."""
        maintenant = time.time()
        e = {"repere": nouveau_repere(maintenant), "le": maintenant, "qui": qui, "genre": genre, "entree": entree} | charge
        self.a.fichiers._ecrire_json(self._racine(projet) / "journal" / f"{e['repere']}.json", e)
        return e

    def _vu(self, projet) -> dict[str, float]:
        vu = self.a.fichiers._lire_json(self._racine(projet) / "vu.json")
        return vu if isinstance(vu, dict) else {}

    # ── Déposer ──────────────────────────────────────────────────────────

    def deposer_entree(self, projet, brut, *, base: Path | None = None, par_l_auteur: bool = False) -> dict[str, Any]:
        """Crée ou met à jour une entrée, médias compris, **en un geste**.

        Idempotent sur l'identifiant : redéposer la même entrée ne double rien.
        Une entrée dont les médias ou le corps ont changé gagne une version ; la
        précédente reste dans l'histoire avec ce que l'auteur en a dit."""
        reglages = self.reglages(projet)
        d = depot_valide(brut, reglages, par_l_auteur=par_l_auteur)
        dossier = self._entree_dir(projet, d["identifiant"])
        with self._verrou(projet):
            avant = self.a.fichiers._lire_json(dossier / "entree.json")
            medias = [self._media(dossier, m, base) for m in d["medias"]]
            maintenant = time.time()
            if avant is None:
                entree = {
                    "identifiant": d["identifiant"], "type": d["type"], "titre": d["titre"], "resume": d["resume"],
                    "rayon": d["rayon"], "groupe": d["groupe"], "auteur": d["auteur"], "choix": d["choix"],
                    "attend": d["attend"], "cree_le": maintenant, "maj_le": maintenant,
                    "versions": [{"numero": 1, "le": maintenant, "change": d["change"], "corps": d["corps"], "medias": medias}],
                }
                genre = "depot"
            else:
                entree = dict(avant)
                courante = entree["versions"][-1]
                neuve = _signature(d["corps"], medias) != _signature(courante.get("corps", ""), courante["medias"])
                meta_avant = {k: avant.get(k) for k in ("type", "titre", "resume", "rayon", "groupe", "choix", "attend")}
                entree.update({k: d[k] for k in ("type", "titre", "resume", "rayon", "groupe", "choix", "attend")})
                entree["auteur"] = d["auteur"]
                if neuve:
                    entree["versions"] = entree["versions"] + [{"numero": courante["numero"] + 1, "le": maintenant,
                                                                "change": d["change"], "corps": d["corps"], "medias": medias}]
                    genre = "version"
                else:
                    # Mêmes sources : les légendes, défauts et conseils se mettent à jour sur place.
                    entree["versions"] = entree["versions"][:-1] + [courante | {"medias": medias}]
                    genre = None if meta_avant == {k: entree.get(k) for k in meta_avant} and courante["medias"] == medias else "maj"
                if genre:
                    entree["maj_le"] = maintenant
            self.a.fichiers._ecrire_json(dossier / "entree.json", entree)
            if genre:
                self._noter(projet, genre, entree["identifiant"], d["auteur"], version=entree["versions"][-1]["numero"],
                            change=d["change"])
        self._publier(projet, entree["identifiant"])
        return self.lire(projet, entree["identifiant"]) | {"change": genre or "rien"}

    def _media(self, dossier: Path, m: dict[str, Any], base: Path | None) -> dict[str, Any]:
        media = {k: m[k] for k in ("code", "legende", "defauts", "conseil", "provenance") if k in m}
        if m.get("asset"):
            asset = self.a.base.lire_asset(str(m["asset"]))
            if asset is None or asset.supprime:
                raise RegistreRefuse(f"Aucun asset « {m['asset']} » dans la bibliothèque.")
            return media | {"genre": "image", "asset": asset.identifiant, "empreinte": "asset:" + asset.identifiant}
        source = Path(str(m["fichier"]))
        if not source.is_absolute():
            if base is None:
                raise RegistreRefuse(f"« {m['fichier']} » : donnez un chemin complet sur le disque de l'atelier.")
            source = base / source
        if not source.is_file():
            raise RegistreRefuse(f"Le fichier « {source} » n'existe pas sur le disque de l'atelier.")
        octets = source.read_bytes()
        empreinte = hashlib.sha256(octets).hexdigest()
        ext = source.suffix.lower()
        nom = f"{empreinte[:16]}{ext}"
        cible = dossier / "medias" / nom
        if not cible.exists():
            self.a.fichiers._poser(cible, octets)
        media |= {"genre": GENRES_DE_MEDIA[ext], "fichier": f"medias/{nom}", "empreinte": empreinte,
                  "provenance": m.get("provenance") or str(source)}
        if m.get("sous_titres"):
            st = Path(str(m["sous_titres"]))
            st = st if st.is_absolute() or base is None else base / st
            if not st.is_file() or st.suffix.lower() != ".vtt":
                raise RegistreRefuse(f"Les sous-titres « {m['sous_titres']} » doivent être un fichier .vtt existant.")
            octets_st = st.read_bytes()
            nom_st = f"{hashlib.sha256(octets_st).hexdigest()[:16]}.vtt"
            self.a.fichiers._poser(dossier / "medias" / nom_st, octets_st)
            media["sous_titres"] = f"medias/{nom_st}"
        if media["genre"] == "texte":
            media["texte"] = octets.decode("utf-8", errors="replace")
        return media

    def televerser(self, projet, octets: bytes, nom: str) -> dict[str, Any]:
        """L'écran pose un fichier avant de créer l'entrée qui le montre (pas de
        `multipart`, comme pour l'import d'image : un fichier par appel). Le
        fichier attend sous `registre/televersements/`, nommé par son empreinte ;
        `deposer_depuis_l_ecran` le prend ensuite par ce nom."""
        ext = Path(nom or "").suffix.lower()
        if ext not in GENRES_DE_MEDIA and ext not in (".vtt",):
            raise RegistreRefuse(f"« {nom} » n'est ni une image, ni une vidéo, ni un son, ni un texte.")
        if not octets:
            raise RegistreRefuse(f"« {nom} » est vide.")
        fichier = f"{hashlib.sha256(octets).hexdigest()[:16]}{ext}"
        self.a.fichiers._poser(self._racine(projet) / "televersements" / fichier, octets)
        return {"fichier": fichier, "nom": nom}

    def deposer_depuis_l_ecran(self, projet, brut) -> dict[str, Any]:
        """Le parcours manuel, complet sans agent : l'auteur crée une entrée et y
        met ses images. Il signe « auteur »."""
        if not isinstance(brut, dict):
            raise RegistreRefuse("Une entrée se crée comme un objet JSON.")
        brut = dict(brut)
        auteur = brut.pop("auteur", None)
        if auteur not in (None, AUTEUR):
            raise RegistreRefuse("Depuis l'écran, c'est l'auteur qui dépose.")
        for m in brut.get("medias", []) or []:
            if isinstance(m, dict) and m.get("fichier") and ("/" in m["fichier"] or "\\" in m["fichier"]):
                raise RegistreRefuse("Depuis l'écran, un média vient d'un fichier téléversé.")
        return self.deposer_entree(projet, brut | {"auteur": AUTEUR}, base=self._racine(projet) / "televersements",
                            par_l_auteur=True)

    # ── La boîte de dépôt par fichiers ───────────────────────────────────

    def relever_depots(self, projet) -> list[dict[str, Any]]:
        """Prend ce que les agents sans réseau ont posé dans `registre/depot/`.

        Un dossier par entrée, `entree.json` dedans (écrit **en dernier**), ses
        médias à côté, nommés relativement. Un dépôt pris part dans
        `depot/.pris/` — rien n'est effacé. Un dépôt refusé **reste là** et sa
        raison s'affiche à l'écran, et dans `depot/<dossier>/REFUS.txt` pour
        l'agent qui ne voit pas l'écran."""
        depot = self._racine(projet) / "depot"
        if not depot.is_dir():
            return []
        refus = []
        for dossier in sorted(p for p in depot.iterdir() if p.is_dir() and not p.name.startswith(".")):
            fichier = dossier / "entree.json"
            if not fichier.is_file():
                continue
            brut = self.a.fichiers._lire_json(fichier)
            try:
                if brut is None:
                    raise RegistreRefuse("entree.json est illisible (JSON mal formé, ou encore en cours d'écriture).")
                self.deposer_entree(projet, brut, base=dossier)
            except RegistreRefuse as e:
                raison = e.raison
                (dossier / "REFUS.txt").write_text(raison + "\n", encoding="utf-8")
                refus.append({"dossier": dossier.name, "raison": raison, "le": fichier.stat().st_mtime})
                continue
            pris = depot / ".pris" / f"{dossier.name}-{nouveau_repere()}"
            pris.parent.mkdir(parents=True, exist_ok=True)
            (dossier / "REFUS.txt").unlink(missing_ok=True)
            shutil.move(str(dossier), str(pris))
        return refus

    # ── Relire ───────────────────────────────────────────────────────────

    def _vue(self, entree, journal, reglages, vu) -> dict[str, Any]:
        etat = etat_de_l_entree(entree, journal, self._type(reglages, entree["type"]))
        courante = entree["versions"][-1] if entree.get("versions") else {"numero": 0, "medias": []}
        vu_le = vu.get(entree["identifiant"])
        return {
            "identifiant": entree["identifiant"], "type": entree["type"],
            "nom_type": self._type(reglages, entree["type"])["nom"], "titre": entree["titre"],
            "resume": entree.get("resume", ""), "rayon": entree.get("rayon"), "groupe": entree.get("groupe"),
            "auteur": entree.get("auteur"), "choix": entree.get("choix", False),
            "cree_le": entree["cree_le"], "maj_le": entree["maj_le"],
            "version": courante["numero"], "versions": len(entree.get("versions", [])),
            "nouveau": vu_le is None, "mis_a_jour": vu_le is not None and entree["maj_le"] > vu_le,
            "vignette": next((m for m in courante["medias"] if m["genre"] == "image"), None),
            "medias": len(courante["medias"]),
        } | etat

    def lire(self, projet, identifiant) -> dict[str, Any]:
        """Une entrée entière : sa version courante, son histoire, ses remarques."""
        entree = self._entree(projet, identifiant)
        journal = self._journal(projet)
        reglages = self.reglages(projet)
        vue = self._vue(entree, journal, reglages, self._vu(projet))
        evs = [e for e in evenements_valides(journal) if e.get("entree") == identifiant]
        annulables = {e["repere"] for e in evs if e["qui"] == AUTEUR and e["genre"] in ("decision", "choix", "remarque")}
        courante = entree["versions"][-1]
        return vue | {
            "corps": courante.get("corps", ""), "change": courante.get("change"),
            "propositions": courante["medias"],
            "histoire": [{"numero": v["numero"], "le": v["le"], "change": v.get("change"), "corps": v.get("corps", ""),
                          "medias": v["medias"],
                          "dit": [e for e in evs if e.get("version") == v["numero"] and e["qui"] == AUTEUR]}
                         for v in entree["versions"][:-1]][::-1],
            "remarques": etat_des_remarques(journal, identifiant),
            "journal": [e | {"annulable": e["repere"] in annulables} for e in evs],
        }

    def accueil(self, projet) -> dict[str, Any]:
        """Ce que l'auteur voit en ouvrant : **à trancher** d'abord, dans
        l'ordre d'arrivée, puis ce qui est neuf ou mis à jour, puis le reste
        par rayon. Ce qui est écarté ou remplacé sort de la vue, sans se perdre."""
        refus = self.relever_depots(projet)
        reglages = self.reglages(projet)
        journal = self._journal(projet)
        vu = self._vu(projet)
        vues = [self._vue(e, journal, reglages, vu) for e in self._entrees(projet)]
        a_trancher = sorted((v for v in vues if v["etat"] == "a-trancher"), key=lambda v: v["cree_le"])
        deja = {v["identifiant"] for v in a_trancher}
        neuves = sorted((v for v in vues if v["identifiant"] not in deja and not v["hors_vue"]
                         and (v["nouveau"] or v["mis_a_jour"])), key=lambda v: -v["maj_le"])
        deja |= {v["identifiant"] for v in neuves}
        reste = [v for v in vues if v["identifiant"] not in deja and not v["hors_vue"]]
        par_rayon = []
        for r in reglages["rayons"] + [{"cle": None, "nom": "Sans rayon"}]:
            dedans = sorted((v for v in reste if v["rayon"] == r["cle"]), key=lambda v: -v["maj_le"])
            if dedans:
                par_rayon.append({"rayon": r["cle"], "nom": r["nom"], "entrees": dedans})
        return {
            "projet": projet, "a_trancher": a_trancher, "nouveautes": neuves, "par_rayon": par_rayon,
            "hors_vue": sorted((v for v in vues if v["hors_vue"]), key=lambda v: -v["maj_le"]),
            "depots_refuses": refus, "reglages": reglages, "total": len(vues),
            "boite_de_depot": str(self._racine(projet) / "depot"),
        }

    def lister(self, projet, *, etat=None, type_=None, rayon=None, auteur=None, attend_l_auteur=False,
               depuis: float | None = None, texte=None, limite: int = LIMITE_PAR_DEFAUT, hors_vue=False) -> dict[str, Any]:
        """La liste filtrée, **courte par défaut** : une ligne par entrée."""
        refus = self.relever_depots(projet)
        reglages = self.reglages(projet)
        journal = self._journal(projet)
        vu = self._vu(projet)
        vues = [self._vue(e, journal, reglages, vu) for e in self._entrees(projet)]
        if etat:
            if etat not in ETATS:
                raise RegistreRefuse(f"État « {etat} » inconnu. États : {', '.join(ETATS)}.")
            vues = [v for v in vues if v["etat"] == etat]
        elif not hors_vue:
            vues = [v for v in vues if not v["hors_vue"]]
        if type_:
            vues = [v for v in vues if v["type"] == type_]
        if rayon:
            vues = [v for v in vues if v["rayon"] == rayon]
        if auteur:
            vues = [v for v in vues if v["auteur"] == auteur]
        if attend_l_auteur:
            vues = [v for v in vues if v["etat"] == "a-trancher"]
        if depuis is not None:
            vues = [v for v in vues if v["maj_le"] > depuis]
        if texte:
            t = texte.lower()
            vues = [v for v in vues if t in v["titre"].lower() or t in (v["resume"] or "").lower()]
        vues.sort(key=lambda v: -v["maj_le"])
        limite = max(1, min(int(limite or LIMITE_PAR_DEFAUT), 500))
        return {"total": len(vues), "rendues": min(len(vues), limite), "depots_refuses": refus,
                "entrees": [{k: v[k] for k in ("identifiant", "titre", "type", "etat", "porte", "rayon", "groupe",
                                               "auteur", "version", "maj_le", "pris", "attend")}
                            for v in vues[:limite]]}

    def chemin_media(self, projet, identifiant, fichier) -> Path:
        dossier = self._entree_dir(projet, identifiant) / "medias"
        chemin = (dossier / Path(fichier).name)
        if not chemin.is_file():
            raise RegistreRefuse("Ce média n'existe plus.")
        return chemin

    # ── Les gestes de l'auteur ───────────────────────────────────────────

    def decider(self, projet, identifiant, geste, *, porte=None, mot=None) -> dict[str, Any]:
        """Valider, demander une reprise, écarter, mettre en pause, relancer.

        **Une décision est un état** : décider deux fois la même chose ne crée
        rien ; la réponse dit `deja`."""
        if geste not in GESTES:
            raise RegistreRefuse(f"Geste « {geste} » inconnu. Gestes : {', '.join(sorted(GESTES))}.")
        with self._verrou(projet):
            vue = self.lire(projet, identifiant)
            if geste == "valider":
                porte = porte or vue["porte"]
                if porte is None:
                    return vue | {"deja": True}
                cles = [p["cle"] for p in vue["portes"]]
                if porte not in cles:
                    raise RegistreRefuse(f"Ce type n'a pas de porte « {porte} ». Portes : {', '.join(cles) or 'aucune'}.")
                if next(p for p in vue["portes"] if p["cle"] == porte)["passee"]:
                    return vue | {"deja": True}
                if vue["choix"] and not vue["pris"]:
                    raise RegistreRefuse("Prenez d'abord une proposition (ou plusieurs) : c'est ce choix qu'on valide.")
            elif geste == "reprise":
                if not (mot or "").strip():
                    raise RegistreRefuse("Une reprise se demande avec un mot : ce qu'il faut changer.")
                if vue["etat"] == "reprise-demandee" and vue["reprise"] == mot.strip():
                    return vue | {"deja": True}
            elif geste == "ecarter" and vue["etat"] == "ecartee" or geste == "pause" and vue["etat"] == "en-pause":
                return vue | {"deja": True}
            elif geste == "relancer" and vue["etat"] not in ("ecartee", "en-pause"):
                return vue | {"deja": True}
            self._noter(projet, "decision", identifiant, AUTEUR, geste=geste, porte=porte,
                        mot=(mot or "").strip() or None, version=vue["version"])
        self._publier(projet, identifiant)
        return self.lire(projet, identifiant) | {"deja": False}

    def prendre(self, projet, identifiant, codes) -> dict[str, Any]:
        """« Je prends celle-ci » : une, plusieurs ou aucune proposition, sur la
        version courante. Reprendre le même choix ne crée rien."""
        if not isinstance(codes, list) or not all(isinstance(c, str) for c in codes):
            raise RegistreRefuse("Un choix est une liste de codes de propositions.")
        with self._verrou(projet):
            vue = self.lire(projet, identifiant)
            connus = [m["code"] for m in vue["propositions"]]
            inconnus = [c for c in codes if c not in connus]
            if inconnus:
                raise RegistreRefuse(f"Proposition inconnue : {', '.join(inconnus)}. Propositions : {', '.join(connus)}.")
            codes = [c for c in connus if c in codes]  # l'ordre de la version, sans doublon
            if vue["pris"] == codes:
                return vue | {"deja": True}
            self._noter(projet, "choix", identifiant, AUTEUR, codes=codes, version=vue["version"])
        self._publier(projet, identifiant)
        return self.lire(projet, identifiant) | {"deja": False}

    def remarquer(self, projet, identifiant, texte, *, sorte="remarque", cible=None) -> dict[str, Any]:
        if not isinstance(texte, str) or not texte.strip():
            raise RegistreRefuse("Une remarque a un texte.")
        if sorte not in SORTES_DE_REMARQUE:
            raise RegistreRefuse(f"Sorte de remarque inconnue. Sortes : {', '.join(SORTES_DE_REMARQUE)}.")
        vue = self.lire(projet, identifiant)
        if cible is not None and cible not in {m["code"] for m in vue["propositions"]}:
            raise RegistreRefuse(f"Aucun média « {cible} » sur la version courante.")
        self._noter(projet, "remarque", identifiant, AUTEUR, texte=texte.strip(), sorte=sorte, cible=cible,
                    version=vue["version"])
        self._publier(projet, identifiant)
        return self.lire(projet, identifiant)

    def annuler(self, projet, repere) -> dict[str, Any]:
        """Revenir sur une décision, un choix ou une remarque de l'auteur."""
        journal = {e["repere"]: e for e in self._journal(projet)}
        e = journal.get(repere)
        if e is None or e["qui"] != AUTEUR or e["genre"] not in ("decision", "choix", "remarque"):
            raise RegistreRefuse("Seule une décision, un choix ou une remarque de l'auteur s'annule.")
        if any(x["genre"] == "annulation" and x.get("annule") == repere for x in journal.values()):
            return self.lire(projet, e["entree"]) | {"deja": True}
        self._noter(projet, "annulation", e["entree"], AUTEUR, annule=repere)
        self._publier(projet, e["entree"])
        return self.lire(projet, e["entree"]) | {"deja": False}

    def marquer_vu(self, projet, identifiants: list[str] | None = None) -> dict[str, Any]:
        """« Vu » pour une entrée, ou pour tout (`None`). L'écran seul l'écrit."""
        with self._verrou(projet):
            vu = self._vu(projet)
            for entree in self._entrees(projet):
                if identifiants is None or entree["identifiant"] in identifiants:
                    vu[entree["identifiant"]] = entree["maj_le"]
            self.a.fichiers._ecrire_json(self._racine(projet) / "vu.json", vu)
        self._publier(projet)
        return {"vu": len(vu)}

    # ── Les gestes de l'agent ────────────────────────────────────────────

    @staticmethod
    def _agent(qui) -> str:
        if not isinstance(qui, str) or not qui.strip():
            raise RegistreRefuse("Dites qui écrit (le nom de l'agent ou du fil).")
        if qui.strip() == AUTEUR:
            raise RegistreRefuse(f"« {AUTEUR} » est réservé à l'auteur du jeu.")
        return qui.strip()

    def repondre(self, projet, remarque, texte, *, etat=None, qui) -> dict[str, Any]:
        qui = self._agent(qui)
        if etat is not None and (etat not in ETATS_DE_REMARQUE or etat == "envoyee"):
            raise RegistreRefuse("État de réponse inconnu. États : vue, en-cours, faite, refusee.")
        if not (texte or "").strip() and etat is None:
            raise RegistreRefuse("Une réponse porte un texte, un état, ou les deux.")
        cible = next((e for e in self._journal(projet) if e["repere"] == remarque and e["genre"] == "remarque"), None)
        if cible is None:
            raise RegistreRefuse(f"Aucune remarque « {remarque} ».")
        self._noter(projet, "reponse", cible["entree"], qui, remarque=remarque, texte=(texte or "").strip(), etat=etat)
        self._publier(projet, cible["entree"])
        return {"remarques": etat_des_remarques(self._journal(projet), cible["entree"])}

    def statuer(self, projet, identifiant, statut, *, qui, par=None) -> dict[str, Any]:
        """En cours, intégrée au jeu, retirée, remplacée par une autre entrée.
        **Jamais validée** : la validation est un geste de l'auteur."""
        qui = self._agent(qui)
        if statut not in STATUTS_D_AGENT:
            raise RegistreRefuse(f"Statut « {statut} » inconnu. Un agent peut dire : {', '.join(sorted(STATUTS_D_AGENT))}. "
                                 "Valider est un geste de l'auteur.")
        self._entree(projet, identifiant)
        if statut == "remplacee":
            if not par:
                raise RegistreRefuse("Dites par quelle entrée celle-ci est remplacée.")
            self._entree(projet, par)
        self._noter(projet, "statut", identifiant, qui, statut=statut, par=par)
        self._publier(projet, identifiant)
        return self.lire(projet, identifiant)

    def attendre(self, projet, identifiant, texte, *, qui) -> dict[str, Any]:
        """« J'attends ce choix pour lancer les 36 cartes » : ce que la décision débloque."""
        qui = self._agent(qui)
        self._entree(projet, identifiant)
        self._noter(projet, "attente", identifiant, qui, texte=(texte or "").strip() or None)
        self._publier(projet, identifiant)
        return self.lire(projet, identifiant)

    def decisions_depuis(self, projet, repere=None, *, lecteur=None, avancer=True) -> dict[str, Any]:
        """**Ce que l'auteur a fait depuis un repère** : décisions, choix,
        remarques, annulations — chacun une fois. Avec `lecteur`, le repère est
        gardé pour lui (`lecteurs/<lecteur>.json`) et avance tout seul."""
        chemin = None
        if lecteur is not None:
            chemin = self._racine(projet) / "lecteurs" / f"{identifiant_valide(lecteur, 'Le nom du lecteur')}.json"
            if repere is None:
                garde = self.a.fichiers._lire_json(chemin) or {}
                repere = garde.get("repere")
        journal = self._journal(projet)
        titres = {e["identifiant"]: e["titre"] for e in self._entrees(projet)}
        neufs = [e for e in sorted(journal, key=lambda e: e["repere"])
                 if e["qui"] == AUTEUR and (repere is None or e["repere"] > repere)]
        dernier = max((e["repere"] for e in journal), default=repere)
        if chemin is not None and avancer and dernier:
            self.a.fichiers._ecrire_json(chemin, {"repere": dernier, "le": time.time()})
        return {"depuis": repere, "repere": dernier,
                "evenements": [e | {"titre": titres.get(e.get("entree"))} for e in neufs]}

    # ── Le journal et la rétrospective ───────────────────────────────────

    def retrospective(self, projet) -> str:
        """La rétrospective **déduite du journal**, en Markdown : dans l'ordre
        où les choses ont été montrées, « montré / l'auteur a dit / décidé »."""
        journal = evenements_valides(self._journal(projet))
        entrees = {e["identifiant"]: e for e in self._entrees(projet)}
        lignes = [f"# Rétrospective du registre — {projet}", ""]
        for e in journal:
            entree = entrees.get(e.get("entree"), {})
            titre = entree.get("titre", e.get("entree"))
            jour = time.strftime("%Y-%m-%d %H:%M", time.localtime(e["le"]))
            if e["genre"] in ("depot", "version"):
                lignes.append(f"## {jour} · Montré : {titre} (v{e.get('version')}, par {e['qui']})")
                if e.get("change"):
                    lignes.append(f"- Ce qui a changé : {e['change']}")
            elif e["genre"] == "remarque":
                cible = f" sur « {e['cible']} »" if e.get("cible") else ""
                lignes.append(f"- {jour} · L'auteur a dit{cible} ({SORTES_DE_REMARQUE.get(e.get('sorte'), '')}) : {e['texte']}")
            elif e["genre"] == "decision":
                mot = f" — {e['mot']}" if e.get("mot") else ""
                lignes.append(f"- {jour} · Décidé sur « {titre} » : {e['geste']}{(' ' + e['porte']) if e.get('porte') else ''}{mot}")
            elif e["genre"] == "choix":
                lignes.append(f"- {jour} · Pris sur « {titre} » : {', '.join(e['codes']) or 'aucune proposition'}")
            elif e["genre"] == "reponse" and e.get("texte"):
                lignes.append(f"- {jour} · {e['qui']} a répondu : {e['texte']}")
        return "\n".join(lignes) + "\n"


def _signature(corps: str, medias: list[dict[str, Any]]) -> str:
    return json.dumps([corps or "", sorted((m["code"], m.get("empreinte")) for m in medias)], ensure_ascii=False)
