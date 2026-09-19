"""Livraisons Godot : versions préparées, publication bornée et reprise.

Les trois fichiers d'une bande viennent de ServiceExport. Les révisions sont
immuables ; un seul fichier de scène stable bascule vers une révision complète.
Le journal est écrit avant les fichiers du jeu, le manifeste après eux. La
propriété d'un fichier se prouve dans les données de l'atelier, jamais par son nom.
"""

from __future__ import annotations

import contextlib
import copy
import functools
import hashlib
import json
import math
import os
import re
import tempfile
import time
import uuid
from pathlib import Path, PurePosixPath
from typing import Any, Iterator, Sequence

from atelier.depot import Base, Fichiers
from atelier.domaine import aseprite
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.projet import repere
from atelier.services.evenements import Diffusion
from atelier.services.export import ServiceExport
from atelier.services.production import ServiceProduction


class LivraisonRefusee(ErreurAtelier):
    code = "livraison_refusee"


#: Les trois décisions qu'un conflit accepte, et rien d'autre (`RP10`).
#: `conserver` n'écrit rien, `copier` écrit à côté, `remplacer` écrit par-dessus.
DECISIONS = ("conserver", "copier", "remplacer")


def _erreurs_disque(geste):
    @functools.wraps(geste)
    def appeler(*args, **kwargs):
        try:
            return geste(*args, **kwargs)
        except OSError as erreur:
            raise LivraisonRefusee(f"Impossible d'accéder aux fichiers de livraison : {erreur}. Vérifier le dossier et les droits d'écriture.") from erreur
    return appeler


def _json(objet: Any) -> bytes:
    return json.dumps(objet, ensure_ascii=False, sort_keys=True, indent=2).encode("utf-8")


def _empreinte(octets: bytes) -> str:
    return hashlib.sha256(octets).hexdigest()


def _cle(identifiant: str) -> str:
    return repere(identifiant, (), "sujet")[:48] + "-" + _empreinte(identifiant.encode())[:10]


def _relatif(chemin: str) -> str:
    texte = str(chemin).replace("\\", "/")
    parties = texte.split("/")
    if not texte or any(p in ("", ".", "..") or ":" in p or p != p.rstrip(". ")
                        or any(c in '<>"|?*' for c in p) for p in parties):
        raise LivraisonRefusee("Le sous-dossier doit être un chemin relatif sans remontée ni lecteur.")
    if any(any(ord(c) < 32 for c in p) for p in parties):
        raise LivraisonRefusee("Le chemin contient un caractère de contrôle.")
    return PurePosixPath(*parties).as_posix()


def _destination(fichier: dict[str, Any]) -> str:
    """Où ce fichier s'écrit : chez lui, ou à côté si l'auteur a dit *copier*."""
    return fichier.get("voisin") or fichier["chemin"]


def _voisin(chemin: str) -> str:
    """Le nom de la copie posée à côté d'un fichier qu'on ne remplace pas.

    Un segment ajouté avant l'extension, jamais une extension changée : Godot
    reconnaît une scène à son `.tscn`, et un `personnage.tscn.copie` ne
    s'ouvrirait nulle part.
    """
    nom = PurePosixPath(chemin)
    return str(nom.with_name(nom.stem + ".copie-atelier" + nom.suffix))


def _borne(racine: Path, relatif: str) -> Path:
    """Refuse aussi les liens internes : leur cible pourrait changer ensuite."""
    relatif = _relatif(relatif)
    chemin = racine
    for partie in PurePosixPath(relatif).parts:
        chemin = chemin / partie
        if chemin.is_symlink() or getattr(chemin, "is_junction", lambda: False)():
            raise LivraisonRefusee(f"« {chemin} » est un lien : choisir un dossier physique pour livrer.")
    if not chemin.resolve().is_relative_to(racine.resolve()):
        raise LivraisonRefusee("Le fichier sortirait du projet Godot associé.")
    return chemin


def _lire(chemin: Path, defaut: Any = None) -> Any:
    if not chemin.exists():
        return defaut
    try:
        return json.loads(chemin.read_text(encoding="utf-8"))
    except (OSError, ValueError) as erreur:
        raise LivraisonRefusee(f"Impossible de relire « {chemin.name} » : {erreur}") from erreur


def _hash_du_fichier(chemin: Path) -> str | None:
    if not chemin.exists():
        return None
    if not chemin.is_file():
        raise LivraisonRefusee(f"« {chemin} » est un dossier, pas un fichier à livrer.")
    return _empreinte(chemin.read_bytes())


def _poser(chemin: Path, octets: bytes) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    # Un nom temporaire exclusif évite de toucher un .ecriture créé par l'auteur.
    fd, nom = tempfile.mkstemp(prefix=".asset-kitchen-", dir=chemin.parent)
    try:
        with os.fdopen(fd, "wb") as flux:
            flux.write(octets)
            flux.flush()
            os.fsync(flux.fileno())
        os.replace(nom, chemin)
    finally:
        Path(nom).unlink(missing_ok=True)


@contextlib.contextmanager
def _verrou(chemin: Path) -> Iterator[None]:
    """Verrou système libéré même si l'atelier s'arrête au milieu d'un dépôt."""
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("a+b") as flux:
        if flux.tell() == 0:
            flux.write(b"0")
            flux.flush()
        flux.seek(0)
        try:
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(flux.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(flux.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as erreur:
            raise LivraisonRefusee("Une autre livraison est en cours pour ce jeu. Relire son état.") from erreur
        try:
            yield
        finally:
            if os.name == "nt":
                flux.seek(0)
                msvcrt.locking(flux.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(flux.fileno(), fcntl.LOCK_UN)


class ServiceLivraison:
    def __init__(self, base: Base, fichiers: Fichiers, export: ServiceExport,
                 production: ServiceProduction, diffusion: Diffusion) -> None:
        self._base, self._fichiers, self._export = base, fichiers, export
        self._production, self._diffusion = production, diffusion
        self._racine = fichiers.racine / "livraisons"
        # SN6 : `(projet, sujet) -> paquet | None`, les sons qui partent avec
        # le sujet (`ServiceSonsDuSujet.paquet_pour_livraison`). Posé par
        # l'atelier après montage ; absent, un sujet se livre sans ses sons.
        self.sons_du_sujet = None
        # SN7 : `(projet, sujet) -> [{bande, image, cle}]`, les repères sonores
        # du sujet (`ServiceReperesSonores.pour_livraison`). Absent ou vide, la
        # scène n'a pas d'`AnimationPlayer` : le paquet est celui d'avant.
        self.reperes_sonores = None

    def _dossier(self, projet: str) -> Path:
        if not self._base.lire_projet(projet):
            raise LivraisonRefusee(f"Le jeu « {projet} » n'existe plus dans l'atelier.")
        return self._racine / _cle(projet)

    @_erreurs_disque
    def association(self, projet: str) -> dict[str, Any] | None:
        return _lire(self._dossier(projet) / "association.json")

    @_erreurs_disque
    def associer(self, projet: str, dossier: str,
                 sous_dossier: str = "assets/asset-kitchen") -> dict[str, Any]:
        interieur = self._dossier(projet)
        if not dossier.strip() or not Path(dossier).expanduser().is_absolute():
            raise LivraisonRefusee("Choisir le chemin absolu du dossier du jeu Godot.")
        racine = Path(dossier).expanduser().resolve()
        version = self._version(racine)
        sous_dossier = _relatif(sous_dossier)
        _borne(racine, sous_dossier)
        association = {"projet": projet, "dossier": str(racine),
                       "sous_dossier": sous_dossier, "version_godot": version}
        with _verrou(interieur / ".verrou"):
            _poser(interieur / "association.json", _json(association))
        self._diffusion.publier("livraison", {"projet": projet, "association": association})
        return association

    @staticmethod
    def _version(racine: Path) -> str:
        fichier = racine / "project.godot"
        if not racine.is_dir() or not fichier.is_file():
            raise LivraisonRefusee(f"« {racine} » ne contient pas de fichier project.godot.")
        try:
            texte = fichier.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError) as erreur:
            raise LivraisonRefusee(f"Impossible de lire « {fichier} ». Vérifier son encodage et son accès.") from erreur
        version = re.search(r'config/features\s*=\s*PackedStringArray\(\s*"(\d+(?:\.\d+){0,2})"', texte)
        # Un projet neuf peut omettre features ; format 5 identifie Godot 4,
        # mais ne permet pas d'inventer la version mineure.
        if version and version.group(1).split(".")[0] != "4":
            raise LivraisonRefusee("Cette livraison cible Godot 4. Le projet associé annonce une autre version.")
        if not version and not re.search(r"(?m)^config_version\s*=\s*5\s*$", texte):
            raise LivraisonRefusee("La version du projet est inconnue. Ouvrir et enregistrer le projet avec Godot 4.")
        return version.group(1) if version else "4 · version mineure non déclarée"

    def _associe(self, projet: str) -> dict[str, Any]:
        association = self.association(projet)
        if not association:
            raise LivraisonRefusee("Associer d'abord le dossier du jeu Godot dans Livrer.")
        self._version(Path(association["dossier"]))
        _borne(Path(association["dossier"]), association["sous_dossier"])
        return association

    def animations(self, projet: str, personnage: str | None = None) -> list[dict[str, Any]]:
        self._dossier(projet)
        return [{"identifiant": b.identifiant, "nom": b.nom, "personnage": b.personnage,
                 "pose": b.pose, "direction": b.direction, "compte": b.compte,
                 "cadence": b.cadence, "sens": b.sens, "favori": b.favori,
                 "case_largeur": b.case_largeur, "case_hauteur": b.case_hauteur}
                for b in self._base.bandes()
                if b.projet == projet and not b.supprime and
                (personnage is None or b.personnage == personnage)]

    @_erreurs_disque
    def historique(self, projet: str) -> dict[str, Any]:
        dossier = self._dossier(projet)
        preparations = sorted((dossier / "preparations").glob("*.json"),
                              key=lambda p: p.stat().st_mtime, reverse=True)
        return {"association": self.association(projet),
                "livraisons": [self._vue(_lire(p)) for p in preparations]}

    def _blob(self, octets: bytes) -> str:
        empreinte = _empreinte(octets)
        chemin = self._racine / "octets" / empreinte
        if not chemin.exists():
            _poser(chemin, octets)
        return empreinte

    def _octets(self, empreinte: str) -> bytes:
        if not re.fullmatch(r"[a-f0-9]{64}", empreinte):
            raise LivraisonRefusee("L'empreinte du fichier préparé est invalide.")
        chemin = self._racine / "octets" / empreinte
        if not chemin.is_file():
            raise LivraisonRefusee("Un fichier préparé manque. Préparer à nouveau la livraison.")
        octets = chemin.read_bytes()
        if _empreinte(octets) != empreinte:
            raise LivraisonRefusee("Un fichier préparé a été modifié. Préparer à nouveau la livraison.")
        return octets

    @_erreurs_disque
    def prevoir(self, projet: str, personnage: str, bandes: Sequence[str], *,
                pivot_x: float | None = None, pivot_y: float | None = None,
                boucles: dict[str, bool] | None = None) -> dict[str, Any]:
        dossier = self._dossier(projet)
        self._production.personnage(projet, personnage)
        if not bandes:
            raise LivraisonRefusee("Choisir au moins une animation à livrer.")
        with _verrou(dossier / ".verrou"):
            association = self._associe(projet)
            cible = _cle(personnage)
            precedente = _lire(dossier / "cibles" / f"{cible}.json", {})
            # Changer de projet externe commence un paquet neuf. Jamais de
            # copie implicite vers un autre dossier d'une ancienne livraison.
            if precedente.get("association") != association:
                precedente = {}
            animations = {a["cle"]: a for a in precedente.get("animations", [])}
            choisies: set[str] = set()
            for identifiant in dict.fromkeys(bandes):
                bande = self._base.lire_bande(identifiant)
                if not bande or bande.supprime or bande.projet != projet or bande.personnage != personnage:
                    raise LivraisonRefusee(f"« {identifiant} » n'est pas une animation disponible de ce personnage.")
                # Un brouillon ne vise aucune case : son nom dans le jeu serait
                # son identifiant, et il changerait le jour où on la range.
                if bande.brouillon:
                    raise LivraisonRefusee(f"« {bande.nom or identifiant} » est un brouillon : lui donner son mouvement et sa direction avant de la livrer.")
                bande, _, planche, descriptif, animee = self._export.trois_fichiers(identifiant)
                if bande.compte == 0 or bande.case_largeur <= 0 or bande.case_hauteur <= 0:
                    raise LivraisonRefusee(f"« {bande.nom} » ne contient aucune frame exportable.")
                logique = f"{bande.pose or bande.identifiant}/{bande.direction or 'toutes'}/{bande.piece or 'corps'}"
                cle = _cle(logique)
                if cle in choisies:
                    raise LivraisonRefusee("Deux versions visent le même mouvement et la même direction. En choisir une.")
                choisies.add(cle)
                descriptif["meta"]["image"] = f"{cle}.png"
                provenance = self._export.fiche_de_la_bande(bande, cle, descriptif)
                # Les réglages par prise comptent dans la provenance, même si
                # le cache et le jugement changent ensuite dans la bibliothèque.
                provenance["prises"] = [p.en_json() for p in bande.prises]
                animations[cle] = {
                    "cle": cle, "bande": bande.identifiant,
                    "nom": f"{bande.pose or bande.identifiant}/{bande.direction or 'toutes'}" +
                           (f"/{bande.piece}" if bande.piece else ""),
                    "titre": bande.nom, "pose": bande.pose, "direction": bande.direction,
                    "compte": bande.compte, "ordre": aseprite.ordre_des_images(bande.compte, bande.sens),
                    "cadence": bande.cadence, "duree_image_ms": aseprite.duree_en_ms(bande.cadence),
                    "boucle": (boucles or {}).get(identifiant, True),
                    "largeur": bande.case_largeur, "hauteur": bande.case_hauteur,
                    "provenance": provenance,
                    "octets": {f"{cle}.png": self._blob(planche),
                               f"{cle}.json": self._blob(_json(descriptif)),
                               f"{cle}-anime.png": self._blob(animee)},
                }
            liste = sorted(animations.values(), key=lambda a: a["cle"])
            pivot = precedente.get("pivot", {"x": liste[0]["largeur"] / 2, "y": liste[0]["hauteur"]})
            pivot = {"x": pivot["x"] if pivot_x is None else pivot_x,
                     "y": pivot["y"] if pivot_y is None else pivot_y}
            if any(not isinstance(v, (int, float)) or not math.isfinite(v) or abs(v) > 8192 for v in pivot.values()):
                raise LivraisonRefusee("Le pivot doit contenir des coordonnées finies en pixels, entre −8192 et 8192.")
            # SN6 : les sons du sujet partent avec lui, sous leurs noms stables.
            # Sans son ni repère à signaler, rien ne change : ni la révision, ni
            # un octet du paquet (un sujet qui n'a ni son ni repère reste identique
            # octet pour octet — défaut confirmé le 19 septembre 2026 : un sujet
            # dont aucun emplacement n'était livrable perdait ses `sons_non_livres`
            # et ses `reperes_non_livres`, faute de lire les repères du tout).
            sons = self.sons_du_sujet(projet, personnage) if self.sons_du_sujet else None
            signe: dict[str, Any] = {"animations": liste, "pivot": pivot}
            if sons:
                signe["sons"] = {nom: _empreinte(octets) for nom, octets in sons["fichiers"].items()}
            # SN7 : les repères sonores deviennent une piste audio par animation.
            # Lus dès que le sujet a un repère, même sans aucun son livrable : un
            # repère sur un emplacement vide ou écarté doit rester signalé.
            reperes = self.reperes_sonores(projet, personnage) if self.reperes_sonores else []
            pistes, reperes_livres, reperes_non_livres = _pistes_sonores(liste, sons, reperes)
            if reperes_livres:
                signe["reperes"] = reperes_livres
            revision = _empreinte(_json(signe))[:24]
            racine = f"{association['sous_dossier']}/{_cle(projet)}/{cible}"
            version = f"{racine}/revisions/{revision}"
            fichiers: list[dict[str, Any]] = []

            def ajouter(nom: str, role: str, octets: bytes) -> None:
                fichiers.append({"chemin": nom, "role": role,
                                  "empreinte": self._blob(octets), "octets": len(octets)})

            for animation in liste:
                for nom, empreinte in animation["octets"].items():
                    role = "aperçu animé" if nom.endswith("-anime.png") else "planche" if nom.endswith(".png") else "Aseprite"
                    ajouter(f"{version}/{nom}", role, self._octets(empreinte))
            noeuds_sonores: list[dict[str, str]] = []
            if sons:
                from atelier.services.sons import fichier_import
                dossier_sons = f"{version}/sons"
                for nom, octets in sons["fichiers"].items():
                    ajouter(f"{dossier_sons}/{nom}", "son" if nom.endswith((".wav", ".ogg")) else "ressource Godot"
                            if nom.endswith(".tres") else "crédits", octets)
                for nom, format_audio, params in sons["imports"]:
                    ajouter(f"{dossier_sons}/{nom}.import", "import Godot",
                            fichier_import(nom, format_audio, params, "res://" + dossier_sons))
                noeuds_sonores = [{**n, "ressource": f"{dossier_sons}/{n['ressource']}"} for n in sons["noeuds"]]
            sprite_frames = f"{version}/animations.tres"
            ajouter(sprite_frames, "SpriteFrames", _sprite_frames(liste, version).encode("utf-8"))
            scene_revision = f"{version}/personnage.tscn"
            ajouter(scene_revision, "scène de la révision", _scene(sprite_frames, liste[0]["nom"], pivot, noeuds_sonores, pistes).encode("utf-8"))
            scene = f"{racine}/personnage.tscn"
            ajouter(scene, "scène stable", _scene_stable(scene_revision).encode("utf-8"))
            manifeste = {"atelier": "Asset Kitchen", "format": 1, "projet": projet,
                         "personnage": personnage, "revision": revision,
                         "association": association, "pivot": pivot,
                         "animations": liste, "scene": scene,
                         "sprite_frames": sprite_frames, "fichiers": list(fichiers)}
            if sons:
                if sons["entrees"]:
                    manifeste["sons"] = [{**e, "ressource": f"{version}/sons/{e['ressource']}"} for e in sons["entrees"]]
                if sons["non_livres"]:
                    manifeste["sons_non_livres"] = sons["non_livres"]
                if sons.get("avertissement_renommage"):
                    manifeste["sons_avertissement"] = sons["avertissement_renommage"]
            if reperes_livres:
                manifeste["reperes_sonores"] = reperes_livres
            if reperes_non_livres:
                manifeste["reperes_non_livres"] = reperes_non_livres
            ajouter(f"{racine}/livraison.json", "manifeste", _json(manifeste))
            jeton = uuid.uuid4().hex
            preparation = {**manifeste, "jeton": jeton, "fichiers": fichiers,
                           "etat": "preparee", "prepare_le": time.time(),
                           "base": precedente.get("jeton"), "ecrits": []}
            self._examiner(preparation, precedente.get("possedes", {}))
            _poser(dossier / "preparations" / f"{jeton}.json", _json(preparation))
            return self._vue(preparation)

    @_erreurs_disque
    def preparer_paquet(self, projet: str, personnage: str | None, cible: str,
                        manifeste: dict[str, Any], contenus: dict[str, bytes], *,
                        scene: str, sprite_frames: str | None = None,
                        ressource: str | None = None, scene_stable: str = "personnage.tscn",
                        noeud_stable: str = "Personnage",
                        completer: Any = None) -> dict[str, Any]:
        """Paquet CPU interne déjà composé, publié avec les garanties d'AU1.

        La cible sépare tenue/couches/assemblé de la livraison du corps. Ce
        geste ne reçoit ni chemin absolu ni octets depuis une route HTTP.
        `completer(dossier_res)` rend les fichiers qui nomment leur propre
        chemin final (le `.import` d'un son, SN4) : ils ne dépendent que du
        paquet, et la révision se calcule sans eux.
        """
        dossier = self._dossier(projet)
        if personnage is not None:
            self._production.personnage(projet, personnage)
        if not contenus or scene not in contenus or (sprite_frames is None and ressource is None) or any(n is not None and n not in contenus for n in (sprite_frames, ressource)):
            raise LivraisonRefusee("Le paquet doit contenir sa scène et les ressources qu’elle utilise.")
        for nom, contenu in contenus.items():
            if _relatif(nom) != nom or not isinstance(contenu, bytes):
                raise LivraisonRefusee("Un fichier du paquet est invalide.")
        with _verrou(dossier / ".verrou"):
            association = self._associe(projet)
            cible_livraison = _cle(cible)
            precedente = _lire(dossier / "cibles" / f"{cible_livraison}.json", {})
            if precedente.get("association") != association:
                precedente = {}
            empreintes = {nom: self._blob(octets) for nom, octets in contenus.items()}
            revision = _empreinte(_json({"manifeste": manifeste, "octets": empreintes}))[:24]
            racine = f"{association['sous_dossier']}/{_cle(projet)}/{cible_livraison}"
            version = f"{racine}/revisions/{revision}"
            if completer is not None:
                ajouts = completer("res://" + version)
                if any(nom in contenus or _relatif(nom) != nom or not isinstance(o, bytes) for nom, o in ajouts.items()):
                    raise LivraisonRefusee("Un fichier du paquet est invalide.")
                contenus = {**contenus, **ajouts}
                empreintes |= {nom: self._blob(octets) for nom, octets in ajouts.items()}
            fichiers = [{"chemin": f"{version}/{nom}", "role": "composition" if nom == 'composition.json' else "Aseprite" if nom.endswith('.json') and manifeste.get("nature") not in {"image", "tuiles", "son", "audio"} else "ressource Godot" if nom.endswith(('.tres', '.tscn', '.gd', '.gdshader')) else "image" if nom.endswith('.png') else "son" if nom.endswith(('.wav', '.ogg')) else "import Godot" if nom.endswith('.import') else "provenance",
                         "empreinte": empreintes[nom], "octets": len(octets)} for nom, octets in contenus.items()]
            scene_stable = f"{racine}/{_relatif(scene_stable)}"
            scene_octets = _scene_stable(f"{version}/{scene}", noeud_stable).encode("utf-8")
            fichiers.append({"chemin": scene_stable, "role": "scène stable", "empreinte": self._blob(scene_octets), "octets": len(scene_octets)})
            fiche = {**manifeste, "atelier": "Asset Kitchen", "format": 1,
                     "projet": projet, "personnage": personnage, "cible_livraison": cible_livraison,
                     "revision": revision, "association": association, "scene": scene_stable,
                     "sprite_frames": f"{version}/{sprite_frames}" if sprite_frames else None, "fichiers": list(fichiers)}
            if ressource:
                fiche["ressource"] = f"{version}/{ressource}"
            octets_manifeste = _json(fiche)
            fichiers.append({"chemin": f"{racine}/livraison.json", "role": "manifeste", "empreinte": self._blob(octets_manifeste), "octets": len(octets_manifeste)})
            jeton = uuid.uuid4().hex
            preparation = {**fiche, "jeton": jeton, "fichiers": fichiers, "etat": "preparee",
                           "prepare_le": time.time(), "base": precedente.get("jeton"), "ecrits": []}
            self._examiner(preparation, precedente.get("possedes", {}))
            _poser(dossier / "preparations" / f"{jeton}.json", _json(preparation))
            return self._vue(preparation)

    def _examiner(self, preparation: dict[str, Any], possedes: dict[str, str],
                  *, reprise: bool = False) -> None:
        """Relit le dossier du jeu, et confronte chaque décision à ce qu'il contient.

        Une décision n'est retenue que si le fichier du jeu est **encore celui
        qu'elle a vu** (`RP10`) : elle porte son empreinte, et une empreinte qui
        a bougé rend le conflit à décider. Sans ça, une décision prise sur un
        écran ouvert depuis dix minutes écraserait autre chose que le fichier lu.
        """
        racine = Path(preparation["association"]["dossier"])
        prises = preparation.get("decisions") or {}
        retenues: dict[str, dict[str, Any]] = {}
        conflits = []
        for fichier in preparation["fichiers"]:
            for cle in ("decision", "voisin", "voisin_avant"):
                fichier.pop(cle, None)
            chemin = _borne(racine, fichier["chemin"])
            actuelle = _hash_du_fichier(chemin)
            connue = possedes.get(fichier["chemin"])
            # Une intention journalisée avant publication autorise la reprise
            # de notre propre nouveau fichier, pas l'appropriation d'un inconnu.
            fait = reprise and fichier["chemin"] in preparation.get("intentions", []) and actuelle == fichier["empreinte"]
            if actuelle is not None and not fait and (connue is None or actuelle != connue):
                fichier["etat"] = "conflit"
                conflit = {"chemin": fichier["chemin"], "decision": None, "raison":
                           "Fichier inconnu de l'atelier." if connue is None else "Fichier modifié dans le jeu."}
                prise = prises.get(fichier["chemin"]) or {}
                if prise.get("decision") in DECISIONS and prise.get("sur") == actuelle:
                    empeche = self._preparer_decision(racine, fichier, prise["decision"], possedes)
                    if empeche:
                        conflit["raison"] += " " + empeche
                    else:
                        conflit["decision"] = prise["decision"]
                        retenues[fichier["chemin"]] = {"decision": prise["decision"], "sur": actuelle}
                        if fichier.get("voisin"):
                            conflit["voisin"] = fichier["voisin"]
                conflits.append(conflit)
            else:
                fichier["etat"] = "inchange" if actuelle == fichier["empreinte"] else "nouveau" if actuelle is None else "remplace"
            fichier["avant"] = actuelle
        preparation["decisions"] = retenues
        preparation["conflits"] = conflits
        preparation["pret"] = all(c["decision"] for c in conflits)

    @staticmethod
    def _preparer_decision(racine: Path, fichier: dict[str, Any], decision: str,
                           possedes: dict[str, str]) -> str | None:
        """Pose sur le fichier ce que la décision demande ; rend ce qui l'empêche."""
        fichier["decision"] = decision
        if decision != "copier":
            return None
        voisin = _voisin(fichier["chemin"])
        actuelle = _hash_du_fichier(_borne(racine, voisin))
        if actuelle is not None and actuelle != possedes.get(voisin):
            fichier.pop("decision")
            return f"La copie « {voisin} » existe déjà et n'est pas de l'atelier."
        fichier["voisin"] = voisin
        fichier["voisin_avant"] = actuelle
        return None

    @staticmethod
    def _vue(preparation: dict[str, Any]) -> dict[str, Any]:
        if not preparation:
            return {}
        return {k: v for k, v in preparation.items()
                if k not in ("intentions", "possedes", "ecrits")} | {
                    "dossier": preparation["association"]["dossier"],
                    "scene": "res://" + preparation["scene"],
                    "sprite_frames": "res://" + preparation["sprite_frames"] if preparation.get("sprite_frames") else None,
                } | ({"ressource": "res://" + preparation["ressource"]} if preparation.get("ressource") else {})

    @_erreurs_disque
    def livrer(self, projet: str, jeton: str) -> dict[str, Any]:
        dossier = self._dossier(projet)
        if not re.fullmatch(r"[a-f0-9]{32}", jeton):
            raise LivraisonRefusee("La préparation de livraison est inconnue.")
        chemin_preparation = dossier / "preparations" / f"{jeton}.json"
        with _verrou(dossier / ".verrou"):
            preparation = _lire(chemin_preparation)
            if not preparation:
                raise LivraisonRefusee("Relire les fichiers avant de les livrer.")
            if preparation["etat"] == "terminee":
                return self._vue(preparation)
            if self._associe(projet) != preparation["association"]:
                raise LivraisonRefusee("Le dossier associé a changé. Relire la livraison pour ce dossier.")
            chemin_cible = dossier / "cibles" / f"{preparation.get('cible_livraison') or _cle(preparation['personnage'])}.json"
            precedente = _lire(chemin_cible, {})
            # La scène, le manifeste et la cible ont pu être publiés, puis le
            # processus fermé avant la dernière écriture du journal de réponse.
            if precedente.get("jeton") == jeton and precedente.get("etat") == "terminee":
                _poser(chemin_preparation, _json(precedente))
                return self._vue(precedente)
            if precedente.get("association") != preparation["association"]:
                precedente = {}
            if precedente.get("jeton") != preparation["base"]:
                raise LivraisonRefusee("Une autre révision a été livrée depuis cet aperçu. Relire les fichiers.")
            possedes = dict(precedente.get("possedes", {}))
            reprise = preparation["etat"] in ("en_cours", "interrompue")
            self._examiner(preparation, possedes, reprise=reprise)
            if not preparation["pret"]:
                _poser(chemin_preparation, _json(preparation))
                noms = ", ".join(c["chemin"] for c in preparation["conflits"] if not c["decision"])
                raise LivraisonRefusee(f"Conflit : {noms}. Décider de chacun avant de livrer ; les fichiers du jeu sont conservés.")
            # Vérifier tous les octets avant le premier fichier du jeu.
            for fichier in preparation["fichiers"]:
                self._octets(fichier["empreinte"])
            preparation["etat"] = "en_cours"
            preparation["intentions"] = [_destination(f) for f in preparation["fichiers"]
                                         if f.get("decision") != "conserver"]
            _poser(chemin_preparation, _json(preparation))
            racine = Path(preparation["association"]["dossier"])
            try:
                for fichier in preparation["fichiers"]:
                    # « Conserver » est une décision écrite de ne rien écrire là.
                    if fichier.get("decision") == "conserver":
                        continue
                    ou = _destination(fichier)
                    attendue = fichier["voisin_avant"] if fichier.get("voisin") else fichier["avant"]
                    cible = _borne(racine, ou)
                    actuelle = _hash_du_fichier(cible)
                    if actuelle != attendue:
                        raise LivraisonRefusee(f"« {ou} » a changé pendant la livraison. Le fichier est conservé.")
                    if actuelle != fichier["empreinte"]:
                        _poser(cible, self._octets(fichier["empreinte"]))
                    possedes[ou] = fichier["empreinte"]
                    preparation["ecrits"].append(ou)
                    _poser(chemin_preparation, _json(preparation))
                preparation["etat"] = "terminee"
                preparation["livre_le"] = time.time()
                preparation["possedes"] = possedes
                # La cible permet de récupérer une réponse perdue juste avant
                # la dernière écriture du journal (voir le cas ci-dessus).
                _poser(chemin_cible, _json(preparation))
                _poser(chemin_preparation, _json(preparation))
            except (OSError, LivraisonRefusee) as erreur:
                preparation["etat"] = "interrompue"
                preparation["raison"] = str(erreur)
                _poser(chemin_preparation, _json(preparation))
                raise LivraisonRefusee(f"Livraison interrompue : {erreur}. Réessayer reprend la même préparation.") from erreur
            self._diffusion.publier("livraison", {"projet": projet, "jeton": jeton, "etat": "terminee"})
            return self._vue(preparation)

    @_erreurs_disque
    def decider(self, projet: str, jeton: str, chemin: str, decision: str) -> dict[str, Any]:
        """Écrit la décision de l'auteur sur un conflit, et relit la préparation.

        Rien n'est écrit dans le jeu ici : la décision vit dans le journal de la
        préparation, et c'est `livrer` qui l'applique.
        """
        dossier = self._dossier(projet)
        if decision not in DECISIONS:
            raise LivraisonRefusee("Décider entre conserver, copier à côté et remplacer.")
        if not re.fullmatch(r"[a-f0-9]{32}", jeton):
            raise LivraisonRefusee("La préparation de livraison est inconnue.")
        chemin_preparation = dossier / "preparations" / f"{jeton}.json"
        with _verrou(dossier / ".verrou"):
            preparation = _lire(chemin_preparation)
            if not preparation:
                raise LivraisonRefusee("Relire les fichiers avant de décider.")
            if preparation["etat"] == "terminee":
                raise LivraisonRefusee("Cette livraison est terminée. Relire les fichiers pour en préparer une autre.")
            if chemin not in {f["chemin"] for f in preparation["fichiers"]}:
                raise LivraisonRefusee("Ce fichier n'est pas dans la livraison relue.")
            precedente = _lire(dossier / "cibles" / f"{preparation.get('cible_livraison') or _cle(preparation['personnage'])}.json", {})
            possedes = dict(precedente.get("possedes", {})) if precedente.get("association") == preparation["association"] else {}
            actuelle = _hash_du_fichier(_borne(Path(preparation["association"]["dossier"]), chemin))
            preparation["decisions"] = dict(preparation.get("decisions") or {}) | {
                chemin: {"decision": decision, "sur": actuelle}}
            self._examiner(preparation, possedes,
                           reprise=preparation["etat"] in ("en_cours", "interrompue"))
            retenue = next((c for c in preparation["conflits"] if c["chemin"] == chemin), None)
            if retenue is None:
                raise LivraisonRefusee(f"« {chemin} » n'est pas en conflit : il n'y a rien à décider.")
            if not retenue["decision"]:
                raise LivraisonRefusee(retenue["raison"])
            _poser(chemin_preparation, _json(preparation))
            return self._vue(preparation)

    @_erreurs_disque
    def reprendre(self, projet: str, jeton: str) -> dict[str, Any]:
        """Prépare une version historique ; republier son vieux jeton ne l'active pas.

        La reprise est un nouveau choix explicite, relu face au dossier actuel.
        Ses pixels viennent du paquet conservé, même si les bandes ont changé.
        """
        dossier = self._dossier(projet)
        if not re.fullmatch(r"[a-f0-9]{32}", jeton):
            raise LivraisonRefusee("La révision demandée est inconnue.")
        with _verrou(dossier / ".verrou"):
            ancienne = _lire(dossier / "preparations" / f"{jeton}.json")
            if not ancienne or ancienne["etat"] != "terminee":
                raise LivraisonRefusee("Choisir une livraison terminée pour en reprendre la révision.")
            if self._associe(projet) != ancienne["association"]:
                raise LivraisonRefusee("Cette révision appartient à un autre dossier Godot. Réassocier ce dossier avant de la reprendre.")
            presente = _lire(dossier / "cibles" / f"{ancienne.get('cible_livraison') or _cle(ancienne['personnage'])}.json", {})
            preparation = copy.deepcopy(ancienne)
            # Les décisions ne se reconduisent pas : reprendre, c'est redécider.
            for cle in ("livre_le", "possedes", "intentions", "raison", "decisions"):
                preparation.pop(cle, None)
            preparation.update(jeton=uuid.uuid4().hex, etat="preparee", prepare_le=time.time(),
                               base=presente.get("jeton"), reprise_de=jeton, ecrits=[])
            self._examiner(preparation, presente.get("possedes", {}))
            _poser(dossier / "preparations" / f"{preparation['jeton']}.json", _json(preparation))
            return self._vue(preparation)


def _chaine(texte: str) -> str:
    # Godot accepte les échappements de chaîne JSON pour ces noms et chemins.
    return json.dumps(texte, ensure_ascii=False)


def _sprite_frames(animations: Sequence[dict[str, Any]], dossier: str) -> str:
    externes, atlas, bandes = [], [], []
    for rang, animation in enumerate(animations):
        texture = f"Texture_{rang}"
        externes.append(f'[ext_resource type="Texture2D" path={_chaine("res://" + dossier + "/" + animation["cle"] + ".png")} id="{texture}"]')
        for numero in range(animation["compte"]):
            atlas.append(f'[sub_resource type="AtlasTexture" id="Atlas_{rang}_{numero}"]\n'
                         f'atlas = ExtResource("{texture}")\n'
                         f'region = Rect2({numero * animation["largeur"]}, 0, {animation["largeur"]}, {animation["hauteur"]})')
        frames = [f'{{"duration": 1.0, "texture": SubResource("Atlas_{rang}_{n}")}}' for n in animation["ordre"]]
        bandes.append('{"frames": [' + ", ".join(frames) + '], '
                      f'"loop": {str(animation["boucle"]).lower()}, "name": &{_chaine(animation["nom"])}, '
                      f'"speed": {1000 / animation["duree_image_ms"]:.12g}' + '}')
    return (f'[gd_resource type="SpriteFrames" load_steps={1 + len(externes) + len(atlas)} format=3]\n\n' +
            "\n\n".join(externes + atlas) + '\n\n[resource]\nanimations = [' + ",\n".join(bandes) + ']\n')


def _pistes_sonores(animations: Sequence[dict[str, Any]], sons: dict[str, Any] | None,
                    reperes: Sequence[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """SN7 : les repères sonores rapportés aux animations livrées.

    Un repère `{bande, image, cle}` vise l'animation livrée depuis cette bande
    et le lecteur de calage de l'emplacement `cle` (`<nom stable>/Calage`,
    enfant du lecteur posé par SN6, même son : `son_<rang + 1>`). Son temps est calculé **ici**,
    depuis l'ordre et la durée d'image de l'animation livrée : c'est la cadence
    au moment de la livraison qui compte, et l'image reste la même.

    Rend `(pistes, livrés, non livrés)` : une piste par animation qui a au
    moins une clé ; un repère dont l'emplacement ne part pas (vide, rien de
    livrable) ou dont l'image dépasse la bande est dit, jamais posé en silence.
    Un repère d'une bande qui n'est pas dans cette livraison n'y figure pas."""
    from atelier.domaine.reperes_sonores import temps_de_l_image
    if not reperes:
        return [], [], []
    # Sans paquet livrable (aucun son du sujet, ou rien de livrable), aucun
    # emplacement ne part : chaque repère est dit non livrable, jamais tu.
    rang_de = {e["emplacement"]: rang for rang, e in enumerate(sons["entrees"])} if sons else {}
    pistes, livres, non_livres = [], [], []
    for animation in animations:
        cles: dict[int, list[float]] = {}
        for r in (r for r in reperes if r["bande"] == animation["bande"]):
            dit = {"animation": animation["nom"], "image": r["image"], "emplacement": r["cle"]}
            if r["cle"] not in rang_de:
                non_livres.append({**dit, "raison": "Cet emplacement ne part pas avec le sujet : il n'a aucun son livrable."})
                continue
            temps = temps_de_l_image(r["image"], animation["ordre"], animation["duree_image_ms"])
            if not temps:
                non_livres.append({**dit, "raison": f"L'animation n'a que {animation['compte']} images."})
                continue
            rang = rang_de[r["cle"]]
            cles.setdefault(rang, []).extend(temps)
            nom_stable = sons["entrees"][rang]["nom_stable"]
            livres.append({**dit, "noeud": f"{nom_stable}/{CALAGE}", "lecteur_du_jeu": nom_stable, "temps": temps})
        if cles:
            pistes.append({"nom": animation["nom"], "compte": len(animation["ordre"]),
                           "duree_image_ms": animation["duree_image_ms"], "boucle": animation["boucle"],
                           "sons": {rang: sorted(set(t)) for rang, t in sorted(cles.items())}})
    return pistes, livres, non_livres


#: Le nom du lecteur que la piste audio vise, enfant du lecteur de
#: l'emplacement (`sfx_heros_pas/Calage`). Une piste audio d'`AnimationPlayer`
#: s'empare du lecteur qu'elle vise (`docs/PIEGES.md`) : le lecteur de SN6
#: reste ainsi libre pour un `$sfx_heros_pas.play()` du jeu.
CALAGE = "Calage"


def _nom_dans_le_lecteur(nom: str) -> tuple[str, str]:
    """`marche/sud` → la bibliothèque `marche` et l'animation `sud` : Godot
    refuse `/` dans un nom d'animation, et `AnimationPlayer.play("marche/sud")`
    lit justement « bibliothèque/animation ». Le nom joué est donc celui des
    SpriteFrames. Au-delà de deux morceaux (`marche/sud/tete`), la suite est
    liée par `_`."""
    propre = re.sub(r"[:,\[]", "_", nom)
    tete, _, reste = propre.partition("/")
    return (tete, reste.replace("/", "_")) if reste else ("", tete)


def _nombre(valeur: float) -> str:
    return f"{valeur:.12g}"


def _lecteur_d_animation(pistes: Sequence[dict[str, Any]], sons: Sequence[dict[str, str]],
                         autoplay: str) -> tuple[list[str], str, bool]:
    """L'`AnimationPlayer` de SN7 : une animation par animation qui a des
    repères, sous le nom de ses SpriteFrames. Chacune **mène le sprite**
    (l'animation et l'image, en pas discrets, au temps exact de chaque image)
    et porte **une piste audio par emplacement**, qui vise son lecteur de
    calage (`<nom stable>/Calage`) avec une clé au temps de chaque image
    repérée ; le lecteur de SN6 reste au jeu. Jouer
    `$AnimationPlayer.play("marche/sud")` joue donc l'image et le son ensemble,
    à chaque boucle."""
    ressources, bibliotheques = [], {}
    for rang, piste in enumerate(pistes, 1):
        pas = piste["duree_image_ms"] / 1000
        temps = [p * pas for p in range(piste["compte"])]
        lignes = [f'[sub_resource type="Animation" id="Animation_{rang}"]',
                  f'resource_name = {_chaine(_nom_dans_le_lecteur(piste["nom"])[1])}',
                  f'length = {_nombre(piste["compte"] * pas)}',
                  f'loop_mode = {1 if piste["boucle"] else 0}',
                  f'step = {_nombre(pas)}']
        valeurs = [(".:animation", [0.0], [f'&{_chaine(piste["nom"])}']),
                   (".:frame", temps, [str(p) for p in range(piste["compte"])])]
        for n, (chemin, instants, vals) in enumerate(valeurs):
            lignes += [f'tracks/{n}/type = "value"', f'tracks/{n}/imported = false', f'tracks/{n}/enabled = true',
                       f'tracks/{n}/path = NodePath({_chaine(chemin)})', f'tracks/{n}/interp = 1',
                       f'tracks/{n}/loop_wrap = true', f'tracks/{n}/keys = {{',
                       f'"times": PackedFloat32Array({", ".join(_nombre(t) for t in instants)}),',
                       f'"transitions": PackedFloat32Array({", ".join("1" for _ in instants)}),',
                       '"update": 1,', f'"values": [{", ".join(vals)}]', '}']
        for n, (rang_son, instants) in enumerate(piste["sons"].items(), len(valeurs)):
            clip = f'{{\n"end_offset": 0.0,\n"start_offset": 0.0,\n"stream": ExtResource("son_{rang_son + 1}")\n}}'
            lignes += [f'tracks/{n}/type = "audio"', f'tracks/{n}/imported = false', f'tracks/{n}/enabled = true',
                       f'tracks/{n}/path = NodePath({_chaine(sons[rang_son]["nom"] + "/" + CALAGE)})', f'tracks/{n}/keys = {{',
                       f'"clips": [{", ".join(clip for _ in instants)}],',
                       f'"times": PackedFloat32Array({", ".join(_nombre(t) for t in instants)})', '}',
                       f'tracks/{n}/use_blend = true']
        ressources.append("\n".join(lignes) + "\n")
        bibliotheque, nom = _nom_dans_le_lecteur(piste["nom"])
        bibliotheques.setdefault(bibliotheque, []).append((nom, rang))
    entrees = []
    for rang, (bibliotheque, animations) in enumerate(sorted(bibliotheques.items()), 1):
        ressources.append(f'[sub_resource type="AnimationLibrary" id="AnimationLibrary_{rang}"]\n_data = {{\n' +
                          ",\n".join(f'&{_chaine(nom)}: SubResource("Animation_{r}")' for nom, r in animations) + "\n}\n")
        entrees.append(f'&{_chaine(bibliotheque)}: SubResource("AnimationLibrary_{rang}")')
    joue = any(p["nom"] == autoplay for p in pistes)
    # Un lecteur de calage par emplacement visé, sous son lecteur SN6 : même
    # son, même bus, et c'est lui que l'`AnimationPlayer` prend pour lui.
    vises = sorted({rang_son for p in pistes for rang_son in p["sons"]})
    calages = "".join(f'\n[node name="{CALAGE}" type="AudioStreamPlayer2D" parent={_chaine(sons[i]["nom"])}]\n'
                      f'stream = ExtResource("son_{i + 1}")\nbus = &{_chaine(sons[i]["bus"])}\n' for i in vises)
    noeud = calages + ('\n[node name="AnimationPlayer" type="AnimationPlayer" parent="."]\n'
             'libraries = {\n' + ",\n".join(entrees) + '\n}\n' +
             (f'autoplay = &{_chaine(autoplay)}\n' if joue else ''))
    return ressources, noeud, joue


def _scene(sprite_frames: str, animation: str, pivot: dict[str, float],
           sons: Sequence[dict[str, str]] = (), pistes: Sequence[dict[str, Any]] = ()) -> str:
    """La scène d'une révision. `sons` (SN6) : un `AudioStreamPlayer2D` par
    emplacement sonore du sujet, nommé par son nom stable, sur le bus de sa
    famille. `pistes` (SN7) : un `AnimationPlayer` qui mène le sprite et joue
    ces lecteurs aux images repérées. Sans son, la scène est celle d'avant
    SN6, octet pour octet ; sans repère, celle d'avant SN7.

    Quand l'`AnimationPlayer` autoplaye déjà l'animation par défaut (`joue`),
    l'`AnimatedSprite2D` ne pose plus le sien : les deux démarrant seuls sur
    la même animation se disputaient `frame`/`animation` (défaut plausible du
    19 septembre 2026, voir `docs/PIEGES.md`) — un seul démarre désormais tout
    seul, l'`AnimationPlayer`, qui mène le sprite comme avant."""
    externes = "".join(f'[ext_resource type="AudioStream" path={_chaine("res://" + s["ressource"])} id="son_{i + 1}"]\n'
                       for i, s in enumerate(sons))
    noeuds = "".join(f'\n[node name={_chaine(s["nom"])} type="AudioStreamPlayer2D" parent="."]\n'
                     f'stream = ExtResource("son_{i + 1}")\nbus = &{_chaine(s["bus"])}\n' for i, s in enumerate(sons))
    ressources, lecteur, joue = _lecteur_d_animation(pistes, sons, animation) if pistes else ([], "", False)
    internes = "".join("\n" + r for r in ressources)
    autoplay_sprite = "" if joue else f'\nautoplay = {_chaine(animation)}'
    return (f'[gd_scene load_steps={2 + len(sons) + len(ressources)} format=3]\n\n'
            f'[ext_resource type="SpriteFrames" path={_chaine("res://" + sprite_frames)} id="1"]\n{externes}{internes}\n'
            '[node name="Personnage" type="AnimatedSprite2D"]\n'
            'texture_filter = 1\nsprite_frames = ExtResource("1")\n'
            f'animation = &{_chaine(animation)}{autoplay_sprite}\n'
            f'centered = false\noffset = Vector2({-pivot["x"]}, {-pivot["y"]})\n{noeuds}{lecteur}')


def _scene_stable(scene: str, noeud: str = "Personnage") -> str:
    return ('[gd_scene load_steps=2 format=3]\n\n'
            f'[ext_resource type="PackedScene" path={_chaine("res://" + scene)} id="1"]\n\n'
            f'[node name={_chaine(noeud)} instance=ExtResource("1")]\n')
