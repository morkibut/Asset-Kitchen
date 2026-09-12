"""Paquets de tenue : mêmes atlas pour aperçu, Aseprite et couches Godot."""
from __future__ import annotations

import io
import json
import zipfile

import numpy as np
from PIL import Image

from atelier.domaine import aseprite
from atelier.domaine.bande import Bande
from atelier.domaine.tenue import TenueRefusee
from atelier.image.bande import en_image_animee
from atelier.image.calques_cibles import png, rgba
from atelier.image.tenue import composer_couches
from atelier.services.livraison import _json, _cle, _chaine


def _planche(images):
    tailles = {i.shape for i in images}
    if len(tailles) != 1:
        raise TenueRefusee("Les frames d'une animation doivent partager un cadre. Corrigez le montage avant de livrer.")
    return png(np.concatenate(images, axis=1))


def paquet(service, projet, personnage, identifiant, mode="couches", revision=None):
    if mode not in ("couches", "assemble"):
        raise TenueRefusee("Choisissez les couches combinables ou la tenue assemblée.")
    objet = service.lire(projet, personnage, identifiant, revision)
    couverture = objet["couverture"]
    if not couverture["toutes_couches_pretes" if mode == "couches" else "prete"]:
        raise TenueRefusee("Des frames ou des calques manquent ou restent à revoir. La tenue conservée reste consultable ; complétez-la avant cet export.")
    fichiers, animations = {}, []
    actifs = service._actifs(objet, None)
    emplois = sorted(objet["emplois"], key=lambda e: (e["priorite"], e["piece"]))
    for sortie in objet["sorties"]:
        cle = _cle(sortie["nature"] + "/" + sortie["pose"] + "/" + sortie["direction"])
        frames = [service._pixels(objet, sortie, rang) for rang in range(len(sortie["frames"]))]
        h, w = frames[0][0].shape[:2]
        composees = [rgba(composer_couches(base, couches, actifs)) for base, couches in frames]
        serie = {"assemble": composees}
        ordres = []
        if mode == "couches":
            serie["corps"] = [base for base, _ in frames]
            for e in emplois:
                nom_piece = _cle(e["piece"])
                for couche in ("dessous", "dessus", "masque_corps"):
                    serie[f"{nom_piece}-{couche}"] = [next(c[couche] for c in couches if c["piece"] == e["piece"]) for _, couches in frames]
            ordres = [[c["piece"] for c in couches] for _, couches in frames]
        bande = Bande(identifiant=identifiant, clip="", nom=sortie["titre"], cadence=sortie["cadence"], sens=sortie["sens"])
        atlas = {}
        for couche, images in serie.items():
            nom = f"{cle}-{couche}"
            planche = _planche(images)
            fichiers[nom + ".png"] = planche
            fichiers[nom + ".json"] = _json(aseprite.descriptif(bande, image=nom + ".png", case_largeur=w, case_hauteur=h, compte=len(frames)))
            atlas[couche] = nom + ".png"
            if couche == "assemble":
                fichiers[nom + "-anime.png"] = en_image_animee(planche, w, h, sortie["ordre"], aseprite.duree_en_ms(sortie["cadence"]))
        animations.append({"cle": cle, "nom": f"{sortie['pose']}/{sortie['direction'] or 'toutes'}" + ("/fixe" if sortie["nature"] == "image" else ""),
            "titre": sortie["titre"], "nature": sortie["nature"], "pose": sortie["pose"], "direction": sortie["direction"],
            "bande": sortie["resultat"], "compte": len(frames), "largeur": w, "hauteur": h,
            "ordre": sortie["ordre"], "cadence": sortie["cadence"], "duree_image_ms": aseprite.duree_en_ms(sortie["cadence"]),
            "boucle": sortie["boucle"], "atlas": atlas, "ordres_calques": ordres,
            "provenance": {"tenue": objet["identifiant"], "revision": objet["revision"], "frames": sortie["frames"]}})
    manifeste = {"atelier": "Asset Kitchen", "format": 1, "tenue": identifiant, "revision_tenue": objet["revision"],
        "projet": projet, "personnage": personnage, "nom": objet["nom"], "mode": mode,
        "pivot": objet["pivot"], "emplois": emplois, "animations": animations}
    fichiers["composition.json"] = _json(manifeste)
    fichiers.update(godot(manifeste))
    return manifeste, fichiers


def _frames(animations, couche):
    externes, atlas, sequences = [], [], []
    for i, animation in enumerate(animations):
        externes.append(f'[ext_resource type="Texture2D" path={_chaine(animation["atlas"][couche])} id="T{i}"]')
        for n in range(animation["compte"]):
            atlas.append(f'[sub_resource type="AtlasTexture" id="A{i}_{n}"]\natlas = ExtResource("T{i}")\nregion = Rect2({n * animation["largeur"]}, 0, {animation["largeur"]}, {animation["hauteur"]})')
        frames = ", ".join(f'{{"duration": 1.0, "texture": SubResource("A{i}_{n}")}}' for n in animation["ordre"])
        sequences.append(f'{{"frames": [{frames}], "loop": {str(animation["boucle"]).lower()}, "name": &{_chaine(animation["nom"])}, "speed": {1000 / animation["duree_image_ms"]:.12g}}}')
    return (f'[gd_resource type="SpriteFrames" load_steps={1+len(externes)+len(atlas)} format=3]\n\n' + "\n\n".join(externes+atlas) + '\n\n[resource]\nanimations = [' + ",\n".join(sequences) + "]\n").encode()


def godot(manifeste):
    """Une horloge, des atlas synchrones, des masques de corps activables."""
    animations, emplois, pivot = manifeste["animations"], manifeste["emplois"], manifeste["pivot"]
    couches = manifeste["mode"] == "couches"
    fichiers = {"animations.tres": _frames(animations, "corps" if couches else "assemble")}
    ressources = ['[ext_resource type="SpriteFrames" path="animations.tres" id="Corps"]']
    n = len(emplois) if couches else 0
    if couches:
        ressources += ['[ext_resource type="Script" path="tenue.gd" id="Script"]', '[ext_resource type="Shader" path="corps.gdshader" id="Masque"]']
        for i, e in enumerate(emplois):
            for cote in ("dessous", "dessus"):
                nom = f"piece-{i}-{cote}.tres"
                fichiers[nom] = _frames(animations, f"{_cle(e['piece'])}-{cote}")
                ressources.append(f'[ext_resource type="SpriteFrames" path="{nom}" id="P{i}_{cote}"]')
    noeuds = ['[node name="Tenue" type="Node2D"]\ntexture_filter = 1' + ('\nscript = ExtResource("Script")' if couches else "")]
    commun = f'centered = false\noffset = Vector2({-pivot["x"]}, {-pivot["y"]})\nanimation = &{_chaine(animations[0]["nom"])}'
    noeuds.append('[node name="Corps" type="AnimatedSprite2D" parent="."]\nsprite_frames = ExtResource("Corps")\n' + commun + f'\nautoplay = {_chaine(animations[0]["nom"])}' + ('\nmaterial = SubResource("Masques")' if couches else ""))
    for i, _ in enumerate(emplois if couches else []):
        for cote in ("dessous", "dessus"):
            noeuds.append(f'[node name="Piece{i}_{cote}" type="AnimatedSprite2D" parent="."]\nsprite_frames = ExtResource("P{i}_{cote}")\n' + commun)
    sous = '[sub_resource type="ShaderMaterial" id="Masques"]\nresource_local_to_scene = true\nshader = ExtResource("Masque")' if couches else ""
    fichiers["tenue.tscn"] = (f'[gd_scene load_steps={1+len(ressources)+(1 if couches else 0)} format=3]\n\n' + "\n\n".join(ressources + ([sous] if sous else []) + noeuds) + "\n").encode()
    if not couches:
        return fichiers
    uniforms = "\n".join(f'uniform sampler2D masque_{i} : filter_nearest, repeat_disable;\nuniform bool actif_{i} = false;' for i in range(n))
    fragment = "\n".join(f'    if (actif_{i}) COLOR.a *= texture(masque_{i}, UV).a;' for i in range(n))
    fichiers["corps.gdshader"] = ("shader_type canvas_item;\n" + uniforms + "\nvoid fragment() {\n" + fragment + "\n}\n").encode()
    noms = [e["piece"] for e in emplois]
    masque = {a["nom"]: [a["atlas"][f"{_cle(e['piece'])}-masque_corps"] for e in emplois] for a in animations}
    ordres = {a["nom"]: [a["ordres_calques"][frame] for frame in a["ordre"]] for a in animations}
    # Les tableaux JSON sont aussi des littéraux GDScript ; pas de chemin de
    # ressource construit depuis un nom saisi dans le jeu.
    texte = 'extends Node2D\n\n'
    texte += 'const PIECES = ' + json.dumps(noms, ensure_ascii=False) + '\n'
    texte += 'const MASQUES = ' + json.dumps(masque, ensure_ascii=False) + '\n'
    texte += 'const ORDRES = ' + json.dumps(ordres, ensure_ascii=False) + '\n'
    texte += 'var actives: Dictionary = ' + json.dumps({e["piece"]: e["actif"] for e in emplois}, ensure_ascii=False) + '\n'
    texte += '''@onready var corps: AnimatedSprite2D = $Corps
var textures: Dictionary = {}

func _ready() -> void:
    var dossier: String = get_script().resource_path.get_base_dir()
    for animation in MASQUES:
        textures[animation] = []
        for fichier in MASQUES[animation]:
            textures[animation].append(load(dossier.path_join(fichier)))
    corps.frame_changed.connect(_synchroniser)
    corps.animation_changed.connect(_synchroniser)
    _synchroniser()

func equiper(piece: String, active: bool) -> void:
    if not actives.has(piece):
        push_error("Cette pièce n'est pas dans la tenue : " + piece)
        return
    actives[piece] = active
    _synchroniser()

func jouer(animation: StringName) -> void:
    if corps.sprite_frames.has_animation(animation):
        corps.play(animation)
        _synchroniser()

func _synchroniser() -> void:
    if not is_instance_valid(corps) or not textures.has(String(corps.animation)):
        return
    var animation: String = String(corps.animation)
    var ordre: Array = ORDRES[animation][corps.frame]
    for i in range(PIECES.size()):
        var piece: String = PIECES[i]
        var active: bool = actives[piece]
        corps.material.set_shader_parameter("masque_" + str(i), textures[animation][i])
        corps.material.set_shader_parameter("actif_" + str(i), active)
        for cote in ["dessous", "dessus"]:
            var calque: AnimatedSprite2D = get_node("Piece" + str(i) + "_" + cote)
            calque.visible = active
            calque.animation = corps.animation
            calque.set_frame_and_progress(corps.frame, corps.frame_progress)
            var rang: int = ordre.find(piece)
            calque.z_index = rang + 1 if cote == "dessus" else rang - PIECES.size()
'''
    fichiers["tenue.gd"] = texte.encode()
    return fichiers


def archive(manifeste, fichiers):
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, "w", zipfile.ZIP_DEFLATED) as sortie:
        for nom, octets in fichiers.items():
            sortie.writestr(nom, octets)
    return tampon.getvalue()
