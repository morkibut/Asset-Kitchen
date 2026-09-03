# Ce que l'atelier écrit au modèle — étude, mesure et réparation

> **Ouvert le 1<sup>er</sup> septembre 2026**, à la demande de l'auteur, après une séance d'usage sur
> le projet « Le Marais du Vieux Moulin » : *les images reviennent belles, et jamais dans la bonne
> vue.*
>
> **Ce document a changé de nature en route.** Il a commencé en étude — dix défauts nommés, six
> réparations proposées — puis un banc a été payé, et **deux des réparations proposées se sont
> révélées inutiles**. Ce qui suit garde les deux, barrées, parce qu'une hypothèse séduisante et
> fausse est ce qu'un dossier doit le plus soigneusement conserver.
>
> **Prix total de ce qui est écrit ici : environ 1,42 $**, en 167 images gardées, sur six tours.
> Le premier banc — trois tours, 54 images, 0,57 $ — répare la vue : `essais/essai_vue.py`, relevé
> dans `essais/mesures_vue.json`, images sous `essais/resultats/vue/`. Le second — trois tours,
> 113 images, ~0,85 $ — cherche ce qui reste cassé ailleurs, sur deux jeux entiers :
> `essais/essai_deux_jeux.py`, images sous `essais/resultats/deux-jeux/`. Il commence au §6.
>
> **Sur ces 1,42 $, 0,72 $ seulement se relisent dans un fichier** — la base du second banc. Le reste
> a été lu au passage, dans la sortie des courses, et reconstruit ensuite au prix unitaire mesuré. Les
> deux bancs notent désormais ce qu'ils dépensent hors de cette base ; c'est écrit après coup, et donc
> écrit trop tard pour ce dossier-ci.

---

## 1 · Le symptôme, et ce qu'il n'était pas

Le jeu est déclaré **vu de dessus, à la verticale** — la caméra est au-dessus de la tête et regarde
le sol. Les trois générations payées sur ce projet sont revenues avec un pèlerin **debout, de face,
de plain-pied**, comme sur une affiche. Le personnage était le bon ; la caméra était fausse.

Le texte qui est parti demandait les deux choses à la fois, et il a demandé la mauvaise **en
dernier** :

```
… View and framing: Camera: strict 90-degree top-down view, directly overhead, …
Technical constraints: Sprite isolé sur fond plat, grille stricte 64×64 px, pas de perspective

Character design:
- dark green hooded cape
- beige tunic underneath
- brown boots
- small leather backpack
- handheld torch, idle stance, full body
```

Les six derniers mots du prompt sont `handheld torch, idle stance, full body`. Deux choses cassées
dans une seule ligne :

- **La consigne de pose s'est collée à la dernière puce** de la description. Les morceaux du sujet se
  joignaient par une virgule, ce qui marche pour une phrase et détruit une liste. Ce n'était plus une
  pose, c'était une torche tenue à pleine hauteur.
- **`full body` est une phrase de vue de face.** Elle était écrite en dur, la même pour les huit vues
  du produit, depuis toujours (`atelier/domaine/plan.py`).

---

## 2 · Ce que le banc a mesuré

**La mesure tient en un rapport** : la hauteur de la boîte du sujet sur sa largeur. Un corps debout
de face fait environ deux fois plus haut que large ; le même corps vu d'aplomb est presque rond. Le
fond des sprites est plat, donc la boîte se lit sans rien deviner.

Elle ne vaut que pour les vues d'aplomb — un profil juste est légitimement haut et étroit — et l'œil
tranche pour les autres, sur une seule question : de face, ou de profil ?

### Premier tour — qu'est-ce qui répare ? *(30 images, 0,32 $)*

Un personnage, une pose, neuf bras, trois tirages chacun. Le témoin n'est pas une reconstitution :
c'est le prompt payé, mot pour mot, vérifié contre `generation.json` avant que le banc parte.

| | Ce qu'on change | Médiane | |
|---|---|---|---|
| **A0** | le prompt payé, tel quel | **1,55** | de face |
| **A1** | + une phrase qui explique l'image jointe | **1,15** | de dessus |
| **A2** | + la caméra répétée en queue, à l'impératif | **1,13** | de dessus |
| **A3** | + la pose dite dans la caméra, sans `full body` | **1,26** | de dessus à l'œil |
| **A4** | + le prompt négatif composé | **1,69** | de face |
| **A5** | les quatre ensemble | **1,17** | de dessus |
| **A6** | le prompt payé, **image de référence retirée** | **1,46** | de face |
| **B1** | + un gabarit de silhouette vue de dessus | **0,99** | de dessus |
| **B2** | la chose refaite une fois dans la caméra du jeu | **1,14** | de dessus |

### ~~L'image de référence dominait le texte~~ — réfuté

C'était l'hypothèse la plus séduisante de l'étude, et la plus fausse. La carte du pèlerin est bien
une planche de quatre poses dessinées de face ; elle partait bien sans un mot pour dire ce qu'il
fallait en prendre. Mais **A6 la retire, et le sprite revient de face quand même** : 1,46 contre 1,55.

L'image n'imposait rien. Elle *confirmait* ce que le texte demandait déjà par sa fin.

### ~~Le prompt négatif manquait~~ — réfuté

Le champ existe, il part bien au fournisseur, il n'est jamais rempli. Rempli (A4), il ne change rien :
1,69, le plus mauvais chiffre du tour. **Dire ce qu'on ne veut pas ne dit pas ce qu'on veut.**

### Ce qui reste, et c'est une seule chose

**Une caméra dite en dernier, en mots qui décrivent ce qu'on doit voir.** Tous les bras qui gagnent
finissent par une phrase de caméra — y compris A1, dont la phrase sur l'image se termine par *« et
celle-ci doit être dessinée vue de dessus »*. Le seul bras qui perd est celui qui n'en a pas.

La raison tient en une phrase : **un modèle d'image pondère la fin.** La caméra était au sixième rang
de sept intitulés, et les derniers mots étaient ceux de la pose. On demandait le dessus au milieu et
la face à la fin ; c'est la fin qui gagnait.

### Deuxième tour — le produit corrigé, sur trois vues *(18 images, 0,17 $)*

Cette fois le texte n'est pas écrit à la main : **c'est le produit qui le compose**, par le même
chemin que l'envoi. Le témoin est ce même chemin avec les deux nouveaux blocs éteints d'un tri — une
seule chose change entre les deux bras.

| La vue déclarée | Avant | Après |
|---|---|---|
| **De dessus, verticale** | **1,53** — de face, faux | **1,13** — de dessus, juste |
| **De côté, plateforme** | **de face** — faux, le jeu demandait le profil | **de profil** — juste |
| **De dessus, 3/4** | juste — cette vue-là marchait déjà | juste, un peu plus vu d'en haut |

**C'est le résultat le plus utile des trois tours, et il élargit le problème.** Le prompt d'avant ne
marchait pas « sauf en vue de dessus » : il ne marchait **que pour les vues qui tombaient d'accord
avec `full body`** — de face, et de dessus 3/4. Un jeu de plateforme recevait un personnage **de
face** au lieu d'un profil, et personne ne l'avait signalé parce que ça ressemblait à un sprite
correct.

### Troisième tour — l'idée de l'auteur *(6 images, 0,08 $)*

> *« Une planche strictement encadrée pour la partie technique, qui partirait en référence pour
> recréer un artwork référent dans le bon style, la bonne vue et la bonne taille, afin de standardiser
> la génération des poses. »*

Trois poses d'affilée — repos, marche, attaque — avec le prompt **corrigé** dans les deux bras. Seule
l'image jointe change.

| L'image jointe | Ce qui revient |
|---|---|
| **la carte du tableau**, dessinée de face | les trois poses tiennent la vue, mais **pas l'échelle** — trois tailles nettement différentes — et l'attaque a **inventé une dague** absente du signalement |
| **la chose refaite une fois** dans la caméra du jeu | même taille, même silhouette, mêmes couleurs sur les trois poses ; aucun objet inventé |

**L'idée est bonne, et elle ne répare pas ce qu'on croyait.** Elle ne règle pas la vue — le texte
s'en charge, et mieux. Elle règle la **constance**, qui est un second problème, réel, et que rien
d'autre ne touche. Voir §5.

---

## 3 · Les trois causes, et les dix symptômes

### Cause A — le prompt n'avait pas de forme

Une concaténation à plat : sept lignes `Intitulé: texte`, puis le sujet, puis les consignes de
planche. Toutes du même poids, dans un ordre qui ne changeait jamais, quoi qu'on demande.

| | Le symptôme | État |
|---|---|---|
| **D1** | la pose collée à la dernière puce du signalement | **corrigé** |
| **D2** | `idle stance, full body` part aux huit vues du produit | **neutralisé** — voir §4 |
| **D3** | la planche demande `all standing on the same baseline` à un jeu vu d'aplomb | **corrigé** |
| **D4** | cinq vues écrivent `full-body character centered` — et ça partait avec les tuiles | **corrigé** |

### Cause B — trois sources écrivaient dans la même case, et on les empilait

Le produit savait déjà arbitrer entre l'auteur et l'ambiance — c'est le champ `remplace`, et l'écran
montre le perdant barré. Entre **l'atelier et l'auteur**, il collait les deux avec une virgule.

| | Le symptôme, sur les prompts réellement payés | État |
|---|---|---|
| **D5** | `strict top-down view seen from directly above, Camera: strict 90-degree top-down view, …` | **corrigé** |
| **D6** | `… strict 64x64 px tile snap, Sprite isolé sur fond plat, grille stricte 64×64 px, …` | **corrigé** |
| **D7** | sur le projet du nain : `strict 128x128 px tile snap, … strict 64x64 px tile snap` — **deux tailles dans la même phrase** | **corrigé** |
| **D8** | le prompt mélange deux langues | **ouvert** — voir §6 |

### Cause C — ce qui partait en image n'était jamais dit en mots

| | Le symptôme | État |
|---|---|---|
| **D9** | l'image de référence n'est pas expliquée | **corrigé** — mais ce n'était pas la cause du symptôme |
| **D10** | le champ « ce qu'on ne veut pas » n'est jamais rempli | **laissé tel quel** — mesuré sans effet |
| **D11** | un sujet vide part quand même — deux des trois personnages du projet n'ont pas de description | **corrigé** |

---

## 4 · Ce qui a été changé dans le produit

Six changements. Les 875 essais du dépôt passent, les 517 de l'interface aussi, et le typage est
propre.

### 1 · La caméra ferme le prompt — `atelier/domaine/vue.py`, `atelier/domaine/envoi.py`

Un nouveau groupe, `cadrage`, replié en dernier. La `Vue` porte deux textes de plus : la
**contrainte** — la caméra à l'impératif — et le **corps** — où sont la tête et les pieds dans cette
caméra-là. Les huit vues du produit les portent.

C'est le seul changement dont l'effet est mesuré : **1,55 → 1,13**.

### 2 · La phrase du corps ne part que pour ce qui a un corps — `atelier/services/production.py`

La caméra est vraie pour tout ce que le jeu dessine, une tuile de sol comprise. La phrase qui dit
*où sont la tête et les pieds* ne l'est que pour la famille des personnages. Un moulin reçoit la
caméra, pas le visage.

### 3 · Les images jointes se disent en mots — `atelier/services/generation.py`

Un groupe `jointes`, une phrase par rôle, et une troisième qui vaut pour les deux : *ne copiez pas
leur angle de caméra ni leur pose*. Elle se tait pour une édition — l'image qu'on retouche **est** la
demande — et elle ne parle pas de mise en page pour une planche, qui vient justement de demander
qu'on la recopie.

Effet mesuré : réel mais pas décisif (1,15). Gardé parce que le troisième tour montre qu'il sert à
autre chose — la constance — et qu'une image muette est un levier qu'on ne tient pas.

**Conséquence d'architecture** : le prompt se compose désormais **après** les images, et non avant.
Le service qui les choisit n'a jamais lu le prompt ; l'ordre pouvait donc s'inverser sans rien casser.

### 4 · L'atelier se tait quand l'auteur redit la même chose — `atelier/domaine/projet.py`

Quand la case de l'auteur parle déjà du sujet de la phrase d'atelier — une caméra pour la vue, un
calage ou une grille pour la technique et le rendu —, **c'est l'auteur qui gagne, seul**. C'est
l'arbitrage qui existait déjà entre une chose et son ambiance, appliqué une couche plus bas. Le
perdant reste visible, barré, sur l'écran de confirmation.

La liste des mots qui déclenchent l'arbitrage est **courte exprès** : en ajouter un de trop ferait
disparaître une phrase que personne n'aurait remplacée, et on préfère l'empilement — visible et
corrigeable d'un clic — au silence.

### 5 · La planche ne fait plus tenir debout sur un sol — `atelier/services/pliage.py`

`all standing on the same baseline` devient `each one aligned the same way inside its cell`. Ce que
la phrase achetait — des sujets alignés, donc découpables — est gardé mot pour mot ; ce qu'elle
disait en plus était une phrase de vue de face, et elle contredisait la caméra qui ferme le même
prompt.

### 6 · Un appel qui ne dit pas quoi dessiner ne part pas — `atelier/services/generation.py`

Le refus porte l'endroit où le réparer : c'est une case vide sur une fiche, pas une panne.

### Ce qui n'a **pas** été changé, et pourquoi

- **La table des consignes de pose** (`idle stance, full body`) reste telle quelle. Le banc dit que
  ça ne change rien une fois la caméra en queue — A2 garde `full body` et mesure 1,13, le meilleur des
  bras simples. La corriger toucherait le plan de chaque projet et des dizaines d'essais d'interface
  pour un gain que personne n'a mesuré. Elle reste une gêne à l'œil, pas un défaut à l'image.
- **Le prompt négatif** reste vide. Mesuré sans effet.

---

## 5 · L'idée de l'auteur — ce qu'elle vaut, et la forme qu'elle devrait prendre

**Verdict : elle est bonne, et elle répare autre chose que ce qu'on croyait.** Le texte règle la
caméra ; l'image règle la constance. Deux problèmes, deux réparations, et la seconde n'a pas encore
la sienne.

### Ce que le tour 3 a montré

Avec la carte de face en référence, trois poses du même personnage reviennent à **trois tailles
différentes**, et l'une d'elles invente un objet. Avec une image de la chose déjà refaite dans la
caméra du jeu, les trois se ressemblent.

C'est logique une fois dit : la carte de face est une image que le modèle doit **traduire** à chaque
appel, et il la traduit un peu différemment à chaque fois. Le référent, lui, est déjà dans la langue
de la demande — il n'y a plus rien à traduire.

### La forme que ça devrait prendre — une étape entre la toile et l'entité

C'est exactement ce que l'auteur décrit : *une étape ultra-guidée, l'utilisateur en spectateur et
juge*. Trois gestes, dont deux sont déjà dans le produit.

1. **On désigne l'artwork de la chose** sur la toile. *(existe)*
2. **L'atelier fabrique le référent** : un appel, un seul, qui redessine cette chose-là dans la
   caméra, la grille et la palette du jeu. Le prompt est celui du produit, sans pose. *(à écrire —
   c'est presque le bras B2a du banc, tel quel)*
3. **L'auteur juge, et il ne fait que ça** : ce référent-ci, ou on refait. Une image, un centime.
   C'est le seul endroit du produit où juger une image coûte moins cher que de se tromper sur vingt.
4. **Le référent accepté devient la référence de toutes les poses de la chose**, à la place de la
   carte de face — qui reste sur la toile, où elle sert à autre chose.

### Les trois choses à savoir avant de l'écrire

- **Le référent doit partir petit.** Envoyé en 1024×1024, il coûte **58 % de plus par appel** que la
  petite carte du tableau (0,0158 $ contre 0,0100 $). Sur un personnage à vingt-quatre cases, c'est
  la moitié du bénéfice qui repart en frais d'image. Il doit partir à la taille du sprite.
- **Le référent ne remplace pas le signalement.** Le bras B2b du premier tour a perdu la torche du
  pèlerin, parce que le prompt d'essai ne décrivait plus le sujet et se contentait de renvoyer à
  l'image. Le produit, lui, envoie toujours le signalement — mais la règle doit être écrite avant
  qu'on l'oublie.
- **La planche technique, elle, n'est probablement pas nécessaire.** Le bras B1 — un gabarit de
  silhouette dessiné sur la machine, envoyé en seconde image — donne le meilleur chiffre du banc
  (0,99). Mais il coûte une place de référence et un appel plus cher, pour un gain sur une chose que
  le texte tient déjà. Il vaut d'être gardé en réserve pour la vue qui résisterait, pas d'être
  construit d'avance.

---

## 6 · Le banc de couverture — deux jeux que tout oppose

> **113 images, 114 appels, environ 0,85 $**, sur `essais/essai_deux_jeux.py` — dont 0,7185 $ pour
> 96 appels, lu dans la base de l'atelier du banc, et 18 appels reconstruits au prix unitaire du jour
> (0,0069 à 0,0078 $). `--lire` ouvre sur ce décompte et dit lui-même ce qui est sourcé.
>
> Le lot principal passe par `ServiceGenerations.soumettre`, le même appel que l'écran et que l'outil
> de l'agent : ce qui casse là casse pour de vrai. **Deux bras font exception** — comparer deux queues
> de prompt demande d'écrire la queue soi-même, ce que le produit ne permet pas. Le bras du cadrage et
> celui de la direction prennent le texte composé par le produit, y ajoutent la queue à l'essai, et
> appellent le fournisseur en direct. Le prompt reste celui du produit ; l'envoi seul ne l'est pas.

Le premier banc avait réparé une panne sur *un* projet, *une* pose, *un* sujet. Il ne disait rien de
ce qui restait cassé ailleurs. Celui-ci monte deux jeux réels et complets :

| | Néon Sous-Sol | Les Terres de Sel |
|---|---|---|
| vue | de côté, plateforme | de dessus, stricte |
| directions | 2 | 4 |
| taille de pixel | 32 px | 64 px |
| trait | contour noir épais | sans contour, tramé doux |
| contenu | 2 personnages, 2 objets | 2 personnages, 2 objets |

### La mesure la plus utile est celle du bruit

**Dix générations rigoureusement identiques**, pour savoir ce qui est un effet et ce qui n'en est
pas un. Sans elle, la moitié des conclusions de ce banc auraient été fausses :

| ce qu'on mesure | médiane | étendue sur dix tirages |
|---|---|---|
| rapport hauteur/largeur | 1,07 | 0,97 à 1,16 — **utilisable** |
| aire du sujet | 46 % | 39 % à 52 % — utilisable |
| couleurs distinctes | 116 | 90 à 171 — grossier |
| taches détachées | 18 | **1 à 42** — inutilisable, la mesure lit le tramage |
| distance de couleur entre deux tirages | — | **0,225** — c'est le plancher de tout écart |

**Une mesure de ce banc a donc été retirée** : le compte de taches ne compte pas des objets, il
compte des grains de tramage. Et une autre a été refaite : juger la vue contre une fourchette fixe
par caméra marquait douze cellules en défaut dont **aucune** ne l'était — un drone est plus large
que haut, un lézard vu d'aplomb est plus long que large. Le bon étalon d'un sujet est **son propre
artwork**, pas une fourchette écrite d'avance.

**Et ce bruit-là ne suffisait pas.** Dix appels identiques disent ce que coûte une image ; ils ne
disent pas ce que coûte une **médiane de trois**, qui est ce que chaque case du banc contient
réellement. Le témoin de la direction a fourni la réponse par accident : le même appel du produit,
payé deux fois, bouge de 1,4 % — soit une fois et demie le bruit d'une image. C'est ce plancher-là
qui juge, et il a renversé une conclusion (voir plus bas).

### Le banc ne rendait pas ses réponses — corrigé le 1ᵉʳ septembre 2026

Il faut l'écrire, parce que ce dossier a failli reposer dessus. **`--mesurer` ne lisait qu'un
dossier d'images sur trois** : les quarante-deux images des deux tours de reprise étaient payées,
rangées, montées en planches de contact — et ne rendaient aucun chiffre. Les deux conclusions les
plus importantes de ce banc, le gain de cadrage et l'échec de la direction, avaient été calculées à
la main, une fois, hors du banc. Elles ne pouvaient donc être ni rejouées ni contredites.

Trois choses ont été réparées :

- **`--mesurer` relève les trois lots**, sous un préfixe chacun ; 113 images au lieu de 71.
- **`--lire` a deux sections de plus** — la reprise et la direction — et une section 0 qui dit ce que
  le banc a coûté, en distinguant ce qui est lu dans sa base de ce qui est reconstruit.
- **Deux relevés ont été ajoutés** : la *surface* du sujet, qui est ce que la phrase de cadre déplace
  (l'ancienne mesure ne regardait qu'une hauteur), et la *masse du tiers haut*, qui est la seule
  chose du banc capable de distinguer une direction d'une autre sans un œil.

C'est la règle du dépôt appliquée au dépôt lui-même : une image payée qui ne rend aucun chiffre n'a
servi à rien, et un chiffre publié qu'aucune commande ne recalcule n'est pas une mesure.

### Six défauts trouvés, quatre réparés

| | Ce que le banc a trouvé | État |
|---|---|---|
| **D12** | `from the head down to the feet` part à un **quadricoptère** ; `the shoulders are wide` part à un **lézard**. La phrase de caméra parlait anatomie | **réparé** — elle parle géométrie, l'exemple humain n'est plus qu'un exemple |
| **D13** | `held in one hand` fait dessiner **une main** que personne n'a décrite, sur un objet d'inventaire | **réparé** — vérifié 3 sur 3, la carte revient seule. Effet de bord mesuré : elle revient aussi **debout** au lieu d'être couchée (h/l 0,45 avant, 4,4 à 6,4 après, sur trois tirages). Ni l'un ni l'autre n'est faux pour une carte, mais rien dans le prompt ne choisit — à surveiller le jour où quelque chose en dépendra |
| **D14** | `open, lid raised` fait lever **un couvercle à un distributeur de boissons** | **réparé** — vérifié, la machine s'ouvre par sa face |
| **D15** | Un **coffre** revient de trois quarts dans un jeu vu de dessus : la phrase qui dit *quelles faces on voit* ne partait que pour les personnages | **réparé en partie** — elle part pour tout ; l'ouvert s'aplatit, le fermé résiste |
| **D16** | Le sujet n'occupe que **14,7 %** de l'image, et tout sera ensuite ramené à 32 ou 64 px | **réparé** — une phrase de cadre en queue le porte à **20,1 %**, soit 37 % de pixels en plus |
| **D17** | **La direction n'arrive pas** dans un jeu vu de dessus | **non réparable par des mots** — voir plus bas |

### Le résultat qui compte le plus, et c'est un échec

**Sur un jeu vu de dessus, `marche vers le sud` et `marche vers le nord` rendent la même image.** La
direction est le second axe de la matrice : elle multiplie la production par quatre. Elle n'arrive
pas.

La mesure est la répartition de masse du sujet dans sa propre boîte — un corps vu d'aplomb qui
s'éloigne montre sa nuque et ses épaules, sa masse monte ; le même de face montre son visage et ses
bras, elle descend. **Quatre bras, dont deux qui sont le même appel** :

| | tiers haut, sud | tiers haut, nord | écart |
|---|---|---|---|
| *bruit d'une image à l'autre, sur dix appels identiques* | — | — | ±0,9 % |
| **le produit tel quel — premier lot** | 26,2 % | 29,4 % | **3,2 %** |
| **le produit tel quel — second lot, un mois plus tard** | 27,4 % | 28,0 % | **0,6 %** |
| la consigne repliée en queue de prompt | 40,0 % | 37,6 % | 2,4 % |
| l'orientation dite comme une rotation du plan | 38,2 % | 36,6 % | 1,6 % |

**Les deux lignes en gras sont le même appel, la même pose, la même direction, payées deux fois.**
Elles ne disent pas la même chose : l'une donne 3,2 % d'écart entre le sud et le nord, l'autre 0,6 %.
Ce n'est donc pas le bruit d'une image qui juge ici — c'est celui d'un lot, et il vaut **±1,4 %**.
Au-dessus de deux fois ce plancher, aucun des quatre bras ne tient.

C'était le piège, et le banc y était tombé : jugé au bruit d'une image, le premier lot passait pour
un succès. **Un effet qui ne se reproduit pas d'un lot à l'autre n'est pas un effet.**

Les deux bras de réparation changent bien quelque chose — le tiers haut passe de 27 % à 39 % — mais
**de la même façon pour le sud et pour le nord**. Ce n'est pas la direction qui est obéie, c'est le
cadrage qui bouge. L'est et l'ouest, mesurés sur l'autre axe, ne font pas mieux : 30,0 % contre
32,5 % de masse à gauche, pour un plancher de ±2,4 % sur cet axe-là.

**Conclusion : la direction ne s'obtient pas par des mots.** C'est exactement ce que
`docs/archive/essais-v3/etude-mannequin.md` avait supposé pour l'attitude — *les mots ne savent pas dire une posture* —
et cette mesure l'étend à l'orientation. La réparation, si elle vient, sera une **image** : un
référent par direction (§5), ou la scène articulée de la V3. Le repère du cadre a quand même été
gardé : demander à un personnage vu de dessus de faire face au spectateur, c'est lui demander de
regarder le ciel, et un contresens qui ne coûte rien reste un contresens.

### Deux questions fermées, et une réparation refusée

- **La langue de la bible ne change rien.** Trois tirages avec une bible tout en français, trois avec
  la même tout en anglais : même vue (h/l 0,99 contre 1,02, dans le bruit), même style, même qualité.
  **La question D8 est close, et il n'y a rien à faire.**
- **Le centrage n'a jamais été un problème** : de 0,2 % à 3,9 % d'écart au centre sur les
  vingt-sept cellules. La phrase `subject centered` travaille.
- **Une demande de fond plat a été essayée puis retirée.** La phrase de cadre demandait aussi *un
  fond d'une seule couleur, sans dégradé ni vignette*. Mesuré sur les pixels d'un coin, le fond est
  ressorti **plus bruité avec la phrase que sans** — amplitude de 17 niveaux contre 4. On ne garde
  pas une phrase qui ne fait pas ce qu'elle dit, même quand elle a l'air raisonnable.

---

## 7 · Ce qui reste ouvert

- **La direction, et c'est le plus gros.** Voir §6. Rien de textuel ne la fera arriver ; la suite est
  une image, et elle appartient à la même famille de questions que le mannequin de la V3.
- **La grille de pixel ne suit pas la taille demandée.** Le jeu à 32 px et le jeu à 64 px rendent
  tous deux des blocs de 8 à 12 px sur une image de 1 024 — soit à peu près la même densité, alors
  qu'un facteur deux les sépare. Le dépôt le savait déjà pour d'autres raisons
  (`docs/ARCHITECTURE.md` §4 bis) ; ce banc le confirme sur deux styles opposés. **Le prompt n'y
  peut rien** : c'est le rééchantillonnage de l'atelier qui rattrape, et il rattrape mieux quand le
  sujet est gros — d'où l'intérêt de la phrase de cadre.
- **Les artworks officiels qui ne le sont pas.** Aucune des six cartes du projet « Le Marais du Vieux
  Moulin » n'est marquée *artwork officiel* — les six sont des cartes ordinaires. La palette du jeu
  est donc déduite de zéro artwork, elle est vide, et la bande de couleurs ne part jamais. Si l'auteur
  croit avoir promu ses trois artworks, le geste n'a pas pris. **C'est un défaut d'écran, à vérifier
  là-bas.**
- **Deux entrées s'appellent « de dessus ».** « De dessus, verticale » est la caméra des jeux de tir à
  défilement : une image par pose, aucune direction. Un jeu d'exploration où l'on marche dans quatre
  sens demande « de dessus, stricte ». C'est un choix d'auteur, mais l'écran ne dit pas ce que la
  différence coûte.
- **La consigne de pose reste écrite pour une vue de face.** Neutralisée, pas corrigée : `full body`
  part encore, et la caméra en queue le neutralise. Mesuré sans effet sur la vue ; il reste une gêne à
  la lecture.
- **Le coffre fermé résiste.** La phrase de faces aplatit le coffre ouvert, pas le coffre fermé. Un
  objet sans intérieur visible garde sa face avant, et aucune phrase essayée ne l'a couché.
