# Relevé d'outillage — détourage, pixelisation, animation

> ⚠️ **Ses conclusions sont reprises et rangées dans `docs/bilan-v3.md`** § 4, écrit le
> 2 septembre 2026 — c'est celui-là qu'on lit pour ouvrir une tranche. **Ce relevé-ci reste la
> source** : les dépôts nommés, les licences vérifiées, les chiffres lus dans la source, et le
> détail de ce qui est écarté.
>
> **Ce document ne décide rien.** Il relève ce qui existe ailleurs, ce qui est reprenable, et
> à quel prix. `docs/PLAN.md` dit ce qu'on prend et dans quel ordre ; `docs/PRD.md` ce que le
> produit doit faire. Celui-ci se lit avant d'écrire une tranche qui touche au traitement de
> l'image, et **il se lit aussi pour ce qu'il écarte** : un outil séduisant qu'on ne consigne
> pas se repropose tous les six mois.
>
> Ouvert le 2 septembre 2026, à la demande de l'auteur, après lecture de six dépôts qu'il
> avait lui-même repérés. **Huit axes explorés**, une centaine de dépôts et de pages ouverts,
> quatre-vingt-six prises rapportées. Tous les faits chiffrés qui suivent ont été **lus dans
> la source**, jamais devinés ; quand une licence n'a pas été vérifiée, c'est écrit.
>
> **Et quatre choses ont été mesurées ici, sur les images du dépôt, avant d'y croire.** Elles
> sont en tête, parce que deux d'entre elles renversent ce que la lecture laissait attendre.

---

## Ce qui a été mesuré sur ce dépôt, et qui décide

### 1 · Le compromis « liseré contre halo » ne mord que sur un moteur

`atelier/image/traitement.py` porte, en toutes lettres, un compromis présenté comme perdant :
*« Les ronger coûte un liseré de sprite ; ne pas les ronger coûte un halo. Le réglage existe
pour que l'auteur tranche, image par image. »* Toute la littérature du matting promet d'en
sortir. **Mesuré sur dix images réelles du dépôt, l'alpha rendu par chaque moteur avant
durcissement :**

| Moteur | Pixels semi-transparents |
|---|---|
| **`bord`** — le défaut du produit | **0** |
| **`modele`** — rembg | **95 % du sujet** |

Le remplissage par inondation est **binaire par construction** : il n'y a pas un seul pixel de
bord à corriger, donc rien à décontaminer, et le compromis n'existe pas sur le chemin courant.
Sur le moteur modèle, à l'inverse, il est total : une matte douce couvrant presque tout le
sujet est écrasée par `durcir`, et l'information de bord part à la poubelle.

**Conséquence pour le plan** : une passe de décontamination ne se justifie **que** derrière le
moteur modèle, et **que** si l'on décide d'employer ce moteur plus souvent. Ce n'est pas une
amélioration générale du produit.

### 2 · Le halo, cherché sur les vraies images, ne s'y trouve presque pas

Sur quarante images du dépôt détourées avec **la recette par défaut**, en comptant les pixels
de contour dont la couleur est plus proche du fond que de toute couleur du sujet :

- **80 pixels contaminés sur 138 465 pixels de contour — 0,1 %.**
- La décontamination par `estimate_foreground_ml` les ramène à 5, soit **94 % de réduction**…
  d'un problème qui représentait un millième du contour.

**C'est un résultat négatif, et il vaut son pesant** : il évite d'ouvrir un chantier de matting
sur la foi d'un commentaire de code. La raison est structurelle — le produit génère sur **fond
plat** et découpe par inondation ; le halo est un problème de matting photographique.

### 3 · `pymatting` est installé — mais seulement par la porte de derrière

Vérifié dans le venv : **`pymatting` 1.1.15**, avec `numba`, `scipy`, `scikit-image`,
`onnxruntime` — tous tirés par `rembg`, donc par l'extra `detourage`. Aucune occurrence de
`pymatting`, `estimate_foreground`, `decontaminate` ou `alpha_matting` dans `atelier/`.

Le dépôt paie déjà la bibliothèque et ne s'en sert pas.

> ⚠️ **Mais « zéro dépendance nouvelle » est faux dans le seul sens qui compte.** `pyproject.toml`
> ne déclare en dur que `fastapi`, `uvicorn`, `httpx`, `pillow`, `numpy` et `mcp`. `pymatting`,
> `numba`, `scipy` et `scikit-image` ne sont là **que parce que `rembg` les traîne** — et `rembg`
> est l'extra **optionnel** `detourage`, décrit dans le fichier lui-même comme optionnel exprès
> pour que le produit continue de détourer hors ligne sans lui. **Une installation de base n'a
> ni `pymatting` ni `scipy`.** Toute prise qui s'appuie dessus doit ajouter sa ligne à
> `pyproject.toml`, et aucune ne le disait. *À tenir par un test qui installe sans l'extra et
> démarre l'atelier.*

*Deux corrections du même ordre : `opencv` n'est **pas** installé ici, contrairement à ce qu'un
balayage a supposé ; et `PyYAML` est présent sans être déclaré par personne.*

### 4 · La recette par défaut est fausse plus d'une fois sur deux, et les deux familles diffèrent

Relevé sur les **116 assets** du dépôt et leurs 123 passes de détourage :

| | Dépliées d'une planche | Images ordinaires |
|---|---|---|
| Durcissement non nul *(le défaut est 0)* | 25/65 — **38 %** | 39/58 — **67 %** |
| Moteur autre que `bord` *(le défaut)* | 24/65 — 37 % | 25/58 — 43 % |
| Pipette employée | **0** | 11 |

La tolérance, elle, n'est presque jamais retouchée — **111 passes sur 118 restent à 28**. Ce
n'est donc pas elle le problème.

**Deux faits en sortent, et ils commandent une tranche** : le durcissement par défaut est faux
plus d'une fois sur deux ; et un morceau de planche ne veut manifestement pas le même réglage
qu'une image seule — la pipette n'y sert *jamais*, et le durcissement y est près de deux fois
moins nécessaire.

---

## Ce que la relecture critique a trouvé, et que la recherche avait manqué

*Une passe adverse a été lancée sur le relevé, avec pour seule consigne de trouver ce qui
manque. Elle a rapporté huit manques bloquants. Les deux plus importants ont été vérifiés ici,
dans le code, avant d'être écrits.*

### ⚠️ Le défaut que la V3 doit réparer est déjà dans le code, et son commentaire dit l'inverse

**Vérifié ligne à ligne dans `sur_grille` (`atelier/image/traitement.py`).** Quand le sujet a une
silhouette, la fonction recadre sur **la boîte opaque de l'image courante**, puis :

```
facteur = dedans / max(sujet.width, sujet.height)   # l'échelle vient de CETTE image
x = (cible - reduit.width) // 2                     # le centrage aussi
y = cible - reduit.height                           # le bas de la BOÎTE, pas les pieds
```

**Un bras tendu agrandit la boîte, donc réduit tout le personnage.** Deux étapes d'un même
mouvement ressortent à deux échelles et à deux positions. La docstring affirme pourtant, mot
pour mot, que *« c'est la case qui fait que deux frames d'un même personnage se superposent au
lieu de flotter »*.

C'est très exactement le défaut que le banc d'animation avait mesuré sans savoir d'où il venait
(`docs/archive/v3-animation.md` § *Les étapes d'une bande se recadrent ensemble*). **On a maintenant la
ligne.** Le code connaît d'ailleurs la dérive *horizontale* — un commentaire la décrit et offre
un décalage manuel pour la rattraper — mais **pas la dérive d'échelle**, qui est la fatale.

**Corollaire à écrire dans les pièges** : l'ancrage vertical se fait sur le bas de la **boîte
englobante**. Toute poussière, toute ombre portée sous les pieds soulève donc le personnage
d'autant. Le nettoyage des taches doit **précéder** le calcul de la boîte.

### Un troisième chemin que personne n'avait vu

La recherche opposait deux mondes : demander une planche par du texte *(épuisé)*, ou fabriquer
la géométrie chez soi *(pantin)*. **Il en manquait un** : rendre une pose grossière **en local**
— une silhouette déformée, ou même un bonhomme-bâton posé sur les seize articulations — et
l'envoyer comme **référence visuelle** à un point d'entrée d'édition d'image, pour que le modèle
**habille une géométrie déjà imposée**.

Ce n'est pas une façon de demander de plus : c'est un **conditionnement**. Il répond à
l'objectif annoncé — *imposer la géométrie au lieu de l'espérer* — **sans exiger que le rendu du
pantin soit beau**, ce qui est de loin la partie la plus coûteuse du chemin pantin. *À vérifier
d'abord : quels modèles du catalogue acceptent une image d'entrée en édition.*

Dans la même famille, et gratuite : **l'interpolation entre deux poses dans l'espace des
angles** du pantin. Trois lignes une fois le format en place, et elle évite de générer les
étapes intermédiaires. *(Les modèles d'interpolation d'images, eux, sont à écarter : ils
fabriquent du flou de mouvement et des couleurs hors palette, soit le pire cas ici.)*

### Il n'existe aucune vérité extérieure pour juger

Tous les bancs proposés comparent une méthode à une autre **sur les sorties du dépôt**. Il
n'existe nulle part une animation de pixel art connue et correcte contre laquelle mesurer.

Le plus proche du besoin est le **Universal LPC Spritesheet Character Generator** — personnages
64×64, découpés **en couches** sur la même grille, vocabulaire d'actions figé *(marche, estoc,
taille, tir, blessure, incantation…)*. **Piège de licence** : le code est GPL-3.0 et les images
mélangent CC0, CC-BY, CC-BY-SA et OGA-BY — rien ne se redistribue en bloc, mais le sous-ensemble
CC0 est utilisable, et **la convention et le corpus servent de vérité terrain gratuite**. C'est
ce qui manque pour répondre honnêtement à *« le pantin suffit-il ? »* : comparer à un cycle de
marche dessiné par un humain, au lieu de le regarder et de le trouver joli.

### La prémisse de la V3 a été mise en doute — vérification faite, elle tient

La critique soupçonnait que les trois bancs aient envoyé une **bande** en référence, ce qui se
lit comme de la variance d'identité, et que *« la façon de demander est épuisée »* soit donc
conclu trop vite.

**Vérifié dans `essais/essai_recette.py`** : les bancs joignaient une carte d'univers et **un
sprite unique**, c'est-à-dire une ancre d'**une seule pose**. Le soupçon ne s'applique pas, et
la conclusion tient.

### Deux angles morts qui ne sont pas techniques

- **Le droit d'usage des images produites n'a jamais été vérifié.** Le relevé pèse au gramme la
  licence d'un modèle de silhouette de 176 Mo, et ne pose jamais la question dont dépend la
  valeur du produit : **les sprites sortis du fournisseur peuvent-ils être vendus, redistribués
  dans un jeu ?** Les conditions d'OpenRouter renvoient explicitement à celles de chaque
  modèle — il y a donc **autant de régimes que de fournisseurs au catalogue**, et la V2.2 vient
  d'en ajouter. *À écrire par fournisseur, à côté du prix.*
- **`isnet-anime` mérite un avertissement plus net que « amont non vérifié ».** Ses jeux
  d'entraînement sont des collections d'images de personnages d'animation japonaise ;
  l'hypothèse la plus probable n'est pas *« conditions non lues »* mais **œuvres sous droit
  d'auteur collectées sans licence**. Ce n'est pas le même risque qu'une clause académique, et
  l'auteur est en France, où les exceptions de fouille ne suivent pas le régime américain.

### Et deux mesures dont il faut se méfier — dont une des miennes

- **La mesure de halo est quasi circulaire.** *« La distance du contour à la couleur du fond a
  augmenté »* est à peu près la fonction que `estimate_foreground_ml` optimise. La mesure qui
  tranche vraiment est le **nombre de pixels du sprite final de 64 px dont l'indice de palette
  change** avec et sans décontamination. *Elle est gratuite sur les tirages déjà payés, et elle
  n'a pas été faite — la mienne non plus, qui mesurait à 1024 px.*
- **Rien ne mesure la stabilité d'une image à l'autre.** Réduire au plus proche voisin un alpha
  continu, c'est décider la silhouette finale en tirant un pixel dans chaque bloc — et d'une
  étape à l'autre ce tirage change indépendamment, **donc le contour bout**. Aucune mesure de
  cohérence temporelle n'existe. La plus simple : sur deux étapes d'un mouvement lent, compter
  les pixels de contour qui changent d'état alors que le sujet n'a pas bougé d'un pixel entier.

---

## Axe 1 — Ramener une image sur une vraie grille de pixels

**C'est le problème n°1 du dépôt**, et c'est l'axe où la recherche a trouvé le plus. Un modèle
rend une image de 1024 px « à l'allure pixel art » dont la grille est fausse : blocs de tailles
inégales, bords antialiasés, centaines de couleurs.

### La trouvaille — `pixel-art-fixer`

**[Retro-Diffusion/pixel-art-fixer](https://github.com/Retro-Diffusion/pixel-art-fixer)** —
**MIT** *(vérifiée : « Copyright (c) 2026 Astropulse, LLC »)*, `numpy + scipy + opencv +
Pillow`, **aucun modèle, hors réseau**, dernier envoi du 15 juillet 2026.

Leur banc — 100 images sources, 4 300 entrées déformées :

| | Taille native exacte | À un pixel près | Alignement de grille |
|---|---|---|---|
| **pixel-art-fixer** | **77 %** | 84 % | 94 % |
| PixelDetector | 4 % | 7 % | 80 % |
| PixelSnapper | 4 % | 19 % | 63 % |
| méthode naïve | 2 % | 4 % | 50 % |

*C'est leur propre banc, sur leurs propres images. L'écart est trop grand pour être du bruit,
et leur méthode est décrite honnêtement — mais il se remesure ici avant de servir d'argument.*

**Les trois prises, par rapport valeur sur coût :**

1. **La reconstruction en deux temps** — *une demi-journée, et elle se branche sur la remise
   sur grille existante même en gardant notre détecteur actuel.* La grille de sortie est
   **régulière**, jamais recalée sur les maxima de gradient. On quantifie l'image à K couleurs,
   on donne à chaque pixel un poids en tente (maximum au centre de sa case, nul au bord), et
   **deux étages** : les étiquettes quantifiées votent pour décider *où* tombe la case, puis la
   couleur est la moyenne pondérée des pixels **d'origine non quantifiés** portant l'étiquette
   gagnante. Les pixels de fondu du voisin sont exclus parce qu'ils portent l'autre étiquette.
   *Erreur couleur mesurée 4,56 contre 5,51 pour une mise en commun classique, sur 200 images.*

2. **Quantifier avant de profiler** — *deux heures.* Avant tout profilage de grille, quantifier
   à ~16 couleurs. Les rampes d'antialiasing, qui étalent une frontière sur trois à cinq pixels,
   deviennent des **marches franches posées sur la vraie frontière**, et le bruit JPEG est
   étouffé. Vient de [spritefusion-pixel-snapper](https://github.com/Hugo-Dz/spritefusion-pixel-snapper)
   (MIT), repris par pixel-art-fixer.

3. **La règle du plus petit pic qualifié** — *deux heures.* Notre mode d'échec dominant est
   **l'ambiguïté d'octave** : un peigne posé au double du vrai pas touche encore toutes les
   vraies frontières, une sur deux, et score presque aussi bien. La règle : parmi les candidats
   à au moins 0,78 fois le meilleur score, prendre **le plus petit pas, jamais le plus fort**.
   Les diviseurs, eux, scorent nettement moins bien — donc le plus petit quasi-optimal est le
   fondamental. *Trois détecteurs développés indépendamment ont convergé sur cette règle.*

**Et le piège qui nous vise directement.** Leurs deux détecteurs balaient jusqu'à un pas de
**24 à 26 px**. Le dépôt a mesuré des grilles **cinq fois plus grosses que demandées** — soit
un bloc approchant 80 px sur une image de 1024. Repris tels quels, **ils ne verront jamais
notre vrai pas** et rendront confortablement une sous-harmonique avec un bon score. Relever les
bornes n'est pas gratuit : le nombre d'harmoniques disponibles chute de 24 à 12 environ, et le
peigne perd d'autant son pouvoir de discrimination. **C'est le premier réglage à mesurer.**

### Deux résultats contre-intuitifs, à connaître avant de coder

Tirés de leur document d'ingénierie, 752 lignes, et vérifiés par ablation sur leur banc :

- **Le canal évident est le pire.** « On pose un peigne et on prend l'argmax » — la méthode
  qu'on écrirait d'instinct — obtient 0,37 de réussite au premier rang, dernier des onze
  canaux. Presque toute la machinerie de rattrapage d'un détecteur naïf n'existe que pour
  rustiner ce seul canal faible.
- **La somme bat le maximum.** Fusionner quatre canaux normalisés donne 36/40, contre 32/40
  pour le meilleur canal seul et 37/40 pour l'oracle.
- **L'erreur n'est pas symétrique.** Une grille d'un octave trop grossière donne un résultat
  visiblement pire ; une grille légèrement trop fine se reconstruit presque parfaitement.
  **En cas de doute, viser fin.**

### Sur la palette imposée — la nôtre vient des artworks

**[PixelRefiner](https://github.com/HappyOnigiri/PixelRefiner)** — MIT, 967 commits, actif.
Applique une palette imposée par **plus proche voisin en OKLab**, avec deux corrections dans
les sombres : sous L=0,2 on favorise le noir franc ; sous L=0,1 la ressemblance RGB directe
reprend du poids. *Trois à quatre heures, conversion OKLab comprise, et c'est le meilleur
rapport pour notre contrainte de palette.*

**La règle qui va avec, et qui compte plus que l'algorithme** : appliquer la palette **sur la
sortie 64 px déjà reconstruite, jamais sur l'image 1024 avant réduction** — sinon on quantifie
l'antialiasing et on fabrique des couleurs de bord qui n'existent pas dans le sprite.

### Écartés, et pourquoi

- **`pixa-pics`** *(celui que tu as signalé)* — MIT *(fichier `COPYING`, trois détenteurs)*,
  709 étoiles, mais **l'algorithme intéressant n'est pas celui qui tourne**. Vérifié dans la
  source : les trois filtres de nettoyage sont **commentés** dans `Filters.js` ; le k-moyennes
  de `KMeans.js` **ne réassigne jamais ses centres** et « converge » donc dès la première
  itération sur un tirage aléatoire ; la détection de grille compte des pixels **strictement
  identiques**, ce qui la rend inopérante sur un rendu antialiasé ; et le chemin `doppel`, seul
  endroit où vit la bonne idée, n'est **jamais appelé** — l'application passe `"pixelize"` écrit
  en dur, c'est-à-dire un simple redimensionnement au plus proche voisin. *Une idée à garder
  quand même : réduire un bloc à sa couleur **majoritaire** et non à sa moyenne. Mais
  pixel-art-fixer la fait mieux, et son code tourne.*
- **`Astropulse/pixeldetector`** — 122 lignes très lisibles, excellent objet pédagogique, mais
  `convert('RGB')` détruit l'alpha dès la première ligne et `find_peaks(distance=1, height=0)`
  accepte tout maximum local. 4 % de tailles natives exactes sur banc indépendant. Licence non
  vérifiée. *À lire, pas à livrer.*
- **`proper-pixel-art`** — remplace les pixels transparents par une couleur opaque **avant**
  Canny et Hough : sur un sprite détouré, la silhouette du personnage devient le contour le plus
  fort et domine le vote. L'outil trouve le personnage au lieu de la grille.
- **Le marcheur à coupes non uniformes de spritefusion** — les auteurs de pixel-art-fixer l'ont
  explicitement remplacé, mesures à l'appui : **la grille régulière bat le recalage sur les
  maxima de gradient**, 4,56 contre 5,51, et l'écart est le plus grand précisément sur les
  images gauchies que le marcheur devait sauver. Sur de l'art détaillé, les forts gradients sont
  des bords de **contenu**, pas des frontières de pixel. *Intuition séduisante, mesurablement
  fausse.*

---

## Axe 2 — Le fond de clé, et ce qu'on demande au modèle

### Le contrat de fond de clé

**[sprite-gen](https://github.com/aldegad/sprite-gen)** — **Apache-2.0**. Envoie **deux**
phrases, et c'est la seconde qui est la trouvaille :

- positive — *« Use a perfectly flat pure [nom] [hex] chroma-key background across the whole
  image »* ;
- négative — *« Do not use [hex], pure [nom], or **chroma-adjacent colors** in the character,
  highlights, props, shadows, or effects. »*

Elle n'interdit pas seulement la couleur exacte, elle interdit **les couleurs voisines**, et
elle énumère les endroits où le modèle a l'habitude de la faire réapparaître. **Chez nous, ça
ne coûte aucune ligne de code** : le champ *prompt négatif* existe déjà et l'adaptateur le
replie en fin de prompt.

### Le choix adaptatif de la clé — et il devient trivial ici

`choose_chroma_key` de sprite-gen : quatre candidats fixes — magenta `#FF00FF`, vert `#00FF00`,
cyan `#00FFFF`, bleu `#004DFF` —, on garde celui dont la distance minimale aux couleurs du
sujet dépasse un seuil, et **on prévient** si aucun n'est sûr.

**Chez nous c'est beaucoup plus simple que dans le cas général** : la palette d'univers est déjà
une liste fermée de 24 couleurs. Le choix de la clé devient une **décision d'univers, calculée
une fois** — distance de chaque candidat aux 24 couleurs, on garde le premier qui passe le
seuil, on l'écrit dans l'univers. *Vingt à trente lignes, contre cent cinquante pour le cas
général de l'image importée.*

### Le despill — la correction du liseré sans toucher au masque

Tout se joue dans le plan de chrominance CbCr, **la luminance est jetée** : un magenta sombre
et un magenta clair sont le même fond. On projette la chrominance de chaque pixel sur la
direction de la clé et on **soustrait cette seule composante** ; tout ce qui lui est
perpendiculaire garde sa saturation. *Quarante à cinquante-cinq lignes de numpy, zéro
dépendance, et ça se branche comme une passe de recette de plus.*

**Deux réserves honnêtes.** Le despill n'a de sens **que si le fond est une clé colorée** —
sur le gris clair actuel, la direction de la clé est nulle en CbCr. Et sur une mesure
instrumentée, seuls **0,9 % des pixels opaques** tombent dans la bande où le despill agit :
il traite **le contour, un à deux pixels**, pas une teinte sur le corps. C'est précisément le
problème documenté par le dépôt — mais il ne faut pas en attendre davantage.

### ⚠️ Le fait qui renverse la branche « alpha natif »

**`background="transparent"` n'est PAS ouvert sur `gpt-image-2` chez OpenRouter.** Relevé du
catalogue public le 2 septembre 2026 : `openai/gpt-image-2` déclare
`background = ["auto", "opaque"]`. *Transparent* n'y est pas.

Il **est** déclaré pour `openai/gpt-image-1`, `gpt-image-1-mini`, `gpt-5-image`,
`gpt-5-image-mini`, `sourceful/riverflow-v2.5-pro` et `-fast`.

**Trois conséquences :**

1. La branche « demander un alpha natif » est bien **gratuite en code** — le catalogue déclare
   l'option, rien à écrire —, mais **elle ne peut pas tourner sur le modèle du produit**. Il
   faut la lancer sur `gpt-image-1` ou `gpt-5-image`, et alors faire tourner les branches
   témoins sur le même modèle pour rester comparable.
2. **Piège** : `riverflow-v2.5-fast` déclare `background=transparent` mais son format de sortie
   ne propose que `jpeg` — qui ne porte pas d'alpha. C'est la version `-pro` qu'il faut.
3. **Bonne nouvelle côté aval** : tous les chemins de lecture du dépôt font `.convert("RGBA")`,
   donc un PNG à quatre canaux traverse le produit sans se faire aplatir.

---

## Axe 3 — Le pantin 2D : le chemin qui supprime la loterie

### La référence est trouvée, et elle est meilleure qu'espéré

**[facebookresearch/AnimatedDrawings](https://github.com/facebookresearch/AnimatedDrawings)** —
**MIT, code *et* poids**, déclaré explicitement.

**Le fait qui change tout : il n'y a ni PyTorch, ni detectron2, ni mmpose dans les dépendances
de la bibliothèque d'animation.** Les modèles lourds vivent dans l'image Docker de l'annotation
automatique, pas dans la bibliothèque. **Si l'on fournit soi-même le masque et la position des
articulations — ce que l'atelier sait déjà faire —, toute la chaîne d'animation tourne sur
numpy, scipy et scikit-image.**

**Et une découverte qui simplifie beaucoup :** il n'y a **aucun poids de skinning** dans tout
AnimatedDrawings. Les articulations sont de simples épingles ; le coude et l'épaule sont tenus
par la **rigidité du maillage**, pas par un mélange de poids. C'est ce qui rend le module
copiable en un fichier.

**Les quatre prises :**

| Prise | Ce que c'est | Coût |
|---|---|---|
| **`arap.py`** | La déformation « aussi rigide que possible », 329 lignes, `numpy` + `scipy.sparse` seuls | **copie MIT**, + ~50 lignes de rendu affine par morceaux à écrire |
| **Le maillage** | Contour par `find_contours`, simplification, semis de points intérieurs sur grille, triangulation de Delaunay, on jette les triangles hors contour | ~130 lignes |
| **Le squelette 16 articulations** | Table exacte de conversion depuis les 17 points COCO, format YAML plat : `loc`, `name`, `parent` | quelques dizaines de lignes |
| **Le rétargeting BVH** | Projeter un mouvement 3D en un seul angle par articulation et par image | — |

**Le format de squelette est à reprendre tel quel plutôt qu'à inventer** : YAML plat, éprouvé,
et il rend les quatre personnages d'exemple de Meta utilisables gratuitement comme jeu d'essai.
Dans le projet il devient l'équivalent de la recette : une donnée non destructive à côté de
l'image brute, éditable à la main.

### ⚠️ La décision qui commande tout le reste : déformer grand, pixeliser à la fin

**Trois preuves indépendantes, pas une opinion :**

1. AnimatedDrawings **redimensionne toute entrée à 1 000 px** avant de faire quoi que ce soit,
   et son estimateur de pose travaille sur du 256×192. **Aucune étape ne regarde jamais une
   image de 64 px.**
2. La déformation rend des positions de sommets **continues**. Échantillonner une texture à
   travers un maillage déformé et l'écrire directement dans une grille de 64 px, c'est
   fabriquer le bras qui bave — le problème n'est pas la rotation, c'est **quantifier la
   géométrie trop tôt**.
3. Meta a dû réentraîner un estimateur de pose **spécifiquement sur des dessins**, parce que
   ceux entraînés sur photo échouaient déjà en grand format.

**La chaîne retenue** : demander au fournisseur un personnage en **grand format** → détourage
existant → maillage, squelette et déformation à cette résolution → rendre chaque étape en grand
format → **et seulement là** quantifier sur la palette et remettre sur la grille de pixels.

**C'est la branche qui ne demande aucun module neuf en aval** — la quantification, la remise sur
grille et le détourage sont déjà écrits et éprouvés, et ils s'appliquent image par image comme
aujourd'hui. Le seul changement en amont est la consigne de taille.

### Les réserves, et elles sont réelles

- **Le dépôt est archivé depuis le 3 septembre 2025**, en lecture seule. Ça n'empêche pas de
  recopier l'algorithme sous MIT ; ça interdit d'en faire une dépendance vivante.
- Le code construit sa matrice **en dense** avant de la convertir en creux, et appelle un
  déterminant sur une matrice 3 200 × 3 200 en float32 — qui vaut numériquement zéro ou l'infini
  par sous-dépassement, dans une boucle `while`. **À notre taille de maillage (150 à 400
  sommets) le problème disparaît, mais il faut réduire la densité avant de lancer le code tel
  quel.**
- Le rendu d'origine passe par OpenGL. **À ne pas reprendre** : seul le calcul du maillage
  déformé nous intéresse.

### La question que ça permet de trancher gratuitement

Le projet peut, **sans installer un octet**, fabriquer un pantin à partir d'un masque de
silhouette qu'il sait déjà produire, poser les articulations à la main, et **regarder à quelle
amplitude de mouvement ça casse**.

Si une marche et une attaque de profil passent sans découvrir de zone cachée, **tout l'axe
décomposition en pièces et rebouchage devient facultatif**. Si ça casse, on saura exactement à
quel geste et pourquoi on paie la décomposition. *C'est l'essai le moins cher du dossier, et il
décide d'une tranche entière.*

---

## Axe 4 — Le rebouchage, s'il faut décomposer en pièces

### La ligne de base est gratuite… mais elle n'est pas installée ici

`cv2.inpaint` (Telea et Navier-Stokes) rebouche un trou en propageant les couleurs du bord.
Un banc a été monté et exécuté pendant la recherche, sur un sprite synthétique de 64 px, douze
tirages par branche, mesuré en proportion de pixels dont l'indice de palette est exactement
retrouvé :

| Branche | Telea | Navier-Stokes | Temps |
|---|---|---|---|
| rebouchage direct sur 64 px | 0,725 | 0,710 | 0,10 ms |
| détour par ×8 puis redescente | 0,757 | **0,779** | 178 ms |
| idem, redescente k-centroid | 0,759 | **0,799** | — |

**Le détour par le grand format gagne** — c'est le même enseignement que pour le pantin. Et la
requantification n'y est pas une option : le détour produit **1 035 à 1 776 couleurs** contre
67 à 74 en direct.

> ⚠️ **Correction d'un fait rapporté** : la recherche annonçait `opencv` comme déjà installé via
> `rembg`. **Vérifié ici : il ne l'est pas.** `cv2` est absent du venv. La ligne de base coûte
> donc une dépendance, ou une réécriture. *Le sprite d'essai était par ailleurs synthétique et
> fait de rectangles pleins, ce qui avantage un rebouchage par diffusion : c'est le classement
> relatif qui vaut, pas les valeurs absolues.*

### Les quatre conventions de masque — à écrire dans les pièges avant la première ligne

Quatre outils, quatre conventions, **dont deux exactement opposées** — toutes lues dans la
source :

| Outil | Sens du masque |
|---|---|
| MI-GAN, fichier « pipeline » | 255 = zone **connue à garder** |
| MI-GAN, fichier brut | 4 canaux : `masque_garder − 0,5`, puis l'image multipliée par ce masque |
| LaMa et son emballage | 255 = zone **à reboucher** — l'inverse exact |
| Le LaMa de see-through | 1 = à reboucher, remplissage jusqu'à un multiple de **64**, pas 8 |

**Le piège :** se tromper de sens **ne plante pas**. Ça reconstruit l'autre moitié de l'image,
et le résultat a l'air correct. Toute fonction du projet qui manipule un masque de rebouchage
doit **nommer sa convention dans sa signature** — `masque_a_reboucher` contre `masque_a_garder`
—, parce que le type ne protège de rien ici. *Zéro ligne de code, une page de documentation, et
elle vaut une journée de débogage silencieux.*

---

## Axe 5 — Le mouvement comme objet réutilisable

**C'est l'idée à voler à Ludo.ai**, et la recherche confirme qu'elle vaut par elle-même,
indépendamment du chemin retenu : le pantin en a exactement le même besoin.

- **Deux conventions concordantes à copier** : Spine sépare le squelette d'un côté et les
  actions de l'autre ; Godot fait de même avec ses bibliothèques d'animation. **Un mouvement
  écrit une fois pour un squelette dont les os portent des noms convenus se rejoue sur
  n'importe quel personnage portant les mêmes noms.**
- **Le CSV de la marche** : un mouvement de marche complet, une fois projeté en angles 2D, tient
  en **48 nombres** — contre 5,2 Mo de capture d'origine. Une bibliothèque maison se paie une
  fois en travail et devient gratuite pour tous les personnages suivants.
- **Corpus réutilisables commercialement** : **CMU Mocap** — le seul grand corpus BVH dont
  l'usage commercial est écrit noir sur blanc — et **100STYLE**, cent mouvements nommés en
  **CC BY 4.0**, livrés avec leurs bornes de découpe.
- **PyMotion** — boîte à outils de curation de bibliothèque de mouvements, **en numpy pur**.

---

## Axe 6 — Les deux idées de GameForge, vérifiées

### Une fiche recette par type d'image — pratiqué ailleurs, et mesuré nécessaire ici

L'idée est confirmée par la recherche *(« fiche recette par type d'asset, version explicite »)*
et surtout par **notre propre mesure** — voir plus haut : un morceau de planche et une image
seule ne veulent pas les mêmes réglages, et l'écart est net.

### Demander la fiche technique en même temps que le dessin — à nuancer

La recherche est claire sur la façon dont ça se pratique réellement : **le plan avant, la mesure
après.** Personne ne demande à un modèle d'image de décrire ce qu'il vient de dessiner ; on écrit
d'avance ce qu'on attend, et on **mesure** sur l'image revenue si c'est là. Ce que le dépôt fait
déjà avec le compte de sujets et la dérive de grille.

Ce qui est reprenable, en revanche, ce sont **les métriques d'acceptation d'un tirage** —
notamment le nombre de pixels de contour et le nombre de pixels adjacents à la clé, qui disent
en un chiffre « le fond n'a pas fini de partir ».

### Le format d'accompagnement — ne pas inventer le sien

**Le JSON d'Aseprite**, dont les clés exactes ont été relevées, est le format le plus lu. À
écrire tel quel plutôt que d'en concevoir un : un moteur ouvre alors la planche sans la
remesurer.

---

## Ce que ce relevé n'a pas exploré

- **Les modèles de détourage entraînés sur du dessin** ont été à peine effleurés : `isnet-anime`
  est signalé comme *le seul du lot qui n'ait pas été entraîné sur des photos*, et c'est
  précisément notre cas d'usage — **nos trois modèles viennent tous de la photographie**. Il n'a
  pas été essayé. ⚠️ *Et il porte le doute de droit d'auteur décrit plus haut, § Deux angles
  morts : cette ligne ne se lit pas sans celle-là.*
- ~~**Le cran manquant entre nos deux modèles**~~ — **faux, et vérifié dans le code le
  2 septembre 2026.** Le produit porte **trois** modèles depuis `U13`, dans un catalogue
  structuré — nom, titre, poids relevé, note —, et celui du milieu porte littéralement le titre
  **« intermédiaire »**. Le commentaire du code invoque déjà la règle du dépôt : *« le catalogue
  décide, jamais une liste en dur »*. Ce relevé a été écrit sur une lecture périmée, et l'erreur
  avait déjà été recopiée dans un plan avant d'être trouvée.
  **Ce qui reste vrai de cette ligne** : `birefnet-general-lite`, annoncé à **88,6 Mo** contre
  les **972 Mo** du lourd, est un allégé du **lourd** — pas un cran du milieu. Il n'a pas été
  essayé, et son intérêt est le prix d'entrée : aujourd'hui, essayer le lourd coûte un
  rapatriement de près d'un gigaoctet.
- **Deux pièges d'intégration de rembg** sont signalés sans être vérifiés ici : `normalize()`
  qui ne divise pas par 255, et le comportement d'un masque réduit au Lanczos sur un sprite
  agrandi.
- **Rien de ce relevé n'a été mesuré sur nos propres tirages**, sauf les quatre mesures en tête.
  Les chiffres des bancs extérieurs valent comme ordre de grandeur, jamais comme décision.
