# Relevé — Pixel Engine, et ce qui s'en reprend

> Relevé du **12 septembre 2026** sur `pixelengine.ai`, compte gratuit de l'auteur.
> **Il ne fait foi sur rien** : ce qui est décidé pour l'atelier vit dans le PRD, l'architecture
> et le plan. Il garde ce qui a été mesuré chez un concurrent qui résout le même problème, et
> nomme ce qui s'en reprend — pour que personne n'ait à refaire l'enquête.
>
> **Chaque affirmation porte sa source.** Trois niveaux, jamais mélangés : *mesuré* (exécuté et
> relevé), *documenté* (écrit par eux), *déduit* (raisonnement, donc faillible).

---

## Pourquoi ce document, et ce qu'il remplace

Pixel Engine est le moteur d'animation qui alimente Retro Diffusion, SpriteCook, SpriteLab,
MeowArt et Sprite AI. C'est donc **le fournisseur commun de tous les produits qui servent de
référence à l'atelier**, SpriteCook compris — dont l'anatomie est relevée par ailleurs
(`Anatomie de SpriteCook.html`, hors dépôt depuis le 30 octobre 2026).

Le relevé répond à une seule question : *qu'est-ce qui fait que leurs sorties sont du vrai pixel
art, et lesquelles de leurs décisions valent d'être reprises ici ?*

**La réponse courte : la valeur n'est pas dans le modèle.** Elle est dans ce qui l'entoure, et
cette partie-là est entièrement décodée.

---

## 1. Ce qu'est Pixel Engine — trois couches, une seule difficile

| Couche | Ce que c'est | Reproductible ? |
|---|---|---|
| **Le modèle d'animation** | Un modèle de diffusion vidéo image→vidéo, entraîné par une personne seule (Todd Grilliot, à plein temps depuis avril 2025) | Non — c'est leur seul actif |
| **Le pipeline pixel** | Du Rust compilé en WebAssembly : détection de grille, k-means, palette partagée | **Oui, intégralement** — voir §3 |
| **Le reste** | Génération d'images fixes = Google Nano Banana 2/Pro et OpenAI GPT-Image 2.5 derrière des alias ; éditeur = un fork de Piskel | Oui, et c'est du wrapper |

*Documenté* — leur propre référence d'API :

> « The two `-engine-` models are **the same weights down two different pipelines** »

`pixel-engine-v1.1` et `frame-engine-v1.1` sont **le même modèle**. Le « pixel » n'est nulle part
dans les poids : il est dans le pré et le post-traitement. **C'est l'invariant central de tout ce
document**, et c'est aussi la thèse de l'atelier depuis la V3 — *le post-traitement ne touche
jamais le GPU*.

---

## 2. Leur chaîne, étape par étape

```
sprite de l'auteur (ex. 66×66 PNG, 10 couleurs, alpha)
  │
  ├─ classification            → est-ce du pixel art ? agrandi ? de quel facteur ?
  ├─ toile carrée (optionnelle)→ edge-extend / couleur unie / transparent
  ├─ aplatissement de l'alpha  → sur une couleur de fond, défaut #808080 (GRIS)
  ├─ agrandissement interne    → jusqu'à la résolution du modèle
  │
  ├──────────► MODÈLE VIDÉO (N images) ◄──────────
  │
  ├─ grille                    → UNE seule grille pour toutes les images
  ├─ réduction                 → retour à la taille EXACTE de l'entrée
  ├─ k-means                   → UNE seule palette, calculée sur TOUTES les images
  ├─ fusion des centroïdes     → ΔE < 5,0
  └─ webp / gif / planche, à 8 images par seconde
```

**Deux décisions font toute la différence perçue**, et l'atelier en tient déjà une et demie :

1. **La taille de sortie est celle de l'entrée, au pixel près.** *Mesuré* sur leurs démonstrations
   publiques : 40×40, 47×47, 49×49, 65×65, 66×66, 78×78, 79×79, 97×97, 119×119 — des tailles
   impaires et arbitraires, avec un bloc de 1. La réduction est pilotée par la taille du sprite
   d'entrée, jamais par la grille détectée.
2. **Une seule palette pour toute la séquence.** *Mesuré* : sur `hero_slash`, 12 à 15 couleurs par
   image et **15 en union** ; sur la génération payée ici, **12 par image et 12 en union**. La
   palette est calculée une fois, sur tous les pixels de toutes les images.

Le fond gris n'est pas cosmétique. *Documenté*, infobulle de leur sélecteur de modèle :
« your starting image should be posed correctly on a **grey background** » ; espace réservé du
champ de texte : « Character punching, grey background, facing right… ». **Leur jeu
d'entraînement est sur fond gris neutre.** Le détourage vient après, avec un seuil qui « colle
chaque pixel de sortie à totalement opaque ou totalement transparent » — pas d'anti-crénelage sur
l'alpha, sinon ce n'est plus du pixel art.

---

## 3. Le pipeline pixel, constantes exactes

*Mesuré.* Leur module `pixel_engine_pixel_tools_bg.wasm` (557 695 octets, Rust, crates `image
0.24.9` / `png` / `rand_chacha`) est **servi publiquement au navigateur**. Ré-instancié et
exécuté, il rend sa propre configuration :

```json
{
  "color_mode": "count", "color_count": 24,
  "k_seed": 42, "max_kmeans_iterations": 15,
  "peak_threshold_multiplier": 0.2, "peak_distance_filter": 4,
  "max_step_ratio": 1.8,
  "walker_search_window_ratio": 0.35, "walker_min_search_window": 2.0,
  "walker_strength_threshold": 0.5,
  "min_cuts_per_axis": 4, "fallback_target_segments": 64,
  "preserve_aspect_ratio": true,
  "histogram_prune_threshold": 0.0, "centroid_merge_threshold": 5.0
}
```

Pour une **séquence**, trois valeurs changent — `max_kmeans_iterations: 20`,
`peak_distance_filter: 2`, `histogram_prune_threshold: 5e-7` — et la metadata porte en plus
`frame_count` et **`grid_cells`** : une grille unique pour toute la séquence.

Modules Rust laissés dans les chemins de panique : `classify.rs`, `grid.rs`, `quantize.rs`,
`kmeans.rs`, `color.rs`, `reframe.rs`, `process.rs`, `profile.rs`. **Aucune bibliothèque de
quantification tierce** — ni `imagequant`, ni `color_quant` : le quantificateur est maison.

### La détection de grille, telle que la configuration la décrit

1. Énergie de bord cumulée par colonne et par ligne.
2. Pics au-dessus de `moyenne × 0,2`, filtrés pour être distants d'au moins 4 px (2 en séquence).
3. Estimation d'un pas dominant, en rejetant les écarts hors du ratio 1,8.
4. **Un « marcheur »** avance de pas en pas et, dans une fenêtre `±max(2, pas × 0,35)`, accroche
   le bord le plus fort si sa force dépasse `0,5 × moyenne` ; sinon il pose la coupe à la position
   théorique. ⚠️ **C'est ce qui gère les agrandissements à facteur non entier** — les cellules
   n'ont alors pas toutes la même largeur, et une grille régulière se trompe partout.
5. Échec → repli sur 64 segments par axe.

### La classification

`classify_image` rend trois classes — `real_pixel_art`, `upscaled_pixel_art`, `not_pixel_art` —
avec `estimated_scale`, et des métriques lisibles : `unique_colors`, `unique_alpha_values`,
`valley_depth`, `autocorr_strength`, `autocorr_period`, `sparse_pattern`, `entropy`,
`top_10_coverage`. Les règles se lisent en clair dans le champ `reason` qu'il renvoie :

- peu de couleurs **et** petite dimension → `real_pixel_art`, et la palette d'origine est extraite ;
- peu de couleurs **et** signature d'agrandissement (autocorrélation forte + motif clairsemé) →
  `upscaled_pixel_art` + le facteur ;
- beaucoup de couleurs **et** faible couverture du top-10 → `not_pixel_art`.

### ⚠️ Le point qui contredit une décision de l'atelier

`AGENTS.md` écarte k-means au nom du déterminisme :

> *« une initialisation tirée au sort — le k-means++ de MySpriteAi, par exemple — rendrait deux
> images différentes pour la même recette »*

**L'argument tombe devant `k_seed: 42`.** Un k-means++ à graine fixe est parfaitement
déterministe, au sens exact du critère de l'atelier — *une recette nommée, réappliquée ailleurs,
donne exactement le même résultat*. Le déterminisme n'était pas une raison de choisir la coupe
médiane, seulement une raison de fixer la graine.

Ce que ça change en pratique : la coupe médiane découpe l'espace par **volume de boîte**, donc
elle dépense ses couleurs là où il y a du dégradé plutôt que là où il y a du sujet. K-means en Lab
suivi d'une fusion des centroïdes à ΔE 5 rend des palettes plus propres — c'est ce qui explique
qu'en demandant 24 couleurs ils en rendent 22, et 12 pour 16 demandées : **ils fusionnent ce qui
ne se distingue pas à l'œil**.

*Une ré-implémentation Python vérifiée existe* (`pixel_pipeline.py`, livré hors dépôt) : sur un
sprite 66×66 agrandi ×7 au plus proche voisin, elle rend `upscaled_pixel_art`, facteur 7, et
retrouve 66×66 avec la palette d'origine ; sur une séquence de six images floutées à 16 couleurs,
elle rend 16 couleurs identiques sur les six.

---

## 4. Le gabarit de consigne — la reprise la plus directe

*Mesuré* sur leur point d'entrée `/enhance-prompt`, gratuit et synchrone. C'est la distribution
de légendes sur laquelle leur modèle a été entraîné, et ils la documentent :

> *documenté* — « The model was **trained on 30–50 word captions** and short prompts produce
> semantically wrong results — **the wrong action, not a rougher version of the right one**. »

Le seuil de déclenchement de leur réécriture automatique est **15 mots**.

Le gabarit, invariable sur six essais :

- ouverture par **« The character … »** ;
- **deux phrases**, 30 à 50 mots ;
- **uniquement de la cinématique** : état de départ → action → résolution. Zéro adjectif
  d'ambiance, zéro description d'apparence — celle-ci vient de l'image ;
- la **direction à l'écran** (« from left to right », « across the screen ») ;
- la **mention explicite de la boucle** quand c'en est une.

Sorties réelles :

| Demandé | Rendu |
|---|---|
| `run cycle` | *The character performs a standard run cycle, moving rapidly from left to right with alternating arm and leg swings. Their body bops up and down rhythmically as they maintain a steady, forward-moving stride.* |
| `sword slash attack` | *The character steps forward to deliver a swift sword slash attack, swinging the blade horizontally across the screen in a decisive arc. The motion flows continuously through the strike without returning to a resting stance.* |
| `idle breathing` | *The character stands in a neutral stance, gently bobbing up and down in a rhythmic breathing cycle. Their shoulders and chest rise and fall continuously to maintain the seamless loop.* |

⚠️ **`atelier/domaine/mouvement.py` écrit aujourd'hui des consignes de 12 à 15 mots** — par
exemple `walking cycle, full body, steady even pace, walking in place without moving across the
frame, looping seamlessly`. C'est une **description d'état**, là où le modèle attend une
**description temporelle**. Wan 2.2 a la même caractéristique que leur modèle : il a été entraîné
sur des descriptions longues et narratives. Voir §7, M1.

---

## 5. Ce qui a été mesuré sur deux générations payées

Même sprite 66×66, même consigne, même graine 12345, six images, seize couleurs. 46 crédits.

| Mesure | `pixel-engine-v1.1` | `pixel-engine-v1.5` |
|---|---|---|
| Taille de sortie | 66×66 | 66×66 |
| Cadence | **8 im/s** (125 ms) | **8 im/s** |
| Couleurs par image | 12, 12, 12, 12, 12, 12 | 12, 12, 14, 14, 14, 13 |
| Union des palettes | **12** | **14** |
| Fond | gris conservé (126,126,125) | **vert inventé** (57,87,0) |
| Écart moyen image 0 ↔ entrée | **2,28** | **60,25** |
| Écart moyen autres images ↔ entrée | 13 à 19 | 71 à 77 |

**Lecture.** `v1.1` **remplace le latent de la première image par le sprite d'entrée** : l'écart
de 2,28 n'est que le bruit de l'aller-retour du VAE plus la requantification. L'identité est
verrouillée, d'où leur propre étiquette *« often better for loops, walk cycles and idles »*.
`v1.5` conditionne mollement : il réinvente le décor, change la pose dès la première image, et
dérive sur l'identité (l'armure passe au rouge en fin de séquence). D'où *« stronger prompt
adherence and pose changes »*.

**Le bouclage est une propriété apprise, pas un post-traitement.** *Mesuré* sur leurs cinq
démonstrations publiques : l'écart entre la dernière et la première image est **systématiquement
inférieur** à l'écart moyen entre images voisines (0,131 contre 0,168 ; 0,120 contre 0,133 ;
0,095 contre 0,120 ; 0,092 contre 0,187 ; 0,059 contre 0,125). Sur la génération payée ici, moins
choisie, le bouclage est en revanche médiocre — 0,194 contre 0,170.

⚠️ **La cadence de 8 images par seconde est un fait, pas une préférence.** Les deux modèles
sortent à 125 ms par image, exactement.

---

## 6. Leur infrastructure, pour mémoire

Next.js sur Vercel ; **Supabase** pour l'authentification, les travaux, les médias et le
portefeuille ; l'API publique est faite d'Edge Functions (`api.pixelengine.ai/functions/v1`) ;
le calcul tourne sur **Modal** en GPU sans serveur (`/api/modal/start-job`). La table `jobs` porte
un champ `active_node_label` — *déduit* : la génération est un **graphe de nœuds** dont on remonte
le nœud courant, ce qui ressemble à un graphe ComfyUI ou à un moteur équivalent.

Les crédits sont **réservés** à la soumission (`wallet_holds`, `hold_status`
open/released/captured) et **capturés** au succès seulement. Les sorties expirent à 24 h.

---

## 7. Ce qui se reprend ici — sept points, classés

Établis en comparant ce relevé au code de l'atelier le 12 septembre 2026.

### 🟢 Fort gain, effort faible

**M1 — Les consignes de mouvement au gabarit 30-50 mots.** `atelier/domaine/mouvement.py`.
Voir §4. C'est le meilleur rapport gain/effort des sept : une dizaine de chaînes à réécrire.
Gabarit :

> *The character performs a steady walk cycle, stepping forward with alternating legs while the
> arms swing in counterpoint. Their torso rises and falls gently with each step, returning to the
> starting pose to close a seamless loop.*

**M2 — Une palette par personnage, entre la bande et le jeu.**
`_avec_la_palette_de_la_bande` (`atelier/image/bande.py`) calcule la palette sur les images d'**une**
bande. La marche et l'attaque du même personnage, taillées dans deux clips, n'ont donc pas la même
palette : le personnage change de couleurs en changeant d'animation. ⚠️ **C'est exactement le
défaut déjà corrigé une fois pour la géométrie** — la fenêtre commune se prend sur le clip entier,
jamais sur la bande seule — et il reste ouvert pour la couleur. La palette imposée du jeu couvre
le cas quand elle est réglée ; **il manque le niveau intermédiaire**.

**M3 — La cadence.** Wan rend à 16 images par seconde, Pixel Engine sort à 8 (§5). Un cycle de
marche de jeu se lit à 8-12. Si le montage prend les images consécutives du clip, le mouvement
décrit est deux fois trop lent pour le même nombre d'images. **Vérifier `services/montage.py`
avant de changer quoi que ce soit** — il est possible que ce soit déjà traité par la sélection
d'images de `A10`.

### 🟡 Gain réel, effort moyen

**M4 — K-means à graine fixe plutôt que coupe médiane.** Voir §3, l'argument du déterminisme.
Trancher par un banc : même sprite, coupe médiane contre k-means-42, à 16 et 24 couleurs.

**M5 — Un détecteur de grille.** §3. Utilité concrète : ramener n'importe quelle image importée à
sa résolution native sans réglage manuel. `sc-clone` en a déjà un (pas et décalage, reconstruction
médiane) ; leur marcheur gère en plus le facteur non entier.

**M6 — Un traducteur de montage éditeur → API.** L'atelier écrit son montage lui-même, et la
raison est bonne — un montage importé serait un fichier à maintenir. Mais `MySpriteAi`
(`server/comfyGraph.ts`) a démontré la valeur de l'autre voie : essayer un workflow trouvé en ligne
sans écrire une ligne. **Les deux peuvent coexister** : le montage maison reste le défaut, l'import
devient un mode avancé.

### 🔴 Pas maintenant

**M7 — Le conditionnement par images clés.** Leur point d'entrée `/keyframes` prend des images de
référence à des positions précises, avec une force par image. *Déduit, avec une certitude forte* :
c'est **LTX-Video** — le nom interne est `ltx-keyframes-v1`, le contrat d'API est celui des
*conditioning items* de LTX au champ près, et la divisibilité par 64 correspond à leur pipeline en
deux passes. Wan 2.2 ne sait pas le faire : ce serait un second moteur.

---

## 8. Ce que l'atelier fait déjà comme eux — à ne pas refaire

Relevé en comparant le code le 12 septembre 2026. **Les quatre conventions qui font leur qualité
sont déjà tenues ici :**

| Leur convention | Où elle vit dans l'atelier |
|---|---|
| Fond gris avant génération | `services/animation.py::preparer_entree` |
| Agrandissement à facteur entier, plus proche voisin | idem, et `image/clip.py` |
| Marge autour du sujet | la toile au format demandé |
| Palette partagée entre images | `image/bande.py::_avec_la_palette_de_la_bande` (par bande — voir M2) |

Et **trois choses que l'atelier a et qu'eux n'ont pas** :

- la **fenêtre commune au clip entier**, avec le piège « une fenêtre par bande » déjà payé ;
- le **tramage ordonné de Bayer** plutôt que Floyd-Steinberg, choisi parce que le seuil dépend de
  la position du pixel et non de son voisinage — deux images d'une même marche reçoivent leurs
  points aux mêmes endroits ;
- le **traitement non destructif** : image brute plus recette, le rendu n'est qu'un cache.

⚠️ **Le montage local est à jour et correctement réglé** (`fournisseur/montage_maison.py`) : Wan 2.2
I2V A14B en GGUF Q4, les deux experts chargés à tour de rôle, le greffon `lightx2v` à quatre
étapes, le greffon pixel de `styly-agents/Wan2-2-pixel-animate`, `WanImageToVideo` en remplacement
de `PainterI2V` absent, fidélité 1,0, décalage 5,0, bascule à l'étape 2. **Rien à y changer.**

---

## 9. Sur l'entraînement d'un modèle — la question est fermée pour l'instant

Elle se pose, parce que c'est la seule couche non reproduite. **Elle se referme sur une preuve
tirée du dépôt lui-même** : le greffon déjà chargé par l'atelier,
`styly-agents/Wan2-2-pixel-animate`, **est** la tentative libre la plus sérieuse — 226 clips,
rang 256, cent époques. Quelqu'un a fait, avec méthode, exactement ce qu'il faudrait faire. Et le
résultat n'égale pas Pixel Engine 1.5.

Ce qui est vrai et ce qui ne l'est pas :

- Le **coût de calcul** est faible : un greffon sérieux tient en 5 à 15 heures de GPU loué, soit
  quelques dizaines d'euros tout compris. Une RTX A6000 de 48 Go se loue 0,53 $/h (septembre 2026).
- Le **coût réel est le jeu de données** : des centaines de cycles cohérents, légalement
  utilisables, cadrés pareil et légendés au même gabarit. Les planches de qualité sont rares,
  sous licence, hétérogènes.
- Entre « un greffon qui marche parfois » et « un modèle qui tient l'identité d'un personnage sur
  seize images », il y a un fossé qui se franchit par l'itération et le jugement artistique.
  Dix-huit mois à plein temps pour une personne, c'est cohérent.

**Décision de l'auteur, 12 septembre 2026 : ne pas entraîner.** Faire M1, M2 et M3, remesurer,
et ne rouvrir la question qu'avec des chiffres.

*Un script de fabrication de jeu de données existe hors dépôt* (`build_dataset.py`) : planches →
clips sur fond gris, agrandissement entier, boucle répétée jusqu'au quota d'images, légendes au
gabarit du §4. Il ne sert que si la question se rouvre.

---

## 10. Les quatre dépôts voisins — état au 12 septembre 2026

Complète `AGENTS.md` § Les projets voisins, qui n'en connaît que deux.

| Dépôt | Voie d'animation | Ce qu'il a et que l'atelier n'a pas |
|---|---|---|
| `../MySpriteAi` | aucune (images fixes) | `server/comfyGraph.ts` (traducteur éditeur→API : ordre des `widgets_values` lu dans `input_order`, nœuds muets et contournés, sous-graphes dépliés) ; `server/gpuManager.ts` (file par domaine, `/free` au changement de famille) ; *durcir l'alpha à 128 avant la réduction*, sinon liseré clair |
| `../sc-clone` (SpriteForge) | AnimateDiff SD 1.5 — **inférieure** à celle de l'atelier, son propre README le dit | détecteur de grille (pas **et** décalage) ; découpe par îlots alpha ; tilesets 15/17 et losanges isométriques ; 9-slice avec export `StyleBoxTexture` ; raccord des bords de textures |
| `../asset3d` | **3D rendue** — photo → maillage → rig → rendu multi-angles | la boucle **mathématiquement parfaite**, les huit directions cohérentes entre elles, l'identité absolument stable, le coût marginal nul par animation supplémentaire |
| `../gag2-v3` | — | rien : son `.git` est un **fichier**, c'est un arbre de travail de ce dépôt figé au 2 septembre |

⚠️ **`asset3d` n'est pas un concurrent de la voie Wan, c'est son complément.** La 3D pour ce qui
doit être parfait et se répète — locomotion, huit directions, idle. Wan pour ce qui doit avoir du
style et ne se voit qu'une fois — attaque, sort, mort. Les mettre en concurrence ferait perdre
l'une des deux pour rien.

---

## 11. Ce qui reste incertain

| Question | Statut | Comment trancher |
|---|---|---|
| Base réelle de `pixel-engine-v1.5` | *déduit* : LTX distillé (multiple de 32, CFG-distillé à 1,0, sibling nommé `ltx-keyframes-v1`) | comparer les artefacts avec LTX-2.5-Fast en local sur la même consigne |
| Architecture de `pixel-engine-v1.1` | *déduit, faible* : empreinte multiple de 8 et images paires — ne correspond à aucune base publique connue | générer à 2, 4, 8, 16, 24 images et chronométrer : linéaire ⇒ attention complète, paliers ⇒ fenêtrage |
| Taille du jeu de données | inconnue | — |
| Résolution interne en mode pixel | non documentée | envoyer un sprite à motif haute fréquence et voir ce qui survit |
| Leur graphe GPU | un nom d'étape est exposé | **la piste la plus rentable** : interroger `GET /jobs` toutes les 500 ms pendant un travail et journaliser la suite des `active_node_label` — ça donne la topologie de leur pipeline, pour une seule génération |

---

## Sources

- Documentation publique : `pixelengine.ai/docs/api-reference`, `/docs/introduction`, `/guides/*`.
- Module WebAssembly public `pixelengine.ai/wasm/pixel_engine_pixel_tools_bg.wasm`, ré-instancié
  et exécuté ; la configuration du §3 est **rendue par le module lui-même**.
- Paquets JavaScript de l'application : table de tarification (`ltx-keyframes-v1`), constantes
  (`H3_OUTPUT_FRAMES_OPTIONS`, `PIXEL_COLOR_OPTIONS`, `PROMPT_ENHANCE_WORD_THRESHOLD = 15`),
  chemins d'API (`/api/modal/start-job`).
- Deux générations payées sur le compte de l'auteur, travaux `f90c0c13…` (v1.1) et `ed31dd9f…`
  (v1.5), 46 crédits, 12 septembre 2026.
- Analyse image des démonstrations publiques (dix GIF, décodage image par image).
- Le dossier complet, la ré-implémentation `pixel_pipeline.py`, le script `build_dataset.py`, la
  planche de comparaison v1.1/v1.5 et le guide d'entraînement vivent dans le projet Claude
  « pixelengine ».
