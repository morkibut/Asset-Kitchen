# 08 — Tuiles, tilesets autotile et textures sans couture

> Domaine : création de tuiles et de tilesets pour décors 2D (pixel art en priorité, HD ensuite) et textures seamless. Contrainte : solutions open source uniquement (licence indiquée à chaque fois) ; les outils propriétaires ne sont cités qu'en référence, marqués **[PROPRIÉTAIRE]**.
>
> Méthode : vérification directe des dépôts GitHub, docs officielles (Godot, Tiled, LDtk), cartes de modèles Hugging Face et pages produits, septembre 2026. Les points non vérifiés sont marqués « à vérifier ».
>
> Cible technique rappelée : backend Python 3.11 / FastAPI / Pillow + NumPy, front React 19 + TS, GPU 8 Go ou CPU, API image acceptable. Philosophie : **IA pour générer → algorithmes pour retravailler → retouche manuelle**. Objectif : des tuiles **réellement utilisables** pour construire un décor, pas des images.

---

## 1. Problèmes et verrous

| # | Verrou | En clair |
|---|--------|----------|
| P1 | **Choisir et représenter le format d'autotile** | 16 tuiles (4 bits), 47 tuiles « blob » (8 bits réduits), dual-grid (15/16 tuiles), Wang edge/corner, RPG Maker A2 (2×3 mini-tuiles), iso, hex. Chaque moteur (Godot, Tiled, LDtk, Unity, Phaser) nomme et stocke ces formats différemment. Sans une représentation interne unique, on ne peut ni convertir ni exporter proprement. |
| P2 | **Obtenir un set complet à partir de peu d'éléments** | L'IA produit bien 1 à 6 tuiles cohérentes, beaucoup moins 47. Il faut fabriquer les 47 (ou 16) par assemblage de sous-tuiles (quadrants) et par compositing par masques. |
| P3 | **Faire respecter un gabarit à l'IA** | Le modèle génère une image plus grande que la sortie (comme SpriteCook), avec des bords qui ne tombent pas sur la grille ; il faut guider (ControlNet, img2img sur gabarit, inpainting cellule par cellule), recaler et découper. |
| P4 | **Textures sans couture** | Générer directement seamless (padding circulaire), rendre seamless une image existante (offset + inpainting, quilting, Poisson), et **mesurer** la couture (score) pour décider automatiquement d'une correction. |
| P5 | **Cohérence intra-set** | Même palette, même éclairage, bords qui se raccordent réellement entre deux tuiles voisines. Il faut vérifier automatiquement (comparaison de bandes de pixels) et corriger (edge harmonization). |
| P6 | **Tester la « jouabilité » du tileset** | Un tileset n'est validé que sur une carte : playground de peinture avec autotiler, génération WFC de cartes de test, prévisualisation 3×3 pour les textures. |
| P7 | **Exports moteurs exacts** | Godot `.tres` (terrain set + peering bits), Tiled `.tsx` (wangsets), LDtk (règles auto-layer), Unity Rule Tile. La structure doit être exacte au caractère près. |
| P8 | **Le reste du décor** | Props isolés, couches de parallax (séparation par profondeur + inpainting), tuiles animées (eau/herbe), variantes anti-répétition, sprite stacking. |
| P9 | **Contraintes pixel-art** | 16/32 px, palette réduite, conventions 3/4 top-down (élévation, bord bas visible), plateformes (edges, pentes), génération à ×k puis réduction nearest. |

---

## 2. Solutions par problème

### P1 — Formats d'autotile : théorie et correspondances moteurs

**Rappel des formats (vérifié sur le guide interactif Red Blob Games et les docs moteurs) :**

- **4 bits / 16 tuiles** : voisins N/E/S/W → 2⁴ = 16 combinaisons. Gère les bords, pas les coins intérieurs. Tiled : *Edge set* (16 tuiles pour 2 terrains). Godot : *Match Sides*. C'est le format « platformer autotile-16-set » de SpriteCook (lignes = connexions haut/bas, colonnes = gauche/droite).
- **8 bits / 47 tuiles « blob »** : 8 voisins → 256, réduits à 47 par la règle « une diagonale ne compte que si ses deux voisins cardinaux sont présents ». Tiled : *Mixed set* (256 tuiles théoriques, 47 en pratique). Godot : *Match Corners and Sides* (`TERRAIN_MODE_MATCH_CORNERS_AND_SIDES = 0`). LDtk : règles 3×3. Unity : Rule Tile 8 voisins.
- **Corner-Wang / 2×2 / 16 tuiles** : chaque tuile est définie par ses 4 coins. Tiled : *Corner set* (16 tuiles pour 2 terrains). Godot : *Match Corners* (`= 1`).
- **Dual-grid** : les tuiles affichées sont dessinées sur une grille décalée d'une demi-tuile ; chaque tuile affichée couvre exactement 4 cellules de données → masque 4 bits → 16 tuiles (15 dessinées, la « toute vide » est transparente). Résout les coins intérieurs avec 15 tuiles au lieu de 47. Le « 15-piece » de SpriteCook est exactement ce layout (4×4, une case vide), et Godot/Tiled/Unity l'utilisent en mode « match corners ».
- **Mini-tuiles / RPG Maker A2** : chaque tuile est coupée en 4 quadrants ; un quadrant ne dépend que de 3 voisins (2³ = 8 états, ~5 formes uniques). Un bloc 2×3 de mini-tuiles suffit pour reconstituer les 47 tuiles.
- **Wang tiles** (Cohen 2003) : couleurs sur arêtes ou coins, permettent des pavages apériodiques ; **Herringbone Wang** (Sean Barrett, `stb_herringbone_wang_tile.h`, domaine public) réduit encore la répétition visible.
- **Isométrique / hex** : Godot 4 gère `TILE_SHAPE_ISOMETRIC`, `HALF_OFFSET_SQUARE`, `HEXAGON` et les layouts `STACKED`, `STAIRS_*`, `DIAMOND_*` ; TileMapDual gère aussi le dual-grid iso et hex.

**Correspondances utiles (tableau à encoder dans la lib interne) :**

| Concept interne | Godot 4 | Tiled | LDtk | Unity |
|---|---|---|---|---|
| Blob 47 (8 voisins) | terrain set `mode = 0` (corners and sides), 8 peering bits | wangset `type="mixed"`, `wangid` à 8 entrées | 47 règles 3×3 (générables) | Rule Tile 8 voisins |
| Corner 16 / dual-grid | `mode = 1` (match corners), 4 corner bits | wangset `type="corner"` | règles 3×3 sur coins | Rule Tile coins |
| Edge 16 (platformer) | `mode = 2` (match sides), 4 side bits | wangset `type="edge"` | règles 3×3 sur côtés | Rule Tile côtés |

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité/limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Red Blob Games — Autotiling guide | https://www.redblobgames.com/articles/autotile/claude/ | CC (contenu) | — | référence | stable | — | 1 | Toutes les formules bitmask, 16/47/256, dual-grid, mini-tuiles | Base théorique à implémenter |
| SpriteCook Tileset Base Generator | https://github.com/SpriteCook/spritecook-tileset-gen | MIT | HTML/JS (1 fichier) | générateur de gabarit | jeune (3 étoiles) | CPU | 1 | 15-piece 4×4, 17-piece (5×5 selon le repo : + tuile seule, traits V/H, îlot 3×3, croix inner-corner), iso 2:1 ; 16/32/64 px ; bruit d'arête paramétrable | Encodage : quadrants remplis, union « légèrement au-delà du centre » pour que les diagonales se touchent. À porter en NumPy |
| bitbutter tileset-template-generator | https://github.com/bitbutter/tileset-template-generator | non précisée (à vérifier) | HTML/JS | générateur de gabarit blob | ancien | CPU | 1 | Planches blob avec spec.md | Utile pour l'ordre canonique des 47 |
| stb_herringbone_wang_tile.h | https://github.com/nothings/stb/blob/master/stb_herringbone_wang_tile.h | domaine public / MIT-like | C | Wang herringbone | stable | CPU | 2 | Génère gabarit + carte au runtime | Pour anti-répétition avancée |
| TileMapDual (Godot 4) | https://github.com/pablogila/TileMapDual | MIT | GDScript | addon dual-grid | actif (1,1 k ★, v5, hex) | — | 2 | Carré/iso/hex ; 15 tuiles ou 6 si symétrie | Référence d'implémentation dual-grid ; cible d'export |
| dual-grid-tilemap-system-godot | https://github.com/jess-hammer/dual-grid-tilemap-system-godot | MIT | C# (Godot 4.4) | addon dual-grid | actif (582 ★) | — | 2 | 16 tuiles 4×4 codées en dur | Layout 4×4 de référence |
| Excalibur.js — Dual Tilemap Autotiling | https://excaliburjs.com/blog/Dual%20Tilemap%20Autotiling%20Technique/ | BSD-2 (moteur) | TS | article + moteur | stable | — | 2 | 5 formes + rotations = 6 tuiles | Bon pour un mode « symétrique » |
| Godot TileSet (API) | https://github.com/godotengine/godot (doc/classes/TileSet.xml) | MIT | C++ | moteur | stable | — | 2 | Enums `TerrainMode`, `CellNeighbor` (0-15), `TileShape`, `TileLayout` | Voir P7 pour la sérialisation |
| Tiled (terrain sets) | https://doc.mapeditor.org/en/stable/manual/terrain/ | GPL-2.0 (appli) / BSD (libtiled) | C++/Qt | éditeur | stable (1.12.2, mai 2026, 12,7 k ★) | — | 1 | Corner 16 / Edge 16 / Mixed 256→47 ; probabilités ; flips auto depuis 1.5 | Cible d'export |
| LDtk | https://github.com/deepnight/ldtk | MIT | Haxe/Electron | éditeur | stable (4,1 k ★) | — | 2 | Auto-layers par règles 1/3/5/7, IntGrid | Cible d'export (règles en JSON) |
| Tilesetter **[PROPRIÉTAIRE]** | https://www.tilesetter.org/ | commercial | — | générateur de tilesets | — | — | — | Successeur de Tilemancer ; sets à partir de quelques tuiles | Référence UX seulement |
| Sprite Fusion, AutoTileGen, Pyxel Edit, TileKit **[PROPRIÉTAIRES]** | — | commercial / gratuit fermé | — | éditeurs | — | — | — | Auto-tiling « smart tiles », export Godot/Unity/Tiled | Référence UX seulement |

**Recommandation P1.** Représentation interne unique : chaque tuile = `(terrain_id, mask)` avec `mask` sur 8 bits en ordre Godot (`right_side, bottom_right_corner, bottom_side, bottom_left_corner, left_side, top_left_corner, top_side, top_right_corner`) et un jeu de fonctions pures de conversion (`blob47 ↔ dualgrid16 ↔ edge16 ↔ rpgmaker_a2 ↔ wangid_tiled ↔ ldtk_pattern`). Adopter le **dual-grid 15-piece comme format « pivot » de génération** (voir P2), et le **blob 47 comme format « pivot » d'export** (il est compris par tous les moteurs).

### P2 — Générer un set complet à partir de peu d'éléments

Le principe fondamental, validé par tous les outils ci-dessous : **un tileset 47 n'est jamais dessiné, il est assemblé** à partir de 5 à 13 tuiles sources en découpant des quadrants (mini-tuiles) ou en compositant des masques.

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité/limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| TilePipe2 | https://github.com/aleksandrbazhin/TilePipe | MIT | GDScript (+Python, GLSL) | assembleur par règles | alpha 7 (déc. 2022), 73 ★ | CPU | 3 | 8 parts (avec symétrie) à 13 parts → blob 47, 16, 256 ; rulesets JSON personnalisables ; export Godot 3 | Les **rulesets JSON** (quel quadrant vient de quelle part) sont le vrai trésor à réutiliser |
| autotiler (itsjavi) | https://github.com/itsjavi/autotiler | MIT | JS / Electron | assembleur | 70 ★, 2023 | CPU | 2 | 13 tuiles Wang (5×3) → 47 + `.tres` Godot 3 avec bitmask et collisions | Logique de mapping 13→47 réutilisable en TS |
| autotile_generator (HeartoLazor) | https://github.com/HeartoLazor/autotile_generator | MIT | Python | assembleur par quadrants | stable, ancien | CPU | 2 | Gabarit de 20 tuiles (fill, coins, V, H, inner) → 47 par 4 quarts ; gère des lignes de variations ; mapping JSON | **Le plus proche de notre stack** (Python, Pillow). Point de départ direct |
| instatileset | https://github.com/escualina/instatileset | GPL-3.0 | GDScript | éditeur 5 → 47 | actif (57 ★, 2026) | CPU | 2 | Dessin sur 5 tuiles, génération auto des 47, outil de lignes de coupe | GPL → référence d'algorithme, pas de copie de code |
| AutotileGenerator (ticial) | https://github.com/ticial/AutotileGenerator | non précisée | (Godot) | assembleur | petit | CPU | 2 | 5 tuiles → 2×2 / 3×3 minimal ; 8 → 3×3 | Sans licence → ne pas réutiliser le code |
| autotiler (krylphi) | https://github.com/krylphi/autotiler | MIT | Go | déplieur RPG Maker | 2024 | CPU | 1 | 2×3 (A2) → 16 / 28 / 48 tuiles, padding | Utile pour importer des tilesets A2 existants |
| Wangscape | https://github.com/Wangscape/Wangscape | MIT | C++ (Boost, SFML, Armadillo, Qt5, libnoise) | compositing Wang par masques bruités | Procjam 2016, 68 ★, dépendances lourdes | CPU | 4 | Entrée : tuiles de terrain + JSON de « cliques » ; sortie : Wang corner tilesets avec transitions courbes générées par bruit | Ne pas l'intégrer tel quel (build lourd) ; **reproduire l'algorithme en NumPy** (masques de coin + bruit de Perlin/valeur + blend) |
| Better Terrain (Godot 4) | https://github.com/Portponky/better-terrain | Unlicense | GDScript | addon terrain | actif (741 ★) | — | 2 | Match tiles / match vertices / catégories / décoration ; API runtime | Cible d'export secondaire ; montre les limites du terrain natif Godot |
| terrain-autotiler | https://github.com/dandeliondino/terrain-autotiler | MIT | GDScript | matching terrain Godot 4 | **archivé avr. 2024** | — | 3 | Résout des cas non déterministes du terrain Godot | Référence d'algorithme de matching |
| AutoBlob (Aseprite) **[PROPRIÉTAIRE]** | https://community.aseprite.org/t/…/28606 | commercial (5,99 $) | Lua | extension | 2026 | — | — | 6 tuiles (intérieur, croix inner-corner, 4 coins d'un îlot 2×2) → blob 47 + edge 16 + JSON bitmask | Confirme le **minimum viable : 6 tuiles** si le matériau est symétrique |

**Comparaison.** Trois familles : (a) *quadrants* (HeartoLazor, TilePipe2, AutoBlob, instatileset) — rapide, pixel-exact, idéal pixel-art ; (b) *masques + bruit* (Wangscape) — transitions organiques, idéal HD et pour combiner deux surfaces ; (c) *IA directe* sur gabarit (SpriteCook, voir P3) — plus riche mais moins fiable.

**Recommandation P2.** Implémenter en Python/NumPy un **compositeur de quadrants** dont l'entrée est le **dual-grid 16** : chaque tuile blob 47 est la juxtaposition de 4 quadrants, et le quadrant haut-gauche d'une tuile ne dépend que des voisins N, W, NW — c'est exactement le quadrant central d'une tuile dual-grid dont les 4 coins valent (NW, N, W, centre). Donc **16 tuiles dual-grid ⇒ 47 tuiles blob sans aucune génération supplémentaire** (et 6 tuiles suffisent si on autorise flips/rotations). Ajouter ensuite le compositeur « masques + bruit » façon Wangscape pour le mode `two_surfaces` et pour les transitions multi-terrains (N terrains ⇒ tilesets de transition par paires).

### P3 — Faire respecter un gabarit à l'IA (génération de la planche)

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité/limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Diffusers (Hugging Face) | https://github.com/huggingface/diffusers | Apache-2.0 | Python | framework | stable | selon modèle | 2 | img2img, inpaint, ControlNet, IP-Adapter | Base du backend IA |
| ControlNet Tile SD1.5 | https://huggingface.co/lllyasviel/control_v11f1e_sd15_tile | CreativeML OpenRAIL-M | poids | ControlNet | stable | ~4-6 Go fp16 | 2 | Re-détaille une image floue/petite en conservant la structure | Parfait pour « gabarit flou → tuile détaillée » |
| ControlNet Tile SDXL (xinsir) | https://huggingface.co/xinsir/controlnet-tile-sdxl-1.0 | Apache-2.0 | poids (~1 B params fp16) | ControlNet | stable | SDXL fp16 ≈ 7-8 Go avec offload | 3 | Déblur, variation, upscale par tuiles | Licence la plus propre côté SDXL |
| ControlNet Canny SD1.5 / SDXL | https://huggingface.co/lllyasviel/ControlNet-v1-1 ; https://huggingface.co/diffusers/controlnet-canny-sdxl-1.0 | OpenRAIL-M / OpenRAIL++ | poids | ControlNet | stable | idem | 2 | Force les contours du gabarit (bords de tuiles, coins) | À combiner avec Tile |
| pixel-art-xl (LoRA) | https://huggingface.co/nerijs/pixel-art-xl | CreativeML OpenRAIL-M | LoRA SDXL | style | stable | SDXL | 1 | Réduire ×8 en nearest pour un pixel-perfect ; compatible LCM (8 pas) | Pixel-art crédible sans fine-tuning |
| FLUX.1-schnell | https://huggingface.co/black-forest-labs/FLUX.1-schnell | Apache-2.0 | poids 12 B | base | stable | 8 Go **uniquement** quantifié NF4/GGUF + offload CPU | 3 | Excellent en suivi de prompt ; pas d'inpaint/ControlNet officiel sous Apache (FLUX Fill/dev sont non-commerciaux) | Bon pour texture seamless brute ; moins pour inpaint |
| LaMa | https://github.com/advimman/lama | Apache-2.0 | Python | inpainting sans prompt | stable (10,1 k ★) | CPU possible | 2 | Généralise à ~2 k px ; convolutions de Fourier | Idéal pour boucher une couture ou compléter un fond |
| IOPaint | https://github.com/Sanster/IOPaint | Apache-2.0 | Python | UI + API inpaint | **archivé août 2025** (23,4 k ★), fonctionnel | CPU/GPU | 1 | LaMa, SD, PowerPaint, BrushNet ; batch CLI | Pour prototyper ; embarquer plutôt LaMa/diffusers directement |
| PyPatchMatch | https://github.com/vacancy/PyPatchMatch | MIT | C++/Python | inpainting PatchMatch | peu actif (130 ★) | CPU | 2 | Rapide, sans modèle ; cohérent en texture | Repli 100 % CPU |
| Tiled Diffusion (CVPR 2025) | https://github.com/madaror/tiled-diffusion | **non précisée** (à vérifier / contacter les auteurs) | Python | contrainte de tuilage dans la diffusion | recherche (82 ★) | SD1.5 ok 8 Go ; SDXL/SD3 avec offload | 4 | Self-tiling, one-to-one, **many-to-many** (plusieurs images qui se raccordent entre elles = Wang tiles par diffusion) ; ControlNet et Differential Diffusion supportés | La seule méthode qui génère **directement plusieurs tuiles mutuellement compatibles** ; licence à clarifier avant intégration |

**Trois stratégies IA à offrir (par ordre de fiabilité) :**

1. **Intérieur seamless d'abord, bords ensuite.** Générer la texture intérieure seamless (P4), puis pour chaque primitive dual-grid (16) : composer un canevas = gabarit (couleurs de base + noise) où la zone « terrain » est remplie par la texture seamless, et lancer un **inpaint masqué uniquement sur la bande de bord** avec ControlNet Canny du gabarit. L'intérieur reste pixel-identique entre toutes les tuiles ⇒ raccords garantis.
2. **img2img sur la planche complète** (approche SpriteCook) : gabarit 15/17-piece généré à ×4 (ex. 32 px → 128 px par tuile) → img2img force 0,5-0,7 + ControlNet Tile/Canny → recalage par corrélation croisée avec le gabarit → découpe. Plus « libre », mais chaque tuile peut dériver ; **obligatoirement suivi du sanity check P5**.
3. **Inpainting cellule par cellule** avec contexte des voisins : on inpaint une cellule en laissant visibles ses 8 voisines déjà validées (ou leurs primitives) ; utile pour réparer une tuile isolée dans le playground.

**Recommandation P3.** Stratégie 1 par défaut (la plus « algorithmique »), stratégie 2 en mode « créatif », stratégie 3 pour la réparation locale. SD 1.5 + ControlNet Tile/Canny reste le meilleur ratio qualité/8 Go ; SDXL + pixel-art-xl + ControlNet Tile xinsir pour l'HD. Générer toujours à ×4 puis réduire en nearest et quantifier (P9).

### P4 — Textures sans couture : générer, corriger, mesurer

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité/limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Padding circulaire (patch Conv2d) | technique standard ; implémentée par ComfyUI-seamless-tiling et asymmetric-tiling | — | Python | génération seamless native | stable | celle du modèle | 1 | Remplacer `padding_mode='zeros'` par `'circular'` sur toutes les `nn.Conv2d` de l'UNet **et du VAE** ; tuilage X seul / Y seul en ne bouclant qu'un axe | 100 % compatible diffusers ; à réimplémenter (10 lignes) |
| ComfyUI-seamless-tiling | https://github.com/spinagon/ComfyUI-seamless-tiling | GPL-3.0 | Python | nœuds ComfyUI | actif (279 ★) | — | 1 | Seamless Tile, Circular VAE Decode, Offset Image ; X/Y indépendants | GPL → référence, ne pas copier ; réimplémenter |
| asymmetric-tiling-sd-webui | https://github.com/tjm35/asymmetric-tiling-sd-webui | CC0-1.0 | Python | extension A1111 | 215 ★ | — | 1 | Tile X / Tile Y séparés ; « pas garanti à 100 % » | **CC0 → code réutilisable librement** |
| Tiled Diffusion (CVPR 2025) | https://github.com/madaror/tiled-diffusion | non précisée | Python | contrainte de tuilage | recherche | SD1.5 ok | 4 | Meilleure qualité que le padding circulaire, many-to-many | Voir P3 |
| Embark texture-synthesis | https://github.com/EmbarkStudios/texture-synthesis | MIT **ou** Apache-2.0 | Rust (CLI + lib) | synthèse multi-résolution | **archivé oct. 2023**, 1,8 k ★, fonctionnel | CPU | 2 | `--tiling` (bords modifiés pour tuiler), inpaint, guided, style transfer, multi-exemples | Appeler le binaire via subprocess ; parfait pour agrandir/rendre seamless un échantillon |
| Image Quilting (Efros-Freeman) | https://github.com/rohitrango/Image-Quilting-for-Texture-Synthesis | MIT | Python | synthèse par patches | ancien | CPU | 2 | Blocs + recouvrement + min-cut ; paramètres bloc/overlap/tolérance | Simple à porter en NumPy pour le pixel-art (patches entiers = pas de flou) |
| img2texture | https://github.com/rtmigo/img2texture | MIT | Python | make-tileable par fondu alpha | 2023 (1.1.2) | CPU | 1 | Réduit l'image, recouvre les bords avec dégradé alpha ; `--overlap` | Méthode « GIMP Tile Seamless » ; floute les bords en pixel-art |
| OpenCV `seamlessClone` | https://docs.opencv.org/4.x/df/da0/group__photo__clone.html | Apache-2.0 | C++/Python | fusion Poisson | stable | CPU | 1 | NORMAL / MIXED / MONOCHROME_TRANSFER ; intègre les gradients | Pour HD ; en pixel-art, casse la palette |
| LaMa / PyPatchMatch | voir P3 | Apache-2.0 / MIT | Python | inpaint de couture | stable | CPU ok | 1 | Offset de moitié + inpaint de la croix centrale = méthode la plus robuste sur image existante | À privilégier pour « rendre seamless » |
| TexTile (CVPR 2024) | https://github.com/crp94/textile | MIT | Python (`pip install textile-metric`) | **métrique différentiable de tuilabilité** | recherche, stable | GPU petit / CPU | 1 | Classifieur entraîné sur annotations humaines ; utilisable comme **loss** pour optimiser une texture | Score de couture « perceptuel » ; complément du score pixel |
| texturize | https://github.com/texturedesign/texturize | **AGPL-3.0** | Python | synthèse neuronale | actif (761 ★) | GPU/CPU | 2 | remix / remake / mashup / enhance | AGPL : à isoler en service séparé si utilisé, sinon éviter |
| Material Maker | https://github.com/RodZill4/material-maker | MIT | GDScript (Godot) | textures procédurales par nœuds | stable (1.6, avr. 2026, 5,6 k ★) | GPU léger | 3 | Textures procédurales seamless par construction (bruits périodiques) | Alternative « zéro IA » pour matériaux (pierre, bois, métal) ; export PNG |
| GIMP « Tile Seamless » | https://www.gimp.org | GPL-3.0 | C | filtre | stable | CPU | 1 | Mélange l'image avec sa copie décalée, pondéré par la distance au centre | Référence d'algorithme uniquement |

**Score de couture (à développer, cf. §5).** Trois niveaux complémentaires :
1. *Pixel* : différence moyenne entre la dernière colonne et la première (idem lignes), normalisée par la différence moyenne entre colonnes adjacentes à l'intérieur → `seam_ratio` ; > 1,5 = couture visible.
2. *Gradient* : énergie du gradient horizontal sur la jonction de l'image tuilée 2×2 vs médiane du gradient intérieur.
3. *Perceptuel* : TexTile (tuilabilité + répétition visible). Calculer aussi une auto-corrélation FFT pour détecter les motifs trop périodiques.

**Recommandation P4.** Génération : padding circulaire sur UNet + VAE (X et Y, ou asymétrique) — c'est ce que fait tout le monde, coût nul. Correction : offset demi-tuile → masque en croix (8-16 px) → LaMa (HD) ou PatchMatch/quilting (pixel-art) → re-score ; boucle jusqu'à `seam_ratio < 1,2` ou 3 essais. Repli sans GPU : Embark `--tiling` ou quilting NumPy. Toujours produire l'aperçu 3×3 et le score dans la réponse API.

### P5 — Cohérence intra-set et vérification des raccords

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité/limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Pillow `Image.quantize` / palettes | https://github.com/python-pillow/Pillow | HPND (MIT-like) | Python | quantification | stable | CPU | 1 | Median cut / octree, palette imposée par `quantize(palette=…)` | Palette commune à tout le set |
| scikit-image `match_histograms` | https://github.com/scikit-image/scikit-image | BSD-3 | Python | normalisation | stable | CPU | 1 | Aligne la distribution de couleurs d'une tuile sur une référence | Éclairage/tonalité homogènes en HD |
| IP-Adapter / image de référence | https://github.com/tencent-ailab/IP-Adapter | Apache-2.0 | Python | conditionnement de style | stable | +1 Go | 2 | Impose le style d'une tuile de référence aux suivantes | Le « Style/Ref » de SpriteCook, en open source |
| Sanity check des bords (à développer) | — | — | Python/NumPy | vérification | — | CPU | 2 | Pour chaque paire (tuile A, tuile B, direction) autorisée par le bitmask, comparer les bandes de 1-2 px ; produire une matrice de compatibilité et une heatmap | Cœur de la promesse « tuiles utilisables » |
| Edge harmonization (à développer) | — | — | Python/NumPy | correction | — | CPU | 3 | Pour chaque classe d'arête (ex. « herbe-plein », « bord haut »), élire une arête canonique (médiane) et la **copier** sur toutes les tuiles de cette classe (1-2 px), puis fondre 2-4 px vers l'intérieur (pixel-art : dithering contraint à la palette ; HD : blend linéaire ou Poisson) | Rend les raccords exacts par construction |

**Recommandation P5.** Quantifier tout le set sur une palette unique extraite de la tuile « intérieur » ; en HD, `match_histograms` par tuile vers l'intérieur. Passer systématiquement le sanity check ; si une paire échoue, harmoniser ; si l'échec persiste (structure différente), régénérer la tuile par inpaint cellule (P3-3). Le générateur de quadrants (P2) rend le check trivialement vert pour l'intérieur — les seuls raccords à vérifier sont ceux des primitives de bord.

### P6 — Tester : playground, WFC, cartes de test

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité/limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| WaveFunctionCollapse (mxgmn) | https://github.com/mxgmn/WaveFunctionCollapse | MIT | C# | référence | 25,3 k ★ | CPU | 3 | Modèles overlapping et simple tiled | Le README recense les ports |
| wavefunctioncollapse (npm) | https://github.com/kchapelier/wavefunctioncollapse | MIT | JS (ES6) | lib front | 2.1.0 (2021), stable | CPU | 2 | OverlappingModel + SimpleTiledModel | Pour le playground React : cartes de test générées côté client |
| wfc_2019f | https://github.com/ikarth/wfc_2019f | MIT | Python | lib backend | 188 ★, tests pytest | CPU | 2 | Overlapping et tile-based, backtracking, périodicité, heuristiques | Génération serveur de cartes de démonstration |
| godot-constraint-solving | https://github.com/AlexeyBond/godot-constraint-solving | MIT | GDScript | addon WFC Godot 4 | v1.7 (oct. 2024), 449 ★ | CPU | 2 | Apprend depuis une carte exemple, TileMapLayer/GridMap, hex | Fournir un exemple de scène prête à l'emploi dans l'export Godot |
| model-synthesis (Merrell) | https://github.com/merrell42/model-synthesis | voir LICENSE.txt (à vérifier) | C++ | référence | dormant | CPU | 4 | Ancêtre de WFC, modifie par blocs | Référence seulement |
| Autotiler bitmask (à développer) | — | — | TS + Python | playground | — | CPU | 2 | Peindre terrain → calcul du masque 4/8 bits → tuile ; modes 16/47/dual-grid ; export capture PNG | Équivalent tuiles du « playground » personnages de SpriteCook |
| scikit-image `find_contours` (marching squares) | https://github.com/scikit-image/scikit-image | BSD-3 | Python | contours | stable | CPU | 1 | Vectorise une carte de terrain en polygones | Pour générer des collisions ou des fonds vectoriels ; pas nécessaire au rendu des tuiles |

**Recommandation P6.** Playground React : canvas, brosse terrain, autotiler dual-grid/47 en TS (même spec que Python), bouton « carte aléatoire » via `wavefunctioncollapse` (SimpleTiledModel alimenté par les adjacences déduites du bitmask), aperçu 3×3 pour les textures, surbrillance des raccords en échec (P5). Côté export Godot, inclure une scène de démo avec `godot-constraint-solving` optionnel.

### P7 — Exports moteurs : structures exactes

**Godot 4 — `TileSet` texte (`.tres`).** Noms de propriétés vérifiés dans `scene/resources/2d/tile_set.cpp` (`terrain_set_%d/mode`, `terrain_set_%d/terrain_%d/name|color`, `sources/%d`, clés d'atlas `x:y/alt`, `terrains_peering_bit/<voisin>`) et enums vérifiés dans `TileSet.xml`. Squelette à générer :

```
[gd_resource type="TileSet" load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://ground_47.png" id="1_tex"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1_tex")
texture_region_size = Vector2i(32, 32)
0:0/0 = 0
0:0/0/terrain_set = 0
0:0/0/terrain = 0
0:0/0/terrains_peering_bit/right_side = 0
0:0/0/terrains_peering_bit/bottom_right_corner = 0
0:0/0/terrains_peering_bit/bottom_side = 0
0:0/0/terrains_peering_bit/bottom_left_corner = 0
0:0/0/terrains_peering_bit/left_side = 0
0:0/0/terrains_peering_bit/top_left_corner = 0
0:0/0/terrains_peering_bit/top_side = 0
0:0/0/terrains_peering_bit/top_right_corner = 0
1:0/0 = 0
1:0/0/terrain_set = 0
1:0/0/terrain = 0
1:0/0/terrains_peering_bit/bottom_side = 0
...

[resource]
tile_size = Vector2i(32, 32)
terrain_set_0/mode = 0
terrain_set_0/terrain_0/name = "Ground"
terrain_set_0/terrain_0/color = Color(0.35, 0.65, 0.25, 1)
sources/0 = SubResource("TileSetAtlasSource_1")
```

Règles : `mode` = 0 (corners+sides, blob 47), 1 (corners, dual-grid/2×2), 2 (sides, platformer 16). On n'écrit **que** les peering bits « présents » (valeur = id du terrain) ; les absents restent -1 (vide). Pour les tuiles animées : `x:y/animation_columns`, `animation_frames_count`, `animation_speed`, `animation_frame_N/duration`. Collisions : `x:y/0/physics_layer_0/polygon_0/points = PackedVector2Array(...)`. Vérifier l'import sur Godot 4.3/4.4 avant livraison (les `uid` sont optionnels ; Godot les régénère). Isométrique : `tile_shape = 1` et `tile_layout` dans `[resource]`.

**Tiled — `.tsx` (format 1.10) et JSON.** Vérifié sur la référence TMX/JSON : `wangid` = 8 entiers « top, top-right, right, bottom-right, bottom, bottom-left, left, top-left », 0 = aucune couleur, couleurs indexées à partir de 1.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.0" name="ground" tilewidth="32" tileheight="32" tilecount="47" columns="8">
 <image source="ground_47.png" width="256" height="192"/>
 <wangsets>
  <wangset name="Ground" type="mixed" tile="-1">
   <wangcolor name="Ground" color="#59a63f" tile="-1" probability="1"/>
   <wangtile tileid="0" wangid="1,1,1,1,1,1,1,1"/>
   <wangtile tileid="1" wangid="0,0,1,1,1,0,0,0"/>
  </wangset>
 </wangsets>
</tileset>
```

`type` = `corner` (16, dual-grid), `edge` (16, platformer) ou `mixed` (47). Tuiles animées : `<tile id="…"><animation><frame tileid="…" duration="150"/></animation></tile>`. Libs : **pytiled_parser** (MIT, lecture TMX/JSON/TSX, Python 3.6-3.13), **tmxlite** (zlib, C++14, lecture) — aucune n'écrit : l'écriture se fait en `xml.etree` (trivial). Le JSON Tiled a les mêmes champs (`wangsets[].wangtiles[].wangid` = tableau de 8).

**LDtk — règles d'auto-layer dans le `.ldtk`** (vérifié dans `JSON_SCHEMA.json`) : `LayerDef.autoRuleGroups[].rules[]` avec `size` ∈ {1,3,5,7}, `pattern` (size×size entiers : valeur IntGrid positive = requise, négative = interdite, 0 = indifférent ; valeurs spéciales ±1000001 = « n'importe quelle valeur / vide », à vérifier sur un fichier réel), `tileRectsIds` (rectangles de tuiles, choix aléatoire), `chance`, `breakOnMatch`, `flipX/flipY`, `xModulo/yModulo`, `outOfBoundsValue`, `perlinActive…`. `TilesetDef` : `uid, identifier, relPath, pxWid, pxHei, tileGridSize, spacing, padding`. Générer les 47 règles 3×3 (ou 16) avec `flipX/flipY` pour réduire à ~13 règles quand le set est symétrique. Écriture : JSON standard ; les bindings quicktype officiels existent dans `docs/quicktype/` du dépôt LDtk (Python inclus, à vérifier).

**Unity Rule Tile.** Le dépôt historique `2d-extras` est en lecture seule ; la fonctionnalité vit dans le package `com.unity.2d.tilemap.extras` (Unity Companion License — **non OSI**, à traiter comme propriétaire). Le `.asset` est un ScriptableObject YAML (`m_TilingRules[]` avec `m_Neighbors` [1 = This, 2 = NotThis], `m_NeighborPositions`, `m_Sprites`, `m_RuleTransform`). Écrire le YAML est faisable sans dépendance Unity ; garder cet export comme « best effort » (SpriteCook le livre en `.unitypackage`).

**Phaser.** MIT ; pas d'autotile natif, charge le JSON Tiled → notre export Tiled couvre Phaser. `phaser3-autotile` (browndragon) existe en complément.

### P8 — Props, parallax, tuiles animées, variantes

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité/limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Depth Anything V2 — Small | https://github.com/DepthAnything/Depth-Anything-V2 | **Apache-2.0 (Small 24,8 M)** ; Base/Large : CC-BY-NC-4.0 | Python | profondeur mono | stable (8,6 k ★) | < 2 Go / CPU ok | 2 | Carte de profondeur relative ; suffisante pour découper 3-5 plans | N'utiliser que **Small** en production |
| 3d-photo-inpainting | https://github.com/vt-vl-lab/3d-photo-inpainting | MIT | Python | LDI + inpainting | 2020, 7,1 k ★ | GPU | 4 | Couches de profondeur + remplissage des occlusions | Trop lourd ; s'inspirer du principe « couche → inpaint derrière » avec LaMa |
| LaMa | voir P3 | Apache-2.0 | Python | inpaint | stable | CPU ok | 1 | Remplit ce qui est caché derrière un plan | Cœur du découpage parallax |
| Tiled / Godot (variantes par probabilité + flips) | docs | GPL/MIT | — | moteurs | stable | — | 1 | Tiled ≥ 1.5 : flips/rotations automatiques ; Godot : `probability` par tuile alternative | Exporter les variantes comme alternatives |
| Générateur de variantes (à développer) | — | — | Python | procédural | — | CPU | 2 | Flip/rotation (uniquement matériaux isotropes et non éclairés), recoloration par palette (hue shift contraint), bruit de détail, décalage de motif seamless | Casser la répétition sans IA |
| Tuiles animées (à développer) | — | — | Python | procédural | — | CPU | 2 | Déplacer la texture seamless par un champ de flux périodique (sin sur t) ou faire tourner le bruit de la surface (eau, lave) : boucle parfaite garantie ; herbe : ondulation sinusoïdale par colonnes | Export en colonnes d'animation Godot / `<animation>` Tiled |
| Sprite stacking | — | — | Python | technique | — | — | 2 | Empiler des tranches horizontales d'un objet pour un pseudo-3D ; les tranches se génèrent par découpe d'un rendu iso ou d'un voxel | Niche ; laisser en « idée » |

**Recommandation P8.** Parallax : Depth Anything V2 Small → k-means/quantiles en 3-5 couches → masque par couche → LaMa derrière chaque couche → rendre chaque couche seamless en X (offset + inpaint) → export PNG + JSON (facteur de défilement suggéré par couche). Props : générer isolé (détourage couvert par un autre agent), vérifier l'ancrage sur la grille et l'ombre au sol. Variantes et animations : procédural d'abord, IA seulement pour de nouveaux props.

### P9 — Contraintes pixel-art propres aux tuiles

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Complexité | Qualité/limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Pixelorama | https://github.com/Orama-Interactive/Pixelorama | MIT | GDScript (Godot 4) | éditeur pixel | 1.1.10 (avr. 2026) | — | 1 | Tile mode (aperçu seamless), calques tilemap rect/iso/hex, palettes | Cible « retouche manuelle » recommandée ; format `.pxo` |
| LibreSprite | https://github.com/LibreSprite/LibreSprite | GPL-2.0 | C++ | éditeur pixel | actif (8,3 k ★) | — | 1 | Fork GPL d'Aseprite, scripting | Alternative libre |
| Aseprite | https://github.com/aseprite/aseprite | **EULA (source disponible, non libre)** ; sous-libs MIT | C++/Lua | éditeur pixel | stable | — | 1 | Calques tilemap, API Lua, CLI | Support d'export `.aseprite`/scripts Lua pour les utilisateurs qui l'ont ; ne pas embarquer |
| AsepriteScripts (PKGaspi) | https://github.com/PKGaspi/AsepriteScripts | MIT | Lua | scripts export | 307 ★ | — | 1 | Export calques/slices/combinaisons | Modèle pour un script « importer une planche générée » |
| pixel-art-xl + réduction nearest ×8 | voir P3 | OpenRAIL-M | — | style | stable | SDXL | 1 | Générer à 1024 → 128 px | Base de la génération 16/32 px (autre agent : détection de grille) |

Points clés : (1) générer les tuiles à ×4 ou ×8 puis réduire en `NEAREST` et quantifier sur la palette commune ; (2) en 3/4 top-down, la primitive « bord bas » porte l'élévation (face visible) — ajouter un paramètre `elevation ∈ {none, minimal, full}` comme SpriteCook ; (3) platformer : jeu edge-16 + tuiles de pentes 45°/22,5° générées par cisaillement de la tuile pleine puis re-quantification ; (4) contour : option « outline 1 px » appliquée par morphologie après assemblage pour unifier le set.

---

## 3. Idées malines et astuces

1. **Dual-grid comme pivot de génération, blob 47 comme pivot d'export.** Générer 15 primitives (ou 6 avec symétries) est infiniment plus fiable pour l'IA que 47 ; les 47 se déduisent par assemblage de quadrants. On sert à la fois TileMapDual/Excalibur (15) et Godot/Tiled/LDtk/Unity (47) depuis la même génération.
2. **Intérieur figé, bords inpaintés.** Générer la texture seamless d'abord, l'injecter dans toutes les primitives et n'inpainter que la bande de bord : les raccords intérieurs sont exacts par construction.
3. **Compositing « two surfaces » sans IA** : deux textures seamless (herbe/terre) + masques de coin bruités façon Wangscape (Perlin/valeur seedé) + contour optionnel = tileset de transition complet en < 1 s CPU. L'IA n'intervient que pour les deux textures.
4. **Cascade de couture** : padding circulaire → score → si > seuil, offset + inpaint croix → re-score → quilting en dernier recours. Exposer le score dans l'API et dans l'UI (badge « tuile validée »).
5. **Sanity check des paires** : matrice de compatibilité (tuile A → tuile B → direction) calculée sur des bandes de 1-2 px ; heatmap dans le playground ; correction par arête canonique copiée. C'est ce qui distingue « des images » de « des tuiles utilisables ».
6. **Gabarit multi-échelle** : le gabarit MIT de SpriteCook (quadrants remplis + bruit d'arête) fournit à la fois le masque de terrain (pour le compositing), le contour Canny (pour ControlNet) et la grille de recalage (corrélation croisée post-génération).
7. **Many-to-many via Tiled Diffusion** : générer 4-8 tuiles de sol qui se raccordent mutuellement (Wang) — anti-répétition idéal pour les grands sols HD ; à activer quand la licence sera clarifiée.
8. **Symétries opportunistes** : matériaux isotropes non éclairés (pierre, sable) → 6 primitives + flips ; matériaux éclairés (3/4 avec ombre) → 15 primitives sans flips. Détecter automatiquement l'isotropie (comparer la tuile et sa version flippée après quantification).
9. **Animations procédurales à boucle garantie** : déplacer la texture seamless par un flux périodique en `sin(2πt/T)` — aucune couture temporelle possible, et le coût est nul.
10. **Parallax = profondeur + inpaint + seamless X** : Depth Anything V2 Small (Apache) suffit ; chaque couche est rendue seamless horizontalement pour le défilement infini.
11. **Règles LDtk générées, pas dessinées** : le tableau bitmask → `pattern` 3×3 se dérive mécaniquement ; avec `flipX/flipY` on livre ~13 règles au lieu de 47.
12. **Exemple de scène Godot prête à jouer** dans le ZIP (TileMapLayer + terrain + option WFC) : reproduit l'effet « playground » côté moteur.

---

## 4. Pipelines d'assemblage recommandés

### Pipeline A — « prompt → tileset autotile 47 utilisable dans Godot/Tiled »

```
[1] Paramètres : perspective (top-down 3/4, platformer, iso), taille (16/32/64), style (pixel/HD),
    élévation (none/minimal), arêtes (transparent/two_surfaces), symétrie auto
      │
[2] Gabarit : générateur NumPy (port du spritecook-tileset-gen MIT) → masques de terrain
    par primitive dual-grid (16) + contour Canny + grille de recalage, à ×4 (×8 en 16 px)
      │
[3] Texture intérieure seamless (Pipeline B) → quantifiée sur la palette du set
      │
[4] Bords — MODE IA : inpaint masqué de la bande de bord par primitive (SD1.5/SDXL +
    ControlNet Canny/Tile, IP-Adapter sur la texture intérieure pour le style)
    Bords — MODE ALGO : compositing masques bruités (Wangscape-like) + contour + ombre
    d'élévation ; two_surfaces = 2 textures seamless
      │
[5] Recalage (corrélation croisée avec le gabarit) → découpe → réduction NEAREST → palette
      │
[6] Sanity check des paires + edge harmonization ; tuile en échec → inpaint cellule avec
    voisins (max 2 essais) → sinon marquage « à retoucher »
      │
[7] Assemblage : 16 dual-grid → 47 blob par quadrants ; + edge-16 pour platformer ;
    + variantes (flips si isotrope, recoloration) ; + tuiles animées optionnelles
      │
[8] Exports : PNG atlas (1×-4×, spacing optionnel) ; Godot .tres (mode 0/1/2 + peering bits
    + animation) ; Tiled .tsx/.json (wangset corner/edge/mixed) ; LDtk (tileset def + règles) ;
    Unity RuleTile YAML (best effort) ; JSON manifeste (bitmask → position) ; Pixelorama/Aseprite
      │
[9] Playground React : peindre → autotiler (dual-grid/47) → carte WFC → heatmap des raccords
    → capture PNG ; bouton « régénérer cette tuile » (inpaint cellule) ; « ouvrir dans l'éditeur »
```

Mode **IA + algo** (défaut) : étapes 3-4 IA, 5-8 algo. Mode **100 % algo** (CPU, hors ligne) : étape 3 par Material Maker/quilting d'un échantillon uploadé ou texture procédurale, étape 4 par masques. Mode **retouche** : édition pixel dans le playground (outil crayon/pipette contraint à la palette) puis re-exécution des étapes 6-8 uniquement.

### Pipeline B — « prompt → texture seamless validée »

```
[1] Génération : diffusers + patch Conv2d circular (UNet + VAE), X et Y (ou un seul axe),
    modèle : SD1.5 (+LoRA pixel) / SDXL + pixel-art-xl (LCM 8 pas) / FLUX-schnell NF4 ;
    résolution 512-1024, puis réduction NEAREST au format cible
      │
[2] Score : seam_ratio pixel + gradient sur montage 2×2 + TexTile ; auto-corrélation FFT
      │
[3] Si score > seuil : offset (w/2, h/2) → masque croix 8-16 px → LaMa (HD) ou
    PatchMatch/quilting (pixel) → re-score (≤ 3 boucles)
      │
[4] Repli sans GPU : Embark texture-synthesis --tiling sur un échantillon, ou quilting NumPy
      │
[5] Post : quantification palette (pixel) ou match_histograms (HD) ; option normal map/ heightmap
    (Sobel) pour les moteurs 2D lit
      │
[6] Livraison : PNG + aperçu 3×3 + score + preset d'import (nearest, no mipmaps) ; variantes par
    décalage/recoloration ; version animée optionnelle (flux périodique)
```

---

## 5. Ce qu'il faudrait développer soi-même

| Composant | Rôle | Effort | Dépendances OSS |
|---|---|---|---|
| **`tilespec`** (Python + TS, spec JSON partagée) | Représentation unique des masques 4/8 bits, conversions blob47 ↔ dual-grid16 ↔ edge16 ↔ A2 ↔ wangid Tiled ↔ pattern LDtk ↔ peering bits Godot | 3-5 j | aucune |
| **Générateur de gabarits** | Port NumPy du spritecook-tileset-gen (MIT) : 15/17-piece, 47, edge-16, iso 2:1, hex ; sorties masque/contour/grille | 2-3 j | NumPy, Pillow |
| **Compositeur de quadrants** | 16 (ou 6) primitives → 47 ; variations par ligne ; mapping JSON (inspiré HeartoLazor MIT / TilePipe2 MIT) | 2 j | NumPy |
| **Compositeur masques + bruit** | Transitions two_surfaces / multi-terrain façon Wangscape, contour, ombre d'élévation, pentes platformer | 4-6 j | NumPy, bruit (opensimplex, MIT) |
| **Pipeline diffusion seamless** | Patch circular/asymétrique (réécriture, base CC0 tjm35), inpaint de bande, inpaint cellule avec voisins, ControlNet/IP-Adapter, offload 8 Go | 5-8 j | diffusers, torch |
| **Seam scorer + fixer** | seam_ratio, gradient, TexTile, FFT ; boucle offset + inpaint (LaMa/PatchMatch/quilting) | 3-4 j | textile-metric, LaMa, PyPatchMatch |
| **Sanity check + harmonisation** | Matrice de compatibilité des paires, arête canonique, fondu contraint palette, heatmap | 3-4 j | NumPy, scikit-image |
| **Recalage + découpe** | Corrélation croisée sur le gabarit, découpe, réduction nearest, quantification (lien avec l'agent « grille ») | 2 j | NumPy, Pillow |
| **Exporteurs** | Writer `.tres` Godot 4 (terrains, animation, collisions), `.tsx`/JSON Tiled, `.ldtk` (tileset + règles), Unity RuleTile YAML, manifeste JSON | 4-6 j | xml.etree, json |
| **Playground React** | Canvas, brosse terrain, autotiler TS, WFC (npm `wavefunctioncollapse` MIT), heatmap, aperçu 3×3, retouche pixel | 8-12 j | React 19, wavefunctioncollapse |
| **Variantes / animation / parallax** | Flips conditionnels, recoloration, flux périodique, Depth Anything V2 Small + LaMa + seamless X | 4-6 j | torch, Depth Anything V2 |

Total indicatif : 40-60 jours-personne pour un MVP « tuiles réellement utilisables », dont l'essentiel est **algorithmique et sans dépendance à licence copyleft**. Exclusions volontaires : ComfyUI-seamless-tiling (GPL-3), texturize (AGPL-3), instatileset (GPL-3), Tiled (GPL, cible d'export seulement), Tiled Diffusion tant que la licence n'est pas publiée, Depth Anything Base/Large (CC-BY-NC), FLUX.1-dev/Fill (non commercial), Aseprite (EULA).

---

## 6. Sources

- Red Blob Games, Autotiling guide : https://www.redblobgames.com/articles/autotile/claude/
- Excalibur.js, Dual Tilemap Autotiling Technique : https://excaliburjs.com/blog/Dual%20Tilemap%20Autotiling%20Technique/
- SpriteCook, Dual-grid tilesets explained : https://www.spritecook.ai/blog/dual-grid-tilesets-explained
- SpriteCook, The 15-piece autotile tileset explained : https://www.spritecook.ai/blog/autotile-tilesets-explained
- SpriteCook, top-down tileset / Godot autotile : https://www.spritecook.ai/blog/top-down-tileset ; https://www.spritecook.ai/blog/godot-autotile-tileset
- SpriteCook Tileset Base Generator (MIT) : https://www.spritecook.ai/tileset-base-generator ; https://github.com/SpriteCook/spritecook-tileset-gen
- TileMapDual (MIT) : https://github.com/pablogila/TileMapDual
- dual-grid-tilemap-system-godot (MIT) : https://github.com/jess-hammer/dual-grid-tilemap-system-godot
- Wangscape (MIT) : https://github.com/Wangscape/Wangscape
- TilePipe2 (MIT) : https://github.com/aleksandrbazhin/TilePipe
- autotiler itsjavi (MIT) : https://github.com/itsjavi/autotiler
- autotile_generator HeartoLazor (MIT) : https://github.com/HeartoLazor/autotile_generator
- AutotileGenerator ticial : https://github.com/ticial/AutotileGenerator
- instatileset (GPL-3) : https://github.com/escualina/instatileset
- autotiler krylphi (MIT) : https://github.com/krylphi/autotiler
- AutoBlob Aseprite (commercial) : https://community.aseprite.org/t/extension-autoblob-generate-the-full-47-tile-blob-autotile-set-from-6-template-tiles/28606
- Better Terrain (Unlicense) : https://github.com/Portponky/better-terrain
- terrain-autotiler (MIT, archivé) : https://github.com/dandeliondino/terrain-autotiler
- godot-constraint-solving (MIT) : https://github.com/AlexeyBond/godot-constraint-solving
- WaveFunctionCollapse (MIT) : https://github.com/mxgmn/WaveFunctionCollapse
- wfc_2019f (MIT) : https://github.com/ikarth/wfc_2019f
- wavefunctioncollapse npm (MIT) : https://github.com/kchapelier/wavefunctioncollapse
- model-synthesis : https://github.com/merrell42/model-synthesis
- stb_herringbone_wang_tile.h (domaine public) : https://github.com/nothings/stb/blob/master/stb_herringbone_wang_tile.h
- bitbutter tileset-template-generator : https://github.com/bitbutter/tileset-template-generator
- GitHub topics : https://github.com/topics/tileset-generator ; https://github.com/topics/autotile ; https://github.com/topics/texture-synthesis
- Godot TileSet API : https://raw.githubusercontent.com/godotengine/godot/master/doc/classes/TileSet.xml ; TileData : …/TileData.xml ; sérialisation : https://raw.githubusercontent.com/godotengine/godot/master/scene/resources/2d/tile_set.cpp
- Godot docs Using TileSets : https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/2d/using_tilesets.rst
- Tiled TMX/TSX : https://doc.mapeditor.org/en/stable/reference/tmx-map-format/ ; JSON : https://doc.mapeditor.org/en/stable/reference/json-map-format/ ; terrains : https://doc.mapeditor.org/en/stable/manual/terrain/ ; dépôt : https://github.com/mapeditor/tiled
- LDtk : https://github.com/deepnight/ldtk ; auto-layers : https://ldtk.io/docs/general/auto-layers/ ; schéma JSON : https://raw.githubusercontent.com/deepnight/ldtk/master/docs/JSON_SCHEMA.json
- pytiled_parser (MIT) : https://github.com/pythonarcade/pytiled_parser ; tmxlite (zlib) : https://github.com/fallahn/tmxlite
- Unity 2d-extras (lecture seule) : https://github.com/Unity-Technologies/2d-extras
- Embark texture-synthesis (MIT/Apache-2.0, archivé) : https://github.com/EmbarkStudios/texture-synthesis
- ComfyUI-seamless-tiling (GPL-3) : https://github.com/spinagon/ComfyUI-seamless-tiling
- asymmetric-tiling-sd-webui (CC0) : https://github.com/tjm35/asymmetric-tiling-sd-webui
- Tiled Diffusion, CVPR 2025 : https://github.com/madaror/tiled-diffusion
- TexTile, CVPR 2024 (MIT) : https://github.com/crp94/textile
- Image Quilting (MIT) : https://github.com/rohitrango/Image-Quilting-for-Texture-Synthesis
- img2texture (MIT) : https://github.com/rtmigo/img2texture
- PyPatchMatch (MIT) : https://github.com/vacancy/PyPatchMatch
- LaMa (Apache-2.0) : https://github.com/advimman/lama ; IOPaint (Apache-2.0, archivé) : https://github.com/Sanster/IOPaint
- OpenCV seamlessClone : https://docs.opencv.org/4.x/df/da0/group__photo__clone.html
- texturize (AGPL-3) : https://github.com/texturedesign/texturize
- Material Maker (MIT) : https://github.com/RodZill4/material-maker
- ControlNet Tile SD1.5 : https://huggingface.co/lllyasviel/control_v11f1e_sd15_tile ; Tile SDXL xinsir (Apache-2.0) : https://huggingface.co/xinsir/controlnet-tile-sdxl-1.0
- pixel-art-xl (OpenRAIL-M) : https://huggingface.co/nerijs/pixel-art-xl
- FLUX.1-schnell (Apache-2.0) : https://huggingface.co/black-forest-labs/FLUX.1-schnell
- Depth Anything V2 : https://github.com/DepthAnything/Depth-Anything-V2 ; 3d-photo-inpainting (MIT) : https://github.com/vt-vl-lab/3d-photo-inpainting
- Pixelorama (MIT) : https://github.com/Orama-Interactive/Pixelorama ; LibreSprite (GPL-2) : https://github.com/LibreSprite/LibreSprite ; Aseprite (EULA) : https://github.com/aseprite/aseprite ; AsepriteScripts (MIT) : https://github.com/PKGaspi/AsepriteScripts
- Tilemancer (arrêté 2019, propriétaire/gratuit) : https://led.itch.io/tilemancer ; Tilesetter [PROPRIÉTAIRE] : https://www.tilesetter.org/
