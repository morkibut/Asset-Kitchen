# Fabriquer un artwork depuis la toile de l'univers

> **De quoi on parle.** Les couleurs d'un jeu ne se saisissent pas : elles se **calculent**, à
> partir des images que l'auteur a promues en **artworks officiels** sur le tableau d'inspiration.
> Pas d'artwork, pas de palette — et le jeu ne parle pas d'une seule voix.
>
> **Que fait-on quand on n'a aucune image à promouvoir ?** L'atelier sait pourtant en fabriquer.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> si l'utilisateur n'a pas d'artwork on doit proposer de créer un artwork avec le générateur
> d'image, mais le user doit avoir la description du personnage quelque part (ca peut être une
> carte de l'univers, la aussi il faudra créer une mécanique dans la toile de l'univers pour générer
> des artwork a partir d'autre artwork ou texte, pouvoir composer des prompt sur mesure et fournir
> différente référence pour demander quelque chose : a noter)

---

## 2 · Ce que le produit fait aujourd'hui

### a) La toile ne fabrique rien : elle reçoit

Il y a **quatre façons pour une carte de naître**, et ce sont quatre collages
([`atelier/api/univers.py`](atelier/api/univers.py)) : coller un fichier, coller une adresse,
coller un texte, ou découper une carte déjà là. **Aucune ne passe par un fournisseur, aucune ne
coûte un centime.** C'est un lieu où l'on dépose ce qu'on a trouvé, pas un atelier de fabrication.

### b) ⚠️ Et il n'y a aucun pont entre ce qu'on paie et ce qui donne ses couleurs

C'est le mur, et il n'était pas dans la remarque.

- **Promouvoir en artwork officiel se pose sur une *carte*** — la fonction qui promeut prend une
  carte, refuse une carte texte, et rien d'autre n'est promouvable
  ([`univers.py:720`](atelier/services/univers.py:720)).
- **Une image fabriquée par l'atelier est un *asset*** : elle vit dans la galerie, pas sur la toile.
- **Aucun geste ne fait passer l'un dans l'autre**, dans un sens ni dans l'autre.

**Donc : une image que l'atelier a fabriquée et payée ne peut pas devenir un artwork officiel.**
Elle ne peut pas donner ses couleurs au jeu. Le seul chemin est de la **télécharger**, puis de la
**redéposer** sur la toile à la main — ce qui produit une seconde copie du même fichier, dont
l'atelier ne saura plus qu'elle vient de lui.

### c) Deux des trois choses que l'auteur croit manquantes existent déjà

**La description du personnage.** L'auteur suppose qu'il faudrait lui trouver une place — *« ça peut
être une carte de l'univers »*. **Elle en a une** : c'est un champ de la chose du jeu elle-même,
qui part dans le texte de chaque appel la concernant, et que le geste *garder cette correction sur
la chose* écrit depuis l'écran de confirmation. Rien à inventer.

**Composer un prompt sur mesure avec plusieurs références.** **C'est ce que le produit fait déjà**,
et c'est même son cœur : la barre qui paie, les images qu'on fait repartir avec l'appel, l'écran qui
montre tout ce qui part et laisse corriger chaque ligne. Rien à inventer non plus.

**Ce qui manque n'est donc ni la description, ni la composition** — c'est **le point d'entrée depuis
la toile, et la sortie vers elle.**

### d) L'entrée manque là où le manque se voit

Quand un projet n'a aucun artwork, l'assistant le dit à l'étape *Références et couleurs*. **Mais la
phrase n'est pas cliquable** — c'est un constat déjà relevé par `G15`, qui veut la rendre agissante.
`G15` propose de *choisir une image de l'univers* ; **elle suppose donc qu'il y en ait une.** Cette
remarque-ci est le cas où il n'y en a pas.

---

## 3 · Pourquoi c'est comme ça

**La séparation est une décision, et elle est bonne.** La toile est *un cadre pour poser des idées* ;
la galerie est *ce qu'on a payé*. Les mélanger ferait de la toile un second endroit d'où l'argent
part, alors que le produit tient à n'en avoir qu'un.

**Mais la palette a été branchée sur le mauvais côté du mur.** Les couleurs du jeu se lisent sur les
artworks, les artworks sont des cartes, et les cartes ne viennent que de l'extérieur. Le jour où
l'atelier a su fabriquer de belles images, personne n'a rouvert la question de savoir si elles
pouvaient donner leurs couleurs.

---

## 4 · Ce qui borne la solution

- **Un seul endroit d'où l'argent part.** Si l'on génère depuis la toile, l'appel doit passer par la
  barre qui paie, pas par un second bouton.
- **La palette se calcule, elle ne se saisit pas.** Ce qui change ici est *quelles images comptent*,
  pas la façon de compter.
- **Une seule grille d'assets dans tout le produit.** Un pont entre galerie et toile ne doit pas
  fabriquer une neuvième surface de choix.
- **Rien ne doit se dupliquer sur le disque.** Le chemin actuel — télécharger puis redéposer — crée
  une seconde copie ; une solution qui ferait la même chose ne serait pas une solution.
- **La description existe et ne bouge pas.** Elle est sur la chose du jeu.

---

## 5 · Les pistes

### A · L'artwork officiel cesse d'être réservé aux cartes

Une image de la galerie peut être promue en artwork officiel, exactement comme une carte. Rien ne
bouge sur la toile, rien ne se duplique, et la palette gagne des images qui viennent de l'atelier.

**Ce que ça coûte** — la promotion et le calcul de palette lisent aujourd'hui des cartes ; il faut
qu'ils lisent les deux. **Le risque** — c'est le plus petit chemin et il ouvre une vraie question :
un artwork officiel a une **famille**, une carte l'a, un asset a autre chose. *À trancher.*
**C'est la piste qui abat le mur sans déplacer la fabrication.**

### B · Un pont : poser une image de la galerie sur la toile

Un geste *poser sur le tableau ›* sur la fiche d'une image. Elle devient une carte, promouvable
comme les autres.

**Ce que ça coûte** — un geste, et une décision sur ce qu'est cette carte : une copie, ou un renvoi
vers l'asset. **Le risque** — une copie duplique le fichier, ce que la contrainte interdit ; un
renvoi crée un troisième genre de carte, à côté de l'image et du texte. *Plus lourd que `A` pour le
même résultat.*

### C · Générer depuis la toile

La barre qui paie s'ouvre depuis une carte ou depuis le vide de la toile, avec les cartes voisines
en références, et ce qui revient se pose en carte.

**Ce que ça coûte** — beaucoup : c'est un second point de départ pour l'argent, avec son écran de
confirmation, ses références, son plan de poses absent. **Le risque** — c'est **la demande de
l'auteur à la lettre**, et c'est aussi ce qui ferait de la toile un atelier. *À ne pas trancher
sans maquette.*

### D · Dire le chemin qui existe

Écrire, là où le manque se voit, qu'on peut fabriquer une image puis la déposer sur la toile.

**Ce que ça coûte** — une phrase. **Le risque** — on documente un détour au lieu de le supprimer,
et le détour duplique un fichier.

---

## 6 · Ce qui est tranché — 4 septembre 2026

**Tranché par l'auteur : `A`, et elle entre dans `G15`, en `V3.1`.**

### a) Une image de la bibliothèque devient promouvable

Elle se promeut en artwork officiel exactement comme une carte, et compte dans la palette de la
même façon. Rien ne bouge sur la toile, rien ne se duplique. **Le mur tombe pour un coût très
inférieur aux deux autres pistes**, sans faire de la toile un lieu de dépense.

### b) Elle entre dans `G15`, et les deux se répondent

`G15` veut rendre agissante la phrase qui annonce l'absence de palette, et *proposer de choisir une
image de l'univers* — ce qui **suppose qu'il y en ait une**. Cette remarque-ci est née du cas où il
n'y en a aucune. Une fois `A` posée, le manque annoncé peut proposer **les deux** chemins : choisir,
ou fabriquer.

### c) Générer depuis la toile reste ouvert, et c'est la demande d'origine

`C` — la barre qui paie ouverte depuis une carte, les cartes voisines en références, le résultat
posé en carte — est ce que l'auteur a écrit à la lettre. **Elle n'est pas retenue maintenant** :
c'est un second point de départ pour l'argent, et ça ferait de la toile un atelier. *Maquette
d'abord, et pas avant que le mur soit tombé — une fois `A` faite, on saura si elle sert encore.*

### d) Deux tiers de la remarque n'ont rien à construire

La description du personnage et la composition d'un prompt sur mesure avec plusieurs références
**existent déjà**. Ce qui manque est de le **dire** — un auteur qui écrit cette remarque ne sait pas
que le produit sait le faire. **C'est le sujet même de `G15`**, qui est la tranche qui dit ce que le
produit fait.

### Ce qui reste ouvert

**La famille d'une image promue.** Un artwork officiel porte une famille, qui décide avec quelles
générations il part. Une carte en a une ; une image de la bibliothèque porte autre chose — un
personnage, une pose, une pièce. *À trancher en construisant `G15`.*

---

## Ce que cette remarque recoupe

- **`G15`** — sans artwork officiel, la palette n'existe pas. Elle veut rendre la phrase cliquable
  et *proposer de choisir une image de l'univers* ; celle-ci traite le cas où il n'y en a aucune.
  **Les deux se lisent ensemble, et `A` est ce qui leur donne une réponse commune.**
- **`G7`** — l'écran de l'univers se refait, et il porte le menu où la promotion vit. Si `A` est
  retenue, la promotion existera à deux endroits : *à faire dire la même chose aux deux.*
- **La remarque voisine du même jour** — *créer une chose du jeu depuis l'univers*, partie en `G7`.
  C'est le maillon précédent de la même chaîne.
