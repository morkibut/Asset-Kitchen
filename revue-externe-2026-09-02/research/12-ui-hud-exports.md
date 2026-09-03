# 12 — Interface de jeu (UI/HUD/menus, icônes, polices) et exports vers les moteurs

> Recherche technique (septembre 2026) pour un générateur d'assets 2D open-source-first (pixel art en priorité), concurrent de SpriteCook. Stack cible : FastAPI (Python 3.11) + Pillow/NumPy, React 19 + TS, GPU 8 Go ou CPU, API cloud acceptable. Solutions **open source uniquement** (licence indiquée) ; le propriétaire n'est cité que comme *référence* et marqué ⚠️.
>
> Périmètre : (A) création des éléments d'interface (maquette d'écran → planche de composants → extraction/classification → 9-slice → variantes d'état, polices pixel, icônes) ; (B) exports moteurs (Godot 4, Unity, Phaser, Tiled, LDtk, Aseprite, GameMaker, Defold, Construct, Unreal, Roblox), métadonnées d'atlas, réglages d'import, playground web, emballage.
>
> Méthode : vérification des licences/activité sur les pages GitHub, docs officielles (Godot XML de référence, Phaser, PixiJS, Tiled, Defold, Unity) et pages Hugging Face. Le quota de recherche web de la session étant épuisé, les points non re-vérifiés en ligne sont marqués **(à vérifier)** ; tout le reste a été confirmé sur la page source citée en §6.

---

## 1. Problèmes et verrous

1. **Détecter automatiquement les bordures 9-slice.** Un bouton/cadre généré par IA doit être découpé en 9 zones (4 coins fixes, 4 bords étirables sur un axe, centre étirable sur deux). Trouver *où* couper — les colonnes/lignes « répétitives » — sans intervention humaine, en distinguant « centre uni » (stretch), « centre à motif » (tile) et « non étirable » (icône, ornement), puis *prouver* le résultat par un aperçu d'étirement. Il n'existe **aucune bibliothèque open source mature** dédiée à la détection automatique : Android draw9patch, Unity Sprite Editor, Aseprite Slices, Godot NinePatchRect sont tous manuels. C'est donc à développer (mais c'est court).
2. **Classer et nommer les composants d'une planche.** Après découpe (composantes connexes — voir fiche 05), il faut décider pour chaque morceau son *rôle* (FRAME/BUTTON/DIVIDER/FILL/ICON…), son *état* (NORMAL/HOVER/PRESSED/DISABLED/SELECTED), regrouper les états d'un même composant, donner un nom lisible (`button_primary_hover`) et produire un `quality_summary` (pièces orphelines, tailles hors grille, couleurs hors palette, halos alpha).
3. **Fabriquer les variantes d'état de façon déterministe.** Demander à l'IA « le même bouton en hover » donne un bouton *différent*. Il faut dériver hover/pressed/disabled/selected par algorithme (palette, rampes, décalage), en restant dans la palette du projet.
4. **Générer et assembler la maquette d'écran.** SpriteCook part d'un « concept plein écran » par type d'écran (12 types). Le verrou est double : obtenir une composition crédible à la bonne résolution logique (ex. 384×216, 640×360, 9:16 mobile) *et* pouvoir la retoucher/ré-assembler à partir de composants réels, avec des outils libres.
5. **Cadres/boutons procéduraux.** Pour un thème « propre » (bordure, bevel, ombre, coins), l'algorithme bat l'IA : sortie 9-slice-ready par construction, pixel-perfect, recolorable. Il n'existe pas de générateur de « pixel UI frame » open source de référence : à développer (~500 lignes).
6. **Polices.** Choisir des polices pixel réellement libres (OFL/CC0), fabriquer une police bitmap à partir d'une planche de glyphes générée (découpe, baseline, avance), écrire les formats moteurs (.fnt BMFont texte/XML/binaire, .ttf/.otf, .bdf) et rendre le texte pixel-perfect (pas d'anticrénelage, pas de mipmaps, tailles multiples de la taille native).
7. **Icônes cohérentes.** Uniformiser taille, marge, contour, ombre et direction de lumière sur des dizaines d'icônes ; disposer d'une base libre à pixeliser/recoloriser (game-icons.net, pixelarticons, Kenney).
8. **Formats d'export exacts.** Chaque moteur a son format texte/JSON/YAML avec ses pièges (origine Y en bas chez Unity, `internalID` int64, `uid://` Godot, `wangid` de Tiled, `pattern` LDtk, tar.gz du `.unitypackage`). Il faut des écrivains fiables et testés, plus des réglages d'import (nearest, no-mipmaps, PPU) et un **playground** web qui *consomme réellement* ces fichiers.
9. **Emballage.** Un ZIP lisible par un humain et par un moteur : manifeste JSON stable, licences/attributions (CC BY de game-icons.net, OFL des polices), structure de dossiers par moteur.

---

## 2. Solutions par problème

Légende : *Type* = lib / modèle / outil / format / technique ; *Maturité* = ★ (proto) à ★★★★ (industriel) ; *Cx* = complexité d'intégration 1 (trivial) → 5 (lourd).

### 2.1 Détection automatique des bordures 9-slice

| Nom | URL | Licence | Langage | Type | Maturité | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **Algorithme « runs de colonnes identiques »** (NumPy) | https://numpy.org | BSD-3 | Python | technique | ★★★★ (une fois écrit) | 1 | Sur du pixel art quantifié, deux colonnes « étirables » sont *strictement identiques* ; on cherche la plus longue plage de colonnes adjacentes égales la plus proche du centre → `left = début`, `right = W − fin − 1` ; idem lignes. Tolérance ≤ 2/255 pour de l'art non quantifié. | ~60 lignes ; c'est ce que font les scripts « auto border » partagés sur les forums Unity/Godot. Détaillé en §3. |
| Autocorrélation de signature de colonnes (période) | https://docs.scipy.org/doc/scipy/reference/signal.html | BSD-3 | Python | technique | ★★★ | 2 | Si aucune plage uniforme (centre à motif/dither), on hache chaque colonne et on cherche la plus petite période *p* telle que `col[i] == col[i+p]` sur une fenêtre centrale → zone tuilable de longueur multiple de *p* → `axis_stretch = TILE`. | Correspond au mode `AXIS_STRETCH_MODE_TILE` de Godot (valeur 1) et au `tileMode: Repeat` de GameMaker. |
| Variance par colonne / comparaison des colonnes adjacentes (OpenCV) | https://opencv.org | Apache-2.0 | Python | technique | ★★★ | 1 | `np.abs(np.diff(img, axis=1)).sum(axis=(0,2))` → profil ; les creux = colonnes redondantes. Plus tolérant au bruit que l'égalité stricte ; échoue sur dégradés verticaux (colonnes égales mais lignes différentes → étirable *horizontalement seulement*). | Traiter les deux axes séparément : produit naturellement le « 3-slice » de Phaser (`topHeight = 0`). |
| Android `draw9patch` / format `.9.png` ⚠️ (outil retiré, code Apache-2.0) | https://developer.android.com/develop/ui/views/graphics/drawables#nine-patch | Apache-2.0 (code AOSP) | Java | outil + format | ★★★ | 1 (format) | Pas d'auto-détection ; mais le **format source** `.9.png` (bordure 1 px : pixels noirs en haut/gauche = zones étirables, bas/droite = zone de contenu) est le seul format d'échange 9-slice lu par plusieurs outils (libGDX TexturePacker, Android Studio). | Idée : émettre un `.9.png` à côté du PNG nu (§3). |
| libGDX TexturePacker (splits/pad) | https://github.com/libgdx/libgdx | Apache-2.0 | Java | outil | ★★★★ | 2 | Lit les `.9.png`, écrit `split: l,r,t,b` et `pad:` dans l'atlas `.atlas` texte. | Cible libGDX gratuite si l'on produit des `.9.png`. |
| `ninepatch` (PyPI) | https://pypi.org/project/ninepatch/ | MIT **(à vérifier)** | Python | lib | ★★ | 1 | Découpe/étire un `.9.png` et le prévisualise ; pas de détection. | Utile pour l'**aperçu d'étirement** côté serveur si l'on adopte `.9.png`. |
| Aseprite « Slices » avec centre 9-slice ⚠️ | https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md | EULA (source-available) ; spec ouverte | C++ | format | ★★★★ | 2 | Le chunk Slice (0x2022) stocke, drapeau 1, un **centre 9-slice** et, drapeau 2, un **pivot** ; l'export JSON expose `meta.slices[].keys[].center`. | Notre `borders` ↔ `center = (left, top, w−left−right, h−top−bottom)`. |
| Godot `StyleBoxTexture` / `NinePatchRect` | https://github.com/godotengine/godot/blob/master/doc/classes/StyleBoxTexture.xml | MIT | — | format | ★★★★ | 1 | Propriétés : `texture_margin_left/top/right/bottom` (float), `expand_margin_*`, `axis_stretch_horizontal/vertical` (0 STRETCH, 1 TILE, 2 TILE_FIT), `region_rect`, `draw_center`, `modulate_color`. | Vérifié sur le XML de référence. |
| Phaser `NineSlice` (≥ 3.60) / PixiJS v8 `NineSliceSprite` | https://docs.phaser.io/api-documentation/class/gameobjects-nineslice · https://pixijs.download/release/docs/scene.NineSliceSprite.html | MIT / MIT | JS | runtime | ★★★★ | 1 | Phaser : `leftWidth,rightWidth,topHeight,bottomHeight` ; hauteurs à 0 = **3-slice** ; *ne supporte pas les textures « trimmed »* ; taille min = somme des bords. Pixi : mêmes 4 valeurs + `width/height`. | À utiliser dans le playground pour valider visuellement. |

**Comparaison.** Aucune brique « prête » ne fait la détection : la solution est un module maison de ~150 lignes NumPy combinant (1) plages de colonnes/lignes identiques (cas pixel art), (2) profil de différence avec tolérance (cas HD), (3) autocorrélation pour le mode *tile*, (4) symétrisation (`|left − right| ≤ 2 px` → moyenne, car les cadres pixel art sont presque toujours symétriques), (5) score de confiance = longueur de plage / (largeur − 2 × bord minimal). Le bouton « Suggest » de SpriteCook correspond à (1)+(4). L'**aperçu d'étirement** doit être calculé côté serveur (Pillow : découpe des 9 tuiles, `resize(NEAREST)` ou tuilage, recomposition à 2 tailles ; contrôle : l'image reconstruite à taille identique doit être *exactement* l'originale, et les colonnes/lignes d'un même bord doivent rester égales après étirement) *et* côté client (Phaser/Pixi NineSlice). Recommandation : **module maison + `.9.png` comme format pivot + validation Phaser**.

### 2.2 Classification rôle/état, regroupement, nommage

| Nom | URL | Licence | Langage | Type | Maturité | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| Heuristiques géométriques + score 9-slice (NumPy) | — | BSD-3 | Python | technique | ★★★ | 1 | Ratio, taille relative à la grille, symétrie horizontale, « étirabilité » (§2.1) : bouton ≈ 2,5–6:1 étirable ; cadre ≈ 1–2:1 grand et étirable ; diviseur > 8:1 mince ; jauge = mince, longue, intérieur plat ; icône ≈ 1:1 petite non étirable ; case à cocher = petit carré ; curseur = bande + bouton rond. | Couvre ~70 % des cas à coût nul ; à mettre **avant** le ML comme prior. |
| SigLIP 2 (zero-shot) | https://huggingface.co/google/siglip2-base-patch16-224 | Apache-2.0 | Python (transformers) | modèle | ★★★★ | 2 | `pipeline("zero-shot-image-classification")` avec labels « a pixel art game UI button », « …panel frame », « …icon », « …slider », « …checkbox », « …progress bar » ; base = ~375 Mo, CPU OK. | Vérifié : exemple officiel de classification zero-shot. Meilleur que CLIP sur petits objets. |
| OpenAI CLIP / open_clip | https://github.com/openai/CLIP | MIT | Python | modèle | ★★★★ | 2 | Même usage ; plus faible que SigLIP2 sur les petites vignettes. | Repli. |
| Florence-2 (base/large) | https://huggingface.co/microsoft/Florence-2-large | MIT | Python | modèle (0,23 B / 0,77 B) | ★★★ | 2 | Caption, OD, dense region caption, OCR, **open-vocabulary detection**, grounding ; CPU possible pour base. | Pour **nommer** (`<MORE_DETAILED_CAPTION>` sur la vignette) et lire les textes des boutons (OCR) → `button_play`. |
| Qwen2.5-VL 3B/7B Instruct | https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct | Apache-2.0 | Python | VLM | ★★★★ | 3 | Grounding (boîtes), **sorties JSON stables**, OCR, compréhension de layouts/icônes. 7B en fp16 dépasse 8 Go → 3B ou 4-bit en local, 7B via API. | Idéal pour un passage « planche entière → JSON {nom, rôle, état, notes} » avec schéma imposé. |
| Grounding DINO / OWLv2 | https://github.com/IDEA-Research/GroundingDINO | Apache-2.0 / Apache-2.0 | Python | détection open-vocab | ★★★ | 3 | Détection par texte (« button. panel. icon. ») directement sur le **concept plein écran** (fond non transparent). | Permet d'extraire des composants sans passer par la planche (§3). |
| OmniParser v2 ⚠️ (Microsoft) | https://github.com/microsoft/OmniParser | Code CC-BY-4.0 ; détecteur YOLO **AGPL-3.0** ; captionneur Florence MIT | Python | outil | ★★★ | 3 | Détecte les régions interactives (boutons, icônes) dans des captures d'écran + description fonctionnelle. Entraîné sur des UI web/OS, pas du pixel art. | AGPL viral sur le détecteur → référence seulement, ou service isolé. |
| DINOv2 (ViT-S/14) | https://github.com/facebookresearch/dinov2 | Apache-2.0 (code et poids) | Python | embeddings | ★★★★ | 2 | Similarité visuelle robuste → regrouper les états d'un même composant (même forme, couleurs différentes) et dédoublonner. | 21 M params, CPU OK. |
| imagehash + SSIM (scikit-image) | https://github.com/JohannesBuchner/imagehash · https://scikit-image.org | BSD-2 / BSD-3 | Python | lib | ★★★★ | 1 | Regroupement bon marché : `phash` sur le **masque alpha** (forme) + distance de palette ; SSIM pour ordonner les variantes. | Premier passage avant DINOv2. |
| Régression logistique/`LightGBM` sur features (sklearn) | https://scikit-learn.org | BSD-3 | Python | technique | ★★★ | 2 | Une fois 200–500 composants annotés (via l'UI de correction), entraîner un petit classifieur sur [features géométriques + embedding SigLIP] : plus fiable que le zero-shot pur. | Boucle d'apprentissage produit. |

**Comparaison / recommandation.** Pipeline en cascade : (1) heuristiques + étirabilité → rôle probable et `stretchable` ; (2) regroupement des variantes par **masque de forme** (phash du masque, IoU après recentrage, taille ±2 px) → un « composant » = un groupe ; (3) ordre des états dans le groupe par **luminance moyenne** (le plus clair = HOVER), **décalage vertical du contenu** (+1 px = PRESSED), **saturation minimale** (DISABLED), **contour accent** (SELECTED) ; (4) SigLIP2 zero-shot en arbitre sur les rôles ambigus ; (5) Florence-2 (OCR + caption) ou Qwen2.5-VL pour le **nommage** en snake_case ; (6) `quality_summary` calculé (orphelins, hors grille, hors palette, halos alpha, bords non étirables sur un rôle étirable). Tout tourne sur CPU sauf Qwen 7B (API).

### 2.3 Variantes d'état par algorithme (plutôt que par IA)

| Nom | URL | Licence | Langage | Type | Maturité | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| « Ramp shift » sur palette | — | — | Python | technique | ★★★★ | 2 | Détecter les rampes de la palette (clusters de teinte triés par luminance) ; HOVER = chaque pixel monte d'un cran sur sa rampe, PRESSED = descend d'un cran + décalage du contenu de 1 px vers le bas, DISABLED = projeter vers la rampe grise, SELECTED = contour remplacé par la couleur d'accent. Reste **strictement dans la palette**. | Technique canonique des pixel artists ; le contour (couleur la plus sombre) reste intact. |
| OKLCH (coloraide) | https://github.com/facelessuser/coloraide | MIT | Python | lib | ★★★★ | 1 | Éclaircir (L +8 %), assombrir (L −10 %), désaturer (C ×0,2) perceptuellement uniformes ; puis re-quantifier à la palette la plus proche en interdisant la couleur d'origine (sinon l'état devient identique). | Pour l'art HD ou les palettes libres. Formules OKLab de Björn Ottosson : domaine public/MIT, 20 lignes si l'on veut éviter la dépendance. |
| Pillow `ImageOps` / NumPy LUT | https://pillow.readthedocs.io | MIT-CMU (HPND) | Python | lib | ★★★★ | 1 | LUT par couleur unique de l'image (≤ 256 en pixel art) → transformation en O(n). | Base de l'implémentation. |
| Godot `modulate` / Unity `ColorBlock` ⚠️ (côté moteur) | https://docs.godotengine.org | MIT | — | référence | ★★★★ | 1 | Les moteurs peuvent teinter à l'exécution ; mais l'artiste veut des PNG explicites. | Exporter *aussi* les valeurs de teinte dans le Theme Godot (`Button/colors/*`). |

**Recommandation.** Ramp shift quand une palette Lospec/projet est imposée ; OKLCH + re-quantification sinon. Toujours générer les 4 variantes à partir du NORMAL et proposer à l'utilisateur de remplacer par une version IA s'il le souhaite (jamais l'inverse).

### 2.4 Maquette d'écran : prompts, gabarits, outils d'assemblage, kits libres

| Nom | URL | Licence | Langage | Type | Maturité | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| Gabarits de layout JSON (maison) + LLM ouvert | — | — | Python | technique | ★★★ | 2 | Pour chaque type d'écran (main menu, HUD, pause, settings, inventory, dialogue, shop, quest log, character select, map, game over, credits) un JSON de boîtes normalisées sur 16:9 et 9:16 ; un LLM ouvert (Qwen3/Llama 3) instancie les libellés/slots selon le genre. Rendu déterministe (Pillow) avec composants procéduraux + police pixel → **maquette exacte** à 384×216 / 640×360. | Le concept IA devient optionnel (img2img de stylisation par-dessus), et la maquette est *déjà* faite de composants réutilisables. |
| Penpot | https://github.com/penpot/penpot | MPL-2.0 | Clojure/JS | outil design | ★★★★ (58 k★) | 3 | Self-hostable (Docker), composants + variants, export SVG/PNG, **API ouverte + plugins + MCP**. | Pour l'assemblage manuel « design system » : importer les composants PNG/SVG comme bibliothèque, laisser l'utilisateur composer. Pas pixel-perfect natif (désactiver l'AA à l'export → re-quantifier). |
| Excalidraw | https://github.com/excalidraw/excalidraw | MIT | TS | outil wireframe | ★★★★ | 2 | Composant React embarquable ; wireframes rapides (boîtes + libellés) → JSON exploitable comme gabarit de layout. | Bon pour la phase « croquis » côté client. |
| Piskel | https://github.com/piskelapp/piskel | Apache-2.0 | JS | éditeur pixel web | ★★★ (peu actif) | 3 | Embarquable dans l'app pour retouches pixel dans le navigateur. | Alternative : éditeur maison canvas (voir fiche 02). |
| Pixelorama | https://github.com/Orama-Interactive/Pixelorama | MIT | GDScript | éditeur pixel | ★★★★ (9,7 k★, v1.1.10 avril 2026) | 4 (desktop) | Palettes, tilemaps, export spritesheet ; pas de 9-slice. | Recommander aux utilisateurs comme éditeur externe libre. |
| LibreSprite | https://github.com/LibreSprite/LibreSprite | GPL-2.0 | C++ | éditeur pixel | ★★★ | — | Fork libre d'Aseprite 1.x ; lit/écrit `.ase`. | Référence pour un écrivain `.ase` maison. |
| NES.css | https://github.com/nostalgic-css/NES.css | MIT (21,8 k★, dernière release 2019) | SCSS | kit CSS | ★★★ | 1 | Boutons, conteneurs, dialogues, barres, icônes ; police Press Start 2P. | Inspiration de *paramétrage* (bordure 4 px, coins crantés, ombre 1 px) ; pas d'assets PNG réutilisables. |
| RPGUI | https://github.com/RonenNess/RPGUI | zlib (944★, 2016) | CSS/JS | kit CSS | ★★ | 1 | Cadres (4 styles), boutons, sliders, barres, checkbox, radio, dropdown, 15 icônes ; **images PNG incluses** (1,35 Mo) sous zlib. | Peut servir de kit de démarrage recolorable. |
| 98.css / PSone.css | https://github.com/jdan/98.css | MIT / MIT **(à vérifier pour PSone)** | CSS | kit CSS | ★★ | 1 | Style Windows 98 (bevel 2 px) : bon modèle de « bouton bevel » procédural. | Inspiration. |
| Kenney UI Pack / Pixel UI Pack / Fantasy UI Borders | https://kenney.nl/assets | CC0 | PNG | assets | ★★★★ | 1 | Centaines de cadres/boutons 9-slice-ready ; CC0 sans attribution. | Base de test pour la détection 9-slice et thème « fallback » sans IA. |
| OpenGameArt (UI) | https://opengameart.org/art-search-advanced?keys=ui | CC0 / CC BY / GPL selon l'œuvre | PNG | assets | ★★★ | 1 | Vérifier la licence *par pack*. | Ne pas embarquer sans filtre de licence. |

**Recommandation.** Approche « **layout d'abord** » : gabarit JSON + composants procéduraux/IA + police pixel → rendu exact, puis stylisation IA facultative (ControlNet Tile/Canny sur la maquette, voir fiche 04). Penpot en option « design system » pour les studios ; Excalidraw embarqué pour le croquis. Kenney CC0 comme jeu de test et thème par défaut.

### 2.5 Cadres et boutons procéduraux (« UI theme » par algorithme)

| Nom | URL | Licence | Langage | Type | Maturité | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| Générateur de cadres maison (Pillow/NumPy) | — | — | Python | technique | ★★★ | 3 | Paramètres : taille de coin (px), épaisseur de bordure, rayon/crantage, couleurs (contour, bordure, bevel clair/sombre, fond), ombre portée 1–2 px, ligne intérieure, ornements de coin (sprites optionnels), motif de fond (uni/dither/damier). Sortie : PNG à l'échelle native, **bordures 9-slice connues par construction**, 5 états dérivés par §2.3. | Aucun équivalent open source recensé ; ~500 lignes. Reprendre le vocabulaire de `StyleBoxFlat` Godot (corner radius, border width, shadow, skew) pour la compatibilité (§3). |
| RPG Maker « windowskin » ⚠️ | https://www.rpgmakerweb.com | Propriétaire | — | référence | ★★★★ | — | Une image 128×128 (MV/MZ 192×192) contenant fond, cadre, curseur, flèches, pause, palette de couleurs de texte : modèle de **planche de thème compacte**. | Inspire notre « theme sheet » : un PNG + JSON de régions. |
| Godot `StyleBoxFlat` | https://docs.godotengine.org/en/stable/classes/class_styleboxflat.html | MIT | — | format | ★★★★ | 1 | Cadre vectoriel paramétrique (bg_color, border_width_*, corner_radius_*, shadow_*, anti_aliasing=false pour le pixel). | Export « sans texture » possible pour les thèmes simples. |
| Kenney (CC0) recoloré par palette | https://kenney.nl/assets | CC0 | PNG | assets | ★★★★ | 1 | Recoloration par LUT (§2.3) d'un kit CC0 = thème instantané sans IA. | Mode « hors ligne ». |

### 2.6 Polices pixel : catalogue libre, fabrication, formats, rendu

| Nom | URL | Licence | Langage | Type | Maturité | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| Press Start 2P, Silkscreen, VT323, Pixelify Sans, DotGothic16, Jersey 10/15/20/25, Tiny5, Micro 5 (Google Fonts) | https://fonts.google.com | **OFL 1.1** | TTF | polices | ★★★★ | 1 | Toutes redistribuables, y compris commercialement ; Tiny5/Micro 5 (2024) sont conçues pour 5 px ; Jersey pour 10–25 px. | Vérifier le `OFL.txt` du dépôt google/fonts par famille. |
| Departure Mono | https://departuremono.com | OFL 1.1 | TTF/OTF/WOFF | police | ★★★ | 1 | Monospace pixel moderne (2024), rendu net à 11 px. | Pour les HUD techniques. |
| Ark Pixel / Fusion Pixel (TakWolf) | https://github.com/TakWolf/ark-pixel-font | OFL 1.1 | Python (build) | polices | ★★★ | 1 | 10/12/16 px, latin + CJK ; construites avec `pixel-font-builder`. | Preuve que le pipeline bitmap→OTF fonctionne à grande échelle. |
| Monogram (datagoblin) | https://datagoblin.itch.io/monogram | CC0 **(à vérifier)** | TTF | police | ★★★ | 1 | Très populaire, 5×7/extended. | — |
| m5x7 / m3x6 / m6x11 (Daniel Linssen) | https://managore.itch.io/m5x7 | **CC0 1.0** (page itch : « free to use but attribution appreciated ») | TTF | police | ★★★★ | 1 | Standard de facto des jams ; 5 px de large, ascendante 7 px, descendante 2 px ; tailles 16/32/48. | Embarquable ; vérifier m3x6/m6x11 individuellement. |
| **pixel-font-builder** (TakWolf) | https://github.com/TakWolf/pixel-font-builder | **MIT** (486 commits) | Python | lib | ★★★ | 2 | Glyphes définis en **tableaux 2D de bits** (`bitmap=[[1,0,1],…]`, offsets, advance) → OTF/OTC, TTF/TTC, WOFF/WOFF2, OTB, dfont, BDF, PCF, bitmap-only SFNT. | Brique clé « planche de glyphes → .ttf » en pur Python ; base des polices Ark/Fusion Pixel. |
| fontTools | https://github.com/fonttools/fonttools | MIT | Python | lib | ★★★★ | 3 | Écriture bas niveau de TTF/OTF (pens, `glyf`, `cmap`, `hmtx`) ; utilisé par pixel-font-builder. | Pour tout ce que le précédent ne couvre pas (kerning, variable). |
| FontForge (scriptable Python) | https://github.com/fontforge/fontforge | GPL-3.0 (7,9 k★) | C/Python | outil | ★★★★ | 3 | Import bitmap → autotrace/potrace, export TTF/OTF/BDF ; appelé en sous-processus (le GPL ne contamine pas les polices produites). | Repli robuste ; lourd à empaqueter. |
| Bits'N'Picas | https://github.com/kreativekorp/bitsnpicas | Licence non affichée sur GitHub — **MPL-2.0 (à vérifier sur kreativekorp.com)** | Java | outil GUI+CLI | ★★★ (446★, v2.2 fév. 2026) | 2 | Import **depuis image** (GUI), export TTF, OTB, BDF, PSF, .fnt Windows, Playdate… ; CLI `convertbitmap -f ttf`. | Le plus complet des éditeurs bitmap libres. |
| SnowB BMF | https://github.com/SilenceLeo/snowb-bmf | MIT (559★) | TS (React) | outil web | ★★★ | 2 | Générateur BMFont dans le navigateur, tout en local ; exporte **.fnt texte/XML/binaire, JSON, MSDF JSON, C header** ; compatible Unity, Godot, Phaser 3, PixiJS. | Embarquable (React) dans notre front pour le réglage manuel. |
| fontbm | https://github.com/vladimirgamalyan/fontbm | MIT (299★) | C++ | CLI | ★★★ | 2 | BMFont compatible (FreeType) : `--monochrome` (pas d'AA), `--data-format txt/xml/bin/json`, padding/spacing, kerning. | TTF pixel → atlas .fnt net en une commande. |
| msdf-atlas-gen | https://github.com/Chlumsky/msdf-atlas-gen | MIT (1,3 k★, v1.4 mars 2026) | C++ | CLI | ★★★★ | 2 | Atlas hardmask/softmask/SDF/PSDF/MSDF/MTSDF ; JSON/CSV/Artery. | Pour l'HD (texte redimensionnable) ; `hardmask` donne du bitmap net. |
| Hiero (libGDX) | https://github.com/libgdx/libgdx | Apache-2.0 | Java | outil GUI | ★★★ | 2 | Génère .fnt AngelCode ; option « none » pour l'AA. | Référence. |
| BMFont (AngelCode) ⚠️ | https://www.angelcode.com/products/bmfont/ | Freeware Windows (propriétaire) | — | outil | ★★★★ | — | Définit le **format .fnt** (texte/XML/binaire). | Format à implémenter ; c'est 40 lignes en Python. |
| Godot `FontFile` | https://github.com/godotengine/godot/blob/master/doc/classes/FontFile.xml | MIT | — | format | ★★★★ | 1 | `load_bitmap_font()` (AngelCode `.fnt`/`.font`) et `load_dynamic_font()` (TTF/OTF/WOFF) confirmés ; propriétés : `antialiasing` (TextServer : 0 NONE, 1 GRAY par défaut, 2 LCD), `hinting` (0 NONE), `subpixel_positioning` (0 DISABLED, 1 AUTO par défaut), `oversampling`, `fixed_size`, `fixed_size_scale_mode` (1 = INTEGER pour les bitmaps), `generate_mipmaps`, `multichannel_signed_distance_field`. | Émettre un `.tres` FontFile pré-réglé : `antialiasing = 0`, `hinting = 0`, `subpixel_positioning = 0`, `generate_mipmaps = false`, `fixed_size_scale_mode = 1`. |
| Phaser `BitmapText` / Pixi `BitmapText` / Kaplay `loadBitmapFont` | https://docs.phaser.io | MIT | JS | runtime | ★★★★ | 1 | Phaser charge le `.fnt` **XML** ; Kaplay charge une image-grille de glyphes (`loadBitmapFont(name, src, gw, gh)`). | Playground. |

**Fabrication d'une police depuis une planche de glyphes générée** (recommandé) : demander au modèle une grille fixe (16 colonnes × 6 lignes, cases de 32 px, un caractère ASCII par case, dans l'ordre, fond transparent ou chroma) ; découpe par grille + correction de dérive (fiche 05) ; binarisation ; **trim** horizontal par glyphe (largeur proportionnelle) ou largeur fixe (monospace) ; **baseline** = mode statistique de la dernière ligne encrée des lettres sans jambage (`a c e m n o …`) ; `lineHeight` = hauteur de case ; `xadvance = largeur + 1` ; espace = 1/3 de la case. Sorties : (1) `.fnt` texte + XML + PNG (écrivain maison), (2) `.ttf` via **pixel-font-builder** (chaque pixel → carré, contours fusionnés), (3) `.bdf/.pcf` idem. Validation : rendu d'une phrase-test à ×1/×2/×3 avec Pillow en mode « 1 » (sans AA).

### 2.7 Icônes : bases libres et uniformisation

| Nom | URL | Licence | Langage | Type | Maturité | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| game-icons.net | https://github.com/game-icons/icons | **CC BY 3.0** (attribution par artiste) | SVG | assets | ★★★★ (1,3 k★) | 1 | ~4 000 icônes monochromes, scripts de colorisation/PNG fournis. | Pipeline SVG → raster 16/24/32 → pixelisation → recoloration palette. Générer l'`ATTRIBUTIONS.md` automatiquement. |
| pixelarticons | https://github.com/halfmage/pixelarticons | MIT (770★, v2.1.2 mai 2026) | SVG/React/webfont | assets | ★★★★ | 1 | 800 icônes gratuites sur grille **24×24 sans AA**, `fill="currentColor"` ; 2 000+ payantes. | Déjà pixel-perfect : parfait pour les icônes de HUD/settings. |
| Kenney Game Icons / Board Game Icons | https://kenney.nl/assets/game-icons | CC0 | PNG/SVG | assets | ★★★★ | 1 | Sans attribution. | Icônes système (pause, son, manette). |
| resvg / cairosvg | https://github.com/linebender/resvg · https://github.com/Kozea/CairoSVG | MPL-2.0 / LGPL-3.0 | Rust (py : `resvg-py`) / Python | lib | ★★★★ | 1 | Rasterisation SVG exacte ; resvg est plus fidèle. | — |
| Pixelisation + contour (NumPy) | — | — | Python | technique | ★★★ | 2 | Downscale `BOX` puis seuil alpha, quantification palette, contour 1 px par dilatation du masque alpha, ombre 1 px décalée ; **normalisation d'occupation** (l'icône occupe 70–80 % de la cellule), centrage par bbox. | « Icon consistency » mesurable : occupation, couleur de contour, direction de lumière (centroïde des pixels clairs vs sombres). |
| potrace / vtracer | https://potrace.sourceforge.net · https://github.com/visioncortex/vtracer | GPL-2.0 / MIT (6,6 k★, `pip install vtracer`) | C / Rust | lib | ★★★★ | 1 | Vectorisation d'un logo/icône généré (vtracer : `color_precision`, `filter_speckle`, `mode=polygon/spline`) → SVG → re-raster à toutes tailles. | Pour le **logo d'écran titre** et les icônes HD. MIT → préférer vtracer. |

**Recommandation.** Deux voies : « icônes IA » (planche générée → fiche 05 → normalisation ci-dessus → cadres procéduraux) et « icônes libres » (game-icons/pixelarticons → pixelisation/recoloration). Dans les deux cas, un **score de cohérence** par lot (occupation, contour, palette) et un `ATTRIBUTIONS.md` automatique.

### 2.8 Formats d'export moteurs (structure exacte et librairies)

| Cible | Format | URL doc | Licence outil/format | Ce qu'il faut écrire | Lib / approche | Cx |
|---|---|---|---|---|---|---|
| **Godot 4 — SpriteFrames** | `.tres` texte | https://docs.godotengine.org/en/stable/classes/class_spriteframes.html | MIT | `[gd_resource type="SpriteFrames" load_steps=N format=3]`, `[ext_resource type="Texture2D" path="res://…png" id="1_x"]`, un `[sub_resource type="AtlasTexture" id="…"]` par frame (`atlas = ExtResource("1_x")`, `region = Rect2(x,y,w,h)`, `margin` si trim), `[resource] animations = [{"frames":[{"duration":1.0,"texture":SubResource("…")}], "loop":true, "name":&"idle", "speed":8.0}]`. API : `add_animation`, `add_frame(anim, tex, duration, at)`, `set_animation_speed`, `set_animation_loop_mode` (LOOP_NONE/LINEAR/PINGPONG). | Écrivain texte maison (Jinja2) ; omettre `uid=` (Godot le génère) ou générer le `.import` correspondant. | 2 |
| Godot 4 — TileSet + terrains | `.tres` | https://docs.godotengine.org/en/stable/classes/class_tilesetatlassource.html | MIT | `[sub_resource type="TileSetAtlasSource"]` : `texture`, `texture_region_size = Vector2i(16,16)`, `margins`, `separation`, `use_texture_padding` ; tuiles par clé `x:y/alt = 0`, puis `x:y/0/terrain_set = 0`, `x:y/0/terrain = 0`, `x:y/0/terrains_peering_bit/right_side = 0` (16 bits : `*_side`, `*_corner`) ; `[resource]` : `tile_size`, `terrain_set_0/mode` (0 corners+sides, 1 corners, 2 sides), `terrain_set_0/terrain_0/name`, `/color`, `sources/0 = SubResource(…)` ; physique : `physics_layer_0/collision_layer`, `x:y/0/physics_layer_0/polygon_0/points = PackedVector2Array(…)`. | Écrivain maison ; **valider en ouvrant le .tres dans Godot 4.3/4.4/4.5** (syntaxe des clés vérifiée sur l'API `set("<x>:<y>/<alt>/<prop>")`). | 3 |
| Godot 4 — StyleBoxTexture + Theme | `.tres` | https://docs.godotengine.org/en/stable/classes/class_theme.html | MIT | `[sub_resource type="StyleBoxTexture"]` : `texture`, `texture_margin_*`, `axis_stretch_*`, `region_rect` ; `[resource]` Theme : `default_font`, `default_font_size`, `Button/styles/normal|hover|pressed|disabled|focus`, `Panel/styles/panel`, `PanelContainer/styles/panel`, `ProgressBar/styles/background|fill`, `HSlider/styles/slider|grabber_area`, `HSlider/icons/grabber`, `CheckBox/icons/checked|unchecked`, `HSeparator/styles/separator`, `LineEdit/styles/normal|focus`. | Mapping rôle/état → item de thème (tableau §4) ; écrivain maison. | 2 |
| Godot — réglages d'import | `project.godot` / `.import` | https://docs.godotengine.org/en/stable/tutorials/2d/2d_sprite_animation.html | MIT | Ne **pas** livrer les `.import` (chemins hachés) ; livrer un extrait `project.godot` : `[rendering] textures/canvas_textures/default_texture_filter=0` (Nearest) et `[importer_defaults] texture={"mipmaps/generate": false, "detect_3d/compress_to": 0}` ; `[display] window/stretch/mode="canvas_items"`, `window/stretch/scale_mode="integer"`. | Plugin minimal `addons/<nom>/plugin.cfg` + `EditorImportPlugin` lisant notre `manifest.json` (modèle : godot-aseprite-wizard, MIT, 1,3 k★, v9.8 mars 2026). | 2–3 |
| **Unity — Sprite .meta** | YAML | https://docs.unity3d.com/Manual/texture-type-sprite.html | Propriétaire (format lisible) | `TextureImporter:` `textureType: 8`, `spriteMode: 2`, `spritePixelsToUnits: 16`, `spriteMeshType: 0` (FullRect), `textureSettings: {filterMode: 0, wrapU: 1}`, `mipmaps: {enableMipMap: 0}`, `spriteBorder: {x,y,z,w}` ; `spriteSheet.sprites[]` : `name`, `rect {x,y,w,h}` (**origine en bas à gauche**), `alignment` (0 Center … 9 Custom), `pivot {0..1}`, `border {x: gauche, y: bas, z: droite, w: haut}`, `spriteID` (32 hex), `internalID` (int64) ; `nameFileIdTable` / `internalIDToNameTable`. Référence à un sprite depuis un autre asset : `{fileID: <internalID>, guid: <guid>, type: 3}`. | Générer avec PyYAML **en préservant l'en-tête** `%YAML 1.1 %TAG !u!` ; **(à vérifier sur un .meta produit par l'Unity cible, `serializedVersion` change)**. | 3 |
| Unity — AnimationClip / AnimatorController | `.anim` / `.controller` YAML | — | Propriétaire | `.anim` : `AnimationClip: m_SampleRate, m_PPtrCurves[{curve:[{time, value:{fileID,guid,type:3}}], attribute: m_Sprite, classID: 212}]`, `m_AnimationClipSettings.m_LoopTime`. Le `.controller` (states, transitions, layers) est verbeux. | Générer `.anim` en YAML ; pour le contrôleur, livrer un **script Editor C#** (menu « Import pack ») qui appelle `AnimatorController.CreateAnimatorControllerAtPath` — c'est la voie SpriteCook. | 3 |
| Unity — Rule Tile | `.asset` YAML | https://github.com/Unity-Technologies/2d-extras | Package `com.unity.2d.tilemap.extras` (Unity Companion License) ; dépôt GitHub original en lecture seule | `MonoBehaviour: m_Script: {guid: <guid RuleTile du package>}`, `m_DefaultSprite`, `m_TilingRules[{m_Sprites[], m_Neighbors[], m_NeighborPositions[{x,y}], m_Output, m_ColliderType}]` (1 = This, 2 = NotThis). | Le GUID du script dépend du package → **script Editor** plus sûr que YAML brut ; sinon lire le `.meta` de `RuleTile.cs` à l'import. | 4 |
| Unity — `.unitypackage` | tar.gz | https://docs.unity3d.com/Manual/AssetPackages.html | — | Archive **tar.gz** ; un dossier par GUID contenant `asset` (octets), `asset.meta`, `pathname` (`Assets/Pack/hero.png`), `preview.png` facultatif ; les dossiers n'ont que `asset.meta` + `pathname`. | `tarfile` Python (`w:gz`). Modèle : *unitypackage_extractor* (MIT) **(à vérifier)**. | 2 |
| **Phaser 3/4 — atlas** | JSON hash/array | https://docs.phaser.io/phaser/concepts/loader | MIT | `{"frames":{"name":{"frame":{x,y,w,h},"rotated":false,"trimmed":false,"spriteSourceSize":{x,y,w,h},"sourceSize":{w,h},"pivot":{x,y}}},"meta":{"image":"…png","size":{w,h},"scale":"1"}}` ; spritesheet : `{frameWidth, frameHeight, margin, spacing, startFrame, endFrame}` ; `anims.generateFrameNames(key,{prefix,start,end})` ; **pas de trim pour NineSlice**. | Écrivain JSON maison ; **free-tex-packer-core** (MIT) exporte déjà JsonHash/JsonArray/Phaser3/Pixi/GodotAtlas/GodotTileset/Unity3D/Spine/Cocos2d/Starling/XML/UIKit/Unreal/Egret + templates. | 1 |
| Phaser — Aseprite JSON | JSON | https://docs.phaser.io | MIT | `this.load.aseprite(key, png, json)` + `this.anims.createFromAseprite(key)` lit `meta.frameTags`. | Émettre le JSON « Aseprite » (§3) = une animation par tag gratuite. | 1 |
| **Tiled** | `.tsx`/`.tmx`/JSON | https://doc.mapeditor.org/en/stable/reference/tmx-map-format/ | libtiled BSD-2 / app GPL-2.0 | `<tileset version="1.10" name tilewidth tileheight spacing margin tilecount columns><image source width height/> <tile id><animation><frame tileid duration/></animation></tile> <wangsets><wangset name type="corner|edge|mixed" tile="-1"><wangcolor name color tile probability/><wangtile tileid wangid="t,tr,r,br,b,bl,l,tl"/></wangset></wangsets></tileset>` (0 = non défini ; type *corner* n'utilise que les 4 positions impaires). | `xml.etree` ; lecteurs : pytiled-parser (MIT), pytmx (LGPL-3.0). | 2 |
| **LDtk** | `.ldtk` JSON | https://ldtk.io/json/ | MIT (4,1 k★) | `defs.tilesets[]` : `uid, identifier, relPath, pxWid, pxHei, tileGridSize, spacing, padding, tags, enumTags, customData` ; auto-layer : `defs.layers[].autoRuleGroups[].rules[]` avec `size` (1/3/5/7), `pattern` (valeurs IntGrid : n = doit contenir, −n = ne doit pas, 0 = indifférent), `tileRectsIds`, `chance`, `breakOnMatch`, `flipX/flipY`, `xModulo/yModulo`. Schéma JSON publié (`JSON_SCHEMA.json`). | Générer un mini-projet `.ldtk` avec IntGrid + règles blob-47 à partir du terrain set. **(champs à valider contre le schéma 1.5.x)**. | 4 |
| **Aseprite** | `.aseprite` binaire + JSON export | https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md | Spec ouverte (fichier dans le dépôt) ; app EULA | En-tête 128 o (magic 0xA5E0), frames (0xF1FA, durée ms), chunks : Layer 0x2004, Cel 0x2005 (zlib), Palette 0x2019, **Tags 0x2018** (from/to, direction 0–3, repeat), **Slice 0x2022** (flag 1 : centre 9-slice ; flag 2 : pivot). Export JSON (`aseprite -b --sheet --data --format json-hash --list-tags --list-slices`) : `frames{…"duration"}`, `meta.frameTags[{name,from,to,direction,repeat}]`, `meta.slices[{name,keys[{frame,bounds,center,pivot}]}]`. | Lecteurs : py_aseprite (MIT, lecture seule, 23★), ase-parser (npm, lecture) ; **écrivain `.ase` maison** (~300 lignes, `struct` + `zlib`) — LibreSprite (GPL-2.0) comme référence de code. | 3 |
| GameMaker 2023+ ⚠️ | `.yy` JSON | https://manual.gamemaker.io | Propriétaire | `resourceType: "GMSprite"`, `width/height`, `frames[{name: <uuid>}]` + `<uuid>.png` + `layers/<layer>/<uuid>.png`, `sequence.tracks[0].keyframes` (une clé par frame), `playbackSpeed`, `origin`, **`nineSlice {enabled,left,top,right,bottom,tileMode[5]}`** (0 Stretch, 1 Repeat, 2 Mirror, 3 Blank End, 4 Hide ; ordre gauche/haut/droite/bas/centre) **(à valider sur un projet GM récent)**. | JSON maison ; référence. | 3 |
| Defold ⚠️ | `.atlas`, `.tilesource`, `.gui` (protobuf texte) | https://defold.com/manuals/atlas/ | Defold License (source-available, non OSI) | `.atlas` : `images { image: "/x.png" }`, `animations { id, images{…}, playback: PLAYBACK_LOOP_FORWARD, fps, flip_horizontal }`, `margin`, `extrude_borders`, `inner_padding` ; `.tilesource` : `image, tile_width, tile_height, tile_margin, tile_spacing, animations{start_tile,end_tile}` ; GUI box node `slice9 {x,y,z,w}`. | Texte trivial à générer ; format protobuf-text **(à vérifier)**. | 2 |
| Construct 3 ⚠️ | `.c3p` (zip de JSON) | https://www.construct.net | Propriétaire | Objet **9-patch** natif ; animations par dossier d'images. | Export « dossier d'images + JSON descriptif » suffit ; référence. | — |
| Unreal Paper2D ⚠️ | `.uasset` | https://dev.epicgames.com | Propriétaire | Pas de format texte ; import via **script Python Editor** (`PaperSpriteFactory`, Flipbooks) ; UMG Box brush `Margin` pour le 9-slice. | Livrer le script Python + PNG/JSON. | 3 |
| Roblox ⚠️ | `.rbxmx` XML / API | https://create.roblox.com/docs | Propriétaire | `ImageLabel.ScaleType = Slice`, `SliceCenter = Rect(l,t,r,b)`, feuilles via `ImageRectOffset/ImageRectSize`. | Générer un module Lua de constantes. | 2 |
| libGDX | `.atlas` texte + `.9.png` | https://github.com/libgdx/libgdx | Apache-2.0 | `split: l,r,t,b`, `pad:`, `filter: Nearest,Nearest`. | Gratuit si l'on émet des `.9.png`. | 1 |
| TexturePacker ⚠️ | JSON hash/array, XML, plist, .tps | https://www.codeandweb.com/texturepacker | Propriétaire | Référence : les champs `frame/rotated/trimmed/spriteSourceSize/sourceSize/pivot` sont le **standard de fait** (Phaser, Pixi, LittleJS, Excalibur l'importent). | Notre JSON hash = ce schéma. | — |

**Recommandation.** Trois écrivains « premiers » (Godot `.tres`, Unity YAML + script Editor, JSON TexturePacker/Aseprite) couvrent 90 % du marché ; Tiled/LDtk pour les tilesets ; `.ase` pour les artistes. Utiliser **free-tex-packer-core** (MIT) côté Node ou un port Python (rectpack, Apache-2.0, MaxRects/Skyline/Guillotine) pour l'atlas, mais **écrire soi-même** les formats moteurs — ils tiennent chacun en 50–150 lignes et méritent des tests d'intégration (ouvrir dans Godot headless `godot --headless --import`, et dans Unity via un test batchmode).

### 2.9 Métadonnées d'atlas, réglages d'import, playground web

| Nom | URL | Licence | Langage | Type | Maturité | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| free-tex-packer / -core | https://github.com/odrick/free-tex-packer | MIT (1 257★, 2024) | JS | outil + lib | ★★★ | 1 | MaxRects/Optimal, trim, extrude, padding, POT, rotation, détection de doublons ; 18 exporteurs + templates. | Côté client (dans le navigateur) ou Node ; voir fiche 05 pour le packing serveur. |
| rectpack | https://github.com/secnot/rectpack | Apache-2.0 (558★) | Python | lib | ★★★ | 1 | MaxRects (4), Skyline (6), Guillotine (18), rotation. | Packing serveur. |
| **Phaser 3.90 / 4.x** | https://github.com/phaserjs/phaser | MIT | JS/TS | moteur web | ★★★★ | 2 | Consomme atlas JSON, Aseprite JSON, spritesheet, BMFont XML, NineSlice ; `pixelArt: true`, `zoom`, `roundPixels`. | **Playground recommandé** : mêmes fichiers que l'export. |
| KAPLAY | https://github.com/kaplayjs/kaplay | MIT (1,6 k★, v4000 alpha mai 2026) | TS | moteur web | ★★★ | 1 | `loadSpriteAtlas`, `sliceX/sliceY` + `anims`, **`slice9`**, `loadBitmapFont` ; éditeur KAPLAYGROUND embarquable. | Le plus simple pour un « mini-jeu de test » en 100 lignes. |
| PixiJS v8 | https://github.com/pixijs/pixijs | MIT | TS | rendu | ★★★★ | 2 | `NineSliceSprite`, `AnimatedSprite`, `BitmapText`, `Spritesheet` (JSON TexturePacker). | Pour un viewer sans logique de jeu. |
| Excalibur | https://github.com/excaliburjs/Excalibur | BSD-2 (2,3 k★, v0.32 déc. 2025) | TS | moteur web | ★★★ | 2 | `SpriteSheet.fromImageSource` (grille), `Animation.fromSpriteSheet`, `NineSlice`, `SpriteFont` **(API à vérifier dans la doc)**. | Alternative TypeScript-first. |
| LittleJS | https://github.com/KilledByAPixel/LittleJS | MIT (4,2 k★) | JS | moteur web | ★★★ | 1 | Très léger ; importe atlas TexturePacker et **Aseprite** ; rendu pixel. | Pour un embed minimal (< 100 Ko). |
| Godot Web export | https://godotengine.org | MIT | — | moteur | ★★★★ | 4 | Teste *exactement* l'import Godot, mais ~30–40 Mo de wasm + threads. | Option « vérité terrain » à la demande, pas par défaut. |

**Réglages d'import à documenter/émettre** : filtre **nearest** (Godot `default_texture_filter=0` ; Unity `filterMode: 0` ; Phaser `pixelArt: true` ; Pixi `scaleMode: 'nearest'`), **pas de mipmaps**, **pas de compression** (Unity `textureCompression: 0`, Godot `compress/mode=0` lossless), **extrude 1–2 px** dans l'atlas pour éviter le bleeding, **PPU** = taille de tuile (16/32) avec calculatrice : `zoom = hauteur_écran / hauteur_logique` (1080/180 = 6 ; 1080/360 = 3) ; Godot `stretch/scale_mode="integer"`.

### 2.10 Emballage / distribution

| Nom | URL | Licence | Type | Cx | Notes |
|---|---|---|---|---|---|
| Manifeste JSON maison + JSON Schema | — | — | format | 1 | `pack.json` : `id, name, version, generator, palette[], license (SPDX), assets[{id, type: sprite|animation|tileset|ui|font|icon, files, role, state, nine_slice{l,t,r,b, mode}, pivot, size, tags, source{prompt_hash, model}}]` + `ATTRIBUTIONS.md` généré (game-icons CC BY, polices OFL). |
| SPDX identifiers | https://spdx.org/licenses/ | CC0 | référence | 1 | `CC0-1.0`, `CC-BY-4.0`, `OFL-1.1`, `LicenseRef-Proprietary`. |
| Structure ZIP | — | — | convention | 1 | `/png/`, `/atlas/`, `/godot/` (`.tres`, `addons/`, `project.godot.snippet`), `/unity/` (`.unitypackage`), `/phaser/`, `/tiled/`, `/ldtk/`, `/aseprite/`, `/fonts/`, `pack.json`, `LICENSE.txt`, `ATTRIBUTIONS.md`, `README.md` (réglages d'import). |

---

## 3. Idées malines / astuces

1. **Le `.9.png` comme format pivot du 9-slice.** Un PNG avec bordure de 1 px (noir = étirable en haut/gauche, noir = zone de contenu en bas/droite) transporte les bordures *dans l'image* : lisible par libGDX TexturePacker et Android Studio, vérifiable à l'œil, et trivial à parser. On livre le PNG nu **et** le `.9.png`.
2. **Identité = test unitaire du 9-slice.** Reconstruire l'image à sa propre taille avec les bordures détectées doit donner un résultat *bit-à-bit identique* ; puis à ×2 en largeur, chaque colonne du centre doit être égale à la colonne `left` (mode stretch) ou périodique (mode tile). Un score < 1.0 = « fixed ».
3. **Symétrie forcée.** Les cadres pixel art sont symétriques : si `|left − right| ≤ 2`, imposer `left = right = min` ; idem haut/bas sauf si une ombre portée en bas est détectée (dernières lignes plus sombres et plus larges).
4. **Les états par « ramp shift »** (un cran sur la rampe de la palette) restent 100 % dans la palette et ressemblent à ce que fait un artiste ; les hover IA ne servent que si l'utilisateur le demande.
5. **Émettre le JSON « Aseprite »** (avec `frameTags` et `slices.center`) comme métadonnées universelles : Phaser (`createFromAseprite`), LittleJS, Godot (aseprite-wizard lit le JSON), Unity (importer Aseprite officiel lit le `.ase`) — donc **un écrivain `.ase` maison** ouvre toutes ces portes d'un coup.
6. **Extraire les composants directement depuis le concept plein écran** avec Grounding DINO/OWLv2 (« button. panel. icon. health bar. ») quand la planche à fond transparent n'est pas disponible : on récupère des crops que l'on nettoie (fiche 01) — moins fiable que la planche, mais utile pour « importer un screenshot d'un jeu existant » comme référence de DA.
7. **Thème « flat » sans texture pour Godot** : pour les UI simples, exporter des `StyleBoxFlat` paramétriques (mêmes paramètres que notre générateur procédural) — 0 PNG, redimensionnable à l'infini, et le même JSON alimente CSS (`border-image`) pour la doc web.
8. **Mapping rôle/état → items de thème** en table déclarative (FRAME→`Panel/styles/panel`, BUTTON.HOVER→`Button/styles/hover`, FILL→`ProgressBar/styles/fill`, DIVIDER→`HSeparator/styles/separator`, ICON.checked→`CheckBox/icons/checked`) ; la même table sert Unity (`Selectable` sprites : Normal/Highlighted/Pressed/Disabled/Selected = exactement les 5 états SpriteCook) et Phaser (dictionnaire de frames).
9. **Police = planche de glyphes en grille + baseline statistique** ; livrer `.fnt` XML (Phaser/Godot/Unity TMP/Pixi) *et* `.ttf` (pixel-font-builder). Vérifier la lisibilité par OCR (Florence-2 `<OCR>` sur la phrase-test rendue : si l'OCR échoue, la police est trop dégradée).
10. **Icônes : score de cohérence par lot** (occupation de cellule, couleur de contour, palette, direction de lumière) affiché comme le `quality_summary`, avec bouton « normaliser » (re-centrage, re-contour, re-quantification) avant toute régénération.
11. **Ne jamais livrer de `.import` Godot** (chemins hachés instables) : livrer `project.godot.snippet` + un plugin d'import minimal ; **ne jamais coder en dur un GUID de script Unity** : livrer un script Editor qui crée le contrôleur/Rule Tile.
12. **Playground = même loader que l'utilisateur** : le Phaser du navigateur charge *le ZIP exporté* (JSZip), pas des données internes ; ce qui marche dans le playground marche dans le jeu.

---

## 4. Pipelines d'assemblage recommandés

### 4.1 « DA → maquette → planche → extraction/classification → 9-slice → export »

1. **DA/palette** (fiche 04) : palette (≤ 32 couleurs), taille de grille (16/24/32 px), résolution logique (384×216 ou 640×360 ; 9:16 mobile), style (bevel/organique/sci-fi).
2. **Maquette** : gabarit JSON du type d'écran → LLM ouvert instancie libellés/slots → rendu déterministe (cadres procéduraux §2.5 + police pixel + icônes libres) → *optionnel* : stylisation IA (img2img ControlNet sur la maquette) ou concept IA plein écran (GPT-Image transparent / Gemini) comme dans SpriteCook, affiché côte à côte.
3. **Planche de composants** : prompt par rôle (« 4 boutons, 5 états, sur fond transparent, grille 6×4 ») ou génération procédurale directe ; fond transparent (GPT-Image) ou chroma (fiche 01).
4. **Extraction** (fiche 05) → **classification** (§2.2 : heuristiques → regroupement par masque → ordre des états → SigLIP2 → nommage Florence-2/Qwen) → `quality_summary`.
5. **9-slice** (§2.1) : détection par axe, mode stretch/tile/fixed, symétrisation, « Suggest » = résultat auto, aperçu à 2 tailles (serveur Pillow + client Phaser NineSlice), édition manuelle des 4 valeurs.
6. **États manquants** : dérivés par ramp shift/OKLCH (§2.3).
7. **Export** : atlas (rectpack/free-tex-packer, extrude 2 px, POT optionnel) + `pack.json` + `.9.png` ; Godot (`Theme.tres` + `StyleBoxTexture` + `SpriteFrames` + plugin), Unity (`.unitypackage` : PNG + `.meta` avec `spriteSheet` et `border`, script Editor), Phaser (JSON hash + snippet `add.nineslice`), Aseprite (`.ase` avec slices centre), GameMaker/Defold/Roblox (référence, descripteurs JSON/Lua).

### 4.2 « Police pixel »

Planche de glyphes (grille 16×6, ASCII 32–126, fond chroma) → découpe par grille (fiche 05) → binarisation + trim + baseline statistique → `.fnt` (texte/XML) + PNG atlas (écrivain maison) → `.ttf/.otf/.bdf` via pixel-font-builder (repli : FontForge en sous-processus, Bits'N'Picas CLI) → validation : rendu ×1/×2/×3 sans AA, OCR Florence-2 de la phrase-test → export avec réglages : Godot `FontFile` (AA none, hinting none, subpixel off, no mipmaps), Unity TMP (atlas bitmap, sampling = taille native, Point filter), Phaser `load.bitmapFont` (XML). Catalogue intégré de polices OFL (Google Fonts, Departure Mono, Ark Pixel) + CC0 (Monogram, Public Pixel) avec fichier de licence embarqué.

### 4.3 « Playground web »

Phaser 3.90/4 (MIT) dans le front React : scène **Personnage** (charge l'atlas/JSON Aseprite exporté, WASD, changement d'animation par tag, flip, échelle entière), scène **UI** (panneau NineSlice redimensionnable par slider, boutons avec 5 états au survol/clic, jauge FILL, BitmapText avec la police exportée, curseur), scène **Tileset** (peinture d'IntGrid + autotile blob-47 via le mapping Tiled/Godot exporté). Le playground charge le **ZIP final** via JSZip (MIT). KAPLAY comme variante « bac à sable éditable » (KAPLAYGROUND) pour les débutants ; Godot Web en option lourde pour vérifier l'import réel.

---

## 5. Ce qu'il faudrait développer soi-même

| Module | Taille estimée | Pourquoi maison |
|---|---|---|
| `nineslice.detect()` + `nineslice.preview()` + lecture/écriture `.9.png` | 200–300 lignes Python | Aucune lib open source de détection automatique ; l'aperçu doit être identique au rendu moteur. |
| Classifieur en cascade (heuristiques → regroupement → états → SigLIP2 → nommage VLM) + `quality_summary` | 600–900 lignes + prompts | Domaine spécifique (pixel art UI), petits objets, besoin d'explicabilité et d'une boucle de correction. |
| Générateur d'états (ramp shift / OKLCH + re-quantification) | 150 lignes | Simple, déterministe, sans dépendance lourde. |
| Générateur procédural de cadres/boutons/jauges/curseurs (« theme sheet ») | 500–800 lignes | Aucun équivalent libre ; garantit le 9-slice et la palette ; nourrit `StyleBoxFlat` et CSS. |
| Gabarits d'écrans (12 types × 2 ratios) + rendu de maquette | 12 JSON + 300 lignes | Le cœur de l'approche « layout d'abord ». |
| Écrivains de formats : Godot `.tres` (SpriteFrames/TileSet/StyleBox/Theme/FontFile), Unity `.meta`/`.anim`/`.unitypackage` + script Editor C#, Phaser/TexturePacker JSON, Aseprite JSON + **`.ase` binaire**, Tiled `.tsx`, LDtk `.ldtk`, BMFont `.fnt`, GameMaker `.yy`, Defold `.atlas/.tilesource`, libGDX `.atlas` | 50–300 lignes chacun + tests d'intégration (Godot headless, Unity batchmode) | Tous simples mais piégeux ; free-tex-packer-core ne couvre ni Godot 4 ni les 9-slice ni les terrains. |
| Plugin Godot minimal (`EditorImportPlugin` lisant `pack.json`) et script Unity Editor (import, AnimatorController, Rule Tile) | 300 lignes GDScript / 300 lignes C# | Évite `.import` et GUID codés en dur. |
| Pipeline police (découpe → baseline → `.fnt`/`.ttf`) | 300 lignes | Colle entre fiche 05 et pixel-font-builder. |
| Normalisation d'icônes + score de cohérence + attribution automatique | 200 lignes | Spécifique. |
| Playground Phaser (3 scènes) + chargeur ZIP | 600 lignes TS | Produit. |

---

## 6. Sources (vérifiées en session sauf mention)

- Godot StyleBoxTexture (XML de référence) : https://github.com/godotengine/godot/blob/master/doc/classes/StyleBoxTexture.xml
- Godot SpriteFrames (XML) : https://github.com/godotengine/godot/blob/master/doc/classes/SpriteFrames.xml
- Godot TileSetAtlasSource (XML) : https://github.com/godotengine/godot/blob/master/doc/classes/TileSetAtlasSource.xml
- Godot FontFile (XML) : https://github.com/godotengine/godot/blob/master/doc/classes/FontFile.xml
- Godot Aseprite Wizard (MIT, v9.8.0, 2026) : https://github.com/viniciusgerevini/godot-aseprite-wizard
- Unity Sprite texture type : https://docs.unity3d.com/Manual/texture-type-sprite.html
- Unity Asset packages : https://docs.unity3d.com/Manual/AssetPackages.html
- Unity 2d-extras (Rule Tile, lecture seule → com.unity.2d.tilemap.extras) : https://github.com/Unity-Technologies/2d-extras
- Phaser NineSlice : https://docs.phaser.io/api-documentation/class/gameobjects-nineslice
- PixiJS v8 NineSliceSprite : https://pixijs.download/release/docs/scene.NineSliceSprite.html
- KAPLAY (MIT) : https://github.com/kaplayjs/kaplay
- Excalibur (BSD-2) : https://github.com/excaliburjs/Excalibur
- LittleJS (MIT) : https://github.com/KilledByAPixel/LittleJS
- free-tex-packer (MIT) : https://github.com/odrick/free-tex-packer · core : https://github.com/odrick/free-tex-packer-core
- rectpack (Apache-2.0) : https://github.com/secnot/rectpack
- Aseprite file specs : https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
- py_aseprite (MIT, lecture seule) : https://github.com/Eiyeron/py_aseprite
- LDtk (MIT) : https://github.com/deepnight/ldtk · JSON : https://ldtk.io/json/
- Tiled TMX/TSX : https://doc.mapeditor.org/en/stable/reference/tmx-map-format/
- Defold atlas : https://defold.com/manuals/atlas/
- SnowB BMF (MIT) : https://github.com/SilenceLeo/snowb-bmf
- fontbm (MIT) : https://github.com/vladimirgamalyan/fontbm
- msdf-atlas-gen (MIT) : https://github.com/Chlumsky/msdf-atlas-gen
- FontForge (GPL-3.0) : https://github.com/fontforge/fontforge
- Bits'N'Picas (licence à confirmer) : https://github.com/kreativekorp/bitsnpicas · README : https://raw.githubusercontent.com/kreativekorp/bitsnpicas/master/README.md
- pixel-font-builder (MIT) : https://github.com/TakWolf/pixel-font-builder
- m5x7 (CC0) : https://managore.itch.io/m5x7
- SigLIP 2 (Apache-2.0) : https://huggingface.co/google/siglip2-base-patch16-224
- Florence-2-large (MIT) : https://huggingface.co/microsoft/Florence-2-large
- Qwen2.5-VL-7B (Apache-2.0) : https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct
- Grounding DINO (Apache-2.0) : https://github.com/IDEA-Research/GroundingDINO
- DINOv2 (Apache-2.0) : https://github.com/facebookresearch/dinov2
- OmniParser (CC-BY-4.0 / YOLO AGPL / Florence MIT) : https://github.com/microsoft/OmniParser
- vtracer (MIT) : https://github.com/visioncortex/vtracer
- game-icons (CC BY) : https://github.com/game-icons/icons
- pixelarticons (MIT) : https://github.com/halfmage/pixelarticons
- NES.css (MIT) : https://github.com/nostalgic-css/NES.css
- RPGUI (zlib) : https://github.com/RonenNess/RPGUI
- Pixelorama (MIT) : https://github.com/Orama-Interactive/Pixelorama
- Penpot (MPL-2.0) : https://github.com/penpot/penpot
- Android nine-patch (format `.9.png`) : https://developer.android.com/develop/ui/views/graphics/drawables#nine-patch
- Kenney (CC0) : https://kenney.nl/assets
- ninepatch (PyPI, à vérifier) : https://pypi.org/project/ninepatch/
- SPDX : https://spdx.org/licenses/
