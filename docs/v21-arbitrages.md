# V2.1 — ce qui a été tranché en autonomie, et ce qui reste à trancher

> Écrit le 31 août 2026, en reportant le dossier des maquettes
> (`docs/maquettes-v2.1/`) dans les documents d'autorité du dépôt — le document
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
> `docs/maquettes-v2.1/` et un document d'autorité du dépôt, la maquette
> l'emporte* — sauf aux quatre endroits nommés en A-12, A-13, A-14 et A-15, où
> la maquette se contredit elle-même ou contredit une mesure. Chacun de ces
> quatre est écrit avec ce qui a décidé.

---

## A · Les vingt et un arbitrages pris en autonomie

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

### A-16 · Le champ de saisie du prompt passe de 62 à 56 pixels

Le document du design annonçait 62 pixels de hauteur minimale pour le champ de
prompt ; les maquettes de l'établi et de la planche le dessinent à 56. La valeur
des maquettes est retenue, et la nuance qui explique l'écart est écrite : **56 est
la hauteur du champ**, 62 était celle de la zone qui le porte, marges comprises.
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
un corps — n'est atteignable par **aucune** valeur de tolérance, parce que le
remplissage part des bordures de l'image et que le chemin n'existe pas. Le
remplissage depuis le bord reste le geste courant et le défaut ; la pipette est
le recours pour ce qu'il ne peut pas atteindre par construction.

### A-23 · Ce que le document du produit ne dit plus jamais « Atelier »

Le mot « l'atelier » en minuscule désigne l'application entière — c'est son nom
dans tout le dépôt. « L'Atelier » en majuscule désignait **un écran**, celui qui
portait le prompt et la grille, et celui-là n'existe plus. Les deux ont été
distingués partout où ils paraissaient, dans le document du produit comme dans
celui du design : ce n'est pas la même chose qui est nommée, et la relecture
suivante devait pouvoir le savoir sans le redécouvrir.

---

## B · Les questions qui restent à trancher

Aucune ne bloque le début de la construction. Chacune dit ce qui manque pour y
répondre, et l'étape du plan à laquelle elle se pose vraiment.

### B-1 · Faut-il remontrer l'écran de confirmation quand on relance à l'identique ?

Refaire exactement la même demande est le geste le plus courant quand une image
ne plaît pas — et il est chiffré : le 29 août 2026, six appels sur le même
personnage en trente-deux minutes, dont quatre en onze minutes, soit 27 % de tout
ce que l'atelier a dépensé depuis le premier jour.

La case « ne plus me le montrer pour cette série » répond à moitié. Savoir si un
relancement pur doit sauter l'écran tout seul demande de s'en être servi.
**Ce qui manque : de l'usage.** Se pose à l'étape de l'écran de confirmation.

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

**Ce qui manque, et ça coûte moins de cinq centimes :** trois appels de mesure.
À faire avant l'étape de la planche, pas après.

Deux questions voisines, du même endroit : au-delà de neuf cases, la géométrie
continue de se calculer mais aucun appel n'a été fait à ce format — un modèle qui
perd le compte à seize sujets est très plausible. Et l'on ne sait pas ce que
donne une planche à trois cases contre trois appels séparés.

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

### B-16 · Le détourage hérité doit-il se reposer tout seul ?

Dans la superposition, l'image du dessus hérite du détourage de celle du dessous.
Quand le détourage du dessous change ensuite, faut-il reposer l'hérité
automatiquement, ou attendre un geste ? **Ce qui manque : de l'usage.** Deux
questions voisines de la même maquette : superposer plus de deux images — rien ne
l'interdit, rien ne le prévoit ; et rejouer une superposition quand la référence
a changé, automatiquement ou sur demande.

### B-17 · Le fond « image du jeu » de la vitrine attend un décor

Tant que la famille des décors est vide, ce fond est grisé avec sa raison. Ce qui
se passe quand elle se remplit — quel décor, cadré comment — n'est pas décidé.
**Ce qui manque : le premier décor.**

---

## Ce qui n'est pas une question, mais qui manque

Trois choses à produire avant que l'étape qui les réclame commence. Aucune n'est
une décision.

| Ce qu'il faut | Pour quelle étape | Ce que ça coûte |
|---|---|---|
| **Dix-sept vignettes d'exemple** — le même petit personnage dessiné dans les huit vues de jeu, et le même sprite aux neuf tailles classiques | L'assistant de démarrage. Sans elles, les étapes de la vue et de la taille redeviennent des listes de mots et de nombres, ce qui est précisément ce qu'elles remplacent | Une petite production d'images |
| **Le banc d'essai des couleurs étendu** — balayer les deux dosages d'une palette sur les images déjà là, et compter les résultats réellement distincts | Les palettes et les ambiances. Voir B-10 | Rien : il tourne sur ce qui est déjà sur le disque |
| **Trois appels de mesure de planche** — à trois, cinq et six cases | La planche d'une pose. Voir B-8 | Moins de cinq centimes |
