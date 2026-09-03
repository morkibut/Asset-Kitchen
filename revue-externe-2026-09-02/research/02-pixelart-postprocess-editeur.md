# 02 — Post-traitement pixel art d'images IA et édition manuelle (« La Main »)

> Recherche technique, septembre 2026. Contexte : application open-source-first de création d'assets 2D (pixel art en priorité), backend Python 3.11 / FastAPI / Pillow / NumPy, front React 19 + TS + Vite + Tailwind. Cible : GPU 8 Go typique, mais fonctionnement CPU seul obligatoire. Philosophie : briques spécialisées assemblées (IA génère → algos nettoient/quantifient → outil manuel).
>
> Toutes les licences, étoiles et dates ci-dessous ont été vérifiées sur GitHub / PyPI / sites officiels au moment de la rédaction (sauf mention « à vérifier »). Les outils propriétaires sont marqués **[PROPRIÉTAIRE]** et ne servent que de référence.

---

## 1. Les problèmes / verrous à résoudre

Les modèles d'image (SDXL, Flux, GPT-Image, Gemini/Nano Banana…) ne peignent pas sur une vraie grille de pixels. Ils produisent du **« faux pixel art »** : des blocs mous de taille variable (que SpriteCook appelle des *« mixels »*), de l'anti-aliasing, des milliers de couleurs, une grille qui dérive de quelques pixels d'un bord à l'autre. Transformer cela en asset exploitable dans un moteur de jeu demande de résoudre, dans l'ordre :

1. **Détecter la grille réelle** (taille de cellule *s*, éventuellement différente en X et Y, et décalage/phase *(ox, oy)*) d'une image qui n'est pas un simple upscale nearest-neighbor. Piège classique : l'ambiguïté d'octave (2s ou s/2 obtiennent presque le même score).
2. **Réduire chaque cellule à UN pixel** sans diluer les contours d'un pixel de large ni les motifs de dithering (le downscale bilinéaire/area est exactement ce qu'il ne faut pas faire).
3. **Pixeliser une image « détaillée »** (mode HD → pixel art) en gardant les traits fins : c'est un problème différent du n°2 (l'image source n'a pas de grille latente).
4. **Quantifier les couleurs** à N couleurs, puis **mapper vers une palette imposée** (celle du projet, une palette Lospec, une console rétro) de façon perceptuelle (OKLab plutôt que RGB), avec ou sans dithering « pixel-art friendly ».
5. **Nettoyer** : pixels orphelins, escaliers doubles (« jaggies »), anti-aliasing résiduel, contours brisés ; **ajouter/retirer un contour** (outline, selective outline).
6. **Prévisualiser et exporter** : agrandissement nearest-neighbor pour l'export, filtres de type hqx/xBRZ pour la prévisualisation « smooth », upscale IA pour le mode « detailed ».
7. **Vectoriser** (SVG) : besoin secondaire (icônes UI, logos), avec la spécificité pixel art de Kopf-Lischinski.
8. **Éditer à la main** dans le navigateur : crayon pixel-perfect, remplissage, sélection, pipette, calques, palette indexée, symétrie, pelure d'oignon, timeline d'animation.
9. **Retoucher localement** une zone (inpainting) sans relancer toute la génération, en respectant la grille et la palette déjà fixées.
10. **Éclairage 2D** (normal maps) en bonus.
11. **Formats** : PNG (+ métadonnées), sidecar JSON, `.aseprite` en lecture/écriture.

---

## 2. Solutions par problème

Légende des colonnes : *Type* = lib / app / algo / papier ; *Maturité* = dernière activité connue + étoiles ; *Complexité d'intégration* : 1 (pip install) → 5 (réécriture) ; *VRAM/CPU* : besoin matériel.

### 2.1 Détection de la grille / de l'échelle réelle

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Intégr. | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **unfake.js** (jenissimo) | github.com/jenissimo/unfake.js | MIT (mais cœur WASM lié à **libimagequant GPLv3** — voir §2.4) | JS + Rust/WASM | lib + app web | v1.2.0 juin 2026, 796★ | CPU, navigateur | 2 (front) | Détection *runs-based* + *edge-aware* (Sobel → profils lignes/colonnes → histogramme des distances entre pics → recherche de phase). Robuste sur les sorties SD/GPT ; échoue sur images « trop peintes ». | Article de référence : dev.to « How to tame your AI pixel art » (juil. 2025). Options : `detectMethod`, `downscaleMethod`, `snapGrid`, `cleanup{morph,jaggy}`. |
| **unfake.py** (painebenjamin) | github.com/painebenjamin/unfake.py | MIT | Python + Rust | lib/CLI | 59★, PyPI `unfake` | CPU ; 1024² en ~0,7 s (Rust) vs 71 s (Python pur) | 1–2 | Port fidèle d'unfake.js : runs + edge-aware, mode auto (runs puis fallback edge), quantification **Wu (1992)** (pas de GPL), morphologie, jaggy, alpha binaire, fond transparent par flood-fill. | Le candidat le plus direct pour un backend FastAPI. Nécessite toolchain Rust au build (ou wheel). |
| **pixel-art-fixer** (Retro Diffusion / Astropulse) | github.com/Retro-Diffusion/pixel-art-fixer | MIT | Python + Rust | lib/CLI/API | 20★, récent (2026) | CPU, < 1 s par image (Rust 11–24× plus rapide que le Python), max 4 Mpx | 2 | **Le plus sophistiqué** : 3 détecteurs (autocorrélation « comb-minus-anti-comb », run-lengths avec soft-GCD, auto-similarité avec t-stat), arbitrage (Welch spectral, cohérence de phase Rayleigh, variance intra-cellule, **« octave arbiter »** par aller-retour box-downscale). Gère cellules **non entières**, dérive sub-pixel, grilles déformées. Benchmark 4 300 images : 77 % résolution exacte, 84 % à ±1 px, 94 % grille alignée, ΔE≈1,6. | Reconstruction en 2 étapes : vote sur labels k-means (16–48 couleurs) pour la *structure*, puis couleur = moyenne des pixels originaux du label gagnant. API `detect()` / `reconstruct()` / `process()`. |
| **perfectPixel** (theamusing) | github.com/theamusing/perfectPixel | MIT | Python | lib + node ComfyUI + démo web | 1,7k★, 2025-2026 | CPU (OpenCV ou variante NumPy pur) | 1 | Détection par **magnitude FFT** → grille initiale ; **raffinement des lignes de grille sur les arêtes Sobel** (grille **non uniforme**, cellules non carrées) ; échantillonnage `center/median/majority`. Params : `refine_intensity` (0–0,5), `fix_square`, `peak_width`. | Idée précieuse : autoriser une grille irrégulière plutôt que forcer un pas constant. |
| **spritefusion-pixel-snapper** | github.com/Hugo-Dz/spritefusion-pixel-snapper | MIT | Rust 100 % → WASM | lib/CLI/WASM | 2,1k★, 2026 | CPU, navigateur | 2 (WASM `process_image(bytes, kColors?, pixelSize?)`) | Auto-détection + override ; quantification k couleurs ; conserve les motifs de dithering. Algorithme non documenté (source à lire). Version desktop payante = même code. | Excellent candidat pour la **prévisualisation instantanée côté React** (pas de round-trip serveur). Pas de package npm : build `wasm-pack`. |
| **pixeldetector** (Astropulse) | github.com/Astropulse/pixeldetector | MIT | Python (Pillow/NumPy/SciPy) | script | 348★, 4 commits, dormant | CPU | 1 | Différences entre pixels adjacents → `find_peaks` → **médiane des espacements** = taille de pixel. Downscale **k-centroid** (k-means par tuile, couleur la plus fréquente). Palette par méthode du coude. Fragile (pas de gestion de phase ni d'octave). | Historique : c'est la source de la plupart des nœuds ComfyUI (dimtoneff/ComfyUI-PixelArt-Detector, MIT, 398★, avec loader de palettes Lospec). |
| **PixelRefiner** (HappyOnigiri) | github.com/HappyOnigiri/PixelRefiner | MIT | TypeScript (app web, Web Workers) | app | v0.11.1 juil. 2026, 25★ | navigateur | 3 (app, pas lib) | Détection multi-candidats (Auto/Hint/Force/Off), suppression d'anti-aliasing, k-means **OKLab**, Floyd-Steinberg + ordered, presets NES/GB/SNES, génération de contour, batch, export jusqu'à 32×. | À lire pour l'UX (mode « hint ») et l'implémentation OKLab côté TS. |
| **pixel-scale** (duniul) | github.com/duniul/pixel-scale | ISC | TypeScript, npm | lib | v3.0.0 mai 2026, 23★ | trivial | 1 | Diviseurs communs du PGCD (w,h) testés par uniformité de blocs (tolérance `maxColorDiff`). **Ne marche que sur des upscales nearest-neighbor propres.** | Utile comme « fast path » avant les détecteurs lourds. |
| Papier « Structure-Aware Pixel Art Scaling via Block Size Detection » (Jung et al., Applied Sciences 16(5):2314, fév. 2026) | mdpi.com/2076-3417/16/5/2314 | CC-BY (article) ; code non annoncé | — | papier | 2026 | — | 4 (à ré-implémenter) | Même principe (recherche de diviseurs + condition d'uniformité) formalisé, avec métriques CL/BSC/REV ; suppose une grille strictement uniforme. | Confirme que la voie « diviseurs » ne couvre que le cas propre. |
| **Pixel Grid Detector** (SpriteCook) **[PROPRIÉTAIRE]** | spritecook.ai/pixel-grid-detector | fermé (aucun dépôt trouvé) | — | app web gratuite | 2026 | navigateur | — | Détection + snapping + « cap the colors » + export PNG. Fonctionnellement équivalent à unfake.js/Pixel Snapper. | Référence UX uniquement. |
| **Sprite Fusion Pixel Snapper (web)** | spritefusion.com/pixel-snapper | même code MIT | — | app | 2026 | — | — | Référence UX (import de palette 1–256 couleurs). | Voir ligne spritefusion-pixel-snapper. |

**Comparaison et recommandation.** Trois familles d'algorithmes coexistent : (a) *diviseurs + uniformité* (pixel-scale, papier MDPI) — infaillible sur un upscale propre, inutile sur du « fake » ; (b) *profils d'arêtes* (Sobel/gradient → histogramme des distances entre pics ou autocorrélation → phase) — unfake.js, pixeldetector, perfectPixel (variante FFT) ; (c) *ensemble + arbitrage* — pixel-art-fixer, le seul qui traite explicitement l'octave, les pas non entiers et la dérive, avec un benchmark public. Recommandation : **ré-implémenter un détecteur « ensemble » en NumPy/SciPy** (runs-based + autocorrélation de profils Sobel + FFT, vote, arbitre d'octave par round-trip) en s'inspirant directement de pixel-art-fixer (MIT) et de perfectPixel (raffinement de grille non uniforme), **et** livrer côté navigateur le WASM de spritefusion-pixel-snapper (ou unfake-core) pour l'aperçu instantané. Toujours renvoyer `scale_x, scale_y, offset_x, offset_y, confidence, candidates[]` et laisser l'utilisateur corriger via un overlay de grille (le mode « hint » de PixelRefiner).

### 2.2 Pixelisation / downscale intelligent

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Intégr. | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **PixelOE** (KohakuBlueleaf) | github.com/KohakuBlueleaf/PixelOE | **Apache-2.0** (vérifié) | Python ; API Torch (GPU) + API legacy NumPy/OpenCV (CPU) | lib + CLI + ComfyUI + Gradio, PyPI `pixeloe` | 454★, actif 2024-2026 | GPU optionnel : 180 img/s sur RTX 4090 ; CPU OK via API NumPy | 1 | Deux étapes : **expansion de contours contrast-aware** (carte de poids par médiane locale de luminance → dilatation/érosion sélectives → closing/opening) puis **downsampling par contraste** en LAB (choix adaptatif du pixel représentatif dans le patch : médiane/moyenne/min/max) ; modes `center/contrast/k-centroid/bicubic/nearest` ; k-means palette. « No AI/NN required ». Le README montre qu'il améliore même la sortie du modèle MYOS. | **Brique n°1 pour le mode « image détaillée → pixel art »**. Paramètres : `patch_size`, `thickness`, `target_size`, `colors`. |
| **Make Your Own Sprites** (MYOS, Wu et al., SIGGRAPH Asia 2022) | github.com/WuZongWei6/Pixelization | **Non commerciale** (« Software Copyright License for non-commercial scientific research purposes ») | Python/PyTorch | modèle | 425★ | GPU CUDA requis, poids Google Drive (VGG-19 + AliasNet + I2PNet/P2INet) | 3 | Pixelisation « aliasing-aware », taille de cellule contrôlable 2…N. Qualité de référence académique. | **Exclu** pour un produit commercial ; utilisable seulement comme baseline de comparaison. |
| **k-centroid** (Astropulse) | code dans pixeldetector.py (MIT) ; extension Aseprite payante (gumroad/itch) | MIT (script) | Python | algo | — | CPU | 1 | Pour chaque cellule : k-means à k centroïdes (via `Image.quantize(kmeans=k)`) puis couleur la plus fréquente. Préserve mieux les contours qu'une moyenne ; lent en Python pur (un quantize par tuile). | Ré-implémenter vectorisé (voir §5). |
| **pixelization** (AlexandreBinninger) | github.com/AlexandreBinninger/pixelization | MIT | Rust | lib/CLI | 1★, 22 commits | CPU (BLAS) | 3 | k-means + **Pixelated Image Abstraction** (Gerstner et al. 2012 : superpixels SLIC + filtre bilatéral, optimisation conjointe palette/segmentation). | Implémentation moderne d'un algo classique ; style « posterisé » très pixel-art pour les illustrations. |
| **Adaptive downscaling** (hiive/pixel_scale) | github.com/hiive/pixel_scale + article hiivelabs.com (jan. 2025) | non précisée (⚠) | Python (Streamlit) | script | 1★ | CPU | 3 | Downscale lisse (Lanczos) + **vote couleur majoritaire par bloc** + masque d'arêtes → remplacement conditionnel. | Idée réutilisable ; ne pas copier le code sans licence. |
| Méthodes « par cellule » d'unfake / pixel-art-fixer | voir §2.1 | MIT | — | algo | — | CPU | 1 | `dominant` (couleur dominante si > runner-up de 5 %, sinon moyenne), `median`, `mode`, `mean`, `content-adaptive`, **`qvote`** (quantifier d'abord, voter ensuite), vote pondéré au centre (triangulaire). | `qvote` + pondération centrale = meilleur compromis contours/dégradés. |

**Recommandation.** Deux chemins distincts : (1) *fake pixel art* → détection de grille (§2.1) puis **vote quantifié pondéré au centre** par cellule (structure) + recoloration depuis les pixels originaux (couleur) ; (2) *image détaillée* → **PixelOE** (mode `contrast`, `thickness` 1–2) qui remplace avantageusement tout modèle neuronal, tourne sur CPU, et sort déjà une image sur grille exacte. Dans les deux cas l'alpha est binarisé par vote majoritaire par cellule.

### 2.3 Quantification des couleurs, mapping vers une palette, dithering

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Intégr. | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Pillow `Image.quantize`** | pillow.readthedocs.io | MIT-CMU (HPND) | C/Python | lib | Pillow 12.x (2026) | CPU | 1 | Méthodes `MEDIANCUT`, `MAXCOVERAGE`, `FASTOCTREE` (**seule méthode acceptant RGBA**), `LIBIMAGEQUANT` (nécessite une compilation custom de Pillow, GPL) ; `kmeans=n` affine ; `palette=` mappe vers une palette imposée (image « P ») ; `dither=FLOYDSTEINBERG|NONE` ; `remap_palette`. Distance RGB uniquement. | Suffisant pour un premier jet et pour le mapping « P » ; pas de distance perceptuelle. |
| **libimagequant** (pngquant) | github.com/ImageOptim/libimagequant | **GPLv3+ ou licence commerciale payante** | Rust (v4), C-ABI, WASM | lib | 928★, très actif | CPU | 2 | Meilleure qualité perceptuelle du marché, remap vers palette fixe, dithering, alpha. Bindings Python `imagequant` (wanadev) et `libimagequant` (RoadrunnerWMC) : **GPL contamine le backend**. | À éviter sauf si le backend est lui-même AGPL/GPL. Note : unfake.js l'embarque dans son WASM — vérifier avant de réutiliser ce WASM en produit propriétaire. |
| **Wu quantizer** (1992) | implémenté dans unfake.py (MIT) et image-q (MIT) | MIT (implémentations) | Python/Rust, TS | algo | — | CPU | 1 | Subdivision variance-minimale de l'espace RGB ; qualité proche de median-cut++ ; rapide. | Alternative libre à libimagequant. |
| **hitherdither** (hbldh) | github.com/hbldh/hitherdither | MIT | Python pur (Pillow) | lib | 259★, 35 commits, CI active | CPU (lent : Python pur) | 1 | Error diffusion (Floyd-Steinberg, JJN, Stucki, Burkes, Sierra, Stevenson-Arce, Atkinson), **ordered Bayer**, cluster-dot, **Yliluoma algo 1** ; classe `Palette` (median cut) ; palettes arbitraires. | Bonne référence pédagogique ; à vectoriser en NumPy pour la prod. |
| **Yliluoma's ordered dithering** (article bisqwit) | bisqwit.iki.fi/story/howto/dither/jy/ | article (code C++ sans licence explicite ⚠) | — | algo | 2011, référence absolue | CPU | 3 | Ordered dithering pour **palette arbitraire**, gamma-correct, algos 1/2/3 (plans de mélange 2–4 couleurs), pénalité de luminance CCIR 601. Idéal pixel art : pas de diffusion (stable en animation, motifs réguliers). | À ré-implémenter (algorithme public, ne pas copier le code). |
| **image-q** (ibezkrovnyi) | github.com/ibezkrovnyi/image-quantization | MIT | TypeScript, npm `image-q` | lib | 167★, v3.0.4 (sept. 2021, dormant) | navigateur | 1 | NeuQuant, RGBQuant, **WuQuant** ; FS/Stucki/Atkinson/Jarvis/Burkes/Sierra/Riemersma ; distances Euclid, Manhattan, **CIEDE2000**, CIE94, CMetric, PNGQuant. | Brique côté front pour l'aperçu palette sans serveur. |
| **ColorAide** (facelessuser) | github.com/facelessuser/coloraide | MIT | Python pur | lib | v8.8.1 mars 2026, 344★, 2 275 commits | CPU | 1 | OKLab/OKLCH/Oklrab, CAM16, ΔE (2000, OK, CMC…), gamut mapping, interpolation, CVD. **Objet par couleur → trop lent par pixel** ; parfait pour la *logique de palette* (ramps, harmonisation, tri). | Pour les pixels : matrices OKLab en NumPy (formules publiques de Björn Ottosson, ~15 lignes). |
| scikit-image / OpenCV / colour-science | — | BSD-3 / Apache-2.0 / BSD-3 | Python | libs | actifs | CPU | 1 | `rgb2lab`, k-means (`cv2.kmeans` très rapide), SLIC, morphologie, Sobel/Canny. | Socle NumPy standard. |
| **Lospec Palettes API** | lospec.com/palettes/api | palettes soumises par la communauté (⚠ vérifier les conditions d'usage) | JSON/CSV | API | stable | — | 1 | `GET https://lospec.com/palette-list/{slug}.json` → `{name, author, colors[]}` ; 404 `{error:"file not found"}` ; pas d'auth, pas de limite documentée. Pas d'endpoint de recherche. | Mettre en cache ; proposer aussi l'import `.hex/.gpl/.pal/.ase`. |
| **Mapping de palettes en ramps** (eastfarthing.com 2016) | eastfarthing.com/blog/2016-05-27-mapping/ | article | — | algo | — | CPU | 2 | Graphe orienté : arête de chaque couleur vers les couleurs **plus claires (L de Lab)** et à distance **ΔE2000 < seuil** ; seuil = poids de l'arête la plus lourde de l'arbre couvrant minimal ; le DAG révèle les ramps automatiquement. | Base pour « extraire les ramps d'un asset » et pour le recolor par ramp. |
| Thèse TU Delft « Automating Color Ramp Detection and Modification to Enhance Pixel Art » | resolver.tudelft.nl/uuid:259633b8-… | académique (site inaccessible au fetch) | — | papier | — | — | — | Piste à lire pour un module « ramp detection ». | Non vérifié en détail. |
| KPal (krush62) / rampensau (meodai) / color-ramps (depuschm) | github.com/krush62/KPal ; github.com/meodai/rampensau | GPLv3 (KPal, C#/WPF) ; à vérifier (rampensau, JS) | C#, JS | outils | KPal 9★ | — | 4 | Génération de ramps par hue-shifting (HSV/OKLCH), export Aseprite/GPL/ASE. | Références d'UX pour un générateur de ramps intégré. |

**Recommandation.** Pipeline couleur 100 % NumPy : conversion sRGB → OKLab vectorisée ; **k-means en OKLab** (`cv2.kmeans` ou scikit-learn MiniBatch) pondéré par l'alpha, ou Wu si on veut du déterministe ; **fusion des couleurs proches** (ΔE_OK < ~0,02–0,04) ; **mapping vers palette imposée par plus-proche voisin OKLab** (table de correspondance 3D précalculée, ou KD-tree scipy) ; dithering **ordered uniquement** (Bayer 4×4/8×8, blue-noise 64×64 précalculée), appliqué **seulement dans les zones de gradient** (masque = variance locale) et jamais sur les contours ; Floyd-Steinberg proposé mais désactivé par défaut (bruit sale en pixel art). Éviter libimagequant sauf backend GPL.

### 2.4 Contours, anti-aliasing, nettoyage de lignes

| Nom | URL | Licence | Langage | Type | Maturité | Intégr. | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| Cleanup d'unfake.js / unfake.py | §2.1 | MIT | JS/Py | algo | 2026 | 1 | `morph` (fermeture de trous, retrait du bruit), `jaggy` (retrait des escaliers doubles), alpha binaire, blur léger *post*-quantification. | Bon point de départ. |
| PixelRefiner (AA removal, outline generation) | §2.1 | MIT | TS | app | 2026 | 3 | Suppression d'anti-aliasing (repasse les pixels intermédiaires vers une des deux couleurs adjacentes), génération d'outline. | Code TS lisible. |
| « Pixel Art Algorithm: Selective Anti-Aliasing » (Ricky Han, 2019) | rickyhan.com/…/pixel-art-algorithm-selective-outlining-anti-aliasing.html | article | — | algo | — | 3 | Découpe une ligne pixel-perfect en segments de 1 px de large, calcule longueur/direction, recolore une fraction de chaque segment avec la couleur intermédiaire. Extensible multi-couleurs. | Même auteur : série d'articles sur les lignes pixel-perfect (éditeur xprite). |
| EpoctiAA (kokoscript) | github.com/kokoscript/EpoctiAA | non vérifiée ⚠ | — | script | petit | 3 | AA simple pour pixel art. | Référence secondaire. |
| Crayon « pixel-perfect » (Aseprite/Lospec) | algo public | — | — | algo | — | 2 | Bresenham + suppression des « coins en L » (si p[i-1] et p[i+1] sont 4-voisins de p[i], on supprime p[i]). | Trivial à écrire, indispensable dans l'éditeur. |
| Auto-outline | scipy.ndimage | BSD | Python | algo | — | 1 | `binary_dilation(alpha, struct 4- ou 8-conn) & ~alpha` → pixels de contour ; selective outline = teinte du contour selon la normale au bord et une direction de lumière. | Développement maison (§5). |

**Recommandation.** Tout ce bloc est petit et se code en NumPy sur la **carte d'index** (pas sur les RGB) : orphelins (composante connexe de taille 1 dont les 4 voisins ont la même couleur → remplacer), jaggies (motif 2×2 en damier sur un contour → aligner), AA (pixel dont la couleur est entre celles de deux voisins opposés en OKLab → snap au plus proche), outline (dilatation). Prévoir un « mode conservateur » qui ne touche pas les pixels appartenant à un motif de dithering détecté (damier régulier ≥ 3×3).

### 2.5 Upscale (prévisualisation / export)

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Intégr. | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Nearest-neighbor (Pillow `NEAREST`, CSS `image-rendering: pixelated`) | — | — | — | — | — | — | 1 | **Le seul upscale correct pour l'export pixel art.** | Toujours par facteur entier. |
| **hqx** (hq2x/3x/4x) | github.com/grom358/hqx | **LGPL-2.1** | C (bindings via ctypes possibles) | lib | 96★ | CPU | 3 | Lookup tables 256 motifs ; lisse toute diagonale. LGPL = OK en liaison dynamique. | Pour l'aperçu « smooth » ; pas pour l'export. |
| **xBRZ** (Zenju) | sourceforge xbrz ; binding github.com/ioistired/xbrz.py | **GPLv3** (xBRZ) ; **AGPLv3** (xbrz.py, PyPI, 10★, jusqu'à 6×) | C++ / Python | lib | actif | CPU | 3 | Meilleure qualité de la famille xBR. **Licence virale** : à isoler dans un micro-service GPL ou à éviter. | Référence de qualité. |
| Scale2x/3x/SFX — **ScaleNx** (Dnyarri) | github.com/Dnyarri/PixelArtScaling, PyPI `ScaleNx` | **Unlicense** | Python pur | lib | 178 commits, 6★ | CPU (lent, listes Python) | 1 | Scale2x, Scale3x, Scale2xSFX, Scale3xSFX. Réécriture NumPy triviale (algo public 1992/2001). | Meilleur rapport qualité/licence pour l'aperçu. |
| **pixelscalers** (janert) | github.com/janert/pixelscalers | MIT-style | C | CLI | 32★, 7 commits | CPU | 3 | Bloc, Scale2x/3x + SFX, hqx (variantes A/B), Super xBR 2×. | Base C compacte pour un module natif. |
| py-super-xbr (n0spaces) | github.com/n0spaces/py-super-xbr | à vérifier | Python | lib | petit | CPU | 2 | Super-xBR (Hyllian, 2015) porté en Python. | Alternative à xBRZ si licence OK. |
| ScaleFX (Sp00kyFox) | shaders RetroArch (slang/glsl) | GPL (shaders libretro) | GLSL | shader | actif | GPU navigateur | 4 | Qualité ≥ Scale3x ; existe uniquement en shader. Peut tourner dans un WebGL/PixiJS de l'éditeur pour la prévisualisation. | Vérifier licence exacte du fichier de shader avant intégration. |
| **Real-ESRGAN** | github.com/xinntao/Real-ESRGAN | **BSD-3-Clause** (code ; poids publiés par les mêmes auteurs) | PyTorch ; binaires **ncnn-Vulkan** sans CUDA | modèle | 36,5k★ | GPU 2–4 Go avec `tile` ; CPU possible (lent) ; ncnn-vulkan tourne sur GPU Intel/AMD/NVIDIA | 2 | Modèles `x4plus`, `x4plus_anime_6B`, `realesr-general-x4v3` (tiny, denoise réglable), `x2plus` ; alpha 16 bits OK. **Interdit pour du pixel art** (crée des faux détails) ; réservé au mode « detailed ». | Le portable ncnn-vulkan est idéal pour les petits GPU. |

**Recommandation.** Export = nearest ×N. Aperçu « smooth » = Scale2x/3x réécrit en NumPy (ou hqx LGPL en dynamique). Réserver xBRZ (GPL) à un service optionnel. Real-ESRGAN (BSD-3, ncnn-vulkan) uniquement pour agrandir des assets « detailed ».

### 2.6 Vectorisation

| Nom | URL | Licence | Langage | Type | Maturité | Intégr. | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **VTracer** (visioncortex) | github.com/visioncortex/vtracer | MIT | Rust ; PyPI `vtracer` ; npm WASM `@visioncortex/vtracer` | lib | 6,6k★, actif | 1 | Couleur (clustering, watershed), N&B, ajustement de courbes (pixel/polygone/spline). Gère bien le pixel art (rendu « pixelated »). | Choix par défaut, front et back. |
| potrace / pypotrace | potrace.sourceforge.net | **GPL-2.0+** | C / Python | lib | v1.16 (2019) | 2 | N&B uniquement ; excellent pour silhouettes ; GPL. | Éviter si VTracer suffit. |
| ImageTracer.js | github.com/jankovicsandras/imagetracerjs | **Unlicense** | JS | lib | 1,5k★, v1.2.6 | 1 | Vectorisation couleur simple, options `ltres/qtres`. Utilisé par unfake.js. | Alternative navigateur ultra-légère. |
| Kopf-Lischinski « Depixelizing Pixel Art » (2011) | rjalfa/depixelize (C++, 37★, pipeline complet, licence non affichée) ; TableauBits/DePyxelizer (Python, 8★, partiel, projet étudiant) ; **libdepixelize dans Inkscape** (GPL-2+, mode « Trace pixel art », non re-vérifié ici) | variable | C++/Python | algo | anciens | 4–5 | Graphe de similarité → heuristiques de croisement → Voronoï → B-splines optimisées. Rendu « vectoriel lisse » spécifique pixel art. | Fonction bonus ; passer par Inkscape en CLI ou ré-implémenter le graphe de similarité + Voronoï sans l'optimisation de splines. |

### 2.7 Éditeurs pixel art embarquables (« La Main »)

| Nom | URL | Licence | Langage | Type | Maturité | Intégr. React | Fonctions | Notes |
|---|---|---|---|---|---|---|---|---|
| **Piskel** | github.com/piskelapp/piskel ; piskel-embed | Apache-2.0 | JS (65 %) + TS | app | 12,6k★ ; **dernière release 0.15.0 (nov. 2018)** ; n'accepte que « small fixes » | 3 (iframe via piskel-embed, `postMessage` maison) | Calques, frames, onion skin, palette, symétrie ? (non), export GIF/spritesheet. | Dormant mais fonctionnel ; pas de pixel-perfect line moderne ; code legacy sans modules. |
| **LibreSprite** | github.com/LibreSprite/LibreSprite | **GPL-2.0** | C++ (fork Aseprite 2016) | app desktop | 8,3k★, actif | 4–5 (dossier `emscripten/` présent ; build web expérimental, à valider) | Tout Aseprite v1.1 : calques, timeline, onion skin, palettes, tiled mode, pixel-perfect, `.ase`. | GPL + WASM lourd ; UI non intégrable dans React (canvas plein écran). |
| **Pixelorama** | github.com/Orama-Interactive/Pixelorama | **MIT** | GDScript (Godot 4.6.3) | app desktop + **web** (orama-interactive.github.io/Pixelorama, itch) | 9,7k★ ; v1.1.10 avr. 2026 | 3–4 (iframe du build web Godot ; exige en-têtes **COOP/COEP** pour SharedArrayBuffer ; pont JS via `JavaScriptBridge` à écrire) | Calques + clipping masks, effets non destructifs (outline, gradient map, drop shadow), timeline, onion skin, tags, tilemaps rect/iso/hex, palettes, CLI d'export, extensions. Import `.aseprite` : à vérifier. | **Le plus complet et le plus vivant** ; mais ~30 Mo de WASM et UX Godot « dans une boîte ». |
| Lospec Pixel Editor | github.com/lospec/pixel-editor | GPL-3.0 | JS | app | 1,1k★, **déprécié** | — | Calques, palette, sélection. | Ne pas utiliser. |
| **Klecks** (Kleki) | github.com/bitbof/klecks | MIT | TypeScript | app + **mode embed** (`examples/embed`) | 361★, actif 2026 | 2–3 | Calques, brosses (dont « pixel »), pot de peinture, sélection, filtres WebGL. **Pas de palette indexée ni d'animation.** | Bon pour un mode « peinture HD », pas pour le pixel art. |
| miniPaint | github.com/viliusle/miniPaint | MIT | JS | app + iframe | 3,4k★, v4.14.3 avr. 2026 | 2 | Éditeur raster générique avec calques ; pas pixel-art. | Référence. |
| jspaint | github.com/1j01/jspaint | MIT | JS | app + iframe (`systemHooks`) | 7,8k★, v1.1.0 avr. 2026 | 2 | Grille, palettes (PAL/GPL/ACO/ASE), zoom, **pas de calques**, undo non linéaire. | Charme MS Paint ; pas d'animation. |
| **dotting** (hunkim98) | github.com/hunkim98/dotting | MIT | React component, npm | lib | 57★, 569 commits | 1 | Pen, eraser, fill, line, rect, ellipse, sélection, **calques**, grille, pan/zoom, tactile. Pas d'animation, pas de palette indexée. | Seul composant React « prêt » ; petit projet solo. |
| pixel-art-react (jvalen) | github.com/jvalen/pixel-art-react | MIT | React + Redux | app | 6,0k★, **en pause** (refactor) | 3 | Frames, palette, export GIF ; rendu CSS box-shadow (pas canvas). | Référence d'architecture Redux uniquement. |
| Petits éditeurs React/TS 2026 (OctoBit-Studio-Preview, tinysprite, PixelCraft, simplepixelart-Vue) | topic `pixel-art-editor` GitHub | MIT majoritairement | TS/JS | apps | 0–17★ | — | Variables. | Trop jeunes pour être des dépendances. |
| Libs canvas : **PixiJS**, Konva, Fabric.js | — | MIT | TS | libs | très actifs | 1 | PixiJS (WebGL/WebGPU) pour un zoom fluide de grands spritesheets + shaders d'aperçu (ScaleFX) ; Konva/Fabric orientés objets vectoriels, moins adaptés au pixel. | Pour un éditeur maison, Canvas 2D + `ImageData`/typed arrays suffit ; PixiJS si multi-calques lourds. |
| Aseprite **[SOURCE-AVAILABLE, EULA, non-OSI]** | github.com/aseprite/aseprite | EULA (modules laf/clip/undo en MIT) | C++ | app | 39,1k★ | — | Référence fonctionnelle absolue (pixel-perfect, tilemaps, scripts Lua). | Ne pas embarquer ; s'inspirer de l'UX et lire la **spec de fichier** publique. |

**Intégrer vs développer.** Intégrer un éditeur existant coûte peu au départ mais bloque ensuite : Piskel est figé depuis 2018, Pixelorama impose Godot-in-iframe (COOP/COEP, ~30 Mo, pont JS à écrire, UX non Tailwind), LibreSprite est GPL, dotting n'a ni animation ni palette indexée. **Recommandation : développer « La Main » en React/Canvas 2D maison** (modèle de données = calques d'`Uint8Array` d'index + palette, frames, tags ; rendu par `putImageData` à l'échelle 1 puis CSS `image-rendering: pixelated` ou PixiJS pour le zoom ; historique par patches de diff), avec un budget réaliste de 4–8 semaines pour le cœur (crayon pixel-perfect, gomme, pot 4/8-conn contigu/global, sélection rect/lasso/baguette, pipette, calques, palette + swap par index, symétrie H/V, onion skin, timeline simple). En attendant, **Pixelorama web en iframe** comme « mode expert » optionnel, et **dotting** comme accélérateur si l'on veut un MVP en une semaine.

### 2.8 Inpainting local ciblé et masque par clic

| Nom | URL | Licence | Type | Maturité | VRAM/CPU | Intégr. | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **IOPaint** (ex lama-cleaner) | github.com/Sanster/IOPaint | Apache-2.0 | serveur + UI + CLI batch | 23,4k★ ; **archivé le 13 août 2025** (lecture seule) | CPU/GPU/Apple ; LaMa tourne sur CPU | 2 (API HTTP) | LaMa, LDM, ZITS, MAT, FcF, Manga, SD inpaint, PowerPaint, BrushNet, AnyText ; plugins SAM, RemoveBG, RealESRGAN. | Encore parfaitement utilisable comme dépendance figée ; forker si besoin. |
| **LaMa** (advimman) | github.com/advimman/lama | Apache-2.0 | modèle | 10,1k★ | CPU OK (`device=cpu`), ~quelques centaines de Mo | 2 | Suppression d'objets/retouche structurelle, pas de génération sémantique. | Via `simple-lama-inpainting` (PyPI 0.1.2, juil. 2023, licence à vérifier) ou le code d'IOPaint. |
| SD 1.5/SDXL inpainting, FLUX Fill | — | CreativeML OpenRAIL-M (non-OSI, usage commercial autorisé avec restrictions) ; FLUX.1-Fill-dev **non commercial** | modèles | — | 4–8 Go VRAM | 3 | Génération sémantique dans un masque. | Domaine de l'agent « génération » ; à mentionner comme option « patch créatif ». |
| **SAM / SAM2 en navigateur** | github.com/lucasgelfond/webgpu-sam2 (179★, onnxruntime-web WebGPU, encodeurs > 100 Mo cachés en OPFS, décodeur ~20 Mo) ; Labelbox/sam2-web | SAM/SAM2 : Apache-2.0 ; webgpu-sam2 : licence non affichée ⚠ | démo | 2025 | WebGPU (Chrome) | 3 | Masque par clic de qualité ; **surdimensionné pour des sprites 64×64**. | Pour les sprites : baguette magique (flood-fill en OKLab tolérant) + composantes connexes suffisent ; SAM utile seulement sur les images « detailed ». |

**Recommandation.** Retouche locale = masque (brosse/baguette/rect ; SAM optionnel en mode detailed) → inpainting à la résolution de génération (LaMa pour « effacer/boucher », SD inpaint pour « remplacer par ») → **re-passage du pipeline pixel avec grille et palette verrouillées** → composition uniquement dans le masque (avec une marge d'une cellule). L'important est de **rejouer les mêmes paramètres** (`scale, offset, palette`) pour que le patch se fonde.

### 2.9 Normal maps / éclairage 2D (bonus)

| Nom | URL | Licence | Type | Maturité | Intégr. | Notes |
|---|---|---|---|---|---|---|
| **Laigter** (azagaya) | github.com/azagaya/laigter | GPL-3.0 | app Qt/C++ + **CLI batch** | 1,3k★ ; v1.13.1 déc. 2025 | 2 (appel CLI) | Normal, parallax, specular, occlusion, aperçu temps réel. GPL → appel en processus séparé, pas de linkage. |
| NormalMap-Online (cpetry) | github.com/cpetry/NormalMap-Online | MIT | app JS | 555★ | 2 | Normal map côté navigateur (Sobel sur hauteur). |
| SpriteIlluminator, Sprite DLight **[PROPRIÉTAIRES]** | — | — | — | — | — | Références UX (peinture de hauteur, lumières multiples). |
| Maison | numpy | — | algo | — | 1 | Hauteur = luminance ou distance au bord (`distance_transform_edt` sur l'alpha) → gradients Sobel → normal map ; suffisant pour 90 % des sprites. |

### 2.10 Formats de fichiers

| Nom | URL | Licence | Langage | Lecture/Écriture | Maturité | Notes |
|---|---|---|---|---|---|---|
| Spec `.ase/.aseprite` | github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md | doc publique | — | — | à jour | Chunks : header, frames, layers, cels (raw/zlib/linked), tags, palette, slices, user data, tilesets, color profile. Simple à écrire. |
| **asepriteio** (joeyspacerocks) | github.com/joeyspacerocks/asepriteio | Apache-2.0 | Python | **lecture + écriture** (layers, frames, tags, palette, cels) | 5★, 5 commits, pas de release PyPI | À vendorer et compléter (slices, user data, tilesets). |
| py_aseprite (Eiyeron) | github.com/Eiyeron/py_aseprite | MIT | Python | lecture seule (cels, palettes, layer tree ; linked cels non gérés) | 23★ | Référence de parsing. |
| **ase-parser** (TheCyberRonin) | github.com/TheCyberRonin/ase-parser, npm | MIT | JS + typings TS | lecture seule, **tous chunks** (tilesets, slices, profils) | 25★, v0.0.18 oct. 2023 | Pour l'import côté front. |
| @kayahr/aseprite | github.com/kayahr/aseprite | MIT | TS | typings/JSON schema du **JSON d'export** Aseprite | 2★ | Utile pour produire le format spritesheet JSON compris par Phaser/Godot/Unity. |
| PNG + chunks (Pillow `PngInfo`, `tEXt/iTXt/zTXt`) | — | — | Python | R/W | — | Stocker `grid, palette, provenance, prompt` dans le PNG lui-même ; Pillow lit/écrit sans dépendance. |
| Sidecar JSON | — | — | — | — | — | Format natif recommandé : `asset.png` (indexé) + `asset.json` (palette OKLab/hex, ramps, grille, frames/tags, slices, historique de pipeline). |

---

## 3. Idées malines / astuces trouvées

1. **Séparer structure et couleur** (pixel-art-fixer) : voter par cellule sur des *labels* k-means (16–48 couleurs) pour décider la forme, puis colorier chaque cellule avec la moyenne des pixels *originaux* portant le label gagnant. On obtient les lignes nettes d'un « snapper » sans sa perte de couleurs.
2. **Arbitre d'octave** : quand 2s et s/2 scorent presque pareil, choisir le pas qui minimise l'erreur de l'aller-retour « box-downscale puis nearest-upscale » (« distillability »). Résout le bug n°1 des détecteurs naïfs.
3. **Recherche de phase par somme de profil** (unfake) : pour chaque offset ∈ [0, s), score = Σ profil_arêtes[offset + k·s] ; garder le max. Simple, robuste, O(s·N).
4. **Grille non uniforme** (perfectPixel) : partir de la période FFT, puis **déplacer chaque ligne de grille vers le pic Sobel le plus proche** (`refine_intensity`). Absorbe la dérive des mixels sans supposer un pas constant.
5. **Quantifier avant de voter (`qvote`)** : sur un dégradé, la couleur dominante brute change à chaque cellule ; si l'on quantifie d'abord à 16–32 couleurs, le vote devient stable.
6. **Expansion de contours avant downscale** (PixelOE) : dilater/éroder sélectivement selon une carte de contraste local *avant* de réduire garantit que les traits d'un pixel de large survivent. Applicable aussi au chemin « fake pixel art » quand la grille est > 8 px.
7. **Diviseurs d'abord** : si (w, h) ont un grand diviseur commun *d* pour lequel tous les blocs d×d sont uniformes (tolérance ΔE), c'est un upscale nearest : détection en O(N), 100 % fiable (pixel-scale, papier MDPI 2026).
8. **Générer à un multiple exact** : demander au modèle 1024×1024 pour un sprite visé 64×64 (cellule = 16) et fournir le pas attendu comme *hint* au détecteur : on transforme un problème de détection en problème de validation.
9. **Dithering ordonné, jamais diffusé, et seulement sur les gradients** (Yliluoma) : un masque de variance locale décide où le dithering est autorisé ; les contours et aplats restent nets ; la matrice fixe évite le scintillement entre frames d'animation.
10. **Ramps automatiques par graphe ΔE** (eastfarthing) : arêtes vers les couleurs plus claires à ΔE2000 < seuil (seuil = arête max de l'arbre couvrant minimal) → le DAG donne les ramps ; permet un « recolor par ramp » (remplacer une ramp par une autre de la palette cible en préservant l'ordre de luminance) plutôt qu'un simple plus-proche-voisin qui casse les volumes.
11. **Mapping palette par ramp cohérente** : regrouper les pixels par teinte OKLCH, mapper chaque groupe sur *une seule* ramp cible ; évite qu'un dégradé de peau soit coupé entre deux ramps.
12. **Alpha par vote** : l'alpha de sortie est binaire et décidé par majorité dans la cellule (avec érosion optionnelle d'un pixel pour éliminer le halo).
13. **Pixel-perfect line = Bresenham + suppression des coins en L** : algorithme trivial mais différenciant pour l'éditeur (c'est ce qui fait « pro » Aseprite).
14. **Benchmark synthétique** : partir de vrais sprites (1×), les agrandir en nearest à des pas entiers et non entiers, ajouter blur gaussien, JPEG, décalage sub-pixel, bruit ; mesurer l'exactitude du pas et le ΔE de reconstruction (méthode « pixel-bench » de Retro Diffusion : 4 300 images). Indispensable pour itérer sur le détecteur.
15. **Deux implémentations, un algorithme** : Python/NumPy pour le batch serveur, Rust→WASM (Sprite Fusion ou unfake-core) dans le navigateur pour l'aperçu immédiat du curseur « pixel size / colors ».
16. **Superpixels pour le style « posterisé »** (Gerstner 2012, impl. Rust MIT d'A. Binninger) : pour des illustrations HD → pixel art « propre », alternative à PixelOE quand on veut de grands aplats.

---

## 4. Pipelines d'assemblage recommandés

### Pipeline A — « Faux pixel art IA → asset pixel-perfect dans la palette du projet »

```
image IA (ex. 1024², fond déjà retiré ou non)
 │
 ├─1. Pré-nettoyage (optionnel) : médiane 3×3 ou bilatéral léger (unfake `preProcess`) ; retrait de fond (autre agent)
 │
 ├─2. Détection de grille (Python/NumPy, ou WASM côté client pour l'aperçu)
 │     a. fast path : diviseurs communs + uniformité (pixel-scale)
 │     b. sinon ensemble : runs-based (histogramme des longueurs de runs, soft-GCD)
 │                       + autocorrélation des profils Sobel X/Y
 │                       + pic FFT
 │        → candidats {s_x, s_y} ; arbitre d'octave (round-trip) ; phase (somme de profil)
 │        → option grille non uniforme (snap des lignes sur les arêtes, perfectPixel)
 │     sortie : scale_x, scale_y, offset_x, offset_y, confidence, candidates[]  → overlay UI, l'utilisateur confirme/corrige
 │
 ├─3. Réduction par cellule : quantifier à 16–48 labels (k-means OKLab) → vote pondéré au centre par cellule
 │     → couleur = moyenne des pixels originaux du label gagnant ; alpha = majorité (érosion 1 px optionnelle)
 │     (alternative : PixelOE mode contrast si grille > 8 px et traits fins)
 │
 ├─4. Couleurs : k-means OKLab à N couleurs (ou Wu) → fusion ΔE_OK < seuil → mapping vers palette projet/Lospec
 │     (plus proche voisin OKLab, ou mapping par ramp) → dithering ordonné optionnel sur masque de gradient
 │
 ├─5. Nettoyage sur la carte d'index : orphelins, jaggies, AA résiduel, (auto-)outline, selective outline
 │
 └─6. Export : PNG indexé 1× (+ chunks tEXt : grille, palette, provenance) ; PNG ×N nearest ; sidecar JSON ; .aseprite (writer maison)
       → ouverture directe dans « La Main » pour retouche
```

Briques : NumPy/SciPy/OpenCV (BSD/Apache), code inspiré de pixel-art-fixer + perfectPixel + unfake.py (tous MIT), PixelOE (Apache-2.0) en option, spritefusion-pixel-snapper WASM (MIT) pour l'aperçu client.

### Pipeline B — « Image détaillée (HD) → pixel art »

```
image HD → (fond retiré) → PixelOE (outline expansion, downscale contrast, target_size = taille du sprite)
        → étapes 4–6 du pipeline A (palette, nettoyage, export)
        → variante « posterisée » : pixelization (Gerstner PIA, Rust MIT) ou SLIC scikit-image + k-means
```

### Pipeline C — « Retouche locale »

```
masque (brosse / baguette OKLab / rect ; SAM2 WebGPU seulement en mode detailed)
 → inpainting à la résolution de génération : LaMa (Apache-2.0, CPU OK) pour effacer/boucher ; SD inpaint pour remplacer
 → re-passage du pipeline A avec {scale, offset, palette} VERROUILLÉS
 → composition dans le masque dilaté d'une cellule → retour dans l'éditeur (calque « patch » séparé, l'utilisateur valide)
```

### Pipeline D — « Aperçu / export detailed »

```
pixel art → nearest ×N (export) ; Scale2x/3x NumPy ou hqx (LGPL) pour l'aperçu « smooth » ; ScaleFX en shader WebGL dans l'éditeur
asset detailed → Real-ESRGAN ncnn-vulkan (BSD-3) ×2/×4 avec tiling (petits GPU)
```

**Alternatives.** Si l'on veut zéro développement de détecteur au départ : `pip install unfake` (MIT) côté serveur + WASM Sprite Fusion côté client, puis remplacer par le détecteur maison quand le benchmark est en place. Si le backend est publié en AGPL, libimagequant et xBRZ deviennent utilisables et améliorent respectivement la quantification et l'aperçu.

---

## 5. Ce qu'il faudrait développer soi-même

| Module | Contenu | Pourquoi maison | Effort estimé |
|---|---|---|---|
| **`gridsense`** (Python) | Détecteur ensemble (runs + autocorrélation Sobel + FFT), arbitre d'octave, phase, grille non uniforme, score de confiance, benchmark synthétique | Aucune lib MIT ne combine tout ; pixel-art-fixer est le plus proche mais orienté CLI et max 4 Mpx ; besoin d'une API stable et de hints utilisateur | 2–3 semaines + benchmark |
| **`cellpack`** | Vote quantifié pondéré au centre, recoloration depuis l'original, alpha majoritaire, k-centroid vectorisé | Les implémentations existantes sont soit lentes (quantize par tuile) soit dans du Rust CLI | 1 semaine |
| **`palette`** | OKLab NumPy, k-means/Wu, fusion ΔE, mapping plus-proche-voisin (LUT 3D) et par ramp, détection de ramps (graphe ΔE), import Lospec/.hex/.gpl/.pal/.ase, export, recolor par index | Cœur différenciant (DA du projet) ; ColorAide trop lent par pixel | 2 semaines |
| **`dither`** | Bayer/blue-noise ordonné pour palette arbitraire (Yliluoma-like, gamma-correct), masque de gradient, FS optionnel | hitherdither est Python pur et sans masque | 3–5 jours |
| **`cleanup`** | Orphelins, jaggies, AA removal, auto-outline, selective outline, pixel-perfect line, détection de motifs de dithering à préserver | Petits algos absents des libs | 1 semaine |
| **`scalers`** | Scale2x/3x(SFX) NumPy ; binding ctypes hqx (LGPL, dynamique) ; shader ScaleFX WebGL pour l'éditeur | Licences (xBRZ GPL) et perf | 3–5 jours |
| **`asefile`** | Writer/reader `.aseprite` complet (cels zlib, tags, slices, user data, tilesets), à partir d'asepriteio (Apache-2.0) | Aucune lib Python R/W publiée sur PyPI | 1 semaine |
| **« La Main »** (React/TS) | Modèle indexé (Uint8Array par calque/frame), rendu Canvas 2D + zoom pixelated (ou PixiJS), outils : crayon pixel-perfect, gomme, pot contigu/global 4/8-conn, ligne/rect/ellipse, sélection rect/lasso/baguette, pipette, déplacement, calques (opacité, verrou), palette + swap par index + ramps, symétrie H/V, onion skin, timeline (frames, durées, tags), undo par diff, export PNG/spritesheet/GIF/.aseprite, hooks vers le backend (repasser le pipeline sur une sélection) | Rien d'existant n'est à la fois MIT, React-natif, indexé, animé et vivant ; dotting est un accélérateur possible pour le MVP ; Pixelorama web en iframe comme mode expert | 4–8 semaines cœur |
| **Aperçu client WASM** | Intégrer `spritefusion-pixel-snapper` (wasm-pack) ou `unfake-core` (⚠ imagequant GPL) pour un slider temps réel « pixel size / colors » | Éviter le round-trip serveur | 2–3 jours |
| **Patch local** | Orchestration masque → LaMa/SD → pipeline verrouillé → composition ; service IOPaint figé ou LaMa direct | Assemblage spécifique | 1 semaine |
| **Normal map** | EDT sur alpha + Sobel → normal ; appel CLI Laigter (GPL) en option | Simple | 2 jours |

---

## 6. Sources (URL)

Détection de grille / unfake :
- https://github.com/jenissimo/unfake.js — https://dev.to/jenissimo/how-to-tame-your-ai-pixel-art-3pk5 — https://habr.com/ru/articles/930462/ — https://jenissimo.itch.io/unfaker
- https://github.com/painebenjamin/unfake.py — https://github.com/tauraloke/ComfyUI-Unfake-Pixels
- https://github.com/Retro-Diffusion/pixel-art-fixer — https://www.retrodiffusion.ai/tools/pixel-art-fixer/
- https://github.com/theamusing/perfectPixel
- https://github.com/Hugo-Dz/spritefusion-pixel-snapper — https://www.spritefusion.com/pixel-snapper — https://github.com/x0x0b/ComfyUI-spritefusion-pixel-snapper
- https://github.com/Astropulse/pixeldetector — https://github.com/dimtoneff/ComfyUI-PixelArt-Detector — https://github.com/netux/sd-webui-pixeldetector
- https://github.com/HappyOnigiri/PixelRefiner
- https://github.com/duniul/pixel-scale
- https://www.mdpi.com/2076-3417/16/5/2314 (Structure-Aware Pixel Art Scaling via Block Size Detection, 2026)
- https://www.spritecook.ai/pixel-grid-detector — https://www.spritecook.ai/blog/nanobanana-pixel-art-for-games
- https://hiivelabs.com/blog/gamedev/graphics/2025/01/19/adaptive-downscaling-pixel-art/ — https://github.com/hiive/pixel_scale

Pixelisation :
- https://github.com/KohakuBlueleaf/PixelOE — https://pypi.org/project/pixeloe/
- https://github.com/WuZongWei6/Pixelization — https://dl.acm.org/doi/10.1145/3550454.3555482
- https://github.com/AlexandreBinninger/pixelization
- https://astropulse.itch.io/k-centroid
- https://github.com/mrreplicart/sd-webui-pixelart — https://github.com/flycarl/ComfyUI-Pixelate — https://github.com/Leodotpy/sd-pixel

Couleurs / palettes / dithering :
- https://pillow.readthedocs.io/en/stable/reference/Image.html
- https://github.com/ImageOptim/libimagequant — https://pypi.org/project/imagequant/ — https://github.com/RoadrunnerWMC/libimagequant-python
- https://github.com/hbldh/hitherdither
- https://bisqwit.iki.fi/story/howto/dither/jy/
- https://github.com/ibezkrovnyi/image-quantization
- https://github.com/facelessuser/coloraide — https://facelessuser.github.io/coloraide/colors/oklab/
- https://lospec.com/palettes/api — https://lospec.com/palette-list
- http://eastfarthing.com/blog/2016-05-27-mapping/
- https://resolver.tudelft.nl/uuid:259633b8-22b1-44d5-a91a-d6def7ad048a
- https://github.com/krush62/KPal — https://github.com/meodai/rampensau — https://github.com/depuschm/color-ramps

Contours / AA :
- https://rickyhan.com/jekyll/update/2019/09/01/pixel-art-algorithm-selective-outlining-anti-aliasing.html
- https://github.com/kokoscript/EpoctiAA

Upscale / vectorisation :
- https://en.wikipedia.org/wiki/Pixel-art_scaling_algorithms
- https://github.com/grom358/hqx — https://github.com/ioistired/xbrz.py — https://github.com/n0spaces/py-super-xbr
- https://github.com/Dnyarri/PixelArtScaling — https://pypi.org/project/ScaleNx/ — https://github.com/janert/pixelscalers — https://github.com/Azq2/ra-pixelart-scale
- https://github.com/xinntao/Real-ESRGAN
- https://github.com/visioncortex/vtracer — https://github.com/jankovicsandras/imagetracerjs — https://potrace.sourceforge.net/
- https://github.com/rjalfa/depixelize — https://github.com/TableauBits/DePyxelizer — https://www.cs.jhu.edu/~misha/ReadingSeminar/Papers/Kopf11.pdf

Éditeurs :
- https://github.com/piskelapp/piskel — https://github.com/piskelapp/piskel-embed
- https://github.com/LibreSprite/LibreSprite
- https://github.com/Orama-Interactive/Pixelorama — https://orama-interactive.github.io/Pixelorama/
- https://github.com/lospec/pixel-editor
- https://github.com/bitbof/klecks — https://github.com/viliusle/miniPaint — https://github.com/1j01/jspaint
- https://github.com/hunkim98/dotting — https://github.com/jvalen/pixel-art-react
- https://github.com/topics/pixel-art-editor?o=desc&s=updated
- https://github.com/aseprite/aseprite

Inpainting / segmentation :
- https://github.com/Sanster/IOPaint — https://github.com/advimman/lama — https://pypi.org/project/simple-lama-inpainting/
- https://github.com/lucasgelfond/webgpu-sam2 — https://github.com/Labelbox/sam2-web

Normal maps :
- https://github.com/azagaya/laigter — https://github.com/cpetry/NormalMap-Online

Formats :
- https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
- https://github.com/joeyspacerocks/asepriteio — https://github.com/Eiyeron/py_aseprite
- https://github.com/TheCyberRonin/ase-parser — https://github.com/kayahr/aseprite
