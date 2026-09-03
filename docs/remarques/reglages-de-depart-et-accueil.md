# Les réglages de départ ne se comprennent pas, et il faudrait un vrai accueil

> **État : tranchée.** Trois demandes dans une — la troisième, une IA qui aide à formuler
> l'univers, est posée par l'auteur comme *« pour plus tard »* et se lit à l'avant-dernière
> section. Les deux premières ont la même cause. Les trois contrôles que l'auteur ne comprend pas
> **ont chacun leur explication écrite dans le recueil** — aucune n'est attachée à son contrôle.
> Le balayage donne **35 entrées sur 122 qu'aucun écran ne cite**. Et l'assistant qu'il réclame
> existe : douze étapes, qui ne s'ouvrent **qu'une fois dans la vie de l'atelier**. Les trois
> questions sont arbitrées ; ce qu'il faut construire est au § 7.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> dans les réglages de départ dans "les types d'objets" on ne comprend toujours pas trop a quoi
> sert "la part de la case qu'il rempli", ni a quoi sert cette page et ses réglages dans le
> contexte du départ. "il se découpe" c'est uqoi ? une tranche de pain ? se découpe commment, en
> quoi ? pourquoi ? quand ? dans quel but ?
> la part de la taille : c'est quoi ? par rapport a quoi ? ca change ou impacte quoi ?
> image de référence ? ok mais je peux pas changer ajotue de type d'iamge de référence donc a quoi
> bon proposer des régalges si on peut pas ajouter des types ou en désactiver ? En fait j'aimerai
> vraiment qu'on imagine un vrai wizard (modal ou popup) qui s'ouvre quand on créer un nouveau
> projet, et qu'on peut reouvrir avec un bouton depuis les réglages. Ce wizard serait simplifié,
> il demanderai juste les choses qu'on sait quand on débute et qu'on démarre un projet, et
> laisserait les réglages un peu avancé par défaut de coté (la page réglage restera la pour plus
> tard si besoin).
> I'idée c'est d'accueillir et de guider l'utilisateur en lui prenant la main dans une expérience
> fluide, simple, claire, guidé et pas trop longue.
> Et c'est précisément ici, qu'un modèle de génération de texte IA a du sens, pour l'aider a
> formuler un peu son univers et a brainstormer, une ia (locale ? qu'on aurait pré-prompté, ou un
> modèle gratuit ou pas cher d'open-routeur) pourrait lui poser des questions sur ce qu'il imagine,
> ce qu'il veux etc... (c'est juste une idée pour plus tard), mais en gros une sorte de skill pour
> aider a la formulation d'un univers de jeu.

---

## 2 · Ce que le produit fait aujourd'hui

### Les trois explications existent, et aucune n'est atteignable

L'étape « les types d'objets » ([`Assistant.tsx:1242`](../../interface/src/composants/Assistant.tsx#L1242))
montre une carte par type, et chaque carte porte **trois contrôles** : *images de référence*, *la
part de la case qu'il remplit*, *il se découpe*. Ce sont exactement les trois que l'auteur nomme.

**Aucun des trois ne porte de pointillé.** Dans tout le bloc, une seule ancre d'explication existe,
et c'est celle de l'étape entière ([`:1247`](../../interface/src/composants/Assistant.tsx#L1247)),
qui les résume en une phrase : *« chacune décide de trois choses à la fois »*.

Or le recueil porte **une entrée dédiée pour chacun des trois** :

| L'entrée | Ce qu'elle dit — extrait |
|---|---|
| `bareme.occupation` ([`aide.ts:235`](../../interface/src/aide.ts#L235)) | *« Deux images arrivent du fournisseur au même format. Si tu les remets simplement sur une grille de 64 px, le tonneau devient aussi grand que le personnage. L'occupation dit "ce tonneau remplit 45 % de sa case", et l'échelle redevient juste. »* |
| `bareme.silhouette` ([`aide.ts:246`](../../interface/src/aide.ts#L246)) | *« Le détourage suit la nature du sujet, pas un réglage de plus. […] La remise sur grille reste de la partie dans les deux cas : un décor aussi doit tomber sur le pixel du projet. »* |
| `bareme.famille` ([`aide.ts:224`](../../interface/src/aide.ts#L224)) | *« C'est le même mécanisme que la famille d'une carte, pris par l'autre bout : la carte dit à quelle famille un artwork appartient, l'échelle dit quelle famille un sujet va chercher. »* |

La première répond **mot pour mot** à la question de l'auteur — *c'est quoi ? par rapport à quoi ?
ça change ou impacte quoi ?* Elle est écrite, tenue, relue. Elle n'est simplement **branchée nulle
part** : ces trois clés n'apparaissent dans aucun fichier de l'interface, sauf `aide.ts` lui-même.

**Le reproche de l'auteur n'est donc pas qu'on ne lui a rien expliqué. C'est qu'on lui a tout
expliqué ailleurs.**

### Le balayage : 35 entrées sur 122 qu'aucun écran ne cite

Compté le 3 septembre 2026 sur tout le recueil et tout le code de l'interface :

| | |
|---|---|
| entrées du recueil | **122** |
| citées par aucun écran | **35** — 29 % |

Elles ne sont pas toutes des manques. **Une douzaine décrivent un écran ou un domaine entier** — *Le
codex*, *La vitrine*, *L'écran de confirmation*, *Le calibrage*, *L'assistant de démarrage*, *Les
dépenses*, *La planche de poses*, *La superposition*, *Une ambiance*… Celles-là n'ont aucun libellé
unique où s'accrocher, elles vivent au Guide, et c'est juste.

**Les vingt-trois autres nomment un contrôle ou une place que l'écran montre pourtant** :

- les **sept cases de la bible** — *monde, époque, technique de rendu, vue et cadrage, trait,
  éclairage, contraintes techniques* ;
- les **trois du barème** — celles de cette remarque ;
- les **sept places de la recette** — *Détourage, Recadrage, Grille, Quantification, Nettoyage des
  bords, Les contours, La main* : la barre des tables les affiche par leur nom et ne porte que des
  `title` de navigateur, jamais de pointillé
  ([`Tables.tsx:510`](../../interface/src/composants/Tables.tsx#L510)) ;
- et six autres — *Taille de pixel*, *découper une carte*, *provenance*, *écrire un nom*, *le pour
  cent d'agrandissement*, *PNG*.

**Le dépôt s'était déjà posé la question, et dans un seul sens.** Le recueil porte une règle
explicite ([`aide.ts:1482`](../../interface/src/aide.ts#L1482)) : *« une maquette qui ajoute un
écran ou un réglage doit une ligne au guide, et elle l'écrit chez elle »* — écrite après avoir
découvert que **onze sujets entiers n'étaient expliqués nulle part**. Elle couvre le manque
d'entrée. **Elle ne couvre pas l'inverse** : une entrée écrite pour un contrôle, et jamais accrochée
à ce contrôle. Rien ne le vérifie, et c'est arrivé 23 fois.

### « il se découpe » : l'écran et le recueil n'emploient pas le même mot

L'interrupteur affiche *« il se découpe »* ou *« plein cadre, pas de découpe »*
([`Assistant.tsx:1353`](../../interface/src/composants/Assistant.tsx#L1353)). L'entrée du recueil
écrite pour lui s'appelle **« se détoure / plein cadre »**.

*Découper* est le mot d'un autre geste du produit — **la découpe**, qui coupe une planche en
plusieurs images, existe dans la barre des tables et dans le menu d'une carte. *Détourer* est ce
que l'interrupteur fait vraiment : retirer le fond. L'écran a donc pris le mot du geste voisin, et
la question de l'auteur — *« se découpe comment, en quoi ? »* — est **la question exacte que ce mot
appelle.** Le bon mot était déjà écrit, dans l'entrée qu'on ne peut pas atteindre.

### « + type sur mesure » : la phrase promet huit types, son projet en a sept

Sous les cartes, un bouton éteint qui porte sa raison
([`Assistant.tsx:1362`](../../interface/src/composants/Assistant.tsx#L1362)) :

> `+ type sur mesure — plus tard, les huit types couvrent ce qu'on sait faire`

**Sur *Cœur de pierre 01*, il y en a sept.** Le huitième — *tuile* — est entré dans le barème livré
le 31 août (tranche `E8`, commit `068347e`), et ce projet a été créé le 28. Un projet ne reçoit
jamais les types ajoutés après lui, et le seul bouton qui pourrait en ajouter un est éteint.
**L'auteur ne peut donc pas obtenir le type que la phrase lui promet.**

Ce n'est pas isolé : *Cœur de pierre* — le tout premier — porte une bible de **cinq** cases là où
les autres en ont sept. Même mécanique, autre champ.

Et la question de fond de l'auteur reste sans réponse à l'écran : **on ne peut ni ajouter, ni
retirer, ni éteindre un type.** La raison affichée explique pourquoi on n'en ajoute pas ; elle ne
dit rien de pourquoi on n'en retire pas — alors qu'un jeu de plateforme n'a que faire de *meuble*
et d'*objet posé*.

### L'assistant existe déjà. Il s'ouvre une fois dans la vie de l'atelier

Ce que l'auteur appelle *un vrai wizard* est là : **douze étapes, quatre groupes**, une colonne de
gauche qui les liste avec leur valeur courante, un écran par étape.

| le jeu | le style | la production | l'atelier |
|---|---|---|---|
| Le nom · Le style · La vue · La taille · Les types d'objets | L'allure · Références et couleurs | Poses et états · Emplacements · Les IA à utiliser · Le détourage de départ | Les fournisseurs |

**Il s'ouvre tout seul exactement une fois** : au tout premier lancement de l'atelier, quand rien
n'existe encore ([`App.tsx:888`](../../interface/src/App.tsx#L888)) — *« la seule minute que
personne ne revoit jamais »*. Et la règle qui décide de cette minute dit, noir sur blanc, que créer
un second jeu **referme la porte** ([`bibliotheque.py`](../../atelier/services/bibliotheque.py),
`neuf()`) :

> Trois faits suffisent […] : aucune image nulle part, un seul jeu, et il porte encore le nom que
> le produit lui a donné. Importer une image, nommer son jeu, **en créer un second** — n'importe
> lequel referme la porte, et c'est exactement quand elle doit se refermer.

Créer un projet ne fait donc rien d'autre que l'ouvrir
([`Arbre.tsx:55`](../../interface/src/composants/Arbre.tsx#L55)) : le champ se vide, le formulaire
se ferme, et l'auteur reste où il était — devant un jeu neuf dont **douze questions attendent, sans
que rien ne le dise.**

**La demande de l'auteur contredit donc une décision écrite**, et c'est le vrai sujet de cette
remarque. La décision a été prise pour une bonne raison — ne pas rouvrir une porte sous les doigts
de quelqu'un qui travaille. Elle n'a jamais examiné le cas d'un **second jeu neuf**, qui est aussi
vide que le premier.

### Ce que l'auteur remplit vraiment, mesuré sur ses six projets

| Projet | créé | vue | bible | types modifiés | modèles | détourage |
|---|---|---|---|---|---|---|
| bac-a-sable | 27/08 | **aucune** | 0/7 | 1/7 | 0 | 0 |
| coeur-de-pierre | 27/08 | **aucune** | 0/5 | 0/7 | 0 | 0 |
| coeur-de-pierre-01 | 28/08 | vue de dessus ¾ | 7/7 | 0/7 | 0 | 0 |
| essai-animation | 01/09 | vue de côté | 4/7 | 0/8 | 0 | 0 |
| test-v2 | 01/09 | vue de dessus | 6/7 | 0/8 | 0 | 0 |
| vignettes | 31/08 | **aucune** | 0/7 | 0/8 | 0 | 0 |

Ce que ça dit :

- **La moitié des projets n'a jamais été réglée du tout.** Trois sur six n'ont ni vue ni bible —
  exactement ceux où l'assistant ne s'est jamais ouvert.
- **Le barème a été touché une fois sur quarante-quatre rangées.** L'étape que l'auteur dit ne pas
  comprendre est celle qu'il n'a, de fait, jamais employée.
- **Trois étapes sur douze n'ont jamais servi, dans aucun projet** : *Les IA à utiliser* (0/6),
  *Le détourage de départ* (0/6 — mais elle date d'aujourd'hui), et *Le style*, dont la valeur est
  **déduite** de la taille de pixel plutôt que choisie, ce que le code fait exprès et honnêtement
  pour les projets antérieurs à la question.
- **Et les six étapes intouchées ont toutes un défaut qui marche**, et leurs entrées du recueil le
  disent dans leur ligne *origine* : le barème est *« sept échelles au départ, mesurées sur sept
  sujets réels »*, les modèles *« aucun, donc le catalogue décide »*, le détourage *« aucun, donc le
  produit décide »*.

**C'est le partage que l'auteur demande, et la mesure le dessine toute seule** : il remplit le nom,
la taille, la vue, la bible, les poses et les emplacements. Il ne remplit pas le style, les types,
les modèles, le détourage, la façon de réduire ni les fournisseurs — et il n'en a jamais eu besoin.

---

## 3 · Pourquoi c'est comme ça

**Parce que l'assistant a été conçu comme une relecture, pas comme un accueil.** Douze étapes
posées côte à côte, toutes du même poids, toutes ouvrables dans n'importe quel ordre : c'est une
table des matières de ce qu'un jeu peut porter. Elle sert très bien quand on sait déjà ce qu'on
cherche. Elle ne dit rien à qui arrive.

**Parce que les explications se sont écrites en bloc, et l'accrochage se fait une par une.** Les
122 entrées ont été écrites par sujets ; les brancher demande de revenir dans chaque écran poser un
pointillé sur le bon libellé. Le premier travail se voit — il produit un fichier —, le second ne se
voit pas, et rien ne le réclame.

**Et parce que le produit vérifie le manque d'entrée, jamais le manque d'accroche.** La règle
existe, elle est écrite, elle a été payée par onze sujets — et elle ne regarde que dans un sens.

---

## 4 · Ce qui borne la solution

- **Une explication ne se recopie jamais** (R4, étendu en `R8`). Ce qui manque se branche, ne se
  retape pas : les trois textes existent, mot pour mot, et sont bons.
- **Un seul corpus, deux rendus** — la bulle au survol et le Guide. Accrocher une entrée la rend
  lisible aux deux endroits d'un seul geste.
- **Le manque n'a aucune couleur d'alerte, rien ne réclame jamais rien.** Un accueil qui s'ouvre ne
  doit pas ressembler à un formulaire à remplir avant d'avoir le droit de commencer — *« rien n'est
  exigé pour commencer »* est une phrase du produit.
- **Ce qui est indisponible est grisé avec sa raison, jamais caché.** Le bouton éteint reste ; c'est
  sa phrase qui doit devenir vraie.
- **Une décision écrite ne se défait pas en silence.** Rouvrir l'assistant sur un second projet
  contredit `E19` ; si on le fait, la décision se réécrit avec sa nouvelle raison.
- **Aucune largeur, hauteur, couleur ni police neuves.** Le modal, s'il en faut un, emploie ce que
  le produit a déjà.

---

## 5 · Les pistes

### A · Brancher les explications — le plancher, et il répond à la moitié de la remarque

Poser un pointillé sur les trois contrôles du barème, et sur les vingt autres entrées orphelines qui
nomment un contrôle visible. Corriger *« il se découpe »* en *« il se détoure »*, qui est le mot du
recueil et le mot juste. Rendre vraie la phrase du bouton éteint — elle promet huit types à un
projet qui en a sept.

**Coût** : une ligne par accroche, une phrase à corriger, un mot à changer. **Risque** : aucun.
**Ce que ça ne fait pas** : ça ne répond pas à *« à quoi sert cette page dans le contexte du
départ »*, qui est une question de parcours et non de vocabulaire.

### B · L'assistant s'ouvre sur tout jeu neuf, et ses douze étapes se coupent en deux

Créer un projet ouvre l'assistant, comme le premier lancement le fait déjà. Et les douze étapes se
répartissent en **ce qu'on sait en commençant** — le nom, le style, la vue, la taille, les poses —
et **ce que le produit décide très bien tout seul** — les types, les modèles, le détourage, la façon
de réduire —, le second groupe replié derrière une ligne du genre *« le reste a des valeurs de
départ mesurées ; tu y reviendras quand une image te donnera une raison »*.

Le partage n'est pas une opinion : il sort du tableau du § 2, et chacune des étapes reléguées porte
déjà, dans son entrée du recueil, la phrase qui dit que son défaut est bon.

**Coût** : moyen — un partage à poser, un repli, et une décision écrite à réviser. **Risque** :
`E19` dit le contraire, et pour une raison qui reste valable dans son cas à elle. **Ce que ça
gagne** : les trois projets sans vue ni bible n'auraient pas existé.

### C · Un modal court, à part de l'assistant

Un vrai *popup* de quatre ou cinq questions à la création, réouvrable depuis les réglages, et
l'assistant reste ce qu'il est.

**Coût** : élevé — c'est un second endroit qui règle les mêmes champs. **Risque** : le produit
refuse partout ailleurs d'avoir deux endroits pour un fait, et cette règle lui a évité des
contradictions à répétition. Un modal qui pose la vue et un écran qui pose la vue finiraient par se
désaccorder sur ce qu'ils montrent. **Écartée**, sauf si l'auteur tient au format *popup* pour
lui-même : le fond de sa demande — *simplifié, réouvrable* — est mieux servi par `B`.

### D · Empêcher le retour des explications orphelines

Un essai qui lit `aide.ts` et le code de l'interface, et refuse une entrée qui nomme un contrôle
sans être citée nulle part — avec une liste d'exceptions déclarée pour les entrées d'écran, comme
`SANS_ENTREE` déclare déjà les manques assumés dans l'autre sens.

**Coût** : un essai, et une liste d'exceptions à tenir à jour. **Ce que ça gagne** : la règle
existante ne regarde que dans un sens, et l'autre sens vient de produire 23 orphelines.

---

## 6 · Ce qui est tranché — 3 septembre 2026

### a) L'assistant s'ouvre sur tout jeu neuf, et ses étapes se coupent en deux — piste `B`

Le modal séparé est écarté pour la raison du § 5 : deux endroits qui règlent le même champ
finissent par se contredire, et le produit tient cette règle partout ailleurs. La forme *popup* que
l'auteur décrit n'était pas le fond de sa demande — *simplifié, réouvrable, pas trop long* l'était,
et `B` le sert mieux.

> ⚠️ **Une décision écrite est révisée, et il faut l'écrire comme telle.** `E19` dit que créer un
> second jeu *« referme la porte, et c'est exactement quand elle doit se refermer »*. Sa raison
> reste juste pour ce qu'elle visait — ne pas rouvrir l'assistant sous les doigts de quelqu'un qui
> travaille. Elle n'avait pas examiné le **jeu neuf créé plus tard**, qui est aussi vide que le
> premier. La règle devient : *l'assistant s'ouvre sur un jeu qui n'a rien*, ce qui reste vrai du
> premier lancement et devient vrai du cinquième projet. Trois des six projets du dépôt lui doivent
> leur vue et leur bible vides.

Le partage des douze étapes n'est pas une opinion : il sort du tableau du § 2. **Ce qu'on sait en
commençant** — le nom, le style, la vue, la taille, les poses et les emplacements. **Ce que le
produit décide déjà bien tout seul**, replié : les types, les modèles, le détourage, la façon de
réduire, les fournisseurs. Chacune des repliées porte déjà, dans sa ligne *origine*, la phrase qui
dit que son défaut est bon.

### b) Un type s'éteint sans se supprimer

Comme une table de la recette s'éteint sans se vider : le type reste dans le barème, ses réglages
sont gardés, il cesse simplement d'être proposé au moment de fabriquer. C'est le geste qui répond à
la question de l'auteur sans rouvrir le type sur mesure — bien plus cher, puisqu'un type est aussi
une famille à laquelle des artworks se rattachent.

**Et ça débloque le défaut des sept types contre huit.** Tant qu'on ne pouvait rien retirer, ajouter
les types manquants à un vieux projet lui imposait des rangées dont il n'a que faire. Une fois qu'on
peut éteindre, **un projet peut recevoir les types entrés après lui** sans que ce soit une
intrusion.

### c) Les vingt-trois orphelines s'accrochent d'un coup, et un essai ferme le trou

Le texte existe déjà, mot pour mot, et il est bon : l'accroche est mécanique. L'essai qui la garde
est écrit dans le même geste — sans quoi le prochain écran reproduira l'oubli, exactement comme
celui-ci l'a fait.

---

## 7 · Ce qu'il faut construire

Quatre chantiers, du moins cher au plus cher. Seul le second touche au disque.

### 1. Brancher les explications, et corriger deux textes

- **Les trois du barème** : `bareme.famille` sur *images de référence*, `bareme.occupation` sur *la
  part de la case*, `bareme.silhouette` sur l'interrupteur
  ([`Assistant.tsx:1242-1356`](../../interface/src/composants/Assistant.tsx#L1242)).
- **Les vingt autres** qui nomment un contrôle visible : les sept cases de la bible, les sept places
  de la recette dans la barre des tables
  ([`Tables.tsx:510`](../../interface/src/composants/Tables.tsx#L510)), *Taille de pixel*,
  *découper une carte*, *provenance*, *écrire un nom*, *le pour cent d'agrandissement*, *PNG*.
- **Le mot de l'interrupteur** : *« il se découpe »* → *« il se détoure »*
  ([`Assistant.tsx:1353`](../../interface/src/composants/Assistant.tsx#L1353)). *Découper* est le
  nom d'un autre geste du produit ; *détourer* est ce que l'interrupteur fait, et c'est déjà le mot
  du recueil.
- **La phrase du bouton éteint** : elle promet huit types sans savoir combien ce projet-ci en porte.
  Elle dit le compte réel, ou ne compte pas.

### 2. Un type s'éteint — *le seul point qui touche au disque*

Un champ `actif` sur une échelle, vrai par défaut, qui ne fait qu'une chose : **retirer le bouton du
sélecteur de sujet** de la barre qui paie
([`PanneauReglages.tsx:250`](../../interface/src/composants/PanneauReglages.tsx#L250)).

> ⚠️ **Éteindre ne retire pas du barème, et c'est essentiel.** Une image déjà fabriquée porte le nom
> de son échelle, et le serveur refuse un nom qu'il ne trouve plus — *« « x » n'est pas une échelle
> de ce projet »* ([`univers.py:1368`](../../atelier/services/univers.py#L1368)). Un type éteint
> doit rester résoluble, sans quoi éteindre casserait des images anciennes. C'est la même règle
> qu'une table de recette éteinte : *ses réglages sont gardés, elle ne change pas l'image*.

Puis, une fois que c'est possible : **un projet reçoit les types du barème livré entrés après lui**,
éteints ou allumés selon ce qu'on tranchera. Ce qui referme le défaut des sept contre huit, et le
même défaut sur la bible à cinq cases.

### 3. L'assistant s'ouvre sur un jeu neuf, et se coupe en deux

- Créer un projet ouvre l'assistant ([`Arbre.tsx:55`](../../interface/src/composants/Arbre.tsx#L55)),
  comme le premier lancement le fait déjà ([`App.tsx:888`](../../interface/src/App.tsx#L888)).
- La condition du serveur passe de *l'atelier n'a rien* à **ce jeu-ci n'a rien**
  ([`bibliotheque.py`](../../atelier/services/bibliotheque.py), `neuf()`), et la décision `E19` se
  réécrit avec sa nouvelle raison.
- La colonne des douze étapes se coupe en deux groupes, le second replié derrière une ligne qui dit
  pourquoi il peut attendre. **Aucune étape ne disparaît** : la page des réglages reste entière,
  comme l'auteur le demande.
- **Rien n'est exigé pour commencer.** L'accueil qui s'ouvre ne doit pas ressembler à un formulaire
  à remplir avant d'avoir le droit de fabriquer — c'est une phrase du produit, et elle tient.

### 4. L'essai qui ferme le trou dans l'autre sens

Un essai qui lit `aide.ts` et le code de l'interface, et refuse une entrée qui nomme un contrôle
sans être citée par un écran — avec une liste d'exceptions **déclarée**, pour les entrées qui
décrivent un écran ou un domaine entier, comme `SANS_ENTREE`
([`aide.ts:1486`](../../interface/src/aide.ts#L1486)) déclare déjà les manques assumés dans l'autre
sens. Le message d'échec nomme la clé et le contrôle attendu.

### Ce que ça ne fait pas

- **Ça ne réécrit aucune explication.** Les vingt-trois textes sont bons ; il leur manque une
  accroche, pas une plume.
- **Ça n'ouvre pas le type sur mesure.** Le bouton reste éteint et garde sa raison — corrigée.
- **Ça ne touche pas à ce que le curseur d'occupation fait de travers.** C'est
  [l'autre remarque](curseurs-qui-derivent.md), sur le même écran, et les deux se posent
  probablement dans le même passage.

---

## Ce que ça laisse pour plus tard — une IA qui aide à formuler l'univers

L'auteur le pose lui-même comme *« juste une idée pour plus tard »*, et elle mérite d'être écrite
plutôt que perdue : **un modèle de texte qui pose des questions** — que veux-tu ? qu'imagines-tu ?
— et aide à formuler la bible d'un jeu au lieu de la faire taper à froid. Local et pré-prompté, ou
un modèle gratuit ou bon marché.

**Ce qui existe déjà et va dans ce sens** : l'étape *Références et couleurs* assemble un texte à
copier — *« Le texte à copier — pour ne pas partir de rien »*
([`Assistant.tsx:1919`](../../interface/src/composants/Assistant.tsx#L1919)) —, à coller dans
ChatGPT ou ailleurs, sans que l'atelier paie quoi que ce soit. C'est **la moitié sortante** du geste
demandé : le produit sait déjà rassembler ce qu'on lui a dit et le tendre à une IA. Il ne sait pas
faire revenir la réponse, ni poser la première question.

**Ce que ça coûterait, mesuré** : le produit n'a **aucun port de texte**. `atelier/fournisseur/port.py`
déclare deux contrats — un pour l'image, un pour l'animation — et rien pour une conversation. Ce
n'est donc pas un réglage à ajouter, c'est **un troisième genre de fournisseur**, avec sa clé, son
catalogue, son coût par appel et sa place dans le relevé des dépenses. La bonne nouvelle est que la
plomberie des fournisseurs est déjà au pluriel depuis la V2.2, et qu'un fournisseur qui ne demande
ni compte ni clé y est déjà branché.

**À rouvrir quand `B` sera construit**, pas avant : un accueil qui guide bien sans IA est le
préalable d'un accueil qui guide avec.

---

## Ce que cette remarque recoupe

- **[Les curseurs de taille dérivent](curseurs-qui-derivent.md)** — **le même curseur**, sur le même
  écran, pris par l'autre bout : là-bas il se conduit mal, ici on ne sait pas à quoi il sert. Les
  deux se réparent probablement dans le même passage.
- **[« Concept art de » et « Artwork officiel »](concept-art-contre-artwork.md)** — `bareme.famille`
  et `carte.famille` sont les deux bouts d'un seul mécanisme, et ni l'un ni l'autre ne le dit à
  l'endroit où on le règle.
- **« Les réglages de l'allure — sept reproches d'un coup »** *(journal, en vrac)* — les sept cases
  de la bible, dont les sept entrées du recueil sont elles aussi orphelines. À traiter en sachant
  ça.
