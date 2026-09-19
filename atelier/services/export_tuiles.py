"""TileSetAtlasSource natif et carte TileMapLayer, sans script d’initialisation.

Le contrat de sérialisation est vérifié par chargement dans Godot dans AU13 ; pour un jeu
fabriqué (TU4), Godot repeint la carte livrée par set_cells_terrain_connect et doit poser
les mêmes pièces que l'atelier (tests/test_tu4_livraison.py). Un mur (TU7) sort avec le
.tres de sc-clone, une carte à plusieurs couches triées en profondeur et un LISEZMOI des
règles de pose (tests/test_tu7_mur.py).
Les coordonnées d’atlas restent stables, même quand une tuile est écartée.
"""
import json
import struct
from atelier.domaine import masques_tuiles, pose_mur
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


def _entete(objet):
    """tresAtlasHeader."""
    t, g = objet["recette"]["taille"], objet["grille"]
    lignes = ['[gd_resource type="TileSet" load_steps=3 format=3]', '',
              '[ext_resource type="Texture2D" path="atlas.png" id="1"]', '',
              '[sub_resource type="TileSetAtlasSource" id="Atlas"]', 'texture = ExtResource("1")',
              f'texture_region_size = Vector2i({t}, {t})']
    if g["marge"] or g["espacement"]:
        lignes += [f'margins = Vector2i({g["marge"]}, {g["marge"]})', f'separation = Vector2i({g["espacement"]}, {g["espacement"]})']
    return lignes


def _terrains(objet):
    lignes = []
    for i, terrain in enumerate(objet["terrains"]):
        couleur = ', '.join(_nombre(int(terrain["couleur"][n:n+2], 16) / 255) for n in (1, 3, 5))
        lignes += [f'terrain_set_0/terrain_{i}/name = {chaine(terrain["nom"])}',
                   f'terrain_set_0/terrain_{i}/color = Color({couleur}, 1)']
    return lignes


def _tres_fabrique(objet):
    r = objet["recette"]
    sorte, t = r["sorte"], r["taille"]
    if sorte == "mur":
        return _tres_mur(objet)
    lignes = _entete(objet)
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
    lignes += _terrains(objet)
    lignes.append('sources/0 = SubResource("Atlas")')
    return '\n'.join(lignes) + '\n'


# ── Le mur (TU7) : le .tres de godotWallTileset, la carte posée, le LISEZMOI ──

def _origine_tri(case, t):
    """Le y_sort_origin qu'écrit godotWallTileset pour une case : la base seule, au bord bas
    de la case ; une pièce en biais posée `dy` rangées sous l'emprise remonte d'autant
    (base-basse). None : la case ne se trie pas d'elle-même."""
    if case["bande"] != "base":
        return None
    dy = 1 if case.get("piece") == "base-basse" else 0
    return t // 2 - dy * t


def _collision(case, t):
    """Le polygone de collision, centré sur la case : un rectangle, ou le triangle de la
    base-basse d'une bande en biais (biaisCollisionPoints)."""
    if case["bande"] != "base":
        return None
    h = t // 2
    if case.get("piece") == "base-basse":
        unitaires = [[0, 0], [1, 0], [1, 1]] if case["sens"] == "droite" else [[0, 0], [1, 0], [0, 1]]
        return [v for u, w in unitaires for v in (u * t - h, w * t - h)]
    return [-h, -h, h, -h, h, h, -h, h]


def _cases_mur(objet):
    return masques_tuiles.cases_du_mur(objet["recette"]["reglages"].get("decor", "aucun"))


def _tres_mur(objet):
    """godotWallTileset (sc-clone, public/exports.js), ligne pour ligne.

    Le dessus est un terrain blob 47 écrit exactement comme celui d'un sol à un seul
    terrain ; chaque autre case posable est une tuile simple, avec sa collision et son
    origine de tri quand c'est une base. Les flancs à 45° restent peints mais ne sont pas
    déclarés (T27). tests/test_tu7_mur.py compare ce texte à celui de exports.js.
    """
    t = objet["recette"]["taille"]
    lignes = _entete(objet)
    for case in _cases_mur(objet):
        if case["bande"] != "top" or not case["posable"]:
            continue
        cle = f'{case["x"]}:{case["y"]}/0'
        lignes += [f'{cle} = 0', f'{cle}/terrain_set = 0', f'{cle}/terrain = 0']
        lignes += [f'{cle}/terrains_peering_bit/{nom} = {v}' for nom, v in masques_tuiles.bits_godot("B47", case["etat"]).items()]
    for case in _cases_mur(objet):
        if case["bande"] == "top" or not case["posable"]:
            continue
        cle = f'{case["x"]}:{case["y"]}/0'
        lignes.append(f'{cle} = 0')
        points = _collision(case, t)
        if points:
            lignes.append(f'{cle}/physics_layer_0/polygon_0/points = PackedVector2Array({", ".join(map(str, points))})')
        origine = _origine_tri(case, t)
        if origine is not None:
            lignes.append(f'{cle}/y_sort_origin = {origine}')
    lignes += ['', '[resource]', f'tile_size = Vector2i({t}, {t})', 'terrain_set_0/mode = 0']
    lignes += _terrains(objet)
    lignes += ['physics_layer_0/collision_layer = 1', 'physics_layer_0/collision_mask = 1', 'sources/0 = SubResource("Atlas")']
    return '\n'.join(lignes) + '\n'


def couches_du_mur(objet):
    """Les couches de la carte d'un mur : [{nom, tri, origine, z, visible, cases}].

    La scène du moteur peint le mur pile par pile, en triant chaque pile sur la rangée de
    son **emprise** (le peintre de `dessinerScene` parcourt les emprises de haut en bas,
    et le personnage s'y glisse à sa ligne de pieds). Godot trie chaque tuile sur sa
    propre case. Pour qu'il trie comme la scène, chaque couche porte un `y_sort_origin`
    qui ramène ses tuiles sur la ligne de leur base : la couche « Base » à 0 (la base
    porte déjà son origine dans le .tres), « Face_k » à k cases et demie, « Dessus » à
    h cases et demie. C'est l'usage prévu de TileMapLayer.y_sort_origin (« simuler un
    autre niveau de hauteur »), et le .tres reste celui de sc-clone.

    Une case ne porte qu'une tuile par couche : quand deux piles se superposent (le
    dessus d'une rangée basse sur la base d'une rangée haute, deux pentes d'un V), la
    seconde prend une couche de plus du même étage — la plus basse encore libre, dans
    l'ordre du peintre, comme la preuve de sc-clone (scripts/preuve-map-godot.mjs).

    L'ombre est une tache sur le sol : couche « Ombre », sous tout le reste (z_index -1),
    sans tri. Et « Emprise », invisible, bloque les cases d'emprise dont la base n'est pas
    peinte (une case couverte par sa voisine du sud) : sans elle, on traverserait un mur
    vertical partout sauf à son pied.
    """
    r = objet["recette"]
    t, h = r["taille"], r["reglages"]["hauteurMur"]
    emprise = {(c["x"], c["y"]) for c in objet["carte"]["cases"]}
    par_case = {(c["x"], c["y"]): c for c in masques_tuiles.cases_du_mur()}
    groupes: dict = {}
    for p in pose_mur.poses(emprise, h):
        if p["ancre"] is None:
            cle = ("Ombre", None)
        else:
            niveau = p["ancre"] - p["y"]
            origine_case = _origine_tri(par_case[(p["col"], p["row"])], t) or 0
            decalage = niveau * t + t // 2 - origine_case
            cle = ("Base" if decalage == 0 else "Dessus" if decalage == h * t + t // 2 else f"Face_{decalage // t}", decalage)
        pile = groupes.setdefault(cle, [])
        k = 0
        while k < len(pile) and (p["x"], p["y"]) in pile[k]:
            k += 1
        if k == len(pile):
            pile.append({})
        pile[k][(p["x"], p["y"])] = (p["col"], p["row"])
    bases = {xy for (nom, _), pile in groupes.items() if nom == "Base" for couche in pile for xy in couche}
    couvertes = sorted(emprise - bases, key=lambda c: (c[1], c[0]))
    couches = []
    if couvertes:
        base_isolee = (masques_tuiles.MUR_ETATS.index("isolated"), pose_mur.LIGNE_BASE)
        couches.append({"nom": "Emprise", "tri": False, "origine": 0, "z": 0, "visible": False,
                        "cases": {xy: base_isolee for xy in couvertes}})
    ordre = sorted(groupes, key=lambda c: (c[1] is not None, c[1] or 0))
    for nom, decalage in ordre:
        for i, cases in enumerate(groupes[(nom, decalage)]):
            couches.append({"nom": nom if i == 0 else f"{nom}_{i + 1}", "tri": decalage is not None,
                            "origine": decalage or 0, "z": -1 if decalage is None else 0, "visible": True, "cases": cases})
    return couches


def _donnees(cases):
    """TileMapLayer FORMAT_1 : un uint16 de version, puis six int16 par case."""
    return struct.pack('<H', 0) + b''.join(struct.pack('<hhhhhh', x, y, 0, col, row, 0)
                                           for (x, y), (col, row) in sorted(cases.items(), key=lambda c: (c[0][1], c[0][0])))


def _octets(donnees):
    return 'PackedByteArray(' + ', '.join(str(n) for n in donnees) + ')'


def _scene_mur(objet):
    lignes = ['[gd_scene load_steps=2 format=3]', '', '[ext_resource type="TileSet" path="tuiles.tres" id="1"]', '',
              '[node name="Carte" type="Node2D"]', 'y_sort_enabled = true', 'texture_filter = 1']
    for c in couches_du_mur(objet):
        lignes += ['', f'[node name="{c["nom"]}" type="TileMapLayer" parent="."]']
        if not c["visible"]:
            lignes.append('visible = false')
        if c["z"]:
            lignes.append(f'z_index = {c["z"]}')
        if c["tri"]:
            lignes.append('y_sort_enabled = true')
            if c["origine"]:
                lignes.append(f'y_sort_origin = {c["origine"]}')
        lignes += ['tile_set = ExtResource("1")', f'tile_map_data = {_octets(_donnees(c["cases"]))}']
    return '\n'.join(lignes) + '\n'


_COLONNES = "isolée, bout gauche, milieu, bout droit, (deux flancs à 45°, jamais posés), coin gauche, coin droit"


def _lisezmoi_mur(objet):
    r = objet["recette"]
    h, t, decor = r["reglages"]["hauteurMur"], r["taille"], r["reglages"].get("decor", "aucun")
    faces = "pas de face, le dessus se pose juste au-dessus de la base" if h == 1 else \
        f"{h - 1} étage{'s' if h > 2 else ''} de face entre la base et le dessus"
    couche_face = "" if h == 1 else "\n- « Face_1 »" + (f" à « Face_{h - 1} »" if h > 2 else "") + " : la face, un étage par couche."
    garder_tri = "" if h == 1 else "\nPosez chaque étage de face sur sa couche, pour garder le tri."
    ligne_face = "" if h == 1 else "\n- la face en (x, y - 1)" +(f" … (x, y - {h - 1})" if h > 2 else "") + " ;"
    texte = f"""Le mur « {objet["nom"]} » pour Godot 4.3 ou plus récent

Dans ce dossier
- atlas.png : les pièces du mur, en cases de {t} pixels.
- tuiles.tres : le jeu de tuiles. Le dessus du mur est un terrain « Match Corners and Sides ». La face, la base et l'ombre sont des tuiles simples.
- carte.tscn : la carte peinte dans l'atelier, déjà posée.

La carte
Le nœud « Carte » trie en profondeur (Y-sort). Chaque étage du mur a sa couche :
- « Ombre » : l'ombre au pied du mur, sous tout le reste (z_index -1).
- « Base » : le pied du mur. Il bloque le passage.{couche_face}
- « Dessus » : le haut du mur.
- « Emprise » (invisible, seulement si besoin) : bloque les cases de mur dont le pied est caché par le mur de devant.
Une couche suivie de « _2 » sert quand deux murs se recouvrent sur la même case.
Chaque couche remonte son point de tri (y_sort_origin) jusqu'à la ligne de la base : tout le mur se trie comme un seul objet.
Mettez votre personnage dans « Carte ». Il passe derrière le mur quand ses pieds sont au-dessus de la base, devant quand ils sont en dessous.
Mettez votre sol dans une couche avec un z_index de -2 ou moins.

Poser un mur à la main
Ce mur fait {h} case{'s' if h > 1 else ''} de haut : {faces}. Pour une case de mur en (x, y) :
- le dessus va en (x, y - {h}) ;{ligne_face}
- la base en (x, y) ;
- l'ombre en (x, y + 1), seulement si la case du dessous n'est pas un mur.{garder_tri}

Le bord sud du dessus est toujours fermé
Sous le dessus, il y a toujours la face, jamais le sol. Si vous peignez le dessus avec l'outil Terrains de Godot, il laisse ce bord ouvert là où il n'y a pas de mur au sud, et le sol se voit à travers le mur. C'est pour ça que la carte fournie pose le dessus case par case. À la main, prenez la pièce du dessus dont le bord du bas est plein.

Les courses
Les huit colonnes de la face, de la base et de l'ombre sont, dans l'ordre : {_COLONNES}.
Regardez la rangée entière, pas la case seule. Une course, ce sont les cases de mur qui se touchent sur une même rangée : milieu au milieu, bout gauche et bout droit aux extrémités, isolée pour une course d'une seule case.
Quand une course commence juste en diagonale de la fin d'une autre (un escalier), les deux bouts se raccordent l'un à l'autre, comme s'ils étaient voisins. Les deux ensemble, jamais un seul : sinon il reste une fente entre les marches. Dans un escalier, la marche du haut prend les pièces en biais (lignes 10 et 11 de l'atlas), et une pente se pose sur la case vide, à la hauteur du dessus.
Si la case en bas à gauche est un mur, prenez le coin gauche ; en bas à droite, le coin droit ; des deux côtés, le milieu.

Collision
Seule la base bloque. La base coupée d'une marche en biais bloque en triangle. Le dessus et la face ne bloquent pas : sinon le personnage butterait une case trop haut."""
    if decor != "aucun":
        texte += """

Le décor (gravats)
Les dernières lignes de l'atlas sont des gravats. Ce ne sont pas des tuiles de terrain : ils se posent sur une couche à part, au-dessus du mur. Ils se posent toujours par paires : une moitié sur la case vide qui touche le mur, l'autre sur la case de mur d'en face. Une moitié seule laisse une fente droite. La carte fournie ne les pose pas encore."""
    return texte + "\n"


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
    mur = (objet.get("recette") or {}).get("sorte") == "mur"
    if mur:
        # La carte d'un mur est son emprise : la scène y pose ombre, base, faces et dessus.
        scene = _scene_mur(objet)
    else:
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
    fichiers = {"atlas.png": atlas, "tuiles.tres": tres.encode('utf-8'),
                "carte.tscn": scene.encode('utf-8'), "composition.json": _json(manifeste)}
    if mur:
        fichiers["LISEZMOI.txt"] = _lisezmoi_mur(objet).encode('utf-8')
    return manifeste, fichiers
