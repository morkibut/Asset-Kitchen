# Bilan technique de la V3 — ce que les bancs et les analyses ont établi

> Écrit le 2 septembre 2026. **C'est le seul document à lire avant d'ouvrir la V3.** Il
> remplace la lecture de sept fichiers et 210 Ko : il ne raconte rien, il conclut. Chaque
> conclusion nomme la mesure qui la porte et le fichier où elle se relit en entier.
>
> Ce document **ne tranche rien sur le produit** : `docs/PRD.md` fait foi sur ce que
> l'atelier doit faire, `docs/PLAN.md` sur ce qui se construit et dans quel ordre.

---

## En une page

**Trois bancs payés les 1ᵉʳ et 2 septembre 2026 : 141 planches d'animation, 6,03 $, toutes
regardées et notées une par une par l'auteur.** Plus un relevé d'outillage sur une trentaine
d'outils libres, et quatre mesures faites sur les images de ce dépôt.

Sept chiffres décident de toute la version :

| Ce qui est mesuré | Le chiffre | Ce qu'il commande |
|---|---|---|
| Bonnes planches sur celles qui sont notées | **14 sur 135** — une sur dix | Le produit se bâtit sur *commander plusieurs planches et garder la bonne*, jamais sur *commander et corriger* |
| Prix d'une bonne planche, ratés compris | **5 à 17 centimes** | Ce n'est pas un échec, c'est un prix — et il reste dérisoire à l'échelle d'un jeu |
| Bonnes planches obtenues en réécrivant la demande | **0 sur 36** | **Réécrire** est épuisé comme levier — on ne change plus les mots. *Les **ranger** est autre chose et n'a jamais été essayé : tranche `R7`* |
| Écart de hauteur entre les huit images livrées d'une même animation | **zéro pixel** | Ce qui est payé est **détruit avant d'être vu** : le traitement écrase le mouvement |
| Recettes de découpage du dépôt qui s'écartent du réglage de départ | **plus d'une sur deux** | Le réglage livré est faux, et il se refait à la main sur presque chaque image |
| Pixels de bord réellement sales sur les vraies images | **80 sur 138 465** — un millième | Un chantier entier de correction de bord a été **évité** : le problème n'existe pas ici |
| Hauteur maximale qu'un sujet peut demander | **celle d'un personnage**, et pas un carré de plus | Bâtiments, arbres, tours, portes de ville : une **famille entière d'assets** que le produit ne sait pas commander. Sa propre tranche |

**Ce que ça donne comme forme de produit :** les tables de retouche se réparent **d'abord et
entièrement**, parce qu'une image mal traitée n'est pas jugeable et que le geste de la V3 est
de juger vite. Puis l'animation se construit autour du tri, pas de la retouche. Et elle se
termine par le seul chemin qui supprime la loterie au lieu de la subir — le pantin articulé.

---

## 1 · Ce qui a été payé, et ce que ça a répondu

| Le banc | Ce qu'il devait trancher | Tirages | Prix | La réponse |
|---|---|---|---|---|
| **Les modèles** | Lequel tient un cycle de marche ? | 46 | ~2,9 $ | Celui qui est **déjà en place**, et de très loin le moins cher par bonne planche |
| **Les réglages** | Quelle façon de demander marche le mieux ? | 71 | ~2,4 $ | **Aucune ne bat celle du produit.** Cinq réécritures de fond : zéro bonne planche sur vingt |
| **L'arbitrage** | Les deux dernières pistes valent-elles quelque chose ? | 24 | 0,71 $ | **Non, les deux.** Zéro bonne planche sur vingt-quatre |

### Le modèle est réglé, et ce n'est pas lui le problème

À demande strictement identique — le texte du produit et ses trois images relus dans une
vraie génération, jamais recomposés :

| Modèle | Essais | Bonnes | % bonnes | Prix par bonne planche |
|---|---|---|---|---|
| **`openai/gpt-image-2`** — celui du produit | 8 | **5** | **62 %** | **0,047 $** |
| `google/gemini-3-pro-image` | 8 | 1 | 12 % | 1,11 $ — vingt-trois fois plus |
| Les six autres essayés | 30 | 0 | 0 % | — |

Le second mérite d'être connu pour une raison et une seule : il est **presque jamais mauvais
et presque jamais bon**. Quand une planche doit revenir utilisable du premier coup et que le
prix ne compte pas, c'est lui. Partout ailleurs, non.

> ⚠️ **Une mise en garde qui vaut pour tous les chiffres de ce document.** Les huit planches
> du modèle en place ont été renotées quand l'auteur les a revues à côté de planches neuves :
> **cinq notes ont changé, toutes vers le haut, sans qu'une seule image bouge**. Le taux du
> modèle passe de 25 % à 62 %. C'est la limite du juge unique, mesurée au lieu d'être
> redoutée. **Ne jamais comparer un chiffre d'une séance de notation à celui d'une autre** —
> toutes les comparaisons de ce document se font à l'intérieur d'une même séance.

---

## 2 · Ce qui est mort, et ne doit pas se reproposer

Un chemin abandonné qu'on ne consigne pas revient six mois plus tard sous un autre nom.

**Mieux écrire la demande — mort, et c'est mesuré.** Trente-et-un réglages essayés sur trois
bancs : le nombre de cases par planche, six formulations différentes, ce qu'on joint à la
demande, le format de l'image, la clause qui exige que le personnage reste le même. Les cinq
réécritures de fond donnent **zéro bonne planche sur vingt**. Les planches à quatre cases,
reprises proprement avec tout le texte du produit, donnent **zéro sur seize**. Remplacer la
clause de constance et pousser jusqu'à quinze tirages donne **20 % de bonnes contre 62 %** au
texte tel qu'il part aujourd'hui. *« Une demande de plus au même modèle ne donnera rien : ce
n'est plus une opinion, c'est six dollars de mesures. »*

> ⚠️ **Ce que ce résultat ne dit pas, et où j'étais allé trop loin.** Ce qui a été essayé, ce
> sont des **formulations** — dire la même chose avec d'autres mots. **La mise en page n'a
> jamais été essayée** : ranger ce qui part en parties nommées — le contexte, les références,
> la demande — au lieu d'un bloc continu. Ce n'est pas une réécriture, c'est un rangement, et
> le relevé d'usage signale un défaut concret qu'il corrige : **une image jointe ne dit pas ce
> qu'elle est**, si bien qu'un artwork de style, un gabarit de découpe et un sprite de pose
> partent dans le même sac. *Tranché par l'auteur le 2 septembre 2026 : c'est la tranche `R7`,
> et elle ne promet aucun gain de taux — seulement un texte relisible.*

**Le brouillon gratuit — impossible ici, et pour une raison de structure.** L'idée était de
dégrossir chez le fournisseur qui ne facture rien avant de payer le bon. Le modèle gratuit
**n'accepte aucune image en entrée**, donc pas le personnage. Ce ne serait pas un brouillon de
l'animation, ce serait un autre personnage.

**La correction du bord par calcul de transparence — écartée, et c'est le résultat le plus
utile de la séance.** Le code du produit oppose depuis toujours deux défauts : ronger le bord
coûte un sprite qui maigrit, ne pas le ronger coûte un halo à la couleur du fond. Un chantier
entier était prêt à dissoudre ce compromis. Cherché sur quarante vraies images du dépôt, **le
halo représente 80 pixels sur 138 465 de contour — un millième**, et la correction le réduit
de 94 % d'un problème qui n'existe pas. La raison est structurelle : le produit génère sur un
fond plat et découpe par inondation, et le moteur employé par défaut ne rend **aucun** pixel à
demi transparent. Le halo est un problème de photographie détourée, pas le nôtre.
*La bibliothèque qui l'aurait corrigé est déjà installée et n'a jamais été appelée — le jour
où le moteur par modèle deviendra le défaut, la correction coûtera deux lignes.*

**La 3D auto-riguée et le report d'un mouvement filmé — non mesurés, et rangés.** L'un et
l'autre payants ou suspendus à un compte que ce dépôt n'a pas. Ils se reprendront le jour où
le pantin échouerait, pas avant.

---

## 3 · Ce que le code fait de faux aujourd'hui — trouvé en lisant, pas en payant

Quatre défauts. **Le premier annule à lui seul tout ce qui est payé en animation** ; **le dernier ferme au produit une famille entière d'assets**, et il est le seul des quatre dont la réparation demande sa propre tranche.

### L'échelle est recalculée sur chaque image, donc elle pompe

Quand une image est ramenée sur la grille du projet, le facteur d'agrandissement est calculé
sur **la boîte de l'image en cours**. Un bras tendu agrandit la boîte, donc **réduit tout le
personnage**. D'une étape à l'autre le nain grandit et rapetisse, alors qu'il ne fait que
marcher.

Mesuré sur la chaîne complète : **les huit images livrées faisaient toutes exactement la même
hauteur, ligne de sol au même pixel, écart zéro**. Le balancement, s'il existait sur la
planche payée, avait disparu avant que l'œil puisse le voir.

**Et le commentaire du code affirme l'inverse de ce que le code fait** — il promet que c'est
justement ce qui fait que deux images d'un même personnage se superposent. Le code connaît la
dérive **horizontale**, la décrit et offre un décalage à la main ; il ne connaît pas la dérive
**d'échelle**, qui est la fatale.

*Réparation : cinq lignes et un commentaire. C'est le premier travail de la tranche A2.*

### Le bas de l'image est posé sur le bas de la case, poussière comprise

L'ancrage vertical pose le bas de la boîte englobante sur le bas de la case. **Toute poussière,
toute ombre isolée sous les pieds soulève donc le personnage d'autant.** Le nettoyage des
taches doit précéder le calcul de la boîte — sinon un pixel perdu décide de la position de
toute l'étape.

### Le réglage de découpage livré est faux plus d'une fois sur deux

Compté sur les 116 assets du dépôt : sur 123 découpages, **64 portent un durcissement du bord
alors que le réglage de départ est zéro**. La tolérance, elle, n'est presque jamais touchée —
111 sur 118 restent à la valeur livrée : **ce n'est pas elle le problème**.

Et ~~**une planche et une image seule ne veulent pas le même réglage**~~, ce qui se lit dans les
recettes de l'auteur : durcissement non nul dans **67 %** des images ordinaires contre **38 %**
des morceaux de planche, et la pipette employée **onze fois sur les images seules, jamais sur
un morceau de planche**.

> ### ⚠️ Recompté le 3 septembre 2026 : c'est le moteur, pas la nature de l'image
>
> Le comptage ci-dessus est juste ; sa lecture ne l'est pas. Croisé avec le **moteur de
> détourage** employé, l'écart entre une planche et une image seule s'évapore :
>
> | moteur    | passes | durcissement laissé à zéro | valeur la plus fréquente |
> |-----------|--------|----------------------------|--------------------------|
> | bord      |   72   |          **78 %**          | **0** (56 sur 72)        |
> | pipette   |   11   |           0 %              | **1** (6 sur 11)         |
> | modèle    |   40   |           2 %              | **2** (32 sur 40)        |
>
> À moteur égal, la nature ne décide presque plus rien — 100 % contre 93 % sur le moteur par
> modèle. **Et la raison est trois paragraphes plus haut, dans la mesure 3 de ce même bilan** :
> le moteur du bord ne produit aucun pixel à demi transparent, il est binaire par construction ;
> le moteur par modèle en produit sur 95 % du sujet. Le durcissement ne corrige pas un goût, il
> corrige une frange, et la frange appartient au moteur qui la fabrique. Les deux mesures étaient
> dans le même document sans avoir jamais été jointes.
>
> **Ce que D1 en a fait** : le durcissement voyage avec le moteur, y compris quand l'auteur en
> change sur une image — geste qu'il avait retapé à la main 39 fois sur 40. Les durcissements
> tapés à la main tombent de **54 % à 24 %** de ses 123 passes. Le banc :
> `essais/essai_defauts_de_detourage.py`, gratuit, il relit la base.
>
> La pipette employée onze fois sur les images seules et jamais sur une planche, elle, reste
> vraie — mais c'est un geste, pas un défaut : on ne peut pas désigner d'avance un pixel dans une
> image qui n'existe pas encore.

---

### Rien ne peut être plus grand qu'un personnage, et c'est une famille d'assets entière

**Le réglage d'échelle ne sait dire que « plus petit ».** Chaque image revient dans une case
carrée du même côté — 64 petits carrés, par exemple —, et l'échelle dit **quelle part de cette
case** le sujet remplit : un personnage 100 %, un meuble 66 %, un objet tenu 40 %. Le plafond est
donc 100 %, et il est écrit **en douze endroits**, comptés : trois corps de route, deux refus
de service, un calcul d'image, trois du calibrage, la liste des positions où le curseur
s'arrête, et les deux curseurs d'écran. Un moulin, un arbre, une tour, une porte de ville : le produit
n'a aucune façon de les demander plus hauts qu'un personnage.

Le modèle est **juste vers le bas** — c'est bien ainsi qu'un objet tenu en main se dessine —, et
faux vers le haut, où il ne va pas.

**Comment les vrais projets 2D font, et ce n'est pas en agrandissant les carrés.** La question a
été posée le 3 septembre 2026, et la réponse est constante d'un projet à l'autre : **le carré ne
change jamais de taille**. Ce qui change entre un personnage et un bâtiment est **le nombre de
carrés qu'il couvre**, jamais leur dimension. Un personnage fait 32 carrés de haut, une maison en
fait 96 : trois fois plus de carrés de la même taille.

Agrandir les carrés pour les gros objets est l'erreur classique, et elle porte un nom — **des
« mixels »**, de *mixed pixels* : deux tailles de pixel dans la même image trahissent
immédiatement le trucage, parce que l'œil compare les bords. C'est la première chose qu'un guide
de style de jeu 2D interdit.

**Ce que les moteurs demandent, concrètement**, et cela confirme le même modèle :

| ce qu'on déclare | valeur courante | ce qu'elle veut dire |
|---|---|---|
| la résolution de base du jeu | 320 × 180 | la fenêtre en pixels de jeu, agrandie ensuite d'un facteur entier |
| la taille de tuile du jeu de tuiles | 32 × 32 | **une seule pour tout le jeu** ; un objet de trois tuiles de haut en occupe trois |
| le filtrage de la texture | au plus proche | aucun lissage, sans quoi les carrés se mélangent |

Aucun de ces trois réglages n'a de variante « pour les gros objets ». **La taille de tuile est une
propriété du jeu, pas de l'objet.**

**Ce que la réparation demande.** Remplacer « quelle part de la case » par **« quelle hauteur, en
carrés »**. Le carré reste l'unité du projet ; ce qui devient réglable par type de sujet est
**combien il en couvre**, au-dessus comme au-dessous d'un personnage. La case cesse alors d'être un
plafond et redevient ce qu'elle est : la taille d'un sprite de personnage.

*C'est une tranche à elle seule : elle touche le barème d'échelles, la recette, les deux calculs
d'image, les trois corps de route, l'écran des places, la fiche et l'export. Et elle demande une
reprise des projets existants — une part de case se convertit en hauteur de carrés sans perte, mais
il faut le faire.*

## 4 · Ce que le relevé d'outillage a rapporté

Une trentaine d'outils libres examinés. Ce qui est repris, axe par axe. Le détail, les sources
et les mises en garde de licence sont dans `docs/releve-outillage.md`.

### Ramener une image sur une vraie grille de pixels

C'est le plus vieux défaut du produit : un modèle rend une image de mille pixels *à l'allure*
pixel art dont les blocs sont inégaux, les bords flous et les couleurs innombrables. Quatre
choses à reprendre :

- **la réduction se fait en deux temps** — un tri grossier des couleurs décide **où** tombe
  chaque case, les pixels d'origine décident **quelle couleur** elle prend. Erreur mesurée
  4,56 contre 5,51 pour la moyenne classique ;
- **trier les couleurs avant de chercher la grille** transforme les dégradés de bord en marches
  franches posées sur la vraie frontière ;
- **la règle du plus petit pas qualifié** tranche notre mode d'échec dominant, qui est de
  confondre un pas avec son double ;
- **la palette du projet s'applique après la réduction, jamais avant** — sinon on fabrique des
  couleurs de bord qui n'existent nulle part dans le jeu.

> ⚠️ **Le piège qui vise ce dépôt en particulier.** Les détecteurs de référence cherchent des
> blocs jusqu'à vingt-quatre pixels. Ce dépôt a mesuré des blocs **approchant quatre-vingts
> pixels** sur une image de mille — cinq fois plus gros que demandé. Repris tels quels, **ils
> ne verront jamais notre vrai pas**. Relever la borne n'est pas gratuit : le détecteur y perd
> de la finesse. Et en cas de doute, **viser fin** : une grille un peu trop fine se rattrape
> presque parfaitement, une grille trop grossière non.

**Deux résultats contre-intuitifs à ne pas resupposer** : le détecteur qu'on écrirait
d'instinct est **le pire** des onze mesurés ; et **additionner plusieurs canaux de couleur bat
le meilleur canal seul**.

> ### ✔ Repris et mesuré le 3 septembre 2026 — deux affirmations ci-dessus sont fausses
>
> La tranche `D2` a livré le détecteur, et les deux bancs qui l'ont réglé sont gratuits :
> `essais/essai_grille_retrouvee.py` a comparé quatre méthodes, `essais/essai_grille_produit.py`
> mesure celle qui est livrée. **Ce paragraphe reste tel quel parce qu'il a servi à cadrer la
> tranche** ; voici ce qu'il en reste.
>
> | l'affirmation | ce que la mesure a rendu |
> |---|---|
> | *les blocs de ce dépôt approchent 80 px* | **✘ faux.** Sur les 149 images brutes, le pas le plus grossier est de **32 px**, 99 % sous 22. « 80 » n'a jamais été relevé : c'est 5 × 16 |
> | *relever la borne fait perdre de la finesse* | **✘ non reproduit.** À 64, la réussite est exactement celle de 32 ; sur les images brutes, la borne ne change rien du tout — 61 annonces, de 24 à 128 |
> | *la borne de 24 des outils de référence coupe notre dépôt* | **✔ vrai**, et c'est ce qui pose la borne à 32 : douze cas du lot de réception y passent de « trouvé » à « renoncé » |
> | *en cas de doute, viser fin* | **✔ vrai**, et c'est la règle du plus petit pas qualifié — zéro erreur d'octave sur les deux bancs |
> | *le détecteur qu'on écrirait d'instinct est le pire* | **✔ vrai**, et le nôtre en était un : `mesurer_grille` répond **2 avec une netteté de 0,94 sur une peinture**. Ce qui la répare n'est pas une meilleure recherche de période mais le **peigne**, qui exige que le contraste tombe sur les *multiples* du pas — 0,12 sur une peinture, 0,69 sur une vraie grille |
> | *additionner les canaux bat le meilleur canal seul* | **✔ repris, et nuancé** : un cas d'écart sur 204. Ce qui décide est franc — un sprite détouré d'une seule teinte porte sa grille dans sa silhouette, et le gris, qui jette l'alpha, répond 2 à tous les coups |
>
> **Et une chose que ce § 4 ne disait pas, qui s'est révélée être le cœur de la tranche** : ce
> qui manquait au produit n'était pas de mieux trouver, c'était de savoir **renoncer**. Sur les
> 149 images du dépôt, la détection se tait sur 88 d'entre elles, et c'est la bonne réponse —
> ce sont des peintures. Le taux livré est de **200 sur 204, soit 98 %**, sur un lot bâti à
> partir de vrais dessins du dépôt reposés sur des grilles de pas connu.

### Détourer mieux, et sur des modèles faits pour du dessin

> ⚠️ **Deux affirmations du relevé d'outillage sont fausses sur ce point, vérifiées dans le code
> le 2 septembre 2026.** Il parle de *« nos deux modèles »* et réclame *« le cran manquant »* :
> le produit en porte **trois** depuis `U13`, dans un catalogue structuré — nom, titre, poids
> relevé, note —, et celui du milieu porte littéralement le titre **« intermédiaire »**. Le
> commentaire du code invoque déjà la règle : *« le catalogue décide, jamais une liste en dur »*.
> Et le produit compte **quatre** moteurs de découpe, pas trois — la sélection magique est
> arrivée en V2.1. **Rien de ce paragraphe n'est à reprendre de ce côté-là.**

Ce qui reste vrai, et qui est le contenu réel de la tranche `D4` :

- **Aucun de nos trois modèles n'a été entraîné sur du dessin.** Ils viennent tous de la
  photographie, et nos images sont des dessins. Le catalogue de la bibliothèque en contient
  **un** entraîné sur du dessin animé, jamais essayé.
- ⚠️ **Et ce modèle-là porte un risque qui n'est pas technique.** Ses jeux d'entraînement sont
  des collections d'images de personnages d'animation japonaise : l'hypothèse la plus probable
  n'est pas « conditions non lues » mais **œuvres sous droit d'auteur rassemblées sans
  licence**, et l'auteur est en France, où les exceptions de fouille ne suivent pas le régime
  américain. Il ne s'ajoute pas sans que ce soit écrit à côté de lui.
- **Essayer le modèle lourd coûte 972 Mo**, et c'est pour ça qu'on ne l'essaie pas. Un allégé de
  la même famille est annoncé à **88,6 Mo** — un onzième — et n'a pas été essayé non plus.
- **Deux pièges d'intégration sont signalés et non vérifiés ici** : une normalisation qui ne
  divise pas par ce qu'on croit, et le comportement d'un masque réduit puis réagrandi.

### Le fond sur lequel le sujet est posé

Le produit demande aujourd'hui un fond gris clair — c'est-à-dire une couleur que le sujet
porte aussi. **Demander une couleur franche que rien dans le jeu ne contient rend le découpage
presque gratuit et presque parfait.** Deux choses le rendent facile ici :

- le fond **est déjà écrit en toutes lettres** dans le texte qui part ; le changer ne coûte
  pas une ligne de code ;
- le produit porte déjà un champ d'interdiction que l'adaptateur replie en fin de demande.
  **La phrase qui interdit au modèle d'employer cette couleur et ses voisines dans le sujet,
  les reflets, les accessoires et les ombres y entre sans rien écrire.**

Et la palette d'un projet est **une liste fermée de vingt-quatre couleurs** : proposer une
couleur de fond sûre devient un calcul de distance fait une fois, pas une devinette.

> ⚠️ **Le fait qui referme la branche « demander une image déjà détourée ».** Le catalogue
> déclare l'option, mais **relevé le 2 septembre 2026, elle n'est pas ouverte sur le modèle que
> le produit emploie**. Elle l'est sur quatre autres. Elle ne se mesure donc qu'en changeant de
> modèle, ce qui change tout le reste avec.

### Le pantin articulé — le chemin qui supprime la loterie

**La référence est meilleure qu'espéré, et elle change la taille de la tranche.**

- Il existe une référence libre et complète, code **et** poids, sous une licence qui ne pose
  aucune condition. Et surtout : **sa partie animation ne dépend d'aucun modèle lourd.** Les
  modèles vivent dans la détection automatique, pas dans l'animation. **Si l'atelier fournit
  lui-même la silhouette et la position des articulations — ce qu'il sait déjà faire — toute la
  chaîne tourne sur les deux bibliothèques de calcul déjà installées.**
- **Il n'y a aucun poids d'attache à calculer** : les articulations sont de simples épingles, et
  le coude tient par la rigidité du maillage. C'est ce qui rend le cœur copiable en un fichier
  de trois cents lignes.
- Le squelette a **un format éprouvé à reprendre** : seize articulations, trois champs chacune.

> ⚠️ **L'ordre des opérations est décidé, et il commande tout le reste : déformer en grand,
> pixeliser à la fin.** Trois sources indépendantes le disent. La déformation rend des
> positions continues ; les écrire directement dans une grille de soixante-quatre pixels, c'est
> fabriquer le bras qui bave. Le problème n'est pas la rotation, c'est **de quantifier la
> géométrie trop tôt**. La chaîne est donc : personnage en grand → découpage existant →
> maillage, squelette et déformation à cette taille-là → rendre chaque étape en grand → **et
> seulement là** ramener sur la grille. **C'est la branche qui ne demande aucun module neuf en
> aval** : tout ce qui suit est déjà écrit et éprouvé dans le dépôt.

**Trois réserves à ne pas découvrir en route** : le dépôt de référence est **archivé depuis
septembre 2025** — on recopie l'algorithme, on n'en fait pas une dépendance ; son calcul
déborde numériquement au-delà d'un millier de points, ce qui impose de **simplifier le maillage
avant de le lancer** ; et son affichage passe par la carte graphique, **à ne pas reprendre** —
seul le calcul du maillage déformé nous intéresse.

**Et un essai gratuit qui peut supprimer la moitié de la tranche** : fabriquer un pantin à
partir d'une silhouette que l'atelier sait déjà produire, poser les épingles à la main, et
**regarder à quelle amplitude ça casse**. Si une marche et une attaque de profil passent sans
découvrir de zone cachée, **toute la découpe en morceaux et leur rebouchage deviennent
facultatifs**.

### Le mouvement comme objet réutilisable

- **Deux conventions concordantes à copier** : les outils d'animation sérieux séparent le
  squelette d'un côté et les mouvements de l'autre. **Un mouvement écrit une fois pour des
  articulations qui portent des noms convenus se rejoue sur n'importe quel personnage portant
  les mêmes noms.**
- **Un cycle de marche complet, une fois ramené à des angles à plat, tient en quarante-huit
  nombres** — contre cinq mégaoctets de capture d'origine. Une bibliothèque maison se paie une
  fois en travail et devient gratuite pour tous les personnages suivants.
- **Deux corpus réutilisables commercialement existent**, dont un de cent mouvements nommés
  livrés avec leurs bornes de découpe.

### Les formats de sortie — n'en inventer aucun

Le format d'accompagnement d'une planche de sprites le plus lu par les moteurs est connu et ses
clés exactes sont relevées. **À écrire tel quel plutôt qu'à concevoir** : un moteur ouvre alors
la planche sans avoir à la remesurer. Même règle pour le squelette : le format de référence
existe, il se reprend.

### Une recette par type d'image

L'idée vient d'un outil concurrent et **notre propre mesure la confirme** (§ 3) : un morceau de
planche et une image seule ne veulent pas les mêmes réglages, et l'écart est net. Le produit
range déjà par famille le modèle par défaut d'un univers ; la recette suit le même rangement et
n'invente aucun vocabulaire.

**En revanche, demander au modèle de décrire ce qu'il vient de dessiner ne se pratique nulle
part**, et pour une bonne raison : on écrit d'avance ce qu'on attend, et on **mesure** sur
l'image revenue si c'est là. Ce que le dépôt fait déjà avec le compte de sujets et la dérive de
grille. Ce qui est reprenable, ce sont **les mesures d'acceptation d'un tirage** — le nombre de
pixels de bord et le nombre de pixels encore collés à la couleur de fond, qui disent en un
chiffre « le fond n'a pas fini de partir ».

---

## 5 · Il n'existe aucune vérité extérieure pour juger, et c'est un manque

Rien dans ce dépôt ne permet de comparer une animation à une animation correcte : **tout se
compare à soi-même**, et le juge est unique. Le corpus libre le plus proche du besoin est un
générateur de personnages dont les sprites sont découpés en couches sur une même grille, avec
un vocabulaire d'actions figé qui vaut d'être copié.

> ⚠️ **Piège de licence** : son code et ses images ne relèvent pas des mêmes conditions, et
> rien ne s'y redistribue en bloc. Le sous-ensemble libre de droits sert d'étalon gratuit, et
> sa liste d'actions vaut d'être reprise — les images, non.

---

## 6 · Les limites de tout ce qui précède

À dire avant que quiconque s'appuie sur un chiffre de ce document.

- **Un seul juge, à l'œil, et il change d'avis.** Mesuré : cinq notes sur huit ont bougé à la
  seconde lecture, toutes vers le haut. Les comparaisons entre deux séances de notation ne
  valent rien.
- **La mesure automatique ne prédisait rien.** Elle a été confrontée aux notes de l'auteur et
  s'est révélée sans rapport avec elles. C'est ce qui a fait rejeter tout classement calculé.
- **Un seul personnage, un seul mouvement, un seul style.** Rien ne dit que le taux d'une bonne
  planche sur dix tient sur un autre sujet.
- **Rien du relevé d'outillage n'a été mesuré sur nos propres images**, sauf les quatre mesures
  du § 3. Les chiffres venus d'ailleurs valent comme ordre de grandeur, **jamais comme
  décision**.
- **Deux affirmations de la recherche ont été vérifiées et corrigées** : une bibliothèque de
  vision annoncée comme déjà installée ne l'est pas du tout, et une autre ne l'est que par une
  option facultative. Aucune reprise ne doit les supposer présentes.

---

## Où lire le détail

| Le fichier | Ce qu'il porte |
|---|---|
| `docs/archive/v3-animation.md` | Les trois bancs, planche par planche, avec les notes de l'auteur et les tableaux complets |
| `docs/releve-outillage.md` | Le relevé d'outillage entier — sources, licences, ce qui est écarté et pourquoi |
| `essais/rapport-animation.html` | Les 117 premières planches, animées, avec les boutons de notation |
| `essais/rapport-arbitrage.html` | Les 39 planches du dernier banc, et le tableau qui se recalcule à mesure qu'on note |
| `essais/notes-auteur.json` | Les 135 notes, telles que l'auteur les a posées |
| `docs/archive/essais-v3/` | Les modes d'emploi des séances, les études préparatoires et les pistes explorées puis rangées |
