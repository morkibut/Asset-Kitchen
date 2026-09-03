# Le menu d'une carte déborde de l'écran, et l'écran de l'univers est à revoir

> **État : tranchée.** Le débordement **est déjà réparé partout ailleurs** : le menu bascule vers le
> haut, s'aligne à droite et se borne à l'écran depuis le 27 août — **sauf sur la toile**, où ce
> garde-fou est éteint par une décision écrite. Et l'objection technique qui justifiait cette
> décision a été résolue depuis, dans le même fichier, pour cinq autres usages. Les trois questions
> sont arbitrées ; ce qu'il faut construire est au § 7 — et **deux décisions écrites y sont
> révisées**, celle du menu non borné et celle des bascules regroupées en haut.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> dans la toile de l'univers, quand on survole une carte on son menu d'action qui s'affiche en
> dessous, et c'est absolument pas pratique car il est asser long et vertical et on peut jamais le
> voir entier sauf si on dezzome et colle le visuel tout en haut de la toile (voir screen) Je pense
> qu'il faut revoir l'interface de l'univers : la réserve serait une colonne a gauche (toujorus
> repliable, mais avec un bouton bien visible), et a droite on aurait une colonne qui s'affiche
> quand on clique sur une carte et qui affiche son contenu (rappel visuel avec + les infos de son
> infobulle).

*Une capture accompagnait la remarque : le menu d'une carte survolée, qui sort du bas de l'écran.*

---

## 2 · Ce que le produit fait aujourd'hui

### Le garde-fou existe, et il est éteint sur la toile — par écrit

Le menu d'une carte sait déjà **trois choses** pour ne pas sortir de l'écran
([`Tableau.tsx:1109-1144`](../../interface/src/composants/Tableau.tsx#L1109)) :

- **il bascule au-dessus de la carte** quand il ne tient pas dessous et qu'il tient mieux dessus ;
- **il s'aligne sur le bord droit** de la carte quand il déborderait à droite du cadre ;
- **et quand il ne tient nulle part, il prend exactement la place offerte et défile en dedans** —
  *« un menu court qui défile vaut mieux qu'un menu complet dont on ne peut pas atteindre
  Retirer »*.

Tout cela est en place **depuis le 27 août 2026** (commit `46f349a`, *« les panneaux tiennent dans
l'écran »*), et le commentaire raconte même la première version ratée : elle mesurait la place
autour du menu au lieu de la mesurer autour de la carte, et se posait 200 px hors du cadre.

**Et rien de tout cela ne s'applique sur la toile.** Une seule ligne le décide
([`Tableau.tsx:1056`](../../interface/src/composants/Tableau.tsx#L1056)) :

```
borne={!plan}
```

`plan` est vrai sur la toile. Le calcul entier commence par `if (!borne) return`
([`:1110`](../../interface/src/composants/Tableau.tsx#L1110)) : sur la toile, **le menu ne bascule
pas, ne se réaligne pas et ne se borne pas**. Il se pose sous la carte, de toute sa hauteur, et
sort par le bas.

Ce n'est pas un oubli. La décision est écrite au-dessus du composant
([`Tableau.tsx:1076`](../../interface/src/composants/Tableau.tsx#L1076)) :

> **Sur la toile, il ne se borne pas, et c'est une décision** : un plan n'a pas de bord contre
> lequel un menu se cogne — **on le déplace, ou on l'agrandit**. Une hauteur maximale mesurée en
> pixels d'écran serait de toute façon fausse dès le premier cran de zoom, puisqu'elle
> s'appliquerait à l'intérieur d'une surface mise à l'échelle.

**La décision avait prévu le contournement, et l'auteur vient de dire qu'il ne convient pas.**
*« On le déplace, ou on l'agrandit »* est exactement ce qu'il décrit en le déplorant : *« on ne
peut jamais le voir entier sauf si on dézoome et colle le visuel tout en haut de la toile »*. Ce
n'est donc pas un bug à corriger, c'est **une décision contestée par l'usage**, et c'est ce qui la
rend révisable.

### L'objection technique a été levée depuis, dans le même fichier

La décision s'appuie sur un fait vrai : la toile est une surface mise à l'échelle, donc une hauteur
en pixels d'écran y serait fausse dès le premier cran de zoom.

**Mais la toile sait déjà poser du contenu à taille d'écran à l'intérieur du plan zoomé.** L'outil
s'appelle `ancreEcran` ([`Toile.tsx:142`](../../interface/src/composants/Toile.tsx#L142)) :

> Une **ancre d'écran** — un point du plan dont le contenu ne suit pas le zoom. […] Ce qu'on pose
> dedans se mesure en pixels d'écran : le plan multiplie par le zoom, l'ancre divise par lui, et le
> compte est juste à tous les crans.
>
> **Une seule forme pour les cinq usages** — le bandeau d'un îlot, ses deux prises, celles d'une
> carte, le mot d'un trait.

Cinq choses passent déjà par là, dont **les prises d'une carte** — c'est-à-dire un élément posé sur
la carte même dont parle la remarque. **Un menu à taille d'écran serait le sixième usage**, et le
commentaire dit lui-même pourquoi il faut passer par cette forme unique : *« une taille d'écran
obtenue cinq fois de cinq façons aurait fini par en donner cinq différentes »*.

L'objection qui fondait la décision était juste au moment où elle a été écrite. **Elle ne l'est
plus.**

### Le menu est long, et il a grandi depuis qu'on l'a mesuré

Le commentaire du composant chiffre le problème : *« il fait 300 px pour une carte 1× qui en fait
190, donc il déborde forcément »*. Cette mesure date du 27 août. **Deux blocs sont entrés depuis** :

| Le bloc | Ce qu'il porte |
|---|---|
| groupe | un libellé, un champ de 26 px |
| note | un libellé, un champ de 26 px |
| taille | un libellé, trois crans de 26 px |
| **concept art de** *(US-124, après la mesure)* | un libellé, **une bascule de 26 px par chose du jeu** — trois sur le projet du pèlerin |
| **artwork officiel** | le bouton, puis — s'il est promu — la famille sur **cinq boutons qui passent à deux rangées**, une phrase, **et le bloc « ce que la palette y lit »** *(après la mesure)* |
| le pied | découper, remplacer, retirer |

Le menu le plus haut est donc celui d'un **artwork officiel d'un projet qui a plusieurs
personnages** — exactement le cas du tableau de l'auteur. Les 300 px notés ne valent plus, et
personne n'a remesuré : c'est le même défaut que la phrase de poids de
[« L'allure »](l-allure.md), *une mesure écrite dans une phrase que rien ne relit*.

### Ce que l'auteur propose, et ce qui existe déjà

| Sa proposition | Aujourd'hui |
|---|---|
| la réserve en **colonne de gauche** | elle est à **droite** — les colonnes sont `1fr · 380px` en vue toile ([`Univers.tsx:220`](../../interface/src/composants/Univers.tsx#L220)) |
| **repliable, avec un bouton bien visible** | elle est repliable — mais la bascule est un bouton de 26 px, en texte de 10 px, **dans la barre du haut de l'application** ([`App.tsx:1841`](../../interface/src/App.tsx#L1841)), loin de la colonne qu'elle commande |
| une **colonne de droite** qui paraît au clic d'une carte, avec son visuel et ses explications | **elle n'existe pas.** Cliquer une carte ouvre le même menu flottant que le survol — `ouvert = choisie \|\| survolee` ([`Tableau.tsx:857`](../../interface/src/composants/Tableau.tsx#L857)) |

**Les deux moitiés de sa remarque sont une seule solution.** Une colonne de droite qui porte le
contenu d'une carte **est** la réponse au menu qui déborde : un menu qui vit dans une colonne ne
sort d'aucun écran, ne bascule pas, ne se borne pas — il défile comme n'importe quel panneau. Le
problème de placement disparaît au lieu d'être réglé.

### Et la largeur qu'il faudrait existe déjà

380 px est **la** colonne de ce qu'on manipule dans tout le produit — la fiche d'une image, la
réserve, les tables. L'en-tête de l'écran Univers le dit
([`Univers.tsx:11`](../../interface/src/composants/Univers.tsx#L11)) : *« lui donner une valeur de
plus ferait un troisième vocabulaire de largeur »*. Une colonne de détail à 380 px ne demande donc
aucune mesure nouvelle.

**Mais trois colonnes en même temps, c'est une autre affaire.** L'écran passerait à
`380px · 1fr · 380px` avec la toile au milieu — ce que la vue toile faisait déjà avant `E7`. Sur un
écran de 1 360 px, la toile n'aurait plus que 600 px de large, et c'est la surface dont c'est le
métier.

---

## 3 · Pourquoi c'est comme ça

**Parce qu'un plan infini n'a pas de bord, et qu'on a raisonné à partir de là.** Sur un écran
ordinaire, un menu se cogne au bas de la fenêtre et il faut décider quoi faire. Sur un plan qu'on
déplace et qu'on zoome, l'argument *« il n'y a pas de bord »* paraît décisif — sauf que **l'œil,
lui, a toujours un bord** : celui de la fenêtre. Le plan est infini, le regard ne l'est pas.

**Parce que la solution technique est arrivée après la décision.** `ancreEcran` a été écrite pour
les bandeaux d'îlot et les prises. Personne n'est revenu dire *« ceci lève l'objection posée
soixante lignes plus haut dans un autre fichier »*.

**Et parce que le menu flottant est né sur une grille, pas sur une toile.** En vue grille, une
carte fait 190 px, ses voisines sont serrées, et un panneau qui se pose par-dessus est le bon
geste. La toile est un espace où l'on dispose ; elle a de la place sur les côtés, et c'est là qu'un
détail devrait vivre.

---

## 4 · Ce qui borne la solution

- **Aucune largeur inventée** : 380 px est la colonne de ce qu'on manipule, et il n'y en a pas
  d'autre.
- **Une seule forme pour la taille d'écran sur la toile.** Si un menu doit rester à taille d'écran,
  il passe par `ancreEcran` et pas par un sixième calcul.
- **Replier n'est pas fermer** : les panneaux restent montés, la case de grille tombe à zéro. C'est
  ce qui garde à la toile la grille que son aimant mesure.
- **La toile est la surface dont le métier est de montrer.** Lui prendre 380 px de plus se paie, et
  le § 2 le chiffre.
- **Ce qui paraît sans clic garde son fondu de 80 ms**, et la liste de ce qui bouge reste close :
  une colonne qui s'ouvre au clic n'y entre pas — le clic l'a annoncée.
- **Une décision écrite se révise avec sa raison**, jamais en silence.

---

## 5 · Les pistes

### A · Rallumer le garde-fou sur la toile

Une ligne : `borne` devient vrai partout, et le menu se pose à taille d'écran par `ancreEcran`.
Il bascule, se réaligne, et défile en dedans quand il ne tient pas.

**Coût** : petit — les deux mécanismes existent, il s'agit de les brancher l'un sur l'autre.
**Risque** : le menu cesse de suivre le zoom, donc il ne grandit plus avec les cartes. C'est
précisément ce qu'on veut d'un menu, et c'est ce que les cinq autres ancres font déjà.
**Ce que ça ne fait pas** : le menu reste un panneau flottant de 400 px posé sur les voisines. Le
débordement disparaît ; l'encombrement reste.

### B · La colonne de droite — ce que l'auteur demande

Cliquer une carte ouvre une colonne de 380 px à droite : son visuel en grand, ses réglages, et ses
explications. Le menu flottant disparaît, ou se réduit aux deux ou trois gestes rapides.

**Coût** : moyen à élevé — c'est un panneau de plus, et la question du survol se repose (que
montre-t-on au survol si tout est dans la colonne ?). **Risque** : la toile perd 380 px, et c'est
la surface dont c'est le métier. **Ce que ça gagne** : le problème de placement **cesse d'exister**
au lieu d'être borné, et la carte gagne enfin un endroit où se lire en grand — ce que le menu
flottant ne pourra jamais offrir.

### C · La réserve passe à gauche

Les colonnes deviennent `380px · 1fr` en vue toile, réserve à gauche. Et sa bascule quitte la barre
du haut pour venir contre la colonne qu'elle commande.

**Coût** : faible. **Risque** : la barre du haut est l'endroit *unique* où toutes les colonnes du
produit se replient, et lui retirer celle-ci ferait deux endroits pour un geste. **Ce que ça
gagne** : l'auteur a cherché ce bouton et ne l'a pas trouvé ; c'est une mesure d'usage, pas une
préférence.

### D · Ne rien changer, et écrire pourquoi — *nommée pour qu'on la pèse*

La décision de 27 août tient : on déplace la carte, ou on dézoome. **Écartée** — l'auteur vient de
faire exactement ça et de dire que ça ne va pas. Une décision qui prédit son contournement et qu'on
maintient quand l'utilisateur se plaint du contournement n'est plus une décision, c'est un refus.

---

## 6 · Ce qui est tranché — 3 septembre 2026

### a) Le garde-fou se rallume tout de suite, **et il est assumé comme provisoire**

Le débordement s'arrête aujourd'hui, sans attendre la colonne. C'est petit, c'est sûr, et l'écran
redevient utilisable.

> ⚠️ **Ce travail sera jeté par `b`, et c'est su d'avance.** Une fois la colonne construite, le menu
> flottant ne paraît plus sur la toile : il n'y a plus rien à borner. Quelques lignes perdues
> contre des semaines de gêne en moins — l'arbitrage est fait dans ce sens, sciemment.

### b) La colonne de droite se code directement, sans maquette

C'est l'exception au geste qui a le mieux marché cette semaine (*maquette d'abord*), et elle se
justifie : la demande est précise, la largeur existe déjà dans le produit, et le panneau **ne
contient rien de neuf** — il reprend des blocs qui existent, déplacés. Ce qu'une maquette aurait
servi à découvrir — l'allure d'un écran qu'on n'a jamais vu — n'est pas ce qui est en jeu ici.

**Ce qui reste à découvrir en codant** est ce qu'une maquette n'aurait pas mieux dit : ce que donne
la toile réduite à 600 px sur un écran de 1 360. La réponse s'obtient en regardant, une fois que
ça tourne.

### c) La réserve passe à gauche, et sa bascule vient contre sa colonne

Les deux moitiés de la demande sont prises. **La seconde révise une règle du châssis** : jusqu'ici
toutes les colonnes du produit se replient depuis le même endroit, en haut à droite. La raison de
cette règle était qu'un geste unique se cherche à un endroit unique ; la mesure d'usage dit le
contraire — l'auteur a cherché ce bouton contre sa colonne et ne l'a pas trouvé en haut.

**La règle devient : une bascule se pose contre ce qu'elle commande.** Elle se réécrit dans
`docs/DESIGN.md` § Layout avec cette raison-là, et les autres colonnes suivront ou non, mais elles
ne suivront pas *en silence*.

---

## 7 · Ce qu'il faut construire

Trois chantiers, dans cet ordre — le premier tient une semaine, les deux autres refont l'écran.

### 1. Rallumer le garde-fou sur la toile — *tout de suite, et provisoire*

[`Tableau.tsx:1056`](../../interface/src/composants/Tableau.tsx#L1056) : `borne` cesse d'être éteint
sur le plan. Et sur la toile, le menu se pose **à taille d'écran par `ancreEcran`**
([`Toile.tsx:142`](../../interface/src/composants/Toile.tsx#L142)), sixième usage de la même forme —
jamais par un sixième calcul à lui.

La décision écrite au-dessus du composant
([`Tableau.tsx:1076`](../../interface/src/composants/Tableau.tsx#L1076)) se réécrit avec sa nouvelle
raison : l'objection du zoom est levée par un outil que le fichier voisin a depuis, et *« on le
déplace, ou on l'agrandit »* a été essayé par l'auteur, qui dit que non.

### 2. La colonne de droite — le contenu d'une carte, en grand

Un panneau de **380 px** — la colonne de ce qu'on manipule, dans tout le produit — qui paraît
**quand une carte est choisie**, et pas au survol. Il porte :

- **le visuel en grand** — ce que le menu flottant ne pourra jamais offrir, et la première chose que
  l'auteur demande ;
- **les réglages de la carte**, déplacés depuis le menu : groupe, note, taille, concept art de,
  artwork officiel et sa famille, et le pied — découper, remplacer, retirer ;

  > ⚠️ **Sans *« ce que la palette y lit »*, corrigé le 3 septembre 2026.** Ce bloc figurait ici
  > dans la première écriture de cette fiche. Il n'entre pas dans la colonne : il **quitte l'écran
  > de l'univers** et part du côté des palettes — *« une mécanique avancée qui ne devrait pas être
  > mise comme ça sur la toile »*. Voir [`ce-que-la-palette-lit.md` § 6](ce-que-la-palette-lit.md).
  > C'est une bonne nouvelle pour la colonne : c'était le bloc le plus lourd du menu.
- **les explications**, lues dans le recueil et jamais retapées — c'est ce que l'auteur appelle
  *« les infos de son infobulle »*, et la règle du produit veut qu'elles se lisent, pas qu'elles se
  recopient.

> ⚠️ **Sur la toile, le survol cesse d'ouvrir un menu.** Sinon le débordement revient par la porte
> qu'on vient de fermer : deux endroits règleraient la même carte, et l'un des deux sortirait
> toujours de l'écran. Le survol garde ce qu'il a déjà — la carte qui passe devant ses voisines et
> ses deux coins. **En vue grille, rien ne change** : le menu flottant y est déjà borné et il n'y a
> pas de colonne où aller.

### 3. La réserve à gauche, sa bascule contre elle

Les colonnes de la vue toile passent de `1fr · 380px` à **`380px · 1fr` — et `380px · 1fr · 380px`
tant qu'une carte est choisie** ([`Univers.tsx:220`](../../interface/src/composants/Univers.tsx#L220)).
Les deux panneaux latéraux se replient, la case de grille tombe à zéro, et **replier n'est toujours
pas fermer** : les panneaux restent montés, la réserve garde ses 380 px sous une case qui les rogne,
et l'aimant de la toile garde la grille qu'il mesure.

La bascule de la réserve quitte la barre du haut
([`App.tsx:1841`](../../interface/src/App.tsx#L1841)) pour venir contre sa colonne, et la règle du
châssis se réécrit dans `docs/DESIGN.md` § Layout.

### Ce que ça ne fait pas

- **Aucune largeur, hauteur ni couleur nouvelles.** 380 px existe, 26 px existe, `ancreEcran` existe.
- **Aucune explication réécrite.** Le contenu du recueil se lit ; il ne se recopie pas dans la
  colonne.
- **Rien ne change en vue grille.**
- **Ça ne reprend pas le bloc de la palette.** *« Ce que la palette y lit »* quitte l'écran de
  l'univers au lieu d'entrer dans la colonne — voir la remarque suivante. La colonne s'allège
  d'autant.

> ⚠️ **À faire dans le même passage que [« Concept art de » contre « Artwork officiel »](concept-art-contre-artwork.md).**
> Les cinq changements tranchés là-bas — deux étiquettes renommées, une ligne mesurée, le pied de
> carte — se posent tous dans **ce même menu**, celui qui va devenir la colonne. Les faire deux
> fois serait les faire une fois pour rien.

---

## Ce que cette remarque recoupe

- **« Ce que la palette lit » est incompréhensible** *(journal, en vrac)* — **c'est un bloc de ce
  menu-ci**, et c'est lui qui le rend le plus haut. Les deux remarques se croisent sans être le
  même problème : l'une parle de l'endroit, l'autre du contenu. Si la colonne de droite se fait,
  c'est là que ce bloc ira vivre.
- **[« Concept art de » et « Artwork officiel »](concept-art-contre-artwork.md)** — mêmes réglages,
  même menu. Les cinq changements arbitrés là-bas s'y posent, et l'un d'eux ajoute une ligne de
  plus à un menu déjà trop haut : à faire dans le même passage.
- **[« L'allure »](l-allure.md)** — même défaut de fond sur un autre écran : une mesure écrite dans
  une phrase, et plus rien ne la relit. Ici, ce sont les 300 px du commentaire.
- **« Ne montrer que l'essentiel, masquer l'avancé »** *(journal, en vrac)* — la dernière remarque
  de la séance, et elle englobe celle-ci : un menu de six blocs pour une vignette est exactement ce
  qu'elle vise.
