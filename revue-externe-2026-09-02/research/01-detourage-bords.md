# 01 — Détourage, matting et nettoyage des bords d'assets 2D générés par IA

> Recherche technique (septembre 2026) — solutions **open source uniquement**, licences vérifiées sur GitHub / Hugging Face. Les outils propriétaires ne sont cités qu'en référence et sont marqués **[PROPRIÉTAIRE]**. Les licences problématiques pour des assets destinés à des jeux commerciaux sont marquées **⚠ NON-COMMERCIAL** ou **⚠ COPYLEFT**.
>
> Contexte : app concurrente de SpriteCook (mode « Basic » gratuit, mode « Pro » payant, « Edge cleanup », paramètre `alpha_cutoff`). Backend Python 3.11 / FastAPI / Pillow / NumPy / rembg-onnxruntime ; front React 19 + TS + Vite. Cible : GPU NVIDIA 8 Go (RTX 3080 en dev), doit aussi tourner sur CPU seul.

---

## 1. Les problèmes / verrous à résoudre

Une image générée par IA (SDXL, Flux, Retro Diffusion, GPT-Image, Gemini…) arrive presque toujours **avec un fond** (uni, dégradé, damier « faux transparent », décor). Pour en faire un sprite exploitable dans un moteur de jeu, il faut résoudre huit sous-problèmes distincts :

1. **Détourage automatique « saillance »** — trouver le sujet sans aucune intervention (mode Basic). Verrou : les modèles sont entraînés sur des photos ; sur des illustrations / cartoon / pixel art ils coupent des accessoires, avalent les ombres portées ou produisent des bords « mous ».
2. **Sélection interactive / sémantique** — l'utilisateur clique sur ce qu'il veut (« le personnage », « l'épée » d'une planche multi-objets) ou le décrit en texte. Verrou : latence, VRAM, et la possibilité de le faire **côté navigateur** pour un feedback instantané.
3. **Détourage sans IA** — beaucoup d'images générées ont un fond uni (blanc, magenta demandé dans le prompt, damier). Un algorithme (flood fill, chroma key) est plus rapide, déterministe et souvent *plus précis* qu'un réseau. Verrou : savoir *quand* l'algo suffit (score de confiance) et éviter les fuites (fond qui « rentre » par les trous).
4. **Raffinement des bords (matting)** — passer d'un masque binaire ou flou à un alpha propre : cheveux, effets de lueur, semi-transparences. Verrou : coût CPU des méthodes closed-form, et « frange » (halo clair ou sombre) qui reste visible une fois composé sur un autre fond → **décontamination des couleurs**.
5. **Alpha binaire pour le pixel art** — un sprite pixel art n'a pas d'alpha intermédiaire : il faut seuiller (`alpha_cutoff`), nettoyer les îlots, remplir les trous, et surtout travailler **à la vraie résolution de la grille** (l'IA sort du 1024×1024 « faux pixel art » à grille irrégulière).
6. **Contours** — générer un outline 1 px (4 ou 8-connexe), le recolorer, nettoyer les lignes (jaggies), ou vectoriser (SVG) pour un rendu HD.
7. **Animations** — cohérence du masque d'une frame à l'autre (pas de clignotement d'alpha, pas d'accessoire qui disparaît sur 2 frames sur 8).
8. **Planches multi-sprites** — après détourage, découper automatiquement en cellules (composantes connexes), gérer les pièces détachées (arme, projectile).

Transversal : **licences** (beaucoup de « meilleurs » modèles sont CC-BY-NC ou S-Lab), **empreinte VRAM** (≤ 8 Go, et fallback CPU), et **évaluation** (aucun benchmark public sérieux sur illustrations/pixel art — il faudra le construire).

---

## 2. Solutions par problème

### 2.1 Détourage automatique (modèles de saillance / DIS / matting trimap-free)

| Nom | URL | Licence | Langage | Type | Maturité (activité, ★) | VRAM / CPU | Intégration (1-5) | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **rembg** (wrapper) | github.com/danielgatis/rembg | MIT | Python (onnxruntime) | lib | v2.0.76 (juin 2026), 23,2 k★ | CPU ok ; CUDA/ROCm via onnxruntime | 1 | Dépend du modèle choisi ; 15 modèles : u2net, u2netp, silueta, isnet-general-use, **isnet-anime**, sam, birefnet-general/-lite/-portrait/-dis/-hrsod/-cod, u2net_human_seg, u2net_cloth_seg, **bria-rmbg (⚠ NON-COMMERCIAL)** | Déjà dans la stack. Inclut alpha matting (pymatting) et `post_process_mask`. |
| **U²-Net** (u2net / u2netp) | github.com/xuebinqin/U-2-Net | Apache-2.0 | PyTorch/ONNX | modèle | 9,9 k★, dernier commit 2022 (figé) | u2net 176 Mo, u2netp 4,7 Mo ; CPU ~1 s | 1 | Bords mous, perd les fines structures ; u2netp très rapide mais grossier | Baseline CPU historique. |
| **IS-Net / DIS** (isnet-general-use) | github.com/xuebinqin/DIS | Apache-2.0 (code + poids) | PyTorch/ONNX | modèle | 2,6 k★, 2022, figé | ~170 Mo ; CPU 1-2 s | 1 | Meilleur que u2net sur objets à contour complexe ; dataset DIS5K a ses propres CGU (n'affecte pas l'inférence) | Le modèle utilisé par `@imgly/background-removal`. |
| **isnet-anime** (anime-segmentation) | github.com/SkyTNT/anime-segmentation | Apache-2.0 | PyTorch/ONNX | modèle | 818★, 2023 (figé mais stable) | ~170 Mo ; CPU 1-2 s | 1 | Entraîné spécifiquement sur personnages anime (AniSeg + curation manuelle) ; **le seul modèle « illustration » Apache** ; faible sur objets non-personnage (items, tuiles) | Dispo dans rembg (`isnet-anime`). |
| **BiRefNet** (general, general-lite, HR, dynamic, matting, HR-matting, portrait, DIS, COD) | github.com/ZhengPeng7/BiRefNet | MIT (code + poids HF) | PyTorch ; ONNX dispo | modèle | ~4 k★, MAJ sept. 2025 (SDPA), dynamic mars 2025 | **FP16 : 3,45 Go VRAM @1024², 57,7 ms sur RTX 4090** ; Swin-L ; ONNX « ~90 % plus lent » ; CPU plusieurs secondes | 2 | État de l'art open source sur DIS5K (S 0.911). HR (2048²) et dynamic (256→2304) pour haute résolution. Pas de variante illustration officielle | **Le choix Pro**. general-lite (Swin-T) pour GPU faibles. |
| **Lucida** (BiRefNet_HR fine-tune) | github.com/egeorcun/lucida | MIT (poids) — ⚠ certaines sources d'entraînement non commerciales | PyTorch | modèle | 5★, v1.1 juillet 2026 (très jeune) | comme BiRefNet_HR (~3,5 Go FP16) | 2 | Fine-tune ciblé : verre, camouflage, texte, **glow/VFX, line art, illustrations** ; annonce « meilleur sur illustration » que InSPyReNet, RMBG-2.0, BiRefNet-HR sur 191 images | À tester en priorité pour le style « detailed ». Risque juridique faible mais réel (données). |
| **BEN2** | huggingface.co/PramaLLC/BEN2 | MIT (base) ; version « enhanced » **[PROPRIÉTAIRE]** | PyTorch ; ONNX (onnx-community/BEN2-ONNX, MIT) | modèle | arXiv 2501.06230 (janv. 2025) | 94,6 M params ; « batch ≤ 3 sur GPU grand public » | 2 | Bon sur cheveux/bords (confidence-guided matting) ; conçu photo | Existe en pipeline `background-removal` transformers.js. |
| **InSPyReNet / transparent-background** | github.com/plemeri/transparent-background | MIT | PyTorch (pas d'ONNX officiel) | modèle + CLI | 1,2 k★, v1.3.4 mai 2025 ; >500 k dl | SwinB ; GPU ~1-2 Go ; CPU lent ; modes base / fast / base-nightly | 2 | Très bon sur objets « posés » ; base-nightly = meilleurs bords ; entraîné DUTS+DIS5K (photos) | Support MPS. |
| **RMBG-2.0** (BriaAI) | huggingface.co/briaai/RMBG-2.0 | **⚠ CC-BY-NC-4.0 — NON-COMMERCIAL** (accord commercial payant Bria) | PyTorch/ONNX | modèle | 1,39 k♥, 674 k dl/mois | 0,2 B params, 1024² (archi BiRefNet) | 2 | Excellent, mais **interdit** pour vos utilisateurs commerciaux | Référence qualité seulement. RMBG-1.4 : licence Bria également non commerciale. |
| **MODNet** | github.com/ZHKKKe/MODNet | Apache-2.0 | PyTorch/ONNX | modèle | ~4 k★, figé | léger, temps réel CPU | 1 | Portrait humain uniquement → inutile pour sprites | Cité pour exhaustivité. |
| **CartoonSegmentation / AnimeInstanceSegmentation** | github.com/CartoonSegmentation/CartoonSegmentation | poids MIT (HF dreMaz) ; licence dépôt non explicitée | PyTorch + mmdet/mmcv | modèle | 199★, 2024 | GPU requis (mmdet lourd) | 4 | Segmentation **d'instances** de personnages cartoon (plusieurs persos sur une image) | Intégration lourde (mmcv 2.1/CUDA 11.8). Utile pour planches multi-perso. |
| **Depth Anything V2 (small)** | github.com/DepthAnything/Depth-Anything-V2 | **Small : Apache-2.0** ; Base/Large/Giant : ⚠ CC-BY-NC-4.0 | PyTorch/ONNX | modèle (aide) | très actif | small ~25 M params, CPU ok | 2 | Pas un détoureur : carte de profondeur pour séparer premier plan / décor en cas d'échec de la saillance | Issue #320 : incertitude sur les données d'entraînement. |
| SpriteCook « Basic / Pro », remove.bg, Photoroom, Ideogram BG | — | **[PROPRIÉTAIRE]** | — | API | — | — | — | Références de qualité ; Lucida se compare à Ideogram | Ne pas intégrer. |

**Comparaison.** Sur des photos, l'ordre de qualité 2025-2026 est grosso modo RMBG-2.0 ≈ BiRefNet-HR ≈ BEN2 > InSPyReNet > IS-Net > U²-Net. Sur des **illustrations**, il n'existe aucun benchmark public sérieux ; les seuls signaux sont (a) `isnet-anime`, entraîné uniquement sur personnages anime (mais faible sur objets), (b) Lucida, dont l'auteur revendique la meilleure note « illustration » de son jeu de test privé de 191 images, et (c) les retours communautaires (ComfyUI-RMBG, 2,1 k★, MAJ juillet 2026, qui a ajouté Lucida en variante « illustrations/glow »). Le tableau est dominé par une contrainte de licence : **RMBG-1.4/2.0 sont exclus** (CC-BY-NC), ce qui laisse BiRefNet (MIT) comme colonne vertébrale et BEN2 (MIT) comme alternative plus légère.

**Recommandation.** Mode Basic : `isnet-anime` (personnages) et `isnet-general-use` (items/tuiles) via rembg/onnxruntime CPU, choisis par un routeur simple (voir §4). Mode Pro : **BiRefNet** (general pour ≤1024, HR/dynamic pour 2048, Lucida comme option « illustration ») en FP16 (3,5 Go VRAM → tient sur 8 Go avec le générateur déchargé), et **BiRefNet-general-lite** comme repli GPU 4-6 Go. Garder BEN2 en option A/B.

### 2.2 Segmentation interactive et par texte (clic, boîte, « the sword »)

| Nom | URL | Licence | Langage | Type | Maturité | VRAM / CPU | Intégration | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **SAM 2 / 2.1** (hiera tiny/small/base+/large) | github.com/facebookresearch/sam2 | Apache-2.0 | PyTorch | modèle | 19,8 k★, MAJ déc. 2024 | tiny 38,9 M (91 FPS A100), small 46 M, base+ 80,8 M, large 224 M ; tiny/small tournent sur CPU (secondes) | 2 | Image + **vidéo** (propagation de masque) ; excellent sur objets nets ; bords parfois « escaliers » | Base de tout le reste. |
| **SAM 3 / 3.1** | github.com/facebookresearch/sam3 | **« SAM License » Meta** (custom, commercial OK ; interdictions ITAR/militaire, attribution recherche ; **non-OSI**) ; poids HF *gated* | PyTorch (CUDA 12.6+, torch 2.7+) | modèle | 11,2 k★ ; SAM 3.1 27 mars 2026 | **848 M params** — lourd (benchmarks sur H100/H200) ; pas de variante small officielle | 3 | **Prompts texte** (« noun phrases ») + exemplaires + points/boîtes ; détection + segmentation + tracking multi-objets | Alternative complète à GroundingDINO+SAM. Vérifier la licence avec un juriste (non-OSI mais permissive). |
| **SAM 3 Tracker ONNX (transformers.js)** | huggingface.co/onnx-community/sam3-tracker-ONNX | licence SAM (héritée) | JS/ONNX | modèle web | démo WebGPU webml-community/SAM3-Tracker-WebGPU | navigateur WebGPU | 3 | Clic-pour-sélectionner côté client (points +/-) ; 13 variantes quantifiées | Encodage lourd ; réserver aux GPU clients. |
| **MobileSAM** | github.com/ChaoningZhang/MobileSAM | Apache-2.0 | PyTorch/ONNX | modèle | 5,8 k★, 2023 | 9,66 M params, 12 ms/img GPU ; CPU < 1 s | 1 | Encodeur ViT-Tiny distillé ; masques un peu moins fins que SAM-H | Idéal navigateur / CPU. |
| **SlimSAM** (Xenova/slimsam-50-uniform) | github.com/czg1225/SlimSAM | Apache-2.0 | PyTorch ; ONNX transformers.js | modèle | 360★, déc. 2023 | 9,1 M params | 1 | Élagage de SAM ; démo officielle transformers.js « segment-anything-webgpu » | Chemin le plus court vers un clic-sélection React. |
| **EfficientSAM** (Ti / S) | github.com/yformer/EfficientSAM | Apache-2.0 | PyTorch ; ONNX enc/dec sur HF | modèle | 2,5 k★, janv. 2024 | Ti ~10 M | 2 | Meilleure qualité que MobileSAM à taille proche | — |
| **EfficientViT-SAM** (L0-XL1) | github.com/mit-han-lab/efficientvit | Apache-2.0 | PyTorch ; ONNX/TensorRT | modèle | 3,3 k★, actif 2025 | L0 très rapide (48,9× SAM-H en TensorRT) | 2 | Qualité proche SAM-H sur L1/L2 | Bon compromis serveur. |
| **HQ-SAM / Light HQ-SAM / HQ-SAM 2** | github.com/SysCV/sam-hq | Apache-2.0 | PyTorch ; ONNX ; intégré transformers (juin 2025) | modèle | 4,2 k★ ; HQ-SAM 2 nov. 2024 | Light (ViT-Tiny) 41 FPS | 2 | **Bords plus fins** que SAM (token HQ) → utile pour fines structures (cheveux, lances) | Variante à privilégier quand SAM « arrondit ». |
| **EdgeSAM** | github.com/chongzhou96/EdgeSAM | **⚠ NTU S-Lab 1.0 — NON-COMMERCIAL** | PyTorch/ONNX/CoreML | modèle | 1,2 k★, 2024 | 9,6 M, 38,7 FPS iPhone 14 | — | Exclu pour usage commercial | — |
| **FastSAM** | github.com/CASIA-IVA-Lab/FastSAM ; docs.ultralytics.com | **⚠ AGPL-3.0** (ultralytics) | PyTorch | modèle | populaire | rapide | — | Copyleft fort (AGPL) : contamine un backend SaaS sauf licence Ultralytics payante | À éviter. |
| **GroundingDINO** (Swin-T/B) | github.com/IDEA-Research/GroundingDINO | Apache-2.0 | PyTorch ; dans transformers | modèle | 10,5 k★ | Swin-T ~172 M, ~2 Go VRAM | 2 | Détection par texte ouvert → boîte → SAM. **Grounding DINO 1.5/1.6 sont API-only [PROPRIÉTAIRE]** | Le combo « texte → masque » open source de référence. |
| **Grounded-SAM-2** | github.com/IDEA-Research/Grounded-SAM-2 | Apache-2.0 | PyTorch | pipeline | actif | GroundingDINO + SAM 2 | 3 | Texte → détection → segmentation → tracking vidéo | Alternative à SAM 3 avec licences 100 % Apache. |
| **EfficientTAM** | github.com/yformer/EfficientTAM | Apache-2.0 | PyTorch | modèle | 814★, janv. 2025 | >10 FPS iPhone 15 | 2 | SAM 2 allégé pour vidéo (tracking) | Pour l'animation sur petit GPU. |
| **Matte-Anything** | github.com/hustvl/Matte-Anything | MIT | PyTorch | pipeline | 588★, mai 2024 | SAM + GroundingDINO + ViTMatte : ~6-8 Go | 3 | Génère un pseudo-trimap depuis SAM puis matting ViTMatte → alpha doux | Modèle mental à reproduire avec nos briques. |
| **SDMatte** (ICCV 2025) | github.com/vivoCameraResearch/SDMatte | MIT | PyTorch (diffusion) | modèle | nœud ComfyUI dispo | lourd (Stable Diffusion) — VRAM non documentée, probablement > 8 Go en FP32 | 4 | Matting interactif (points/boîtes/masques) par diffusion ; qualité très haute | Option « Pro+ » future. |
| **GrabCut** (OpenCV) | docs.opencv.org (`cv.grabCut`) | Apache-2.0 | C++/Python | algo | stable | CPU, 0,2-2 s selon taille/itérations | 1 | GMM + graph-cut ; boîte ou masque initial ; rate les cheveux / fines structures | Repli CPU sans modèle pour « boîte → masque ». |
| Navigateur : **webgpu-sam2**, **next-sam**, **SAM-in-Browser**, **segment-anything-webgpu** | github.com/lucasgelfond/webgpu-sam2 ; github.com/geronimi73/next-sam ; HF webml-community | MIT (next-sam) / non précisée (webgpu-sam2) / Apache (transformers.js) | TS + onnxruntime-web | démo | 179★ / 85★ | encodeur SAM2 > 100 Mo, décodeur ~20 Mo ; cache OPFS ; WebGPU Chrome/Edge, CPU-WASM ailleurs ; échec iOS | 3 | Preuve que le clic-sélection 100 % client est faisable ; l'encodage image se fait une fois, les clics sont instantanés | Modèle d'architecture pour notre front React. |

**Comparaison.** Pour du « clic → masque », la famille SAM est sans concurrent. Le choix se fait sur trois axes : (1) *licence* — SAM 2 et les distillations MobileSAM / SlimSAM / EfficientSAM / HQ-SAM / EfficientViT-SAM sont Apache ; EdgeSAM (S-Lab) et FastSAM (AGPL) sont à écarter ; SAM 3 est sous licence Meta permissive mais non-OSI et *gated* ; (2) *finesse des bords* — HQ-SAM > SAM 2 > MobileSAM ; (3) *où ça tourne* — SlimSAM / MobileSAM / SAM 2 tiny sont exécutables dans le navigateur via transformers.js + WebGPU (img.ly mesure ~100 ms par inférence en WebGPU fp16 contre ~2 s en WASM 16 threads sur M3 Max, sur un ISNet ; les fichiers fp16 font ~84 Mo). Pour le **texte**, deux voies : GroundingDINO-T + SAM 2 (tout Apache, ~2,5 Go VRAM) ou SAM 3 (848 M params, un seul modèle, plus lourd, licence à valider).

**Recommandation.** Serveur Pro : **SAM 2.1 small/base+** (ou **HQ-SAM 2** pour les bords) avec un cache d'embedding par image ; texte via **GroundingDINO-T → SAM 2**. Client : **SlimSAM-50 ou SAM 2.1 tiny en ONNX via transformers.js/WebGPU** pour la sélection au clic instantanée, avec repli serveur si WebGPU absent. Garder SAM 3 en veille (licence + variante légère « EfficientSAM3 » communautaire encore expérimentale).

### 2.3 Détourage sans IA (fond uni, chroma key, damier)

| Nom | URL | Licence | Langage | Type | Maturité | CPU | Intégration | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Flood fill depuis les coins + distance Lab** | OpenCV `floodFill` / scipy `ndimage.label` / scikit-image `flood` | Apache-2.0 / BSD-3 | Python | algo | — | < 50 ms | 1 | Parfait sur fond uni ; échoue si le sprite touche le bord ou contient la couleur du fond ; fuites par les « trous » diagonaux (utiliser 4-connexité) | À développer (voir §5). |
| **Chroma key + despill** | (à implémenter : distance angulaire en HSV/YCbCr ou Lab, soft-key par double seuil) | — | Python/NumPy | algo | — | < 50 ms | 2 | Nécessite de prompter « solid magenta/green background » ; les générateurs ajoutent souvent ombre/vignette ; besoin d'un **despill** pour la frange verte | Très efficace sur pixel art et icônes. |
| **Damier de transparence détecté** | (à implémenter : autocorrélation 2D / FFT sur la luminance) | — | Python | algo | — | < 100 ms | 3 | Les générateurs dessinent parfois un damier gris/blanc « façon Photoshop » ; on détecte la période et on segmente les cases | Rare mais réel avec GPT-Image. |
| **GrabCut** | OpenCV | Apache-2.0 | Python | algo | stable | 0,2-2 s | 1 | Voir 2.2 ; bon repli sans modèle sur fond texturé simple | — |
| **PixelRefiner** | github.com/HappyOnigiri/PixelRefiner | MIT | TypeScript (Web Workers) | app web | v0.11.1, 25★, actif | navigateur | 3 (réutiliser le code) | Auto-transparence par couleur des coins + tolérance + pipette, remplissage des trous, suppression du bruit isolé, k-means Oklab, dithering, **génération d'outline** | Excellente référence d'UX pour le mode pixel art. |
| **Pixel-Extractor** | github.com/univeous/Pixel-Extractor | MIT | React/TS + Pyodide (NumPy/SciPy/skimage) | app web/PWA | 21★ | navigateur | 3 | Détection de grille (dont pixels non carrés), suppression de fond auto + override manuel, quantification histogramme/k-means | Preuve que scipy/skimage tournent en WASM dans un front React. |
| **proper-pixel-art** | github.com/KennethJAllen/proper-pixel-art | MIT | Python (OpenCV) | lib/CLI | 453★, v1.4.1 janv. 2026 | CPU | 2 | Grille par Canny + fermeture + Hough probabiliste + clustering ; alpha > 50 % ; reconstruction par couleur majoritaire | Le plus solide pour « retrouver la vraie grille ». |
| **pixeldetector** (Astropulse) | github.com/Astropulse/pixeldetector | MIT | Python (NumPy/SciPy) | lib | 348★ | CPU | 1 | Détecte l'échelle, downscale, réduit la palette ; utilisé dans Aseprite via Retro Diffusion | Simple et éprouvé. |
| **fixelart** | github.com/golota60/fixelart | non précisée ⚠ | TS | lib | 41★ | — | — | Vote majoritaire par bloc | Licence absente → ne pas copier. |
| **LayerDiffuse** | github.com/lllyasviel/sd-forge-layerdiffuse ; ports diffusers (rootonchair) | Apache-2.0 | PyTorch | modèle (génération) | 4,1 k★ | SD1.5 / SDXL | 3 | **Génère directement du RGBA** (latent transparency) → plus rien à détourer | Contournement du problème ; pas de port Flux officiel. |

**Comparaison.** Sur une image générée avec un fond uni demandé dans le prompt, un flood fill 4-connexe en espace Lab avec tolérance ΔE ≈ 8-12 depuis les 4 coins donne un masque *pixel-perfect* en quelques millisecondes, là où un réseau à 1024² rééchantillonne et adoucit les bords. Le chroma key est supérieur lorsque le fond n'est pas parfaitement uni (dégradé léger) car il tolère les variations de luminance. Les deux échouent si le sujet touche le cadre ou partage la couleur du fond — d'où l'importance d'un **score de confiance** (fraction de pixels de bord classés fond, nombre de composantes, présence de la couleur de fond à l'intérieur) pour basculer sur un modèle.

**Recommandation.** Faire de la détection de fond uni la **première étape de tous les modes** (Basic, Pro, pixel art). Si confiance ≥ seuil → sortie directe ; sinon → modèle. Réutiliser les idées de PixelRefiner (MIT) et proper-pixel-art (MIT) pour le pixel art ; évaluer LayerDiffuse côté génération SDXL pour supprimer le problème à la source.

### 2.4 Raffinement des bords : matting, décontamination, halos, export

| Nom | URL | Licence | Langage | Type | Maturité | CPU / VRAM | Intégration | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **pymatting** | github.com/pymatting/pymatting | MIT | Python (Numba, SciPy) | lib | 1,9 k★, v1.1.15 janv. 2026 | CPU (multithread) ; foreground ML aussi CUDA/OpenCL | 1 | Closed-form, KNN, LKM, learning-based, random-walk, shared-sampling ; `estimate_foreground_ml` (Fast Multi-Level Foreground Estimation) pour la **décontamination** ; closed-form coûteux sur grandes images (résoudre sur la bande inconnue seulement) | Déjà tiré par rembg (`alpha_matting`). |
| rembg `alpha_matting` | rembg/bg.py | MIT | Python | fonction | — | CPU | 1 | Trimap par seuils (fg 240 / bg 10) + érosion (10 px) → `estimate_alpha_cf` → `estimate_foreground_ml` | Bon point de départ ; paramètres à exposer comme « Edge cleanup ». |
| rembg `post_process_mask` | idem | MIT | Python | fonction | — | CPU | 1 | Ouverture (disque) + flou gaussien σ=2 + seuil 127 → masque binaire lissé | Équivalent d'un « cleanup » basique. |
| **ViTMatte** | github.com/hustvl/ViTMatte ; dans `transformers` | MIT (code) ; ⚠ poids entraînés sur Composition-1k (Adobe) — question commerciale ouverte (issue #9 sans réponse) | PyTorch | modèle (trimap → alpha) | ~400★, 2024 | ViT-S ~25 M, < 2 Go | 2 | Meilleur matting trimap open source ; nécessite un trimap (à générer par érosion/dilatation) | Risque juridique faible mais documenter. |
| **BiRefNet-matting / HR-matting** | HF ZhengPeng7 | MIT | PyTorch | modèle | 2025 | ~3,5 Go FP16 | 2 | Matting trimap-free ; entraîné portrait (P3M) — bords doux directement | Alternative « un seul passage » en mode Pro. |
| **Guided filter** (`cv.ximgproc.guidedFilter`) | opencv_contrib | Apache-2.0 | C++/Python | algo | stable | CPU < 100 ms | 1 | Raffine un alpha grossier en suivant les bords de l'image guide ; peut réintroduire du halo si rayon trop grand | Idéal pour « upscaler » un masque 1024 vers 2048 en suivant l'image. |
| **alpha-bleeding** (urraka) / alpha-bleeder (Rust) / pixelbleed | github.com/urraka/alpha-bleeding | MIT | C++ / Rust | outil | ancien mais trivial | — | 1 (réimplémenter en NumPy) | Propage la couleur des pixels de bord dans les pixels 100 % transparents → supprime le **halo sombre au filtrage bilinéaire / mipmap** dans le moteur | Étape d'export indispensable (Castle Game Engine documente le problème). |
| **scikit-image / scipy.ndimage** | scikit-image.org | BSD-3 | Python | lib | très actif | CPU | 1 | `remove_small_objects`, `remove_small_holes`, `binary_fill_holes`, ouverture/fermeture, `label` | Boîte à outils du nettoyage. |

**Comparaison.** Deux philosophies : (a) *matting trimap-free* dans le modèle (BiRefNet-matting, BEN2) — un seul passage, bords doux, mais sans contrôle ; (b) *segmentation puis raffinement* (masque → trimap → closed-form/ViTMatte → foreground estimation) — plus lent (closed-form sur 2048² peut prendre plusieurs secondes CPU) mais réglable (« Edge cleanup » à curseurs) et applicable à n'importe quel masque, y compris SAM. La **décontamination** est le point souvent oublié : sans ré-estimation des couleurs de premier plan, un sprite détouré sur fond blanc garde une frange claire, visible dès qu'on le pose sur un fond sombre. `estimate_foreground_ml` (pymatting) le résout en ~100-300 ms CPU sur 1024². Enfin, pour l'**export**, l'alpha bleeding (ou l'export en alpha prémultiplié si le moteur le supporte) évite les halos noirs au rendu.

**Recommandation.** Pipeline Pro : masque → trimap (érosion/dilatation paramétrées par `edge_width`) → `estimate_alpha_cf` limité à la bande inconnue (ou ViTMatte-S si GPU) → `estimate_foreground_ml` → guided filter léger (r=2-4) → alpha bleeding à l'export. Mode Basic : uniquement `post_process_mask` + foreground ML + bleeding.

### 2.5 Alpha binaire, nettoyage et grille pour le pixel art

| Nom | URL | Licence | Langage | Type | Maturité | CPU | Intégration | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Seuil `alpha_cutoff` + hystérésis | NumPy / skimage `apply_hysteresis_threshold` | BSD-3 | Python | algo | — | ms | 1 | Un seuil simple crée des bords crénelés aléatoires ; l'hystérésis (bas/haut) garde les zones connectées aux pixels sûrs | Le paramètre SpriteCook `alpha_cutoff` = un seuil unique. |
| Morphologie binaire (ouverture/fermeture, îlots, trous) | scipy.ndimage / skimage.morphology / OpenCV | BSD-3 / Apache-2.0 | Python | algo | — | ms | 1 | `remove_small_objects(min_size)`, `remove_small_holes(area_threshold)`, `binary_fill_holes` ; attention aux trous *volontaires* (anse, entre bras et corps) → ne remplir que sous une taille max | — |
| **proper-pixel-art** (grille) | voir 2.3 | MIT | Python | lib | 453★ | ms-s | 2 | Retrouve la grille réelle (Canny + Hough) ; échantillonne la couleur majoritaire par cellule | Première brique du mode pixel art. |
| **pixeldetector** | voir 2.3 | MIT | Python | lib | 348★ | ms | 1 | Détection d'échelle + palette | Plus simple, moins robuste sur grilles irrégulières. |
| PixelRefiner (îlots/trous/tolérance) | voir 2.3 | MIT | TS | app | actif | navigateur | 3 | UX de référence (curseurs tolérance, hole fill, noise) | À transposer. |

**Comparaison / recommandation.** Le pixel art impose une règle : **détourer à la vraie résolution**, jamais en 1024². Ordre : (1) retrouver la grille (proper-pixel-art) et réduire par couleur majoritaire ; (2) détourer sur la petite image (flood fill Lab ; fallback : masque IA calculé sur l'image haute résolution puis réduit par vote majoritaire par cellule) ; (3) binariser avec hystérésis (bas = `alpha_cutoff`-0,15, haut = `alpha_cutoff`+0,15) ; (4) `remove_small_objects` (min_size proportionnel, ex. 0,2 % de l'aire du sprite) et `remove_small_holes` avec plafond ; (5) option « garder N plus grosses composantes ». Tout ça est du NumPy/SciPy en quelques millisecondes — pas de GPU.

### 2.6 Contours : outline, détection, nettoyage de lignes, vectorisation

| Nom | URL | Licence | Langage | Type | Maturité | CPU | Intégration | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Outline par dilatation d'alpha | scipy `binary_dilation` (structure croix = 4-connexe, carré = 8-connexe) | BSD-3 | Python | algo | — | ms | 1 | Outline 1 px extérieur = dilaté XOR original ; intérieur = original XOR érodé ; couleur = fixe, ou dérivée (couleur de bord assombrie en Oklab), ou plus proche de la palette | Pixel art : préférer 4-connexe (pas de « coins » diagonaux). PixelRefiner l'implémente. |
| Détection de contours (Canny, Sobel, `findContours`) | OpenCV | Apache-2.0 | Python | algo | — | ms | 1 | `findContours` sur l'alpha binaire donne des polygones (hitboxes, collisions) | Utile pour exporter des polygones de collision. |
| Nettoyage de lignes 1 px (jaggies) | (à implémenter : squelettisation `skimage.skeletonize` + reconnection ; ou re-tracer via vectorisation → rasterisation) | BSD-3 | Python | algo | — | ms | 3 | Aucun outil clé en main open source pour « lignes propres pixel art » ; les réseaux de sketch-cleanup (Simo-Serra) sont **⚠ NON-COMMERCIAL** | R&D interne. |
| **vtracer** | github.com/visioncortex/vtracer | MIT | Rust ; `pip install vtracer` ; npm WASM `@visioncortex/vtracer` | lib | 6,6 k★, 1.0.0-alpha.3 | CPU, ms-s | 1 | Couleur, modes pixel/polygon/spline, `filter_speckle`, `color_precision`, hiérarchie stacked/cutout | Vectorisation HD ; mode `pixel` = contours exacts pour pixel art. |
| **potrace / pypotrace** | potrace.sourceforge.net | **⚠ GPL-2.0+ (copyleft)** | C ; Python | lib | 1.16 (2019), figé | ms | 1 | N&B uniquement, très propre ; copyleft : acceptable pour une app open source GPL, problématique si backend sous licence permissive / SaaS avec code fermé | Préférer vtracer. |
| **Depixelizing Pixel Art** (Kopf-Lischinski 2011) — implémentations | github.com/rjalfa/depixelize ; github.com/TableauBits/DePyxelizer (Python) ; pypi `depixelizer` 0.0.2 (2022, networkx/svgwrite) ; Inkscape *libdepixelize* (« Trace Bitmap > Pixel art », GPL-2+) | variées (souvent non précisées ⚠) ; Inkscape GPL | Python / C++ | algo | projets étudiants, peu maintenus | ms | 4 | Transforme le pixel art en splines lisses (graphe de similarité → Voronoi → B-splines) ; aucune implémentation Python maintenue et sous licence claire | Utile pour l'export « HD depuis pixel art » ; à réimplémenter (algorithme public, ~1 000 lignes). |
| und3f/vectorize-pixelart ; michaelrbk/pixelart-vectorizer | GitHub | à vérifier | JS/Python | outils | petits | ms | 2 | Vectorisation « escaliers » exacte (un rect par pixel fusionné) | Équivalent du mode `pixel` de vtracer. |

**Recommandation.** Outline : implémentation maison NumPy (10 lignes), avec options 4/8-connexe, épaisseur, couleur fixe / dérivée / palette. Contours de collision : `findContours` + `approxPolyDP`. Vectorisation : **vtracer** (MIT, bindings Python et WASM — donc aussi côté client). Éviter potrace (GPL) sauf si toute l'app est GPL. Depixelizing : réimplémentation interne si le besoin « pixel → HD lisse » est confirmé.

### 2.7 Détourage d'animations (cohérence temporelle)

| Nom | URL | Licence | Type | VRAM | Intégration | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|
| **SAM 2.1 VideoPredictor** | facebookresearch/sam2 | Apache-2.0 | modèle | tiny/small : 2-4 Go | 2 | `add_new_points_or_box` sur la frame 0 puis `propagate_in_video` ; mémoire temporelle → masque stable ; conçu pour vidéo réelle, mais fonctionne sur séquences de sprites (peu de frames, grands déplacements → fournir un prompt masque, pas seulement des points) | Cœur du mode animation Pro. |
| **EfficientTAM** | yformer/EfficientTAM | Apache-2.0 | modèle | faible | 2 | Même API, plus léger | Petit GPU / CPU. |
| **Grounded-SAM-2** | IDEA-Research | Apache-2.0 | pipeline | ~3-4 Go | 3 | Texte → tracking | — |
| **MatAnyone / MatAnyone 2** (CVPR 2025/2026) | pq-yang | **⚠ NTU S-Lab — NON-COMMERCIAL** | modèle | — | — | Meilleur video matting open (mémoire + évaluateur de qualité) ; **exclu** | Référence uniquement. |
| Union / vote de masques par frame + filtrage temporel | NumPy | — | algo | CPU | 1 | Pour une planche à caméra fixe : masque = union (ou vote ≥ k/N) des masques individuels dilatés ; puis intersection par frame ; contrôle IoU(frame t, t+1) pour détecter les ratés | Suffisant pour 80 % des sprites d'animation. |

**Recommandation.** Basic : détourage indépendant par frame + contrôle de cohérence (IoU consécutif, aire) + réparation par vote temporel. Pro : SAM 2.1 (masque initial = BiRefNet sur la frame 0) → propagation → même post-traitement que les images fixes, avec un `alpha_cutoff` commun à toutes les frames.

### 2.8 Planches multi-sprites

| Nom | Licence | Type | Intégration | Notes |
|---|---|---|---|---|
| `scipy.ndimage.label` / `cv2.connectedComponentsWithStats` | BSD-3 / Apache-2.0 | algo | 1 | Composantes connexes sur l'alpha ; dilater de k px avant labellisation pour rattacher les pièces détachées (épée, projectile) puis récupérer les boîtes sur l'alpha original |
| Détection de grille régulière (autocorrélation des projections d'alpha sur X et Y) | — | algo | 2 | Pour les planches d'animation régulières, préférer une grille uniforme aux boîtes irrégulières (pivots stables) |
| CartoonSegmentation (instances) | poids MIT | modèle | 4 | Quand plusieurs personnages se chevauchent |
| SpriteCook `auto_slice_asset` | [PROPRIÉTAIRE] | référence | — | Retourne aussi une `manual_slice_url` pour révision manuelle → prévoir le même mode |

### 2.9 Benchmarks et évaluation

Il n'existe **aucun benchmark public** de détourage sur illustrations / cartoon / pixel art. Ce qui existe : DIS5K, HRSOD, COD10K (photos/objets), P3M (portraits) ; l'arène de vote `bgsys/background-removal-arena` (HF, comparaison par paires, orientée photo) ; les tests privés de Lucida (191 images, catégories dont « illustration » et « glow ») ; les retours ComfyUI-RMBG. Conclusion : il faut **construire un jeu de test interne** (≈ 100-200 sprites générés : personnages, items, tuiles, pixel art 16/32/64 px, effets lumineux, avec masques vérité-terrain dessinés à la main ou obtenus par LayerDiffuse) et mesurer MAE / F-mesure pondérée / erreur sur la bande de bord de 2 px.

---

## 3. Idées malines et astuces

1. **Éviter le problème à la source** : LayerDiffuse (Apache-2.0) génère du RGBA en SDXL/SD1.5 ; sinon prompter « isolated on a solid flat #FF00FF magenta background, no shadow, no gradient » et chroma-keyer. Sur pixel art c'est quasi parfait ; garder le modèle IA comme filet.
2. **Routeur par confiance** (au cœur du Basic gratuit) : calculer sur l'image (a) l'homogénéité des bords (écart-type Lab d'une bande de 4 px), (b) la fraction de pixels du périmètre appartenant à la composante de fond, (c) la présence de la couleur de fond à l'intérieur du sujet. Si tout est vert → flood fill ; sinon → modèle. Coût : ~10 ms.
3. **Trimap automatique depuis n'importe quel masque** (recette Matte-Anything / rembg) : érosion → foreground sûr, dilatation → background sûr, entre les deux → inconnu ; résoudre le matting **uniquement sur la bande** (sous-problème creux, 10-50× plus rapide que l'image entière).
4. **Score de « mollesse »** : fraction de pixels dont 0,1 < α < 0,9. Si élevée sur du pixel art → le modèle a lissé → basculer sur l'algo de grille. Si élevée sur un rendu HD → activer le matting.
5. **Ensemble à bas coût** : isnet-anime + isnet-general + birefnet-lite en CPU, vote pixel à pixel (≥ 2/3) ; le désaccord entre modèles sert de trimap « inconnu ».
6. **Test-time augmentation** : moyenner le masque de l'image et de son miroir horizontal (et ±10 % d'échelle) : lisse les bords et supprime les artefacts unilatéraux, gratuit à implémenter.
7. **Raffinement guidé** : calculer le masque à 1024, puis guided filter (rayon 4-8, ε 1e-3) avec l'image 2048 comme guide → bords alignés sur les vrais contours sans réinférence lourde. Alternative : BiRefNet-dynamic.
8. **Prompts SAM automatiques** : depuis le masque de saillance, prendre le centroïde + 3 points de fond aux coins + la boîte englobante → SAM 2 « nettoie » les masques hésitants (accessoires oubliés) ; l'utilisateur ajoute ensuite ses clics.
9. **Décontamination sans matting** : pour le pixel art (alpha binaire), remplacer la couleur des pixels de bord par celle du pixel intérieur le plus proche (érosion + propagation) si elle est « contaminée » (distance Lab à la couleur du fond < seuil).
10. **Profondeur comme second avis** : Depth Anything V2 *small* (Apache) donne une carte de profondeur ; un seuil Otsu sur la profondeur intersecté avec la saillance élimine le décor lointain quand le générateur a mis une scène derrière le personnage.
11. **Pixel art : downscale par vote, pas par moyenne** : après détection de grille, prendre la couleur *majoritaire* (ou la médiane Oklab) par cellule ; la moyenne crée des couleurs hors palette et des alphas à 0,5.
12. **Hystérésis sur `alpha_cutoff`** : deux seuils au lieu d'un → les fines antennes reliées au corps survivent, le bruit isolé disparaît.
13. **Trous volontaires** : ne pas appeler `binary_fill_holes` en aveugle ; limiter aux trous < N px² *ou* dont la couleur d'origine ≈ couleur de fond.
14. **Outline « pixel-art aware »** : dilatation 4-connexe (croix) pour éviter les pixels de coin ; couleur = teinte dominante du bord assombrie de 30-40 % en Oklab, ou la couleur la plus sombre de la palette.
15. **Animation à caméra fixe** : masque = intersection(frame_t, dilate(union_all, 2)) — la dilatation de l'union interdit tout pixel jamais vu comme sujet, ce qui supprime le clignotement du fond.
16. **Export sans halo** : alpha bleeding (couleur des bords propagée dans le transparent) ou PNG + option « premultiplied » selon moteur (Godot/Unity filtrent en linéaire ; sans bleeding, le noir des pixels transparents fuit au bilinéaire).
17. **Côté navigateur, cacher les modèles dans OPFS** (Origin Private File System) comme webgpu-sam2/next-sam : le premier chargement (80-100 Mo fp16) est le vrai coût ; ensuite tout est instantané.
18. **Toujours fp16, jamais quint8 pour les masques** : img.ly a rejeté la quantification 8 bits de l'ISNet pour artefacts visibles.

---

## 4. Pipelines d'assemblage recommandés

Conventions : `→` étape ; [CPU] / [GPU] ; les curseurs exposés à l'utilisateur sont en *italique*.

### 4.1 Mode « Basic » (gratuit, CPU seul, < 3 s)

1. Pré-analyse [CPU, 10 ms] : détection fond uni / chroma / damier + score de confiance.
2. Si confiance élevée → **flood fill Lab 4-connexe** depuis les coins (*tolérance*) → masque binaire.
3. Sinon → **rembg** avec `isnet-anime` (personnages) ou `isnet-general-use` (objets/tuiles) via onnxruntime CPU à 1024 ; option TTA miroir.
4. `post_process_mask` (ouverture + flou σ=2 + seuil) → *alpha_cutoff* (seuil unique, défaut 0,5).
5. Nettoyage : `remove_small_objects` (*min_island*), `remove_small_holes` (*max_hole*), option *garder la plus grosse composante*.
6. Décontamination légère : `estimate_foreground_ml` sur une bande de 3 px, ou remplacement par couleur intérieure la plus proche.
7. Export : alpha bleeding + PNG.

Alternatives : u2netp si CPU très faible (< 0,5 s) ; **BEN2-ONNX** ou **BiRefNet_lite-ONNX** (MIT) côté client en WebGPU via transformers.js pour délester le serveur.

### 4.2 Mode « Pro » (GPU 8 Go ; repli 4-6 Go)

1. Même pré-analyse ; si fond uni → algo, mais on garde le raffinement des étapes 4-6.
2. **BiRefNet** FP16 (general ≤ 1024 ; HR / dynamic jusqu'à 2048 ; *style « illustration »* → Lucida) ; repli GPU faible : birefnet-general-lite ; repli CPU : mode Basic.
3. Optionnel *sélection* : SAM 2.1 (small/base+, HQ-SAM 2 si *bords fins*) avec prompts automatiques (§3.8) puis clics utilisateur (+/−) ; *texte* → GroundingDINO-T → boîte → SAM 2. Fusion : masque = SAM ∪/∩ saillance selon le mode choisi (« ajouter », « garder seulement »).
4. **Edge cleanup** : trimap (*largeur de bord* 4-16 px) → `estimate_alpha_cf` sur la bande (ou ViTMatte-S si activé) → `estimate_foreground_ml` → guided filter (r 2-4) → *alpha_cutoff* facultatif (0 = alpha doux conservé).
5. Nettoyage morphologique (§4.1 étape 5) ; contours de collision `findContours` ; outline optionnel.
6. Export : PNG (bleeding), option SVG via vtracer (mode spline), option polygones JSON.

VRAM estimée : BiRefNet FP16 3,5 Go + SAM 2.1 small ~1,5 Go + GroundingDINO-T ~2 Go = ~7 Go si tout est chargé simultanément → charger/décharger à la demande, ou fixer SAM 2.1 tiny + GroundingDINO-T en résident et BiRefNet à la volée.

### 4.3 Mode « Pixel art »

1. Détection de grille (proper-pixel-art / pixeldetector) → *taille de pixel* (auto / forcée) → réduction par vote majoritaire (Oklab).
2. Fond : flood fill Lab 4-connexe (*tolérance*) sur l'image réduite ; repli : masque isnet-anime calculé sur l'image haute-res, réduit par vote par cellule.
3. Binarisation par **hystérésis** autour de *alpha_cutoff* → `remove_small_objects` / `remove_small_holes` (plafonnés) → *garder N composantes*.
4. Décontamination discrète (§3.9) ; quantification palette (k-means Oklab ou palette imposée) ; *outline* 4-connexe (couleur dérivée/palette).
5. Export : PNG à la vraie résolution + variante ×N nearest-neighbour ; option SVG « pixel » (vtracer mode pixel) ; option lissage Kopf-Lischinski (à développer).

### 4.4 Mode « Animation » (séquence ou planche)

1. Slicing : composantes connexes avec dilatation k px, ou grille régulière détectée (autocorrélation) ; révision manuelle possible.
2. Basic : pipeline 4.1 par frame → contrôle IoU/aire entre frames consécutives → réparation par vote temporel (union dilatée ∩ masque frame) ; `alpha_cutoff` commun.
3. Pro : BiRefNet sur la frame 0 → **SAM 2.1 VideoPredictor** (prompt = masque + points) → propagation → même Edge cleanup par frame (paramètres partagés) → vérification temporelle.
4. Pixel art animé : 4.3 par frame avec la même grille et la même palette forcée.
5. Export : frames individuelles, planche repackée (positions et pivots conservés), métadonnées JSON (boîtes, pivots).

---

## 5. Ce qu'il faudrait développer soi-même

- **Détecteur de fond + score de confiance** (uni, chroma, damier, dégradé) et **flood fill Lab 4-connexe** avec hystérésis et despill — ~300 lignes NumPy/OpenCV ; c'est la brique qui rend le Basic gratuit viable sur CPU.
- **Routeur de modèles** (choix isnet-anime / general / BiRefNet variante selon type d'asset, résolution, VRAM disponible détectée via `torch.cuda.mem_get_info` / onnxruntime providers) et gestionnaire de chargement/déchargement des poids.
- **Module « Edge cleanup »** unifié : trimap paramétrique → matting sur bande (wrapper pymatting) → foreground estimation → guided filter → cutoff/hystérésis → morphologie plafonnée. Exposé en une seule fonction avec 5-6 curseurs, utilisé par tous les modes.
- **Pipeline pixel art** : détection de grille (adapter proper-pixel-art, MIT), réduction par vote, quantification Oklab, décontamination discrète, outline 4/8-connexe, palette forcée. Port TypeScript/WASM d'une partie (comme Pixel-Extractor via Pyodide, ou en pur TS comme PixelRefiner) pour un aperçu instantané côté client.
- **Générateur d'outline** et **exporteur** (alpha bleeding, premultiplied, polygones de collision, SVG vtracer).
- **Slicer de planches** (composantes connexes avec fusion par dilatation, grille régulière, pivots) + éditeur manuel de rectangles (équivalent de la `manual_slice_url` de SpriteCook).
- **Cohérence temporelle** pour animations (IoU, vote, union dilatée) et orchestration SAM 2 vidéo.
- **Front React** : outil clic-sélection avec transformers.js (SlimSAM / SAM 2.1 tiny en WebGPU, cache OPFS, repli serveur), pinceau de correction du masque (ajout/suppression, taille, dureté), aperçu sur damier / fond sombre / fond clair pour révéler les franges.
- **Jeu de test et benchmark interne** (illustrations + pixel art avec vérité terrain) et script de mesure MAE / F-β / erreur de bande — indispensable pour arbitrer entre BiRefNet, Lucida, BEN2 et isnet-anime, et pour justifier la frontière Basic/Pro.
- Éventuellement : réimplémentation propre (MIT) de **Depixelizing Pixel Art** pour l'export HD, et une petite **distillation / fine-tune BiRefNet-lite** sur vos propres sprites (données MIT/CC0 uniquement) une fois le jeu de test constitué.

**Récapitulatif licences (à retenir)** : OK commercial — rembg, U²-Net, IS-Net, isnet-anime, BiRefNet (+ Lucida, réserve données), BEN2 base, InSPyReNet, MODNet, SAM 2/2.1, MobileSAM, SlimSAM, EfficientSAM, EfficientViT-SAM, HQ-SAM, EfficientTAM, GroundingDINO, Grounded-SAM-2, Matte-Anything, SDMatte, ViTMatte (code), pymatting, OpenCV, scikit-image, SciPy, vtracer, LayerDiffuse, Depth Anything V2 *small*, PixelRefiner, proper-pixel-art, pixeldetector, alpha-bleeding. **Exclus / à risque** — RMBG-1.4/2.0 (CC-BY-NC), EdgeSAM (S-Lab), MatAnyone 1/2 (S-Lab), FastSAM (AGPL), `@imgly/background-removal` (AGPL), potrace (GPL), sketch_simplification (CC non commercial), Depth Anything V2 base/large (CC-BY-NC), SAM 3 (licence Meta non-OSI, poids gated — à valider), fixelart et plusieurs implémentations Depixelizing (licence absente).

---

## 6. Sources

- rembg : https://github.com/danielgatis/rembg — https://github.com/danielgatis/rembg/blob/main/rembg/bg.py — https://github.com/danielgatis/rembg/blob/main/USAGE.md
- BiRefNet : https://github.com/ZhengPeng7/BiRefNet — https://huggingface.co/ZhengPeng7/BiRefNet_HR-matting — https://huggingface.co/ZhengPeng7/BiRefNet_dynamic-matting
- Lucida : https://github.com/egeorcun/lucida
- RMBG-2.0 : https://huggingface.co/briaai/RMBG-2.0
- BEN2 : https://huggingface.co/PramaLLC/BEN2 — https://huggingface.co/onnx-community/BEN2-ONNX
- InSPyReNet : https://github.com/plemeri/transparent-background — https://github.com/plemeri/InSPyReNet
- anime-segmentation : https://github.com/SkyTNT/anime-segmentation
- U²-Net : https://github.com/xuebinqin/U-2-Net — DIS/IS-Net : https://github.com/xuebinqin/DIS
- MODNet : https://github.com/ZHKKKe/MODNet/blob/master/LICENSE
- ViTMatte : https://github.com/hustvl/ViTMatte — https://github.com/hustvl/ViTMatte/issues/9
- Matte-Anything : https://github.com/hustvl/Matte-Anything
- MatAnyone : https://github.com/pq-yang/MatAnyone/blob/main/LICENSE — https://github.com/pq-yang/MatAnyone2
- SDMatte : https://github.com/vivoCameraResearch/SDMatte — https://github.com/vivoCameraResearch/SDMatte/blob/main/LICENSE
- Depth Anything V2 : https://github.com/DepthAnything/Depth-Anything-V2/issues/320
- CartoonSegmentation : https://github.com/CartoonSegmentation/CartoonSegmentation — https://huggingface.co/dreMaz/AnimeInstanceSegmentation
- SAM 2 : https://github.com/facebookresearch/sam2 — SAM 3 : https://github.com/facebookresearch/sam3 — https://github.com/facebookresearch/sam3/blob/main/LICENSE — https://ai.meta.com/blog/segment-anything-model-3/
- SAM 3 ONNX web : https://huggingface.co/onnx-community/sam3-tracker-ONNX — https://huggingface.co/spaces/webml-community/SAM3-Tracker-WebGPU
- MobileSAM : https://github.com/ChaoningZhang/MobileSAM — SlimSAM : https://github.com/czg1225/SlimSAM — https://huggingface.co/Xenova/slimsam-50-uniform
- EfficientSAM : https://github.com/yformer/EfficientSAM — EfficientTAM : https://github.com/yformer/EfficientTAM
- EfficientViT-SAM : https://github.com/mit-han-lab/efficientvit — HQ-SAM : https://github.com/SysCV/sam-hq
- EdgeSAM : https://github.com/chongzhou96/EdgeSAM — Awesome Efficient SAM : https://github.com/czg1225/Awesome-Efficient-Segment-Anything
- FastSAM / Ultralytics AGPL : https://docs.ultralytics.com/models/fast-sam — https://www.ultralytics.com/license
- GroundingDINO : https://github.com/IDEA-Research/GroundingDINO — Grounded-SAM-2 : https://github.com/IDEA-Research/Grounded-SAM-2
- SAM dans le navigateur : https://github.com/lucasgelfond/webgpu-sam2 — https://github.com/geronimi73/next-sam — https://github.com/sunu/SAM-in-Browser — https://huggingface.co/spaces/webml-community/segment-anything-webgpu
- img.ly WebGPU vs WASM : https://img.ly/blog/browser-background-removal-using-onnx-runtime-webgpu/ — https://github.com/imgly/background-removal-js (AGPL)
- BiRefNet ONNX web : https://huggingface.co/onnx-community/BiRefNet_lite-ONNX
- pymatting : https://github.com/pymatting/pymatting — Fast Multi-Level Foreground Estimation : https://arxiv.org/abs/2006.14970
- OpenCV GrabCut : https://docs.opencv.org/4.x/d8/d83/tutorial_py_grabcut.html — Guided filter : https://docs.opencv.org/4.x/de/d73/classcv_1_1ximgproc_1_1GuidedFilter.html
- scikit-image morphology : https://scikit-image.org/docs/stable/api/skimage.morphology.html
- alpha-bleeding : https://github.com/urraka/alpha-bleeding — https://castle-engine.io/manual_alpha_bleeding.php
- vtracer : https://github.com/visioncortex/vtracer — potrace : https://potrace.sourceforge.net/
- Depixelizing Pixel Art : https://github.com/rjalfa/depixelize — https://github.com/TableauBits/DePyxelizer — https://pypi.org/project/depixelizer/
- Outils pixel art : https://github.com/HappyOnigiri/PixelRefiner — https://github.com/KennethJAllen/proper-pixel-art — https://github.com/univeous/Pixel-Extractor — https://github.com/Astropulse/pixeldetector — https://github.com/golota60/fixelart
- LayerDiffuse : https://github.com/lllyasviel/sd-forge-layerdiffuse — https://github.com/rootonchair/diffuser_layerdiffuse
- Sketch simplification (non commercial) : https://github.com/bobbens/sketch_simplification
- Comparatifs : https://ice-ice-bear.github.io/posts/2026-04-15-birefnet/ — https://github.com/1038lab/ComfyUI-RMBG — https://huggingface.co/spaces/bgsys/background-removal-arena — https://fyrean.itch.io/bgbye-background-remover/devlog/760767/first-release-v10
