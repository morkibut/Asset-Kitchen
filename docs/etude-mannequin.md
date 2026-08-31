# Le mannequin articulé — étude d'une idée

> **Ce document ne décide rien et n'entre ni dans `docs/PRD.md` ni dans `docs/PLAN.md`.**
> Ouvert le 31 août 2026, à la demande de l'auteur : *que vaut l'idée, est-elle faisable, et
> peut-on la rendre meilleure ?* Aucune ligne de code n'a été écrite, aucune tranche n'a été
> découpée.
>
> Il croise l'idée avec ce que le dépôt sait déjà — les huit vues et leurs directions
> (`atelier/domaine/vue.py`), le mécanisme des images de référence
> (`atelier/domaine/generation.py`), le relevé des fournisseurs gratuits
> (`docs/releve-fournisseurs.md`), le hors-périmètre du produit (`docs/PRD.md`) et la piste
> observée pour l'animation (`docs/archi-versions.md` § 8).

---

## L'idée, telle qu'elle a été posée

Un module en trois dimensions dans l'atelier. On y trouve un personnage humanoïde muni d'un
squelette qu'on articule : on plie le bras, on tourne le buste, on penche la tête. On oriente
ensuite la caméra autour de lui. On enregistre la scène, et on en tire **une image de
référence de posture**. Cette image part ensuite au modèle d'image avec le personnage et une
consigne : *mets ce personnage dans cette posture-là*.

---

## Ce que j'en pense, en trois phrases

**L'idée vise juste, et elle vise un trou réel.** Aujourd'hui une pose est décrite par des
mots ; les mots ne disent pas quelle jambe est devant. C'est le seul endroit du produit où
l'auteur n'a aucun moyen d'être précis.

**Mais elle appartient à l'animation, pas au personnage** — et le dépôt l'a déjà écrit, sans
savoir qu'il parlait de cette idée-ci : *« Squelette, os, interpolation entre deux poses :
c'est l'animation, pas le personnage »* (`docs/PRD.md`, hors-périmètre de la V2). Ce n'est pas
un refus, c'est un rangement : elle est en V3.

**Et tout dépend d'une inconnue qu'on peut lever pour quelques euros, sans écrire une seule
ligne de code.** Rien ne garantit qu'un modèle d'image *obéisse* à une image de posture. Tant
que ce n'est pas mesuré, construire l'éditeur serait payer le plus cher morceau d'interface du
produit sur une supposition. La mesure, elle, tient en une demi-journée.

---

## Pourquoi elle tombe juste

### 1 · Les mots ne savent pas dire une attitude

Une pose, dans le produit, c'est un nom, un nombre d'images et — depuis peu — une consigne en
anglais. Cette consigne vient de corriger le pire : le mot « marche » partait en français au
milieu d'une phrase anglaise, sans direction ni cadrage (`docs/releve-usage.md` § 1).

Elle corrige le pire, elle ne corrige pas tout. Même écrite parfaitement, une phrase ne dit
pas quelle jambe est devant, de combien le buste est tourné, à quelle hauteur est l'épée. Deux
générations de la même phrase rendront deux attitudes différentes — ce qui est sans importance
pour une image seule, et rédhibitoire pour deux images censées se suivre.

**Une image de posture dit tout ça sans un mot, et le dit deux fois pareil.**

### 2 · Le produit fabrique déjà des « pose × direction » — et une scène 3D est exactement une machine à en fabriquer

L'objet central du produit est une matrice : pour chaque personnage, chaque pose dans chaque
direction. C'est ce tableau que le codex montre plein ou vide.

Une scène en trois dimensions est précisément l'objet qui remplit une **ligne entière** de
cette matrice : on articule le personnage une fois, on tourne la caméra autour, et on obtient
les quatre ou huit directions de cette pose-là — **rigoureusement la même attitude vue sous
huit angles**, ce qu'aucune suite de phrases ne saura jamais garantir.

### 3 · Les caméras sont déjà écrites, noir sur blanc, dans le dépôt

C'est le point le plus fort, et le moins visible. Le produit connaît huit manières de regarder
un jeu, et chacune est **déjà une définition de caméra exacte** (`atelier/domaine/vue.py`) :

| La vue du jeu | Ce que c'est, en termes de caméra |
|---|---|
| De face, fixe | droit devant, à hauteur du sujet |
| De côté (plateforme, défilement) | de profil, à hauteur du sujet — et la gauche est le miroir exact de la droite |
| De dessus, verticale | à la verticale, au-dessus de la tête |
| De dessus, stricte | au-dessus, presque à la verticale |
| De dessus, 3/4 | au-dessus, penchée — le compromis de *Zelda* et *Stardew Valley* |
| Oblique (cavalière) | une projection sans point de fuite, où les fuyantes restent parallèles |
| Isométrique | trente degrés au-dessus de l'horizon, sans point de fuite |

Et les directions aussi sont écrites : sud (vers le spectateur), nord (dos tourné), est
(vers la droite), ouest (vers la gauche), plus les quatre obliques quand le jeu en demande
huit.

**Conséquence : l'auteur n'a pas à viser la caméra.** Le projet a déjà déclaré d'où l'on
regarde son monde. Le module n'a qu'à lire cette déclaration et se placer tout seul.

### 4 · Les deux vues que les modèles ratent le plus sont justement celles qu'une image montre sans effort

L'oblique et l'isométrique sont des projections que l'on décrit très mal avec des mots — le
dépôt en a fait l'expérience à l'envers, en retirant de la bible la phrase *quatre orientations*
qui contredisait les consignes de planche et partait avec vingt-huit générations.

Une image de mannequin porte la projection, la direction et l'attitude d'un seul coup, sans
une syllabe. Pour ces deux vues, la posture vaut peut-être moins pour la posture elle-même que
pour l'angle qu'elle impose.

### 5 · Ce n'est pas un pari nouveau — c'est le même pari que la V3, mieux armé

Le dépôt tient une observation faite par accident le 26 août 2026 : un modèle a **recopié la
mise en page de son image de référence** — on lui demandait un sprite, il en a rendu trois
alignés, puis l'appel suivant a reproduit la même disposition. C'est de là que vient
l'hypothèse retenue pour l'animation : *fournir une planche gabarit, huit cases vides, et le
laisser la remplir* (`docs/archi-versions.md` § 8).

Le mécanisme qui rend cette hypothèse crédible — **le modèle reproduit la structure de ce
qu'on lui donne, pas seulement le style** — est exactement celui dont l'idée du mannequin a
besoin. Les deux ne s'opposent pas : elles se composent. Une planche de huit cases **déjà
remplies par le mannequin** donne au modèle la disposition *et* l'attitude de chaque case.

### 6 · Un bénéfice de côté, qui vaut peut-être plus que la posture

L'un des risques nommés de l'architecture est que *« l'échelle du sujet dérive d'une génération
à l'autre »*, avec la mention : **bloque le montage d'animations**. Un mannequin rendu toujours
à la même distance donne toujours la même hauteur de silhouette et le même centrage. Ce n'est
pas promis — c'est le modèle qui dessine, pas nous — mais si la structure est recopiée, le
cadrage l'est aussi.

---

## Ce qui n'est pas acquis, et qui décide de tout

### L'inconnue principale : rien ne force le modèle à obéir

Dans les outils qui tournent sur une machine personnelle, une image de squelette contraint
vraiment le dessin, parce qu'il existe pour cela un mécanisme dédié — un second réseau greffé
sur le premier, qui tient la géométrie pendant que l'autre dessine. **Ce mécanisme n'existe
pas ici.** Le produit passe par des modèles qui reçoivent des images « de référence » : des
images qui *inspirent*. Le modèle est libre d'en tenir compte à moitié, ou pas du tout.

Le domaine le dit lui-même de ses trois rôles actuels : *« ils sont indiscernables sur le
fil »* — trois mots différents, un seul et même tuyau. Une image de posture y entrerait par le
même tuyau que le reste.

**Personne n'a mesuré si ça marche.** C'est la seule chose à savoir avant tout le reste.

### Le risque jumeau : la posture peut déteindre

Une image de référence n'apporte jamais *que* ce qu'on lui demande d'apporter. Le dépôt a déjà
disqualifié un modèle pour la faute exactement symétrique : *la référence de style écrase le
sujet du prompt* (banc du 26 août). Ici le danger est inverse et de même nature : le mannequin
est gris, lisse, sans vêtement ni visage — et le personnage pourrait revenir gris, lisse et
nu.

Il y a de quoi s'en défendre, et c'est déjà à moitié décidé : le 29 août, il a été tranché que
**chaque rôle de réinjection devait écrire sa propre consigne**, réglable dans l'écran des
réglages (`docs/brainstorm-assistance.md`). La consigne d'une posture s'écrit d'elle-même :
*sers-toi de cette image uniquement pour l'attitude et l'angle de vue ; n'en reprends ni les
couleurs, ni les matières, ni l'éclairage.*

### Une place de référence n'est pas gratuite

Chaque image envoyée occupe une place, et les places sont comptées. Le modèle payant par
défaut en accepte seize ; **le seul chemin gratuit ouvert par le relevé du 31 août en accepte
quatre**, chacune ramenée à un maximum de cinq cent douze pixels de côté. Quatre places, et il
en faut déjà pour les artworks officiels du projet, pour la palette quand elle est cochée,
pour l'image qu'on édite.

La posture serait donc, sur ce chemin-là, un arbitrage réel — une place prise à l'univers. Le
produit sait déjà compter et montrer cet arbitrage avant de payer, ce qui est une bonne
nouvelle : le mécanisme n'est pas à inventer.

### Le mannequin ment sur trois choses

- **Les mains et le visage.** Un squelette n'a pas de doigts ni d'expression. Ces deux-là
  restent au texte, et c'est très bien.
- **Les proportions.** Un mannequin réaliste — sept têtes de haut — guidant un sprite en style
  *chibi* — trois têtes — tire dans le sens contraire du style du jeu. Les proportions doivent
  être réglables, et le réglage appartient au projet, à côté de la taille de pixel et de la vue.
- **La profondeur.** Sur une silhouette plate, on ne voit pas quel bras est devant. C'est un
  vrai défaut d'image, et il se corrige au rendu (un ombrage léger, ou une teinte différente
  pour le côté gauche et le côté droit).

---

## Les trois lignes du hors-périmètre que l'idée touche

Le produit tient la liste de ce qu'il a écarté et pourquoi. Trois lignes concernent cette
idée. Aucune ne l'interdit, deux demanderaient d'être réécrites — ce qui, ici, se fait avec une
date et une raison, comme les autres avant elles.

**1. *« Squelette, os, interpolation entre deux poses : c'est l'animation, pas le personnage »***
→ Ce n'est pas un refus, c'est un rangement, et il est juste. L'idée est **en V3**.

**2. *« Mannequin ou silhouette de référence imposée à tous les personnages »***
→ Le mot qui porte l'exclusion est **imposée**. Ce qui était écarté, c'est une silhouette
unique subie par tout le casting. Une posture choisie génération par génération n'est pas cela
— mais c'est assez proche pour que la ligne doive être réécrite plutôt qu'ignorée.

**3. *« Bibliothèque de poses partagée entre projets : le plan appartient au projet qui le
porte »***
→ Là, il y a deux objets différents sous un même mot. Le **plan de poses** — la liste des
attitudes dont *ce jeu-ci* a besoin — appartient bien à son projet. Une **posture** — un jeu
d'angles d'articulations — n'a ni style, ni palette, ni projet : « épée levée » est la même
chez le nain et chez l'elfe. C'est le seul objet du produit qui pourrait légitimement vivre
hors d'un projet. À trancher par l'auteur, pas ici.

---

## Ce que je changerais à l'idée

Rangé du plus décisif au plus accessoire.

### 1 · La caméra ne se vise pas — elle est déjà déclarée

L'idée d'origine dit : *puis on change l'orientation de la caméra*. Je propose l'inverse.

Le projet a déjà dit d'où il regarde son monde et comment il nomme ses directions. Le module
lit cette déclaration et **place la caméra tout seul**, aux angles exacts de la vue choisie. Un
seul geste : *rends les quatre directions de cette posture*. L'auteur oriente librement pour
regarder son mannequin, jamais pour produire.

Trois choses y sont gagnées d'un coup : une caméra visée à la main ne peut plus mentir sur la
direction ; il n'y a plus de « position de caméra » à enregistrer ; et ce qui sort tombe
directement dans les bonnes cases de la matrice, déjà étiqueté.

### 2 · Ce qui sort n'est pas une image — c'est la planche

Le produit sait déjà envoyer plusieurs cases en un seul appel et en diviser le prix. Le
mannequin devrait donc rendre, non pas une image, mais **la planche entière d'une pose** : une
case par direction, à la bonne taille, dans l'ordre que la matrice attend.

C'est aussi, au passage, la réponse à une gêne déjà notée dans `docs/remarques.md` : *« si on
envoie une pose qui contient plusieurs directions, ça doit créer une planche avec les quatre
directions en une génération ; là ça prend la dernière image seulement »*.

### 3 · Ce qu'on enregistre, ce sont les angles — pas l'image

L'idée dit *enregistrer la scène*. Il faut être précis sur ce qu'on garde : **les angles des
articulations**, quelques dizaines de nombres, quelques lignes de texte sur le disque. L'image
n'est qu'un rendu, et un rendu se refait gratuitement, à la bonne taille, sous n'importe quel
angle, dans n'importe quel projet.

C'est ce qui rend une posture corrigeable des mois plus tard, et c'est aussi ce qui la rend
partageable — une posture nommée « épée levée » ou « course, appui gauche » se repose sur
n'importe quel personnage.

### 4 · Deux mots à ne pas confondre, et à fixer tout de suite

Le produit emploie déjà **pose** pour désigner une case du plan du jeu — *marche*, *repos*.
Le mannequin, lui, produit une **posture** — une configuration d'articulations.

Les deux ne sont pas le même objet : une posture *sert* une pose. Employer « pose » pour les
deux empoisonnerait le code, les écrans et les documents en une semaine. Le mot de l'auteur,
*posture*, est le bon : il suffit de le tenir.

### 5 · Le mannequin est un pantin de bois, pas un personnage

L'idée dit *un personnage humanoïde*. Je recommande le contraire : un **pantin d'atelier** —
celui des cours de dessin — construit à partir de formes simples : une sphère pour la tête, des
capsules pour les membres, des billes aux articulations.

Quatre raisons, et elles sont toutes pratiques : aucune question de licence, alors qu'un
personnage tout fait en pose toujours une ; aucune texture ni aucun vêtement à déteindre sur le
résultat ; des proportions réglables, ce qu'on veut de toute façon pour passer du *chibi* au
héros ; et un fichier minuscule, écrit dans le dépôt comme le reste, plutôt qu'un fichier
binaire qu'aucune relecture n'ouvrira jamais.

### 6 · Un quatrième rôle de réinjection : *posture*

Le produit connaît trois rôles pour une image envoyée — référence, source d'édition, guide de
style. Un quatrième dirait ce que ni les autres ne disent : **cette image-ci ne montre ni un
style ni un sujet, elle montre une géométrie**.

Ça tombe dans un chantier déjà ouvert (les rôles doivent écrire des consignes différentes) et
ça rend le journal relisible : six mois plus tard, on saura quelle posture a guidé quelle
image.

### 7 · Le geste qui compte : tirer la main, pas tourner l'épaule

Un éditeur où l'on sélectionne une articulation et où l'on tourne trois anneaux est utilisable,
et c'est le minimum. Un éditeur où l'on **attrape la main et où le bras suit** est agréable —
c'est ce qui fait la différence entre un outil qu'on ouvre et un outil qu'on garde ouvert.

La bonne nouvelle : la bibliothèque de dessin en trois dimensions du navigateur fournit les
deux, sans dépendance supplémentaire. La mauvaise : la seconde demande de décrire chaque
chaîne de membres à la main. C'est un second temps, pas le premier.

### 8 · Et au bout du chemin, l'animation — mais pas tout de suite

Deux postures, la machine calcule celles du milieu : ce sont les images d'un cycle de marche,
et chacune peut être rendue dans les huit directions. C'est le sujet entier de la V3, et c'est
là que le mannequin cesse d'être un confort pour devenir la seule méthode praticable.

**Ce n'est pas une raison de le construire maintenant. C'en est une de mesurer maintenant.**

---

## La marche d'essai qui ne coûte presque rien

Ce que je ferais avant toute chose, et qui ne demande **aucun code nouveau** : le produit sait
déjà importer une image et l'envoyer en référence.

1. Fabriquer trois ou quatre images de posture **à la main, hors de l'atelier** — un pantin
   posé dans n'importe quel outil de modélisation, ou même un croquis, ou une photo.
2. Les faire entrer dans la bibliothèque et les envoyer en référence, avec un personnage déjà
   fait, et une consigne qui dit à quoi elles servent.
3. Générer deux fois la même chose : **avec** et **sans**. Regarder.

Trois questions, et une poignée d'appels payés y répondent :

- **Le modèle obéit-il ?** L'attitude revient-elle, ou est-elle ignorée ?
- **Est-ce que ça déteint ?** Le personnage revient-il gris et lisse comme le pantin ?
- **Quelle forme de pantin obéit le mieux ?** Un pantin gris volumineux, un bonhomme-bâton aux
  membres colorés, ou une silhouette pleine ? Les trois se testent dans la même séance.

Si le modèle n'obéit pas, on a levé l'inconnue la plus chère de la V3 pour le prix de six
images, et l'idée s'arrête là. S'il obéit, on sait ce qu'on construit, et on sait pourquoi.

C'est exactement la méthode qui a fait entrer le personnage dans le produit : *deux essais
payés ont levé les deux doutes qui le retenaient.*

### Où fabriquer les postures de l'essai — relevé du 31 août 2026

Rien à installer pour commencer : ces outils tournent dans le navigateur, et ils sont faits
pour les dessinateurs qui cherchent une référence de pose.

**`posemy.art` — celui par lequel commencer.** Gratuit, dans le navigateur, sur n'importe
quelle machine. On y articule un mannequin, on tourne la caméra librement, on règle la
lumière — et surtout **il exporte les trois formes qu'on veut justement comparer** : le
rendu ordinaire (le pantin gris volumineux), le bonhomme-bâton aux membres colorés, et deux
variantes qui codent la profondeur par la couleur. Les trois formes de l'essai sortent donc
du même outil, sur la même posture : c'est exactement la comparaison qu'on veut, sans biais.

**`zhuyu1997.github.io/open-pose-editor/` — le second avis.** Gratuit et ouvert. Il ne fait
qu'une chose, le bonhomme-bâton coloré et ses variantes de profondeur, mais il la fait avec
plus de contrôle.

**Trois autres de la même famille, si le premier ne convient pas** : `justsketch.me`,
`setpose.com`, `anyposes.com`. Même principe, même gratuité, ergonomies différentes.
`magicposer.com` est le plus libre pour poser à la main, mais une part de ses fonctions est
payante.

**Blender, si l'essai est concluant.** C'est le seul, dans cette liste, où l'on peut poser
une caméra **exactement** : trente degrés au-dessus de l'horizon pour l'isométrique, à la
verticale pour la vue de dessus, sans perspective. Les outils du navigateur ne donnent qu'une
caméra visée à l'œil — largement assez pour savoir si le modèle obéit, insuffisant pour
comparer deux vues sérieusement. Gratuit, mais c'est un logiciel à apprendre : à sortir
seulement quand la première question aura une réponse.

**Et deux chemins à zéro outil**, qui valent d'être essayés parce qu'ils coûtent cinq
minutes : se photographier soi-même dans l'attitude voulue ; ou demander l'image de pantin à
l'atelier lui-même. Le second est séduisant et trompeur — un modèle d'image ne place pas un
bras à l'angle demandé, ce qui est précisément la raison d'être de toute cette idée. Il teste
la contagion de style, il ne teste pas l'obéissance.

**Trois précautions au moment du rendu**, quel que soit l'outil : pas de sol, pas d'ombre
portée, fond uni. Le modèle recopie la structure de ce qu'on lui donne — une ombre au sol est
une structure, et elle reviendra dans l'image. Et une réserve à garder en tête : le
bonhomme-bâton coloré est une convention née d'un mécanisme qui n'existe pas sur ce
chemin-ci. Le pantin gris, lui, se comprend sans convention — c'est un corps. Le classement
attendu est donc *pantin d'abord*, mais c'est une prédiction, et c'est bien pour ça qu'on
mesure.

---

## Ce que ça coûterait à construire, une fois l'essai concluant

**La partie en trois dimensions n'est pas la partie difficile.** Charger un pantin, le
rendre, l'exporter en image : c'est du connu, et le dépôt a déjà bien plus compliqué à son
actif — la toile du tableau d'inspiration, les outils de calque et de découpe au pixel.

**La partie difficile est le geste.** Attraper la bonne articulation du premier coup, la
tourner dans le bon sens, revenir en arrière, ne pas se perdre dans une posture cassée : c'est
là que passe le temps, et c'est ce qui décide si l'outil sert ou prend la poussière. En ordre
de grandeur, un éditeur de ce genre est du même calibre que les plus gros écrans du produit —
pas un après-midi.

Deux points matériels, sans gravité : la bibliothèque de dessin en trois dimensions est une
dépendance de plus, à embarquer dans l'application puisque l'atelier doit tourner sans réseau ;
et le pantin, s'il est construit à partir de formes simples comme proposé plus haut, ne coûte
aucun fichier binaire au dépôt.

---

## Les questions que je laisse ouvertes

Aucune n'empêche de faire l'essai. Toutes se tranchent après lui.

1. **Une posture appartient-elle à un projet, ou à l'atelier entier ?** Le hors-périmètre dit
   aujourd'hui que le plan de poses appartient au projet. Une posture n'a pas de style ; c'est
   le seul objet du produit qui pourrait vivre au-dessus des projets.
2. **Le rendu du pantin devient-il un asset de la bibliothèque ?** Le produit connaît déjà des
   images qu'il dessine lui-même pour les envoyer sans jamais les ranger — la bande de palette,
   le gabarit d'une planche. Une posture rendue est-elle de cette famille-là, ou une image à
   part entière ?
3. **Où se place le module dans les trois lieux du produit ?** L'univers tient ce qui vaut pour
   tout, le codex ce que le monde contient, la galerie ce qui a été produit. Un éditeur de
   posture n'est chez lui dans aucun des trois, et un quatrième lieu serait un retour en
   arrière sur la décision qui vient d'en supprimer quatre.
4. **Le chemin gratuit peut-il servir de brouillon de composition ?** Le plan garde une
   question ouverte : *essayer d'abord gratuitement, puis un seul appel payé*, écartée faute de
   savoir si un modèle gratuit tient assez la composition pour qu'un essai prédise quoi que ce
   soit. Une image de posture change les termes de cette question, puisqu'elle **impose** la
   composition au lieu de l'espérer.
