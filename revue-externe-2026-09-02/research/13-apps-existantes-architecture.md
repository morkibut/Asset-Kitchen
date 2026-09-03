# 13 — Panorama des applications existantes et architecture locale / orchestration

*Recherche technique, septembre 2026. Licences, étoiles GitHub, versions et dates ont été vérifiées sur les dépôts et docs officielles (section 7) sauf mention « à vérifier ». Ce document complète les fiches 02 (post-traitement pixel art), 03 (génération locale / VRAM) et 06-07 (animation) : il ne re-détaille pas les modèles ni les algorithmes, mais **qui a déjà construit quoi**, **ce qu'on peut réutiliser légalement** et **comment assembler notre propre application**.*

**Rappel des contraintes** : backend Python 3.11 / FastAPI / Uvicorn, httpx, Pillow + NumPy, serveur MCP monté dans le même processus, rembg + onnxruntime optionnels ; front React 19 + TS + Vite + Tailwind 4 + @xyflow/react ; stockage disque ; cible GPU 8 Go / petits GPU / CPU, API acceptables ; **distribution open source uniquement** (les produits propriétaires ne servent que de référence fonctionnelle, marqués **[PROPRIÉTAIRE]**).

---

## 1. Panorama des applications et projets

### 1.1 Intégrations IA dans des outils d'art (modèles d'architecture)

| Nom | URL | Licence | Langage | Type | Maturité | Ce qu'on réutilise / copie comme idée | Notes |
|---|---|---|---|---|---|---|---|
| **krita-ai-diffusion** (Acly) | github.com/Acly/krita-ai-diffusion | **GPL-3.0** | Python (99 %) | Plugin Krita ↔ serveur ComfyUI | 10,2 k★, v1.51 (31 mai 2026), plugin 1.53 pour Krita 6.x, très actif | **Le modèle d'architecture le plus proche du nôtre** : client léger (docker Krita) + backend ComfyUI en processus séparé, piloté par HTTP + WebSocket. Trois modes : ComfyUI *managé* (le plugin installe un Python embarqué, torch dans la bonne variante CUDA/ROCm/MPS/CPU, les nœuds custom épinglés, télécharge les modèles), *serveur custom* (le plugin vérifie la présence de 4 packs de nœuds et des modèles), *cloud* (Interstice). Idées à copier : **styles** = presets JSON (checkpoint + LoRA + sampler + prompts), **régions** (un prompt par calque/zone), **control layers**, **live painting**, **custom workflows** (un workflow ComfyUI avec des nœuds « paramètre » génère automatiquement un formulaire dans l'UI), **file de jobs + historique** avec vignettes. Le code est GPL : on ne le copie pas, on s'en inspire. | Nœuds requis : `comfyui_controlnet_aux`, `ComfyUI_IPAdapter_plus`, `comfyui-inpaint-nodes`, **`comfyui-tooling-nodes`** (voir ci-dessous). Doc : docs.interstice.cloud. |
| **comfyui-tooling-nodes** (Acly) | github.com/Acly/comfyui-tooling-nodes | **GPL-3.0** | Python | Pack de nœuds ComfyUI « pour outils externes » | 661★, actif | Exactement ce dont un backend a besoin : **Load Image (Base64)** (l'image voyage dans le JSON du prompt), **Send Image (WebSocket)** (le PNG revient en binaire sur la socket, sans passer par le disque), cache RAM d'images, **masques d'attention par région**, découpe en tuiles (tile layout / extract / merge / mask), traduction locale, filtre NSFW, endpoints d'inspection des modèles. | Comme tout nœud tourne *dans* le processus ComfyUI (GPL), notre propre pack de nœuds devra être publié en GPL-3.0 dans un dépôt séparé — c'est ce que fait Acly. |
| **InvokeAI** | github.com/invoke-ai/InvokeAI | **Apache-2.0** (+ licences modèles) | Python + React/TS | Application complète + serveur | 27,9 k★, 19 k commits, très actif ; 35+ architectures (SD1.5 → SDXL, SD3.5, FLUX 1/2, Qwen-Image, CogView4, connecteurs API) | **Licence permissive : on peut lire et réutiliser le code.** À étudier : le **Model Manager** (enregistrements de modèles en SQLite, sondage automatique du type/architecture, hash, file d'installation depuis HF/Civitai/URL/dossier, « starter models »), la **session queue** persistée en SQLite (lots, priorités, annulation, reprise après crash), le bus d'événements (Socket.IO) qui pousse la progression vers le front, les **Boards** (collections d'images) et l'**Unified Canvas** (calques raster / contrôle / masques régionaux / inpaint). | Trop lourd pour servir de moteur, mais c'est **la meilleure référence de code Apache** pour un « model manager » et une file de jobs locale. |
| **ComfyUI** | github.com/comfyanonymous/ComfyUI | **GPL-3.0** | Python | Serveur de workflows + UI | 131 k★, release hebdomadaire | API HTTP (`/prompt`, `/queue`, `/history`, `/interrupt`, `/object_info`, `/upload/image`, `/view`, `/system_stats`, `/free`) + WebSocket (`status`, `execution_start`, `executing`, `progress`, `executed`, `execution_error`, `execution_cached`, aperçus binaires), routage par `client_id`. Workflows JSON « API format ». Support natif de `extra_model_paths.yaml` pour partager un dossier de modèles externe. | Détails moteur/VRAM : fiche 03. Conséquences GPL : § 3.1. |
| **ComfyUI-Manager** / **comfy-cli** | github.com/Comfy-Org/ComfyUI-Manager ; github.com/Comfy-Org/comfy-cli | **GPL-3.0** / **GPL-3.0** | Python | Gestion nœuds/modèles ; CLI d'installation | 16 k★ (snapshots, `cm-cli`, niveaux de sécurité) ; comfy-cli 839★, v1.10.3 (mai 2026) | `comfy install` (une commande, choix CPU/CUDA/ROCm, `--fast-deps` via uv), `comfy node install/snapshot/bisect`, `comfy model download` (Civitai/HF/URL avec tokens), `comfy run --workflow` (conversion automatique du JSON UI → API). Snapshots = reproductibilité d'une installation. | Idéal pour **installer ComfyUI comme sidecar** depuis notre installeur sans réécrire la logique. |
| **Comfy-Desktop** (nouveau) / desktop (archivé juin 2026) | github.com/Comfy-Org/Comfy-Desktop | **AGPL-3.0 ou licence commerciale** (double) | Electron + Vue 3 + TS | App de bureau | Récent (410★) ; l'ancien dépôt `desktop` (GPL-3.0, 2,4 k★) est archivé | Modèle de packaging : Python autonome minimal (~15-20 Mo) + `uv` pour provisionner un environnement par installation, roues torch/GPU pré-construites, mises à jour via ToDesktop. | AGPL : référence seulement. |
| **SD.Next** | github.com/vladmandic/sdnext | **Apache-2.0** | Python | Application + API | 7,2 k★, 14 k commits | Couverture matérielle la plus large (CUDA, ROCm, ZLUDA, IPEX, OpenVINO, DirectML, MPS, CPU), quantification SDNQ, détection/téléchargement automatique de modèles, 25+ modèles de captioning intégrés. | Référence pour la **stratégie multi-backend** et le captioning. |
| **Forge** | github.com/lllyasviel/stable-diffusion-webui-forge | **AGPL-3.0** | Python | Application | 13 k★, « en construction », dernier test août 2024 | Curseur « GPU weights », offload asynchrone, NF4/GGUF. | Référence historique low-VRAM, à ne pas réutiliser (AGPL + stagnation). |
| **Fooocus** | github.com/lllyasviel/Fooocus | **GPL-3.0** | Python | Application | 52,7 k★, LTS (corrections seulement), SDXL uniquement | UX « zéro réglage » : **presets** (default/anime/realistic), **styles** nommés, expansion de prompt par GPT-2 hors-ligne, inpaint maison. 4 Go VRAM minimum. | Copier l'idée des presets + styles, pas le code. |
| **SwarmUI** | github.com/mcmonkeyprojects/SwarmUI | **MIT** (backend ComfyUI GPL piloté par réseau) | C# + JS | Front + orchestrateur multi-backend | 4,2 k★, 4,7 k commits, bêta 0.9.8 | **Preuve juridique et technique qu'on peut être MIT en pilotant ComfyUI par API.** Grid generator (matrice de variations), presets, model manager, multi-utilisateurs, extensions. | Référence d'architecture. |
| **Dream Textures** (Blender) | github.com/carson-katri/dream-textures | **GPL-3.0** | Python | Add-on Blender, diffusers **in-process** | 8,2 k★, activité modérée | Textures **seamless** (« no visible seam »), projection depth-to-image sur une scène 3D, upscale, re-stylisation de passes de rendu. | Idée : « texture tileable » comme option de génération ; 3D→2D. |
| **Auto-Photoshop-SD** ; **GIMP-ML** / **stable-gimpfusion** | github.com/AbdullahAlfaraj/Auto-Photoshop-StableDiffusion-Plugin ; github.com/kritiksoman/GIMP-ML | MIT (7,3 k★, dernière release déc. 2023) ; MIT (à vérifier) | TS (UXP) + Python ; Python | Plugins hôtes ↔ A1111/ComfyUI | Stagnants | Schéma « plugin hôte léger + serveur Python relais ». | Références mineures. |
| **Stable Projectorz** **[PROPRIÉTAIRE]** | stableprojectorz.com | Freeware fermé | — | Texturage 3D via API A1111/Forge | — | Idée : « projeter » une génération sur un modèle 3D pour des vues cohérentes. | Référence. |

### 1.2 Éditeurs pixel art / sprites

| Nom | URL | Licence | Langage | Type | Maturité | Ce qu'on réutilise / copie | Notes |
|---|---|---|---|---|---|---|---|
| **Pixelorama** | github.com/Orama-Interactive/Pixelorama | **MIT** | GDScript (Godot 4.6) | Éditeur pixel art complet | 9,7 k★, v1.1.10 (29 avr. 2026), très actif | Timeline calques × frames, onion skin, **tags d'animation**, synchro audio, **tilemaps rect/iso/hex**, palettes, calques 3D, masques d'écrêtage, effets (contour, dégradé, ombre), **export PNG/APNG/spritesheet/GIF/vidéo**, **automatisation en ligne de commande** pour l'export en masse, **API d'extensions**. Format `.pxo` (ZIP + JSON) lisible. | Candidat n° 1 pour une **extension « Génération IA »** qui appelle notre API locale ; et source d'inspiration MIT pour notre atelier (timeline, tags, tuiles). |
| **LibreSprite** | github.com/LibreSprite/LibreSprite | **GPL-2.0** | C++ | Fork d'Aseprite (dernier commit GPL, 2016) | 8,3 k★, 5,4 k commits, actif (Linux/Win/Mac/Android) | Lit/écrit le format `.ase` ; scripting JS (SCRIPTING.md). | GPL-2.0 : pas de réutilisation de code dans un cœur permissif ; utile comme cible d'export. |
| **Aseprite** **[SOURCE-AVAILABLE]** | github.com/aseprite/aseprite | **EULA propriétaire** : on peut compiler et modifier « for your own personal purpose or to propose a contribution », **interdiction de distribuer des copies** (sauf versions d'évaluation), pas de location, pas de retro-ingénierie | C++ | Éditeur de référence du marché | Standard de fait | **Ce qui est légalement réutilisable** : (1) la **spec du format `.ase/.aseprite`** (docs/ase-file-specs.md, publique : header 128 o, frames, chunks Layer 0x2004, Cel 0x2005, Palette 0x2019, Tags 0x2018, Slices 0x2022, User Data 0x2020, **Tileset 0x2023**, zlib) → écrire notre propre lecteur/écrivain ; (2) la **CLI** (`aseprite -b in.ase --sheet out.png --data out.json --split-layers --split-tags`) que l'utilisateur possède ; (3) l'**API Lua** et le format d'extension (`.aseprite-extension` = ZIP + `package.json`) : Retro Diffusion et PixelLab distribuent tous deux une extension Aseprite qui parle à leur API. | Faire comme eux : **une extension Aseprite qui pousse/tire des sprites vers notre serveur local** est un excellent canal de distribution. |
| **Piskel** | github.com/piskelapp/piskel | **Apache-2.0** | JS/TS | Éditeur web | 12,6 k★, v0.15 (2018), dormant | Code Apache d'un éditeur canvas web (calques, frames, export GIF/zip) : trop ancien pour être embarqué, mais son modèle de données `.piskel` (JSON + PNG base64) est simple. | Préférer une implémentation React/canvas moderne (fiche 02, § 2.7). |
| **rx** (cloudhead) | github.com/cloudhead/rx | GPL-3.0 (à vérifier) | Rust | Éditeur modal minimaliste | Peu actif | Idée : commandes texte / scripts pour tout. | Référence. |
| **GraphicsGale** / **Pyxel Edit** / **Pro Motion NG** **[PROPRIÉTAIRES]** | graphicsgale.com ; pyxeledit.com ; cosmigo.com | Freeware / payant / payant | — | Éditeurs | Pyxel Edit dormant ; Pro Motion très complet | Pro Motion NG : gestion de palettes « par plans », tuiles avec détection de doublons, anim par « layers de tuiles ». Pyxel Edit : **tileset ↔ carte synchronisés** (éditer une tuile met à jour la carte). | Copier l'idée « éditer une tuile = mettre à jour toutes ses occurrences ». |
| **Pixel Composer** **[PROPRIÉTAIRE, code public]** | github.com/Ttanasart-pt/Pixel-Composer | Code visible, licence propriétaire (vente itch/Steam ; à vérifier) | GameMaker | **Éditeur nodal de VFX / traitements pixel art** | Actif | La référence UX d'un **graphe de nœuds pour pixel art** (comme notre @xyflow) : nœuds de dégradés, bruit, cellular, dithering, outline, glow, animation par frames, export spritesheet. | Ne pas copier le code ; s'en inspirer pour la palette de nœuds. |
| **Juice FX / Smear FX / Pixel FX Designer** **[PROPRIÉTAIRES]** | codemanu.itch.io | Payants | — | Génération de VFX pixel art (particules, smears, secousses) | Stables | Catalogue des « effets » attendus par les devs pixel art : explosion, fumée, feu, slash, impact, smear frames. | À reproduire en open source (voir § 1.6). |
| **Effekseer** | github.com/effekseer/Effekseer | **MIT** | C/C++/C# | Éditeur + runtimes de particules | 1,7 k★, v1.80.5 (16 juin 2026) ; runtimes Unity, Unreal, **Godot**, WebGL, cocos2d | Format d'effet `.efkefc` + runtimes engine : on peut **exporter un VFX vers un format jouable**, ou rendre des **flipbooks** (spritesheets d'effets) via son runtime. | Complément « VFX temps réel » ; pour du pixel art on rendra plutôt des flipbooks pixelisés. |
| **Laigter** | github.com/azagaya/laigter | **GPL-3.0** | C++ (Qt) | **Normal / specular / occlusion / parallax maps** de sprites | 1,3 k★, v1.13.1 (16 déc. 2025) ; **CLI** batch | Presets et algorithmes (hauteur depuis luminance → normal, contours). GPL : à piloter en sous-processus CLI ou à réimplémenter en NumPy (Sobel/hauteur, quelques dizaines de lignes). | Équivalents propriétaires : **Sprite DLight**, **SpriteIlluminator** (CodeAndWeb). |
| **Sprytile** | github.com/Sprytile/Sprytile | Open source (licence à vérifier, MIT probable) | Python | Add-on Blender « painter de tuiles en 3D » | Dormant | Idée : construire des niveaux 3D avec des tuiles pixel puis rendre en orthographique. | Référence. |
| **PixelOver** **[PROPRIÉTAIRE]** | pixelover.io | Payant | — | 3D → pixel art, animation, normal maps, palettes | Actif | La cible fonctionnelle « modèle 3D → spritesheet pixel-perfect » ; alternative open : **Blender headless (GPL, processus séparé)** ou **Godot headless (MIT)** avec shader de quantification + export de rotations 8 directions. | Voir § 4. |
| **Goxel** / **MagicaVoxel** / **SpriteStack** | github.com/guillaumechereau/goxel ; ephtracy.github.io ; spritestack.io | Goxel **GPL-3.0** ; MagicaVoxel freeware fermé ; SpriteStack **[PROPRIÉTAIRE]** | C | Voxels ; « sprite stacking » | Goxel actif | Le format **`.vox`** (MagicaVoxel) est documenté et simple : on peut générer des **piles de tranches** (sprite stacking) et des rotations depuis un `.vox`. Pixelorama a une extension voxel. | Fonctionnalité « sprite stacking » (§ 1.6). |

### 1.3 Générateurs d'assets de jeu par IA (référence de fonctionnalités)

| Nom | URL | Licence | Type | Ce qu'ils annoncent (à égaler / dépasser) | Notes |
|---|---|---|---|---|---|
| **Retro Diffusion** (Astropulse) **[PROPRIÉTAIRE]** | retrodiffusion.ai ; doc astropulse.gitbook.io/retro-diffusion | API + extension Aseprite fermées ; **`pixeldetector` en MIT** (github.com/Astropulse/pixeldetector, 348★, Pillow+NumPy+SciPy) | Modèles RD (API), extension Aseprite, site | Extension Aseprite avec menus : **Génération**, **Composition preview**, **Palettize** (réduction + remap vers palette), **Remove background**, **K-centroid resize** (downscale propriétaire), **Repair pixel art** (basé sur pixeldetector). API : styles de prompt, seed, tuiles tileables, palette, remove-bg, img2img ; 50 crédits gratuits. | Le « Repair pixel art » (détecter la vraie taille de pixel, re-downscaler, re-quantifier) est **le** différenciateur pixel art : on l'a déjà en partie (fiche 02). |
| **PixelLab** **[PROPRIÉTAIRE]** | pixellab.ai ; github.com/pixellab-code/pixellab-mcp (config, « all rights reserved ») | Fermé (API, plugin Aseprite, MCP) | Service | « One-click animations », **skeleton-based animation**, « animate with text », **rotations 4/8 directions** + isométrique, **true inpainting**, génération **style-consistent** depuis référence, scènes, textures, **tilesets (Wang)**, **tuiles isométriques**, UI (menus, boutons, barres de vie), scene animation, API, **MCP « vibe coding »** (4 outils : create character, animate character, tileset, isometric tile). | Leur MCP est plus simple que celui de SpriteCook (43 outils) : on peut viser l'entre-deux. |
| **Scenario** **[PROPRIÉTAIRE]** | scenario.com | Fermé | Service + API | **Entraînement de modèles custom** (LoRA sur le style du studio), composition control (ControlNet), **génération de textures PBR** (albedo → normal/height/roughness), skyboxes, upscale, vectorisation, « retake », gestion d'équipe/collections. | Idée : LoRA « style du projet » (open : kohya-ss Apache-2.0, ai-toolkit MIT) + maps PBR (Laigter / NumPy). |
| **Layer.ai** **[PROPRIÉTAIRE]** | layer.ai | Fermé | Service | « Forge » (styles entraînés), canvas, cohérence de marque, bibliothèque d'assets d'équipe, vidéo. | Idée : bibliothèque partagée + style verrouillé par projet. |
| **Ludo.ai**, **Rosebud AI**, **Kittl**, **Recraft**, **Leonardo** **[PROPRIÉTAIRES]** | ludo.ai ; rosebud.ai ; kittl.com ; recraft.ai ; leonardo.ai | Fermés | Services | Ludo : idéation/concepts/market ; Rosebud : « vibe coding » de jeux complets ; Recraft : **vectoriel + palette de marque** + API ; Leonardo : canvas temps réel, « Elements » (adaptateurs de style), upscaler, motion. | Fonctions à noter : palette imposée, style adapters, playground jouable. |
| **Open source (modèles/LoRA)** | huggingface.co/nerijs/pixel-art-xl ; civitai (recherche « pixel art ») | LoRA sous CreativeML-OpenRAIL-M ou licences Civitai variables (**champs `allowCommercialUse` / `allowDerivatives` de l'API Civitai**) | Modèles | Voir fiche 03 § 2.2 pour la liste vérifiée. | Toujours stocker la licence SPDX/Civitai dans le manifeste de modèle. |
| **Dépôts GitHub « AI game asset generator », « sprite-generator », « pixel-art-ai » (2024-2026)** | github.com/topics/pixel-art-generator ; github.com/topics/game-assets | Variées | Scripts / démos | Majoritairement des wrappers de SD/ComfyUI + pixelisation ; aucun projet mature comparable à SpriteCook n'a été trouvé côté open source (à re-vérifier avec une recherche GitHub quand elle sera disponible). | **Il y a une place à prendre.** |

### 1.4 Serveurs MCP pour le game dev (raccordement de notre MCP)

| Nom | URL | Licence | Langage | Outils exposés | Comment notre MCP s'y raccorde |
|---|---|---|---|---|---|
| **godot-mcp** (Coding-Solo) | github.com/Coding-Solo/godot-mcp | **MIT** | JS + GDScript | Lancer l'éditeur, exécuter le projet, lire la sortie debug, **créer des scènes, ajouter des nœuds, charger des sprites**, exporter MeshLibrary, gérer les UID (4.4+) ; pilote Godot par CLI headless + un script `godot_operations.gd` unique qui reçoit du JSON | L'agent enchaîne `notre.generate_sprite` → chemin de fichier → `godot.load_sprite`. Notre outil doit **retourner un chemin absolu dans le projet Godot** en plus de l'image. 4,1 k★. |
| **unity-mcp** (CoplayDev) | github.com/CoplayDev/unity-mcp | **MIT** | C# (package Unity) + Python (serveur, via uv) | 47 outils : scènes, GameObjects, scripts C# validés par Roslyn, assets, tests, builds, routage multi-instances, **groupes d'outils** (VFX, animation, UI…) | Copier le **groupage d'outils** et l'installateur « Configure All Detected Clients ». 13,8 k★, v10 (30 juin 2026). |
| **blender-mcp** | github.com/ahujasid/blender-mcp | **MIT** | Python | Add-on = serveur socket TCP JSON dans Blender + serveur MCP externe ; scène, objets, matériaux, exécution Python, intégrations Poly Haven / Sketchfab / Hyper3D / Hunyuan3D | Modèle « add-on hôte + pont » à reprendre pour nos extensions Aseprite/Pixelorama. 26,7 k★. |
| **aseprite-mcp** (diivi) | github.com/diivi/aseprite-mcp | **MIT** | Python | Dessin dans Aseprite via scripts Lua en mode batch | Montre qu'un agent peut piloter Aseprite ; nous ferons l'inverse (Aseprite → notre API) mais on peut aussi exposer `open_in_aseprite`. 192★. |
| **pixellab-mcp** | github.com/pixellab-code/pixellab-mcp | Propriétaire | — | 4 outils | Concurrent direct ; notre MCP doit être **installable en une ligne** (`npx`/`uvx` ou URL HTTP). |

### 1.5 Outils de « pipeline créatif » game dev

| Nom | URL | Licence | Langage | Type | Ce qu'on réutilise / copie | Notes |
|---|---|---|---|---|---|---|
| **Tiled** | github.com/mapeditor/tiled | **GPL-2.0** (app) + **BSD-2** (libtiled) + Apache (parties) | C++/Qt | Éditeur de cartes | Formats **TMX/TSX/JSON** (cibles d'export pour nos tilesets), **Wang sets / terrains**, **automapping** (règles), templates d'objets, scripting JS/Python. 12,7 k★, 1.12.2 (27 mai 2026). | Exporter un `.tsx` avec Wang set déjà renseigné = valeur immédiate pour l'utilisateur. |
| **LDtk** | github.com/deepnight/ldtk | **MIT** | Haxe + Electron | Éditeur de niveaux | **Auto-layers à règles**, entités avec champs typés, enums, mondes ; JSON documenté. 4,1 k★. | Exporter une définition de tileset LDtk avec les règles d'autotile. |
| **Godot** | github.com/godotengine/godot | **MIT** | C++ | Moteur | Ressources `TileSet` (.tres) et `SpriteFrames` ; **mode headless** pour rendre des aperçus ou des scènes de test. | Cible d'export prioritaire (comme SpriteCook). |
| **Defold** | github.com/defold/defold | « Defold License » (Apache-2.0 + restrictions) | C++/Clojure | Moteur | Atlas, tilesource, éditeur de particules. 6,1 k★. | Cible d'export secondaire (atlas + tilesource). |
| **Phaser Editor** **[PROPRIÉTAIRE]** / Phaser (MIT) | phaser.io | — | JS | Moteur web | Format d'atlas JSON (hash/array) = standard de fait pour le web. | Cible d'export (TexturePacker-like JSON). |
| **Bitsy** | codeberg.org/adamledoux/bitsy (GitHub archivé 22 juil. 2026) | **MIT** | JS | Micro-moteur | Sprites 8×8, salles, dialogues, palettes de 3 couleurs : un **playground** minimal où tester un tileset et un personnage en 30 s. | Idée « bac à sable jouable » (§ 4). |
| **PuzzleScript** | github.com/increpare/PuzzleScript | **MIT** | JS | Micro-moteur | Sprites 5×5 en texte. | Référence. |
| **Twine** | github.com/klembot/twinejs | **GPL-3.0** | TS | Éditeur de récits non linéaires | 2.12.0 (10 avr. 2026) : **carte de passages** (graphe), formats d'histoire, export HTML/Twee. | Pour notre module scénario : graphe de passages en @xyflow + export Twee ; pour les dialogues, préférer **Ink** (inkle, MIT) ou **Yarn Spinner** (MIT) qui ont des runtimes Godot/Unity. |
| **Sprite Fusion**, **Tilekit**, **Kenney Asset Forge**, **CraftPix**, **Character Creator 2D**, **Hero Forge** **[PROPRIÉTAIRES]** | spritefusion.com ; rxi.itch.io/tilekit ; kenney.nl/tools/asset-forge ; craftpix.net | Fermés | — | Sprite Fusion : éditeur de tilemap web gratuit avec export Godot/Unity/Defold ; Tilekit : autotiling par règles ; Asset Forge : assemblage de blocs 3D → sprites. | Références UX. |
| **Kenney** / **OpenGameArt** | kenney.nl ; opengameart.org | **CC0** / CC0-CC-BY-CC-BY-SA-GPL-OGA-BY selon l'asset | — | Bibliothèques | Kits de démarrage libres pour tester les pipelines (tuiles, UI, sons) ; OpenGameArt n'a pas d'API officielle. | Embarquer quelques packs CC0 comme « starter ». |
| **Universal LPC Spritesheet Character Generator** | github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator | Code **GPL-3.0 + CC-BY-SA-4.0** ; assets CC0 / CC-BY / CC-BY-SA / OGA-BY / GPL avec **crédits par calque** | JS/TS (WebGL) | **Générateur paramétrique de personnages par calques** | 1,6 k★, 2,2 k commits, actif. **Idée majeure** : `sheet_definitions/*.json` décrit chaque pièce (corps, cheveux, vêtements, armes) avec **z-order par animation**, variantes de couleur par **palette swap en shader WebGL** (90-120 ms), liste d'animations (walk, slash, spellcast…), export PNG + **JSON de projet** + **CSV de crédits**. | Modèle pour un « personnage paramétrique » : générer les calques par IA une fois, puis composer/recolorer à l'infini sans GPU. Le format de définition est copiable (idée), le code GPL non. |
| **Charas** / **Pixel Character Generator** / rpg-character generators | charas-project.net ; itch.io | GPL (Charas, ancien) / propriétaires | PHP / — | Générateurs RPG Maker | Même principe LPC, plus daté. | Référence. |

### 1.6 Fonctionnalités « oubliées » identifiées dans ces outils

1. **Normal / specular / height maps 2D** (Laigter, Sprite DLight, SpriteIlluminator, Scenario PBR) → éclairage dynamique dans Godot/Unity ; implémentable en NumPy + export PNG `_n`.
2. **VFX / particules pixel art** (Juice FX, Pixel FX Designer, Pixel Composer, Effekseer) → générateur de flipbooks (explosion, fumée, slash, impact) par nœuds procéduraux + pixelisation ; export spritesheet + `.efkefc` optionnel.
3. **Portraits et expressions de dialogue** (bustes, 6-8 émotions cohérentes via édition par référence) ; **cutscenes / storyboards** (planches de vignettes liées au scénario).
4. **Palette swaps et variantes par calques d'équipement** (LPC) : composition sans GPU, recolor par LUT ; **variantes procédurales** (seed + curseurs).
5. **Parallax** : découpe d'un décor en plans par estimation de profondeur (Depth Anything V2 **Small** est Apache-2.0 ; attention, les variantes Base/Large sont CC-BY-NC) + inpainting des trous.
6. **Tuiles animées** (eau, lave, torches) et **autotiles** : Wang/blob 47 tuiles avec règles exportées vers Tiled/LDtk/Godot.
7. **Sprite stacking** depuis `.vox` ; **3D → pixel** (PixelOver) via Godot/Blender headless.
8. **Rotations 4/8 directions** et **animation squelettique** (PixelLab) : voir fiches 06-07.
9. **Texture seamless** (Dream Textures) et **vectorisation** (Recraft, Scenario) → vtracer (MIT) / potrace (GPL en CLI).
10. **Localisation de l'UI** : générateur de **polices bitmap** (msdf-atlas-gen MIT, fontbm) et texte multi-langue dans les mockups d'UI.
11. **Export « asset pack »** avec `CREDITS.csv`/`LICENSE` par asset (LPC), README, atlas JSON, `.tsx`, `.tres`.
12. **Lignée « Made from »** (SpriteCook), **snapshots de projet** (ComfyUI-Manager), **workflow embarqué dans le PNG** (ComfyUI/A1111) pour re-générer par glisser-déposer.
13. **Scoring / curation** : tri automatique des variations (fiche 03 § 2.6) + « Repair pixel art » (Retro Diffusion).
14. **Presets communautaires** (styles JSON de Krita AI, presets Fooocus, snapshots comfy) et **coût/temps affiché avant clic** (OpenRouter publie les prix par modèle).
15. **Playground jouable** (Bitsy, Rosebud) : tester un tileset/personnage dans un mini-niveau sans quitter l'app.
16. **Grid generator** (SwarmUI) : matrice prompt × seed × modèle pour comparer.
17. **Entraînement de LoRA de style projet** (Scenario, Layer) avec kohya-ss (Apache-2.0) / ai-toolkit (MIT) — optionnel, GPU ≥ 8 Go.

---

## 2. Problèmes / verrous d'architecture

1. **Moteur d'exécution des modèles** : ComfyUI sidecar (GPL) vs diffusers in-process (Apache) vs stable-diffusion.cpp (MIT) — et les conséquences juridiques d'embarquer ComfyUI.
2. **Gestion de la VRAM entre tâches hétérogènes** (diffusion, rembg/SAM ONNX, upscale, tagger) sur 8 Go ou moins ; isolation des plantages CUDA.
3. **File de jobs locale** : persistance, priorités, annulation, progression temps réel, reprise après crash — sans Redis ni Postgres.
4. **Téléchargement et gestion des modèles** : sources (HF, Civitai, URL), cache, checksums, licences, partage entre moteurs, poids hors dépôt.
5. **Provenance / lignée des assets et stockage** : format de projet portable, métadonnées dans le PNG, versionnage, miniatures, index de recherche (texte + similarité).
6. **Abstraction des fournisseurs d'images cloud** : OpenRouter, Gemini, OpenAI, fal, Replicate, Stability ; coût avant clic, retries, quotas.
7. **MCP dans le même processus FastAPI** : transport, outils longs, ressources image, distribution aux clients (Claude Code, Cursor).
8. **Packaging / distribution** d'une app Python + React locale, multi-GPU (CUDA / ROCm / Vulkan / CPU), mises à jour, sans télémétrie.
9. **Tests d'images** et évaluation continue de la qualité.

---

## 3. Solutions par problème

### 3.1 Moteur d'exécution (et licence ComfyUI)

| Nom | URL | Licence | Langage | Maturité | Complexité (1-5) | Limites | Notes |
|---|---|---|---|---|---|---|---|
| **ComfyUI en sidecar** (processus séparé, HTTP/WS) | github.com/comfyanonymous/ComfyUI | **GPL-3.0** | Python | Référence, 131 k★ | 3 | Installation lourde (torch + nœuds custom), versions qui bougent chaque semaine, dépendance à des nœuds tiers de qualité variable ; workflows à maintenir en JSON | **Piloté par réseau = pas d'œuvre dérivée** : SwarmUI (MIT) et Krita AI le font. **Ce qu'on écrit dans son processus** (nœuds custom) est GPL → dépôt séparé `xxx-comfy-nodes` en GPL-3.0. **Redistribuer ComfyUI dans notre installeur** est permis (GPL = libre redistribution ; « mere aggregation » sur un même support) à condition de fournir licence + sources/lien ; plus simple : l'installer à la volée avec `comfy-cli`. |
| **diffusers in-process** | github.com/huggingface/diffusers | **Apache-2.0** | Python | 34,4 k★, très actif ; offload CPU/séquentiel, **group offloading**, hooks, quantification, « Modular Diffusers » | 3-4 | Le processus FastAPI porte torch (RAM, GIL, plantages CUDA fatals) ; pas d'écosystème de nœuds (ControlNet/IP-Adapter à câbler soi-même) | **Recommandé dans un processus « worker » fils** (multiprocessing/spawn) parlant au serveur par pipe/socket : on garde Apache, le contrôle mémoire et l'isolation. Voir fiche 03. |
| **stable-diffusion.cpp** (+ `stable-diffusion-cpp-python`) | github.com/leejet/stable-diffusion.cpp | **MIT** | C/C++ (ggml) | 6,7 k★, très actif : SD1/2/XL/3, FLUX 1/2, Qwen-Image, Z-Image, Chroma, Wan/LTX ; LoRA, ControlNet, inpaint, ESRGAN, PhotoMaker ; **CPU/CUDA/Vulkan/Metal/OpenCL/SYCL** ; GGUF | 2-3 | Pas de nœuds ; certaines features arrivent après diffusers | **Moteur de portabilité** (AMD/Intel Windows via Vulkan, Mac, CPU) et de « one-click » : pas de torch à installer (binaire de quelques dizaines de Mo). |
| **InvokeAI comme moteur (API REST)** | github.com/invoke-ai/InvokeAI | Apache-2.0 | Python | Mature | 4 | Très lourd, API interne non stable | À réserver comme *backend optionnel* pour les utilisateurs qui l'ont déjà. |
| **SD.Next (API)** | github.com/vladmandic/sdnext | Apache-2.0 | Python | Actif | 4 | Idem | Idem ; sa couverture DirectML/ZLUDA peut dépanner. |
| **ONNX Runtime** (rembg, BiRefNet, Depth Anything, tagger, SAM) | onnxruntime.ai | **MIT** | C++/Python | Mature ; providers **CUDA**, **DirectML** (Windows tout GPU, en maintenance), **ROCm**, **CoreML**, **CPU** | 1-2 | Un provider par build (`onnxruntime-gpu`, `onnxruntime-directml`) ; DirectML gelé | **Moteur des « petits modèles »** : un seul runtime pour tout le non-diffusion, choisi à l'installation. |

**Recommandation.** Une interface `Engine` unique (à la manière du `Client` abstrait de Krita AI : `capabilities()`, `models()`, `submit(job) -> job_id`, `events()`, `interrupt()`, `free_memory()`) avec trois implémentations dès la v1 :
1. `DiffusersWorker` (Apache) dans un **sous-processus dédié** — profil NVIDIA 8 Go (cohérent avec la fiche 03) ;
2. `SdCppEngine` (MIT) — profil CPU / AMD / Intel / Mac et installation minimale ;
3. `CloudEngine` — API (voir § 3.6).
Et, en option v1.x, `ComfyEngine` (sidecar installé par `comfy-cli`, `extra_model_paths.yaml` pointant sur notre dossier de modèles, nœuds `comfyui-tooling-nodes` pour l'échange base64/WebSocket) pour l'utilisateur avancé et les modèles « du jour J ». Ne **jamais** importer de code ComfyUI dans le serveur.

### 3.2 Gestion de la VRAM et isolation

| Solution | Licence | Complexité | Notes |
|---|---|---|---|
| **Sémaphore GPU global + « bail » (lease)** : un seul job GPU à la fois, un `ModelSlot` LRU par moteur (décharger avant de charger un modèle d'une autre famille) | — (maison) | 2 | Copie du comportement de ComfyUI (« smart memory management ») ; exposer `unload_all()` dans l'UI. |
| ComfyUI `POST /free {unload_models, free_memory}` entre deux tâches | GPL (réseau) | 1 | Indispensable si ComfyUI cohabite avec nos ONNX. |
| diffusers `enable_model_cpu_offload` / group offloading, `torch.cuda.empty_cache()` ; `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` | Apache | 2 | Détails fiche 03. |
| ONNX : sessions mises en cache par modèle, `SessionOptions` mémoire, choix du provider `CUDAExecutionProvider` → `DmlExecutionProvider` → `CPUExecutionProvider` au démarrage | MIT | 1 | rembg accepte `providers=[...]` ; BiRefNet ONNX fourni (MIT) ; **éviter RMBG-2.0 (CC-BY-NC)**. |
| **Worker GPU en sous-processus** (multiprocessing `spawn`) redémarré automatiquement en cas d'OOM/crash | — | 2 | Le serveur FastAPI ne meurt jamais ; c'est aussi ce qui permet de basculer de moteur sans redémarrer. |

### 3.3 File de jobs, progression, annulation, estimation

| Nom | URL | Licence | Langage | Maturité | Complexité | Limites | Notes |
|---|---|---|---|---|---|---|---|
| **asyncio + SQLite maison** (table `jobs` : id, kind, params JSON, state, progress, result, parent, created/started/finished, worker) | — | — | Python | Pattern éprouvé (InvokeAI « session queue » est en SQLite) | 2 | À écrire soi-même (≈ 400 lignes) | **Recommandé** pour une app mono-utilisateur locale : zéro dépendance, transaction = persistance, annulation via `asyncio.Task.cancel()` + drapeau coopératif transmis au worker, reprise au démarrage (jobs `running` → `interrupted`). |
| **Huey** | github.com/coleifer/huey | **MIT** | Python | 6 k★, v3.0.2 (11 juin 2026) ; backends **SQLite**, Redis, mémoire, fichiers ; priorités, retries, `revoke`, périodiques, pipelines ; consommateur threads/process/greenlets | 2 | Pas d'API async native ; progression à gérer via un canal séparé | **Meilleure option prête à l'emploi sans Redis** si on veut plusieurs processus workers (GPU vs CPU). |
| **arq** | github.com/python-arq/arq | MIT | Python | 3 k★ mais **« maintenance only »** ; Redis obligatoire | 2 | Redis | Éviter pour une app locale. |
| **RQ** | github.com/rq/rq | BSD-2 (à vérifier) | Python | Mature ; Redis | 2 | Redis | Idem. |
| **Dramatiq** | github.com/Bogdanp/dramatiq | **LGPL-3.0 / GPL-3.0** | Python | 5,3 k★, v2.1.0 (mars 2026) ; RabbitMQ/Redis ; abort via `dramatiq_abort` | 3 | Broker externe + LGPL | Non. |
| **Celery** | github.com/celery/celery | BSD-3 | Python | Mature | 4 | Broker, complexité | Non pour du local. |
| **Procrastinate** | github.com/procrastinate-org/procrastinate | MIT | Python | 1,4 k★ ; **PostgreSQL uniquement**, async natif | 3 | Postgres | Non. |
| **FastAPI `BackgroundTasks`** | fastapi.tiangolo.com | MIT | Python | — | 1 | Aucune persistance, pas d'annulation, pas de progression, lié à la requête | Bon pour « écrire une vignette », pas pour des jobs GPU. |
| **Progression** : WebSocket unique `/ws/events` (déjà nécessaire pour ComfyUI) ou **SSE** (`sse-starlette`, BSD-3) | — | — | — | — | 1 | SSE plus simple derrière un proxy, WS bidirectionnel (annuler) | Un seul flux d'événements typés (`job.progress`, `job.preview` base64 réduit, `job.done`, `model.download`), consommé par React et par les outils MCP. |
| **Estimation coût/temps** | — | — | — | — | 2 | — | Local : table de calibration par (moteur, modèle, résolution) mesurée aux premières exécutions (s/mégapixel/étape) ; cloud : table de prix par modèle rafraîchie depuis `GET https://openrouter.ai/api/v1/models` (champ `pricing`) et tables statiques pour fal/Replicate ; **afficher « ≈ 0,04 $ · ~12 s » sur le bouton avant clic**, puis le coût réel après. |

### 3.4 Téléchargement et gestion des modèles

| Nom | URL | Licence | Complexité | Notes |
|---|---|---|---|---|
| **huggingface_hub** | github.com/huggingface/huggingface_hub | **Apache-2.0** | 1 | `hf_hub_download` / `snapshot_download`, reprise, cache partagé (`HF_HOME`), téléchargement rapide (`hf_xet` / `hf_transfer`), vérification via ETag/SHA, filtres `allow_patterns` (ne prendre que le `.safetensors` Q8). Gated models : token utilisateur. |
| **API Civitai** | civitai.com/api/v1 (`/models`, `/model-versions/{id}`, `/model-versions/by-hash/{sha256}`) | API publique (token pour téléchargement) | 2 | Renvoie **`allowCommercialUse`, `allowDerivatives`, `allowNoCredit`**, hash SHA256/AutoV2, base model, trigger words : à copier dans le manifeste. |
| **Patron « Model Manager » d'InvokeAI** | github.com/invoke-ai/InvokeAI (`invokeai/app/services/model_manager`, `model_install`, `model_records`) | Apache-2.0 | 3 | Enregistrement en SQLite (type, base, format, hash, chemin, source), sondage automatique du fichier (`probe`), file d'installation avec progression, « starter models ». **Code réutilisable.** |
| **comfy-cli `model download`** / **ComfyUI-Manager** | voir § 1.1 | GPL | 1 | Si ComfyUI est installé, laisser comfy-cli télécharger dans *notre* dossier via `extra_model_paths.yaml`. |
| **StabilityMatrix** | github.com/LykosAI/StabilityMatrix | **AGPL-3.0** (à vérifier) | — | Référence UX (navigateur Civitai intégré, packages en un clic, dossiers de modèles partagés entre UIs). Pas de réutilisation. |
| **Pinokio** | github.com/pinokiocomputer/pinokio | MIT (à vérifier) | — | Scripts d'installation JSON (env conda/uv, variantes torch par GPU) : idée de « recettes » déclaratives pour nos packs moteurs. |

**Recommandation.** Un **manifeste `models/*.json`** versionné dans le dépôt (nom, famille, fichiers [url HF/Civitai/URL, sha256, taille], licence SPDX ou champs Civitai, VRAM minimale, moteurs compatibles, tags « pixel-art », « anime »…) ; poids stockés **hors dépôt** dans le répertoire utilisateur (`platformdirs`, MIT) ; téléchargement via huggingface_hub / httpx avec reprise + vérification sha256 (`hashlib`, ou `blake3` pour les gros fichiers) ; liens symboliques ou `extra_model_paths.yaml` vers les moteurs ; badge de licence visible **avant** téléchargement.

### 3.5 Provenance, stockage, versionnage, recherche

| Nom | URL | Licence | Complexité | Notes |
|---|---|---|---|---|
| **Chunks PNG `tEXt`/`iTXt`** via Pillow `PngInfo` | pillow.readthedocs.io | MIT-CMU | 1 | Conventions existantes : A1111 clé `parameters` ; ComfyUI clés `prompt` (API JSON) et `workflow`. Ajouter notre clé `gamekit` (JSON : schéma, id, parents[], outil, params, seed, modèle+hash, moteur, coût) → **un PNG suffit à re-générer ou à retrouver la lignée**. |
| **sd-parsers** | github.com/d3x-at/sd-parsers | MIT (à vérifier) | 1 | Lit les métadonnées A1111 / ComfyUI / InvokeAI / Fooocus : utile pour **importer** des images produites ailleurs avec leur provenance. |
| **C2PA (c2pa-python)** | github.com/contentauth/c2pa-python | Apache-2.0 / MIT (double, à vérifier) | 3 | Manifestes signés « content credentials » ; nécessite un certificat ; **optionnel** (case à cocher à l'export). |
| **Sidecar JSON par asset** + `project.json` | — | — | 1 | Dossier = projet (`assets/<id>/v3.png`, `v3.json`), chemins relatifs, ZIP = export/import ; le Markdown (lore, scénario) reste en fichiers texte versionnables par git. |
| **Store adressé par contenu + snapshots** | — | — | 2 | `blobs/<sha256>` dédupliqué + `snapshots/<date>.json` (liste id→sha) : « git pour assets » suffisant, sans dépendance. **DVC** (Apache-2.0) est conçu pour la data science (remotes S3, cache) — surdimensionné ici ; **git LFS** possible pour les équipes. |
| **SQLite** (index) : tables `assets`, `derivations` (DAG « Made from »), `jobs`, `models` ; **FTS5** (intégré) pour prompts/tags/notes ; **sqlite-vec** | github.com/asg017/sqlite-vec | **Apache-2.0 / MIT** | 2 | sqlite-vec 8 k★, **pré-v1** (API susceptible de changer) : vecteurs float/int8/binaires, KNN, colonnes de métadonnées, bindings Python. Embeddings via CLIP/SigLIP en ONNX (open_clip MIT ; SigLIP Apache-2.0) → « assets similaires », « trouver un sprite qui ressemble ». Tags automatiques : WD14 tagger (Apache-2.0) ; légendes : Florence-2 (MIT). |
| **Miniatures** | Pillow | — | 1 | Génération à l'ingestion (nearest-neighbor pour le pixel art !), cache `thumbs/<id>_<size>.webp`. |

### 3.6 Abstraction des fournisseurs d'images cloud et coûts

| Nom | URL | Licence | Complexité | Limites | Notes |
|---|---|---|---|---|---|
| **OpenRouter Images API** | openrouter.ai/docs/features/multimodal/image-generation | API | 1 | Pas d'édition/inpaint dédiée (mais `input_references` pour l'image-to-image) | `POST /api/v1/images` : `model`, `prompt`, `resolution` (512/1K/2K/4K), `aspect_ratio`, `quality`, `output_format`, `n` ≤ 10, `input_references` ; réponse base64 + `usage` ; **facturation seulement en cas de succès** ; modèles GPT-Image, Gemini image, Seedream, FLUX. Un seul compte/clé pour plusieurs fournisseurs = **le bon premier adaptateur**. Prix par modèle exposés dans `/api/v1/models`. |
| **Google `google-genai`** (Gemini image / Imagen) | github.com/googleapis/python-genai | Apache-2.0 | 1 | Quotas | Édition multi-images par référence (cohérence de personnage). |
| **OpenAI `openai`** (`images.generate` / `images.edit`, gpt-image) | github.com/openai/openai-python | Apache-2.0 | 1 | Coût | Édition avec masque = inpaint cloud de qualité. |
| **fal.ai (`fal-client`)** | github.com/fal-ai/fal | MIT (client, à vérifier) | 1 | Prix par image/mégapixel selon modèle | Catalogue FLUX/Recraft/Ideogram/Qwen ; files et webhooks. |
| **Replicate (`replicate`)** | github.com/replicate/replicate-python | Apache-2.0 | 1 | Facturation à la seconde pour certains modèles → coût non prédictible | Bon pour les modèles ouverts exotiques. |
| **Stability API** | platform.stability.ai | API | 1 | — | Inpaint/outpaint/remove-bg/upscale prêts à l'emploi. |
| **LiteLLM** | github.com/BerriAI/litellm | **MIT** (dossier `enterprise` sous licence séparée) | 2 | `image_generation` / `image_edit` couvrent OpenAI, Azure, Bedrock, Vertex/Gemini, Recraft… (à vérifier modèle par modèle) ; **pas fal/Replicate/OpenRouter-images** ; grosse dépendance | Utile pour la partie **LLM texte** (lore, prompts) + suivi de coût ; pour l'image, un adaptateur maison est plus léger. |
| **any-llm** (mozilla-ai) | github.com/mozilla-ai/any-llm | Apache-2.0 | 1 | Orienté chat | Alternative légère à LiteLLM pour le texte. |
| **tenacity** (retries), **aiolimiter** (quotas), **httpx** | github.com/jd/tenacity ; github.com/mjpieters/aiolimiter | Apache-2.0 ; MIT | 1 | — | Backoff exponentiel sur 429/5xx, limiteur par fournisseur, budget journalier configurable. |

**Recommandation.** Protocole Python `ImageProvider` (`capabilities`: txt2img/img2img/edit/mask/references/max_res ; `estimate(request) -> Cost` ; `generate(request) -> AsyncIterator[Event]`) ; adaptateurs OpenRouter (prioritaire), Gemini, OpenAI, fal, Replicate ; table de prix en JSON (auto-mise à jour OpenRouter + statiques) ; journal `costs` en SQLite par projet ; « coût avant clic » + quota mensuel réglable.

### 3.7 MCP dans le même processus FastAPI

| Nom | URL | Licence | Maturité | Complexité | Notes |
|---|---|---|---|---|---|
| **mcp (SDK Python officiel)** | github.com/modelcontextprotocol/python-sdk | **MIT** | 23,4 k★, v1.x stable (v2 alpha) | 2 | `FastMCP` inclus ; `mcp.streamable_http_app()` monté avec `Mount("/mcp", ...)` + lifespan `mcp.session_manager.run()` ; type `Image` ; `ctx.report_progress(progress, total, message)` ; ressources et prompts. |
| **fastmcp (jlowin)** | github.com/jlowin/fastmcp | **Apache-2.0** | 27,5 k★, très actif | 2 | Sur-ensemble : `mcp.http_app()` ASGI, **`FastMCP.from_fastapi(app)`** (génère les outils depuis nos routes OpenAPI — pratique mais à filtrer), composition/proxy de serveurs, auth, « Apps » (UI dans la conversation). |
| Patterns d'outils agentiques (SpriteCook / PixelLab) | — | — | — | 2 | Peu d'outils **verbes** bien décrits (`generate_sprite`, `animate`, `make_tileset`, `remove_background`, `slice`, `export_godot`) + outils **jobs** (`check_job`, `cancel_job`, `list_recent_assets`) + `get_preset_settings` / `list_models` (avec coût) + `report_integration_error`. Retourner **image (réduite) + JSON (id, chemin absolu, dimensions, coût)**. Ressources `asset://{id}` et `project://{id}/codex`. |
| Distribution aux agents | docs.claude.com/en/docs/claude-code/plugins ; cursor `mcp.json` | — | — | 1 | HTTP streamable `http://127.0.0.1:PORT/mcp` (une ligne dans `claude mcp add --transport http`), + lanceur stdio `gamekit mcp` qui proxy vers HTTP pour les clients sans HTTP ; **plugin Claude Code** (`.claude-plugin/plugin.json` + `.mcp.json` + `skills/` décrivant les workflows) ; Cursor/Windsurf via `mcp.json`. |

### 3.8 Packaging / distribution

| Nom | URL | Licence | Complexité | Limites | Notes |
|---|---|---|---|---|---|
| **uv** (+ python-build-standalone) | github.com/astral-sh/uv | MIT / Apache-2.0 | 1 | — | Installe un Python isolé et les roues torch de la bonne variante (`--index https://download.pytorch.org/whl/cu128` / `rocm` / `cpu`) au premier lancement ; c'est ce que font Comfy-Desktop, unity-mcp, blender-mcp. |
| **pixi** | github.com/prefix-dev/pixi | BSD-3 | 2 | Écosystème conda | Gère nativement les **variantes CUDA** (`system-requirements: cuda`) et les binaires non-Python (ffmpeg, sd.cpp) : bon pour des « packs moteur » reproductibles. |
| **Tauri 2** (coquille + sidecar) | tauri.app/develop/sidecar | MIT / Apache-2.0 | 3 | Rust à compiler ; WebView système (variations) | `externalBin` lance notre serveur ; installeurs signés, **updater intégré**, petit binaire (~10 Mo). Alternative : **pas de coquille** (navigateur + icône de zone de notification via `pystray`) en v1. |
| **Electron** | electronjs.org | MIT | 3 | ~150 Mo | Choix de LDtk, Twine, Comfy-Desktop ; Chromium garanti. |
| **PyInstaller** / **Nuitka** / **pyapp** / **briefcase** | pyinstaller.org ; nuitka.net ; github.com/ofek/pyapp ; beeware.org | GPL-2.0 avec exception (OK) / Apache-2.0 / MIT / BSD-3 | 2-3 | torch dans un binaire = énorme et fragile | Ne figer que **le cœur** (FastAPI + front statique + sd.cpp) ; installer torch/diffusers ensuite via uv dans un venv (« packs moteur »). |
| **Docker** | — | Apache-2.0 | 2 | GPU passthrough NVIDIA seulement | Pour Linux/serveur et pour les tests CI. |
| **Pinokio** / **StabilityMatrix** | voir § 3.4 | MIT (à vérifier) / AGPL | — | — | Publier une **recette Pinokio** est un canal de distribution gratuit vers les utilisateurs IA. |

**Recommandation.** v1 : `pipx`/`uvx gamekit` + installeurs Tauri optionnels ; au premier lancement, **assistant matériel** (détecte NVIDIA/AMD/Intel/Apple/CPU, VRAM) → propose un « pack moteur » (sd.cpp toujours ; diffusers CUDA si NVIDIA ; ComfyUI sidecar en option) et les modèles de base ; mises à jour par GitHub Releases ; **aucune télémétrie** (pas même de « ping » de version sans opt-in explicite).

### 3.9 Tests d'images et qualité continue

| Nom | URL | Licence | Complexité | Notes |
|---|---|---|---|---|
| **pytest-regressions** (`image_regression`) | github.com/ESSS/pytest-regressions | MIT | 1 | Snapshots d'images avec tolérance ; régénération par `--force-regen`. |
| **pixelmatch** (port Python) | github.com/whtsky/pixelmatch-py | ISC (à vérifier) | 1 | Diff perceptuel pixel à pixel + image de diff : parfait pour le pixel art (grille exacte). |
| **scikit-image** `structural_similarity` | scikit-image.org | BSD-3 | 1 | SSIM pour les images HD. |
| **ImageHash** | github.com/JohannesBuchner/imagehash | BSD-2 | 1 | pHash/dHash pour détecter les doublons et les dérives. |
| **Métriques pixel art maison** | — | — | 2 | Score de grille (pixeldetector), nombre de couleurs vs palette, propreté des bords alpha, symétrie ; utilisées en test **et** en curation. |
| **Évaluation continue** | — | — | 3 | Jeu d'or de 50 prompts × seeds fixes par moteur, CLIP/SigLIP score + métriques pixel, exécuté en job nocturne local (pas en CI GitHub sans GPU) ; rapport HTML versionné. |

---

## 4. Idées malines

1. **Copier le triptyque Krita AI « managé / serveur custom / cloud »** : l'utilisateur choisit où tourne le calcul, l'UI ne change pas.
2. **Le PNG est la base de données** : notre chunk `gamekit` dans chaque export ; glisser un PNG sur l'app = recharger prompt, modèle, seed, lignée. Compatible A1111/ComfyUI via `sd-parsers` à l'import.
3. **`FastMCP.from_fastapi()` puis élagage** : les 43 outils de SpriteCook deviennent ~15 outils-verbes bien décrits, générés depuis la même couche de service que l'UI (une seule source de vérité).
4. **Extensions hôtes légères** (Aseprite Lua, Pixelorama GDScript, Krita Python, Godot EditorPlugin) qui ne font que POST/GET vers `127.0.0.1:PORT` : distribution virale sans porter le moteur.
5. **Personnage paramétrique façon LPC** : l'IA génère une fois les calques (corps, cheveux, tenues) en respectant un gabarit ; ensuite composition + palette swap par LUT en NumPy, zéro GPU, variantes infinies, crédits automatiques.
6. **Coût avant clic** alimenté par `openrouter.ai/api/v1/models` (prix) et par une calibration locale (secondes/mégapixel) : même bouton, deux estimations.
7. **Playground Godot headless / Bitsy-like** : après génération d'un tileset ou d'un personnage, un bouton « Jouer » ouvre un mini-niveau (WebGL export Godot ou canvas Phaser MIT) — la validation la plus convaincante qui soit.
8. **Autotile validé automatiquement** : générer les 47 tuiles blob/Wang, vérifier les coutures par différence de bords, corriger par inpainting ciblé, exporter `.tsx` (Wang set) + `.ldtk` (règles) + `.tres` (TileSet Godot avec terrains).
9. **Snapshots d'installation** (idée ComfyUI-Manager) : `environment.json` (versions de moteurs, nœuds, modèles + hashes) exportable pour reproduire un rendu sur une autre machine.
10. **Worker GPU jetable** : sous-processus par moteur, relancé sur OOM, ce qui permet aussi le « hot swap » ComfyUI ↔ diffusers ↔ sd.cpp sans redémarrer l'app.
11. **Styles JSON versionnés** (Krita AI / Fooocus) partagés par un simple dépôt git communautaire, avec vignette et licence du modèle requis.
12. **Vignettes en nearest-neighbor** et aperçu ×N intégré (le piège classique des galeries d'IA qui floutent le pixel art).
13. **Normal maps automatiques à l'export** (`sprite_n.png`) + preset de lumière Godot : « éclairage 2D » devient une case à cocher.
14. **Découpe parallax par profondeur** : Depth Anything V2 Small (Apache-2.0) + seuils → 3-4 plans + inpainting des trous → `parallax.json` (vitesses).
15. **Grid generator** (SwarmUI) pour comparer modèles/seeds/styles sur le même prompt avec la même grille de pixels.
16. **Tagging automatique à l'ingestion** (WD14 + Florence-2 en ONNX) → recherche FTS5 immédiate ; embeddings SigLIP → « similaires » via sqlite-vec.
17. **Licence des modèles en première classe** : le manifeste porte SPDX/Civitai ; l'export d'asset pack génère `LICENSES.md` avec la chaîne complète (modèle, LoRA, assets de base LPC/Kenney).
18. **Frames intermédiaires par RIFE (MIT) puis re-pixelisation** pour passer de 4 à 8 images d'animation à bas coût (voir fiche 06).

---

## 5. Architecture cible recommandée

```
┌──────────────────────────────── Poste utilisateur ────────────────────────────────┐
│                                                                                   │
│  [Coquille optionnelle Tauri 2 / navigateur]                                      │
│     Front React 19 + TS + Vite + Tailwind 4 + @xyflow (graphe de workflow,        │
│     Codex, moodboard, atelier canvas, timeline, tuiles, UI kit, audio)            │
│           │ HTTP REST /api/*        │ WS /ws/events (jobs, previews, téléch.)     │
│           ▼                         ▼                                             │
│  ╔════════════════ Processus "core" : FastAPI + Uvicorn (Python 3.11) ═══════════╗│
│  ║  Routes REST ── Services (assets, projets, codex, presets, coûts) ── MCP      ║│
│  ║                                                                  /mcp (HTTP   ║│
│  ║  JobQueue asyncio + SQLite (états, priorités, annulation, reprise)  streamable║│
│  ║      │                                                            + stdio     ║│
│  ║      ├─ GpuLease (1 job GPU à la fois) ── ModelSlots LRU           proxy)     ║│
│  ║      │                                                                        ║│
│  ║  Engines (Protocol) ─┬─ DiffusersWorker  ──► [sous-processus torch, Apache]   ║│
│  ║                      ├─ SdCppEngine      ──► [stable-diffusion.cpp, MIT]      ║│
│  ║                      ├─ ComfyEngine (opt) ─► [ComfyUI sidecar, GPL, HTTP/WS]  ║│
│  ║                      ├─ CloudEngine      ──► OpenRouter / Gemini / OpenAI /   ║│
│  ║                      │                       fal / Replicate (httpx+tenacity) ║│
│  ║                      └─ OnnxTools        ──► rembg/BiRefNet, Depth Anything,  ║│
│  ║                                              WD14, SigLIP (onnxruntime)       ║│
│  ║  PixelOps (Pillow/NumPy/PixelOE) : grille, palette, dithering, slicing,       ║│
│  ║      9-slice, normal maps, LUT palette swap, compositeur de calques           ║│
│  ║  ModelManager : manifestes JSON, HF/Civitai, sha256, licences,               ║│
│  ║      extra_model_paths.yaml / liens symboliques                               ║│
│  ║  AssetStore : dossier projet + sidecar JSON + chunk PNG `gamekit`             ║│
│  ║      + blobs/<sha256> + snapshots ; SQLite (assets, derivations DAG,          ║│
│  ║      jobs, models, costs) + FTS5 + sqlite-vec ; miniatures nearest            ║│
│  ║  Exporters : Godot (.tres/.tscn), Tiled (.tsx/.tmx), LDtk, Phaser/Unity      ║│
│  ║      atlas JSON, Defold, Aseprite .ase, asset pack ZIP + LICENSES.md          ║│
│  ╚═══════════════════════════════════════════════════════════════════════════════╝│
│           ▲ extensions hôtes (Aseprite Lua, Pixelorama, Krita, Godot plugin)      │
│           ▲ agents (Claude Code plugin, Cursor mcp.json) ─► /mcp                  │
│  Données : ~/.local/share/gamekit/{models,engines,cache}  +  <projet>/ (portable) │
└───────────────────────────────────────────────────────────────────────────────────┘
```

**Alternatives évaluées.**
- *A. ComfyUI comme moteur unique* (modèle Krita AI) : écosystème maximal, mais dépendance à un projet GPL au rythme hebdomadaire et installation lourde pour les utilisateurs CPU/AMD. Retenu **en option**, pas en socle.
- *B. Tout in-process (diffusers dans FastAPI)* : le plus simple à coder, mais un OOM tue l'app et le GIL freine l'UI → rejeté au profit du sous-processus.
- *C. Workers Huey/SQLite multi-processus* : à adopter si l'on veut plusieurs jobs CPU en parallèle des jobs GPU sans réécrire la file ; compatible avec le schéma ci-dessus (Huey remplace la table `jobs` maison).
- *D. Notre UI comme extension du front ComfyUI* : rejeté (GPL-3.0 du frontend, UX contrainte).

---

## 6. Ce qu'il faudrait développer soi-même

1. **La couche `Engine`/`ImageProvider`** et ses adaptateurs (diffusers worker, sd.cpp, ComfyUI client type Krita AI, cloud) — rien d'open source ne l'offre en Apache/MIT prêt à l'emploi (Krita AI est GPL ; SwarmUI est en C#).
2. **La file de jobs SQLite** avec progression/annulation/reprise et le bus d'événements WS/SSE (≈ 500 lignes, inspiré d'InvokeAI).
3. **Le model manager** (manifestes, licences, téléchargements, hash, partage `extra_model_paths.yaml`) — en réutilisant les idées (et éventuellement du code Apache) d'InvokeAI.
4. **La suite PixelOps** (fiche 02) : détection de grille, palettize + dithering, K-centroid, nettoyage alpha, outline, slicing/9-slice, **compositeur de calques + palette swap LUT** (LPC), **normal maps**.
5. **Générateur de tilesets** (Wang/blob, vérification des coutures, tuiles animées) et **exporteurs** Tiled/LDtk/Godot/Phaser/Defold + **lecteur/écrivain `.ase`** (spec publique).
6. **Générateur de VFX flipbook** procédural (nœuds @xyflow → NumPy) et pipeline 3D→pixel via Godot/Blender headless (optionnel).
7. **Provenance** : chunk PNG `gamekit`, DAG « Made from », snapshots, import via sd-parsers ; **recherche** FTS5 + sqlite-vec + tagging ONNX.
8. **MCP** : ~15 outils-verbes + jobs + ressources, plugin Claude Code (skills décrivant les workflows Character/Tileset/UI Kit), lanceur stdio.
9. **Estimateur de coût/temps** (calibration locale + prix cloud) et journal des dépenses.
10. **Pack de nœuds ComfyUI GPL** séparé (échange d'images, régions, tuiles) si l'option ComfyUI est retenue — ou réutilisation directe de `comfyui-tooling-nodes` (GPL, côté ComfyUI seulement).
11. **Extensions hôtes** : Aseprite (Lua), Pixelorama (GDScript), Godot (EditorPlugin) — ~200 lignes chacune, appel HTTP local.
12. **Installeur / assistant matériel** (uv + packs moteur + manifestes) et updater.
13. **Playground** (export Godot WebGL ou Phaser MIT) et **banc d'évaluation** (jeu d'or, métriques pixel art, rapport).

---

## 7. Sources (URL)

Intégrations IA / moteurs : https://github.com/Acly/krita-ai-diffusion · https://docs.interstice.cloud/ · https://docs.interstice.cloud/comfyui-setup · https://github.com/Acly/comfyui-tooling-nodes · https://github.com/invoke-ai/InvokeAI · https://github.com/comfyanonymous/ComfyUI · https://docs.comfy.org/development/comfyui-server/comms_overview · https://github.com/Comfy-Org/ComfyUI-Manager · https://github.com/Comfy-Org/comfy-cli · https://github.com/Comfy-Org/desktop · https://github.com/Comfy-Org/Comfy-Desktop · https://github.com/vladmandic/sdnext · https://github.com/lllyasviel/stable-diffusion-webui-forge · https://github.com/lllyasviel/Fooocus · https://github.com/mcmonkeyprojects/SwarmUI · https://github.com/carson-katri/dream-textures · https://github.com/AbdullahAlfaraj/Auto-Photoshop-StableDiffusion-Plugin · https://github.com/leejet/stable-diffusion.cpp · https://github.com/huggingface/diffusers · https://github.com/danielgatis/rembg · https://github.com/ZhengPeng7/BiRefNet · https://huggingface.co/briaai/RMBG-2.0

Pixel art / nœuds : https://github.com/KohakuBlueleaf/PixelOE · https://github.com/dimtoneff/ComfyUI-PixelArt-Detector · https://github.com/WuZongWei6/Pixelization · https://github.com/Astropulse/pixeldetector · https://github.com/Orama-Interactive/Pixelorama · https://github.com/LibreSprite/LibreSprite · https://github.com/aseprite/aseprite/blob/main/EULA.txt · https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md · https://github.com/piskelapp/piskel · https://github.com/azagaya/laigter · https://github.com/effekseer/Effekseer

Générateurs IA (référence) : https://www.retrodiffusion.ai/ · https://astropulse.gitbook.io/retro-diffusion/llms.txt · https://www.pixellab.ai/ · https://github.com/pixellab-code/pixellab-mcp

MCP game dev : https://github.com/Coding-Solo/godot-mcp · https://github.com/CoplayDev/unity-mcp · https://github.com/ahujasid/blender-mcp · https://github.com/diivi/aseprite-mcp · https://github.com/jlowin/fastmcp · https://github.com/modelcontextprotocol/python-sdk

Pipeline game dev : https://github.com/mapeditor/tiled · https://github.com/deepnight/ldtk · https://github.com/defold/defold · https://github.com/increpare/PuzzleScript · https://github.com/klembot/twinejs · https://github.com/le-doux/bitsy · https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator

Orchestration / stockage / cloud : https://github.com/python-arq/arq · https://github.com/coleifer/huey · https://github.com/Bogdanp/dramatiq · https://github.com/procrastinate-org/procrastinate · https://github.com/asg017/sqlite-vec · https://openrouter.ai/docs/features/multimodal/image-generation

*Éléments marqués « à vérifier » : la limite de requêtes web de la session a été atteinte avant de confirmer les licences exactes de rx, Sprytile, Pixel Composer, StabilityMatrix, Pinokio, sd-parsers, c2pa-python, pixelmatch-py, RQ, fal-client, et la liste précise des fournisseurs image de LiteLLM.*
