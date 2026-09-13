# Étude — le halo du détourage, et la sortie du compromis

> **Cette note ne fait foi sur rien.** C'est une étude de technique : elle confronte deux
> étapes classiques de matting à ce que `atelier/image/traitement.py` fait déjà, et dit où
> elles se poseraient. Rien de ce qui suit n'est cadré ni planifié. Quand la piste est
> tranchée, elle part dans `docs/PRD.md` ou `docs/PLAN.md` et ne laisse ici qu'un renvoi.
>
> Écrite le 1<sup>er</sup> septembre 2026. **Aucune mesure n'a été prise** — ni temps, ni
> image, ni appel payé. Tout ce qui suit est de la **lecture de code** : celui du dépôt, et
> celui de la source citée au § 9. C'est dit une fois ici et ça vaut pour toute la note ; le
> § 5 dit ce qu'il faudrait mesurer avant d'écrire une ligne.
>
> Elle se lit **à la demande**, jamais au démarrage d'une session.

---

## En un paragraphe

Le produit tranche aujourd'hui **entre deux défauts** — c'est écrit dans le code, en toutes
lettres : *« Les ronger coûte un liseré de sprite ; ne pas les ronger coûte un halo. Le
réglage existe pour que l'auteur tranche, image par image. »* (`atelier/image/traitement.py`,
docstring de `ronger`). Il existe une troisième voie, et elle est vieille de quinze ans :
**corriger la couleur du pixel de contour avant de durcir**, au lieu de la garder telle quelle
ou de supprimer le pixel. Deux étapes suffisent — un **filtre guidé** et une **estimation du
premier plan** —, elles s'insèrent **entre le modèle de silhouette et `durcir`**, elles
n'atteignent que le moteur `modele`, et elles ne remettent en cause aucun invariant du dépôt.
Elles demandent en revanche une décision de produit qui n'a jamais été prise : **une passe de
détourage a-t-elle le droit de toucher à la couleur ?**

---

## 1 · Le compromis, tel qu'il est écrit dans le code

`_detourer` (`atelier/image/traitement.py:1103`) finit toutes ses branches sur les mêmes
lignes :

```python
alpha = np.minimum(rgba[:, :, 3], neuf)
alpha = durcir(alpha, passe.seuil_alpha)
alpha = ronger(alpha, passe.durcissement)
sortie = rgba.copy()
sortie[:, :, 3] = alpha
```

La dernière est le cœur du sujet : **seul le canal alpha bouge, jamais la couleur.** C'est
vrai de toutes les passes, de tous les moteurs, depuis T2.

`durcir` binarise — opaque ou absent, rien entre les deux. Le dépôt sait déjà exactement ce
que ça produit, et il l'a écrit deux fois : *« Le liseré clair naît du durcissement, pas de la
quantification »* (en-tête de `traitement.py`, précisé le 31 août 2026), et `docs/PIEGES.md` :
*« un pixel de contour à peine visible ressort **opaque, de la couleur du fond** — le liseré
clair autour du sprite. »*

`ronger` est la réponse actuelle : on érode d'un ou deux pixels. Ça marche, et ça coûte
exactement ce que la docstring annonce — le sprite maigrit.

## 2 · Pourquoi le compromis existe : personne ne corrige la couleur

Un pixel de contour semi-transparent porte une couleur **déjà mélangée au fond** — c'est la
définition d'un bord doux. Les deux réglages du produit acceptent cette couleur telle quelle
et ne discutent que de son sort :

| Le réglage | Ce qu'il décide | Ce qu'il coûte |
|---|---|---|
| `seuil_alpha` bas | le pixel passe opaque | un liseré à la couleur du fond |
| `durcissement` ≥ 1 | le pixel disparaît | un sprite d'un ou deux pixels plus maigre |

Aucun des deux ne pose la question qui les dissout : *et si la couleur était fausse ?* Un
pixel de contour couvert à 40 % sur un fond gris clair devrait porter la couleur du sujet, pas
un mélange à 60 % de gris. Corrigée, cette couleur passe `durcir` sans laisser de liseré — et
il n'y a plus rien à ronger.

## 3 · Les deux étapes, et ce qu'elles font

| # | L'étape | Ce qu'elle prend | Ce qu'elle rend |
|---|---|---|---|
| 1 | **Nettoyage par composantes** | la matte du modèle | les îlots sous un seuil d'aire retirés, **et les trous de même taille rebouchés** |
| 2 | **Filtre guidé** (He et al., ECCV'10) | la matte + le RGB d'origine comme guide | la même matte, dont la bande de transition est recalée sur les vraies arêtes de couleur de l'image pleine résolution |
| 3 | **Estimation du premier plan** | la matte + le RGB | le RGB sous les pixels semi-transparents, remplacé par la couleur estimée du sujet seul |

Trois choses valent d'être connues avant de juger la piste.

**Le filtre guidé n'est pas un flou.** Il résout, pour chaque fenêtre, la régression linéaire
qui exprime la matte à partir du guide. Il est **sûr à l'intérieur par construction** : là où
la matte est constante dans la fenêtre, `cov(I,p) = 0`, donc `a = 0`, `b = moyenne(p)`, et la
sortie **est** l'entrée. Il ne peut pas manger un aplat — ce qui est exactement la crainte
qu'un flou mériterait. C'est l'approximation en temps linéaire du laplacien de matting.

**Il répare une perte qui nous concerne aussi.** Le modèle ne voit qu'une réduction à
1024 px ; sa matte est ensuite remontée à la taille de l'image. Cette remontée est floue et
**aveugle au contenu** — elle ne sait pas où sont les arêtes réelles. `rembg` fait la même
chose que la source citée, et le dépôt hérite du même défaut sans l'avoir écrit nulle part.

**L'estimation du premier plan est une moyenne pondérée, pas une devinette.**
`F ≈ flou(α·I, r) / flou(α, r)`, évalué à des rayons qui doublent, en gardant pour chaque
pixel semi-transparent le plus petit rayon qui a assez de support opaque autour de lui. C'est
la version économique de `estimate_foreground_ml` de `pymatting` — que `rembg` sait déjà
appeler sous `alpha_matting=True`, et que le dépôt n'active pas (`traitement.py:337` :
`rembg.remove(image, session=...)`, sans plus).

**Ce que le dépôt a déjà, à moitié.** `nettoyer` (`traitement.py:662`) fait l'étape 1 — mais
seulement les îlots, jamais les trous ; sur réglage explicite (`Bords.aire_min`, nul par
défaut) et non d'office ; et **après** la mise sur grille, quand la question est de faire
disparaître des miettes visibles et non de nettoyer une matte. Les deux ne se remplacent pas.

## 4 · Où ça se pose — et ça ne bouge aucun invariant

Entre `_detourer_modele` (`traitement.py:323`) et le `np.minimum` de `_detourer`
(`traitement.py:1141`). Six vérifications, toutes faites en lisant :

- **L'alpha ne peut toujours que se serrer.** La matte affinée entre dans le `np.minimum`
  comme l'ancienne ; la promesse de `_detourer` — *« L'alpha déjà posé n'est jamais rendu »* —
  tient sans un mot de plus.
- **« Durcir avant la réduction » est intact.** On ajoute **en amont** de `durcir`, jamais en
  aval. Le piège repris de `MySpriteAi` dans `docs/PIEGES.md` ne bouge pas d'un cran.
- **L'ordre fixe des cinq étapes ne bouge pas.** *« Détourage, recadrage, grille,
  quantification, bords. Aucune ne se réordonne »* (`AGENTS.md`, règles durables). Les deux
  étapes se posent **à l'intérieur** du détourage, entre le modèle et le seuil — il n'y a pas
  une sixième étape à ranger quelque part.
- **Elles sont déterministes, et c'est un critère du dépôt.** Ni l'une ni l'autre ne tire quoi
  que ce soit au sort : le filtre guidé est une régression fermée, l'estimation du premier plan
  une moyenne pondérée à rayons fixés. C'est ce qui les sépare du k-means++ de `MySpriteAi`,
  écarté pour cette raison exacte — *« une recette nommée, réappliquée ailleurs, donne
  exactement le même résultat »*.
- **Seul le moteur `modele` est concerné.** `detourer_bord` est un remplissage par plages : il
  rend un masque **déjà binaire**, il n'y a aucune bande douce à recaler. `detourer_couleur` et
  `detourer_trace` non plus. Une passe sur quatre est touchée, et c'est la plus chère.
- **Une seule chose change de nature, et elle est sérieuse.** L'étape 3 **écrit dans le RGB**.
  Aujourd'hui aucune passe ne le fait, et le fait qu'aucune ne le fasse est une propriété
  simple à dire à l'auteur. C'est le § 8.

## 5 · Ce que ça coûte, et ce qu'il faudrait mesurer

**À écrire :** de l'ordre de quatre-vingts lignes de numpy. Le filtre boîte séparable est une
somme glissante — deux passes de tableau, pas de convolution. **Aucune dépendance nouvelle** :
tout tient en numpy, et l'alternative toute faite (`pymatting`) serait plus lourde et plus
lente pour le même résultat.

**Ce qui n'est pas mesuré, et qu'il faut mesurer avant de coder :**

1. Le **temps par image** de 1024 px, sur cette machine, pour les deux étapes — à comparer aux
   0,9 s de `u2net` relevés le 1<sup>er</sup> septembre 2026. Une étape qui doublerait le temps
   d'une passe ne se pose pas d'office.
2. Le **juge**, et il n'est pas automatique : le même asset détouré avec et sans, regardé à
   l'œil sur fond clair **et** sur fond sombre. Le liseré ne se voit que sur l'un des deux, et
   c'est ce qui le rend traître.
3. Le cas qui décide vraiment : **un sujet dont la couleur est proche du fond**. C'est là que
   l'estimation du premier plan a le moins de support opaque autour d'elle, donc le plus de
   chances de se tromper — et c'est exactement le cas où le liseré est le plus visible.

## 6 · Deux prises secondaires, de la même source

Sans rapport avec le halo, trouvées en lisant, et moins chères que lui :

- **`birefnet-general-lite`** — BiRefNet swin_v1_tiny, **224 Mo**, MIT, et `rembg` le connaît
  sous ce nom. C'est le cran qui manque à `SILHOUETTES` (`traitement.py:175`) entre
  l'intermédiaire `isnet-general-use` (178 Mo) et le lourd `birefnet-general` (972 Mo) : la
  qualité de bord de la famille BiRefNet pour un quart du poids. Une entrée de plus dans le
  tuple, rien d'autre — sous réserve d'un relevé de poids et de temps, comme les trois autres.
  **Et à lire avant d'écrire quoi que ce soit** : `AGENTS.md`, sous le titre des projets
  voisins, signale que `../MySpriteAi` fait déjà du détourage BiRefNet. Ce qu'il en sait est
  payé.
- **La licence comme second argument contre `bria-rmbg`.** La source pose une règle nette :
  seuls les modèles MIT / Apache-2.0 reçoivent une adresse de téléchargement automatique ;
  ceux à licence restrictive peuvent être posés à la main, jamais rapatriés par l'outil. Le
  modèle qu'elle cite en exemple est **BRIA RMBG-2.0, non commercial** — c'est-à-dire le
  défaut de `rembg` 2.0.81, celui que `pyproject.toml` écarte déjà, mais **sur la seule
  vitesse** (15,8 s contre 0,47 s). L'argument de licence est le second, il est plus fort que
  le premier, et il manque à la note. À ajouter aussi : le **sha256 épinglé** des modèles — le
  dépôt laisse aujourd'hui `rembg` télécharger sans rien vérifier.

## 7 · Pour quelle version

**Utilisable dès aujourd'hui** — chaque asset détouré par modèle en profite, et la V2 en
produit déjà.

**Mais c'est la V3 qui la rend urgente**, pour deux raisons qui ne se voient pas sur une image
seule :

- **Un liseré fixe devient un liseré qui scintille.** Une bande d'animation multiplie le bord
  par le nombre de cases, et le bruit du contour n'est pas le même d'une case à l'autre : ce
  qui passait pour une imperfection sur un sprite immobile devient un grésillement que l'œil
  suit. Un défaut fixe est un défaut ; un défaut animé est un défaut *qu'on regarde*.
- **`ronger` ne se règle pas case par case dans une bande.** `docs/archive/v3-animation.md` établit que
  les étapes d'une bande se recadrent sur une **boîte commune**, sans quoi le balancement est
  détruit. Un durcissement réglé à la main image par image — ce que la docstring de `ronger`
  propose explicitement — rendrait N silhouettes de tailles différentes dans la même bande. Le
  réglage actuel ne monte donc pas à la V3 : il faut que le bord soit juste **sans** qu'on ait
  à le trancher.

Ce n'est ni cadré ni planifié. La V3 ne commence pas avant que la V2 serve pour de vrai.

## 8 · Ce qu'il faut trancher avant d'écrire une ligne

Trois questions, dont une seule est vraiment ouverte.

1. **Une passe a-t-elle le droit de toucher à la couleur ?** Aujourd'hui non, et c'est net.
   L'étape 3 le demande. C'est la seule question de produit de cette note, et elle se tranche
   dans `docs/PRD.md`, pas ici.
2. **D'office, ou un réglage de plus dans `Passe` ?** Un champ de plus entre dans l'empreinte
   de la recette — donc l'éteindre ou le changer **change le nom du rendu**, comme `masquee`
   depuis U10. Le poser d'office sur le seul moteur `modele` évite ce coût, mais rend toutes
   les recettes existantes autrement qu'avant : c'est là qu'est l'arbitrage.
3. **Que devient `durcissement` si le liseré disparaît ?** Il ne se retire pas — il sert aussi
   à autre chose que le halo. Mais son défaut de 0 cesserait d'être un compromis subi.

## 9 · La source, et la précaution qui va avec

`Ceegore/Ceegor-s-Minimax-M3-Asset-Generation-Pipeline-Tool`, **MIT**. Deux fichiers, et deux
seulement : `src/isnetbg/maskPost.js` (220 lignes) et `src/isnetbg/guidedMatte.js`
(190 lignes). Fonctions **pures** — tableaux typés et nombres, ni ONNX, ni image, ni écran —,
et unit-testées chez elle (`isnetbgMaskPost.test.js`, `isnetbgGuidedMatte.test.js`). C'est ce
qui les rend lisibles et transposables en une séance.

**Le reste de ce dépôt-là ne se reprend pas**, et il faut le dire : ses **propres audits
versionnés** (`hhhhu3.md`, 45 Ko, daté du 2 août 2026) déclarent plusieurs de ses flux de haut
niveau cassés à la tête publiée. On lit deux fichiers purs et on les transpose ; on n'importe
ni son architecture, ni ses choix, ni sa confiance.

Les deux techniques, elles, ne lui appartiennent pas : le filtre guidé est He, Sun et Tang,
ECCV 2010 ; l'estimation du premier plan est la famille de `pymatting`. La source les a
seulement écrites lisiblement, et documenté le piège qui nous concerne — *la matte
suréchantillonnée était écrite telle quelle en alpha, donc les franges à la couleur du fond
survivaient sur chaque image*. C'est notre situation, mot pour mot.
