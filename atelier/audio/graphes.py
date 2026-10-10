"""Les profils sonores que l'atelier écrit lui-même (SN1).

Chaque constructeur rend un profil ordinaire — un graphe au format API de
ComfyUI et ses liaisons — que `normaliser` accepte comme un workflow collé par
l'auteur : même version, même diagnostic, même file locale. Rien n'est exécuté
ici, rien n'est téléchargé.

Les graphes sont relevés dans les modèles de workflow officiels livrés avec
ComfyUI 0.36 (`comfyui_workflow_templates_json`, version 0.11.62) et dans son
`/object_info`, puis convertis du format « écran » (sous-graphes, nœuds
primitifs) au format API. Trois écarts voulus avec ces modèles :

- Stable Audio 3 Medium : la réécriture du texte par un modèle de langage
  (`TextGenerate` sur `qwen3.5_2b_bf16`, derrière un `ComfySwitchNode`) est
  retirée. Le texte montré est le texte qui part.
- ACE-Step 1.5 : la paire 0.6b + 1.7b du modèle officiel, chargée par
  `DualCLIPLoader` (type `ace`). Le 1.7b est le modèle de langage qui écrit
  les « codes audio » : le plan du morceau (mélodie, sections, carrure).
  Jusqu'au 10 octobre 2026 le profil ne chargeait que le 0.6b, codes coupés,
  et rendait des nappes sans mélodie (relevé « Univers musical » de Cœur de
  Pierre). Les codes sont désormais une option, `compositeur`, vraie par
  défaut ; coupée, on retrouve le rendu rapide d'avant (5 s au lieu de 30 s
  pour une minute, banc du 19 septembre).
- La sortie est `SaveAudio` (FLAC, sans perte) partout, au lieu de
  `SaveAudioAdvanced` ou `SaveAudioMP3` : l'atelier règle et encode lui-même.

Le nombre de tirages n'est pas dans le graphe : une série est N travaux,
chacun sa graine (SN3).
"""
from __future__ import annotations

from atelier.domaine.son import FAMILLES_SON

# Les fichiers de poids que chaque moteur demande, leur dossier sous
# `models/` et leur source. Relevés dans les notes des modèles officiels
# (`properties.models` des nœuds), sauf Small-SFX : aucun modèle officiel ne
# le nomme, sa page est celle de docs/PLAN-son.md et des relevés.
FICHIERS = {
    "stable_audio_3_small_sfx.safetensors": {"dossier": "checkpoints", "taille": "2,3 Go",
        "nom": "le modèle Stable Audio 3 Small-SFX (bruitages et ambiances)",
        "source": "https://huggingface.co/Comfy-Org/stable-audio-3",
        "licence": "https://huggingface.co/stabilityai/stable-audio-3-small-sfx"},
    "stable_audio_3_medium.safetensors": {"dossier": "checkpoints", "taille": "9,2 Go",
        "nom": "le modèle Stable Audio 3 Medium (secours)",
        "source": "https://huggingface.co/Comfy-Org/stable-audio-3/resolve/main/checkpoints/stable_audio_3_medium.safetensors"},
    "t5gemma_b_b_ul2.safetensors": {"dossier": "text_encoders", "taille": "1,2 Go",
        "nom": "l'encodeur de texte de Stable Audio 3",
        "source": "https://huggingface.co/Comfy-Org/stable-audio-3/resolve/main/text_encoders/t5gemma_b_b_ul2.safetensors"},
    "acestep_v1.5_turbo.safetensors": {"dossier": "diffusion_models", "taille": "4,8 Go",
        "nom": "le modèle ACE-Step 1.5 turbo (musique)",
        "source": "https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/split_files/diffusion_models/acestep_v1.5_turbo.safetensors"},
    "qwen_0.6b_ace15.safetensors": {"dossier": "text_encoders", "taille": "1,2 Go",
        "nom": "l'encodeur de texte d'ACE-Step 1.5",
        "source": "https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/split_files/text_encoders/qwen_0.6b_ace15.safetensors"},
    "qwen_1.7b_ace15.safetensors": {"dossier": "text_encoders", "taille": "3,7 Go",
        "nom": "le compositeur d'ACE-Step 1.5 (modèle de langage 1.7b)",
        "source": "https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/split_files/text_encoders/qwen_1.7b_ace15.safetensors"},
    "ace_1.5_vae.safetensors": {"dossier": "vae", "taille": "0,3 Go",
        "nom": "le décodeur (VAE) d'ACE-Step 1.5",
        "source": "https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/split_files/vae/ace_1.5_vae.safetensors"},
    "yue2_3b_int8_convrot.safetensors": {"dossier": "checkpoints", "taille": "4,0 Go",
        "nom": "le modèle YuE2 (chansons)",
        "source": "https://huggingface.co/Comfy-Org/YuE2/resolve/main/checkpoints/yue2_3b_int8_convrot.safetensors"},
    "stable-audio-open-1.0.safetensors": {"dossier": "checkpoints", "taille": "non mesurée",
        "nom": "le modèle Stable Audio Open 1.0 (secours des bruitages)",
        "source": "https://huggingface.co/Comfy-Org/stable-audio-open-1.0_repackaged/resolve/main/stable-audio-open-1.0.safetensors"},
    "t5-base.safetensors": {"dossier": "text_encoders", "taille": "non mesurée",
        "nom": "l'encodeur de texte de Stable Audio Open",
        "source": "https://huggingface.co/ComfyUI-Wiki/t5-base/resolve/main/t5-base.safetensors"},
}

# Le moteur par défaut de chaque famille (SN1), les sept clés de
# `atelier.domaine.son.FAMILLES_SON` ; le premier installé de la liste
# l'emporte (`installation_son.moteurs_par_famille`, `travaux_audio.
# _moteur_de_famille`). L'interface a pour seul moteur sfxr (pas de calcul
# ComfyUI) ; la voix n'a encore aucun moteur installé (SN11), dit comme tel
# par une liste vide. « secours » n'est pas une famille du jeu : c'est
# `SECOURS`, la liste que SN2 consulte quand le moteur d'une famille manque.
FAMILLES = {
    "bruitage": ("sa3-small-sfx", "sa-open-1"),
    "interface": ("sfxr",),
    "ambiance": ("sa3-small-sfx", "sa3-medium"),
    "musique": ("ace-step-15-turbo", "sa3-medium"),
    "jingle": ("ace-step-15-turbo", "sa3-medium"),
    "chanson": ("yue2-int8",),
    "voix": (),
}
assert set(FAMILLES) == set(FAMILLES_SON)

SECOURS = ("sa3-medium", "sa-open-1")

# Ce que l'écran propose pour une famille (étape « Ses sons ») : ses moteurs,
# puis les secours qui savent faire ce genre de son. L'interface n'a que sfxr
# (Stable Audio ne descend pas sous 1 s), une chanson demande des paroles,
# la voix n'a encore rien. Une proposition, pas une barrière : l'univers
# accepte n'importe quel moteur installé.
POSSIBLES = {
    famille: (() if famille in ("interface", "voix")
              else ("yue2-int8", "ace-step-15-turbo") if famille == "chanson"
              else tuple(dict.fromkeys(ordre + SECOURS)))
    for famille, ordre in FAMILLES.items()
}

# Les langues de paroles que TextEncodeAceStepAudio1.5 déclare (object_info).
LANGUES_ACE = ("ar", "az", "bg", "bn", "ca", "cs", "da", "de", "el", "en", "es", "fa", "fi", "fr", "he", "hi", "hr",
    "ht", "hu", "id", "is", "it", "ja", "ko", "la", "lt", "ms", "ne", "nl", "no", "pa", "pl", "pt", "ro", "ru", "sa",
    "sk", "sr", "sv", "sw", "ta", "te", "th", "tl", "tr", "uk", "ur", "vi", "yue", "zh", "unknown")


def _lien(noeud, champ):
    return {"noeud": noeud, "champ": champ}


def _sortie(prefixe, audio):
    return {"class_type": "SaveAudio", "inputs": {"audio": audio, "filename_prefix": "asset-kitchen/" + prefixe}}


def _stable_audio(identifiant, nom, description, *, checkpoint, encodeur, type_encodeur, pas, guidage, echantillonneur,
                  planificateur, durees, duree_libre, negatif=False):
    """Le graphe natif de Stable Audio : checkpoint, encodeur T5, latent audio,
    KSampler, décodage. Celui de Stable Audio 3 (relevé dans le sous-graphe du
    modèle Medium, réécriture retirée) et celui de Stable Audio Open 1.0
    (audio_stable_audio_example) ont la même forme ; seuls changent les
    fichiers et les réglages du KSampler."""
    graphe = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": checkpoint}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": encodeur, "type": type_encodeur, "device": "default"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["2", 0]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["2", 0]}},
        "5": {"class_type": "EmptyLatentAudio", "inputs": {"seconds": durees[0], "batch_size": 1}},
        "6": {"class_type": "KSampler", "inputs": {"seed": 0, "steps": pas, "cfg": guidage, "sampler_name": echantillonneur,
            "scheduler": planificateur, "denoise": 1, "model": ["1", 0], "positive": ["3", 0], "negative": ["4", 0],
            "latent_image": ["5", 0]}},
        "7": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
        "8": _sortie(identifiant, ["7", 0]),
    }
    liaisons = {"prompt": [_lien("3", "text")], "secondes": [_lien("5", "seconds")], "graine": [_lien("6", "seed")]}
    if negatif:
        # À guidage 1, le texte négatif n'a aucun effet : il n'est relié que là
        # où le guidage le fait compter.
        liaisons["prompt_negatif"] = [_lien("4", "text")]
    return {"identifiant": identifiant, "nom": nom, "nature": "audio", "graphe": graphe, "liaisons": liaisons,
        "parametres": {}, "formats": [], "durees": list(durees), "duree_libre": duree_libre,
        "sortie": {"noeud": "8", "champ": "audio"}, "description": description}


def stable_audio_3_small_sfx(*, checkpoint="stable_audio_3_small_sfx.safetensors", encodeur="t5gemma_b_b_ul2.safetensors"):
    """Bruitages et ambiances. Aucun modèle officiel dédié : le graphe de
    Medium avec le checkpoint Small-SFX, 8 pas et guidage 1 (ceux du KSampler
    du modèle Medium, et ceux de la fiche du modèle)."""
    return _stable_audio("sa3-small-sfx", "Stable Audio 3 Small-SFX",
        "Bruitages et ambiances, de 1 à 120 secondes.",
        checkpoint=checkpoint, encodeur=encodeur, type_encodeur="stable_audio", pas=8, guidage=1,
        echantillonneur="lcm", planificateur="simple", durees=(1, 2, 3, 5, 10, 30, 60), duree_libre={"min": 1, "max": 120})


def stable_audio_3_medium(*, checkpoint="stable_audio_3_medium.safetensors", encodeur="t5gemma_b_b_ul2.safetensors"):
    """Le secours des ambiances et de la musique, sans réécriture du texte."""
    return _stable_audio("sa3-medium", "Stable Audio 3 Medium",
        "Ambiances longues et musique de secours, de 1 à 380 secondes. Le texte part tel qu'il est écrit, sans réécriture.",
        checkpoint=checkpoint, encodeur=encodeur, type_encodeur="stable_audio", pas=8, guidage=1,
        echantillonneur="lcm", planificateur="simple", durees=(10, 30, 60, 120), duree_libre={"min": 1, "max": 380})


def stable_audio_open_1(*, checkpoint="stable-audio-open-1.0.safetensors", encodeur="t5-base.safetensors"):
    """Le secours des bruitages : Stable Audio Open 1.0, natif (47 s au plus).

    Guidage 7 (SN2), et non 4,98 comme le modèle officiel : c'est la valeur
    de la fiche du modèle et du relevé des bruitages (§6.2), celle où le texte
    négatif `low quality, average quality` que compose `atelier.audio.texte`
    fait effet."""
    return _stable_audio("sa-open-1", "Stable Audio Open 1.0",
        "Bruitages de secours, de 1 à 47 secondes, plus lents à calculer.",
        checkpoint=checkpoint, encodeur=encodeur, type_encodeur="stable_audio", pas=50, guidage=7,
        echantillonneur="dpmpp_3m_sde_gpu", planificateur="exponential", durees=(1, 2, 5, 10, 30),
        duree_libre={"min": 1, "max": 47}, negatif=True)


# Les réglages d'ACE-Step que l'écran montre (relevé « Univers musical », 10
# octobre 2026) : ils étaient figés dans le graphe. Bornes d'/object_info,
# resserrées à ce qui a un sens pour le turbo (fait pour 8 pas).
PARAMETRES_ACE = {
    "compositeur": {"genre": "booleen", "defaut": True, "nom": "Compositeur (1.7b)",
        "aide": "Le modèle de langage écrit d'abord le plan du morceau : mélodie, sections, carrure. "
                "Coupé, le calcul est six fois plus rapide mais le rendu tourne à la nappe."},
    "temperature": {"genre": "intervalle", "minimum": 0.1, "maximum": 1.5, "defaut": 0.85, "nom": "Température",
        "aide": "Plus haut, le compositeur ose davantage ; plus bas, il se répète."},
    "guidage": {"genre": "intervalle", "minimum": 1.0, "maximum": 7.0, "defaut": 2.0, "nom": "Guidage du compositeur",
        "aide": "À quel point le plan du morceau suit le texte (cfg du modèle de langage)."},
    "pas": {"genre": "intervalle", "minimum": 4, "maximum": 32, "defaut": 8, "nom": "Pas de calcul",
        "aide": "Le turbo est fait pour 8 ; davantage ne garantit rien."},
}


def ace_step_15_turbo(*, modele="acestep_v1.5_turbo.safetensors", encodeur="qwen_0.6b_ace15.safetensors",
                      compositeur="qwen_1.7b_ace15.safetensors", vae="ace_1.5_vae.safetensors"):
    """La musique : tags, paroles (la structure), tempo, tonalité, mesure et
    durée en réglages directs, et le compositeur 1.7b qui écrit les codes
    audio (audio_ace_step_1_5_split, la paire d'encodeurs du modèle officiel)."""
    graphe = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": modele, "weight_dtype": "default"}},
        "2": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["1", 0], "shift": 3}},
        "3": {"class_type": "DualCLIPLoader", "inputs": {"clip_name1": encodeur, "clip_name2": compositeur, "type": "ace", "device": "default"}},
        "4": {"class_type": "VAELoader", "inputs": {"vae_name": vae}},
        "5": {"class_type": "TextEncodeAceStepAudio1.5", "inputs": {"clip": ["3", 0], "tags": "", "lyrics": "[Instrumental]",
            "seed": 0, "bpm": 90, "duration": 60, "timesignature": "4", "language": "en", "keyscale": "D minor",
            # Défauts du nœud ; codes, température, guidage et pas sont des options.
            "generate_audio_codes": True, "cfg_scale": 2.0, "temperature": 0.85, "top_p": 0.9, "top_k": 0, "min_p": 0.0}},
        "6": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["5", 0]}},
        "7": {"class_type": "EmptyAceStep1.5LatentAudio", "inputs": {"seconds": 60, "batch_size": 1}},
        "8": {"class_type": "KSampler", "inputs": {"seed": 0, "steps": 8, "cfg": 1, "sampler_name": "euler", "scheduler": "simple",
            "denoise": 1, "model": ["2", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0]}},
        "9": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["8", 0], "vae": ["4", 0]}},
        "10": _sortie("ace-step-15-turbo", ["9", 0]),
    }
    liaisons = {"prompt": [_lien("5", "tags")], "paroles": [_lien("5", "lyrics")], "tempo": [_lien("5", "bpm")],
        "tonalite": [_lien("5", "keyscale")], "mesure": [_lien("5", "timesignature")],
        "secondes": [_lien("7", "seconds"), _lien("5", "duration")], "graine": [_lien("8", "seed"), _lien("5", "seed")],
        "option:langue": [_lien("5", "language")],
        "option:compositeur": [_lien("5", "generate_audio_codes")], "option:temperature": [_lien("5", "temperature")],
        "option:guidage": [_lien("5", "cfg_scale")], "option:pas": [_lien("8", "steps")]}
    parametres = {"langue": {"genre": "choix", "valeurs": list(LANGUES_ACE), "defaut": "en"},
        **{cle: dict(p) for cle, p in PARAMETRES_ACE.items()}}
    return {"identifiant": "ace-step-15-turbo", "nom": "ACE-Step 1.5 turbo", "nature": "audio", "graphe": graphe,
        "liaisons": liaisons, "parametres": parametres,
        # 2 s, non 10 : un jingle par défaut (2 mesures + 1 de marge, 90 BPM)
        # dure 8 s — sous l'ancien minimum, il aurait été proposé puis refusé
        # à l'envoi (correction du 18 septembre 2026 : « ce qui sera refusé ne
        # doit pas être proposé »).
        "formats": [], "durees": [30, 60, 90, 120], "duree_libre": {"min": 2, "max": 600},
        "sortie": {"noeud": "10", "champ": "audio"},
        "description": "Musique et jingles : structure, tempo, tonalité, mesure et durée exacte, de 2 à 600 secondes ; "
                       "le compositeur 1.7b écrit le plan du morceau avant le rendu."}


def ace_step_15_reprise(*, modele="acestep_v1.5_turbo.safetensors", encodeur="qwen_0.6b_ace15.safetensors",
                        compositeur="qwen_1.7b_ace15.safetensors", vae="ace_1.5_vae.safetensors"):
    """**La reprise d'un son** : un morceau déjà fait, rejoué avec un autre
    texte en gardant sa mélodie et sa carrure (« qui revit », « désert », tirés
    d'un air de fête). Aucun nœud officiel de reprise n'existe : c'est la
    méthode générique « image vers image » de ComfyUI appliquée au son.

    - `LoadAudio` charge le son de départ, déposé chez ComfyUI à l'envoi
      (liaison `source`) ; `VAEEncodeAudio` le passe en latent, et ce latent
      remplace le latent vide du turbo à l'entrée `latent_image` du KSampler.
    - `ReferenceTimbreAudio` donne le même latent comme référence de timbre au
      conditionnement (comfy_extras/nodes_ace.py).
    - **La force (0,1 à 0,95) n'est pas une option du profil** : elle part dans
      le `denoise` du KSampler sous la forme `1 − force` (liaison `force`,
      calculée par `composer`). C'est la seule valeur du profil qui ne part pas
      telle qu'elle est dite, et la raison est d'usage : « à quel point suivre
      le son de départ » se lit dans le bon sens, un débruitage non.
    - Les codes audio sont coupés (`generate_audio_codes` faux) : le nœud le
      demande dès qu'on lui donne une référence sonore, et la mélodie vient du
      son de départ. Température et guidage, qui ne servent qu'au compositeur,
      ne sont donc pas proposés. Le 1.7b reste chargé : `DualCLIPLoader` de
      type `ace` attend la paire, et les mêmes fichiers que le turbo suffisent.
    - La durée (`duration` du texte) est celle du son de départ ; il n'y a pas
      de latent vide à régler.
    """
    graphe = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": modele, "weight_dtype": "default"}},
        "2": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["1", 0], "shift": 3}},
        "3": {"class_type": "DualCLIPLoader", "inputs": {"clip_name1": encodeur, "clip_name2": compositeur, "type": "ace", "device": "default"}},
        "4": {"class_type": "VAELoader", "inputs": {"vae_name": vae}},
        "5": {"class_type": "TextEncodeAceStepAudio1.5", "inputs": {"clip": ["3", 0], "tags": "", "lyrics": "[Instrumental]",
            "seed": 0, "bpm": 90, "duration": 60, "timesignature": "4", "language": "en", "keyscale": "D minor",
            "generate_audio_codes": False, "cfg_scale": 2.0, "temperature": 0.85, "top_p": 0.9, "top_k": 0, "min_p": 0.0}},
        "6": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["5", 0]}},
        "7": {"class_type": "LoadAudio", "inputs": {"audio": ""}},
        "8": {"class_type": "VAEEncodeAudio", "inputs": {"audio": ["7", 0], "vae": ["4", 0]}},
        "9": {"class_type": "ReferenceTimbreAudio", "inputs": {"conditioning": ["5", 0], "latent": ["8", 0]}},
        "10": {"class_type": "KSampler", "inputs": {"seed": 0, "steps": 8, "cfg": 1, "sampler_name": "euler", "scheduler": "simple",
            "denoise": 0.4, "model": ["2", 0], "positive": ["9", 0], "negative": ["6", 0], "latent_image": ["8", 0]}},
        "11": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["10", 0], "vae": ["4", 0]}},
        "12": _sortie("ace-step-15-reprise", ["11", 0]),
    }
    liaisons = {"prompt": [_lien("5", "tags")], "paroles": [_lien("5", "lyrics")], "tempo": [_lien("5", "bpm")],
        "tonalite": [_lien("5", "keyscale")], "mesure": [_lien("5", "timesignature")],
        "secondes": [_lien("5", "duration")], "graine": [_lien("10", "seed"), _lien("5", "seed")],
        "source": [_lien("7", "audio")], "force": [_lien("10", "denoise")],
        "option:langue": [_lien("5", "language")], "option:pas": [_lien("10", "steps")]}
    parametres = {"langue": {"genre": "choix", "valeurs": list(LANGUES_ACE), "defaut": "en"},
        "pas": dict(PARAMETRES_ACE["pas"])}
    return {"identifiant": "ace-step-15-reprise", "nom": "ACE-Step 1.5 — reprise d'un son", "nature": "audio",
        "graphe": graphe, "liaisons": liaisons, "parametres": parametres,
        "formats": [], "durees": [30, 60, 90, 120], "duree_libre": {"min": 2, "max": 600},
        "sortie": {"noeud": "12", "champ": "audio"},
        "description": "Rejoue un son déjà fait avec un autre texte : la mélodie et la structure restent, "
                       "l'orchestration et l'humeur changent. La durée est celle du son de départ."}


# Le profil de reprise de chaque moteur qui en a un : une demande qui part
# d'un son existant (`source`) passe du premier au second. Un moteur absent
# d'ici ne sait pas reprendre un son, et la demande est refusée en clair.
REPRISES = {"ace-step-15-turbo": "ace-step-15-reprise"}


def yue2_int8(*, checkpoint="yue2_3b_int8_convrot.safetensors"):
    """Les chansons : style et paroles, partition ABC écrite d'abord par le
    modèle puis rendue (audio_yue2_text2music, planification ABC activée).
    La durée est un maximum : le morceau peut finir avant."""
    graphe = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": checkpoint}},
        "2": {"class_type": "YuE2GenerateABC", "inputs": {"clip": ["1", 1], "style": "", "lyrics": "", "seed": 0, "mode": "full",
            "max_abc_tokens": 8192, "temperature": 0.7, "top_p": 0.9, "top_k": 30, "repetition_penalty": 1.005, "penalty_window": 100}},
        # La partition passe par un aperçu, comme dans le modèle officiel : elle
        # reste lisible dans l'historique de ComfyUI, pour être montrée (SN9).
        "3": {"class_type": "PreviewAny", "inputs": {"source": ["2", 0]}},
        "4": {"class_type": "YuE2GenerateMusic", "inputs": {"clip": ["1", 1], "style": "", "lyrics": "", "abc": ["3", 0], "seed": 0,
            "mode": "full", "max_duration": 120, "temperature": 1.0, "top_p": 0.95, "top_k": 100, "repetition_penalty": 1.2}},
        "5": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["4", 0]}},
        "6": {"class_type": "EmptyYuE2LatentAudio", "inputs": {"seconds": ["4", 1], "batch_size": 1}},
        "7": {"class_type": "KSampler", "inputs": {"seed": 0, "steps": 32, "cfg": 1, "sampler_name": "dpm_2", "scheduler": "sgm_uniform",
            "denoise": 1, "model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0], "latent_image": ["6", 0]}},
        "8": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["7", 0], "vae": ["1", 2]}},
        "9": _sortie("yue2-int8", ["8", 0]),
    }
    liaisons = {"prompt": [_lien("2", "style"), _lien("4", "style")], "paroles": [_lien("2", "lyrics"), _lien("4", "lyrics")],
        "secondes": [_lien("4", "max_duration")], "graine": [_lien("2", "seed"), _lien("4", "seed"), _lien("7", "seed")]}
    return {"identifiant": "yue2-int8", "nom": "YuE2 (int8)", "nature": "audio", "graphe": graphe, "liaisons": liaisons,
        "parametres": {}, "formats": [], "durees": [60, 120, 180, 240], "duree_libre": {"min": 10, "max": 360},
        "sortie": {"noeud": "9", "champ": "audio"},
        "description": "Chansons chantées : un style et des paroles, une partition ABC écrite d'abord. La durée est un maximum."}


def yue2_partition(*, checkpoint="yue2_3b_int8_convrot.safetensors"):
    """Le premier étage seul de YuE2 (SN9) : « Écrire la partition » —
    YuE2GenerateABC puis PreviewAny, sans passer par YuE2GenerateMusic ni le
    KSampler. La sortie est un texte, jamais un fichier son.

    Un profil **interne**, jamais importé ni normalisé : `normaliser`
    (`atelier.domaine.workflow`) ne connaît que les natures image, vidéo et
    son, et ce graphe n'en rend aucune. `ServicePartitionSon` l'envoie
    directement au moteur ComfyUI (`diagnostiquer_profil`, `soumettre_graphe`,
    `texte_de`), qui ne lisent qu'un graphe, ses liaisons et sa sortie —
    jamais le registre des profils installés. `nature` et `durees` portent
    donc une valeur d'emprunt (« audio », une seconde) pour que `composer`,
    qui ne branche que sur cette nature-là, l'accepte : aucune durée sonore
    n'est réellement en jeu ici."""
    graphe = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": checkpoint}},
        "2": {"class_type": "YuE2GenerateABC", "inputs": {"clip": ["1", 1], "style": "", "lyrics": "", "seed": 0, "mode": "full",
            "max_abc_tokens": 8192, "temperature": 0.7, "top_p": 0.9, "top_k": 30, "repetition_penalty": 1.005, "penalty_window": 100}},
        "3": {"class_type": "PreviewAny", "inputs": {"source": ["2", 0]}},
    }
    liaisons = {"prompt": [_lien("2", "style")], "paroles": [_lien("2", "lyrics")], "graine": [_lien("2", "seed")]}
    return {"identifiant": "yue2-partition", "nom": "YuE2 — écrire la partition", "nature": "audio", "graphe": graphe,
        "liaisons": liaisons, "parametres": {}, "formats": [], "durees": [1], "duree_libre": None,
        "sortie": {"noeud": "3", "champ": "text"}, "version": "interne",  # jamais versionné : voir la docstring
        "description": "Le premier étage de YuE2 seul : la partition ABC d'une chanson, à relire avant de la jouer."}


def yue2_depuis_partition(*, checkpoint="yue2_3b_int8_convrot.safetensors"):
    """Le second étage seul de YuE2 (SN9) : « Jouer cette partition » — reçoit
    une partition ABC déjà écrite et relue (liaison `partition`, le champ
    `abc` de YuE2GenerateMusic) au lieu de la faire écrire par
    YuE2GenerateABC. Ce qui a été montré à l'écran est ce qui part : rien
    n'est réécrit avant le rendu. Un profil ordinaire de nature « audio »,
    installé comme `yue2-int8` (même fichier de poids)."""
    graphe = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": checkpoint}},
        "4": {"class_type": "YuE2GenerateMusic", "inputs": {"clip": ["1", 1], "style": "", "lyrics": "", "abc": "", "seed": 0,
            "mode": "full", "max_duration": 120, "temperature": 1.0, "top_p": 0.95, "top_k": 100, "repetition_penalty": 1.2}},
        "5": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["4", 0]}},
        "6": {"class_type": "EmptyYuE2LatentAudio", "inputs": {"seconds": ["4", 1], "batch_size": 1}},
        "7": {"class_type": "KSampler", "inputs": {"seed": 0, "steps": 32, "cfg": 1, "sampler_name": "dpm_2", "scheduler": "sgm_uniform",
            "denoise": 1, "model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0], "latent_image": ["6", 0]}},
        "8": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["7", 0], "vae": ["1", 2]}},
        "9": _sortie("yue2-partition-jouee", ["8", 0]),
    }
    liaisons = {"prompt": [_lien("4", "style")], "paroles": [_lien("4", "lyrics")], "partition": [_lien("4", "abc")],
        "secondes": [_lien("4", "max_duration")], "graine": [_lien("4", "seed"), _lien("7", "seed")]}
    return {"identifiant": "yue2-partition-jouee", "nom": "YuE2 — jouer la partition", "nature": "audio", "graphe": graphe,
        "liaisons": liaisons, "parametres": {}, "formats": [], "durees": [60, 120, 180, 240], "duree_libre": {"min": 10, "max": 360},
        "sortie": {"noeud": "9", "champ": "audio"},
        "description": "Joue une partition ABC déjà relue et corrigée à la main : rien n'est réécrit avant l'envoi."}


CONSTRUCTEURS = {
    "sa3-small-sfx": stable_audio_3_small_sfx,
    "sa3-medium": stable_audio_3_medium,
    "ace-step-15-turbo": ace_step_15_turbo,
    "yue2-int8": yue2_int8,
    "sa-open-1": stable_audio_open_1,
    # « yue2-partition-jouee » (SN9) : le second étage de YuE2 seul, installé
    # comme les autres pour être diagnostiqué (fichier manquant, grisé avec
    # sa raison). « yue2-partition » (le premier étage) n'y figure pas : sa
    # sortie est un texte, que le registre des profils ne sait pas nommer
    # (voir sa docstring) ; `ServicePartitionSon` le construit à la volée en
    # reprenant le fichier de poids déjà résolu pour `yue2-partition-jouee`.
    "yue2-partition-jouee": yue2_depuis_partition,
    # « ace-step-15-reprise » : installé à côté du turbo (mêmes fichiers),
    # jamais le moteur d'une famille — une demande y passe quand elle part
    # d'un son existant (`REPRISES`).
    "ace-step-15-reprise": ace_step_15_reprise,
}


# Les champs de graphe qui nomment un fichier de poids ComfyUI.
CHAMPS_FICHIER = ("ckpt_name", "clip_name", "clip_name1", "clip_name2", "unet_name", "vae_name")


def postes_fichiers(profil):
    """Chaque poste où le profil nomme un fichier de poids : son nom, la
    classe du nœud qui le charge et le champ. C'est ce qu'il faut pour le
    retrouver par motif contre /object_info (installation, SN1) — une classe
    et un champ donnent le bon chargeur, donc les bons choix installés."""
    postes = []
    for noeud in profil["graphe"].values():
        for champ, valeur in noeud["inputs"].items():
            if champ in CHAMPS_FICHIER:
                postes.append({"fichier": valeur, "classe": noeud["class_type"], "champ": champ})
    return postes


def fichiers_requis(profil):
    """Les fichiers de poids qu'un profil nomme, avec leur dossier et leur
    source quand l'atelier les connaît : ce que le diagnostic dira manquer."""
    noms = []
    for poste in postes_fichiers(profil):
        if poste["fichier"] not in noms:
            noms.append(poste["fichier"])
    return [{"fichier": n, **FICHIERS.get(n, {})} for n in noms]
