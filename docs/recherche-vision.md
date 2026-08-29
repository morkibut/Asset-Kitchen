# Recherche — vision par ordinateur, alignement, différence

> **Ce document ne fait foi sur rien.** C'est une note de recherche : elle confronte des
> techniques de vision par ordinateur à ce que le dépôt fait déjà, et dit lesquelles
> apporteraient quelque chose. Rien de ce qui suit n'est cadré ni planifié. Quand une piste est
> tranchée, elle part dans `docs/PRD.md` ou `docs/PLAN.md` et ne laisse ici qu'un renvoi.
>
> Il se lit **à la demande**, jamais au démarrage d'une session.
>
> Les mesures marquées *(mesuré ici)* ont été prises le 29 août 2026 sur la machine de
> développement, avec le code du dépôt. Tout le reste est de l'analyse, et c'est dit.

---

## En un paragraphe

**L'alignement de calques est déjà fait, et il est fait avec la bonne famille de techniques.**
`atelier/image/calque.py` cherche l'échelle et le décalage par **corrélation croisée en
Fourier** sur les silhouettes — c'est la famille 2 de la question posée (intensité/pixels),
la même que `cv2.phaseCorrelate` et cousine de `findTransformECC`. Les points d'intérêt —
SIFT, ORB, RANSAC — ne sont pas écartés par principe : ils sont **inadaptés à ce qu'on
aligne**, pour quatre raisons dont une est décisive et se mesure. Le deep learning
(SuperPoint, LightGlue, LoFTR) bute sur un invariant d'architecture, pas sur une préférence.

Là où une bibliothèque apporterait vraiment quelque chose, ce n'est pas à l'alignement :
c'est **aux primitives de masque** — `composantes()` est 19× plus lente que
`scipy.ndimage.label` *(mesuré ici)* — et surtout à **la mesure de substitution**, qui est le
seul risque encore ouvert de la V2 et qu'aucun algorithme d'alignement ne corrige, parce que
ce n'est pas un problème d'alignement.

Pour la **V3 — animation**, l'intuition est juste et le terrain est neuf. Mais la bonne
technique n'y est pas non plus ORB : c'est l'ancrage sur une partie qui, par définition, ne
bouge pas.

---

## 1 · Ce que le dépôt fait déjà

Inventaire honnête avant de proposer quoi que ce soit. Tout est en numpy + Pillow, CPU, pur,
sans réseau — l'invariant `docs/ARCHITECTURE.md` §4.4.

| Où | Ce que ça fait | La technique, sous son nom académique |
|---|---|---|
| `calque.py:_recalage` | l'échelle et le décalage qui font retomber le retour sur le corps | **corrélation croisée en Fourier** sur masques binaires, balayage exhaustif de 131 échelles, critère **IoU** (recouvrement / union) |
| `calque.py:_ecart_tolerant` | ce qui a changé de couleur | distance L∞ en RGB, **minimum sur un voisinage 3×3** — un filtre de rang, tolérant au décalage sous-pixel |
| `calque.py:_eroder` | ôter la bordure d'un masque | **érosion morphologique**, connexité 4, élément structurant en croix |
| `calque.py:pinceau` | le passage de la main | rasterisation de polyligne à joints arrondis (`ImageDraw`) |
| `traitement.py:detourer_bord` | le détourage par défaut | **remplissage par plages** (*scanline flood fill*) amorcé sur les quatre bords — la version rapide de `cv2.floodFill` |
| `traitement.py:composantes` | les taches opaques | **étiquetage en composantes connexes**, même remplissage par plages |
| `traitement.py:mesurer_grille` | le pas de pixel art rendu | **autocorrélation** du profil de gradient, avec garde contre les harmoniques |
| `decoupe.py:zones_opaques` | où couper une planche | boîtes englobantes des composantes, fusionnées sous un écart de 2 px |
| `pliage.py:mesurer_lot` | la ressemblance entre deux cases | silhouettes normalisées dans un carré de 64, comparées |
| `palette.py:palette_de` | la palette de l'univers | quantification (sans k-means++, écarté pour son tirage au sort) |

**Ce n'est pas un dépôt qui ignore la vision par ordinateur. C'est un dépôt qui l'a
réimplémentée en numpy**, chaque fois avec une raison écrite dans le code. La question
« pourquoi pas OpenCV ? » se retourne donc en deux questions séparées :

1. **Y a-t-il des capacités que nous n'avons pas ?** — oui, trois, et elles sont en §6.
2. **Ce qu'on a serait-il mieux fait par une bibliothèque ?** — parfois oui, parfois **non**,
   et c'est mesuré en §7.

---

## 2 · Ce qu'on aligne, exactement

C'est le point d'où tout découle, et il est particulier. On n'aligne pas deux photos d'une
scène prises de deux endroits. On aligne :

- **une image qu'on a composée soi-même** (`composer` pose les corps sur une grille dont on
  connaît chaque case, `place_de` dit où exactement) ;
- **contre ce que le modèle en a renvoyé**, redécoupé sur **la même** grille (`cases_de`,
  partagé par les deux sens) ;
- sur du **pixel art quantifié** — médiane 27 couleurs après traitement, aplats, aucun
  anti-crénelage, contours en escalier (`docs/ARCHITECTURE.md` §11) ;
- à une **résolution de travail de 64 à 256 px** de côté, réduite à 128 pour la recherche ;
- où **la seule différence attendue est précisément ce qu'on cherche** : la pièce ajoutée.

Chacun de ces cinq points est hostile aux points d'intérêt. Le dernier l'est mortellement.

---

## 3 · Pourquoi SIFT et ORB ne s'appliquent pas ici

Ce n'est pas un procès des algorithmes — ils sont excellents sur ce pour quoi ils sont faits.
C'est un constat d'inadéquation, et il tient en quatre points.

### 3.1 · Il n'y a presque rien à détecter

SIFT et ORB cherchent des **coins** et des **blobs** : des endroits où le gradient de
l'image varie fortement dans deux directions. Une image de pixel art quantifiée est faite
d'aplats : le gradient y est **nul partout sauf sur les contours**, et un contour est une
arête, pas un coin. Le détecteur de Harris/FAST qui est au cœur d'ORB note un pixel sur la
différence avec ses seize voisins d'un cercle de rayon 3 ; sur un aplat de 27 couleurs, cette
différence est zéro ou saturée, jamais graduée.

Ce qui reste détectable, ce sont les angles de la silhouette et les jonctions entre aplats —
quelques dizaines de points, tous sur des arêtes en escalier, donc tous **instables au
rééchantillonnage**.

### 3.2 · Il n'y a pas assez d'octaves

Les deux détecteurs sont *scale-invariant* parce qu'ils construisent une **pyramide** : ils
répètent la détection sur l'image réduite de moitié, puis du quart, etc. À 64 px de côté — la
taille où le produit regarde ses images — il reste trois niveaux avant de tomber sous 8 px.
L'invariance d'échelle qui fait la valeur de SIFT n'a pas la place de s'exprimer.

### 3.3 · La précision demandée est sous le pixel de grille

C'est le point que le dépôt a **déjà payé**, et il est chiffré dans `docs/PIEGES.md` :

> La plage était `linspace(0.55, 1.85, 66)` — pas de 0,02, et **1,00 n'y tombe pas**. Une case
> revenue rigoureusement identique se retrouvait rééchantillonnée d'un centième, son contour
> se décalait d'un pixel sur tout le tour, et la silhouette entière ressortait en *ajout* —
> **9 % du corps « ajouté » sur une image que personne n'avait touchée.**

Un pipeline ORB → BFMatcher → RANSAC → `findHomography` rend une transformation dont l'erreur
de reprojection typique se compte en **fractions de pixel à quelques pixels**, selon la
qualité des appariements. C'est excellent pour recoller un panorama. Ici, une erreur d'un
pixel sur une image de 64 de côté, c'est **tout le contour du sujet qui bascule en
différence** — exactement le défaut ci-dessus, reproduit par une voie plus chère.

La corrélation en Fourier, elle, évalue **tous les décalages entiers d'un coup** et rend un
entier. Elle ne peut pas se tromper d'un demi-pixel, parce qu'elle ne connaît pas les
demi-pixels. Sur du pixel art, c'est une propriété, pas une limite.

### 3.4 · Le décisif — le point d'intérêt le plus saillant est la pièce

Sur une planche d'équipement, ce qui a le plus de coins, le plus de contraste et le plus de
texture, c'est **le casque qu'on vient d'ajouter**. C'est lui qui produira les meilleurs
descripteurs, et lui qui n'a **aucun correspondant** dans le corps de départ.

RANSAC est fait pour ça — écarter les correspondances aberrantes — mais il tranche par
**consensus majoritaire**, et il n'a aucune notion de ce qu'on cherche. Deux issues, toutes
deux mauvaises :

- la pièce est minoritaire → RANSAC la classe *outlier*, l'alignement est correct, et on a
  payé quatre étages de pipeline pour un résultat que la FFT donne directement ;
- la pièce est saillante et le corps est pauvre en points (le cas normal en pixel art) →
  RANSAC peut retenir un modèle **cohérent avec la pièce**, et l'alignement est faux d'une
  manière plausible, silencieuse, et sans mesure qui le dise.

C'est la famille de défaut que `docs/PIEGES.md` décrit deux fois : *un critère juste qui
répond à une autre question que celle qu'on pose*. Le recalage actuel ne l'a pas, parce
qu'il cherche sur l'**union** — qui pénalise ce qui déborde — et non sur les appariements.

### 3.5 · Et le modèle de transformation est faux, en plus

Point d'ingénierie qui mérite d'être isolé, parce qu'il vaut aussi pour la V3 et la V4.

`findHomography` estime **8 degrés de liberté** : deux translations, une rotation, deux
échelles, un cisaillement, deux termes de perspective. Or on sait par construction que la
transformation réelle en a **trois** : `dx`, `dy`, et une échelle isotrope. On le sait parce
que **c'est nous qui avons composé la planche** — c'est écrit mot pour mot dans `calque.py` :

> Ce qui la rend découpable au retour n'est pas un repère dessiné : c'est que **l'atelier
> connaît la grille qu'il a posée**.

Estimer 8 paramètres quand 3 suffisent, ce n'est pas « plus général » : c'est laisser cinq
degrés de liberté absorber le bruit. Un cisaillement de 0,3° et une perspective de 10⁻⁴
réduisent l'erreur de reprojection sur les points appariés — et **rééchantillonnent toute
l'image en diagonale**, ce qui sur du pixel art détruit la grille avant la comparaison, le
mécanisme exact que `docs/ARCHITECTURE.md` §7 décrit pour l'échelle 0,62.

**Quand on connaît la contrainte, le modèle contraint est plus fort que le modèle général.**
Ce n'est pas une opinion : c'est pourquoi `_recalage` cherche une échelle et deux entiers, et
rien d'autre.

---

## 4 · Les quatre familles, notées contre nos contraintes

| Famille | Représentants | Verdict ici | Pourquoi |
|---|---|---|---|
| **Points d'intérêt** | SIFT, ORB, AKAZE + RANSAC | **Inadapté** | §3 — peu de points, pas d'octaves, précision insuffisante, la pièce pollue les appariements, modèle à 8 DDL pour 3 réels |
| **Intensité / pixels** | `findTransformECC`, `phaseCorrelate` | **Déjà fait, en mieux adapté** | c'est la famille de `_recalage`. ECC apporterait le **sous-pixel** — précisément ce qu'on ne veut pas : `_poser` arrondit exprès, et un warp sous-pixel interpole des couleurs que la quantification interdit |
| **Deep learning** | SuperPoint + LightGlue, LoFTR | **Fermé par un invariant** | PyTorch, GPU, ~2,5 Go. Contre §4.4 (« le post-traitement ne touche jamais le GPU »), contre PRD §Dépendance externe unique (« tout le reste tourne sur la machine, sans réseau »), et contre « un curseur doit répondre instantanément ». Le précédent existe : `rembg` est optionnel **exprès**, pour 180 Mo |
| **Morphologie / masques** | `label`, `distanceTransform`, `floodFill` | **Piste réelle** | §6 et §7 — c'est là que les gains sont, et ils ne sont pas ceux qu'on attendait |

**Une nuance sur ECC, parce qu'elle est le candidat le plus sérieux.** `findTransformECC` en
`MOTION_TRANSLATION` maximise le coefficient de corrélation par descente de gradient : il est
robuste aux changements d'illumination globale, ce que la corrélation brute n'est pas. Mais
il est **itératif** (donc il peut ne pas converger, et il faut un critère d'arrêt), il exige
une initialisation proche, et il rend un `float`. Nos images n'ont aucun changement
d'illumination — le fond est plat, imposé, relevé sur dix-sept images. Le seul avantage
d'ECC ne s'applique pas, et son seul inconvénient — le sous-pixel — nous coûte.

---

## 5 · Le vrai défaut ouvert n'est pas un défaut d'alignement

C'est le point le plus important de cette note, et il coupe court à la tentation.

Le 29 août 2026, six planches payées (`docs/releve-usage.md`) : **le casque est revenu en
poussière, et l'échelle valait 1,00 sur les quatre planches où il figurait.** L'alignement
était parfait. La hache dit les deux moitiés du défaut à elle seule : son fer, qui dépasse de
la silhouette, revient au pixel près ; son manche, là où il croise le bras, ne revient pas.

La cause est écrite et elle est nette :

- ce qui **s'ajoute** occupe des pixels où le corps était transparent → `ajout` le trouve
  entier ;
- ce qui **se substitue** occupe l'empreinte de ce qu'il remplace → `touche`, et `touche`
  compare les couleurs **avec tolérance au voisin de 3×3**, un choix juste qui absorbe le
  résidu de recalage — et la substitution avec.

**Aucun algorithme d'alignement ne corrige ça.** Ni SIFT, ni ECC, ni LoFTR. Mieux aligner une
image déjà alignée à 1,00 ne change rien. Poser OpenCV sur ce problème, c'est traiter un
symptôme qu'on n'a pas.

---

## 6 · Ce qui apporterait vraiment quelque chose

Trois pistes, classées par rapport valeur / coût. **Aucune n'est cadrée.** Les deux premières
répondent au défaut du §5 ; la troisième est du confort mesuré.

### 6.1 · Comparer la structure, pas les valeurs — pour voir la substitution

`_ecart_tolerant` compare des **couleurs** : `max(|ΔR|, |ΔG|, |ΔB|)`, minimum sur 3×3. Un
casque brun qui remplace des cheveux bruns passe sous le seuil, et c'est exactement le cas
observé. Trois façons de regarder autre chose que la couleur :

**a. Corrélation croisée normalisée locale (ZNCC).** Sur une fenêtre glissante de 7×7,
comparer le **motif** plutôt que les valeurs : soustraire la moyenne locale, diviser par
l'écart-type local, corréler. Une texture de cheveux et une coque de casque lisse ont la
même couleur moyenne et une corrélation basse ; un résidu de rééchantillonnage garde une
corrélation haute. C'est précisément le discriminant qui manque.
→ **Se calcule en numpy pur**, en O(n), par images intégrales (somme cumulée 2D) : moyennes
et variances locales en quatre lectures par fenêtre. **Aucune dépendance.**

**b. Distance de chanfrein sur les contours.** Extraire les contours du corps et ceux du
retour, puis, pour chaque pixel de contour du retour, sa distance au contour le plus proche
du corps (`distance_transform_edt`). Un contour neuf est loin de tout ; un contour décalé
d'un pixel est à 1. La tolérance devient **explicite et graduée** au lieu d'être binaire à
3×3.
→ `scipy.ndimage.distance_transform_edt` : **71 ms sur 1024²** *(mesuré ici)*, donc
négligeable à 64–128 px. Réimplémenter l'EDT exacte en numpy est possible mais c'est un
algorithme non trivial (Felzenszwalb–Huttenlocher) — ici, la dépendance se justifierait.

**c. Comparer en luminance séparée de la chrominance.** L'écart actuel traite les trois
canaux à égalité. Une pièce de teinte proche mais de **luminance** différente — un casque
métallique sur des cheveux — se voit mieux sur le seul canal L. Séparer les deux permettrait
deux seuils au lieu d'un.
→ numpy pur, quelques lignes. `atelier/image/palette.py` fait déjà de la manipulation de
couleur ; `domaine/teinte.py` ne porte que des noms et ne concerne pas ce calcul.

**Ce que ces trois-là partagent, et pourquoi c'est la bonne direction** : elles ne demandent
pas au produit de deviner une seconde portée déclarée. `docs/releve-usage.md` pose la
question — « rien ne dit qu'il faille une seconde portée déclarée » — et une mesure qui voit
la substitution y répond sans rien demander à l'auteur. Elle donnerait aussi le **cinquième
chiffre** que le relevé évoque : *la pièce est tombée là où il y avait déjà du corps*.

### 6.2 · Recaler sur la grille du projet, pas sur le pixel

`_recalage` rend `dx`, `dy` entiers en pixels d'image. Mais le corps est peint sur une
**grille de projet** — 7 à 20 px de côté selon le modèle, imposée par le post-traitement. Un
décalage de 3 px sur une grille de 8 n'est pas physique : c'est du bruit de recomposition.

Contraindre le décalage aux **multiples du pas de grille** ferait deux choses :
- l'alignement deviendrait exact au bloc près, donc **la tolérance 3×3 n'aurait plus de
  raison d'être** — et c'est elle qui efface la substitution ;
- la recherche d'échelle pourrait se restreindre aux rapports qui préservent la grille.

C'est le levier le moins coûteux sur le défaut du §5, parce qu'il **retire la cause** au lieu
d'ajouter une mesure. Le pas est déjà mesurable (`mesurer_grille`) — mais attention, ce même
module prévient qu'il « situe un ordre de grandeur » et « prend une harmonique sur les sujets
grossiers ». Ici, il ne faudrait pas le mesurer : **la cible de grille est demandée par le
produit** (US-61), donc elle est connue. C'est encore une contrainte qu'on possède et qu'on
n'exploite pas.

### 6.3 · Chercher l'échelle en deux passes

*Mesuré ici* : `_recalage` coûte **30 ms** sur un corps de 64², **64 ms** au-delà de 128²,
soit 131 corrélations de Fourier par case. Sur une planche de 8 cases : **0,25 à 0,5 s**, et
autant à chaque rejeu du recalage de R5.

Une recherche grossière (pas de 0,05, 27 échelles) suivie d'un affinage local (±0,05 au pas
de 0,01, 11 échelles) coûterait 38 corrélations au lieu de 131 — **3,4× moins**, sans changer
le résultat tant que le critère IoU reste unimodal autour de l'optimum. **Non vérifié** :
l'unimodalité n'a pas été mesurée, et `docs/PIEGES.md` rappelle qu'une recherche discrète
doit contenir son hypothèse nulle — 1,00 devrait rester dans les deux passes.

> **Au passage, une dérive de commentaire.** `calque.py` écrit, à `CADRE_RECALAGE` : « la
> recherche essaie une soixantaine d'échelles ». Elle en essaie **131** depuis la correction
> du 29 août (`linspace(0.55, 1.85, 131)`, pas de 0,01). Le commentaire décrit la version
> fautive.

---

## 7 · Ce qu'une bibliothèque coûterait, et ce qu'elle rendrait

### Le coût, mesuré sur cette machine

| Paquet | Sur le disque | Statut aujourd'hui |
|---|---|---|
| `numpy` + `numpy.libs` | 47 Mo | **dépendance dure**, déjà là |
| `PIL` | 16 Mo | **dépendance dure**, déjà là |
| `scipy` + `scipy.libs` | **113 Mo** | **déjà installé** — tiré par `rembg` |
| `skimage` | 22 Mo | **déjà installé** — tiré par `rembg` |
| `onnxruntime` | 40 Mo | tiré par l'extra `[detourage]` |
| `opencv-python` | non installé | ~40–60 Mo selon la variante — **non vérifié ici** |

**Le fait qui change la discussion** : `rembg 2.0.81` déclare `scikit-image>=0.26` et
`scipy>=1.16.3` en dépendances **dures**. Quiconque a installé l'extra `[detourage]` a donc
déjà **135 Mo de scipy et skimage sur son disque**, sans le savoir et sans les utiliser.
L'argument « scipy coûte trop cher » est donc à moitié faux : il est déjà payé sur le chemin
optionnel. Il reste entier sur le chemin **par défaut**, qui n'a que numpy et Pillow — et
c'est ce chemin-là qui doit continuer de tourner hors ligne.

### Le rendu, mesuré sur cette machine

Masque booléen 1024×1024, 29 taches disjointes :

| Opération | Maison | scipy | Rapport |
|---|---:|---:|---:|
| `composantes()` / `ndimage.label` | **81,5 ms** | **4,3 ms** | **19× pour scipy** |
| `_eroder()` / `binary_erosion` | **0,5 ms** | **6,4 ms** | **13× pour la maison** |
| `distance_transform_edt` | *n'existe pas* | 71,4 ms | capacité neuve |
| `_remplir_depuis_le_bord` | 91,4 ms | — | — |

Trois lectures, et la deuxième est celle qui compte :

1. **`composantes()` est le vrai coût.** 19× plus lente, et elle alloue en plus **un masque
   booléen plein par tache** — 29 tableaux de 1 Mo pour une planche, là où `label` rend un
   seul tableau d'entiers. Elle est appelée par `nettoyer` (à chaque rendu), par
   `zones_opaques` (le slicer) et par `mesurer_calque` (la compacité).

2. **`_eroder()` est 13× plus rapide que scipy, et il ne faut pas y toucher.** Quatre
   décalages de tranches numpy battent l'élément structurant générique de scipy sur ce cas
   précis. C'est la réponse directe à « pourquoi pas plus de bibliothèques » : **parfois le
   code maison est le meilleur**, et il l'est ici parce qu'il ne fait qu'une chose.

3. **`distance_transform_edt` est la seule capacité vraiment neuve** — et c'est celle dont
   §6.1b a besoin.

### La conclusion de coût

Il n'y a **aucun argument pour OpenCV** : tout ce qu'il apporterait ici, scipy le fait, et
scipy est déjà sur le disque de la moitié des installations. Il y a un **argument étroit et
mesuré pour scipy** — `label` et `distance_transform_edt`, deux fonctions — et il se heurte à
une seule chose, qui n'est pas la taille :

> Deux rendus de la même recette donnent le même masque, et c'est un critère depuis T2.

Substituer `ndimage.label` à `composantes()` change potentiellement les résultats aux **bords
et sur les diagonales**. Sur les taches disjointes du banc, les deux ont rendu 7 et 29 taches
— identique — mais des disques qui ne se touchent pas ne prouvent rien sur un alpha réel où
deux sprites se frôlent en diagonale. **Non vérifié**, et c'est ce qu'il faudrait vérifier en
premier : rejouer les deux sur le corpus de `donnees/` et comparer boîte à boîte.

---

## 8 · V3 — l'animation, là où la question est la plus juste

C'est là que l'intuition « aligner proprement pour éviter les glissements » vise juste. Mais
le problème n'est pas celui du calque, et il faut le nommer précisément.

**Le calque aligne A sur B** : deux images du même sujet, dont l'une dérive de l'autre. Il
existe une bonne réponse, et le recouvrement la trouve.

**L'animation aligne N frames sur un point qui n'est dans aucune d'elles.** Un cycle de
marche n'a pas de « bonne » superposition : les bras bougent, les jambes s'écartent,
la silhouette change à chaque frame. Minimiser la différence entre frames consécutives
**supprimerait le mouvement**, ce qui est le contraire du but.

### Le piège central, et il est contre-intuitif

**Un stabilisateur naïf aplatit l'animation.** Le bobbing vertical d'un cycle de marche est
*voulu* : c'est ce qui fait qu'un personnage marche au lieu de glisser. Une corrélation
frame-à-frame qui minimise le décalage le supprimera consciencieusement, et le résultat sera
parfaitement stable et parfaitement mort.

La bonne réponse n'est donc pas de minimiser le mouvement global. C'est **d'ancrer sur ce qui
ne bouge pas par définition** : le point de contact au sol.

### Les techniques, dans l'ordre où je les essaierais

| # | Technique | Coût | Ce qu'elle règle | Ce qu'elle rate |
|---|---|---|---|---|
| 1 | **Ancrage sur ligne de sol** — le pixel opaque le plus bas, sur une bande centrale | 5 lignes numpy | le sautillement vertical, la cause n°1 du « ça saute » | un saut, où le pied quitte le sol |
| 2 | **Ancrage 3×3** — boîte englobante + point d'ancrage choisi (bas-centre, centre, etc.) | déjà prévu §8 | l'alignement standard, celui d'Aseprite et TexturePacker | une frame dont la silhouette déborde d'un côté |
| 3 | **Centroïde de masse alpha** | 2 lignes | recentre robustement, insensible aux extrémités | dérive quand une jambe s'étend — le centroïde suit la masse, pas le corps |
| 4 | **Corrélation de phase entre frames consécutives** — `_recalage` avec `ECHELLES = [1.0]` | **déjà écrit** | la dérive globale accumulée, à ôter *après* avoir gardé le mouvement voulu | rien seule ; c'est un correctif, pas un ancrage |
| 5 | **Ancrage déclaré** — l'auteur pose un point sur une frame, on le propage par corrélation locale | interface | le cas où aucune heuristique ne marche | demande un geste |

**Ce que ça dit du dépôt** : la brique 4 existe déjà, à un tableau près. `_recalage` privé de
sa boucle d'échelles *est* un `phaseCorrelate` entier, et il est meilleur pour cet usage —
parce qu'il rend un entier et que déplacer une frame d'un demi-pixel la rééchantillonnerait.

**La technique qui n'y est pas, et c'est délibéré : les points d'intérêt.** Aligner deux
frames d'un cycle de marche par ORB revient à apparier des points sur un sujet **qui a
changé de forme entre les deux**. Les appariements corrects et les faux sont géométriquement
indiscernables, parce que le sujet s'est réellement déformé. C'est précisément le cas que
RANSAC ne sait pas trancher : il n'y a pas de transformation rigide sous-jacente à retrouver.

### Le découpage de planche

`zones_opaques` trouve déjà des sprites posés n'importe où, et `grille_fixe` découpe une
planche régulière quand l'auteur dit qu'il en a une. Ce qui manque entre les deux : **déduire
la grille d'une planche régulière** quand l'auteur ne la connaît pas.

La bonne technique n'est pas la détection de lignes (Hough) — il n'y a pas de lignes tracées.
C'est **l'autocorrélation du profil d'occupation alpha** : projeter le masque sur l'axe
horizontal, chercher la période des creux. C'est la même méthode que `mesurer_grille`, sur
une autre entrée, et avec la même garde contre les harmoniques — qui est déjà écrite et déjà
payée.

Un **risque connu, et il est dans `mesurer_grille`** : « elle situe un ordre de grandeur ;
elle ne remplace pas l'œil ». Une grille de planche déduite doit donc être **proposée et
montrée**, jamais imposée. Ce qui rejoint la règle du produit : les zones opaques ne bloquent
pas, l'auteur corrige.

---

## 9 · V4 — le tileset

`docs/ARCHITECTURE.md` §9 annonce déjà « recalage sur grille, découpe, assemblage, aperçu de
raccord », et note le comportement mesuré chez SpriteCook : aux petites tailles, le modèle
génère plus grand, puis on recale et on découpe.

Deux remarques seulement, parce que rien n'est ouvert ici :

- **Le recalage sur grille de §6.2 est le même besoin**, et il arriverait deux fois si on ne
  le fait pas une fois. Une tuile mal recalée d'un pixel produit un raccord visible sur tout
  le bord — le même mécanisme que le contour qui bascule en différence.
- **L'aperçu de raccord est une mesure, pas seulement un rendu.** La continuité d'un bord se
  chiffre : l'écart entre la colonne droite d'une tuile et la colonne gauche de sa voisine.
  C'est trois lignes de numpy, et ça donne un nombre par paire de bords — donc un moyen de
  montrer *quel* raccord est faux, au lieu d'en laisser l'œil le chercher sur un damier.

---

## 10 · Ce que cette note n'a pas mesuré

À dire, sinon elle vaut moins qu'elle n'en a l'air.

- **L'unimodalité du critère IoU** en fonction de l'échelle. §6.3 en dépend entièrement.
- **L'équivalence de `composantes()` et `ndimage.label`** sur un alpha réel — les disques
  disjoints du banc ne prouvent rien sur des sprites qui se frôlent en diagonale.
- **Le gain réel de la ZNCC locale sur la substitution.** L'argument est structurel et il est
  bon ; il n'a pas été essayé sur le casque du 29 août, qui est pourtant sur le disque et
  qui est le seul juge.
- **Le coût d'opencv-python** — annoncé d'après la mémoire, pas d'après une installation.
- **Tout ce qui concerne la V3** : aucune frame d'animation n'existe encore dans le dépôt.
  Le tableau du §8 est de l'analyse, et son ordre est une opinion argumentée, pas un résultat.

---

## 11 · Si une seule chose devait être essayée

**Rejouer le casque du 29 août avec la tolérance 3×3 remplacée par une ZNCC locale 7×7, dans
la seule zone déclarée de la pièce.** Les six planches sont payées, elles sont sur le disque,
et R5 permet de rejouer un recalage sans un centime. C'est un essai qui ne coûte rien, qui a
un juge non ambigu — le casque revient-il en calque ou en poussière ? — et qui répond au seul
risque encore ouvert de la V2.

Tout le reste de cette note peut attendre ce résultat.
