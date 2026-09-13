# Cadrage — le fil, et le pantin 3D

*Écrit le 6 septembre 2026, avec l'auteur. **Rien ne se construit avant que la V4 soit close** —
tranché ce jour-là. Ce document existe pour que la réflexion ne se reperde pas d'ici là, et
pour que les deux versions s'ouvrent sans reposer les questions déjà tranchées.*

> **Ce document ne fait foi sur rien de construit.** Il ne découpe aucune tranche et n'ouvre
> aucune user story. Il enregistre quatre décisions, nomme les invariants à lever, et écrit
> les deux relevés à faire en premier. Le PRD et le plan s'écriront quand la V4 sera close.

---

## Les deux demandes, en clair

**Le fil.** Aujourd'hui, une image se fabrique en un aller simple : on remplit l'écran d'envoi,
on voit le texte exact qui part et ce que ça coûte, on envoie, une image revient. Si elle est
ratée, on recommence de zéro, et on repaie. Le fil remplace l'aller simple par un va-et-vient :
on discute avec un modèle de texte pour mettre le prompt au point, on l'envoie, l'image revient,
on dit *« mets la cape en rouge, enlève le chapeau »*, et l'image se retouche — jusqu'à l'image
de référence qui convient.

**Le pantin 3D.** Aujourd'hui, une animation se fabrique par la vidéo : on paie un clip, on y
découpe des bandes (V3). Ce qu'on ne contrôle pas, c'est la vue, la pose et le mouvement — on
demande, et on regarde ce qui revient. La seconde méthode part d'une image du sujet, en fait un
maillage 3D, y pose un squelette tout seul, l'anime, et le rend sous l'angle et dans la pose
qu'on choisit. Ce prototype existe et tourne : c'est `C:\STOCKAGE\PROJET\_DEV\asset3d`.

---

## La brique que les deux partagent

**Donner une image à un modèle avec une consigne, et récupérer l'image modifiée.**

Le fil en a besoin pour *« mets la cape en rouge »*. Le pantin 3D en a besoin pour *« redessine
cette pose dans le style du jeu »* — c'est la décision n°3 ci-dessous.

Elle n'existe pas dans le dépôt. `Demande.references` envoie bien des octets à un modèle depuis
T3, mais une référence **inspire** ; elle ne **modifie** pas une image donnée. C'est une capacité
de plus au port des fournisseurs, et c'est la première chose à mesurer.

**Conséquence d'ordre, et elle n'est pas négociable** : le pantin 3D est bloqué par le fil.

---

## Les quatre décisions du 6 septembre 2026

| La question | Ce que l'auteur a tranché |
|---|---|
| Le fil paie-t-il ? | **Oui — il devient le troisième lieu qui paie.** L'invariant d'`E2` se lève explicitement |
| asset3d, brancher ou recopier ? | **Recopier et intégrer.** Et *peut-être sans Blender* — la question du rendu s'étudiera en détail quand asset3d aura avancé, pas maintenant |
| Le 3D rend-il l'image finale ? | **Non — il rend la pose de référence**, et un modèle la redessine dans le style du jeu |
| Quand ? | **Tout après la V4**, relevés compris |

---

## Ce qui existe déjà, et qui n'est donc pas à construire

| La brique | Où elle en est |
|---|---|
| Envoyer une image en référence à un modèle | **faite** — `Demande.references`, depuis T3 |
| Parler à un moteur local | **faite** — `atelier/fournisseur/maison.py` parle à un ComfyUI déjà installé, par HTTP, sur le port 8188 |
| Rapatrier un poids manquant, et griser avec sa raison | **faite** — trois absences distinctes, trois traitements, depuis `A11` |
| Choisir un modèle, et en changer | **faite** — le catalogue décide, l'adaptateur répond, jamais une liste en dur |
| Voir le texte exact avant de payer | **faite** — `POST /api/prompt/preview`, sans rien facturer et sans sortir de la machine |
| Compter en temps plutôt qu'en argent | **faite** — `ImageProduite.unite`, depuis `F2` |
| **Un appel de texte** | **inexistante** — zéro occurrence dans tout le dépôt, vérifié |
| **Une consigne de retouche sur une image** | **inexistante** |

Le moteur de la maison est le point le plus important de ce tableau : **une génération d'image
locale n'est pas à écrire de zéro**. C'est le même ComfyUI, sur le même port, avec le même
adaptateur — un autre montage à l'intérieur.

---

## Les invariants à lever, et comment

Aucun ne se contourne en silence. Le dépôt a déjà levé des invariants — `E13` en `P2`, la clé
de fournisseur en `F1` — et chaque fois de la même façon : **on ne lève qu'en apportant la
réponse qui rend la levée inoffensive.**

### 1 · « Une seule barre de saisie, deux lieux seulement paient » (E2)

**Levé par la décision n°1.** Le fil devient le troisième lieu qui paie. Ce qui doit tenir en
échange, et qui n'est pas négociable :

- Chaque tour du fil **annonce ce qu'il coûte avant de partir**, comme l'écran d'envoi.
- Chaque tour **montre la phrase exacte qui part**, demandée par le chemin même de l'envoi —
  c'est l'invariant d'`E14`, et un chat le viole par nature s'il ne fait rien.
- **Un tour est un geste écrit.** Aucune boucle « continue jusqu'à ce que ce soit bon » : c'est
  la règle la plus ancienne du produit (`T1`), et elle ne se lève pas.
- Le carnet et la barre continuent de n'engager aucune dépense.

### 2 · « Rien n'y coûte un centime » — la toile

**Ne se lève pas ; le fil ne vit pas sur la toile.** Le fil est un lieu à lui, et la toile garde
sa règle. Ce qui les relie : une image de référence trouvée dans le fil **se pose sur la toile**
une fois qu'elle est bonne. La toile reste ce qu'elle est — un endroit gratuit où l'on pense.

*Le nom de « toile » dans la demande d'origine désignait le geste, pas le lieu : c'est le
va-et-vient libre qui était demandé, et il ne réclame pas d'être posé sur le plan infini.*

### 3 · « Aucun modèle génératif local » (T1)

**Il faut le lever pour de bon, et ce n'est pas une précision.** Il a déjà été précisé une fois,
en `T2`, pour admettre un modèle de découpe : *« la règle vise ce qui fabrique une image, pas ce
qui en découpe une »*. Fabriquer un maillage 3D à partir d'une photo, **c'est fabriquer**.

Ce qui a changé depuis, et qui justifie la levée :

- Le motif d'origine de la règle — *« évite le gestionnaire de mémoire vidéo, les
  rechargements »* — a déjà été démenti dans les faits par `A11` : un moteur local tourne, il
  est grisé quand il n'est pas là, et il n'a rien cassé.
- Le prix reste le seul argument, et il est en faveur du local : une matrice complète coûte
  vingt-quatre générations payées aujourd'hui.

**La levée s'écrit avec sa raison, dans les invariants de `docs/PLAN.md`, le jour où la version
s'ouvre.** Pas avant, et pas en douce.

### 4 · Le refus de traduire, écrit trois fois dans le code

> *« Le produit ne traduit pas à sa place — il n'invente pas un texte qui partira dans un appel
> payé. »* — `atelier/domaine/direction.py:51`

La moitié « appel payé » tombe avec un modèle local gratuit. **L'autre moitié ne tombe pas** :
ne pas décider à la place de l'auteur. Dans le fil, elle devient une règle de conception —
le modèle propose, l'auteur lit et envoie — et non un obstacle.

---

## Ce que la mesure dit déjà du modèle de texte

`docs/archive/recherche-llm-local/rapport.md`, 3 septembre 2026 : quatorze modèles éprouvés sur cette
machine, environ 2 300 appels, avec pour corrigé les 70 étiquettes écrites à la main par
l'auteur.

| L'usage | Le verdict mesuré |
|---|---|
| Enrichir librement un texte court | **Le pire des quatre.** ~220 inventions sur 54 essais, et **aucun des quatorze modèles** n'a tenu la consigne |
| Traduire, et seulement traduire | **Ça tient** — 6 phrases sur 8 impeccables, avec un lexique figé pour les mots de métier |
| Relever le style d'une image | **Le meilleur des quatre**, et ce n'était pas celui qu'on cherchait |
| Décrire un objet, ou rendre un chiffre | **Échoue** — une hache vue comme un bouclier ; aucun chiffre juste sur les vérifiables |

**Ce que ça ne condamne pas.** Un modèle qui invente est catastrophique dans un bouton
« améliore » que personne ne relit. Dans un fil, l'auteur lit chaque tour avant d'envoyer :
l'invention se voit et se corrige. La mesure ne dit pas *« pas de fil »* — elle dit **où poser
la qualité**, et pourquoi pouvoir changer de modèle en cours de route est la bonne intuition :
un modèle local de 4 Go ne rédigera pas un bon prompt tout seul.

Le rapport recommande un port de texte ouvert, avec trois mises en œuvre interchangeables —
Ollama, un service gratuit, un service payant. Ollama est déjà installé sur la machine.

---

## Le pantin 3D — ce que le prototype apporte, et ce qu'il ne règle pas

### Ce qui est déjà construit dans asset3d

Un serveur local en Python (FastAPI) qui enchaîne **modèle 3D → squelette automatique →
rendu**, et une page en React. Sept phases portent la mention *livrée* — les réglages de rendu,
la bibliothèque de personnages, la comparaison des rendus, les quatre angles cardinaux, la
retouche du squelette. La planche de sprites (phase 18) et les planches en série (19) ne sont
pas livrées.

**Mesuré sur cette machine** (RTX 3080 portable, 8 Go) : 2 min 17 pour le maillage, 8 s pour le
squelette. Gratuit, et **déterministe** — la même demande rend la même bande.

**Licence du rig** : Make-It-Animatable est en MIT. Son jeu de données pèse 116 Mo — pas les
8,7 Go du dossier, qui sont surtout des poids et un environnement.

### C'est la réponse à l'objection qui avait tué le pantin

Le pantin — l'ex-`A8` — est sorti de la V3 le 3 septembre 2026. Sa limite était écrite :

> *« Il ne fait bouger que ce qui est déjà dessiné. Une marche de profil, oui ; un demi-tour,
> une main qui se retourne, un visage qui change d'expression, non. »*

**Le 3D fait ces trois-là**, et il garde ce que le pantin avait de bon et que la vidéo n'a
pas : la reproductibilité à l'octet près.

Et il change l'échelle d'`A12` — *couvrir toute la matrice d'un personnage en animation* :
un rendu par lot au lieu de vingt-quatre générations payées.

### Ce qui reste ouvert, et qui est le vrai sujet

**La ressemblance.** Un maillage sorti d'une image, rendu en 3D, ne ressemble pas à un sprite
du jeu — il ressemble à un rendu 3D. C'est la même question qu'`A13` a laissée ouverte pour les
frames de vidéo : *une case tirée d'un rendu tient-elle comme pose officielle ?*

**La décision n°3 y répond d'avance** : non, et ce n'est pas ce qu'on lui demande. Le 3D donne
la **vue, la pose et la silhouette exactes** ; un modèle les redessine dans le style. Ce qui
reste à mesurer n'est plus *« est-ce que ça ressemble »* mais *« un modèle sait-il redessiner
une pose 3D en gardant sa pose »* — et c'est le second relevé.

### La recopie, et ce qui n'est pas décidé

L'auteur a tranché **recopier et intégrer**, pas brancher. Deux choses restent expressément
ouvertes, et se décideront quand asset3d aura avancé :

- **Le rendu passe-t-il par Blender ?** Peut-être pas. À étudier alors, pas maintenant.
- **Ce qu'on recopie exactement** : le maillage, le squelette, le rendu, la page — ou seulement
  une partie. asset3d est encore un prototype en cours de développement, et recopier une chose
  qui bouge est le meilleur moyen de faire diverger deux dépôts.

---

## Les deux relevés à faire en premier

*Après la V4. Ils ne touchent aucun écran, n'ouvrent aucune user story et ne se périment donc
pas — c'est le motif d'`A0`, `E0`, `F0` et `N1`, qui ont chaque fois évité de construire à
l'aveugle. **Leurs réponses décident du découpage des deux versions.***

### R-fil · La retouche par consigne existe-t-elle, et où

**La question** : donner une image et une consigne — *« mets la cape en rouge »* — et récupérer
l'image modifiée avec le reste inchangé.

**Ce qu'il faut mesurer**, chez un fournisseur payant **et** sur le ComfyUI de la maison :

- Le sujet survit-il à la retouche, ou le modèle en redessine-t-il un autre ?
- Combien de tours d'affilée avant que l'image dérive ?
- Ce que ça coûte par tour, et dans quelle unité.
- Ce que le port des fournisseurs doit gagner pour porter ça : une capacité de plus, ou un
  troisième port.

### R-3d · Une pose 3D se laisse-t-elle redessiner sans bouger

**La question** : donner un rendu 3D d'un personnage dans une pose, et une consigne de style —
et récupérer la même pose dessinée dans le style du jeu.

**Ce qu'il faut mesurer** :

- La pose tient-elle, ou le modèle la rejoue-t-il à sa façon ?
- Le personnage reste-t-il le même d'un angle à l'autre — face, dos, gauche, droite ?
- Combien de cases d'une matrice passent du premier coup, et combien sont à refaire.
- Est-ce que c'est **moins cher** que les vingt-quatre générations qu'on paie aujourd'hui,
  une fois les ratés comptés.

---

## Le rang des deux versions — le dernier point ouvert

`docs/PLAN.md` porte aujourd'hui deux versions non découpées après la V4 : **V5, les tuiles qui
se raccordent**, et **V6, le son** (`docs/archi-versions.md` §9 et §10, dont les numéros datent
d'avant le décalage du 6 septembre 2026).

Le fil et le pantin 3D prennent donc les deux numéros suivants — **sauf si l'auteur les veut
avant les tuiles et le son**, auquel cas c'est un décalage d'un cran de plus, exactement comme
celui qu'a provoqué l'entrée de la V4.

**Ce qui est fixé quoi qu'il arrive** : le fil passe avant le pantin 3D, parce que c'est lui qui
construit la brique image→image dont la décision n°3 fait dépendre le 3D.

```
V4 · le carnet  ────────────────►  close
 │
 ▼
R-fil          R-3d          les deux relevés, en parallèle
 │              │
 ▼              │
le fil  ────────┴────────────►  la brique image→image
 │
 ▼
le pantin 3D
```
