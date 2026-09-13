# V2.1 — ce qui a été tranché en autonomie, et ce qui reste à trancher

> Écrit le 31 août 2026, en reportant le dossier des maquettes
> (`docs/archive/maquettes-v2.1/`) dans les documents d'autorité du dépôt — le document
> du produit, l'architecture, le design et le plan.
>
> **Ce document ne fait autorité sur rien.** Il garde la trace de deux choses
> qu'aucun autre fichier ne peut porter : les arbitrages pris sans que personne
> les demande, avec leur raison ; et les questions qu'il faudra bien trancher un
> jour, avec ce qui manque pour le faire. Dès qu'une question d'ici est
> tranchée, sa réponse part dans le document dont c'est la question, et elle
> descend ici en partie A.
>
> **La règle de la journée** : *en cas de contradiction entre une maquette de
> `docs/archive/maquettes-v2.1/` et un document d'autorité du dépôt, la maquette
> l'emporte* — sauf aux quatre endroits nommés en A-12, A-13, A-14 et A-15, où
> la maquette se contredit elle-même ou contredit une mesure. Chacun de ces
> quatre est écrit avec ce qui a décidé.
>
> **Ce que ce document ne tient pas, et où c'est.** La règle ci-dessus ne dit
> rien du cas le plus fréquent : **deux maquettes qui se contredisent entre
> elles**, sans qu'aucun document d'autorité ait son mot à dire. Une relecture
> croisée des vingt-six fichiers du dossier, le 31 août 2026, en a trouvé
> soixante-deux — écrans dessinés deux fois de deux façons, fichiers qui se
> contredisent eux-mêmes, chiffres annoncés comme mesurés et différents d'une
> page à l'autre, reports décidés et jamais appliqués. Ils vivent dans
> [`v21-corrections-a-traiter.md`](v21-corrections-a-traiter.md), un point par
> écart. Ce ne sont pas des arbitrages : il y a une bonne version et une
> mauvaise, et il faut la choisir. **Quatre d'entre eux sont déjà tranchés par
> le document du design réécrit le même jour** — il ne reste qu'à les appliquer
> dans les maquettes.

---

## A · Les vingt-six arbitrages pris en autonomie

Chacun est une décision qui n'était écrite nulle part, ou qui contredisait
quelque chose d'écrit ailleurs. Ils sont rangés par le document qu'ils touchent.

### A-1 · La bibliothèque cesse d'être « jamais un écran séparé »

**Ce qui était écrit.** Le document du produit écarte, au titre de l'ergonomie,
« l'écran séparé pour la bibliothèque : une seule grille dans tout le produit »,
et pose « organiser n'oblige jamais à quitter l'endroit où l'on crée ».

**Ce que la V2.1 fait.** La galerie *est* un onglet séparé, et l'on n'y fabrique
rien. On range d'un côté, on fabrique de l'autre.

**Tranché.** L'exclusion tombe, et la règle qu'elle protégeait se coupe en deux.
Ce qui tombe : *organiser sans quitter l'endroit où l'on crée*. Ce qui reste, et
qui était le vrai fond : **une seule grille d'assets dans tout le produit** —
mêmes filtres, même recherche, même sélection multiple. La matrice d'une chose du
jeu n'en est pas une, la réserve du tableau non plus, la liste des dépenses non
plus. Aucune des trois n'a de recherche, de filtre ni de sélection multiple, et
c'est cette privation qui tient la règle.

**Pourquoi c'est acceptable.** Le coût du va-et-vient était réel quand la grille
et le prompt partageaient un écran : on rangeait où l'on créait. Il n'existe
plus, parce que ce qu'on fabrique ne se range plus à la main — une image naît
dans l'établi d'une chose et lui appartient d'emblée. Le rangement de la galerie
ne sert plus qu'à ce qui n'appartient à personne.

### A-2 · La fiche d'une image et la fiche d'une chose du jeu sont deux objets

**Ce qui était écrit.** « La fiche asset est un panneau latéral, jamais une
page : la fermer remet exactement où l'on était. »

**Le conflit apparent.** La V2.1 ajoute une *fiche d'une chose du jeu* qui
s'ouvre en plein cadre.

**Tranché.** Ce ne sont pas les mêmes fiches et la règle ne bouge pas. La
**fiche d'une image** reste un panneau de 380 pixels de large dans la galerie ;
la **fiche d'une chose du jeu** — Balthazar, un tonneau, un casque — est un
écran plein cadre qui s'ouvre par-dessus l'établi. Le document du design nomme
les deux séparément pour que la relecture suivante ne les confonde pas.

### A-3 · Le journal des appels ratés devient l'écran des dépenses

**Ce qui était écrit.** Le document du produit promet que « l'appel raté et son
coût réel restent lisibles dans le journal du projet », et une histoire d'usage
le réclame.

**Tranché.** La promesse est tenue, mieux, ailleurs. Le journal montrait un cas
sur trois — celui qui, mesuré sur la base du dépôt, n'a jamais rien coûté : le
seul appel refusé y a été facturé zéro. L'écran des dépenses montre les trois
états, avec le montant réel de chacun. Le bloc garde sa place au bas de la
colonne de rangement de la galerie ; il cesse d'être une liste et devient une
porte.

### A-4 · Le total affiché dit toujours de quoi il est le total

**Ce qui n'était écrit nulle part.** Trois montants s'affichent dans le produit
— celui de la barre du haut, celui de la fenêtre des réglages, celui d'une
vignette — et aucun ne dit ce qu'il compte.

**Tranché.** Deux étiquettes, et elles entrent dans les documents d'autorité :
le total de la barre du haut porte **« ce jeu »**, celui de la fenêtre des
réglages porte **« dépensé par l'agent »**. Mesuré : un appel sur vingt-huit
vient de l'agent, et onze pour cent de tout l'argent a été dépensé sans qu'aucun
jeu soit ouvert — donc dans aucun total d'écran.

### A-5 · La liste des poses appartient au type d'objet, pas au projet

**Ce qui était écrit.** « Le plan de poses est une propriété du projet,
réutilisable par tous ses personnages. »

**Ce que la V2.1 fait.** Chaque **type d'objet** porte sa liste : un personnage a
repos, marche, course, attaque, dégâts, mort ; un coffre a fermé, ouvert, vidé ;
une tuile n'en a aucune.

**Tranché.** La phrase est réécrite. Ce qui la motivait ne bouge pas et devient
même plus vrai : ajouter une pose doit faire paraître une case vide chez tous
ceux qui la réclament, **sans écrire un seul fichier** — c'est pourquoi une chose
du jeu continue de porter ce qu'elle *écarte* et non ce qu'elle tient. Le
changement est que le troupeau concerné passe du projet entier au type d'objet,
ce qui évite qu'un coffre hérite d'une pose de course.

### A-6 · Le nombre d'images d'une pose change de sens, et la reprise met tout à un

**Ce qui était écrit.** Une pose déclare combien d'images elle réclame — quatre
pour la marche, dans le vrai projet.

**Ce que les directions font.** Une pose se décline désormais en directions
— sud, nord, est, ouest pour un jeu vu de dessus. Si le nombre d'images gardait
son sens, quatre directions fois quatre images feraient seize images pour un
simple repos, et la matrice d'un personnage passerait de vingt et une cases à
quarante-cinq.

**Tranché.** Le nombre d'images d'une pose compte désormais **les vignettes d'un
cycle dans une seule direction**, et la reprise met tous les chiffres à un. La
raison est mesurée : les quatre images de repos du projet réel sont les quatre
morceaux d'une seule feuille découpée — quatre angles, pas quatre vignettes.
Aucune image n'est perdue ; c'est un chiffre du fichier du projet qui change,
jamais un fichier d'image.

**Ce que ça coûte, et c'est écrit à l'écran le jour où ça arrive.** Une jauge
baisse sans qu'une image disparaisse : deux images d'une même vue n'ont jamais
fait deux vues, et le compte le dit enfin.

**Corrigé en construisant E10, le 31 août 2026.** Ce paragraphe disait que « la
reprise met tous les chiffres à un », c'est-à-dire toute seule. Ce n'est pas ce
qui a été construit, et c'est `docs/PLAN.md` qui tranche : l'atelier **propose**,
il écrit sa raison, et la proposition se défait d'un clic. La différence n'est pas
cosmétique — baisser tout seul un chiffre que l'auteur a posé lui-même serait une
décision prise à sa place sur son propre jeu, et le produit n'en prend pas.
Mesuré sur le vrai projet le jour où l'étape a été faite : quarante-huit cases,
vingt-quatre après la proposition, et seules `repos` et `marche` sont concernées
— celles qui demandaient exactement autant d'images qu'il y a de directions.

### A-7 · Une case du plan est prise dès qu'une image la porte

**Ce qui n'était écrit nulle part.** Aucun document ne disait ce que « faite »
veut dire pour une case de la matrice.

**Tranché, et la règle est dite plutôt que changée.** Une case est prise **parce
qu'une image la porte, pas parce que cette image est bonne**. Mesuré : les quatre
images de repos d'un des personnages du dépôt sont les quatre morceaux d'un
fichier apporté à la main puis découpé, et elles comptent comme les autres. Une
jauge qui refuserait de compter une image apportée deviendrait un jugement de
qualité déguisé, et le produit écarte le jugement automatique en toutes lettres.

**Ce que ça oblige.** La vitrine existe pour ça — le codex compte, la vitrine
montre, et une image qu'on regarde répond toute seule.

### A-8 · L'équipement se compte sur les corps qui existent

**Ce qui n'était écrit nulle part.** Sur quoi se calcule le dénominateur d'une
jauge d'équipement.

**Tranché.** Sur les corps **qui existent**, jamais sur les cases réclamées. Une
pièce ne se pose que sur un corps déjà fabriqué — l'atelier compose sa planche à
partir des corps, et une pose sans corps est visiblement inéligible avec sa
raison. Compter sur les cases réclamées donnerait un dénominateur qu'aucun geste
ne peut atteindre. La règle, en une phrase : **une jauge ne compte que ce qu'on
peut fabriquer maintenant.**

### A-9 · L'assistant sort du hors-périmètre, et le portrait de l'auteur est réécrit

Déjà appliqué dans le document du produit le 31 août, et rappelé ici parce que
c'est le renversement le plus visible du chantier. L'exclusion « assistant de
premier lancement » protégeait un accès direct au prompt ; cet accès a disparu
avec l'écran qui le portait. Ce qui remplace l'exclusion : **on sort de
l'assistant à n'importe quelle étape**, une étape passée reste passée sans rien
bloquer ni se redemander, et sortir dès la première dépose dans le codex avec le
champ qui nomme allumé. Ce qui reste écarté, c'est l'assistant *obligatoire*.

### A-10 · Le document du design ne dit plus « aucun assistant »

**Le conflit.** Le document du design décrit le type de produit par « ni site
marketing, ni produit grand public : aucune page d'accueil, aucun tunnel, aucun
assistant ». La phrase a survécu à la révision du document du produit du
31 août, qui a fait entrer l'assistant dans le périmètre.

**Tranché.** La phrase est corrigée sur place. Ce qu'elle protégeait — pas de
tunnel, rien d'obligatoire avant d'écrire — est réécrit dans les termes qui
tiennent : *aucun écran obligatoire, et l'assistant se quitte à toute étape*.
C'était une contradiction entre documents, exactement le genre que la règle
d'autorité du dépôt existe pour empêcher.

### A-11 · Le refus automatique sur l'échelle d'une pièce tombe

**La contradiction, et elle est interne au document du produit.** Une décision
dit : une pièce déclarée « qui agrandit la silhouette », revenue à une échelle
différente de celle envoyée, **ne produit aucun calque**. Une autre, deux
paragraphes plus loin, dit : **le compte d'images est le seul refus automatique
du produit**, et toute autre mesure informe sans jamais empêcher de garder. Les
deux ne peuvent pas être vraies.

**Tranché en faveur de la seconde**, ce qui est aussi ce que la maquette de la
superposition dessine. L'échelle au retour devient l'une des cinq mesures d'un
calque : elle s'affiche, elle explique, elle n'empêche rien. Ce qui reste vrai
mot pour mot : le produit **nomme** la dérive, et **propose** de garder ce qui
revient comme des corps habillés — utilisables et exportables, mais pas
empilables. Ce qui change : c'est une proposition, pas un refus.

**Ce qui rend le changement sûr.** La mesure du 29 août 2026, six planches
payées : l'échelle au retour est restée dans la tolérance à chaque fois, à 0,92
comme à 0,62. Le repli sur le corps habillé n'a jamais été pris que sur une
échelle inventée par un recalage défectueux — et le recalage se rejoue
gratuitement depuis la reprise R5.

### A-12 · Reposer un calque sur une autre pose reste écarté — la maquette a tort

**La contradiction.** La maquette de la superposition garde en question ouverte
« appliquer un calque déjà fabriqué aux autres poses du personnage ». Le document
du produit l'écarte en toutes lettres — *un casque vu de face n'est pas un casque
vu de dos* — et le document d'architecture a retiré ce point de sa liste de
risques en le nommant « une promesse fausse ».

**Tranché contre la maquette**, et c'est l'un des quatre endroits où la règle
« la maquette l'emporte » ne s'applique pas. Le sommaire du dossier le dit
lui-même : *aucune mesure ne soutient la phrase de la maquette*, et la maquette y
est marquée « à reprendre » pour cette raison. Un calque reste solidaire de la
pose sur laquelle la pièce est apparue, et c'est le pliage qui divise son prix,
jamais une réutilisation.

### A-13 · Deux poses peuvent partager une planche quand chacune ne réclame qu'une case

**La contradiction, entre deux maquettes.** La maquette du codex décrit le
lancement groupé ainsi : une planche par pose, et *les poses qui ne réclament
qu'une image se réunissent entre elles sur une planche commune*. La maquette de
la planche écrit l'inverse : *jamais deux poses sur la même feuille — leurs
consignes d'attitude diffèrent, et le modèle ne saurait pas laquelle appliquer à
quelle case*.

**Tranché en faveur du codex**, parce que la raison avancée par la planche est
démentie par le dépôt. Le texte d'une planche écrit déjà une consigne **par
case** — le relevé du 30 août 2026 cite mot pour mot, dans un appel payé :
« *The cells, in reading order, show: 1. course; 2. attaque; 3. dégâts;
4. mort* ». Mélanger des attitudes marche donc, et c'est même ce que le produit a
fait. Ce qui ne se mélange jamais reste ce que la maquette du codex écrit :
**deux choses différentes du jeu ne partagent jamais une planche**, parce que la
consigne promet « le même sujet dans chaque case ».

**La règle retenue, en une phrase.** Une planche porte **une seule chose du
jeu** ; elle porte une seule pose quand cette pose réclame plusieurs directions,
et peut en réunir plusieurs quand chacune n'en réclame qu'une.

### A-14 · Le fond sur lequel on regarde une image dépend de ce qu'on cherche

**La contradiction, entre deux maquettes.** La vitrine propose quatre fonds tirés
du projet — le damier, le noir que la bible décrit, une couleur de la palette,
et plus tard une image du jeu. La superposition en propose six qui n'ont rien à
voir — le damier, blanc, noir, rose, bleu, vert.

**Tranché : ce n'est pas une contradiction, et la règle qui les sépare
s'écrit.** Les deux écrans ne cherchent pas la même chose. La vitrine **juge une
allure** : ses fonds viennent du projet, et un sélecteur libre y ferait du
maquillage — on trouverait toujours un fond sur lequel le sprite est joli, et
jamais celui sur lequel il disparaît. La superposition **repère des pixels
oubliés** : ses fonds sont des aplats vifs choisis pour que des miettes sautent
aux yeux, et aucun n'a de rapport avec le jeu.

**La règle, écrite une fois** : *un fond de jugement vient du projet ; un fond de
repérage vient du produit.* Aucun des deux écrans n'offre de couleur libre.

### A-15 · La hauteur du champ qui nomme et du bouton qui paie

**La divergence.** Le document du design pose la hauteur d'un bouton et d'un
champ à 32 pixels. Les maquettes en nomment deux à 34 — le champ qui nomme du
codex, et le bouton qui paie — en citant « la hauteur de champ du produit », et
34 est par ailleurs l'une des cinq hauteurs de bande de la liste fermée du
dossier.

**Tranché en faveur des maquettes, et c'est un arbitrage faible** : deux
pixels. Les deux contrôles nommés passent à 34 ; tous les autres boutons et
champs restent à 32. La raison écrite est celle des maquettes : ces deux-là
portent chacun **le geste de premier plan de leur écran** — nommer une chose,
et payer —, et ils sont les seuls contrôles du produit dans ce cas.

**C'est le seul arbitrage de la liste que je recommande de rouvrir à l'usage**,
et il est reporté en B-9 pour cette raison : si les deux hauteurs se confondent à
l'œil, la valeur unique de 32 vaut mieux qu'une distinction que personne ne voit.

**Une maquette n'a pas suivi, et il faut l'aligner quel que soit le sort de
B-9** : `08-planche-de-pose` § 11 donne encore 32 px au bouton qui paie, quand
`08bis-ecran-de-confirmation` § 10 lui en donne 34. Voir E-3 dans
[`v21-corrections-a-traiter.md`](v21-corrections-a-traiter.md).

### A-16 · Le champ de saisie du prompt passe de 62 à 56 pixels

Le document du design annonçait 62 pixels de hauteur minimale pour le champ de
prompt ; les maquettes de l'établi et de la planche le dessinent à 56. La valeur
des maquettes est retenue, et la nuance qui l'expliquait a été écrite ici : **56
serait la hauteur du champ**, 62 celle de la zone qui le porte, marges comprises.

**Cette nuance est fausse, et le code l'a dit en tenant E1 — 31 août 2026.** La
hauteur minimale de 62 px était écrite sur le champ lui-même, bordure et garde
intérieure comprises : c'est bien le champ qui mesurait 62. **Le changement est
donc réel, et il vaut 6 px** ; il s'obtient en écrivant l'interligne au lieu de
l'hériter — deux lignes à 19 px plus 8 px de garde de chaque côté font 56, là où
l'interligne détendu du produit en faisait 62. La décision ne bouge pas, la
raison si. C'est le second arbitrage de la V2.1 dont la justification supposait
le code au lieu de le lire, après B-9, et les deux se sont écrits le même jour.

La barre qui l'entoure n'a pas de hauteur fixe — elle grandit avec la bande
« Pour » quand il y en a une.

### A-17 · Une palette du projet devient un cas particulier de palette

**Ce qui était écrit, et qu'il ne faut pas casser.** « La palette est dérivable
des artworks officiels — la garder telle quelle serait une seconde vérité, et
deux vérités sur la même chose finissent par diverger. »

**Tranché : la règle est élargie, pas retirée.** Une palette reste **une recette
et non une liste** : des sources, deux dosages, des retouches rangées une par
une, et un résultat recalculable dont l'empreinte dit de quoi il est la lecture.
Ce qui change est ce qu'une source peut être — des images d'un paquet du tableau,
les artworks officiels, ou **d'autres palettes**. La palette du projet devient
donc un cas particulier : celle dont les sources sont les artworks officiels.
Promouvoir une image se propage encore jusqu'en bas, même à travers une ambiance
retouchée à la main, et chaque couleur sait d'où elle vient.

### A-18 · La différence quitte la recette et devient une fabrique

**Ce qui était écrit.** Le post-traitement s'applique « dans un ordre fixe :
détourage, recadrage, grille, quantification, bords », et la différence était une
place de la recette qui portait l'identifiant d'un *autre* asset.

**Tranché.** Le critère qui range un outil est écrit une fois pour toutes :
**une place de recette décrit une image ; une fabrique en produit d'autres.** La
différence nomme deux images, donc elle fabrique. Elle sort de la recette et
devient la superposition, seconde fabrique à côté du découpage. Ce qu'elle
gagne : elle cesse d'être grisée sur presque toute la bibliothèque, puisqu'il n'y
avait rien à régler tant qu'on n'avait pas dit *par rapport à quoi*.

**Ce que la recette gagne à sa place.** Deux étapes qui décrivent bien une seule
image : **les contours** et **la main**. L'ordre passe donc à sept places —
détourage, recadrage, grille, quantification, bords, contours, la main — et
aucune ne se réordonne, pour la même raison qu'avant.

### A-19 · La main sort du calque et devient une place de la recette

**Ce qui était écrit.** La retouche au pixel arrivait avec l'équipement, et ne
servait qu'à reprendre un calque.

**Tranché.** Elle marche partout — un calque est une image comme une autre pour
elle —, et elle devient la septième et dernière place de la recette : celle qui
porte sur l'image telle qu'elle partira dans le jeu. Le **masque de la
différence**, lui, reste avec la superposition : il affine ce qu'une comparaison
a gardé entre deux images, et n'a de sens que là où il y a une comparaison.

### A-20 · Le décalage horizontal entre dans la recette

C'est le seul ajout au domaine que tout le dossier des maquettes réclame en
dehors des objets neufs : **un entier de plus dans la remise sur grille**, en
pixels de la case, à côté de l'ancrage qui ne règle que le vertical. Il vaut zéro
par défaut, il est écrit par le calibrage et par personne d'autre, et il ne part
pas dans une recette nommée — même règle que la boîte tracée du recadrage, parce
que c'est une coordonnée et non un réglage.

**Ce qui l'a rendu nécessaire, et c'est mesuré.** Le centrage horizontal se fait
sur la boîte du sujet : un bras tendu de 160 pixels déplace le corps de six
pixels dans une case de soixante-quatre, *même quand la taille n'a pas bougé*.
Superposer les poses rend cette dérive parfaitement visible ; sans le décalage,
l'outil montrerait un défaut auquel on ne peut pas toucher, ce qui est pire que
de ne pas le montrer.

### A-21 · Ce que « le sujet » devient, et ce que ça débloque

**Le fait mesuré.** Sur les vingt-huit générations payées du dépôt, neuf portent
un sujet déclaré et dix-neuf n'en portent aucun. Le sujet est ce qui porte la
famille d'une image, donc ce qui décide des artworks qui partent en référence et
de ce qu'un filtre par famille pourrait montrer.

**Tranché.** Le sujet cesse d'être facultatif au moment de lancer : il vient de
la chose du jeu qu'on ouvre, et il ne se décoche pas sur l'écran de confirmation
— sans lui, l'appel ne demande rien. C'est une conséquence directe du fait qu'on
ne paie plus que depuis l'établi d'une chose et depuis le codex : **toute image
payée naît chez quelqu'un**. Le filtre par famille de la galerie est dessiné dès
maintenant et gagne sa dernière valeur, *sans entité*, qui reste utile quel que
soit le chiffre.

### A-22 · Le détourage par couleur cesse d'être écarté

**Ce qui était écrit.** « Détourage par couleur » figurait dans les exclusions
d'ergonomie du document du produit, à côté du mobile et de la corbeille.

**Ce que la maquette du détourage fait.** Elle ajoute un troisième moteur de
passe — la pipette — à côté du remplissage depuis le bord et du modèle
facultatif : on désigne une couleur dans l'image, et l'on choisit de retirer
cette tache-là ou toutes les taches de cette couleur.

**Tranché : l'exclusion tombe, et ce qui l'a fait tomber est un cas mesuré.**
Une poche de fond entièrement enfermée par le sujet — l'espace entre un bras et
un corps — n'est atteignable par **aucune** valeur de tolérance qui garde le
sujet, parce que le remplissage part des bordures de l'image et que le chemin
n'existe pas. Le remplissage depuis le bord reste le geste courant et le défaut ;
la pipette est le recours pour ce qu'il ne peut pas atteindre par construction.

**Complété le 31 août 2026, en construisant la pipette, et le fait est plus fort
qu'annoncé.** Mesuré sur les soixante images brutes du dépôt, détourées au
réglage courant : une image porte **quarante-trois de ces poches en médiane**, et
jusqu'à seize mille. Le cas n'est donc pas un cas limite qu'on rencontre parfois,
c'est l'ordinaire. Ce que la phrase ci-dessus a aussi appris à dire : à tolérance
maximale la poche part bel et bien — mais parce que le moteur a d'abord mangé la
matière qui l'enfermait, et qu'il ne reste plus rien. *Tant que la matière tient,
la poche tient avec elle*, sur les deux cent vingt tolérances où c'est le cas.

### A-23 · Ce que le document du produit ne dit plus jamais « Atelier »

Le mot « l'atelier » en minuscule désigne l'application entière — c'est son nom
dans tout le dépôt. « L'Atelier » en majuscule désignait **un écran**, celui qui
portait le prompt et la grille, et celui-là n'existe plus. Les deux ont été
distingués partout où ils paraissaient, dans le document du produit comme dans
celui du design : ce n'est pas la même chose qui est nommée, et la relecture
suivante devait pouvoir le savoir sans le redécouvrir.

### A-24 · L'écran des dépenses garde ses filtres, et ce n'est pas la règle qui cède

*Pris le 31 août 2026, en construisant E18.*

**Ce qui était écrit des deux côtés.** Le document du produit énonce trois fois
qu'*une seule grille d'assets existe dans tout le produit*, et il nomme les trois
surfaces qui n'en sont pas — la matrice d'une chose, la réserve du tableau, la
liste des dépenses : *« aucune des trois n'a de recherche, de filtre ni de
sélection multiple, et c'est cette privation qui tient la règle »*. La maquette
des dépenses, elle, dessine **quatre filtres et un champ de recherche**, et écrit
pour chacun la question à laquelle il répond.

**Tranché : la maquette l'emporte, et la règle est reformulée là où elle était
trop large.** Ce que l'invariant protège est qu'il n'existe pas deux endroits où
l'on manipule des **images** de la même façon. Or les quatre filtres des dépenses
portent sur des **appels** — ce que ça a donné, quel jeu, quelle semaine, qui l'a
demandé —, et la recherche cherche le nom d'une chose du jeu, jamais le texte
envoyé. Ce qui aurait fait de cet écran une seconde galerie est ailleurs, et la
maquette le refuse explicitement : **aucune vignette dans la liste**, et aucune
sélection multiple. Une par ligne en aurait fait une planche contact.

**Ce qui a été corrigé plutôt que gardé.** La formule du document du produit
généralisait aux trois surfaces une privation qui n'est vraie que de deux : la
matrice et la réserve sont pleines d'images, la liste des dépenses n'en porte
aucune. Elle dit maintenant ce qui tient réellement la règle, surface par
surface. Sans quoi le premier lecteur venu aurait retiré à cet écran le filtre
qui répond à sa seule question propre — *qu'est-ce que j'ai payé pour rien ?* —
au nom d'une phrase écrite pour une autre surface.

### A-25 · La colonne de réglages ne disparaît pas, elle se replie dans la barre qui paie

*Pris le 31 août 2026, en tenant E4.*

**Ce qui était écrit.** La colonne de 300 px des réglages d'une génération
*disparaît* avec la V2.1 : « les réglages descendent dans l'établi, hérités de
l'entité, et ne se ressaisissent plus ». Le document du design le reprend mot
pour mot dans sa liste fermée des largeurs.

**Ce que la construire a montré.** L'héritage arrive avec la fiche d'une chose du
jeu — étape E12 —, et l'écran qui montre ce qui part avant de payer avec E14. La
retirer en E4, c'est-à-dire huit étapes plus tôt, retirait **le seul endroit du
produit où l'on choisit un modèle, des proportions et un nombre de variations**.
Le produit serait resté utilisable au sens où il générait encore ; il ne l'aurait
plus été au sens où l'auteur n'aurait pas pu changer de modèle.

**Tranché : elle suit la barre qui paie, repliée.** Ce qui sert à payer va où
l'on paie — c'est la règle déjà appliquée deux fois, au prix attendu en E2 et aux
trois gestes qui arment. Elle se replie sur une ligne qui dit ce qu'elle vaut,
`openai/gpt-image-2 · 1:1 · 1 variation`, dans la forme du bloc repliable que le
produit emploie depuis T2. La galerie, elle, n'en a plus — et c'est ce que le
critère de la tranche demandait vraiment.

**Ce qui reste vrai de la phrase d'origine, et ce qui a été corrigé.** Que la
colonne cesse d'exister dans la galerie : vrai, et fait. Qu'elle cesse d'exister
tout court : pas encore, et le document du design le dit maintenant. La largeur
de 300 px, elle, ne disparaît pas du tout — l'établi la reprend pour l'identité
d'une chose du jeu (corrigé en E2).

### A-26 · Ce que la pipette retient d'un clic : un point, jamais une tache

*Pris le 31 août 2026, en fermant le dernier critère ouvert de E3.*

**Ce qui était écrit.** Le critère lui-même posait la question et ne la
tranchait pas : « elle demande un champ de plus à la recette, et ce qu'il retient
n'est pas tranché — des identifiants de taches, qui se recalculent et se
déplacent, ou des points, qui survivent au recalcul ».

**Ce qui décide, et c'est vérifiable.** Une tache n'est pas une chose rangée
quelque part : c'est une zone d'un seul tenant que le serveur **retrouve à chaque
rendu**, par le même remplissage par plages qui sert au détourage. Son rang dans
la liste et sa boîte bougent donc dès qu'une passe au-dessus change d'un cran —
et une recette qui aurait nommé « la tache numéro trois » se mettrait à en viser
une autre sans que rien le dise. Un point, lui, ne bouge pas, et pour une raison
qui tient en une ligne du traitement : **une passe ne fait que fermer de l'alpha,
elle ne déplace aucun pixel et ne touche pas aux couleurs.** Le recadrage et la
remise sur grille, eux, déplacent — mais ils viennent après.

**Tranché : la recette garde `point`, en pixels de l'image brute.** Même
convention que le rectangle de recadrage, qui est déjà exprimé là et pour la même
raison. Un second champ l'accompagne, `portee`, parce que le point seul ne dit pas
si l'on retire la zone qu'il touche ou toutes celles de sa couleur — le critère
disait « un champ de plus », il en fallait deux.

**Et un troisième qui n'y est pas : la couleur.** L'écran affiche une pastille et
son code hexadécimal, donc la tentation était de les ranger à côté du point. Une
couleur écrite à côté du point qui la porte est une **copie que plus rien ne met
à jour** — exactement la faute d'un fichier « avant retouche » gardé sur le
disque, écartée en C4 pour ce motif. Elle est donc mesurée, et arrive avec les
autres mesures de la table : `taches_de` en rend une par passe, dans l'ordre des
passes, `null` là où il n'y a rien à viser.

**Ce que la décision coûte, et il faut le dire.** Une recette nommée qui porte
une pipette et qu'on rejoue sur une autre image vise un pixel qui n'a plus le même
sens. C'est déjà vrai de la boîte explicite du recadrage, et le produit l'accepte
là pour la même raison : ce sont les deux seuls réglages désignés *sur* une image
plutôt que réglés dans l'absolu. Un point hors cadre n'est pas refusé — il ferait
disparaître les six autres places pour un point devenu caduc —, il ne retire
simplement rien.

---

## B · Les questions qui restent à trancher — *dix-sept posées, seize ouvertes*

Aucune ne bloque le début de la construction. Chacune dit ce qui manque pour y
répondre, et l'étape du plan à laquelle elle se pose vraiment.

**Une est déjà répondue : B-10**, le jour même où la liste a été écrite, parce
que ce qui lui manquait était un banc d'essai gratuit et rien d'autre. Sa
réponse est écrite chez elle, en encadré, et non déplacée en partie A : une
question tranchée par une mesure se relit mieux à côté de la question qu'elle
tranche. Les seize autres attendent de l'usage, une mesure payante, ou une
décision qui n'a pas encore de raison de se prendre.

### B-1 · Faut-il remontrer l'écran de confirmation quand on relance à l'identique ?

Refaire exactement la même demande est le geste le plus courant quand une image
ne plaît pas — et il est chiffré : le 29 août 2026, six appels sur le même
personnage en trente-deux minutes, dont quatre en onze minutes, soit 27 % de tout
ce que l'atelier a dépensé depuis le premier jour.

La case « ne plus me le montrer pour cette série » répond à moitié. Savoir si un
relancement pur doit sauter l'écran tout seul demande de s'en être servi.
**Ce qui manque : de l'usage.** Se pose à l'étape de l'écran de confirmation.

**L'étape est livrée le 31 août 2026, et la question reste ouverte — c'est
normal.** La case existe, elle vaut pour la série en cours et se remet dès qu'on
change de chose ou de pose ; il n'y a **aucune** case « pour toujours », et
l'écran le dit lui-même. Ce qui manquait n'était pas le code, c'était l'usage :
la question ne se tranchera qu'après avoir refait dix fois la même image avec la
case sous la main.

### B-2 · La case carrée coûte de la résolution, et personne n'a tranché

Chaque image d'une chose du jeu est dessinée dans une case carrée, et tout le
produit le suppose — la mise sur grille, l'export, la matrice, le format des
sprites. Mais un personnage debout n'est pas carré.

**Ce qui est mesuré, et qui rend la question chiffrable au lieu de théorique :**
garder les six poses d'un personnage à pleine hauteur demanderait une case de
96 × 64 au lieu de 64 × 64 — soit 17 % de résolution perdue pour ce
personnage-là, et rien du tout pour un autre du même projet.

**Ce qui manque : la volonté de payer le changement.** Une case rectangulaire
toucherait l'export, la matrice et le format des sprites. Se pose après l'étape
du calibrage, quand on saura combien de personnages sont dans le cas.

### B-3 · Les premières images restent-elles dans le bac à sable ?

Sur une machine neuve, le jeu s'appelle « Bac à sable » tant qu'on ne l'a pas
nommé, et on peut fabriquer des images avant de le nommer. Le code d'aujourd'hui
garde ce jeu en place quand un vrai jeu naît ensuite, à côté de lui : les
premières images restent donc dans le bac à sable, séparées de tout ce qui suit.

Doivent-elles suivre le renommage, être proposées au déménagement, ou rester où
elles sont ? **Ce qui manque : rien de technique — c'est un choix de
rangement.** Se pose à l'étape du premier lancement.

### B-4 · Les onze explications manquantes s'écrivent avant ou pendant la construction ?

Onze sujets du produit ne sont expliqués nulle part dans le guide, dont la clé du
fournisseur, qui empêche pourtant absolument tout tant qu'elle est vide. Les
quatorze entrées sont **déjà écrites**, prêtes à recopier, chacune dans le
paragraphe « ce que cet écran doit au guide » de sa propre maquette.

Les écrire maintenant, c'est décrire des écrans encore en maquette, qui
bougeront. Les écrire après, c'est livrer un produit dont un tiers n'est expliqué
nulle part — et l'expérience de cette liste-là montre qu'un « on le fera après »
reste à une ligne pendant des mois.

**Recommandation, et c'est ce que le plan applique** : au fil de la construction.
Chaque étape paie sa ligne au moment où elle est construite, et l'étape du guide
ne fait plus que le cadre et les six phrases périmées. **À confirmer avant de
commencer.**

### B-5 · Faut-il convertir une image à l'import ?

Une planche apportée à la main dans un format sans transparence a été découpée en
quatre morceaux vides le 29 août 2026. Poser un détourage avant la découpe
réparait le cas. Lequel des trois maillons a lâché — la détection, l'écriture des
morceaux ou leur affichage — n'a pas été mesuré.

Convertir à l'import réglerait la classe entière de problèmes, et heurte un
invariant : *l'image brute reste telle qu'elle est arrivée*. La question n'est
donc pas « faut-il convertir » mais **ce que « brut » veut dire** : les octets
reçus, ou l'image reçue.

**Ce qui manque, et c'est gratuit :** réimporter le fichier fautif et lire ce que
la détection renvoie ; vérifier les octets d'un morceau hors de l'interface ;
vérifier ce que la grille demande au serveur pour afficher une découpe. Se pose à
l'étape du châssis des tables.

### B-6 · Le seuil de la superposition et la main font-ils double emploi ?

La superposition porte un seuil — de combien une couleur doit changer pour
compter comme changée — et emprunte par ailleurs la retouche au pixel. Les deux
décident de ce qui part dans le calque.

L'hypothèse est qu'ils se complètent : le seuil fait l'essentiel d'un coup, la
main rattrape ce que la couleur ne pouvait pas voir — un casque sombre sur des
cheveux sombres, qu'aucun seuil ne distingue. **Ce qui manque : de l'usage.** Si
l'on ne touche jamais au seuil, il part dans un repli ; si l'on ne se sert jamais
de la main ici, c'est elle qui part.

### B-7 · Que devient une sélection de douze images quand on entre dans une table ?

On peut sélectionner douze images pour les ranger ou les sortir d'un geste. On
peut aussi ouvrir la fiche d'une seule, ce qui la sélectionne. Entrer dans une
table pendant qu'une sélection existe est un cas que personne n'a essayé.

**L'hypothèse retenue, à vérifier :** la sélection est conservée, et la colonne
des images sœurs de la table montre la sélection plutôt que le voisinage dans la
grille — on est entré depuis un lot, on travaille le lot. L'inverse se défend.
Rien n'est bloqué : le cas courant, une image seule, est tranché.

### B-8 · Le prix d'une planche à trois, cinq et six cases

Le dossier a mesuré une case, deux cases et quatre. Le chiffre le plus important
— quatre cases coûtent deux fois moins cher par image — **repose sur un seul
appel**, et tout le raisonnement qui fait « refaire les quatre » le premier choix
de la planche en dépend.

**Tiré le 31 août 2026, et pour $0,081 — pas les cinq centimes annoncés.** Tenir
le chiffre aurait demandé de baisser la qualité, et trois prix mesurés dans
d'autres conditions n'auraient pas prolongé la courbe des deux points connus.

**Et ce qu'ils disent n'est pas ce qu'on cherchait.** Trois cases et six cases ont
coûté *exactement* le même prix, $0,0139 ; cinq cases ont coûté $0,0534, sur un
appel dont rien ne distingue le résultat. Une planche coûte le prix d'**un appel**
quel que soit ce qu'elle porte — mais **la variance entre deux appels identiques
dépasse l'écart entre deux tailles de planche**.

**Tranché en écrivant E13 : l'écran ne montre aucun prix par nombre de cases.** Il
montre un prix d'appel et le multiplie par le nombre d'appels que chaque choix
demande. La conclusion de la maquette ne change pas — refaire les quatre reste le
premier choix —, mais sa raison, si : ce n'est plus « c'est moins cher », c'est
« **c'est le même prix, et les quatre se ressemblent** ».

**Une question voisine reste ouverte** : au-delà de neuf cases, la géométrie
continue de se calculer mais aucun appel n'a été fait à ce format — un modèle qui
perd le compte à seize sujets est très plausible. À mesurer avant d'autoriser.

### B-8 bis · Ce que la fiche propose en référence, maintenant que la planche existe

**La question, née de E13.** La fiche d'une chose du jeu propose des images de
référence — *voici à quoi elle ressemble, garde ça en tête*. Son critère (E12)
prévoyait qu'elle propose un jour **l'image qui montre les quatre directions
ensemble**. Or E13 a tranché que cette image n'existe pas : une planche est
découpée puis jetée, et ce qui reste, ce sont ses quatre morceaux.

**Tranché par l'auteur le 31 août 2026 : rien de plus pour l'instant.** La fiche
continue de proposer le corps retenu d'une pose — une seule image, une seule
place sur les quatorze que le modèle accepte. Les deux autres pistes sont
écrites, et coûtent toutes deux quelque chose : proposer **les quatre corps**
prend quatre places au lieu d'une et se paie à chaque appel chez les modèles qui
facturent au texte ; **assembler une feuille de référence** ajoute une image à
ranger, à tenir à jour, et à refaire dès qu'une direction change.

**Ce qui rouvrira la question** : un personnage qui sort visiblement différent
selon l'angle. Pas avant.

### B-9 · Deux hauteurs de contrôle, ou une seule ?

Voir A-15. Les deux contrôles qui portent le geste de premier plan de leur écran
sont posés à 34 pixels, les autres à 32. **Ce qui manque : regarder les deux
côte à côte à l'écran.** Si l'écart ne se voit pas, la valeur unique vaut mieux.

### B-10 · Les deux dosages d'une palette changent-ils vraiment quelque chose ?

La proportion — combien de couleurs viennent d'où — et l'attraction — de combien
elles se rapprochent — sont retenues parce qu'elles répondent à deux questions
distinctes, **pas parce qu'on a mesuré qu'elles diffèrent**.

Le piège est connu et il a déjà mordu deux fois dans ce produit : un banc d'essai
gratuit a montré que le nombre de couleurs de la quantification ne change rien
dès qu'une palette est posée — le fichier sort identique à l'octet près à 2, 8,
24 et 256 couleurs. Le réglage existait et ne faisait rien.

**Ce qui manque, et c'est gratuit :** étendre le banc des couleurs, balayer les
deux dosages sur les images du dépôt, et compter les résultats réellement
distincts. **À faire avant d'écrire la moindre ligne des palettes.** Un dosage
qui ne changerait rien se griserait avec sa raison.

> **Répondu le 31 août 2026 — les deux curseurs agissent, et ils sont
> indépendants.** Le banc est étendu (`py essais/essai_couleurs_et_taches.py`,
> questions 8 et 9) et il balaie les deux dosages sur six vraies images, avec une
> palette d'ambiance déduite de deux autres. La proportion rend **cinq images
> distinctes sur cinq valeurs**, l'attraction aussi, et sur les six images à
> chaque fois. Croisés, les deux rendent **21 résultats distincts sur 25
> combinaisons** : ils ne font pas le même travail, et deux curseurs valent mieux
> qu'un.
>
> **Le banc a en plus trouvé le seul endroit où l'un des deux meurt**, ce que la
> question ne demandait pas. À proportion « tout du jeu », il ne reste aucune
> couleur d'ambiance à tirer vers quoi que ce soit : l'attraction devient inerte,
> et les cinq valeurs rendent le même fichier. C'est exactement le cas qui se
> **grise avec sa raison** à l'écran, et c'est la quatrième fois que ce banc
> trouve un réglage mort avant qu'il soit dessiné.
>
> Une réserve, et elle est nommée : le banc mesure *cette lecture-là* de la
> maquette — la coupe médiane pour choisir les couleurs d'une source, la distance
> euclidienne en RGB pour la plus proche. Une autre lecture des deux curseurs
> pourrait donner d'autres chiffres. Ce qui est établi est que **deux curseurs
> ainsi définis ne sont pas redondants**, pas que cette définition soit la seule.

### B-11 · Que devient la liste des dépenses au bout de mille appels ?

Vingt-huit appels tiennent dans un écran, et la forme n'a été éprouvée que sur
trois jours. À deux cents par mois, la période à sept jours devient le vrai
défaut et le reste se cherche. Rien n'est cassé. **À revoir quand la base aura
grossi, pas avant.**

Question voisine : faut-il un total par chose du jeu ? Il appartiendrait plutôt
au codex, et il n'y a rien à décider avant d'avoir trente personnages.

### B-12 · Que montre la fiche, et la vitrine, d'une chose qui n'est pas un personnage ?

Un décor n'a pas de poses, une pièce d'équipement n'a pas de directions. Les cinq
blocs de la fiche valent pour tous, mais le quatrième — *ce que le jeu lui
réclame* — change de contenu selon la famille. L'établi le fait déjà pour ses
rangées ; la fiche suivra la même règle sans la redessiner.

Et la vitrine d'une chose qui n'a rien de fini montre « un cadre vide et une
phrase, probablement — mais la phrase compte, et elle n'est pas écrite ». **Ce
qui manque : la première entité qui ne soit pas un personnage.** Se pose à
l'étape du codex généralisé.

### B-13 · Une image promue en référence le reste-t-elle après retouche ?

Le traitement est non destructif et l'image brute ne bouge jamais : la question
porte donc sur ce qui part — le brut, ou le rendu. **À trancher là où les
références se composent**, c'est-à-dire à l'étape de l'écran de confirmation.

**L'étape est livrée le 31 août 2026, et elle a rendu la question visible sans la
trancher.** Chaque image jointe a désormais sa ligne, sa provenance et son prix,
et l'on décoche celles qu'on ne veut pas pour cet appel-là. Ce que la ligne ne dit
pas encore, c'est **lequel des deux états part** — le brut ou le rendu —, et le
produit envoie toujours ce qu'il envoyait avant. Rien n'a changé de ce côté-là,
et le dire est plus utile que de laisser croire que l'étape a répondu.

### B-14 · Faut-il marquer dans le codex les images jamais retouchées ?

Vingt et une images sur quarante-huit n'ont jamais été traitées, et le codex les
compte comme les autres — c'est A-7, et c'est délibéré. Le marquer là-bas ferait
du codex un juge, ce qu'il refuse d'être. **À trancher en regardant si la vitrine
suffit à s'en apercevoir**, donc après l'étape de la vitrine.

### B-15 · Ce qui part change-t-il selon le type d'objet fabriqué ?

Une tuile n'a sans doute pas besoin du même texte qu'un personnage. Le sujet a
été volontairement remis à plus tard, et l'écran de confirmation en est la porte
d'entrée : **c'est là qu'on verra, à l'usage, quelles lignes on éteint toujours
pour quel type d'objet** — et c'est ce constat qui dira quoi automatiser. Rien ne
se décide avant d'avoir ce relevé.

**La porte est ouverte depuis le 31 août 2026.** Les lignes existent, chacune
avec son interrupteur, et l'écart d'un appel ne s'enregistre nulle part : ce
qu'on éteint souvent ne laisse donc aucune trace pour l'instant. C'est un choix
— *le tri ne porte que des écarts, jamais un état complet* —, et le relevé
demandera de s'en servir avant de décider s'il faut le garder.

### B-16 · Le détourage hérité doit-il se reposer tout seul ?

Dans la superposition, l'image du dessus hérite du détourage de celle du dessous.
Quand le détourage du dessous change ensuite, faut-il reposer l'hérité
automatiquement, ou attendre un geste ? **Ce qui manque : de l'usage.** Deux
questions voisines de la même maquette : superposer plus de deux images — rien ne
l'interdit, rien ne le prévoit ; et rejouer une superposition quand la référence
a changé, automatiquement ou sur demande.

### B-18 · Où le modèle se choisit, maintenant que la colonne n'a plus que ça

La bande de 300 px au pied de la barre qui paie devait disparaître le jour où
l'héritage d'une chose du jeu (E12) et l'écran de confirmation (E14) existeraient.
Les deux sont livrées le 31 août 2026, et elles lui ont bien pris ce qu'elles
portent mieux : les textes hérités, les images de référence et leur décochage se
lisent désormais ligne par ligne avant de payer.

**Elle reste quand même**, et pour une seule raison, celle que A-25 avait déjà
nommée : **aucun autre écran ne choisit un modèle**. Ce qu'elle porte encore tient
en trois choses — le modèle, l'échelle, le nombre de variations.

**Ce qui manque : de l'usage.** Déplacer le choix du modèle sur l'écran de
confirmation en ferait un réglage qu'on relit à chaque appel ; le mettre dans les
réglages du jeu en ferait un défaut qu'on ne voit plus au moment de payer. Aucune
des deux ne se juge sur le papier. La question se rouvre quand l'auteur aura
fabriqué assez pour dire si le choix du modèle le gêne là où il est.

### B-17 · Le fond « image du jeu » de la vitrine attend un décor

Tant que la famille des décors est vide, ce fond est grisé avec sa raison. Ce qui
se passe quand elle se remplit — quel décor, cadré comment — n'est pas décidé.
**Ce qui manque : le premier décor.**

---

## Ce qui n'est pas une question, mais qui manque

Trois choses à produire avant que l'étape qui les réclame commence. Aucune n'est
une décision. **Une des trois est faite — le 31 août 2026, le jour même où cette
liste a été écrite** ; c'était la seule qui ne coûtait rien du tout, et elle a
levé le blocage de son étape en répondant à B-10. Restent les deux qui coûtent
quelque chose : des images à produire, et cinq centimes d'appels.

| Ce qu'il faut | Pour quelle étape | Ce que ça coûte |
|---|---|---|
| **Dix-sept vignettes d'exemple** — le même petit personnage dessiné dans les huit vues de jeu, et le même sprite aux neuf tailles classiques | L'assistant de démarrage. Sans elles, les étapes de la vue et de la taille redeviennent des listes de mots et de nombres, ce qui est précisément ce qu'elles remplacent | Une petite production d'images |
| ~~**Le banc d'essai des couleurs étendu**~~ — **fait le 31 août 2026.** Les deux curseurs agissent, ils sont indépendants (21 résultats distincts sur 25), et l'attraction meurt à un seul endroit, nommé. Voir B-10 | ~~Les palettes et les ambiances~~ — plus rien | Rien, comme prévu |
| **Trois appels de mesure de planche** — à trois, cinq et six cases | La planche d'une pose. Voir B-8 | Moins de cinq centimes |
