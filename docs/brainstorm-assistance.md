# Carnet des points à traiter — l'assistance à l'écriture

> **Ce document ne décide rien et n'entre pas dans `docs/PLAN.md`.** Ouvert le 29 août 2026.
> Il sert à **dégrossir** : noter ce qui ne va pas, ce qui bloque, et les pistes — sans
> établir comment on le traitera. Chaque point sera repris **un par un, plus tard**.
>
> Un point y reste jusqu'à ce qu'il soit tranché ; ce qui est tranché part dans `docs/PRD.md`
> puis `docs/PLAN.md`, et ne laisse ici qu'une ligne de renvoi.
>
> Ne redit pas ce qui est déjà écrit dans **`docs/releve-usage.md`** (la consigne de pose, le
> détourage, le récap de ce qui part, le personnage par l'image). Ce carnet-ci porte
> **l'assistance à l'écriture et la lisibilité des mécanismes**.

---

## Ce qui est acquis

### ✔ Les rôles de réinjection deviennent réellement différents, et se règlent globalement

**Tranché le 29 août 2026.** Les trois rôles doivent produire trois appels différents, et les
consignes qu'ils écrivent doivent être **réglables dans l'écran Réglages** — celui qui est
global à tous les projets, à côté de *La clé*, *L'agent* et *Les dossiers*.

Le détail — quelles phrases, quelle forme de réglage, que devient la filiation — reste à
traiter.

---

## Les points, un par un

### 1 · Les trois rôles de réinjection ne changent rien à ce qui part

**Le problème.** La fiche d'un asset propose quatre boutons : *référence · source d'édition ·
guide de style · jeu de réglages*. Les trois premiers finissent **identiques** dans
`input_references` chez OpenRouter — même tableau, même encodage, même place. Le commentaire
du domaine le dit lui-même : « ils sont indiscernables sur le fil ».

La seule différence réelle est comptable : `source d'édition` sur un asset enregistre une
**filiation** (cette image a un parent). `référence` et `guide de style` sont deux mots pour
la même chose.

Le quatrième, *jeu de réglages*, est d'une autre nature : il n'envoie aucune image, il
repeuple le générateur.

**Le goulot.** On ne dit jamais à l'IA **à quoi sert** chaque image qu'on lui donne. Elle
reçoit quatre images sans hiérarchie ni fonction, et doit deviner laquelle est le sujet,
laquelle est le style, laquelle est à retoucher.

**Pistes.**
- Chaque rôle écrit une phrase dédiée dans le prompt — *« use this as the subject »*, *« edit
  this image »*, *« match the art style of this image »*.
- Ces phrases vivent dans l'écran Réglages, modifiables, avec un bouton *remettre au défaut*.
- Un rôle de plus est peut-être nécessaire : *composition / cadrage*, distinct du style.
- Question ouverte : la filiation reste-t-elle attachée au rôle `édition`, ou devient-elle un
  geste séparé ?
- Question ouverte : l'ordre des images compte-t-il pour le modèle ? Non mesuré.

**Où c'est** : `atelier/domaine/generation.py` (les trois constantes),
`atelier/fournisseur/openrouter.py` (`corps_appel`), `interface/src/composants/Fiche.tsx`
(les quatre boutons).

---

### 2 · Écrire un bon prompt prend du temps, et l'atelier n'aide pas

**Le problème, dans tes mots.** *« Je suis obligé de passer par Gemini ou ChatGPT : je lui
donne l'image de référence et un exemple de texte à produire avec des instructions strictes,
pour qu'il me rende un nouveau prompt en anglais, retravaillé. Écrire un prompt complet et
bien rédigé n'est pas du tout facile et prend du temps, et un prompt en anglais donne souvent
de meilleurs résultats. »*

**Le goulot technique.** L'atelier ne sait parler qu'à des modèles d'**image**. Le contrat du
fournisseur (`atelier/fournisseur/port.py`) tient en deux gestes : *dire ce qu'on sait faire*,
*faire une image*. Le catalogue est lu sur `/images/models`. **Il n'existe aucun chemin, nulle
part, vers un modèle qui lit du texte ou regarde une image pour en parler.**

C'est un **second port fournisseur** à créer, pas une extension du premier. Même clé
OpenRouter, même facture, autre catalogue (`/models`), autre contrat : *on lui donne du texte
et des images, il rend du texte*. Le port image ne bouge pas.

**Pistes — quatre usages, un seul moteur.**

| Usage | On lui donne | Il rend |
|---|---|---|
| Améliorer | le sujet écrit + les images de référence + des consignes de forme | un sujet anglais complet et structuré |
| Traduire | un sujet en français | le même en anglais, sans rien inventer |
| Décrire une image | une image | un signalement rédigé, prêt à devenir une description de personnage |
| Rédiger la bible | les artworks officiels de la toile | les sept champs de la bible, en anglais |

**Questions ouvertes.**
- Le cadre d'instruction — *« voici ce que je te demande de faire »* — est-il figé dans le
  produit, ou modifiable dans l'écran Réglages comme les rôles du point 1 ?
- Le coût s'affiche-t-il au même endroit que celui d'une image ? (Le produit n'a qu'une règle :
  ce qui coûte se voit.)
- Faut-il choisir le modèle de texte, ou un défaut suffit-il ?

---

### 3 · Le constructeur de prompt par morceaux

**L'idée, dans tes mots.** *« Un outil de création de prompt plus assisté, en choisissant
différents morceaux : c'est un personnage, de tel type, de telle taille, il porte quel
vêtement, couleur de peau, des cheveux, des yeux, objet porté, tenu en main… On remplit les
champs qu'on veut et ça crée un prompt, qu'on peut ensuite améliorer et traduire en anglais
par IA avec des instructions formelles. »*

**Ce qui la rend crédible.** Le produit a **déjà** ce motif et il marche : la bible est une
liste de champs nommés qui se replient en un texte. Le constructeur est la même idée appliquée
au *sujet* au lieu du *style*. Rien de neuf à inventer, juste un second jeu de champs.

**Ce qu'il apporte que le modèle de texte n'apporte pas** : gratuit, hors ligne,
**déterministe** (mêmes champs → même phrase), et il montre la forme qui marche.

**Ce que le modèle apporte et que lui n'apporte pas** : il lit une image, il rédige de la
prose fluide, il rattrape ce qu'aucun champ n'avait prévu.

**Piste principale : ils ne s'opposent pas, ils se chaînent.**

```
champs remplis → phrase brute (gratuit, hors ligne) → [Améliorer ›] → prompt anglais rédigé
```

**Questions ouvertes.**
- La liste des champs. *Piste : type, taille et carrure, visage et pilosité, cheveux, yeux,
  peau, haut, bas, pieds, porté sur le dos, tenu en main, attitude.* Douze, tous facultatifs.
- Où il vit : un dépliant sous le champ de prompt, ou un panneau à part ?
- Les champs sont-ils mémorisés **par personnage** ? Si oui, la description d'un personnage
  devient structurée, et rejoint le point 4.

---

### 4 · Le prompt d'une image générée n'est visible nulle part

**Le problème.** *« Il faudrait pouvoir consulter les prompts associés à chaque image générée
afin de pouvoir les réutiliser pour gagner du temps. »*

**L'état.** Le texte **est** enregistré, et il est exact — `generation.json` porte le prompt
tel qu'il est parti, c'était la décision de R2. Mais la fiche d'un asset ne l'affiche pas. On
peut *reprendre* les réglages d'une image (bouton *jeu de réglages*), on ne peut pas **lire**
ce qui l'a produite.

**Pistes.**
- Le dépliant *« ce qui partira »* du champ de prompt, réemployé dans la fiche et nommé *« ce
  qui est parti »*. Même composant, mêmes blocs, en lecture seule.
- Un geste dessous : reprendre ce texte dans le champ de prompt.
- Plus tard, peut-être : chercher dans la grille par le texte du prompt.

**Aucune donnée à ajouter, aucun appel, aucun modèle.** C'est le point le moins cher du carnet.

---

### 5 · La bible reste sept boîtes vides

**Le problème.** Sept champs nommés depuis R2, dont les deux qui décident le plus de
l'apparence — *technique de rendu*, *vue et cadrage*. Un auteur qui ne sait pas quoi y écrire
n'écrit rien : mesuré le 28 août sur trois projets réels, cinq champs vides dans les trois.

**Ta correction.** *« C'est bien de dire qui a proposé, mais ce qui m'intéresse réellement
c'est : est-ce qu'on a un outil performant pour proposer ? »* — la forme sans moteur est une
étiquette sur du vide. Le moteur est le point 2.

**Pistes, du moins cher au plus ambitieux.**

- **Des propositions par défaut, illustrées.** Pour les deux champs qui décident le plus,
  trois ou quatre vignettes, chacune montrant le texte anglais qu'elle écrit. Gratuit, hors
  ligne.
- **La bible rédigée depuis tes artworks.** On sélectionne des cartes de la toile, le modèle
  les regarde et propose les sept champs en anglais. Dépend du point 2.
- **La planche de style composite — à creuser.** *« Comme notre système envoie des images de
  référence, on pourrait avoir un outil de construction d'une image de référence qui reprend
  visuellement, en plus du texte, chaque morceau de la bible. »*

**Sur la planche composite.** L'atelier sait **déjà** composer une planche à partir d'images
dont il connaît la géométrie case par case — c'est le pliage de C2, que C3 réemploie tel quel.
Composer une planche de style — palette, échantillon de trait, exemple d'éclairage, un sujet
type — est le même geste mécanique appliqué à une autre fin.

*Ce qui la rend intéressante* : une planche unique qui part avec **chaque** génération occupe
**une seule place** dans le plafond de références du modèle, au lieu de quatre artworks
disparates.
*Ce qui la rend risquée* : personne n'a mesuré si un modèle lit mieux une planche composite
que des images séparées. **Un essai payant à faire avant d'en faire quoi que ce soit.**

---

### 6 · Le panneau « ce qui part » ne fait que la moitié du travail

**Le problème.** *« Indispensable de pouvoir voir tout ce qui est envoyé et pouvoir désactiver
ici, prompt texte et références. »* Et le point que je n'avais pas vu : **on peut retirer une
référence ici, mais pas en ajouter.** Pour ajouter, il faut sortir — passer par l'écran Univers
ou par la fiche d'un asset.

**Quatre manques.**
1. Aucune **vignette** dans la liste : on décoche « artwork officiel » sans savoir lequel.
2. Le texte et les images vivent à **quatre endroits différents** de l'écran.
3. **On ne peut rien ajouter depuis le panneau qui dit ce qui part.**
4. Aucun aperçu grand format — voir le point 7.

---

### 7 · L'aperçu à la barre d'espace n'est pas armé là où on en a le plus besoin

**Le problème.** *« C'est tellement petit qu'on voit rien. »* Les images de référence du
panneau « ce qui part » et les images de pose de l'écran Personnages sont des vignettes de
44 px, et rien ne permet de les voir en grand.

**L'état.** Le mécanisme **existe et marche** : survoler une image et appuyer sur Espace
l'ouvre en grand, avec le zoom à la molette. Il est armé sur trois surfaces — la grille
d'assets, l'image de la fiche, les cartes de la toile — et **sur aucune des deux qui en ont le
plus besoin**.

**Piste.** Brancher `useVisee` sur ces deux surfaces. Rien à inventer.

**Où c'est** : `interface/src/composants/Apercu.tsx` (le mécanisme),
`Tuile.tsx` / `Fiche.tsx` / `Tableau.tsx` (les trois qui l'ont).

---

### 8 · Aucun moyen de voir ce qu'un réglage fait réellement

**Le problème.** *« Le temps du dev, je dois comprendre tous les mécanismes en détail pour
améliorer le soft et les requêtes faites à l'IA. Donc ajouter une info "avancée" visible
seulement si on demande à la voir, c'est impératif pour à peu près tous les réglages. »*

**Pourquoi c'est plus qu'un confort de développement** : c'est le principe du dépliant de R2 —
*ce qui est montré est ce qui part* — étendu du prompt à **tous** les réglages. **C'est ce qui
aurait rendu le point 1 visible il y a trois semaines**, au lieu de le découvrir en lisant le
code.

**Pistes.**
- Une bascule globale — *montrer ce que ça fait vraiment* — qui ouvre sous chaque réglage une
  ligne technique : ce que le paramètre devient dans l'appel, ce qu'il écrit dans le prompt,
  ce qu'il ne fait pas.
- Où vit la bascule : barre de tête, ou écran Réglages ?
- L'état est-il mémorisé entre deux séances ? *(c'est un mode de travail, pas un coup d'œil.)*

---

### 9 · Le panneau de réglages ne distingue pas le défaut du modifié

**Le problème, et il est mineur.** Un réglage qui vient du projet et un réglage que tu viens
de changer pour cette génération ont exactement la même force à l'écran. Rien ne dit ce que
cette génération-ci a de particulier.

**Ton avis.** *« Je ne vois pas vraiment ce que ça apporte, mais ça peut aider à ne pas
oublier un réglage. »* — et *« rendre au projet » ne veut rien dire, ce n'est pas du tout
compréhensible.*

**Pistes.** Garder la distinction visuelle, jeter le libellé. Remplacement possible :
`remettre au défaut`, ou simplement un `×` sur la valeur modifiée.

**Rangé en bas** : faible valeur perçue par le seul utilisateur du produit.

---

## Table des points

| # | Point | État |
|---|---|---|
| — | Les rôles rendus différents et réglables globalement | **acquis** |
| 1 | Les trois rôles ne changent rien à ce qui part | à traiter — le détail |
| 2 | Aucun modèle qui lit une image et écrit du texte | à traiter |
| 3 | Le constructeur de prompt par morceaux | à traiter |
| 4 | Le prompt d'une image n'est visible nulle part | à traiter |
| 5 | La bible reste sept boîtes vides | à traiter |
| 6 | « Ce qui part » ne permet pas d'ajouter | à traiter |
| 7 | L'aperçu Espace n'est pas armé sur les références ni les poses | à traiter |
| 8 | Aucun mode « avancé » pour voir ce qu'un réglage fait | à traiter |
| 9 | Défaut / modifié dans le panneau de réglages | à traiter — mineur |
