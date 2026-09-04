# -*- coding: utf-8 -*-
"""Le montage que le produit envoie à la carte de la maison — **et qu'il écrit lui-même**.

Arrivé en A11 (V3).

## Pourquoi le produit l'écrit, plutôt que de charger un fichier

ComfyUI a deux formats. Celui de l'éditeur décrit des boîtes, des fils et leurs
positions à l'écran ; celui de l'API est un dictionnaire plat où chaque étape
porte son numéro, son type et ses entrées. **`POST /prompt` n'accepte que le
second**, et les montages qu'on trouve en ligne sont dans le premier.

Mais la vraie raison n'est pas là. Un montage importé serait **un fichier que
l'auteur devrait maintenir** : le jour où un nœud change de nom, c'est lui qui
découvrirait la panne, sur un fichier qu'il n'a pas écrit. Ce qui est ici tient
en cinquante lignes, se relit, et **se corrige au même endroit que le reste du
produit**. C'est le dernier critère d'`A11`, et c'est aussi ce que la tranche
refuse d'être : ni un second atelier, ni un éditeur de montages.

## Ce que ce montage est, en une phrase

Le gros modèle Wan 2.2 image→vidéo — quatorze milliards de paramètres, en
version compressée — plus **le seul greffon au monde entraîné exprès pour animer
des sprites**, plus un greffon d'accélération qui ramène le calcul à quatre
étapes. Tout sous licence Apache 2.0, utilisable dans un jeu vendu.

**Comment le gros modèle tient dans une carte de 8 Go.** Il vient en deux
moitiés — *bruit fort* et *bruit faible* — qui ne travaillent **jamais en même
temps** : la première fait les deux premières étapes, la seconde les deux
dernières. ComfyUI charge l'une, calcule, la décharge, charge l'autre. Ce qui
coûte double est le disque et le temps de chargement, **pas la mémoire vidéo** —
6,0 Go pris sur 6,92 disponibles, mesuré le 3 septembre 2026.

## Les trois choses relevées dans le code installé, et jamais devinées

Signatures relevées le 2 septembre 2026 dans `comfy_extras/nodes_wan.py` et dans
le greffon `ComfyUI-GGUF` :

- **Le nombre d'images suit `4n + 1`**, et les côtés sont des multiples de 16.
  Le calcul de ComfyUI est `((length - 1) // 4) + 1` ; le produit, lui, arrondit
  **vers le haut** (`ModeleVideo.images_reelles`) — un clip plus court que
  demandé est une seconde d'animation qu'on n'a pas.
- ⚠️ **`PainterI2V` n'existe pas dans un ComfyUI ordinaire.** Le montage officiel
  livré avec le greffon pixel art l'emploie ; il est absent de l'installation.
  Remplacé par `WanImageToVideo`, livré d'origine, qui fait le même travail —
  encoder l'image de départ et fabriquer l'espace vide où la suite se dessinera.
  **Vérifié après coup : la substitution est bonne**, le sprite est ancré au
  pixel près sur la première image. *Si un jour le résultat déçoit, c'est le
  premier endroit où regarder.*
- ⚠️ **L'encodeur de texte n'est pas la version compressée, et c'est un
  contournement.** Le chargeur compressé reconstruit son dictionnaire de mots à
  partir des métadonnées du fichier, et réclame pour cela une version de
  `protobuf` plus récente que celle installée. Or **cette version-là est celle
  qu'exigent les paquets du générateur de bruitages** : la mettre à jour aurait
  risqué de casser le son pour gagner 2,4 Go de disque. La version non compressée
  embarque son propre dictionnaire et se charge par le nœud d'origine. C'est
  l'application directe de la règle de la tranche — *le produit ne touche jamais
  à l'environnement de ComfyUI, il s'adapte à ce qu'il y trouve*.

## Les réglages ne sont pas inventés

Quatre étapes, fidélité à 1,0, méthode `ddim`, rythme `simple`, décalage 5,0, et
la bascule d'une moitié à l'autre au bout de deux étapes : c'est le montage
officiel du greffon (`wan2-2-video.json`, relevé chez l'hébergeur le 3 septembre
2026). Rien n'y a été réglé au jugé.
"""

from __future__ import annotations

from typing import Any

# ── Les fichiers que le montage nomme ────────────────────────────────────────
#
# **Ce sont des noms, pas des chemins.** ComfyUI les résout dans ses propres
# dossiers de modèles, et c'est très exactement ce qu'on veut : le produit ne
# sait pas où ComfyUI range ses fichiers, et n'a aucune raison de l'apprendre
# pour lancer un clip. Il l'apprend seulement pour *télécharger* ce qui manque,
# et c'est un autre geste (`atelier/fournisseur/maison.py`).

HAUT = "Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf"
BAS = "Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf"
ENCODEUR = "umt5_xxl_fp8_e4m3fn_scaled.safetensors"
VAE = "wan_2.1_vae.safetensors"
GREFFON_PIXEL = "wan2.2_animate_adapter_model.safetensors"
VITE_HAUT = "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors"
VITE_BAS = "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors"

# Le texte d'interdiction, **repris tel quel du banc payé du 2 septembre 2026**
# (`essais/essai_video_planche.py`). Il ne se retouche pas ici : le comparer au
# chemin payant n'a de sens que si la demande est la même des deux côtés.
NEGATIF = (
    "blurry, smooth, 3d render, photorealistic, motion blur, camera movement, zoom, "
    "pan, rotation, background changing, character turning around, extra limbs, "
    "morphing, changing design, changing colors, text, watermark"
)

# Les quatre étapes du greffon, et la bascule au milieu.
PAS = 4
BASCULE = 2
DECALAGE = 5.0
# La cadence à laquelle Wan rend. Ce n'est pas un réglage : le greffon a été
# entraîné là-dessus, et changer la cadence changerait ce qu'il a appris.
CADENCE = 16


def sans_greffon_pixel(montage: dict[str, Any]) -> dict[str, Any]:
    """Le même montage **sans le greffon pixel art**, quand il n'est pas là.

    C'est le troisième cas d'absence de la tranche, et le seul qui ne bloque
    rien : le clip sortira, il sortira **lissé**. L'écran le dit avant, et
    l'auteur décide. Retirer le greffon plutôt que refuser est le bon choix ici —
    un clip lissé se juge, un refus ne se juge pas.
    """
    allege = {numero: dict(etape) for numero, etape in montage.items()}
    for numero, suivant in (("4", "3"), ("7", "6")):
        # Les deux étapes qui posent le greffon se remplacent par un passe-plat :
        # ce qui les suivait lit désormais ce qui les précédait.
        allege[numero] = {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {
                "model": [suivant, 0],
                "lora_name": allege[numero]["inputs"]["lora_name"],
                "strength_model": 0.0,
            },
        }
    return allege


def montage_du_clip(
    *,
    image: str,
    texte: str,
    images: int,
    largeur: int = 480,
    hauteur: int = 480,
    graine: int = 1,
    prefixe: str = "atelier/clip",
    force_pixel: float = 1.0,
) -> dict[str, Any]:
    """Le montage complet, au format que `POST /prompt` attend.

    `image` est le nom sous lequel l'image de départ a été déposée chez ComfyUI,
    jamais un chemin de notre côté : les deux processus ne partagent pas
    forcément un disque, et supposer qu'ils le font est le genre d'hypothèse qui
    tient jusqu'au jour où ComfyUI tourne ailleurs.

    Les côtés sont ramenés à des multiples de 16 **ici et pas à l'écran** : c'est
    une contrainte du modèle, elle n'a rien à faire dans une interface, et
    l'oublier fait échouer le montage sans rien dire d'utile.
    """
    largeur, hauteur = (largeur // 16) * 16, (hauteur // 16) * 16
    return {
        # ── Les deux moitiés du moteur, chacune avec ses deux greffons ───────
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": HAUT}},
        "2": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": BAS}},
        "3": {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {"model": ["1", 0], "lora_name": VITE_HAUT, "strength_model": 1.0},
        },
        "4": {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {
                "model": ["3", 0],
                "lora_name": GREFFON_PIXEL,
                "strength_model": force_pixel,
            },
        },
        "5": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["4", 0], "shift": DECALAGE}},
        "6": {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {"model": ["2", 0], "lora_name": VITE_BAS, "strength_model": 1.0},
        },
        "7": {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {
                "model": ["6", 0],
                "lora_name": GREFFON_PIXEL,
                "strength_model": force_pixel,
            },
        },
        "8": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["7", 0], "shift": DECALAGE}},
        # ── Le texte, l'image, et l'espace où la suite se dessinera ──────────
        "9": {"class_type": "CLIPLoader", "inputs": {"clip_name": ENCODEUR, "type": "wan"}},
        "10": {"class_type": "VAELoader", "inputs": {"vae_name": VAE}},
        "11": {"class_type": "LoadImage", "inputs": {"image": image, "upload": "image"}},
        "12": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["9", 0], "text": texte}},
        "13": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["9", 0], "text": NEGATIF}},
        "14": {
            "class_type": "WanImageToVideo",
            "inputs": {
                "positive": ["12", 0],
                "negative": ["13", 0],
                "vae": ["10", 0],
                "width": largeur,
                "height": hauteur,
                "length": images,
                "batch_size": 1,
                "start_image": ["11", 0],
            },
        },
        # ── Les deux passes : bruit fort, puis bruit faible ──────────────────
        "15": {
            "class_type": "KSamplerAdvanced",
            "inputs": {
                "model": ["5", 0],
                "add_noise": "enable",
                "noise_seed": graine,
                "steps": PAS,
                "cfg": 1.0,
                "sampler_name": "ddim",
                "scheduler": "simple",
                "positive": ["14", 0],
                "negative": ["14", 1],
                "latent_image": ["14", 2],
                "start_at_step": 0,
                "end_at_step": BASCULE,
                "return_with_leftover_noise": "enable",
            },
        },
        "16": {
            "class_type": "KSamplerAdvanced",
            "inputs": {
                "model": ["8", 0],
                "add_noise": "disable",
                "noise_seed": graine,
                "steps": PAS,
                "cfg": 1.0,
                "sampler_name": "ddim",
                "scheduler": "simple",
                "positive": ["14", 0],
                "negative": ["14", 1],
                "latent_image": ["15", 0],
                "start_at_step": BASCULE,
                "end_at_step": PAS,
                "return_with_leftover_noise": "disable",
            },
        },
        "17": {"class_type": "VAEDecode", "inputs": {"samples": ["16", 0], "vae": ["10", 0]}},
        # ── Ce qui sort, et une seule chose sort ─────────────────────────────
        #
        # **Une vidéo, pas une suite d'images.** Le banc enregistrait les deux
        # pour pouvoir les regarder ; le produit n'en veut qu'une, et c'est la
        # vidéo — parce que c'est ce qu'un clip payé rend, et que tout ce qui
        # suit (l'extraction des images, l'entrée en bibliothèque, l'écran de
        # montage) est déjà écrit pour ça. **Un clip local suit exactement le
        # même chemin qu'un clip payé une fois revenu**, et c'est ici que ça se
        # décide, en une étape.
        "18": {"class_type": "CreateVideo", "inputs": {"images": ["17", 0], "fps": float(CADENCE)}},
        "19": {
            "class_type": "SaveVideo",
            "inputs": {
                "video": ["18", 0],
                "filename_prefix": prefixe,
                "format": "auto",
                "codec": "auto",
            },
        },
    }
