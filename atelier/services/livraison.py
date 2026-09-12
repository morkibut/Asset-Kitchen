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
            revision = _empreinte(_json({"animations": liste, "pivot": pivot}))[:24]
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
            sprite_frames = f"{version}/animations.tres"
            ajouter(sprite_frames, "SpriteFrames", _sprite_frames(liste, version).encode("utf-8"))
            scene_revision = f"{version}/personnage.tscn"
            ajouter(scene_revision, "scène de la révision", _scene(sprite_frames, liste[0]["nom"], pivot).encode("utf-8"))
            scene = f"{racine}/personnage.tscn"
            ajouter(scene, "scène stable", _scene_stable(scene_revision).encode("utf-8"))
            manifeste = {"atelier": "Asset Kitchen", "format": 1, "projet": projet,
                         "personnage": personnage, "revision": revision,
                         "association": association, "pivot": pivot,
                         "animations": liste, "scene": scene,
                         "sprite_frames": sprite_frames, "fichiers": list(fichiers)}
            ajouter(f"{racine}/livraison.json", "manifeste", _json(manifeste))
            jeton = uuid.uuid4().hex
            preparation = {**manifeste, "jeton": jeton, "fichiers": fichiers,
                           "etat": "preparee", "prepare_le": time.time(),
                           "base": precedente.get("jeton"), "ecrits": []}
            self._examiner(preparation, precedente.get("possedes", {}))
            _poser(dossier / "preparations" / f"{jeton}.json", _json(preparation))
            return self._vue(preparation)

    def _examiner(self, preparation: dict[str, Any], possedes: dict[str, str],
                  *, reprise: bool = False) -> None:
        racine = Path(preparation["association"]["dossier"])
        conflits = []
        for fichier in preparation["fichiers"]:
            chemin = _borne(racine, fichier["chemin"])
            actuelle = _hash_du_fichier(chemin)
            connue = possedes.get(fichier["chemin"])
            # Une intention journalisée avant publication autorise la reprise
            # de notre propre nouveau fichier, pas l'appropriation d'un inconnu.
            fait = reprise and fichier["chemin"] in preparation.get("intentions", []) and actuelle == fichier["empreinte"]
            if actuelle is not None and not fait and (connue is None or actuelle != connue):
                fichier["etat"] = "conflit"
                conflits.append({"chemin": fichier["chemin"], "raison":
                                 "Fichier inconnu de l'atelier." if connue is None else "Fichier modifié dans le jeu."})
            else:
                fichier["etat"] = "inchange" if actuelle == fichier["empreinte"] else "nouveau" if actuelle is None else "remplace"
            fichier["avant"] = actuelle
        preparation["conflits"] = conflits
        preparation["pret"] = not conflits

    @staticmethod
    def _vue(preparation: dict[str, Any]) -> dict[str, Any]:
        if not preparation:
            return {}
        return {k: v for k, v in preparation.items()
                if k not in ("intentions", "possedes", "ecrits")} | {
                    "dossier": preparation["association"]["dossier"],
                    "scene": "res://" + preparation["scene"],
                    "sprite_frames": "res://" + preparation["sprite_frames"],
                }

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
            chemin_cible = dossier / "cibles" / f"{_cle(preparation['personnage'])}.json"
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
                noms = ", ".join(c["chemin"] for c in preparation["conflits"])
                raise LivraisonRefusee(f"Conflit : {noms}. Les fichiers du jeu sont conservés.")
            # Vérifier tous les octets avant le premier fichier du jeu.
            for fichier in preparation["fichiers"]:
                self._octets(fichier["empreinte"])
            preparation["etat"] = "en_cours"
            preparation["intentions"] = [f["chemin"] for f in preparation["fichiers"]]
            _poser(chemin_preparation, _json(preparation))
            racine = Path(preparation["association"]["dossier"])
            try:
                for fichier in preparation["fichiers"]:
                    cible = _borne(racine, fichier["chemin"])
                    actuelle = _hash_du_fichier(cible)
                    if actuelle != fichier["avant"]:
                        raise LivraisonRefusee(f"« {fichier['chemin']} » a changé pendant la livraison. Le fichier est conservé.")
                    if actuelle != fichier["empreinte"]:
                        _poser(cible, self._octets(fichier["empreinte"]))
                    possedes[fichier["chemin"]] = fichier["empreinte"]
                    preparation["ecrits"].append(fichier["chemin"])
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
            presente = _lire(dossier / "cibles" / f"{_cle(ancienne['personnage'])}.json", {})
            preparation = copy.deepcopy(ancienne)
            for cle in ("livre_le", "possedes", "intentions", "raison"):
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


def _scene(sprite_frames: str, animation: str, pivot: dict[str, float]) -> str:
    return ('[gd_scene load_steps=2 format=3]\n\n'
            f'[ext_resource type="SpriteFrames" path={_chaine("res://" + sprite_frames)} id="1"]\n\n'
            '[node name="Personnage" type="AnimatedSprite2D"]\n'
            'texture_filter = 1\nsprite_frames = ExtResource("1")\n'
            f'animation = &{_chaine(animation)}\nautoplay = {_chaine(animation)}\n'
            f'centered = false\noffset = Vector2({-pivot["x"]}, {-pivot["y"]})\n')


def _scene_stable(scene: str) -> str:
    return ('[gd_scene load_steps=2 format=3]\n\n'
            f'[ext_resource type="PackedScene" path={_chaine("res://" + scene)} id="1"]\n\n'
            '[node name="Personnage" instance=ExtResource("1")]\n')
