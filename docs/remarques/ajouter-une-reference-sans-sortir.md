# Ajouter une image de référence sans quitter l'écran de confirmation

> **De quoi on parle.** Avant de payer une image, l'atelier ouvre une fenêtre qui montre tout ce qui
> va partir, et laisse **corriger** chaque ligne du texte pour cet appel-ci. En la lisant, on
> s'aperçoit parfois qu'il manque une image de référence. **Il faut alors sortir de la fenêtre pour
> aller la chercher — et tout ce qu'on venait de corriger est perdu.**

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> tant qu'on est dans cette section de confirmation de génération, j'aurai quand même aimer avoir
> la possibiltié de rajouter une ou des images de référence a la volé. La si je veux le faire je
> dois quitter et perdre mes modifs...

---

## 2 · Ce que le produit fait aujourd'hui

### a) Il faut vraiment sortir, et il n'y a aucun autre chemin

La fenêtre de confirmation **recouvre tout le produit**. Huit surfaces de l'atelier — la galerie,
le codex, l'univers, les tables, les dépenses, la planche… — sont explicitement effacées tant
qu'elle est ouverte ([App.tsx](interface/src/App.tsx), huit conditions `!envoiOuvert`). **Il n'y a
donc pas de moyen d'atteindre une image sans la refermer.**

Et dans la fenêtre, on peut **décocher** une image jointe, jamais en ajouter une : le seul geste
offert est une bascule sur une image déjà là
([Envoi.tsx:408](interface/src/composants/Envoi.tsx:408)).

### b) Le geste qui ajoute une référence change d'onglet, exprès

Pour faire repartir une image avec le prochain appel, on ouvre sa fiche dans la galerie et l'on
choisit *réinjecter*. Ce geste **fait changer d'onglet**, et c'est écrit
([App.tsx:1726](interface/src/App.tsx:1726)) : *« le geste va où son effet se voit […] réinjecter
depuis la fiche d'une image sans changer d'onglet laisserait l'auteur devant un geste dont rien n'a
bougé à l'écran, ce que le produit refuse partout ailleurs »*.

### c) Et changer d'onglet efface les corrections, exprès aussi

Le tri — la liste de ce qu'on a éteint, allumé ou réécrit — est **remis à vide** quand on change
d'onglet ([App.tsx:2147](interface/src/App.tsx:2147)), et **remis à vide à chaque réouverture** de
la fenêtre ([App.tsx:1314](interface/src/App.tsx:1314)). Là aussi c'est une décision écrite : *« le
tri repart de rien à chaque ouverture. Ce qu'on a éteint la fois d'avant ne vaut que pour l'appel
d'avant, et la garder en mémoire l'aurait démentie en silence. »*

### d) ⚠️ Ce que ça donne, et pourquoi la remarque est plus qu'un confort

**Aucune des trois décisions n'est fautive prise seule.** C'est leur rencontre qui coûte : la
fenêtre couvre tout, le geste qui ajoute une image force un changement d'onglet, et un changement
d'onglet vide les corrections. **L'auteur est devant un choix qu'aucune règle n'a voulu lui
imposer : garder ses corrections, ou ajouter l'image dont il vient de voir qu'elle manquait.**

Et c'est le pire moment pour ça : la fenêtre de confirmation est justement **l'endroit où l'on
s'aperçoit qu'une référence manque**, puisque c'est le seul endroit qui montre lesquelles partent.

---

## 3 · Pourquoi c'est comme ça

**La fenêtre a été pensée comme une lecture, pas comme un atelier.** On y vérifie, on corrige un
mot, on paie. Ajouter une image y était hors sujet — l'écran d'où l'on choisit ce qui repart est
ailleurs, et il a sa raison d'être ailleurs.

**La règle du tri visait un autre cas.** *Ce qu'on a éteint la fois d'avant ne vaut que pour l'appel
d'avant* : elle protège contre un réglage qui traînerait d'un appel au suivant. Elle n'a pas prévu
le cas où **on ressort et on revient pour le même appel** — c'est le même appel, et la règle le
traite comme un nouveau.

**Personne n'a mesuré le coût de la sortie**, parce que chacune des trois décisions a été prise
dans son écran, à un moment différent.

---

## 4 · Ce qui borne la solution

- **La fenêtre ne peut pas cesser de recouvrir le produit.** C'est ce qui en fait le seul endroit
  d'où l'argent part, et cette règle-là est un invariant.
- **Le tri ne doit pas survivre à un *autre* appel.** La règle est juste ; ce qui est à revoir est
  ce qu'elle appelle « un autre appel ».
- **Le geste *réinjecter* garde sa raison d'aller où son effet se voit** — sauf, précisément, quand
  son effet est déjà sous les yeux.
- **Rien ici ne coûte un centime** : choisir une image de référence ne fait aucun appel.
- **Le choix d'une image ne se réinvente pas.** Le produit a déjà des surfaces qui montrent et
  choisissent des images ; en dessiner une neuvième serait une neuvième façon de choisir.

---

## 5 · Les pistes

### A · Choisir une image depuis la fenêtre elle-même

Un geste *ajouter une référence ›* dans la section des images jointes, qui ouvre par-dessus la
fenêtre une surface de choix, et revient avec l'image ajoutée — **sans jamais refermer la
confirmation**.

**Ce que ça coûte** — la surface de choix est à dessiner, et c'est le gros du travail : quelles
images propose-t-elle, dans quel ordre, avec quel rôle. **Le risque** — une neuvième façon de
choisir une image si elle est inventée de zéro ; il faut réemployer une surface qui existe.
**C'est la piste qui répond à la lettre de la remarque.**

### B · Les corrections survivent à l'aller-retour

La règle du tri est précisée : il repart de rien quand **l'appel** change, pas quand l'écran
s'ouvre. Sortir chercher une image et revenir n'est pas un autre appel.

**Ce que ça coûte** — peu à écrire, et il faut savoir dire ce qu'est « le même appel ». **Le
risque** — c'est une **révision de décision écrite**, et elle doit être justifiée dans le fichier
qui la porte, pas contournée en silence. La règle protégeait d'un réglage qui traîne ; elle
continue de le faire si la comparaison porte sur ce qui part.

### C · *Réinjecter* ne change pas d'onglet quand la confirmation attend

Le geste garde sa règle — aller où son effet se voit — mais **son effet est déjà visible** quand la
fenêtre de confirmation est ouverte : la liste des images jointes est sous les yeux. Il n'y a donc
rien à aller montrer ailleurs.

**Ce que ça coûte** — presque rien. **Le risque** — seule, elle ne suffit pas : il faut quand même
refermer la fenêtre pour atteindre la fiche d'une image. **Elle n'a de sens qu'avec `B`**, et elle
devient inutile si l'on fait `A`.

### D · Ne rien faire, et le dire

Écrire que la fenêtre est une lecture, et qu'on prépare ses références avant. **Écarté d'avance** :
c'est justement là qu'on découvre ce qui manque, puisque c'est le seul endroit qui le montre.

---

## 6 · Ce qui est tranché — 4 septembre 2026

**Tranché par l'auteur : `B` puis `A`, les deux, en `V2.4`, tranche `M5`.**

### a) D'abord la perte, ensuite le confort

- **`B` — les corrections survivent à l'aller-retour.** La règle du tri est précisée : il repart de
  rien quand **l'appel** change, pas quand l'écran s'ouvre. C'est le vrai reproche, et c'est la
  moitié qui coûte le moins.
- **`A` — ajouter une référence sans refermer la fenêtre.** Elle vient ensuite, et elle est utile
  même si `B` est déjà là : `B` supprime la perte, `A` supprime le détour.

**L'ordre n'est pas indifférent** : `B` seule est déjà livrable, et elle rend l'écran acceptable
tout de suite. `A` seule laisserait la règle du tri intacte, donc la perte entière dès qu'on sort
pour une autre raison.

### b) La surface de choix ne s'invente pas

Le dépôt a un invariant là-dessus — **une seule grille d'assets dans tout le produit**. La surface
qui s'ouvre par-dessus la confirmation doit être celle-là, réemployée, et non une neuvième façon de
choisir une image. *C'est la contrainte principale de `A`, et c'est ce qui en fait la moitié la plus
chère.*

### c) `C` n'entre pas, et elle est absorbée

Empêcher *réinjecter* de changer d'onglet n'a plus d'objet une fois `A` faite : on n'aura plus à
sortir. *Si `A` devait tarder, elle redeviendrait un complément utile de `B`.*

### Ce qui reste ouvert

**Ce qu'est « le même appel ».** `B` demande de savoir dire quand un appel a changé, et la réponse
doit être écrite dans la décision qu'elle révise — pas devinée en construisant.

---

## Ce que cette remarque recoupe

- **`M4`** — l'écran de confirmation cesse de se contredire sur ses images. Même section de
  l'écran : celle-ci veut y **ajouter** une image, `M4` veut y **dire vrai** sur celles qui partent.
  Elles se construisent bien ensemble.
- **`M3`** — l'écran qui fige à chaque lettre. Même écran encore ; sans rapport de cause.
- **La règle du tri**, si `B` est retenue, est une décision écrite à réviser — comme `G6`, `G7` et
  `G8` en révisent trois autres. Le dépôt a un motif pour ça : on rouvre la décision plutôt que de
  la contourner.
