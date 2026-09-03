# 05 — Pliage / Dépliage : plusieurs assets dans une seule requête d'image

> Recherche technique (septembre 2026) pour un générateur d'assets 2D open-source-first (pixel art en priorité), concurrent de SpriteCook. Stack cible : FastAPI + Pillow/NumPy, React 19 + @xyflow/react, GPU 8 Go ou CPU. Solutions **open source uniquement** (licence indiquée) ; le propriétaire est cité comme *référence* et marqué ⚠️.
>
> Vocabulaire : **pliage** = composer une requête qui demande N éléments dans une image (planche / grille / contact sheet) ; **dépliage** = récupérer l'image, la découper, nommer, aligner et valider les N éléments ; **repliage** = re-packer les éléments en atlas pour le moteur de jeu.

---

## 1. Problèmes et verrous

1. **Le modèle ne respecte pas la grille demandée.** Les modèles d'image (Gemini « Nano Banana », GPT-Image, FLUX, Qwen) comprennent « 8 objets en 2 rangées » mais n'alignent pas les cellules au pixel : largeur variable selon le contenu, dérive de quelques % entre rangées, cellules fusionnées ou vides. Retour d'expérience Robotic Ape (2026) : « Nano Banana ne maintient pas une grille parfaitement uniforme… les sprites varient en largeur selon leur contenu » → il faut découper *par contenu*, pas par division uniforme.
2. **Pas d'alpha en sortie (ou pas fiable).** Gemini rend du RGB plat ; GPT-Image accepte `background="transparent"` (gpt-image-1/1.5, et gpt-image-2 en preview selon le guide OpenAI, mais des tests tiers rapportent des refus). Le détourage doit donc être *notre* étape, robuste : chroma key, puis modèle de matting en repli.
3. **Résolution effective par cellule.** Une planche 1024×1024 en 4×4 donne 256 px par cellule ; pour du pixel art 32 px c'est confortable (downscale ×8), pour de la HD c'est trop peu. Il faut choisir R×C, le ratio (1:1, 3:2, 16:9) et la résolution (1K/2K/4K) *en fonction* de la taille d'asset finale.
4. **Éléments qui se touchent ou se chevauchent.** Ombres, effets, armes dépassant la case : les composantes connexes fusionnent deux sprites, ou une boîte englobante « avale » le voisin (d'où le « smart alpha » de SpriteCook).
5. **Sur-segmentation.** Un sprite en plusieurs morceaux (yeux flottants, particules, épée détachée) donne trop de composantes → il faut fusionner par distance (`merge_distance`), filtrer par `min_area`, mais sans coller deux vrais sprites voisins.
6. **Nommage et ordre.** Il faut retrouver *quel* élément est « épée » et *lequel* est « potion », trier en ordre de lecture, détecter les cases vides / ratées / dupliquées, et ré-associer chaque sprite à la cellule demandée.
7. **Alignement des frames d'animation.** Les frames d'un même cycle sortent avec des positions différentes ; il faut recentrer (pieds / centroïde / bbox union) pour éviter le tremblement, et repérer les frames identiques.
8. **Coût du re-tirage.** Régénérer toute la planche pour une seule case ratée annule le gain économique ; il faut un retry *partiel* (édition masquée ou régénération d'une cellule avec les voisines comme référence).
9. **Repliage.** Les moteurs veulent des atlas (MaxRects) ou des grilles régulières, avec padding/extrusion pour éviter le bleeding, et des métadonnées (JSON TexturePacker, Aseprite, Godot, Phaser) qui conservent le *trim* et le *pivot*.
10. **Licences.** Beaucoup de « briques » séduisantes sont non commerciales (FLUX.1-dev/Kontext-dev, ICEdit, In-Context LoRA, bria-rmbg) ou copyleft fort (YOLO-World GPL-3, Ultralytics AGPL-3) ; il faut trier.

---

## 2. Solutions par problème

Légende des colonnes : *Type* = lib / modèle / outil / technique ; *Maturité* = ★ (proto) à ★★★★ (industriel) ; *Complexité* d'intégration 1 (trivial) → 5 (lourd).

### 2.1 Pliage : faire respecter une grille à un modèle d'image

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Gemini 2.5 Flash Image / 3.x Flash Image / 3 Pro Image (« Nano Banana ») ⚠️ | https://ai.google.dev/gemini-api/docs/image-generation | Propriétaire (API) | — | modèle API | ★★★★ | cloud | 1 | 10 ratios (1:1, 3:2, 16:9, 21:9…), 1K/2K/4K, jusqu'à 14 images de référence (Lite) ; pas d'alpha ; grille « approximative » | $0.039/image (2.5 Flash). Multi-turn d'édition, masquage sémantique par prompt (pas de masque explicite). |
| GPT-Image-1 / 1.5 / 2 ⚠️ | https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide | Propriétaire (API) | — | modèle API | ★★★★ | cloud | 1 | 1024², 1536×1024, 1024×1536 (gpt-image-2 : jusqu'à 2560×1440+, bords multiples de 16, ratio ≤ 3:1) ; `background=transparent` sur generate **et** edits ; masque PNG alpha pour inpainting | gpt-image-1 : $0.011 (low) / $0.042 (medium) / $0.167 (high) en 1024². SpriteCook l'utilise pour les planches UI « qui se découpent le plus fiablement » (alpha natif + rendu net des panneaux). |
| Qwen-Image-Edit 2509 / 2511 | https://huggingface.co/Qwen/Qwen-Image-Edit-2511 | **Apache-2.0** | Python (diffusers) | modèle local | ★★★ | 20 B params : 8 Go = quantifié GGUF/nunchaku + offload (lent) | 4 | 1 à 3 images d'entrée, édition par instruction, ControlNet (depth/edge/pose), bonne cohérence multi-personnages (2511) | Seule alternative *vraiment* open source à Kontext pour « remplis les cases vides dans le même style ». |
| FLUX.1 Kontext dev ⚠️ | https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev | FLUX.1 [dev] Non-Commercial | Python | modèle local | ★★★ | 12 B, ~12–24 Go (8 Go via GGUF/nunchaku) | 4 | Édition in-context, références multiples, LoRA « turnaround sheet » 5 vues | Non commercial → référence seulement. |
| ICEdit (In-Context Edit) ⚠️ | https://github.com/River-Zhang/ICEdit | Non commercial (base FLUX.1-Fill-dev) | Python | modèle local | ★★★ | 4 Go avec nunchaku | 4 | Diptyque « gauche = source, droite = édité » ; largeur fixée à 512 | Prouve la technique « concaténer sur un canevas + remplir la moitié vide ». |
| In-Context LoRA (Ali-ViLab) ⚠️ | https://github.com/ali-vilab/In-Context-LoRA | Base FLUX.1-dev (NC) | Python | LoRA | ★★ | idem FLUX | 4 | Concatène plusieurs images en une seule + légende jointe ; 20–100 exemples suffisent ; SDEdit instable pour l'identité | Modèle de pensée : entraîner une LoRA « planche de 8 objets » sur un modèle Apache (Qwen-Image) est faisable. |
| PersonalView (arXiv 2511.00293) | https://arxiv.org/html/2511.00293v1 | Papier CC-BY ; code annoncé | — | recherche | ★ | — | 5 | Grille 4 panneaux de depth-maps comme signal in-context pour des vues multiples cohérentes (FLUX + PuLID) | Confirme : les DiT ont une capacité multi-vue « en grille » latente. |
| Sprite Sheet Diffusion (arXiv 2412.03685) | https://github.com/chenganhsieh/Sprite-Sheet-Diffusion | Papier CC-BY ; code SD1.5/Animate-Anyone | Python | recherche | ★ | SD1.5 : OK 8 Go | 4 | Frames pilotées par pose (ReferenceNet + Pose Guider) — génère frame par frame, pas une planche | Voie « animation par pose » ; hors scope direct du pliage. |
| SDXL / SD1.5 + ControlNet (Tile / Lineart / Canny) | https://huggingface.co/lllyasviel | CreativeML Open RAIL++-M (SDXL), Apache-2.0 (ControlNet) | Python | modèle local | ★★★ | 6–8 Go OK | 3 | On peut donner la **grille dessinée** comme contrôle Canny/Lineart : le modèle respecte les traits, donc les cellules ; qualité de cohérence entre cases plus faible que Gemini/GPT | Meilleure façon *locale* d'imposer une grille exacte ; combiner avec LoRA pixel art. |
| sprite-gen (aldegad) | https://github.com/aldegad/sprite-gen | **Apache-2.0** | Python 3.10+ | pipeline complet | ★★★ (680 ★, très actif) | CPU | 2 | Génère **une bande par état** (idle, walk…) avec un *layout guide* (cellules invisibles + marges) et fond chroma magenta ; prompt exigeant « N poses, une par case, pas d'ombre/glow/boîte » | Le projet open source le plus proche de notre besoin ; à étudier ligne par ligne. |

**Retours d'expérience convergents (Robotic Ape 2026, Rosebud, selfielab, prompting.systems, sprite-gen)** :
- Limiter à **3–6 éléments par rangée, 2–3 rangées** par planche : au-delà, la cohérence et le respect du compte chutent.
- Décrire **chaque case explicitement** (« Rangée 1, de gauche à droite : … ») ; répéter la liste de contraintes à chaque itération d'édition (« preserve list ») pour réduire la dérive.
- Utiliser des **majuscules pour les non-négociables** et des **hex exacts** (« CRITICAL: background must be pure #00FF00, NO gradients, NO shadows, no green anywhere in the sprites »).
- Fond **chroma vert #00FF00** (ou magenta #FF00FF) avec contour clair 2–3 px : bien plus robuste que noir (les contours noirs se confondent) ou que « transparent » (ignoré).
- **6 images de référence maximum** chez Nano Banana Pro (au-delà le modèle « moyenne » les détails) ; garder les mêmes tokens descriptifs d'une requête à l'autre.
- Les labels de texte *dans* les cellules polluent la découpe → les mettre dans une marge, ou ne pas en demander et se fier à l'ordre.

**Recommandation.** Cloud : Gemini pour la cohérence de style entre cases (personnages, objets), GPT-Image quand l'alpha natif compte (UI, icônes). Local (8 Go) : SDXL/SD1.5 + ControlNet Canny sur le gabarit pour une grille *exacte* ; Qwen-Image-Edit (Apache-2.0) pour « remplir les cases vides » à partir de références, en acceptant la lenteur. Écarter FLUX-dev/Kontext/ICEdit/IC-LoRA (non commerciaux) sauf comme référence de technique.

### 2.2 Dépliage (a) : découpe par grille connue + correction de dérive

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Profils de projection (NumPy) | https://numpy.org | BSD-3 | Python | technique | ★★★★ | CPU | 1 | Somme de l'alpha par colonne/ligne → « vallées » = séparateurs ; on cherche la vallée la plus proche de chaque position théorique (± 10 % de la cellule) | 20 lignes de code, imbattable en coût. Base de notre `GridSlicer`. |
| spritesheet_detector | https://github.com/mirsella/spritesheet_detector | **MIT** | Rust (crate 0.4.0) | lib + CLI | ★★ | CPU (rayon) | 2 (port Python) | Profils alpha + gradients → **autocorrélation** + « Variance of Variance » pour la période, validation des lignes de coupe, comptage des frames actives ; gère les planches redimensionnées (harmoniques) | Meilleur algorithme documenté de détection *automatique* de la taille de cellule. À porter en NumPy (rustfft → `numpy.fft`). |
| Extraction de lignes par morphologie (OpenCV) | https://docs.opencv.org/4.x/dd/dd7/tutorial_morph_lines_detection.html | Apache-2.0 | Python | technique | ★★★★ | CPU | 1 | Noyaux (largeur/30, 1) et (1, hauteur/30) → isole les **séparateurs dessinés** par le modèle | Utile quand on a demandé une grille visible (traits noirs) ; combiner avec `cv2.HoughLinesP`. |
| Aseprite Import Sprite Sheet ⚠️ | https://aseprite.org/api/command/ImportSpriteSheet | EULA propriétaire (source-available) | C++ / Lua | outil | ★★★★ | CPU | — | Types Horizontal/Vertical Strip, By Rows, By Columns ; `frameBounds`, `padding`, `partialTiles` ; champs colonnes/lignes calculés (`calcColumns/calcRows`) | Pas de détection par alpha à l'import. Référence d'UX. |
| LibreSprite | https://github.com/LibreSprite/LibreSprite | **GPL-2.0** | C++ | outil | ★★★ | CPU | — | Fork du dernier commit GPLv2 d'Aseprite ; même import par grille | Code lisible pour l'UX, mais GPL → ne pas lier. |
| Pixelorama | https://github.com/Orama-Interactive/Pixelorama | **MIT** | GDScript | outil | ★★★ | CPU | — | Import : frames horizontales/verticales manuelles **ou** « smart slice » (`RegionUnpacker(threshold, merge_dist).get_used_rects()` → rects + `frame_size`) | La seule référence MIT combinant grille et détection ; l'algorithme (bitmap alpha → rects fusionnés à `merge_dist`) est simple à reproduire. |
| Godot SpriteFrames / AtlasTexture | https://docs.godotengine.org | **MIT** | C++ | moteur | ★★★★ | CPU | — | « Add frames from sprite sheet » : hframes/vframes, offset, séparation ; pas de dérive | Format d'export à viser. |
| Unity Sprite Editor ⚠️ | https://docs.unity3d.com/6000.2/Documentation/Manual/sprite/sprite-editor/automatic-slicing.html | Propriétaire | — | référence | ★★★★ | — | — | Modes Automatic / Grid by Cell Size / Grid by Cell Count / Isometric ; pivot, offset, padding, « Keep Empty Rects », méthodes Delete/Smart/Safe | Le vocabulaire d'options à reprendre dans notre nœud UI. |
| TexturePacker Sprite Sheet Cutter ⚠️ | https://www.codeandweb.com/texturepacker/documentation/sprite-sheet-cutter | Propriétaire | — | référence | ★★★★ | — | — | Grille/strip, « rectangular » automatique quand aucune grille nette n'est détectée, lecture des fichiers de données | Idée : basculer automatiquement grille ↔ libre selon un score de régularité. |

**Recommandation.** Mode « grille » = projection + recalage local des séparateurs autour des positions théoriques ; si la grille n'est pas connue (image importée), estimer la période par autocorrélation à la spritesheet_detector ; si des traits sont dessinés, les extraire par morphologie et les retirer du masque alpha avant la suite.

### 2.3 Dépliage (b) : composantes connexes, fusion, min_area, chevauchements

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `scipy.ndimage.label` + `find_objects` | https://docs.scipy.org/doc/scipy/reference/ndimage.html | BSD-3 | Python | lib | ★★★★ | CPU | 1 | Étiquetage 4/8-connexe d'un masque `alpha > seuil` ; bboxes par label | Déjà dans la stack. Dilater le masque de `merge_distance` px **avant** d'étiqueter = fusion à distance en une ligne. |
| `cv2.connectedComponentsWithStats` | https://docs.opencv.org/4.x/ | Apache-2.0 | Python | lib | ★★★★ | CPU | 1 | Renvoie label, aire, bbox, centroïde d'un coup ; plus rapide que scipy sur grandes images | Alternative équivalente. |
| `skimage.measure.regionprops` | https://scikit-image.org | BSD-3 | Python | lib | ★★★★ | CPU | 1 | Propriétés riches (solidité, orientation, extent) utiles pour filtrer les débris | Complément. |
| Watershed sur transformée de distance (skimage/OpenCV) | https://scikit-image.org/docs/stable/auto_examples/segmentation/plot_watershed.html | BSD-3 / Apache-2.0 | Python | technique | ★★★★ | CPU | 2 | Sépare deux sprites qui se touchent par un col fin (ombres, épée collée) | 1er niveau avant SAM ; marche mal si le contact est large. |
| Godot « Auto Slice » (TextureRegion editor) | https://github.com/godotengine/godot (editor/plugins/texture_region_editor_plugin.cpp) | **MIT** | C++ | algorithme de référence | ★★★★ | CPU | 1 | Balayage des pixels opaques ; un pixel rejoint un rect existant s'il est dans `rect.grow(1.5)` sinon crée un rect 1×1 ; puis boucle de fusion `while(merged)` des rects dont `grow(1)` s'intersectent | Algorithme « boîtes qui grossissent » simple, lisible, sans lib ; équivalent à des CC + fusion des bboxes qui se chevauchent. |
| Pixelorama `RegionUnpacker` | https://github.com/Orama-Interactive/Pixelorama | **MIT** | GDScript | algorithme de référence | ★★★ | CPU | 1 | Paramètres *threshold* (alpha) et *merge_dist* ; renvoie rects + `frame_size` estimé (max des rects) pour recaler en grille | Modèle direct des paramètres SpriteCook (`alpha_threshold`, `merge_distance`). |
| sprite-gen `extract_sprite_row_frames.py` | https://github.com/aldegad/sprite-gen | **Apache-2.0** | Python | script | ★★★ | CPU | 2 | CC avec alpha > 16 ; « graines » = composantes ≥ 20 % de l'aire max, triées par x ; les petites composantes rejoignent la graine la plus proche ; contrôles d'outliers (0.35 / 2.75) et `min_used_pixels` = 400 | Excellente heuristique de **fusion par graines** (mieux qu'une distance fixe pour les personnages avec particules). |
| slicesheet (tcgm) | https://github.com/tcgm/slicesheet | MIT | C# (.NET 8, OpenCvSharp) | outil | ★ (dormant) | CPU | — | Modes px, rows/cols, auto | Peu utile, cité pour exhaustivité. |
| Image-Slicer (ttloi2404) | https://github.com/ttloi2404/Image-Slicer | **aucune licence** | Python | outil | ★ | CPU | — | CC + fusion manuelle | Inutilisable (pas de licence). |
| ShoeBox, Leshy SpriteSheet Tool ⚠️ | https://www.leshylabs.com/apps/sstool/ | Freeware propriétaires | — | référence | ★★★ | — | — | Extraction par alpha, export JSON | Références d'UX seulement. |

**Chevauchements et « smart alpha ».** Quand deux bboxes se recouvrent, il ne faut pas copier le rectangle brut : on garde la **carte de labels** et, pour chaque asset, on ne copie que les pixels dont le label appartient à son groupe de composantes (les autres sont mis à alpha 0). C'est exactement ce que SpriteCook appelle « smart alpha » ; avec `scipy.ndimage.label` c'est un masque booléen `np.isin(labels, group_ids)`.

**Recommandation.** `scipy.ndimage.label` sur `alpha > alpha_threshold` après dilatation de `merge_distance` ; fusion par graines (sprite-gen) plutôt que par distance seule quand on connaît le nombre attendu ; watershed puis SAM (2.4) en repli pour les contacts ; smart alpha systématique.

### 2.4 Dépliage (c) : segmentation SAM pour séparer ce qui se touche

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| SAM 2.1 (`SAM2AutomaticMaskGenerator`) | https://github.com/facebookresearch/sam2 | **Apache-2.0** | Python | modèle | ★★★★ | tiny 39 M → large 224 M ; small OK sur 8 Go et CPU (secondes) | 3 | `points_per_side`, `pred_iou_thresh`, `stability_score_thresh`, `box_nms_thresh`, `min_mask_region_area` ; sortie : masque, aire, bbox, scores | Mode « segment everything » restreint à la bbox problématique = beaucoup moins cher que sur toute la planche. |
| MobileSAM | https://github.com/ChaoningZhang/MobileSAM | **Apache-2.0** | Python | modèle | ★★★ | 9.66 M params ; ~12 ms GPU, ~3 s CPU | 2 | Même API que SAM v1 (`SamAutomaticMaskGenerator`) ; qualité de contour inférieure | Choix CPU-only. |
| rembg (u2net, isnet-anime, birefnet) | https://github.com/danielgatis/rembg | **MIT** (attention : `bria-rmbg` non commercial) | Python | lib | ★★★★ | CPU OK | 1 | Détourage quand le chroma a échoué ; `isnet-anime` bon sur le dessin ; alpha matting optionnel | Repli pour l'alpha, pas pour séparer des objets. |

**Recommandation.** SAM 2.1-small uniquement sur les composantes « suspectes » (aire ≫ médiane, ou nombre de CC < attendu), points échantillonnés dans la bbox ; conserver les masques dont l'aire est cohérente avec la médiane des autres cellules ; re-labelliser.

### 2.5 Dépliage (d)/(e) : nommer les assets (détection ouverte, VLM)

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| OWLv2 (`owlv2-base-patch16-ensemble`) | https://huggingface.co/google/owlv2-base-patch16-ensemble | **Apache-2.0** | Python (transformers) | modèle | ★★★★ | ~0.2 B, < 2 Go | 2 | Requêtes texte multiples (« sword », « potion »…) → boîtes + scores ; détection guidée par image (one-shot) | Le meilleur rapport licence/simplicité pour « retrouver l'épée dans la planche ». |
| Grounding DINO (Swin-T) | https://github.com/IDEA-Research/GroundingDINO | **Apache-2.0** | Python | modèle | ★★★★ | GPU ou **CPU** supporté | 3 | Prompt « sword . potion . shield . » ; 900 boîtes candidates filtrées par `box_threshold` | Plus précis qu'OWLv2 sur photos ; sur pixel art les deux sont moyens → utiliser comme *classement* de cellules déjà découpées, pas comme détecteur. |
| YOLO-World (AILab-CVC) ⚠️ | https://github.com/AILab-CVC/YOLO-World | **GPL-3.0** | Python | modèle | ★★★ | S→X | 3 | Temps réel | GPL → à isoler dans un service séparé si utilisé. Version Ultralytics : AGPL-3.0. |
| Florence-2 (base 0.23 B / large 0.77 B) | https://huggingface.co/microsoft/Florence-2-large | **MIT** | Python | VLM | ★★★★ | ~1.5 Go fp16, CPU possible | 2 | `<CAPTION>`, `<OD>`, `<DENSE_REGION_CAPTION>`, `<CAPTION_TO_PHRASE_GROUNDING>`, `<REGION_PROPOSAL>`, OCR | Étiquetage rapide de chaque vignette découpée ; phrase grounding = nommer avec la liste attendue. |
| Qwen2.5-VL-7B-Instruct (et Qwen3-VL) | https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct | **Apache-2.0** (7B ; le 3B est sous Qwen Research License) | Python | VLM | ★★★★ | 7B : GGUF Q4 ≈ 5–6 Go | 3 | Boîtes + JSON structuré ; peut répondre « y a-t-il 8 sprites ? lesquels sont vides ? » | Validateur sémantique ; plus lent que Florence-2. |
| Gemini / GPT-4o en VLM ⚠️ | — | Propriétaire | — | API | ★★★★ | cloud | 1 | Vérification « compte et nomme » très fiable | Coût marginal si l'on a déjà un appel de génération. |

**Recommandation.** Grille respectée → nommer **par index de cellule** (zéro ML). Sinon : OWLv2 avec la liste attendue comme requêtes, affectation hongroise (`scipy.optimize.linear_sum_assignment`) entre cellules et noms ; Florence-2 pour un caption de secours / slug automatique ; Qwen2.5-VL pour l'audit final.

### 2.6 Dépliage (f) : tri, déduplication, cases vides

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Tri en ordre de lecture (clustering de lignes) | — (maison) | — | Python | technique | — | CPU | 1 | Regrouper par centroïde y avec tolérance = ½ hauteur médiane, puis trier par x dans chaque ligne | Suffit dans 95 % des cas ; sinon projeter sur la grille théorique. |
| ImageHash (phash/dhash/whash/crop-resistant) | https://pypi.org/project/ImageHash/ | **BSD-2** | Python | lib | ★★★★ (4.3.2, 2025) | CPU | 1 | Distance de Hamming < 5–8 = doublon ; crop_resistant pour tailles différentes | Déduplication de frames d'animation et de variantes. |
| DINOv2-small | https://huggingface.co/facebook/dinov2-small | **Apache-2.0** | Python | modèle | ★★★★ | 22 M params, CPU OK | 2 | Similarité cosinus des embeddings : doublons *sémantiques* et score de cohérence de style entre cases | Base du « score de cohérence » (§4). |
| Détection de cases vides | — (maison) | — | Python | technique | — | CPU | 1 | Aire alpha < `min_area` ou < 20 % de la médiane ; entropie faible ; sprite-gen : `min_used_pixels=400`, ratios d'outliers 0.35/2.75 | Déclenche le retry partiel. |

### 2.7 Repliage : packing d'atlas et formats

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| rectpack | https://github.com/secnot/rectpack | **Apache-2.0** | Python | lib | ★★★ (0.2.2, 2021 ; stable) | CPU | 1 | MaxRects (Bl/Bssf/Baf/Blsf), Skyline (6 variantes), Guillotine (12) ; rotation ; bins multiples ; entiers seulement | Notre packer par défaut (backend Python). |
| PyTexturePacker | https://pypi.org/project/PyTexturePacker/ | **MIT** (1.2.1, 2024) | Python | lib | ★★★ | CPU | 1 | MaxRects, `trim_mode`, `extrude`, `border_padding`, `shape_padding`, `inner_padding`, `reduce_border_artifacts` (alpha bleeding), `force_square`, `enable_rotated` ; export plist/json/csv | Fait déjà trim + extrude + bleeding : gain de temps. |
| free-tex-packer-core | https://github.com/odrick/free-tex-packer-core | **MIT** | JS/Node | lib | ★★★ (maintenance minimale) | CPU | 1 | MaxRectsBin, MaxRectsPacker, OptimalPacker ; `padding`, `extrude`, `allowRotation`, `allowTrim`, `detectIdentical`, `powerOfTwo`, `fixedSize` ; exporters JsonHash/JsonArray/Phaser/Godot(Atlas, Tileset)/Spine/XML/CSS… via Mustache | Idéal côté front (@xyflow) pour un pack « instantané » dans le navigateur, et pour ses **templates d'export**. |
| maxrects-packer | https://github.com/soimy/maxrects-packer | **MIT** | TypeScript | lib | ★★★ (2.7.4, 2025) | CPU | 1 | Bins multiples, rotation, `padding`, `border`, `pot`, `square`, tags exclusifs | Alternative TS moderne. |
| libGDX TexturePacker | https://libgdx.com/wiki/tools/texture-packer | **Apache-2.0** | Java | outil | ★★★★ | CPU | 2 | MaxRects, `pot`, `grid`, `paddingX/Y`, `edgePadding`, `duplicatePadding`, `bleed` + `bleedIterations`, `stripWhitespace`, `alias` (dédup) | Référence d'options ; format `.atlas` |
| crunch | https://github.com/ChevyRay/crunch | **MIT** | C++ | outil | ★★★ | CPU | 2 | Trim, rotation, premultiply, dédup, padding 0–16, sorties XML/JSON/binaire | Conçu pour Celeste ; simple à appeler en CLI. |
| spritesheet.js | https://github.com/krzysztof-o/spritesheet.js | MIT (vérifier le fichier LICENSE) | Node + ImageMagick | outil | ★★ | CPU | 2 | growing-binpacking, trim, padding ; sorties PIXI/Easel/Starling/CSS/cocos2d | Dépendance ImageMagick lourde ; préférer free-tex-packer-core. |
| TexturePacker (CodeAndWeb) ⚠️ | https://www.codeandweb.com/texturepacker | Propriétaire | — | référence | ★★★★ | — | — | Formats JSON hash/array (le standard de fait), pivots, 9-slice | Compatibilité des formats à viser. |

**Formats à produire** (tous documentés, sans licence) : JSON « hash » et « array » TexturePacker (`frame`, `rotated`, `trimmed`, `spriteSourceSize`, `sourceSize`, `pivot`) — lus par Phaser, PixiJS, Cocos ; JSON Aseprite (mêmes champs + `duration`, `frameTags`, `slices`) ; Godot (`AtlasTexture` .tres avec `region`/`margin`, ou `SpriteFrames`) ; et une **grille régulière** simple (frameWidth/frameHeight) pour les animations, que tous les moteurs chargent sans métadonnées.

**Padding/extrusion.** Padding 2 px + extrusion 1 px (copie des pixels de bord) suffisent pour du pixel art en nearest ; en filtrage linéaire ou avec mipmaps, `bleed` (libGDX/PyTexturePacker) évite les halos sombres. POT optionnel (les GPU modernes n'en ont plus besoin, mais certains formats compressés oui).

**Recommandation.** Backend : PyTexturePacker (MIT) pour trim + extrude + bleed + MaxRects, rectpack si l'on veut contrôler finement l'heuristique ; front : free-tex-packer-core pour la prévisualisation et ses templates d'export.

### 2.8 Alignement des frames d'animation

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Alignement par bbox union (canevas fixe) | — (maison) | — | Python | technique | — | CPU | 1 | On garde la **position absolue** de chaque frame dans sa cellule (offset conservé) ; canevas = union des bboxes | Si la grille a été respectée, c'est le plus fidèle (le modèle a déjà animé « en place »). |
| Alignement par ligne de sol (pieds) | — (maison) | — | Python | technique | — | CPU | 1 | y_bas = dernier pixel opaque ; on aligne tous les y_bas ; x = centroïde ou centre de la bbox | Standard pour marche/course/idle ; casse pour saut (utiliser bbox union). |
| Alignement par centroïde + stabilisation | — (maison) | — | Python | technique | — | CPU | 2 | Centroïde pondéré par l'alpha, lissage (médiane glissante) des offsets pour supprimer le tremblement | Pour les effets/objets sans sol. |
| sprite-gen `fit_to_cell` | https://github.com/aldegad/sprite-gen | Apache-2.0 | Python | script | ★★★ | CPU | 1 | Redimensionne à la cellule (Lanczos) et centre | Trop simple pour un cycle de marche (perd le sol), mais bon pour des icônes. |
| Frames dupliquées | ImageHash / DINOv2 (§2.6) | BSD-2 / Apache-2.0 | Python | lib | ★★★★ | CPU | 1 | dhash Hamming ≤ 3 sur frames normalisées → fusion avec durée doublée | Aseprite JSON : `duration` par frame. |

---

## 3. Idées malines / astuces

1. **Le gabarit est une image, pas un prompt.** Construire avec Pillow une planche au ratio exact (1:1, 3:2, 16:9) : fond chroma uni, cellules délimitées par des traits fins gris (ou invisibles + marges, comme sprite-gen), numéros dans la **marge** extérieure, et références collées dans certaines cases. L'envoyer en édition (« fill the empty cells with … in the same style, keep the grid ») ; le modèle respecte bien mieux une grille qu'il *voit* qu'une grille décrite.
2. **Chroma key HSV, jamais RGB.** Vert `#00FF00` : garder les pixels dont la teinte est à ±22° de 120°, saturation > 0.3, valeur > 0.3 (Robotic Ape) ; puis **despill** (réduire le canal vert à la moyenne des deux autres si le score de teinte dépasse 2× un delta, cf. sprite-gen `--fringe-delta 18`). Demander explicitement « no green anywhere in the sprites ».
3. **Deux fonds → alpha exact.** Quand le modèle est déterministe en édition (GPT-Image avec `input_fidelity=high`, ou local avec seed fixe), générer la même planche sur fond blanc et noir et résoudre α = 1 − (B − N)/255 par pixel (« double-image subtraction ») ; matting parfait sur les bords antialiasés.
4. **Downscale ×N = anti-dérive gratuit.** Pour du pixel art 32 px, générer 256 px par cellule ; une dérive de 6 px devient < 1 px après réduction, et le nearest-neighbor après une quantification de palette redonne un rendu net.
5. **Grille visible dessinée par le modèle = séparateurs détectables.** Demander « thin 2 px dark grid lines between cells » puis les extraire par morphologie/Hough : la grille réelle (dérivée) est lue directement, et les traits sont retirés du masque avant l'étiquetage.
6. **Fusion par graines plutôt que par distance fixe.** Quand on attend N sprites : prendre les N plus grosses composantes comme graines et rattacher les petites à la graine la plus proche (sprite-gen) ; robuste aux particules et aux armes détachées, sans coller deux voisins.
7. **Smart alpha = carte de labels.** Ne jamais copier une bbox brute ; copier `np.where(np.isin(labels, group), rgba, 0)`.
8. **Nommer par index de cellule d'abord, ML ensuite.** Si le compte de composantes = N attendu et que chaque centroïde tombe dans une cellule distincte, l'affectation est triviale ; OWLv2/Florence-2 ne servent qu'à vérifier ou à rattraper.
9. **Retry partiel par masque.** GPT-Image edits accepte un masque PNG alpha : masquer la seule cellule ratée et redemander « redraw cell 5: a red potion, same style as the others ». Chez Gemini, envoyer la planche + « regenerate only the empty cell (row 2, col 1) » ; en local, Qwen-Image-Edit avec la planche comme référence. Coût : 1 image au lieu d'une planche entière.
10. **Score de cohérence entre cases.** Embeddings DINOv2 de chaque vignette → matrice de similarité ; une case trop éloignée de la médiane (< 0.6 cosinus alors que les autres sont > 0.8) est un candidat au retry ; l'entropie de palette et la taille de bbox complètent le score pour le pixel art.
11. **Cohérence par diffusion de palette.** Après découpe, quantifier toutes les vignettes sur **une** palette commune (extraite de la planche entière, k-means ou `Image.quantize`) : rend les objets plus « du même jeu » et supprime les micro-différences de teinte entre cases.
12. **Bande par état pour l'animation.** Plutôt qu'une grille 4×4 mélangeant idle/walk/jump, demander une bande horizontale de 4–8 frames par état (sprite-gen) : le modèle gère mieux le timing, et la découpe est 1D (profil de projection horizontal).
13. **Tuiles : grille stricte + test de tiling.** Pour 16 tuiles en 4×4, découper strictement puis vérifier la jonction bord à bord (différence L1 entre colonnes/lignes de bord de tuiles voisines) ; détail dans le doc « tileset » d'un autre agent.
14. **UI : GPT-Image alpha natif + 9-slice.** Composants UI sur fond transparent (`background=transparent`), découpe par composantes, puis détection automatique des marges 9-slice (autre agent).
15. **Cache par hash de gabarit + prompt** : la même planche n'est jamais régénérée deux fois ; les vignettes découpées sont indexées par phash pour éviter les doublons inter-générations.

---

## 4. Pipelines d'assemblage recommandés

### 4.1 « Pliage » : de la demande au gabarit et à la requête

```
Spécification (N items, type, taille finale, style, références)
   │
   ▼
Planificateur de grille ──► R×C, ratio, résolution, px/cellule, marges
   │   (règles : ≤ 6 par rangée, ≤ 3 rangées ; px/cellule ≥ 6× taille finale
   │    en pixel art, ≥ 1× en HD ; ratio = plus proche de C/R parmi ceux du modèle)
   ▼
Constructeur de gabarit (Pillow) ──► PNG : fond #00FF00, traits gris 2 px,
   │   numéros en marge, références collées dans leurs cases, cases vides
   ▼
Constructeur de prompt ──► texte structuré : liste « Row r, cell c: … »,
   │   contraintes CRITICAL (fond hex, pas d'ombre/glow/texte, chaque item
   │   entièrement dans sa case, marge ≥ 8 %), style, palette
   ▼
Adaptateur modèle
   ├─ Gemini : generate ou edit (gabarit + ≤ 6 références), aspect_ratio, image_size 1K/2K
   ├─ GPT-Image : edits (gabarit + refs ≤ 16, masque alpha des cases vides, background=transparent si UI)
   └─ Local : SDXL/SD1.5 + ControlNet Canny(gabarit) + LoRA pixel art ; ou Qwen-Image-Edit
   ▼
Image brute + métadonnées (grille théorique, liste des cellules attendues, seed)
```

Exemple concret : 8 objets d'inventaire pixel art 32 px → grille 4×2, ratio 3:2 chez GPT-Image (1536×1024 ⇒ 384×512 par cellule) ou 16:9 chez Gemini 1K ; réduction finale ×12 avec quantification de palette.

### 4.2 « Dépliage » : de l'image à N assets nommés, alignés, packés

```
Image brute + grille théorique + liste attendue
   │
   ▼
1. Alpha : alpha natif ? → sinon chroma HSV + despill → sinon rembg (isnet-anime/birefnet)
   │
   ▼
2. Séparateurs (optionnel) : morphologie (w/30,1)/(1,h/30) → lignes retirées du masque
   │
   ▼
3. Choix de mode
   ├─ MODE ROBUSTE (grille) : profils de projection de l'alpha → vallées recalées sur les
   │     positions théoriques (± 10 %) → cellules corrigées → étiquetage CC *par cellule*
   │     (les composantes à cheval sont attribuées à la cellule majoritaire) → smart alpha
   └─ MODE LIBRE (composantes) : dilate(merge_distance) → scipy.ndimage.label(8-conn)
         → min_area → fusion par graines si N connu → watershed/SAM 2.1 sur les
         composantes trop grosses → smart alpha → tri ordre de lecture
   ▼
4. Nommage : index de cellule ↔ liste attendue ; sinon OWLv2(requêtes = noms) +
   affectation hongroise ; Florence-2 <CAPTION> pour slug de secours
   ▼
5. Validation : compte == N ; aucune cellule vide (aire < 20 % médiane) ; pas de doublon
   (dhash ≤ 3) ; outliers de taille (0.35 / 2.75) ; cohérence DINOv2 ; audit VLM optionnel
   ├─ échec local → retry partiel (masque de la cellule) → retour à 1
   └─ échec global (> 30 % des cellules) → régénération complète avec prompt renforcé
   ▼
6. Post-traitement : trim + offsets conservés ; downscale nearest ; palette commune ;
   pour une animation : alignement pieds/centroïde/bbox-union + fusion des frames identiques
   ▼
7. Repliage : PyTexturePacker/rectpack (MaxRectsBssf, padding 2, extrude 1, bleed) ou grille
   régulière ; export JSON TexturePacker hash/array + Aseprite JSON + Godot .tres +
   PNG individuels nommés
```

Le nœud xyflow « Unfold » expose les mêmes réglages que SpriteCook/Unity (mode Auto / Fixed Grid / Custom, `alpha_threshold`, `min_area`, `padding`, `merge_distance`, pivot, « keep empty rects ») avec une prévisualisation des rectangles ; « Custom Selection » = édition manuelle des rects, comme le TextureRegion editor de Godot.

### 4.3 Coût et gain

Avec Gemini 2.5 Flash Image à $0.039 l'image, une planche de 8 objets revient à ~$0.005 par asset ; avec gpt-image-1 medium ($0.042) idem. Un retry partiel coûte une image ; un retry complet coûte une planche. Le dépliage est entièrement CPU (< 1 s hors SAM/VLM), donc le coût d'infra est négligeable.

---

## 5. Ce qu'il faudrait développer soi-même

Aucun projet open source ne couvre la chaîne complète ; les briques existent, la colle manque. À écrire (Python, ~1 500–2 500 lignes) :

1. **`GridPlanner`** : choix R×C / ratio / résolution / px-cellule à partir de N, du type et de la taille finale ; tables par modèle (ratios et tailles supportés).
2. **`TemplateBuilder`** : gabarit Pillow (fond chroma, traits, numéros en marge, références collées, masque alpha des cases vides pour GPT-Image), + générateur de prompt structuré avec « preserve list ».
3. **`AlphaExtractor`** : chroma HSV + despill, double-fond (blanc/noir) quand disponible, repli rembg ; mesure de qualité des bords (`edge_pixel_threshold`).
4. **`GridSlicer`** : projection + recalage des séparateurs ; port NumPy de l'autocorrélation/VoV de spritesheet_detector pour les planches importées sans grille connue ; extraction de lignes dessinées.
5. **`ComponentSlicer`** : label + merge_distance + min_area + fusion par graines + smart alpha + watershed ; SAM 2.1 optionnel sur composantes suspectes ; tri ordre de lecture.
6. **`Namer`** : affectation par index, OWLv2 + hongrois, Florence-2 fallback ; slugs uniques.
7. **`Validator`** : compte, vides, doublons (ImageHash), outliers, cohérence DINOv2, audit VLM ; décision retry partiel/global.
8. **`FrameAligner`** : pieds / centroïde / bbox-union, lissage, fusion des frames identiques avec durées.
9. **`AtlasExporter`** : wrapper PyTexturePacker/rectpack + templates Mustache (repris de free-tex-packer-core, MIT) pour TexturePacker hash/array, Aseprite JSON, Godot, Phaser, grille régulière.
10. **Nœuds xyflow** « Fold » / « Unfold » / « Pack » avec prévisualisation des rects, édition manuelle, et réglages nommés comme dans Unity/SpriteCook.
11. Plus tard : **LoRA « planche »** (style In-Context LoRA) entraînée sur Qwen-Image (Apache-2.0) avec nos propres planches validées, pour un mode 100 % local cohérent.

---

## 6. Sources

- Robotic Ape — Generating Game Sprites with Gemini (Nano Banana Pro): Lessons Learned (2026) : https://roboticape.com/2026/03/07/generating-game-sprites-with-gemini-image-generation-nano-banana-pro-lessons-learned/
- Rosebud — How to Create Sprite Sheets with AI using Gemini and Nano Banana : https://lab.rosebud.ai/blog/how-to-create-a-sprite-sheet-with-ai-using-google-gemini-and-nano-banana-easy-guide
- selfielab — Nano Banana Pro consistent character sheets guide : https://selfielabstudio.com/blog/nano-banana-pro-consistent-character-sheets-guide-20260216
- prompting.systems — Nano Banana Pro character consistency guide : https://prompting.systems/blog/nano-banana-pro-character-consistency-guide
- Google — Gemini API image generation (modèles, ratios, 1K/2K/4K, références) : https://ai.google.dev/gemini-api/docs/image-generation
- Google — Gemini 2.5 Flash Image production + aspect ratios + prix : https://developers.googleblog.com/en/gemini-2-5-flash-image-now-ready-for-production-with-new-aspect-ratios/
- OpenAI — GPT Image models prompting guide (tailles, transparence, multi-image) : https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
- OpenAI — gpt-image-1 model page (prix) : https://developers.openai.com/api/docs/models/gpt-image-1
- OpenAI community — gpt-image-1 transparent backgrounds with edits : https://community.openai.com/t/gpt-image-1-transparent-backgrounds-with-edit-request/1240577
- Apiyi — GPT-Image-2 transparent background tests : https://help.apiyi.com/en/gpt-image-2-transparent-background-not-supported-en.html
- Wikipedia — GPT Image (dates, tailles) : https://en.wikipedia.org/wiki/GPT_Image
- SpriteCook — Slice sprite sheets and animations (modes, smart alpha) : https://www.spritecook.ai/blog/slice-sprite-sheets-and-animations
- Qwen-Image-Edit-2509 : https://huggingface.co/Qwen/Qwen-Image-Edit-2509 ; 2511 : https://huggingface.co/Qwen/Qwen-Image-Edit-2511
- FLUX.1 Kontext dev (licence NC) : https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev ; papier : https://arxiv.org/abs/2506.15742
- ICEdit : https://github.com/River-Zhang/ICEdit ; papier : https://arxiv.org/abs/2504.20690
- In-Context LoRA : https://github.com/ali-vilab/In-Context-LoRA ; page : https://ali-vilab.github.io/In-Context-LoRA-Page/ ; papier : https://arxiv.org/abs/2410.23775
- PersonalView (multi-vue in-context) : https://arxiv.org/html/2511.00293v1
- Sprite Sheet Diffusion : https://arxiv.org/abs/2412.03685 ; https://chenganhsieh.github.io/spritesheet-diffusion/
- RunComfy — Flux Kontext LoRA multi-view turnaround : https://www.runcomfy.com/comfyui-workflows/flux-kontext-lora-multi-view-turnaround-sheet
- Scenario — Generate character turnarounds : https://help.scenario.com/articles/1419523552-generate-character-turnarounds
- aldegad/sprite-gen (Apache-2.0) : https://github.com/aldegad/sprite-gen (SKILL.md, scripts/extract_sprite_row_frames.py)
- mirsella/spritesheet_detector (MIT, Rust) : https://github.com/mirsella/spritesheet_detector
- Godot — texture_region_editor_plugin.cpp (Auto Slice) : https://github.com/godotengine/godot/blob/4.3/editor/plugins/texture_region_editor_plugin.cpp
- Pixelorama (MIT) : https://github.com/Orama-Interactive/Pixelorama ; manuel import : https://pixelorama.org/user_manual/Import/
- Aseprite (EULA) : https://github.com/aseprite/aseprite ; ImportSpriteSheet API : https://aseprite.org/api/command/ImportSpriteSheet ; PR colonnes/lignes : https://github.com/aseprite/aseprite/pull/4772
- LibreSprite (GPL-2.0) : https://github.com/LibreSprite/LibreSprite
- Unity — Automatic slicing (référence) : https://docs.unity3d.com/6000.2/Documentation/Manual/sprite/sprite-editor/automatic-slicing.html
- TexturePacker — Sprite sheet cutter (référence) : https://www.codeandweb.com/texturepacker/documentation/sprite-sheet-cutter
- Godot proposal #7719 (auto-split) : https://github.com/godotengine/godot-proposals/issues/7719
- tcgm/slicesheet (MIT) : https://github.com/tcgm/slicesheet ; ttloi2404/Image-Slicer (sans licence) : https://github.com/ttloi2404/Image-Slicer ; parkm/sprite-sheet-slicer : https://github.com/parkm/sprite-sheet-slicer
- Leshy SpriteSheet Tool (freeware) : https://www.leshylabs.com/apps/sstool/
- OpenCV — Extract horizontal and vertical lines by morphology : https://docs.opencv.org/4.x/dd/dd7/tutorial_morph_lines_detection.html
- SAM 2 (Apache-2.0) : https://github.com/facebookresearch/sam2 ; automatic_mask_generator.py : https://github.com/facebookresearch/sam2/blob/main/sam2/automatic_mask_generator.py
- MobileSAM (Apache-2.0) : https://github.com/ChaoningZhang/MobileSAM
- rembg (MIT) : https://github.com/danielgatis/rembg
- OWLv2 (Apache-2.0) : https://huggingface.co/google/owlv2-base-patch16-ensemble
- Grounding DINO (Apache-2.0) : https://github.com/IDEA-Research/GroundingDINO
- YOLO-World (GPL-3.0) : https://github.com/AILab-CVC/YOLO-World ; Ultralytics YOLO-World (AGPL-3.0) : https://docs.ultralytics.com/models/yolo-world/
- Florence-2 (MIT) : https://huggingface.co/microsoft/Florence-2-large
- Qwen2.5-VL-7B-Instruct (Apache-2.0) : https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct
- DINOv2-small (Apache-2.0) : https://huggingface.co/facebook/dinov2-small
- ImageHash (BSD-2) : https://pypi.org/project/ImageHash/
- rectpack (Apache-2.0) : https://github.com/secnot/rectpack ; https://pypi.org/project/rectpack/
- PyTexturePacker (MIT) : https://pypi.org/project/PyTexturePacker/
- free-tex-packer-core (MIT) : https://github.com/odrick/free-tex-packer-core ; app : https://github.com/odrick/free-tex-packer
- maxrects-packer (MIT) : https://github.com/soimy/maxrects-packer
- libGDX TexturePacker (Apache-2.0) : https://libgdx.com/wiki/tools/texture-packer
- crunch (MIT) : https://github.com/ChevyRay/crunch
- spritesheet.js : https://github.com/krzysztof-o/spritesheet.js
