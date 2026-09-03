# « Ce que la palette lit » est incompréhensible

> **État : tranchée.** Ce n'est pas un défaut d'explication : **sur quatre des neuf artworks de
> l'auteur, la phrase affichée se contredit elle-même** — elle annonce un reste qui n'existe pas,
> puis invite à aller voir en magenta une image où rien ne serait magenta. La cause est une
> condition posée sur un seul bout d'une échelle qui en a deux.
>
> **Mais l'arbitrage n'a pas retenu cette réparation.** L'auteur a redressé la question : le bloc
> n'est pas mal expliqué, **il est mal placé** — une mécanique de calcul au milieu d'une surface
> dont le métier est de faire naître des idées. Il quitte la toile et part du côté des palettes.
> Voir le § 6, qui garde la question mal posée pour ce qu'elle apprend.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> sur un artwork de la toile de l'univers, il y a "Ce que la palette lit" et un bouton regarder qui
> affiche du texte. c'est tellement technique et pas expliqué, que même moi qui suis en trai nde
> créé l'app, j'ai pas réussi a comprendre ce que c'est réellement et a quoi ca sert.

---

## 2 · Ce que le produit fait aujourd'hui

### Ce que le bloc montre

Sur une carte **promue en artwork officiel**, le menu porte un bloc *« Ce que la palette y lit »*
avec un bouton *regarder*
([`Tableau.tsx:1193`](../../interface/src/composants/Tableau.tsx#L1193)). Au clic, le serveur mesure
et l'écran écrit l'une de deux phrases :

| Quand | Ce que l'écran écrit |
|---|---|
| `entiere` | *« Rien n'a été mis de côté : l'image entière donne ses couleurs. C'est ce qui arrive à une matière ou à une texture, qui n'ont pas de fond. »* |
| sinon | *« **X %** de l'image donne ses couleurs au jeu. Le reste — le fond — est écarté tout seul. »* |

Et, dans le second cas seulement, une troisième ligne : *« Découper le montre en magenta, sur
l'image en grand. »*

### La phrase se contredit sur quatre des neuf artworks du dépôt

Mesuré le 3 septembre 2026 sur **tous les artworks officiels des projets de l'auteur**, par le
service lui-même :

| Projet | l'image | part lue | `entiere` | la phrase affichée |
|---|---|---|---|---|
| test-v2 | 411 × 185 | **100,0 %** | non | *« 100 % … Le reste — le fond — est écarté »* |
| test-v2 | 400 × 182 | **100,0 %** | non | *idem* |
| essai-animation | 930 × 655 | 91,4 % | non | juste |
| essai-animation | 478 × 727 | **100,0 %** | non | *« … Le reste … »* |
| coeur-de-pierre-01 | 1024 × 1038 | 30,3 % | non | juste |
| coeur-de-pierre-01 | 1010 × 1024 | 59,8 % | non | juste |
| bac-a-sable | 672 × 84 | 37,6 % | non | juste |
| bac-a-sable | 1122 × 1402 | 40,5 % | non | juste |
| bac-a-sable | 1122 × 1402 | 37,8 % | non | juste |

**Quatre artworks sur neuf sont à 100 %**, dont **les deux du projet du pèlerin** — celui que
l'auteur ouvre le plus souvent. Pour eux, l'écran affiche :

> **100.0 %** de l'image donne ses couleurs au jeu. **Le reste — le fond — est écarté tout seul.**

**Il n'y a pas de reste.** Cent pour cent est passé, rien n'a été écarté, et la phrase nomme un fond
mis de côté qui est vide. Puis la ligne suivante invite à aller voir *« en magenta »* une image où
**rien ne serait magenta**.

C'est très probablement le chemin exact qui a produit la remarque : lire une phrase qui s'annule
elle-même, aller vérifier ailleurs, ne rien voir, et conclure qu'on n'a pas compris.

### La cause : une condition posée sur un seul bout d'une échelle qui en a deux

Une seule ligne décide laquelle des deux phrases paraît
([`univers.py`](../../atelier/services/univers.py), `lecture_de_palette`) :

```
"entiere": part == 0.0,
```

`part` est **la part gardée**, en pour cent
([`palette.py`](../../atelier/image/palette.py), `part_lue`). L'échelle a donc deux extrémités, et
**les deux veulent dire « rien n'a été mis de côté »** — pour deux raisons opposées :

- **`part = 0`** — le détourage a tout mangé, il ne reste rien à mesurer, donc **la palette reprend
  l'image entière**. Le domaine le dit en toutes lettres : *« Zéro n'est pas un trou, c'est un cas
  nommé […] L'appelant qui affiche ce chiffre doit dire cette phrase-là plutôt que "0 %", qui serait
  faux. »*
- **`part = 100`** — le détourage n'a rien trouvé à retirer : **l'image entière donne ses couleurs**,
  et pour de bon.

Le premier cas a été vu, nommé, documenté et traité. **Le second ne l'a jamais été** — et c'est le
seul des deux qui se produise réellement dans le dépôt : `entiere` est **faux sur les neuf**
artworks, et la moitié d'entre eux sont à l'autre bout.

### L'image existe, elle marche, et elle vit dans un autre écran

L'image en magenta n'est pas un projet : elle est **construite, servie et affichée** — mais ailleurs.

- Le serveur la rend : `apercu_de_palette` → *« L'image, avec en magenta ce que la palette en écarte.
  Un PNG. »*
- La route existe : `GET /board/{carte}/palette/image`
  ([`univers.py:593`](../../atelier/api/univers.py#L593)).
- Le client la sait appeler : `apercuDeLaLecture`
  ([`api.ts:3354`](../../interface/src/api.ts#L3354)).
- **Et un seul écran l'affiche** : la découpe, derrière une bascule *magenta*
  ([`Decoupe.tsx:261`](../../interface/src/composants/Decoupe.tsx#L261)).

Le bloc qui pose la question ne montre donc pas la réponse — il envoie la chercher. **Le chemin
complet fait cinq gestes** : ouvrir le menu de la carte, cliquer *regarder*, lire un pour cent,
lire une phrase qui renvoie à *Découper*, ouvrir la découpe, trouver la bascule magenta.

### Et le recueil promet l'image que le bloc ne montre pas

L'entrée `carte.lecture` **est bien accrochée** au bloc — ce n'est pas une explication manquante, et
son texte long est l'un des meilleurs du recueil. Mais sa toute première ligne, celle qui répond à
*« qu'est-ce que c'est ? »*, dit ([`aide.ts:338`](../../interface/src/aide.ts#L338)) :

> La part de cet artwork qui donne ses couleurs au jeu — **et l'image avec, en magenta, ce qui a été
> mis de côté.**

**Le bloc ne montre aucune image.** L'explication annonce donc une chose que l'écran ne fait pas, ce
qui est exactement ce qu'il ne faut pas faire à quelqu'un qui ouvre une explication pour comprendre
un écran.

### Le titre nomme un calcul, quand le bloc répond à une inquiétude

Le texte long de l'entrée dit ce que le bloc sert vraiment à faire :

> C'est vrai depuis toujours, mais rien ne le montrait — d'où la question qui revenait à chaque
> promotion, **« est-ce que mon fond va polluer mes couleurs ? »**. Non.

Voilà l'objet du bloc : **rassurer sur une inquiétude précise**. Son titre, lui, annonce une
opération — *« ce que la palette y lit »* —, son bouton dit *regarder* sans dire quoi, et sa réponse
est un pour cent. L'auteur a raison de le trouver technique : **il est nommé d'après ce qu'il
calcule, pas d'après ce qu'il répond.**

### Ce que ça coûte, et la note du code est optimiste

La route explique pourquoi il faut cliquer : *« elle coûte une centaine de millisecondes »*
([`univers.py:584`](../../atelier/api/univers.py#L584)). Mesuré sur les vraies images :

| L'image | le pour cent | l'image en magenta |
|---|---|---|
| 400 × 182 | **17 ms** | 39 ms |
| 930 × 655 | 125 ms | 255 ms |
| 1024 × 1038 | 198 ms | 315 ms |
| 1122 × 1402 | **913 ms** | **1 231 ms** |

La centaine de millisecondes vaut pour une image moyenne. Sur les plus grandes du dépôt, c'est
**neuf fois plus**. Le clic reste donc justifié — mais c'est encore une mesure écrite dans une phrase
que rien ne relit, le troisième cas de la semaine après les 300 px du menu de carte et le poids de
l'univers dans le prompt.

---

## 3 · Pourquoi c'est comme ça

**Parce que le cas rencontré n'est pas celui qui avait été prévu.** Le zéro a été pensé avec soin —
il a son nom, sa phrase, son commentaire dans le domaine. Le cent, personne n'y a pensé : il paraît
trivial (*« tout est passé, il n'y a rien à dire »*), et c'est précisément pour ça qu'il tombe dans
la branche qui parle d'un reste.

**Parce que le bloc a été conçu comme une mesure et non comme une réponse.** Le nom, le bouton et le
résultat sont ceux d'un instrument. Ce qu'il sert à savoir — *mon fond ne pollue pas mes couleurs* —
n'est écrit que dans le recueil, qu'on n'ouvre pas quand on croit avoir compris.

**Et parce que montrer l'image coûtait un écran.** Au moment où le bloc a été écrit, l'endroit qui
sait afficher une image en grand était la découpe. Renvoyer vers elle était honnête ; ça reste cinq
gestes.

---

## 4 · Ce qui borne la solution

- **Une explication ne se recopie jamais.** Le texte long de `carte.lecture` est bon et reste où il
  est ; ce qui change est le `quoi`, qui promet ce que l'écran ne fait pas.
- **Zéro n'est pas un trou, et cent n'en est pas un non plus.** Les deux bouts sont des cas nommés,
  et chacun mérite sa phrase — les confondre reproduirait le défaut à l'envers.
- **Rien n'est calculé tant qu'on n'a pas cliqué**, et la mesure justifie le clic sur les grandes
  images. Un calcul automatique à l'ouverture du menu coûterait jusqu'à une seconde sur une carte
  qu'on ne fait que survoler.
- **Le manque n'a aucune couleur d'alerte** : un fond qui ne pollue rien est une bonne nouvelle, pas
  un avertissement.
- **Le magenta existe déjà** comme couleur d'instrument dans le produit ; rien de neuf à inventer.
- **Ce bloc va déménager.** [La colonne de droite](menu-de-carte-et-ecran-univers.md) est tranchée :
  c'est là qu'il vivra, avec la place d'y montrer une image.

---

## 5 · Les pistes

### A · Réparer la phrase — le plancher, et il est urgent

`entiere` cesse d'être *« zéro »* pour devenir *« rien n'a été mis de côté »*, ce qui est vrai aux
deux bouts. Et les deux bouts gagnent chacun leur phrase, parce qu'ils ne disent pas la même chose :
à **100 %**, *le détourage n'a rien trouvé à retirer — cette image n'a pas de fond à écarter* ; à
**0 %**, *le détourage a tout pris, donc la palette reprend l'image entière*. La ligne qui renvoie à
*Découper* ne paraît que lorsqu'il y a vraiment quelque chose à voir en magenta.

**Coût** : une condition et deux phrases. **Risque** : aucun. **C'est ce qui rend le bloc
compréhensible**, avant même de parler de son nom.

### B · Montrer l'image ici, au lieu d'y renvoyer

Le bloc affiche la vignette en magenta plutôt que de dire où aller la voir. Tout existe : la route,
l'appel client, le PNG.

**Coût** : faible en soi — mais **la place manque dans le menu flottant**, qui est déjà le plus haut
du produit. **C'est donc à faire avec la colonne de droite**, pas avant. **Ce que ça gagne** : cinq
gestes deviennent un, et l'explication du recueil cesse de mentir.

### C · Renommer le bloc d'après la question qu'il répond

*« Ce que la palette y lit »* devient quelque chose comme *« ce que le fond fait à tes couleurs »*,
et le bouton *regarder* dit ce qu'il va montrer. Le `quoi` du recueil suit.

**Coût** : trois chaînes. **Risque** : *« ce que la palette lit »* est le vocabulaire du produit
dans plusieurs documents ; comme pour *artwork officiel*, c'est **l'étiquette du bloc** qui change,
pas le terme.

### D · Calculer sans attendre le clic — *la mauvaise piste, nommée pour qu'on n'y revienne pas*

Puisque c'est souvent rapide, mesurer à l'ouverture du menu. **Écartée par la mesure** : 913 ms sur
la plus grande image du dépôt, sur un menu qui s'ouvre **au survol**. Ce serait une seconde de
calcul par carte effleurée.

---

## 6 · Ce qui est tranché — 3 septembre 2026

### La question n'était pas la bonne, et l'auteur l'a redressée

Les pistes du § 5 supposent toutes que le bloc **reste sur la toile** : on répare sa phrase, on lui
montre son image, on le renomme. L'auteur écarte le cadre entier :

> j'ai bien compris que ça répond à la question « est-ce que le fond pollue ma palette », mais ça
> reste quand même incompréhensible de base, **c'est une mécanique avancée qui ne devrait pas être
> mise comme ça sur la toile** […] là c'est juste de la pollution visuelle dans la toile, à un
> endroit où on se fout de la mécanique de calcul, ou de magenta, ou autre. **La toile, c'est un
> cadre pour poser des idées, les organiser en concepts et en ambiances.**

Et il nomme l'endroit juste :

> à la limite ça pourrait avoir son utilité quand on clique sur créer ambiance ou créer la palette,
> et là dans le détail de la palette on montre la couleur « exclue » car détectée comme le fond.

**C'est la bonne lecture, et elle explique le § 3 mieux que le § 3 lui-même.** Le bloc n'a pas été
mal expliqué ni mal nommé : il a été **mal placé**. Un instrument de mesure posé au milieu d'une
surface dont le métier est de faire naître des idées est hors sujet quel que soit son libellé, et
c'est pour ça qu'aucune réécriture ne l'aurait sauvé.

### a) Le bloc quitte la toile

*« Ce que la palette y lit »* disparaît du menu d'une carte. Avec lui partent le bouton *regarder*,
le pour cent, la phrase fausse et le renvoi vers *Découper* — **on ne répare donc pas la phrase, on
la retire**.

**Trois choses sont gagnées d'un coup** : la contradiction des 100 % cesse d'exister, le menu le plus
haut du produit perd son bloc le plus lourd, et la toile redevient ce que l'auteur en attend.

### b) La question déménage là où elle se pose : dans le détail d'une palette

Le panneau d'une palette a déjà la bonne forme — **1 · les sources**, *2 · la fusion*,
*3 · les retouches*, puis *la palette rendue*
([`Ambiances.tsx:494`](../../interface/src/composants/Ambiances.tsx#L494) et suivantes). On y ajoute
*« les images officielles du jeu »* comme source, et chaque couleur rendue **porte déjà sa
provenance** (`venue` : venue de la première source, des autres, ou posée à la main).

C'est là, et nulle part ailleurs, qu'on veut savoir ce qu'une image a donné et **ce qu'elle n'a pas
donné parce que c'était son fond**. La question est technique ; l'écran l'est aussi ; les deux vont
ensemble.

> ⚠️ **Ce que ça demande et que le produit ne sait pas encore faire.** Aujourd'hui, l'atelier sait
> dire **quelle part** d'une image a été écartée (`part_lue`) et **où** elle est (l'image en
> magenta). Il ne sait pas dire **quelle couleur** ce fond aurait apportée : la palette se calcule
> *après* le détourage, donc ce qui est écarté n'a jamais de couleur nommée. C'est un calcul de plus
> — la couleur dominante de la zone retirée —, pas un déplacement. **À chiffrer avant de le
> promettre.**

### c) Le nom ne se tranche pas ici

Renommer *« ce que la palette y lit »* n'a plus d'objet tant qu'on ne sait pas quelle forme le bloc
prendra dans le détail d'une palette. Le titre suivra ce qu'il montrera.

---

## 7 · Ce qu'il faut construire

**1. Retirer le bloc du menu d'une carte.**
[`Tableau.tsx:1193`](../../interface/src/composants/Tableau.tsx#L1193) — le composant entier, et son
appel dans le bloc *artwork officiel*. La phrase contradictoire part avec lui ; il n'y a rien à
corriger dans ce qu'on supprime.

**2. Reprendre l'entrée du recueil.** `carte.lecture`
([`aide.ts:338`](../../interface/src/aide.ts#L338)) perd son écran d'accroche. **Son texte long est
l'un des meilleurs du recueil et ne se jette pas** — il explique que le fond n'entre déjà pas dans la
palette, que ce sont les voisins qui la polluent, et que c'est *là* que découper une carte sert. Il
part vivre du côté des palettes, avec le bloc.

> Sa première ligne promettait *« et l'image avec, en magenta »* alors que le bloc ne montrait aucune
> image. En déménageant, elle dira ce que le nouvel écran fait vraiment.

**3. Le détail d'une palette dit ce qu'une source lui a donné.** Dans *1 · les sources*, chaque
image officielle porte ce qu'elle apporte — et, si le calcul se fait, **la couleur écartée parce que
détectée comme fond**. C'est là que l'image en magenta a enfin un endroit où se montrer :
`apercuDeLaLecture` existe, la route existe, et cet écran a la place.

**4. Chiffrer d'abord la couleur du fond.** C'est le seul point qui n'est pas un déplacement : il
faut savoir si l'on peut nommer la couleur de ce qui a été écarté, et ce que ça coûte. Rien ne se
promet à l'écran avant cette réponse.

### Ce que ça ne fait pas

- **Ça ne répare pas la phrase des 100 %** — elle disparaît. Le défaut mesuré au § 2 est réel, et
  c'est le retrait du bloc qui le referme.
- **Ça ne touche pas au calcul du détourage de palette**, qui est juste depuis toujours : sur les
  artworks du dépôt il écarte de 30 à 60 % des pixels, à raison.
- **Ça n'ajoute rien à la toile.** C'est tout le point.

> ⚠️ **Une correction à porter dans [le menu d'une carte](menu-de-carte-et-ecran-univers.md).** Ce
> fichier-là listait ce bloc parmi ce que la colonne de droite reprendrait. **C'est faux depuis cet
> arbitrage** : le bloc ne déménage pas dans la colonne, il quitte l'écran de l'univers. Le § 7 de
> cette fiche-là est à reprendre en conséquence.

---

## Ce que cette remarque recoupe

- **[Le menu d'une carte déborde](menu-de-carte-et-ecran-univers.md)** — ce bloc est **dans ce
  menu**, et c'est lui qui le rend le plus haut. La colonne de droite tranchée là-bas est l'endroit
  où l'image pourra enfin se montrer.
- **[« Concept art de » et « Artwork officiel »](concept-art-contre-artwork.md)** — on y a trouvé
  que ce bloc **n'apparaît que sous une carte promue**, et que cette absence dit déjà, en creux, que
  désigner un concept art ne colore pas le jeu.
- **« Sans artwork officiel, l'atelier ne réduit aucune couleur »** *(séance `D2`, étayée)* — même
  sujet pris en amont : ce bloc explique ce qu'un artwork donne à la palette, l'autre remarque dit
  ce qui arrive quand il n'y en a aucun.
- **[« L'allure »](l-allure.md)** et **[le menu de carte](menu-de-carte-et-ecran-univers.md)** — la
  *« centaine de millisecondes »* est la troisième mesure de la semaine écrite dans une phrase que
  plus rien ne relit.
