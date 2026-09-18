"""Les 22 styles de sc-clone, portés en profils gag2 ordinaires (ML2, ML3).

Un constructeur par famille (`lib/zimage.mjs`, `lib/flux2.mjs`, `lib/flux1.mjs`,
`providers.mjs` § `makeWorkflow`/`styleWorkflow`) : même numérotation de nœuds que
la source, pour comparer les graphes structurellement dans les essais.

ML3 ajoute la branche référence de chaque famille, en variantes (`atelier.domaine.workflow`
§ `_variantes`) : **FLUX.2 Klein** garde le sujet (`ReferenceLatent`, 1 à 3 références,
relevé sur le gabarit d'édition officiel de ComfyUI — `docs/PLAN-moteurs-locaux.md` §
« L'image de référence ») ; **Z-Image, FLUX.1-dev, SDXL** partent de l'image (une seule
référence, `VAEEncode` en latent de départ, force réglable par l'option `force`, propre à
cette variante — `tileable` reste pour ML6, sans toucher aux autres.

Le texte reste un simple nœud à relier (`liaisons["prompt"]`) : composer le
texte final (déclencheur en tête, suffixe, troncature SDXL…) est le travail
de ML4, pas de celui-ci.
"""
from __future__ import annotations

import copy

from atelier.domaine.workflow import WorkflowRefuse
from atelier.fournisseur.catalogue_styles import FAMILLES, style as style_de


def _formats():
    return [
        {"resolution": "512", "proportions": "1:1", "largeur": 512, "hauteur": 512},
        {"resolution": "1024", "proportions": "1:1", "largeur": 1024, "hauteur": 1024},
    ]


def _noeud(class_type, **inputs):
    return {"class_type": class_type, "inputs": inputs}


def _copier(graphe, liaisons):
    return copy.deepcopy(graphe), {n: [dict(lien) for lien in liens] for n, liens in liaisons.items()}


# Force de transformation par défaut d'un style « partir de cette image » — comme sc-clone
# (`input.denoise ?? .55`). L'option est propre à la variante à une référence : elle n'existe
# pas sur le graphe à 0 référence, qui n'a pas de latent de départ à doser.
PARAMETRE_FORCE = {"force": {"genre": "intervalle", "minimum": 0, "maximum": 1, "defaut": 0.55, "reference_seule": True}}


def _variante_partir_de(graphe, liaisons, *, sampler_noeud, id_charge, id_echelle, id_encode, vae):
    """`lib/zimage.mjs`, `lib/flux1.mjs`, `providers.mjs` § branche `uploadedReference` :
    l'image remplace le bruit de départ, la force du KSampler devient réglable."""
    graphe, liaisons = _copier(graphe, liaisons)
    graphe[id_charge] = _noeud("LoadImage", image="")
    graphe[id_echelle] = _noeud("ImageScale", image=[id_charge, 0], upscale_method="nearest-exact",
        width=512, height=512, crop="disabled")
    graphe[id_encode] = _noeud("VAEEncode", pixels=[id_echelle, 0], vae=list(vae))
    graphe[sampler_noeud]["inputs"]["latent_image"] = [id_encode, 0]
    liaisons["reference:0"] = [{"noeud": id_charge, "champ": "image"}]
    liaisons["option:force"] = [{"noeud": sampler_noeud, "champ": "denoise"}]
    liaisons["largeur"] = [*liaisons["largeur"], {"noeud": id_echelle, "champ": "width"}]
    liaisons["hauteur"] = [*liaisons["hauteur"], {"noeud": id_echelle, "champ": "height"}]
    return graphe, liaisons


def _variante_klein(graphe, liaisons, *, distille, nombre):
    """Gabarit d'édition officiel FLUX.2 Klein (relevé le 18/09/2026) : par référence,
    `LoadImage` → `ImageScaleToTotalPixels` → `VAEEncode`, un seul `VAEEncode` par image ;
    puis `ReferenceLatent` posé sur le positif ET le négatif, en chaîne — N images donnent
    2N `ReferenceLatent`. Le latent de départ (`EmptyFlux2LatentImage`) ne change pas :
    ce n'est pas de l'img2img, c'est une édition qui garde le sujet."""
    graphe, liaisons = _copier(graphe, liaisons)
    prochain = 16
    derniers = []
    for i in range(nombre):
        charge, echelle, encode = str(prochain), str(prochain + 1), str(prochain + 2)
        prochain += 3
        graphe[charge] = _noeud("LoadImage", image="")
        graphe[echelle] = _noeud("ImageScaleToTotalPixels", image=[charge, 0], upscale_method="nearest-exact",
            megapixels=1, resolution_steps=1)
        graphe[encode] = _noeud("VAEEncode", pixels=[echelle, 0], vae=["3", 0])
        liaisons[f"reference:{i}"] = [{"noeud": charge, "champ": "image"}]
        derniers.append(encode)
    positif = "5"
    for latent in derniers:
        noeud = str(prochain)
        prochain += 1
        graphe[noeud] = _noeud("ReferenceLatent", conditioning=[positif, 0], latent=[latent, 0])
        positif = noeud
    negatif = "7" if distille else "6"
    for latent in derniers:
        noeud = str(prochain)
        prochain += 1
        graphe[noeud] = _noeud("ReferenceLatent", conditioning=[negatif, 0], latent=[latent, 0])
        negatif = noeud
    graphe["8"]["inputs"]["positive"] = [positif, 0]
    graphe["8"]["inputs"]["negative"] = [negatif, 0]
    return graphe, liaisons


def _metadonnees_style(entree):
    famille = FAMILLES[entree["famille"]]
    d = {"famille": entree["famille"], "declencheur": entree["declencheur"], "genre": entree.get("genre", "sprite"),
        "vitesse": famille["vitesse"], "source": entree["source"], "reference": famille["reference"]}
    if entree.get("suffixe"):
        d["suffixe"] = entree["suffixe"]
    return d


def _profil(entree, *, graphe, liaisons, sortie_noeud, etapes, parametres=None, variantes=None):
    profil = {
        "identifiant": entree["identifiant"],
        "nom": FAMILLES[entree["famille"]]["nom"] + " · " + entree["nom"],
        "nature": "image",
        "graphe": graphe,
        "liaisons": liaisons,
        "parametres": parametres or {},
        "formats": _formats(),
        "sortie": {"noeud": sortie_noeud, "champ": "images"},
        "description": entree["description"],
        "style": _metadonnees_style(entree),
    }
    if variantes:
        profil["variantes"] = variantes
    return profil


def construire_zimage(entree, fichiers):
    """`lib/zimage.mjs` § makeZImageWorkflow, sans référence."""
    force = entree["force"]
    graphe = {
        "1": _noeud("UNETLoader", unet_name=fichiers["unet"], weight_dtype="default"),
        "2": _noeud("CLIPLoader", clip_name=fichiers["clip"], type="lumina2", device="default"),
        "3": _noeud("VAELoader", vae_name=fichiers["vae"]),
        "4": _noeud("LoraLoader", model=["1", 0], clip=["2", 0], lora_name=fichiers["lora"], strength_model=force, strength_clip=force),
        "5": _noeud("ModelSamplingAuraFlow", model=["4", 0], shift=3),
        "6": _noeud("CLIPTextEncode", clip=["4", 1], text=""),
        "7": _noeud("CLIPTextEncode", clip=["4", 1], text=""),
        "8": _noeud("EmptySD3LatentImage", width=512, height=512, batch_size=1),
        "9": _noeud("KSampler", seed=0, steps=entree["etapes"], cfg=1, sampler_name="euler", scheduler="simple",
            denoise=1, model=["5", 0], positive=["6", 0], negative=["7", 0], latent_image=["8", 0]),
        "10": _noeud("VAEDecode", samples=["9", 0], vae=["3", 0]),
        "11": _noeud("SaveImage", images=["10", 0], filename_prefix="AssetKitchen_ZImage"),
    }
    liaisons = {"prompt": [{"noeud": "6", "champ": "text"}],
        "largeur": [{"noeud": "8", "champ": "width"}], "hauteur": [{"noeud": "8", "champ": "height"}],
        "graine": [{"noeud": "9", "champ": "seed"}]}
    # cfg 1 : le négatif ne pèse rien dans le calcul, comme sur Klein distillé —
    # écart volontaire documenté dans tests/test_ml2.py.
    variante_graphe, variante_liaisons = _variante_partir_de(graphe, liaisons, sampler_noeud="9",
        id_charge="12", id_echelle="13", id_encode="14", vae=("3", 0))
    return _profil(entree, graphe=graphe, liaisons=liaisons, sortie_noeud="11", etapes=entree["etapes"],
        parametres=PARAMETRE_FORCE, variantes={"1": {"graphe": variante_graphe, "liaisons": variante_liaisons}})


def construire_klein(entree, fichiers):
    """`lib/flux2.mjs` § makeFlux2Workflow, sans référence."""
    distille = entree.get("cfg") == 1
    force = entree["force"]
    charge_unet = _noeud("UnetLoaderGGUF", unet_name=fichiers["unet"]) if fichiers["unet"].lower().endswith(".gguf") \
        else _noeud("UNETLoader", unet_name=fichiers["unet"], weight_dtype="default")
    graphe = {
        "1": charge_unet,
        "2": _noeud("CLIPLoader", clip_name=fichiers["clip"], type="flux2", device="default"),
        "3": _noeud("VAELoader", vae_name=fichiers["vae"]),
        "4": _noeud("LoraLoader", model=["1", 0], clip=["2", 0], lora_name=fichiers["lora"], strength_model=force, strength_clip=force),
        "5": _noeud("CLIPTextEncode", clip=["4", 1], text=""),
        "6": _noeud("CLIPTextEncode", clip=["4", 1], text=""),
        "7": _noeud("ConditioningZeroOut", conditioning=["6", 0]),
        "8": _noeud("CFGGuider", model=["4", 0], positive=["5", 0], negative=(["7", 0] if distille else ["6", 0]), cfg=(1 if distille else 5)),
        "9": _noeud("KSamplerSelect", sampler_name="euler"),
        "10": _noeud("Flux2Scheduler", steps=entree["etapes"], width=512, height=512),
        "11": _noeud("RandomNoise", noise_seed=0),
        "12": _noeud("EmptyFlux2LatentImage", width=512, height=512, batch_size=1),
        "13": _noeud("SamplerCustomAdvanced", noise=["11", 0], guider=["8", 0], sampler=["9", 0], sigmas=["10", 0], latent_image=["12", 0]),
        "14": _noeud("VAEDecode", samples=["13", 0], vae=["3", 0]),
        "15": _noeud("SaveImage", images=["14", 0], filename_prefix="AssetKitchen_Flux2"),
    }
    liaisons = {"prompt": [{"noeud": "5", "champ": "text"}],
        "largeur": [{"noeud": "10", "champ": "width"}, {"noeud": "12", "champ": "width"}],
        "hauteur": [{"noeud": "10", "champ": "height"}, {"noeud": "12", "champ": "height"}],
        "graine": [{"noeud": "11", "champ": "noise_seed"}]}
    if not distille:
        # Guidage réel (cfg 5) : le négatif compte, on le relie.
        liaisons["prompt_negatif"] = [{"noeud": "6", "champ": "text"}]
    variantes = {}
    for nombre in (1, 2, 3):
        variante_graphe, variante_liaisons = _variante_klein(graphe, liaisons, distille=distille, nombre=nombre)
        variantes[str(nombre)] = {"graphe": variante_graphe, "liaisons": variante_liaisons}
    return _profil(entree, graphe=graphe, liaisons=liaisons, sortie_noeud="15", etapes=entree["etapes"], variantes=variantes)


def construire_flux1(entree, fichiers):
    """`lib/flux1.mjs` § makeFlux1Workflow, sans référence."""
    force = entree["force"]
    graphe = {
        "1": _noeud("UnetLoaderGGUF", unet_name=fichiers["unet"]),
        "2": _noeud("DualCLIPLoader", clip_name1=fichiers["clip1"], clip_name2=fichiers["clip2"], type="flux", device="default"),
        "3": _noeud("VAELoader", vae_name=fichiers["vae"]),
        "4": _noeud("LoraLoader", model=["1", 0], clip=["2", 0], lora_name=fichiers["lora"], strength_model=force, strength_clip=force),
        "5": _noeud("CLIPTextEncode", clip=["4", 1], text=""),
        "6": _noeud("FluxGuidance", conditioning=["5", 0], guidance=3.5),
        "7": _noeud("CLIPTextEncode", clip=["4", 1], text=""),
        "8": _noeud("EmptySD3LatentImage", width=512, height=512, batch_size=1),
        "9": _noeud("KSampler", seed=0, steps=entree["etapes"], cfg=1, sampler_name="euler", scheduler="simple",
            denoise=1, model=["4", 0], positive=["6", 0], negative=["7", 0], latent_image=["8", 0]),
        "10": _noeud("VAEDecode", samples=["9", 0], vae=["3", 0]),
        "11": _noeud("SaveImage", images=["10", 0], filename_prefix="AssetKitchen_Flux1"),
    }
    liaisons = {"prompt": [{"noeud": "5", "champ": "text"}],
        "largeur": [{"noeud": "8", "champ": "width"}], "hauteur": [{"noeud": "8", "champ": "height"}],
        "graine": [{"noeud": "9", "champ": "seed"}]}
    # cfg 1 côté KSampler : comme Z-Image, le négatif ne pèse rien mathématiquement
    # (le guidage réel passe par FluxGuidance, sur le positif seul). Pas de liaison
    # prompt_negatif — écart documenté dans tests/test_ml2.py.
    variante_graphe, variante_liaisons = _variante_partir_de(graphe, liaisons, sampler_noeud="9",
        id_charge="12", id_echelle="13", id_encode="14", vae=("3", 0))
    return _profil(entree, graphe=graphe, liaisons=liaisons, sortie_noeud="11", etapes=entree["etapes"],
        parametres=PARAMETRE_FORCE, variantes={"1": {"graphe": variante_graphe, "liaisons": variante_liaisons}})


def construire_sdxl(entree, fichiers):
    """`lib/providers.mjs` § makeWorkflow, chemin `entry.family==='sdxl'`, sans référence."""
    force = entree["force"]
    graphe = {
        "1": _noeud("CheckpointLoaderSimple", ckpt_name=fichiers["checkpoint"]),
        "2": _noeud("CLIPTextEncode", text="", clip=["13", 1]),
        "3": _noeud("CLIPTextEncode", text="", clip=["13", 1]),
        "4": _noeud("EmptyLatentImage", width=512, height=512, batch_size=1),
        "5": _noeud("KSampler", seed=0, steps=entree["etapes"], cfg=6, sampler_name="dpmpp_2m", scheduler="karras",
            denoise=1, model=["13", 0], positive=["2", 0], negative=["3", 0], latent_image=["4", 0]),
        "6": _noeud("VAEDecodeTiled", samples=["5", 0], vae=["1", 2], tile_size=256, overlap=64, temporal_size=64, temporal_overlap=8),
        "7": _noeud("SaveImage", images=["6", 0], filename_prefix="AssetKitchen"),
        "13": _noeud("LoraLoader", model=["1", 0], clip=["1", 1], lora_name=fichiers["lora"], strength_model=force, strength_clip=force),
    }
    liaisons = {"prompt": [{"noeud": "2", "champ": "text"}], "prompt_negatif": [{"noeud": "3", "champ": "text"}],
        "largeur": [{"noeud": "4", "champ": "width"}], "hauteur": [{"noeud": "4", "champ": "height"}],
        "graine": [{"noeud": "5", "champ": "seed"}]}
    # Le VAE part du checkpoint (sortie n° 2), pas d'un VAELoader séparé — comme
    # `providers.mjs` § makeWorkflow, branche `uploadedReference`.
    variante_graphe, variante_liaisons = _variante_partir_de(graphe, liaisons, sampler_noeud="5",
        id_charge="8", id_echelle="10", id_encode="9", vae=("1", 2))
    return _profil(entree, graphe=graphe, liaisons=liaisons, sortie_noeud="7", etapes=entree["etapes"],
        parametres=PARAMETRE_FORCE, variantes={"1": {"graphe": variante_graphe, "liaisons": variante_liaisons}})


CONSTRUCTEURS = {"zimage": construire_zimage, "klein": construire_klein, "flux1dev": construire_flux1, "sdxl": construire_sdxl}


def construire_profil(entree, fichiers):
    """Le profil gag2 (non normalisé) d'un style, à partir de ses fichiers résolus."""
    constructeur = CONSTRUCTEURS.get(entree["famille"])
    if constructeur is None:
        raise WorkflowRefuse(f"Famille inconnue : {entree['famille']}.")
    return constructeur(entree, fichiers)
