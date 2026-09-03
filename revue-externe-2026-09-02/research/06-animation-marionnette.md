# 06 — Animation par marionnette (cutout / rig 2D) : de l'asset généré aux frames pixel art

> Recherche menée le 2026-09-02. Toutes les licences et l'activité GitHub ont été vérifiées sur les dépôts (dates/étoiles au jour de la recherche). Les éléments non vérifiés sont marqués **(à vérifier)**. Les outils propriétaires sont marqués **[PROPRIÉTAIRE — référence]**. Les licences non commerciales ou copyleft fort sont signalées **⚠**.

Contexte : backend Python 3.11 / FastAPI / Pillow + NumPy ; front React 19 + TypeScript + Vite + @xyflow/react ; cible GPU 8 Go ou CPU ; philosophie « assembler des briques spécialisées ».

---

## 1. Problèmes / verrous

Le pipeline « marionnette » (personnage généré → découpe → squelette + pièces → animation → rendu → pixelisation) se heurte à sept verrous distincts. Chacun a des solutions open source, mais aucun outil unique ne couvre la chaîne complète.

1. **Découper un personnage en parties (segmentation sémantique des membres).** Un sprite généré est une image plate. Il faut retrouver tête, torse, bras (haut/bas), mains, jambes (haut/bas), pieds, accessoires. Les modèles « human parsing » sont entraînés sur des photos et généralisent mal aux dessins ; les modèles anime existent mais avec des licences variées.
2. **Compléter les zones cachées.** Une fois le bras découpé, le torse a un « trou » à l'endroit où le bras le recouvrait ; quand le bras bouge, le trou apparaît. Il faut inpainter chaque couche (ou générer dès le départ des couches complètes).
3. **Construire le squelette et l'attacher aux pièces (auto-rig).** Placer les articulations, définir la hiérarchie, générer un maillage par pièce et calculer les poids de skinning. Faisable à la main dans Spine/Inochi Creator, mais l'objectif est un auto-rig « un clic » avec correction manuelle.
4. **Déformer proprement (skinning 2D).** Rotation rigide de pièces (paper-doll) suffit pour le pixel art basse résolution, mais le HD exige des maillages déformés (LBS, dual quaternion, ARAP, MLS) pour éviter les cassures aux articulations.
5. **Trouver le mouvement.** Il faut des cycles (idle, walk, run, jump, attack, hurt, death) : mocap 3D libre projeté en 2D, génération text-to-motion, ou animation procédurale (sinus, IK, squash & stretch). Les licences des datasets mocap sont un piège (AMASS non commercial).
6. **Rendre des frames cohérentes en pixel art.** Rendre en haute résolution puis réduire crée du « shimmering » (scintillement) entre frames : la palette doit être fixe, les positions des pièces alignées sur la grille, les rotations traitées par un algorithme dédié (RotSprite).
7. **Embarquer un éditeur de rig dans React.** Il n'existe pas de « Spine open source » en composant web. Il faut assembler PixiJS (maillages), un solveur IK, une timeline/dopesheet et un format de rig maison ; les runtimes Spine ne sont pas utilisables sans licence éditeur.

---

## 2. Solutions par problème

### 2.1 Outils et runtimes de rig 2D existants (peut-on en embarquer un ?)

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Inochi2D SDK + Inochi Creator | github.com/Inochi2D/inochi2d ; /inochi-creator | BSD-2-Clause (vérifié, wiki Legal-Info) | D | SDK + éditeur desktop | Creator 0.8.6 (sept. 2024), 1,2 k★ ; SDK actif | CPU/GPU léger (OpenGL) | 4 | Déformation de maillages par paramètres (style Live2D), physique, pas de « bones » classiques mais nœuds de déformation ; formats INP (binaire) / INX (éditeur). Pas de bindings Python/JS documentés. | Rust port **inox2d** (BSD-2, 283★) parse INP/INX et rend en OpenGL + **WebGL/WASM**, mais « prototype, pas pour la production » ; animations non implémentées. |
| DragonBones runtimes | github.com/DragonBones | MIT (JS, C++, C#) | TS/C++/C# | Runtime | DragonBonesJS 837–842★, dernier commit janv. 2026 ; cible Pixi v4/v5, Phaser, Egret | CPU | 3 | Format JSON DragonBones ouvert et documenté (bones, slots, mesh, IK, FFD). L'éditeur DragonBones Pro est **freeware non open source** et quasi abandonné (site renvoie vers « LoongBones », **à vérifier**). | Le format JSON DragonBones est un bon **format d'échange** de secours ; runtime JS à adapter pour Pixi v8. |
| Spine runtimes (spine-ts, spine-pixi-v8) | github.com/EsotericSoftware/spine-runtimes | ⚠ Spine Runtimes License (source visible mais **chaque utilisateur doit posséder une licence Spine Editor** ; vérifié) | TS | Runtime | Très mature | CPU | 2 | Le meilleur runtime 2D (mesh, IK, transform/path constraints, skins). Mais la licence interdit un usage sans éditeur Spine acheté par chaque utilisateur. | **Non utilisable** en open-source-first. Le port MIT `pixijs/spine-v8` a été archivé (fév. 2026) et redirige vers le paquet officiel ; il reste soumis à la licence Spine. Générer du Spine JSON (ex. `firejune/rigc`, MIT) ne contourne pas la licence. |
| Rive runtimes (rive-wasm, rive-cpp) | github.com/rive-app/rive-wasm | MIT (runtime) ; éditeur **[PROPRIÉTAIRE]** SaaS | C++/WASM | Runtime | 951★ | CPU/GPU | 4 | Format .riv binaire produit par l'éditeur ; pas d'API d'écriture documentée. | Référence seulement (bones, mesh, state machines). |
| Godot 4 Skeleton2D / Bone2D / Polygon2D | docs.godotengine.org (2D skeletons) | MIT | GDScript/C++ | Moteur | Mature ; `SkeletonModification2D` (CCDIK, FABRIK, LookAt, TwoBoneIK, Jiggle, PhysicalBones) marqué **expérimental** | CPU/GPU | 3 | Skinning par poids peints sur Polygon2D, IK. Export de frames par script : `SubViewport.get_texture().get_image().save_png()`. **`--headless` n'effectue aucun rendu** (driver Dummy) → il faut Xvfb/GPU pour rendre côté serveur. | Bon **rendu batch** de secours ; le projet **Proscenio** (GPL-3, 2026, précoce) exporte Blender → Godot Skeleton2D. |
| COA Tools 2 (Blender) | github.com/Aodaruma/coa_tools2 | GPL-3.0 | Python (bpy) | Addon Blender ≥ 3.4 | v2.2.1 (avr. 2026), 74–79★ ; original ndee85 961★ arrêté 2019 | CPU (Cycles) / GPU (Eevee) | 3 | Workflow « Spine dans Blender » : import de couches PSD/GIMP/Krita, maillage auto, bones, animation, export JSON (bones + sprites, animation bakée). Rendu de frames via `blender -b -P script.py`. | Meilleur candidat **rig semi-manuel desktop** ; pilotable en batch depuis Python. GPL n'est pas contaminant si Blender est appelé comme processus externe. |
| Synfig Studio | github.com/synfig/synfig | GPL-3.0 | C++ | Application | v1.5.5 (mars 2026), 2,2 k★ | CPU | 3 | Skeleton Layer + Skeleton Deformation Layer (déforme bitmaps), CLI `synfig` pour rendre des séquences PNG. Interface vieillissante. | Alternative batch ; fichier .sif XML scriptable. |
| OpenToonz / Tahoma2D | github.com/opentoonz/opentoonz ; /tahoma2d/tahoma2d | BSD modifiée (Tahoma2D v1.6.1, mai 2026, 606★) | C++ | Application | Mature | CPU | 3 | **Plastic tool** : maillage triangulé + squelette hiérarchique, keyframes, changement de squelette, ordre d'empilement, contraintes d'angle ; fonctionne sur niveaux vectoriels et « animated levels ». CLI `tcomposer` pour rendu. | Option desktop robuste ; scripting limité. |
| AnimeEffects | github.com/AnimeEffectsDevs/AnimeEffects | GPL-3.0 | C++/Qt | Application | v1.7.1, 259★ (maintenu par la communauté) | GPU OpenGL 4 | 2 | Déformation de maillages, bones, FFD ; export vidéo via FFmpeg. Pas de CLI. | Simple, adapté aux débutants. |
| Wick Editor | github.com/Wicklets/wick-editor | GPL-3.0 | JS/React (paper.js) | Éditeur web | 832★, actif | CPU | 2 | Animation image par image / tweens, pas de bones. | Référence d'UI React pour timeline. |
| Krita, Pencil2D, Glaxnimate, enve | — | GPL-3 / GPL-2 / GPL-3 / GPL-3 | C++ | Applications | Krita très actif ; Pencil2D actif ; Glaxnimate actif ; enve peu actif | CPU | — | Pas de squelette exploitable (Krita : transform masks cage/warp ; Glaxnimate : Lottie/SVG). | Hors périmètre marionnette. |
| Blender Grease Pencil | blender.org | GPL-2+ | Python | Moteur | Très mature | CPU/GPU | 4 | Rigs 2D par armatures + modifiers (Armature, Lattice) sur strokes ; rendu batch. | Puissant mais orienté dessin vectoriel plutôt que sprites bitmap. |
| ink-and-bones | github.com/sero-labs/ink-and-bones | MIT | TypeScript (0 dépendance) | Moteur procédural | Expérimental « unsupported », 0★ (2026) | CPU | 2 | Marionnette **pixel art** procédurale : squelette, IK 2 os, tissu Verlet, courbes easées, rendu déterministe avec **supersampling 4× puis quantification, despeckle et contour « ink »**. | Petit, lisible : source d'inspiration directe pour le renderer pixel art côté navigateur. |
| Spine, Spriter 2, Live2D Cubism, Cartoon Animator, PixelOver, Aseprite | — | **[PROPRIÉTAIRES — référence]** | — | — | — | — | — | Spine : mesh + poids + IK + skins + path constraints, dopesheet excellent. Live2D : déformateurs (warp/rotation) + paramètres. PixelOver : import 3D/2D, rendu pixel art avec palette fixe, outline, « pixel-perfect » rotation par pas. Aseprite : RotSprite, palette, timeline de cels. | À copier pour l'ergonomie, pas pour le code (Aseprite est « source-available » sous EULA, pas open source ; LibreSprite, fork GPL-2 antérieur, contient RotSprite). |

**Comparaison / recommandation.** Aucun outil open source ne s'embarque tel quel dans une page React 19 : Inochi2D (D) et son port Rust/WASM sont prometteurs mais le port n'est pas prêt ; DragonBonesJS est MIT mais figé sur Pixi v4/v5 ; les runtimes Spine sont exclus par leur licence. Deux stratégies coexistent :

- **Éditeur web maison** (recommandé pour l'expérience « un clic ») : PixiJS v8 + code de skinning/IK maison + format de rig JSON maison, **compatible import/export DragonBones JSON** (ouvert, MIT) pour interopérer avec les outils desktop.
- **Rig desktop semi-manuel** (recommandé pour les utilisateurs avancés / HD) : COA Tools 2 dans Blender (GPL, appelé en sous-processus), ou OpenToonz/Tahoma2D Plastic tool, avec rendu batch de PNG.

### 2.2 Découpe en parties (segmentation des membres)

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **See-through** (SIGGRAPH 2026) | github.com/shitagaki-lab/see-through | Apache-2.0 | Python 3.12 / PyTorch 2.8 | Modèles + WebUI | 3 k★, 266 forks (2026) | 12–16 Go bf16 ; **~8 Go en NF4 ou block-swap** ; à 1280 px | 3 | Décompose une illustration anime en **jusqu'à 23 couches sémantiques ordonnées**, avec **inpainting des zones occultées** ; sortie PSD + cartes de profondeur + masques. Composé de LayerDiff (SDXL), Marigold-depth affiné anime, **SAM body parsing 19 parties**. Les auteurs précisent : pas de rig/mesh/physique (« pas encore un Image-to-Live2D »). | **La brique clé** pour les verrous 1 + 2 en une passe. Entraîné sur de l'anime : tester sur pixel art HD/upscalé et sur styles cartoon occidentaux. |
| Bunraku (arXiv 2607.27348, juil. 2026) | github.com/SparcAI-Inc/Bunraku | non précisée | — | Papier | Dépôt = README seul, 3★ | — | — | Illustration unique → couches RGBA complétées + **maillage par couche + déplacements de keyposes** (Live2D complet). Limité aux A-poses de face. | À suivre ; **pas de code exploitable aujourd'hui**. |
| SAM 2 (Meta) | github.com/facebookresearch/sam2 | Apache-2.0 | Python | Modèle | 19,8 k★ | tiny 39 M → large 224 M paramètres ; tiny tourne sur CPU | 2 | Segmentation par clic/boîte, excellente sur formes nettes ; ne « connaît » pas les parties du corps → à combiner avec des points d'amorçage issus de la pose. | Base de l'**outil de découpe assistée** (clic = partie). Éviter FastSAM (⚠ AGPL-3, Ultralytics). |
| Animated Drawings (Meta) — détecteur + estimateur de pose pour dessins | github.com/facebookresearch/AnimatedDrawings | MIT (code, poids, dataset Amateur Drawings) | Python (TorchServe, MMDet/MMPose) | Pipeline complet | 12,8 k★ ; **archivé sept. 2025** (lecture seule) | GPU conseillé, CPU possible | 3 | Mask R-CNN affiné sur dessins + HRNet affiné sur dessins (17 keypoints) ; humanoïde debout uniquement (2 bras/2 jambes) ; squelette ajustable en YAML (6 bras, quadrupède…). Rendu MP4/GIF, mode headless `USE_MESA`. | Les **poids de pose sur dessins** restent la meilleure ressource MIT pour amorcer un squelette sur un sprite. |
| rtmlib (RTMPose, RTMO, DWPose, ViTPose, RTMDet) | github.com/Tau-J/rtmlib | Apache-2.0 (lib et poids OpenMMLab ; DWPose Apache-2.0 vérifié) | Python (onnxruntime / OpenCV) | Pose 2D | 605★, actif | **CPU OK** (ONNX), CUDA, MPS | 1 | 17/26/133 keypoints, très rapide ; entraîné sur photos → dégradé sur cartoons, mais souvent suffisant pour un personnage debout à proportions humaines. | Fallback léger ; option : affiner RTMPose sur le dataset Amateur Drawings (MIT) ou AnimeDrawingsDataset. |
| Bizarre Pose Estimator (WACV 2022) | github.com/ShuhongChen/bizarre-pose-estimator | ⚠ **AGPL-3.0** | Python (Docker GPU) | Pose + segmentation anime | 257★, peu actif | GPU | 3 | Précis sur illustrations anime plein corps ; un seul personnage. | Utilisable seulement en service isolé AGPL ; à éviter par défaut. |
| CartoonSegmentation / AnimeInsSeg | github.com/CartoonSegmentation/CartoonSegmentation | **non précisée (à vérifier)** | Python (MMDet, CUDA 11.8) | Segmentation d'instances anime | 199★ | GPU | 3 | Sépare les personnages du fond, pas les membres. | Utile pour multi-personnages ; licence à confirmer avant usage. |
| SkyTNT anime-segmentation | github.com/SkyTNT/anime-segmentation | Apache-2.0 **(à vérifier)** | Python (ISNet) | Détourage | Populaire | CPU/GPU | 1 | Alpha matte propre pour anime. | Complète rembg pour le détourage initial. |
| Sapiens (Meta) — body-part seg 28 classes, pose 308 kp | huggingface.co/facebook/sapiens | ⚠ **CC-BY-NC 4.0** (vérifié) | Python | Modèle | 0,3 → 2 B paramètres | ≥ 8 Go pour 0,3 B | 2 | Excellent sur humains photo, non commercial. | **Exclu** en usage commercial. |
| SCHP (Self-Correction Human Parsing) | github.com/GoGoDuck912/Self-Correction-Human-Parsing | MIT **(à vérifier)** ; datasets LIP/ATR/Pascal-Person-Part | Python | Human parsing | Ancien (2019–2020) | GPU/CPU | 2 | 18–20 classes (tête, bras, jambes, vêtements) sur photos ; peu fiable sur dessins. | Idée : l'utiliser comme pseudo-labeller sur des sprites HD réalistes seulement. |
| OpenPose | github.com/CMU-Perceptual-Computing-Lab/openpose | ⚠ non commercial (licence CMU) | C++ | Pose | Mature | GPU | — | — | **Exclu**. YOLO-pose (Ultralytics) ⚠ AGPL-3 : exclu aussi. MediaPipe Pose (Apache-2.0) : fonctionne mal sur dessins. |
| APES — Articulated Part Extraction from Sprite Sheets (2022) | github.com/zhan-xu/APES | **aucune licence** (= tous droits réservés) | Python (PyTorch 1.7) | Papier + code | 21★, 4 commits | GPU | 4 | Extrait les parties articulées à partir d'une **sprite sheet de 6–10 poses** (correspondances U-Net + clustering + ILP). Frontières imprécises aux articulations. | Idée reprise en §3 : si le générateur produit plusieurs poses, la co-segmentation par mouvement rigide isole les membres. Code non réutilisable légalement sans autorisation. |
| Rigging-sketches-for-2D-character-animation | github.com/mounika-v/Rigging-sketches-for-2D-character-animation | aucune licence | C++/Python | Recherche | 16★ | — | — | T-pose → squelette par contraction de maillage. | Référence d'algorithme (contraction de maillage 2D). |

**Comparaison / recommandation.**

- **Voie « IA complète » (GPU 8 Go)** : See-through (Apache-2.0) fait la découpe *et* la complétion en une passe et sort un PSD en couches ; c'est la solution la plus avancée et la mieux licenciée trouvée. Contraintes : Python 3.12/PyTorch 2.8, poids SDXL (~7 Go de téléchargement), 8 Go VRAM en NF4, style anime/illustration ; pour le pixel art natif, upscaler d'abord (4–8×) puis re-pixeliser après.
- **Voie « légère » (CPU)** : détourage (rembg / anime-segmentation) → pose 2D (rtmlib RTMPose, ou poids MIT d'Animated Drawings) → **découpe par SAM 2 amorcée par la pose** : pour chaque os, on pose 2–3 points positifs le long de l'os et des points négatifs sur les os voisins ; SAM 2 (tiny/small) renvoie le masque de la partie. Puis inpainting LaMa des trous. Résultat moins propre mais tout en Apache/MIT et sans GPU.
- **Voie « manuelle assistée »** : mêmes briques SAM 2 dans le canvas React (clic = ajouter/retirer un point, une partie = un calque), toujours nécessaire pour corriger l'IA.

### 2.3 Complétion des parties cachées

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| See-through (LayerDiff) | voir §2.2 | Apache-2.0 | Python | Diffusion en couches | 3 k★ | 8–16 Go | 3 | Complète les régions totalement occultées, cohérent avec le style. | Solution intégrée. |
| LaMa (Big-LaMa) | github.com/advimman/lama ; pip `simple-lama-inpainting` | Apache-2.0 (code et poids) | Python | Inpainting non génératif | 10,1 k★ | **CPU OK** (quelques secondes), < 2 Go GPU | 1 | Remplit des trous petits/moyens par texture cohérente ; ne « dessine » pas un bras manquant. Suffisant pour les zones cachées derrière un membre (torse sous le bras). | Brique par défaut côté FastAPI. |
| IOPaint | github.com/Sanster/IOPaint | Apache-2.0 | Python | Serveur/CLI (LaMa, SD-inpaint, SDXL, BrushNet, PowerPaint, SAM, RemoveBG) | 23,4 k★ ; **archivé août 2025** | CPU ou GPU | 1 | Enveloppe pratique (CLI `iopaint run`) mais figée. | Utiliser pour prototyper, extraire les parties utiles. |
| SD / SDXL inpaint, BrushNet, PowerPaint (via diffusers) | huggingface.co/docs/diffusers | Apache-2.0 (diffusers) ; poids : CreativeML OpenRAIL-M (SD1.5/SDXL) | Python | Diffusion | Mature | 4–8 Go | 3 | Nécessaire quand une partie entière manque (main cachée) ; garder le style demande un LoRA/IP-Adapter du personnage (autre agent). | Prévoir un masque « dilaté » + prompt « same character, back of the arm ». |
| Génération directe en « parts sheet » | — | — | — | Stratégie | — | — | 2 | Demander au générateur une planche de pièces séparées (tête, torse, bras…) ; l'agent « planches » couvre le pliage. | Évite le problème à la source ; spine-animation-ai (⚠ PolyForm NC) fait exactement cela avec Gemini puis composantes connexes OpenCV. |

**Recommandation.** LaMa en premier (CPU, Apache), diffusion inpaint seulement si la zone manquante est grande ; See-through quand le GPU est disponible. Toujours **inpainter à la résolution HD avant pixelisation**, puis dilater le masque de 2–4 px pour que le bord du membre ne « fuite » pas dans la couche du dessous.

### 2.4 Squelette, maillage et poids (auto-rig / skinning)

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Animated Drawings (rig + ARAP + retarget BVH) | github.com/facebookresearch/AnimatedDrawings | MIT | Python (OpenGL, numpy) | Pipeline | archivé 2025 | CPU (rendu OpenGL, `USE_MESA` headless) | 2 | Squelette 17 joints → maillage de la silhouette (triangulation) → **ARAP** (Igarashi) piloté par les joints → **retarget BVH → 2D** (plan de projection + « twisted perspective »). Sortie MP4/GIF ; l'extraction de PNG par frame demande un petit patch. | Meilleur point de départ **Python MIT** pour l'auto-rig d'un humanoïde debout. |
| libigl (bindings Python) | github.com/libigl/libigl-python-bindings ; `pip install libigl` | MPL-2.0 (double GPL-3) | C++/Python | Bibliothèque géométrie | 369★, actif | CPU | 3 | `lbs_matrix`, `dqs` (dual quaternion), `harmonic`, `biharmonic_coordinates`, blocs `arap_*`, `delaunay_triangulation`. Pas de solveur ARAP « clé en main » dans les bindings ; pas de BBW exposé (**à vérifier** selon version). | Base solide pour calculer les **poids harmoniques** sur un maillage 2D (résout le skinning). |
| ARAP 2D Igarashi 2005 — implémentations | github.com/deliagander/ARAPShapeManipulation (Python, **sans licence**) ; github.com/zhangzhensong/arap ; github.com/forestsen/ARAPShapeManipulation | variées / absentes | Python / C++ | Références | faibles | CPU | 2 | Algorithme court (2 étapes : similarité puis rigidification). À réimplémenter (NumPy + SciPy sparse, ≈150 lignes) ou porter en TS. | Le papier et le code d'Animated Drawings (MIT) suffisent comme modèle. |
| Moving Least Squares (Schaefer 2006) | papier ; nombreuses implémentations | — | NumPy / TS | Algorithme | — | CPU | 1 | Déformation affine/similitude/rigide par points de contrôle, sans maillage ; ≈100 lignes ; parfait pour un « warp » temps réel par poignées. | Idéal en complément côté navigateur pour la déformation « secondary motion » (cheveux, cape). |
| Triangulation : earcut (JS) / mapbox_earcut (Py) | github.com/mapbox/earcut | ISC | JS / Python | Lib | 2,5 k★ | CPU | 1 | Ear-clipping robuste, accepte des trous et des points de Steiner isolés ; pas de contrôle de qualité (triangles fins). | Suffit pour des pièces de sprite. |
| poly2tri / py-poly2tri | github.com/jhasse/poly2tri | BSD-3 | C++/JS/Py | CDT | mature | CPU | 1 | Delaunay contraint avec points intérieurs. | Bon compromis qualité. |
| Triangle (Shewchuk) / pip `triangle` | cs.cmu.edu/~quake/triangle.html | ⚠ **usage privé/recherche libre ; usage commercial nécessite l'autorisation de l'auteur** (wrapper Python LGPL-3) | C/Python | CDT de qualité | très mature | CPU | 1 | Meilleurs maillages (angles min), mais licence restrictive. | Éviter ; préférer poly2tri ou `scipy.spatial.Delaunay` + filtrage par masque alpha. |
| Godot Polygon2D + weight painting + SkeletonModification2D | docs Godot | MIT | GDScript | Moteur | expérimental (IK) | CPU/GPU | 2 | Poids peints à la main ; pas d'auto-poids. | Cible d'export pour les utilisateurs Godot. |
| COA Tools 2 | voir §2.1 | GPL-3 | Python | Addon Blender | 2026 | CPU | 3 | Génère automatiquement le maillage d'un sprite depuis l'alpha, bones, poids par « bone heat » de Blender. | Auto-poids gratuits via Blender en sous-processus. |
| Unity 2D Animation (PSD Importer, auto-weights) | — | **[PROPRIÉTAIRE — référence]** | C# | Package | mature | — | — | Auto-geometry + auto-weights + IK 2D. | Référence d'ergonomie pour l'outil de poids. |
| HumanRig / UniRig / ASMR (2025) | arxiv 2412.02317 ; 2504.12451 ; 2503.13579 | variées | Python | Auto-rig **3D** | recherche | GPU | — | Pas 2D ; cités pour la veille. | Non applicables directement. |

**Comparaison / recommandation.** Pour un sprite « paper-doll » pixel art, le rig est simplement : une hiérarchie de pièces rigides avec un pivot chacune (pas de maillage). Pour le HD, calculer un maillage par pièce (contour alpha → simplification Douglas-Peucker → CDT poly2tri/earcut + points intérieurs sur une grille) et des poids par **distance harmonique** (libigl `harmonic` sur un maillage de la silhouette entière) ou, plus simplement, par distance inverse aux os avec lissage — approche suffisante à 90 %. L'auto-placement des joints vient de la pose 2D (17 keypoints COCO → 15 os), comme dans Animated Drawings.

### 2.5 Sources de mouvement

| Nom | URL | Licence | Format | Type | Maturité | VRAM/CPU | Complexité | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **100STYLE** (Mason, Édimbourg) | ianxmason.com/100style | **CC-BY 4.0** (commercial OK avec crédit ; vérifié) | BVH 60 fps, > 4 M frames, 100 styles | Mocap locomotion | 2022 | — | 1 | Marche/course avant, arrière, pas chassés, **idle**, transitions, en 100 styles (zombie, robot, furtif, fier, blessé…). | **Bibliothèque de cycles idéale** pour idle/walk/run stylés ; il manque saut/attaque/mort. |
| CMU Graphics Lab Motion Capture (+ conversions BVH cgspeed) | mocap.cs.cmu.edu | Libre, y compris **inclusion dans produits commerciaux** ; interdiction de revendre les données telles quelles ; crédit NSF demandé (vérifié) | BVH/ASF-AMC, 2 500 séquences | Mocap | ancien | — | 1 | Sauts, coups de pied, boxe, chutes, danses… qualité inégale, squelette différent des autres. | Complète 100STYLE pour jump/attack/hurt/death. |
| AMASS / HumanML3D / Motion-X | amass.is.tue.mpg.de | ⚠ **non commercial** (AMASS vérifié : interdit même pour entraîner un modèle commercial) ; Motion-X : recherche seulement **(à vérifier)** | SMPL | Datasets | — | — | — | — | **Exclus**, et attention aux modèles entraînés dessus. |
| Mixamo | — | **[PROPRIÉTAIRE]** (usage libre dans vos projets, redistribution interdite) | FBX | Bibliothèque | — | — | — | — | Référence seulement ; ne pas embarquer. |
| MoMask | github.com/EricGuo5513/momask-codes | MIT (code) ; **poids entraînés sur HumanML3D/AMASS → zone grise non commerciale** | Python | Text-to-motion | 1,3 k★ | WebUI **CPU** possible ; GPU faible | 3 | Sort des positions de 22 joints (npy) **et des BVH** avec IK des pieds ; qualité correcte pour « a person jumps », « punches ». | Utilisable en R&D ; pour un produit commercial, ré-entraîner sur 100STYLE + CMU ou ne pas embarquer. |
| MDM (Motion Diffusion Model) | github.com/GuyTevet/motion-diffusion-model | MIT (code) ; même caveat datasets | Python | Text-to-motion | 4 k★ | 1 GPU ; version 50 pas ≈ 0,4 s/échantillon | 3 | Sortie joints npy, SMPL, OBJ ; pas de BVH direct. | Idem. MotionGPT (**à vérifier**), T2M-GPT (MIT ?), MotionLCM : mêmes dépendances datasets. |
| Animation procédurale (sinus, IK, squash & stretch) | ink-and-bones (MIT) ; formules classiques | MIT / domaine public | TS/Python | Code maison | — | CPU | 2 | Idle = respiration sinusoïdale sur torse/tête + micro-décalage des bras ; marche = courbes sinus déphasées sur hanches/genoux/épaules + IK 2 os pour poser les pieds ; saut = parabole + squash & stretch ; hit = recul + rotation ; mort = chute IK. Déterministe, léger, sans licence. | À implémenter pour garantir une **bibliothèque de base toujours disponible**, indépendante des datasets. |
| Templates pixel art (walk 8 frames) | — | — | JSON maison | Presets | — | — | 1 | Encoder les poses clés classiques (contact, down, pass, up) en angles par os. | Base « Aseprite-like » pour le mode paper-doll. |
| Inbetweening IA (RIFE, FILM, ToonCrafter) | — | RIFE MIT ; FILM Apache-2.0 ; ToonCrafter ⚠ non commercial | — | Interp. de frames | — | GPU | — | Couvert par un autre agent. | Pertinent seulement après rendu, pour du HD. |

**Recommandation.** Construire une **bibliothèque de clips 2D** propriétaire au projet : (1) clips procéduraux maison ; (2) clips extraits de 100STYLE (CC-BY) et CMU, projetés en 2D de profil et de face par le retargeting d'Animated Drawings (MIT), nettoyés et **stockés en angles d'os par frame** dans notre format JSON ; (3) text-to-motion en option « expérimentale » (licence à assumer par l'utilisateur, ou modèle ré-entraîné sur données CC-BY).

### 2.6 Rendu des frames en pixel art cohérent

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| RotSprite (Xenowhirl) — implémentations : LibreSprite, Pixelorama (« rotxel »), Aseprite | github.com/LibreSprite/LibreSprite ; github.com/Orama-Interactive/Pixelorama | LibreSprite GPL-2 ; Pixelorama MIT (v1.1.10, avr. 2026, 9,7 k★) ; Aseprite EULA **[référence]** | C++ / GDScript+GLSL | Algorithme | mature | CPU | 2 | Upscale ×8 par Scale2x itéré, rotation au plus proche voisin, réduction par sous-échantillonnage → rotations pixel art nettes. Pixelorama contient aussi cleanEdge et OmniScale (shaders). | Porter en NumPy (≈120 lignes) depuis la version MIT de Pixelorama. |
| Rendu HD → downscale + quantification palette fixe | Pillow (`Image.quantize(palette=...)`, `reduce`) | HPND (Pillow) | Python | Post-traitement | mature | CPU | 1 | La palette est **extraite une fois** du sprite source (ou imposée), puis appliquée à toutes les frames → pas de scintillement de couleur. Downscale en `BOX`/`NEAREST` selon le style. | Interdire le dithering « error diffusion » (instable) ; autoriser le dithering ordonné (stable car dépend de la position). |
| Pixel snapping des pièces | code maison | — | TS/Python | Règle | — | — | 1 | Arrondir les translations de pièces à la grille (à la résolution finale), quantifier les angles (ex. pas de 5–15°), rendre chaque pièce **une seule fois par angle** (cache RotSprite) puis composer. | Élimine le shimmering des contours ; c'est ce que fait PixelOver **[référence]**. |
| Supersampling 4× puis quantification (ink-and-bones) | github.com/sero-labs/ink-and-bones | MIT | TS | Renderer | expérimental | CPU | 2 | Rend en 4× la grille cible, quantifie, « despeckle », ajoute un contour encre. | Modèle de renderer navigateur pour le mode marionnette pixel art. |
| Rendu maillé côté Python : moderngl (EGL headless) ; skia-python `drawVertices` | github.com/moderngl/moderngl ; github.com/kyamagu/skia-python | MIT ; BSD-3 | Python | Rasterisation | matures | CPU (Mesa llvmpipe) / GPU | 2 | Pillow ne rasterise pas de triangles texturés ; moderngl (contexte EGL/OSMesa) ou Skia le font en quelques ms. Alternative paper-doll : `Image.transform` affine par pièce (Pillow). | Nécessaire pour rendre le rig HD hors navigateur (batch, API). |
| Godot / Blender en sous-processus | voir §2.1 | MIT / GPL | — | Rendu batch | — | GPU ou Xvfb | 2 | Rendu de qualité mais lourd à déployer côté serveur. | Réserver à l'export vers ces moteurs. |

**Recommandation.** Deux moteurs de rendu : **navigateur** (PixiJS 8 → `renderer.extract.canvas()` à 4–8× la taille cible, puis quantification en WebGL/Canvas) pour l'aperçu temps réel et l'export rapide ; **Python** (moderngl EGL ou skia-python ; Pillow pour le paper-doll) pour l'API batch et la cohérence garantie (même code de quantification/palette que le reste de l'application).

### 2.7 Briques web pour l'éditeur de rig dans React

| Nom | URL | Licence | Langage | Type | Maturité | Complexité | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| PixiJS v8 (MeshSimple, MeshGeometry, MeshRope, MeshPlane) | pixijs.com | MIT | TS | Rendu WebGL/WebGPU | très mature | 2 | `MeshSimple` accepte positions/UV/indices et `autoUpdate` par frame ; **pas de bones/skinning intégrés** → LBS en TS (CPU, quelques centaines de sommets = négligeable) ou dans un shader custom (`Shader.from` + attributs poids/indices d'os). `MeshRope` sert pour queues, capes, cheveux. | Choix recommandé ; cohabite avec @xyflow/react (le canvas rig est un nœud/panneau). |
| DragonBonesJS (Pixi) | github.com/DragonBones/DragonBonesJS | MIT | TS | Runtime | figé (Pixi v4/v5) | 3 | Contient parseur JSON, armature, slots, mesh, IK, FFD. | À porter sur Pixi v8 si l'on adopte le format DragonBones comme format interne. |
| Three.js (SkinnedMesh, Skeleton) | threejs.org | MIT | TS | Rendu 3D | très mature | 3 | Skinning GPU natif (LBS), ortho camera pour la 2D ; plus lourd que Pixi pour du 2D. | Alternative si l'on veut le skinning GPU « gratuit ». |
| Konva / Fabric.js | konvajs.org ; fabricjs.com | MIT | TS | Canvas 2D | matures | 2 | Bonnes pour les poignées, gizmos et la sélection ; pas de maillage déformé. | Utiles pour les overlays (os, points SAM). |
| Theatre.js | github.com/theatre-js/theatre | **Core Apache-2.0 ; Studio (UI) ⚠ AGPL-3** ; dev déplacé en privé temporairement | TS/React | Timeline/keyframes | 12,6 k★ | 3 | Séquenceur et courbes d'easing de qualité ; le Studio AGPL contamine si embarqué. | Utiliser seulement `@theatre/core` (Apache) pour l'évaluation des keyframes, ou tout réécrire. |
| react-timeline-editor | github.com/xzdarcy/react-timeline-editor | MIT | TS/React | Timeline drag-and-drop | v1.0.0 (janv. 2026), 747★ | 1 | Pistes/actions, pas de courbes ni de dopesheet par os. | Base rapide pour la piste de clips ; dopesheet par os à écrire. |
| IK : FABRIK / CCD / 2 os analytique | code maison (≈80 lignes) ; référence Godot `SkeletonModification2D` | MIT | TS | Algo | — | 1 | Pour 2D, l'IK 2 os analytique (loi des cosinus) couvre bras et jambes ; FABRIK pour chaînes longues (queue, cou). | Écrire soi-même. |
| Format de rig | DragonBones JSON (ouvert) / Spine JSON (ouvert mais runtime sous licence) / maison | — | JSON | Format | — | 1 | Le JSON DragonBones est documenté (bones, slots, skins, mesh, IK, animations). | Format interne maison **exportable en DragonBones JSON** et en Godot `.tscn` (Skeleton2D). |

---

## 3. Idées malines / astuces

1. **Amorcer SAM 2 par les os.** Au lieu de demander « segmente la tête », placer des points positifs échantillonnés sur le segment de l'os (issu de la pose) et des points négatifs sur les os voisins ; SAM produit des masques de membres étonnamment propres sur des sprites cartoon. Fusionner ensuite les masques par « vote » de distance à l'os pour les pixels non attribués.
2. **Faire générer le personnage en A-pose / T-pose.** Toutes les méthodes (Animated Drawings, See-through, Bunraku) travaillent mieux sur un personnage debout, de face, bras écartés du corps : imposer ce prompt dès la génération réduit les occultations à compléter.
3. **Co-segmentation par sprite sheet (idée APES).** Si le générateur fournit 4–6 poses du même personnage, les pixels qui bougent ensemble de façon rigide forment une partie : un flux optique (RAFT, BSD) + clustering par transformation rigide isole les membres sans modèle sémantique. Code APES non licencié → réimplémenter l'idée, pas le code.
4. **Rendre chaque pièce une fois par angle quantifié (cache RotSprite).** En pixel art, quantifier les angles par pas de 5–15° et mettre en cache la version RotSprite de chaque pièce ; la composition d'une frame devient une simple superposition à positions entières → zéro scintillement et rendu instantané.
5. **Deux rigs pour un même personnage** : « paper-doll » (pièces rigides, pivots) pour le pixel art < 64 px, « mesh » (LBS/ARAP) pour le HD. Le même squelette et les mêmes clips pilotent les deux ; seul le renderer change.
6. **Ordre de profondeur par frame (« stacking order »).** Copier OpenToonz Plastic : chaque os a une valeur d'ordre keyframable ; un bras passe devant puis derrière le torse pendant la marche. Indispensable et souvent oublié.
7. **Retargeting 3D → 2D « twisted perspective »** (Animated Drawings, MIT) : projeter le haut du corps de face et les jambes de profil pour la marche ; les sprites de jeu classiques trichent exactement ainsi.
8. **Palette d'abord.** Extraire la palette du sprite source (médiane coupée ou `quantize` Pillow) avant toute animation, l'imposer à toutes les frames, et n'autoriser que le dithering ordonné (Bayer) qui dépend de la position et reste stable.
9. **Secondary motion gratuit** : capes, cheveux, queues avec `MeshRope` PixiJS + simulation Verlet (ink-and-bones montre une implémentation MIT compacte) ; en pixel art, limiter à 2–3 segments.
10. **Symétrie et mirroring** : ne rigger qu'un bras/une jambe puis dupliquer en miroir ; générer la vue « gauche » par flip horizontal avec ré-ordre des couches, comme le font 95 % des jeux 2D.
11. **Format interne = DragonBones JSON étendu.** Ouvert, MIT, déjà lu par Godot (addon), Phaser, Cocos ; on y ajoute nos champs (`pixelStep`, `palette`, `stackOrderTimeline`) dans un bloc `userData`.
12. **Un LLM pour générer les rigs procéduraux** : `rigc` (MIT) et ink-and-bones montrent que des rigs et des clips peuvent être décrits en JSON déclaratif validé par des assertions ; un modèle de langage peut proposer un premier rig à partir de la liste des pièces détectées.

---

## 4. Pipelines d'assemblage recommandés

### 4.1 Pipeline A — « auto-rig IA » (GPU 8 Go, HD et pixel art upscalé)

**Côté Python (FastAPI, job asynchrone)**

1. Génération du personnage en A-pose, fond uni (autre agent) ; upscale ×4 si pixel art (RealESRGAN, BSD-3, ou nearest).
2. Détourage : rembg / anime-segmentation → alpha.
3. **See-through** (Apache-2.0, NF4 ≈ 8 Go) → PSD de 10–23 couches complétées + masques de parties (SAM body parsing 19 classes) + profondeur → ordre d'empilement initial.
4. Pose 2D : rtmlib RTMPose (Apache, CPU) ou poids « drawn humanoid » d'Animated Drawings (MIT) → 17 keypoints → squelette 15 os avec pivots aux articulations ; association couche ↔ os par recouvrement masque/os.
5. Maillage par couche : contour alpha (OpenCV `findContours` + `approxPolyDP`) → poly2tri/earcut + points intérieurs → poids harmoniques (libigl) ou distance inverse lissée.
6. Export du rig au format JSON maison (compatible DragonBones), pièces en atlas PNG, palette extraite.

**Côté navigateur (React 19 + PixiJS 8)**

7. Éditeur de rig : affichage des pièces en `MeshSimple`, os en overlay (Konva ou Pixi Graphics), IK 2 os / FABRIK, correction des pivots et des poids (pinceau), ordre d'empilement, mirroring.
8. Bibliothèque de clips : procéduraux + 100STYLE/CMU convertis ; timeline (react-timeline-editor MIT) + dopesheet maison ; easing via `@theatre/core` (Apache) ou fonctions maison.
9. Aperçu temps réel ; export : rendu 4–8× dans un `RenderTexture`, `renderer.extract`, puis quantification palette + pixel snapping en WebGL/Canvas → PNG/sprite sheet ; ou envoi du rig + clip au backend.

**Côté Python (rendu batch garanti)**

10. Rendu déterministe des frames : moderngl (EGL headless) ou skia-python pour le mode mesh ; Pillow `transform` + RotSprite NumPy pour le paper-doll ; quantification Pillow avec la palette du projet ; assemblage de la sprite sheet + JSON d'animation (Aseprite-like / Godot SpriteFrames).

### 4.2 Pipeline B — « rig semi-manuel CPU » (sans GPU, pixel art natif)

1. Génération → détourage (CPU).
2. Pose 2D par rtmlib (CPU) → squelette proposé.
3. Découpe assistée dans le navigateur : SAM 2 tiny en ONNX côté serveur (CPU, ~1 s/clic) ou onnxruntime-web ; amorçage automatique par les os, correction par clics ; chaque partie devient un calque.
4. Inpainting LaMa (CPU) des trous des calques inférieurs.
5. Rig paper-doll (pivots seulement), clips procéduraux + templates 8 frames, rendu avec cache RotSprite par angle et positions entières → frames pixel-perfect.
6. Option HD : maillage + LBS comme en A, sans See-through.

### 4.3 Pipeline C — « desktop pro » (utilisateurs avancés)

Export des calques (PSD/PNG + JSON) vers **COA Tools 2** (Blender, GPL, en sous-processus ou manuellement) ou **OpenToonz/Tahoma2D Plastic**, animation dans l'outil, réimport des frames rendues (`blender -b`, `tcomposer`, `synfig` CLI) dans notre pipeline de pixelisation/quantification. Godot : export direct en scène `Skeleton2D` (comme Proscenio) pour ceux qui animent dans le moteur.

### 4.4 Répartition navigateur / Python

| Étape | Navigateur (React/PixiJS) | Python (FastAPI) |
|---|---|---|
| Segmentation, complétion, pose | interface de clics, aperçu | See-through / SAM 2 / rtmlib / LaMa |
| Maillage, poids | édition, pinceau de poids | calcul initial (poly2tri, libigl) |
| Squelette, IK, clips, timeline | oui (tout en TS) | conversion BVH → clips 2D, text-to-motion optionnel |
| Rendu aperçu | PixiJS temps réel | — |
| Rendu final / batch | export rapide | rendu déterministe + quantification + sprite sheet |

---

## 5. Ce qu'il faudrait développer soi-même

| Composant | Réutilisation | Effort (ordre de grandeur) |
|---|---|---|
| Service de découpe : orchestration See-through (GPU) + fallback SAM 2 amorcé par la pose (CPU) + LaMa | See-through, SAM 2, rtmlib, LaMa (tous Apache/MIT) | 2–3 semaines |
| Auto-squelette 17 kp → 15 os + association couches/os + pivots | Logique d'Animated Drawings (MIT) | 1 semaine |
| Maillage + poids (contour → CDT → harmoniques/distance) | poly2tri/earcut, libigl, NumPy | 1–2 semaines |
| Format de rig JSON (compatible DragonBones) + exports Godot `.tscn`, sprite sheet + JSON Aseprite/Godot | Spécifications ouvertes | 1 semaine |
| Éditeur de rig PixiJS 8 : maillages, LBS TS/shader, os, IK 2 os + FABRIK, ordre d'empilement, mirroring, pinceau de poids | PixiJS, Konva ; idées ink-and-bones | 4–6 semaines (le plus gros poste) |
| Timeline + dopesheet + courbes d'easing | react-timeline-editor (MIT), `@theatre/core` (Apache) ou maison | 2–3 semaines |
| Bibliothèque de clips : procéduraux (idle, walk, run, jump, attack, hurt, death) + retargeting BVH 100STYLE/CMU → 2D | Retargeting d'Animated Drawings (MIT), 100STYLE (CC-BY), CMU | 2–3 semaines |
| Renderer pixel art : supersampling, palette fixe, pixel snapping, cache RotSprite (port NumPy et TS depuis Pixelorama MIT), dithering ordonné | Pixelorama (MIT), Pillow | 2 semaines |
| Renderer Python mesh (moderngl EGL ou skia-python) | moderngl / skia-python | 1 semaine |
| Ponts desktop (export COA Tools 2 / OpenToonz / Godot) | Formats des outils | 1 semaine chacun, optionnel |

Total indicatif : **4 à 6 mois-personne** pour un premier produit complet (pipeline B en priorité, A quand le GPU est présent), l'éditeur de rig web représentant environ un tiers de l'effort. Le risque principal n'est pas technique mais de licence : garder hors du produit Spine runtimes, Sapiens, OpenPose, YOLO/FastSAM (AGPL), Bizarre Pose (AGPL), Theatre Studio (AGPL), Triangle (Shewchuk), AMASS et les modèles text-to-motion entraînés dessus.

---

## 6. Sources

Outils et runtimes de rig
- Inochi2D SDK — https://github.com/Inochi2D/inochi2d ; Legal Info (BSD-2) — https://github.com/Inochi2D/inochi2d/wiki/Legal-Info ; Inochi Creator — https://github.com/Inochi2D/inochi-creator ; inox2d — https://github.com/Inochi2D/inox2d
- DragonBones — https://github.com/DragonBones ; DragonBonesJS — https://github.com/DragonBones/DragonBonesJS ; téléchargements — https://dragonbones.github.io/en/download.html
- Spine runtimes — https://github.com/EsotericSoftware/spine-runtimes ; licence runtimes — https://en.esotericsoftware.com/spine-runtimes-license ; spine-ts README — https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/spine-ts/README.md ; pixijs/spine-v8 (archivé) — https://github.com/pixijs/spine-v8 ; rigc — https://github.com/firejune/rigc
- Rive web runtime — https://github.com/rive-app/rive-wasm
- Godot 2D skeletons — https://docs.godotengine.org/en/stable/tutorials/animation/2d_skeletons.html ; SkeletonModification2D — https://docs.godotengine.org/en/stable/classes/class_skeletonmodification2d.html ; Proscenio — https://github.com/firebound/proscenio
- COA Tools (original) — https://github.com/ndee85/coa_tools ; COA Tools 2 — https://github.com/Aodaruma/coa_tools2 ; fork 4.x — https://github.com/Nebulafalls/coa_tools2-4.x
- Synfig — https://github.com/synfig/synfig ; Skeleton Deformation Layer — https://synfig.readthedocs.io/en/stable/layers/skeleton_deformation.html
- OpenToonz Plastic tool — https://opentoonz.readthedocs.io/en/latest/create_animations_using_plastic_tool.html ; Tahoma2D — https://github.com/tahoma2d/tahoma2d
- AnimeEffects — https://github.com/AnimeEffectsDevs/AnimeEffects ; Wick Editor — https://github.com/Wicklets/wick-editor
- ink-and-bones — https://github.com/sero-labs/ink-and-bones ; spine-animation-ai (PolyForm NC) — https://github.com/GenielabsOpenSource/spine-animation-ai

Auto-rig, segmentation, pose
- Animated Drawings — https://github.com/facebookresearch/AnimatedDrawings ; README — https://raw.githubusercontent.com/facebookresearch/AnimatedDrawings/main/README.md
- See-through (SIGGRAPH 2026) — https://github.com/shitagaki-lab/see-through ; arXiv — https://arxiv.org/abs/2602.03749
- Bunraku — https://arxiv.org/abs/2607.27348 ; page projet — https://bunraku-live2d.github.io/ ; dépôt — https://github.com/SparcAI-Inc/Bunraku
- CartoonAlive — https://arxiv.org/html/2507.17327v1
- Outline and Detail (UIST 2025) — https://dl.acm.org/doi/10.1145/3746059.3747707
- APES — https://ar5iv.labs.arxiv.org/html/2206.02015 ; https://zhan-xu.github.io/parts/ ; https://github.com/zhan-xu/APES
- SAM 2 — https://github.com/facebookresearch/sam2
- rtmlib — https://github.com/Tau-J/rtmlib ; DWPose — https://github.com/IDEA-Research/DWPose ; MMPose RTMPose — https://github.com/open-mmlab/mmpose/tree/main/projects/rtmpose
- Bizarre Pose Estimator (AGPL) — https://github.com/ShuhongChen/bizarre-pose-estimator ; AnimeDrawingsDataset — https://github.com/dragonmeteor/AnimeDrawingsDataset
- CartoonSegmentation / AnimeInsSeg — https://github.com/CartoonSegmentation/CartoonSegmentation ; anime-segmentation — https://github.com/SkyTNT/anime-segmentation
- Sapiens (CC-BY-NC) — https://huggingface.co/facebook/sapiens ; SCHP — https://github.com/GoGoDuck912/Self-Correction-Human-Parsing
- OpenPose (non commercial) — https://github.com/CMU-Perceptual-Computing-Lab/openpose
- Rigging sketches — https://github.com/mounika-v/Rigging-sketches-for-2D-character-animation
- HumanRig — https://arxiv.org/abs/2412.02317 ; UniRig — https://arxiv.org/html/2504.12451 ; ASMR — https://arxiv.org/html/2503.13579
- Sprite Sheet Diffusion — https://arxiv.org/abs/2412.03685

Complétion
- LaMa — https://github.com/advimman/lama ; IOPaint (archivé) — https://github.com/Sanster/IOPaint

Déformation, maillage
- libigl Python — https://github.com/libigl/libigl-python-bindings ; docs — https://libigl.github.io/libigl-python-bindings/igl_docs/
- ARAP Igarashi (page auteur) — https://www-ui.is.s.u-tokyo.ac.jp/~takeo/research/rigid/index.html ; implémentations — https://github.com/deliagander/ARAPShapeManipulation ; https://github.com/zhangzhensong/arap ; https://github.com/forestsen/ARAPShapeManipulation
- earcut — https://github.com/mapbox/earcut ; Triangle — https://www.cs.cmu.edu/~quake/triangle.html ; pip triangle — https://pypi.org/project/triangle/
- PixiJS v8 meshes — https://pixijs.com/8.x/guides/components/scene-objects/mesh

Mouvement
- 100STYLE — https://www.ianxmason.com/100style/ ; CMU mocap — http://mocap.cs.cmu.edu/ ; AMASS licence — https://amass.is.tue.mpg.de/license.html
- MoMask — https://github.com/EricGuo5513/momask-codes ; MDM — https://github.com/GuyTevet/motion-diffusion-model

Pixel art
- Pixelorama (rotxel, cleanEdge, OmniScale) — https://github.com/Orama-Interactive/Pixelorama ; Pixel Composer — https://github.com/Ttanasart-pt/Pixel-Composer

UI web
- Theatre.js — https://github.com/theatre-js/theatre ; react-timeline-editor — https://github.com/xzdarcy/react-timeline-editor
