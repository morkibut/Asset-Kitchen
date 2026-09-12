"""Une image fixe utilise la même publication révisée que les animations.

Le rendu et sa provenance viennent de ServiceExport. Le paquet ne génère et
ne reclasse rien : une version choisie remplace uniquement sa cible logique.
"""
from __future__ import annotations

import io
import math
from typing import Any

from PIL import Image

from atelier.services.livraison import LivraisonRefusee, _json


class ServiceLivraisonImages:
    def __init__(self, atelier) -> None:
        self.a = atelier

    def images(self, projet: str, personnage: str) -> dict[str, Any]:
        sujet = self.a.production.personnage(projet, personnage)
        famille = self.a.production.famille_de(projet, sujet)
        return {"personnage": personnage, "nom": sujet.nom, "famille": famille,
                "usage_conseille": "interface" if famille == "interface" else "monde",
                "images": [a.en_json() for a in self.a.base.assets_du_personnage(personnage, projet=projet)
                           if a.projet == projet and a.supprime_le is None and not a.piece and a.type_media.startswith("image/")]}

    def prevoir(self, projet: str, personnage: str, image: str, *, usage: str = "monde",
                pivot_x: float | None = None, pivot_y: float | None = None) -> dict[str, Any]:
        sujet = self.a.production.personnage(projet, personnage)
        if usage not in ("monde", "interface"):
            raise LivraisonRefusee("Choisir un sprite dans le monde ou une image d’interface.")
        asset = self.a.assets.lire(image)
        if not asset or asset.supprime_le is not None or asset.projet != projet or asset.personnage != personnage:
            raise LivraisonRefusee("Choisir une image disponible de cet asset, dans ce jeu.")
        if asset.piece or not asset.type_media.startswith("image/"):
            raise LivraisonRefusee("Une image fixe complète est attendue. Les calques se livrent depuis leur tenue.")
        octets = self.a.export.octets_du_rendu(asset)
        with Image.open(io.BytesIO(octets)) as lu:
            pixels = lu.convert("RGBA")
            if not pixels.getchannel("A").getbbox():
                raise LivraisonRefusee("L’image est entièrement transparente. Vérifiez sa recette avant de la livrer.")
            largeur, hauteur = pixels.size
        def coordonnee(v: float | None, defaut: float) -> float:
            if v is None:
                return defaut
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
                raise LivraisonRefusee("Le repère doit contenir des coordonnées finies en pixels de l’image exportée.")
            return float(v)
        pivot = {"x": coordonnee(pivot_x, largeur / 2 if usage == "monde" else 0),
                 "y": coordonnee(pivot_y, hauteur if usage == "monde" else 0)}
        fiche = self.a.export.fiche_de_l_asset(asset, "image.png", octets)
        manifeste = {"nature": "image", "nom": sujet.nom, "usage": usage,
            "image": image, "pose": asset.pose, "direction": asset.direction,
            "dimensions": {"largeur": largeur, "hauteur": hauteur}, "pivot": pivot,
            "famille": self.a.production.famille_de(projet, sujet), "animations": [], "source": fiche}
        # AtlasTexture est une Texture2D native ; dimensions et alpha viennent
        # du PNG exporté, sans conversion en bande d’une frame.
        texture = ('[gd_resource type="AtlasTexture" load_steps=2 format=3]\n\n'
                   '[ext_resource type="Texture2D" path="image.png" id="Image"]\n\n'
                   f'[resource]\natlas = ExtResource("Image")\nregion = Rect2(0, 0, {largeur}, {hauteur})\n').encode()
        commun = '[gd_scene load_steps=2 format=3]\n\n[ext_resource type="Texture2D" path="texture.tres" id="Image"]\n\n'
        if usage == "interface":
            scene = (commun + '[node name="Image" type="TextureRect"]\ntexture_filter = 1\nmouse_filter = 2\n'
                     f'offset_left = {-pivot["x"]}\noffset_top = {-pivot["y"]}\n'
                     f'offset_right = {largeur-pivot["x"]}\noffset_bottom = {hauteur-pivot["y"]}\n'
                     'texture = ExtResource("Image")\n').encode()
        else:
            scene = (commun + '[node name="Image" type="Sprite2D"]\ntexture_filter = 1\ncentered = false\n'
                     f'offset = Vector2({-pivot["x"]}, {-pivot["y"]})\ntexture = ExtResource("Image")\n').encode()
        fichiers = {"image.png": octets, "texture.tres": texture, "image.tscn": scene,
                    "composition.json": _json(manifeste)}
        # Les versions d'une même pose/direction remplacent la même porte ;
        # une autre pose ou l'usage interface garde une cible indépendante.
        cible = f"image/{personnage}/{asset.pose or 'libre'}/{asset.direction or 'toutes'}/{usage}"
        return self.a.livraison.preparer_paquet(projet, personnage, cible, manifeste, fichiers,
                                               scene="image.tscn", ressource="texture.tres")
