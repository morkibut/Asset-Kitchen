# Asset Kitchen — État du dépôt

Le journal de ce qui a été construit, tranche après tranche, et de ce que chaque tranche a
appris. **Il ne fait foi sur rien** : `docs/PLAN.md` dit ce qui reste, `docs/PRD.md` ce que
le produit doit faire, `docs/ARCHITECTURE.md` comment il est construit. Ce fichier-ci ne fait
que raconter, et il se lit dans un seul cas — **quand on veut savoir pourquoi c'est comme ça
plutôt qu'autrement**.

Il ne se lit pas au démarrage d'une session. Une tranche neuve n'a pas besoin de l'histoire
des dix précédentes ; elle a besoin de `docs/PLAN.md` et de `docs/PIEGES.md`.

Une entrée s'ajoute à chaque fin de tranche. Les plus récentes en tête.

## D4 — le catalogue s'ouvre, et deux des trois choses qu'on attendait sont fausses — 3 septembre 2026

**La V2.3 se ferme avec elle, cinq tranches sur cinq.**

### Ce que le banc devait confirmer, et ce qu'il a dit à la place

Le relevé d'outillage annonçait deux manques, et la tranche les avait recopiés. Le banc les a
mesurés — cinq modèles, quatre images du dépôt, gratuit
(`essais/essai_moteurs_de_detourage.py`).

| modèle | entrée | ms | part gardée | **ajouré trouvé** |
|---|---|---|---|---|
| `birefnet-general-lite` | 1024 | 12 058 | 0,214 | **4,8** |
| `isnet-anime` | 1024 | 1 578 | 0,213 | **2,2** |
| `u2net` | 320 | 894 | 0,219 | 2,5 |
| `isnet-general-use` | 1024 | 1 539 | 0,215 | 3,8 |
| `birefnet-general` | 1024 | 21 595 | 0,214 | 3,5 |

**La part gardée ne sépare rien**, et c'est elle que le relevé regardait : cinq modèles à
quatre millièmes près. Ce qui sépare est l'**ajouré** — l'espace entre un bras et un torse, une
boucle de ceinture, une frange —, et il fallait le compter pour le voir.

**Le modèle entraîné sur du dessin est le plus mauvais des cinq sur ce point-là.** La tranche
l'annonçait comme *« le plus proche de notre cas d'usage »* ; il trouve **un** trou là où les
autres en trouvent trois à sept, et c'est celui qui s'écarte le plus de tous les autres — 0,925
d'accord au pire. La raison se comprend après coup, et elle est dans son nom : `isnet-anime`
apprend à découper **un personnage d'un seul tenant**, ce qui est exactement le contraire de
garder l'ajouré. *Il reste au catalogue avec cette note écrite à côté de lui — un modèle écarté
sans avoir été essayé se repropose tous les six mois.*

**L'allégé bat le lourd, et il ne pèse pas ce qu'on disait.** 214 Mo pesés sur le disque, pas
88,6 : le chiffre du relevé était celui des poids PyTorch, pas de l'export ONNX que `rembg`
rapatrie — un quart du lourd, pas un onzième. Il le bat quand même : plus d'ajouré, deux fois
moins de temps, 99,5 % d'accord avec lui. **C'est la seconde fois que ce relevé donne un
chiffre faux à cette tranche**, la première étant *« nos deux modèles »* pour trois.

### Et une affirmation de la tranche elle-même est tombée

Elle écrivait que les *« 95 % de pixels à demi transparents »* cités par trois documents du
dépôt étaient **en partie la trace du réagrandissement** du masque de `u2net`, qui infère à 320
et étire. La mesure dit non : `isnet-general-use`, qui infère à 1024 et n'étire rien, en rend
**autant** — 421 092 contre 445 278, 3 % d'écart. C'est la sortie douce du modèle, pas
l'étirement, et c'est le durcissement qui la tranche depuis toujours.

**Le paragraphe fautif est laissé dans le plan avec la correction sous les yeux**, plutôt que
retiré : une affirmation effacée en silence se réécrit toute seule six mois plus tard.

### Ce qui a été construit, et ce qui a servi à le construire

**Le défaut du moteur par modèle passe à `isnet-general-use`**, pour la ligne de l'ajouré : une
moitié de détails en plus, à part gardée égale, pour 0,7 seconde de plus — et le moteur par
modèle sert les images **importées**, pas ce que l'atelier fabrique. ⚠️ *Une recette d'avant
`U13` ne nomme aucun modèle et retombe sur ce défaut : son rendu change. Celles qui nomment
`u2net` ne bougent pas d'un pixel.*

**Les deux réparations de bord partagent une seule mesure**, et c'est ce qui les fait marcher
sur les quatre moteurs à la fois : aucun ne déclare la couleur qu'il a prise pour du fond — le
modèle ne rend qu'un masque —, mais tous laissent derrière eux les pixels qu'ils ont ouverts, et
*effacer un pixel ne change pas sa couleur*. **Le fond d'une passe se lit dans son propre
résultat.**

- **Le rongement conditionnel épargne 47 185 pixels de sujet** sur les quatre images, et il ne
  peut jamais en manger plus que l'érosion aveugle — c'est un sous-ensemble, vérifié. Un trait
  d'un pixel d'épaisseur ne se ronge plus jamais, parce qu'aucun de ses pixels n'a de voisin
  franchement intérieur à qui se comparer. *C'est le cas que l'érosion effaçait en entier : une
  antenne, une lanière, la pointe d'une épée.*
- **La décontamination repeint 9 à 51 % du pourtour** selon l'image, d'un écart moyen de 88 à
  197 niveaux — ce qui dit assez que le défaut était réel. Elle ne touche pas à l'alpha, jamais
  d'une valeur : c'est ce qui la sépare du *matting*, et un bord doux est très exactement ce que
  le durcissement existe pour supprimer.

**Le contour a gagné ses deux régimes, et il manquait un nombre pour ça.** D2 rendait le pas sur
lequel le modèle a peint ; elle ne rendait pas **où la grille commence**. La recherche de phase
existait dans le peigne depuis D2 — elle était jetée aussitôt faite. Sans elle, un trait posé
sur la bonne maille mais au mauvais départ tombe à cheval sur deux blocs, ce qui est la moitié
du défaut qu'on répare.

**Un critère était déjà livré, et il a été vérifié au lieu d'être réécrit** : la couleur du
trait se prend déjà dans la palette du jeu depuis `E5`, pastilles cliquables et marque « hors
palette » comprises. *Une tranche qui réclame du travail livré est la façon la plus chère de
perdre une journée* — c'est écrit dans la tranche elle-même, et c'est la seconde fois qu'elle
l'évite.

### La leçon, et elle est la même que celle de la veille

Trois affirmations sur cinq venaient d'un document non vérifié, et les trois étaient fausses.
La tranche s'était déjà fait prendre une fois — *« nos deux modèles »* pour trois — et l'avait
écrit en tête de sa propre section. **Ça ne l'a pas empêchée de recopier les deux suivantes.**
Ce qui les a trouvées n'est pas une relecture : c'est d'avoir **compté la bonne chose**, et la
bonne chose n'était pas celle que le relevé regardait.

---

## D3 — le fond cesse d'être une phrase enterrée dans le code — 3 septembre 2026

**Le produit demandait *un fond plat* sans dire lequel, depuis le premier jour.** Le modèle
rendait donc un gris clair — c'est-à-dire une couleur que le sujet porte aussi, sur une joue,
une lame, une pierre. De là le découpage à reprendre à la main sur presque chaque image :
le remplissage depuis le bord mange ce qui ressemble au fond, et une joue grise ressemble à un
fond gris.

### Ce que la tranche a coûté, et ce n'est pas ce qui était prévu

**Elle devait coûter un banc de huit tirages par branche.** L'auteur l'a retiré le 2 septembre :
*« pas besoin de tester ça »*. La raison tient — le fond devient un **réglage**, pas une valeur
imposée, et une mauvaise couleur se change en un geste. Ce qui remplace le banc est plus utile
que lui : **deux mesures d'acceptation lues sur les images qu'on voulait de toute façon** — les
pixels de bord à demi transparents, et les pixels du sujet encore à portée de tolérance du fond.
C'est la doctrine du dépôt sur les notes de qualité, appliquée pour la première fois à un
réglage d'**envoi** et non à un modèle.

### Trois choses ont été tranchées en construisant, et aucune n'était écrite

**1 · Le fond ne fabrique pas de ligne à lui dans le texte qui part.** La case `technique`
disait déjà *un fond plat* ; elle dit maintenant lequel. Lui donner une ligne de plus aurait
fait partir la couleur deux fois dans le même appel.

**2 · Mais il a fallu un quatrième écart sur l'écran de confirmation**, à côté des lignes
éteintes, des lignes rallumées et des textes corrigés. La raison est mécanique : le fond
fabrique **deux** textes qui partent dans **deux champs différents** — la phrase de calage et la
phrase d'interdiction. Le corriger en tapant dans la ligne aurait changé l'un sans l'autre, et
l'appel serait parti en demandant du magenta tout en interdisant du cyan, **sans que rien ne le
dise**. C'est le premier réglage de l'écran de confirmation qui ne soit pas du texte.

**3 · Un jeu en dessin a un fond comme les autres.** La phrase de calage ne partait qu'en pixel
art, puisqu'elle porte le calage en carrés. Elle se coupe désormais en deux moitiés, et le fond
part seul quand il n'y a pas de carrés. Sans ça la tranche aurait été muette pour la moitié des
projets — trouvé en relisant `phrase_du_produit`, pas en essayant.

### Ce que la tranche ne coûte pas, et c'est ce qui la rendait facile

**Le champ d'interdiction existait déjà** — `Demande.prompt_negatif`, depuis `T1` —, et les deux
adaptateurs le replient en fin de demande sous *« Do not include: »*. La phrase qui interdit au
modèle d'employer la couleur du fond sur le sujet entre donc dans un mécanisme qui était là,
sans une ligne d'adaptateur. C'est ce que le bilan annonçait, et c'était juste.

### Le seul chiffre qui ne vient pas d'un relevé, et il est écrit comme tel

Le seuil de sûreté d'une couleur candidate est **trois fois la tolérance du détourage**. Une
tolérance parce qu'en dessous la couleur serait mangée avec le fond ; les deux autres paient le
fait que **le modèle ne rend jamais exactement l'hexadécimal demandé**. Cette dérive-là n'est
pas connue — aucune image du dépôt n'a été tirée sur un fond franc —, et c'est la mesure
« pixels encore collés à la couleur de fond » qui la dira sur les premières qui reviendront.
*Le seuil se reposera alors sur ce qu'on aura vu.*

⚠️ **Le prix de la tranche, dit une fois** : elle change ce qui part au fournisseur. Les images
tirées avant ne se comparent plus à celles d'après — pas parce qu'elles sont moins bonnes, mais
parce qu'on n'a plus demandé la même chose. Les 135 notes d'animation restent valables entre
elles, jamais contre un tirage postérieur.

---

## G16 — ce qui est revenu du modèle se voit, et se reprend à la main — 3 septembre 2026

**La remarque disait trois choses, et elle n'en disait qu'une.** *« Je ne peux pas voir
l'image générée […] et le brut semble prendre souvent le calque déjà découpé. »* Trois
manques distincts — voir la feuille payée, refaire le calage à la main, et un mot qui
désigne deux choses — mais un seul fait dessous : **il n'existait aucune façon de nommer
la case telle qu'elle était arrivée**. Les trois tombent avec elle.

**Le mot *brut* désignait deux images, et personne ne l'avait remarqué.** Mesuré sur
l'atelier jetable, pour une même case d'une même planche : la case **arrivée** fait
512×512, entièrement opaque, et porte le fond du modèle, le corps et la pièce ; le **brut
rangé** fait 64×64 et 2 118 pixels opaques — déjà remis à l'échelle, recalé et détouré ;
le **rendu** en garde 363, la pièce seule. Trois images, deux sens du mot. `_accueillir`
l'écrivait depuis C3 en toutes lettres — *« son brut est la case ramenée dans le cadre du
corps »* — et aucun écran ne le disait.

**Presque rien n'a été construit, et c'est la marque de la famille ②.** L'adresse qui sert
la feuille existait depuis T1 ; le recalcul d'une case à partir d'elle existait depuis R5,
dans le rejeu du recalage ; une image sans recette s'affichait déjà par l'adresse de son
emplacement. La tranche a posé **des portes** : un asset pour la feuille, une adresse pour
la case arrivée, un drapeau sur la superposition, deux boutons.

**L'invariant renversé était prévu, et il a coûté ce qu'il annonçait.** *Le pliage est une
ruse d'appel, jamais un format de livraison* (C2) tombe ici plutôt qu'en `P1`. Neuf essais
le disaient et disent maintenant l'autre — et l'un d'eux, en tombant, a trouvé la seule
chose que le renversement cassait vraiment : **au rattrapage du démarrage, une planche qui
attend encore un choix serait entrée en bibliothèque**, contre la règle de `R6`. Le refus
manquait ; il est écrit, mot pour mot comme celui de la reprise, juste à côté.

**Ce que la feuille est, décidé à un seul endroit.** Trois chemins la font entrer — le
dépliage des corps, celui d'un équipement, le rattrapage —, et trois constructions écrites
à trois endroits auraient fini par donner trois images différentes : l'une avec son coût,
l'autre sans, la troisième avec une recette de projet qui l'aurait mise sur grille. Elle
est donc construite dans `atelier/domaine/planche.py`, et nulle part ailleurs.

**Trois décisions qui l'empêchent d'être un sprite** : recette **vide** — donc ni grille,
ni réduction de couleurs, ni détourage —, **aucune pose** — donc invisible pour la matrice,
qui saute ce qui n'en a pas —, et **le coût de l'appel sur elle**, zéro sur ses morceaux.
Vérifié : quatre cases pleines, une image chacune, la feuille dans aucune.

**Un hasard heureux dans les rangs.** `premier_rang_libre` réservait déjà les rangs des
emplacements depuis C2 — la feuille avait donc son rang libre, et rien n'a eu à bouger.

**Ce que la tranche laisse ouvert, et qu'il vaut mieux écrire.** Supprimer la feuille depuis
la galerie efface son fichier, et le recalage comme la case arrivée refusent alors avec leur
raison — proprement, mais l'auteur ne sait pas ce qu'il perd au moment où il supprime. C'est
exactement le critère de `P1` — *supprimer la planche demande confirmation et dit combien
d'images en dépendent* —, et il reste chez elle.

**Et un effet de bord qui se voit à l'écran, déjà prévu par le produit.** Partir de la case
arrivée, c'est partir d'une image **avec son fond** : le premier aperçu annonce 117 % de part
ajoutée. L'alerte *« sans alpha sur le dessus, le calque prendrait tout le fond »* était là
depuis E6, avec son bouton — *reprendre les passes du dessous* —, et un clic ramène l'ajout à
40 %. Rien à construire ; il fallait juste que ce chemin devienne le chemin ordinaire.

**Ce que ça coûte :** rien au fournisseur, et c'est vérifié par le compte d'appels — regarder
la feuille, regarder la case arrivée, refaire le calage et fabriquer ne touchent personne.
Douze essais neufs, dix essais anciens réécrits pour dire le nouvel invariant. Vérifié au
navigateur sur un atelier jetable, port 8423 : la bascule, le bouton, la table préremplie sur
les deux bonnes images, et le second vêtement qui arrive dans la même case avec le premier
intact.

## R9 — un outil qui ne disait pas ce qu'il réparait — 3 septembre 2026

**L'écran ouvrait sur un décompte et proposait un verbe.** *« 6 poses · 5 calées »*,
puis un bouton marqué *« Calibrer les 5 poses »*. Rien ne disait ce qui n'allait pas,
rien ne disait ce qu'on obtiendrait — et l'explication de l'outil, écrite le 30 août
2026, complète et juste, **n'était citée par aucun composant** : elle n'était donc
lisible nulle part. Six jours d'un texte parfait rangé dans un tiroir.

**Le principe qui a tenu la tranche** : *un outil montre le défaut qu'il répare avant
de proposer de le réparer*. Il est monté dans `docs/design-motifs.md`, avec l'ordre
qui le fait — ce qu'il répare, ce que le geste donnerait, puis le geste.

**Le critère du plan était faux à moitié, et la moitié fausse était la plus
intéressante.** Il disait « il reste allumé aujourd'hui ». Le bouton s'éteignait bien,
mais uniquement dans le cas dégénéré — aucune pose avec un corps, ou toutes mises de
côté — et **muet** : l'écran montrait alors *« Calibrer les 0 poses »* en gris, le
paragraphe explicatif disparaissait avec lui, et rien ne disait pourquoi. Ce que la
tranche a posé n'est donc pas une extinction, c'est **un compte** et trois raisons.

**Un défaut trouvé, montré, et délibérément pas corrigé.** L'occupation calibrée
traverse deux fonctions qui la bornent chacune, et pas au même endroit :
`_occupation` à l'échelle déclarée par l'ensemble — jusqu'à 300 % —, `_poser` à
100 %. Un géant déclaré tel voit son calibrage écrasé au tiers. **Personne ne compare
une borne d'entrée à une borne de sortie**, et tant que la valeur ne sortait pas du
service, l'écart ne se voyait pas ; il est devenu visible le jour où l'écran a dû
dessiner l'après. Le réparer changerait ce que l'outil écrit, ce que le dernier
critère interdit noir sur blanc — le service rend donc la valeur *réellement* écrite,
l'écran dessine ce qu'on obtiendra, et le piège est consigné.

**Et le défaut est mesuré sur la chose qu'on a sous les yeux.** La maquette citait les
six hauteurs du vrai projet ; les compter sur les poses de la chose ouverte dit la
même chose et ne peut pas devenir faux. C'est `G1` appliqué avant d'avoir eu à le
payer une treizième fois.

**Le navigateur a confirmé l'empilement d'après, et corrigé un chiffre.** Sur l'atelier
jetable, `repos` est bien agrandi de `scale(0.4375)` autour de son bas et retombe à 28 px
réels, la ligne dorée est à sa place, et une pose déjà à la hauteur commune ne porte
aucune transformation. Ce qui était faux tenait en un mot : le sous-titre disait
« 4 hauteurs différentes » sous quatre poses dont deux sortent à la même hauteur. Il
compte maintenant les hauteurs **distinctes** — `G1` pris avant qu'il ne coûte.

**Ce que ça coûte :** rien en usage, rien au fournisseur. Huit essais serveur, douze
côté écran, cinq repris — et **aucun essai de `E17` n'a bougé** : la tranche ajoute
deux chiffres par pose, elle n'en révise aucun, et un essai de `R9` répète les valeurs
de `E17` pour qu'une révision furtive se voie.

## R8 — un écran plein de texte pour une chose qui n'existe qu'en images — 3 septembre 2026

**Le défaut était mécanique, pas esthétique, et c'est ce qui rendait la tranche courte.** Le
produit possède deux systèmes faits exactement pour ce que la fiche d'une chose ne faisait
pas : l'explication au survol, adossée à un recueil unique qui alimente aussi le guide, et la
vignette, qui montre une image en petit et l'ouvre en grand à la barre d'espace. **La fiche
n'employait ni l'un ni l'autre** — le recueil comptait 123 entrées et **zéro** pour cet
écran, et l'écran d'une chose qui possède des images n'en montrait aucune. On retenait ou
l'on retirait une image de référence en lisant deux mots.

**Le troisième rendu du corpus est la vraie décision de la tranche.** Écrire une phrase à
demeure sous un titre de section semblait ajouter un rendu à un corpus qui n'en avait que
deux. Le comptage du code a montré que la question était mal posée : le produit écrit déjà
**74 lignes explicatives en dur dans dix-sept écrans**, dont treize sur quinze relues
expliquent un réglage sans rien refuser. La règle n'a jamais interdit d'écrire une phrase à
l'écran — elle interdit de **recopier** le corpus dans un second fichier. La ligne est donc
*lue* dans le recueil, et corriger l'entrée corrige les trois affichages.

**Deux critères du plan étaient faux, et les deux le sont restés dans le plan.**
« Cinq entrées » : la maquette en annonçait cinq au récapitulatif et en rédigeait six au
détail — la matrice de droite est un sixième titre à l'écran, et un titre sans entrée aurait
été le seul sans bulle, sans propos et absent du guide. « Écrit trois fois » : le compte des
cases paraissait à trois endroits **et deux des trois ne comptaient pas pareil** — l'un sur
toutes les cases du plan, rangées comprises, l'autre sur les seules poses tenues, si bien
qu'une chose à deux poses rangées se lisait « sur 6 » à gauche et « sur 4 » à droite. Le
dessin validé garde les trois lieux, qui répondent à trois questions ; ce qui disparaît est
le **quatrième**, le très gros chiffre à empattements. Ce qui est tenu est **un seul calcul**.

*Les deux phrases de critère n'ont pas été réécrites pour coller au résultat — elles portent
un renvoi vers l'arbitrage. Un critère retouché après coup ne mesure plus rien.*

**Deux règles d'apparence enfreintes, trouvées en dessinant.** Une mesure écrite en serif de
32 px, alors que `docs/DESIGN.md` dit *toute mesure est en mono, partout* ; et le nom d'un
champ de style écrit dans le gris réservé à ce que quelque chose d'autre redit — or rien ne
redit le nom d'un champ. Les deux corrections sont montées dans `docs/DESIGN.md`, à côté des
trois enfreintes déjà consignées : c'est la troisième fois que la même règle de couleur est
prise en défaut par la même question — *qu'est-ce qui redit ceci ailleurs ?*

**Et les deux vrais défauts sont sortis du navigateur, pas des essais.** Montée sur un
atelier jetable, la fiche a montré que **le sommaire ne suivait pas le défilement du tout** :
elle employait un `IntersectionObserver`, et un guetteur ne livre rien à un onglet qui ne
compose pas ses images — **exactement le piège consigné neuf jours plus tôt sur
`ResizeObserver`**, payé une seconde fois parce que l'entrée nommait le composant et non la
famille. La correction suivante — inverser le tri — était fausse aussi, et les mesures l'ont
dit : la bande du haut fait 316 px quand une section en fait 797, trois se croisent à la
fois, et aucun sens de tri ne désigne celle qu'on lit. Le second défaut était plus simple :
**deux titres du sommaire se coupaient**, alors que la tranche existait pour réparer un
résumé coupé.

**Ce que ça coûte :** rien en usage, et rien au fournisseur. Quatre essais serveur, dix côté
écran, plus huit clics d'onglet **retirés** d'essais existants — ils ouvraient des parties
que la fiche montre désormais sans rien ouvrir.

## R7 — un rangement construit contre une mesure qui disait non — 3 septembre 2026

**La tranche avait été close avant d'être construite, et sur un chiffre.** Cinq variantes du
texte qui part, tirées à images égales le 2 septembre avec un témoin neuf : **aucune ne
passe**, et le pavé du produit les bat toutes — 0 sur 4 pour les trois titres, contre 2 sur 4
pour le témoin. La règle écrite d'avance disait *au moins la moitié de bonnes, sinon on
n'insiste pas*.

**Elle a été rouverte par décision de l'auteur, en connaissance du chiffre, et pour la
relisibilité seule.** Aucun gain de taux n'est promis — ni dans le plan, ni dans le dossier
de tranche, ni dans l'entrée que l'auteur lit à l'écran. C'est la première tranche du dépôt
dans ce cas, et l'encadré qui la disait close **reste** dans le plan, corrigé et non effacé :
une tranche qu'on rouvre contre une mesure doit garder la mesure sous les yeux.

**Le banc a servi de source, pas de modèle à réécrire.** Les deux variantes reprises sont
recopiées **mot pour mot** de `essais/socle_essais.py`, et un essai le vérifie à chaque
exécution. La raison est comptable : un tirage futur doit mesurer la même chose que celui
qui a déjà été payé, et un texte voisin rendrait les $0,25 du 2 septembre inutilisables.

**La caméra ne bouge pas, et c'est ce qui rendait la tranche faisable.** Un banc payé de
trente images a établi que le rapport hauteur/largeur du sujet passe de **1,55 à 1,13** quand
la caméra ferme le texte : un modèle d'image pondère la fin. La caméra appartient à la
*demande*, qui est la troisième partie et dont elle est la dernière ligne — ranger ne l'a
donc pas déplacée. Le seul déplacement est le bloc des références, qui remonte de
l'avant-dernier rang au deuxième, et c'est exactement le déplacement que le banc a tiré.

**Trois défauts trouvés en construisant, et réparés.** Deux groupes de l'écran de
confirmation s'affichaient **sans titre depuis le 1ᵉʳ septembre**, nés le jour même — un
titre absent ne laisse pas un trou, il laisse un blanc. Le texte annonçait au modèle **une
bande de couleurs qui ne partait pas** dès que la case était cochée : une entorse à `E14`
que seul le modèle aurait pu remarquer. Et la liste des dépenses allait devenir illisible,
toutes ses lignes commençant par `CONTEXT` — elles écrivent maintenant le **sujet**, ce qui
les rend distinctes pour la première fois.

## G1 — douze phrases justes le jour de leur écriture, et fausses depuis — 3 septembre 2026

**Aucune n'était une approximation, et c'est tout le sujet.** Toutes ont été mesurées ou
vérifiées le jour où elles ont été écrites, par quelqu'un d'attentif, et toutes ont été
démenties par un changement venu d'ailleurs — la plus ancienne a tenu sept jours, la plus
récente deux. Un écran qui ment sans le savoir coûte deux fois : à l'usage d'abord, à la
confiance ensuite, parce qu'une phrase prise en défaut emmène les suivantes avec elle.

### Elles étaient neuf au plan, elles étaient douze

Les trois de plus sont tombées dans le même filet en corrigeant les autres : *« les huit vues
en cartes, les neuf tailles à leur vraie échelle, les huit types côte à côte »* — une seule
ligne, trois comptes, et le produit porte aujourd'hui **dix** tailles. Elles sont **retirées**
et non remesurées : ce que la phrase dit ne dépend d'aucun des trois.

### Les numéros d'étape, et pourquoi ils se sont tous décalés le même jour

Ils étaient huit, écrits à la main, et l'insertion de l'étape du style les a **tous** décalés
d'un cran sans qu'une seule erreur ne se lève : *« l'étape 2 »* désignait une étape devenue la
troisième, ce qui est exact au caractère près et simplement faux. Cinq commentaires du code
citaient même *« l'étape 10 »* pour la douzième — décalés de deux crans, par `D1` puis par `D2`.

Ils se désignent maintenant par leur **nom d'abord**, le rang ensuite : c'est le nom qu'on
retrouve dans la colonne de gauche, qui n'affiche que des noms. Le nom suit le style, puisque la
quatrième étape en porte deux depuis `D2`.

### Deux chiffres remesurés, deux chiffres retirés

| la phrase | ce qu'elle disait | ce qui est écrit maintenant |
|---|---|---|
| la lecture de palette | *« une centaine de millisecondes »* | **6 ms à 1,2 s, 360 ms en médiane** — sur les 92 cartes du dépôt |
| le fond écarté d'un artwork | *« 100 % … le reste — le fond — est écarté »* | deux phrases selon qu'il reste quelque chose : **3 des 10 artworks officiels sont lus à 100,0 %** |
| le poids de l'univers dans le prompt | *« plus de la moitié du texte »* | **retiré** — un rapport entre deux textes qui bougent chacun de leur côté |
| la hauteur du menu d'une carte | *« il fait 300 px pour une carte 1× qui en fait 190 »* | **retiré** — ce qui décide la règle est le rapport, pas les valeurs |

Et le seuil de 100 % a montré un défaut de plus, trouvé en écrivant la phrase : la case *« me le
montrer sur l'image »* et le renvoi *« découper le montre en magenta »* s'offraient sur une carte
où le magenta ne couvre aucun pixel. **Une case qui ne change pas l'image est pire qu'une case
absente** — on la coche deux fois avant de conclure qu'elle est cassée.

### Le garde-fou est là où il ne coûte rien, et nulle part ailleurs

La règle générale — *un nombre affiché se calcule, ou il ne s'affiche pas* — reste écartée : c'est
la décision de l'auteur, et le risque est écrit dans le plan plutôt que découvert plus tard.
**Un seul essai la fige, sur la seule famille où le calcul est gratuit** : les numéros d'étape.
Il est **sans exception**, et c'est ce qui l'a rendu utilisable — une première écriture tolérait
les lignes portant `G1`, c'est-à-dire une règle à deux étages dont le second demandait de savoir
qu'il existe. Les deux commentaires concernés disent maintenant *« la deuxième »* en toutes
lettres.

## D2, seconde moitié — le pas est retrouvé, et surtout la détection sait se taire — 3 septembre 2026

**Le plus vieux défaut du produit avait deux moitiés, et c'est la seconde qui manquait.** Un
modèle rend une image de mille pixels « à l'allure pixel art » ; parfois elle porte vraiment
des carrés, parfois c'est une peinture. Le produit ne savait pas dire dans lequel des deux cas
il se trouvait — et sa mesure de grille, `mesurer_grille`, répondait **2 avec une netteté de
0,94 sur une peinture**. Faux, et confiant : le pire des deux états.

### La pièce qui manquait s'appelle le peigne

L'autocorrélation d'une image lisse décroît doucement depuis le pas 2 sans jamais faire de
bosse ; la règle du produit — *le plus petit pas qui approche la crête* — attrapait alors ce 2,
parce qu'il n'a pas de voisin de gauche à qui se comparer. **Le peigne demande autre chose** :
que le contraste tombe sur les *multiples* du pas, et pas n'importe où. Sur une grille il y est
presque tout ; sur une peinture il est partout.

Mesuré sur les 149 images brutes du dépôt : **0,40 au plus bas quand la détection annonce un
pas, 0,35 au plus haut quand elle se tait.** Le seuil est posé exactement dans ce vide, et rien
ne le franchit par accident.

### Le taux, sur un lot bâti à partir de vraies images du dépôt

Aucune image du dépôt ne vient avec son pas écrit à côté, et personne ne le lit à l'œil sans se
tromper. Le banc de réception (`essais/essai_grille_produit.py`, gratuit) fabrique donc la
vérité : douze vrais dessins du dépôt, pris dans les six jeux, ramenés à quarante cases par la
réduction du produit puis reposés sur une grille de pas connu — nets, flous, décalés, et à pas
non entier, qui est le cas réel.

| | |
|---|---|
| **200 sur 204, soit 98 %** | exacts, sur la plage que le dépôt produit (2 à 32 px) |
| 0 erreur d'octave, 0 franc raté | les quatre écarts sont des **renoncements**, tous sur un pas de 9,4 px |
| 12 cas posés **hors borne** | 12 renoncements — aucun pas faux annoncé avec assurance |

Et sur les images brutes, où aucune vérité n'existe, la séparation suit les jeux : le jeu du
marais, qui a reçu des carrés, fait **annoncer 26 fois sur 27** ; *cœur de pierre*, qui a reçu
des peintures alors que sa bible réclamait mot pour mot *« strict 64x64 px tile snap »*, fait
**renoncer 24 fois sur 26**.

### Trois chiffres circulaient pour la borne, aucun n'était bon

Le plan visait **80 px** — un chiffre jamais relevé, qui ressemble à 5 × 16 plus qu'à une
mesure. Les détecteurs de référence s'arrêtent à **24** et *coupent* le dépôt : le jeu des
vignettes monte à 32. La mesure d'avant balayait jusqu'à **64**, deux fois plus large que ce
que le dépôt produit. La borne est donc **32 px**, le plus grossier pas trouvé sur les
149 images ; 99 % tiennent sous 22.

> ⚠️ **Une affirmation héritée n'est pas reproduite, et c'est écrit plutôt que tu.** Le plan et
> le bilan disent tous deux que *relever la borne fait perdre de la finesse*. Cet effet
> n'apparaît pas : à 64 la réussite est exactement celle de 32, et sur les images brutes la
> borne ne change **rien du tout** — 61 annonces, de 24 à 128. La raison est mécanique : le pas
> retenu est le *plus petit* qualifié, donc élargir la recherche ne lui donne pas d'occasion de
> se tromper. Ce qui décide n'est pas ce qu'une grande borne coûterait, c'est ce qu'une petite
> borne **coupe** — douze cas de plus renoncés à 24.

### Ce qui a été mesuré puis écarté

**L'arbitre d'aller-retour** — réduire au pas candidat, réagrandir, regarder ce qui a changé —
est l'idée qui vient d'instinct, et elle **abîme** le détecteur : 170 cas justes sur 204 contre
200 sans lui, et **30 erreurs d'octave qu'il fabrique lui-même**. La raison est mécanique : sur
une image floue à pas 13,1, la reconstruction au pas 13 est imparfaite tandis que celle au pas
2 est presque parfaite — des blocs de deux pixels sont uniformes dans n'importe quelle image
lisse. L'arbitre choisit petit **pour la mauvaise raison**.

**Additionner les canaux plutôt que de convertir en gris** est le second résultat
contre-intuitif du banc d'étude, et la mesure de réception le nuance : sur des images pleines
l'écart est d'**un cas sur 204**. Ce qui décide est ailleurs, et c'est franc — un sprite
détouré d'une seule teinte porte toute sa grille dans sa silhouette, le gris jette l'alpha en
entrant, et il répond **2 à tous les coups**.

### Ce que l'écran montre, et ce qu'il ne pose pas

Une ligne au-dessus du réglage de taille : *« le modèle a peint des carrés de 8 pixels :
l'image en compte 48 de côté, et au-delà il n'y a plus de détail à récupérer »*. Le pas seul ne
servirait à rien — la taille se règle en carrés, jamais en pixels de l'image reçue.

Quand la détection renonce, elle le dit avec ses mots, et **les crans de taille restent là** :
c'est alors l'auteur qui la pose, ce qu'il faisait déjà et ce qui ne change pas. La cible est
demandée, jamais déduite de l'image reçue (US-61) ; ce que la tranche ajoute est qu'elle cesse
de se choisir à l'aveugle.

### Un défaut réparé en passant

La dérive de grille d'une planche — le rapport du pas le plus grossier au plus fin — se
calculait sur des faux positifs : une case peinte sans grille répondait 2, et ce 2 entrait dans
le calcul. La revue externe le nommait. Une case sans grille rend maintenant zéro, l'écran
l'affiche « — » comme il le faisait déjà, et la mesure ne réencode plus chaque case en PNG pour
la redécoder aussitôt — vingt-quatre allers-retours par planche, pour rien.

## D5 — rien ne pouvait être plus grand qu'un personnage, et c'était une famille d'assets entière — 3 septembre 2026

**Le réglage d'échelle ne savait dire que *plus petit*.** Chaque image revenait dans une case carrée
du même côté, et l'échelle disait quelle part de cette case le sujet remplit : un personnage 100 %,
un meuble 66 %, un objet tenu 40 %. Le plafond était donc le personnage, et il était écrit **en douze
endroits**, comptés — trois corps de route, deux refus de service, un calcul d'image, trois du
calibrage, la liste des positions du curseur, et les deux curseurs d'écran. Un moulin, un arbre, une tour, une porte de ville : le produit n'avait
aucune façon de les demander.

Le modèle était **juste vers le bas** — c'est bien ainsi qu'un objet tenu en main se dessine — et
faux vers le haut, où il n'allait pas.

### La règle des vrais jeux 2D a dessiné la réparation

**Le carré ne change jamais de taille.** Ce qui change entre un personnage et un bâtiment est le
*nombre* de carrés qu'il couvre, jamais leur dimension : un personnage fait 32 carrés de haut, une
maison en fait 96. Agrandir les carrés pour les gros objets est l'erreur classique et elle porte un
nom — des **« mixels »** —, parce que deux tailles de pixel dans une même image se voient
immédiatement : l'œil compare les bords. Les moteurs le confirment, et c'est le point qui tranche :
la résolution de base, la taille de tuile et le filtrage n'ont **aucune variante « pour les gros
objets »**. La taille de tuile est une propriété du jeu, pas de l'objet.

### Donc l'occupation reste, et c'est son plafond qui tombe

Elle disait déjà la bonne chose — une hauteur relative au personnage —, et 300 % se lit *trois
personnages*. **Rien ne se convertit, aucun fichier ne se réécrit**, et tout ce qui est à 100 % ou
en dessous rend exactement l'image d'avant : c'est le premier critère de la tranche, et le plus
important, puisque le dépôt a des centaines d'images déjà traitées et qu'une image retraitée ne se
compare à rien.

| ce qu'on déclare | ce qui revient |
|---|---|
| 40 % — un objet tenu | 26 carrés dans une image de 64 · inchangé |
| 100 % — un personnage | 64 carrés, l'image entière · inchangé |
| **300 % — un bâtiment** | **une image de 192 carrés · impossible avant** |
| 800 % — le plafond | une image de 512 carrés, huit personnages |

### La forme du fichier, laissée au produit par l'auteur

Ses mots : *« choisis ce qui est le mieux et compatible avec godot »*. C'est une **boîte carrée dont
le côté suit la hauteur déclarée**. Trois raisons, et la troisième est la plus lourde : un moteur la
pose telle quelle ; son côté reste un multiple entier de la case du projet, donc elle tombe aussi
sur une grille de tuiles ; et les images d'une même animation **continuent de se superposer au
pixel**. Un fichier taillé au ras du sujet aurait été plus léger et aurait fait perdre cette
superposition — qui est très exactement le défaut que la tranche d'animation doit réparer.

### Deux bornes, et l'une d'elles a été trouvée par un essai qui échouait

Le plafond est la plus basse de deux bornes. **Celle du métier — huit personnages** : un bâtiment de
trois étages en fait quatre à cinq, un grand arbre cinq à six, une porte de ville six à huit ;
au-delà on fabrique un fond, et un fond est un décor qui ignore la case. **Celle de la machine — un
canevas de 2048 carrés**, le plus grand nombre que le produit connaisse déjà.

La première n'était pas prévue. Sans elle, une case de 16 carrés autorisait 12 800 % — cent
vingt-huit personnages, physiquement possible et jamais utile — et le curseur y gagnait **deux mille
positions**. C'est l'essai des crans, écrit en E3, qui l'a dit en échouant : une case plus fine
rendait moins de crans qu'une grossière, l'inverse de ce qu'il affirme depuis.

### Ce que l'auteur a demandé pour l'écran, et pourquoi c'est plus qu'un habillage

*« Les deux, avec un rappel visuel, une sorte d'échantillon »*. Un nombre de carrés est ce que
réclament les moteurs de jeu et les outils de dessin ; un nombre de personnages est ce qui se lit
quand on décrit un monde. L'écran dit les deux et **dessine** le rapport : le cadre de l'échantillon
*est* le fichier qui reviendra, et un trait pointillé y marque la hauteur d'un personnage — au tiers
du cadre pour un bâtiment de trois.

Le dessin d'avant plafonnait à la case, et c'est ce qui le rendait faux : **une barre dans un carré
ne peut jamais dépasser le carré**, donc il montrait très exactement la limite qu'on venait de
lever.

### Ce que la tranche a appris

- **Une borne qu'on lève peut être porteuse ailleurs.** Le calibrage s'appuyait sur le plafond de
  100 % sans le dire : l'inverse d'un arrondi dépasse volontiers d'un pour cent, et sans borne le
  calibrage d'un personnage ordinaire écrivait 101 % — ses images sortaient en 65 carrés au lieu de
  64. Un demi-pixel d'arrondi faisait sortir tout le monde de la case.
- **Une limite physique n'est pas une limite utile.** 12 800 % était possible et absurde. Il fallait
  une seconde borne, tirée du métier et non de la machine.
- **Un dessin qui ne peut pas montrer un défaut le cache.** L'échantillon d'avant était une barre
  dans un carré : il ne *pouvait pas* dessiner un moulin plus haut qu'un personnage, donc il rendait
  la limite invisible au moment même où on la subissait.
- **Un essai qui échoue pour la bonne raison vaut une mesure.** Deux des trois trouvailles de cette
  tranche viennent d'essais existants qui ont cessé de passer — pas d'une relecture.

### Ce qui reste ouvert

La **largeur**. Un sujet déclare sa hauteur, et sa largeur suit ses propres proportions dans une
boîte carrée : un mur trois fois plus large que haut y laisse du vide de part et d'autre. Aucune
image du dépôt n'est dans ce cas, et l'ouvrir demanderait une seconde question à chaque type — on
attend qu'un vrai sujet la réclame.

## D2, première moitié — la réduction devient un choix, le style graphique devient une question, et un réglage qui ne faisait rien depuis T4 se met à agir — 3 septembre 2026

**La tranche s'est coupée en deux, et la mesure a dessiné la coupure.** D2 promettait deux choses :
retrouver la grille d'une image qui en porte déjà une, et réduire sans bouillie. La première moitié
livrée est la **réduction** ; la détection reste.

Ce n'est pas un renoncement. Le banc est parti de deux illustrations que l'auteur a fournies, et
elles n'ont **aucune grille à retrouver** — ce sont des peintures. Le chemin qu'elles demandent est
celui que la revue externe appelle *pipeline B* : convertir. Livrer la détection d'abord aurait été
livrer la moitié qui ne sert à aucune des images qu'on avait sous la main.

### Ce que le banc a montré, et pourquoi il y a quatre méthodes et non une

Quatre façons de passer de 1254 pixels à N carrés, **toutes ramenées au même nombre de couleurs**
pour que la comparaison porte sur la seule réduction :

| méthode | ce qu'elle rend |
|---|---|
| **vote en deux temps** | contour net **et** intérieur lisible — un sprite calme |
| **traits épaissis** (PixelOE) | garde les traits d'un pixel — la hampe d'une lance reste entière —, contour plus agité |
| **réduction douce** (Lanczos) | la silhouette la plus lisse, l'intérieur mou : un dessin réduit, pas un sprite |
| **au plus proche** | ce que l'atelier faisait : un pixel sur N gardé, les autres jetés sans être regardés |

**Aucune ne gagne, et c'est le résultat.** L'auteur a tranché : *« clairement les 4 ont des rendus
différents avec leurs avantages et inconvénients et peuvent influencer le style souhaité par le
créateur »*. Les quatre restent donc vivantes — choisies au projet, changeables **image par image
en cours de route** —, avec le vote en deux temps pour défaut.

Ce que l'atelier faisait jusque-là était le pire des quatre, et personne ne l'avait choisi : la
réduction au plus proche voisin était écrite dans le code, sans réglage. Sur un dessin fin, un trait
d'un pixel de large avait une chance sur N de survivre. **C'était un tirage au sort qui se faisait
passer pour une méthode.**

### Le défaut trouvé en chemin était plus gros que la tranche

La quantification n'entrait dans une recette **que s'il existait une palette**, et la palette se
déduit des artworks officiels. Un projet sans artwork ne réduisait donc **aucune couleur** : mesuré,
un personnage ramené à 64 carrés sortait à **905 couleurs**. Le réglage `Univers.couleurs` existait
depuis T4, se réglait, s'enregistrait — et ne faisait rien.

Trois choses le maintenaient en place, et chacune paraissait raisonnable seule :

1. `recette_de` ne **posait** pas la quantification sans palette ;
2. le service la **refusait** si on l'écrivait à la main ;
3. l'écran **cachait** le réglage dans ce cas — donc ne montrait même pas ce qui manquait.

Et trois essais figeaient la règle, dont un nommé *reste refusée*. **Un essai qui fige une absence
de comportement protège la panne si personne n'écrit pourquoi.** Les trois ont été réécrits à
l'envers, avec la raison dans le corps du test.

Le pivot est ailleurs qu'on l'aurait cru : ce qui commande la quantification n'est pas la palette,
c'est **la taille de case** — c'est-à-dire le fait même de faire du pixel art. Un nombre fini de
couleurs *est* ce qui distingue un sprite d'une image rétrécie. Sans taille imposée — un jeu en
dessin — les couleurs ne sont plus touchées, parce que les réduire transformerait le dessin en
affiche sérigraphiée.

### Le plafond des couleurs est mesuré, pas décrété

Six paliers tranchés par l'auteur — **8 · 16 · 32 · 64 · 128 · 256** —, *« avec le max bloqué au
nombre de pixel »*. Le plafond retenu est **le côté du sprite**, et il tombe sur la mesure à chaque
taille : le sujet occupe environ 27 % de la toile, et au-delà du côté l'image ne contient plus assez
de teintes distinctes pour remplir la palette demandée — 32 carrés rendent 30 couleurs quand on en
demande 32, et 229 quand on en demande 256.

**Le banc s'est trompé avant de se corriger, et ça vaut d'être écrit.** Jugé sur une image non
détourée — à la demande de l'auteur, pour isoler la pixelisation —, le fond uni occupait **73 % des
pixels** et raflait la majorité de la palette : à 8 couleurs demandées, 5 partaient au fond et il en
restait **3** pour le personnage. On allait écarter des paliers parfaitement utilisables sur la foi
d'une bouillie que le produit ne fabrique jamais, puisqu'il détoure avant de quantifier. Palette
comptée sur le sujet seul, **8 couleurs suffisent déjà** à 64 carrés.

### Le style graphique — la décision la plus lourde du jeu se prenait par accident

Elle n'était pas au programme, et elle est sortie de la question des couleurs. En cherchant quand
réduire les couleurs, une chose est apparue : *ne pas réduire les couleurs* et *ne pas faire de pixel
art* sont **la même décision**, et le produit ne la posait nulle part. Elle se **déduisait** de la
neuvième valeur d'une liste de tailles, trois étapes plus loin, dont le libellé disait *ce jeu n'est
pas en pixel art*. On choisissait une taille, et on décidait sans le savoir de tout le reste.

Le style est donc devenu la **deuxième** question du jeu, juste après le nom, et il se choisit en
image — la demande de l'auteur : *« on propose le choix du style de jeu ici et on met une image
cliquable pour chaque style »*. Les deux vignettes sont **le même personnage**, passé par la chaîne
du produit lui-même : ce qu'on compare en cliquant est bien ce que l'atelier rendra.

Une fois posé, il commande trois choses que l'auteur ne réglait pas séparément :

| | en pixel art | en dessin |
|---|---|---|
| ce que la taille veut dire | **combien de carrés** de côté — 8 à 512 | **combien de détail** — 256 à 2048 |
| les couleurs | réduites au palier choisi | gardées : un dessin a ses nuances |
| ce qui part au modèle | *2D pixel art on a 64x64 grid*, et le calage | rien de tout cela |

**La troisième ligne était un dégât, pas une élégance.** Un jeu en dessin qui gardait une finesse de
1024 envoyait au modèle *2D pixel art on a 1024x1024 grid* — le contraire mot pour mot de ce que
l'auteur avait choisi, sur la case qui décide de l'allure. Le défaut n'était pas atteignable avant
que le style existe : « aucune taille » était la seule façon de dire « pas de pixel art », et elle
vidait les deux phrases par le même geste.

**Changer d'avis ne casse rien**, et c'est la règle de D1 réemployée — *on ne réécrit que ce que
personne n'a choisi*. Passer en dessin ramène la taille dans la nouvelle liste et pose la réduction
douce **seulement si** la méthode était encore le défaut d'avant ; une méthode choisie à la main
survit à la bascule. Et les projets d'avant se relisent sans qu'un fichier soit réécrit : sans champ
`style`, il se déduit de la taille, exactement comme le produit le déduisait déjà.

**Deux défauts sont nés du style lui-même, et tous deux étaient muets.** L'étape des tailles a pris
un second titre — *La finesse* en dessin —, et le rang d'une étape se retrouve par son titre : elle
est devenue introuvable dans sa propre liste, s'est affichée **sans sa ligne « étape 4 · le jeu »**,
seule des douze, tandis que la colonne de gauche continuait d'afficher l'ancien nom. Deux noms pour
une étape, à 240 px l'un de l'autre. Et l'annonce écrite la veille pour l'absence d'artwork —
*« les couleurs se déduisent de chaque image »* — est restée affichée en dessin, où **rien ne se
déduit** : une phrase exacte devenue fausse sans changer d'un mot, trois lignes au-dessus de celle
qui dit le contraire. Les deux sont corrigés et tenus par des essais.

### Ce que la tranche a appris

- **Une étape du traitement qui ne s'exécute jamais ne se voit nulle part.** Un réglage qu'on peut
  poser et qui n'agit pas est pire qu'un réglage absent : l'auteur croit avoir réglé quelque chose.
- **Une bibliothèque « légère » peut tirer un moteur lourd par son seul import.** `pixeloe.legacy`
  s'annonce NumPy/OpenCV et charge `torch`. La disponibilité se cherche donc avec `find_spec`, qui
  ne charge rien — exactement comme `rembg` deux ans plus tôt.
- **Une option qui porte le bon nom peut faire le contraire de ce qu'elle annonce.** Le `colors=32`
  de PixelOE rendait 470 couleurs : il quantifie, puis rappelle un étalonnage qui défait tout.
- **Un banc qui isole une variable peut en fausser une autre**, et fabriquer un pire cas que le
  produit ne produira jamais.
- **Donner un second nom à une chose qu'on retrouve par son nom est un changement de clé.**
  L'étape des tailles a perdu son numéro le jour où elle a pu s'appeler autrement — sans erreur,
  sans message, et le garde-fou a fait exactement ce pour quoi il était là.
- **Une phrase exacte dans un mode devient un mensonge dans l'autre.** Quand un réglage ouvre un
  mode où une mécanique s'éteint, il faut relire les phrases qui décrivent cette mécanique — pas
  seulement le code qui l'exécute.

### Ce qui reste, et ce qui suit

**Rien ne reste : la seconde moitié est livrée le même jour**, et elle a son entrée en tête de ce
journal — *le pas est retrouvé, et surtout la détection sait se taire*. Ce paragraphe disait alors
qu'il restait à **retrouver le pas** d'une image qui porte déjà une grille, que le banc du
détecteur existait (`essais/essai_grille_retrouvee.py`, 19 sur 19 sur le corpus bâti), que le test
du peigne séparait franchement une peinture d'une vraie grille — **0,12 contre 0,69** — et que le
pas maximal des images réelles du dépôt était de **32 px**, non 80. Les quatre se sont vérifiés.

A suivi immédiatement, à la demande de l'auteur, et c'est fait le même jour : **la tranche des
tailles**, `D5`, plus haut dans ce journal.

## D1 — le réglage n'appartenait pas à la nature de l'image, il appartenait au moteur — 3 septembre 2026

**La tranche a été construite en entier, et sa mesure de départ n'a pas survécu au recomptage.**

Le plan tenait sur un chiffre juste : sur les 123 détourages écrits à la main dans ce dépôt,
**64 portent un durcissement du bord quand le réglage livré est zéro**, et l'écart se lisait
entre une image seule (67 %) et un morceau de planche (38 %). D'où le titre de la tranche : *une
recette par défaut, par nature d'image*.

**Recompté en croisant avec le moteur de détourage, cet écart s'évapore.**

| moteur    | passes | durcissement laissé à zéro | valeur la plus fréquente |
|-----------|--------|----------------------------|--------------------------|
| le bord   |   72   |          **78 %**          | **0** (56 sur 72)        |
| la pipette|   11   |           0 %              | **1** (6 sur 11)         |
| le modèle |   40   |           2 %              | **2** (32 sur 40)        |

À moteur égal, la nature ne décide presque plus rien — 100 % contre 93 % sur le moteur par
modèle. Le moteur, lui, décide tout. **Et la raison était déjà écrite dans le même document**,
trois mesures plus haut dans `docs/bilan-v3.md` : le moteur du bord ne produit aucun pixel à demi
transparent, il est binaire par construction ; le moteur par modèle en produit sur 95 % du sujet.
*Le durcissement ne corrige pas un goût, il corrige une frange — et la frange appartient au
moteur qui la fabrique.* Personne n'avait joint les deux comptages, et une tranche entière allait
se construire sur la mauvaise moitié.

**Ce qui a été livré, du coup.** La structure demandée, entière : deux natures d'image et quatre
familles qui se règlent, la provenance affichée avant de générer *et* sur la fiche, rien du passé
réécrit. Et le contenu que la mesure vraie dicte : **le durcissement voyage avec le moteur**, y
compris au moment où l'auteur en change sur une image — geste qu'il avait retapé à la main
**39 fois sur 40**. Un durcissement qu'il a déplacé lui-même n'est jamais réécrit, qu'il l'ait
posé dans le même envoi ou trois jours plus tôt.

**Ce que ça rapporte, sur ses 123 passes** : le durcissement tapé à la main tombe de **54 % à
24 %**. Le critère du plan demandait l'autre chiffre — combien de recettes s'écartent encore de
leur défaut : **53 sur 108**, et le durcissement est en cause dans les 53. Ce n'est pas un échec,
c'est ce qu'un moteur choisi image par image produit, et aucun défaut ne peut le deviner.

**Trois choses apprises.**

1. **Un comptage non croisé raconte l'histoire de la variable qu'on a regardée.** Avant de faire
   d'un chiffre une décision de produit, chercher la variable qui pourrait l'expliquer
   entièrement — et la chercher d'abord dans les mesures déjà écrites à côté.
2. **Une règle qui complète une charge doit partir de la charge.** La première écriture de « le
   durcissement suit le moteur » reconstruisait la passe depuis celle qui était rangée, et perdait
   le point de la pipette que le même envoi apportait. Un essai d'une autre tranche l'a attrapé.
3. **Un écran de défauts qui montre tout ne montre rien.** La tolérance et le seuil de
   transparence sont restés à leur valeur livrée 96 fois sur 100 : les mettre là aurait fait
   quatre curseurs dont deux ne bougent jamais. Ils se posent sur une image, où l'on voit ce
   qu'ils font.

Le banc : `essais/essai_defauts_de_detourage.py`, gratuit, il relit la base. 29 essais serveur,
7 essais d'écran, aucun centime.

---

## R6 — une planche sur deux entrait pleine de vide, et personne ne le disait — 3 septembre 2026

**La tranche a été ouverte pour un gâchis visible, et elle en a trouvé un plus gros à côté.**
Le visible : le compte d'images était le seul refus automatique du produit, et il jetait des
appels payés entiers — **quatre planches sur treize du banc d'animation refusées pour un sujet
de trop**, trente-et-un pour cent des appels perdus sur un geste dont c'est le régime normal.
L'invisible : quand un modèle redessine les traits du quadrillage, le remplissage depuis le bord
**s'arrête sur eux**, le fond de chaque case reste opaque, huit cases bordées font huit taches,
le compte tombe juste — et l'atelier acceptait.

**Mesuré, et c'est la mesure qui a fait la tranche.** La chaîne du produit passée sur les
135 planches des deux bancs :

| | remplissage de la boîte du sujet | combien |
|---|---|---|
| planche saine | 0,34 à 0,77, médiane 0,63 | 32 à huit sujets |
| quadrillage redessiné | **0,99 à 1,00** | **47 planches sur 95** |

Les deux populations ne se touchent pas — rien entre 0,77 et 0,99 —, donc le seuil est posé au
milieu du vide, à **0,90**. Et **une planche du banc des recettes sur deux** était entrée en
bibliothèque comme des cases bordées dont les deux tiers sont du fond. Le plan estimait ce défaut
à *« 64 % contre 34 % »* ; 64 %, c'est la valeur d'une planche **saine**.

**Le piège de la mesure, et il a failli se refermer.** Le premier réflexe est de mesurer la part
opaque de la **vignette découpée**. Elle vaut **1,00 sur toutes les planches, saines comprises** —
parce qu'une vignette est taillée dans les octets d'origine, fond compris. Elle ne sépare rien.
C'est la **boîte du sujet**, prise sur l'alpha du détourage, qui dit si ce qu'on tient est une
silhouette ou un rectangle.

**Un surplus s'ouvre, un manque refuse — et c'est la seule asymétrie.** Neuf sujets pour huit
contiennent tout ce qui a été demandé ; sept n'en contiennent pas assez, et aucun choix ne
fabriquera l'étape qui manque. Les deux anomalies, elles, se règlent du même geste : la planche
s'arrête, montre ses sujets mesurés, et l'auteur écarte ce qu'il ne veut pas. **Jamais un refus,
toujours un regard.**

**Trois états, et le troisième est celui qu'on oublie.** *Personne n'a regardé*, *j'ai regardé et
j'écarte ceci*, *j'ai regardé et je garde tout*. Le troisième doit exister et se distinguer du
premier, sans quoi une planche aux cases pleines entrerait en silence — ce que la tranche existe
pour empêcher. Un `null` d'un côté, une liste vide de l'autre.

**Et le défaut trouvé en regardant, pas en lisant.** Le chantier est *ce dont un emplacement
attend encore une issue*, et celui d'une planche en attente est **réussi** : sa tuile quittait
donc la grille à l'arrivée, et comme rien n'était entré en bibliothèque, aucune image ne prenait
sa place. L'auteur voyait un écran vide et n'avait plus aucun chemin vers ce qu'il venait de
payer — **le gâchis silencieux de la tranche, refait à l'identique par sa propre réparation.**
Les essais d'écran ne pouvaient pas l'attraper : ils injectent la génération eux-mêmes. Il a
fallu ouvrir un second atelier sur le double du fournisseur et regarder.

**Ce que ça coûte :** rien, ni en construction ni en usage. Vingt-cinq essais côté serveur, huit
côté écran, tous sur des planches fabriquées ou déjà sur le disque. Écarter un sujet ne rappelle
personne : c'est la même image, recoupée autrement.

## A10 se dessine, et deux règles tombent avant d'être écrites — 3 septembre 2026

**La maquette de la V3 a servi à ce qu'une maquette doit servir : trouver les erreurs avant le
code.** Elle est vivante — la bande pixelisée s'y recalcule dans le navigateur par la chaîne du
produit —, et c'est ce qui a permis de voir deux choses.

**Une bande n'est pas un début et une période.** Le montage des essais prélevait N images
régulièrement espacées dans une fenêtre. L'auteur l'a tranché en une phrase : *je dois pouvoir
choisir individuellement chaque frame si besoin.* Il a raison, et la raison se dit en une image :
un pas de marche demande **deux images serrées au moment du contact et une seule pendant la
glisse**. Une bande est donc **une liste d'images choisies** ; la fenêtre qu'on tire ne fait plus
que la proposer.

**La fenêtre commune se prend sur le clip, pas sur la bande** — et c'est l'erreur juste à côté de
la bonne réponse. Mesuré sur le clip du 2 septembre : la fenêtre du repos seul fait 217 × 376,
celle de la marche 246 × 380. Ramené à 64 pixels de haut, **le même personnage sort à 37 pixels
de large au repos et 41 en marchant** : il grandirait de 10 % en se mettant à marcher. Une
fenêtre par bande cale les images *d'une* bande entre elles ; il faut une fenêtre par clip pour
caler *les bandes* entre elles.

**Et une règle a changé de forme, à la demande de l'auteur.** *L'éditeur n'invente aucune taille
de pixel ni aucune palette : ce sont celles du projet, en lecture seule* devient **la recette du
jeu est le point de départ, jamais une prison**. Le fond est gardé, et c'était lui qui comptait :
*une bande qui s'écarte de son jeu le dit*, en clair, à côté du chiffre changé.

**Ce que ça coûte :** rien. Quatre user stories de plus, cinq critères de plus sur `A10`, et zéro
ligne de code à défaire — parce que rien de tout cela n'était encore écrit.

## A9 — le clip entre dans l'atelier, et rien de ce qui est payé ne se perd — 3 septembre 2026

**La première tranche de la V3 est écrite côté serveur, et elle n'a pas coûté un centime.**
Trente-six essais, tous sur un double. L'atelier sait commander un clip vidéo à partir d'un
sprite de la bibliothèque, l'attendre, encaisser ce qu'il a réellement coûté, en tirer ses
images, et **aller rechercher un clip déjà payé au lieu de le repayer**.

**Le second port du dépôt.** Depuis F1 la frontière du dépôt était le fournisseur d'images ;
il y en a un deuxième. Ce n'est pas un modèle de plus, et trois choses l'empêchaient d'en
être un. Un appel d'image part et revient dans la même requête, un clip se soumet et
s'attend deux minutes — **et l'atelier peut fermer entre-temps**. L'image de départ d'un clip
est *obligatoire*, là où les trois rôles d'image jointe du produit sont facultatifs et cèdent
tous devant le plafond du modèle. Et ce qui revient n'est pas une image : la chaîne qui mesure
tout fichier reçu y lève « illisible », et le rattrapage enregistrait alors **un échec à zéro
dollar** — un clip payé disparu du journal.

**L'ordre d'écriture est toute la tranche.** Le numéro du travail s'écrit *avant* la première
seconde d'attente. La dépense s'écrit *avant* le fichier, le fichier *avant* les images. Chacun
de ces « avant » ferme un trou par lequel de l'argent déjà dépensé sortait du journal, et chacun
a son essai — dont un qui regarde ce qu'il y a sur le disque **pendant** que le clip se fabrique.

**Deux choses ont changé de forme en cours de route, et les deux valaient mieux.** Le montant
facturé se lit dans la réponse d'attente, sous `usage.cost` : le verrou d'ouverture de la
tranche est tombé avant qu'elle s'ouvre. Et un montant *absent* de cette réponse ne s'écrit plus
comme un zéro : le produit enregistre zéro **en disant qu'il ne sait pas**, parce qu'un total
faux vers le bas en silence est pire qu'un trou qu'on voit.

**Ce que la tranche ajoute au dépôt, et qui se justifie.** Un décodeur de vidéos — rien de ce
qui était là ne sait ouvrir un conteneur vidéo. Il est **optionnel**, sur le modèle du second
détoureur : sans lui, un clip s'achète, se paie, se garde et se récupère ; seules ses images
attendent. **Un clip payé n'est jamais perdu faute d'une bibliothèque.**

**Ce qui reste.** L'écran. Il est dans `A10` avec l'éditeur de montage, parce que commander un
clip, l'attendre et le découper sont **un seul geste continu** — les dessiner séparément ferait
deux écrans là où il en faut un.

## La V3 change de méthode : l'animation passe par la vidéo — 2 septembre 2026

**Six essais payés le même soir, 2,29 $, et ils renversent la version.** Le plan bâtissait la V3
sur la planche de huit cases. Il la bâtit désormais sur un clip vidéo qu'on découpe.

**Ce qui est mort, mesuré.** Quatre chemins, et chacun avait sa règle écrite d'avance. Nommer
les images jointes, ranger le texte en sections, le faire réécrire par une IA : cinq variantes,
zéro bonne planche, le témoin les bat toutes — **`R7` est close avant d'avoir été construite**.
Agrandir la référence à 256 ou 512 pixels : le 64 n'est pas battu. Préparer la pose d'abord :
quatre planches mauvaises sur quatre. Imposer la géométrie par une image de posture : la pose
est suivie au pixel, mais **le modèle emprunte aussi la carrure du guide**, trois correctifs
n'y ont rien changé. *Ce qu'on montre à un modèle, il le copie en entier* — c'est le résultat
le plus instructif de la journée, et il vaut au-delà de la V3.

**Ce qui vit.** Un modèle image-vers-vidéo reçoit le sprite et rend cent images d'un mouvement
continu. Six clips, six marches lisibles, personnage stable, fond détourable. Puis la
découverte qui commande tout : **un clip de cinq secondes porte plusieurs animations** si le
texte minute les actions seconde par seconde, nomme les transitions et impose un retour à la
même pose neutre entre deux actions. Un paiement, plusieurs bandes.

**Ce que ça ajoute au plan.** Deux tranches, `A9` — le clip entre dans l'atelier — et `A10` — le
montage, qui découpe plusieurs animations dans un clip —, seize user stories, et trois décisions
durables de plus. `A0` est clos, `A8` déclassée de finale à complément, `A3` change d'objet, et
le seul gain du côté planche — une grille de quatre colonnes sur deux rangées — descend dans
`R6` avec sa précaution.

**Ce que le plan écrit noir sur blanc sans l'avoir mesuré**, parce qu'un chemin neuf doit dire
ce qu'il ignore : un seul personnage, le plus facile qui soit ; aucune bande pixelisée notée ;
le montant réellement facturé d'un clip jamais relu, dix-huit fois sur dix-huit ; et le prix par
bande utilisable inconnu. **La vidéo ne se justifie donc pas par son prix mais par ce qu'elle
fait et qu'une planche ne fait pas.**

---

## Six arbitrages de l'auteur sur le plan, dont un qui me corrige — 2 septembre 2026

**Un récapitulatif du plan écrit pour être lisible sans rien connaître du code a servi à ce
qu'il devait servir** : l'auteur l'a relu et a tranché six points. Ils sont écrits ici parce que
trois d'entre eux **changent ce qui sera construit**, et un **annule une conclusion que j'avais
tirée trop large**.

**1 · Le fond ne coûte plus de banc.** `D3` exigeait huit tirages par branche avant la première
ligne ; c'est retiré. La raison tient : **le fond devient un réglage, pas une valeur imposée** —
une mauvaise couleur se change en un geste et se voit sur l'image suivante. Ce qui remplace le
banc est plus utile que lui : **deux mesures d'acceptation affichées sur chaque image revenue**,
les pixels de bord et ceux encore collés à la couleur de fond. *Elles se lisent sur les images
qu'on voulait de toute façon* — ce qui est très exactement la doctrine du dépôt sur les notes de
qualité, appliquée ici pour la première fois à un réglage d'envoi.

**2 · Le relevé du pantin passe de la comparaison à la boucle.** `A0` comparait trois formes de
pantin d'un coup, environ un dollar. Jugé trop cher, et surtout mal fait : *« je préfère imaginer
un test, anticiper ce qui peut échouer et le corriger, puis le tester, analyser le résultat,
corriger, refaire — plutôt que tester quinze choses d'un coup et choisir la meilleure. »*

**La règle qui en sort ne détruit pas celle des huit tirages, elle la borne** : on avance **une
tentative à la fois quand on explore** — « est-ce que ça marche seulement ? » —, et l'on tire
**assez de fois quand on arbitre** — « laquelle de ces deux branches est la meilleure ? », où le
bruit déciderait à notre place. `A0` est une exploration. *Et une méthode de boucle est écrite
avec, pour qu'une boucle ne soit pas quinze essais déguisés en un : on écrit d'avance ce qu'on
attend et les deux ou trois façons dont ça peut rater, et l'on conclut chaque tour par **quel
échec s'est produit**, jamais par une note. Un échec anticipé se corrige, un échec constaté se
re-tire.* L'ordre des trois questions change aussi : **la gratuite qui peut tout arrêter passe en
premier** — si un bras plié bave à la réduction, rien d'autre n'a d'objet, et rien n'a été payé.

**3 · « Le texte du produit ne bouge pas » était faux, et c'est moi qui l'avais écrit.** Les
bancs ont mesuré des **formulations** — dire la même chose avec d'autres mots. Ils n'ont **jamais
touché à la mise en page**. J'en avais tiré une interdiction générale, reprise dans quatre
documents. **Corrigée partout, et une tranche est née : `R7`, hors version comme `R6`**, parce
qu'elle sert toutes les générations et pas seulement l'animation — le texte se range en trois
parties nommées : le contexte, les références, la demande.

**Et le cadrage de `R7` a récupéré une remarque d'usage qui dormait**, ce qui en fait la partie
dont on peut attendre quelque chose : **une image jointe ne dit pas ce qu'elle est.** Un artwork
de style, un gabarit de découpe et un sprite de pose partent aujourd'hui dans le même sac, sans
qu'une ligne dise lequel est lequel — alors que le comportement qui a donné le gabarit est
précisément que *le modèle recopie la structure de son entrée*. **La tranche ne promet aucun gain
de taux**, et c'est écrit comme tel : elle promet un texte relisible.

**4 · Le nombre de planches était déjà un choix ; c'est mon résumé qui trompait.** Le critère
existait. Il est désormais explicite en deux lignes — le nombre se choisit **à chaque
lancement**, et **une seule planche reste un choix valable, c'est le défaut**. *Leçon de
rédaction : un résumé qui dit « on commande plusieurs planches » là où le plan dit « le nombre se
choisit » invente une contrainte que le produit n'a pas.*

**5 · Le doute de droit d'auteur sur le modèle de découpe est levé comme condition.** Retiré des
critères de `D4` et du PRD ; gardé comme fait, avec la raison de l'auteur — *« tous les modèles
sont comme ça, c'est un projet perso, rien de commercial derrière »*. Une seule clause survit,
sans insister : le jour où quelque chose sortirait de ce jeu contre de l'argent, la question se
rouvre — pour ce modèle comme pour tous les autres.

**6 · Les petits outils de dessin ne se font pas, et ce n'est pas un refus.** Le trait droit, le
rectangle, le pot de peinture et la symétrie avaient été proposés comme un ajout léger à la table
de retouche. *« On ne les fait pas, il y aura plus tard une version avec éditeur. »* **La raison
vaut d'être gardée** : chacun paraît petit isolé, et les prendre un par un fabriquerait un
demi-éditeur que personne n'aurait décidé. C'est un **rang**, pas une exclusion — la version
d'édition n'a pas de place fixée dans l'ordre, et aucune tranche du plan ne présuppose ces
outils.

**Ce que la séance dit sur la méthode.** Le récapitulatif avait été demandé pour vérifier *« si
on n'a rien oublié, ou si des choix ne correspondent pas à mes souhaits »*. Sur quatorze étapes,
**deux choix ne correspondaient pas** et **un troisième reposait sur une conclusion trop large**.
Aucun des trois n'aurait été trouvé en relisant le plan : ils se sont vus **parce que le plan
était réécrit sans jargon, pour quelqu'un qui ne l'a pas écrit**. Le plan compte désormais
**quinze étapes, 67 promesses et 109 vérifications**.

## Le dépliage reste automatique, et il se refait — 2 septembre 2026

**La seule question que le relevé d'architecture avait laissée ouverte est tranchée**, et par
l'auteur : *« je veux un dépliage automatique, mais la possibilité de refaire le dépliage à la
main si je le souhaite. »*

**Ce que ça corrige dans le cadrage de `A1`, et ce n'est pas un détail de formulation.** La
tranche était écrite comme *« son dépliage devient un geste de l'auteur : l'atelier propose les
coupes, l'auteur les corrige et valide »* — c'est-à-dire un écran de validation posé sur
**chaque** planche revenue. Cela aurait fait payer à toutes les générations le prix des rares
qui tombent mal, et alourdi le geste le plus fréquent du produit pour servir le plus rare.

**La formule qui s'en dégage vaut d'être gardée : le coupable n'était pas « automatique »,
c'était « sans retour ».** Ce qui coûtait cher n'a jamais été que la machine découpe toute
seule — elle le fait bien la plupart du temps —, c'est qu'un découpage tombé mal n'avait rien à
reprendre, parce que la planche n'existait nulle part. **La correction est donc de garder la
planche, pas de retirer l'automatisme.**

**Deux conséquences, écrites là où elles se lisent.** Le premier dépliage reste automatique et
ne demande **aucun geste de plus qu'aujourd'hui** — c'est devenu un critère d'acceptation de la
tranche, formulé pour être vérifiable. Et **la reprise au redémarrage ne se rouvre pas** : une
planche payée et reçue que la fermeture a laissée non dépliée continue de se déplier seule au
démarrage, comme depuis `C2` ; la décision la confirme au lieu de la remettre en cause.

Reporté aux six endroits qui le portaient : `docs/PLAN.md` § P1 — la tranche s'appelait alors
`A1`, et son titre, qui annonçait *« se déplie à la main »*, disait donc l'inverse —,
`docs/PRD.md` § Solution et § Critères de succès, `docs/user-stories.md` (`US-372` et `US-374`,
dont la seconde promettait exactement le contraire), `docs/ARCHITECTURE.md` § 3, et
`docs/archi-versions.md` §7 et §8.

## L'architecture relue, et une erreur que le recadrage venait d'introduire — 2 septembre 2026

**Ce qui a été fait.** Un relevé à six angles sur `docs/ARCHITECTURE.md` et ses annexes, chaque
trouvaille sérieuse passée devant un sceptique dont la consigne était de **réfuter par défaut**.
Soixante-neuf trouvailles brutes, soixante-deux après dédoublonnage, huit soumises au sceptique,
**six confirmées et deux réfutées**.

**Le résultat n'était pas celui qu'on cherchait, et c'est ce qui le rend utile.** Les six
confirmées ne sont **pas** dans `ARCHITECTURE.md` : elles sont toutes dans son annexe
`docs/archi-versions.md`, dont le §8 — l'animation — avait été écrit **avant** les trois bancs
payés et enseignait donc l'inverse de ce qu'ils ont mesuré. Il réclamait un prototypage déjà
fait, et proposait *« produire les images puis fournir un bon outil de correction »* — très
exactement l'approche que la mesure écarte. Le §7 y ajoutait la règle du pliage que `A1`
renverse, portée sans une marque de révision.

**Et le relevé a trouvé une erreur vieille de deux heures, qui était la mienne.** La tranche
`D4`, écrite le matin même, réclamait *« un cran intermédiaire entre nos deux modèles »* et
*« un catalogue qui cesse d'être deux noms en dur »*. Vérifié dans le code : le produit porte
**trois** modèles de détourage depuis `U13`, dans un catalogue structuré, et celui du milieu
porte littéralement le titre **« intermédiaire »** — le commentaire du code invoque même la
règle *« le catalogue décide, jamais une liste en dur »*. Le produit compte par ailleurs
**quatre** moteurs de découpe, pas trois.

**La faute venait du relevé d'outillage, qui parle de « nos deux modèles », et elle a été
recopiée sans vérifier.** Elle avait atteint quatre documents en une matinée. Corrigée aux cinq
endroits, **source comprise**, avec la raison écrite à chaque fois pour qu'elle ne reparte pas.
Ce qui reste vrai de `D4` après le tri : aucun de nos trois modèles n'est entraîné sur du
dessin, essayer le lourd coûte 972 Mo, et le contour doit se poser sur la vraie frontière. *Et
le seul modèle entraîné sur du dessin porte un doute de droit d'auteur que le relevé signalait
et que la tranche escamotait : il est maintenant écrit dans les critères.*

**La correction la plus grave portait sur les risques.** `ARCHITECTURE.md` déclarait la dérive
d'échelle **corrigée** par « le recadrage et la normalisation d'échelle » — alors que c'est
précisément la normalisation qui la **fabrique**, en calculant le facteur sur la boîte de
l'image courante. Le document déclarait donc réglé le seul défaut qui détruit ce qui est payé
en animation. Deux lignes de risque le disent maintenant, avec la réparation chiffrée.

**Ce qui a été repris par ailleurs** : la table des décisions de cadrage, dont six lignes sur
quinze étaient périmées et à laquelle il manquait les trois décisions du 2 septembre ; le compte
des places de la recette — **huit, pas sept**, la *différence* était omise parce qu'elle ne se
voit que sur un calque ; les quatre entités de la V2.1 comptées comme trois ; les deux entités
de la V2.2 absentes du modèle ; et une note du carnet du PRD qui envoyait corriger un défaut
**déjà corrigé** — une note « il reste à faire X » ne s'efface pas toute seule quand X est fait.

**Enfin la coupe annoncée la veille et non prise a été prise** : les 8,9 Ko de *« ce que la
toile ajoute au modèle »* descendent dans `docs/archi-versions.md` § 6.5 bis, à côté de la
dépendance de la toile qui y était déjà — deux moitiés d'un même sujet qui se renvoyaient l'une
à l'autre entre deux fichiers. **Les 1 033 renvois tombent juste**, corpus à 248 Ko.

**La leçon, et elle est nouvelle.** Les deux compactages précédents cherchaient du **poids** ; le
recadrage de la veille cherchait ce qui était **fini**. Celui-ci cherchait ce qui était **faux**,
et il a trouvé son plus gros défaut dans un travail vieux de deux heures. *Un document
d'autorité écrit vite doit être relu par quelqu'un qui essaie de le réfuter — et une recopie
depuis un relevé non vérifié est le chemin le plus court vers une erreur qui se propage.*

## La doc est recadrée, et le plan cesse de raconter du travail fini — 2 septembre 2026

**Ce qui l'a déclenché.** Le corpus de démarrage était remonté à **300 Ko**, et `docs/PLAN.md`
en portait 173 à lui seul — dont **plus des trois quarts racontaient des versions livrées**. À
côté, ce que les trois bancs d'animation et le relevé d'outillage avaient appris était réparti
sur **sept fichiers et 210 Ko**, sans qu'aucun ne conclue. Ouvrir la V3 aurait voulu dire les
lire tous les sept.

**Ce qui a été fait**, dans l'ordre où ça compte :

- **`docs/bilan-v3.md` est né.** Il ne raconte rien, il conclut : les six chiffres qui décident
  de la version, ce que chaque banc a répondu, **ce qui est mort et ne doit pas se reproposer**,
  les trois défauts que le code porte aujourd'hui, ce que le relevé d'outillage rapporte axe par
  axe, et les limites de tout ce qui précède. 20 Ko contre 210.
- **`docs/PLAN.md` est passé de 173 à 54 Ko** : il ne garde que `R6`, la V2.3 et la V3. Les
  cinq versions tenues sont descendues dans `docs/archive/plan-versions-tenues.md`, **sans
  qu'un mot change**. Ce qui en est remonté, et ne devait pas descendre : **les invariants**,
  rassemblés pour la première fois en une seule table par thème, avec la tranche qui les a
  instaurés et, pour les six qui ont été révisés, ce qui les a remplacés.
- **`docs/PRD.md` a rattrapé deux versions.** Il s'arrêtait au 1<sup>er</sup> septembre et
  **contredisait la V3 en trois endroits** : *« animation de sprites »* écartée, *« squelette,
  os, interpolation : c'est l'animation, pas le personnage »*, et *« le pliage est une ruse
  d'appel, jamais un format de livraison »*. Les trois sont barrées à leur place, avec un
  paragraphe daté qui dit ce qui les renverse. Il gagne deux frottements, deux blocs de
  critères vérifiables et deux paragraphes de hors-périmètre.
- **`AGENTS.md § Où en est le dépôt` est passé de 16 à 8,6 Ko.** Il racontait tranche par
  tranche ce que `docs/status/etat.md` raconte déjà — la règle *« aucun document ne répète ce
  qu'un autre dit »* était enfreinte par le fichier qui la porte. Il garde un tableau d'état et
  **huit points qu'il faut savoir avant de toucher au code**, qui sont les endroits où une règle
  a changé de forme sans changer de nom.
- **Neuf documents sont descendus dans `docs/archive/`** : les cinq études préparatoires de la
  V3, les vingt-et-un points d'interface traités un par un, et trois carnets clos.

**Ce que le banc a trouvé, et c'est exactement pour ça qu'il existe.** Le déplacement a cassé
**65 renvois** — 56 depuis le code, 9 entre documents —, et aucun n'aurait levé la moindre
erreur : un renvoi qui cite une section déplacée **ment en silence**. `essais/essai_docs.py`
les a tous nommés, fichier et ligne, et son relevé JSON a permis de les reprendre en une passe.
Les 994 renvois tombent à nouveau juste, et le corpus de démarrage est à **242 Ko**.

**La leçon, et elle est neuve.** Les deux compactages précédents avaient descendu une section
parce qu'elle **pesait** trop. Celui-ci descend parce qu'elle **est finie** — ce n'est pas le
même critère, et il est meilleur : un document d'autorité doit dire *ce qui reste*, jamais *ce
qui a été fait*. Le second est un journal, et il en existait déjà un.

## La V2.2 se ferme à cinq tranches sur six — 1<sup>er</sup> septembre 2026

**Ce qui l'a fermée n'est pas une décision de portée, c'est un compte que ce dépôt n'a pas.**
Il reste `F4` — Cloudflare Workers AI —, et elle ne demande ni décision ni construction
préalable : elle demande un identifiant de compte et un jeton, tous deux gratuits, chez un
fournisseur où personne n'a ouvert de compte. Le relevé `F0` avait déjà dû le décrire sur sa
documentation seule, pour la même raison, et il l'avait écrit.

**La marche à suivre pour ouvrir ce compte a été écrite le jour de la clôture**, dans
`docs/tranches/V2.2.md` § F4 : cinq gestes, et le seul piège qu'ils portent — un jeton créé à
la main veut le droit de lire **et** celui d'écrire, faute de quoi l'atelier afficherait tous
les modèles sans pouvoir fabriquer une image. Écrite d'avance parce qu'une manip qu'on
retrouve six mois plus tard se refait deux fois : une fois de travers, une fois bien.

**Ce que la version a livré**, dans l'ordre où ça se remarque : sur une machine où rien n'a
été déposé, **une image arrive** ; un appel qui ne coûte rien dit **gratuit** et non `0,00 $`,
avec ce qu'il a réellement pris écrit à côté ; chaque fournisseur a **sa place à secrets**, y
compris celui qui en demandera deux ; et **une séance de code entière ne fait plus bouger le
total en argent**.

**Ce qu'elle laisse en état de marche pour `F4`**, et qui ne sera pas à inventer ce jour-là :
la réserve du domaine accepte un plafond **facultatif** — parce qu'aucun fournisseur d'ici
n'en annonce —, et `F4` sera la première à en brancher un vrai ; le tiroir à secrets tient
deux places pour un seul fournisseur, ce que Cloudflare demande. Chacune des deux a **un
double d'essai qui la vérifie déjà**, écrit exprès : `FournisseurAvecPlafond` dans
`tests/test_f2.py`, `FournisseurADeuxPlaces` dans `tests/test_f3.py`.

**Et une leçon revenue quatre fois de suite, sous quatre formes.** Des commentaires du domaine
en `F1`, trois mots du produit en `F2`, une garde du lecteur de configuration en `F3`, deux
affichages de l'écran de confirmation en `F6` : *une chose juste sous une hypothèse devient
fausse quand l'hypothèse s'élargit.* Rien dans le code ne le signale — chaque morceau reste
juste tout seul —, et le seul remède qui a marché est de relire ce qui parlait au singulier :
« la clé », « l'argent », « au moins une place ». C'est la façon la moins chère de trouver, et
c'est aussi la seule.

**Le détail des six tranches est descendu ici**, dans `docs/tranches/V2.2.md`, le jour de la
clôture. Le plan portait ce que chaque tranche livre, l'annexe portait ses critères : deux
fichiers qui se renvoyaient l'un à l'autre pour un seul sujet. Ce qu'on lit avant d'avoir rien
lu — les cinq documents ouverts au début de chaque séance — passe de **320,6 Ko à 300,6 Ko**,
et l'on ouvre désormais un seul fichier pour reprendre une tranche.

## F6 — 1<sup>er</sup> septembre 2026

**Le travail de l'agent ne coûte plus d'argent.** Le modèle qu'il impose est celui du
fournisseur qui ne facture rien. C'était déjà l'idée en `T7` — *un agent qui code a besoin
d'un visuel correct tout de suite, pas d'un asset final* —, et elle valait alors un rapport de
six sur le coût du travail agentique ; elle vaut désormais la totalité.

**La tranche creuse un trou en le faisant, et c'est là qu'est passé le travail.** Un modèle
gratuit n'accepte aucune image d'entrée. Avant `F6`, cela voulait dire que le produit refusait
l'appel **tout entier** dès qu'un jeu avait un seul artwork officiel — c'est-à-dire sur
presque tout jeu réel. Le garde-fou aurait donc été éteint le jour même, ce qui est la façon
la plus sûre de perdre un garde-fou. La règle posée tient en une phrase : **ce que le produit
ajoute de lui-même cède devant le plafond du modèle ; ce que l'auteur a joint ne cède jamais.**

**Ce qui a coûté n'est pas la règle, c'est tout ce qui l'entoure.** *Rien ne se perd en
silence* demandait quatre choses, et chacune touchait un endroit différent : le grisé d'un
modèle se compte désormais sur ce qui ne cède pas — sinon la liste dirait *indisponible* d'un
modèle chez qui la soumission passe, c'est-à-dire l'inverse exact de la règle de `T1` ;
l'écran de confirmation marque les lignes qui ne partiront pas et l'écrit en toutes lettres ;
le prix ne compte que ce qui part ; et la génération enregistre ce qu'elle a laissé au sol.
Cette dernière ligne est celle qui se lit le plus tard : sans elle, une image faite sans le
style du jeu et une image faite dans un jeu sans style se liraient pareil, des mois après.

**Le repli du garde-fou a changé, et c'est le même raisonnement poussé d'un cran.** Il rendait
le défaut du catalogue quand le modèle imposé n'y était plus — c'est-à-dire le meilleur modèle
du banc, c'est-à-dire un payant. Un garde-fou posé pour ne rien dépenser qui se replie sur un
payant le jour où le gratuit change de nom **coûte de l'argent en silence**, ce qui est pire
que pas de garde-fou du tout. Il cherche donc un autre gratuit d'abord.

**Deux défauts d'affichage attendaient depuis E14, et c'est un modèle sans places qui les a
montrés.** Le premier : l'écran de confirmation annonce *« N avertissements — non bloquants,
écrits sur la ligne concernée »*, et les avertissements du bloc d'images n'ont pas de ligne de
prompt à eux — ils n'étaient donc rendus par **aucun chemin**. On lisait « 1 avertissement » et
l'on cherchait où. Le second : son sommaire annonçait « 1 sur 0 », parce qu'il comptait *les
cochées sur les places du modèle*, c'est-à-dire un compte sur une **capacité**. Les deux
étaient justes tant qu'un modèle avait au moins une place, et faux dès qu'il n'en avait
aucune — c'est le même piège que les trois tranches précédentes ont payé sous trois autres
formes.

**Ce que la vérification a montré, et qu'aucun essai ne montrait.** Un appel réel chez le
gratuit, sur un jeu portant un artwork officiel : l'image revient en **1 jeton et $0,00**, et
sa fiche dit *partie sans le style du jeu — 1 image n'a pas suivi, ce modèle n'en accepte
pas*. C'est la phrase entière de la tranche, lue à l'endroit où elle servira.

## F3 — 1<sup>er</sup> septembre 2026

**Le tiroir à clés a cessé d'être « la clé ».** Une place par fournisseur, chacun déclarant ce
qu'il demande — une clé, deux secrets, ou rien du tout —, et déposer l'une ne touche à aucune
autre. Le produit n'avait jamais eu qu'un champ ; le relevé `F0` avait trouvé un fournisseur
qui en demande **deux** — un compte *et* un jeton —, et un formulaire à un champ l'aurait
découvert en `F4`, au pire moment.

**La séparation qui a rendu la tranche courte.** L'adaptateur déclare *quelles places existent
et comment on en parle à l'auteur* ; ce qu'il y a dedans se lit ailleurs, dans le module des
réglages, qui ne connaît plus qu'une chose : **une place nommée, et sa valeur**. Le module ne
sait donc plus qu'OpenRouter existe, et un fournisseur neuf n'y ajoute pas une ligne. La règle
de T1 — *la valeur se relit à chaque appel, jamais au démarrage* — n'a pas été réécrite, elle
a été **étendue au pluriel** : les fabriques reconstruisent chaque fournisseur au moment où
l'on s'en sert, et chacun relit ses valeurs en naissant.

**Une garde du lecteur de configuration attendait de devenir une panne.** Pour deviner
l'encodage du fichier — PowerShell écrit en UTF-16, piège payé en T1 —, il gardait le premier
décodage **qui contenait le nom de la clé d'OpenRouter**. Imparable tant qu'il n'existe qu'un
secret au monde ; le jour où un fichier ne porte que les deux valeurs de Cloudflare, il n'est
plus reconnu comme un fichier de configuration **du tout**, et le produit annonce *aucun jeton*
sur un fichier qui en porte un. La panne se serait présentée en `F4` comme un problème de
Cloudflare. C'est le troisième jour de suite que la même chose se produit sous une forme
différente — des commentaires en `F1`, trois mots du produit en `F2`, une garde technique
ici : *une chose juste sous une hypothèse devient fausse quand l'hypothèse s'élargit*, et rien
dans le code ne le signale, puisque chaque morceau reste juste tout seul.

**Deux mots de la barre du haut n'ont pas survécu.** Elle disait `clé …a41c` ou `aucune clé` ;
le critère demandait de garder les seconds pour le cas où rien ne peut produire. Ils nomment
la mauvaise chose dès qu'un fournisseur demande autre chose qu'une clé, et la barre dit donc
**avec quoi on peut produire** — `2 fournisseurs prêts`, `1 sur 2`, `rien pour produire`. Ce
n'est pas un changement de mots mais un renversement de ce qu'elle annonce : elle décrivait
*ce qui manque*, dans un monde où un seul manque éteignait tout ; il en manque désormais un
sur deux et une image part quand même.

**Et le français a coûté un champ de plus.** *« aucune clé OpenRouter »* et *« aucun jeton
Cloudflare »* ne se composent pas avec la même règle : une phrase du produit ne se fabrique
pas par concaténation. Chaque place déclare donc sa forme négative en toutes lettres, ce qui a
permis de reproduire la phrase d'avant **mot pour mot** quand il n'y a qu'une place — et de ne
réécrire aucun essai de T1.

**Ce qu'une vérification à la main a trouvé et qu'aucun essai ne cherchait.** Déposer une clé
depuis l'étape de l'assistant laissait la barre du haut annoncer `1 sur 2` sur un atelier où
les deux fournisseurs étaient prêts : l'étape tenait son tiroir à jour toute seule et ne
prévenait personne, là où la fenêtre des réglages prévenait déjà. Deux rendus du même
composant, un seul branché. C'est exactement la leçon d'E13 — *deux endroits qui montrent la
même chose divergent par ce qu'ils font, pas par ce qu'ils affichent*.

## F2 — 1<sup>er</sup> septembre 2026

**Le produit compte dans l'unité du fournisseur, et « gratuit » a cessé de s'écrire
`$0,0000`.** C'était le mensonge par omission que l'écran des dépenses avait été construit
pour arrêter, rouvert un cran plus bas par l'arrivée d'un fournisseur qui ne facture pas :
zéro dollar est vrai, et se lit *sans limite* là où il faut lire *sans prix*. Ce qu'un appel
prend chez Pollinations — un jeton, annoncé dans ses en-têtes — est désormais enregistré à
côté du mot.

**La forme trouvée est plus petite que la tranche ne le laissait croire, et c'est ce qui l'a
rendue tenable.** Le premier réflexe était d'ajouter une unité à côté du coût, partout. Le
second, celui qui a été suivi : **le coût en argent est *déduit* de la quantité et de son
unité**, et vaut zéro dès que l'unité n'en est pas une. L'invariant *un total en argent ne
compte que de l'argent* est alors tenu **par construction** — un jeton ne peut pas entrer dans
une somme de dollars, où qu'elle soit calculée —, et aucune des dizaines de sommes de
`cout_usd` du dépôt n'a eu à apprendre qu'il existe d'autres unités. Huit cents essais sont
restés verts à travers un changement de modèle d'objets.

**Le relevé avait écrit la contrainte, et le plan ne l'avait pas lue.** Deux des dix critères
demandaient d'afficher *ce qui reste*. Or « ce qui reste » demande un plafond, et **aucun des
deux fournisseurs n'en annonce** : celui qui ne demande rien limite une **cadence**, un appel
toutes les quinze secondes, pas un quota. C'était écrit noir sur blanc dans la cinquième
conclusion du relevé `F0`, un jour plus tôt. Le produit a donc été construit avec un plafond
**facultatif** — `reste` vaut alors `null`, qui n'est pas zéro : zéro veut dire *attends
demain*, `null` veut dire *rien ne te limite*. Un double annonce un plafond pour que la
machinerie soit vérifiée avant que `F4` ne l'utilise pour de bon.

**Et le banc gratuit a annoncé une régression qui n'existait pas.** Il redemandait la même
phrase à chaque lancement ; le fournisseur la servait de son cache en 0,2 s au lieu de 25, et
**sans aucun de ses deux en-têtes** — ni celui qui dit quel modèle a répondu, ni celui qui dit
ce que l'appel a consommé. Le garde du modèle instauré en `F1` ne pouvait donc pas se
déclencher, et le banc a écrit que l'adaptateur avait cessé de refuser. Deux choses valaient
d'être apprises. La première : **la durée était la preuve, et personne ne la lit** — 0,2 s
pour une image qui en demande vingt-cinq n'est pas une bonne surprise, c'est un aveu. La
seconde : **un banc qui mesure un fournisseur demande une phrase que personne n'a demandée**,
sinon il mesure un cache en croyant mesurer un adaptateur. Le garde, lui, garde son trou : sur
une réponse cachée, on ne peut pas savoir quel modèle a fait l'image. Sans conséquence tant
que ce palier ne déclare **qu'un** modèle — ce qui est mesuré —, et à rouvrir sinon.

**Trois mots du produit étaient justes parce qu'il n'y avait qu'une unité** : *payé*,
*facturé*, *à repayer*. Chacun devient faux chez un fournisseur qui ne facture pas, et aucun
n'aurait levé d'erreur. C'est le même piège qu'`F1` avait payé sur les commentaires, une
couche plus haut — *une phrase juste sous une hypothèse devient fausse quand l'hypothèse
s'élargit* —, et il vaut la peine de noter qu'il s'est reproduit **le lendemain**, sur le même
sujet, sans que la première leçon suffise à le voir venir.

## F1 — 1<sup>er</sup> septembre 2026

**Le produit connaît plusieurs fournisseurs d'images, et le second ne demande rien.** Sans
compte, sans clé, sans carte : on écrit un sujet, et une image arrive en une seconde et demie.
C'est Pollinations, celui que le relevé `F0` avait désigné — un seul modèle sur le palier
anonyme, aucune image de référence, et un jeton par appel.

**Ce qui a été le plus difficile n'était pas d'ajouter un fournisseur, c'était de nommer un
modèle.** Jusqu'ici un modèle s'appelait `openai/gpt-image-2`, et ce nom se promenait partout
— dans la liste où l'on choisit, dans le fichier d'une génération, sur la fiche d'une image,
dans le journal des dépenses. Deux fournisseurs peuvent proposer le même nom : Cloudflare
héberge les modèles de Leonardo, et le relevé l'a trouvé. Le nom est donc devenu
`OpenRouter:openai/gpt-image-2` — **les deux ensemble, jamais l'un seul** —, et il a fallu le
suivre jusqu'au bout de chaque chemin. Toutes les images déjà sur ce disque portent l'ancien
nom : le catalogue les rattrape, **mais seulement quand un seul fournisseur revendique ce
nom-là**. Sinon il dit qu'il ne sait pas, plutôt que de choisir entre un payant et un gratuit
à pile ou face.

**Une règle du dépôt a rencontré une autre, et il a fallu trancher.** Le critère de la tranche
demandait que couper la liaison d'un fournisseur **grise** ses modèles. Une règle plus
ancienne dit que *l'échec survient au moment où on génère, jamais au démarrage* — et la V2.2
l'hérite sans la rediscuter. Un catalogue qui n'a pas répondu ne prouve rien sur l'adresse qui
génère : éteindre le bouton sur cette base, c'est accueillir l'auteur par une erreur que rien
n'a mesurée. **La règle plus ancienne l'emporte**, et la distinction est désormais écrite dans
le produit : ce qui **manque** — une clé — grise et refuse ; ce qui est **injoignable** sert sa
photo datée et laisse générer. L'arbitrage entier, avec ce qu'il faudrait changer pour le
renverser, est dans `docs/tranches/V2.2.md` § F1.

**Et trois phrases du produit sont devenues fausses le même jour**, aux trois endroits où
elles vivaient : *« sans clé, le bouton qui paie reste éteint »*. Le plan l'avait annoncé —
c'est la seule des trois révisions de la V2.2 qui *se voit sans la chercher*. Le piège n'est
pas d'avoir écrit la phrase, c'est qu'elle était **justifiée par un commentaire honnête** :
« le fournisseur est le même pour tous, il ne distingue rien ». On lit ça, on trouve ça
prudent, on passe. C'est écrit dans `docs/PIEGES.md`.

**Ce qui reste ouvert, et qui appartient à F2** : un appel gratuit affiche encore `$0,0000`.
Rien n'est faux — zéro dollar est bien parti —, mais c'est le mensonge par omission que
l'écran des dépenses avait été construit pour arrêter, un cran plus bas. Ce que l'appel
consomme vraiment est connu et non enregistré : un jeton, annoncé dans les en-têtes.

## Le compactage des documents — 29 août 2026

**Le corpus de démarrage est passé de 315 à 139 Ko sans qu'une ligne soit supprimée.** Sept
passes, et ce qui est sorti est descendu en annexe avec un renvoi. Ce n'est pas une tranche :
rien du produit n'a changé, seuls les documents ont été redécoupés.

**Ce qui a été trouvé en mesurant, et qu'aucun de nous ne voyait.** `AGENTS.md` portait la
règle depuis le début — *« dès qu'une section pèse plus que le document qui la porte, elle
sort en annexe »* — et elle n'a jamais déclenché une seule fois. La raison est arithmétique :
**aucune section n'atteint jamais la moitié de son document**. La plus lourde du corpus
d'alors, « Où sont les choses » dans `AGENTS.md`, en faisait 71 % — un cas unique. Partout
ailleurs le document doublait par accumulation de sections moyennes, chacune parfaitement en
règle. Une règle qui ne peut pas se déclencher est une règle qu'on croit avoir.

**Et 36 renvois mentaient en silence.** Le code et les documents renvoient aux documents près
de six cents fois — un « § » qui nomme une section, un numéro qui nomme un chapitre, une
lettre et un chiffre qui nomment une tranche — et rien ne vérifiait qu'une section citée
existait encore. L'extraction du 28 août avait
emporté treize sections de `DESIGN.md` vers `design-motifs.md` ; les trente-trois renvois qui
les visaient étaient restés sur l'ancienne adresse, sans qu'aucun test ne s'en aperçoive.
C'est exactement la fragilité n°1 relevée chez SpriteCook, où la doc publique et le schéma du
serveur ne se recouvraient plus.

**Le banc est donc venu avant le découpage, et non après.** `essais/essai_docs.py` pèse le
corpus section par section — sous-sections comprises, sans quoi le poids d'un chapeau
déciderait à la place de ce qu'il porte — et résout chaque renvoi contre les titres réels du
document visé. Les 36 renvois cassés ont été réparés **avant** la première passe de découpage,
et c'est ce qui a rendu les six suivantes vérifiables : tout renvoi cassé apparu ensuite était
le fait du découpage, et de rien d'autre. Il y en a eu 41, tous repointés.

**Le banc s'est trouvé un trou à lui-même, à la sixième passe.** Il ne lisait que les renvois
écrits avec leur chemin complet ; un sur six s'écrit sans — `` `PLAN.md` `` tout court. Huit
renvois cassés par la quatrième passe étaient donc passés sous son nez pendant qu'il annonçait
tout vert. Il les lit depuis.

**Ce qui est sorti, et où :**

| Passe | Ce qui sort | Vers | Gain |
|---|---|---|---:|
| 1 | le détail des vingt tranches | `docs/tranches/` — un fichier par tranche, de `T1` à `R5` | 50 Ko |
| 2 | la carte fichier par fichier | `docs/carte-du-depot.md` | 33 Ko |
| 3 | les 173 user stories, le carnet des séances | `docs/user-stories.md`, `docs/prd-carnet.md` | 38 Ko |
| 4 | les dossiers de version, §6 à §10 | `docs/archi-versions.md` | 44 Ko |
| 5 | le relevé du fournisseur, §4 bis | `docs/archi-fournisseur.md` | 14 Ko |

L'ancienne archive du plan — un seul fichier pour les dix tranches finies — a été dissoute
dans les vingt : chaque tranche a désormais une adresse, au lieu d'un rang dans un long
document.

**Une décision de méthode, qui a rendu le reste possible : les numéros de section ne bougent
pas.** Soixante-dix renvois disent « §7 » ou « §6.2 ». Renuméroter `ARCHITECTURE.md` après en
avoir sorti cinq sections les aurait tous cassés d'un coup, pour un gain nul. Une section
déplacée **garde son numéro dans son nouveau fichier**, et c'est le fichier du renvoi qui
change. `docs/archi-versions.md` s'ouvre donc sur un §6.

**La règle a changé, et pas dans le sens attendu.** Le plan visait un plafond de 140 Ko, et
le corpus l'a tenu à 139. Le plafond n'a pas été gardé : *un seuil rond refuserait le jour où
l'on écrit une phrase de plus, ce qui n'est pas une faute, et se relèverait le jour où il
gêne, ce qui n'est pas un garde-fou.* Le banc mesure désormais la **dérive** — chaque relevé
comparé au précédent, et le plus haut connu écrit en dur pour que l'échelle ne se perde pas.
Ce qui le fait échouer est ailleurs, et c'est objectif : un renvoi cassé désigne une section
qui n'existe plus.

**Trois manques comblés en passant**, tous trouvés par le découpage et non cherchés : `C4` et
`C5` n'avaient pas de ligne d'état dans le plan ; `mcp/` était encore décrit comme « vide
jusqu'à T7 » ; et deux renvois visaient `AGENTS.md` pour ce qu'il n'a jamais porté — un piège
vit dans `PIEGES.md`, une dette reportée dans le fichier de sa tranche.

## C4 — 29 août 2026

**C4 est écrite : la main rattrape ce que la différence ne voit pas.** Le masque d'un calque
s'affine à main levée puis au pixel, le calque lui-même se retouche au pixel avec le corps en
repère dessous, l'avant et l'après se comparent en maintenant un contrôle, et une colonne de
pièce se trie par la mesure la plus défavorable. **Les sept critères sont cochés, tenus par
16 essais de serveur et 8 d'écran.**

**La décision qui n'était pas dans le cadrage : la retouche ne fait pas que retirer, elle
ramène.** Une seconde couche qui n'aurait su qu'effacer aurait laissé entier le défaut de la
séance du 29 août — *la différence trouve ce qui s'ajoute et manque ce qui se substitue* —,
puisque aucun réglage de masque ne fabrique une différence que la comparaison de couleur n'a
pas vue. La couche tranche donc **après** la mesure et dans les deux sens : elle ôte ce qui est
en trop, et elle ramène les pixels revenus là où la mesure n'a rien trouvé. C'est la seule
moitié de C4 qui répare quelque chose ; l'autre ne fait qu'affiner ce qui marchait déjà.

**Et ça se mesure sur la vraie image.** Le casque du 29 août, celui qui était revenu en semis de
pixels épars : **451 pixels opaques avant, 1 044 après un seul passage de la main**, et le casque
est lisible. L'avant, lui, rend toujours 451 — il se calcule, il ne se garde nulle part.

**Un vecteur, jamais une image.** Une couche enregistre le chemin parcouru et son rayon, pas le
masque qu'il produit. Un masque en octets aurait pesé la taille de l'image à chaque geste, et
surtout il aurait perdu ce qui fait une recette : se rejouer. Le prix est que la rasterisation
doit être déterministe — ce qui est un critère depuis T2, et ce qui a immédiatement coûté un
piège : *une ellipse de taille nulle ne peint aucun pixel*, donc le geste au pixel ne marquait
rien tant qu'il tenait en un seul point.

**Rayon zéro est le pixel.** « À main levée, puis au pixel » n'est pas deux outils : même liste
de points, même rasterisation, un nombre de différence. Deux chemins de code séparés auraient
fini par ne plus se rejoindre au rayon 1, et l'écran aurait dû apprendre lequel appeler.

**Ce que C4 a trouvé en s'en servant, et qui n'était pas de C4.** Ouvrir le panneau sur le
projet réel a rendu **500** : un calque dont le corps a changé de taille — parce que la cible de
pixel du projet a été relevée depuis — ne se rendait plus du tout. Le défaut est de C3 ; C4 l'a
**révélé** en ajoutant deux places à la recette, donc en faisant recalculer tous les calques
d'un coup. Ce qui l'avait rendu invisible est le cache : tant qu'une recette ne bouge pas, son
rendu est servi depuis le disque et personne ne recalcule rien. *Un cache cache aussi les pannes
du calcul qu'il remplace* (`docs/PIEGES.md`). Un corps qui a changé de taille est désormais
traité comme un corps disparu.

**Deux refus, et ils tiennent le motif.** Le tri par le pire n'est pas le défaut — le plan du
jeu reste l'ordre des rangées, parce que c'est celui de l'auteur et le seul dans lequel une case
*vide* se lit. Et « ce qui reste à regarder » ne s'écrit nulle part : c'est un calque sur lequel
la main n'est pas passée, et ça se lit dans sa recette, comme *ceci est un calque* depuis C3.

**Ce qui reste ouvert.** Le produit ne dit toujours pas **d'avance** qu'une pièce va se
substituer : aucune des cinq mesures ne l'annonce — celle du 29 août affichait une échelle à
1,00 et une silhouette à 100 %. Le risque a changé de gravité, pas de nature.

## C5 — 29 août 2026

**C5 est écrite : le personnage part dans le jeu, et l'agent a la boucle entière.** Ses poses
et ses calques se posent dans le dossier du jeu, à plat, avec un descriptif qui dit ce qu'est
chaque fichier — sa pose, sa pièce, la place de cette pièce sur le corps et son rang. Cinq
outils MCP complètent le plan sans que l'écran soit ouvert : lire ce qui manque, ajouter une
attitude, remplir, habiller, livrer. **Les huit critères sont cochés, tenus par 22 essais de
serveur et 4 d'écran.** Elle a été écrite pendant que C4 s'éprouvait encore : le plan la
disait recommandée mais non bloquante, et elle l'était.

**La décision qui n'était pas dans le cadrage : ce qui sort est ce que la matrice retient.**
Un corps par pose, un calque par pièce — le favori d'abord, sinon la plus récente. Sortir les
quatre variations d'une pose aurait rendu le tri à qui ouvre le dossier, alors que l'auteur y
a déjà répondu en marquant son favori, et « utilisable sans manipulation » dit exactement le
contraire de « choisis toi-même ». La règle n'a pas été écrite pour l'occasion : c'est
`corps_retenu`, celle qui compose déjà la planche d'équipement de C3. Un second barème aurait
fait sortir une autre image que celle que l'écran montre comme le corps de la pose.

**À plat, et c'est un refus.** Pas de sous-dossier par personnage, pas de convention de
moteur : « aucune structure inventée » ne s'arrête pas au code de jeu. Un dossier
`sprites/héros/` créé d'office est une décision de rangement prise pour un jeu dont l'atelier
ne sait rien. Ce qui remplace la structure est le descriptif, et c'est pour ça qu'il porte le
**rang de l'emplacement** : sans lui, un agent qui empile un casque et une cape doit inventer
lequel passe devant.

**Ce que la première sortie d'un vrai personnage a trouvé, et qu'aucun essai ne voyait.**
Balthazar est sorti en sept fichiers ; l'un d'eux, annoncé « calque », montrait un nain
entier. La pièce était le casque de `coeur de pierre - 01`, déclarée « agrandit » : ce qui
était revenu n'était pas un calque mais un **corps habillé** (US-148), et le descriptif le
donnait à empiler sur le corps. Ce qui l'avait rendu invisible est le montage des essais —
une pièce « contenue » qui revient à l'échelle produit toujours un vrai calque, donc le seul
cas qui distingue les deux n'était jamais joué là où le rôle s'écrit. Le rôle vient
maintenant de `Recette.calque`, la question que l'écran pose déjà pour afficher « ceci n'est
pas un calque », et il y en a trois : `corps`, `calque`, `corps_habille`.

**Ce que C5 a trouvé et qui n'était pas de C5 : deux endroits écrivaient le sujet d'une
case.** L'écran le composait depuis C1 — signalement du personnage et nom de l'attitude pour
une case, signalement seul pour un lot, description de la pièce pour une planche. L'agent arme
les mêmes cases ; laisser le MCP le recomposer aurait fait une seconde vérité, et laisser
l'agent le retaper aurait rompu la promesse d'US-115 au premier appel payé. La composition est
donc descendue dans `ServiceProduction.sujet`, l'écran la demande en armant, le MCP l'appelle
en générant. Le prix est un aller-retour de plus sur un geste local et gratuit — et un refus
n'empêche pas d'armer : la case est visée, le champ reste à écrire.

**Le MCP a perdu sa dernière logique.** `export_assets` rouvrait l'archive de T6 pour en
ressortir les fichiers un par un : la seule fonction du serveur qui *faisait* quelque chose,
donc la seule entorse à l'invariant de T7. Le geste vit dans le service, les deux sorties le
partagent, et l'essai qui lit les imports interdit maintenant `zipfile` en plus des quatre
autres. Un invariant se répare mieux le jour où l'on rouvre le fichier pour une autre raison.

**Ce qui reste ouvert.** Personne n'a encore sorti un personnage dans un vrai jeu : la règle
du dépôt — *une tranche n'est finie que lorsqu'on s'en est servi* — n'est pas encore tenue
pour C5. Deux points attendent cette séance-là : les gestes de finesse de C4 ne sont pas
exposés à l'agent (borner, affiner, retoucher demandent un œil, et on verra si l'agent les
réclame), et le vestiaire reste un geste d'auteur — l'agent s'en sert, il ne le peuple pas.

## R5 — 29 août 2026

**R5 est écrite : un calque se recale sans repayer.** Le geste part d'une image sortie d'une
planche d'équipement, relit la planche payée, et repose l'alignement, les cinq mesures et le
verdict sur les assets déjà nés — même identifiant, même rang, même place en bibliothèque.
**Les neuf critères sont cochés, tenus par 9 essais de serveur et 2 d'écran.**

**Le problème que les essais devaient poser, et comment.** Rejouer le même calcul rend le même
résultat : un essai qui déplierait puis rejouerait sans rien changer entre les deux ne
prouverait même pas que le rejeu a lu la planche. Deux montages le rendent visible — **abîmer
le brut du calque** puis rejouer, et il revient ; **changer la portée de la pièce** entre les
deux, et le verdict bascule pour la planche entière sans qu'un identifiant bouge.

**Une seule lecture de planche pour les deux chemins.** Le dépliage et le rejeu doivent tomber
sur exactement le même résultat, sans quoi recaler changerait l'image pour une raison qui n'est
pas le défaut qu'on répare. C'est la raison qui avait déjà sorti `decouper_retour` de `deplier`
en C3, appliquée un cran plus haut.

**Et ce que le rejeu a mesuré sur les six planches du 29 août.** **Cinq sur six bougent**, pas
quatre : aux deux calques manifestement faux et aux deux corps habillés prononcés sur une
échelle inventée s'ajoute un calque dont l'échelle était juste et dont le *placement* se
déplace — le critère monotone départageait aussi les décalages. La sixième, seule produite
après la correction, revient **identique**. Le rejeu est donc fidèle là où il n'y a rien à
réparer, et ne change que ce que le défaut avait changé. Vérifié sur une **copie** du dossier
de données : rien n'a été écrit dans celui de l'auteur.

## La première séance de C3 — 29 août 2026

**C3 a servi, sur un personnage qui portait déjà la pièce, et six planches ont été payées** —
un seul modèle, deux pièces, un casque et une hache, chacune envoyée aux deux occupations,
0,92 et 0,62. Dixième fois de suite que se servir d'une tranche trouve ce qu'aucun test ne
voyait.

**Le défaut : le recalage cherchait sur une note qui ne peut que monter.** Chaque échelle
candidate était notée à la part du corps qu'elle recouvre — une mesure juste, et monotone :
agrandir le revenu finit toujours par tout recouvrir, donc le critère demandait « quelle est la
plus grande échelle ? » et la bonne réponse ne gagnait que par l'égalité. Un aller-retour de
rééchantillonnage coûte deux pour mille de contour ; l'égalité tombait, et une planche revenue
intacte était déclarée revenue à 0,58×, le calque valant toute la silhouette au lieu du seul
casque. On cherche désormais sur le recouvrement rapporté à l'**union**, et on rend la
couverture au placement retenu. Les essais ne l'avaient pas vu parce qu'ils dessinent des blocs
pleins, qui traversent un rééchantillonnage sans perdre un pixel. `docs/PIEGES.md` le porte,
avec le corollaire : *une note qui ne peut que monter avec le paramètre qu'on optimise n'est pas
un critère, c'est un classement du paramètre.* La correction porte la suite de serveur de 343
à **345 essais** ce jour-là.

**La toile avec marge a été tirée, et elle n'a pas eu à servir.** L'échelle au retour est
restée dans la tolérance sur les six planches, à 0,92 comme à 0,62. Ce n'est pas l'hypothèse
validée — elle n'a pas été mise à l'épreuve, faute que le dézoom qu'elle prévient se présente.
Le seul risque de méthode de la V2 tombe donc, et un autre le remplace, mesuré celui-là : **la
différence trouve ce qui s'ajoute et manque ce qui se substitue.** Le casque est revenu en
poussière — même empreinte que la chevelure qu'il remplace, valeurs voisines, et la tolérance
au voisin de 3×3 qui protège du bruit de recalage l'efface avec lui. Et la hache dit les deux
moitiés du défaut à elle seule : son fer, qui dépasse de la silhouette, revient entier au pixel
près ; son manche, là où il croise le bras, ne revient pas. Encore deux décisions justes
séparément dont la composition perd quelque chose. Ce n'est ni cadré ni planifié :
`docs/releve-usage.md`.

**Et la décision de la séance : une planche déjà dépliée ne réaccouche jamais ; ce qu'elle a
calculé se rejoue.** Quatre images fausses restent sur le disque — deux calques figés sur un
mauvais recalage, deux corps habillés prononcés sur une échelle inventée — alors que les
planches qui les ont payées sont là. Redéplier aurait créé des rangs neufs, obligé à supprimer
les anciens, et laissé orphelins les calques qui désignent leur corps par identifiant : c'est un
piège, pas un geste. Ce qui se rejoue est le calcul, sur les assets déjà nés — même
identifiant, même rang, même place. Ce qui l'autorise tient en une phrase qui dépasse le
calque : **le brut d'un calque n'a jamais été l'image payée** ; l'image payée est la planche, et
un brut dérivé est un cache. C'est R5 dans `docs/PLAN.md`.

## C3 — 29 août 2026

**C3 est écrite : la pièce et le calque.** Un projet porte des emplacements ordonnés et des
pièces décrites une fois ; on coche les poses à habiller, l'atelier compose lui-même la
planche des corps existants, l'envoie en un appel, redécoupe le retour sur la grille qu'il a
posée et compare case par case. Chaque différence est un calque, propre à sa pose. **Les
seize critères sont cochés, tenus par 18 essais de serveur et 9 d'écran.**

**Le pliage de C2 a été réemployé sans être rouvert, et c'est ce qui rend la tranche
courte.** La grille, le gabarit, le découpeur, le compte et son refus arithmétique n'ont pas
bougé d'une ligne : `decouper_retour` a simplement été extraite de `deplier`, et les deux
usages l'appellent. Un booléen — `geometrie_connue` — distingue toujours les deux, et une
seule ligne du service de génération aiguille entre « ranger N corps » et « fabriquer N
calques ». La prédiction écrite en C2 s'est vérifiée telle quelle.

**La décision de la tranche : un calque est un asset, et c'est sa recette qui le dit.** Le
cadrage promettait « une recette, pas un fichier figé » ; la conséquence exacte est une
sixième place dans la recette, `différence`, qui nomme l'asset du corps et le masque
rectangle. Trois critères deviennent alors vrais *par construction* au lieu d'être tenus à la
main — le corps n'est jamais modifié, le masque se déplace sans un centime, et vider la zone
rend la différence brute. Il n'existe nulle part un drapeau « ceci est un calque » : un corps
habillé porte la même pièce et la même pose, et seule l'absence de différence l'en sépare.

**Deux pièges payés le même jour, et ils se ressemblent.** Le premier : la plage d'échelles
du recalage ne contenait pas 1,00 — 0,99 puis 1,01 —, donc une case revenue rigoureusement
identique se rééchantillonnait d'un centième et sa silhouette entière ressortait en *ajout*.
Le second : `recadrer_sur` alignait, puis `mesurer_calque` cherchait un **second** alignement
sur le résultat déjà aligné, et le calque affiché n'était plus celui qu'on venait de mesurer.
Les deux fonctions étaient justes ; c'est leur composition qui perdait quelque chose — très
exactement la famille de défaut que T9 avait trouvée en mettant une conception à juger. Tous
deux sont dans `docs/PIEGES.md`.

**Ce que la tranche n'a pas fait, et qu'il faut dire.** Elle n'a pas servi au navigateur, et
elle n'a tiré **aucun appel payant**. La toile avec marge — le seul risque de méthode qui
reste en V2 — est écrite, mesurable et repliable : la toile part à 0,62, l'échelle au retour
est mesurée case par case, et une dérive au-delà de 0,08 rend des corps habillés au lieu de
calques sans qu'aucune image ne soit perdue. Il reste à savoir laquelle des deux branches le
produit prendra, et ça coûte un appel.

*(Écrit à la livraison. La séance est venue le jour même — voir l'entrée en tête : l'appel a été
tiré six fois, la marge n'a pas eu à servir, et un défaut de recalage qu'aucun des vingt-sept
essais ne voyait a été trouvé.)*

## R4 — 29 août 2026

**R4 est écrite, et les quatre reprises sont finies.** L'infobulle sort désormais du panneau
qui porte son ancre, au lieu de choisir son côté par rapport au milieu de la fenêtre. **Les
six critères sont cochés, tenus par 12 essais de placement et 6 d'écran** ; aucun essai de
serveur n'a bougé, parce que rien du serveur n'a bougé.

**La règle d'avant n'était pas approximative, elle était juste au mauvais endroit.** Elle
disait *jamais sur l'image qu'elle règle*, et la mesurait contre le milieu de l'écran. À
l'atelier c'est vrai — l'autre moitié est la grille. À l'univers, aux réglages et dans la
fiche, l'autre moitié est encore du réglage, et le cas le plus net est celui des réglages :
un panneau de 520 px posé au milieu, une ancre dans sa moitié gauche, donc à gauche du milieu
de la fenêtre, donc une bulle qui s'ouvrait **sur le panneau lui-même**.

**Les panneaux se déclarent, l'infobulle ne les connaît pas.** Six panneaux portent une
marque, et le placement remonte de l'ancre au premier ancêtre marqué. L'alternative — une
liste d'écrans tenue dans l'infobulle — aurait fait de ce composant l'endroit qu'il faut
modifier chaque fois qu'un panneau naît ailleurs. Sans marque, le calcul retombe sur l'ancre :
la barre d'outils traverse l'écran, « hors du panneau » n'y voudrait rien dire, et elle garde
la règle d'avant là où elle était juste.

**Le calcul est sorti du composant parce que jsdom ne met rien en page**, et cette fois-ci
c'était décisif et non confortable. Un essai qui monterait l'écran Univers et mesurerait le
recouvrement lirait des rectangles nuls : il passerait avant la correction comme après, et
attesterait d'une règle qu'il ne vérifie pas. `placer()` prend donc des rectangles et rend
une position — le précédent de `Toile.test.tsx`, invoqué pour la même raison. L'écran, lui,
prouve ce que jsdom sait voir : que chaque panneau se déclare. Aucune des deux moitiés ne
suffit, et un essai nomme l'erreur d'avant pour montrer qu'elle tombe.

**Elle a été vue à l'écran, sur les trois cas.** L'univers : la bulle « Bible » couvrait
Palette, Taille de pixel, Barème et Modèle par défaut ; elle s'ouvre maintenant à droite du
panneau, sur le tableau. La fiche : « Détourage » part à gauche, sur la grille. Les réglages :
le panneau mesuré à 373–893, la bulle posée à 903 — dehors, à l'écart près.

**Le prix payé, et il est écrit** : la bulle peut recouvrir *un autre* panneau. Ouverte depuis
les réglages, elle atterrit sur la fiche restée derrière, inerte tant que les réglages sont
ouverts. La règle protège le panneau qu'on est en train de régler ; protéger tout l'écran
demanderait de replier la bulle sous son libellé, et ce n'est pas ce motif-là.

## R3 — 29 août 2026

**R3 est écrite — faire entrer une image depuis l'écran.** Un bouton dans la barre d'outils,
et le glisser-déposer sur la grille. L'image devient un asset entier : retouche, découpe,
export, suppression avec annulation, et sa fiche dit d'où elle vient — importée, coût nul, le
nom du fichier. **Les dix critères sont cochés, tenus par 18 essais de serveur et 5 d'écran.**

**La seule pièce neuve du serveur est une route qui prend les octets**, parce que celle qui
existait prend un *chemin* — ce qu'un navigateur ne donne jamais. Les deux appellent le même
service que l'outil MCP, et il n'y a donc toujours qu'un endroit du produit qui fasse entrer
une image. Les octets voyagent bruts, en corps de requête : la décision de `POST /board/paste`
en T4, reconduite sans la rediscuter — `multipart` demanderait une dépendance d'exécution de
plus pour transporter ce qu'un `POST` transporte déjà.

**Le service a changé de réponse plutôt que de place.** Il rend maintenant *ce qui est entré*
**ou** *ce qui était déjà là* : un doublon n'est pas un refus, donc il ne lève pas. C'est la
forme du collage du tableau, et c'est la leçon de C1 appliquée — *un objet a la même forme sur
toutes les routes qui le portent*, l'outil MCP compris. Cinq essais de T7 et de C1 ont été
repris pour cette raison-là, et c'est le prix juste d'un contrat qui a changé.

**Le défaut est passé à « telle quelle », et il vaut aussi pour l'agent.** Le PRD ne parlait
que de l'écran ; l'étendre à l'agent change son comportement d'avant, et c'est assumé : le
défaut d'hier — hériter de la recette du projet en silence, donc ramener une référence de 2048
pixels à 64 — est très exactement le défaut que la reprise corrige. Un agent qui le garderait
ferait vivre l'auteur et lui dans deux produits différents.

**La décision voyage sur la génération, et un essai le prouve après reconstruction.** L'index
est jetable : ce qui n'est pas dans un `generation.json` n'existe plus à la première évolution
du schéma, et une image entrée telle quelle se retrouverait sinon ramenée sur la grille du
projet un matin, sans que personne l'ait demandé.

**Et elle n'a rien coûté au balayage de palette.** Une recette vide est déjà ce que « Tout
réaligner » laisse tranquille — « un asset ramené au brut reste au brut » (US-64). Une image
entrée telle quelle le reste donc sans qu'aucune règle nouvelle ait eu à le dire : le signe
que la décision est posée au bon endroit.

**Une fonction a déménagé, et c'est le précédent de `teinte.py` qui l'a décidé.** L'empreinte
qui nomme un doublon vivait dans la carte du tableau ; la bibliothèque en a désormais besoin
aussi. Deux familles d'images l'appellent et aucune ne la possède : elle est passée dans
`atelier/image/mesures.py`, où elle ne parle que d'octets.

**L'écran a quand même été ouvert, et il a rendu un défaut qu'aucun essai ne pouvait voir.**
Les commandes d'import prenaient 151 px dans la barre d'outils et poussaient le bloc de gauche
32 px au-delà de sa largeur à 1280 : le cran de zoom 4× sortait de l'écran. La bascule dit
maintenant **brute / traitée** — le vocabulaire que la fiche emploie déjà pour le brut et le
rendu — et le groupe tient en 109 px, débord nul. Une largeur ne se prouve pas dans jsdom, qui
ne met rien en page ; elle se mesure dans un navigateur, ou elle ne se mesure pas.

**La séance d'usage complète n'a pas encore eu lieu**, pour R2 comme pour R3.

## État au 29 août 2026

**R2 est écrite — ce qui décide de l'apparence se voit et se règle.** C'est la plus grosse des
quatre reprises, et la seule qui touche à la fois au prompt, à l'univers et à la fiche. Un
dépliant sous le champ de prompt montre le texte exact qui partira — bible active, sujet,
consignes de planche —, et un geste le bascule en édition libre pour cette génération-là. La
bible passe de cinq champs nommés à sept : la technique de rendu et la vue et cadrage, qui
étaient exactement les deux consignes retapées dans chaque prompt le 28 août. La taille de
pixel accepte « aucune ». Et la fiche dit enfin ce que le projet a imposé à l'image affichée.
**Les treize critères sont cochés, tenus par 20 essais de serveur et 9 d'écran.**

**Le défaut réparé est un défaut de composition, pas de code**, et c'est la troisième fois que
le dépôt en trouve un — après la toile de T9 et le réglage d'univers de R1. « La dérive de
grille est le cas normal, pas l'incident » est juste. « Le style vient de la bible, et d'un
seul endroit » est juste. Ensemble, elles produisaient un atelier qui **imposait une apparence
que l'auteur n'avait jamais posée** : la séance du 28 août l'a mesuré sur trois projets réels
— les cinq champs de bible vides dans les trois, donc rien du style ne partait, et pourtant
tout ressortait en pixel art de 64 pixels. Aucun test ne pouvait le voir : les deux moitiés
faisaient exactement ce qu'on leur demandait.

**Un seul endroit compose le prompt, et l'aperçu emprunte ce chemin-là.** C'était la décision
de conception de la tranche, et elle a coûté un aller-retour local par frappe — atténué de
140 ms, sans réseau, sans écriture. L'alternative aurait été de recomposer à l'écran : deux
compositions qui divergent au premier champ ajouté, et celle qu'on regarde n'est pas celle qui
part. L'essai qui le tient ne compare pas l'aperçu à lui-même mais **à ce que le fournisseur a
reçu** — un aperçu vérifié contre sa propre logique ne prouverait que sa propre logique.

**Elle a réparé un défaut que personne n'avait signalé.** « Reprendre les réglages » d'un asset
reposait dans le champ de l'atelier le prompt **déjà habillé** — bible comprise —, que l'atelier
rhabillait ensuite : la bible partait en double, à chaque reprise, depuis T4. Le geste rend
désormais la main à l'auteur en mode repris, donc ce qui repart est exactement ce qui était
parti. Personne ne l'aurait trouvé sans écrire le mode repris : il fallait que les deux
chemins existent pour que leur composition devienne visible.

**« Aucune » est une valeur, pas un réglage éteint**, et le dire ainsi a décidé du code : zéro
est traité **à part** du contrôle de bornes plutôt qu'en élargissant le minimum, sans quoi 1, 2
et 4 pixels seraient passés. Sans cible, la grille **disparaît** de la recette au lieu de valoir
zéro — un asset ne doit pas porter une remise sur grille que le projet n'impose plus —, et
« Tout réaligner » la retire donc au lieu d'en poser une, en le disant avec son compte.

**Et ce que le projet impose se calcule, il ne se range pas.** La fiche demande « qu'est-ce que
le projet impose *maintenant* » : une valeur enregistrée à la naissance aurait vieilli au premier
réglage d'univers, et la fiche aurait comparé l'image à un souvenir. C'est une route à part de
l'asset, parce que la grille en affiche deux cents à la fois pour une phrase que seule la fiche
montre — le même raisonnement que la réserve de T8, un cran plus bas.

**La séance d'usage au navigateur n'a pas encore eu lieu**, et la règle du dépôt tient : *une
tranche n'est finie que lorsqu'on s'en est servi*.

## État au 28 août 2026

La chaîne de cadrage est finie — PRD, architecture, design, plan — et **le code a
commencé**. `docs/PLAN.md` fait foi sur ce qui reste.

**T1, T2, T3, T4, T5 et T6 sont finies.** T1 : le squelette, la clé, le catalogue relu au
démarrage, un appel qui rend une image téléchargeable ; l'écran Atelier ; le flux
d'événements qui remplace le sondage, la jauge déterminée, la reprise vue du navigateur et
le repli hors ligne. T2 : l'asset, la recette, le rendu-cache, le détourage en plusieurs
passes, la remise sur grille, la quantification grisée, les recettes nommées, et la fiche.
T3 : la bibliothèque — projets et collections, une seule grille filtrable et cherchable, la
sélection multiple, le favori, la suppression avec son annulation courte, la filiation, le
journal des appels ratés, la réinjection dans ses quatre rôles, et l'index reconstructible.
T4 : le tableau d'inspiration et l'univers — coller une image, une adresse ou un texte,
promouvoir en artwork officiel par famille, la palette extraite par calcul, la bible en
champs nommés, le barème d'échelles, la taille de pixel imposée, la quantification allumée,
et la palette rétroactive. T5 : le slicer — les zones opaques connexes, la grille fixe, les
rectangles dessinés à la main, la filiation de découpe ; **plus les deux dettes reportées**,
le zoom de la grille et la première exécution du second moteur de détourage. T6 : l'export —
une sélection qui sort en archive avec son descriptif, et le grisé permanent qui dit
pourquoi quand rien n'est sélectionné. **Les soixante et onze critères d'acceptation de T1 à
T6 sont cochés dans `docs/PLAN.md`, et 120 tests de serveur plus 31 d'écran les tenaient.**

**T7 est finie, et la V1 avec elle.** Le MCP : onze outils épais, façade sur les services que
l'écran appelle déjà, montés dans le **même processus** que l'API sur `/mcp` ; les deux
garde-fous relus à chaque appel — plafond de la séance, modèle d'exploration imposé — ; le
dossier du jeu et ses trois règles ; la provenance portée par la génération et héritée par
l'asset ; et l'écran Réglages qui tient enfin les trois questions promises depuis T1 — clé,
garde-fous, dossiers. **Les quatre-vingt-quatre critères d'acceptation de T1 à T7 sont cochés
dans `docs/PLAN.md`, et 145 tests de serveur plus 35 d'écran les tiennent.**

**Ce qui vient après n'est plus la V1, et T8, T9 et T10 sont finies.** T8 : le tableau
d'inspiration a sa seconde vue — un plan qu'on déplace et qu'on zoome, des îlots nommés, une
réserve à droite. T9 : ce que T8 permet de ranger, T9 permet de le **dire** — un trait d'un objet à
un autre, une note posée à même la toile, et six teintes sourdes. T10 : deux décisions de T8 que
l'usage a démenties — un îlot se **déplace** par la bande de son titre, avec ce qu'il contient, et
un îlot que le geste en cours ferait disparaître le dit en `--echec` pendant qu'on le fait. **Les
cent quinze critères d'acceptation de T1 à T10 sont cochés dans `docs/PLAN.md`, et 195 tests de
serveur plus 80 d'écran les tiennent.** Le plan n'a plus de tranche ouverte.

**C2 est écrite — le lot plié.** On coche des attitudes, elles partent en **un seul appel**, et
la planche se déplie toute seule en autant d'images de corps qu'il y avait de cases. Neuf poses
coûtent un appel au lieu de neuf, et le journal du projet le montre. Si le compte ne tombe pas
juste, **rien n'entre** et le lot se relance d'un geste, au prix plein — c'est le seul refus
automatique du produit, et il est arithmétique. Ressemblance entre cases et dérive de grille
s'affichent case par case et n'empêchent jamais de garder. **Les douze critères sont cochés,
tenus par 34 essais de serveur et 6 d'écran** ; la séance d'usage au navigateur, elle, n'a pas
encore eu lieu, et la règle du dépôt tient — *une tranche n'est finie que lorsqu'on s'en est
servi*.

**Le pliage n'a pas été écrit pour les personnages, et c'est la décision de la tranche.** Il vit
dans un module pur et un service qui ne connaissent ni personnage ni pose : ils parlent de
*cases*, et c'est le service de génération — le seul qui sache déjà relier un appel à une case
— qui les compose. C3 le réemploiera tel quel pour la planche d'équipement, sans le rouvrir.

**Il a été éprouvé sur les vingt-quatre planches réelles du 28 août avant qu'une ligne de
service soit écrite**, et il y trouve exactement le compte que le banc avait mesuré — zéro écart
sur vingt-quatre. C'est l'antidote direct au piège de C1 : *un double écrit d'après l'intention
prouve l'intention, pas le serveur*. Le même passage a donné ce que le produit affiche sans
inventer de seuil — les deux planches qui répétaient une pose ressortent à 0,999 et 1,000, les
vingt-deux autres plafonnent à 0,897.

**Trois choses ont été tranchées en écrivant, et elles se paient toutes de la même façon** : la
planche payée n'est **pas** un asset — elle reste le brut de sa génération, donc « aucune feuille
assemblée n'est livrable » est vrai par construction et non par un filtre —, le gabarit ne
s'enregistre nulle part mais compte comme une référence, et un compte faux est un emplacement
échoué, ce qui rend la relance de T1 applicable telle quelle sans inventer d'état. Le prix des
trois est écrit dans `docs/PLAN.md` : les N corps n'ont pas de parent, on ne voit pas ce qui
revient quand le compte tombe faux, et un lot refusé n'est relançable que dans l'onglet qui l'a
vu échouer.

**Et la privation de C1 a tenu.** La matrice gagne une case à cocher par rangée, et elle
n'offre toujours pas de sélection multiple : ce qui se coche est une **attitude**, pas une
image. Un essai d'écran confronte l'intitulé de chaque coche à sa forme et tombe le jour où
l'une passera sur une vignette.

**C1 est finie, et la V2 a commencé.** Le personnage, son plan, une pose, et ce qui part avec
elle. Un jeu porte **une** liste d'attitudes — repos, marche, mort —, écrite une fois et déjà
là au premier lancement ; chaque personnage coche celles qu'il tient, se décrit une fois, et
sa matrice dit d'un coup d'œil ce qui est fait et ce qui manque. On arme une pose depuis une
case vide, on paie depuis l'atelier. Une carte du tableau se désigne concept art et **reste où
elle est** ; avant de lancer, chaque référence se lit ligne par ligne avec sa provenance, et
se décoche pour cette génération, pour ce personnage, ou pour tout le projet. Et n'importe
quelle fiche nomme enfin le modèle qui a produit son image. **Les cent trente-trois critères
d'acceptation de T1 à C1 sont cochés dans `docs/PLAN.md`, et 233 tests de serveur plus 105
d'écran les tiennent.**

**Quatre décisions de construction, et trois défauts trouvés en s'en servant.** Les décisions
sont dans `docs/archive/plan-versions-tenues.md` § C1 et `docs/archi-versions.md` §7 : un seul plan par projet, le
personnage qui range **ce qu'il écarte**, la case déduite des images plutôt qu'enregistrée, et
le coût annoncé **mesuré** au lieu d'être lu dans un tarif que le produit ne porte pas.

Les défauts, eux, viennent tous de la même racine, et c'est une racine neuve : **un objet qui
voyage par deux routes doit avoir la même forme sur les deux.** Le personnage porte des cases
*déduites*, et seul le tableau de bord les mettait dans sa charge — la réponse du `PUT` et
l'annonce du flux rendaient le même objet sans elles. Or l'écran fond ce qu'il reçoit par les
deux chemins avec le même code, depuis T1 : écrire une description remplaçait donc un
personnage entier par un personnage à trous, la matrice se vidait, et le rendu suivant tombait
sur un écran blanc. **La fonte par identifiant ne protège que de l'empilement** ; elle suppose
que les deux chemins portent la même chose, et personne ne l'avait écrit. Le même défaut vu de
l'autre bout : élargir la portée d'un décochage écrivait bien sur le disque, mais rien ne
redemandait ce qui part. Et le troisième était une **copie périmée** — la case visée gardait
l'objet du moment où on l'avait armée ; elle ne garde plus qu'un identifiant.

**Ce qui les avait rendus invisibles mérite d'être écrit** : le double des essais d'écran, lui,
rendait la forme entière. Je l'avais composé en sachant ce que le serveur *devait* faire, et
les 105 essais passaient donc au vert sur un contrat que personne ne tenait. *Un double écrit
d'après l'intention prouve l'intention, pas le serveur.* Les trois sont dans `docs/PIEGES.md`.

**Et écrire le motif d'écran a corrigé le code une quatrième fois, puis deux.** Le nom d'un
personnage était en serif 24 px dans un champ, ce que la règle 1 du § Typography interdit en
deux mots ; l'état vide de la colonne de droite répétait en mono l'explication déjà posée à
gauche ; et un commentaire promettait un bouton grisé que le code, avec raison, ne posait pas.
Trois riens — mais chacun n'a été vu qu'en écrivant *pourquoi c'est comme ça*, ce qui est
exactement à quoi sert `docs/design-motifs.md`. La section « L'écran Personnages » les porte.

**T10 a été utilisée pour de vrai, et ça a trouvé quatre défauts.** Huitième fois de suite, et trois
des quatre de la même racine : *une surface que le produit tient à la main, et qui n'avait pas dit à
la librairie de plan qu'elle lui appartenait*. Tirer un îlot par sa bande déplaçait l'îlot **et** le
plan du même écart — l'îlot à deux fois la main, le fond à une fois, c'est-à-dire une **parallaxe**
sur la seule surface du produit dont tout le propos est de savoir où sont les cartes. La poignée de
largeur, le menu de teintes et le champ d'une note avaient le même trou, et `nodrag` était là, qui
paraissait suffire. S'y ajoutait le déplacement automatique de la librairie dès qu'un nœud tiré passe
à moins de 40 px d'un bord, la réserve étant collée au bord droit. Le quatrième est ailleurs : le
menu de teintes d'un îlot était **inatteignable à la souris**, le pointeur qui montait vers lui
quittant la bande, seule surface qui le tenait ouvert. `docs/archive/plan-versions-tenues.md` § T10 dit pour chacun ce qui
l'avait rendu invisible.

**Un îlot se déplace, et ça ne fait pas de lui un objet.** Il n'a toujours ni identité, ni fichier,
ni position à lui : le déplacer, c'est écrire la place de chacune de ses cartes, en **un seul
appel** (`PUT /api/board/groups/move`). Un appel par carte rendrait possible l'état où sept ont
bougé et cinq sont restées — c'est « deux appels pour un geste sont un état de trop » appliqué à un
geste qui en aurait demandé douze. La route exige donc **toutes** les places de l'îlot et rien
d'autre, les vérifie avant d'écrire la première, et ne reclasse rien : déplacer un rangement, ce
n'est pas ranger ce qu'il contient.

**Un lien est le seul objet neuf du modèle depuis T4, et il naît muet.** Ni mot, ni pointe : un
trait nu dit déjà « ceci a rapport avec cela », et c'est le cas courant — *le défaut est muet,
l'exception s'exprime*. Une extrémité est une carte par identifiant **ou** un îlot par nom de
groupe, et le couple `(genre, valeur)` existe parce que les deux ne se nomment pas dans le même
espace. Il ne survit pas à ses extrémités, et c'est la **suppression** qui l'emporte, jamais un
balayage : un trait vers rien ne représente rien, et une entrée morte sur le disque serait une
deuxième vérité qui attend son heure.

**La teinte d'un îlot vit sur le projet, jamais dans son univers ni sur ses cartes.** Sur ses
cartes, six membres feraient six vérités possibles pour un seul cadre. Dans `Univers` — « ce que le
projet impose à ce qui rentre, et ce qu'il envoie avec » —, elle aurait été le premier champ à
démentir cette phrase : une teinte n'impose rien et ne part nulle part. Une **note**, elle, *est* un
objet et porte la sienne. Une carte image n'en porte aucune, et c'est un critère : colorier chaque
carte reconstruirait un second rangement, concurrent du groupe.

**Une revue adversariale a suivi la tranche, et elle a trouvé quatre défauts de plus.** Vingt-quatre
trouvailles sur cinq lentilles, chacune soumise à **trois sceptiques chargés de la réfuter** ; six
ont survécu, dont quatre disaient la même chose. La plus utile ne portait pas sur le produit mais
sur ce qui est censé le garder : *un essai passait pour une autre raison que celle qu'il annonçait*
— la borne du mot d'un lien était éprouvée sur une paire déjà jointe, donc le refus rendu était
« ces deux-là sont déjà joints », et l'essai aurait passé même si la borne n'existait pas. **Une
assertion négative ne prouve rien**, encore, et cette fois-ci sur nos propres essais.

**T9 a été conçue par un panneau avant d'être écrite, et ça a trouvé le défaut le plus grave.**
Trois conceptions indépendantes des quatre gestes ouverts, trois juges — les documents, l'usage, les
pannes —, et le verdict a nommé un état que ni le serveur ni l'écran n'auraient signalé : *sortir la
dernière carte d'un îlot efface ses liens et sa teinte, et Ctrl+Z ne rendait que le groupe*. Chacun
des deux gestes est correct isolément ; c'est leur composition qui perdait quelque chose, en
silence. Première fois que ce dépôt fait ça, et à refaire.

**La toile ajoute deux champs à la carte, et pas une entité.** `position` et `largeur_libre`
sont portées par la carte elle-même — un `toile.json` par projet aurait la panne qui a déjà
valu son refus à `cartes.json`, et sur une toile ce n'est plus une hypothèse mais le régime
normal. Elles s'écrivent par la route qui portait déjà le groupe : tirer une carte dans un
îlot écrit sa place **et** son groupe, et deux appels rendraient possible l'état où l'un est
écrit et l'autre non — la divergence que toute la tranche est là pour empêcher.

**Un îlot n'est écrit nulle part : il est l'étendue de ses membres.** Un îlot *est* le
groupe, donc il n'a ni identité, ni fichier, ni position à lui, et l'écran le calcule à
chaque rendu. Il n'existe aucun état où la toile montrerait un rangement que le disque ne dit
pas, et un îlot vide n'existe pas faute de quoi l'écrire. `docs/archi-versions.md` §6.5
annonçait `parentId` + `extent: "parent"` : ce mécanisme *enferme* un enfant dans son parent,
donc il interdit très exactement « sortir une carte de son îlot ». Le document a été corrigé.

**T8 a été utilisée pour de vrai, et ça a trouvé cinq défauts.** Septième fois de suite.
Trois de la famille qui revient depuis T5 — *une règle déléguée à autre chose, dont personne
n'a mesuré le résultat* — dont deux fois le même `ResizeObserver` : la librairie de plan
cache un nœud dont elle ignore la taille, et elle l'apprend par lui, si bien que **toute la
toile était invisible dans un onglet d'arrière-plan** ; et son cadrage d'ouverture renonçait
en silence pour la même raison. Deux d'une famille neuve — *un garde juste dont l'hypothèse
est fausse* : Ctrl+Z n'annulait rien parce qu'il voyait un champ de saisie actif, celui du
prompt de l'atelier, resté focalisé **derrière** l'écran Univers qui le couvre. Le tableau
de `docs/archive/plan-versions-tenues.md` § T8 dit pour chacun ce qui l'avait rendu invisible.

**Le produit a été utilisé pour de vrai à chaque fin de tranche, et c'est ce qui a trouvé
presque tous les défauts.** T9 : six, dont cinq en s'en servant — et **le sixième, le plus grave,
trouvé avant la première ligne de code** par un panneau de conceptions mises à juger l'une contre
l'autre. C'est le seul de toute l'histoire du dépôt qu'aucun essai n'aurait pu voir *ni* aucune
séance : les deux gestes qui le composent sont corrects isolément. T8 : cinq de plus, dont trois
qu'aucun essai d'écran ne pouvait voir —
jsdom ne met rien en page, donc un nœud caché par la librairie y est rendu comme un nœud
visible. T1 : l'écran doublait chaque génération lancée depuis l'onglet. T3 :
cinq de plus, dont deux venaient de la même racine — deux vérités sur la même chose
finissent par diverger. T4 : deux, dont un compte de références qui ne se remettait pas à
jour quand on promouvait un artwork. T5 : trois, tous de mise en page, dont deux de la même
famille — **une règle déléguée au navigateur dont personne n'a mesuré le résultat**. T6 :
deux, de cette même famille, et **tous les deux antérieurs à la tranche qui les a trouvés**.
**Aucun test de serveur ne pouvait les voir**, et les tableaux de `docs/archive/plan-versions-tenues.md` § T3, § T4,
§ T5 et § T6 disent pour chacun ce qui l'avait rendu invisible. C'est désormais une règle du
dépôt : **une tranche n'est finie que lorsqu'on s'en est servi.**

**Une planche se découpe, et chaque morceau est un asset entier.** Le serveur *propose* des
rectangles — zones opaques connexes, ou grille fixe —, l'auteur corrige, et ce qui part à la
découpe est **sa** liste. Chaque découpe possède ses propres octets bruts, hérite de la
recette de sa planche et pointe vers elle par sa filiation. Elle possède ses octets pour une
raison précise, et ça se paie en disque : **supprimer la planche doit laisser ses découpes
en place**, or la suppression définitive efface `<rang>-*`, brut compris.

**Et ça a été vérifié sur une vraie planche, payée** (`essais/essai_decoupe_planche.py`,
$0,0042) : huit personnages demandés à `gpt-image-2` en 16:9, huit zones trouvées — ni sept
ni neuf —, dans l'ordre de lecture, chacune devenue un asset de 64 px détouré et filié. Ce
qui manquait aux tests, c'était exactement ça : **une planche que personne n'avait disposée
pour la détection**. Corollaire observé, qui n'est pas un défaut : une planche naît
**habillée comme un sprite**, donc sa tuile montre huit personnages écrasés dans 64 × 64 —
c'est le brut qui se découpe, et rien dans la grille ne dit qu'une image est une planche
avant qu'on ouvre sa fiche.

**Une sélection sort de l'atelier, et elle emporte de quoi se relire.** Une archive, un
`descriptif.json` à sa racine, et rien d'autre : pour chaque image, son label, le prompt et
les réglages résolus de l'appel qui l'a produite, les dimensions **mesurées sur le fichier
qui part**, sa filiation, et sa recette avec son empreinte. Ce qui part est le **rendu** —
celui qu'on voit, celui qui entre dans le jeu —, jamais le brut, qui reste ici : c'est lui
qui permet de refaire le rendu, et le descriptif dit lequel il est. Corollaire assumé : un
asset qu'on n'a pas traité sort tel qu'il est arrivé, donc en 1024 px à côté de sprites de
64 — c'est la même phrase appliquée jusqu'au bout, et le descriptif porte les deux
dimensions.

**L'écran tient ses quatre colonnes.** `docs/DESIGN.md` § Layout donne
`240px · 300px · 1fr · 380px` — arbre · réglages · prompt+grille · fiche. Les trois
premières sont permanentes et repliables **par choix** ; la quatrième s'ouvre avec la
sélection d'une image et se referme sur la position, le filtre et le prompt d'avant.

**La grille est faite d'assets, et le chantier y tient sa place.** Un emplacement qui n'a
pas encore donné son asset occupe la case sous **la même clé** — `<génération>-<rang>`,
l'identifiant que l'asset portera —, si bien que l'image ne se glisse pas à côté de son
attente : elle la remplace. Un échec occupe sa place tant qu'on le regarde, mais il ne
s'installe pas : la bibliothèque relue ne le contient pas, et le journal du projet garde
l'appel avec son coût réel.

**La palette se lit sur le sujet, jamais sur le fond.** La coupe médiane appliquée aux
artworks tels quels rend vingt gris sur vingt-quatre : le fond plat occupe 75 % des pixels
et son anti-crénelage l'éclate en autant de seaux. `atelier/image/palette.py` détoure donc
d'abord, avec le moteur du geste courant, et la palette passe à quinze couleurs franchement
distinctes. *Ce qui est majoritaire n'est pas ce qui compte* — la même phrase que pour le
détourage au seuil global.

**L'univers est porté par le projet, et il contraint.** Bible en cinq champs nommés,
chacun activable ; barème d'échelles, où une nature de sujet porte **sa famille et son
occupation à la fois** — c'est ce qui garde un seul contrôle au moment de générer ; taille
de pixel imposée à tout ce qui rentre ; modèle par défaut **par famille** ; et la palette,
qui est un cache nommé par l'empreinte des artworks qui l'ont produite. Un univers vide ne
contraint rien : c'est un état, pas une configuration manquante.

**Deux risques ont été levés, aucun n'a coûté un centime.** « La couverture image
d'OpenRouter » (`essais/essai_couverture.py`) : 48 modèles image, 11 fournisseurs, 31
acceptent assez de références pour un univers. « La qualité pixel art directe »
(`essais/essai_pixel.py`) : sur 44 images de six modèles, **aucune sortie brute n'a de
transparence**, la médiane est à 33 986 couleurs, et la grille rendue va de 7 à 20 px —
facteur 2 à l'intérieur d'un même lot. Après traitement : 27 couleurs, alpha franc, grille
imposée, 0 sujet perdu sur 44, 0,17 s par image. **La question s'est retournée** : le
post-traitement n'est pas un supplément qui doit prouver son apport, c'est ce sans quoi
rien n'est utilisable.

**Le détourage par défaut n'a besoin d'aucun modèle.** Un remplissage depuis le bord — un
pixel n'est du fond que s'il est *relié au bord* par une chaîne de pixels proches de la
couleur de bordure — rend une silhouette propre sur les 44 images, squelette blanc sur fond
gris clair et fioles translucides compris. `rembg` reste un **second** moteur, facultatif
(`uv pip install -e ".[detourage]"`), grisé avec sa raison quand il n'est pas là. Le geste
courant ne charge rien, ne télécharge rien, et marche hors ligne.

**Ce chemin-là a été exécuté le 27 août 2026, et il a retourné une décision.**
`essais/essai_detourage_modele.py` compare les deux moteurs sur six vraies images plus un
cas composé. Sur ce que le produit fabrique — fond plat —, les deux **s'accordent à 96,3 %**
en médiane : le second n'apporte rien, et c'est ce qui justifie qu'il reste facultatif. Sur
un fond chargé, le bord garde **100 %** de l'image — il échoue entièrement — quand le modèle
en isole 19,8 % : c'est sa raison d'être, et elle se mesure. Il coûte 482 ms contre 147.
**Le modèle est nommé, jamais laissé au défaut de la bibliothèque** : le défaut de `rembg`
2.0.81 est `bria-rmbg`, un gigaoctet qui met 15,8 s par image de 1024 px sur processeur,
là où `u2net` met 0,47 s pour deux points d'écart. Le « ~180 Mo » écrit ici depuis T2 était
la taille d'`u2net`, et le défaut avait changé sous cette note.

**Deux choses ont rendu l'exécution possible, et elles se disent.** `raison_moteur` cherche
désormais le paquet avec `find_spec` au lieu de l'importer : demander « faut-il griser ce
bouton ? » ne charge plus `onnxruntime`, et `tests/test_t2.py` — qui vérifie qu'aucune
bibliothèque d'inférence n'entre dans `sys.modules` pendant une retouche — tient sur une
machine où le second moteur est installé. Et le test qui le concerne a désormais un
symétrique : l'un vaut quand le moteur manque, l'autre quand il est là, et il y en a
toujours exactement un des deux qui travaille.

**L'interface ne redemande plus rien, et elle se branche une seule fois.** Un abonnement
par onglet, pour toute sa vie : ni le filtre, ni le projet ouvert, ni les proportions, ni
l'écran Univers ne le font se rebrancher. Les seuls appels qu'elle refait d'elle-même sont
le catalogue — parce que le grisé de chaque modèle dépend de la demande en cours —, la
grille quand un filtre change, et le tableau quand le projet ouvert change, parce que c'est
le serveur qui filtre et que le tableau appartient à son projet.

**Et « la demande en cours » a grandi en T4** : elle porte désormais les artworks que
l'application ajoute seule. Promouvoir une carte change donc ce qui partira sans que
l'écran ait touché un réglage — d'où le catalogue redemandé sur l'événement `univers`.
C'est le défaut trouvé en ouvrant l'atelier le 27 août : **une règle juste dont l'hypothèse
a changé sous elle**.

**Un agent fait exactement ce que l'écran fait, et rien de plus.** Onze outils, aucun geste
propre : ça se lit dans les **imports** d'`atelier/mcp/serveur.py` — ni fournisseur, ni base,
ni disque —, et un essai le garde. Le seul geste que les services ne savaient pas faire était
« faire entrer un fichier local » : il a été écrit dans `services/`, avec sa route HTTP, pas
dans le MCP. Un import passe par une **génération** — modèle `import`, coût nul — parce que la
bibliothèque se reconstruit en parcourant les `generation.json` : sans le sien, un asset
importé disparaîtrait à la première évolution du schéma.

**La consommation de l'agent se lit sur les générations, elle ne se tient pas en double.** Le
chiffre du refus opposé à l'agent et celui que l'auteur lit pour relever le plafond sont le
**même calcul** — deux compteurs auraient fini par se contredire au moment précis où l'on
cherche à comprendre. Le coût des appels **ratés** y est compris : c'est justement celui-là
qu'on cherche. « Par séance » veut dire depuis l'ouverture de l'atelier, et le remettre à zéro
est un geste déjà connu — fermer la fenêtre.

**T7 a été branché pour de vrai, et ça a trouvé trois défauts.** Sixième fois de suite.
**Aucun agent ne pouvait se brancher** : `POST /mcp` répondait 405, parce que le montage et le
SDK posaient chacun leur préfixe — l'adresse réelle était `/mcp/mcp`. Corrigé, `/mcp`
répondait *encore* 405 : un montage Starlette ne reconnaît que `/mcp/…`, et le chemin exact
tombait chez les fichiers statiques. Et `localhost` était refusé en 421 par la protection
contre le réattachement DNS, dont le défaut n'autorise qu'`127.0.0.1`. **L'essai qui aurait dû
les voir vérifiait « ni 404, ni page d'accueil »** — or 405 n'est ni l'un ni l'autre : *une
assertion négative ne prouve rien d'un protocole*. Il ouvre désormais une vraie session et
vérifie les deux écritures de l'adresse.

**Le produit s'explique lui-même, et le corpus a été regardé à l'œil.** 46 entrées à l'époque, quatre
écrans, deux rendus — le panneau de 280 px et l'écran Guide —, un seul manque déclaré, et
c'est le guide qui le tient. La revue de l'atelier lancé a mesuré **trente poignées sur les
quatre écrans** et trouvé un défaut de la famille habituelle : « Proportions » réagissait
208 px à droite de son mot quand « Modèle », dans le même panneau, ne réagissait que sur les
siens — un `<span>` blockifié par son parent flexible et étiré par une colonne. Corrigé sur
le gabarit, remesuré à zéro partout. Et le guide a rendu un second écart, dans l'autre sens :
sa colonne de prose fait **468 px et 72 signes**, pas les « 504 px / 74 signes » que
`docs/DESIGN.md` annonçait — l'écran avait raison, le document a été corrigé. Les deux sont
dans `docs/PIEGES.md`.
