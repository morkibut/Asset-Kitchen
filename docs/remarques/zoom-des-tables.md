# Le zoom des tables de retouche

> **État : tranchée.** Les cinq questions sont arbitrées ; ce qu'il faut construire est au § 7.
> Index : `docs/remarques.md`. Mise en contexte le 3 septembre 2026, sur lecture du code et
> comptage des images du dépôt.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> le zoom dans l'établi doit pouvoir monter a 1500% pas seulement 250%.

---

## 2 · Ce que le produit fait aujourd'hui

L'auteur a raison sur le chiffre, **et il manque le plus gros.**

**Le plafond est écrit en dur.** `ZOOM_MAX = 250`, dans `Tables.tsx:999`. Au-delà, le champ ne
refuse pas — il ramène à 250 — et le bouton « + » se grise. Les boutons montent par seize
arrêts : 1, 3, 6, 12, 25, 33, 50, 66, 75, 100, 125, 150, 175, 200, 225, 250.

**Le défaut caché : « ajusté » passe par le même plafond.** Le bouton promet *« Toute l'image
dans le cadre »*, et le recueil d'explications écrit la même promesse. **Elle est fausse pour
tous les petits sprites.** Sur un cadre de 670 × 742 mesuré dans ce dépôt, il faudrait **972 %**
pour qu'un sprite de 64 px remplisse la place. L'écran en donne 250, et le sprite occupe **6 % de
la surface du cadre.**

**Et ce n'est pas un cas rare.** Comptage des images enregistrées dans `donnees/` : **sur 118
rendus, 73 font 128 pixels ou moins** — 39 en 64 px, 18 en 128, 15 en 96. Donc **pour presque
deux images sur trois, « ajusté » est plafonné et ne fait pas ce qu'il annonce.**

**Conséquence pratique** : la table qui demande le plus de précision — la main, qui repeint pixel
par pixel — offre au mieux **2,5 pixels d'écran par pixel d'image.**

**Ce zoom n'est pas propre à l'établi.** Le même écran s'ouvre depuis la galerie, et une seule
constante commande les deux.

### Où

- `Tables.tsx:998-999` — `ZOOM_MIN = 1` et `ZOOM_MAX = 250`, les deux seules bornes
- `Tables.tsx:1008-1010` — les seize arrêts de « + » et « − »
- `Tables.tsx:1017-1018` — `borner`, qui arrondit et ramène entre 1 et 250 ; tout la traverse
- `Tables.tsx:1338-1345` — **« ajusté » passe par `borner`** : le défaut caché
- `Tables.tsx:1391-1397` — la molette, un cran vaut ×1,09
- `Tables.tsx:979-996` — le commentaire qui justifie la plage : **il n'argumente que le plancher**
- `Tables.tsx:962-965` — le bouton « ajusté » et sa promesse
- `interface/src/aide.ts:763-772` — l'entrée du recueil : « Libre entre 1 et 250 % »
- `interface/src/App.test.tsx:8577-8590` — l'essai qui fige 250 : on tape 900, le champ affiche 250

---

## 3 · Pourquoi c'est comme ça

La plage « 1 à 250 % » vient d'un arbitrage daté et signé — `docs/design-decisions.md:132` et
`docs/tranches/U.md:64-69`, tranchés par l'auteur le 31 août 2026 pendant la tranche `U2`.

**Mais la raison écrite ne porte que sur le plancher.** Avant, la table n'offrait que des crans
entiers — 1×, 2×, 4×, 8×, 16× — et ne descendait jamais sous 100 %, si bien qu'une image
d'origine de 1 024 px dans un cadre de 606 × 626 n'était jamais visible en entier : on n'en
voyait qu'un coin transparent, donc le damier, et la table de recadrage passait pour cassée.
L'arbitrage a libéré le pour cent pour réparer ça.

**Le chiffre 250 n'est justifié nulle part** : ni dans le commentaire du fichier, ni dans la
tranche `U2`, ni dans le journal des décisions. Le critère d'acceptation l'écrit — *« le pour
cent s'écrit à la main entre 1 et 250 »* — sans dire d'où il sort. **C'est un plafond posé, pas
un plafond argumenté.**

---

## 4 · Ce qui borne la solution

**La règle qu'on croirait applicable ne l'est pas, et c'est le point le plus important.**
*« Un multiple entier, et rien d'autre »* — agrandir un sprite d'une fois et demie fabrique des
pixels qui n'existent pas. Mais cette règle est **explicitement bornée** par l'arbitrage du
31 août : elle appartient à ce qui **montre** une image — la grille, la vitrine, le calibrage —,
**jamais à ce qui la travaille**. Elle ne borne donc pas la réponse ici.

| La règle | Ce qu'elle impose |
|---|---|
| **Hors bornes, on ramène — on ne refuse pas** — `Tables.tsx:893-899` | Quel que soit le nouveau plafond, taper au-dessus affiche la valeur retenue, jamais un rejet |
| **La bande fait 38 px et ne grandit pas** | Elle réclame déjà 753 px de libellés pour 840 disponibles à 1 600 de fenêtre. **Aucun contrôle nouveau n'y tient** — il faut travailler dans la fente existante |
| **Aucune largeur ni hauteur inventée** — invariant depuis `E1` | Pas de mesure d'interface neuve |
| **Une explication ne se recopie jamais** — invariant `R4`, étendu en `R8` | Le chiffre 250 est écrit dans le recueil : c'est **là** qu'il se corrige |
| **Le champ suit le zoom effectif, y compris en ajusté** | Déplafonner « ajusté » change le nombre affiché à l'ouverture d'une table sur un petit sprite — de 250 à 972. C'est voulu, et ça se dit |

**Aucun invariant du produit ne parle du zoom.** Le 250 vit dans le journal des décisions, pas
dans les invariants. Le relever est donc **un amendement à une décision datée**, pas une
renégociation d'invariant — ce que le plan interdirait.

---

## 5 · Les pistes

### A · Plafond fixe à 1600 %, arrêts allongés, et « ajusté » va au bout

**Ce que ça fait** — Le champ accepte jusqu'à 1600. Sur un sprite de 64 px, un pixel d'image
devient 16 pixels d'écran : on les compte à l'œil et on les repeint sans viser. Et **« ajusté »
cesse de mentir** : ouvrir la table de la main sur un 64 px l'affiche à 972 % dans le cadre
mesuré, l'image remplit vraiment la place au lieu d'en occuper 6 %. Les boutons gagnent quelques
arrêts au-dessus de 250 — 300, 400, 600, 800, 1200, 1600 — pour ne pas avoir à les marteler.

**Ce que ça coûte** — Petit, interface seulement. Une constante, la liste des arrêts, la phrase
du recueil qui nomme 250, et l'essai qui fige 250. Rien côté Python. Une ligne au journal des
décisions, parce que le 250 y est écrit.

**Le risque** — Le plus gros n'a pas pu être mesuré honnêtement. La mise en page tient : des
boîtes de 960 à 30 720 pixels de côté se posent toutes à la taille exacte demandée, sans erreur.
**Mais la fluidité du dessin n'a pas pu être chronométrée** — le panneau du navigateur bride les
compteurs de temps en arrière-plan. *À vérifier en vrai, à la molette, sur une image d'origine de
1 024 px.* Second risque, plus doux : « ajusté » ouvrant un 64 px à 972 % change l'habitude.

*À la molette, il faut 32 crans pour aller de 100 % à 1500 % au pas actuel ; c'est long mais
utilisable, et le champ reste là pour taper le nombre.*

### B · Un plafond qui dépend de l'image, pas un nombre fixe

**Ce que ça fait** — Le plafond vaut ce qu'il faut pour qu'un pixel d'image fasse **32 pixels
d'écran**, avec un plancher à 250 % pour ne jamais réduire ce qui existe. Un sprite de 64 px
monte alors à 3200 %, un 128 px à 2500 %, une image d'origine de 1 024 px reste à 250 % — parce
qu'à 250 % elle fait déjà 2 560 px et qu'aller plus loin n'apprend rien. **C'est le comportement
des éditeurs de pixel art** : le zoom s'y mesure en pixels d'écran par pixel d'image.

**Ce que ça coûte** — Moyen, interface seulement. Le plafond devient une fonction des dimensions
vues, et `borner` prend un argument de plus, appelée à cinq endroits. Le recueil ne peut plus
nommer un nombre : la phrase devient « jusqu'à 32 pixels d'écran par pixel d'image ». Deux essais
à réécrire.

**Le risque** — **Un plafond qui bouge est plus dur à apprendre qu'un nombre.** On tape 900 sur
une image, on l'obtient ; on tape 900 sur la suivante, on récupère 250, et rien à l'écran
n'explique pourquoi. La règle *hors bornes on ramène* tient toujours, mais elle ramène à une
valeur différente selon l'image — exactement le genre de silence que ce produit s'interdit
ailleurs. Il faudrait une raison écrite sous le contrôle, **et la barre de 38 px n'a pas la
place.**

### C · Ne réparer qu'« ajusté »

**Ce que ça fait** — « ajusté » cesse de passer par le bornage haut. Un 64 px s'ouvre à 972 %, un
128 px à 486 %. Le champ reste plafonné à 250.

**Ce que ça coûte** — Minuscule : une ligne, et un essai.

**Le risque** — **Ça ne répond pas à la demande, et il faut le dire franchement.** Ça répare le
mensonge du bouton, ce qui est nécessaire de toute façon, mais ça laisse une incohérence pire
qu'avant : le champ afficherait 972 en ajusté puis refuserait qu'on retape 972 à la main.
**Cette piste n'a de sens qu'en complément de A, jamais seule.**

### D · Revenir aux crans entiers au-dessus de 100 % — *la mauvaise piste, nommée pour qu'on n'y revienne pas*

**Ce que ça fait** — Libre en dessous de 100 %, doublements au-dessus, jusqu'à 1600 %. Aucun
pixel inventé.

**Le risque** — Elle rouvre exactement ce que `U2` a fermé le 31 août 2026 : l'auteur a tranché
*« le zoom de l'atelier est libre »*, et un essai vérifie explicitement qu'aucun bouton 1×, 2×,
4×, 8×, 16× ne subsiste. Elle réintroduit un saut de facteur deux entre 200 % et 400 %, alors que
la liste d'arrêts a été écrite *« serrée là où l'on règle »*. **On paierait une règle qui, de
l'aveu du dépôt lui-même, ne s'applique pas ici.**

---

## 6 · Ce qui est tranché, ce qui reste ouvert

### Tranché

**La piste B est retenue — 3 septembre 2026.** Le plafond du zoom **cesse d'être un nombre et
devient une règle** : on peut toujours monter jusqu'à ce qu'un pixel d'image fasse **32 pixels
d'écran**, avec un plancher à 250 % pour ne jamais réduire ce qui existe.

| L'image | Son plafond |
|---|---|
| sprite de 64 px | 3200 % |
| sprite de 128 px | 2500 % |
| image d'origine de 1 024 px | 250 % — au-delà elle fait déjà 2 560 px et n'apprend plus rien |

*Le raisonnement retenu* : un pour cent ne veut pas dire la même chose selon l'image, et c'est
la façon dont les éditeurs de pixel art comptent depuis toujours — en pixels d'écran par pixel
d'image, jamais en pour cent de l'image.

**Deux des quatre questions tombent d'elles-mêmes.**
- *Sur quelle table ?* — sans objet : un plafond adapté donne à chaque table ce que son image
  mérite, alors qu'un nombre unique arrangeait forcément l'une aux dépens de l'autre.
- *« Ajusté » doit-il aller au bout ?* — oui, et sans traitement à part : sur un sprite de 64 px
  il demande 972 % pour un plafond de 3200 %, donc il passe. Le mensonge du bouton se répare par
  le même changement.

*Ce que ça déplace ailleurs* : le recueil d'explications ne peut plus nommer un nombre
(`aide.ts:766` dit « Libre entre 1 et 250 % »). La phrase devient une règle — *« jusqu'à
32 pixels d'écran par pixel d'image »*.

**Le plafond mouvant se dit dans le champ, pendant la saisie — 3 septembre 2026.** Tant que le
curseur est dans le champ du pour cent, le suffixe « % » devient « % · max 3200 ». La réponse
arrive exactement où et quand la question se pose, sans qu'il faille survoler quoi que ce soit,
et **elle ne coûte rien au repos** puisqu'elle disparaît dès qu'on sort du champ.

*Elle tient dans la place disponible* : la bande réclame 753 px de libellés pour 840 à 1 600 de
fenêtre, il en reste 87, et « · max 3200 » en fait environ 60.

*Écarté, et pourquoi* — porter la règle **uniquement** dans la bulle au survol : c'est le plus
sobre, mais il faut savoir qu'il y a quelque chose à survoler, ce qui est exactement le reproche
que l'auteur fait ailleurs dans la même séance. *(La bulle se corrige quand même : elle nomme un
plafond de 250 qui n'existera plus.)* Écarté aussi — remplacer le pour cent par un facteur
« ×16 » : ça dissoudrait entièrement le silence, mais ça rouvre l'arbitrage de `U2` qui a libéré
le pour cent, et ça rend bancal tout ce qui est sous 100 % — une grande image à 25 % deviendrait
« ×0,25 ».

### Une conséquence trouvée en tranchant, et qui n'était dans aucune piste

**Le damier alpha ne suit pas le zoom, et c'est écrit exprès** : *« il dit ici c'est transparent,
et cette réponse ne change pas de taille »* (`interface/src/index.css:122-125`). Ses carreaux
font 12 px sur une tuile, 16 en fiche, 24 en aperçu.

**À 3200 %, un pixel d'image fait 32 pixels d'écran** — donc un damier de **2×2 carreaux à
l'intérieur de chaque pixel transparent**. Ce n'est plus un fond, c'est un motif, et la règle du
damier interdit précisément qu'il en devienne un : *« écart volontairement faible entre les deux
tons, pour qu'il ne devienne pas un motif que l'œil suit »*.

**Le plafond adapté rend donc le damier illisible aux forts agrandissements.** Ce n'est pas une
objection à la décision — c'est une conséquence à traiter avec elle.

### Ouvert

1. ~~Chiffre rond ou mesure ?~~ **Tranché.**
2. ~~Sur quelle table ?~~ **Sans objet.**
3. ~~« Ajusté » va-t-il au bout ?~~ **Oui, par construction.**
4. ~~Comment le plafond mouvant se dit-il ?~~ **Tranché.**
5. ~~Que devient le fond aux forts agrandissements ?~~ **Tranché ci-dessous.**

**Le damier suit le zoom, et un quadrillage paraît au-delà d'un seuil — 3 septembre 2026.**

- **Le damier cale ses carreaux sur les pixels de l'image** — un carreau par pixel — au lieu de
  rester à 12, 16 ou 24 px d'écran. Il redevient un fond au lieu de grouiller, et la limite entre
  deux pixels transparents se voit d'elle-même.
- **Au-delà d'un seuil, un trait très sourd sépare chaque pixel.** C'est ce que font les éditeurs
  de pixel art, et c'est ce qui rend le fort agrandissement utile : sans lui, repeindre à la main
  sur un aplat de couleur unie reste du travail à l'aveugle, et l'essentiel de l'intérêt d'être
  monté si haut est perdu.

> ⚠️ **Deux règles écrites sont amendées, et il faut l'écrire là où elles vivent.**
>
> **Une —** *« Il ne suit pas le zoom : il dit ici c'est transparent, et cette réponse ne change
> pas de taille »* (`interface/src/index.css:122-125`). La règle reste vraie **là où elle a été
> écrite** — la tuile, la fiche, l'aperçu, qui montrent une image sans la toucher. Elle cesse de
> valoir sur **les tables**, qui la travaillent. C'est exactement la frontière que l'arbitrage du
> 31 août 2026 a déjà posée pour les multiples entiers : *ce qui montre* contre *ce qui
> travaille*. La règle n'est donc pas cassée, elle est **bornée du même trait qu'une autre l'a
> déjà été.**
>
> **Deux —** *« Une seule texture dans tout le produit, le damier alpha, et elle est
> fonctionnelle »* (`docs/DESIGN.md`). Le quadrillage en est une seconde. **L'argument qui
> autorise le damier autorise le quadrillage** : il ne décore rien, il révèle où est le pixel —
> ce qui est très précisément ce dont on a besoin en repeignant à la main. La règle dit *une
> seule texture* ; sa raison dit *pas de décoration*. C'est la raison qui gouverne.

**Deux choses restent à mesurer avant de coder**, et aucune ne demande un arbitrage :
- **à partir de quel agrandissement** le quadrillage paraît — à l'œil, sur une vraie image ;
- **la fluidité du dessin à la molette** sur une image d'origine de 1 024 px. Elle n'a pas pu
  être chronométrée : le panneau du navigateur bride les compteurs de temps en arrière-plan, et
  tous les relevés sont revenus collés à la même valeur. La mise en page, elle, tient : des
  boîtes de 960 à 30 720 px de côté se posent toutes à la taille exacte demandée.

---

## 7 · Ce qu'il faut construire

Cinq changements, **l'interface seulement**. Aucun appel payant, aucune donnée nouvelle.

1. **Le plafond devient une règle** : jusqu'à 32 pixels d'écran par pixel d'image, plancher à
   250 %. — `Tables.tsx:999`, et `borner` prend un argument de plus (cinq appels)
2. **« Ajusté » cesse d'être plafonné** et tient enfin sa promesse. — `Tables.tsx:1338-1345`
3. **Le champ affiche son maximum pendant la saisie** : « % · max 3200 ». — la fente existante
4. **Le damier des tables cale ses carreaux sur les pixels de l'image.** — `index.css`, une
   classe propre aux tables ; les trois damiers existants ne bougent pas
5. **Un quadrillage très sourd au-delà d'un seuil**, dans les tables seulement

**Trois textes à corriger, parce qu'ils nomment un chiffre qui n'existera plus :**
- `interface/src/aide.ts:766` — « Libre entre 1 et 250 % » devient la règle en pixels par pixel
- `interface/src/App.test.tsx:8577-8590` — l'essai qui fige 250
- `docs/design-decisions.md:132` — l'arbitrage de `U2` reçoit son amendement daté

**Et une note à poser dans `docs/DESIGN.md`** : la frontière *ce qui montre / ce qui travaille*
gouverne désormais trois règles au lieu d'une — les multiples entiers, la taille du damier, et le
nombre de textures.

---

## Ce que cette remarque recoupe

- **La tranche `U2`** (`docs/tranches/U.md:55-200`) : c'est elle qui a posé le 250 et son critère
  d'acceptation, donc c'est elle qu'on amende.
- **Les remarques « appliquer une recette en lot » et « mettre à jour une recette »**, de la même
  séance : elles ne touchent pas au zoom, mais elles touchent **la même barre de 38 px déjà
  saturée**. Si les trois sont traitées, autant décider ensemble de ce que la bande porte.
- **À ne pas confondre :** il existe deux autres zooms dans le produit — celui de la grille
  d'assets (1×, 2×, 4×, qui sont des largeurs de vignette, pas des pour cent) et celui de
  l'aperçu plein écran ouvert à la barre d'espace (plafonné à 16 fois l'ajustement, donc **déjà
  bien au-dessus de 1500 %** sur un petit sprite). Aucun des deux n'est celui dont parle la
  remarque.
