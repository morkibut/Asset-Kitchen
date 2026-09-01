# V3 — l'animation : ce que les bancs ont mesuré, et ce qu'il faut en retenir

> **Cette note ne décide rien à elle seule** — `docs/PRD.md` dit ce que le produit doit
> faire, `docs/PLAN.md` dans quel ordre. Elle porte **les résultats de deux bancs payés** et
> les conséquences qui en découlent, pour qu'on n'ouvre pas la V3 sur des suppositions.
>
> Écrite le 1<sup>er</sup> septembre 2026. **117 planches, $5,32 dépensés** en tout :
> un premier banc qui compare **huit modèles à demande identique**, un second qui compare
> **vingt-neuf demandes au même modèle**.
>
> Le mode d'emploi de la séance est dans `docs/essai-animation.md`. Le détail chiffré et
> **le rendu visuel — chaque animation qui tourne à côté de son prix** — sont dans
> **`essais/rapport-animation.html`** — un seul fichier, les cent dix-sept planches, chacune
> animée à côté du modèle qui l'a faite, de ce qui était testé, de la consigne envoyée, des
> images jointes et du prix. Les deux rapports d'origine
> (`essais/resultats_animation/rapport.html`, `essais/resultats_recette/rapport.html`)
> restent, mais ils datent d'avant la correction de mesure : **c'est le rapport unique qui
> fait foi.**

---

## Ce que ces bancs ont établi, en trois phrases

1. **Le choix du modèle est réglé, et ce n'est pas lui le problème.** `gpt-image-2`, celui
   que le produit utilise déjà, reste le moins cher par planche qui marche. Un seul autre
   mérite d'être gardé en tête : `gemini-3-pro-image`, qui réussit deux fois plus souvent
   pour deux fois et demie le prix.
2. **Aucun réglage isolé de la demande ne fait franchement mieux que ce que le produit
   envoie aujourd'hui.** Deux hypothèses prometteuses ont été payées et sont mortes à
   l'usage. C'est un résultat, et il évite un chantier.
3. **Le prompt du produit reste le meilleur de bout en bout**, et c'est le résultat le plus
   utile : il n'y a rien à changer en urgence. La seule piste qui survit à la mesure est
   celle qu'on n'a pas essayée — **détailler davantage chaque case, en gardant le paragraphe
   protecteur du produit** — et elle coûte une dizaine de tirages.

---

## ⚠️ Deux hypothèses payées, et mortes — c'est le cœur de ce que ce banc apprend

Elles sont écrites ici, en tête, parce qu'un essai raté qu'on ne consigne pas se refait.

### La clause de constance n'était pas la cause

Le prompt du produit demande, mot pour mot, `same proportions, same size` — c'est-à-dire que
le corps ne doit pas changer de forme, dans une demande de marche. Ça paraissait être la
cause de tout, et **sur trois tirages ça semblait spectaculaire** : 2 planches animées sur 3
contre 2 sur 8.

Huit tirages de plus l'ont tuée :

| | tirages | planches qui bougent | déformation médiane |
|---|---|---|---|
| le prompt du produit, tel quel | 8 | 2 | 5,0 % |
| le même, clause remplacée | 7 | 2 | 3,4 % |
| le même, clause remplacée **et** guide de marche joint | 8 | 3 | 5,2 % |

**Les trois ne se distinguent pas.** L'écart de départ était du hasard, et trois tirages ne
savent pas le voir. La phrase peut rester.

### Le guide de marche dessiné par le programme n'a rien changé non plus

`essais/guide_marche.py` dessine un cycle de marche complet, une case par étape, avec la
géométrie juste : le pied qui recule au sol pendant l'appui puis repart en avant, le bassin
qui monte et descend deux fois par cycle, le genou calculé par deux segments, les bras à
l'opposé des jambes. **Il ne coûte rien à fabriquer**, et c'était le mannequin articulé de
`docs/etude-mannequin.md` en deux dimensions et pour zéro euro.

Joint au prompt complet du produit, il donne **3 planches animées sur 8** — contre 2 sur 8
sans lui. **Rien.**

*Il donne de très belles marches — les plus belles du banc — quand on le joint à ma consigne
d'essai. Mais ces planches-là ne sont pas découpables, pour la raison décrite plus bas, donc
ce résultat ne prouve pas ce qu'il a l'air de prouver.*

---

## Ce que « bouger » veut dire ici, et pourquoi c'est mesurable

**La mesure qui décide s'appelle la forme** : de combien le rapport hauteur/largeur du
personnage change d'une case à l'autre. Elle sépare les deux causes d'une case différente
d'une autre, qui sont opposées :

- **une dérive d'échelle** — le modèle a dessiné le même sprite en plus petit. Hauteur et
  largeur bougent ensemble, la forme reste. **Ça se rattrape sans un centime** : c'est du
  recalage, et le produit sait déjà trouver une échelle et un décalage entre deux images.
- **un balancement** — le corps se tasse et se détend. La forme change. **Ça ne se fabrique
  jamais après coup** : si ce n'est pas dans l'image payée, ça n'existera pas.

Une planche est comptée **animée** quand la forme y varie d'au moins 8 %. Le seuil est écrit
en clair dans `essais/juger_recette.py` pour qu'on puisse le contester.

---

## Banc 1 — les modèles, à demande identique

Un seul geste rejoué quarante-six fois : **le prompt du produit et ses trois images sont
relus dans une vraie génération**, jamais recomposés. Chaque modèle a reçu exactement la
même chose.

> ⚠️ **Ce tableau a changé après coup, et il faut savoir pourquoi.** Le premier jugement de
> ce banc comptait la **barre de sol** que certains modèles dessinent sous le sprite comme
> faisant partie du personnage : la boîte prenait la largeur de la barre, tous les sujets se
> retrouvaient avec la même forme, et le banc concluait *« ce personnage ne bouge pas »* sur
> des planches où il marche parfaitement. `seedream-4.5` était noté **zéro** ; sa planche
> `jet2` est en réalité **le cycle de marche le plus net de tout l'essai**. Les cent
> dix-sept planches des deux bancs sont désormais repassées par **un seul juge**
> (`essais/banc_complet.py`), et c'est ce tableau-ci qui fait foi.

**Le tarif affiché ment.** Un modèle bon marché qui rate trois fois sur quatre coûte quatre
fois son tarif. Ce qui compte est le **coût par planche utilisable** : tout ce qu'on a payé
chez lui, divisé par ses planches qui marchent — les ratés payés par les réussites.

| Modèle | Essais | Revenues | Découp. | Utilisables | **Rendement** | Total payé | **$ / utile** | Sec. / utile |
|---|---|---|---|---|---|---|---|---|
| **google/gemini-3-pro-image** | 8 | 8 | 8 | **4** | **50 %** | $1,111 | $0,278 | 58 |
| qwen/qwen-image-3-pro | 8 | **3** | 3 | 2 | 25 % | $0,147 | **$0,073** | 1 174 |
| **openai/gpt-image-2** | 8 | 8 | 8 | 2 | 25 % | $0,237 | **$0,118** | 96 |
| bytedance-seed/seedream-4.5 | 8 | 8 | 8 | 2 | 25 % | $0,320 | $0,160 | 142 |
| google/gemini-3.1-flash-image | 8 | 8 | 8 | 0 | 0 % | $0,553 | — | — |
| black-forest-labs/flux.2-pro | 2 | 2 | **0** | 0 | 0 % | $0,150 | — | — |
| bytedance-seed/seedream-5-0-pro | 2 | 2 | 2 | 0 | 0 % | $0,192 | — | — |
| x-ai/grok-imagine-image-quality | 2 | 2 | 2 | 0 | 0 % | $0,160 | — | — |

*« Revenues » n'est pas « essais » : cinq des huit appels à `qwen` n'ont jamais abouti, après
trois cents secondes d'attente chacun. Ils comptent comme des essais — ils ont coûté du temps
— mais on ne peut pas leur reprocher une découpe qu'ils n'ont pas eu l'occasion de rater. Les
quatre derniers modèles n'ont eu que deux tirages : écartés à la première manche, rien dans
ces deux-là ne justifiait d'en payer six de plus.*

**Deux modèles se tiennent, et ils ne répondent pas à la même question :**

- **`gemini-3-pro-image` réussit deux fois plus souvent** — une planche utilisable une fois
  sur deux, contre une sur quatre. C'est le choix quand on veut un résultat en peu d'essais ;
- **`gpt-image-2`, celui que le produit utilise déjà, reste le moins cher par planche qui
  marche** : douze centimes contre vingt-huit. C'est le choix quand on commande plusieurs
  planches et qu'on garde la bonne — c'est-à-dire le geste que la V3 va installer.

`qwen` affiche sept centimes, mais **cinq de ses huit appels ont échoué** et il lui faut vingt
minutes par planche utilisable. Ce n'est pas un candidat.

**Il n'y a donc rien à changer dans l'immédiat**, et c'est la bonne nouvelle : le modèle en
place est le meilleur rapport. `gemini-3-pro-image` mérite d'être gardé en tête comme second
choix, à essayer le jour où l'attente coûtera plus cher que les images.

---

## Banc 2 — les demandes, au même modèle

Vingt-neuf façons de demander la même marche à `gpt-image-2` : le nombre de cases, six
formulations de la consigne, et ce qu'on joint comme images. Deux tirages chacune au départ,
jusqu'à huit pour les trois qu'il a fallu départager.

### Le tableau qui décide, et pourquoi c'est celui-là

Tous les autres classements de ce banc sont trompeurs, pour une raison qu'il a fallu
découvrir en cours de route : **une bonne partie des planches n'est pas découpable** — le
modèle a redessiné les traits du quadrillage par-dessus, et le produit ne saurait pas les
ouvrir. Les compter dans un classement revient à comparer ce qu'on saurait livrer avec ce
qu'on ne saurait pas.

| Nature de la consigne envoyée | Tirages | Découp. | Qui bougent | Utilisables | **Rendement** | $ / utile | Forme médiane |
|---|---|---|---|---|---|---|---|
| **le prompt complet du produit** | 26 | 26 | 8 | 8 | **31 %** | **$0,123** | 4,5 % |
| consigne d'essai, poses détaillées case par case | 33 | **6** | 26 | 6 | 18 % | $0,178 | **17,0 %** |
| consigne réécrite de fond, mouvement décrit en général | 20 | **0** | 5 | 0 | **0 %** | — | 3,6 % |

*Seul `gpt-image-2` figure dans ce tableau : il est le seul modèle présent des deux côtés, et
comparer des consignes envoyées à des modèles différents mesurerait l'écart entre les
modèles, pas entre les consignes.*

Le **rendement** est le nombre de planches **à la fois découpables et animées**, divisé par
tout ce qu'on a payé. C'est le seul chiffre de bout en bout, et **il renverse le classement.**

Ma consigne d'essai anime bien mieux ce qu'elle sauve : **vingt-six de ses trente-trois
planches bougent**, contre huit sur vingt-six pour le produit, et sa forme médiane est
quatre fois plus haute. Mais **elle n'en sauve que six** — les autres ont le quadrillage
redessiné —, et le produit gagne : 31 % contre 18 %.

**Ses pertes viennent d'une seule chose, et elle se répare** : ma consigne avait laissé
tomber le paragraphe du produit qui interdit de redessiner le quadrillage. **Une consigne à
la fois détaillée et protégée n'a jamais été essayée.**

### Ce qui, dans cette consigne, pourrait faire la différence

Elle diffère du prompt du produit sur trois points à la fois, et **le banc ne dit pas
lequel** :

1. **elle détaille chaque case davantage** — *« pied droit en arrière »*, *« corps au plus
   bas »*, *« jambes jointes »*, là où le produit écrit seulement *« contact, pied gauche
   devant »* ;
2. **deux des six planches ne joignaient aucun gabarit** — et ce réglage-là est le seul du
   banc à avoir donné **deux fois sur deux** une planche à la fois animée et découpable ;
3. elle omet la clause de constance — mais on vient de voir que celle-là ne fait rien.

**Deux chemins s'ouvrent, et ils coûtent le même prix :**

- **garder le gabarit et son paragraphe protecteur, et détailler chaque case davantage.**
  C'est le changement le plus petit possible au produit : une ligne de plus par case dans
  `atelier/services/pliage.py` ;
- **ne plus envoyer de gabarit du tout** pour une bande d'animation. Ça **supprime par
  construction** le problème du quadrillage redessiné, qui a gâché quarante-sept planches de
  ce banc — le long paragraphe d'interdictions que le produit écrit aujourd'hui n'existe que
  parce qu'on envoie le gabarit. Et c'est le seul réglage du banc qui ait donné **deux fois
  sur deux** une planche à la fois animée et découpable.

---

## Les quatre conclusions à prendre en compte pour la V3

### 1 · L'énumération des poses, case par case, est ce qui porte la marche

**Aucune des cinq réécritures de fond n'a produit une seule planche animée — zéro sur dix, et
zéro planche découpable non plus.** Cycle continu, vocabulaire d'animateur, description par
différence, phrase unique, interdiction explicite des poses figées : toutes remplaçaient
l'énumération *« case 1 : contact, pied gauche devant ; case 2 : appui, corps au plus bas… »*
par une description générale du mouvement.

**Le produit écrit déjà l'énumération, et c'est elle qu'il faut garder.** Décrire *un
mouvement* ne marche pas ; décrire *chaque instant* marche. Ça épargne un chantier de
réécriture de prompt, et ça dit dans quelle direction chercher : **détailler plus**, pas
reformuler.

### 2 · Une planche au quadrillage redessiné passe le contrôle du compte, et c'est un défaut

Deux faits qui vont ensemble :

- **le paragraphe du produit qui l'interdit fonctionne** — *« Do NOT draw the cell outlines
  in your image »*. Avec lui : **0 planche sur 18** a le quadrillage redessiné. Sans lui :
  **47 sur 53**. Il ne faut pas y toucher ;
- mais quand ça arrive quand même, **le produit ne le voit pas.** Huit cases bordées font
  huit taches opaques : le compte tombe juste, l'atelier accepte, et il en tire **huit carrés
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
est détruit avant que le moindre recalage puisse intervenir.**

Une bande est un tout. Elle se recadre sur une **boîte commune**.

### 4 · Il faut assumer la loterie, et l'outiller

C'est la conclusion du premier banc, et **les vingt-neuf demandes du second n'ont pas réussi
à la faire tomber** : à deux ou trois planches animées sur huit, il faut en commander
plusieurs pour en garder une. Douze centimes la planche utilisable, ce n'est pas un échec :
c'est un prix, et il reste dérisoire.

**Mais ça décide du geste principal de la V3.** Le produit ne peut pas être bâti sur *« on
commande une planche, on la corrige »*. Il doit être bâti sur **« on commande plusieurs
planches, on les regarde bouger, on garde la bonne »** :

1. commander **plusieurs planches d'un coup** pour la même bande — pas une puis une autre ;
2. les voir **animées côte à côte**, tout de suite, sans découper à la main d'abord ;
3. **en garder une**, jeter les autres — ou prendre une étape ici, une étape là.

Les deux rapports HTML **sont** cette maquette, sans l'avoir cherché : c'est exactement
l'écran qu'il faudrait, et ils ont été utiles dès la première minute.

---

## Ce qu'il faudrait payer ensuite, et dans quel ordre

**Deux réglages, dix tirages chacun, environ soixante centimes en tout :**

1. la consigne **détaillée case par case, avec le paragraphe protecteur du produit** — donc
   sans rien perdre du côté découpe ;
2. la même consigne détaillée, **sans joindre de gabarit du tout**.

Ce qu'ils décideraient, et c'est beaucoup pour le prix :

- si l'un des deux dépasse les 31 % de rendement du produit, **c'est lui la nouvelle
  recette** ;
- si aucun n'y arrive, **on sait que la demande est épuisée comme levier**, et le mannequin
  articulé redevient le seul chemin. Ce serait aussi une réponse.

**Ce qu'il ne faut pas repayer :** la clause de constance, le guide de marche, les
réécritures de fond, les planches à quatre ou six cases. Tout ça a été essayé et n'a rien
donné.

---

## Les limites de ces bancs, à dire avant qu'on s'appuie dessus

**Les petits nombres, et ce banc en est la démonstration.** Deux tirages d'une même demande
ont donné 67 % et 14 % de déformation. Une hypothèse qui semblait acquise sur trois tirages
s'est effondrée sur onze. **Rien ici ne doit être décidé sur moins de huit tirages**, et la
piste qui survit n'en a que six — c'est pourquoi elle est présentée comme une piste.

**Un seul sujet a été essayé** — un personnage encapuchonné portant une lanterne, vu de
côté. Rien ne dit qu'une torche qui brûle ou une pièce qui tourne se comportent pareil, et il
est très possible qu'un objet simple réussisse là où un personnage échoue.

**Deux biais de mesure ont été trouvés et corrigés en cours de route.** Une **barre de sol**
dessinée sous le sprite élargit la boîte et fait paraître la forme plus stable qu'elle n'est ;
une **case au quadrillage redessiné** rend un carré, dont la forme ne varie jamais. Le juge du
second banc retire l'une et rouvre l'autre.

**Les cent dix-sept planches ont fini par être repassées par un seul juge**
(`essais/banc_complet.py`), et ça valait la peine : le classement des modèles en a été
changé. `seedream-4.5`, qui dessine une barre de sol sous chaque sprite, était noté zéro ; il
est à 25 %, et sa meilleure planche est le cycle de marche le plus net de tout l'essai.
`gemini-3-pro-image` passe de 25 % à 50 %. **Un biais de mesure avait fabriqué la conclusion
« aucun modèle ne sait animer ».**

---

## Ce que ça fait au mannequin articulé

`docs/etude-mannequin.md` le rangeait en V3 comme *la seule méthode praticable au bout du
chemin*. **Le guide de marche en était une version à deux dimensions et à zéro euro, et il
n'a rien donné.**

Ce n'est pas une réfutation du mannequin — le guide est une image de plus dans une demande,
là où le mannequin impose la géométrie au lieu de la suggérer, et ce n'est pas la même chose.
Mais c'est un signal : **le modèle ne suit pas une pose qu'on lui montre**, du moins pas
quand on la lui montre comme ça.

L'argument du mannequin — *personne ne sait à l'avance quelle planche va marcher, donc il
faut imposer la géométrie au lieu de l'espérer* — **sort renforcé de ce banc**, puisque
vingt-neuf façons de le demander autrement n'ont pas suffi. Il reste cher, et l'essai à
soixante centimes ci-dessus doit passer avant.
