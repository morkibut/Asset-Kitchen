# D — Confrontation de la planification V3 (Asset Kitchen) à l'état de l'art open source

> Relecture du 2 septembre 2026, sur le snapshot `docs/` du même jour et les fiches `research/02, 04, 05, 06, 07, 08, 09, 12, 13`. Aucun code lu, sauf `pyproject.toml` (dépendances déclarées), parce qu'une affirmation du bilan en dépend.
>
> Convention : **[docs]** = lu dans la documentation du dépôt ; **[recherche]** = lu dans les fiches d'état de l'art ; **[avis]** = mon jugement. Les chiffres non marqués viennent des docs.

---

## 1 · La stratégie V3, résumée fidèlement

### Ce qui fonde tout

**[docs]** Trois bancs payés (141 planches, 6,03 $, toutes notées à l'œil) : **14 bonnes sur 135**, une sur dix ; `gpt-image-2` signe 13 des 14, à 5–17 centimes la bonne. **Zéro bonne sur 36** en réécrivant la demande ; le paragraphe qui interdit de redessiner le quadrillage est décisif (0/50 avec, 47/53 sans). La mesure automatique « forme » **ne prédit pas** les notes (13 % de bonnes parmi les retenues, 10 % parmi les rejetées). Le juge unique dérive : 5 notes sur 8 ont monté à la relecture (25 % → 62 %). Le code écrase le mouvement : `sur_grille` recadre chaque étape sur sa propre boîte, et les huit images livrées ont la même hauteur au pixel. Le halo de détourage vaut un millième du contour : chantier de matting évité.

### Les six décisions durables

| # | Décision | Ce qu'elle renverse | Tranche |
|---|---|---|---|
| 1 | La planche est un objet du produit (se voit, se garde, se redéplie) | « le pliage est une ruse d'appel, jamais un format de livraison » | A1 |
| 2 | Une bande est un tout : fenêtre commune, jamais un recadrage par étape | le comportement actuel de `sur_grille` | A2 |
| 3 | On commande N planches et on garde la bonne ; on n'en corrige jamais une | — | A3 |
| 4 | Ce qui sort : les images **et** le pantin (images = sortie principale) | — | A4, A8 |
| 5 | Un mouvement appartient à l'atelier, pas au projet | — | A6 |
| 6 | Le pantin ne sert que les poses d'une même vue ; les 8 directions restent de la génération | — | A8 |

### Les chemins écartés

**[docs]** Mieux écrire la demande (mort, mesuré ; seul le *rangement* du texte reste : R7, sans promesse de taux). Le brouillon sur fournisseur gratuit (n'accepte aucune image). La correction du bord par transparence. La 3D auto-riguée (Meshy) et le report d'un mouvement filmé (Ludo.ai) : « non mesurés, payants ou suspendus à un compte », repris seulement si A0/A8 échouent. Le mannequin 3D de posture est rangé dans la « quatrième voie » d'A0.

### L'ordre

**[docs]** `R6` (planche à 9 sujets acceptée, contrôle de remplissage) → `R7` (texte en trois parties) → **V2.3 entière** (`D1` recette par nature d'image, `D2` grille retrouvée, `D3` fond = réglage de projet, `D4` moteurs de détourage) → **V3** : `A1` planche gardée → `A2` bande recadrée d'un tenant → `A3` N planches, garder la bonne → `A4` export ; `A5` contour stable (attend A2 + D2) ; `A6` mouvement nommé ; `A7` corriger une étape ; `A8` le pantin (attend A0, A4, A6, A7). `A0` — deux essais gratuits puis boucles payées « une tentative à la fois » — tourne en parallèle.

### Les hypothèses implicites

Aucune n'est écrite comme telle ; chacune porte une tranche.

1. **Le taux de `gpt-image-2` est une constante.** Mesuré sur un personnage, un mouvement, un style, deux jours, un catalogue qui change chaque jour (`PIEGES.md`). Le bilan le dit en limite ; le plan dimensionne dessus.
2. **Le coût qui compte est en dollars.** À trois centimes la planche, le prix réel d'une bande est le **temps de jugement** — dix planches à regarder bouger, avec un juge qui dérive d'un facteur deux. Aucune tranche ne le budgète.
3. **« Une image mal traitée n'est pas jugeable »** (raison de mettre V2.3 avant V3) — alors qu'A2 impose l'inverse : « aucun détourage entre la planche et l'œil ». Les deux ne peuvent pas être vraies pour le geste de tri (§ 3).
4. **La fenêtre commune rend utilisable ce qui est payé.** Vrai pour l'échelle qui pompe ; mais le balancement mesuré vaut 6 px sur 353, **un pixel à 64**. A2 empêche un défaut, elle ne restitue pas un mouvement.
5. **Le pantin tourne « sur les deux bibliothèques de calcul déjà installées »** (bilan § 4, ARCHITECTURE). Vérifié dans `pyproject.toml` : le socle déclare `numpy` et `pillow` ; `scipy` et `scikit-image` n'arrivent que par l'extra optionnel `detourage` — ce que le relevé dit lui-même. L'ARAP d'Animated Drawings est `numpy + scipy.sparse`, son maillage passe par `find_contours` et Delaunay. Le bilan contredit sa source.
6. **« Le squelette se pose tout seul »** (US-402). Le relevé dit que les modèles vivent dans la détection, pas dans l'animation, et que la chaîne légère suppose que « l'atelier fournit lui-même la silhouette **et la position des articulations** ». Il sait produire la première, pas les secondes. Aucun modèle de pose n'est nommé.
7. **Un membre plié survit à la réduction** et **une marche de profil ne découvre pas de zone cachée** : les deux essais gratuits d'A0, non faits, dont dépend la moitié d'A8.
8. **« Format existant » désigne une seule chose.** Pour la planche, oui (Aseprite JSON). Pour le squelette, le relevé vise le YAML d'Animated Drawings (format interne d'un outil archivé), `v3-animation.md` cite Spine JSON, et A8 promet « un format pour un jeu qui anime lui-même » — qui exige un format lu par un moteur. Trois objets sous un mot.
9. **Un mouvement en angles se rejoue sur tout personnage.** Vrai pour les angles ; faux pour les contacts au sol dès que les proportions changent (chibi contre sept têtes — l'étude mannequin l'avait noté). Sans IK, une marche transférée glisse.
10. **La quatrième voie d'A0 (image de posture en édition) diffère du guide de marche mesuré mort.** Plausible, pas mesuré ; le catalogue n'a pas été relu pour savoir quels modèles acceptent une image d'édition.

---

## 2 · Le relevé d'outillage face à la recherche

### 2.1 Outil par outil

La « référence libre archivée depuis septembre 2025, MIT, seize articulations à trois champs, épingles sans poids, calcul qui déborde au-delà d'un millier de points, affichage GPU » est bien **`facebookresearch/AnimatedDrawings`** (relevé, axe 3 : archivé le 3 septembre 2025, `arap.py` 329 lignes, YAML `loc/name/parent`, déterminant d'une matrice 3 200×3 200 en float32, rendu OpenGL). Les seize articulations sont celles de son `char_cfg` ; la recherche compte « 17 keypoints → 15 os » — même squelette, vu par les segments.

| Outil | Examiné et conclu **[docs]** | Ce que dit la recherche **[recherche]** | Divergence / **[avis]** |
|---|---|---|---|
| **pixel-art-fixer** (MIT) | Meilleur détecteur de grille ; reconstruction en deux temps (4,56 vs 5,51) ; plus petit pic qualifié ; **piège** : balayage limité à 24–26 px, blocs mesurés ici ~80 px | Même verdict ; ajoute **perfectPixel** (MIT, 1,7 k★) : grille **non uniforme** raffinée sur les arêtes Sobel ; **unfake.py** (MIT, Rust) | Concordant. Le piège des 80 px est une trouvaille de l'auteur. **perfectPixel manque** : sa grille irrégulière répond à « la grille dérive d'un bord à l'autre » — à mesurer en D2 |
| **spritefusion-pixel-snapper**, **PixelRefiner** (MIT) | Quantifier avant de profiler ; palette imposée en **OKLab**, après la réduction | Même recommandation ; dithering ordonné seulement dans les gradients, jamais sur les contours | Concordant. Règle à porter dans A5 : **pas de dithering** sur une bande |
| **pixa-pics**, **pixeldetector**, **proper-pixel-art** | Écartés après lecture du code (filtres commentés, k-moyennes sans réassignation, alpha détruit) | pixeldetector « fragile, dormant » ; les deux autres absents | La vérification ligne à ligne de l'auteur vaut mieux que la fiche |
| **sprite-gen** (Apache-2.0) | Contrat de fond de clé, phrase négative « chroma-adjacent » ; clé triviale ici (24 couleurs) ; despill CbCr | « Le plus proche du besoin » ; **bande horizontale par état** (4–8 cases), découpe 1D ; chroma en HSV | Concordant. **Une mise en page jamais tirée** : la bande 1×8 (gpt-image-2 accepte 3:1). Disposition, pas reformulation ; à ne tenter qu'à 8 tirages (~25 ¢) et sans rien en attendre : le banc a montré que le modèle **n'obéit pas à l'arrangement** du gabarit (4×2 rendu pour 3×3) — ce qui affaiblit aussi la confiance de la fiche 05 dans « une grille qu'il voit » |
| **`background=transparent`** | Absent sur `gpt-image-2` chez OpenRouter ; branche refermée | « En preview selon OpenAI, refus rapportés » | Le relevé est plus précis pour son canal |
| **AnimatedDrawings** (MIT, archivé) | ARAP sans poids (épingles + rigidité), Delaunay, 16 articulations YAML, rétargeting BVH→2D ; recopier, simplifier le maillage, pas d'OpenGL ; **« déformer en grand, pixeliser à la fin — trois preuves »** | Même point de départ. Mais **deux rigs par personnage — « paper-doll » (pièces rigides + pivots) pour < 64 px, maillage pour le HD** ; chaque pièce rendue **une fois par angle quantifié** (cache RotSprite), positions entières ; Pillow ne rasterise pas de triangles texturés | **Divergence de fond**, § 2.2. Sur le rendu : `Image.transform(MESH)` de Pillow fait un affine par morceau — ce sont sans doute les « ~50 lignes » du relevé. Sur les « trois preuves » : seule la deuxième (positions continues → ne pas quantifier tôt) est un argument ; « AD redimensionne à 1 000 px » décrit un outil fait pour la vidéo HD ; « Meta a réentraîné un estimateur de pose » ne parle pas de déformation |
| **cv2.inpaint**, **MI-GAN**, **LaMa**, conventions de masque | Détour ×8 puis redescente gagne (0,78–0,80 vs 0,72) ; `opencv` **pas installé** ; nommer la convention dans la signature | LaMa (Apache, CPU, secondes) en premier ; **inpainter en HD, dilater le masque de 2–4 px** | Concordant. LaMa CPU est le rebouchage compatible « pas de GPU » si A0 en montre le besoin |
| **See-through** | Cité **une fois**, pour la convention de masque de son LaMa | Voir § 2.2 | Dépôt ouvert, jamais évalué comme décomposeur — cohérent avec l'invariant, mais non écrit |
| **Spine / Godot** | Squelette d'un côté, mouvements de l'autre ; « Spine 4.0 JSON, que Godot et Unity savent lire » (via Stretchy Studio) | **Spine Runtimes License : chaque utilisateur doit posséder une licence Spine Editor** ; générer du Spine JSON ne contourne rien ; **DragonBones JSON** (MIT, documenté, lu par Godot via addon, Phaser, Cocos) recommandé | **Piège réel** : « Godot lit Spine » suppose le runtime sous licence. Si le pantin sort, c'est en DragonBones ou en scène Godot `Skeleton2D` |
| **CMU Mocap**, **100STYLE** (CC-BY 4.0), **PyMotion** | « Deux corpus réutilisables commercialement » ; « une marche tient en 48 nombres » | Licences confirmées ; **100STYLE n'a ni saut, ni attaque, ni mort** (CMU les a, squelette différent, qualité inégale) ; AMASS exclu ; rétargeting « twisted perspective » d'AD ; **cycles procéduraux** (sinus + IK deux os) comme socle | Le « 48 nombres » n'a pas de source (4 poses clés × 12 angles ? 8 étapes × 6 ?) : à écrire avant qu'A6 en fasse un modèle de données. **[avis]** Pour cinq mouvements sur 64 px, quatre poses clés dessinées battent un rétargeting à 60 i/s |
| **Aseprite JSON** | « Le plus lu », à écrire tel quel | Champs exacts ; Phaser le charge (`createFromAseprite`), Godot via `godot-aseprite-wizard` ; **Godot `SpriteFrames .tres` : 50–150 lignes**, syntaxe donnée ; la grille régulière se charge partout | L'auteur vise Godot : le `.tres` manque à A4 |
| **LPC** | Vérité extérieure manquante ; licences mélangées ; sous-ensemble CC0 ; liste d'actions à copier | `sheet_definitions/*.json` : chaque pièce avec **z-order par animation**, crédits par calque | **[avis]** Piège de licence surestimé pour l'usage prévu : comparer n'est pas redistribuer. Le z-order par animation, lui, manque à A8. La marche LPC fait 9 images, les bandes 8 : comparer par phases |
| **isnet-anime**, **birefnet-general-lite** | Seul modèle entraîné sur du dessin, risque assumé ; allégé à **88,6 Mo** contre 972 | anime-segmentation (SkyTNT, Apache « à vérifier ») en est la source | **Incohérence interne** : `etude-matte.md` donne le lite à **224 Mo**. Le critère D4 (« un onzième ») en dépend |
| **Stretchy Studio** (MIT) | Auto-rig par pose, pliage par maillage, sortie Spine | **Absent de la recherche** | Le relevé a raison de le garder comme référence de geste ; sa sortie Spine hérite du piège |
| **Meshy** / 3D | « Payant, non mesuré » | Équivalents libres : TripoSR (MIT, 6 Go), Make-It-Animatable (MIT), MagicArticulate (Apache, 4,6 Go), Blender headless | « Payant » tombe ; « GPU, non mesuré » reste (§ 2.2) |
| **Ludo.ai**, **GameForge**, **posemy.art** | Piste vidéo ouverte non réhabilitée ; relecture par modèle en questions vérifiables ; postures = angles | Wan-Animate/Animate-X (vidéo, hors sujet) ; « VLM juge » ; OpenPose-Studio (MIT) ; « le verrou n'est pas le modèle mais l'obtention du squelette : les détecteurs ne lisent pas un gobelin de 64 px » | Concordant. La phrase de la fiche 04 vaut pour A8 : la pose se détecte sur l'image en grand, jamais sur le sprite |

### 2.2 Ce que la recherche a trouvé et que le relevé n'a pas examiné

**See-through (SIGGRAPH 2026, Apache-2.0).** **[recherche]** Décompose une illustration en jusqu'à 23 couches ordonnées avec inpainting des zones cachées ; SDXL, ~7 Go de poids, **~8 Go en NF4**, 1 280 px, anime. **[docs]** Le post-traitement « ne touche jamais le GPU » (ARCHITECTURE § 4) ; le PRD écarte « un moteur qui mobiliserait la carte graphique ». **[avis]** See-through est la réponse complète à la question que l'essai gratuit d'A0 est conçu pour rendre sans objet. Il ne doit pas entrer dans le plan : invariant, poids, style, et l'image « à l'allure pixel art » du produit n'est pas une illustration anime. Si A0 montre que les occlusions cassent le pantin d'un seul tenant, le repli cohérent avec le dépôt est la **voie légère de la fiche 06** — SAM 2 tiny (Apache, CPU) **amorcé par les os** (points positifs le long de chaque os, négatifs sur les voisins), puis LaMa CPU — ou l'idée déjà notée par l'auteur : **demander une planche de pièces à plat**. See-through reste un outil hors atelier, une fois par personnage, si l'auteur a le GPU.

**rtmlib (Apache-2.0, CPU, ONNX).** **[recherche]** 17/26/133 points, `onnxruntime` — que l'extra `detourage` installe déjà ; photos, « souvent suffisant pour un personnage debout ». **[avis]** Seul candidat qui rende US-402 compatible avec « pas de GPU, catalogue, grisé avec sa raison ». Le plan doit le nommer et **abaisser le critère à « proposé, à corriger »** : seize épingles à corriger sur une image de 1 024 px est un geste d'une minute ; un gabarit de squelette aux proportions de la boîte est le repli à zéro modèle.

**RotSprite et le paper-doll contre « déformer en grand puis pixeliser ».** **[recherche]** RotSprite (Pixelorama MIT, ~120 lignes NumPy) tourne un sprite *déjà en pixel art* proprement (×8 par Scale2x, rotation NN, sous-échantillonnage). Sous 64 px : pièces rigides à pivot, angles quantifiés (5–15°), pièce rendue une fois par angle, translations entières — « zéro scintillement » ; le maillage est réservé au HD. **[docs]** Le plan retient l'inverse : ARAP d'une silhouette entière à 1 024 px, puis remise sur grille par la chaîne existante. **[avis]** Trois objections. (a) D2 **détecte** un pas dans une image à grille axée ; une image dont un bras a tourné de 30° a deux structures de blocs en conflit — il faut *réduire d'un facteur connu* (grille cible et fenêtre d'A2 sont connues), pas détecter. (b) Un maillage d'un tenant plie le coude comme du caoutchouc ; à 64 px c'est une bavure d'un ou deux pixels là où le pixel art attend une articulation nette. (c) Le paper-doll ne demande ni scipy ni maillage : Pillow suffit. L'essai n°1 d'A0 est le bon, à condition de **comparer les deux branches** — et c'est gratuit.

**Verrou de palette et contour stable (A5).** **[recherche]** Palette calculée **une fois** sur l'union des images (ou imposée depuis le sprite source), **aucun dithering** (la fiche 07 dit que l'ordonné scintille, la fiche 06 qu'il est stable : sur une bande, la seule règle sûre est « aucun »), filtre médian temporel sur les indices, pixel snapping. **[docs]** A5 dit la même chose pour la palette et propose la bonne mesure. **[avis]** Ce qui manque est la cause : si la **phase de la grille est calée sur la fenêtre d'A2** et non sur la boîte de chaque étape, le tirage « un pixel par bloc » devient cohérent. Le reste du grésillement d'une planche IA vient du modèle (le contour est *dessiné* autrement) et aucune réduction ne le corrige ; sur le pantin, le cache par angle le supprime par construction. A5 vaut surtout pour le pantin.

**Cycles, 100STYLE, CMU (A6).** Voir tableau. **[avis]** A6 tel qu'écrit est une tranche de gabarit de texte, pas de cinématique — sain, à condition de réserver dès A6 la place des angles par étape. Socle procédural ou dessiné (contact / appui / passage / envol) d'abord ; corpus mocap seulement si un essai montre qu'un cycle rétargeté se lit mieux sur 64 px. Licences dans la fiche du mouvement (CC-BY = crédit dans le jeu).

**DragonBones / Spine (A4, A8).** À trancher avant A8 : DragonBones JSON étendu (`userData` : pas de pixel, palette, ordre d'empilement) si le pantin sort — ou **différer sa sortie** : la décision 4 fait des images la sortie principale, et un projet personnel n'a besoin du squelette que le jour où il anime dans le moteur.

**Best-of-K avec juge (A3).** **[recherche]** Score composite DINOv2 (même sujet) + LPIPS (saut entre voisines) + flux optique + bouclabilité, seuils appris sur 50 générations annotées. **[avis]** Autre famille que la « forme », mais toujours un **substitut** : aucun ne mesure « c'est un cycle de marche », la question que l'œil tranche. Ce que la recherche ajoute d'utile est méthodologique : **le jeu d'épreuve est payé** (135 notes). Passer DINO/LPIPS dessus coûte zéro appel ; refaire le tableau « bonnes parmi retenues / rejetées » dit en une journée si un préfiltre vaut quelque chose. Règle de l'étude GameForge : un préfiltre n'a le droit que d'écarter des mauvaises, jamais de jeter une bonne ; l'écran d'A3 montre des images.

**LoRA de planche (écarté).** **[recherche]** Le plus efficace en pixel art petit format est un LoRA de mise en page sur modèle local (Klein 4B Apache ; Qwen-Image-Edit 20B, hors 8 Go) — « vraisemblablement ce que SpriteCook, Retro Diffusion et PixelLab ont fait ». **[avis]** Le plan a raison (14 bonnes planches de dataset, modèles locaux refusés) mais devrait **écrire pourquoi la loterie est structurelle** : un modèle généraliste n'a pas appris la disposition d'une planche d'animation ; seul un modèle spécialisé relève le taux, et il n'est pas à portée locale. Ça ferme la porte proprement.

**Pipeline 3D → rig → Blender → pixelisation.** **[recherche]** Rentable pour « top-down/iso 4–8 directions et beaucoup d'animations (5 × 8 = 40 clips) ; peu rentable pour un side-scroller à 1–2 vues » ; image→3D médiocre depuis un sprite ; look « 3D pixelisé » ; GPU ≥ 6 Go. **[avis]** Le plan sous-estime le cas où il mord : un jeu vu de dessus à 8 directions et 5 mouvements, c'est 40 bandes, ~400 planches à *regarder* — dérisoire en dollars, écrasant en jugements ; le pantin n'y change rien (décision 6), le miroir est/ouest divise par deux. À écrire dans le plan ; la 3D reste la question de la V3.5 *si* le prochain jeu n'est pas de profil. Rien à construire maintenant.

**Deux prises de la fiche 05 pour A2/A7.** Le **retry partiel par masque** (GPT-Image `edits` + masque alpha : « redraw cell 5, same style ») est le mécanisme naturel d'US-398 ; sans lui, une étape générée seule perd le contexte de ses voisines. À vérifier gratuitement sur le canal. Et l'**alignement « bbox union à position absolue conservée »** (« si la grille a été respectée, le modèle a déjà animé en place ») est ce que `decoupe_brute.py` fait « par rangée » : A2 doit dire que la fenêtre se calcule **dans les coordonnées de la planche, par rangée**, sinon elle réintroduit ce qu'elle corrige.

---

## 3 · Le plan V3, tranche par tranche

**R6, R7 — rien à redire.** R6 est mesurée et rembourse la V2. R7 est honnête sur ce qu'elle ne promet pas ; « nommer chaque image jointe » est la partie qui peut rapporter (la fiche 05 le confirme). Les prendre avec D3, avant tout nouveau banc, comme le plan le dit.

**V2.3 avant V3 — ordre discutable, et c'est le plan qui le dit.** « Une planche mal ramenée sur sa grille n'est pas jugeable » est contredit par A2 (« aucun détourage entre la planche et l'œil ») et par la façon dont les 135 planches ont été jugées. Le geste principal — A1, A2, A3 — se juge **avant** tout traitement ; D2 et D4 servent à *livrer* (A4, A5). **[avis]** A1 → A2 → A3 peuvent démarrer dès R6, D1 en parallèle ; D2/D4 bloquent A4/A5 seulement. « La V3 ne s'ouvre pas avant que la V2 serve » est une règle de méthode à garder, pas une dépendance technique.

**D2 — le risque le plus technique, sous-décrit.** Manquent : la grille non uniforme (perfectPixel) ; la sortie **avec confiance et candidats** (fiche 02), qui rend US-417/418 naturels ; le cas de l'image déformée par le pantin, où il ne faut pas détecter (§ 2.2).

**D4 — deux relevés avant d'écrire** : 88,6 ou 224 Mo pour le lite ; les deux pièges d'intégration de rembg, que le plan exige à raison.

**A0 — bonne méthode, mauvais moment, incomplète.** « Une tentative à la fois, échecs prévus écrits d'avance » est ce que le dépôt a de meilleur. Mais ses deux essais gratuits décident si scipy entre au socle, si la découpe en pièces existe, et la forme du modèle d'A6 : à faire **cette semaine**, avant D1. L'essai n°1 doit avoir deux branches (§ 2.2). La première étape du quatrième chemin (« quels modèles acceptent une image d'entrée en édition ») est gratuite et pas faite.

**A1 — juste, courte.** Angle mort mineur : une planche à 9 sujets (R6) et un dépliage refait produisent des étapes surnuméraires ; A2 doit accepter une bande de 8 sur une planche qui en a 9.

**A2 — la réparation la plus rentable du plan ; promesse surjouée.** Le balancement récupérable vaut un pixel ; ce qu'A2 apporte est « le personnage ne change plus de taille et ne saute plus », et c'est assez. À préciser : fenêtre en coordonnées de planche par rangée ; taches nettoyées avant la boîte ; ancrage neuf points appliqué à la bande, jamais à l'étape.

**A3 — la maquette existe ; deux coûts non écrits.** Le temps de jugement, et la dérive du juge : un témoin (planche déjà gardée) à côté des neuves devrait être un critère. Un préfiltre sur faits vérifiables — compte, remplissage, quadrillage, écart de taille — est gratuit et déjà mesuré par la machine (« découpable ») ; il dégrise, ne classe pas.

**A4 — courte ; il lui manque Godot.** Ajouter `SpriteFrames .tres` et la bande régulière ; vérifier en ouvrant dans Godot headless.

**A5 — tranche d'A8 déguisée.** Sur une planche IA, A5 corrige la part due à la réduction (phase, palette, dithering) et c'est tout ; sur le pantin elle est structurelle. Garder la mesure, abaisser l'ambition.

**A6 — deux tranches sous un nom.** Le gabarit de texte (petit, utile dès A2) ; la bibliothèque en angles (n'a de sens qu'avec A8). Séparer ; réserver le champ « angles par étape » dès la première.

**A7 — sous-estimée sur un point.** Pelure d'oignon, déplacement, ancrage : mécanique connue. « Remplacer une seule étape par un nouveau tirage » est **un nouveau chemin de génération** (édition masquée, ou case avec voisines en référence), non vérifié sur le canal.

**A8 — « nettement plus petite », toujours la plus grosse, et trois manques.** (1) La pose automatique (rtmlib) ou l'abandon du mot « tout seul ». (2) **L'ordre d'empilement par étape** : dans une marche de profil, le bras arrière passe derrière puis devant le torse ; sans ordre keyframable (OpenToonz Plastic, z-order LPC), un pantin lit faux — « l'ordre des pièces se corrige » ne le couvre pas. (3) **Les proportions** : sans IK deux os (≈ 80 lignes), un mouvement transféré fait glisser les pieds ; l'étude mannequin l'avait vu, le plan l'a perdu. « Reprendre le code ou ses trois gestes » se tranche dans A0, pas « à l'ouverture », puisque la réponse décide des dépendances. Ordre de grandeur : la fiche 06 compte 4–6 mois-personne pour un produit complet avec éditeur ; la version cadrée ici (épingles, pas de poids, mouvements procéduraux, rendu Pillow) est de plusieurs semaines pleines, pas « la moitié d'une tranche ».

**Ce que le plan écarte à raison** : la vidéo, les modèles locaux, See-through dans le produit, la 3D pour l'instant, une note calculée qui déciderait, toute réécriture de fond du prompt.

---

## 4 · V4 (tuiles) et V5 (son) : ce que la recherche change aux esquisses

### V4 — tuiles (archi-versions § 9)

**[docs]** « Lourd mais déterministe : aucune inconnue » ; 15-pièce 4×4, 17-pièce, autotile-16 ; recalage, découpe, atlas ; PNG + JSON de mappage ; générer plus grand puis recaler. **[recherche, fiche 08]** Le pivot change : **dual-grid 15/16 pour générer, blob 47 pour exporter** ; « un tileset 47 n'est jamais dessiné, il est assemblé » par quadrants (16 dual-grid ⇒ 47 sans génération ; 6 tuiles avec symétries) ; le **Tileset Base Generator de SpriteCook est MIT** (gabarit 15/17 et iso, à porter en NumPy — masque de terrain, contour et grille de recalage d'un coup) ; `autotile_generator` (MIT, Pillow) est le point de départ ; **score de couture** en dix lignes (`seam_ratio` > 1,5 = visible) ; exports à syntaxe exacte (Godot `TileSetAtlasSource` + peering bits, Tiled `wangset`, règles LDtk) — « PNG + JSON de mappage » ne suffit à aucun moteur. **[avis]** Deux choses de l'esquisse ne tiennent pas. « Aucune inconnue » : le banc d'animation a montré que le modèle **ne reproduit pas l'arrangement** du gabarit — or une planche de tuiles est codée par position ; même loterie, et pire, parce qu'on ne trie pas par blob. La réponse de la fiche (« intérieur seamless d'abord, bords ensuite » par inpaint masqué, ou peu de primitives par appel) suppose une édition masquée que le canal n'expose peut-être pas. Et le **padding circulaire** — la manière universelle d'obtenir une texture sans couture — est un patch de convolution sur un modèle local, inapplicable via API ; il reste l'offset d'une demi-tuile + rebouchage (LaMa CPU ou quilting) et le score pour décider. La V4 hérite d'A1/A3 (commander, regarder, garder) plus qu'elle ne s'en distingue.

### V5 — son (archi-versions § 10)

**[docs]** Bruitages « description → son court » avec Stable Audio Open (module MySpriteAi) ; boucles = « bouclage sans couture, du traitement du signal » ; fondus, silences, normalisation. **[recherche, fiche 09]** Stable Audio Open est sous **licence communautaire Stability** (gratuit sous 1 M$, sorties possédées, révocable) — acceptable pour un projet personnel, à écrire ; **Small** (341 M) tourne **sur CPU** en secondes ; **pour du pixel art, sfxr est la voie par défaut** : jsfxr (Unlicense), 24 paramètres bornés, « LLM → JSON sfxr, ×12 candidats, rendu en millisecondes, tri CLAP » ; aucun port Python maintenu (≈ 400 lignes, ou `node`/rfxgen en sous-processus) ; musique : **ACE-Step 1.5 (MIT, sorties commerciales explicites)** avec BPM/tonalité/durée imposés ⇒ **boucle parfaite par construction** ; MIDI + FluidSynth pour le chiptune ; « recettes plutôt que fichiers » ; registre de provenance. **[avis]** L'esquisse a la bonne forme et le mauvais défaut : pour des bruits rétro, sfxr est instantané, CPU, sans licence, et se prête exactement au geste de la V3 (« en commander douze, garder le bon ») à coût nul ; l'IA n'est que la voie « réaliste ». Le « vrai travail de bouclage » devient presque vide si l'on génère des mesures entières à BPM fixe ; il reste un loop-maker de cinquante lignes. La recette non destructive du produit s'applique telle quelle : on garde les paramètres, pas le WAV.

---

## 5 · Ce que je changerais, et ce qu'il ne faut pas toucher

### Les dix changements, par impact décroissant

| # | Changement | Pourquoi | Effort |
|---|---|---|---|
| 1 | **Faire les essais gratuits d'A0 maintenant, avec une troisième branche** : bras pivoté en grand puis réduit *contre* bras extrait du sprite 64 px et tourné par RotSprite ; puis épingles à la main sur une silhouette, pousser jusqu'à la casse | Décide la forme d'A8 (maillage ou paper-doll), l'entrée de scipy, l'existence de la découpe en pièces, le modèle d'A6. Coût zéro | 1–2 jours |
| 2 | **Découpler le tri (A1→A2→A3) de la V2.3** : A1 dès R6, D1 en parallèle ; D2/D4 bloquantes pour A4/A5 seulement | Le plan se contredit ; les 135 planches ont été jugées brutes. Le geste principal arrive des semaines plus tôt | 0 |
| 3 | **Rétablir la vérité sur les dépendances du pantin** : `scipy` (et un remplaçant de `find_contours`) dans `pyproject.toml` avec test d'installation sans extra — ou A8 contraint à numpy + Pillow (ce que le paper-doll permet) | Le bilan dit « déjà installées », le relevé prouve le contraire, ARCHITECTURE recopie le bilan | Heures |
| 4 | **Nommer le modèle de pose et abaisser US-402** à « proposé, l'auteur corrige » : rtmlib/RTMPose en ONNX au catalogue, poids et grisage ; repli : gabarit de seize épingles aux proportions de la boîte | « Tout seul » n'a aucun mécanisme ; la pose se détecte sur l'image en grand, jamais sur le sprite | 2–3 jours |
| 5 | **Relever gratuitement si le canal expose l'édition masquée** (`edits` + masque sur `gpt-image-2`) et quels modèles acceptent une image d'entrée en édition | US-398 et la stratégie « intérieur figé, bords rebouchés » de la V4 en dépendent ; même relevé que celui du 2 septembre sur `background` | 1 heure |
| 6 | **A4 : écrire aussi `SpriteFrames .tres` et la bande régulière**, valider dans Godot headless | L'auteur vise Godot ; 50–150 lignes | 1–2 jours |
| 7 | **Trancher le format du pantin avant A8** : DragonBones JSON si le pantin sort ; sinon **différer sa sortie** et ne livrer que les images | Spine JSON est un piège de licence ; le YAML d'AD n'est lu par aucun moteur | 0 si différé ; ~1 semaine sinon |
| 8 | **Réemployer les 135 notes pour calibrer un préfiltre** : faits vérifiables d'abord (compte, remplissage, quadrillage, écart de taille), puis DINO/LPIPS sur CPU et, en option, les questions vérifiables de l'étude GameForge à un VLM ; refaire le tableau « bonnes parmi retenues / rejetées » ; **ne jamais écarter une bonne** | Le vrai coût d'A3 est le temps de jugement ; le jeu d'épreuve est payé ; un préfiltre qui dégrise respecte « l'écran montre des images » | 1 jour CPU, quelques centimes |
| 9 | **Compléter le modèle d'A8** : ordre d'empilement par étape, IK deux os pour les contacts, miroir est/ouest avec réordre ; reprendre l'idée `sheet_definitions` de LPC | Trois angles morts qui font lire faux une marche de pantin | Doc : heures ; code : jours dans A8 |
| 10 | **Préciser A2 et A5 en une page** : fenêtre en coordonnées de planche, par rangée ; phase de grille calée sur la fenêtre ; palette prise du sprite source ; aucun dithering ; sur les étapes déformées par le pantin, réduire d'un facteur connu au lieu de détecter | Conditions pour que « le contour ne bout pas » soit vrai ; telles qu'écrites, les tranches peuvent les violer sans le savoir | Heures |

Et une ligne à ajouter au plan, sans rien construire : **le coût en jugements d'un jeu à 8 directions** (40 bandes × ~10 planches) — le cas où le pantin ne sert pas et où seule la 3D change l'ordre de grandeur ; à trancher le jour où le prochain jeu n'est pas de profil.

### Les cinq choses à ne surtout pas changer

1. **« Commander plusieurs planches, les regarder bouger côte à côte, garder la bonne » — l'œil comme juge, l'écran qui montre des images.** Conséquence directe de la seule mesure solide du dossier ; l'échec de la mesure « forme » prouve qu'un chiffre ne doit pas décider. Un préfiltre dégrise, ne classe pas.
2. **Le texte qui part.** Paragraphe protecteur, énumération des instants, clause de constance : mesurés, six dollars disent qu'aucune reformulation ne fait mieux. R7 range, ne réécrit pas. Ne pas rouvrir, même sous un autre nom (la fiche 05 en propose plusieurs qui sont des reformulations).
3. **La méthode** : une tentative à la fois, échecs prévus écrits avant l'envoi, conclusion par « quel échec s'est produit » ; huit tirages pour arbitrer ; un témoin dans chaque séance ; jamais de comparaison entre deux séances.
4. **Les invariants** : CPU sans GPU ni réseau pour le traitement ; recettes non destructives ; rien n'est relancé automatiquement ; le catalogue décide ; aucun format inventé. Ils ferment proprement la porte à See-through, aux modèles vidéo, aux LoRA locaux et à la 3D *dans le produit* — c'est ce qui empêche ces pistes de revenir tous les six mois.
5. **Les décisions 1, 2 et 6** : la planche est un objet ; une bande se recadre d'un seul tenant ; le pantin ne sert qu'une vue et ne redessine rien. Fondées sur des mesures ou sur une limite physique ; aucune fiche ne donne de raison d'y toucher.
