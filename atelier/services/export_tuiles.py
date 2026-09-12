"""TileSetAtlasSource natif et carte TileMapLayer, sans script d’initialisation.

Le contrat de sérialisation est vérifié par chargement dans Godot dans AU13.
Les coordonnées d’atlas restent stables, même quand une tuile est écartée.
"""
import json
import struct
from atelier.services.livraison import _json

VOISINS = {"est": "right_side", "sud-est": "bottom_right_corner", "sud": "bottom_side",
           "sud-ouest": "bottom_left_corner", "ouest": "left_side", "nord-ouest": "top_left_corner",
           "nord": "top_side", "nord-est": "top_right_corner"}

def chaine(s): return json.dumps(s, ensure_ascii=False)

def paquet(objet, atlas):
    g = objet["grille"]
    terrains = {t["identifiant"]: i for i, t in enumerate(objet["terrains"])}
    lignes = ['[gd_resource type="TileSet" load_steps=3 format=3]',
              '[ext_resource type="Texture2D" path="atlas.png" id="1"]',
              '[sub_resource type="TileSetAtlasSource" id="Atlas"]', 'texture = ExtResource("1")',
              f'margins = Vector2i({g["marge"]}, {g["marge"]})',
              f'separation = Vector2i({g["espacement"]}, {g["espacement"]})',
              f'texture_region_size = Vector2i({g["taille"]}, {g["taille"]})', 'use_texture_padding = true']
    for c in objet["cellules"]:
        if not c["retenue"]: continue
        prefixe = f'{c["x"]}:{c["y"]}/0'
        lignes.append(f'{prefixe} = 0')
        if terrains:
            lignes.extend([f'{prefixe}/terrain_set = 0', f'{prefixe}/terrain = {terrains.get(c["terrain"], -1)}'])
            for nom, prop in VOISINS.items():
                lignes.append(f'{prefixe}/terrains_peering_bit/{prop} = {terrains.get(c["raccords"][nom], -1)}')
    lignes.extend(['[resource]', f'tile_size = Vector2i({g["taille"]}, {g["taille"]})'])
    if terrains:
        lignes.append('terrain_set_0/mode = 0')
        for i, t in enumerate(objet["terrains"]):
            couleur = ', '.join(str(int(t["couleur"][n:n+2], 16)/255) for n in (1, 3, 5))
            lignes.extend([f'terrain_set_0/terrain_{i}/name = {chaine(t["nom"])}', f'terrain_set_0/terrain_{i}/color = Color({couleur}, 1)'])
    lignes.append('sources/0 = SubResource("Atlas")')
    # TileMapLayer FORMAT_1 : un uint16 de version, puis six int16 par case.
    # Le test charge les coordonnées et les IDs dans le moteur, pas seulement le texte.
    donnees = struct.pack('<H', 0) + b''.join(struct.pack('<hhhhhh', c["x"], c["y"], 0, c["tuile_x"], c["tuile_y"], 0)
        for c in sorted(objet["carte"]["cases"], key=lambda c: (c["y"], c["x"])))
    scene = '\n'.join(['[gd_scene load_steps=2 format=3]', '[ext_resource type="TileSet" path="tuiles.tres" id="1"]',
        '[node name="Carte" type="TileMapLayer"]', 'texture_filter = 1', 'tile_set = ExtResource("1")',
        'tile_map_data = PackedByteArray(' + ', '.join(str(n) for n in donnees) + ')', ''])
    manifeste = {"nature": "tuiles", "nom": objet["nom"], "projet": objet["projet"], "personnage": objet["personnage"],
        "ensemble": objet["identifiant"], "revision_tuiles": objet["revision"], "godot_minimum": "4.3", "animations": [],
        "source": objet["source"], "corrections": objet["corrections"], "grille": g, "terrains": objet["terrains"],
        "cellules": objet["cellules"], "carte": objet["carte"], "diagnostic": objet["diagnostic"]}
    return manifeste, {"atlas.png": atlas, "tuiles.tres": ('\n'.join(lignes)+'\n').encode('utf-8'),
                       "carte.tscn": scene.encode('utf-8'), "composition.json": _json(manifeste)}
