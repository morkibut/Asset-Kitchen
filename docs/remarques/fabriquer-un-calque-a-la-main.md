# Fabriquer un calque à la main

> **Deux remarques du 4 septembre 2026, et elles partagent ce fichier** : *on ne peut pas zoomer
> dans la superposition* et *la main manque, et ce coin du parcours est à revoir en entier*. Elles
> ont la même cause — **la superposition est un outil inachevé, et personne ne s'en est aperçu
> parce que rien ne s'y compare.** On range par cause, pas par symptôme.
>
> **Ce qu'on appelle un calque, en clair.** Quand on met un casque sur un personnage, l'atelier ne
> range pas « le personnage avec son casque » : il range **le casque seul**, découpé, prêt à être
> reposé sur n'importe quelle image du même personnage. C'est ça, un calque. Il se fabrique en
> comparant deux images — le personnage nu dessous, le personnage casqué dessus — et en gardant
> ce que la seconde a de plus. **L'écran qui fait ça s'appelle la superposition.**

---

## 1 · Ce que l'auteur a écrit — 4 septembre 2026

Trois paragraphes, écrits le lendemain de la livraison de `G16`, en se servant de ce qu'elle
venait d'ouvrir. Le deuxième était un défaut d'affichage, corrigé le jour même ; il n'est pas
repris ici. Restent les deux autres, mot pour mot :

> j'ai encore un petot soucis qu'il faudrait améliorer dans la superposition : je dois pouvoir
> zoomer autant que je veux. c'est un point que j'ai déjà demandé quelque part dans les remarque
> il me semble et qui a peut être même été planifié. car la c'est impossible de découper
> proprement un calque a la main. dans un si petit dessin.

> autre point : je ne peux pas retoucher manuellement les pixel pour remettre ou ôter (la main)
> quand je fait une superposition. en fait c'est pas trop logique ni bien organiser cette partie
> du workflow.

---

## 2 · Ce que le produit fait aujourd'hui

### a) Le zoom n'existe pas sur cet écran — et il n'est pas prévu ailleurs non plus

L'auteur pense à une demande déjà planifiée. **Ce n'est pas la même.** La tranche `G10` — *le zoom
des tables monte* — vise **les tables**, c'est-à-dire les écrans de réglage d'une image, dont le
grossissement est aujourd'hui plafonné à deux fois et demie la taille réelle
([Tables.tsx:999](interface/src/composants/Tables.tsx:999)). La superposition n'est pas une table :
c'est une **fabrique**, avec ses propres panneaux. `G10`, une fois livrée, n'y changerait rien.

Vérifié le 4 septembre 2026 : **la superposition n'a aucun grossissement du tout.** Le cadre de
travail se donne les proportions de l'image du dessous et occupe la place disponible, pas un pixel
de plus ([Superposition.tsx:825](interface/src/composants/Superposition.tsx:825)) ; les deux images
y sont posées *ajustées au cadre*, ce qui veut dire « aussi grandes que la place le permet, et
jamais plus » ([Superposition.tsx:858](interface/src/composants/Superposition.tsx:858) et
[879](interface/src/composants/Superposition.tsx:879)).

**Le produit sait pourtant très bien grossir une image, et de deux façons.** Les tables comptent en
pour-cent, de 1 à 250 ([Tables.tsx:999](interface/src/composants/Tables.tsx:999)). Et l'écran qui
montre une image en grand — celui qu'on ouvre depuis la galerie — a un grossissement **libre**, à
la molette, avec l'image qu'on attrape et qu'on déplace, jusqu'à seize fois l'ajustement, et sa
raison est écrite : *« seize fois l'ajustement suffit à compter les pixels d'un sprite »*
([Apercu.tsx:309](interface/src/composants/Apercu.tsx:309)). **C'est exactement ce que l'auteur
demande, et c'est construit.**

### b) La main existe de bout en bout — sauf l'écran

*« La main »* est le nom que le produit donne au fait de repasser sur une image pour ôter ou
remettre des pixels à la brosse. Sur la superposition, elle est prévue **partout sauf là où on
s'en servirait** :

| L'étage du produit | Ce qu'il porte | Où |
|---|---|---|
| Le domaine — la définition de ce qu'est une superposition | un champ `main`, avec sa raison écrite en toutes lettres | [superposition.py:94](atelier/domaine/superposition.py:94) |
| L'échange avec le serveur | le champ est accepté, validé, transmis | [routes.py:1333](atelier/api/routes.py:1333) |
| Le calcul de l'image | la main est appliquée, et sa raison est écrite : *« un casque sombre sur des cheveux sombres, qu'aucun seuil ne distingue »* | [calque.py:461](atelier/image/calque.py:461) |
| **L'écran** | **rien** | — |

La raison inscrite dans le domaine est nette : *« si le réglage n'est vrai que de cette
superposition, il va dans la superposition »* ([superposition.py:79](atelier/domaine/superposition.py:79)).
Quelqu'un a donc pensé le geste, l'a défini, l'a branché et l'a fait calculer. **Il n'a jamais été
dessiné.**

**Et il y a une trace visible du manque.** Le seul endroit de l'écran qui prononce le mot est le
bouton *Tout défaire ›*, qui remet la main à vide
([Superposition.tsx:636](interface/src/composants/Superposition.tsx:636)) : **le produit propose
d'annuler un geste qu'il ne permet pas de faire.**

### c) Trois endroits fabriquent un calque, et aucun ne ressemble aux autres

C'est le vrai reproche de l'auteur — *« pas trop logique ni bien organisé »* — et il se mesure :

| | Choisir les deux images | Caler l'une sur l'autre | Grossir | La main |
|---|---|---|---|---|
| **La planche d'équipement** — on commande le casque, l'atelier en déduit le calque tout seul | non, c'est la commande qui décide | non | — | non |
| **La carte d'un vêtement** — les trois outils *zone · affinage · retouche* ([Calque.tsx:375](interface/src/composants/Calque.tsx:375)) | non, le corps est celui de la pose | non | **non** ([Calque.tsx:421](interface/src/composants/Calque.tsx:421)) | **oui** |
| **La superposition** | **oui** | **oui** | **non** | **non** |

Aucune des trois n'a de grossissement. La deuxième a la main sans le choix des images ; la
troisième a le choix des images et le calage, sans la main. **Pour faire le travail en entier il
faut passer de l'une à l'autre**, et rien à l'écran ne dit qu'elles se complètent.

### d) ⚠️ Ce que la mesure a trouvé en plus, et qui n'est pas une gêne mais une perte

L'auteur a écrit une seconde raison à la difficulté : *ce qu'on voit ne correspond plus à ce qui
est calculé*. **C'est vrai, et c'est bien pire que ça.**

**Le mécanisme.** Le serveur ne redimensionne pas l'image du dessus pour la faire entrer : il la
**colle telle quelle dans le coin haut-gauche** du cadre du dessous, et jette ce qui dépasse
([calque.py:413](atelier/image/calque.py:413)). C'est un contrat écrit et parfaitement sain *tant
que les deux images sont de tailles voisines* — ce qui a toujours été le cas jusqu'à `G16`. Depuis
`G16`, le dessus peut être **la case telle qu'elle est arrivée du modèle**, et celle-là est bien
plus grande que le corps sur lequel on la pose. **L'écran, lui, la montre entière, rétrécie pour
tenir dans le cadre.** Les deux ne parlent plus de la même image.

**Mesuré le 4 septembre 2026 sur les deux vrais cas du dépôt** — les deux casques du personnage
*balthazar-2*, payés et rangés :

| | La case telle qu'elle est arrivée | Le corps sur lequel on la pose | Ce que le serveur en garde | Ce qu'il reste du casque |
|---|---|---|---|---|
| premier casque | 1024 × 1024 | 253 × 321 | le coin haut-gauche, **7,7 %** de la surface | **rien : 0 pixel sur 214 718** |
| second casque | 1024 × 1024 | 128 × 128 | le coin haut-gauche, **1,6 %** de la surface | **rien : 0 pixel sur 180 876** |

Le dessin du casque commence à 271 pixels du bord gauche dans un cas, 311 dans l'autre ; le coin
gardé s'arrête à 253 et à 128. **Le sujet est entièrement en dehors.**

**Ce que ça donne à l'écran.** Le coin gardé ne contient que du fond beige uni ; comme il ne
ressemble en rien au corps, la comparaison le garde en entier. Le calque qui sort est donc un
**rectangle plein de couleur de fond** — 98 % du cadre rempli dans le premier cas, 98 % dans le
second — sans un pixel de casque. Et le bouton *recaler*, qui propose un calage automatique, calcule
sa proposition sur ce même coin vide : il rend des valeurs d'apparence honnête (une échelle de
0,87, une couverture de 0,91) qui ne veulent rien dire.

**Et c'est le pire endroit possible pour que ça arrive.** Ces deux casques sont précisément les deux
que le produit signale lui-même comme les plus mal revenus — leur défaut principal est enregistré
sous le nom *« échelle au retour »*, avec la gravité maximale. `G16` a ouvert le geste *refaire le
calage à la main* **pour ces cas-là**. Sur les huit pièces d'équipement du dépôt, **deux sont dans
ce cas, et ce sont les deux qui en avaient besoin.**

---

## 3 · Pourquoi c'est comme ça

**Le zoom absent n'est pas un oubli, c'est une hypothèse qui a vieilli.** La superposition a été
dessinée pour *caler* — poser une pièce au bon endroit, à la bonne taille — et pour caler, voir
l'ensemble suffit. Le rectangle qu'on trace pour isoler la pièce était pensé comme un geste large,
pas comme un découpage au pixel. C'est `G16` qui a changé l'usage : en amenant l'auteur à refaire
un calque à la main, elle a transformé un outil de calage en outil de découpe. **L'écran n'a pas
suivi le geste.**

**La main a été écrite au bon endroit, au bon moment, et l'écran est passé après.** Elle appartient
au lot `C4`, celui qui a donné la retouche au pixel sur la carte d'un vêtement ; le champ de la
superposition a été posé en même temps, avec sa règle. Ce qui manque n'est pas la décision, c'est
le dessin. C'est le motif que la version `V3.1` a nommé et compté — *ce qui est construit et jamais
branché* — et c'en est un cas de plus.

**Le découpage du coin est un contrat qui n'a pas été relu quand son monde a changé.** *« Le cadre
du dessous fait loi »* est juste, et la phrase qui l'accompagne — *« ce qui déborde est perdu »* —
était sans conséquence tant que les deux images sortaient de la même planche, donc de la même
taille. `G16` a introduit une image huit fois plus grande sans que personne ne rouvre la phrase.
**Aucun essai ne pouvait le rattraper** : tous ceux de la superposition emploient des images de
même taille.

---

## 4 · Ce qui borne la solution

- **Rien de tout cela ne coûte un centime.** Les trois écrans travaillent sur des images déjà
  payées ; le grossissement, la main et le recadrage se calculent sur place. Tout se vérifie
  serveur coupé, sans fournisseur.
- **Le grossissement ne s'invente pas** : il existe deux fois dans le produit, avec deux réglages
  différents et deux raisons écrites. En ajouter un troisième reviendrait à avoir trois vérités
  sur le même geste. **On en réemploie un.**
- **La main ne s'invente pas non plus** : le champ, la route et le calcul existent. Ce qui manque
  est une surface où tracer, et le produit en a déjà une — celle de la carte d'un vêtement.
- **Le contrat « le cadre du dessous fait loi » ne se renverse pas.** Le calque doit sortir à la
  taille du corps, sans quoi il ne se repose sur rien. Ce qui est en cause n'est pas la loi, c'est
  **le fait de couper avant d'avoir laissé l'auteur choisir ce qu'il garde**.
- **Un écran refait n'est pas un écran neuf.** La superposition porte déjà le choix des deux
  images, le calage, le rectangle, le seuil, l'aperçu des deux sorties et cinq mesures. Ce qui
  s'ajoute doit tenir dans ses panneaux, pas en ouvrir un troisième.

---

## 5 · Les pistes

### A · Le grossissement de l'aperçu, réemployé tel quel

Reprendre le grossissement libre de l'écran « voir en grand » — molette, image qu'on attrape et
qu'on déplace, jusqu'à seize fois l'ajustement — et le poser sur le cadre de travail de la
superposition. Le rectangle continue de se compter en pixels de l'image du dessous ; seul
l'affichage change.

**Ce que ça coûte** — un seul écran touché, et le mécanisme est déjà écrit et éprouvé.
**Le risque** — le tracé du rectangle se fait par un glissement de souris, et attraper l'image
pour la déplacer aussi : les deux gestes se disputent la même main. Le produit a déjà tranché ce
conflit ailleurs, avec un seuil de trois pixels qui sépare un clic d'un glissement
([Apercu.tsx](interface/src/composants/Apercu.tsx)) ; il faudra plutôt séparer par le bouton ou
par une touche.

### B · Le découpage du coin, réparé avant tout le reste

Quand l'image du dessus est plus grande que le cadre du dessous, **la ramener entière au lieu d'en
garder le coin** : la réduire pour qu'elle tienne, et laisser le calage faire le reste. C'est deux
lignes à l'endroit du collage, et ça rend au geste de `G16` les deux seuls cas où il servait.

**Ce que ça coûte** — très peu, et un essai qui emploie enfin deux images de tailles différentes.
**Le risque** — cela change ce que veut dire l'échelle 1 pour ces images-là ; les réglages gardés
sur une superposition déjà faite dans ce cas deviendraient faux. Ils sont deux dans tout le dépôt,
et aucun n'a produit un calque utilisable.

### C · La main, posée sur le cadre de travail

Ajouter à la superposition la brosse *ôter / remettre* de la carte d'un vêtement, écrivant dans le
champ qui l'attend déjà. Rien à changer côté serveur.

**Ce que ça coûte** — un outil à dessiner, mais copié d'un écran voisin ; le bouton *Tout défaire*
cesse d'être un mensonge. **Le risque** — sans la piste A, tracer à la brosse dans un dessin
minuscule est aussi impraticable que d'y tracer un rectangle. **Cette piste n'a de sens qu'après
le grossissement.**

### D · Le coin du parcours, refait en un seul écran

Fondre les trois endroits en un : un seul écran qui choisit ses deux images, les cale, les grossit,
les retouche à la main, et sait d'où on y est entré. C'est ce que l'auteur demande quand il écrit
*« à revoir en entier »*.

**Ce que ça coûte** — beaucoup : trois écrans à retirer, leurs chemins d'entrée à refaire, et une
décision à prendre sur ce que devient la carte d'un vêtement. **Le risque** — c'est une refonte, et
elle demande une maquette avant la première ligne de code. **Elle ne se décide pas dans cette
remarque.**

---

## 6 · Ce qui est tranché — 4 septembre 2026

**Tranché par l'auteur, et il a écarté la recommandation.** Elle proposait de réparer, puis
d'ajouter le grossissement et la main, puis de poser plus tard la question du coin entier.
L'auteur prend l'autre bout : **on dessine d'abord l'écran qu'on veut, et on ne construit A et C
qu'une seule fois, dedans.** La raison tient en une phrase — *ajouter un grossissement et une
brosse à un écran qu'on va refondre, c'est les construire deux fois.*

### a) La réparation part seule, et tout de suite — piste **B**

Elle ne dépend d'aucune maquette : elle ne change pas un pixel de l'écran, seulement ce que le
serveur fait de l'image. **Elle perd du travail déjà payé tant qu'elle n'est pas faite**, et c'est
le seul des quatre points dans ce cas. Elle ouvre la **`V2.4`**, tranche **`M1`**.

### b) Le coin du parcours se dessine avant de se construire — piste **D**

Une maquette de l'écran unique : choisir les deux images, les caler, les grossir, les retoucher à
la main, et savoir d'où l'on y est entré. Elle est la tranche **`M2`** de la `V2.4`. Elle **ne
construit rien** — elle décide ce qui remplace trois surfaces, et ce que devient la carte d'un
vêtement.

### c) Les pistes **A** et **C** sont absorbées, et n'ont plus de tranche à elles

Le grossissement et la main ne se posent plus sur l'écran d'aujourd'hui : ils entrent dans le
dessin de `M2`, et se construisent avec lui. **Aucune des deux ne part en `V3.1`.** C'est
volontairement plus lent à l'arrivée, et une seule construction au lieu de deux.

### Ce qui reste ouvert

- **Où se construit ce que `M2` aura dessiné.** La tranche qui bâtit l'écran ne s'écrit qu'une fois
  la maquette arbitrée — c'est la règle du dépôt, et elle vaut ici plus qu'ailleurs : on ne sait pas
  encore si c'est un écran ou deux.
- **Ce que devient la carte d'un vêtement**, avec ses trois outils. La maquette doit répondre ;
  elle n'a pas à le faire avant d'être dessinée.

---

## Ce que cette remarque recoupe

- **`G10` — le zoom des tables monte.** Voisine, et distincte : elle relève un plafond existant sur
  les tables, celle-ci pose un grossissement là où il n'y en a aucun. Les deux se servent du même
  constat — *on ne peut pas travailler au pixel sur un petit dessin* — et ne touchent pas les mêmes
  écrans. **Elles peuvent se faire ensemble et n'ont pas à se faire ensemble.**
- **`G16` — ce qui est revenu du modèle se voit, et se reprend à la main.** Livrée le 3 septembre
  2026. C'est elle qui a ouvert l'usage d'où sortent ces remarques, et c'est son geste central que
  le découpage du coin annule. **La piste B est, à la lettre, la fin de `G16`.**
- **Le défaut voisin laissé ouvert le 4 septembre** — un calque né d'une superposition s'annonce
  *« corps habillé »* parce que sa recette est vide. Même écran, autre cause ; il attend son tour.
