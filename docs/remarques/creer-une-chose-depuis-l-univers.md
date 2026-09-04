# Créer une chose du jeu depuis l'univers

> **De quoi on parle.** L'atelier a deux grands lieux. **L'univers** — les réglages du jeu et un
> tableau d'inspiration où l'on pose des images. **Le codex** — la liste des choses du jeu : les
> personnages, les décors, les objets. Sur une image du tableau, on peut dire *« ceci est un concept
> art du pèlerin »*, ce qui la fera partir avec chaque image qu'on demandera du pèlerin.
>
> **Encore faut-il que le pèlerin existe.** Et on règle l'univers **avant** d'avoir rien mis dans le
> codex.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> aujourd'hui on créer l'univers, mais si on a pas créer les personnages dans le codex, on peut pas
> les attribuer, donc il faudra créer une mécanique pour créer une entité depuis l'univers : a noter

---

## 2 · Ce que le produit fait aujourd'hui

### a) Il n'existe qu'un seul endroit au monde où une chose du jeu naît

Le codex, par un champ où l'on tape un nom
([Codex.tsx:625](interface/src/composants/Codex.tsx:625)). C'est tout. **L'écran de l'univers n'a
aucun geste de création** — pas un bouton, pas un champ : le mot n'y apparaît nulle part.

Et l'assistant qui ouvre un jeu neuf compte **douze étapes**, toutes consacrées aux réglages : le
nom, le style, la vue, la taille, les types d'objets, l'allure, les références et couleurs, les
poses, les emplacements, les modèles, le détourage, les fournisseurs
([Assistant.tsx:132](interface/src/composants/Assistant.tsx:132)). **Aucune ne crée quoi que ce
soit.** À la septième — *Références et couleurs* — l'atelier demande d'avoir promu des images ; à ce
moment-là, le codex est vide.

### b) ⚠️ Et le geste ne manque pas : il est invisible

C'est le point le plus dur, et il n'était pas dans la remarque. Le bloc *Concept art de* du menu
d'une carte est écrit ainsi :

> `carte.genre === "image" && personnages.length > 0`
> — [Tableau.tsx:1440](interface/src/composants/Tableau.tsx:1440)

**Quand le codex est vide, le bloc n'apparaît pas du tout.** Pas une liste vide, pas une phrase, pas
un grisé avec sa raison : **rien**. L'auteur ne voit pas qu'il ne peut pas désigner — il ne voit pas
qu'il *pourrait*. Le produit a pourtant un motif écrit pour exactement ce cas — *le grisé porte sa
raison* — et il n'est pas appliqué ici.

### c) Ce que ça donne dans le dépôt, mesuré le 4 septembre 2026

| Le projet | Choses du jeu | Cartes sur la toile | Le bloc *Concept art de* |
|---|---|---|---|
| **cœur de pierre** | **0** | **55** | **jamais montré** |
| **bac à sable** | **0** | **5** | **jamais montré** |
| cœur de pierre - 01 | 4 | 25 | montré |
| essai animation | 2 | 4 | montré |
| Le Marais du Vieux Moulin | 3 | 6 | montré |
| vignettes | 0 | 0 | — |

**Deux projets sur six ont des images sur leur toile et aucune chose du jeu à qui les attribuer** —
et l'un d'eux en a cinquante-cinq. Sur ces soixante cartes, le geste n'a jamais pu être proposé.

### d) La désignation s'écrit sur la chose, pas sur l'image

Une carte désignée n'est pas copiée : c'est **le personnage** qui garde la liste des cartes qui le
décrivent (`concept_arts` dans son enregistrement). **La chose est donc bien le préalable
mécanique**, et pas seulement une commodité d'écran.

### e) L'artwork officiel, lui, n'a besoin de personne

*Promouvoir en artwork officiel* — le geste voisin, celui qui donne ses couleurs à la palette du
jeu — ne demande **aucune chose du jeu** : il se pose sur la carte, avec une famille. Les deux
réglages sont côte à côte dans le même menu, et **l'un s'affiche toujours, l'autre disparaît sans
un mot**.

---

## 3 · Pourquoi c'est comme ça

**Le produit a un ordre, et il est juste** : on règle le jeu, puis on peuple, puis on fabrique. La
première image d'une chose ne peut pas exister avant la chose.

**Mais l'univers demande, dès son septième pas, quelque chose qui suppose l'étape d'après.** Poser
des concept arts est un geste de peuplement déguisé en geste de réglage — et il a été rangé dans les
réglages parce que c'est là que vit le tableau d'inspiration.

**La condition qui cache le bloc a été écrite pour une bonne raison** : afficher un libellé au-dessus
d'aucun bouton n'aurait servi à rien. Personne n'a vu qu'elle transformait un préalable en absence
muette.

**Et le Guide promet le contraire.** Il écrit, du geste de nommer : *« c'est le geste que l'atelier
connaît déjà pour les poses et les pièces d'équipement — **nommer, c'est créer, partout** »*
([Guide.tsx:245](interface/src/composants/Guide.tsx:245)). Partout sauf ici.

---

## 4 · Ce qui borne la solution

- **L'ordre du produit ne s'inverse pas.** La chose reste le préalable ; ce qui est en cause est
  qu'on ne puisse pas la faire naître au moment où on en a besoin.
- **Nommer suffit à créer**, et c'est déjà vrai partout ailleurs : le champ du codex ne demande
  qu'un nom et une famille, que le serveur pose lui-même.
- **Le geste va où son effet se voit** — la règle du dépôt. Créer une chose depuis l'univers doit
  donc montrer quelque chose sur place : la carte qu'on vient de désigner, pas un écran qui n'a pas
  bougé.
- **Rien ici ne coûte un centime.**
- **`G7` refait déjà l'écran de l'univers.** Ce qui s'ajoute ici doit s'y poser, pas à côté.

---

## 5 · Les pistes

### A · Le bloc cesse de disparaître, et propose de créer

Quand le codex est vide, le bloc *Concept art de* s'affiche quand même, avec sa raison — *aucune
chose du jeu pour l'instant* — et **un champ pour en nommer une sur place**. La chose naît, la carte
lui est désignée dans le même geste, et l'écran montre le résultat : la marque apparaît sur la
carte.

**Ce que ça coûte** — petit : le champ du codex est réemployé tel quel, et l'appel qui crée existe.
**Le risque** — aucun sur le fond. Il faut seulement que la famille soit choisie, ou déduite ; le
codex la déduit déjà de l'onglet où l'on tape, et ici il n'y a pas d'onglet.
**C'est le geste posé exactement là où le besoin naît.**

### B · Le bloc s'affiche avec sa raison, et renvoie au codex

Même chose, sans créer sur place : une phrase, et un lien *aller au codex ›*.

**Ce que ça coûte** — presque rien, et le chemin existe déjà pour un cas voisin. **Le risque** — on
quitte l'écran, donc on perd le fil de ce qu'on faisait sur la toile. C'est **le minimum**, pas la
réponse.

### C · L'assistant gagne une étape « les choses du jeu »

Entre les types d'objets et les références, une étape où l'on nomme les premières choses du jeu.

**Ce que ça coûte** — une treizième étape dans un assistant qui en compte douze. **Le risque** —
l'assistant est un tunnel qu'on traverse une fois ; nommer ses personnages avant d'avoir vu le
produit n'est pas le bon moment, et le dépôt a déjà écrit qu'il se méfie des tunnels.

### D · Le Guide dit vrai, ou le produit tient sa promesse

*« Nommer, c'est créer, partout »* est faux ici. Soit on corrige la phrase, soit on la tient.
**Elle n'est pas une piste à part** : elle se règle avec `A` ou avec `B`.

---

## 6 · Ce qui est tranché — 4 septembre 2026

**Tranché par l'auteur : `A`, et elle entre dans `G7`, en `V3.1`.**

### a) Le bloc s'affiche même quand le codex est vide, et propose de créer sur place

Avec sa raison, et **un champ pour nommer une chose là, tout de suite**. Le champ du codex est
réemployé tel quel : nommer suffit à créer, et le serveur pose la famille. La chose naît, la carte
lui est désignée dans le même geste, et la marque apparaît sur la carte — *le geste va où son effet
se voit*, et son effet est là.

Cela répare **deux** choses : le geste qui manque, et l'**absence muette**, qui est le vrai défaut
découvert en instruisant.

### b) Elle n'a pas de tranche à elle, et c'est délibéré

`G7` refait déjà **ce menu-là**, et y traite déjà les deux réglages voisins — *Concept art de* et
*Artwork officiel*. Le geste s'y pose sans rien dessiner deux fois. *La tranche s'allonge d'un
paragraphe et de quatre critères ; elle ne change pas de nature.*

### c) `C` est écartée

Une treizième étape dans l'assistant nommerait les personnages **avant** d'avoir vu le produit, et
le dépôt s'est expressément interdit d'allonger ce tunnel.

### Ce qui reste ouvert

**La famille de la chose créée depuis là.** Le codex la déduit de l'onglet où l'on tape ; ici il n'y
a pas d'onglet. *À trancher en construisant `G7`* — la déduire de la famille de la carte est la
piste évidente, elle n'est pas vérifiée.

---

## Ce que cette remarque recoupe

- **`G7`** — l'écran de l'univers se refait, et il porte déjà la question des deux réglages voisins
  *Concept art de* et *Artwork officiel*. **C'est le même menu de carte**, et c'est là que ce geste
  doit se poser. *Les deux se lisent ensemble.*
- **`G15`** — sans artwork officiel, la palette n'existe pas. C'est la même chaîne, prise un cran
  plus haut : `G15` veut proposer de promouvoir une image, celle-ci veut pouvoir l'attribuer à
  quelque chose.
- **`G9`** — démarrer la première pose. Elle relève déjà que trois documents, dont le Guide,
  promettent que *nommer une chose ouvre son établi*, et que le code ne le fait pas. **C'est la même
  promesse, prise par l'autre bout.**
- **La remarque voisine du même jour** — *fabriquer un artwork depuis la toile de l'univers* — est
  le maillon suivant de la chaîne, et suppose celui-ci.
