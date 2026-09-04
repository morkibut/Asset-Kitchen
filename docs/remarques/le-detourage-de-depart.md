# Le détourage de départ — incomplet, et au mauvais moment

> **De quoi on parle.** Une image qui revient du modèle arrive sur un fond. L'atelier le **détoure**
> — il retire ce fond pour ne garder que le sujet. On peut lui dire à l'avance comment s'y prendre :
> c'est *le détourage de départ*, une étape des réglages du jeu, livrée le 3 septembre 2026 par la
> tranche `D1`.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

Relevé après la livraison de `D1`, et **gardé tel quel par décision de l'auteur, à reprendre** :
l'étape est incomplète, et elle est au mauvais moment de l'usage.

---

## 2 · Ce que le produit fait aujourd'hui

### a) Quatre réglages existent, l'écran en offre un

Chaque ligne de l'étape propose **un moteur** et, une fois le moteur choisi, **le bord rongé**
([Assistant.tsx:2941](interface/src/composants/Assistant.tsx:2941)). C'est tout.

| Le réglage | Offert ici ? | Existe dans le produit ? |
|---|---|---|
| **le moteur** — comment on cherche le fond | **oui** | oui |
| **le bord rongé** — combien de pixels on mange au contour | **oui**, mais seulement après avoir choisi un moteur | oui |
| **le modèle de silhouette** — lequel employer quand le moteur est *le modèle* | **non** | oui, `Passe.modele` |
| **la tolérance** — jusqu'où une couleur compte comme du fond | **non** | oui |
| **le seuil de transparence** — à partir de quand un pixel est transparent | **non** | oui |

**Tant qu'aucun moteur n'est choisi, la ligne affiche « — » et il n'y a rien à régler** — et rien
ne le dit. L'auteur a lu le bord rongé comme absent, ce qui est le signe que l'écran le cache mal.

### b) ⚠️ La mesure qui a servi à cacher deux réglages ne se reproduit pas

Deux d'entre eux — la tolérance et le seuil de transparence — ont été **écartés délibérément**, sur
une mesure : *« tu les as laissés à leur valeur livrée 96 fois sur 100 »*.

**Recompté le 4 septembre 2026 sur les 147 passes de détourage du dépôt** :

| Le réglage | Laissé tel quel | **Changé à la main** |
|---|---|---|
| la tolérance | 134 sur 147 — **91 %** | **13 fois, 9 %** |
| **le seuil de transparence** | 113 sur 147 — **77 %** | **34 fois, 23 %** |
| le bord rongé | 75 sur 147 — 51 % | **72 fois, 49 %** |
| le modèle de silhouette | 131 sur 147 sans modèle nommé | **16 fois, 11 %** |

**Le seuil de transparence a été déplacé une fois sur quatre**, dans cinq des six projets, et
**vingt-deux de ces trente-quatre fois avec le moteur *modèle*** — c'est-à-dire précisément le
moteur dont l'écran ne laisse pas non plus choisir le modèle.

*Le chiffre de 96 % portait peut-être sur un autre sous-ensemble ; sur le corpus entier, il ne se
retrouve pas.* **Et c'est ce chiffre qui a décidé de cacher les deux réglages.**

Le réglage le plus déplacé de tous — le **bord rongé**, une fois sur deux — est justement celui que
l'écran offre. **La sélection n'est donc pas arbitraire : elle est juste pour un des quatre, et
fausse pour les trois autres.**

### c) Le vrai reproche : l'étape arrive trop tôt

Elle est la **onzième des douze étapes** de l'univers
([Assistant.tsx:132](interface/src/composants/Assistant.tsx:132)) — c'est-à-dire un endroit qu'on
traverse **en réglant son jeu, donc avant d'avoir fabriqué la moindre image**. Or on ne sait quel
détourage convient qu'**après** en avoir fait quelques-unes.

**Le geste naturel est l'inverse** : régler une image dans sa table, aimer le résultat, et dire
*« garde ça comme défaut pour les personnages »* depuis l'image elle-même. L'écran de l'univers
deviendrait alors la **relecture** de ce qu'on a promu, et non l'endroit où l'on devine à froid.

### d) Et personne ne s'en est encore servi

**Aucun des six projets du dépôt n'a posé un seul réglage de détourage de départ** — ni par nature
d'image, ni par famille.

⚠️ **Ce chiffre ne prouve pas grand-chose, et il faut le dire** : l'étape a **un jour**. Les six
projets sont tous antérieurs. Ce qu'il montre en revanche, c'est que **rien n'est venu remplir
l'étape depuis un jour d'usage**, et que si le geste inverse existait, les 147 passes déjà réglées
à la main auraient chacune été une occasion de le faire.

---

## 3 · Pourquoi c'est comme ça

**L'étape a été rangée là par une logique juste** : elle décide de ce que l'atelier fait de l'image
**au retour**, comme les emplacements et les modèles, et c'est pour ça qu'elle est dans le groupe
*la production* et non dans *le style*. La logique du rangement est bonne ; c'est le **moment** qui
ne l'est pas.

**Les deux réglages cachés l'ont été pour la bonne intention** — ne pas assommer avec ce que
personne ne touche. La mesure qui l'appuyait n'a simplement pas été refaite sur tout le corpus.

**Et le geste inverse n'a jamais été écrit nulle part.** Promouvoir un réglage d'image en défaut de
famille n'existe dans aucune tranche.

---

## 4 · Ce qui borne la solution

- **On ne peut pas tout montrer.** Quatre réglages par ligne, sur deux natures et cinq familles,
  feraient vingt-huit contrôles sur un écran d'assistant. **Le repli est obligatoire**, et sa forme
  est écrite : *un bloc replié porte son réglage à droite de son titre*.
- **Le geste inverse suppose un endroit où promouvoir.** Les tables règlent une image ; rien n'y
  parle de la famille ni du projet.
- **Un défaut posé ne retouche aucune image déjà faite** — la règle est écrite sur l'écran et elle
  ne bouge pas.
- **Rien ici ne coûte un centime.**
- **`G13`** — le modèle « lourd » ne détoure rien — touche le même sujet par un autre bout : elle
  arbitre **quels modèles existent**. La proposer ici avant qu'elle soit tranchée serait offrir un
  choix dont un des termes ne fait rien.

---

## 5 · Les pistes

### A · Le geste inverse : promouvoir un réglage depuis l'image

Dans la table de détourage d'une image, un geste *garder ça comme défaut ›* qui propose les deux
portées que le produit connaît déjà — **cette nature d'image**, **cette famille**. L'étape de
l'univers devient la relecture de ce qu'on a promu.

**Ce que ça coûte** — un geste, un petit écran de confirmation qui dit ce qu'on promeut et pour
quoi. **Le risque** — il faut décider ce qu'on promeut exactement : la passe entière, ou seulement
ce qui a été touché. *C'est la réponse au vrai reproche, et elle ne demande pas de toucher
l'assistant.*

### B · Les trois réglages manquants entrent, repliés

Chaque ligne gagne un repli *avancé* qui porte la tolérance, le seuil et le modèle — **et affiche
leur valeur à côté du titre**, comme la règle du produit l'exige.

**Ce que ça coûte** — moyen : le repli existe, les trois réglages existent. **Le risque** — le
modèle de silhouette dépend de `G13`, non tranchée : offrir un modèle qui ne détoure rien serait
pire que de ne pas l'offrir. **Cette piste attend `G13`.**

### C · La ligne vide dit ce qu'elle cache

Le plus petit correctif : quand aucun moteur n'est choisi, la ligne dit *« choisis un moteur pour
régler le bord rongé »* au lieu de ne rien dire. C'est ce qui a fait lire le bord rongé comme
absent.

**Ce que ça coûte** — une phrase. **Le risque** — aucun. *Indépendante de tout.*

### D · Refaire la mesure, et décider ensuite

Reprendre le comptage sur tout le corpus — c'est fait, il est plus haut — et **réécrire la décision
qui a caché la tolérance et le seuil**, avec le bon chiffre. Elle tient peut-être encore pour la
tolérance (9 %) ; elle ne tient pas pour le seuil (23 %).

**Ce que ça coûte** — l'écriture d'une décision. **Le risque** — aucun, et c'est **le préalable de
`B`** : sans ça, on ajoute des réglages sans savoir lesquels méritent d'être là.

---

## 6 · Ce qui est tranché — 4 septembre 2026

**Tranché par l'auteur, et il a écarté la maquette : `M7` de la `V2.4`.**

### a) Les quatre réglages reviennent, visibles — pas repliés

*« Oui, visibles comme les deux autres. »* La tolérance et le seuil de transparence reprennent leur
place sur la ligne. **Le repli n'a pas été retenu** : le nombre de contrôles se règle par le repli
de l'étape entière, pas par le repli de chaque réglage.

### b) Le modèle de silhouette n'y revient pas — il attend `G13`

*Tranché par l'auteur.* Il est déjà établi que le modèle annoncé comme lourd **ne détoure rien du
tout**. Offrir un choix dont un des termes ne fait rien serait pire que de ne pas l'offrir.

### c) Le mauvais moment se répare par l'autre bout — et sans maquette

*« On peut mettre dans la table de détourage un petit lien : enregistrer ce réglage comme défaut
pour le projet. »* C'est la piste `A`, prise directement, **sans passer par une maquette** : le
geste est assez simple pour se décrire en une phrase.

### d) ⚠️ Ce que l'auteur voulait faire et qui n'existe pas comme il le croyait

Il demandait de *« masquer l'étape sur le parcours de démarrage, et la garder dans les réglages »*.
**Le parcours de démarrage et la page des réglages de l'univers sont le même écran** : l'assistant
*est* le côté *réglages* de l'onglet Univers, et aucun drapeau ne dit si un jeu a déjà été réglé.

**Mais sa décision est déjà écrite au plan**, et par lui : `G8` répartit les douze étapes en deux
groupes, **le détourage nommément dans le groupe replié**, avec la garantie que *« aucune étape ne
disparaît : la page des réglages reste entière »*. `M7` ne touche donc pas au repli. **`G8` décide
quand on voit l'étape ; `M7` décide ce qu'elle contient.**

### Ce qui reste ouvert

**Ce qu'on promeut exactement, avec le lien.** La passe entière, ou seulement ce qui a été touché ?
Et pour quelle portée par défaut — la nature de l'image, ou sa famille ? *À trancher en
construisant `M7`.*

---

## Ce que cette remarque recoupe

- **`G13`** — le modèle « lourd » ne détoure rien. **Elle bloque une moitié de `B`** : on n'offre
  pas le choix d'un modèle tant qu'on n'a pas tranché lesquels existent.
- **`D1`** — la tranche qui a livré cette étape le 3 septembre 2026, et qui l'a gardée telle quelle
  par décision de l'auteur.
- **La remarque sur la charge de l'interface**, partie en `V2.5`. Le repli demandé par `B` est
  exactement le mécanisme dont elle discute.
