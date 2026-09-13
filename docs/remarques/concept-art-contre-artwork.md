# « Concept art de » et « Artwork officiel »

> **État : tranchée.** Le décompte du § 2 est mesuré sur le dépôt de l'auteur. Une phrase du
> recueil dit le contraire de ce que fait le code, et c'est celle qu'on ouvre pour comprendre la
> différence. Les trois questions sont arbitrées ; ce qu'il faut construire est au § 7.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> 6. je comprend pas bien la différence sur la toile de l'univers entre "concept art de" et je
> choisi une entité, et Artwork officiel "promu".
> c'est pas clair, ca dmeande une explication et peut-être des modifications.

---

## 2 · Ce que le produit fait aujourd'hui

Les deux réglages sont **dans le même menu, l'un sous l'autre**, sur une carte image de la toile :
*Concept art de* d'abord ([`Tableau.tsx:1424`](../../interface/src/composants/Tableau.tsx#L1424)),
une bascule par chose du projet ; *Artwork officiel* juste après
([`Tableau.tsx:1470`](../../interface/src/composants/Tableau.tsx#L1470)), un bouton *promouvoir*
puis, s'il est allumé, le choix d'une famille.

Rien à l'écran ne dit qu'ils ne font pas la même chose. Or ils diffèrent sur **cinq points**, dont
trois qui ne sont écrits nulle part :

| | **Concept art de « X »** | **Artwork officiel** |
|---|---|---|
| **Part avec quoi** | chaque génération de X | chaque génération dont la famille du sujet correspond, **plus** les cartes marquées « tous » |
| **Filtré par famille** | non — l'auteur l'a désignée pour cette chose-là | oui, c'est tout son mécanisme |
| **Donne ses couleurs à la palette du jeu** | **non, jamais** | **oui** — promouvoir est l'un des deux seuls gestes qui la recalculent |
| **Ce qu'il dit au modèle** | rôle `style` — *voilà l'allure* | rôle `style` — le même |
| **Qui cède quand le modèle plafonne** | en **dernier** | en **premier** |
| **Sa marque sur la carte** | coin haut-**gauche**, teinte épingle, 13 px | coin haut-**droit**, teinte signal, 13 px |
| **Ce que le pied de carte écrit** | le nom des choses qui la désignent — **sauf si la carte est aussi promue**, et alors il n'écrit que la famille | la famille, toujours |

Les preuves, dans l'ordre du tableau :
[`production.py:2056`](../../atelier/services/production.py#L2056) ne filtre rien ·
[`univers.py:1272`](../../atelier/services/univers.py#L1272) filtre sur la famille ·
[`univers.py:1500`](../../atelier/services/univers.py#L1500) ne lit que `c.artwork` ·
[`generation.py:2184`](../../atelier/services/generation.py#L2184) pose les deux en `style` ·
[`generation.py:1766`](../../atelier/services/generation.py#L1766) fait céder « du plus large au
plus étroit » · [`Tableau.tsx:1004`](../../interface/src/composants/Tableau.tsx#L1004) et
[`Tableau.tsx:1023`](../../interface/src/composants/Tableau.tsx#L1023).

### Ce que ça donne sur le tableau de l'auteur — mesuré le 3 septembre 2026

Six désignations existent dans le dépôt. **Quatre ne font rien.**

**Le projet du pèlerin.** Six cartes, toutes en famille « tous », deux promues.

| La carte | Promue ? | Famille | Désignée par |
|---|---|---|---|
| `2b40a48e` | **oui** | tous | Le pèlerin |
| `a1d9d1bc` | **oui** | tous | Le garde du moulin |
| `fe3e766d` | non | — | La grenouille des tourbières |
| `05119ae7` | non | — | La grenouille des tourbières |
| `a760f391` · `1810ccb5` | non | — | personne |

Les deux premières lignes sont des **gestes inertes**. Une carte promue en famille « tous » part
*déjà* avec toutes les générations du projet ; la désigner en plus comme concept art du pèlerin
n'ajoute rien — ni une image de plus, ni un centime. Les deux lignes de la grenouille, elles, sont
**décisives** : sans la désignation, ces cartes ne partiraient jamais.

**Le même geste, sur quatre cartes voisines, est deux fois sans effet et deux fois tout — et rien
à l'écran ne dit laquelle.** Le projet d'animation ajoute deux désignations de plus, toutes deux
sur des cartes déjà promues en « tous » : deux gestes inertes de plus.

### Et le recueil dit le contraire du code

L'entrée `carte.officiel` écrit, en réponse à *« qu'est-ce que ça change ? »* :

> C'est l'interrupteur. **Une carte non promue ne part jamais**, quoi qu'il y ait dans son groupe
> ou sa famille. — [`aide.ts:321`](../../interface/src/aide.ts#L321)

**C'est faux.** Les deux cartes de la grenouille ne sont pas promues et partent à chaque
génération de la grenouille. La phrase est vraie du groupe et de la famille — les deux choses
qu'elle nomme — et fausse de la seule autre chose qui existe dans le même menu, celle-là même que
l'auteur cherchait à distinguer quand il a ouvert la bulle.

C'est le pire endroit possible pour une phrase fausse : **l'explication qu'on ouvre pour lever la
confusion est ce qui l'installe.**

---

## 3 · Pourquoi c'est comme ça

**Les deux réglages n'ont pas le même âge, et ils ne répondent pas à la même question.**
*Promouvoir* est de la V1 (US-48, US-51) : il répond à *« qu'est-ce qui définit le style de mon
jeu ? »*, et son mécanisme entier est le filtre par famille — le banc du 26 août avait montré
qu'un artwork figuratif contamine les sujets suivants, le squelette héritant de la tunique et des
bottes lacées du goblin. *Concept art de* est bien postérieur (US-124) et répond à *« comment je
repars de mes références au lieu de les redécrire en prose ? »* Le filtre par famille n'y a pas de
sens : l'auteur a déjà répondu en désignant une chose précise.

**Le filtre est la raison pour laquelle promouvoir touche la palette, et pas désigner.** La
palette du jeu se déduit des artworks officiels — c'est une définition, pas un effet de bord — et
promouvoir ou rétrograder sont les deux seuls gestes qui la recalculent
([`univers.py:717`](../../atelier/services/univers.py#L717)). Un concept art n'est pas une
définition du style du jeu ; il est une référence pour une chose. Il serait faux qu'il colore tout
le jeu. La logique est bonne — **c'est de ne jamais l'avoir dite qui ne l'est pas.**

**Le dépôt a déjà diagnostiqué cette maladie, un rang plus haut.** Le recueil porte ce
commentaire, écrit pour `groupe` et `famille` :

> Les deux premières entrées sont celles qui ont provoqué tout ce chantier : voisines dans le même
> menu, **l'une inerte et l'autre décisive**, et rien à l'écran ne les distinguait.
> — [`aide.ts:277`](../../interface/src/aide.ts#L277)

Deux rangs plus bas, dans le même menu, la même paire s'est reformée : `concept` et `officiel`
sont voisines, et sur le tableau de l'auteur l'une est inerte quatre fois sur six. **Le remède
avait été écrit ; il n'a pas été redescendu d'un cran.**

---

## 4 · Ce qui borne la solution

- **Une explication ne se recopie jamais** (R4, étendu en R8). Ce qui manque se corrige dans le
  recueil, pas en tapant un paragraphe dans l'écran. Une phrase *écrite pour cet écran-ci*, qui ne
  duplique aucune entrée, reste permise — c'est exactement ce que R8 a tranché.
- **Aucune sélection manuelle des artworks au moment de générer.** Le cadrage l'écarte
  explicitement : promouvoir est un geste unique. Toute piste qui ramènerait un « choisis tes
  références à chaque appel » est hors sujet.
- **Une carte peut légitimement être les deux**, et deux cartes du dépôt le sont. Rien ne doit
  interdire cet état.
- **Le manque n'a aucune couleur d'alerte, rien ne réclame jamais rien.** Dire à l'auteur qu'un
  geste n'a rien changé ne doit pas ressembler à un reproche.
- **Trois glyphes seulement**, et les deux coins de 13 px sont déjà posés. On ne peut pas en
  inventer un troisième.
- **Le pied de carte tient sur une ligne**, et il porte déjà trois choses qui se disputent la
  place : la famille, les désignateurs, le groupe.
- **Hauteurs closes** `44 · 38 · 34 · 30 · 26` : les bascules sont à 26, et une ligne de texte
  ajoutée sous elles doit tenir dans ce que le menu a déjà.

---

## 5 · Les pistes

### A · Corriger la phrase fausse, et ajouter celle qui manque

Deux retouches dans `aide.ts`, rien d'autre. `carte.officiel` cesse de dire *« une carte non
promue ne part jamais »* et dit ce qui est vrai : *c'est l'interrupteur du jeu entier ; une carte
non promue ne part avec aucun sujet — sauf pour la chose qui l'a désignée en concept art*. Et
`carte.concept` gagne la ligne qui manque : *désigner ne donne aucune couleur à la palette du jeu ;
promouvoir seul le fait.*

**Coût** : une demi-heure. **Risque** : aucun. **Ce que ça ne fait pas** : ça n'aurait pas dit à
l'auteur que quatre de ses six désignations ne servent à rien. C'est un plancher, pas une réponse.

### B · Renommer les deux réglages pour que leur différence soit dans leur nom

*Artwork officiel* → **« Référence de tout le jeu »**, et *Concept art de* → **« Référence de
cette chose »**. Le mot *artwork officiel* reste, en second, là où il est déjà — sur le coin, dans
le pied de carte, dans le recueil —, parce que c'est un terme du produit qui vit dans quinze
documents. Ce qui change est **l'étiquette du réglage**, qui est ce que l'auteur lit au moment de
décider.

**Coût** : deux chaînes dans `Tableau.tsx`, deux `nom:` dans `aide.ts`. **Risque** : le vocabulaire
du produit se dédouble légèrement — *artwork officiel* et *référence de tout le jeu* désignent la
même chose. **Ce que ça gagne** : la question de l'auteur ne se pose plus, parce que les deux noms
répondent l'un à l'autre. C'est la piste la moins chère par unité de confusion levée.

### C · Une ligne mesurée sous les deux, qui dit ce que **cette carte-ci** fera

Sous les bascules, une phrase calculée pour cette carte et ce projet — pas une explication, une
mesure, comme *« ce que la palette y lit »* juste en dessous :

- carte promue en « tous », désignée par le pèlerin →
  *« elle part déjà avec toutes les générations du projet ; la désigner n'ajoute rien »* ;
- carte non promue, désignée par la grenouille →
  *« elle ne part qu'avec les générations de la grenouille des tourbières »* ;
- carte promue en « personnages », désignée par le pèlerin →
  *« elle part avec tous les personnages du jeu, et avec le pèlerin même hors personnages »*.

**Coût** : le menu doit connaître la famille et la liste des désignateurs — il les a déjà tous les
deux. Une fonction pure, quelques lignes. **Risque** : une quatrième ligne dans un menu déjà long ;
et la formulation *« n'ajoute rien »* doit rester un constat, jamais un reproche. **Ce que ça
gagne** : c'est **la seule piste qui attrape un geste inerte**, et il y en a quatre sur six.

### D · Fusionner les deux en une question unique — *la mauvaise piste, nommée pour qu'on n'y revienne pas*

Le menu poserait une seule question à trois réponses : *cette carte sert à quoi ? à rien qu'à
m'inspirer · à tout le jeu · à une chose en particulier*. C'est plus simple à lire, et c'est
faux : deux cartes du dépôt sont **les deux à la fois**, légitimement — l'artwork officiel du
pèlerin est aussi sa référence de personnage. Une question à choix unique interdirait un état réel
et forcerait une quatrième réponse *« les deux »*, qui rendrait le tout plus obscur que les deux
réglages séparés. Écartée.

---

## 6 · Ce qui est tranché — 3 septembre 2026

### a) On prend `A`, `B` et `C` ensemble

Chacune répare une chose que les deux autres ne touchent pas : `A` remet le recueil d'accord avec
le code, `B` met la différence dans le nom des réglages — là où l'auteur décide —, et `C` est la
seule qui attrape un geste inerte. Les trois tiennent dans l'interface et dans le recueil ; **rien
ne change au comportement du produit**, ni au format sur le disque, ni à ce qui part au modèle.
Aucune génération déjà faite ne bouge, et aucun appel ne devient plus cher.

`D` — fusionner les deux réglages en une question unique — reste écartée : deux cartes du dépôt
sont légitimement les deux à la fois.

### b) La palette se dit dans les deux bulles, et pas ailleurs

Chacune la dit de son côté : celle du concept art précise qu'il ne donne aucune couleur au jeu,
celle de l'artwork officiel qu'il est l'un des deux seuls gestes qui refont la palette. **Écrit
une fois, lu partout où l'explication se lit** — la bulle au survol et l'écran du Guide, qui sont
les deux rendus du même recueil. Rien n'est retapé dans l'écran.

Le bloc *« ce que la palette y lit »*, qui n'apparaît que sous une carte promue, continue de le
dire en creux ; ce n'est plus la seule façon de l'apprendre.

### c) La vue d'une image de référence : rien pour l'instant, et la raison est écrite

*Faut-il que le produit signale qu'une image de référence n'est pas dans la vue du jeu ?* La
question venait de la première remarque et échoit ici, parce que c'est ici qu'on désigne des
images de référence.

**Mesuré : le produit ne peut pas le savoir.** L'univers porte une vue
([`univers.py`](../../atelier/services/univers.py) — champ `vue`), mais une carte n'en porte
aucune ([`carte.py`](../../atelier/domaine/carte.py) — le champ n'existe pas, et le lister ici
évite de le rechercher une troisième fois). Le produit ne peut donc que **demander** — un réglage
de vue de plus sur chaque carte, dans un menu qu'on trouve déjà chargé — ou **mesurer**, ce qui
veut dire faire lire l'image par un modèle, donc payer, et décider quand cet appel part.

Les deux coûtent plus que la gêne actuelle ne le justifie. **La question se referme ici**, écrite,
pour le jour où elle reviendra d'elle-même — probablement le jour où une pose sortira dans la
mauvaise vue et où l'on cherchera laquelle de ses références l'a tirée là.

---

## 7 · Ce qu'il faut construire

Cinq changements. Aucun ne touche au serveur, au disque, ni à ce qui part au modèle.

**1. La phrase fausse devient vraie.**
[`aide.ts:321`](../../interface/src/aide.ts#L321), champ `change` de `carte.officiel`. Elle dit
aujourd'hui *« une carte non promue ne part jamais, quoi qu'il y ait dans son groupe ou sa
famille »*. Elle doit dire que promue, la carte part avec tous les sujets de sa famille sans qu'on
ait rien à choisir ; et que non promue, elle ne part avec aucun sujet — **sauf pour une chose qui
l'aurait désignée**, juste au-dessus dans le même menu.

**2. La palette entre dans les deux bulles.** `carte.officiel` gagne que promouvoir et rétrograder
sont les deux seuls gestes qui refont la palette du jeu ; `carte.concept`
([`aide.ts:305`](../../interface/src/aide.ts#L305)) gagne que désigner n'y touche pas, et que la
palette se déduit des artworks officiels et d'eux seuls.

**3. Les deux étiquettes se répondent.**
[`Tableau.tsx:1426`](../../interface/src/composants/Tableau.tsx#L1426) *Concept art de* →
**« Référence de cette chose »** ; [`Tableau.tsx:1473`](../../interface/src/composants/Tableau.tsx#L1473)
*Artwork officiel* → **« Référence de tout le jeu »**. Les deux `nom:` du recueil suivent
([`aide.ts:306`](../../interface/src/aide.ts#L306) et
[`:317`](../../interface/src/aide.ts#L317)), puisque c'est le titre de la bulle et de l'entrée du
Guide.

> ⚠️ **Le terme *artwork officiel* ne disparaît pas.** Il reste sur le coin de la carte
> ([`Tableau.tsx:1004`](../../interface/src/composants/Tableau.tsx#L1004)), dans le recueil, dans
> le PRD, dans l'architecture et dans les maquettes : c'est un terme du produit, employé par une
> quinzaine de documents et par tout le service d'univers. Ce qui change est **l'étiquette du
> réglage**, c'est-à-dire ce que l'auteur lit au moment de décider.

**4. Une ligne mesurée sous les deux, et elle remplace celle qui existe.** Le menu écrit déjà, sous
les boutons de famille, *« part avec toutes les générations »* ou *« ne part qu'avec les sujets de
la famille X »* ([`Tableau.tsx:1515`](../../interface/src/composants/Tableau.tsx#L1515)). Cette
ligne-là **sort de son bloc et descend sous les deux réglages** — sinon deux phrases parleraient de
ce qui part, et elles pourraient se contredire. Elle devient vraie des six cas :

| L'état de la carte | Ce que la ligne dit |
|---|---|
| ni promue, ni désignée | elle ne part avec aucune génération |
| désignée seule | elle ne part qu'avec les générations de « X » *(et « Y »)* |
| promue en « tous », non désignée | elle part avec toutes les générations du projet |
| **promue en « tous » et désignée** | elle part déjà avec toutes les générations du projet — **la désigner n'ajoute rien** |
| promue en une famille, non désignée | elle ne part qu'avec les sujets de la famille F |
| promue en une famille et désignée | elle part avec les sujets de la famille F, et avec « X » même hors de cette famille |

C'est la quatrième ligne qui fait tout le travail : quatre des six désignations du dépôt sont dans
ce cas. Elle est un **constat**, jamais un reproche — le manque n'a aucune couleur d'alerte, et
rien ne réclame jamais rien.

**5. Le pied de carte cesse de mentir par omission.** Il écrit la famille *ou* les désignateurs
*ou* le groupe, dans cet ordre
([`Tableau.tsx:1023`](../../interface/src/composants/Tableau.tsx#L1023)) — donc une carte qui est
les deux n'affiche que sa famille, et la désignation disparaît du pied alors que son coin est
allumé. Sur le tableau du pèlerin, c'est le cas de deux cartes sur six. Les deux se disent l'une
après l'autre, séparées comme le sont déjà les désignateurs entre eux.

### Ce qu'il faut corriger ailleurs, si l'on renomme

- [`App.test.tsx:4496`](../../interface/src/App.test.tsx#L4496) et
  [`:4502`](../../interface/src/App.test.tsx#L4502) cherchent le texte *« Artwork officiel »* à
  l'écran.
- [`docs/archive/maquettes-v2.1/06bis-decouper-une-carte.html:225`](../maquettes-v2.1/06bis-decouper-une-carte.html)
  décrit *Concept art de* comme *« à quel personnage elle se rattache »* — vague, et à reprendre
  avec le nouveau nom. La ligne voisine, sur l'artwork officiel, dit déjà juste : *« elle part avec
  les générations, et sa couleur entre dans la palette »*.
- `docs/design-motifs.md:369` cite *Artwork officiel* dans la liste des réglages qui ont gagné une
  explication. Le nom y change, pas le propos.

---

## Ce que cette remarque recoupe

- **[Démarrer la première pose](demarrer-premiere-pose.md)** — la question reportée `c)` vient de
  là.
- **« Ce que la palette lit » est incompréhensible** *(journal, en vrac)* — même menu, même carte.
  Ce qu'on a trouvé ici l'éclaire : ce bloc n'est sous *promouvoir* que parce que promouvoir est le
  seul des deux qui colore le jeu.
- **« Sans artwork officiel, l'atelier ne réduit aucune couleur — et ne le dit pas »** *(séance
  `D2`, étayée)* — la même cause, prise par l'autre bout. Un auteur qui a désigné deux concept arts
  et promu zéro carte n'a **aucune palette**, et croit avoir donné ses couleurs au jeu.
