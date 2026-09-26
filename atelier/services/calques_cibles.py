"""AU15 : variantes d'un emploi, extraites et placées sur une base précise.

Les instantanés ne changent jamais avec la recette de la source. Une correction
de base invalide la vérification, sans effacer les passages de pinceau ni élire
une autre variante. Les fichiers sont la vérité, SQLite reste reconstructible.
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import re
import threading
import time
import uuid
from copy import deepcopy
from dataclasses import replace
from typing import Any

import numpy as np
from PIL import Image

from atelier.depot.calques_cibles import DepotCalquesCibles
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.calques_cibles import CibleCalque, PlacementCalque, masques_valides
from atelier.domaine.generation import ASSET, EDITION, REFERENCE, STYLE
from atelier.domaine.recette import (
    BORDS, CONTOURS, DETOURAGE, GRILLE, QUANTIFICATION, RECADRAGE, RETOURNEMENT,
    Recette, voyage,
)
from atelier.domaine.superposition import Superposition
from atelier.domaine.travail_equipement import travail_de_generation
from atelier.image.calque import avec_alpha, cases_de, proposer, superposer
from atelier.image.calques_cibles import (
    PAS_DE_L_ECRIN, Ecrin, aux_couleurs_de, composer, couleur_du_fond, ecrin_pour, etendue, png,
    poser_dans, ramener_sur, rembourrage, rembourrer, rgba, sans_poches_de_fond,
)
from atelier.image.traitement import queue
from atelier.services.production import ProductionRefusee
from atelier.services.rangs import rang_libre

# Les deux façons de lire l'image équipée avant de la comparer à sa pose.
# `pose` : la recette de la pose, rejouée sur l'image telle que le modèle l'a
# rendue. `sienne` : l'image telle qu'elle est rangée, avec sa recette à elle —
# celle qu'on retouche dans la retouche ordinaire.
RECETTE_DE_LA_POSE = "pose"
RECETTE_DE_L_IMAGE = "sienne"


def empreinte(contenu: Any) -> str:
    return hashlib.sha256(json.dumps(contenu, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


# Les familles d'images d'un personnage, chacune son écrin : **une famille, une
# échelle de pixel**. Une recette sur grille rend une case par pixel, donc tout
# ce qui passe par la même grille partage son pixel, pose ou frame ; sans
# grille, l'image garde la résolution de ce que le modèle a rendu, et une pose
# fixe ne se compare pas à une frame de vidéo.
IMAGES = "images"
ANIMATIONS = "animations"


def famille_de(nature: str, recette: dict | None) -> str:
    r = Recette.depuis_json(recette or {})
    if r.grille is not None and not r.dort(GRILLE):
        return f"grille-{r.grille.cible}"
    return IMAGES if nature == "image" else ANIMATIONS


def _propre(valeur: float) -> float | int:
    """Un décalage recalculé, sans bruit de virgule flottante : 3 plutôt que 2,9999999."""
    arrondi = round(valeur, 4)
    return int(arrondi) if arrondi == int(arrondi) else arrondi


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
            "ecrin": self.ecrin(projet, personnage.identifiant),
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
        return self._base_personnage(projet, personnage.identifiant, cible, identifier=identifier)

    def _base_personnage(self, projet, personnage, cible: CibleCalque, *, identifier=False):
        """Le même corps sert un emploi et une tenue sans aucune pièce.

        **Dans l'écrin du personnage, quand il en a un** (18 septembre 2026) :
        le corps est rembourré de transparent pour que son repère tombe au même
        point d'un cadre commun à toutes ses images. Sans écrin, rien ne change —
        ni les pixels, ni la description, ni donc l'empreinte d'une variante
        d'avant.
        """
        image, description = self._corps(projet, personnage, cible, identifier=identifier)
        brut = self._lire_ecrin(projet, description["personnage"], famille_de(cible.nature, description.get("recette")))
        del description["personnage"]
        if brut is not None:
            ecrin = Ecrin.depuis_json(brut)
            h, w = image.shape[:2]
            rx, ry = description["repere"]["x"], description["repere"]["y"]
            cotes = rembourrage(w, h, rx, ry, ecrin)
            hors = min(cotes) < 0
            g, t, d, b = (max(0, c) for c in cotes)
            image = rembourrer(image, g, t, d, b)
            description.update(
                cadre_de_la_pose={"largeur": w, "hauteur": h},
                rembourrage={"gauche": g, "haut": t, "droite": d, "bas": b},
                ecrin=ecrin.en_json(),
                # Le repère de l'écrin, le même pour toutes les images : c'est
                # le pivot unique de la tenue dans Godot. Une largeur impaire
                # met le pied au demi-pixel près.
                repere=({"x": rx + g, "y": ry + t} if hors else {"x": ecrin.cote, "y": ecrin.haut}),
            )
            if hors:
                description["hors_ecrin"] = True
        octets = png(image)
        description["cadre"] = {"largeur": image.shape[1], "hauteur": image.shape[0]}
        description["empreinte_pixels"] = hashlib.sha256(octets).hexdigest()
        description["empreinte"] = empreinte(description)
        return octets, description

    def _corps(self, projet, personnage, cible: CibleCalque, *, identifier=False):
        """Le corps tel que sa recette le rend, et son repère — sans écrin."""
        personnage = self.production.personnage(projet, personnage)
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
        objectif = personnage.objectif
        description["repere"] = ({"x": objectif.repere_x, "y": objectif.repere_y} if objectif else {"x": image.shape[1] / 2, "y": image.shape[0]})
        description["personnage"] = personnage.identifiant
        return image, description

    # ── L'écrin du personnage ────────────────────────────────────────────────
    #
    # Rangé à côté des calques, dans un dossier qu'aucune pièce ne peut porter
    # (`repere` ne garde que `[a-z0-9-]`). Il n'existe qu'à partir du premier
    # débord : un personnage dont aucune pièce ne sort du cadre n'en a pas, et
    # ses images restent exactement ce qu'elles étaient.
    #
    # **Un écrin par famille d'images — par échelle de pixel** (`famille_de`).
    # Mesuré sur le disque de l'auteur le 18 septembre 2026 : Champy a quatre
    # poses « repos » de 221 × 451 (grille en veille), quatre autres sur une
    # grille de 96, et des frames d'animation de 96 × 96. Un seul écrin aurait
    # posé chaque sprite de 96, minuscule, dans un cadre de 328 × 454.

    def _chemin_ecrin(self, projet: str, personnage: str):
        if not re.fullmatch(r"[a-z0-9-]+", personnage or ""):
            raise ProductionRefusee("personnage inconnu pour l'écrin")
        chemin = (self.depot.projets / projet / "calques-cibles" / "_ecrins" / f"{personnage}.json").resolve()
        if not chemin.is_relative_to(self.depot.projets):
            raise ProductionRefusee("l'écrin doit rester dans les données du projet")
        return chemin

    def _lire_ecrin(self, projet: str, personnage: str, famille: str) -> dict[str, Any] | None:
        return (self.ecrin(projet, personnage) or {}).get(famille)

    def ecrin(self, projet: str, personnage: str) -> dict[str, Any] | None:
        """Les écrins d'un personnage par famille, ou `None` s'il n'en a pas encore eu besoin."""
        chemin = self._chemin_ecrin(projet, personnage)
        return self.depot.lire(chemin) if chemin.exists() else None

    def _corps_du_personnage(self, projet: str, personnage: str, famille: str) -> list[dict[str, Any]]:
        """Chaque image du personnage dans cette famille, avec son cadre et son repère.

        Les mêmes que `cibles` : ses poses fixes, ou les frames de ses bandes
        nues. Une frame a la taille de la case de sa bande, toutes ses sœurs
        aussi : on la compte une fois par bande.
        """
        perso = self.production.personnage(projet, personnage)
        objectif = perso.objectif
        corps = []

        def repere(w, h):
            return (objectif.repere_x, objectif.repere_y) if objectif else (w / 2, h)

        for image in self.base.assets_du_personnage(personnage, projet=projet):
            if not image.pose or image.piece or famille_de("image", image.recette.en_json()) != famille:
                continue
            try:
                with Image.open(io.BytesIO(self.assets.octets(image)[0])) as rendu:
                    w, h = rendu.size
            except Exception:  # une image illisible ne décide pas de l'écrin des autres
                continue
            corps.append({"pose": image.pose, "direction": image.direction or "", "cadre": (w, h), "repere": repere(w, h)})
        for bande in self.base.bandes_du_personnage(personnage, projet=projet):
            if bande.supprime or bande.piece or not bande.pose or bande.case_largeur <= 0 or bande.case_hauteur <= 0:
                continue
            if famille_de("frame", bande.recette.en_json()) != famille:
                continue
            w, h = bande.case_largeur, bande.case_hauteur
            corps.append({"pose": bande.pose, "direction": bande.direction or "", "cadre": (w, h),
                          "repere": repere(w, h), "bande": bande.identifiant})
        return corps

    def _variantes_du_personnage(self, projet: str, personnage: str, famille: str):
        """Les variantes de cette famille, toutes pièces et tous emplois portés par ce personnage."""
        objet = self.base.lire_projet(projet)
        for piece in (objet.pieces if objet else ()):
            for lien in self.equipement.emplois(projet, piece.identifiant):
                if not lien.porte or lien.porteur != personnage:
                    continue
                for v in self.depot.variantes(projet, piece.identifiant, lien.identifiant):
                    if famille_de(v["cible"]["nature"], v["base"].get("recette")) == famille:
                        yield piece.identifiant, lien.identifiant, v

    def _agrandir_ecrin(self, projet: str, personnage: str, famille: str, besoins,
                        cause: dict[str, Any]) -> dict[str, Any] | None:
        """Agrandir l'écrin pour qu'il contienne `besoins`, et faire suivre ce qui est déjà posé.

        L'écrin couvre **toutes** les images du personnage dans sa famille — sinon
        une pose plus grande que lui s'y trouverait à l'étroit — et ne rétrécit
        jamais. Les variantes à jour sur leur base sont décalées d'autant, par
        translation pure (`_suivre_l_ecrin`) ; une variante déjà « à revoir » ne
        bouge pas : l'adoption d'une base la remettra dans l'écrin.

        `None` quand l'écrin contenait déjà tout.
        """
        with self.verrou:
            brut = self._lire_ecrin(projet, personnage, famille)
            ancien = Ecrin.depuis_json(brut) if brut else None
            corps = self._corps_du_personnage(projet, personnage, famille)
            etendues = list(besoins) + [etendue(*c["cadre"], *c["repere"]) for c in corps]
            neuf = ecrin_pour(etendues, PAS_DE_L_ECRIN, ancien)
            if neuf == ancien:
                return None
            a_suivre = []
            for piece, emploi, v in self._variantes_du_personnage(projet, personnage, famille):
                try:
                    _, base = self._base_personnage(projet, personnage, CibleCalque.depuis_json(v["cible"]))
                except Exception:
                    continue
                if base["empreinte"] == v["base"]["empreinte"]:
                    a_suivre.append((piece, emploi, v["identifiant"]))
            tous = self.ecrin(projet, personnage) or {}
            tous[famille] = {**neuf.en_json(), "pas": PAS_DE_L_ECRIN, "agrandi_le": time.time(), "cause": cause,
                             "avant": ancien.en_json() if ancien else None}
            self.depot.ecrire(self._chemin_ecrin(projet, personnage), tous)
            suivies = [self._suivre_l_ecrin(projet, piece, emploi, identifiant, personnage, cause)
                       for piece, emploi, identifiant in a_suivre]
            return {"avant": ancien.en_json() if ancien else None, "apres": neuf.en_json(),
                    "corps": [{"pose": c["pose"], "direction": c["direction"], "bande": c.get("bande")} for c in corps],
                    "suivies": [s for s in suivies if s]}

    def _suivre_l_ecrin(self, projet, piece, emploi, identifiant, personnage, cause):
        """Une variante déjà posée, décalée dans le nouvel écrin — sans rien perdre.

        La base est relue (rembourrée d'office par `_base_personnage`). L'image
        équipée et le calque, quand ils vivent dans le cadre de la base, sont
        rembourrés des mêmes côtés ; les passages de pinceau glissent d'autant ;
        le placement est corrigé pour que le centre agrandi ne déplace rien.
        **Vérifiée reste vérifiée** : aucun pixel n'a changé, seulement sa place.
        """
        v = self._brut(projet, piece, emploi, identifiant)
        octets, base = self._base_personnage(projet, personnage, CibleCalque.depuis_json(v["cible"]), identifier=True)
        vide = {"gauche": 0, "haut": 0, "droite": 0, "bas": 0}
        avant, apres = v["base"].get("rembourrage") or vide, base.get("rembourrage") or vide
        dg, dh, dd, db = (apres[k] - avant[k] for k in ("gauche", "haut", "droite", "bas"))
        if min(dg, dh, dd, db) < 0:
            return None  # la pose a changé de taille entre-temps : l'adoption s'en chargera
        largeur, hauteur = v["base"]["cadre"]["largeur"], v["base"]["cadre"]["hauteur"]
        chemin = self._chemin(projet, piece, emploi, identifiant)
        rang = v["revision"] + 1
        nouvelle = deepcopy(v)
        nouvelle.update(base=base, base_fichier=f"base-{rang}.png")
        (chemin / nouvelle["base_fichier"]).write_bytes(octets)

        def meme_cadre(pixels):
            return pixels.shape[:2] == (hauteur, largeur)

        source = rgba((chemin / self._fichier_source(v)).read_bytes())
        if meme_cadre(source):
            source = rembourrer(source, dg, dh, dd, db)
            nouvelle["source_fichier"] = f"source-{rang}.png"
            (chemin / nouvelle["source_fichier"]).write_bytes(png(source))
        local_suit = v["role"] != "calque"  # le calque d'une image équipée naît dans le cadre de la base
        if (chemin / "calque.png").exists():
            calque = rgba((chemin / "calque.png").read_bytes())
            if meme_cadre(calque):
                calque = rembourrer(calque, dg, dh, dd, db)
                (chemin / "calque.png").write_bytes(png(calque))
                local_suit = True
            if v["role"] == "calque":
                nouvelle["calque_cadre"] = {"largeur": calque.shape[1], "hauteur": calque.shape[0]}
        if v["role"] != "calque":
            nouvelle["calque_cadre"] = {"largeur": source.shape[1], "hauteur": source.shape[0]}

        def glisser(traits):
            return [{**t, "points": [[p[0] + dg, p[1] + dh] for p in t.get("points", [])]} for t in traits]

        masques = nouvelle["masques"]
        masques["corps"] = glisser(masques.get("corps", []))
        if local_suit:
            masques["calque"] = glisser(masques.get("calque", []))
            masques["derriere"] = glisser(masques.get("derriere", []))
        # Le calque est posé autour du centre du cadre : un rembourrage inégal
        # déplace ce centre, et le placement le rattrape exactement.
        p = nouvelle["placement"]
        vx, vy = (dg - dd) / 2, (dh - db) / 2
        if local_suit:
            e, a = float(p["echelle"]), math.radians(float(p["rotation"]))
            vx, vy = vx - e * (math.cos(a) * vx - math.sin(a) * vy), vy - e * (math.sin(a) * vx + math.cos(a) * vy)
        p["dx"], p["dy"] = _propre(p["dx"] + vx), _propre(p["dy"] + vy)
        if isinstance(nouvelle.get("extraction"), dict):
            x = nouvelle["extraction"]
            e = float(x.get("echelle", 1))
            x["dx"] = int(x.get("dx", 0)) + round((1 - e) * (dg - dd) / 2)
            x["dy"] = int(x.get("dy", 0)) + round((1 - e) * (dh - db) / 2)
            if x.get("rectangle"):
                x0, y0, x1, y1 = x["rectangle"]
                x["rectangle"] = [x0 + dg, y0 + dh, x1 + dg, y1 + dh]
            if x.get("main"):
                x["main"] = glisser(x["main"])
        nouvelle["cadre_suivi"] = {"cause": cause, "cotes": {"gauche": dg, "haut": dh, "droite": dd, "bas": db},
                                   "avant": {"largeur": largeur, "hauteur": hauteur}, "apres": base["cadre"], "le": time.time()}
        nouvelle["historique"].append({k: val for k, val in v.items() if k != "historique"})
        nouvelle["revision"] = rang
        self.depot.ecrire(chemin / "variante.json", nouvelle)
        self._annoncer(nouvelle)
        return {"piece": piece, "emploi": emploi, "variante": identifiant,
                "pose": base.get("pose", ""), "direction": base.get("direction", "")}

    def _faire_de_la_place(self, projet, personnage, visee: CibleCalque, base: dict, source_png: bytes,
                           preparation: dict, cause: dict) -> tuple[bytes, bytes | None, dict | None]:
        """Ce qui déborde du cadre de la pose y est gardé : l'écrin grandit, l'image s'y pose.

        `preparation["debord"]` vient de `_preparer_source` : l'image préparée est
        alors plus grande que le cadre de la base, du débord exactement. Rend
        l'image équipée dans le nouveau cadre, la base relue, et sa description ;
        sans débord, l'image telle quelle et deux `None`.
        """
        debord = preparation.get("debord")
        if not debord or not any(debord.values()):
            return source_png, None, None
        g, h, d, b = (debord[k] for k in ("gauche", "haut", "droite", "bas"))
        besoin = etendue(base["cadre"]["largeur"], base["cadre"]["hauteur"],
                         base["repere"]["x"], base["repere"]["y"], (g, h, d, b))
        agrandi = self._agrandir_ecrin(projet, personnage, famille_de(visee.nature, base.get("recette")), [besoin], cause)
        base_png, nouvelle = self._base_personnage(projet, personnage, visee, identifier=True)
        vide = {"gauche": 0, "haut": 0, "droite": 0, "bas": 0}
        avant, apres = base.get("rembourrage") or vide, nouvelle.get("rembourrage") or vide
        cotes = {k: apres[k] - avant[k] for k in vide}
        pixels = poser_dans(rgba(source_png), nouvelle["cadre"]["largeur"], nouvelle["cadre"]["hauteur"],
                            cotes["gauche"] - g, cotes["haut"] - h)
        corps = (agrandi or {}).get("corps") or self._corps_du_personnage(projet, personnage, famille_de(visee.nature, base.get("recette")))
        pose, direction = base.get("pose", ""), base.get("direction", "")
        preparation["agrandi"] = {
            "avant": base["cadre"], "apres": nouvelle["cadre"], "cotes": cotes,
            "ecrin": nouvelle.get("ecrin"), "piece": cause.get("piece", ""),
            "autres_directions": sorted({c["direction"] for c in corps if c["pose"] == pose and c["direction"] != direction and c["direction"]}),
            "autres_images": sum(1 for c in corps if c["pose"] != pose),
            "suivies": (agrandi or {}).get("suivies", []),
        }
        preparation["dehors"] = 0.0
        return png(pixels), base_png, nouvelle

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
        variante = self._suivre_l_image(projet, piece, emploi, identifiant,
                                        self._brut(projet, piece, emploi, identifiant))
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
        # Une image équipée sortie d'une fabrication se relit depuis sa planche
        # d'origine (`ServiceTravauxEquipement.relire_depuis_la_planche`).
        planche = (variante["role"] == "source-equipee"
                   and travail_de_generation((variante.get("source_fiche") or {}).get("generation", "")) is not None)
        return {**variante, "etat": etat, "raison": raison, "retenue": retenue,
                "utilisable": etat == "prete" and retenue, "planche_d_origine": planche}

    def creer(self, projet, piece, emploi, cible: dict | None, source: str, role: str):
        """Associer une image à une cible.

        **Sans cible, la pose de référence de sa génération décide** — c'est le
        geste « l'associer d'office ». Une image équipée fabriquée d'après
        « repos · est » a sa place sur « repos · est », et la génération l'a
        noté : on le relit au lieu de le redemander. Sans référence connue, le
        refus nomme ce qui manque, et l'association reste manuelle.
        """
        with self.verrou:
            if role not in ("reference", "source-equipee", "calque"):
                raise ProductionRefusee("choisissez référence, image équipée à extraire ou calque transparent")
            personnage, piece_objet, lien = self._emploi(projet, piece, emploi)
            image = self.assets.lire(source)
            if image is None:
                raise ProductionRefusee("l'image source doit être présente dans la bibliothèque")
            if cible is None:
                trouvees = self._references_de(projet, personnage.identifiant, image)
                if not trouvees:
                    raise ProductionRefusee("sa génération ne dit d'après quelle pose elle a été fabriquée : choisissez la cible à la main")
                cible = trouvees[0]["cible"]
            try:
                visee = CibleCalque.depuis_json(cible)
            except ValueError as e:
                raise ProductionRefusee(str(e)) from e
            source_png = png(rgba(self.assets.octets(image)[0]))
            if role == "calque" and not np.any(rgba(source_png)[:, :, 3] < 255):
                raise ProductionRefusee("cette image est opaque : importez-la comme image équipée puis extrayez le calque")
            base_png, base = self._base_dans_l_ecrin(projet, personnage.identifiant, visee, piece_objet.nom)
            preparation = None
            if role == "source-equipee":
                source_png, preparation = self._preparer_source(
                    image, base_png, base, recette=RECETTE_DE_LA_POSE, echelle=True, resultat=visee.resultat)
                source_png, nouvelle_png, nouvelle = self._faire_de_la_place(
                    projet, personnage.identifiant, visee, base, source_png, preparation,
                    self._cause(piece_objet.nom, base))
                if nouvelle is not None:
                    base_png, base = nouvelle_png, nouvelle
            return self.accueillir_source_preparee(projet, piece, emploi, visee.en_json(), source,
                base_png, base, role=role, source_png=source_png, preparation=preparation)

    @staticmethod
    def _cause(nom_piece: str, base: dict) -> dict[str, str]:
        return {"piece": nom_piece, "pose": base.get("pose", ""), "direction": base.get("direction", "")}

    def _base_dans_l_ecrin(self, projet, personnage: str, visee: CibleCalque, nom_piece: str):
        """La base, rembourrée dans l'écrin — et l'écrin agrandi si cette image-là n'y tient pas.

        Une pose ajoutée après l'écrin peut être plus grande que lui : on
        l'agrandit plutôt que de la couper, et le reste suit.
        """
        base_png, base = self._base_personnage(projet, personnage, visee, identifier=True)
        if base.get("hors_ecrin"):
            besoin = etendue(base["cadre_de_la_pose"]["largeur"], base["cadre_de_la_pose"]["hauteur"],
                             base["repere"]["x"] - base["rembourrage"]["gauche"],
                             base["repere"]["y"] - base["rembourrage"]["haut"])
            self._agrandir_ecrin(projet, personnage, famille_de(visee.nature, base.get("recette")), [besoin], self._cause(nom_piece, base))
            base_png, base = self._base_personnage(projet, personnage, visee, identifier=True)
        return base_png, base

    # ── La pose de référence, relue sur la génération ────────────────────────

    def poses_de_reference(self, projet, piece, emploi, source: str) -> list[dict[str, Any]]:
        """Les poses du porteur d'après lesquelles cette image a été fabriquée, la plus sûre d'abord."""
        personnage, _, _ = self._emploi(projet, piece, emploi)
        image = self.assets.lire(source)
        return [] if image is None else self._references_de(projet, personnage.identifiant, image)

    def _references_de(self, projet: str, porteur: str, image: Asset) -> list[dict[str, Any]]:
        """**Relu, jamais deviné** : la génération garde ce qui est parti avec elle.

        Deux endroits le disent. Une planche d'équipement (C3) nomme dans chaque
        case le corps qu'elle portait — c'est le cas de Champy et de son bâton,
        où l'image jointe n'est pas une réinjection mais la planche redessinée.
        Une génération ordinaire garde ses réinjections avec leur rôle : l'image
        à modifier passe devant une simple référence, qui passe devant un style.
        Le parent de l'image vient en dernier. Seule compte une **pose du
        porteur**, dans ce jeu : un artwork officiel n'est pas une cible.
        """
        ordre: list[tuple[str, str]] = []
        generation = self.base.lire(image.generation) if image.generation else None
        if generation is not None:
            if generation.pliage is not None:
                ordre += [(c.base, "sa planche partait de cette pose") for c in generation.pliage.cases if c.base]
            for role, raison in ((EDITION, "l'image à modifier de sa génération"),
                                 (REFERENCE, "une image de référence de sa génération"),
                                 (STYLE, "une image de style de sa génération")):
                ordre += [(r.asset, raison) for r in generation.references if r.role == role and r.origine == ASSET]
        if image.parent:
            ordre.append((image.parent, "l'image dont elle descend"))
        vues: set[str] = set()
        trouvees = []
        for identifiant, raison in ordre:
            if identifiant in vues:
                continue
            vues.add(identifiant)
            pose = self.assets.lire(identifiant)
            if (pose is None or pose.projet != projet or pose.personnage != porteur
                    or not pose.pose or pose.piece or pose.identifiant == image.identifiant):
                continue
            trouvees.append({"cible": CibleCalque("image", pose.identifiant).en_json(), "pose": pose.pose,
                             "direction": pose.direction or "", "raison": raison, "image": pose.en_json()})
        return trouvees

    def fabriquees_d_apres(self, projet, piece, emploi, resultat: str) -> list[dict[str, Any]]:
        """Les images de la bibliothèque fabriquées d'après cette pose — l'inverse du relevé ci-dessus.

        C'est la proposition « en un clic » : sur la pose « repos · est », les
        images dont la génération partait de « repos · est ». Un calque de pose
        historique (il porte une pièce) n'en fait pas partie : son rendu est déjà
        un calque, pas un personnage équipé.
        """
        personnage, _, _ = self._emploi(projet, piece, emploi)
        pose = self.assets.lire(resultat)
        if pose is None or pose.personnage != personnage.identifiant or not pose.pose or pose.piece:
            return []
        deja = {v["source"] for v in self.depot.variantes(projet, piece, emploi)
                if v.get("cible", {}).get("resultat") == resultat}
        sortie = []
        for generation in self.base.generations_du_projet(projet, limite=5000):
            bases = {c.base for c in generation.pliage.cases if c.base} if generation.pliage else set()
            refs = {r.asset for r in generation.references if r.origine == ASSET}
            # Une planche de création (pliée, sans pièce) fabrique d'autres poses
            # du même corps, pas un corps équipé.
            if (resultat not in bases and resultat not in refs) or (generation.pliage is not None and not generation.piece):
                continue
            for rang in sorted(self.base.rangs_de_generation(generation.identifiant)):
                image = self.assets.lire(identifiant_de(generation.identifiant, rang))
                # Une planche de quatre directions part de quatre poses : elle est
                # proposée sur chacune, et la préparation n'en garde que la case
                # qui partait de celle-ci (`_case_de_planche`).
                if image is None or image.piece or image.identifiant == resultat or not image.type_media.startswith("image/"):
                    continue
                # Une image déjà rangée comme pose du porteur est une cible, pas
                # une image équipée : la proposer ici la ferait comparer à elle-même.
                if image.personnage == personnage.identifiant and image.pose:
                    continue
                sortie.append({"image": image.en_json(), "deja": image.identifiant in deja})
        return sortie

    # ── Préparer l'image équipée comme sa pose ───────────────────────────────

    def _preparer_source(self, image: Asset, base_png: bytes, base: dict, *, recette: str,
                         echelle: bool, resultat: str | None = None) -> tuple[bytes, dict[str, Any]]:
        """L'image équipée, lue pour être comparée à sa pose — et ce qui a été fait pour ça.

        **Pourquoi ce n'est pas la recette entière, et ce qui reste dehors** :

        - le recadrage et la grille rendent une image *à la résolution de ce
          qu'on leur donne* — 934 × 567 pour la planche de Champy, 451 × 221
          pour sa pose. Quand `echelle` est demandée, ils cèdent la place à
          `ramener_sur`, qui met le corps à l'échelle du corps de la pose et
          l'image dans son cadre : c'est ce que les deux étapes voulaient dire ;
        - le contour et le miroir ne se rejouent pas : ce qui est parti au modèle
          est le **rendu** de la pose (`ServiceAssets.reference`), contour tracé
          et miroir déjà fait. Les rejouer doublerait le trait et retournerait
          l'image à l'envers de sa pose ;
        - ce qui ne voyage pas d'une image à l'autre (`voyage`) reste dehors,
          comme pour un collage de recette.

        Ce qui est laissé se dit, ligne par ligne, dans `laissee`.
        """
        base_px = rgba(base_png)
        appliquee: list[str] = []
        laissee: list[str] = []
        brut = self.assets.octets(image, brut=True)[0]
        tolerance = 28
        if recette == RECETTE_DE_LA_POSE:
            r, laisse = voyage(Recette.depuis_json(base.get("recette") or {}).sans_nom())
            laissee += list(laisse)
            tolerance = next((p.tolerance for p in r.passes_vives()), tolerance)
            passes = () if r.dort(DETOURAGE) else r.passes
            try:
                pixels = np.array(self.assets.detourage(image, passes=passes))
                if passes and r.passes_vives():
                    appliquee.append("détourage")
            except Exception as erreur:  # un moteur absent ne doit pas empêcher l'association
                pixels = rgba(brut)
                laissee.append(f"le détourage de la pose n'a pas pu tourner ici ({erreur})")
            if bool((pixels[:, :, 3] >= 128).all()):
                pixels = np.array(avec_alpha(png(pixels)))
                appliquee.append("détourage par le bord — l'image arrivait sans transparence")
            pixels = self._case_de_planche(image, resultat, pixels)
            # Les couleurs se ramènent après, par `aux_couleurs_de` : la
            # quantification ordinaire repeindrait aussi la pièce aux couleurs du
            # corps.
            couleurs = r.quantification is not None and not r.dort(QUANTIFICATION)
            methode = r.grille.methode if r.grille is not None and not r.dort(GRILLE) else None
            queue_ = replace(r, contours=None, retournement=None, main=None, difference=None, quantification=None)
            if r.contours is not None and not r.dort(CONTOURS):
                laissee.append("le contour — l'image envoyée au modèle le portait déjà")
            if r.retournement is not None and not r.dort(RETOURNEMENT):
                laissee.append("le miroir — l'image envoyée au modèle était déjà retournée")
            if echelle:
                queue_ = replace(queue_, recadrage=None, grille=None)
            else:
                if r.recadrage is not None and not r.dort(RECADRAGE):
                    appliquee.append("recadrage")
                if r.grille is not None and not r.dort(GRILLE):
                    appliquee.append("grille")
        else:
            pixels = rgba(self.assets.octets(image)[0])
            appliquee.append("sa propre recette, telle que retouchée")
            if bool((pixels[:, :, 3] >= 128).all()):
                pixels = np.array(avec_alpha(png(pixels)))
                appliquee.append("détourage par le bord — l'image arrivait sans transparence")
            queue_, couleurs, methode = None, False, None
        source_largeur, source_hauteur = pixels.shape[1], pixels.shape[0]
        mesure: dict[str, Any] = {}
        if echelle:
            ramene = ramener_sur(base_px, pixels, methode=methode)
            if ramene is None:
                laissee.append("la mise à l'échelle — aucun corps à retrouver sur l'une des deux images")
            else:
                # **L'image entière, débord compris** : ce qui sort du cadre de la
                # pose n'est plus coupé ici. L'appelant agrandit l'écrin du
                # personnage et la pose dans le nouveau cadre (`_faire_de_la_place`).
                pixels = ramene.etendue if ramene.etendue is not None else ramene.image
                g, h, d, b = ramene.debord
                base_etendue = rembourrer(base_px, g, h, d, b)
                appliquee.append("cadre et échelle de la pose")
                # Seulement quand l'image est arrivée sur un fond plat : sur une
                # image déjà transparente, la « couleur du bord » serait le noir
                # des pixels vides, et une épée noire partirait avec.
                arrivee = rgba(brut)
                poches = 0
                if couleur_du_fond(arrivee[:, :, 3:])[0] >= 128:
                    pixels, poches = sans_poches_de_fond(pixels, base_etendue, couleur_du_fond(arrivee[:, :, :3]), tolerance)
                if poches:
                    appliquee.append(f"fond enfermé hors du corps retiré ({poches} px)")
                mesure = {"facteur": round(ramene.echelle, 4), "x": ramene.x, "y": ramene.y,
                          "accord": round(ramene.accord, 4), "dehors": round(ramene.dehors, 4)}
                if any(ramene.debord):
                    mesure["debord"] = {"gauche": g, "haut": h, "droite": d, "bas": b}
        if queue_ is not None:
            pixels = queue(np.ascontiguousarray(pixels), queue_)
            if couleurs:
                ramenees = aux_couleurs_de(pixels, base_px)
                if ramenees is None:
                    laissee.append("les couleurs — la pose en porte trop pour en faire une palette")
                else:
                    pixels = ramenees
                    appliquee.append("couleurs de la pose (celles qu’elle n’a pas restent : ce sont celles de la pièce)")
            if queue_.bords is not None and not queue_.dort(BORDS):
                appliquee.append("nettoyage des bords")
        description = {
            "recette": recette, "echelle": echelle,
            "depuis": {"pose": base.get("pose", ""), "direction": base.get("direction", "")},
            "appliquee": appliquee, "laissee": laissee,
            "cadre_source": {"largeur": source_largeur, "hauteur": source_hauteur}, **mesure,
        }
        return png(pixels), description

    def _case_de_planche(self, image: Asset, resultat: str | None, pixels: np.ndarray) -> np.ndarray:
        """Sur une planche de plusieurs corps, la seule case qui partait de cette pose."""
        generation = self.base.lire(image.generation) if image.generation else None
        if resultat is None or generation is None or generation.pliage is None or len(generation.pliage.cases) < 2:
            return pixels
        rangs = [i for i, c in enumerate(generation.pliage.cases) if c.base == resultat]
        boites = cases_de(pixels.shape[1], pixels.shape[0], generation.pliage.geometrie)
        if not rangs or rangs[0] >= len(boites):
            return pixels
        x0, y0, x1, y1 = boites[rangs[0]]
        return pixels[y0:y1 + 1, x0:x1 + 1]

    def reprendre_source(self, projet, piece, emploi, identifiant, revision: int, *,
                         recette: str = RECETTE_DE_LA_POSE, echelle: bool = True, source: str | None = None):
        """Relire l'image équipée — avec la recette de sa pose, ou avec la sienne.

        C'est le geste qui rend la préparation **réglable** : retirer la recette
        de la pose, la remettre, ou relire l'image après l'avoir retouchée dans la
        retouche ordinaire. L'ancienne lecture reste dans l'historique et son
        fichier sur le disque ; le calage repart de zéro, puisqu'il visait
        l'image d'avant.

        `source` change d'image équipée en chemin : c'est ce que fait la relecture
        depuis la planche d'origine, qui remplace une case coupée au cadre du
        corps par la case entière (`ServiceTravauxEquipement.relire_depuis_la_planche`).
        """
        if recette not in (RECETTE_DE_LA_POSE, RECETTE_DE_L_IMAGE):
            raise ProductionRefusee("la recette est celle de la pose ou celle de l'image")
        with self.verrou:
            v = self._brut(projet, piece, emploi, identifiant)
            self._revision(v, revision)
            if v["role"] != "source-equipee":
                raise ProductionRefusee("seule une image équipée à extraire se relit ainsi")
            image = self.assets.lire(source or v["source"])
            if source is not None and (image is None or image.projet != projet):
                raise ProductionRefusee("la nouvelle image équipée doit appartenir à ce jeu")
            if image is None:
                raise ProductionRefusee("l'image équipée n'est plus dans la bibliothèque ; sa dernière lecture est conservée")
            chemin = self._chemin(projet, piece, emploi, identifiant)
            octets, preparation = self._preparer_source(
                image, (chemin / v["base_fichier"]).read_bytes(), v["base"],
                recette=recette, echelle=echelle, resultat=v["cible"].get("resultat"))
            if preparation.get("debord"):
                personnage, piece_objet, _ = self._emploi(projet, piece, emploi)
                visee = CibleCalque.depuis_json(v["cible"])
                try:
                    a_jour = self._base_personnage(projet, personnage.identifiant, visee)[1]["empreinte"] == v["base"]["empreinte"]
                except Exception:
                    a_jour = False
                if a_jour:
                    # L'écrin grandit : cette variante-ci est décalée avec les
                    # autres (`_suivre_l_ecrin`), puis sa lecture s'y pose.
                    octets, _, _ = self._faire_de_la_place(projet, personnage.identifiant, visee, v["base"],
                                                           octets, preparation, self._cause(piece_objet.nom, v["base"]))
                    v = self._brut(projet, piece, emploi, identifiant)
                else:
                    # Base à revoir : on ne décale rien sur une base d'avant ; la
                    # lecture reste dans son cadre, et le débord se signale.
                    d = preparation["debord"]
                    octets = png(rgba(octets)[d["haut"]:d["haut"] + v["base"]["cadre"]["hauteur"],
                                              d["gauche"]:d["gauche"] + v["base"]["cadre"]["largeur"]])
            nom = f"source-{v['revision'] + 1}.png"
            (chemin / nom).write_bytes(octets)
            nouvelle = deepcopy(v)
            pixels = rgba(octets)
            nouvelle.update(source_fichier=nom, preparation=preparation, extraction=None,
                            source=image.identifiant, source_fiche=image.en_json(),
                            calque_cadre={"largeur": pixels.shape[1], "hauteur": pixels.shape[0]})
            self._enregistrer_revision(nouvelle, v)
            return self.lire(projet, piece, emploi, identifiant)

    @staticmethod
    def _fichier_source(variante) -> str:
        return variante.get("source_fichier") or "source.png"

    def accueillir_retour(self, projet, piece, emploi, cible, source, base_png, base, *, identifiant):
        """Le retour d'une fabrication d'équipement, lu **comme une association à la main**.

        `source` est la case entière de la planche revenue, fond compris — pas le
        rectangle où le corps avait été posé : un bâton tenu à côté du corps sort
        de ce rectangle, et le couper là le coupait pour de bon (relevé le 18
        septembre 2026 sur cinq tirages de Champy). La case passe donc par le même
        chemin que `creer` : recette de la pose, `ramener_sur`, et l'écrin qui
        grandit si la pièce déborde.

        La base envoyée garde le dernier mot, comme avant, **sauf si le corps est
        le même au rembourrage près** : l'écrin a pu grandir entre l'envoi et le
        retour (le premier retour d'un lot l'agrandit), et ce n'est pas un
        changement de base. On lit alors la base d'aujourd'hui. Une base vraiment
        changée reste celle de l'envoi — la variante sera « à revoir » — et ce
        qui déborde n'agrandit rien : on ne décale pas un cadre sur une base
        d'avant.
        """
        with self.verrou:
            chemin = self._chemin(projet, piece, emploi, identifiant)
            if (chemin / "variante.json").exists():
                return self.lire(projet, piece, emploi, identifiant)
            personnage, piece_objet, _ = self._emploi(projet, piece, emploi)
            visee = CibleCalque.depuis_json(cible)
            image = self.assets.lire(source)
            if image is None or image.projet != projet:
                raise ProductionRefusee("la source préparée doit appartenir à ce jeu")
            try:
                a_jour = self._meme_corps(base_png, base, *self._base_personnage(
                    projet, personnage.identifiant, visee, identifier=True))
            except Exception:  # la base a disparu ou ne se lit plus : la variante le dira, « à revoir »
                a_jour = False
            if a_jour:
                base_png, base = self._base_dans_l_ecrin(projet, personnage.identifiant, visee, piece_objet.nom)
            octets, preparation = self._preparer_source(
                image, base_png, base, recette=RECETTE_DE_LA_POSE, echelle=True, resultat=visee.resultat)
            debord = preparation.get("debord")
            if debord and a_jour:
                octets, nouvelle_png, nouvelle = self._faire_de_la_place(
                    projet, personnage.identifiant, visee, base, octets, preparation,
                    self._cause(piece_objet.nom, base))
                if nouvelle is not None:
                    base_png, base = nouvelle_png, nouvelle
            elif debord:
                octets = png(rgba(octets)[debord["haut"]:debord["haut"] + base["cadre"]["hauteur"],
                                          debord["gauche"]:debord["gauche"] + base["cadre"]["largeur"]])
            return self.accueillir_source_preparee(projet, piece, emploi, visee.en_json(), source,
                base_png, base, identifiant=identifiant, source_png=octets, preparation=preparation)

    @staticmethod
    def _meme_corps(png_a: bytes, a: dict, png_b: bytes, b: dict) -> bool:
        """Deux bases du même corps, au rembourrage de l'écrin près.

        Même image, même recette, et **les mêmes pixels une fois le transparent
        de l'écrin retiré**. Le repère n'est pas comparé : dans un écrin, il
        tombe au demi-pixel près, et le corps, lui, n'a pas bougé.
        """
        if a.get("empreinte") == b.get("empreinte"):
            return True
        propre = {"cadre", "cadre_de_la_pose", "rembourrage", "ecrin", "repere", "hors_ecrin",
                  "empreinte", "empreinte_pixels"}
        if {k: v for k, v in a.items() if k not in propre} != {k: v for k, v in b.items() if k not in propre}:
            return False

        def nu(octets: bytes, d: dict) -> np.ndarray:
            pixels = rgba(octets)
            r = d.get("rembourrage") or {}
            h, w = pixels.shape[:2]
            return pixels[r.get("haut", 0):h - r.get("bas", 0), r.get("gauche", 0):w - r.get("droite", 0)]

        return np.array_equal(nu(png_a, a), nu(png_b, b))

    def accueillir_source_preparee(self, projet, piece, emploi, cible, source, base_png, base,
                                  *, identifiant=None, role="source-equipee", source_png=None,
                                  preparation=None):
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
                # Comment l'image équipée a été lue — absent sur une variante
                # d'avant, ce qui se lit « telle quelle ».
                **({"preparation": preparation} if preparation is not None else {}),
                "placement": PlacementCalque(devant=lien.devant).en_json(),
                "masques": masques_valides({}), "extraction": None,
                "revision": 1, "historique": [], "validee": False, "cree_le": time.time(),
            }
            self.depot.ecrire(chemin / "variante.json", variante)
            self._annoncer(variante)
            return self.lire(projet, piece, emploi, identifiant)

    # ── Un calque qui suit son image (PX9) ───────────────────────────────────
    #
    # **Un calque déjà taillé sur la grille de la pose** — la pièce d'une zone
    # repeinte, `docs/PLAN-idees-pixellab.md` § PX9 — n'a ni calage ni
    # extraction à faire : il est posé tel quel, rembourré comme la base dans
    # l'écrin. Et **il suit son image** : la variante nomme l'asset
    # (`calque_asset`) et garde l'empreinte qu'elle en a lue. Une retouche de
    # l'asset — la main, l'éditeur de pixels, un pixel ramené de l'image du
    # moteur — change son empreinte, et la prochaine lecture de la variante
    # recopie le calque. Sans ça, corriger la pièce depuis son image n'aurait
    # rien changé à l'équipement, ni à l'export.

    def _calque_de_l_image(self, image: Asset, base: dict[str, Any]) -> bytes:
        pixels = rgba(self.assets.octets(image)[0])
        r = base.get("rembourrage") or {}
        pixels = rembourrer(pixels, int(r.get("gauche", 0)), int(r.get("haut", 0)),
                            int(r.get("droite", 0)), int(r.get("bas", 0)))
        cadre = base.get("cadre") or {}
        if cadre and pixels.shape[:2] != (cadre["hauteur"], cadre["largeur"]):
            pixels = poser_dans(pixels[: cadre["hauteur"], : cadre["largeur"]], cadre["largeur"], cadre["hauteur"], 0, 0)
        return png(pixels)

    def poser_un_calque_qui_suit(self, projet, piece, emploi, cible: dict, source: str):
        """La pièce `source`, déjà sur la grille de la pose visée, devient le
        calque retenu de cette cible — **validé d'office** : l'auteur vient de
        le voir posé sur l'image, et c'est sa décision qui nous amène ici."""
        with self.verrou:
            personnage, piece_objet, _ = self._emploi(projet, piece, emploi)
            try:
                visee = CibleCalque.depuis_json(cible)
            except ValueError as e:
                raise ProductionRefusee(str(e)) from e
            image = self.assets.lire(source)
            if image is None or image.projet != projet:
                raise ProductionRefusee("la pièce doit appartenir à ce jeu")
            base_png, base = self._base_dans_l_ecrin(projet, personnage.identifiant, visee, piece_objet.nom)
            calque = self._calque_de_l_image(image, base)
            if not np.any(rgba(calque)[:, :, 3]):
                raise ProductionRefusee("cette pièce ne contient aucun pixel visible")
            v = self.accueillir_source_preparee(projet, piece, emploi, visee.en_json(), source,
                                                base_png, base, role="calque", source_png=calque)
            brut = self._brut(projet, piece, emploi, v["identifiant"])
            brut.update(calque_asset=image.identifiant, calque_suit_l_image=True, calque_empreinte=image.empreinte)
            self.depot.ecrire(self._chemin(projet, piece, emploi, v["identifiant"]) / "variante.json", brut)
            return self.valider(projet, piece, emploi, v["identifiant"], brut["revision"])

    def _suivre_l_image(self, projet, piece, emploi, identifiant, variante):
        """Recopie le calque d'une variante qui suit son image, si l'image a
        changé depuis — **sans nouvelle révision** : ce n'est pas un réglage de
        la variante, c'est la même pièce corrigée."""
        if not variante.get("calque_suit_l_image"):
            return variante
        image = self.assets.lire(variante.get("calque_asset") or "")
        if image is None or image.supprime_le or image.empreinte == variante.get("calque_empreinte"):
            return variante
        with self.verrou:
            octets = self._calque_de_l_image(image, variante["base"])
            chemin = self._chemin(projet, piece, emploi, identifiant)
            (chemin / "calque.png").write_bytes(octets)
            pixels = rgba(octets)
            variante = {**variante, "calque_empreinte": image.empreinte,
                        "calque_cadre": {"largeur": pixels.shape[1], "hauteur": pixels.shape[0]}}
            self.depot.ecrire(chemin / "variante.json", variante)
        return variante

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
            haut = rgba((chemin / self._fichier_source(v)).read_bytes())
            pose = self._reglage_extraction(reglage)
            if automatique:
                from dataclasses import replace
                echelle, dy, dx, _ = proposer(bas, haut)
                pose = replace(pose, echelle=echelle, dx=dx, dy=dy)
            pixels, _ = superposer(bas, haut, pose)
            # L'extraction réelle entre immédiatement en bibliothèque, avec
            # sa provenance et sans fabriquer une génération payante fictive.
            source = v["source_fiche"]
            # Au-dessus des rangs réservés par un dépliage aussi (P1b) : la
            # source peut être une image dépliée, dans le dossier de sa planche.
            rang = rang_libre(self.base, source["generation"])
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
            for nom in (v["base_fichier"], self._fichier_source(v)):
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

    def reutiliser(self, projet, piece, emploi, identifiant, cibles, *, copier_placement=True, copier_masques=False):
        """Réemploi explicitement demandé : nouvelles variantes, aucune élection implicite."""
        with self.verrou:
            source = self._brut(projet, piece, emploi, identifiant)
            if source["role"] != "calque":
                raise ProductionRefusee("le réemploi demande un calque transparent, pas une image équipée")
            if not isinstance(cibles, list) or not cibles:
                raise ProductionRefusee("choisissez les cibles du réemploi")
            try:
                visees = [CibleCalque.depuis_json(c) for c in cibles]
            except (ValueError, TypeError, AttributeError) as erreur:
                raise ProductionRefusee("les cibles du réemploi doivent désigner des images ou frames précises") from erreur
            if len({empreinte(c.en_json()) for c in visees}) != len(visees):
                raise ProductionRefusee("une cible ne peut pas figurer deux fois dans le réemploi")
            bases = [self._base_cible(projet, piece, emploi, c, identifier=True) for c in visees]
            calque = (self._chemin(projet, piece, emploi, identifiant) / "calque.png").read_bytes()
            nouvelles = []
            for cible, (octets, base) in zip(visees, bases):
                v = self.accueillir_source_preparee(projet, piece, emploi, cible.en_json(),
                    source.get("calque_asset") or source["source"], octets, base, role="calque", source_png=calque)
                brut = self._brut(projet, piece, emploi, v["identifiant"])
                brut["reemploi"] = {"variante": identifiant, "revision": source["revision"],
                                    "placement": copier_placement, "masques": copier_masques}
                if copier_placement:
                    brut["placement"] = deepcopy(source["placement"])
                if copier_masques:
                    brut["masques"] = deepcopy(source["masques"])
                self.depot.ecrire(self._chemin(projet, piece, emploi, v["identifiant"]) / "variante.json", brut)
                self._annoncer(brut)
                nouvelles.append(self.lire(projet, piece, emploi, v["identifiant"]))
            return nouvelles

    def adopter(self, projet, piece, emploi, identifiant, revision: int, cible: dict):
        with self.verrou:
            v = self._brut(projet, piece, emploi, identifiant)
            self._revision(v, revision)
            try:
                visee = CibleCalque.depuis_json(cible)
            except ValueError as e:
                raise ProductionRefusee(str(e)) from e
            personnage, piece_objet, _ = self._emploi(projet, piece, emploi)
            octets, base = self._base_dans_l_ecrin(projet, personnage.identifiant, visee, piece_objet.nom)
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
        echelle, dy, dx, couverture = proposer(rgba((chemin / v["base_fichier"]).read_bytes()), rgba((chemin / self._fichier_source(v)).read_bytes()))
        return {"echelle": echelle, "dx": dx, "dy": dy, "couverture": couverture}

    def apercu(self, projet, piece, emploi, identifiant, vue="composition", *, placement=None, masques=None, extraction=None) -> bytes:
        v = self._suivre_l_image(projet, piece, emploi, identifiant, self._brut(projet, piece, emploi, identifiant))
        chemin = self._chemin(projet, piece, emploi, identifiant)
        if vue == "base":
            return (chemin / v["base_fichier"]).read_bytes()
        if vue == "source" or (v["role"] != "calque" and extraction is None):
            return (chemin / self._fichier_source(v)).read_bytes()
        if extraction is not None and v["role"] == "source-equipee":
            pixels, _ = superposer(rgba((chemin / v["base_fichier"]).read_bytes()),
                                  rgba((chemin / self._fichier_source(v)).read_bytes()), self._reglage_extraction(extraction))
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
