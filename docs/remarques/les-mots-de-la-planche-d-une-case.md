# Les mots de la planche, quand elle n'a qu'une case

> **De quoi on parle.** Quand un jeu regarde le monde de dessus, marcher n'est pas une image mais
> quatre — nord, sud, est, ouest. Un modèle fait payer chaque *appel*, pas chaque image : l'atelier
> demande donc les quatre d'un coup, sur une seule feuille qu'il découpe ensuite. C'est ce qu'il
> appelle une **planche**, et chaque image de la feuille est une **case**.
>
> **Poser un casque sur un personnage passe par le même chemin** — et là, la feuille n'a souvent
> qu'une case. D'où la question : pourquoi parler de planche et de cases pour une seule image ?

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> Pourquoi (voir screen toujours) on envoi une planche et on parle de case de la planche quand on
> demande pas une planche mais une seule génération d'une seule pose ? est-ce que c'est fait exprés
> et logique ?

---

## 2 · Ce que le produit fait aujourd'hui

### a) Oui, c'est délibéré — et la raison est écrite

Une pose qu'on **crée** n'est jamais pliée en dessous de deux cases : plier pour une seule ferait
payer un gabarit et une consigne de grille pour rien
([generation.py](atelier/services/generation.py), *« rien en dessous de deux »*).

Une pièce posée sur un corps, elle, l'est **toujours** — même à une case
([equipement.py](atelier/services/equipement.py), `plier()` : *« une seule pose suffit […] un calque
ne se fabrique que par une planche, fût-elle d'une case »*). La raison est mécanique : habiller
consiste à **renvoyer la même planche avec la pièce en plus**, et le calque se fabrique par
différence entre les deux. Sans planche, il n'y a rien à comparer.

**La question est donc close sur le fond : la mécanique est juste, et elle est justifiée.**

### b) ⚠️ Mais le texte qui part est faux, et pas seulement à une case

Le texte envoyé au modèle est composé avec les nombres de la grille, sans jamais accorder :

> *« The attached image is a sprite sheet of **1 sprites** of the same character, laid out in
> exactly **1 columns** and **1 rows** »*

**Mesuré le 4 septembre 2026 sur les vraies planches du dépôt** — la faute apparaît dès qu'une
dimension vaut un, ce qui est le cas courant et non l'exception :

| Cases | La grille | Ce qui est faux |
|---|---|---|
| **1** | 1 × 1 | *1 sprites*, *1 columns*, *1 rows* |
| **2** | 2 × 1 | *1 rows* |
| 3 et au-delà | 2 × 2, 3 × 2… | rien |

| | Combien |
|---|---|
| planches du dépôt | **22** |
| **planches qui ont reçu un pluriel faux** | **14, soit 64 %** |
| **planches d'équipement dans ce cas** | **7 sur 7, soit toutes** |

**Et ce n'est pas qu'une faute de grammaire.** À une case, le texte affirme au modèle qu'il regarde
une feuille de contact quadrillée, lui demande de *garder exactement la même grille*, et lui
interdit *les bordures de cases et les lignes de grille* — pour une image qui n'a ni cases ni
grille. Ce qui part est **une description de ce que l'image n'est pas**.

**Ce que ça coûte réellement n'est pas mesuré**, et il faut le dire : le savoir demanderait des
tirages payés, avec et sans, sur un même sujet. *Ce qui est établi, c'est que 100 % des planches
d'équipement du dépôt partent avec cette description.*

**Le texte est volontairement redondant, et ça ne se rediscute pas** : un banc du 28 août 2026 l'a
étalonné, et la règle qu'il en tire est que *tout ce qu'on ne dit pas explicitement « ne change
pas » est une invitation à le changer*. Ce qui est en cause ici n'est pas la redondance, c'est
qu'elle décrive une grille inexistante.

### c) ⚠️ Et une phrase de l'écran est devenue fausse la veille

Trouvée en vérifiant ce point, hors du périmètre de la remarque. L'écran de la planche affirme :

> *« la planche n'y entre **pas** — ses N morceaux, oui, chacun dans sa direction. C'est une ruse
> pour payer moins, pas un format de livraison. »*
> — [Planche.tsx:217](interface/src/composants/Planche.tsx:217)

**C'était vrai jusqu'au 3 septembre 2026 à 23 h 45**, heure de la livraison de `G16`. Depuis, la
planche **entre en bibliothèque** : elle s'y regarde, s'y met en favori et s'en exporte, et un
fichier entier du produit ne décrit qu'elle. L'invariant qui portait cette phrase — *le pliage est
une ruse d'appel, jamais un format de livraison* — est **renversé**, et le plan l'écrit.

L'écran de la planche n'a pas été touché depuis la tranche qui l'a créé. **C'est une dixième phrase
du même genre que celles de `G1`**, écrite juste, démentie par un changement venu d'ailleurs — et
elle a tenu **un jour**.

### d) Ce que l'écran dit des cases, lui, est déjà accordé

Le reproche sur *les cases au pluriel pour une case* ne porte presque plus : les comptes de l'écran
sont accordés partout (*« 1 case »*, *« 2 cases »*). **Il reste une phrase**, et c'est celle du
*gabarit* — *« où poser les 1 sujets »* — présente à la fois sur l'écran de confirmation et sur
celui de la planche. **Elle est déjà prise par `M4`**, qui refait cette phrase de bout en bout.

---

## 3 · Pourquoi c'est comme ça

**Le texte a été écrit pour le cas qui l'a fait naître**, la planche de quatre directions, où tous
les nombres sont au pluriel. La planche d'une case est arrivée après, par un autre chemin —
l'équipement — et a réemployé le même texte sans que personne ne relise les accords.

**La phrase de l'écran de la planche, c'est le motif de la `V3.1`, pris sur le fait.** Elle était
mesurée et vraie ; une tranche livrée ailleurs l'a démentie ; rien ne l'a signalée. La `V3.1` avait
prévenu que rien dans le produit n'empêchait la dixième — **la voici, un jour après**.

---

## 4 · Ce qui borne la solution

- **La mécanique ne bouge pas.** Une planche d'une case reste une planche : c'est ce qui permet de
  fabriquer un calque.
- **La redondance du texte ne bouge pas non plus** : elle est étalonnée.
- **Rien ici ne coûte un centime à réparer** — accorder des mots et corriger une phrase d'écran se
  vérifient hors ligne. *Mesurer le gain, lui, coûterait des tirages.*
- **Une phrase du produit doit être vraie au moment où on la lit.** C'est la thèse entière de la
  `V3.1`, et elle s'applique ici sans discussion.

---

## 5 · Les pistes

### A · Le texte s'accorde, et cesse de décrire une grille absente

Deux choses, et elles vont ensemble : les nombres s'accordent (*1 sprite*, *1 column*, *1 row*), et
**à une seule case le texte dit ce que l'image est** — une image unique à modifier — au lieu de
parler de feuille, de cases et de lignes de grille.

**Ce que ça coûte** — un texte à écrire, une condition à poser. **Le risque** — c'est un texte qui
part au modèle : le changer change ce qui revient, donc **invalide les comparaisons avec les
tirages déjà payés**. Le dépôt a déjà accepté ce prix pour `D3`, en l'écrivant.

### B · N'accorder que les nombres

Le minimum : *1 sprite*, *1 column*, *1 row*, et rien d'autre ne change.

**Ce que ça coûte** — presque rien. **Le risque** — la description reste fausse sur le fond : elle
continue de parler d'une grille à une image qui n'en a pas. *On répare la grammaire, pas le
mensonge.*

### C · La phrase de l'écran de la planche est réécrite

*« La planche n'y entre pas »* devient ce qui est vrai depuis `G16` : elle y entre, avec son coût,
et ses morceaux à côté.

**Ce que ça coûte** — une phrase. **Le risque** — aucun. **C'est indépendant du reste**, et ça peut
partir seul.

---

## 6 · Ce qui est tranché — 4 septembre 2026

**Sur le fond de la question posée : oui, c'est fait exprès, et c'est logique.** Rien n'est à
changer à la mécanique, et ce point est clos.

**Tranché par l'auteur : `C` et `A`, et la remarque est fondue dans `M4`.**

### a) Les deux pistes retenues

- **`C` — la phrase de l'écran de la planche est réécrite.** Elle affirme le contraire de ce que le
  produit fait depuis la veille. Une phrase, aucun risque.
- **`A` — le texte qui part s'accorde **et** cesse de décrire une grille absente.** Pas seulement la
  grammaire : à une case, le texte dit ce que l'image est.

`B` — n'accorder que les nombres — est écartée : elle réparerait la grammaire en laissant le
mensonge.

### b) Elle ne prend pas de tranche à elle, et c'est délibéré

**Elle est fondue dans `M4`**, avec la remarque sur l'écran de confirmation. La raison tient en un
fait : la phrase à accorder est composée **juste à côté** de la légende que `M4` recopie sous chaque
image. Ce sont deux remarques d'un même défaut — **la planche est mal décrite, à trois endroits** :
sur l'écran qui montre ce qui part, dans le texte qui part, et sur l'écran de la planche.

### c) ⚠️ Le prix est accepté, et il est écrit

Changer ce qui part au modèle **invalide les comparaisons avec les tirages déjà payés** sur les
planches d'une et de deux cases. C'est le prix que `D3` a accepté en l'écrivant, et il est accepté
ici de la même façon.

### Ce qui reste ouvert, et qui a été écarté

**Écrire quelque part pourquoi une planche d'une case existe.** *Écarté par l'auteur le 4 septembre
2026.* Un auteur qui en voit passer une n'a toujours aucun moyen de l'apprendre — la question se
rouvre si elle revient.

---

## Ce que cette remarque recoupe

- **`M4`** — l'écran de confirmation cesse de se contredire sur ses images. **C'est le même
  paragraphe de texte** : la légende que `M4` recopie sous chaque image est composée juste à côté
  de la phrase à accorder. *Les faire ensemble évite d'y revenir.*
- **`G1`** — les phrases qui ont cessé d'être vraies, close le 3 septembre 2026. La phrase de
  l'écran de la planche en est une dixième, née le jour même de la clôture.
- **`P1`** — le dépliage généralisé. Elle hérite de la moitié de `G16` ; c'est elle qui portera ce
  que devient une planche qu'on déplie plusieurs fois, donc ce que l'écran devra en dire.

---

## Ce que la tranche a livré — 4 septembre 2026

**Traitée avec `M4`, comme la remarque le proposait**, et pour la raison qu'elle donnait : c'est le
même paragraphe de texte.

**Les nombres s'accordent**, et l'accord s'écrit à un seul endroit. **À une seule case, la consigne
de planche est autre** : elle ne contient plus un seul mot de grille — ni *sheet*, ni *cell*, ni
*column*, ni *row*, ni *border* —, et les six garanties de non-changement y sont reprises mot pour
mot, dites de l'image entière au lieu de la case. La légende de l'image jointe change avec elle :
les deux phrases du même prompt disaient la même chose fausse.

**Le prix annoncé est payé tel quel** : les comparaisons avec les tirages déjà payés ne valent plus
sur les planches d'une et de deux cases, **et sur elles seules** — à trois cases et au-delà, la
grille la plus carrée n'a jamais de dimension à un, et le texte est identique au caractère près.

**Ce qui restait écarté le reste** : nulle part le produit n'explique pourquoi une planche d'une
case existe. La question se rouvrira si elle revient.

*Le détail de ce que la construction a appris est dans `docs/status/etat.md`, à l'entrée du
4 septembre 2026 ; les critères d'acceptation tenus sont dans `docs/PLAN.md`.*
