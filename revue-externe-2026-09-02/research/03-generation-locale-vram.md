# 03 — Génération d'images en local sous contrainte VRAM (≤ 8 Go) et runtimes

*Recherche technique, septembre 2026. Toutes les licences et exigences matérielles ci-dessous ont été vérifiées sur les fiches HuggingFace / dépôts GitHub / docs officielles (liens en section 6). Les chiffres de VRAM et de vitesse sont des ordres de grandeur issus de benchmarks 2025-2026 ; ils varient selon la résolution, le runtime et les flags.*

**Rappel des contraintes projet** : backend Python 3.11 / FastAPI, appel des API via httpx, Pillow + NumPy ; cible GPU NVIDIA 8 Go (dev RTX 3080 10 Go), mais doit tourner sur 4-6 Go, CPU seul, et idéalement AMD / Mac ; open source uniquement pour tout ce qui est distribué ; API propriétaires acceptées pour la génération (payantes).

---

## 1. Les problèmes / verrous

1. **Le modèle de fondation « bon et commercialement utilisable » ne tient pas en 8 Go tel quel.** Les meilleurs modèles ouverts 2025-2026 font 6 à 32 milliards de paramètres (Z-Image 6B, FLUX.1 12B, Qwen-Image 20B, FLUX.2 dev 32B) et embarquent un encodeur de texte qui est lui-même un LLM (Qwen3-4B, Qwen2.5-VL-7B, T5-XXL 4,7B). En bf16 cela représente 12 à 60 Go. Il faut donc quantifier (GGUF Q4/Q8, NF4, fp8, SVDQuant INT4) et/ou décharger (offload) vers la RAM — au prix de vitesse et parfois de qualité.
2. **La licence est un champ de mines.** Beaucoup de modèles très populaires sont *non commerciaux* pour le **modèle** (FLUX.1 dev / Krea / FLUX.2 dev / FLUX.2 klein 9B, Sana « NVIDIA License », DMD2 CC-BY-NC), même quand les *images produites* sont librement exploitables. D'autres ont des clauses géographiques (Tencent Hunyuan : **UE, Royaume-Uni et Corée du Sud exclus** — inutilisable pour un éditeur français) ou de seuil de revenu (Stability AI Community License : gratuit sous 1 M$/an). Les LoRAs pixel art sur Civitai ajoutent des restrictions contractuelles au-dessus d'OpenRAIL. Une app « open-source-first » distribuée doit tracer la licence de chaque poids téléchargé.
3. **Le « vrai » pixel art n'est pas ce que produisent les modèles.** Un modèle de diffusion sort une image 1024² « qui ressemble » à du pixel art (pixels irréguliers, palettes de centaines de couleurs, grille non alignée). Le passage à un sprite exploitable (32×32 ou 64×64, palette de 16-32 couleurs, grille propre, fond transparent) est un problème de post-traitement algorithmique local (détection de grille, downscale nearest/k-centroid, quantification palette, dithering) — c'est là que la philosophie « max calcul local » paie le plus.
4. **Le runtime doit être embarquable dans FastAPI et portable.** ComfyUI est GPL-3.0 et pensé comme serveur autonome ; diffusers est Apache 2.0 mais purement PyTorch/CUDA-centré (AMD via ROCm Linux seulement, Mac via MPS lent) ; stable-diffusion.cpp (MIT, ggml) tourne partout (CUDA, Vulkan, Metal, ROCm, SYCL, CPU) mais avec un catalogue de fonctions plus réduit. Il faut une couche d'abstraction et une stratégie de bascule.
5. **Générer des planches larges (tilesets, sprite sheets, décors) en 8 Go.** Au-delà de ~1-1,5 Mpx, l'attention et le VAE explosent la mémoire ; il faut du tiling (MultiDiffusion / Mixture of Diffusers, VAE tiling) — dont l'implémentation ComfyUI la plus connue est… CC-BY-NC-SA.
6. **Analyser, décrire, juger des images en local** (décrire une référence, extraire une palette sémantique, vérifier qu'un sprite correspond au prompt, trier 8 variations) sans VLM propriétaire, en < 4 Go de VRAM et en cohabitation avec le modèle de génération.
7. **Les modèles « gros » (Qwen-Image 20B, FLUX.2 dev 32B, HunyuanImage 3.0 80B MoE, GPT-Image, Nano Banana) restent hors de portée locale** : il faut une architecture hybride où l'API fait la génération brute et tout le reste (analyse, découpe, palette, upscale, scoring, animation) reste local — et connaître les prix.

---

## 2. Solutions par problème

### 2.1 Problème 1 — Modèles text-to-image / image-to-image open source faisables en ≤ 8 Go

Tableau des candidats (T2I = text-to-image, I2I = image-to-image / édition). « VRAM » = pic mesuré ou annoncé pour 1024² avec la quantification indiquée ; « Intég. » = complexité d'intégration dans notre stack (1 = trivial, 5 = très lourd).

| Nom | URL | Licence (modèle) | Langage / runtime | Type | Maturité | VRAM / vitesse | Intég. | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **FLUX.2 [klein] 4B** (distillé 4 pas + Base 50 pas) | huggingface.co/black-forest-labs/FLUX.2-klein-4B | **Apache 2.0** | diffusers / ComfyUI / sd.cpp / mflux / Nunchaku (en cours) | T2I + I2I multi-références unifié | Sorti 15 janv. 2026, très actif | ComfyUI fp8 : **8,4 Go**, ~1,2 s (GPU rapide) ; Base 9,2 Go, ~17 s ; GGUF Q4_K_M : poids ~2,6 Go, 15-30 s/img sur RTX 4060 8 Go ; encodeur Qwen3-4B | 2 | Meilleur rapport qualité/poids/licence 2026 ; édition par référence native (style transfer, remplacement d'objet, multi-images) ; LoRA entraînables sur la version Base (ai-toolkit) | **Candidat n°1** pour HD et pour l'I2I de cohérence. La version 9B est *FLUX Non-Commercial* → à proscrire. |
| **Z-Image-Turbo** (6B, 8 pas) | huggingface.co/Tongyi-MAI/Z-Image-Turbo | **Apache 2.0** | diffusers / ComfyUI / sd.cpp / mflux / Nunchaku / DiffSynth | T2I | Sorti 26 nov. 2025 ; base « Z-Image » (non distillée) sortie 27 janv. 2026 ; Omni-Base et Edit « à venir » | bf16 14-16 Go ; fp8 ~8 Go ; **GGUF Q3/Q4 : 5-6 Go** ; bench diffusers : Q4_K_M + encodeur 4 bits + CPU offload = **6,4 Go** ; RTX 4090 : 2,3 s/img ; RTX 3080 laptop Q4 : ~2,4 s/it → ~20 s/img | 2 | Photoréalisme et texte excellents, bonne adhérence au prompt ; moins « stylisé » par défaut, peu de LoRAs game-art encore ; encodeur Qwen3-4B (~7 Go bf16, à quantifier) | **Candidat n°1 pour la qualité HD** en 8 Go. Distillé sans CFG (guidance 0). |
| **FLUX.1 [schnell]** (12B, 4 pas) | huggingface.co/black-forest-labs/FLUX.1-schnell | **Apache 2.0** | tous runtimes | T2I | 2024, stable, écosystème énorme | GGUF Q4_K_S ~6,8 Go (+T5 fp8 ou sur CPU) ; 20-30 s/img sur RTX 4060 8 Go | 2 | Très bon, mais 12B → lent en 8 Go ; peu de LoRAs (la plupart visent dev) | Reste une valeur sûre ; Chroma en est dérivé. |
| **FLUX.1 [dev] / Krea-dev / Kontext-dev** (12B) | huggingface.co/black-forest-labs/FLUX.1-dev | **FLUX.1 [dev] Non-Commercial License** (sorties utilisables commercialement, *modèle* non commercial) | tous | T2I / I2I (Kontext) | Très mature | GGUF Q4 ~6,8 Go, 90-150 s/img (20 pas) sur 8 Go avec `--lowvram` ; NF4 ~7-8 Go | 2 | Meilleure bibliothèque de LoRAs pixel art / game assets, mais **licence NC du modèle** | Référence seulement. Intégrer le modèle dans un produit ou service = licence commerciale BFL. |
| **Chroma1-HD / Chroma1-Base / Chroma1-Flash** (8,9B) | huggingface.co/lodestones/Chroma1-HD | **Apache 2.0** | ComfyUI / diffusers / sd.cpp | T2I | Nov. 2025, communauté active | GGUF Q4 ~5-6 Go poids + T5-XXL (fp8 ou CPU) ; HD = 40 pas → lent en 8 Go ; Flash = version few-step | 2 | Dé-distillation de schnell, neutre, conçu comme base de fine-tune ; non censuré | Bonne base *Apache* pour entraîner un LoRA pixel art si Klein/Z-Image déçoivent. |
| **SDXL 1.0 + Lightning / LCM / Hyper-SD** (3,5B UNet) | huggingface.co/ByteDance/SDXL-Lightning | SDXL : **CreativeML OpenRAIL++-M** ; SDXL-Lightning & LCM-LoRA : openrail++ ; Hyper-SD : hérite de la base (OpenRAIL++ pour SDXL/SD1.5, Stability pour SD3, NC pour FLUX) ; **DMD2 : CC-BY-NC 4.0 → non commercial** | tous, ONNX/DirectML/OpenVINO inclus | T2I / I2I / inpaint / ControlNet | Très mature | fp16 ~6-7 Go ; 4 pas ≈ 1-2 s sur RTX 3080 ; GGUF/Q8 via sd.cpp sur CPU/Vulkan | 1 | Le plus grand vivier de LoRAs pixel art (nerijs, Civitai), ControlNet/IP-Adapter complets ; qualité générale datée | **Moteur « itération rapide » pixel art** ; OpenRAIL++ autorise l'usage commercial (avec restrictions d'usage éthique). Éviter DMD2. |
| **SD 1.5 + LCM** (0,86B UNet) | huggingface.co/Comfy-Org/stable-diffusion-v1-5-archive | CreativeML OpenRAIL-M | tous, CPU inclus | T2I / I2I | Ancien | 2-4 Go ; 512² LCM 4 pas ≈ 30-60 s sur CPU | 1 | Qualité faible sauf avec checkpoints pixel-art dédiés ; 512² natif convient aux sprites | Profil « CPU / 4 Go ». |
| **Stable Diffusion 3.5 Medium** (2,5B MMDiT-X) | huggingface.co/stabilityai/stable-diffusion-3.5-medium | **Stability AI Community License** (gratuit < 1 M$ de CA annuel, sinon licence entreprise) | diffusers / ComfyUI / sd.cpp | T2I | 2024, peu d'écosystème | 9,9 Go hors encodeurs à pleine perf ; RTX 4060 8 Go ~40 s/img (28 pas) avec offload | 2 | Correct, texte OK, mais dépassé par Z-Image/Klein ; licence à seuil | Non prioritaire. |
| **Qwen-Image / -2512 / -Edit-2509/2511 / -Layered / -2.0** (20B MMDiT) | github.com/QwenLM/Qwen-Image | **Apache 2.0** | diffusers / ComfyUI / Nunchaku / DiffSynth / sd.cpp / mflux | T2I + I2I (Edit multi-images) + génération **par calques** (Layered) | Famille très active (2.0 : févr. 2026) | fp8 ≈ 20 Go ; GGUF Q4_K_S ≥ 8 Go conseillé (77 s/img sur 4090D !) ; **Nunchaku INT4 + offload async : ~3 Go** ; DiffSynth « layer-by-layer offload : inférence en 4 Go » (lent) | 3 | Meilleur ouvert pour texte/UI et édition instructive ; Qwen-Image-Layered = calques RGBA séparés, très intéressant pour les assets | Faisable en 8 Go **uniquement via Nunchaku (NVIDIA ≥ Turing) ou offload agressif** ; sinon → API (fal : 0,02 $/Mpx). |
| **Lumina-Image 2.0** (2,6B) | huggingface.co/Alpha-VLLM/Lumina-Image-2.0 | **Apache 2.0** | diffusers / ComfyUI | T2I | 2025, calme | ~8-10 Go bf16 (encodeur Gemma-2-2B) ; quantifiable | 3 | Bon rapport taille/qualité, peu de LoRAs | Alternative Apache légère. |
| **Kolors** (UNet SDXL-like, encodeur ChatGLM-6B) | huggingface.co/Kwai-Kolors/Kolors | Apache 2.0 (tag HF) | diffusers / ComfyUI | T2I | 2024 | ~10 Go bf16, encodeur lourd | 3 | Chinois/anglais, esthétique | Non prioritaire. |
| **CogView4-6B** | github.com/zai-org/CogView4 | **Apache 2.0** | diffusers | T2I | 2025 | 13-14 Go avec CPU offload + encodeur GLM-4-9B en 4 bits ; 32 Go RAM conseillés | 3 | Hors budget 8 Go sans quantification lourde | Écarté. |
| **Sana 1.0 / 1.5 / Sana-Sprint** (0,6B-4,8B, DC-AE 32×) | github.com/NVlabs/Sana | Code Apache 2.0 ; **poids : « NVIDIA License » (NSCL v2-custom) = usage non commercial, recherche/évaluation uniquement** + Gemma Terms (encodeur Gemma-2-2B) ; le tag YAML `apache-2.0` de certaines fiches diffusers contredit le LICENSE.txt | diffusers / ComfyUI / Nunchaku | T2I | Actif (Sprint 1-4 pas : 0,31 s sur 4090 ; 4K possible) | 4 bits « < 8 Go sur laptop » | 2 | Techniquement idéal (très rapide, petit) mais **licence poids NC** | Référence uniquement, sauf clarification NVIDIA. |
| **PixArt-Σ** (0,6B) | huggingface.co/PixArt-alpha/PixArt-Sigma-XL-2-1024-MS | openrail++ | diffusers / Nunchaku | T2I | 2024 | ~6-8 Go avec T5 fp8 | 2 | Dépassé | Non prioritaire. |
| **HiDream-I1 Full/Dev/Fast** (17B) | huggingface.co/HiDream-ai/HiDream-I1-Full | **MIT** | ComfyUI / diffusers | T2I | 2025 | fp8 16 Go ; GGUF Q4 ~12 Go ; Q2 ~8 Go ; 4 encodeurs dont Llama-3.1-8B | 4 | Excellent mais irréaliste en 8 Go (Q2 dégrade fort) | → API ou GPU 16 Go+. |
| **HunyuanImage 2.1** (17B, 2K natif) / **3.0** (84B MoE) | huggingface.co/tencent/HunyuanImage-2.1 | **Tencent Hunyuan Community License : territoire = monde *sauf UE, UK, Corée du Sud*** ; 100 M MAU | ComfyUI / diffusers | T2I | Actif | 2.1 : 24 Go min avec fp8 + offload ; 3.0 : ~160-180 Go | 5 | Inutilisable juridiquement depuis la France | Référence. |
| **FLUX.2 [dev]** (32B) | huggingface.co/black-forest-labs/FLUX.2-dev | FLUX Non-Commercial | diffusers (4 bits + encodeur distant sur 4090) | T2I / I2I multi-réf | Nov. 2025 | ≥ 20 Go même en 4 bits | 5 | Hors sujet en local | → API FLUX.2 pro/flex. |
| **NitroFusion / NitroSD** (SDXL 1 pas) | github.com/ChenDarYen/NitroFusion | **MIT** (code + poids Realism/Vibrant) | diffusers | T2I | 2024-2025 | ~6-7 Go (UNet SDXL) ; 1 pas | 2 | Qualité 1 pas honnête, style réaliste/vibrant | Utile pour prévisualisations instantanées. |

**Comparaison et recommandation.** En septembre 2026, trois modèles Apache 2.0 couvrent 90 % des besoins en 8 Go :

- **FLUX.2 klein 4B** — la révolution de janvier 2026 : 4B, 4 pas, T2I *et* édition multi-références dans un seul modèle, ~8 Go en fp8 dans ComfyUI, ~3 Go de poids en GGUF Q4 (le reste étant l'encodeur Qwen3-4B et le VAE) ; un LoRA « 2×2 sprite sheet » Apache existe déjà chez fal. C'est le moteur par défaut à retenir pour l'HD et pour la **cohérence de personnage** (référence → variations, poses, équipements).
- **Z-Image-Turbo 6B** — la meilleure qualité brute par Go ; GGUF Q4 tient en 5-6 Go, ~20 s/img sur une 3080 laptop, 2-3 s sur 4090. À utiliser pour les illustrations, splash, textures « detailed ». Son écosystème LoRA (DiffSynth, ai-toolkit) est jeune mais la version Base non distillée (janv. 2026) permet l'entraînement.
- **SDXL + Lightning/LCM + LoRAs pixel art** — reste le meilleur outil pour le pixel art *stylisé rapide* (1-2 s/img sur 3080) grâce à des années de LoRAs, ControlNet (pose, canny, tile) et IP-Adapter ; et c'est le seul du trio à tourner correctement via ONNX/DirectML/OpenVINO et sur CPU.

Qwen-Image (20B) n'est faisable en 8 Go que via **Nunchaku SVDQuant INT4** (3-12 Go, NVIDIA ≥ RTX 20xx uniquement) ; sa variante **Qwen-Image-Layered** (calques RGBA) est stratégiquement intéressante pour les assets et mérite un chemin « Nunchaku si dispo, sinon API ». FLUX.1 dev, Sana, HunyuanImage et FLUX.2 dev/klein 9B sont exclus par leur licence ou leur taille ; HiDream (MIT) par sa taille.

### 2.2 Problème 2 — Pixel art / game assets : modèles, LoRAs, post-traitement

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Intég. | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **pixel-art-xl (nerijs)** | huggingface.co/nerijs/pixel-art-xl | Fiche HF : CreativeML OpenRAIL-M ; **mais l'auteur évoque une « licensing fee » pour usage commercial dans les discussions** → ambigu | LoRA SDXL | LoRA pixel art | 2023, très utilisé | +~100 Mo ; LCM 8 pas, guidance 1.5, poids 1.2 | 1 | Style pixel art crédible, à downscaler ×8 en nearest ; pas de trigger word | À contacter avant usage commercial ; sinon entraîner le nôtre. |
| **Pixel Art Diffusion XL – Sprite Shaper** (Civitai) | civitai.com/models/277680 | OpenRAIL++-M **+ clause auteur : redistribution hors Civitai et vente d'images interdites sans accord écrit** | Checkpoint SDXL | Checkpoint pixel art | 2024 | ~6,5 Go | 1 | Bon sur sprites/items | **À exclure** d'une app distribuée. |
| **Flux-2D-Game-Assets-LoRA / -v2 (gokaygokay)** | huggingface.co/gokaygokay/Flux-2D-Game-Assets-LoRA | LoRA : **Apache 2.0** ; base FLUX.1-dev : NC | LoRA FLUX.1 dev | Items/personnages pixel art fond blanc, trigger `GRPZA` | 2024 | Base 12B NC | 2 | Très bons items ; inutilisable commercialement à cause de la base | Ré-entraîner l'équivalent sur Klein 4B Base / Chroma. |
| **flux-2-klein-4b-spritesheet-lora (fal)** | huggingface.co/fal/flux-2-klein-4b-spritesheet-lora | **Apache 2.0** (LoRA et base) | LoRA FLUX.2 klein 4B | Sprite sheet 2×2 (4 angles : iso avant-droite/gauche, profil, top-down), fond rouge uni, trigger `2x2 sprite sheet` | Jan.-févr. 2026 | idem Klein 4B | 1 | Entraîné sur 48 paires, surtout véhicules ; prouve la faisabilité multi-vues sur Klein | Modèle de ce qu'on peut entraîner nous-mêmes (48 images suffisent). |
| **Retro-Pixel-Flux-LoRA (prithivMLmods), Modern_Pixel_art (UmeAiRT), flux-lora-spritesheet (Mystic07), pixel-art-lora (Limbicnation)** | huggingface.co | Diverses (souvent Apache/CC pour le LoRA), base FLUX.1 dev NC | LoRA FLUX.1 dev | Pixel art | 2024-2025 | 12B | 2 | Référence de prompts/datasets | Idem : base NC. |
| **PixelWave FLUX.1-schnell 04 / dev 03** | huggingface.co/mikeyandfriends/PixelWave_FLUX.1-schnell_04 | schnell : Apache 2.0 ; dev : NC | Checkpoint 12B | **Pas du pixel art** : fine-tune esthétique généraliste | 2024-2025 | GGUF Q4/Q8 dispo | 2 | Utile pour l'HD stylisé, pas pour les sprites | Faux ami de nommage. |
| **Retro Diffusion (Astropulse)** | retrodiffusion.ai | **Propriétaire** (modèle Gumroad/itch, API payante, extension Aseprite) | — | Modèle pixel art SD-based | Leader du marché | — | — | Référence de qualité (palettes, tilesets, animations) | Pièces **ouvertes** publiées par l'auteur : **pixeldetector** (MIT), sd-palettize, K-Centroid (Aseprite, downscale k-means), mixamotoopenpose (poses Mixamo → OpenPose). |
| **pixeldetector** | github.com/Astropulse/pixeldetector | **MIT** (Pillow/NumPy/SciPy) | Python | Détection de la taille de pixel, downscale, réduction de palette | Stable | CPU, ms | 1 | Exactement notre post-traitement « algo local » | À intégrer / réimplémenter dans notre pipeline Pillow+NumPy. |
| **ComfyUI-PixelArt-Detector (dimtoneff)** | github.com/dimtoneff/ComfyUI-PixelArt-Detector | **MIT** | Python (nœuds ComfyUI) | Downscale (quantize, k-means OpenCV, grille), palettes depuis image, dithering | Stable | CPU | 1 | Idées d'algos réutilisables hors ComfyUI | Dépend de pyclustering/OpenCV. |
| **ai-toolkit (ostris)** | github.com/ostris/ai-toolkit | **MIT** | Python | Entraînement LoRA/LoKr : FLUX.1, **FLUX.2 klein Base 4B/9B**, Qwen-Image, Z-Image, SDXL, Chroma1-Base, Wan, LTX-2 | Très actif | Configs de référence 24 Go ; modes low-VRAM (quantification, offload) — SDXL/Klein 4B faisables sur 8-12 Go avec batch 1, fp8/NF4 | 3 | Outil standard 2026 pour créer nos propres LoRAs pixel art / sprite sheet sur base Apache | UI web + CLI. |
| **DiffSynth-Studio (ModelScope)** | github.com/modelscope/DiffSynth-Studio | **Apache 2.0** | Python | Inférence + entraînement (LoRA, full, distillation, FP8, CPU-offload) Qwen-Image, Z-Image, FLUX.2, Wan… ; « Image-to-LoRA » | Très actif | Layer-by-layer offload (Qwen-Image en 4 Go) | 3 | Alternative à diffusers pour les modèles Alibaba/Qwen | Bonne option pour entraîner un LoRA Z-Image sur petit GPU. |

**Comparaison et recommandation — quelle voie réaliste pour la qualité pixel art en local ?**

1. **Le style vient du LoRA, la « pixel-perfection » vient de l'algo.** Tous les retours convergent : générer en 1024² avec un LoRA pixel art, puis **downscaler ×8 en nearest / k-centroid, détecter la grille réelle (pixeldetector), quantifier vers une palette imposée (k-means ou palette fixe type DB32/Endesga), nettoyer les pixels orphelins**. Cette chaîne est 100 % Pillow/NumPy/SciPy (MIT) et coûte des millisecondes sur CPU. C'est ce que fait Retro Diffusion sous le capot (l'auteur l'a open-sourcé), et ce que SpriteCook fait après ses appels Gemini/GPT-Image.
2. **Les LoRAs pixel art existants sont majoritairement sur FLUX.1 dev (NC) ou SDXL (licences Civitai à la carte).** La voie propre est d'**entraîner nos propres LoRAs** (ai-toolkit, MIT) sur **FLUX.2 klein 4B Base (Apache)** — le LoRA sprite-sheet de fal montre que 48 paires suffisent pour une tâche structurée — et/ou sur **SDXL** (OpenRAIL++) pour la vitesse. Un dataset de quelques centaines de sprites sous licence CC0/CC-BY (OpenGameArt, Kenney) + captions automatiques par Florence-2/Qwen3-VL est suffisant.
3. Pour le **multi-vue / sprite sheet cohérent**, le mécanisme d'édition par référence de Klein 4B (ou Qwen-Image-Edit via API/Nunchaku) est bien plus fiable qu'un prompt « sprite sheet » : on génère le personnage de face, puis on demande « same character, side view », « same character, walking pose frame 2 », etc., et on aligne/assemble localement.

### 2.3 Problème 3 — Runtimes / moteurs : embarquer, gérer la mémoire, porter

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU / plateformes | Intég. | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **ComfyUI** (headless, API HTTP `/prompt` + WebSocket `/ws`, `/history`, `/view`, `/upload/image`, nœud `SaveImageWebsocket`) | github.com/comfyanonymous/ComfyUI | **GPL-3.0** | Python | Serveur de workflows | Référence de l'écosystème ; supporte SD1.5/SDXL/SD3.5, FLUX.1/2, Qwen-Image, Z-Image, HunyuanImage 2.1, HiDream, Lumina 2, Chroma, Krea 2, Ideogram 4… | NVIDIA (CUDA 13), AMD ROCm 7.2 (Linux ; RDNA3/4 expérimental), Intel XPU, Apple MPS, Ascend ; flags `--lowvram`, `--novram`, `--cpu`, `--reserve-vram`, GGUF via ComfyUI-GGUF, Nunchaku via ComfyUI-nunchaku | 2 (process séparé) / 5 (in-process) | Tout y arrive en premier (nouveaux modèles, quantifs) ; gestion mémoire dynamique excellente ; mais GPL → **à lancer comme processus externe** piloté par httpx/websockets, jamais importé | Modèle « moteur optionnel » : l'app détecte ou installe un ComfyUI portable et envoie des workflows JSON (format API). |
| **diffusers (+ accelerate, bitsandbytes, torchao, optimum-quanto, gguf)** | github.com/huggingface/diffusers | **Apache 2.0** | Python | Bibliothèque in-process | Très mature ; Z-Image, FLUX.2, Qwen-Image, Chroma, Sana… intégrés | `enable_model_cpu_offload`, `enable_sequential_cpu_offload` (Z-Image : **1,86 Go** VRAM mais 16 s), **group offloading** block/leaf + `use_stream` (Z-Image leaf+stream : **6,6 Go**, 16 s), `enable_layerwise_casting` fp8, VAE slicing/tiling, GGUF Q4_K_M + encodeur 4 bits + offload : **6,4 Go** | 1-2 | Le plus naturel dans FastAPI ; NVIDIA d'abord, ROCm Linux OK, MPS Mac lent, pas de Vulkan/DirectML | **Moteur par défaut in-process** pour le profil NVIDIA ; charger/décharger via un gestionnaire de modèles. |
| **stable-diffusion.cpp** (+ binding `stable-diffusion-cpp-python`) | github.com/leejet/stable-diffusion.cpp | **MIT** (binding MIT) | C/C++ (ggml) ; Python via ctypes | Moteur autonome | Très actif 2026 : SD1/2/XL/3.5, FLUX.1 (dev/schnell/fill), **FLUX.2 klein**, Chroma, **Z-Image**, **Qwen-Image**, Wan, LTX ; LoRA, ControlNet, img2img, inpaint, PhotoMaker, ESRGAN, TAESD, flash-attention, VAE tiling ; C API, serveur, UI | **CUDA, Vulkan, Metal, ROCm/HIP, SYCL, OpenCL, CPU (AVX2/512)** ; GGUF Q4_K/Q8 ; flash-attn économise 0,6-1,4 Go | 2 | Portabilité imbattable (AMD Windows via Vulkan, Mac, CPU) ; plus lent que PyTorch+CUDA sur NVIDIA ; LoRA incompatible avec certains poids quantifiés ; moins de ControlNet/IP-Adapter récents | **Moteur du profil « petit GPU / CPU / AMD »** ; wheels à builder par backend. |
| **Nunchaku (SVDQuant INT4/FP4/NVFP4)** | github.com/nunchaku-ai/nunchaku | **Apache 2.0** | Python/CUDA | Kernels 4 bits + modèles pré-quantifiés | v1.2.0 (12 janv. 2026) : FLUX.1 (dev/schnell/Krea/Kontext/tools), Qwen-Image (+Edit 2509, Lightning), **Z-Image-Turbo**, SANA, PixArt-Σ, T5 4 bits ; LoRA natif | NVIDIA seulement : INT4 dès **Turing (RTX 20xx)**, FP4 Ampere+, NVFP4 Blackwell ; FLUX.1 6-17 Go, Qwen-Image 3-12 Go (offload async ~3 Go), 3-10× plus rapide que bf16 | 3 | La seule façon d'avoir Qwen-Image 20B ou FLUX.1 12B rapides en 8 Go ; wheels sensibles aux versions torch/CUDA | Plug-in « accélérateur NVIDIA » optionnel, via diffusers ou ComfyUI. |
| **mflux** (MLX) | github.com/mflux-community/mflux | **MIT** | Python (MLX) | Moteur Apple Silicon | Actif : FLUX.1, **FLUX.2 klein 4B/9B**, **Z-Image**, Krea 2, Qwen-Image, Ideogram 4, FIBO, SeedVR2 (upscale) ; quantif 3/4/6/8 bits ; LoRA, ControlNet, img2img, in-context editing | Mac M-series, mémoire unifiée | 2 | Meilleure expérience Mac ; Z-Image Turbo sur M4 Pro ≈ 14-26 s/it (lent) | **Moteur du profil Mac**. DiffusionKit (argmax) est l'alternative Swift. |
| **DiffSynth-Studio** | github.com/modelscope/DiffSynth-Studio | Apache 2.0 | Python | Bibliothèque (inférence + training) | Actif | Offload couche par couche (Qwen-Image en 4 Go), NF4/INT8 | 2 | Surtout modèles Alibaba ; API moins standard que diffusers | Complément pour Qwen/Z-Image + entraînement. |
| **InvokeAI** | github.com/invoke-ai/InvokeAI | **Apache 2.0** (+ licences modèles) | Python/React | Application + serveur | Mature ; SD1.5/SDXL/SD3.5, FLUX.1 dev/schnell/Kontext/Krea/Fill, **FLUX.2 dev/klein 4B/9B**, **Z-Image Turbo/Base**, + connecteurs API (Nano Banana, GPT Image) | NVIDIA/AMD/Mac | 3 | Excellent canvas/inpaint ; API REST interne mais lourde à piloter | Source d'inspiration UX (canvas, calques) plutôt que moteur. |
| **SD.Next** | github.com/vladmandic/sdnext | **Apache 2.0** | Python | Application + API | Actif | CUDA, ROCm, **ZLUDA (AMD Windows), DirectML, OpenVINO, IPEX, MPS, CPU** ; « Balanced offload » ; quantification maison SDNQ (≈4× moins de VRAM) | 3 | Couverture matérielle la plus large côté PyTorch ; lourd | Référence pour la stratégie multi-backend. |
| **Forge** | github.com/lllyasviel/stable-diffusion-webui-forge | **AGPL-3.0** | Python | Application | Peu maintenu (2024) ; NF4/GGUF FLUX, curseur « GPU weights », offload async | NVIDIA | 4 | À oublier (AGPL + stagnation) | Référence historique des techniques low-VRAM. |
| **SwarmUI** | github.com/mcmonkeyprojects/SwarmUI | **MIT** (mais backend ComfyUI GPL) | C#/JS | Front + orchestrateur multi-GPU | Actif | Idem ComfyUI | 4 | Montre comment piloter ComfyUI comme backend sans en hériter la licence | Référence d'architecture. |
| **ONNX Runtime + DirectML (Olive)** | onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html | MIT | C++/Python | Runtime Windows tout GPU DX12 | **DirectML en « sustained engineering » (plus de nouvelles fonctions), Microsoft renvoie vers Windows ML** ; SD1.5/SDXL/LCM via Olive | AMD/Intel/NVIDIA Windows | 4 | Convient à SD1.5/SDXL seulement ; export ONNX par modèle, formes statiques | Peu d'avenir → préférer sd.cpp/Vulkan pour AMD Windows. |
| **OpenVINO GenAI** | github.com/openvinotoolkit/openvino.genai | Apache 2.0 | C++/Python | Runtime Intel CPU/GPU/NPU | Text2Image/Image2Image/Inpainting pour SD et FLUX | CPU x86, iGPU/Arc, NPU | 3 | Bon pour CPU Intel et laptops sans GPU dédié ; conversion de modèles nécessaire | Option « CPU Intel » si sd.cpp ne suffit pas. |

**Comparaison et recommandation.** Adopter une **architecture à trois moteurs derrière une interface unique** :

1. **diffusers in-process (Apache)** = moteur primaire NVIDIA ; contrôle total de la mémoire (group offload, fp8 casting, GGUF, Nunchaku en option), même processus que FastAPI (attention au GIL : exécuter les jobs dans un worker/process dédié).
2. **stable-diffusion.cpp via son binding Python (MIT)** = moteur de portabilité (Vulkan pour AMD/Intel sous Windows, ROCm/HIP Linux, Metal, CPU) ; même formats GGUF que le profil NVIDIA, donc un seul cache de modèles.
3. **ComfyUI comme backend externe optionnel (GPL, piloté par HTTP/WS)** pour les utilisateurs avancés et les workflows exotiques (nouveaux modèles le jour J, nœuds communautaires) — jamais importé dans notre code, ce qui neutralise la contamination GPL (exactement le modèle de SwarmUI, MIT).

Sur Mac, mflux (MIT) remplace diffusers si les performances MPS sont insuffisantes. DirectML est en fin de vie : ne pas y investir.

### 2.4 Problème 4 — Faire tenir en VRAM et générer des planches larges

| Technique | Où | Licence | Gain typique | Coût | Notes |
|---|---|---|---|---|---|
| **Quantification GGUF Q8/Q5/Q4_K** du transformer | ComfyUI-GGUF, diffusers `GGUFQuantizationConfig`, sd.cpp | Apache/MIT | 12B → ~6,8 Go (Q4), 6B → 3-4 Go | Q4 : perte de détail fin ; Q8 quasi sans perte ; vitesse ≈ bf16 (déquant à la volée) | Bench Z-Image : Q3/Q4/Q5 ne changent la vitesse que de 5-10 % → prendre le Q le plus haut qui tient. |
| **NF4 (bitsandbytes)** | diffusers, Forge | MIT | ×4 mémoire | Légèrement plus lent, NVIDIA (ROCm partiel) | Le classique FLUX-NF4 8 Go. |
| **fp8 (e4m3) / layerwise casting** | diffusers `enable_layerwise_casting`, ComfyUI `fp8_e4m3fn` | Apache | ×2 mémoire, quasi sans perte | Calcul natif fp8 seulement Ada/Blackwell ; sinon stockage fp8 + calcul bf16 | Klein 4B fp8 = 8,4 Go pic dans ComfyUI. |
| **SVDQuant INT4 (Nunchaku)** | Nunchaku | Apache 2.0 | ×3,5 mémoire **et** 3-10× vitesse | NVIDIA ≥ Turing ; modèles pré-quantifiés seulement | Qwen-Image en ~3 Go avec offload async. |
| **Encodeur texte quantifié ou sur CPU** | tous | — | T5-XXL fp16 = 9 Go → fp8 4,7 Go / GGUF Q4 ~2,5 Go ; Qwen3-4B idem | Encodage sur CPU = quelques secondes, une fois par prompt | **Règle d'or 8 Go** : l'encodeur ne vit jamais sur le GPU en même temps que le transformer ; on encode, on libère, on diffuse. Mettre en cache les embeddings par prompt. |
| **CPU offload séquentiel / model offload / group offload (block, leaf, stream)** | diffusers, ComfyUI (`--lowvram`), DiffSynth | Apache | Z-Image : 24,9 Go → 13,5 (model offload) → 6,6 (leaf+stream) → 1,9 Go (sequential) | +20 à +130 % de temps ; **exige beaucoup de RAM** (21-42 Go dans les benchs !) et PCIe rapide | Sur 8 Go + 16 Go de RAM : préférer GGUF Q4 + encodeur CPU à l'offload séquentiel. |
| **VAE slicing / tiling** | diffusers `enable_vae_tiling`, sd.cpp `--vae-tiling`, TAESD | Apache/MIT | Décodage 2048² sans pic | Légères coutures (rares) | Toujours activé au-dessus de 1 Mpx. TAESD pour les aperçus. |
| **SDPA / FlashAttention / xformers** | PyTorch ≥ 2.x natif | BSD | -30 % mémoire attention | — | xformers devenu inutile avec SDPA. |
| **torch.compile / FBCache / TeaCache / TaylorSeer** | diffusers, cache-dit, ComfyUI | Apache | 1,3-2× vitesse | Compilation 1-3 min au premier run ; caches ≈ perte de détails | Activer par défaut sur profil NVIDIA fixe (formes constantes). |
| **Distillation few-step** (Lightning, LCM, Hyper-SD, Turbo, Klein/Z-Turbo natifs) | LoRAs | voir §2.1 | 20-50 pas → 4-8 pas | Moins de diversité, CFG figé | Le levier n°1 sur petit GPU : la VRAM ne change pas, le temps est divisé par 5. |
| **Tiled diffusion (MultiDiffusion / Mixture of Diffusers)** | github.com/albarji/mixture-of-diffusers (**MIT**, SD1.x) ; pipelines communautaires diffusers `mixture_tiling` / `mixture_canvas` (Apache) ; **ComfyUI-TiledDiffusion : code de tiling CC-BY-NC-SA 4.0 + GPLv3 → à ne pas embarquer** | Python | Génère des planches 2048×512 (tileset, parallax) en VRAM de 1 Mpx, avec un prompt par région | Coutures si chevauchement insuffisant ; ×N temps | Réimplémenter MultiDiffusion (algo simple : moyenne pondérée gaussienne des prédictions de bruit par tuile) dans notre code — 150 lignes avec diffusers. |
| **ControlNet Tile / upscale par tuiles** | SDXL ControlNet Tile, ESRGAN (sd.cpp, spandrel) | OpenRAIL++/MIT | Détail HD sans VRAM | — | Pour le rendu « detailed » : générer 1024², upscaler ×2 par tuiles. |

**Recommandation.** Le budget mémoire d'une génération 1024² sur 8 Go doit être planifié comme : transformer quantifié (≤ 5 Go) + activations (1-2 Go) + VAE tiled (< 1 Go) ; encodeur texte en phase séparée (GPU puis libération, ou CPU) ; VLM/scoring chargés après déchargement du transformer. Il faut un **« VRAM budgeter »** qui choisit automatiquement le niveau de quantification et le mode d'offload selon `torch.cuda.mem_get_info()` et la RAM disponible.

### 2.5 Problème 5 — Image-to-text / VLM locaux légers et LLM texte

| Nom | URL | Licence | Taille | Type | Maturité | VRAM | Intég. | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Florence-2 base / large** | huggingface.co/microsoft/Florence-2-large | **MIT** | 0,23B / 0,77B | Caption (court/détaillé), détection d'objets, OCR, grounding, segmentation par prompt-tâche | Stable (2024) | < 2 Go fp16, tourne sur CPU | 1 | Descriptions factuelles, pas de « raisonnement » ni de question libre | **Analyseur par défaut** : captions de dataset, bounding boxes de sprites, OCR d'UI. |
| **Moondream 2** | huggingface.co/vikhyatk/moondream2 | **Apache 2.0** | ~1,9B | VQA, caption, pointing, détection | Stable | ~4 Go fp16, GGUF dispo | 1 | Bon compromis ; Moondream 3 preview (9B MoE, 2B actifs, 32K ctx) est sous **Business Source License 1.1** (interdit de vendre une API concurrente ; usage in-app OK) | Moondream 2 pour la distribution ; 3 en option. |
| **Qwen3-VL 2B / 4B / 8B (Instruct / Thinking)** | huggingface.co/Qwen/Qwen3-VL-4B-Instruct | **Apache 2.0** (toute la famille 3) | 2-8B | VQA, grounding 2D/3D, OCR 32 langues, agent GUI, ctx 256K | Oct. 2025, très actif ; GGUF/Ollama (`qwen3-vl` 2b-235b) | 2B : ~3 Go Q4 ; 4B : ~4-5 Go Q4 ; 8B : ~6-7 Go Q4 | 1 (Ollama) / 2 (transformers) | **Meilleur VLM-juge ouvert par Go** ; attention : **Qwen2.5-VL-3B est sous « Qwen Research License » (NC)** — seuls 7B/72B de la gen 2.5 sont Apache | VLM-as-judge et description de références. |
| **SmolVLM2 256M / 500M / 2.2B** | huggingface.co/HuggingFaceTB/SmolVLM2-2.2B-Instruct | **Apache 2.0** | 0,26-2,2B | Image + vidéo, captions | 2025 | 2.2B : 5,2 Go (vidéo) ; 500M < 2 Go | 1 | Moins précis que Qwen3-VL ; 256M tourne partout | Fallback CPU. |
| **MiniCPM-V 4.5 (8,7B) / 4.6 (1B)** | huggingface.co/openbmb/MiniCPM-V-4_5 | **Apache 2.0** | 1B / 8,7B | Image HD (1,8 Mpx), vidéo, OCR, « thinking » | Actif ; GGUF/int4/AWQ ; Ollama | 4.5 int4 ≈ 6 Go ; 4.6 1B ≈ 1-2 Go | 1-2 | 4.5 très fort en OCR ; 8,7B lourd en cohabitation | Alternative à Qwen3-VL. |
| **InternVL3.5 4B** | huggingface.co/OpenGVLab/InternVL3_5-4B | Apache 2.0 | 4B | VQA/grounding | 2025 | ~5 Go Q4 | 2 | Comparable Qwen3-VL-4B | Alternative. |
| **PaliGemma 2 3B/10B/28B** | huggingface.co/google/paligemma2-3b-pt-448 | **Gemma Terms of Use** (usage permis avec politique d'usage interdit ; pas OSI) | 3B | Modèle de base à fine-tuner (détection, segmentation, caption) | 2024-2025 | ~6 Go bf16 | 3 | Excellent à fine-tuner pour une tâche fixe (ex. classifier des sprites), médiocre zero-shot | Réservé au fine-tune. |
| **Gemma 3 / Gemma 4 (4B+)** | ollama.com/library | Gemma Terms | 4-12B+ | Multimodal généraliste | 2025-2026 | 4B Q4 ≈ 3-4 Go | 1 | Bon, mais licence Google non-OSI | Option. |
| **LLaVA 1.5/1.6** | github.com/haotian-liu/LLaVA | Code Apache 2.0 ; poids liés à Llama 2/Vicuna | 7-13B | VQA | Legacy | 7B Q4 ≈ 5 Go | 1 | Dépassé par Qwen3-VL | Référence. |
| **LLM texte : llama.cpp / Ollama** (Qwen3 4B-8B, Gemma, Llama 3.x, Mistral) | github.com/ggml-org/llama.cpp ; ollama.com | **MIT** (runtimes) ; modèles Apache (Qwen3) / Gemma Terms / Llama License | 1-8B | Réécriture de prompts, génération de variantes, JSON structuré | Mature | Q4 : 1-6 Go, CPU OK | 1 | Ollama = serveur HTTP local trivial à appeler via httpx ; le même serveur sert les VLM (`qwen3-vl`, `minicpm-v`) | **Adopter Ollama comme « backend LLM/VLM » optionnel + fallback transformers/llama-cpp-python embarqué.** |

**Recommandation.** Deux niveaux : **Florence-2 large (MIT, < 2 Go)** toujours disponible pour les tâches déterministes (caption, boîtes, OCR), et **Qwen3-VL 2B/4B (Apache)** via Ollama ou llama-cpp-python pour le jugement et les descriptions riches. Toujours décharger le modèle de diffusion avant de charger le VLM sur 8 Go (ou faire tourner le VLM sur CPU : 4B Q4 ≈ 5-10 tokens/s, acceptable pour un jugement de 50 tokens).

### 2.6 Problème 6 — Scoring automatique de qualité pour trier des variations

| Nom | URL | Licence | Backbone / taille | Ce qu'il mesure | VRAM | Intég. | Limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **ImageReward** | github.com/THUDM/ImageReward | **Apache 2.0** | BLIP (~0,5B) | Préférence humaine prompt↔image (137k comparaisons) | ~2 Go, CPU OK | 1 (`pip install image-reward`) | Entraîné sur SD 1.x-era, biais photo/illustration | Le plus utilisé pour le rerank. |
| **PickScore v1** | huggingface.co/yuvalkirstain/PickScore_v1 | MIT (dépôt GitHub) ; non renseigné sur HF | CLIP ViT-H (1,0B) | Préférence Pick-a-Pic | ~2,5 Go | 1 (transformers) | Idem biais ; ViT-H lourd | Bon complément. |
| **HPSv2 / v2.1** | github.com/tgxs002/HPSv2 | **Apache 2.0** | CLIP-H fine-tuné, HPD v2 (798k comparaisons) | Préférence humaine | ~2,5 Go | 1 (`pip install hpsv2`) | v2.1 (2024) meilleure | Standard des papiers. |
| **Aesthetic Predictor V2.5** | github.com/discus0434/aesthetic-predictor-v2-5 | **AGPL-3.0** → contamination pour une app distribuée | SigLIP | Score esthétique 1-10 (photo + illustration) | ~1,5 Go | 1 | Licence | Préférer LAION aesthetic v2 (MIT, CLIP ViT-L) ou ré-entraîner une tête linéaire sur SigLIP. |
| **CLIP score (open_clip / SigLIP2)** | github.com/mlfoundations/open_clip | MIT / Apache | ViT-B/L | Similarité prompt↔image, image↔référence | < 1 Go | 1 | Mesure l'alignement, pas la beauté | Essentiel pour « ressemble à la référence » et la cohérence entre frames d'un sprite sheet. |
| **VLM-as-judge (Qwen3-VL 4B)** | voir §2.5 | Apache 2.0 | 4B | Grille de critères en JSON (lisibilité, respect du style pixel, fond propre, membres cohérents) | 4-5 Go | 2 | 1-3 s par image ; non déterministe | Le seul capable de juger des critères *métier* (ex. « les pixels sont-ils alignés ? », « le personnage est-il entier ? »). |
| **Métriques pixel art maison** (algo) | à écrire | — | NumPy | Nombre de couleurs, régularité de la grille, ratio de pixels orphelins, symétrie, alpha propre | 0 | 1 | Déterministe, gratuit | Doit passer *avant* les modèles : filtre 80 % des rebuts. |

**Recommandation.** Pipeline de tri en cascade : (1) métriques algorithmiques (grille, palette, alpha, taille du bounding box) ; (2) CLIP/SigLIP score vs prompt et vs référence ; (3) ImageReward ou HPSv2 pour l'esthétique générale ; (4) Qwen3-VL en juge final sur les 2-3 meilleurs seulement. Tout cela tient en < 3 Go et peut tourner sur CPU pendant que le GPU génère la variation suivante.

### 2.7 Problème 7 — Modèles « gros » et briques hybrides : état des API image (2026)

Propriétaires, cités comme référence et comme cible d'appel payant. Prix publics au 2 sept. 2026 (ordre de grandeur, hors taxes).

| Fournisseur / modèle | Accès | Prix indicatif | I2I / références | Notes |
|---|---|---|---|---|
| **Google Gemini 3.1 Flash Image (« Nano Banana 2 »)** | API Gemini directe ; OpenRouter | 0,045 $ (0,5K) / **0,067 $ (1K)** / 0,101 $ (2K) / 0,151 $ (4K) par image ; batch ≈ ½ prix | Oui, multi-images, édition conversationnelle | Le modèle des générateurs SpriteCook-like ; pas de free tier. |
| **Gemini 3.1 Flash Lite Image (« Nano Banana 2 Lite »)** | idem | **0,0336 $ / image 1K** (batch 0,0168 $) | Oui | Le moins cher du marché pour l'itération. |
| **Gemini 3 Pro Image (« Nano Banana Pro »)** | idem | 0,134 $ (1K-2K) / 0,24 $ (4K) ; batch/flex ½ | Oui, jusqu'à 14 références | Qualité max, texte/UI. |
| **Gemini 2.5 Flash Image (« Nano Banana » v1)** | API + OpenRouter `google/gemini-2.5-flash-image` | ≈ 0,039 $ / image (1290 tokens × 30 $/M) ; fal 0,0398 $ | Oui | Toujours dispo, remplacé par 3.1. |
| **OpenAI GPT-Image-2** (sorti 24 juin 2026) / **GPT-Image-1.5 / 1 / 1-mini** | Images API ; OpenRouter `openai/gpt-image-2` | Tokens : 5 $/M texte in, 8 $/M image in, **30 $/M image out** → ~0,13 $ pour 1536×864 (exemple OpenRouter) ; GPT-Image-1 ≈ 0,01 / 0,04 / 0,17 $ (low/medium/high 1024²) | Oui (edit, masques, références) | Fort sur UI kits et texte ; le plus cher en « high ». |
| **BFL FLUX.2 [pro] / [flex] / FLUX.1 Kontext pro** | api.bfl.ai ; OpenRouter `black-forest-labs/flux.2-pro` ; fal | FLUX.2 pro : **0,03 $ premier Mpx + 0,015 $/Mpx** (in 0,015 $/Mpx) ; Kontext Pro (fal) 0,04 $ | Oui, multi-réf jusqu'à 4 Mpx | Klein 4B/9B et FLUX.2 dev aussi hébergés chez fal/Replicate. |
| **ByteDance Seedream 4.5 / 4** | OpenRouter `bytedance-seed/seedream-4.5` (0,05 $) ; fal 0,03 $ | | Oui | Bon rapport qualité/prix. |
| **Qwen-Image / -Edit (Alibaba)** | fal (0,02 $/Mpx), Replicate, DashScope | | Oui | Le même modèle Apache que le local → **bascule transparente local ↔ API**. |
| **Z-Image-Turbo** | fal, Replicate | ~0,005-0,01 $ | — | Idem : identique au local. |
| **FLUX.1 schnell / dev** | Replicate : **3 $/1000 (0,003 $)** ; dev 0,025 $ ; FLUX 1.1 pro 0,04 $ | | dev : Kontext | schnell = même modèle Apache que le local. |
| **Recraft V4 (raster/vector)** | OpenRouter 0,035-0,12 $ | | Oui | **Sortie SVG** (icônes, UI) — unique. |
| **Meta Muse Image** | OpenRouter 0,01 $ | | Oui | Nouveau, à évaluer. |
| **GPU à la seconde (Replicate)** | T4 0,000225 $/s ; L40S 0,000975 $/s ; A100 80 Go 0,0014 $/s ; H100 0,001525 $/s | | | Pour faire tourner *nos* workflows ComfyUI/diffusers ponctuellement (LoRA training, Qwen-Image 20B, HiDream). |

**OpenRouter** expose une API unifiée `POST /api/v1/images` (prompt, `input_references` URL/base64, résolution 512-4K, ratio, format PNG/JPEG/WebP/SVG, `n` ≤ 10, facturation « tout ou rien ») couvrant Gemini image, GPT-Image-1/2, FLUX.2 pro, Seedream 4.5, Recraft V4, Muse — un seul client httpx pour tout le profil API. **fal.ai** est le meilleur point d'entrée pour les modèles ouverts (FLUX schnell/dev/Kontext/Klein, Qwen-Image, Z-Image, LoRA training) ; **Replicate** pour du GPU à la seconde.

**Recommandation hybride.** Coût moyen d'un sprite via API : 0,03-0,07 $ (Nano Banana 2 / Seedream / FLUX.2 pro) contre ~0 $ et 5-30 s en local. Le bon découpage : l'API ne produit que l'image « brute » (T2I ou édition par référence) ; analyse (Florence-2/Qwen3-VL), découpe, détection de grille, palette, fond transparent, upscale, animation, scoring, packaging Godot/Unity restent locaux. Comme Qwen-Image, Z-Image et FLUX schnell/Klein existent *à la fois* en local et chez fal/Replicate, on peut offrir « même modèle, exécution locale ou distante » sans changer de prompt ni de post-traitement.

---

## 3. Idées malines / astuces trouvées

1. **Encoder le texte une fois, générer N fois.** Les embeddings (T5/Qwen3) sont indépendants de la graine : encoder sur CPU ou GPU puis libérer l'encodeur, mettre les tenseurs en cache (clé = hash prompt+modèle). Sur 8 Go cela supprime le plus gros pic mémoire et accélère les lots de variations.
2. **Choisir le Q le plus élevé qui tient, pas le plus petit** : le bench Z-Image montre 5-10 % d'écart de vitesse entre Q3, Q4 et Q5 alors que la qualité chute nettement sous Q4. Q5_K_M/Q6_K est le sweet spot 8 Go pour 6B ; Q4_K_M pour 12B.
3. **Générer petit, downscaler propre.** Pour du pixel art 32-64 px, générer à 512-768² (4× moins de VRAM et de temps qu'en 1024²) avec un LoRA pixel art, puis appliquer pixeldetector (détection auto de la taille de pixel) + k-centroid + quantification vers palette imposée. C'est la recette open-sourcée de Retro Diffusion.
4. **Fond uni de couleur improbable** (rouge/magenta/vert) demandé dans le prompt, comme le LoRA sprite-sheet de fal : le détourage devient un simple seuillage chroma-key + nettoyage morphologique, sans modèle de segmentation.
5. **Édition par référence > prompt « sprite sheet ».** Klein 4B (et Qwen-Image-Edit) acceptent plusieurs images de référence : générer le personnage canon, puis demander chaque vue/pose en édition, et assembler la planche localement (alignement par bounding box, grille fixe). Bien plus cohérent qu'une planche générée d'un coup.
6. **Qwen-Image-Layered** produit des calques RGBA séparés (fond / personnage / effets) : idéal pour des assets modulaires — via API (fal 0,02 $/Mpx) ou Nunchaku.
7. **ComfyUI en « side-car » GPL sans contamination** : le pattern SwarmUI (MIT) prouve qu'un front/orchestrateur peut piloter ComfyUI par HTTP/WS en restant sous licence permissive. On livre des workflows JSON (format API) versionnés dans notre dépôt.
8. **Un seul cache GGUF pour trois moteurs** : diffusers (`from_single_file` + `GGUFQuantizationConfig`), sd.cpp et ComfyUI-GGUF lisent les mêmes fichiers city96/leejet → moins de Go téléchargés, bascule NVIDIA ↔ Vulkan ↔ Mac sans re-téléchargement.
9. **Nunchaku dès la RTX 20xx** (INT4 depuis v1.2.0) : sur les GPU 6-8 Go de génération Turing/Ampere, c'est ce qui rend FLUX.1 schnell et Qwen-Image utilisables (3-10× plus rapide que bf16 offloadé).
10. **Tri en cascade gratuit avant les modèles de scoring** : compter les couleurs, mesurer la régularité de la grille, vérifier l'alpha et la boîte englobante élimine la majorité des rebuts en microsecondes ; ImageReward/HPSv2 puis VLM-juge ne voient que les survivants.
11. **Le VLM tourne sur CPU pendant que le GPU génère** : Qwen3-VL-2B/4B Q4 via llama.cpp sur CPU donne 5-10 tok/s, suffisant pour un verdict JSON de 50 tokens, et évite tout va-et-vient de modèles sur 8 Go.
12. **Distillation avant offload** : passer de 28 pas à 4-8 pas (Lightning, LCM, Turbo natif) divise le temps par 5 sans toucher à la VRAM ; l'offload séquentiel, lui, coûte +60-130 % de temps et 20-40 Go de RAM. Sur petite machine, choisir le modèle distillé + GGUF plutôt que le gros modèle offloadé.
13. **Traçabilité des licences dans le gestionnaire de modèles** : chaque entrée du catalogue porte `license_id`, `commercial_ok`, `territory_restrictions`, `derivative_ok` ; un mode « distribution commerciale » masque FLUX dev, Sana, Hunyuan, DMD2, Aesthetic v2.5, etc.
14. **Mixamo → OpenPose** (repo Astropulse mixamotoopenpose) + ControlNet OpenPose SDXL : des séquences de poses d'animation cohérentes pour les sprites de personnages, sans dessiner.

---

## 4. Pipelines d'assemblage recommandés

Interface commune : `ImageBackend.generate(request) -> ImageResult` où `request` contient prompt, négatif, références, taille, pas, graine, LoRAs, contraintes VRAM ; implémentations `DiffusersBackend`, `SdCppBackend`, `ComfyBackend`, `OpenRouterBackend`, `FalBackend`. Un `CapabilityProbe` au démarrage (CUDA ? VRAM libre ? ROCm ? Vulkan ? MPS ? RAM ? CPU AVX2 ?) sélectionne le profil ; l'utilisateur peut forcer.

### Profil A — « 8 Go NVIDIA » (RTX 3060/3070/4060, dev 3080 10 Go)

- **Runtime** : diffusers in-process dans un worker dédié (multiprocessing) ; Nunchaku en option si `compute_capability ≥ 7.5` ; ComfyUI side-car optionnel.
- **Pixel art rapide** : SDXL + SDXL-Lightning 4 pas (ou LCM) + nos LoRAs pixel art maison (entraînés ai-toolkit) ; 768² ; ~1,5-3 s/img sur 3080 ; ControlNet OpenPose/Canny pour poses et silhouettes. Post-traitement local (grille, palette, alpha).
- **HD / « detailed »** : Z-Image-Turbo GGUF Q5_K_M (ou fp8 avec model-offload) 1024², 8 pas, encodeur Qwen3-4B en GGUF Q4 chargé/libéré avant la diffusion ; ~10-20 s/img sur 3060-3080.
- **Cohérence & édition (I2I, multi-vues, variations d'un personnage)** : FLUX.2 klein 4B fp8 (ou GGUF Q6) + LoRA sprite-sheet ; 4 pas ; ~8 Go pic → décharger tout le reste.
- **Gros besoins (Qwen-Image-Layered, HiDream, FLUX.2 pro)** : bascule automatique vers profil C.
- **Analyse / jugement** : Florence-2 large (GPU ou CPU) ; Qwen3-VL-4B Q4 via llama.cpp CPU ou Ollama.
- **Scoring** : métriques algo → SigLIP/CLIP → ImageReward/HPSv2 (CPU) → VLM-juge.
- **Mémoire** : VAE tiling permanent, fp8 layerwise casting, group offload « block » seulement si RAM ≥ 32 Go, TAESD pour les aperçus en direct.

### Profil B — « petit GPU (4-6 Go) / CPU / AMD / Mac »

- **Runtime** : stable-diffusion.cpp via `stable-diffusion-cpp-python` (wheels CUDA/Vulkan/ROCm/Metal/CPU) ; sur Mac Apple Silicon, mflux (MLX) si disponible, sinon sd.cpp Metal.
- **Modèles (GGUF, même cache que A)** : SD1.5 pixel-art checkpoint + LCM (512², 4 pas ; CPU ≈ 30-60 s, GPU 4 Go ≈ 3-5 s) ; SDXL-Lightning Q8 sur 6 Go Vulkan ; Z-Image-Turbo Q3/Q4 sur 6 Go (≈ 40-90 s sur GPU AMD milieu de gamme, plusieurs minutes CPU) ; FLUX.2 klein 4B Q4 sur 6 Go (encodeur Q4 sur CPU).
- **CPU pur** : limiter à SD1.5/LCM 512² et Klein 4B Q4 (minutes) ; proposer d'office le profil C pour l'HD.
- **Analyse** : Florence-2 base (CPU), SmolVLM2-500M ou Qwen3-VL-2B Q4 via llama.cpp CPU.
- **Scoring** : métriques algo + CLIP ViT-B (CPU) ; ImageReward sur CPU (≈ 1 s/img).
- **Ce qui manque** : Nunchaku (NVIDIA only), ControlNet récents pour Klein/Z-Image dans sd.cpp → accepter des fonctions réduites.

### Profil C — « API »

- **Client unique httpx** : OpenRouter `/api/v1/images` (Nano Banana 2 / Lite, GPT-Image-2, FLUX.2 pro, Seedream 4.5, Recraft V4 vecteur) + fal.ai pour les modèles ouverts (Qwen-Image/Edit/Layered, Z-Image, FLUX schnell/dev/Klein, LoRA training) + Replicate GPU-seconde pour exécuter nos workflows ComfyUI (entraînement de LoRA, HiDream, Qwen-Image 20B).
- **Règle** : l'API rend une image brute (PNG, fond chroma-key demandé dans le prompt) ; **tout le post-traitement, l'analyse, le scoring et le packaging sont identiques aux profils A/B** (même code Pillow/NumPy, mêmes VLM légers locaux ou, à défaut, VLM via OpenRouter).
- **Bascule** : chaque `request` porte `preferred_backend` + `fallbacks` ; un job local qui dépasse le budget VRAM ou un time-out (ex. > 120 s) bascule vers l'API si l'utilisateur a une clé et a activé le « mode hybride » ; l'inverse (API en panne/quota → local dégradé) est aussi géré. Les modèles présents à la fois en local et en API (Qwen-Image, Z-Image, FLUX schnell/Klein) permettent une bascule sans changer de prompt.

---

## 5. Ce qu'il faudrait développer soi-même

1. **Couche d'abstraction multi-backend** (`ImageBackend`, `CapabilityProbe`, `VramBudgeter`) : détection matérielle, choix automatique quantification/offload, file de jobs avec worker process (GIL, isolation des crashs CUDA), chargement/déchargement explicite des modèles (encodeur → transformer → VAE → VLM), télémétrie s/img et Go pic par modèle/profil.
2. **Gestionnaire de modèles avec licences** : catalogue JSON (URL HF, SHA, taille, `license_id`, `commercial_ok`, `territory`, `derivative_ok`, formats GGUF/fp8 disponibles, moteurs compatibles), téléchargement `huggingface_hub`, cache unique pour diffusers/sd.cpp/ComfyUI, mode « distribution commerciale » qui filtre FLUX dev/Krea/Kontext, FLUX.2 dev/klein 9B, Sana, Hunyuan, DMD2, LoRAs Civitai restreints.
3. **Pipeline pixel art algorithmique** (Pillow/NumPy/SciPy, MIT) : détection de grille (autocorrélation / pixeldetector), downscale k-centroid, quantification vers palettes (k-means, palette fixe, palette extraite d'une référence), dithering optionnel, nettoyage de pixels orphelins, chroma-key + morphologie pour l'alpha, alignement/centrage des frames, assemblage de sprite sheets et tilesets (avec vérification de raccord de tuiles), métriques de qualité pixel art.
4. **Réimplémentation MIT de MultiDiffusion / Mixture of Diffusers** sur diffusers (Z-Image / Klein / SDXL) pour les planches larges et les tilesets à prompts régionaux, plus VAE tiling maison si besoin ; l'implémentation ComfyUI de référence est CC-BY-NC-SA.
5. **Nos LoRAs Apache** : datasets CC0/CC-BY (Kenney, OpenGameArt) captionnés par Florence-2/Qwen3-VL, entraînement ai-toolkit sur FLUX.2 klein 4B Base (sprite sheet 2×2/4×4, items fond uni, tilesets) et SDXL (pixel art 16/32/64 px), publication sous Apache 2.0 avec datacard.
6. **Prompt templating par modèle** (Klein/Z-Image aiment les phrases longues, SDXL les tags ; injection automatique « solid magenta background, single sprite, centered ») et cache d'embeddings texte.
7. **Cascade de scoring** : métriques algo, CLIP/SigLIP vs prompt et vs référence, ImageReward/HPSv2, VLM-juge avec grille JSON ; interface pour apprendre une tête linéaire « préférence utilisateur » (LAION-style) sur les choix faits dans l'app.
8. **Side-car ComfyUI** : détection/installation d'un ComfyUI portable, bibliothèque de workflows JSON versionnés, client WS avec `SaveImageWebsocket`, mapping des paramètres, gestion des nœuds custom requis (GGUF, Nunchaku).
9. **Packaging des binaires sd.cpp** : build matrix (CUDA 12.x, Vulkan, ROCm, Metal, CPU AVX2) ou téléchargement des releases officielles, chargement via ctypes, tests de fumée par backend.
10. **Client API unifié** (OpenRouter Images, fal, Replicate, Gemini/OpenAI direct) avec estimation de coût avant envoi, quotas, retry, mode hybride local↔API et parité stricte des post-traitements.

---

## 6. Sources (URL)

**Modèles T2I/I2I**
- FLUX.2 (repo officiel, variantes/licences) : https://github.com/black-forest-labs/flux2
- FLUX.2 klein 4B (Apache 2.0) : https://huggingface.co/black-forest-labs/FLUX.2-klein-4B
- FLUX.2 dev (32B, NC) : https://huggingface.co/black-forest-labs/FLUX.2-dev
- Audit de licences 2026 (Klein 4B vs 9B) : https://www.digitalapplied.com/blog/open-weight-model-licence-audit-2026
- ComfyUI docs Klein (VRAM 8,4/9,2 Go) : https://docs.comfy.org/tutorials/flux/flux-2-klein
- FLUX sur 8 Go (GGUF, s/img) : https://localaimaster.com/vram/best-flux-model-8gb-vram
- FLUX.1 dev (licence NC) : https://huggingface.co/black-forest-labs/FLUX.1-dev
- FLUX.1 Krea dev : https://huggingface.co/black-forest-labs/FLUX.1-Krea-dev
- Z-Image-Turbo (HF) : https://huggingface.co/Tongyi-MAI/Z-Image-Turbo
- Z-Image (GitHub, dates de sortie) : https://github.com/Tongyi-MAI/Z-Image
- Z-Image Turbo ComfyUI/VRAM : https://www.thundercompute.com/blog/z-image-turbo-comfyui
- Z-Image Turbo benchmark (Q3/Q4/Q5, M4 Pro, 3080 laptop) : https://github.com/miroleon/z-image-turbo-benchmark
- Z-Image benchmark diffusers (offload/GGUF VRAM) : https://huggingface.co/datasets/docs-benchmarks/z-image/blob/main/benchmark_results.csv
- Qwen-Image (HF) : https://huggingface.co/Qwen/Qwen-Image
- Qwen-Image (GitHub, famille 2512/Edit/Layered/2.0) : https://github.com/QwenLM/Qwen-Image
- Qwen-Image ComfyUI (fp8/GGUF/Lightning, temps) : https://comfyui-wiki.com/en/tutorial/advanced/image/qwen/qwen-image
- SD 3.5 (licence Community, 1 M$) : https://stability.ai/news-updates/introducing-stable-diffusion-3-5
- SD 3.5 Medium VRAM/vitesse : https://willitrunai.com/image-models/sd-3-5-medium
- Chroma1-HD : https://huggingface.co/lodestones/Chroma1-HD ; https://comfyui-wiki.com/en/models/chroma/chroma-1-hd ; Chroma1-Flash : https://huggingface.co/lodestones/Chroma1-Flash
- HiDream-I1 (MIT, VRAM) : https://comfyui-wiki.com/en/tutorial/advanced/image/hidream/i1-t2i
- HunyuanImage 2.1 : https://huggingface.co/tencent/HunyuanImage-2.1 ; licence (territoire UE/UK/Corée exclus) : https://huggingface.co/tencent/HunyuanImage-2.1/raw/main/LICENSE
- HunyuanImage 3.0 VRAM : https://willitrunai.com/image-models/hunyuan-image-3
- Sana (GitHub) : https://github.com/NVlabs/Sana ; Sana 1.5 : https://huggingface.co/Efficient-Large-Model/SANA1.5_1.6B_1024px_diffusers ; LICENSE.txt (NVIDIA License, non commercial) : https://huggingface.co/Efficient-Large-Model/Sana_1600M_1024px_diffusers/raw/main/LICENSE.txt ; Sana-Sprint : https://huggingface.co/Efficient-Large-Model/Sana_Sprint_1.6B_1024px_diffusers
- NVIDIA Open Model License : https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/
- CogView4 : https://github.com/zai-org/CogView4
- Lumina-Image 2.0 : https://huggingface.co/Alpha-VLLM/Lumina-Image-2.0
- Kolors : https://huggingface.co/Kwai-Kolors/Kolors
- PixArt-Σ : https://huggingface.co/PixArt-alpha/PixArt-Sigma-XL-2-1024-MS
- NitroFusion (MIT) : https://github.com/ChenDarYen/NitroFusion
- SDXL-Lightning (openrail++) : https://huggingface.co/ByteDance/SDXL-Lightning ; LCM-LoRA SDXL : https://huggingface.co/latent-consistency/lcm-lora-sdxl ; Hyper-SD (LICENSE.md tri-licence) : https://huggingface.co/ByteDance/Hyper-SD ; DMD2 (CC-BY-NC) : https://huggingface.co/tianweiy/DMD2
- Comparatif SDXL 4 pas : https://mybyways.com/blog/sdxl-based-4-step-models-compared

**Pixel art / game assets**
- nerijs/pixel-art-xl : https://huggingface.co/nerijs/pixel-art-xl ; discussion licence : https://huggingface.co/nerijs/pixel-art-xl/discussions/7
- Pixel Art Diffusion XL (Civitai, restrictions) : https://civitai.com/models/277680/pixel-art-diffusion-xl
- Guide licences Civitai : https://education.civitai.com/guide-to-licensing-options-on-civitai/
- fal/flux-2-klein-4b-spritesheet-lora : https://huggingface.co/fal/flux-2-klein-4b-spritesheet-lora
- gokaygokay/Flux-2D-Game-Assets-LoRA : https://huggingface.co/gokaygokay/Flux-2D-Game-Assets-LoRA
- PixelWave schnell : https://huggingface.co/mikeyandfriends/PixelWave_FLUX.1-schnell_04
- Astropulse (Retro Diffusion) : https://github.com/Astropulse/ ; pixeldetector (MIT) : https://github.com/Astropulse/pixeldetector ; Retro Diffusion docs : https://astropulse.gitbook.io/retro-diffusion
- ComfyUI-PixelArt-Detector (MIT) : https://github.com/dimtoneff/ComfyUI-PixelArt-Detector
- ai-toolkit (MIT) : https://github.com/ostris/ai-toolkit
- DiffSynth-Studio (Apache 2.0) : https://github.com/modelscope/DiffSynth-Studio

**Runtimes / mémoire**
- ComfyUI (GPL-3.0) : https://github.com/comfyanonymous/ComfyUI ; API serveur : https://docs.comfy.org/development/comfyui-server/api-examples
- diffusers FLUX (offload, quantif) : https://github.com/huggingface/diffusers/blob/main/docs/source/en/api/pipelines/flux.md
- stable-diffusion.cpp (MIT) : https://github.com/leejet/stable-diffusion.cpp ; modèles supportés : https://deepwiki.com/leejet/stable-diffusion.cpp/1.2-supported-models ; binding Python : https://github.com/william-murray1204/stable-diffusion-cpp-python
- Nunchaku (Apache 2.0) : https://github.com/nunchaku-ai/nunchaku ; modèles/GPU : https://deepwiki.com/nunchaku-ai/nunchaku/4-supported-models
- mflux (MIT) : https://github.com/mflux-community/mflux ; DiffusionKit : https://github.com/argmaxinc/DiffusionKit
- InvokeAI : https://github.com/invoke-ai/InvokeAI ; SD.Next : https://github.com/vladmandic/sdnext ; Forge : https://github.com/lllyasviel/stable-diffusion-webui-forge ; SwarmUI : https://github.com/mcmonkeyprojects/SwarmUI
- ONNX Runtime DirectML (sustained engineering) : https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html
- OpenVINO GenAI : https://github.com/openvinotoolkit/openvino.genai
- Mixture of Diffusers (MIT) : https://github.com/albarji/mixture-of-diffusers ; ComfyUI-TiledDiffusion (CC-BY-NC-SA + GPL) : https://github.com/shiimizu/ComfyUI-TiledDiffusion

**VLM / LLM / scoring**
- Florence-2 (MIT) : https://huggingface.co/microsoft/Florence-2-large
- Moondream 2 (Apache) : https://huggingface.co/vikhyatk/moondream2 ; Moondream 3 preview (BSL 1.1) : https://huggingface.co/moondream/moondream3-preview
- Qwen3-VL-4B (Apache) : https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct ; Qwen2.5-VL-3B (Qwen Research License) : https://huggingface.co/Qwen/Qwen2.5-VL-3B-Instruct
- SmolVLM2 : https://huggingface.co/HuggingFaceTB/SmolVLM2-2.2B-Instruct
- MiniCPM-V 4.5 : https://huggingface.co/openbmb/MiniCPM-V-4_5 ; InternVL3.5-4B : https://huggingface.co/OpenGVLab/InternVL3_5-4B ; PaliGemma 2 : https://huggingface.co/google/paligemma2-3b-pt-448
- Ollama modèles vision : https://ollama.com/search?c=vision
- ImageReward : https://github.com/THUDM/ImageReward ; PickScore : https://huggingface.co/yuvalkirstain/PickScore_v1 ; HPSv2 : https://github.com/tgxs002/HPSv2 ; Aesthetic Predictor V2.5 (AGPL) : https://github.com/discus0434/aesthetic-predictor-v2-5

**API image**
- OpenRouter Image API : https://openrouter.ai/docs/features/multimodal/image-generation ; modèles image : https://openrouter.ai/models?output_modalities=image ; Gemini 2.5 Flash Image : https://openrouter.ai/google/gemini-2.5-flash-image ; GPT-Image-2 : https://openrouter.ai/openai/gpt-image-2 ; FLUX.2 pro : https://openrouter.ai/black-forest-labs/flux.2-pro
- Gemini API pricing (Nano Banana 2 / Lite / Pro) : https://ai.google.dev/gemini-api/docs/pricing
- OpenAI pricing (gpt-image-2 tokens) : https://developers.openai.com/api/docs/pricing
- fal.ai pricing : https://fal.ai/pricing
- Replicate pricing (FLUX, GPU/s) : https://replicate.com/pricing
