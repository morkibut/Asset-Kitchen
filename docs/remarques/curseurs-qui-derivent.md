# Les curseurs de taille dérivent

> **État : tranchée.** La règle qui aurait empêché ça est écrite depuis le 27 août 2026, dans la
> documentation du curseur lui-même, et le produit la tient **dix fois sur dix-sept**. Le curseur
> que l'auteur nomme est le seul de tout le produit à écrire au serveur à chaque cran traversé.
> Les deux questions sont arbitrées ; ce qu'il faut construire est au § 7.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> les curseurs de taille (part de la case qu'il rempli) dans les réglages sont complètement fucké.
> si on les déplace il continu a bouger tout seul pendant plusieurs seconde, ca manque clairement
> d'optimisation pour l'affichage en temps réel.

---

## 2 · Ce que le produit fait aujourd'hui

### Le curseur, et pourquoi il y en a plusieurs

C'est *la part de la case qu'il remplit*, dans l'étape **« les types d'objets »** des réglages
([`Assistant.tsx:1134`](../../interface/src/composants/Assistant.tsx#L1134)). Il y en a **un par
type d'objet** — sept dans le projet *Cœur de pierre 01*, huit dans *Test v2* — d'où le pluriel de
la remarque. Ils vont de 10 à 100 par pas de 1 : **un glissement d'un bout à l'autre traverse 90
crans.**

### Le montage, et il explique tout

```
onChange={(occupation) => poser(univers.bareme.map(…))}     // ← et rien d'autre
```

Il n'a **pas de `onFini`**. Or `poser` écrit au serveur
([`Assistant.tsx:1064`](../../interface/src/composants/Assistant.tsx#L1064)), et la réponse du
serveur **remplace l'univers entier** ([`Assistant.tsx:221`](../../interface/src/composants/Assistant.tsx#L221)) :

```
onUnivers((await api.reglerUnivers(reglage)).univers)
```

Enfin, le curseur est *contrôlé* : la position de sa poignée est `valeur={echelle.occupation}`,
c'est-à-dire une valeur qui vient de cet univers-là.

**La boucle se referme, et voici ce qui se passe réellement.** Chaque cran traversé part au serveur.
La poignée, elle, ne bouge pas quand la main bouge : elle bouge quand une **réponse revient**. Elle
suit donc la main **avec le retard de la file**, et quand on lâche, il reste toutes les réponses en
route — la poignée les rejoue une par une, toute seule, jusqu'à ce que la file soit vide.

Ce n'est pas un défaut d'optimisation d'affichage, comme la remarque le suppose : **c'est une
poignée qui affiche l'écho du serveur au lieu d'afficher la main.**

### Ce que ça coûte, mesuré le 3 septembre 2026

Sur une copie du dépôt de l'auteur, hors de son atelier, projet *Cœur de pierre 01* :

| Ce qu'on mesure | Le chiffre |
|---|---|
| un écrit d'univers, calcul du serveur seul | **15,4 ms** (min 14,7 · max 18,2) |
| crans traversés par un glissement d'un bout à l'autre | **90** |
| calcul du serveur pour ce seul glissement | **≈ 1,4 s** |
| ce que chaque réponse rapporte | **2,9 ko**, l'univers entier — la bible, le barème, les huit modèles, les 48 couleurs de la palette |

Et ce n'est que le plancher. S'y ajoutent, par cran : un aller-retour réseau, l'analyse du JSON, et
**le redessin de tout l'écran des réglages** — les sept types, leurs sept carrés de 56 px, la
colonne de gauche et son récapitulatif —, puisque c'est l'univers entier qui a été remplacé.

**Et le reste de l'atelier attend.** La route qui écrit l'univers
([`univers.py:708`](../../atelier/api/univers.py#L708)) fait son travail sans rendre la main :
les 90 écrits ne se chevauchent pas, ils se suivent. Pendant plus d'une seconde, **le serveur ne
sert rien d'autre** — ni une image, ni le flux d'événements.

**Enfin, rien ne garantit l'ordre.** Un navigateur ouvre plusieurs liaisons vers le même serveur,
et aucune de ces 90 requêtes ne porte de numéro de séquence ni ne s'annule quand la suivante part.
Chacune envoie le barème **entier**, lu au moment du geste. La valeur qui reste écrite est donc
celle de la dernière requête **traitée**, pas de la dernière **envoyée** — la poignée peut se poser
ailleurs que là où la main l'a lâchée.

### La règle existait déjà, et elle est écrite sur le curseur lui-même

La documentation du composant, du 27 août 2026
([`chassis.tsx:563`](../../interface/src/composants/chassis.tsx#L563)) :

> **`onChange` bouge la valeur, `onFini` la pose.** […] Un appel par cran de curseur, ce sont
> vingt-deux appels sérialisés pour un glissement de la tolérance, soit une demi-minute de file
> pendant laquelle l'image défile des valeurs que personne n'a demandé à voir. Le curseur envoie
> donc **ce qu'on a lâché, pas ce qu'on a traversé**.

Elle a été écrite pour les tables de retouche, où le coût est le plus visible. Elle n'a jamais été
redescendue sur l'écran des réglages.

### Le relevé de tous les curseurs du produit

**Dix-sept curseurs. Dix posent au relâchement, sept ne le font pas — et sur ces sept, quatre font
travailler le serveur à chaque cran :**

| Où | Ce qu'il fait à chaque cran | Verdict |
|---|---|---|
| **`Assistant.tsx:1134`** · la part de la case | **écrit l'univers au serveur** | **le défaut signalé** |
| **`Decoupe.tsx:346`** · taille minimale (0 → 128) | fait recalculer la découpe au serveur | **le même défaut, autre symptôme** |
| **`Decoupe.tsx:357` et `:365`** · colonnes, lignes (1 → 16) | idem | **idem** |
| `Places.tsx:1388` · le diamètre du pinceau | rien — un état à l'écran | correct |
| `Superposition.tsx:417` et `:420` · les deux opacités | rien — un réglage de regard | correct |
| les dix autres | rien tant qu'on n'a pas lâché | corrects |

**Les trois curseurs de la découpe sont la même maladie sous un autre visage.** Leur valeur, elle,
est tenue à l'écran — la poignée suit donc la main, et rien ne dérive. Mais un effet redemande au
serveur une proposition de découpe **à chaque cran**
([`Decoupe.tsx:186`](../../interface/src/composants/Decoupe.tsx#L186)) : un glissement de la taille
minimale d'un bout à l'autre, ce sont **jusqu'à 128 détections d'un coup**, chacune sur l'image
entière, et les rectangles proposés défilent par 128 états que personne n'a demandé à voir.

### Ce qui rend le bon montage facile à copier

Le plafond de la séance, dans les réglages de l'agent
([`EcranReglages.tsx:225`](../../interface/src/composants/EcranReglages.tsx#L225)), est exactement
le même cas — un nombre qui vit au serveur — et il est monté juste :

```
const [plafond, setPlafond] = useState(…)
<Curseur valeur={plafond} onChange={setPlafond} onFini={(v) => void poser({ plafond: v })} />
```

Une valeur tenue à l'écran pour la poignée, un seul envoi au relâchement. **Il est dans le même
dossier, à trois fichiers de distance.**

---

## 3 · Pourquoi c'est comme ça

**Parce que la règle est jeune et l'écran est vieux.** L'assistant des réglages existait avant le
27 août ; le `onFini` du curseur est né ce jour-là, d'une mesure faite sur les tables de retouche.
Rien n'a repassé sur les écrans déjà écrits.

**Parce que rien ne le voit.** Un curseur sans `onFini` est du code parfaitement valide : il
compile, il rend, il fonctionne — il fonctionne simplement quatre-vingt-dix fois. Aucun essai ne
compte les appels d'un glissement, et aucune règle de lecture automatique ne dit *un curseur qui
écrit au serveur doit poser au relâchement*.

**Et parce que le coût ne se voit pas en écrivant le code.** 15 ms par écrit paraît gratuit. C'est
le nombre 90 qui coûte, et il n'est écrit nulle part dans le fichier — il est dans les bornes du
curseur, deux lignes plus haut.

---

## 4 · Ce qui borne la solution

- **Le curseur ne change pas.** `onChange` / `onFini` est déjà le bon partage, écrit et éprouvé ;
  ce qui manque est de s'en servir. Aucun composant nouveau.
- **La poignée doit suivre la main sans attendre personne.** C'est le geste même du réglage : *on
  fait glisser, et on regarde.* Toute solution où la poignée attend une réponse est écartée
  d'avance.
- **Un chiffre écrit vaut un relâchement** — le champ où l'on tape la valeur pose en un seul envoi,
  et ça doit rester vrai.
- **Rien ne doit se perdre au changement d'écran.** Si l'envoi n'a lieu qu'au relâchement, il faut
  qu'un relâchement ait toujours lieu — le curseur le garantit déjà : souris, doigt **et** touche.
- **Aucune donnée nouvelle, aucune route nouvelle.** Le serveur ne change pas.

---

## 5 · Les pistes

### A · Le montage du plafond de la séance, recopié

Une valeur tenue à l'écran, `onChange` qui la bouge, `onFini` qui l'envoie. Sur l'écran des
réglages, la valeur affichée devient un état local resynchronisé quand on change de type d'objet —
exactement comme la recette se resynchronise sur l'identifiant de l'image et jamais sur son
contenu.

**Coût** : quelques lignes par curseur. **Risque** : aucun — c'est le montage de dix curseurs sur
dix-sept, et de celui d'à côté. **Ce que ça donne** : un envoi par glissement au lieu de quatre-vingt-dix,
et une poignée qui suit la main.

### B · Un délai avant d'envoyer

Garder `onChange`, mais n'envoyer qu'après un temps de calme — un quart de seconde sans mouvement.

**Coût** : comparable. **Risque** : plus élevé qu'il n'en a l'air. Un délai est un nombre de plus à
choisir et à défendre, il envoie encore plusieurs fois pour un seul geste lent, et il laisse la
poignée branchée sur l'écho du serveur — donc la dérive revient, plus courte. Le produit a déjà
tranché autrement, et il a eu raison : **le relâchement est un fait, un délai est une devinette.**

### C · Ne rien envoyer avant de quitter l'écran

Tout garder à l'écran, poser en partant. **Écartée** : l'occupation change ce que la grille fait
d'un sujet, et une valeur qu'on croit posée mais qui ne l'est pas est pire qu'une attente. Le
produit n'a nulle part ailleurs de réglage qui attend qu'on s'en aille.

### D · Interdire le retour du défaut

Une lecture automatique qui refuse un `<Curseur>` dont le `onChange` appelle le serveur sans qu'un
`onFini` existe. **Coût** : une règle de vérification, ou un essai qui compte les appels d'un
glissement. **Ce que ça gagne** : la règle est écrite depuis le 27 août et le produit l'enfreint
quatre fois ; rien ne l'a signalé en une semaine.

---

## 6 · Ce qui est tranché — 3 septembre 2026

### a) Les quatre curseurs fautifs sont réparés ensemble

Y compris les trois de la découpe, qui ne dérivent pas mais font recalculer une détection jusqu'à
128 fois pour un seul glissement. Même cause, même remède, quelques lignes de plus : on tient la
règle une fois plutôt que de revenir dans six mois sur trois curseurs qu'on avait vus et laissés.

**Retenu : la piste `A`** — le montage du plafond de la séance, recopié. `B` (un délai) est écartée
pour la raison écrite : *le relâchement est un fait, un délai est une devinette*, et un délai
laisserait la poignée branchée sur l'écho du serveur, donc la dérive reviendrait, plus courte.

### b) Un essai qui lit la source, et non une règle de lint

**Correction de ce que la question laissait croire :** il n'y a **aucun ESLint** dans ce dépôt —
l'interface se vérifie par `tsc -b` et `vitest`, rien d'autre. Une « vérification automatique à la
lecture du code » ne peut donc pas être une règle de lint sans faire entrer tout un outillage, une
dépendance et une commande de plus pour une règle.

**Elle peut être exactement ce qui a été choisi, sous une autre forme, et le dépôt le fait déjà
deux fois** : un essai qui **lit la source de l'écran** et l'oppose à une règle
([`tests/test_d1.py:488`](../../tests/test_d1.py#L488) et
[`:504`](../../tests/test_d1.py#L504), pour deux listes qui doivent se dire la même chose — *« une
troisième copie serait la panne qu'on ferme ici »*).

La règle à écrire, dite de façon mécaniquement vérifiable :

> **Tout `<Curseur>` déclare `onFini`** — ou porte, juste au-dessus, une ligne qui dit pourquoi il
> n'en a pas besoin.

Elle est exacte, elle se vérifie par lecture du texte, elle attrape les quatre fautifs, elle
oblige les trois curseurs légitimes à s'expliquer en une ligne, et **elle couvre les écrans qui
n'existent pas encore** — ce qui était tout l'intérêt du choix.

---

## 7 · Ce qu'il faut construire

Trois changements, l'interface et un essai. **Aucune route nouvelle, aucune donnée nouvelle, aucun
composant nouveau, aucune dépendance nouvelle.**

**1. La part de la case, dans « les types d'objets ».**
[`Assistant.tsx:1134`](../../interface/src/composants/Assistant.tsx#L1134). Les occupations se
tiennent à l'écran ; `onChange` bouge la valeur locale, `onFini` seul écrit au serveur. C'est le
montage du plafond de la séance ([`EcranReglages.tsx:225`](../../interface/src/composants/EcranReglages.tsx#L225)).

> ⚠️ **Le piège, et il est déjà écrit ailleurs.** La valeur locale se resynchronise **sur le
> projet, jamais sur la réponse du serveur**. C'est la leçon de `useRecette`, mot pour mot : *« sur
> l'identifiant seul, jamais sur la recette […] se resynchroniser dessus ferait reculer un curseur
> qu'on est en train de faire glisser, au rythme des allers-retours »*
> ([`Places.tsx:193`](../../interface/src/composants/Places.tsx#L193)). Se resynchroniser sur la
> réponse rendrait la dérive telle quelle.

**2. Les trois curseurs de la découpe.**
[`Decoupe.tsx:346`](../../interface/src/composants/Decoupe.tsx#L346), `:357`, `:365`. Leur valeur
est déjà tenue à l'écran — c'est **l'effet qui redemande la proposition** qui doit cesser de
dépendre de la valeur qui suit la main
([`Decoupe.tsx:186`](../../interface/src/composants/Decoupe.tsx#L186)). Deux états au lieu d'un :
celui que la poignée suit, et celui que la détection lit, que `onFini` seul avance. La ligne déjà
écrite sous ces réglages — *changer de réglage remplace ce qu'on a dessiné* — reste vraie, et cesse
d'être vraie 128 fois de suite.

**3. L'essai qui lit la source.** Un `tests/test_*.py` qui parcourt
`interface/src/composants/*.tsx`, relève chaque `<Curseur`, et exige `onFini` ou une ligne de
raison au-dessus. Le message d'échec doit nommer le fichier et la ligne — c'est ce qui a manqué
pendant une semaine.

### Ce que ça ne fait pas

- **Le curseur lui-même ne change pas.** `onChange` / `onFini` est déjà le bon partage ; ce qui
  manquait était de s'en servir.
- **Le serveur ne change pas.** Ni la route de l'univers, ni celle de la découpe. Ce qui coûtait,
  c'était le nombre d'appels, pas leur prix.
- **Ça ne répare pas l'incompréhension du réglage.** *À quoi sert la part de la case, et par
  rapport à quoi ?* est une autre remarque, sur le même curseur, et elle attend son tour.

---

## Ce que cette remarque recoupe

- **[Rien ne dit qu'un détourage est en cours](attente-du-detourage.md)** — même famille, sens
  inverse : là-bas une attente réelle que rien ne montre, ici un affichage qui montre une attente
  qu'on ne devrait pas avoir. Les deux naissent de la même semaine et du même relevé du 27 août.
- **« Les réglages de départ ne se comprennent pas »** *(journal, en vrac)* — **le même curseur**,
  vu par l'autre bout : celui-ci dit qu'il se conduit mal, celui-là qu'on ne sait pas à quoi il
  sert. Les deux se traitent sans doute dans le même geste, mais ce sont deux remarques.
