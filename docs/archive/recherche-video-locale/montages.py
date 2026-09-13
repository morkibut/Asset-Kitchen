"""Les deux montages du banc, écrits au format que ComfyUI attend de l'API.

**Pourquoi on les écrit à la main plutôt que d'exporter depuis l'éditeur.**
ComfyUI a deux formats : celui de l'éditeur, qui décrit des boîtes, des fils et
leurs positions à l'écran, et celui de l'API — un dictionnaire plat où chaque
étape porte son numéro, son type et ses entrées. `POST /prompt` n'accepte que le
second, et les montages livrés avec ComfyUI sont dans le premier. Les convertir
demanderait de dérouler les sous-graphes ; les réécrire à la main tient en
quarante lignes et se relit.

Les signatures ci-dessous ne sont pas devinées : elles sont **relevées le
2 septembre 2026 dans le code installé** —
`comfy_extras/nodes_wan.py` (`WanImageToVideo`, `Wan22ImageToVideoLatent`) et
`comfy_extras/nodes_lt.py` (`LTXVImgToVideo`) — et les chargeurs quantifiés
(`UnetLoaderGGUF`, `CLIPLoaderGGUF`) dans le custom node `ComfyUI-GGUF`, déjà
présent sur cette machine.

⚠️ **Trois contraintes de taille qui font échouer un montage sans rien dire
d'utile**, tirées du même code :

- Wan 2.2 TI2V-5B compresse **par 16 en largeur et en hauteur** : largeur et
  hauteur doivent être des multiples de 32, et le nombre d'images suit la forme
  `4n + 1` (le calcul est `((length - 1) // 4) + 1`).
- LTX compresse **par 32** : mêmes multiples de 32, et le nombre d'images suit
  `8n + 1`.
- Un carré est le bon cadre ici, et pas seulement par goût : le sujet est un
  personnage seul et centré, et le 16:9 paierait de la surface — donc du temps
  de calcul — pour du fond gris.
"""

from __future__ import annotations

NEGATIF = (
    "blurry, smooth, 3d render, photorealistic, motion blur, camera movement, zoom, "
    "pan, rotation, background changing, character turning around, extra limbs, "
    "morphing, changing design, changing colors, text, watermark"
)


def images_wan(secondes: float, cadence: int = 16) -> int:
    """Le nombre d'images que Wan accepte : `4n + 1`, jamais autre chose."""
    brut = max(5, round(secondes * cadence))
    return ((brut - 1) // 4) * 4 + 1


def images_ltx(secondes: float, cadence: int = 24) -> int:
    """Le nombre d'images que LTX accepte : `8n + 1`."""
    brut = max(9, round(secondes * cadence))
    return ((brut - 1) // 8) * 8 + 1


# ── Wan 2.2 TI2V-5B, quantifié ───────────────────────────────────────────────


def wan_ti2v_5b(
    *,
    image: str,
    prompt: str,
    modele: str = "Wan2.2-TI2V-5B-Q5_K_M.gguf",
    encodeur: str = "umt5-xxl-encoder-Q5_K_M.gguf",
    vae: str = "wan2.2_vae.safetensors",
    largeur: int = 480,
    hauteur: int = 480,
    secondes: float = 4.0,
    cadence: int = 16,
    pas: int = 20,
    fidelite: float = 5.0,
    graine: int = 1,
    prefixe: str = "banc/wan5b",
    boucle: bool = False,
) -> dict:
    """Le montage Wan 2.2 TI2V-5B : le plus petit modèle qui sache partir d'une image.

    **Il n'a pas besoin du modèle de vision** que réclame le Wan 2.1 image-vers-vidéo :
    l'image d'entrée passe par le VAE dans `Wan22ImageToVideoLatent`, ce qui
    économise 1,18 Go de mémoire et un chargement de plus.

    `boucle=True` insère `WanContextWindowsManual`, un nœud **livré d'origine avec
    ComfyUI 0.33.4** — relevé le 2 septembre 2026 dans
    `comfy_extras/nodes_context_windows.py`, aucun greffon à installer. Il porte
    les deux réglages qui décident ici :

    - `closed_loop` avec le calendrier `looped_uniform` : la dernière image
      rejoint la première, ce qu'un cycle de marche exige ;
    - `retain_first_frame` : le sprite de départ est **remis dans chaque fenêtre**
      de calcul, ce qui est le seul levier natif contre la dérive du personnage.

    ⚠️ **Il ne se met pas d'office.** Il découpe le calcul en fenêtres qui se
    recouvrent, donc il coûte du temps ; et sur un clip plus court que la fenêtre,
    il ne sert à rien. Le banc le mesure séparément, pour savoir ce qu'il apporte
    et ce qu'il coûte — jamais les deux changements à la fois.
    """
    n = images_wan(secondes, cadence)
    modele_source = ["13", 0] if boucle else ["1", 0]
    montage = {
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": modele}},
        "2": {"class_type": "CLIPLoaderGGUF", "inputs": {"clip_name": encodeur, "type": "wan"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": vae}},
        "4": {"class_type": "LoadImage", "inputs": {"image": image, "upload": "image"}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": NEGATIF}},
        "7": {
            "class_type": "Wan22ImageToVideoLatent",
            "inputs": {
                "vae": ["3", 0],
                "width": largeur,
                "height": hauteur,
                "length": n,
                "batch_size": 1,
                "start_image": ["4", 0],
            },
        },
        "8": {
            "class_type": "KSampler",
            "inputs": {
                "model": modele_source,
                "positive": ["5", 0],
                "negative": ["6", 0],
                "latent_image": ["7", 0],
                "seed": graine,
                "steps": pas,
                "cfg": fidelite,
                "sampler_name": "uni_pc",
                "scheduler": "simple",
                "denoise": 1.0,
            },
        },
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["3", 0]}},
        # **On enregistre les images, pas seulement la vidéo.** Une vidéo demande
        # un décodage de plus pour en ressortir les étapes, et c'est justement
        # les étapes qui nous intéressent. La vidéo suit, pour l'œil.
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": prefixe}},
        "11": {"class_type": "CreateVideo", "inputs": {"images": ["9", 0], "fps": float(cadence)}},
        "12": {
            "class_type": "SaveVideo",
            "inputs": {"video": ["11", 0], "filename_prefix": prefixe, "format": "auto", "codec": "auto"},
        },
    }
    if boucle:
        # La fenêtre doit rester plus courte que le clip, sinon le nœud n'a rien à
        # recouvrir. On la pose aux deux tiers, recouvrement au tiers — et les
        # deux suivent la forme `4n + 1` que le nœud impose.
        fenetre = max(5, ((int(n * 0.66) - 1) // 4) * 4 + 1)
        montage["13"] = {
            "class_type": "WanContextWindowsManual",
            "inputs": {
                "model": ["1", 0],
                "context_length": fenetre,
                "context_overlap": max(4, (fenetre // 3) // 4 * 4),
                "context_schedule": "looped_uniform",
                "context_stride": 1,
                "closed_loop": True,
                "fuse_method": "pyramid",
                "freenoise": True,
                "retain_first_frame": True,
                "split_conds_to_windows": False,
            },
        }
    return montage


# ── LTX-Video 2B, le plus léger ──────────────────────────────────────────────


def ltx_2b(
    *,
    image: str,
    prompt: str,
    modele: str = "ltx-video-2b-v0.9.5.safetensors",
    encodeur: str = "t5xxl_fp8_e4m3fn.safetensors",
    largeur: int = 480,
    hauteur: int = 480,
    secondes: float = 4.0,
    cadence: int = 24,
    pas: int = 25,
    force_image: float = 1.0,
    graine: int = 1,
    prefixe: str = "banc/ltx2b",
) -> dict:
    """Le montage LTX-Video 2B : le seul dont l'encodeur de texte soit **déjà installé**.

    `force_image` est le réglage qui nous intéresse le plus : c'est lui qui dit à
    quel point le clip doit rester fidèle à l'image de départ. À 1,0 la première
    image est tenue ; en dessous, le modèle s'autorise à la réinventer.
    """
    n = images_ltx(secondes, cadence)
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": modele}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": encodeur, "type": "ltxv"}},
        "3": {"class_type": "LoadImage", "inputs": {"image": image, "upload": "image"}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": NEGATIF}},
        "6": {
            "class_type": "LTXVImgToVideo",
            "inputs": {
                "positive": ["4", 0],
                "negative": ["5", 0],
                "vae": ["1", 2],
                "image": ["3", 0],
                "width": largeur,
                "height": hauteur,
                "length": n,
                "batch_size": 1,
                "strength": force_image,
            },
        },
        "7": {
            "class_type": "LTXVConditioning",
            "inputs": {"positive": ["6", 0], "negative": ["6", 1], "frame_rate": float(cadence)},
        },
        "8": {"class_type": "ModelSamplingLTXV", "inputs": {"model": ["1", 0], "max_shift": 2.05, "base_shift": 0.95, "latent": ["6", 2]}},
        "9": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
        "10": {
            "class_type": "LTXVScheduler",
            "inputs": {"steps": pas, "max_shift": 2.05, "base_shift": 0.95, "stretch": True, "terminal": 0.1, "latent": ["6", 2]},
        },
        "11": {
            "class_type": "SamplerCustom",
            "inputs": {
                "model": ["8", 0],
                "add_noise": True,
                "noise_seed": graine,
                "cfg": 3.0,
                "positive": ["7", 0],
                "negative": ["7", 1],
                "sampler": ["9", 0],
                "sigmas": ["10", 0],
                "latent_image": ["6", 2],
            },
        },
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["1", 2]}},
        "13": {"class_type": "SaveImage", "inputs": {"images": ["12", 0], "filename_prefix": prefixe}},
        "14": {"class_type": "CreateVideo", "inputs": {"images": ["12", 0], "fps": cadence}},
        "15": {
            "class_type": "SaveVideo",
            "inputs": {"video": ["14", 0], "filename_prefix": prefixe, "format": "auto", "codec": "auto"},
        },
    }


# ── Wan 2.2 image→vidéo 14 milliards + le greffon pixel art ──────────────────


def wan_i2v_14b_pixel(
    *,
    image: str,
    prompt: str,
    haut: str = "Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf",
    bas: str = "Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf",
    encodeur: str = "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    vae: str = "wan_2.1_vae.safetensors",
    greffon_pixel: str = "wan2.2_animate_adapter_model.safetensors",
    vite_haut: str = "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors",
    vite_bas: str = "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors",
    force_pixel: float = 1.0,
    largeur: int = 832,
    hauteur: int = 480,
    images: int = 45,
    cadence: int = 16,
    pas: int = 4,
    bascule: int = 2,
    decalage: float = 5.0,
    graine: int = 1,
    prefixe: str = "banc/pixel14b",
) -> dict:
    """Le seul montage qui vise vraiment le pixel art — et il demande le gros modèle.

    **Pourquoi celui-là et pas le petit.** Le greffon `wan2.2_animate_adapter` est le
    seul entraîné exprès pour animer des sprites — 226 vidéos de marches, d'attaques
    et de repos. Il est bâti sur `Wan2.2-I2V-A14B`, le quatorze milliards. Le petit
    modèle de cinq milliards, qui tiendrait bien plus confortablement dans 8 Go, n'a
    **aucun** correctif de ce genre. On paie donc la lenteur pour avoir le dessin.

    **Comment le gros modèle tient dans une petite carte.** Il vient en deux moitiés
    — « bruit fort » et « bruit faible » — qui ne travaillent **jamais en même
    temps** : la première fait les deux premières étapes, la seconde les deux
    dernières. ComfyUI charge l'une, calcule, la décharge, charge l'autre. Ce qui
    coûte double, c'est le disque et le temps de chargement, pas la mémoire vidéo.

    **Les réglages ne sont pas inventés** : ils sont repris du montage officiel livré
    avec le greffon (`wan2-2-video.json`, relevé chez l'hébergeur le 3 septembre
    2026) — quatre étapes en tout, fidélité à 1,0, méthode `ddim`, rythme `simple`,
    décalage 5,0, et la bascule d'une moitié à l'autre au bout de deux étapes.

    ⚠️ **Un seul écart avec la recette d'origine, et il est forcé.** Elle emploie un
    nœud `PainterI2V` qui n'est pas installé ici — vérifié le 3 septembre sur
    l'instance en cours. Il est remplacé par `WanImageToVideo`, le nœud livré avec
    ComfyUI, qui fait le même travail : il encode l'image de départ et fabrique
    l'espace vide où la suite se dessinera. **Si le résultat déçoit, c'est le premier
    endroit où regarder.**

    ⚠️ **Le greffon a été entraîné sur des vidéos de 600 × 370, par paquets de 8, 16,
    24 ou 32 images.** Demander 45 images en 832 × 480 sort déjà de son terrain
    d'entraînement — c'est pourtant ce que fait sa propre recette. Le banc commence
    donc plus petit, au plus près de ce qu'il connaît.
    """
    # Wan veut un nombre d'images de la forme 4n+1, et des côtés multiples de 16.
    n = ((max(5, images) - 1) // 4) * 4 + 1
    largeur, hauteur = (largeur // 16) * 16, (hauteur // 16) * 16
    return {
        # les deux moitiés du moteur, chacune avec ses deux greffons
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": haut}},
        "2": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": bas}},
        "3": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": vite_haut, "strength_model": 1.0}},
        "4": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["3", 0], "lora_name": greffon_pixel, "strength_model": force_pixel}},
        "5": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["4", 0], "shift": decalage}},
        "6": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["2", 0], "lora_name": vite_bas, "strength_model": 1.0}},
        "7": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["6", 0], "lora_name": greffon_pixel, "strength_model": force_pixel}},
        "8": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["7", 0], "shift": decalage}},
        # ⚠️ **L'encodeur n'est PAS quantifié, et c'est un contournement.** Le
        # chargeur quantifié doit reconstruire le dictionnaire de mots à partir des
        # métadonnées du fichier, et il lui faut pour ça une version de `protobuf`
        # plus récente que celle installée ici (3.19.6 contre 3.20 minimum) —
        # panne rencontrée le 3 septembre 2026 au premier tirage. **On ne met pas
        # `protobuf` à jour** : cette version-là est réclamée par les paquets du
        # générateur de bruitages, et casser le son pour gagner 2,4 Go de disque
        # serait un mauvais échange. La version `.safetensors` embarque son propre
        # dictionnaire et se charge par le nœud d'origine, sans rien reconstruire.
        "9": {"class_type": "CLIPLoader", "inputs": {"clip_name": encodeur, "type": "wan"}},
        "10": {"class_type": "VAELoader", "inputs": {"vae_name": vae}},
        "11": {"class_type": "LoadImage", "inputs": {"image": image, "upload": "image"}},
        "12": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["9", 0], "text": prompt}},
        "13": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["9", 0], "text": NEGATIF}},
        "14": {
            "class_type": "WanImageToVideo",
            "inputs": {
                "positive": ["12", 0],
                "negative": ["13", 0],
                "vae": ["10", 0],
                "width": largeur,
                "height": hauteur,
                "length": n,
                "batch_size": 1,
                "start_image": ["11", 0],
            },
        },
        # deux passes : la moitié « bruit fort » d'abord, la « bruit faible » ensuite
        "15": {
            "class_type": "KSamplerAdvanced",
            "inputs": {
                "model": ["5", 0],
                "add_noise": "enable",
                "noise_seed": graine,
                "steps": pas,
                "cfg": 1.0,
                "sampler_name": "ddim",
                "scheduler": "simple",
                "positive": ["14", 0],
                "negative": ["14", 1],
                "latent_image": ["14", 2],
                "start_at_step": 0,
                "end_at_step": bascule,
                "return_with_leftover_noise": "enable",
            },
        },
        "16": {
            "class_type": "KSamplerAdvanced",
            "inputs": {
                "model": ["8", 0],
                "add_noise": "disable",
                "noise_seed": graine,
                "steps": pas,
                "cfg": 1.0,
                "sampler_name": "ddim",
                "scheduler": "simple",
                "positive": ["14", 0],
                "negative": ["14", 1],
                "latent_image": ["15", 0],
                "start_at_step": bascule,
                "end_at_step": pas,
                "return_with_leftover_noise": "disable",
            },
        },
        "17": {"class_type": "VAEDecode", "inputs": {"samples": ["16", 0], "vae": ["10", 0]}},
        "18": {"class_type": "SaveImage", "inputs": {"images": ["17", 0], "filename_prefix": prefixe}},
        "19": {"class_type": "CreateVideo", "inputs": {"images": ["17", 0], "fps": float(cadence)}},
        "20": {
            "class_type": "SaveVideo",
            "inputs": {"video": ["19", 0], "filename_prefix": prefixe, "format": "auto", "codec": "auto"},
        },
    }


# ── Le texte qui part, repris tel quel des essais payés ──────────────────────

# **Le même texte que le banc payé du 2 septembre 2026**, pour que la comparaison
# porte sur le modèle et non sur la demande. Il vient de
# `essais/essai_video_planche.py`, et il ne se retouche pas ici.
PROMPT_MARCHE = (
    "Pixel art game sprite. The character walks in place, side view, static camera, no zoom, "
    "no camera movement, plain flat background, the character stays the same size and the same "
    "design, seamless walk cycle loop."
)
