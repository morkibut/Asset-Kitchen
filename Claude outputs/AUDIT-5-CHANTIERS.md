# Audit des cinq chantiers sprites — partie génération IA

*12 septembre 2026. Lecture directe des dépôts sur la machine de Damien. Ce document ne parle
que du workflow de génération ; l'ergonomie, la base de données et l'interface sont hors sujet.*

---

## 0. Le verdict en une page

| Dépôt | Ce que c'est | Voie d'animation | Verdict |
|---|---|---|---|
| **gag2** (Asset Kitchen) | Atelier complet Python/React, 7 couches, MCP | **Wan 2.2 I2V + ComfyUI local** | **Le seul à garder comme produit.** Techniquement en avance sur tout le reste |
| **MySpriteAi** | Pipeline TS navigateur, ComfyUI + SDXL | aucune (images fixes) | **Mine de pièces.** 3 modules à porter, pas un produit à reprendre |
| **sc-clone** (SpriteForge) | Clone SpriteCook en Node, OpenRouter + ComfyUI | AnimateDiff SD 1.5 | **Mine d'outils.** 5 outils manquants à gag2, mais sa voie d'animation est inférieure |
| **asset3d** | Photo → mesh 3D → rig → rendu multi-angles | **3D rendue** | **Voie orthogonale, pas concurrente.** La seule qui donne des boucles parfaites |
| **gag2-v3** | Une copie de gag2 du 2 septembre (`.git` est un fichier → arbre de travail) | — | **Ce n'est pas un projet.** À archiver ou supprimer |

**La question « est-ce que gag2 utilise bien Wan 2.2 » a une réponse nette : oui, et mieux que
ce que j'avais recommandé.** Le détail est au §2.

---

## 1. Ce que chaque dépôt fait de bien

### gag2 — Asset Kitchen

Ce qu'il a de remarquable, et que les quatre autres n'ont pas :

- **Il a mesuré que la voie « planche par modèle d'image » est morte.** Trois bancs, 141 planches,
  6,03 $ : *une bonne planche d'animation sur dix*, et *la façon de demander est épuisée comme
  levier* (31 réglages testés, puis 6 de plus). C'est pour ça que la V3 est passée aux clips
  vidéo découpés. **C'est exactement la conclusion à laquelle Pixel Engine est arrivé**, et tu y
  es arrivé seul, par la mesure. C'est le résultat le plus précieux de tout ce dossier.
- **La fenêtre commune au clip entier** (`image/bande.py`). Sans elle chaque image se recadre sur
  sa propre boîte et le personnage grandit de 10 % en se mettant à marcher — mesuré :
  repos 217×376 vs marche 246×380. L'erreur *juste à côté* — une fenêtre par bande — est
  documentée comme piège payé.
- **Le tramage ordonné de Bayer plutôt que Floyd-Steinberg** (`image/palette.py`), choisi
  précisément parce que le seuil dépend de la **position** du pixel et non de son voisinage :
  deux frames d'une même marche reçoivent leurs points aux mêmes endroits et l'herbe ne grésille
  pas. C'est du raisonnement d'animateur, pas de la recette copiée.
- **La mesure de stabilité** (`image/stabilite.py`) et **la détection de repos/boucle**
  (`image/rythme.py`), avec la règle *la détection propose, l'auteur juge*.
- **L'export Aseprite clé pour clé**, et l'image animée **découpée dans la planche exportée** :
  les deux fichiers ne peuvent pas diverger parce que l'un est fait de l'autre.
- **Le traitement non destructif** : image brute + recette, rendu = cache effaçable.
- **Le post-traitement ne touche jamais le GPU et n'appelle jamais le fournisseur.** Cette
  frontière est la raison pour laquelle tout le reste tient.

### MySpriteAi — trois pièces à récupérer, pas un produit

- **`server/comfyGraph.ts` — le traducteur format éditeur → format API.** C'est la pièce la plus
  précieuse des cinq dépôts. Il traite trois pièges chacun payé une fois : l'ordre des
  `widgets_values` (lu dans `input_order` de `/object_info`, avec les molettes fantômes derrière
  chaque graine), les nœuds muets (mode 2) et contournés (mode 4) *y compris quand c'est une boîte
  entière*, et les **sous-graphes** dépliés en clés `« 75:61 »`. Plus la règle qui n'est écrite
  nulle part ailleurs : *c'est l'entrée d'un nœud qui dit à quel fil elle est branchée, jamais
  l'inverse*.
- **`server/gpuManager.ts`** — file d'attente par domaine + `/free` au changement de famille, pour
  que l'image et le son ne se disputent jamais les 8 Go.
- **`src/lib/pixelPipeline.ts`** — et surtout sa décision durement acquise : **durcir l'alpha à 128
  avant la réduction**, sinon liseré clair autour du sprite.
- Le détourage BiRefNet **en passe séparée**, jamais greffé dans la recette de fabrication.

### sc-clone / SpriteForge — cinq outils que gag2 n'a pas

Le plus récent des cinq (validé aujourd'hui). Sa voie d'animation — AnimateDiff SD 1.5, 512 px,
6-8 frames, référence à 0,30 — est **en dessous** de celle de gag2 et son propre README le dit :
« peut produire peu de mouvement ». En revanche il porte des outils que gag2 n'a pas :

- **Détecteur de grille** : estimation du pas *et du décalage*, réglage manuel, reconstruction
  médiane. C'est l'équivalent du `grid.rs` de Pixel Engine.
- **Découpe par îlots alpha** (en plus de la découpe en grille).
- **Base de tileset** : dispositions 15/17 pièces, losanges isométriques, carte de test.
- **UI 9-slice** avec export Godot `StyleBoxTexture`.
- **Raccord des bords de textures**.
- Et un chiffre utile : trois tests GPT Image 2.5 Sunburst pour **0,0425 $** au total.

### asset3d — la voie orthogonale, et la seule qui boucle vraiment

Photo → mesh 3D → rig automatique → animation du pack local → rendu de N images sous un angle
choisi (dessus, iso 45°, côté, trois-quarts). La faisabilité technique est déjà validée brique par
brique ; ce qui manquait était l'interface d'essai.

**Ce que cette voie donne et qu'aucune diffusion ne donnera jamais :**

- une boucle **mathématiquement parfaite** (c'est la même animation rejouée) ;
- **les huit directions cohérentes entre elles** (c'est la même caméra qui tourne) ;
- l'**identité absolument stable** d'une frame à l'autre ;
- un coût marginal nul par animation supplémentaire une fois le personnage riggé.

Ce qu'elle ne donne pas : le charme du dessin. Un rendu 3D pixellisé se voit.

**Ne la mets pas en concurrence avec Wan.** Elles répondent à deux besoins différents :
la 3D pour les cycles de locomotion multi-directions (marche, course, idle — ce qui doit être
parfait et se répète), Wan pour les gestes expressifs uniques (attaque, sort, mort — ce qui doit
avoir du style et ne se voit qu'une fois).

### gag2-v3

Son `.git` est un **fichier**, pas un dossier : c'est un arbre de travail Git de gag2, figé au
2 septembre. Son `AGENTS.md` de 53 Ko est l'ancienne version du fichier de 36 Ko de gag2 — donc
une régression documentaire, pas une avance. Rien à en tirer.

---

## 2. gag2 utilise-t-il bien Wan 2.2 ? — oui, et voici la preuve

`atelier/fournisseur/montage_maison.py` écrit le graphe ComfyUI lui-même, au format API :

| Pièce | Ce qui est chargé |
|---|---|
| Modèle | `Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf` + `LowNoise` — **les deux experts**, chargés/déchargés à tour de rôle |
| Accélération | `wan2.2_i2v_lightx2v_4steps_lora_v1` haut et bas — distillation **4 étapes** |
| Style | `wan2.2_animate_adapter_model.safetensors` — **le LoRA `styly-agents/Wan2-2-pixel-animate`** |
| Encodeur | `umt5_xxl_fp8_e4m3fn_scaled` (version non compressée, contournement `protobuf` documenté) |
| VAE | `wan_2.1_vae` |
| Conditionnement | `WanImageToVideo` en remplacement de `PainterI2V` absent — *vérifié après coup, le sprite est ancré au pixel près sur la première image* |
| Réglages | 4 étapes, fidélité 1,0, `ddim`, `simple`, décalage 5,0, bascule à l'étape 2, **16 fps** |
| Contraintes | images en `4n+1`, côtés multiples de 16, arrondi **vers le haut** |
| Mémoire | **6,0 Go pris sur 6,92 disponibles**, mesuré |

Et côté préparation de l'entrée (`services/animation.py::preparer_entree`) : **toile au format
demandé, fond gris du produit, sujet agrandi à un facteur entier pour que ses pixels restent
carrés**.

**Autrement dit : les quatre conventions que j'avais présentées comme « le savoir-faire à copier
chez Pixel Engine » sont déjà dans gag2.** Fond gris, agrandissement entier au plus proche voisin,
marge, palette partagée. Mon plan « week-end 1 » était la description de ton propre dépôt. C'est
ma faute : j'aurais dû lire avant de recommander.

---

## 3. Les manques réels de gag2, classés par rapport gain/effort

### 🟢 À faire — fort gain, effort faible

**M1. Les consignes de mouvement font 12-15 mots ; il en faut 30 à 50.**
`atelier/domaine/mouvement.py` écrit par exemple :

> `walking cycle, full body, steady even pace, walking in place without moving across the frame, looping seamlessly`

C'est une **description d'état**, pas une **description temporelle**. Pixel Engine documente
explicitement que sous 15 mots, le modèle produit *« the wrong action, not a rougher version of the
right one »*, et que ses captions d'entraînement font 30 à 50 mots. Wan 2.2 a la même
caractéristique — il a été entraîné sur des descriptions longues et narratives.

Le gabarit à appliquer, relevé mot pour mot sur leur endpoint gratuit :
« **The character** » + deux phrases + état de départ → action → résolution + la direction à
l'écran + la mention explicite de la boucle. Exemple :

> *The character performs a steady walk cycle, stepping forward with alternating legs while the arms
> swing in counterpoint. Their torso rises and falls gently with each step, returning to the
> starting pose to close a seamless loop.*

**Effort : réécrire une dizaine de chaînes.** C'est le meilleur rapport gain/effort des sept.
Les huit gabarits sont déjà écrits dans `build_dataset.py` (livré avec le guide d'entraînement).

**M2. La palette est commune à la bande, pas au personnage.**
`_avec_la_palette_de_la_bande` calcule la palette sur les frames d'**une** bande. Résultat : la
marche et l'attaque du même personnage, cut de deux clips différents, n'ont pas la même palette —
le personnage change de couleurs en changeant d'animation. C'est le même défaut que la fenêtre
par bande, déjà corrigé une fois pour la géométrie ; il reste ouvert pour la couleur.

La palette imposée du jeu couvre le cas quand elle est réglée. **Il manque le niveau
intermédiaire : une palette par personnage**, calculée une fois sur toutes ses bandes.

**M3. 16 fps en entrée, 8 fps en sortie.** Wan rend à 16 images/seconde ; Pixel Engine sort ses
animations à **8 fps exactement** (mesuré : 125 ms par frame sur les deux modèles). Un cycle de
marche de jeu se lit à 8-12 fps. Si le montage prend les images consécutives du clip, tu décris
un mouvement deux fois trop lent pour la même quantité de frames. **Prendre une image sur deux**
(ou demander deux fois plus de frames et décimer) donne des cycles nettement plus lisibles.
À vérifier dans `services/montage.py` avant de changer quoi que ce soit.

### 🟡 À considérer — gain réel, effort moyen

**M4. La coupe médiane peut être remplacée par du k-means à graine fixe.**
`AGENTS.md` écarte k-means pour une raison explicite : *« une initialisation tirée au sort — le
k-means++ de MySpriteAi, par exemple — rendrait deux images différentes pour la même recette »*.

**Cet argument est réfutable, et Pixel Engine en est la preuve** : leur quantificateur est un
k-means avec `k_seed: 42`, `max_kmeans_iterations: 15`, et une fusion des centroïdes plus proches
que `ΔE 5.0`. Graine fixe ⇒ **parfaitement déterministe**, exactement au sens de ton critère.
Le déterminisme n'était pas une raison de choisir la coupe médiane, seulement une raison de fixer
la graine.

Ce que ça change : la coupe médiane découpe l'espace par **volume de boîte**, donc elle dépense
ses couleurs là où il y a du dégradé plutôt que là où il y a du sujet. Sur un sprite, k-means en
Lab + fusion à ΔE 5 rend des palettes visiblement plus propres — c'est ce qui explique qu'en
demandant 24 couleurs Pixel Engine en rende 22, et 16 en rende 12 : il fusionne ce qui ne se
distingue pas à l'œil.

`pixel_pipeline.py` (livré) contient cette implémentation, constantes d'origine comprises.

**M5. Pas de détecteur de grille.** Pixel Engine a `classify_image` (trois classes, avec
`estimated_scale`) et une détection de grille par pics d'énergie de bord + *walker* à pas
quasi-constant, qui gère les agrandissements à facteur **non entier**. sc-clone a déjà un
détecteur de pas et de décalage. gag2 n'a que la mesure de bloc de la V2.3.

Utilité concrète : importer n'importe quelle image trouvée ailleurs et la ramener à sa vraie
résolution native. Aujourd'hui ça demande un réglage manuel.

**M6. Un seul montage ComfyUI, écrit en dur.** Le choix est argumenté et il est bon — un montage
importé serait un fichier à maintenir. Mais MySpriteAi a démontré la valeur de l'autre voie : un
traducteur éditeur→API permet de tester un workflow trouvé en ligne sans écrire une ligne. Les
deux peuvent coexister : le montage maison reste le défaut, l'import devient un mode avancé.

### 🔴 À ne pas faire maintenant

**M7. Le conditionnement par keyframes.** Pixel Engine le propose (`/keyframes` : des images de
référence à des positions précises, avec une force par image). Wan 2.2 ne sait pas le faire ;
c'est une capacité native de LTX-Video, et ça voudrait dire un second moteur. **Reporte.**

---

## 4. Ce qu'il ne faut pas faire

1. **Ne pas relancer un sixième chantier.** Les cinq existants ne sont pas cinq échecs : ce sont
   une bonne base (gag2) et quatre carrières de pierres. Le problème n'est pas qu'il manque un
   projet, c'est que trois d'entre eux n'ont pas été fermés explicitement.
2. **Ne pas fusionner sc-clone dans gag2.** Prendre les cinq outils manquants un par un, oui.
   Fusionner deux architectures, non — l'une est Node et sans base, l'autre est Python hexagonal
   avec SQLite.
3. **Ne pas abandonner asset3d.** C'est la seule voie qui donne des boucles parfaites et huit
   directions cohérentes. Elle ne concurrence pas Wan, elle le complète.
4. **Ne pas entraîner de modèle maintenant.** Voir §5.

---

## 5. Sur l'entraînement — tu avais raison, j'ai survendu

Tu as écrit : *« je pense que c'est pas si facile d'avoir un bon résultat que ce que tu m'annonces
sinon il y aurait déjà plein de modèles équivalents à Pixel Engine 1.5 en open source »*.

C'est un argument juste, et la preuve est dans ton propre dépôt : **le LoRA que tu charges déjà,
`styly-agents/Wan2-2-pixel-animate`, *est* la tentative open source la plus sérieuse** — 226 clips,
rang 256, 100 époques. Et il n'égale pas Pixel Engine 1.5. Quelqu'un a fait exactement ce que je
décrivais, avec méthode, et le résultat reste en dessous.

Ce que j'aurais dû dire :

- Le **coût GPU** est effectivement faible (quelques dizaines d'euros). Ça, c'était exact.
- Le **coût réel** est le dataset, et il est bien plus élevé que « trois week-ends » : il faut
  des centaines de cycles d'animation cohérents, légalement utilisables, cadrés de la même façon,
  et légendés au même gabarit. Les sprite sheets de qualité sont rares, sous licence, et
  hétérogènes.
- Entre « un LoRA qui marche parfois » et « un modèle qui tient la cohérence de personnage sur
  seize frames », il y a un fossé qui se franchit par l'**itération** — beaucoup de runs, une
  batterie d'évaluation, du jugement artistique. C'est un métier, et 18 mois à temps plein pour
  une personne, c'est cohérent.

**Donc : ne t'entraîne pas maintenant.** Fais M1, M2 et M3 — quelques heures de travail sur du
code que tu connais — et remesure. S'il reste un écart avec Pixel Engine après ça, alors la
question de l'entraînement se posera avec des données, et pas avant.

---

## 6. Ce que je ferais, dans l'ordre

1. **Fermer** gag2-v3 (archiver le dossier), et écrire en trois lignes dans `AGENTS.md` de gag2 ce
   que sc-clone et asset3d sont devenus — comme c'est déjà fait pour MySpriteAi et GAG.
2. **M1** (les consignes de mouvement au gabarit 30-50 mots) et remesurer sur la même batterie de
   sprites qu'avant. C'est une demi-journée.
3. **M3** (la cadence) — vérifier d'abord, corriger ensuite.
4. **M2** (palette par personnage).
5. Décider de M4 avec un banc : même sprite, coupe médiane contre k-means-42, à 16 et 24 couleurs.
6. Reprendre de sc-clone le détecteur de grille et la découpe par îlots alpha (M5).
