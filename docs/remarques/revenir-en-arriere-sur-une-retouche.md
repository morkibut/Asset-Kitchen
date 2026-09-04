# Revenir en arrière sur une retouche

> **De quoi on parle.** Chaque image de l'atelier porte une **recette** : la façon dont elle est
> détourée, remise sur grille, recadrée, ses couleurs réduites, son contour posé. On la règle à la
> main, table par table, parfois longuement. **Il n'existe aucun moyen de revenir au réglage
> d'avant.**

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> je me dis qu'on pourrait aussi plus tard implémenter un historique des retouches, qui permet de
> revenir en arrière

Écrit **pour bien plus tard**, en tranchant la pose d'une recette sur plusieurs images à la fois.

---

## 2 · Ce que le produit fait aujourd'hui

### a) Il n'y a qu'un réglage par image, et rien ne garde le précédent

Une image porte **un seul champ recette**. Le modifier écrase l'ancien. Deux gestes le vident
franchement, et aucun des deux n'a de retour : *tout défaire ›*, au bout de la barre, qui vide la
recette entière, et *Sans « la grille » ›*, au pied de chaque table, qui vide une place
([Tables.tsx:1556](interface/src/composants/Tables.tsx:1556)).

Et *revenir au brut* ne ramène pas au réglage d'avant : il ramène à **l'image nue**, telle qu'elle
est arrivée du modèle.

### b) Le disque ne garde rien non plus, et c'est écrit

On pourrait espérer retrouver l'ancienne image sur le disque. **Non** : il y a *un seul fichier de
rendu par emplacement, réécrit sur place*, et la raison est écrite —
[fichiers.py:173](atelier/depot/fichiers.py:173) : *« un nom par empreinte laisserait derrière lui
un rendu par réglage essayé — des dizaines de fichiers pour une image, et rien qui les ramasse »*.

**Mais cette décision-là parle d'images, pas de réglages** — et c'est la nuance qui change tout.
Mesuré : **une recette pèse 453 octets en moyenne**, la plus lourde du dépôt en fait dix mille.
**Garder les vingt derniers réglages de chacune des 164 images du dépôt tiendrait dans 2 Mo**, et
rejouer un réglage ne coûte pas un centime — la chaîne de traitement recalcule tout à partir de
l'image déjà payée. *Ce que le dépôt a refusé, ce sont des fichiers d'images qui s'accumulent. Ce
n'est pas ce qu'un historique demande.*

### c) Ce que l'absence coûte, mesuré

| | Combien |
|---|---|
| images vivantes du dépôt | **164** |
| **portant un réglage qu'on perdrait sans retour** | **131** |
| dont une retouche faite à la main | 6 |
| portant une recette nommée | 8 |

### d) C'est écarté par écrit, et il faut lire la raison

`docs/PRD.md` range hors périmètre *« l'historique des recettes appliquées, et le versionnement
d'une recette nommée »*, avec cette raison : *« remplacer sous le même nom se propose, il ne
s'archive pas »*.

**La raison porte sur le versionnement d'une recette *nommée*** — le fait qu'un modèle de réglages
enregistré n'ait pas de versions successives. **Elle ne dit rien du réglage d'une image donnée**,
qui est un autre objet. Les deux ont été écartés dans la même phrase ; ils n'ont pas la même
justification.

### e) C'est cette absence qui rend une tranche déjà écrite prudente

`G12` — *une recette sur plusieurs images* — porte deux liserés de protection, un orange sur les
images retouchées à la main et un rouge sur les calques qu'une recette décalerait, plus un bouton
pour tout désélectionner. **Tout cela existe parce qu'on ne peut pas revenir en arrière.** Le
critère de `G12` le dit à sa façon : *sur une image à la fois, on le verrait ; sur trente, non.*

**Le jour où l'on peut défaire, `G12` cesse d'avoir besoin de deux clics de prudence.**

---

## 3 · Pourquoi c'est comme ça

**Le produit a été bâti sur une idée forte, et elle est bonne** : le traitement n'est pas destructif
— l'image d'origine est toujours là, et la recette se rejoue. Tant qu'on règle **une image à la
fois**, ça suffit : on voit ce qu'on fait, et on refait le geste dans l'autre sens.

**Ce qui a changé, c'est l'échelle.** Poser un réglage sur trente images d'un coup, c'est trente
gestes qu'on n'a pas vus passer. L'idée fondatrice ne couvre plus le cas, et personne ne l'a
rouverte au moment où le lot est entré au plan.

---

## 4 · Ce qui borne la solution

- **Rejouer un réglage est gratuit** : aucune image n'est redemandée à un fournisseur.
- **Garder des réglages est bon marché ; garder des images ne l'est pas.** Le refus écrit vise les
  secondes.
- **Une recette nommée n'a pas de versions**, et cette décision-là reste : ce sont deux objets
  différents.
- **Ce n'est pas urgent.** L'auteur l'a écrit *pour bien plus tard*, et rien n'est cassé
  aujourd'hui — c'est un filet qui manque, pas un trou.

---

## 5 · Les pistes

### A · Un instantané avant un geste en lot, et lui seul

Avant de poser une recette sur une sélection, l'atelier garde les réglages d'avant **du lot**, et
offre *annuler ce lot ›* tant qu'on n'a rien fait d'autre. Rien pour les gestes à une image.

**Ce que ça coûte** — petit : une liste de réglages en mémoire, et un bouton. **Le risque** — aucun
sur le disque, et ça n'ouvre pas la question du versionnement.
**C'est le filet posé exactement là où est le danger**, et c'est ce qui permettrait à `G12` de
lâcher ses deux clics de prudence.

### B · Un pas en arrière sur chaque image

*Annuler le dernier réglage* sur n'importe quelle image, un seul cran. Le réglage d'avant est gardé
à côté du réglage courant.

**Ce que ça coûte** — un champ de plus par image, quelques centaines d'octets. **Le risque** —
*« un seul cran »* déçoit dès qu'on a fait deux gestes, et l'on demandera le second.

### C · Un vrai historique par image

Les N derniers réglages, avec la date, et l'on revient à celui qu'on veut. **Mesuré : vingt
réglages pour chacune des 164 images du dépôt tiennent dans 2 Mo.**

**Ce que ça coûte** — un écran à dessiner, une purge à décider, et une question à trancher : que
devient l'historique quand l'image est supprimée ? **Le risque** — c'est ce que le PRD a écarté,
donc il faut **rouvrir la décision par écrit**, pas la contourner.

### D · Rien, et le confirmer

Garder l'écart, et écrire ce qui le remplace : `G12` porte ses liserés, on règle une image à la
fois, et l'on refait le geste dans l'autre sens.

**Ce que ça coûte** — rien. **Le risque** — la prudence de `G12` reste, donc le lot reste
inconfortable ; et le jour où un geste en lot écrase trente réglages, il n'y aura rien à répondre.

---

## 6 · Ce qui est tranché

*Rien n'est encore tranché — à arbitrer avec l'auteur.*

**La recommandation est `A`, et pas maintenant.** Elle est bien plus petite que ce que l'auteur
imaginait, elle pose le filet là où le danger est réellement — le lot —, et elle **n'ouvre pas** la
décision que le PRD a fermée. Elle se construit naturellement **avec `G12`**, pas avant.

*Ce qui est à corriger dès maintenant, et qui ne coûte rien : la phrase du PRD range deux choses
différentes sous une seule raison.* Le versionnement d'une recette nommée reste écarté ; l'historique
du réglage d'une image mérite sa propre ligne, avec sa propre raison.

---

## Ce que cette remarque recoupe

- **`G12`** — une recette sur plusieurs images. C'est la tranche que cette absence rend prudente, et
  celle avec laquelle le filet se construirait. **Les deux se lisent ensemble.**
- **Le hors-périmètre du PRD**, à préciser : deux objets y partagent une raison qui n'en couvre
  qu'un.
