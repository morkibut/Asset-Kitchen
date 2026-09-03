# L'écran de confirmation fige à chaque lettre tapée

> **De quel écran on parle.** Avant qu'une image soit payée, l'atelier ouvre une fenêtre qui montre
> tout ce qui va partir chez le fournisseur : le texte assemblé ligne par ligne, les images
> jointes, et le prix. On peut y corriger une ligne du texte pour cet appel-ci. **C'est en tapant
> dans cette fenêtre que l'écran se bloque.**

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> quand on corrige un texte dans la fenetre de confirmation juste avant de payer la génération, a
> chaque lettre qu'on tape, ca freeze car ca recalcule ce qui part. il faut améliorer ca. on peut
> recalculer ce qui part que quand on valide le texte modifié en fermant (changer le lien fermer
> par un bouton "valider").

---

## 2 · Ce que le produit fait aujourd'hui

### a) Le mécanisme est bien celui que l'auteur décrit

Chaque lettre tapée dans une ligne corrigeable écrit dans le tri — la liste de ce qui est allumé,
éteint ou réécrit ([Envoi.tsx:159](interface/src/composants/Envoi.tsx:159)). Le tri est une des
dépendances de l'effet qui redemande au serveur ce qui part
([App.tsx:1478](interface/src/App.tsx:1478)). **Une lettre, un aller-retour.** Un mot de dix
lettres, dix allers-retours enchaînés.

L'aller-retour rapporte **le texte et le prix ensemble**, et c'est une décision écrite : *« un écran
qui demanderait son texte à une route et son prix à une autre finirait par afficher un texte d'avant
à côté d'un prix d'après »*. Il ne peut donc pas être coupé en deux.

**Rien n'est facturé, rien n'est enregistré, l'appel ne sort pas de la machine.** Le problème n'est
pas l'argent, c'est le temps.

### b) ⚠️ Mais la lenteur n'a rien à voir avec la frappe — et c'est ça, la trouvaille

L'auteur suppose que recalculer ce qui part est coûteux par nature. **Mesuré le 4 septembre 2026 sur
son cas exact** — un sac de voyage posé sur une pose du pèlerin, projet *Le Marais du Vieux
Moulin*, sur une copie de ses vraies données — ce n'est pas le calcul qui coûte. **C'est que
l'atelier relit le projet quarante-deux fois pour composer un seul écran.**

| Ce qu'on demande | Lectures du projet | Le temps que ça prend |
|---|---|---|
| l'aperçu du texte seul | **5** | 27 ms |
| l'écran de confirmation, pour une image ordinaire | **15** | 122 ms |
| **l'écran de confirmation, pour un équipement** — le cas de la remarque | **42** | **322 ms** |

Le temps suit le nombre de lectures, à peu près huit millisecondes chacune. **Rien d'autre ne
compte.**

**Ce qu'est une « lecture du projet ».** Le projet du jeu — son univers, ses personnages, ses
emplacements d'équipement, ses réglages — est rangé en un seul bloc dans la base, 5,4 Ko pour ce
jeu-là. Chaque lecture **ouvre une connexion neuve à la base, pose deux réglages, lit le bloc,
le transforme en objet complet, puis referme**
([base.py:745](atelier/depot/base.py:745) et [base.py:146](atelier/depot/base.py:146)). Ce n'est pas
un gaspillage caché : la connexion refermée à chaque fois est une décision écrite, prise pour que
le fichier de la base puisse être supprimé sous Windows. **Ce qui n'a jamais été décidé, c'est de
le faire quarante-deux fois de suite pour une seule question.**

Le compte vient de ce que chaque petit service redemande le projet pour son propre compte : la
liste des personnages est relue dix-huit fois, l'ambiance quatre fois, et ainsi de suite — chacun
poliment, aucun au courant des autres.

### c) Et le curseur saute à la fin — relevé par l'auteur le 4 septembre 2026

> *« à chaque relecture mon curseur est transporté à la fin de l'input, donc si je modifiais le
> début ou le milieu c'est chiant »*

**C'est un défaut à part, et il explique pourquoi corriger le milieu d'une ligne est impraticable
là où taper à la fin n'est que lent.**

Le champ de correction n'a **aucune mémoire à lui** : ce qu'il affiche vient directement de la
dernière réponse du serveur ([Envoi.tsx:958](interface/src/composants/Envoi.tsx:958)). Ce qui se
passe à chaque lettre :

1. on tape une lettre, elle part dans le tri ;
2. l'écran se redessine **avant** que le serveur ait répondu — le champ affiche donc encore le texte
   d'*avant* la lettre ;
3. le navigateur, à qui l'on réécrit le contenu d'un champ, **replace le curseur à la fin** ;
4. trois cents millisecondes plus tard la réponse arrive, le texte est réécrit une seconde fois, et
   le curseur repart à la fin.

**Deux sauts par lettre**, et entre les deux le champ montre un texte en retard d'une frappe. Taper
à la fin d'une ligne masque le défaut, puisque la fin est justement là où le curseur atterrit.

### d) Ce que ça donne si on lit le projet une seule fois

Mesuré le 4 septembre 2026, **quarante mesures en alternant les deux façons de faire**, sur la même
machine au même instant, pour que la charge de fond ne fausse pas la comparaison :

| | Le temps par lettre tapée |
|---|---|
| tel quel | **351 ms** |
| le projet lu **une seule fois** par appel | **100 ms** |

**Soit 71 % de moins, sans toucher à l'interaction.** La machine était chargée pendant cette
série ; à vide, la même mesure donnait 139 ms tel quel. Dans les deux cas le rapport tient.

---

## 3 · Pourquoi c'est comme ça

**Personne n'a écrit « relis le projet quarante-deux fois ».** C'est la somme de quarante-deux
décisions raisonnables prises séparément : un service qui a besoin du projet le demande, et
demander est bon marché — pris un par un. La composition de ce qui part est le seul endroit du
produit qui les appelle *tous*, et c'est là que l'addition se voit.

**L'écran, lui, n'a rien fait de mal.** Redemander à chaque frappe est la façon dont tout le
produit se tient à jour, et elle est juste tant que la réponse arrive vite. Elle est devenue
visible ici parce que l'écran de confirmation d'un équipement est **le plus cher de tous** — c'est
le seul qui doit relire les emplacements du corps, les pièces, les poses et les références en même
temps.

**Aucun essai ne pouvait le rattraper.** Le dépôt vérifie ce que l'écran affiche, jamais combien de
fois il a interrogé la base pour l'afficher.

---

## 4 · Ce qui borne la solution

- **Le texte et le prix restent dans le même aller-retour.** La règle est écrite et elle est juste ;
  la remarque ne la remet pas en cause.
- **La connexion refermée à chaque opération ne bouge pas.** Elle a sa raison écrite — pouvoir
  effacer le fichier de la base — et c'est un critère du produit depuis `T3`.
- **Rien ici ne coûte un centime**, ni avant ni après : tout se vérifie serveur du fournisseur
  coupé.
- **Ce qui s'affiche ne doit jamais être en retard sur ce qui est écrit.** C'est ce qui rend la
  proposition de l'auteur — ne recalculer qu'à la validation — moins évidente qu'elle n'en a l'air :
  entre la frappe et la validation, le prix affiché serait celui d'avant.

---

## 5 · Les pistes

### A · Le projet lu une seule fois par demande

Composer ce qui part en lisant le projet **une fois**, et faire circuler ce qu'on a lu au lieu de le
redemander. Aucun changement visible : mêmes écrans, mêmes gestes, même contrat.

**Ce que ça coûte** — un passage sur la composition, sans nouveau concept. **Mesuré : 71 % de moins.**
**Le risque** — faible, et il est nommable : si une écriture survenait pendant la composition, on
travaillerait sur une photo du projet légèrement en retard. Composer ne dure que quelques
centièmes de seconde, et rien n'écrit pendant qu'on regarde ce qui va partir.
**Et ça ne profite pas qu'à cet écran** : les quinze lectures de l'écran ordinaire et les cinq de
l'aperçu du texte baissent aussi.

### B · Attendre que la frappe s'arrête

Ne redemander qu'après un court silence au clavier — le temps qu'on lève les doigts. Le texte
affiché reste vrai, il arrive simplement un instant après.

**Ce que ça coûte** — quelques lignes sur un seul écran. **Le risque** — c'est un pansement : il
cache le prix au lieu de le payer, et le même écran redeviendra lent le jour où il aura une chose
de plus à composer. **Il ne se justifie qu'après A**, où il achève de rendre la frappe insensible.

### C · Ne recalculer qu'à la validation — la proposition de l'auteur

Remplacer le lien *fermer* d'une ligne corrigée par un bouton *valider*, et ne redemander qu'à ce
moment-là.

**Ce que ça coûte** — un geste de plus à chaque correction, et un bouton à dessiner. **Le risque** —
tant qu'on n'a pas validé, **l'écran montre un prix et un texte qui ne correspondent plus à ce
qu'on lit** : c'est exactement ce que la règle *le texte et le prix ensemble* voulait empêcher, et
ça revient par la porte de derrière. À retenir seulement si A et B ne suffisaient pas.

### D · Ne redemander que le morceau qui a changé

Écarté d'emblée, et il faut dire pourquoi : ce serait couper le texte du prix, ce que le produit
s'interdit par écrit.

---

### E · Le champ garde son texte pendant qu'on écrit

Le champ de correction tient sa propre valeur tant qu'il a le curseur, et ne la renvoie au reste de
l'écran qu'une fois la frappe posée. Ce qu'on voit est alors toujours ce qu'on a tapé, et le
navigateur n'a plus de raison de déplacer le curseur.

**Ce que ça coûte** — un seul composant à reprendre, et c'est le motif habituel d'un champ qu'on
édite. **Le risque** — il faut décider ce qui gagne si le serveur renvoie un texte différent
pendant qu'on écrit ; la réponse est simple ici, puisque le serveur ne fait que renvoyer ce qu'on
vient de lui donner. **C'est la piste qui rend les deux autres utiles** : sans elle, espacer les
appels ne fait qu'espacer les sauts de curseur.

---

## 6 · Ce qui est tranché — 4 septembre 2026

**Tranché par l'auteur : les trois pistes ensemble, et la réparation vise toute la composition.**

### a) Les trois défauts sont réparés dans la même tranche — `M3` de la `V2.4`

- **`A` — le projet lu une fois par demande**, et pas seulement pour cet écran : les quarante-deux
  lectures de la confirmation d'un équipement, les quinze de l'écran ordinaire et les cinq de
  l'aperçu du texte viennent du même endroit. *Tranché : on répare la composition entière, une fois,
  plutôt que d'y revenir écran par écran.*
- **`B` — on attend que la frappe se pose** avant de redemander.
- **`E` — le champ garde son texte et le curseur ne bouge plus.** Ajouté par l'auteur au moment de
  l'arbitrage ; c'est le défaut qui rend la correction du milieu d'une ligne impraticable, là où les
  deux autres ne la rendaient que lente.

### b) La proposition de départ est écartée, et par son auteur

Le bouton *valider* à la place du lien *fermer* n'entre pas. Sa raison de vivre était de supprimer
les allers-retours ; une fois `A` et `B` posées, il ne reste plus d'aller-retour à supprimer, et il
aurait coûté un geste de plus par correction **plus** l'écart entre ce qu'on lit et ce que le prix
affiche.

### Ce qui reste ouvert

**Rien dans cette remarque.** *Le relevé des autres écrans du produit — la toile, le codex, la fiche
d'un personnage — n'a pas été fait : la réparation de la composition ne les couvre que s'ils
passent par elle.* À voir si la lenteur s'y montre.

---

## Ce que cette remarque recoupe

- **Les trois autres remarques du même écran**, du même jour : la légende des références mal placée
  et le libellé fautif du *« gabarit »*, l'ajout d'une image de référence sans quitter l'écran, et
  les mots qui parlent de *cases* pour une seule case. Elles portent sur ce que l'écran **dit** ;
  celle-ci sur ce qu'il **fait**. Elles peuvent se traiter séparément.
- **Le relevé des lectures du projet dépasse cet écran.** Quinze lectures pour une image ordinaire,
  cinq pour le seul aperçu du texte : le motif est général, et la remarque n'en voit qu'un cas.
  *À décider : la réparation vise-t-elle la composition entière, ou ce seul écran ?*
