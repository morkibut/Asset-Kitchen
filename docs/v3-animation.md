# V3 — l'animation : ce que l'auteur a jugé, et ce qu'il faut en retenir

> ## ⚠️ Dépassé le 2 septembre 2026 sur la question qu'il posait
>
> **Ce document cherche la meilleure façon de demander une planche. La V3 ne demande plus de
> planche.** Six essais tirés le 2 septembre 2026 ont tué les quatre chemins qu'il explorait et
> en ont ouvert un cinquième : **animer le sprite en vidéo, puis découper le clip**. Ce qui
> décide aujourd'hui est `docs/PLAN.md` § V3, et le détail des tirages est dans
> `essais/verdict-essais.json`.
>
> **Ce qui reste vrai ici**, et qui vaut d'être relu : les mesures planche par planche, le
> défaut du recadrage étape par étape — que la fenêtre commune répare et qui vaut aussi pour un
> clip —, et la démonstration que la mesure automatique ne prédit pas le jugement de l'œil.
>
> **Ce qui y est faux depuis** : tout ce qui présente le pantin comme la sortie de la loterie,
> et tout ce qui suppose qu'une animation s'obtient en demandant huit cases d'un coup.

> ⚠️ **Ce n'est plus le document à lire en premier. C'est `docs/bilan-v3.md`**, écrit le
> 2 septembre 2026 : il conclut, chiffre par chiffre, ce que les trois bancs et le relevé
> d'outillage ont établi, et il remplace la lecture de sept fichiers. **Cette note-ci reste
> la source** — les bancs planche par planche, les notes de l'auteur, les tableaux complets —
> et on l'ouvre quand on veut vérifier un chiffre du bilan ou revoir un tirage.
>
> **Cette note ne décide rien à elle seule** — `docs/PRD.md` dit ce que le produit doit
> faire, `docs/PLAN.md` dans quel ordre. Elle porte **les résultats de trois bancs payés** et
> les conséquences qui en découlent, pour qu'on n'ouvre pas la V3 sur des suppositions.
>
> Ouverte le 1<sup>er</sup> septembre 2026, **close le 2**. **141 planches, $6,03 dépensés**
> en tout : un premier banc qui compare **huit modèles à demande identique**, un second qui
> compare **vingt-neuf demandes au même modèle**, un troisième qui **arbitre les deux
> dernières pistes** — vingt-quatre tirages, $0,71.
>
> **Ce qui fait foi, ce sont les notes de l'auteur.** Les cent trente-cinq animations
> lisibles ont été regardées une par une et notées **mauvais, moyen ou bon**
> (`essais/notes-auteur.json`). Tous les classements de cette note sont refaits sur ces
> notes-là, et sur rien d'autre — pour la raison qui suit, et qui est le résultat le plus
> important de la première séance.
>
> **Ce que le troisième banc a répondu tient en une phrase, et elle ferme le sujet : la
> façon de demander est épuisée comme levier.** Les deux pistes qui restaient ont été
> payées huit fois chacune et n'ont rien donné. Le détail est plus bas ; la conséquence est
> que le produit garde son prompt tel quel, et que **le mannequin articulé redevient le seul
> chemin** vers une animation qu'on ne tire pas à la loterie.
>
> Le rendu visuel — **chaque animation qui tourne à côté de sa note et de son prix** — est
> dans **`essais/rapport-animation.html`**, un seul fichier. Le troisième banc a en plus sa
> propre page, où les quatre combinaisons sont mises en carré :
> **`essais/rapport-arbitrage.html`**. Les rapports d'origine
> (`essais/resultats_animation/rapport.html`, `essais/resultats_recette/rapport.html`)
> restent sur le disque, mais **ils sont périmés** : ils classent sur une mesure qu'on sait
> maintenant fausse.

---

## ⚠️ Le premier résultat : ma mesure automatique ne prédisait rien

Toute la conduite de ces bancs s'est appuyée sur une mesure que j'avais écrite — **la
forme** : de combien le rapport hauteur/largeur du personnage change d'une case à l'autre.
L'idée était qu'un corps qui marche se tasse et se détend, donc que sa forme varie ; et
qu'un sprite simplement redessiné en plus petit garde la sienne.

Confrontée aux notes de l'auteur, **elle ne prédit rien du tout** :

| ce que ma mesure disait | bonnes | moyennes | mauvaises | **part de bonnes** |
|---|---|---|---|---|
| « planche utilisable » | 3 | 12 | 8 | **13 %** |
| « planche rejetée » | 11 | 30 | 71 | **10 %** |

Les planches que la mesure rejetait contiennent **presque autant** de bonnes marches que
celles qu'elle retenait — treize pour cent contre dix, quand une mesure qui vaudrait quelque
chose montrerait un écart d'un tout autre ordre. Et le détail va à l'envers :

| note de l'auteur | forme moyenne |
|---|---|
| bonne | **6,0 %** |
| moyenne | 9,3 % |
| mauvaise | **9,9 %** |

**Plus la forme variait, plus la planche était mauvaise.** L'explication tient en une
phrase : une forme qui change beaucoup d'une case à l'autre, ça peut être un corps qui
marche — mais c'est bien plus souvent **un personnage dessiné à des tailles différentes
d'une case à l'autre**, ce qui est exactement le défaut qui rend une planche inutilisable.
La mesure confondait le mouvement avec l'incohérence, et l'incohérence est plus fréquente.

**Ce que ça annule.** Tous les classements publiés avant cette page reposaient sur cette
mesure. Deux affirmations en particulier sont retirées :

- *« la planche `jet2` de `seedream-4.5` est le cycle de marche le plus net de tout le
  banc »* — **faux**. L'auteur a noté **mauvaises les huit planches** de ce modèle ;
- *« la clause `same proportions, same size` n'y est pour rien, l'effet était du hasard »* —
  **prématuré**. Sur les notes, l'hypothèse redevient la meilleure piste de la séance.
  Elle n'est pas prouvée pour autant ; elle est **rouverte**.

*Ce qui reste vrai de mon juge automatique : le **découpage**. Savoir si le modèle a
redessiné les traits du quadrillage par-dessus le gabarit n'est pas une affaire de goût,
c'est un fait vérifiable — et l'œil ne peut pas le voir, puisque les animations sont
montrées **coupées brutes**, sans détourage. Les deux jugements sont donc gardés côte à
côte : l'auteur dit si ça marche, la machine dit si le produit saurait l'ouvrir.*

---

## Ce que les notes établissent, en quatre phrases

1. **Le choix du modèle est réglé, et ce n'est pas lui le problème.** `gpt-image-2`, celui
   que le produit utilise déjà, signe le plus de bonnes planches et de très loin le moins
   cher. Un seul autre mérite d'être gardé en tête : `gemini-3-pro-image`, presque jamais
   mauvais mais presque jamais bon, et neuf fois plus cher par bonne planche.
2. **Le prompt du produit gagne nettement la comparaison des consignes**, et il n'y a rien
   à réécrire : les cinq réécritures de fond donnent **zéro bonne planche sur vingt**.
3. **La loterie est réelle et plus dure que je ne l'avais chiffrée** : **quatorze bonnes
   planches sur cent trente-cinq**, une sur dix. C'est ce chiffre-là qui décide du geste
   principal de la V3.
4. **Les deux dernières pistes ont été payées, et elles sont mortes.** Moins de cases :
   **zéro bonne planche sur seize**. La clause de constance remplacée, portée à quinze
   tirages : **20 % de bonnes contre 62 % au prompt du produit tel qu'il est**. Il ne
   reste rien à essayer du côté de la demande — **c'est le résultat qui ferme le sujet**,
   et il vaut ses soixante-et-onze centimes.

---

## Le verdict — les modèles, à demande identique

Un seul geste rejoué quarante-six fois : **le prompt du produit et ses trois images sont
relus dans une vraie génération**, jamais recomposés. Chaque modèle a reçu exactement la
même chose.

*« Gardable » veut dire bonne ou moyenne — ce qu'on garderait, quitte à le retoucher.*

| Modèle | Essais | Revenues | Bonnes | Moyennes | Mauvaises | **% bonnes** | % gardables | Total payé | **$ / bonne** |
|---|---|---|---|---|---|---|---|---|---|
| **openai/gpt-image-2** | 8 | 8 | **5** | 2 | 1 | **62 %** | 88 % | $0,237 | **$0,047** |
| google/gemini-3-pro-image | 8 | 8 | 1 | **6** | 1 | 12 % | 88 % | $1,111 | $1,111 |
| google/gemini-3.1-flash-image | 8 | 8 | 0 | 1 | 6 | 0 % | 12 % | $0,553 | — |
| qwen/qwen-image-3-pro | 8 | **3** | 0 | 1 | 2 | 0 % | 12 % | $0,147 | — |
| bytedance-seed/seedream-4.5 | 8 | 8 | 0 | 0 | **8** | 0 % | 0 % | $0,320 | — |
| black-forest-labs/flux.2-pro | 2 | 2 | 0 | 0 | 2 | 0 % | 0 % | $0,150 | — |
| bytedance-seed/seedream-5-0-pro | 2 | 2 | 0 | 0 | 2 | 0 % | 0 % | $0,192 | — |
| x-ai/grok-imagine-image-quality | 2 | 2 | 0 | 0 | 2 | 0 % | 0 % | $0,160 | — |

> ⚠️ **Les huit lignes de `gpt-image-2` ont été relues, et cinq ont changé de note.** Elles
> étaient le témoin du troisième banc, montrées à côté des planches neuves ; l'auteur les a
> renotées en les revoyant. Trois *moyen* sont devenues *bon*, deux *mauvais* sont devenues
> *moyen* — **toutes vers le haut, sans qu'une seule image change**. Le taux du modèle en
> place passe de 25 % à 62 %. C'est la limite du juge unique, mesurée au lieu d'être
> redoutée — elle est reprise plus bas, § *Les limites de ces bancs*.
> **Les comparaisons entre une passe et l'autre sont donc à éviter** ; celles qui suivent se
> font toutes à l'intérieur d'une même passe.

*« Revenues » n'est pas « essais » : cinq des huit appels à `qwen` n'ont jamais abouti, après
trois cents secondes d'attente chacun. Ils comptent comme des essais — ils ont coûté du temps
— mais on ne peut rien leur reprocher d'autre. Les quatre derniers modèles n'ont eu que deux
tirages : écartés à la première manche.*

**Deux modèles se tiennent, et ils ne répondent pas à la même question :**

- **`gpt-image-2` est le seul qui signe des planches vraiment bonnes à un prix raisonnable** —
  moins de cinq centimes la bonne, contre $1,11. C'est le choix quand on commande plusieurs
  planches et qu'on garde la meilleure, c'est-à-dire le geste que la V3 va installer ;
- **`gemini-3-pro-image` est le plus régulier** : sept planches gardables sur huit, une seule
  mauvaise. C'est le choix du jour où l'on ne voudra pas trier — mais il n'en signe **qu'une
  vraiment bonne**, et elle lui revient à un dollar onze.

**`seedream-4.5` mérite une phrase**, parce que la note précédente en disait le contraire :
mon juge automatique le classait deuxième, et sa planche `jet2` était présentée comme le plus
beau cycle du banc. **L'auteur a noté ses huit planches mauvaises.** C'est le cas d'école du
biais décrit plus haut : ce modèle dessine une barre de sol sous chaque sprite, et cette barre
faisait varier la forme sans qu'aucun corps ne bouge.

---

## Le verdict — la nature de la consigne

Les deux bancs confondus, regroupés non plus par modèle mais par **la sorte de consigne
envoyée**. C'est le tableau qui répond à la question de départ : est-ce le modèle, ou la
façon de demander ?

**Seul `gpt-image-2` y figure** — il est le seul modèle présent des deux côtés, et comparer
des consignes envoyées à des modèles différents mesurerait l'écart entre les modèles.

| Nature de la consigne envoyée | Tirages | Découpables | Bonnes | **% bonnes** | % gardables | **$ / bonne** |
|---|---|---|---|---|---|---|
| **le prompt complet du produit** | 50 | **50** | **10** | **20 %** | 56 % | **$0,170** |
| consigne d'essai, poses détaillées case par case | 33 | **6** | 3 | 9 % | 48 % | $0,356 |
| consigne réécrite de fond, mouvement décrit en général | 20 | **0** | **0** | **0 %** | 15 % | — |

**Le prompt du produit gagne sur les deux tableaux à la fois** — deux fois plus de bonnes
planches que ma consigne d'essai plus détaillée, et deux fois moins cher par bonne. Il n'y a
rien à réécrire, et c'est la meilleure nouvelle de ces bancs : le chantier le plus coûteux
qu'on aurait pu ouvrir n'a pas lieu d'être.

*Sa ligne a baissé de 27 % à 20 % en passant de vingt-six à cinquante tirages, et c'est le
troisième banc qui l'a fait : ses vingt-quatre planches emploient toutes le bloc du produit,
et **aucune n'est bonne**. Ce n'est donc pas le prompt qui s'est dégradé, ce sont deux
mauvaises façons de s'en servir qui viennent s'ajouter à son compte.*

**Ma consigne d'essai perd deux fois.** Elle produit moins de bonnes marches, *et* elle en
perd cinq sixièmes au découpage — parce qu'elle avait laissé tomber le paragraphe du produit
qui interdit de redessiner le quadrillage. La deuxième perte se répare ; la première, non.

**Les cinq réécritures de fond sont un échec net et propre** : cycle continu, vocabulaire
d'animateur, description par différence, phrase unique, interdiction explicite des poses
figées. Zéro bonne planche sur vingt, zéro planche découpable. **Décrire *un mouvement* ne
marche pas ; énumérer *chaque instant* marche.** Le produit écrit déjà l'énumération.

---

## Le verdict — les réglages qui ressortent

Trente-et-un réglages, deux tirages chacun au départ, jusqu'à quinze pour ceux qu'il a
fallu départager. Voici ceux qui obtiennent au moins une bonne planche, plus les deux du
troisième banc, qui décidaient. **Le classement complet est dans le rapport HTML.**

| Réglage | Ce qui était testé | Tirages | Découp. | Bonnes | Moy. | Mauv. | **$ / bonne** |
|---|---|---|---|---|---|---|---|
| **D-4-guide** | 4 cases **+** guide de marche joint | 2 | **0** | **2** | 0 | 0 | **$0,034** |
| E-3-2 | image en 3:2 au lieu du carré | 2 | 1 | 1 | 0 | 1 | $0,061 |
| G-livrable-guide | prompt complet, clause remplacée, **plus** le guide | 8 | 8 | **2** | 4 | 2 | $0,172 |
| **F-sans-proportions** | prompt complet, **clause de constance remplacée** | **15** | **15** | **3** | 9 | 3 | $0,161 |
| **H-4-sans-proportions** | **4 cases**, prompt complet, clause remplacée | **8** | **8** | **0** | 1 | 7 | — |
| **H-4-produit** | **4 cases**, prompt complet, clause telle quelle | **8** | **8** | **0** | 0 | **8** | — |

> ⚠️ **Le seul réglage à quatre cases qui ait donné de bonnes planches donne des planches
> que le produit ne sait pas ouvrir.** `D-4-guide` a deux bonnes sur deux — et **zéro
> découpable** : il utilisait ma consigne d'essai, celle sans le paragraphe protecteur. Les
> deux réglages `H`, qui refont l'essai proprement avec le bloc du produit, sont
> **découpables seize fois sur seize et bons zéro fois sur seize**. On ne sait donc toujours
> pas ce qui rendait les deux planches de `D-4-guide` bonnes — mais on sait que **ce n'était
> pas le nombre de cases**, et qu'aucune recette livrable n'en sort.

**Les quatorze bonnes planches des trois bancs**, puisqu'elles tiennent en un tableau :

| Modèle | Réglage | Cases | Découpable |
|---|---|---|---|
| openai/gpt-image-2 | `@produit` (jet1, 2, 3, 6, 8) | 8 | oui |
| openai/gpt-image-2 | `F-sans-proportions` (jet4, jet5, jet6) | 8 | oui |
| openai/gpt-image-2 | `G-livrable-guide` (jet1, jet7) | 8 | oui |
| openai/gpt-image-2 | `E-3-2` (jet1) | 8 | oui |
| openai/gpt-image-2 | **`D-4-guide` (jet1, jet2)** | **4** | **non** |
| google/gemini-3-pro-image | `@produit` (jet6) | 8 | oui |

**Treize sur quatorze viennent de `gpt-image-2`.** Le modèle en place n'est pas le facteur
limitant. **Et douze des quatorze viennent d'une planche à huit cases avec le bloc du
produit** — c'est-à-dire de ce que le produit envoie déjà.

---

## La loterie, chiffrée pour de bon

C'est le chiffre qui décide de la forme du produit, et il est plus dur que celui que
j'annonçais :

- **14 planches bonnes sur 135 notées** — une sur dix ;
- **12 d'entre elles sont aussi découpables** — c'est-à-dire livrables de bout en bout ;
- 56 planches sont gardables (bonnes ou moyennes), dont 40 découpables.

Sur `gpt-image-2` seul, une bonne planche revient à **cinq à dix-sept centimes** selon le
réglage, une fois les ratés payés par les réussites. **Ce n'est pas un échec, c'est un prix** — et il reste
dérisoire à l'échelle d'un projet. Mais il interdit un certain produit et en impose un autre.

**Le produit ne peut pas être bâti sur *« on commande une planche, on la corrige »*.** Il
doit être bâti sur **« on commande plusieurs planches, on les regarde bouger, on garde la
bonne »** :

1. commander **plusieurs planches d'un coup** pour la même bande — pas une, puis une autre ;
2. les voir **animées côte à côte**, tout de suite, sans avoir à découper à la main d'abord ;
3. **en garder une**, jeter les autres — ou prendre une étape ici, une étape là.

`essais/rapport-animation.html` **est** cette maquette, sans l'avoir cherché : c'est l'écran
qu'il faudrait, boutons de notation compris, et c'est en s'en servant qu'on a découvert que
la mesure automatique était fausse. **Un écran qui ne montre que des chiffres aurait laissé
passer l'erreur.** C'est un argument de conception, pas seulement une anecdote.

---

## Les deux dernières pistes, payées et mortes

*Le troisième banc n'avait qu'un travail : trancher celles-ci. Il l'a fait, et dans les deux
cas par la négative. Les deux réglages partaient du **bloc complet du produit**, paragraphe
protecteur compris — c'est ce qui manquait aux essais précédents à quatre cases, et ça se
voit : **les seize planches sont découpables**, contre zéro sur six auparavant.*

### Moins de cases sur la planche — réfuté

Huit cases sur une image de mille pixels, c'est un personnage de trois cents pixels de côté.
À quatre cases il est deux fois plus grand, et il a la place de se déformer. L'idée était
bonne ; la mesure dit non.

| | tirages | bonnes | gardables | découpables |
|---|---|---|---|---|
| **4 cases, bloc du produit, clause telle quelle** | 8 | **0** | 0 | **8** |
| **4 cases, bloc du produit, clause remplacée** | 8 | **0** | 1 (12 %) | **8** |
| 4 cases, toutes vagues confondues | 22 | 2 (9 %) | 5 (23 %) | 16 |
| 8 cases, toutes vagues confondues | 109 | 12 (11 %) | 49 (45 %) | 70 |

**Seize tirages, zéro bonne planche.** Le personnage est bien deux fois plus grand, il est
bien découpable, et il ne marche pas mieux — il marche moins bien. Huit tirages par branche
était le seuil que ce banc s'était fixé pour conclure ; il est atteint deux fois.

**Les deux planches parfaites de `D-4-guide` restent inexpliquées, et ce n'est plus une
piste.** Elles employaient ma consigne d'essai *plus* le guide de marche, et elles ne sont
pas découpables. Ce que le troisième banc établit, c'est que **ce n'était pas le nombre de
cases** — sinon les seize d'ici en auraient montré quelque chose. Deux tirages contre seize :
le banc a déjà démontré trois fois ce que valent deux tirages.

### La clause de constance — refermée

Le prompt du produit demande, mot pour mot, `same proportions, same size` — c'est-à-dire que
le corps ne doit pas changer de forme, dans une demande de marche. La remplacer par une
phrase qui autorise la déformation semblait évident, et l'hypothèse a été enterrée puis
rouverte une fois déjà.

**Le chiffre qui la referme ne dépend d'aucune relecture** : la recette clause-remplacée
avait donné **3 bonnes sur ses 7 premiers tirages**. Les **8 tirages suivants, identiques,
en ont donné 0** — sept moyennes et une mauvaise.

| `F-sans-proportions` | tirages | bonnes | gardables |
|---|---|---|---|
| les 7 premiers | 7 | **3 (43 %)** | 5 (71 %) |
| les 8 suivants | 8 | **0** | 7 (88 %) |
| **l'ensemble** | **15** | **3 (20 %)** | 12 (80 %) |

C'est le même effondrement que la première fois, et pour la même raison : **trois tirages,
puis sept, ne savent pas voir un hasard**. À quinze tirages, la recette clause-remplacée fait
20 % de bonnes ; le prompt du produit tel qu'il est en fait davantage, quelle que soit la
façon de compter. **La phrase reste.**

> ⚠️ **Une comparaison directe des deux clauses serait aujourd'hui malhonnête**, et c'est à
> dire plutôt qu'à cacher. Le lot « clause présente » contient les huit planches du témoin,
> et **cinq d'entre elles ont été renotées vers le haut** en seconde passe (§ *Le verdict —
> les modèles*). Le rapport passe de 2 bonnes sur 11 à 5 sur 11 **sans qu'une image change**.
> Selon la passe qu'on retient, la clause remplacée est un peu meilleure ou nettement pire.
> **C'est pourquoi la conclusion s'appuie sur les huit tirages neufs seuls** : eux n'ont été
> notés qu'une fois, et ils donnent zéro.

### Ce qui, en revanche, est mort

**Le guide de marche dessiné par le programme ne fait rien.** `essais/guide_marche.py`
dessine un cycle complet avec la géométrie juste — le pied qui recule au sol pendant l'appui,
le bassin qui monte et descend deux fois par cycle, le genou calculé par deux segments, les
bras à l'opposé des jambes. Il ne coûte rien à fabriquer. À huit cases, joint au prompt
complet : **2 bonnes sur 8 avec lui, 3 sur 7 sans lui.** Rien.

*On a cru un moment qu'il redevenait intéressant à quatre cases, `D-4-guide` étant le seul
réglage à quatre cases à signer des bonnes. Le troisième banc a démêlé les deux : à quatre
cases **sans** le guide, seize tirages ne donnent rien. Ce qui restait du guide tenait donc
au guide, ou au hasard de deux tirages — et il n'a jamais rien donné à huit.*

---

## Ce qui reste vrai, et ne dépend pas de la mesure

### 1 · Le paragraphe protecteur du produit est décisif

Le prompt du produit interdit explicitement de redessiner les traits du quadrillage : *« Do
NOT draw the cell outlines in your image »*. À modèle constant :

- **avec le paragraphe : 0 planche sur 50** a le quadrillage redessiné ;
- **sans lui : 47 sur 53.**

**Il ne faut pas y toucher**, et il faut le porter partout où l'on enverra un gabarit.

### 2 · Une planche au quadrillage redessiné passe le contrôle du compte — c'est un défaut

Quand ça arrive quand même, **le produit ne le voit pas.** Huit cases bordées font huit
taches opaques : le compte tombe juste, l'atelier accepte, et il en tire **huit carrés
pleins**. Vérifié en passant une de ces planches dans la vraie chaîne : après détourage,
64 % de chaque vignette reste opaque, contre 34 % pour une planche saine.

**Ce qu'il faut ajouter : un contrôle de remplissage.** Une « silhouette » qui occupe plus de
neuf dixièmes de sa boîte n'est pas un sujet, c'est une case. Sans ce contrôle, le produit
garde du vide payé en silence — ce qui est pire que refuser.

### 3 · Les étapes d'une bande se recadrent ensemble, jamais chacune de son côté

Mesuré sur la chaîne complète : les huit images livrées par l'atelier faisaient **toutes
exactement 64 pixels de haut, ligne de sol au même pixel**. Écart : zéro.

Ce n'est pas le modèle — c'est le recadrage du produit, qui prend **chaque étape sur sa
propre boîte** puis la ramène à la taille de pixel du projet. **Le balancement, s'il existe,
est détruit avant que le moindre recalage puisse intervenir.** Une bande est un tout ; elle
se recadre sur une **boîte commune**.

*Le montage des animations du rapport a rencontré exactement ce piège et a dû l'éviter :
recaler chaque case sur son propre sujet écrase le mouvement. `essais/decoupe_brute.py`
recale par rangée et par colonne, jamais case par case — c'est la démonstration en petit de
ce que le produit doit faire.*

---

## Ce qui a été payé pour trancher, et ce que ça a répondu

**Trois branches, huit tirages chacune — vingt-quatre tirages, $0,71, le 2 septembre 2026.**
Huit tirages par branche était le seuil que ce banc s'était fixé après s'être trompé deux
fois sur trois. Toutes les trois partaient du **prompt complet du produit, paragraphe
protecteur compris**, ce qui manquait aux essais précédents à quatre cases.

| Branche | Ce qu'elle isolait | Tirages | Découp. | Bonnes | Verdict |
|---|---|---|---|---|---|
| 4 cases, clause telle quelle | le nombre de cases, seul | 8 | **8** | **0** | **mort** |
| 4 cases, clause remplacée | les deux pistes croisées | 8 | **8** | **0** | **mort** |
| 8 cases, clause remplacée | la clause, portée à 15 tirages | 8 | **8** | **0** | **mort** |

Ce qui était annoncé, mot pour mot : *« si l'une dépasse franchement le prompt du produit tel
qu'il est, c'est elle la nouvelle recette ; si aucune n'y arrive, on sait que la demande est
épuisée comme levier, et le mannequin articulé redevient le seul chemin. »*

**Aucune n'y est arrivée. Zéro bonne planche sur vingt-quatre.** C'est la seconde réponse, et
elle est nette :

- **le produit garde son prompt tel quel** — il n'y a rien à changer dans
  `atelier/services/pliage.py`, et c'est autant de travail qui n'a pas lieu d'être ;
- **la façon de demander est épuisée comme levier.** Trente-et-un réglages, cent trente-cinq
  planches, trois bancs : le nombre de cases, six formulations, ce qu'on joint, le format de
  l'image, la clause de constance. Rien ne fait mieux que ce qui part déjà ;
- **le mannequin articulé redevient le seul chemin** vers une animation qu'on ne tire pas à
  la loterie — voir plus bas ce que ces bancs lui font, et les deux variantes que l'auteur a
  posées depuis.

**Ce qu'il ne faut pas repayer :** les réécritures de fond, le guide de marche, les planches
à quatre et six cases, la clause de constance, et tout ce qui retire le paragraphe
protecteur. Essayé, mesuré, sans effet ou nuisible. **Une demande de plus au même modèle ne
donnera rien** : ce n'est plus une opinion, c'est six dollars de mesures.

---

## Les limites de ces bancs, à dire avant qu'on s'appuie dessus

**Les petits nombres, et ces bancs en sont la démonstration trois fois.** Deux tirages d'une
même demande ont reçu *bon* et *mauvais*. Une hypothèse acquise sur trois tirages s'est
effondrée sur onze, puis est revenue sur les notes, puis est morte sur quinze. La recette
clause-remplacée a fait **3 bonnes sur ses 7 premiers tirages et 0 sur les 8 suivants**, à
demande rigoureusement identique. **Rien ne doit être décidé sur moins de huit tirages par
branche** — et c'est en s'y tenant que le troisième banc a pu conclure.

**Un seul juge, et c'est une personne — et on sait maintenant ce que ça coûte.** Les notes
sont celles de l'auteur, sur des animations montées brutes. C'est le bon juge, c'est lui qui
utilisera le produit. Mais **le troisième banc a fait relire huit planches déjà notées**, en
les montrant comme témoin à côté des neuves, et **cinq ont changé de note — toutes vers le
haut**. Trois *moyen* devenues *bon*, deux *mauvais* devenues *moyen* ; le taux du modèle en
place passe de 25 % à 62 % sans qu'une image change.

Ce n'est pas *« des notes un peu différentes »*, c'est un facteur deux sur le chiffre qui sert
de barre à tout le reste. **Deux règles en sortent, et elles valent pour la suite** : ne
jamais comparer un groupe noté dans une passe à un groupe noté dans une autre ; et faire
figurer un témoin dans chaque séance de notation, ce que le troisième banc a fait — c'est
justement ce qui a permis de voir le décalage au lieu de le subir.

*C'est aussi le seul endroit de ce dossier où une relecture par un modèle aurait quelque chose à faire — et le jeu d'épreuve qui la trancherait est ce fichier de notes lui-même, déjà payé. La piste, son protocole et son seuil de prix sont dans `docs/archive/essais-v3/etude-gameforge.md` § 2. **Rien n'y est mesuré non plus.***

**Un seul sujet a été essayé** — un personnage encapuchonné portant une lanterne, vu de
côté. Rien ne dit qu'une torche qui brûle ou une pièce qui tourne se comportent pareil, et il
est très possible qu'un objet simple réussisse là où un personnage échoue.

**Les animations jugées sont montées sans détourage.** C'était nécessaire — le détourage
grignote un pied, laisse des miettes, coupe une barre de sol, et on finissait par juger le
détourage au lieu de la marche. Mais ça veut dire que **l'auteur a noté ce que le modèle a
dessiné, pas ce que le produit livrerait.** Une planche notée bonne peut encore mal se
détourer. C'est pourquoi la colonne « découpable » reste dans tous les tableaux.

---

## Ce que ça fait au mannequin articulé

`docs/archive/essais-v3/etude-mannequin.md` le rangeait en V3 comme *la seule méthode praticable au bout du
chemin*. **Le guide de marche en était une version à deux dimensions et à zéro euro, et il
n'a rien donné à huit cases.**

Ce n'est pas une réfutation — le guide est une image de plus dans une demande, là où le
mannequin impose la géométrie au lieu de la suggérer. Mais c'est un signal : **le modèle ne
suit pas une pose qu'on lui montre**, du moins pas comme ça, et pas quand le personnage ne
fait que trois cents pixels.

L'argument du mannequin — *personne ne sait à l'avance quelle planche va marcher, donc il
faut imposer la géométrie au lieu de l'espérer* — **sort du troisième banc en position de
seul chemin restant**. Une bonne planche sur dix, trente-et-une façons de le demander
autrement, et les trois dernières payées exprès pour lui laisser une chance de ne pas être
nécessaire : aucune n'a donné une seule bonne planche. Il reste cher, mais **plus rien ne
passe avant lui.**

**Et il existe une troisième façon d'imposer la géométrie, notée le même jour** : passer le
sprite en trois dimensions, l'auto-riguer, l'animer, puis le rendre en planche. La taille du
personnage ne peut alors plus varier d'une case à l'autre, puisque c'est le même objet —
c'est-à-dire que le défaut dominant de ces bancs disparaît par construction. Elle est plus
chère que le mannequin et son rendu en pixels n'est prouvé nulle part. La note est dans
`docs/releve-fournisseurs.md` § *Hors relevé · Meshy*.

**Et une quatrième, en deux dimensions, relevée le lendemain** — le pantin découpé, section suivante. Même argument que Meshy — c'est le même objet qui bouge, donc la taille ne peut plus dériver —, mais sans trois dimensions, sans compte et sans dépense par personnage.

**Et une cinquième, relevée le même jour** — **reporter un mouvement filmé** sur le sprite,
au lieu de le décrire ou de le dessiner. C'est ce que le concurrent Ludo.ai vend, et c'est la
seule des cinq qui ne demande ni pièces découpées, ni squelette, ni trois dimensions.
Dernière section de cette note.

---

## Une quatrième façon d'imposer la géométrie : le pantin en deux dimensions

> Ajouté le 2 septembre 2026, à la demande de l'auteur, après lecture de
> `github.com/MangoLion/stretchystudio`. **Rien ici n'est mesuré** : aucune planche n'a été
> produite par ce chemin, ni par nous ni ailleurs à notre connaissance. C'est une piste, au
> même titre que le mannequin et Meshy, et elle se juge aux mêmes essais payés.

**Ce que c'est.** Stretchy Studio est un outil libre — licence MIT, 466 étoiles, dernier
commit du 28 avril 2026 — écrit en Vue et WebGL, **qui tourne entièrement dans le
navigateur**. On lui donne un dessin **déjà découpé en couches** (tête, buste, bras,
avant-bras, cuisse, jambe…), il en fait un pantin déformable : un squelette posé
**automatiquement** par détection de pose, un pliage des membres par déformation du maillage
plutôt que par rotation de calques, des expressions mélangeables, une ligne de temps, et une
sortie **Spine 4.0 JSON** — le format que Godot et Unity savent lire.

**Pourquoi ça vise exactement le défaut dominant du banc.** Le pantin **ne redessine
rien** : les pixels de chaque case sont ceux du sprite d'origine, déplacés. Le personnage ne
peut donc pas changer de taille d'une case à l'autre — c'est le même objet, argument mot pour
mot identique à celui de Meshy (`docs/releve-fournisseurs.md` § *Hors relevé · Meshy*), **mais
sans passer par la trois dimensions, sans compte à ouvrir et sans un centime par
personnage**. Et il tourne hors réseau, ce que l'atelier exige.

### La chaîne proposée par l'auteur, étape par étape

L'idée posée est : *notre outil génère, détoure et découpe en morceaux ; le leur anime.*
Voici ce qu'elle demande, et ce que le dépôt sait déjà faire.

| # | L'étape | Où elle en est |
|---|---|---|
| 1 | générer le personnage | **existe** — c'est le produit |
| 2 | obtenir ses **pièces séparées** (bras, jambe, tête…) | **inconnue n° 1**, voir plus bas |
| 3 | détourer, découper, mesurer, nommer chaque pièce | **existe** — les trois moteurs de détourage, `services/decoupe.py`, le calque et sa différence (`domaine/equipement.py`, `image/calque.py`) |
| 4 | poser le squelette sur les pièces | **automatique** chez eux, rien à écrire |
| 5 | animer | **automatique après une fois**, voir la réponse ci-dessous |
| 6 | rendre la planche et la remettre sur grille | **à construire** — mais la remise sur grille est obligatoire de toute façon (`docs/archi-fournisseur.md` § 4 bis) |

**La moitié de la chaîne est déjà dans le dépôt**, et c'est la moitié fastidieuse. L'atelier
sait séparer une pièce d'un corps, la mesurer, la recadrer et la rejouer à l'identique ; c'est
tout l'objet de C2, C3 et C4.

### La question posée : est-ce que ça s'anime tout seul, ou toujours à la main ?

**Les deux, et c'est la bonne nouvelle : à la main *une fois*, automatique *ensuite*.** Le
geste se sépare en trois, et deux des trois sont automatiques.

1. **Le squelette : automatique.** Une détection de pose lit le dessin et place les os. Zéro
   geste de l'auteur. C'est leur `auto-rig`.
2. **Le mouvement : automatique dès la deuxième fois.** Une marche n'est pas un dessin, c'est
   **une suite d'angles d'os dans le temps**. Écrite une fois pour un squelette dont les os
   portent des noms convenus, elle se rejoue **sur n'importe quel personnage portant les mêmes
   noms** — c'est précisément ce que le format Spine sépare, le squelette d'un côté, les
   actions de l'autre. Une bibliothèque maison — repos, marche, course, saut, attaque — se paie
   **une fois en travail** et devient gratuite pour tous les personnages suivants. C'est
   exactement ce que Meshy facture sous le nom `animations`, sauf qu'ici elle nous appartient.
3. **Ce qui reste à la main : la vérification, et elle ne disparaîtra pas.** Quel bras passe
   devant l'autre, un pivot posé deux pixels trop haut, une pièce mal découpée qui se décolle
   en pliant. Plus, si on la veut, la personnalité du mouvement — un mouvement générique reste
   un mouvement générique.

**Et une propriété que ni le modèle d'image ni le mannequin ne peuvent offrir : le résultat
est rejouable.** Même personnage, même action, même planche — à l'octet. Ce qui veut dire que
pour les poses couvertes par le pantin, **la loterie n'existe plus**, et avec elle le geste
principal que cette note prescrit à la V3 : commander plusieurs planches et garder la bonne
n'a plus d'objet quand il n'y a plus de tirage.

### Les trois inconnues, et aucune ne coûte cher à lever

1. **La décomposition en pièces.** C'est la seule vraie pièce manquante. Eux la reçoivent
   d'un modèle spécialisé qui découpe une illustration en parties de corps **rebouchées par
   en dessous**. Deux voies chez nous : demander au modèle une **planche de pièces à plat** —
   même mécanisme que le gabarit, paragraphe protecteur compris, quelques centimes le
   tirage —, ou reprendre un modèle de décomposition. **Sans pièces propres, tout le reste
   tombe** : c'est par là qu'il faut commencer.
2. **Le rendu en pixel.** Un pantin déformé, rendu à soixante-quatre pixels de haut : un bras
   qui pivote rééchantillonne ses pixels, et ça bave. **C'est mot pour mot l'inconnue que la
   note Meshy pose** — *si le détour survit à la réduction*. Elle se lève **gratuitement** :
   un sprite, un bras plié, un rendu à la cible du projet, et on regarde.
3. **Le goût.** Un pantin articulé peut lire comme du papier découpé plutôt que comme une
   animation de jeu. Ça ne se mesure pas, ça se note à l'œil — comme les cent trente-cinq
   planches.

### Ce que ça change au classement des chemins de la V3

| Le chemin | Ce qui impose la géométrie | Dépense par personnage | Taille constante | Rendu pixel prouvé | Rejouable |
|---|---|---|---|---|---|
| mieux écrire la demande (le banc) | rien | $0,12 à $0,14 la bonne planche | **non** — le défaut dominant | oui | non |
| mannequin articulé | une posture qu'on **espère** suivie | idem, plus le temps de poser | non | oui | non |
| Meshy (3D, auto-rig) | l'objet en trois dimensions | payant, **non mesuré** | oui, par construction | **non** | oui |
| **pantin 2D (Stretchy Studio)** | **les pièces du dessin** | **zéro** | **oui, par construction** | **non** | **oui** |

**Le pantin 2D est le seul qui coche « aucune dépense » et « cohérence par construction » à la
fois.** Il hérite de l'inconnue de Meshy — le rendu en pixel — et en ajoute une qui lui est
propre — la découpe en pièces. **Les deux se lèvent sans payer un seul modèle**, ce qui n'est
vrai d'aucun autre chemin de ce tableau.

### Ce que le pantin ne remplacera pas

**Il ne fait bouger que ce qui est déjà dessiné.** Une marche de profil, oui. Un demi-tour,
une main qui se retourne, un visage qui change d'expression : non — il faudrait un pixel qui
n'existe nulle part. **Les huit directions du produit restent une affaire de génération** ; le
pantin sert les poses **d'une même vue**, pas la matrice entière. C'est un complément au
codex, jamais son remplaçant.

### Trois questions laissées ouvertes

1. **Reprendre le code, ou seulement la méthode ?** La licence MIT autorise les deux. Leur
   application est en Vue, notre interface en Vite et TypeScript nu : soit on l'embarque comme
   module à part entière, soit on ne reprend que les trois gestes qui comptent — squelette
   automatique, pliage par maillage, écriture du Spine JSON.
2. **Le produit livre-t-il une planche, ou un pantin ?** La sortie Spine se lit directement
   dans Godot. Livrer le pantin plutôt que ses images serait un changement de nature du
   produit, et il appartient à `docs/PRD.md`, pas à cette note.
3. **Où vit un pantin ?** Une planche est un asset ; un squelette n'en est pas un, et une
   bibliothèque de mouvements appartient à l'atelier entier plutôt qu'à un projet. C'est la
   même question que celle laissée ouverte pour la posture (`docs/archive/essais-v3/etude-mannequin.md`, § 1).

---

## Une cinquième façon : reporter un mouvement filmé — ce que fait Ludo.ai

> Ajouté le 2 septembre 2026, à la demande de l'auteur, après lecture de
> `github.com/api-evangelist/ludo-ai`. **Ce dépôt ne contient aucun code** : c'est un profil
> d'interface tenu par un tiers, pas la documentation officielle du produit. **Rien ici n'est
> mesuré**, et le relevé complet — les réglages qu'ils exposent, ce qu'ils font mieux que
> nous, ce qu'il faudrait payer avant d'y croire — est dans
> **`docs/releve-fournisseurs.md` § *Hors relevé · Ludo.ai***. Cette section n'en garde que
> ce qui touche l'animation.

**Le premier fait, et il vaut d'être posé avant tout le reste : ils ne riguent pas.** Ludo.ai
vend des modèles 3D *et* de l'animation de sprites, et **les deux ne se touchent pas** — leur
animation 2D part d'une image et d'une phrase, exactement comme la nôtre. Ce n'est pas une
preuve qu'il n'existe rien de mieux : la section précédente en est le contre-exemple, libre et
gratuit. Mais ça dit qu'**un produit qui vend l'animation de sprites n'a pas trouvé moins cher
que la loterie** — donc que la bonne planche sur dix mesurée ici n'est pas notre maladresse.

**Le geste qui nous intéresse.** `POST /sprites/transfer-motion` prend le sprite **plus une
vidéo de référence de quatre secondes** — ou un mouvement choisi dans un catalogue, avec sa
perspective et sa direction — et reporte le mouvement de la source sur le sujet. La géométrie
n'est ni décrite ni espérée : elle est **montrée en train de se faire**.

C'est la seule des cinq voies qui ne demande **ni pièces découpées, ni squelette, ni trois
dimensions**. C'est aussi la plus faible : rien n'y garantit la constance de taille, puisque
c'est encore un modèle qui redessine. **Elle ne remplace pas le pantin ; elle se teste avant,
parce qu'elle ne coûte presque rien.**

> ⚠️ **Ne pas la confondre avec `essais/guide_marche.py`, qui est mort.** Le guide était une
> **image fixe** jointe à la demande, et il n'a rien donné à huit cases — 2 bonnes sur 8 avec
> lui, 3 sur 7 sans. Une **source qui bouge** n'est pas la même entrée, et elle n'a jamais été
> essayée ici. **Piste ouverte, pas piste réhabilitée.**

**Les deux idées de forme qu'on peut prendre sans rien payer**, et qui ne dépendent d'aucun
fournisseur :

1. **Le mouvement devient un objet nommé, pas une phrase à retaper.** Leur catalogue rend
   chaque mouvement avec sa durée, ses perspectives et **les huit mêmes directions que le
   produit** (`atelier/domaine/vue.py`). Chez nous la même marche se redemande en mots à
   chaque personnage, et rien ne garantit que la phrase d'hier donnera le geste d'aujourd'hui.
   **C'est vrai quel que soit le chemin retenu** — le pantin de la section précédente a
   exactement le même besoin, et l'appelle « bibliothèque de mouvements ».
2. **La planche se rend avant *et* après le détourage.** Leur `spritesheet_with_background`
   renvoie les deux. C'est la manœuvre que ce banc a dû improviser pour pouvoir juger — *les
   animations notées sont montées sans détourage* — et c'est le même constat : **juger le
   mouvement et juger le découpage sont deux métiers.**

**Ce que ça ne change pas.** Aucune ligne du tableau de la section précédente ne bouge : cette
voie n'a pas été mesurée, et une interface bien dessinée n'est pas un taux de réussite. **Rien
ne dit qu'ils font mieux qu'une bonne planche sur dix** — ils le cachent simplement derrière
des crédits. En revanche **ce qui passait avant elle n'existe plus** : les trois branches à
soixante-et-onze centimes ont été tirées, notées, et n'ont rien donné. Le terrain est libre
pour les chemins qui imposent la géométrie, celui-ci compris.
