# 11 — Moodboard, palettes et direction artistique exploitable par l'IA

*Recherche technique, septembre 2026. Domaine : le **wizard de démarrage** (vue, style, univers, époque, ambiance → JSON de direction artistique) et la **toile d'inspiration** (moodboard / mind map à îlots thématiques) dont l'application doit dériver des **ambiances** et des **palettes** réutilisables dans les générations IA. Stack cible : FastAPI + Pillow/NumPy côté serveur, React 19 + TypeScript + Vite + Tailwind + @xyflow/react côté client, GPU 8 Go ou CPU, API acceptable.*

Conventions : **(propriétaire)** = référence UX seulement, jamais une dépendance. **NC** = non commercial. Licences vérifiées sur le dépôt ou le registre (npm / PyPI / Hugging Face) au moment de la recherche ; « à vérifier » signale une information que je n'ai pas pu confirmer à la source. Complexité 1 (pip/npm install) → 5 (fork + entraînement). Note de méthode : le budget de recherche web de la session était épuisé au démarrage ; tout a été vérifié par lecture directe des pages (dépôts GitHub, registres npm, fiches Hugging Face, docs officielles, moteur « papers » de Hugging Face) — cf. §6.

---

## 1. Les problèmes / verrous

1. **Un canevas infini « à îlots » en React 19, sans piège de licence.** Il faut poser librement des images, des notes, des liens, des palettes ; les regrouper en îlots (personnages, biomes, bestiaire…) ; zoomer, déplacer, redimensionner ; persister. La bibliothèque la plus séduisante du marché, tldraw, n'est **pas open source** (licence propriétaire avec watermark et télémétrie de conformité) : elle est exclue. Il faut choisir entre étendre @xyflow/react (déjà dans la stack), embarquer Excalidraw (MIT) ou descendre au niveau canvas (Konva, Fabric, Pixi).
2. **Un format de stockage ouvert et interopérable.** Un moodboard doit survivre à l'application : JSON Canvas (spec MIT d'Obsidian) est le seul format « neutre » ; Excalidraw et React Flow ont chacun leur JSON. Il faut aussi y attacher des métadonnées maison (palette calculée, tags, provenance, licence de l'image) sans casser l'interopérabilité.
3. **Extraire une palette *utile* d'une image.** Les extracteurs naïfs (median cut RGB) sortent des couleurs de fond, des gris de compression JPEG et des teintes moyennées qui n'existent nulle part dans l'image. Il faut travailler en espace perceptuel (OKLab/CIELAB), ignorer fond et transparence, pondérer, puis **fusionner les palettes de plusieurs images** en une palette d'îlot.
4. **Transformer une palette « photo » en palette *pixel art*.** N couleurs, rampes de valeur avec *hue shifting*, saturation maîtrisée, contraste garanti entre pas adjacents, harmonies, import/export dans les formats des outils d'artistes (Lospec .hex, GIMP .gpl, JASC .pal, Adobe .ase, Aseprite).
5. **Décrire automatiquement les références.** Tags de style (« pixel art », « aquarelle », « cel-shaded »), descripteurs d'ambiance (« sombre », « brumeux », « chaleureux »), caption, « style prompt » réutilisable — **localement**, sur 8 Go, avec des modèles à licence permissive.
6. **Regrouper automatiquement en îlots et retrouver par similarité.** Embeddings (DINOv2 / SigLIP 2), réduction (UMAP), clustering sans nombre de clusters imposé (HDBSCAN), index vectoriel local (sqlite-vec / LanceDB / FAISS).
7. **Palette depuis des mots, mots depuis une palette.** « Marais toxique au crépuscule » → 8 couleurs ; et l'inverse pour nommer une ambiance. Les modèles dédiés sont rares ; la littérature 2025 (ColorGPT) montre qu'un LLM bien prompté fait bien le travail.
8. **Injecter la DA dans la génération.** Trois canaux : le texte (prompt structuré), l'image (IP-Adapter / InstantStyle / références de style — détaillé par l'agent 04), la couleur (T2I-Adapter Color, méthodes 2024-2025 de conditionnement de palette, et surtout la **post-palettisation**, détaillée par l'agent 02). Les modèles de diffusion suivent mal les couleurs composées (« bleu Tiffany ») : la fidélité à la palette doit se faire en post-traitement.
9. **Le wizard : des taxonomies qui *pilotent* la production.** Vue, style, époque, ambiance, genre ne sont pas des étiquettes décoratives : la perspective fixe le nombre de directions et de poses, l'ère fixe la taille des tuiles et le nombre de couleurs, l'ambiance fixe la palette et les negative prompts. Il faut un JSON de DA versionné qui dérive tout cela par règles.
10. **Chercher des références libres de droits.** Les APIs existent (Openverse, Wikimedia Commons, Unsplash, OpenGameArt, Kenney), mais chacune a ses conditions ; il faut capturer licence et attribution *au moment de l'import* et refuser l'ambiguïté.
11. **Auto-layout / mind map.** Organiser automatiquement des dizaines de nœuds (dagre, ELK, d3-force) et placer les îlots issus du clustering sans chevauchement.

---

## 2. Solutions par problème

### 2.1 Canevas infini / moodboard en React

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **@xyflow/react (React Flow 12)** — déjà dans la stack | reactflow.dev | **MIT** | TS/React | Canevas de nœuds DOM (pan/zoom, drag, sélection, groupes via `parentId`) | Très mûr | CPU navigateur ; nœuds DOM → confortable jusqu'à quelques centaines d'images avec `onlyRenderVisibleElements` | 2 | Pas de dessin libre, pas de rotation native ; l'appartenance à un îlot est un `parentId` explicite (le parent doit précéder l'enfant dans le tableau, `extent: 'parent'` pour confiner) ; `NodeResizer` (minWidth/maxWidth, `keepAspectRatio`, `autoScale`) et `NodeToolbar` fournis ; type `group` sans handles | **Recommandé** : nœuds custom `image`, `note`, `palette`, `link`, `swatch` + nœud `islet` (group). Une seule pile, données typées, edges optionnels pour la mind map |
| **Excalidraw** (`@excalidraw/excalidraw` 0.18.1) | github.com/excalidraw/excalidraw · docs.excalidraw.com | **MIT** | TS/React | Tableau blanc complet embarquable : images, texte, formes, flèches, **frames**, groupes, export PNG/SVG/clipboard | 128 k★, très actif ; peers React 17/18/19 | CPU (canvas 2D) ; des centaines d'images OK | 2 | UI « hand-drawn » (désactivable via `roughness`), bundle lourd, contrôle fin de l'UI via `UIOptions`/`renderTopRightUI` seulement ; images stockées en `files` (dataURL, id SHA-1 par défaut, `generateIdForFile`) ; `customData` sur chaque élément pour nos métadonnées | Excellent **second mode** « croquis libre » ; peut être la seule toile si l'on accepte de lire son JSON (§2.2) |
| tldraw 5.x | tldraw.dev | **Licence tldraw (propriétaire, non OSI)** : dev libre, production soumise à licence, watermark, télémétrie de conformité, interdiction de retirer le watermark (« Not to use the Software in Production Environments » hors licence) | TS/React | Tableau blanc | Très mûr | — | — | Meilleure UX du marché | **Exclu** par la contrainte open source |
| **react-konva** 19.2.4 / Konva 10 | github.com/konvajs/react-konva | **MIT** | TS/React | Canvas 2D déclaratif : `Stage`, `Layer`, `Image`, `Transformer` (rotation/redim.), drag | 6,4 k★, release mai 2026 | CPU ; bien au-delà de 1 000 images (bitmap, pas DOM) | 3 | Tout est à construire (sélection multiple, îlots, texte riche) ; texte = bitmap (pas de Markdown) | À réserver si le DOM de React Flow plafonne ; peut cohabiter (un nœud React Flow = un mini Konva) |
| Fabric.js 6 | fabricjs.com | **MIT** | TS | Canvas 2D objet (groupes, transformations, sérialisation JSON) | Mûr | CPU | 3 | Pas de pan/zoom infini natif, intégration React manuelle | Alternative à Konva ; moins « React » |
| PixiJS 8 | pixijs.com | **MIT** | TS | WebGL/WebGPU 2D | Mûr | GPU navigateur | 4 | Moteur de rendu, pas d'outil d'édition ; tout à écrire | Sur-dimensionné pour un moodboard |
| **BlockSuite / AFFiNE « edgeless »** | github.com/toeverything/blocksuite · github.com/toeverything/AFFiNE | BlockSuite **MPL-2.0** ; AFFiNE CE **MIT** | TS (web components) | Éditeur edgeless : notes riches, images, formes, pages liées | 5,9 k★ / 69 k★ ; v0.22.4 (juil. 2025) | CPU | 4 | Web components (pas React), API instable pré-1.0, couplée à Yjs ; embarquer `EdgelessEditor` seul est possible mais lourd | Trop couplé à AFFiNE ; garder comme référence de design |
| **react-zoom-pan-pinch** 4.0.3 | github.com/BetterTyped/react-zoom-pan-pinch | **MIT** | TS | Pan/zoom/pinch d'un `<div>` | 1,9 k★, avr. 2026 | CPU | 1 | Pas de gestion d'objets | Suffit pour une « toile DOM maison » avec dnd-kit + moveable ; inutile si React Flow |
| **react-moveable** (Moveable 0.53) | github.com/daybrush/moveable | **MIT** | TS | Drag/resize/rotate/group/snap sur éléments DOM | 10,7 k★ ; dernière release **déc. 2023** | CPU | 2 | Maintenance ralentie | Apporte rotation + snapping à une toile DOM ; peut s'utiliser *dans* un nœud React Flow |
| **dnd-kit** (`@dnd-kit/react`) | github.com/clauderic/dnd-kit | **MIT** | TS | Drag & drop accessible (dépôt de fichiers, tri, glisser d'un panneau vers la toile) | 17,2 k★, releases 2026 | CPU | 1 | N'est pas un canevas | Pour glisser une image de la bibliothèque / du navigateur de références vers un îlot |
| **Tiptap 3** (core) / **Milkdown** | github.com/ueberdosis/tiptap · github.com/Milkdown/milkdown | **MIT** (Tiptap Pro payant : collab, commentaires, IA) / **MIT** | TS | Éditeurs ProseMirror ; Milkdown = Markdown WYSIWYG | 38 k★ / 11,9 k★ | CPU | 2 | Tiptap : Markdown via extension ; Milkdown : Markdown natif (remark) | **Milkdown** pour les nœuds « note » (stockage Markdown = compatible JSON Canvas `text`) |
| PureRef, Milanote, Miro, FigJam, Eagle, Kosmik, Are.na, Pinterest **(propriétaires)** | — | — | — | — | — | — | — | PureRef : toile d'images ultra-rapide, sans structure ; Milanote : îlots (« boards ») + notes ; Eagle : bibliothèque + extraction de palette par image ; Are.na : blocs connectés (mind map de références) ; Kosmik : canevas + navigateur intégré | Références UX : reprendre de PureRef la fluidité, de Milanote les îlots, d'Eagle la palette par image, d'Are.na les liens entre îlots |

**Comparaison.** Trois familles : (a) DOM structuré (React Flow), (b) tableau blanc complet (Excalidraw), (c) canvas bas niveau (Konva/Fabric/Pixi). Pour un moodboard *dont on veut dériver des données* (palette par îlot, tags, provenance), (a) gagne : chaque nœud est un objet typé, les îlots sont des nœuds, l'app contrôle tout. (b) est imbattable pour le croquis libre mais oblige à lire son schéma pour extraire la structure. (c) n'a de sens qu'au-delà de ~1 000 images.

**Recommandation.** Étendre **@xyflow/react** (déjà maîtrisé) avec des nœuds custom et un nœud `islet` (type `group` + `NodeResizer`) ; ajouter **dnd-kit** pour le dépôt depuis les panneaux ; **Milkdown** pour les notes Markdown. Offrir **Excalidraw** en mode optionnel « croquis » (composition d'écran, annotations à main levée) avec import/export vers le même modèle. Ne pas prendre tldraw.

### 2.2 Format de stockage

| Nom | URL | Licence | Type | Maturité | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|
| **JSON Canvas 1.0** | jsoncanvas.org/spec/1.0 · github.com/obsidianmd/jsoncanvas | **MIT** (spec et site) | Spec : nœuds `text` (Markdown), `file` (chemin + `subpath`), `link`, `group` (conteneur, `background`) ; champs `id,x,y,width,height,color` ; edges `fromNode/toNode`, `fromSide/toSide`, `fromEnd/toEnd`, `label` ; couleurs hex ou presets « 1..6 » volontairement non définis | 3,5 k★ ; supporté par Obsidian, Kinopio, Flowchart Fun, hi-canvas, OrgPad, Charkoal, Ideaflip | 1 | Pas de rotation, pas d'ordre z, pas de champ d'extension officiel ; `group` = géométrie (pas de parent explicite) | **Format pivot recommandé** : `.canvas` + dossier d'images relatif ; métadonnées maison dans un fichier compagnon indexé par `id` (ou un champ `x-<app>` toléré par les lecteurs) |
| Excalidraw JSON | docs.excalidraw.com/docs/codebase/json-schema | MIT | `{type:"excalidraw", version, source, elements[], appState, files{}}` ; images = élément `image` + `files[fileId].dataURL` ; `frameId`, `groupIds`, `customData` | Stable | 1 | Images en base64 dans le fichier (lourd) ; format d'un outil | Import/export si Excalidraw est proposé en mode croquis |
| React Flow JSON (`toObject()`) | reactflow.dev | MIT | `{nodes[], edges[], viewport}` avec `data` libre | Stable | 1 | Propre à React Flow | Format de *travail* en mémoire ; sérialiser vers JSON Canvas |

**Recommandation.** Modèle interne = nœuds React Flow ; persistance = **JSON Canvas** (fichier `.canvas` lisible par Obsidian, ce qui plaît aux devs indé) + `moodboard.meta.json` (palettes, tags, embeddings, licences, provenance) + images dans `refs/`. Îlot = nœud `group` ; appartenance = **containment géométrique** recalculé (fidèle au sens de JSON Canvas), doublé en mémoire par `parentId` pour React Flow.

### 2.3 Extraction de palettes (une image, puis un îlot)

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Pillow `Image.quantize`** | pillow.readthedocs.io | **MIT-CMU (HPND)** | Python | `MEDIANCUT`, `MAXCOVERAGE`, `FASTOCTREE`, `LIBIMAGEQUANT` ; `kmeans` de raffinement ; `palette=` pour quantifier **vers** une palette donnée ; `dither` | Mûr | CPU, ms | 1 | Travaille en RGB (pas perceptuel) ; MEDIANCUT/MAXCOVERAGE refusent RGBA ; **libimagequant** absent des wheels (licence GPL-3 / commerciale → ne pas embarquer) | Base fiable pour une première réduction et pour la post-palettisation |
| **scikit-learn `KMeans` / `MiniBatchKMeans`** + NumPy | scikit-learn.org | **BSD-3** | Python | k-means pondéré (`sample_weight`) sur pixels convertis en **OKLab** | Mûr | CPU, < 100 ms sur 256 px | 2 | k fixé à l'avance ; sensible aux dégradés (prévoir fusion des centroïdes proches, ΔE) | **Cœur recommandé** : OKLab + poids (alpha, masque de fond, saillance) + fusion ΔE |
| **Pylette 6** | github.com/qTipTip/Pylette | **MIT** | Python | KMeans / MedianCut / **OKLab**, fréquences, masque alpha, export JSON, CLI, batch | 170★, actif | CPU | 1 | Petit projet | Prototype rapide ou référence d'implémentation |
| colorgram.py | github.com/obskyr/colorgram.py | MIT | Python | Port de colorgram.js (proportions RGB/HSL) | 471★, ancien | CPU | 1 | RGB, non perceptuel | Secondaire |
| **colour-science** / **coloraide** | github.com/colour-science/colour · github.com/facelessuser/coloraide | **BSD-3** / **MIT** | Python | Conversions (OKLab, OKLCh, CAM16, HCT), ΔE, gamut mapping ; coloraide : **harmonies** (complement, triad, split, analogous, tetrad, square), contraste, interpolation | Mûrs (coloraide 8.8.1, mars 2026) | CPU | 1 | colour-science est gros ; coloraide est pur Python, un peu lent sur des millions de pixels (faire la conversion en NumPy, utiliser coloraide pour les swatches) | coloraide pour les rampes/harmonies côté serveur |
| **color-thief** (JS) | github.com/lokesh/color-thief | **MIT** | TS | Couleur dominante + palette ; version récente : quantification **OKLCH**, swatches type Vibrant, Web Worker, contraste WCAG, P3 | 13,6 k★ | CPU navigateur | 1 | Pas de fusion multi-images | Aperçu instantané côté client au dépôt d'une image, avant le calcul serveur |
| **node-vibrant 4.0.4** | github.com/Vibrant-Colors/node-vibrant | MIT (à confirmer sur le dépôt ; historiquement MIT) | TS | MMCQ + swatches sémantiques (Vibrant, Muted, DarkVibrant, LightMuted…) ; entrées node/browser/worker | 2,4 k★, janv. 2026 | CPU | 1 | Résultats légèrement différents selon navigateur (canvas) | Utile pour « accent / fond / texte » d'une carte d'ambiance |
| **rembg** / masque alpha | github.com/danielgatis/rembg | MIT (modèles U²-Net, ISNet : licences propres) | Python | Détourage → masque « sujet » | Mûr | CPU OK (ONNX), ~1 s | 1 | Voir agent 01 | Ignorer le fond avant extraction ; en pixel art on utilise directement l'alpha |
| Eagle, Adobe Color (extract theme), Coolors (« from image ») **(propriétaires)** | — | — | — | — | — | — | — | Adobe Color extrait 5 couleurs avec « moods » (colorful, bright, muted, deep, dark) | Reprendre l'idée des *moods* d'extraction : plusieurs palettes candidates selon un critère |

**Comparaison.** Les bibliothèques prêtes (color-thief, node-vibrant, Pylette) suffisent pour une image isolée ; aucune ne fait la **fusion pondérée multi-images** ni la sortie « pixel art ». Le duo Pillow (pré-réduction) + k-means OKLab pondéré (NumPy/scikit-learn) est le socle le plus robuste et le moins dépendant.

**Recommandation.** Serveur : (1) redimensionner ≤ 256 px, (2) exclure alpha < 128 et, si demandé, le fond (masque rembg ou couleur des bords), (3) convertir en OKLab, (4) `MiniBatchKMeans(k=16..24, sample_weight)`, (5) fusionner les centroïdes à ΔE_OK < 0,02, (6) trier par L. **Palette d'îlot** = re-clustering des centroïdes de toutes les images de l'îlot, pondérés par (part de pixels × poids utilisateur × 1/nb d'images), avec provenance (quelle image a « donné » quelle couleur). Client : color-thief pour l'aperçu immédiat.

### 2.4 Palette pixel art : réduction, rampes, harmonies, formats

| Nom | URL | Licence | Langage | Type | Maturité | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **culori** | github.com/Evercoder/culori | **MIT** | TS | Espaces oklab/oklch/lab/lch/hsl/jzazbz/din99 ; `interpolate`, `differenceCiede2000`, `wcagContrast`, `nearest`, `clampChroma` ; tree-shakeable | 1,2 k★ | 1 | — | **Recommandé côté client** pour rampes, nearest-color, contraste |
| **colorjs.io** | github.com/color-js/color.js | **MIT** | TS | Référence CSS Color 4 (Lea Verou / Chris Lilley) : gamut mapping réel, ΔE 76/CMC/2000/Jz, contrastes (WCAG, APCA…) | 235 M téléchargements | 1 | Plus lourd que culori | Alternative si l'on veut APCA et gamut mapping « spec » |
| chroma.js | github.com/gka/chroma.js | **BSD-3** | JS | Scales, bezier, OKLCH, ΔE, contraste | 10,6 k★ | 1 | API plus ancienne | Équivalent ; culori suffit |
| **coloraide** | (cf. §2.3) | MIT | Python | Harmonies, contraste, interpolation OKLCh, gamut mapping | — | 1 | — | Même logique côté serveur (source de vérité) |
| **Lospec palettes** | lospec.com/palette-list · lospec.com/palettes/api | Palettes : chacune sous les conditions de son auteur (site non libre) ; API publique sans clé | HTTP | 4 452 palettes ; filtre par nb de couleurs (min/max/exact), tags (hardware, artist, gameboy, retro, neon, horror, nature, pastel…), tri ; **API** `lospec.com/palette-list/{slug}.json` → `{name, author, colors[]}` (et `.csv`) ; exports **.hex, .gpl (GIMP), .pal (JASC), .ase (Photoshop), .txt (Paint.net), .png 1x/8x/32x** | Référence de la communauté | 1 | Pas d'endpoint de recherche documenté (la liste est une page HTML filtrable) ; pas de limite documentée → rester courtois (cache local) | Importer par slug ; proposer les tags Lospec comme vocabulaire d'ambiance |
| **swatch** (Python) | github.com/nsfmc/swatch | **MIT** | Python | Lecture/écriture **.ase** (RGB, CMYK, Gray, LAB, groupes) | 39★, petit mais suffisant | 1 | — | Export .ase vers Photoshop/Illustrator/Affinity |
| Formats texte (.hex, .gpl, .pal, Paint.net .txt) | — | — | — | .hex = un hex par ligne ; .gpl = en-tête `GIMP Palette` + lignes `R G B name` ; .pal JASC = `JASC-PAL / 0100 / N / R G B…` | — | 1 | Trivial à écrire | Aseprite lit .gpl/.pal/.act/.png, GIMP/Krita .gpl, Photoshop .ase |
| Principes de rampes (Slynyrd, Lospec tutoriels) | slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes | Contenu éditorial | — | Rampes triées par valeur ; **hue shift** positif (vers le jaune) quand la luminosité monte, vers le bleu/violet en ombre (≈ +20° par pas dans « Mondo ») ; saturation maximale dans les médiums, réduite dans les clairs ; pas de valeur plus serrés dans les clairs ; couleurs partagées entre rampes | — | — | — | Règles à coder dans le générateur de rampes |
| Adobe Color, Coolors, Huemint, Colormind **(propriétaires)** | — | — | — | Harmonies, génération, « from image » | — | — | — | Références UX pour les règles d'harmonie et l'éditeur de palette |

**Comparaison.** Tout l'outillage de calcul colorimétrique est disponible en MIT/BSD des deux côtés (culori/colorjs.io en TS, coloraide en Python). Ce qui manque partout, c'est le **générateur de rampes pixel art** (hue shift + courbe de valeur + contraste minimal) et le **mapping vers les palettes Lospec** ; les deux sont à écrire (§5) mais tiennent en quelques centaines de lignes.

**Recommandation.** Serveur = source de vérité (coloraide + NumPy) ; client = culori pour l'édition interactive. Sortie standard : palette maîtresse ≤ 32 couleurs, organisée en **rampes** (3–7 pas, ΔL ≥ 0,08 en OKLab entre voisins, hue shift paramétrable ±5–25°), avec neutres partagés ; exports .hex/.gpl/.pal/.ase/JSON ; suggestion des 3 palettes Lospec les plus proches (ΔE moyen bidirectionnel) comme « ancrage rétro ».

### 2.5 Analyse automatique des références (tags, ambiance, style prompt)

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Florence-2** base 0,23 B / large 0,77 B | huggingface.co/microsoft/Florence-2-large | **MIT** | Python | Caption (3 niveaux de détail), OD, OCR, grounding, region caption | 627 k téléchargements/mois ; support vLLM/SGLang | fp16 : < 2 Go (large) ; **CPU possible** (quelques s) | 1 | Captions génériques, pas de vocabulaire « style » ; pas de tagging multi-label | **Captioner par défaut** (léger, MIT). `<MORE_DETAILED_CAPTION>` pour la description, `<OD>` pour isoler le sujet avant palette |
| **WD tagger v3** (`SmilingWolf/wd-eva02-large-tagger-v3`, variantes ViT/SwinV2/ConvNeXt) | huggingface.co/SmilingWolf/wd-eva02-large-tagger-v3 | **Apache 2.0** | Python (timm / **ONNX**) | Tags Danbooru multi-label (général + personnage + rating), seuil ≈ 0,5 | Standard de fait ; ONNX batch | ~1 Go ; **CPU OK** | 1 | Vocabulaire anime/illustration (très bon sur le pixel art et les concepts arts stylisés, faible sur la photo) ; tags parfois NSFW à filtrer | **Tagger par défaut** : `pixel_art`, `1boy`, `forest`, `night`, `monochrome`, `limited_palette`… sont des tags Danbooru natifs |
| **SigLIP 2** (`google/siglip2-base-patch16-224`, 0,4 B ; variantes so400m) | huggingface.co/google/siglip2-base-patch16-224 | **Apache 2.0** | Python | Encodeur image-texte ; **zero-shot** sur un vocabulaire maison ; multilingue (prompts en français possibles) | 1,3 M téléch./mois | ~1 Go fp16 ; CPU OK pour quelques images | 1 | Scores relatifs (softmax sur la liste) → toujours fournir des alternatives ; calibrer par ensembles de prompts | **Classifieur de style/ambiance** : vocabulaires « style » (8-bit, 16-bit, modern pixel, hand-painted, flat vector, cel-shaded, watercolor…) et « mood » (dark, cozy, eerie, vibrant…) ; ses embeddings servent aussi au clustering |
| **OpenCLIP** (ViT-B-32/L-14 laion2b, SigLIP) | github.com/mlfoundations/open_clip | **MIT** (code ; poids LAION MIT) | Python | Idem CLIP ; base de CLIP-Interrogator | 14,1 k★ | ViT-L-14 : ~1,7 Go | 1 | Moins bon que SigLIP 2 en zero-shot fin | Utile pour compatibilité avec CLIP-Interrogator |
| **CLIP Interrogator** 0.6 | github.com/pharmapsychotic/clip-interrogator | **MIT** | Python | BLIP caption + classement CLIP sur listes (mediums, artists, movements, flavors) ; **listes de termes personnalisées** ; mode low-VRAM | 3 k★, peu actif | 6,3 Go, **2,7 Go en low-VRAM** | 1 | Ancien (2023), listes orientées SD1.x, lent (« best » ≈ 10-20 s) | À reproduire plutôt qu'à embarquer : la *méthode* (classer des listes de termes par similarité CLIP) avec SigLIP 2 et des listes « game art » |
| **JoyCaption Beta One** (8 B : SigLIP 2 + Llama 3.1) | huggingface.co/fancyfeast/llama-joycaption-beta-one-hf-llava | Poids annoncés « free and open, no restrictions » ; base **Llama 3.1** → Llama 3.1 Community License à respecter (à vérifier au dépôt) | Python (Transformers, vLLM, llama.cpp/Ollama GGUF) | Modes : descriptive, **training prompt**, booru tags, **art critic**… | 84 k téléch./mois, > 100 Spaces | bf16 ≈ 17 Go ; **4-bit ≈ 6 Go → passe en 8 Go** | 2 | Couvre explicitement « digital art, anime, furry » ; lent (VLM 8 B) | Le meilleur « image → prompt d'entraînement » local ; en batch nocturne |
| **Qwen2.5-VL** 3B / 7B (Qwen3-VL à surveiller) | huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct | **Apache 2.0** | Python | VLM généraliste, **sorties JSON structurées** | 8 M téléch. | 3B fp16 ≈ 7 Go ; 7B en AWQ/GGUF 4-bit ≈ 5-6 Go | 2 | Plus lent qu'un tagger ; hallucine parfois des détails | Pour produire directement un **style guide JSON** (mots-clés, ambiance, matériaux, éclairage) à partir d'un collage d'îlot |
| **Moondream 2** (2 B) | huggingface.co/vikhyatk/moondream2 | **Apache 2.0** | Python | Caption court/long, VQA, détection, pointage | juin 2025 | ~4 Go fp16 ; CPU lent mais possible | 1 | Moins riche que Qwen | VLM « léger » de repli |
| BLIP-2 | huggingface.co/Salesforce/blip2-opt-2.7b | MIT (code) ; OPT-2.7b : licence OPT (NC) | Python | Caption/VQA | 2023 | ≥ 8 Go | 2 | Dépassé par Florence-2/Qwen | Non retenu |
| **aesthetic-predictor-v2-5** | github.com/discus0434/aesthetic-predictor-v2-5 | **AGPL-3.0** | Python | Score esthétique 1-10 sur SigLIP, bon sur les illustrations (5,5+ = excellent) | 419★, pip, nœud ComfyUI | ~1,5 Go | 1 | **AGPL** : à isoler en service séparé ou à éviter dans un produit fermé ; sinon LAION `improved-aesthetic-predictor` (CLIP ViT-L, licence à vérifier) | Trier les références/génération par qualité ; optionnel |
| Retro Diffusion « analyze », Midjourney /describe, Google Lens **(propriétaires)** | — | — | — | Image → prompt | — | — | — | — | Référence UX (« describe » en un clic) |

**Comparaison.** Pour 8 Go et licences propres, la combinaison **Florence-2 (caption) + WD tagger v3 (tags) + SigLIP 2 (zero-shot sur vocabulaires métier + embeddings)** couvre 90 % du besoin en < 3 Go de VRAM, ou sur CPU en quelques secondes par image. Les VLM (JoyCaption, Qwen2.5-VL) apportent la synthèse en langage naturel et le JSON structuré, au prix du temps ; on les réserve à la synthèse **par îlot** (une requête par îlot, pas par image).

**Recommandation.** Pipeline « analyse » en trois passes : (1) à l'import, synchrone et léger : color-thief client + WD tagger ONNX + SigLIP 2 zero-shot (style, mood, vue) + embedding ; (2) en tâche de fond : Florence-2 detailed caption ; (3) à la demande (bouton « Synthétiser l'ambiance ») : Qwen2.5-VL-3B/7B (ou JoyCaption en mode *training prompt*) sur le **collage** de l'îlot → JSON `{mood_keywords[], style_keywords[], lighting, materials, negative[]}`. Reproduire l'idée de CLIP-Interrogator avec des listes **spécifiques au game art** (vues, styles, ères, ambiances, genres) plutôt qu'avec ses listes d'artistes.

### 2.6 Regroupement automatique en îlots et recherche par similarité

| Nom | URL | Licence | Langage | Type | Maturité | VRAM/CPU | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **DINOv2** (small 22 M / base 86,6 M / large / giant) | huggingface.co/facebook/dinov2-base | **Apache 2.0** | Python | Embeddings auto-supervisés (768-d en base) ; excellents pour « ressemblance visuelle » (forme, texture, composition) | 2,6 M téléch./mois | base : < 1 Go, CPU OK | 1 | Ne comprend pas le texte → ne sert pas au zero-shot | **Embedding « forme/structure »** (regrouper des sprites de même famille) |
| **SigLIP 2** (cf. §2.5) | — | Apache 2.0 | Python | Embeddings sémantiques alignés texte | — | — | 1 | — | **Embedding « sens/style »** (regrouper par thème : « forêt », « donjon », « bestiaire ») ; permet la recherche texte → image |
| **UMAP** 0.5.12 | github.com/lmcinnes/umap | **BSD-3** | Python (numba, pynndescent) | Réduction 768-d → 2-d (placement sur la toile) ou → 10-d (avant clustering) ; métrique cosinus | 8,2 k★ | CPU, < 1 s pour quelques centaines de points | 1 | Non déterministe sans `random_state` ; numba alourdit l'install | Projection pour le **placement automatique** des îlots |
| **HDBSCAN** (scikit-learn ≥ 1.3) | scikit-learn.org (`sklearn.cluster.HDBSCAN`) | **BSD-3** | Python | Clustering sans k ; `min_cluster_size`, `min_samples`, `cluster_selection_epsilon` ; bruit = -1 | Intégré à sklearn | CPU | 1 | Sur des embeddings bruts, mieux après UMAP 10-d | **Proposition d'îlots** ; le bruit (-1) devient « non classé » |
| **sqlite-vec** | github.com/asg017/sqlite-vec | **MIT / Apache 2.0** (double) | C, bindings Python | Table virtuelle `vec0` (float/int8/binaire), KNN, colonnes de métadonnées, WASM | 8 k★, **pré-v1** (Mozilla Builders) | CPU | 1 | API susceptible de changer | **Recommandé** : un fichier SQLite par projet, zéro service |
| **LanceDB** | github.com/lancedb/lancedb | **Apache 2.0** | Rust/Python/TS | Base vectorielle embarquée (format Lance), multimodale, full-text + SQL | 10,5 k★ | CPU | 2 | Plus lourd que sqlite-vec | Si l'on veut stocker les images et leurs vecteurs ensemble, avec versioning |
| **FAISS** | github.com/facebookresearch/faiss | **MIT** | C++/Python (`faiss-cpu`) | Index exact/HNSW/IVF, clustering k-means | 40 k★ | CPU/GPU | 2 | Pas de métadonnées ni de persistance « base » | Inutile en dessous de 100 k images |

**Recommandation.** Deux embeddings par image (DINOv2-base + SigLIP 2) stockés dans **sqlite-vec** à côté du `.canvas`. « Proposer des îlots » = UMAP(10-d, cosinus) → HDBSCAN(`min_cluster_size=3`) sur SigLIP 2 (thème) ; nommer chaque cluster par les tags WD/SigLIP majoritaires ; placer par UMAP 2-d puis résoudre les chevauchements (§2.11). « Ressemble à » = KNN DINOv2 ; « chercher "marais brumeux" » = SigLIP 2 texte → image.

### 2.7 Palette depuis des mots, mots depuis une palette

| Nom | URL | Licence | Type | Maturité | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|
| **LLM local en JSON contraint** (Qwen2.5/3, Llama 3.x, Mistral via Ollama / llama.cpp / vLLM) | ollama.com · github.com/ggml-org/llama.cpp | Apache 2.0 (Qwen) / Llama Community / MIT (llama.cpp) | Prompt « génère 8 couleurs hex pour : {ambiance}, contraintes : {ère, nb couleurs, tons} » avec schéma JSON ; post-validation en OKLab (ΔE minimal, plage de L, contraste) | Mûr | 1 | Les petits modèles sortent des hex approximatifs → **toujours** re-valider et snapper vers des couleurs nommées ; pas de vérité terrain | **Recommandé** avec ré-échantillonnage : demander 3 propositions, scorer (harmonie, contraste, écart aux tags), garder la meilleure |
| **ColorGPT** (Zhu et al., août 2025) | huggingface.co/papers/2508.08987 | Papier (code non indiqué) | Complétion de palette et génération depuis texte par LLM pré-entraîné ; étudie les représentations (hex vs noms) et le prompting | Recherche | 3 | Méthode plus que produit | Valide l'approche LLM ; à lire pour le format de prompt |
| **Color Me Correctly** (sept. 2025) + TintBench | huggingface.co/papers/2509.10058 · github.com/Sung-Lin/TintBench | Code sur GitHub (licence à vérifier) | LLM désambiguïse les noms de couleurs composés puis raffine les embeddings texte via **CIELAB**, sans entraînement | Recherche | 3 | Cible SD ; montre que « tiffany blue » est mal rendu par les modèles | Justifie : noms simples dans le prompt + palettisation après coup |
| **GenColorBench** (oct. 2025) | huggingface.co/papers/2510.20586 | Benchmark | Mesure la fidélité couleur des T2I | — | — | — | Choisir un modèle en connaissance de cause |
| SigLIP 2 « mood → image » | (cf. §2.5) | Apache 2.0 | Inverse : pour une palette, chercher les images de l'îlot proches et récupérer leurs tags ; ou classer des mots d'ambiance contre le collage | — | 1 | Indirect | « Mots depuis une palette » = tags des images sources + statistiques (L moyen, chroma moyen, température) |
| Lospec tags | (cf. §2.4) | — | Palette → palettes Lospec proches → **leurs tags** (retro, pastel, horror, nature…) | — | 1 | Dépend de la couverture Lospec | Mots gratuits et « culturellement justes » pour le pixel art |
| Adobe Color, Coolors, Huemint, Khroma **(propriétaires)** | — | — | Génération de palettes par IA | — | — | — | Références UX |

**Recommandation.** « Mots → palette » : LLM local (Qwen 3B/7B en GGUF, ou API) avec schéma JSON + validation/réparation colorimétrique + snap vers rampes ; « palette → mots » : statistiques OKLab (clair/sombre, vif/terne, chaud/froid, contrasté/doux) + tags des images sources + tags des palettes Lospec voisines. Le tout alimente `mood.keywords`.

### 2.8 Injecter DA et palette dans la génération (survol ; détails chez les agents 02 et 04)

| Nom | URL | Licence | Type | Maturité | VRAM | Cplx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|
| **Prompt structuré** depuis le style guide | — | — | Préfixe de style + mots d'ambiance + **noms de couleurs simples** + negative | — | 0 | 1 | Les modèles suivent les noms de couleurs basiques, pas les hex ni les composés (cf. Color Me Correctly, GenColorBench) | Canal n°1, toujours actif |
| **IP-Adapter / InstantStyle / StyleKeeper (VSP)** | github.com/tencent-ailab/IP-Adapter · github.com/instantX-research/InstantStyle · github.com/naver-ai/Visual-Style-Prompting | **Apache 2.0** ×3 | Style par image de référence (SD1.5/SDXL), sans entraînement ; VSP/StyleKeeper : swap K/V en self-attention tardive | Mûrs ; Style Aligned (Google, Apache 2.0) est **archivé** depuis mars 2025 | SDXL ≈ 8 Go | 1-2 | Transfère style et gamme de couleurs, pas une palette exacte | Canal n°2 : l'**image de collage de l'îlot** (ou 1-3 images clés) devient la référence de style |
| **T2I-Adapter Color** (SD1.4/1.5) | github.com/TencentARC/T2I-Adapter | **Apache 2.0** | Adaptateur ~77 M conditionné par une **carte de couleurs spatiale** (image réduite en blocs de couleur) | 2023, figé ; pas de version SDXL du *color* | +0,3 Go | 2 | Contrôle la *répartition* des couleurs, utile pour « ciel violet en haut, sol ocre en bas » ; SD1.5 seulement | Canal n°3a : générer une carte 8×8 depuis la palette d'îlot (dominantes en haut/bas) |
| **ColorPeel** (ECCV 2024) | huggingface.co/papers/2407.07197 | Code GitHub (67★, licence à vérifier) | Apprend un **token par couleur** (formes géométriques colorées) → prompt « a <c1> tunic » | Recherche | Entraînement léger par couleur | 4 | Un token par couleur à apprendre ; base SD | Idée : tokens de palette de projet |
| **Color Alignment in Diffusion** (mars 2025) | huggingface.co/papers/2503.06746 | Papier (code non indiqué) | Projette échantillons/latents dans un espace de couleurs conditionnel à chaque pas | Recherche | — | 4 | Pas de code trouvé | À surveiller |
| **Applying a Color Palette with Local Control** (2023) | huggingface.co/papers/2307.02698 · github.com/vibe007/Dequantization_Diffusion_Models | Code GitHub (licence à vérifier) | Quantification → appariement de palette → « déquantification » par diffusion ; démontré sur des illustrations de cartes fantasy | Recherche | SD | 3 | Pipeline de recolorisation plus que de génération | Alternative à la simple palettisation quand on veut « repeindre » une référence |
| **Post-palettisation** : Pillow `quantize(palette=…)`, Astropulse **sd-palettize** (palettes Lospec + dithering, licence à vérifier), outils de l'agent 02 | — | MIT (Pillow) | Snap de chaque pixel vers la palette (ΔE OKLab), dithering optionnel | Mûr | CPU, ms | 1 | Peut aplatir des dégradés | **Le seul canal qui garantit la palette** ; à appliquer systématiquement en mode pixel |
| **LoRA de style** sur le moodboard : kohya sd-scripts (**Apache 2.0**), OneTrainer (**AGPL-3.0**), ai-toolkit (**MIT**) | github.com/kohya-ss/sd-scripts · github.com/Nerogar/OneTrainer · github.com/ostris/ai-toolkit | — | 20-60 images de l'îlot « style » + captions (JoyCaption/Florence) → LoRA SD1.5/SDXL | Mûr (SD1.5/SDXL en 8 Go ; FLUX ≥ 12 Go ou quantifié) | 6-8 Go | 3 | Sur-apprentissage si l'îlot est trop homogène | Canal n°4, différé (agent 03/04) |
| Retro Diffusion (palette en paramètre, styles rd_fast/rd_plus), SpriteCook (`colors[]` ≤ 64 hex + `style_asset_ids`) **(propriétaires)** | retrodiffusion.ai · app.spritecook.ai | API | — | — | — | — | SpriteCook accepte une palette hex de guidage (mode pixel seulement) et des assets « style guide » | À reproduire : palette hex + références de style comme paramètres de génération |

**Recommandation.** Ordre d'injection : prompt structuré (toujours) → référence de style (InstantStyle/IP-Adapter avec le collage d'îlot) → T2I-Adapter Color si SD1.5 et si la *répartition* spatiale compte → **post-palettisation obligatoire** vers la palette du style guide en mode pixel → LoRA de style quand le moodboard est stabilisé. Les méthodes 2025 de conditionnement de palette restent de la recherche sans code exploitable ; ne pas y investir.

### 2.9 Le wizard : taxonomies et JSON de DA

Sources de taxonomies vérifiées : SpriteCook (Theme libre + Random/Refine ; Style = presets Pixel Art « 8-Bit, 16-Bit, Modern, Dark, Chibi, Isometric » ou Detailed ; Perspective = Platformer / Isometric / Top-Down ; genres du Asset Pack = Roguelike/Dungeon, Platformer, Farming/Life Sim, Tower Defense, Space/Sci-Fi, Fantasy RPG ; styles « Classic 16-bit, Modern HD, Dark & Gritty, Cute & Colorful, Retro NES » ; tailles 16→512 ; `colors[]` ≤ 64), Lospec (tags de palettes et de tutoriels), tags Danbooru (WD tagger), Retro Diffusion (styles d'API : *default, retro, simple, detailed, anime, game asset, portrait, texture, UI, item sheet, 1-bit, character turnaround, top-down map/asset, isometric/asset, watercolor, textured, cartoon* — liste relevée de la doc API publique, à revérifier ; **propriétaire**).

| Axe du wizard | Valeurs proposées | Ce que ça pilote |
|---|---|---|
| **Vue / perspective** | `side` (side-scroller/platformer), `top-down` (pur), `top-down-3/4` (RPG 16-bit), `isometric` (2:1), `hex-iso`, `first-person-ui` (menus seulement) | Directions par entité : side → **1 direction + flip** (7 anims type SpriteCook : idle/walk/jump/run/attack/hurt/death) ; top-down → **4 ou 8 directions** (SpriteCook : 24 anims sur 4 dir.) ; iso → **4 (down/right + flips) ou 8** (SpriteCook : 14 anims « down/right + back ») ; ratio de tuile (1:1, 2:1 iso) ; jeux de tuiles (15/17-piece top-down, autotile-16 platformer, iso 3×5) |
| **Famille de style** | `pixel-8bit`, `pixel-16bit`, `pixel-modern` (HD pixel, rotations libres), `pixel-1bit`, `hand-painted`, `flat-vector`, `cel-shaded`, `watercolor`, `lineart-ink`, `lowpoly-render`, `photobash` | Résolution des entités (8-bit : 16 px perso / 8-16 px tuile ; 16-bit : 32 px / 16 px ; modern : 48-128 px / 32 px), nombre de couleurs (8-bit ≤ 16 ; 16-bit ≤ 32-64 ; modern libre), contour (`none`/`black`/`colored`/`selective`), anti-aliasing, dithering (`none`/`ordered`/`error-diffusion`), post-palettisation on/off, presets de génération (agent 03) |
| **Époque / univers** | `prehistoric`, `antiquity`, `medieval`, `renaissance`, `victorian-steampunk`, `1920s`, `wwii`, `1980s-synthwave`, `contemporary`, `near-future`, `cyberpunk`, `space-opera`, `post-apocalyptic`, `mythic`, `fairy-tale` × `high-fantasy`, `dark-fantasy`, `sci-fi`, `horror`, `slice-of-life`, `western`, `noir`… | Vocabulaire du prompt (matériaux, architecture, costumes, technologie), negative prompts (« no neon » en médiéval), îlots suggérés (personnages, bestiaire, architecture, props, UI) |
| **Ambiance / mood** (multi-sélection + curseurs) | `cozy`, `whimsical`, `heroic`, `melancholic`, `eerie`, `oppressive`, `gritty`, `dreamy`, `vibrant`, `serene`, `chaotic` ; curseurs : clair↔sombre, terne↔vif, chaud↔froid, doux↔contrasté ; éclairage : `day`, `golden-hour`, `night`, `overcast`, `neon`, `torchlit`, `underwater` ; météo | Contraintes de palette (L moyen, chroma moyen, température), mots d'ambiance, negative (« cheerful » en horreur), presets de post-traitement (vignettage, grain) |
| **Genre de jeu** | roguelike/dungeon, platformer, metroidvania, farming/life-sim, tower-defense, RPG, tactics, shmup, puzzle, visual novel, survival, city-builder | Liste d'entités à produire (tuiles, perso, ennemis, items, UI), nombre de poses/anims par entité, HUD |
| **Public / ton** | `kids`, `all-ages`, `teen`, `mature` | Filtres de tags (WD rating), vocabulaire |

**JSON de DA (proposition, à figer en schéma versionné) :**

```json
{
  "schema": "artdirection/1.0",
  "game": { "title": "Mireval", "genre": ["roguelike"], "audience": "teen" },
  "view": { "perspective": "top-down-3/4", "tile_ratio": "1:1", "directions": 4, "flip_allowed": true,
            "tile_px": 16, "character_px": [32, 32], "prop_max_px": 64 },
  "style": { "family": "pixel-16bit", "outline": "colored", "shading": "3-tone hue-shifted",
             "dithering": "minimal", "antialias": false, "max_colors": 32 },
  "world": { "era": "medieval", "universe": "dark-fantasy",
             "materials": ["wet stone", "rusted iron", "moss"], "biomes": ["swamp", "crypt", "pine forest"] },
  "mood": { "keywords": ["eerie", "melancholic", "foggy"], "lighting": "overcast",
            "sliders": { "value": -0.4, "chroma": -0.3, "temperature": -0.5, "contrast": 0.2 } },
  "palette": { "master": ["#0b0d12", "…"], "ramps": { "stone": ["…"], "moss": ["…"], "skin": ["…"] },
               "lospec_anchor": "endesga-32", "provenance": { "#3b5f4a": "refs/img_014.png" } },
  "prompting": { "positive_prefix": "16-bit pixel art, top-down RPG sprite, dark fantasy, eerie foggy swamp, muted teal and rust palette",
                 "negative": "photorealistic, blurry, gradient, neon, cheerful, 3d render, text, watermark",
                 "style_refs": ["refs/islet_style_collage.png"], "lora": [] },
  "entities": { "character": { "directions": 4, "anims": ["idle", "walk", "attack", "hurt", "death"], "frames": { "idle": 4, "walk": 6 } },
                "tileset": { "kind": "15-piece", "size": 16 } },
  "islets": { "characters": { "palette": ["…"], "mood": ["…"], "prompt_fragment": "…" } }
}
```

Les règles de dérivation (perspective → directions, famille → tailles/couleurs, mood → contraintes de palette) sont des fonctions pures testables ; chaque génération enregistre la **version** du JSON de DA qui l'a produite, pour tracer la dérive.

### 2.10 Rechercher des références libres (APIs et licences)

| Source | URL | Licences des contenus | Type d'accès | Cplx | Limites | Notes |
|---|---|---|---|---|---|---|
| **Openverse** (WordPress.org) | api.openverse.org/v1/images/ · docs.openverse.org | CC0 / CC BY / BY-SA / BY-NC… + domaine public, agrégés (Flickr, Wikimedia Commons, musées…) | REST JSON ; anonyme (limite basse) ou **OAuth2 client credentials** (palier « standard ») ; paramètres `q`, `license`, `license_type=commercial,modification`, `category`, `extension`, `size`, `source` ; réponse avec `license`, `license_version`, `license_url`, `attribution`, `creator`, `thumbnail`, `tags` | 1 | Qualité inégale ; peu de game art | **Connecteur n°1** : attribution fournie prête à l'emploi ; filtrer `license_type=commercial` par défaut |
| **Wikimedia Commons** | commons.wikimedia.org/w/api.php | CC / domaine public par fichier | `action=query&prop=imageinfo&iiprop=url\|extmetadata&iiurlwidth=…&iiextmetadatafilter=LicenseShortName\|Artist\|Credit` ; ≤ 50 vignettes par requête ; identifier son User-Agent | 1 | Métadonnées de licence parfois manquantes → refuser l'import si `LicenseShortName` absent | Idéal pour références historiques (costumes, architecture, cartes) |
| **Unsplash API** | unsplash.com/documentation | Licence Unsplash (gratuit, mais non OSI ; interdiction de reconstituer un service concurrent ; **vérifier les API Terms sur l'usage en IA/ML**) | 50 req/h en démo, plus après validation ; **hotlinking obligatoire**, attribution obligatoire, appel de l'endpoint `download` à chaque téléchargement | 2 | Conditions contraignantes pour une app qui *stocke* localement | Connecteur optionnel, désactivé par défaut |
| **Kenney** | kenney.nl/assets | **CC0** (« all game assets on the asset pages are public domain licensed (CC0) ») | Pas d'API ; packs zip, pack « All-in-1 » sur itch.io ; catégories 2D/3D/UI/**Pixel art** | 1 | Import manuel | Références de forme/gabarit (tailles de tuiles, UI) |
| **OpenGameArt** | opengameart.org | CC0, CC BY 3.0/4.0, CC BY-SA, **OGA-BY** (BY sans clause anti-DRM), GPL 2/3 | Pas d'API officielle ; pages HTML (scraping à éviter) ; licences mixtes par entrée | 2 | BY-SA et GPL contaminent : ne pas les mélanger sans avertir | Import manuel avec **saisie obligatoire de la licence** |
| itch.io | itch.io/game-assets | Variable (souvent CC0/CC BY, parfois EULA) | API serveur limitée aux propres jeux ; pas de recherche d'assets | 3 | Licences hétérogènes | Import manuel, licence à saisir |
| Pinterest, Are.na, Behance, ArtStation **(propriétaires)** | — | Droits réservés | — | — | **Ne jamais importer automatiquement** | Uniquement des liens (`link` JSON Canvas) et l'analyse locale d'une capture faite par l'utilisateur pour son usage privé |

**Recommandation.** Un panneau « Références » avec Openverse (par défaut, filtre commercial) + Wikimedia Commons ; chaque import écrit `{source_url, license, license_url, attribution, creator, retrieved_at}` dans les métadonnées du nœud ; un badge de licence sur chaque image ; un rapport « attributions » exportable. Les images sans licence identifiable sont marquées `unknown` et exclues par défaut de l'entraînement LoRA.

### 2.11 Auto-layout (mind map, placement des îlots)

| Nom | Licence | Taille | Forces | Limites | Usage |
|---|---|---|---|---|---|
| **dagre** | MIT | ~40 kB | Simple, gère les tailles dynamiques et les sub-flows | Pas de routage d'arêtes ; bug connu sur sub-flows avec connexions externes | Mind map hiérarchique (DA → îlots → éléments) |
| **elkjs** | **EPL-2.0** (compatible avec un produit MIT si non modifié, mais à documenter) | ~1,45 MB | Le plus configurable, routage d'arêtes, sub-flows | API lourde, bundle | Optionnel « layout soigné » |
| **d3-force** | ISC | petit | Physique (collision, attraction) ; parfait pour éviter les chevauchements d'îlots après UMAP | Itératif, pas de sub-flows | Résolution de chevauchement après clustering |
| d3-hierarchy | ISC | ~15 kB | Arbres | Racine unique | Mind map en étoile |

**Recommandation.** dagre pour la vue « mind map » (mode alternatif de la même toile) ; d3-force (`forceCollide` sur les rectangles) pour placer les îlots proposés par HDBSCAN aux positions UMAP sans chevauchement.

---

## 3. Idées malines / astuces

1. **Îlot = géométrie, pas hiérarchie.** Calculer l'appartenance par inclusion du centre de l'image dans le rectangle de l'îlot (à chaque `onNodeDragStop`), puis synchroniser `parentId`. On reste fidèle à JSON Canvas (`group` purement visuel) et le glisser-déposer entre îlots est naturel.
2. **Le collage d'îlot comme objet de première classe.** Générer automatiquement un PNG de contact (mosaïque 1024², images triées par similarité DINOv2) par îlot : il sert de référence InstantStyle/IP-Adapter, d'entrée unique pour le VLM (une requête au lieu de vingt), de vignette et de jeu de données LoRA.
3. **Ancrage Lospec.** Télécharger une fois les ~4 400 palettes Lospec par slug (cache local, respect du site), les indexer par (nb couleurs, L moyen, chroma moyen) ; pour toute palette extraite, proposer les 3 palettes Lospec les plus proches (ΔE OKLab moyen symétrique) et **hériter de leurs tags** → mots d'ambiance gratuits et culturellement justes ; l'utilisateur peut « snapper » sa palette sur l'une d'elles.
4. **Rampes par « hue shifting » paramétrique.** Pour chaque teinte dominante, générer une rampe en OKLCh : L espacé par une courbe (pas plus serrés dans les clairs), C maximal au milieu, H décalé de +k° vers le jaune en montant et −k° vers le bleu en descendant (k = 10-20°) ; vérifier ΔL minimal et ΔE ≥ seuil entre voisins ; partager les 2-3 neutres extrêmes entre rampes. C'est exactement la doctrine Slynyrd/Lospec, mais calculée.
5. **Noms de couleurs plutôt que hex dans les prompts.** Les T2I rendent mal les hex et les composés (« tiffany blue ») ; mapper chaque couleur de la palette vers le nom simple le plus proche (`nearest` de culori sur une liste courte : teal, rust, ochre, moss…) et laisser la post-palettisation faire la précision.
6. **Zero-shot par ensembles de prompts.** Pour chaque étiquette de style, moyenner les embeddings de 4-6 formulations (« pixel art of… », « a screenshot of a 16-bit video game showing… », « une illustration en pixel art de… ») : la stabilité de SigLIP 2 s'améliore nettement, et le multilingue permet l'UI en français.
7. **Curseurs d'ambiance = vecteurs.** Précalculer les embeddings texte de paires opposées (« bright, sunny » vs « dark, gloomy ») ; projeter chaque image/îlot dessus → curseurs mesurés ; en génération, ajouter les mots du pôle voulu. Même mécanique pour chaud/froid via la teinte moyenne OKLCh.
8. **Score de cohérence.** Extraire la palette et l'embedding SigLIP de chaque asset *généré*, mesurer ΔE moyen vers la palette maîtresse et distance au collage de style ; afficher un feu vert/orange/rouge et suggérer la palettisation ou la régénération. Le moodboard devient un instrument de contrôle qualité, pas seulement d'inspiration.
9. **Vocabulaires métier au lieu des listes d'artistes.** Reproduire CLIP-Interrogator avec cinq listes : vues, familles de style, ères matérielles, ambiances/éclairages, genres — ce sont précisément les axes du wizard, donc « décrire une image » et « remplir le wizard » deviennent la même opération (import d'une image de référence → wizard pré-rempli).
10. **Aperçu instantané, calcul différé.** Palette client (color-thief, 20 ms) affichée immédiatement ; serveur (OKLab k-means + tags + embeddings) en tâche de fond avec remplacement silencieux ; VLM uniquement sur demande explicite.
11. **Extraction « sujet seulement ».** En pixel art l'alpha suffit ; pour les concepts arts, utiliser Florence-2 `<OD>` ou rembg pour ne garder que le sujet, et proposer deux palettes (sujet / environnement).
12. **Carte d'ambiance exportable.** Par îlot, un PNG « mood card » (collage + palette + 6 mots + curseurs) et son JSON ; c'est ce que l'on partage à l'équipe ou à un artiste externe, et ce que consomme la génération.
13. **Provenance couleur → image.** Conserver pour chaque couleur maîtresse l'image et la zone dont elle vient ; au survol, la toile met en surbrillance la source : l'utilisateur comprend et corrige la palette au lieu de la subir.
14. **Wizard réversible.** Chaque choix du wizard écrit dans le JSON de DA ; chaque modification ultérieure du moodboard (nouvelle palette d'îlot validée) peut *reproposer* une mise à jour du JSON, avec diff. La DA vit avec le projet.

---

## 4. Pipeline et architecture recommandés

### 4.1 Flux « références → îlots → palette + ambiance → style guide → prompts »

```
[Wizard]  vue · style · époque/univers · ambiance · genre
    │  règles pures → artdirection.json v1 (tailles, directions, max_colors, prefix/negative de base)
    ▼
[Toile]  import (drag & drop, presse-papiers, Openverse/Commons, upload) ──► refs/ + licence + provenance
    │  client : color-thief (aperçu)          serveur (worker) : OKLab k-means · WD tagger · SigLIP2 (zero-shot + emb.) · DINOv2 (emb.) · Florence-2 (caption)
    │                                           → sqlite-vec + moodboard.meta.json
    ▼
[Îlots]  manuels (group) ou proposés (UMAP → HDBSCAN → nommage par tags → placement d3-force)
    │  par îlot : fusion pondérée des palettes → rampes hue-shift → ancrage Lospec → mood stats + tags → collage PNG
    │  (à la demande) VLM Qwen2.5-VL / JoyCaption sur le collage → JSON {keywords, lighting, materials, negative}
    ▼
[Style guide]  styleguide.json = artdirection.json ⊕ îlots validés (palette maîtresse, rampes, mots, refs, negative, LoRA)
    ▼
[Génération]  prompt = template(styleguide, entité, pose/direction) ; style_ref = collage ; palette → post-palettisation ;
              (SD1.5) T2I-Adapter Color ; (plus tard) LoRA de style ; score de cohérence en retour → toile
```

### 4.2 Choix techniques

- **Canevas** : @xyflow/react avec nœuds `image`, `note` (Milkdown), `link`, `palette`, `swatch`, `moodcard`, `islet` (group + NodeResizer) ; dnd-kit pour les dépôts ; Excalidraw en mode « croquis » optionnel. Pas de tldraw.
- **Stockage** : `project/moodboard.canvas` (JSON Canvas 1.0 : `file` → `refs/…`, `text` en Markdown, `group` = îlot, `link` = URL, `color` = preset 1-6 ou hex de l'îlot), `moodboard.meta.json` (par `id` : palette, tags, scores, licence, provenance, hash), `moodboard.db` (sqlite-vec : embeddings DINOv2 + SigLIP 2, KNN), `artdirection.json` / `styleguide.json` versionnés (`schema`, `version`, `updated_at`). Export : Excalidraw JSON, PNG (mood cards), .hex/.gpl/.pal/.ase/JSON pour les palettes, rapport d'attributions Markdown.
- **Backend FastAPI** : routes `POST /refs` (import + licence), `POST /analyze/{id}` (queue), `GET /islets/{id}/palette?n=32&ramps=true`, `POST /islets/{id}/mood`, `POST /palette/from-text`, `POST /palette/export?format=gpl`, `POST /islets/propose`, `GET /styleguide` ; worker de fond (RQ/arq/Celery ou simple `BackgroundTasks` + file SQLite) ; modèles chargés paresseusement (ONNX pour WD tagger, Transformers fp16 pour Florence-2/SigLIP 2/DINOv2, GGUF via llama.cpp pour le VLM/LLM) — total ≈ 3 Go de VRAM, ou CPU.
- **Colorimétrie** : NumPy/coloraide côté serveur (vérité), culori côté client (interaction) ; tous les calculs en OKLab/OKLCh ; ΔE = distance euclidienne OKLab (suffisant) ou CIEDE2000 pour les rapports.
- **Auto-layout** : dagre (mind map), d3-force (îlots).
- **Références** : Openverse (OAuth2 client credentials) + Wikimedia Commons ; Unsplash désactivé par défaut ; Kenney/OGA en import manuel avec licence saisie.

### 4.3 Budget et licences

Tout le pipeline recommandé est MIT / BSD / Apache 2.0 / MPL (aucune dépendance GPL ou AGPL dans le chemin critique : aesthetic-predictor-v2-5 (AGPL) et libimagequant (GPL) sont laissés de côté ; elkjs (EPL-2.0) est optionnel). Les seuls composants dont la licence est à confirmer au dépôt avant intégration : node-vibrant (probablement MIT), JoyCaption (base Llama 3.1), sd-palettize, TintBench, Dequantization_Diffusion_Models, ColorPeel.

---

## 5. Ce qu'il faudrait développer soi-même

1. **Les nœuds React Flow du moodboard** (image avec recadrage/rotation légère, note Markdown, lien avec aperçu, palette/swatch éditable, mood card, îlot redimensionnable avec titre et couleur) et la logique d'appartenance géométrique + `parentId` ; multi-sélection, alignement, raccourcis type PureRef ; presse-papiers d'images.
2. **Sérialiseur JSON Canvas ⇄ React Flow** (+ sidecar de métadonnées) et **import/export Excalidraw**.
3. **Service palette** : extraction OKLab pondérée, fusion multi-images avec provenance, fusion ΔE, générateur de rampes hue-shift avec contraintes, harmonies (coloraide), ancrage Lospec (cache + index), nommage des couleurs, exports .hex/.gpl/.pal/.ase/JSON, palettisation d'une image vers une palette.
4. **Service d'analyse** : orchestration WD tagger (ONNX) + SigLIP 2 (vocabulaires métier, ensembles de prompts, curseurs d'ambiance) + DINOv2 + Florence-2 ; file de tâches ; stockage sqlite-vec ; endpoints KNN et recherche texte.
5. **Proposition d'îlots** : UMAP + HDBSCAN, nommage par tags, placement d3-force, UI d'acceptation/fusion.
6. **Synthèse d'ambiance par VLM** : prompts et schéma JSON pour Qwen2.5-VL / JoyCaption sur le collage ; validation du JSON ; fallback statistique sans GPU.
7. **Wizard + moteur de règles** : taxonomies (§2.9), dérivations (perspective → directions/poses/tuiles ; famille → tailles/couleurs ; mood → contraintes de palette), schéma `artdirection/1.0` versionné, diff et migration.
8. **Compilateur de style guide → prompts** : templates par type d'entité et par direction/pose, noms de couleurs, negative, sélection des références de style, paramètres de post-palettisation ; journal des versions utilisées par chaque génération ; score de cohérence des sorties.
9. **Connecteurs de références** (Openverse, Wikimedia Commons ; Unsplash optionnel) avec capture de licence/attribution, badge de licence, rapport d'attributions.
10. **Mood card** : rendu PNG (Pillow) + JSON, partage.

Estimation d'effort (ordre de grandeur, un dev expérimenté) : canevas + stockage 3-4 semaines ; service palette 1-2 semaines ; analyse + clustering 2 semaines ; wizard + style guide 2 semaines ; connecteurs 1 semaine.

---

## 6. Sources

Canevas, formats, éditeurs
- tldraw — licence : https://github.com/tldraw/tldraw/blob/main/LICENSE.md · npm : https://registry.npmjs.org/tldraw/latest
- Excalidraw : https://github.com/excalidraw/excalidraw · props : https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props · export : https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export · schéma JSON : https://docs.excalidraw.com/docs/codebase/json-schema · npm : https://registry.npmjs.org/@excalidraw/excalidraw/latest
- JSON Canvas : https://jsoncanvas.org/spec/1.0/ · https://github.com/obsidianmd/jsoncanvas · apps : https://github.com/obsidianmd/jsoncanvas/blob/main/docs/apps.md
- React Flow sub-flows : https://reactflow.dev/learn/layouting/sub-flows · NodeResizer : https://reactflow.dev/api-reference/components/node-resizer · layouting : https://reactflow.dev/learn/layouting/layouting
- react-konva : https://github.com/konvajs/react-konva
- AFFiNE : https://github.com/toeverything/AFFiNE · BlockSuite : https://github.com/toeverything/blocksuite
- react-zoom-pan-pinch : https://github.com/BetterTyped/react-zoom-pan-pinch · Moveable : https://github.com/daybrush/moveable · dnd-kit : https://github.com/clauderic/dnd-kit
- Milkdown : https://github.com/Milkdown/milkdown · Tiptap : https://github.com/ueberdosis/tiptap

Couleur et palettes
- Pillow quantize : https://pillow.readthedocs.io/en/stable/reference/Image.html#PIL.Image.Image.quantize
- color-thief : https://github.com/lokesh/color-thief · node-vibrant : https://github.com/Vibrant-Colors/node-vibrant
- culori : https://github.com/Evercoder/culori · chroma.js : https://github.com/gka/chroma.js · color.js : https://github.com/color-js/color.js · coloraide : https://github.com/facelessuser/coloraide
- Pylette : https://github.com/qTipTip/Pylette · colorgram.py : https://github.com/obskyr/colorgram.py · swatch (.ase) : https://github.com/nsfmc/swatch
- Lospec : https://lospec.com/palette-list · API : https://lospec.com/palettes/api · exemple : https://lospec.com/palette-list/endesga-32
- Slynyrd, Pixelblog 1 — Color palettes : https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes

Vision, embeddings, index
- Florence-2 : https://huggingface.co/microsoft/Florence-2-large · WD tagger v3 : https://huggingface.co/SmilingWolf/wd-eva02-large-tagger-v3 · JoyCaption : https://huggingface.co/fancyfeast/llama-joycaption-beta-one-hf-llava
- CLIP Interrogator : https://github.com/pharmapsychotic/clip-interrogator · OpenCLIP : https://github.com/mlfoundations/open_clip · SigLIP 2 : https://huggingface.co/google/siglip2-base-patch16-224 · DINOv2 : https://huggingface.co/facebook/dinov2-base
- Qwen2.5-VL : https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct · Moondream 2 : https://huggingface.co/vikhyatk/moondream2 · aesthetic-predictor-v2-5 : https://github.com/discus0434/aesthetic-predictor-v2-5
- UMAP : https://github.com/lmcinnes/umap · HDBSCAN (sklearn) : https://scikit-learn.org/stable/modules/generated/sklearn.cluster.HDBSCAN.html
- sqlite-vec : https://github.com/asg017/sqlite-vec · LanceDB : https://github.com/lancedb/lancedb · FAISS : https://github.com/facebookresearch/faiss

Couleur et style dans la génération
- T2I-Adapter : https://github.com/TencentARC/T2I-Adapter · Style Aligned : https://github.com/google/style-aligned · Visual Style Prompting / StyleKeeper : https://github.com/naver-ai/Visual-Style-Prompting
- ColorPeel (2024) : https://huggingface.co/papers/2407.07197 · Color Alignment in Diffusion (2025) : https://huggingface.co/papers/2503.06746 · Color Me Correctly (2025) : https://huggingface.co/papers/2509.10058 · ColorGPT (2025) : https://huggingface.co/papers/2508.08987 · GenColorBench (2025) : https://huggingface.co/papers/2510.20586 · Applying a Color Palette with Local Control (2023) : https://huggingface.co/papers/2307.02698
- Recherche HF papers utilisée : https://huggingface.co/papers?q=color%20palette%20diffusion · https://huggingface.co/papers?q=text%20to%20color%20palette%20generation%20language%20model

Références libres
- Openverse (auth/throttling) : https://docs.openverse.org/api/reference/authentication_and_throttling.html · Wikimedia Imageinfo : https://www.mediawiki.org/wiki/API:Imageinfo · Unsplash : https://unsplash.com/documentation · Kenney (CC0) : https://kenney.nl/support · https://kenney.nl/assets · OpenGameArt FAQ : https://opengameart.org/content/faq

Taxonomies
- SpriteCook (analyse interne du projet « Spritecook analyse » : bloc Theme & Style, perspectives, jeux d'animations par perspective, paramètre `colors[]`) · Retro Diffusion : https://www.retrodiffusion.ai/ (propriétaire ; liste de styles à revérifier dans la doc API)
