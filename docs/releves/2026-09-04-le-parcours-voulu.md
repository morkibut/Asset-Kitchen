# Le parcours que l'auteur veut — 4 septembre 2026

> **C'est la pièce la plus utile du dossier**, et la seule qu'aucune lecture de code ne pouvait
> produire : l'auteur y dit **ce qu'il venait chercher** à chaque écran. Un relevé dit ce qu'un
> écran affiche ; seul l'usage dit ce qu'on espérait y trouver, et l'écart entre les deux est le
> défaut.
>
> Consigné mot pour mot, parce qu'une reformulation perdrait justement ce qui vaut : l'ordre dans
> lequel il ouvre les choses, et ce qui l'arrête.

---

## 1 · Ce qu'il a écrit

> tous les écrans me déçoivent par leur complexité et leur manque de lien et de logique.
> donc je voudrais déjà qu'on essaie de mettre à plat le workflow de travail et les liens entre les
> écrans, voir si des écrans manquent, si certains sont en trop, si certains devraient fusionner ou
> devenir plusieurs écrans…
>
> Moi ce que je sais que j'aimerais globalement :
>
> - **J'allume l'app** : un bel écran qui me propose de choisir sur quel jeu / projet je veux
>   travailler.
> - **j'arrive sur la toile de l'univers de ce jeu**
> - de là je peux soit bosser sur l'univers, soit passer sur le codex pour créer des assets. Déjà
>   rien que là il y a **2 outils vraiment distincts** : L'univers c'est la partie créative /
>   imaginaire / conceptuelle. Le Codex c'est la partie Fabrication et rangement. La galerie on sait
>   pas trop ce qu'elle fait là car elle mélange les projets, les visuels, ça rame de fou plus on a
>   d'images alors que j'ai franchement même pas 5 % de ce qu'un jeu contiendra en réalité (donc à un
>   moment faudra arrêter de recalculer en live toutes les images et stocker des vignettes je pense ?
>   et faire du lazyload… bref). la galerie c'est utile, mais mal foutu.
> - **donc j'arrive sur le codex.** le panneau de gauche me parle plutôt pas mal, il catégorise ce
>   que contient le monde, mais par contre **les directions et les poses réclamées par les
>   personnages, on comprend pas ce que ça fout là**. C'est un réglage du jeu, on le règle une fois et
>   on le retouche pas, qu'est-ce que ça vient polluer une colonne entière ?
> - **je clique sur personnage**, je vois la liste des entités personnages, c'est pas top, beaucoup
>   d'infos, mais bon ça passe encore. **je clique sur Équipement** : là non pas de liste des
>   équipements. mais des paragraphes de texte qui s'enchaînent, du texte, du texte, encore du texte.
>   illisible, effrayant. et incompréhensible. Alors que je m'attendais à voir **un vestiaire
>   d'équipement sous forme d'image** comme pour les personnages. Et pendant tous ces écrans du codex,
>   **en bas j'ai 1/4 de la page prise par un panneau de génération qu'on ne comprend pas** et qui
>   permet de régler plein de choses dont on n'a pas besoin a priori, du moins pas là, partout. **La
>   colonne de droite qui dit ce que l'entité réclame, étrange, et en plus faux** (toutes les poses et
>   équipements sont au vert même pour les choses pas faites…). je pense qu'il faut repenser ça aussi.
> - **ensuite donc je clique sur le pèlerin**, et là au lieu de voir les infos du pèlerin, avoir un
>   menu où je peux choisir de régler des choses, j'ai des poses avec beaucoup de vide au centre de
>   l'écran, des **indicateurs obscurs incompréhensibles et techniques** *« ressemblance 0.37 · case 2
>   grille 7 px · dérive 1.00× »* et un bouton fabriquer. pour chaque pose. et **un menu à peine
>   distinguable permettant de passer sur des objets alors que je n'ai même pas décidé si ce
>   personnage a cet objet ou pas.**
>
> je m'arrête là déjà…

Et, sur l'équipement, en précisant ce qui le gêne vraiment :

> non mais le problème c'est **la logique et la cohérence avec le reste** en fait. déjà les
> équipements, **ils ne devraient pas tous être disponibles par défaut sur tous les personnages**. Si
> je crée un sac à dos pour le héros, je le mets que sur le héros. bref y a rien qui va

---

## 2 · Le modèle cible qu'il décrit, en clair

```
  allumer l'app
        │
        ▼
  ┌───────────────────────┐
  │  choisir un jeu       │   ← écran neuf, n'existe pas
  └───────────┬───────────┘
              ▼
  ┌───────────────────────┐
  │  la toile de l'univers│   ← le premier écran d'un jeu ouvert
  └───────────┬───────────┘
              │
      ┌───────┴────────┐
      ▼                ▼
 ┌──────────┐   ┌─────────────┐
 │ L'UNIVERS│   │  LE CODEX   │
 │ créatif  │   │ fabrication │
 │conceptuel│   │  rangement  │
 └──────────┘   └─────────────┘

  la Galerie : rôle indéterminé
```

**Deux outils, pas trois onglets.** C'est la phrase la plus structurante du lot : l'Univers et le
Codex sont des **outils** de natures différentes ; la Galerie est une **vue**. Trois choses de même
rang dans une barre dont une n'est pas du même genre que les deux autres — d'où *« on ne sait pas
trop ce qu'elle fait là »*.

---

## 3 · Ce que sa visite révèle : deux défauts, répétés huit fois

Les huit griefs ne sont pas huit problèmes. Ce sont **deux défauts vus à huit endroits** — et c'est
ce qui rend la refonte faisable, parce qu'on répare deux règles et non huit écrans.

### Défaut A — le réglage et la mesure occupent la place du travail

*Une chose qu'on pose une fois, ou qu'on ne regarde que quand ça va mal, prend la place de ce qu'on
fait tous les jours.*

| Où | Ce qui occupe la place | Ce que c'est vraiment |
|---|---|---|
| colonne de gauche du codex | les directions et les poses réclamées | un réglage du jeu, posé une fois |
| bas de tous les écrans du codex | un quart de la fenêtre, panneau de génération | des réglages, dont la plupart inutiles ici |
| sous chaque case d'un personnage | *ressemblance 0.37 · grille 7 px · dérive 1.00×* | des mesures utiles **quand ça rate**, pas en permanence |

### Défaut B — l'écran répond à une autre question que celle qu'on a posée

*On n'arrive jamais sur la chose, on arrive toujours sur son atelier.*

| On clique sur | On veut voir | On reçoit |
|---|---|---|
| **Équipement** | les équipements du jeu | des paragraphes de texte qui s'enchaînent |
| **le pèlerin** | ce qu'est le pèlerin | sa chaîne de production, avec du vide au centre |
| **un personnage**, depuis le codex | sa fiche | un écran à son nom qui fabrique des poses, et un lien minuscule vers sa fiche |

C'est aussi ce qui produit la collision du mot **fiche** : dans la galerie, la colonne de droite
d'une image *est* la fiche ; dans le codex, la fiche d'un personnage est un fragment de colonne
derrière un lien. **Un mot pour deux objets, et le chemin vers l'un des deux n'existe pratiquement
pas.**

---

## 4 · Ce qu'il a demandé qu'on vérifie plutôt que de le croire

Trois affirmations vérifiables, parce que la réparation n'est pas la même selon la réponse :

| L'affirmation | Pourquoi ça change tout |
|---|---|
| *le vert sur des poses non faites* | un calcul faux et un libellé trompeur ne se réparent pas au même endroit |
| *la galerie rame* | un audit du 31 août affirme que les vignettes calibrées existent et servent dans quatre écrans. **Si la galerie n'est pas l'un des quatre**, c'est la cause, et c'est peu de travail |
| *l'équipement sans images* | des données sans image, ou un écran qui ne les montre pas — deux chantiers très différents |

*(Réponse pour le troisième : voir `2026-09-04-modele-equipement.md`. Ce n'était ni l'un ni l'autre.)*

---

## 5 · Un défaut trouvé en chemin, consigné et non réparé

**Le figement de deux secondes.** Cliquer *éteindre* sur un champ de style, dans la fiche d'une
chose, bloque l'affichage environ deux secondes.

- **La cause** : `FicheChose.tsx:673-690` appelle `onPoser`, qui remonte à `Personnages.tsx:1294` —
  lequel fait un aller-retour serveur puis **remplace le personnage entier**. Pendant l'attente,
  **rien n'indique quoi que ce soit** : pas de bouton désactivé, pas de marque en cours, pas de
  jauge.
- **Ce n'est donc pas un écran lent, c'est un écran muet** — et un écran muet pendant deux secondes
  se lit comme un écran planté.
- **Six autres interrupteurs de la même famille sont à vérifier** : `Envoi.tsx:925`,
  `PanneauReglages.tsx:560`, `Assistant.tsx:1654`, `EcranReglages.tsx:404`, `Fiche.tsx:1183`,
  `Tables.tsx:548`.

C'est l'un des cinq écrans que l'audit d'août déclare **jamais examinés** : *ce que fait l'interface
pendant qu'elle attend*.
