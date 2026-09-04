# Des catégories pour ranger les choses du codex

> **De quoi on parle.** Le **codex** est la liste des choses de ton jeu : les personnages, les
> objets, les décors, les éléments d'interface, les pièces d'équipement. C'est là qu'une chose naît,
> et c'est de là qu'on ouvre son établi. La remarque demande de pouvoir **les ranger** — héros d'un
> côté, méchants de l'autre, bestiaire encore ailleurs.

---

## 1 · Ce que l'auteur a écrit — 1ᵉʳ septembre 2026

> **Codex — des catégories pour ranger les choses du jeu.** Sur un jeu qui a beaucoup d'assets, la
> liste devient vite chargée. Regrouper les personnages par *héros*, *méchants*, *bestiaire*…

---

## 2 · Ce que le produit fait aujourd'hui

### a) Deux axes existent déjà, et aucun des deux n'est celui-là

| L'axe | Ce qu'il dit | Qui le décide | Ce qu'il commande |
|---|---|---|---|
| **la famille** — personnages, objets, décors, interface, équipement | **ce qu'une chose *est*** | le produit, liste fermée de cinq | quand on génère un personnage, **seuls les artworks officiels de la famille *personnages* partent en référence** |
| **le type** — personnage, bâtiment, arbre… | **ce qu'une chose *fait*** | l'auteur, dans les réglages du jeu | **quelles poses** la chose a par défaut |

**Ce qui manque est un troisième axe** : non pas ce qu'une chose est, ni ce qu'elle fait, mais **où
l'auteur la range**. Héros et méchants sont tous les deux des personnages, et tous les deux du type
*personnage* — les deux axes existants les mettent au même endroit, et c'est juste.

### b) Le besoin est anticipé, pas constaté — mesuré le 4 septembre 2026

| | Combien |
|---|---|
| choses du jeu dans tout le dépôt | **9** |
| réparties sur | 3 projets sur 6 |
| **le plus gros codex** | **4 choses** |
| choses portant un type renseigné | 3 sur 9, **toujours la même valeur** — *personnage* |
| types déclarés dans un univers | **0**, dans les six projets |

**Aucune liste n'est chargée aujourd'hui.** La remarque dit d'ailleurs *« sur un jeu qui a beaucoup
d'assets »* — c'est une projection, et elle est probablement juste ; elle n'est simplement pas
encore mesurable.

### c) Le produit a déjà fait exactement ça, ailleurs, et ça a marché

Sur le tableau d'inspiration, une carte porte un champ **`groupe`** : une étiquette libre, écrite
par l'auteur. Le PRD l'a longtemps décrit comme *« une étiquette qui n'a aucune forme à l'écran »*
— et c'était vrai. **Elle en a une depuis** : les cartes se groupent en **îlots** sur la toile, et
la barre du tableau liste les noms de groupes non vides
([Tableau.tsx:686](interface/src/composants/Tableau.tsx:686)).

**Le motif est donc éprouvé** : une étiquette libre, plus une forme qui la rend visible. Ranger le
codex de la même façon n'inventerait rien.

---

## 3 · Pourquoi c'est comme ça

**Le codex a été dessiné pour un jeu qui commence.** Ses rubriques sont les familles du produit, et
elles suffisent tant qu'il y a quatre choses. Personne n'a eu à ranger, donc personne n'a construit
de rangement.

**Et le dépôt se méfie d'un second vocabulaire.** La note qui ouvre le codex l'écrit : *« un second
vocabulaire aurait fini par diverger du premier »*. Ce n'est pas un refus des catégories — c'est un
avertissement sur la façon de les poser : elles doivent être **libres**, et ne rien commander.

---

## 4 · Ce qui borne la solution

- **La famille ne bouge pas**, et une catégorie ne doit pas la concurrencer : la famille décide de
  ce qui part en référence, la catégorie ne doit décider de rien.
- **Le type ne peut pas servir de catégorie** : il décide des poses d'une chose. Ranger un
  personnage dans *méchants* lui donnerait les poses de *méchant*, ce qui n'a aucun sens.
- **Le motif existe et se réemploie** — étiquette libre plus forme visible.
- **Rien ici ne coûte un centime**, et rien ne touche à ce qui part au modèle.

---

## 5 · Les pistes

### A · Une étiquette libre par chose, et la liste se groupe dessus

Une chose du codex porte une étiquette écrite à la main. La liste d'une famille se replie par
étiquette, et les choses sans étiquette restent ensemble à la fin.

**Ce que ça coûte** — petit : un champ, un endroit où l'écrire, un regroupement dans la liste. Le
motif est celui de la toile, repris. **Le risque** — sans discipline, on se retrouve avec *méchant*,
*Méchants* et *ennemi* : le produit devra proposer les étiquettes déjà employées, comme la toile le
fait pour ses groupes.

### B · Rien pour l'instant, avec le seuil écrit

Noter que le rangement s'ouvre quand un codex dépasse un certain nombre de choses, et écrire ce
nombre. Aujourd'hui le plus gros en compte quatre.

**Ce que ça coûte** — rien. **Le risque** — le jour où la liste sera chargée, elle le sera
brutalement : on ne range pas quarante choses le jour où elles arrivent. *Mais c'est honnête, et ça
évite de construire un rangement pour quatre lignes.*

### C · Une recherche plutôt qu'un rangement

Un champ qui filtre la liste par le nom. Ça résout *« la liste devient vite chargée »* sans ouvrir
de troisième axe.

**Ce que ça coûte** — très petit. **Le risque** — chercher suppose qu'on sache ce qu'on cherche ;
ranger sert à **parcourir**. Les deux ne répondent pas à la même chose, et l'auteur demande le
second.

---

## 6 · Ce qui est tranché

*Rien n'est encore tranché — à arbitrer avec l'auteur.*

**La recommandation est `B`, avec son seuil écrit, et `A` le jour où le seuil est franchi.** Le plus
gros codex du dépôt compte quatre choses ; construire un rangement pour quatre lignes serait
dessiner à vide. `A` est prête à être écrite le jour où elle sert, et elle ne coûtera pas plus cher
ce jour-là — le motif est déjà éprouvé sur la toile.

*Si l'auteur préfère la construire tout de suite, `A` est le bon chemin, et la seule chose à ne pas
oublier est de proposer les étiquettes déjà employées.*

---

## Ce que cette remarque recoupe

- **Le champ `groupe` de la toile** — le même besoin, résolu là-bas, et le motif à recopier.
- **`G9`** — démarrer la première pose. Elle refait le codex par un autre bout : ce qu'on y voit
  quand on arrive. *Si `A` se construit, elle se pose dans le même écran.*
