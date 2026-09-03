# 04 — Consistance visuelle et contrôle de la génération

*Recherche technique, septembre 2026. Domaine : garder le même personnage / objet / style d'une génération à l'autre, contrôler pose, direction (face / dos / profil) et vue (side, top-down, iso), produire des planches cohérentes — c'est-à-dire reproduire le « prep » de SpriteCook (« turn this character around », « put him in a walk pose ») avec des briques open source, sur un GPU 8 Go, ou via API quand c'est acceptable.*

Conventions : **NC** = licence non commerciale. Les outils propriétaires sont marqués **(propriétaire)** et ne servent que de référence. Les chiffres de VRAM/temps proviennent des dépôts ou de tests publiés cités en §6 ; quand ils sont extrapolés, c'est indiqué « estim. ». Complexité 1 (pip install) → 5 (fork + entraînement).

---

## 1. Les problèmes / verrous

1. **Éditer un sprite par instruction sans perdre son identité.** « Retourne-le », « mets-le en pose de marche » : il faut un modèle d'édition qui comprenne une instruction spatiale (rotation, changement de pose) et conserve silhouette, palette, proportions, accessoires. Les modèles d'édition classiques (InstructPix2Pix) échouent précisément sur les transformations spatiales ; les modèles 2025-2026 (Kontext, Qwen-Image-Edit, FLUX.2 klein) y arrivent, mais ils sont entraînés sur des photos et « lissent » le pixel art.
2. **Conditionner par une référence (identité, style) sans entraîner.** Injecter l'image du personnage ou du moodboard dans la génération (IP-Adapter, Redux, OminiControl, DreamO…). Beaucoup de ces briques sont centrées sur les visages humains ; il faut celles qui marchent sur un objet ou une créature stylisée.
3. **Contrôler la pose et la structure.** Un squelette OpenPose, une esquisse, une carte de profondeur. Problème spécifique : les détecteurs de pose (OpenPose, DWPose) sont entraînés sur des humains photographiés ; ils ne lisent pas un gobelin de 64 px. Il faut donc *produire* la pose autrement (éditeur, bibliothèque, rig 3D).
4. **Turnaround et multi-vues.** Obtenir face / trois-quarts / profil / dos, et changer de vue (side → top-down → iso) en gardant le même personnage. Les modèles 3D « objet » (Zero123++, Hunyuan3D) sont photoréalistes et licenciés restrictivement ; les LoRA « character sheet » sont anciens (SD1.5).
5. **Cohérence de projet dans la durée.** Des assets générés à trois semaines d'intervalle doivent se ressembler. Solutions : LoRA de style / de personnage entraîné sur les assets validés (faisable en 8 Go ?), style guide sérialisé, transfert de style local, img2img de « recollage ».
6. **Forcer la cohérence par la planche.** Générer N vues dans *une* image (grid trick), utiliser la reference sheet en entrée, seeds fixes, prompt structuré. Efficace mais fragile (fusion de cases, dérive de proportions).
7. **Mesurer la cohérence et trier.** Sans métrique, impossible d'automatiser « regénère jusqu'à ce que ça ressemble » ni de détecter la dérive. Embeddings DINOv2/SigLIP, DreamSim, LPIPS, tri automatique.
8. **Verrou transverse : licences et VRAM.** La famille FLUX.1-dev et tous ses dérivés (Kontext-dev, Fill-dev, Redux, ControlNet Union Pro FLUX, ICEdit, ACE++, UNO, DreamO/EasyControl côté poids) sont **NC** ; les alternatives Apache 2.0 sont Qwen-Image-Edit (20 B, lourd), FLUX.2 klein 4B (léger), OmniGen2, Z-Image, FLUX.1-schnell. Sur 8 Go, seuls GGUF Q4 / INT4 (Nunchaku) + offload passent.

---

## 2. Solutions par problème

### 2.1 Édition d'image guidée par instruction (le cœur du « prep »)

| Nom | URL | Licence | Langage | Type | Maturité | VRAM / CPU | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **FLUX.2 [klein] 4B** (distilled + base) | huggingface.co/black-forest-labs/FLUX.2-klein-4B | **Apache 2.0** (le 9B est NC) | Python / ComfyUI | DiT 4 B, t2i + édition mono/multi-référence | Sorti 15 janv. 2026, support Comfy natif, GGUF unsloth | fp8 : 8,4 Go (distilled), 9,2 Go (base) ; GGUF Q4_K_M 2,6 Go, Q8 4,3 Go ; ~15–30 s / 1024² sur RTX 3060 Ti (Q4, 4 pas) | 2 | Édition mono-image correcte, multi-référence supportée ; anatomie fragile sur scènes multi-sujets ; moins fort que Kontext/Qwen sur les instructions complexes | **Meilleur rapport licence/VRAM/vitesse pour 8 Go.** Encodeur texte Qwen3-4B. La version *base* (50 pas) est fine-tunable → LoRA « turnaround pixel art » possible |
| **Qwen-Image-Edit-2509 / 2511** | huggingface.co/Qwen/Qwen-Image-Edit-2509 · github.com/QwenLM/Qwen-Image | **Apache 2.0** | Python / ComfyUI / DiffSynth | MMDiT 20 B, édition multi-image (1–3 entrées), **ControlNet natif depth / edge / keypoint** | Très actif (2509 sept. 2025, 2511 23 déc. 2025 avec consistance de personnage améliorée et LoRA communautaires intégrés) | BF16 ~30 Go (24 Go+) ; fp8 ~15 Go ; GGUF Q4_K_M 13,1 Go → sur 8 Go il faut offload CPU + 32–64 Go RAM ; Lightning 4/8 pas : ~1 min / image sur 16 Go, estim. 2–5 min sur 8 Go ; Nunchaku INT4 disponible | 3 | Meilleure édition open source pour la préservation d'identité ; suit « rotate », « turn around », changement de pose ; LoRA **Multiple-angles** (dx8152, Apache 2.0) ajoute des commandes caméra (« rotate the camera 45° left », « top-down view ») | Brique « prep » de référence quand la VRAM/RAM le permet ; sinon en API (fal, Alibaba, NVIDIA NIM). Qwen-Image-2.0 (fév. 2026) annoncé, statut des poids à vérifier |
| **FLUX.1 Kontext [dev]** | huggingface.co/black-forest-labs/FLUX.1-Kontext-dev | **FLUX.1 [dev] Non-Commercial License** (BFL confirme que les *outputs* restent utilisables commercialement, mais l'exploitation du modèle dans un service payant exige une licence) | Python / ComfyUI | DiT 12 B, édition par instruction, référence en contexte | Mûr, énorme écosystème de LoRA (character sheet, turnaround) | GGUF Q4_K_S 6,8 Go / Q4_K_M 6,93 Go / Q3_K_S 5,2 Go (QuantStack, unsloth) + T5 GGUF obligatoire ; estim. 2–4 min / édition 1024² sur 8 Go (séquence doublée par la référence) ; Nunchaku INT4 | 2 | Excellente préservation d'identité, comprend les rotations ; tendance à lisser le pixel art | **À ne pas embarquer dans un produit commercial self-hosted** ; utilisable via API BFL (Kontext pro/max) comme service payant |
| **OmniGen2** | github.com/VectorSpaceLab/OmniGen2 | **Apache 2.0** | Python / diffusers | Modèle unifié (VLM + DiT), édition + génération en contexte multi-sujets | Juin 2025, activité moyenne | ~17 Go natif ; offload CPU ≈ –50 % ; offload séquentiel < 3 Go (très lent) | 3 | Les auteurs eux-mêmes signalent : « ne suit parfois pas l'instruction », « sujets différents de l'original », plusieurs essais nécessaires | Intéressant comme deuxième avis Apache 2.0 ; pas assez fiable pour un prep automatique |
| **Z-Image / Z-Image-Turbo** (+ Z-Image-Edit) | github.com/Tongyi-MAI/Z-Image | **Apache 2.0** | Python / ComfyUI | S3-DiT 6 B ; Turbo 8 pas | Turbo nov. 2025, base janv. 2026 ; **Z-Image-Edit « à sortir »** au moment de la recherche | Turbo tient en 16 Go, 4 Go via moteur C++ ; GGUF disponibles | 2 | Génération rapide et propre ; édition non disponible en open weights (à surveiller) | Bon candidat t2i 8 Go Apache 2.0 ; à réévaluer dès que Z-Image-Edit sort |
| **BAGEL-7B-MoT** | github.com/bytedance-seed/BAGEL | **Apache 2.0** | Python | Unifié 7 B actifs / 14 B | Mai 2025 | NF4 : 12–32 Go ; 32 Go+ en pleine précision | 4 | Édition parfois floue (reconnu par les auteurs) ; hors 8 Go | Référence de recherche, pas une brique produit |
| **Step1X-Edit v1.2** | github.com/stepfun-ai/Step1X-Edit | **Apache 2.0** | Python / ComfyUI (communauté) | Qwen-VL + DiT | v1.2 nov. 2025 ; « Step Image Edit 2 » (avr. 2026) semble **API seulement** | fp8 + offload : 18 Go | 4 | Bonne qualité, mais impossible en 8 Go | Non retenu pour le local |
| **HiDream-E1 / E1.1** | github.com/HiDream-ai/HiDream-E1 | **MIT** | Python / ComfyUI | Édition sur HiDream-I1 (17 B) + Llama-3.1-8B | Mi-2025 | Très lourd (> 16 Go même en fp8, estim.) | 4 | Bons scores EmuEdit/ReasonEdit ; E1-Full exige un format d'instruction rigide | Licence idéale, VRAM rédhibitoire |
| **ICEdit** (NeurIPS 2025) | github.com/River-Zhang/ICEdit | **NC** (LoRA sur FLUX.1-Fill-dev) | Python / ComfyUI | Diptyque en contexte (original \| édité) | Actif | Nunchaku : 4 Go ; GGUF 10 Go | 2 | Les auteurs : « fonctionne mieux sur des images réalistes ; baisse sur anime » | Idée à retenir (diptyque = prep par côte-à-côte) ; licence bloquante |
| **DreamO v1.1** | github.com/bytedance/DreamO | Code **Apache 2.0**, poids sur FLUX.1-dev (**NC**) | Python / ComfyUI | Personnalisation unifiée (IP objets/animaux, ID, try-on, style) | Juin 2025 | Nunchaku + offload : 6,5 Go (~20 s / 1024² sur RTX 3080) | 3 | Tâche IP explicitement pour objets et animaux ; « style moins stable » | Techniquement le plus proche d'un « garde ce personnage, change la scène » en 8 Go — mais NC |
| **UNO** | github.com/bytedance/UNO | **CC BY-NC 4.0** + FLUX.1-dev | Python / ComfyUI | Multi-sujets en contexte | Avr. 2025 | Non documenté (~FLUX dev) | 3 | Bonne fidélité de sujet | NC |
| **InstructPix2Pix / MagicBrush** | github.com/timothybrooks/instruct-pix2pix | Code MIT (IP2P) ; MagicBrush dataset CC BY 4.0 | Python / diffusers | SD1.5 édition | 2023, figé | < 6 Go via diffusers | 1 | Limitation documentée : « difficultés sur les grandes transformations spatiales (mouvement de caméra, déplacement d'objet) » | **Inadapté au turnaround** ; utile seulement pour des retouches de couleur / accessoire |
| Nano Banana / Nano Banana Pro / Nano Banana 2 **(propriétaire, Google)** | ai.google.dev | API payante | — | Gemini image edit multi-référence | Utilisé par SpriteCook | API | 1 | Référence qualité : consistance forte, comprend « character sheet, front/side/back » ; ignore les tailles « 32×32 », produit des dégradés parasites (SpriteCook re-snappe la grille) | Acceptable comme brique API dans le projet ; ne pas en dépendre pour le mode local |
| GPT-Image-1.5 / 2 **(propriétaire, OpenAI)** | platform.openai.com | API | — | Édition multi-image | — | API | 1 | Même usage que ci-dessus ; utilisé par SpriteCook pour les UI kits | Référence |

**Comparaison.** Trois familles répondent au besoin « instruction spatiale + identité » : Kontext (meilleur mais NC), Qwen-Image-Edit (meilleur *et* Apache 2.0, mais 20 B), FLUX.2 klein 4B (Apache 2.0, léger, un cran en dessous). OmniGen2/BAGEL sont des modèles de recherche ; Step1X/HiDream sont hors budget VRAM ; IP2P est obsolète pour les rotations.

**Recommandation.**
- **Mode local 8 Go, commercial** : *FLUX.2 klein 4B* en GGUF Q8/Q6 (4,3 Go / 3,4 Go) comme moteur de prep par défaut — ~20 s par édition, licence propre. Prévoir un mode « qualité » avec *Qwen-Image-Edit-2511* GGUF Q4 + Lightning 4 pas + offload (lent, exige ≥ 32 Go de RAM) ou Nunchaku INT4.
- **Mode API** : Qwen-Image-Edit-2511 (fal/Alibaba), Kontext pro (BFL), Gemini image (Nano Banana), GPT-Image — tous acceptables contractuellement puisque payés à l'usage.
- **Bannir** l'embarquement de Kontext-dev / ICEdit / ACE++ / UNO dans le produit ; les garder pour l'expérimentation.

### 2.2 Conditionnement par référence (identité / style, sans entraînement)

| Nom | URL | Licence | Langage | Type | Maturité | VRAM / CPU | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **IP-Adapter / IP-Adapter Plus** (SD1.5, SDXL) | github.com/tencent-ailab/IP-Adapter | **Apache 2.0** | Python / diffusers / ComfyUI | Adaptateur 22 M params, encodeur OpenCLIP ViT-H | Mûr, figé (dernière release janv. 2024) ; ComfyUI_IPAdapter_plus maintenu | SD1.5 : 4 Go ; SDXL : 8 Go (fp16 + offload) | 1 | « Image prompt » générique : bon pour transférer style/couleurs/silhouette d'un sprite ; ne fige pas les détails fins | Brique standard, compatible ControlNet ; fonctionne sur objets/créatures (pas de détecteur de visage) |
| **InstantStyle** | github.com/instantX-research/InstantStyle | Apache 2.0 (suit IP-Adapter) | Python / diffusers | Injection IP-Adapter ciblée : bloc `up_blocks.0.attentions.1` = style, `down_blocks.2.attentions.1` = layout | Mûr, training-free | Idem SDXL | 1 | Sépare style et contenu sans entraînement ; SD1.5 « expérimental » ; pas de FLUX | **La façon la moins chère de forcer un style de projet en SDXL** |
| **Style Aligned** (Google) | github.com/google/style-aligned | **Apache 2.0** | Python / diffusers | Attention partagée + AdaIN sur Q/K, batch cohérent | Archivé (mars 2025), stable | SDXL : ~10 Go pour un batch de 4 (estim.) | 2 | Toutes les images d'un batch partagent le style ; notebook avec ControlNet-Depth | Idéal pour générer une *série* d'assets d'un coup (les 8 items d'une boutique) |
| **Visual Style Prompting / StyleKeeper** (NAVER) | github.com/naver-ai/Visual-Style-Prompting | **Apache 2.0** | Python / diffusers | Swap des K/V de self-attention dans les couches tardives ; « negative visual query guidance » contre la fuite de contenu | ICCV 2025 | SD/SDXL, ~8 Go | 2 | Training-free, scripts ControlNet edge/depth | Alternative à Style Aligned, maintenue plus récemment |
| **StyleID** (CVPR 2024) | github.com/jiwoogit/StyleID | **MIT** | Python | Injection de style par attention + inversion DDIM | Stable | Annoncé 20 Go (features d'inversion 3 Go/image) | 3 | Transfert de style fidèle mais coûteux (double inversion) | Pour un traitement batch offline « re-styliser un lot » |
| **CSGO / StyleShot** | github.com/instantX-research/CSGO · github.com/open-mmlab/StyleShot | À vérifier (dépôts InstantX / OpenMMLab, code publié) | Python | Composition contenu-style SDXL, encodeur de style entraîné | 2024 | SDXL ~10 Go | 2 | Meilleur que IP-Adapter pour le *style* seul ; pas de contrôle d'identité | Utile pour appliquer un moodboard |
| **OminiControl / OminiControl2** | github.com/Yuanshi9815/OminiControl | **Apache 2.0**, base **FLUX.1-schnell** (Apache 2.0) | Python / diffusers | LoRA universel : sujet, canny, depth, fill ; 512 → 1024 | ICCV 2025 Highlight ; code d'entraînement fourni | FLUX schnell 12 B → GGUF Q4 ~7 Go, estim. offload requis | 3 | Explicitement « objets, pas humains » (parfait pour des props / créatures) ; « ne marche pas bien avec FLUX.1-dev » | **Seule pile subject-driven 100 % Apache 2.0** ; entraînable sur une condition « turnaround » maison |
| **FLUX.1 Redux [dev]** | huggingface.co/black-forest-labs/FLUX.1-Redux-dev | **NC** | ComfyUI | Adaptateur SigLIP → variation / restyle | Mûr | Comme FLUX dev | 1 | Prompt texte faible face à l'image | NC → API pro uniquement |
| **XLabs FLUX IP-Adapter v2** | huggingface.co/XLabs-AI/flux-ip-adapter-v2 | **NC** (FLUX dev) | ComfyUI | IP-Adapter CLIP-L pour FLUX | Beta | FLUX dev | 2 | « Peut demander plusieurs essais » | NC |
| **ACE++** | github.com/ali-vilab/ACE_plus | **NC** (FLUX.1-Fill-dev) | Python / ComfyUI | LoRA portrait / sujet / édition locale | Fév. 2025 | Entraînement 38–40 Go | 3 | Artefacts sur mains ; ajout/suppression d'objets faible | NC |
| **EasyControl** | github.com/Xiaojiu-z/EasyControl | Code Apache 2.0, base FLUX.1-dev (NC) | Python | LoRA d'injection de condition (canny/depth/pose/sujet/style Ghibli) | ICCV 2025 | 80 Go recommandés | 4 | Hors 8 Go | Recherche |
| **StoryDiffusion** | github.com/HVision-NKU/StoryDiffusion | **Apache 2.0** | Python / diffusers | Self-attention cohérente sur SD1.5/SDXL, training-free ; section « Comics » | 2024, stable | SDXL, batch ≥ 3 prompts (~12 Go, estim.) | 2 | Conçu pour des personnages stylisés ; ≥ 3–6 prompts d'un coup | Génère les 6 poses d'un même perso en un batch cohérent |
| **1Prompt1Story** (ICLR 2025) | github.com/byliutao/1Prompt1Story | **MIT** | Python / diffusers | Un seul prompt long concaténé + réalignement d'attention | Stable | SDXL | 2 | Training-free, simple | Même usage que StoryDiffusion, moins de dépendances |
| **ConsiStory** (NVIDIA) | github.com/NVlabs/consistory | **NVIDIA License — NC** (recherche seulement) | Python | Attention partagée + injection de correspondances | 2024 | SDXL | 2 | Bon, mais NC | Non |
| **AnyStory** (Alibaba) | github.com/junjiehe96/AnyStory | Non précisée | Python | ReferenceNet + routeur, FLUX-dev | 2025 | FLUX dev | 3 | Multi-sujets | Licence à clarifier ; base NC |
| **StoryMaker** | github.com/RedAIGC/StoryMaker | Non précisée | Python | InsightFace + IP-Adapter, SDXL | 2024 | SDXL | 2 | Dépend d'un détecteur de **visage humain** | Inadapté aux créatures / pixel art |
| **The Chosen One** (impl. non officielle) | github.com/ZichengDuan/TheChosenOne | Non précisée, non maintenu | Python | Boucle : générer → clusteriser (DINOv2) → LoRA/TI sur le cluster dominant → itérer | Abandonné déc. 2024 | SDXL | 4 | Méthode plus qu'outil | **L'algorithme est à réimplémenter** (voir §5) |
| InfiniteYou, PuLID, InstantID | — | Divers (PuLID Apache 2.0) | — | Identité de **visage humain** | Mûrs | — | — | Hors sujet pour des sprites | Mention |

**Comparaison.** Pour un personnage stylisé (pas un visage), les briques qui fonctionnent sont celles qui ne passent pas par un détecteur facial : IP-Adapter (+InstantStyle pour le style), Style Aligned / Visual Style Prompting pour un batch homogène, StoryDiffusion / 1Prompt1Story pour une série de poses, OminiControl (schnell) pour le « même objet dans une autre scène ». Les adaptateurs FLUX (Redux, XLabs, ACE++, DreamO, UNO) sont tous prisonniers de la licence FLUX.1-dev.

**Recommandation.** Pile SDXL Apache/OpenRAIL : *IP-Adapter Plus + InstantStyle* (style de projet) + *ControlNet Union Xinsir* (pose) + *Style Aligned* (batch). Pour du subject-driven sans SDXL : *OminiControl sur FLUX.1-schnell*. Et, dès qu'on veut « le même personnage, autre pose, en une instruction », basculer sur les éditeurs de §2.1 qui rendent la plupart de ces adaptateurs superflus.

### 2.3 Contrôle de pose et de structure

| Nom | URL | Licence | Langage | Type | Maturité | VRAM / CPU | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **ControlNet v1.1 SD1.5** (openpose, canny, depth, lineart, scribble, tile…) | huggingface.co/lllyasviel/ControlNet-v1-1 | **CreativeML OpenRAIL-M** (usage commercial autorisé avec restrictions d'usage) | diffusers / ComfyUI | 14 modèles ~1,4 Go | Mûr, figé | 4–6 Go avec SD1.5 | 1 | Le plus léger ; Scribble / Lineart parfaits pour « sketch to sprite » | Toujours pertinent pour du 8 Go et des sprites basse résolution |
| **ControlNet Union SDXL (Xinsir) / ProMax** | huggingface.co/xinsir/controlnet-union-sdxl-1.0 | **Apache 2.0** | diffusers / ComfyUI | 1 modèle 1 B, 12 conditions (openpose, depth, canny, lineart, anime lineart, scribble, HED, pidi, TEED, seg, normal, MLSD) + tile / inpaint / outpaint (ProMax) | Mûr | SDXL fp16 + union ≈ 8–10 Go ; passe en 8 Go avec offload / fp8 | 2 | Excellente qualité ; un seul fichier pour tout | **Référence SDXL** |
| **T2I-Adapter (SD1.5 / SDXL)** | github.com/TencentARC/T2I-Adapter | Apache 2.0 (dépôt) — à confirmer sur les poids | diffusers | Adaptateurs 77–79 M (sketch, canny, lineart, openpose, depth, color) | Mûr | Moins de VRAM et plus rapide que ControlNet | 1 | Contrôle un peu plus lâche | Bon plan B pour 8 Go |
| **Qwen-Image-Edit-2509+ (keypoint / depth / edge natifs)** | huggingface.co/Qwen/Qwen-Image-Edit-2509 | **Apache 2.0** | ComfyUI / DiffSynth | Contrôle intégré au modèle d'édition : image du perso + squelette → perso en pose | Actif | Voir §2.1 | 3 | Le seul qui combine *identité de référence* + *pose* dans une seule brique Apache 2.0 | **C'est le « put him in a walk pose » idéal** |
| **Qwen-Image Blockwise ControlNet** (DiffSynth) | github.com/modelscope/DiffSynth-Studio | **Apache 2.0** | Python | Canny / Depth / Inpaint pour Qwen-Image | 2025 | 20 B → offload disque (DiffSynth gère) | 3 | Lourd | Complément |
| **FLUX.1-dev ControlNet Union Pro 2.0** (Shakker) | huggingface.co/Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro-2.0 | **NC** | diffusers / ComfyUI / Nunchaku | 2 B : canny, soft edge, depth, pose, gray | Avr. 2025 | FLUX dev | 2 | Bon ; tile retiré | NC |
| **SD3.5 ControlNets** (canny, depth, blur) | huggingface.co/stabilityai/stable-diffusion-3.5-controlnets | Stability Community License (**gratuit < 1 M$ CA/an**) | diffusers | Pour SD3.5 Large 8 B | Oct. 2024 | > 16 Go | 3 | Hors 8 Go ; pas d'openpose | Non |
| **DWPose** (détecteur) | github.com/IDEA-Research/DWPose | **Apache 2.0** | Python / ONNX / ComfyUI (controlnet_aux) | Estimation corps entier → JSON OpenPose | Mûr | CPU OK | 1 | **Humains uniquement** ; échoue sur un sprite 32 px ou une créature | À utiliser sur une photo / un rendu 3D, pas sur le sprite |
| **ComfyUI-OpenPose-Studio** | github.com/andreszs/ComfyUI-OpenPose-Studio | **MIT** | JS / Python | Éditeur interactif de squelette, galerie de poses, import/export JSON OpenPose, multi-figures, mains/visage | Actif 2026 | CPU | 1 | Pas encore compatible « Nodes 2.0 » | Base pour un éditeur de pose intégré au front |
| **ComfyUI-openpose-editor** (huchenlei) | github.com/huchenlei/ComfyUI-openpose-editor | **GPL-3.0** | JS | Port de l'éditeur A1111 ; « Send pose to ControlNet » | Peu actif (16 commits) | CPU | 1 | GPL contaminante pour un front propriétaire | Préférer OpenPose-Studio |
| **OpenPoses.com** / packs de poses JSON | openposes.com | À vérifier (site gratuit ; licence non lisible automatiquement) | — | Bibliothèque de squelettes PNG/JSON | — | — | 1 | Poses humaines debout ; peu de poses de jeu (idle / walk / attack) | Créer sa propre bibliothèque (§5) |
| **Blender rig → OpenPose** (rig « bones like OpenPose », script d'export) | blender.org + scripts communautaires | Blender GPL (outil), rigs souvent CC | Python | Rendre un squelette coloré OpenPose depuis un rig animé (Mixamo **(propriétaire, gratuit)** / Rigify) | Artisanal | CPU | 3 | Permet des cycles de marche complets et des vues top-down/iso exactes | Voir §3 |
| posemy.art, Magic Poser **(propriétaires)** | — | — | — | Poseurs 3D en ligne exportant OpenPose | — | — | 1 | Référence UX | Ne pas dépendre |

**Comparaison.** Deux stratégies : (a) *ControlNet classique* (SD1.5 / SDXL-Xinsir) — léger, mûr, mais la pose sert de contrainte sur une *génération* : l'identité doit venir d'ailleurs (IP-Adapter, LoRA) ; (b) *contrôle intégré à l'éditeur* (Qwen-Image-Edit keypoint) — identité et pose en une passe, mais 20 B. Le vrai verrou n'est pas le modèle mais **l'obtention du squelette** : pour des personnages non humains, la détection ne marche pas ; il faut une bibliothèque de poses dessinées (canonique par perspective : platformer / iso / top-down), un éditeur de squelette, ou un rig 3D rendu.

**Recommandation.** SDXL + Xinsir Union (openpose + lineart) pour le local léger ; Qwen-Image-Edit keypoint pour le mode qualité/API ; bibliothèque de poses maison en JSON OpenPose par perspective (voir §5) ; éditeur intégré inspiré d'OpenPose-Studio (MIT). Pour le « sketch to sprite », ControlNet Scribble/Lineart SD1.5 avec un LoRA pixel art.

### 2.4 Turnaround / multi-vues

| Nom | URL | Licence | Langage | Type | Maturité | VRAM / CPU | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Éditeur d'instruction + « turn around »** (Qwen-Image-Edit, klein 4B, Kontext) | §2.1 | Apache 2.0 / Apache 2.0 / NC | — | Instruction : « same character, back view, same style » | — | §2.1 | 2 | Marche bien pour face ↔ profil ↔ dos en 2D ; dérive de détails sur les vues dos (accessoires inventés) | Approche de SpriteCook ; corriger par tri DINOv2 (§2.7) et retries |
| **LoRA « Multiple angles » Qwen-Edit-2509** | huggingface.co/dx8152/Qwen-Edit-2509-Multiple-angles | **Apache 2.0** | ComfyUI | LoRA de caméra : « rotate the camera 45° left », « top-down view », « close-up » | 2025, réentraîné pour la stabilité | + Qwen-Image-Edit | 2 | Pensé pour des photos, transférable aux illustrations ; utile pour side → top-down | **Meilleur point de départ pour changer de vue** |
| **CharTurner (V2 / Beta LoRA)** | civitai.com/models/7252 | CreativeML OpenRAIL-M | SD1.5 | LoRA « character turnaround sheet » | 2023, expérimental (« use at your own risk ») | SD1.5 4 Go | 1 | Poids 0,2–0,4 ; « prend le contrôle du style » | Anecdotique en 2026 ; le concept (planche de 3–4 vues) reste valable avec des LoRA modernes ou en prompt |
| **CharacterGen** (SIGGRAPH 2024) | github.com/zjp-shadow/CharacterGen | **Apache 2.0** | Python | 1 image anime → 4 vues canoniques (A-pose) → mesh 3D | Actif (800 ★) | Non documenté (estim. 12–16 Go) | 4 | Spécialisé anime ; force une A-pose ; dataset VRoid non redistribuable | Pour un pipeline « personnage → modèle 3D → rendu sous n'importe quel angle » (couvert par l'agent 3D) |
| **MV-Adapter** | github.com/huanngzh/MV-Adapter | **Apache 2.0** | Python / ComfyUI | Image → 6 vues multi-view sur SDXL (ou SD2.1) ; exemples avec Animagine XL (anime) | 2025, actif | i2mv SDXL ~14 Go ; SD2.1 < 10 Go | 3 | Marche sur des personnages 2D stylisés si le base model est anime ; sorties photoréalistes « objet » | Meilleure brique multi-vue open source ; trop lourd pour 8 Go en SDXL |
| **Zero123++ v1.2** | github.com/SUDO-AI-3D/zero123plus | Code Apache 2.0, **poids CC BY-NC 4.0** | Python / diffusers | 1 image → grille 6 vues (azimuts 30°→330°) sur SD2, ControlNet depth | Mûr | ~5–5,7 Go | 2 | Photoréaliste, écrase le style 2D | NC |
| **SV3D** (Stability) | github.com/Stability-AI/generative-models | Stability Community License (< 1 M$) | Python | Orbite vidéo d'un objet | 2024 | > 16 Go | 3 | Objets, pas de sprites | Mention |
| **Hunyuan3D-2 / 2.1** | github.com/Tencent-Hunyuan/Hunyuan3D-2 | **Tencent Hunyuan 3D Community License — NE S'APPLIQUE PAS dans l'UE, au Royaume-Uni et en Corée du Sud** ; < 1 M MAU | Python | Image → mesh + texture ; 6 Go (forme) / 16 Go (forme + texture) ; variantes mini/turbo | Très actif | 6–16 Go | 4 | Excellente géométrie | **Bloquant pour un éditeur basé en France** — à signaler à l'agent 3D |
| **Grid prompt « 4 views character sheet »** | — | — | — | Une image = 3–4 vues alignées | — | — | 1 | Voir §2.6 | — |

**Comparaison.** Le turnaround « façon SpriteCook » repose sur l'édition par instruction, pas sur la 3D : c'est ce qui préserve le style pixel. La 3D (CharacterGen, MV-Adapter, Hunyuan3D) devient rentable seulement si le projet veut des dizaines d'angles (iso 8 directions) et accepte un re-styling après rendu. Sur 8 Go, MV-Adapter SDXL est hors budget ; CharacterGen probablement aussi.

**Recommandation.** Turnaround 2D = éditeur (klein 4B local / Qwen-Edit API) + LoRA « Multiple angles » pour les changements de vue + tri automatique par similarité. Garder une passerelle 3D optionnelle via MV-Adapter (Apache 2.0) sur GPU ≥ 16 Go ou en cloud, et exclure Hunyuan3D pour raison de territoire.

### 2.5 Entraîner un LoRA de personnage ou de style du projet (8 Go)

| Nom | URL | Licence | Langage | Type | Maturité | VRAM / CPU | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **kohya-ss sd-scripts** (v0.10.5, mai 2026) | github.com/kohya-ss/sd-scripts | **Apache 2.0** | Python | Scripts LoRA/DreamBooth/TI : SD1.x/2.x, SDXL, SD3/3.5, FLUX.1, Lumina, HunyuanImage 2.1, Anima | Référence, très actif (2 559 commits) | Doc FLUX officielle : 24 Go = réglages de base ; 16 Go = batch 1 + `blocks_to_swap` ; 12 Go = `blocks_to_swap 16` + AdamW 8 bit ; 10 Go = 22 blocs + T5 fp8 ; **8 Go = `blocks_to_swap 28` + T5 fp8** (lent) ; SD1.5 LoRA : 4–6 Go ; SDXL LoRA : 8 Go avec cache latents/TE + gradient checkpointing + AdamW 8 bit | 3 | Le plus flexible ; pas de GUI (voir bmaltais/kohya_ss, Apache 2.0) | **Brique d'entraînement par défaut** |
| **OneTrainer** | github.com/Nerogar/OneTrainer | **AGPL-3.0** | Python (GUI) | SD1.5 → SDXL, SD3.x, FLUX.1, FLUX.2 dev/klein, Qwen-Image, Z-Image, HiDream…, EMA en CPU, offload de couches | Actif | Comparable à kohya ; SDXL LoRA en 8 Go documenté par la communauté | 2 | GUI complète, masques, captioning intégré | **AGPL** : à lancer comme process séparé, ne pas lier au backend |
| **ai-toolkit (ostris)** | github.com/ostris/ai-toolkit | **MIT** | Python + UI web | FLUX.1, **FLUX.1-Kontext-dev**, FLUX.2 / klein, **Qwen-Image-Edit 2509/2511**, Z-Image, SDXL, SD1.5, OmniGen2, HiDream E1 ; « accuracy recovery adapters » et entraînement 3 bits | Très actif | Configs `*_24gb` pour FLUX ; `low_vram` ; klein 4B estim. 10–12 Go en bf16, ~8 Go avec quantisation (à mesurer) | 2 | Seul outil qui entraîne des LoRA **d'édition** (paires avant/après) : on peut apprendre « turn around » sur ses propres sprites | **Clé pour un LoRA de prep sur FLUX.2 klein 4B base** |
| **DiffSynth-Studio** | github.com/modelscope/DiffSynth-Studio | **Apache 2.0** | Python | LoRA / full pour Qwen-Image(-Edit), FLUX ; offload disque par couche | Actif | Qwen-Image 20 B en LoRA : ≥ 24 Go sans astuce ; offload possible mais lent | 3 | Officiel côté Qwen | Pour la voie Qwen |
| **SimpleTuner** | github.com/bghira/SimpleTuner | AGPL-3.0 | Python | Multi-modèles, quantisation d'entraînement | Actif | FLUX LoRA int8 ~16 Go | 3 | Orienté serveur | Alternative |
| **diffusers training examples** (DreamBooth LoRA, TI) | github.com/huggingface/diffusers | Apache 2.0 | Python | Scripts de référence | Mûr | SD1.5 LoRA < 8 Go | 2 | Peu d'optimisations mémoire | Pour intégrer l'entraînement dans FastAPI sans dépendance externe |
| **Pixel Art XL** (nerijs) | huggingface.co/nerijs/pixel-art-xl | CreativeML OpenRAIL-M | SDXL LoRA | Style pixel art sans trigger ; « downscale ×8 nearest » | 12 k téléchargements/mois | SDXL | 1 | Illustre la recette : générer grand, réduire en nearest-neighbor | Point de départ avant d'entraîner le sien |
| **Auto-captioning** : Florence-2 (MIT), JoyCaption (Apache 2.0), BLIP (BSD), WD14 tagger (Apache 2.0) | — | — | Python | Légendes / tags pour le dataset | Mûrs | < 4 Go | 1 | Pour des sprites, préférer un tagging structuré (nom du perso, vue, pose, palette) écrit par le pipeline lui-même, pas par un VLM | — |

**Faisabilité et volumes (pratique courante, à calibrer sur le projet).**
- LoRA **de personnage** : 15–40 images variées (vues, poses) ; DreamBooth marche dès 3–5 images ; 1 000–2 500 pas ; SD1.5 : 10–20 min sur 8 Go ; SDXL : 30–60 min ; FLUX.1 avec 28 blocs swappés : plusieurs heures.
- LoRA **de style** (moodboard + premiers assets validés) : 30–150 images ; c'est le LoRA le plus rentable pour un projet de jeu, car il fige palette, épaisseur de trait et rendu pour *tous* les assets suivants, personnages comme props.
- LoRA **d'édition** (paires « sprite face → sprite dos » sur klein 4B base ou Qwen-Edit) : 50–200 paires ; c'est ce qui rapprocherait le prep local de la qualité Nano Banana sur du pixel art.

**Recommandation.** Oui, le LoRA de style est une bonne brique de cohérence — à condition de l'automatiser (dataset = assets marqués « validés » dans le Codex, entraînement en tâche de fond, versionné). Choisir kohya (Apache 2.0, intégrable) pour SD1.5/SDXL, ai-toolkit (MIT) pour klein 4B et les LoRA d'édition. Prévoir un « mode cloud » pour les entraînements > 8 Go.

### 2.6 Astuces par prompt et par planche

| Technique | Où / source | Coût | Efficacité | Limites |
|---|---|---|---|---|
| **Grid trick** : « character sheet, 4 views (front, 3/4, side, back), same character, white background, evenly spaced » en *une* image | Pratique courante ; recommandations Nano Banana Pro (selfielab, roboticape) ; mécanisme équivalent au diptyque d'ICEdit et à la grille 3×2 de Zero123++ | 1 génération | Très bonne cohérence intra-planche (même passe d'attention) ; 6–9 vues max par image, 3–6 items par ligne | Cases qui fusionnent → découpe **content-aware** (colonnes de pixels transparents) plutôt que grille uniforme ; proportions qui dérivent au-delà de 6 vues |
| **Reference sheet en entrée** de l'éditeur (« using this sheet as reference, draw the character in a walk pose ») | Kontext / Qwen-Edit multi-image (1–3 images) / klein multi-référence | 1 édition | Meilleure que le texte seul | Qwen-Edit : garder ≤ 3 images |
| **Fond chroma #00FF00 + contour blanc 2–3 px** demandé dans le prompt, puis chroma key HSV | roboticape 2026 | 0 | « la ligne la plus importante » pour un détourage propre sans rembg | Ne pas utiliser de vert dans la palette |
| **Prompt structuré** objet / monde / rendu + **negative prompt** (« no gradients, no anti-aliasing, no text ») | Codex du projet | 0 | Reproductibilité | Les modèles ignorent « 32×32 » ; ne pas se battre sur le snapping en prompt (SpriteCook) |
| **Seed fixe + variation de prompt** | Tous | 0 | Utile pour des variantes de couleur d'un même sprite | Change quand même la structure si le prompt bouge trop |
| **img2img à faible denoise (0,25–0,45) avec LoRA de style** | SD1.5/SDXL | 1 passe | « Recolle » un asset externe ou API au style du projet | Dégrade les petits détails ; à combiner avec un re-snap de grille |
| **Batch cohérent** (Style Aligned / StoryDiffusion / 1Prompt1Story) | §2.2 | 1 batch | Toute une série d'items partage le style | VRAM proportionnelle au batch |
| **Chaîner les preps** (dos → marche de dos) | SpriteCook | n éditions | Chaque étape reste une petite transformation → moins de dérive | Accumulation d'erreurs : contrôler à chaque nœud (§2.7) |

### 2.7 Mesurer la consistance, trier, détecter la dérive

| Nom | URL | Licence | Type | VRAM | Cplx | Usage recommandé |
|---|---|---|---|---|---|---|
| **DINOv2** (ViT-S/B) | github.com/facebookresearch/dinov2 | **Apache 2.0** | Embedding global + patchs ; « DINO score » standard des benchmarks de personnalisation (DreamBench) | < 1 Go, CPU OK | 1 | Similarité *structurelle* sprite ↔ référence (silhouette, forme), tri des variantes |
| **DINOv3** (août 2025) | github.com/facebookresearch/dinov3 | **DINOv3 License** (commercial autorisé, restrictions ITAR/attribution/redistribution) | Meilleures features denses | < 1 Go | 1 | Même usage ; vérifier la clause de redistribution avant de l'embarquer |
| **SigLIP 2 / CLIP** | huggingface.co/google/siglip2-* · github.com/openai/CLIP | Apache 2.0 / MIT | Embedding sémantique ; « CLIP-I » et « CLIP-T » (image ↔ prompt) | < 1 Go | 1 | Vérifier que l'asset correspond au prompt du Codex (bonne vue, bon objet) |
| **DreamSim** | github.com/ssundaram21/dreamsim | **MIT** | Métrique perceptuelle « mid-level » (ensemble DINO + CLIP + OpenCLIP), alignée sur l'humain | < 2 Go | 1 | Score global « même personnage ? » plus fiable que LPIPS sur des variations de pose |
| **LPIPS** | github.com/richzhang/PerceptualSimilarity | BSD-2 | Distance bas niveau | CPU | 1 | Comparer deux *frames* alignées (idle vs idle regénéré) ; inutile entre deux poses différentes |
| **Palette / histogramme** (Pillow + NumPy) | — | — | Distance de palette (couvert par l'agent palette) | CPU | 1 | Détecter l'introduction de couleurs hors Codex |

**Recette de tri** : pour chaque prep, générer k = 4–8 candidats (klein 4B : 20 s chacun) ; calculer DINOv2-cos(candidat, référence) et DreamSim ; rejeter si la palette dépasse le seuil ; garder le meilleur ; relancer si aucun ne passe. Pour la **dérive de projet**, stocker l'embedding DINOv2 de chaque asset validé ; alerter quand un nouvel asset s'éloigne du centroïde de sa classe (« personnages », « props ») au-delà d'un seuil calibré sur les premiers assets.

### 2.8 Cohérence de style dans la durée

| Brique | Rôle | Licence |
|---|---|---|
| **Style guide sérialisé** (JSON versionné dans le Codex : palette hex, prompt de rendu, negative, seeds de référence, LoRA + hash, modèle + quant, taille de grille, réglages ControlNet) | Reproduire à l'identique une génération faite il y a un mois ; c'est le pendant local du « preset » SpriteCook | — (à développer) |
| **LoRA de style** réentraîné à chaque jalon (v1 moodboard, v2 après 30 assets validés…) | Fige le rendu | kohya / ai-toolkit |
| **IP-Adapter + InstantStyle** avec 3–5 assets validés comme image prompt | Style sans entraînement | Apache 2.0 |
| **Visual Style Prompting / Style Aligned / StyleID** | Re-styliser un lot d'assets hétérogènes | Apache 2.0 / Apache 2.0 / MIT |
| **AdaIN / neural style transfer classique** (pytorch-AdaIN, MIT) | Transfert de texture rapide, CPU | MIT | 
| **Harmonisation de palette** (quantisation, remap vers la palette Codex) | Dernière étape systématique | couvert par l'agent palette |

---

## 3. Idées malines / astuces

1. **Le prep en deux temps : silhouette puis rendu.** Demander à l'éditeur d'abord une version *flat* (aplats, sans ombrage) de la nouvelle vue, la valider par DINOv2, puis un second passage img2img faible denoise avec le LoRA de style. Les erreurs de rotation se voient mieux sur des aplats et le style est réappliqué de façon uniforme.
2. **Poses canoniques par perspective.** SpriteCook verrouille la perspective (platformer / iso / top-down) et déclare un graphe de preps par animation. Reproduire cela avec une **bibliothèque de squelettes OpenPose JSON** par perspective (idle, walk×4 directions, jump, attack, hurt, death) dessinés une fois, à l'échelle du sprite, puis rendus en image de contrôle. On évite ainsi tout détecteur de pose.
3. **Rig 3D « boîte » pour les vues.** Un mannequin low-poly rigé dans Blender (Rigify ou Mixamo pour les animations), rendu en squelette OpenPose et en depth sous les 4/8 directions exactes de l'iso ou du top-down. On obtient des cartes de pose *géométriquement justes* pour n'importe quelle direction, sans modèle 3D du personnage.
4. **Diptyque maison (idée ICEdit) sur un modèle Apache.** Concaténer [référence | zone vide] et demander « right side : same character seen from the back » à klein 4B ou Qwen-Edit ; la moitié gauche ancre l'identité dans l'attention. Facile à fine-tuner avec ai-toolkit sur ses propres paires.
5. **LoRA « Multiple angles » comme pivot side ↔ top-down.** Les commandes caméra (« rotate the camera 45° right », « top-down view ») font une partie du travail de changement de perspective ; enchaîner par un img2img de style et un re-snap de grille.
6. **Grille cohérente + découpe content-aware.** Générer la planche de 4 vues d'un coup, découper par colonnes de pixels transparents (pas une grille fixe), puis normaliser la hauteur ; garder la planche comme *reference sheet* pour toutes les éditions ultérieures.
7. **Chroma vert + contour blanc dans le prompt**, puis chroma key HSV : détourage plus propre que rembg sur du pixel art, sans réseau.
8. **Générer grand, réduire en nearest.** Recette Pixel Art XL : les modèles ne respectent jamais « 32×32 » ; on vise 512–1024 puis on réduit ÷8–÷16 en nearest-neighbor et on quantifie vers la palette. (Le snapping de grille est couvert par un autre agent.)
9. **k candidats + tri automatique** plutôt qu'un seul essai : sur klein 4B, 6 candidats coûtent ~2 min ; le tri DINOv2/DreamSim rend le prep quasi déterministe.
10. **Cache d'embeddings et « anchors ».** Chaque personnage a un embedding DINOv2 d'ancrage (moyenne des vues validées) ; tout nouvel asset est comparé à son ancre. C'est l'algorithme de « The Chosen One » sans l'entraînement.
11. **Batch Style Aligned pour les familles d'objets** (10 potions, 8 épées) : une seule passe, style partagé, puis découpe.
12. **Versionner les modèles comme du code** : `model + quant + LoRA hash + seed + prompt` dans le style guide ; sans cela, la cohérence à trois semaines est impossible même avec les meilleures briques.

---

## 4. Pipelines d'assemblage recommandés

### 4.1 Reproduire le « prep » de SpriteCook en local (8 Go)

```
Codex (JSON) ─┬─ style guide : palette, prompt rendu, negative, LoRA style vX, modèle+quant
              └─ personnage : sprite de base validé, perspective verrouillée, embedding DINOv2 d'ancrage

[1] Préparation
    sprite 64 px → upscale ×8 nearest → 512 px (les éditeurs travaillent ≥ 512)
    + reference sheet (si déjà générée) en 2e image

[2] Prep « turn around » (direction)
    moteur : FLUX.2 klein 4B distilled, GGUF Q8 (4,3 Go) + Qwen3-4B fp8, ComfyUI-GGUF ou diffusers
    prompt : "same character, seen from the back, same pixel art style, same palette,
              flat colors, no gradients, green #00FF00 background, 2px white outline"
    k = 6 candidats (~20 s chacun sur RTX 3060 Ti) 
    → tri : DINOv2 cos ≥ seuil, DreamSim, écart palette ≤ seuil ; sinon relance (max 3 tours)
    (mode qualité : Qwen-Image-Edit-2511 GGUF Q4 + Lightning 4 pas + offload, ≥ 32 Go RAM,
     ou Nunchaku INT4 ; 2–5 min par édition)

[3] Prep « pose » (walk / jump / attack…)
    a) voie légère SDXL : IP-Adapter Plus (sprite de référence) + InstantStyle + LoRA style
       + ControlNet Union Xinsir openpose (squelette JSON de la bibliothèque, à l'échelle)
       ~8 Go avec offload ; 30–40 s
    b) voie éditeur : klein 4B avec reference sheet + instruction "walk pose, side view"
       (moins précis sur la pose)
    c) voie précise : Qwen-Image-Edit-2509+ keypoint (sprite + squelette) — API ou mode qualité

[4] Recollage au style
    img2img denoise 0,3 avec LoRA style + palette du Codex ; chroma key HSV ; réduction nearest ÷8 ;
    snapping de grille + quantisation palette (agent palette)

[5] Validation & persistance
    scores DINOv2 / DreamSim / palette stockés avec l'asset ; l'asset devient un nœud du graphe de preps
    (walk_back dérive de idle_back, comme chez SpriteCook) ; mise à jour de l'ancre du personnage
```

Coût VRAM : klein 4B Q8 (4,3 Go) + Qwen3-4B fp8 (~4 Go, déchargeable) + VAE ; ou SDXL fp16 + IP-Adapter + Union ≈ 8 Go avec offload séquentiel. CPU seul : klein 4B Q4 est utilisable (minutes par image) ; SD1.5 + ControlNet reste la voie CPU la plus réaliste.

### 4.2 Le même pipeline en API

Remplacer [2] et [3] par un appel unique multi-image : Qwen-Image-Edit-2511 (fal / Alibaba Model Studio / NVIDIA NIM), Kontext pro/max (BFL), Gemini image « Nano Banana » ou GPT-Image ; envoyer sprite + reference sheet + squelette rendu (Qwen accepte le keypoint ; Gemini/GPT le comprennent comme image de guidage). Conserver [1], [4], [5] en local : c'est là que se fait la cohérence (style guide, tri, snapping). Le backend expose une interface `EditEngine` (`edit(images[], instruction, control?) → candidats[]`) avec deux implémentations (locale / API) et une file de jobs ; le front ne voit que « prep en cours → 6 candidats → choix auto ou manuel ».

### 4.3 Garantir la cohérence Codex → assets

1. **Codex = source de vérité** : style guide sérialisé + par entité (personnage, prop, tuile) : prompt canonique, reference sheet, embedding d'ancrage, LoRA associé, historique des preps.
2. **Chaque génération part d'un asset validé** (jamais de zéro) — c'est le « Use / Ref / Edit / Style » de SpriteCook.
3. **LoRA de style** entraîné sur les assets validés (kohya, SDXL ou SD1.5, 8 Go) et réentraîné à chaque jalon ; version inscrite dans le style guide.
4. **Contrôle continu** : score de similarité à l'ancre + distance de palette sur *tout* asset entrant (généré, importé, API) ; drapeau « dérive » dans l'UI.
5. **Recollage systématique** (img2img faible denoise + palette) avant tout export.

---

## 5. Ce qu'il faudrait développer soi-même

1. **Bibliothèque de poses OpenPose JSON par perspective** (platformer / iso 4–8 dir / top-down 4 dir × idle, walk, run, jump, attack, hurt, death) à l'échelle sprite, avec rendu en image de contrôle (Pillow) et éditeur web (inspiré d'OpenPose-Studio, MIT ; éviter l'éditeur GPL).
2. **Rig mannequin Blender + script d'export OpenPose/depth** pour générer automatiquement des poses sous les directions exactes du jeu.
3. **Graphe de preps déclaratif** (YAML) : animation → prérequis → instruction → contrôle → seuils ; moteur d'exécution avec cache et reprise (équivalent du registre serveur de SpriteCook).
4. **Service de scoring** (FastAPI) : DINOv2/DINOv3 + DreamSim + palette ; ancres par entité ; détection de dérive ; tri des candidats.
5. **Découpe content-aware de planches** et normalisation (transparents → bounding boxes → alignement des pieds).
6. **Style guide sérialisé** et **presets** versionnés ; « recollage » img2img paramétré par le style guide.
7. **Pipeline d'entraînement automatisé** : dataset depuis le Codex (assets validés + tags structurés), kohya/ai-toolkit en tâche de fond, évaluation automatique (scores vs jeu de validation), promotion du LoRA.
8. **LoRA d'édition « turnaround pixel art »** sur FLUX.2 klein 4B base (Apache 2.0) avec ai-toolkit : paires générées par le pipeline lui-même (planches validées) — c'est le seul chemin vers un prep local qui respecte le pixel art sans dépendre d'une API.
9. **Abstraction `EditEngine` / `ControlEngine`** local ↔ API, avec estimation VRAM et fallback automatique (klein Q8 → klein Q4 → API).
10. **Préparation du sprite pour les éditeurs** (upscale nearest, marge, fond chroma) et retour (chroma key, downscale, snapping) — en Pillow/NumPy, pur CPU.

---

## 6. Sources

Édition par instruction
- FLUX.1 Kontext dev (licence, 12 B) : https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev — discussion licence v1.1 / outputs : https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev/discussions/6 — GGUF : https://huggingface.co/QuantStack/FLUX.1-Kontext-dev-GGUF/tree/main
- FLUX.2 klein 4B (Apache 2.0) : https://huggingface.co/black-forest-labs/FLUX.2-klein-4B — README FLUX.2 (licences par variante) : https://github.com/black-forest-labs/flux2/blob/main/README.md — blog Comfy (15 janv. 2026, VRAM 8,4 / 9,2 Go) : https://blog.comfy.org/p/flux2-klein-4b-fast-local-image-editing — doc Comfy : https://docs.comfy.org/tutorials/flux/flux-2-klein — GGUF : https://huggingface.co/unsloth/FLUX.2-klein-4B-GGUF — test 4B/9B : https://www.stablediffusiontutorials.com/2026/01/flux2-klein.html — temps sur 8 Go : https://localaimaster.com/blog/run-flux-on-low-vram-gpu
- Qwen-Image-Edit-2509 (Apache 2.0, ControlNet natif) : https://huggingface.co/Qwen/Qwen-Image-Edit-2509 — dépôt Qwen-Image (2511, 2512, 2.0) : https://github.com/QwenLM/Qwen-Image — blog Comfy 2511 : https://blog.comfy.org/p/qwen-image-edit-2511-and-qwen-image — VRAM 2511 : https://lilting.ch/en/articles/qwen-image-edit-2511-local-specs — GGUF 2509 : https://huggingface.co/QuantStack/Qwen-Image-Edit-2509-GGUF — test Lightning 16 Go : https://sandner.art/qwen-image-and-edit-local-gguf-generations-with-lightning/ — retours 6 Go : https://community.latenode.com/t/running-qwen-image-editor-gguf-q4-with-lora-training-on-6gb-gpu-memory/35807 — LoRA Multiple angles : https://huggingface.co/dx8152/Qwen-Edit-2509-Multiple-angles
- OmniGen2 : https://github.com/VectorSpaceLab/OmniGen2 — OmniGen (MIT) : https://github.com/VectorSpaceLab/OmniGen
- BAGEL : https://github.com/bytedance-seed/BAGEL
- Step1X-Edit : https://github.com/stepfun-ai/Step1X-Edit
- HiDream-E1 : https://github.com/HiDream-ai/HiDream-E1
- ICEdit : https://github.com/River-Zhang/ICEdit
- DreamO : https://github.com/bytedance/DreamO
- UNO : https://huggingface.co/bytedance-research/UNO
- Z-Image : https://github.com/Tongyi-MAI/Z-Image
- InstructPix2Pix : https://github.com/timothybrooks/instruct-pix2pix
- Nano Banana (propriétaire) — retours d'expérience sprites : https://roboticape.com/2026/03/07/generating-game-sprites-with-gemini-image-generation-nano-banana-pro-lessons-learned/ — character sheets : https://selfielabstudio.com/blog/nano-banana-pro-consistent-character-sheets-guide-20260216 — SpriteCook + Nano Banana 2 : https://www.spritecook.ai/blog/nanobanana-pixel-art-for-games

Référence / style / consistance
- IP-Adapter : https://github.com/tencent-ailab/IP-Adapter — InstantStyle : https://github.com/instantX-research/InstantStyle — XLabs FLUX IP-Adapter v2 : https://huggingface.co/XLabs-AI/flux-ip-adapter-v2 — FLUX Redux : https://huggingface.co/black-forest-labs/FLUX.1-Redux-dev
- OminiControl : https://github.com/Yuanshi9815/OminiControl — ACE++ : https://github.com/ali-vilab/ACE_plus — EasyControl : https://github.com/Xiaojiu-z/EasyControl — In-Context LoRA : https://github.com/ali-vilab/In-Context-LoRA
- Style Aligned : https://github.com/google/style-aligned — Visual Style Prompting / StyleKeeper : https://github.com/naver-ai/Visual-Style-Prompting — StyleID : https://github.com/jiwoogit/StyleID — CSGO : https://arxiv.org/html/2408.16766v2 — liste de méthodes : https://github.com/Westlake-AGI-Lab/Awesome-Style-Transfer-with-Diffusion-Models
- StoryDiffusion : https://github.com/HVision-NKU/StoryDiffusion — ConsiStory (NVIDIA NC) : https://github.com/NVlabs/consistory/blob/main/LICENSE — 1Prompt1Story : https://github.com/byliutao/1Prompt1Story — AnyStory : https://aigcdesigngroup.github.io/AnyStory/ — StoryMaker : https://github.com/RedAIGC/StoryMaker — The Chosen One : https://github.com/ZichengDuan/TheChosenOne

Pose / structure
- ControlNet v1.1 SD1.5 (OpenRAIL-M) : https://huggingface.co/lllyasviel/control_v11p_sd15_openpose — Xinsir Union SDXL (Apache 2.0) : https://huggingface.co/xinsir/controlnet-union-sdxl-1.0 — ControlNet++ : https://github.com/xinsir6/ControlNetPlus — FLUX Union Pro 2.0 (NC) : https://huggingface.co/Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro-2.0 — SD3.5 ControlNets : https://huggingface.co/stabilityai/stable-diffusion-3.5-controlnets — T2I-Adapter : https://github.com/TencentARC/T2I-Adapter
- DWPose : https://github.com/IDEA-Research/DWPose — ComfyUI-OpenPose-Studio (MIT) : https://github.com/andreszs/ComfyUI-OpenPose-Studio — ComfyUI-openpose-editor (GPL-3.0) : https://github.com/huchenlei/ComfyUI-openpose-editor — DiffSynth-Studio (ControlNet Qwen-Image) : https://github.com/modelscope/DiffSynth-Studio

Multi-vues / 3D
- CharacterGen : https://github.com/zjp-shadow/CharacterGen — MV-Adapter : https://github.com/huanngzh/MV-Adapter — Zero123++ : https://github.com/SUDO-AI-3D/zero123plus — Hunyuan3D-2 (licence, exclusion UE/UK/Corée) : https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/main/LICENSE — CharTurner : https://civitai.com/models/7252/charturnerbeta-lora-experimental

Entraînement
- kohya sd-scripts : https://github.com/kohya-ss/sd-scripts — guide FLUX (paliers 8/10/12/16/24 Go) : https://github.com/kohya-ss/sd-scripts/blob/sd3/docs/flux_train_network.md — OneTrainer (AGPL-3.0) : https://github.com/Nerogar/OneTrainer — ai-toolkit (MIT) : https://github.com/ostris/ai-toolkit — Pixel Art XL : https://huggingface.co/nerijs/pixel-art-xl

Inference basse VRAM et métriques
- Nunchaku (SVDQuant INT4) : https://github.com/mit-han-lab/nunchaku — ComfyUI-GGUF : https://github.com/city96/ComfyUI-GGUF
- DINOv3 (licence) : https://github.com/facebookresearch/dinov3 · https://github.com/facebookresearch/dinov3/blob/main/LICENSE.md — DreamSim (MIT) : https://github.com/ssundaram21/dreamsim
- Analyse SpriteCook (mécanisme de prep, coûts) : document projet `claude/spritecook-specs-fonctionnelles.html`
