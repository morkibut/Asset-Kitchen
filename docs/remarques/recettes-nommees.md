# Les recettes nommées — les poser en lot, et les mettre à jour

> **État : tranchée.** Les trois questions sont arbitrées ; ce qu'il faut construire est au § 8.
> Index : `docs/remarques.md`. Mise en contexte le 3 septembre 2026, sur lecture du code et
> comptage des 122 images du dépôt.
>
> **Ce fichier porte deux remarques**, parce qu'elles vivent dans le même panneau de 300 px et se
> règlent ensemble.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> si on a fait une recette d'atelier qui marche bien, il fautdrait un moyen de pouvori
> l'appliquer a une selection d'assets ou de pose dans le codex.

> il faut pouvoir mettre a jour une recette de l'atelier, donc ajouter un bouton "mettre a jour"
> en plus de appliqué et oublier.

*Rappel de vocabulaire : une **recette** est le traitement non destructif d'une image — détourage,
recadrage, mise sur grille, palette, bords, contours, main. L'image d'origine ne bouge jamais ;
ce qu'on voit est un rendu recalculé, et il s'efface sans rien perdre.*

---

## 2 · Ce que le produit fait aujourd'hui

### La seconde remarque a une réponse d'une ligne : le bouton existe

Dans le panneau « recettes › », **retape dans le champ le nom exact d'une recette déjà
enregistrée** : « Enregistrer » devient **« Remplacer › »**, une phrase paraît sous le champ —
*« recette 01 » existe déjà, reclique pour la remplacer* — et le second clic remplace.

Ce n'est donc pas un manque, c'est **un geste qu'on ne trouve pas** : il ne se montre qu'une fois
le nom retapé, et rien avant ne dit qu'il existe.

- `interface/src/composants/Tables.tsx:316-320` et `:376`

### Pour la première : une recette se pose sur une image à la fois, jamais sur plusieurs

Le panneau s'ouvre par « recettes › » au bout de la barre des tables et offre quatre gestes :
copier-coller pour la séance, enregistrer sous un nom, appliquer, oublier. **La route du serveur
ne prend qu'un identifiant d'image, jamais une liste.**

- `interface/src/composants/Tables.tsx:266-450` et `:624`
- `atelier/api/routes.py:1097` — un identifiant, pas une liste
- `atelier/services/assets.py:897-921` — `appliquer_nommee`

### La sélection multiple existe — mais pas là où il faudrait

Dans **la galerie**, on coche à Ctrl+clic et on étend à Maj+clic, et la barre d'outils offre
alors quatre gestes de lot : ranger, favori, supprimer, désélectionner — **aucun ne touche à la
recette.** Dans **le codex**, ce qui se coche est une attitude du plan, jamais une image, et
c'est écrit comme une décision, pas comme un oubli.

- `interface/src/App.tsx:1618-1644` — la sélection de la galerie
- `interface/src/composants/BarreOutils.tsx:207-242` — les quatre gestes de lot
- `interface/src/composants/Personnages.tsx:19-25` — la coche du codex porte une attitude

### Un seul balayage existe, et il ne vient pas d'une recette nommée

**« Tout réaligner »** repose la taille de case et la palette du projet sur toutes ses images non
épinglées, sans un appel payant. Il ne touche que **deux des sept places** du traitement, **saute
les images réglées à la main**, et refuse les calques.

- `atelier/services/univers.py:1339-1455`

### Une pièce est déjà en place, et personne ne s'en sert pour ça

**La colonne « Ses sœurs »**, à droite de l'image dans les tables, porte déjà l'ensemble sur
lequel on travaille : la grille filtrée de la galerie quand on vient de là, ou **toutes les
images de la chose du jeu** quand on vient du codex.

- `interface/src/composants/Tables.tsx:1746-1767`, `App.tsx:2273` et `:2599`

### Ce que ça vaudrait, mesuré sur tes 122 images

**61 portent une recette réglée à la main, et parmi elles 45 recettes différentes.** Seules 23
partagent leur recette avec au moins une autre. **Un geste en lot t'aurait épargné 16 poses de
recette sur 61.**

C'est réel mais modeste — et le chiffre sous-estime probablement l'avenir : **tu n'as qu'une
seule recette nommée enregistrée à ce jour.** L'outil vient à peine d'entrer dans ton geste.

*Méthode : chaque `*-asset.json` relu, retiré de chaque recette ce que le serveur retire déjà
quand elle voyage — point de pipette, tracé, cadre, décalage, main —, puis comptage des groupes
identiques.*

---

## 3 · Pourquoi c'est comme ça

Il y a une raison écrite, et elle est précise — `docs/PRD.md:407`, dans la liste des choses
écartées le 1<sup>er</sup> septembre 2026 :

> *« Un troisième geste de voyage, où un traitement suivrait de lui-même toutes les images d'une
> chose du jeu : la palette du projet fait déjà cela pour ce qui la concerne, et un traitement
> qui se poserait tout seul déciderait de l'apparence sans le dire. »*

**Il faut lire les mots.** Ce qui est refusé, c'est un traitement qui suit **de lui-même**, qui se
pose **tout seul**. Ce que l'auteur demande est l'inverse : un geste qu'il clique, sur un ensemble
qu'il voit. **La phrase écartée ne ferme pas cette porte** — elle nomme le danger à éviter.

**Mais le même paragraphe écarte aussi, dans la même phrase, « l'historique des recettes
appliquées » et « le versionnement d'une recette nommée ».** C'est la conséquence lourde : il
n'existe qu'un champ `recette` par image, et « revenir au brut » ramène à l'image nue, pas à la
recette précédente. **Un lot posé sur trente images ne se défait pas.**

- `atelier/domaine/asset.py:57` et `atelier/services/assets.py:839-857`

---

## 4 · Ce qui borne la solution

| La règle | Ce qu'elle impose ici |
|---|---|
| **Une seule grille d'assets dans tout le produit** — ni recherche, ni filtres, ni sélection multiple ailleurs que dans la galerie (`PLAN.md:89`) | Le codex tient la règle en ne cochant que des attitudes. **Le jour où l'on coche une image dans le codex, l'invariant tombe** — c'est écrit en toutes lettres |
| **Un traitement ne se pose jamais tout seul** (`PRD.md:407`) | Le geste doit être cliqué, sur un ensemble visible |
| **Ni historique, ni version d'une recette nommée** (`PRD.md:407`) | **Rien ne défait un lot.** Le compte doit être sur le bouton, pas dans la phrase d'après |
| **Une coordonnée ne voyage pas** — cadre tracé, pipette, forme entourée, passage de main | Le serveur les retire et annonce ce qu'il a laissé. *Bonne nouvelle pour un lot : ce qui est laissé ne dépend que de la recette, jamais de l'image d'arrivée — **une seule phrase suffit pour tout le lot*** |
| **Poser une recette à la main épingle l'image**, et un épinglé est sauté par le balayage de palette | Un lot de trente épinglerait trente images d'un coup. 61 des 122 le sont déjà |
| **Un calque n'est jamais réaligné**, même demandé nommément — il est calé au pixel sur le corps de sa pose | Reposer une grille ferait **glisser le casque de la tête**. Le dossier en contient 4 sur 122 |
| **Aucune confirmation, jamais de « êtes-vous sûr »** (`design-motifs.md:1019`) | Un lot destructeur se dit autrement : le second clic de « Remplacer › », ou la fente d'annulation de la barre d'outils |
| **La barre d'outils de la galerie fait 38 px et déborde déjà** | Mesuré : une image sélectionnée demandait 963 px pour 740 disponibles, et il a fallu séparer deux groupes le 31 août pour que « Supprimer » cesse d'être coupé en plein mot |

---

## 5 · Les pistes

### A · Une ligne de plus dans le panneau : « appliquer · aux 14 sœurs »

**Ce que ça fait** — Tu ouvres une image, tu ouvres « recettes › », et à côté de chaque recette
nommée il y a deux mots au lieu d'un : **« appliquer » et « aux N sœurs »**. N est le compte
exact de la colonne de droite, **celle que tu as déjà sous les yeux**. Après le clic, la phrase du
bas dit « posé sur 14 images » et liste ce qui n'a pas voyagé, **une fois pour tout le lot**. Pour
restreindre, tu poses un filtre dans la galerie, ou tu ouvres depuis le codex.

**Ce que ça coûte** — Une route neuve qui prend une liste, une boucle sur le service existant, et
une dizaine de lignes dans le panneau. **Aucun écran neuf, aucune largeur neuve, aucun bouton
dans la barre d'outils.**

**Le risque** — Trois, dont deux sérieux. **Rien ne défait le lot** : trente recettes réglées à la
main peuvent partir en un clic — le compte doit donc être écrit **sur le bouton**. **Les
calques** : s'ils sont touchés, ils glissent — il faut les sauter et le dire. Et dans la galerie,
« les sœurs » veut dire la grille filtrée entière, **ce qui peut être tes 122 images** : sans
filtre posé, le bouton doit annoncer 122 et non se laisser cliquer distraitement.

*Ne casse aucune règle écrite : ce n'est pas un traitement qui se pose tout seul, c'est un geste
demandé.*

### B · Un cinquième geste sur la sélection de la galerie

**Ce que ça fait** — Tu coches six images à Ctrl+clic, et à côté de « Ranger », « Favori »,
« Supprimer » paraît **« Recette › »** qui déroule tes recettes nommées. C'est le geste le plus
proche de ta phrase, mot pour mot : *une sélection d'assets*.

**Ce que ça coûte** — La même route serveur, plus un menu déroulant sur le modèle de « Ranger »,
qui en a déjà un.

**Le risque** — **La barre de 38 px est déjà trop pleine, et c'est mesuré.** Un cinquième contrôle
dans le groupe qui ne cède jamais aggrave le problème à chaque largeur. Et ce serait **le premier
geste de la galerie qui change l'apparence d'une image**, alors que le pied de l'écran dit noir
sur blanc qu'ici on juge et on range.

### C · Le codex : appliquer aux attitudes cochées

**Ce que ça fait** — Dans l'établi d'un personnage, tu coches trois attitudes comme tu le fais
déjà pour lancer une génération, et un second geste propose de leur poser une recette nommée au
lieu de payer un appel.

**Ce que ça coûte** — Un bouton sous la rangée des attitudes cochées, la même route serveur, et
une règle pour choisir quelle image de la case est visée quand il y en a plusieurs.

**Le risque** — Une attitude porte plusieurs images : le corps, le corps habillé, les calques. Il
faudrait dire lesquelles sont visées, **ce qui redevient une sélection d'images — et cocher une
image dans le codex fait tomber l'invariant « une seule grille dans tout le produit ».** Tenable
seulement si le geste vise *« le corps de chaque attitude cochée »* et le dit, sans jamais montrer
les images une par une.

### D · Étendre le réalignement du projet à une recette entière — *la mauvaise piste*

**Ce que ça fait** — L'univers porterait une recette nommée en plus de sa taille de case et de sa
palette, et « Tout réaligner » la reposerait sur toutes les images non épinglées.

**Le risque** — C'est **exactement** ce que la liste des choses écartées refuse. Et en prime **elle
rate le besoin** : le balayage saute les épinglés, c'est-à-dire les 61 images sur 122 que tu as
justement réglées à la main. Tu voudrais poser une recette sur des images que tu as retouchées ;
ce chemin-là est celui qui les évite.

---

## 6 · Un défaut trouvé en chemin, à réparer **avant** le lot

**Appliquer une recette nommée peut changer un de ses réglages sans le dire.** Vérifié en appelant
la fonction : une recette nommée qui demande *« moteur modèle, bord rongé 0 »*, posée sur une
image qui portait *« moteur bord, bord rongé 0 »*, **arrive avec un bord rongé de 2**.

C'est la règle *« le durcissement suit le moteur »*, écrite pour les tables, qui s'applique aussi
au rappel d'une recette nommée. **Elle contredit un critère d'acceptation** : *« une recette
nommée, réappliquée ailleurs, donne exactement le même résultat »* (`docs/tranches/T2.md:40`).

- `atelier/domaine/recette.py:512-560`

**Ta recette actuelle n'est pas touchée** — elle demande un bord rongé de 2, qui est justement la
valeur livrée du moteur modèle, donc rien ne se réécrit. Mais le jour où tu enregistres une
recette au moteur modèle avec un bord rongé remis à 0, elle ne se rejouera pas telle quelle.

> **Sur une image à la fois, tu le verrais. Sur trente, non.**

---

## 7 · Ce qui est tranché, ce qui reste ouvert

### Tranché

**La piste A est retenue — 3 septembre 2026.** Le lot vise **l'ensemble déjà sous les yeux** : la
colonne « ses sœurs ». Dans le panneau des recettes, chaque ligne gagne deux mots au lieu d'un —
**« appliquer » et « aux N sœurs »** —, où N est le compte exact de cette colonne. Pour
restreindre, on pose un filtre dans la galerie ou on ouvre depuis le codex : **l'ensemble se voit
avant qu'on clique.**

*Ce que ça évite* — la barre d'outils de la galerie ne gagne aucun bouton, alors qu'elle déborde
déjà (963 px demandés pour 740 en sélection, et deux groupes séparés le 31 août pour que
« Supprimer » cesse d'être tronqué). Et la galerie ne devient pas le premier écran où l'on change
l'apparence d'une image, alors qu'elle sert à juger et à ranger.

*Ce que ça prolonge* — la maquette du châssis des tables définit déjà cette colonne et dit sa
raison : *« on règle la même chose sur six images »*. **L'intention était écrite ; elle n'avait
pas de geste.**

**Les images déjà réglées à la main sont sautées par défaut ; un second clic force —
3 septembre 2026.** Le lot ne touche que les images vierges. Pour écraser vraiment, un second mot
paraît — *« et les 9 réglées à la main »* — et c'est un clic de plus, délibéré.

*Le raisonnement retenu* : **rien ne se perd par accident.** C'est le point qui compte le plus,
parce que rien ne défait un lot — pas d'historique, pas de version antérieure, et « revenir au
brut » ramène à l'image nue et non au réglage d'avant.

*Le coût accepté* : deux gestes là où il en faudrait un, et le cas courant — reposer une recette
sur des images qu'on a justement bricolées — devient le cas à deux clics.

*Pourquoi ce n'est pas le comportement du réalignement de palette* : lui saute les épinglés
**sans recours**. Ici le recours existe, il est juste explicite.

### L'écran, tel que l'auteur le voit — 3 septembre 2026

**Le geste ne vit pas dans le panneau des recettes : il vit dans la colonne des sœurs.** C'est
une correction de la piste A, dictée par l'auteur, et elle est meilleure — le panneau des
recettes ne montre aucune image, alors que le geste porte sur des images qu'il faut voir.

**La base.**
1. **La colonne des sœurs gagne un zoom de grille**, pour mieux voir chaque image. *(La barre
   d'espace agrandit déjà une vignette en plein écran ; ce qui manque est de grossir les
   vignettes dans la colonne. Les trois crans de la galerie — 128, 256, 512 — sont déjà des
   jetons du produit.)*
2. **On sélectionne en cliquant** : tout, aucune, ou quelques images.
3. **En pied de colonne, un bouton « appliquer » et un sélecteur de recette.**

**Les deux familles à part, et elles se disent de la même façon.**
4. **Les images déjà retouchées à la main** portent un **liseré orange** au bas de la vignette.
   Une légende en pied, avant le bouton : *« images déjà retouchées à la main, qui seront
   écrasées par la recette »*, avec **un bouton qui désélectionne d'un coup toutes les orange.**
5. **Les calques**, pareil, avec un **liseré rouge** et la même mécanique.

**Ce que ça vaut mieux que ce qui était retenu avant.** Le compte cesse d'être un chiffre à
lire : **il se voit**. On ne se demande plus ce que « aux 5 des 16 sœurs » recouvre, on regarde
les liserés. Et désélectionner en masse remplace le second clic qui force, en plus clair.

> ⚠️ **Deux points à vérifier avant de construire.**
>
> **Un — l'invariant « une seule grille d'assets » ne nomme pas cette colonne.** Il nomme trois
> surfaces qui n'en sont pas — *la matrice d'une chose, la réserve du tableau, la liste des
> dépenses* — et les prive de recherche, de filtre et de sélection multiple (`docs/PRD.md:395`).
> **La colonne des sœurs est arrivée après et n'y figure pas.** Lui donner un zoom et une
> sélection n'enfreint donc aucune règle écrite ; ça étend l'esprit de la règle à un cas qu'elle
> n'avait pas prévu. **À écrire comme un amendement daté, jamais en silence.**
>
> **Deux — « la même mécanique » pour les calques est le seul point qui ne peut pas tenir tel
> quel.** Un liseré orange dit *attention, tu vas écraser* — et on peut vouloir écraser. Un
> calque, lui, **ne peut jamais recevoir de recette** : il est calé au pixel sur le corps de sa
> pose, et lui reposer une grille fait glisser le casque de la tête
> (`atelier/services/univers.py:1391-1404`). Le rouge ne peut donc pas vouloir dire *attention*,
> il doit vouloir dire *impossible* — donc un calque n'est pas sélectionnable, et son liseré est
> une raison, pas un avertissement.

### Ouvert

1. ~~Quel ensemble le lot vise-t-il ?~~ **Tranché ci-dessus.**
2. ~~Qu'arrive-t-il aux images déjà réglées à la main ?~~ **Tranché** — écrasées par défaut,
   désélectionnables d'un coup par leur liseré. *(Remplace la décision « sautées par défaut,
   un second clic force » : la sélection visible fait le même travail, en plus clair.)*
**Le liseré rouge n'apparaît que si la recette choisie décale — 3 septembre 2026.**

L'arbitrage a été rouvert par une question de l'auteur : *« est-ce que si je fais une recette qui
change juste la pixellisation ou le détourage, ça va décaler mon calque ? »* La lecture du code a
montré que **la question posée était mal cadrée : le danger vient de la recette, pas du calque.**

**Ce que le code dit, place par place.**

| La place | Sur un calque |
|---|---|
| **la mise sur grille** | **Elle le décale** — elle rééchantillonne, *« le casque glisserait de la tête »* (`atelier/services/univers.py:1391-1404`). Et elle est **inutile** : un calque *« hérite de la grille et de la palette du corps par construction, puisque ses pixels sont ceux d'une image déjà ramenée dans le cadre de ce corps »* |
| **le recadrage** | **Il le décale** — il recadre sur la boîte du sujet, et la boîte d'un casque n'est pas celle du corps |
| **la quantification** *(la palette)* | **Sans danger.** Elle change des couleurs, jamais des positions |
| **les contours et les bords** | **Sans danger géométrique.** Un contour dessine un trait autour du casque : visible, mais rien ne bouge |
| **le détourage** | **Un autre genre de risque.** Il ne déplace rien, mais sur un calque ce qui est transparent **est** le contenu : un détourage mal réglé peut manger des morceaux du casque |
| **la main, la pipette, le cadre tracé** | Sans objet — **ils ne voyagent pas.** Le serveur les retire et l'annonce |

**Le comportement retenu.** On choisit une recette dans le sélecteur, **et les liserés se
recalculent.** Une recette de palette seule : aucun calque en rouge, ils sont sélectionnables
comme les autres. Une recette qui contient la mise sur grille ou le recadrage : les calques
passent en rouge, **non sélectionnables**, et la légende dit pourquoi — *« 2 calques : cette
recette les décalerait »*.

*Ce que ça n'interdit que ce qui casse vraiment* : reposer une palette sur tous les calques d'un
personnage d'un coup redevient possible, alors que la règle actuelle du réalignement l'interdit
sans raison.

**Et une bonne nouvelle trouvée en vérifiant : un calque ne perd plus son identité.** Ce qui fait
qu'une image *est* un calque n'est pas un drapeau, c'est la soustraction qu'elle porte — *« c'est
la recette qui dit ce qu'une image est »* (`atelier/domaine/recette.py:1085-1094`). Poser une
recette la remettait à `None`, et *« retoucher la grille d'un calque le rendait à sa case,
c'est-à-dire au corps habillé, sans un mot »*. **Réparé le 31 août 2026** en tenant `E5` : la
pose se fait *« par les places, jamais par la recette entière »*, et la soustraction de l'image
d'arrivée est explicitement préservée (`atelier/services/assets.py:800-837`).

---

## 8 · Ce qu'il faut construire

**Le geste vit dans la colonne des sœurs**, pas dans le panneau des recettes.

1. **La colonne des sœurs gagne un zoom de grille.** Les trois crans de la galerie — 128, 256,
   512 — sont déjà des jetons du produit. *(La barre d'espace agrandit déjà une vignette en plein
   écran ; ce qui manque est de grossir les vignettes dans la colonne.)*
2. **On y sélectionne en cliquant** : tout, aucune, quelques-unes.
3. **En pied de colonne : un sélecteur de recette et un bouton « appliquer ».**
4. **Liseré orange** au bas des vignettes déjà retouchées à la main, avec la légende *« images
   déjà retouchées à la main, qui seront écrasées »* et **un bouton qui les désélectionne toutes
   d'un coup.**
5. **Liseré rouge** au bas des calques **que la recette choisie décalerait** — donc recalculé à
   chaque changement de recette —, non sélectionnables, avec leur raison en légende.
6. **Une route serveur qui prend une liste**, là où l'existante ne prend qu'un identifiant. Le
   service qui pose une recette existe déjà : c'est une boucle.
7. **Ce qui n'a pas voyagé se dit une seule fois pour tout le lot** — pipette, cadre tracé,
   passages de main. *La règle du voyage ne dépend que de la recette, jamais de l'image
   d'arrivée.*

**Le bouton « mettre à jour » existe déjà, il se montre mal.** Retaper un nom déjà pris change
« Enregistrer » en « Remplacer › » (`Tables.tsx:316-320`). **À rendre visible sans le retaper** —
c'est un geste qu'on ne trouve pas, pas un geste qui manque.

**Un défaut à réparer avant le lot** — voir le § 6 : appliquer une recette nommée peut réécrire
son durcissement de bord sans le dire. Sur une image on le voit ; sur trente, non.

> ⚠️ **Un amendement à écrire, jamais en silence.** L'invariant *« une seule grille d'assets dans
> tout le produit »* (`docs/PRD.md:395`) nomme trois surfaces qui n'en sont pas — la matrice
> d'une chose, la réserve du tableau, la liste des dépenses — et les prive de recherche, de
> filtre et de **sélection multiple**. **La colonne des sœurs est arrivée après et n'y figure
> pas.** Lui donner un zoom et une sélection n'enfreint aucune règle écrite, mais étend l'esprit
> de la règle à un cas qu'elle n'avait pas prévu. À écrire dans `docs/PRD.md` comme une quatrième
> surface nommée, avec sa raison : *elle ne balaie pas la bibliothèque, elle porte l'ensemble sur
> lequel on règle la même chose.*

---

## 9 · Ce que ça laisse pour plus tard

**Un historique des retouches**, demandé par l'auteur le même jour, *pour bien plus tard*. C'est
son absence qui rend ce lot dangereux : rien ne garde le réglage d'avant. Le jour où il existe,
l'écrasement cesse d'être irrattrapable. Sa ligne est au sommaire.
2. Que doit-il se passer sur une image **qui a déjà une recette réglée à la main** ? Écrasée sans
   rien dire, écrasée en le disant, ou **sautée** comme le fait le réalignement de palette ?
   Aujourd'hui rien ne garde la recette d'avant : **ce choix n'est pas rattrapable.**
3. Les **calques** ne peuvent pas recevoir de recette sans se décaler. Le lot doit-il les sauter
   **en silence**, ou te dire *« 2 calques laissés de côté »* ?
4. Le bouton « mettre à jour » existe, caché derrière le nom retapé. Veux-tu qu'il devienne **un
   troisième mot visible** sur chaque ligne, ou **le champ te suffit-il** une fois qu'on te l'a
   dit ?

---

## Ce que cette remarque recoupe

- **La maquette du châssis des tables** définit déjà la colonne des sœurs à 380 px et dit sa
  raison : *« on règle la même chose sur six images »*. **La piste A prolonge une intention déjà
  écrite**, elle n'en invente pas une.
- **La remarque sur le zoom des tables**, même séance : elle touche **la même barre de 38 px déjà
  saturée**. Si les trois sont traitées, autant décider ensemble de ce que la bande porte.
