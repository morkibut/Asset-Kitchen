# Asset Kitchen — PRD

> Écrit le 26 août 2026, **tenu à jour au 2 septembre 2026**. Ce document fait foi sur **ce
> que doit faire le produit, du point de vue de l'usage**. Il ne dit rien de la construction :
> voir `docs/ARCHITECTURE.md`. Ce qui reste à construire et dans quel ordre : `docs/PLAN.md`.
> Ce que les bancs de la V3 ont mesuré : `docs/bilan-v3.md`.

---

## Problème

L'auteur fabrique un jeu 2D seul. Il lui faut des assets qui appartiennent tous au même
univers — des personnages, des objets, des décors, des éléments d'interface qui ont l'air
d'avoir été dessinés par la même main.

Aucun des chemins disponibles ne lui donne ça. Les modèles installés sur sa machine ne
tiennent pas l'identité d'un sujet d'une image à la suivante, et mettent près de deux minutes
par image — assez pour que l'aller-retour cesse d'en être un. Les ateliers en ligne
généralistes lui vendent des crédits pour un univers qu'ils ne connaissent pas : à chaque
prompt il retape son style, et ce qui sort ressemble à ce qu'un autre aurait obtenu. Et sa
propre chaîne de production en lot fabrique de la quantité la nuit, quand ce dont il a besoin
c'est de fabriquer peu, bien, en regardant.

Trois frottements reviennent à chaque séance. Le style repart de zéro à chaque image, parce
que l'univers ne vit que dans sa tête et dans le prompt qu'il réécrit. La taille du pixel
dérive d'une génération à l'autre — deux images du même personnage n'ont plus la même grille,
et ne se montent donc pas ensemble. Enfin, l'agent qui l'aide à coder le jeu ne peut pas
fabriquer d'image : il faut sortir de l'éditeur, aller ailleurs, revenir avec un fichier.

Pourquoi maintenant : le doute qui bloquait tout est levé. Un banc de douze configurations a
montré qu'une famille de modèles tient réellement l'identité d'un sujet sur plusieurs
générations enchaînées, et qu'aucun des trois frottements n'est fatal — chacun se corrige
après coup, sans repayer, à condition que le produit s'en charge systématiquement.

**Puis l'atelier a servi, et un quatrième frottement est apparu, propre au personnage.** Un
personnage de jeu n'est pas une image, c'est un plan : une dizaine de poses, et pour chaque
pose autant de variantes qu'il porte de pièces d'équipement. Fabriqué image par image, ce
plan est intenable sur les deux tableaux à la fois. Il coûte un appel par case, et le
tableau se remplit vite : dix poses et quatre pièces font cinquante images à payer une par
une. Et il ne tient pas ensemble : entre deux appels, la taille du pixel dérive et le
personnage se déplace dans son cadre, si bien que deux images du même personnage ne se
montent pas — ce qui est exactement ce dont on a besoin d'un personnage.

Le contournement naturel est pire. Demander « le même personnage, mais avec un casque » fait
retirer le personnage entier au modèle : il redessine tout, et ce qui revient n'est plus le
même nain avec un casque, c'est un autre nain. L'auteur se retrouve à choisir entre payer
cinquante fois et accepter que son casting change de visage en cours de route.

**Puis le produit a servi trois jours de suite, et deux frottements de plus sont apparus — le
premier sous les doigts, le second dans les chiffres.**

**Le traitement se refait à la main sur presque chaque image.** Le réglage de départ du
découpage est le même pour tout : une image seule, un morceau de planche, un décor, un
personnage. Compté sur les cent seize images de l'auteur, **il est corrigé plus d'une fois sur
deux**, et les deux familles ne veulent visiblement pas la même chose — deux tiers des images
seules portent une correction du bord contre un peu plus d'un tiers des morceaux de planche, et
la pipette ne sert jamais sur un morceau de planche. À côté, le plus vieux défaut du produit
n'a jamais été réglé : un modèle rend une image de mille pixels *à l'allure* pixel art dont les
blocs sont inégaux et les bords flous, et la ramener sur la grille du jeu fabrique de la
bouillie. **Chacune de ces corrections coûte une minute, et il y en a une par image.**

**Et l'animation, qui est ce que le jeu réclame ensuite, ne tient sur aucun des deux tableaux.**
Un personnage figé ne marche pas : il faut une suite d'images qui, mises bout à bout, donnent un
pas. Demandées au modèle sur une planche, elles reviennent bonnes **une fois sur dix** — mesuré
sur cent trente-cinq planches payées et regardées une par une. Et **réécrire la demande est
épuisé comme levier** : trente-et-un réglages sur trois bancs, puis six variantes de plus, aucune
ne bat le témoin. *Cette voie-là est close, et c'est mesuré.*

**Ce qui est payé est aussi détruit avant d'être vu** : l'atelier recadre chaque image sur ce
qu'elle occupe, si bien qu'un bras tendu réduit tout le personnage — le balancement, s'il
existait, se perd entre le modèle et l'écran. Et **il n'y a rien pour juger** : ce qui revient est
découpé d'office, les morceaux entrent en bibliothèque, et l'auteur ne voit jamais la marche
tourner.

**Le chemin qui marche a été trouvé le 2 septembre 2026, et il ne passe pas par la planche.** On
demande au modèle **une petite vidéo du personnage** au lieu d'une grille de dessins : une
centaine d'images d'un mouvement continu, dans lesquelles on prélève ce qu'on veut. Trois faits
le portent, tous mesurés : le personnage y reste stable, son fond reste détourable, et **un même
clip porte plusieurs animations** — le repos et la marche s'y découpent séparément. Le tri se
fait donc *dans* le tirage au lieu d'entre les tirages. Et le clip se fabrique aussi **sur la
carte graphique de la maison**, sans rien payer.

## Solution

Un atelier personnel, qui tourne sur la machine de l'auteur et s'ouvre dans son navigateur.

On y définit **l'univers** d'un jeu une fois : des références rassemblées et triées, quelques
images promues au rang d'artwork officiel et rangées par famille, une bible en champs nommés,
une palette qui se déduit toute seule des artworks, une taille de pixel cible. Ensuite on
fabrique au cas par cas — un personnage, un tonneau, une icône — et chaque génération part
déjà habillée de cet univers, avec les seules références qui la concernent, sans qu'on ait
rien à retaper ni rien à sélectionner.

Ce qui sort est immédiatement retouchable sans repayer : recadrer, ramener sur la grille du
projet, ramener sur sa palette, détourer, découper une planche en sprites. L'image d'origine
est gardée intacte et les retouches sont une recette, qu'on rejoue, qu'on nomme, qu'on annule.
Changer la palette d'un projet la réapplique à tout ce qu'il contient sans un seul appel
payant.

Tout ce qui est produit reste dans une bibliothèque unique, rangée en projets et collections,
où l'on retrouve, réutilise et exporte. Et l'agent qui code le jeu dispose exactement des
mêmes gestes : il demande un asset, l'univers du projet s'applique, il reçoit un fichier — et
peut le déposer directement dans le dossier du jeu.

**Sur cet atelier vient se poser le personnage, et son équipement.** Le projet porte un plan
de poses ; un personnage déclare lesquelles il tient, et un écran à deux entrées montre en
permanence ce qui est fait et ce qui manque. Ce qui manque se lance par paquets : on
sélectionne les poses qu'on veut, elles partent **pliées dans une seule image** et reviennent
dépliées en autant de sprites. Un appel au lieu de N, et les poses d'un même paquet partagent
la même grille de pixel parce qu'elles ont été peintes ensemble.

**L'équipement se fabrique par le même pliage.** Un casque vu de face n'est pas un casque vu
de dos : une pièce est solidaire de la pose sur laquelle elle est apparue, et il en faut donc
une par pose. Mais on ne les paie pas une par une. L'atelier recompose lui-même une planche
des corps déjà générés, l'envoie avec « la même planche, avec la pièce en plus, ne touche à
rien d'autre », redécoupe ce qui revient sur la grille qu'il a lui-même posée, et compare case
par case ce qu'il a envoyé — qu'il connaît exactement, puisqu'il l'a composé — et ce qui
revient. Chaque différence est un calque à fond transparent, rangé à côté de son corps et
jamais dedans. **N calques pour un appel.**

Le pliage cesse alors d'être une astuce du lot de poses pour devenir la manière dont l'atelier
travaille : **habiller ou transformer N images d'un seul appel**, sur une grille dont il
connaît la géométrie case par case.

**Puis l'atelier a été tenu pendant trois jours, et un cinquième frottement est apparu — celui
de l'écran lui-même.** Sept surfaces se recouvraient, cinq boutons de même poids se
partageaient la barre du haut, et les réglages de ce qu'on fabrique occupaient trois cents
pixels en permanence sur l'écran dont le seul métier est de juger des images. La bande de
réglages de l'univers faisait presque trois écrans de haut, et la première image
d'inspiration arrivait après six écrans et demi de défilement. Surtout, rien ne disait jamais
ce que le jeu réclamait encore : l'écran des personnages affichait « six poses » de la même
façon que zéro ou six soient faites.

La réponse est **trois lieux au lieu de sept surfaces**, et une distinction qui tient tout le
reste : *une image est un résultat, une chose du jeu est une chose du jeu*. **L'univers** tient
ce qui s'applique à tout sans appartenir à personne — les références rassemblées, les réglages
du jeu, les lots de style réutilisables. **Le codex** tient la liste de ce que le monde
contient, et pour chaque chose ce qu'elle a déjà et ce qui lui manque. **La galerie** tient
toutes les images produites, et l'on n'y paie jamais un centime. Sous le codex s'ouvre
**l'établi** — une chose ouverte, ses cases pleines et ses cases vides, et la barre qui paie en
pied. Balthazar existe dans le codex avant d'avoir la moindre image, et c'est ce qui permet au
produit de dire ce qui lui manque.

La zone où la pièce a le droit d'être se dessine à la souris et se corrige après coup pour
rien ; ce que la machine sait mesurer — combien de silhouette a survécu, combien de corps a
été repeint — est affiché mais ne décide de rien. **Seul le compte d'images refuse**, parce
que neuf poses demandées et sept reçues est un contrat rompu, pas un avis esthétique. Et une
limite est écrite d'avance plutôt que découverte à l'usage : la méthode tient pour une pièce
**contenue dans la silhouette** — casque, jambières, ceinture, gants, plastron — et casse pour
une pièce qui **l'agrandit** — cape, ailes, arme longue, sac à dos, monture.

**Puis l'interface refaite a été usée deux fois le même soir, et les tables de retouche ont
réclamé cinq choses qu'aucun écran ne savait faire.** Les deux premières rendent la recette
maniable. **Une place s'éteint sans se vider** : on essaie l'image sans elle, on rallume, et
l'on retrouve ce qu'on avait posé — éteindre et vider cessent d'être le même geste. **Et les
réglages voyagent**, de deux façons qui n'ont pas la même durée de vie : on les copie d'une
image sur l'autre pour la séance en cours, on les enregistre sous un nom pour ce qui doit lui
survivre. Ce qui *ne* voyage pas est écrit avec : un endroit désigné sur **cette** image-là —
un cadre tracé, un point de pipette, une forme entourée, un passage de la main — ne veut rien
dire sur une autre, et six attitudes d'un même personnage n'ont pas la même silhouette.

Les trois autres comblent des absences, et c'est ce que la seconde séance a de particulier :
regarder un écran de près cesse de trouver des défauts et commence à trouver ce qui manque.
**Le texte qui a fabriqué une image se relit sur sa fiche**, entier et tel qu'il est parti —
il était enregistré depuis le premier jour et n'était affiché nulle part. **On entoure
grossièrement un sujet et l'atelier va chercher son bord** à l'intérieur de ce qu'on a
entouré : une quatrième façon de désigner ce qu'on retire, à côté du remplissage depuis le
bord, de la pipette et du modèle, pour ce que ni le détourage automatique — qui décide seul
et se trompe — ni la retouche au pixel — qui demande de suivre un contour entier — ne savent
faire. **Et le détourage par modèle, qui ne connaissait qu'un seul modèle, en connaît un
second, plus lourd et meilleur** : il n'est pas le défaut, il annonce sa lenteur avant de
partir, et il se grise avec sa raison quand la machine ne l'a pas.

**Et le texte qui part cesse d'être un bloc.** Il se range en trois parties nommées — ce que
le jeu est, les images jointes, et ce qu'on demande cette fois-ci —, et l'écran qui montre ce
qui va partir les montre séparément, de sorte qu'on corrige l'une sans toucher aux autres.
**Chaque image jointe est annoncée pour ce qu'elle est** — un style, une pose, un gabarit —, ce
qu'aucune ligne ne disait jusque-là : un artwork de style, un gabarit de découpe et un sprite
de référence partaient dans le même sac, et rien n'empêchait le modèle de prendre l'un pour
l'autre.

**Puis les tables ont cessé d'être à refaire.** Le réglage de départ du traitement n'est plus
unique : il dépend de **ce qu'on fabrique** — une image seule et une planche n'ont pas le même
défaut, et une famille de l'univers peut porter le sien. L'auteur voit lequel s'appliquera, et
d'où il vient, avant de générer. L'atelier **retrouve la vraie taille de bloc** que le modèle a
dessinée au lieu de la supposer, et ramène à la cible sans fabriquer de couleurs entre deux : un
aplat reste un aplat, un bord net reste net, et la palette du jeu s'applique après la réduction
et non avant. **Le fond sur lequel le modèle pose le sujet devient un réglage du jeu** —
choisi par l'auteur, visible, et corrigible à la main juste avant de payer, parce que c'est un
morceau du texte qui part comme un autre ; l'atelier peut proposer une couleur que rien du jeu
ne porte, il ne l'impose jamais. Et **le détourage gagne un moteur fait pour
des dessins** : les trois qu'il connaît viennent tous de la photographie, alors que ses images
sont des dessins. Le catalogue en accueille un de plus, entraîné sur du dessin.

**Sur cet atelier vient enfin se poser le mouvement, et il s'obtient en vidéo.** Cinq choses le
rendent possible, et elles se suivent.

**Un mouvement se dit une fois pour toutes.** Repos, marche, course, saut, attaque : ce ne sont
plus des phrases retapées à chaque personnage, mais des objets de l'atelier qui portent leur
texte, leur cadence et les directions où ils ont un sens. **Ce n'est pas une seconde liste à côté
des poses** : c'est ce que la même pose sait dire quand on l'anime. Deux commandes du même
mouvement partent alors avec exactement la même demande, et ce qui varie d'un tirage à l'autre
redevient le tirage, non la frappe.

**Un clip se commande, et rien de ce qui est payé ne se perd.** On choisit un personnage, un
mouvement et un modèle ; **l'image de départ se propose et se change** — la case visée si elle
porte déjà une image, le portrait du personnage sinon. Le prix s'annonce avant l'envoi avec la
formule qui le produit, le montant réellement facturé s'enregistre au retour, et un clip payé
garde sa dépense même si son fichier revient illisible ou si l'atelier se ferme pendant l'attente.
On peut en lancer plusieurs à la suite et les regarder revenir un par un.

**Un clip devient plusieurs animations.** L'écran de montage l'ouvre en boucle et montre deux
aperçus côte à côte : les images brutes du modèle à gauche — *le mouvement est-il bon ?* —, les
mêmes passées par la chaîne du jeu à droite — *la bande est-elle bonne ?* **Juger un mouvement et
juger un découpage sont deux métiers.** L'auteur prend ou laisse **chaque image d'un clic**, parce
qu'un pas de marche demande deux images serrées au contact et une seule pendant la glisse ; il
nomme ce qu'il garde, l'affecte à une case du plan de poses, et **recommence dans le même clip**
pour l'animation suivante. Les images d'une bande se recadrent sur **une seule fenêtre commune,
prise sur le clip entier** — sans quoi le personnage grandit de dix pour cent en se mettant à
marcher.

**Et l'atelier sait animer sans payer.** Le même clip se fabrique sur la carte graphique de la
maison. Le moteur local apparaît dans la même liste que les modèles payants, avec le même geste
pour le choisir ; ce qui change est ce qui s'affiche à côté : **une attente au lieu d'un prix**.
Un coût de zéro n'est pas un coût inconnu, et le journal des dépenses les distingue. C'est ce qui
rend praticable de couvrir **toutes les poses d'un personnage** : la matrice se lit alors sur deux
calques — les images fixes, les animations —, chacun avec sa jauge, et l'on voit d'un coup d'œil
ce qui n'est pas encore animé.

**Enfin, une bande sort, et une image se rattrape au passage.** Ce qui part vers le jeu, ce sont
les images : planche de sprites et son descriptif dans le format que les moteurs lisent déjà,
image animée pour la montrer sans rien installer, cadence écrite dedans. Le contour cesse de
grésiller quand la bande tourne — un défaut fixe est un défaut, un défaut animé est un défaut
qu'on regarde. Et pendant qu'il découpe, l'auteur peut **mettre de côté n'importe quelle image du
clip** : elle entre en bibliothèque avec sa filiation, et sert de pose fixe, d'objet ou de ce
qu'il voudra.

## Utilisateur cible

Une personne : l'auteur du jeu, qui est aussi l'auteur de cet outil. Il travaille seul, pour
lui, sur un écran large, en français. Il code son jeu avec l'aide d'un agent, dans une autre
fenêtre, et bascule vers l'atelier quand il lui manque une image.

Il sait ce qu'est un sprite, une grille de pixels, une palette indexée et un atlas. Il juge la
qualité à l'œil, mieux et plus vite qu'une machine ne le ferait, et il n'a aucune envie qu'on
la juge à sa place. Il paie ses images à l'appel et regarde ce que ça coûte, sans vouloir d'un
système de crédits.

Sa séance type dure une demi-heure : il ouvre l'atelier avec une image en tête, écrit, lance
trois ou quatre variations, en garde une, la retouche, la range, et retourne coder. Il ne veut
ni tunnel de configuration ni écran obligatoire avant d'écrire son prompt : ce qui s'ouvre au
premier lancement se quitte à n'importe quelle étape, et rien n'y est exigé.

## User Stories → `docs/user-stories.md`

**Les 494 user stories vivent dans `docs/user-stories.md`**, groupées par geste. Elles
se consultent par numéro, quand un critère en cite une — pas au démarrage d'une session.
Quelle tranche porte laquelle se lit dans `docs/PLAN.md`, § Couverture.
`US-174` à `US-308` sont celles de la V2.1, écrites le 31 août 2026 ; `US-309` à `US-333`
celles de la V2.2, écrites le même jour ; `US-334` à `US-366` les cinq capacités que les deux
séances d'usage de la V2.1 ont réclamées, écrites le 1<sup>er</sup> septembre 2026 ; `US-367`
à `US-430` le 2 septembre — la planche qui revient de travers, l'animation, les tables de
retouche.

**Les soixante-trois dernières sont des 2 et 3 septembre 2026, et elles portent le passage à la
vidéo.** `US-431` à `US-433` pour le texte qui part en trois parties ; `US-434` à `US-461` pour le
clip, son montage et le moteur de la maison ; `US-462` à `US-475` pour deux écrans repris après
une séance d'usage ; `US-476` à `US-481` pour les tailles du monde ; `US-482` à `US-494` pour le
recadrage du 3 septembre — animer toute la matrice d'un personnage, attraper une image d'un clip
au vol, et ouvrir le dépliage à plusieurs sujets. **Quatre stories sont retirées** ce jour-là,
barrées à leur place avec la raison : `US-375`, `US-377`, `US-378` et `US-389`.

## Critères de succès → `docs/prd-criteres.md`

**À quoi chaque promesse du produit se mesure** vit dans `docs/prd-criteres.md`.
*Descendu en annexe le 6 septembre 2026* — la section pesait **28 %** de ce document, et le
corpus de démarrage 596 Ko. Le texte n'a pas bougé d'un mot ; seul l'endroit où on le lit a
changé.

On l'ouvre quand on écrit un critère d'acceptation qui doit s'y raccrocher — pas au démarrage
d'une session.


## Hors périmètre → `docs/prd-hors-perimetre.md`

**Ce que le produit ne fera pas, et pourquoi**, vit dans `docs/prd-hors-perimetre.md`.
*Descendu en annexe le 6 septembre 2026* — la section pesait **38 %** de ce document, la plus
lourde des huit. Le texte n'a pas bougé d'un mot.

On l'ouvre quand une idée arrive et qu'on veut savoir **si elle a déjà été écartée, et sur
quel argument**. C'est là qu'est toute sa valeur, et elle ne sert à rien tant que la question
ne se pose pas.


## Décisions d'implémentation → `docs/prd-decisions.md`

**Ce que le produit a tranché, question par question**, vit dans
`docs/prd-decisions.md` : ce qui entre en bibliothèque et ce qui se juge, ce que
la génération coûte et ce qu'elle refuse, ce que l'univers impose, ce que
l'agent peut. *Descendu en annexe le 31 août 2026* — la section pesait **55 %**
de ce document, et le corpus de démarrage 301 Ko. Le texte n'a pas bougé d'un
mot ; seul l'endroit où on le lit a changé.

Elle se lit **à la demande**, quand une décision d'usage paraît arbitraire ou
qu'on veut savoir si une question a déjà été tranchée — jamais au démarrage
d'une session.

## Notes complémentaires → `docs/prd-carnet.md`

Ce qu'une séance ou un banc a trouvé, et qui explique une décision de ce document sans la
remplacer, vit dans **`docs/prd-carnet.md`**. On l'ouvre quand une décision d'ici paraît
arbitraire et qu'on veut savoir ce qui l'a dictée.
