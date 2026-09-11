# PRD — ce que le produit ne fera pas, et pourquoi

> Descendu de `docs/PRD.md` le 6 septembre 2026, **sans qu'un mot change**. La section pesait
> **38 %** du document — la plus lourde des huit.
>
> Sa valeur est tout entière dans le moment où on l'ouvre : **une idée arrive, et on veut
> savoir si elle a déjà été écartée et sur quel argument**. Tant que la question ne se pose
> pas, le fichier ne sert à rien — d'où la descente.

## Hors périmètre

**Écarté par nature du produit.** Comptes, crédits, paiement, multi-utilisateur, distribution, galerie publique, partage, presets communautaires. Pack d'assets par genre — fabriquer de la quantité est le métier d'un autre outil. Compteur de crédits maison : le suivi des coûts se lit chez le fournisseur.

**Écarté parce que l'auteur fait mieux.** Contrôle de conformité automatique. Description automatique du style. Routeur d'intention qui devinerait le type d'asset.

**Écarté par coût de construction disproportionné.** Extraction de composants d'interface et éditeur de découpe en neuf zones. Paquets spécifiques à tous les moteurs à la fois.

**Revenu dans le périmètre — 11 septembre 2026.** La génération locale pilotée depuis
l'atelier et les sources 3D réutilisables sont demandées par l'auteur. Le jeu cible est
Godot : son agent de développement demande les assets à l'atelier et récupère des fichiers
utilisables. Le parcours ne peut donc plus s'arrêter à « il suffit de glisser le ZIP ».
L'installation des moteurs reste un geste explicite ; l'import reste disponible.

**Équipements complets — précision du 11 septembre 2026.** Le cadrage actuel du PRD
demande les emplois par personnage, leurs calques par pose, direction et frame, puis la
combinaison de ces calques. L'exclusion historique ci-dessous de certaines combinaisons
en V2 ne s'applique pas à ce nouveau parcours : les images équipées servent à préparer
des calques séparés, avec masques corrigeables, sans empiler des corps complets. Cette
extension reste à construire ; elle ne prétend pas modifier les données V2 déjà conservées.

**Écarté de la V1, prévu ensuite.** ~~Génération autre que pixel art.~~ Tuiles qui se raccordent. ~~Personnage et ses poses préparées.~~ ~~Animation de sprites.~~ Son. *(Trois des cinq sont revenues, chacune avec son paragraphe daté plus bas ; il reste les tuiles et le son.)*

**Écarté par choix d'ergonomie.** Mobile et tablette : écran large uniquement, aucun point de rupture, aucun menu escamoté, aucune mise en page de repli. Corbeille : suppression avec annulation courte. ~~Écran séparé pour la bibliothèque~~ et ~~détourage par couleur~~ — les deux sont revenus le 31 août 2026, voir plus bas.

**Revenu dans le périmètre — 27 août 2026.** « Toile libre dans le tableau d'inspiration : grille seulement » était écarté ici, au même titre que le reste, jusqu'à ce qu'une séance d'essai sur le produit tenu montre l'inverse : la grille montre tout d'un coup d'œil et ne permet d'organiser rien, et le champ `groupe` — une étiquette qui n'a aucune forme à l'écran — n'y suffit pas. La toile s'ajoute donc à la grille **sans la remplacer**, et devient les tranches T8 et T9 du plan. Ce qu'elle n'est pas, en revanche, reste écarté : dessin à main levée, formes et flèches libres, plusieurs toiles par projet, export de la toile en image, liens entre cartes de projets différents, alignement et distribution automatiques, et couleur choisie librement — six teintes fermées, et rien au-delà.

**Écarté par les décisions de ce document.** Sas d'acceptation avant l'entrée en bibliothèque. Suppression en cascade. Refus de supprimer tant qu'il existe une descendance. Création implicite d'un projet par l'agent. Invite d'autorisation qui bloquerait l'agent en attendant l'auteur. Liste de modèles écrite en dur. Relance automatique après interruption. Réapplication forcée de la palette sur les recettes réglées à la main. Enchaînement d'outils fins que l'agent devrait composer lui-même. Passe de retouche qui monopoliserait la carte graphique.

**Écarté sur les références.** Sélection manuelle des artworks à envoyer, génération par génération : c'est l'application qui choisit, sur la famille. Obligation que l'artwork officiel soit une planche non figurative : trop contraignant, l'auteur travaille justement à partir de visuels trouvés. Déduction de la taille de pixel depuis l'image reçue : elle est imposée par le projet, jamais devinée.

**Revenu dans le périmètre — 28 août 2026.** « Personnage et ses poses préparées » était écarté de la V1 et renvoyé à un « ensuite » sans rang, derrière les tuiles. Deux essais payés le 28 août 2026 ont levé les deux doutes qui le retenaient : un jeu de poses tient dans une seule image sans que la grille de pixels dérive d'une pose à l'autre, et une pièce d'équipement s'extrait d'un corps habillé sans qu'un seul pixel du corps soit repeint. Le personnage et son équipement passent donc devant les tuiles et forment la V2. L'ordre des versions devient : **V2 le personnage et son équipement, V3 l'animation, V4 les tuiles qui se raccordent, V5 le son.** L'équipement, qui n'était nulle part, entre avec le personnage parce qu'il n'existe pas sans lui.

**Écarté de la V2 — repoussé.** ~~Animation~~, tuiles raccordées, son. ~~Squelette, os, interpolation entre deux poses : c'est l'animation, pas le personnage.~~ *(Les deux sont revenus le 2 septembre 2026 : c'est la V3, et son paragraphe est plus bas.)* Salle d'essai qui montrerait le personnage équipé dans un décor. Bibliothèque de poses partagée entre projets : le plan appartient au projet qui le porte.

**Écarté de la V2 — par les décisions de cette version.** Deuxième grille d'assets : la matrice de production d'un personnage n'en est pas une — pas de recherche, pas de filtres, pas de sélection multiple, deux axes et des vignettes, rien de plus. Point de repère, ancre ou marque injectée dans l'image pour recaler un calque : le calque est une pure différence, et rien n'est ajouté à l'image envoyée. Génération d'une pièce seule sur fond vide : une pièce n'existe qu'apparue sur un corps. Calque unique porté sur toutes les poses : une pièce est solidaire de la pose sur laquelle elle est apparue, et il en faut une par pose — c'est le pliage qui en divise le prix, pas une réutilisation. Combinaison de deux pièces qui agrandissent la silhouette sur le même corps : ce qui revient d'une pièce qui agrandit est un corps habillé et non un calque, et deux corps habillés ne s'empilent pas. Détection automatique de ce qui agrandit la silhouette : l'auteur déclare, au même titre qu'il nomme la pièce et l'emplacement. Plafond sur la taille d'un lot : le produit annonce ce que coûte un compte faux, il ne l'interdit pas. Refus automatique sur les mesures de qualité : elles informent, seul le compte d'images refuse. Reconnaissance automatique de la pièce ou de l'emplacement depuis l'image : l'auteur nomme, l'application enregistre. Mannequin ou silhouette de référence imposée à tous les personnages. ~~Feuille de sprites assemblée à la sortie : le pliage est une ruse d'appel, pas un format de livraison — ce qui sort, ce sont des images séparées et leur descriptif.~~ *(Renversé le 2 septembre 2026 : une planche devient un objet du produit, et une bande sort assemblée. Voir plus bas.)*

**Revenu dans le périmètre — 28 août 2026 (les quatre reprises).** « Génération autre que pixel art » était écarté de la V1 et renvoyé à un « ensuite ». Une séance sur le produit tenu a montré que l'écart n'était pas là où ce document le plaçait : **rien du style n'est écrit dans le prompt** — seule la bible part, et une bible vide ne dit rien —, mais **le post-traitement, lui, impose l'apparence sans qu'on l'ait demandée** : la remise sur grille est systématique, donc toute image revient sur 64 ou 96 pixels, et la quantification la ramène sur la palette dès qu'un artwork existe. L'auteur ne voit ni ce qui part, ni ce qui est appliqué au retour. Trois choses entrent donc dans le périmètre : **le prompt exact se voit et se reprend**, **la bible gagne la vue et la technique de rendu**, et **la taille de pixel accepte « aucune »**. Trois autres suivent, de la même séance : l'import depuis l'écran, le réglage d'univers qui se voit sans recharger, et l'infobulle qui ne couvre plus le réglage voisin.

**Revenu dans le périmètre — 30 août 2026.** « Assistant de premier lancement » était écarté ici, au nom de ce que le portrait de l'auteur protège : ne pas être retenu avant d'écrire. L'exclusion a cessé de protéger quoi que ce soit le jour où l'écran sur lequel elle reposait a disparu. Il n'y a plus d'Atelier : l'argent ne part plus que de deux endroits, l'établi d'une chose et le codex ; or un établi appartient à une chose, et sur une installation neuve le codex est vide. **Il n'y a plus nulle part où écrire un prompt**, et l'exclusion défendait un accès direct qui n'existait plus. L'assistant entre donc dans le périmètre, sous la condition qui remplace l'exclusion : **on en sort à n'importe quelle étape**, une étape passée reste passée sans rien bloquer ni se redemander, et sortir dès la première dépose dans le codex, champ qui nomme allumé. Ce qui reste écarté, c'est l'assistant *obligatoire* : aucune de ses étapes ne l'est.

**Écarté par ces reprises.** Mode de rendu HD à part entière, où le projet basculerait d'un bloc : la case « aucune » de la taille de pixel suffit à rendre la grille facultative, et un second axe de configuration se paierait à chaque écran. Quantification débrayable indépendamment : elle reste attachée à l'existence d'une palette — un projet qui n'en veut pas ne promeut pas d'artwork. Bible en texte libre : les champs nommés restent des champs nommés, la liste s'allonge de deux et ne s'ouvre pas. Prompt réécrit par l'application, traduit ou enrichi automatiquement : ce qui est montré est ce qui part, mot pour mot. Import qui devinerait la famille, l'échelle ou le traitement à appliquer : l'auteur déclare, comme partout ailleurs.

**Revenu dans le périmètre — 31 août 2026 (la V2.1).** Trois exclusions tombent, et chacune tombait pour la même raison : elle protégeait quelque chose que la réorganisation des écrans a rendu impossible ou inutile.

*L'écran séparé pour la bibliothèque* était écarté au nom d'« organiser n'oblige jamais à quitter l'endroit où l'on crée ». La galerie devient un onglet à elle, où l'on ne fabrique rien. La règle qu'il protégeait se coupe en deux : ce qui tombe, c'est *ranger là où l'on crée* — il n'y a plus rien à ranger à la main, puisqu'une image naît dans l'établi d'une chose et lui appartient d'emblée. Ce qui reste, et qui était le fond, c'est **une seule grille d'assets dans tout le produit** : la matrice d'une chose, la réserve du tableau et la liste des dépenses n'en sont pas. Ce qui le tient est écrit plus bas, surface par surface — les deux premières sont privées de recherche, de filtre et de sélection multiple ; la troisième ne porte aucune image.

*Le détourage par couleur* était écarté quand le remplissage depuis le bord suffisait à tout. Il devient le troisième moteur de passe, à côté du remplissage et du modèle facultatif : on désigne une couleur dans l'image, et l'on choisit de retirer cette tache-là ou toutes celles de cette couleur. Ce qui l'a fait revenir est une poche de fond enfermée par le sujet, qu'aucune tolérance ne peut atteindre parce que le remplissage part des bordures et que le chemin n'existe pas.

*L'assistant de premier lancement* est revenu le 30 août, et son paragraphe est ci-dessus.

**Écarté par les décisions de la V2.1.** Une entité « essais » servant de panier : elle fabriquerait un endroit où les images échappent au codex. Une barre de saisie dans l'univers, ou dans la galerie : les lieux d'où l'argent part restent deux. Une sixième taille de vignette pour reconnaître une image de référence : la barre d'espace montre n'importe quelle vignette en grand, partout. Un second panneau de réglages à côté de l'assistant : deux endroits qui règlent la même chose finissent par se contredire. Un dictionnaire d'étiquettes de style apporté du dehors : vérifié, les thésaurus d'art donnent *baroque* et jamais *pixel art 16 bits*, et aucun ne donne le texte anglais qui marche sur une IA d'image. Une cascade d'héritage entre le jeu, l'ambiance et une chose : une ambiance est une boîte qu'on désigne et dans laquelle on pioche, pas un étage dont on hérite. Deux ambiances sur une même chose : il faudrait une règle de priorité pour chaque texte et chaque image, et elle serait invisible au moment où elle décide. Un écran du gaspillage qui ne montrerait que ce qu'on a payé pour rien : mesuré, aucune image du dépôt n'a jamais été supprimée, et cet écran-là aurait affiché zéro. Un bouton « refaire cet appel » dans les dépenses : un écran qui regarde en arrière ne devient pas un troisième guichet. Une case définitive « ne plus jamais me montrer ce qui part » : on la cocherait le premier jour, quand on ne sait pas encore qu'on en aura besoin. Un contrôle libre de la couleur de fond dans la vitrine : on trouverait toujours un fond sur lequel le sprite est joli, et jamais celui sur lequel il disparaît.

**Revenu dans le périmètre — 31 août 2026 (la V2.2).** « Un seul adaptateur » n'a jamais été une exclusion du produit : c'était une décision de construction, prise le 26 août parce qu'écrire trois adaptateurs donnait *le même résultat* pour trois fois le travail. Elle cesse de valoir le jour où les trois autres ne donnent pas le même résultat — ils donnent des images **gratuites**, avec une réserve qui se renouvelle chaque jour ou chaque mois. Trois choses entrent donc dans le périmètre : **plusieurs fournisseurs à la fois**, **une consommation qui n'est pas toujours de l'argent**, et **une première image sans compte ni clé**. La troisième est la seule que l'auteur remarquera sans la chercher : sur une machine neuve, il n'y avait rien à faire tant qu'une clé n'était pas déposée.

**Écarté par la V2.2.** Le repli automatique d'un fournisseur sur un autre quand l'un tombe : ce serait une relance que l'auteur n'a pas demandée, et *rien n'est jamais relancé automatiquement* est la règle la plus ancienne du produit. Le mélange de deux fournisseurs dans un même appel. Le choix automatique du moins cher : le modèle est un défaut par type d'objet porté par l'univers, et un arbitrage caché entre gratuit et payé déciderait de l'apparence sans le dire. Publier une image de l'auteur à une adresse web pour qu'un fournisseur puisse la lire en référence : un atelier local ne publie rien, et un modèle qui n'accepte les références que par ce chemin-là est simplement grisé avec cette raison. Une note de qualité par modèle calculée par le produit : elle se juge à l'usage, sur des images qu'on voulait de toute façon — et deux bancs payés ont déjà appris qu'un classement obtenu hors du geste réel s'inverse dès qu'on y revient. Un compteur de crédits maison, qui reste écarté depuis la V1 : la réserve d'un fournisseur se lit chez lui quand il la dit, se compte ici quand il ne la dit pas, et l'écran dit toujours lequel des deux — mais le produit ne tient aucune comptabilité parallèle.

**Écarté par les cinq capacités de l'usage — 1<sup>er</sup> septembre 2026.** Une veille plus fine que la place et la passe : on éteint une place de la recette, ou une passe de détourage, jamais un réglage seul — un curseur éteint fabriquerait un second zéro à côté du sien, et personne ne saurait lequel des deux agit. Un troisième geste de voyage, où un traitement suivrait de lui-même toutes les images d'une chose du jeu : la palette du projet fait déjà cela pour ce qui la concerne, et un traitement qui se poserait tout seul déciderait de l'apparence sans le dire. Une bibliothèque de recettes livrée avec le produit : elle naît vide, comme la base d'étiquettes, et grandit de ce qu'on y met. L'historique des recettes appliquées, et le versionnement d'une recette nommée : remplacer sous le même nom se propose, il ne s'archive pas. Modifier le texte d'une image depuis sa fiche : la galerie ne fabrique rien, et un texte déjà payé ne se réécrit pas — le reprendre pour un nouvel appel est un geste qui existe déjà, ailleurs. Une sélection qui trouverait le sujet sans qu'on ait rien tracé : c'est très exactement ce que fait le remplissage depuis le bord, et c'est quand il se trompe qu'on trace. Un moteur de détourage qui mobiliserait la carte graphique, ou qui rapatrierait son modèle sans le dire. Une note de qualité par moteur calculée par le produit, écartée pour la raison qui l'écarte déjà pour les modèles : elle se juge à l'usage, sur des images qu'on voulait de toute façon.

**Revenu dans le périmètre — 2 septembre 2026 (la V3, et les deux règles qu'elle renverse).**
L'animation était écartée de la V1 puis de la V2, et le squelette avec elle — *« c'est
l'animation, pas le personnage »*. Trois bancs payés les 1<sup>er</sup> et 2 septembre 2026 —
141 planches, 6,03 $, toutes notées une par une par l'auteur — ont levé le doute qui la
retenait, et **la réponse n'est pas celle qu'on espérait** : une planche d'animation revient
bonne **une fois sur dix**, et **aucune façon de la demander ne fait mieux** que celle qui part
déjà. Ce n'est pas un motif d'abandon, c'est un prix — quelques centimes l'animation utilisable.
Mais **il impose la forme du produit** : on commande plusieurs planches et l'on garde la bonne,
jamais on n'en corrige une.

Une règle tombe avec elle, et elle tient toujours : **« Le pliage est une ruse d'appel, jamais un
format de livraison »**. Une planche devient un objet du produit — elle se voit dans la galerie,
se garde, et se déplie autant de fois qu'on veut, à la main. *Tranché par l'auteur le 2 septembre
2026.*

> **Amendé le 3 septembre 2026, et l'amendement est le fait de la journée.** Le soir même du
> 2 septembre, six essais neufs ont montré qu'un **clip vidéo** rend ce qu'une planche ne rend
> pas : une centaine d'images qui se suivent, un personnage stable, un fond détourable, et
> **plusieurs animations pour un seul paiement**. Le lendemain, un banc local a montré que le même
> clip se fabrique **sur la carte graphique de la maison, sans rien payer**.
>
> **L'animation ne passe donc plus du tout par la planche**, et deux conséquences sont tranchées
> par l'auteur : la planche et son dépliage **restent dans le périmètre mais changent de raison
> d'être** — ils servent le prix des poses fixes, des objets et des décors, plus jamais celui de
> l'animation —, et **le pantin sort du périmètre**. Il était le seul chemin qui supprimait la
> loterie ; le moteur de la maison le fait aussi, sans squelette, sans maillage et sans découpage
> en pièces. **Ce qui sort vers le jeu, ce sont donc les images seules** : planche de sprites,
> descriptif, image animée. *La sortie du squelette part avec le pantin, et ses arguments sont
> gardés en fin de `docs/PLAN.md`.*

**Revenu dans le périmètre — 2 septembre 2026 (les tables).** *« Le détourage par défaut n'est
pas du tout efficace, ça m'évitera de systématiquement le refaire à la main »* : la remarque a
été vérifiée avant d'être planifiée, et elle est exacte — le réglage de départ est corrigé plus
d'une fois sur deux, et les deux familles d'images ne veulent pas le même. Quatre choses entrent
donc dans le périmètre : **un réglage de départ par nature d'image**, **la vraie taille de bloc
retrouvée au lieu d'être supposée**, **le fond de génération comme réglage du jeu**, et **une
liste ouverte de moteurs de détourage**. Elles passent **entièrement avant l'animation**, et
pour une raison qui n'est pas de confort : le geste principal de la V3 est de juger une planche
en une seconde, et une image mal traitée n'est pas jugeable.

**Écarté par la V3 — 2 septembre 2026.** **Réécrire** la demande d'animation : **mesuré
mort** — trente-et-un réglages sur trois bancs, cinq réécritures de fond pour zéro bonne
planche sur vingt, les planches à quatre cases pour zéro sur seize. *Ce qui reste dans le
périmètre, et que la mesure n'a jamais touché, c'est de **ranger** ce qui part en parties
nommées — le contexte, les références, la demande —, et d'annoncer chaque image jointe pour ce
qu'elle est : un style, une pose, un gabarit.*
Dégrossir chez un fournisseur gratuit avant de payer le bon : le modèle gratuit n'accepte aucune
image en entrée, donc pas le personnage — ce serait un autre personnage, pas un brouillon.
Corriger le bord d'un détourage par calcul de transparence : **cherché sur quarante vraies
images, le défaut vaut un pixel sur mille**, et la correction en supprime 94 % d'un problème qui
n'existe pas ici. La 3D auto-riguée et le report d'un mouvement filmé : non mesurés, payants ou
suspendus à un compte que ce dépôt n'a pas. Un format de livraison inventé ici, pour la planche
comme pour le squelette : les formats les plus lus existent, ils s'écrivent tels quels. Faire du
pantin la sortie principale du produit : on ne sait pas encore s'il tient sur nos images, et
bâtir la livraison sur une chose non vérifiée est le contraire de la règle du dépôt. Faire
tourner le pantin sur les huit directions : il ne fait bouger que ce qui est déjà dessiné, et
les directions restent une affaire de génération. Une note de qualité par planche calculée par
le produit : la mesure automatique a été confrontée aux notes de l'auteur et **s'est révélée sans
rapport avec elles** — c'est l'œil qui juge, et l'écran doit montrer des images, pas des chiffres.
*(Les deux exclusions qui portent sur le pantin sont sans objet depuis le 3 septembre 2026 : il
est sorti du périmètre en entier.)*

**Écarté par le recadrage — 3 septembre 2026.** **Le pantin articulé**, en entier : il était le
seul moyen d'animer sans payer, le moteur de la maison l'est aussi, et il ne demande ni
squelette, ni maillage, ni découpage en pièces. Ce qui lui restait en propre — la même bande
redemandée revient identique à l'octet, et une animation de plus ne coûte pas même une attente —
est vrai et ne vaut pas six chantiers dans une version dont l'objectif est d'animer par la vidéo.
**Un second écran pour le moteur local** : il entre dans la même liste que les modèles payants,
avec le même geste, et c'est ce qui change qui s'affiche — une attente au lieu d'un prix.
**Modifier l'installation de ComfyUI** — paquet, réglage ou nœud : au banc du 3 septembre, mettre
à jour une bibliothèque pour la vidéo aurait pu casser le générateur de bruitages ; le produit
s'adapte à ce qu'il trouve. **Chercher un fournisseur vidéo de plus** : les vingt-huit modèles
vidéo passent par le compte déjà en place. *Tranché par l'auteur le 3 septembre 2026.*

**Reporté à une version dédiée — 2 septembre 2026.** **Le dessin à la main reste ce qu'il est
aujourd'hui : un pinceau d'un seul pixel.** Ni trait droit, ni rectangle, ni pot de peinture, ni
symétrie — et surtout pas de calques, de sélections ni d'historique de dessin. *Tranché par
l'auteur : « on ne les fait pas, il y aura plus tard une version avec éditeur. »* Ce n'est donc
pas un refus mais un **rang** : ces gestes appartiennent tous au même chantier, et les prendre
un par un fabriquerait un demi-éditeur que personne n'aurait décidé — chacun paraît petit isolé,
et c'est exactement ce qui les fait entrer sans qu'on les ait choisis. La version qui les portera
n'a pas de rang fixé, et rien du plan actuel ne la présuppose.

**Écarté par les tables — 2 septembre 2026.** Un réglage de départ **deviné** depuis l'image
reçue : l'auteur déclare, comme partout ailleurs. Une couleur de fond **imposée** par un calcul :
l'atelier propose, l'auteur tranche — c'est un morceau du texte qui part, et il lui appartient.
Demander au modèle de décrire ce qu'il vient de dessiner : personne ne le pratique, et pour une
bonne raison — on écrit d'avance ce qu'on attend et l'on mesure sur l'image revenue si c'est là.
Demander une image déjà détourée : le catalogue déclare l'option, mais **elle n'est pas ouverte
sur le modèle que le produit emploie** — la mesurer voudrait dire changer de modèle, donc changer
tout le reste avec. Et **un cran intermédiaire entre le moteur rapide et le moteur lourd** :
vérifié le 2 septembre 2026, il existe déjà et porte ce nom-là depuis le lot d'usage.

