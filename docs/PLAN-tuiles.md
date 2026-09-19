# Les jeux de tuiles — plan

> Demandé par l'auteur le 19 septembre 2026, sur la branche `feat/tuiles` : fabriquer des jeux
> de tuiles qui se raccordent (sols, chemins, murs) et les livrer à Godot, en reprenant ce que
> **sc-clone (SpriteForge)** a construit et que l'auteur a validé : 45 tranches, `T1` à `T45`,
> 356 essais.
>
> Quel modèle sur quelle tranche : [PLAN-tuiles-affectation.md](PLAN-tuiles-affectation.md).
> La maquette : `docs/maquettes-atelier-unifie/04-tuiles.html` (servie par la config
> « maquettes-son », port 8934).
>
> **Où en est le chantier (19 septembre 2026).** Le plan et la maquette sont écrits. Aucune
> tranche de code n'est commencée. La maquette embarque déjà une copie du moteur
> (`tuiles-moteur/`, commit `f27f054` de sc-clone) : il tourne tel quel dans un navigateur, et
> rend une planche en 15 à 50 ms.

## Ce qui existe déjà

**Dans gag2 (AU13).** On peut créer un jeu de tuiles **à partir d'une image déjà faite** :
- découper une grille ;
- retenir des cases ;
- déclarer à la main les terrains et les huit raccords de chaque case, avec neuf listes
  déroulantes par tuile ;
- peindre une carte d'essai ;
- corriger une case par la retouche ordinaire ;
- livrer à Godot 4.3+ un `TileSet` natif, avec une carte `carte.tscn`. Un vrai Godot charge ce
  paquet dans les essais.

Sept outils MCP donnent à l'agent les mêmes gestes, et tous sont gratuits. Ce qui manque, c'est
**tout l'amont** :
- fabriquer des tuiles qui se raccordent vraiment ;
- remplir les raccords sans les saisir à la main ;
- vérifier les bords au pixel près.

Le seul critère ouvert d'AU13 porte sur cet amont : *produire, juger les raccords, corriger et
exporter un ensemble avec l'agent*. Aucun écran de tuiles n'est dans la maquette validée le
12 septembre.

**Dans sc-clone.** L'amont est fait, et il repose sur un choix qui change tout : **l'IA ne
dessine jamais les tuiles.** Elle fabrique deux ou trois **matières** (des textures qui se
répètent sans couture : de l'herbe, de la pierre…). Le code découpe ensuite chaque pièce du
jeu dans ces matières, à travers des masques. Le raccord est donc garanti par construction :
768 paires vérifiées, zéro faute.

Le cœur est du JavaScript pur, environ 7 500 lignes :

| Module | Rôle |
|---|---|
| moteur | Rend l'atlas complet. |
| masques | Les jeux de pièces 47, 16 et 15, et leurs tables Godot et Tiled. |
| matières intégrées | 13 matières dessinées par le code. |
| scène | Peindre une carte ; le mur empilé ; le tri en profondeur. |
| contrôle | Vérifie les bords de chaque pièce. |
| palette | Les mêmes couleurs pour toutes les matières. |
| exports | `.tres` Godot, `.tsx` Tiled, JSON. |

Ce cœur tourne tel quel dans un navigateur. Deux morceaux sont liés à SpriteForge : la
génération des matières, qui passe par ComfyUI en local avec le style `klein9b-tiles` et les
deux nœuds de raccord, et l'écran.

**gag2 a déjà la moitié du chemin de génération.** Il a les styles locaux `klein9b-tiles` et
`klein9b-tiles-raccordable`, et le branchement des nœuds `SeamlessTile` et `CircularVAEDecode`
(tranche ML6).

## Décisions d'architecture

1. **Le moteur de sc-clone est recopié, pas réécrit.** Ses modules entrent dans l'interface tels
   quels : même logique, seuls les chemins d'import changent. Ils gardent leur provenance (le
   commit de sc-clone) et leurs deux licences : MIT pour la base SpriteCook, Apache-2.0 pour
   PixelOE. Ses essais sont recopiés avec lui. Réécrire 7 500 lignes validées reviendrait à
   rejouer 45 tranches.

2. **Un jeu de tuiles est une recette, et l'atlas en est le résultat.** Le serveur garde la
   recette :
   - la sorte ;
   - la taille ;
   - la graine ;
   - les matières, par emplacement ;
   - les réglages.

   Il garde aussi l'atlas rendu, figé en asset. Refaire l'atlas à partir de la recette donne le
   même PNG au pixel près : les empreintes de sc-clone le prouvent déjà.

3. **Le navigateur rend, le serveur garde et livre.** Jusqu'à TU10, l'écran rend l'atlas et
   l'envoie avec sa recette. En TU10, pour que l'agent fabrique sans écran, le serveur rend à
   son tour avec **le même fichier moteur**, lancé par Node, comme le fait déjà
   `scripts/apercu-tileset.mjs` de sc-clone. Il vérifie aussi que son rendu est identique à
   celui du navigateur.

4. **Les raccords ne se saisissent plus : ils se déduisent.** Chaque pièce d'un atlas fabriqué
   connaît son masque, donc ses bits de voisinage Godot. L'éditeur à neuf listes reste
   disponible pour les jeux faits **à partir d'une image déjà faite** : c'est le chemin actuel,
   il n'est pas supprimé.

5. **Trois sortes, trois modes Godot.**

   | Sorte | Pièces | Mode de terrain Godot |
   |---|---|---|
   | Sol | blob 47 | Match Corners and Sides |
   | Chemin | 16 | Match Sides |
   | Mur | dessus en blob 47, plus des bandes posées en tuiles simples | voir la ligne Sol pour le dessus |

   Le format 15 pièces (coins, compatible SpriteCook et RPG Maker) et le 17 pièces sont
   repliés sous « Autres formats ». L'isométrique et la vue de plateforme ne sont **pas repris**
   : ni l'un ni l'autre n'a été validé dans sc-clone.

6. **Tout est gratuit en argent.** Les matières se génèrent en local, par ComfyUI. L'écran
   annonce une attente et non un prix. Le bouton de génération n'est donc jamais rouille.
   Aucune tranche de ce plan n'appelle un fournisseur payant.

7. **Une matière est un asset de la bibliothèque**, de nature « matière » dans la famille
   `decors`. Elle se retrouve, se réutilise d'un jeu de tuiles à l'autre, et garde sa
   provenance : le texte envoyé, le style et la graine.

8. **Les tuiles deviennent un lieu de la navigation**, et non plus un dialogue. On y entre par
   le bouton « Les tuiles » de la navigation des familles, comme aujourd'hui. Le fil d'Ariane
   s'écrit « Les tuiles › Herbe et terre ».

9. **Vocabulaire à l'écran.** On écrit « jeu de tuiles » et « pièce », jamais « tuile » seul :
   dans le produit, une *tuile* est déjà la case de la grille d'assets.

## Les tranches

### TUM · La maquette des tuiles

**Bloquée par** : rien.

Une maquette interactive, `docs/maquettes-atelier-unifie/04-tuiles.html`, qui **rend de vraies
tuiles avec le vrai moteur**. Seule la génération par l'IA y est simulée. Elle montre cinq
écrans :
- la liste des jeux de tuiles du jeu ;
- le choix de la sorte ;
- l'atelier : les matières à gauche, la carte peinte au centre, quatre réglages à droite ;
- le tiroir de choix d'une matière : intégrées, les miennes, générer ;
- la relecture avant de livrer à Godot.

- [x] L'auteur l'a parcourue et validée. Les écrans des tranches suivantes la suivent.
      *(Validée le 19 septembre 2026 : « ça a l'air super ».)*

### TU1 · Le moteur entre dans l'interface

**Bloquée par** : rien. Peut partir en même temps que TUM.

Les modules purs de sc-clone sont recopiés dans `interface/src/tuiles/moteur/`, avec leurs
licences et un `LISEZMOI` de provenance. Leurs essais sont recopiés et passent sous vitest.
Aucun écran.

- [x] Les modules sont identiques à ceux de sc-clone, aux chemins d'import près. Un essai
      compare leur empreinte au commit relevé.
- [x] Les essais recopiés passent :
  - 47 masques exactement ;
  - aller-retour masque → bits Godot → masque ;
  - coutures sans faute sur toutes les paires ;
  - empreintes d'atlas par sorte ;
  - mur de 88 cases ;
  - palette commune de 24 couleurs au plus.
- [x] `npm run build` et `tsc` passent. Les modules en JavaScript sont déclarés pour
      TypeScript, sans `any` qui fuie dans le reste de l'interface.
- [x] La garde de design (`tests/test_b0.py`) ne lit pas le moteur recopié. Ses tailles
      internes ne sont pas des valeurs d'écran.

### TU2 · Un jeu de tuiles est une recette

**Bloquée par** : rien. C'est la partie données. TU3 en hérite.

Le domaine `tuiles` gagne une **recette** facultative :
- la sorte : `sol`, `chemin`, `mur`, `coins-15` ou `pieces-17` ;
- la taille de pièce ;
- la graine ;
- les emplacements et leur source : intégrée (avec son nom), ou asset (avec son id) ;
- les réglages du moteur, sur une liste fermée recopiée de sc-clone.

Un jeu sans recette reste un jeu « à partir d'une image », exactement comme aujourd'hui.

- [x] Un jeu avec recette se crée, se relit, se règle et se restaure par révision, comme un jeu
      d'AU13. Les ensembles déjà sur disque se relisent sans migration.
- [x] Une recette refusée (sorte inconnue, taille hors de 16/32/64, réglage hors liste,
      matière introuvable) répond 409 avec un message en clair.
- [x] L'atlas envoyé avec la recette est figé en asset, avec sa filiation vers le jeu. Ses
      cellules sont toutes retenues. Leurs raccords sont **remplis depuis le masque de chaque
      pièce**, jamais depuis la saisie.
- [x] La nature « matière » existe dans la famille `decors`, sans détourage ni poses.

### TU3 · L'atelier du jeu de tuiles

**Bloquée par** : TU1, TU2, TUM validée.

L'écran de la maquette, sur des matières intégrées. On y trouve :
- le lieu « Les tuiles » ;
- « Nouveau jeu de tuiles » et le choix de la sorte ;
- la carte que l'on peint au clic, avec « Île au hasard » ;
- la planche ;
- les matières par emplacement, avec une bordure qui suit la surface tant qu'on ne la délie
  pas ;
- quatre réglages, le reste dans « Réglages fins » ;
- « Enregistrer ».

- [x] Le dialogue « Les tuiles du jeu » devient un lieu de la pile. Il est ajouté aux anciens
      états interdits de `test_b0.py`, et le fil d'Ariane le nomme.
- [x] Changer une matière ou un réglage redessine la carte en moins d'une demi-seconde à 32 px.
      Le rendu est mis en cache par recette.
- [x] Enregistrer puis rouvrir redonne la même carte et le même atlas, au pixel près.
- [x] Un jeu « à partir d'une image » s'ouvre toujours dans l'éditeur actuel. Rien de ce que
      fait AU13 ne se perd.
- [x] Vu au navigateur sur un atelier jetable, et comparé à la maquette.

### TU4 · Livrer à Godot les trois sortes

**Bloquée par** : TU2.

L'export Python d'AU13 apprend ce que sc-clone écrit :
- les modes de terrain Coins, Côtés, ou Coins et côtés ;
- le second terrain, sur un autre sol ;
- les variantes de la pièce pleine et leur probabilité ;
- l'animation, avec des colonnes et une séparation comptées en cases.

La carte d'exemple livrée est la carte peinte dans l'atelier.

- [x] Dans un vrai Godot 4.7, pour le sol et pour le chemin, `set_cells_terrain_connect` sur
      la carte livrée pose les mêmes pièces que l'atelier : 0 désaccord. Le script de preuve
      `preuve-map-godot` de sc-clone est porté en essai.
- [x] Un jeu sur deux sols déclare deux terrains. La case entièrement « dessous » est posable.
- [x] Les images d'animation ne se recouvrent pas : c'est la condition pour que Godot les
      accepte.
- [x] Les paquets d'AU13 déjà livrés, sans recette, sortent à l'identique : les essais
      existants ne bougent pas.

### TU5 · Les matières générées sur la machine

**Bloquée par** : TU3.

L'onglet « Générer » du tiroir des matières. On y remplit :
- « C'est fait de quoi ? », un tronc commun à toutes les matières du jeu ;
- « Le motif » ;
- un cadrage : sol vu du dessus, face de mur, matière à plat, ou motif régulier ;
- « Voir le texte envoyé » ;
- le nombre de tirages.

Le texte est composé **côté serveur**, par un portage en Python de `tile-ia-prompt.js`. Il
part vers ComfyUI avec le style `klein9b-tiles-raccordable` :
- en 256 px sans référence, en 512 avec ;
- avec le négatif fixe de sc-clone ;
- avec une graine libre pour chaque matière.

Les tirages reviennent comme des assets de nature « matière ».

- [x] Le texte affiché est exactement celui qui part. Un essai compare le portage Python aux
      sorties de `composerPrompt` sur les cas des essais de sc-clone.
      *(`tests/test_tu5_matieres.py`, déjà commité. Vérifié aussi à l'écran : « Voir le texte
      envoyé » affiche mot pour mot ce que `POST …/preview` renvoie, jamais un texte composé
      côté client.)*
- [x] Le motif demandé tient dans **une seule pièce**. Le texte nomme le compte et la taille
      (« exactly four huge square flagstones, two by two »), comme la règle D2/T26 de
      sc-clone.
      *(Le produit ne réécrit jamais le texte de l'auteur — `test_motif_qui_ne_dit_pas_le_compte_nest_pas_reecrit`
      — donc c'est à l'auteur de nommer le compte ; le champ « Le motif » en montre l'exemple par
      son repère : « de grandes dalles carrées, deux par deux ».)*
- [x] L'écran annonce une attente (environ 2 min par image, mesurée sur la machine) et jamais
      un prix. Une génération se suit et s'annule dans la file locale existante.
      *(« Gratuit, sur ta machine · environ 2 min par image » par défaut, remplacé par la
      médiane mesurée dès qu'elle existe. La progression est lue sur `GET /api/local-queue`,
      comme tout calcul local.)*
- [x] Si ComfyUI, le poids du style ou le nœud de raccord manque, le bouton est grisé et dit ce
      qui manque et où le poser. L'atelier ne modifie jamais ComfyUI.
      *(`GET …/materials/availability` lu à l'ouverture de l'onglet ; indisponible, le bouton
      « Générer » est désactivé et la ligne sous lui dit ce qui manque — rien n'est envoyé.)*
- [x] Choisir un tirage le pose dans l'emplacement, et la carte se redessine.
      *(`interface/src/composants/AtelierTuiles.tsx`, `OngletGenerer` ; vu au navigateur sur
      l'atelier jetable TU3 avec ComfyUI doublé : la carte change de matière au clic.)*

### TU6 · Les mêmes couleurs pour toutes les matières

**Bloquée par** : TU5.

La palette commune de sc-clone (T26 bis) : toutes les matières d'un jeu sont ramenées sur les
24 couleurs de la première, le sol. Elle est cochée par défaut. Deux ajouts :
- **la palette du jeu** : si l'univers a une palette, on peut la désigner à la place ;
- la réduction de texture « Contraste » (portage PixelOE), par défaut.

La réduction passe toujours **avant** la palette. C'est un invariant mesuré dans sc-clone :
54 couleurs au lieu de 6 dans l'autre ordre.

- [x] Palette commune : 24 couleurs au plus, toutes tirées de la référence, alpha intact.
      *(`interface/src/tuiles/atelier.ts`, `paletteDuRendu` : la référence est la texture de
      « surface » — la première matière, le sol —, relevée par le même relevé Lab pondéré
      que la « palette de référence désignée » de sc-clone (`paletteDeReferenceLab`,
      `moteur/tile-palette.js`), à `NOMBRE_COULEURS` = 24. Posée dans `settings.palette`, le
      moteur l'applique après la réduction, sur les cinq textures d'un coup — invariant du
      moteur, vérifié en lisant `vendor/tileset-engine.js` (`resolvePalette`/
      `appliquerPalette`, appelés dans `reduire()` juste après `resampleTexture`), pas
      retouché. `interface/src/tuiles/atelier.test.ts` § TU6 vérifie le compte et l'alpha
      intact sur un atlas réellement rendu.)*
- [x] La palette de l'univers, quand elle existe, remplace la palette commune. Quand elle
      manque, l'écran dit « indisponible — ce jeu n'a pas encore de palette », avec le lien
      vers l'univers.
      *(Nouveau réglage `paletteJeu` (`recette_tuiles.py`, `atelier.ts`) : coché et une
      palette d'univers présente (`JeuEdite.paletteUnivers`, tenue à jour par `Tuiles.tsx`
      depuis `Univers.palette`) l'emporte sur `memesCouleurs`. Écran : case « Palette du
      jeu » dans Réglages fins, `AtelierTuiles.tsx` ; grisée avec le message et le lien
      « Voir l’univers » (`onUnivers`, câblé depuis `App.tsx` jusqu'à `Tuiles.tsx`) quand
      `paletteUnivers` est vide.)*
- [x] Sans palette, le rendu est identique au bit près à celui de TU3.
      *(`memesCouleurs` à faux et `paletteJeu` à faux → `reglagesMoteur(j).palette === null`,
      exactement la valeur d'avant cette tranche ; testé directement.)*

### TU7 · Le mur

**Bloquée par** : TU3, TU4.

La sorte « Mur ». On règle sa hauteur, de 1 à 8 cases. Il comprend :
- un dessus en blob 47 ;
- trois bandes : face, base et ombre ;
- les pièces en biais sur les diagonales, la pente et le raccord de base d'un mur d'une case
  de haut (T43 à T45).

La scène pose le mur par courses, comme dans sc-clone. La livraison écrit les collisions (sur
la base seulement, en triangle sur le biais), l'origine du tri en profondeur, et un `LISEZMOI`
des règles de pose :
- le bit sud est forcé ;
- les courses ;
- le décor se pose par paires.

- [x] La scène reproduit les essais de sc-clone : fente fermée (288 px → 0), escalier ramené
      (3 661 → 569 px), biais périodique au bit près.
      *(Tenus par les essais recopiés en TU1, `interface/src/tuiles/moteur/__tests__/` :
      « T22 : le dessus d’un mur ne laisse plus voir le fond » (0 px ; remesuré le
      19 septembre avec le masque brut : 288 px), « T24 : la jonction en diagonale referme la
      fente » (exige plus de 2 000 px débranché et quatre fois moins branché ; remesuré :
      3 227 → 21 px, la scène ayant encore gagné depuis T24 avec le biais de T43 à T45),
      et « T43 · la face cisaillée EST la face droite, lue (y − x) lignes plus haut — au bit
      près » dans `tileset.test.ts`. La livraison pose exactement cette scène :
      `atelier/domaine/pose_mur.py` est comparé, pose pour pose, à `dessinerScene` sur 38
      scènes, `tests/test_tu7_mur.py`.)*
- [x] Dans un vrai Godot 4.7, la carte livrée pose le dessus du mur par `set_cell` et les
      bandes en tuiles simples. Un mur de hauteur 1 **et** un mur de hauteur 3 se chargent
      sans erreur (sc-clone ne testait que 3).
      *(Quatre cartes, dont un escalier en hauteur 1 et 3 et deux pentes sur une même case :
      0 désaccord avec la scène, case par case et dans l'ordre de dessin. L'outil Terrains de
      Godot rend bien le masque brut, jamais le bit sud forcé : d'où le `set_cell`.)*
- [x] Le personnage passe derrière le mur et devant sa base : le tri en profondeur est vérifié
      dans Godot.
      *(La carte range chaque étage sur sa couche, avec un `y_sort_origin` qui ramène tout le
      mur sur la ligne de sa base. Dans l'essai, Godot sans écran calcule l'ordre depuis ses
      propres valeurs. Vérifié une fois en rendu réel (fenêtre, OpenGL) sur un atlas témoin :
      410 cases conformes au peintre, personnage caché derrière, visible devant ; à
      l'envers, sans les origines de couche, 30 cases fausses et le personnage traverse.)*
- [x] Le dessus du mur est identique, au pixel près, au sol de même matière, **hors la
      pénombre des angles**.
      *(La pénombre du moteur (T38 de sc-clone, validée) assombrit exprès les coins rentrants
      du dessus, que le sol n'a pas. L'essai (`interface/src/tuiles/atelier.test.ts`) vérifie
      les deux : identique sans pénombre, et avec, seules les pièces à coin rentrant
      diffèrent. Tranché en TU7 : la pénombre « discrète » reste le défaut, parce que
      l'auteur l'a validée dans sc-clone ; le critère était mal écrit, pas le mur.)*

### TU8 · Le décor autour des bords

**Bloquée par** : TU7.

Les gravats qui débordent d'un bord (T27). Il y a quatre côtés d'appui et trois variantes. On
les pose par paires, sur un second `TileMapLayer`. Le réglage vaut « Aucun », « Léger » ou
« Dense ».

- [x] Le décor se pose toujours en paires, avec sa moitié extérieure et sa moitié intérieure.
      *(`atelier/domaine/pose_decor.py`, port de `emplacementsDecor` ; `pose_mur.decor`
      pour le mur, occupation = `occupation_mur`, cases de pente de T44 exclues. Prouvé
      pose pour pose contre le moteur sur 164 scènes — `essais/tu8_reference_decor.mjs`
      → `tests/fixtures/tu8_reference_decor.json`, `tests/test_tu8_decor.py` — et par un
      essai explicite de l'appariement sur 60 cartes au hasard.)*
- [x] Il sort en tuiles sans terrain, sur une seconde couche de la carte livrée.
      *(Sol/chemin/15-pièces : la carte devient un `Node2D` « Carte » avec « Terrain »
      et « Décor » dès qu'il y a au moins un gravat à poser. Mur : une dernière
      `TileMapLayer` « Décor » dans le `Node2D` de TU7, `z_index 1`, toujours devant.
      Un vrai Godot 4.7 charge les trois cas (sol, chemin, mur) et retrouve la pose
      calculée sur la couche « Décor », 0 désaccord.)*
- [x] « Aucun » donne un atlas identique au bit près à TU7.
      *(Et une carte dont aucun tirage ne pose de gravat, même avec un réglage « léger »
      ou « dense », reste une seule `TileMapLayer` — décision tranchée en TU8 : la
      structure de la carte suit ce qu'il y a à poser, pas le réglage lu tel quel.)*

*Le décor de coin fusionné (T39) n'est pas repris : il a été annulé dans sc-clone après usage
(T42).*

**Décor et Godot : décisions tranchées en TU8.** La couche « Décor » d'un mur porte
`z_index = 1` sans tri en profondeur (ni y_sort) : elle passe toujours devant la matière et
devant l'ombre (`z_index -1`) — le critère demandé (« pose attendue, 0 désaccord ») ne porte
que sur les cases de la couche, pas sur son entrelacement avec le personnage, qu'aucun gravat
ne bloque ni ne trie. Pour un sol ou un chemin, l'ordre des nœuds seul suffit (une carte
plate, non triée) : « Terrain » puis « Décor ». Un jeu TU4 existant qui chargeait la scène
comme une `TileMapLayer` typée doit maintenant accepter un `Node2D` quand un décor s'y pose :
`tests/test_tu4_livraison.py` (script `CHARGE`) a été ajusté en ce sens, sans toucher à ses
assertions.

### TU9 · Vérifier avant de livrer

**Bloquée par** : TU3. Complète TU7 une fois le mur livré.

L'onglet « Vérifier » lance le contrôle de sc-clone : les bords au pixel près, les cases
effacées, les coutures décalées, les coins vidés. La relecture de livraison reprend le
résultat.

- [x] Un atlas propre donne une seule phrase : « Aucun défaut : 47 pièces se raccordent ».
      *(`interface/src/tuiles/atelier.ts`, `verifier` — déjà en place depuis TU3/TU6 ; le
      texte écran est « Aucun défaut : les 47 pièces se raccordent. », celui de la
      maquette validée. Vu au navigateur sur l'atelier jetable TU3.)*
- [x] Chaque défaut se dit en clair et montre la pièce sur la planche.
      *(Nouveau en TU9 : `pieceDeDefaut` (`atelier.ts`) relit le message brut de
      `tile-check.js` — jamais modifié — et en tire la case (masque, case libre,
      colonne de bande de mur) ; `AtelierTuiles.tsx`, `Verifie`, change chaque ligne de
      défaut en bouton qui bascule sur l'onglet Planche et surligne la pièce. Testé sur
      un atlas saboté — case effacée, couture décalée — en vitest
      (`atelier.test.ts` § Vérifier (TU9)) et en test d'écran
      (`AtelierTuiles.test.tsx`).)*
- [x] Un défaut **avertit** et ne bloque pas la livraison : la livraison décide, elle ne
      bloque pas (RP10).
      *(Déjà le cas : `LivraisonDuJeu` relit `verifier` pour l'afficher, mais le bouton
      Déposer ne dépend que de `occupe`/`apercu?.pret`, jamais des défauts — vérifié au
      navigateur, un « Vérifié : … » qui n'empêche pas le dépôt.)*
- [x] La case « tout dessous » d'un jeu sur deux sols n'est plus signalée comme un défaut.
      *(Relevé en faisant la maquette : le contrôle de sc-clone ne connaît pas le second
      terrain, et la maquette ignore ce cas à la main. Le filtre était déjà porté dans
      `verifier` (`atelier.ts`) au moment de TU9 ; ajouté en TU9 : la couverture d'essai
      qui le prouve (sol et 15 pièces, `atelier.test.ts`), et une assertion côté agent
      (`tests/test_tu10_agent.py`,
      `test_read_tile_set_sur_deux_sols_ne_signale_plus_la_case_tout_dessous`) — le
      rendu Node (`atelier/tuiles_node/rendre.mjs`) appelle la même fonction, donc
      l'agent en profite sans rien dupliquer côté serveur. Vu au navigateur : la case
      « Sur un autre sol » cochée, Vérifier reste à « Aucun défaut ».)*

### TU10 · L'agent fabrique des tuiles

**Bloquée par** : TU5, TU9. Ferme le critère ouvert d'AU13.

Le serveur rend l'atlas à partir d'une recette, avec le même fichier moteur lancé par Node. Les
outils MCP apprennent la recette :
- `create_tile_set` accepte une sorte et des matières ;
- un outil génère une matière ;
- `read_tile_set` rend le résultat de la vérification ;
- la livraison passe par l'éditeur commun.

Le cadre de l'agent borne les générations de matières, comme pour l'image.

- [x] L'atlas rendu par le serveur est identique au pixel près à celui du navigateur, pour
      chaque sorte.
      *(`atelier/tuiles_node/rendre.mjs` importe `interface/src/tuiles/atelier.ts` lui-même.
      `tests/test_tu10_agent.py` lance `essais/tu10_reference_navigateur.mjs` : Edge sans écran
      rejoue les gestes de l'écran sur 19 cas — sol, chemin, mur h1 et h3, 15 et 17 pièces,
      second terrain, variantes, animation, animation d'atlas, décor, matières « asset »
      décodées par le navigateur, palette commune et palette du jeu (TU6) — ; le serveur
      refait le chemin inverse. 1 242 112 pixels, 0 écart ; la carte et le contrôle aussi, et
      les 19 PNG sont même identiques à l'octet. Une mutation (palette de l'univers non
      transmise) fait tomber l'essai.)*
- [x] Un agent produit, vérifie, corrige une matière et livre un jeu de tuiles dans un vrai
      Godot, sans écran. C'est le critère d'AU13, coché dans `PLAN-atelier-unifie.md`.
      *(`test_un_agent_produit_verifie_corrige_et_livre_dans_godot` : appels MCP successifs,
      ComfyUI doublé, Godot 4.7 charge la carte et relit un pixel de l'atlas.)*
- [x] Si Node manque, les outils le disent. Le reste de l'atelier fonctionne.
      *(`ATELIER_NODE` vide : `create_tile_set`/`update_tile_set` par recette refusent en
      disant quoi installer ; `read_tile_set` rend tout, avec `verification.disponible` faux ;
      lister, livrer et créer à partir d'une image fonctionnent.)*
- [ ] Un jeu demandé par l'agent apparaît dans la liste de l'écran, marqué comme tel.
      *(Côté serveur fait : `origine: "agent"` sur l'ensemble, `"auteur"` relu pour les
      anciens. Reste l'affichage dans la liste de l'écran.)*

**Tranché en TU10.** Le cadre qui borne les matières de l'agent est celui de ses images
locales (RP2, travail durable relu au lancement et au tour de la carte graphique), pas le
plafond de séance de `generate_asset` : par défaut, les garde-fous imposent le modèle
d'exploration, donc le style des matières doit être permis par l'auteur (méthodes permises,
écran Réglages) — comme toute image locale de l'agent.

### TU11 · La relecture croisée

**Bloquée par** : toutes les autres.

Le plan, la maquette, l'écran, `DESIGN.md`, `ARCHITECTURE.md`, le PRD et l'état sont confrontés
entre eux. Quinze gestes sont faits au navigateur sur un atelier jetable :
- un sol ;
- un chemin ;
- un mur de hauteur 1 et un de hauteur 3 ;
- une matière générée (ComfyUI doublé) ;
- une livraison dans un vrai Godot.

- [ ] Les comptes, les noms et les critères cochés sont d'accord entre les fichiers.
- [ ] `docs/PLAN.md` § Où en est le dépôt porte la ligne du chantier.
- [ ] La section « Objets et tuiles » de `docs/modeles-et-workflows.md` est écrite.

## Ce que ce plan ne couvre pas

- **L'isométrique et la vue de plateforme.** SpriteCook les propose ; sc-clone n'a fait
  qu'un atlas plat de losanges, sans matière. Ils se cadreront sur un vrai besoin du jeu.
- **Le décor en projection oblique** de l'étude « carrefour » de sc-clone (`scripts/decor-*.mjs`)
  : il n'a jamais été exporté en jeu de tuiles.
- **Les normales** (T33, optionnelle dans sc-clone).
- **Générer un atlas entier par un modèle payant.** L'essai `essai_au13_generation_reelle.py`
  reste non lancé : les mesures de sc-clone (T6) disent qu'un modèle ne tient pas une grille
  4×4 qui se raccorde.

## Questions laissées ouvertes

- **La taille de pièce par défaut.** L'écran reprend celle de l'univers du jeu. Les essais de
  sc-clone sur « Cœur de Pierre » visaient 64 px pour un jeu en 800×450. Si c'est le même jeu,
  64 px devient le défaut.
- **La face de mur reste fragile** dans sc-clone : elle génère des barres verticales. TU5 la
  garde telle quelle. Si l'usage le confirme, ce sera une tranche de plus, avec un tirage
  mesuré, pas une supposition.
