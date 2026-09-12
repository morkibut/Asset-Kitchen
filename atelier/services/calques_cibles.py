"""AU15 : variantes d'un emploi, extraites et placées sur une base précise.

Les instantanés ne changent jamais avec la recette de la source. Une correction
de base invalide la vérification, sans effacer les passages de pinceau ni élire
une autre variante. Les fichiers sont la vérité, SQLite reste reconstructible.
"""
from __future__ import annotations

import hashlib
import io
import json
import threading
import time
import uuid
from copy import deepcopy
from typing import Any

import numpy as np
from PIL import Image

from atelier.depot.calques_cibles import DepotCalquesCibles
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.calques_cibles import CibleCalque, PlacementCalque, masques_valides
from atelier.domaine.recette import Recette
from atelier.domaine.superposition import Superposition
from atelier.image.calque import proposer, superposer
from atelier.image.calques_cibles import composer, png, rgba
from atelier.services.production import ProductionRefusee


def empreinte(contenu: Any) -> str:
    return hashlib.sha256(json.dumps(contenu, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def id_prise(bande, prise, rang: int) -> str:
    return prise.identifiant or uuid.uuid5(uuid.NAMESPACE_URL, f"asset-kitchen:{bande.identifiant}:prises:{rang}").hex


class ServiceCalquesCibles:
    def __init__(self, base, fichiers, production, equipement, assets, montage, bibliotheque, diffusion):
        self.base, self.fichiers = base, fichiers
        self.production, self.equipement = production, equipement
        self.assets, self.montage = assets, montage
        self.bibliotheque, self.diffusion = bibliotheque, diffusion
        self.depot = DepotCalquesCibles(fichiers.projets)
        self.verrou = threading.RLock()

    def _emploi(self, projet, piece, emploi):
        objet = self.base.lire_projet(projet)
        if objet is None:
            raise ProductionRefusee("le projet de cet emploi n'existe plus")
        piece_objet = next((p for p in objet.pieces if p.identifiant == piece), None)
        if piece_objet is None:
            raise ProductionRefusee("cette pièce n'existe plus dans le jeu")
        lien = next((e for e in self.equipement.emplois(projet, piece) if e.identifiant == emploi), None)
        if lien is None or not lien.porte:
            raise ProductionRefusee("un calque porté demande un emploi lié à un personnage ; les emplois à part et en mise en scène restent dans leur atelier")
        personnage = self.production.personnage(projet, lien.porteur)
        return personnage, piece_objet, lien

    def cibles(self, projet: str, piece: str, emploi: str) -> dict[str, Any]:
        personnage, piece_objet, lien = self._emploi(projet, piece, emploi)
        cibles = []
        for image in self.base.assets_du_personnage(personnage.identifiant, projet=projet):
            if image.pose and not image.piece:
                cibles.append({"cible": CibleCalque("image", image.identifiant).en_json(),
                               "pose": image.pose, "direction": image.direction or "", "image": image.en_json()})
        for bande in self.base.bandes_du_personnage(personnage.identifiant, projet=projet):
            if bande.supprime or bande.piece or not bande.pose:
                continue
            for rang, prise in enumerate(bande.prises):
                cibles.append({"cible": CibleCalque("frame", bande.identifiant, id_prise(bande, prise, rang)).en_json(),
                               "pose": bande.pose, "direction": bande.direction or "", "rang": rang,
                               "bande": bande.identifiant, "nom_bande": bande.nom,
                               "source": {"clip": prise.clip_ou(bande.clip), "numero": prise.numero}})
        variantes = [self.lire(projet, piece, emploi, v["identifiant"]) for v in self.depot.variantes(projet, piece, emploi)]
        return {
            "projet": projet, "piece": piece_objet.en_json(), "emploi": lien.en_json(),
            "personnage": personnage.en_json(), "cibles": cibles,
            "variantes": variantes,
            "images_disponibles": len(cibles),
            "calques_retenus": sum(v["utilisable"] for v in variantes),
            "historique": {
                "calques_de_pose": [a.en_json() for a in self.base.assets_du_personnage(personnage.identifiant, projet=projet) if a.piece == piece],
                "bandes_habillees": [b.en_json() for b in self.base.bandes_du_personnage(personnage.identifiant, projet=projet) if b.piece == piece],
                "explication": "Ces calques de pose et suivis TIENT/GLISSE gardent leur portée historique ; ils ne remplissent aucune cible précise sans association explicite.",
            },
        }

    def image_cible(self, projet, piece, emploi, cible: dict) -> bytes:
        try:
            visee = CibleCalque.depuis_json(cible)
        except ValueError as e:
            raise ProductionRefusee(str(e)) from e
        return self._base_cible(projet, piece, emploi, visee)[0]

    def _base_cible(self, projet, piece, emploi, cible: CibleCalque, *, identifier=False):
        personnage, _, _ = self._emploi(projet, piece, emploi)
        if cible.nature == "image":
            source = self.assets.lire(cible.resultat)
            if source is None or source.projet != projet or source.personnage != personnage.identifiant or not source.pose or source.piece:
                raise ProductionRefusee("l'image de base doit être une pose de ce personnage, dans ce jeu")
            octets = png(rgba(self.assets.octets(source)[0]))
            description = {"pose": source.pose, "direction": source.direction or "", "recette": source.recette.en_json(), "source": source.identifiant}
        else:
            bande = self.montage.bande(cible.resultat)
            if bande.projet != projet or bande.personnage != personnage.identifiant or not bande.pose or bande.piece or bande.supprime:
                raise ProductionRefusee("la bande de base doit être une animation nue de ce personnage")
            if identifier:
                bande = self.montage.identifier_prises(bande.identifiant)
            rang = next((i for i, p in enumerate(bande.prises) if id_prise(bande, p, i) == cible.prise), None)
            if rang is None:
                raise ProductionRefusee("cette occurrence de frame n'est plus dans le ruban ; son ancien calque est conservé")
            prise = bande.prises[rang]
            planche = Image.open(io.BytesIO(self.montage.planche(bande.identifiant))).convert("RGBA")
            w, h = bande.case_largeur, bande.case_hauteur
            if not w or not h:
                bande = self.montage.bande(bande.identifiant)
                w, h = bande.case_largeur, bande.case_hauteur
            if w <= 0 or h <= 0:
                raise ProductionRefusee("le cadre de cette bande n'est pas encore disponible")
            colonnes = max(1, planche.width // w)
            x, y = (rang % colonnes) * w, (rang // colonnes) * h
            octets = png(planche.crop((x, y, x + w, y + h)))
            description = {"pose": bande.pose, "direction": bande.direction or "", "prise": prise.en_json(),
                           "clip": prise.clip_ou(bande.clip), "cadre_source": bande.cadre.en_json(), "recette": bande.recette.en_json()}
        image = rgba(octets)
        description["cadre"] = {"largeur": image.shape[1], "hauteur": image.shape[0]}
        objectif = personnage.objectif
        description["repere"] = ({"x": objectif.repere_x, "y": objectif.repere_y} if objectif else {"x": image.shape[1] / 2, "y": image.shape[0]})
        description["empreinte_pixels"] = hashlib.sha256(octets).hexdigest()
        description["empreinte"] = empreinte(description)
        return octets, description

    def _chemin(self, projet, piece, emploi, identifiant):
        try:
            return self.depot.chemin(projet, piece, emploi, identifiant)
        except ValueError as e:
            raise ProductionRefusee(str(e)) from e

    def _brut(self, projet, piece, emploi, identifiant):
        chemin = self._chemin(projet, piece, emploi, identifiant) / "variante.json"
        if not chemin.exists():
            raise ProductionRefusee("cette variante n'existe pas dans cet emploi")
        return self.depot.lire(chemin)

    def _choix(self, projet, piece, emploi):
        chemin = self.depot.dossier(projet, piece, emploi) / "choix.json"
        return self.depot.lire(chemin) if chemin.exists() else {}

    def lire(self, projet, piece, emploi, identifiant):
        variante = self._brut(projet, piece, emploi, identifiant)
        raison = ""
        try:
            _, base = self._base_cible(projet, piece, emploi, CibleCalque.depuis_json(variante["cible"]))
            if base["empreinte"] != variante["base"]["empreinte"]:
                raison = "la base, sa direction, son cadre ou son repère a changé"
        except Exception as e:
            # On conserve une variante ouvrable quand sa base a disparu. Une
            # erreur de lecture ne devient jamais un calque prêt par défaut.
            raison = str(e)
        choix = self._choix(projet, piece, emploi)
        retenue = choix.get(empreinte(variante["cible"])) == identifiant
        etat = ("a-revoir" if raison else "reference" if variante["role"] == "reference"
                else "a-extraire" if variante["role"] == "source-equipee"
                else "prete" if variante.get("validee") else "a-verifier")
        return {**variante, "etat": etat, "raison": raison, "retenue": retenue,
                "utilisable": etat == "prete" and retenue}

    def creer(self, projet, piece, emploi, cible: dict, source: str, role: str):
        with self.verrou:
            if role not in ("reference", "source-equipee", "calque"):
                raise ProductionRefusee("choisissez référence, image équipée à extraire ou calque transparent")
            try:
                visee = CibleCalque.depuis_json(cible)
            except ValueError as e:
                raise ProductionRefusee(str(e)) from e
            _, _, lien = self._emploi(projet, piece, emploi)
            image = self.assets.lire(source)
            if image is None:
                raise ProductionRefusee("l'image source doit être présente dans la bibliothèque")
            source_png = png(rgba(self.assets.octets(image)[0]))
            if role == "calque" and not np.any(rgba(source_png)[:, :, 3] < 255):
                raise ProductionRefusee("cette image est opaque : importez-la comme image équipée puis extrayez le calque")
            base_png, base = self._base_cible(projet, piece, emploi, visee, identifier=True)
            return self.accueillir_source_preparee(projet, piece, emploi, visee.en_json(), source,
                base_png, base, role=role, source_png=source_png)

    def accueillir_source_preparee(self, projet, piece, emploi, cible, source, base_png, base,
                                  *, identifiant=None, role="source-equipee", source_png=None):
        """Le retour d'une fabrication reste lié à la base envoyée, même devenue périmée.

        Appel interne : la route de création ne reçoit jamais une empreinte fournie
        par le navigateur. L'identité déterministe rend le dépliage reprenable.
        """
        with self.verrou:
            _, _, lien = self._emploi(projet, piece, emploi)
            visee = CibleCalque.depuis_json(cible)
            image = self.assets.lire(source)
            if image is None or image.projet != projet:
                raise ProductionRefusee("la source préparée doit appartenir à ce jeu")
            source_png = source_png or png(rgba(self.assets.octets(image)[0]))
            identifiant = identifiant or uuid.uuid4().hex
            chemin = self._chemin(projet, piece, emploi, identifiant)
            if (chemin / "variante.json").exists():
                return self.lire(projet, piece, emploi, identifiant)
            chemin.mkdir(parents=True, exist_ok=True)
            (chemin / "base-1.png").write_bytes(base_png)
            (chemin / "source.png").write_bytes(source_png)
            if role == "calque":
                (chemin / "calque.png").write_bytes(source_png)
            source_pixels = rgba(source_png)
            variante = {
                "identifiant": identifiant, "projet": projet, "piece": piece, "emploi": emploi,
                "cible": visee.en_json(), "base": base, "base_fichier": "base-1.png",
                "source": image.identifiant, "source_fiche": image.en_json(), "role": role,
                "calque_cadre": {"largeur": source_pixels.shape[1], "hauteur": source_pixels.shape[0]},
                "placement": PlacementCalque(devant=lien.devant).en_json(),
                "masques": masques_valides({}), "extraction": None,
                "revision": 1, "historique": [], "validee": False, "cree_le": time.time(),
            }
            self.depot.ecrire(chemin / "variante.json", variante)
            self._annoncer(variante)
            return self.lire(projet, piece, emploi, identifiant)

    def regler(self, projet, piece, emploi, identifiant, revision: int, *, placement=None, masques=None):
        with self.verrou:
            v = self._brut(projet, piece, emploi, identifiant)
            self._revision(v, revision)
            nouvelle = deepcopy(v)
            try:
                if placement is not None:
                    nouvelle["placement"] = PlacementCalque.depuis_json({**v["placement"], **placement}).en_json()
                if masques is not None:
                    nouvelle["masques"] = masques_valides({**v["masques"], **masques})
            except (TypeError, ValueError) as e:
                raise ProductionRefusee(str(e)) from e
            self._enregistrer_revision(nouvelle, v)
            return self.lire(projet, piece, emploi, identifiant)

    def extraire(self, projet, piece, emploi, identifiant, *, reglage=None, automatique=False):
        with self.verrou:
            v = self._brut(projet, piece, emploi, identifiant)
            if v["role"] != "source-equipee":
                raise ProductionRefusee("l'extraction part d'une image équipée, conservée séparément du calque")
            chemin = self._chemin(projet, piece, emploi, identifiant)
            bas = rgba((chemin / v["base_fichier"]).read_bytes())
            haut = rgba((chemin / "source.png").read_bytes())
            pose = self._reglage_extraction(reglage)
            if automatique:
                from dataclasses import replace
                echelle, dy, dx, _ = proposer(bas, haut)
                pose = replace(pose, echelle=echelle, dx=dx, dy=dy)
            pixels, _ = superposer(bas, haut, pose)
            # L'extraction réelle entre immédiatement en bibliothèque, avec
            # sa provenance et sans fabriquer une génération payante fictive.
            source = v["source_fiche"]
            rang = max([99, *self.base.rangs_de_generation(source["generation"])]) + 1
            octets = png(pixels)
            brut = self.fichiers.ecrire_brut(source["generation"], rang, octets, ".png")
            image = self.assets.accueillir(Asset(
                identifiant=identifiant_de(source["generation"], rang), generation=source["generation"], rang=rang,
                brut=brut, largeur=pixels.shape[1], hauteur=pixels.shape[0], type_media="image/png",
                label="Calque extrait · " + source.get("label", "équipement"), recette=Recette(),
                projet=projet, parent=v["source"], modele=source.get("modele", ""),
            ))
            nouveau = deepcopy(v)
            nouveau.update(identifiant=uuid.uuid4().hex, role="calque", parent=identifiant,
                           calque_asset=image.identifiant, extraction=pose.en_json(), revision=1,
                           calque_cadre={"largeur": pixels.shape[1], "hauteur": pixels.shape[0]},
                           historique=[], validee=False, cree_le=time.time())
            destination = self._chemin(projet, piece, emploi, nouveau["identifiant"])
            destination.mkdir(parents=True, exist_ok=False)
            for nom in (v["base_fichier"], "source.png"):
                (destination / nom).write_bytes((chemin / nom).read_bytes())
            (destination / "calque.png").write_bytes(octets)
            self.depot.ecrire(destination / "variante.json", nouveau)
            self.diffusion.publier("bibliotheque", self.bibliotheque.arbre())
            self._annoncer(nouveau)
            return self.lire(projet, piece, emploi, nouveau["identifiant"])

    def valider(self, projet, piece, emploi, identifiant, revision: int):
        with self.verrou:
            v = self.lire(projet, piece, emploi, identifiant)
            self._revision(v, revision)
            if v["role"] != "calque" or v["etat"] == "a-revoir":
                raise ProductionRefusee(v["raison"] or "il faut extraire ou importer un calque avant de le retenir")
            pixels = rgba((self._chemin(projet, piece, emploi, identifiant) / "calque.png").read_bytes())
            if not np.any(pixels[:, :, 3]):
                raise ProductionRefusee("ce calque ne contient aucun pixel visible ; corrigez l’extraction avant de le retenir")
            brut = self._brut(projet, piece, emploi, identifiant)
            brut["validee"] = True
            self.depot.ecrire(self._chemin(projet, piece, emploi, identifiant) / "variante.json", brut)
            choix = self._choix(projet, piece, emploi)
            choix[empreinte(brut["cible"])] = identifiant
            self.depot.ecrire(self.depot.dossier(projet, piece, emploi) / "choix.json", choix)
            self._annoncer(brut)
            return self.lire(projet, piece, emploi, identifiant)

    def adopter(self, projet, piece, emploi, identifiant, revision: int, cible: dict):
        with self.verrou:
            v = self._brut(projet, piece, emploi, identifiant)
            self._revision(v, revision)
            try:
                visee = CibleCalque.depuis_json(cible)
            except ValueError as e:
                raise ProductionRefusee(str(e)) from e
            octets, base = self._base_cible(projet, piece, emploi, visee, identifier=True)
            nouveau = deepcopy(v)
            nouveau.update(cible=visee.en_json(), base=base, base_fichier=f"base-{revision + 1}.png")
            (self._chemin(projet, piece, emploi, identifiant) / nouveau["base_fichier"]).write_bytes(octets)
            self._enregistrer_revision(nouveau, v)
            return self.lire(projet, piece, emploi, identifiant)

    def aligner(self, projet, piece, emploi, identifiant):
        v = self._brut(projet, piece, emploi, identifiant)
        if v["role"] != "source-equipee":
            raise ProductionRefusee("le recalage compare l’image équipée à sa base")
        chemin = self._chemin(projet, piece, emploi, identifiant)
        echelle, dy, dx, couverture = proposer(rgba((chemin / v["base_fichier"]).read_bytes()), rgba((chemin / "source.png").read_bytes()))
        return {"echelle": echelle, "dx": dx, "dy": dy, "couverture": couverture}

    def apercu(self, projet, piece, emploi, identifiant, vue="composition", *, placement=None, masques=None, extraction=None) -> bytes:
        v = self._brut(projet, piece, emploi, identifiant)
        chemin = self._chemin(projet, piece, emploi, identifiant)
        if vue == "base":
            return (chemin / v["base_fichier"]).read_bytes()
        if vue == "source" or (v["role"] != "calque" and extraction is None):
            return (chemin / "source.png").read_bytes()
        if extraction is not None and v["role"] == "source-equipee":
            pixels, _ = superposer(rgba((chemin / v["base_fichier"]).read_bytes()),
                                  rgba((chemin / "source.png").read_bytes()), self._reglage_extraction(extraction))
            calque = png(pixels)
        else:
            calque = (chemin / "calque.png").read_bytes()
        if vue == "calque":
            return calque
        try:
            pose = PlacementCalque.depuis_json({**v["placement"], **(placement or {})})
            main = masques_valides({**v["masques"], **(masques or {})})
        except (ValueError, TypeError) as e:
            raise ProductionRefusee(str(e)) from e
        return composer(rgba((chemin / v["base_fichier"]).read_bytes()), rgba(calque), pose, main)

    @staticmethod
    def _reglage_extraction(reglage):
        try:
            pose = Superposition.depuis_json(reglage or {})
            if not .25 <= pose.echelle <= 4 or not 0 <= pose.seuil <= 255:
                raise ValueError("échelle ou seuil d’extraction hors limites")
            if abs(pose.dx) > 16384 or abs(pose.dy) > 16384:
                raise ValueError("déplacement d’extraction hors cadre")
            if pose.rectangle is not None and len(pose.rectangle) != 4:
                raise ValueError("la zone d’extraction porte quatre coordonnées")
            masques_valides({"calque": (reglage or {}).get("main", [])})
            return pose
        except (ValueError, TypeError, OverflowError) as e:
            raise ProductionRefusee(str(e)) from e

    def _revision(self, variante, revision):
        if variante["revision"] != revision:
            raise ProductionRefusee("cette variante a changé dans un autre écran ; relisez-la avant d'écraser sa retouche")

    def _enregistrer_revision(self, nouvelle, ancienne):
        nouvelle["historique"].append({k: v for k, v in ancienne.items() if k != "historique"})
        nouvelle["revision"] = ancienne["revision"] + 1
        nouvelle["validee"] = False
        self.depot.ecrire(self._chemin(nouvelle["projet"], nouvelle["piece"], nouvelle["emploi"], nouvelle["identifiant"]) / "variante.json", nouvelle)
        self._annoncer(nouvelle)

    def _annoncer(self, variante):
        self.diffusion.publier("calque-cible", {k: variante[k] for k in ("identifiant", "projet", "piece", "emploi", "revision")})
