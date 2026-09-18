"""Les styles d'image locaux, recopiés de sc-clone (lib/catalog.mjs) : un style = un LoRA + le moteur qu'il exige."""
from __future__ import annotations
import re

FAMILLES: dict[str, dict] = {
    'zimage': {
        'nom': 'Z-Image Turbo',
        'noeuds': ('UNETLoader', 'CLIPLoader', 'VAELoader', 'LoraLoader', 'ModelSamplingAuraFlow', 'EmptySD3LatentImage', 'KSampler', 'VAEDecode', 'LoadImage', 'ImageScale', 'VAEEncode'),
        'unet': re.compile(r'z.?image.*turbo', re.I),
        'clip': re.compile(r'qwen.?3.?4b', re.I),
        'vae': re.compile(r'(^|[\\/])ae\.safetensors$', re.I),
        'vitesse': 'environ 30 secondes par image',
        'reference': 'depart'
    },
    'klein': {
        'nom': 'FLUX.2 Klein',
        # ⚠️ Défaut 9a (relecture du 18/09/2026) : `SplitSigmasDenoise` était exigé
        # ici alors qu'aucun de nos quatre constructeurs (`construire_klein`,
        # `styles_locaux.py`) n'en pose un dans le graphe — un ComfyUI qui n'a
        # pas ce nœud personnalisé grisait donc Klein pour rien.
        'noeuds': ('UNETLoader', 'CLIPLoader', 'VAELoader', 'LoraLoader', 'EmptyFlux2LatentImage', 'Flux2Scheduler', 'KSamplerSelect', 'RandomNoise', 'CFGGuider', 'SamplerCustomAdvanced', 'ConditioningZeroOut', 'VAEDecode', 'ReferenceLatent', 'ImageScaleToTotalPixels', 'VAEEncode', 'LoadImage'),
        'clip': re.compile(r'qwen.?3.?4b', re.I),
        'vae': re.compile(r'flux2.?vae', re.I),
        'vitesse': '1 à 3 minutes par image',
        'reference': 'sujet'
    },
    'flux1dev': {
        'nom': 'FLUX.1-dev',
        'noeuds': ('UnetLoaderGGUF', 'DualCLIPLoader', 'VAELoader', 'LoraLoader', 'FluxGuidance', 'EmptySD3LatentImage', 'KSampler', 'VAEDecode', 'LoadImage', 'ImageScale', 'VAEEncode'),
        'unet': re.compile(r'flux1.?dev.*\.gguf$', re.I),
        'clip1': re.compile(r't5xxl', re.I),
        'clip2': re.compile(r'clip_l', re.I),
        'vae': re.compile(r'(^|[\\/])ae\.safetensors$', re.I),
        'vitesse': '3 à 6 minutes par image',
        'reference': 'depart'
    },
    'sdxl': {
        'nom': 'SDXL',
        'noeuds': ('CheckpointLoaderSimple', 'LoraLoader', 'EmptyLatentImage', 'KSampler', 'VAEDecodeTiled', 'LoadImage', 'ImageScale', 'VAEEncode'),
        'checkpoint': re.compile(r'sd_xl_base', re.I),
        'vitesse': 'environ 40 secondes par image',
        'reference': 'depart'
    }
}

STYLES: tuple[dict, ...] = (
    {
        'identifiant': 'zimage-pixel',
        'famille': 'zimage',
        'lora': re.compile(r'pixel_art_style_z_image_turbo', re.I),
        'declencheur': 'Pixel art style.',
        'force': 1,
        'etapes': 9,
        'genre': 'sprite',
        'nom': 'Pixel art net et rapide',
        'description': 'Contours francs et couleurs plates, comme sur une console 16 bits. Le meilleur compromis pour la plupart des créations.',
        'etiquette': 'Recommandé',
        'source': 'tarn59/pixel_art_style_lora_z_image_turbo'
    },
    {
        'identifiant': 'zimage-redmond',
        'famille': 'zimage',
        'lora': re.compile(r'pixelart_redmond_zimage', re.I),
        'declencheur': 'Pixel Art, PixArFK',
        'force': 1,
        'etapes': 9,
        'genre': 'sprite',
        'nom': 'Pixel art Redmond',
        'description': 'Variante de style sur le même moteur rapide : rendu un peu plus illustratif, palettes plus larges.',
        'etiquette': 'Variante',
        'source': 'artificialguybr/PIXELART-REDMOND-ZIMAGETURBO'
    },
    {
        'identifiant': 'zimage-artist',
        'famille': 'zimage',
        'lora': re.compile(r'pixel_artist_z_zimage', re.I),
        'declencheur': 'a pixel art character',
        'force': 1,
        'etapes': 9,
        'genre': 'sprite',
        'nom': 'Personnage pixel',
        'description': "Entraîné sur des personnages : silhouettes lisibles, poses de face. Moins à l’aise sur les objets.",
        'etiquette': 'Personnages',
        'source': 'SkyAsl/Pixel-artist-Z'
    },
    {
        'identifiant': 'flux2-pixel',
        'famille': 'klein',
        'unet': re.compile(r'flux.?2.?klein.?4b', re.I),
        'lora': re.compile(r'pixel_art_sprite_flux2_klein', re.I),
        'declencheur': 'pixel art sprite',
        'suffixe': 'game asset, transparent background',
        'force': 1,
        'etapes': 4,
        'cfg': 1,
        'genre': 'sprite',
        'nom': 'Pixel art détaillé',
        'description': 'Plus de matière et de petits détails : armures, reflets, ombres travaillées.',
        'etiquette': 'Détaillé',
        'source': 'Limbicnation/pixel-art-lora'
    },
    {
        'identifiant': 'klein-pxart4',
        'famille': 'klein',
        'unet': re.compile(r'flux.?2.?klein.?base.?4b', re.I),
        'lora': re.compile(r'pixelart_pxart4_klein_base4b', re.I),
        'declencheur': 'PXART4.',
        'force': 1,
        'etapes': 20,
        'cfg': 5,
        'genre': 'sprite',
        'nom': 'Pixel art 64 px natif',
        'description': 'Entraîné sur des sources 64 × 64 pour la variante base que tu utilises déjà. Grille de pixels plus régulière.',
        'etiquette': 'Grille nette',
        'source': 'adirik/pixel-art-lora-flux.2-klein-4B'
    },
    {
        'identifiant': 'klein-4walk',
        'famille': 'klein',
        'unet': re.compile(r'flux.?2.?klein.?base.?4b', re.I),
        'lora': re.compile(r'spritesheet_4walk_klein_base4b', re.I),
        'declencheur': 'A pixel art spritesheet',
        'force': 1,
        'etapes': 20,
        'cfg': 5,
        'genre': 'sheet',
        'nom': 'Planche de marche 4 directions',
        'description': 'Produit directement une grille 4 × 4 : marche face, gauche, droite, dos, plus saut et chute.',
        'etiquette': 'Planche',
        'source': 'svntax-dev/pixel_spritesheet_4walk_small_lora_v1'
    },
    {
        'identifiant': 'klein-2x2',
        'famille': 'klein',
        'unet': re.compile(r'flux.?2.?klein.?4b', re.I),
        'lora': re.compile(r'spritesheet_2x2_klein_4b\.safetensors$', re.I),
        'declencheur': '2x2 sprite sheet',
        'force': 1,
        'etapes': 4,
        'cfg': 1,
        'genre': 'sheet',
        'nom': 'Planche 4 vues',
        'description': 'Transforme un objet en planche 2 × 2 : face, côté, dessus, isométrique, style constant.',
        'etiquette': 'Multivues',
        'source': 'fal/flux-2-klein-4b-spritesheet-lora'
    },
    {
        'identifiant': 'klein9b-redmond',
        'famille': 'klein',
        'unet': re.compile(r'flux.?2.?klein.?9b', re.I),
        'clip': re.compile(r'qwen.?3.?8b', re.I),
        'lora': re.compile(r'pixelart_redmond_klein9b', re.I),
        'declencheur': 'Pixel Art, PixArFK',
        'force': 1,
        'etapes': 4,
        'cfg': 1,
        'genre': 'sprite',
        'nom': 'Pixel art Redmond 9B',
        'description': 'Le même style sur le gros modèle Klein : compréhension des descriptions nettement meilleure, plus lent.',
        'etiquette': 'Gros modèle',
        'source': 'artificialguybr/PIXELART-REDMOND-FLUXKLEIN9B'
    },
    {
        'identifiant': 'klein9b-tiles',
        'famille': 'klein',
        'unet': re.compile(r'flux.?2.?klein.?base.?9b', re.I),
        'clip': re.compile(r'qwen.?3.?8b', re.I),
        'lora': re.compile(r'game_asset_tiles_klein_base9b', re.I),
        'declencheur': 'Game asset tile,',
        'force': 1,
        'etapes': 20,
        'cfg': 5,
        'genre': 'tile',
        'nom': 'Tuiles et décors',
        'description': 'Spécialisé dans les tuiles de décor de jeu : sol, murs, éléments répétables.',
        'etiquette': 'Tilesets',
        'source': 'crafiq/flux-2-klein-9b-game-asset-tiles-lora'
    },
    {
        'identifiant': 'klein9b-sheet',
        'famille': 'klein',
        'unet': re.compile(r'flux.?2.?klein.?base.?9b', re.I),
        'clip': re.compile(r'qwen.?3.?8b', re.I),
        'lora': re.compile(r'spritesheet_gms_klein_base9b', re.I),
        'declencheur': 'gmsspritesheet',
        'force': 1,
        'etapes': 20,
        'cfg': 5,
        'genre': 'sheet',
        'nom': 'Planche de sprites 9B',
        'description': "Planches d’animation sur le gros modèle. À essayer quand la planche 4 directions manque de détail.",
        'etiquette': 'Planche',
        'source': 'nova233/flux-lora-spritesheet'
    },
    {
        'identifiant': 'flux1-2dassets',
        'famille': 'flux1dev',
        'lora': re.compile(r'flux1dev_2d_game_assets', re.I),
        'declencheur': 'game assets, 2D',
        'force': 1,
        'etapes': 20,
        'genre': 'asset',
        'nom': 'Assets 2D dessinés',
        'description': "Objets de jeu façon illustration vectorielle : armes, potions, coffres. Ce n’est pas du pixel art.",
        'etiquette': 'Illustration',
        'source': 'gokaygokay/Flux-2D-Game-Assets-LoRA'
    },
    {
        'identifiant': 'flux1-assets2',
        'famille': 'flux1dev',
        'lora': re.compile(r'flux1dev_game_assets_v2', re.I),
        'declencheur': 'wbgmsst, game asset, white background',
        'force': 1,
        'etapes': 20,
        'genre': 'asset',
        'nom': 'Assets de jeu sur fond blanc',
        'description': 'Objets isolés sur fond blanc, détourage facile. Rendu proche du rendu 3D stylisé.',
        'etiquette': 'Objets',
        'source': 'gokaygokay/Flux-Game-Assets-LoRA-v2'
    },
    {
        'identifiant': 'flux1-modern',
        'famille': 'flux1dev',
        'lora': re.compile(r'flux1dev_modern_pixelart', re.I),
        'declencheur': 'umempart',
        'force': 1,
        'etapes': 20,
        'genre': 'sprite',
        'nom': 'Pixel art moderne',
        'description': 'Pixel art riche et contrasté, scènes complètes. Le plus lent, mais le plus détaillé du lot.',
        'etiquette': 'Qualité',
        'source': 'UmeAiRT/FLUX.1-dev-LoRA-Modern_Pixel_art'
    },
    {
        'identifiant': 'flux1-retro',
        'famille': 'flux1dev',
        'lora': re.compile(r'flux1dev_retro_pixel', re.I),
        'declencheur': 'Retro Pixel',
        'force': 1,
        'etapes': 20,
        'genre': 'sprite',
        'nom': 'Rétro 8 bits',
        'description': "Palette réduite et gros pixels, esprit borne d’arcade.",
        'etiquette': 'Rétro',
        'source': 'prithivMLmods/Retro-Pixel-Flux-LoRA'
    },
    {
        'identifiant': 'flux1-2dhd',
        'famille': 'flux1dev',
        'lora': re.compile(r'flux1dev_2dhd_pixelart', re.I),
        'declencheur': '2DHD pixel art',
        'force': 1,
        'etapes': 20,
        'genre': 'sprite',
        'nom': 'Pixel art HD',
        'description': 'Pixels nets sur grande image, adapté aux décors et aux grands sprites.',
        'etiquette': 'Décors',
        'source': 'glif-loradex-trainer/AP123_flux_dev_2DHD_pixel_art'
    },
    {
        'identifiant': 'flux1-trainer',
        'famille': 'flux1dev',
        'lora': re.compile(r'flux1dev_sprite_trainer', re.I),
        'declencheur': 'pixel, sprite sheet',
        'force': 1,
        'etapes': 20,
        'genre': 'sheet',
        'nom': 'Sprites de personnage rétro',
        'description': 'Petits personnages de jeu de rôle façon console portable, plusieurs poses.',
        'etiquette': 'Personnages',
        'source': 'sWizad/pokemon-trainer-sprites-pixelart-flux'
    },
    {
        'identifiant': 'sdxl-pixelart',
        'famille': 'sdxl',
        'lora': re.compile(r'pixel-art-xl\.safetensors$', re.I),
        'declencheur': 'pixel art',
        'force': 0.35,
        'etapes': 28,
        'genre': 'sprite',
        'nom': 'Pixel art SDXL',
        'description': 'Le classique : rapide, fiable, un peu daté face aux modèles récents.',
        'etiquette': 'Classique',
        'source': 'nerijs/pixel-art-xl'
    },
    {
        'identifiant': 'sdxl-redmond',
        'famille': 'sdxl',
        'lora': re.compile(r'pixelart_redmond_sdxl', re.I),
        'declencheur': 'Pixel Art, PixArFK',
        'force': 0.8,
        'etapes': 28,
        'genre': 'sprite',
        'nom': 'Pixel art Redmond SDXL',
        'description': 'Plus contrasté que le classique, bon sur les personnages isolés.',
        'etiquette': 'Variante',
        'source': 'artificialguybr/PixelArtRedmond'
    },
    {
        'identifiant': 'sdxl-icon',
        'famille': 'sdxl',
        'lora': re.compile(r'pixelicon_yotoicon_sdxl', re.I),
        'declencheur': 'yotoicon, 16x16 pixel art icon of',
        'force': 0.7,
        'etapes': 30,
        'genre': 'icon',
        'nom': 'Icônes 16 × 16 vraies',
        'description': 'Dessine une grille 16 × 16 exacte sur 512 px : la réduction en petite icône est sans perte. Idéal inventaire et interface.',
        'etiquette': 'Icônes',
        'source': 'lizozom/pixel-icon-lora-sdxl'
    },
    {
        'identifiant': 'sdxl-trainer',
        'famille': 'sdxl',
        'lora': re.compile(r'sprite_trainer_sdxl', re.I),
        'declencheur': 'pixel, sprite',
        'force': 0.9,
        'etapes': 28,
        'genre': 'sprite',
        'nom': 'Sprites de dresseur',
        'description': 'Petits personnages façon jeu de rôle portable, silhouettes très lisibles.',
        'etiquette': 'Personnages',
        'source': 'sWizad/pokemon-trainer-sprite-pixelart'
    },
    {
        'identifiant': 'sdxl-portraits',
        'famille': 'sdxl',
        'lora': re.compile(r'pixelportraits_sdxl', re.I),
        'declencheur': 'pixelportrait',
        'force': 0.8,
        'etapes': 28,
        'genre': 'sprite',
        'nom': 'Portraits pixel',
        'description': 'Bustes et visages en pixel art, pour les dialogues et les fiches de personnage.',
        'etiquette': 'Portraits',
        'source': 'nerijs/pixelportraits192-XL-v1.0'
    },
    {
        'identifiant': 'sdxl-tileable',
        'famille': 'sdxl',
        'lora': re.compile(r'pixel-art-xl\.safetensors$', re.I),
        'declencheur': 'pixel art',
        'force': 0.35,
        'etapes': 28,
        'genre': 'tile',
        'raccordable': True,
        'noeuds': ('SeamlessTile', 'CircularVAEDecode'),
        'nom': 'Texture raccordable',
        'description': 'Fabrique une matière qui se répète sans couture : le bord gauche continue exactement sur le bord droit, le haut sur le bas. Ne dessine pas des tuiles mais la texture de base dans laquelle le pipeline tileset découpe ensuite les 47 tuiles, raccord garanti.',
        'etiquette': 'Sans couture',
        'source': 'nerijs/pixel-art-xl'
    },
    # ML6 : sc-clone n'a que sdxl-tileable comme style « raccordable » à part entière —
    # les tuiles de Klein (klein9b-tiles) n'ont pas d'équivalent chez lui. Le raccord
    # sans couture (`lib/seamless.mjs`) est générique aux quatre familles (mesuré sur
    # FLUX.2 dans son commentaire), donc on ajoute la même variante par construction ici,
    # sans toucher à klein9b-tiles ni aux 21 autres styles recopiés : mêmes champs que
    # klein9b-tiles, identifiant distinct, et les deux nœuds du raccord en plus.
    {
        'identifiant': 'klein9b-tiles-raccordable',
        'famille': 'klein',
        'unet': re.compile(r'flux.?2.?klein.?base.?9b', re.I),
        'clip': re.compile(r'qwen.?3.?8b', re.I),
        'lora': re.compile(r'game_asset_tiles_klein_base9b', re.I),
        'declencheur': 'Game asset tile,',
        'force': 1,
        'etapes': 20,
        'cfg': 5,
        'genre': 'tile',
        'raccordable': True,
        'noeuds': ('SeamlessTile', 'CircularVAEDecode'),
        'nom': 'Tuiles et décors raccordables',
        'description': 'La même matière que « Tuiles et décors », avec le raccord sans couture appliqué : le bord gauche continue exactement sur le bord droit, le haut sur le bas.',
        'etiquette': 'Sans couture',
        'source': 'crafiq/flux-2-klein-9b-game-asset-tiles-lora'
    }
)


# ML6 : les deux nœuds du raccord sans couture (`lib/seamless.mjs`) ne viennent pas de
# ComfyUI lui-même — la même consigne que sc-clone (`lib/workflows.mjs`) quand l'un des
# deux manque.
_NOEUDS_RACCORD = ('SeamlessTile', 'CircularVAEDecode')
_CONSIGNE_RACCORD = ('installer le nœud personnalisé ComfyUI-seamless-tiling : dans le '
    'dossier custom_nodes de ComfyUI, git clone https://github.com/spinagon/ComfyUI-seamless-tiling '
    'puis redémarrer ComfyUI')


def style(identifiant):
    """Renvoie le dict du style ou None."""
    for s in STYLES:
        if s['identifiant'] == identifiant:
            return s
    return None


_QUALITE = re.compile(r'Q(\d)(?:_K)?(_[SM])?', re.I)
_FP8 = re.compile(r'fp8', re.I)


def qualite(nom):
    """Port de `quality` (catalog.mjs) : entre deux fichiers compatibles, la
    quantification la plus fidèle d'abord."""
    m = _QUALITE.search(nom)
    if m:
        suffixe = (m.group(2) or '').upper()
        return int(m.group(1)) * 10 + (2 if suffixe == '_M' else 1 if suffixe else 3)
    return 55 if _FP8.search(nom) else 100


def _choisir(liste, motif):
    if motif is None:
        return None
    correspond = [n for n in (liste or []) if motif.search(n)]
    if not correspond:
        return None
    return max(correspond, key=qualite)


def inventaire(informations):
    """Port de `inventory` (providers.mjs) : ce que /object_info expose, réduit
    aux listes que les familles interrogent."""
    def options(noeud, champ):
        entree = (informations.get(noeud) or {}).get('input', {}).get('required', {}).get(champ)
        if not isinstance(entree, list) or not entree:
            return []
        if isinstance(entree[0], list):
            return entree[0]
        # Défaut 7 (relecture du 18/09/2026) : certains ComfyUI publient une entrée
        # COMBO sous la forme `["COMBO", {"options": [...]}]` plutôt que
        # `[[...], {...}]` — port de `inventory` (sc-clone `lib/providers.mjs` ~305) :
        # `Array.isArray(spec?.[0]) ? spec[0] : spec?.[1]?.options || []`.
        if len(entree) > 1 and isinstance(entree[1], dict):
            return entree[1].get('options') or []
        return []
    unets = []
    for noeud in ('UNETLoader', 'UnetLoaderGGUF', 'UnetLoaderGGUFAdvanced'):
        for n in options(noeud, 'unet_name'):
            if n not in unets:
                unets.append(n)
    return {
        'checkpoints': options('CheckpointLoaderSimple', 'ckpt_name'),
        'loras': options('LoraLoader', 'lora_name'),
        'unets': unets,
        'clips': options('CLIPLoader', 'clip_name'),
        'vaes': options('VAELoader', 'vae_name'),
        'noeuds': list(informations.keys()),
    }


def resoudre(entree, inventaire_):
    """Port de `resolveStyle` (catalog.mjs) : les fichiers réels d'un style,
    et ce qui manque, nommé en français."""
    if not entree:
        return {'pret': False, 'manque': ['style inconnu'], 'fichiers': {}}
    famille = FAMILLES[entree['famille']]
    besoin = {'lora': (entree.get('lora'), inventaire_['loras'], 'le LoRA de style')}
    if entree.get('unet') or famille.get('unet'):
        besoin['unet'] = (entree.get('unet') or famille.get('unet'), inventaire_['unets'], 'le modèle de base')
    if entree.get('clip') or famille.get('clip'):
        besoin['clip'] = (entree.get('clip') or famille.get('clip'), inventaire_['clips'], 'l’encodeur de texte')
    if famille.get('clip1'):
        besoin['clip1'] = (famille['clip1'], inventaire_['clips'], 'l’encodeur T5')
    if famille.get('clip2'):
        besoin['clip2'] = (famille['clip2'], inventaire_['clips'], 'l’encodeur CLIP-L')
    if famille.get('vae'):
        besoin['vae'] = (famille['vae'], inventaire_['vaes'], 'le décodeur d’image')
    if famille.get('checkpoint'):
        besoin['checkpoint'] = (famille['checkpoint'], inventaire_['checkpoints'], 'le checkpoint SDXL')
    fichiers, manque = {}, []
    for cle, (motif, liste, libelle) in besoin.items():
        trouve = _choisir(liste, motif)
        if trouve:
            fichiers[cle] = trouve
        else:
            manque.append(libelle)
    noeuds = inventaire_.get('noeuds')
    if noeuds is not None:
        for n in (*famille['noeuds'], *entree.get('noeuds', ())):
            if n not in noeuds:
                if n in _NOEUDS_RACCORD:
                    manque.append(f'le nœud {n} ({_CONSIGNE_RACCORD})')
                else:
                    manque.append('le nœud ' + n)
    return {'pret': not manque, 'manque': manque, 'fichiers': fichiers}
