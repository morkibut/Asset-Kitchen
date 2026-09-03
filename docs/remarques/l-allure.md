# « L'allure » — sept reproches d'un coup

> **État : tranchée, avec une question datée.** Le reproche lourd est mesuré, et **il est plus grave
> que ce que l'auteur croyait** : l'univers ne pèse plus la moitié du texte, il en pèse 41 à 45 % —
> mais la consigne de pose, ce qu'on est en train de fabriquer, en pèse **1,5 à 2,3 %**. Réparer ça
> demande de toucher à l'ordre du prompt et des tirages payés : **reporté après la V3, délibérément**
> (§ 6a). Les six autres reproches sont arbitrés ; ce qu'il faut écrire est au § 7. Au passage, sept
> phrases de l'écran citent un numéro d'étape et **les sept sont fausses d'un cran** — à signaler à
> la tranche `D2`, qui tient le fichier.

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

L'écran s'annonce ainsi :

> Sept questions sur la tête que ton jeu doit avoir. C'est ce qui pèse le plus lourd dans ce qui
> part au modèle — plus de la moitié du texte — et donc ce qui décide le plus de ce que tu
> recevras. Clique plutôt que d'écrire : chaque étiquette pose une formule qui marche.

Ses remarques, mot pour mot :

> \> 7 questions sur l'univers de ton jeu, pas la tête.
>
> \> c'est ce qui père le plus lourd : ca c'est vraiment un problème du coup.... car quand on
> génère un personnage qui court avec une épée dans la main en direction de l'ouest, le plus
> important il me semble pas que ce soit les infos de l'univers, mais bien la position, la vue, le
> style graphique et la référence du personnage. Ca explique pourquoi les génération foire sur les
> pose (qui sont le coeur de l'app...)
>
> \> l'étape 3 dit : "Le moment de l'histoire, ou son équivalent inventé. C'est lui qui décide des
> armes, des vêtements et des outils." c'st un peu étrange non ? je devrait pouvoir décider moi
> même des armes des vêtements et outils ? tu voulais plutot dire que ca représente une époque
> technologique pour cadrer un peu le style ? En fait ca sert a quoi ? ca influ quoi ? ca a été
> testé ca ?
>
> \> cette phrase "Écrit par l'étape 2. On le lit ici, on le choisit là-bas — sur une vignette." ne
> veux juste rien dire pour un humain normal.
>
> \> dans l'étape 6, le prompt copier dit "Produce one key image that captures the mood of this
> game, plus three variants that explore different colour temperatures", c'est complètement
> stupide. on veux pas des coouleurs différentes, justement on veut des styles différents, des
> façon de pensé différente pour avoir plusieurs choix de concept art.
> par exempel "Produce 3 looking different concept art image that captures the mood of this game in
> the same scene but in 3 differents styles. No text, no interface elements, landscape format." et
> encore même ca c'est pas top top...
>
> \> l'étape 7 n'est pas expliqué. Il faut remettre dans son contexte, expliquer le lexique, le
> fonctionnement etc... la on lache le joueur dans un truc incompréhensible. déjà que les controles
> et l'interface sont très austère et rugueux, si en plus on explique rien...
>
> \> étape 8 Emplacements : c'est pas du tout visuel. il faudrait un exemple concret visuel avec le
> perso et les calques, ou une image d'explication.

*Ses numéros d'étape ont un cran d'écart avec l'écran d'aujourd'hui — voir le § 2.4, qui en fait un
constat à part entière. Les reproches sont donc repérés ici par leur texte, jamais par leur numéro.*

---

## 2 · Ce que le produit fait aujourd'hui

### 2.1 · « la tête » — le mot est faux, et c'est le seul reproche sans conséquence

L'écran dit *« sept questions sur la tête que ton jeu doit avoir »*
([`Assistant.tsx:1502`](../../interface/src/composants/Assistant.tsx#L1502)). Les sept questions
sont : le monde, l'époque, la technique de rendu, le trait, l'éclairage, la vue, les contraintes
techniques. **Aucune ne parle de tête.** L'auteur a raison mot pour mot ; c'est une phrase à
réécrire, et rien de plus.

### 2.2 · Le poids — mesuré, et le reproche est plus grave que la phrase qu'il vise

Mesuré le 3 septembre 2026 en composant, par le chemin du produit lui-même
(`ServiceGenerations.apercu`, qui rend *« le texte exact qui partira, sans rien facturer »*), le
prompt de trois choses réelles des projets de l'auteur :

| | Le pèlerin · *course* | La grenouille · *repos* | Balthazar · *repos* |
|---|---|---|---|
| **l'univers** — les sept questions | 41,4 % | 45,1 % | 43,7 % |
| **le sujet** — sa description + sa pose | 9,6 % | 1,5 % | 22,9 % |
| **le cadrage** — le cadre et la caméra | 48,7 % | 53,1 % | 33,2 % |
| **la consigne de pose, seule** | **1,7 %** | **1,5 %** | **2,3 %** |
| *le texte entier* | *1 556 car.* | *1 428 car.* | *2 046 car.* |

**Trois choses en sortent, et aucune n'était attendue.**

**a) La phrase de l'écran est fausse, et elle l'était déjà quand l'auteur l'a lue.** L'univers ne
pèse plus « plus de la moitié » : il pèse 41 à 45 %. Ce qui a changé la donne est le bloc de
cadrage et de caméra, entré le **1<sup>er</sup> septembre 2026 à 23 h 14** (commit `0af4515`,
*« la caméra ferme le prompt »*) — deux jours avant la remarque. Sans lui, le calcul du pèlerin
donnait 62 % : la phrase était vraie, et elle a cessé de l'être sans que personne la relise.

**b) Ce qui a pris la première place est précisément la réponse à son autre reproche.** Le bloc de
cadrage — 758 caractères, dont 512 pour la seule caméra — a été écrit pour réparer *« le prompt
d'une pose ne tient pas la vue du jeu »*, sa remarque du 1<sup>er</sup> septembre. **Le déséquilibre
qu'il dénonce ici a donc été corrigé en partie, par le haut**, et l'écran n'en sait rien.

**c) Et le vrai chiffre est bien pire que celui qu'on lui donnait.** Ce qui dit *ce qu'on est en
train de fabriquer* — `running posture, full body` — pèse **26 caractères sur 1 556, soit 1,7 %**.
La chose la plus spécifique de l'appel est la moins écrite de toutes. Sur la grenouille, **qui n'a
aucune description de personnage** (0 caractère), 98,5 % du texte parle de l'univers et du cadrage,
et 1,5 % dit *« au repos »*.

> **L'intuition de l'auteur est juste, et sa formulation est trop douce.** Il croyait dire *l'univers
> prend trop de place* ; la mesure dit **la pose n'en prend aucune**.

### 2.3 · « L'époque » — ce qu'elle promet, et ce qu'elle fait

Son aide dit ([`Assistant.tsx:1420`](../../interface/src/composants/Assistant.tsx#L1420)) :

> Le moment de l'histoire, ou son équivalent inventé. **C'est lui qui décide des armes, des
> vêtements et des outils.**

**Ce qu'elle fait réellement**, vérifié : la case `epoque` sert à **une seule chose** — une ligne du
prompt, `Era: …`. Elle n'entre dans aucun autre calcul, aucun autre écran, aucune décision de
l'atelier ; les deux seuls autres endroits où le mot apparaît dans le serveur sont la liste des sept
cases et sa traduction en anglais (`atelier/domaine/projet.py:113` et `:120`), plus quatorze
étiquettes toutes faites.

Sur le projet du pèlerin, cette ligne pèse **31 caractères sur 1 556 — 2,0 %**.

**Les trois questions de l'auteur ont donc trois réponses :**
- *« ça sert à quoi ? »* — à ajouter deux mots au texte envoyé, rien de plus.
- *« ça influe quoi ? »* — ce que 2 % d'un prompt influencent, ce que personne n'a mesuré.
- *« ça a été testé ? »* — **non.** Aucun banc du dépôt n'isole l'effet d'une case de la bible.

**Et la phrase promet ce qu'elle ne tient pas.** *« C'est lui qui décide des armes »* est faux au
sens propre : c'est l'auteur qui décide, en écrivant sa description de personnage. Sa protestation
— *« je devrais pouvoir décider moi-même de mes armes »* — répond exactement à ce que la phrase dit.
Son hypothèse de reformulation, *« ça cadre une époque technologique »*, est la bonne, et c'est ce
que la phrase aurait dû dire.

### 2.4 · Les phrases numérotées — sept, et les sept sont fausses depuis ce matin

L'auteur bute sur *« Écrit par l'étape 2. On le lit ici, on le choisit là-bas — sur une vignette. »*
Deux défauts se superposent.

**Le premier est celui qu'il nomme : la phrase ne dit rien.** *« On le lit ici, on le choisit
là-bas »* demande au lecteur de tenir deux endroits en tête sans lui dire lequel, et *« sur une
vignette »* nomme une chose qu'il n'a pas sous les yeux.

**Le second, il ne pouvait pas le voir : le numéro est faux.** Sept phrases visibles à l'écran
citent un numéro d'étape en dur. L'insertion de l'étape **« Le style »** en deuxième position les a
toutes décalées d'un cran :

| Où | Ce qu'elle dit | Ce qui est vrai |
|---|---|---|
| [`Assistant.tsx:1424`](../../interface/src/composants/Assistant.tsx#L1424) | la vue est écrite par **l'étape 2** | étape **3** |
| [`:1425`](../../interface/src/composants/Assistant.tsx#L1425) | la technique par **l'étape 3** | étape **4** |
| [`:1605`](../../interface/src/composants/Assistant.tsx#L1605) | idem, en clair sous la case | étape **3** |
| [`:1606`](../../interface/src/composants/Assistant.tsx#L1606) | idem | étape **4** |
| [`:2059`](../../interface/src/composants/Assistant.tsx#L2059) | la vue choisie à **l'étape 2** | étape **3** |
| [`:2060`](../../interface/src/composants/Assistant.tsx#L2060) | **l'étape 2** décide du nombre d'images | étape **3** |
| [`:2369`](../../interface/src/composants/Assistant.tsx#L2369) | donne une silhouette à un type à **l'étape 4** | étape **5** |

> ⚠️ **C'est du travail en cours, pas un état livré.** L'étape « Le style » n'est pas encore
> committée — elle vit dans la copie de travail, avec la tranche `D2`. Ces sept phrases sont donc à
> corriger **avant** que cette tranche parte, pas après. Le dépôt vient déjà de payer exactement ce
> défaut ailleurs : *« les huit types couvrent ce qu'on sait faire »* sur un projet qui en porte
> sept ([voir l'autre remarque](reglages-de-depart-et-accueil.md)). **Un numéro écrit à la main
> dans une phrase est une deuxième vérité, et elle se désaccorde à la première insertion.**

### 2.5 · Le texte à copier — il demande des couleurs, on veut des styles

Le bloc *« Le texte à copier — pour ne pas partir de rien »*
([`Assistant.tsx:1925`](../../interface/src/composants/Assistant.tsx#L1925)) assemble la description
du jeu et la termine par :

> Produce one key image that captures the mood of this game, plus **three variants that explore
> different colour temperatures**. A single scene, not a grid. No text, no interface elements,
> landscape format.

L'auteur a raison sur le fond : ce qu'on cherche à ce moment-là, c'est **choisir une direction**,
donc voir trois manières de penser la même scène — pas la même image trois fois en plus chaud. Une
variation de température de couleur ne fait pas choisir un style, elle fait choisir une heure de la
journée.

**Et le reproche va plus loin qu'il ne le dit.** Ce texte est le seul endroit du produit où
l'atelier écrit un prompt destiné à un **autre outil**, et il ne coûte rien — *« Rien n'est payé par
l'atelier »*. C'est donc l'endroit où l'on peut se permettre d'être ambitieux, et il demande la
variation la moins utile des trois qu'on pouvait demander. Sa propre reformulation est meilleure et,
comme il le dit lui-même, *« même ça c'est pas top top »* — il y a un vrai travail de rédaction à
faire, et c'est le bon endroit pour le faire.

### 2.6 · L'étape des poses — elle a une explication, et elle n'explique pas le métier

L'étape existe et porte une entrée du recueil (`assistant.poses`). Ce qui manque n'est pas l'ancre,
c'est le contenu : une pose, un état, le nombre d'images par pose qui vient de la vue, une liste qui
appartient au type d'objet et non au jeu — **quatre notions qui n'existent que dans ce produit**, et
rien ne les pose avant qu'on demande à l'auteur de les régler. Son mot est juste : *« on lâche le
joueur dans un truc incompréhensible »*.

### 2.7 · L'étape des emplacements — rien de visuel, et le sujet l'exige

Même constat, avec une aggravation : les emplacements décrivent **où un équipement se pose sur un
corps**, c'est-à-dire une chose qui est par nature spatiale. L'écran n'en montre aucune image. Et
quand le jeu n'a aucun type à silhouette, l'étape se réduit à une phrase et un renvoi — vers *« un
type à l'étape 4 »*, qui est le septième numéro faux du § 2.4.

---

## 3 · Pourquoi c'est comme ça

**Parce que la phrase du poids a été écrite juste, et que rien ne la relit.** *« Plus de la moitié
du texte »* n'était pas une approximation : c'était une mesure, et elle était vraie. Elle est
devenue fausse quarante-huit heures plus tard, quand une autre tranche a ajouté 512 caractères de
caméra en fin de prompt. **Une phrase qui cite un chiffre mesuré est un engagement à le remesurer**,
et le dépôt n'a nulle part où inscrire cet engagement.

**Parce que les numéros d'étape sont un cas particulier du même mal.** La liste des étapes est une
donnée ; les phrases qui la citent sont du texte. Insérer une étape est un geste de deux lignes qui
invalide sept phrases situées dans trois écrans.

**Et parce que la bible a été conçue comme un décor, pas comme une hiérarchie.** Les sept cases
partent dans l'ordre où on les a écrites — de la fiction vers le cadre —, chacune au même poids.
Rien dans le produit ne dit qu'une pose doit passer devant un marais. C'est exactement le mécanisme
que l'auteur avait déjà mesuré le 1<sup>er</sup> septembre sur son sprite qui est revenu de face, et
que le bloc caméra a corrigé **par la fin** — en écrasant tout ce qui précède — plutôt que par
l'ordre.

---

## 4 · Ce qui borne la solution

- **Le prompt est composé à un seul endroit** et l'aperçu passe par le même chemin. Toute
  réorganisation doit rester une seule composition, sinon l'aperçu ment.
- **Rien ne se recopie** : une explication vit dans le recueil, et un numéro d'étape se calcule.
- **Les textes envoyés sont en anglais** parce que les modèles le sont ; ce n'est pas une préférence
  et ça ne change pas.
- **Une case éteinte ne dit rien** — c'est le mécanisme existant, et il permet déjà de retirer du
  poids sans rien réécrire.
- **Ce qui coûte de l'argent ne s'essaie pas au jugé.** Vérifier qu'un ordre de prompt vaut mieux
  qu'un autre demande des tirages payés, et la règle du dépôt est **huit tirages minimum par
  branche**.
- **Le travail en cours de la tranche `D2` touche ces mêmes fichiers.** Les corrections de texte
  doivent s'y insérer, pas la doubler.

---

## 5 · Les pistes

### A · Réparer les textes — six phrases, et rien d'autre

Réécrire *« la tête »*, la phrase du poids (avec le chiffre remesuré, ou sans chiffre), l'aide de
l'époque, les deux phrases *« écrit par l'étape N »*, et le texte à copier. Remplacer les sept
numéros d'étape en dur par le rang calculé depuis la liste des étapes.

**Coût** : une demi-journée d'écriture. **Risque** : aucun. **Ce que ça ne fait pas** : ça ne change
pas d'un caractère ce qui part au modèle, donc ça ne répare pas ce que l'auteur a vraiment trouvé.

### B · Hiérarchiser ce qui part au modèle

Le prompt cesse d'être une liste à plat. Ce qui décide de l'image — la pose, la vue, le sujet —
passe devant ; l'univers devient le décor qu'il est. C'est le chantier que la remarque du
1<sup>er</sup> septembre appelait déjà, à demi traité par le bloc caméra.

**Coût** : élevé, et **il se paie en tirages**. On ne saura pas si un ordre vaut mieux qu'un autre
sans générer — huit par branche, la règle du dépôt. **Risque** : toucher au prompt change toutes les
générations à venir, et les images déjà faites ne bougeront pas : le jeu aura deux allures.
**Ce que ça gagne** : c'est le seul chemin vers ce que l'auteur cherche, *« que les générations ne
foirent plus sur les poses »*.

### C · Montrer le poids plutôt que l'affirmer

L'écran cesse de dire *« plus de la moitié »* et **montre** la répartition réelle, calculée sur ce
projet-ci : une barre ou trois pour cents, à côté du texte à copier ou en pied de l'étape. Le produit
sait déjà composer le texte sans rien facturer.

**Coût** : faible — la composition existe, il ne manque que la lecture. **Ce que ça gagne** : une
phrase qui ne peut plus devenir fausse, et l'auteur voit du même coup ce que chaque case pèse. C'est
la réponse structurelle au § 3.

### D · Un banc qui mesure ce qu'une case change

Isoler une case — l'époque, par exemple — et générer avec et sans, huit tirages chacun, pour savoir
enfin ce que 2 % de prompt changent. **Coût** : de l'argent réel, à annoncer avant. **Ce que ça
gagne** : la seule réponse honnête à *« ça a été testé ? »*, qui est aujourd'hui **non**.

---

## 6 · Ce qui est tranché — 3 septembre 2026

### a) Hiérarchiser le prompt reste ouvert, **et c'est délibéré : post-V3**

Le fond de la remarque — que la pose pèse 26 caractères — **n'est pas refermé, il est daté**.
Toucher à l'ordre du prompt change toutes les générations à venir, et on ne saura pas qu'un ordre
vaut mieux qu'un autre sans tirages payés. La mesure du § 2.2 est écrite pour ce jour-là ; c'est
elle qui servira de point de départ, et elle ne se refait pas.

**À rouvrir après la V3**, avec la remarque du 1<sup>er</sup> septembre sur la vue, qui est la même
question prise deux jours plus tôt.

### b) Le chiffre sort de la phrase

L'écran cesse d'annoncer une proportion. Il dit que ces questions pèsent lourd dans ce qui part, et
s'arrête là. **Le montrer pour de vrai — piste `C` — est écarté avec le reste** : ce serait construire
un affichage sur un sujet qu'on vient de reporter. Une phrase sans chiffre ne peut pas devenir
fausse, et c'était tout le défaut.

### c) Le banc qui isolerait une case est écarté

*« Ça a été testé ? »* restera *non*, et **c'est un choix assumé** : deux mots dans un prompt ne
valent pas huit tirages payés par branche. Ce qui change, c'est que l'écran cesse de faire croire le
contraire — l'aide de l'époque dira franchement ce qu'elle fait, c'est-à-dire peu.

### d) Les sept numéros faux se signalent à la tranche `D2`, ils ne se corrigent pas ici

Le fichier est ouvert par un autre chantier en ce moment même. Deux sessions qui éditent
`Assistant.tsx` en parallèle se marcheraient dessus, et le défaut n'est pas dans un état livré —
il est dans du travail qui n'est pas encore committé. **Le tableau du § 2.4 porte les sept lignes
exactes et le bon numéro pour chacune** : il est fait pour être lu et appliqué par celui qui tient
le fichier, avant de committer.

---

## 7 · Ce qu'il faut construire

Cinq réécritures de texte, une chose à signaler, et une question datée.

**1. La phrase d'en-tête, deux corrections d'un coup.**
[`Assistant.tsx:1502`](../../interface/src/composants/Assistant.tsx#L1502) : *« la tête »* devient
*l'univers* — ce sont sept questions sur l'univers du jeu —, et **la proportion disparaît**. Ce qui
reste : ces questions pèsent lourd dans ce qui part au modèle, donc elles décident beaucoup de ce
qui revient. Aucun chiffre, donc aucun chiffre à remesurer.

**2. L'aide de l'époque dit ce qu'elle fait, et pas plus.**
[`Assistant.tsx:1420`](../../interface/src/composants/Assistant.tsx#L1420) cesse d'affirmer *« c'est
lui qui décide des armes, des vêtements et des outils »* — c'est faux, c'est l'auteur qui décide en
écrivant sa description. Elle dit ce que la case fait réellement : **cadrer une époque
technologique**, en une ligne du texte envoyé. La reformulation de l'auteur était la bonne.

> C'est aussi l'endroit où l'on assume que ça n'a pas été mesuré. Le produit écrit ailleurs des
> phrases de cette honnêteté-là — *« c'est une mesure, elle ne règle rien »*, *« rien n'est calculé
> tant que tu n'as pas cliqué »*. Une case qui pèse deux mots peut le dire.

**3. Les deux phrases illisibles deviennent lisibles.**
[`:1424`](../../interface/src/composants/Assistant.tsx#L1424),
[`:1425`](../../interface/src/composants/Assistant.tsx#L1425),
[`:1605`](../../interface/src/composants/Assistant.tsx#L1605),
[`:1606`](../../interface/src/composants/Assistant.tsx#L1606). *« On le lit ici, on le choisit
là-bas — sur une vignette »* demande de tenir deux endroits en tête sans dire lesquels. La phrase
doit nommer l'étape par son **nom** — *« cette case reprend la vue que tu as choisie à l'étape
La vue »* — et non par un numéro.

**4. Le texte à copier demande des styles, pas des températures.**
[`Assistant.tsx:1925`](../../interface/src/composants/Assistant.tsx#L1925). Trois manières de penser
la même scène, pour choisir une direction — et non la même image trois fois en plus chaud. C'est le
seul endroit du produit où l'atelier écrit un prompt pour un **autre outil**, et il ne coûte rien :
c'est donc l'endroit où l'on peut être ambitieux. L'auteur note lui-même que sa propre reformulation
*« n'est pas top top »* — il y a un vrai travail de rédaction, et c'est le bon endroit.

**5. Les deux étapes muettes reçoivent de quoi se comprendre.** Les poses — quatre notions qui
n'existent que dans ce produit, et rien ne les pose avant qu'on demande de les régler. Les
emplacements — un sujet spatial montré sans une seule image. Les deux ont déjà leur entrée au
recueil ; ce qui manque est **dedans**, pas autour.

### À signaler, pas à faire ici

**Les sept numéros d'étape**, table complète au § 2.4. Le fichier est tenu par la tranche `D2`,
non committée. À corriger avant qu'elle parte, et **en calculant le rang depuis la liste des
étapes** plutôt qu'en réécrivant sept nombres à la main — sans quoi la prochaine insertion refera
exactement ça.

### Ce que ça ne fait pas

- **Ça ne change pas d'un caractère ce qui part au modèle.** Le déséquilibre mesuré au § 2.2 reste
  entier, et c'est assumé : il est daté post-V3.
- **Ça ne mesure rien de plus.** Le banc qui dirait ce qu'une case change est écarté.
- **Ça n'ajoute aucun affichage.** Montrer la répartition réelle aurait été bâtir sur un sujet
  reporté.

---

## Ce que cette remarque recoupe

- **Le prompt d'une pose ne tient pas la vue du jeu** *(séance du 1<sup>er</sup> septembre, étayée)* —
  **c'est la même remarque, prise deux jours plus tôt et par l'autre bout.** Le bloc caméra en est
  la réponse partielle, et c'est lui qui a rendu fausse la phrase du poids.
- **[Les réglages de départ et l'accueil](reglages-de-depart-et-accueil.md)** — les sept cases de la
  bible y sont déjà nommées : leurs sept entrées du recueil sont orphelines. Et le défaut du numéro
  écrit à la main y a un jumeau, *« les huit types »*.
- **[« Concept art de » et « Artwork officiel »](concept-art-contre-artwork.md)** — les images
  jointes sont l'autre moitié de ce qui part au modèle, et la mesure du § 2.2 ne compte que le
  texte.
