"""TileSetAtlasSource natif et carte TileMapLayer, sans script d’initialisation.

Le contrat de sérialisation est vérifié par chargement dans Godot dans AU13 ; pour un jeu
fabriqué (TU4), Godot repeint la carte livrée par set_cells_terrain_connect et doit poser
les mêmes pièces que l'atelier (tests/test_tu4_livraison.py).
Les coordonnées d’atlas restent stables, même quand une tuile est écartée.
"""
import json
import struct
from atelier.domaine import masques_tuiles
from atelier.domaine.tuiles import TuilesRefusees
from atelier.services.livraison import _json

VOISINS = {"est": "right_side", "sud-est": "bottom_right_corner", "sud": "bottom_side",
           "sud-ouest": "bottom_left_corner", "ouest": "left_side", "nord-ouest": "top_left_corner",
           "nord": "top_side", "nord-est": "top_right_corner"}

def chaine(s): return json.dumps(s, ensure_ascii=False)

# ── Un jeu fabriqué (TU4) : le .tres que sc-clone écrit ───────────────────────
# Portage de `public/exports.js` (sc-clone, commit f27f054) : tresAtlasHeader,
# terrainTileEntries, godotAnimationProperties, terrainResourceSection et
# godotFlatTileset. Même texte, ligne pour ligne (tests/test_tu4_livraison.py le compare
# à la sortie de exports.js) ; rien n'est recalculé ici que la table des masques ne
# dise déjà (atelier/domaine/masques_tuiles.py).

MUR_A_VENIR = ("La livraison d’un mur arrive bientôt : son dessus, ses bandes et leurs collisions "
               "sortiront ensemble. En attendant, ce jeu se garde et se règle, mais ne se livre pas.")

# Durée d'une image d'animation : DEFAULT_ANIMATION_FRAME_DURATION_MS du moteur (200 ms).
DUREE_IMAGE = 0.2


def _nombre(x):
    """Un nombre écrit comme JavaScript l'écrit : 1 et 0, jamais 1.0 et 0.0."""
    return str(int(x)) if float(x).is_integer() else repr(float(x))


def _animation(cle, images, separation):
    """godotAnimationProperties : propriétés de la case, hors de l'alternative `/0`.

    `separation` se compte en cases (mesuré par sc-clone sur Godot 4.7.2) : l'image k
    tombe `k * (1 + separation)` lignes sous la pièce. Les images descendent dans sa
    colonne (`animation_columns = 1`).
    """
    lignes = [f"{cle}/animation_columns = 1", f"{cle}/animation_separation = Vector2i(0, {separation})",
              f"{cle}/animation_speed = 1", f"{cle}/animation_mode = 0"]
    return lignes + [f"{cle}/animation_frame_{i}/duration = {_nombre(DUREE_IMAGE)}" for i in range(images)]


def animations(recette):
    """Les deux animations possibles d'un jeu fabriqué, telles que la disposition les rend.

    → (animation de l'atlas entier, animation de la pièce pleine) ; chacune None ou
    `{"images": n, "separation": s, "piece": (x, y) | None}`. La séparation se lit sur
    la disposition réelle (masques_tuiles.disposition), jamais recalculée : c'est elle
    qui dit où le rendu a peint les images.
    """
    reg = recette["reglages"]
    forme = masques_tuiles.disposition(recette["sorte"], reg.get("variantes", 0), reg.get("animation", 0),
                                       reg.get("animationAtlas", 0), reg.get("decor", "aucun"))
    if forme["copies"]:
        c = forme["copies"]
        return {"images": c["nombre"], "separation": c["lignes"] - 1, "piece": None}, None
    if forme["images"]:
        plein = masques_tuiles.position_pleine(recette["sorte"])
        return None, {"images": len(forme["images"]) + 1, "separation": forme["images"][0][1] - plein[1] - 1, "piece": plein}
    return None, None


def images_animees(objet):
    """Chaque case d'image d'animation que Godot lira : {(x, y) de la pièce: [cases]}.

    L'image 0 est la pièce elle-même ; les suivantes doivent tomber sur des cases que
    rien ne déclare, sinon Godot refuse l'animation en silence (exports.js).
    """
    atlas, plein = animations(objet["recette"])
    spec = atlas or plein
    if not spec:
        return {}
    pas = spec["separation"] + 1
    animees = [(p["x"], p["y"]) for p in objet["pieces"] if p["role"] in ("masque", "dessous", "variante")] if atlas else [plein["piece"]]
    return {xy: [(xy[0], xy[1] + k * pas) for k in range(spec["images"])] for xy in animees}


def _tres_fabrique(objet):
    r = objet["recette"]
    sorte, t = r["sorte"], r["taille"]
    if sorte == "mur":
        raise TuilesRefusees(MUR_A_VENIR)
    g = objet["grille"]
    lignes = ['[gd_resource type="TileSet" load_steps=3 format=3]', '',
              '[ext_resource type="Texture2D" path="atlas.png" id="1"]', '',
              '[sub_resource type="TileSetAtlasSource" id="Atlas"]', 'texture = ExtResource("1")',
              f'texture_region_size = Vector2i({t}, {t})']
    if g["marge"] or g["espacement"]:
        lignes += [f'margins = Vector2i({g["marge"]}, {g["marge"]})', f'separation = Vector2i({g["espacement"]}, {g["espacement"]})']
    jeu = masques_tuiles.jeu_de(sorte)
    if jeu is None:
        # Le 17 pièces : un atlas plat, sans terrain (godotFlatTileset). Seules les 17
        # pièces sont déclarées ; sc-clone déclarait aussi les 8 cases vides de la grille.
        lignes += [f'{p["x"]}:{p["y"]}/0 = 0' for p in objet["pieces"]]
        lignes += ['', '[resource]', f'tile_size = Vector2i({t}, {t})', 'sources/0 = SubResource("Atlas")']
        return '\n'.join(lignes) + '\n'
    indices = {terrain["identifiant"]: i for i, terrain in enumerate(objet["terrains"])}
    peint, dessous = indices["surface"], indices.get("dessous")
    atlas_anime, plein_anime = animations(r)
    for p in objet["pieces"]:
        cle = f'{p["x"]}:{p["y"]}'
        if p["role"] == "decor":
            continue
        # terrainTileEntries : la pièce, son terrain, ses bits — un bit absent vaut le
        # terrain du dessous quand il y en a un (T7), sinon -1.
        masque = 0 if p["role"] == "dessous" else p["masque"]
        lignes += [f'{cle}/0 = 0', f'{cle}/0/terrain_set = 0',
                   f'{cle}/0/terrain = {dessous if p["role"] == "dessous" else peint}']
        for nom, v in masques_tuiles.bits_godot(jeu, masque, peint).items():
            lignes.append(f'{cle}/0/terrains_peering_bit/{nom} = {dessous if v == -1 and dessous is not None else v}')
        if p["role"] == "variante":
            # Le poids normalisé sur celui de la pièce pleine : une chance égale (T13).
            lignes.append(f'{cle}/0/probability = 1')
        if atlas_anime:
            lignes += _animation(cle, atlas_anime["images"], atlas_anime["separation"])
        elif plein_anime and p["role"] == "masque" and (p["x"], p["y"]) == plein_anime["piece"]:
            lignes += _animation(cle, plein_anime["images"], plein_anime["separation"])
    # Le décor (T27) : des tuiles libres, sans terrain, après toutes celles du terrain.
    lignes += [f'{p["x"]}:{p["y"]}/0 = 0' for p in objet["pieces"] if p["role"] == "decor"]
    lignes += ['', '[resource]', f'tile_size = Vector2i({t}, {t})', f'terrain_set_0/mode = {masques_tuiles.mode_godot(jeu)}']
    for i, terrain in enumerate(objet["terrains"]):
        couleur = ', '.join(_nombre(int(terrain["couleur"][n:n+2], 16) / 255) for n in (1, 3, 5))
        lignes += [f'terrain_set_0/terrain_{i}/name = {chaine(terrain["nom"])}',
                   f'terrain_set_0/terrain_{i}/color = Color({couleur}, 1)']
    lignes.append('sources/0 = SubResource("Atlas")')
    return '\n'.join(lignes) + '\n'


def _tres_image(objet):
    """Un jeu fait à partir d'une image (AU13) : inchangé depuis AU13."""
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
    return '\n'.join(lignes)+'\n'


def paquet(objet, atlas):
    g = objet["grille"]
    tres = _tres_fabrique(objet) if objet.get("recette") else _tres_image(objet)
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
    if objet.get("recette"):
        manifeste["recette"] = objet["recette"]
    return manifeste, {"atlas.png": atlas, "tuiles.tres": tres.encode('utf-8'),
                       "carte.tscn": scene.encode('utf-8'), "composition.json": _json(manifeste)}
